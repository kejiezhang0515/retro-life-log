// 月曆:新素材 calendar.png + 一層自由擺放物件(相框以外:貼紙、文字);範圍 = 月曆圖片矩形。
// 圖上是 2026 年 11 月(印刷在圖上),不再有日期格。物件可以疊在印刷的日期上。
(function () {
  const page = document.getElementById('page-month');
  let panel = null, placer = null;
  RL.objects.calendar = {
    mount(el, { editable }) {
      el.classList.add('obj', 'obj-cal'); if (!editable) el.classList.add('ro');
      el.innerHTML = '<img class="obj-img" src="assets/objects/calendar.png" alt="" draggable="false">';
      const src = RL.placerSource('calendar', d => d.items);
      const pl = RL.createPlacer(el, { ...src, editable, onSelect: editable ? (p, it) => panel.onSelect(p, it) : null, onNote: editable ? t => panel.setNote(t) : null });
      return pl;
    }
  };
  panel = RL.createLibraryPanel(page, { title: '月曆素材', tabs: ['sticker', 'text'], target: () => placer });
  placer = RL.objects.calendar.mount(document.getElementById('cal-obj'), { editable: true });
  RL.pages.month = {
    afterEnter() { panel.open(); },
    beforeExit() { panel.clearSelection(); panel.reset(); }
  };
})();
