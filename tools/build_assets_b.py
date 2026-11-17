#!/usr/bin/env python3
"""Phase B 素材:素材庫(相框 / 貼紙)、月曆、筆記本封面去背、內頁左右頁、封底,並把月曆與筆記本在桌面上的舊物件補底。
用法:python3 tools/build_assets_b.py <素材資料夾>   (需先跑過 build_assets.py)"""
import sys, os, json, math
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFilter
SRC = sys.argv[1] if len(sys.argv) > 1 else '素材'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = lambda *p: os.path.join(ROOT, 'assets', *p)
def save(im, path):
    im.save(path, optimize=True); print(path, im.size, os.path.getsize(path)//1024, 'KB')
def fit_long(im, n=1200):
    s = n / max(im.size)
    return im.resize((round(im.width*s), round(im.height*s)), Image.LANCZOS) if s < 1 else im

# ── 素材庫:裁到內容範圍、長邊 ≤1200;相框另外算出照片窗口(內部不連到外面的透明區)──
lib = {}
for kind, folder, name in [('frame', '相框', 'vinyl-recorder.png'), ('sticker', '貼紙', 'vinyl-recorder-2.png')]:
    im = Image.open(os.path.join(SRC, '共用素材庫', folder, name)).convert('RGBA')
    im = fit_long(im.crop(im.split()[-1].getbbox()))
    out = A('library', 'frames' if kind == 'frame' else 'stickers', ('polaroid-01' if kind == 'frame' else 'note-01') + '.png')
    save(im, out)
    rec = {'w': im.width, 'h': im.height}
    if kind == 'frame':
        al = np.array(im.split()[-1]); m = (al < 10).astype(np.uint8)
        n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=4)
        best = None
        for i in range(1, n):
            x, y, w, h, a = st[i]
            if x > 0 and y > 0 and x + w < im.width and y + h < im.height and (best is None or a > st[best][4]): best = i
        x, y, w, h, _ = st[best]
        rec['window'] = [round(x/im.width*100, 3), round(y/im.height*100, 3), round(w/im.width*100, 3), round(h/im.height*100, 3)]
    lib[kind] = rec
print(json.dumps(lib))

# ── 月曆 ──
cal = Image.open(os.path.join(SRC, 'calendar-november.png')).convert('RGBA')
cal = cal.resize((1400, round(1400 * cal.height / cal.width)), Image.LANCZOS)
save(cal, A('objects', 'calendar.png'))

# ── 筆記本封面去背:矩形封面 + 左側螺旋圈(以暗度當 alpha),邊緣羽化 1px ──
src = Image.open(os.path.join(SRC, '6af947a81cc277624474c269255bc2e3.jpg')).convert('RGB')
a = np.array(src).astype(np.float32); mn = a.min(2)
X0, Y0, X1, Y1 = 266, 163, 901, 1031
alpha = np.zeros(mn.shape, np.float32)
alpha[165:1030, 322:899] = 1.0                           # 封面紙面
coil = np.clip((205 - mn) / (205 - 100), 0, 1)           # 螺旋圈:越暗越不透明(淡灰色的陰影霧面直接去掉)
alpha[165:1030, 268:322] = np.maximum(coil[165:1030, 268:322], 0)
# 螺旋圈與紙面交界處(紙面左緣)補一條平滑過渡
alpha = cv2.GaussianBlur(alpha, (3, 3), 0.8)
# 螺旋圈區域:假設原本疊在白底上,反推前景色,避免半透明邊緣出現白邊
zone = np.zeros(mn.shape, bool); zone[165:1030, 268:322] = True
al = np.clip(alpha, 1e-3, 1)[..., None]
fg = np.clip((a - 255 * (1 - al)) / al, 0, 255)
a = np.where(zone[..., None], fg, a)
rgba = np.dstack([a, alpha*255]).astype(np.uint8)
cover = Image.fromarray(rgba, 'RGBA').crop((X0, Y0, X1, Y1))
save(cover, A('notebook', 'cover.png')) if os.path.isdir(A('notebook')) else (os.makedirs(A('notebook')), save(cover, A('notebook', 'cover.png')))

# ── 內頁:notebook-page.png 左半 / 右半 ──
pg = Image.open(A('interactive', 'notebook-page.png')).convert('RGBA'); hw = pg.width // 2
for nm, box in [('page-left', (0, 0, hw, pg.height)), ('page-right', (hw, 0, pg.width, pg.height))]:
    save(pg.crop(box).resize((640, round(640 * pg.height / hw)), Image.LANCZOS), A('notebook', nm + '.png'))

# ── 封底外側:與封面條紋同色系的簡單面板(粉白底 + 淡藍直條紋 + 細緣線)──
W, Hh = cover.size
back = Image.new('RGBA', (W, Hh), (247, 241, 240, 255)); d = ImageDraw.Draw(back)
for x in range(18, W, 44): d.rectangle([x, 0, x+16, Hh], fill=(206, 214, 228, 255))
d.rectangle([0, 0, W-1, Hh-1], outline=(226, 196, 200, 255), width=3)
m = Image.new('L', (W, Hh), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, W-1, Hh-1], 6, fill=255)
back.putalpha(m); save(back, A('notebook', 'back.png'))

# ── 桌面補底:月曆、筆記本舊物件 ──
desk = Image.open(A('derived', 'desk-clean.png')).convert('RGB'); DW, DH = desk.size
mask = np.zeros((DH, DW), np.uint8)
def rot_rect(cx, cy, w, h, ang):
    r = ((cx, cy), (w, h), ang); return cv2.boxPoints(r).astype(np.int32)
CAL = dict(cx=81.125, cy=68.33, w=15.9, h=15.9*cal.height/cal.width*3600/2305, ang=10)   # h 以 % 表示:先換算成 px
cw = CAL['w']/100*DW; ch = cw*cal.height/cal.width
cv2.fillPoly(mask, [rot_rect(CAL['cx']/100*DW, CAL['cy']/100*DH, cw*1.03, ch*1.03, CAL['ang'])], 255)
# 筆記本:桌面上維持原本烤在底圖裡的版本,不處理
mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (35, 35)))
bgr = cv2.cvtColor(np.array(desk), cv2.COLOR_RGB2BGR)
out = cv2.inpaint(bgr, mask, 6, cv2.INPAINT_TELEA)
Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB)).save(A('derived', 'desk-clean.png'), optimize=True)
print('placements', json.dumps({'calendar': CAL}))
