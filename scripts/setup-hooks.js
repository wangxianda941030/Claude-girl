// 把桌宠的 hook 加进 Claude Code 的用户设置（~/.claude/settings.json）。
// 会先备份原文件；重复运行不会重复添加。加 --remove 参数则移除。
const fs = require('fs');
const os = require('os');
const path = require('path');

const MARK = 'golden-pet-hook';
const file = path.join(os.homedir(), '.claude', 'settings.json');
const hookJs = path.resolve(__dirname, '..', 'hooks', 'hook.js').replace(/\\/g, '/');
const command = `node "${hookJs}" ${MARK}`;
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SessionEnd'];
const TOOL_EVENTS = ['PreToolUse', 'PostToolUse'];
const remove = process.argv.includes('--remove');

let settings = {};
if (fs.existsSync(file)) {
  const raw = fs.readFileSync(file, 'utf8');
  try {
    settings = JSON.parse(raw);
  } catch (e) {
    console.error('settings.json 不是合法的 JSON，没有改动。请先手动修好：' + file);
    process.exit(1);
  }
  // 只在第一次备份，之后重复运行不会盖掉最初的那份
  if (!fs.existsSync(file + '.bak')) {
    fs.writeFileSync(file + '.bak', raw);
    console.log('已备份原设置到 ' + file + '.bak');
  }
} else {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

settings.hooks = settings.hooks || {};
for (const ev of EVENTS) {
  const groups = (settings.hooks[ev] || [])
    .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !String(h.command || '').includes(MARK)) }))
    .filter((g) => g.hooks.length > 0);
  if (!remove) {
    const group = { hooks: [{ type: 'command', command, timeout: 5 }] };
    if (TOOL_EVENTS.includes(ev)) group.matcher = '*';
    groups.push(group);
  }
  if (groups.length) settings.hooks[ev] = groups;
  else delete settings.hooks[ev];
}
if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

fs.writeFileSync(file, JSON.stringify(settings, null, 2));
console.log(remove ? '已移除桌宠 hook。' : '已添加桌宠 hook，重新打开 Claude Code 后生效：打开 Claude Code 时克劳德大小姐会自动出现。');
