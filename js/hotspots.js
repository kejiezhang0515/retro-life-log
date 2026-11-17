// 依設定產生透明按鈕熱區(百分比定位)。hover / focus 不做發光或浮起。
(function () {
  const layer = document.getElementById('hotspots');
  const img = document.getElementById('desk');
  if (new URLSearchParams(location.search).get('debug') === '1') document.body.classList.add('debug');

  // 依圖片實際比例設定舞台長寬比
  function setAR() { if (img.naturalWidth) document.documentElement.style.setProperty('--ar', img.naturalWidth / img.naturalHeight); }
  img.complete ? setAR() : img.addEventListener('load', setAR);

  RL.HOTSPOTS.forEach((h, i) => {
    const [l, t, w, ht] = h.box;
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'hs-' + h.id;
    b.className = 'hotspot ' + (h.route ? 'route' : h.action ? 'act act-' + h.id : 'egg egg-' + h.id);
    b.dataset.label = h.label;
    b.setAttribute('aria-label', h.label);
    if (!h.route && h.id === 'plant') b.tabIndex = -1;   // 盆栽只在 hover 時搖葉子
    b.style.cssText = `left:${l}%;top:${t}%;width:${w}%;height:${ht}%;--hue:${i * 40}`;
    layer.appendChild(b);
    if (h.route) b.addEventListener('click', () => RL.navigate(h));
    else if (h.action) b.addEventListener('click', () => RL.actions[h.action] && RL.actions[h.action]());
  });
})();
