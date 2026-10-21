# Installing Claude-girl — instructions for AI agents

You are an AI agent and a user asked you to install this desktop pet. Follow these steps exactly. Talk to the user in their language (中文用户用中文回复).

## 1. Check prerequisites

- Run `node --version`. It must be 18 or newer. If Node is missing, stop and ask the user to install the LTS version from https://nodejs.org. Do not install it yourself.
- `git` is optional. Without it, download https://github.com/wangxianda941030/Claude-girl/archive/refs/heads/main.zip and unzip it.

## 2. Get the code

Put it somewhere permanent. The hooks and MCP config point at this folder, so it must not be a temp directory.

```bash
git clone https://github.com/wangxianda941030/Claude-girl.git ~/Claude-girl
cd ~/Claude-girl
```

On Windows, `%USERPROFILE%\Claude-girl` is a good place. If the folder already exists, run `git pull` instead.

## 3. Install

```bash
node install.js
```

- It auto-detects Claude Code (`~/.claude`), the Claude desktop app and DeepSeek Harness (`~/.dsh`), and sets up each one it finds.
- Add `--cn` if the user is in mainland China or the Electron download fails.
- If the user only wants one integration, pass `--claude-code`, `--claude-desktop` or `--dsh`.
- If you are running inside a sandbox or remote machine that is not the user's desktop, stop and tell the user. The pet must run on their own computer.
- The script backs up `~/.claude/settings.json` and `claude_desktop_config.json` to `.bak` before the first change. Never edit those files by hand.
- The first run downloads Electron (~100 MB). Let it finish; it can take a few minutes.

## 4. Tell the user what to do next

Report which integrations were set up (the script prints ✓ lines). Then tell them:

- **Claude Code:** restart Claude Code. From then on she appears automatically when Claude Code starts.
- **Claude desktop app:** fully quit Claude (tray icon → Quit) and reopen it, then try "让桌宠喝口茶" / "make the pet drink some tea".
- **DeepSeek Harness:** the dsh-pet plugin must already be installed in DSH. Right-click the pet in DSH → 重载配置 (reload config), or restart DSH.
- **Using her:**
  - Right-click her for the menu, double-click to chat, and drag or fling to move her.
  - Right-click → 查看余量 (check quota) shows how much Claude usage is left.

## Uninstall

```bash
cd ~/Claude-girl && node install.js --uninstall
```

Then the folder can be deleted.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Electron download fails | `node install.js --cn`, or set `ELECTRON_MIRROR` |
| She doesn't appear with Claude Code | Rerun `node install.js --claude-code`, restart Claude Code; check right-click → 设置 → 跟着 Claude Code 自动出现 is on |
| 查看余量 says no login found | The user needs to log in to Claude Code with a Pro/Max subscription once; API-key-only accounts have no usage quota |
| Port 47321 in use | Another copy is running; quit it from the tray/right-click menu |
