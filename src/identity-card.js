(function (root) {
  'use strict';
  function cardModel(record) { return { name: record.name, number: record.number, blessing: record.blessing, cardBackground: record.cardBackground, identityTitle: record.identityTitle, slogan: record.slogan }; }
  function safeFilename(name) {
    var clean = String(name || '我的身份卡').replace(/[\\/:*?"<>|]/g, '').trim() || '我的身份卡';
    return '拾光者-' + clean + '.png';
  }
  function containImageRect(imageWidth, imageHeight, box) {
    var scale = Math.min(box.width / imageWidth, box.height / imageHeight);
    var width = imageWidth * scale, height = imageHeight * scale;
    return {
      x: box.x + (box.width - width) / 2,
      y: box.y + (box.height - height) / 2,
      width: width,
      height: height,
    };
  }
  function setFittedFont(ctx, text, maxSize, minSize, maxWidth, weight, family) {
    var size = maxSize;
    while (size > minSize) {
      ctx.font = (weight || '') + ' ' + size + 'px ' + (family || 'sans-serif');
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 2;
    }
    ctx.font = (weight || '') + ' ' + Math.max(size, minSize) + 'px ' + (family || 'sans-serif');
    return size;
  }
  function draw(canvas, record, image) {
    var imageWidth=image&&(image.naturalWidth||image.width)||0,imageHeight=image&&(image.naturalHeight||image.height)||0;
    var isHolographicBackground=imageWidth&&imageHeight&&imageWidth/imageHeight>.72&&imageWidth/imageHeight<.78;
    var ctx = canvas.getContext('2d'), w = isHolographicBackground ? 1086 : 1024, h = isHolographicBackground ? 1448 : 1280;
    canvas.width = w; canvas.height = h;
    if (isHolographicBackground) {
      ctx.drawImage(image,0,0,w,h);
      ctx.save();
      ctx.textBaseline='alphabetic';
      ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=9;ctx.shadowOffsetY=2;
      ctx.fillStyle='#f4c665';ctx.font='28px "Microsoft YaHei",sans-serif';ctx.fillText('新闻与传播学院',706,105);
      ctx.font='bold 32px "Microsoft YaHei",sans-serif';ctx.fillText('第一届“拾光”文化节',706,151);
      ctx.fillStyle='#fff1c5';setFittedFont(ctx,record.name,84,24,330,'bold','Georgia,"Songti SC",serif');ctx.fillText(record.name,700,478);
      ctx.fillStyle='#f5e6bd';setFittedFont(ctx,'拾光者  No.'+record.number,30,20,330,'','"Microsoft YaHei",sans-serif');ctx.fillText('拾光者  No.'+record.number,706,565);
      var gold=ctx.createLinearGradient(700,680,1010,850);gold.addColorStop(0,'#fff0b5');gold.addColorStop(.48,'#e3b356');gold.addColorStop(1,'#fff2bd');ctx.fillStyle=gold;setFittedFont(ctx,record.identityTitle||'拾光者',68,28,330,'bold','"Microsoft YaHei",sans-serif');ctx.fillText(record.identityTitle||'拾光者',700,790);
      ctx.fillStyle='#fff3d4';setFittedFont(ctx,record.slogan||'让创作成为光',29,16,330,'','"Microsoft YaHei",sans-serif');ctx.fillText(record.slogan||'让创作成为光',704,850);
      ctx.fillStyle='#efe1c5';ctx.font='22px "Microsoft YaHei",sans-serif';var holographicLines=Array.isArray(record.blessing)?record.blessing:[String(record.blessing||'')];holographicLines.slice(0,3).forEach(function(line,index){setFittedFont(ctx,line,22,14,330,'','"Microsoft YaHei",sans-serif');ctx.fillText(line,704,946+index*43);});
      ctx.restore();
      return canvas;
    }
    var bg = ctx.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#070709'); bg.addColorStop(.55, '#241706'); bg.addColorStop(1, '#050507'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,205,112,.35)'; ctx.lineWidth = 2; for (var i=0;i<12;i++){ctx.beginPath();ctx.arc(760,210,100+i*34,.2,2.4);ctx.stroke();}
    if (image && image.complete && imageWidth && imageHeight) { var rect=containImageRect(imageWidth,imageHeight,{x:70,y:245,width:884,height:610});ctx.save();ctx.beginPath();ctx.roundRect(70,245,884,610,34);ctx.clip();var glow=ctx.createRadialGradient(512,540,40,512,540,390);glow.addColorStop(0,'rgba(255,205,102,.2)');glow.addColorStop(1,'rgba(255,205,102,0)');ctx.fillStyle=glow;ctx.fillRect(70,245,884,610);ctx.globalAlpha=.96;ctx.drawImage(image,rect.x,rect.y,rect.width,rect.height);ctx.restore(); }
    ctx.fillStyle='#e3b966';ctx.font='32px serif';ctx.fillText('新闻与传播学院 · 第一届“拾光”文化节',70,100);
    ctx.fillStyle='#fff2cb';setFittedFont(ctx,record.name,88,38,884,'bold','serif');ctx.fillText(record.name,70,965);
    ctx.font='30px sans-serif';ctx.fillStyle='#d8c49b';ctx.fillText('拾光者 No.'+record.number,74,1020);
    ctx.fillStyle='#d4a44e';setFittedFont(ctx,record.identityTitle||'拾光者',74,38,884,'bold','sans-serif');ctx.fillText(record.identityTitle||'拾光者',70,1120);
    ctx.fillStyle='#f0e5cc';setFittedFont(ctx,record.slogan||'让创作成为光',28,18,884,'','sans-serif');ctx.fillText(record.slogan||'让创作成为光',74,1168);
    ctx.font='23px sans-serif';ctx.fillStyle='#c9bda7';var lines=Array.isArray(record.blessing)?record.blessing:[String(record.blessing||'')];lines.slice(0,3).forEach(function(line,index){ctx.fillText(line,74,1200+index*28);});
    return canvas;
  }
  root.ShiguangIdentityCard = { cardModel: cardModel, safeFilename: safeFilename, containImageRect: containImageRect, draw: draw };
}(typeof globalThis !== 'undefined' ? globalThis : window));
