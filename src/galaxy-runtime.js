Warning: truncated output (original token count: 150469)
Total output lines: 5546

  // Video capture is an opt-in runtime. Keep this bootstrap before every
  // procedural scene allocation so a capture never observes unseeded geometry.
  var videoParams = new URLSearchParams(location.search);
  // ?video=1 is for the local capture rig only — on a public host it is ignored (the capture runtime is not part of this repo; it is injected only at render time)
  var videoMode = videoParams.get('video') === '1' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  function videoParamInt(name, fallback, max) {
    var value = Number(videoParams.get(name));
    return Number.isSafeInteger(value) && value > 0 && value <= max ? value : fallback;
  }
  var videoConfig = Object.freeze({
    enabled: videoMode,
    seed: videoParamInt('seed', 20260723, 4294967295),
    width: videoParamInt('width', 1920, 7680),
    height: videoParamInt('height', 1080, 7680),
    fps: videoParamInt('fps', 30, 240),
    quality: videoParams.get('quality') || 'final'
  });
  var videoRandomCalls = 0, videoRandomHash = 2166136261;
  function mulberry32(seed) {
    var state = seed >>> 0;
    return function () {
      state += 0x6d2b79f5;
      var value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      value = ((value ^ value >>> 14) >>> 0) / 4294967296;
      videoRandomCalls++;
      videoRandomHash = Math.imul(videoRandomHash ^ Math.floor(value * 4294967296), 16777619) >>> 0;
      return value;
    };
  }
  function resetVideoRandom() {
    videoRandomCalls = 0;
    videoRandomHash = 2166136261;
    Math.random = mulberry32(videoConfig.seed);
  }
  if (videoMode) resetVideoRandom();
  var videoClockMs = 0, videoFrameStepMs = 1000 / videoConfig.fps;
  function videoNow() { return videoMode ? videoClockMs : performance.now(); }

  // ── tunables (tweak to taste, then reload) ──────────────────────────────────
  // BLOOM: gentle selective glow (threshold 0.42 → only bright knots/core glow).
  //        strength 0 = off, ~0.05 subtle, ~0.12 strong.
  // DUST:  ~30k stars on `arms` density-wave arms (the painted disc carries the look).
  //        `radius` = disc size, `tight` = winding, `brightness` = overall level.
  // GALAXY_SPIN: radians/sec the whole galaxy rotates about its axis.
  var BLOOM = { strength: 0.08, radius: 0.32, threshold: 0.42 };
  var TONE = { exposure: 1.1 };
  var DUST = { count: 30000, min: 1500, radius: 360, arms: 4, minorDim: 0.42, tight: 0.85, armWidth: 46, randomness: 0.5, thickness: 24, radPow: 0.72, size: 4.0, brightness: 0.5, inside: 0xffcf8a, outside: 0x86acec, hii: 0xff5fa8, blueStar: 0xcfe6ff };
  var GALAXY_SPIN = 0.013;

  function setMsg(t) { var el = document.getElementById('msg'); if (el) el.textContent = t || ''; }
  function setOn(el, on) { // visible + announced toggle state; the pause button is not a toggle (its label flips Pause/Play)
    el.classList.toggle('on', on); if (el.dataset.scale !== '0') el.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function keyActivate(el) { // a clickable div becomes a keyboard button: Tab reaches it, Enter/Space click it
    el.tabIndex = 0; el.setAttribute('role', 'button');
    el.addEventListener('mousedown', function (e) { e.preventDefault(); }); // pointer clicks still click, they just don't take focus
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); openedCardFrom(el); } });
  }
  var cardOpener = null;
  function noteCardOpener() { var a = document.activeElement, panel = document.getElementById('beacon-panel'); if (a && panel && !panel.contains(a)) cardOpener = a; }
  function openedCardFrom(el) { // a keyboard-opened card takes focus (its close button) and remembers who opened it
    var panel = document.getElementById('beacon-panel'), close = document.getElementById('bp-close');
    if (panel && panel.classList.contains('open') && close) { cardOpener = el; close.focus({ preventScroll: true }); }
  }
  function returnCardFocus() { // closing a card the keyboard was in returns focus to its opener
    var o = cardOpener, panel = document.getElementById('beacon-panel'); cardOpener = null;
    if (o && panel && panel.contains(document.activeElement) && o.isConnected && o.offsetParent !== null) o.focus({ preventScroll: true });
  }
  function cardFocusId() { var a = document.activeElement, panel = document.getElementById('beacon-panel'); return a && a.id && panel && panel.contains(a) ? a.id : null; }
  function restoreCardFocus(id) { if (id) { var el = document.getElementById(id); if (el) el.focus({ preventScroll: true }); } } // re-rendered card keeps the focused control

  // ── renderer / scene / bloom ────────────────────────────────────────────────
  var cv = document.getElementById('cv');
  function shiguangViewportSize() {
    var shell = document.getElementById('shiguang-phone-shell');
    return shell ? { width: shell.clientWidth || window.innerWidth, height: shell.clientHeight || window.innerHeight } : { width: window.innerWidth, height: window.innerHeight };
  }
  var shiguangViewport = shiguangViewportSize();
  var outputWidth = videoMode ? videoConfig.width : shiguangViewport.width;
  var outputHeight = videoMode ? videoConfig.height : shiguangViewport.height;
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false }); // frames go through the composers' render targets; an MSAA backbuffer only cost memory
  } catch (glError) { // WebGL off or unavailable: explain, then stop (nothing below can run without it)
    var noGlLang = 'hans'; try { noGlLang = localStorage.getItem('gx-lang') || 'hans'; } catch (e) {}
    setMsg({ en: 'Galaxy Explorer needs WebGL, which is turned off or unavailable in this browser.', hans: '本页面需要 WebGL,但当前浏览器未启用或不支持。',
      hant: '本頁面需要 WebGL,但目前的瀏覽器未啟用或不支援。', ja: 'このページには WebGL が必要ですが、このブラウザーでは無効か利用できません。',
      ko: '이 페이지에는 WebGL이 필요하지만 현재 브라우저에서 꺼져 있거나 지원되지 않습니다.' }[noGlLang] || 'Galaxy Explorer needs WebGL, which is turned off or unavailable in this browser.');
    throw glError;
  }
  var glLostTimer = null, GL_LOST = {
    en: ['Graphics were interrupted — restoring…', 'Graphics were interrupted — please reload the page.'],
    hans: ['图形渲染中断 —— 正在恢复…', '图形渲染中断 —— 请刷新页面。'], hant: ['圖形渲染中斷 —— 正在恢復…', '圖形渲染中斷 —— 請重新整理頁面。'],
    ja: ['グラフィックスが中断されました — 復旧中…', 'グラフィックスが中断されました — ページを再読み込みしてください。'],
    ko: ['그래픽이 중단되었습니다 — 복구하는 중…', '그래픽이 중단되었습니다 — 페이지를 새로 고쳐 주세요.']
  };
  cv.addEventListener('webglcontextlost', function (e) { // F086: GPU reset / tab eviction — let the browser restore it, and say what is happening
    e.preventDefault();
    var m = GL_LOST[typeof beaconLang === 'string' ? beaconLang : 'en'] || GL_LOST.en; setMsg(m[0]);
    clearTimeout(glLostTimer); glLostTimer = setTimeout(function () { setMsg(m[1]); }, 4000);
  });
  cv.addEventListener('webglcontextrestored', function () { clearTimeout(glLostTimer); setMsg(''); }); // three re-uploads textures/buffers on the next frame; render-target bakes redo themselves (bakeNebula)
  renderer.setPixelRatio(videoMode ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(outputWidth, outputHeight);
  renderer.toneMapping = THREE.NoToneMapping; // tone-mapped AFTER bloom via a final ACES pass instead
  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x03040a, 0.0012);
  // everything that co-rotates (dust + painted disc + effects) lives under this group
  var galaxyRoot = new THREE.Group(); scene.add(galaxyRoot);
  var camera = new THREE.PerspectiveCamera(55, outputWidth / outputHeight, 0.5, 5000);
  camera.position.set(0, 529, 715); // elevated 3/4 view (el ≈ 36.5°, d ≈ 890), pulled back so the disc, the Magellanic Clouds and Triangulum all frame on load
  var controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxDistance = 1600; controls.minDistance = 5;

  // ── independent solar scene shell (bodies are added in the next task) ────────
  var solarScene = new THREE.Scene();
  var solarRoot = new THREE.Group(); solarScene.add(solarRoot);
  var solarBackdrop = null;
  var solarCamera = new THREE.PerspectiveCamera(52, outputWidth / outputHeight, 0.05, 1800);
  solarCamera.position.set(0, 105, 180);
  var solarControls = new THREE.OrbitControls(solarCamera, renderer.domElement);
  solarControls.enabled = false;
  solarControls.enableDamping = true;
  solarControls.dampingFactor = 0.08;
  solarControls.minDistance = 2;
  solarControls.maxDistance = 420;
  var GLOW_TEX = glowTexture(); // created before its first users below (backdrop band, Kuiper belt, comets)
  var solarKuiper = null; // kept addressable so the true-scale view can fade it (its positions are baked compressed)
  (function buildSolarBackdrop() {
    var N = 1400, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), phs = new Float32Array(N), spd = new Float32Array(N), c = new THREE.Color();
    for (var i = 0; i < N; i++) {
      var th = Math.random() * Math.PI * 2, y = Math.random() * 2 - 1, r = Math.sqrt(1 - y * y) * (520 + Math.random() * 280);
      pos[i * 3] = Math.cos(th) * r; pos[i * 3 + 1] = y * (520 + Math.random() * 280); pos[i * 3 + 2] = Math.sin(th) * r;
      var b = 0.28 + Math.random() * 0.48;
      if (Math.random() < 0.16) c.setRGB(b, b * 0.82, b * 0.62); else c.setRGB(b * 0.78, b * 0.88, b);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      phs[i] = Math.random() * 6.28318; spd[i] = 0.5 + Math.random() * 1.4;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phs, 1));
    g.setAttribute('aSpd', new THREE.BufferAttribute(spd, 1));
    // twinkling shader — same recipe as the sky view: breathing shimmer + a rare scintillation flash
    var twinkle = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uSize: { value: 2.4 * renderer.getPixelRatio() } },
      vertexShader: 'uniform float uTime; uniform float uSize; attribute vec3 aColor; attribute float aPhase; attribute float aSpd; varying vec3 vColor;' +
        'void main(){ vec4 vp = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * vp;' +
        ' float tw = 0.6 + 0.4 * sin(uTime * aSpd + aPhase);' +
        ' float flare = pow(max(0.0, sin(uTime * (0.25 + aSpd * 0.2) + aPhase * 2.3)), 24.0);' +
        ' float br = tw + flare;' +
        ' gl_PointSize = uSize * (0.7 + 0.6 * br); vColor = aColor * br; }',
      fragmentShader: 'varying vec3 vColor; void main(){ float d = distance(gl_PointCoord, vec2(0.5)); if (d > 0.5) discard; float s = pow(max(0.0, 1.0 - d * 2.0), 1.4); gl_FragColor = vec4(vColor, s * 0.85); }',
      transparent: true, depthWrite: false
    });
    solarBackdrop = new THREE.Points(g, twinkle);
    solarScene.add(solarBackdrop);
    // the Milky Way as a soft band across the backdrop, tilted ~60° like the real
    // galactic plane against the ecliptic
    var bandPole = new THREE.Vector3(0, Math.cos(60.2 * Math.PI / 180), Math.sin(60.2 * Math.PI / 180)).normalize();
    var bandU = new THREE.Vector3(1, 0, 0), bandV = new THREE.Vector3().crossVectors(bandPole, bandU).normalize();
    function bandGauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }
    var M = 1600, mp = new Float32Array(M * 3), mc = new Float32Array(M * 3);
    for (var mi = 0; mi < M; mi++) {
      var phi = Math.random() * 6.28318, lat = bandGauss() * 0.12;
      var d3 = bandU.clone().multiplyScalar(Math.cos(phi)).addScaledVector(bandV, Math.sin(phi)).addScaledVector(bandPole, lat).normalize();
      var br2 = 640 + Math.random() * 140;
      mp[mi * 3] = d3.x * br2; mp[mi * 3 + 1] = d3.y * br2; mp[mi * 3 + 2] = d3.z * br2;
      var mb = 0.09 + Math.random() * 0.2;
      mc[mi * 3] = mb; mc[mi * 3 + 1] = mb; mc[mi * 3 + 2] = mb * 1.12;
    }
    var mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    mg.setAttribute('color', new THREE.BufferAttribute(mc, 3));
    solarScene.add(new THREE.Points(mg, new THREE.PointsMaterial({ size: 7, map: GLOW_TEX, vertexColors: true, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true })));
    // Kuiper belt: a sparse, thick scattered disc beyond Neptune — Pluto's neighborhood
    var K = 900, kp = new Float32Array(K * 3), kInner = solarOrbitRadius(30), kOuter = solarOrbitRadius(50);
    for (var ki = 0; ki < K; ki++) {
      var kAng = Math.random() * 6.28318, kR = kInner + (kOuter - kInner) * Math.pow(Math.random(), 0.8);
      kp[ki * 3] = Math.cos(kAng) * kR; kp[ki * 3 + 1] = bandGauss() * 9; kp[ki * 3 + 2] = Math.sin(kAng) * kR;
    }
    var kg = new THREE.BufferGeometry();
    kg.setAttribute('position', new THREE.BufferAttribute(kp, 3));
    solarKuiper = new THREE.Points(kg, new THREE.PointsMaterial({ color: 0x8d8a94, size: 0.9, map: GLOW_TEX, transparent: true, opacity: 0.22, depthWrite: false, sizeAttenuation: true }));
    solarScene.add(solarKuiper);
  })();
  // ── comets: nucleus + coma, a straight blue ION tail pinned anti-sunward, and a curved
  // pale DUST tail whose grains keep their own Keplerian paths while radiation pressure
  // pushes them out — per Jewitt & the standard comet-tail model ──
  var solarComets = [];
  (function buildSolarComets() {
    var ION_N = 90, DUST_N = 150, state = 4242;
    function crnd() { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; }
    [ { q: 16, Q: 150, incl: 0.31, phase: 1.2, rate: 0.014 } ].forEach(function (spec, cometIndex) {
      var a = (spec.q + spec.Q) / 2, e = (spec.Q - spec.q) / (spec.Q + spec.q), b = a * Math.sqrt(1 - e * e);
      var group = new THREE.Group(); group.rotation.x = spec.incl; solarRoot.add(group);
      var coma = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xbcd8cf, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      var core = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      group.add(coma); group.add(core);
      var ions = [], dust = [];
      for (var i = 0; i < ION_N; i++) ions.push({ frac: (i + 0.5) / ION_N, lat1: (crnd() - 0.5), lat2: (crnd() - 0.5), speed: 0.6 + crnd() * 0.9 });
      for (var j = 0; j < DUST_N; j++) { var kdv = (Math.floor(j / 6) + 0.5) / (DUST_N / 6) + (crnd() - 0.5) * 0.03; dust.push({ stria: j % 6, kd: kdv, back: kdv * kdv * 0.22, jag: (crnd() - 0.5), glint: crnd() * 6.28 }); }
      var N = ION_N + DUST_N, tp = new Float32Array(N * 3), tc = new Float32Array(N * 3);
      var tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.BufferAttribute(tp, 3));
      tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
      var tails = new THREE.Points(tg, new THREE.PointsMaterial({ map: GLOW_TEX, size: 2.3, vertexColors: true, transparent: true, opacity: 0.62, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
      tails.frustumCulled = false; group.add(tails);
      // the nucleus is a lumpy sunlit rock — a comet head is a dirty snowball, not a point of light
      var nucleus = new THREE.Mesh(makeAsteroidGeometries(crnd)[1], new THREE.MeshLambertMaterial({ color: 0x9a938a }));
      nucleus.scale.set(0.62, 0.46, 0.54); group.add(nucleus);
      var hitProxy = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hitProxy.scale.setScalar(5); hitProxy.userData.solarComet = cometIndex; group.add(hitProxy);
      solarComets.push({ a: a, b: b, e: e, angle: spec.phase, initialAngle: spec.phase, rate: spec.rate, q: spec.q, group: group, coma: coma, core: core, nucleus: nucleus,
        hitProxy: hitProxy, tails: tails, positions: tp, colors: tc, ions: ions, dust: dust, index: cometIndex });
    });
  })();
  var COMET_INFO = [
    { img: 'images/comet-halley.jpg', credit: "NASA/W. Liller — Halley's Comet, 1986",
      name: { en: "Halley's Comet", hans: '哈雷彗星', hant: '哈雷彗星', ja: 'ハレー彗星', ko: '핼리 혜성' },
      type: { en: 'Icy Solar System visitor', hans: '太阳系冰质访客', hant: '太陽系冰質訪客', ja: '太陽系の氷の訪問者', ko: '태양계의 얼음 방문자' },
      facts: {
        en: [['Nucleus', 'A "dirty snowball" of ice and dust'], ['Blue ion tail', 'Ionized gas glows; pinned straight anti-sunward by the solar wind'], ['White dust tail', 'Dust reflecting sunlight; curves gently along the orbit']],
        hans: [['彗核', '冰与尘埃组成的"脏雪球"'], ['蓝色离子尾', '电离气体自身发光,被太阳风吹得笔直背向太阳'], ['黄白尘埃尾', '尘埃反射阳光,沿轨道方向平缓弯曲']],
        hant: [['彗核', '冰與塵埃組成的「髒雪球」'], ['藍色離子尾', '電離氣體自身發光,被太陽風吹得筆直背向太陽'], ['黃白塵埃尾', '塵埃反射陽光,沿軌道方向平緩彎曲']],
        ja: [['彗星核', '氷と塵からなる「汚れた雪玉」'], ['青いイオンの尾', '電離したガス自身が発光し、太陽風で反太陽方向へまっすぐ流される'], ['白い塵の尾', '塵が太陽光を反射し、軌道に沿って緩やかに曲がる']],
        ko: [['혜성 핵', '얼음과 먼지로 이루어진 "더러운 눈덩이"'], ['푸른 이온 꼬리', '이온화된 가스가 스스로 빛나며 태양풍에 의해 태양 반대쪽으로 곧게 뻗음'], ['흰 먼지 꼬리', '먼지가 햇빛을 반사하며 궤도를 따라 완만하게 휘어짐']]
      },
      desc: {
        en: 'A demonstration comet on a Halley-type orbit. Watch it near the Sun: the tails always point AWAY from the Sun — leaving the inner system, a comet travels tail-first.',
        hans: '一颗哈雷型轨道的示意彗星。注意观察它靠近太阳时:彗尾永远背向太阳——离开内太阳系时,彗星其实是"尾巴朝前"倒着飞的。',
        hant: '一顆哈雷型軌道的示意彗星。注意觀察它靠近太陽時:彗尾永遠背向太陽——離開內太陽系時,彗星其實是「尾巴朝前」倒著飛的。',
        ja: 'ハレー型軌道のデモ彗星です。太陽に近づくときに注目:尾はつねに太陽と反対側を向くため、内太陽系を離れるとき彗星は「尾を先頭に」飛んでいきます。',
        ko: '핼리형 궤도의 시연용 혜성입니다. 태양에 가까울 때 관찰해 보세요: 꼬리는 언제나 태양 반대쪽을 향하므로, 내태양계를 떠날 때 혜성은 "꼬리를 앞세우고" 날아갑니다.'
      } }
  ];
  var solarCometSelected = null;
  function renderCometPanel(cometIndex, lang) {
    var info = COMET_INFO[cometIndex]; if (!info) return false;
    var L = info.name[lang] ? lang : 'en';
    var html = '<h2 id="bp-name">' + esc(info.name[L]) + '</h2><span id="bp-type">' + esc(info.type[L]) + '</span>' +
      '<img id="bp-img" src="' + info.img + '" alt="' + esc(info.name[L]) + '" loading="lazy"><div id="bp-credit">' + esc(info.credit) + '</div>' +
      '<table id="bp-facts">' + info.facts[L].map(function (row) { return '<tr><th>' + esc(row[0]) + '</th><td>' + esc(row[1]) + '</td></tr>'; }).join('') + '</table>' +
      '<p id="bp-desc">' + esc(info.desc[L]) + '</p>' +
      '<button type="button" id="bp-flyto">' + esc({ en: '\uD83D\uDE80 Chase this comet \u2192', hans: '\uD83D\uDE80 追上这颗彗星 \u2192', hant: '\uD83D\uDE80 追上這顆彗星 \u2192', ja: '\uD83D\uDE80 この彗星を追いかける \u2192', ko: '\uD83D\uDE80 이 혜성을 쫓아가기 \u2192' }[L]) + '</button>';
    var keep = cardFocusId();
    bpBody.innerHTML = html;
    bpEl.classList.add('open'); restoreCardFocus(keep);
    solarCometSelected = cometIndex; solarCardOpen = true;
    return true;
  }
  function flySolarToComet(cometIndex) {
    if (solarFly || solarWarp) return false;
    if (solarScaleBlend > 0 || solarScaleAnim) return false; // comets are hidden at true scale
    var comet = solarComets[cometIndex]; if (!comet) return false;
    var wp = new THREE.Vector3(); comet.coma.getWorldPosition(wp);
    var dir = solarCamera.position.clone().sub(wp); dir.y = 0;
    if (dir.lengthSq() < 1e-4) dir.set(0.6, 0, 1); dir.normalize();
    var fromTransit = !!solarEventRide && solarEventRide.type === 'transit'; // the transit already saved the view from before it
    cancelSolarEventRide(); // a fly takes over the camera
    if (!fromTransit) solarNav.cameraStack.push(solarSnapshot());
    solarControls.enabled = false;
    solarFly = { cometIndex: cometIndex, dir: dir, dist: 15, lift: 4, p0: solarCamera.position.clone(), t0: solarControls.target.clone(), start: videoNow(), dur: solarReducedMotion() ? 120 : 2600, wp: wp };
    return true;
  }
  function selectSolarComet(cometIndex) {
    noteCardOpener();
    solarNav.selectedId = null;
    return renderCometPanel(cometIndex, beaconLang);
  }
  var solarCometPos = new THREE.Vector3(), solarCometPast = new THREE.Vector3(), solarCometAnti = new THREE.Vector3();
  function cometPoint(comet, angle, target) {
    target.set(Math.cos(angle) * comet.a - comet.e * comet.a, 0, Math.sin(angle) * comet.b);
    return target;
  }
  function updateSolarComets(dt) {
    solarComets.forEach(function (comet) {
      cometPoint(comet, comet.angle, solarCometPos);
      var r = solarCometPos.length();
      comet.angle += dt * comet.rate * Math.pow(comet.q / Math.max(r, comet.q), 1.5); // Kepler's 2nd law, visually: quickest at perihelion, stately everywhere
      var activity = Math.max(0, Math.min(1, (110 - r) / 80)); // volatiles only wake within the inner system
      var st2 = solarShaderTime;
      comet.coma.position.copy(solarCometPos);
      var comaScale = 1 + activity * (2.6 + Math.sin(st2 * 1.7 + comet.index * 3) * 0.18); // the coma gently breathes
      comet.coma.scale.set(comaScale, comaScale, 1);
      comet.coma.material.opacity = 0.1 + activity * 0.45;
      comet.core.position.copy(solarCometPos);
      comet.hitProxy.position.copy(solarCometPos);
      comet.nucleus.position.copy(solarCometPos);
      comet.nucleus.rotation.set(st2 * 0.19, st2 * 0.31, 0); // slow tumble
      var coreScale = 0.35 + activity * 0.7;
      comet.core.scale.set(coreScale, coreScale, 1);
      comet.core.material.opacity = 0.12 + activity * 0.4; // soft coma heart — the rock underneath carries the shape now
      if (activity <= 0) { // aphelion coast: every tail color multiplies to zero anyway — skip ~240 particles and two buffer uploads
        if (!comet.tailsDormant) { comet.tailsDormant = true; comet.tails.visible = false; }
        return;
      }
      if (comet.tailsDormant) { comet.tailsDormant = false; comet.tails.visible = true; }
      solarCometAnti.copy(solarCometPos).normalize(); // anti-solar direction (from the Sun through the comet)
      // orthogonal frame across the tail axis, for lateral structure
      var e1x = -solarCometAnti.z, e1z = solarCometAnti.x; // horizontal perpendicular
      var tp = comet.positions, tc = comet.colors, ionLen = (12 + 34 * activity);
      for (var i = 0; i < comet.ions.length; i++) {
        // ION tail: plasma streams DOWN the tail (flowing phase), bright cyan core, blue fringe,
        // widening toward the tip, with drifting magnetic kinks
        var ion = comet.ions[i], i3 = i * 3;
        var kk = (ion.frac + st2 * 0.05 * ion.speed) % 1;
        var spread2 = 0.25 + kk * 1.9;
        var kink = Math.sin(kk * 7 - st2 * 1.4) * 0.7 * kk;
        tp[i3] = solarCometPos.x + solarCometAnti.x * ionLen * kk + e1x * (ion.lat1 * spread2 + kink);
        tp[i3 + 1] = solarCometPos.y + ion.lat2 * spread2 + kink * 0.4;
        tp[i3 + 2] = solarCometPos.z + solarCometAnti.z * ionLen * kk + e1z * (ion.lat1 * spread2 + kink);
        var coreW = 1 - Math.min(1, Math.sqrt(ion.lat1 * ion.lat1 + ion.lat2 * ion.lat2) * 2.2);
        var fade = Math.min(1, Math.pow(1 - kk, 1.25) * activity * (0.75 + 0.25 * Math.sin(st2 * 2.4 + i)) * 1.45); // ion tail runs brighter than the dust fan
        tc[i3] = (0.22 + 0.5 * coreW) * fade; tc[i3 + 1] = (0.42 + 0.45 * coreW) * fade; tc[i3 + 2] = 1.0 * fade;
      }
      for (var j = 0; j < comet.dust.length; j++) {
        // DUST tail: six synchronic striae fan out — grains leave anti-solar immediately,
        // orbital lag bends only the far tail, and each stria glints softly
        var grain = comet.dust[j], j3 = (comet.ions.length + j) * 3, kd = grain.kd;
        var back = grain.back;
        cometPoint(comet, comet.angle - back, solarCometPast);
        solarCometAnti.copy(solarCometPast).normalize();
        var drift = kd * 26 * activity + kd * kd * 8;
        var striaOff = (grain.stria / 5 - 0.5) * (1.5 + kd * 7) + grain.jag * 0.6; // the fan's radial streaks
        tp[j3] = solarCometPast.x + solarCometAnti.x * drift + e1x * striaOff;
        tp[j3 + 1] = solarCometPast.y + grain.jag * 0.8 * kd;
        tp[j3 + 2] = solarCometPast.z + solarCometAnti.z * drift + e1z * striaOff;
        var striaW = 1 - Math.abs(grain.stria / 5 - 0.5) * 0.8; // center streaks brightest
        var fd = Math.pow(1 - kd, 1.5) * activity * striaW * (0.8 + 0.2 * Math.sin(st2 * 2 + grain.glint));
        tc[j3] = 1.0 * fd; tc[j3 + 1] = 0.92 * fd; tc[j3 + 2] = 0.74 * fd;
      }
      comet.tails.geometry.attributes.position.needsUpdate = true;
      comet.tails.geometry.attributes.color.needsUpdate = true;
    });
  }
  var solarFx = [], solarMeteorNext = videoNow() + 8000 + Math.random() * 10000;
  function spawnSolarMeteor() {
    var nx = Math.random() * 1.4 - 0.7, ny = Math.random() * 1.0 - 0.25;
    var d0 = new THREE.Vector3(nx, ny, 0.5).unproject(solarCamera).sub(solarCamera.position).normalize();
    var ddx = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.4), ddy = -(0.25 + Math.random() * 0.4);
    var d1 = new THREE.Vector3(nx + ddx, ny + ddy, 0.5).unproject(solarCamera).sub(solarCamera.position).normalize();
    var from = solarCamera.position.clone().addScaledVector(d0, 460), to = solarCamera.position.clone().addScaledVector(d1, 460);
    var dir = to.clone().sub(from), dist = dir.length(); if (dist < 1) return; dir.multiplyScalar(1 / dist);
    var viewDir = from.clone().sub(solarCamera.position).normalize();
    var side = new THREE.Vector3().crossVectors(dir, viewDir); if (side.lengthSq() < 1e-4) side.set(0, 1, 0); else side.normalize();
    var normal = new THREE.Vector3().crossVectors(dir, side);
    var m = new THREE.MeshBasicMaterial({ map: METEOR_TEX, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    var mesh = new THREE.Mesh(METEOR_GEO, m);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(dir, side, normal));
    mesh.scale.set(0.001, 2.6, 1); mesh.frustumCulled = false;
    solarScene.add(mesh);
    solarFx.push({ obj: mesh, mat: m, from: from, dir: dir, dist: dist, t0: videoNow(), dur: 1100 + Math.random() * 500 });
  }
  function updateSolarFx(nowMs) {
    if (viewMode !== 'solar') return;
    if (!videoMode && nowMs >= solarMeteorNext) { spawnSolarMeteor(); solarMeteorNext = nowMs + 9000 + Math.random() * 15000; }
    for (var i = solarFx.length - 1; i >= 0; i--) {
      var f = solarFx[i], k = (nowMs - f.t0) / f.dur;
      if (k >= 1) { solarScene.remove(f.obj); f.mat.dispose(); solarFx.splice(i, 1); continue; }
      var kh = Math.min(1, k), kt = Math.max(0, kh - 0.4), curLen = Math.max(f.dist * (kh - kt), 0.001);
      var hx = f.from.x + f.dir.x * f.dist * kh, hy = f.from.y + f.dir.y * f.dist * kh, hz = f.from.z + f.dir.z * f.dist * kh;
      f.obj.position.set(hx - f.dir.x * curLen * 0.5, hy - f.dir.y * curLen * 0.5, hz - f.dir.z * curLen * 0.5);
      f.obj.scale.x = curLen;
      f.mat.opacity = Math.pow(Math.sin(Math.min(1, k) * Math.PI), 0.8) * 0.85;
    }
  }
  solarRoot.add(new THREE.AmbientLight(0x51586b, 0.85)); // strong enough that night sides stay readable for teaching
  // sunlight really comes from the Sun: point light at the origin, no falloff so Neptune stays lit
  solarRoot.add(new THREE.PointLight(0xfff2dc, 1.6, 0, 0));
  // Planet albedo maps are used as stored (display-referred), like every other solar texture: the solar composer never
  // re-encodes to sRGB, so decoding them darkened midtones and clipped bright worlds. Sun 1.6 + ambient ≈ 1.8, so a
  // 0.55 albedo gain shows the sub-solar point in the map's own colour and nothing clips at full phase.
  var SOLAR_ALBEDO_GAIN = 0.55;
  var solarLabelsEl = document.getElementById('solarlabels');
  var solarBackEl = document.getElementById('solarback');

  // bloom composer (defensive: fall back to plain rendering if any global is missing)
  var composer = null;
  try {
    composer = new THREE.EffectComposer(renderer);
    if (renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float')) composer.renderTarget1.texture.type = composer.renderTarget2.texture.type = THREE.HalfFloatType; // HDR scene buffer: an 8-bit one clipped at 1.0 before bloom + ACES and banded the dark core halo into rings
    composer.addPass(new THREE.RenderPass(scene, camera));
    composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(outputWidth, outputHeight), BLOOM.strength, BLOOM.radius, BLOOM.threshold));
    // tone-map AFTER bloom (ACES + gamma) so bright cores compress to colour instead of clipping to white
    composer.addPass(new THREE.ShaderPass({
      uniforms: { tDiffuse: { value: null }, uExposure: { value: TONE.exposure } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; uniform float uExposure; varying vec2 vUv;' +
        'vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }' +
        'float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }' + // static interleaved-gradient noise: 1 LSB peak-to-peak dither, fixed per pixel so encodes don't shimmer
        'void main(){ vec3 c = pow(aces(texture2D(tDiffuse, vUv).rgb * uExposure), vec3(1.0/2.2)); c += (ign(gl_FragCoord.xy) - 0.5) / 255.0 * sign(c); gl_FragColor = vec4(c, 1.0); }'
    }));
    composer.setSize(outputWidth, outputHeight);
  } catch (e) { composer = null; }
  function render() {
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  // glow point fragment shared by dust + planets
  var GLOW_FRAG = 'varying vec3 vColor; void main(){ float s = pow(max(0.0, 1.0 - distance(gl_PointCoord, vec2(0.5)) * 2.0), 2.0); if (s < 0.02) discard; gl_FragColor = vec4(vColor, s); }';
  // softer GAUSSIAN falloff for the gas — no hard dis edge, so dense points blend into a continuous nebula instead of visible circles
  var STAR_FRAG = 'varying vec3 vColor; void main(){ float d = distance(gl_PointCoord, vec2(0.5)) * 2.0;' + // external-galaxy stars: hot core + coloured halo — reads as a star up close, not a cotton ball
    ' float halo = pow(max(0.0, 1.0 - d), 2.2) * 0.65; float core = exp(-d * d * 18.0); float s = halo + core; if (s < 0.02) discard;' +
    ' vec3 c = vColor * halo + (vColor * 0.55 + vec3(0.75)) * core; gl_FragColor = vec4(c, 1.0); }';

  // ── galactic-dust spiral backdrop (decorative; AUTO-FADES as real data grows) ──
  var dustObj = null, dustBuiltCount = -1;
  function buildDust(count) {
    if (dustObj) { galaxyRoot.remove(dustObj); dustObj.geometry.dispose(); dustObj.material.dispose(); dustObj = null; }
    var N = Math.max(0, count | 0);
    dustBuiltCount = N;
    if (N === 0) return;
    var pos = new Float32Array(N * 3), scl = new Float32Array(N), colA = new Float32Array(N * 3);
    var inside = new THREE.Color(DUST.inside), outside = new THREE.Color(DUST.outside), mix = new THREE.Color();
    // Stars CLUMP into irregular knots/associations along the arms (like the real Milky
    // Way — NOT a smooth uniform field). Seed cluster centres on the (weighted) arms, then
    // drop ~80% of stars as a gaussian blob around a centre + a sparse diffuse field.
    var TAU = 6.28318530718;
    function grand() { return Math.random() + Math.random() + Math.random() - 1.5; } // ~gaussian, range ±1.5
    function pickArm(r) { var idx = (Math.random() < 0.7) ? Math.floor(Math.random() * (DUST.arms / 2)) * 2 : Math.floor(Math.random() * (DUST.arms / 2)) * 2 + 1, maj = (idx % 2 === 0); return { maj: maj, ang: idx * (TAU / DUST.arms) + r * DUST.tight * TAU + (Math.random() - 0.5) * DUST.randomness * (maj ? 1.0 : 1.25) }; }
    var NC = Math.max(20, Math.round(N / 200)), clusters = []; // ~1 cluster per 200 stars
    for (var c = 0; c < NC; c++) {
      var crf = Math.pow(Math.random(), DUST.radPow), cp = pickArm(crf), cR = crf * DUST.radius + (Math.random() - 0.5) * DUST.armWidth;
      clusters.push({ x: Math.cos(cp.ang) * cR, z: Math.sin(cp.ang) * cR, rf: crf, maj: cp.maj, sz: 6 + Math.random() * Math.random() * 36 }); // mostly small knots, a few big associations
    }
    for (var i = 0; i < N; i++) {
      var rf, major;
      if (Math.random() < 0.8) {                                  // ~80% of stars CLUMP into a knot
        var k = clusters[(Math.random() * NC) | 0];
        rf = k.rf; major = k.maj;
        pos[i * 3] = k.x + grand() * k.sz; pos[i * 3 + 2] = k.z + grand() * k.sz;
        pos[i * 3 + 1] = grand() * DUST.thickness * ((1 - rf) + 0.2) * 0.45;
      } else {                                                    // ~20% diffuse field stars between the knots
        rf = Math.pow(Math.random(), DUST.radPow); var fp = pickArm(rf), offR = rf * DUST.radius + (Math.random() - 0.5) * DUST.armWidth;
        major = fp.maj;
        pos[i * 3] = Math.cos(fp.ang) * offR; pos[i * 3 + 2] = Math.sin(fp.ang) * offR;
        pos[i * 3 + 1] = (Math.random() - 0.5) * DUST.thickness * ((1 - rf) + 0.2);
      }
      mix.copy(inside).lerp(outside, Math.min(1, Math.max(0, (rf - 0.12) * 3.0))).multiplyScalar(DUST.brightness * (major ? 1.0 : DUST.minorDim) * (1 - 0.4 * Math.min(1, Math.max(0, (rf - 0.78) * 4.5)))); // blue-white arms (gold only in the inner disc) + minor arms dimmer + dim the outer edge
      scl[i] = (0.3 + Math.random() * 0.9) * (major ? 1.0 : 0.82);
      var kn = Math.random();                                            // scattered YELLOW giants + bright HII (pink) / hot blue-white clusters (HII+blue in the MAJOR arms)
      if (kn < 0.003) { mix.setHex(0xffd45a).multiplyScalar(DUST.brightness * 2.6); scl[i] = 1.4 + Math.random() * 1.2; }                              // bright YELLOW glowing stars (giants / globulars like Palomar 1), scattered everywhere
      else if (major && rf > 0.28 && kn < 0.024) { var cr = Math.random(), col = cr < 0.6 ? 0xff5e30 : (cr < 0.8 ? 0xcfe6ff : 0x4d8cff); mix.setHex(col).multiplyScalar(DUST.brightness * 2.3); scl[i] = 1.2 + Math.random() * 0.9; } // bright knot stars: 60% orange-red, 20% blue-white, 20% blue (was pink HII)
      else if (major && rf > 0.28 && kn < 0.103) { mix.setHex(DUST.blueStar).multiplyScalar(DUST.brightness * 2.0); scl[i] = 0.9 + Math.random() * 0.8; } // hot blue-white clusters
      colA[i * 3] = mix.r; colA[i * 3 + 1] = mix.g; colA[i * 3 + 2] = mix.b;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(colA, 3));
    g.setAttribute('aScale', new THREE.BufferAttribute(scl, 1));
    var mat = new THREE.ShaderMaterial({
      uniforms: { uSize: { value: DUST.size * renderer.getPixelRatio() }, uCap: { value: 34 * renderer.getPixelRatio() } },
      vertexShader: 'uniform float uSize; uniform float uCap; attribute float aScale; attribute vec3 aColor; varying vec3 vColor;' +
        'void main(){ vec4 mp = modelMatrix * vec4(position,1.0); vec4 vp = viewMatrix * mp; gl_Position = projectionMatrix * vp;' +
        ' gl_PointSize = min(uSize * aScale * (300.0 / -vp.z), uCap); vColor = aColor * 0.75 * (0.3 + 0.9 * smoothstep(450.0, 150.0, -vp.z)); }', // quiet over the painting from afar, sparkling up close
      fragmentShader: STAR_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    dustObj = new THREE.Points(g, mat); galaxyRoot.add(dustObj); // rotates with the galaxy
  }
  // dustFor: the current dust count, scaled down by the FPS watchdog on weak GPUs.
  function dustFor() { return Math.max(DUST.min, Math.round(DUST.count * perfScale)); }
  buildDust(DUST.count); // full dust on load

  // ── painted Milky Way ─────────────────────────────────────────────────────────
  // An oil-painted disc baked once on the GPU (brush strokes smeared along the spiral flow,
  // dark lanes on each arm's inner edge, pink star-forming specks, a cream-gold core). Far away
  // it reads as a painting; up close the painting fades out and the stars take over. Design: docs/superpowers/specs/2026-10-25-painted-milky-way-design.md
  // Big painted textures are filled one tile per frame from a shared queue: the Milky Way first, then the
  // external galaxies (photo-plate ones join when their plate loads). Video mode bakes each job at once.
  var paintQueue = [], paintRaf = 0, paintWaiting = 0; // paintWaiting: photo plates still loading
  function paintTile(job) { // render one cell of a grid×grid split of the job's target (grid 1 = whole target)
    var rt = job.rt, grid = job.grid, tile = job.next++, n = rt.width / grid, cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    rt.scissor.set((tile % grid) * n, Math.floor(tile / grid) * n, n, n); rt.scissorTest = grid > 1;
    rt.texture.generateMipmaps = tile === grid * grid - 1; // three remips the whole target after every render; only the finished bake is ever sampled
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(job.scene, job.cam);
    renderer.setRenderTarget(null); renderer.setClearColor(cc, ca); rt.scissorTest = false;
  }
  function paintFinish(job) { // bake whatever is left of a job right now
    while (job.next < job.grid * job.grid) paintTile(job);
    var i = paintQueue.indexOf(job); if (i >= 0) paintQueue.splice(i, 1);
    job.done();
  }
  function paintStep() {
    paintRaf = 0;
    var job = paintQueue[0]; if (!job) return;
    paintTile(job);
    if (job.next >= job.grid * job.grid) { paintQueue.shift(); job.done(); }
    if (paintQueue.length) paintRaf = requestAnimationFrame(paintStep);
  }
  function paintSchedule(job) {
    if (videoMode) { paintFinish(job); return; } // captures need every painting on their first frame
    paintQueue.push(job);
    if (!paintRaf) paintRaf = requestAnimationFrame(paintStep);
  }
  function paintFlush() { while (paintQueue.length) paintFinish(paintQueue[0]); }
  function paintPending() { return paintQueue.length + paintWaiting; }
  var paintedGalaxy = null;
  (function buildPaintedGalaxy() {
    var R = DUST.radius, TAU = 6.28318530718;
    var touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var common =
      'uniform float uR; uniform float uArms; uniform float uTight;' +
      'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }' +
      'float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }' +
      'float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int k = 0; k < 5; k++){ v += a * noise(p); p = p * 2.03 + 1.7; a *= 0.5; } return v; }' +
      'vec2 flowDir(vec2 p){ float r = max(length(p), 2.0); vec2 er = p / r; vec2 et = vec2(-er.y, er.x); float c = uTight * 6.28318 / uR;' +
      '  vec2 d = normalize(er + et * r * c);' +
      '  float sw = (fbm(p * 0.012 + 3.0) - 0.5) * 1.1;' + // coherent swirl: the strokes wander off the ideal spiral like brushwork
      '  float cs = cos(sw), sn = sin(sw); return vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs); }' +
      'float lic(vec2 p, float freq, float len){ float s = 0.0, w = 0.0; vec2 q = p; vec2 o = vec2(13.1, 7.7);' + // line-integral convolution of noise along the flow = brush strands
      '  for (int i = 0; i < 14; i++){ float t = float(i) / 14.0; float wt = 1.0 - t; s += noise(q * freq + o) * wt; w += wt; q += flowDir(q) * (len / 14.0); }' +
      '  q = p; for (int i = 0; i < 14; i++){ q -= flowDir(q) * (len / 14.0); float t = float(i + 1) / 14.0; float wt = 1.0 - t; s += noise(q * freq + o) * wt; w += wt; }' +
      '  return s / w; }';
    var discFrag =
      'varying vec2 vP; uniform float uBright; uniform float uInter; uniform float uLane; uniform float uHii;' + common +
      'void main(){' +
      '  float r = length(vP), nr = r / uR, ang = atan(vP.y, vP.x);' +
      '  float edgeN = fbm(vP * 0.008 + 21.0);' +
      '  float env = smoothstep(1.12, 0.62, nr + (edgeN - 0.5) * 0.22);' + // soft, ragged rim
      '  if (env <= 0.0 && nr > 0.3) { gl_FragColor = vec4(0.0); return; }' +
      '  vec2 wp = vP * 0.011; float w1 = fbm(wp), w2 = fbm(wp + 4.3);' +
      '  float theta = ang + (w1 - 0.5) * 0.55 - nr * uTight * 6.28318;' + // same winding as the dust arms (beacons keep their places)
      '  float armId = mod(floor(theta * uArms / 6.28318 + 0.5), uArms); float major = 1.0 - step(0.5, mod(armId, 2.0));' +
      '  float arm = pow(max(0.0, cos(uArms * theta) * 0.5 + 0.5), 2.2) * mix(0.62, 1.0, major);' +
      '  float lane = pow(max(0.0, cos(uArms * (theta - 0.12 + (w2 - 0.5) * 0.16)) * 0.5 + 0.5), 7.0) * mix(0.7, 1.0, major);' + // dark lane on the inner (concave) edge of each arm
      '  float fine = lic(vP, 1.25, 7.0);' +    // thin bristle strands
      '  float coarse = lic(vP, 0.22, 34.0);' + // broad brush sweeps
      '  float hair = lic(vP, 2.6, 4.5);' +     // the finest bristles
      '  float strands = clamp((fine - 0.5) * 3.4 + 0.5, 0.0, 1.0) * 0.5 + clamp((coarse - 0.5) * 2.6 + 0.5, 0.0, 1.0) * 0.45 + clamp((hair - 0.5) * 3.0 + 0.5, 0.0, 1.0) * 0.35;' +
      '  float dens = env * (uInter + (1.0 - uInter) * arm) * (0.12 + 1.15 * strands * strands);' +
      '  dens *= 0.55 + 0.6 * fbm(vP * 0.03 + vec2(w1, w2) * 3.0);' + // patchy clouds
      '  float absorb = lane * smoothstep(0.07, 0.24, nr) * smoothstep(1.0, 0.7, nr) * (0.45 + 0.75 * clamp((coarse - 0.35) * 2.5, 0.0, 1.0)) * (0.55 + 0.75 * fbm(vP * 0.045 + 9.0));' +
      '  dens *= 1.0 - uLane * clamp(absorb * 1.5, 0.0, 1.0);' +
      // palette: warm core → lavender → blue rim; arms cooler and whiter, the gaps purpler, a few violet patches
      '  float patchy = fbm(vP * 0.006 + 40.0);' +
      '  vec3 col = mix(vec3(1.0, 0.74, 0.66), vec3(0.60, 0.60, 1.0), smoothstep(0.1, 0.4, nr));' +
      '  col = mix(col, vec3(0.26, 0.44, 1.0), smoothstep(0.32, 0.85, nr + (patchy - 0.5) * 0.5));' +
      '  col = mix(col, vec3(0.72, 0.44, 0.98), smoothstep(0.58, 0.78, patchy) * 0.4 * smoothstep(0.15, 0.4, nr));' +
      '  col = mix(col * vec3(0.92, 0.72, 1.05), col * vec3(0.95, 1.0, 1.06) + 0.05, arm);' +
      '  col += (coarse - 0.5) * vec3(0.10, 0.04, 0.14);' +
      // pink star-forming specks, clustered along the arms
      '  float kn = smoothstep(0.62, 0.8, noise(vP * 0.55 + 31.0) * 0.55 + noise(vP * 1.6 + 5.0) * 0.45) * (0.35 + 0.65 * arm) * smoothstep(0.16, 0.34, nr) * env * (0.4 + 0.8 * smoothstep(0.4, 0.7, fbm(vP * 0.02 + 70.0)));' +
      '  col = mix(col, vec3(1.0, 0.26, 0.42), clamp(kn * 1.8, 0.0, 1.0) * uHii);' +
      '  dens += kn * uHii * (1.0 - uLane * clamp(absorb, 0.0, 1.0));' +
      // the bulge: cream-gold, brushwork too (the two glow sprites add the hot centre)
      '  float core = exp(-pow(nr / 0.19, 1.4));' +
      '  col = mix(col, vec3(1.0, 0.80, 0.52), clamp(core * 1.3, 0.0, 1.0));' +
      '  float inten = dens * uBright * 0.62 + core * (0.25 + 0.75 * strands) * uBright * 0.85;' +
      '  gl_FragColor = vec4(col * inten, 1.0);' +
      '}';
    var size = touch ? 2048 : 4096, tiles = size / (touch ? 256 : 512); // full-res bake in tiles, one per frame
    var half = renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float');
    function makeRT(n) { return new THREE.WebGLRenderTarget(n, n, { depthBuffer: false, format: THREE.RGBAFormat, type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true }); }
    var span = R * 2.5, geo = new THREE.PlaneGeometry(span, span, 1, 1);
    var bakeMat = new THREE.ShaderMaterial({
      uniforms: { uR: { value: R }, uArms: { value: DUST.arms }, uTight: { value: DUST.tight }, uBright: { value: 1.0 }, uInter: { value: 0.32 }, uLane: { value: 0.95 }, uHii: { value: 1.0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: discFrag, blending: THREE.NoBlending, depthWrite: false
    });
    var bakeScene = new THREE.Scene(); bakeScene.add(new THREE.Mesh(geo, bakeMat));
    var bakeCam = new THREE.OrthographicCamera(-span / 2, span / 2, span / 2, -span / 2, 0.1, 10); bakeCam.position.z = 1; bakeCam.lookAt(0, 0, 0);
    var preview = makeRT(1024), full = makeRT(size), mapU = { value: preview.texture };
    paintFinish({ rt: preview, scene: bakeScene, cam: bakeCam, grid: 1, next: 0, done: function () {} }); // ~1/16 of the full cost: the disc is there on the first frame
    function finish() { mapU.value = full.texture; if (preview) { preview.dispose(); preview = null; } }
    var job = { rt: full, scene: bakeScene, cam: bakeCam, grid: tiles, next: 0, done: finish };
    function bakeAll() { job.next = 0; paintFinish(job); }
    paintSchedule(job);
    cv.addEventListener('webglcontextrestored', bakeAll); // a restored context brings the target back empty
    // the disc: the painting fades by view depth, so whatever is close to the camera dissolves into stars.
    // Two faint copies above/below give it some body edge-on; they only draw at grazing angles.
    var layers = [0, 3.5, -3.5].map(function (y, i) {
      var m = new THREE.ShaderMaterial({
        uniforms: { uMap: mapU, uGain: { value: i ? 0 : 1 } },
        vertexShader: 'varying vec2 vUv; varying float vDepth; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform sampler2D uMap; uniform float uGain; varying vec2 vUv; varying float vDepth;' +
          'void main(){ float near = mix(0.15, 1.0, smoothstep(40.0, 240.0, vDepth)); gl_FragColor = vec4(texture2D(uMap, vUv).rgb * near * uGain, 1.0); }',
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
      });
      var mesh = new THREE.Mesh(geo, m); mesh.rotation.x = Math.PI / 2; mesh.position.y = y; mesh.frustumCulled = false; mesh.visible = !i;
      galaxyRoot.add(mesh);
      return mesh;
    });
    paintedGalaxy = {
      touch: touch, disc: layers[0], layers: layers, bakeAll: bakeAll,
      updateView: function (cam) { // edge-on body: fade the two copies in below ~14° elevation
        var sinEl = Math.abs(cam.position.y) / Math.max(cam.position.length(), 1e-3), g = Math.max(0, 1 - sinEl / 0.25) * 0.35;
        layers[0].material.uniforms.uGain.value = 1 - g;
        for (var k = 1; k < 3; k++) { layers[k].visible = g > 0.001; layers[k].material.uniforms.uGain.value = g; }
      }
    };
  })();

  // ── background star-field: fine sharp points on a far sphere (the fixed "sky").
  // Each star TWINKLES on its own phase/speed — one uTime uniform per frame, the
  // sin() runs in the vertex shader (4000 verts ≈ free). ──────────────────────────
  var bgTwinkleMat = null;
  (function bgStars() {
    var N = 4000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), phs = new Float32Array(N), spd = new Float32Array(N), c = new THREE.Color();
    for (var i = 0; i < N; i++) {
      var th = Math.random() * 6.28318530718, ph = Math.acos(2 * Math.random() - 1), r = 900 + Math.random() * 800;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); pos[i * 3 + 2] = r * Math.cos(ph);
      var b = 0.55 + Math.random() * 0.45, tint = Math.random();
      if (tint < 0.12) c.setRGB(b * 0.74, b * 0.85, b); else if (tint < 0.22) c.setRGB(b, b * 0.82, b * 0.6); else c.setRGB(b, b, b);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      phs[i] = Math.random() * 6.28318; spd[i] = 0.6 + Math.random() * 1.6;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phs, 1));
    g.setAttribute('aSpd', new THREE.BufferAttribute(spd, 1));
    bgTwinkleMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uSize: { value: 3.4 * renderer.getPixelRatio() } },
      vertexShader: 'uniform float uTime; uniform float uSize; attribute vec3 aColor; attribute float aPhase; attribute float aSpd; varying vec3 vColor;' +
        'void main(){ vec4 vp = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * vp;' +
        ' float tw = 0.6 + 0.4 * sin(uTime * aSpd + aPhase);' +
        ' float flare = pow(max(0.0, sin(uTime * (0.25 + aSpd * 0.2) + aPhase * 2.3)), 24.0);' + // rare brief scintillation flash
        ' float br = tw + flare;' +
        ' gl_PointSize = uSize * (0.8 + 0.5 * br) * (300.0 / -vp.z); vColor = aColor * br; }',
      fragmentShader: 'varying vec3 vColor; void main(){ float d = distance(gl_PointCoord, vec2(0.5)); if (d > 0.5) discard; float s = pow(max(0.0, 1.0 - d * 2.0), 1.4); gl_FragColor = vec4(vColor, s); }',
      transparent: true, depthWrite: false
    });
    scene.add(new THREE.Points(g, bgTwinkleMat)); // on the fixed sky, not galaxyRoot
  })();

  // soft radial glow texture for the star halos
  function glowTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.28, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  function bulgeTexture() { // per-pixel gaussian falloff — canvas gradients dither with RGB noise (visible as
    // coloured confetti when a huge close-up halo sprite magnifies the texture), so we write exact pixels instead
    var S = 128, c = document.createElement('canvas'); c.width = c.height = S;
    var x = c.getContext('2d'), img = x.createImageData(S, S), d = img.data, k = 4.5, base = Math.exp(-k);
    for (var py = 0; py < S; py++) for (var px = 0; px < S; px++) {
      var dx = (px + 0.5) / S * 2 - 1, dy = (py + 0.5) / S * 2 - 1, r2 = dx * dx + dy * dy;
      var a = r2 >= 1 ? 0 : (Math.exp(-k * r2) - base) / (1 - base); // exact gaussian, exactly zero at the rim
      var o4 = (py * S + px) * 4; d[o4] = 255; d[o4 + 1] = 255; d[o4 + 2] = 255; d[o4 + 3] = Math.round(a * 255);
    }
    x.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(c);
  }
  var BULGE_TEX = bulgeTexture();
  // The 256² fBm fill below costs ~25 ms per texture and five are made at load (M87's lobe, Cen A's cap), so it runs
  // lazily: an idle queue paints them one per idle slot, and a sprite that reaches the screen first paints its own map
  // just before three uploads it (onBeforeRender runs after culling, before the draw). Same pixels, just later.
  var wispQueue = [];
  function wispTexture(seed) { // turbulent filament cloud — domain-warped fBm under a radial mask; the "science-documentary nebula" look
    var S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    var tex = new THREE.CanvasTexture(c);
    tex.wispPaint = function () { tex.wispPaint = null; wispPixels(c, S, seed); tex.needsUpdate = true; };
    if (wispQueue.push(tex) === 1) wispIdle(paintQueuedWisp);
    return tex;
  }
  function wispIdle(f) { if (window.requestIdleCallback) requestIdleCallback(f, { timeout: 4000 }); else setTimeout(f, 300); }
  function paintQueuedWisp() { var t = wispQueue.shift(); if (t && t.wispPaint) t.wispPaint(); if (wispQueue.length) wispIdle(paintQueuedWisp); }
  function paintWispOnDraw(renderer, scene, camera, geometry, material) { if (material.map && material.map.wispPaint) material.map.wispPaint(); }
  function wispPixels(c, S, seed) {
    var x = c.getContext('2d'), img = x.createImageData(S, S), d = img.data;
    function h2(ix, iy) { var n = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453; return n - Math.floor(n); }
    function vn(vx, vy) { var xi = Math.floor(vx), yi = Math.floor(vy), xf = vx - xi, yf = vy - yi;
      var a = h2(xi, yi), b = h2(xi + 1, yi), e = h2(xi, yi + 1), f = h2(xi + 1, yi + 1);
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      return a + (b - a) * u + (e - a) * v + (a - b - e + f) * u * v; }
    function fbm(fx, fy) { var s = 0, amp = 0.5, fr = 1; for (var o = 0; o < 4; o++) { s += amp * vn(fx * fr, fy * fr); amp *= 0.5; fr *= 2.1; } return s; }
    for (var py = 0; py < S; py++) for (var px = 0; px < S; px++) {
      var nx = px / S * 4, ny = py / S * 4;
      var wx = fbm(nx + 5.2, ny + 1.3), wy = fbm(nx - 3.1, ny + 7.7);
      var n = fbm(nx + 2.6 * wx, ny + 2.6 * wy);                       // strongly warped fBm → curling strands and knots, not a smooth blob
      var dx = px / S - 0.5, dy = py / S - 0.5, r = Math.sqrt(dx * dx + dy * dy) * 2;
      var mask = Math.max(0, 1 - r); mask *= mask;
      var a = Math.pow(Math.max(0, n - 0.34) * 2.2, 1.5) * mask;       // fewer, bolder strands; melt at the rim
      var o4 = (py * S + px) * 4; d[o4] = 255; d[o4 + 1] = 255; d[o4 + 2] = 255; d[o4 + 3] = Math.min(255, Math.round(a * 255));
    }
    x.putImageData(img, 0, 0);
  }

  // soft glow at the galactic CORE only — a faint tinted halo around the bright
  // centre (bloom does the rest). No scattered nebula clouds.
  // ── central BULGE — a SMOOTH bright glowing core (per the reference): a hot-white centre
  // fading to a soft halo, built from stacked radial-gradient glow sprites —
  // NOT a dense star pile (that read as "a heap of golden balls" up close). A sparse FAINT
  // star scatter adds subtle texture only; the GLOW is the core. ROUND. Tunables: BULGE.* + glows[].
  var BULGE = { count: 2200, radius: 84, flat: 0.5 };
  var coreBreath = []; // the bulge glow sprites + base scales — frame() breathes them ±2.8% on a ~20s sine
  (function centralBulge() {
    var glows = [{ c: 0xfffdf6, s: 80, o: 0.385 }, { c: 0xfff3da, s: 150, o: 0.20 }]; // the painted disc paints its own core; only the hot centre stays a glow
    for (var gi = 0; gi < glows.length; gi++) {
      var G = glows[gi], sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: G.c, transparent: true, opacity: G.o, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); // distance falloff lives in frame(): scene fog drained the core to a navy disc when zoomed out
      sp.position.set(0, 0, 0); sp.scale.set(G.s, G.s, 1); scene.add(sp);
      coreBreath.push({ sp: sp, s: G.s, o: G.o });
    }
    function gb() { return Math.random() + Math.random() + Math.random() - 1.5; } // ~gaussian, range ±1.5
    var N = BULGE.count, pos = new Float32Array(N * 3), colA = new Float32Array(N * 3), scl = new Float32Array(N);
    var c0 = new THREE.Color(0xfff2dc), c1 = new THREE.Color(0xffc266), cc = new THREE.Color();
    for (var i = 0; i < N; i++) {
      var gx = gb(), gy = gb(), gz = gb();
      pos[i * 3] = gx * BULGE.radius; pos[i * 3 + 1] = gy * BULGE.radius * BULGE.flat; pos[i * 3 + 2] = gz * BULGE.radius;
      var d = Math.min(1, Math.sqrt(gx * gx + gy * gy + gz * gz) / 2.2);
      cc.copy(c0).lerp(c1, d).multiplyScalar(DUST.brightness * (0.9 - 0.4 * d)); // FAINT — subtle texture only; the smooth glow is the core, not these points
      colA[i * 3] = cc.r; colA[i * 3 + 1] = cc.g; colA[i * 3 + 2] = cc.b;
      scl[i] = 0.3 + Math.random() * 0.5; // small soft points
    }
    var bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    bg.setAttribute('aColor', new THREE.BufferAttribute(colA, 3));
    bg.setAttribute('aScale', new THREE.BufferAttribute(scl, 1));
    galaxyRoot.add(new THREE.Points(bg, new THREE.ShaderMaterial({
      uniforms: { uSize: { value: DUST.size * renderer.getPixelRatio() }, uCap: { value: 34 * renderer.getPixelRatio() } },
      vertexShader: 'uniform float uSize; uniform float uCap; attribute float aScale; attribute vec3 aColor; varying vec3 vColor;' +
        'void main(){ vec4 mp = modelMatrix * vec4(position,1.0); vec4 vp = viewMatrix * mp; gl_Position = projectionMatrix * vp;' +
        ' gl_PointSize = min(uSize * aScale * (300.0 / -vp.z), uCap); vColor = aColor; }', // cap: a close pass shows crisp points, not screen-filling blobs
      fragmentShader: GLOW_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    })));
  })();

  // ── location beacons: the Solar System + famous Milky-Way landmarks ──────────
  // Positions live in galaxyRoot space (they ride the rotation, staying on their
  // arm). Each frame the 3D point is projected to the screen and a borderless
  // HTML beacon (glow dot + pulse rings + label) is moved onto it.
  var BEACONS = [];
  var beaconLang = 'hans'; try { var storedLang = localStorage.getItem('gx-lang'); if (['en', 'hans', 'hant', 'ja', 'ko'].indexOf(storedLang) !== -1) beaconLang = storedLang; } catch (e) {} // whitelist: a prototype key like 'constructor' would defeat every || fallback
  function setBeaconLang(lang) {
    beaconLang = lang;
    try { localStorage.setItem('gx-lang', lang); } catch (e) {}
    for (var i = 0; i < BEACONS.length; i++) {
      var t = BEACONS[i].t[lang] || BEACONS[i].t.en;
      BEACONS[i].el.querySelector('.b-label').innerHTML = t[0] + (t[1] ? '<small>' + t[1] + '</small>' : '');
    }
    if (typeof updateSolarNavigationText === 'function') updateSolarNavigationText();
    if (returnBtn && returnBtn.style.display === 'block') returnBtn.textContent = RET_TXT[lang] || RET_TXT.en;
    if (typeof selectedBeacon !== 'undefined' && selectedBeacon !== null && typeof renderPanel === 'function') renderPanel(selectedBeacon, lang);
    if (typeof paintSkyLabels === 'function' && typeof SKY_CONS !== 'undefined' && SKY_CONS.length) paintSkyLabels(lang);
    if (typeof skySelected !== 'undefined' && skySelected !== null && typeof renderConstellationPanel === 'function') renderConstellationPanel(skySelected, lang);
    if (typeof paintSkyGalLabels === 'function' && typeof SKY_GAL !== 'undefined' && SKY_GAL.length) paintSkyGalLabels(lang);
    if (typeof window.skyGalSelected !== 'undefined' && window.skyGalSelected !== null && typeof renderPanel === 'function') renderPanel(SKY_GAL[window.skyGalSelected].beaconIdx, lang);
    if (typeof viewMode !== 'undefined' && viewMode === 'solar') {
      if (typeof updateSolarLabels === 'function') updateSolarLabels();
      if (typeof solarNav !== 'undefined' && solarNav && solarCardOpen && solarNav.selectedId && typeof renderSolarPanel === 'function') renderSolarPanel(solarNav.selectedId, lang);
      if (typeof solarCometSelected !== 'undefined' && solarCometSelected !== null && typeof renderCometPanel === 'function') renderCometPanel(solarCometSelected, lang);
    }
  }
  (function buildBeacons() {
    var TAU = Math.PI * 2;
    function armXZ(rf, idx) { var a = idx * (TAU / DUST.arms) + rf * DUST.tight * TAU; return new THREE.Vector3(Math.cos(a) * rf * DUST.radius, 0, Math.sin(a) * rf * DUST.radius); }
    var sun = armXZ(0.51, 1); // Orion spur: a MINOR arm, ~half-way out (26.7 of ~52 kly)
    var inward = sun.clone().negate().normalize();          // toward the galactic centre
    var along = new THREE.Vector3(-inward.z, 0, inward.x);  // roughly along the local arm
    // real galactic coordinates → model position. l = galactic longitude (0° = toward the
    // centre), b = latitude, distKly = distance from the Sun in thousands of light-years.
    var KLY = DUST.radius / 52; // model units per kly (disc radius 360u ≈ 52 kly)
    function galPos(lDeg, bDeg, distKly) {
      var l = lDeg * Math.PI / 180, b = bDeg * Math.PI / 180, d = distKly * KLY;
      d = Math.max(d, 2.5); // ponytail: display floor — Sirius (8.6 ly ≈ 0.06u) would sit inside the Sun's dot
      return sun.clone()
        .addScaledVector(inward, d * Math.cos(b) * Math.cos(l))
        .addScaledVector(along, d * Math.cos(b) * Math.sin(l))
        .add(new THREE.Vector3(0, d * Math.sin(b), 0));
    }
    // Known mirror, kept on purpose: +b goes to +Y, but the disc spins counter-clockwise seen from +Y (GALAXY_SPIN > 0)
    // and l = 90° points along the Sun's motion, so +Y is really the SOUTH galactic pole. Off-plane objects (halo
    // globulars, the external galaxies) therefore sit on the wrong side of the disc. Negating b alone throws the
    // Magellanic Clouds, M31 and M33 out of the opening frame; the correct fix is to mirror the whole galaxy view
    // in x (galaxyRoot.scale.x = -1, GALAXY_SPIN < 0, fixed galaxies' x negated), which flips the composition.
    // Positions are REAL: galPos(l, b, distKly) from published galactic coordinates
    // (multi-source cross-checked). The label declutter in updateBeacons handles the
    // resulting solar-neighbourhood crowding — dots stay, crowded labels reappear on zoom.
    // t: label text per language — [name, optional subtitle]. en / hans (简体) / hant (繁體) / ja / ko
    var DEFS = [
      { p: sun, cls: 'sun',
        t: { en: ['Solar System', 'you are here'], hans: ['太阳系', '你在这里'], hant: ['太陽系', '你在這裡'], ja: ["太陽系","現在地"], ko: ["태양계","현재 위치"] },
        info: {
          en:   { type:'Star system', distance:'You are here', constellation:'—', facts:[['Star','1 (the Sun)'],['Planets','8']], desc:'Our home system, circling the galactic centre once every ~230 million years.', catalog:'' },
          hans: { type:'恒星系统', distance:'你在这里', constellation:'—', facts:[['恒星','1 颗(太阳)'],['行星','8 颗']], desc:'我们的家园,绕银河系中心公转一圈约需 2.3 亿年。', catalog:'' },
          hant: { type:'恆星系統', distance:'你在這裡', constellation:'—', facts:[['恆星','1 顆(太陽)'],['行星','8 顆']], desc:'我們的家園,繞銀河系中心公轉一圈約需 2.3 億年。', catalog:'' },
          ja:   {"type":"恒星系","distance":"現在地","constellation":"—","facts":[["恒星","1個（太陽）"],["惑星","8個"]],"desc":"私たちの故郷である惑星系。約2億3000万年かけて、銀河系の中心のまわりを一周しています。","catalog":""},
          ko:   {"type":"항성계","distance":"현재 위치","constellation":"—","facts":[["항성","1개 (태양)"],["행성","8개"]],"desc":"우리의 고향 항성계로, 약 2억 3천만 년에 한 번씩 은하 중심을 공전합니다.","catalog":""} } },
      { p: new THREE.Vector3(0, 4, 0),
        t: { en: ['Sagittarius A∗', 'galactic centre'], hans: ['人马座 A*', '银河系中心'], hant: ['人馬座 A*', '銀河系中心'], ja: ["いて座A*","銀河系の中心"], ko: ["궁수자리 A*","은하 중심"] },
        info: {
          en:   { type:'Supermassive black hole', distance:'~26,000 light-years', constellation:'Sagittarius', facts:[['Mass','~4.3 million M☉']], desc:'The supermassive black hole anchoring the centre of the Milky Way.', catalog:'Sgr A*' },
          hans: { type:'超大质量黑洞', distance:'约 26,000 光年', constellation:'人马座', facts:[['质量','约 430 万倍太阳质量']], desc:'坐镇银河系中心的超大质量黑洞。', catalog:'Sgr A*' },
          hant: { type:'超大質量黑洞', distance:'約 26,000 光年', constellation:'人馬座', facts:[['質量','約 430 萬倍太陽質量']], desc:'坐鎮銀河系中心的超大質量黑洞。', catalog:'Sgr A*' },
          ja:   {"type":"超大質量ブラックホール","distance":"約26,000光年","constellation":"いて座","facts":[["質量","太陽の約430万倍"]],"desc":"天の川銀河の中心にどっしりと構える超大質量ブラックホールです。","catalog":"Sgr A*"},
          ko:   {"type":"초대질량 블랙홀","distance":"약 26,000광년","constellation":"궁수자리","facts":[["질량","태양의 약 430만 배"]],"desc":"우리은하의 중심에 자리 잡고 은하 전체를 붙들고 있는 초대질량 블랙홀입니다.","catalog":"Sgr A*"} } },
      { p: galPos(209, -19.4, 1.34), cls: 'up',
        t: { en: ['Orion Nebula'], hans: ['猎户座大星云'], hant: ['獵戶座大星雲'], ja: ["オリオン大星雲"], ko: ["오리온 대성운"] },
        info: {
          en:   { type:'Emission nebula', distance:'~1,340 light-years', constellation:'Orion', facts:[['Diameter','~24 light-years'],['Apparent mag','4.0']], desc:'The nearest large stellar nursery, faintly visible to the naked eye below Orion’s Belt.', catalog:'M42' },
          hans: { type:'发射星云', distance:'约 1,340 光年', constellation:'猎户座', facts:[['直径','约 24 光年'],['视星等','4.0']], desc:'离我们最近的大型恒星摇篮,肉眼在猎户腰带下方隐约可见。', catalog:'M42' },
          hant: { type:'發射星雲', distance:'約 1,340 光年', constellation:'獵戶座', facts:[['直徑','約 24 光年'],['視星等','4.0']], desc:'離我們最近的大型恆星搖籃,肉眼在獵戶腰帶下方隱約可見。', catalog:'M42' },
          ja:   {"type":"散光星雲","distance":"約1,340光年","constellation":"オリオン座","facts":[["直径","約24光年"],["視等級","4.0"]],"desc":"地球に最も近い大規模な星のゆりかご。オリオン座の三つ星の下に、肉眼でもかすかに見えます。","catalog":"M42"},
          ko:   {"type":"발광 성운","distance":"약 1,340광년","constellation":"오리온자리","facts":[["지름","약 24광년"],["겉보기 등급","4.0"]],"desc":"지구에서 가장 가까운 대형 별 탄생 지역으로, 오리온의 허리띠 아래에서 맨눈으로도 희미하게 볼 수 있습니다.","catalog":"M42"} } },
      { p: galPos(184.6, -5.8, 6.5),
        t: { en: ['Crab Nebula'], hans: ['蟹状星云'], hant: ['蟹狀星雲'], ja: ["かに星雲"], ko: ["게성운"] },
        info: {
          en:   { type:'Supernova remnant', distance:'~6,500 light-years', constellation:'Taurus', facts:[['Supernova','1054 CE'],['Core','Crab Pulsar']], desc:'The expanding wreck of a star seen exploding in 1054 CE, with a spinning neutron star at its heart.', catalog:'M1' },
          hans: { type:'超新星遗迹', distance:'约 6,500 光年', constellation:'金牛座', facts:[['超新星','公元 1054 年'],['核心','蟹状星云脉冲星']], desc:'公元 1054 年被记录到爆发的恒星残骸,中心是一颗高速自转的中子星。', catalog:'M1' },
          hant: { type:'超新星遺跡', distance:'約 6,500 光年', constellation:'金牛座', facts:[['超新星','公元 1054 年'],['核心','蟹狀星雲脈衝星']], desc:'公元 1054 年被記錄到爆發的恆星殘骸,中心是一顆高速自轉的中子星。', catalog:'M1' },
          ja:   {"type":"超新星残骸","distance":"約6,500光年","constellation":"おうし座","facts":[["超新星","西暦1054年"],["中心天体","かにパルサー"]],"desc":"西暦1054年に爆発が記録された恒星の残骸。中心では中性子星が高速で自転しています。","catalog":"M1"},
          ko:   {"type":"초신성 잔해","distance":"약 6,500광년","constellation":"황소자리","facts":[["초신성","서기 1054년"],["중심핵","게성운 펄서"]],"desc":"서기 1054년에 폭발이 관측된 별의 잔해가 지금도 팽창하고 있으며, 그 중심에는 빠르게 자전하는 중성자별이 있습니다.","catalog":"M1"} } },
      { p: galPos(17, 0.8, 7.0), cls: 'up',
        t: { en: ['Eagle Nebula'], hans: ['鹰状星云'], hant: ['鷹狀星雲'], ja: ["わし星雲"], ko: ["독수리 성운"] },
        info: {
          en:   { type:'Emission nebula', distance:'~7,000 light-years', constellation:'Serpens', facts:[['Famous for','Pillars of Creation']], desc:'A star-forming region whose towering gas columns became famous as Hubble’s “Pillars of Creation”.', catalog:'M16' },
          hans: { type:'发射星云', distance:'约 7,000 光年', constellation:'巨蛇座', facts:[['著名','创生之柱']], desc:'一处恒星形成区,高耸的气柱因哈勃的“创生之柱”影像而闻名。', catalog:'M16' },
          hant: { type:'發射星雲', distance:'約 7,000 光年', constellation:'巨蛇座', facts:[['著名','創生之柱']], desc:'一處恆星形成區,高聳的氣柱因哈勃的「創生之柱」影像而聞名。', catalog:'M16' },
          ja:   {"type":"散光星雲","distance":"約7,000光年","constellation":"へび座","facts":[["見どころ","創造の柱"]],"desc":"星形成領域のひとつ。そびえ立つガスの柱は、ハッブル宇宙望遠鏡の「創造の柱」の画像で有名になりました。","catalog":"M16"},
          ko:   {"type":"발광 성운","distance":"약 7,000광년","constellation":"뱀자리","facts":[["명물","창조의 기둥"]],"desc":"높이 솟은 가스 기둥이 허블 우주망원경의 \"창조의 기둥\" 사진으로 유명해진 별 형성 지역입니다.","catalog":"M16"} } },
      { p: galPos(287.6, -0.6, 7.5),
        t: { en: ['Carina Nebula'], hans: ['船底座大星云'], hant: ['船底座大星雲'], ja: ["イータカリーナ星雲"], ko: ["용골자리 성운"] },
        info: {
          en:   { type:'Emission nebula', distance:'~7,500 light-years', constellation:'Carina', facts:[['Hosts','Eta Carinae']], desc:'One of the largest nebulae in the sky, home to the unstable, hugely massive star Eta Carinae.', catalog:'NGC 3372' },
          hans: { type:'发射星云', distance:'约 7,500 光年', constellation:'船底座', facts:[['包含','海山二']], desc:'天空中最大的星云之一,栖身着极不稳定、质量巨大的恒星海山二。', catalog:'NGC 3372' },
          hant: { type:'發射星雲', distance:'約 7,500 光年', constellation:'船底座', facts:[['包含','海山二']], desc:'天空中最大的星雲之一,棲身著極不穩定、質量巨大的恆星海山二。', catalog:'NGC 3372' },
          ja:   {"type":"散光星雲","distance":"約7,500光年","constellation":"りゅうこつ座","facts":[["注目の星","りゅうこつ座イータ星"]],"desc":"全天でも最大級の星雲のひとつ。不安定で非常に重い恒星、りゅうこつ座イータ星が潜んでいます。","catalog":"NGC 3372"},
          ko:   {"type":"발광 성운","distance":"약 7,500광년","constellation":"용골자리","facts":[["포함 천체","용골자리 에타"]],"desc":"밤하늘에서 가장 큰 성운 중 하나로, 극도로 불안정하고 질량이 어마어마한 별인 용골자리 에타가 자리하고 있습니다.","catalog":"NGC 3372"} } },
      { p: galPos(71.3, 3.1, 7.2),
        t: { en: ['Cygnus X-1'], hans: ['天鹅座 X-1'], hant: ['天鵝座 X-1'], ja: ["はくちょう座X-1"], ko: ["백조자리 X-1"] },
        info: {
          en:   { type:'Stellar black hole', distance:'~7,000 light-years', constellation:'Cygnus', facts:[['Black hole','~21 M☉'],['System','X-ray binary']], desc:'The first object widely accepted as a black hole, pulling gas from a blue supergiant companion.', catalog:'Cyg X-1' },
          hans: { type:'恒星级黑洞', distance:'约 7,000 光年', constellation:'天鹅座', facts:[['黑洞','约 21 倍太阳质量'],['系统','X 射线双星']], desc:'第一个被广泛承认的黑洞,正从一颗蓝超巨星伴星吸积气体。', catalog:'Cyg X-1' },
          hant: { type:'恆星級黑洞', distance:'約 7,000 光年', constellation:'天鵝座', facts:[['黑洞','約 21 倍太陽質量'],['系統','X 射線雙星']], desc:'第一個被廣泛承認的黑洞,正從一顆藍超巨星伴星吸積氣體。', catalog:'Cyg X-1' },
          ja:   {"type":"恒星質量ブラックホール","distance":"約7,000光年","constellation":"はくちょう座","facts":[["ブラックホール","太陽の約21倍"],["連星系","X線連星"]],"desc":"ブラックホールとして初めて広く認められた天体。青色超巨星の伴星からガスを吸い込み続けています。","catalog":"Cyg X-1"},
          ko:   {"type":"항성 질량 블랙홀","distance":"약 7,000광년","constellation":"백조자리","facts":[["블랙홀","태양 질량의 약 21배"],["형태","X선 쌍성"]],"desc":"블랙홀로 널리 인정받은 최초의 천체로, 동반성인 청색 초거성에서 가스를 끌어당기고 있습니다.","catalog":"Cyg X-1"} } },
      { p: galPos(166.6, -23.5, 0.444),
        t: { en: ['Pleiades'], hans: ['昴星团'], hant: ['昴星團'], ja: ["プレアデス星団"], ko: ["플레이아데스 성단"] },
        info: {
          en:   { type:'Open cluster', distance:'~440 light-years', constellation:'Taurus', facts:[['Stars','1,000+'],['Age','~100 million yr']], desc:'The naked-eye “Seven Sisters” — hot blue stars still wrapped in wisps of reflection nebulosity.', catalog:'M45' },
          hans: { type:'疏散星团', distance:'约 440 光年', constellation:'金牛座', facts:[['恒星','1000+ 颗'],['年龄','约 1 亿年']], desc:'肉眼可见的“七姐妹”,炽热的蓝色恒星仍笼罩在反射星云的薄纱中。', catalog:'M45' },
          hant: { type:'疏散星團', distance:'約 440 光年', constellation:'金牛座', facts:[['恆星','1000+ 顆'],['年齡','約 1 億年']], desc:'肉眼可見的「七姐妹」,熾熱的藍色恆星仍籠罩在反射星雲的薄紗中。', catalog:'M45' },
          ja:   {"type":"散開星団","distance":"約440光年","constellation":"おうし座","facts":[["恒星","1,000個以上"],["年齢","約1億年"]],"desc":"肉眼でも見える「セブン・シスターズ」。日本では「すばる」の名で親しまれ、高温の青い星々が今も反射星雲の薄いベールに包まれています。","catalog":"M45"},
          ko:   {"type":"산개 성단","distance":"약 440광년","constellation":"황소자리","facts":[["별","1,000개 이상"],["나이","약 1억 년"]],"desc":"맨눈으로도 보이는 \"일곱 자매\" 별들로, 뜨거운 푸른 별들이 아직 반사 성운의 엷은 베일에 싸여 있습니다.","catalog":"M45"} } },
      { p: galPos(309.1, 15, 17.0),
        t: { en: ['Omega Centauri'], hans: ['半人马 ω'], hant: ['半人馬 ω'], ja: ["ケンタウルス座ω星団"], ko: ["오메가 센타우리"] },
        info: {
          en:   { type:'Globular cluster', distance:'~17,000 light-years', constellation:'Centaurus', facts:[['Stars','~10 million'],['Note','Largest MW globular']], desc:'The Milky Way’s largest globular cluster, possibly the stripped core of a swallowed dwarf galaxy.', catalog:'NGC 5139' },
          hans: { type:'球状星团', distance:'约 17,000 光年', constellation:'半人马座', facts:[['恒星','约 1000 万颗'],['特点','银河系最大球状星团']], desc:'银河系中最大的球状星团,可能是一个被吞并的矮星系残核。', catalog:'NGC 5139' },
          hant: { type:'球狀星團', distance:'約 17,000 光年', constellation:'半人馬座', facts:[['恆星','約 1000 萬顆'],['特點','銀河系最大球狀星團']], desc:'銀河系中最大的球狀星團,可能是一個被吞併的矮星系殘核。', catalog:'NGC 5139' },
          ja:   {"type":"球状星団","distance":"約17,000光年","constellation":"ケンタウルス座","facts":[["恒星","約1,000万個"],["特徴","銀河系最大の球状星団"]],"desc":"天の川銀河で最大の球状星団。かつて飲み込まれた矮小銀河の中心核の名残かもしれません。","catalog":"NGC 5139"},
          ko:   {"type":"구상 성단","distance":"약 17,000광년","constellation":"센타우루스자리","facts":[["별","약 1,000만 개"],["특징","우리은하 최대의 구상 성단"]],"desc":"우리은하에서 가장 큰 구상 성단으로, 은하에 삼켜진 왜소은하의 중심핵만 남은 것일 가능성도 있습니다.","catalog":"NGC 5139"} } },
      { p: galPos(199.8, -9, 0.55), cls: 'up',
        t: { en: ['Betelgeuse'], hans: ['参宿四'], hant: ['參宿四'], ja: ["ベテルギウス"], ko: ["베텔게우스"] },
        info: {
          en:   { type:'Red supergiant', distance:'~550 light-years', constellation:'Orion', facts:[['Diameter','~700× Sun'],['Fate','Future supernova']], desc:'The red star on Orion’s shoulder — so vast it would swallow the inner planets, and destined to explode.', catalog:'α Ori' },
          hans: { type:'红超巨星', distance:'约 550 光年', constellation:'猎户座', facts:[['直径','约太阳的 700 倍'],['归宿','未来的超新星']], desc:'猎户座“肩头”的红色恒星,大到能吞下内太阳系行星,终将爆发为超新星。', catalog:'α Ori' },
          hant: { type:'紅超巨星', distance:'約 550 光年', constellation:'獵戶座', facts:[['直徑','約太陽的 700 倍'],['歸宿','未來的超新星']], desc:'獵戶座「肩頭」的紅色恆星,大到能吞下內太陽系行星,終將爆發為超新星。', catalog:'α Ori' },
          ja:   {"type":"赤色超巨星","distance":"約550光年","constellation":"オリオン座","facts":[["直径","太陽の約700倍"],["運命","将来の超新星"]],"desc":"オリオンの肩に輝く赤い星。太陽系の内側の惑星を飲み込むほど巨大で、やがて超新星爆発を起こす運命にあります。","catalog":"α Ori"},
          ko:   {"type":"적색 초거성","distance":"약 550광년","constellation":"오리온자리","facts":[["지름","태양의 약 700배"],["운명","미래의 초신성"]],"desc":"오리온의 어깨에서 빛나는 붉은 별로, 태양계 안쪽 행성들을 통째로 삼킬 만큼 거대하며 언젠가 초신성으로 폭발할 운명입니다.","catalog":"α Ori"} } },
      { p: galPos(74, -8.5, 2.4),
        t: { en: ['Veil Nebula'], hans: ['面纱星云'], hant: ['面紗星雲'], ja: ["網状星雲"], ko: ["면사포 성운"] },
        info: {
          en:   { type:'Supernova remnant', distance:'~2,400 light-years', constellation:'Cygnus', facts:[['Age','~10,000 yr'],['Form','Filamentary shell']], desc:'The delicate, lacework filaments of a supernova that detonated about 10,000 years ago.', catalog:'NGC 6960' },
          hans: { type:'超新星遗迹', distance:'约 2,400 光年', constellation:'天鹅座', facts:[['年龄','约 1 万年'],['形态','丝缕状壳层']], desc:'约 1 万年前爆发的超新星,留下如蕾丝般纤细的气体丝缕。', catalog:'NGC 6960' },
          hant: { type:'超新星遺跡', distance:'約 2,400 光年', constellation:'天鵝座', facts:[['年齡','約 1 萬年'],['形態','絲縷狀殼層']], desc:'約 1 萬年前爆發的超新星,留下如蕾絲般纖細的氣體絲縷。', catalog:'NGC 6960' },
          ja:   {"type":"超新星残骸","distance":"約2,400光年","constellation":"はくちょう座","facts":[["年齢","約1万年"],["形状","フィラメント状の殻"]],"desc":"約1万年前に爆発した超新星が残した、レース細工のように繊細なガスのフィラメントです。","catalog":"NGC 6960"},
          ko:   {"type":"초신성 잔해","distance":"약 2,400광년","constellation":"백조자리","facts":[["나이","약 1만 년"],["형태","필라멘트 모양의 껍질"]],"desc":"약 1만 년 전에 폭발한 초신성이 남긴, 레이스처럼 섬세한 가스 필라멘트입니다.","catalog":"NGC 6960"} } },
      { p: galPos(6, -1.2, 4.1),
        t: { en: ['Lagoon Nebula'], hans: ['礁湖星云'], hant: ['礁湖星雲'], ja: ["干潟星雲"], ko: ["석호 성운"] },
        info: {
          en:   { type:'Emission nebula', distance:'~4,100 light-years', constellation:'Sagittarius', facts:[['Type','Star-forming region'],['Catalog','M8']], desc:'A vast, bright stellar nursery toward the galactic centre.', catalog:'M8' },
          hans: { type:'发射星云', distance:'约 4,100 光年', constellation:'人马座', facts:[['类型','恒星形成区'],['星表','M8']], desc:'朝银心方向的一片巨大明亮的恒星摇篮。', catalog:'M8' },
          hant: { type:'發射星雲', distance:'約 4,100 光年', constellation:'人馬座', facts:[['類型','恆星形成區'],['星表','M8']], desc:'朝銀心方向的一片巨大明亮的恆星搖籃。', catalog:'M8' },
          ja:   {"type":"散光星雲","distance":"約4,100光年","constellation":"いて座","facts":[["種類","星形成領域"],["カタログ","M8"]],"desc":"銀河系の中心方向に広がる、巨大で明るい星のゆりかごです。","catalog":"M8"},
          ko:   {"type":"발광 성운","distance":"약 4,100광년","constellation":"궁수자리","facts":[["유형","별 형성 지역"],["목록","M8"]],"desc":"은하 중심 방향에 펼쳐진 광대하고 밝은 별들의 요람입니다.","catalog":"M8"} } },
      { p: galPos(59, 40.9, 22.2), // halo globular — genuinely ~100u above the disc plane
        t: { en: ['Hercules Cluster'], hans: ['武仙座大星团'], hant: ['武仙座大星團'], ja: ["ヘルクレス座球状星団"], ko: ["헤르쿨레스 대성단"] },
        info: {
          en:   { type:'Globular cluster', distance:'~22,000 light-years', constellation:'Hercules', facts:[['Stars','~300,000'],['Age','~11.6 billion yr']], desc:'A brilliant northern globular of several hundred thousand ancient stars.', catalog:'M13' },
          hans: { type:'球状星团', distance:'约 22,000 光年', constellation:'武仙座', facts:[['恒星','约 30 万颗'],['年龄','约 116 亿年']], desc:'北天一个由数十万颗古老恒星组成的明亮球状星团。', catalog:'M13' },
          hant: { type:'球狀星團', distance:'約 22,000 光年', constellation:'武仙座', facts:[['恆星','約 30 萬顆'],['年齡','約 116 億年']], desc:'北天一個由數十萬顆古老恆星組成的明亮球狀星團。', catalog:'M13' },
          ja:   {"type":"球状星団","distance":"約22,000光年","constellation":"ヘルクレス座","facts":[["恒星","約30万個"],["年齢","約116億年"]],"desc":"数十万個の年老いた星々からなる、北天に輝く見事な球状星団です。","catalog":"M13"},
          ko:   {"type":"구상 성단","distance":"약 22,000광년","constellation":"헤르쿨레스자리","facts":[["별","약 30만 개"],["나이","약 116억 년"]],"desc":"수십만 개의 늙은 별들이 모여 빛나는 북쪽 하늘의 찬란한 구상 성단입니다.","catalog":"M13"} } },
      { p: galPos(227.2, -8.9, 0.0086), // 8.6 ly — rendered at the display floor beside the Sun
        t: { en: ['Sirius'], hans: ['天狼星'], hant: ['天狼星'], ja: ["シリウス"], ko: ["시리우스"] },
        info: {
          en:   { type:'Binary star', distance:'~8.6 light-years', constellation:'Canis Major', facts:[['Brightness','Brightest in the sky'],['System','Sirius A + B']], desc:"The brightest star in Earth's night sky, a close stellar neighbour.", catalog:'α CMa' },
          hans: { type:'双星', distance:'约 8.6 光年', constellation:'大犬座', facts:[['亮度','全天最亮'],['系统','天狼 A + B']], desc:'地球夜空中最亮的恒星,是离我们很近的邻居。', catalog:'α CMa' },
          hant: { type:'雙星', distance:'約 8.6 光年', constellation:'大犬座', facts:[['亮度','全天最亮'],['系統','天狼 A + B']], desc:'地球夜空中最亮的恆星,是離我們很近的鄰居。', catalog:'α CMa' },
          ja:   {"type":"連星","distance":"約8.6光年","constellation":"おおいぬ座","facts":[["明るさ","全天で最も明るい恒星"],["連星系","シリウスA + B"]],"desc":"地球の夜空で最も明るく輝く恒星で、太陽系のすぐ近くにあるお隣さんです。","catalog":"α CMa"},
          ko:   {"type":"쌍성","distance":"약 8.6광년","constellation":"큰개자리","facts":[["밝기","밤하늘에서 가장 밝음"],["구성","시리우스 A + B"]],"desc":"지구의 밤하늘에서 가장 밝은 별이자, 우리와 아주 가까운 이웃 별입니다.","catalog":"α CMa"} } },
      { p: galPos(351.9, 15.1, 0.55),
        t: { en: ['Antares'], hans: ['心宿二'], hant: ['心宿二'], ja: ["アンタレス"], ko: ["안타레스"] },
        info: {
          en:   { type:'Red supergiant', distance:'~550 light-years', constellation:'Scorpius', facts:[['Diameter','~700× Sun'],['Note','Heart of the Scorpion']], desc:'A blazing red supergiant marking the heart of Scorpius.', catalog:'α Sco' },
          hans: { type:'红超巨星', distance:'约 550 光年', constellation:'天蝎座', facts:[['直径','约太阳的 700 倍'],['别称','天蝎之心']], desc:'标记天蝎座心脏的炽红超巨星。', catalog:'α Sco' },
          hant: { type:'紅超巨星', distance:'約 550 光年', constellation:'天蠍座', facts:[['直徑','約太陽的 700 倍'],['別稱','天蠍之心']], desc:'標記天蠍座心臟的熾紅超巨星。', catalog:'α Sco' },
          ja:   {"type":"赤色超巨星","distance":"約550光年","constellation":"さそり座","facts":[["直径","太陽の約700倍"],["別名","さそりの心臓"]],"desc":"さそり座の心臓部で燃えるように赤く輝く超巨星です。","catalog":"α Sco"},
          ko:   {"type":"적색 초거성","distance":"약 550광년","constellation":"전갈자리","facts":[["지름","태양의 약 700배"],["별칭","전갈의 심장"]],"desc":"전갈자리의 심장 자리에서 타오르는 붉은 초거성입니다.","catalog":"α Sco"} } },
      { p: galPos(63.2, 13.7, 2.6),
        t: {"en":["Ring Nebula (M57)"],"hans":["环状星云（M57）"],"hant":["環狀星雲（M57）"],"ja":["環状星雲（M57）"],"ko":["고리 성운 (M57)"]},
        info: { en:{"type":"Planetary nebula","distance":"~2,600 light-years","constellation":"Lyra","facts":[["Shell age","~7,000 years"],["Central white dwarf","~125,000 K"]],"desc":"This glowing smoke ring is the outer shell of gas gently puffed off by a dying Sun-like star as it ran out of fuel — not the violent blast of a supernova, which only much heavier stars produce. The ring lights up because the star's exposed core, now a tiny, blistering-hot white dwarf near the center, floods it with ultraviolet radiation. It is the classic textbook planetary nebula, a preview of the fate awaiting our own Sun.","catalog":"M57"}, hans:{"type":"行星状星云","distance":"约 2,600 光年","constellation":"天琴座","facts":[["外壳年龄","约 7,000 年"],["中心白矮星","约 125,000 K"]],"desc":"这个发光的“烟圈”是一颗类太阳恒星在燃料耗尽、走向死亡时轻柔抛出的外层气壳，而不是超新星那样的猛烈爆发——后者只有质量大得多的恒星才会经历。星云之所以发光，是因为恒星裸露的内核如今变成中心一颗极其炽热的小白矮星，用紫外辐射照亮了它。这是教科书上经典的行星状星云，也预示着我们太阳未来的归宿。","catalog":"M57"}, hant:{"type":"行星狀星雲","distance":"約 2,600 光年","constellation":"天琴座","facts":[["外殼年齡","約 7,000 年"],["中心白矮星","約 125,000 K"]],"desc":"這個發光的「煙圈」是一顆類太陽恆星在燃料耗盡、邁向死亡時輕柔拋出的外層氣殼，而非超新星那樣的猛烈爆發——後者只有質量大得多的恆星才會經歷。星雲之所以發光，是因為恆星裸露的核心如今變成中心一顆極其熾熱的小白矮星，以紫外輻射照亮了它。這是教科書上經典的行星狀星雲，也預示著我們太陽未來的歸宿。","catalog":"M57"}, ja:{"type":"惑星状星雲","distance":"約2,600光年","constellation":"こと座","facts":[["外殻の年齢","約7,000年"],["中心の白色矮星","約125,000 K"]],"desc":"この輝く煙の輪は、太陽に似た星が燃料を使い果たして死を迎える際に静かに吹き出した外層のガス殻で、超新星のような激しい爆発ではありません——爆発ははるかに重い星だけが起こすものです。星雲が光るのは、むき出しになった星の芯が今や中心にある極めて高温の小さな白色矮星となり、紫外線でガスを照らしているからです。教科書に載る典型的な惑星状星雲であり、私たちの太陽が将来たどる運命の姿でもあります。","catalog":"M57"}, ko:{"type":"행성상성운","distance":"약 2,600광년","constellation":"거문고자리","facts":[["껍질 나이","약 7,000년"],["중심 백색왜성","약 125,000 K"]],"desc":"이 빛나는 연기 고리는 태양과 비슷한 별이 연료를 다 쓰고 죽어가며 부드럽게 벗어던진 바깥쪽 가스 껍질로, 훨씬 무거운 별만 겪는 초신성 폭발과는 다릅니다. 성운이 빛나는 까닭은 별의 드러난 중심핵이 이제 한가운데의 아주 뜨거운 작은 백색왜성이 되어 자외선으로 가스를 밝히기 때문입니다. 교과서에 나오는 전형적인 행성상성운이자, 우리 태양이 맞이할 미래의 모습이기도 합니다.","catalog":"M57"} } },
      { p: galPos(36.2, -57.1, 0.65),
        t: {"en":["Helix Nebula"],"hans":["螺旋星云"],"hant":["螺旋星雲"],"ja":["らせん星雲"],"ko":["나선 성운"]},
        info: { en:{"type":"Planetary nebula","distance":"~650 light-years","constellation":"Aquarius","facts":[["Nickname","Eye of God"],["Diameter","~2.5 light-years"]],"desc":"One of the closest planetary nebulae to Earth, the Helix is a nearby preview of how our own Sun will die. As a Sun-like star sheds its outer layers, it leaves nested glowing shells around a hot white-dwarf core — the source of its \"Eye of God\" look. Its proximity lets us see thousands of cometary knots, finger-like clumps of gas each larger than our solar system.","catalog":"NGC 7293"}, hans:{"type":"行星状星云","distance":"约 650 光年","constellation":"宝瓶座","facts":[["别称","上帝之眼"],["直径","约 2.5 光年"]],"desc":"螺旋星云是距地球最近的行星状星云之一，为我们预览了太阳临终时的景象。当类太阳恒星抛射外层物质，便在灼热的白矮星核心周围留下层层发光的壳层，造就了“上帝之眼”的模样。因距离近，我们能看到成千上万个“彗星状结节”——每个手指状的气体团块都比整个太阳系还大。","catalog":"NGC 7293"}, hant:{"type":"行星狀星雲","distance":"約 650 光年","constellation":"寶瓶座","facts":[["別稱","上帝之眼"],["直徑","約 2.5 光年"]],"desc":"螺旋星雲是距地球最近的行星狀星雲之一，為我們預覽了太陽臨終時的景象。當類太陽恆星拋射外層物質，便在灼熱的白矮星核心周圍留下層層發光的殼層，造就了「上帝之眼」的模樣。因距離近，我們能看到成千上萬個「彗星狀結節」——每個手指狀的氣體團塊都比整個太陽系還大。","catalog":"NGC 7293"}, ja:{"type":"惑星状星雲","distance":"約650光年","constellation":"みずがめ座","facts":[["別名","神の目（Eye of God）"],["直径","約2.5光年"]],"desc":"らせん星雲は地球に最も近い惑星状星雲の一つで、太陽のような星の最期を間近で見せてくれます。太陽型の星が外層を放出すると、高温の白色矮星を中心に何層もの輝くガスの殻が残り、「神の目」と呼ばれる姿を作ります。近いため、太陽系よりも大きな指状のガスの塊「彗星状ノット」が何千も見えます。","catalog":"NGC 7293"}, ko:{"type":"행성상성운","distance":"약 650광년","constellation":"물병자리","facts":[["별칭","신의 눈(Eye of God)"],["지름","약 2.5광년"]],"desc":"나선 성운은 지구에서 가장 가까운 행성상성운 중 하나로, 태양과 같은 별의 죽음을 가까이서 보여줍니다. 태양형 별이 바깥층을 내뿜으면 뜨거운 백색왜성 핵을 중심으로 여러 겹의 빛나는 껍질이 남아 ‘신의 눈’이라 불리는 모습을 만듭니다. 가까운 덕분에 태양계보다 큰 손가락 모양의 가스 덩어리인 ‘혜성상 매듭’ 수천 개를 볼 수 있습니다.","catalog":"NGC 7293"} } },
      { p: galPos(206.9, -16.8, 1.4),
        t: {"en":["Horsehead Nebula (Barnard 33)"],"hans":["马头星云（巴纳德33）"],"hant":["馬頭星雲（巴納德33）"],"ja":["馬頭星雲（バーナード33）"],"ko":["말머리성운 (바너드 33)"]},
        info: { en:{"type":"Dark nebula (absorption)","distance":"~1,400 light-years","constellation":"Orion","facts":[["Silhouette width","~3.5 light-years"],["Glowing backdrop","IC 434 (emission nebula)"]],"desc":"The Horsehead is a dark, or absorption, nebula: a cold, dense cloud of dust so thick it blots out the light behind it, appearing as a black silhouette against the red glow of emission nebula IC 434. Unlike an emission nebula (gas made to glow) or a reflection nebula (dust scattering starlight blue), a dark nebula reveals itself only by the light it hides. Inside these frigid clouds, the gas and dust are the raw material from which new stars will one day form.","catalog":"Barnard 33"}, hans:{"type":"暗星云（吸收星云）","distance":"约 1,400 光年","constellation":"猎户座","facts":[["剪影宽度","约 3.5 光年"],["背后辉光","IC 434（发射星云）"]],"desc":"马头星云是一片暗星云（吸收星云）：由寒冷致密的尘埃组成，浓厚到足以遮住背后的光，在发射星云 IC 434 的红色辉光衬托下显出漆黑的剪影。与自身发光的发射星云、以及散射星光呈蓝色的反射星云不同，暗星云只能靠它所遮挡的光来显现。这些冰冷云团中的气体与尘埃，正是未来孕育新恒星的原材料。","catalog":"Barnard 33"}, hant:{"type":"暗星雲（吸收星雲）","distance":"約 1,400 光年","constellation":"獵戶座","facts":[["剪影寬度","約 3.5 光年"],["背後輝光","IC 434（發射星雲）"]],"desc":"馬頭星雲是一片暗星雲（吸收星雲）：由寒冷緻密的塵埃組成，濃厚到足以遮住背後的光，在發射星雲 IC 434 的紅色輝光襯托下顯出漆黑的剪影。與自身發光的發射星雲、以及散射星光呈藍色的反射星雲不同，暗星雲只能靠它所遮擋的光來顯現。這些冰冷雲團中的氣體與塵埃，正是未來孕育新恆星的原料。","catalog":"Barnard 33"}, ja:{"type":"暗黒星雲（吸収星雲）","distance":"約1,400光年","constellation":"オリオン座","facts":[["シルエットの幅","約3.5光年"],["背景の輝き","IC 434（輝線星雲）"]],"desc":"馬頭星雲は暗黒星雲（吸収星雲）で、冷たく濃密な塵の雲が背後の光を遮るほど厚く、輝線星雲 IC 434 の赤い輝きを背景に黒いシルエットとして浮かび上がります。自ら輝く輝線星雲や、星の光を青く散乱させる反射星雲とは異なり、暗黒星雲は自らが隠す光によってのみ姿を現します。この冷たい雲の中のガスと塵は、やがて新しい星を生み出す材料なのです。","catalog":"Barnard 33"}, ko:{"type":"암흑성운 (흡수성운)","distance":"약 1,400광년","constellation":"오리온자리","facts":[["실루엣 폭","약 3.5광년"],["뒤편 발광원","IC 434 (발광성운)"]],"desc":"말머리성운은 암흑성운(흡수성운)으로, 차갑고 밀도 높은 먼지 구름이 뒤쪽 빛을 가릴 만큼 짙어 발광성운 IC 434의 붉은 빛을 배경으로 검은 실루엣처럼 떠오릅니다. 스스로 빛나는 발광성운이나 별빛을 파랗게 산란시키는 반사성운과 달리, 암흑성운은 자신이 가리는 빛으로만 모습을 드러냅니다. 이 차가운 구름 속 가스와 먼지는 언젠가 새로운 별을 탄생시킬 재료입니다.","catalog":"Barnard 33"} } },
      { p: galPos(65, -27.3, 33),
        t: {"en":["Messier 15"],"hans":["梅西耶15"],"hant":["梅西爾15"],"ja":["メシエ15"],"ko":["메시에 15"]},
        info: { en:{"type":"Globular cluster (core-collapsed)","distance":"~33,600 light-years","constellation":"Pegasus","facts":[["Stars","hundreds of thousands"],["Age","~12 billion years"]],"desc":"Messier 15 is one of the densest globular clusters known: its core has collapsed inward, packing hundreds of thousands of ancient stars into a tight ball. Those stars are roughly 12 billion years old, survivors from the early universe. Like all globulars, M15 belongs to the Milky Way's halo, orbiting far above the flat disc of the galaxy.","catalog":"M15"}, hans:{"type":"球状星团（核心塌缩）","distance":"约 33,600 光年","constellation":"飞马座","facts":[["恒星数量","数十万颗"],["年龄","约 120 亿年"]],"desc":"梅西耶15是已知密度最高的球状星团之一——它的核心已经塌缩，将数十万颗古老恒星紧紧聚集成一个致密的球体。这些恒星年龄约 120 亿年，是宇宙早期遗留至今的幸存者。像所有球状星团一样，M15 属于银河系的银晕，运行在银盘平面之上很高的地方。","catalog":"M15"}, hant:{"type":"球狀星團（核心塌縮）","distance":"約 33,600 光年","constellation":"飛馬座","facts":[["恆星數量","數十萬顆"],["年齡","約 120 億年"]],"desc":"梅西爾15是已知密度最高的球狀星團之一——它的核心已經塌縮，將數十萬顆古老恆星緊緊聚集成一個緻密的球體。這些恆星年齡約 120 億年，是宇宙早期遺留至今的倖存者。如同所有球狀星團，M15 屬於銀河系的銀暈，運行在銀盤平面之上很高的地方。","catalog":"M15"}, ja:{"type":"球状星団（コア崩壊型）","distance":"約 33,600 光年","constellation":"ペガスス座","facts":[["星の数","数十万個"],["年齢","約 120 億年"]],"desc":"メシエ15は、知られている中で最も高密度な球状星団の一つで、中心部が収縮（コア崩壊）し、数十万個もの古い星が密集しています。これらの星は約 120 億年前に生まれ、宇宙初期からの生き残りです。すべての球状星団と同じく、M15 は銀河系のハローに属し、円盤面のはるか上空を公転しています。","catalog":"M15"}, ko:{"type":"구상성단(코어 붕괴형)","distance":"약 33,600광년","constellation":"페가수스자리","facts":[["별의 수","수십만 개"],["나이","약 120억 년"]],"desc":"메시에 15는 알려진 것 중 가장 밀도가 높은 구상성단의 하나로, 중심핵이 붕괴(코어 붕괴)하여 수십만 개의 오래된 별이 촘촘히 뭉쳐 있습니다. 이 별들은 약 120억 년 전에 태어난, 초기 우주의 생존자입니다. 모든 구상성단처럼 M15도 은하 헤일로에 속하며, 은하 원반면 훨씬 위쪽을 공전합니다.","catalog":"M15"} } },
      { p: galPos(3.9, 46.8, 24.5),
        t: {"en":["Messier 5"],"hans":["梅西耶5"],"hant":["梅西耶5"],"ja":["メシエ5"],"ko":["메시에 5"]},
        info: { en:{"type":"Globular cluster","distance":"~24,500 light-years","constellation":"Serpens","facts":[["Age","~13 billion years"],["Stars","hundreds of thousands"]],"desc":"Messier 5 is one of the oldest and largest globular clusters in our galaxy, having formed roughly 13 billion years ago in the early universe. Hundreds of thousands of ancient stars are packed into a near-perfect sphere by their mutual gravity. Clusters like this orbit far out in the Milky Way's halo, preserving some of the oldest stars we can see.","catalog":"M5"}, hans:{"type":"球状星团","distance":"约 24,500 光年","constellation":"巨蛇座","facts":[["年龄","约 130 亿年"],["恒星数量","数十万颗"]],"desc":"梅西耶5是银河系中最古老、最庞大的球状星团之一，约在130亿年前的早期宇宙中形成。数十万颗古老恒星在彼此的引力作用下聚成一个近乎完美的球体。这类星团在银河系的银晕中远远地环绕运行，保存着我们所能观测到的一些最古老的恒星。","catalog":"M5"}, hant:{"type":"球狀星團","distance":"約 24,500 光年","constellation":"巨蛇座","facts":[["年齡","約 130 億年"],["恆星數量","數十萬顆"]],"desc":"梅西耶5是銀河系中最古老、最龐大的球狀星團之一，約在130億年前的早期宇宙中形成。數十萬顆古老恆星在彼此的引力作用下聚成一個近乎完美的球體。這類星團在銀河系的銀暈中遠遠地環繞運行，保存著我們所能觀測到的一些最古老的恆星。","catalog":"M5"}, ja:{"type":"球状星団","distance":"約24,500光年","constellation":"へび座","facts":[["年齢","約130億年"],["恒星の数","数十万個"]],"desc":"メシエ5は、私たちの銀河系で最も古く、最も大きな球状星団の一つで、約130億年前の初期宇宙で誕生しました。数十万個もの古い星々が、互いの重力によってほぼ完全な球状に密集しています。こうした星団は銀河系のハローの遠方を周回し、観測できる最古の星々を今に伝えています。","catalog":"M5"}, ko:{"type":"구상성단","distance":"약 24,500광년","constellation":"뱀자리","facts":[["나이","약 130억 년"],["별의 수","수십만 개"]],"desc":"메시에 5는 우리 은하에서 가장 오래되고 가장 큰 구상성단 중 하나로, 약 130억 년 전 초기 우주에서 형성되었습니다. 수십만 개의 늙은 별들이 서로의 중력으로 거의 완벽한 구형을 이루며 빽빽하게 모여 있습니다. 이런 성단은 은하 헤일로의 먼 바깥을 공전하며, 우리가 볼 수 있는 가장 오래된 별들을 간직하고 있습니다.","catalog":"M5"} } },
      { p: galPos(9.9, -7.6, 10.4),
        t: {"en":["Messier 22"],"hans":["梅西耶22"],"hant":["梅西爾22"],"ja":["メシエ22"],"ko":["메시에 22"]},
        info: { en:{"type":"Globular cluster","distance":"~10,400 light-years","constellation":"Sagittarius","facts":[["Apparent magnitude","~5.1 (naked-eye)"],["Apparent size","~32' (about the full Moon)"]],"desc":"Messier 22 is one of the nearest and brightest globular clusters, lying only about 10,400 light-years away toward the crowded galactic bulge in Sagittarius. Under dark skies it is bright enough to glimpse with the naked eye as a faint fuzzy patch, and binoculars begin to resolve its swarm of tens of thousands of stars. Its low position near the Milky Way's center makes it a standout target when Sagittarius climbs the summer sky.","catalog":"M22"}, hans:{"type":"球状星团","distance":"约 10,400 光年","constellation":"人马座","facts":[["视星等","约 5.1（肉眼可见）"],["视直径","约 32′（约等于满月）"]],"desc":"梅西耶22是距离最近、也最明亮的球状星团之一，位于人马座方向、朝向拥挤的银河系核球，距地球仅约10,400光年。在黑暗的夜空下，它亮到肉眼即可看见，呈一小团朦胧的光斑，用双筒望远镜便能开始分辨出其中成千上万颗恒星。夏季人马座升起时，它靠近银河中心的位置使其成为引人注目的观测目标。","catalog":"M22"}, hant:{"type":"球狀星團","distance":"約 10,400 光年","constellation":"人馬座","facts":[["視星等","約 5.1（肉眼可見）"],["視直徑","約 32′（約等於滿月）"]],"desc":"梅西爾22是距離最近、也最明亮的球狀星團之一，位於人馬座方向、朝向擁擠的銀河系核球，距地球僅約10,400光年。在黑暗的夜空下，它亮到肉眼即可看見，呈一小團朦朧的光斑，用雙筒望遠鏡便能開始分辨出其中成千上萬顆恆星。夏季人馬座升起時，它靠近銀河中心的位置使其成為引人注目的觀測目標。","catalog":"M22"}, ja:{"type":"球状星団","distance":"約10,400光年","constellation":"いて座","facts":[["視等級","約5.1（肉眼で見える）"],["視直径","約32′（ほぼ満月大）"]],"desc":"メシエ22は、最も近く明るい球状星団の一つで、いて座の方向、混み合った銀河系のバルジへ向かって約10,400光年の距離にあります。暗い空の下では肉眼でもぼんやりとした光の塊として見えるほど明るく、双眼鏡を使えば数万個もの星が一つ一つ分かれて見え始めます。夏にいて座が昇るころ、銀河中心近くに位置するこの星団は見応えのある観測対象となります。","catalog":"M22"}, ko:{"type":"구상성단","distance":"약 10,400광년","constellation":"궁수자리","facts":[["겉보기 등급","약 5.1 (맨눈 관측 가능)"],["겉보기 크기","약 32′ (보름달과 비슷)"]],"desc":"메시에 22는 가장 가깝고 밝은 구상성단 가운데 하나로, 궁수자리 방향으로 붐비는 은하 팽대부를 향해 약 10,400광년 거리에 있습니다. 어두운 하늘에서는 맨눈으로도 흐릿한 빛 무리로 보일 만큼 밝으며, 쌍안경으로 보면 수만 개의 별이 하나하나 분해되어 보이기 시작합니다. 여름철 궁수자리가 떠오를 때 은하 중심 근처에 자리한 이 성단은 인상적인 관측 대상이 됩니다.","catalog":"M22"} } },
      { p: galPos(123.3, 26.5, 0.433),
        t: {"en":["Polaris"],"hans":["北极星"],"hant":["北極星"],"ja":["北極星"],"ko":["북극성"]},
        info: { en:{"type":"Cepheid variable star","distance":"~433 light-years","constellation":"Ursa Minor","facts":[["Pulsation period","~3.97 days"],["Offset from celestial pole","~0.7°"]],"desc":"Polaris is a Cepheid variable — a pulsating star that brightens and dims on a strict clock. Because a Cepheid's pulsation period is tied to its true luminosity, comparing that intrinsic brightness with how bright it appears reveals its distance, making Cepheids a key rung of the cosmic distance ladder. Polaris also sits within about 0.7° of the north celestial pole, so it barely moves through the night and has guided navigators north for centuries.","catalog":"α UMi"}, hans:{"type":"造父变星","distance":"约 433 光年","constellation":"小熊座","facts":[["脉动周期","约 3.97 天"],["距天北极","约 0.7°"]],"desc":"北极星是一颗造父变星——一种按精确节律明暗交替的脉动恒星。造父变星的脉动周期与其真实光度直接相关，把这一内禀亮度与它看起来的亮度比较，便可推算距离，因此造父变星是宇宙距离阶梯的关键一级。北极星距天北极仅约 0.7°，整夜几乎不动，数百年来一直为航海者指示正北方向。","catalog":"α UMi"}, hant:{"type":"造父變星","distance":"約 433 光年","constellation":"小熊座","facts":[["脈動週期","約 3.97 天"],["距天北極","約 0.7°"]],"desc":"北極星是一顆造父變星——一種按精確節律明暗交替的脈動恆星。造父變星的脈動週期與其真實光度直接相關，把這一內稟亮度與它看起來的亮度比較，便可推算距離，因此造父變星是宇宙距離階梯的關鍵一級。北極星距天北極僅約 0.7°，整夜幾乎不動，數百年來一直為航海者指示正北方向。","catalog":"α UMi"}, ja:{"type":"ケフェイド変光星","distance":"約433光年","constellation":"こぐま座","facts":[["脈動周期","約3.97日"],["天の北極からの距離","約0.7°"]],"desc":"北極星はケフェイド変光星——正確な周期で明るさが変わる脈動星です。ケフェイド変光星は脈動周期が真の光度と結びついているため、その本来の明るさと見かけの明るさを比べれば距離がわかり、宇宙の距離はしごの重要な一段となります。北極星は天の北極から約0.7°しか離れておらず、一晩中ほとんど動かないため、何世紀にもわたって航海者に北を示してきました。","catalog":"α UMi"}, ko:{"type":"세페이드 변광성","distance":"약 433광년","constellation":"작은곰자리","facts":[["맥동 주기","약 3.97일"],["천구 북극과의 거리","약 0.7°"]],"desc":"북극성은 세페이드 변광성으로, 정확한 주기로 밝아졌다 어두워지는 맥동성입니다. 세페이드 변광성은 맥동 주기가 실제 광도와 연결되어 있어, 이 고유 밝기와 겉보기 밝기를 비교하면 거리를 알 수 있으므로 우주 거리 사다리의 핵심 단계가 됩니다. 북극성은 천구 북극에서 약 0.7°밖에 떨어져 있지 않아 밤새 거의 움직이지 않으며, 수 세기 동안 항해자에게 북쪽을 알려 왔습니다.","catalog":"α UMi"} } },
      { p: galPos(313.9, -1.9, 0.0042),
        t: {"en":["Proxima Centauri"],"hans":["比邻星"],"hant":["比鄰星"],"ja":["プロキシマ・ケンタウリ"],"ko":["프록시마 센타우리"]},
        info: { en:{"type":"Red dwarf (flare star)","distance":"~4.24 light-years","constellation":"Centaurus","facts":[["Proxima b mass","~1.1 Earth masses"],["Spectral type","M5.5Ve (red dwarf)"]],"desc":"Proxima Centauri is the closest star to the Sun, a small, cool red dwarf prone to violent flares that can briefly make it dozens of times brighter. Despite its faintness, it hosts Proxima b, a roughly Earth-mass planet orbiting in the habitable zone. This makes it both our nearest stellar neighbour and the site of the nearest known exoplanet.","catalog":"α Cen C"}, hans:{"type":"红矮星（耀星）","distance":"约 4.24 光年","constellation":"半人马座","facts":[["比邻星b质量","约 1.1 个地球质量"],["光谱型","M5.5Ve（红矮星）"]],"desc":"比邻星是距离太阳最近的恒星，一颗又小又冷的红矮星，常常爆发猛烈的耀斑，能在短时间内让自身亮度骤增数十倍。尽管它十分暗弱，却拥有一颗行星比邻星b，其质量约与地球相当，且运行在宜居带内。因此，它既是离我们最近的恒星邻居，也是已知最近的系外行星所在之处。","catalog":"α Cen C"}, hant:{"type":"紅矮星（耀星）","distance":"約 4.24 光年","constellation":"半人馬座","facts":[["比鄰星b質量","約 1.1 個地球質量"],["光譜型","M5.5Ve（紅矮星）"]],"desc":"比鄰星是距離太陽最近的恆星，一顆又小又冷的紅矮星，常常爆發猛烈的閃焰，能在短時間內讓自身亮度驟增數十倍。儘管它十分暗弱，卻擁有一顆行星比鄰星b，其質量約與地球相當，且運行在適居帶內。因此，它既是離我們最近的恆星鄰居，也是已知最近的系外行星所在之處。","catalog":"α Cen C"}, ja:{"type":"赤色矮星（閃光星）","distance":"約4.24光年","constellation":"ケンタウルス座","facts":[["プロキシマbの質量","地球の約1.1倍"],["スペクトル型","M5.5Ve（赤色矮星）"]],"desc":"プロキシマ・ケンタウリは太陽に最も近い恒星で、小さく低温の赤色矮星で、激しいフレアを頻繁に起こし、短時間で自らの明るさが数十倍に跳ね上がることがあります。暗い星ですが、地球ほどの質量をもつ惑星プロキシマbがハビタブルゾーンを公転しています。そのため、太陽系で最も近い恒星であると同時に、最も近い既知の系外惑星が存在する場所でもあります。","catalog":"α Cen C"}, ko:{"type":"적색왜성(섬광성)","distance":"약 4.24광년","constellation":"센타우루스자리","facts":[["프록시마 b 질량","지구의 약 1.1배"],["분광형","M5.5Ve(적색왜성)"]],"desc":"프록시마 센타우리는 태양에서 가장 가까운 별로, 작고 차가운 적색왜성으로, 격렬한 플레어를 자주 일으켜 잠깐 사이에 밝기가 수십 배로 치솟기도 합니다. 어두운 별임에도 지구와 질량이 비슷한 행성 프록시마 b가 생명체 거주가능 영역을 공전하고 있습니다. 덕분에 가장 가까운 항성 이웃이자 가장 가까운 알려진 외계행성의 보금자리이기도 합니다.","catalog":"α Cen C"} } },
      { p: galPos(19.1, -0.5, 5.1),
        t: {"en":["UY Scuti"],"hans":["盾牌座UY"],"hant":["盾牌座UY"],"ja":["たて座UY星"],"ko":["방패자리 UY"]},
        info: { en:{"type":"Red hypergiant","distance":"~5,100 light-years","constellation":"Scutum","facts":[["Radius","~750× the Sun (Gaia-revised)"],["Volume","~400 million Suns"]],"desc":"UY Scuti is a colossal red hypergiant roughly 750 times wider than the Sun. If it replaced the Sun at the center of our solar system, its glowing surface would engulf the orbits of Mercury, Venus, Earth, and Mars. It was long billed as the largest star known, until Gaia's sharper distance measurement trimmed its estimated size.","catalog":"UY Sct"}, hans:{"type":"红特超巨星","distance":"约 5,100 光年","constellation":"盾牌座","facts":[["半径","约为太阳的 750 倍（依 Gaia 修订）"],["体积","约 4 亿个太阳"]],"desc":"盾牌座UY是一颗巨大的红特超巨星，直径约为太阳的 750 倍。如果把它放在太阳的位置，它炙热的表面会吞没水星、金星、地球和火星的轨道。它曾长期被称为已知最大的恒星，直到盖亚卫星更精确的距离测量将其估算尺寸下调。","catalog":"UY Sct"}, hant:{"type":"紅特超巨星","distance":"約 5,100 光年","constellation":"盾牌座","facts":[["半徑","約為太陽的 750 倍（依 Gaia 修訂）"],["體積","約 4 億個太陽"]],"desc":"盾牌座UY是一顆巨大的紅特超巨星，直徑約為太陽的 750 倍。如果把它放在太陽的位置，它熾熱的表面會吞沒水星、金星、地球和火星的軌道。它曾長期被稱為已知最大的恆星，直到蓋亞衛星更精確的距離測量將其估算尺寸下調。","catalog":"UY Sct"}, ja:{"type":"赤色極超巨星","distance":"約5,100光年","constellation":"たて座","facts":[["半径","太陽の約750倍（Gaia改訂値）"],["体積","太陽約4億個分"]],"desc":"たて座UY星は太陽の約750倍もの大きさをもつ巨大な赤色極超巨星です。もし太陽の位置に置けば、その輝く表面は水星・金星・地球・火星の軌道まで飲み込んでしまいます。長らく既知最大の恒星とされてきましたが、ガイア衛星のより精密な距離測定により、推定サイズは下方修正されました。","catalog":"UY Sct"}, ko:{"type":"적색 극대거성","distance":"약 5,100광년","constellation":"방패자리","facts":[["반지름","태양의 약 750배 (가이아 수정값)"],["부피","태양 약 4억 개"]],"desc":"방패자리 UY는 지름이 태양의 약 750배에 이르는 거대한 적색 극대거성입니다. 만약 태양 자리에 놓는다면 그 이글거리는 표면이 수성, 금성, 지구, 화성의 궤도까지 삼켜 버립니다. 오랫동안 알려진 가장 큰 별로 불렸지만, 가이아 위성의 더 정밀한 거리 측정으로 추정 크기가 하향 조정되었습니다.","catalog":"UY Sct"} } },
      { p: galPos(69.7, -56.6, 0.0409),
        t: {"en":["TRAPPIST-1"],"hans":["TRAPPIST-1"],"hant":["TRAPPIST-1"],"ja":["トラピスト1"],"ko":["트라피스트-1"]},
        info: { en:{"type":"Ultracool red dwarf star","distance":"~40 light-years","constellation":"Aquarius","facts":[["Planets","7 (all Earth-size)"],["In habitable zone","3-4"]],"desc":"This dim, ultracool red dwarf is circled by seven roughly Earth-size planets — more Earth-size worlds than are known around any other single star. Three or four of them orbit within the habitable zone, where liquid water could exist. That makes TRAPPIST-1 the richest known laboratory for studying potentially habitable worlds.","catalog":"TRAPPIST-1"}, hans:{"type":"超冷红矮星","distance":"约 40 光年","constellation":"宝瓶座","facts":[["行星数量","7 颗（均为地球大小）"],["宜居带内","3–4 颗"]],"desc":"这颗昏暗的超冷红矮星拥有七颗与地球大小相近的行星，是目前已知拥有地球大小行星最多的单星系统。其中三到四颗位于可能存在液态水的宜居带内。这使 TRAPPIST-1 成为研究潜在宜居世界最丰富的天然实验室。","catalog":"TRAPPIST-1"}, hant:{"type":"超冷紅矮星","distance":"約 40 光年","constellation":"寶瓶座","facts":[["行星數量","7 顆（均為地球大小）"],["宜居帶內","3–4 顆"]],"desc":"這顆昏暗的超冷紅矮星擁有七顆與地球大小相近的行星，是目前已知擁有地球大小行星最多的單一恆星系統。其中三到四顆位於可能存在液態水的宜居帶內。這使 TRAPPIST-1 成為研究潛在宜居世界最豐富的天然實驗室。","catalog":"TRAPPIST-1"}, ja:{"type":"超低温の赤色矮星","distance":"約40光年","constellation":"みずがめ座","facts":[["惑星の数","7個（すべて地球サイズ）"],["ハビタブルゾーン内","3〜4個"]],"desc":"この暗く低温の赤色矮星の周りには、地球とほぼ同じ大きさの惑星が7個も回っており、単一の恒星を回る地球サイズの惑星の数としては知られる中で最多です。そのうち3〜4個は液体の水が存在しうるハビタブルゾーンに位置しています。トラピスト1は、生命を宿しうる世界を研究するうえで最も恵まれた天然の実験場です。","catalog":"TRAPPIST-1"}, ko:{"type":"극저온 적색왜성","distance":"약 40광년","constellation":"물병자리","facts":[["행성 수","7개 (모두 지구 크기)"],["생명체 거주가능 영역 내","3~4개"]],"desc":"이 어둡고 극저온인 적색왜성 주위에는 지구와 비슷한 크기의 행성이 7개나 돌고 있으며, 이는 하나의 항성을 도는 지구 크기 행성 수로는 알려진 것 중 가장 많습니다. 그중 3~4개는 액체 물이 존재할 수 있는 생명체 거주가능 영역에 놓여 있습니다. 이 덕분에 트라피스트-1은 잠재적 거주 가능 행성을 연구하기에 가장 풍부한 자연 실험실입니다.","catalog":"TRAPPIST-1"} } },
      { p: galPos(121, -21.6, 202), cls: 'ext', fixed: true, gal: { mode: 'spiral', opts: { sq: 0.42, arms: 2 }, size: 330, fade: 0.7, stars: { count: 26000, radius: 132, arms: 2, tight: 1.5, inc: 1.3, roll: 0.6, warm: 0.32, warmK: 2.2, starGain: 0.45, // tight = the painted arcs' winding
        paint: { kind: 0, seed: 31, arm: [2, 1.5, 1.6, 0.6], rim: [1.2, 0.6, 0.2], body: [0.36, 1.0, 0.7, 0.12], ring: [0.66, 0.2, 0.75], lane: [0.9, 9, 0.12], core: [0.14, 0.9, 0.15, 1.2], tint: [0.35, 0, 0, 0.12],
          pal: [[0, 0xfff1dc], [0.2, 0xffe2c0], [0.42, 0xf4c49a], [0.55, 0xe9c4d2], [0.8, 0xb8c2ff], [1.0, 0xa6b2f4]], young: 0xdbe4ff, hiiCol: 0xe85a72, hii: [0.45, 0, 1],
          anchors: [[80, 34, 8, 0.6, 0xcfdcff]], bright: 0.55 } } }, // telescope palette: cream nucleus, tan inner disc, mauve, blue-violet ring; NGC 206 at its marker
        t: {"en":["Andromeda Galaxy","beyond the Milky Way"],"hans":["仙女座星系","银河系之外"],"hant":["仙女座星系","銀河系之外"],"ja":["アンドロメダ銀河","天の川銀河の外"],"ko":["안드로메다 은하","우리은하 너머"]},
        info: { en:{"type":"Spiral galaxy · external · not to scale","distance":"~2.5 million light-years","constellation":"Andromeda","facts":[["Diameter","~152,000 ly"],["Group","Local Group"]],"desc":"The nearest large galaxy to the Milky Way and the most distant object easily visible to the naked eye. It is heading our way at about 110 km/s; recent studies put the chance that the two galaxies merge within the next 10 billion years at roughly 50% to 90%, so the outcome is still uncertain. Shown on the far sky — far beyond the Milky Way and not to scale.","catalog":"M31"}, hans:{"type":"旋涡星系 · 银河系外 · 非真实比例","distance":"约 250 万光年","constellation":"仙女座","facts":[["直径","约 15.2 万光年"],["所属","本星系群"]],"desc":"距离银河系最近的大型星系，也是肉眼容易看到的最远天体。它正以约每秒 110 公里的速度向我们靠近；近年的研究估计，两者在未来 100 亿年内并合的概率约为 50% 到 90%，结局仍未确定。这里画在远方天幕上——远在银河系之外，非真实比例。","catalog":"M31"}, hant:{"type":"螺旋星系 · 銀河系外 · 非真實比例","distance":"約 250 萬光年","constellation":"仙女座","facts":[["直徑","約 15.2 萬光年"],["所屬","本星系群"]],"desc":"距離銀河系最近的大型星系，也是肉眼容易看到的最遠天體。它正以約每秒 110 公里的速度向我們靠近；近年的研究估計，兩者在未來 100 億年內合併的機率約為 50% 到 90%，結局仍未確定。這裡畫在遠方天幕上——遠在銀河系之外，非真實比例。","catalog":"M31"}, ja:{"type":"渦巻銀河 · 天の川銀河の外 · 実スケールではない","distance":"約250万光年","constellation":"アンドロメダ座","facts":[["直径","約15.2万光年"],["所属","局部銀河群"]],"desc":"天の川銀河に最も近い大型銀河で、肉眼でたやすく見える最も遠い天体です。秒速約110kmでこちらに近づいており、近年の研究では、今後100億年以内に二つの銀河が合体する確率は約50〜90%と見積もられ、結末はまだ定まっていません。ここでは遠くの天空に描いており、天の川銀河のはるか外側で実際のスケールではありません。","catalog":"M31"}, ko:{"type":"나선 은하 · 우리은하 밖 · 실제 비율 아님","distance":"약 250만 광년","constellation":"안드로메다자리","facts":[["지름","약 15.2만 광년"],["소속","국부 은하군"]],"desc":"우리은하에서 가장 가까운 대형 은하이며 맨눈으로 쉽게 볼 수 있는 가장 먼 천체입니다. 초속 약 110km로 우리에게 다가오고 있으며, 최근 연구들은 앞으로 100억 년 안에 두 은하가 병합할 확률을 약 50~90%로 추정해 결말은 아직 불확실합니다. 여기서는 먼 하늘에 그려져 있으며 우리은하 훨씬 바깥이고 실제 비율은 아닙니다.","catalog":"M31"} } },
      { p: galPos(133.61, -31.33, 175), cls: 'ext', fixed: true, gal: { mode: 'spiral', opts: { sq: 0.82, arms: 2, tight: 4.2, seed: 12.1 }, size: 250, fade: 0.72, stars: { count: 16000, radius: 108, arms: 2, tight: 0.72, inc: 0.78, roll: 2.2, warm: 0.04, warmK: 4, hii: 0.015, clumps: 300, armJitter: 1.4, haloOpacity: 0, coreSize: 0.06, coreOpacity: 0.5, starGain: 0.5,
        paint: { kind: 0, seed: 33, arm: [2, 0.72, 1.6, 0.8], rim: [1.1, 0.55, 0.3], body: [0.3, 0.9, 0.8, 0.25], ring: [0.35, 0.45, 0.6], lane: [0.45, 5, 0.1], core: [0.04, 1.2, 0, 1.3], tint: [0.4, 0, 0, 0.12],
          pal: [[0, 0xfff4e0], [0.15, 0xf4e6cf], [0.4, 0xe2dcec], [0.65, 0xc4cdee], [0.85, 0x9fb2e2], [1.0, 0x7c92cc]], young: 0xd6e4ff, hiiCol: 0xf0609a, hii: [0.85, 0, 1.2, 0.03],
          anchors: [[58, 30, 5, 1.4, 0xe0507a]], bright: 0.95 } } }, // flocculent, blue-white with a cream centre, rich in pink HII; NGC 604 at its marker
        t: {"en":["Triangulum Galaxy","in the Local Group"],"hans":["三角座星系","本星系群成员"],"hant":["三角座星系","本星系群成員"],"ja":["さんかく座銀河","局部銀河群の一員"],"ko":["삼각형자리 은하","국부 은하군의 일원"]},
        info: { en:{"type":"Spiral galaxy · external · not to scale","distance":"~2.7 million light-years","constellation":"Triangulum","facts":[["Diameter","~60,000 ly"],["Group","Local Group"]],"desc":"The third-largest galaxy in the Local Group and a graceful face-on spiral. Under very dark skies it is one of the most distant objects the unaided eye can see. With the Milky Way and Andromeda it completes the Local Group’s trio of great spirals. Drawn on the far sky, not to scale.","catalog":"M33"}, hans:{"type":"旋涡星系 · 银河系外 · 非真实比例","distance":"约 270 万光年","constellation":"三角座","facts":[["直径","约 6 万光年"],["所属","本星系群"]],"desc":"本星系群中第三大的星系，是一个正面朝向我们的秀丽旋涡星系。在非常黑暗的天空下，它是肉眼可见的最远天体之一。它与银河系、仙女座星系一起，构成本星系群三大旋涡星系。这里画在远方天幕上，非真实比例。","catalog":"M33"}, hant:{"type":"螺旋星系 · 銀河系外 · 非真實比例","distance":"約 270 萬光年","constellation":"三角座","facts":[["直徑","約 6 萬光年"],["所屬","本星系群"]],"desc":"本星系群中第三大的星系，是一個正面朝向我們的秀麗螺旋星系。在非常黑暗的天空下，它是肉眼可見的最遠天體之一。它與銀河系、仙女座星系一起，構成本星系群三大螺旋星系。這裡畫在遠方天幕上，非真實比例。","catalog":"M33"}, ja:{"type":"渦巻銀河 · 天の川銀河の外 · 実スケールではない","distance":"約270万光年","constellation":"さんかく座","facts":[["直径","約6万光年"],["所属","局部銀河群"]],"desc":"局部銀河群で3番目に大きい銀河で、正面を向いた優美な渦巻銀河です。非常に暗い空の下では、肉眼で見える最も遠い天体のひとつです。天の川銀河とアンドロメダ銀河とともに、局部銀河群の三大渦巻銀河をなしています。ここでは遠くの天空に描いており、実際のスケールではありません。","catalog":"M33"}, ko:{"type":"나선 은하 · 우리은하 밖 · 실제 비율 아님","distance":"약 270만 광년","constellation":"삼각형자리","facts":[["지름","약 6만 광년"],["소속","국부 은하군"]],"desc":"국부 은하군에서 세 번째로 큰 은하이며, 정면을 향한 우아한 나선 은하입니다. 매우 어두운 하늘에서는 맨눈으로 볼 수 있는 가장 먼 천체 중 하나입니다. 우리은하, 안드로메다은하와 함께 국부 은하군의 3대 나선 은하를 이룹니다. 여기서는 먼 하늘에 그려져 있으며 실제 비율은 아닙니다.","catalog":"M33"} } },
      { p: galPos(298.46, 51.15, 195), cls: 'ext', fixed: true, gal: { mode: 'sombrero', opts: { sq: 0.19, seed: 9.4 }, size: 235, fade: 0.75, stars: { kind: 'spiral', count: 48000, radius: 106, arms: 4, tight: 2.1, clumps: 90, clumpK: 0.6, armJitter: 0.6, inc: 1.45, roll: 1.0, bulge: 0.28, bulgeR: 0.42, outside: 0xbcd0ec, dustBand: 'ring', haloOpacity: 0, coreOpacity: 0, nucleusSize: 0.05, starGain: 0.35,
        paint: [
          { kind: 0, seed: 104, span: 2.4, arm: [4, 2.1, 1.0, 0.35], rim: [1.08, 0.95, 0.06], body: [0.45, 0.65, 0.5, 0.85], ring: [0.9, 0.07, 0.8], lane: [0, 7, 0, 0.9], core: [0.1, 0.2, 0, 1.4], tint: [0.25, 0, 0, 0.06],
            pal: [[0, 0xfff8ee], [0.3, 0xf2ece4], [0.6, 0xe4e0ea], [0.85, 0xd2d0dc], [1.0, 0xbcbecc], [1.1, 0x9a9cb0]], young: 0xc9d4ef, hiiCol: 0xe3a0b0, hii: [0.15, 0, 0.6], bright: 0.7 }, // the thin lavender-white disc and its star ring
          { kind: 1, seed: 105, q: 0.7, size: 1024, span: 2.5, arm: [0, 0, 1, 0.5], rim: [1.25, 0.7, 0.06], body: [0.12, 0.55, 0, 0.25], core: [0.05, 0.6, 0, 1.2], tint: [0, 0, 0, 0.05],
            pal: [[0, 0xfffaf0], [0.1, 0xfbf3e6], [0.3, 0xefe6d6], [0.6, 0xddd3c4], [0.9, 0xc9c0b4], [1.2, 0xb0a89e]], bright: 1.4, near: [0.4, 2.2, 0] } ] } }, // the ivory crown
        t: {"en":["Sombrero Galaxy","seen edge-on"],"hans":["草帽星系","侧向观测"],"hant":["草帽星系","側向觀測"],"ja":["ソンブレロ銀河","真横から見た姿"],"ko":["솜브레로 은하","옆에서 본 모습"]},
        info: { en:{"type":"Spiral galaxy · edge-on · not to scale","distance":"~29 million light-years","constellation":"Virgo","facts":[["Diameter","~95,000 ly"],["Feature","edge-on dust lane"]],"desc":"We view this bright spiral almost exactly edge-on: a glowing white bulge split by a dark lane of dust, the silhouette that earns it the name Sombrero. A black hole of about a billion suns sits at its core. Drawn on the far sky, not to scale.","catalog":"M104"}, hans:{"type":"旋涡星系 · 侧向 · 非真实比例","distance":"约 2900 万光年","constellation":"室女座","facts":[["直径","约 9.5 万光年"],["特征","侧向尘埃带"]],"desc":"我们几乎正好从侧面看这个明亮的旋涡星系：发光的白色核球被一条暗色尘埃带分割，正是这道剪影使它得名草帽。核心坐落着一个约十亿倍太阳质量的黑洞。这里画在远方天幕上，非真实比例。","catalog":"M104"}, hant:{"type":"螺旋星系 · 側向 · 非真實比例","distance":"約 2900 萬光年","constellation":"室女座","facts":[["直徑","約 9.5 萬光年"],["特徵","側向塵埃帶"]],"desc":"我們幾乎正好從側面看這個明亮的螺旋星系：發光的白色核球被一條暗色塵埃帶分割，正是這道剪影使它得名草帽。核心坐落著一個約十億倍太陽質量的黑洞。這裡畫在遠方天幕上，非真實比例。","catalog":"M104"}, ja:{"type":"渦巻銀河 · 真横 · 実スケールではない","distance":"約2900万光年","constellation":"おとめ座","facts":[["直径","約9.5万光年"],["特徴","真横に走る暗黒帯"]],"desc":"この明るい渦巻銀河をほぼ真横から見ています：輝く白いバルジが暗い塵の帯で分けられ、このシルエットがソンブレロの名の由来です。中心には太陽の約10億倍の質量をもつブラックホールがあります。ここでは遠くの天空に描いており、実際のスケールではありません。","catalog":"M104"}, ko:{"type":"나선 은하 · 옆면 · 실제 비율 아님","distance":"약 2900만 광년","constellation":"처녀자리","facts":[["지름","약 9.5만 광년"],["특징","옆면 먼지 띠"]],"desc":"이 밝은 나선 은하를 거의 정확히 옆에서 봅니다: 빛나는 흰색 팽대부가 어두운 먼지 띠로 갈라져 있으며, 바로 이 실루엣이 솜브레로라는 이름을 얻게 했습니다. 중심에는 태양 약 10억 배 질량의 블랙홀이 있습니다. 여기서는 먼 하늘에 그려져 있으며 실제 비율은 아닙니다.","catalog":"M104"} } },
      { p: galPos(283.78, 74.49, 205), cls: 'ext', fixed: true, gal: { mode: 'ell', opts: { ell: 0.82, seed: 3.1 }, size: 230, fade: 0.62, stars: { kind: 'ellipsoid', count: 28000, radius: 132, ell: 0.82, inc: 0.3, haloOpacity: 0, coreSize: 0.3, coreOpacity: 0.35, core: 0xffeecb, nucleusSize: 0.08, starGain: 0.6,
        paint: { kind: 1, seed: 87, q: 0.82, span: 2.6, arm: [0, 0, 1, 0.5], rim: [1.1, 0.45, 0.06], body: [0.08, 1.0, 0, 0.3], core: [0.05, 0.5, 0, 1.2], tint: [0, 0, 0, 0.06],
          pal: [[0, 0xffe3bd], [0.1, 0xffe8cc], [0.4, 0xf5e6d1], [0.8, 0xe0d9cc], [1.1, 0xc8c2b8], [1.3, 0xa8a49c]], bright: 1.6, near: [0.9, 2.2, 0] } } }, // a smooth warm-cream glow with gentle strokes along the isophotes
        t: {"en":["M87","giant elliptical"],"hans":["室女座A（M87）","巨椭圆星系"],"hant":["室女座A（M87）","巨橢圓星系"],"ja":["M87（おとめ座A）","巨大楕円銀河"],"ko":["M87 (처녀자리 A)","거대 타원 은하"]},
        info: { en:{"type":"Giant elliptical · external · not to scale","distance":"~53 million light-years","constellation":"Virgo","facts":[["Black hole","~6.5 billion suns"],["Cluster","Virgo Cluster"]],"desc":"A giant elliptical ruling the heart of the Virgo Cluster, built from trillions of old stars. Its central black hole — some 6.5 billion times the Sun’s mass — was the first ever photographed, by the Event Horizon Telescope in 2019, the same array that later imaged our own Sagittarius A*. Drawn on the far sky, not to scale.","catalog":"M87"}, hans:{"type":"巨椭圆星系 · 银河系外 · 非真实比例","distance":"约 5300 万光年","constellation":"室女座","facts":[["黑洞","约 65 亿倍太阳质量"],["星系团","室女座星系团"]],"desc":"统治室女座星系团核心的巨椭圆星系，由数万亿颗年老恒星构成。其中心黑洞——质量约为太阳的 65 亿倍——是有史以来第一个被拍摄到的黑洞，由事件视界望远镜于 2019 年拍摄，该阵列后来还拍摄了我们自己的人马座 A*。这里画在远方天幕上，非真实比例。","catalog":"M87"}, hant:{"type":"巨橢圓星系 · 銀河系外 · 非真實比例","distance":"約 5300 萬光年","constellation":"室女座","facts":[["黑洞","約 65 億倍太陽質量"],["星系團","室女座星系團"]],"desc":"統治室女座星系團核心的巨橢圓星系，由數兆顆年老恆星構成。其中心黑洞——質量約為太陽的 65 億倍——是有史以來第一個被拍攝到的黑洞，由事件視界望遠鏡於 2019 年拍攝，該陣列後來還拍攝了我們自己的人馬座 A*。這裡畫在遠方天幕上，非真實比例。","catalog":"M87"}, ja:{"type":"巨大楕円銀河 · 天の川銀河の外 · 実スケールではない","distance":"約5300万光年","constellation":"おとめ座","facts":[["ブラックホール","太陽質量の約65億倍"],["銀河団","おとめ座銀河団"]],"desc":"おとめ座銀河団の中心に君臨する巨大楕円銀河で、数兆個もの年老いた星からなります。中心にある太陽質量の約65億倍のブラックホールは、2019年にイベント・ホライズン・テレスコープが史上初めて撮影したもので、この望遠鏡群は後に私たちのいて座A*も撮影しました。ここでは遠くの天空に描いており、実際のスケールではありません。","catalog":"M87"}, ko:{"type":"거대 타원 은하 · 우리은하 밖 · 실제 비율 아님","distance":"약 5300만 광년","constellation":"처녀자리","facts":[["블랙홀","태양 질량의 약 65억 배"],["은하단","처녀자리 은하단"]],"desc":"처녀자리 은하단의 중심에 군림하는 거대 타원 은하로, 수조 개의 늙은 별로 이루어져 있습니다. 중심의 블랙홀은 태양 질량의 약 65억 배로, 2019년 사건 지평선 망원경이 사상 처음으로 촬영한 블랙홀이며, 이 망원경 배열은 나중에 우리은하의 궁수자리 A*도 촬영했습니다. 먼 하늘에 그려져 있으며 실제 비율은 아닙니다.","catalog":"M87"} } },
      { p: galPos(309.52, 19.42, 165), cls: 'ext', fixed: true, gal: { mode: 'ell', opts: { ell: 0.92, seed: 6.2, dustBand: true, tilt: 0.15 }, size: 245, fade: 0.7, stars: { kind: 'ellipsoid', count: 6000, radius: 120, ell: 0.9, dustBand: true, inc: 1.25, roll: 0.3, haloOpacity: 0, coreOpacity: 0, spin: 0, dustVol: { gain: 1.0 }, photo: { src: 'images/cena-plate.png', span: 270, thick: 26, palette: 0.16, oldPop: true }, veils: [ { sz: 7, hex: 0xffffff, op: 0.8, T: 6 } ],
        paint: { kind: 1, seed: 128, q: 0.92, span: 3.2, arm: [0, 0, 1, 0.7], rim: [1.4, 0.6, 0.06], body: [0.1, 0.9, 0, 0.3], core: [0.06, 0.5, 0, 1.2], tint: [0, 0, 0, 0.06],
          pal: [[0, 0xfff4e6], [0.15, 0xf2e2c8], [0.4, 0xcfc4b2], [0.8, 0x8f8a82], [1.2, 0x9ba1ad], [1.5, 0x7d828c]], bright: 1.5, near: [0.9, 2.2, 0.35] } } }, // a round cream halo under the plate stars; the raymarched lane still darkens it
        t: {"en":["Centaurus A","nearest active galaxy"],"hans":["半人马座A","最近的活动星系"],"hant":["半人馬座A","最近的活躍星系"],"ja":["ケンタウルス座A","最も近い活動銀河"],"ko":["센타우루스자리 A","가장 가까운 활동 은하"]},
        info: { en:{"type":"Active galaxy · external · not to scale","distance":"~13 million light-years","constellation":"Centaurus","facts":[["Central black hole","~55 million M☉"],["Feature","radio jets"]],"desc":"The nearest active galaxy to us: a giant elliptical crossed by a warped dark dust lane, the wreckage of a spiral it swallowed. Its central black hole launches jets that blaze across the radio sky, making it one of the brightest radio sources in the heavens. Drawn on the far sky, not to scale.","catalog":"NGC 5128"}, hans:{"type":"活动星系 · 银河系外 · 非真实比例","distance":"约 1300 万光年","constellation":"半人马座","facts":[["中心黑洞","约 5500 万倍太阳质量"],["特征","射电喷流"]],"desc":"距离我们最近的活动星系：一个巨大的椭圆星系，被一条扭曲的暗尘埃带横贯，那是它吞并的旋涡星系的残骸。中心黑洞喷射出的喷流横扫射电天空，使它成为全天最明亮的射电源之一。这里画在远方天幕上，非真实比例。","catalog":"NGC 5128"}, hant:{"type":"活躍星系 · 銀河系外 · 非真實比例","distance":"約 1300 萬光年","constellation":"半人馬座","facts":[["中心黑洞","約 5500 萬倍太陽質量"],["特徵","電波噴流"]],"desc":"距離我們最近的活躍星系：一個巨大的橢圓星系，被一條扭曲的暗塵埃帶橫貫，那是它吞併的螺旋星系的殘骸。中心黑洞噴射出的噴流橫掃電波天空，使它成為全天最明亮的電波源之一。這裡畫在遠方天幕上，非真實比例。","catalog":"NGC 5128"}, ja:{"type":"活動銀河 · 天の川銀河の外 · 実スケールではない","distance":"約1300万光年","constellation":"ケンタウルス座","facts":[["中心ブラックホール","太陽の約5500万倍"],["特徴","電波ジェット"]],"desc":"私たちに最も近い活動銀河で、飲み込んだ渦巻銀河の名残であるねじれた暗い塵の帯が横切る巨大な楕円銀河です。中心のブラックホールが噴き出すジェットは電波の空を貫き、全天で最も明るい電波源の一つです。ここでは遠くの天空に描いており、実際のスケールではありません。","catalog":"NGC 5128"}, ko:{"type":"활동 은하 · 우리은하 밖 · 실제 비율 아님","distance":"약 1300만 광년","constellation":"센타우루스자리","facts":[["중심 블랙홀","태양의 약 5500만 배"],["특징","전파 제트"]],"desc":"우리에게 가장 가까운 활동 은하로, 집어삼킨 나선 은하의 잔해인 뒤틀린 어두운 먼지 띠가 가로지르는 거대 타원 은하입니다. 중심 블랙홀이 내뿜는 제트는 전파 하늘을 가로질러 하늘에서 가장 밝은 전파원 중 하나입니다. 여기서는 먼 하늘에 그려져 있으며 실제 비율은 아닙니다.","catalog":"NGC 5128"} } },
      { p: galPos(280.47, -32.89, 155), cls: 'ext', fixed: true, gal: { mode: 'irr', opts: { seed: 21.7 }, size: 285, fade: 0.85, stars: { kind: 'irregular', count: 15000, radius: 122, inc: 0.3, offx: 0.14, offz: -0.05, bar: 0.32, barAng: 0.35, haloSize: 0.5, haloOpacity: 0.03, coreOpacity: 0, photo: { src: 'images/lmc-plate.png', span: 250, thick: 9 }, starGain: 0.7,
        paint: { kind: 2, seed: 21.7, arm: [0, 0, 1, 0.8], rim: [0.07, 0.17, 0.08], body: [0.075, 0.75], core: [0.1, 0, 0, 1], tint: [0.6, 0.12, 0.25, 0.08], plate: [0.75, 1.2, 1],
          pal: [[0, 0xf6efe4], [0.25, 0xece4d6], [0.55, 0xc9cbd6], [0.75, 0xaeb8cf], [1.0, 0x7c8db5], [1.01, 0x7c8db5]], young: 0x9db8f2, hiiCol: 0xe57a8e, hii: [0.8, 0.15, 1],
          anchors: [[-8, -27, 9, 1.2, 0xf2b0bc], [-22, -24, 7, 0.6, 0xe57a8e], [96, 36, 7, 0.6, 0xe57a8e], [36, -7, 5, 0.4, 0xe57a8e]], bright: 0.9 } } }, // cream bar, blue-grey disc; 30 Dor + N11 where the plate has them
        t: {"en":["Large Magellanic Cloud","Milky Way satellite"],"hans":["大麦哲伦云","银河系的卫星星系"],"hant":["大麥哲倫雲","銀河系的衛星星系"],"ja":["大マゼラン雲","天の川銀河の伴銀河"],"ko":["대마젤란은하","우리은하의 위성 은하"]},
        info: { en:{"type":"Satellite galaxy · irregular · not to scale","distance":"~160,000 light-years","constellation":"Dorado","facts":[["Diameter","~32,000 ly"],["Hosts","Tarantula, SN 1987A"]],"desc":"The largest satellite galaxy of the Milky Way, a barred irregular orbiting close by. It cradles the Tarantula Nebula — the most furious star-forming region in the Local Group — and hosted SN 1987A, the nearest supernova seen in the modern era. A naked-eye sight from southern skies. Drawn on the far sky, not to scale.","catalog":"LMC"}, hans:{"type":"卫星星系 · 不规则 · 非真实比例","distance":"约 16 万光年","constellation":"剑鱼座","facts":[["直径","约 3.2 万光年"],["拥有","蜘蛛星云、SN 1987A"]],"desc":"银河系最大的卫星星系，是一个在近旁绕行的棒状不规则星系。它孕育着蜘蛛星云——本星系群中恒星形成最剧烈的区域——并曾出现 SN 1987A，即现代观测到的最近的超新星。在南半球天空可用肉眼看到。这里画在远方天幕上，非真实比例。","catalog":"LMC"}, hant:{"type":"衛星星系 · 不規則 · 非真實比例","distance":"約 16 萬光年","constellation":"劍魚座","facts":[["直徑","約 3.2 萬光年"],["擁有","蜘蛛星雲、SN 1987A"]],"desc":"銀河系最大的衛星星系，是一個在近旁繞行的棒狀不規則星系。它孕育著蜘蛛星雲——本星系群中恆星形成最劇烈的區域——並曾出現 SN 1987A，即現代觀測到的最近的超新星。在南半球天空可用肉眼看到。這裡畫在遠方天幕上，非真實比例。","catalog":"LMC"}, ja:{"type":"伴銀河 · 不規則 · 実スケールではない","distance":"約16万光年","constellation":"かじき座","facts":[["直径","約3.2万光年"],["擁する","タランチュラ星雲・SN 1987A"]],"desc":"天の川銀河で最大の伴銀河で、すぐ近くを周回する棒状不規則銀河です。局部銀河群で最も激しい星形成領域であるタランチュラ星雲を抱え、現代で観測された最も近い超新星 SN 1987A が現れました。南半球の空では肉眼で見えます。ここでは遠くの天空に描いており、実際のスケールではありません。","catalog":"LMC"}, ko:{"type":"위성 은하 · 불규칙 · 실제 비율 아님","distance":"약 16만 광년","constellation":"황새치자리","facts":[["지름","약 3.2만 광년"],["보유","타란툴라 성운·SN 1987A"]],"desc":"우리은하에서 가장 큰 위성 은하로, 가까이서 공전하는 막대 불규칙 은하입니다. 국부 은하군에서 별 형성이 가장 격렬한 타란툴라 성운을 품고 있으며, 현대에 관측된 가장 가까운 초신성 SN 1987A가 나타났습니다. 남반구 하늘에서는 맨눈으로 볼 수 있습니다. 여기서는 먼 하늘에 그려져 있으며 실제 비율은 아닙니다.","catalog":"LMC"} } },
      { p: galPos(302.81, -44.33, 185), cls: 'ext', fixed: true, gal: { mode: 'irr', opts: { seed: 8.3, small: true, barAng: 1.1 }, size: 205, fade: 0.85, stars: { kind: 'irregular', count: 8000, radius: 86, small: true, inc: 0.3, offx: 0.1, offz: 0.06, bar: 0.28, barAng: 1.1, haloOpacity: 0, coreOpacity: 0, photo: { src: 'images/smc-plate.png', span: 175, thick: 7 }, starGain: 0.7,
        paint: { kind: 2, seed: 8.3, arm: [0, 0, 1, 1.1], rim: [0.1, 0.35, 0.08], body: [0.12, 0.5], core: [0.1, 0, 0, 1], tint: [0.5, 0.1, 0.25, 0.08], plate: [1.0, 1.6, 1],
          pal: [[0, 0xeef2ff], [0.3, 0xcad6f2], [0.55, 0xc9cbd6], [0.75, 0xb8c4e4], [0.9, 0xa6b0cc], [1.0, 0x8a92b0]], young: 0xc6d3f2, hiiCol: 0xff7aa6, hii: [1.2, 0.25, 1.2],
          anchors: [[-5, 30, 6, 0.8, 0xff6f9e]], bright: 0.8 } } }, // blue-white bar, pink knots where the plate is red; NGC 346 at its marker
        t: {"en":["Small Magellanic Cloud","Milky Way satellite"],"hans":["小麦哲伦云","银河系的卫星星系"],"hant":["小麥哲倫雲","銀河系的衛星星系"],"ja":["小マゼラン雲","天の川銀河の衛星銀河"],"ko":["소마젤란은하","우리은하의 위성 은하"]},
        info: { en:{"type":"Dwarf galaxy · satellite · not to scale","distance":"~200,000 light-years","constellation":"Tucana","facts":[["Diameter","~19,000 ly"],["Legacy","Leavitt’s Cepheid law"]],"desc":"A dwarf-irregular companion of the Milky Way, paired with its larger sibling as the Magellanic Clouds. By measuring its Cepheid variable stars, Henrietta Leavitt uncovered the period–luminosity law — the first rung of the cosmic distance ladder that let astronomers measure the universe. Drawn on the far sky, not to scale.","catalog":"SMC"}, hans:{"type":"矮星系 · 卫星星系 · 非真实比例","distance":"约 20 万光年","constellation":"杜鹃座","facts":[["直径","约 1.9 万光年"],["贡献","勒维特造父定律"]],"desc":"银河系的一个不规则矮伴星系，与更大的同伴合称麦哲伦云。亨丽埃塔·勒维特通过测量其中的造父变星，发现了周期—光度关系——这是宇宙距离阶梯的第一级，让天文学家得以测量宇宙。这里画在远方天幕上，非真实比例。","catalog":"SMC"}, hant:{"type":"矮星系 · 衛星星系 · 非真實比例","distance":"約 20 萬光年","constellation":"杜鵑座","facts":[["直徑","約 1.9 萬光年"],["貢獻","勒維特造父定律"]],"desc":"銀河系的一個不規則矮伴星系，與更大的同伴合稱麥哲倫雲。亨麗埃塔·勒維特透過測量其中的造父變星，發現了週期—光度關係——這是宇宙距離階梯的第一級，讓天文學家得以測量宇宙。這裡畫在遠方天幕上，非真實比例。","catalog":"SMC"}, ja:{"type":"矮小銀河 · 衛星銀河 · 実スケールではない","distance":"約20万光年","constellation":"きょしちょう座","facts":[["直径","約1.9万光年"],["功績","リービットのセファイド則"]],"desc":"天の川銀河の不規則矮小伴銀河で、より大きな兄弟星系とともにマゼラン雲と呼ばれます。ヘンリエッタ・リービットはこの銀河のセファイド変光星を測定し、周期光度関係を発見しました。これは宇宙の距離はしごの最初の一段であり、天文学者が宇宙を測ることを可能にしました。ここでは遠くの天空に描いており、実際のスケールではありません。","catalog":"SMC"}, ko:{"type":"왜소 은하 · 위성 은하 · 실제 비율 아님","distance":"약 20만 광년","constellation":"큰부리새자리","facts":[["지름","약 1.9만 광년"],["업적","리비트의 세페이드 법칙"]],"desc":"우리은하의 불규칙 왜소 동반 은하로, 더 큰 형제 은하와 함께 마젤란은하로 불립니다. 헨리에타 리비트는 이 은하의 세페이드 변광성을 측정해 주기-광도 관계를 밝혀냈습니다. 이는 천문학자가 우주를 측정하게 해준 우주 거리 사다리의 첫 단입니다. 여기서는 먼 하늘에 그려져 있으며 실제 비율은 아닙니다.","catalog":"SMC"} } }
    ];
    function videoTargetForBeacon(definition) {
      var catalog = definition.info.en.catalog;
      return definition.cls === 'sun' ? 'beacon-solar-system' : ({
        'Sgr A*': 'beacon-sagittarius-a-star',
        LMC: 'beacon-lmc',
        SMC: 'beacon-smc',
        M31: 'beacon-andromeda',
        M87: 'beacon-m87',
        'NGC 5128': 'beacon-centaurus-a'
      }[catalog] || '');
    }
    var host = document.createElement('div'); host.id = 'beacons'; document.body.appendChild(host);
    for (var i = 0; i < DEFS.length; i++) {
      var d = DEFS[i], el = document.createElement('div');
      el.className = 'beacon' + (d.cls ? ' ' + d.cls : '');
      var videoTarget = videoTargetForBeacon(d);
      if (videoTarget) el.dataset.videoTarget = videoTarget;
      el.style.display = 'none'; // hidden until first positioned — unpositioned beacons otherwise stack clickable at the page's top-left
      el.innerHTML = '<div class="b-mark"><span class="b-ring"></span><span class="b-ring r2"></span><span class="b-dot"></span></div><div class="b-label"></div>';
      host.appendChild(el); keyActivate(el);
      (function (idx) { el.addEventListener('click', function (e) { e.stopPropagation(); selectBeacon(idx); }); })(i);
      BEACONS.push({ p: d.p, el: el, t: d.t, info: d.info, fixed: d.fixed, gal: d.gal, shown: false }); // shown:false MUST match the initial display:none set above — else updateBeacons' vis!==shown guard never un-hides it
    }
    // ── internal objects inside the galaxies (always visible). Child beacons project
    // through their parent galaxy's world matrix, so they co-rotate with it.
    // lp = position in the galaxy's LOCAL frame (disc in XZ, +Y = disc normal),
    // scaled to the parent's radius (M31 R≈132, Cen A R≈120). Tunable in-browser.
    var CHILDREN = [
      { parent: 'M31', lp: new THREE.Vector3(80, 6, 34), feat: { kind: 'starcloud' },
        t: { en: ['NGC 206', 'star cloud'], hans: ['NGC 206', '恒星云'], hant: ['NGC 206', '恆星雲'], ja: ['NGC 206', '星の雲'], ko: ['NGC 206', '별구름'] },
        info: {
          en: { type: 'Star cloud · inside M31', facts: [['Type', 'OB star association'], ['Host', 'Andromeda (M31)']], desc: 'The brightest star cloud in the Andromeda Galaxy — a vast association of thousands of hot young blue stars, and one of the largest star-forming complexes in the whole Local Group. It shines from a gap between two of Andromeda’s spiral arms.', catalog: 'NGC 206' },
          hans: { type: '恒星云 · M31 内', facts: [['类型', 'OB星协'], ['宿主', '仙女座(M31)']], desc: '仙女座星系中最明亮的恒星云——由数千颗炽热年轻蓝色恒星组成的庞大星协，也是整个本星系群中最大的恒星形成区之一。它在仙女座两条旋臂之间的缝隙中发光。', catalog: 'NGC 206' },
          hant: { type: '恆星雲 · M31 內', facts: [['類型', 'OB星協'], ['宿主', '仙女座(M31)']], desc: '仙女座星系中最明亮的恆星雲——由數千顆熾熱年輕藍色恆星組成的龐大星協，也是整個本星系群中最大的恆星形成區之一。它在仙女座兩條旋臂之間的縫隙中發光。', catalog: 'NGC 206' },
          ja: { type: '星の雲 · M31 の内部', facts: [['種別', 'OBアソシエーション'], ['所属', 'アンドロメダ(M31)']], desc: 'アンドロメダ銀河で最も明るい星の雲で、数千個の高温で若い青い星が集まった巨大なアソシエーションです。局部銀河群全体でも最大級の星形成領域の一つで、アンドロメダの二本の渦状腕の隙間から輝いています。', catalog: 'NGC 206' },
          ko: { type: '별구름 · M31 내부', facts: [['유형', 'OB 성협'], ['소속', '안드로메다(M31)']], desc: '안드로메다 은하에서 가장 밝은 별구름으로, 수천 개의 뜨겁고 젊은 파란 별로 이루어진 거대한 성협입니다. 국부 은하군 전체에서 가장 큰 별 형성 영역 중 하나이며, 안드로메다의 두 나선팔 사이 틈에서 빛납니다.', catalog: 'NGC 206' }
        },
        img: 'images/ngc206.jpg', credit: 'T. A. Rector & A. Strom (UAA)/NOIRLab' },
      { parent: 'M31', lp: new THREE.Vector3(-46, 54, -30), feat: { kind: 'globular' },
        t: { en: ['G1 (Mayall II)', 'globular cluster'], hans: ['G1（梅奥尔 II）', '球状星团'], hant: ['G1（梅奧爾 II）', '球狀星團'], ja: ['G1（メイオールII）', '球状星団'], ko: ['G1 (메이올 II)', '구상성단'] },
        info: {
          en: { type: 'Globular cluster · inside M31', facts: [['Mass', '~10 million suns'], ['Host', 'Andromeda (M31)']], desc: 'The brightest and most massive globular cluster in the Local Group — a dense ball of ancient stars orbiting far out in Andromeda’s halo. Its crowded core may hide an intermediate-mass black hole.', catalog: 'G1 / Mayall II' },
          hans: { type: '球状星团 · M31 内', facts: [['质量', '约 1000 万太阳质量'], ['母星系', '仙女座星系（M31）']], desc: '本星系群中最明亮、质量最大的球状星团——一团由古老恒星构成的致密球体，在仙女座星系晕的外缘绕行。其拥挤的核心可能隐藏着一个中等质量黑洞。', catalog: 'G1 / Mayall II' },
          hant: { type: '球狀星團 · M31 內', facts: [['質量', '約 1000 萬太陽質量'], ['母星系', '仙女座星系（M31）']], desc: '本星系群中最明亮、質量最大的球狀星團——一團由古老恆星構成的緻密球體，在仙女座星系暈的外緣繞行。其擁擠的核心可能隱藏著一個中等質量黑洞。', catalog: 'G1 / Mayall II' },
          ja: { type: '球状星団 · M31 内', facts: [['質量', '太陽の約1000万倍'], ['母銀河', 'アンドロメダ（M31）']], desc: '局部銀河群で最も明るく最も質量の大きい球状星団で、古い星々が密集した球体がアンドロメダのハローの外縁を周回しています。混み合った中心部には中間質量ブラックホールが潜んでいるかもしれません。', catalog: 'G1 / Mayall II' },
          ko: { type: '구상성단 · M31 내부', facts: [['질량', '태양 약 1000만 배'], ['모은하', '안드로메다 (M31)']], desc: '국부은하군에서 가장 밝고 질량이 큰 구상성단으로, 오래된 별들이 빽빽이 모인 공 모양의 집단이 안드로메다 헤일로 바깥쪽을 돌고 있습니다. 붐비는 중심부에는 중간질량 블랙홀이 숨어 있을지도 모릅니다.', catalog: 'G1 / Mayall II' }
        },
        img: 'images/g1.jpg', credit: 'Judy Schmidt (Hubble/WFPC2)' },
      { parent: 'NGC 5128', lp: new THREE.Vector3(24, 78, 8), feat: { kind: 'jet', dir: new THREE.Vector3(0.22, 0.95, 0.1).normalize(), len: 150, fan: true, noBeam: true, noLobes: true, ionTail: true }, // crescent (半月斩) + comet-ion-tail jet — everything visible flows
        t: { en: ['Relativistic jet', 'from the black hole'], hans: ['相对论喷流', '来自黑洞'], hant: ['相對論噴流', '來自黑洞'], ja: ['相対論的ジェット', 'ブラックホールから'], ko: ['상대론적 제트', '블랙홀에서'] },
        info: {
          en: { type: 'Relativistic jet · Centaurus A', facts: [['Source', 'central black hole'], ['Glows in', 'radio + X-rays']], desc: 'A beam of plasma hurled outward at nearly the speed of light by the supermassive black hole at the galaxy’s heart. It blazes in radio and X-ray light, making Centaurus A one of the brightest radio sources in the entire sky.', catalog: 'Cen A jet' },
          hans: { type: '相对论喷流 · 半人马座A', facts: [['来源', '中心黑洞'], ['发光波段', '射电 + X射线']], desc: '由位于星系中心的超大质量黑洞以接近光速向外喷射的等离子体束。它在射电和X射线波段极为明亮，使半人马座A成为全天最亮的射电源之一。', catalog: 'Cen A jet' },
          hant: { type: '相對論噴流 · 半人馬座A', facts: [['來源', '中心黑洞'], ['發光波段', '電波 + X射線']], desc: '由位於星系中心的超大質量黑洞以接近光速向外噴射的電漿束。它在電波與X射線波段極為明亮，使半人馬座A成為全天最亮的電波源之一。', catalog: 'Cen A jet' },
          ja: { type: '相対論的ジェット · ケンタウルス座A', facts: [['発生源', '中心のブラックホール'], ['輝く波長', '電波 + X線']], desc: '銀河の中心にある超大質量ブラックホールが、ほぼ光速で外へ放つプラズマの流れです。電波とX線で明るく輝き、ケンタウルス座Aを全天で最も明るい電波源の一つにしています。', catalog: 'Cen A jet' },
          ko: { type: '상대론적 제트 · 센타우루스자리 A', facts: [['근원', '중심 블랙홀'], ['빛나는 파장', '전파 + X선']], desc: '은하 중심의 초대질량 블랙홀이 거의 빛의 속도로 바깥으로 내뿜는 플라스마 흐름입니다. 전파와 X선으로 환하게 빛나며, 센타우루스자리 A를 하늘 전체에서 가장 밝은 전파원 중 하나로 만듭니다.', catalog: 'Cen A jet' }
        },
        img: 'images/cena-jet.jpg', credit: 'NASA/CXC · MPIfR/ESO/APEX · ESO/WFI' },
      { parent: 'NGC 5128', lp: new THREE.Vector3(48, 2, -22), feat: { kind: 'nebula', size: 0.4, color: 0xe07aa8 }, // small pink knots along the lane, as in the photo
        t: { en: ['Star-forming region', 'in the dust lane'], hans: ['恒星形成区', '尘埃带中'], hant: ['恆星形成區', '塵埃帶中'], ja: ['星形成領域', 'ダストレーン内'], ko: ['별 형성 영역', '먼지 띠 속'] },
        info: {
          en: { type: 'Star-forming region · Centaurus A', facts: [['Contains', 'young blue clusters'], ['Trigger', 'galaxy merger']], desc: 'Knots of glowing pink hydrogen and hot blue star clusters strung along the galaxy’s warped dark dust lane — a burst of new star birth set off when Centaurus A devoured a smaller spiral galaxy.', catalog: 'Cen A HII' },
          hans: { type: '恒星形成区 · 半人马座A', facts: [['包含', '年轻的蓝色星团'], ['触发', '星系并合']], desc: '一团团发光的粉红色氢气与炽热的蓝色星团，沿着星系扭曲的黑暗尘埃带排布。这是半人马座A吞噬一个较小旋涡星系时引发的新一轮恒星诞生。', catalog: 'Cen A HII' },
          hant: { type: '恆星形成區 · 半人馬座A', facts: [['包含', '年輕的藍色星團'], ['觸發', '星系併合']], desc: '一團團發光的粉紅色氫氣與熾熱的藍色星團，沿著星系扭曲的黑暗塵埃帶排布。這是半人馬座A吞噬一個較小螺旋星系時引發的新一輪恆星誕生。', catalog: 'Cen A HII' },
          ja: { type: '星形成領域 · ケンタウルス座A', facts: [['含む', '若い青色星団'], ['引き金', '銀河の合体']], desc: '銀河のゆがんだ暗いダストレーンに沿って、ピンクに輝く水素ガスと高温の青い星団が連なっています。これは、ケンタウルス座Aが小さな渦巻銀河を飲み込んだ際に引き起こされた、新たな星形成の爆発です。', catalog: 'Cen A HII' },
          ko: { type: '별 형성 영역 · 센타우루스자리 A', facts: [['포함', '젊은 파란색 성단'], ['촉발', '은하 병합']], desc: '은하의 뒤틀린 어두운 먼지 띠를 따라 분홍빛으로 빛나는 수소 가스와 뜨거운 파란색 성단이 늘어서 있습니다. 센타우루스자리 A가 더 작은 나선 은하를 집어삼키면서 촉발된 새로운 별 탄생의 폭발입니다.', catalog: 'Cen A HII' }
        },
        img: 'images/cena-sfr.jpg', credit: 'NASA/ESA Hubble' },
      { parent: 'M33', lp: new THREE.Vector3(58, 4, 30), feat: { kind: 'nebula', size: 0.75, color: 0xff6a98, stars: 34 }, // smaller glow: the painted shell shows through
        t: { en: ['NGC 604', 'giant nebula'], hans: ['NGC 604', '巨型星云'], hant: ['NGC 604', '巨型星雲'], ja: ['NGC 604', '巨大星雲'], ko: ['NGC 604', '거대 성운'] },
        info: {
          en: { type: 'Giant nebula · inside M33', facts: [['Type', 'Giant HII region'], ['Span', '~1,300 ly']], desc: 'One of the largest star-forming nebulae in the Local Group — a cavern of glowing hydrogen roughly 50 times wider than the Orion Nebula, lit by more than 200 massive newborn stars in the Triangulum Galaxy’s northern spiral arm.', catalog: 'NGC 604' },
          hans: { type: '巨型星云 · M33 内', facts: [['类型', '巨型电离氢区'], ['跨度', '约 1,300 光年']], desc: '本星系群中最大的恒星形成星云之一——一个由发光氢气构成的巨大洞窟，规模约为猎户座大星云的 50 倍，被三角座星系北侧旋臂中 200 多颗大质量新生恒星照亮。', catalog: 'NGC 604' },
          hant: { type: '巨型星雲 · M33 內', facts: [['類型', '巨型電離氫區'], ['跨度', '約 1,300 光年']], desc: '本星系群中最大的恆星形成星雲之一——一個由發光氫氣構成的巨大洞窟，規模約為獵戶座大星雲的 50 倍，被三角座星系北側旋臂中 200 多顆大質量新生恆星照亮。', catalog: 'NGC 604' },
          ja: { type: '巨大星雲 · M33 の内部', facts: [['種類', '巨大HII領域'], ['広がり', '約1,300光年']], desc: '局部銀河群で最大級の星形成星雲の一つで、輝く水素ガスが広がる巨大な空洞です。その大きさはオリオン大星雲のおよそ50倍におよび、さんかく座銀河の北側の渦状腕で200個を超える大質量の生まれたての星々に照らされています。', catalog: 'NGC 604' },
          ko: { type: '거대 성운 · M33 내부', facts: [['유형', '거대 HII 영역'], ['크기', '약 1,300광년']], desc: '국부 은하군에서 가장 큰 별 형성 성운 중 하나로, 빛나는 수소 가스로 이루어진 거대한 동굴입니다. 크기는 오리온 성운의 약 50배에 달하며, 삼각형자리 은하의 북쪽 나선팔에서 200개가 넘는 갓 태어난 무거운 별들이 이 성운을 밝히고 있습니다.', catalog: 'NGC 604' }
        },
        img: 'images/ngc604.jpg', credit: 'NASA/Hubble Heritage (AURA/STScI)' },
      { parent: 'M87', lp: new THREE.Vector3(68, 55, 36), feat: { kind: 'jet', dir: new THREE.Vector3(0.72, 0.58, 0.38).normalize(), len: 210, oneSided: true, plasmaOnly: true, lobe: 0xaac8f4, lobeTip: 0x7c9ede, lobeOp: 0.32, flare: 0.13, curve: 0.08, streamFrom: 0xffffff, streamTo: 0xbcd6ff, streamLen: 0.7, streamN: 1400, streamGain: 0.7 },
        t: { en: ['Relativistic jet', 'from M87*'], hans: ['相对论喷流', '来自 M87*'], hant: ['相對論噴流', '來自 M87*'], ja: ['相対論的ジェット', 'M87* から'], ko: ['상대론적 제트', 'M87*에서'] },
        info: {
          en: { type: 'Relativistic jet · M87', facts: [['Length', '~5,000 ly'], ['Source', 'M87* black hole']], desc: 'A narrow beam of plasma fired outward at nearly the speed of light by M87’s central black hole — the same giant imaged by the Event Horizon Telescope. Spotted in 1918, it was the first jet ever discovered: a straight blue searchlight of glowing knots crossing the elliptical galaxy’s golden haze.', catalog: 'M87 jet' },
          hans: { type: '相对论喷流 · M87', facts: [['长度', '约 5,000 光年'], ['来源', 'M87* 黑洞']], desc: '由 M87 中心黑洞以接近光速向外喷射的狭窄等离子体束——正是事件视界望远镜拍摄的那个巨型黑洞。它于 1918 年被发现，是人类发现的第一条喷流：一道由发光亮结组成的笔直蓝色探照灯光束，穿过这座椭圆星系的金色光晕。', catalog: 'M87 jet' },
          hant: { type: '相對論噴流 · M87', facts: [['長度', '約 5,000 光年'], ['來源', 'M87* 黑洞']], desc: '由 M87 中心黑洞以接近光速向外噴射的狹窄電漿束——正是事件視界望遠鏡拍攝的那個巨型黑洞。它於 1918 年被發現，是人類發現的第一條噴流：一道由發光亮結組成的筆直藍色探照燈光束，穿過這座橢圓星系的金色光暈。', catalog: 'M87 jet' },
          ja: { type: '相対論的ジェット · M87', facts: [['長さ', '約 5,000 光年'], ['源', 'M87* ブラックホール']], desc: 'M87 中心のブラックホールがほぼ光速で外へ噴き出す細いプラズマのビームで、イベント・ホライズン・テレスコープが撮影したあの巨大ブラックホールそのものが源です。1918 年に発見された史上初のジェットで、輝くノットが連なる真っ直ぐな青いサーチライトのように、楕円銀河の金色のもやを横切っています。', catalog: 'M87 jet' },
          ko: { type: '상대론적 제트 · M87', facts: [['길이', '약 5,000광년'], ['원천', 'M87* 블랙홀']], desc: 'M87 중심의 블랙홀이 거의 빛의 속도로 내뿜는 좁은 플라스마 빔으로, 그 블랙홀은 사건의 지평선 망원경이 촬영한 바로 그 거대 블랙홀입니다. 1918년에 발견된 사상 최초의 제트이며, 빛나는 매듭들이 이어진 곧은 파란 탐조등 빛줄기가 타원 은하의 황금빛 안개를 가로지릅니다.', catalog: 'M87 jet' }
        },
        img: 'images/m87-jet.jpg', credit: 'NASA/Hubble Heritage (STScI/AURA)' },
      { parent: 'LMC', lp: new THREE.Vector3(-8, 3, -27), feat: { kind: 'nebula', size: 0.8, color: 0xff5f98, stars: 46 }, // the plate's 30 Dor; the painting carries the nebula
        t: { en: ['Tarantula Nebula', 'star factory'], hans: ['蜘蛛星云', '恒星工厂'], hant: ['蜘蛛星雲', '恆星工廠'], ja: ['タランチュラ星雲', '星の工場'], ko: ['타란툴라 성운', '별 공장'] },
        info: {
          en: { type: 'Nebula · inside the LMC', facts: [['Type', 'Giant HII region'], ['Heart', 'R136 super cluster']], desc: 'The most furious star factory in the Local Group. At its core sits R136, a cluster packed with the most massive stars known — some 200 times the Sun’s mass. Were it as close to us as the Orion Nebula, it would cast shadows at night.', catalog: '30 Doradus' },
          hans: { type: '星云 · 大麦哲伦云内', facts: [['类型', '巨型电离氢区'], ['核心', 'R136 超星团']], desc: '本星系群中最狂暴的恒星工厂。其核心是 R136 星团，聚集着已知质量最大的恒星——有些达太阳质量的 200 倍。若它像猎户座大星云那样靠近我们，夜晚甚至能投下影子。', catalog: '30 Doradus' },
          hant: { type: '星雲 · 大麥哲倫雲內', facts: [['類型', '巨型電離氫區'], ['核心', 'R136 超星團']], desc: '本星系群中最狂暴的恆星工廠。其核心是 R136 星團，聚集著已知質量最大的恆星——有些達太陽質量的 200 倍。若它像獵戶座大星雲那樣靠近我們，夜晚甚至能投下影子。', catalog: '30 Doradus' },
          ja: { type: '星雲 · 大マゼラン雲の内部', facts: [['種類', '巨大 HII 領域'], ['中心', 'R136 超星団']], desc: '局部銀河群で最も激しい星の工場です。その中心には R136 という星団があり、太陽の約 200 倍もの質量を持つ、既知で最も重い星々がひしめいています。もしオリオン大星雲ほど近くにあれば、夜に影ができるほど明るく輝くでしょう。', catalog: '30 Doradus' },
          ko: { type: '성운 · 대마젤란은하 내부', facts: [['종류', '거대 HII 영역'], ['중심', 'R136 초성단']], desc: '국부 은하군에서 가장 격렬한 별 공장입니다. 중심에는 R136 성단이 자리하며, 태양 질량의 약 200배에 이르는, 알려진 것 중 가장 무거운 별들이 모여 있습니다. 오리온 성운만큼 가까이 있다면 밤에 그림자를 드리울 만큼 밝을 것입니다.', catalog: '30 Doradus' }
        },
        img: 'images/tarantula.jpg', credit: 'ESA/Hubble & NASA, C. Murray, E. Sabbi' },
      { parent: 'LMC', lp: new THREE.Vector3(-12, 0, -12), feat: { kind: 'supernova' },
        t: { en: ['SN 1987A', 'supernova of 1987'], hans: ['SN 1987A', '1987年的超新星'], hant: ['SN 1987A', '1987年的超新星'], ja: ['SN 1987A', '1987年の超新星'], ko: ['SN 1987A', '1987년의 초신성'] },
        info: {
          en: { type: 'Supernova remnant · inside the LMC', facts: [['Seen', '23 Feb 1987'], ['Legacy', 'nearest modern supernova']], desc: 'The closest supernova observed since the invention of the telescope. Its light — and a burst of neutrinos — swept past Earth in February 1987, and Hubble still watches its glowing ring flare as the blast wave slams into gas shed by the dying star.', catalog: 'SN 1987A' },
          hans: { type: '超新星遗迹 · 大麦哲伦云内', facts: [['观测', '1987年2月23日'], ['地位', '现代最近的超新星']], desc: '自望远镜发明以来观测到的最近的超新星。1987年2月，它的光——以及一阵中微子暴——掠过地球，而哈勃至今仍在注视其发光的环：每当激波撞上垂死恒星抛出的气体，光环便会骤然增亮。', catalog: 'SN 1987A' },
          hant: { type: '超新星殘骸 · 大麥哲倫雲內', facts: [['觀測', '1987年2月23日'], ['地位', '現代最近的超新星']], desc: '自望遠鏡發明以來觀測到的最近的超新星。1987年2月，它的光——以及一陣微中子暴——掠過地球，而哈伯至今仍在注視其發光的環：每當激波撞上垂死恆星拋出的氣體，光環便會驟然增亮。', catalog: 'SN 1987A' },
          ja: { type: '超新星残骸 · 大マゼラン雲の内部', facts: [['観測', '1987年2月23日'], ['意義', '現代で最も近い超新星']], desc: '望遠鏡の発明以来、観測された中で最も近い超新星です。1987年2月、その光はニュートリノのバーストとともに地球を駆け抜けました。ハッブルは今も、衝撃波が死にゆく星の放出したガスに衝突するたびに輝きを増す光のリングを見つめ続けています。', catalog: 'SN 1987A' },
          ko: { type: '초신성 잔해 · 대마젤란은하 내부', facts: [['관측', '1987년 2월 23일'], ['의의', '현대의 가장 가까운 초신성']], desc: '망원경이 발명된 이후 관측된 가장 가까운 초신성입니다. 1987년 2월, 그 빛은 중성미자 폭발과 함께 지구를 스쳐 지나갔고, 허블은 지금도 충격파가 죽어가는 별이 내뿜은 가스와 충돌할 때마다 환하게 타오르는 빛의 고리를 지켜보고 있습니다.', catalog: 'SN 1987A' }
        },
        img: 'images/sn1987a.jpg', credit: 'ESA/Hubble & NASA' },
      { parent: 'SMC', lp: new THREE.Vector3(-5, 2, 30), feat: { kind: 'nebula', size: 0.5, color: 0xff8fc0, stars: 20 }, // smaller glow: the painting carries the nebula
        t: { en: ['NGC 346', 'stellar nursery'], hans: ['NGC 346', '恒星摇篮'], hant: ['NGC 346', '恆星搖籃'], ja: ['NGC 346', '星のゆりかご'], ko: ['NGC 346', '별의 요람'] },
        info: {
          en: { type: 'Star-forming region · inside the SMC', facts: [['Type', 'Young cluster + nebula'], ['Stars', '~2,500 infants']], desc: 'The brightest stellar nursery of the Small Magellanic Cloud — thousands of infant stars carving glowing arcs of gas. Its nearly primordial chemistry gives astronomers a window onto how stars formed in the early universe.', catalog: 'NGC 346' },
          hans: { type: '恒星形成区 · 小麦哲伦云内', facts: [['类型', '年轻星团＋星云'], ['恒星', '约 2,500 颗新生恒星']], desc: '小麦哲伦云中最明亮的恒星摇篮——数千颗新生恒星正在雕刻出发光的气体弧。它近乎原初的化学组成，为天文学家打开了一扇窗，得以窥见早期宇宙中恒星如何形成。', catalog: 'NGC 346' },
          hant: { type: '恆星形成區 · 小麥哲倫雲內', facts: [['類型', '年輕星團＋星雲'], ['恆星', '約 2,500 顆新生恆星']], desc: '小麥哲倫雲中最明亮的恆星搖籃——數千顆新生恆星正在雕刻出發光的氣體弧。它近乎原初的化學組成，為天文學家打開了一扇窗，得以窺見早期宇宙中恆星如何形成。', catalog: 'NGC 346' },
          ja: { type: '星形成領域 · 小マゼラン雲の内部', facts: [['種類', '若い星団＋星雲'], ['星', '生まれたての星 約2,500個']], desc: '小マゼラン雲で最も明るい星のゆりかごで、数千個の生まれたての星が輝くガスの弧を刻んでいます。ほぼ原始的な化学組成をもつため、初期宇宙で星がどのように形成されたかを知る窓を天文学者に与えてくれます。', catalog: 'NGC 346' },
          ko: { type: '별 형성 영역 · 소마젤란은하 내부', facts: [['유형', '젊은 성단＋성운'], ['별', '갓 태어난 별 약 2,500개']], desc: '소마젤란은하에서 가장 밝은 별의 요람으로, 수천 개의 갓 태어난 별들이 빛나는 가스 아치를 새기고 있습니다. 거의 원시적인 화학 조성 덕분에 천문학자들은 초기 우주에서 별이 어떻게 형성되었는지 들여다볼 수 있습니다.', catalog: 'NGC 346' }
        },
        img: 'images/ngc346.jpg', credit: 'NASA/ESA, A. Nota (STScI/ESA)' }
    ];
    CHILDREN.forEach(function (c) {
      var el = document.createElement('div');
      el.className = 'beacon child';
      if (c.info.en.catalog === 'M87 jet') el.dataset.videoTarget = 'child-m87-jet';
      if (c.info.en.catalog === 'Cen A jet') el.dataset.videoTarget = 'child-centaurus-a-jet';
      el.style.display = 'none'; // hidden until first positioned — see the DEFS loop note
      el.innerHTML = '<div class="b-mark"><span class="b-ring"></span><span class="b-ring r2"></span><span class="b-dot"></span></div><div class="b-label"></div>';
      host.appendChild(el); keyActivate(el);
      var idx = BEACONS.length;
      (function (i) { el.addEventListener('click', function (e) { e.stopPropagation(); selectBeacon(i); }); })(idx);
      BEACONS.push({ el: el, t: c.t, info: c.info, child: true, parent: c.parent, lp: c.lp, feat: c.feat, img: c.img, credit: c.credit, parentPts: null, feature: null, shown: false });
    });
    setBeaconLang(beaconLang);
    var langSel = document.getElementById('lang');
    if (langSel) { langSel.value = beaconLang; langSel.addEventListener('change', function () { setBeaconLang(langSel.value); }); }
  })();
  // self-check: every beacon has complete info in all 3 languages (run from console)
  function assertBeaconInfo() {
    var langs = ['en', 'hans', 'hant', 'ja', 'ko'], fields = ['type', 'distance', 'constellation', 'facts', 'desc'];
    BEACONS.forEach(function (b, i) {
      if (!b.info) throw new Error('beacon ' + i + ' missing info');
      langs.forEach(function (L) {
        var o = b.info[L];
        if (!o) throw new Error('beacon ' + i + ' missing info.' + L);
        fields.forEach(function (f) { if (b.child && (f === 'distance' || f === 'constellation')) return; if (o[f] == null) throw new Error('beacon ' + i + ' info.' + L + '.' + f + ' missing'); });
        if (!Array.isArray(o.facts)) throw new Error('beacon ' + i + ' info.' + L + '.facts not array');
      });
    });
    return true;
  }

  // ── Solar System source data: physical values stay in the cards; visual scale is separate ──
  var SOLAR_LANGS = ['en', 'hans', 'hant', 'ja', 'ko'];
  var SOLAR_FACT_LABELS = {
    en: ['Surface gravity', 'Notable feature'], hans: ['表面重力', '显著特征'], hant: ['表面重力', '顯著特徵'],
    ja: ['表面重力', '特徴'], ko: ['표면 중력', '주요 특징']
  };
  var SOLAR_CARD_LABELS = {
    en: { distance: 'Mean distance: ', diameter: 'Diameter: ', orbit: 'Orbital period: ', rotation: 'Rotation: ', temperature: 'Temperature: ', moons: 'Known moons: ', sunBodies: 'Planets / dwarf planets: 8 / 5', catalog: 'Catalog: ' },
    hans: { distance: '平均距离：', diameter: '直径：', orbit: '公转周期：', rotation: '自转周期：', temperature: '温度：', moons: '已知卫星：', sunBodies: '行星 / 矮行星：8 / 5', catalog: '星表：' },
    hant: { distance: '平均距離：', diameter: '直徑：', orbit: '公轉週期：', rotation: '自轉週期：', temperature: '溫度：', moons: '已知衛星：', sunBodies: '行星 / 矮行星：8 / 5', catalog: '星表：' },
    ja: { distance: '平均距離：', diameter: '直径：', orbit: '公転周期：', rotation: '自転周期：', temperature: '温度：', moons: '確認済みの衛星：', sunBodies: '惑星 / 準惑星：8 / 5', catalog: 'カタログ：' },
    ko: { distance: '평균 거리: ', diameter: '지름: ', orbit: '공전 주기: ', rotation: '자전 주기: ', temperature: '온도: ', moons: '확인된 위성: ', sunBodies: '행성 / 왜행성: 8 / 5', catalog: '목록: ' }
  };
  var SOLAR_CATALOG_NAMES = {
    en: { Mercury: 'Mercury', Venus: 'Venus', Earth: 'Earth', Moon: 'Moon', Mars: 'Mars', Ceres: 'Ceres', Jupiter: 'Jupiter', Io: 'Io', Europa: 'Europa', Ganymede: 'Ganymede', Callisto: 'Callisto', Saturn: 'Saturn', Titan: 'Titan', Uranus: 'Uranus', Neptune: 'Neptune', Triton: 'Triton', Pluto: 'Pluto' },
    hans: { Mercury: '水星', Venus: '金星', Earth: '地球', Moon: '月球', Mars: '火星', Ceres: '谷神星', Jupiter: '木星', Io: '木卫一', Europa: '木卫二', Ganymede: '木卫三', Callisto: '木卫四', Saturn: '土星', Titan: '土卫六', Uranus: '天王星', Neptune: '海王星', Triton: '海卫一', Pluto: '冥王星' },
    hant: { Mercury: '水星', Venus: '金星', Earth: '地球', Moon: '月球', Mars: '火星', Ceres: '穀神星', Jupiter: '木星', Io: '木衛一', Europa: '木衛二', Ganymede: '木衛三', Callisto: '木衛四', Saturn: '土星', Titan: '土衛六', Uranus: '天王星', Neptune: '海王星', Triton: '海衛一', Pluto: '冥王星' },
    ja: { Mercury: '水星', Venus: '金星', Earth: '地球', Moon: '月', Mars: '火星', Ceres: 'ケレス', Jupiter: '木星', Io: 'イオ', Europa: 'エウロパ', Ganymede: 'ガニメデ', Callisto: 'カリスト', Saturn: '土星', Titan: 'タイタン', Uranus: '天王星', Neptune: '海王星', Triton: 'トリトン', Pluto: '冥王星' },
    ko: { Mercury: '수성', Venus: '금성', Earth: '지구', Moon: '달', Mars: '화성', Ceres: '세레스', Jupiter: '목성', Io: '이오', Europa: '유로파', Ganymede: '가니메데', Callisto: '칼리스토', Saturn: '토성', Titan: '타이탄', Uranus: '천왕성', Neptune: '해왕성', Triton: '트리톤', Pluto: '명왕성' }
  };
  var SOLAR_FEATURES = {
    sun: { en: 'Sunspots, prominences and solar storms', hans: '太阳黑子、日珥与太阳风暴', hant: '太陽黑子、日珥與太陽風暴', ja: '太陽黒点・プロミネンス・太陽嵐', ko: '태양 흑점·홍염·태양 폭풍' },
    mercury: { en: 'Smallest and innermost planet', hans: '最小、最靠近太阳的行星', hant: '最小、最靠近太陽的行星', ja: '最小かつ最も内側の惑星', ko: '가장 작고 안쪽에 있는 행성' },
    venus: { en: 'Runaway greenhouse atmosphere', hans: '失控温室效应大气', hant: '失控溫室效應大氣', ja: '暴走温室効果の大気', ko: '폭주 온실효과 대기' },
    earth: { en: 'Only known world with life', hans: '唯一已知存在生命的世界', hant: '唯一已知存在生命的世界', ja: '生命が確認されている唯一の世界', ko: '생명체가 알려진 유일한 세계' },
    moon: { en: 'Tidally locked to Earth', hans: '与地球潮汐锁定', hant: '與地球潮汐鎖定', ja: '地球と潮汐固定', ko: '지구와 조석 고정' },
    mars: { en: 'Olympus Mons and Valles Marineris', hans: '奥林帕斯山与水手峡谷', hant: '奧林帕斯山與水手峽谷', ja: 'オリンポス山とマリネリス峡谷', ko: '올림푸스산과 매리너리스 협곡' },
    ceres: { en: 'Largest object in the asteroid belt', hans: '小行星带最大的天体', hant: '小行星帶最大的天體', ja: '小惑星帯で最大の天体', ko: '소행성대에서 가장 큰 천체' },
    jupiter: { en: 'Great Red Spot storm', hans: '大红斑风暴', hant: '大紅斑風暴', ja: '大赤斑の嵐', ko: '대적점 폭풍' },
    io: { en: 'Most volcanically active world', hans: '火山活动最活跃的世界', hant: '火山活動最活躍的世界', ja: '最も火山活動が活発な世界', ko: '화산 활동이 가장 활발한 세계' },
    europa: { en: 'Global ocean beneath ice', hans: '冰层下的全球海洋', hant: '冰層下的全球海洋', ja: '氷の下にある全球的な海', ko: '얼음 아래의 전 지구적 바다' },
    ganymede: { en: 'Largest moon; intrinsic magnetic field', hans: '最大卫星；拥有自身磁场', hant: '最大衛星；擁有自身磁場', ja: '最大の衛星；固有磁場をもつ', ko: '가장 큰 위성; 자체 자기장 보유' },
    callisto: { en: 'Ancient heavily cratered surface', hans: '古老、布满陨坑的表面', hant: '古老、布滿隕坑的表面', ja: '古くクレーターに覆われた表面', ko: '오래되고 충돌구가 빽빽한 표면' },
    saturn: { en: 'Bright rings made of ice and rock', hans: '由冰和岩石组成的明亮光环', hant: '由冰和岩石組成的明亮光環', ja: '氷と岩石でできた明るい環', ko: '얼음과 암석으로 된 밝은 고리' },
    titan: { en: 'Dense nitrogen atmosphere and methane seas', hans: '浓厚氮气大气与甲烷海洋', hant: '濃厚氮氣大氣與甲烷海洋', ja: '濃い窒素大気とメタンの海', ko: '짙은 질소 대기와 메탄 바다' },
    uranus: { en: 'Rotates on its side', hans: '侧躺着自转', hant: '側躺著自轉', ja: '横倒しで自転する', ko: '옆으로 누워 자전' },
    neptune: { en: 'Fastest winds in the Solar System', hans: '太阳系最快的风', hant: '太陽系最快的風', ja: '太陽系最速の風', ko: '태양계에서 가장 빠른 바람' },
    triton: { en: 'Likely captured Kuiper Belt object', hans: '可能被捕获的柯伊伯带天体', hant: '可能被捕獲的古柏帶天體', ja: 'カイパーベルトから捕獲された可能性', ko: '카이퍼대에서 포획됐을 가능성' },
    pluto: { en: 'Heart-shaped Tombaugh Regio', hans: '心形汤博区', hant: '心形湯博區', ja: 'ハート形のトンボー地域', ko: '하트 모양의 톰보 지역' }
  };
  function solarLocalizedCatalog(s, L) {
    var text = s.catalog, names = SOLAR_CATALOG_NAMES[L];
    Object.keys(SOLAR_CATALOG_NAMES.en).forEach(function (name) { text = text.split(name).join(names[name]); });
    return SOLAR_CARD_LABELS[L].catalog + text;
  }
  function solarCardMeasurements(s, L) {
    var label = SOLAR_CARD_LABELS[L], temperature = s.id === 'sun' ? '5,500 °C / ~15,000,000 °C' : s.temperature.replace(' average', '').replace(' cloud tops', '').replace(' to ', '–');
    return {
      distance: label.distance + (s.id === 'sun' ? '0 AU' : s.distance.replace(/ from .*/, '')),
      diameter: label.diameter + s.diameter,
      orbit: label.orbit + (s.id === 'sun' ? '~230 Myr' : s.periodDays + ' d'),
      rotation: label.rotation + (s.id === 'sun' ? '25–35 d' : s.rotationHours + ' h'),
      temperature: label.temperature + temperature,
      moons: s.id === 'sun' ? label.sunBodies : label.moons + s.moons.replace(' confirmed', '')
    };
  }
  function solarBody(s) {
    var info = {};
    SOLAR_LANGS.forEach(function (L) {
      var c = s.copy[L], m = solarCardMeasurements(s, L);
      info[L] = {
        name: c[0], type: c[1], distance: m.distance, diameter: m.diameter, orbit: m.orbit,
        rotation: m.rotation, temperature: m.temperature, moons: m.moons,
        facts: [[SOLAR_FACT_LABELS[L][0], s.gravity], [SOLAR_FACT_LABELS[L][1], SOLAR_FEATURES[s.id][L]]],
        desc: c[2], catalog: solarLocalizedCatalog(s, L)
      };
    });
    return {
      id: s.id, parent: s.parent, kind: s.kind, radiusKm: s.radiusKm, distanceAu: s.distanceAu,
      periodDays: s.periodDays, rotationHours: s.rotationHours, inclinationDeg: s.inclinationDeg,
      eccentricity: s.eccentricity, phase: s.phase, tiltDeg: s.tiltDeg, color: s.color,
      maps: s.maps, cardImage: s.cardImage, cardCredit: s.cardCredit, info: info
    };
  }
  var SOLAR_BODIES = [
    solarBody({ id: 'sun', parent: null, kind: 'star', radiusKm: 695700, distanceAu: 0, periodDays: 0, rotationHours: 609.12, inclinationDeg: 7.25, eccentricity: 0, phase: 0, tiltDeg: 7.25, color: '#ffd36b', maps: {}, cardImage: 'images/solar-system/cards/sun.jpg', cardCredit: 'NASA/SDO (AIA)',
      distance: 'Centre of the Solar System', diameter: '1,391,400 km', orbit: 'Galactic orbit: ~230 million years', rotation: '25–35 days (differential)', temperature: '5,500 °C photosphere; ~15 million °C core', moons: '8 planets; 5 dwarf planets', gravity: '274 m/s²', feature: 'Contains 99.86% of Solar System mass', catalog: 'Sol / G2V',
      copy: { en: ['Sun', 'Star', 'The Sun is the G-type star whose light and gravity define our home system. Watch closely: dark sunspot groups drift across the disc as it rotates, and every minute or so a plasma storm erupts from the edge.'], hans: ['太阳', '恒星', '太阳是一颗 G 型恒星；它的光和引力塑造了我们的家园星系。仔细观察：暗色的黑子群随自转缓缓移过日面，边缘还会不时喷发出等离子体风暴。'], hant: ['太陽', '恆星', '太陽是一顆 G 型恆星；它的光和引力塑造了我們的家園星系。仔細觀察：暗色的黑子群隨自轉緩緩移過日面，邊緣還會不時噴發出等離子體風暴。'], ja: ['太陽', '恒星', '太陽は、光と重力で私たちの太陽系を形づくる G 型星です。よく見ると、暗い黒点群が自転とともにゆっくり日面を横切り、縁からはときおりプラズマの嵐が噴き上がります。'], ko: ['태양', '항성', '태양은 빛과 중력으로 우리 태양계를 이루는 G형 항성입니다. 자세히 보면 어두운 흑점 무리가 자전을 따라 천천히 태양 면을 가로지르고, 가장자리에서는 이따금 플라스마 폭풍이 솟아오릅니다.'] } }),
    solarBody({ id: 'mercury', parent: null, kind: 'planet', radiusKm: 2439.7, distanceAu: 0.387, periodDays: 87.969, rotationHours: 1407.6, inclinationDeg: 7.005, eccentricity: 0.2056, phase: 0.9, tiltDeg: 0.034, color: '#b9a38c', maps: { albedo: 'images/solar-system/mercury.jpg' }, cardImage: 'images/solar-system/cards/mercury.jpg', cardCredit: 'NASA/JHU APL/Carnegie · MESSENGER',
      distance: '0.387 AU from the Sun', diameter: '4,879 km', orbit: '87.969 days', rotation: '1,407.6 hours', temperature: '−173 to 427 °C', moons: '0', gravity: '3.7 m/s²', feature: 'Smallest and innermost planet', catalog: 'Mercury',
      copy: { en: ['Mercury', 'Terrestrial planet', 'Mercury is a cratered, airless world and the fastest planet around the Sun.'], hans: ['水星', '类地行星', '水星是布满陨坑、几乎没有大气的世界，也是绕太阳运行最快的行星。'], hant: ['水星', '類地行星', '水星是布滿隕坑、幾乎沒有大氣的世界，也是繞太陽運行最快的行星。'], ja: ['水星', '地球型惑星', '水星はクレーターに覆われた大気の薄い世界で、太陽を最も速く回ります。'], ko: ['수성', '지구형 행성', '수성은 충돌구가 많은 대기 없는 세계이며 태양을 가장 빠르게 공전합니다.'] } }),
    solarBody({ id: 'venus', parent: null, kind: 'planet', radiusKm: 6051.8, distanceAu: 0.723, periodDays: 224.701, rotationHours: -5832.5, inclinationDeg: 3.3947, eccentricity: 0.0068, phase: 3.6, tiltDeg: 177.36, color: '#e7c17b', maps: { albedo: 'images/solar-system/venus.jpg' }, cardImage: 'images/solar-system/cards/venus.jpg', cardCredit: 'NASA · Mariner 10',
      distance: '0.723 AU from the Sun', diameter: '12,104 km', orbit: '224.701 days', rotation: '−5,832.5 hours (retrograde)', temperature: '464 °C average', moons: '0', gravity: '8.87 m/s²', feature: 'Runaway greenhouse atmosphere', catalog: 'Venus',
      copy: { en: ['Venus', 'Terrestrial planet', 'Venus is Earth-sized but wrapped in a dense carbon-dioxide atmosphere and sulfuric-acid clouds.'], hans: ['金星', '类地行星', '金星与地球大小相近，却被浓厚的二氧化碳大气和硫酸云层包裹。'], hant: ['金星', '類地行星', '金星與地球大小相近，卻被濃厚的二氧化碳大氣和硫酸雲層包裹。'], ja: ['金星', '地球型惑星', '金星は地球に近い大きさですが、濃い二酸化炭素大気と硫酸の雲に包まれています。'], ko: ['금성', '지구형 행성', '금성은 지구와 비슷한 크기지만 짙은 이산화탄소 대기와 황산 구름에 싸여 있습니다.'] } }),
    solarBody({ id: 'earth', parent: null, kind: 'planet', radiusKm: 6371, distanceAu: 1, periodDays: 365.256, rotationHours: 23.934, inclinationDeg: 0, eccentricity: 0.0167, phase: 5.8, tiltDeg: 23.44, color: '#5b93db', maps: { albedo: 'images/solar-system/earth.jpg', clouds: 'images/solar-system/earth-clouds.png', night: 'images/solar-system/earth-night.jpg' }, cardImage: 'images/solar-system/cards/earth.jpg', cardCredit: 'NASA · Apollo 17',
      distance: '1 AU from the Sun', diameter: '12,742 km', orbit: '365.256 days', rotation: '23.934 hours', temperature: '15 °C average', moons: '1', gravity: '9.81 m/s²', feature: 'Only known world with life', catalog: 'Earth / Terra',
      copy: { en: ['Earth', 'Terrestrial planet', 'Earth is an ocean world with a nitrogen–oxygen atmosphere and the only known biosphere.'], hans: ['地球', '类地行星', '地球是一颗拥有海洋和氮氧大气的行星，也是目前唯一已知存在生物圈的世界。'], hant: ['地球', '類地行星', '地球是一顆擁有海洋和氮氧大氣的行星，也是目前唯一已知存在生物圈的世界。'], ja: ['地球', '地球型惑星', '地球は海と窒素・酸素の大気をもち、知られている唯一の生物圏を育む惑星です。'], ko: ['지구', '지구형 행성', '지구는 바다와 질소·산소 대기를 지닌 행성으로 알려진 유일한 생물권을 품고 있습니다.'] } }),
    solarBody({ id: 'moon', parent: 'earth', kind: 'moon', radiusKm: 1737.4, distanceAu: 0.00257, periodDays: 27.322, rotationHours: 655.7, inclinationDeg: 5.145, eccentricity: 0.0549, phase: 0.75, tiltDeg: 6.68, color: '#c9c5bd', maps: { albedo: 'images/solar-system/moon.jpg', normal: 'images/solar-system/moon-normal.png' }, cardImage: 'images/solar-system/cards/moon.jpg', cardCredit: 'NASA/GSFC/ASU · LRO',
      distance: '384,400 km from Earth', diameter: '3,475 km', orbit: '27.322 days', rotation: '655.7 hours (synchronous)', temperature: '−173 to 127 °C', moons: '0', gravity: '1.62 m/s²', feature: 'Tidally locked to Earth', catalog: 'Moon / Luna',
      copy: { en: ['Moon', 'Natural satellite', 'Earth’s Moon is a tidally locked rocky companion that stabilizes Earth’s axial wobble and drives tides.'], hans: ['月球', '天然卫星', '月球是与地球潮汐锁定的岩石伙伴，帮助稳定地轴摆动并引发潮汐。'], hant: ['月球', '天然衛星', '月球是與地球潮汐鎖定的岩石夥伴，幫助穩定地軸擺動並引發潮汐。'], ja: ['月', '衛星', '月は地球と潮汐固定された岩石の伴星で、地軸の揺れを安定させ潮汐を起こします。'], ko: ['달', '자연위성', '달은 지구와 조석 고정된 암석 동반천체로 지축의 흔들림을 안정시키고 조석을 만듭니다.'] } }),
    solarBody({ id: 'mars', parent: null, kind: 'planet', radiusKm: 3389.5, distanceAu: 1.524, periodDays: 686.98, rotationHours: 24.623, inclinationDeg: 1.85, eccentricity: 0.0934, phase: 1.9, tiltDeg: 25.19, color: '#cf7550', maps: { albedo: 'images/solar-system/mars.jpg', normal: 'images/solar-system/mars-normal.png' }, cardImage: 'images/solar-system/cards/mars.jpg', cardCredit: 'NASA/JPL-Caltech/USGS · Viking',
      distance: '1.524 AU from the Sun', diameter: '6,780 km', orbit: '686.98 days', rotation: '24.623 hours', temperature: '−63 °C average', moons: '2', gravity: '3.71 m/s²', feature: 'Olympus Mons and Valles Marineris', catalog: 'Mars',
      copy: { en: ['Mars', 'Terrestrial planet', 'Mars is a cold desert world whose iron-rich dust gives it its distinctive red colour.'], hans: ['火星', '类地行星', '火星是一颗寒冷的沙漠世界，富含铁的尘土赋予它独特的红色。'], hant: ['火星', '類地行星', '火星是一顆寒冷的沙漠世界，富含鐵的塵土賦予它獨特的紅色。'], ja: ['火星', '地球型惑星', '火星は鉄分の多い塵によって赤く見える、寒冷な砂漠の世界です。'], ko: ['화성', '지구형 행성', '화성은 철이 풍부한 먼지 때문에 붉게 보이는 차가운 사막 세계입니다.'] } }),
    solarBody({ id: 'ceres', parent: null, kind: 'dwarf-planet', radiusKm: 469.7, distanceAu: 2.7675, periodDays: 1681.63, rotationHours: 9.074, inclinationDeg: 10.594, eccentricity: 0.0758, phase: 4.7, tiltDeg: 4, color: '#aaa59d', maps: { albedo: 'images/solar-system/ceres.jpg' }, cardImage: 'images/solar-system/cards/ceres.jpg', cardCredit: 'NASA/JPL-Caltech · Dawn',
      distance: '2.77 AU from the Sun', diameter: '939 km', orbit: '1,681.63 days', rotation: '9.074 hours', temperature: '−105 °C average', moons: '0', gravity: '0.28 m/s²', feature: 'Largest object in the asteroid belt', catalog: '1 Ceres',
      copy: { en: ['Ceres', 'Dwarf planet', 'Ceres is the largest body in the asteroid belt and the only dwarf planet in the inner Solar System.'], hans: ['谷神星', '矮行星', '谷神星是小行星带中最大的天体，也是内太阳系唯一的矮行星。'], hant: ['穀神星', '矮行星', '穀神星是小行星帶中最大的天體，也是內太陽系唯一的矮行星。'], ja: ['ケレス', '準惑星', 'ケレスは小惑星帯で最大の天体で、内太陽系で唯一の準惑星です。'], ko: ['세레스', '왜행성', '세레스는 소행성대에서 가장 큰 천체이며 내태양계의 유일한 왜행성입니다.'] } }),
    solarBody({ id: 'jupiter', parent: null, kind: 'planet', radiusKm: 69911, distanceAu: 5.203, periodDays: 4332.59, rotationHours: 9.925, inclinationDeg: 1.304, eccentricity: 0.0489, phase: 0.2, tiltDeg: 3.13, color: '#d8ac7a', maps: { albedo: 'images/solar-system/jupiter.jpg' }, cardImage: 'images/solar-system/cards/jupiter.jpg', cardCredit: 'NASA/JPL/SSI · Cassini',
      distance: '5.203 AU from the Sun', diameter: '139,820 km', orbit: '4,332.59 days', rotation: '9.925 hours', temperature: '−110 °C cloud tops', moons: '95 confirmed', gravity: '24.79 m/s²', feature: 'Great Red Spot storm', catalog: 'Jupiter',
      copy: { en: ['Jupiter', 'Gas giant', 'Jupiter is the largest planet, a hydrogen-helium giant with storms larger than Earth.'], hans: ['木星', '气态巨行星', '木星是最大的行星，由氢和氦构成的巨行星拥有比地球更大的风暴。'], hant: ['木星', '氣態巨行星', '木星是最大的行星，由氫和氦構成的巨行星擁有比地球更大的風暴。'], ja: ['木星', 'ガス巨大惑星', '木星は最大の惑星で、地球より大きな嵐をもつ水素・ヘリウムの巨星です。'], ko: ['목성', '가스 거대행성', '목성은 가장 큰 행성이며 지구보다 큰 폭풍을 지닌 수소·헬륨 거대행성입니다.'] } }),
    solarBody({ id: 'io', parent: 'jupiter', kind: 'moon', radiusKm: 1821.6, distanceAu: 0.00282, periodDays: 1.769, rotationHours: 42.46, inclinationDeg: 0.04, eccentricity: 0.0041, phase: 0.8, tiltDeg: 0, color: '#e5c75d', maps: { albedo: 'images/solar-system/io.jpg' }, cardImage: 'images/solar-system/cards/io.jpg', cardCredit: 'NASA/JPL/Univ. Arizona · Galileo',
      distance: '421,700 km from Jupiter', diameter: '3,643 km', orbit: '1.769 days', rotation: '42.46 hours (synchronous)', temperature: '−130 °C average', moons: '0', gravity: '1.80 m/s²', feature: 'Most volcanically active world', catalog: 'Jupiter I / Io',
      copy: { en: ['Io', 'Natural satellite', 'Io is heated by Jupiter’s tides and is the most volcanically active body in the Solar System.'], hans: ['木卫一', '天然卫星', '木卫一受到木星潮汐加热，是太阳系火山活动最活跃的天体。'], hant: ['木衛一', '天然衛星', '木衛一受到木星潮汐加熱，是太陽系火山活動最活躍的天體。'], ja: ['イオ', '衛星', 'イオは木星の潮汐で加熱され、太陽系で最も火山活動が活発な天体です。'], ko: ['이오', '자연위성', '이오는 목성의 조석 가열을 받아 태양계에서 화산 활동이 가장 활발한 천체입니다.'] } }),
    solarBody({ id: 'europa', parent: 'jupiter', kind: 'moon', radiusKm: 1560.8, distanceAu: 0.00448, periodDays: 3.551, rotationHours: 85.23, inclination…50469 tokens truncated…원히 물을 쏟아붓고 있다. 가장 밝은 별 사달수드는 보기 드문 황색 초거성이고, 이 별자리에는 지구에서 가장 가까운 행성상 성운 중 하나인 나선 성운도 자리하고 있다."} } },
    { key:"pisces", symbol:"♓",
      t:{"en":"Pisces","hans":"双鱼座","hant":"雙魚座","ja":"うお座","ko":"물고기자리"},
      stars:[[23.286,3.28,3.7],[23.466,6.38,4.28],[23.666,5.63,4.13],[23.701,1.78,4.5],[23.449,1.26,4.94],[23.989,6.86,4.01],[0.811,7.59,4.43],[1.049,7.89,4.27],[1.69,5.49,4.44],[2.034,2.76,3.82],[1.757,9.16,4.26],[1.525,15.35,3.62]],
      starNames:["Gamma Psc","Theta Psc","Iota Psc","Lambda Psc","Kappa Psc","Omega Psc","Delta Psc","Epsilon Psc","Nu Psc","Alrescha","Omicron Psc","Alpherg"],
      lines:[[0,1],[1,2],[2,3],[3,4],[4,0],[2,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11]],
      info:{
        en:{"dates":"Feb 19 – Mar 20","brightest":"Alpherg (Eta Piscium)","desc":"In Greek myth, Pisces depicts Aphrodite and her son Eros, who turned into two fish tied together by a cord to escape the monster Typhon. The western fish is marked by the Circlet asterism, and the cords meet at the star Alrescha, \"the knot\". The constellation also contains the vernal equinox point, where the Sun crosses the celestial equator each March."},
        hans:{"dates":"2月19日 – 3月20日","brightest":"右更二（双鱼座η）","desc":"双鱼座源自希腊神话：爱与美之神阿佛洛狄忒与其子厄洛斯为躲避怪物提丰而化身为鱼，并用丝带系住彼此的尾巴。两条丝带在“天绳之结”外屏七（Alrescha）处相连。如今的春分点正位于双鱼座内，是太阳每年三月穿越天赤道的地方。"},
        hant:{"dates":"2月19日 – 3月20日","brightest":"右更二（雙魚座η）","desc":"雙魚座源自希臘神話：愛與美之神阿芙蘿黛蒂與其子厄洛斯為躲避怪物提豐而化身為魚，並以絲帶繫住彼此的尾巴。兩條絲帶在「天繩之結」外屏七（Alrescha）處相連。如今的春分點正位於雙魚座內，是太陽每年三月穿越天赤道之處。"},
        ja:{"dates":"2月19日 – 3月20日","brightest":"アルフェルグ（うお座η星）","desc":"ギリシャ神話では、うお座は怪物テュポンから逃れるため、女神アフロディテとその子エロスが2匹の魚に変身し、ひもで互いの体を結んだ姿とされます。西側の魚は「サーキュレット」と呼ばれる小さな星の輪で描かれ、2本のひもは「結び目」を意味する星アルレシャで結ばれています。この星座には春分点もあり、毎年3月に太陽が天の赤道を横切る場所となっています。"},
        ko:{"dates":"2월 19일 – 3월 20일","brightest":"알페르그(물고기자리 에타)","desc":"그리스 신화에서 물고기자리는 괴물 티폰을 피해 두 마리 물고기로 변신한 뒤 끈으로 서로를 묶은 아프로디테와 아들 에로스의 모습이다. 서쪽 물고기는 '서클릿'이라 불리는 작은 고리 모양의 성군으로 표시되며, 두 끈은 '매듭'을 뜻하는 별 알레샤에서 만난다. 이 별자리에는 태양이 해마다 3월에 천구 적도를 지나는 춘분점도 자리하고 있다."} } }
  ];
  function assertZodiacData() {
    if (ZODIAC.length !== 12) throw new Error('need 12 zodiac entries, got ' + ZODIAC.length);
    var langs = ['en', 'hans', 'hant', 'ja', 'ko'];
    ZODIAC.forEach(function (z, zi) {
      if (!z.key || !z.symbol) throw new Error('zodiac ' + zi + ' missing key/symbol');
      langs.forEach(function (L) {
        if (!z.t[L]) throw new Error(z.key + ' missing name ' + L);
        var o = z.info[L];
        if (!o || !o.dates || !o.brightest || !o.desc) throw new Error(z.key + ' missing info.' + L);
      });
      if (z.stars.length < 4) throw new Error(z.key + ' needs >=4 stars');
      if (z.starNames.length !== z.stars.length) throw new Error(z.key + ' starNames length mismatch');
      z.stars.forEach(function (s, si) {
        if (s[0] < 0 || s[0] >= 24) throw new Error(z.key + ' star ' + si + ' RA out of range');
        if (s[1] < -90 || s[1] > 90) throw new Error(z.key + ' star ' + si + ' Dec out of range');
      });
      z.lines.forEach(function (l) {
        if (l[0] >= z.stars.length || l[1] >= z.stars.length || l[0] < 0 || l[1] < 0) throw new Error(z.key + ' line index out of range');
      });
    });
    if (typeof CONS_EXTRA !== 'undefined') CONS_EXTRA.forEach(function (z) {
      langs.forEach(function (L) {
        if (!z.t[L]) throw new Error(z.key + ' missing name ' + L);
        var o = z.info[L];
        if (!o || !o.season || !o.brightest || !o.desc) throw new Error(z.key + ' missing info.' + L);
      });
      if (z.starNames.length !== z.stars.length) throw new Error(z.key + ' starNames length mismatch');
      z.stars.forEach(function (s) { if (s[0] < 0 || s[0] >= 24 || s[1] < -90 || s[1] > 90) throw new Error(z.key + ' star out of range'); });
      z.lines.forEach(function (l) { if (l[0] >= z.stars.length || l[1] >= z.stars.length || l[0] < 0 || l[1] < 0) throw new Error(z.key + ' line index out of range'); });
    });
    return true;
  }
  setBeaconLang(beaconLang); // keep: 2nd pass after solarPointerCoarse exists — paints the touch title hint (the call in buildBeacons runs too early)

  // ── real telescope photos for the beacon cards (see THIRD-PARTY-NOTICES.md) ──
  var BEACON_IMGS = [
    {"img":"images/solar-system-family.jpg","credit":"CactiStaccingCrane, NASA imagery · CC BY-SA 4.0"},
    {"img":"images/sgr-a.jpg","credit":"EHT Collaboration"},
    {"img":"images/orion-nebula.jpg","credit":"NASA, ESA, M. Robberto (STScI/ESA) and the Hubble Space Telescope Orion Treasury Project Team"},
    {"img":"images/crab-nebula.jpg","credit":"NASA, ESA, J. Hester and A. Loll (Arizona State University) — Hubble"},
    {"img":"images/eagle-nebula.jpg","credit":"NASA, ESA, CSA, STScI; image processing: J. DePasquale, A. Koekemoer, A. Pagan (STScI) — JWST"},
    {"img":"images/carina-nebula.jpg","credit":"NASA, ESA, CSA, STScI — JWST NIRCam"},
    {"img":"images/cygnus-x1.jpg","credit":"NASA/CXC — Chandra X-ray Observatory"},
    {"img":"images/pleiades.jpg","credit":"NASA, ESA, AURA/Caltech, Palomar Observatory"},
    {"img":"images/omega-centauri.jpg","credit":"NASA, ESA, J. Anderson and R. van der Marel (STScI) — Hubble WFC3"},
    {"img":"images/betelgeuse.jpg","credit":"ALMA (ESO/NAOJ/NRAO)/E. O'Gorman/P. Kervella"},
    {"img":"images/veil-nebula.jpg","credit":"ESA/Hubble & NASA, Z. Levay — Hubble"},
    {"img":"images/lagoon-nebula.jpg","credit":"NASA, ESA, STScI — Hubble"},
    {"img":"images/hercules-cluster.jpg","credit":"NASA, ESA, and the Hubble Heritage Team (STScI/AURA) — Hubble"},
    {"img":"images/sirius.jpg","credit":"NASA, ESA, H. Bond (STScI), M. Barstow (Univ. of Leicester) — Hubble"},
    {"img":"images/antares.jpg","credit":"ESO/K. Ohnaka — VLTI"},
    {"img":"images/ring-nebula.jpg","credit":"NASA, ESA, and C. Robert O'Dell (Vanderbilt University)"},
    {"img":"images/helix-nebula.jpg","credit":"NASA, ESA, and C.R. O'Dell (Vanderbilt University); CTIO data by C.R. O'Dell and L.M. Frattare"},
    {"img":"images/horsehead-nebula.jpg","credit":"NASA/ESA/Hubble Heritage Team"},
    {"img":"images/m15.jpg","credit":"ESA/Hubble & NASA"},
    {"img":"images/m5.jpg","credit":"ESA/Hubble & NASA"},
    {"img":"images/m22.jpg","credit":"ESA/Hubble & NASA"},
    {"img":"images/polaris.jpg","credit":"Benedikt Markus"},
    {"img":"images/proxima.jpg","credit":"ESA/Hubble & NASA"},
    {"img":"images/uy-scuti.jpg","credit":"ESO/Digitized Sky Survey 2"},
    {"img":"images/trappist1.jpg","credit":"Artist’s impression: NASA, ESA, and G. Bacon (STScI)"},
    {"img":"images/andromeda.jpg","credit":"Adam Evans"},
    {"img":"images/m33.jpg","credit":"T. A. Rector / NOAO / AURA / NSF"},
    {"img":"images/m104.jpg","credit":"NASA / ESA / The Hubble Heritage Team (STScI/AURA)"},
    {"img":"images/m87.jpg","credit":"Event Horizon Telescope Collaboration"},
    {"img":"images/cen-a.jpg","credit":"ESO"},
    {"img":"images/lmc.jpg","credit":"CTIO / NOIRLab / NSF / AURA / SMASH / D. Nidever"},
    {"img":"images/smc.jpg","credit":"ESA/Hubble & Digitized Sky Survey 2"}
  ];
  BEACON_IMGS.forEach(function (x, i) { BEACONS[i].img = x.img; BEACONS[i].credit = x.credit; });
  // (Andromeda's beacon is anchored onto the procedural "great neighbour" spiral below —
  //  a real-photo billboard here looked like a washed-out purple blob; the card keeps the real M31 photo.)
  var ZODIAC_IMGS = [
    {"img":"images/zodiac-aries.jpg","credit":"E. Slawik/NOIRLab/NSF/AURA/M. Zamani"},
    {"img":"images/zodiac-taurus.jpg","credit":"E. Slawik/NOIRLab/NSF/AURA/M. Zamani"},
    {"img":"images/zodiac-gemini.jpg","credit":"E. Slawik/NOIRLab/NSF/AURA/M. Zamani"},
    {"img":"images/zodiac-cancer.jpg","credit":"E. Slawik/NOIRLab/NSF/AURA/M. Zamani"},
    {"img":"images/zodiac-leo.jpg","credit":"E. Slawik/NOIRLab/NSF/AURA/M. Zamani"},
    {"img":"images/zodiac-virgo.jpg","credit":"E. Slawik/NOIRLab/NSF/AURA/M. Zamani"},
    {"img":"images/zodiac-libra.jpg","credit":"E. Slawik/NOIRLab/NSF/AURA/M. Zamani"},
    {"img":"images/zodiac-scorpius.jpg","credit":"E. Slawik/NOIRLab/NSF/AURA/M. Zamani"},
    {"img":"images/zodiac-sagittarius.jpg","credit":"E. Slawik/NOIRLab/NSF/AURA/M. Zamani"},
    {"img":"images/zodiac-capricornus.jpg","credit":"E. Slawik/NOIRLab/NSF/AURA/M. Zamani"},
    {"img":"images/zodiac-aquarius.jpg","credit":"E. Slawik/NOIRLab/NSF/AURA/M. Zamani"},
    {"img":"images/zodiac-pisces.jpg","credit":"E. Slawik/NOIRLab/NSF/AURA/M. Zamani"}
  ];
  ZODIAC_IMGS.forEach(function (x, i) { ZODIAC[i].img = x.img; ZODIAC[i].credit = x.credit; });
  // ── 8 famous non-zodiac constellations (Big Dipper, Orion, Southern Cross, …) ──
  // Same star-map structure as ZODIAC but with season/hemisphere instead of astrology dates.
  var CONS_EXTRA = [
    { key:"ursa-major",
      t:{"en":"Ursa Major","hans":"大熊座","hant":"大熊座","ja":"おおぐま座","ko":"큰곰자리"},
      stars:[[11.06,61.75,1.79],[11.03,56.38,2.37],[11.9,53.69,2.44],[12.26,57.03,3.31],[12.9,55.96,1.77],[13.4,54.93,2.23],[13.79,49.31,1.86]], starNames:["Dubhe","Merak","Phecda","Megrez","Alioth","Mizar","Alkaid"], lines:[[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]],
      info:{ en:{"season":"Spring · Northern Hemisphere (circumpolar)","brightest":"Alioth","desc":"Ursa Major is the Great Bear of Greek myth—the nymph Callisto, whom Zeus placed among the stars. Its seven brightest stars form the Big Dipper, and the two outer stars of the bowl, Dubhe and Merak, point straight to Polaris, the North Star, making it the sky's most famous signpost for finding true north."}, hans:{"season":"春季 · 北半球（拱极星座）","brightest":"玉衡","desc":"大熊座是希腊神话中的大熊——仙女卡利斯托被宙斯化作星辰。它最亮的七颗星组成北斗七星，斗口外侧的天枢与天璇两星连线，直指北极星，自古就是人们辨认北方、寻找方向的最著名指引。"}, hant:{"season":"春季 · 北半球（拱極星座）","brightest":"玉衡","desc":"大熊座是希臘神話中的大熊——仙女卡利斯托被宙斯化作星辰。它最亮的七顆星組成北斗七星，斗口外側的天樞與天璇兩星連線，直指北極星，自古就是人們辨認北方、尋找方向的最著名指引。"}, ja:{"season":"春 · 北半球（周極星）","brightest":"アリオト","desc":"おおぐま座はギリシア神話の大熊——ゼウスによって星にされたニンフ、カリストの姿です。明るい七つの星が北斗七星をかたちづくり、ますの先にある二つの星、ドゥーベとメラクを結んだ線を伸ばすと北極星に至り、北の方角を知る道しるべとして古くから親しまれてきました。"}, ko:{"season":"봄 · 북반구(주극성)","brightest":"알리오트","desc":"큰곰자리는 그리스 신화의 큰 곰으로, 제우스가 하늘에 올린 요정 칼리스토의 모습입니다. 가장 밝은 일곱 별이 북두칠성을 이루며, 국자 바깥쪽 끝의 두베와 메라크 두 별을 이으면 바로 북극성에 닿아, 예로부터 북쪽 방향을 찾는 가장 유명한 길잡이가 되어 왔습니다."} },
      img:"images/cons-ursa-major.jpg", credit:"E. Slawik/NOIRLab/NSF/AURA/M. Zamani" },
    { key:"orion",
      t:{"en":"Orion","hans":"猎户座","hant":"獵戶座","ja":"オリオン座","ko":"오리온자리"},
      stars:[[5.92,7.41,0.42],[5.24,-8.2,0.13],[5.42,6.35,1.64],[5.8,-9.67,2.09],[5.68,-1.94,1.77],[5.6,-1.2,1.69],[5.53,-0.3,2.23]], starNames:["Betelgeuse","Rigel","Bellatrix","Saiph","Alnitak","Alnilam","Mintaka"], lines:[[0,2],[0,4],[2,6],[4,5],[5,6],[4,3],[6,1]],
      info:{ en:{"season":"Winter · equatorial (visible from both hemispheres)","brightest":"Rigel","desc":"Orion is the great hunter of Greek myth, placed among the stars after his death from a scorpion's sting. His famous three-star Belt points down to Sirius, the brightest star in the night sky, making Orion a handy signpost for finding your way around the winter heavens. Just below the Belt hangs the Orion Nebula, a glowing stellar nursery where new stars are being born."}, hans:{"season":"冬季 · 赤道带(南北半球均可见)","brightest":"参宿七","desc":"猎户座是希腊神话中伟大的猎人俄里翁,他被蝎子蜇死后被安置在群星之间。著名的“腰带”三星连成一线,向下指向夜空中最亮的恒星天狼星,是冬季星空中最好用的指路标。腰带下方悬挂着猎户座大星云,那是一处正在孕育新恒星的恒星育婴室。"}, hant:{"season":"冬季 · 赤道帶(南北半球皆可見)","brightest":"參宿七","desc":"獵戶座是希臘神話中偉大的獵人俄里翁,他被蠍子螫死後被安置在群星之間。著名的「腰帶」三星連成一線,向下指向夜空中最亮的恆星天狼星,是冬季星空中最好用的指路標。腰帶下方懸掛著獵戶座大星雲,那是一處正在孕育新恆星的恆星育嬰室。"}, ja:{"season":"冬 · 天の赤道付近(南北両半球で見える)","brightest":"リゲル","desc":"オリオン座はギリシャ神話の偉大な狩人オリオンで、サソリに刺されて死んだ後、星々の間に置かれました。有名な三つ星の「ベルト」は一直線に並び、夜空で最も明るい星シリウスへと導く、冬の星空の便利な道しるべです。ベルトのすぐ下には、新しい星々が生まれつつある輝く星のゆりかご、オリオン大星雲がかかっています。"}, ko:{"season":"겨울 · 천구 적도 부근 (남북 양반구에서 관측 가능)","brightest":"리겔","desc":"오리온자리는 그리스 신화의 위대한 사냥꾼 오리온으로, 전갈에 쏘여 죽은 뒤 별들 사이에 놓였습니다. 나란히 늘어선 세 별로 이루어진 유명한 ‘허리띠’는 밤하늘에서 가장 밝은 별 시리우스를 가리키며, 겨울 밤하늘의 훌륭한 길잡이가 됩니다. 허리띠 바로 아래에는 새로운 별들이 태어나고 있는 빛나는 별의 요람, 오리온 대성운이 걸려 있습니다."} },
      img:"images/cons-orion.jpg", credit:"E. Slawik/NOIRLab/NSF/AURA/M. Zamani" },
    { key:"cassiopeia",
      t:{"en":"Cassiopeia","hans":"仙后座","hant":"仙后座","ja":"カシオペア座","ko":"카시오페이아자리"},
      stars:[[0.153,59.15,2.28],[0.675,56.54,2.24],[0.945,60.72,2.47],[1.43,60.24,2.68],[1.907,63.67,3.35]], starNames:["Caph","Schedar","Gamma Cas","Ruchbah","Segin"], lines:[[0,1],[1,2],[2,3],[3,4]],
      info:{ en:{"season":"Autumn · Northern Hemisphere (circumpolar, visible all year up north)","brightest":"Schedar","desc":"Cassiopeia was the vain queen of Aethiopia in Greek myth, punished by being fixed to her throne in the sky, where she circles the pole upside down for half the year. Her five bright stars trace an unmistakable W (or M) that, sitting opposite the Big Dipper across the North Star, serves as a backup pointer to Polaris. Her brightest star, Schedar, marks the queen's heart."}, hans:{"season":"秋季 · 北半球（拱极星座，北方全年可见）","brightest":"王良四","desc":"仙后座代表希腊神话中高傲的埃塞俄比亚王后，因自负而被罚紧锁在王座上，半年都头朝下地绕北极旋转。它的五颗亮星勾勒出鲜明的 W（或 M）形，与北斗隔着北极星遥遥相对，可作为寻找北极星的另一个指引。其最亮的王良四代表王后的心脏。"}, hant:{"season":"秋季 · 北半球（拱極星座，北方全年可見）","brightest":"王良四","desc":"仙后座代表希臘神話中高傲的埃塞俄比亞王后，因自負而被罰緊鎖在王座上，半年都頭朝下地繞北極旋轉。它的五顆亮星勾勒出鮮明的 W（或 M）形，與北斗隔著北極星遙遙相對，可作為尋找北極星的另一個指引。其最亮的王良四代表王后的心臟。"}, ja:{"season":"秋 · 北半球（周極星、北の地方では一年中見える）","brightest":"シェダル","desc":"カシオペア座は、ギリシア神話で虚栄心の強いエチオピアの妃カシオペアを表し、罰として玉座に縛りつけられ、半年は逆さまに天の北極をまわります。五つの明るい星が描く形は W（または M）に見え、北極星をはさんで北斗七星の反対側に位置するため、北極星を見つけるもう一つの目印になります。最も明るいシェダルは妃の心臓を示します。"}, ko:{"season":"가을 · 북반구(주극성, 북쪽 지방에서는 일 년 내내 보임)","brightest":"쉐다르","desc":"카시오페이아자리는 그리스 신화에서 오만했던 에티오피아의 왕비 카시오페이아를 나타내며, 벌로 왕좌에 묶여 반년 동안 거꾸로 매달려 천구의 북극을 돕니다. 다섯 개의 밝은 별이 그리는 뚜렷한 W(또는 M) 모양은 북극성을 사이에 두고 북두칠성과 마주 보여, 북극성을 찾는 또 하나의 길잡이가 됩니다. 가장 밝은 쉐다르는 왕비의 심장을 나타냅니다."} },
      img:"images/cons-cassiopeia.jpg", credit:"E. Slawik/NOIRLab/NSF/AURA/M. Zamani" },
    { key:"crux",
      t:{"en":"Crux (the Southern Cross)","hans":"南十字座","hant":"南十字座","ja":"みなみじゅうじ座","ko":"남십자자리"},
      stars:[[12.443,-63.1,0.77],[12.795,-59.69,1.25],[12.519,-57.11,1.63],[12.252,-58.75,2.79],[12.357,-60.4,3.59]], starNames:["Acrux","Mimosa","Gacrux","Delta Crucis","Epsilon Crucis"], lines:[[2,0],[3,1],[0,4]],
      info:{ en:{"season":"Autumn · Southern Hemisphere","brightest":"Acrux","desc":"Too far south for the ancient Greeks to see, Crux was once counted as part of the Centaur and was named a constellation of its own by Renaissance navigators. Sailors extend its long arm about four and a half times to locate the south celestial pole, making the cross the great signpost of the southern sky and a familiar emblem on several national flags. Right beside it glitter the colorful Jewel Box star cluster and the inky Coalsack dark nebula."}, hans:{"season":"秋季 · 南半球","brightest":"十字架二","desc":"身处北方的古希腊人从未见过南十字座，它原本只是半人马座的一部分，直到文艺复兴时期才被航海家单独命名成星座。水手把十字的长轴延长约四倍半，就能找到南天极，因此它是南半球夜空最重要的指向标，也出现在好几个国家的国旗上。它旁边还点缀着色彩缤纷的珠宝盒星团和漆黑的煤袋暗星云。"}, hant:{"season":"秋季 · 南半球","brightest":"十字架二","desc":"身處北方的古希臘人從未見過南十字座，它原本只是半人馬座的一部分，直到文藝復興時期才被航海家單獨命名成星座。水手把十字的長軸延長約四倍半，就能找到南天極，因此它是南半球夜空最重要的指向標，也出現在好幾個國家的國旗上。它旁邊還點綴著色彩繽紛的珠寶盒星團與漆黑的煤袋暗星雲。"}, ja:{"season":"秋 · 南半球","brightest":"アクルックス","desc":"北にいた古代ギリシャ人には見えず、みなみじゅうじ座はもともとケンタウルス座の一部で、大航海時代の航海者によって独立した星座となりました。十字の長い軸を約四倍半に伸ばすと天の南極が見つかるため、南天の道しるべとして親しまれ、いくつかの国の国旗にも描かれています。すぐそばには色とりどりの宝石箱星団と、漆黒の石炭袋暗黒星雲が広がっています。"}, ko:{"season":"가을 · 남반구","brightest":"아크룩스","desc":"북쪽에 살던 고대 그리스인은 볼 수 없었던 남십자자리는 본래 센타우루스자리의 일부였으며, 대항해시대 항해자들이 독립된 별자리로 이름 붙였습니다. 십자의 긴 축을 약 네 배 반 늘이면 천구의 남극을 찾을 수 있어 남쪽 하늘의 길잡이로 쓰이며, 여러 나라의 국기에도 그려져 있습니다. 바로 곁에는 화려한 보석상자 성단과 새까만 석탄자루 암흑성운이 자리합니다."} },
      img:"images/cons-crux.jpg", credit:"E. Slawik/NOIRLab/NSF/AURA/M. Zamani" },
    { key:"cygnus",
      t:{"en":"Cygnus","hans":"天鹅座","hant":"天鵝座","ja":"はくちょう座","ko":"백조자리"},
      stars:[[20.690528,45.280339,1.25],[20.370473,40.256679,2.23],[19.512023,27.959681,3.05],[20.77018,33.970256,2.48],[19.749585,45.13081,2.87],[19.4951,51.729778,3.79],[21.215694,30.226924,3.2]], starNames:["Deneb","Sadr","Albireo","Gienah","Delta Cygni","Iota Cygni","Zeta Cygni"], lines:[[0,1],[1,4],[1,3],[1,2],[4,5],[3,6]],
      info:{ en:{"season":"Summer · Northern Hemisphere","brightest":"Deneb","desc":"Cygnus is the swan into which Zeus transformed himself, and in another myth the loyal friend Cycnus who mourned Phaethon along the river Eridanus. Its brightest stars form the Northern Cross, a landmark that stands high overhead on summer evenings. Deneb, the swan's tail, is one corner of the Summer Triangle and among the most luminous stars known to us."}, hans:{"season":"夏季 · 北半球","brightest":"天津四","desc":"天鹅座是宙斯为接近凡间女子而化身的天鹅，也有神话说它是为坠落的法厄同悲伤而化为天鹅的忠诚友人库克诺斯。它最亮的几颗星组成了醒目的“北十字”，在夏夜高悬于头顶。座中最亮的天津四是天鹅的尾羽，也是“夏季大三角”的一角，属于人类已知最明亮的恒星之一。"}, hant:{"season":"夏季 · 北半球","brightest":"天津四","desc":"天鵝座是宙斯為接近凡間女子而化身的天鵝，也有神話說牠是為墜落的法厄同悲傷而化為天鵝的忠誠友人庫克諾斯。牠最亮的幾顆星組成醒目的「北十字」，在夏夜高懸於頭頂。座中最亮的天津四是天鵝的尾羽，也是「夏季大三角」的一角，屬於人類已知最明亮的恆星之一。"}, ja:{"season":"夏 · 北半球","brightest":"デネブ","desc":"はくちょう座は、ゼウスが姿を変えた白鳥、あるいは墜落したパエトーンを悼んで白鳥になった忠実な友キュクノスの姿とされます。明るい星々が「北十字（ノーザンクロス）」を描き、夏の夜空の高くに輝きます。尾にあたるデネブは「夏の大三角」の一角で、宇宙で最も明るい部類の恒星として知られています。"}, ko:{"season":"여름 · 북반구","brightest":"데네브","desc":"백조자리는 제우스가 변신한 백조, 또는 추락한 파에톤을 애도하다 백조가 된 충실한 친구 키크노스의 모습으로 전해집니다. 밝은 별들이 '북십자'를 이루어 여름밤 하늘 높이 빛납니다. 백조의 꼬리에 해당하는 데네브는 '여름의 대삼각형'을 이루는 한 꼭짓점이며, 우주에서 가장 밝은 별 가운데 하나로 알려져 있습니다."} },
      img:"images/cons-cygnus.jpg", credit:"E. Slawik/NOIRLab/NSF/AURA/M. Zamani" },
    { key:"lyra",
      t:{"en":"Lyra","hans":"天琴座","hant":"天琴座","ja":"こと座","ko":"거문고자리"},
      stars:[[18.615,38.78,0.03],[18.738,39.67,4.59],[18.746,37.6,4.36],[18.908,36.9,4.3],[18.982,32.69,3.24],[18.835,33.36,3.52]], starNames:["Vega","Epsilon Lyrae","Zeta Lyrae","Delta Lyrae","Sulafat","Sheliak"], lines:[[0,1],[0,2],[1,2],[2,3],[3,4],[4,5],[5,2]],
      info:{ en:{"season":"Summer · Northern Hemisphere","brightest":"Vega","desc":"Lyra represents the lyre of Orpheus, the legendary musician whose songs could charm all living things and even the gods of the underworld. Its brightest star, Vega, is one of the three stars of the Summer Triangle, an easy pattern for finding your way around the summer sky. Lyra is also home to the famous Ring Nebula, a glowing shell of gas puffed off by a dying star."}, hans:{"season":"夏季 · 北半球","brightest":"织女星","desc":"天琴座代表传说中音乐家俄耳甫斯的琴，他的乐声能打动万物，甚至感化冥界的神。它最亮的星织女星是“夏季大三角”的三颗星之一，是夏夜辨认方向的好帮手。天琴座里还有著名的环状星云，那是一颗垂死恒星抛出的发光气壳。"}, hant:{"season":"夏季 · 北半球","brightest":"織女星","desc":"天琴座代表傳說中音樂家奧菲斯的琴，他的樂聲能打動萬物，甚至感化冥界的神。它最亮的星織女星是「夏季大三角」的三顆星之一，是夏夜辨認方向的好幫手。天琴座裡還有著名的環狀星雲，那是一顆垂死恆星拋出的發光氣殼。"}, ja:{"season":"夏 · 北半球","brightest":"ベガ（織女星）","desc":"こと座は、歌であらゆるものを魅了し、冥界の神さえも動かしたという伝説の音楽家オルフェウスの竪琴（リラ）を表します。最も明るい星ベガ（織女星）は「夏の大三角」をなす三つの星の一つで、夏の夜空で方角をつかむ目印になります。こと座には有名な環状星雲（リング星雲）もあり、これは寿命を終えつつある星が放出したガスの殻です。"}, ko:{"season":"여름 · 북반구","brightest":"직녀성(베가)","desc":"거문고자리는 노래로 모든 생명체를 매혹하고 저승의 신들까지 감동시켰다는 전설적인 음악가 오르페우스의 수금(리라)을 나타냅니다. 가장 밝은 별인 직녀성(베가)은 '여름의 대삼각형'을 이루는 세 별 중 하나로, 여름밤 하늘에서 방향을 찾는 좋은 길잡이가 됩니다. 거문고자리에는 유명한 고리 성운도 있는데, 이는 생을 마감하는 별이 뿜어낸 빛나는 가스 껍질입니다."} },
      img:"images/cons-lyra.jpg", credit:"E. Slawik/NOIRLab/NSF/AURA/M. Zamani" },
    { key:"ursa-minor",
      t:{"en":"Ursa Minor","hans":"小熊座","hant":"小熊座","ja":"こぐま座","ko":"작은곰자리"},
      stars:[[2.53,89.26,1.98],[14.85,74.16,2.08],[15.35,71.83,3.05],[17.54,86.59,4.36],[16.77,82.04,4.22],[15.73,77.79,4.32],[16.29,75.76,4.95]], starNames:["Polaris","Kochab","Pherkad","Yildun","Epsilon UMi","Zeta UMi","Eta UMi"], lines:[[0,3],[3,4],[4,5],[5,1],[1,2],[2,6],[6,5]],
      info:{ en:{"season":"Summer evenings, best in June · Circumpolar in the Northern Hemisphere","brightest":"Polaris","desc":"In Greek myth, Ursa Minor is the little bear Arcas, son of Callisto, placed in the sky beside his mother (Ursa Major) by Zeus. Its brightest star, Polaris, sits almost exactly at the North Celestial Pole, so it barely moves as the other stars wheel around it. For centuries sailors and travelers found true north simply by locating Polaris at the tip of the Little Dipper's handle."}, hans:{"season":"夏季夜晚，六月最佳 · 北半球拱极星座","brightest":"北极星","desc":"在希腊神话中，小熊座是卡利斯托之子小熊阿卡斯，宙斯将他升上天空，安放在母亲大熊座的身旁。它最亮的恒星北极星几乎正处于天球北极，因此当其他星辰绕它旋转时，它几乎纹丝不动。数百年来，水手和旅人只需在小北斗勺柄末端找到北极星，便能确定正北方向。"}, hant:{"season":"夏季夜晚，六月最佳 · 北半球拱極星座","brightest":"北極星","desc":"在希臘神話中，小熊座是卡利斯托之子小熊阿卡斯，宙斯將他升上天空，安放在母親大熊座的身旁。它最亮的恆星北極星幾乎正處於天球北極，因此當其他星辰繞它旋轉時，它幾乎紋絲不動。數百年來，水手與旅人只需在小北斗杓柄末端找到北極星，便能辨明正北方向。"}, ja:{"season":"夏の宵、6月が見頃 · 北半球の周極星座","brightest":"北極星（ポラリス）","desc":"ギリシャ神話では、こぐま座はカリストの息子である小熊アルカスで、ゼウスが天に上げて母（おおぐま座）のそばに置いた姿とされます。最も明るい星ポラリス（北極星）は天の北極のごく近くにあり、ほかの星がその周りを回っても、ほとんど動きません。そのため何世紀もの間、船乗りや旅人は小北斗の柄の先にある北極星を頼りに真北を知りました。"}, ko:{"season":"여름 저녁, 6월에 가장 좋음 · 북반구 주극 별자리","brightest":"북극성","desc":"그리스 신화에서 작은곰자리는 칼리스토의 아들인 작은 곰 아르카스로, 제우스가 어머니(큰곰자리) 곁에 두려고 하늘로 올린 모습이라 전해집니다. 가장 밝은 별인 북극성은 천구의 북극 가까이에 자리해, 다른 별들이 그 둘레를 도는 동안에도 거의 움직이지 않습니다. 그래서 수백 년 동안 뱃사람과 나그네는 작은 국자 손잡이 끝의 북극성을 찾아 정북 방향을 알아냈습니다."} },
      img:"images/cons-ursa-minor.jpg", credit:"E. Slawik/NOIRLab/NSF/AURA/M. Zamani" },
    { key:"canis-major",
      t:{"en":"Canis Major","hans":"大犬座","hant":"大犬座","ja":"おおいぬ座","ko":"큰개자리"},
      stars:[[6.752,-16.72,-1.46],[6.378,-17.96,1.98],[7.14,-26.39,1.83],[6.977,-28.97,1.5],[7.402,-29.3,2.45]], starNames:["Sirius","Mirzam","Wezen","Adhara","Aludra"], lines:[[1,0],[0,3],[3,2],[2,4]],
      info:{ en:{"season":"Winter · Southern sky","brightest":"Sirius","desc":"Canis Major is the greater of the two hunting dogs following Orion across the sky, often linked to Laelaps, a mythological hound so swift it always caught its prey. Its brightest star, Sirius, is the most brilliant star in the entire night sky, and its predawn 'heliacal' rising once told the ancient Egyptians that the Nile's annual flood was near. Look just below and to the left of Orion on a winter evening to spot the Dog Star gleaming with a faint blue-white sparkle."}, hans:{"season":"冬季 · 南天","brightest":"天狼星","desc":"大犬座是跟随猎户座奔驰于天际的两只猎犬中较大的一只，常与神话中的猎犬拉埃拉普斯相联系——它奔跑极快，追逐的猎物无一能够逃脱。它最亮的恒星天狼星是整个夜空中最明亮的恒星；在古埃及，天狼星黎明前的偕日升起曾预示着尼罗河一年一度的泛滥即将来临。冬夜里，只要望向猎户座的左下方，就能看到这颗闪着淡淡蓝白光芒的天狼星。"}, hant:{"season":"冬季 · 南天","brightest":"天狼星","desc":"大犬座是跟隨獵戶座奔馳於天際的兩隻獵犬中較大的一隻，常與神話中的獵犬拉埃拉普斯相聯繫——牠奔跑極快，追逐的獵物無一能夠逃脫。牠最亮的恆星天狼星是整個夜空中最明亮的恆星；在古埃及，天狼星黎明前的偕日升起曾預示著尼羅河一年一度的氾濫即將來臨。冬夜裡，只要望向獵戶座的左下方，就能看到這顆閃著淡淡藍白光芒的天狼星。"}, ja:{"season":"冬 · 南天","brightest":"シリウス","desc":"おおいぬ座は、天を駆けるオリオンに従う二匹の猟犬のうち大きいほうで、どんな獲物も逃さない俊足の神話の猟犬ライラプスとしばしば結びつけられます。最も明るい星シリウスは全天で最も輝く恒星で、その夜明け前の出現（ヘリアカル・ライジング）は、かつて古代エジプトでナイル川の氾濫が近いことを告げる目印でした。冬の夕空でオリオンの左下を見れば、青白くきらめくこの「犬の星」を見つけられます。"}, ko:{"season":"겨울 · 남쪽 하늘","brightest":"시리우스","desc":"큰개자리는 하늘을 가로질러 오리온을 뒤따르는 두 마리 사냥개 중 큰 쪽으로, 어떤 사냥감도 놓치지 않을 만큼 빠른 신화 속 사냥개 라일랍스와 자주 연결됩니다. 가장 밝은 별 시리우스는 밤하늘 전체에서 가장 밝게 빛나는 항성으로, 새벽녘 동트기 직전에 떠오르는 '일출 직전 출현(헬리아컬 라이징)'은 고대 이집트에서 나일강의 연례 범람이 다가왔음을 알려 주는 신호였습니다. 겨울 저녁 오리온의 왼쪽 아래를 바라보면 푸른빛이 도는 흰빛으로 반짝이는 이 '개의 별'을 찾을 수 있습니다."} },
      img:"images/cons-canis-major.jpg", credit:"E. Slawik/NOIRLab/NSF/AURA/M. Zamani" },
    { key:"andromeda",
      t:{"en":"Andromeda","hans":"仙女座","hant":"仙女座","ja":"アンドロメダ座","ko":"안드로메다자리"},
      stars:[[0.139,29.09,2.06],[0.655,30.86,3.27],[1.162,35.62,2.05],[0.947,38.5,3.86],[0.831,41.08,4.09],[2.065,42.33,2.1]], starNames:["Alpheratz","Delta And","Mirach","Mu And","Nu And","Almach"], lines:[[0,1],[1,2],[2,5],[2,3],[3,4]],
      info:{ en:{"season":"Autumn · Northern Hemisphere","brightest":"Alpheratz","desc":"Andromeda is the chained princess of Greek myth, daughter of Cassiopeia, left on the shore as a sacrifice to a sea monster and rescued by the hero Perseus. Her brightest star, Alpheratz, is shared with the Great Square of Pegasus. Follow the chain of stars from Alpheratz through Mirach and step up two fainter stars to reach the Andromeda Galaxy (M31) — the nearest great spiral to our own and the most distant object easily visible to the unaided eye."}, hans:{"season":"秋季 · 北半球","brightest":"壁宿二","desc":"仙女座是希腊神话中被锁在海边的公主——仙后座的女儿安德洛墨达，被献给海怪作祭品，最终由英雄珀耳修斯所救。它最亮的星壁宿二，同时也是飞马座大四边形的一角。从壁宿二沿着星链经过奎宿九，再向上跨过两颗较暗的星，便能抵达仙女座星系(M31)——距离我们最近的大型旋涡星系，也是肉眼可见的最遥远天体。"}, hant:{"season":"秋季 · 北半球","brightest":"壁宿二","desc":"仙女座是希臘神話中被鎖在海邊的公主——仙后座的女兒安德洛墨達，被獻給海怪作祭品，最終由英雄珀耳修斯所救。它最亮的星壁宿二，同時也是飛馬座大四邊形的一角。從壁宿二沿著星鏈經過奎宿九，再向上跨過兩顆較暗的星，便能抵達仙女座星系(M31)——距離我們最近的大型螺旋星系，也是肉眼可見的最遙遠天體。"}, ja:{"season":"秋 · 北半球","brightest":"アルフェラッツ","desc":"アンドロメダ座はギリシア神話で鎖につながれた王女、カシオペア座の娘アンドロメダの姿です。海の怪物への生贄として岸辺につながれましたが、英雄ペルセウスに救われました。最も明るい星アルフェラッツは、ペガススの大四辺形の一角でもあります。アルフェラッツからミラクへと星の連なりをたどり、さらに二つの暗めの星を上へたどると、アンドロメダ銀河(M31)に至ります——私たちの銀河系に最も近い大きな渦巻銀河であり、肉眼でたやすく見える最も遠い天体です。"}, ko:{"season":"가을 · 북반구","brightest":"알페라츠","desc":"안드로메다자리는 그리스 신화 속 사슬에 묶인 공주로, 카시오페이아자리의 딸 안드로메다의 모습입니다. 바다 괴물의 제물로 해변에 묶였다가 영웅 페르세우스에게 구원받았습니다. 가장 밝은 별 알페라츠는 페가수스 대사각형의 한 꼭짓점이기도 합니다. 알페라츠에서 미라크를 지나 별들의 사슬을 따라가다 조금 더 어두운 두 별을 위로 짚어 올라가면 안드로메다 은하(M31)에 이릅니다 — 우리 은하에서 가장 가까운 큰 나선 은하이자, 맨눈으로 쉽게 볼 수 있는 가장 먼 천체입니다."} },
      img:"images/cons-andromeda.jpg", credit:"E. Slawik/NOIRLab/NSF/AURA/M. Zamani" },
    { key:"triangulum",
      t:{"en":"Triangulum","hans":"三角座","hant":"三角座","ja":"さんかく座","ko":"삼각형자리"},
      stars:[[1.885,29.58,3.42],[2.159,34.99,3.0],[2.288,33.85,4.01]], starNames:["Mothallah","Beta Trianguli","Gamma Trianguli"], lines:[[0,1],[1,2],[2,0]],
      info:{ en:{"season":"Autumn · Northern Hemisphere","brightest":"Beta Trianguli","desc":"Triangulum is one of the sky's smallest and simplest constellations — three modest stars drawing a slender triangle, known to the ancient Greeks as Deltoton for its likeness to their letter delta. Tucked beside it lies the Triangulum Galaxy (M33), the third-largest member of our Local Group and, under very dark skies, one of the farthest things the naked eye can glimpse."}, hans:{"season":"秋季 · 北半球","brightest":"娄宿增九","desc":"三角座是天空中最小、最简单的星座之一——三颗并不显眼的星勾勒出一个细长的三角形，古希腊人因其形似字母Δ（delta），称之为Deltoton。紧挨在它旁边的是三角座星系(M33)，本星系群中第三大的成员，在极为黑暗的夜空下，更是肉眼所能瞥见的最遥远的天体之一。"}, hant:{"season":"秋季 · 北半球","brightest":"婁宿增九","desc":"三角座是天空中最小、最簡單的星座之一——三顆並不顯眼的星勾勒出一個細長的三角形，古希臘人因其形似字母Δ（delta），稱之為Deltoton。緊挨在它旁邊的是三角座星系(M33)，本星系群中第三大的成員，在極為黑暗的夜空下，更是肉眼所能瞥見的最遙遠的天體之一。"}, ja:{"season":"秋 · 北半球","brightest":"さんかく座ベータ星","desc":"さんかく座は空でもっとも小さく、もっとも簡素な星座のひとつです——三つの控えめな星が細長い三角形を描き、古代ギリシアの人々はその文字Δ（デルタ）に似た姿からDeltotonと呼びました。そのすぐそばにはさんかく座銀河(M33)が横たわり、局部銀河群で三番目に大きな一員であり、非常に暗い空のもとでは肉眼でとらえられるもっとも遠い天体のひとつです。"}, ko:{"season":"가을 · 북반구","brightest":"삼각형자리 베타","desc":"삼각형자리는 하늘에서 가장 작고 단순한 별자리 가운데 하나로, 그리 밝지 않은 세 별이 가느다란 삼각형을 그립니다. 고대 그리스 사람들은 그 모습이 문자 Δ(델타)를 닮았다 하여 Deltoton이라 불렀습니다. 바로 곁에는 삼각형자리 은하(M33)가 자리하는데, 국부 은하군에서 세 번째로 큰 일원이자 아주 어두운 하늘 아래에서는 맨눈으로 볼 수 있는 가장 먼 천체 가운데 하나입니다."} },
      img:"images/cons-triangulum.jpg", credit:"E. Slawik/NOIRLab/NSF/AURA/M. Zamani" },
    { key:"centaurus",
      t:{"en":"Centaurus","hans":"半人马座","hant":"半人馬座","ja":"ケンタウルス座","ko":"센타우루스자리"},
      stars:[[14.66,-60.83,-0.27],[14.064,-60.37,0.61],[13.665,-53.47,2.29],[12.692,-48.96,2.2],[12.14,-50.72,2.57],[13.343,-36.71,2.75],[14.111,-36.37,2.06]], starNames:["Rigil Kentaurus","Hadar","Epsilon Cen","Gamma Cen","Delta Cen","Iota Cen","Menkent"], lines:[[0,1],[1,2],[2,3],[3,4],[2,5],[5,6]],
      info:{ en:{"season":"Autumn · Southern Hemisphere","brightest":"Alpha Centauri (Rigil Kentaurus)","desc":"Centaurus is the celestial centaur, often identified with wise Chiron, tutor of heroes. One of the grandest southern constellations, its two brightest stars — Alpha and Beta Centauri — point the way to the nearby Southern Cross. Alpha Centauri is the closest star system to the Sun, just over four light-years away. Within the centaur's body glows Centaurus A, the nearest giant active galaxy, its black hole firing jets across the radio sky."}, hans:{"season":"秋季 · 南半球","brightest":"南门二","desc":"半人马座是天上的半人马，常被认作智慧的喀戎——众英雄的导师。它是南天最壮丽的星座之一，两颗最亮的星——南门二与马腹一——为人们指出邻近南十字座的方向。南门二是距离太阳最近的恒星系统，仅四光年多一点。在半人马的身躯之中，闪耀着半人马座A，那是离我们最近的巨型活动星系，其黑洞向射电天空喷射出道道喷流。"}, hant:{"season":"秋季 · 南半球","brightest":"南門二","desc":"半人馬座是天上的半人馬，常被認作智慧的凱隆——眾英雄的導師。它是南天最壯麗的星座之一，兩顆最亮的星——南門二與馬腹一——為人們指出鄰近南十字座的方向。南門二是距離太陽最近的恆星系統，僅四光年多一點。在半人馬的身軀之中，閃耀著半人馬座A，那是離我們最近的巨型活動星系，其黑洞向電波天空噴射出道道噴流。"}, ja:{"season":"秋 · 南半球","brightest":"ケンタウルス座アルファ星（リギル・ケンタウルス）","desc":"ケンタウルス座は天のケンタウロスで、しばしば英雄たちの師である賢者ケイローンの姿とされます。南天でもっとも壮麗な星座のひとつで、いちばん明るい二つの星——ケンタウルス座アルファ星とハダル——が近くのみなみじゅうじ座への道しるべとなります。ケンタウルス座アルファ星は太陽にもっとも近い恒星系で、わずか四光年あまりのかなたにあります。ケンタウロスの胴のなかには、もっとも近い巨大活動銀河ケンタウルス座Aが輝き、そのブラックホールが電波の空へジェットを噴き出しています。"}, ko:{"season":"가을 · 남반구","brightest":"센타우루스자리 알파(리길 켄타우루스)","desc":"센타우루스자리는 하늘의 켄타우로스로, 흔히 영웅들의 스승인 현자 케이론의 모습으로 여겨집니다. 남쪽 하늘에서 가장 웅장한 별자리 가운데 하나로, 가장 밝은 두 별인 센타우루스자리 알파와 하다르가 가까운 남십자자리로 가는 길을 알려 줍니다. 센타우루스자리 알파는 태양에서 가장 가까운 항성계로, 겨우 4광년 남짓 떨어져 있습니다. 켄타우로스의 몸통 안에는 가장 가까운 거대 활동 은하인 센타우루스자리 A가 빛나며, 그 블랙홀이 전파 하늘을 가로질러 제트를 뿜어냅니다."} },
      img:"images/cons-centaurus.jpg", credit:"E. Slawik/NOIRLab/NSF/AURA/M. Zamani" },
    { key:"dorado",
      t:{"en":"Dorado","hans":"剑鱼座","hant":"劍魚座","ja":"かじき座","ko":"황새치자리"},
      stars:[[4.567,-55.04,3.27],[5.56,-62.49,3.76],[4.267,-51.49,4.25],[5.746,-65.74,4.34],[5.092,-57.47,4.71]], starNames:["Alpha Doradus","Beta Doradus","Gamma Doradus","Delta Doradus","Zeta Doradus"], lines:[[2,0],[0,4],[4,1],[1,3]],
      info:{ en:{"season":"Summer · Southern Hemisphere","brightest":"Alpha Doradus","desc":"Dorado, the swordfish, was charted by Renaissance navigators mapping the far southern sky. Faint in stars, it guards a spectacular treasure: most of the Large Magellanic Cloud, a satellite galaxy of the Milky Way that hangs in the southern night as a detached patch of soft light, cradling the furious Tarantula Nebula."}, hans:{"season":"夏季 · 南半球","brightest":"金鱼一","desc":"剑鱼座即天上的剑鱼，是文艺复兴时期的航海家在测绘南天星空时描绘出的星座。它本身星光稀疏，却守护着一处壮丽的宝藏——大麦哲伦云的大部分。这是银河系的一个伴星系，宛如一团脱离银河、柔和的光斑悬在南方的夜空，怀中还托着狂暴的蜘蛛星云。"}, hant:{"season":"夏季 · 南半球","brightest":"金魚一","desc":"劍魚座即天上的劍魚，是文藝復興時期的航海家在測繪南天星空時描繪出的星座。它本身星光稀疏，卻守護著一處壯麗的寶藏——大麥哲倫雲的大部分。這是銀河系的一個伴星系，宛如一團脫離銀河、柔和的光斑懸在南方的夜空，懷中還托著狂暴的蜘蛛星雲。"}, ja:{"season":"夏 · 南半球","brightest":"かじき座アルファ星","desc":"かじき座は、南天の星空を測量したルネサンス期の航海者たちが描き出した、天のかじきの星座です。星そのものは乏しいものの、壮麗な宝物を守っています——大マゼラン雲の大部分です。これは天の川銀河の伴銀河で、銀河から離れた柔らかな光の斑点として南の夜空に浮かび、猛々しいタランチュラ星雲を抱いています。"}, ko:{"season":"여름 · 남반구","brightest":"황새치자리 알파","desc":"황새치자리는 남쪽 하늘을 측량하던 르네상스 시대의 항해자들이 그려 넣은 황새치의 별자리입니다. 별은 드물지만, 눈부신 보물을 지키고 있습니다. 바로 대마젤란은하의 대부분으로, 우리 은하의 위성 은하인 이 천체는 은하에서 떨어져 나온 부드러운 빛 조각처럼 남쪽 밤하늘에 걸려, 사나운 타란툴라 성운을 감싸 안고 있습니다."} },
      img:"images/cons-dorado.jpg", credit:"E. Slawik/NOIRLab/NSF/AURA/M. Zamani" },
    { key:"tucana",
      t:{"en":"Tucana","hans":"杜鹃座","hant":"杜鵑座","ja":"きょしちょう座","ko":"큰부리새자리"},
      stars:[[22.308,-60.26,2.87],[23.29,-58.24,3.99],[0.333,-64.87,4.23],[0.525,-62.96,4.37],[22.455,-64.97,4.49],[23.998,-65.58,4.5]], starNames:["Alpha Tucanae","Gamma Tucanae","Zeta Tucanae","Beta Tucanae","Delta Tucanae","Epsilon Tucanae"], lines:[[0,1],[1,5],[5,3],[3,2],[0,4]],
      info:{ en:{"season":"Spring · Southern Hemisphere","brightest":"Alpha Tucanae","desc":"Tucana, the toucan, is another far-southern constellation named by the navigators of the Age of Exploration. Its own stars are faint, but it holds one of the richest corners of the southern sky: the Small Magellanic Cloud, a companion galaxy of the Milky Way, and beside it the dazzling globular cluster 47 Tucanae, second in splendour only to Omega Centauri."}, hans:{"season":"春季 · 南半球","brightest":"鸟喙一","desc":"杜鹃座描绘的是一只巨嘴鸟(杜鹃)，也是一个由大航海时代的航海家命名的遥远南天星座。它自身的星星都很黯淡，却坐拥南天最富丽的一隅：银河系的伴星系小麦哲伦云，以及紧邻其旁、璀璨夺目的球状星团杜鹃座47——其壮丽仅次于半人马座ω。"}, hant:{"season":"春季 · 南半球","brightest":"鳥喙一","desc":"杜鵑座描繪的是一隻巨嘴鳥，也是一個由大航海時代的航海家命名的遙遠南天星座。它自身的星星都很黯淡，卻坐擁南天最富麗的一隅：銀河系的伴星系小麥哲倫雲，以及緊鄰其旁、璀璨奪目的球狀星團杜鵑座47——其壯麗僅次於半人馬座ω。"}, ja:{"season":"春 · 南半球","brightest":"きょしちょう座アルファ星","desc":"きょしちょう座は天のオオハシで、大航海時代の航海者たちが名づけた、もう一つのはるか南天の星座です。自身の星は暗いものの、南天でもっとも豊かな一角を抱えています——天の川銀河の伴銀河である小マゼラン雲、そしてそのかたわらに輝く球状星団きょしちょう座47は、その壮麗さでケンタウルス座オメガに次ぐものです。"}, ko:{"season":"봄 · 남반구","brightest":"큰부리새자리 알파","desc":"큰부리새자리는 하늘의 큰부리새로, 대항해시대의 항해자들이 이름 붙인 남쪽 하늘 깊은 곳의 또 하나의 별자리입니다. 자체의 별들은 어둡지만, 남쪽 하늘에서 가장 풍요로운 한 구역을 품고 있습니다. 우리 은하의 동반 은하인 소마젤란은하, 그리고 그 곁에서 눈부시게 빛나는 구상성단 큰부리새자리 47은 그 장려함이 센타우루스자리 오메가에 버금갑니다."} },
      img:"images/cons-tucana.jpg", credit:"E. Slawik/NOIRLab/NSF/AURA/M. Zamani" }
  ];
  var SKY_CONS = [];
  (function buildZodiac() {
    var host = document.createElement('div'); host.id = 'skylabels'; document.body.appendChild(host);
    // stars twinkle (per-star sine phase) and glint with 4-point diffraction spikes
    var starVert = 'uniform float uSize; uniform float uMul; uniform float uTime; attribute float aScale; attribute float aPhase; varying float vA; varying float vTw;' +
      'void main(){ vec4 vp = viewMatrix * modelMatrix * vec4(position,1.0); gl_Position = projectionMatrix * vp;' +
      ' float tw = 0.65 + 0.35 * sin(uTime * (0.6 + aPhase) + aPhase * 6.2831);' +
      ' vTw = tw; vA = uMul; gl_PointSize = uSize * aScale * uMul * (0.82 + 0.28 * tw); }';
    var starFrag = 'varying float vA; varying float vTw; void main(){ vec2 pc = gl_PointCoord - vec2(0.5); float d = length(pc);' +
      ' float core = pow(max(0.0, 1.0 - d * 2.6), 1.8);' +           // tight bright core
      ' float ax = abs(pc.x), ay = abs(pc.y);' +
      ' float hor = max(0.0, 1.0 - ay / 0.045) * max(0.0, 1.0 - ax / 0.5);' + // horizontal spike
      ' float ver = max(0.0, 1.0 - ax / 0.045) * max(0.0, 1.0 - ay / 0.5);' + // vertical spike
      ' float s = (core + (hor + ver) * 0.5) * (0.5 + 0.6 * vTw);' + // spikes + twinkle
      ' if (s < 0.01) discard; gl_FragColor = vec4(vec3(0.86, 0.92, 1.0) * vA, s); }';
    ZODIAC.concat(CONS_EXTRA).forEach(function (z, zi) {
      var n = z.stars.length, pos = new Float32Array(n * 3), scl = new Float32Array(n), phs2 = new Float32Array(n), centroid = new THREE.Vector3();
      var dirs = z.stars.map(function (s) { return raDecDir(s[0], s[1]); });
      dirs.forEach(function (d, i) {
        pos[i * 3] = d.x * SKY_R; pos[i * 3 + 1] = d.y * SKY_R; pos[i * 3 + 2] = d.z * SKY_R;
        scl[i] = Math.max(0.55, Math.pow(1.45, 2.0 - z.stars[i][2])); // brighter (lower mag) → bigger
        phs2[i] = Math.random(); // per-star twinkle phase
        centroid.add(d);
      });
      centroid.normalize();
      var sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      sg.setAttribute('aScale', new THREE.BufferAttribute(scl, 1));
      sg.setAttribute('aPhase', new THREE.BufferAttribute(phs2, 1));
      var sm = new THREE.ShaderMaterial({ uniforms: { uSize: { value: 8.0 * renderer.getPixelRatio() }, uMul: { value: 1 }, uTime: { value: 0 } },
        vertexShader: starVert, fragmentShader: starFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      skyScene.add(new THREE.Points(sg, sm));
      var lp = new Float32Array(z.lines.length * 6);
      z.lines.forEach(function (l, li) {
        var a = dirs[l[0]], b = dirs[l[1]];
        lp[li * 6] = a.x * SKY_R; lp[li * 6 + 1] = a.y * SKY_R; lp[li * 6 + 2] = a.z * SKY_R;
        lp[li * 6 + 3] = b.x * SKY_R; lp[li * 6 + 4] = b.y * SKY_R; lp[li * 6 + 5] = b.z * SKY_R;
      });
      var lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
      var lm = new THREE.LineBasicMaterial({ color: 0x6f9fe8, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending });
      skyScene.add(new THREE.LineSegments(lg, lm));
      var el = document.createElement('div'); el.className = 'skylabel';
      if (z.key === 'sagittarius') el.dataset.videoTarget = 'constellation-sagittarius';
      host.appendChild(el); keyActivate(el);
      (function (idx) { el.addEventListener('click', function (e) { e.stopPropagation(); selectSky(idx); }); })(zi);
      SKY_CONS.push({ z: z, el: el, dir: centroid, lineMat: lm, starMat: sm, shown: true });
    });
    paintSkyLabels(beaconLang);
    host.style.display = 'none'; // hidden until enterSky
  })();
  if (videoMode) { // sky-view camera hooks for the automated promo tour: turn the dome to face any constellation
    window.skyConDir = function (i) { var c = SKY_CONS[i]; return c ? { x: c.dir.x, y: c.dir.y, z: c.dir.z } : null; };
    window.skyGetLook = function () { var p = skyCamera.position.clone().normalize().multiplyScalar(-1); return { x: p.x, y: p.y, z: p.z }; };
    window.skyLook = function (x, y, z) { var v = new THREE.Vector3(x, y, z); if (v.lengthSq() < 1e-9) return false; v.normalize(); skyCamera.position.copy(v).multiplyScalar(-0.1); skyControls.target.set(0, 0, 0); skyControls.autoRotate = false; skyControls.update(); if (typeof updateSkyLabels === 'function') updateSkyLabels(); return true; };
    window.exitSolarNow = function () { exitSolar(); }; // one clean step back to the galaxy view regardless of how deep the solar nav stack got
  }
  // ── external galaxies as deep-sky markers on the celestial sphere, at their true J2000
  // RA/Dec, sitting inside their host constellations. Clicking reuses the galaxy's beacon card.
  var SKY_GAL = [];
  window.skyGalSelected = null;
  (function buildSkyGalaxies() {
    var host = document.getElementById('skylabels');
    var GALS = [ // catalog matches BEACONS[i].info.en.catalog; ra in hours, dec in degrees; kind → tint
      { cat: 'M31', ra: 0.712, dec: 41.27, kind: 'spiral' }, { cat: 'M33', ra: 1.564, dec: 30.66, kind: 'spiral' },
      { cat: 'M104', ra: 12.666, dec: -11.62, kind: 'spiral' }, { cat: 'M87', ra: 12.514, dec: 12.39, kind: 'ell' },
      { cat: 'NGC 5128', ra: 13.424, dec: -43.02, kind: 'ell' }, { cat: 'LMC', ra: 5.393, dec: -69.76, kind: 'irr' },
      { cat: 'SMC', ra: 0.877, dec: -72.8, kind: 'irr' }
    ];
    GALS.forEach(function (G, gi) {
      var bi = -1; for (var i = 0; i < BEACONS.length; i++) { if (BEACONS[i].gal && BEACONS[i].info.en.catalog === G.cat) { bi = i; break; } }
      if (bi < 0) return;
      var dir = raDecDir(G.ra, G.dec);
      var col = G.kind === 'ell' ? 0xffe6c0 : (G.kind === 'irr' ? 0xe6ecff : 0xbcd8ff);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: col, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.position.copy(dir).multiplyScalar(SKY_R * 0.99);
      var sz = SKY_R * 0.024; sp.scale.set(sz * 1.7, sz, 1); // oval glow — reads as a galaxy, not a point star
      skyScene.add(sp);
      var el = document.createElement('div'); el.className = 'skylabel skygal'; el.style.display = 'none';
      host.appendChild(el); keyActivate(el);
      (function (idx) { el.addEventListener('click', function (e) { e.stopPropagation(); selectSkyGal(idx); }); })(gi);
      SKY_GAL.push({ beaconIdx: bi, dir: dir, el: el, sprite: sp, shown: false });
    });
    paintSkyGalLabels(beaconLang);
  })();
  function paintSkyGalLabels(lang) { // no emoji — the oval glow sprite is the marker; keeps rendering robust everywhere
    SKY_GAL.forEach(function (g) { var b = BEACONS[g.beaconIdx]; g.el.innerHTML = esc((b.t[lang] || b.t.en)[0]); });
  }
  function selectSkyGal(gi) {
    noteCardOpener();
    if (gi === window.skyGalSelected) { clearSkySelection(); return; }
    window.skySelected = null; // drop any constellation highlight
    SKY_CONS.forEach(function (c) { c.el.classList.remove('sel', 'dim'); c.lineMat.opacity = 0.45; c.starMat.uniforms.uMul.value = 1; });
    window.skyGalSelected = gi;
    SKY_GAL.forEach(function (g, i) { g.el.classList.toggle('sel', i === gi); g.sprite.material.opacity = i === gi ? 1 : 0.85; });
    renderPanel(SKY_GAL[gi].beaconIdx, beaconLang); // galaxy's own 5-language card (fly-to link suppressed in sky view)
    bpEl.classList.add('open');
  }
  function paintSkyLabels(lang) {
    SKY_CONS.forEach(function (c) {
      c.el.innerHTML = (c.z.t[lang] || c.z.t.en) + (c.z.symbol ? '<small>' + c.z.symbol + '</small>' : '');
    });
  }
  var skyTmp = new THREE.Vector3();
  window.updateSkyLabels = function () {
    for (var i = 0; i < SKY_CONS.length; i++) {
      var c = SKY_CONS[i];
      skyTmp.copy(c.dir).multiplyScalar(SKY_R).project(skyCamera);
      var vis = viewMode === 'sky' && skyTmp.z < 1 && skyTmp.x > -1.05 && skyTmp.x < 1.05 && skyTmp.y > -1.05 && skyTmp.y < 1.05;
      if (vis !== c.shown) { c.el.style.display = vis ? '' : 'none'; c.shown = vis; }
      if (vis) {
        c.el.style.left = ((skyTmp.x * 0.5 + 0.5) * window.innerWidth) + 'px';
        c.el.style.top = ((-skyTmp.y * 0.5 + 0.5) * window.innerHeight) + 'px';
      }
    }
    for (var gi = 0; gi < SKY_GAL.length; gi++) { // galaxy markers ride the same projection
      var g = SKY_GAL[gi];
      skyTmp.copy(g.dir).multiplyScalar(SKY_R).project(skyCamera);
      var gv = viewMode === 'sky' && skyTmp.z < 1 && skyTmp.x > -1.05 && skyTmp.x < 1.05 && skyTmp.y > -1.05 && skyTmp.y < 1.05;
      if (gv !== g.shown) { g.el.style.display = gv ? '' : 'none'; g.shown = gv; }
      if (gv) { g.el.style.left = ((skyTmp.x * 0.5 + 0.5) * window.innerWidth) + 'px'; g.el.style.top = ((-skyTmp.y * 0.5 + 0.5) * window.innerHeight) + 'px'; }
    }
  };
  window.skySelected = null;
  function renderConstellationPanel(i, lang) {
    var keep = cardFocusId();
    var z = SKY_CONS[i].z, o = z.info[lang] || z.info.en, name = z.t[lang] || z.t.en, isZod = !!z.symbol;
    var K = { en: ['Zodiac constellation', 'Astrological dates', 'Brightest star', 'Main stars'], hans: ['黄道星座', '占星日期', '最亮星', '主要亮星'], hant: ['黃道星座', '占星日期', '最亮星', '主要亮星'], ja: ['黄道十二星座', '星占いの期間', '最も明るい星', '主要な星'], ko: ['황도 12궁 별자리', '점성술 기간', '가장 밝은 별', '주요 별'] };
    var KC = { en: ['Constellation', 'Best seen'], hans: ['星座', '最佳观测'], hant: ['星座', '最佳觀測'], ja: ['星座', '見頃'], ko: ['별자리', '관측 시기'] };
    var k = K[lang] || K.en, kc = KC[lang] || KC.en;
    bpBody.innerHTML =
      '<div id="bp-name" style="color:#9cc0ff">' + esc(name) + (z.symbol ? ' ' + z.symbol : '') + '</div>' +
      '<span id="bp-type">' + esc(isZod ? k[0] : kc[0]) + '</span>' +
      (z.img ? '<img id="bp-img" src="' + z.img + '" alt="' + esc(name) + '" loading="lazy"><div id="bp-credit">' + esc(z.credit || '') + '</div>' : '') +
      '<div class="bp-row"><span class="k">' + esc(isZod ? k[1] : kc[1]) + '</span><span class="v">' + esc(isZod ? o.dates : o.season) + '</span></div>' +
      '<div class="bp-row"><span class="k">' + esc(k[2]) + '</span><span class="v">' + esc(o.brightest) + '</span></div>' +
      '<div class="bp-row"><span class="k">' + esc(k[3]) + '</span><span class="v">' + z.stars.length + '</span></div>' +
      '<div id="bp-desc">' + esc(o.desc) + '</div>' +
      '<div id="bp-cat">' + (z.symbol ? z.symbol + ' · ' : '') + esc(z.t.en) + '</div>';
    restoreCardFocus(keep);
  }
  // Zodiac figure overlays: a glowing constellation figure fades in over the stars when its sign is picked.
  var ZFIG = { aries: 1, taurus: 1, gemini: 1, cancer: 1, leo: 1, virgo: 1, libra: 1, scorpius: 1, sagittarius: 1, capricornus: 1, aquarius: 1, pisces: 1 };
  var skyFigures = {}, skyFigLoader = null;
  var ZFIG_ANIM = {}; // (optional) keys whose figure has a seamless loop video; empty = all use the still image + the "living" twinkle shader (figure stays put, its stars shimmer + breathe)
  var FIG_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  var FIG_FRAG = 'uniform sampler2D map; uniform float uTime; uniform float uOpacity; varying vec2 vUv; void main(){ vec4 t = texture2D(map, vUv); vec2 cell = floor(vUv * 58.0); float h = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453); float br = 0.82 + 0.18 * (0.5 + 0.5 * sin(uTime * (1.0 + h * 1.5) + h * 6.2831)); gl_FragColor = vec4(t.rgb * br, t.a * uOpacity); }'; // wireframe holds its position but each cell shimmers on its own phase — subtle pixel-phase "alive" flicker, no motion
  function buildFigureSprite(e, c, tex, asp, additive, frag) { // a billboarded plane; the figure holds still while a per-pixel twinkle + breathe in the shader make it feel alive
    var base = SKY_R * 0.5 * (c.z.figScale || 1);
    var mat = new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, uTime: { value: 0 }, uOpacity: { value: 0 } }, vertexShader: FIG_VERT, fragmentShader: frag || FIG_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(base * asp, base), mat);
    e.baseW = base * asp; e.baseH = base; e.mat = mat;
    mesh.position.copy(c.dir).multiplyScalar(SKY_R * 0.9);
    mesh.renderOrder = 6; skyScene.add(mesh); e.sprite = mesh;
  }
  var ZFIG_STARS = { aries: 1, taurus: 1, gemini: 1, cancer: 1, leo: 1, virgo: 1, libra: 1, scorpius: 1, sagittarius: 1, capricornus: 1, aquarius: 1, pisces: 1 }; // figures with a separate extracted-star layer (images/constellations/<key>_stars.png) drawn over the star-free wireframe; that layer twinkles per-star, and the product's real stars + stick-lines are muted so there are no double stars
  var FIG_STARS_FRAG = 'uniform sampler2D map; uniform float uTime; uniform float uOpacity; varying vec2 vUv; void main(){ vec4 t = texture2D(map, vUv); vec2 cell = floor(vUv * 30.0); float h = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453); float fl = 0.23 + 0.77 * (0.5 + 0.5 * sin(uTime * (1.6 + h * 3.0) + h * 6.2831)); gl_FragColor = vec4(t.rgb * fl, t.a * uOpacity * fl); }'; // each extracted star point (per cell) flickers 23%<->100% on its own phase+speed — the strong per-star twinkle
  function buildStarsLayer(e, c, tex, asp) {
    var base = SKY_R * 0.5 * (c.z.figScale || 1);
    var mat = new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, uTime: { value: 0 }, uOpacity: { value: 0 } }, vertexShader: FIG_VERT, fragmentShader: FIG_STARS_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(base * asp, base), mat);
    mesh.position.copy(c.dir).multiplyScalar(SKY_R * 0.895); mesh.renderOrder = 7; skyScene.add(mesh); e.starsSprite = mesh; e.starsMat = mat;
  }
  function ensureSkyFigure(i) {
    if (i in skyFigures) return skyFigures[i];
    var c = SKY_CONS[i];
    if (!c || !ZFIG[c.z.key]) return (skyFigures[i] = null);
    var e = skyFigures[i] = { sprite: null, opacity: 0, target: 0, videoEl: null };
    var path = 'images/constellations/' + c.z.key;
    if (ZFIG_ANIM[c.z.key]) { // animated loop on a dark bg — additive blending keys the dark away, no alpha channel needed
      var v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.setAttribute('muted', ''); v.src = path + '.mp4'; e.videoEl = v;
      v.style.cssText = 'position:fixed;left:-4px;top:-4px;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1'; document.body.appendChild(v); // attached (hidden) so playback is reliable
      v.addEventListener('loadeddata', function () { if (e.released) return; v.play().catch(function () {}); var tx = new THREE.VideoTexture(v); if ('colorSpace' in tx) tx.colorSpace = THREE.SRGBColorSpace; buildFigureSprite(e, c, tx, (v.videoWidth / v.videoHeight) || 1, true); });
      v.load();
    } else {
      var hasStars = !!ZFIG_STARS[c.z.key]; e.twinkle = true; // wireframe base always shimmers (pixel-phase); the stars layer twinkles per-star on top
      var skyLdr = (skyFigLoader = skyFigLoader || new THREE.TextureLoader());
      skyLdr.load(path + '.png', function (tex) { if (e.released) { tex.dispose(); return; } if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace; buildFigureSprite(e, c, tex, (tex.image && tex.image.width / tex.image.height) || 1, true, FIG_FRAG); });
      if (hasStars) skyLdr.load(path + '_stars.png', function (tex) { if (e.released) { tex.dispose(); return; } if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace; buildStarsLayer(e, c, tex, (tex.image && tex.image.width / tex.image.height) || 1); }); // extracted glowing stars, twinkled over the star-free wireframe
    }
    return e;
  }
  function revealSkyFigure(i) { for (var j in skyFigures) if (skyFigures[j]) skyFigures[j].target = 0; var e = ensureSkyFigure(i); if (e) e.target = 0.74; }
  function hideSkyFigures() { for (var j in skyFigures) if (skyFigures[j]) skyFigures[j].target = 0; }
  function releaseSkyFigures() { // F075: leaving the sky frees the figure art (two ~760x1014 layers per sign) instead of carrying it into the galaxy
    for (var j in skyFigures) {
      var e = skyFigures[j]; delete skyFigures[j];
      if (!e) continue;
      e.released = true; // a texture still loading is dropped when it arrives
      [e.sprite, e.starsSprite].forEach(function (m) {
        if (!m) return;
        skyScene.remove(m); m.geometry.dispose();
        if (m.material.uniforms && m.material.uniforms.map && m.material.uniforms.map.value) m.material.uniforms.map.value.dispose();
        m.material.dispose();
      });
      if (e.videoEl) { e.videoEl.pause(); e.videoEl.removeAttribute('src'); e.videoEl.load(); if (e.videoEl.parentNode) e.videoEl.parentNode.removeChild(e.videoEl); }
    }
  }
  function updateSkyFigures() { // the real stick-figure lines fade out as the art fades in; the art gently breathes + shimmers so it feels alive
    var sel = window.skySelected, t = videoNow() * 0.001, still = solarReducedMotion();
    for (var j in skyFigures) { var e = skyFigures[j]; if (!e || !e.sprite) continue;
      e.opacity += (e.target - e.opacity) * 0.12; var vis = e.opacity > 0.01; e.sprite.visible = vis;
      if (e.videoEl) { if (vis) { if (e.videoEl.paused) e.videoEl.play().catch(function () {}); } else if (!e.videoEl.paused) e.videoEl.pause(); }
      if (e.mat) { e.mat.uniforms.uOpacity.value = e.opacity; e.mat.uniforms.uTime.value = (e.twinkle || !still) ? t : 0.0; e.sprite.quaternion.copy(skyCamera.quaternion); } // twinkle figures keep shimmering even under reduced motion
      else { e.sprite.material.opacity = e.opacity; }
      if (e.starsSprite) { e.starsMat.uniforms.uOpacity.value = e.opacity; e.starsMat.uniforms.uTime.value = t; e.starsSprite.quaternion.copy(skyCamera.quaternion); e.starsSprite.visible = e.opacity > 0.004; } // extracted-star layer keeps twinkling over the wireframe
      if (Number(j) === sel && SKY_CONS[j]) SKY_CONS[j].lineMat.opacity = (ZFIG_STARS[SKY_CONS[j].z.key] ? 0.0 : 0.9) * (1 - e.opacity); // ownStars figures already draw the full wireframe — drop the redundant real stick-lines entirely
    }
  }
  function selectSky(i) {
    noteCardOpener();
    if (i === skySelected) { clearSkySelection(); return; }
    window.skyGalSelected = null; SKY_GAL.forEach(function (g) { g.el.classList.remove('sel'); g.sprite.material.opacity = 0.85; }); // drop any galaxy highlight
    window.skySelected = i;
    var figSel = !!(SKY_CONS[i] && ZFIG[SKY_CONS[i].z.key]); // a zodiac figure will be drawn over this constellation
    var ownStars = !!(SKY_CONS[i] && ZFIG_STARS[SKY_CONS[i].z.key]); // figure carries its own twinkling star layer — keep the product's real stars out of the way
    SKY_CONS.forEach(function (c, ci) {
      c.el.classList.toggle('sel', ci === i);
      c.el.classList.toggle('dim', ci !== i);
      c.lineMat.opacity = ci === i ? 0.9 : 0.12;
      c.starMat.uniforms.uMul.value = ci === i ? (ownStars ? 0.0 : (figSel ? 2.6 : 1.5)) : 0.4; // ownStars: fully hide the product's real star sprites so only the figure's own extracted-star layer shows (no double/overlapping stars); else brighten reals to read over the figure
    });
    revealSkyFigure(i);
    renderConstellationPanel(i, beaconLang);
    bpEl.classList.add('open');
  }
  window.clearSkySelection = function () {
    returnCardFocus();
    window.skySelected = null; window.skyGalSelected = null;
    hideSkyFigures();
    SKY_CONS.forEach(function (c) {
      c.el.classList.remove('sel', 'dim');
      c.lineMat.opacity = 0.45;
      c.starMat.uniforms.uMul.value = 1;
    });
    SKY_GAL.forEach(function (g) { g.el.classList.remove('sel'); g.sprite.material.opacity = 0.85; });
    bpEl.classList.remove('open');
  };
  window.addEventListener('keydown', function (e) {
    if (document.body.classList.contains('gx-cinema')) return; // cinema mode owns Escape first
    if ((e.key || '').toLowerCase() === 'escape' && viewMode === 'sky' && (skySelected != null || window.skyGalSelected != null)) {
      clearSkySelection();
      e.stopImmediatePropagation(); // consume: the NEXT Esc exits the sky view, not this one
    }
  });
  window.addEventListener('click', function (e) { if (!clickWasDrag(e) && !onPageControl(e) && viewMode === 'sky' && (skySelected != null || window.skyGalSelected != null)) clearSkySelection(); });
  var skybackEl = document.getElementById('skyback'), skyVeilEl = document.getElementById('skyveil');
  function updateSolarNavigationText() {
    var L = typeof beaconLang === 'string' ? beaconLang : 'en';
    if (typeof solarStripEl !== 'undefined' && solarStripEl && solarStripEl.dataset.lang !== L) buildSolarStrip(); // roster follows the language switch
    var gStripEl = document.getElementById('galaxystrip'); if (gStripEl && gStripEl.dataset.lang !== L && typeof buildGalaxyStrip === 'function') buildGalaxyStrip();
    var scaleToggle = document.getElementById('solarscale');
    if (scaleToggle) { var scaleText = { en: 'True scale', hans: '真实比例', hant: '真實比例', ja: '実スケール', ko: '실제 축척' }[L] || 'True scale'; scaleToggle.title = scaleText; scaleToggle.setAttribute('aria-label', scaleText); }
    var text = {
      en: { galaxy: '← Back to Galaxy', solar: '← Back to Solar System', earth: '← Back to Earth' },
      hans: { galaxy: '← 返回银河系', solar: '← 返回太阳系', earth: '← 返回地球' },
      hant: { galaxy: '← 返回銀河系', solar: '← 返回太陽系', earth: '← 返回地球' },
      ja: { galaxy: '← 銀河に戻る', solar: '← 太陽系に戻る', earth: '← 地球に戻る' },
      ko: { galaxy: '← 은하로 돌아가기', solar: '← 태양계로 돌아가기', earth: '← 지구로 돌아가기' }
    }[L] || { galaxy: '← Back to Galaxy', solar: '← Back to Solar System', earth: '← Back to Earth' };
    var skyBack = document.getElementById('skyback'), solarBack = document.getElementById('solarback');
    if (skyBack) { skyBack.textContent = skyReturnContext ? text.earth : text.galaxy; skyBack.setAttribute('aria-label', skyBack.textContent); }
    if (solarBack) {
      var backText = solarNav && solarNav.level === 'focus' ? text.solar : text.galaxy;
      if (solarNav && solarNav.level === 'focus' && solarNav.parentId) {
        var parent = SOLAR_BY_ID[solarNav.parentId], parentName = parent && (parent.info[L] || parent.info.en).name;
        if (parentName) {
          var lastCode = parentName.charCodeAt(parentName.length - 1), jong = lastCode >= 0xac00 && lastCode <= 0xd7a3 ? (lastCode - 0xac00) % 28 : 0;
          backText = {
            en: '← Back to ' + parentName,
            hans: '← 返回' + parentName,
            hant: '← 返回' + parentName,
            ja: '← ' + parentName + 'に戻る',
            ko: '← ' + parentName + (jong && jong !== 8 ? '으로' : '로') + ' 돌아가기'
          }[L] || '← Back to ' + parentName;
        }
      }
      solarBack.textContent = backText; solarBack.setAttribute('aria-label', backText);
    }
    var titleEl = document.getElementById('title'), titleHint = titleEl && titleEl.querySelector('small');
    var titleText = {
      en: ['Milky Way Galaxy', 'drag to orbit · scroll to zoom · F cinema', 'drag to orbit · pinch to zoom'],
      hans: ['银河系', '拖动旋转 · 滚轮缩放 · F 影院模式', '拖动旋转 · 双指缩放'],
      hant: ['銀河系', '拖曳旋轉 · 滾輪縮放 · F 劇院模式', '拖曳旋轉 · 雙指縮放'],
      ja: ['天の川銀河', 'ドラッグで回転 · スクロールでズーム · F シネマ', 'ドラッグで回転 · ピンチでズーム'],
      ko: ['우리은하', '드래그로 회전 · 스크롤로 확대/축소 · F 시네마', '드래그로 회전 · 핀치로 확대/축소']
    }[L] || ['Milky Way Galaxy', 'drag to orbit · scroll to zoom · F cinema', 'drag to orbit · pinch to zoom'];
    if (titleEl && titleEl.firstChild && titleEl.firstChild.nodeType === 3) titleEl.firstChild.nodeValue = '拾光星河\n  ';
    document.title = '拾光星河';
    document.documentElement.lang = { en: 'en', hans: 'zh-Hans', hant: 'zh-Hant', ja: 'ja', ko: 'ko' }[L] || 'en'; // right voice for screen readers, right Han glyphs
    var hintParts = (solarPointerCoarse ? titleText[2] : titleText[1]).split(' · ');
    if (viewMode === 'sky') hintParts.splice(1, 1); // the sky dome does not zoom
    if (titleHint) titleHint.textContent = hintParts.join(' · ');
    var creditsLink = document.getElementById('credits');
    if (creditsLink) creditsLink.textContent = { en: 'Credits & source', hans: '鸣谢与源代码', hant: '鳴謝與原始碼', ja: 'クレジットとソース', ko: '출처와 소스 코드' }[L] || 'Credits & source';
    var closeText = { en: 'Close', hans: '关闭', hant: '關閉', ja: '閉じる', ko: '닫기' }[L] || 'Close';
    var closeButton = document.getElementById('bp-close');
    if (closeButton) { closeButton.setAttribute('aria-label', closeText); closeButton.setAttribute('title', closeText); }
  }
  function enterSky(origin) {
    ensureSkyComposer();
    if (origin !== 'earth') { skyDive = null; skyArrival = null; }
    if (origin === 'earth') {
      if (viewMode !== 'solar') return false;
    } else {
      if (viewMode !== 'galaxy') return false;
      skyReturnContext = null;
      clearSelection();
    }
    viewMode = 'sky';
    controls.enabled = false; solarControls.enabled = false; skyControls.enabled = true;
    document.getElementById('beacons').style.display = 'none';
    var sl = document.getElementById('skylabels'); if (sl) sl.style.display = '';
    skybackEl.style.display = 'block';
    if (solarLabelsEl) solarLabelsEl.style.display = 'none';
    if (solarBackEl) solarBackEl.style.display = 'none';
    updateSolarNavigationText();
    return true;
  }
  var skyArrival = null, skyDive = null, skyDivePoint = new THREE.Vector3();
  function stepSkyDive() { // plays INSIDE the sky view: the last solar frames dive into Earth, then the veil hands over
    if (!skyDive) return false;
    if (!skyDive.t0) {
      skyDive.t0 = videoNow();
      skyDive.from = solarCamera.position.clone(); skyDive.fromT = solarControls.target.clone();
    }
    var k = Math.min(1, (videoNow() - skyDive.t0) / skyDive.dur);
    var e = k * k * k; // accelerating plunge
    e = Math.min(e, skyDive.e + 0.06); skyDive.e = e;
    SOLAR_OBJECTS.earth.mesh.getWorldPosition(skyDivePoint);
    var dest = skyDivePoint.clone().addScaledVector(skyDive.from.clone().sub(skyDivePoint).normalize(), SOLAR_OBJECTS.earth.radius * 1.08);
    solarCamera.position.lerpVectors(skyDive.from, dest, e);
    solarCamera.lookAt(skyDivePoint);
    skyVeilEl.style.opacity = String(Math.max(0, Math.min(1, (k - 0.55) / 0.4))); // atmosphere whites out as we hit it
    updateSolarMotion(0.016);
    if (e >= 1) { skyDive = null; return false; } // next frame: the sky fades in through the veil
    return true;
  }
  function stepSkyArrival() {
    if (!skyArrival) return;
    if (!skyArrival.t0) {
      skyArrival.t0 = videoNow();
      skyArrival.fov = skyCamera.fov;
      skyVeilEl.style.opacity = '1'; // atmosphere flash on the first animated frame only
    }
    var k = Math.min(1, (videoNow() - skyArrival.t0) / skyArrival.dur);
    skyCamera.fov = skyArrival.fov + (26 - skyArrival.fov) * Math.pow(1 - k, 3); // falling back to the ground
    skyCamera.updateProjectionMatrix();
    skyVeilEl.style.opacity = String(Math.max(0, 1 - k * 2.2));
    if (k >= 1) { skyArrival = null; skyVeilEl.style.opacity = '0'; }
  }
  function enterSkyFromEarth() {
    if (viewMode !== 'solar' || solarNav.selectedId !== 'earth' || solarNav.parentId !== null) return false;
    cancelSolarWarp(); // never snapshot a mid-warp camera — the dormant warp would resume on return
    solarFly = null;
    cancelSolarEventRide(); clearSolarBanner(); // a transit rig must not be the snapshot, nor its caption hang over the sky
    skyReturnContext = { solar: solarSnapshot(), paused: solarPaused, elapsed: solarElapsed }; // the dive keeps the clock running; the snapshot framed Earth at this time
    clearSolarCard();
    var entered = enterSky('earth');
    if (entered && !solarReducedMotion()) {
      skyDive = { t0: 0, dur: 1300, e: 0 };   // first: the camera plunges into Earth (solar scene)
      skyArrival = { t0: 0, dur: 1100 };      // then: the sky fades in from the atmosphere flash
    }
    return entered;
  }
  function returnSkyToEarth() {
    if (viewMode !== 'sky' || !skyReturnContext) return false;
    skyArrival = null; skyDive = null; skyVeilEl.style.opacity = '0'; skyCamera.fov = 60; skyCamera.updateProjectionMatrix();
    var context = skyReturnContext;
    if (window.clearSkySelection) clearSkySelection();
    releaseSkyFigures();
    viewMode = 'solar';
    skyControls.enabled = false; controls.enabled = false; solarControls.enabled = true;
    document.getElementById('beacons').style.display = 'none';
    var labels = document.getElementById('skylabels'); if (labels) labels.style.display = 'none';
    skybackEl.style.display = 'none';
    if (solarLabelsEl) solarLabelsEl.style.display = '';
    if (solarBackEl) solarBackEl.style.display = 'block';
    skyReturnContext = null;
    solarElapsed = context.elapsed; updateSolarMotion(0); // put Earth back where the restored camera framed it (at 16x it had moved off-screen)
    setSolarNavigation(context.solar);
    setSolarPaused(context.paused);
    updateSolarLabels();
    if (context.solar.panelOpen) renderSolarPanel(context.solar.selectedId, beaconLang); else clearSolarCard();
    updateSolarNavigationText();
    solarFrameLast = 0; resetSolarPerformanceWatchdog(); perfLast = 0;
    return true;
  }
  function exitSky() {
    if (viewMode !== 'sky') return;
    if (skyReturnContext) { returnSkyToEarth(); return; }
    if (window.clearSkySelection) clearSkySelection(); // close a sky card if open
    releaseSkyFigures();
    viewMode = 'galaxy';
    skyControls.enabled = false; controls.enabled = true;
    document.getElementById('beacons').style.display = '';
    var sl = document.getElementById('skylabels'); if (sl) sl.style.display = 'none';
    skybackEl.style.display = 'none';
    updateSolarNavigationText();
    perfLast = 0;                              // don't feed the sky stint into the FPS watchdog
  }
  skybackEl.addEventListener('click', exitSky);
  window.addEventListener('keydown', function (e) {
    if ((e.key || '').toLowerCase() !== 'escape' || viewMode !== 'sky') return;
    if (document.body.classList.contains('gx-cinema')) return; // cinema mode owns Escape first
    if (window.skySelected != null || window.skyGalSelected != null) return;
    exitSky();
    e.stopImmediatePropagation();
  });

  // ── render loop (continuous while visible; drives spin + twinkle + breathe + fx) ──
  var t0 = videoNow(), rafId = null, videoFrameCount = 0, videoSolarPreparing = false;
  // FPS watchdog: keep an EMA of frame time (samples clamped to 500ms; tab-switch gaps
  // excluded by resetting perfLast on visibilitychange). First look after 8s, then every
  // 10s: if sustained under ~25fps (40ms — a healthy 30Hz panel sits at 33.3ms, safely
  // below), take ONE step down degradeRendering()'s ladder, ordered by measured payoff —
  // halve the raymarch steps, drop to 1x resolution, drop bloom (tone-mapping stays), hide
  // the raymarched nebulae, and only then halve the dust (perfScale 1 → .5 → .25). Never scales back up.
  var perfScale = 1, perfEMA = 16.7, perfLast = 0, perfNextCheck = videoNow() + 8000;
  var perfVolHalved = false, perfVolHidden = false, perfBloomOff = false;
  function flashMsg(text) { setMsg(text); setTimeout(function () { var el = document.getElementById('msg'); if (el && el.textContent === text) setMsg(''); }, 2500); }
  function setBloomEnabled(c, on) { if (c) for (var i = 0; i < c.passes.length; i++) if (c.passes[i] instanceof THREE.UnrealBloomPass) c.passes[i].enabled = on; }
  function degradeRendering(withVolumes) { // one step down the shared, one-way ladder; returns what changed ('' when exhausted)
    if (withVolumes && !perfVolHalved && galaxyVols.length) { // raymarched nebulae: up to ~85% of a close-up frame
      perfVolHalved = true;
      galaxyVols.forEach(function (v) { v.mat.uniforms.uSteps.value = v.steps * 0.5; });
      return 'nebula detail reduced';
    }
    if (renderer.getPixelRatio() > 1) { // fill-rate: 4x fewer pixels on hidpi
      var prDrop = 1 / renderer.getPixelRatio();
      renderer.setPixelRatio(1);
      renderer.setSize(window.innerWidth, window.innerHeight);
      // composers cache the ratio they were built with: setSize alone left their targets + bloom at 2x
      if (composer) composer.setPixelRatio(1);
      if (skyComposer) skyComposer.setPixelRatio(1);
      if (solarComposer) solarComposer.setPixelRatio(1);
      rescalePointSizes(prDrop);
      return 'resolution reduced';
    }
    if (!perfBloomOff && (composer || skyComposer || solarComposer)) { // bloom passes off; the composers (and the galaxy's ACES grade) keep running
      perfBloomOff = true;
      setBloomEnabled(composer, false); setBloomEnabled(skyComposer, false); setBloomEnabled(solarComposer, false);
      return 'glow disabled';
    }
    if (withVolumes && !perfVolHidden && galaxyVols.length) { // still slow: drop the raymarched volumes altogether (now only Centaurus A's dust lane)
      perfVolHidden = true;
      return 'nebulae hidden';
    }
    return '';
  }
  var solarPerfEMA = 16.7, solarPerfLast = 0, solarPerfNextCheck = 0;
  function resetSolarPerformanceWatchdog(now) {
    now = now == null ? videoNow() : now;
    solarPerfEMA = 16.7; solarPerfLast = 0; solarPerfNextCheck = now + 10000;
  }
  function sampleSolarPerformance(now) {
    if (solarPerfLast) solarPerfEMA += (Math.min(now - solarPerfLast, 500) - solarPerfEMA) * 0.05;
    solarPerfLast = now;
    if (!videoMode && now > solarPerfNextCheck) {
      solarPerfNextCheck = now + 10000;
      if (solarPerfEMA > 40 && solarPerf.stage < 3) {
        applySolarPerformanceTier(solarPerf.stage + 1);
        flashMsg('low frame rate — Solar System detail reduced');
      } else if (solarPerfEMA > 40) { // its own stages are spent: resolution, then bloom
        var solarStep = degradeRendering(false);
        if (solarStep) flashMsg('low frame rate — ' + solarStep);
      }
    }
  }
  buildSolarBodies();
  buildAsteroidBelt(Math.max(500, Math.floor(4500 * perfScale)));
  buildTrojans();
  applySolarPerformanceTier(0);
  function frame() {
    rafId = null;
    if (document.hidden) return;
    if (videoMode) videoClockMs += videoFrameStepMs;
    videoFrameCount++;
    var nowMs = videoNow(), t = (nowMs - t0) / 1000;
    if (viewMode === 'sky') {
      if (skyDive && stepSkyDive()) { // dive-into-Earth prologue: render the solar scene one last stretch
        if (solarComposer) solarComposer.render(); else renderer.render(solarScene, solarCamera);
        rafId = requestAnimationFrame(frame);
        return;
      }
      if (skyTwinkleMat && !solarReducedMotion()) skyTwinkleMat.uniforms.uTime.value = t;
      if (!solarReducedMotion()) for (var si = 0; si < SKY_CONS.length; si++) SKY_CONS[si].starMat.uniforms.uTime.value = t; // twinkle the constellation stars
      stepSkyArrival();
      skyControls.update();
      updateSkyFigures();
      if (skyComposer) skyComposer.render(); else renderer.render(skyScene, skyCamera);
      if (!solarReducedMotion()) updateSkyFx(nowMs);
      if (window.updateSkyLabels) updateSkyLabels();
      rafId = requestAnimationFrame(frame);
      return;
    }
    if (viewMode === 'solar') {
      if (videoMode && videoSolarPreparing) {
        drainSolarUploadQueue();
        if (solarComposer) solarComposer.render(); else renderer.render(solarScene, solarCamera);
        rafId = requestAnimationFrame(frame);
        return;
      }
      var solarNow = nowMs, solarDt = solarFrameLast ? Math.min((solarNow - solarFrameLast) / 1000, 0.15) : 0;
      solarFrameLast = solarNow;
      updateSolarMotion(solarDt);
      drainSolarUploadQueue();
      updateSolarSunOcclusion();
      updateSolarCameraLife();
      if (!stepSolarWarp() && !stepSolarFly() && !stepSolarScale() && !stepSolarEventRide(solarDt)) { stepSolarFollow(); solarControls.update(); } // warp, fly, scale, event ride, then free orbit
        updateSolarBackdrop();
      if (!solarReducedMotion()) updateSolarFx(solarNow);
      sampleSolarPerformance(solarNow); // before drawing: a resolution step resizes the canvas, which would blank this frame
      if (solarComposer) solarComposer.render(); else renderer.render(solarScene, solarCamera);
      solarPerf.labelFrame++;
      if (solarPerf.labelFrame % solarPerf.labelEvery === 0) updateSolarLabels();
      rafId = requestAnimationFrame(frame);
      return;
    }
    if (!solarReducedMotion()) galaxyRoot.rotation.y = t * GALAXY_SPIN; // the whole galaxy slowly rotates
    for (var li = 0; li < galaxyLODs.length; li++) { // per-galaxy LOD + self-rotation about the disc axis
      var L = galaxyLODs[li], dst = camera.position.distanceTo(L.center); L.dst = dst; // cached for the feature LOD gate below
      L.pts.geometry.setDrawRange(0, Math.max(400, Math.floor(L.maxN * Math.min(1, Math.max(0.14, L.refDist / dst)) * perfScale)));
      L.mat.uniforms.uSize.value = L.baseSize * Math.min(3.2, Math.max(0.8, dst / L.refDist)) * renderer.getPixelRatio();
      if (L.mat.uniforms.uCap) L.mat.uniforms.uCap.value = 34 * renderer.getPixelRatio(); // keeps the close-up star cap in sync if the perf watchdog drops pixelRatio
      if (!solarReducedMotion()) L.pts.quaternion.copy(L.q0).premultiply(galSpinTmp.setFromAxisAngle(L.axis, t * L.spin)); // spins in its own disc plane
      if (L.paint) for (var pj = 0; pj < L.paint.length; pj++) { var PJ = L.paint[pj]; if (PJ.born === -1) PJ.born = t; // painting fades in when its bake lands
        if (PJ.born !== null) PJ.mat.uniforms.uFade.value = videoMode || solarReducedMotion() ? 1 : Math.min(1, (t - PJ.born) / 0.6); }
    }
    for (var gvi = 0; gvi < galaxyVeils.length; gvi++) { // Magellanic gas veils breathe ±30% on long desynced periods (still under reduced motion)
      var GV = galaxyVeils[gvi];
      var gvf = GV.hn ? Math.min(1, Math.max(0, (GV.lod.dst - GV.hn[0]) / (GV.hn[1] - GV.hn[0]))) : 1; // photo plates dissolve up close — the sampled particles carry the close-up
      GV.mat.opacity = GV.o * gvf * (solarReducedMotion() ? 1 : 1 + GV.amp * Math.sin(t * 6.2832 / GV.T + GV.ph));
      if (GV.dr && !solarReducedMotion()) GV.mat.rotation = GV.r0 + t * GV.dr; // slow filament crawl
    }
    for (var gli = 0; gli < galaxyVols.length; gli++) { // volumetric nebulae: face the camera, evolve imperceptibly
      var GVL = galaxyVols[gli];
      GVL.mesh.visible = !perfVolHidden; // watchdog escape hatch — raymarch is the priciest decoration
      GVL.mesh.lookAt(camera.position);
      if (!solarReducedMotion()) GVL.mat.uniforms.uTime.value = t;
    }
    for (var ci = 0; ci < BEACONS.length; ci++) { // in-galaxy features: always on, but LOD-gated — hidden + not animated when sub-pixel at distance
      var cb = BEACONS[ci];
      if (!cb.child || !cb.feature) continue;
      var fvis = !cb.lod || cb.lod.dst < cb.lod.refDist * 4;
      cb.feature.group.visible = fvis;
      if (fvis && !solarReducedMotion()) cb.feature.update(t);
    }
    if (bgTwinkleMat && !solarReducedMotion()) bgTwinkleMat.uniforms.uTime.value = t; // background-star twinkle
    var cbw = solarReducedMotion() ? 0 : Math.sin(t * 0.32), cbr = 1 + 0.07 * cbw; // ~20s galactic-core breathe
    if (paintedGalaxy) paintedGalaxy.updateView(camera);
    var cbk = 0.0012 * camera.position.length(), cbf = Math.min(0.75, Math.max(0.32, Math.exp(-cbk * cbk))); // the scene-fog curve the halos were tuned under, held between d≈450 (cap: no extra close-up glare) and the d≈890 load view (floor: zooming out keeps the core)
    for (var cbi = 0; cbi < coreBreath.length; cbi++) {
      var cb = coreBreath[cbi], cbs = cb.s * cbr;
      cb.sp.scale.set(cbs, cbs, 1);
      cb.sp.material.opacity = cb.o * cbf * (1 + 0.16 * cbw); // halo brightness swings with the size
    }
    if (beaconRing.visible) { // pulsing selection halo — breathes in size AND brightness so the picked beacon clearly pops
      if (solarReducedMotion()) { beaconRing.scale.set(54, 54, 1); beaconRing.material.opacity = 0.9; }
      else { var bp = Math.sin(t * 3.0); var bs = 54 * (1 + 0.22 * bp); beaconRing.scale.set(bs, bs, 1); beaconRing.material.opacity = 0.6 + 0.35 * (0.5 + 0.5 * bp); }
    }
    if (!solarReducedMotion()) updateFx(nowMs); // meteors + supernovae scheduling (no-op when idle)
    var fnow = nowMs;
    if (perfLast) { perfEMA += (Math.min(fnow - perfLast, 500) - perfEMA) * 0.05; }
    perfLast = fnow;
    if (paintQueue.length) perfNextCheck = Math.max(perfNextCheck, fnow + 8000); // tile bakes are a one-off cost: judge the frame rate only after them
    if (!videoMode && fnow > perfNextCheck) {
      perfNextCheck = fnow + 10000;
      if (perfEMA > 40) { // sustained < ~25fps
        var galaxyStep = degradeRendering(true);
        if (!galaxyStep && perfScale > 0.26) { perfScale *= 0.5; buildDust(dustFor()); galaxyStep = 'dust density reduced'; } // measured ~5% — last resort
        if (galaxyStep) flashMsg('low frame rate — ' + galaxyStep);
      }
    }
    if (!stepFly()) controls.update(); // while flying to a galaxy, stepFly drives the camera
    render();
    updateBeacons(); // after render: galaxyRoot/camera world matrices are fresh
    rafId = requestAnimationFrame(frame);
  }
  function rescalePointSizes(f) { // point shaders bake renderer.getPixelRatio() into uSize/uCap at build time
    var seen = [];
    [scene, skyScene, solarScene].forEach(function (root) {
      root.traverse(function (o) {
        var u = o.material && o.material.uniforms;
        if (!u || seen.indexOf(u) !== -1) return;
        seen.push(u);
        if (u.uSize) u.uSize.value *= f;
        if (u.uCap) u.uCap.value *= f;
      });
    });
  }
  function startLoop() { if (rafId == null && !document.hidden) rafId = requestAnimationFrame(frame); }
  document.addEventListener('visibilitychange', function () { perfLast = 0; solarFrameLast = 0; resetSolarPerformanceWatchdog(); startLoop(); }); // reset frame clocks so resume gaps do not enter animation timing
  function applyOutputSize() {
    var shiguangViewport = shiguangViewportSize();
    outputWidth = videoMode ? videoConfig.width : shiguangViewport.width;
    outputHeight = videoMode ? videoConfig.height : shiguangViewport.height;
    camera.aspect = outputWidth / outputHeight; camera.updateProjectionMatrix();
    skyCamera.aspect = outputWidth / outputHeight; skyCamera.updateProjectionMatrix();
    solarCamera.aspect = outputWidth / outputHeight; solarCamera.updateProjectionMatrix();
    renderer.setSize(outputWidth, outputHeight);
    if (composer) composer.setSize(outputWidth, outputHeight);
    if (skyComposer) skyComposer.setSize(outputWidth, outputHeight);
    if (solarComposer) solarComposer.setSize(outputWidth, outputHeight);
  }
  window.addEventListener('resize', function () {
    applyOutputSize();
    refreshSolarResponsiveState();
  });
  onMediaChange(solarPointerMedia, refreshSolarResponsiveState);

  // ── ambient effects: shooting stars + supernovae ────────────────────────────
  // A one-shot FX micro-system: short-lived sprites/points, updated by updateFx()
  // inside the render loop; each disposes itself when its clock runs out. Nothing
  // here adds steady per-frame work.
  var fxGroup = new THREE.Group(); galaxyRoot.add(fxGroup); // FX ride the galaxy rotation
  var fxList = [];
  // shooting stars — spawned INSIDE the current camera frustum. Uniform sky spawning
  // left 99.7% of meteors outside the 55° view (measured), which is why nobody ever
  // saw one. We pick a random on-screen NDC point, unproject it onto the far sky,
  // and derive the flight path from a second NDC point — the streak is GUARANTEED
  // to cross what the operator is looking at. A glowing head sprite rides the line.
  // Optional (ndc, t0, dndc) let a meteor SHOWER share a radiant + screen direction
  // and stagger start times (future t0s stay dormant via the k<0 guard in updateFx).
  var meteorNext = videoNow() + 12000 + Math.random() * 20000;
  var novaNext = videoNow() + 90000 + Math.random() * 120000;   // first supernova within 1.5–3.5min, then every 6–12min
  function skyPointInView(nx, ny, r) { // NDC (x,y) → a point r units from the camera along that view ray
    var v = new THREE.Vector3(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
    return camera.position.clone().addScaledVector(v, r);
  }
  // fireball streak texture (ref photo): white-gold head with a bloom, long orange
  // tail that TAPERS in width and fades in brightness — per-pixel, perfectly smooth.
  // (The old 1px uniform line + dot head read as 'a pin flying past'.)
  function meteorTexture() {
    var W2 = 256, H2 = 64, c = document.createElement('canvas'); c.width = W2; c.height = H2;
    var x = c.getContext('2d'), img = x.createImageData(W2, H2), d = img.data;
    for (var py = 0; py < H2; py++) {
      for (var px = 0; px < W2; px++) {
        var u = px / (W2 - 1);                            // 0 = tail end → 1 = head
        var v = (py - (H2 - 1) / 2) / ((H2 - 1) / 2);     // -1..1 across
        var wHalf = 0.12 + 0.5 * Math.pow(u, 1.6);        // tail thin → head wide
        var a = Math.pow(u, 2) * Math.exp(-(v * v) / (wHalf * wHalf * 0.5));
        var duh = (u - 0.93) / 0.05, hv = v / 0.55;
        a += Math.exp(-(duh * duh + hv * hv));            // head bloom
        if (a > 1) a = 1;
        var i = (py * W2 + px) * 4;
        if (a > 0.004) {
          var t3 = Math.min(1, Math.pow(u, 2) * 1.6);     // deep orange tail → white-gold head
          d[i] = 255;
          d[i + 1] = Math.round(120 + 130 * t3);
          d[i + 2] = Math.round(40 + 190 * t3);
          d[i + 3] = Math.round(a * 255);
        }
      }
    }
    x.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(c);
  }
  var METEOR_TEX = meteorTexture(), METEOR_GEO = new THREE.PlaneGeometry(1, 1); // shared
  function spawnMeteor(ndc, t0Opt, dndc) {
    var nx = ndc ? ndc[0] : Math.random() * 1.5 - 0.75, ny = ndc ? ndc[1] : Math.random() * 1.1 - 0.25;
    var dx = dndc ? dndc[0] + (Math.random() - 0.5) * 0.12 : (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.5);
    var dy = dndc ? dndc[1] + (Math.random() - 0.5) * 0.08 : -(0.3 + Math.random() * 0.5);
    var r = 700 + Math.random() * 250;
    var from = skyPointInView(nx, ny, r), to = skyPointInView(nx + dx, ny + dy, r);
    var dir = to.sub(from), dist = dir.length(); dir.multiplyScalar(1 / dist);
    var W3 = 2.5 + Math.random() * 1.5; // THIN — at galactic scale a meteor is a fine streak (was 7-10, read too fat)
    // ribbon basis: +X along flight, +Y across, facing the camera (computed once —
    // meteors live ~1s, the camera barely moves)
    var viewDir = from.clone().sub(camera.position).normalize();
    var side = new THREE.Vector3().crossVectors(dir, viewDir);
    if (side.lengthSq() < 1e-4) side.set(0, 1, 0); else side.normalize();
    // RIGHT-handed basis: X×Y must equal Z. (side×dir gave a det=-1 REFLECTION —
    // setFromRotationMatrix extracts garbage from those, so streaks rendered with
    // their long axis pointing away from the flight direction at many angles.)
    var normal = new THREE.Vector3().crossVectors(dir, side);
    var m = new THREE.MeshBasicMaterial({ map: METEOR_TEX, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    var mesh = new THREE.Mesh(METEOR_GEO, m);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(dir, side, normal));
    mesh.scale.set(0.001, W3, 1); mesh.frustumCulled = false;
    scene.add(mesh); // on the fixed sky, not galaxyRoot
    fxList.push({ kind: 'meteor', obj: mesh, mat: m, from: from, dir: dir, dist: dist, t0: t0Opt || videoNow(), dur: 1000 + Math.random() * 500 });
  }
  // supernova — three acts, like an astrophoto: ① a DIFFRACTION CROSS (four tapered
  // spikes) flashes up first, ② the round blast bursts through it, ③ a slow orange
  // afterglow fades to nothing. Spawned INSIDE the current view frustum (uniform sky
  // placement measured 0% on-screen).
  var NOVA_C = new THREE.Color(0xff7a8f), NOVA_ORANGE = new THREE.Color(0xffc07a), novaWhite = new THREE.Color(0xffffff), novaTmp = new THREE.Color(); // blue-white → white → orange → rose (cooling photosphere)
  function crossTexture() { // FOUR-POINTED STAR (ref): BRIGHTEST at the centre; each arm
    // fades with distance AND its width narrows continuously toward the tip, so the
    // arms end as faint SHARP points. Per-pixel; lateral gaussian whose sigma is
    // proportional to the remaining arm length.
    var S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    var x = c.getContext('2d'), img = x.createImageData(S, S), d = img.data;
    for (var py = 0; py < S; py++) {
      for (var px = 0; px < S; px++) {
        var nx = (px - 127.5) / 127.5, ny = (py - 127.5) / 127.5; // -1..1
        var vLen = Math.max(0, 1 - Math.abs(ny)), vFade = Math.pow(vLen, 1.6);
        var s1 = 0.006 + 0.03 * vLen, s2 = 0.02 + 0.08 * vLen, s3 = 0.05 + 0.14 * vLen;
        var aw = Math.exp(-(nx * nx) / (s1 * s1)) * vFade;                    // vertical core — tapers to a point
        var ap = Math.exp(-(nx * nx) / (s2 * s2)) * vFade * 0.5;              // pink sheath
        var am = Math.exp(-(nx * nx) / (s3 * s3)) * Math.pow(vLen, 2.2) * 0.18; // wide glow, centre-weighted
        var hLen = Math.max(0, 1 - Math.abs(nx)), hFade = Math.pow(hLen, 1.6);
        var t1 = 0.006 + 0.03 * hLen, t2 = 0.02 + 0.08 * hLen, t3 = 0.05 + 0.14 * hLen;
        aw += Math.exp(-(ny * ny) / (t1 * t1)) * hFade;                       // horizontal arm, same taper
        ap += Math.exp(-(ny * ny) / (t2 * t2)) * hFade * 0.5;
        am += Math.exp(-(ny * ny) / (t3 * t3)) * Math.pow(hLen, 2.2) * 0.18;
        aw += Math.exp(-(nx * nx + ny * ny) * 60) * 1.2;                      // blazing centre — brightest point of all
        var a = aw + ap + am; if (a > 1) a = 1;
        var i = (py * S + px) * 4;
        if (a > 0.003) {
          var tot = aw + ap + am;
          d[i] = 255;
          d[i + 1] = Math.round((255 * aw + 205 * ap + 170 * am) / tot);
          d[i + 2] = Math.round((255 * aw + 230 * ap + 215 * am) / tot);
          d[i + 3] = Math.round(a * 255);
        }
      }
    }
    x.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(c);
  }
  var CROSS_TEX = crossTexture();
  // Real supernovae photograph as a POINT SOURCE: a blinding compact core, a
  // radiance halo with steep (near-exponential) falloff, and long thin diffraction
  // spikes — NOT an expanding flat disc (the previous hard-edged ball read as a
  // beige paper circle). Three layers reproduce that PSF look.
  function novaCoreTexture() { // brilliant compact centre, steep falloff
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d');
    var gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.16, 'rgba(255,255,255,1)');
    gr.addColorStop(0.34, 'rgba(255,255,255,0.5)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.beginPath(); x.arc(64, 64, 64, 0, 6.2832); x.fill();
    return new THREE.CanvasTexture(c);
  }
  function novaHaloTexture() { // wide radiance, near-exponential falloff — glow, not a rim
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d');
    var gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); // dense stops ≈ exponential falloff, no banding
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.12, 'rgba(255,255,255,0.62)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.38)');
    gr.addColorStop(0.4, 'rgba(255,255,255,0.21)');
    gr.addColorStop(0.55, 'rgba(255,255,255,0.11)');
    gr.addColorStop(0.7, 'rgba(255,255,255,0.05)');
    gr.addColorStop(0.85, 'rgba(255,255,255,0.018)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.beginPath(); x.arc(64, 64, 64, 0, 6.2832); x.fill();
    return new THREE.CanvasTexture(c);
  }
  var NOVA_CORE_TEX = novaCoreTexture(), NOVA_HALO_TEX = novaHaloTexture();
  function smooth01(x) { x = x < 0 ? 0 : (x > 1 ? 1 : x); return x * x * (3 - 2 * x); } // smoothstep — silky ramps everywhere
  function spawnNova(options) {
    var durationMs = options && options.durationMs !== undefined ? options.durationMs : 6000;
    if (!Number.isFinite(durationMs) || durationMs < 100 || durationMs > 60000) {
      throw new Error('Supernova durationMs must be between 100 and 60000 ms');
    }
    // Spawn AWAY from the galaxy on screen (operator: keep distance — more elegant).
    // The disc projects as a flattened ELLIPSE at typical viewing angles, so an
    // isotropic radius test always fails horizontally; instead project 12 disc-rim
    // points into a screen polygon and take the first candidate OUTSIDE it with a
    // margin — falling back to the best-scoring candidate when the galaxy fills
    // the whole view.
    var rim = [], TAU2 = 6.28318530718;
    for (var ri = 0; ri < 12; ri++) {
      var rp = new THREE.Vector3(Math.cos(ri * TAU2 / 12) * 430, 0, Math.sin(ri * TAU2 / 12) * 430).project(camera);
      rim.push([rp.x, rp.y]);
    }
    function insideRim(px2, py2) { // crossing-number point-in-polygon
      var inside = false;
      for (var a = 0, b2 = 11; a < 12; b2 = a++) {
        var A = rim[a], B = rim[b2];
        if ((A[1] > py2) !== (B[1] > py2) && px2 < (B[0] - A[0]) * (py2 - A[1]) / (B[1] - A[1]) + A[0]) inside = !inside;
      }
      return inside;
    }
    function rimDist(px2, py2) { var m = 99; for (var a = 0; a < 12; a++) { var ddx = px2 - rim[a][0], ddy = py2 - rim[a][1], dd = Math.sqrt(ddx * ddx + ddy * ddy); if (dd < m) m = dd; } return m; }
    var requestedNdc = options && Array.isArray(options.ndc) ? options.ndc : null;
    var best = requestedNdc ? [requestedNdc[0], requestedNdc[1]] : [0.8, 0.8], bestScore = -1e9;
    if (!requestedNdc) {
      for (var ci = 0; ci < 16; ci++) {
        var nx = Math.random() * 1.8 - 0.9, ny = Math.random() * 1.85 - 0.9;
        var score = (insideRim(nx, ny) ? -100 : 0) + rimDist(nx, ny);
        if (score > bestScore) { bestScore = score; best = [nx, ny]; }
        if (score > 0.35) { best = [nx, ny]; break; }
      }
    }
    var p = skyPointInView(best[0], best[1], 850 + Math.random() * 300);
    var coreMat = new THREE.SpriteMaterial({ map: NOVA_CORE_TEX, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    var ball = new THREE.Sprite(coreMat); ball.scale.setScalar(1);
    var haloMat = new THREE.SpriteMaterial({ map: NOVA_HALO_TEX, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    var halo = new THREE.Sprite(haloMat); halo.scale.setScalar(1);
    var cm = new THREE.SpriteMaterial({ map: CROSS_TEX, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    var cross = new THREE.Sprite(cm); cross.scale.setScalar(1);
    var grp = new THREE.Group(); grp.add(halo); grp.add(ball); grp.add(cross); grp.position.copy(p); scene.add(grp);
    fxList.push({ kind: 'nova', obj: grp, mat: coreMat, mat2: cm, mat3: haloMat, ball: ball, halo: halo, cross: cross, t0: videoNow(), dur: durationMs });
  }
  function updateFx(nowMs) {
    if (!videoMode && nowMs >= meteorNext) {
      if (Math.random() < 0.06) { // occasional meteor SHOWER: 6–9 staggered from one on-screen radiant
        var mN = 6 + ((Math.random() * 4) | 0), rNdc = [Math.random() * 1.2 - 0.6, Math.random() * 0.8 - 0.1];
        var rDndc = [(Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.3), -(0.35 + Math.random() * 0.3)];
        for (var mi = 0; mi < mN; mi++) spawnMeteor([rNdc[0] + (Math.random() - 0.5) * 0.5, rNdc[1] + (Math.random() - 0.5) * 0.35], nowMs + mi * 320 + Math.random() * 240, rDndc);
      } else spawnMeteor();
      meteorNext = nowMs + 30000 + Math.random() * 30000;
    }
    if (!videoMode && nowMs >= novaNext) { spawnNova(); novaNext = nowMs + 360000 + Math.random() * 360000; }
    for (var i = fxList.length - 1; i >= 0; i--) {
      var f = fxList[i], k = (nowMs - f.t0) / f.dur;
      if (k >= 1) { (f.obj.parent || fxGroup).remove(f.obj); f.mat.dispose(); if (f.mat2) f.mat2.dispose(); if (f.mat3) f.mat3.dispose(); if (f.geo) f.geo.dispose(); fxList.splice(i, 1); continue; }
      if (k < 0) continue; // scheduled in the future (meteor-shower stagger) — stay dormant
      if (f.kind === 'flash') { var e = 1 - Math.pow(1 - k, 3); f.obj.scale.setScalar(0.1 + f.maxScale * e); f.mat.opacity = 0.9 * (1 - k); }
      else if (f.kind === 'burst') {
        var pa = f.geo.attributes.position.array, e2 = 1 - Math.pow(1 - k, 2);
        for (var j = 0; j < f.vel.length; j++) { pa[j * 3] = f.vel[j].x * e2; pa[j * 3 + 1] = f.vel[j].y * e2 - f.droop * e2 * e2; pa[j * 3 + 2] = f.vel[j].z * e2; }
        f.geo.attributes.position.needsUpdate = true; f.mat.opacity = 0.95 * (1 - k);
      } else if (f.kind === 'nova') {
        // PHYSICS-CORRECTED (researched against SN light curves + optical-artifact
        // behaviour): a supernova is a POINT SOURCE whose brightness rises as ~t^2.3,
        // holds a rounded peak, then declines on two slopes (steep post-peak segment,
        // then a much shallower Co-56-style tail). The halo (PSF wings) and the
        // spike/bleed pillar are INSTRUMENT ARTIFACTS that strictly track brightness
        // above thresholds — they extend in lockstep with the rise, are longest
        // exactly at peak, and RETRACT on the fade (pillar first, then halo, then the
        // core dims out). No dark beat (rises are monotonic), no expanding ball
        // (extragalactic SNe never resolve — the growing disc was the Hollywood
        // 'Praxis effect'). Colour: pale blue-white → white at peak → orange → rose.
        // Single SMOOTH light-curve envelope (gamma shape): b = C·k^2.3·e^(−k/θ) —
        // the t^2.3 accelerating rise, a rounded peak at k≈0.30 and the long
        // exponential tail all in ONE infinitely-smooth curve (the piecewise version
        // had derivative corners + a frozen plateau that read as stiff). Rebased so
        // b lands exactly on 0 at k=1 — no pop-off at removal.
        var braw = 159 * Math.pow(Math.max(k, 1e-4), 2.3) * Math.exp(-k / 0.1304);
        var b = Math.max(0, Math.min(1, (braw - 0.0741) / 0.9259));
        var blueMix = smooth01(k / 0.28);                 // pale blue-white early → white at maximum
        var warm1 = smooth01((k - 0.32) / 0.3);           // white → orange on the decline
        var warm2 = smooth01((k - 0.6) / 0.35);           // orange → rose on the tail
        novaTmp.setHex(0xbfd8ff).lerp(novaWhite, blueMix).lerp(NOVA_ORANGE, warm1).lerp(NOVA_C, warm2);
        f.mat.opacity = Math.min(1, 1.15 * b);                                   // core: the point itself
        f.ball.scale.setScalar(5 * (1 + 0.2 * smooth01((b - 0.7) / 0.3)));       // blooms ≤20% — never a ball
        f.mat.color.copy(novaTmp);
        f.mat3.opacity = smooth01((b - 0.35) / 0.25) * b;                        // halo: PSF wings, threshold-gated
        f.halo.scale.setScalar(2 + 30 * Math.pow(Math.min(1, b), 0.55));         // grows with brightness, SHRINKS on the fade
        f.mat3.color.copy(novaTmp);
        if (k < 0.32) { // expansion: the cross grows in with the late rise, biggest at peak
          f.mat2.opacity = smooth01((b - 0.55) / 0.2);
          f.cross.scale.setScalar(10 + 65 * Math.pow(smooth01((b - 0.55) / 0.45), 1.4));
        } else { // extinction: the WHOLE cross slowly SHRINKS and gently fades out — it
          // does not retract its arms (operator: 缩小+渐渐消失, not 缩回来)
          var die = smooth01((k - 0.32) / 0.55);
          f.mat2.opacity = Math.min(1, 1.2 * (1 - die));
          f.cross.scale.setScalar(75 * (1 - 0.87 * die));
        }
      } else { // meteor: the head advances and the tail occupies the head's WAKE — a
        // deposited trail, like the real thing. (A rigidly sliding capsule, where the
        // tail travels at head speed, read as 'flying backwards'.)
        var kh = Math.min(1, k), kt2 = Math.max(0, kh - 0.38); // tail end lags 38% of the flight behind
        var hx = f.from.x + f.dir.x * f.dist * kh, hy = f.from.y + f.dir.y * f.dist * kh, hz = f.from.z + f.dir.z * f.dist * kh;
        var curLen = Math.max(f.dist * (kh - kt2), 0.001);
        f.obj.position.set(hx - f.dir.x * curLen * 0.5, hy - f.dir.y * curLen * 0.5, hz - f.dir.z * curLen * 0.5);
        f.obj.scale.x = curLen;
        f.mat.opacity = Math.pow(Math.sin(Math.min(1, k) * Math.PI), 0.8);
      }
    }
  }

  // cinema mode (F): hide all UI chrome for big screens; Esc restores
  function toggleCinema(force) {
    var on = (force != null) ? force : !document.body.classList.contains('gx-cinema');
    document.body.classList.toggle('gx-cinema', on);
    var cinemaBtn = document.getElementById('cinemabtn'); if (cinemaBtn) cinemaBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  document.getElementById('cinemabtn').addEventListener('click', function (e) { e.stopPropagation(); toggleCinema(); });
  ['audio', 'cinemabtn'].forEach(function (id) { // a pointer click must not leave focus behind (it would pin the track list open, or ring the button on the next key press)
    document.getElementById(id).addEventListener('click', function (e) { if (e.detail && this.contains(document.activeElement)) document.activeElement.blur(); }, true);
  });

  // ── deep-field background (Hubble-deep-field feel): dozens of TINY distant
  // galaxies of varied morphology, hue, size and orientation, mildly clustered
  // like real galaxy groups. One procedural 1024² ATLAS (8×8 stamps: ellipticals,
  // face-on spirals, edge-on disks, irregular smudges in muted colours) + ONE
  // quad-batch mesh with size/rotation/fade baked into the vertices — a single
  // draw call, zero per-frame cost. Built once at load.
  (function deepField() {
    var CELLS = 8, CS = 128;
    var ac = document.createElement('canvas'); ac.width = ac.height = CELLS * CS;
    var g = ac.getContext('2d');
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function hsl(h, s, l, a) { return 'hsla(' + (h | 0) + ',' + (s | 0) + '%,' + (l | 0) + '%,' + a.toFixed(3) + ')'; }
    function paintStamp(cx, cy, force) {
      var type = (force != null) ? force : Math.random();
      g.save(); g.translate(cx, cy); g.rotate(rnd(0, 6.283));
      if (type < 0.32) { // elliptical: smooth warm blob
        var hue = Math.random() < 0.5 ? rnd(20, 45) : rnd(0, 15);
        g.scale(1, rnd(0.45, 0.95));
        var R = rnd(14, 34);
        var gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
        gr.addColorStop(0, hsl(hue, 45, 88, 0.9));
        gr.addColorStop(0.3, hsl(hue, 50, 72, 0.5));
        gr.addColorStop(0.7, hsl(hue, 55, 60, 0.16));
        gr.addColorStop(1, hsl(hue, 55, 55, 0));
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, 6.283); g.fill();
      } else if (type < 0.62) { // face-on spiral: core glow + 2-3 dotted arms
        var hue2 = Math.random() < 0.6 ? rnd(200, 230) : rnd(30, 55);
        g.scale(1, rnd(0.55, 1));
        var core = rnd(5, 9);
        var gr2 = g.createRadialGradient(0, 0, 0, 0, 0, core * 2.2);
        gr2.addColorStop(0, hsl(40, 40, 92, 0.95)); gr2.addColorStop(1, hsl(40, 40, 80, 0));
        g.fillStyle = gr2; g.beginPath(); g.arc(0, 0, core * 2.2, 0, 6.283); g.fill();
        var arms = Math.random() < 0.7 ? 2 : 3, tight = rnd(3, 4.6), maxR = rnd(26, 44);
        for (var ai = 0; ai < arms; ai++) {
          for (var s = 0; s < 46; s++) {
            var tt2 = s / 46, ang = ai * 6.283 / arms + tt2 * tight, rr = core + tt2 * (maxR - core);
            g.fillStyle = hsl(hue2, 45, 78, 0.34 * (1 - tt2));
            g.beginPath(); g.arc(Math.cos(ang) * rr, Math.sin(ang) * rr, 1 + 2.6 * (1 - tt2), 0, 6.283); g.fill();
          }
        }
      } else if (type < 0.82) { // edge-on disk: thin streak + small bulge
        var hue3 = rnd(25, 50), len = rnd(24, 46);
        var gr3 = g.createLinearGradient(-len, 0, len, 0);
        gr3.addColorStop(0, hsl(hue3, 40, 75, 0)); gr3.addColorStop(0.5, hsl(hue3, 40, 82, 0.7)); gr3.addColorStop(1, hsl(hue3, 40, 75, 0));
        g.save(); g.scale(1, rnd(0.09, 0.16)); g.fillStyle = gr3; g.beginPath(); g.arc(0, 0, len, 0, 6.283); g.fill(); g.restore();
        var gb = g.createRadialGradient(0, 0, 0, 0, 0, len * 0.22);
        gb.addColorStop(0, hsl(hue3, 45, 90, 0.85)); gb.addColorStop(1, hsl(hue3, 45, 80, 0));
        g.save(); g.scale(1, 0.5); g.fillStyle = gb; g.beginPath(); g.arc(0, 0, len * 0.22, 0, 6.283); g.fill(); g.restore();
      } else { // tiny irregular / distant red-or-blue smudge
        var hue4 = Math.random() < 0.5 ? rnd(0, 20) : rnd(190, 230), n2 = 2 + (Math.random() * 3 | 0);
        for (var bi = 0; bi < n2; bi++) {
          var bx2 = rnd(-8, 8), by2 = rnd(-6, 6), br2 = rnd(3, 9);
          var g4 = g.createRadialGradient(bx2, by2, 0, bx2, by2, br2);
          g4.addColorStop(0, hsl(hue4, 50, 78, 0.55)); g4.addColorStop(1, hsl(hue4, 50, 70, 0));
          g.fillStyle = g4; g.beginPath(); g.arc(bx2, by2, br2, 0, 6.283); g.fill();
        }
      }
      g.restore();
    }
    function paintDetailedSpiral(cx, cy) { // high-detail stamp for the closer mid-layer
      g.save(); g.translate(cx, cy); g.rotate(rnd(0, 6.283));
      var hue = Math.random() < 0.6 ? rnd(205, 228) : rnd(32, 52);
      g.scale(1, rnd(0.5, 1));
      var haze = g.createRadialGradient(0, 0, 0, 0, 0, 46); // faint disc haze under the arms
      haze.addColorStop(0, hsl(hue, 30, 70, 0.22)); haze.addColorStop(1, hsl(hue, 30, 60, 0));
      g.fillStyle = haze; g.beginPath(); g.arc(0, 0, 46, 0, 6.283); g.fill();
      var core = rnd(5, 8);
      var gc = g.createRadialGradient(0, 0, 0, 0, 0, core * 2.6);
      gc.addColorStop(0, hsl(42, 55, 95, 1)); gc.addColorStop(0.4, hsl(40, 45, 85, 0.55)); gc.addColorStop(1, hsl(40, 45, 80, 0));
      g.fillStyle = gc; g.beginPath(); g.arc(0, 0, core * 2.6, 0, 6.283); g.fill();
      var tight = rnd(3.2, 4.4), maxR = rnd(38, 50);
      for (var ai = 0; ai < 2; ai++) {
        for (var s = 0; s < 90; s++) {
          var tt = s / 90, ang = ai * 3.1416 + tt * tight, rr = core + tt * (maxR - core);
          var axx = Math.cos(ang) * rr, ayy = Math.sin(ang) * rr;
          g.fillStyle = hsl(hue, 50, 80, 0.3 * (1 - tt));
          g.beginPath(); g.arc(axx, ayy, 1 + 3 * (1 - tt), 0, 6.283); g.fill();
          if (Math.random() < 0.3) { // resolved star speckles along the arms
            g.fillStyle = hsl(hue, 30, 92, rnd(0.35, 0.8) * (1 - tt * 0.6));
            g.fillRect(axx + rnd(-3, 3), ayy + rnd(-3, 3), 1, 1);
          }
        }
      }
      g.restore();
    }
    for (var cy2 = 0; cy2 < CELLS; cy2++) for (var cx2 = 0; cx2 < CELLS; cx2++) {
      var ci2 = cy2 * CELLS + cx2, sx2 = cx2 * CS + CS / 2, sy2 = cy2 * CS + CS / 2;
      if (ci2 < 6) paintDetailedSpiral(sx2, sy2);   // cells 0-5: mid-layer showpieces
      else if (ci2 < 16) paintStamp(sx2, sy2, 0.1); // cells 6-15: ellipticals (cluster stock)
      else paintStamp(sx2, sy2);                    // the rest: random mix
    }
    var atlas = new THREE.CanvasTexture(ac);
    function sph(th, ph, r) { return [r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)]; }
    var items = [], clusters = [];
    for (var cc = 0; cc < 3; cc++) clusters.push([rnd(0, 6.283), Math.acos(2 * Math.random() - 1)]);
    for (var gi2 = 0; gi2 < 110; gi2++) { // FAR layer: barely-resolved smudges, mildly grouped
      var th4, ph4;
      if (gi2 % 5 < 2) { var cl = clusters[gi2 % 3]; th4 = cl[0] + rnd(-0.16, 0.16); ph4 = cl[1] + rnd(-0.14, 0.14); }
      else { th4 = rnd(0, 6.283); ph4 = Math.acos(2 * Math.random() - 1); }
      items.push({ p: sph(th4, ph4, rnd(1250, 1650)), size: gi2 < 2 ? rnd(60, 78) : 8 + Math.pow(Math.random(), 2.2) * 46,
        rot: rnd(0, 6.283), cell: (Math.random() * 64) | 0, fade: rnd(0.3, 0.75) });
    }
    for (var mi2 = 0; mi2 < 26; mi2++) { // MID layer: closer, larger, resolvable — prefers the detailed stamps
      items.push({ p: sph(rnd(0, 6.283), Math.acos(2 * Math.random() - 1), rnd(950, 1200)), size: rnd(30, 70),
        rot: rnd(0, 6.283), cell: Math.random() < 0.6 ? (Math.random() * 6) | 0 : (Math.random() * 64) | 0, fade: rnd(0.4, 0.8) });
    }
    // RICH CLUSTER: dozens of ellipticals crowded into one patch of sky (3 giant cD
    // galaxies at the core), like the group in the operator's deep-field reference
    var clTh = rnd(0, 6.283), clPh = Math.acos(2 * Math.random() - 1);
    for (var ki2 = 0; ki2 < 36; ki2++) {
      var tight2 = ki2 < 3 ? 0.018 : 0.085;
      items.push({ p: sph(clTh + rnd(-tight2, tight2) * 2, clPh + rnd(-tight2, tight2) * 1.7, rnd(1300, 1550)),
        size: ki2 < 3 ? rnd(20, 30) : rnd(6, 18), rot: rnd(0, 6.283), cell: 6 + ((Math.random() * 10) | 0), fade: rnd(0.35, 0.7) });
    }
    scene.add(billboardBatch(atlas, items, 8)); // the fixed deep sky — still ONE draw call
    var icl = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xfff0dc, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending }));
    var iclP = sph(clTh, clPh, 1600); icl.position.set(iclP[0], iclP[1], iclP[2]); icl.scale.set(280, 280, 1);
    scene.add(icl); // faint intracluster glow behind the members
  })();

  // shared billboard quad-batch builder — one mesh, one draw call for N textured quads
  // (size / rotation / fade baked per-vertex; used by the deep field and the nebulae)
  function billboardBatch(atlas, items, cellsPerRow) {
    var N = items.length;
    var pos = new Float32Array(N * 4 * 3), corner = new Float32Array(N * 4 * 2), quv = new Float32Array(N * 4 * 2), tintA = new Float32Array(N * 4 * 3), idx = [];
    for (var i = 0; i < N; i++) {
      var it = items[i], cr = Math.cos(it.rot), sr = Math.sin(it.rot);
      var cu = (it.cell % cellsPerRow) / cellsPerRow, cv = Math.floor(it.cell / cellsPerRow) / cellsPerRow;
      for (var vi = 0; vi < 4; vi++) {
        var ox = (vi === 1 || vi === 2) ? 0.5 : -0.5, oy = (vi >= 2) ? 0.5 : -0.5;
        var o3 = (i * 4 + vi) * 3, o2 = (i * 4 + vi) * 2;
        pos[o3] = it.p[0]; pos[o3 + 1] = it.p[1]; pos[o3 + 2] = it.p[2];
        corner[o2] = (ox * cr - oy * sr) * it.size; corner[o2 + 1] = (ox * sr + oy * cr) * it.size;
        quv[o2] = cu + (ox + 0.5) / cellsPerRow; quv[o2 + 1] = cv + (oy + 0.5) / cellsPerRow;
        tintA[o3] = it.fade; tintA[o3 + 1] = it.fade; tintA[o3 + 2] = it.fade;
      }
      var b4 = i * 4; idx.push(b4, b4 + 1, b4 + 2, b4, b4 + 2, b4 + 3);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    geo.setAttribute('aUv', new THREE.BufferAttribute(quv, 2));
    geo.setAttribute('aTint', new THREE.BufferAttribute(tintA, 3));
    geo.setIndex(idx);
    var mat = new THREE.ShaderMaterial({
      uniforms: { uAtlas: { value: atlas } },
      vertexShader: 'attribute vec2 aCorner; attribute vec2 aUv; attribute vec3 aTint; varying vec2 vUv; varying vec3 vTint;' +
        'void main(){ vec3 cr2 = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);' +
        ' vec3 cu2 = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);' + // camera right/up → billboard
        ' vec3 p = position + cr2 * aCorner.x + cu2 * aCorner.y;' +
        ' gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); vUv = aUv; vTint = aTint; }',
      fragmentShader: 'uniform sampler2D uAtlas; varying vec2 vUv; varying vec3 vTint;' +
        'void main(){ vec4 t = texture2D(uAtlas, vUv); if (t.a < 0.01) discard; gl_FragColor = vec4(t.rgb * vTint, t.a); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    var mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
    return mesh;
  }

  var galaxyLODs = []; // {pts, mat, center, maxN, refDist, baseSize, q0, axis, spin} per particle galaxy — LOD + self-rotation each frame
  var galaxyVeils = []; // dreamy pastel gas veils (Magellanic Clouds) — slow desynced opacity breathing, updated in the frame loop
  var galaxyVols = []; // raymarched volumes (Centaurus A's dust lane), updated in the frame loop
  var VEIL_TEX_LOADER = new THREE.TextureLoader(); // for real-photo plates (ESO/NOIRLab imagery, credited in THIRD-PARTY-NOTICES)
  var galSpinTmp = new THREE.Quaternion();
  (function galaxies() {
    // Each external-galaxy beacon carries a `stars` descriptor and is built as a real 3D
    // particle galaxy (spiral / ellipsoid / irregular), oriented in 3D on the far sky with
    // a bulge glow — real depth + resolved stars, with per-galaxy LOD by camera distance.

    function buildDustLaneVol(P, q0, R, v) { // volumetric ABSORPTION lane — a thin turbulent dust slab raymarched for optical depth.
      // Multiply blending: transmission exp(-tau·k) with wavelength-biased k → edges redden to warm brown, exactly like real dust.
      var frag =
        'uniform vec3 uCenter; uniform float uR; uniform float uGain; uniform float uTime; uniform mat3 uBasis; uniform float uSteps; varying vec3 vWorld;' +
        'float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }' +
        'float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);' +
        ' float a = h3(i), b = h3(i + vec3(1,0,0)), c = h3(i + vec3(0,1,0)), d = h3(i + vec3(1,1,0));' +
        ' float e = h3(i + vec3(0,0,1)), g = h3(i + vec3(1,0,1)), h = h3(i + vec3(0,1,1)), k = h3(i + vec3(1,1,1));' +
        ' return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y), mix(mix(e,g,f.x), mix(h,k,f.x), f.y), f.z); }' +
        'float fbm3(vec3 p){ float s = 0.0, a = 0.55, q = 1.0; for (int o = 0; o < 3; o++){ s += a * vn3(p * q); a *= 0.5; q *= 2.15; } return s; }' +
        'void main(){' +
        ' vec3 rd = normalize(vWorld - cameraPosition); vec3 oc = cameraPosition - uCenter;' +
        ' float RR = uR * 1.35; float b = dot(oc, rd); float c = dot(oc, oc) - RR * RR; float hh = b * b - c;' +
        ' if (hh < 0.0) discard; float sh = sqrt(hh); float t0 = max(-b - sh, 0.0), t1 = -b + sh; if (t1 <= t0) discard;' +
        ' float dj = h3(vec3(gl_FragCoord.xy * 0.37, 3.1)); float seg = (t1 - t0) / uSteps; float tau = 0.0;' +
        ' for (int i = 0; i < 18; i++){ if (float(i) >= uSteps) break;' +
        '  vec3 p = cameraPosition + rd * (t0 + seg * (float(i) + dj));' +
        '  vec3 q = uBasis * (p - uCenter) / uR;' +
        '  float bz = q.z - 0.10 * sin(q.x * 3.1);' +                       // the lane's S-warp
        '  float slab = smoothstep(0.26, 0.07, abs(bz)) * smoothstep(0.13, 0.03, abs(q.y)) * smoothstep(1.25, 0.7, length(vec2(q.x, bz * 1.6)));' +
        '  if (slab < 0.004) continue;' +
        '  vec3 w = q * vec3(2.0, 5.5, 4.0) + uTime * vec3(0.008, 0.004, 0.006);' +
        '  float n = fbm3(w + 1.6 * vec3(fbm3(w * 0.9 + 4.1), fbm3(w * 0.9 - 2.3), fbm3(w * 0.9 + 7.9)));' +
        '  tau += slab * max(0.0, n - 0.33) * 2.6 * seg;' +                 // torn, clumpy optical depth
        ' }' +
        ' if (tau < 0.004) discard;' +
        ' vec3 T = exp(-tau * uGain * vec3(1.35, 1.95, 2.55) / uR);' +      // blue absorbed most → warm brown rims (interstellar reddening)
        ' gl_FragColor = vec4(T, 1.0); }';
      var basis = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q0.clone().invert()));
      var vmat = new THREE.ShaderMaterial({
        uniforms: { uCenter: { value: P.clone() }, uR: { value: R }, uGain: { value: (v.gain || 1.0) * 13.0 }, uTime: { value: 0 }, uBasis: { value: basis }, uSteps: { value: 18 } },
        vertexShader: 'varying vec3 vWorld; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }',
        fragmentShader: frag, transparent: true, depthWrite: false, depthTest: false, blending: THREE.MultiplyBlending
      });
      var vmesh = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.8, R * 2.8), vmat);
      vmesh.position.copy(P); vmesh.renderOrder = 7; scene.add(vmesh); // multiplies AFTER the galaxy's additive layers
      galaxyVols.push({ mesh: vmesh, mat: vmat, steps: 18 }); // same per-frame care: face camera, slow churn, watchdog gate
    }
    // ── painted external galaxies ──
    // The Milky Way's oil-paint idea (noise smeared along a flow field = brush strands), one shared bake program
    // for all seven. Each galaxy brings its own shape and a palette sampled from telescope images, so none is a
    // recoloured Milky Way. kind 0 = spiral disc, 1 = spheroid (drawn on a camera-facing impostor), 2 = photo plate.
    // uBody per kind — 0: [old-disc scale, old weight, arm weight, inter-arm floor]; 1: [core radius, slope, -, stroke contrast];
    // 2: [plate sky level, stroke contrast]. Positions are in the galaxy's local units; p is the Milky Way bake frame (R = 360).
    var EXT_PAINT_FRAG =
      'varying vec2 vP;' +
      'uniform float uScale; uniform float uKind; uniform vec2 uSeed; uniform float uDetail; uniform float uBright;' +
      'uniform vec4 uArm; uniform vec4 uRim; uniform vec4 uBody; uniform vec4 uRing; uniform vec4 uLane; uniform vec4 uCore; uniform vec4 uTint;' +
      'uniform vec3 uPal[6]; uniform float uStop[6]; uniform vec3 uYoung; uniform vec3 uHiiCol; uniform vec4 uHii;' +
      'uniform vec4 uAnchor[4]; uniform vec3 uAnchorCol[4]; uniform sampler2D uGuideLo; uniform sampler2D uGuideMid; uniform vec4 uPlateP;' +
      'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }' +
      'float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }' +
      'float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int k = 0; k < 5; k++){ v += a * noise(p); p = p * 2.03 + 1.7; a *= 0.5; } return v; }' +
      'vec2 plateUv(vec2 l){ return vec2(l.x / uPlateP.x + 0.5, 0.5 - l.y / uPlateP.x); }' + // plate rows run top-down; the guide textures are flipped
      'float plum(vec2 l){ return dot(texture2D(uGuideLo, plateUv(l)).rgb, vec3(0.3, 0.5, 0.2)); }' +
      'vec2 flowDir(vec2 p){ float r = max(length(p), 2.0); vec2 er = p / r; vec2 et = vec2(-er.y, er.x); vec2 d = et;' +
      '  if (uKind < 0.5) d = normalize(er + et * r * uArm.y * 6.28318 / 360.0);' + // spiral: the same winding as the star arms
      '  else if (uKind > 1.5) { vec2 l = p / uScale; float h = uPlateP.x * 0.04; vec2 g = vec2(plum(l + vec2(h, 0.0)) - plum(l - vec2(h, 0.0)), plum(l + vec2(0.0, h)) - plum(l - vec2(0.0, h)));' +
      '    if (dot(g, g) > 1e-7) d = normalize(vec2(-g.y, g.x)); }' + // photo: strokes follow the plate's brightness contours
      '  float sw = (fbm(p * 0.012 + 3.0 + uSeed) - 0.5) * uArm.w; float cs = cos(sw), sn = sin(sw); return vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs); }' +
      'float lic(vec2 p, float freq, float len){ float s = 0.0, w = 0.0; vec2 q = p; vec2 o = vec2(13.1, 7.7) + uSeed;' +
      '  for (int i = 0; i < 14; i++){ float t = float(i) / 14.0; float wt = 1.0 - t; s += noise(q * freq + o) * wt; w += wt; q += flowDir(q) * (len / 14.0); }' +
      '  q = p; for (int i = 0; i < 14; i++){ q -= flowDir(q) * (len / 14.0); float t = float(i + 1) / 14.0; float wt = 1.0 - t; s += noise(q * freq + o) * wt; w += wt; }' +
      '  return s / w; }' +
      'void main(){' +
      '  vec2 p = vP * uScale; float r = length(p), nr = r / 360.0, ang = atan(p.y, p.x);' +
      '  float edgeN = fbm(p * 0.008 + 21.0 + uSeed), env = smoothstep(uRim.x, uRim.y, nr + (edgeN - 0.5) * uRim.z);' +
      '  vec3 pl = vec3(0.0); float G = 0.0;' +
      '  if (uKind > 1.5) { pl = texture2D(uGuideMid, plateUv(vP)).rgb; env = smoothstep(uRim.x, uRim.y, plum(vP) + (edgeN - 0.5) * uRim.z);' + // photo: the rim follows the plate itself
      '    G = pow(clamp((dot(pl, vec3(0.3, 0.5, 0.2)) - uBody.x) / (uPlateP.y - uBody.x), 0.0, 1.0), uPlateP.z); }' +
      '  float pli = dot(pl, vec3(0.3, 0.5, 0.2)) + 0.02, blue = (pl.b - pl.r) / pli, red = (pl.r - pl.g) / pli;' + // the plates are colour-graded: read their hue, not their colours
      '  if (env <= 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }' +
      '  vec2 wp = p * 0.011 + uSeed; float w1 = fbm(wp), w2 = fbm(wp + 4.3);' +
      '  float theta = ang + (w1 - 0.5) * 0.55 - nr * uArm.y * 6.28318;' +
      '  float arm = uKind < 0.5 ? pow(max(0.0, cos(uArm.x * theta) * 0.5 + 0.5), uArm.z) : 0.0;' +
      '  float lane = uKind < 0.5 ? pow(max(0.0, cos(uArm.x * (theta - uLane.z + (w2 - 0.5) * 0.16)) * 0.5 + 0.5), uLane.y) : 0.0;' +
      '  float fine = lic(p, 1.25 * uDetail, 7.0 / uDetail), coarse = lic(p, 0.22 * uDetail, 34.0 / uDetail);' +
      '  float strands = clamp((fine - 0.5) * 3.4 + 0.5, 0.0, 1.0) * 0.6 + clamp((coarse - 0.5) * 2.6 + 0.5, 0.0, 1.0) * 0.5;' +
      '  float rz = (nr - uRing.x) / uRing.y, young = arm * mix(1.0, exp(-rz * rz), uRing.z);' + // rz * rz, not pow(): pow of a negative base is undefined in GLSL
      '  float dens = uKind > 1.5 ? G * mix(1.0, 0.12 + 1.15 * strands * strands, uBody.y)' +
      '    : uKind > 0.5 ? pow(1.0 + nr * nr / (uBody.x * uBody.x), -uBody.y) * mix(1.0, 0.12 + 1.15 * strands * strands, uBody.w)' +
      '    : exp(-nr / uBody.x) * uBody.y * (0.7 + 0.3 * strands) + (uBody.w + (1.0 - uBody.w) * young) * uBody.z * (0.12 + 1.15 * strands * strands);' +
      '  dens *= env * (0.6 + 0.55 * fbm(p * 0.03 + vec2(w1, w2) * 3.0));' + // patchy
      '  float absorb = lane * smoothstep(0.12, 0.3, nr) * smoothstep(1.0, 0.75, nr) * (0.45 + 0.75 * clamp((coarse - 0.35) * 2.5, 0.0, 1.0)) * (0.55 + 0.75 * fbm(p * 0.045 + 9.0 + uSeed));' +
      '  absorb = clamp(clamp(absorb * 1.5, 0.0, 1.0) * uLane.x + uLane.w * exp(-(rz + 0.04 / uRing.y) * (rz + 0.04 / uRing.y) / 0.49) * (0.5 + 0.8 * clamp((coarse - 0.35) * 2.5, 0.0, 1.0)), 0.0, 1.0);' +
      '  dens *= 1.0 - absorb;' + // dark lanes on each arm's inner edge, plus an optional dust ring just inside the star ring (Sombrero)
      '  float t = mix(nr, 1.0 - G, uPlateP.w) + (fbm(p * 0.006 + 40.0 + uSeed) - 0.5) * uTint.w;' + // palette by radius, or by plate brightness
      '  vec3 col = uPal[0]; for (int i = 1; i < 6; i++) col = mix(col, uPal[i], smoothstep(uStop[i - 1], uStop[i], t));' +
      '  col *= mix(vec3(1.0), vec3(1.0, 0.78, 0.62), absorb);' + // lane rims redden (brown dust)
      '  float yw = uKind > 1.5 ? smoothstep(uTint.y, max(uTint.z, uTint.y + 0.01), blue) : young * strands;' +
      '  col = mix(col, uYoung, clamp(yw * uTint.x, 0.0, 1.0));' + // young blue stars: on the arms, or where the plate is blue
      '  float kn = smoothstep(0.62 - uHii.w, 0.8 - uHii.w, noise(p * 0.55 * uDetail + 31.0 + uSeed) * 0.55 + noise(p * 1.6 * uDetail + 5.0 + uSeed) * 0.45) * env * (0.4 + 0.8 * smoothstep(0.4, 0.7, fbm(p * 0.02 + 70.0 + uSeed)));' +
      '  kn *= uKind > 1.5 ? (uHii.y + (1.0 - uHii.y) * smoothstep(0.22, 0.32, red)) * smoothstep(0.05, 0.3, G) : (0.35 + 0.65 * young) * smoothstep(0.16, 0.34, nr);' +
      '  col = mix(col, uHiiCol, clamp(kn * 1.8, 0.0, 1.0) * uHii.x); dens += kn * uHii.x * uHii.z * (1.0 - absorb);' + // pink star-forming specks
      '  for (int i = 0; i < 4; i++){ vec4 A = uAnchor[i]; if (A.w > 0.0) { float d = length(vP - A.xy) / A.z;' + // named nebulae / star clouds under their markers
      '    float a = exp(-d * d) * A.w * (0.2 + 1.4 * strands * strands) * (0.6 + 0.8 * fbm(p * 0.05 + float(i) * 7.0)), hot = exp(-d * d * 6.0) * A.w;' +
      '    col = mix(col, uAnchorCol[i], clamp(a * 1.5, 0.0, 1.0)); col = mix(col, vec3(1.0, 0.92, 0.94), clamp(hot, 0.0, 0.7)); dens += a + hot * 0.6; } }' +
      '  float core = exp(-pow(nr / uCore.x, uCore.w));' +
      '  col = mix(col, uPal[0], clamp(core * 1.3, 0.0, 1.0));' +
      '  vec3 c = col * (dens * 0.62 + core * uCore.y * (1.0 - uCore.z + uCore.z * strands)) * uBright;' +
      '  gl_FragColor = vec4(sqrt(clamp(c, 0.0, 1.0)) + (hash(gl_FragCoord.xy) - 0.5) / 255.0, 1.0);' + // sqrt-encoded 8-bit: dark outskirts keep their gradations
      '}';
    var EXT_DISC_VERT = 'varying vec2 vUv; varying float vDepth; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }';
    var EXT_IMPOSTOR_VERT = // spheroid: a quad facing the camera, squashed along the projected short axis by the axis ratio this view sees
      'uniform vec3 uAxis; uniform float uQ; varying vec2 vUv; varying float vDepth;' +
      'void main(){ vec3 C = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz, V = normalize(cameraPosition - C); float ci = dot(uAxis, V);' +
      '  vec3 n = uAxis - V * ci; n = dot(n, n) > 1e-6 ? normalize(n) : normalize(cross(V, abs(V.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));' +
      '  vec3 wp = C + cross(n, V) * position.x + n * position.y * sqrt(ci * ci + uQ * uQ * (1.0 - ci * ci));' +
      '  vUv = uv; vec4 mv = viewMatrix * vec4(wp, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }';
    var EXT_DISPLAY_FRAG = 'uniform sampler2D uMap; uniform float uGain; uniform float uFade; uniform vec3 uNear; varying vec2 vUv; varying float vDepth;' +
      'void main(){ vec3 c = texture2D(uMap, vUv).rgb; c *= c; gl_FragColor = vec4(c * mix(uNear.z, 1.0, smoothstep(uNear.x, uNear.y, vDepth)) * uGain * uFade, 1.0); }';
    function paintGalaxy(L, sp, R, plate, plateSpan) { // bake one painting and mount it under the galaxy's stars (plate: the 256² canvas of its photo)
      var touch = paintedGalaxy.touch, size = sp.size ? (touch ? sp.size / 2 : sp.size) : (touch ? 1024 : 2048), kind = sp.kind || 0;
      var span = kind === 2 ? plateSpan : R * (sp.span || 2.5);
      function lin(h) { return new THREE.Color(h).convertSRGBToLinear(); }
      function v4(a, d) { a = a || d; return new THREE.Vector4(a[0], a[1], a[2] || 0, a[3] || 0); }
      function guide(n) { var src = plate; while (src.width > n) { var h = document.createElement('canvas'); h.width = h.height = src.width / 2; h.getContext('2d').drawImage(src, 0, 0, h.width, h.height); src = h; } // box-halve down to n²
        var t = new THREE.CanvasTexture(src); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; }
      var an = sp.anchors || [], anchors = [], anchorCols = [];
      for (var ai = 0; ai < 4; ai++) { anchors.push(an[ai] ? new THREE.Vector4(an[ai][0], an[ai][1], an[ai][2], an[ai][3]) : new THREE.Vector4()); anchorCols.push(lin(an[ai] ? an[ai][4] : 0)); }
      var pl = sp.plate || [1, 1, 0];
      var u = {
        uScale: { value: 360 / R }, uKind: { value: kind }, uSeed: { value: new THREE.Vector2(sp.seed || 0, (sp.seed || 0) * 0.37) },
        uDetail: { value: sp.detail || 0.6 }, uBright: { value: sp.bright || 1 },
        uArm: { value: v4(sp.arm, [2, 1, 2, 0.8]) }, uRim: { value: v4(sp.rim, [1.12, 0.62, 0.22]) }, uBody: { value: v4(sp.body, [0.3, 0, 1, 0.3]) },
        uRing: { value: v4(sp.ring, [0.5, 0.2, 0]) }, uLane: { value: v4(sp.lane, [0, 7, 0.12]) }, uCore: { value: v4(sp.core, [0.15, 0, 0.5, 1.4]) },
        uTint: { value: v4(sp.tint, [0, 0.12, 0.25, 0.12]) },
        uPal: { value: sp.pal.map(function (s) { return lin(s[1]); }) }, uStop: { value: sp.pal.map(function (s) { return s[0]; }) },
        uYoung: { value: lin(sp.young || 0xdbe4ff) }, uHiiCol: { value: lin(sp.hiiCol || 0xe85a72) }, uHii: { value: v4(sp.hii, [0, 0, 1, 0]) },
        uAnchor: { value: anchors }, uAnchorCol: { value: anchorCols },
        uGuideLo: { value: plate ? guide(32) : null }, uGuideMid: { value: plate ? guide(64) : null },
        uPlateP: { value: new THREE.Vector4(span, pl[0], pl[1], pl[2]) } // span, brightness norm, gamma, palette-by-brightness
      };
      var rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: false, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true });
      rt.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      var geo = new THREE.PlaneGeometry(span, span, 1, 1), bakeScene = new THREE.Scene();
      bakeScene.add(new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: u, fragmentShader: EXT_PAINT_FRAG, blending: THREE.NoBlending, depthWrite: false,
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }' })));
      var bakeCam = new THREE.OrthographicCamera(-span / 2, span / 2, span / 2, -span / 2, 0.1, 10); bakeCam.position.z = 1; bakeCam.lookAt(0, 0, 0);
      var near = sp.near || [0.35, 1.5, 0.12], mapU = { value: null };
      var mat = new THREE.ShaderMaterial({
        uniforms: { uMap: mapU, uGain: { value: sp.gain || 1 }, uFade: { value: 0 }, uNear: { value: new THREE.Vector3(near[0] * R, near[1] * R, near[2]) }, uAxis: { value: L.axis }, uQ: { value: sp.q || 1 } },
        vertexShader: kind === 1 ? EXT_IMPOSTOR_VERT : EXT_DISC_VERT, fragmentShader: EXT_DISPLAY_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
      });
      var mesh = new THREE.Mesh(geo, mat); mesh.visible = false; // shown once baked, then fades in
      if (kind === 1) mesh.frustumCulled = false; else mesh.rotation.x = Math.PI / 2; // plane (x, y) → the galaxy's (x, z), the frame of its stars
      L.pts.add(mesh);
      var P = { mesh: mesh, mat: mat, size: size, born: null };
      (L.paint = L.paint || []).push(P);
      var job = { rt: rt, scene: bakeScene, cam: bakeCam, grid: size / (touch ? 256 : 512), next: 0,
        done: function () { mapU.value = rt.texture; mesh.visible = true; if (P.born === null) P.born = -1; } };
      paintSchedule(job);
      cv.addEventListener('webglcontextrestored', function () { job.next = 0; mesh.visible = false; P.born = null; if (paintQueue.indexOf(job) < 0) paintSchedule(job); }); // a restored context brings the target back empty: re-bake tile by tile and fade in again
    }
    function buildGalaxyStars(P, o) {
      var TAU = 6.28318530718, N = Math.max(600, (o.count || 12000) | 0); // full LOD count; per-frame drawRange trims by distance
      var R = o.radius || 120, kind = o.kind || 'spiral';
      var mix = new THREE.Color();
      var pos = new Float32Array(N * 3), scl = new Float32Array(N), colA = new Float32Array(N * 3);
      function grand() { return Math.random() + Math.random() + Math.random() - 1.5; }
      var i;
      if (kind === 'ellipsoid') {                 // giant elliptical: old-star ellipsoid, concentrated core (+ optional dust lane)
        var ell = o.ell != null ? o.ell : 0.82, dustBand = o.dustBand;
        for (i = 0; i < N; i++) {
          if (dustBand && i < N * 0.055) { // young stars strung along the warped lane — the merger's starburst (pink HII + blue clusters + warm knots)
            var lx = (Math.random() * 2 - 1) * R * 0.8;
            pos[i * 3] = lx; pos[i * 3 + 1] = grand() * R * 0.05;
            pos[i * 3 + 2] = grand() * R * 0.06 + Math.sin(lx / R * 1.63) * R * 0.12; // same S-warp as the lane sheet
            var lc = Math.random();
            mix.setHex(lc < 0.5 ? 0xff6aa0 : (lc < 0.85 ? 0x9fd0ff : 0xffd9a8)).multiplyScalar(0.9);
            scl[i] = 0.8 + Math.random() * 0.9;
            colA[i * 3] = mix.r; colA[i * 3 + 1] = mix.g; colA[i * 3 + 2] = mix.b;
            continue;
          }
          var u = Math.random() * 2 - 1, ph = Math.random() * TAU, s = Math.sqrt(1 - u * u), t = Math.pow(Math.random(), 2.3);
          var px = s * Math.cos(ph) * t * R, py = u * t * R * ell, pz = s * Math.sin(ph) * t * R;
          pos[i * 3] = px; pos[i * 3 + 1] = py; pos[i * 3 + 2] = pz;
          mix.setRGB(1.0, 0.92 - 0.05 * t, 0.8 - 0.09 * t).multiplyScalar(0.5 * (0.5 + 0.5 * (1 - t))); // pale fine unresolved-star mist (photo look), not discrete gold specks
          scl[i] = 0.24 + Math.random() * 0.5;
          if (Math.random() < 0.012) { mix.setHex(0xffe4a8).multiplyScalar(0.7); scl[i] = 0.7 + Math.random() * 0.5; } // sparse dim giants
          colA[i * 3] = mix.r; colA[i * 3 + 1] = mix.g; colA[i * 3 + 2] = mix.b;
        }
      } else if (kind === 'irregular') {          // Magellanic: lopsided clumpy blobs, blue young stars + pink HII
        var NC2 = Math.max(8, Math.round(N / 220)), clus = [];
        for (var c2 = 0; c2 < NC2; c2++) clus.push({ x: grand() * R * 0.5 + (o.offx || 0.12) * R, y: grand() * R * 0.16, z: grand() * R * 0.5 + (o.offz || -0.05) * R, sz: R * 0.05 + Math.random() * Math.random() * R * 0.22 });
        for (i = 0; i < N; i++) {
          if (o.bar && Math.random() < o.bar) { // warm elongated stellar bar — the Magellanic signature feature
            var bt2 = Math.random() * 2 - 1, bAng = o.barAng || 0, bL = R * 0.52, bW = R * 0.13;
            var bx = bt2 * bL + grand() * bW, bz = grand() * bW;
            pos[i * 3] = Math.cos(bAng) * bx - Math.sin(bAng) * bz + (o.offx || 0.12) * R * 0.5;
            pos[i * 3 + 1] = grand() * bW * 0.5;
            pos[i * 3 + 2] = Math.sin(bAng) * bx + Math.cos(bAng) * bz + (o.offz || -0.05) * R * 0.5;
            mix.setRGB(1.0, 0.86 - 0.1 * Math.abs(bt2), 0.66 - 0.14 * Math.abs(bt2)).multiplyScalar(0.5); // old warm stars, dimmer at the tips
            scl[i] = 0.35 + Math.random() * 0.65;
            colA[i * 3] = mix.r; colA[i * 3 + 1] = mix.g; colA[i * 3 + 2] = mix.b;
            continue;
          }
          var k2 = clus[(Math.random() * NC2) | 0];
          pos[i * 3] = k2.x + grand() * k2.sz; pos[i * 3 + 1] = k2.y + grand() * k2.sz * 0.6; pos[i * 3 + 2] = k2.z + grand() * k2.sz;
          var bl = Math.random();
          mix.setRGB(0.72 + 0.2 * bl, 0.8 + 0.12 * bl, 1.0).multiplyScalar(0.42);
          scl[i] = 0.35 + Math.random() * 0.7;
          var kn2 = Math.random();
          if (kn2 < 0.06) { mix.setHex(0xdbeaff).multiplyScalar(1.1); scl[i] = 0.9 + Math.random() * 0.8; }      // blue star-forming knots
          else if (kn2 < 0.075 && !o.small) { mix.setHex(0xff6aa0).multiplyScalar(1.0); scl[i] = 0.8 + Math.random() * 0.6; } // pink HII (Tarantula)
          else if (kn2 < 0.095) { mix.setHex(kn2 < 0.082 ? 0xffd9a8 : (kn2 < 0.089 ? 0xa8ece0 : 0xd9c4ff)).multiplyScalar(0.95); scl[i] = 1.0 + Math.random() * 0.8; } // pastel sprinkle — peach-gold / aqua / lilac sugar grains
          colA[i * 3] = mix.r; colA[i * 3 + 1] = mix.g; colA[i * 3 + 2] = mix.b;
        }
      } else {                                    // spiral: log-spiral arms + clustered star knots (like the Milky Way)
        var arms = o.arms || 2, tight = o.tight != null ? o.tight : 0.9, thick = R * 0.06, ck = o.clumpK || 1, armW = R * 0.11 * ck, jit = o.armJitter != null ? o.armJitter : 1, radPow = 0.72;
        var inside = new THREE.Color(o.inside || 0xffcf8a), outside = new THREE.Color(o.outside || 0x9fc3f2);
        function pickArm(r) { var idx = (Math.random() < 0.7) ? Math.floor(Math.random() * (arms / 2)) * 2 : Math.floor(Math.random() * (arms / 2)) * 2 + 1, maj = (idx % 2 === 0); return { maj: maj, ang: idx * (TAU / arms) + r * tight * TAU + (Math.random() - 0.5) * 0.5 * jit * (maj ? 1 : 1.25) }; }
        var NC = Math.max(12, Math.round(N / (o.clumps || 200))), clusters = []; // more, smaller clusters → finer arm lanes
        for (var c = 0; c < NC; c++) { var crf = Math.pow(Math.random(), radPow), cp = pickArm(crf), cR = crf * R + (Math.random() - 0.5) * armW;
          clusters.push({ x: Math.cos(cp.ang) * cR, z: Math.sin(cp.ang) * cR, rf: crf, maj: cp.maj, sz: (R * 0.016 + Math.random() * Math.random() * R * 0.1) * ck }); }
        for (i = 0; i < N; i++) {
          if (o.bulge && Math.random() < o.bulge) { // spheroidal old-star bulge population — the Sombrero's "crown" enveloping the thin disc
            var bu = Math.random() * 2 - 1, bph = Math.random() * TAU, bs = Math.sqrt(1 - bu * bu), bt = Math.pow(Math.random(), 2.0), bR = (o.bulgeR || 0.34) * R;
            pos[i * 3] = bs * Math.cos(bph) * bt * bR; pos[i * 3 + 1] = bu * bt * bR * 0.75; pos[i * 3 + 2] = bs * Math.sin(bph) * bt * bR;
            mix.setRGB(1.0, 0.94 - 0.04 * bt, 0.84 - 0.08 * bt).multiplyScalar(0.3 * (0.5 + 0.5 * (1 - bt))); // pale + dim + tiny: unresolved-star mist (photo look), not discrete yellow specks
            scl[i] = 0.18 + Math.random() * 0.35;
            colA[i * 3] = mix.r; colA[i * 3 + 1] = mix.g; colA[i * 3 + 2] = mix.b;
            continue;
          }
          var rf, major;
          if (Math.random() < (o.smooth ? 0.55 : 0.8)) { var k = clusters[(Math.random() * NC) | 0]; rf = k.rf; major = k.maj;
            pos[i * 3] = k.x + grand() * k.sz; pos[i * 3 + 2] = k.z + grand() * k.sz; pos[i * 3 + 1] = grand() * thick * ((1 - rf) + 0.2) * 0.45; }
          else { rf = Math.pow(Math.random(), radPow); var fp = pickArm(rf), offR = rf * R + (Math.random() - 0.5) * armW; major = fp.maj;
            pos[i * 3] = Math.cos(fp.ang) * offR; pos[i * 3 + 2] = Math.sin(fp.ang) * offR; pos[i * 3 + 1] = (Math.random() - 0.5) * thick * ((1 - rf) + 0.2); }
          mix.copy(inside).lerp(outside, Math.min(1, Math.max(0, (rf - (o.warm != null ? o.warm : 0.12)) * (o.warmK || 3.0)))).multiplyScalar(0.5 * (major ? 1 : 0.72) * (1 - 0.4 * Math.min(1, Math.max(0, (rf - 0.78) * 4.5)))); // warm = where the golden inner disc gives way to blue arms
          scl[i] = (0.3 + Math.random() * 0.9) * (major ? 1 : 0.82);
          var kn = Math.random(), kf = o.smooth ? 0.25 : 1; // smooth discs (Sombrero) get far fewer bright knots
          if (o.hii && rf > 0.15 && Math.random() < o.hii) { mix.setHex(0xff6aa0).multiplyScalar(1.05); scl[i] = 0.9 + Math.random() * 0.7; } // pink HII regions sprinkled through the disc (M33)
          else if (kn < 0.004 * kf) { mix.setHex(0xffd45a).multiplyScalar(1.3); scl[i] = 1.4 + Math.random(); }
          else if (major && rf > 0.28 && kn < 0.03 * kf) { var cr = Math.random(), col = cr < 0.6 ? 0xff6a3a : (cr < 0.8 ? 0xcfe6ff : 0x6a9cff); mix.setHex(col).multiplyScalar(1.15); scl[i] = 1.1 + Math.random() * 0.8; }
          else if (major && rf > 0.28 && kn < 0.12 * kf) { mix.setHex(0xcfe6ff).multiplyScalar(1.0); scl[i] = 0.9 + Math.random() * 0.7; }
          colA[i * 3] = mix.r; colA[i * 3 + 1] = mix.g; colA[i * 3 + 2] = mix.b;
        }
      }
      if (o.starGain) for (i = 0; i < N * 3; i++) colA[i] *= o.starGain; // painted galaxies: the painting carries the light, the stars dress it
      var paints = o.paint ? [].concat(o.paint) : [];
      if (o.photo && paints.some(function (s) { return s.kind === 2; })) paintWaiting++;
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aColor', new THREE.BufferAttribute(colA, 3));
      g.setAttribute('aScale', new THREE.BufferAttribute(scl, 1));
      if (o.photo) (function (gg, NN) { // repaint the cloud from a real photograph once it loads: positions importance-sampled by brightness, colors straight from the pixels — crisp at ANY zoom, unlike a billboard
        var im = new Image();
        im.onload = function () {
          if (paints.some(function (s) { return s.kind === 2; })) paintWaiting--; // first: a throw below must not leave paintPending() stuck
          var PS = 256, pc = document.createElement('canvas'); pc.width = pc.height = PS;
          var px = pc.getContext('2d'); px.drawImage(im, 0, 0, PS, PS);
          var idata = px.getImageData(0, 0, PS, PS).data;
          var span = o.photo.span || R * 2, thick = o.photo.thick || R * 0.07;
          var pa = gg.getAttribute('position'), ca = gg.getAttribute('aColor'), sa = gg.getAttribute('aScale');
          var placed = 0, guard = 0;
          while (placed < NN && guard++ < NN * 80) {
            var u = Math.random(), v = Math.random();
            var i4 = (((v * PS) | 0) * PS + ((u * PS) | 0)) * 4;
            var lum = (idata[i4] + idata[i4 + 1] + idata[i4 + 2]) / 765;
            if (Math.random() > Math.pow(lum, 2.2) + 0.002) continue;    // steep weighting: structure wins the particles, the flat star-field mostly loses
            var j = placed * 3;
            pa.array[j] = (u - 0.5) * span; pa.array[j + 1] = grand() * thick; pa.array[j + 2] = (v - 0.5) * span;
            var bb = 0.6 + Math.random() * 0.35;
            var cr = idata[i4] / 255, cg = idata[i4 + 1] / 255, cb2 = idata[i4 + 2] / 255, cl = (cr + cg + cb2) / 3;
            var csat = Math.max(cr, cg, cb2) - Math.min(cr, cg, cb2);
            if (csat < (o.photo.palette != null ? o.photo.palette : 0.07)) { // near-colourless = star (small pin) → stellar palette
              var pst = Math.random(), st;
              if (o.photo.oldPop) st = pst < 0.35 ? [1.0, 0.94, 0.82] : (pst < 0.6 ? [1.0, 0.85, 0.55] : (pst < 0.75 ? [1.0, 0.6, 0.4] : (pst < 0.9 ? [0.85, 0.9, 1.0] : [0.65, 0.78, 1.0]))); // old elliptical population: warm white / yellow / orange-red, a few merger-born blues
              else st = pst < 0.5 ? [0.88, 0.93, 1.0] : (pst < 0.8 ? [0.6, 0.75, 1.0] : (pst < 0.9 ? [1.0, 0.87, 0.58] : [1.0, 0.5, 0.4])); // young irregular: 50% blue-white / 30% blue / 10% yellow / 10% red
              ca.array[j] = st[0] * bb; ca.array[j + 1] = st[1] * bb; ca.array[j + 2] = st[2] * bb;
              sa.array[placed] = 0.25 + Math.random() * 0.45;
            } else {
              ca.array[j] = Math.max(0, cl + (cr - cl) * 1.6) * bb; ca.array[j + 1] = Math.max(0, cl + (cg - cl) * 1.6) * bb; ca.array[j + 2] = Math.max(0, cl + (cb2 - cl) * 1.6) * bb; // saturation push — keep the photo's warm bar / pink HII / blue clusters from washing to white
              if (cr > cg && cr > cb2 && Math.random() < 0.18) { ca.array[j] = 1.0 * bb; ca.array[j + 1] = 0.42 * bb; ca.array[j + 2] = 0.36 * bb; sa.array[placed] = 0.9 + Math.random() * 0.7; } // red-leaning gas pixel → a ruby star decorating the red cloud
              else sa.array[placed] = (lum > 0.6 && Math.random() < 0.08) ? 1.5 + Math.random() : 0.5 + Math.random() * 1.0; // colourful = nebular knot (fat glow), sparse bright ones sparkle
            }
            placed++;
          }
          if (o.starGain) for (var di = 0; di < NN * 3; di++) ca.array[di] *= o.starGain;
          pa.needsUpdate = ca.needsUpdate = sa.needsUpdate = true;
          paints.forEach(function (s) { if (s.kind === 2) paintGalaxy(selfLOD, s, R, pc, span); });
        };
        im.onerror = function () { if (paints.some(function (s) { return s.kind === 2; })) paintWaiting--; }; // no plate: keep the procedural stars, unpainted
        im.src = o.photo.src;
      })(g, N);
      var gmat = new THREE.ShaderMaterial({
        uniforms: { uSize: { value: (o.pointSize || 1.9) * renderer.getPixelRatio() }, uCap: { value: 34 * renderer.getPixelRatio() } },
        vertexShader: 'uniform float uSize; uniform float uCap; attribute float aScale; attribute vec3 aColor; varying vec3 vColor;' +
          'void main(){ vec4 mp = modelMatrix * vec4(position,1.0); vec4 vp = viewMatrix * mp; gl_Position = projectionMatrix * vp;' +
          ' gl_PointSize = min(uSize * aScale * (300.0 / -vp.z), uCap); vColor = aColor; }', // cap: a close fly-by magnifies stars into crisp points, not screen-filling cotton
        fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      });
      var pts = new THREE.Points(g, gmat);
      pts.frustumCulled = false;
      // orient the disc: its normal sits `inc` radians off the viewer's line of sight, plus a roll
      var viewDir = P.clone().negate().normalize();
      var perp = new THREE.Vector3().crossVectors(viewDir, new THREE.Vector3(0, 1, 0));
      if (perp.lengthSq() < 1e-4) perp.set(1, 0, 0);
      perp.normalize();
      var nrm = viewDir.clone().applyAxisAngle(perp, o.inc != null ? o.inc : 0.9);
      var q0 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm);
      q0.premultiply(new THREE.Quaternion().setFromAxisAngle(nrm, o.roll || 0));
      pts.position.copy(P); pts.quaternion.copy(q0); scene.add(pts);
      galaxyLODs.push({ pts: pts, mat: gmat, center: P.clone(), maxN: N, refDist: R * 3, baseSize: (o.pointSize || 1.9),
        q0: q0, axis: nrm.clone(), spin: (o.spin != null ? o.spin : 0.018) }); // per-frame LOD + slow self-rotation about the disc axis
      // bulge = a bright compact nucleus + a faint extended warm halo (avoids a solid grey ball)
      function bulge(sz, op, hex) { if (!op) return; var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: BULGE_TEX, color: new THREE.Color(hex), transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending })); s.position.copy(P); s.scale.set(sz, sz, 1); scene.add(s); }
      bulge(R * (o.haloSize || 0.62), o.haloOpacity != null ? o.haloOpacity : 0.16, o.halo || 0xffcf8a); // soft outer bulge glow
      bulge(R * (o.coreSize || 0.2), o.coreOpacity != null ? o.coreOpacity : 0.9, o.core || 0xfff1dc);   // bright nucleus
      if (o.halo2Size) bulge(R * o.halo2Size, o.halo2Opacity || 0.07, o.halo2 || 0xfdf6ea); // extra faint extended envelope — stacked gaussians ≈ smooth edgeless falloff (Sombrero)
      if (o.nucleusSize) { bulge(R * o.nucleusSize * 1.9, 0.9, o.nucleus || 0xfffdf6); bulge(R * o.nucleusSize, 1.0, 0xffffff); } // a single blazing nucleus body — outshines the particle grain at the very centre
      var lodRef = galaxyLODs[galaxyLODs.length - 1];
      var selfLOD = lodRef;
      paints.forEach(function (s) { if (s.kind !== 2) paintGalaxy(lodRef, s, R); }); // photo-plate paintings wait for their plate
      if (o.veils) for (var vi = 0; vi < o.veils.length; vi++) { // dreamy pastel gas veils — large faint additive blobs; depth comes from stacking thin layers, never one dense one
        var V = o.veils[vi];
        var vmap = V.img != null ? VEIL_TEX_LOADER.load(V.img) : (V.wisp != null ? wispTexture(V.wisp) : BULGE_TEX); // real-photo plate > procedural strands > smooth glow
        var vsp = new THREE.Sprite(new THREE.SpriteMaterial({ map: vmap, color: new THREE.Color(V.hex), transparent: true, opacity: V.op, rotation: V.rot || 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        vsp.onBeforeRender = paintWispOnDraw; vsp.position.set(V.x || 0, V.y || 0, V.z || 0); vsp.scale.set(V.sz, V.sz * (V.flat || 1), 1); // flat<1 squashes the blob into a lens — reads as a disc, not a ball
        pts.add(vsp); // child of the particle cloud — co-rotates, stays glued to the bar and the in-galaxy LOD features (same frame as kid-beacon lp)
        galaxyVeils.push({ mat: vsp.material, o: V.op, T: V.T || 18, ph: vi * 2.6, r0: V.rot || 0, dr: V.drift || 0, amp: V.amp != null ? V.amp : 0.3, lod: lodRef, hn: V.hideNear ? [R * 1.4, R * 2.4] : null }); // drift: filaments crawl imperceptibly; amp: photo plates breathe gently
      }
      if (o.dustVol) buildDustLaneVol(P, q0, R, o.dustVol); // volumetric absorption lane — thickness + torn edges from any angle
      if (o.dustBand && !o.dustVol) { // flat dark lane sheet (Sombrero ring etc.) — superseded by the volumetric slab when dustVol is set
        var ringLane = o.dustBand === 'ring'; // 'ring' = Sombrero-style dust-torus rim; true = centred dark sheet (Cen A)
        var dl = document.createElement('canvas'); dl.width = dl.height = 128; var dcx = dl.getContext('2d');
        if (ringLane) {
          var rg = dcx.createRadialGradient(64, 64, 24, 64, 64, 64);          // narrow dark-brown annulus at the disc rim (the Sombrero brim, ~0.75–1.0 R); scene colours are linear, so brown this dark shows as the photo's lane
          rg.addColorStop(0, 'rgba(6,4,3,0)'); rg.addColorStop(0.3, 'rgba(6,4,3,0)'); rg.addColorStop(0.38, 'rgba(6,4,3,0.85)'); rg.addColorStop(0.56, 'rgba(6,4,3,1)'); rg.addColorStop(0.66, 'rgba(6,4,3,0.5)'); rg.addColorStop(0.75, 'rgba(6,4,3,0)');
          dcx.fillStyle = rg; dcx.fillRect(0, 0, 128, 128);
          var fade = dcx.createLinearGradient(0, 64, 0, 98);                  // keep only the NEAR half — the far rim hides behind the bulge
          fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
          dcx.globalCompositeOperation = 'destination-out'; dcx.fillStyle = fade; dcx.fillRect(0, 0, 128, 128);
          dcx.globalCompositeOperation = 'source-over';
        } else { // Cen A: ABSORPTION sheet (multiply blending) — white transmits, warm dark brown absorbs.
          // Over the bright bulge it reads as the photo's reddish-brown dust band; over black sky it stays invisible.
          var img2 = dcx.createImageData(128, 128), dd = img2.data;
          for (var qy = 0; qy < 128; qy++) for (var qx = 0; qx < 128; qx++) {
            var ddx = (qx + 0.5) / 64 - 1, ddy = ((qy + 0.5) / 64 - 1) * 2.3 + Math.sin(ddx * 2.6) * 0.30, rr2 = Math.sqrt(ddx * ddx + ddy * ddy); // wider band, S-warped like the merger wreckage
            var aa = rr2 >= 0.85 ? 0 : (rr2 < 0.45 ? (0.92 - 0.1 * (rr2 / 0.45)) : 0.8 * (1 - (rr2 - 0.45) / 0.4)); var ef = aa > 0.05 && aa < 0.5 ? Math.max(0, 0.5 - Math.abs(aa - 0.275) * 1.8) : 0; // narrow dense band → feathered rim (photo: band ≈ 1/5 of the diameter)
            var o8 = (qy * 128 + qx) * 4;
            dd[o8] = Math.min(255, Math.round(255 - aa * 211 + ef * 26)); dd[o8 + 1] = Math.min(255, Math.round(255 - aa * 229 + ef * 6)); dd[o8 + 2] = Math.round(255 - aa * 237); dd[o8 + 3] = 255; // → transmission toward rgb(44,26,18)
          }
          dcx.putImageData(img2, 0, 0);
        }
        var laneTex = new THREE.CanvasTexture(dl);
        laneTex.generateMipmaps = false; laneTex.minFilter = THREE.LinearFilter; // deep mips average band+clear into a grey sheet → a fake dark rectangle at distance
        var lane = new THREE.Mesh(new THREE.PlaneGeometry(ringLane ? R * 2.6 : R * 3.2, ringLane ? R * 2.6 : R * 1.9),
          new THREE.MeshBasicMaterial({ map: laneTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: ringLane ? THREE.NormalBlending : THREE.MultiplyBlending })); // DoubleSide: show from below too. fog:false is CRITICAL — scene fog blackens the distant quad, and multiply-by-black erased everything behind it (the "black rectangle")
        lane.quaternion.copy(q0).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)); // lie in the disc plane, aligned with the disc's long axis
        if (ringLane) { // spin the dark half-ring around the disc axis so it faces the viewer (the lane does not co-rotate, so this stays correct)
          var dN = viewDir.clone().sub(nrm.clone().multiplyScalar(viewDir.dot(nrm))).normalize();
          var w0 = new THREE.Vector3(0, 1, 0).applyQuaternion(lane.quaternion); // texture-up in world
          var beta = Math.atan2(new THREE.Vector3().crossVectors(w0, dN).dot(nrm), w0.dot(dN));
          lane.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(nrm, beta));
        }
        lane.position.copy(P); lane.renderOrder = 6; lane.frustumCulled = false; scene.add(lane);
      }
    }

    // ── in-galaxy object features: small additive point/sprite groups added under
    // a galaxy's Points (local frame) so they co-rotate; always on, LOD-gated by distance.
    function starPoints(n, spread, color, sizeMul, flatten) {
      var pos = new Float32Array(n * 3), scl = new Float32Array(n), col = new Float32Array(n * 3), c = new THREE.Color(color);
      for (var i = 0; i < n; i++) {
        var u = Math.random() * 2 - 1, ph = Math.random() * 6.283, s = Math.sqrt(1 - u * u), t = Math.pow(Math.random(), 0.6) * spread;
        pos[i * 3] = s * Math.cos(ph) * t; pos[i * 3 + 1] = u * t * (flatten || 1); pos[i * 3 + 2] = s * Math.sin(ph) * t;
        scl[i] = (0.5 + Math.random() * 1.2) * (sizeMul || 1);
        var v = 0.8 + Math.random() * 0.3; col[i * 3] = c.r * v; col[i * 3 + 1] = c.g * v; col[i * 3 + 2] = c.b * v;
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3)); g.setAttribute('aScale', new THREE.BufferAttribute(scl, 1));
      return new THREE.Points(g, new THREE.ShaderMaterial({
        uniforms: { uSize: { value: 2.4 * renderer.getPixelRatio() }, uCap: { value: 34 * renderer.getPixelRatio() } },
        vertexShader: 'uniform float uSize; uniform float uCap; attribute float aScale; attribute vec3 aColor; varying vec3 vColor; void main(){ vec4 vp = viewMatrix * modelMatrix * vec4(position,1.0); gl_Position = projectionMatrix * vp; gl_PointSize = min(uSize * aScale * (300.0/-vp.z), uCap); vColor = aColor; }',
        fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      }));
    }
    var SMOKE_TEXS = null;
    function smokeTextures() { // procedural turbulent puff textures — the mottled cloud matter of the lobes
      if (SMOKE_TEXS) return SMOKE_TEXS;
      SMOKE_TEXS = [];
      for (var k = 0; k < 3; k++) {                                        // per-pixel gaussian blobs — canvas gradients dither with RGB noise on close-up sprites
        var cv = document.createElement('canvas'); cv.width = cv.height = 128;
        var ctx = cv.getContext('2d'), blobs = [];
        for (var i = 0; i < 46; i++) {
          var a = Math.random() * 6.283, r = Math.pow(Math.random(), 1.5) * 42;
          blobs.push({ x: 64 + Math.cos(a) * r, y: 64 + Math.sin(a) * r, s: 7 + Math.random() * 19, w: 0.05 + Math.random() * 0.1 });
        }
        var im = ctx.createImageData(128, 128), dt = im.data;
        for (var py = 0; py < 128; py++) for (var px = 0; px < 128; px++) {
          var acc = 0;
          for (var b = 0; b < blobs.length; b++) {
            var bx = px + 0.5 - blobs[b].x, by = py + 0.5 - blobs[b].y, ss = blobs[b].s;
            var q = (bx * bx + by * by) / (ss * ss);
            if (q < 4) acc += blobs[b].w * Math.exp(-q * 2.0);
          }
          var rx = (px + 0.5 - 64) / 64, ry = (py + 0.5 - 64) / 64, rr = Math.sqrt(rx * rx + ry * ry);
          var msk = rr >= 1 ? 0 : (rr < 0.45 ? 1 : 1 - (rr - 0.45) / 0.55); // soft edge so sprite borders never show
          var o4 = (py * 128 + px) * 4; dt[o4] = 255; dt[o4 + 1] = 255; dt[o4 + 2] = 255; dt[o4 + 3] = Math.round(Math.min(1, acc) * msk * 255);
        }
        ctx.putImageData(im, 0, 0);
        SMOKE_TEXS.push(new THREE.CanvasTexture(cv));
      }
      return SMOKE_TEXS;
    }
    var RING_TEX = null;
    function ringTexture() { // thin luminous annulus — SN 1987A's ring
      if (RING_TEX) return RING_TEX;
      var cv = document.createElement('canvas'); cv.width = cv.height = 128;
      var ctx = cv.getContext('2d');
      var gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0)');
      gr.addColorStop(0.8, 'rgba(255,255,255,1)'); gr.addColorStop(0.9, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128);
      RING_TEX = new THREE.CanvasTexture(cv);
      return RING_TEX;
    }
    function jetLobe(dir, len, e1, e2, o) { // diffuse lobe — smoke-textured sprites strung tight on the SAME centreline as the inner jet
      var grp = new THREE.Group(), base = new THREE.Color(o.color), tipc = new THREE.Color(o.tip || o.color), parts = [], texs = smokeTextures();
      for (var i = 0; i < o.count; i++) {
        var t = 0.12 + 0.88 * (i + Math.random() * 0.5) / o.count;        // from just off the nucleus to the tip
        var w = len * (0.09 + Math.pow(t, 1.3) * o.flare);                // narrow root → moderate billow (photo proportions)
        var m = new THREE.SpriteMaterial({ map: texs[(Math.random() * texs.length) | 0], color: base.clone().lerp(tipc, t),
          rotation: Math.random() * 6.283, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
        var s = new THREE.Sprite(m);
        s.position.copy(dir).multiplyScalar(t * len)
          .addScaledVector(e1, o.curve * t * t * len + (Math.random() - 0.5) * w * 0.18) // hugs the centreline — no skew off the spine
          .addScaledVector(e2, (Math.random() - 0.5) * w * 0.18);
        s.scale.set(w * (0.9 + Math.random() * 0.4), w * (0.75 + Math.random() * 0.4), 1);
        var op = o.op * (0.6 + 0.4 * Math.random()) * (0.45 + 0.55 * Math.sin(3.1416 * Math.min(1, t * 0.9 + 0.05))); // dim root, bright mid, soft tip
        m.opacity = op; parts.push({ m: m, op: op, ph: Math.random() * 6.283, rot: m.rotation });
        grp.add(s);
      }
      grp.userData.parts = parts;
      return grp;
    }
    function jetStream(dir, len, e1, e2, o) { // narrow bright inner filament — the visible X-ray jet spine (uTime flow)
      var n = o.n, pos = new Float32Array(n * 3), aT = new Float32Array(n), aR = new Float32Array(n), aSeed = new Float32Array(n), col = new Float32Array(n * 3);
      var cA = new THREE.Color(o.from), cB = new THREE.Color(o.to), ax = new THREE.Vector3();
      function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }
      for (var i = 0; i < n; i++) {
        var t = Math.pow(Math.random(), 0.8), radius = (0.022 + t * 0.08) * len; // narrow-ish filament, softer than a hairline
        var gx = gauss(), gy = gauss(), rr = Math.sqrt(gx * gx + gy * gy);
        ax.copy(dir).multiplyScalar(t * len);
        pos[i * 3]     = ax.x + e1.x * (gx * radius + o.curve * t * t * len) + e2.x * gy * radius;
        pos[i * 3 + 1] = ax.y + e1.y * (gx * radius + o.curve * t * t * len) + e2.y * gy * radius;
        pos[i * 3 + 2] = ax.z + e1.z * (gx * radius + o.curve * t * t * len) + e2.z * gy * radius;
        aT[i] = t; aR[i] = Math.min(1.5, rr); aSeed[i] = Math.random();
        var mix = Math.min(1, t * 1.1);
        col[i * 3] = cA.r + (cB.r - cA.r) * mix; col[i * 3 + 1] = cA.g + (cB.g - cA.g) * mix; col[i * 3 + 2] = cA.b + (cB.b - cA.b) * mix;
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
      g.setAttribute('aR', new THREE.BufferAttribute(aR, 1)); g.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
      return new THREE.Points(g, new THREE.ShaderMaterial({
        uniforms: { uSize: { value: 3.2 * renderer.getPixelRatio() }, uTime: { value: 0 }, uGain: { value: o.gain } },
        vertexShader: 'uniform float uSize; uniform float uTime; uniform float uGain; attribute float aT; attribute float aR; attribute float aSeed; attribute vec3 aColor; varying vec3 vColor;' +
          'void main(){ vec4 vp = viewMatrix * modelMatrix * vec4(position,1.0); gl_Position = projectionMatrix * vp;' +
          ' float flow = 0.72 + 0.28*sin(aT*5.0 - uTime*2.0 + aSeed*6.2831);' +      // slow plasma streaming, no hard knots
          ' float lenFade = 0.25 + 0.75*pow(1.0-aT, 1.2);' +                          // bright at the nucleus, dissolves outward
          ' float radFade = exp(-aR*aR*1.3);' +
          ' gl_PointSize = uSize * (0.5 + 0.9*(1.0-aT)) * (300.0/-vp.z);' +
          ' vColor = aColor * lenFade * radFade * flow * uGain; }',
        fragmentShader: 'varying vec3 vColor; void main(){ float d = distance(gl_PointCoord, vec2(0.5)) * 2.0; float s = exp(-d*d*1.9); if (s < 0.012) discard; gl_FragColor = vec4(vColor, s); }',
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      }));
    }
    function jetPlasma(dir, len, e1, e2, o) { // flowing plasma stream — the comet ion-tail technique aimed down the jet axis
      var N = o.n || 130, particles = [], state = o.seed || 977;
      function prand() { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; }
      for (var i = 0; i < N; i++) particles.push({ frac: (i + 0.5) / N, lat1: (prand() - 0.5), lat2: (prand() - 0.5), speed: 0.6 + prand() * 0.9 });
      var positions = new Float32Array(N * 3), colors = new Float32Array(N * 3);
      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      var points = new THREE.Points(geometry, new THREE.PointsMaterial({ map: GLOW_TEX, size: len * (o.size || 0.06), vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
      points.frustumCulled = false;
      var edge = new THREE.Color(o.edge), coreColor = new THREE.Color(o.core), mixed = new THREE.Color();
      points.userData.step = function (t) {
        for (var i = 0; i < N; i++) {
          var particle = particles[i], i3 = i * 3;
          var kk = (particle.frac + t * 0.042 * particle.speed) % 1; // halved flow speed
          var spread = len * (0.008 + kk * (o.flare || 0.05)); // a tight beam: overlap is what fuses sprites into fluid
          var kink = Math.sin(kk * 6.5 - t * 1.2) * len * 0.012 * kk;
          var bend = (o.curve || 0) * len * kk * kk;
          positions[i3] = dir.x * len * kk + e1.x * (particle.lat1 * spread + kink) + e2.x * (particle.lat2 * spread + bend);
          positions[i3 + 1] = dir.y * len * kk + e1.y * (particle.lat1 * spread + kink) + e2.y * (particle.lat2 * spread + bend);
          positions[i3 + 2] = dir.z * len * kk + e1.z * (particle.lat1 * spread + kink) + e2.z * (particle.lat2 * spread + bend);
          var coreW = 1 - Math.min(1, Math.sqrt(particle.lat1 * particle.lat1 + particle.lat2 * particle.lat2) * 2.2);
          var fade = Math.pow(1 - kk, 1.2) * (0.75 + 0.25 * Math.sin(t * 2.2 + i));
          mixed.copy(edge).lerp(coreColor, coreW);
          colors[i3] = mixed.r * fade; colors[i3 + 1] = mixed.g * fade; colors[i3 + 2] = mixed.b * fade;
        }
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
      };
      return points;
    }
    function radioLobe(dirV, len, e1, e2, o) { // giant radio lobe: the plasma balloon inflated where the jet's momentum ends
      var lobeGroup = new THREE.Group(), parts = [], texs = o.wisp ? [wispTexture((o.seed || 31) * 0.13), wispTexture((o.seed || 31) * 0.13 + 7.7), wispTexture((o.seed || 31) * 0.13 + 13.1)] : smokeTextures(), base = new THREE.Color(o.color); // wisp: filamentary plasma instead of smooth smoke
      var state = o.seed || 31; function lrnd() { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; }
      var center = o.start + o.size * 0.55; // balloon center just past the beam tip
      for (var i = 0; i < 16; i++) {
        var axial = center + (lrnd() - 0.5) * o.size * 1.1;                 // elongated along the jet axis
        var reach = (axial - o.start) / o.size;                              // 0 at the neck, ~1 at the far end
        var girth = o.size * (0.28 + 0.5 * Math.min(1, Math.max(0.15, reach))); // narrow neck → fat balloon
        var m = new THREE.SpriteMaterial({ map: texs[(lrnd() * texs.length) | 0], color: base,
          rotation: lrnd() * 6.283, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
        var sp = new THREE.Sprite(m); sp.onBeforeRender = paintWispOnDraw; // no-op for smoke maps
        sp.position.copy(dirV).multiplyScalar(axial)
          .addScaledVector(e1, (lrnd() - 0.5) * girth)
          .addScaledVector(e2, (lrnd() - 0.5) * girth);
        var sc = o.size * (0.45 + lrnd() * 0.5);
        sp.scale.set(sc, sc * (0.75 + lrnd() * 0.4), 1);
        lobeGroup.add(sp);
        parts.push({ m: m, op: o.op * (0.55 + lrnd() * 0.45), ph: lrnd() * 6.283, rot: m.rotation });
      }
      lobeGroup.userData.parts = parts;
      return lobeGroup;
    }
    function buildJet(feat) { // bipolar jet modelled on the real Cen A composite photo: an orange billowing
      // lobe one way (submm), a translucent blue bubble lobe the other (radio/X-ray), bright filaments inside
      var len = feat.len || 150, dir = (feat.dir || new THREE.Vector3(0, 1, 0)).clone().normalize();
      var up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      var e1 = new THREE.Vector3().crossVectors(dir, up).normalize(), e2 = new THREE.Vector3().crossVectors(dir, e1).normalize();
      var back = dir.clone().negate(), grp = new THREE.Group();
      // per-object style (defaults = the Cen A look; M87 overrides: oneSided, blue, narrow, long spine)
      var flare = feat.flare != null ? feat.flare : 0.24, curve = feat.curve != null ? feat.curve : 0.16, sLen = feat.streamLen != null ? feat.streamLen : 0.45;
      var lobeA = null, streamA = null;
      if (!feat.plasmaOnly) {
        if (!feat.fan && !feat.noLobes) lobeA = jetLobe(dir, len, e1, e2, { color: feat.lobe || 0xd08744, tip: feat.lobeTip || 0xa5642e, count: 20, flare: flare, curve: curve, op: feat.lobeOp != null ? feat.lobeOp : 0.5 });
        if (!feat.noBeam) streamA = jetStream(dir, len * sLen, e1, e2, { n: feat.streamN || 900, from: feat.streamFrom || 0xfff2dc, to: feat.streamTo || 0x9fc0f0, curve: curve * sLen, gain: feat.streamGain != null ? feat.streamGain : 0.6 }); // spine ON the lobe centreline
      }
      var lobeB = null, streamB = null;
      if (!feat.oneSided && !feat.plasmaOnly && !feat.noLobes) {
        lobeB = jetLobe(back, len * 0.9, e1, e2, { color: feat.lobeB || 0x8fb2e8, tip: feat.lobeTipB || 0x6f92d4, count: 18, flare: flare + 0.04, curve: -(curve + 0.02), op: 0.4 }); // counter-lobe, bent the other way
        streamB = jetStream(back, len * 0.3, e1, e2, { n: 500, from: 0xf2e8da, to: 0x8aa8dd, curve: -(curve + 0.02) * 0.3, gain: 0.38 });
      }
      var core = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xfff6e6, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
      core.scale.set(len * 0.12, len * 0.12, 1);
      // flowing plasma streams (comet ion-tail technique): BLUE up one side, VIOLET down the other
      var plasmaBoost = feat.plasmaOnly ? 1.35 : 1; // plasma-only jets carry the whole look — beef them up
      var plasmaA = feat.noBeam ? null : jetPlasma(dir, len * 0.85, e1, e2, { edge: 0x2f7dff, core: 0xa8dcff, flare: flare * (feat.plasmaOnly ? 0.03 : 0.2) * plasmaBoost, curve: curve, n: Math.round(260 * plasmaBoost), seed: 977, size: feat.plasmaOnly ? 0.035 : 0.06 }); // plasma-only: a needle-tight beam, sprite size matched to beam width for a sharp saturated core
      var plasmaB = (feat.oneSided || feat.noBeam) ? null : jetPlasma(back, len * 0.75, e1, e2, { edge: 0x8a3cff, core: 0xdcb2ff, flare: flare * (feat.plasmaOnly ? 0.033 : 0.22) * plasmaBoost, curve: -curve, n: Math.round(240 * plasmaBoost), seed: 1553, size: feat.plasmaOnly ? 0.035 : 0.06 });
      if (lobeA) grp.add(lobeA); if (streamA) grp.add(streamA); if (lobeB) { grp.add(lobeB); grp.add(streamB); } grp.add(core);
      if (plasmaA) grp.add(plasmaA); if (plasmaB) grp.add(plasmaB);
      var radioA = null, radioB = null;
      var streamT = null, capParts = [], wrapParts = [];
      if ((feat.fan || feat.braid) && !feat.noBeam) { // braided counter-curved stream over the spine → the blue ionized-turbulence beam
        streamT = jetStream(dir, len * sLen, e1, e2, { n: 700, from: 0xbfe4ff, to: 0x3f8cff, curve: -curve * sLen * 0.6, gain: 0.55 });
        grp.add(streamT);
      }
      if (feat.fan) { // optional static crescent cap (半月斩)
        var fh = feat.fanHalf || 0.26;
        var capTex = [wispTexture(21.3), wispTexture(34.7)];
        for (var cq = 0; cq < 9; cq++) { // the 半月斩 — orange wisps strung along the fan's round mouth
          var cf = cq / 8, beta = (cf - 0.5) * (fh * 2.6);
          var cm = new THREE.SpriteMaterial({ map: capTex[cq % 2], color: new THREE.Color(0xe09a4e).lerp(new THREE.Color(0xb46a2c), Math.abs(cf - 0.5) * 2),
            rotation: beta * 1.4, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
          var cs = new THREE.Sprite(cm); cs.onBeforeRender = paintWispOnDraw;
          cs.position.copy(dir).multiplyScalar(Math.cos(beta)).addScaledVector(e1, Math.sin(beta)).multiplyScalar(len * (1.0 + 0.06 * Math.cos(beta * 2.2)));
          var cw = len * (0.30 - 0.13 * Math.abs(cf - 0.5) * 2);
          cs.scale.set(cw * 1.5, cw * 0.62, 1); grp.add(cs);
          capParts.push({ m: cm, op: 0.26 + 0.1 * (1 - Math.abs(cf - 0.5) * 2), ph: Math.random() * 6.283, rot: beta * 1.4 });
        }
      }
      if (feat.wrap && lobeB) { // the photo's lower outflow: irregular orange gas WRAPPED inside the translucent blue bubble
        var innerOr = jetLobe(back, len * 0.6, e1, e2, { color: 0xd08744, tip: 0xa5642e, count: 14, flare: flare + 0.1, curve: -(curve + 0.05), op: 0.17 });
        grp.add(innerOr); wrapParts = innerOr.userData.parts;
      }
      var ionJet = null, ionG = null, ionParts = null, ION_UP = 150, ION_DN = 110;
      if (feat.ionTail) { // the solar comet's ION-TAIL technique aimed along the jet axis — streaming plasma, drifting magnetic kinks, widening tip
        ionParts = [];
        for (var iu = 0; iu < ION_UP; iu++) ionParts.push({ frac: (iu + 0.5) / ION_UP, lat1: Math.random() - 0.5, lat2: Math.random() - 0.5, speed: 0.6 + Math.random() * 0.9 });
        for (var idn = 0; idn < ION_DN; idn++) ionParts.push({ frac: (idn + 0.5) / ION_DN, lat1: Math.random() - 0.5, lat2: Math.random() - 0.5, speed: 0.6 + Math.random() * 0.9 });
        var itot = ION_UP + ION_DN;
        ionG = new THREE.BufferGeometry();
        ionG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(itot * 3), 3));
        ionG.setAttribute('color', new THREE.BufferAttribute(new Float32Array(itot * 3), 3));
        ionJet = new THREE.Points(ionG, new THREE.PointsMaterial({ map: GLOW_TEX, size: 3.4, vertexColors: true, transparent: true, opacity: 0.62, depthWrite: false, blending: THREE.AdditiveBlending }));
        ionJet.frustumCulled = false; grp.add(ionJet);
      }
      var knots = [];
      if (feat.plasmaOnly && feat.spine) { // a luminous spine so the jet reads as a BEAM, not a dotted line
        streamA = jetStream(dir, len * sLen, e1, e2, { n: feat.streamN || 1000, from: feat.streamFrom || 0xffffff, to: feat.streamTo || 0xbfe0ff, curve: curve * sLen, gain: feat.streamGain || 0.8 });
        grp.add(streamA);
        if (!feat.oneSided) { streamB = jetStream(back, len * sLen * 0.55, e1, e2, { n: 420, from: 0xf0e6ff, to: 0xb9a0f0, curve: -curve * sLen * 0.5, gain: (feat.streamGain || 0.8) * 0.4 }); grp.add(streamB); } // counter-jet: relativistic beaming dims it
        for (var kq = 0, nk = feat.knots || 0; kq < nk; kq++) { // bright knots along the beam — shocks in the plasma
          var kf = 0.2 + 0.65 * (nk > 1 ? kq / (nk - 1) : 0.5);
          var ks = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xcfe6ff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
          ks.position.copy(dir).multiplyScalar(len * sLen * kf);
          var kw = len * (0.045 + 0.035 * Math.random()); ks.scale.set(kw, kw, 1); grp.add(ks);
          knots.push({ m: ks.material, ph: Math.random() * 6.283, o: 0.35 + Math.random() * 0.3 });
        }
      }
      if (feat.plasmaOnly) { // the full radio-galaxy anatomy: needle jets INTO giant plasma balloons
        radioA = radioLobe(dir, len, e1, e2, { start: len * 0.8, size: len * 0.62, color: 0x4f7fd0, op: 0.17, seed: 641, wisp: true });
        radioB = feat.oneSided ? null : radioLobe(back, len, e1, e2, { start: len * 0.68, size: len * 0.55, color: 0x7a5fd0, op: 0.16, seed: 787, wisp: true });
        grp.add(radioA); if (radioB) grp.add(radioB);
      }
      grp.userData.update = function (t) {
        if (plasmaA) plasmaA.userData.step(t); if (plasmaB) plasmaB.userData.step(t);
        for (j = 0; j < knots.length; j++) knots[j].m.opacity = knots[j].o * (0.72 + 0.28 * Math.sin(t * 1.1 + knots[j].ph));
        if (streamT) streamT.material.uniforms.uTime.value = t;
        if (ionJet) { // comet ion-tail flow: phase-streaming particles with kinks (same math as the solar comet)
          var IPp = ionG.attributes.position.array, ICc = ionG.attributes.color.array, sw = len / 150;
          for (var ii = 0; ii < ionParts.length; ii++) {
            var up = ii < ION_UP, io = ionParts[ii], i3 = ii * 3;
            var jl = up ? len : len * 0.75;
            var kk = (io.frac + t * 0.11 * io.speed) % 1;
            var kacc = kk * (0.4 + 0.6 * kk); // ACCELERATION profile: dense and slow at the nucleus, stretching apart and rushing at the tip — anti-sunward escape
            var sp = (0.4 + kk * 1.8) * sw * 2.2;
            var kn = Math.sin(kk * 7 - t * 1.6) * 1.4 * kk * sw;
            var ax = up ? dir : back;
            IPp[i3] = ax.x * jl * kacc + e1.x * (io.lat1 * sp + kn) + e2.x * (io.lat2 * sp + kn * 0.4);
            IPp[i3 + 1] = ax.y * jl * kacc + e1.y * (io.lat1 * sp + kn) + e2.y * (io.lat2 * sp + kn * 0.4);
            IPp[i3 + 2] = ax.z * jl * kacc + e1.z * (io.lat1 * sp + kn) + e2.z * (io.lat2 * sp + kn * 0.4);
            var coreW = 1 - Math.min(1, Math.sqrt(io.lat1 * io.lat1 + io.lat2 * io.lat2) * 2.2);
            var fade = Math.min(1, Math.pow(1 - kk, 1.25) * (0.75 + 0.25 * Math.sin(t * 2.4 + ii)) * 1.35);
            if (up) { ICc[i3] = (0.22 + 0.5 * coreW) * fade; ICc[i3 + 1] = (0.42 + 0.45 * coreW) * fade; ICc[i3 + 2] = 1.0 * fade; } // cyan-core blue ion stream
            else { fade *= 0.68; ICc[i3] = (0.4 + 0.32 * coreW) * fade; ICc[i3 + 1] = (0.22 + 0.26 * coreW) * fade; ICc[i3 + 2] = 1.0 * fade; } // dim violet counter-stream
          }
          ionG.attributes.position.needsUpdate = ionG.attributes.color.needsUpdate = true;
        }
        for (j = 0; j < capParts.length; j++) { capParts[j].m.opacity = capParts[j].op * (0.8 + 0.2 * Math.sin(t * 0.4 + capParts[j].ph)); capParts[j].m.rotation = capParts[j].rot + 0.05 * Math.sin(t * 0.18 + capParts[j].ph); }
        for (j = 0; j < wrapParts.length; j++) { wrapParts[j].m.opacity = wrapParts[j].op * (0.82 + 0.18 * Math.sin(t * 0.5 + wrapParts[j].ph)); wrapParts[j].m.rotation = wrapParts[j].rot + 0.06 * Math.sin(t * 0.2 + wrapParts[j].ph); }
        if (streamA) streamA.material.uniforms.uTime.value = t; if (streamB) streamB.material.uniforms.uTime.value = t;
        var ra = radioA ? radioA.userData.parts : [], rb = radioB ? radioB.userData.parts : [], j;
        for (j = 0; j < ra.length; j++) { ra[j].m.opacity = ra[j].op * (0.8 + 0.2 * Math.sin(t * 0.3 + ra[j].ph)); ra[j].m.rotation = ra[j].rot + 0.04 * Math.sin(t * 0.15 + ra[j].ph); }
        for (j = 0; j < rb.length; j++) { rb[j].m.opacity = rb[j].op * (0.8 + 0.2 * Math.sin(t * 0.27 + rb[j].ph)); rb[j].m.rotation = rb[j].rot + 0.04 * Math.sin(t * 0.13 + rb[j].ph); }
        var pa = lobeA ? lobeA.userData.parts : [], pb = lobeB ? lobeB.userData.parts : [], i;
        for (i = 0; i < pa.length; i++) { pa[i].m.opacity = pa[i].op * (0.82 + 0.18 * Math.sin(t * 0.5 + pa[i].ph)); pa[i].m.rotation = pa[i].rot + 0.06 * Math.sin(t * 0.22 + pa[i].ph); }  // clouds slowly churn + swirl
        for (i = 0; i < pb.length; i++) { pb[i].m.opacity = pb[i].op * (0.82 + 0.18 * Math.sin(t * 0.45 + pb[i].ph)); pb[i].m.rotation = pb[i].rot + 0.06 * Math.sin(t * 0.2 + pb[i].ph); }
      };
      return grp;
    }
    function buildFeature(feat) {
      var group = new THREE.Group(), update = function () {};
      if (feat.kind === 'globular') {
        group.add(starPoints(220, 9, 0xfff0d8, 1.0));
        var core = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xffe8c8, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })); core.scale.set(14, 14, 1); group.add(core);
        // static on purpose (old, quiet cluster)
      } else if (feat.kind === 'starcloud') {
        var scPts = starPoints(150, 16, 0xdbeaff, 1.1, 0.5); group.add(scPts);
        update = function (t) { scPts.material.uniforms.uSize.value = (2.4 + 0.9 * Math.sin(t * 3.1)) * renderer.getPixelRatio(); }; // young-star shimmer
      } else if (feat.kind === 'nebula') {
        var nsz = feat.size || 1, ncol = feat.color || 0xff6aa8, nst = feat.stars || 26; // per-object size/colour (Tarantula big+red, NGC 346 small)
        var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: ncol, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.set(34 * nsz, 24 * nsz, 1); group.add(glow);
        var nbPts = starPoints(nst, 12 * nsz, 0xcfe0ff, 1.2, 0.6); group.add(nbPts);
        update = function (t) { var b = 0.5 + 0.5 * Math.sin(t * 0.62); glow.material.opacity = 0.4 + 0.28 * b; var s = (30 + 8 * b) * nsz; glow.scale.set(s, s * 0.7, 1); nbPts.material.uniforms.uSize.value = (2.4 + 1.1 * Math.sin(t * 2.3)) * renderer.getPixelRatio(); }; // slow breathe + twinkle
      } else if (feat.kind === 'jet') {
        var jet = buildJet(feat); group.add(jet);
        update = jet.userData.update; // drives stream uTime + slow cloud churn
      } else if (feat.kind === 'supernova') {
        var snCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); snCore.scale.set(7, 7, 1); group.add(snCore);
        var snRing = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture(), color: 0xffd2e8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); group.add(snRing);
        update = function (t) {
          snCore.material.opacity = 0.62 + 0.3 * Math.sin(t * 4.0);       // fast pulse — the flash that reached Earth in 1987
          var k = (t * 0.12) % 1, s = 4 + k * 26;                          // slow expanding ring, fading as it grows, looping
          snRing.scale.set(s, s, 1); snRing.material.opacity = 0.55 * (1 - k);
        };
      }
      return { group: group, update: update };
    }
    function linkGalaxyChildren() {
      BEACONS.forEach(function (c) {
        if (!c.child) return;
        var lod = null; for (var i = 0; i < galaxyLODs.length; i++) if (galaxyLODs[i].cat === c.parent) { lod = galaxyLODs[i]; break; }
        if (!lod) return;
        c.parentPts = lod.pts; c.lod = lod; // lod link → distance-gates the feature in the frame loop
        c.feature = buildFeature(c.feat);
        c.feature.group.position.copy(c.feat.kind === 'jet' ? new THREE.Vector3(0, 0, 0) : c.lp); // jet emanates from the nucleus; others sit at lp
        lod.pts.add(c.feature.group); // always on — no scan gate
      });
    }

    for (var gi = 0; gi < BEACONS.length; gi++) {
      var b = BEACONS[gi]; if (b.gal && b.gal.stars) { buildGalaxyStars(b.p, b.gal.stars); galaxyLODs[galaxyLODs.length - 1].cat = b.info.en.catalog; } // real 3D particle galaxy
    }
    linkGalaxyChildren();
  })();

  if (!window.ShiguangBackgroundMusic) {
  // ── background music (speaker button / M, autoplays on load): local mp3s in ./audio/,
  // listed by FILE NAME. The speaker toggles play/mute; a hover popup picks the
  // track. Playback starts only on a user gesture (autoplay policy). To add music,
  // drop .mp3 files in ./audio/ and list their file names here. Empty → the speaker
  // button is hidden.
  var MUSIC_TRACKS = ['追梦的人慢版.mp3'];
  var musicEl = null, musicTrack = -1, musicOn = false;
  var audioBtn = document.getElementById('audiobtn'), audioList = document.getElementById('audiolist');
  if (!MUSIC_TRACKS.length) document.getElementById('audio').style.display = 'none';
  MUSIC_TRACKS.forEach(function (f, i) {
    var d = document.createElement('button'); d.type = 'button'; d.className = 'a-track'; d.textContent = f.replace(/\.mp3$/i, '');
    d.addEventListener('click', function (e) { e.stopPropagation(); musicPlay(i); });
    audioList.appendChild(d);
  });
  function musicPaint() {
    audioBtn.textContent = musicOn ? '🔊' : '🔇'; audioBtn.setAttribute('aria-pressed', musicOn ? 'true' : 'false');
    Array.prototype.forEach.call(audioList.children, function (c2, i) { c2.classList.toggle('on', i === musicTrack && musicOn); if (i === musicTrack && musicOn) c2.setAttribute('aria-current', 'true'); else c2.removeAttribute('aria-current'); });
  }
  function musicPlay(i) {
    if (videoMode) { musicOn = false; musicPaint(); return; }
    if (!musicEl) { musicEl = new Audio(); musicEl.preload = 'none'; musicEl.loop = true; musicEl.volume = 0.35; } // preload none: an 8 MB track must not stream in behind a blocked autoplay
    if (musicTrack !== i) { musicTrack = i; musicEl.src = 'audio/' + encodeURIComponent(MUSIC_TRACKS[i]); }
    musicEl.muted = false; musicOn = true;
    var attempt = musicEl.src;
    musicEl.play().then(function () { if (musicOn) musicRemember('on'); musicPaint(); }) // muted while it loaded? their 'off' stands
    .catch(function () {
      if (musicEl.src !== attempt) return; // a newer track took over — its own play() reports
      musicOn = false; musicPaint();
      if (musicEl.paused || musicEl.error) { musicEl.removeAttribute('src'); musicEl.load(); musicTrack = -1; } // blocked autoplay or failed load: drop the half-started download; the next gesture starts afresh
    });
    musicPaint();
  }
  function musicRemember(state) { try { localStorage.setItem('gx-music', state); } catch (e) {} } // only user-driven states persist (not autoplay blocks)
  function musicToggle() {
    if (videoMode) { musicOn = false; musicPaint(); return; }
    if (!musicEl || musicTrack < 0) { musicPlay(0); return; } // first toggle starts track 1
    if (musicOn) { musicEl.muted = true; musicOn = false; musicRemember('off'); }
    else { musicRemember('on'); musicPlay(musicTrack); }
    musicPaint();
  }
  audioBtn.addEventListener('click', musicToggle);

  // autoplay on load; browsers block sound before a user gesture, so if the initial
  // play() is refused, fall back to starting on the first click/key/touch.
  var musicPref = 'on'; try { musicPref = localStorage.getItem('gx-music') || 'on'; } catch (e) {}
  if (!videoMode && MUSIC_TRACKS.length && musicPref !== 'off') { // skip autoplay if the user muted last visit
    musicPlay(0);
    var kickMusic = function (e) {
      if (e && ((e.target && e.target.closest && e.target.closest('#audio')) || (e.type === 'keydown' && (e.key || '').toLowerCase() === 'm'))) return; // the music control's own handler decides
      if (musicEl && musicEl.paused) musicPlay(0);
      if (musicEl && !musicEl.paused) ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.removeEventListener(ev, kickMusic); });
    };
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, kickMusic, { passive: true }); });
  }

  }
  // ── ?fx=1 — demo mode: force one ambient event every 4s (meteor → shower → nova,
  // round-robin) so you can see each effect without waiting for the real schedule.
  // e.g. index.html?fx=1
  var fxDemoSeq = 0;
  if (!videoMode && /[?&]fx/i.test(location.search)) setInterval(function () {
    if (document.hidden) return;
    var s = fxDemoSeq++ % 3;
    if (s === 0) spawnMeteor();
    else if (s === 1) {
      var rn = [Math.random() * 1.2 - 0.6, Math.random() * 0.8 - 0.1];
      var dd = [(Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.3), -(0.35 + Math.random() * 0.3)];
      for (var i = 0; i < 7; i++) spawnMeteor(
        [rn[0] + (Math.random() - 0.5) * 0.5, rn[1] + (Math.random() - 0.5) * 0.35],
        videoNow() + i * 320,
        dd
      );
    }
    else spawnNova();
  }, 4000);

  // keyboard: F cinema (hide UI) · M music (never steals from inputs)
  window.addEventListener('keydown', function (e) {
    var tg = e.target;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT')) return; // typing to pick a language is not a shortcut
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var k = (e.key || '').toLowerCase();
    if (k === 'f') toggleCinema();
  else if (k === 'm' && window.ShiguangBackgroundMusic && typeof window.ShiguangBackgroundMusic.toggle === 'function') window.ShiguangBackgroundMusic.toggle();
    else if (k === 'escape') toggleCinema(false);
  });

  // Safari trackpad pinch fires proprietary gesture events and zooms the PAGE,
  // which detaches the HTML overlays from the canvas. Capture it and dolly the
  // camera instead (in the sky view just swallow it — rotate-only there).
  var gestureDist = 0, gestureView = 'galaxy';
  function routeSolarGestureZoom(scale) {
    if (viewMode !== 'solar' || !scale) return false;
    var baseDistance = gestureDist > 0 ? gestureDist : solarCamera.position.distanceTo(solarControls.target);
    var d = Math.min(solarControls.maxDistance, Math.max(solarControls.minDistance, baseDistance / scale));
    var dir = solarCamera.position.clone().sub(solarControls.target).normalize();
    solarCamera.position.copy(solarControls.target).addScaledVector(dir, d);
    solarControls.update();
    return true;
  }
  window.addEventListener('gesturestart', function (e) {
    e.preventDefault();
    gestureView = viewMode;
    gestureDist = viewMode === 'solar' ? solarCamera.position.distanceTo(solarControls.target) : camera.position.distanceTo(controls.target);
  });
  window.addEventListener('gesturechange', function (e) {
    e.preventDefault();
    if (gestureView === 'solar' && routeSolarGestureZoom(e.scale)) return;
    if (viewMode !== 'galaxy' || !e.scale) return;
    var d = Math.min(controls.maxDistance, Math.max(controls.minDistance, gestureDist / e.scale));
    var dir = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, d);
  });
  window.addEventListener('gestureend', function (e) { e.preventDefault(); gestureDist = 0; });

  // ── go ───────────────────────────────────────────────────────────────────────
  if (/[?&]solarTest=1/.test(location.search)) { // the self-test ships only on demand (test/solar-selftest.js); the first frame still waits for it
    var solarTestScript = document.createElement('script');
    solarTestScript.src = 'test/solar-selftest.js';
    solarTestScript.onload = function () { try { runSolarSelfTests(); } finally { startLoop(); } };
    solarTestScript.onerror = function () { window.__solarTestResult = { passed: false, failures: ['test/solar-selftest.js did not load'] }; setMsg(window.__solarTestResult.failures[0]); startLoop(); };
    document.head.appendChild(solarTestScript);
  } else startLoop();
  window.__shiguangGalaxyRuntimeReady = true;

