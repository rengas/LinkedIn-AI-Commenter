/**
 * LinkedIn extension-probe blocker.
 *
 * Adapted from: https://github.com/mujtaba3B/linkedin-console-errors-chrome-temp-fix
 * Bundled here under the same MIT license as the original.
 *
 * Background:
 *   LinkedIn's site runs code that probes ~3000 known Chrome extension IDs by
 *   requesting `chrome-extension://<id>/<path>` via fetch / XHR / Image.src /
 *   sendBeacon. Each request that doesn't resolve produces a console error and
 *   leaks memory. Over time this slows the tab and floods DevTools.
 *
 * What this script does:
 *   Runs in the page's MAIN world at document_start (before LinkedIn's bundle
 *   loads) and replaces fetch / XHR / Image.src / sendBeacon with versions
 *   that short-circuit `chrome-extension://*` URLs to a fake 200 response.
 *   Everything else passes through unchanged.
 *
 *   Crucially, fetch is exposed via a getter/setter so that if LinkedIn later
 *   reassigns window.fetch to their own interceptor, our wrapping is reapplied
 *   on top of theirs.
 */

(function () {
  'use strict';

  var BLOCKED_URL_PREFIX = 'chrome-extension://';

  function getUrlFromFetchInput(input) {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    if (input && typeof input.url === 'string') return input.url;
    return '';
  }

  // ----- fetch -----
  var realFetch = window.fetch;

  function wrapFetch(fn) {
    return function (input, init) {
      var url = getUrlFromFetchInput(input);
      if (url && url.indexOf(BLOCKED_URL_PREFIX) === 0) {
        return Promise.resolve(new Response('', { status: 200 }));
      }
      return fn.apply(this, arguments);
    };
  }

  var _currentFetch = wrapFetch(realFetch);

  Object.defineProperty(window, 'fetch', {
    get: function () { return _currentFetch; },
    set: function (newFetch) { _currentFetch = wrapFetch(newFetch); },
    configurable: false
  });

  // ----- XMLHttpRequest -----
  var RealXHR = window.XMLHttpRequest;
  var realOpen = RealXHR.prototype.open;
  var realSend = RealXHR.prototype.send;

  RealXHR.prototype.open = function (method, url) {
    this._blockedByProbeFilter = (typeof url === 'string' && url.indexOf(BLOCKED_URL_PREFIX) === 0);
    if (this._blockedByProbeFilter) return;
    return realOpen.apply(this, arguments);
  };

  RealXHR.prototype.send = function () {
    if (this._blockedByProbeFilter) {
      Object.defineProperty(this, 'readyState', { value: 4, configurable: true });
      Object.defineProperty(this, 'status', { value: 200, configurable: true });
      Object.defineProperty(this, 'responseText', { value: '', configurable: true });
      this.dispatchEvent(new Event('readystatechange'));
      this.dispatchEvent(new Event('load'));
      return;
    }
    return realSend.apply(this, arguments);
  };

  // ----- Image.src -----
  // 1×1 transparent GIF — used as a no-op replacement for blocked URLs.
  var BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  var imgDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (imgDesc && imgDesc.set) {
    var nativeSetSrc = imgDesc.set;
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      set: function (val) {
        if (typeof val === 'string' && val.indexOf(BLOCKED_URL_PREFIX) === 0) {
          val = BLANK_IMG;
        }
        nativeSetSrc.call(this, val);
      },
      get: imgDesc.get,
      configurable: true,
      enumerable: true
    });
  }

  // ----- navigator.sendBeacon -----
  if (navigator.sendBeacon) {
    var realSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      if (typeof url === 'string' && url.indexOf(BLOCKED_URL_PREFIX) === 0) {
        return true;
      }
      return realSendBeacon(url, data);
    };
  }
})();
