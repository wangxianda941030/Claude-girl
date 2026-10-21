# claude-girl-settings · 在 DSH 设置页里调她

一个很小的 DSH 插件：它**不负责渲染桌宠**，只往 DSH 设置页里加一个「克劳德大小姐」分区，让你图形化地改她的大小、显示方式、位置和三个开关。

渲染、动画、物理、对话仍然全部由 [dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 负责。本插件只把 `$DSH_HOME/dsh-pet/pet/claude-config.json` 里 `pets[0]` 的几个字段当成可编辑配置。

> ⚠️ 实验性。这是给 pet pack 补一个设置入口，改动范围只有那个 JSON 文件的几个字段，但**没有在真实 DSH 里长期跑过**，遇到问题请把 DSH 日志里 `[claude-girl]` 开头的行发出来。

## 能改什么

| 项 | 写进哪个字段 | 说明 |
| --- | --- | --- |
| 大小 | `pets[0].size` | 120–1200，默认 462 |
| 显示方式 | `pets[0].display` | `web` / `desktop` / `both` / `none` |
| 位置 | `pets[0].position` | 四个角落 + 水平/垂直边距 |
| 查余额换表情 | `pets[0].balanceEnabled` | 越用越心虚那一套动作 |
| 自动碎碎念 | `pets[0].whisperEnabled` | |
| 工作状态动作 | `pets[0].workStatusEnabled` | 思考 / 敲键盘 / 等你确认 / 出错 |
| 固定在原地 | `pets[0].fixedEnabled` | 不让她自己走 |

**动画池、台词、表情包说明、碎碎念提示词一个都不动**——保存时只改上面这几个字段，其余原样写回。

## 安装

前提：DSH 里已经装了 dsh-pet，并且她已经在桌面上出现了（也就是跑过 `node install.js --dsh`）。

在 PowerShell 里：

```powershell
& "C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add file:C:\Users\Administrator\Desktop\Claude-girl\dsh-plugin
```

如果 `dsh` 已经在 PATH 里，直接：

```powershell
dsh plugin --profile desktop add file:<仓库路径>\dsh-plugin
```

然后检查 `%USERPROFILE%\.dsh\profiles\desktop\package.json`：

```jsonc
{
  "dependencies": {
    "dsh-pet": "^0.3.7",
    "claude-girl-settings": "file:C:\\Users\\Administrator\\Desktop\\Claude-girl\\dsh-plugin"
  },
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-pet", "claude-girl-settings"]
    }
  }
}
```

`bundles` 里没有 `claude-girl-settings` 的话手动加一行（`add` 命令不一定会替你改这一项）。

**完全退出 DSH 再打开**（托盘图标右键退出，不是关窗口），然后进「设置」，左侧多出一行「克劳德大小姐」。

## 卸载

```powershell
dsh plugin --profile desktop remove claude-girl-settings
```

再把 `bundles` 里那一行删掉、重启 DSH。她本身不受影响，还是照常出现在桌面上。

## 出问题的时候

| 现象 | 原因 / 怎么办 |
| --- | --- |
| 设置里没有「克劳德大小姐」这一行 | 插件没被加载：看 `bundles` 里有没有它，看 DSH 日志有没有 `找不到模块` / `无法解析` |
| 有这一行，但显示「还没找到她的配置文件」 | 宠物包没装：`node install.js --dsh`，然后确认 `%USERPROFILE%\.dsh\dsh-pet\pet\claude-config.json` 存在 |
| 保存成功，但人没变 | 浏览器：刷新页面；桌面端：点「让她重载」，或者 DSH 托盘右键退出再开 |
| 点「让她重载」报错 | 多半是拿不到 DSH 的启动令牌（`authenticatedUrl` 不可用）。手动刷新页面同样生效，`/reload` 只是桌面端的便利入口 |

## 原理（想改的话看这里）

- 宿主半侧 `lib/index.js`：`ctx.webServer.register({ kind: 'prefix', path: '/claude-girl-settings' })`，三个接口：`GET /config`、`PUT /config`、`POST /reload`。写盘 = 临时文件 + `rename`，校验失败不落盘。
- 浏览器半侧 `lib/client.js`：普通脚本，用 `window.__ModuleLoader__.load({ id, factory })` 注册；`factory` 返回 `{ name, inject, apply }`，`apply` 里 `ctx.slots.inject('settings.section', …)` 注册一个分区。
- `cordis.patch.yml` 把这个包挂进 DSH 的配置树，`id` 必须等于包名。
