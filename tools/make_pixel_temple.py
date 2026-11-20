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
TOP = ['#d9ccb9', '#d3c5b1', '#ddd1bf', '#cfc1ac']      # 石台頂面的石板（比白色柱子深一點，柱子才站得出來）
PAVE = ['#cbbda8', '#c4b5a0', '#d0c3af', '#bdae98']     # 地上的石板（比較舊、比較暗）
GROUT, HILITE, CRACK = '#9c8c75', '#f3ebdd', '#8f806b'
FACE_A, FACE_B, MORTAR, FACE_DARK, LIP, LIP_D = '#bfae98', '#b5a48d', '#8e7f6b', '#74664f', '#efe6d6', '#cdbfa8'
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
        """一格（32px）的石板地：有的格子是一整塊大石板，有的切成 2×2 小塊。
        石縫只是比石頭深一點、不畫亮邊（才不會像浴室磁磚）；偶爾有短裂縫、髒污或缺一塊"""
        x0, y0 = org(gx, gy)
        big = rnd('big', gx, gy) < 0.45
        slabs = [(0, 0, 32)] if big else [(i * 16, j * 16, 16) for j in range(2) for i in range(2)]
        for (ox_, oy_, sz) in slabs:
            k = (gx, gy, ox_, oy_)
            tx, ty = x0 + ox_, y0 + oy_
            if worn and sz == 16 and rnd('miss', k) < worn:
                # 缺了一塊：露出底下的土，上緣有一道陰影（看起來凹下去）
                for y in range(ty, ty + 16):
                    for x in range(tx, tx + 16):
                        n = rnd('soil', x, y)
                        c = '#8a7050' if n < 0.7 else '#765e42' if n < 0.92 else '#5f4b33'
                        if y < ty + 3:
                            c = '#4f3d2b'
                        px(im, x, y, c)
                for t in range(int(rnd('tg', k) * 4)):
                    gx_ = tx + 3 + int(rnd('tgx', k, t) * 10)
                    for h_ in range(3):
                        px(im, gx_, ty + 14 - h_, TUFT[t % 3])
                continue
            base = C(palette[int(rnd('tone', k) * len(palette))])
            stain = rnd('stain', k) < 0.1
            for y in range(ty, ty + sz):
                for x in range(tx, tx + sz):
                    c = base
                    if x == tx + sz - 1 or y == ty + sz - 1:
                        c = mix(base, GROUT, 0.75)                     # 石縫（右、下）
                    elif y == ty and rnd('hl', x) < 0.7:
                        c = mix(base, '#ffffff', 0.18)                 # 上緣很淡的受光
                    else:
                        n = rnd('spk', x, y)
                        if n < 0.06:
                            c = mix(base, GROUT, 0.3)                  # 石頭表面的小斑點
                        elif n > 0.97:
                            c = mix(base, '#ffffff', 0.25)
                        if stain and (x - tx - sz / 2) ** 2 + (y - ty - sz / 2) ** 2 < (sz / 3) ** 2 and rnd('st', x // 2, y // 2) < 0.5:
                            c = mix(c, '#8f8a6a', 0.12)                # 舊舊的髒污、苔痕
                    px(im, x, y, c)
            if rnd('crack', k) < 0.12:                                 # 短裂縫
                x, y = tx + 3 + int(rnd('cx', k) * (sz - 8)), ty + 3
                for _ in range(int(4 + rnd('cl', k) * 5)):
                    if tx < x < tx + sz - 1 and ty < y < ty + sz - 1:
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
    # ── 2. 倒塌散落的石塊：不是平鋪的地磚，而是從神殿掉下來、散在草地上的一塊一塊石板和碎石。
    #        每塊都是斜俯視的小石塊：頂面（亮、有時歪一點）＋正面（暗）＋深色外框＋右下的影子；
    #        有的平躺、有的斜插在土裡只露出一角；旁邊有小碎石和從石塊底下冒出來的草 ──
    from PIL import Image as _I

    def stone_block(w, d, h, skew, tone, rk):
        """畫一塊石頭到小圖上，回傳 (圖, 底部 y)"""
        Wt, Ht = w + abs(skew) + 4, d + h + 4
        b = _I.new('RGBA', (Wt, Ht), (0, 0, 0, 0))
        ox_ = 2 + max(0, -skew)
        top = C(tone)
        for r_ in range(d):                                         # 頂面：越往上越往 skew 方向偏（看起來歪著）
            sh = round(skew * (d - 1 - r_) / max(1, d - 1))
            for i in range(w):
                if (r_ == 0 and (i == 0 or i == w - 1)) and rnd(rk, 'corner', i) < 0.8:
                    continue                                        # 磨圓的角
                if r_ < 2 and i < 2 and rnd(rk, 'chip') < 0.5:
                    continue                                        # 缺角
                c = top
                if r_ == 0:
                    c = mix(top, '#ffffff', 0.35)
                elif i == 0:
                    c = mix(top, '#ffffff', 0.15)
                elif i == w - 1:
                    c = mix(top, GROUT, 0.35)
                elif rnd(rk, 'spk', i, r_) < 0.08:
                    c = mix(top, GROUT, 0.3)
                b.putpixel((ox_ + sh + i, 2 + r_), c)
        for r_ in range(h):                                         # 正面：比較暗，最下面一條最暗
            for i in range(w):
                c = mix(C(FACE_A), C(FACE_DARK), r_ / max(1, h))
                if i >= w - 2:
                    c = mix(c, C(FACE_DARK), 0.4)
                b.putpixel((ox_ + i, 2 + d + r_), c)
        if rnd(rk, 'crack') < 0.35 and w > 8:                       # 一道裂縫從頂面裂到正面
            cx_ = ox_ + 3 + int(rnd(rk, 'cx') * (w - 6))
            for yy in range(2, 2 + d + h):
                if cx_ < Wt and b.getpixel((cx_, yy))[3]:
                    b.putpixel((cx_, yy), C(CRACK))
                cx_ += 1 if rnd(rk, 'cd', yy) < 0.3 else 0
        outline(b)
        return b, 2 + d + h

    pieces = []
    for (gx, gy), c in grid.items():
        if c != 'm':
            continue
        x0, y0 = org(gx, gy)
        n = 1 + int(rnd('np', gx, gy) * 2.6)
        for i in range(n):
            k = ('pc', gx, gy, i)
            kind = rnd(k, 'kind')
            if kind < 0.6:                                          # 平躺的石板
                w, d, h = 12 + int(rnd(k, 'w') * 12), 8 + int(rnd(k, 'd') * 6), 3 + int(rnd(k, 'h') * 2)
            elif kind < 0.85:                                       # 斜插在土裡、只露出一角
                w, d, h = 8 + int(rnd(k, 'w') * 8), 3 + int(rnd(k, 'd') * 3), 7 + int(rnd(k, 'h') * 5)
            else:                                                   # 方正的石塊
                w, d, h = 10 + int(rnd(k, 'w') * 6), 6 + int(rnd(k, 'd') * 4), 8 + int(rnd(k, 'h') * 4)
            skew = int(rnd(k, 'sk') * 7) - 3
            tone = PAVE[int(rnd(k, 'tone') * len(PAVE))]
            x = x0 + int(rnd(k, 'x') * max(1, 32 - w)) - 3
            y = y0 + int(rnd(k, 'y') * max(1, 30 - d - h)) - 2
            pieces.append((y + d + h, x, y, w, d, h, skew, tone, k))
        for i in range(3 + int(rnd('nr', gx, gy) * 5)):             # 小碎石
            k = ('rb', gx, gy, i)
            w = 3 + int(rnd(k, 'w') * 4)
            pieces.append((0, x0 + int(rnd(k, 'x') * 34) - 2, y0 + int(rnd(k, 'y') * 32), w, 2, 1 + int(rnd(k, 'h') * 2), 0,
                           PAVE[int(rnd(k, 't') * len(PAVE))], k))
    pieces = [(y + d + h, x, y, w, d, h, sk, t, k) for (_, x, y, w, d, h, sk, t, k) in pieces]
    for bot, x, y, w, d, h, sk, tone, k in sorted(pieces):
        b, bh = stone_block(w, d, h, sk, tone, k)
        # 影子：往右下，深綠色
        for yy in range(b.size[1]):
            for xx in range(b.size[0]):
                if b.getpixel((xx, yy))[3]:
                    X, Y = x + xx + 2, y + yy + 3
                    if 0 <= X < W and 0 <= Y < H and not (0 <= x + xx < W and 0 <= y + yy < H and im.getpixel((min(W - 1, x + xx + 2), min(H - 1, y + yy + 3)))[3] > 200):
                        shade_rect(X, Y, X, Y, 150)
        for yy in range(b.size[1]):
            for xx in range(b.size[0]):
                c = b.getpixel((xx, yy))
                if c[3] and 0 <= x + xx < W and 0 <= y + yy < H:
                    px(im, x + xx, y + yy, c)
        if w > 6 and rnd(k, 'tuft') < 0.55:                          # 石塊底下冒出來的草
            for t in range(2 + int(rnd(k, 'tn') * 3)):
                tx = x + 2 + int(rnd(k, 'tx', t) * (w + 2))
                ty = y + bh - 1 + int(rnd(k, 'ty', t) * 2)
                for hh in range(2 + int(rnd(k, 'th', t) * 3)):
                    if 0 <= tx < W and 0 <= ty - hh < H:
                        px(im, tx + (1 if hh == 2 and t % 2 else 0), ty - hh, TUFT[(t + hh) % 3])
    # ── 3. 石台頂面 ──
    for (gx, gy), c in grid.items():
        if c != 'P':
            continue
        near = math.hypot(gx + 0.5 - ALTAR_C[0], (gy + 0.5 - ALTAR_C[1]) * 1.25) < 2.4
        edge = any(cell(gx + i, gy + j) != 'P' for i, j in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        tiles16(gx, gy, TOP, 0 if near else (0.05 if edge else 0.015))
        x0, y0 = org(gx, gy)
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
    # ── 3b. 石台的邊石：沿著石台外緣一圈比較亮、比較大的石塊（像參考圖裡平台邊緣的那圈框），
    #        把地板框起來，看起來是一個墊高的台子，而不是一片貼在草上的磁磚 ──
    CURB, CURB_L, CURB_D, CW = '#efe6d6', '#fbf6ec', '#a8977d', 7
    for (gx, gy), c in grid.items():
        if c != 'P':
            continue
        x0, y0 = org(gx, gy)
        sides = {'n': cell(gx, gy - 1) != 'P', 's': cell(gx, gy + 1) != 'P', 'w': cell(gx - 1, gy) != 'P', 'e': cell(gx + 1, gy) != 'P'}
        for y in range(y0, y0 + 32):
            for x in range(x0, x0 + 32):
                lx, ly = x - x0, y - y0
                on = (sides['n'] and ly < CW) or (sides['s'] and ly >= 32 - CW) or (sides['w'] and lx < CW) or (sides['e'] and lx >= 32 - CW)
                # 內角：旁邊兩格是石台、斜角不是 → 補一小塊邊石把角接起來
                for dx, dy, cx_, cy_ in ((-1, -1, 0, 0), (1, -1, 31, 0), (-1, 1, 0, 31), (1, 1, 31, 31)):
                    if cell(gx + dx, gy + dy) != 'P' and not on and abs(lx - cx_) < CW and abs(ly - cy_) < CW:
                        on = True
                if not on:
                    continue
                seg = ((x if (sides['n'] or sides['s']) and not (sides['w'] and lx < CW) and not (sides['e'] and lx >= 32 - CW) else y) // 16)
                cc = CURB
                edge_in = (sides['n'] and ly == CW - 1) or (sides['s'] and ly == 32 - CW) or (sides['w'] and lx == CW - 1) or (sides['e'] and lx == 32 - CW)
                if (sides['n'] and ly == 0) or (sides['w'] and lx == 0):
                    cc = LINE
                elif (sides['s'] and ly == 31) or (sides['e'] and lx == 31):
                    cc = LINE
                elif edge_in:
                    cc = CURB_D                                            # 邊石和地板交界的一道暗線
                elif (sides['n'] and ly == 1) or (sides['w'] and lx == 1):
                    cc = CURB_L
                elif (x + y) % 16 == 0 and rnd('cs', seg) < 0.8:
                    cc = CURB_D                                            # 邊石之間的接縫
                elif rnd('cspk', x, y) < 0.05:
                    cc = mix(CURB, CURB_D, 0.4)
                px(im, x, y, cc)
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
                    shade_rect(x, y, x, y, 130)
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
