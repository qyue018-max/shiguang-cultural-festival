(function (root) {
  'use strict';

  function displayProfile(viewportWidth) {
    return viewportWidth >= 900
      ? { maxLabels: 60, fontSize: 11, highlightFontSize: 15 }
      : { maxLabels: 18, fontSize: 9, highlightFontSize: 13 };
  }

  function isHighlighted(label, now) {
    return Number(label && label.highlightUntil) > Number(now);
  }

  function isOccludedByDisc(point, camera, radius) {
    if (!point || !camera || camera.y === point.y || camera.y * point.y >= 0) return false;
    var t = -camera.y / (point.y - camera.y);
    if (t <= 0 || t >= 1) return false;
    var x = camera.x + (point.x - camera.x) * t;
    var z = camera.z + (point.z - camera.z) * t;
    return Math.hypot(x, z) <= radius;
  }

  function labelBox(label) {
    var width = Math.max(20, Number(label.width) || 20);
    var height = Math.max(12, Number(label.height) || 12);
    return {
      left: label.x - width / 2,
      right: label.x + width / 2,
      top: label.y - height - 8,
      bottom: label.y - 8,
    };
  }

  function overlaps(a, b) {
    var gap = 6;
    return !(a.right + gap < b.left || a.left > b.right + gap || a.bottom + gap < b.top || a.top > b.bottom + gap);
  }

  function selectVisibleLabels(candidates, options) {
    var config = options || {};
    var width = Number(config.width) || 0;
    var height = Number(config.height) || 0;
    var top = Number(config.top) || 0;
    var bottom = Number(config.bottom) || 0;
    var nowValue = Number(config.now);
    var now = Number.isFinite(nowValue) ? nowValue : Date.now();
    var maxLabels = Math.max(0, Number(config.maxLabels) || 0);
    var accepted = [];
    var boxes = [];

    if (!maxLabels) return accepted;

    candidates.filter(function (candidate) {
      if (!candidate || candidate.z <= -1 || candidate.z >= 1) return false;
      var box = labelBox(candidate);
      return box.left >= 0 && box.right <= width
        && box.top >= top && box.bottom <= height - bottom;
    }).sort(function (a, b) {
      var highlightOrder = Number(isHighlighted(b, now)) - Number(isHighlighted(a, now));
      return highlightOrder || a.z - b.z;
    }).some(function (candidate) {
      var box = labelBox(candidate);
      if (boxes.some(function (placed) { return overlaps(box, placed); })) return false;
      accepted.push(candidate);
      boxes.push(box);
      return accepted.length >= maxLabels;
    });

    return accepted;
  }

  root.ShiguangParticipantLabels = {
    displayProfile: displayProfile,
    isHighlighted: isHighlighted,
    isOccludedByDisc: isOccludedByDisc,
    selectVisibleLabels: selectVisibleLabels,
  };
}(typeof globalThis !== 'undefined' ? globalThis : window));

