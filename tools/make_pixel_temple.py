#!/usr/bin/env python3
"""召喚神殿（地圖上抽卡的地方）的像素圖：白色大理石、像神話裡的神殿，魔法的部分是紫色。

用法：  python3 tools/make_pixel_temple.py        （需要 Pillow）

輸出：
  assets/decor/temple.png        整座神殿的地板與弧形外牆（22×14 格 = 704×448），蓋在地圖 (9, 0) 的位置
  assets/tiles/marble.png        大理石地板圖塊（三款變化；佈景圖沒載入時才看得到）
  assets/sprites/column.png      白色大理石柱（1×3 格），柱頭上浮著紫色水晶
  assets/sprites/column-broken.png  斷掉的柱子
  assets/sprites/altar.png       中央的召喚台（3×3 格）：兩層大理石圓台，台面是發光的紫色法陣

神殿的形狀由 templeK() 決定，必須和 js/data/maps/town.js 的 templeK() / TEMPLE 一模一樣：
地板、外牆的位置（碰撞）是 town.js 算的，這裡只負責把它畫得好看。
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_pixel_assets import new, px, rect, ellipse, rgb, save, strip  # noqa: E402

T = 32
TEMPLE = {'cx': 20, 'cy': 6.6, 'rx': 8.4, 'ry': 5.2, 'floor': 0.86, 'gate': (19, 20)}
ORIGIN = (9, 0)                      # 佈景圖左上角在地圖上的格子座標
DW, DH = 22, 14                      # 佈景圖大小（格）

MARBLE, MARBLE_L, MARBLE_D, SEAM = '#f1eef5', '#fbfaff', '#ddd7e6', '#d3cce0'
GOLD, GOLD_L, GOLD_D = '#e0b45a', '#f8e2a0', '#a9832f'
VIOLET, VIOLET_L, VIOLET_D, VIOLET_G = '#8b5cf0', '#c9a8ff', '#4b2a8a', '#efe2ff'


def temple_k(x, y):
    dx, dy = (x - TEMPLE['cx']) / TEMPLE['rx'], (y - TEMPLE['cy']) / TEMPLE['ry']
    a = math.atan2(dy, dx)
    m = 1 + 0.11 * math.sin(a + 0.6) + 0.08 * math.sin(2 * a + 1.9) + 0.045 * math.cos(3 * a - 0.4)
    return math.hypot(dx, dy) / m, a


def C(c):
    return rgb(c) if isinstance(c, str) else c


def mix(c1, c2, t):
    a, b = C(c1), C(c2)
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


def decor_temple():
    r = random.Random(77)
    W, H = DW * T, DH * T
    im = new(W, H)
    K = [[None] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            K[y][x] = temple_k(ORIGIN[0] + (x + 0.5) / T, ORIGIN[1] + (y + 0.5) / T)
    F0, R1 = 0.875, 0.995                 # 地板到這裡、外牆到這裡
    FACE = 12                              # 南側外牆露出的牆面高度（像素）

    def in_gate(x, y):
        gx = ORIGIN[0] + x / T
        return TEMPLE['gate'][0] - 0.05 < gx < TEMPLE['gate'][1] + 1.05 and ORIGIN[1] + y / T > TEMPLE['cy']

    def broken(a):                         # 東北邊有一段坍塌的外牆
        return -1.05 < a < -0.55

    # 大理石紋：幾條淡淡的灰紫色紋路（隨機漫步）
    veins = set()
    for _ in range(46):
        x, y = r.randrange(W), r.randrange(H)
        ang = r.random() * math.tau
        for _ in range(r.randrange(20, 70)):
            veins.add((int(x), int(y)))
            ang += (r.random() - 0.5) * 0.7
            x += math.cos(ang)
            y += math.sin(ang) * 0.7

    rim = [[False] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            k, a = K[y][x]
            if k < F0 or (in_gate(x, y) and k < 1.0):
                # ── 地板：同心圓的大理石板，越外圈分得越細；金色與紫色的鑲嵌環 ──
                ring = int(k / 0.11)
                sectors = 6 + ring * 4
                sec = int(((a + math.pi + ring * 0.37) / math.tau) * sectors)
                k2, a2 = K[y][min(W - 1, x + 1)]
                k3, a3 = K[min(H - 1, y + 1)][x]
                seam = int(k2 / 0.11) != ring or int(k3 / 0.11) != ring
                s2 = int(((a2 + math.pi + ring * 0.37) / math.tau) * sectors)
                s3 = int(((a3 + math.pi + ring * 0.37) / math.tau) * sectors)
                seam = seam or ((s2 != sec or s3 != sec) and k > 0.2)
                c = mix(MARBLE_L, MARBLE, min(1, k * 1.1))
                if (sec + ring) % 2:
                    c = mix(c, MARBLE_D, 0.25)
                if (x, y) in veins:
                    c = mix(c, '#c7bfd6', 0.55)
                if seam:
                    c = rgb(SEAM)
                if 0.62 <= k < 0.645:                             # 金色鑲嵌環
                    c = rgb(GOLD_L if k < 0.632 else GOLD)
                if 0.43 <= k < 0.452:                             # 紫色符文環（點狀，會發光）
                    c = rgb(VIOLET if (x // 3 + y // 3) % 2 else VIOLET_L)
                if 0.39 < k < 0.43 or 0.452 <= k < 0.49:
                    c = mix(c, VIOLET_G, 0.55)
                if in_gate(x, y) and k >= F0:                    # 入口：往外延伸的台階
                    step = int((k - F0) / 0.035)
                    c = rgb(MARBLE_L if step % 2 == 0 else '#d8d1e3')
                px(im, x, y, c)
            elif k < R1 and not in_gate(x, y):
                rim[y][x] = True
                # ── 外牆頂：白色大理石，內側一圈金邊 ──
                t = (k - F0) / (R1 - F0)
                c = rgb(GOLD) if t < 0.12 else rgb(GOLD_L) if t < 0.2 else mix(MARBLE_L, '#e6e1ee', t)
                if t > 0.9:
                    c = rgb('#cfc8dc')
                if broken(a):                                     # 坍塌的那段：一塊一塊缺角、裂縫
                    blk = random.Random((x // 5) * 131 + (y // 4) * 17).random()
                    if blk < 0.3:
                        c = rgb('#b3abc2') if (x + y) % 5 else rgb('#8f88a0')
                    elif blk < 0.42:
                        c = rgb('#d9d3e3')
                    if (x * 3 + y * 7) % 23 == 0:
                        c = rgb('#7d7690')
                px(im, x, y, c)
    # 南側的牆面：外牆往下露出一段，有直條的溝紋；底下一道陰影
    for y in range(H):
        for x in range(W):
            if rim[y][x] or im.getpixel((x, y))[3]:
                continue
            for d in range(1, FACE + 1):
                if y - d >= 0 and rim[y - d][x]:
                    k, a = K[y - d][x]
                    if math.sin(a) < -0.15:                       # 北側的牆面被牆頂擋住，看不到
                        break
                    hgt = FACE - (6 if broken(a) else 0)
                    if d > hgt:
                        break
                    c = mix('#ece8f2', '#bdb5cb', d / FACE)
                    if x % 7 == 0:
                        c = mix(c, '#a99fbc', 0.5)
                    if d == 1:
                        c = rgb(GOLD_D)
                    px(im, x, y, c)
                    break
    for y in range(H - 1, 0, -1):
        for x in range(W):
            if not im.getpixel((x, y))[3] and im.getpixel((x, y - 1))[3] and not rim[y - 1][x]:
                k, a = K[y - 1][x]
                if k >= R1:
                    for d in range(3):
                        if y + d < H and not im.getpixel((x, y + d))[3]:
                            px(im, x, y + d, (40, 50, 30, 70 - d * 20))
    # 坍塌處掉在外面草地上的碎石
    for _ in range(9):
        a = r.uniform(-1.0, -0.6)
        k = r.uniform(1.03, 1.18)
        m = 1 + 0.11 * math.sin(a + 0.6) + 0.08 * math.sin(2 * a + 1.9) + 0.045 * math.cos(3 * a - 0.4)
        gx = TEMPLE['cx'] + math.cos(a) * k * m * TEMPLE['rx']
        gy = TEMPLE['cy'] + math.sin(a) * k * m * TEMPLE['ry']
        x, y = int((gx - ORIGIN[0]) * T), int((gy - ORIGIN[1]) * T)
        w, h = r.randrange(5, 11), r.randrange(4, 7)
        rect(im, x, y, x + w, y + h, '#e9e4f0')
        rect(im, x, y + h - 1, x + w, y + h, '#b8b0c6')
        rect(im, x, y, x + w, y, '#fbfaff')
    # 地板上散落的紫色光點
    for _ in range(40):
        x, y = r.randrange(W), r.randrange(H)
        k, _ = K[y][x]
        if k < 0.8:
            px(im, x, y, VIOLET_L if r.random() < 0.6 else VIOLET_G)
    return im


def tiles_marble():
    frames = []
    for v in range(3):
        r = random.Random(300 + v)
        im = new(T, T, MARBLE)
        for y in range(T):
            for x in range(T):
                if (x // 16 + y // 16 + v) % 2:
                    px(im, x, y, mix(MARBLE, MARBLE_D, 0.2))
        rect(im, 0, 0, T - 1, 0, SEAM)
        rect(im, 0, 0, 0, T - 1, SEAM)
        x, y = r.randrange(T), r.randrange(T)
        for _ in range(26):
            px(im, int(x) % T, int(y) % T, '#cfc7dc')
            x += r.choice((-1, 0, 1, 1))
            y += r.choice((0, 1))
        frames.append(im)
    return strip(frames)


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
    out = [save(decor_temple(), 'decor', 'temple.png'), save(tiles_marble(), 'tiles', 'marble.png'),
           save(column(), 'sprites', 'column.png'), save(column(True), 'sprites', 'column-broken.png'),
           save(altar(), 'sprites', 'altar.png')]
    print(f'輸出 {len(out)} 張圖')


if __name__ == '__main__':
    main()
