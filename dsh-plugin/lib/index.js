/**
 * claude-girl-settings —— 宿主半侧
 *
 * 只做一件事：给「克劳德大小姐」这个 pet pack 开三个本机路由，让 DSH 设置页能读写她的配置。
 *
 *   GET  /claude-girl-settings/config   读 $DSH_HOME/dsh-pet/pet/claude-config.json
 *   PUT  /claude-girl-settings/config   只改 pets[0] 的大小 / 位置 / 显示方式 / 三个开关，其余字段原样保留
 *   POST /claude-girl-settings/reload   尽力让 dsh-pet 重载（桌面端会重启它的 helper；浏览器要刷新页面）
 *
 * 她怎么渲染、怎么播动画仍然完全由 dsh-pet 负责；本插件不碰素材、不碰动画池，
 * 只把她那个 JSON 文件当成可编辑的配置文件。写盘走「临时文件 + rename」，避免写一半断电把配置写坏。
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const name = 'claude-girl-settings';

// webServer：注册本机路由。connection 不写进 inject——它只在 web / 桌面 profile 里存在，
// 写进依赖会让插件在 headless 之类没有它的 profile 里直接不加载；真正要用时按可选服务取。
export const inject = ['webServer'];

const ROUTE = '/claude-girl-settings';
const MAX_BODY = 64 * 1024;
const PET_PACK = path.join('dsh-pet', 'pet', 'claude-config.json');

const DISPLAYS = new Set(['web', 'desktop', 'both', 'none']);
const CORNERS = new Set(['top-left', 'top-right', 'bottom-left', 'bottom-right']);

function dshHome() {
  const fromEnv = typeof process.env.DSH_HOME === 'string' ? process.env.DSH_HOME.trim() : '';
  return fromEnv || path.join(os.homedir(), '.dsh');
}

function packFile() {
  return path.join(dshHome(), PET_PACK);
}

function readConfig(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeConfig(file, data) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, '.claude-config.' + process.pid + '.' + Date.now() + '.tmp');
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

/** 从成品配置里摘出设置页要显示的字段（读不到就给内置默认） */
function viewOf(data) {
  const pet = Array.isArray(data.pets) && data.pets[0] ? data.pets[0] : {};
  const pos = pet.position && typeof pet.position === 'object' ? pet.position : {};
  return {
    name: typeof pet.name === 'string' ? pet.name : '克劳德大小姐',
    id: typeof pet.id === 'string' ? pet.id : 'claude-girl',
    size: Number.isFinite(pet.size) ? pet.size : 462,
    display: DISPLAYS.has(pet.display) ? pet.display : 'both',
    corner: CORNERS.has(pos.corner) ? pos.corner : 'bottom-right',
    marginX: Number.isFinite(pos.marginX) ? pos.marginX : 24,
    marginY: Number.isFinite(pos.marginY) ? pos.marginY : 40,
    balanceEnabled: pet.balanceEnabled !== false,
    whisperEnabled: pet.whisperEnabled !== false,
    workStatusEnabled: pet.workStatusEnabled !== false,
    fixedEnabled: pet.fixedEnabled === true,
  };
}

/**
 * 把页面提交的字段合并进 pets[0]，其余字段（动画池、台词、表情包说明…）一个都不动。
 * 校验失败返回 errors，调用方回 400，绝对不写盘。
 */
function mergeSettings(data, input) {
  const errors = [];
  const next = JSON.parse(JSON.stringify(data));
  if (!Array.isArray(next.pets) || next.pets.length === 0) next.pets = [{}];
  const pet = next.pets[0] && typeof next.pets[0] === 'object' ? next.pets[0] : (next.pets[0] = {});
  pet.position = pet.position && typeof pet.position === 'object' ? pet.position : {};

  if (input.size !== undefined) {
    const n = Number(input.size);
    if (!Number.isFinite(n) || n < 120 || n > 1200) errors.push('大小要填 120 到 1200 之间的数字');
    else pet.size = Math.round(n);
  }
  if (input.display !== undefined) {
    if (!DISPLAYS.has(input.display)) errors.push('显示方式只能是 web / desktop / both / none');
    else pet.display = input.display;
  }
  if (input.corner !== undefined) {
    if (!CORNERS.has(input.corner)) errors.push('角落只能是 top-left / top-right / bottom-left / bottom-right');
    else pet.position.corner = input.corner;
  }
  for (const key of ['marginX', 'marginY']) {
    if (input[key] === undefined) continue;
    const n = Number(input[key]);
    if (!Number.isFinite(n) || n < 0 || n > 4000) errors.push(key + ' 要填 0 到 4000 之间的数字');
    else pet.position[key] = Math.round(n);
  }
  for (const key of ['balanceEnabled', 'whisperEnabled', 'workStatusEnabled', 'fixedEnabled']) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== 'boolean') errors.push(key + ' 只能是 true / false');
    else pet[key] = input[key];
  }

  return { errors, next };
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('请求体太大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** 调 dsh-pet 的重载接口。拿不到带令牌的 URL 就退回裸地址，失败也不影响保存结果。 */
async function askDshPetReload(ctx) {
  const port = typeof ctx.webServer?.port === 'number' ? ctx.webServer.port : 0;
  if (!port) return { ok: false, detail: 'DSH 的端口还没就绪，先刷新页面再试' };
  const origin = 'http://127.0.0.1:' + port;
  let base = origin;
  let authenticated = null;
  try {
    const connection = ctx.get ? ctx.get('connection', false) : ctx.connection;
    authenticated = connection?.authenticatedUrl?.(origin);
  } catch {
    /* 拿不到令牌就用裸 origin，下面失败会被 catch 住 */
  }
  if (typeof authenticated === 'string' && authenticated) base = authenticated.replace(/\/$/, '');
  try {
    const res = await fetch(base + '/dsh-pet-7340/reload', { method: 'POST' });
    return res.ok
      ? { ok: true, detail: '已让 dsh-pet 重载：桌面上的她会按新尺寸重开，浏览器里刷新页面即可看到' }
      : { ok: false, detail: 'dsh-pet 重载接口返回 ' + res.status + '（浏览器里刷新页面同样生效）' };
  } catch (e) {
    return { ok: false, detail: '没联系上 dsh-pet（' + (e && e.message ? e.message : String(e)) + '），刷新页面即可' };
  }
}

export function apply(ctx) {
  async function handle(req, res, urlPath) {
    const file = packFile();

    if (urlPath === '/config' && req.method === 'GET') {
      if (!fs.existsSync(file)) {
        return sendJson(res, 404, {
          ok: false,
          file,
          error: '还没找到她的配置文件。先跑一次仓库根目录的 node install.js --dsh，把宠物包装进 DSH。',
        });
      }
      try {
        const data = readConfig(file);
        return sendJson(res, 200, { ok: true, file, data, view: viewOf(data) });
      } catch (e) {
        return sendJson(res, 500, { ok: false, file, error: '配置文件读不出来：' + e.message });
      }
    }

    if (urlPath === '/config' && req.method === 'PUT') {
      if (!fs.existsSync(file)) {
        return sendJson(res, 404, { ok: false, file, error: '还没找到她的配置文件，先跑 node install.js --dsh' });
      }
      let input;
      try {
        input = JSON.parse((await readBody(req)) || '{}');
      } catch {
        return sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON' });
      }
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return sendJson(res, 400, { ok: false, error: '请求体要是一个对象' });
      }

      let current;
      try {
        current = readConfig(file);
      } catch (e) {
        return sendJson(res, 500, { ok: false, file, error: '配置文件读不出来：' + e.message });
      }

      const { errors, next } = mergeSettings(current, input);
      if (errors.length) return sendJson(res, 400, { ok: false, errors, error: errors.join('；') });

      try {
        writeConfig(file, next);
      } catch (e) {
        return sendJson(res, 500, { ok: false, file, error: '写不进去：' + e.message });
      }

      ctx.logger?.info?.('[claude-girl] 配置已保存：' + file);
      return sendJson(res, 200, { ok: true, file, data: next, view: viewOf(next) });
    }

    if (urlPath === '/reload' && req.method === 'POST') {
      const result = await askDshPetReload(ctx);
      return sendJson(res, 200, result);
    }

    return sendJson(res, 404, { ok: false, error: '没有这个接口：' + urlPath });
  }

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: ROUTE,
        handler: async (req, res) => {
          try {
            const raw = String(req.url || '/');
            // 前缀路由拿到的 url 可能带也可能不带前缀，两种都认
            let urlPath = raw.startsWith(ROUTE) ? raw.slice(ROUTE.length) : raw;
            urlPath = urlPath.split('?')[0] || '/';
            if (urlPath.length > 1 && urlPath.endsWith('/')) urlPath = urlPath.slice(0, -1);
            await handle(req, res, urlPath);
          } catch (e) {
            try {
              sendJson(res, 500, { ok: false, error: e && e.message ? e.message : String(e) });
            } catch {
              /* 响应已经发出去或者连接断了，忽略 */
            }
          }
        },
      }),
    'claude-girl: settings route',
  );

  ctx.logger?.info?.('[claude-girl] 设置页接口已挂上：' + ROUTE);
}
