(function (root) {
  'use strict';
  function createFlow(initial) {
    var snapshot = Object.assign({ state: 'welcome', dna: '', direction: '', name: '' }, initial || {});
    function setState(value) { snapshot.state = value; return value; }
    return {
      state: function () { return snapshot.state; },
      data: function () { return { dna: snapshot.dna, direction: snapshot.direction, name: snapshot.name }; },
      start: function () { return setState('question-dna'); },
      choose: function (value) {
        if (snapshot.state === 'question-dna') snapshot.dna = value;
        else if (snapshot.state === 'question-direction') snapshot.direction = value;
      },
      next: function () {
        if (snapshot.state === 'question-dna') { if (!snapshot.dna) throw new Error('请选择一项'); return setState('question-direction'); }
        if (snapshot.state === 'question-direction') { if (!snapshot.direction) throw new Error('请选择一项'); return setState('name'); }
        throw new Error('当前步骤无法继续');
      },
      submitName: function (name) { name = String(name || '').trim(); if (!name) throw new Error('请输入名字'); snapshot.name = name; return setState('generating'); },
      complete: function () { if (snapshot.state !== 'generating') throw new Error('身份尚未生成'); return setState('card'); },
      enterGalaxy: function () { if (snapshot.state !== 'card') throw new Error('请先生成身份卡'); return setState('galaxy'); },
      restart: function () { snapshot.dna = ''; snapshot.direction = ''; snapshot.name = ''; return setState('question-dna'); }
    };
  }
  root.ShiguangIdentityFlow = { createFlow: createFlow };
}(typeof globalThis !== 'undefined' ? globalThis : window));
