// 盆栽:hover 時只有每片葉子各自擺動(盆與枝幹在底圖上不動)。
// 葉片是 assets/plant/leaf-XX.png 獨立圖層,位置與參數見 js/plant-leaves.js(由 tools/make_plant_leaves.py 產生)。
(function () {
  const box = document.getElementById('plant-leaves');
  const hot = document.getElementById('hs-plant');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const imgs = (RL.PLANT_LEAVES || []).map(d => {
    const el = document.createElement('img');
    el.src = d.src; el.alt = ''; el.draggable = false;
    el.style.cssText = `position:absolute;left:${d.box[0]}%;top:${d.box[1]}%;width:${d.box[2]}%;` +
      `transform-origin:${d.pivot[0]}% ${d.pivot[1]}%;pointer-events:none;user-select:none`;
    box.appendChild(el);
    return { el, d };
  });

  let playing = false;
  function sway() {
    if (playing || reduced.matches) return;
    playing = true;
    const anims = imgs.map(({ el, d }) => {
      const a = d.amp;
      return el.animate([
        { transform: 'rotate(0deg)' },
        { transform: `rotate(${a}deg)`, offset: .24 },
        { transform: `rotate(${-a * .7}deg)`, offset: .5 },
        { transform: `rotate(${a * .4}deg)`, offset: .78 },
        { transform: 'rotate(0deg)' }
      ], { duration: d.dur * 1000, delay: d.delay * 1000, easing: 'ease-in-out' });
    });
    Promise.all(anims.map(x => x.finished.catch(() => {}))).then(() => { playing = false; });
  }
  hot.addEventListener('mouseenter', sway);
})();
