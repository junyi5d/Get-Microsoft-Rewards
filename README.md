# Get Microsoft Rewards

<div align="center">

**微软 Rewards 助手 - 自动完成搜索、活动、签到、阅读任务，配备极简 UI 悬浮窗，一键全自动获取积分。**

[![Version](https://img.shields.io/badge/version-1.1.4-blue.svg)](https://github.com/junyi5d/Get-Microsoft-Rewards)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-v4.0+-orange.svg)](https://www.tampermonkey.net/)

[功能特性](#-功能特性) • [安装使用](#-安装使用) • [使用说明](#-使用说明) • [常见问题](#-常见问题)

</div>

---

## 📸 界面预览

新版界面采用紧凑卡片式悬浮窗：

- **收起状态**：经典白底礼盒图标，默认停靠左下角（可改为右下角）
- **展开状态**：顶部显示会员等级（如「金牌会员」）、连续打卡天数与积分；等级以 Rewards 看板为准，抓不到名称时显示奖牌图标
- **中部进度**：按按钮顺序排列 —— 阅读 / PC 搜索 / 活动 / Edge 时长
- **运行状态**：日志默认展开，逐条显示当前处理到哪一步；倒计时收在状态栏
- **运行日志**：默认展开，点击标题可收起
- **设置弹窗**：齿轮按钮打开，可调整图标位置、任务间隔与自动暂停

---

## ✨ 功能特性

### 🎯 核心功能
- ✅ **PC 搜索任务** - 自动完成每日 PC 端搜索（按 Rewards 实际额度）
- ✅ **每日活动** - 从 [rewards.bing.com/dashboard](https://rewards.bing.com/dashboard) 读取任务，多通道自动上报
- ✅ **每日签到** - 自动签到获取奖励积分（需授权）
- ✅ **阅读任务** - 自动完成阅读文章任务（需授权）
- 🚀 **一键全部执行** - 点击一次，自动完成所有任务

### 🎨 界面特色
- 🎁 **悬浮窗设计** - 礼盒图标可放置左下角或右下角
- 📊 **实时进度** - 显示会员等级名称（以 Rewards 页面为准）、连续打卡天数、积分和各项任务进度
- 🌐 **Edge 时长展示** - 显示 Edge 30 分钟任务进度（由 Edge 客户端统计，脚本不代刷）
- ⏳ **折叠倒计时** - 倒计时收进状态栏，不再刷屏日志
- ⚙️ **设置弹窗** - 图形化调整图标位置、任务间隔、自动暂停
- 📝 **可折叠日志** - 默认展开显示当前步骤，可一键收起
- 🌙 **深色适配** - 自动跟随系统深色模式

### 🛡️ 安全特性
- 🔒 **本地运行** - 所有逻辑在浏览器本地执行
- 🎲 **随机间隔** - 搜索、阅读、活动均为随机间隔，偶发长停顿，任务顺序也会打乱
- 🎭 **贴近真人** - 提交前随机停留、打开目标页后随机浏览时长，避免机械节奏
- 🌐 **热搜词库** - 使用真实热搜词，搜索更自然
- 🍪 **真实会话** - 复用浏览器登录 Cookie，不伪造 Cookie 头
- ⏸️ **分段暂停** - 按预设连续搜索后自动休息，降低风控风险
- 💾 **进度保存** - 刷新页面不丢失进度，自动续接任务

---

## 🔁 自动化基准

脚本以 `rewards.bing.com/dashboard` 的任务区为准，按类别处理：

| 任务类别 | 处理方式 |
| --- | --- |
| 每日签到 | 通过 DAPI 上报 |
| 阅读任务 | 按页面给出的步数分步上报 |
| PC 搜索 | 使用真实登录会话在 cn.bing.com 搜索并上报计分 |
| 每日活动 / 更多活动 | DAPI → Server Action → 旧接口 → 访问目标页 |
| Edge 30 分钟 | 仅展示进度（由 Edge 客户端计时，脚本不代刷） |
| 连续打卡 | 以看板显示的天数为准，本地记录仅作兜底 |

> 问卷 / 测验类活动需要人工选择答案，脚本只能尝试自动上报；Edge 时长及仅限 App 的任务无法代做。

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
   - 点击 [安装链接](https://www.tampermonkey.net/script_installation.php#url=https://github.com/junyi5d/get-microsoft-rewards/raw/refs/heads/main/GetMicrosoftRewards.user.js)
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

2. **执行任务**（顺序：签到 → 阅读 → 搜索 → 活动）
   - **签到任务**: 点击 `✅ 签到` 按钮（需授权）
   - **阅读任务**: 点击 `📖 阅读` 按钮（需授权）
   - **搜索任务**: 点击 `🔍 搜索` 按钮
   - **活动任务**: 点击 `🎯 活动` 按钮
   - **一键执行**: 点击 `🚀 一键全部执行` 按钮，按上述顺序自动执行

3. **调整设置**
   - 点击面板右上角齿轮按钮（或 Tampermonkey 菜单中的「Microsoft Rewards 设置」）
   - **图标位置**：左下角（默认） / 右下角
   - **任务间隔**：快速（搜索 12–22 秒、任务 1.2–2.5 秒）、推荐（22–45 秒、2–4 秒）、保守（45–80 秒、3.5–7 秒），搜索、阅读、活动通用且每次随机
   - **自动分段暂停**：按当前预设的节奏休息，降低风控风险
   - 保存后立即生效

4. **收起面板**
   - 点击右上角收起按钮，面板会折叠为悬浮图标

### 授权设置（签到/阅读任务）

签到和阅读任务需要 Microsoft OAuth 授权：

**方法一：通过脚本界面**

1. 点击 `✅ 签到` 或 `📖 阅读` 按钮
2. 面板会显示授权区域
3. 点击 `🔗 获取授权码` 按钮
4. 在弹出的新窗口登录微软账号
5. 登录成功后，脚本会自动捕获跳转 URL 中的 `code` 并保存；若未自动保存，可复制完整 URL（包含 `code=M.xxx`）
6. 将 URL 粘贴到输入框，点击 `保存` 按钮
7. 再次点击签到/阅读按钮即可执行

**方法二：直接访问授权链接**

直接访问以下链接获取授权码：

👉 [点击这里获取授权码](https://login.live.com/oauth20_authorize.srf?client_id=0000000040170455&scope=service::prod.rewardsplatform.microsoft.com::MBI_SSL&response_type=code&redirect_uri=https://login.live.com/oauth20_desktop.srf)

登录后复制跳转页面的完整 URL，粘贴到脚本面板的授权输入框即可。

> **提示**: 授权码会自动保存，下次使用无需重复授权（除非 Token 过期）

---

## 🔧 高级配置

日常使用直接通过面板右上角的 **设置弹窗** 调整即可，无需改代码：

| 设置项 | 可选值 | 说明 |
| --- | --- | --- |
| 图标位置 | 左下角（默认） / 右下角 | 悬浮图标的停靠位置 |
| 任务间隔 | 快速 / 推荐 / 保守 | 搜索、阅读、活动的随机等待区间（12–22 / 22–45 / 45–80 秒与对应任务区间），并会偶发额外长停顿 |
| 自动分段暂停 | 开 / 关 | 按预设节奏在连续搜索后自动休息 |

设置保存在 `GM_setValue` 中，刷新页面后依然生效。如需修改热搜源或预设区间，可编辑脚本中的 `CONFIG` 与 `PRESETS`：

```javascript
const PRESETS = {
    fast:        { min: 12000, max: 22000, pauseEvery: 12, pauseMs: 5 * 60 * 1000,  taskMin: 1200, taskMax: 2500 },
    recommended: { min: 22000, max: 45000, pauseEvery: 10, pauseMs: 10 * 60 * 1000, taskMin: 2000, taskMax: 4000 },
    safe:        { min: 45000, max: 80000, pauseEvery: 6,  pauseMs: 15 * 60 * 1000, taskMin: 3500, taskMax: 7000 }
};
```

---

## ❓ 常见问题

### Q: 搜索任务没有积分？
**A**: 
- 确保已登录 **cn.bing.com**（脚本会复用浏览器真实 Cookie）
- 检查账号是否被 **风控**（搜索过于频繁可能触发）
- 脚本检测到连续多次搜索未计分时会自动停止，稍后再试

### Q: 活动任务显示「提交失败」？
**A**: 
- 部分活动是问卷/测验，需要真实点击选项，脚本只能尝试自动上报
- 确认已登录 rewards.bing.com，并在面板中刷新一次数据
- 新版活动卡会依次尝试 App 接口、Server Action、旧接口，并回退访问活动页；若账号触发风控会失败

### Q: 能否自动完成「使用 Edge 浏览 30 分钟」？
**A**: 
- 该任务由 Microsoft Edge 客户端累计浏览时长，网页脚本无法代完成
- 面板会显示其进度，自动执行活动时会跳过该任务，避免无效提交
- 想完成请直接用 Edge 打开 Bing 正常浏览，时长会自动累计

### Q: 提示「篡改猴没有访问此页面的权限」？
**A**: 
- 这是浏览器扩展缺少 `rewards.bing.com` 站点权限，不是脚本本身的问题
- Chrome：打开 `chrome://extensions`（Edge 为 `edge://extensions`）→ 找到 Tampermonkey / 篡改猴 → 详细信息 → 网站访问权限 → 选择「在所有网站上」，或在「在特定网站上」添加 `https://rewards.bing.com`
- Violentmonkey 同理，在扩展详情里把站点访问权限放开即可
- 保存后刷新 rewards.bing.com，图标就会正常显示；即使不给该站点权限，也可以在 bing.com 页面打开面板，数据仍可通过脚本后台请求获取

### Q: 签到/阅读任务失败？
**A**: 
1. 确认已正确获取并保存授权码
2. 检查授权码是否过期（Token 有效期约 1 小时）
3. 尝试重新获取授权码

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
- **Cookie**: `GM_cookie`

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

**Made with ❤️ by QingJ**

[⬆ 回到顶部](#get-microsoft-rewards)

</div>
