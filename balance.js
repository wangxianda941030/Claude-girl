// 查额度，两个版本：
//   Claude 版 —— 订阅（Pro / Max）的「余量」：读 Claude Code 登录后存在本机的凭证，
//               查 5 小时和本周两个窗口用了多少（和 Claude Code 里 /usage 看到的一样）。
//               这个接口是 Claude Code 自己用的，没有公开文档，以后可能变。
//   DeepSeek 版 —— API 账户「余额」：GET https://api.deepseek.com/user/balance（官方公开接口）。
// 统一返回 { percent: 已用百分比 0–100, lines: [气泡文字], error }，档位动画在 renderer/pet.js。
const fs = require('fs');
const os = require('os');
const path = require('path');

let httpFetch = globalThis.fetch;
try { const { net } = require('electron'); if (net && net.fetch) httpFetch = (...a) => net.fetch(...a); } catch (e) {}

async function get(url, headers) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    return await httpFetch(url, { headers, signal: ctrl.signal });
  } catch (e) {
    throw new Error(ctrl.signal.aborted ? '连接超时了…' : '网络连不上…');
  } finally {
    clearTimeout(t);
  }
}

function untilText(iso) {
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const h = ms / 3600000;
  if (h < 1) return Math.max(1, Math.round(ms / 60000)) + '分钟后恢复';
  if (h < 24) return Math.round(h) + '小时后恢复';
  return Math.round(h / 24) + '天后恢复';
}

// ---------- Claude：订阅余量 ----------
function claudeToken() {
  const dir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  let j;
  try {
    j = JSON.parse(fs.readFileSync(path.join(dir, '.credentials.json'), 'utf8'));
  } catch (e) {
    throw new Error('没找到 Claude 登录信息\n先装 Claude Code 并登录一次');
  }
  const o = j && j.claudeAiOauth;
  if (!o || !o.accessToken) throw new Error('没找到 Claude 登录信息\n先在 Claude Code 里登录一次');
  if (o.expiresAt && Date.now() > o.expiresAt) throw new Error('登录过期了\n打开一次 Claude Code 就会续上');
  return o.accessToken;
}

async function claudeUsage() {
  const token = claudeToken();
  const res = await get('https://api.anthropic.com/api/oauth/usage', {
    Authorization: 'Bearer ' + token,
    'anthropic-beta': 'oauth-2025-04-20',
    'Content-Type': 'application/json',
  });
  if (res.status === 401 || res.status === 403) throw new Error('登录过期了\n打开一次 Claude Code 就会续上');
  if (!res.ok) throw new Error('查余量失败（' + res.status + '）');
  const u = await res.json();
  const wins = [
    ['5小时', u.five_hour],
    ['本周', u.seven_day],
  ].filter(([, w]) => w && Number.isFinite(Number(w.utilization)));
  if (!wins.length) throw new Error('这个账号没有订阅额度\n（API Key 用户查不了余量）');
  const lines = wins.map(([label, w]) => {
    const left = Math.max(0, Math.round(100 - Number(w.utilization)));
    const when = untilText(w.resets_at);
    return label + '还剩 ' + left + '%' + (when && left < 100 ? ' · ' + when : '');
  });
  return { percent: Math.max(...wins.map(([, w]) => Number(w.utilization))), lines };
}

// ---------- DeepSeek：账户余额 ----------
// 档位基准与 DSH 相同：CNY 20 元 / USD 5 美元算「满」，多币种按比例相加
const FULL = { CNY: 20, USD: 5 };
const SIGN = { CNY: '¥', USD: '$' };

function peak(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const wd = parts.find((p) => p.type === 'weekday').value;
  const h = Number(parts.find((p) => p.type === 'hour').value);
  if (wd === 'Sat' || wd === 'Sun') return false;
  return (h >= 9 && h < 12) || (h >= 14 && h < 18);
}

async function deepseekBalance(key) {
  if (!key) throw new Error('还没填 DeepSeek 的 Key\n双击我 → 设置 里填一下');
  const res = await get('https://api.deepseek.com/user/balance', { Authorization: 'Bearer ' + key, Accept: 'application/json' });
  if (res.status === 401) throw new Error('DeepSeek Key 不对…');
  if (!res.ok) throw new Error('查余额失败（' + res.status + '）');
  const body = await res.json();
  const infos = Array.isArray(body.balance_infos) ? body.balance_infos : [];
  if (!infos.length) throw new Error('没查到余额信息');
  let remain = 0, based = 0;
  const parts = [];
  for (const w of infos) {
    const total = Number(w.total_balance);
    if (!Number.isFinite(total)) continue;
    parts.push((SIGN[w.currency] || w.currency + ' ') + total.toFixed(2));
    if (FULL[w.currency]) { remain += total / FULL[w.currency]; based++; }
  }
  const percent = based ? Math.max(0, Math.min(100, 100 - remain * 100)) : 0;
  return { percent, lines: ['余额' + (peak() ? '（峰）' : '（谷）') + ' ' + parts.join(' + ')] };
}

async function query(cfg) {
  try {
    if (cfg.balance && cfg.balance.source === 'deepseek') {
      const key = cfg.balance.deepseekKey || (/deepseek/i.test(cfg.chat.baseUrl || '') ? cfg.chat.apiKey : '');
      return await deepseekBalance(key);
    }
    return await claudeUsage();
  } catch (e) {
    return { error: e.message || '查不到…' };
  }
}

module.exports = { query, claudeUsage, deepseekBalance };
