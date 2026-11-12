(function (root) {
  'use strict';

  var tracks = ['追梦的人慢版.mp3'];
  var panel = document.getElementById('audio');
  var button = document.getElementById('audiobtn');
  var list = document.getElementById('audiolist');
  var player = null;
  var trackIndex = -1;
  var playing = false;

  if (!panel || !button || !list || !tracks.length) return;
  root.ShiguangBackgroundMusic = true;
  panel.style.display = '';

  tracks.forEach(function (filename, index) {
    var item = document.createElement('button');
    item.type = 'button';
    item.className = 'a-track';
    item.textContent = filename.replace(/\.mp3$/i, '');
    item.addEventListener('click', function (event) {
      event.stopPropagation();
      play(index);
    });
    list.appendChild(item);
  });

  function paint() {
    button.textContent = playing ? '🔊' : '🔇';
    button.setAttribute('aria-pressed', playing ? 'true' : 'false');
    Array.prototype.forEach.call(list.children, function (item, index) {
      item.classList.toggle('on', index === trackIndex && playing);
      if (index === trackIndex && playing) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    });
  }

  function remember(value) {
    try { localStorage.setItem('gx-music', value); } catch (error) {}
  }

  function play(index) {
    if (!player) {
      player = new Audio();
      player.preload = 'none';
      player.loop = true;
      player.volume = 0.35;
    }
    if (trackIndex !== index) {
      trackIndex = index;
      player.src = 'audio/' + encodeURIComponent(tracks[index]);
    }
    player.muted = false;
    playing = true;
    var attemptedSource = player.src;
    player.play().then(function () {
      if (playing) remember('on');
      paint();
    }).catch(function () {
      if (player.src !== attemptedSource) return;
      playing = false;
      paint();
      if (player.paused || player.error) {
        player.removeAttribute('src');
        player.load();
        trackIndex = -1;
      }
    });
    paint();
  }

  function toggle() {
    if (!player || trackIndex < 0) {
      play(0);
      return;
    }
    if (playing) {
      player.muted = true;
      playing = false;
      remember('off');
    } else {
      remember('on');
      play(trackIndex);
    }
    paint();
  }

  button.addEventListener('click', toggle);
  var preference = 'on';
  try { preference = localStorage.getItem('gx-music') || 'on'; } catch (error) {}
  if (preference !== 'off') {
    play(0);
    var startAfterGesture = function (event) {
      if (event && event.target && event.target.closest && event.target.closest('#audio')) return;
      if (player && player.paused) play(0);
      if (player && !player.paused) {
        ['pointerdown', 'keydown', 'touchstart'].forEach(function (type) {
          window.removeEventListener(type, startAfterGesture);
        });
      }
    };
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (type) {
      window.addEventListener(type, startAfterGesture, { passive: true });
    });
  }
  paint();
}(typeof globalThis !== 'undefined' ? globalThis : window));
