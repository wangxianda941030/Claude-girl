// Claude Code hook：把事件转发给桌宠；桌宠没开的话顺手把她打开。
// 必须什么都不打印、永远以 0 退出，这样不会影响 Claude Code 本身。
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const APP_DIR = path.resolve(__dirname, '..');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', send);
setTimeout(send, 800); // stdin 没有结束也不卡住

// 右键「设置 → 跟着 Claude Code 自动出现」关掉时不自动打开
function autoStartOn() {
  const base = process.env.APPDATA || (process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config'));
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(base, 'Claude 娘桌宠', 'config.json'), 'utf8'));
    return cfg.autoStart !== false;
  } catch (e) {
    return true;
  }
}

function electronPath() {
  const exe = process.platform === 'win32' ? 'electron.exe' : process.platform === 'darwin'
    ? 'Electron.app/Contents/MacOS/Electron' : 'electron';
  const list = [path.join(APP_DIR, 'node_modules', 'electron', 'dist', exe)];
  if (process.platform === 'win32') list.push(path.join(os.homedir(), '.dsh', 'electron', 'electron.exe'));
  return list.find((p) => fs.existsSync(p)) || null;
}

function launch() {
  try {
    if (!autoStartOn()) return;
    const exe = electronPath();
    if (!exe) return;
    // 同时来好几个事件也只会有一只：桌宠自己做了单实例
    spawn(exe, [APP_DIR], { detached: true, stdio: 'ignore' }).unref();
  } catch (e) {}
}

let sent = false;
function send() {
  if (sent) return;
  sent = true;
  const req = http.request(
    { host: '127.0.0.1', port: 47321, path: '/hook', method: 'POST', timeout: 400,
      headers: { 'Content-Type': 'application/json' } },
    (res) => { res.resume(); res.on('end', () => process.exit(0)); },
  );
  req.on('error', (e) => {
    if (e && e.code === 'ECONNREFUSED') launch();
    setTimeout(() => process.exit(0), 50);
  });
  req.on('timeout', () => { req.destroy(); process.exit(0); });
  req.end(input || '{}');
  setTimeout(() => process.exit(0), 1000);
}
