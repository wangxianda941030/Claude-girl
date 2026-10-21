// Electron 窗口里的交互：拖动、点击、右键菜单、透明区域鼠标穿透。
const api = window.petApi;
const pet = new Pet(document.getElementById('stage'), { base: '../clips/' });

api.on('config', (cfg) => pet.setConfig(cfg));
api.on('balance', (r) => pet.balance(r, r && r.auto ? { quietIfOk: true } : {}));
api.on('whisper-now', () => pet.whisper(true));
api.on('claude', (state) => pet.claudeEvent(state));
api.on('play', (name) => pet.play(name));
api.on('say', (text) => pet.say(text));
api.on('quiet', (q) => pet.setQuiet(q));
api.on('whisper', (on) => pet.setWhisper(on));
api.on('chat-thinking', () => pet.chatThinking());
api.on('chat-reply', (r) => pet.chatReply(r));
api.on('bounce', (k) => pet.bounce(k));
api.on('fling-v', (vx) => pet.lean(vx * 0.6));
api.on('fling', (on) => { if (!on) pet.release(); });

// 双击打开聊天窗
window.addEventListener('dblclick', () => api.send('open-chat'));

// 透明的地方让鼠标穿透到下面的窗口
let ignoring = null;
function setIgnore(v) {
  if (ignoring === v) return;
  ignoring = v;
  api.send('ignore-mouse', v);
}

let down = null;
let dragging = false;
let lastX = 0, lastT = 0, vx = 0;

window.addEventListener('mousemove', (e) => {
  if (down) {
    if (!dragging && Math.hypot(e.screenX - down.x, e.screenY - down.y) > 4) {
      dragging = true;
      api.send('drag-start');
      lastX = e.screenX;
      lastT = performance.now();
    }
    if (dragging) {
      // 用屏幕坐标算拖动速度（窗口跟着鼠标走，窗口内坐标几乎不变）
      const now = performance.now();
      const dt = Math.max(8, now - lastT);
      vx = vx * 0.6 + ((e.screenX - lastX) / dt) * 16 * 0.4;
      lastX = e.screenX;
      lastT = now;
      pet.lean(vx);
    }
    return;
  }
  setIgnore(!pet.hitTest(e.clientX, e.clientY));
});

function endDrag() {
  if (dragging) {
    api.send('drag-end');
    pet.release();
  }
  down = null;
  dragging = false;
  vx = 0;
}

window.addEventListener('mouseleave', () => {
  // 拖得太快、鼠标在窗口外松开时，也要结束拖动
  if (down) endDrag();
  setIgnore(true);
});
window.addEventListener('blur', () => { if (down) endDrag(); });

window.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  down = { x: e.screenX, y: e.screenY };
  dragging = false;
});

window.addEventListener('mouseup', (e) => {
  if (e.button !== 0 || !down) return;
  if (dragging) endDrag();
  else {
    pet.poke();
    down = null;
  }
});

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  api.send('menu');
});
