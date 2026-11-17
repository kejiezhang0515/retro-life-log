// 桌面內容層:把每個有 img 的物件(新素材 + 內容)疊在桌面底圖上,內容與子頁面同步。
// 這一層 pointer-events:none,只有 #hotspots 的按鈕接收點擊。
(function () {
  const layer = document.getElementById('desk-content');
  RL.HOTSPOTS.forEach(h => {
    const obj = RL.objects[h.id];
    if (!(h.img || h.hub) || !obj) return;
    const [l, t, w, ht] = h.box;
    const el = document.createElement('div');
    el.className = 'hub-obj';
    el.dataset.obj = h.id;
    el.style.cssText = `left:${l}%;top:${t}%;width:${w}%;height:${ht}%;` + (h.angle ? `transform:rotate(${h.angle}deg);` : '');
    layer.appendChild(el);
    obj.mount(el, { editable: false });
  });
})();
