#!/usr/bin/env python3
"""把 素材 資料夾裡的原圖處理成專案用的圖(裁切、最佳化),並產生補掉舊物件的乾淨桌面底圖。
用法:python3 tools/build_assets.py <素材資料夾>
需要:Pillow、numpy、opencv-python。成品 zip 不需要這支腳本,僅供之後重新產生素材。"""
import sys, os, json
import numpy as np
from PIL import Image
import cv2

SRC = sys.argv[1] if len(sys.argv) > 1 else '素材'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = lambda *p: os.path.join(ROOT, 'assets', *p)

def save_png(im, path):
    im.save(path, optimize=True)
    print(path, im.size, os.path.getsize(path) // 1024, 'KB')

# ── 1. 物件圖 ──
todo = Image.open(os.path.join(SRC, 'to-do-list.png')).convert('RGBA')
daily = Image.open(os.path.join(SRC, 'daily-plan.png')).convert('RGBA')
lap = Image.open(os.path.join(SRC, 'minimal_acrylic_laptop_cutout.png')).convert('RGBA')
lap = lap.crop(lap.split()[-1].getbbox())           # 裁到內容範圍 → 1038×943
save_png(todo, A('objects', 'todo.png'))
save_png(daily, A('objects', 'daily.png'))
save_png(lap, A('objects', 'laptop.png'))

# ── 2. 把新圖對到舊桌面上的位置(以深褐色外框的 bbox 對齊)──
desk = Image.open(A('derived', 'desk-base.png')).convert('RGB')
W, H = desk.size
da = np.array(desk).astype(int)
def brown(a): return (a[..., 0] < 130) & (a[..., 1] < 100) & (a[..., 2] < 90) & (a[..., 0] > 60)
def bbox(m):
    ys, xs = np.where(m); return xs.min(), ys.min(), xs.max(), ys.max()

placements = {}
for name, hot, im in [('todo', [22.5, 30.6, 7.2, 24.1], todo), ('daily', [32.1, 23.4, 8.3, 19.2], daily)]:
    l, t, w, h = hot
    x0, y0, x1, y1 = [int(v) for v in ((l-2)/100*W, (t-2)/100*H, (l+w+2)/100*W, (t+h+2)/100*H)]
    ob = bbox(brown(da[y0:y1, x0:x1])); ob = (ob[0]+x0, ob[1]+y0, ob[2]+x0, ob[3]+y0)
    nb = bbox(brown(np.array(im.convert('RGB')).astype(int)))
    s = ((ob[2]-ob[0]) / (nb[2]-nb[0]) + (ob[3]-ob[1]) / (nb[3]-nb[1])) / 2
    placements[name] = (ob[0] - nb[0]*s, ob[1] - nb[1]*s, im.width*s, im.height*s)
# 電腦:以「螢幕深色外框」的最大連通區塊(只取外框上半部,避開鍵盤)對齊,求縮放與位置
def big(a, region, thr=70):
    m = ((a[..., 0] < thr) & (a[..., 1] < thr) & (a[..., 2] < thr)).astype(np.uint8)
    x0, y0, x1, y1 = region; mm = np.zeros_like(m); mm[y0:y1, x0:x1] = m[y0:y1, x0:x1]
    n, lab, st, _ = cv2.connectedComponentsWithStats(mm, connectivity=8)
    return st[1 + np.argmax(st[1:, cv2.CC_STAT_AREA])]
ob = big(da, (int(.36*W), int(.45*H), int(.64*W), int(.62*H)))
na = np.array(lap).astype(int); na3 = na[..., :3].copy(); na3[na[..., 3] < 200] = 255
nb = big(na3, (0, 0, lap.width, 580))
s = ob[2] / nb[2]
placements['laptop'] = (ob[0] - nb[0]*s, ob[1] - nb[1]*s, lap.width*s, lap.height*s)

boxes = {k: [round(v[0]/W*100, 2), round(v[1]/H*100, 2), round(v[2]/W*100, 2), round(v[3]/H*100, 2)] for k, v in placements.items()}
print(json.dumps(boxes))

# ── 3. 乾淨桌面:把新物件的範圍(外擴一圈)用周圍像素補起來,新圖再蓋上去就不會露出舊物件的邊 ──
mask = np.zeros((H, W), np.uint8)
imgs = {'todo': todo, 'daily': daily, 'laptop': lap}
for k, (x, y, w, h) in placements.items():
    sc = Image.new('L', (int(round(w)), int(round(h))), 0)
    sc = imgs[k].split()[-1].resize(sc.size)
    m = np.array(sc) > 8
    full = np.zeros((H, W), bool)
    xi, yi = int(round(x)), int(round(y))
    full[max(yi, 0):yi+m.shape[0], max(xi, 0):xi+m.shape[1]] = m[max(-yi, 0):, max(-xi, 0):][:H-max(yi, 0), :W-max(xi, 0)]
    mask |= full.astype(np.uint8) * 255
mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
bgr = cv2.cvtColor(np.array(desk), cv2.COLOR_RGB2BGR)
out = cv2.inpaint(bgr, mask, 6, cv2.INPAINT_TELEA)
clean = Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))
clean.save(A('derived', 'desk-clean.png'), optimize=True)
print('desk-clean', os.path.getsize(A('derived', 'desk-clean.png')) // 1024, 'KB')
