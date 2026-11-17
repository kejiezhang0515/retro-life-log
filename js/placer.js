// 共用「自由擺放物件」元件:相框、貼紙、文字。用在月曆、剪貼板、筆記本各頁。
// RL.createPlacer(host, { get, mutate, subscribe, editable, onSelect })
//   get():目前的物件陣列;mutate(fn):fn(arr) 就地修改後存入 RL.store;subscribe(fn):資料變動時呼叫 fn,回傳取消函式
// 位置與大小一律是佔擺放層寬高的 %;文字字級用 cqw(擺放層寬的 %),所以首頁縮小版與放大版一致。
(function () {
  // ── 照片:縮到長邊 ≤1600px 後存 IndexedDB,object URL 快取共用 ──
  const cache = new Map();
  RL.photos = {
    ensure(key) {
      const v = cache.get(key); if (v) return Promise.resolve(v);
      const p = RL.idb.get(key).then(b => { if (!b) { cache.delete(key); return null; } const u = URL.createObjectURL(b); cache.set(key, u); return u; });
      cache.set(key, p); return p;
    },
    async save(file) {
      const bmp = await new Promise((res, rej) => {
        const u = URL.createObjectURL(file), im = new Image();
        im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('decode')); }; im.src = u;
      });
      const s = Math.min(1, 1600 / Math.max(bmp.naturalWidth, bmp.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.naturalWidth * s); c.height = Math.round(bmp.naturalHeight * s);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('encode')), 'image/jpeg', 0.9));
      const key = 'photo:' + RL.uid();
      const persisted = await RL.idb.put(key, blob);
      cache.set(key, URL.createObjectURL(blob));
      return { key, persisted };
    },
    release(key) { const v = cache.get(key); if (typeof v === 'string') URL.revokeObjectURL(v); cache.delete(key); RL.idb.del(key); },
    reset() { cache.forEach(v => { if (typeof v === 'string') URL.revokeObjectURL(v); }); cache.clear(); }
  };
  // 某個照片是否還有物件在用(所有擺放層)
  const photoInUse = key => {
    const st = RL.store, hit = a => (a || []).some(i => i.photo === key);
    return hit(st.get('calendar').items) || hit(st.get('clipboard').items) || st.get('notebook').pages.some(hit);
  };
  RL.photos.gc = key => { if (key && !photoInUse(key)) RL.photos.release(key); };

  // 選圖對話框(整頁共用一個 input)
  let picker = null;
  RL.pickImage = function (cb) {
    if (!picker) {
      picker = document.createElement('input'); picker.type = 'file'; picker.accept = 'image/*'; picker.className = 'sr-only'; picker.tabIndex = -1;
      picker.setAttribute('aria-hidden', 'true'); document.body.appendChild(picker);
    }
    picker.onchange = () => { const f = picker.files && picker.files[0]; picker.value = ''; if (f) cb(f); };
    picker.click();
  };

  const h = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  RL.createPlacer = function (host, opts) {
    const editable = !!opts.editable;
    const layer = h('div', 'pi-layer' + (editable ? ' editable' : ''));
    host.appendChild(layer);
    const nodes = new Map();
    let sel = null, drag = null, editingId = null, lastTap = { id: null, t: 0 };

    const find = id => opts.get().find(i => i.id === id);
    const patch = (id, p) => opts.mutate(arr => { const it = arr.find(i => i.id === id); if (it) Object.assign(it, p); });

    function build(it) {
      const el = h('div', 'pi pi-' + it.type); el.dataset.id = it.id;
      const n = { el, photoKey: undefined };
      if (it.type === 'frame') {
        const lib = RL.libById(it.lib) || RL.LIBRARY[0], w = lib.window;
        const ph = h('div', 'pi-photo'); ph.style.cssText = `left:${w[0]}%;top:${w[1]}%;width:${w[2]}%;height:${w[3]}%`;
        n.img = h('img'); n.img.alt = ''; n.img.draggable = false; n.img.hidden = true; ph.appendChild(n.img);
        if (editable) { n.hint = h('em'); n.hint.textContent = '點一下選照片'; ph.appendChild(n.hint); }
        const art = h('img', 'pi-art'); art.src = lib.src; art.alt = ''; art.draggable = false;
        el.append(ph, art); el.style.aspectRatio = lib.ratio;
      } else if (it.type === 'sticker') {
        const lib = RL.libById(it.lib) || RL.LIBRARY[1];
        const art = h('img', 'pi-art'); art.src = lib.src; art.alt = ''; art.draggable = false; el.appendChild(art); el.style.aspectRatio = lib.ratio;
      } else {
        n.txt = h('div', 'pi-text');
        el.appendChild(n.txt);
      }
      if (editable) {
        const ui = h('div', 'pi-ui');
        ['nw', 'ne', 'sw', 'se'].forEach(k => { const b = h('span', 'pi-h pi-h-' + k); b.dataset.h = k; ui.appendChild(b); });
        const stem = h('span', 'pi-stem'), rot = h('span', 'pi-h pi-rot'); rot.dataset.h = 'rot'; ui.append(stem, rot);
        el.appendChild(ui);
        el.addEventListener('pointerdown', e => onDown(e, it.id));
        el.addEventListener('keydown', e => onKey(e, it.id));
        el.tabIndex = 0;
      }
      return n;
    }
    function apply(n, it) {
      const s = n.el.style;
      s.left = it.x + '%'; s.top = it.y + '%'; s.width = it.w + '%'; s.transform = `translate(-50%,-50%) rotate(${it.rot || 0}deg)`;
      if (it.type === 'frame') {
        if (it.photo !== n.photoKey) {
          n.photoKey = it.photo;
          if (it.photo) { const k = it.photo; RL.photos.ensure(k).then(u => { if (n.photoKey === k && u) { n.img.src = u; n.img.hidden = false; } }); }
          else { n.img.hidden = true; n.img.removeAttribute('src'); }
        }
        if (n.hint) n.hint.hidden = !!it.photo;
      } else if (it.type === 'text') {
        const t = n.txt.style; t.fontSize = (it.fs || 5) + 'cqw'; t.color = it.color || RL.COLORS[0].v; t.fontFamily = RL.fontStack(it.font);
        if (editingId !== it.id && n.txt.textContent !== it.text) n.txt.textContent = it.text || '';
      }
    }
    function render() {
      const items = opts.get(), seen = new Set();
      items.slice().sort((a, b) => a.z - b.z).forEach((it, i) => {
        let n = nodes.get(it.id);
        if (!n) { n = build(it); nodes.set(it.id, n); layer.appendChild(n.el); }
        if (!(drag && drag.id === it.id && drag.moved)) apply(n, it);
        n.el.style.zIndex = i + 1; seen.add(it.id);
      });
      nodes.forEach((n, id) => { if (!seen.has(id)) { n.el.remove(); nodes.delete(id); if (sel === id) { sel = null; opts.onSelect && opts.onSelect(api, null); } } });
      nodes.forEach((n, id) => n.el.classList.toggle('sel', id === sel));
    }
    const unsub = opts.subscribe(render);
    render();

    // ── 選取 ──
    function select(id) {
      if (sel === id) return; sel = id; nodes.forEach((n, k) => n.el.classList.toggle('sel', k === id));
      opts.onSelect && opts.onSelect(api, id ? find(id) : null);
    }
    // ── 拖曳 / 縮放 / 旋轉(pointer events,滑鼠與觸控通用)──
    function onDown(e, id) {
      if (e.button > 0 || editingId === id) return;
      const it = find(id); if (!it) return;
      const hd = e.target.dataset && e.target.dataset.h;
      select(id);
      const rect = layer.getBoundingClientRect();
      const cx = rect.left + it.x / 100 * rect.width, cy = rect.top + it.y / 100 * rect.height;
      drag = { id, kind: hd || 'move', sx: e.clientX, sy: e.clientY, it0: { ...it }, rect, cx, cy,
               d0: Math.hypot(e.clientX - cx, e.clientY - cy) || 1, moved: false, cur: null };
      e.preventDefault(); e.stopPropagation();
      window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
    }
    function onMove(e) {
      if (!drag) return;
      const d = drag, n = nodes.get(d.id), it0 = d.it0;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
      if (!d.moved) n.el.classList.add('is-dragging');
      d.moved = true;
      const cur = { x: it0.x, y: it0.y, w: it0.w, rot: it0.rot || 0, fs: it0.fs };
      if (d.kind === 'move') {
        cur.x = clamp(it0.x + (e.clientX - d.sx) / d.rect.width * 100, 0, 100);      // 中心不可離開範圍
        cur.y = clamp(it0.y + (e.clientY - d.sy) / d.rect.height * 100, 0, 100);
      } else if (d.kind === 'rot') {
        let a = Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180 / Math.PI + 90;
        if (e.shiftKey) a = Math.round(a / 15) * 15;
        cur.rot = Math.round(((a + 540) % 360 - 180) * 10) / 10;
      } else {
        const s = Math.hypot(e.clientX - d.cx, e.clientY - d.cy) / d.d0;
        cur.w = clamp(it0.w * s, 4, 100); if (it0.type === 'text') cur.fs = clamp(it0.fs * cur.w / it0.w, 1, 40);
      }
      d.cur = cur;
      const st = n.el.style; st.left = cur.x + '%'; st.top = cur.y + '%'; st.width = cur.w + '%'; st.transform = `translate(-50%,-50%) rotate(${cur.rot}deg)`;
      if (it0.type === 'text') n.txt.style.fontSize = cur.fs + 'cqw';
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
      const d = drag; drag = null; if (!d) return;
      if (d.moved && d.cur) { const n = nodes.get(d.id); if (n) n.el.classList.remove('is-dragging'); patch(d.id, d.cur); return; }
      // 沒有移動 = 點擊
      const it = find(d.id); if (!it || d.kind !== 'move') return;
      if (it.type === 'frame' && !it.photo) choosePhoto(it.id);
      else if (it.type === 'text') {
        const now = Date.now();
        if (lastTap.id === it.id && now - lastTap.t < 380) { startEdit(it.id); lastTap = { id: null, t: 0 }; } else lastTap = { id: it.id, t: now };
      }
    }
    layer.addEventListener('pointerdown', e => { if (e.target === layer) select(null); });
    layer.addEventListener('dblclick', e => { const el = e.target.closest && e.target.closest('.pi-text'); if (el) startEdit(el.parentNode.dataset.id); });

    // ── 文字編輯(中文輸入法組字期間不寫回,避免打斷)──
    function startEdit(id) {
      const n = nodes.get(id); if (!n || !n.txt || editingId) return;
      editingId = id; select(id);
      n.el.classList.add('editing'); n.el.tabIndex = -1;
      n.txt.contentEditable = 'plaintext-only'; if (n.txt.contentEditable !== 'plaintext-only') n.txt.contentEditable = 'true';
      n.txt.focus();
      const r = document.createRange(); r.selectNodeContents(n.txt); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      const commit = () => { if (n.txt.isConnected) { const t = n.txt.innerText.replace(/\n+$/, ''); patch(id, { text: t }); } };
      const onInput = e => { if (!e.isComposing) commit(); };
      const onBlur = () => {
        n.txt.removeEventListener('input', onInput); n.txt.removeEventListener('blur', onBlur); n.txt.removeEventListener('compositionend', commit);
        const t = n.txt.innerText.replace(/\n+$/, '');
        n.txt.contentEditable = 'false'; n.el.classList.remove('editing'); n.el.tabIndex = 0; editingId = null;
        if (!t.trim()) api.remove(id); else patch(id, { text: t });
      };
      n.txt.addEventListener('input', onInput); n.txt.addEventListener('blur', onBlur); n.txt.addEventListener('compositionend', commit);
    }
    // ── 鍵盤:刪除、方向鍵微調 ──
    function onKey(e, id) {
      if (editingId) return;
      const it = find(id); if (!it) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); api.remove(id); }
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault(); const k = e.shiftKey ? 3 : 0.7;
        patch(id, { x: clamp(it.x + (e.key === 'ArrowRight' ? k : e.key === 'ArrowLeft' ? -k : 0), 0, 100), y: clamp(it.y + (e.key === 'ArrowDown' ? k : e.key === 'ArrowUp' ? -k : 0), 0, 100) });
      }
    }
    function choosePhoto(id) {
      RL.pickImage(async f => {
        try {
          const { key, persisted } = await RL.photos.save(f);
          const old = (find(id) || {}).photo; patch(id, { photo: key }); RL.photos.gc(old);
          if (RL.PERSIST && !persisted && opts.onNote) opts.onNote('照片已放上,但這個瀏覽器無法保存,重新載入後會消失。');
        } catch (err) { opts.onNote && opts.onNote('這張照片無法讀取(可能是不支援的格式),請換一張 jpg / png。'); }
      });
    }

    const api = {
      el: layer,
      get selected() { return sel ? find(sel) : null; },
      select, choosePhoto, startEdit,
      add(it) {
        const arr = opts.get(); it.id = RL.uid(); it.z = arr.reduce((m, i) => Math.max(m, i.z), 0) + 1;
        opts.mutate(a => { a.push(it); }); select(it.id); return it;
      },
      patch,
      remove(id) {
        const it = find(id); if (!it) return;
        opts.mutate(a => { a.splice(a.findIndex(i => i.id === id), 1); });
        if (it.photo) RL.photos.gc(it.photo);
      },
      removePhoto(id) { const it = find(id); if (it && it.photo) { patch(id, { photo: null }); RL.photos.gc(it.photo); } },
      // 上移 / 下移圖層:與相鄰物件交換 z
      move(id, dir) {
        opts.mutate(a => {
          const s = a.slice().sort((x, y) => x.z - y.z), i = s.findIndex(x => x.id === id), j = i + dir;
          if (i < 0 || j < 0 || j >= s.length) return; const t = s[i].z; s[i].z = s[j].z; s[j].z = t;
        });
      },
      destroy() { unsub(); layer.remove(); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); }
    };
    return api;
  };

  // 以 store 的某個 key / 陣列取得函式建立 opts(給月曆、剪貼板、筆記本共用)
  RL.placerSource = function (key, pick /* (data)=>array */) {
    return {
      get: () => pick(RL.store.get(key)),
      mutate: fn => RL.store.update(key, d => fn(pick(d))),
      subscribe: fn => RL.store.subscribe(key, fn)
    };
  };
})();
