"""把一张图加进克劳德大小姐的表情包。
Add an image to Claude-girl's meme pack.

    python tools/add_meme.py my.png "表情包名" "画面描述，配字「…」，适合…"

图会被缩成 384×384 存进 dsh-pet-pack/claude-memes/<表情包名>.png，并写进 dsh-pet-pack/claude-config.json 的 memes。
描述是给模型看的：写清楚画面、配字和适合什么场合，碎碎念和对话会按它挑图。
The image is resized to 384x384 and registered in claude-config.json. The description is what the model reads
to pick a meme, so say what it shows, its caption and when it fits.

依赖 / Requires: Python 3.9+, pillow
"""
import json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if len(sys.argv) != 4:
    sys.exit(__doc__)
src, name, desc = sys.argv[1:]
if any(c in name for c in '\\/:*?"<>|'):
    sys.exit('名字里不能有 \\ / : * ? " < > | / name must not contain those characters')
im = Image.open(src).convert('RGB')
side = min(im.size)
im = im.crop(((im.width - side) // 2, (im.height - side) // 2, (im.width + side) // 2, (im.height + side) // 2))
out = os.path.join(ROOT, 'dsh-pet-pack', 'claude-memes', name + '.png')
im.resize((384, 384), Image.LANCZOS).save(out, optimize=True)
cfg_path = os.path.join(ROOT, 'dsh-pet-pack', 'claude-config.json')
cfg = json.load(open(cfg_path, encoding='utf8'))
cfg.setdefault('memes', {})[name] = desc
json.dump(cfg, open(cfg_path, 'w', encoding='utf8'), ensure_ascii=False, indent=2)
open(cfg_path, 'a', encoding='utf8').write('\n')
print('完成 / done:', out)
