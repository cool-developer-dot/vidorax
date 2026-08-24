/**
 * Week 7 Day 1 Phase 1 — fixture-based media intelligence verification.
 *
 * NO local HTTP servers. NO network. Parser / normalize / security only.
 *
 * Usage:
 *   npx tsx scripts/verify-media-intelligence.ts
 */

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
} = await import('../src/utils/url-security.js');

const {
  resolveExtension,
  resolveContainer,
  resolveMediaType,
  resolveMimeType,
} = await import('../src/services/media-analysis/media-format.js');

const {
  parseHlsManifest,
  parseAttributeList,
} = await import('../src/services/media-analysis/hls-parser.js');

const {
  splitAndNormalizeCodecs,
} = await import('../src/services/media-analysis/codecs.js');

const {
  buildQualityLabel,
  canonicalizeVariants,
  contentLengthToEstimatedSize,
  dedupeVariants,
  estimateHlsFileSizeBytes,
  finalizeVariant,
  sortVariants,
  normalizeUrlForDedupe,
} = await import('../src/services/media-analysis/variant-pipeline.js');

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

console.log('Week 7 Day 1 Phase 1 — media intelligence fixtures\n');

// --- Progressive mapping (static) ---
await test('progressive MP4 MIME/container mapping', () => {
  assert(resolveExtension('https://cdn.example.com/a.mp4', null) === 'mp4', 'ext');
  assert(resolveContainer('mp4') === 'mp4', 'container');
  assert(resolveMediaType('mp4', 'mp4') === 'video', 'type');
  assert(resolveMimeType('mp4', null) === 'video/mp4', 'mime');
  assert(resolveMimeType(null, 'video/mp4') === 'video/mp4', 'header mime');
});

await test('progressive Content-Length → estimated size; unknown → null', () => {
  assert(contentLengthToEstimatedSize('1048576') === 1048576, 'known');
  assert(contentLengthToEstimatedSize(null) === null, 'null');
  assert(contentLengthToEstimatedSize('abc') === null, 'malformed');
  assert(contentLengthToEstimatedSize('-1') === null, 'negative');
});

await test('progressive variant has no fabricated resolution/bitrate', () => {
  const variants = canonicalizeVariants([
    {
      sourceUrl: 'https://cdn.example.com/video.mp4?token=abc',
      streamType: 'PROGRESSIVE',
      container: 'mp4',
      mimeType: 'video/mp4',
      estimatedFileSize: 1048576,
      downloadable: true,
      originalIndex: 0,
    },
  ]);
  assert(variants.length === 1, 'one');
  assert(variants[0]?.width === null, 'no width');
  assert(variants[0]?.height === null, 'no height');
  assert(variants[0]?.bitrate === null, 'no bitrate');
  assert(variants[0]?.resolution === null, 'no resolution');
  assert(variants[0]?.label === 'Original Quality', 'label');
  assert(variants[0]?.estimatedFileSize === 1048576, 'size');
  assert(variants[0]?.sourceUrl.includes('token=abc'), 'query intact');
});

// --- HLS master parsing ---
const MASTER = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=800000,AVERAGE-BANDWIDTH=700000,RESOLUTION=640x360,CODECS="avc1.42e01e,mp4a.40.2",FRAME-RATE=24.000
360/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1400000,AVERAGE-BANDWIDTH=1200000,RESOLUTION=1280x720,CODECS="avc1.64001f,mp4a.40.2",FRAME-RATE=30
720/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,AVERAGE-BANDWIDTH=4500000,RESOLUTION=1920x1080,CODECS="hvc1.1.6.L93.B0,mp4a.40.2"
1080/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=15000000,RESOLUTION=3840x2160,CODECS="av01.0.08M.08,mp4a.40.2"
2160/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=480000,RESOLUTION=854x480,CODECS="vp09.00.10.08,mp4a.40.2"
480/playlist.m3u8
`;

await test('HLS master parses BANDWIDTH AVERAGE-BANDWIDTH RESOLUTION CODECS FRAME-RATE', () => {
  const parsed = parseHlsManifest(MASTER, 'https://cdn.example.com/video/master.m3u8');
  assert(parsed?.isMaster === true, 'master');
  assert(parsed?.variants.length === 5, 'five variants');
  const v720 = parsed?.variants.find((v) => v.height === 720);
  assert(v720?.bandwidth === 1400000, 'bandwidth');
  assert(v720?.averageBandwidth === 1200000, 'average');
  assert(v720?.width === 1280, 'width');
  assert(v720?.codecs?.includes('avc1.64001f') === true, 'codecs');
  assert(v720?.frameRate === 30, 'frame rate');
  assert(
    v720?.uri === 'https://cdn.example.com/video/720/playlist.m3u8',
    'relative resolved',
  );
});

await test('HLS absolute + root-relative + redirected base URL resolution', () => {
  const body = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1000,RESOLUTION=640x360
https://other-cdn.example.com/a.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2000,RESOLUTION=1280x720
/streams/720.m3u8
`;
  const parsed = parseHlsManifest(
    body,
    'https://cdn.example.com/redir/final/master.m3u8',
  );
  assert(
    parsed?.variants[0]?.uri === 'https://other-cdn.example.com/a.m3u8',
    'absolute',
  );
  assert(
    parsed?.variants[1]?.uri === 'https://cdn.example.com/streams/720.m3u8',
    'root-relative against redirected origin',
  );
});

await test('HLS quoted CODECS with commas + malformed optional resilience', () => {
  const attrs = parseAttributeList(
    'BANDWIDTH=4200000,AVERAGE-BANDWIDTH=3900000,RESOLUTION=1280x720,CODECS="avc1.64001f,mp4a.40.2",FRAME-RATE=bogus',
  );
  assert(attrs.CODECS === 'avc1.64001f,mp4a.40.2', 'quoted codecs');
  const parsed = parseHlsManifest(
    `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=4200000,RESOLUTION=not-a-res,CODECS="avc1.64001f,mp4a.40.2",FRAME-RATE=not-a-number
720/playlist.m3u8
`,
    'https://cdn.example.com/master.m3u8',
  );
  assert(parsed?.variants.length === 1, 'variant kept');
  assert(parsed?.variants[0]?.width === null, 'bad resolution ignored');
  assert(parsed?.variants[0]?.frameRate === null, 'bad fps ignored');
  assert(parsed?.variants[0]?.bandwidth === 4200000, 'bandwidth kept');
});

await test('UTF-8 BOM + CRLF tolerated', () => {
  const body = `\uFEFF#EXTM3U\r\n#EXT-X-STREAM-INF:BANDWIDTH=1000,RESOLUTION=640x360\r\nlow.m3u8\r\n`;
  const parsed = parseHlsManifest(body, 'https://cdn.example.com/master.m3u8');
  assert(parsed?.isMaster === true, 'master');
  assert(parsed?.variants.length === 1, 'variant');
});

// --- Direct HLS media playlist ---
await test('direct media playlist → one Original Quality HLS option', () => {
  const media = `#EXTM3U
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
seg0.ts
#EXTINF:10.0,
seg1.ts
#EXT-X-ENDLIST
`;
  const parsed = parseHlsManifest(media, 'https://cdn.example.com/media.m3u8');
  assert(parsed?.isMedia === true, 'media');
  assert(parsed?.isMaster === false, 'not master');
  assert(parsed?.variants.length === 0, 'no invented variants');
  assert(parsed?.durationSeconds === 20, 'duration from EXTINF');

  const variants = canonicalizeVariants([
    {
      sourceUrl: 'https://cdn.example.com/media.m3u8',
      streamType: 'HLS',
      container: 'hls',
      mimeType: 'application/vnd.apple.mpegurl',
      downloadable: true,
      originalIndex: 0,
    },
  ]);
  assert(variants.length === 1, 'one option');
  assert(variants[0]?.label === 'Original Quality', 'label');
  assert(variants[0]?.streamType === 'HLS', 'hls');
  assert(variants[0]?.height === null, 'no fake height');
  assert(variants[0]?.bitrate === null, 'no fake bitrate');
});

// --- Codecs ---
await test('codec normalization avc1/mp4a hvc1 hev1 vp09 av01 unknown', () => {
  const avc = splitAndNormalizeCodecs('avc1.64001f,mp4a.40.2');
  assert(avc.videoCodec === 'H.264', 'avc');
  assert(avc.audioCodec === 'AAC', 'aac');

  assert(splitAndNormalizeCodecs('hvc1.1.6.L93.B0').videoCodec === 'HEVC', 'hvc1');
  assert(splitAndNormalizeCodecs('hev1.1.6.L93.B0').videoCodec === 'HEVC', 'hev1');
  assert(splitAndNormalizeCodecs('vp09.00.10.08').videoCodec === 'VP9', 'vp09');
  assert(splitAndNormalizeCodecs('av01.0.08M.08').videoCodec === 'AV1', 'av01');

  const unknown = splitAndNormalizeCodecs('mystery.codec.1');
  assert(unknown.raw === 'mystery.codec.1', 'raw kept');
  assert(unknown.videoCodec === null, 'no fake video');
  assert(unknown.audioCodec === null, 'no fake audio');
});

// --- Size estimates ---
await test('HLS size estimate requires duration + bitrate', () => {
  assert(estimateHlsFileSizeBytes(8_000_000, 10) === 10_000_000, 'estimate');
  assert(estimateHlsFileSizeBytes(8_000_000, null) === null, 'no duration');
  assert(estimateHlsFileSizeBytes(null, 10) === null, 'no bitrate');
});

// --- Labels ---
await test('quality label policy is evidence-only', () => {
  assert(buildQualityLabel({ height: 1080, streamType: 'HLS' }) === '1080p', '1080');
  assert(buildQualityLabel({ height: 720, streamType: 'HLS' }) === '720p', '720');
  assert(
    buildQualityLabel({ bitrate: 4_000_000, streamType: 'HLS' }) ===
      'Original Quality',
    'bitrate only',
  );
  assert(
    buildQualityLabel({ streamType: 'PROGRESSIVE' }) === 'Original Quality',
    'unknown',
  );
});

// --- Ordering ---
await test('ordering uses numeric height not label strings', () => {
  const variants = canonicalizeVariants([
    {
      sourceUrl: 'https://cdn.example.com/480.m3u8',
      streamType: 'HLS',
      width: 854,
      height: 480,
      bitrate: 800000,
      container: 'hls',
      downloadable: true,
      originalIndex: 0,
    },
    {
      sourceUrl: 'https://cdn.example.com/2160.m3u8',
      streamType: 'HLS',
      width: 3840,
      height: 2160,
      bitrate: 15000000,
      container: 'hls',
      downloadable: true,
      originalIndex: 1,
    },
    {
      sourceUrl: 'https://cdn.example.com/720.m3u8',
      streamType: 'HLS',
      width: 1280,
      height: 720,
      bitrate: 1400000,
      container: 'hls',
      downloadable: true,
      originalIndex: 2,
    },
    {
      sourceUrl: 'https://cdn.example.com/1080.m3u8',
      streamType: 'HLS',
      width: 1920,
      height: 1080,
      bitrate: 5000000,
      container: 'hls',
      downloadable: true,
      originalIndex: 3,
    },
    {
      sourceUrl: 'https://cdn.example.com/unknown.m3u8',
      streamType: 'HLS',
      bitrate: 9000000,
      container: 'hls',
      downloadable: true,
      originalIndex: 4,
    },
  ]);

  assert(
    variants.map((v) => v.height).join(',') === '2160,1080,720,480,',
    `got ${variants.map((v) => v.height).join(',')}`,
  );
  assert(variants[variants.length - 1]?.height === null, 'unknown last among video');
});

await test('audio-only variants sort after video', () => {
  const variants = sortVariants([
    finalizeVariant({
      sourceUrl: 'https://cdn.example.com/audio.m4a',
      streamType: 'AUDIO',
      container: 'm4a',
      downloadable: true,
      originalIndex: 0,
    }),
    finalizeVariant({
      sourceUrl: 'https://cdn.example.com/720.m3u8',
      streamType: 'HLS',
      width: 1280,
      height: 720,
      bitrate: 1400000,
      container: 'hls',
      downloadable: true,
      originalIndex: 1,
    }),
  ]);
  assert(variants[0]?.height === 720, 'video first');
  assert(variants[1]?.streamType === 'AUDIO', 'audio second');
});

// --- Deduplication ---
await test('dedupe identical URL+metadata; keep distinct streams', () => {
  const a = finalizeVariant({
    sourceUrl: 'https://CDN.Example.com/720/playlist.m3u8',
    streamType: 'HLS',
    width: 1280,
    height: 720,
    bitrate: 1400000,
    container: 'hls',
    downloadable: true,
    originalIndex: 0,
  });
  const b = finalizeVariant({
    sourceUrl: 'https://cdn.example.com/720/playlist.m3u8',
    streamType: 'HLS',
    width: 1280,
    height: 720,
    bitrate: 1400000,
    container: 'hls',
    downloadable: true,
    originalIndex: 1,
  });
  const c = finalizeVariant({
    sourceUrl: 'https://cdn.example.com/720-alt/playlist.m3u8',
    streamType: 'HLS',
    width: 1280,
    height: 720,
    bitrate: 2000000,
    container: 'hls',
    downloadable: true,
    originalIndex: 2,
  });

  const deduped = dedupeVariants([a, b, c]);
  assert(deduped.length === 2, 'one duplicate removed');
  assert(
    normalizeUrlForDedupe('https://CDN.Example.com:443/x?sig=1') ===
      'https://cdn.example.com/x?sig=1',
    'dedupe url normalize preserves query',
  );
});

// --- Security regression (child variant policy uses same guards) ---
await test('security blocks private/loopback/metadata/.internal hosts', () => {
  assert(!isSafeAnalysisUrl('http://127.0.0.1/x.m3u8'), 'loopback');
  assert(!isSafeAnalysisUrl('http://localhost/x.m3u8'), 'localhost');
  assert(!isSafeAnalysisUrl('http://0.0.0.0/x.m3u8'), '0.0.0.0');
  assert(!isSafeAnalysisUrl('http://10.0.0.5/x.m3u8'), '10/8');
  assert(!isSafeAnalysisUrl('http://172.16.5.1/x.m3u8'), '172.16');
  assert(!isSafeAnalysisUrl('http://192.168.1.10/x.m3u8'), '192.168');
  assert(!isSafeAnalysisUrl('http://169.254.1.1/x.m3u8'), 'link-local');
  assert(!isSafeAnalysisUrl('http://[::1]/x.m3u8'), 'ipv6 loopback');
  assert(!isSafeAnalysisUrl('http://metadata.google.internal/'), 'metadata');
  assert(!isSafeAnalysisUrl('http://foo.internal/x.m3u8'), '.internal');
  assert(isSafeAnalysisUrl('https://cdn.example.com/720.m3u8'), 'public ok');
  assert(isPrivateOrLocalHostname('127.0.0.1'), 'private helper');
  assert(
    !isPrivateOrLocalHostname('127.0.0.1', { allowLoopback: true }),
    'dev loopback flag',
  );
});

await test('unsafe child variant URLs are excluded before canonicalize', () => {
  const master = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1000,RESOLUTION=640x360
http://127.0.0.1/private.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2000,RESOLUTION=1280x720
https://cdn.example.com/safe.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3000,RESOLUTION=1920x1080
http://169.254.169.254/latest/meta-data
#EXT-X-STREAM-INF:BANDWIDTH=4000,RESOLUTION=854x480
http://metadata.google.internal/
#EXT-X-STREAM-INF:BANDWIDTH=5000,RESOLUTION=640x360
http://app.internal/stream.m3u8
`;
  const parsed = parseHlsManifest(master, 'https://cdn.example.com/master.m3u8');
  assert(parsed?.variants.length === 5, 'parser keeps raw URIs');

  const drafts = (parsed?.variants ?? [])
    .filter((variant) => isSafeAnalysisUrl(variant.uri))
    .map((variant, index) => ({
      sourceUrl: variant.uri,
      streamType: 'HLS' as const,
      width: variant.width,
      height: variant.height,
      bitrate: variant.bandwidth,
      container: 'hls' as const,
      downloadable: true,
      originalIndex: index,
    }));

  const variants = canonicalizeVariants(drafts);
  assert(variants.length === 1, 'only public child accepted');
  assert(variants[0]?.sourceUrl === 'https://cdn.example.com/safe.m3u8', 'safe url');
});

await test('HLS parser: AVERAGE-BANDWIDTH + FRAME-RATE + METHOD=NONE', () => {
  const parsed = parseHlsManifest(
    `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=5500000,AVERAGE-BANDWIDTH=4200000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2",FRAME-RATE=60
high.m3u8
`,
    'https://cdn.example.com/master.m3u8',
  );
  assert(parsed?.isMaster === true, 'master');
  assert(parsed?.isEncrypted === false, 'not encrypted');
  assert(parsed?.isDrm === false, 'not drm');
  assert(parsed?.variants[0]?.averageBandwidth === 4_200_000, 'avg');
  assert(parsed?.variants[0]?.frameRate === 60, 'fps');

  const none = parseHlsManifest(
    `#EXTM3U
#EXT-X-TARGETDURATION:4
#EXT-X-KEY:METHOD=NONE
#EXTINF:4.0,
a.ts
#EXT-X-ENDLIST
`,
    'https://cdn.example.com/none.m3u8',
  );
  assert(none?.isEncrypted === false, 'METHOD=NONE not encrypted');
  assert(none?.isMedia === true, 'media');
});

await test('HLS parser: SAMPLE-AES DRM, live, byterange', () => {
  const drm = parseHlsManifest(
    `#EXTM3U
#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://x",KEYFORMAT="com.apple.streamingkeydelivery"
#EXT-X-TARGETDURATION:4
#EXTINF:4.0,
a.ts
#EXT-X-ENDLIST
`,
    'https://cdn.example.com/drm.m3u8',
  );
  assert(drm?.isDrm === true, 'drm');
  assert(drm?.isEncrypted === false, 'drm is not generic AES flag');

  const live = parseHlsManifest(
    `#EXTM3U
#EXT-X-TARGETDURATION:4
#EXTINF:4.0,
a.ts
`,
    'https://cdn.example.com/live.m3u8',
  );
  assert(live?.isLive === true, 'live');

  const ranged = parseHlsManifest(
    `#EXTM3U
#EXT-X-TARGETDURATION:4
#EXTINF:4.0,
#EXT-X-BYTERANGE:1000@0
a.ts
#EXT-X-ENDLIST
`,
    'https://cdn.example.com/br.m3u8',
  );
  assert(ranged?.hasByteRange === true, 'byterange');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
