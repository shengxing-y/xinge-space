/* Shared cards and homepage-only pin/selection policy. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EntryPresentation = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const publicEntry = entry => ['work', 'art', 'life', 'music'].includes(entry.category);
  const marked = value => value === true || value === 1;
  function ordered(entries, homepage) {
    return entries.map((entry, index) => ({ entry, index })).sort((a, b) =>
      homepage ? Number(publicEntry(b.entry) && marked(b.entry.pinned)) - Number(publicEntry(a.entry) && marked(a.entry.pinned)) || a.index - b.index : a.index - b.index
    ).map(item => item.entry);
  }
  function selections(entries) {
    return entries.filter(entry => publicEntry(entry) && marked(entry.featured));
  }
  function card(entry, names) {
    const e = entry;
    const pin = publicEntry(e) && marked(e.pinned);
    const featured = publicEntry(e) && marked(e.featured);
    const badges = `${pin ? '<span class="entry-badge">置顶</span>' : ''}${featured ? '<span class="entry-badge">精选</span>' : ''}`;
    return `<article class="entry cat-${escape(e.category)}${e.image ? ' framed' : ''}" data-id="${escape(e.id)}"><button type="button" class="entry-open" aria-label="阅读：${escape(e.title)}"></button>${e.image ? `<img src="${escape(e.image)}" alt="${escape(e.title)}的附图" loading="lazy">` : ''}<div class="entry-meta"><span class="entry-category">${escape(names[e.category] || e.category)}</span><time>${escape((e.day || '').replaceAll('-', '.'))}</time></div><h3>${escape(e.title)}</h3><p>${escape(e.body || (e.category === 'music' ? '这一页，留给一段旋律。' : '这一页，留给一张图。'))}</p><div class="entry-bottom"><div class="entry-labels">${badges}<span class="tags">${escape((e.tags || '').split(/[,，]/).filter(Boolean).map(t => '# ' + t.trim()).join('　'))}</span></div>${e.audio ? `<button type="button" class="card-play" data-play="${escape(e.id)}"></button>` : ''}</div></article>`;
  }
  return { ordered, selections, card };
}));
