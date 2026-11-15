/* Mylo Chat — Figma plugin main thread
 * Shared file link (pluginData) so everyone opening this file hits the same Mylo room.
 * Each person signs into Mylo in the UI with their own account.
 */

const LINK_KEY = 'myloRoom';
const BADGE_NAME = 'Mylo Chat';

figma.showUI(__html__, { width: 360, height: 520, themeColors: true });

function readLink() {
  try {
    const raw = figma.root.getPluginData(LINK_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function writeLink(link) {
  figma.root.setPluginData(LINK_KEY, link ? JSON.stringify(link) : '');
}

async function ensureBadge(link) {
  const pages = figma.root.children;
  let badge = null;
  for (const page of pages) {
    if ('findOne' in page) {
      const hit = page.findOne((n) => n.type === 'FRAME' && n.name === BADGE_NAME);
      if (hit) {
        badge = hit;
        break;
      }
    }
  }

  const title = link?.title ? `Mylo · ${link.title}` : 'Mylo Chat';
  const sub = link?.code ? `Room ${link.code} — open plugin to chat` : 'Open plugin → link a room';

  if (!badge) {
    badge = figma.createFrame();
    badge.name = BADGE_NAME;
    badge.resize(280, 88);
    badge.fills = [{ type: 'SOLID', color: { r: 0.09, g: 0.09, b: 0.09 } }];
    badge.cornerRadius = 16;
    badge.strokes = [{ type: 'SOLID', color: { r: 0.22, g: 0.22, b: 0.22 } }];
    badge.strokeWeight = 1;
    badge.x = figma.viewport.center.x - 140;
    badge.y = figma.viewport.center.y - 44;

    const label = figma.createText();
    const subLabel = figma.createText();
    try {
      await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
      label.fontName = { family: 'Inter', style: 'Semi Bold' };
      subLabel.fontName = { family: 'Inter', style: 'Regular' };
    } catch (_) {
      await figma.loadFontAsync({ family: 'Roboto', style: 'Bold' });
      await figma.loadFontAsync({ family: 'Roboto', style: 'Regular' });
      label.fontName = { family: 'Roboto', style: 'Bold' };
      subLabel.fontName = { family: 'Roboto', style: 'Regular' };
    }
    label.characters = title;
    label.fontSize = 14;
    label.fills = [{ type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.96 } }];
    label.x = 16;
    label.y = 20;
    subLabel.characters = sub;
    subLabel.fontSize = 11;
    subLabel.fills = [{ type: 'SOLID', color: { r: 0.55, g: 0.55, b: 0.55 } }];
    subLabel.x = 16;
    subLabel.y = 48;
    badge.appendChild(label);
    badge.appendChild(subLabel);
    if (figma.currentPage) figma.currentPage.appendChild(badge);
  } else {
    const texts = badge.findAll((n) => n.type === 'TEXT');
    if (texts[0]) {
      try {
        await figma.loadFontAsync(texts[0].fontName);
        texts[0].characters = title;
      } catch (_) {}
    }
    if (texts[1]) {
      try {
        await figma.loadFontAsync(texts[1].fontName);
        texts[1].characters = sub;
      } catch (_) {}
    }
  }
  return badge;
}

figma.ui.onmessage = async (msg) => {
  if (!msg || !msg.type) return;

  if (msg.type === 'ready') {
    figma.ui.postMessage({ type: 'link', link: readLink() });
    return;
  }

  if (msg.type === 'set-link') {
    const link = msg.link || null;
    writeLink(link);
    try {
      await ensureBadge(link);
    } catch (e) {
      figma.notify(String(e?.message || e));
    }
    figma.ui.postMessage({ type: 'link', link: readLink() });
    figma.notify(link ? `Linked to Mylo room ${link.code || link.id}` : 'Unlinked Mylo room');
    return;
  }

  if (msg.type === 'place-badge') {
    try {
      await ensureBadge(readLink());
      figma.notify('Mylo Chat placed on canvas');
    } catch (e) {
      figma.notify(String(e?.message || e));
    }
    return;
  }

  if (msg.type === 'notify') {
    figma.notify(String(msg.text || ''));
    return;
  }

  if (msg.type === 'close') {
    figma.closePlugin();
  }
};
