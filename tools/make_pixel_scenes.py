#!/usr/bin/env python3
"""產生卡背、許願樹大圖、許願牌、全螢幕畫面背景的暫用像素圖，輸出到 assets/。

用法：  python3 tools/make_pixel_scenes.py        （需要 Pillow）

和 make_pixel_assets.py 一樣：固定亂數種子、每次結果相同；換成自己的圖之後就不要再執行。
許願樹大圖畫完後，會印出許願牌的掛點座標，對應 js/systems/treeLayout.js 的 ANCHORS。
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_pixel_assets import rgb, new, px, rect, ellipse, save  # noqa: E402


def lerp(a, b, t):
    a, b = rgb(a), rgb(b)
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(4))


def blend(im, x, y, c):
    """半透明的顏色疊在原本的像素上（直接 putpixel 會把底下的顏色換成半透明，畫面上會變成怪色）"""
    w, h = im.size
    if not (0 <= x < w and 0 <= y < h):
        return
    br, bg, bb, ba = im.getpixel((x, y))
    r_, g_, b_, a_ = c
    k = a_ / 255
    im.putpixel((x, y), (round(br + (r_ - br) * k), round(bg + (g_ - bg) * k), round(bb + (b_ - bb) * k), max(ba, a_)))


def bands(im, x0, y0, x1, y1, top, bottom, steps=8):
    """垂直漸層，但切成一階一階的色帶（像素風的漸層）"""
    h = y1 - y0 + 1
    for i in range(steps):
        c = lerp(top, bottom, i / (steps - 1))
        rect(im, x0, y0 + i * h // steps, x1, y0 + (i + 1) * h // steps - 1, c)


def dither_edge(im, x0, x1, y, c, r):
    """兩個色帶交界處的棋盤格過渡"""
    for x in range(x0, x1 + 1):
        if (x + y) % 2 == 0 and r.random() < 0.8:
            px(im, x, y, c)


def planks(im, x0, y0, x1, y1, base, dark, light, horizontal=True, size=8, seed=1):
    r = random.Random(seed)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            k = (y - y0) if horizontal else (x - x0)
            c = dark if k % size == 0 else light if k % size == 1 else base
            px(im, x, y, c)
    for _ in range((x1 - x0) * (y1 - y0) // 40):
        x, y = r.randrange(x0, x1 + 1), r.randrange(y0, y1 + 1)
        if im.getpixel((x, y)) == rgb(base):
            px(im, x, y, dark)


def sparkles(im, n, colors, seed, area=None):
    r = random.Random(seed)
    w, h = im.size
    x0, y0, x1, y1 = area or (0, 0, w - 1, h - 1)
    for _ in range(n):
        x, y = r.randrange(x0, x1 + 1), r.randrange(y0, y1 + 1)
        c = r.choice(colors)
        px(im, x, y, c)
        if r.random() < 0.25:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                px(im, x + dx, y + dy, lerp(c if isinstance(c, str) else '#ffffff', '#000000', 0.35))


# ───────────────────────── 卡背 ─────────────────────────
# 構圖：深色厚邊框 + 細金線 + 四角的小紋飾，正中央是一個漩渦狀的橢圓（像要把人吸進去的感覺），
# 漩渦中心有一個發光的小魚徽記。全部是原創圖樣，只借用「神秘漩渦卡背」的氣氛。

BACKS = {
    #           邊框暗,     邊框,      金線,      漩渦暗,     漩渦中,     漩渦亮,     中心光
    'default': ('#1d1430', '#3a2752', '#e0b45a', '#120c1f', '#4a2a7a', '#e08a3c', '#ffe6a8'),
    'sakura':  ('#3a1426', '#7a2f52', '#f6d28a', '#1f0a16', '#8a2f5f', '#f59ac0', '#fff0f6'),
    'tide':    ('#0c2230', '#1d4a63', '#bfe3f0', '#06141d', '#165a7a', '#5fd0e0', '#e8fbff'),
    'star':    ('#0a0a14', '#22223a', '#f3e6b0', '#05050c', '#25285a', '#8fa0ff', '#ffffff'),
}


def card_back(name):
    W, H = 84, 124
    edge_d, edge, gold, sw_d, sw_m, sw_l, glow = BACKS[name]
    r = random.Random(hash(name) % 1000)
    im = new(W, H)
    rect(im, 0, 0, W - 1, H - 1, edge_d)                     # 外框
    rect(im, 2, 2, W - 3, H - 3, edge)
    for _ in range(140):                                      # 邊框的紋理
        x, y = r.randrange(2, W - 2), r.randrange(2, H - 2)
        px(im, x, y, edge_d if r.random() < 0.6 else lerp(edge, '#ffffff', 0.12))
    rect(im, 5, 5, W - 6, H - 6, gold)                        # 金線
    rect(im, 6, 6, W - 7, H - 7, sw_d)                        # 內框的深底
    # 漩渦：橢圓裡每個點依「角度 + 半徑的對數」決定落在哪一條旋臂上
    cx, cy, rx, ry = W / 2 - 0.5, H / 2 - 0.5, 33, 47
    for y in range(7, H - 7):
        for x in range(7, W - 7):
            dx, dy = (x - cx) / rx, (y - cy) / ry
            d = math.hypot(dx, dy)
            if d > 1:
                continue
            a = math.atan2(dy, dx)
            v = math.sin(3 * a + 7.5 * math.log(d + 0.06))   # 三條旋臂
            k = (1 - d) ** 0.8                                 # 越靠中心越亮
            t = (v * 0.5 + 0.5) * 0.65 + k * 0.55
            c = sw_d if t < 0.32 else sw_m if t < 0.62 else sw_l if t < 0.95 else glow
            if (x + y) % 2 and 0.29 < t < 0.35:                # 交界的棋盤格過渡
                c = sw_m
            if (x + y) % 2 and 0.6 < t < 0.65:
                c = sw_l
            px(im, x, y, c)
    for a in range(0, 360, 2):                                # 橢圓外圈的金框與小點
        x = round(cx + math.cos(math.radians(a)) * (rx + 1.5))
        y = round(cy + math.sin(math.radians(a)) * (ry + 1.5))
        px(im, x, y, gold)
        if a % 30 == 0:
            px(im, round(cx + math.cos(math.radians(a)) * (rx + 4)), round(cy + math.sin(math.radians(a)) * (ry + 4)), gold)
    # 中心的小魚徽記
    ellipse(im, cx, cy, 5.5, 3.2, glow)
    for k in range(3):
        rect(im, round(cx) - 6 - k, round(cy) - k, round(cx) - 6 - k, round(cy) + k, glow)
    px(im, round(cx) + 2, round(cy) - 1, sw_d)
    # 四角紋飾：一個小菱形加兩段弧
    for (x0, y0, sx, sy) in ((8, 8, 1, 1), (W - 9, 8, -1, 1), (8, H - 9, 1, -1), (W - 9, H - 9, -1, -1)):
        for k in range(6):
            px(im, x0 + sx * k, y0, gold)
            px(im, x0, y0 + sy * k, gold)
        for dx, dy in ((2, 2), (3, 2), (2, 3), (3, 3)):
            px(im, x0 + sx * dx, y0 + sy * dy, glow)
        px(im, x0 + sx * 4, y0 + sy * 1, gold)
        px(im, x0 + sx * 1, y0 + sy * 4, gold)
    # 上下中央的小飾條
    for y0 in (8, H - 9):
        rect(im, W // 2 - 8, y0, W // 2 + 7, y0, gold)
        px(im, W // 2 - 1, y0 + (1 if y0 < H // 2 else -1), glow)
        px(im, W // 2, y0 + (1 if y0 < H // 2 else -1), glow)
    if name == 'star':                                        # 星夜款：邊框上有星星
        sparkles(im, 26, ['#ffffff', '#f3e6b0', '#8fa0ff'], 7, (2, 2, W - 3, 4))
        sparkles(im, 26, ['#ffffff', '#f3e6b0'], 8, (2, H - 5, W - 3, H - 3))
    if name == 'sakura':                                      # 櫻款：邊框散落花瓣
        for x, y in ((12, 3), (30, 2), (55, 3), (72, 2), (3, 30), (80, 60), (3, 95), (40, H - 4), (66, H - 3)):
            px(im, x, y, '#f9c6dc')
            px(im, x + 1, y, '#f59ac0')
    if name == 'tide':                                        # 潮款：邊框的波紋
        for y0 in (3, H - 4):
            for x in range(3, W - 3):
                if (x // 3) % 2 == 0:
                    px(im, x, y0 + (x % 3 == 1) * (1 if y0 < 10 else -1), '#7fc4dc')
    return im


# ───────────────────────── 許願樹大圖 ─────────────────────────

TW, TH = 450, 270     # 畫在一半的解析度，網站上放大成 900×540（2 倍像素）

SETS = [('#c9648f', '#ee93b8', '#fbc0d8', '#ffe1ec'), ('#7a5fb8', '#a487dc', '#c9b5ef', '#e6dcf9'),
        ('#379482', '#5fc0aa', '#97dfcd', '#cff3ea'), ('#c79c34', '#ecc85c', '#f7e196', '#fff4c8')]


def branch(im, x0, y0, x1, y1, w0, w1, dark, mid, light):
    """一根由粗變細的樹枝；左側亮、右側暗"""
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t
        w = w0 + (w1 - w0) * t
        for k in range(-int(w), int(w) + 1):
            c = light if k < -w * 0.4 else dark if k > w * 0.45 else mid
            px(im, round(x + k), round(y), c)


def wish_tree_big():
    r = random.Random(7)
    im = new(TW, TH)
    # 天空、遠山、草地
    bands(im, 0, 0, TW - 1, 190, '#bfe6ff', '#f2fbff', 10)
    for x in range(TW):                                       # 遠山
        h1 = 150 + int(14 * math.sin(x / 41) + 8 * math.sin(x / 13 + 1))
        h2 = 172 + int(10 * math.sin(x / 29 + 2) + 5 * math.sin(x / 9))
        rect(im, x, h1, x, 200, '#cfe6d6')
        rect(im, x, h2, x, 205, '#a9d3a8')
    for cx_, cy_, w_ in ((60, 30, 26), (330, 22, 34), (400, 48, 18)):   # 雲
        for dx, dy, rr in ((0, 0, 8), (10, -3, 10), (22, 0, 8), (12, 3, 9)):
            ellipse(im, cx_ + dx * w_ / 26, cy_ + dy, rr * w_ / 26 + 2, rr * 0.6 + 1, '#ffffff')
    bands(im, 0, 200, TW - 1, TH - 1, '#8cc96d', '#5f9e4c', 5)
    for _ in range(500):                                      # 草地紋理
        x, y = r.randrange(TW), r.randrange(202, TH)
        px(im, x, y, r.choice(['#7ab95e', '#a4d67e', '#6aa853']))
    # 樹幹與主枝
    D, M, L = '#5c3b26', '#7a5236', '#9a6e4a'
    trunk_top = 150
    for y in range(trunk_top, 252):                           # 樹幹（下面比較粗）
        w = 13 + max(0, (y - 225)) * 0.6
        for k in range(-int(w), int(w) + 1):
            c = L if k < -w * 0.45 else D if k > w * 0.5 else M
            px(im, 225 + k, y, c)
    branch(im, 213, 244, 186, 256, 5, 1, D, M, L)
    branch(im, 237, 244, 266, 257, 5, 1, D, M, L)
    branch(im, 225, 246, 222, 258, 6, 2, D, M, L)
    for y in (180, 200, 220):                                 # 樹皮紋
        rect(im, 220, y, 228, y, D)
        px(im, 222, y + 1, D)
    tips = [(62, 98), (128, 62), (225, 40), (322, 62), (388, 98), (170, 112), (280, 112)]
    for tx, ty in tips:
        branch(im, 225, trunk_top + 6, tx, ty, 9, 2.5, D, M, L)
    for tx, ty in tips[:5]:                                   # 細枝
        branch(im, tx, ty, tx - 14, ty + 10, 2.5, 1, D, M, L)
        branch(im, tx, ty, tx + 14, ty + 8, 2.5, 1, D, M, L)
    # 樹冠：每根枝頭一團，團與團之間留一點縫，看得到後面的枝條
    clusters = [(62, 96, 46, 30), (130, 62, 50, 32), (225, 44, 60, 32), (320, 62, 50, 32), (388, 96, 46, 30),
                (172, 104, 30, 18), (278, 104, 30, 18)]
    lumps = []
    for i, (cx, cy, rx, ry) in enumerate(clusters):
        for j in range(70):                                   # 葉團要多、要大，才會疊成一整片而不是一顆顆的球
            a = r.random() * math.tau
            d = math.sqrt(r.random())
            lumps.append((cx + math.cos(a) * d * rx, cy + math.sin(a) * d * ry, r.choice([11, 13, 14, 16, 18]), (i * 2 + j // 9) % 4))
    owner = {}
    for cx, cy, rad, k in sorted(lumps, key=lambda q: q[1]):
        jag = [rad + r.choice([-2, -1, 0, 0, 1]) for _ in range(28)]
        d_, m_, l_, h_ = SETS[k]
        for y in range(int(cy - rad) - 3, int(cy + rad) + 4):
            for x in range(int(cx - rad) - 3, int(cx + rad) + 4):
                if not (0 <= x < TW and 0 <= y < TH):
                    continue
                dx, dy = x - cx, y - cy
                dist = math.hypot(dx, dy)
                lim = jag[int((math.atan2(dy, dx) + math.pi) / math.tau * 28) % 28]
                if dist > lim:
                    continue
                t = (dx + dy * 1.2) / lim + (r.random() - 0.5) * 0.45
                c = h_ if t < -1.0 else l_ if t < -0.45 else m_ if t < 0.55 else d_
                if dist > lim - 1.2 and t > -0.2:
                    c = d_
                px(im, x, y, c)
                owner[(x, y)] = k
    for (x, y), k in list(owner.items()):                     # 交界處的混色
        for nx, ny in ((x + 1, y), (x, y + 1)):
            k2 = owner.get((nx, ny))
            if k2 is not None and k2 != k and r.random() < 0.5:
                px(im, x, y, SETS[k2][1])
    for _ in range(90):                                       # 葉間的閃光
        x, y = r.randrange(TW), r.randrange(TH)
        if (x, y) in owner and r.random() < 0.5:
            px(im, x, y, '#ffffff')
    for _ in range(70):                                       # 地上的落花
        x, y = r.randrange(20, TW - 20), r.randrange(205, TH - 3)
        k = r.randrange(4)
        px(im, x, y, SETS[k][2])
        px(im, x + 1, y, SETS[k][1])

    # 許願牌的掛點：在預先挑好的位置，找樹冠的下緣，綁一小段細枝
    # 兩排：短繩一排、長繩一排，彼此錯開（座標都是 900×540 的大小）
    rows = [(320, 16), (580, 16), (200, 16), (700, 16), (450, 24), (80, 16), (820, 16),
            (140, 118), (260, 118), (380, 118), (520, 118), (640, 118), (760, 118), (40, 118)]
    anchors = []
    for fx, ln in rows:
        hx = fx // 2
        ys = [y for (x, y) in owner if abs(x - hx) <= 2]
        hy = (max(ys) - 3) if ys else 120
        hy = min(hy, (540 - 100 - ln) // 2 - 1)
        for k in range(4):                                    # 細枝
            px(im, hx, hy + k, D if k else M)
        px(im, hx - 1, hy, M)
        anchors.append({'x': fx, 'y': (hy + 3) * 2, 'len': ln})
    return im, anchors


def plaque():
    """許願牌：屋頂形的木牌，中間是淺色的寫字區，最上面有穿繩的洞"""
    W, H = 36, 50
    im = new(W, H)
    for y in range(0, 12):                                    # 屋頂形的上緣
        half = 6 + y * 1.0
        rect(im, round(W / 2 - half), y, round(W / 2 + half) - 1, y, '#a8743f')
    rect(im, 0, 12, W - 1, H - 1, '#a8743f')
    for y in range(0, 12):
        half = 6 + y * 1.0
        px(im, round(W / 2 - half), y, '#c08c52')
        px(im, round(W / 2 + half) - 1, y, '#6e4527')
    rect(im, 0, 12, 0, H - 1, '#c08c52')
    rect(im, W - 1, 12, W - 1, H - 1, '#6e4527')
    rect(im, 0, H - 1, W - 1, H - 1, '#6e4527')
    rect(im, 3, 14, W - 4, H - 4, '#f4e4c4')                  # 寫字區
    rect(im, 3, 14, W - 4, 14, '#e2cda3')
    rect(im, 3, 14, 3, H - 4, '#e2cda3')
    ellipse(im, W / 2 - 0.5, 6, 1.6, 1.6, '#3a2a18')          # 穿繩的洞
    for x, y in ((6, 9), (28, 10), (8, 46), (30, 45)):
        px(im, x, y, '#8a5a30')
    return im


# ───────────────────────── 全螢幕畫面的背景 ─────────────────────────
# 全部 480×270（16:9），網站上放大鋪滿。畫面中央會被內容框蓋住，所以重點放在四周。

SW, SH = 480, 270


def scene_market():
    """商店裡面：木頭牆、兩側貨架、吊燈"""
    im = new(SW, SH)
    planks(im, 0, 0, SW - 1, 200, '#8a5a30', '#6e4527', '#a8743f', horizontal=False, size=16, seed=3)
    planks(im, 0, 201, SW - 1, SH - 1, '#c08c52', '#9b6937', '#d6a56a', horizontal=True, size=10, seed=4)
    rect(im, 0, 198, SW - 1, 202, '#4f321c')
    r = random.Random(5)
    goods = ['#e5484d', '#f0cf66', '#63a34d', '#8fd0e8', '#f29bc0', '#c9b48f', '#a487dc']
    for x0 in (8, SW - 128):                                  # 兩側貨架
        rect(im, x0, 30, x0 + 119, 196, '#5c3b22')
        for sy in (60, 100, 140, 180):
            rect(im, x0 + 2, sy, x0 + 117, sy + 4, '#a8743f')
            rect(im, x0 + 2, sy, x0 + 117, sy, '#c08c52')
            x = x0 + 6
            while x < x0 + 110:                               # 架上的罐子、袋子
                w = r.choice([8, 10, 12])
                h = r.choice([12, 16, 20])
                c = r.choice(goods)
                rect(im, x, sy - h, x + w - 1, sy - 1, c)
                rect(im, x, sy - h, x + w - 1, sy - h + 1, lerp(c, '#ffffff', 0.35))
                rect(im, x + w - 2, sy - h, x + w - 1, sy - 1, lerp(c, '#000000', 0.25))
                x += w + r.choice([2, 3, 4])
    for lx in (170, 240, 310):                                # 吊燈
        rect(im, lx, 0, lx, 22, '#3a2a18')
        ellipse(im, lx, 28, 10, 7, '#f6c453')
        ellipse(im, lx, 29, 6, 4, '#fff0a8')
        for k in range(1, 4):
            for x in range(lx - 10 - k * 6, lx + 11 + k * 6):
                if (x + k) % 3 == 0:
                    blend(im, x, 34 + k * 2, (255, 230, 150, 70))
    rect(im, 150, 150, 329, 200, '#7a4e2c')                   # 櫃台
    rect(im, 150, 150, 329, 154, '#c08c52')
    ellipse(im, 240, 140, 12, 8, '#f6c453')                   # 櫃台上的金幣盤
    ellipse(im, 240, 139, 8, 5, '#fff0a8')
    return im


def scene_casino():
    """小賭場：深紫色的牆、燈泡框、紅地毯、兩側拉霸機"""
    im = new(SW, SH)
    bands(im, 0, 0, SW - 1, 190, '#1a0f2e', '#3a1f5c', 8)
    for x in range(0, SW, 24):                                # 牆面的直紋
        rect(im, x, 0, x + 1, 190, '#2a1846')
    bands(im, 0, 191, SW - 1, SH - 1, '#6a1f2a', '#3a0f18', 5)
    for y in range(195, SH, 8):                               # 地毯花紋
        for x in range((y // 8 % 2) * 8, SW, 16):
            px(im, x, y, '#b0434e')
            px(im, x + 1, y + 1, '#b0434e')
    r = random.Random(9)
    for i, x in enumerate(range(6, SW, 14)):                  # 天花板的燈泡
        c = '#fff7c2' if i % 2 else '#ff8fa3'
        rect(im, x, 6, x + 3, 9, c)
        px(im, x + 1, 7, '#ffffff')
    for x0 in (20, 80, SW - 130, SW - 70):                    # 拉霸機
        rect(im, x0, 100, x0 + 49, 195, '#c0392b')
        rect(im, x0, 100, x0 + 49, 104, '#e5484d')
        rect(im, x0 + 4, 92, x0 + 45, 100, '#f6c453')
        rect(im, x0 + 6, 116, x0 + 43, 140, '#1b2030')
        for k in range(3):
            rect(im, x0 + 8 + k * 12, 118, x0 + 16 + k * 12, 138, '#f4f1e8')
            ellipse(im, x0 + 12 + k * 12, 128, 3, 3, r.choice(['#e5484d', '#f6c453', '#63a34d']))
        rect(im, x0 + 50, 110, x0 + 52, 140, '#b3b1c0')       # 拉桿
        ellipse(im, x0 + 51, 108, 3.5, 3.5, '#e5484d')
        rect(im, x0 + 8, 150, x0 + 41, 155, '#7a2a20')
    for y in (40, 70):                                        # 牆上的骰子與牌的裝飾
        for x0 in (190, 280):
            rect(im, x0, y, x0 + 12, y + 12, '#ffffff')
            rect(im, x0 + 3, y + 3, x0 + 4, y + 4, '#1b2030')
            rect(im, x0 + 8, y + 8, x0 + 9, y + 9, '#1b2030')
    sparkles(im, 60, ['#fff7c2', '#ff8fa3', '#d6ccff'], 3, (0, 12, SW - 1, 90))
    return im


def scene_hut():
    """成就小屋裡面：木牆、獎盃架、掛著的徽章、窗戶"""
    im = new(SW, SH)
    planks(im, 0, 0, SW - 1, 205, '#b5865a', '#8a5a30', '#cf9f70', horizontal=False, size=20, seed=11)
    planks(im, 0, 206, SW - 1, SH - 1, '#8a5a30', '#6e4527', '#a8743f', horizontal=True, size=9, seed=12)
    rect(im, 0, 203, SW - 1, 207, '#4f321c')
    for x0 in (30, SW - 110):                                 # 窗戶與窗外的天空
        rect(im, x0, 30, x0 + 79, 100, '#6e4527')
        bands(im, x0 + 4, 34, x0 + 75, 96, '#9fd6ff', '#e8f6ff', 5)
        rect(im, x0 + 38, 34, x0 + 41, 96, '#6e4527')
        rect(im, x0 + 4, 63, x0 + 75, 66, '#6e4527')
        rect(im, x0 - 4, 100, x0 + 83, 104, '#a8743f')
    r = random.Random(13)
    for sx in (20, SW - 150):                                 # 獎盃架
        for sy in (140, 180):
            rect(im, sx, sy, sx + 129, sy + 4, '#6e4527')
            rect(im, sx, sy, sx + 129, sy, '#a8743f')
            for k in range(5):
                x = sx + 8 + k * 25
                c = r.choice(['#f6c453', '#c9c7d6', '#d08a4a'])
                rect(im, x + 4, sy - 4, x + 11, sy - 1, '#5c3b22')        # 底座
                rect(im, x + 6, sy - 9, x + 9, sy - 5, c)                 # 杯腳
                rect(im, x + 2, sy - 20, x + 13, sy - 10, c)              # 杯身
                rect(im, x + 2, sy - 20, x + 4, sy - 10, lerp(c, '#ffffff', 0.4))
                rect(im, x, sy - 19, x + 1, sy - 14, c)
                rect(im, x + 14, sy - 19, x + 15, sy - 14, c)
    for i, x in enumerate(range(150, 331, 30)):               # 牆上掛的印章徽章
        ellipse(im, x, 60, 10, 10, '#e06c75' if i % 2 == 0 else '#6c5ce7')
        ellipse(im, x, 60, 7, 7, '#fbe9d0')
        rect(im, x, 44, x, 50, '#3a2a18')
    return im


def scene_offerings():
    """供奉石：石造的祭壇室，紫色的光從上面灑下來"""
    im = new(SW, SH, '#34324a')                                # 磚縫的顏色
    for row in range(0, 200, 12):                             # 石磚牆
        off = 12 if (row // 12) % 2 else 0
        for col in range(-1, SW // 24 + 1):
            x0 = col * 24 + off
            rect(im, x0, row, x0 + 22, row + 10, '#4f4c63' if (col + row) % 3 else '#57546c')
            rect(im, x0, row, x0 + 22, row, '#6a677e')
    bands(im, 0, 200, SW - 1, SH - 1, '#3a3850', '#24223a', 4)
    for x in range(SW):                                       # 從上方灑下的光
        d = abs(x - SW / 2) / 90
        if d < 1:
            for y in range(0, 200):
                if (x + y) % 2 == 0 and (y / 200) < (1 - d):
                    blend(im, x, y, (157, 140, 255, int(60 * (1 - d))))
    for x0 in (40, SW - 80):                                  # 兩側的燭台
        rect(im, x0 + 16, 120, x0 + 23, 200, '#77758a')
        rect(im, x0 + 8, 116, x0 + 31, 120, '#9a97ab')
        rect(im, x0 + 18, 100, x0 + 21, 115, '#f4f1e8')
        ellipse(im, x0 + 19.5, 96, 3, 5, '#f6c453')
        ellipse(im, x0 + 19.5, 97, 1.5, 3, '#fff7c2')
    sparkles(im, 50, ['#d6ccff', '#9d8cff', '#ffffff'], 21, (120, 10, SW - 120, 190))
    return im


def scene_ring():
    """召喚卡殿：夜色的大廳、柱子、地上的大法陣"""
    im = new(SW, SH)
    bands(im, 0, 0, SW - 1, 170, '#0f0b22', '#2a2150', 8)
    sparkles(im, 90, ['#ffffff', '#d6ccff', '#9d8cff'], 31, (0, 0, SW - 1, 120))
    bands(im, 0, 171, SW - 1, SH - 1, '#3a3456', '#1a1630', 5)
    for x0 in (30, 110, SW - 140, SW - 60):                   # 柱子
        rect(im, x0, 20, x0 + 29, 200, '#6f6c80')
        rect(im, x0, 20, x0 + 5, 200, '#8f8d9e')
        rect(im, x0 + 24, 20, x0 + 29, 200, '#4f4c63')
        rect(im, x0 - 4, 14, x0 + 33, 22, '#8f8d9e')
        rect(im, x0 - 4, 196, x0 + 33, 204, '#8f8d9e')
        rect(im, x0, 100, x0 + 29, 104, '#6c5ce7')
    for a in range(0, 360, 1):                                # 地上的法陣（橢圓透視）
        for rr, c in ((150, '#6c5ce7'), (138, '#4a3fae'), (90, '#6c5ce7')):
            x = round(SW / 2 + math.cos(math.radians(a)) * rr)
            y = round(232 + math.sin(math.radians(a)) * rr * 0.22)
            px(im, x, y, c)
    for i in range(8):
        a1 = math.radians(i * 45)
        a2 = math.radians(i * 45 + 135)
        p1 = (SW / 2 + math.cos(a1) * 138, 232 + math.sin(a1) * 138 * 0.22)
        p2 = (SW / 2 + math.cos(a2) * 138, 232 + math.sin(a2) * 138 * 0.22)
        n = 120
        for k in range(n + 1):
            px(im, round(p1[0] + (p2[0] - p1[0]) * k / n), round(p1[1] + (p2[1] - p1[1]) * k / n), '#5a4ccf')
    return im


def scene_card():
    """單張卡片：深色的星空與一圈光"""
    im = new(SW, SH)
    bands(im, 0, 0, SW - 1, SH - 1, '#0c0a1c', '#231a44', 10)
    for rr in range(110, 40, -10):                            # 背後的一圈一圈光暈（棋盤格）
        a = (110 - rr) / 70
        for y in range(SH):
            for x in range(SW):
                d = math.hypot((x - SW / 2) / 1.6, y - SH / 2)
                if rr - 10 < d <= rr and (x + y) % 2 == 0:
                    px(im, x, y, lerp('#231a44', '#6c5ce7', a * 0.7))
    sparkles(im, 140, ['#ffffff', '#f3e6b0', '#8fa0ff'], 41)
    return im


def scene_tree():
    """許願樹畫面的外圍：傍晚的天空與草原（樹本身是另一張大圖）"""
    im = new(SW, SH)
    bands(im, 0, 0, SW - 1, 180, '#a9d8f5', '#fde3cf', 9)
    for x in range(SW):
        h1 = 170 + int(10 * math.sin(x / 37) + 6 * math.sin(x / 11))
        rect(im, x, h1, x, 200, '#b9d9b0')
    bands(im, 0, 200, SW - 1, SH - 1, '#8cc96d', '#5f9e4c', 5)
    r = random.Random(51)
    for _ in range(140):                                      # 飄落的花瓣
        x, y = r.randrange(SW), r.randrange(SH)
        k = r.randrange(4)
        px(im, x, y, SETS[k][2])
        px(im, x + 1, y + 1, SETS[k][1])
    return im


def scene_bag():
    """背包：帆布的質感與縫線"""
    im = new(SW, SH)
    r = random.Random(61)
    rect(im, 0, 0, SW - 1, SH - 1, '#6b5a44')
    for y in range(SH):
        for x in range(SW):
            if (x * 3 + y) % 7 == 0:
                px(im, x, y, '#5e4f3b')
            elif (x + y * 5) % 11 == 0:
                px(im, x, y, '#776550')
    for inset in (10, 14):                                    # 縫線
        for x in range(inset, SW - inset, 6):
            rect(im, x, inset, x + 2, inset, '#d9c49a')
            rect(im, x, SH - 1 - inset, x + 2, SH - 1 - inset, '#d9c49a')
        for y in range(inset, SH - inset, 6):
            rect(im, inset, y, inset, y + 2, '#d9c49a')
            rect(im, SW - 1 - inset, y, SW - 1 - inset, y + 2, '#d9c49a')
    for x0, y0 in ((30, 30), (SW - 70, SH - 70)):             # 補丁
        rect(im, x0, y0, x0 + 39, y0 + 39, '#8a6f4f')
        for k in range(0, 40, 4):
            px(im, x0 + k, y0, '#d9c49a')
            px(im, x0 + k, y0 + 39, '#d9c49a')
    for _ in range(300):
        px(im, r.randrange(SW), r.randrange(SH), '#5a4a37')
    return im


def scene_parchment(seed, ink='#8a6a42'):
    """地圖、目錄、選單共用的羊皮紙"""
    im = new(SW, SH)
    r = random.Random(seed)
    bands(im, 0, 0, SW - 1, SH - 1, '#efe0bd', '#e2cc9c', 6)
    for _ in range(1600):
        px(im, r.randrange(SW), r.randrange(SH), r.choice(['#e6d3a8', '#f4e8cc', '#d9c18e']))
    for y in range(SH):                                       # 四周烤焦的邊
        for x in range(SW):
            d = min(x, y, SW - 1 - x, SH - 1 - y)
            if d < 10 and r.random() < (10 - d) / 12:
                px(im, x, y, '#b08a54' if d > 4 else '#7a5a34')
    for (x0, y0) in ((24, 24), (SW - 60, SH - 60)):           # 角落的羅盤花紋
        for a in range(0, 360, 45):
            ln = 18 if a % 90 == 0 else 10
            for k in range(ln):
                px(im, round(x0 + 18 + math.cos(math.radians(a)) * k), round(y0 + 18 + math.sin(math.radians(a)) * k), ink)
        ellipse(im, x0 + 18, y0 + 18, 3, 3, ink)
    return im


def scene_fishchat():
    """魚魚的池塘：從水面往下看，水草與光斑"""
    im = new(SW, SH)
    bands(im, 0, 0, SW - 1, SH - 1, '#4fa3cf', '#123a5a', 10)
    r = random.Random(71)
    for _ in range(40):                                       # 水面灑下的光斑
        x, y = r.randrange(SW), r.randrange(0, 120)
        for k in range(r.randrange(4, 10)):
            px(im, x + k, y + (k % 3 == 0), '#9fd6f0')
    for x0 in range(10, SW, 34):                              # 水草
        hgt = r.randrange(50, 130)
        for k in range(hgt):
            x = x0 + round(math.sin(k / 9 + x0) * 4)
            px(im, x, SH - 1 - k, '#3f8a46' if k % 3 else '#5fae54')
            px(im, x + 1, SH - 1 - k, '#2f6f3a')
    rect(im, 0, SH - 12, SW - 1, SH - 1, '#c2ad70')
    for x in range(0, SW, 3):
        px(im, x, SH - 12, '#d9c58a')
    for _ in range(50):                                       # 泡泡
        x, y = r.randrange(SW), r.randrange(SH - 20)
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            blend(im, x + dx, y + dy, (255, 255, 255, 140))
        blend(im, x - 1, y - 1, (255, 255, 255, 60))
    return im


# ───────────────────────── 輸出 ─────────────────────────

def main():
    out = {}
    for name in BACKS:
        out[f'card.back.{name}'] = save(card_back(name), 'cards', f'back-{name}.png')
    tree, anchors = wish_tree_big()
    out['tree.bg'] = save(tree, 'scenes', 'wish-tree.png')
    out['tree.plaque'] = save(plaque(), 'ui', 'plaque.png')
    scenes = {
        'market': scene_market(), 'casino': scene_casino(), 'hut': scene_hut(), 'offerings': scene_offerings(),
        'ring': scene_ring(), 'card': scene_card(), 'tree': scene_tree(), 'bag': scene_bag(),
        'map': scene_parchment(81), 'list': scene_parchment(82), 'menu': scene_parchment(83), 'fishchat': scene_fishchat(),
    }
    for k, im in scenes.items():
        out[f'scene.{k}'] = save(im, 'scenes', f'{k}.png')
    for key, path in out.items():
        print(f'{key:20s} {os.path.relpath(path, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))}')
    print('\n許願牌掛點（貼到 js/systems/treeLayout.js 的 ANCHORS）：')
    for a in anchors:
        print(f"  {{ x: {a['x']}, y: {a['y']}, len: {a['len']} }},")
    return anchors


if __name__ == '__main__':
    main()
