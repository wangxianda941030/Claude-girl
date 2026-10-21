const api = window.chatApi;
const $ = (id) => document.getElementById(id);
const list = $('list');

function add(cls, text) {
  const empty = list.querySelector('.empty');
  if (empty) empty.remove();
  const d = document.createElement('div');
  d.className = 'msg ' + cls;
  d.textContent = text;
  list.appendChild(d);
  list.scrollTop = list.scrollHeight;
  return d;
}

function showEmpty() {
  list.innerHTML = '<p class="empty">午安～想聊什么都可以哦。<br>第一次用请先点右上角「设置」填好接口。</p>';
}

async function loadSettings() {
  const s = await api.settings();
  $('provider').value = s.provider || 'anthropic';
  $('baseUrl').value = s.baseUrl || '';
  $('apiKey').value = s.apiKey || '';
  $('model').value = s.model || '';
  $('balanceSource').value = s.balanceSource || 'claude';
  $('deepseekKey').value = s.deepseekKey || '';
  syncPlaceholder();
  if (!s.apiKey) $('settings').hidden = false;
}

function syncPlaceholder() {
  const openai = $('provider').value === 'openai';
  $('baseUrl').placeholder = openai ? '例如 https://api.deepseek.com/v1' : 'https://api.anthropic.com';
  $('model').placeholder = openai ? '例如 deepseek-chat' : '例如 claude-haiku-4-5';
  const ds = $('balanceSource').value === 'deepseek';
  $('deepseekKey').hidden = !ds;
  $('dsLabel').hidden = !ds;
}

$('balanceSource').addEventListener('change', syncPlaceholder);

$('provider').addEventListener('change', syncPlaceholder);
$('setBtn').addEventListener('click', () => { $('settings').hidden = !$('settings').hidden; });
$('saveBtn').addEventListener('click', async () => {
  await api.save({
    provider: $('provider').value,
    baseUrl: $('baseUrl').value.trim(),
    apiKey: $('apiKey').value.trim(),
    model: $('model').value.trim(),
    balanceSource: $('balanceSource').value,
    deepseekKey: $('deepseekKey').value.trim(),
  });
  $('saved').textContent = '已保存';
  setTimeout(() => { $('saved').textContent = ''; $('settings').hidden = true; }, 900);
});
$('clearBtn').addEventListener('click', async () => { await api.clear(); showEmpty(); });

$('input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    $('form').requestSubmit();
  }
});

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('input').value.trim();
  if (!text) return;
  $('input').value = '';
  add('me', text);
  const wait = add('her wait', '……');
  $('sendBtn').disabled = true;
  const r = await api.send(text);
  $('sendBtn').disabled = false;
  wait.remove();
  if (r.error) add('err', r.error);
  else add('her', r.text || '（她只是点了点头）');
  $('input').focus();
});

(async () => {
  await loadSettings();
  const h = await api.history();
  if (!h.length) showEmpty();
  for (const m of h) add(m.role === 'user' ? 'me' : 'her', m.content.replace(/\n?【[^【】]{1,6}】\s*$/, ''));
  $('input').focus();
})();
