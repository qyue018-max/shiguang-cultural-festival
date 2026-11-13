(function (root) {
  'use strict';

  var runtimePromise = null;
  var scripts = [
    'vendor/three.min.js',
    'vendor/OrbitControls.js',
    'vendor/CopyShader.js',
    'vendor/LuminosityHighPassShader.js',
    'vendor/EffectComposer.js',
    'vendor/RenderPass.js',
    'vendor/ShaderPass.js',
    'vendor/UnrealBloomPass.js',
    'src/galaxy-runtime.js?v=mobile-lite-20261113'
  ];

  function loadScript(source) {
    var existing = document.querySelector('script[data-galaxy-source="' + source + '"]');
    if (existing && existing.dataset.loaded === 'true') return Promise.resolve();
    if (existing && existing.__loadPromise) return existing.__loadPromise;

    var script = existing || document.createElement('script');
    script.src = source;
    script.async = false;
    script.dataset.galaxySource = source;
    script.__loadPromise = new Promise(function (resolve, reject) {
      script.onload = function () { script.dataset.loaded = 'true'; resolve(); };
      script.onerror = function () { script.remove(); reject(new Error('无法加载 ' + source)); };
    });
    if (!existing) document.head.appendChild(script);
    return script.__loadPromise;
  }

  function load() {
    if (root.__shiguangGalaxyRuntimeReady && root.THREE && root.galaxyRoot && root.camera) return Promise.resolve();
    if (runtimePromise) return runtimePromise;
    root.__shiguangGalaxyRuntimeReady = false;
    runtimePromise = scripts.reduce(function (chain, source) {
      return chain.then(function () { return loadScript(source); });
    }, Promise.resolve()).then(function () {
      if (!root.__shiguangGalaxyRuntimeReady || !root.THREE || !root.galaxyRoot || !root.camera) {
        var runtimeScript = document.querySelector('script[data-galaxy-source^="src/galaxy-runtime.js"]');
        if (runtimeScript) runtimeScript.remove();
        throw new Error('3D 星河初始化失败');
      }
    }).catch(function (error) {
      runtimePromise = null;
      throw error;
    });
    return runtimePromise;
  }

  root.ShiguangGalaxyLoader = { load: load };
}(typeof globalThis !== 'undefined' ? globalThis : window));
