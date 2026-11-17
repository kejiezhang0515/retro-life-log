// to-do list 與 daily plan:新素材圖就是紙張本身,文字欄位用百分比 / cqw 疊在圖上,
// 所以首頁縮小版與放大版看起來一致。兩張紙內容各自獨立,都存進 RL.store。
(function () {
  const h = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const pct = (v, total) => (v / total * 100).toFixed(4) + '%';
  const cq = (v, total) => (v / total * 100).toFixed(4) + 'cqw';       // 以物件寬為 100cqw
  const two = n => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return two(d.getMonth() + 1) + '/' + two(d.getDate()); };

  // ── to-do list ──
  RL.objects.todo = {
    mount(el, { editable }) {
      const T = RL.TODO;
      el.classList.add('obj', 'obj-todo'); if (!editable) el.classList.add('ro');
      el.innerHTML = '<img class="obj-img" src="assets/objects/todo.png" alt="" draggable="false">';
      const rows = [];
      for (let i = 0; i < T.rows; i++) {
        const row = h('div', 'todo-row');
        row.style.cssText = `top:${pct(T.top + i * T.pitch, T.h)};height:${pct(T.pitch, T.h)}`;
        const box = h(editable ? 'button' : 'span', 'todo-box');
        box.style.cssText = `left:${pct(T.boxX, T.w)};top:${pct(T.boxY, T.pitch)};width:${pct(T.boxSize, T.w)};aspect-ratio:1`;
        box.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M18 54 L40 78 L84 22"/></svg>';
        let txt;
        if (editable) {
          box.type = 'button'; box.setAttribute('role', 'checkbox'); box.setAttribute('aria-label', `第 ${i + 1} 項:完成`);
          txt = h('input', 'todo-text'); txt.type = 'text'; txt.maxLength = 40; txt.spellcheck = false;
          txt.setAttribute('aria-label', `to-do 第 ${i + 1} 項`);
          txt.addEventListener('input', () => RL.store.update('todo', d => { d.items[i].t = txt.value; }));
          txt.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); const n = rows[i + 1]; n && n.txt.focus(); }
          });
          box.addEventListener('click', () => RL.store.update('todo', d => { d.items[i].d = !d.items[i].d; }));
        } else txt = h('div', 'todo-text');
        txt.style.cssText = `left:${pct(T.textX, T.w)};width:${pct(T.textW, T.w)}`;
        row.append(box, txt); el.appendChild(row); rows.push({ row, box, txt });
      }
      function update() {
        const items = RL.store.get('todo').items;
        rows.forEach((r, i) => {
          const it = items[i];
          if (editable) { if (r.txt.value !== it.t) r.txt.value = it.t; r.box.setAttribute('aria-checked', it.d); }
          else r.txt.textContent = it.t;
          r.row.classList.toggle('done', it.d);
        });
      }
      RL.store.subscribe('todo', update); update();
      return { update, focus() { const f = rows.find(r => !r.txt.value) || rows[0]; f.txt.focus({ preventScroll: true }); } };
    }
  };

  // ── daily plan ──
  RL.objects.daily = {
    mount(el, { editable }) {
      const D = RL.DAILY;
      el.classList.add('obj', 'obj-daily'); if (!editable) el.classList.add('ro');
      el.innerHTML = '<img class="obj-img" src="assets/objects/daily.png" alt="" draggable="false">';
      const dt = h(editable ? 'input' : 'div', 'daily-date');
      dt.style.cssText = `left:${pct(D.date[0], D.w)};top:${pct(D.date[1], D.h)};width:${pct(D.date[2], D.w)};height:${pct(D.date[3], D.h)}`;
      const body = h(editable ? 'textarea' : 'div', 'daily-text');
      body.style.cssText = `left:${pct(D.x0, D.w)};top:${pct(D.firstRule - D.pitch, D.h)};width:${pct(D.x1 - D.x0, D.w)};height:${pct(D.pitch * D.lines, D.h)};` +
        `line-height:${cq(D.pitch, D.w)}`;
      el.append(dt, body);
      if (editable) {
        dt.type = 'text'; dt.maxLength = 5; dt.spellcheck = false; dt.setAttribute('aria-label', '日期(MM/DD)');
        body.spellcheck = false; body.setAttribute('aria-label', 'daily plan 內容');
        dt.addEventListener('input', () => RL.store.update('daily', d => { d.date = dt.value; }));
        dt.addEventListener('blur', () => { if (!dt.value.trim()) RL.store.update('daily', d => { d.date = null; }); });   // 清空 = 回到自動當天日期
        // 最多 12 行:超過就退回上一個內容(組字期間不檢查,避免中斷輸入法)
        let last = RL.store.get('daily').text;
        const check = () => {
          if (body.scrollHeight > body.clientHeight + 2) { body.value = last; }
          last = body.value; RL.store.update('daily', d => { d.text = body.value; });
        };
        body.addEventListener('input', e => { if (!e.isComposing) check(); });
        body.addEventListener('compositionend', check);
      }
      function update() {
        const d = RL.store.get('daily'), date = d.date == null ? today() : d.date;
        if (editable) {
          if (document.activeElement !== dt && dt.value !== date) dt.value = date;
          if (document.activeElement !== body && body.value !== d.text) body.value = d.text;
        } else { dt.textContent = date; body.textContent = d.text; }
      }
      RL.store.subscribe('daily', update); update();
      return { update, focus() { body.focus({ preventScroll: true }); } };
    }
  };

  // 子頁面:把可編輯版本掛進 .page 裡的 [data-flip]
  const todo = RL.objects.todo.mount(document.getElementById('todo-obj'), { editable: true });
  const daily = RL.objects.daily.mount(document.getElementById('daily-obj'), { editable: true });
  RL.pages.todo = { afterEnter() { todo.focus(); } };
  RL.pages.daily = { beforeEnter() { daily.update(); }, afterEnter() { daily.focus(); } };
})();
