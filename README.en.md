<div align="center">

# Claude-girl · 克劳德大小姐

**A chibi, orange-haired tea-party lady who lives on your desktop and works, sips tea, checks your quota and occasionally throws shade alongside Claude.**

[中文](README.md) · English

![Claude-girl](docs/banner.png)

</div>

> 🤖 **Let an AI agent install it**: paste this into Claude Code, DeepSeek Harness or any agent that can run commands:
>
> ```
> Install the Claude-girl desktop pet from https://github.com/wangxianda941030/Claude-girl — follow AGENTS.md in the repo.
> ```

## What she does

- **Works along with Claude.** When you send a message she taps her chin and thinks (smoke comes out if it takes too long). While Claude runs tools she types on a little keyboard. When Claude waits for your approval she clasps her hands. When it finishes she waves happily, and on errors she bows and apologises, sweating.
- **Checks your quota, two flavours.**
  - Claude: your Pro / Max subscription **usage** left in the 5-hour and weekly windows. It reads Claude Code's login, so there is no key to paste.
  - DSH: your DeepSeek account **balance**.
  - The more you've used, the guiltier she looks: smug smile → sip of tea → holding tea → "rate-limited, see you in 5 hours" → empty cup → "account banned again" / empty wallet.
- **Idle life.** She reads, politely declines, pulls out an enormous rulebook, drinks tea and daydreams. Every few minutes she mutters something that fits the time of day.
- **Daily rhythm.** She stretches and says good morning the first time she sees you each day, waves when you come back after 30 minutes away, and rubs her eyes to send you to bed after midnight.
- **Interaction.**
  - Clicking her makes her bristle, get shy, or go starry-eyed with "You're absolutely right!"
  - You can drag her around, or fling her so she bounces off the screen edges.
  - Clicks pass straight through the transparent areas.
- **Chat.** Double-click her to chat. Works with the Anthropic API or any OpenAI-compatible API (DeepSeek, proxies…).
- **Memes.** In DSH her mutterings and chat replies come with her own sticker pack.

> The in-app text is Chinese for now. English translations are very welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Install

Needs [Node.js](https://nodejs.org) 18+.

```bash
git clone https://github.com/wangxianda941030/Claude-girl.git
cd Claude-girl
node install.js
```

`install.js` detects what you have and hooks into everything it can:

| You have | It does |
| --- | --- |
| **Claude Code** | Adds hooks so she follows Claude Code's state, and pops up automatically when you open Claude Code |
| **Claude desktop app** | Adds an MCP server. Say "make the desktop pet drink some tea" in chat and she will |
| **DeepSeek Harness** | Installs her as an extra pet for [dsh-pet](https://github.com/PC2005-cloud/dsh-pet). Right-click the pet in DSH → reload config |

To install just one of these, pass `--claude-code`, `--claude-desktop` or `--dsh`. Add `--cn` to download Electron from China mirrors. To remove everything, run `node install.js --uninstall`.

On Windows you can also double-click `install.bat`. Claude config files are backed up to `.bak` before the first change.

Afterwards, reopen Claude Code. For the Claude desktop app, fully quit it (tray icon → Quit) and open it again.

## Customise

- **Action groups and lines:** `pet-config.json` (Claude version) and `dsh-pet-pack/claude-config.json` (DSH version). Right-click → reload config; no restart needed.
- **Local API:** `127.0.0.1:47321`, localhost only. Endpoints: `/ping`, `/play?clip=C01`, `/say?text=hi`, `/state?s=thinking`, `/balance`, `POST /hook`.

## Help add stickers and actions 🙌

She has 25 animations and 9 stickers so far, and we want more. New stickers, actions, jokes and translations are all welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). The generation prompts live in [`prompts/`](prompts/) and the processing scripts in [`tools/`](tools/).

You don't have to write code: open an [issue](../../issues/new/choose) with your image or video and we'll wire it in.

## Credits

- **Inspiration and the DSH version:** [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) (the big blue fish). We learned a lot from it:
  - the menu structure, action groups and event tiers
  - the pet-pack format the DSH version uses
  - the hue-based green-screen keying

  The DSH version runs inside dsh-pet.
- **Character:** Claude-girl (克劳德大小姐) was co-created by the Baidu Tieba community.
- Animations were made with Jimeng / Seedance image-to-video; stickers with GPT.

## Disclaimer

This is an unofficial fan project, not affiliated with Anthropic or DeepSeek. "Claude" is a trademark of Anthropic and is used here only to say what the pet works with. The Claude usage check uses the endpoint Claude Code's `/usage` relies on. It is undocumented and may change.

## License

- Code: [MIT](LICENSE)
- Character art, animations and stickers: [CC BY-NC 4.0](ASSETS_LICENSE.md). Share and remix with credit, non-commercial only.
