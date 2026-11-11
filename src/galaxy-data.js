(function (root) {
  'use strict';

  var DEFAULT_IMAGE = 'images/career-ip/light-catcher.png';
  var ALLOWED_IMAGES = [
    'images/career-ip/time-helmsman.png',
    'images/career-ip/light-catcher.png',
    'images/career-ip/emotion-harvester.png',
    'images/career-ip/idea-igniter.png',
    'images/career-ip/truth-digger.png',
    'images/career-ip/traffic-surfer.png',
    'images/career-ip/dimension-breaker.png',
    'images/career-ip/interactive-lightmaker.png',
    'images/career-ip/color-alchemist.png',
    'images/career-ip/dream-builder.png'
  ];

  function text(value) { return typeof value === 'string' ? value.trim() : ''; }

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
      ipImage: ALLOWED_IMAGES.indexOf(text(raw.ipImage)) >= 0 ? text(raw.ipImage) : DEFAULT_IMAGE,
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
