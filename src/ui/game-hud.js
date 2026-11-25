import { HUD_TONE } from '../core/enums.js';
import { TONE_CLASS } from '../core/labels.js';

/** Keep the stat nodes stable during gameplay; update only changed fields. */
export function createGameHud(document, container) {
  const slots = [];

  return fields => {
    if (slots.length !== fields.length) {
      while (slots.length > fields.length) slots.pop().node.remove();
      while (slots.length < fields.length) {
        const node = document.createElement('div');
        const label = document.createElement('small');
        const value = document.createElement('strong');
        node.append(label, value);
        container.append(node);
        slots.push({ node, label, value });
      }
      container.style.setProperty('--hud-columns', Math.min(4, Math.max(1, fields.length)));
    }

    for (let i = 0; i < fields.length; i++) {
      const { label, value, tone } = fields[i];
      const slot = slots[i];
      const toneClass = tone !== HUD_TONE.NORMAL && TONE_CLASS[tone];
      const className = toneClass ? `hud-${toneClass}` : '';
      if (slot.label.textContent !== label) slot.label.textContent = label;
      const text = String(value);
      if (slot.value.textContent !== text) slot.value.textContent = text;
      if (slot.node.className !== className) slot.node.className = className;
    }
  };
}
