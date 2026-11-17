// 剪貼板:軟木板上的自由擺放物件(相框、貼紙)。初始有 5 個預設相框(照片窗口是空的),可自由移動、刪除、新增。
// 範圍 = 軟木板區域。首頁桌面上疊的是同一份資料的唯讀版。
(function () {
  const page = document.getElementById('page-photos');
  let panel = null, placer = null;
  // 軟木板內緣相對於整張板的位置(%,與桌面底圖烤進去的軟木板對齊)
  const IN = RL.CORK_INSET;
  RL.objects.photos = {
    mount(el, { editable }) {
      el.classList.add('obj', 'obj-board'); if (!editable) el.classList.add('ro');
      let host = el;
      if (editable) {
        el.innerHTML = '<div class="board-cork"></div>';
      } else {
        host = document.createElement('div'); host.className = 'cork-in';
        host.style.cssText = `left:${IN.l}%;right:${IN.r}%;top:${IN.t}%;bottom:${IN.b}%`;
        el.appendChild(host);
      }
      const src = RL.placerSource('clipboard', d => d.items);
      return RL.createPlacer(editable ? el.firstChild : host, { ...src, editable, onSelect: editable ? (p, it) => panel.onSelect(p, it) : null, onNote: editable ? t => panel.setNote(t) : null });
    }
  };
  panel = RL.createLibraryPanel(page, { title: '剪貼板素材', tabs: ['frame', 'sticker'], target: () => placer });
  placer = RL.objects.photos.mount(document.getElementById('board-obj'), { editable: true });
  RL.pages.photos = {
    afterEnter() { panel.open(); },
    beforeExit() { panel.clearSelection(); panel.reset(); }
  };
})();
