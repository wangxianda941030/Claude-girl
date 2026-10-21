#!/usr/bin/env node
/**
 * 静态自检：本地 `npm run check` 和 CI 共用。
 *
 * 只查“加动作 / 加表情包最容易漏掉的东西”：
 *   - 所有 JS 能不能通过语法检查、JSON 能不能解析
 *   - 配置里写了的动作，对应的视频文件到底在不在
 *   - 动作有没有漏进 pet.js 的 CLIPS，或者漏进 DSH 的分组
 *   - DSH 里一个动作只能挂一个分组（否则右键菜单会重复）
 *
 * 不查画面好不好看，也不启动 Electron。
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.github']);

const errors = [];
const warnings = [];
const passed = [];

const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const ok = (m) => passed.push(m);
const abs = (p) => path.join(ROOT, p);
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(ROOT);
const byExt = (ext) => files.filter((f) => f.toLowerCase().endsWith(ext));

function readJSON(relPath) {
  const raw = fs.readFileSync(abs(relPath), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

/** 把 ["a", ["b", "c"]] 这种嵌套数组拍平 */
function flatten(values, out = []) {
  for (const v of values || []) {
    if (Array.isArray(v)) flatten(v, out);
    else if (typeof v === 'string') out.push(v);
  }
  return out;
}

// ---------------------------------------------------------------- 1. JSON
const jsonFiles = byExt('.json');
const json = {};
for (const f of jsonFiles) {
  try {
    json[rel(f)] = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {
    err(`${rel(f)} 不是合法 JSON：${e.message}`);
  }
}
ok(`${jsonFiles.length} 个 JSON 可以解析`);

// ---------------------------------------------------------------- 2. JS 语法
const jsFiles = byExt('.js');
let jsBad = 0;
for (const f of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    jsBad++;
    const detail = (e.stderr || Buffer.from('')).toString().split('\n').slice(0, 3).join(' ').trim();
    err(`${rel(f)} 语法错误：${detail}`);
  }
}
if (!jsBad) ok(`${jsFiles.length} 个 JS 语法通过`);

// ---------------------------------------------------------------- 3. 素材目录
const clipDir = abs('clips');
const clips = new Set(fs.readdirSync(clipDir).filter((n) => n.endsWith('.webm')).map((n) => n.replace(/\.webm$/, '')));
const animDir = abs('dsh-pet-pack/claude-animation');
const anims = new Set(fs.readdirSync(animDir).filter((n) => n.endsWith('.webm')).map((n) => n.replace(/\.webm$/, '')));
const memeDir = abs('dsh-pet-pack/claude-memes');
const memes = new Set(fs.readdirSync(memeDir).filter((n) => n.endsWith('.png')).map((n) => n.replace(/\.png$/, '')));

// ---------------------------------------------------------------- 4. pet-config.json
const petConfig = json['pet-config.json'];
if (!petConfig) {
  err('缺少 pet-config.json');
} else {
  const names = Object.keys(petConfig.names || {});
  for (const code of names) {
    if (!clips.has(code)) err(`pet-config.json 的 names 里有 ${code}「${petConfig.names[code]}」，但 clips/${code}.webm 不存在`);
  }

  const animated = flatten([
    ...(petConfig.animations?.idle || []),
    ...(petConfig.animations?.clicks || []),
    ...(petConfig.animations?.categories || []).map((c) => c.actions),
    ...Object.values(petConfig.animations?.events || {}),
  ]);
  for (const name of animated) {
    if (!names.includes(name)) err(`pet-config.json 的动画引用了「${name}」，但 names 里没有这个名字`);
  }
  ok(`pet-config.json：${names.length} 个动作名、${animated.length} 处引用都有对应文件`);
}

// ---------------------------------------------------------------- 5. pet.js 的 CLIPS / TRANS
const petJsPath = abs('renderer/pet.js');
if (fs.existsSync(petJsPath)) {
  const src = fs.readFileSync(petJsPath, 'utf8');
  const block = (marker) => {
    const at = src.indexOf(marker);
    if (at < 0) return '';
    const rest = src.slice(at + marker.length);
    const end = rest.indexOf('};');
    return end < 0 ? rest : rest.slice(0, end);
  };

  // 动作是 A01…D06，过渡是 X1/X2（只有一位数字），都写在同一个 CLIPS 里
  const clipKeys = [...block('const CLIPS = {').matchAll(/^\s{4}([A-Z]\d{1,2}):\s*\{/gm)].map((m) => m[1]);

  if (!clipKeys.length) err('renderer/pet.js 里没读到 CLIPS，可能改过格式，检查脚本需要更新');

  for (const code of clipKeys) {
    if (!clips.has(code)) err(`renderer/pet.js 引用了 ${code}，但 clips/${code}.webm 不存在`);
  }

  const known = new Set(clipKeys);
  for (const code of clips) {
    if (!known.has(code)) warn(`clips/${code}.webm 没有任何地方引用`);
  }
  ok(`renderer/pet.js：CLIPS 里 ${clipKeys.length} 段（含过渡），文件齐全`);
}

// ---------------------------------------------------------------- 6. DSH 宠物包
const dshConfig = json['dsh-pet-pack/claude-config.json'];
if (!dshConfig) {
  err('缺少 dsh-pet-pack/claude-config.json');
} else {
  const groups = [];
  const a = dshConfig.animations || {};
  const add = (label, values) => {
    for (const name of flatten(values)) groups.push({ label, name });
  };
  add('idle', a.idle);
  add('turn', a.turn);
  add('drag', a.drag);
  add('clicks', a.clicks);
  for (const c of a.categories || []) add(`分组「${c.id}」`, c.actions);
  for (const [key, values] of Object.entries(a.events || {})) add(`事件「${key}」`, values);

  for (const { label, name } of groups) {
    if (!anims.has(name)) err(`DSH 的 ${label} 用了「${name}」，但 dsh-pet-pack/claude-animation/${name}.webm 不存在`);
  }

  // 一个动作只能挂一个分组，否则 DSH 右键菜单会重复
  const seen = new Map();
  for (const { label, name } of groups) {
    if (!seen.has(name)) seen.set(name, []);
    seen.get(name).push(label);
  }
  for (const [name, labels] of seen) {
    if (labels.length > 1) err(`DSH 里「${name}」同时出现在 ${labels.join(' 和 ')}，右键菜单会重复`);
  }

  const unused = [...anims].filter((n) => !seen.has(n));
  for (const n of unused) warn(`dsh-pet-pack/claude-animation/${n}.webm 没有挂进任何分组，DSH 里看不到`);

  const memeEntries = Object.keys(dshConfig.memes || {});
  for (const name of memeEntries) {
    if (!memes.has(name)) err(`DSH 的 memes 里有「${name}」，但 dsh-pet-pack/claude-memes/${name}.png 不存在`);
  }
  const unusedMemes = [...memes].filter((n) => !memeEntries.includes(n));
  for (const n of unusedMemes) warn(`dsh-pet-pack/claude-memes/${n}.png 没有写进 memes 描述，DSH 不会用它`);
  ok(`DSH 宠物包：${groups.length} 处分组引用、${memeEntries.length} 张表情包都有文件`);
}

// ---------------------------------------------------------------- 7. 素材数量（README 里写的数）
const readme = fs.existsSync(abs('README.md')) ? fs.readFileSync(abs('README.md'), 'utf8') : '';
const claimed = readme.match(/现在有\s*(\d+)\s*段动作、\s*(\d+)\s*张表情包/);
if (claimed) {
  const [, actionCount, memeCount] = claimed;
  if (Number(actionCount) !== clips.size) warn(`README 写「${actionCount} 段动作」，clips/ 里实际有 ${clips.size} 段`);
  if (Number(memeCount) !== memes.size) warn(`README 写「${memeCount} 张表情包」，claude-memes/ 里实际有 ${memes.size} 张`);
}

// ---------------------------------------------------------------- 输出
for (const line of passed) console.log(`  ✓ ${line}`);
for (const line of warnings) console.log(`  ! ${line}`);
for (const line of errors) console.log(`  ✗ ${line}`);

console.log('');
if (errors.length) {
  console.log(`检查失败：${errors.length} 个错误${warnings.length ? `、${warnings.length} 个提醒` : ''}。`);
  console.log('加动作的完整步骤见 CONTRIBUTING.md「自己接进去」。');
  process.exit(1);
}
console.log(`检查通过${warnings.length ? `（${warnings.length} 个提醒，不影响合并）` : ''}。`);
