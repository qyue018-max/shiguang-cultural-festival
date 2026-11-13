(function (root) {
  'use strict';

  function isMobile() {
    var coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    return coarse || /Android|iPhone|iPad|iPod|Mobile|MicroMessenger/i.test(navigator.userAgent || '');
  }

  function canvasBlob(canvas) {
    return new Promise(function (resolve) {
      if (typeof canvas.toBlob === 'function') canvas.toBlob(resolve, 'image/png');
      else resolve(null);
    });
  }

  function download(canvas, blob, filename) {
    var link = document.createElement('a');
    link.download = filename;
    link.href = blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png');
    link.click();
    if (blob) setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    return 'downloaded';
  }

  function preview(canvas) {
    var old = document.querySelector && document.querySelector('.identity-save-preview');
    if (old) old.remove();
    var layer = document.createElement('div');
    layer.className = 'identity-save-preview';
    layer.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.96);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px;';
    var tip = document.createElement('p');
    tip.textContent = '长按图片保存到相册';
    tip.style.cssText = 'color:#ffe6a5;font-size:18px;margin:0 0 14px;';
    var image = document.createElement('img');
    image.src = canvas.toDataURL('image/png');
    image.alt = '拾光身份卡高清图片';
    image.style.cssText = 'display:block;max-width:100%;max-height:82vh;object-fit:contain;-webkit-touch-callout:default;user-select:auto;';
    var close = document.createElement('button');
    close.type = 'button';
    close.textContent = '关闭';
    close.style.cssText = 'margin-top:14px;padding:10px 28px;border:1px solid #d7b45c;border-radius:999px;background:#111226;color:#ffe6a5;font-size:16px;';
    close.addEventListener('click', function () { layer.remove(); });
    layer.appendChild(tip);
    layer.appendChild(image);
    layer.appendChild(close);
    document.body.appendChild(layer);
    return 'preview';
  }

  async function save(canvas, filename) {
    var blob = await canvasBlob(canvas);
    if (!isMobile()) return download(canvas, blob, filename);
    if (blob && typeof File === 'function' && navigator.share && navigator.canShare) {
      var file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: '我的拾光身份卡' });
          return 'shared';
        } catch (error) {
          if (error && error.name === 'AbortError') return 'cancelled';
        }
      }
    }
    return preview(canvas);
  }

  root.ShiguangCardSave = { save: save };
}(typeof globalThis !== 'undefined' ? globalThis : window));

