// 路由(hash)+ 頁面切換,搭配 RL.zoom。
// 路由:#hub(首頁)、#todo、#daily、#photos、#month、#diary、#laptop、#vinyl
(function () {
  const body = document.body;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 'hub', busy = false, queued = null;

  const pageEl = r => document.getElementById('page-' + r);
  const hotFor = r => RL.HOTSPOTS.find(h => h.route === '#' + r);
  const parse = () => { const r = location.hash.slice(1); return RL.ROUTES[r] ? r : null; };
  const hook = (r, name, arg) => { const p = RL.pages[r]; return p && p[name] && p[name](arg); };

  // 每頁加一層暗化 + 虛化的背景
  document.querySelectorAll('.page').forEach(p => {
    const bd = document.createElement('div'); bd.className = 'backdrop'; bd.setAttribute('aria-hidden', 'true');
    p.insertBefore(bd, p.firstChild);
    // 點背景(物件以外的空白處)回首頁。防誤觸:按下與放開都必須在空白處、且幾乎沒有移動,
    // 所以拖曳 / 縮放 / 選取文字之後放開滑鼠,不會被當成「點空白」。
    const isBlank = t => t === bd || t.classList.contains('zoom-area');
    let down = null;
    p.addEventListener('pointerdown', e => { down = isBlank(e.target) ? { x: e.clientX, y: e.clientY } : null; }, true);
    p.addEventListener('click', e => {
      const ok = down && isBlank(e.target) && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6;
      down = null; if (ok) goBack();
    });
  });

  async function openPage(to, instant) {
    const el = pageEl(to);
    hook(to, 'beforeEnter');
    body.classList.add('in-sub');
    if (instant) { RL.zoom.instant(el); }
    else { await RL.zoom.enter(el, hotFor(to), reduced.matches); }
    hook(to, 'afterEnter', { instant: !!instant });
    if (!RL.pages[to] || !RL.pages[to].afterEnter) el.querySelector('.back').focus({ preventScroll: true });
  }
  async function closePage(from) {
    hook(from, 'beforeExit');
    await RL.zoom.exit(pageEl(from), hotFor(from), reduced.matches);
    body.classList.remove('in-sub'); RL.clicked = false;
    const hs = document.getElementById('hs-' + hotFor(from).id); hs && hs.focus({ preventScroll: true });
  }

  async function run(from, to) {
    busy = true; body.classList.add('busy');
    if (from === 'hub') await openPage(to);
    else if (to === 'hub') await closePage(from);
    else {                                           // 子頁 ↔ 子頁(直接改網址):快速淡入淡出
      hook(from, 'beforeExit'); pageEl(from).classList.remove('active');
      await RL.zoom.enter(pageEl(to), hotFor(to), true);
      hook(to, 'beforeEnter'); hook(to, 'afterEnter', { instant: true });
    }
    current = to; busy = false; body.classList.remove('busy');
    const q = queued; queued = null;
    if (q && q !== current) run(current, q);
  }

  // 點擊物件進入
  RL.navigate = h => { RL.lastTarget = h.id; RL.clicked = true; location.hash = h.route; };

  function onHash() {
    let r = parse();
    if (!r) { history.replaceState(null, '', '#hub'); r = 'hub'; }
    if (busy) { queued = r; return; }
    if (r !== current) run(current, r);
  }
  window.addEventListener('hashchange', onHash);

  // 初始化:不播動畫,直接顯示對應頁面
  let r0 = RL.PERSIST ? parse() : null;   // 不保存模式:重新整理一律回首頁
  if (!r0) { history.replaceState(null, '', '#hub'); r0 = 'hub'; }
  current = r0;
  if (r0 !== 'hub') openPage(r0, true);

  // 返回首頁:同一次瀏覽內走 history.back()(瀏覽器上一頁一致),否則直接改 hash
  function goBack() { if (current === 'hub') return; RL.clicked ? history.back() : (location.hash = '#hub'); }
  document.querySelectorAll('.back').forEach(b => b.addEventListener('click', goBack));
  // Esc:正在輸入文字時只結束編輯(取消焦點),沒有在編輯時才回首頁
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || current === 'hub') return;
    const a = document.activeElement;
    if (a && (a.isContentEditable || (a.matches && a.matches('textarea, input:not([type=file]):not([type=checkbox]):not([type=button])')))) { a.blur(); return; }
    goBack();
  });

  // [?] 說明
  const help = document.getElementById('help'), panel = document.getElementById('help-panel');
  help.addEventListener('click', e => { e.stopPropagation(); panel.hidden = !panel.hidden; });
  panel.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', () => { panel.hidden = true; resetConfirm(); });

  // 「清除全部資料」:需二次確認
  const clearBtn = document.getElementById('clear-all'), confirmBox = document.getElementById('clear-confirm');
  function resetConfirm() { confirmBox.hidden = true; clearBtn.hidden = false; }
  clearBtn.addEventListener('click', () => { clearBtn.hidden = true; confirmBox.hidden = false; });
  document.getElementById('clear-no').addEventListener('click', resetConfirm);
  document.getElementById('clear-yes').addEventListener('click', async () => {
    await RL.idb.clear(); RL.photos && RL.photos.reset(); RL.store.reset(); resetConfirm(); panel.hidden = true;
  });
})();
