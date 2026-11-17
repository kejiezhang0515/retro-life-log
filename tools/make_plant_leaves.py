#!/usr/bin/env python3
"""從 assets/desk.png 分離盆栽的每片綠葉(不修改原圖)。
輸出:
  assets/derived/desk-base.png   桌面底圖(葉片已移除並補回牆/窗簾背景)
  assets/plant/leaf-XX.png       每片葉子一張透明 PNG(原解析度)
  js/plant-leaves.js             每片葉子的位置/轉軸/擺動參數
用法:python3 tools/make_plant_leaves.py
"""
import cv2, numpy as np, json, os, math, random
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = cv2.imread(os.path.join(ROOT, 'assets/desk.png'))
H, W = src.shape[:2]
X0, Y0, X1, Y1 = 60, 1040, 620, 1800            # 盆栽範圍(像素)
crop = src[Y0:Y1, X0:X1].copy()
hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]

green = ((h >= 28) & (h <= 70) & (s >= 35) & (v >= 90)).astype(np.uint8)
green[560:, :] = 0                               # 盆以下不處理
green[:, :40] = 0
green = cv2.morphologyEx(green, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
n, lab, stats, cent = cv2.connectedComponentsWithStats(green, connectivity=8)
leaves = [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] > 500]
print('leaves', len(leaves))

# 每個像素分配給最近的葉子
leafmask = np.isin(lab, leaves).astype(np.uint8)
dist, nearest = cv2.distanceTransformWithLabels(1 - leafmask, cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
# nearest 給的是「零像素」的編號;建立 零像素編號 -> 葉子編號 的對照
ys, xs = np.where(leafmask == 1)
zero_label_to_leaf = {}
for y, x in zip(ys, xs):
    zero_label_to_leaf[nearest[y, x]] = lab[y, x]
owner = np.zeros(lab.shape, np.int32)
lut = np.zeros(nearest.max() + 1, np.int32)
for k, vv in zero_label_to_leaf.items(): lut[k] = vv
owner = lut[nearest]

R = 5                                            # 外擴像素(含毛邊輪廓;枝幹只會被帶到接點附近幾 px)
near = dist <= R
dark = v < 140
keep = ((green > 0) | dark | ((h >= 28) & (h <= 70) & (s >= 35))) & near
union = np.zeros(lab.shape, np.uint8)

base = src.copy()
os.makedirs(os.path.join(ROOT, 'assets/plant'), exist_ok=True)
os.makedirs(os.path.join(ROOT, 'assets/derived'), exist_ok=True)
for f in os.listdir(os.path.join(ROOT, 'assets/plant')):
    if f.startswith('leaf-'): os.remove(os.path.join(ROOT, 'assets/plant', f))

base_cx, base_cy = 270, 462                      # 莖的根部(用來找每片葉子的連接端)
out = []
order = sorted(leaves, key=lambda i: cent[i][1])
random.seed(7)
for idx, i in enumerate(order):
    m = (keep & (owner == i)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    union |= m
    a = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 0.9)
    a = np.clip(a * 1.15, 0, 1)
    ys, xs = np.where(m > 0)
    l, t, r, b = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    rgba = np.dstack([crop[t:b, l:r], (a[t:b, l:r] * 255).astype(np.uint8)])
    name = f'leaf-{idx + 1:02d}.png'
    cv2.imwrite(os.path.join(ROOT, 'assets/plant', name), rgba)
    # 轉軸:葉片輪廓上最靠近莖根的點
    d2 = (xs - base_cx) ** 2 + (ys - base_cy) ** 2
    k = int(np.argmin(d2))
    px, py = xs[k], ys[k]
    bx, by = l + X0, t + Y0
    out.append(dict(src='assets/plant/' + name,
        box=[round(bx / W * 100, 3), round(by / H * 100, 3), round((r - l) / W * 100, 3), round((b - t) / H * 100, 3)],
        pivot=[round((px - l) / (r - l) * 100, 1), round((py - t) / (b - t) * 100, 1)],
        amp=round(random.uniform(2.2, 4.2), 1) * random.choice([-1, 1]),
        dur=round(random.uniform(1.5, 2.4), 2), delay=round(random.uniform(0, 0.35), 2)))

# 底圖:把葉子區域補回背景。背景(牆/窗簾)以直條紋為主,所以逐欄做上下插值,
# 取樣時避開葉子、枝幹,避免把深色拖進來。
stem = (v < 105) & (s > 95)
u = union.astype(bool)
hole = (cv2.dilate(union, np.ones((5, 5), np.uint8)) > 0) & ~(stem & ~u)   # 多吃 2px 毛邊,但保留葉外的枝幹
hole[560:, :] = False
XEDGE = 201                                       # 窗簾邊線約在 x=190~199
holeW = hole.copy(); holeW[:, :XEDGE] = False     # 牆面:平坦,用 inpaint
holeC = hole.copy(); holeC[:, XEDGE:] = False     # 窗簾:直條紋,逐欄上下插值
filled = crop.astype(np.float32).copy()
wall_ok = np.zeros(hole.shape, bool); wall_ok[:440, 215:] = True
wall_ok &= ~(cv2.dilate(hole.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0) & ~stem & (v > 215) & (s < 30)
wall_color = np.median(crop[wall_ok], axis=0)        # 牆面是平坦的奶油色:直接用中位數色
filled[holeW] = wall_color
bad = (cv2.dilate(hole.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) | stem
bad[560:, :] = True
hh, ww = hole.shape
for x in range(XEDGE):
    col = holeC[:, x]
    y = 0
    while y < hh:
        if not col[y]: y += 1; continue
        y2 = y
        while y2 < hh and col[y2]: y2 += 1
        up = y - 1
        while up >= 0 and bad[up, x]: up -= 1
        dn = y2
        while dn < hh and bad[dn, x]: dn += 1
        for yy in range(y, y2):
            if up >= 0 and dn < 560:
                t = (yy - up) / (dn - up); filled[yy, x] = crop[up, x] * (1 - t) + crop[dn, x] * t
            elif up >= 0: filled[yy, x] = crop[up, x]
            elif dn < 560: filled[yy, x] = crop[dn, x]
        y = y2
rng = np.random.default_rng(3)
filled += rng.normal(0, 1.0, filled.shape[:2])[..., None]     # 補一點紙紋顆粒
filled = np.clip(filled, 0, 255).astype(np.uint8)
base = src.copy()
region = base[Y0:Y1, X0:X1]
mask3 = cv2.GaussianBlur(hole.astype(np.float32), (0, 0), 0.7)[..., None]
region[:] = (filled * mask3 + region * (1 - mask3)).astype(np.uint8)
cv2.imwrite(os.path.join(ROOT, 'assets/derived/desk-base.png'), base)

with open(os.path.join(ROOT, 'js/plant-leaves.js'), 'w') as f:
    f.write('// 由 tools/make_plant_leaves.py 產生:每片葉子的位置(佔底圖 %)、轉軸(佔葉片圖 %)與擺動參數。\n')
    f.write('RL.PLANT_LEAVES = ' + json.dumps(out, indent=1) + ';\n')
print('done')
