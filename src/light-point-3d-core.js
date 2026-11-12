(function (root) {
  'use strict';
  function hash(text) {
    var value = 2166136261;
    Array.from(String(text)).forEach(function (char) {
      value ^= char.charCodeAt(0);
      value = Math.imul(value, 16777619);
    });
    return value >>> 0;
  }

  function spiralPosition(record, index) {
    var seed = hash((record && record.id) || ('light-' + index));
    var radius = 75 + (seed % 24000) / 100;
    var arm = (seed >>> 7) % 4;
    var jitter = (((seed >>> 12) % 1000) / 1000 - .5) * .38;
    var angle = arm * Math.PI / 2 + radius * .024 + jitter;
    var radialJitter = (((seed >>> 20) % 1000) / 1000 - .5) * 15;
    var r = radius + radialJitter;
    return {
      x: Math.cos(angle) * r,
      y: 9 + ((seed >>> 16) % 1000) / 1000 * 6,
      z: Math.sin(angle) * r,
    };
  }

  function visualSpecFor(record) {
    return record && record.mine
      ? { basePixels: 8.25, maxPixels: 18.9, brightness: 1.45, pulseAmplitude: .12, pulsePeriodMs: 1800 }
      : { basePixels: 7, maxPixels: 16, brightness: 1, pulseAmplitude: 0, pulsePeriodMs: 0 };
  }

  function personalStatusFor(records) {
    return records.some(function (record) { return !!record.mine; })
      ? '查看我的光'
      : '填写信息后生成我的光';
  }

  function positionsFor(records) {
    var output = [];
    records.forEach(function (record, index) {
      var point = spiralPosition(record, index);
      output.push(point.x, point.y, point.z);
    });
    return output;
  }

  root.Shiguang3DCore = {
    hash: hash,
    spiralPosition: spiralPosition,
    positionsFor: positionsFor,
    visualSpecFor: visualSpecFor,
    personalStatusFor: personalStatusFor,
  };
}(typeof globalThis !== 'undefined' ? globalThis : window));
