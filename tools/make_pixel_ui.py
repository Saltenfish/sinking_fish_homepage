#!/usr/bin/env python3
"""產生介面用的像素小圖示（16×16），輸出到 assets/ui/。

用法：  python3 tools/make_pixel_ui.py        （需要 Pillow）

每個圖示用一張「字元畫」定義：每個字元代表一個顏色，'.' 是透明。
想改某個圖示，直接改下面的字元畫再執行一次即可。css/base.css 以 ../assets/ui/<名稱>.png 引用這些檔案。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_pixel_assets import rgb, new, px, save  # noqa: E402

# 共用調色盤
P = {
    'k': '#2a1d1a',  # 外框（深褐黑）
    'w': '#ffffff', 'c': '#f4ead6',
    'y': '#f6c453', 'Y': '#fff0a8', 'o': '#c9962f', 'O': '#8a5a12',
    'r': '#e5484d', 'R': '#a3303f', 'p': '#f29bc0',
    'g': '#63a34d', 'G': '#3f7a35', 'l': '#9fdc7a',
    'b': '#5aa9d6', 'B': '#2f6f9e', 'L': '#bfe3f5',
    'n': '#a8743f', 'N': '#6e4527', 'm': '#c08c52',
    's': '#b3b1c0', 'S': '#6f6d7e', 'v': '#8c7cf5', 'V': '#4a3fae', 'u': '#1d2550',
}

ICONS = {
    'bag': [
        '................',
        '.....kkkkkk.....',
        '....k.kk.kk.....',
        '....k.k..k.k....',
        '...kkkkkkkkkk...',
        '..knmmmmmmmmnk..',
        '..knmmmmmmmmnk..',
        '..knnnnnnnnnnk..',
        '..knnkkyykknnk..',
        '..knnkyYyyknnk..',
        '..knnnkkkknnnk..',
        '..knnnnnnnnnnk..',
        '..kNnnnnnnnnNk..',
        '..kNNNNNNNNNNk..',
        '...kkkkkkkkkk...',
        '................',
    ],
    'map': [
        '................',
        '................',
        '.kkkkkkkkkkkkkk.',
        '.kcccckcccckccck',
        '.kccckcccckcccck',
        '.kcrcckcgcckccck',
        '.kcrrckcggckcbck',
        '.kccrkccgckcbbck',
        '.kcccrcccgkcbcck',
        '.kccckrcccrrcck.',
        '.kccckcrrrckccck',
        '.kcccckcccckccck',
        '.kccckcccckcccck',
        '.kkkkkkkkkkkkkk.',
        '................',
        '................',
    ],
    'list': [
        '................',
        '..kkkkkkkkkkkk..',
        '..kcccccccccck..',
        '..kcrrcckkkkck..',
        '..kcrrcccccccк..'.replace('к', 'k'),
        '..kcccccccccck..',
        '..kcggcckkkkck..',
        '..kcggcccccccк..'.replace('к', 'k'),
        '..kcccccccccck..',
        '..kcbbcckkkkck..',
        '..kcbbcccccccк..'.replace('к', 'k'),
        '..kcccccccccck..',
        '..kcyycckkkck...',
        '..kccccccccck...',
        '..kkkkkkkkkk....',
        '................',
    ],
    'gear': [
        '................',
        '......kkkk......',
        '......ksSk......',
        '..kk.kssssk.kk..',
        '..ksksssssSkSk..',
        '...kssskkssSk...',
        '.kksssk..kssSkk.',
        '.ksssk....kssSk.',
        '.ksssk....kssSk.',
        '.kkssSk..kSSSkk.',
        '...kssSkkSSSk...',
        '..kskSSSSSSkSk..',
        '..kk.kSSSSk.kk..',
        '......kSSk......',
        '......kkkk......',
        '................',
    ],
    'coin': [
        '................',
        '.....kkkkkk.....',
        '...kkYYYyyykk...',
        '..kYYyyyyyyyok..',
        '..kYyyykkyyyok..',
        '.kYyyykyykyyyok.',
        '.kYyyyykyyyyyok.',
        '.kyyyyyykyyyyok.',
        '.kyyyyyyykyyyok.',
        '.kyyyykyykyyook.',
        '.kyyyyykkyyyook.',
        '..kyyyyyyyyook..',
        '..koyyyyyyoook..',
        '...kkooooookk...',
        '.....kkkkkk.....',
        '................',
    ],
    'day': [
        '.......y........',
        '..y....y....y...',
        '...y...y...y....',
        '....y.....y.....',
        '......kkkk......',
        '.....kYYyyk.....',
        'yy..kYyyyyok..yy',
        '....kYyyyyok....',
        '....kyyyyyok....',
        '....kyyyyook....',
        '.....kyoook.....',
        '......kkkk......',
        '....y.....y.....',
        '...y...y...y....',
        '..y....y....y...',
        '.......y........',
    ],
    'night': [
        '................',
        '......kkkk......',
        '....kkYYYk..w...',
        '...kYYYkk.......',
        '..kYYyk.........',
        '..kYyk......w...',
        '.kYyyk..........',
        '.kYyyk..........',
        '.kyyyk.....w....',
        '.kyyyyk.........',
        '..kyyyyk......k.',
        '..kyyyyykkkkkk..',
        '...koyyyyyyook..',
        '....kkoooookk...',
        '......kkkkk.....',
        '................',
    ],
    'dawn': [
        '................',
        '................',
        '................',
        '.......p........',
        '...p...p...p....',
        '....p.....p.....',
        '......kkkk......',
        '.....kYYyyk.....',
        'pp..kYyyyyok..pp',
        '....kyyyyyok....',
        'bbbbbbbbbbbbbbbb',
        'BBBLLBBBBBLLBBBB',
        'bbbbbbbbbbbbbbbb',
        'BBBBBBLLLBBBBBBB',
        '................',
        '................',
    ],
    'dusk': [
        '................',
        '................',
        '................',
        '................',
        '................',
        '......kkkk......',
        '.....krrrrk.....',
        '....krryyrrk....',
        '...krryyyyrrk...',
        '...kryyyyyyrk...',
        'NNNNNNNNNNNNNNNN',
        'nmnnnmnnnnmnnmnn',
        'NNNNNNNNNNNNNNNN',
        'nnnmnnnnmnnnnnmn',
        '................',
        '................',
    ],
    # ── 拉霸的圖案 ──
    'slot-fish': [
        '................',
        '................',
        '................',
        '.....kkkkk......',
        '...kkbbbbbkk..kk',
        '..kbbLLbbbbbkkbk',
        '.kbbLwkbbbbbbbbk',
        '.kbbbkkbbbbbbbk.',
        '.kbbbbbbbbbbbbk.',
        '.kBbbbbbbbbbbbbk',
        '..kBBbbbbbbbkkBk',
        '...kkBBBBBkk..kk',
        '.....kkkkk......',
        '................',
        '................',
        '................',
    ],
    'slot-clover': [
        '................',
        '....kkk..kkk....',
        '...kllgkkglgk...',
        '...klgggkgggk...',
        '...kggggkgggk...',
        '....kkggggkk....',
        '..kkk.kggk.kkk..',
        '.klgkkggggkklgk.',
        '.kgggggkkgggggk.',
        '.kggggk..kggggk.',
        '..kkkk.kk.kkkk..',
        '.......kGk......',
        '.......kGk......',
        '......kGk.......',
        '......kk........',
        '................',
    ],
    'slot-star': [
        '................',
        '.......kk.......',
        '......kYyk......',
        '......kYyk......',
        '.....kYyyok.....',
        'kkkkkkYyyyokkkkk',
        'kYYYyyyyyyyyyyok',
        '.kYyyyyyyyyyyok.',
        '..kYyyyyyyyyok..',
        '...kyyyyyyyok...',
        '...kyyyyyyyok...',
        '..kyyyokkoyyok..',
        '..kyyok..koyok..',
        '.kyok......kook.',
        '.kkk........kkk.',
        '................',
    ],
    'slot-bell': [
        '................',
        '.......kk.......',
        '......kook......',
        '.....kkkkkk.....',
        '....kYYyyyyok...',
        '...kYyyyyyyyok..',
        '...kYyyyyyyyok..',
        '...kyyyyyyyyok..',
        '..kyyyyyyyyyyok.',
        '..kyyyyyyyyyyok.',
        '.kyyyyyyyyyyyyok',
        '.kooooooooooooo k'.replace(' ', ''),
        '.kkkkkkkkkkkkkkk',
        '......koook.....',
        '.......kkk......',
        '................',
    ],
    'slot-seven': [
        '................',
        '..kkkkkkkkkkkk..',
        '..krrrrrrrrrrk..',
        '..krwwwwwwwwrk..',
        '..kRRRRRRrwwRk..',
        '.......krwwRk...',
        '......krwwRk....',
        '.....krwwRk.....',
        '.....krwwRk.....',
        '....krwwRk......',
        '....krwwRk......',
        '....krwwRk......',
        '....kRRRRk......',
        '....kkkkkk......',
        '................',
        '................',
    ],
}


def from_art(rows):
    im = new(16, 16)
    for y, row in enumerate(rows[:16]):
        for x, ch in enumerate(row[:16]):
            if ch in P:
                px(im, x, y, P[ch])
    return im


def die(n):
    """骰子：白色方塊、深色外框、依點數排好的黑點"""
    im = new(16, 16)
    for y in range(1, 15):
        for x in range(1, 15):
            edge = x in (1, 14) or y in (1, 14)
            corner = (x in (1, 14)) and (y in (1, 14))
            if corner:
                continue
            px(im, x, y, P['k'] if edge else ('#d8d5e3' if x == 13 or y == 13 else P['w']))
    spots = {1: [(7, 7)], 2: [(4, 4), (10, 10)], 3: [(4, 4), (7, 7), (10, 10)], 4: [(4, 4), (10, 4), (4, 10), (10, 10)],
             5: [(4, 4), (10, 4), (7, 7), (4, 10), (10, 10)], 6: [(4, 4), (10, 4), (4, 7), (10, 7), (4, 10), (10, 10)]}[n]
    for x, y in spots:
        c = P['r'] if n == 1 else P['k']
        for dx in range(2):
            for dy in range(2):
                px(im, x + dx, y + dy, c)
    return im


def main():
    for name, rows in ICONS.items():
        bad = [i for i, r in enumerate(rows) if len(r) != 16]
        if len(rows) != 16 or bad:
            raise SystemExit(f'圖示 {name} 的字元畫不是 16×16（第 {bad} 列）')
        save(from_art(rows), 'ui', f'{name}.png')
    for n in range(1, 7):
        save(die(n), 'ui', f'die-{n}.png')
    print('輸出：', ', '.join(list(ICONS) + [f'die-{n}' for n in range(1, 7)]))


if __name__ == '__main__':
    main()
