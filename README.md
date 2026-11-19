# Get Microsoft Rewards

<div align="center">

**微软 Rewards 助手 - 自动完成每日打卡、必应搜索连续打卡与日常任务，配备极简 UI 悬浮窗，一键全自动获取积分。**

[![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)](https://github.com/junyi5d/Get-Microsoft-Rewards)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-v4.0+-orange.svg)](https://www.tampermonkey.net/)

[功能特性](#-功能特性) • [安装使用](#-安装使用) • [使用说明](#-使用说明) • [常见问题](#-常见问题)

</div>

---

## 📸 界面预览

新版界面采用紧凑卡片式悬浮窗：

- **收起状态**：经典白底礼盒图标，默认停靠左下角（可改为右下角）
- **展开状态**：顶部显示会员等级图标与名称（如「🥇 金牌会员」）和积分；等级优先读取 Rewards 页面实际展示，抓不到名称时只显示对应等级图标
- **中部进度**：按按钮顺序排列 —— 打卡任务 / 必应搜索连续打卡 / 日常任务
- **主按钮**：打卡、搜索、任务三个按钮单行排列，下方为一键全部执行
- **运行日志**：默认展开，点击标题可收起
- **设置弹窗**：齿轮按钮打开，可调整图标位置与任务间隔

---

## ✨ 功能特性

### 🎯 核心功能
- ✅ **每日打卡** - 完成「每日连续打卡」，并处理连续打卡任务中的 3 个网页链接（跳过必应应用）
- ✅ **必应搜索连续打卡** - 每天随机执行 1 次真实搜索并上报
- ✅ **日常任务** - 从 [rewards.bing.com/earn](https://rewards.bing.com/earn) 读取日常任务，按可完成与已完成数量统计
- 🚀 **一键全部执行** - 只挑选未完成的任务，随机顺序执行

### 🎨 界面特色
- 🎁 **悬浮窗设计** - 礼盒图标可放置左下角或右下角
- 📊 **实时进度** - 显示会员等级图标与名称、积分，以及打卡 / 搜索 / 任务进度
- ⏳ **折叠倒计时** - 倒计时收进状态栏，不再刷屏日志
- ⚙️ **设置弹窗** - 图形化调整图标位置、任务间隔
- 📝 **可折叠日志** - 默认展开显示当前步骤，可一键收起
- 🌙 **深色适配** - 自动跟随系统深色模式

### 🛡️ 安全特性
- 🔒 **本地运行** - 所有逻辑在浏览器本地执行
- 🎲 **随机间隔** - 打卡与任务采用随机间隔，偶发长停顿，任务顺序也会打乱
- 🎭 **贴近真人** - 提交前随机停留、打开目标页后随机浏览时长，避免机械节奏
- 🌐 **热搜词库** - 使用真实热搜词，搜索更自然
- 🍪 **真实会话** - 复用浏览器登录 Cookie，不伪造 Cookie 头
- 💾 **进度保存** - 刷新页面不丢失进度，自动续接任务

---

## 🔁 自动化基准

脚本以 `rewards.bing.com/earn` 页面实际展示的可赚积分栏目为准，只保留网页可完成的类别：

| 按钮 / 进度条 | 对应页面栏目 | 处理方式 |
| --- | --- | --- |
| 打卡任务 | 连续打卡任务中的「每日连续打卡」及 3 个网页链接 | DAPI 完成每日打卡，并逐个处理搜索 / 每日 / Edge 连续打卡链接，按完成数量统计 |
| 必应搜索连续打卡 | 连续打卡任务中的「必应搜索连续打卡」 | 每天随机搜索 1 次，进度显示今日 0/1 |
| 日常任务 | 「日常任务」板块 | DAPI → Server Action → 旧接口 → 访问目标页，按可完成与已完成数量统计 |
| App / 移动端 / Xbox / 邀请好友 | 相关卡片 | 跳过，不纳入自动执行 |
| 升级里程碑 / 默认搜索引擎 | 「升级活动」板块 | 无法由网页脚本一次完成，跳过 |

> 一键全部执行只会选择当前未完成、且可获得积分的栏目，并以随机顺序执行，模拟真人操作节奏。
> 问卷 / 测验类任务需要人工选择答案，脚本只能尝试自动上报；仅限 App 的任务无法代做。

---

## 📦 安装使用

### 前置要求
- 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/) 浏览器扩展
- Microsoft 账号（已注册 Microsoft Rewards）

### 安装步骤

1. **安装脚本管理器**
   - Chrome/Edge: [Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - Firefox: [Tampermonkey](https://addons.mozilla.org/firefox/addon/tampermonkey/)

2. **安装脚本**
   - 点击安装（实际链接）：
     <https://www.tampermonkey.net/script_installation.php#url=https://github.com/junyi5d/Get-Microsoft-Rewards/raw/refs/heads/main/GetMicrosoftRewards.user.js>
   - 脚本直链：
     <https://github.com/junyi5d/Get-Microsoft-Rewards/raw/refs/heads/main/GetMicrosoftRewards.user.js>
   - 或手动复制 `GetMicrosoftRewards.user.js` 内容到 Tampermonkey 新建脚本

3. **访问 Bing**
   - 打开 [https://www.bing.com](https://www.bing.com) 或 [https://rewards.bing.com](https://rewards.bing.com)
   - 页面左下角会出现礼盒图标 🎁（可在设置中改到右下角）

---

## 🎮 使用说明

### 基础使用

1. **查看进度**
   - 点击礼盒图标展开面板（默认左下角）
   - 查看当前会员等级（如「金牌会员」）、积分、各项任务进度

2. **执行任务**
   - **打卡任务**: 点击 `✅ 打卡` 按钮（需授权），完成每日打卡并处理连续打卡链接
   - **搜索任务**: 点击 `🔍 搜索` 按钮，执行当天唯一一次必应搜索连续打卡
   - **日常任务**: 点击 `🎯 任务` 按钮，执行日常任务板块中可完成的卡片
   - **一键执行**: 点击 `🚀 一键全部执行` 按钮，自动挑选当前未完成的栏目，随机顺序执行

3. **调整设置**
   - 点击面板右上角齿轮按钮（或 Tampermonkey 菜单中的「Microsoft Rewards 设置」）
   - **图标位置**：左下角（默认） / 右下角
   - **任务间隔**：快速（1.2–2.5 秒）、推荐（2–4 秒）、保守（3.5–7 秒），打卡与任务通用且每次随机
   - **微软授权**：显示当前授权状态（已授权 / 未授权），可一键重新授权
   - **Cookie 读取状态**：检测 `GM_cookie` 是否可用（需篡改猴「高级」+「允许脚本访问 Cookie：全部 / All」）
   - 保存后立即生效

4. **收起面板**
   - 点击右上角收起按钮，面板会折叠为悬浮图标

### 授权设置（打卡任务）

打卡任务需要 Microsoft OAuth 授权：

**方法一：通过脚本界面**

1. 点击 `✅ 打卡` 按钮
2. 面板会显示授权区域
3. 点击 `🔗 获取授权码` 按钮
4. 在弹出的新窗口登录微软账号
5. 登录成功后，脚本会自动捕获跳转 URL 中的 `code` 并保存；若未自动保存，可复制完整 URL（包含 `code=M.xxx`）
6. 将 URL 粘贴到输入框，点击 `保存` 按钮
7. 再次点击打卡按钮即可执行

**方法二：直接访问授权链接**

直接访问以下链接获取授权码：

👉 [点击这里获取授权码](https://login.live.com/oauth20_authorize.srf?client_id=0000000040170455&scope=service::prod.rewardsplatform.microsoft.com::MBI_SSL&response_type=code&redirect_uri=https://login.live.com/oauth20_desktop.srf)

登录后复制跳转页面的完整 URL，粘贴到脚本面板的授权输入框即可。

> **提示**: 授权码会自动保存，下次使用无需重复授权（除非 Token 过期）。设置弹窗中可查看授权状态，并点击「重新授权」清除旧授权后重新获取。

> **Cookie 读取（可选）**：脚本需要读取 `rewards.bing.com` 的登录 Cookie 来同步等级与任务进度。若设置中显示「Cookie 读取：不可用」，请按以下步骤开启：
> 1. 打开篡改猴管理面板 → **设置** → **配置模式** → 选择「高级」
> 2. 进入 **安全** 板块 → 将「**允许脚本访问 Cookie**」改为「**全部 / All**」
> 3. 确认扩展拥有 `rewards.bing.com` 的站点访问权限
>
> 普通模式下脚本仍会由 `GM_xmlhttpRequest` 自动携带浏览器 Cookie；高级模式可额外读取 HttpOnly 登录态。

---

## 🔧 高级配置

日常使用直接通过面板右上角的 **设置弹窗** 调整即可，无需改代码：

| 设置项 | 可选值 | 说明 |
| --- | --- | --- |
| 图标位置 | 左下角（默认） / 右下角 | 悬浮图标的停靠位置 |
| 任务间隔 | 快速 / 推荐 / 保守 | 打卡与任务的随机等待区间（1.2–2.5 / 2–4 / 3.5–7 秒），并会偶发额外长停顿 |

设置保存在 `GM_setValue` 中，刷新页面后依然生效。如需修改热搜源或预设区间，可编辑脚本中的 `CONFIG` 与 `PRESETS`：

```javascript
const PRESETS = {
    fast:        { label: '快速', taskMin: 1200, taskMax: 2500 },
    recommended: { label: '推荐', taskMin: 2000, taskMax: 4000 },
    safe:        { label: '保守', taskMin: 3500, taskMax: 7000 }
};
```

---

## ❓ 常见问题

### Q: 搜索任务没有积分？
**A**: 
- 脚本每天只执行 1 次必应搜索连续打卡，确保已登录 **cn.bing.com**（复用浏览器真实 Cookie）
- 检查账号是否被 **风控**；若上报未被接受，稍后再试

### Q: 日常任务显示「提交失败」？
**A**: 
- 部分任务是问卷/测验，需要真实点击选项，脚本只能尝试自动上报
- 确认已登录 rewards.bing.com，并在面板中刷新一次数据
- 任务卡会依次尝试 App 接口、Server Action、旧接口，并回退访问任务页；若账号触发风控会失败

### Q: 连续打卡链接为什么没有全部完成？
**A**: 
- 「Edge 浏览连续打卡」依赖 Edge 客户端的真实使用记录，网页脚本只能尝试打开对应链接
- 「必应应用连续打卡」属于 App 任务，脚本会直接跳过
- 面板进度按页面实际返回的完成数量统计

### Q: 提示「篡改猴没有访问此页面的权限」？
**A**: 
- 这是浏览器扩展缺少 `rewards.bing.com` 站点权限，不是脚本本身的问题
- Chrome：打开 `chrome://extensions`（Edge 为 `edge://extensions`）→ 找到 Tampermonkey / 篡改猴 → 详细信息 → 网站访问权限 → 选择「在所有网站上」，或在「在特定网站上」添加 `https://rewards.bing.com`
- Violentmonkey 同理，在扩展详情里把站点访问权限放开即可
- 保存后刷新 rewards.bing.com，图标就会正常显示；即使不给该站点权限，也可以在 bing.com 页面打开面板，数据仍可通过脚本后台请求获取

### Q: 设置里显示「Cookie 读取：不可用」？
**A**: 
- 篡改猴管理面板 → 设置 → 配置模式 → 选择「高级」
- 再进入 **安全** 板块 → 将「**允许脚本访问 Cookie**」改为「**全部 / All**」
- 同时确认扩展拥有 `rewards.bing.com` 的站点访问权限（见上一条）
- 若仍不可用，脚本会改用 `GM_xmlhttpRequest` 自动携带的浏览器 Cookie，不影响搜索和任务；等级可优先从当前页面读取

### Q: 打卡任务失败？
**A**: 
1. 确认已正确获取并保存授权码
2. 检查授权码是否过期（Token 有效期约 1 小时）
3. 尝试重新获取授权码
4. 连续打卡链接依赖页面 Cookie，若 Cookie 读取不可用，可在设置中开启「允许脚本访问 Cookie」

### Q: 脚本不显示/无法点击？
**A**: 
1. 确认已安装 Tampermonkey 并启用脚本
2. 刷新页面（Ctrl+F5 强制刷新）
3. 检查浏览器控制台是否有报错

### Q: 如何卸载？
**A**: 
- 打开 Tampermonkey 管理面板
- 找到 "Get Microsoft Rewards" 脚本
- 点击删除即可

---

## 📊 技术栈

- **核心**: 原生 JavaScript (ES6+)
- **网络请求**: `GM_xmlhttpRequest`
- **存储**: `GM_setValue` / `GM_getValue`
- **通知**: `GM_notification`
- **Cookie**: `GM_cookie`（读取登录态，需在篡改猴开启「高级」配置模式与「允许脚本访问 Cookie：全部 / All」）

---

## 🤝 贡献

欢迎提交 [Issue](https://github.com/junyi5d/Get-Microsoft-Rewards/issues) 和 [Pull Request](https://github.com/junyi5d/Get-Microsoft-Rewards/pulls)！

1. [Fork 本仓库](https://github.com/junyi5d/Get-Microsoft-Rewards/fork)
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

---

## ⚠️ 免责声明

- 本脚本仅供学习交流使用，请勿用于商业用途
- 使用本脚本产生的任何后果由使用者自行承担
- 请遵守 Microsoft Rewards 服务条款，合理使用
- 作者不对账号封禁、积分清零等问题负责

---

## 💖 支持

如果这个项目对您有帮助，欢迎：

- ⭐ Star [本仓库](https://github.com/junyi5d/Get-Microsoft-Rewards)
- 🐛 [提交 Bug 报告](https://github.com/junyi5d/Get-Microsoft-Rewards/issues/new)
- 💡 [提出新功能建议](https://github.com/junyi5d/Get-Microsoft-Rewards/issues/new)
- 📣 分享给更多人

---

<div align="center">

**Made with ❤️ by QingJ · junyi5d**

[⬆ 回到顶部](#get-microsoft-rewards)

</div>
