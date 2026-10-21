// 在 Electron 里用 net.fetch：走系统代理（和浏览器一样），国内开了代理软件也能连上
let httpFetch = globalThis.fetch;
try { const { net } = require('electron'); if (net && net.fetch) httpFetch = (...a) => net.fetch(...a); } catch (e) {}

// 对话：调 Claude 官方接口，或任何 OpenAI 兼容接口（比如中转站、DeepSeek）。
const SYSTEM = [
  '你是用户电脑桌面上的桌宠「克劳德大小姐」：Q 版橘发的茶会大小姐，穿奶白荷叶边衬衫，戴橘色花形发饰。',
  '性格温柔得体，爱道歉，偶尔腹黑，偶尔害羞或炸毛。你也是 Claude，用户问正经问题时要认真、准确地回答。',
  '说话规则：口语化、简短，闲聊一般不超过 60 个字；问题需要详细回答时可以长一些，但先说结论。常用「哦」「呢」和「～」。',
  '不说情话、不擦边，不假装自己是真人；用户难过时温柔地陪着，必要时建议找身边的人或专业人士聊聊。',
  '你可以在回复最后另起一行，写一个动作标记让桌面上的自己做动作，只能从这些里选一个：',
  '【喝茶】【翻书】【礼貌婉拒】【腹黑微笑】【道歉】【开心挥手】【害羞】【炸毛】。不需要动作就不写。',
].join('\n');

const ACTIONS = {
  喝茶: 'C01', 翻书: 'C02', 礼貌婉拒: 'C03', 腹黑微笑: 'C04',
  道歉: 'A05', 开心挥手: 'B04', 害羞: 'C06', 炸毛: 'C05',
};

function parseAction(raw) {
  let text = String(raw || '').trim();
  let action = null;
  const m = text.match(/【([^【】]{1,6})】\s*$/);
  if (m && ACTIONS[m[1]]) {
    action = ACTIONS[m[1]];
    text = text.slice(0, m.index).trim();
  }
  return { text, action };
}

async function post(url, headers, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  let res;
  try {
    res = await httpFetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? '等了一分钟还没回复，网络可能不通' : '连不上接口：' + e.message);
  } finally {
    clearTimeout(timer);
  }
  const txt = await res.text();
  let data = {};
  try { data = JSON.parse(txt); } catch (e) {}
  if (!res.ok) {
    const msg = (data.error && (data.error.message || data.error)) || txt.slice(0, 200);
    if (res.status === 401 || res.status === 403) throw new Error('API Key 不对或没有权限（' + res.status + '）：' + msg);
    if (res.status === 404) throw new Error('接口地址或模型名不对（404）：' + msg);
    throw new Error('接口返回错误 ' + res.status + '：' + msg);
  }
  return data;
}

async function ask(settings, history) {
  const { provider, apiKey, model } = settings;
  const base = (settings.baseUrl || '').trim().replace(/\/+$/, '');
  if (provider === 'openai') {
    if (!base) throw new Error('OpenAI 兼容接口需要填接口地址（Base URL）');
    const data = await post(base + '/chat/completions',
      { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      { model, max_tokens: 600, messages: [{ role: 'system', content: SYSTEM }, ...history] });
    const c = data.choices && data.choices[0] && data.choices[0].message;
    if (!c) throw new Error('接口没有返回内容');
    return c.content || '';
  }
  const data = await post((base || 'https://api.anthropic.com') + '/v1/messages',
    { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    { model, max_tokens: 600, system: SYSTEM, messages: history });
  const block = (data.content || []).find((b) => b.type === 'text');
  if (!block) throw new Error('接口没有返回内容');
  return block.text;
}

module.exports = { ask, parseAction, SYSTEM, ACTIONS };
