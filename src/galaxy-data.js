(function (root) {
  'use strict';

  var DEFAULT_IMAGE = 'images/career-ip/light-catcher.webp';
  var ALLOWED_IMAGES = [
    'images/career-ip/time-helmsman.webp',
    'images/career-ip/light-catcher.webp',
    'images/career-ip/emotion-harvester.webp',
    'images/career-ip/idea-igniter.webp',
    'images/career-ip/truth-digger.webp',
    'images/career-ip/traffic-surfer.webp',
    'images/career-ip/dimension-breaker.webp',
    'images/career-ip/interactive-lightmaker.webp',
    'images/career-ip/color-alchemist.webp',
    'images/career-ip/dream-builder.webp'
  ];

  function text(value) { return typeof value === 'string' ? value.trim() : ''; }

  function normalizeImage(value) {
    var image = text(value);
    if (/^images\/career-ip\/[a-z-]+\.png$/.test(image)) image = image.slice(0, -4) + '.webp';
    return ALLOWED_IMAGES.indexOf(image) >= 0 ? image : DEFAULT_IMAGE;
  }

  function normalizeLight(raw, options) {
    if (!raw || typeof raw !== 'object') return null;
    var id = text(raw.id), number = text(raw.number), name = text(raw.name), identityKey = text(raw.identityKey);
    if (!id || !number || !name || !identityKey) return null;
    var mineId = options && text(options.mineId);
    return {
      id: id,
      number: number,
      name: name,
      identityKey: identityKey,
      ipImage: normalizeImage(raw.ipImage),
      createdAt: text(raw.createdAt) || new Date().toISOString(),
      mine: Boolean(raw.mine || (mineId && id === mineId))
    };
  }

  function mergeLights(existing, incoming, mineId) {
    var result = [], seen = Object.create(null);
    [existing, incoming].forEach(function (items) {
      (Array.isArray(items) ? items : []).forEach(function (item) {
        var normalized = normalizeLight(item, { mineId: mineId });
        if (!normalized || seen[normalized.id]) return;
        seen[normalized.id] = true;
        result.push(normalized);
      });
    });
    return result;
  }

  root.ShiguangGalaxyData = {
    DEFAULT_IMAGE: DEFAULT_IMAGE,
    ALLOWED_IMAGES: ALLOWED_IMAGES.slice(),
    normalizeLight: normalizeLight,
    mergeLights: mergeLights
  };
}(typeof globalThis !== 'undefined' ? globalThis : window));
