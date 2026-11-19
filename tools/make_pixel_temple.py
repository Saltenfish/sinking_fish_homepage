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
from make_pixel_assets import new, px, rect, ellipse, rgb, save, strip, volumize  # noqa: E402

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
    # ── 地面：一塊一塊不規則的石板平鋪在地上（俯視），不是砌牆的磚 ──
    # 石板形狀用「抖動格點的最近點」切出來（每塊約 18px），石板之間的縫長了青苔；
    # 靠外圍的石板有些整塊不見（露出草地），中間偶爾少一塊（露出泥土）。
    S = 18
    seeds = {}
    for cy_ in range(-1, H // S + 2):
        for cx_ in range(-1, W // S + 2):
            seeds[(cx_, cy_)] = (cx_ * S + 3 + rnd('sx', cx_, cy_) * (S - 6), cy_ * S + 3 + rnd('sy', cx_, cy_) * (S - 6))

    def stone_at(x, y):
        cx_, cy_ = int(x // S), int(y // S)
        best = second = 1e9
        bid = None
        for j in (-1, 0, 1):
            for i in (-1, 0, 1):
                k = (cx_ + i, cy_ + j)
                sx_, sy_ = seeds[k]
                d = (x - sx_) ** 2 + (y - sy_) ** 2
                if d < best:
                    second, best, bid = best, d, k
                elif d < second:
                    second = d
        return bid, math.sqrt(second) - math.sqrt(best)

    def stone_tile(k):
        sx_, sy_ = seeds[k]
        return ORIGIN[0] + int(min(W - 1, max(0, sx_)) // T), ORIGIN[1] + int(min(H - 1, max(0, sy_)) // T)

    def edge_dist(gx, gy):
        """這塊石板所在的格子離草地多近（0＝就在邊上）"""
        for r_ in range(0, 3):
            if any(cell(gx + i, gy + j) != 'm' for i in range(-r_, r_ + 1) for j in range(-r_, r_ + 1)):
                return r_
        return 3

    STONES = ['#efebe4', '#e9e5df', '#f3f0ea', '#e2ddd8', '#ece8e1', '#dedad3']   # 和柱子同一組暖白色
    # 先算出每一塊石板的「頂面」（縫以外的部分）與顏色，再像土堆那樣一層一層疊出立體感：
    #   草地上的影子 → 石板的側面（頂面往下 3px 的厚度，比較暗）→ 頂面（上緣受光、下緣稍暗）
    # 石板之間的縫看得到下面那塊的側面和深色的土與青苔，所以每塊石板都像微微凸起、嵌在地上。
    top = [[None] * W for _ in range(H)]          # 頂面的顏色
    patch = [[False] * W for _ in range(H)]       # 整片地板（含縫）
    dirt = set()
    for y in range(H):
        for x in range(W):
            gx, gy = ORIGIN[0] + x // T, ORIGIN[1] + y // T
            k, gap = stone_at(x + 0.5, y + 0.5)
            sgx, sgy = stone_tile(k)
            if cell(sgx, sgy) != 'm':                                        # 石板中心落在地板格上才有這塊石板：
                continue                                                     # 邊緣就會沿著石板的形狀，不會是方的
            if cell(gx, gy) != 'm' and gap < 1.6:
                continue
            near_altar = math.hypot(sgx + 0.5 - ALTAR_C[0], (sgy + 0.5 - ALTAR_C[1]) * 1.25) < 2.6
            ed = edge_dist(gx, gy)
            if not near_altar and ed <= 1 and rnd('gone', k) < (0.42 if ed == 0 else 0.18):
                continue                                                     # 整塊不見，露出草地
            patch[y][x] = True
            if not near_altar and ed >= 1 and rnd('dirt', k) < 0.07:        # 少一塊，露出泥土（凹下去）
                dirt.add((x, y))
                continue
            if gap < 1.6:
                continue                                                     # 縫
            lx, ly = x % T, y % T
            c = C(STONES[int(rnd('tone', k) * len(STONES))])
            if (x, y) in veins:
                c = mix(c, '#cdc6d3', 0.45)
            # 殘留的鑲嵌：以召喚台為中心的金色環與紫色符文環，斷斷續續
            d = altar_d(gx, gy, lx, ly)
            ang = math.atan2((gy + (ly + 0.5) / T - ALTAR_C[1]) * 1.25, gx + (lx + 0.5) / T - ALTAR_C[0])
            seg = int((ang + math.pi) / math.tau * 14)
            if 2.95 < d < 3.08 and rnd('gold', seg) > 0.35:
                c = C(GOLD_L if d < 3.01 else GOLD)
            if 2.15 < d < 2.24 and rnd('vio', seg) > 0.25:
                c = C(VIOLET if (x // 3 + y // 3) % 2 else VIOLET_L)
            elif 2.05 < d < 2.34 and rnd('vio', seg) > 0.25:
                c = mix(c, VIOLET_G, 0.45)
            top[y][x] = c
    istop = lambda x, y: 0 <= x < W and 0 <= y < H and top[y][x] is not None   # noqa: E731
    DEPTH = 3
    # 1) 草地上的影子：整片地板往右下錯開的地方
    for y in range(H):
        for x in range(W):
            if patch[y][x]:
                continue
            for dx, dy in ((-1, -2), (0, -3), (-2, -4), (-2, -5), (-1, -5), (0, -1)):
                X, Y = x + dx, y + dy
                if 0 <= X < W and 0 <= Y < H and patch[Y][X]:
                    blend_px(im, x, y, (30, 48, 26, 120))
                    break
    # 2) 縫與泥土：深色的土，縫裡長青苔
    for y in range(H):
        for x in range(W):
            if not patch[y][x] or istop(x, y):
                continue
            if (x, y) in dirt:
                n = rnd('soil', x, y)
                c = C('#8f7552') if n < 0.7 else C('#7a6244') if n < 0.92 else C('#5f4b33')
                if n > 0.985:
                    c = C('#6fa85a')
            else:
                c = C('#6f7d55') if rnd('moss', x, y) < 0.55 else C('#5d5a48')
            px(im, x, y, c)
    # 3) 石板的側面（厚度）：頂面往下 DEPTH 像素，被別的頂面蓋住的地方不畫
    for y in range(H):
        for x in range(W):
            if not istop(x, y):
                continue
            for d_ in range(1, DEPTH + 1):
                if y + d_ < H and not istop(x, y + d_) and (patch[y + d_][x] or d_ <= DEPTH):
                    px(im, x, y + d_, C('#b9b0a4') if d_ == 1 else C('#9d9488') if d_ == 2 else C('#857c72'))
    # 4) 頂面：上緣與左緣受光、下緣與右緣稍暗
    for y in range(H):
        for x in range(W):
            c = top[y][x]
            if c is None:
                continue
            if not istop(x, y - 1) or not istop(x - 1, y):
                c = mix(c, '#ffffff', 0.6)
            elif not istop(x, y + 1) or not istop(x + 1, y):
                c = mix(c, '#a59d93', 0.35)
            elif not istop(x, y - 2):
                c = mix(c, '#ffffff', 0.25)
            px(im, x, y, c)
    # 細細的裂縫（只在頂面上）
    for _ in range(14):
        x, y = r.randrange(W), r.randrange(H)
        for _ in range(r.randrange(5, 14)):
            if istop(x, y) and istop(x, y - 1) and istop(x, y + 1):
                px(im, x, y, mix(im.getpixel((x, y)), '#8f889a', 0.6))
            x += r.choice((-1, 1, 1))
            y += r.choice((0, 1, -1))
    # 草葉：從地板外緣往石板上長一點
    for i in range(700):
        x, y = int(rnd('gx', i) * W), int(rnd('gy', i) * H)
        if not (2 <= x < W - 2 and 3 <= y < H - 1) or not patch[y][x]:
            continue
        if all(patch[y + j][x + i2] for i2 in (-3, 0, 3) for j in (-3, 0, 3)):
            continue
        hgt = 2 + int(rnd('gh', i) * 3)
        col = '#5f9a4c' if rnd('gc', i) < 0.6 else '#86bd68'
        for t in range(hgt):
            px(im, x, y - t, col)
    column_ground(im)
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
                    cc = mix(ST_TOP, '#ffffff', 0.4)                       # 牆頂
                    if (x - x0) % 8 == 7:
                        cc = mix(cc, ST_SH, 0.5)
                else:
                    t = (y - top) / max(1, bottom - top)
                    cc = mix(ST_MID, ST_SIDE2, t)
                    rowb = (y - y0 + 20) // 9
                    if (y - y0 + 20) % 9 == 0 or (x - x0 + (5 if rowb % 2 else 0)) % 12 == 0:
                        cc = mix(cc, ST_SIDE3, 0.45)                         # 石塊之間的縫
                if y == top + 3 and rnd(gx, gy, col, 'g') < 0.5:
                    cc = C(GOLD)                                           # 殘留的金色飾帶
                px(im, x, y, cc)
    # 碎石：散在斷牆與地板塊旁邊的草地上
    spots = [k for k, c in grid.items() if c in 'mR']
    for i in range(34):
        gx, gy = spots[int(rnd('rub', i) * len(spots))]
        x = (gx - ORIGIN[0]) * T + int(rnd('rx', i) * 44) - 6
        y = (gy - ORIGIN[1]) * T + int(rnd('ry', i) * 44) - 6
        if not (0 <= x < W - 12 and 0 <= y < H - 8) or patch[min(H - 1, y + 3)][min(W - 1, x + 3)]:
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


# 柱子、斷牆和地上的石板用同一組暖白色的石頭色，看起來才是同一個地方的東西
ST_TOP, ST_MID, ST_SH, ST_SIDE1, ST_SIDE2, ST_SIDE3 = '#f6f3ed', '#ebe7e0', '#cfc8bd', '#b9b0a4', '#9d9488', '#857c72'
MOSS, MOSS_D = '#7d9a5c', '#5f7a45'


def column(broken=False):
    """白色大理石柱（和地板同一種石頭色）：底座、有凹槽的柱身、金色柱頭，上面浮著一顆紫色水晶（斷柱沒有）。
    柱子的影子與腳下的墊石畫在佈景圖 decor.temple 裡（和地板同一層），這裡不畫影子"""
    r = random.Random(9 if broken else 8)
    im = new(T, T * 3)
    # 底座：頂面（受光）＋正面（較暗），和地上石板的立體畫法一樣
    rect(im, 4, 82, 27, 85, ST_TOP)
    rect(im, 4, 82, 27, 82, '#ffffff')
    rect(im, 4, 86, 27, 88, ST_SIDE1)
    rect(im, 4, 89, 27, 91, ST_SIDE2)
    rect(im, 4, 92, 27, 92, ST_SIDE3)
    rect(im, 6, 78, 25, 81, ST_MID)
    rect(im, 6, 78, 25, 78, ST_TOP)
    rect(im, 6, 81, 25, 81, ST_SH)
    top = 50 if broken else 20
    for y in range(top, 78):                                 # 柱身：左亮右暗、直的凹槽
        for x in range(8, 24):
            c = mix(ST_TOP, ST_SH, (x - 8) / 15)
            if x in (11, 15, 19):
                c = mix(c, ST_SIDE1, 0.55)
            if x in (12, 16, 20):
                c = mix(c, '#ffffff', 0.35)
            px(im, x, y, c)
    for y in range(70, 78):                                  # 柱腳長了一點青苔、顏色比較舊
        for x in range(8, 24):
            if r.random() < (y - 69) / 14:
                px(im, x, y, mix(im.getpixel((x, y)), MOSS, 0.55))
    for k in range(3):                                       # 幾道細裂縫
        x, y = r.randrange(9, 22), r.randrange(top + 4, 70)
        for _ in range(r.randrange(4, 9)):
            px(im, x, y, ST_SIDE1)
            x += r.choice((-1, 0, 1))
            y += 1
    if broken:
        for x in range(8, 24):                               # 斷口參差
            cut = top + r.randrange(0, 6)
            for y in range(top, cut):
                im.putpixel((x, y), (0, 0, 0, 0))
            px(im, x, cut, ST_TOP)
            px(im, x, cut + 1, '#ffffff')
        rect(im, 22, 87, 30, 90, ST_MID)                     # 掉在地上的一截
        rect(im, 22, 87, 30, 87, ST_TOP)
        rect(im, 22, 91, 30, 92, ST_SIDE2)
        rect(im, 25, 87, 25, 90, ST_SH)
    else:
        rect(im, 5, 14, 26, 19, ST_MID)                      # 柱頭
        rect(im, 5, 14, 26, 14, ST_TOP)
        rect(im, 6, 18, 25, 19, GOLD)
        rect(im, 3, 11, 28, 13, ST_TOP)
        rect(im, 3, 11, 28, 11, '#ffffff')
        rect(im, 3, 13, 28, 13, ST_SH)
        for x0 in (3, 25):                                   # 兩側的渦卷
            rect(im, x0, 14, x0 + 3, 17, ST_SH)
            px(im, x0 + 1, 15, GOLD)
        for dy, w in ((0, 1), (1, 2), (2, 3), (3, 3), (4, 2), (5, 1)):   # 紫色水晶
            rect(im, 16 - w, 2 + dy, 15 + w, 2 + dy, VIOLET if dy > 2 else VIOLET_L)
        px(im, 15, 3, '#ffffff')
        for x, y in ((11, 4), (20, 2), (13, 0), (19, 7)):
            px(im, x, y, VIOLET_G)
    return im


def read_columns():
    """從 town.js 讀出柱子的位置（佈景圖要在它們腳下畫墊石與影子）"""
    src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'data', 'maps', 'town.js'), encoding='utf8').read()
    return [(sp.endswith('broken'), int(x), int(y)) for sp, x, y in
            re.findall(r"id: 'col\d+', type: 'deco', sprite: '([^']+)', x: (\d+), y: (\d+)", src)]


def column_ground(im):
    """每根柱子腳下：一塊比柱座大一點的方形墊石（有厚度，和地上石板同畫法），
    以及往右下拉長、落在地板和草地上的影子（光從左上來，和所有東西一致）"""
    W_, H_ = im.size
    for broken, gx, gy in read_columns():
        ox, oy = (gx - ORIGIN[0]) * T, (gy - ORIGIN[1]) * T
        # 影子：柱子越高影子越長；靠柱腳深、越遠越淡，兩側邊緣柔一點。每個像素只算一次，不會疊出條紋
        L = 30 if broken else 62
        dx_, dy_ = 1 / math.hypot(1, 0.45), 0.45 / math.hypot(1, 0.45)
        sx0, sy0 = ox + 16, oy + 25
        for Y in range(int(sy0 - 10), int(sy0 + L * 0.45 + 10)):
            for X in range(int(sx0 - 4), int(sx0 + L + 6)):
                if not (0 <= X < W_ and 0 <= Y < H_):
                    continue
                vx, vy = X + 0.5 - sx0, Y + 0.5 - sy0
                t = vx * dx_ + vy * dy_
                perp = abs(-vx * dy_ + vy * dx_)
                half = 8.5 - 3.5 * t / L
                if 0 <= t <= L and perp <= half:
                    a = 0.46 * (1 - t / L) + 0.08
                    if perp > half - 1.5:
                        a *= 0.55
                    blend_px(im, X, Y, (38, 34, 30, int(a * 255)))
        # 墊石：頂面 + 正面 + 一點青苔
        x0, x1, y0, y1 = ox - 3, ox + 34, oy + 18, oy + 30
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                c = ST_TOP if y == y0 or x == x0 else ST_MID
                if x == x1:
                    c = ST_SH
                px(im, x, y, c)
        rect(im, x0, y1 + 1, x1, y1 + 2, ST_SIDE1)
        rect(im, x0, y1 + 3, x1, y1 + 3, ST_SIDE2)
        rect(im, x0, y1 + 4, x1, y1 + 4, ST_SIDE3)
        rect(im, x0 + 1, y0 + 2, x1 - 1, y0 + 2, ST_SH)            # 墊石上的一道淺刻線
        r = random.Random(gx * 31 + gy)
        for _ in range(10):
            x, y = r.randrange(x0, x1), y1 + r.randrange(1, 5)
            px(im, x, y, MOSS if r.random() < 0.6 else MOSS_D)
        for _ in range(5):
            x = r.randrange(x0, x1)
            for t in range(r.randrange(2, 4)):
                px(im, x, y1 + 5 - t, MOSS)                          # 從墊石旁冒出的草


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
    out = [save(decor_temple(), 'decor', 'temple.png'), save(volumize(column(), outline=False, cast=False, keep_alpha=True), 'sprites', 'column.png'),
           save(volumize(column(True), outline=False, cast=False), 'sprites', 'column-broken.png'),
           save(altar(), 'sprites', 'altar.png')]
    print(f'輸出 {len(out)} 張圖')


if __name__ == '__main__':
    main()
