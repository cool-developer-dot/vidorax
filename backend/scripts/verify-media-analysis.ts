/**
 * Focused verification for Phase 1 media analysis.
 *
 * Covers URL security, format mapping, HLS parsing, downloadability rules,
 * and live HTTP analysis against a local mock media server.
 *
 * Usage:
 *   MEDIA_ANALYSIS_ALLOW_LOOPBACK=1 npx tsx scripts/verify-media-analysis.ts
 */

import http from 'node:http';
import { AddressInfo } from 'node:net';

process.env.MEDIA_ANALYSIS_ALLOW_LOOPBACK = '1';
process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/vidorax_verify';

const {
  isPrivateOrLocalHostname,
  isSafeAnalysisUrl,
  assertSafeAnalysisUrl,
  UnsafeUrlError,
  sanitizeUrlForLog,
} = await import('../src/utils/url-security.js');

const {
  resolveExtension,
  resolveContainer,
  resolveMediaType,
  resolveMimeType,
  derivePlatform,
  isHlsMimeType,
} = await import('../src/services/media-analysis/media-format.js');

const { parseHlsManifest } = await import(
  '../src/services/media-analysis/hls-parser.js'
);

const { analyzeUrl } = await import('../src/services/media-analysis/index.js');
const { AppError } = await import('../src/utils/errors/index.js');
const app = (await import('../src/app.js')).default;
const jwt = await import('jsonwebtoken');

let passed = 0;
let failed = 0;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL  ${name}\n      ${message}`);
  }
}

function startMockServer(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (url.pathname === '/video.mp4') {
      res.writeHead(200, {
        'content-type': 'video/mp4',
        'content-length': '1048576',
        'content-disposition': 'attachment; filename="sample.mp4"',
      });
      if (req.method !== 'HEAD') {
        res.end('mp4-bytes');
      } else {
        res.end();
      }
      return;
    }

    if (url.pathname === '/audio.mp3') {
      res.writeHead(200, {
        'content-type': 'audio/mpeg',
        'content-length': '204800',
      });
      if (req.method !== 'HEAD') {
        res.end('mp3-bytes');
      } else {
        res.end();
      }
      return;
    }

    if (url.pathname === '/progressive.webm') {
      res.writeHead(200, {
        'content-type': 'video/webm',
        'content-length': '409600',
      });
      if (req.method !== 'HEAD') {
        res.end('webm-bytes');
      } else {
        res.end();
      }
      return;
    }

    if (url.pathname === '/stream.m3u8') {
      const body = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
low.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=1280x720
high.m3u8
`;
      res.writeHead(200, {
        'content-type': 'application/vnd.apple.mpegurl',
        'content-length': String(Buffer.byteLength(body)),
      });
      if (req.method !== 'HEAD') {
        res.end(body);
      } else {
        res.end();
      }
      return;
    }

    if (url.pathname === '/encrypted.m3u8') {
      const body = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-KEY:METHOD=AES-128,URI="https://example.com/key"
#EXTINF:10.0,
segment0.ts
#EXT-X-ENDLIST
`;
      res.writeHead(200, {
        'content-type': 'application/x-mpegURL',
        'content-length': String(Buffer.byteLength(body)),
      });
      if (req.method !== 'HEAD') {
        res.end(body);
      } else {
        res.end();
      }
      return;
    }

    if (url.pathname === '/page.html') {
      const body = '<html><body>hello</body></html>';
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(Buffer.byteLength(body)),
      });
      if (req.method !== 'HEAD') {
        res.end(body);
      } else {
        res.end();
      }
      return;
    }

    if (url.pathname === '/doc.pdf') {
      res.writeHead(200, {
        'content-type': 'application/pdf',
        'content-length': '1234',
      });
      if (req.method !== 'HEAD') {
        res.end('%PDF');
      } else {
        res.end();
      }
      return;
    }

    if (url.pathname === '/missing.mp4') {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('missing');
      return;
    }

    if (url.pathname === '/forbidden.mp4') {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('forbidden');
      return;
    }

    if (url.pathname === '/slow.mp4') {
      // Intentionally hang until client aborts.
      return;
    }

    if (url.pathname === '/redirect-safe') {
      res.writeHead(302, { location: '/video.mp4' });
      res.end();
      return;
    }

    if (url.pathname === '/redirect-unsafe') {
      res.writeHead(302, { location: 'file:///etc/passwd' });
      res.end();
      return;
    }

    res.writeHead(404);
    res.end('not found');
  });

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }
              closeResolve();
            });
          }),
      });
    });
    server.on('error', reject);
  });
}

console.log('Phase 1 media analysis verification\n');

await test('rejects empty / malformed / unsafe schemes', () => {
  assert(!isSafeAnalysisUrl(''), 'empty');
  assert(!isSafeAnalysisUrl('not a url'), 'malformed');
  assert(!isSafeAnalysisUrl('javascript:alert(1)'), 'javascript');
  assert(!isSafeAnalysisUrl('file:///etc/passwd'), 'file');
  assert(!isSafeAnalysisUrl('data:text/plain,hi'), 'data');
  assert(!isSafeAnalysisUrl('blob:https://example.com/1'), 'blob');
  assert(!isSafeAnalysisUrl('chrome://settings'), 'chrome');
  assert(!isSafeAnalysisUrl('intent://scan/#Intent'), 'intent');
  assert(!isSafeAnalysisUrl('content://media/external'), 'content');
  assert(isSafeAnalysisUrl('https://cdn.example.com/video.mp4'), 'https ok');
});

await test('blocks private / loopback hosts by default', () => {
  assert(isPrivateOrLocalHostname('127.0.0.1'), 'loopback');
  assert(isPrivateOrLocalHostname('192.168.1.10'), 'rfc1918');
  assert(isPrivateOrLocalHostname('10.0.0.5'), 'rfc1918-10');
  assert(isPrivateOrLocalHostname('169.254.1.1'), 'link-local');
  assert(!isPrivateOrLocalHostname('8.8.8.8'), 'public');
  assert(
    !isPrivateOrLocalHostname('127.0.0.1', { allowLoopback: true }),
    'loopback allow',
  );
});

await test('assertSafeAnalysisUrl throws for unsafe targets', () => {
  try {
    assertSafeAnalysisUrl('javascript:void(0)');
    throw new Error('expected throw');
  } catch (error) {
    assert(error instanceof UnsafeUrlError, 'UnsafeUrlError');
  }
});

await test('MIME / container mapping for MP4 MP3 HLS', () => {
  assert(resolveExtension('https://x/a.mp4', null) === 'mp4', 'mp4 ext');
  assert(resolveContainer('mp4') === 'mp4', 'mp4 container');
  assert(resolveMediaType('mp4', 'mp4') === 'video', 'mp4 type');
  assert(resolveMimeType('mp4', null) === 'video/mp4', 'mp4 mime');

  assert(resolveExtension('https://x/a.mp3', null) === 'mp3', 'mp3 ext');
  assert(resolveMediaType('mp3', 'mp3') === 'audio', 'mp3 type');
  assert(resolveMimeType(null, 'audio/mpeg') === 'audio/mpeg', 'mp3 mime');

  assert(isHlsMimeType('application/vnd.apple.mpegurl'), 'hls mime apple');
  assert(isHlsMimeType('application/x-mpegURL'), 'hls mime x');
  assert(resolveContainer('m3u8') === 'hls', 'hls container');
  assert(resolveMediaType('hls', 'm3u8') === 'stream', 'hls type');
});

await test('platform derivation stays Download-API safe', () => {
  assert(derivePlatform('https://www.youtube.com/watch') === 'YOUTUBE', 'yt');
  assert(derivePlatform('https://cdn.example.com/a.mp4') === 'CDN_EXAMPLE', 'cdn');
  assert(/^[A-Z][A-Z0-9_]{0,49}$/.test(derivePlatform('https://a.co/x')), 'pattern');
});

await test('HLS parser detects master / encryption', () => {
  const master = parseHlsManifest(
    `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1000,RESOLUTION=640x360
a.m3u8
`,
    'https://cdn.example.com/master.m3u8',
  );
  assert(master?.isMaster === true, 'master');
  assert(master?.variants.length === 1, 'variant');
  assert(master?.isEncrypted === false, 'not encrypted');
  assert(master?.variants[0]?.bandwidth === 1000, 'bandwidth');

  const encrypted = parseHlsManifest(
    `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXT-X-KEY:METHOD=AES-128,URI="https://cdn.example.com/key"
#EXTINF:10,
seg.ts
#EXT-X-ENDLIST
`,
    'https://cdn.example.com/media.m3u8',
  );
  assert(encrypted?.isEncrypted === true, 'encrypted');
  assert(encrypted?.isMedia === true, 'media playlist');
});

await test('sanitizeUrlForLog redacts credentials and tokens', () => {
  const sanitized = sanitizeUrlForLog(
    'https://user:pass@cdn.example.com/a.mp4?token=secret&x=1',
  );
  assert(!sanitized.includes('pass'), 'no password');
  assert(!sanitized.includes('secret'), 'no secret');
  assert(!sanitized.includes('token='), 'no token query');
  assert(sanitized.includes('cdn.example.com'), 'host kept');
  assert(sanitized.includes('/a.mp4'), 'path kept');
});

const mock = await startMockServer();

try {
  await test('analyzes direct MP4 as downloadable', async () => {
    const result = await analyzeUrl(`${mock.baseUrl}/video.mp4`);
    assert(result.downloadable === true, 'downloadable');
    assert(result.mediaType === 'video', 'mediaType');
    assert(result.container === 'mp4', 'container');
    assert(result.mimeType === 'video/mp4', 'mime');
    assert(result.fileSize === '1048576', 'size');
    assert(result.title === 'sample.mp4', 'title from disposition');
    assert(result.unsupportedReason === null, 'no reason');
    assert(result.duration === null, 'no fabricated duration');
    assert(result.width === null, 'no fabricated width');
    assert(result.height === null, 'no fabricated height');
    assert(result.bitrate === null, 'no fabricated bitrate');
    assert(result.variants.length === 1, 'one progressive variant');
    assert(result.variants[0]?.streamType === 'PROGRESSIVE', 'progressive');
    assert(result.variants[0]?.estimatedFileSize === 1048576, 'estimated size');
  });

  await test('analyzes MP3 as downloadable audio', async () => {
    const result = await analyzeUrl(`${mock.baseUrl}/audio.mp3`);
    assert(result.downloadable === true, 'downloadable');
    assert(result.mediaType === 'audio', 'mediaType');
    assert(result.container === 'mp3', 'container');
    assert(result.mimeType === 'audio/mpeg', 'mime');
  });

  await test('analyzes progressive video as downloadable', async () => {
    const result = await analyzeUrl(`${mock.baseUrl}/progressive.webm`);
    assert(result.downloadable === true, 'downloadable');
    assert(result.mediaType === 'video', 'mediaType');
    assert(result.container === 'webm', 'container');
  });

  await test('detects basic unencrypted VOD HLS as downloadable', async () => {
    const result = await analyzeUrl(`${mock.baseUrl}/stream.m3u8`);
    assert(result.downloadable === true, 'downloadable');
    assert(result.mediaType === 'stream', 'mediaType');
    assert(result.container === 'hls', 'container');
    assert(result.unsupportedReason == null, 'no unsupported reason');
    assert(result.width === 1280, 'width from best variant');
    assert(result.height === 720, 'height');
    assert(result.resolution === '1280x720', 'resolution');
    assert(Array.isArray(result.variants), 'variants array');
    assert(result.variants.length === 2, 'two real variants');
    assert(result.variants[0]?.height === 720, 'sorted highest first');
    assert(result.variants[1]?.height === 360, 'second variant');
  });

  await test('rejects encrypted HLS without bypass', async () => {
    const result = await analyzeUrl(`${mock.baseUrl}/encrypted.m3u8`);
    assert(result.downloadable === false, 'not downloadable');
    assert(result.unsupportedReason === 'ENCRYPTED_MEDIA', 'encrypted');
  });

  await test('handles non-media webpage as NO_MEDIA', async () => {
    const result = await analyzeUrl(`${mock.baseUrl}/page.html`);
    assert(result.downloadable === false, 'not downloadable');
    assert(result.unsupportedReason === 'NO_MEDIA', 'no media');
  });

  await test('handles unsupported MIME as UNSUPPORTED_FORMAT', async () => {
    const result = await analyzeUrl(`${mock.baseUrl}/doc.pdf`);
    assert(result.downloadable === false, 'not downloadable');
    assert(result.unsupportedReason === 'UNSUPPORTED_FORMAT', 'unsupported');
  });

  await test('handles source 404 as NETWORK_ERROR', async () => {
    const result = await analyzeUrl(`${mock.baseUrl}/missing.mp4`);
    assert(result.downloadable === false, 'not downloadable');
    assert(result.unsupportedReason === 'NETWORK_ERROR', 'network');
  });

  await test('handles source 403 as NETWORK_ERROR', async () => {
    const result = await analyzeUrl(`${mock.baseUrl}/forbidden.mp4`);
    assert(result.downloadable === false, 'not downloadable');
    assert(result.unsupportedReason === 'NETWORK_ERROR', 'network');
  });

  await test('handles unreachable host as NETWORK_ERROR', async () => {
    const result = await analyzeUrl('http://127.0.0.1:1/nope.mp4');
    assert(result.downloadable === false, 'not downloadable');
    assert(result.unsupportedReason === 'NETWORK_ERROR', 'network');
  });

  await test('rejects redirect to unsupported scheme', async () => {
    try {
      await analyzeUrl(`${mock.baseUrl}/redirect-unsafe`);
      throw new Error('expected AppError');
    } catch (error) {
      assert(error instanceof AppError, 'AppError');
      assert(error.statusCode === 400, '400');
    }
  });

  await test('follows safe redirect to MP4', async () => {
    const result = await analyzeUrl(`${mock.baseUrl}/redirect-safe`);
    assert(result.downloadable === true, 'downloadable');
    assert(result.container === 'mp4', 'mp4');
    assert(result.finalUrl.endsWith('/video.mp4'), 'final url');
  });

  await test('handles request timeout as NETWORK_ERROR', async () => {
    process.env.MEDIA_ANALYSIS_TIMEOUT_MS = '200';
    // Re-import is unnecessary — timeout is read per call via ANALYSIS_TIMEOUT_MS
    // which was evaluated at module load. Probe uses init.timeoutMs ?? constant.
    // Force a short timeout through a direct probe instead.
    const { followRedirects, AnalysisNetworkError } = await import(
      '../src/services/media-analysis/http-probe.js'
    );
    try {
      await followRedirects(`${mock.baseUrl}/slow.mp4`, {
        method: 'GET',
        timeoutMs: 200,
        security: { allowLoopback: true },
      });
      throw new Error('expected timeout');
    } catch (error) {
      assert(error instanceof AnalysisNetworkError, 'AnalysisNetworkError');
      assert(error.kind === 'timeout', 'timeout kind');
    }
  });

  await test('rejects private target when loopback not allowed', async () => {
    process.env.MEDIA_ANALYSIS_ALLOW_LOOPBACK = '0';
    try {
      await analyzeUrl(`${mock.baseUrl}/video.mp4`);
      throw new Error('expected AppError');
    } catch (error) {
      assert(error instanceof AppError, 'AppError');
      assert(error.statusCode === 400, '400');
    } finally {
      process.env.MEDIA_ANALYSIS_ALLOW_LOOPBACK = '1';
    }
  });
} finally {
  await mock.close();
}

// --- HTTP route contract (auth + envelope + no DownloadHistory side effects) ---
const apiServer = http.createServer(app);
await new Promise<void>((resolve, reject) => {
  apiServer.listen(0, '127.0.0.1', () => resolve());
  apiServer.on('error', reject);
});
const apiPort = (apiServer.address() as AddressInfo).port;
const apiBase = `http://127.0.0.1:${apiPort}`;
const accessToken = jwt.default.sign(
  {
    sub: '00000000-0000-4000-8000-000000000001',
    email: 'analyze@vidorax.dev',
    role: 'USER',
    type: 'access',
  },
  process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
  { expiresIn: '5m' },
);

async function callAnalyze(
  body: unknown,
  auth = true,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${apiBase}/api/downloads/analyze`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(auth ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    json: (await response.json()) as Record<string, unknown>,
  };
}

try {
  process.env.MEDIA_ANALYSIS_ALLOW_LOOPBACK = '1';

  await test('API rejects unauthenticated analyze', async () => {
    const { status, json } = await callAnalyze(
      { url: 'https://example.com/a.mp4' },
      false,
    );
    assert(status === 401, `expected 401 got ${status}`);
    assert(json.success === false, 'success false');
  });

  await test('API rejects empty URL with validation envelope', async () => {
    const { status, json } = await callAnalyze({ url: '' });
    assert(status === 400, `expected 400 got ${status}`);
    assert(json.success === false, 'success false');
  });

  await test('API rejects javascript: scheme', async () => {
    const { status, json } = await callAnalyze({ url: 'javascript:alert(1)' });
    assert(status === 400, `expected 400 got ${status}`);
    assert(json.success === false, 'success false');
  });

  await test('API rejects unknown fields', async () => {
    const { status, json } = await callAnalyze({
      url: 'https://example.com/a.mp4',
      extra: true,
    });
    assert(status === 400, `expected 400 got ${status}`);
    assert(json.success === false, 'success false');
  });

  // Local mock for authenticated happy path
  const routeMock = await startMockServer();
  try {
    await test('API analyze returns envelope without creating download', async () => {
      const { status, json } = await callAnalyze({
        url: `${routeMock.baseUrl}/video.mp4`,
      });
      assert(status === 200, `expected 200 got ${status}`);
      assert(json.success === true, 'success true');
      const data = json.data as { analysis?: Record<string, unknown> };
      assert(data?.analysis?.downloadable === true, 'downloadable');
      assert(data?.analysis?.container === 'mp4', 'container');
      assert(data?.analysis?.mediaType === 'video', 'mediaType');
      // Must not look like a download record.
      assert(!('download' in (data ?? {})), 'no download key');
      assert(data?.analysis?.id === undefined, 'no download id');
    });
  } finally {
    await routeMock.close();
  }
} finally {
  await new Promise<void>((resolve, reject) => {
    apiServer.close((error) => (error ? reject(error) : resolve()));
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
