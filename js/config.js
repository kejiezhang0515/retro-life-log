// 設定集中處:熱區位置、傾斜角度、轉場參數、月曆格線、唱片封面。微調請改這裡。
window.RL = window.RL || {};
RL.pages = {};   // 各物件頁面註冊處(page-*.js 會填入)

RL.TRANSITION = { duration: 750, easing: 'cubic-bezier(.4,0,.2,1)' };

// hash 路由。todo 與 daily 是兩個獨立的目標,不共用內容。
RL.ROUTES = { hub: 1, todo: 1, daily: 1, photos: 1, month: 1, diary: 1, laptop: 1, vinyl: 1 };

// box = [left, top, width, height],單位為佔圖寬高的 %
// angle = 物件在底圖中的傾斜角(度,順時針為正);放大時會轉正
RL.HOTSPOTS = [
  { id: 'photos',   label: '剪貼板',     route: '#photos', box: [60.9, 16.2, 30.3, 33.7], hub: true },   // 沒有新圖:內容疊在桌面底圖的軟木板上
  // img:該物件的新素材(會蓋住桌面底圖烤進去的舊物件);box 是它在桌面上的位置(佔桌面寬高的 %)
  { id: 'laptop',   label: '電腦',       route: '#laptop', box: [36.33, 50.0, 25.41, 36.06], img: 'assets/objects/laptop.png' },
  { id: 'todo',     label: 'to-do list', route: '#todo',   box: [22.0, 29.85, 8.19, 25.57], img: 'assets/objects/todo.png' },
  { id: 'daily',    label: 'daily plan', route: '#daily',  box: [32.08, 23.43, 8.32, 19.16], img: 'assets/objects/daily.png' },
  { id: 'calendar', label: '月曆',       route: '#month',  box: [73.175, 59.285, 15.9, 18.09], angle: 10, img: 'assets/objects/calendar.png' },
  { id: 'diary',    label: '筆記本',     route: '#diary',  box: [66.1, 78.9, 14.0, 15.1], angle: -5 },   // 桌面上維持原本烤在底圖裡的筆記本;點開後才換成新封面
  { id: 'vinyl',    label: '黑膠唱片機', route: '#vinyl',  box: [17.5, 75.3, 15.7, 16.2], angle: -3 },
  // 電腦鍵盤最下排的空白鍵:隱形點擊區(位置由電腦素材圖 1038×943 上量得,見 RL.LAPTOP.space)。放在電腦之後 → 疊在電腦上層
  { id: 'laptop-space', label: '空白鍵(暫停 / 播放影片)', action: 'laptopSpace', box: null },
  // 彩蛋(後加入的在上層,檯燈蓋住軟木板重疊處)
  { id: 'plant',    label: '盆栽(彩蛋)', box: [3, 48, 12.5, 29] },
  { id: 'lamp',     label: '檯燈開關',   box: [60.5, 44, 7.5, 31] }
];

// 電腦素材圖(裁切後 1038×943)上的位置,單位 px。
// screen:螢幕四角(左上、右上、右下、左下);space:空白鍵區 [x, y, w, h]
RL.LAPTOP = {
  w: 1038, h: 943,
  screen: [[205, 71], [841, 79], [838, 540], [203, 535]],
  space: [372, 798, 294, 92],     // 觸控板區(使用者指定當作「空白鍵」)
  hole: [195, 63, 652, 486],      // 螢幕開口外接矩形(影片鋪在這裡,框架圖蓋在上面)
  maxSeconds: 10
};
(function () {   // 由電腦的 box 與 space 推出空白鍵熱區在桌面上的 box
  const lap = RL.HOTSPOTS.find(h => h.id === 'laptop').box, sp = RL.LAPTOP.space, L = RL.LAPTOP;
  RL.HOTSPOTS.find(h => h.id === 'laptop-space').box = [
    lap[0] + sp[0] / L.w * lap[2], lap[1] + sp[1] / L.h * lap[3], sp[2] / L.w * lap[2], sp[3] / L.h * lap[3]];
})();

// 軟木板內緣(佔整個剪貼板物件寬高的 %),剪貼板子頁與首頁疊圖共用
RL.CORK_INSET = { l: 3.3, r: 3.3, t: 4.65, b: 4.65 };

// 不保存:重新整理就回到預設頁面,不留使用痕跡(資料只存在記憶體)。改成 true 才會存 localStorage / IndexedDB。
RL.PERSIST = false;

RL.objects = {};   // 各物件的「同一份畫面」:mount(el, {editable}),首頁唯讀、子頁可編輯
RL.actions = {};   // 熱區按鈕的自訂動作(例如電腦空白鍵)

// to-do:8 列。數值取自 to-do-list.png(900×1800)上量得的 px:每列高 102,第 1 列頂 y=502,勾選框 x=120~170、框頂比列頂低 25px
RL.TODO = { w: 900, h: 1800, rows: 8, top: 502, pitch: 102, boxX: 120, boxY: 25, boxSize: 50, textX: 190, textW: 590 };
// daily plan:12 條橫線,第 1 條 y=466、間距 102;文字區 x=72~1068;日期框 804~1061 × 102~197(daily-plan.png 1140×1680)
RL.DAILY = { w: 1140, h: 1680, lines: 12, firstRule: 466, pitch: 102, x0: 72, x1: 1068, date: [804, 102, 257, 95] };

RL.NOTEBOOK_PAGES = 3;

// ── 黑膠唱片封面 ──────────────────────────────────────────
// 日後加入正式封面:把正方形圖片(建議 600×600 以上的 JPG/PNG)放進 assets/covers/,
// 然後在下面陣列加一行 { id, title, artist, src } 即可,順序就是弧形選單的順序。
// 不需要改其他程式。
RL.VINYL_COVERS = [   // 標題取自檔名;作者欄位留空
  { id: 'about-you',  title: 'About you',  artist: '', src: 'assets/covers/about-you.jpg' },
  { id: 'apocalypse', title: 'Apocalypse', artist: '', src: 'assets/covers/apocalypse.jpg' },
  { id: 'as-it-was',  title: 'As it was',  artist: '', src: 'assets/covers/as-it-was.jpg' },
  { id: 'landslide',  title: 'Landslide',  artist: '', src: 'assets/covers/landslide.jpg' },
  { id: 'out-of-wood', title: 'Out of wood', artist: '', src: 'assets/covers/out-of-wood.jpg' },
  { id: 'radio',      title: 'Radio',      artist: '', src: 'assets/covers/radio.jpg' },
  { id: 'team',       title: 'Team',       artist: '', src: 'assets/covers/team.jpg' }
];

// 黑膠唱機幾何(單位 px,皆在裁切後的唱機圖 1221×1027 座標;由 tools/build_assets_c.py 量得)
// disc:唱片圓心與半徑;label:中心標籤半徑(唱針溝槽環內徑);arm:唱臂圖在底圖上的位置 [x, y, w, h];
// pivot:軸承座圓心(唱臂的旋轉軸);tip:靜止位置時唱針尖端;rpm:33⅓ 轉 = 1.8 秒一圈
RL.VINYL = {
  w: 1221, h: 1027, disc: [507.5, 535.5, 435.5], labelR: 159.5, coverR: 166, hole: 13,
  discBox: [70, 98, 874], arm: [878, 0, 303, 912], pivot: [1013, 233], tip: [995, 893],
  rev: 1.8, spinUp: 1.0, spinDown: 1.5, maxPhi: 62
};
