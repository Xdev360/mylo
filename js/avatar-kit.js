/* Mylo avatar kit — layered look + color
 * Drop SVGs into assets/avatar/{layer}/{id}.svg (viewBox 0 0 80 80)
 * Register option ids below. Color tints the base via CSS mask.
 */
(function (global) {
  const ROOT = 'assets/avatar';

  /* White first: that is Mylo. The rest are tints you can choose, not a
     default anyone is handed. */
  const AVATAR_COLORS = [
    { id: 'FFFFFF', label: 'Mylo' },
    { id: 'FFF4E8', label: 'Cream' },
    { id: '5C3317', label: 'Deep' },
    { id: '8B5A2B', label: 'Brown' },
    { id: 'C68642', label: 'Warm' },
    { id: 'E0AC69', label: 'Honey' },
    { id: 'F1C27D', label: 'Sand' },
    { id: 'FFDBAC', label: 'Light' },
    { id: 'C8381E', label: 'Mylo red' },
    { id: 'E85D4C', label: 'Coral' },
    { id: '5AA9D6', label: 'Sky' },
    { id: '5EC48A', label: 'Mint' },
    { id: '8B5CF6', label: 'Violet' },
    { id: 'EC4899', label: 'Pink' },
    { id: '171717', label: 'Ink' },
    { id: 'F5C542', label: 'Gold' }
  ];

  const AVATAR_KIT = {
    version: 2,
    viewBox: '0 0 80 80',
    colors: AVATAR_COLORS,
    defaultColor: 'FFFFFF',
    tabs: [
      { id: 'body', label: 'Body', cats: ['color', 'base'] },
      { id: 'face', label: 'Face', cats: ['eyes', 'mouth', 'accessories'] }
    ],
    layers: [
      {
        id: 'base',
        label: 'Body',
        icon: 'body',
        tab: 'body',
        required: true,
        default: 'default',
        options: [
          { id: 'default', label: 'Classic' }
        ]
      },
      {
        id: 'eyes',
        label: 'Eyes',
        icon: 'eyes',
        tab: 'face',
        required: true,
        default: 'default',
        options: [
          { id: 'default', label: 'Mylo' },
          { id: 'round', label: 'Calm' },
          { id: 'wink', label: 'Wink' },
          { id: 'closed', label: 'Closed' },
          { id: 'squint', label: 'Squint' },
          { id: 'teary', label: 'Teary' },
          { id: 'sad', label: 'Sad' },
          { id: 'angry', label: 'Angry' }
        ]
      },
      {
        id: 'mouth',
        label: 'Mouth',
        icon: 'mouth',
        tab: 'face',
        required: true,
        default: 'straight',
        options: [
          { id: 'straight', label: 'Mylo' },
          { id: 'smile', label: 'Smile' },
          { id: 'open', label: 'Open' },
          { id: 'shocked', label: 'Shocked' },
          { id: 'frown', label: 'Frown' }
        ]
      },
      {
        id: 'accessories',
        label: 'Extras',
        icon: 'acc',
        tab: 'face',
        required: false,
        default: 'none',
        options: [
          { id: 'none', label: 'None' },
          { id: 'bow', label: 'Bow' },
          { id: 'shades', label: 'Shades' },
          { id: 'nerd', label: 'Glasses' },
          { id: 'hat', label: 'Hat' },
          { id: 'party', label: 'Party hat' },
          { id: 'crown', label: 'Crown' },
          { id: 'headset', label: 'Headset' },
          { id: 'blush', label: 'Blush' },
          { id: 'love', label: 'Love' },
          { id: 'zzz', label: 'ZZZ' }
        ]
      }
    ]
  };

  function layerById(id) {
    return AVATAR_KIT.layers.find(l => l.id === id);
  }

  function cleanHex(v) {
    const h = String(v || '').replace('#', '').toUpperCase();
    if (/^[0-9A-F]{6}$/.test(h)) return h;
    return AVATAR_KIT.defaultColor;
  }

  function defaultLook() {
    const look = { color: AVATAR_KIT.defaultColor };
    AVATAR_KIT.layers.forEach(l => { look[l.id] = l.default; });
    return look;
  }

  function normalizeLook(raw) {
    const look = defaultLook();
    if (!raw || typeof raw !== 'object') return look;
    AVATAR_KIT.layers.forEach(l => {
      const v = raw[l.id];
      if (v && l.options.some(o => o.id === v)) look[l.id] = v;
    });
    if (raw.color) look.color = cleanHex(raw.color);
    if (raw.bg) look.bg = String(raw.bg).replace('#', '').toUpperCase();
    return look;
  }

  function encodeLook(look) {
    const n = normalizeLook(look);
    return 'L2/' + AVATAR_KIT.layers.map(l => n[l.id]).join('/') + '/' + n.color;
  }

  function decodeLook(character) {
    if (!character || typeof character !== 'string') return null;
    if (character.startsWith('L2/')) {
      const parts = character.split('/');
      if (parts.length < 6) return null;
      const look = {};
      AVATAR_KIT.layers.forEach((l, i) => { look[l.id] = parts[i + 1]; });
      look.color = parts[5];
      return normalizeLook(look);
    }
    if (character.startsWith('L1/')) {
      const parts = character.split('/');
      if (parts.length < 5) return null;
      const look = {};
      AVATAR_KIT.layers.forEach((l, i) => { look[l.id] = parts[i + 1]; });
      return normalizeLook(look);
    }
    if (character.startsWith('look:v1:')) {
      try {
        return normalizeLook(JSON.parse(character.slice(8)));
      } catch (_) {
        return null;
      }
    }
    return null;
  }

  function partSrc(layerId, optionId) {
    return `${ROOT}/${layerId}/${optionId}.svg?v=20260921b`;
  }

  function lookFromProfile(p) {
    if (!p) return null;
    if (p.look && typeof p.look === 'object') return normalizeLook(p.look);
    const decoded = decodeLook(p.character);
    if (decoded) return decoded;
    return null;
  }

  function isLayered(p) {
    return !!lookFromProfile(p);
  }

  function usesLegacyChar(p) {
    if (!p) return true;
    if (p.avatar_url) return false;
    return !lookFromProfile(p);
  }

  global.AVATAR_KIT = AVATAR_KIT;
  global.AVATAR_COLORS = AVATAR_COLORS;
  global.avatarKit = {
    ROOT,
    defaultLook,
    normalizeLook,
    encodeLook,
    decodeLook,
    partSrc,
    lookFromProfile,
    isLayered,
    usesLegacyChar,
    layerById,
    cleanHex
  };
})(typeof window !== 'undefined' ? window : globalThis);
