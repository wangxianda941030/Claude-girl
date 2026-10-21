<div align="center">

# 克劳德大小姐 · Claude-girl

**一只住在桌面上的 Q 版橘发茶会大小姐，跟着 Claude 一起干活、喝茶、查额度、阴阳怪气。**

中文 · [English](README.en.md)

![克劳德大小姐](docs/banner.png)

</div>

> 🤖 **让 AI 帮你装**：把下面这句话发给 Claude Code、DeepSeek Harness 或任何能跑命令的 Agent：
>
> ```
> 帮我安装克劳德大小姐桌宠：https://github.com/wangxianda941030/Claude-girl ，按仓库里 AGENTS.md 的步骤来。
> ```

## 她会做什么

- **跟着 Claude 干活**：你发消息她托腮思考（想太久会头顶冒烟），Claude 调工具她敲小键盘，等你确认她双手合十，做完了开心挥手，出错了冒汗道歉。
- **查额度，两个版本**：
  - Claude 版查**余量**：Pro / Max 订阅的 5 小时、本周额度还剩多少，自动读 Claude Code 的登录，不用填 Key。
  - DSH 版查**余额**：DeepSeek 账户还剩多少钱。
  - 用得越多她越心虚：腹黑微笑 → 喝茶 → 捧茶 → 限额了五小时后见 → 茶杯空了 → 号又没了 / 钱包倒空。
- **平时**：翻书、礼貌婉拒、掏出一本巨厚的《行为准则》、喝茶、托腮发呆，每隔几分钟按时段碎碎念一句。
- **作息**：每天第一次见面伸懒腰说早安，离开半小时回来挥手欢迎，凌晨还在用就揉眼睛催你睡觉。
- **互动**：点她会炸毛、害羞，或者星星眼说「你说得完全正确！」。拖着她走、用力甩出去会撞墙反弹，透明的地方鼠标直接穿过去。
- **聊天**：双击她打开对话框，支持 Claude 官方接口和 OpenAI 兼容接口（DeepSeek、中转站都行）。
- **表情包**：DSH 版的碎碎念和对话会配她自己的表情包。

## 安装

需要 [Node.js](https://nodejs.org) 18 以上。

```bash
git clone https://github.com/wangxianda941030/Claude-girl.git
cd Claude-girl
node install.js
```

`install.js` 会自动检测你装了什么，然后接上能接的：

| 你装了 | 它会做 |
| --- | --- |
| **Claude Code** | 加 hook：跟着 Claude Code 的状态做动作；打开 Claude Code 时她不在就自动叫出来 |
| **Claude 桌面端** | 加 MCP 插件：在聊天里说「让桌宠喝口茶」「让她查下余量」她就会动 |
| **DeepSeek Harness** | 作为 [dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的额外宠物装进去，DSH 里右键「重载配置」就出现 |

只想装其中一个就加参数：`--claude-code`、`--claude-desktop`、`--dsh`。国内网络加 `--cn` 用镜像下载 Electron。卸载：`node install.js --uninstall`。

Windows 用户也可以直接双击 `install.bat`。改动 Claude 的配置文件前都会先备份成 `.bak`。

装完以后：Claude Code 重开一次；Claude 桌面端要完全退出（托盘图标右键退出）再打开。

## 右键菜单

打开 Claude · 查看余量 · 碎碎念 · 对话 · 回到初始位置 · 重载配置 · 动作（按分组点播每一个动作）· 设置（大小、额度来源、安静模式、自动碎碎念、能不能甩、跟着 Claude Code 自动出现、总在最前）

## 自己改

- **动作分组和台词**：`pet-config.json`（Claude 版）和 `dsh-pet-pack/claude-config.json`（DSH 版）。改完右键「重载配置」，不用重启。
- **本机接口**：`127.0.0.1:47321`，只接受本机访问：`/ping`、`/play?clip=C01`、`/say?text=你好`、`/state?s=thinking`、`/balance`、`POST /hook`。

## 一起来加表情和动作 🙌

现在有 25 段动作、9 张表情包，想要更多。新表情、新动作、新梗都欢迎，素材怎么做、怎么提交见 [CONTRIBUTING.md](CONTRIBUTING.md)。生成用的提示词都在 [`prompts/`](prompts/)，处理工具在 [`tools/`](tools/)。

不想写代码也行：开一个 [Issue](../../issues/new/choose) 把图或视频丢上来，我们帮你接进去。

## 想一起维护？

- **只投稿**：开 [Issue](../../issues/new/choose) 就行，不用会 git、不用碰代码。新动作、新表情包、新台词、英文翻译都收。
- **想直接改这个仓库**：在 Issue 里说一声你的 GitHub 用户名，我们把你加成协作者，之后就能自己 push、自己合并别人的 PR。
- **随便聊聊**：去 [Discussions](../../discussions) 开帖，比 Issue 随意，问怎么装、想个新梗都可以。

每一次 PR 都会自动跑 [静态检查](../../actions/workflows/check.yml)（动作名和视频文件对不对得上、有没有漏进分组），过了才合。

## 致谢

- **灵感和 DSH 版**：[PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)（蓝色大肥鱼）。菜单结构、动作分组和事件档位的设计，DSH 版的宠物包格式，以及按色相抠绿幕的方法，都是跟它学的。DSH 版直接跑在 dsh-pet 里。
- **形象**：克劳德大小姐的形象由百度贴吧的朋友们共创。
- 动画用即梦 / Seedance 图生视频生成，表情包用 GPT 生成。

## 声明

这是粉丝做的非官方项目，和 Anthropic、DeepSeek 没有任何关系。「Claude」是 Anthropic 的商标，这里只用来说明它能和什么软件一起用。查 Claude 余量用的是 Claude Code 自己查 `/usage` 的接口，没有公开文档，以后可能会变。

## 许可

- 代码：[MIT](LICENSE)
- 形象、动画、表情包等美术素材：[CC BY-NC 4.0](ASSETS_LICENSE.md)，可以转载、二创，请注明出处，不能商用。
