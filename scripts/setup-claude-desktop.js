// 把桌宠的 MCP 服务器加进 Claude 桌面端配置（claude_desktop_config.json）。
// 会先备份原文件；重复运行只会更新同一条；加 --remove 参数则移除。
const fs = require('fs');
const os = require('os');
const path = require('path');

const NAME = 'claude-girl-pet';
const remove = process.argv.includes('--remove');

function configPath() {
  if (process.env.CLAUDE_DESKTOP_CONFIG) return process.env.CLAUDE_DESKTOP_CONFIG;
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }
  return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
}

const file = configPath();
const server = path.resolve(__dirname, '..', 'mcp', 'server.js').replace(/\\/g, '/');

let cfg = {};
if (fs.existsSync(file)) {
  const raw = fs.readFileSync(file, 'utf8');
  try {
    cfg = raw.trim() ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('配置文件不是合法的 JSON，没有改动。请先手动修好：' + file);
    process.exit(1);
  }
  // 只在第一次备份，之后重复运行不会盖掉最初的那份
  if (!fs.existsSync(file + '.bak')) {
    fs.writeFileSync(file + '.bak', raw);
    console.log('已备份原配置到 ' + file + '.bak');
  }
} else {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

cfg.mcpServers = cfg.mcpServers || {};
if (remove) {
  delete cfg.mcpServers[NAME];
} else {
  cfg.mcpServers[NAME] = { command: 'node', args: [server] };
}

fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
console.log(remove
  ? '已从 Claude 桌面端移除桌宠。完全退出 Claude 再打开后生效。'
  : '已把桌宠加进 Claude 桌面端：' + file + '\n请完全退出 Claude（托盘图标右键退出）再打开，然后对 Claude 说「让桌宠喝口茶」试试。');
