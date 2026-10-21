// 克劳德大小姐桌宠主进程：透明置顶窗口 + 本地事件接口 + 作息感知。
const { app, BrowserWindow, ipcMain, Menu, screen, powerMonitor, shell } = require('electron');
const chat = require('./chat/llm');
const balance = require('./balance');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PORT = 47321;
const CLIP_W = 960, CLIP_H = 540;       // 素材比例（人物在画面中间，两边留给卷轴、键盘这类大动作）
const BUBBLE_H = 64;                     // 头顶气泡的空间（够放两行）
const SIZES = { 小: 160, 中: 210, 大: 280 }; // 人物身高，中号和大肥鱼差不多

// 设置固定存在「Claude 娘桌宠」文件夹里（改名前就是这个，hooks/hook.js 也从这里读开关）
app.setPath('userData', path.join(app.getPath('appData'), 'Claude 娘桌宠'));
// 只允许一只：Claude Code 的 hook 可能同时把她叫起来好几次
if (!app.requestSingleInstanceLock()) process.exit(0);

const cfgPath = () => path.join(app.getPath('userData'), 'config.json');
let cfg = {
  size: '中', x: null, y: null, quiet: false, autoStart: true, lastMorning: '', top: true, whisper: true, fling: true,
  chat: { provider: 'anthropic', apiKey: '', baseUrl: '', model: 'claude-haiku-4-5' },
  balance: { source: 'claude', deepseekKey: '', auto: true },
};
function loadCfg() {
  try {
    const saved = JSON.parse(fs.readFileSync(cfgPath(), 'utf8'));
    cfg = { ...cfg, ...saved, chat: { ...cfg.chat, ...(saved.chat || {}) }, balance: { ...cfg.balance, ...(saved.balance || {}) } };
  } catch (e) {}
}
function saveCfg() {
  try { fs.writeFileSync(cfgPath(), JSON.stringify(cfg, null, 1)); } catch (e) {}
}

let win;

// 动作设计：pet-config.json（右键「重载配置」重新读）
let petCfg = {};
function loadPetCfg() {
  try {
    petCfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'pet-config.json'), 'utf8'));
    return true;
  } catch (e) {
    console.error('pet-config.json 读不了：', e.message);
    return false;
  }
}

function winSize() {
  const h = SIZES[cfg.size] || SIZES['中'];
  const w = Math.round(h * CLIP_W / CLIP_H);
  return { w, h: h + BUBBLE_H };
}

function createWindow() {
  const { w, h } = winSize();
  const area = screen.getPrimaryDisplay().workArea;
  const x = cfg.x ?? area.x + area.width - w - 40;
  const y = cfg.y ?? area.y + area.height - h;
  win = new BrowserWindow({
    width: w, height: h, x, y,
    transparent: true, frame: false, resizable: false, hasShadow: false,
    alwaysOnTop: cfg.top, skipTaskbar: true, focusable: true,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.setAlwaysOnTop(cfg.top, 'floating');
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.setIgnoreMouseEvents(true, { forward: true });
  win.on('will-resize', (e) => e.preventDefault());
  win.webContents.on('did-finish-load', () => {
    send('config', petCfg);
    if (cfg.quiet) send('quiet', true);
    send('whisper', cfg.whisper);
    morningCheck();
  });
}

// 固定用 setBounds 带上宽高移动窗口。Windows 开了 125%/150% 缩放时，
// 连续调用 setPosition 会让透明窗口每次多出一两像素，甩几下人就变大了；跨不同缩放的屏幕也会变。
function place(x, y) {
  const { w, h } = winSize();
  win.setBounds({ x: Math.round(x), y: Math.round(y), width: w, height: h });
}

function send(ch, data) {
  if (win && !win.isDestroyed()) win.webContents.send(ch, data);
}

// ---------- 鼠标：穿透、拖动、右键菜单 ----------
ipcMain.on('ignore-mouse', (_e, v) => win && win.setIgnoreMouseEvents(!!v, { forward: true }));

let dragTimer = null;
let samples = [];
ipcMain.on('drag-start', () => {
  stopFling();
  const start = screen.getCursorScreenPoint();
  const [wx, wy] = win.getPosition();
  samples = [];
  clearInterval(dragTimer);
  dragTimer = setInterval(() => {
    const p = screen.getCursorScreenPoint();
    const nx = wx + p.x - start.x, ny = wy + p.y - start.y;
    place(nx, ny);
    samples.push({ t: Date.now(), x: nx, y: ny });
    if (samples.length > 12) samples.shift();
  }, 12);
});
ipcMain.on('drag-end', () => {
  clearInterval(dragTimer);
  dragTimer = null;
  // 用最后约 80ms 的轨迹算松手速度，够快就甩出去
  const now = Date.now();
  const recent = samples.filter((p) => now - p.t < 100);
  if (cfg.fling && recent.length >= 2) {
    const a = recent[0], b = recent[recent.length - 1];
    const dt = Math.max(1, b.t - a.t);
    const vx = (b.x - a.x) / dt * 16, vy = (b.y - a.y) / dt * 16;   // 每帧像素
    if (Math.hypot(vx, vy) > 6) return fling(vx, vy);
  }
  [cfg.x, cfg.y] = win.getPosition();
  saveCfg();
});

// ---------- 甩出去：撞到屏幕边会弹回来，最后落在任务栏上 ----------
let flingTimer = null;
function stopFling() {
  clearInterval(flingTimer);
  flingTimer = null;
}
function fling(vx, vy) {
  stopFling();
  const { w, h } = winSize();
  const area = screen.getDisplayMatching(win.getBounds()).workArea;
  // 人物只占窗口中间一段，允许窗口透明的两边伸出屏幕，让人物本身碰到边
  const side = Math.round(w * 0.28);
  const minX = area.x - side, maxX = area.x + area.width - w + side;
  const minY = area.y - BUBBLE_H, maxY = area.y + area.height - h;
  let [x, y] = win.getPosition();
  const G = 1.1, BOUNCE = 0.62, FRICTION = 0.86, MAX = 70;
  vx = Math.max(-MAX, Math.min(MAX, vx));
  vy = Math.max(-MAX, Math.min(MAX, vy));
  send('fling', true);
  flingTimer = setInterval(() => {
    vy += G;
    x += vx;
    y += vy;
    let hit = 0;
    if (x < minX) { x = minX; hit = Math.abs(vx); vx = -vx * BOUNCE; }
    if (x > maxX) { x = maxX; hit = Math.abs(vx); vx = -vx * BOUNCE; }
    if (y < minY) { y = minY; hit = Math.abs(vy); vy = -vy * BOUNCE; }
    if (y > maxY) {
      y = maxY;
      hit = Math.max(hit, vy);
      vy = -vy * BOUNCE;
      vx *= FRICTION;
      if (Math.abs(vy) < 2.5) vy = 0;
    }
    if (hit > 4) send('bounce', Math.min(1, hit / 30));
    send('fling-v', vx);
    place(x, y);
    if (y >= maxY && vy === 0 && Math.abs(vx) < 0.6) {
      stopFling();
      place(x, y);
      send('fling', false);
      [cfg.x, cfg.y] = win.getPosition();
      saveCfg();
    }
  }, 16);
}

const SOURCE_LABEL = { claude: '查看余量', deepseek: '查看余额' };

function nameOf(k) { return (petCfg.names && petCfg.names[k]) || k; }
function clipItems(list, seen) {
  return (list || []).flat().filter((k) => !seen.has(k) && seen.add(k)).map((k) => ({ label: nameOf(k), click: () => send('play', k) }));
}

// 「动作」子菜单：按 pet-config.json 的分类列出来，和 DSH 一样
function actionMenu() {
  const a = petCfg.animations || {};
  const ev = a.events || {};
  const groups = [
    ['待机', a.idle],
    ['点击回应', a.clicks],
    ...(a.categories || []).map((c) => [c.id, c.actions]),
    [cfg.balance.source === 'deepseek' ? '余额档位' : '余量档位', ev.balance],
    ['碎碎念', ev.whisper],
    ['工作状态', ev.workStatus],
  ];
  // 同一个动作只在第一个出现的分组里列一次，避免菜单里重复
  const seen = new Set();
  return groups.map(([label, l]) => ({ label, submenu: clipItems(l, seen) })).filter((g) => g.submenu.length);
}

ipcMain.on('menu', () => {
  const menu = Menu.buildFromTemplate([
    { label: '打开 Claude', click: openClaude },
    { label: SOURCE_LABEL[cfg.balance.source] || '查看余量', click: () => checkBalance(false) },
    { label: '碎碎念', click: () => send('whisper-now') },
    { label: '对话', click: () => openChat() },
    { label: '回到初始位置', click: resetPosition },
    { label: '重载配置', click: () => { if (loadPetCfg()) { send('config', petCfg); send('say', '配置重新读好啦'); } else send('say', '配置文件写错了…'); } },
    { label: '动作', submenu: actionMenu() },
    { type: 'separator' },
    { label: '设置', submenu: [
      { label: '大小', submenu: Object.keys(SIZES).map((s) => ({
        label: s, type: 'radio', checked: cfg.size === s, click: () => resize(s),
      })) },
      { label: '额度来源', submenu: [
        { label: 'Claude 订阅余量（读 Claude Code 登录）', type: 'radio', checked: cfg.balance.source !== 'deepseek', click: () => setSource('claude') },
        { label: 'DeepSeek 账户余额', type: 'radio', checked: cfg.balance.source === 'deepseek', click: () => setSource('deepseek') },
      ] },
      { label: '额度快用完时提醒我', type: 'checkbox', checked: cfg.balance.auto, click: (m) => { cfg.balance.auto = m.checked; saveCfg(); } },
      { label: '自动碎碎念', type: 'checkbox', checked: cfg.whisper, click: (m) => {
        cfg.whisper = m.checked; saveCfg(); send('whisper', cfg.whisper);
      } },
      { label: '安静模式（不冒气泡）', type: 'checkbox', checked: cfg.quiet, click: (m) => {
        cfg.quiet = m.checked; saveCfg(); send('quiet', cfg.quiet);
      } },
      { label: '可以甩出去（撞墙反弹）', type: 'checkbox', checked: cfg.fling, click: (m) => {
        cfg.fling = m.checked; saveCfg();
      } },
      { label: '跟着 Claude Code 自动出现', type: 'checkbox', checked: cfg.autoStart !== false, click: (m) => {
        cfg.autoStart = m.checked; saveCfg();
      } },
      { label: '总在最前', type: 'checkbox', checked: cfg.top, click: (m) => {
        cfg.top = m.checked; saveCfg(); win.setAlwaysOnTop(cfg.top, 'floating');
      } },
    ] },
    { label: '退出', click: () => app.quit() },
  ]);
  menu.popup({ window: win });
});

function setSource(src) {
  cfg.balance.source = src;
  saveCfg();
  checkBalance(false);
}

// ---------- 余额 / 余量 ----------
let balanceBusy = false;
async function checkBalance(auto) {
  if (balanceBusy) return;
  if (auto && !cfg.balance.auto) return;
  balanceBusy = true;
  if (!auto) send('say', '查一下…');
  const r = await balance.query(cfg);
  balanceBusy = false;
  // 自动查询时：查不到就不打扰，额度还多也不打扰，只在快用完时提醒
  if (auto && r.error) return;
  send('balance', { ...r, auto });
}

function resetPosition() {
  stopFling();
  const { w, h } = winSize();
  const area = screen.getPrimaryDisplay().workArea;
  place(area.x + area.width - w - 40, area.y + area.height - h);
  [cfg.x, cfg.y] = win.getPosition();
  saveCfg();
}

// 打开 Claude 桌面端；没装就打开网页版
function openClaude() {
  const local = process.env.LOCALAPPDATA || '';
  const candidates = [
    path.join(local, 'AnthropicClaude', 'claude.exe'),
    path.join(local, 'Programs', 'Claude', 'Claude.exe'),
    '/Applications/Claude.app',
  ];
  const hit = candidates.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });
  if (hit) shell.openPath(hit);
  else shell.openExternal('https://claude.ai/');
}

function resize(s) {
  cfg.size = s;
  const [x, y] = win.getPosition();
  const [ow, oh] = win.getSize();
  const { w, h } = winSize();
  win.setMinimumSize(1, 1); win.setMaximumSize(9999, 9999);
  // 以脚底中心为锚点缩放，人不会跳位置
  win.setBounds({ x: Math.round(x + ow / 2 - w / 2), y: y + oh - h, width: w, height: h });
  [cfg.x, cfg.y] = win.getPosition();
  saveCfg();
}

// ---------- 对话 ----------
let chatWin = null;
const history = [];

function openChat() {
  if (chatWin && !chatWin.isDestroyed()) { chatWin.show(); chatWin.focus(); return; }
  const [px, py] = win.getPosition();
  const area = screen.getDisplayMatching(win.getBounds()).workArea;
  const W = 360, H = 520;
  const x = Math.max(area.x, Math.min(px - W + 40, area.x + area.width - W));
  const y = Math.max(area.y, Math.min(py - H / 2, area.y + area.height - H));
  chatWin = new BrowserWindow({
    width: W, height: H, x, y, minWidth: 300, minHeight: 360,
    title: '和克劳德大小姐聊天', autoHideMenuBar: true, alwaysOnTop: cfg.top, backgroundColor: '#faf9f5',
    webPreferences: { preload: path.join(__dirname, 'chat', 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  chatWin.loadFile(path.join(__dirname, 'chat', 'chat.html'));
  chatWin.on('closed', () => { chatWin = null; });
}

ipcMain.on('open-chat', () => openChat());
ipcMain.handle('chat-settings', () => ({ ...cfg.chat, balanceSource: cfg.balance.source, deepseekKey: cfg.balance.deepseekKey }));
ipcMain.handle('chat-save', (_e, next) => {
  const { balanceSource, deepseekKey, ...chatNext } = next || {};
  cfg.chat = { ...cfg.chat, ...chatNext };
  if (balanceSource === 'claude' || balanceSource === 'deepseek') cfg.balance.source = balanceSource;
  if (typeof deepseekKey === 'string') cfg.balance.deepseekKey = deepseekKey;
  saveCfg();
  return { ...cfg.chat };
});
ipcMain.handle('chat-history', () => history.slice());
ipcMain.handle('chat-clear', () => { history.length = 0; return true; });
ipcMain.handle('chat-send', async (_e, text) => {
  text = String(text || '').trim().slice(0, 2000);
  if (!text) return { error: '先输入点什么吧' };
  if (!cfg.chat.apiKey) return { error: '还没有填 API Key，点右上角的「设置」填一下。' };
  history.push({ role: 'user', content: text });
  while (history.length > 20) history.shift();
  send('chat-thinking');
  try {
    const raw = await chat.ask(cfg.chat, history);
    const { text: reply, action } = chat.parseAction(raw);
    history.push({ role: 'assistant', content: raw });
    send('chat-reply', { text: reply, action });
    return { text: reply, action };
  } catch (err) {
    history.pop();
    send('chat-reply', { text: '', action: 'A05' });
    return { error: err.message };
  }
});

// ---------- Claude Code 事件接口 ----------
// hooks/hook.js 把 Claude Code 的 hook 事件 POST 到这里。
function classify(evt) {
  const name = evt.hook_event_name || evt.event || '';
  switch (name) {
    case 'UserPromptSubmit': return 'thinking';
    case 'PreToolUse': return 'working';
    case 'PostToolUseFailure': return 'error';
    case 'PostToolUse': {
      const r = evt.tool_response;
      const failed = r && typeof r === 'object' && (r.is_error === true || r.success === false || (r.error && r.error !== ''));
      return failed ? 'error' : 'working';
    }
    case 'Notification': return 'needs-you';
    case 'Stop': return 'done';
    case 'SessionEnd': return 'idle';
    default: return null;
  }
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const done = (code, body) => { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(body); };
    if (req.method === 'POST' && url.pathname === '/hook') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
      req.on('end', () => {
        let evt = {};
        try { evt = JSON.parse(body || '{}'); } catch (e) {}
        const state = classify(evt);
        if (state) send('claude', state);
        done(200, state || 'ignored');
      });
      return;
    }
    if (url.pathname === '/ping') return done(200, 'pong');
    if (url.pathname === '/play') { send('play', url.searchParams.get('clip')); return done(200, 'ok'); }
    if (url.pathname === '/say') { send('say', url.searchParams.get('text')); return done(200, 'ok'); }
    if (url.pathname === '/balance') { checkBalance(false); return done(200, 'ok'); }
    if (url.pathname === '/state') { send('claude', url.searchParams.get('s')); return done(200, 'ok'); }
    done(404, 'not found');
  });
  server.on('error', (e) => console.error('桌宠接口启动失败：', e.message));
  server.listen(PORT, '127.0.0.1');
}

// ---------- 作息：早安、熬夜、离开和回来 ----------
const today = () => new Date().toLocaleDateString('sv-SE');

function morningCheck() {
  const h = new Date().getHours();
  if (cfg.lastMorning !== today() && h >= 5) {
    cfg.lastMorning = today();
    saveCfg();
    setTimeout(() => send('play', 'B05'), 1500);
  }
}

let away = false;
let lastNight = 0;
function tick() {
  const idle = powerMonitor.getSystemIdleTime();     // 秒
  if (!away && idle >= 30 * 60) away = true;
  if (away && idle < 5) {
    away = false;
    send('play', 'B04');
    morningCheck();
  }
  const h = new Date().getHours();
  if (h < 5 && idle < 60 && Date.now() - lastNight > 45 * 60 * 1000) {
    lastNight = Date.now();
    send('play', 'B02');
  }
}

app.whenReady().then(() => {
  loadCfg();
  loadPetCfg();
  createWindow();
  startServer();
  setInterval(tick, 5000);
  const every = ((petCfg.eventsRefreshSec || {}).balance || 1800) * 1000;
  setTimeout(() => checkBalance(true), 60 * 1000);
  setInterval(() => checkBalance(true), every);
  powerMonitor.on('resume', () => { away = true; });
});

app.on('window-all-closed', () => app.quit());
