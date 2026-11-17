#!/usr/bin/env python3
"""Phase C 素材:黑膠唱機拆圖層(底圖 / 圓形唱片 / 唱臂)+ 專輯封面改英文檔名並縮圖。
用法:python3 tools/build_assets_c.py <素材資料夾>"""
import sys, os, re, json
import numpy as np, cv2
from PIL import Image
SRC = sys.argv[1] if len(sys.argv) > 1 else '素材'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = lambda *p: os.path.join(ROOT, 'assets', *p)
def save(im, path, **kw):
    im.save(path, optimize=True, **kw); print(path, im.size, os.path.getsize(path)//1024, 'KB')

im = Image.open(os.path.join(SRC, '黑膠唱片', 'vinyl-recorder.png')).convert('RGBA')
im = im.crop(im.split()[-1].getbbox())                       # 內容範圍 1221×1027
W, H = im.size
rgba = np.array(im); rgb = rgba[..., :3].astype(np.float32); alpha = rgba[..., 3]
lum = rgb @ np.array([.299, .587, .114], np.float32)

# ── 唱片:暗色最大連通區(x<930,避開唱臂)取最小外接圓;中心標籤:圓心附近的米白區 ──
dark = ((lum < 95) & (alpha > 200)).astype(np.uint8); dark[:, 930:] = 0
n, lab, st, _ = cv2.connectedComponentsWithStats(dark, connectivity=8)
i = 1 + np.argmax(st[1:, 4]); m = (lab == i).astype(np.uint8)
# 右緣被唱臂區截掉,所以用左 / 上 / 下三個極值定圓(這張照片有一點透視:橫向略短於縱向)
ys_, xs_ = np.where(m)
top, bot, left = ys_.min(), ys_.max(), xs_.min()
dr = (bot - top) / 2; dcy = (top + bot) / 2; dcx = left + dr
cream = ((lum > 175) & (np.hypot(*np.meshgrid(np.arange(W) - dcx, np.arange(H) - dcy)) < 260)).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(cream, connectivity=8)
li = lab[int(dcy), int(dcx) + 60] or (1 + np.argmax(st[1:, 4]))
lc, _ = cv2.findContours((lab == li).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
(lcx, lcy), lr = cv2.minEnclosingCircle(max(lc, key=cv2.contourArea)); lr += 8   # 米白區不含最外圈細線
print('disc', dcx, dcy, dr, 'label', lcx, lcy, lr)

# ── 唱臂:右側(x≥860)且在唱片圓外的暗 / 灰像素,閉運算 + 填洞;外圍一圈柔影另算 ──
yy, xx = np.mgrid[0:H, 0:W]
outside = np.hypot(xx - dcx, yy - dcy) > dr + 8
core = ((lum < 175) & (alpha > 200) & outside & (xx >= 860)).astype(np.uint8)
core = cv2.morphologyEx(core, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
n, lab, st, _ = cv2.connectedComponentsWithStats(core, connectivity=8)
keep = np.zeros_like(core)
for k in range(1, n):
    if st[k, 4] > 400: keep[lab == k] = 1
cn, _ = cv2.findContours(keep, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
filled = np.zeros_like(keep); cv2.drawContours(filled, cn, -1, 1, -1)
# 唱臂旁的銀色唱頭 / 抗滑桿有白色高光,閉運算後仍可能有洞 → 以整個外接輪廓填滿
core_mask = cv2.dilate(filled, np.ones((3, 3), np.uint8))
ys, xs = np.where(core_mask); print('arm core bbox', xs.min(), ys.min(), xs.max(), ys.max())
# 柔影:核心外 28px 內,越暗越不透明(黑色,最多 0.55)
ring = cv2.dilate(core_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (57, 57))) & (1 - core_mask)
shadow_a = np.clip((246 - lum) / 120, 0, 1) * 0.6 * ring * (outside & (xx >= 860))
a_arm = np.maximum(core_mask.astype(np.float32), shadow_a.astype(np.float32))
a_arm = cv2.GaussianBlur(a_arm, (3, 3), 0.7) * (alpha > 0)
arm_rgb = np.where(core_mask[..., None] > 0, rgb, 0)                  # 影子部分用黑色
pad = 4
ys2, xs2 = np.where(a_arm > 0.02)
x0, y0, x1, y1 = max(xs2.min() - pad, 0), max(ys2.min() - pad, 0), min(xs2.max() + pad, W - 1), min(ys2.max() + pad, H - 1)
arm = np.dstack([arm_rgb, a_arm * 255]).astype(np.uint8)[y0:y1 + 1, x0:x1 + 1]
save(Image.fromarray(arm, 'RGBA'), A('vinyl', 'arm.png'))

# ── 底圖:把唱臂(含影子)蓋住的地方用附近的白色機身補回 ──
holes = ((a_arm > 0.02) | (core_mask > 0)).astype(np.uint8) * 255
holes = cv2.dilate(holes, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
# 唱臂蓋住的地方:機身是平滑的淺灰漸層,用整片機身像素擬合二次曲面來補(比 inpaint 不會留下色塊)
holes_b = holes > 0
body = (alpha > 200) & ~holes_b & (lum > 215) & (np.hypot(xx - dcx, yy - dcy) > dr + 12) & (yy > 60) & (xx > 760)
X = xx[body].astype(np.float64) / W; Y = yy[body].astype(np.float64) / H
def feats(x, y): return np.stack([np.ones_like(x), x, y, x*x, x*y, y*y, x**3, x*x*y, x*y*y, y**3], -1)
Fm = feats(X, Y)
plane = np.zeros(rgba.shape[:2] + (3,), np.float64)
FF = feats(xx.astype(np.float64) / W, yy.astype(np.float64) / H)
for ch in range(3):
    coef = np.linalg.lstsq(Fm, rgb[..., ch][body].astype(np.float64), rcond=None)[0]
    plane[..., ch] = FF @ coef
wgt = cv2.GaussianBlur(holes_b.astype(np.float32), (0, 0), 3.0)[..., None]      # 邊緣羽化 3px,與原機身自然銜接
fixed_rgb = np.clip(plane, 0, 255) * wgt + rgb * (1 - wgt)
fixed = cv2.cvtColor(fixed_rgb.astype(np.uint8), cv2.COLOR_RGB2BGR)
# 配重高出機身上緣:機身上緣以外(唱臂蓋住的部分)補成透明,機身以內補成不透明
def top_edge(x0_, x1_):
    cols = []
    for x in range(x0_, x1_):
        col = np.where((alpha[:, x] > 200) & (holes[:, x] == 0))[0]
        if len(col): cols.append(col.min())
    return np.median(cols)
edge = (top_edge(845, 880) + top_edge(1160, 1190)) / 2
alpha2 = alpha.copy(); inh = holes > 0
alpha2[inh & (yy < edge)] = 0; alpha2[inh & (yy >= edge)] = 255
base = np.dstack([cv2.cvtColor(fixed, cv2.COLOR_BGR2RGB), alpha2])
save(Image.fromarray(base, 'RGBA'), A('vinyl', 'base.png'))

# ── 圓形唱片(蓋在原位上轉;比原唱片大 1px 以完全蓋住)──
R = dr + 1.5; s = int(round(R * 2))
box = (int(round(dcx - R)), int(round(dcy - R)), int(round(dcx - R)) + s, int(round(dcy - R)) + s)
disc = im.crop(box); mk = Image.new('L', (s, s), 0)
cv2m = np.zeros((s, s), np.uint8); cv2.circle(cv2m, (s // 2, s // 2), int(round(R)) - 1, 255, -1)
cv2m = cv2.GaussianBlur(cv2m, (3, 3), 0.8); disc.putalpha(Image.fromarray(cv2m))
save(disc, A('vinyl', 'disc.png'))

# ── 唱針(唱頭下緣)與軸承座中心:由格線圖目測,詳見 PROJECT_MEMORY ──
pivot = (1013, 233); tip = (995, 893)
geo = {'w': W, 'h': H, 'disc': [round(dcx, 1), round(dcy, 1), round(dr, 1)], 'label': [round(lcx, 1), round(lcy, 1), round(lr, 1)],
       'arm': [int(x0), int(y0), int(x1 - x0 + 1), int(y1 - y0 + 1)], 'pivot': pivot, 'tip': tip, 'discBox': [box[0], box[1], s]}
print('GEO', json.dumps(geo))

# ── 專輯封面:檔名改英文 slug,縮到長邊 ≤800 ──
os.makedirs(A('covers'), exist_ok=True)
out = []
for f in sorted(os.listdir(os.path.join(SRC, '黑膠唱片', 'albumcover'))):
    if not f.lower().endswith(('.jpg', '.jpeg', '.png')): continue
    title = os.path.splitext(f)[0]; slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    c = Image.open(os.path.join(SRC, '黑膠唱片', 'albumcover', f)).convert('RGB'); sc = min(1, 800 / max(c.size))
    c = c.resize((round(c.width * sc), round(c.height * sc)), Image.LANCZOS)
    save(c, A('covers', slug + '.jpg'), quality=88); out.append((slug, title))
print('COVERS', json.dumps(out, ensure_ascii=False))
