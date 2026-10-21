# 一起来养克劳德大小姐 · Contributing

中文在前，English below.

## 想加点什么？

| 想加的 | 最简单的方式 | 想自己接进去 |
| --- | --- | --- |
| 表情包 | 开 Issue「新表情包」把图丢上来 | `python tools/add_meme.py 图.png 名字 "描述"` |
| 动作 | 开 Issue「新动作」把视频丢上来 | `python tools/add_action.py 视频.mp4 代号 动作名` |
| 碎碎念、台词 | 直接改 `pet-config.json` 发 PR | 同左 |
| 英文翻译 | 开 Issue 或 PR | 菜单在 `main.js`，台词在 `pet-config.json` |

### 表情包规范

- 正方形，最终会缩成 384×384 PNG。
- 半身大头、粗描边、橘色漫画符号、手写大字。参考 [`dsh-pet-pack/claude-memes/`](dsh-pet-pack/claude-memes/) 里现有的几张。
- 梗要接地气、跟 Claude 或写代码有关；可爱可以腹黑，**不擦边**。
- 用 GPT 生成：把 [`assets/reference/base.png`](assets/reference/base.png) 当角色参考，提示词模板在 [`prompts/memes.txt`](prompts/memes.txt)。
- 描述要写清楚画面、配字、适合什么场合，DSH 会按描述挑图。

### 动作规范

- 用即梦 / Seedance 图生视频：16:9，720P，镜头固定，纯绿幕 `#00FF00`，24fps，5 或 10 秒。
- 首帧和尾帧都用 [`assets/reference/base.png`](assets/reference/base.png)（空手）。需要一直捧茶杯的动作用 `tea.png`，处理时加 `--tea`。
- 每个动作必须回到第一帧的站姿，凭空出现的道具要消失，因为 DSH 播完会直接切回待机。
- 画面里不要有文字，视频模型写字基本会写错。
- 提示词模板在 [`prompts/actions.txt`](prompts/actions.txt)。每条先多跑几次，挑脸最稳、首尾接得最好的。

### 自己接进去

需要 `ffmpeg`（带 libvpx-vp9）和 Python 3.9+（`pip install numpy pillow scipy`）。

1. `python tools/add_action.py 我的视频.mp4 E01 "新动作名"`。它会抠图、校色，生成两个版本的视频，并更新点击轮廓。
2. 在 `renderer/pet.js` 的 `CLIPS` 里加一行：`E01: { pose: 'hand', say: '一句台词' },`。
3. 在 `pet-config.json` 的 `names` 里加名字，再放进某个分组（小动作、余额档位、工作状态…）。
4. 在 `dsh-pet-pack/claude-config.json` 里也放进一个分组。**每个动作在 DSH 里只放一个分组**，不然右键菜单会重复。
5. 跑 `node scripts/check.js`（或 `npm run check`），它会检查动作名、视频文件和分组有没有对上；再 `npm start` 看看效果，然后发 PR。

---

## English

### What can I add?

| Thing | Easiest | Do it yourself |
| --- | --- | --- |
| Sticker | Open a "New sticker" issue with the image | `python tools/add_meme.py img.png name "description"` |
| Action | Open a "New action" issue with the video | `python tools/add_action.py video.mp4 CODE name` |
| Lines / mutterings | Edit `pet-config.json` and send a PR | same |
| English translation | Issue or PR | menu in `main.js`, lines in `pet-config.json` |

### Stickers

- Square, resized to 384×384 PNG.
- Bust-up, bold outlines, orange comic symbols and big hand-lettered text. Match the existing ones in [`dsh-pet-pack/claude-memes/`](dsh-pet-pack/claude-memes/).
- Jokes should be about Claude or coding. Cute or a bit sly is fine; **nothing sexual**.
- With GPT: use [`assets/reference/base.png`](assets/reference/base.png) as the character reference; the prompt template is [`prompts/memes.txt`](prompts/memes.txt).
- The description should say what the image shows, its caption and when it fits; DSH picks stickers by it.

### Actions

- Jimeng / Seedance image-to-video: 16:9, 720p, locked camera, pure green screen `#00FF00`, 24 fps, 5 or 10 s.
- Use [`assets/reference/base.png`](assets/reference/base.png) (empty hands) as both first and last frame. For actions that hold the teacup throughout, use `tea.png` and pass `--tea`.
- Every action must end in the starting pose, and any props must disappear. DSH cuts straight back to idle.
- No text in the video; video models garble it.
- Prompt template: [`prompts/actions.txt`](prompts/actions.txt).

### Wiring it in

Needs `ffmpeg` (with libvpx-vp9) and Python 3.9+ (`pip install numpy pillow scipy`).

1. Run `python tools/add_action.py my.mp4 E01 "Name"`. It keys and colour-matches the video, encodes both versions and updates the click masks.
2. Add `E01: { pose: 'hand', say: '…' },` to `CLIPS` in `renderer/pet.js`.
3. Add it to `names` and a group in `pet-config.json`.
4. Add it to a group in `dsh-pet-pack/claude-config.json`. **Put each action in only one DSH group**, or the right-click menu shows it twice.
5. Run `node scripts/check.js` (`npm run check`) to catch missing names, files and groups, then `npm start`, then send a PR.
