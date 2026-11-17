// 共用素材庫清單。之後新增素材:把圖放進 assets/library/frames/ 或 stickers/,在下面加一行即可。
// id:唯一代號;type:frame(相框)/ sticker(貼紙);src:圖檔;w:新增時的預設寬度(佔擺放層寬度的 %);
// ratio:寬 ÷ 高;window:(僅相框)照片窗口 [左, 上, 寬, 高],單位是佔相框圖的 %,由 tools/build_assets_b.py 從透明度自動算出。
RL.LIBRARY = [
  { id: 'polaroid-01', type: 'frame',   label: '拍立得', src: 'assets/library/frames/polaroid-01.png',  w: 26, ratio: 960 / 1200, window: [4.271, 11.333, 90.312, 69.0] },
  { id: 'note-01',     type: 'sticker', label: '便條紙', src: 'assets/library/stickers/note-01.png',    w: 20, ratio: 936 / 1200 }
];
RL.libById = id => RL.LIBRARY.find(l => l.id === id);

// 文字物件可選字型(系統字型堆疊,不連網)與 6 色色票
RL.FONTS = [
  { id: 'hand',  label: '手寫', stack: '"Bradley Hand","Segoe Print","Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif' },
  { id: 'serif', label: '宋體', stack: 'Georgia,"Songti TC","Noto Serif TC","PMingLiU",serif' },
  { id: 'sans',  label: '黑體', stack: '"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif' },
  { id: 'round', label: '圓體', stack: '"Hiragino Maru Gothic ProN","Arial Rounded MT Bold","PingFang TC","Microsoft JhengHei",sans-serif' }
];
RL.COLORS = [
  { id: 'ink',   label: '深褐', v: '#4a392c' }, { id: 'rose', label: '玫瑰', v: '#b5535f' }, { id: 'blue', label: '灰藍', v: '#4f6a8f' },
  { id: 'green', label: '苔綠', v: '#5d7a4f' }, { id: 'gold', label: '琥珀', v: '#b9822b' }, { id: 'white', label: '米白', v: '#fffaf0' }
];
RL.fontStack = id => (RL.FONTS.find(f => f.id === id) || RL.FONTS[0]).stack;

RL.uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

// 剪貼板一開始是空的(使用者自己從面板加入相框 / 貼紙)
RL.clipboardSeed = () => [];
