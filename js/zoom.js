// 放大轉場:物件從首頁熱區位置「飛」到畫面中央(FLIP),同時背景變暗並虛化。
// 頁面結構:.page > .backdrop + .zoom-area > [data-flip] 物件 + [data-ui] 控制項。
RL.zoom = (function () {
  const stage = document.getElementById('stage');
  const enterDuration = 450;
  const exitDuration = 350;

  function hotRect(h) {
    const st = stage.getBoundingClientRect(), [l, t, w, ht] = h.box;
    return { left: st.left + l / 100 * st.width, top: st.top + t / 100 * st.height, width: w / 100 * st.width, height: ht / 100 * st.height };
  }
  // 讓物件(以 target 的中心為轉軸)縮回熱區的位置、傾斜角
  function pose(page, h) {
    const obj = page.querySelector('[data-flip]');
    const tgt = page.querySelector('[data-flip-target]') || obj;
    const to = tgt.getBoundingClientRect(), ob = obj.getBoundingClientRect(), from = hotRect(h);
    const tcx = to.left + to.width / 2, tcy = to.top + to.height / 2;
    const s = Math.sqrt((from.width / to.width) * (from.height / to.height));
    return {
      obj,
      origin: `${tcx - ob.left}px ${tcy - ob.top}px`,
      from: `translate(${from.left + from.width / 2 - tcx}px,${from.top + from.height / 2 - tcy}px) rotate(${h.angle || 0}deg) scale(${s})`
    };
  }
  const opts = (duration, extra) => Object.assign({ duration, easing: 'cubic-bezier(.22,.72,.24,1)', fill: 'both' }, extra);
  const done = (anims) => Promise.all(anims.map(a => a.finished.then(() => a.cancel(), () => {})));

  return {
    enter(page, h, reduced) {
      page.classList.add('active');
      const bd = page.querySelector('.backdrop');
      const ui = [...page.querySelectorAll('[data-ui]')];
      if (reduced) {
        return done([bd.animate([{ opacity: 0, backdropFilter: 'blur(0px)' }, { opacity: 1, backdropFilter: 'blur(8px)' }], { duration: 180, fill: 'both' }),
          ...[page.querySelector('.zoom-area')].map(z => z.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'both' }))]);
      }
      const p = pose(page, h);
      p.obj.style.transformOrigin = p.origin;
      const anims = [
        bd.animate([{ opacity: 0, backdropFilter: 'blur(0px)' }, { opacity: 1, backdropFilter: 'blur(8px)' }], opts(enterDuration)),
        p.obj.animate([{ transform: p.from, opacity: 0 }, { opacity: 1, offset: .3 }, { transform: 'none', opacity: 1 }], opts(enterDuration)),
        ...ui.map(u => u.animate([{ opacity: 0 }, { opacity: 0, offset: .55 }, { opacity: 1 }], opts(enterDuration)))
      ];
      return done(anims).then(() => { p.obj.style.transformOrigin = ''; });
    },
    exit(page, h, reduced) {
      const bd = page.querySelector('.backdrop');
      const ui = [...page.querySelectorAll('[data-ui]')];
      const finish = () => page.classList.remove('active');
      if (reduced) {
        return done([bd.animate([{ opacity: 1, backdropFilter: 'blur(8px)' }, { opacity: 0, backdropFilter: 'blur(0px)' }], { duration: 180, fill: 'both' }),
          page.querySelector('.zoom-area').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'both' })]).then(finish);
      }
      const p = pose(page, h);
      p.obj.style.transformOrigin = p.origin;
      const anims = [
        bd.animate([{ opacity: 1, backdropFilter: 'blur(8px)' }, { opacity: 0, backdropFilter: 'blur(0px)' }], opts(exitDuration)),
        p.obj.animate([{ transform: 'none', opacity: 1 }, { opacity: 1, offset: .7 }, { transform: p.from, opacity: 0 }], opts(exitDuration)),
        ...ui.map(u => u.animate([{ opacity: 1 }, { opacity: 0 }], opts(exitDuration * .55)))
      ];
      // 進行中先把整頁保持顯示,動畫結束才隱藏(避免閃一下)
      return Promise.all(anims.map(a => a.finished.catch(() => {}))).then(() => {
        finish(); anims.forEach(a => a.cancel()); p.obj.style.transformOrigin = '';
      });
    },
    // 直接用網址開子頁(不播動畫)
    instant(page) { page.classList.add('active'); }
  };
})();
