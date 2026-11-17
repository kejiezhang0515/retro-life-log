// 筆記本:用 grabfold(MIT,js/vendor/grabfold.min.js)做翻頁。硬封面、書背在左、預設闔上。
// 從桌面點進來只放大並停在闔上的封面;抓住封面拖曳來翻開,之後同樣拖曳翻頁。
// 3 張紙共 6 面,每一面有獨立的自由擺放層(相框 / 貼紙 / 文字),物件跟著頁面翻動。右側面板在封面翻開後才出現。
(function () {
  const page = document.getElementById('page-diary');
  const bookEl = document.getElementById('nb-book'), controls = document.getElementById('nb-controls');
  const prev = document.getElementById('nb-prev'), next = document.getElementById('nb-next'), pager = document.getElementById('nb-pager');
  const SHEETS = RL.NOTEBOOK_PAGES, PAGE_W = 640, PAGE_H = 887;
  const face = ref => ref ? (ref.kind === 'front' ? 2 * ref.sheet : ref.kind === 'back' ? 2 * ref.sheet + 1 : -1) : -1;
  const placers = new Map();                                   // 面 → 目前畫在畫面上的擺放層們(同一面可能同時畫在不同位置)
  let panel = null, book = null, wasClosed = true;

  RL.objects.diary = {   // 首頁桌面上的筆記本:闔上的封面(去背後的 PNG)
    mount(el) { el.classList.add('obj', 'ro'); el.innerHTML = '<img class="obj-img" src="assets/notebook/cover.png" alt="" draggable="false">'; }
  };

  function renderPage(slot, ref) {
    const art = document.createElement('div'); art.className = 'nb-face';
    let img = null, idx = -1;
    if (ref.kind === 'cover') img = ref.face === 'outside' ? (ref.side === 'front' ? 'cover' : 'back') : (ref.side === 'front' ? 'page-left' : 'page-right');
    else { idx = face(ref); img = ref.kind === 'front' ? 'page-right' : 'page-left'; }
    art.style.backgroundImage = `url(assets/notebook/${img}.png)`;
    if (img === 'cover') art.classList.add('is-cover');
    slot.appendChild(art);
    // 折痕 / 翻頁陰影、硬封面的 shade 都畫在 slot 的外層容器上(整個矩形)。依這一面的 alpha 遮罩外層容器,
    // 陰影就不會畫到透明的地方(螺旋圈縫隙、不規則的紙邊)。
    const holder = slot.parentElement, url = `url(assets/notebook/${img}.png)`;
    if (holder) ['maskImage', 'webkitMaskImage'].forEach(k => holder.style[k] = url), ['maskSize', 'webkitMaskSize'].forEach(k => holder.style[k] = '100% 100%'),
      ['maskRepeat', 'webkitMaskRepeat'].forEach(k => holder.style[k] = 'no-repeat');
    let pl = null;
    if (idx >= 0) {
      const src = RL.placerSource('notebook', d => d.pages[idx]);
      pl = RL.createPlacer(art, { ...src, editable: true, onSelect: (p, it) => panel.onSelect(p, it), onNote: t => panel.setNote(t) });
      if (!placers.has(idx)) placers.set(idx, new Set()); placers.get(idx).add(pl);
    }
    return () => { if (holder) ['maskImage', 'webkitMaskImage', 'maskSize', 'webkitMaskSize', 'maskRepeat', 'webkitMaskRepeat'].forEach(k => holder.style[k] = ''); if (pl) { pl.destroy(); placers.get(idx).delete(pl); } art.remove(); };
  }

  // 新增素材時放進「畫面上看得到」的那一面:先右頁、再左頁(以 elementFromPoint 判斷哪個擺放層真的在最上面)
  function target() {
    const v = book.view;
    for (const ref of [v.right, v.left]) {
      const set = placers.get(face(ref)); if (!set) continue;
      for (const pl of set) {
        const r = pl.el.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (e && pl.el.contains(e)) return pl;
      }
    }
    return null;
  }
  panel = RL.createLibraryPanel(page, { title: '筆記本素材', tabs: ['frame', 'sticker', 'text'], target, footer: 'Page turns by grabfold' });

  const refText = ref => !ref ? '' : ref.kind === 'cover' ? (ref.face === 'inside' ? '內封面' : ref.side === 'front' ? '封面' : '封底') : `第 ${face(ref) + 1} 面`;
  function update() {
    const v = book.view, closed = (v.right && v.right.kind === 'cover' && v.right.face === 'outside') || (v.left && v.left.kind === 'cover' && v.left.face === 'outside');
    prev.disabled = !book.canPrev(); next.disabled = !book.canNext();
    pager.textContent = closed ? '抓住封面拖曳來翻開' : [refText(v.left), refText(v.right)].filter(Boolean).join(' ｜ ');
    if (closed) { panel.clearSelection(); panel.reset(); wasClosed = true; } else if (wasClosed) { wasClosed = false; panel.open(); }   // 封面翻開後面板才出現
  }
  const Grab = window.GrabfoldLib.Grabfold;
  book = new Grab(bookEl, {
    sheets: SHEETS, covers: 'hard', binding: 'left', layout: 'spread', pageRatio: PAGE_W / PAGE_H, fit: 'width',
    render: renderPage, label: '筆記本', shadow: 0.3, gutter: 0, thickness: 0,
    onTurnStart: () => panel.clearSelection(), onTurn: update, onLayoutChange: update
  });
  book.on && book.on('change', update);
  update();
  prev.addEventListener('click', () => book.prev());
  next.addEventListener('click', () => book.next());
  RL.notebookBook = book;     // 方便除錯

  RL.pages.diary = {
    beforeExit() { panel.clearSelection(); panel.reset(); book.jumpTo(book.bounds.first); update(); },
    beforeEnter() { if (book.position !== book.bounds.first) { book.jumpTo(book.bounds.first); update(); } }
  };
})();
