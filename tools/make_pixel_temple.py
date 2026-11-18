#!/usr/bin/env python3
"""召喚神殿（地圖上抽卡的地方）的像素圖：白色大理石、像神話裡的神殿，魔法的部分是紫色。

用法：  python3 tools/make_pixel_temple.py        （需要 Pillow）

輸出：
  assets/decor/temple.png        神殿遺跡：零散的大理石地板與斷牆（22×14 格 = 704×448），蓋在地圖 (9, 0) 的位置
  assets/sprites/column.png      白色大理石柱（1×3 格），柱頭上浮著紫色水晶
  assets/sprites/column-broken.png  斷掉的柱子
  assets/sprites/altar.png       中央的召喚台（3×3 格）：兩層大理石圓台，台面是發光的紫色法陣

神殿遺跡的地板與斷牆位置，直接讀 js/data/maps/town.js 裡的 RUINS 表（RUINS-BEGIN 到 RUINS-END）：
碰撞是地圖用那張表算的，這裡只負責把它畫成崩落、破碎的樣子。改遺跡就改那張表，再重跑這支程式。
"""
import math
import os
import random
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_pixel_assets import new, px, rect, ellipse, rgb, save, strip  # noqa: E402

T = 32
ORIGIN = (9, 0)                      # 佈景圖左上角在地圖上的格子座標
DW, DH = 22, 14                      # 佈景圖大小（格）

MARBLE, MARBLE_L, MARBLE_D, SEAM = '#f1eef5', '#fbfaff', '#ddd7e6', '#d3cce0'
GOLD, GOLD_L, GOLD_D = '#e0b45a', '#f8e2a0', '#a9832f'
VIOLET, VIOLET_L, VIOLET_D, VIOLET_G = '#8b5cf0', '#c9a8ff', '#4b2a8a', '#efe2ff'
ALTAR_C = (20, 6)                    # 召喚台中心（格）


def read_ruins():
    """讀 js/data/maps/town.js 裡 RUINS-BEGIN 到 RUINS-END 之間的表（和地圖碰撞用的是同一張）"""
    src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'data', 'maps', 'town.js'), encoding='utf8').read()
    body = src.split('// RUINS-BEGIN')[1].split('// RUINS-END')[0]
    rows = re.findall(r"'([^']*)'", body)
    ox, oy = map(int, re.search(r'RUINS_ORIGIN = \[(\d+), (\d+)\]', src).groups())
    grid = {}
    for dy, row in enumerate(rows):
        for dx, c in enumerate(row):
            grid[(ox + dx, oy + dy)] = c
    return grid


def C(c):
    return rgb(c) if isinstance(c, str) else c


def mix(c1, c2, t):
    a, b = C(c1), C(c2)
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


def decor_temple():
    """神殿遺跡：殘缺的大理石地板（邊緣崩落、有裂縫）、幾段斷牆、地上殘留半圈金色與紫色的鑲嵌、散落的碎石"""
    grid = read_ruins()
    W, H = DW * T, DH * T
    im = new(W, H)
    rnd = lambda *k: random.Random(hash_k(*k)).random()   # noqa: E731

    def cell(gx, gy):
        return grid.get((gx, gy), '.')

    def noise1(key, t):
        """平滑的一維雜訊（0～1）：每 8 像素一個隨機值，中間線性內插"""
        i, f = int(t // 8), (t % 8) / 8
        return rnd(key, i) * (1 - f) + rnd(key, i + 1) * f

    def altar_d(gx, gy, lx, ly):
        return math.hypot(gx + (lx + 0.5) / T - ALTAR_C[0], (gy + (ly + 0.5) / T - ALTAR_C[1]) * 1.25)

    def eaten(gx, gy, lx, ly):
        """這個像素是不是已經崩落：靠草地的邊緣用平滑雜訊咬掉 2～12 像素；
        邊緣的石板（16×16）有些整塊不見；中間偶爾也破一個洞（召喚台附近保持完整）"""
        qx, qy = lx // 16, ly // 16
        near_altar = altar_d(gx, gy, lx, ly) < 2.5
        exposed = False
        for (nx, ny), dist, t in (((gx - 1, gy), lx, gy * T + ly), ((gx + 1, gy), T - 1 - lx, gy * T + ly),
                                  ((gx, gy - 1), ly, gx * T + lx), ((gx, gy + 1), T - 1 - ly, gx * T + lx)):
            if cell(nx, ny) != 'm':
                exposed = exposed or dist < 16
                if dist < 2 + int(10 * noise1(('e', nx, ny, gx, gy), t)):
                    return True
        for (nx, ny), cx, cy in (((gx - 1, gy - 1), 0, 0), ((gx + 1, gy - 1), T - 1, 0), ((gx - 1, gy + 1), 0, T - 1), ((gx + 1, gy + 1), T - 1, T - 1)):
            if cell(nx, ny) != 'm' and abs(lx - cx) + abs(ly - cy) < 6 + int(8 * rnd(gx, gy, cx, cy)):
                return True
        if not near_altar and exposed and rnd('q', gx, gy, qx, qy) < 0.32:
            return True
        if not near_altar and rnd('hole', gx, gy, qx, qy) < 0.05:
            return True
        return False

    veins = set()
    r = random.Random(77)
    for _ in range(40):
        x, y = r.randrange(W), r.randrange(H)
        ang = r.random() * math.tau
        for _ in range(r.randrange(20, 60)):
            veins.add((int(x), int(y)))
            ang += (r.random() - 0.5) * 0.7
            x += math.cos(ang)
            y += math.sin(ang) * 0.7
    floor = [[False] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            gx, gy = ORIGIN[0] + x // T, ORIGIN[1] + y // T
            if cell(gx, gy) != 'm' or eaten(gx, gy, x % T, y % T):
                continue
            floor[y][x] = True
            # 大理石板：像砌磚一樣錯開排，石板之間的縫很淡
            lx, ly = x % T, y % T
            row = y // 16
            sx = (x + (8 if row % 2 else 0)) // 16
            c = mix(MARBLE_L, MARBLE, 0.15 + 0.35 * rnd('s', sx, row))
            if (x, y) in veins:
                c = mix(c, '#c7bfd6', 0.5)
            if y % 16 == 15 or (x + (8 if row % 2 else 0)) % 16 == 15:
                c = mix(c, '#cfc7dc', 0.6)
            # 殘留的鑲嵌：以召喚台為中心的金色環與紫色符文環，斷斷續續，只畫在還留著的地板上
            d = altar_d(gx, gy, lx, ly)
            ang = math.atan2((gy + (ly + 0.5) / T - ALTAR_C[1]) * 1.25, gx + (lx + 0.5) / T - ALTAR_C[0])
            seg = int((ang + math.pi) / math.tau * 14)
            if 2.95 < d < 3.08 and rnd('gold', seg) > 0.35:
                c = C(GOLD_L if d < 3.01 else GOLD)
            if 2.15 < d < 2.24 and rnd('vio', seg) > 0.25:
                c = C(VIOLET if (x // 3 + y // 3) % 2 else VIOLET_L)
            elif 2.05 < d < 2.34 and rnd('vio', seg) > 0.25:
                c = mix(c, VIOLET_G, 0.45)
            px(im, x, y, c)
    # 裂縫：幾條細細的折線
    for _ in range(26):
        x, y = r.randrange(W), r.randrange(H)
        for _ in range(r.randrange(6, 18)):
            if 0 <= x < W and 0 <= y < H and floor[y][x]:
                px(im, x, y, '#b9b0c9')
            x += r.choice((-1, 1, 1))
            y += r.choice((0, 1))
    # 地板塊的南緣露出一點厚度（看起來是鋪在草地上的石板）
    for y in range(H - 1, 0, -1):
        for x in range(W):
            if floor[y - 1][x] and not floor[y][x] and not im.getpixel((x, y))[3]:
                px(im, x, y, '#cbc3d8')
                if y + 1 < H and not floor[y + 1][x]:
                    px(im, x, y + 1, '#a99fbc')
                if y + 2 < H and not im.getpixel((x, y + 2))[3]:
                    px(im, x, y + 2, (40, 50, 30, 60))
    # 斷牆：白色大理石塊疊成的矮牆，頂端高低不平，比佔地那格往上高出一截
    for (gx, gy), c in sorted(grid.items(), key=lambda kv: kv[0][1]):
        if c != 'R':
            continue
        x0, y0 = (gx - ORIGIN[0]) * T, (gy - ORIGIN[1]) * T
        for x in range(x0, x0 + T):
            col = (x - x0) // 8                                            # 頂端以 8px 為一階，高低不平
            top = y0 - 18 + int(14 * rnd(gx, gy, col))
            if cell(gx - 1, gy) != 'R' and col == 0:
                top += 6
            if cell(gx + 1, gy) != 'R' and col == 3:
                top += 6
            bottom = y0 + T - 4
            for y in range(max(0, top), bottom):
                if y < top + 3:
                    cc = mix(MARBLE_L, '#ffffff', 0.5)                    # 牆頂
                    if (x - x0) % 8 == 7:
                        cc = mix(cc, '#cfc7dc', 0.5)
                else:
                    t = (y - top) / max(1, bottom - top)
                    cc = mix('#f1edf6', '#c3bad3', t)
                    rowb = (y - y0 + 20) // 9
                    if (y - y0 + 20) % 9 == 0 or (x - x0 + (5 if rowb % 2 else 0)) % 12 == 0:
                        cc = mix(cc, '#b3a9c6', 0.45)                       # 石塊之間的縫
                if y == top + 3 and rnd(gx, gy, col, 'g') < 0.5:
                    cc = C(GOLD)                                           # 殘留的金色飾帶
                px(im, x, y, cc)
    # 碎石：散在斷牆與地板塊旁邊的草地上
    spots = [k for k, c in grid.items() if c in 'mR']
    for i in range(34):
        gx, gy = spots[int(rnd('rub', i) * len(spots))]
        x = (gx - ORIGIN[0]) * T + int(rnd('rx', i) * 44) - 6
        y = (gy - ORIGIN[1]) * T + int(rnd('ry', i) * 44) - 6
        if not (0 <= x < W - 12 and 0 <= y < H - 8) or floor[min(H - 1, y + 3)][min(W - 1, x + 3)]:
            continue
        w, h = 3 + int(rnd('rw', i) * 7), 2 + int(rnd('rh', i) * 4)
        rect(im, x, y, x + w, y + h, '#e9e4f0')
        rect(im, x, y + h, x + w, y + h, '#b8b0c6')
        rect(im, x, y, x + w, y, '#fbfaff')
    return im


def hash_k(*k):
    h = 2166136261
    for ch in repr(k):
        h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return h


def blend_px(im, x, y, c):
    br, bg_, bb, ba = im.getpixel((x, y))
    k = c[3] / 255
    if ba == 0:
        im.putpixel((x, y), c)
    else:
        im.putpixel((x, y), (round(br + (c[0] - br) * k), round(bg_ + (c[1] - bg_) * k), round(bb + (c[2] - bb) * k), 255))


def column(broken=False):
    """白色大理石柱：底座、有凹槽的柱身、金色柱頭，上面浮著一顆紫色水晶（斷柱沒有）"""
    im = new(T, T * 3)
    # 底座（佔地那一格）
    rect(im, 4, 84, 27, 93, '#d6d0e0')
    rect(im, 4, 84, 27, 85, MARBLE_L)
    rect(im, 6, 80, 25, 84, MARBLE)
    rect(im, 6, 80, 25, 80, MARBLE_L)
    rect(im, 4, 93, 27, 93, '#a99fbc')
    top = 50 if broken else 20
    for y in range(top, 80):                                 # 柱身：左亮右暗、直的凹槽
        for x in range(8, 24):
            c = mix(MARBLE_L, '#cfc8dc', (x - 8) / 16)
            if x in (11, 15, 19):
                c = mix(c, '#b9b0c9', 0.6)
            if x in (12, 16, 20):
                c = mix(c, '#ffffff', 0.4)
            px(im, x, y, c)
    if broken:
        r = random.Random(9)
        for x in range(8, 24):                               # 斷口參差
            cut = top + r.randrange(0, 6)
            for y in range(top, cut):
                im.putpixel((x, y), (0, 0, 0, 0))
            px(im, x, cut, '#e9e4f0')
        rect(im, 22, 86, 30, 91, '#e6e1ee')                  # 掉在地上的一截
        rect(im, 22, 91, 30, 91, '#b8b0c6')
        rect(im, 25, 86, 25, 90, '#cfc8dc')
    else:
        rect(im, 5, 14, 26, 19, MARBLE)                      # 柱頭
        rect(im, 5, 14, 26, 14, MARBLE_L)
        rect(im, 6, 18, 25, 19, GOLD)
        rect(im, 3, 11, 28, 13, MARBLE_L)
        rect(im, 3, 13, 28, 13, '#cfc8dc')
        for x0 in (3, 25):                                   # 兩側的渦卷
            rect(im, x0, 14, x0 + 3, 17, '#e3ddea')
            px(im, x0 + 1, 15, GOLD)
        for dy, w in ((0, 1), (1, 2), (2, 3), (3, 3), (4, 2), (5, 1)):   # 紫色水晶
            rect(im, 16 - w, 2 + dy, 15 + w, 2 + dy, VIOLET if dy > 2 else VIOLET_L)
        px(im, 15, 3, '#ffffff')
        for x, y in ((11, 4), (20, 2), (13, 0), (19, 7)):
            px(im, x, y, VIOLET_G)
    for x in range(6, 26):                                   # 影子
        px(im, x, 94, (40, 30, 60, 60))
    return im


def altar():
    """中央的召喚台（3×3 格）：兩層白色大理石圓台、金邊，台面是發光的紫色法陣"""
    S = 96
    im = new(S, S)
    cx, cy = 48, 46
    ellipse(im, cx, cy + 8, 46, 34, '#b8b0c6')               # 下層的側面
    ellipse(im, cx, cy + 5, 46, 34, '#ddd7e6')
    ellipse(im, cx, cy + 4, 45, 33, MARBLE)
    ellipse(im, cx, cy + 4, 43, 31, MARBLE_L)
    ellipse(im, cx, cy + 3, 36, 26, '#c9c1d6')               # 上層的側面
    ellipse(im, cx, cy, 36, 26, GOLD)
    ellipse(im, cx, cy - 1, 35, 25, MARBLE)
    ellipse(im, cx, cy - 1, 33, 23, MARBLE_L)
    # 法陣
    for a in range(0, 360, 1):
        ra = math.radians(a)
        for rr, c in ((29, VIOLET_D), (27, VIOLET), (18, VIOLET)):
            px(im, round(cx + math.cos(ra) * rr), round(cy - 1 + math.sin(ra) * rr * 0.7), c)
        if a % 24 < 6:
            px(im, round(cx + math.cos(ra) * 23), round(cy - 1 + math.sin(ra) * 23 * 0.7), VIOLET_L)
    pts = [(cx + math.cos(math.radians(a - 90)) * 26, cy - 1 + math.sin(math.radians(a - 90)) * 26 * 0.7) for a in range(0, 360, 60)]
    from PIL import ImageDraw
    d = ImageDraw.Draw(im)
    for tri in ((0, 2, 4), (1, 3, 5)):                       # 六芒星
        for i in range(3):
            d.line([pts[tri[i]], pts[tri[(i + 1) % 3]]], fill=rgb('#a77cf0'), width=1)
    ellipse(im, cx, cy - 1, 9, 6.5, VIOLET)
    ellipse(im, cx, cy - 1, 6, 4.3, VIOLET_L)
    ellipse(im, cx, cy - 1, 3, 2.2, VIOLET_G)
    px(im, cx - 1, cy - 2, '#ffffff')
    for x, y in pts:
        px(im, round(x), round(y), VIOLET_G)
    for a in (200, 250, 300, 340, 20, 120, 160):                 # 外圈的小金飾
        ra = math.radians(a)
        px(im, round(cx + math.cos(ra) * 44), round(cy + 4 + math.sin(ra) * 32), GOLD)
    return im


def main():
    out = [save(decor_temple(), 'decor', 'temple.png'), save(column(), 'sprites', 'column.png'), save(column(True), 'sprites', 'column-broken.png'),
           save(altar(), 'sprites', 'altar.png')]
    print(f'輸出 {len(out)} 張圖')


if __name__ == '__main__':
    main()
