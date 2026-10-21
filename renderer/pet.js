// 克劳德大小姐桌宠的动画状态机。Electron 和网页预览共用这一份。
// 动作分两种姿势：空手（hand）和捧茶杯（tea）。同一种姿势的动作首尾帧相同，可以直接切换；
// 姿势不同时自动先播过渡：X1 拿出茶杯（空手→茶杯），X2 收起茶杯（茶杯→空手）。

(function (global) {
  const CLIPS = {
    A01: { pose: 'hand', loop: true },                      // 待机
    A02: { pose: 'hand', loop: true },                      // 思考
    A03: { pose: 'hand', loop: true },                      // 干活
    A04: { pose: 'hand', say: '写好啦，有点长…' },          // 完成
    A05: { pose: 'hand', say: '抱、抱歉…' },               // 报错
    A06: { pose: 'hand', loop: true },                      // 等你确认
    B02: { pose: 'hand', say: '该睡了哦' },                 // 熬夜
    B04: { pose: 'hand', say: '欢迎回来～' },               // 欢迎回来
    B05: { pose: 'hand', say: '早上好～' },                 // 早安
    C02: { pose: 'hand' },                                  // 翻书
    C03: { pose: 'hand', say: '这个不行哦' },               // 礼貌婉拒
    C04: { pose: 'hand', say: '没关系的哦' },               // 腹黑微笑
    C05: { pose: 'hand' },                                  // 被戳炸毛
    C06: { pose: 'hand' },                                  // 被戳害羞
    D01: { pose: 'hand', say: '你说得完全正确！' },        // 你说得完全正确
    D02: { pose: 'hand', say: '按照准则…这个不行哦' },     // 掏出行为准则
    D03: { pose: 'hand' },                                  // 超长思考
    D04: { pose: 'hand', say: '号…号又没了？！' },          // 号又没了
    D05: { pose: 'hand', say: '一分都不剩了…' },            // 钱包倒空
    D06: { pose: 'hand', say: '限额了，五小时后见' },       // 限额了
    A07: { pose: 'tea', loop: true },                       // 捧茶待机
    C01: { pose: 'tea' },                                   // 喝茶
    B01: { pose: 'tea', say: '茶喝完了…' },                 // 茶杯空了
    X1: { from: 'hand', to: 'tea' },                        // 拿出茶杯
    X2: { from: 'tea', to: 'hand' },                        // 收起茶杯
  };
  const IDLE = { hand: 'A01', tea: 'A07' };
  const TO = { tea: 'X1', hand: 'X2' };

  // 动作设计（池子、档位、台词）都在 pet-config.json，这里只放兜底的最小配置
  const FALLBACK = {
    names: {},
    animations: { idle: ['A01'], clicks: ['C05', 'C06'], categories: [], events: { balance: ['A01'], whisper: ['A01'], workStatus: ['A02', 'A03', 'C02', 'A06', 'B04', 'A05'] } },
    animationWeights: { idle: 40 },
    balanceTexts: [], workStatusTexts: [], whisperTexts: { any: ['…'] },
    eventsRefreshSec: { whisper: 240 },
  };
  // Claude 的状态 → 工作状态档位（与 DSH 同序：思考、忙碌、单步完成、等确认、完成、出错）
  const WORK = { thinking: 0, working: 1, result: 2, 'needs-you': 3, done: 4, error: 5, chat: 0 };
  const STICKY = { 0: true, 1: true, 3: true };
  const LOOP_FALLBACK = { 0: 'A02', 1: 'A03', 3: 'A06' };
  const TEA_TALK = ['嗯？', '在喝茶呢', '要来一杯吗？'];
  const pick = (a) => (Array.isArray(a) ? a[Math.floor(Math.random() * a.length)] : a);

  class Pet {
    constructor(stage, opts = {}) {
      this.stage = stage;
      this.base = opts.base || 'clips/';
      this.idleMin = opts.idleMin || 20000;
      this.idleMax = opts.idleMax || 45000;
      this.onClip = opts.onClip || (() => {});
      this.videos = {};
      this.current = null;
      this.pose = 'hand';
      this.queue = [];
      this.claude = 'idle';
      this.quiet = false;
      this.pokeFlip = 0;
      this.cfg = FALLBACK;
      this.sticky = '';

      this.layer = document.createElement('div');
      this.layer.className = 'pet-layer';
      stage.appendChild(this.layer);
      this.bubble = document.createElement('div');
      this.bubble.className = 'pet-bubble';
      stage.appendChild(this.bubble);

      for (const [name, cfg] of Object.entries(CLIPS)) {
        const v = document.createElement('video');
        v.src = this.base + name + '.webm';
        v.muted = true;
        v.playsInline = true;
        v.preload = 'auto';
        v.loop = !!cfg.loop;
        v.className = 'pet-clip';
        v.dataset.clip = name;
        v.addEventListener('ended', () => { if (this.current === name) this._next(); });
        this.layer.appendChild(v);
        this.videos[name] = v;
      }

      this._show('A01');
      this._scheduleIdle();
    }

    // 现在该循环的动作：Claude 在忙就循环对应动作，否则按姿势待机
    _restClip() {
      const i = WORK[this.claude];
      if (i !== undefined && STICKY[i]) {
        const c = this._eventClip('workStatus', i);
        if (c && CLIPS[c] && CLIPS[c].loop) return c;
        // 事件动作只播一次的（比如超长思考），播完接着循环对应的待命动作
        return LOOP_FALLBACK[i] || IDLE[this.pose];
      }
      return IDLE[this.pose];
    }

    setConfig(cfg) {
      this.cfg = cfg && cfg.animations ? cfg : FALLBACK;
      if (this._whisperOn) this.setWhisper(true);
    }

    _eventClip(kind, i) {
      const pool = (this.cfg.animations.events || {})[kind] || [];
      const c = pick(pool[Math.min(i, pool.length - 1)]);
      return CLIPS[c] ? c : null;
    }

    _text(list, i) {
      return pick((list || [])[i]) || '';
    }

    // 对外：播放一个动作，姿势不对会先自动插入过渡
    // opts.say：不传就用动作自带的台词，传 null 不说话，传字符串就说这句
    play(name, opts = {}) {
      const cfg = CLIPS[name];
      if (!cfg) return;
      this.queue = [];
      const need = cfg.pose;
      if (need && need !== this.pose) this.queue.push(TO[need]);
      this.queue.push({ name, say: opts.say });
      this._next();
    }

    _next() {
      let item = this.queue.shift();
      let name = item && (item.name || item);
      const say = item && item.name ? item.say : undefined;
      if (!name) {
        name = this._restClip();
        const need = CLIPS[name].pose;
        if (need !== this.pose) {
          this.queue.push(name);
          name = TO[need];
        }
      }
      this._show(name, say);
    }

    // 真正切换画面：新片段出第一帧后淡入，旧片段同时淡出
    _show(name, sayOverride) {
      const v = this.videos[name];
      const cfg = CLIPS[name];
      this.current = name;
      if (cfg.to) this.pose = cfg.to; else if (cfg.pose) this.pose = cfg.pose;
      this.onClip(name);
      try { v.currentTime = 0; } catch (e) {}
      const reveal = () => {
        if (this.current !== name) return;
        for (const o of Object.values(this.videos)) o.classList.toggle('on', o === v);
        clearTimeout(this._fadeTimer);
        this._fadeTimer = setTimeout(() => {
          for (const o of Object.values(this.videos)) if (o !== this.videos[this.current]) o.pause();
        }, 220);
      };
      const p = v.play();
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(() => reveal());
      else v.addEventListener('playing', reveal, { once: true });
      if (p && p.catch) p.catch(() => reveal());
      const line = sayOverride === undefined ? cfg.say : sayOverride;
      if (line) this.say(line);
      this._scheduleIdle();
    }

    say(text, sticky = false, ms = 2800) {
      clearTimeout(this._bubbleTimer);
      if (this.quiet || !text) { this.bubble.classList.remove('on'); return; }
      this.bubble.textContent = text;
      this.bubble.classList.add('on');
      if (!sticky) this._bubbleTimer = setTimeout(() => this._restoreBubble(), ms);
    }

    // 对话：等回复时思考，回复到了就冒气泡，可能顺手做个动作
    chatThinking() {
      this.claudeEvent('chat');
    }

    chatReply({ text, action }) {
      this.claude = 'idle';
      this.sticky = '';
      if (action) this.play(action, { say: null });
      else this.play('A01');
      if (text) {
        const short = text.length > 30 ? text.slice(0, 26) + '…（见对话框）' : text;
        this.say(short, false, Math.min(9000, 2500 + short.length * 120));
      } else {
        this.say('呜…没连上', false);
      }
    }

    // 碎碎念：按时段挑一句，配一个小动作（空闲时才自动冒）
    whisper(force = false) {
      const T = this.cfg.whisperTexts || {};
      const h = new Date().getHours();
      const k = h >= 5 && h < 11 ? 'morning' : h < 14 ? 'noon' : h < 18 ? 'afternoon' : h < 23 ? 'evening' : 'night';
      const line = pick(Math.random() < 0.7 && T[k] ? T[k] : T.any || ['…']);
      const clip = pick(this.cfg.animations.events.whisper || []);
      if (force || Math.random() < 0.5) {
        if (clip && CLIPS[clip]) this.play(clip, { say: null });
      }
      this.say(line, false, 3600);
    }

    setWhisper(on) {
      this._whisperOn = on;
      clearTimeout(this._whisperTimer);
      if (!on) return;
      const base = ((this.cfg.eventsRefreshSec || {}).whisper || 240) * 1000;
      const next = () => {
        this._whisperTimer = setTimeout(() => {
          const free = this.claude === 'idle' && this.current === IDLE[this.pose] && !this.bubble.classList.contains('on');
          if (free) this.whisper();
          next();
        }, base * (0.6 + Math.random() * 0.8));
      };
      next();
    }

    // 余额 / 余量：r = { percent: 已用百分比 0–100, lines: [气泡文字…], error }
    // 已用档位与 DSH 一致：0–20、20–40、40–60、60–80、80–100、100（用光）
    balance(r, { quietIfOk = false } = {}) {
      if (!r || r.error) {
        if (!quietIfOk) { this.play('A05', { say: null }); this.say(r ? r.error : '查不到…', false, 5000); }
        return;
      }
      const p = Math.max(0, Math.min(100, r.percent));
      const i = p >= 100 ? 5 : Math.min(4, Math.floor(p / 20));
      if (quietIfOk && (i < 3 || this.claude !== 'idle')) return;
      const clip = this._eventClip('balance', i);
      if (clip) this.play(clip, { say: null });
      const flavour = this._text(this.cfg.balanceTexts, i);
      const lines = (r.lines || []).slice(0, 2);
      if (lines.length < 2 && flavour) lines.push(flavour);
      const text = lines.join('\n');
      this.say(text, false, 7000);
    }

    // 甩出去撞墙时压扁一下，力度越大压得越扁
    bounce(k = 0.5) {
      if (!this.layer.animate) return;
      if (this._squashAnim) this._squashAnim.cancel();
      const sx = 1 + 0.18 * k, sy = 1 - 0.22 * k;
      this._squashAnim = this.layer.animate([
        { transform: 'scale(1, 1)' },
        { transform: `scale(${sx}, ${sy})`, offset: 0.25 },
        { transform: 'scale(0.97, 1.04)', offset: 0.6 },
        { transform: 'scale(1, 1)' },
      ], { duration: 320, easing: 'ease-out' });
    }

    _restoreBubble() {
      if (this.sticky && this.claude !== 'idle' && !this.quiet) {
        this.bubble.textContent = this.sticky;
        this.bubble.classList.add('on');
      } else {
        this.bubble.classList.remove('on');
      }
    }

    // Claude Code 事件 → 工作状态档位
    claudeEvent(state) {
      if (state === 'idle') {
        this.claude = 'idle';
        this.sticky = '';
        if (this.current !== IDLE[this.pose]) this.play('A01');
        this._restoreBubble();
        return;
      }
      const i = WORK[state];
      if (i === undefined) return;
      const clip = this._eventClip('workStatus', i);
      const text = this._text(this.cfg.workStatusTexts, i) || '…';
      if (STICKY[i]) {
        const same = this.claude === state;
        this.claude = state;
        this.sticky = text;
        if (!same && clip) this.play(clip, { say: null });
        if (!same) this.say(text, true);
      } else {
        this.claude = 'idle';
        this.sticky = '';
        if (clip) this.play(clip, { say: text });
        else this.say(text);
      }
    }

    // 点她：轮流播点击回应
    clickClip() {
      const pool = this.cfg.animations.clicks || ['C05', 'C06'];
      this.pokeFlip = ((this.pokeFlip | 0) + 1) % pool.length;
      return pool[this.pokeFlip];
    }

    poke() {
      this.squash();
      if (this.pose === 'tea') {
        // 捧着茶的时候不放下茶杯，只回一句
        this.say(TEA_TALK[Math.floor(Math.random() * TEA_TALK.length)]);
        return;
      }
      this.play(this.clickClip());
    }

    setQuiet(q) {
      this.quiet = q;
      if (q) this.bubble.classList.remove('on');
      else this._restoreBubble();
    }

    // 空闲时按权重抽：继续待机，或者从各分类里抽一个动作（和 DSH 的 categories 一样）
    // 捧着茶时偶尔喝一口，或者把茶杯收起来
    _scheduleIdle() {
      clearTimeout(this._idleTimer);
      const wait = this.idleMin + Math.random() * (this.idleMax - this.idleMin);
      this._idleTimer = setTimeout(() => {
        if (this.claude !== 'idle' || this.current !== IDLE[this.pose]) return this._scheduleIdle();
        if (this.pose === 'tea') return this.play(Math.random() < 0.6 ? 'C01' : 'A01');
        const cats = (this.cfg.animations.categories || []).filter((c) => c.weight > 0 && c.actions && c.actions.length);
        const total = (this.cfg.animationWeights || {}).idle || 0;
        let r = Math.random() * cats.reduce((n, c) => n + c.weight, total);
        if (r < total) return this._scheduleIdle();
        r -= total;
        for (const c of cats) {
          if (r < c.weight) return this.play(pick(c.actions));
          r -= c.weight;
        }
        this._scheduleIdle();
      }, wait);
    }

    squash() {
      if (!this.layer.animate) return;
      if (this._squashAnim) this._squashAnim.cancel();
      this._squashAnim = this.layer.animate([
        { transform: 'scale(1, 1)' },
        { transform: 'scale(1.1, 0.86)', offset: 0.18 },
        { transform: 'scale(0.95, 1.07)', offset: 0.45 },
        { transform: 'scale(1.02, 0.98)', offset: 0.7 },
        { transform: 'scale(1, 1)' },
      ], { duration: 460, easing: 'ease-out' });
    }

    lean(vx) {
      const deg = Math.max(-8, Math.min(8, -vx * 0.8));
      this.layer.style.transition = 'rotate 0.12s ease-out';
      this.layer.style.rotate = deg.toFixed(1) + 'deg';
    }

    release() {
      this.layer.style.transition = 'rotate 0.5s cubic-bezier(.34,1.8,.5,1)';
      this.layer.style.rotate = '0deg';
      this.squash();
    }

    // 鼠标是否落在人物身上（用每帧的低分辨率轮廓判断）
    hitTest(clientX, clientY) {
      const v = this.current && this.videos[this.current];
      if (!v || !v.videoWidth) return true;
      const box = v.getBoundingClientRect();
      const scale = Math.min(box.width / v.videoWidth, box.height / v.videoHeight);
      const w = v.videoWidth * scale, h = v.videoHeight * scale;
      const left = box.left + (box.width - w) / 2, top = box.bottom - h;
      const fx = (clientX - left) / w, fy = (clientY - top) / h;
      if (fx < 0 || fx >= 1 || fy < 0 || fy >= 1) return false;
      const M = global.PET_MASKS;
      const frames = M && M.clips[this.current];
      if (!frames) return true;
      const i = Math.min(frames.length - 1, Math.floor(v.currentTime * M.fps));
      const bits = this._decode(this.current, i, frames[i]);
      const cell = Math.floor(fy * M.h) * M.w + Math.floor(fx * M.w);
      return (bits[cell >> 3] >> (7 - (cell & 7))) & 1;
    }

    _decode(clip, i, b64) {
      this._maskCache = this._maskCache || {};
      const key = clip + i;
      if (!this._maskCache[key]) {
        const s = atob(b64);
        const a = new Uint8Array(s.length);
        for (let k = 0; k < s.length; k++) a[k] = s.charCodeAt(k);
        this._maskCache[key] = a;
      }
      return this._maskCache[key];
    }
  }

  Pet.CLIPS = CLIPS;
  Pet.WORK = WORK;
  global.Pet = Pet;
})(window);
