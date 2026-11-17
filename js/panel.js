// 共用元件:右側滑出面板(RL.createSidePanel)與素材面板(RL.createLibraryPanel:分頁 相框 / 貼紙 / 文字)。
(function () {
  let uid = 0;

  // 面板外殼:標題 + 收合鈕 + 內容區。收合後在右緣出現「展開」分頁鈕。
  RL.createSidePanel = function (page, { title }) {
    const id = 'sp' + (++uid);
    const aside = document.createElement('aside');
    aside.className = 'side-panel';
    aside.setAttribute('aria-label', title);
    aside.innerHTML = `<header class="sp-head"><h2>${title}</h2>` +
      `<button type="button" class="btn sp-toggle" aria-expanded="false" aria-controls="${id}">收合面板 ›</button></header>` +
      `<div class="sp-body" id="${id}"></div>`;
    const tab = document.createElement('button');
    tab.type = 'button'; tab.className = 'btn sp-tab'; tab.hidden = true;
    tab.textContent = '‹ ' + title;
    page.appendChild(aside); page.appendChild(tab);

    const toggleBtn = aside.querySelector('.sp-toggle');
    const api = {
      el: aside, body: aside.querySelector('.sp-body'), isOpen: false,
      open() {
        aside.classList.add('open'); aside.inert = false; tab.hidden = true;
        toggleBtn.setAttribute('aria-expanded', 'true'); api.isOpen = true;
      },
      close() {
        aside.classList.remove('open'); aside.inert = true;
        toggleBtn.setAttribute('aria-expanded', 'false'); api.isOpen = false;
      },
      // 使用者自己收合時才顯示「展開」分頁
      collapse() { api.close(); tab.hidden = false; tab.focus(); },
      reset() { api.close(); tab.hidden = true; }
    };
    aside.inert = true;
    toggleBtn.addEventListener('click', api.collapse);
    tab.addEventListener('click', () => { api.open(); const f = aside.querySelector('textarea,button:not(.sp-toggle),input'); f && f.focus(); });
    return api;
  };

  // 素材面板:分頁「相框 / 貼紙 / 文字」+ 已選物件工具(上移、下移、刪除、換照片、字型與顏色)。
  // opts.tabs:要顯示的分頁(月曆隱藏相框、剪貼板隱藏文字);opts.target():新增素材時要放進哪個擺放層。
  RL.createLibraryPanel = function (page, { title, tabs, target, footer }) {
    const sp = RL.createSidePanel(page, { title });
    const NAMES = { frame: '相框', sticker: '貼紙', text: '文字' };
    const body = sp.body; body.classList.add('lib-body');
    const tl = document.createElement('div'); tl.className = 'lib-tabs'; tl.setAttribute('role', 'tablist');
    const panes = {};
    const prefs = { font: 'hand', color: 'ink' };               // 新增文字時使用的字型 / 顏色
    tabs.forEach((t, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'lib-tab'; b.setAttribute('role', 'tab'); b.dataset.tab = t;
      b.textContent = NAMES[t]; tl.appendChild(b);
      const pane = document.createElement('div'); pane.className = 'lib-pane'; pane.setAttribute('role', 'tabpanel'); panes[t] = pane;
      b.addEventListener('click', () => show(t));
      if (t !== 'text') {
        const grid = document.createElement('div'); grid.className = 'lib-grid';
        RL.LIBRARY.filter(l => l.type === t).forEach(l => {
          const c = document.createElement('button'); c.type = 'button'; c.className = 'lib-item'; c.title = '加到畫面中央';
          c.innerHTML = `<img src="${l.src}" alt=""><span>${l.label}</span>`;
          c.addEventListener('click', () => {
            const pl = target(); if (!pl) return;
            pl.add({ type: l.type, lib: l.id, x: 50, y: 50, w: l.w, rot: 0, photo: null });
          });
          grid.appendChild(c);
        });
        pane.appendChild(grid);
      } else {
        const add = document.createElement('button'); add.type = 'button'; add.className = 'btn lib-addtext'; add.textContent = '＋ 新增文字';
        add.addEventListener('click', () => {
          const pl = target(); if (!pl) return;
          const it = pl.add({ type: 'text', text: '雙擊編輯', x: 50, y: 50, w: 40, rot: 0, fs: 5, font: prefs.font, color: prefs.color });
          setTimeout(() => pl.startEdit(it.id), 0);
        });
        pane.appendChild(add);
        pane.appendChild(Object.assign(document.createElement('p'), { className: 'sp-hint', textContent: '可新增多個文字。雙擊文字編輯;拖曳四角調整字級。' }));
      }
      if (i === 0) b.classList.add('on');
    });
    body.appendChild(tl);
    tabs.forEach(t => body.appendChild(panes[t]));

    // 字型 + 顏色(文字分頁內;有選到文字時同步套用)
    const style = document.createElement('div'); style.className = 'lib-style';
    style.innerHTML = '<label class="te-label">字型</label><div class="lib-fonts"></div><label class="te-label">顏色</label><div class="lib-colors"></div>';
    const fonts = style.querySelector('.lib-fonts'), colors = style.querySelector('.lib-colors');
    RL.FONTS.forEach(f => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn lib-font'; b.dataset.f = f.id; b.textContent = f.label; b.style.fontFamily = f.stack;
      b.addEventListener('click', () => { prefs.font = f.id; const it = cur && cur.selected; if (it && it.type === 'text') cur.patch(it.id, { font: f.id }); syncStyle(); }); fonts.appendChild(b); });
    RL.COLORS.forEach(c => { const b = document.createElement('button'); b.type = 'button'; b.className = 'lib-color'; b.dataset.c = c.id; b.style.background = c.v; b.title = c.label; b.setAttribute('aria-label', c.label);
      b.addEventListener('click', () => { prefs.color = c.id; const it = cur && cur.selected; if (it && it.type === 'text') cur.patch(it.id, { color: c.v }); syncStyle(); }); colors.appendChild(b); });
    if (panes.text) panes.text.appendChild(style);

    // 已選物件工具
    const tools = document.createElement('div'); tools.className = 'lib-tools'; tools.hidden = true;
    tools.innerHTML = '<p class="te-context lib-sel"></p><div class="lib-toolrow">' +
      '<button type="button" class="btn" data-a="up">上移一層</button><button type="button" class="btn" data-a="down">下移一層</button>' +
      '<button type="button" class="btn danger" data-a="del">刪除</button></div>' +
      '<div class="lib-toolrow lib-photo" hidden><button type="button" class="btn" data-a="photo">更換照片</button><button type="button" class="btn" data-a="nophoto">移除照片</button></div>';
    body.appendChild(tools);
    const note = document.createElement('p'); note.className = 'te-note'; note.setAttribute('aria-live', 'polite'); body.appendChild(note);
    if (footer) { const f = document.createElement('p'); f.className = 'te-note lib-footer'; f.textContent = footer; body.appendChild(f); }

    let cur = null;                                              // 目前有選取物件的擺放層
    function show(t) {
      tl.querySelectorAll('.lib-tab').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
      tabs.forEach(k => { panes[k].hidden = k !== t; });
    }
    function syncStyle() {
      const it = cur && cur.selected, f = it && it.type === 'text' ? it.font : prefs.font;
      const c = it && it.type === 'text' ? (RL.COLORS.find(x => x.v === it.color) || {}).id : prefs.color;
      fonts.querySelectorAll('.lib-font').forEach(b => b.classList.toggle('on', b.dataset.f === f));
      colors.querySelectorAll('.lib-color').forEach(b => b.classList.toggle('on', b.dataset.c === c));
    }
    function onSelect(placer, item) {
      if (item) cur = placer; else if (cur === placer) cur = null;
      const it = cur && cur.selected;
      tools.hidden = !it;
      if (it) {
        tools.querySelector('.lib-sel').textContent = '已選取:' + NAMES[it.type] + '物件';
        tools.querySelector('.lib-photo').hidden = it.type !== 'frame';
        if (it.type === 'text' && panes.text) show('text');
      }
      syncStyle();
    }
    tools.addEventListener('click', e => {
      const a = e.target.dataset && e.target.dataset.a, it = cur && cur.selected; if (!a || !it) return;
      if (a === 'up') cur.move(it.id, 1); else if (a === 'down') cur.move(it.id, -1);
      else if (a === 'del') { cur.remove(it.id); }
      else if (a === 'photo') cur.choosePhoto(it.id); else if (a === 'nophoto') cur.removePhoto(it.id);
    });
    show(tabs[0]); syncStyle();
    return Object.assign(sp, {
      onSelect, setNote(t) { note.textContent = t || ''; },
      clearSelection() { if (cur) cur.select(null); cur = null; tools.hidden = true; },
      get active() { return cur; }
    });
  };
})();
