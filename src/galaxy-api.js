(function (root) {
  'use strict';

  function createGalaxyApi(options) {
    options = options || {};
    var fetchImpl = options.fetchImpl || (typeof root.fetch === 'function' ? root.fetch.bind(root) : null);
    var EventSourceImpl = Object.prototype.hasOwnProperty.call(options, 'EventSourceImpl') ? options.EventSourceImpl : root.EventSource;
    var baseUrl = options.baseUrl || '';

    function localResult(error, fallback) {
      return { ok: false, data: fallback, mode: 'local', error: error instanceof Error ? error.message : String(error || 'unavailable') };
    }

    async function request(path, init, readValue, fallback) {
      if (!fetchImpl) return localResult('fetch unavailable', fallback);
      try {
        var response = await fetchImpl(baseUrl + path, init);
        if (!response || !response.ok) throw new Error('HTTP ' + (response && response.status || 'error'));
        var payload = await response.json();
        var value = readValue(payload);
        if (value === undefined) throw new Error('invalid response');
        return { ok: true, data: value, mode: 'remote', error: null };
      } catch (error) {
        return localResult(error, fallback);
      }
    }

    return {
      listLights: function () {
        return request('/api/lights', { method: 'GET', headers: { Accept: 'application/json' } }, function (payload) {
          return payload && Array.isArray(payload.lights) ? payload.lights : undefined;
        }, []);
      },
      createLight: function (light) {
        return request('/api/lights', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(light) }, function (payload) {
          return payload && payload.light && typeof payload.light === 'object' ? payload.light : undefined;
        }, null);
      },
      subscribeLights: function (onLight, onStatus) {
        if (typeof EventSourceImpl !== 'function') {
          if (typeof onStatus === 'function') onStatus({ mode: 'local', connected: false });
          return function () {};
        }
        var source = new EventSourceImpl(baseUrl + '/api/lights/stream');
        source.addEventListener('open', function () { if (typeof onStatus === 'function') onStatus({ mode: 'remote', connected: true }); });
        source.addEventListener('error', function () { if (typeof onStatus === 'function') onStatus({ mode: 'local', connected: false }); });
        source.addEventListener('light', function (event) {
          try {
            var value = JSON.parse(event.data);
            if (value && typeof value === 'object' && typeof onLight === 'function') onLight(value);
          } catch (_) {}
        });
        return function () { source.close(); };
      }
    };
  }

  root.ShiguangGalaxyApi = { createGalaxyApi: createGalaxyApi };
}(typeof globalThis !== 'undefined' ? globalThis : window));
