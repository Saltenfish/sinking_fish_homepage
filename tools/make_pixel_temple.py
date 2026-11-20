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


def rnd(*k):
    return random.Random(hash_k(*k)).random()


# 斜俯視（3/4 視角）的石頭配色：頂面亮、正面暗，石縫與外框用深一點的暖灰
TOP = ['#eee7dc', '#e8e0d3', '#f2ece2', '#e3dbce']      # 石台頂面的石板
PAVE = ['#e4dbcc', '#ddd3c3', '#e8e0d2', '#d6cbb9']     # 地上的石板（比較舊）
GROUT, HILITE, CRACK = '#b3a691', '#fbf8f1', '#9f9282'
FACE_A, FACE_B, MORTAR, FACE_DARK, LIP, LIP_D = '#cdbfac', '#c3b5a1', '#9d8f7c', '#7f725f', '#f6f0e6', '#dcd1c0'
LINE = '#6e6153'                                         # 外框
SHADOW = (24, 52, 28)                                    # 投在草地上的影子（深綠）
FH = 22                                                  # 石台正面的高度（像素）
TUFT = ['#4f8a45', '#6aa65a', '#3f7438']


def decor_temple():
    """召喚神殿遺跡（斜俯視）：墊高的石台（看得到頂面＋正面石牆＋台階）、平鋪在地上的石板、斷牆。
    光從左上來：頂面亮、正面暗、影子落在正下方與右邊的地上"""
    grid = read_ruins()
    W, H = DW * T, DH * T
    im = new(W, H)
    cell = lambda gx, gy: grid.get((gx, gy), '.')        # noqa: E731
    org = lambda gx, gy: ((gx - ORIGIN[0]) * T, (gy - ORIGIN[1]) * T)   # noqa: E731
    stairs = (19, 20)

    shaded = {}

    def shade_rect(x0, y0, x1, y1, a):
        # 影子重疊的地方不要疊得更黑：同一個像素只取最深的那一次
        for y in range(max(0, y0), min(H, y1 + 1)):
            for x in range(max(0, x0), min(W, x1 + 1)):
                if shaded.get((x, y), 0) >= a:
                    continue
                if (x, y) in shaded or im.getpixel((x, y))[3] == 0:
                    shaded[(x, y)] = a
                    im.putpixel((x, y), SHADOW + (a,))
                else:
                    shaded[(x, y)] = a
                    blend_px(im, x, y, SHADOW + (a,))

    def tiles16(gx, gy, palette, worn):
        """一格（32px）裡鋪 2×2 塊方形石板：每塊左上一條亮邊、右下一條石縫，偶爾有裂縫或缺一塊"""
        x0, y0 = org(gx, gy)
        for j in range(2):
            for i in range(2):
                k = (gx, gy, i, j)
                tx, ty = x0 + i * 16, y0 + j * 16
                if worn and rnd('miss', k) < worn:
                    # 缺了一塊：露出底下的土，上緣有一道陰影（看起來凹下去）
                    for y in range(ty, ty + 16):
                        for x in range(tx, tx + 16):
                            n = rnd('soil', x, y)
                            c = '#8f7552' if n < 0.7 else '#7a6244' if n < 0.92 else '#5f4b33'
                            if y < ty + 3:
                                c = '#5a4632'
                            px(im, x, y, c)
                    for t in range(int(rnd('tg', k) * 4)):
                        gx_ = tx + 3 + int(rnd('tgx', k, t) * 10)
                        for h_ in range(3):
                            px(im, gx_, ty + 14 - h_, TUFT[t % 3])
                    continue
                base = palette[int(rnd('tone', k) * len(palette))]
                for y in range(ty, ty + 16):
                    for x in range(tx, tx + 16):
                        c = base
                        if x == tx + 15 or y == ty + 15:
                            c = GROUT
                        elif x == tx or y == ty:
                            c = HILITE
                        elif rnd('spk', x, y) < 0.04:
                            c = mix(base, GROUT, 0.35)
                        px(im, x, y, c)
                if rnd('crack', k) < 0.15:                         # 裂縫
                    x, y = tx + 2 + int(rnd('cx', k) * 11), ty + 2
                    for _ in range(int(6 + rnd('cl', k) * 8)):
                        if tx < x < tx + 15 and ty < y < ty + 15:
                            px(im, x, y, CRACK)
                        x += 1 if rnd('cd', k, x, y) < 0.5 else 0
                        y += 1

    # ── 1. 石台與石板投在地上的影子（先畫，在最底下） ──
    for (gx, gy), c in grid.items():
        x0, y0 = org(gx, gy)
        if c == 'P':
            if cell(gx + 1, gy) != 'P':
                shade_rect(x0 + 32, y0 + 4, x0 + 38, y0 + 31 + (FH if cell(gx, gy + 1) != 'P' else 0), 150)   # 右側
            if cell(gx, gy + 1) != 'P':
                shade_rect(x0 + 1, y0 + 32 + FH + 1, x0 + 37, y0 + 32 + FH + 9, 165)                             # 正面牆腳
        if c == 'm':
            if cell(gx, gy + 1) not in 'mP':
                shade_rect(x0 + 1, y0 + 35, x0 + 33, y0 + 36, 70)
            if cell(gx + 1, gy) not in 'mP':
                shade_rect(x0 + 32, y0 + 2, x0 + 33, y0 + 34, 60)
    # ── 2. 地上的石板：平鋪，邊緣有缺塊、南緣露出一點厚度 ──
    for (gx, gy), c in grid.items():
        if c != 'm':
            continue
        edge = any(cell(gx + i, gy + j) not in 'mP' for i, j in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        tiles16(gx, gy, PAVE, 0.14 if edge else 0.04)
        x0, y0 = org(gx, gy)
        if cell(gx, gy + 1) not in 'mP':
            rect(im, x0, y0 + 32, x0 + 31, y0 + 33, '#b2a48f')
            rect(im, x0, y0 + 34, x0 + 31, y0 + 34, '#8c7e6a')
    # ── 3. 石台頂面 ──
    for (gx, gy), c in grid.items():
        if c != 'P':
            continue
        near = math.hypot(gx + 0.5 - ALTAR_C[0], (gy + 0.5 - ALTAR_C[1]) * 1.25) < 2.4
        edge = any(cell(gx + i, gy + j) != 'P' for i, j in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        tiles16(gx, gy, TOP, 0 if near else (0.05 if edge else 0.015))
        x0, y0 = org(gx, gy)
        # 外緣：上、左受光（亮），右邊暗；最外圈一條深色外框
        if cell(gx, gy - 1) != 'P':
            rect(im, x0, y0, x0 + 31, y0, LINE)
            rect(im, x0, y0 + 1, x0 + 31, y0 + 2, LIP)
        if cell(gx - 1, gy) != 'P':
            rect(im, x0, y0, x0, y0 + 31, LINE)
            rect(im, x0 + 1, y0, x0 + 2, y0 + 31, LIP)
        if cell(gx + 1, gy) != 'P':
            rect(im, x0 + 31, y0, x0 + 31, y0 + 31, LINE)
            rect(im, x0 + 29, y0 + 1, x0 + 30, y0 + 31, LIP_D)
    # 殘留的鑲嵌：以召喚台為中心的金色環與紫色符文環（斷斷續續，只畫在石台頂面的石板上）
    for y in range(H):
        for x in range(W):
            gx, gy = ORIGIN[0] + x // T, ORIGIN[1] + y // T
            if cell(gx, gy) != 'P':
                continue
            cur = im.getpixel((x, y))
            if cur[:3] in (rgb(GROUT)[:3], rgb('#8f7552')[:3]):
                continue
            d = math.hypot((ORIGIN[0] * T + x + 0.5) / T - ALTAR_C[0], ((ORIGIN[1] * T + y + 0.5) / T - ALTAR_C[1]) * 1.25)
            ang = math.atan2(((ORIGIN[1] * T + y + 0.5) / T - ALTAR_C[1]) * 1.25, (ORIGIN[0] * T + x + 0.5) / T - ALTAR_C[0])
            seg = int((ang + math.pi) / math.tau * 14)
            if 2.95 < d < 3.08 and rnd('gold', seg) > 0.35:
                px(im, x, y, GOLD_L if d < 3.01 else GOLD)
            elif 2.15 < d < 2.24 and rnd('vio', seg) > 0.25:
                px(im, x, y, VIOLET if (x // 3 + y // 3) % 2 else VIOLET_L)
    # ── 4. 石台正面：一道石磚牆（看得到的那一面），中間是台階 ──
    for (gx, gy), c in grid.items():
        if c != 'P' or cell(gx, gy + 1) == 'P':
            continue
        x0, y0 = org(gx, gy)
        y0 += 32
        if gx in stairs:
            # 台階：三階，每階有亮的踏面和暗的立面
            for k in range(3):
                sy = y0 + k * 6
                rect(im, x0, sy, x0 + 31, sy + 2, LIP if k == 0 else '#ebe3d6')
                rect(im, x0, sy + 3, x0 + 31, sy + 5, FACE_A if k < 2 else FACE_B)
                rect(im, x0, sy + 5, x0 + 31, sy + 5, MORTAR)
            if gx == stairs[0]:
                rect(im, x0, y0, x0 + 1, y0 + 17, LINE)
            if gx == stairs[-1]:
                rect(im, x0 + 30, y0, x0 + 31, y0 + 17, LINE)
            rect(im, x0, y0 + 18, x0 + 31, y0 + 18, LINE)
            continue
        for y in range(y0, y0 + FH):
            row = (y - y0) // 5
            for x in range(x0, x0 + 32):
                cc = FACE_A if ((x + (8 if row % 2 else 0)) // 16 + row) % 2 else FACE_B
                if (y - y0) % 5 == 4 or (x + (8 if row % 2 else 0)) % 16 == 0:
                    cc = MORTAR
                if y >= y0 + FH - 2:
                    cc = FACE_DARK
                if y == y0:
                    cc = LINE
                px(im, x, y, cc)
            if rnd('brk', gx, row) < 0.25:                              # 幾塊破掉的磚
                bx = x0 + int(rnd('bx', gx, row) * 24)
                rect(im, bx, y0 + row * 5 + 1, bx + 5, y0 + row * 5 + 3, '#a89a86')
        rect(im, x0, y0 + FH, x0 + 31, y0 + FH, LINE)
        if cell(gx - 1, gy) != 'P' and cell(gx - 1, gy + 1) != 'P':
            rect(im, x0, y0, x0, y0 + FH, LINE)
        if cell(gx + 1, gy) != 'P':
            rect(im, x0 + 31, y0, x0 + 31, y0 + FH, LINE)
    # ── 5. 斷牆：斜俯視的石塊，看得到頂面（亮）與正面（磚、暗），頂端高低不平 ──
    for (gx, gy), c in sorted(grid.items(), key=lambda kv: kv[0][1]):
        if c != 'R':
            continue
        x0, y0 = org(gx, gy)
        below = cell(gx, gy + 1) == 'R'
        left, right = cell(gx - 1, gy) == 'R', cell(gx + 1, gy) == 'R'
        shade_rect(x0 + 1, y0 + 30, x0 + 36, y0 + 37, 160)
        if not right:
            shade_rect(x0 + 32, y0 - 6, x0 + 37, y0 + 30, 140)
        for x in range(x0, x0 + 32):
            col = (x - x0) // 8
            ht = 10 + int(10 * rnd('wh', gx, gy, col))                   # 牆的高度（頂面往上抬多少）
            if not left and col == 0:
                ht -= 6
            if not right and col == 3:
                ht -= 6
            top_y = y0 - ht
            face_y = y0 + 6 - (0 if not below else 40)
            for y in range(max(0, top_y), y0 + 30 if not below else y0 + 32):
                if y < top_y + 10 or below:
                    cc = mix(LIP, '#e9e1d4', (y - top_y) / 10) if not below else '#e6ded0'   # 頂面
                    if y == top_y:
                        cc = LINE
                else:
                    row = (y - top_y - 10) // 6
                    cc = FACE_A if ((x + (8 if row % 2 else 0)) // 12 + row) % 2 else FACE_B
                    if (y - top_y - 10) % 6 == 5 or (x + (8 if row % 2 else 0)) % 12 == 0:
                        cc = MORTAR
                    if y == top_y + 10:
                        cc = '#b9ab97'
                    if y >= y0 + 27:
                        cc = FACE_DARK
                px(im, x, y, cc)
            if not below:
                px(im, x, y0 + 29, LINE)
        if not left:
            rect(im, x0, y0 - 4, x0, y0 + 29, LINE)
        if not right:
            rect(im, x0 + 31, y0 - 4, x0 + 31, y0 + 29, LINE)
        del face_y
    # ── 6. 柱子腳下的接觸影（柱子本身是另外的圖，站在這上面） ──
    for broken, gx, gy in read_columns():
        x0, y0 = org(gx, gy)
        for y in range(y0 + 22, y0 + 34):
            for x in range(x0 - 2, x0 + 38):
                dx, dy = (x + 0.5 - (x0 + 19)) / 19, (y + 0.5 - (y0 + 28)) / 5.5
                if dx * dx + dy * dy <= 1 and 0 <= x < W and 0 <= y < H:
                    blend_px(im, x, y, SHADOW + (120,))
    # ── 7. 草：從石板邊緣、石縫冒出來的一叢一叢深綠色小草 ──
    for i in range(900):
        keys = [k for k, c in grid.items() if c in 'mPR']
        gx, gy = keys[int(rnd('tk', i) * len(keys))]
        x0, y0 = org(gx, gy)
        x, y = x0 + int(rnd('tx', i) * 40) - 4, y0 + int(rnd('ty', i) * 40) - 4
        if not (2 <= x < W - 3 and 4 <= y < H):
            continue
        cur = im.getpixel((x, y))
        if cur[3] > 0:
            continue                                                       # 只長在石頭外面（草地上、緊貼著石頭）
        if not any(im.getpixel((min(W - 1, max(0, x + dx)), min(H - 1, max(0, y + dy))))[3] > 200 for dx, dy in ((3, 0), (-3, 0), (0, 3), (0, -3))):
            continue
        for t, (dx, h_) in enumerate(((0, 3), (1, 4), (2, 2), (-1, 2))):
            for k in range(h_):
                px(im, x + dx, y - k, TUFT[(t + i) % 3])
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


def outline(im, color=None, skip=lambda c: False):
    """在整個外形外面描一圈深色外框（斜俯視像素圖的物件都有一圈這樣的框，才會從地面跳出來）"""
    color = color or LINE
    W_, H_ = im.size
    src = im.copy()
    for y in range(H_):
        for x in range(W_):
            if src.getpixel((x, y))[3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                X, Y = x + dx, y + dy
                if 0 <= X < W_ and 0 <= Y < H_:
                    c = src.getpixel((X, Y))
                    if c[3] > 128 and not skip(c):
                        px(im, x, y, color)
                        break
    return im


# 柱身每一直排的顏色（由左到右）：左邊受光、偏左有一條最亮的高光、右邊進入陰影 → 看起來是圓柱
SHAFT = ['#d8cebe', '#efe8dc', '#f7f2e9', '#ffffff', '#f3ede2', '#ebe3d6', '#e4dbcd', '#ddd3c4',
         '#d5cab9', '#cbbfad', '#c0b3a0', '#b3a692', '#a6987f', '#998b74']


def column(broken=False):
    """斜俯視的白色石柱：方形柱礎（看得到頂面和正面）、圓柱柱身（左亮右暗）、
    柱頭（頂板也看得到頂面），外面一圈深色外框；柱頂浮著一顆紫水晶（斷柱沒有）。
    影子畫在佈景圖 decor.temple 裡（柱腳下的接觸影）"""
    r = random.Random(9 if broken else 8)
    im = new(T, T * 3)
    # 柱礎：頂面（亮）＋正面（暗）
    rect(im, 4, 75, 27, 79, '#f3ede3')
    rect(im, 4, 75, 27, 75, '#ffffff')
    rect(im, 26, 75, 27, 79, '#ddd3c4')
    rect(im, 4, 80, 27, 88, FACE_A)
    rect(im, 4, 84, 27, 84, MORTAR)
    rect(im, 15, 80, 15, 83, MORTAR)
    rect(im, 9, 85, 9, 88, MORTAR)
    rect(im, 21, 85, 21, 88, MORTAR)
    rect(im, 4, 88, 27, 88, FACE_DARK)
    rect(im, 22, 80, 27, 88, mix(FACE_A, FACE_DARK, 0.35))
    # 柱腳的圓盤（環）
    for x in range(7, 25):
        c = SHAFT[min(13, max(0, (x - 7) * 14 // 18))]
        rect(im, x, 71, x, 74, c)
        px(im, x, 71, mix(c, '#ffffff', 0.5))
        px(im, x, 74, mix(c, FACE_DARK, 0.4))
    top = 46 if broken else 22
    for y in range(top, 71):                                 # 柱身
        for i, c in enumerate(SHAFT):
            x = 9 + i
            cc = c
            if i in (2, 6, 10) and y % 2 == 0:
                cc = mix(c, '#b9ad99', 0.25)                 # 淡淡的凹槽
            px(im, x, y, cc)
    for y in range(62, 71):                                  # 柱腳的青苔
        for x in range(9, 23):
            if r.random() < (y - 61) / 16:
                px(im, x, y, mix(im.getpixel((x, y)), '#6f8f52', 0.6))
    for _ in range(2):                                       # 細裂縫
        x, y = r.randrange(11, 20), r.randrange(top + 4, 60)
        for _ in range(r.randrange(4, 8)):
            px(im, x, y, '#a89a86')
            x += r.choice((-1, 0, 1))
            y += 1
    if broken:
        for x in range(9, 23):                               # 斷口：參差的頂，斷面亮
            cut = top + r.randrange(0, 7)
            for y in range(top, cut):
                im.putpixel((x, y), (0, 0, 0, 0))
            px(im, x, cut, '#fbf7ef')
            px(im, x, cut + 1, '#efe7da')
        x0, y0 = 22, 89                                      # 掉在地上的一截
        rect(im, x0, y0, x0 + 8, y0 + 4, '#e2d9ca')
        rect(im, x0, y0, x0 + 8, y0, '#f7f2e9')
        rect(im, x0, y0 + 4, x0 + 8, y0 + 4, '#a6987f')
        rect(im, x0 - 1, y0, x0 + 1, y0 + 4, '#f3ede3')
    else:
        # 柱頭：圓盤＋方形頂板（頂面亮、正面暗）＋金色飾帶
        for x in range(6, 26):
            c = SHAFT[min(13, max(0, (x - 6) * 14 // 20))]
            rect(im, x, 17, x, 21, c)
        rect(im, 7, 20, 24, 21, GOLD)
        rect(im, 7, 20, 10, 20, GOLD_L)
        rect(im, 3, 8, 28, 11, '#f6f1e8')
        rect(im, 3, 8, 28, 8, '#ffffff')
        rect(im, 3, 12, 28, 16, FACE_A)
        rect(im, 3, 16, 28, 16, FACE_DARK)
        rect(im, 23, 12, 28, 16, mix(FACE_A, FACE_DARK, 0.35))
        rect(im, 27, 8, 28, 11, '#ddd3c4')
    outline(im)
    if not broken:
        for dy, w in ((0, 1), (1, 2), (2, 3), (3, 3), (4, 2), (5, 1)):   # 紫色水晶（浮在柱頂上）
            rect(im, 16 - w, dy, 15 + w, dy, VIOLET if dy > 2 else VIOLET_L)
        px(im, 15, 1, '#ffffff')
        for x, y in ((11, 2), (20, 0), (21, 5)):
            px(im, x, y, VIOLET_G)
    return im


def read_columns():
    """從 town.js 讀出柱子的位置（佈景圖要在它們腳下畫墊石與影子）"""
    src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'data', 'maps', 'town.js'), encoding='utf8').read()
    return [(sp.endswith('broken'), int(x), int(y)) for sp, x, y in
            re.findall(r"id: 'col\d+', type: 'deco', sprite: '([^']+)', x: (\d+), y: (\d+)", src)]


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
