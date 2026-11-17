#!/usr/bin/env python3
"""產生地圖用的像素素材（圖塊、建築、地圖物件），輸出到 assets/。

用法：  python3 tools/make_pixel_assets.py        （需要 Pillow：pip install pillow）

所有圖都是用程式一格一格畫出來的，亂數有固定種子，所以每次產生的結果完全相同。
想調整某張圖：改對應的函式後重新執行即可。想換成自己畫的圖：直接覆蓋 assets/ 裡的檔案，
或在 js/data/assets.js 把該鍵指到你的檔案（之後不要再執行這支程式，否則會被蓋回去）。
"""
import math
import os
import random
from PIL import Image, ImageDraw

T = 32
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')


def rgb(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def new(w, h, fill=None):
    return Image.new('RGBA', (w, h), rgb(fill) if fill else (0, 0, 0, 0))


def px(im, x, y, c, wrap=False):
    w, h = im.size
    if wrap:
        x %= w
        y %= h
    if 0 <= x < w and 0 <= y < h:
        im.putpixel((x, y), rgb(c) if isinstance(c, str) else c)


def rect(im, x0, y0, x1, y1, c):
    ImageDraw.Draw(im).rectangle([x0, y0, x1, y1], fill=rgb(c) if isinstance(c, str) else c)


def ellipse(im, cx, cy, rx, ry, c):
    """實心橢圓（逐點判斷，邊緣是乾淨的像素，不會有半透明的毛邊）"""
    col = rgb(c) if isinstance(c, str) else c
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                px(im, x, y, col)


def shadow(im, cx, cy, rx, ry, a=70):
    """物件腳下的影子（畫在最底層）"""
    base = new(*im.size)
    ellipse(base, cx, cy, rx, ry, (20, 30, 20, a))
    base.alpha_composite(im)
    im.paste(base, (0, 0))


def blob(im, cx, cy, r, dark, mid, light, hi=None, wrap=False):
    """有立體感的圓團（樹冠、草叢用）：左上亮、右下暗"""
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            dx, dy = x - cx, y - cy
            d = math.hypot(dx, dy)
            if d > r:
                continue
            t = (dx + dy) / r          # -1.4（左上）~ 1.4（右下）
            c = mid
            if d > r - 1.2 and t > 0.1:
                c = dark
            elif t < -0.55:
                c = light
            elif t > 0.75:
                c = dark
            px(im, x, y, c, wrap)
    if hi:
        px(im, int(cx - r * 0.45), int(cy - r * 0.5), hi, wrap)
        px(im, int(cx - r * 0.45) + 1, int(cy - r * 0.5), hi, wrap)


def strip(frames):
    """把多張同尺寸的圖橫向接成一張（動畫或變化款）"""
    w, h = frames[0].size
    out = new(w * len(frames), h)
    for i, f in enumerate(frames):
        out.paste(f, (i * w, 0))
    return out


def save(im, *path):
    full = os.path.join(ROOT, *path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    im.save(full)
    return full


# ───────────────────────── 圖塊 ─────────────────────────

G1, G2, G3, G4 = '#63a34d', '#57943f', '#73b55a', '#8dc96a'


def tile_grass(seed, flowers=0, tufts=0):
    r = random.Random(seed)
    im = new(T, T, G1)
    for _ in range(44):                                  # 深色草斑
        x, y = r.randrange(T), r.randrange(T)
        px(im, x, y, G2)
        if r.random() < 0.45:
            px(im, x + 1, y, G2, True)
    for _ in range(20):                                  # 草葉：下深上亮
        x, y = r.randrange(T), r.randrange(1, T)
        px(im, x, y, G3)
        px(im, x, y - 1, G4)
    for _ in range(tufts):                               # 一小叢比較高的草
        x, y = r.randrange(4, T - 4), r.randrange(6, T - 2)
        for dx, hgt in ((-1, 2), (0, 4), (1, 3)):
            for k in range(hgt):
                px(im, x + dx, y - k, G4 if k == hgt - 1 else G3)
        px(im, x - 1, y + 1, G2)
        px(im, x, y + 1, G2)
        px(im, x + 1, y + 1, G2)
    for _ in range(flowers):                             # 小花
        x, y = r.randrange(3, T - 3), r.randrange(3, T - 3)
        petal = r.choice(['#f7b6cf', '#ffffff', '#f6e27a'])
        for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            px(im, x + dx, y + dy, petal)
        px(im, x, y, '#f0b429')
        px(im, x, y + 2, G2)
    return im


def tile_forest(seed):
    """樹牆：從上方看下去的茂密樹冠，四邊可以無縫相接"""
    r = random.Random(seed)
    im = new(T, T, '#1c4429')
    spots = [(r.randrange(T), r.randrange(T), r.choice([7, 8, 8, 9])) for _ in range(7)]
    spots += [(4, 4, 8), (20, 6, 8), (12, 20, 9), (28, 24, 8)]     # 保證鋪滿
    for cx, cy, rad in sorted(spots, key=lambda s: s[1]):
        blob(im, cx, cy, rad, '#1f4f2d', '#2f6f3a', '#43904a', '#62ad55', wrap=True)
    for _ in range(26):                                             # 葉片的細碎亮點
        x, y = r.randrange(T), r.randrange(T)
        if im.getpixel((x, y)) == rgb('#2f6f3a'):
            px(im, x, y, '#3a7f42')
    return im


def tile_stone(seed, crack=False):
    """卡殿的石地板：四塊石板一格，帶接縫與高光"""
    r = random.Random(seed)
    im = new(T, T)
    for by in range(2):
        for bx in range(2):
            base = r.choice(['#a9a7b8', '#b2b0c0', '#a19fb0'])
            x0, y0 = bx * 16, by * 16
            rect(im, x0, y0, x0 + 15, y0 + 15, base)
            rect(im, x0 + 1, y0 + 1, x0 + 14, y0 + 1, '#c3c1d0')   # 上緣高光
            rect(im, x0 + 1, y0 + 1, x0 + 1, y0 + 14, '#c3c1d0')
            rect(im, x0 + 1, y0 + 15, x0 + 15, y0 + 15, '#8f8d9f')  # 下緣陰影
            rect(im, x0 + 15, y0 + 1, x0 + 15, y0 + 15, '#8f8d9f')
            rect(im, x0, y0, x0 + 15, y0, '#77758a')                # 接縫
            rect(im, x0, y0, x0, y0 + 15, '#77758a')
            for _ in range(5):
                px(im, x0 + r.randrange(3, 14), y0 + r.randrange(3, 14), r.choice(['#9c9aac', '#b9b7c7']))
    if crack:
        x, y = 5, 20
        for _ in range(9):
            px(im, x, y, '#77758a')
            x += 1
            y += r.choice([-1, 0, 0, 1])
    return im


def tile_hallwall(seed):
    """卡殿的石牆：交錯的石磚"""
    r = random.Random(seed)
    im = new(T, T, '#4f4c63')
    for row in range(4):
        off = 8 if row % 2 else 0
        for col in range(-1, 3):
            x0, y0 = col * 16 + off, row * 8
            base = r.choice(['#77748a', '#807d93', '#6e6b82'])
            for y in range(y0, y0 + 7):
                for x in range(x0, x0 + 15):
                    c = base
                    if y == y0:
                        c = '#9a97ab'
                    elif y == y0 + 6:
                        c = '#5f5c73'
                    px(im, x, y, c, True)
            px(im, x0 + r.randrange(2, 13), y0 + r.randrange(2, 5), '#6a677e', True)
    return im


def tiles_water():
    """水：四格動畫，亮色的波紋往右飄"""
    r = random.Random(11)
    waves = [(r.randrange(T), y, r.choice([4, 5, 6])) for y in (3, 8, 13, 18, 23, 28)]
    specks = [(r.randrange(T), r.randrange(T)) for _ in range(18)]
    frames = []
    for f in range(4):
        im = new(T, T, '#3d82bb')
        for x, y in specks:
            px(im, x, y, '#3677ae')
            px(im, x + 1, y, '#3677ae', True)
        for x, y, ln in waves:
            xs = x + f * 8 // 4 * 1 + f                  # 每格往右移一點
            for k in range(ln):
                px(im, xs + k, y, '#62a8da', True)
            px(im, xs + 1, y, '#bfe3f5', True)
            px(im, xs + 2, y, '#bfe3f5', True)
            for k in range(ln - 2):
                px(im, xs + k + 2, y + 1, '#3070a8', True)
        frames.append(im)
    return strip(frames)


def tile_bridge():
    """橋面：木板，上下兩側是橋的護欄"""
    r = random.Random(5)
    im = new(T, T)
    for x in range(T):
        board = '#a8743f' if (x // 8) % 2 == 0 else '#9b6937'
        for y in range(T):
            px(im, x, y, '#6e4527' if x % 8 == 0 else board)
    for _ in range(26):                                   # 木紋
        x, y = r.randrange(T), r.randrange(6, 24)
        if x % 8:
            px(im, x, y, '#8a5a30')
            px(im, x, y + 1, '#8a5a30')
    for y0 in (0, 27):                                    # 護欄
        rect(im, 0, y0, 31, y0 + 4, '#7a4e2c')
        rect(im, 0, y0, 31, y0, '#c08c52')
        rect(im, 0, y0 + 4, 31, y0 + 4, '#4f321c')
        for x in (3, 19):
            rect(im, x, y0 + 1, x + 1, y0 + 3, '#5c3b22')
    rect(im, 0, 5, 31, 5, '#6e4527')                      # 護欄的影子
    return im


def tile_reed(seed):
    """蘆葦叢：又高又密，看起來走不過去（其實是秘密入口）"""
    r = random.Random(seed)
    im = new(T, T, '#2c5233')
    greens = ['#3b6a37', '#4c8243', '#5d994b', '#35602f']
    for x in range(T):
        y = 0
        c = r.choice(greens)
        while y < T:
            run = r.randrange(5, 14)
            for k in range(run):
                px(im, x, y + k, c, True)
            y += run
            c = r.choice(greens)
    for _ in range(9):                                    # 蘆葦穗
        x, y = r.randrange(T), r.randrange(T)
        for k in range(5):
            px(im, x, y + k, '#b8915a' if k < 4 else '#7c5a33', True)
            px(im, x + 1, y + k, '#8f6a3c', True)
        px(im, x, y - 1, '#d9b77e', True)
    for _ in range(14):
        px(im, r.randrange(T), r.randrange(T), '#79b25c')
    return im


def shingles(im, x0, y0, x1, y1, base='#b5533a', dark='#7d3524', light='#cf6d4c'):
    """屋瓦：一排一排交錯"""
    for y in range(y0, y1 + 1):
        row = (y - y0) // 8
        for x in range(x0, x1 + 1):
            ly = (y - y0) % 8
            lx = (x - x0 + (4 if row % 2 else 0)) % 8
            c = base
            if ly == 7:
                c = dark
            elif ly == 0:
                c = light
            elif lx == 0:
                c = dark
            px(im, x, y, c)


def tile_roof():
    im = new(T, T)
    shingles(im, 0, 0, 31, 31)
    return im


def tile_door():
    """門口的泥土地"""
    r = random.Random(9)
    im = new(T, T, '#b9965f')
    for _ in range(40):
        px(im, r.randrange(T), r.randrange(T), r.choice(['#a88550', '#c9a970', '#a17f4d']))
    for _ in range(5):
        x, y = r.randrange(2, T - 3), r.randrange(2, T - 3)
        rect(im, x, y, x + 1, y + 1, '#8f8d9e')
        px(im, x, y, '#b3b1c0')
    return im


# ───────────────────────── 大型佈景 ─────────────────────────

def decor_hut():
    """成就小屋的外觀：6×4 格。屋頂三排、正面牆一排；正中間兩格留空給門（門是可以互動的物件）"""
    W, H = 6 * T, 4 * T
    im = new(W, H)
    shingles(im, 0, 0, W - 1, 95)
    for y in range(0, 44):                                # 後半片屋頂比較暗（背光）
        for x in range(W):
            r_, g_, b_, a_ = im.getpixel((x, y))
            im.putpixel((x, y), (int(r_ * 0.86), int(g_ * 0.86), int(b_ * 0.9), a_))
    rect(im, 0, 44, W - 1, 49, '#d98a5f')                 # 屋脊
    rect(im, 0, 44, W - 1, 44, '#f0b08a')
    rect(im, 0, 50, W - 1, 50, '#6a2c1e')
    for x0 in (0, W - 6):                                 # 兩側的封簷板
        rect(im, x0, 0, x0 + 5, 95, '#8a4a30')
        rect(im, x0, 0, x0, 95, '#a8623f')
        rect(im, x0 + 5, 0, x0 + 5, 95, '#5c2a1c')
    rect(im, 0, 90, W - 1, 95, '#6a2c1e')                 # 屋簷
    rect(im, 0, 90, W - 1, 90, '#8a4a30')
    rect(im, 138, 12, 157, 36, '#8f8d9e')                 # 煙囪
    rect(im, 136, 9, 159, 13, '#b3b1c0')
    rect(im, 136, 13, 159, 13, '#6f6d7e')
    for y in range(16, 36, 5):
        rect(im, 138, y, 157, y, '#6f6d7e')
    rect(im, 154, 14, 157, 36, '#77758a')
    # 正面的牆
    rect(im, 0, 96, W - 1, H - 1, '#e9d8b4')
    rect(im, 0, 96, W - 1, 99, '#b9a888')                 # 屋簷的影子
    r = random.Random(3)
    for _ in range(60):
        px(im, r.randrange(W), r.randrange(100, H), '#dcc9a2')
    for x0 in (0, 60, 128, W - 4):                        # 木樑
        rect(im, x0, 96, x0 + 3, H - 1, '#7a4e2c')
        rect(im, x0, 96, x0, H - 1, '#9b6937')
    rect(im, 0, H - 3, W - 1, H - 1, '#8f8d9e')           # 石頭牆基
    rect(im, 0, H - 3, W - 1, H - 3, '#b3b1c0')
    for x0 in (18, 150):                                  # 窗戶
        rect(im, x0, 103, x0 + 25, 120, '#7a4e2c')
        rect(im, x0 + 2, 105, x0 + 23, 118, '#8fd0e8')
        rect(im, x0 + 2, 105, x0 + 23, 107, '#c4ecf7')
        rect(im, x0 + 12, 105, x0 + 13, 118, '#7a4e2c')
        rect(im, x0 + 2, 111, x0 + 23, 112, '#7a4e2c')
        rect(im, x0 - 1, 121, x0 + 26, 122, '#9b6937')    # 窗台
        for k in range(4):                                # 窗台上的花
            px(im, x0 + 3 + k * 6, 119, '#f29bc0')
            px(im, x0 + 4 + k * 6, 120, '#4c8243')
    rect(im, 64, 96, 127, H - 1, (0, 0, 0, 0))            # 門的位置留空
    return im


def ent_hut_door():
    """小屋的門：2×1 格"""
    im = new(64, 32)
    rect(im, 0, 0, 63, 31, '#3a2a22')                     # 屋內的陰影
    rect(im, 0, 0, 63, 4, '#7a4e2c')                      # 門楣
    rect(im, 0, 0, 63, 0, '#9b6937')
    rect(im, 0, 4, 63, 5, '#4f321c')
    for x0 in (0, 60):
        rect(im, x0, 0, x0 + 3, 31, '#7a4e2c')
        rect(im, x0, 0, x0, 31, '#9b6937')
    for x0, x1 in ((5, 24), (39, 58)):                    # 兩扇半開的門
        rect(im, x0, 7, x1, 28, '#a8743f')
        for x in range(x0, x1 + 1, 5):
            rect(im, x, 7, x, 28, '#8a5a30')
        rect(im, x0, 7, x1, 7, '#c08c52')
        rect(im, x0, 16, x1, 17, '#6e4527')
    rect(im, 22, 17, 23, 19, '#f6c453')
    rect(im, 40, 17, 41, 19, '#f6c453')
    for dx, dy in ((0, -2), (-2, 0), (-1, 0), (0, 0), (1, 0), (2, 0), (0, -1), (-1, 1), (1, 1), (0, 1)):   # 門楣上的星星
        px(im, 32 + dx, 3 + dy, '#f6c453')
    rect(im, 4, 29, 59, 31, '#b3b1c0')                    # 門檻
    rect(im, 4, 29, 59, 29, '#d0cedb')
    return im


# ───────────────────────── 地圖物件 ─────────────────────────

WOOD, WOOD_D, WOOD_L = '#a8743f', '#6e4527', '#c08c52'
ST, ST_L, ST_D = '#8f8d9e', '#b3b1c0', '#6f6d7e'


def ent_board():
    im = new(T, T)
    for x0 in (6, 23):
        rect(im, x0, 12, x0 + 2, 28, WOOD_D)
        rect(im, x0, 12, x0, 28, '#8a5a30')
    rect(im, 2, 4, 29, 21, WOOD_D)
    rect(im, 3, 5, 28, 20, WOOD)
    rect(im, 3, 5, 28, 5, WOOD_L)
    rect(im, 5, 7, 12, 16, '#fbf6e6')                     # 貼著的紙
    for y in (9, 11, 13):
        rect(im, 6, y, 11, y, '#b9b3a0')
    rect(im, 14, 8, 20, 14, '#f6e27a')
    rect(im, 15, 10, 19, 10, '#c9a93f')
    rect(im, 15, 12, 18, 12, '#c9a93f')
    rect(im, 21, 10, 26, 18, '#f7b6cf')
    rect(im, 22, 12, 25, 12, '#d776a3')
    rect(im, 22, 15, 24, 15, '#d776a3')
    for x, y in ((8, 7), (17, 8), (23, 10)):
        px(im, x, y, '#d1495b')
    shadow(im, 16, 28, 12, 3)
    return im


def ent_bush():
    im = new(T, T)
    for cx, cy, r_ in ((10, 20, 7), (22, 20, 7), (16, 15, 9)):
        blob(im, cx, cy, r_, '#2a6338', '#3f8a46', '#5fae54', '#86c96a')
    for x, y in ((9, 17), (20, 13), (24, 21), (14, 22)):
        px(im, x, y, '#e5484d')
        px(im, x + 1, y, '#b3262f')
    shadow(im, 16, 27, 12, 3)
    return im


def ent_dig(used=False):
    im = new(T, T)
    if used:
        ellipse(im, 16, 20, 9, 5, '#8a6a42')
        ellipse(im, 16, 20, 7, 3.5, '#4f3a22')
        ellipse(im, 16, 21, 5, 2, '#3a2a18')
        rect(im, 24, 23, 27, 24, '#8a6a42')
        return im
    ellipse(im, 16, 22, 9, 4, '#9a7748')
    ellipse(im, 15, 21, 6, 2.5, '#b08a55')
    for cx, cy, s in ((16, 13, 3), (8, 17, 1), (24, 9, 1), (23, 18, 1)):   # 閃光
        for k in range(-s, s + 1):
            px(im, cx + k, cy, '#f6c453')
            px(im, cx, cy + k, '#f6c453')
        px(im, cx, cy, '#fff7c2')
    return im


def ent_lantern(lit=False):
    im = new(T, T)
    rect(im, 9, 26, 22, 29, ST_D)
    rect(im, 10, 25, 21, 27, ST)
    rect(im, 10, 25, 21, 25, ST_L)
    rect(im, 13, 17, 18, 24, ST)
    rect(im, 13, 17, 13, 24, ST_L)
    rect(im, 18, 17, 18, 24, ST_D)
    rect(im, 8, 9, 23, 16, ST)
    rect(im, 8, 9, 8, 16, ST_L)
    rect(im, 23, 9, 23, 16, ST_D)
    rect(im, 8, 16, 23, 16, ST_D)
    rect(im, 11, 10, 20, 15, '#fff0a8' if lit else '#3a3a48')
    if lit:
        rect(im, 13, 11, 18, 14, '#ffffff')
        rect(im, 11, 10, 20, 10, '#ffd66b')
        rect(im, 11, 15, 20, 15, '#ffd66b')
    rect(im, 15, 10, 16, 15, ST_D if not lit else '#e0a93a')
    for i, y in enumerate((8, 7, 6, 5)):                  # 屋頂
        rect(im, 6 + i * 2, y, 25 - i * 2, y, ST_L if i == 3 else ST)
    rect(im, 5, 8, 26, 8, ST_D)
    rect(im, 14, 2, 17, 4, ST)
    rect(im, 15, 1, 16, 1, ST_L)
    shadow(im, 16, 29, 9, 2)
    return im


def ent_plot(stage):
    """農田：empty 空的、growing 發芽、ripe 成熟"""
    r = random.Random(21)
    im = new(T, T)
    rect(im, 1, 1, 30, 30, '#5c3f27')
    rect(im, 2, 2, 29, 29, '#7a5535')
    for y in range(4, 29, 6):                             # 田壟
        rect(im, 3, y, 28, y + 1, '#8f6744')
        rect(im, 3, y + 2, 28, y + 2, '#62432a')
    for _ in range(24):
        px(im, r.randrange(3, 29), r.randrange(3, 29), r.choice(['#6a482d', '#93704c']))
    if stage == 'empty':
        return im
    for cx, cy in ((9, 10), (22, 10), (9, 23), (22, 23)):
        if stage == 'growing':
            rect(im, cx, cy - 3, cx, cy, '#4c8243')
            px(im, cx - 1, cy - 3, '#73b55a')
            px(im, cx - 2, cy - 4, '#73b55a')
            px(im, cx + 1, cy - 3, '#73b55a')
            px(im, cx + 2, cy - 4, '#8dc96a')
        else:
            ellipse(im, cx, cy, 3.4, 2.6, '#f4e9e0')      # 冒出土的蕪菁
            px(im, cx - 1, cy - 1, '#ffffff')
            rect(im, cx - 2, cy + 1, cx + 2, cy + 1, '#e8a0b0')
            for dx, hgt in ((-2, 4), (0, 6), (2, 5)):
                for k in range(hgt):
                    px(im, cx + dx, cy - 3 - k, '#73b55a' if k < hgt - 1 else '#8dc96a')
                px(im, cx + dx + (1 if dx <= 0 else -1), cy - 3 - hgt + 1, '#4c8243')
    return im


def ent_fishspot():
    """釣魚點：畫著魚的木牌"""
    im = new(T, T)
    rect(im, 15, 14, 17, 28, WOOD_D)
    rect(im, 15, 14, 15, 28, '#8a5a30')
    rect(im, 5, 4, 27, 16, WOOD_D)
    rect(im, 6, 5, 26, 15, WOOD)
    rect(im, 6, 5, 26, 5, WOOD_L)
    ellipse(im, 15, 10, 5, 3, '#8fd0e8')
    for k in range(3):
        rect(im, 20 + k, 10 - k, 20 + k, 10 + k, '#8fd0e8')
    px(im, 12, 9, '#1b2030')
    rect(im, 13, 11, 17, 11, '#5aa9d6')
    shadow(im, 16, 28, 7, 2)
    return im


def ent_pond(found=False):
    """池塘邊的石頭；找到魚魚之後，石頭旁會多一圈漣漪和一點橘色"""
    im = new(T, T)
    ellipse(im, 15, 21, 11, 6, ST_D)
    ellipse(im, 15, 20, 11, 5.5, ST)
    ellipse(im, 13, 18, 7, 3, ST_L)
    for x, y in ((6, 21), (9, 23), (22, 22), (24, 20)):   # 青苔
        px(im, x, y, '#5d994b')
        px(im, x + 1, y, '#4c8243')
    if found:
        ellipse(im, 26, 11, 4, 2.2, '#ff9a5c')
        px(im, 28, 10, '#1b2030')
        for k in range(2):
            rect(im, 21 - k, 11 - k - 1, 21 - k, 11 + k + 1, '#ff9a5c')
        for x, y in ((24, 6), (27, 4), (22, 4)):
            px(im, x, y, '#ffffff')
    shadow(im, 15, 25, 11, 3)
    return im


def ent_offering():
    """供奉石：石座上放著發光的寶石"""
    im = new(T, T)
    rect(im, 8, 17, 23, 28, ST)
    rect(im, 8, 17, 8, 28, ST_L)
    rect(im, 23, 17, 23, 28, ST_D)
    rect(im, 8, 28, 23, 28, ST_D)
    rect(im, 5, 13, 26, 17, ST)
    rect(im, 5, 13, 26, 13, ST_L)
    rect(im, 5, 17, 26, 17, ST_D)
    for y in (21, 24):
        rect(im, 11, y, 20, y, ST_D)
    for i, w in enumerate((1, 2, 3, 3, 2, 1)):            # 菱形寶石
        rect(im, 16 - w, 4 + i, 15 + w, 4 + i, '#9d8cff')
        px(im, 16 - w, 4 + i, '#d6ccff')
        px(im, 15 + w, 4 + i, '#6c5ce7')
    px(im, 15, 6, '#ffffff')
    rect(im, 12, 11, 19, 12, '#6c5ce7')
    for x, y in ((9, 6), (22, 5), (11, 2), (21, 9)):
        px(im, x, y, '#d6ccff')
    shadow(im, 16, 29, 10, 2)
    return im


def ents_bug():
    """蟲：四格動畫，一閃一閃的螢光"""
    frames = []
    for f, (rad, bob) in enumerate(((2, 0), (3, -1), (4, 0), (3, 1))):
        im = new(T, T)
        cx, cy = 16, 16 + bob
        for y in range(cy - rad - 1, cy + rad + 2):
            for x in range(cx - rad - 1, cx + rad + 2):
                d = math.hypot(x - cx + 0.5, y - cy + 0.5)
                if d <= rad + 0.5:
                    px(im, x, y, (236, 255, 150, 60 if d > rad - 1 else 120))
        rect(im, cx - 1, cy - 1, cx, cy, '#f4ff9a')
        px(im, cx - 1, cy - 1, '#ffffff')
        px(im, cx - 2, cy - 2 + (f % 2), '#cfe8ff')       # 翅膀
        px(im, cx + 1, cy - 2 + (f % 2), '#cfe8ff')
        frames.append(im)
    return strip(frames)


def ent_tree():
    """地圖上的許願樹：圖是 3×3 格（96×96），比它佔的 2×2 格大，樹冠會往上、往左右伸出去。
    四種顏色的葉團交錯成一個樹冠，枝條下掛著小小的許願牌"""
    r = random.Random(42)
    S = 96
    im = new(S, S)
    # 樹幹、兩根往上分岔的粗枝、樹根
    rect(im, 42, 52, 53, 88, '#7a5236')
    rect(im, 42, 52, 44, 88, '#946a47')
    rect(im, 52, 52, 53, 88, '#553622')
    for k in range(6):
        rect(im, 41 - k, 83 + k // 1, 42, 83 + k, '#7a5236')
        rect(im, 53, 83 + k, 55 + k, 83 + k, '#553622')
    for y in (62, 70, 78):
        rect(im, 46, y, 49, y, '#553622')
    for k in range(12):
        rect(im, 42 - k, 54 - k, 45 - k, 55 - k, '#7a5236')
        rect(im, 50 + k, 54 - k, 53 + k, 55 - k, '#6a4630')
    # 樹冠：很多小葉團由後往前疊。每團一種顏色、各自有明暗與參差的葉緣；
    # 相鄰兩團的交界撒上彼此的顏色，四色自然混在一起，整體仍是一棵樹的輪廓
    sets = [('#c9648f', '#ee93b8', '#fbc0d8', '#ffe1ec'), ('#7a5fb8', '#a487dc', '#c9b5ef', '#e6dcf9'),
            ('#379482', '#5fc0aa', '#97dfcd', '#cff3ea'), ('#c79c34', '#ecc85c', '#f7e196', '#fff4c8')]
    lumps = []
    for i in range(44):                                   # 葉團落在一個略扁的大圓裡
        a = r.random() * math.tau
        d = math.sqrt(r.random())
        lumps.append((48 + math.cos(a) * d * 34, 33 + math.sin(a) * d * 22, r.choice([6, 7, 8, 9, 10]), i % 4))
    lumps.append((48, 30, 12, 0))
    owner = {}
    for cx, cy, rad, k in sorted(lumps, key=lambda q: q[1]):
        jag = [rad + r.choice([-1, 0, 0, 0, 1]) for _ in range(20)]       # 參差的葉緣
        d_, m_, l_, h_ = sets[k]
        for y in range(int(cy - rad) - 2, int(cy + rad) + 3):
            for x in range(int(cx - rad) - 2, int(cx + rad) + 3):
                dx, dy = x - cx, y - cy
                dist = math.hypot(dx, dy)
                lim = jag[int((math.atan2(dy, dx) + math.pi) / math.tau * 20) % 20]
                if dist > lim or not (0 <= x < S and 0 <= y < S):
                    continue
                t = (dx + dy * 1.2) / lim + (r.random() - 0.5) * 0.5
                c = h_ if t < -1.0 else l_ if t < -0.45 else m_ if t < 0.55 else d_
                if dist > lim - 1 and t > -0.2:
                    c = d_
                px(im, x, y, c)
                owner[(x, y)] = k
    for (x, y), k in list(owner.items()):                 # 交界處的混色
        for nx, ny in ((x + 1, y), (x, y + 1)):
            k2 = owner.get((nx, ny))
            if k2 is not None and k2 != k and r.random() < 0.55:
                px(im, x, y, sets[k2][1])
    for x, ln, c in ((20, 5, '#fff6e0'), (31, 9, '#ffe3ee'), (64, 7, '#e8defa'), (75, 4, '#d0f5ec'), (57, 10, '#fff6d0'), (40, 6, '#e8defa')):   # 許願牌
        top = max(y for (xx, y) in owner if xx == x) + 1     # 繩子從樹冠下緣垂下來
        rect(im, x, top, x, top + ln - 1, '#b9a888')
        rect(im, x - 2, top + ln, x + 2, top + ln + 5, c)
        rect(im, x - 2, top + ln + 5, x + 2, top + ln + 5, '#c9b48f')
        px(im, x, top + ln, '#b9a888')
    shadow(im, 48, 89, 24, 5)
    return im


def ent_pillar():
    """卡殿裡的石柱（1×1 格的底座，圖是 1×2 格往上伸）：柱身、柱頭與一圈紫色符文"""
    im = new(T, T * 2)
    rect(im, 4, 52, 27, 61, ST_D)
    rect(im, 5, 52, 26, 59, ST)
    rect(im, 5, 52, 26, 52, ST_L)
    rect(im, 8, 10, 23, 51, ST)
    rect(im, 8, 10, 10, 51, ST_L)
    rect(im, 21, 10, 23, 51, ST_D)
    for x in (13, 17):
        rect(im, x, 12, x, 49, '#82808f')
    rect(im, 8, 28, 23, 31, '#6c5ce7')                    # 符文帶
    for x in range(9, 23, 3):
        px(im, x, 29, '#d6ccff')
    rect(im, 4, 4, 27, 9, ST)
    rect(im, 4, 4, 27, 4, ST_L)
    rect(im, 4, 9, 27, 9, ST_D)
    rect(im, 6, 1, 25, 3, ST_L)
    shadow(im, 16, 61, 13, 2)
    return im


def ent_banner():
    """卡殿牆上的掛旗（1×2 格，掛在牆上）"""
    im = new(T, T * 2)
    rect(im, 4, 2, 27, 4, WOOD_D)
    rect(im, 4, 2, 27, 2, WOOD_L)
    rect(im, 7, 5, 24, 50, '#5b3a8c')
    rect(im, 7, 5, 9, 50, '#7551ad')
    rect(im, 22, 5, 24, 50, '#432a69')
    for k in range(8):                                    # 燕尾的下緣
        rect(im, 7, 51 + k, 15 - k, 51 + k, '#5b3a8c')
        rect(im, 16 + k, 51 + k, 24, 51 + k, '#5b3a8c')
    for i, w in enumerate((1, 2, 3, 4, 3, 2, 1)):         # 卡片圖樣
        rect(im, 16 - w, 18 + i * 2, 15 + w, 19 + i * 2, '#f6c453')
    rect(im, 13, 21, 18, 29, '#fff0a8')
    px(im, 15, 24, '#d1495b')
    px(im, 16, 24, '#d1495b')
    rect(im, 9, 9, 22, 9, '#f6c453')
    rect(im, 9, 44, 22, 44, '#f6c453')
    return im


def ent_altar():
    """召喚法陣（2×2 格）：圓形石台上刻著發光的符文"""
    im = new(64, 64)
    ellipse(im, 32, 36, 29, 23, ST_D)
    ellipse(im, 32, 34, 29, 23, ST)
    ellipse(im, 32, 33, 26, 20, ST_L)
    ellipse(im, 32, 34, 25, 19.5, '#a3a1b3')
    for a in range(0, 360, 2):                            # 外圈符文環
        x = 32 + math.cos(math.radians(a)) * 21
        y = 34 + math.sin(math.radians(a)) * 16
        px(im, round(x), round(y), '#6c5ce7')
        if a % 30 < 8:
            px(im, round(32 + math.cos(math.radians(a)) * 23), round(34 + math.sin(math.radians(a)) * 17.6), '#9d8cff')
    pts = [(32 + math.cos(math.radians(a - 90)) * 17, 34 + math.sin(math.radians(a - 90)) * 13) for a in range(0, 360, 45)]
    d = ImageDraw.Draw(im)
    for quad in ((0, 2, 4, 6), (1, 3, 5, 7)):             # 兩個交錯的方形組成八角星
        for i in range(4):
            a, b = pts[quad[i]], pts[quad[(i + 1) % 4]]
            d.line([a, b], fill=rgb('#7d6df0'), width=1)
    for a in range(0, 360, 3):                            # 內圈
        px(im, round(32 + math.cos(math.radians(a)) * 9), round(34 + math.sin(math.radians(a)) * 6.8), '#8c7cf5')
    ellipse(im, 32, 34, 5, 3.8, '#9d8cff')
    ellipse(im, 32, 34, 3, 2.2, '#d6ccff')
    px(im, 31, 33, '#ffffff')
    for x, y in pts:                                      # 八個角上的小水晶
        px(im, round(x), round(y) - 1, '#d6ccff')
        px(im, round(x), round(y), '#9d8cff')
    return im


def ent_market():
    """商店（2×2 格）：條紋遮陽棚的攤位"""
    im = new(64, 64)
    rect(im, 6, 26, 57, 40, '#3b2a22')                    # 攤位內部
    for x0 in (4, 56):                                    # 柱子
        rect(im, x0, 24, x0 + 3, 58, WOOD_D)
        rect(im, x0, 24, x0, 58, '#8a5a30')
    for x in range(2, 62):                                # 遮陽棚
        stripe = '#d1495b' if ((x - 2) // 8) % 2 == 0 else '#f6ead0'
        dark = '#a3303f' if stripe == '#d1495b' else '#d9c9a8'
        for y in range(8, 25):
            px(im, x, y, stripe if y < 21 else dark)
        if (x - 2) % 8 not in (0, 7):                     # 波浪形的下緣
            px(im, x, 25, dark)
            if (x - 2) % 8 in (3, 4):
                px(im, x, 26, dark)
    rect(im, 2, 8, 61, 8, '#fff6e6')
    rect(im, 2, 6, 61, 7, WOOD_D)
    rect(im, 4, 40, 59, 43, WOOD_L)                       # 櫃台
    rect(im, 4, 44, 59, 56, WOOD)
    rect(im, 4, 44, 59, 44, WOOD_D)
    for x in range(10, 58, 8):
        rect(im, x, 45, x, 56, '#8a5a30')
    rect(im, 4, 56, 59, 57, WOOD_D)
    # 櫃台上的貨物：種子袋、飼料罐、魚餌
    for x0, c, c2 in ((9, '#c9b48f', '#63a34d'), (19, '#c9b48f', '#f0cf66')):
        rect(im, x0, 33, x0 + 6, 40, c)
        rect(im, x0 + 1, 32, x0 + 5, 32, '#a8926a')
        rect(im, x0 + 2, 35, x0 + 4, 37, c2)
    rect(im, 30, 34, 35, 40, '#8fd0e8')
    rect(im, 30, 33, 35, 33, WOOD_D)
    rect(im, 31, 36, 34, 38, '#f29bc0')
    for x0 in (40, 46, 52):
        ellipse(im, x0 + 2, 38, 2.5, 2.5, '#e5484d' if x0 != 46 else '#f0cf66')
        px(im, x0 + 1, 37, '#ffffff')
    ellipse(im, 32, 4, 4, 4, '#f6c453')                   # 招牌上的金幣
    ellipse(im, 32, 4, 2.5, 2.5, '#fff0a8')
    rect(im, 32, 2, 32, 6, '#d1a93f')
    shadow(im, 32, 59, 28, 3)
    return im


def ent_casino():
    """小賭場（2×2 格）：紫色小屋，屋簷有一排燈泡，招牌是兩顆骰子"""
    im = new(64, 64)
    rect(im, 6, 22, 57, 57, '#5b3a8c')
    rect(im, 6, 22, 9, 57, '#7551ad')
    rect(im, 52, 22, 57, 57, '#432a69')
    for y in range(26, 56, 6):
        rect(im, 10, y, 51, y, '#4e3179')
    for i in range(12):                                   # 拱形屋頂
        w = 28 - (i * i) // 6
        rect(im, 32 - w, 20 - i, 31 + w, 20 - i, '#8c2f39' if i < 10 else '#b0434e')
    rect(im, 3, 20, 60, 23, '#f6c453')                    # 屋簷
    rect(im, 3, 20, 60, 20, '#fff0a8')
    rect(im, 3, 23, 60, 23, '#c9962f')
    for i, x in enumerate(range(6, 60, 6)):               # 燈泡
        c = '#fff7c2' if i % 2 == 0 else '#ff8fa3'
        rect(im, x, 24, x + 1, 25, c)
    for x0 in (20, 34):                                   # 骰子招牌
        rect(im, x0, 8, x0 + 9, 17, '#ffffff')
        rect(im, x0, 17, x0 + 9, 17, '#c9c7d6')
        rect(im, x0 + 9, 8, x0 + 9, 17, '#c9c7d6')
    for x, y in ((22, 10), (27, 15), (24, 12)):
        rect(im, x, y, x + 1, y + 1, '#1b2030')
    for x, y in ((36, 10), (41, 10), (36, 15), (41, 15), (38, 12)):
        rect(im, x, y, x + 1, y + 1, '#e5484d')
    rect(im, 24, 34, 39, 57, '#2a1d3a')                   # 門與門簾
    rect(im, 24, 34, 39, 35, '#f6c453')
    for x in range(25, 39):
        if (x // 2) % 2 == 0:
            rect(im, x, 36, x, 50 - abs(x - 31) // 2, '#b0434e')
        else:
            rect(im, x, 36, x, 50 - abs(x - 31) // 2, '#8c2f39')
    for x0 in (12, 44):                                   # 發光的窗
        rect(im, x0, 34, x0 + 7, 43, '#f6c453')
        rect(im, x0 + 1, 35, x0 + 6, 42, '#fff0a8')
        rect(im, x0 + 3, 35, x0 + 4, 42, '#c9962f')
        rect(im, x0 + 1, 38, x0 + 6, 39, '#c9962f')
    rect(im, 6, 57, 57, 58, '#2f1d4a')
    shadow(im, 32, 60, 28, 3)
    return im


def ent_tank():
    """魚缸（2×1 格）：木架上的玻璃水族箱"""
    im = new(64, 32)
    rect(im, 2, 25, 61, 30, WOOD)
    rect(im, 2, 25, 61, 25, WOOD_L)
    rect(im, 2, 30, 61, 30, WOOD_D)
    for x0 in (5, 56):
        rect(im, x0, 28, x0 + 2, 31, WOOD_D)
    rect(im, 4, 2, 59, 24, '#2f4a5e')                     # 外框
    rect(im, 5, 3, 58, 23, '#58aed4')
    rect(im, 5, 3, 58, 7, '#7cc6e4')
    rect(im, 5, 3, 58, 3, '#d6f1fa')                      # 水面
    rect(im, 5, 20, 58, 23, '#d9c58a')                    # 底砂
    for x in range(6, 58, 3):
        px(im, x, 21, '#c2ad70')
    for x0, hgt in ((10, 9), (14, 6), (48, 10), (52, 7)): # 水草
        for k in range(hgt):
            px(im, x0 + (k % 3 == 1), 19 - k, '#3f8a46' if k % 2 else '#5fae54')
    for cx, cy, c, dir_ in ((24, 11, '#ff9a5c', 1), (38, 15, '#f7b6cf', -1), (31, 8, '#f0cf66', 1)):   # 小魚
        ellipse(im, cx, cy, 3, 1.8, c)
        for k in range(2):
            rect(im, cx - dir_ * (4 + k), cy - k - 1 + 1 - 1, cx - dir_ * (4 + k), cy + k, c)
        px(im, cx + dir_ * 2, cy - 1, '#1b2030')
    for x, y in ((20, 6), (21, 9), (44, 7), (43, 11)):
        px(im, x, y, '#ffffff')
    for k in range(6):                                    # 玻璃反光
        px(im, 8 + k, 16 - k, '#bfe6f5')
        px(im, 9 + k, 16 - k, '#9bd6ee')
    shadow(im, 32, 31, 28, 1.5)
    return im


# ───────────────────────── 輸出 ─────────────────────────

def main():
    out = {}
    # 草地 8 款：大多是素的，只有一款有花、兩款有高草，鋪開來才不會變成整齊的圓點花紋
    out['tile.grass'] = save(strip([tile_grass(1), tile_grass(2), tile_grass(3, tufts=1), tile_grass(4), tile_grass(5), tile_grass(6, flowers=1), tile_grass(7), tile_grass(8, tufts=2)]), 'tiles', 'grass.png')
    out['tile.wall'] = save(strip([tile_forest(1), tile_forest(2), tile_forest(3)]), 'tiles', 'forest.png')
    out['tile.stone'] = save(strip([tile_stone(1), tile_stone(2), tile_stone(3, crack=True)]), 'tiles', 'stone.png')
    out['tile.hallwall'] = save(strip([tile_hallwall(1), tile_hallwall(2)]), 'tiles', 'hallwall.png')
    out['tile.water'] = save(tiles_water(), 'tiles', 'water.png')
    out['tile.bridge'] = save(tile_bridge(), 'tiles', 'bridge.png')
    out['tile.reed'] = save(strip([tile_reed(1), tile_reed(2)]), 'tiles', 'reed.png')
    out['tile.hut'] = save(tile_roof(), 'tiles', 'roof.png')
    out['tile.door'] = save(tile_door(), 'tiles', 'door.png')
    out['decor.hut'] = save(decor_hut(), 'decor', 'hut.png')
    out['ent.hut'] = save(ent_hut_door(), 'sprites', 'hut-door.png')
    out['ent.board'] = save(ent_board(), 'sprites', 'board.png')
    out['ent.bush'] = save(ent_bush(), 'sprites', 'bush.png')
    out['ent.dig'] = save(ent_dig(False), 'sprites', 'dig.png')
    out['ent.dig.used'] = save(ent_dig(True), 'sprites', 'dig-used.png')
    out['ent.lantern'] = save(ent_lantern(False), 'sprites', 'lantern.png')
    out['ent.lantern.lit'] = save(ent_lantern(True), 'sprites', 'lantern-lit.png')
    for stage in ('empty', 'growing', 'ripe'):
        out[f'ent.plot.{stage}'] = save(ent_plot(stage), 'sprites', f'plot-{stage}.png')
    out['ent.fishspot'] = save(ent_fishspot(), 'sprites', 'fishspot.png')
    out['ent.pond'] = save(ent_pond(False), 'sprites', 'pond.png')
    out['ent.pond.found'] = save(ent_pond(True), 'sprites', 'pond-found.png')
    out['ent.offering'] = save(ent_offering(), 'sprites', 'offering.png')
    out['ent.bugspot'] = save(ents_bug(), 'sprites', 'bug.png')
    out['ent.tree'] = save(ent_tree(), 'sprites', 'wish-tree.png')
    out['ent.altar'] = save(ent_altar(), 'sprites', 'altar.png')
    out['ent.pillar'] = save(ent_pillar(), 'sprites', 'pillar.png')
    out['ent.banner'] = save(ent_banner(), 'sprites', 'banner.png')
    out['ent.market'] = save(ent_market(), 'sprites', 'market.png')
    out['ent.casino'] = save(ent_casino(), 'sprites', 'casino.png')
    out['ent.tank'] = save(ent_tank(), 'sprites', 'tank.png')
    for key, path in out.items():
        print(f'{key:18s} {os.path.relpath(path, os.path.join(ROOT, ".."))}')


if __name__ == '__main__':
    main()
