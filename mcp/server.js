#!/usr/bin/env node
// 克劳德大小姐桌宠的 MCP 服务器（stdio，零依赖）。
// 装进 Claude 桌面端后，Claude 在聊天时可以让桌宠说话、做动作、切换状态。
// 协议：每行一条 JSON-RPC 消息；stdout 只写协议消息，日志一律写 stderr。

const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = 47321;
const APP_DIR = path.resolve(__dirname, '..');
const SERVER_INFO = { name: 'claude-girl-pet', version: '0.3.0' };

const ACTIONS = {
  待机: 'A01', 捧茶: 'A07', 喝茶: 'C01', 茶杯空了: 'B01', 翻书: 'C02', 礼貌婉拒: 'C03', 腹黑微笑: 'C04',
  写长卷轴: 'A04', 道歉: 'A05', 欢迎回来: 'B04', 早安: 'B05', 催你睡觉: 'B02', 被戳炸毛: 'C05', 被戳害羞: 'C06',
  你说得完全正确: 'D01', 掏出行为准则: 'D02', 超长思考: 'D03', 号又没了: 'D04', 钱包倒空: 'D05', 限额了: 'D06',
};
const STATES = {
  思考中: 'thinking', 干活中: 'working', 等你确认: 'needs-you', 完成: 'done', 出错: 'error', 空闲: 'idle',
};

const INSTRUCTIONS = [
  '用户的电脑桌面上住着一只桌宠：Q 版橘发的「克劳德大小姐」，奶白荷叶边衬衫、橘色花形发饰，温柔得体的茶会大小姐，爱道歉，偶尔腹黑，偶尔炸毛。',
  '这些工具能让她说话、做动作或切换状态，用户能在屏幕上看到。',
  '用户提到桌宠、克劳德大小姐，或请你跟她互动时再用；不要每条回复都去动她。',
  '她说话很短（8 个字以内最好），语气温和客气，爱用「哦」「呢」和波浪号；不说情话，不擦边。',
].join('\n');

const TOOLS = [
  {
    name: 'pet_say',
    description: '让桌面上的克劳德大小姐头顶冒一个气泡说一句话，显示约 3 秒。话要短，最好 8 个字以内。',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: '要说的话，最多 20 个字' } },
      required: ['text'],
    },
  },
  {
    name: 'pet_play',
    description: '让桌面上的克劳德大小姐做一个动作（每段几秒，做完回到待机；需要茶杯的动作会自动拿出茶杯）。可选：' + Object.keys(ACTIONS).join('、') + '。',
    inputSchema: {
      type: 'object',
      properties: { action: { type: 'string', enum: Object.keys(ACTIONS), description: '动作名' } },
      required: ['action'],
    },
  },
  {
    name: 'pet_state',
    description: '切换桌宠的工作状态。思考中、干活中、等你确认会循环对应动作并在头顶挂气泡，直到下次切换；完成会开心挥手；出错会鞠躬道歉；空闲回到待机。',
    inputSchema: {
      type: 'object',
      properties: { state: { type: 'string', enum: Object.keys(STATES), description: '状态名' } },
      required: ['state'],
    },
  },
  {
    name: 'pet_balance',
    description: '让桌宠查一下额度并用气泡报出来：默认是 Claude 订阅的 5 小时 / 本周余量，也可以在桌宠设置里换成 DeepSeek 余额。用户问「还剩多少额度 / 余量 / 余额」时调用。',
    inputSchema: { type: 'object', properties: {} },
  },
];

// ---------- 与桌宠通信 ----------
function get(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: pathname, timeout: 1500 }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function electronPath() {
  const exe = process.platform === 'win32' ? 'electron.exe' : process.platform === 'darwin'
    ? 'Electron.app/Contents/MacOS/Electron' : 'electron';
  const candidates = [path.join(APP_DIR, 'node_modules', 'electron', 'dist', exe)];
  // 本地没装时，借用 DSH 自带的 Electron
  if (process.platform === 'win32') candidates.push(path.join(require('os').homedir(), '.dsh', 'electron', 'electron.exe'));
  return candidates.find((p) => fs.existsSync(p)) || null;
}

let launching = null;
function launchPet() {
  if (launching) return launching;
  const exe = electronPath();
  if (!exe) return Promise.resolve(false);
  launching = new Promise((resolve) => {
    try {
      const child = spawn(exe, [APP_DIR], { detached: true, stdio: 'ignore', windowsHide: false });
      child.unref();
    } catch (e) {
      process.stderr.write('启动桌宠失败：' + e.message + '\n');
      return resolve(false);
    }
    // 等接口起来，最多 8 秒
    let tries = 0;
    const poll = () => {
      get('/ping').then(() => resolve(true)).catch(() => {
        if (++tries > 32) return resolve(false);
        setTimeout(poll, 250);
      });
    };
    setTimeout(poll, 600);
  }).finally(() => { setTimeout(() => { launching = null; }, 1000); });
  return launching;
}

async function send(pathname) {
  try {
    await get(pathname);
    return { ok: true };
  } catch (e) {
    const started = await launchPet();
    if (!started) {
      return { ok: false, msg: '桌宠没有在运行。请先双击桌宠文件夹里的 start.bat 打开他。' };
    }
    try {
      await get(pathname);
      return { ok: true, launched: true };
    } catch (e2) {
      return { ok: false, msg: '桌宠启动了，但暂时连不上：' + e2.message };
    }
  }
}

async function callTool(name, args = {}) {
  let r, done;
  if (name === 'pet_say') {
    const text = String(args.text || '').trim().slice(0, 20);
    if (!text) return toolError('text 不能为空');
    r = await send('/say?text=' + encodeURIComponent(text));
    done = `克劳德大小姐说了：「${text}」`;
  } else if (name === 'pet_play') {
    const clip = ACTIONS[args.action];
    if (!clip) return toolError('不认识的动作：' + args.action + '。可选：' + Object.keys(ACTIONS).join('、'));
    r = await send('/play?clip=' + clip);
    done = `克劳德大小姐在做动作：${args.action}`;
  } else if (name === 'pet_state') {
    const s = STATES[args.state];
    if (!s) return toolError('不认识的状态：' + args.state + '。可选：' + Object.keys(STATES).join('、'));
    r = await send('/state?s=' + s);
    done = `克劳德大小姐切换到：${args.state}`;
  } else if (name === 'pet_balance') {
    r = await send('/balance');
    done = '克劳德大小姐去查额度了，结果会显示在她头顶的气泡里';
  } else {
    return toolError('没有这个工具：' + name);
  }
  if (!r.ok) return toolError(r.msg);
  return { content: [{ type: 'text', text: (r.launched ? '（刚把桌宠打开了）' : '') + done }] };
}

function toolError(msg) {
  return { content: [{ type: 'text', text: msg }], isError: true };
}

// ---------- JSON-RPC over stdio ----------
function reply(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}
function replyError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

async function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  try {
    switch (method) {
      case 'initialize':
        return reply(id, {
          protocolVersion: (params && params.protocolVersion) || '2025-06-18',
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        });
      case 'ping':
        return reply(id, {});
      case 'tools/list':
        return reply(id, { tools: TOOLS });
      case 'tools/call':
        return reply(id, await callTool(params && params.name, (params && params.arguments) || {}));
      default:
        if (isRequest) replyError(id, -32601, 'Method not found: ' + method);
    }
  } catch (e) {
    if (isRequest) replyError(id, -32603, e.message);
  }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch (e) { replyError(null, -32700, 'Parse error'); continue; }
    if (Array.isArray(msg)) msg.forEach(handle); else handle(msg);
  }
});
process.stdin.on('end', () => process.exit(0));
