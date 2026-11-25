import { applyToDocument, t } from '../core/i18n.js';
import { STAR } from '../core/labels.js';
import { BUNDLES } from '../locales/index.js';

/** Mount the collection once and keep its cards in place across UI updates. */
export function mountHome(document, manifests, progress) {
  const $ = selector => document.querySelector(selector);
  const grid = $('#game-grid');
  const template = $('#game-card-template');
  const search = $('#search');
  const filters = document.querySelectorAll('[data-filter]');
  const count = $('#game-count');
  const empty = $('#empty-state');
  const completedLabel = $('#completed-label');
  const starCount = $('#star-count');
  const cards = new Map();
  const totalLevels = manifests.reduce((total, manifest) => total + manifest.levelCount, 0);
  const totalStars = totalLevels * STAR.MAX;
  let filter = 'all';

  grid.replaceChildren();
  for (const manifest of manifests) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.game = manifest.id;
    node.dataset.category = manifest.category;
    node.querySelector('.new-badge').hidden = !manifest.isNew;
    node.dataset.name = [
      ...Object.values(BUNDLES).map(bundle => bundle[manifest.titleKey]).filter(Boolean),
      manifest.id, manifest.category, ...(manifest.tags ?? []),
    ].join(' ').toLowerCase();
    node.querySelector('.card-body p').dataset.i18n = manifest.taglineKey;
    const buttons = node.querySelectorAll('[data-open]');
    for (const button of buttons) button.dataset.open = manifest.id;
    node.querySelector('.card-art').style.setProperty('--accent', manifest.theme?.accent ?? '#88898c');
    const preview = node.querySelector('.card-preview');
    if (manifest.preview) preview.setAttribute('src', manifest.preview);
    else preview.hidden = true;
    cards.set(manifest.id, {
      manifest, node, buttons,
      number: node.querySelector('.card-number'),
      title: node.querySelector('h3'),
      meta: node.querySelector('.card-footer > span'),
      badge: node.querySelector('.badge'),
      bar: node.querySelector('.card-progress i'),
    });
    grid.append(node);
  }

  function applyFilter() {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    for (const { node, manifest } of cards.values()) {
      const matches = (filter === 'all' || manifest.category === filter) && node.dataset.name.includes(query);
      node.hidden = !matches;
      if (matches) visible++;
    }
    count.textContent = String(visible).padStart(2, '0');
    empty.hidden = visible > 0;
  }

  for (const button of filters) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    button.addEventListener('click', () => {
      filter = button.dataset.filter;
      for (const other of filters) {
        other.classList.toggle('active', other === button);
        other.setAttribute('aria-pressed', String(other === button));
      }
      applyFilter();
    });
  }
  search.addEventListener('input', applyFilter);

  function renderCardProgress(id) {
    const { badge, bar, manifest } = cards.get(id);
    const cleared = progress[id].filter(record => record.stars > 0).length;
    const total = manifest.levelCount;
    bar.style.width = `${cleared / total * 100}%`;
    badge.dataset.i18nParams = `n:${cleared},total:${total}`;
    badge.textContent = t('progress.levels', { n: cleared, total });
  }

  function renderTotals() {
    let cleared = 0;
    let stars = 0;
    for (const records of Object.values(progress)) {
      if (records.every(record => record.stars > 0)) cleared++;
      for (const record of records) stars += record.stars;
    }
    completedLabel.dataset.i18nParams = `n:${cleared},total:${manifests.length}`;
    completedLabel.innerHTML = t('progress.completed', {
      n: `<strong id="completed-count">${cleared}</strong>`, total: manifests.length,
    });
    starCount.textContent = t('progress.stars', { n: stars, total: totalStars });
  }

  function translate() {
    for (const { manifest, number, title, meta, buttons } of cards.values()) {
      const name = t(manifest.titleKey);
      number.textContent = `${manifest.order ?? '—'} / ${t(`nav.${manifest.category}`)}`;
      title.textContent = name;
      meta.textContent = manifest.cardMetaKey ? t(manifest.cardMetaKey) : '';
      const label = t(manifest.artLabelKey ?? 'home.cardArtLabel', { title: name });
      for (const button of buttons) button.setAttribute('aria-label', label);
    }
    renderTotals();
  }

  const gameCount = String(manifests.length).padStart(2, '0');
  $('#nav-game-count').textContent = gameCount;
  $('#library-game-count').textContent = gameCount;
  $('#library-level-count').textContent = totalLevels;
  $('#library-star-count').textContent = totalStars;
  const footer = $('#footer-year');
  if (footer) {
    const year = new Date().getFullYear();
    footer.dataset.i18nParams = `year:${year}`;
    footer.textContent = t('app.footerCopyright', { year });
  }
  for (const id of cards.keys()) renderCardProgress(id);
  applyToDocument(grid);
  applyFilter();
  translate();

  return {
    translate,
    updateProgress(id) {
      renderCardProgress(id);
      renderTotals();
    },
  };
}
