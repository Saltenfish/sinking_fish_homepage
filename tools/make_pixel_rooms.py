#!/usr/bin/env python3
"""產生「可以走進去的房間」的像素圖：賭場大廳與四種遊戲的近景、成就小屋、物品圖示、紙牌花色。

用法：  python3 tools/make_pixel_rooms.py        （需要 Pillow）

房間都是 480×270（16:9），網站上整張放大顯示。房間裡可以點的東西（拉霸機、牌桌…）是另外的透明 PNG，
疊在背景上，滑鼠移過去會發光。它們的位置寫在 js/data/rooms.js —— 改了這裡的尺寸，記得也改那邊。
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_pixel_assets import rgb, new, px, rect, ellipse, save  # noqa: E402
from make_pixel_scenes import bands, sparkles, blend, lerp, planks  # noqa: E402

W, H = 480, 270
K = '#1a1222'          # 外框
GOLD, GOLD_L, GOLD_D = '#f6c453', '#fff0a8', '#b8862b'
RED, RED_D, RED_L = '#c0392b', '#7a1e18', '#e5484d'
FELT, FELT_D, FELT_L = '#1f6b45', '#164f33', '#2a8a5a'
WOOD, WOOD_D, WOOD_L = '#8a5a30', '#5c3b22', '#a8743f'


def outline(im, c=K):
    """在不透明像素的外圍描一圈 1px 外框"""
    w, h = im.size
    src = im.copy()
    for y in range(h):
        for x in range(w):
            if src.getpixel((x, y))[3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                X, Y = x + dx, y + dy
                if 0 <= X < w and 0 <= Y < h and src.getpixel((X, Y))[3] > 128:
                    px(im, x, y, c)
                    break
    return im


# ───────────────────────── 小字（轉盤上的數字） ─────────────────────────
GLYPH = {
    '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
    '5': ['111', '100', '111', '001', '111'], 'x': ['000', '101', '010', '101', '000'],
    'h': ['100', '101', '010', '101', '011'],   # ½
}


def text(im, s, x, y, c, scale=1):
    for ch in s:
        g = GLYPH[ch]
        for j, row in enumerate(g):
            for i, v in enumerate(row):
                if v == '1':
                    rect(im, x + i * scale, y + j * scale, x + i * scale + scale - 1, y + j * scale + scale - 1, c)
        x += 4 * scale


# ───────────────────────── 賭場大廳 ─────────────────────────

def casino_hall():
    r = random.Random(1)
    im = new(W, H)
    bands(im, 0, 0, W - 1, 125, '#1a0f2e', '#3a1f5c', 7)
    for x in range(0, W, 30):                              # 牆板
        rect(im, x, 14, x + 1, 120, '#2a1846')
        rect(im, x + 2, 14, x + 2, 120, '#4a2a72')
    rect(im, 0, 0, W - 1, 12, '#2a1846')
    for i, x in enumerate(range(6, W, 14)):                 # 天花板燈泡
        c = '#fff7c2' if i % 2 else '#ff8fa3'
        rect(im, x, 4, x + 3, 7, c)
        px(im, x + 1, 5, '#ffffff')
    rect(im, 0, 118, W - 1, 122, GOLD_D)                    # 牆腳的金線
    rect(im, 0, 118, W - 1, 118, GOLD)
    for x0 in (150, 300):                                   # 壁燈
        rect(im, x0, 40, x0 + 3, 60, GOLD_D)
        ellipse(im, x0 + 1.5, 36, 6, 6, '#fff0a8')
        for k in range(3):
            for x in range(x0 - 14 + k * 3, x0 + 18 - k * 3):
                if (x + k) % 2 == 0:
                    blend(im, x, 46 + k * 4, (255, 230, 150, 50))
    rect(im, 196, 22, 284, 72, GOLD_D)                       # 牆上的大招牌：骰子與紙牌
    rect(im, 199, 25, 281, 69, '#2a0f1e')
    for x0, c in ((208, '#ffffff'), (232, '#ffffff')):
        rect(im, x0, 34, x0 + 16, 50, c)
        rect(im, x0, 50, x0 + 16, 50, '#c9c7d6')
    for x, y in ((211, 37), (219, 45), (215, 41)):
        rect(im, x, y, x + 2, y + 2, K)
    for x, y in ((235, 37), (243, 37), (235, 45), (243, 45)):
        rect(im, x, y, x + 2, y + 2, RED_L)
    rect(im, 256, 30, 272, 52, '#ffffff')
    rect(im, 258, 32, 270, 50, '#f4f1e8')
    for dx, dy in ((0, 0), (-1, 1), (1, 1), (-2, 2), (2, 2), (0, 3), (-1, 3), (1, 3)):
        px(im, 264 + dx, 38 + dy, RED)
    sparkles(im, 30, ['#fff7c2', '#ff8fa3'], 5, (200, 26, 280, 68))
    # 地毯：深紅底、金色菱形花紋、越往下越大（一點點透視感）
    bands(im, 0, 123, W - 1, H - 1, '#7a1f2a', '#4a0f18', 6)
    for y in range(126, H, 10):
        step = 16 + (y - 126) // 8
        off = (y // 10 % 2) * step // 2
        for x in range(-step + off, W, step):
            px(im, x, y, '#b0434e')
            px(im, x + 1, y + 1, '#b0434e')
            px(im, x - 1, y + 1, '#b0434e')
            px(im, x, y + 2, '#b0434e')
    for _ in range(200):
        px(im, r.randrange(W), r.randrange(125, H), '#5a141f')
    return im


def slots_sprite():
    """三台拉霸機一排（150×110）"""
    im = new(150, 110)
    for i, x0 in enumerate((2, 51, 100)):
        rect(im, x0, 18, x0 + 45, 106, RED)
        rect(im, x0, 18, x0 + 4, 106, RED_L)
        rect(im, x0 + 41, 18, x0 + 45, 106, RED_D)
        rect(im, x0 + 3, 4, x0 + 42, 18, GOLD)                # 頂上的招牌燈
        rect(im, x0 + 3, 4, x0 + 42, 6, GOLD_L)
        for k in range(5):
            px(im, x0 + 8 + k * 7, 11, '#ffffff' if (k + i) % 2 else RED_L)
        rect(im, x0 + 6, 28, x0 + 39, 52, K)                  # 轉輪窗
        for k in range(3):
            rect(im, x0 + 8 + k * 11, 30, x0 + 16 + k * 11, 50, '#f4f1e8')
        sym = [('#e5484d', '#ffffff'), (GOLD, GOLD_D), ('#63a34d', '#3f7a35')][i]
        for k in range(3):
            ellipse(im, x0 + 12 + k * 11, 40, 2.5, 3, sym[0])
        rect(im, x0 + 6, 40, x0 + 39, 40, '#e5484d')
        rect(im, x0 + 8, 60, x0 + 37, 66, RED_D)              # 按鈕列
        for k in range(3):
            rect(im, x0 + 11 + k * 9, 61, x0 + 15 + k * 9, 64, (GOLD, '#63a34d', '#5aa9d6')[k])
        rect(im, x0 + 10, 80, x0 + 35, 92, K)                 # 出幣口
        rect(im, x0 + 12, 88, x0 + 33, 91, GOLD_D)
        rect(im, x0 + 46, 30, x0 + 47, 58, '#b3b1c0')         # 拉桿
        ellipse(im, x0 + 47, 28, 3, 3, RED_L)
        rect(im, x0 + 2, 104, x0 + 45, 107, '#3a1f2e')
    return outline(im)


def bj_table_sprite():
    """21 點牌桌（170×100）：看不清臉的荷官站在半月形的綠色牌桌後面"""
    im = new(170, 100)
    cx = 85
    rect(im, cx - 26, 22, cx + 26, 60, '#22223a')             # 荷官身體（深色背心）
    rect(im, cx - 6, 22, cx + 6, 40, '#f4f1e8')                # 襯衫
    for k in range(4):                                         # 領結
        rect(im, cx - 5 + k, 26 - k // 2, cx - 5 + k, 28 + k // 2, RED)
        rect(im, cx + 5 - k, 26 - k // 2, cx + 5 - k, 28 + k // 2, RED)
    ellipse(im, cx, 10, 10, 11, '#3a3050')                      # 頭：只有陰影，看不清楚臉
    ellipse(im, cx, 12, 8, 8, '#2a2238')
    rect(im, cx - 14, 0, cx + 14, 3, '#15121f')                 # 帽子
    rect(im, cx - 8, -6, cx + 8, 1, '#15121f')
    rect(im, cx - 36, 34, cx - 26, 52, '#22223a')               # 手臂
    rect(im, cx + 26, 34, cx + 36, 52, '#22223a')
    # 半月形牌桌
    for y in range(44, 98):
        t = (y - 44) / 53
        half = 82 * math.sqrt(max(0, 1 - (1 - t) ** 2 * 0.15)) * (0.75 + 0.25 * t)
        rect(im, round(cx - half), y, round(cx + half), y, FELT if y < 92 else WOOD)
    for y in range(44, 92):                                    # 木頭桌緣
        t = (y - 44) / 53
        half = 82 * math.sqrt(max(0, 1 - (1 - t) ** 2 * 0.15)) * (0.75 + 0.25 * t)
        rect(im, round(cx - half), y, round(cx - half) + 2, y, WOOD)
        rect(im, round(cx + half) - 2, y, round(cx + half), y, WOOD_D)
    rect(im, cx - 62, 44, cx + 62, 46, WOOD_L)
    rect(im, 8, 92, 162, 97, WOOD_D)
    for k, x0 in enumerate((cx - 40, cx - 12, cx + 16)):       # 桌上的牌
        rect(im, x0, 60 + k % 2 * 4, x0 + 12, 76 + k % 2 * 4, '#ffffff')
        rect(im, x0 + 3, 64 + k % 2 * 4, x0 + 5, 66 + k % 2 * 4, RED if k != 1 else K)
    for k in range(5):                                         # 籌碼
        ellipse(im, cx + 50, 70 - k * 2, 6, 2.5, (RED_L, GOLD, '#5aa9d6', RED_L, GOLD)[k])
    ellipse(im, cx - 54, 74, 9, 4, FELT_L)
    return outline(im)


def dice_table_sprite():
    """骰子桌（130×80）：綠色桌面、木框、桌上一個骰盅和兩顆骰子"""
    im = new(130, 80)
    rect(im, 2, 18, 127, 70, WOOD)
    rect(im, 2, 18, 127, 21, WOOD_L)
    rect(im, 8, 22, 121, 64, FELT)
    rect(im, 8, 22, 121, 23, FELT_D)
    for x0, c in ((14, '#5aa9d6'), (50, GOLD), (86, RED_L)):  # 三個下注區
        rect(im, x0, 44, x0 + 28, 60, c)
        rect(im, x0 + 2, 46, x0 + 26, 58, FELT_L)
    for x0 in (8, 117):                                        # 桌腳
        rect(im, x0, 70, x0 + 4, 78, WOOD_D)
    for y in range(0, 26):                                     # 骰盅（倒扣的碗）
        half = 9 + y * 0.45
        rect(im, round(56 - half), 4 + y, round(56 + half), 4 + y, '#a8743f' if y < 22 else WOOD_D)
        px(im, round(56 - half), 4 + y, WOOD_L)
    rect(im, 52, 0, 60, 4, GOLD)
    for x0, y0 in ((80, 26), (92, 30)):                         # 骰子
        rect(im, x0, y0, x0 + 8, y0 + 8, '#ffffff')
        rect(im, x0, y0 + 8, x0 + 8, y0 + 8, '#c9c7d6')
        px(im, x0 + 4, y0 + 4, RED)
    return outline(im)


WHEEL_COLORS = ['#e5484d', '#f4ead6', '#5aa9d6', '#f4ead6', '#63a34d', '#f4ead6',
                '#a487dc', '#f4ead6', '#f6c453', '#f4ead6', '#ee93b8', '#f4ead6']


def wheel_sprite():
    """大廳裡的轉盤（96×120）：架子上立著一個彩色轉盤"""
    im = new(96, 120)
    rect(im, 40, 70, 55, 112, WOOD)
    rect(im, 40, 70, 42, 112, WOOD_L)
    rect(im, 26, 110, 69, 117, WOOD_D)
    cx, cy, rr = 48, 44, 40
    for y in range(cy - rr, cy + rr + 1):
        for x in range(cx - rr, cx + rr + 1):
            d = math.hypot(x - cx, y - cy)
            if d > rr:
                continue
            if d > rr - 3:
                px(im, x, y, GOLD if (x + y) % 2 else GOLD_D)
                continue
            a = (math.degrees(math.atan2(y - cy, x - cx)) + 90) % 360
            px(im, x, y, WHEEL_COLORS[int(a // 30) % 12])
    ellipse(im, cx, cy, 6, 6, GOLD)
    ellipse(im, cx, cy, 3, 3, GOLD_L)
    for k in range(6):                                         # 頂上的指針
        rect(im, cx - (5 - k), k, cx + (5 - k), k, RED)
    return outline(im)


# ───────────────────────── 四種遊戲的近景 ─────────────────────────

def slot_close():
    """拉霸機近景：機台占滿畫面中央，轉輪窗、按鈕列、出幣口；拉桿另外一張圖"""
    im = new(W, H)
    bands(im, 0, 0, W - 1, H - 1, '#1a0f2e', '#3a1f5c', 8)
    sparkles(im, 80, ['#fff7c2', '#ff8fa3', '#d6ccff'], 9)
    x0, x1 = 130, 350
    rect(im, x0, 8, x1, H - 1, RED)                           # 機台
    rect(im, x0, 8, x0 + 8, H - 1, RED_L)
    rect(im, x1 - 8, 8, x1, H - 1, RED_D)
    rect(im, x0 + 10, 14, x1 - 10, 62, GOLD)                  # 招牌
    rect(im, x0 + 10, 14, x1 - 10, 18, GOLD_L)
    rect(im, x0 + 16, 22, x1 - 16, 56, '#2a0f1e')
    for i, x in enumerate(range(x0 + 14, x1 - 10, 10)):       # 招牌的燈泡
        c = '#fff7c2' if i % 2 else '#ff8fa3'
        rect(im, x, 15, x + 3, 17, c)
        rect(im, x, 58, x + 3, 60, c)
    for cx, c in ((150 + 10, '#e5484d'), (330 - 10, '#63a34d')):   # 招牌兩側的菱形燈（中間留給網頁寫字）
        for k in range(6):
            rect(im, cx - k, 33 + k, cx + k, 33 + k, c)
            rect(im, cx - k, 44 - k, cx + k, 44 - k, c)
    rect(im, 158, 74, 322, 156, '#4a1018')                     # 轉輪窗的框
    rect(im, 162, 78, 318, 152, K)                             # 轉輪窗（轉輪由網頁畫在這裡）
    rect(im, 150, 112, 157, 118, GOLD)                         # 中獎線的箭頭
    rect(im, 323, 112, 330, 118, GOLD)
    rect(im, 150, 164, 330, 196, RED_D)                        # 按鈕列
    for k, c in enumerate((GOLD, '#63a34d', '#5aa9d6', '#a487dc')):
        rect(im, 166 + k * 40, 172, 190 + k * 40, 186, c)
        rect(im, 166 + k * 40, 172, 190 + k * 40, 174, lerp(c, '#ffffff', 0.4))
        rect(im, 166 + k * 40, 186, 190 + k * 40, 188, lerp(c, '#000000', 0.4))
    rect(im, 160, 208, 320, 252, '#4a1018')                    # 出幣口
    rect(im, 166, 214, 314, 248, '#120a14')
    rect(im, 166, 240, 314, 248, '#2a1a1e')
    rect(im, 160, 250, 320, 256, GOLD_D)
    rect(im, x1, 104, x1 + 14, 140, '#b3b1c0')                 # 拉桿的底座
    rect(im, x1, 104, x1 + 14, 106, '#d6d4e0')
    rect(im, x1 + 12, 104, x1 + 14, 140, '#6f6d7e')
    return im


def lever(down=False):
    """拉桿（30×110）：紅色圓球加金屬桿。down = 被拉下來的樣子"""
    im = new(30, 110)
    if not down:
        rect(im, 12, 18, 17, 100, '#b3b1c0')
        rect(im, 12, 18, 13, 100, '#e0dfe8')
        rect(im, 16, 18, 17, 100, '#6f6d7e')
        ellipse(im, 14.5, 12, 11, 11, RED)
        ellipse(im, 12, 9, 5, 5, RED_L)
        px(im, 10, 6, '#ffffff')
        px(im, 11, 6, '#ffffff')
    else:
        rect(im, 12, 60, 17, 100, '#b3b1c0')
        rect(im, 12, 60, 13, 100, '#e0dfe8')
        rect(im, 16, 60, 17, 100, '#6f6d7e')
        ellipse(im, 14.5, 56, 11, 11, RED)
        ellipse(im, 12, 53, 5, 5, RED_L)
    return outline(im)


def bj_close():
    """21 點近景：坐在牌桌前，對面是看不清臉的荷官，桌面是大片綠色絨布"""
    im = new(W, H)
    bands(im, 0, 0, W - 1, 110, '#120a1e', '#2a1846', 6)
    for x in range(0, W, 30):
        rect(im, x, 0, x + 1, 108, '#1e1236')
    cx = 240
    rect(im, cx - 70, 50, cx + 70, 112, '#22223a')             # 荷官身體
    rect(im, cx - 16, 50, cx + 16, 96, '#f4f1e8')
    for k in range(8):
        rect(im, cx - 12 + k, 58 - k // 2, cx - 12 + k, 62 + k // 2, RED)
        rect(im, cx + 12 - k, 58 - k // 2, cx + 12 - k, 62 + k // 2, RED)
    rect(im, cx - 3, 58, cx + 3, 62, RED_D)
    rect(im, cx - 70, 50, cx - 62, 112, '#2e2e4a')
    ellipse(im, cx, 24, 24, 27, '#2e2640')                      # 頭：整張臉都在陰影裡
    ellipse(im, cx, 30, 19, 19, '#1e1a2c')
    rect(im, cx - 34, 0, cx + 34, 5, '#0e0c16')                  # 帽簷
    rect(im, cx - 20, 0, cx + 20, 2, '#0e0c16')
    for k in range(10):                                         # 帽簷下的陰影
        for x in range(cx - 22, cx + 23):
            if (x + k) % 2 == 0:
                blend(im, x, 6 + k, (0, 0, 0, 120 - k * 10))
    rect(im, cx - 100, 84, cx - 70, 112, '#22223a')             # 手臂
    rect(im, cx + 70, 84, cx + 100, 112, '#22223a')
    ellipse(im, cx - 96, 108, 9, 6, '#3a3050')                  # 戴手套的手
    ellipse(im, cx + 96, 108, 9, 6, '#3a3050')
    # 牌桌：木頭桌緣 + 大片絨布
    rect(im, 0, 104, W - 1, 112, WOOD)
    rect(im, 0, 104, W - 1, 105, WOOD_L)
    rect(im, 0, 112, W - 1, 113, WOOD_D)
    bands(im, 0, 114, W - 1, H - 1, FELT_L, FELT_D, 6)
    r = random.Random(3)
    for _ in range(600):
        x, y = r.randrange(W), r.randrange(114, H)
        px(im, x, y, lerp(FELT, '#000000', 0.15))
    for a in range(0, 180):                                    # 桌上印的弧形字帶
        for rr in (150, 152):
            x = round(cx + math.cos(math.radians(a + 180)) * rr * 1.2)
            y = round(250 + math.sin(math.radians(a + 180)) * rr * 0.55)
            if 114 < y < H:
                px(im, x, y, GOLD_D)
    for k in range(6):                                         # 荷官右手邊的籌碼架
        rect(im, 380 + k * 12, 118, 389 + k * 12, 134, (RED_L, GOLD, '#5aa9d6', '#63a34d', RED_L, GOLD)[k])
        rect(im, 380 + k * 12, 118, 389 + k * 12, 119, '#ffffff')
    rect(im, 376, 134, 456, 138, WOOD_D)
    rect(im, 40, 118, 80, 140, '#8a1f2a')                       # 牌靴
    rect(im, 40, 118, 80, 121, RED_L)
    rect(im, 46, 122, 74, 134, '#ffffff')
    for x0 in (196, 244):                                      # 玩家前面的下注圈
        ellipse(im, x0 + 20, 250, 22, 10, GOLD_D)
        ellipse(im, x0 + 20, 250, 20, 8, FELT)
    return im


def dice_close():
    """骰子近景：從上往下看的骰子桌，三個下注區，中間放骰盅"""
    im = new(W, H)
    rect(im, 0, 0, W - 1, H - 1, WOOD_D)
    planks(im, 0, 0, W - 1, 22, WOOD, WOOD_D, WOOD_L, horizontal=False, size=12, seed=4)
    planks(im, 0, H - 22, W - 1, H - 1, WOOD, WOOD_D, WOOD_L, horizontal=False, size=12, seed=5)
    rect(im, 0, 0, 22, H - 1, WOOD)
    rect(im, W - 23, 0, W - 1, H - 1, WOOD)
    rect(im, 22, 22, W - 23, H - 23, FELT)
    r = random.Random(7)
    for _ in range(900):
        px(im, r.randrange(24, W - 24), r.randrange(24, H - 24), lerp(FELT, '#000000', 0.15))
    rect(im, 22, 22, W - 23, 24, FELT_D)
    for (x0, x1), c in (((40, 170), '#5aa9d6'), ((190, 290), GOLD), ((310, 440), RED_L)):   # 三個下注區（字由網頁寫上去）
        rect(im, x0, 168, x1, 246, c)
        rect(im, x0 + 3, 171, x1 - 3, 243, FELT_L)
        rect(im, x0 + 3, 171, x1 - 3, 172, lerp(FELT_L, '#ffffff', 0.2))
    ellipse(im, 240, 96, 70, 50, FELT_D)                       # 骰盅放的位置（深一點的圓）
    ellipse(im, 240, 96, 66, 46, FELT)
    return im


def dice_cup():
    """骰盅（96×100）：倒扣的木碗，上面有金色把手"""
    im = new(96, 100)
    for y in range(0, 80):
        half = 18 + y * 0.36
        for x in range(round(48 - half), round(48 + half) + 1):
            t = (x - (48 - half)) / (2 * half)
            c = WOOD_L if t < 0.25 else WOOD_D if t > 0.8 else '#a8743f'
            px(im, x, 14 + y, c)
    for y in (40, 70):
        rect(im, round(48 - 18 - y * 0.36), 14 + y, round(48 + 18 + y * 0.36), 15 + y, GOLD_D)
    rect(im, 40, 2, 56, 14, GOLD)
    rect(im, 40, 2, 56, 4, GOLD_L)
    rect(im, 14, 92, 82, 96, WOOD_D)
    return outline(im)


def wheel_close():
    """轉盤近景的背景：牆、燈泡框、架子（轉盤本身另外一張圖，會轉動）"""
    im = new(W, H)
    bands(im, 0, 0, W - 1, H - 1, '#1a0f2e', '#3a1f5c', 8)
    sparkles(im, 60, ['#fff7c2', '#ff8fa3'], 11)
    for a in range(0, 360, 10):                                # 轉盤外圍的一圈燈泡
        x = round(240 + math.cos(math.radians(a)) * 116)
        y = round(122 + math.sin(math.radians(a)) * 116)
        c = '#fff7c2' if (a // 10) % 2 else '#ff8fa3'
        rect(im, x - 2, y - 2, x + 1, y + 1, c)
    rect(im, 226, 230, 254, H - 1, WOOD)                         # 架子
    rect(im, 226, 230, 228, H - 1, WOOD_L)
    rect(im, 180, 258, 300, H - 1, WOOD_D)
    return im


def wheel_disc():
    """會轉的轉盤（220×220）：12 格，格子上寫倍率；第 0 格在正上方，順時針排列"""
    from_mults = [0, 2, 0, 1, 0, 3, 0, 0.5, 0, 5, 0, 0]
    S = 220
    im = new(S, S)
    cx = cy = S / 2 - 0.5
    rr = 106
    for y in range(S):
        for x in range(S):
            d = math.hypot(x - cx, y - cy)
            if d > rr:
                continue
            if d > rr - 6:
                px(im, x, y, GOLD if (round(math.degrees(math.atan2(y - cy, x - cx))) // 6) % 2 else GOLD_D)
                continue
            a = (math.degrees(math.atan2(y - cy, x - cx)) + 90 + 15) % 360
            seg = int(a // 30) % 12
            c = WHEEL_COLORS[seg]
            if abs((a % 30) - 0) < 0.9 or abs((a % 30) - 30) < 0.9:
                c = K
            px(im, x, y, c)
    for i, m in enumerate(from_mults):                        # 倍率字
        ang = math.radians(i * 30 - 90)
        tx, ty = cx + math.cos(ang) * 74, cy + math.sin(ang) * 74
        label = {0: '0', 0.5: 'h', 1: '1', 2: '2', 3: '3', 5: '5'}[m]
        s = 'x' + label if m else label
        wdt = len(s) * 4 * 3 - 3
        col = K if WHEEL_COLORS[i] == '#f4ead6' else '#ffffff'
        text(im, s, round(tx - wdt / 2), round(ty - 7), col, 3)
    ellipse(im, cx, cy, 20, 20, GOLD_D)
    ellipse(im, cx, cy, 16, 16, GOLD)
    ellipse(im, cx - 4, cy - 4, 5, 5, GOLD_L)
    return outline(im)


def wheel_pointer():
    im = new(30, 34)
    for k in range(24):
        rect(im, 15 - (12 - k // 2), k, 14 + (12 - k // 2), k, RED)
    rect(im, 6, 0, 23, 3, RED_L)
    return outline(im)


SUIT_ART = {
    'S': ['....k....', '...kkk...', '..kkkkk..', '.kkkkkkk.', 'kkkkkkkkk', 'kkkkkkkkk', '.kk.k.kk.', '....k....', '...kkk...'],
    'H': ['.rr...rr.', 'rrrr.rrrr', 'rrrrrrrrr', 'rrrrrrrrr', '.rrrrrrr.', '..rrrrr..', '...rrr...', '....r....', '.........'],
    'D': ['....r....', '...rrr...', '..rrrrr..', '.rrrrrrr.', 'rrrrrrrrr', '.rrrrrrr.', '..rrrrr..', '...rrr...', '....r....'],
    'C': ['...kkk...', '...kkk...', '...kkk...', '.kk.k.kk.', 'kkkkkkkkk', 'kkkkkkkkk', '.kk.k.kk.', '....k....', '...kkk...'],
}


def suit(s):
    im = new(9, 9)
    for y, row in enumerate(SUIT_ART[s]):
        for x, ch in enumerate(row):
            if ch == 'k':
                px(im, x, y, K)
            elif ch == 'r':
                px(im, x, y, '#d1303f')
    return im


# ───────────────────────── 成就小屋 ─────────────────────────
# 兩座書架的位置與層板高度（和 js/data/rooms.js 的 HUT 要一致）
# 寬版（電腦、手機橫拿）：兩座書架左右並排；直版（手機直拿）：兩座書架上下疊，整間一頁看完。
# 位置要和 js/data/rooms.js 的 HUT / HUT_TALL 一致。
HUT_WIDE = {'size': (480, 270), 'floor': 212,
            'cases': [((18, 26, 206, 252), [80, 132, 184, 236], '#f6c453'), ((274, 26, 462, 252), [80, 132, 184, 236], '#a8e0c0')],
            'window': (214, 28, 266, 92), 'table': 240, 'table_y': 186}
HUT_TALL = {'size': (270, 480), 'floor': 424,
            'cases': [((14, 30, 256, 216), [76, 122, 168, 210], '#f6c453'), ((14, 246, 256, 424), [290, 334, 378, 418], '#a8e0c0')],
            'window': None, 'table': 135, 'table_y': 438}


def hut_room(L=HUT_WIDE):
    w, h = L['size']
    im = new(w, h)
    fl = L['floor']
    planks(im, 0, 0, w - 1, fl + 2, '#b5865a', '#8a5a30', '#cf9f70', horizontal=False, size=20, seed=11)
    planks(im, 0, fl + 3, w - 1, h - 1, '#8a5a30', '#6e4527', '#a8743f', horizontal=True, size=9, seed=12)
    rect(im, 0, fl, w - 1, fl + 4, '#4f321c')
    if L['window']:
        x0, y0, x1, y1 = L['window']                         # 中間的窗
        rect(im, x0, y0, x1, y1, '#6e4527')
        bands(im, x0 + 4, y0 + 4, x1 - 4, y1 - 4, '#9fd6ff', '#e8f6ff', 5)
        rect(im, (x0 + x1) // 2 - 1, y0 + 4, (x0 + x1) // 2 + 1, y1 - 4, '#6e4527')
        rect(im, x0 + 4, (y0 + y1) // 2 - 1, x1 - 4, (y0 + y1) // 2 + 1, '#6e4527')
        rect(im, x0 - 4, y1, x1 + 4, y1 + 4, '#a8743f')
    cx, ty = L['table'], L['table_y']                       # 小桌與筆記本（紀錄）
    ellipse(im, cx, ty + 10, 22, 6, '#6e4527')
    rect(im, cx - 18, ty + 10, cx + 18, ty + 14, '#8a5a30')
    rect(im, cx - 4, ty + 14, cx + 4, min(h - 2, ty + 44), '#6e4527')
    rect(im, cx - 14, ty, cx + 14, ty + 10, '#f4ead6')
    rect(im, cx - 14, ty, cx + 14, ty + 1, '#d9c49a')
    rect(im, cx - 1, ty, cx + 1, ty + 10, '#c0392b')
    for y in (ty + 3, ty + 6):
        rect(im, cx - 11, y, cx - 4, y, '#b9a888')
        rect(im, cx + 4, y, cx + 11, y, '#b9a888')
    for (x0, y0, x1, y1), tops, label_c in L['cases']:      # 空書架
        rect(im, x0, y0, x1, y1, '#4f321c')
        rect(im, x0 + 6, y0 + 8, x1 - 6, y1 - 4, '#2e1d12')
        for x in range(x0 + 6, x1 - 5, 2):
            px(im, x, y0 + 9, '#3a2618')
        rect(im, x0, y0, x1, y0 + 7, '#7a4e2c')
        rect(im, x0, y0, x1, y0 + 1, '#a8743f')
        rect(im, x0, y0, x0 + 5, y1, '#6e4527')
        rect(im, x1 - 5, y0, x1, y1, '#5c3b22')
        for top in tops:
            rect(im, x0 + 6, top, x1 - 6, top + 4, '#8a5a30')
            rect(im, x0 + 6, top, x1 - 6, top, '#b5865a')
            rect(im, x0 + 6, top + 5, x1 - 6, top + 6, '#1e130c')
        rect(im, x0 - 2, y1, x1 + 2, y1 + 4, '#3a2618')
        lx = (x0 + x1) // 2 - 24                               # 書架頂的小牌子
        rect(im, lx, y0 - 12, lx + 48, y0 - 2, '#f4ead6')
        rect(im, lx, y0 - 12, lx + 48, y0 - 12, label_c)
        rect(im, lx + 2, y0 - 2, lx + 46, y0 - 1, '#b9a888')
    return im


TROPHY_ART = {
    'cup': ['...........', '.yyyyyyyyy.', 'yyYyyyyyyyy', 'yyYyyyyyyyy', '.yYyyyyyyy.', '..yyyyyyy..', '...yyyyy...',
            '....yyy....', '.....y.....', '.....y.....', '...ooooo...', '..nnnnnnn..', '..nnnnnnn..'],
    'medal': ['..r.....b..', '..rr...bb..', '...rr.bb...', '....rbb....', '....ooo....', '...yyyyy...', '..yYyyyyy..',
              '..yYyyyyy..', '..yyyyyyy..', '..yyyyyyo..', '...yyyyo...', '....ooo....', '...........'],
    'star': ['.....y.....', '.....y.....', '....yYy....', 'yyyyyYyyyyy', '.yyyyYyyyy.', '..yyyyyyy..', '...yyyyy...',
             '..yyy.yyy..', '..yy...yy..', '.yy.....yy.', '...........', '.nnnnnnnnn.', '.nnnnnnnnn.'],
    'scroll': ['...........', '.nnnnnnnnn.', 'nccccccccc.', '.cccccccccn', '.ckkkkkkkc.', '.cccccccccn', '.ckkkkkkc..',
               '.ccccccccc.', '.cckkkkkcc.', '.ccccccccc.', 'nccccccccc.', '.nnnnnnnnn.', '....rrr....'],
}
TCOL = {'y': GOLD, 'Y': GOLD_L, 'o': GOLD_D, 'n': WOOD_D, 'r': RED_L, 'b': '#5aa9d6', 'c': '#f4ead6', 'k': '#8a6a42'}


def trophy(kind):
    im = new(11 * 2, 13 * 2)
    for y, row in enumerate(TROPHY_ART[kind]):
        for x, ch in enumerate(row):
            if ch in TCOL:
                rect(im, x * 2, y * 2, x * 2 + 1, y * 2 + 1, TCOL[ch])
    return outline(im)


# ───────────────────────── 物品圖示（16×16） ─────────────────────────

def item_icon(kind, c1, c2=None, c3=None):
    im = new(16, 16)
    if kind == 'fish':
        ellipse(im, 7, 8, 5.5, 3.6, c1)
        for k in range(4):
            rect(im, 12 + k, 8 - k - 1, 12 + k, 8 + k + 1, c1)
        rect(im, 3, 10, 9, 11, c2 or lerp(c1, '#000000', 0.25))
        px(im, 4, 7, '#ffffff')
        px(im, 4, 7, K)
        if c3:
            rect(im, 6, 6, 8, 7, c3)
    elif kind == 'leaf':
        for k in range(10):
            half = int(3.6 * math.sin(math.pi * (k + 0.5) / 10))
            rect(im, 8 - half + (k - 5) // 3, 3 + k, 8 + half + (k - 5) // 3, 3 + k, c1)
        for k in range(11):
            px(im, 8 + (k - 5) // 3, 3 + k, c2)
        px(im, 6, 14, '#6e4527')
    elif kind == 'coin':
        ellipse(im, 7.5, 7.5, 6, 6, c1)
        ellipse(im, 7.5, 7.5, 4.5, 4.5, c2)
        rect(im, 6, 6, 9, 9, K)
    elif kind == 'shell':
        for y in range(4, 13):
            half = (y - 3) * 0.7
            rect(im, round(8 - half), y, round(8 + half), y, c1)
        for x in (5, 8, 11):
            for y in range(5, 13):
                px(im, round(8 + (x - 8) * (y - 3) / 9), y, c2)
        rect(im, 6, 13, 10, 14, c2)
    elif kind == 'turnip':
        ellipse(im, 8, 10, 4.5, 4, c1)
        px(im, 6, 8, '#ffffff')
        rect(im, 7, 13, 9, 14, c2)
        for dx, hgt in ((-2, 5), (0, 6), (2, 5)):
            rect(im, 8 + dx, 6 - hgt + 1, 8 + dx, 6, '#63a34d')
    elif kind == 'starfruit':
        for dx, dy in ((0, -5), (-1, -4), (0, -4), (1, -4), (-5, -1), (-4, -1), (4, -1), (5, -1)):
            px(im, 8 + dx, 8 + dy, c1)
        ellipse(im, 8, 9, 4, 3.5, c1)
        for dx, dy in ((-4, 4), (-3, 3), (4, 4), (3, 3)):
            px(im, 8 + dx, 8 + dy, c1)
        px(im, 6, 8, '#ffffff')
    elif kind == 'seedbag':
        rect(im, 4, 4, 12, 14, '#d9c49a')
        rect(im, 4, 4, 12, 5, '#b9a888')
        rect(im, 5, 2, 11, 4, '#c9b48f')
        ellipse(im, 8, 9.5, 2.5, 2.5, c1)
        px(im, 7, 8, '#ffffff')
    elif kind == 'bug':
        ellipse(im, 8, 9, 3.5, 4.5, c1)
        rect(im, 8, 5, 8, 13, K)
        ellipse(im, 8, 4, 2, 1.6, K)
        for y in (7, 9, 11):
            px(im, 3, y, K)
            px(im, 12, y, K)
        ellipse(im, 8, 12, 2.2, 1.6, c2)
    elif kind == 'sack':
        rect(im, 3, 5, 12, 14, c1)
        rect(im, 3, 5, 4, 14, lerp(c1, '#ffffff', 0.3))
        rect(im, 5, 3, 10, 5, c1)
        rect(im, 5, 5, 10, 5, c2)
        rect(im, 6, 9, 9, 11, c2)
    elif kind == 'potion':
        rect(im, 6, 2, 9, 5, '#c9c7d6')
        rect(im, 6, 1, 9, 2, '#8a5a30')
        ellipse(im, 7.5, 10, 5, 4.5, '#e8f6ff')
        ellipse(im, 7.5, 11, 4, 3, c1)
        px(im, 5, 8, '#ffffff')
    elif kind == 'worm':
        for k in range(10):
            y = 8 + round(math.sin(k / 1.6) * 2.5)
            rect(im, 3 + k, y, 3 + k, y + 1, c1)
        px(im, 12, 8 + round(math.sin(9 / 1.6) * 2.5), K)
    return outline(im)


ITEMS = {
    'feed': ('sack', '#c9a46a', '#8a5a30'), 'fertilizer': ('sack', '#5f9e4c', '#3f7a35'),
    'growth_tonic': ('potion', '#ee93b8'), 'bait': ('worm', '#e8a0b0'),
    'seed_turnip': ('seedbag', '#f4e9e0'), 'seed_star': ('seedbag', '#f6c453'),
    'crop_turnip': ('turnip', '#f4e9e0', '#e8a0b0'), 'crop_star': ('starfruit', '#f6c453'),
    'fish_small': ('fish', '#8fb3c9', '#5a7d92'), 'fish_koi': ('fish', '#ffffff', '#f08a3c', '#f08a3c'),
    'fish_odd': ('fish', '#a487dc', '#5fc0aa', '#5fc0aa'),
    'bug_firefly': ('bug', '#5c4a2a', '#f4ff9a'), 'bug_glow': ('bug', '#2f3f8a', '#8fd0ff'),
    'leaf_pink': ('leaf', '#ee93b8', '#c9648f'), 'leaf_purple': ('leaf', '#a487dc', '#7a5fb8'),
    'leaf_teal': ('leaf', '#5fc0aa', '#379482'), 'leaf_gold': ('leaf', '#ecc85c', '#c79c34'),
    'coin_old': ('coin', '#b8862b', '#d9a24a'), 'shell': ('shell', '#fbe0d0', '#e0a890'),
}


def main():
    out = []
    for name, im in (('casino-hall', casino_hall()), ('slot-close', slot_close()), ('bj-close', bj_close()),
                     ('dice-close', dice_close()), ('wheel-close', wheel_close()), ('hut-room', hut_room()),
                     ('hut-room-tall', hut_room(HUT_TALL))):
        out.append(save(im, 'rooms', f'{name}.png'))
    for name, im in (('slots', slots_sprite()), ('bj-table', bj_table_sprite()), ('dice-table', dice_table_sprite()),
                     ('wheel', wheel_sprite()), ('lever-up', lever(False)), ('lever-down', lever(True)),
                     ('dice-cup', dice_cup()), ('wheel-disc', wheel_disc()), ('wheel-pointer', wheel_pointer())):
        out.append(save(im, 'rooms', f'{name}.png'))
    for s in 'SHDC':
        out.append(save(suit(s), 'ui', f'suit-{s}.png'))
    for kind in TROPHY_ART:
        out.append(save(trophy(kind), 'rooms', f'trophy-{kind}.png'))
    for item_id, spec in ITEMS.items():
        out.append(save(item_icon(*spec), 'items', f'{item_id}.png'))
    print(f'輸出 {len(out)} 張圖')


if __name__ == '__main__':
    main()
