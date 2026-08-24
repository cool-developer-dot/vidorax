/**
 * Injected page observer — read-only DOM / Performance observation.
 *
 * Security constraints:
 * - Fixed script string only (never built from page content)
 * - Posts structured JSON to ReactNativeWebView
 * - Does not touch cookies, storage, or auth tokens
 * - Does not execute arbitrary page-provided code
 */
import { DETECTION_TIMING } from '../constants';
import { MEDIA_BRIDGE_CHANNEL } from '../types';

const VIDEO_EXTS = 'mp4|webm|mov|m4v';
const AUDIO_EXTS = 'mp3|m4a|aac|ogg';
const STREAM_EXTS = 'm3u8';

/**
 * Build the injectable observer script.
 * Appended with `true;` so react-native-webview treats it as successful.
 */
export function buildMediaDetectionInjectedScript(): string {
  const batchMs = DETECTION_TIMING.mutationBatchMs;
  const maxBatch = DETECTION_TIMING.maxCandidatesPerBatch;
  const perfMs = DETECTION_TIMING.performancePollMs;

  return `(function(){
  if (window.__VIDORAX_MEDIA_DETECTION__) { return true; }
  window.__VIDORAX_MEDIA_DETECTION__ = true;

  var CHANNEL = ${JSON.stringify(MEDIA_BRIDGE_CHANNEL)};
  var EXT_RE = /\\.(${VIDEO_EXTS}|${AUDIO_EXTS}|${STREAM_EXTS})(?:[?#]|$)/i;
  var MIME_HINTS = /^(video\\/|audio\\/|application\\/(vnd\\.apple\\.mpegurl|x-mpegurl))/i;
  var pending = [];
  var seen = Object.create(null);
  var batchTimer = null;
  var pageUrl = location.href;

  function post(type, payload) {
    try {
      if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) {
        return;
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({
        channel: CHANNEL,
        type: type,
        payload: payload,
        ts: Date.now()
      }));
    } catch (e) {}
  }

  function safeUrl(u) {
    if (!u || typeof u !== 'string') return null;
    var t = u.trim();
    if (!t) return null;
    var lower = t.toLowerCase();
    if (lower.indexOf('javascript:') === 0 || lower.indexOf('blob:') === 0 ||
        lower.indexOf('file:') === 0 || lower.indexOf('data:') === 0) {
      return null;
    }
    try {
      var abs = new URL(t, pageUrl).href;
      if (abs.indexOf('http://') !== 0 && abs.indexOf('https://') !== 0) return null;
      return abs;
    } catch (e) { return null; }
  }

  function extOf(u) {
    try {
      var path = new URL(u).pathname;
      var m = path.match(/\\.([a-z0-9]+)$/i);
      return m ? m[1].toLowerCase() : null;
    } catch (e) { return null; }
  }

  function looksMedia(u, mime) {
    if (mime && MIME_HINTS.test(mime)) return true;
    return EXT_RE.test(u);
  }

  function enqueue(candidate) {
    if (!candidate || !candidate.url) return;
    var key = candidate.url + '|' + (candidate.mimeType || '');
    if (seen[key]) return;
    seen[key] = 1;
    pending.push(candidate);
    if (pending.length > ${maxBatch}) {
      flush();
      return;
    }
    if (batchTimer) return;
    batchTimer = setTimeout(flush, ${batchMs});
  }

  function flush() {
    if (batchTimer) { clearTimeout(batchTimer); batchTimer = null; }
    if (!pending.length) return;
    var batch = pending.slice(0, ${maxBatch});
    pending = [];
    post('mutation_batch', { candidates: batch, pageUrl: pageUrl });
  }

  function readMeta() {
    function meta(sel, attr) {
      var el = document.querySelector(sel);
      if (!el) return null;
      var v = attr ? el.getAttribute(attr) : (el.textContent || '');
      return v && String(v).trim() ? String(v).trim() : null;
    }
    post('page_meta', {
      pageUrl: pageUrl,
      title: document.title || null,
      description: meta('meta[name="description"]', 'content'),
      ogImage: meta('meta[property="og:image"]', 'content'),
      ogVideo: meta('meta[property="og:video"]', 'content') ||
               meta('meta[property="og:video:url"]', 'content'),
      canonicalUrl: meta('link[rel="canonical"]', 'href')
    });
    var ogVideo = meta('meta[property="og:video"]', 'content') ||
                  meta('meta[property="og:video:url"]', 'content');
    var ogAbs = safeUrl(ogVideo);
    if (ogAbs && looksMedia(ogAbs, null)) {
      enqueue({
        url: ogAbs,
        pageUrl: pageUrl,
        mimeType: null,
        extension: extOf(ogAbs),
        title: document.title || null,
        thumbnailUrl: safeUrl(meta('meta[property="og:image"]', 'content')),
        duration: null,
        width: null,
        height: null,
        estimatedFileSize: null,
        isLive: false,
        isDrm: false,
        playlistType: null,
        detectionSource: 'og_meta',
        tagName: 'meta'
      });
    }
  }

  function mediaFromElement(el, source) {
    if (!el) return;
    var tag = (el.tagName || '').toLowerCase();
    var url = safeUrl(el.currentSrc || el.src || el.getAttribute('src'));
    var mime = el.getAttribute('type') || null;
    if (!url) return;
    if (!looksMedia(url, mime)) return;

    var width = null;
    var height = null;
    var duration = null;
    try {
      if (typeof el.videoWidth === 'number' && el.videoWidth > 0) width = el.videoWidth;
      if (typeof el.videoHeight === 'number' && el.videoHeight > 0) height = el.videoHeight;
      if (typeof el.duration === 'number' && isFinite(el.duration) && el.duration > 0) {
        duration = el.duration;
      }
    } catch (e) {}

    var drm = false;
    try {
      drm = !!(el.mediaKeys || (window.navigator && navigator.requestMediaKeySystemAccess && el.hasAttribute('encrypted')));
    } catch (e) {}

    enqueue({
      url: url,
      pageUrl: pageUrl,
      mimeType: mime,
      extension: extOf(url),
      title: document.title || null,
      thumbnailUrl: safeUrl(el.getAttribute('poster')),
      duration: duration,
      width: width,
      height: height,
      estimatedFileSize: null,
      isLive: false,
      isDrm: drm,
      playlistType: null,
      detectionSource: source,
      tagName: tag
    });
  }

  function scanDom() {
    pageUrl = location.href;
    var videos = document.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      mediaFromElement(videos[i], 'dom_video');
      var sources = videos[i].querySelectorAll('source');
      for (var s = 0; s < sources.length; s++) {
        mediaFromElement(sources[s], 'dom_source');
      }
    }
    var audios = document.querySelectorAll('audio');
    for (var a = 0; a < audios.length; a++) {
      mediaFromElement(audios[a], 'dom_audio');
      var aSources = audios[a].querySelectorAll('source');
      for (var as = 0; as < aSources.length; as++) {
        mediaFromElement(aSources[as], 'dom_source');
      }
    }
  }

  function observePerfEntry(e) {
    try {
      var name = e && e.name ? String(e.name) : '';
      var abs = safeUrl(name);
      if (!abs || !looksMedia(abs, null)) return;
      enqueue({
        url: abs,
        pageUrl: pageUrl,
        mimeType: null,
        extension: extOf(abs),
        title: document.title || null,
        thumbnailUrl: null,
        duration: null,
        width: null,
        height: null,
        estimatedFileSize: typeof e.transferSize === 'number' && e.transferSize > 0 ? e.transferSize : null,
        isLive: false,
        isDrm: false,
        playlistType: null,
        detectionSource: 'performance_resource',
        tagName: null
      });
    } catch (err) {}
  }

  var scanTimer = null;
  function scheduleScanDom() {
    if (scanTimer) return;
    scanTimer = setTimeout(function() {
      scanTimer = null;
      scanDom();
    }, ${batchMs});
  }

  var mo = null;
  var po = null;
  var perfInterval = null;
  var lastPerfIndex = 0;

  try {
    mo = new MutationObserver(function() {
      scheduleScanDom();
    });
    mo.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'type', 'poster']
    });
  } catch (e) {}

  try {
    if (window.PerformanceObserver) {
      po = new PerformanceObserver(function(list) {
        var entries = list.getEntries();
        for (var i = 0; i < entries.length; i++) {
          observePerfEntry(entries[i]);
        }
      });
      po.observe({ entryTypes: ['resource'] });
    }
  } catch (e) {}

  function onLoadedMetadata(ev) {
    var t = ev.target;
    if (!t) return;
    var tag = (t.tagName || '').toLowerCase();
    if (tag === 'video') mediaFromElement(t, 'dom_video');
    if (tag === 'audio') mediaFromElement(t, 'dom_audio');
  }
  document.addEventListener('loadedmetadata', onLoadedMetadata, true);

  function onPopState() {
    pageUrl = location.href;
    seen = Object.create(null);
    readMeta();
    scheduleScanDom();
  }

  try {
    var _push = history.pushState;
    var _replace = history.replaceState;
    history.pushState = function() {
      var r = _push.apply(this, arguments);
      pageUrl = location.href;
      seen = Object.create(null);
      readMeta();
      scheduleScanDom();
      return r;
    };
    history.replaceState = function() {
      var r = _replace.apply(this, arguments);
      pageUrl = location.href;
      scheduleScanDom();
      return r;
    };
    window.addEventListener('popstate', onPopState);
  } catch (e) {}

  function cleanup() {
    try {
      if (batchTimer) { clearTimeout(batchTimer); batchTimer = null; }
      if (scanTimer) { clearTimeout(scanTimer); scanTimer = null; }
      if (perfInterval) { clearInterval(perfInterval); perfInterval = null; }
      if (mo) { mo.disconnect(); mo = null; }
      if (po) { po.disconnect(); po = null; }
      document.removeEventListener('loadedmetadata', onLoadedMetadata, true);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('pagehide', cleanup);
    } catch (e) {}
  }
  window.addEventListener('pagehide', cleanup);

  // Drain any early resources captured before content script, then clear.
  try {
    var early = window.__VIDORAX_MEDIA_EARLY_RESOURCES__;
    if (early && early.length) {
      for (var ei = 0; ei < early.length; ei++) {
        var earlyAbs = safeUrl(String(early[ei]));
        if (earlyAbs && looksMedia(earlyAbs, null)) {
          enqueue({
            url: earlyAbs,
            pageUrl: pageUrl,
            mimeType: null,
            extension: extOf(earlyAbs),
            title: document.title || null,
            thumbnailUrl: null,
            duration: null,
            width: null,
            height: null,
            estimatedFileSize: null,
            isLive: false,
            isDrm: false,
            playlistType: null,
            detectionSource: 'performance_resource',
            tagName: null
          });
        }
      }
      window.__VIDORAX_MEDIA_EARLY_RESOURCES__ = [];
    }
  } catch (e) {}

  // Stop early PerformanceObserver — main observer owns resource watching now.
  try {
    if (window.__VIDORAX_MEDIA_EARLY_PO__) {
      window.__VIDORAX_MEDIA_EARLY_PO__.disconnect();
      window.__VIDORAX_MEDIA_EARLY_PO__ = null;
    }
  } catch (e) {}

  readMeta();
  scanDom();

  // Lightweight incremental poll — only new performance entries (fallback if PO missing).
  try {
    if (!window.PerformanceObserver && window.performance && performance.getEntriesByType) {
      perfInterval = setInterval(function() {
        try {
          var entries = performance.getEntriesByType('resource');
          for (var i = lastPerfIndex; i < entries.length; i++) {
            observePerfEntry(entries[i]);
          }
          lastPerfIndex = entries.length;
        } catch (err) {}
      }, ${perfMs});
    }
  } catch (e) {}

  post('ready', {});
  post('scan_complete', {});
  return true;
})();true;`;
}

/** Lightweight early resource capture — drained by the main observer after load. */
export function buildMediaDetectionBeforeContentScript(): string {
  return `(function(){
  try {
    if (window.__VIDORAX_MEDIA_EARLY__) return true;
    window.__VIDORAX_MEDIA_EARLY__ = true;
    window.__VIDORAX_MEDIA_EARLY_RESOURCES__ = [];
    if (window.PerformanceObserver) {
      var po = new PerformanceObserver(function(list) {
        var entries = list.getEntries();
        for (var i = 0; i < entries.length; i++) {
          window.__VIDORAX_MEDIA_EARLY_RESOURCES__.push(String(entries[i].name));
          if (window.__VIDORAX_MEDIA_EARLY_RESOURCES__.length > 200) {
            window.__VIDORAX_MEDIA_EARLY_RESOURCES__.shift();
          }
        }
      });
      po.observe({ entryTypes: ['resource'] });
      window.__VIDORAX_MEDIA_EARLY_PO__ = po;
      window.addEventListener('pagehide', function() {
        try {
          po.disconnect();
          window.__VIDORAX_MEDIA_EARLY_PO__ = null;
        } catch (e) {}
      }, { once: true });
    }
  } catch (e) {}
  return true;
})();true;`;
}
