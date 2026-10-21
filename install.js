#!/usr/bin/env node
// 克劳德大小姐 / Claude-girl 一键安装（零依赖，Node 18+）
// One-shot installer (no dependencies, Node 18+).
//
//   node install.js                 自动检测并全部装上 / auto-detect and install everything
//   node install.js --claude-code   只接 Claude Code（hook） / Claude Code hooks only
//   node install.js --claude-desktop  只接 Claude 桌面端（MCP） / Claude desktop app (MCP) only
//   node install.js --dsh           只装进 DeepSeek Harness 的 dsh-pet / DSH pet pack only
//   node install.js --no-start      装完不启动 / don't launch afterwards
//   node install.js --cn            用国内镜像下载 Electron / use China mirrors for Electron
//   node install.js --uninstall     全部卸载 / remove everything
//
// 每一步都会打印结果；改动别人的配置文件前会先备份成 .bak。
// Every step prints what it did; config files are backed up to .bak before the first change.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = __dirname;
const args = new Set(process.argv.slice(2));
const HOME = os.homedir();
const WIN = process.platform === 'win32';
const zh = /^zh/i.test(Intl.DateTimeFormat().resolvedOptions().locale || process.env.LANG || '');
const say = (cn, en) => console.log(zh ? cn : en);
const ok = (cn, en) => say('  ✓ ' + cn, '  ✓ ' + en);
const skip = (cn, en) => say('  - ' + cn, '  - ' + en);
const fail = (cn, en) => say('  ✗ ' + cn, '  ✗ ' + en);

const major = Number(process.versions.node.split('.')[0]);
if (major < 18) {
  say('需要 Node.js 18 或更新版本：https://nodejs.org', 'Node.js 18+ is required: https://nodejs.org');
  process.exit(1);
}

const uninstall = args.has('--uninstall');
const picked = ['--claude-code', '--claude-desktop', '--dsh'].filter((a) => args.has(a));

// ---------- 检测 / detect ----------
const DSH_HOME = process.env.DSH_HOME || path.join(HOME, '.dsh');
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude');
function desktopConfigDir() {
  if (WIN) return path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'), 'Claude');
  if (process.platform === 'darwin') return path.join(HOME, 'Library', 'Application Support', 'Claude');
  return path.join(HOME, '.config', 'Claude');
}
const has = {
  claudeCode: fs.existsSync(CLAUDE_DIR),
  claudeDesktop: fs.existsSync(desktopConfigDir()),
  dsh: fs.existsSync(DSH_HOME),
};
const want = picked.length
  ? { claudeCode: args.has('--claude-code'), claudeDesktop: args.has('--claude-desktop'), dsh: args.has('--dsh') }
  : { ...has };

function runNode(script, extra = []) {
  const r = spawnSync(process.execPath, [path.join(ROOT, script), ...extra], { stdio: 'inherit' });
  return r.status === 0;
}

// ---------- Electron ----------
function electronPath() {
  const exe = WIN ? 'electron.exe' : process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron';
  const list = [path.join(ROOT, 'node_modules', 'electron', 'dist', exe)];
  if (WIN) list.push(path.join(DSH_HOME, 'electron', 'electron.exe')); // DSH 自带的 / the one bundled with DSH
  return list.find((p) => fs.existsSync(p)) || null;
}

function ensureElectron() {
  const found = electronPath();
  if (found) return ok('Electron：' + found, 'Electron: ' + found), found;
  say('  … 第一次运行，正在下载 Electron（约 100 MB）', '  … First run: downloading Electron (~100 MB)');
  const env = { ...process.env };
  const npmArgs = ['install', '--no-audit', '--no-fund'];
  if (args.has('--cn') || zh) {
    env.ELECTRON_MIRROR = env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/';
    npmArgs.push('--registry=https://registry.npmmirror.com');
  }
  const r = spawnSync(WIN ? 'npm.cmd' : 'npm', npmArgs, { cwd: ROOT, stdio: 'inherit', env, shell: WIN });
  const after = electronPath();
  if (r.status !== 0 || !after) {
    fail('Electron 没装上。检查网络后重试，或加 --cn 用国内镜像。', 'Electron install failed. Check your network and retry (add --cn for China mirrors).');
    return null;
  }
  ok('Electron 装好了', 'Electron installed');
  return after;
}

// ---------- DSH pet pack ----------
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
function dshInstall() {
  const petDir = path.join(DSH_HOME, 'dsh-pet', 'pet');
  if (uninstall) {
    for (const n of ['claude-config.json', 'claude-animation', 'claude-memes']) {
      fs.rmSync(path.join(petDir, n), { recursive: true, force: true });
    }
    return ok('已从 DSH 移除', 'Removed from DSH');
  }
  const src = path.join(ROOT, 'dsh-pet-pack');
  fs.mkdirSync(petDir, { recursive: true });
  fs.copyFileSync(path.join(src, 'claude-config.json'), path.join(petDir, 'claude-config.json'));
  copyDir(path.join(src, 'claude-animation'), path.join(petDir, 'claude-animation'));
  copyDir(path.join(src, 'claude-memes'), path.join(petDir, 'claude-memes'));
  ok('已装进 DSH：' + petDir + '\n    在 DSH 里右键宠物「重载配置」或重启 DSH 生效（需要先装 dsh-pet 插件）',
     'Installed into DSH: ' + petDir + '\n    Right-click the pet in DSH → reload config, or restart DSH (the dsh-pet plugin must be installed)');
}

// ---------- 主流程 / main ----------
say(uninstall ? '\n卸载克劳德大小姐…' : '\n安装克劳德大小姐…', uninstall ? '\nUninstalling Claude-girl…' : '\nInstalling Claude-girl…');
say(`检测到：Claude Code ${has.claudeCode ? '有' : '无'} · Claude 桌面端 ${has.claudeDesktop ? '有' : '无'} · DSH ${has.dsh ? '有' : '无'}`,
    `Found: Claude Code ${has.claudeCode ? 'yes' : 'no'} · Claude desktop ${has.claudeDesktop ? 'yes' : 'no'} · DSH ${has.dsh ? 'yes' : 'no'}`);

let needsApp = false;
const rm = uninstall ? ['--remove'] : [];

if (want.claudeCode) {
  say('\n[Claude Code]', '\n[Claude Code]');
  if (runNode('scripts/setup-hooks.js', rm)) { ok(uninstall ? 'hook 已移除' : 'hook 已添加，重开 Claude Code 生效', uninstall ? 'hooks removed' : 'hooks added; reopen Claude Code'); needsApp = true; }
  else fail('hook 没加上', 'failed to add hooks');
} else skip('跳过 Claude Code', 'skipped Claude Code');

if (want.claudeDesktop) {
  say('\n[Claude 桌面端]', '\n[Claude desktop]');
  if (runNode('scripts/setup-claude-desktop.js', rm)) { ok(uninstall ? '已移除' : '已添加，完全退出 Claude 再打开生效', uninstall ? 'removed' : 'added; fully quit and reopen Claude'); needsApp = true; }
  else fail('没加上', 'failed');
} else skip('跳过 Claude 桌面端', 'skipped Claude desktop');

if (want.dsh) {
  say('\n[DeepSeek Harness]', '\n[DeepSeek Harness]');
  try { dshInstall(); } catch (e) { fail('出错了：' + e.message, 'error: ' + e.message); }
} else skip('跳过 DSH', 'skipped DSH');

if (!uninstall && needsApp && !args.has('--no-start')) {
  say('\n[桌宠程序]', '\n[Desktop pet app]');
  const exe = ensureElectron();
  if (exe) {
    spawn(exe, [ROOT], { detached: true, stdio: 'ignore' }).unref();
    ok('已经启动，她会出现在屏幕右下角', 'Started — she appears at the bottom-right of your screen');
  }
}

if (!want.claudeCode && !want.claudeDesktop && !want.dsh) {
  say('\n没找到 Claude Code、Claude 桌面端或 DSH。装好其中一个再运行，或者用 --claude-code / --claude-desktop / --dsh 指定。',
      '\nNo Claude Code, Claude desktop or DSH found. Install one first, or pass --claude-code / --claude-desktop / --dsh.');
  process.exit(1);
}
say('\n完成。', '\nDone.');
