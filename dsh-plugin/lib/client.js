/**
 * claude-girl-settings —— 浏览器半侧
 *
 * 往 DSH 设置页里加一个「克劳德大小姐」分区：大小、显示方式、位置、三个开关。
 * 加载方式与 dsh-pet 相同：普通脚本，不写顶层 import/export，靠 window.__ModuleLoader__.load 注册。
 */
;(function () {
  if (typeof window === 'undefined' || !window.__ModuleLoader__) {
    console.warn('[claude-girl] __ModuleLoader__ 不存在，设置页没有注册');
    return;
  }

  var API = '/claude-girl-settings';

  var LABEL_BASE = 'var(--dsw-alias-label-primary, #111)';
  var LABEL_TER = 'var(--dsw-alias-label-tertiary, #6b7280)';
  var BORDER = 'var(--dsw-alias-border-l2, #d8dbe0)';

  var S = {
    wrap: { maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 14, color: LABEL_BASE, fontSize: 13, lineHeight: '20px' },
    title: { fontSize: 14, fontWeight: 600, margin: 0 },
    desc: { margin: 0, color: LABEL_TER, fontSize: 12 },
    card: { border: '1px solid ' + BORDER, borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 },
    row: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
    label: { minWidth: 76, color: LABEL_TER, fontSize: 12 },
    input: {
      height: 28,
      width: 96,
      padding: '0 8px',
      border: '1px solid ' + BORDER,
      borderRadius: 8,
      background: 'var(--dsw-alias-bg-layer-1, #fff)',
      color: LABEL_BASE,
      fontSize: 13,
      outline: 'none',
    },
    select: {
      height: 28,
      padding: '0 6px',
      border: '1px solid ' + BORDER,
      borderRadius: 8,
      background: 'var(--dsw-alias-bg-layer-1, #fff)',
      color: LABEL_BASE,
      fontSize: 13,
      outline: 'none',
    },
    check: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 },
    btn: {
      height: 28,
      padding: '0 12px',
      border: '1px solid ' + BORDER,
      borderRadius: 8,
      background: 'var(--dsw-alias-bg-layer-1, #fff)',
      color: LABEL_BASE,
      fontSize: 12,
      cursor: 'pointer',
    },
    btnPrimary: {
      height: 28,
      padding: '0 14px',
      border: '1px solid var(--dsw-alias-state-business-primary, #4d6bfe)',
      borderRadius: 8,
      background: 'var(--dsw-alias-state-business-primary, #4d6bfe)',
      color: '#fff',
      fontSize: 12,
      cursor: 'pointer',
    },
    ok: { color: 'var(--dsw-alias-state-success-primary, #0a7d32)', fontSize: 12 },
    err: { color: 'var(--dsw-alias-state-error-primary, #c62828)', fontSize: 12 },
    hint: { color: LABEL_TER, fontSize: 12, margin: 0 },
  };

  var DISPLAY_OPTIONS = [
    ['both', '浏览器 + 桌面'],
    ['web', '只在浏览器里'],
    ['desktop', '只在桌面上'],
    ['none', '先藏起来'],
  ];

  var CORNER_OPTIONS = [
    ['bottom-right', '右下角'],
    ['bottom-left', '左下角'],
    ['top-right', '右上角'],
    ['top-left', '左上角'],
  ];

  window.__ModuleLoader__.load({
    id: 'claude-girl-settings',
    factory: function (require) {
      var React = require('react');
      var h = React.createElement;
      var useState = React.useState;
      var useEffect = React.useEffect;
      var useCallback = React.useCallback;

      function row(labelText, children) {
        return h('div', { style: S.row }, h('span', { style: S.label }, labelText), children);
      }

      function numberInput(value, onChange, props) {
        return h('input', {
          type: 'number',
          style: S.input,
          value: value === null || value === undefined ? '' : String(value),
          onChange: function (e) {
            onChange(e.target.value);
          },
          ...(props || {}),
        });
      }

      function Section() {
        var [loading, setLoading] = useState(true);
        var [error, setError] = useState(null);
        var [flash, setFlash] = useState(null);
        var [busy, setBusy] = useState(false);
        var [form, setForm] = useState(null);

        var load = useCallback(function () {
          setLoading(true);
          setFlash(null);
          fetch(API + '/config', { headers: { accept: 'application/json' }, credentials: 'same-origin' })
            .then(function (r) {
              return r.json().then(function (j) {
                return { status: r.status, body: j };
              });
            })
            .then(function (res) {
              if (!res.body || !res.body.ok) {
                setError((res.body && res.body.error) || '读取失败（HTTP ' + res.status + '），看看 DSH 日志里有没有 claude-girl 的报错');
                setLoading(false);
                return;
              }
              var v = res.body.view;
              setForm({
                size: v.size,
                display: v.display,
                corner: v.corner,
                marginX: v.marginX,
                marginY: v.marginY,
                balanceEnabled: v.balanceEnabled,
                whisperEnabled: v.whisperEnabled,
                workStatusEnabled: v.workStatusEnabled,
                fixedEnabled: v.fixedEnabled,
                __file: res.body.file,
              });
              setError(null);
              setLoading(false);
            })
            .catch(function (e) {
              setError('连不上本机接口：' + (e && e.message ? e.message : String(e)));
              setLoading(false);
            });
        }, []);

        useEffect(function () {
          load();
        }, []);

        var set = function (key, value) {
          setForm(function (prev) {
            var next = { ...prev };
            next[key] = value;
            return next;
          });
          setFlash(null);
        };

        var save = function () {
          setBusy(true);
          setFlash(null);
          var payload = {
            size: Number(form.size),
            display: form.display,
            corner: form.corner,
            marginX: Number(form.marginX),
            marginY: Number(form.marginY),
            balanceEnabled: !!form.balanceEnabled,
            whisperEnabled: !!form.whisperEnabled,
            workStatusEnabled: !!form.workStatusEnabled,
            fixedEnabled: !!form.fixedEnabled,
          };
          fetch(API + '/config', {
            method: 'PUT',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { status: r.status, body: j };
              });
            })
            .then(function (res) {
              setBusy(false);
              if (!res.body || !res.body.ok) {
                setFlash({ type: 'err', text: (res.body && (res.body.error || (res.body.errors || []).join('；'))) || '保存失败（HTTP ' + res.status + '）' });
                return;
              }
              setFlash({ type: 'ok', text: '已保存。浏览器里刷新页面生效；桌面上的她点下面的「让她重载」' });
            })
            .catch(function (e) {
              setBusy(false);
              setFlash({ type: 'err', text: '保存失败：' + (e && e.message ? e.message : String(e)) });
            });
        };

        var reload = function () {
          setBusy(true);
          setFlash(null);
          fetch(API + '/reload', { method: 'POST', credentials: 'same-origin' })
            .then(function (r) {
              return r.json();
            })
            .then(function (body) {
              setBusy(false);
              setFlash({ type: body && body.ok ? 'ok' : 'err', text: (body && body.detail) || '重载完成' });
            })
            .catch(function (e) {
              setBusy(false);
              setFlash({ type: 'err', text: '重载失败：' + (e && e.message ? e.message : String(e)) });
            });
        };

        if (loading) return h('div', { style: S.wrap }, h('p', { style: S.desc }, '读取她的配置…'));

        if (error) {
          return h(
            'div',
            { style: S.wrap },
            h('h3', { style: S.title }, '克劳德大小姐'),
            h('p', { style: S.err }, error),
            h('p', { style: S.hint }, '如果提示找不到配置文件：先在仓库根目录跑一次 node install.js --dsh，她会装到 $DSH_HOME/dsh-pet/pet/ 下面。'),
            h('div', { style: S.row }, h('button', { style: S.btn, onClick: load }, '重试')),
          );
        }

        return h(
          'div',
          { style: S.wrap },
          h('h3', { style: S.title }, '克劳德大小姐'),
          h('p', { style: S.desc }, '这里的改动只写她自己的 claude-config.json（动画、台词、表情包说明都不动）。保存后浏览器刷新页面生效；桌面上的她要点一次「让她重载」。'),

          h(
            'div',
            { style: S.card },
            row('大小', numberInput(form.size, function (v) { set('size', v); }, { min: 120, max: 1200, step: 10 })),
            row(
              '显示方式',
              h(
                'select',
                { style: S.select, value: form.display, onChange: function (e) { set('display', e.target.value); } },
                DISPLAY_OPTIONS.map(function (opt) {
                  return h('option', { key: opt[0], value: opt[0] }, opt[1]);
                }),
              ),
            ),
            row(
              '位置',
              h(
                'select',
                { style: S.select, value: form.corner, onChange: function (e) { set('corner', e.target.value); } },
                CORNER_OPTIONS.map(function (opt) {
                  return h('option', { key: opt[0], value: opt[0] }, opt[1]);
                }),
              ),
              h('span', { style: S.label }, '水平边距'),
              numberInput(form.marginX, function (v) { set('marginX', v); }, { min: 0, max: 4000, step: 4 }),
              h('span', { style: S.label }, '垂直边距'),
              numberInput(form.marginY, function (v) { set('marginY', v); }, { min: 0, max: 4000, step: 4 }),
            ),
          ),

          h(
            'div',
            { style: S.card },
            h(
              'label',
              { style: S.check },
              h('input', { type: 'checkbox', checked: form.balanceEnabled, onChange: function (e) { set('balanceEnabled', e.target.checked); } }),
              '查余额时换表情（越用越心虚那一套）',
            ),
            h(
              'label',
              { style: S.check },
              h('input', { type: 'checkbox', checked: form.whisperEnabled, onChange: function (e) { set('whisperEnabled', e.target.checked); } }),
              '自动碎碎念',
            ),
            h(
              'label',
              { style: S.check },
              h('input', { type: 'checkbox', checked: form.workStatusEnabled, onChange: function (e) { set('workStatusEnabled', e.target.checked); } }),
              '跟着工作状态做动作（思考 / 敲键盘 / 等你确认 / 出错）',
            ),
            h(
              'label',
              { style: S.check },
              h('input', { type: 'checkbox', checked: form.fixedEnabled, onChange: function (e) { set('fixedEnabled', e.target.checked); } }),
              '固定在原地（不让她自己走）',
            ),
          ),

          h(
            'div',
            { style: S.row },
            h('button', { style: S.btnPrimary, disabled: busy, onClick: save }, busy ? '处理中…' : '保存'),
            h('button', { style: S.btn, disabled: busy, onClick: reload }, '让她重载'),
            h('button', { style: S.btn, disabled: busy, onClick: load }, '重新读取'),
          ),

          flash ? h('p', { style: flash.type === 'ok' ? S.ok : S.err }, flash.text) : null,
          form.__file ? h('p', { style: S.hint }, '配置文件：' + form.__file) : null,
        );
      }

      function apply(ctx) {
        ctx.slots.inject('settings.section', function* () {
          yield ctx.slots.register(
            {
              name: 'settings.section',
              id: 'claude-girl-config',
              order: 31,
              label: function () {
                return '克劳德大小姐';
              },
            },
            Section,
          );
        });
      }

      return { name: 'claude-girl-settings', inject: ['slots'], apply: apply };
    },
  });
})();
