#!/usr/bin/env python3
"""產生卡背、許願樹大圖（枝條與葉子）、全螢幕畫面背景的暫用像素圖，輸出到 assets/。

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


# 小鴨子圖樣（Caveduck 的鴨子元素）。'#' = 身體、'o' = 眼睛、'b' = 嘴、'w' = 翅膀
DUCK_BIG = [
    '.....###.......',
    '....#####......',
    '....##o##bb....',
    '....#####bbb...',
    '.....###.......',
    '.....####......',
    '#...#######....',
    '##.#########...',
    '#####www#####..',
    '.####wwww####..',
    '..##########...',
    '...########....',
]
DUCK_SMALL = [
    '.##..',
    '#o#b.',
    '.##..',
    '#####',
    '.###.',
]


def stamp(im, pattern, x0, y0, colors, flip=False):
    """把字元圖樣印到圖上；colors 對應每個字元的顏色，'.' 是透明"""
    for y, row in enumerate(pattern):
        if flip:
            row = row[::-1].replace('b', 'B').replace('B', 'b')
        for x, ch in enumerate(row):
            if ch in colors:
                px(im, x0 + x, y0 + y, colors[ch])


# ───────────────────────── 卡背 ─────────────────────────
# 構圖：深色厚邊框 + 細金線 + 四角各一隻小鴨子，正中央是一個漩渦狀的橢圓（像要把人吸進去的感覺），
# 漩渦中心浮出一隻鴨子（由漩渦本身變亮形成，旋臂照樣穿過牠）。全部是原創圖樣，只借用「神秘漩渦卡背」的氣氛。

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
    r = random.Random(sum(map(ord, name)))                    # 固定種子（不能用 hash()，每次執行結果會不同）
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
    # 鴨子不另外畫一個徽章，而是「漩渦本身在鴨子形狀的地方變亮」：旋臂照樣穿過鴨子，
    # 鴨子只是漩渦裡比較亮的一塊，邊緣用棋盤格淡出，所以看起來是從漩渦裡浮出來的
    duck = {}
    dw, dh = len(DUCK_BIG[0]) * 2, len(DUCK_BIG) * 2
    ox, oy = round(cx - dw / 2) + 1, round(cy - dh / 2) + 2
    for j, row in enumerate(DUCK_BIG):
        for i, ch in enumerate(row):
            if ch != '.':
                for a2 in range(2):
                    for b2 in range(2):
                        duck[(ox + i * 2 + a2, oy + j * 2 + b2)] = ch
    edge = {p for p in duck if any((p[0] + dx, p[1] + dy) not in duck for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
    # 鴨子外圍一圈深色：和漩渦的暗色旋臂同色，暗臂流到鴨子身邊就變成牠的輪廓
    rim = {(x + dx, y + dy) for (x, y) in edge for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))} - set(duck)
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
            t0 = v * 0.5 + 0.5                                 # 只看旋臂的明暗（0~1），給鴨子身上的紋路用
            if d < 0.34:                                       # 漩渦正中間是比較暗的「渦眼」，鴨子浮在裡面才看得清楚
                t -= (0.34 - d) * 2.6
            ch = duck.get((x, y))
            if (x, y) in rim:
                px(im, x, y, sw_d)
                continue
            if ch == 'b':
                c = '#f6a33c' if (x + y) % 3 else '#ffd27a'      # 嘴巴
            elif ch == 'o':
                c = sw_d                                           # 眼睛
            else:
                # 鴨子身上把漩渦的明暗壓進「亮色」的範圍：旋臂的紋路還在，但整體是一隻亮的鴨子
                if ch == '#':
                    t = 0.66 + t0 * 0.42                           # 身體只用亮色和最亮色，旋臂的紋路還看得到
                elif ch == 'w':
                    t = 0.4 + t0 * 0.3                             # 翅膀用中間色，看得出形狀
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
    # 四角紋飾：一個直角框，框裡一隻小鴨子（右邊兩角的鴨子面向內側）
    for (x0, y0, sx, sy) in ((8, 8, 1, 1), (W - 9, 8, -1, 1), (8, H - 9, 1, -1), (W - 9, H - 9, -1, -1)):
        for k in range(6):
            px(im, x0 + sx * k, y0, gold)
            px(im, x0, y0 + sy * k, gold)
        stamp(im, DUCK_SMALL, x0 + (2 if sx > 0 else -6), y0 + (2 if sy > 0 else -6), {'#': glow, 'o': sw_d, 'b': '#f6a33c'}, flip=sx < 0)
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


def bezier(p0, p1, p2, p3, t):
    u = 1 - t
    return (u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
            u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1])


def wish_tree_big():
    """許願樹畫面：只有枝條和葉子，背景透明。兩根粗枝從畫面下方中央長上來，
    在中間分岔後一路往外、往上擴散到畫面兩側與上緣，葉子集中在往外伸的那一段。
    許願牌用細繩掛在枝條的下緣。回傳 (圖, 掛點)"""
    r = random.Random(7)
    im = new(TW, TH)
    D, M, L = '#5c3b26', '#7a5236', '#9a6e4a'
    # 枝條：三次貝茲曲線，由內往外畫（起點粗、終點細）。最後一欄：從哪裡開始長葉子（0~1；大於 1 = 不長）
    HL, HR = (146, 150), (304, 150)                         # 左右兩個分岔點
    branches = [
        ((196, 282), (186, 220), (168, 176), HL, 15, 9, 2),         # 左邊的粗枝（從畫面下方長上來，不長葉子）
        ((254, 282), (264, 220), (282, 176), HR, 15, 9, 2),         # 右邊的粗枝
        (HL, (104, 140), (50, 128), (-14, 132), 9, 2, 0.35),        # 往左，低
        (HL, (118, 104), (70, 66), (-14, 44), 9, 2, 0.3),           # 往左上
        (HL, (156, 106), (148, 54), (118, -14), 8, 2, 0.35),        # 往上偏左
        (HL, (192, 124), (226, 96), (262, -14), 7, 2, 0.4),         # 往中間上方（和右邊那根交叉）
        (HR, (346, 140), (400, 128), (464, 132), 9, 2, 0.35),       # 往右，低
        (HR, (332, 104), (380, 66), (464, 44), 9, 2, 0.3),          # 往右上
        (HR, (294, 106), (302, 54), (332, -14), 8, 2, 0.35),        # 往上偏右
        (HR, (258, 124), (224, 96), (188, -14), 7, 2, 0.4),         # 往中間上方（和左邊那根交叉）
    ]
    branch_ys = {}                                         # 每個 x 上有枝條的 y（掛繩子用）
    twig_tips = []
    paths = []
    for p0, p1, p2, p3, w0, w1, leaf_from in branches:
        pts = [bezier(p0, p1, p2, p3, i / 240) for i in range(241)]
        paths.append((pts, leaf_from))
        for i, (x, y) in enumerate(pts):
            w = w0 * (1 - i / 240) + w1 * (i / 240)
            for k in range(-int(w), int(w) + 1):
                c = L if k < -w * 0.4 else D if k > w * 0.45 else M
                X, Y = round(x), round(y + k)
                px(im, X, Y, c)
                if 0 <= X < TW and 0 <= Y < TH:
                    branch_ys.setdefault(X, set()).add(Y)
        for t in ((0.45, 0.7, 0.9) if leaf_from <= 1 else ()):   # 往上翹的細枝，末端長一小叢葉子
            x, y = bezier(p0, p1, p2, p3, t)
            side = r.choice([-1, 1])
            for k in range(12):
                px(im, round(x + side * k * 0.7), round(y - k), M)
                px(im, round(x + side * k * 0.7) + 1, round(y - k), D)
            twig_tips.append((x + side * 8, y - 13))
    # 葉子：沿著枝條的「上方」長，枝條下方保持乾淨，繩子和許願牌才看得清楚
    lumps = []
    for pts, leaf_from in paths:                          # 一小叢一小叢、中間留空，看得到枝條；越往外越密
        if leaf_from > 1:
            continue
        for i in range(int(leaf_from * 240), 236, 18):
            x, y = pts[i]
            for _ in range(2):
                lumps.append((x + r.uniform(-7, 7), y - r.uniform(9, 17), r.choice([6, 7, 8, 9]), r.randrange(4)))
        tx, ty = pts[-14]                                  # 枝頭再多一叢
        lumps.append((tx + r.uniform(-3, 3), ty - 8, 9, r.randrange(4)))
    for x, y in twig_tips:
        lumps.append((x, y, r.choice([6, 7, 8]), r.randrange(4)))
    for x in range(-10, TW + 10, 16):                       # 上緣與兩側是枝條往外長的末端，葉子最茂密
        lumps.append((x + r.uniform(-4, 4), r.uniform(-8, 4), r.choice([9, 11, 13]), r.randrange(4)))
    for y in range(10, 140, 16):
        for x in (r.uniform(-6, 4), TW + r.uniform(-4, 6)):
            lumps.append((x, y + r.uniform(-4, 4), r.choice([9, 11, 12]), r.randrange(4)))
    owner = {}
    for cx, cy, rad, k in sorted(lumps, key=lambda q: q[1]):
        jag = [rad + r.choice([-2, -1, 0, 0, 1]) for _ in range(24)]
        d_, m_, l_, h_ = SETS[k]
        for y in range(int(cy - rad) - 3, int(cy + rad) + 4):
            for x in range(int(cx - rad) - 3, int(cx + rad) + 4):
                if not (0 <= x < TW and 0 <= y < TH):
                    continue
                dx, dy = x - cx, y - cy
                dist = math.hypot(dx, dy)
                lim = jag[int((math.atan2(dy, dx) + math.pi) / math.tau * 24) % 24]
                if dist > lim:
                    continue
                t = (dx + dy * 1.2) / lim + (r.random() - 0.5) * 0.45
                c = h_ if t < -1.0 else l_ if t < -0.45 else m_ if t < 0.55 else d_
                if dist > lim - 1.2 and t > -0.2:
                    c = d_
                px(im, x, y, c)
                owner[(x, y)] = k
    for (x, y), k in list(owner.items()):                 # 交界處的混色
        for nx, ny in ((x + 1, y), (x, y + 1)):
            k2 = owner.get((nx, ny))
            if k2 is not None and k2 != k and r.random() < 0.5:
                px(im, x, y, SETS[k2][1])
    for _ in range(80):                                   # 葉間的閃光
        x, y = r.randrange(TW), r.randrange(TH)
        if (x, y) in owner and r.random() < 0.5:
            px(im, x, y, '#ffffff')
    for _ in range(26):                                   # 飄在空中的花瓣
        x, y = r.randrange(10, TW - 10), r.randrange(150, TH - 6)
        k = r.randrange(4)
        px(im, x, y, SETS[k][2])
        px(im, x + 1, y, SETS[k][1])

    # 許願牌的掛點（座標是 900×540）。兩排：上排的牌頂大約在 y=290、下排大約在 y=420，
    # 繩長 = 牌頂 − 枝條下緣，所以兩排一定不會疊在一起
    rows = [(320, 292), (580, 300), (200, 286), (700, 296), (450, 304), (80, 290), (820, 298),
            (140, 420), (260, 428), (380, 416), (520, 424), (640, 418), (760, 426), (40, 422)]
    anchors = []
    for fx, top in rows:
        # 找這個 x 上「離牌頂至少 40 的最低一根枝條」；正上方沒有就往左右最多 12 格找
        limit = (top - 40) // 2
        ok = lambda x: any(y <= limit for y in branch_ys.get(x, ()))
        hx = next((fx // 2 + d for d in sorted(range(-12, 13), key=abs) if ok(fx // 2 + d)), None)
        if hx is None:
            raise SystemExit(f'x={fx} 附近沒有枝條可以掛許願牌，請調整 branches 或 rows')
        hy = max(y for y in branch_ys[hx] if y <= limit)
        fx = hx * 2
        ellipse(im, hx, hy, 1.6, 1.6, D)                   # 綁繩子的小結
        anchors.append({'x': fx, 'y': hy * 2 + 2, 'len': top - (hy * 2 + 2)})
    return im, anchors


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
