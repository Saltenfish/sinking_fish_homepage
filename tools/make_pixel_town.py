#!/usr/bin/env python3
"""小鎮的斜俯視（3/4 視角）像素素材：人物、地圖上的小物件、建築、地面圖塊。

用法：  python3 tools/make_pixel_town.py          （需要 Pillow；make_pixel_assets.py 跑完也會自動呼叫這支）

統一的規則（和召喚神殿遺跡一樣）：
  ・比例：1 格 = 32 像素，所有圖都用 1 倍像素密度（圖多大就畫多大，不再把 32px 的圖放大成兩格）
          人物 1×1.5 格；石燈籠 1×2 格；告示牌 2×1.5 格；草叢 1.5×1.25 格；商店、賭場 4×3 格
  ・光從左上來：頂面亮、正面暗、右側更暗
  ・每個站著的東西外面一圈深色外框
  ・影子是深綠色，落在腳下偏右下
物件的圖比一格大時，地圖上的 art 範圍寫在 js/world/types.js 的 ART。
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_pixel_assets import new, px, rect, ellipse, rgb, save, strip, tile_grass  # noqa: E402

T = 32
LINE = '#2e2830'          # 一般物件的外框
LINE_W = '#3a2618'        # 木頭物件的外框
SHADOW = (22, 50, 26)


def C(c):
    return rgb(c) if isinstance(c, str) else c


def mix(a, b, t):
    a, b = C(a), C(b)
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


def outline(im, color=LINE, alpha_min=200):
    W, H = im.size
    src = im.copy()
    for y in range(H):
        for x in range(W):
            if src.getpixel((x, y))[3] >= 128:
                continue
            if any(0 <= x + dx < W and 0 <= y + dy < H and src.getpixel((x + dx, y + dy))[3] >= alpha_min
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                px(im, x, y, color)
    return im


def shadow_under(im, cx, cy, rx, ry, a=120):
    """腳下的影子（深綠、畫在最底層）"""
    base = new(*im.size)
    ellipse(base, cx, cy, rx, ry, SHADOW + (a,))
    base.alpha_composite(im)
    im.paste(base, (0, 0))
    return im


def box(im, x0, y0, x1, y1, top_h, top, front, side=None, line=None):
    """斜俯視的方塊：上面 top_h 像素是頂面（亮），下面是正面（暗），最右兩欄是側光（更暗）"""
    side = side or mix(front, '#000000', 0.18)
    rect(im, x0, y0, x1, y0 + top_h - 1, top)
    rect(im, x0, y0, x1, y0, mix(top, '#ffffff', 0.4))
    rect(im, x0, y0 + top_h, x1, y1, front)
    rect(im, x1 - 1, y0 + top_h, x1, y1, side)
    rect(im, x0, y1, x1, y1, mix(front, '#000000', 0.3))
    if line:
        rect(im, x0, y0 + top_h, x1, y0 + top_h, line)


# ───────────────────────────── 人物 ─────────────────────────────

def player():
    """玩家行走圖：每格 32×48，四列（下、左、右、上）× 四格走路。
    Q 版比例：大頭、短身體；深色頭髮、米色上衣配藍色背心、深色褲子，外面一圈深色框，腳下有影子"""
    FW, FH = 32, 48
    SKIN, SKIN_D = '#f6d2b0', '#d9a882'
    HAIR, HAIR_L, HAIR_D = '#4a3a5c', '#6c5a84', '#2e2340'
    SHIRT, SHIRT_D = '#f4ead6', '#d6c8ac'
    VEST, VEST_D, VEST_L = '#4f86c6', '#356397', '#7aa9de'
    PANTS, PANTS_D = '#3b3550', '#2a2540'
    SHOE = '#5a3a2a'
    sheet = new(FW * 4, FH * 4)
    for row, face in enumerate(('down', 'left', 'right', 'up')):
        for f in range(4):
            im = new(FW, FH)
            bob = (0, -1, 0, -1)[f]
            step = (0, 1, 0, -1)[f]                         # 走路時兩腳前後交替
            cx = 16
            # 腳與褲子
            for side, k in ((-1, step), (1, -step)):
                lx = cx + side * 3 - 1
                if face in ('left', 'right'):
                    lx = cx - 2 + k * 2 * (1 if face == 'right' else -1) * side
                rect(im, lx - 1, 36 + bob, lx + 2, 40 + bob + (1 if k > 0 else 0), PANTS)
                rect(im, lx + 1, 36 + bob, lx + 2, 40 + bob, PANTS_D)
                rect(im, lx - 1, 41 + bob + (1 if k > 0 else 0), lx + 2, 42 + bob + (1 if k > 0 else 0), SHOE)
            # 身體：上衣＋背心
            rect(im, cx - 6, 26 + bob, cx + 5, 36 + bob, SHIRT)
            rect(im, cx - 6, 26 + bob, cx + 5, 35 + bob, VEST)
            rect(im, cx - 6, 26 + bob, cx - 5, 35 + bob, VEST_L)
            rect(im, cx + 4, 26 + bob, cx + 5, 35 + bob, VEST_D)
            rect(im, cx - 6, 35 + bob, cx + 5, 36 + bob, VEST_D)
            if face == 'down':
                rect(im, cx - 2, 26 + bob, cx + 1, 30 + bob, SHIRT)   # 領口
                rect(im, cx - 1, 31 + bob, cx, 33 + bob, SHIRT_D)
            # 手臂（左右擺）
            for side in (-1, 1):
                if face in ('left', 'right') and side == (1 if face == 'left' else -1):
                    continue
                ax = cx + side * 7 - (1 if side < 0 else 0)
                sw = step * side if face in ('down', 'up') else step
                rect(im, ax, 27 + bob + sw, ax + 1, 33 + bob + sw, SHIRT)
                rect(im, ax, 34 + bob + sw, ax + 1, 35 + bob + sw, SKIN)
            # 頭：大大的圓臉
            hy = 8 + bob
            for y in range(hy, hy + 18):
                t = (y - hy) / 17
                half = round(9.5 * math.sqrt(max(0, 1 - ((t - 0.5) / 0.55) ** 2)))
                for x in range(cx - half, cx + half):
                    c = SKIN if x < cx + half - 2 else SKIN_D
                    px(im, x, y, c)
            # 頭髮
            for y in range(hy - 1, hy + 9):
                t = (y - hy + 1) / 9
                half = round(10 * math.sqrt(max(0, 1 - ((t - 0.75) / 0.85) ** 2)))
                for x in range(cx - half, cx + half):
                    px(im, x, y, HAIR_L if (y < hy + 2 and x < cx) else HAIR)
            if face == 'up':
                rect(im, cx - 9, hy, cx + 8, hy + 15, HAIR)
                rect(im, cx - 9, hy, cx - 6, hy + 12, HAIR_L)
                rect(im, cx + 6, hy + 2, cx + 8, hy + 15, HAIR_D)
            elif face == 'down':
                rect(im, cx - 9, hy + 6, cx - 7, hy + 13, HAIR)     # 兩側鬢髮
                rect(im, cx + 6, hy + 6, cx + 8, hy + 13, HAIR_D)
                for x in range(cx - 7, cx + 7, 3):                   # 瀏海
                    rect(im, x, hy + 7, x + 1, hy + 8, HAIR)
                rect(im, cx - 5, hy + 10, cx - 4, hy + 12, '#2e2340')  # 眼睛
                rect(im, cx + 3, hy + 10, cx + 4, hy + 12, '#2e2340')
                px(im, cx - 5, hy + 10, '#ffffff')
                px(im, cx + 3, hy + 10, '#ffffff')
                rect(im, cx - 7, hy + 13, cx - 6, hy + 13, '#f2a3a3')  # 腮紅
                rect(im, cx + 5, hy + 13, cx + 6, hy + 13, '#f2a3a3')
                px(im, cx - 1, hy + 14, '#b5735a')
            else:
                d = 1 if face == 'right' else -1
                back = cx - 9 if d > 0 else cx + 3
                rect(im, back, hy + 2, back + 5, hy + 13, HAIR)       # 後腦的頭髮
                ex = cx + 4 * d - (1 if d < 0 else 0)
                rect(im, ex, hy + 10, ex + 1, hy + 12, '#2e2340')
                px(im, ex + (1 if d > 0 else 0), hy + 10, '#ffffff')
                rect(im, ex - 2 * d, hy + 13, ex - 2 * d + 1, hy + 13, '#f2a3a3')
                for x in range(cx - 6, cx + 6, 3):
                    rect(im, x, hy + 7, x + 1, hy + 8, HAIR)
            outline(im)
            shadow_under(im, 17, 43, 8, 2.5, 110)
            sheet.paste(im, (f * FW, row * FH))
    return sheet


# ───────────────────────────── 小物件 ─────────────────────────────

def lantern(lit=False):
    """石燈籠（1×2 格，32×64）：底座、柱、托台、火袋、四面坡屋頂；每一層都看得到頂面和正面"""
    im = new(32, 64)
    L_, M_, D_, DD = '#cfcfdc', '#aeaec0', '#8d8da3', '#6e6e84'
    box(im, 8, 52, 23, 59, 3, L_, D_, DD)                     # 底座
    rect(im, 13, 38, 18, 51, M_)                              # 柱
    rect(im, 13, 38, 14, 51, L_)
    rect(im, 17, 38, 18, 51, D_)
    box(im, 9, 34, 22, 37, 2, L_, D_, DD)                     # 托台
    rect(im, 10, 22, 21, 33, M_)                              # 火袋
    rect(im, 10, 22, 11, 33, L_)
    rect(im, 19, 22, 21, 33, D_)
    rect(im, 12, 24, 18, 31, '#ffe9a0' if lit else '#3a3a4c')
    if lit:
        rect(im, 13, 25, 17, 29, '#fffbe6')
    rect(im, 15, 24, 15, 31, M_ if not lit else '#e0a93a')
    for i, y in enumerate(range(13, 21)):                     # 屋頂：上窄下寬，左上亮右暗
        x0, x1 = 13 - i * 2, 18 + i * 2
        rect(im, max(2, x0), y, min(29, x1), y, M_)
        rect(im, max(2, x0), y, (x0 + x1) // 2, y, L_)
        rect(im, min(29, x1) - 1, y, min(29, x1), y, D_)
    rect(im, 2, 21, 29, 21, DD)
    rect(im, 15, 9, 16, 12, L_)                               # 寶珠
    rect(im, 14, 10, 17, 11, M_)
    outline(im)
    shadow_under(im, 18, 59, 10, 3)
    return im


def board():
    """告示牌（2×1.5 格，64×48）：兩根木樁、木板（上緣看得到厚度）、貼著三張紙"""
    im = new(64, 48)
    W_, WL, WD, WDD = '#b07a48', '#d29a62', '#8a5a30', '#6a4224'
    for x0 in (12, 47):                                       # 木樁
        rect(im, x0, 30, x0 + 4, 44, WD)
        rect(im, x0, 30, x0 + 1, 44, W_)
        rect(im, x0 + 4, 30, x0 + 4, 44, WDD)
    rect(im, 4, 6, 59, 9, WL)                                 # 板子頂面（厚度）
    rect(im, 4, 10, 59, 33, W_)
    rect(im, 4, 32, 59, 33, WD)
    rect(im, 57, 10, 59, 33, WDD)
    for y in (17, 25):
        rect(im, 5, y, 56, y, WD)                             # 木板接縫
    papers = ((9, 12, 19, 27, '#fbf6e6', '#d8d0bc', '#b9b3a0'), (24, 13, 35, 23, '#f6e27a', '#d6bd52', '#c9a93f'),
              (39, 14, 51, 30, '#f7b6cf', '#d98fb0', '#d776a3'))
    for x0, y0, x1, y1, c, cd, ln in papers:
        rect(im, x0 + 1, y0 + 1, x1 + 1, y1 + 1, (60, 30, 10, 255))   # 紙的影子
        rect(im, x0, y0, x1, y1, c)
        rect(im, x1, y0, x1, y1, cd)
        for y in range(y0 + 3, y1 - 1, 3):
            rect(im, x0 + 2, y, x1 - 3, y, ln)
        px(im, (x0 + x1) // 2, y0 + 1, '#d1495b')             # 圖釘
    outline(im, LINE_W)
    shadow_under(im, 34, 44, 26, 3.5)
    return im


def bush():
    """草叢（1.5×1.25 格，48×40）：幾團圓圓的葉子，上亮下暗，結著紅色小果子"""
    r = random.Random(5)
    im = new(48, 40)
    D_, M_, L_, H_ = '#2f6b3a', '#3f8a46', '#5fae54', '#8fd06e'
    for cx, cy, rr in ((15, 24, 11), (33, 24, 11), (24, 17, 12), (24, 27, 11)):
        for y in range(int(cy - rr), int(cy + rr) + 1):
            for x in range(int(cx - rr), int(cx + rr) + 1):
                d = math.hypot(x - cx, y - cy)
                if d > rr - (0.5 if r.random() < 0.5 else 0):
                    continue
                t = ((x - cx) * 0.6 + (y - cy)) / rr
                c = H_ if t < -0.8 else L_ if t < -0.25 else M_ if t < 0.5 else D_
                if 0 <= x < 48 and 0 <= y < 40:
                    px(im, x, y, c)
    for x, y in ((14, 20), (30, 18), (22, 28), (35, 27), (19, 13)):
        rect(im, x, y, x + 1, y + 1, '#d84a4a')
        px(im, x, y, '#ffb0a0')
    outline(im, '#1d3a24')
    shadow_under(im, 26, 35, 20, 4)
    return im


def dig(used=False):
    """挖掘點（1×1 格）：隆起的土堆（頂面亮、側邊暗、深色外框）；還沒挖的會閃金光"""
    im = new(32, 32)
    ellipse(im, 16, 21, 12, 6, '#7a5236')
    ellipse(im, 16, 19, 12, 5.5, '#a8743f' if not used else '#8a6342')
    ellipse(im, 14, 18, 7, 3, '#c9925a' if not used else '#9c7552')
    if used:
        ellipse(im, 16, 19, 5, 2.5, '#5a3a22')
    else:
        for x, y in ((10, 19), (20, 17), (17, 21)):
            px(im, x, y, '#5a3a22')
    outline(im, '#3a2618')
    if not used:
        for x, y, s in ((24, 7, 3), (8, 10, 2), (19, 3, 2)):   # 閃光
            rect(im, x - s, y, x + s, y, '#ffe27a')
            rect(im, x, y - s, x, y + s, '#ffe27a')
            px(im, x, y, '#ffffff')
    shadow_under(im, 17, 24, 13, 3)
    return im


def fishspot():
    """釣點的告示牌（1×1.5 格，32×48）：木樁上一塊畫著魚的小牌子"""
    im = new(32, 48)
    rect(im, 14, 22, 18, 44, '#8a5a30')
    rect(im, 14, 22, 15, 44, '#b07a48')
    rect(im, 4, 8, 27, 10, '#d29a62')
    rect(im, 4, 11, 27, 24, '#b07a48')
    rect(im, 25, 11, 27, 24, '#8a5a30')
    rect(im, 4, 24, 27, 24, '#6a4224')
    for x in range(8, 21):                                    # 魚
        w = round(3.2 * math.sin((x - 8) / 12 * math.pi)) if x > 8 else 0
        rect(im, x, 17 - w, x, 17 + w, '#7fc8e8')
    rect(im, 5, 14, 8, 20, '#7fc8e8')
    px(im, 18, 16, '#1b2030')
    rect(im, 9, 18, 17, 18, '#5aa8d0')
    outline(im, LINE_W)
    shadow_under(im, 18, 44, 8, 2.5)
    return im


def offering():
    """供奉石（1×1.5 格，32×48）：神殿旁的白色石座，頂上浮著紫寶石"""
    im = new(32, 48)
    TOPc, FR, FRD = '#f3ede3', '#cdbfac', '#a6987f'
    box(im, 5, 22, 26, 29, 4, TOPc, FR, FRD)                 # 頂板
    rect(im, 10, 24, 21, 25, '#6c5ce7')                       # 紫色凹槽
    rect(im, 8, 30, 23, 42, FR)                               # 石座
    rect(im, 8, 30, 9, 42, '#ddd3c4')
    rect(im, 21, 30, 23, 42, FRD)
    for y in (34, 38):
        rect(im, 11, y, 19, y, '#9d8f7c')
    rect(im, 8, 42, 23, 42, '#7f725f')
    box(im, 6, 42, 25, 45, 1, TOPc, FR, FRD)
    outline(im, '#4f4438')
    for i, w in enumerate((1, 2, 3, 4, 3, 2, 1)):            # 浮著的寶石
        rect(im, 16 - w, 8 + i, 15 + w, 8 + i, '#9d8cff')
        px(im, 16 - w, 8 + i, '#d6ccff')
        px(im, 15 + w, 8 + i, '#6c5ce7')
    px(im, 15, 10, '#ffffff')
    for x, y in ((9, 9), (23, 7), (11, 4), (22, 15)):
        px(im, x, y, '#d6ccff')
    shadow_under(im, 18, 45, 12, 2.5)
    return im


def pond_rock(found=False):
    """池塘邊的石頭（1.5×1 格，48×32）；找到魚魚之後旁邊會冒出一條橘色小魚和漣漪"""
    im = new(48, 32)
    ellipse(im, 22, 21, 15, 7, '#7c7c8e')
    ellipse(im, 22, 18, 15, 7, '#a2a2b4')
    ellipse(im, 19, 15, 9, 4, '#c4c4d2')
    px(im, 15, 13, '#e2e2ec')
    for x, y in ((10, 21), (13, 23), (30, 22), (34, 19)):     # 青苔
        rect(im, x, y, x + 1, y, '#5d994b')
    outline(im)
    if found:
        ellipse(im, 41, 12, 4, 2.2, '#ff9a5c')
        px(im, 43, 11, '#1b2030')
        rect(im, 36, 11, 37, 13, '#ff9a5c')
        for x, y in ((38, 6), (42, 4), (45, 8)):
            px(im, x, y, '#ffffff')
    shadow_under(im, 24, 26, 16, 3)
    return im


def bugs():
    """蟲（1×1 格，四格動畫）：發光的螢火蟲，一閃一閃"""
    frames = []
    for f, (rad, bob) in enumerate(((2, 0), (3, -1), (4, 0), (3, 1))):
        im = new(32, 32)
        cx, cy = 16, 14 + bob
        for y in range(cy - rad - 2, cy + rad + 3):
            for x in range(cx - rad - 2, cx + rad + 3):
                d = math.hypot(x - cx, y - cy)
                if d <= rad + 2:
                    px(im, x, y, (255, 240, 140, int(160 * (1 - d / (rad + 2)))))
        rect(im, cx - 1, cy - 1, cx + 1, cy + 1, '#fff6c0')
        rect(im, cx - 2, cy - 3, cx - 1, cy - 2, '#e6f0ff')
        rect(im, cx + 1, cy - 3, cx + 2, cy - 2, '#e6f0ff')
        ellipse(im, 16, 27, 3, 1, SHADOW + (70,))
        frames.append(im)
    return strip(frames)


def tank():
    """魚缸（2×1 格，64×32）：木頭底座上的玻璃缸，看得到缸口（頂面）和正面的水"""
    r = random.Random(3)
    im = new(64, 32)
    box(im, 2, 22, 61, 29, 2, '#d29a62', '#8a5a30', '#6a4224')      # 木座
    rect(im, 4, 4, 59, 7, '#cfeefa')                                # 缸口（水面，頂面）
    rect(im, 4, 4, 59, 4, '#ffffff')
    rect(im, 4, 8, 59, 21, '#5fb4dc')                               # 正面的水
    rect(im, 4, 8, 59, 9, '#8fd3ef')
    rect(im, 57, 8, 59, 21, '#3f8fbd')
    rect(im, 4, 18, 59, 21, '#c9a86a')                              # 沙
    for x in (10, 14, 46, 50):                                      # 水草
        for y in range(11, 19):
            px(im, x + (y % 2), y, '#4f9a4c')
    for x, y, c in ((20, 13, '#ff9a5c'), (36, 11, '#f7b6cf'), (28, 16, '#ffe27a')):
        rect(im, x, y, x + 3, y + 1, c)
        px(im, x - 1, y, c)
    for _ in range(6):
        px(im, r.randrange(8, 56), r.randrange(9, 16), '#d8f2ff')
    rect(im, 5, 9, 5, 16, '#e8f8ff')                                # 玻璃反光
    outline(im)
    shadow_under(im, 34, 29, 30, 3)
    return im


def plot(stage):
    """菜圃（2×2 格，64×64）：木板圍起來的高架菜圃，斜俯視看得到木框的頂面和正面；
    裡面是三條隆起的土壟。發芽時是一排排小苗，成熟時是長滿葉子的紅蘿蔔與蕪菁"""
    r = random.Random({'empty': 1, 'growing': 2, 'ripe': 3}[stage])
    im = new(64, 64)
    WL, W_, WD, WDD = '#d9a56c', '#b07a48', '#8a5a30', '#6a4224'
    # 木框：頂面（亮）＋正面（暗）＋四角的木樁
    rect(im, 2, 6, 61, 57, WD)
    rect(im, 2, 6, 61, 9, WL)
    rect(im, 2, 6, 5, 57, WL)
    rect(im, 58, 6, 61, 57, W_)
    rect(im, 2, 52, 61, 54, WL)
    rect(im, 2, 55, 61, 60, W_)
    rect(im, 2, 60, 61, 60, WDD)
    for x in range(10, 60, 12):
        rect(im, x, 55, x, 59, WD)                               # 木板接縫
    for x0, y0 in ((1, 4), (58, 4), (1, 52), (58, 52)):
        rect(im, x0, y0, x0 + 4, y0 + 8, WD)
        rect(im, x0, y0, x0 + 4, y0 + 1, WL)
    # 土
    rect(im, 6, 10, 57, 51, '#6e4527')
    for i, y in enumerate((14, 27, 40)):                          # 三條土壟：頂面亮、下緣暗
        rect(im, 8, y, 55, y + 8, '#8a5a34')
        rect(im, 8, y, 55, y + 1, '#a8743f')
        rect(im, 8, y + 7, 55, y + 8, '#5f3d22')
        for _ in range(14):
            px(im, r.randrange(9, 55), r.randrange(y + 2, y + 7), '#7a4e2c')
    if stage == 'growing':
        for y in (17, 30, 43):
            for x in range(13, 54, 9):
                rect(im, x, y - 1, x, y + 2, '#4f9a4c')
                rect(im, x - 2, y - 2, x - 1, y - 1, '#8fd06e')
                rect(im, x + 1, y - 3, x + 2, y - 2, '#6fbf5c')
    if stage == 'ripe':
        for j, y in enumerate((18, 31, 44)):
            for i, x in enumerate(range(13, 54, 9)):
                carrot = (i + j) % 2 == 0
                rect(im, x - 1, y - 8, x + 1, y - 2, '#3f8a46')        # 葉子
                rect(im, x - 3, y - 7, x - 2, y - 4, '#5fae54')
                rect(im, x + 2, y - 6, x + 3, y - 3, '#5fae54')
                px(im, x, y - 9, '#8fd06e')
                if carrot:
                    rect(im, x - 2, y - 1, x + 2, y + 2, '#f08a3a')    # 露出土的紅蘿蔔頭
                    px(im, x - 1, y - 1, '#ffc08a')
                else:
                    rect(im, x - 2, y - 1, x + 2, y + 2, '#f2eadf')    # 蕪菁
                    rect(im, x - 2, y - 1, x + 2, y - 1, '#c86aa0')
    outline(im, '#3a2618')
    return im


# ───────────────────────────── 地面圖塊 ─────────────────────────────

def tile_forest(v):
    """外圍的樹牆（1 格）：一團一團圓圓的樹冠互相疊著，左上亮、右下暗，深色外框；三款變化"""
    r = random.Random(70 + v)
    im = new(32, 32, '#1f4a2a')
    D_, M_, L_, H_ = '#24572f', '#2f6e3a', '#3f8a46', '#5fae54'
    blobs = [(r.uniform(-2, 34), r.uniform(-2, 34), r.uniform(8, 12)) for _ in range(5)]
    blobs.sort(key=lambda b: b[1])
    for cx, cy, rr in blobs:
        for y in range(int(cy - rr) - 1, int(cy + rr) + 2):
            for x in range(int(cx - rr) - 1, int(cx + rr) + 2):
                d = math.hypot(x - cx, y - cy)
                X, Y = x % 32, y % 32                              # 左右上下接得起來
                if d <= rr:
                    t = ((x - cx) * 0.7 + (y - cy)) / rr
                    c = H_ if t < -0.85 else L_ if t < -0.3 else M_ if t < 0.45 else D_
                    if r.random() < 0.06:
                        c = mix(c, '#000000', 0.15)
                    px(im, X, Y, c)
                elif d <= rr + 1:
                    px(im, X, Y, '#163a20')
    return im


def water_frames():
    """水（1 格，八格動畫）：藍綠色的水面上一個個淺色的小波紋（像參考圖那種一彎一彎的水光），
    整片慢慢往下流；每格往下 4px，八格剛好一圈 32px，上下接得起來"""
    r = random.Random(12)
    ripples = [(r.randrange(32), r.randrange(32), r.choice((4, 5, 6, 7))) for _ in range(7)]
    glints = [(r.randrange(32), r.randrange(32)) for _ in range(5)]
    frames = []
    for f in range(8):
        im = new(32, 32, '#3f86c0')
        for x, y, w in ripples:
            yy = (y + f * 4) % 32
            for i in range(w):                                     # 一彎：中間高、兩端低
                dy = 0 if 0 < i < w - 1 else 1
                px(im, (x + i) % 32, (yy + dy) % 32, '#7cc0e8')
            for i in range(1, w - 1):
                px(im, (x + i) % 32, (yy + 2) % 32, '#3577ad')   # 波紋下的暗邊
        for x, y in glints:
            yy = (y + f * 4) % 32
            if (f + x) % 3:
                px(im, x, yy, '#d8f2ff')
        frames.append(im)
    return strip(frames)


def tile_bridge():
    """木橋（1 格，往東西方向過溪）：上下兩條欄杆（看得到頂面）、中間直鋪的木板、橋下水面的影子"""
    im = new(32, 32)
    for x in range(32):                                       # 橋板
        c = '#b07a48' if (x // 6) % 2 else '#c08a55'
        rect(im, x, 6, x, 25, c)
        if x % 6 == 0:
            rect(im, x, 6, x, 25, '#8a5a30')
    for x in range(0, 32, 3):
        px(im, x + 1, 9 + (x % 7), '#a06c3e')                 # 木紋
    rect(im, 0, 1, 31, 3, '#d29a62')                          # 上欄杆：頂面＋正面
    rect(im, 0, 1, 31, 1, '#ecc08a')
    rect(im, 0, 4, 31, 5, '#8a5a30')
    rect(im, 0, 24, 31, 26, '#d29a62')                        # 下欄杆
    rect(im, 0, 24, 31, 24, '#ecc08a')
    rect(im, 0, 27, 31, 28, '#8a5a30')
    for x0 in (2, 26):                                        # 欄杆柱
        rect(im, x0, 0, x0 + 3, 5, '#8a5a30')
        rect(im, x0, 0, x0 + 3, 0, '#d29a62')
        rect(im, x0, 22, x0 + 3, 29, '#8a5a30')
        rect(im, x0, 22, x0 + 3, 22, '#d29a62')
    rect(im, 0, 29, 31, 31, (20, 40, 70, 140))                # 橋下的影子落在水上
    rect(im, 0, 0, 31, 0, '#3a2618')
    rect(im, 0, 28, 31, 28, '#3a2618')
    return im


def tile_reed(v):
    """蘆葦叢（1 格）：草地上長著一叢高高的蘆葦，有幾支褐色的穗；深色描邊，腳下有影子"""
    r = random.Random(90 + v)
    base = new(32, 32)
    im = new(32, 32)
    for i in range(9):
        x = 2 + i * 3 + r.randrange(0, 2)
        top = r.randrange(2, 10)
        lean = r.choice((-1, 0, 1))
        for y in range(top, 30):
            xx = x + (lean if y < top + 6 else 0)
            px(im, xx, y, '#4f9a4c' if y > top + 4 else '#6fbf5c')
            if (i + v) % 2 == 0:
                px(im, xx + 1, y, '#3a7a3a')
        if i % 3 == v % 3:
            rect(im, x + lean, top - 1, x + 1 + lean, top + 4, '#8a5a30')
            px(im, x + lean, top - 1, '#b07a48')
    outline(im, '#1d3a24')
    ellipse(base, 17, 29, 15, 3, SHADOW + (110,))
    base.alpha_composite(im)
    return base


def bridge():
    """木橋（6×3.5 格，192×112）：兩端是石頭橋墩，中間 2 格寬的橋面（直鋪木板），
    上下兩道有柱子的欄杆（看得到欄杆頂面），兩端柱頭上掛著小燈，橋下的水面有影子"""
    im = new(192, 112)
    WL, W_, WD, WDD = '#d9a56c', '#b07a48', '#8a5a30', '#6a4224'
    # 橋下的影子（落在水上）
    rect(im, 32, 84, 159, 95, (10, 30, 60, 110))
    # 兩端石墩：斜俯視的石塊（頂面＋正面）
    for x0 in (2, 158):
        rect(im, x0, 22, x0 + 31, 85, '#c9c1b5')
        rect(im, x0, 22, x0 + 31, 25, '#e6dfd3')
        rect(im, x0, 80, x0 + 31, 92, '#9d9488')
        rect(im, x0, 92, x0 + 31, 93, '#7a7267')
        for y in range(84, 92, 4):
            rect(im, x0 + 1, y, x0 + 30, y, '#857c72')
        for x in range(x0 + 7, x0 + 31, 10):
            rect(im, x, 81, x, 91, '#857c72')
    # 橋面：直鋪的木板（左右走），每塊木板左亮右暗
    for x in range(20, 172):
        k = (x - 20) % 8
        c = W_ if k < 6 else WD
        if k == 0:
            c = WL
        if k == 7:
            c = WDD
        rect(im, x, 26, x, 81, c)
    for x in range(20, 172, 8):                                     # 釘子
        px(im, x + 3, 30, WDD)
        px(im, x + 3, 77, WDD)
    rect(im, 20, 82, 171, 85, WD)                                   # 橋面正面（厚度）
    rect(im, 20, 86, 171, 86, WDD)
    # 欄杆：上、下各一道，柱子 + 扶手（扶手頂面亮）
    for y0 in (8, 70):
        for x in range(14, 179, 24):
            rect(im, x, y0, x + 5, y0 + 18, WD)
            rect(im, x, y0, x + 1, y0 + 18, W_)
            rect(im, x, y0, x + 5, y0 + 1, WL)
        rect(im, 14, y0 + 3, 178, y0 + 5, WL)
        rect(im, 14, y0 + 6, 178, y0 + 8, W_)
        rect(im, 14, y0 + 9, 178, y0 + 9, WDD)
        rect(im, 14, y0 + 13, 178, y0 + 14, WD)
    # 兩端柱頭上的小燈籠
    for x in (13, 173):
        rect(im, x, 0, x + 7, 7, '#f6c453')
        rect(im, x + 1, 1, x + 6, 6, '#fff0a8')
        rect(im, x - 1, -1 + 1, x + 8, 0, '#b0453a')
    outline(im, LINE_W)
    return im


def read_paths():
    """讀 js/data/maps/town.js 的 PATHS（PATHS-BEGIN 到 PATHS-END）"""
    import re
    src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'data', 'maps', 'town.js'), encoding='utf8').read()
    body = src.split('// PATHS-BEGIN')[1].split('// PATHS-END')[0]
    out = []
    for kind, pts in re.findall(r"\['(dirt|stone)', \[(.*?)\]\],", body):
        out.append((kind, [(float(a), float(b)) for a, b in re.findall(r'\[([\d.]+), ([\d.]+)\]', pts)]))
    W = int(re.search(r'const W = (\d+)', src).group(1))
    H = int(re.search(r'const W = \d+, H = (\d+)', src).group(1))
    return out, W, H


def _rnd(*k):
    h = 2166136261
    for ch in repr(k):
        h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return random.Random(h).random()


def _noise(key, t, step=10):
    i, f = int(t // step), (t % step) / step
    return _rnd(key, i) * (1 - f) + _rnd(key, i + 1) * f


def decor_paths():
    """小路佈景圖（整張地圖大小）。
    泥土路：沿著折線一團一團的泥土，寬窄不一、時有時無；邊緣上方是草蓋過來的一條深綠線（斜俯視），土裡有小石子。
    石頭小徑：沿著折線一路連續鋪著大小不一的扁石，每塊石頭有頂面、厚度、外框和影子，石縫露出草"""
    paths, MW, MH = read_paths()
    W, H = MW * T, MH * T
    im = new(W, H)
    dirt = [[False] * W for _ in range(H)]
    # ── 泥土路 ──
    for pi, (kind, pts) in enumerate(paths):
        if kind != 'dirt':
            continue
        dist = 0.0
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            L = math.hypot(x1 - x0, y1 - y0) * T
            for s_ in range(int(L)):
                t = s_ / max(1, L)
                cx, cy = (x0 + (x1 - x0) * t) * T, (y0 + (y1 - y0) * t) * T
                d = dist + s_
                if _noise(('gap', pi), d, 46) < 0.36:                  # 斷掉的地方：沒有泥土
                    continue
                w = 9 + 12 * _noise(('w', pi), d, 18)                  # 寬窄
                off = (_noise(('o', pi), d, 30) - 0.5) * 10            # 左右飄
                nx, ny = -(y1 - y0), (x1 - x0)
                nl = math.hypot(nx, ny) or 1
                cx += nx / nl * off
                cy += ny / nl * off
                for yy in range(int(cy - w), int(cy + w) + 1):
                    for xx in range(int(cx - w), int(cx + w) + 1):
                        if 0 <= xx < W and 0 <= yy < H and (xx - cx) ** 2 + ((yy - cy) * 1.25) ** 2 <= w * w:
                            dirt[yy][xx] = True
            dist += L
    # 農田底下一整片翻過的土地（所有菜圃的範圍，還沒擴建的地方也看得到是田），邊緣不規則
    fx0, fy0, fx1, fy1 = 1.6 * T, 18.5 * T, 14.4 * T, 25.4 * T
    for y in range(int(fy0) - 6, int(fy1) + 7):
        for x in range(int(fx0) - 6, int(fx1) + 7):
            e = min(x - fx0, fx1 - x, y - fy0, fy1 - y)
            if 0 <= x < W and 0 <= y < H and e > -4 + 6 * _noise(('farm', x // 6 if abs(y - fy0) < 8 or abs(y - fy1) < 8 else y // 6), x + y, 9):
                dirt[y][x] = True
    for y in range(H):
        for x in range(W):
            if not dirt[y][x]:
                continue
            up = y > 0 and not dirt[y - 1][x]
            up2 = y > 1 and not dirt[y - 2][x]
            down = y < H - 1 and not dirt[y + 1][x]
            n = _rnd('soil', x, y)
            c = '#b98b5a' if n < 0.7 else '#a87b4c' if n < 0.93 else '#8f6640'
            if up:
                c = '#3c6e34'                                          # 草邊的深綠線（草比路高一點）
            elif up2:
                c = '#7a5634'                                          # 草底下的陰影
            elif down:
                c = '#d1a571'                                          # 下緣受光
            elif fx0 <= x <= fx1 and fy0 <= y <= fy1 and y % 10 in (0, 1):
                c = '#a07246' if y % 10 == 0 else '#c99a66'           # 田裡一條一條的犁溝
            px(im, x, y, c)
    r = random.Random(5)
    for _ in range(900):                                               # 小石子
        x, y = r.randrange(W), r.randrange(H)
        if dirt[y][x] and y + 1 < H and dirt[y + 1][x] and dirt[y - 1][x]:
            px(im, x, y, '#e6dccb')
            px(im, x, y + 1, '#8f7a5c')
    # ── 石頭小徑：沿著折線放一塊一塊扁石 ──
    stones = []
    for pi, (kind, pts) in enumerate(paths):
        if kind != 'stone':
            continue
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            L = math.hypot(x1 - x0, y1 - y0) * T
            s_ = 0.0
            k = 0
            while s_ < L:
                t = s_ / L
                cx, cy = (x0 + (x1 - x0) * t) * T, (y0 + (y1 - y0) * t) * T
                # 一步一塊大扁石，左右交錯；偶爾旁邊多一塊小的，路面寬窄就不會太規則
                key = (pi, x0, y0, k)
                nx, ny = -(y1 - y0), (x1 - x0)
                nl = math.hypot(nx, ny) or 1
                off = (4 if k % 2 else -4) + (_rnd(key, 'o') - 0.5) * 6
                w = 16 + int(_rnd(key, 'w') * 9)
                d = 10 + int(_rnd(key, 'd') * 5)
                stones.append((cx + nx / nl * off, cy + ny / nl * off, w, d, key))
                if _rnd(key, 'extra') < 0.35:
                    side = -1 if k % 2 else 1
                    stones.append((cx + nx / nl * side * 14, cy + ny / nl * side * 14 + 2, 8 + int(_rnd(key, 'ew') * 4), 6, key + ('e',)))
                s_ += 15 + _rnd(pi, x0, k) * 5
                k += 1
    stones.sort(key=lambda q: q[1])
    TONES = ['#d9d2c6', '#cfc7ba', '#e2dbcf', '#c6bdaf']
    for cx, cy, w, d, key in stones:                                   # 影子
        for yy in range(int(cy - d / 2) + 2, int(cy + d / 2) + 6):
            for xx in range(int(cx - w / 2) + 2, int(cx + w / 2) + 3):
                if 0 <= xx < W and 0 <= yy < H and ((xx - cx - 2) / (w / 2 + 0.5)) ** 2 + ((yy - cy - 3) / (d / 2 + 1)) ** 2 <= 1 and not im.getpixel((xx, yy))[3]:
                    px(im, xx, yy, (22, 50, 26, 120))
    for cx, cy, w, d, key in stones:
        tone = TONES[int(_rnd(key, 't') * len(TONES))]
        hh = 3                                                         # 石頭的厚度
        for yy in range(int(cy - d / 2) - 1, int(cy + d / 2) + hh + 2):
            for xx in range(int(cx - w / 2) - 1, int(cx + w / 2) + 2):
                if not (0 <= xx < W and 0 <= yy < H):
                    continue
                ex = (xx - cx) / (w / 2)
                top_in = ex * ex + ((yy - cy) / (d / 2)) ** 2 <= 1
                side_in = ex * ex + ((yy - cy - hh) / (d / 2)) ** 2 <= 1
                out_top = ex * ex + ((yy - cy) / (d / 2 + 1)) ** 2 <= 1.0 + 0.25 or ex * ex + ((yy - cy - hh) / (d / 2 + 1)) ** 2 <= 1.25
                if top_in:
                    c = C(tone)
                    if (yy - cy) < -d / 2 + 2:
                        c = mix(tone, '#ffffff', 0.4)
                    elif xx > cx + w / 2 - 3:
                        c = mix(tone, '#8f877a', 0.3)
                    elif _rnd('sp', xx, yy) < 0.06:
                        c = mix(tone, '#8f877a', 0.25)
                    px(im, xx, yy, c)
                elif side_in:
                    px(im, xx, yy, mix(tone, '#6e665a', 0.45))
                elif out_top and im.getpixel((xx, yy))[3] < 200:
                    px(im, xx, yy, '#4a4238')
    return im


# ───────────────────────────── 建築 ─────────────────────────────

def market():
    """商店攤位（4×3 格，128×96）：條紋遮雨棚（看得到棚頂）、木頭櫃台擺著蔬果與魚、旁邊木箱"""
    im = new(128, 96)
    W_, WL, WD = '#b07a48', '#d29a62', '#8a5a30'
    # 後面的木牆
    rect(im, 12, 26, 115, 58, '#c9a070')
    for x in range(12, 116, 8):
        rect(im, x, 26, x, 58, '#a8804f')
    # 支柱
    for x0 in (10, 113):
        rect(im, x0, 22, x0 + 4, 84, WD)
        rect(im, x0, 22, x0 + 1, 84, W_)
    # 遮雨棚：上面是斜的棚頂（看得到），下緣一排波浪
    for y in range(4, 26):
        t = (y - 4) / 21
        x0, x1 = round(8 - t * 4), round(119 + t * 4)
        for x in range(x0, x1 + 1):
            stripe = ((x - 4) // 12) % 2
            c = '#e05a4f' if stripe else '#fbf3e4'
            if y < 7:
                c = mix(c, '#ffffff', 0.3)
            elif y > 21:
                c = mix(c, '#000000', 0.15)
            px(im, x, y, c)
    for x in range(4, 124):
        k = (x - 4) % 12
        h = 3 if k in (4, 5, 6, 7) else 2 if k in (2, 3, 8, 9) else 1
        stripe = ((x - 4) // 12) % 2
        rect(im, x, 26, x, 26 + h, '#c2453b' if stripe else '#e3d6bf')
    # 招牌
    rect(im, 44, 30, 83, 40, '#fbf3e4')
    rect(im, 44, 40, 83, 40, '#c9b48f')
    for x in range(48, 80, 4):
        rect(im, x, 34, x + 2, 36, '#8a4a12')
    # 櫃台：頂面＋正面
    box(im, 6, 58, 121, 86, 8, '#e0b07a', W_, WD)
    for x in range(10, 118, 14):
        rect(im, x, 67, x, 85, WD)
    goods = [(14, '#e05a4f'), (24, '#f0a24a'), (34, '#8fd06e'), (48, '#ffe27a'), (60, '#e05a4f'), (74, '#7fc8e8'), (88, '#f7b6cf'), (102, '#8fd06e')]
    for x, c in goods:                                        # 櫃台上的貨
        ellipse(im, x + 4, 61, 5, 2.5, mix(c, '#000000', 0.25))
        ellipse(im, x + 4, 60, 5, 2.5, c)
        px(im, x + 2, 59, '#ffffff')
    box(im, 100, 72, 121, 90, 4, '#d29a62', W_, WD)           # 木箱
    rect(im, 100, 80, 121, 80, WD)
    outline(im, LINE_W)
    shadow_under(im, 66, 90, 60, 5)
    return im


def casino():
    """小賭場（4×3 格，128×96）：紫色屋頂（看得到屋頂斜面）、霓虹招牌、骰子裝飾、雙開門"""
    im = new(128, 96)
    # 牆
    rect(im, 10, 36, 117, 88, '#4b2a7a')
    rect(im, 10, 36, 13, 88, '#5f3a96')
    rect(im, 113, 36, 117, 88, '#36205a')
    for y in range(42, 88, 8):
        rect(im, 14, y, 112, y, '#3f2468')
    # 屋頂：從屋脊往下的斜面（左上亮、下緣深）
    for y in range(6, 36):
        t = (y - 6) / 29
        x0, x1 = round(30 - t * 26), round(97 + t * 26)
        for x in range(x0, x1 + 1):
            c = '#7d5bc0' if (y // 4) % 2 else '#6c4bb0'
            if x < (x0 + x1) // 2 - 20:
                c = mix(c, '#ffffff', 0.12)
            if y > 32:
                c = '#2e1a4a'
            px(im, x, y, c)
    rect(im, 30, 5, 97, 6, '#a98be0')
    # 霓虹招牌
    rect(im, 34, 40, 93, 52, '#1b1030')
    for x in range(36, 92, 2):
        px(im, x, 40, '#ff5fa8' if x % 4 else '#ffe27a')
        px(im, x, 52, '#ff5fa8' if x % 4 else '#ffe27a')
    for x in range(40, 88, 7):
        rect(im, x, 44, x + 4, 48, '#ffe27a')
    # 門
    rect(im, 50, 60, 77, 88, '#2e1a4a')
    rect(im, 52, 62, 63, 88, '#8a4a12')
    rect(im, 64, 62, 75, 88, '#7a3e0e')
    px(im, 61, 75, '#ffe27a')
    px(im, 66, 75, '#ffe27a')
    # 骰子窗
    for x0 in (20, 92):
        box(im, x0, 60, x0 + 15, 75, 3, '#ffffff', '#e8e2f0', '#c9c1d6')
        for dx, dy in ((4, 7), (11, 7), (4, 12), (11, 12), (7, 9)):
            rect(im, x0 + dx, 60 + dy, x0 + dx + 1, 60 + dy + 1, '#d1495b')
    box(im, 8, 86, 119, 91, 2, '#9c8aa8', '#6e5e7c', '#55476a')   # 台階
    outline(im, '#1b1030')
    shadow_under(im, 66, 92, 60, 5)
    return im


def on(under, over):
    """把半透明的圖塊疊在底下的圖塊上（橋下是水、蘆葦下是草）"""
    im = under.copy().convert('RGBA')
    im.alpha_composite(over)
    return im


def main():
    out = [
        save(player(), 'sprites', 'player.png'),
        save(lantern(False), 'sprites', 'lantern.png'), save(lantern(True), 'sprites', 'lantern-lit.png'),
        save(board(), 'sprites', 'board.png'), save(bush(), 'sprites', 'bush.png'),
        save(dig(False), 'sprites', 'dig.png'), save(dig(True), 'sprites', 'dig-used.png'),
        save(fishspot(), 'sprites', 'fishspot.png'), save(offering(), 'sprites', 'offering.png'),
        save(pond_rock(False), 'sprites', 'pond.png'), save(pond_rock(True), 'sprites', 'pond-found.png'),
        save(bugs(), 'sprites', 'bug.png'), save(tank(), 'sprites', 'tank.png'),
        save(market(), 'sprites', 'market.png'), save(casino(), 'sprites', 'casino.png'),
        save(bridge(), 'sprites', 'bridge.png'), save(decor_paths(), 'decor', 'paths.png'),
        save(strip([tile_forest(1), tile_forest(2), tile_forest(3)]), 'tiles', 'forest.png'),
        save(water_frames(), 'tiles', 'water.png'),
        save(on(water_frames().crop((0, 0, 32, 32)), tile_bridge()), 'tiles', 'bridge.png'),
        save(strip([on(tile_grass(3), tile_reed(1)), on(tile_grass(5), tile_reed(2))]), 'tiles', 'reed.png'),
    ] + [save(plot(s), 'sprites', f'plot-{s}.png') for s in ('empty', 'growing', 'ripe')]
    print(f'小鎮素材：輸出 {len(out)} 張圖')


if __name__ == '__main__':
    main()
