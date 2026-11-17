// 黑膠唱片機(純視覺,沒有任何音訊)。
// ‧ 唱片:圓形圖層疊在原位上旋轉,33⅓ 轉(約 1.8 秒一圈),啟動約 1 秒、停止約 1.5 秒(requestAnimationFrame 角速度緩動)。
// ‧ 唱臂:以軸承座圓心為軸心,pointer events 拖曳;放開時唱針落在溝槽環(內徑=中心標籤外緣、外徑=唱片邊緣)內就停在該處並開始轉,
//   落在環外就平滑回到靜止位置。把唱臂拖離唱片或拖回靜止位置,唱片減速到停。
// ‧ 右側弧形封面選單:上下滑動 / 滾輪 / 點選 / 方向鍵;選到的封面顯示在唱片中心標籤(圓形去背、跟著轉);最後一格「＋」可上傳封面(只存在這次開啟的記憶體)。
// ‧ 離開黑膠頁就停止並復位。
(function () {
  const G = RL.VINYL, W = G.w, H = G.h;
  const $ = id => document.getElementById(id);
  const rec = $('rec'), disc = $('rec-disc'), armEl = $('rec-arm'), hit = $('arm-hit'), labelImg = $('rec-label-img');
  const now = $('now'), toggle = $('arm-toggle'), arc = $('arc');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const pc = (v, t) => (v / t * 100).toFixed(4) + '%';

  // ── 圖層擺位(皆為佔唱機圖的 %,所以縮放時一致)──
  const [dbx, dby, ds] = G.discBox;
  Object.assign(disc.style, { left: pc(dbx, W), top: pc(dby, H), width: pc(ds, W), height: pc(ds, H) });
  rec.querySelector('.rec-label').style.width = pc(G.coverR * 2, ds);
  rec.querySelector('.rec-hole').style.width = pc(G.hole * 2, ds);
  Object.assign(rec.querySelector('.rec-gloss').style, { left: pc(G.disc[0] - G.disc[2], W), top: pc(G.disc[1] - G.disc[2], H), width: pc(G.disc[2] * 2, W), height: pc(G.disc[2] * 2, H) });
  // 讓 disc 的旋轉中心就是唱片圓心(disc 圖是以圓心為中心裁出來的,中心 = 50% 50%)
  const [ax, ay, aw, ah] = G.arm, [px, py] = G.pivot;
  Object.assign(armEl.style, { left: pc(ax, W), top: pc(ay, H), width: pc(aw, W), height: pc(ah, H), transformOrigin: `${pc(px - ax, aw)} ${pc(py - ay, ah)}` });
  Object.assign(hit.style, { left: pc(px - ax - 60, aw), top: pc(py - ay - 120, ah), width: pc(120, aw), height: pc(G.tip[1] - py + 150, ah) });

  // ── 幾何:唱針尖端在 φ 度時的位置、是否在溝槽環內 ──
  const rad = d => d * Math.PI / 180;
  function tipAt(phi) {
    const c = Math.cos(rad(phi)), s = Math.sin(rad(phi)), vx = G.tip[0] - px, vy = G.tip[1] - py;
    return [px + vx * c - vy * s, py + vx * s + vy * c];
  }
  const rOf = phi => { const t = tipAt(phi); return Math.hypot(t[0] - G.disc[0], t[1] - G.disc[1]); };
  const inRing = phi => { const r = rOf(phi); return r >= G.labelR && r <= G.disc[2]; };
  // 溝槽環中段的 φ(給「放下唱針」按鈕用):在 0..maxPhi 內找 r ≈ (內徑+外徑)/2
  const midPhi = (() => {
    const target = (G.labelR + G.disc[2]) / 2; let best = 0, bd = 1e9;
    for (let p = 0; p <= G.maxPhi; p += 0.25) { const d = Math.abs(rOf(p) - target); if (d < bd) { bd = d; best = p; } }
    return best;
  })();

  // ── 狀態與動畫 ──
  let phi = 0, dropped = false, dragging = false, wasPlaying = false, angle = 0, omega = 0, raf = 0, last = 0, tween = null;
  const maxOmega = () => reduce.matches ? 360 / 9 : 360 / G.rev;                 // 減少動態:慢轉(9 秒一圈)、不做加減速
  function target() { return (dragging ? (wasPlaying && inRing(phi)) : dropped) ? maxOmega() : 0; }
  function draw() { armEl.style.transform = `rotate(${phi.toFixed(3)}deg)`; disc.style.transform = `rotate(${angle.toFixed(2)}deg)`; }
  function status() {
    const playing = dropped && omega > 0.5 || (dropped && target() > 0);
    toggle.textContent = dropped ? '收回唱針' : '放下唱針';
    const c = cover(); now.textContent = (c ? `現在展示:${c.title}` : '') + (playing ? ' · 轉動中' : '');
  }
  function frame(t) {
    raf = 0; const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    const tg = target();
    if (reduce.matches) omega = tg;
    else if (omega < tg) omega = Math.min(tg, omega + maxOmega() / G.spinUp * dt);
    else if (omega > tg) omega = Math.max(tg, omega - maxOmega() / G.spinDown * dt);
    angle = (angle + omega * dt) % 360;
    if (tween) {
      const k = Math.min(1, (t - tween.t0) / tween.d), e = 1 - Math.pow(1 - k, 3);
      phi = tween.a + (tween.b - tween.a) * e;
      if (k >= 1) { const done = tween.done; tween = null; done && done(); }
    }
    draw();
    if (omega > 0 || tg > 0 || tween) raf = requestAnimationFrame(frame); else status();
  }
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  function moveArm(to, done) {
    if (reduce.matches) { phi = to; draw(); done && done(); kick(); return; }
    tween = { a: phi, b: to, t0: performance.now(), d: 420 + Math.abs(to - phi) * 6, done }; kick();
  }
  function release() {                                                         // 放開唱臂
    dragging = false; armEl.classList.remove('dragging');
    if (phi > 1.2 && inRing(phi)) dropped = true;
    else { dropped = false; if (phi !== 0) moveArm(0); }
    status(); kick();
  }

  // 拖曳:以軸承座為軸心,指標相對軸心的角度變化 = 唱臂轉動角度
  let drag = null;
  hit.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    tween = null; const r = rec.getBoundingClientRect(), k = r.width / W;
    const cx = r.left + px * k, cy = r.top + py * k;
    drag = { cx, cy, a0: Math.atan2(e.clientY - cy, e.clientX - cx), phi0: phi, id: e.pointerId };
    wasPlaying = dropped; dragging = true; dropped = false; armEl.classList.add('dragging');
    hit.setPointerCapture(e.pointerId); e.preventDefault(); kick();
  });
  hit.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    let d = (Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx) - drag.a0) * 180 / Math.PI;
    d = ((d + 540) % 360) - 180;
    phi = Math.max(0, Math.min(G.maxPhi, drag.phi0 + d)); draw(); kick();
  });
  const end = e => { if (!drag || (e && e.pointerId !== drag.id)) return; drag = null; release(); };
  hit.addEventListener('pointerup', end); hit.addEventListener('pointercancel', end);
  // 無滑鼠時的替代操作:按鈕放下 / 收回唱針
  toggle.addEventListener('click', () => {
    tween = null;
    if (dropped) { dropped = false; moveArm(0); status(); kick(); }
    else moveArm(midPhi, () => { dropped = true; status(); kick(); });
  });
  reduce.addEventListener && reduce.addEventListener('change', kick);

  // ── 弧形封面選單 ──
  const covers = RL.VINYL_COVERS.map(c => ({ ...c }));
  let sel = 0, pos = 0, anim = 0;
  const cover = () => covers[Math.min(sel, covers.length - 1)];
  const tiles = [];
  const addBtn = document.createElement('button');
  addBtn.type = 'button'; addBtn.className = 'cover cover-add'; addBtn.setAttribute('role', 'option'); addBtn.setAttribute('aria-label', '新增封面(上傳圖片)');
  addBtn.innerHTML = '<b>＋</b><span>新增封面</span>';
  function makeTile(c) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cover'; b.setAttribute('role', 'option');
    b.setAttribute('aria-label', c.title); b.innerHTML = `<img src="${c.src}" alt="" draggable="false">`; return b;
  }
  const all = () => tiles.concat([addBtn]);
  function rebuild() { arc.textContent = ''; all().forEach(t => arc.appendChild(t)); }
  covers.forEach(c => tiles.push(makeTile(c))); rebuild();

  const STEP = 9, ITEM = 100;
  function layout(p) {
    const cw = arc.clientWidth, ch = arc.clientHeight, sz = Math.min(ch * 0.27, cw * 0.62), R = ch * 0.95;
    const sx = sz / 2 + 8, cxC = sx + R, cyC = ch / 2;                        // 弧的圓心在右邊;選中的封面在弧最左側(最靠近唱機)
    all().forEach((el, i) => {
      const d = i - p, ad = Math.abs(d), a = rad(d * STEP), hide = ad > 3.4;
      const x = cxC - R * Math.cos(a), y = cyC + R * Math.sin(a), s = 1.1 - Math.min(ad, 2) * 0.07;
      el.style.width = el.style.height = sz + 'px';
      el.style.transform = `translate(${x - sz / 2}px,${y - sz / 2}px) scale(${s})`;
      el.style.opacity = hide ? 0 : 1; el.style.pointerEvents = hide ? 'none' : 'auto';
      el.style.zIndex = 100 - Math.round(ad * 10);
    });
  }
  function applySel(i) {
    sel = Math.max(0, Math.min(all().length - 1, i));
    if (sel < covers.length) labelImg.src = covers[sel].src;
    all().forEach((el, k) => { el.classList.toggle('on', k === sel); el.setAttribute('aria-selected', String(k === sel)); });
    status();
  }
  function glide(to) {                                                           // 平滑滑到某一格
    cancelAnimationFrame(anim); const from = pos, t0 = performance.now(), d = reduce.matches ? 0 : 280;
    const step = t => { const k = d ? Math.min(1, (t - t0) / d) : 1, e = 1 - Math.pow(1 - k, 3); pos = from + (to - from) * e; layout(pos); if (k < 1) anim = requestAnimationFrame(step); };
    anim = requestAnimationFrame(step); applySel(to);
  }
  const clampPos = v => Math.max(0, Math.min(all().length - 1, v));

  let down = null, dragged = false;
  arc.addEventListener('pointerdown', e => { down = { y: e.clientY, p: pos }; dragged = false; });
  arc.addEventListener('pointermove', e => {
    if (!down) return; const dy = e.clientY - down.y;
    if (!dragged && Math.abs(dy) > 6) { dragged = true; arc.setPointerCapture(e.pointerId); arc.classList.add('dragging'); cancelAnimationFrame(anim); }
    if (dragged) { pos = clampPos(down.p - dy / ITEM); layout(pos); applySel(Math.round(pos)); }
  });
  const arcEnd = () => { if (!down) return; const was = dragged; down = null; arc.classList.remove('dragging'); if (was) { glide(Math.round(pos)); setTimeout(() => { dragged = false; }, 0); } };
  arc.addEventListener('pointerup', arcEnd); arc.addEventListener('pointercancel', arcEnd);
  arc.addEventListener('wheel', e => { e.preventDefault(); cancelAnimationFrame(anim); pos = clampPos(pos + e.deltaY / 260); layout(pos); applySel(Math.round(pos)); clearTimeout(arc._w); arc._w = setTimeout(() => glide(Math.round(pos)), 140); }, { passive: false });
  arc.addEventListener('click', e => {
    if (dragged) return;
    const el = e.target.closest('.cover'); if (!el) return; const i = all().indexOf(el);
    if (el === addBtn) upload(); else glide(i);
  });
  arc.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); glide(clampPos(sel - 1)); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); glide(clampPos(sel + 1)); }
    else if ((e.key === 'Enter' || e.key === ' ') && sel === all().length - 1) { e.preventDefault(); upload(); }
  });
  function upload() {
    RL.pickImage(async f => {
      try {
        const { key } = await RL.photos.save(f), url = await RL.photos.ensure(key);
        const c = { id: key, title: f.name.replace(/\.[^.]+$/, '') || '新封面', artist: '', src: url, custom: true };
        covers.push(c); tiles.push(makeTile(c)); rebuild(); layout(pos); glide(covers.length - 1);
      } catch (err) { now.textContent = '這張圖片無法讀取(請換一張 jpg / png)。'; }
    });
  }
  new ResizeObserver(() => layout(pos)).observe(arc);
  labelImg.src = covers[0].src; applySel(0); layout(0); draw(); status();

  // 離開黑膠頁就停止並復位(回首頁不繼續轉)
  function reset() { cancelAnimationFrame(raf); raf = 0; tween = null; drag = null; dragging = false; dropped = false; omega = 0; phi = 0; armEl.classList.remove('dragging'); draw(); status(); }
  RL.pages.vinyl = { beforeExit: reset, afterEnter() { arc.focus({ preventScroll: true }); } };
  RL.vinyl = { get phi() { return phi; }, get omega() { return omega; }, get dropped() { return dropped; }, midPhi, rOf, inRing };   // 除錯 / 測試用
})();
