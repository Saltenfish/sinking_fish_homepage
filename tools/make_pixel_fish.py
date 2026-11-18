#!/usr/bin/env python3
"""產生釣魚畫面與魚缸裡的魚（側面、頭朝右），每條 36×18 像素，網站上用整數倍放大，不會糊。

用法：  python3 tools/make_pixel_fish.py        （需要 Pillow）
輸出：  assets/fish/<物品id>.png ，對應素材鍵 fish.<物品id>（js/data/assets.js）

每條魚由同一套形狀組成：身體（前圓後尖）、分岔的尾鰭、背鰭、腹鰭、胸鰭、鰓蓋、眼睛、外框，
再依種類換顏色與花紋。全部用固定亂數種子，重跑結果一樣。
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_pixel_assets import new, px, rgb, save  # noqa: E402

FW, FH = 36, 18
CY = 9


def shade(c, k):
    r, g, b = (rgb(c) if isinstance(c, str) else c)[:3]
    f = (lambda v: max(0, min(255, int(v * k)))) if k < 1 else (lambda v: max(0, min(255, int(v + (255 - v) * (k - 1)))))
    return (f(r), f(g), f(b), 255)


def body_half(x, front, back, B):
    """身體在 x 這一欄的半高（前段圓、後段漸細）"""
    cx = front - 11
    if x >= cx:
        t = (x - cx) / (front - cx)
        return B * math.sqrt(max(0.0, 1 - t ** 2.2))
    t = (cx - x) / (cx - back)
    return max(1.4, B * (1 - t ** 1.6) + 1.2 * t)


def fish(spec):
    r = random.Random(spec['seed'])
    im = new(FW, FH)
    front, back, B = spec.get('front', 33), spec.get('back', 11), spec['B']
    back_c, mid_c, belly_c, fin_c = spec['back_c'], spec['mid_c'], spec['belly_c'], spec['fin_c']
    owner = {}

    def put(x, y, c, kind):
        if 0 <= x < FW and 0 <= y < FH:
            px(im, x, y, c)
            owner[(x, y)] = kind

    # 尾鰭：從身體末端往後張開，末端分岔
    tail_len = back - 1
    for x in range(2, back + 2):
        t = (back + 1 - x) / tail_len                      # 0 靠身體、1 在最後面
        spread = 1.5 + t * spec.get('tail', 6.5)
        for y in range(int(CY - spread), int(CY + spread) + 1):
            if t > 0.55 and abs(y + 0.5 - CY) < (t - 0.55) * 9:
                continue                                   # 分岔的缺口
            k = 0.82 + 0.25 * ((y + x) % 3 == 0)           # 鰭條紋
            put(x, y, shade(fin_c, k), 'fin')
    # 背鰭、腹鰭（先畫，身體會蓋住根部）
    d0, d1, dh = spec.get('dorsal', (16, 25, 4))
    for x in range(d0, d1 + 1):
        t = (x - d0) / max(1, d1 - d0)
        top = CY - body_half(x, front, back, B) - dh * (1 - abs(t - 0.35) * 1.3) + 0.5
        for y in range(int(top), CY):
            put(x, y, shade(fin_c, 0.9 if x % 2 else 1.0), 'fin')
    for x0, x1, hh in spec.get('belly_fins', [(15, 19, 3), (22, 25, 2)]):
        for x in range(x0, x1 + 1):
            t = (x - x0) / max(1, x1 - x0)
            bot = CY + body_half(x, front, back, B) + hh * (1 - t) + 0.5
            for y in range(CY, int(bot) + 1):
                put(x, y, shade(fin_c, 0.88), 'fin')
    # 身體：上面深、中間、肚子淺，加一條亮邊
    for x in range(back, front + 1):
        hh = body_half(x, front, back, B)
        top, bot = CY - hh, CY + hh
        for y in range(int(math.floor(top + 0.5)), int(math.ceil(bot - 0.5)) + 1):
            v = (y + 0.5 - top) / max(1, bot - top)       # 0 頂、1 底
            c = back_c if v < 0.34 else mid_c if v < 0.7 else belly_c
            if 0.2 < v < 0.3 and x % 3 == 0:
                c = shade(mid_c, 1.15)
            put(x, y, rgb(c) if isinstance(c, str) else c, 'body')
    # 鱗片：中段稀疏的小點
    for (x, y), k in list(owner.items()):
        if k == 'body' and back + 2 < x < front - 8 and (x * 3 + y * 5) % 7 == 0:
            px(im, x, y, shade(im.getpixel((x, y)), 0.86))
    # 種類自己的花紋
    spec.get('pattern', lambda *a: None)(im, owner, r)
    # 鰓蓋
    gx = front - 9
    for y in range(CY - 3, CY + 4):
        if owner.get((gx + abs(y - CY) // 3, y)) == 'body':
            px(im, gx + abs(y - CY) // 3, y, shade(im.getpixel((gx + abs(y - CY) // 3, y)), 0.72))
    # 胸鰭
    for i, (dx, dy) in enumerate(((0, 0), (-1, 1), (-2, 1), (-1, 2), (-3, 2), (-2, 3))):
        x, y = front - 11 + dx, CY + 1 + dy
        if (x, y) in owner:
            px(im, x, y, shade(fin_c, 0.75 if i < 2 else 0.9))
    # 眼睛
    ex, ey = front - 5, CY - 2
    for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
        px(im, ex + dx, ey + dy, '#1a1222')
    px(im, ex + 1, ey, '#ffffff')
    for x, y in ((ex - 1, ey), (ex - 1, ey + 1), (ex + 2, ey), (ex + 2, ey + 1), (ex, ey - 1), (ex + 1, ey - 1), (ex, ey + 2), (ex + 1, ey + 2)):
        if owner.get((x, y)) == 'body':
            px(im, x, y, shade(spec.get('eye_ring', '#f4f1e8'), 1.0))
    spec.get('face', lambda *a: None)(im, ex, ey)
    # 嘴
    px(im, front, CY + 1, shade(back_c, 0.6))
    px(im, front - 1, CY + 1, shade(back_c, 0.7))
    # 外框：魚的外圍描一圈深色（取所在顏色的深色版，比純黑柔和）
    src = im.copy()
    for y in range(FH):
        for x in range(FW):
            if src.getpixel((x, y))[3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                X, Y = x + dx, y + dy
                if 0 <= X < FW and 0 <= Y < FH and src.getpixel((X, Y))[3] > 128:
                    px(im, x, y, shade(src.getpixel((X, Y)), 0.38))
                    break
    return im


def koi_pattern(im, owner, r):
    """花鯉：白底上幾塊大小不一的紅橘色斑"""
    blobs = [(28, 6, 3.2), (21, 8, 3.6), (15, 6, 2.6), (25, 11, 2.0)]
    for x, y in [p for p, k in owner.items() if k == 'body']:
        for bx, by, rad in blobs:
            d = math.hypot(x - bx, (y - by) * 1.3) + r.random() * 0.8
            if d < rad:
                px(im, x, y, '#e2502c' if d < rad - 1.1 else '#f07a3c')
                break
    for x, y in [p for p, k in owner.items() if k == 'fin']:     # 鰭上的一點橘
        if r.random() < 0.05:
            px(im, x, y, '#f7a77a')


def koi_face(im, ex, ey):
    for x, y in ((ex + 4, ey + 4), (ex + 5, ey + 5), (ex + 6, ey + 5)):   # 嘴邊的鬚
        px(im, x, y, '#d9a06a')


def small_pattern(im, owner, r):
    """小溪魚：一條深色側線，背上點點"""
    for x in range(12, 29):
        if owner.get((x, CY)) == 'body':
            px(im, x, CY, '#4e6f8c' if x % 2 else '#5b7f9e')
    for x, y in [p for p, k in owner.items() if k == 'body']:
        if y < CY - 1 and r.random() < 0.08:
            px(im, x, y, '#2f4f6e')


def odd_pattern(im, owner, r):
    """顏色不太對的魚：綠背紫肚、黃色圓點，尾巴附近還有一塊漸層"""
    for x, y in [p for p, k in owner.items() if k == 'body']:
        if (x * 7 + y * 11) % 13 == 0 and 12 < x < 27:
            px(im, x, y, '#f2d25a')
    for x, y in [p for p, k in owner.items() if k == 'fin']:
        if (x + y) % 4 == 0:
            px(im, x, y, '#e86fb0')


def odd_face(im, ex, ey):
    """半閉的眼睛＋往下壓的眉毛：「你認真？」"""
    px(im, ex, ey, '#3f9a5a')
    px(im, ex + 1, ey, '#3f9a5a')
    for x, y in ((ex - 1, ey - 2), (ex, ey - 2), (ex + 1, ey - 1), (ex + 2, ey - 1)):
        px(im, x, y, '#1a1222')


FISH = {
    'fish_small': {'seed': 1, 'B': 4.2, 'front': 33, 'back': 9, 'tail': 4.8, 'dorsal': (17, 23, 3),
                   'back_c': '#4a7fa8', 'mid_c': '#9cc4dc', 'belly_c': '#e6f2f7', 'fin_c': '#a9c9de', 'pattern': small_pattern},
    'fish_koi': {'seed': 2, 'B': 5.4, 'front': 33, 'back': 9, 'tail': 6.0, 'dorsal': (14, 26, 4),
                 'belly_fins': [(14, 19, 4), (22, 26, 3)],
                 'back_c': '#f4efe6', 'mid_c': '#fbf8f2', 'belly_c': '#ffffff', 'fin_c': '#f6e7da',
                 'eye_ring': '#ffffff', 'pattern': koi_pattern, 'face': koi_face},
    'fish_odd': {'seed': 3, 'B': 6.0, 'front': 33, 'back': 10, 'tail': 5.0, 'dorsal': (17, 25, 3),
                 'belly_fins': [(16, 20, 3)],
                 'back_c': '#3f9a5a', 'mid_c': '#6cc38a', 'belly_c': '#b88ae0', 'fin_c': '#c79be8',
                 'eye_ring': '#d9f5e2', 'pattern': odd_pattern, 'face': odd_face},
}


def main():
    out = [save(fish(spec), 'fish', f'{fid}.png') for fid, spec in FISH.items()]
    print(f'輸出 {len(out)} 張魚')


if __name__ == '__main__':
    main()
