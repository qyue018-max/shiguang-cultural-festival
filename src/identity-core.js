(function (root) {
  'use strict';
  var config = root.ShiguangIdentityConfig;
  function resolveIdentity(dna, direction) {
    if (dna !== 'A' && dna !== 'B') throw new Error('请选择创作方式');
    if (!config.directions[direction]) throw new Error('请选择创作方向');
    var type = dna === 'A' ? 'rational' : 'imaginative', item = config.directions[direction][type];
    return { key: item.key, title: item.title, roleLabel: item.role, slogan: item.slogan, direction: direction, dna: dna, ipImage: item.ipImage || config.fallbackIpImage, cardBackground: item.cardBackground };
  }
  function validateName(value) {
    var name = String(value || '').trim();
    if (!name) throw new Error('请输入你的名字');
    if (Array.from(name).length > 12) throw new Error('名字不能超过 12 个字符');
    return name;
  }
  function createIdentityRecord(input) {
    var identity = resolveIdentity(input.dna, input.direction);
    var number = String(input.number == null ? 827 : input.number).padStart(4, '0').slice(-4);
    return {
      id: 'mine-' + number,
      name: validateName(input.name),
      number: number,
      dna: input.dna,
      direction: input.direction,
      identityKey: identity.key,
      identityTitle: identity.title,
      roleLabel: identity.roleLabel,
      slogan: identity.slogan,
      blessing: config.blessings.slice(),
      ipImage: identity.ipImage,
      cardBackground: identity.cardBackground,
      mine: true,
      createdAt: input.now || new Date().toISOString()
    };
  }
  function isIdentityRecord(value) {
    return !!value && typeof value === 'object' && typeof value.name === 'string' && /^\d{4}$/.test(value.number || '') && (value.dna === 'A' || value.dna === 'B') && Object.prototype.hasOwnProperty.call(config.directions, value.direction) && typeof value.identityKey === 'string' && Array.isArray(value.blessing) && value.blessing.length === 3 && typeof value.ipImage === 'string';
  }
  function refreshIdentityRecord(value) {
    var identity = resolveIdentity(value.dna, value.direction);
    return Object.assign({}, value, {
      identityKey: identity.key,
      identityTitle: identity.title,
      roleLabel: identity.roleLabel,
      slogan: identity.slogan,
      ipImage: identity.ipImage,
      cardBackground: identity.cardBackground
    });
  }
  root.ShiguangIdentityCore = { resolveIdentity: resolveIdentity, validateName: validateName, createIdentityRecord: createIdentityRecord, isIdentityRecord: isIdentityRecord, refreshIdentityRecord: refreshIdentityRecord };
}(typeof globalThis !== 'undefined' ? globalThis : window));
