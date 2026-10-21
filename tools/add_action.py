"""把一段绿幕视频做成克劳德大小姐的新动作。
Turn a green-screen video into a new Claude-girl action.

    python tools/add_action.py my_video.mp4 E01 "新动作名" [--tea] [--keep-all]

做的事 / What it does:
  1. 去掉开头两帧（第 0 帧是上传的首帧图，偏亮）/ drop the first 2 frames (frame 0 is the uploaded still)
  2. 剪掉动作做完后的静止尾巴（--keep-all 不剪）/ trim the still tail after the motion (--keep-all keeps it)
  3. 按色相抠绿幕，去绿边 / hue-based chroma key with despill
  4. 按 assets/reference 的定稿图校色（首尾两头分别校，中间渐变）/ colour-match to the reference still
  5. 导出 clips/<代号>.webm（960×540）和 dsh-pet-pack/claude-animation/<动作名>.webm（640×360）
  6. 更新 renderer/masks.js（鼠标点击判定用的轮廓）/ update the click-through masks

之后你还要手动：/ Then by hand:
  - 在 renderer/pet.js 的 CLIPS 里加一行 / add a line to CLIPS in renderer/pet.js
  - 在 pet-config.json 和 dsh-pet-pack/claude-config.json 里把它放进某个分组 / put it in a group in both configs

依赖 / Requires: ffmpeg (with libvpx-vp9), Python 3.9+, numpy, pillow, scipy
"""
import argparse, base64, json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 24
SKIP_HEAD = 2


def hsv_key(rgb):
    f = rgb.astype(np.float32) / 255.0
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    mx = f.max(-1); mn = f.min(-1); d = mx - mn
    with np.errstate(divide='ignore', invalid='ignore'):
        h = np.where(mx == g, 60 * ((b - r) / np.where(d > 0, d, 1) + 2),
            np.where(mx == r, 60 * (((g - b) / np.where(d > 0, d, 1)) % 6), 60 * ((r - g) / np.where(d > 0, d, 1) + 4)))
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    bg = np.clip((h - 70) / 12, 0, 1) * np.clip((170 - h) / 12, 0, 1) * np.clip((s - 0.25) / 0.25, 0, 1) * np.clip((mx - 0.2) / 0.2, 0, 1)
    out = rgb.astype(np.float32).copy()
    gmax = np.maximum(out[..., 0], out[..., 2])
    out[..., 1] = np.where(out[..., 1] > gmax, gmax + (out[..., 1] - gmax) * 0.15, out[..., 1])
    return out, 1.0 - bg


def tidy(a):
    solid = a > 0.5
    lab, n = ndi.label(solid)
    if n > 1:
        sizes = ndi.sum(solid, lab, range(1, n + 1))
        keep = np.zeros(n + 1, bool); keep[1:] = sizes >= 150
        solid = keep[lab]
    solid = ndi.binary_fill_holes(solid) | solid
    a2 = np.where(solid, np.maximum(a, 0.0), 0.0)
    a2 = np.minimum(a2, ndi.uniform_filter(solid.astype(np.float32), 3) + (a2 > 0.98))
    return np.clip(a2, 0, 1)


def frames(path, w=1280, h=720):
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', path, '-fps_mode', 'passthrough', '-vf', f'scale={w}:{h}',
                          '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    n = w * h * 3; out = []
    while True:
        b = p.stdout.read(n)
        while b and len(b) < n:
            more = p.stdout.read(n - len(b))
            if not more: break
            b += more
        if len(b) < n: break
        out.append(np.frombuffer(b, np.uint8).reshape(h, w, 3))
    p.wait()
    return out


def motion_end(fr):
    small = [f[::4, ::4].astype(np.int16) for f in fr]
    d = []
    for i in range(len(small) - 1):
        m = (small[i][..., 1] - np.maximum(small[i][..., 0], small[i][..., 2])) < 60
        d.append(np.abs(small[i + 1] - small[i])[m].mean())
    d = np.array(d); act = np.where(d > 1.2 * np.median(d) + 0.5)[0]
    return int(act.max()) + 1 if len(act) else len(fr) - 1


def lut_from(src_rgb, src_a, ref_rgb, ref_a):
    qs = np.linspace(0, 1, 257); lut = np.zeros((3, 256), np.float32)
    s = src_rgb[src_a > 0.95].astype(float); r = ref_rgb[ref_a > 0.95].astype(float)
    for c in range(3):
        sq = np.quantile(s[:, c], qs) + np.arange(257) * 1e-6
        lut[c] = np.clip(np.interp(np.arange(256), np.maximum.accumulate(sq), np.quantile(r[:, c], qs)), 0, 255)
    return lut


def encode(pngs, out, extra=()):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(FPS), '-i', os.path.join(pngs, '%04d.png'), *extra,
                    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '30', '-row-mt', '1',
                    '-auto-alt-ref', '0', out], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video'); ap.add_argument('code'); ap.add_argument('name')
    ap.add_argument('--tea', action='store_true', help='首尾帧是捧茶杯的定稿 / first & last frame hold the teacup')
    ap.add_argument('--keep-all', action='store_true', help='不剪尾巴 / keep the tail')
    a = ap.parse_args()

    fr = frames(a.video)
    end = len(fr) - 1 if a.keep_all else min(len(fr) - 1, motion_end(fr) + int(0.4 * FPS))
    fr = fr[SKIP_HEAD:end + 1]
    ref = np.array(Image.open(os.path.join(ROOT, 'assets', 'reference', 'tea.png' if a.tea else 'base.png')).convert('RGB').resize((1280, 720)))
    ref_rgb, ref_a = hsv_key(ref); ref_rgb = ref_rgb.clip(0, 255).astype(np.uint8)
    def lut(f):
        rgb, al = hsv_key(f); return lut_from(rgb.clip(0, 255).astype(np.uint8), al, ref_rgb, ref_a)
    L0, L1 = lut(fr[0]), lut(fr[-1])

    tmp = tempfile.mkdtemp()
    masks = []
    for i, f in enumerate(fr):
        t = i / max(1, len(fr) - 1)
        L = np.clip((1 - t) * L0 + t * L1, 0, 255).astype(np.uint8)
        rgb, al = hsv_key(f); al = tidy(al); rgb = rgb.clip(0, 255).astype(np.uint8)
        for c in range(3): rgb[..., c] = L[c][rgb[..., c]]
        im = Image.fromarray(np.dstack([rgb, (al * 255).clip(0, 255).astype(np.uint8)]), 'RGBA').resize((960, 540), Image.LANCZOS)
        im.save(os.path.join(tmp, f'{i:04d}.png'))
        if i % 2 == 0:
            m = np.array(im.split()[3].resize((64, 36), Image.BILINEAR)) > 100
            masks.append(base64.b64encode(np.packbits(m.flatten()).tobytes()).decode())
        print(f'\r{i + 1}/{len(fr)}', end='', flush=True)
    print()

    encode(tmp, os.path.join(ROOT, 'clips', a.code + '.webm'))
    # DSH 规格：640×360 画布，站立身高 267px，脚底 y=330 / DSH spec: 640x360, standing height 267, feet at y=330
    s = 267 / 535; w, h = round(960 * s) // 2 * 2, round(540 * s) // 2 * 2
    encode(tmp, os.path.join(ROOT, 'dsh-pet-pack', 'claude-animation', a.name + '.webm'),
           ['-vf', f'format=rgba,scale={w}:{h}:flags=lanczos,pad=640:360:{round(320 - 474.5 * s)}:{round(330 - 538 * s)}:color=0x00000000,format=yuva420p'])

    mp = os.path.join(ROOT, 'renderer', 'masks.js')
    head, js = open(mp, encoding='utf8').read().split('window.PET_MASKS = ', 1)
    M = json.loads(js.strip().rstrip(';')); M['clips'][a.code] = masks
    open(mp, 'w', encoding='utf8').write(head + 'window.PET_MASKS = ' + json.dumps(M, separators=(',', ':')) + ';\n')
    print(f'完成 / done: clips/{a.code}.webm · dsh-pet-pack/claude-animation/{a.name}.webm · masks.js')
    print('别忘了在 renderer/pet.js 的 CLIPS 和两份配置里登记它 / now register it in renderer/pet.js CLIPS and both configs')


if __name__ == '__main__':
    main()
