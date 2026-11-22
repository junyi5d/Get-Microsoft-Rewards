// ==UserScript==
// @name         Get Microsoft Rewards
// @namespace    http://tampermonkey.net/
// @version      1.2.12
// @description  微软 Rewards 助手 - 自动完成每日活动、必应搜索与日常任务，极简悬浮窗 + 可配置面板，一键全自动获取积分。
// @author       QingJ, junyi5d
// @icon         https://rewards.bing.com/rewardscdn/images/rewards.png
// @match        https://www.bing.com/*
// @match        https://cn.bing.com/*
// @match        https://rewards.bing.com/*
// @match        https://login.live.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @grant        GM_log
// @connect      bing.com
// @connect      rewards.bing.com
// @connect      www.bing.com
// @connect      cn.bing.com
// @connect      login.live.com
// @connect      prod.rewardsplatform.microsoft.com
// @connect      hot.baiwumm.com
// @connect      hotapi.nntool.cc
// @connect      cnxiaobai.com
// @connect      raw.githubusercontent.com
// @homepageURL  https://github.com/junyi5d/Get-Microsoft-Rewards
// @supportURL   https://github.com/junyi5d/Get-Microsoft-Rewards/issues
// @updateURL    https://raw.githubusercontent.com/junyi5d/Get-Microsoft-Rewards/main/GetMicrosoftRewards.user.js
// @downloadURL  https://raw.githubusercontent.com/junyi5d/Get-Microsoft-Rewards/main/GetMicrosoftRewards.user.js
// @license      MIT
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // ========== 授权页自动捕获 ==========
    // 登录成功跳转到 oauth20_desktop.srf?code=... 时，直接把授权码写入本地存储
    if (location.hostname === 'login.live.com') {
        const code = new URLSearchParams(location.search).get('code');
        if (code && location.pathname.indexOf('oauth20_desktop.srf') !== -1) {
            GM_setValue('auth_code', code);
            GM_setValue('refresh_token', '');
            document.body.innerHTML = '<div style="padding:40px;font-family:-apple-system,Segoe UI,sans-serif;font-size:16px;color:#0f6cbd;text-align:center">授权成功，本页面可关闭，返回 Rewards 面板继续使用。</div>';
            setTimeout(() => { try { window.close(); } catch (e) { } }, 1200);
        }
        return;
    }

    // ========== 常量配置 ==========
    const CONFIG = {
        ua: {
            pc: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
            app: 'Mozilla/5.0 (Linux; Android 16; Redmi K20 Pro Build/BP4A.251205.006; ) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/144.0.7559.132 Mobile Safari/537.36 BingSapphire/32.6.2110003560'
        },
        appId: 'SAAndroid/32.6.2110003560',
        hotApis: [
            { url: 'https://hot.baiwumm.com/api/', sources: ['weibo', 'douyin', 'baidu', 'zhihu', 'toutiao'] },
            { url: 'https://hotapi.nntool.cc/', sources: ['weibo', 'douyin', 'baidu', 'toutiao', 'zhihu'] },
            { url: 'https://cnxiaobai.com/DailyHotApi/', sources: ['weibo', 'douyin', 'baidu', 'toutiao'] }
        ],
        keywords: ['天气预报', '今日新闻', '体育赛事', '股票行情', '电影推荐', '科技资讯', '美食食谱', '旅游攻略']
    };

    // 打卡 / 任务间隔预设
    const PRESETS = {
        fast: { label: '快速', taskMin: 1200, taskMax: 2500 },
        recommended: { label: '推荐', taskMin: 2000, taskMax: 4000 },
        safe: { label: '保守', taskMin: 3500, taskMax: 7000 }
    };

    const DEFAULT_SETTINGS = { position: 'left', preset: 'recommended' };
    const SETTINGS_KEY = 'mr_settings_v2';
    const STORAGE_KEY = 'mr_search_progress';

    // ========== 工具函数 ==========
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const randomRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const randomPick = arr => arr[Math.floor(Math.random() * arr.length)];
    const shuffle = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(v => v[1]);
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    const shorten = (s, n) => {
        s = String(s || '');
        return s.length > n ? s.slice(0, n) + '…' : s;
    };
    const uuid = () => {
        try {
            if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
        } catch (e) { }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    };
    const getDateStr = () => {
        const d = new Date();
        return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    };
    const getDateHyphen = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const formatSecs = s => {
        s = Math.max(0, Math.ceil(s));
        return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
    };

    // 脚本版本号：直接读取脚本自身元数据，升级 @version 后界面与日志自动同步
    const SCRIPT_VERSION = (() => {
        if (typeof GM_info !== 'undefined' && GM_info) {
            if (GM_info.script && GM_info.script.version) return String(GM_info.script.version);
            const matched = String(GM_info.scriptMetaStr || '').match(/@version\s+([\d.]+)/);
            if (matched) return matched[1];
        }
        return '';
    })();

    // ========== 设置 ==========
    function loadSettings() {
        try {
            const raw = GM_getValue(SETTINGS_KEY);
            if (!raw) return { ...DEFAULT_SETTINGS };
            const data = JSON.parse(raw);
            const merged = { ...DEFAULT_SETTINGS, ...data };
            if (!PRESETS[merged.preset]) merged.preset = 'recommended';
            if (merged.position !== 'right') merged.position = 'left';
            return merged;
        } catch (e) {
            return { ...DEFAULT_SETTINGS };
        }
    }

    function saveSettings() {
        GM_setValue(SETTINGS_KEY, JSON.stringify(settings));
    }

    let settings = loadSettings();

    function currentPreset() {
        return PRESETS[settings.preset] || PRESETS.recommended;
    }

    // ========== 状态 ==========
    const state = {
        loaded: false,
        level: 1,
        levelName: '',
        points: 0,
        checkinCur: 0,
        checkinMax: 0,
        checkinPromos: [],
        searchCur: 0,
        searchMax: 0,
        searchCount: 0,
        searchDone: false,
        promos: [],
        allPromos: [],
        promosTotal: 0,
        promosDone: 0,
        readingPromos: [],
        readingCur: 0,
        readingMax: 0,
        running: false,
        allRunning: false,
        busyCount: 0,
        busy: { sign: false, promo: false, read: false },
        manualPaused: false,
        pausePromise: null,
        pauseResolver: null,
        accessToken: null,
        accessTokenExpiresAt: 0,
        updatingPromise: null,
        signDone: false,
        authShown: false
    };

    const SEARCH_MAX = 60;          // 全局默认上限（金牌 / 等级 3），仅作兜底
    const SEARCH_STEP = 3;          // 每次必应搜索获得的积分
    // 必应搜索每日积分上限（每次搜索 3 积分）：会员 15 / 银牌 30 / 金牌 60
    const SEARCH_CAP_BY_LEVEL = { 1: 15, 2: 30, 3: 60 };
    // 当日搜索次数上限 = 当日积分上限 / 每次积分
    function searchLimit() { return Math.max(1, Math.floor((state.searchMax || SEARCH_MAX) / SEARCH_STEP)); }

    // ========== 进度保存/恢复 ==========
    function saveProgress() {
        GM_setValue(STORAGE_KEY, JSON.stringify({ date: getDateHyphen(), searchCount: state.searchCount }));
    }

    function loadProgress() {
        try {
            const raw = GM_getValue(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data.date !== getDateHyphen()) return;
            const count = data.searchCount !== undefined ? Number(data.searchCount) : (data.searchDone ? 1 : 0);
            // 仅恢复今日已搜索次数，作为 updateData 兜底；积分上限等官方数据到达后再确定，
            // 骨架阶段保持 0/0，避免先显示满进度
            state.searchCount = clamp(Number(count) || 0, 0, Math.floor(SEARCH_MAX / SEARCH_STEP));
        } catch (e) { }
    }

    // ========== 网络请求 ==========
    async function request(options) {
        const retries = options.retries === undefined ? 2 : options.retries;
        const retryDelay = options.retryDelay || 1200;
        const opts = { timeout: 25000, ...options };
        delete opts.retries;
        delete opts.retryDelay;
        delete opts.useCookies;

        if (options.useCookies) {
            // 交给 Tampermonkey 自动附带完整 Cookie（含 HttpOnly），不要手动覆盖 Cookie 头
            opts.anonymous = false;
        }

        let attempt = 0;
        while (true) {
            try {
                return await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        timeout: 25000,
                        ...opts,
                        onload: xhr => {
                            if (xhr.status >= 200 && xhr.status < 400) {
                                resolve(options.returnUrl ? xhr.finalUrl : xhr.responseText);
                            } else {
                                const err = new Error(`HTTP ${xhr.status}`);
                                err.status = xhr.status;
                                err.body = xhr.responseText;
                                reject(err);
                            }
                        },
                        onerror: () => {
                            const err = new Error('网络错误');
                            err.status = 0;
                            reject(err);
                        },
                        ontimeout: () => {
                            const err = new Error('请求超时');
                            err.status = 0;
                            reject(err);
                        }
                    });
                });
            } catch (e) {
                const retryable = e.status === 0 || e.status === 429 || e.status >= 500;
                if (attempt >= retries || !retryable) throw e;
                await sleep(retryDelay * Math.pow(2, attempt) + randomRange(0, 400));
                attempt++;
            }
        }
    }

    // ========== 热搜词 ==========
    async function getHotQuery(used) {
        for (let attempt = 0; attempt < 3; attempt++) {
            const lists = await Promise.all(shuffle(CONFIG.hotApis).map(async api => {
                try {
                    const res = await request({ method: 'GET', url: api.url + randomPick(api.sources), timeout: 4000, retries: 0 });
                    const data = JSON.parse(res);
                    const list = Array.isArray(data && data.data) ? data.data : (Array.isArray(data) ? data : []);
                    return list.map(x => typeof x === 'string' ? x : x && x.title).filter(Boolean);
                } catch (e) {
                    return [];
                }
            }));
            const titles = lists.flat();
            if (titles.length) {
                for (let i = 0; i < 6; i++) {
                    const q = String(randomPick(titles)).slice(0, randomRange(8, 24));
                    if (q && !used.has(q)) return q;
                }
            }
            await sleep(200);
        }
        return `${randomPick(CONFIG.keywords)} ${Math.random().toString(36).slice(2, 6)}`;
    }

    // ========== 样式 ==========
    GM_addStyle(`
        #mr-panel {
            --mr-bg: #ffffff;
            --mr-fg: #1f2328;
            --mr-muted: #667085;
            --mr-line: #e6eaf0;
            --mr-soft: #f5f8fb;
            --mr-accent: #0f6cbd;
            --mr-accent-2: #2b88d8;
            --mr-green: #16a34a;
            position: fixed;
            bottom: 22px;
            right: 22px;
            z-index: 2147483640;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
            font-size: 12px;
            line-height: 1.5;
            color: var(--mr-fg);
            -webkit-font-smoothing: antialiased;
        }
        #mr-panel * { box-sizing: border-box; }
        #mr-panel button { font: inherit; cursor: pointer; }
        #mr-panel svg { width: 16px; height: 16px; display: block; }
        #mr-panel .mr-hidden { display: none !important; }

        #mr-panel.collapsed #mr-widget { display: none; }
        #mr-panel:not(.collapsed) #mr-fab { display: none; }
        #mr-fab {
            width: 54px; height: 54px; border-radius: 50%;
            background: linear-gradient(135deg, #0f6cbd, #3aa5ee);
            color: #fff;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 8px 24px rgba(15, 108, 189, .42), 0 2px 6px rgba(0, 0, 0, .12);
            transition: transform .18s ease, box-shadow .18s ease;
        }
        #mr-fab:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 12px 30px rgba(15, 108, 189, .5); }
        #mr-fab svg { width: 26px; height: 26px; }

        #mr-widget {
            width: 336px;
            max-height: calc(100vh - 44px);
            overflow-y: auto;
            background: var(--mr-bg);
            border: 1px solid var(--mr-line);
            border-radius: 16px;
            box-shadow: 0 18px 48px rgba(15, 23, 42, .18), 0 4px 12px rgba(15, 23, 42, .08);
        }
        #mr-widget::-webkit-scrollbar { width: 5px; }
        #mr-widget::-webkit-scrollbar-thumb { background: #d4dde8; border-radius: 4px; }

        #mr-header {
            display: flex; align-items: center; gap: 10px;
            padding: 12px 14px;
            background: linear-gradient(135deg, #0f6cbd, #2b88d8);
            color: #fff;
        }
        #mr-logo {
            width: 32px; height: 32px; border-radius: 10px;
            background: rgba(255, 255, 255, .18);
            display: flex; align-items: center; justify-content: center;
            flex: none;
        }
        #mr-logo svg { width: 19px; height: 19px; }
        #mr-titles { min-width: 0; }
        #mr-title { font-size: 13px; font-weight: 600; letter-spacing: .1px; }
        #mr-sub { font-size: 10px; opacity: .82; }
        #mr-head-actions { margin-left: auto; display: flex; gap: 4px; }
        .mr-icon-btn {
            width: 27px; height: 27px; border-radius: 8px;
            background: rgba(255, 255, 255, .14);
            color: #fff;
            display: flex; align-items: center; justify-content: center;
            transition: background .15s ease;
        }
        .mr-icon-btn:hover { background: rgba(255, 255, 255, .28); }
        .mr-icon-btn svg { width: 15px; height: 15px; }

        #mr-points-box {
            display: flex; align-items: flex-end; justify-content: space-between;
            padding: 12px 14px 2px;
        }
        #mr-points { font-size: 27px; font-weight: 700; letter-spacing: -.6px; line-height: 1.05; }
        #mr-points-unit { font-size: 11px; color: var(--mr-muted); margin-left: 4px; }
        #mr-level {
            font-size: 10px; font-weight: 600;
            color: var(--mr-accent);
            background: #e8f2fc;
            border: 1px solid #cfe5fb;
            padding: 2px 8px; border-radius: 999px;
        }
        #mr-badges { display: flex; align-items: center; justify-content: flex-end; gap: 6px; flex-wrap: wrap; }

        .mr-metric { padding: 9px 14px 0; }
        .mr-metric-top { display: flex; justify-content: space-between; font-size: 11px; color: var(--mr-muted); margin-bottom: 5px; }
        .mr-metric-top span:last-child { font-weight: 600; color: #475467; font-variant-numeric: tabular-nums; }
        .mr-track { height: 5px; border-radius: 999px; background: rgba(15, 23, 42, .07); overflow: hidden; }
        .mr-fill {
            display: block; height: 100%; width: 0;
            border-radius: 999px;
            background: linear-gradient(90deg, #2b88d8, #61c3f5);
            transition: width .35s ease;
        }
        .mr-fill.green { background: linear-gradient(90deg, #16a34a, #4ade80); }
        .mr-fill.orange { background: linear-gradient(90deg, #ea8a17, #f7bf4f); }
        .mr-fill.purple { background: linear-gradient(90deg, #7c3aed, #a78bfa); }

        /* 数据加载中：数值区模糊 + 骨架闪光，真实信息到达后再显示 */
        #mr-widget.mr-loading #mr-points-box,
        #mr-widget.mr-loading .mr-metric {
            filter: blur(3px);
            pointer-events: none;
            user-select: none;
        }
        #mr-widget.mr-loading .mr-metric { position: relative; }
        #mr-widget.mr-loading .mr-metric::after {
            content: '';
            position: absolute; left: 14px; right: 14px; bottom: 9px; height: 5px;
            border-radius: 999px;
            background: linear-gradient(90deg, rgba(15, 108, 189, .10) 25%, rgba(15, 108, 189, .30) 50%, rgba(15, 108, 189, .10) 75%);
            background-size: 200% 100%;
            animation: mr-shimmer 1.2s infinite linear;
        }
        @keyframes mr-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        #mr-status {
            margin: 12px 14px 0;
            padding: 9px 11px;
            border-radius: 11px;
            background: linear-gradient(180deg, #f7fbff, #f1f7fd);
            border: 1px solid #e2edf8;
        }
        .mr-status-line { display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--mr-muted); }
        #mr-status-text { font-weight: 600; color: var(--mr-accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        #mr-status-time { margin-left: auto; font-weight: 600; color: #475467; font-variant-numeric: tabular-nums; }
        .mr-status-dot { width: 7px; height: 7px; border-radius: 50%; background: #94a3b8; flex: none; }
        #mr-status.busy .mr-status-dot { background: #22c55e; box-shadow: 0 0 0 3px rgba(34, 197, 94, .16); animation: mr-pulse 1.4s infinite; }
        @keyframes mr-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }
        .mr-status-track { margin-top: 7px; height: 3px; }

        #mr-auth { margin: 12px 14px 0; padding: 10px; border-radius: 11px; background: #f2f8fd; border: 1px solid #d3e7f8; }
        .mr-auth-title { font-size: 11px; font-weight: 600; color: #0f6cbd; margin-bottom: 7px; }
        #mr-auth-in {
            width: 100%; height: 28px; margin: 6px 0;
            padding: 0 8px; border-radius: 7px;
            border: 1px solid #cfe3f5; background: #fff;
            font-size: 11px; color: #333; outline: none;
        }
        #mr-auth-in:focus { border-color: #0f6cbd; }
        .mr-auth-link, .mr-auth-save {
            width: 100%; height: 28px; border-radius: 7px;
            font-size: 11px; font-weight: 500;
        }
        .mr-auth-link { background: #eaf4fd; color: #0f6cbd; border: 1px solid #cfe3f5; margin-bottom: 2px; }
        .mr-auth-link:hover { background: #dcecfb; }
        .mr-auth-save { background: #0f6cbd; color: #fff; }
        .mr-auth-save:hover { background: #0d5da3; }

        .mr-btn:disabled { opacity: .45; cursor: not-allowed; }
        #mr-actions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 12px 14px 14px; }
        #mr-actions.no-read { grid-template-columns: repeat(3, 1fr); }
        .mr-btn {
            display: flex; align-items: center; justify-content: center; gap: 6px;
            height: 34px; border-radius: 10px;
            background: var(--mr-soft);
            border: 1px solid var(--mr-line);
            color: var(--mr-fg);
            font-size: 12px; font-weight: 500;
            transition: background .15s ease, border-color .15s ease, transform .1s ease;
        }
        .mr-btn:hover { background: #eef4fa; border-color: #d5e2f0; }
        .mr-btn:active { transform: scale(.985); }
        .mr-btn:disabled { opacity: .5; cursor: not-allowed; transform: none; }
        .mr-btn svg { width: 15px; height: 15px; }
        .mr-btn.mr-primary {
            grid-column: 1 / -1; height: 40px;
            background: linear-gradient(135deg, #0f6cbd, #2b88d8);
            color: #fff; border: 0;
            font-size: 13px; font-weight: 600;
            box-shadow: 0 6px 16px rgba(15, 108, 189, .3);
        }
        .mr-btn.mr-primary:hover { background: linear-gradient(135deg, #0d5da3, #2479c2); }

        #mr-log-wrap { margin: 0 14px 14px; border: 1px solid var(--mr-line); border-radius: 10px; overflow: hidden; }
        #mr-log-head {
            display: flex; align-items: center; justify-content: space-between;
            padding: 7px 10px;
            background: var(--mr-soft);
            font-size: 11px; color: var(--mr-muted);
            cursor: pointer; user-select: none;
        }
        #mr-log-head:hover { color: #475467; }
        #mr-log {
            height: 104px; overflow-y: auto;
            padding: 8px 10px;
            background: var(--mr-bg);
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 10px; line-height: 1.55; color: var(--mr-muted);
        }
        #mr-log-wrap.collapsed #mr-log { display: none; }
        #mr-log::-webkit-scrollbar { width: 4px; }
        #mr-log::-webkit-scrollbar-thumb { background: #d4dde8; border-radius: 3px; }

        /* 设置弹窗 */
        #mr-settings-mask {
            position: fixed; inset: 0; z-index: 2147483647;
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
            background: rgba(15, 23, 42, .4);
            backdrop-filter: blur(2px);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
        }
        #mr-settings-mask.mr-hidden { display: none !important; }
        #mr-settings-mask * { box-sizing: border-box; }
        #mr-settings button, #mr-settings a { cursor: pointer; }
        #mr-settings {
            width: 330px; max-width: 100%;
            background: var(--mr-bg, #fff);
            color: var(--mr-fg, #1f2328);
            border-radius: 16px;
            box-shadow: 0 24px 60px rgba(15, 23, 42, .32);
            overflow: hidden;
            animation: mr-pop .18s ease;
        }
        @keyframes mr-pop { from { transform: translateY(8px) scale(.98); opacity: 0; } to { transform: none; opacity: 1; } }
        #mr-set-head {
            display: flex; align-items: center; justify-content: space-between;
            padding: 13px 16px;
            font-size: 13px; font-weight: 600;
            background: linear-gradient(135deg, #0f6cbd, #2b88d8);
            color: #fff;
        }
        #mr-set-close { font-size: 20px; line-height: 1; color: rgba(255, 255, 255, .85); background: none; border: 0; cursor: pointer; }
        #mr-set-close:hover { color: #fff; }
        #mr-set-body { padding: 14px 16px 16px; }
        .mr-set-group { margin-bottom: 16px; }
        .mr-set-title { font-size: 11px; font-weight: 600; color: #475467; margin-bottom: 8px; }
        .mr-set-hint { font-weight: 400; color: #98a2b3; margin-left: 4px; }
        .mr-seg { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .mr-seg button, .mr-presets button {
            padding: 8px 6px; border-radius: 9px;
            border: 1px solid #e3e8ee; background: #f8fafc;
            font-size: 11px; color: #475467;
            transition: all .15s ease;
        }
        .mr-seg button:hover, .mr-presets button:hover { border-color: #c5d9ee; background: #f1f7fd; }
        .mr-seg button.active, .mr-presets button.active {
            border-color: #0f6cbd; background: #e8f2fc; color: #0f6cbd; font-weight: 600;
            box-shadow: inset 0 0 0 1px #0f6cbd;
        }
        .mr-presets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
        .mr-presets button b { display: block; font-size: 12px; font-weight: 600; }
        .mr-presets button small { display: block; font-size: 9px; color: #98a2b3; margin-top: 2px; }
        .mr-check { display: flex; align-items: center; gap: 7px; font-size: 11px; color: #475467; cursor: pointer; }
        .mr-check input { width: 14px; height: 14px; accent-color: #0f6cbd; }
        .mr-set-actions { display: flex; gap: 8px; margin-top: 4px; margin-bottom: 14px; }
        .mr-set-actions button { flex: 1; height: 34px; border-radius: 9px; font-size: 12px; font-weight: 500; }
        .mr-set-ghost { background: #f3f5f8; border: 1px solid #e3e8ee; color: #475467; }
        .mr-set-ghost:hover { background: #eaedf2; }
        .mr-set-primary { background: linear-gradient(135deg, #0f6cbd, #2b88d8); color: #fff; border: 0; font-weight: 600; }
        .mr-set-primary:hover { background: linear-gradient(135deg, #0d5da3, #2479c2); }
        .mr-set-auth { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .mr-set-auth button { height: 28px; padding: 0 10px; border-radius: 8px; font-size: 11px; white-space: nowrap; }
        .mr-version-row { display: flex; align-items: center; gap: 8px; }
        .mr-about-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .mr-about-row .mr-set-title { margin-bottom: 0; }
        .mr-version-badge {
            font-size: 12px; font-weight: 600;
            color: #0f6cbd; background: #eaf4fd; border: 1px solid #cfe3f5;
            padding: 4px 11px; border-radius: 999px; text-decoration: none;
        }
        .mr-version-badge:hover { background: #dcecfb; }
        .mr-update-btn {
            width: 29px; height: 29px; padding: 0; border-radius: 999px;
            border: 1px solid #cfe3f5; background: #eaf4fd; color: #0f6cbd;
            font-size: 15px; line-height: 1;
            display: flex; align-items: center; justify-content: center;
        }
        .mr-update-btn:hover { background: #dcecfb; }
        .mr-update-btn.spin { animation: mr-spin .9s linear infinite; }
        @keyframes mr-spin { to { transform: rotate(360deg); } }
        .mr-set-note a { color: #0f6cbd; font-weight: 600; text-decoration: none; }
        .mr-set-note a:hover { text-decoration: underline; }
        .mr-reward { margin-top: 14px; padding-top: 13px; border-top: 1px dashed #e3e8ee; text-align: center; }
        .mr-reward-tip { font-size: 10px; color: #98a2b3; margin-bottom: 8px; }
        .mr-reward-btn {
            height: 30px; padding: 0 16px; border: 0; border-radius: 999px;
            color: #fff; font-size: 11px; font-weight: 600;
            background: linear-gradient(135deg, #ef6a4c, #f79b4a);
            box-shadow: 0 4px 12px rgba(239, 106, 76, .28);
        }
        .mr-reward-btn:hover { filter: brightness(1.05); }
        #mr-reward-box { margin-top: 10px; padding: 10px; border-radius: 12px; background: #fff; border: 1px solid #f2e4e4; }
        #mr-reward-box.mr-hidden { display: none; }
        #mr-reward-box img { display: block; width: 168px; height: 168px; margin: 0 auto 6px; border-radius: 8px; }
        #mr-reward-box span { font-size: 11px; color: #475467; }
        #mr-auth-status { font-size: 11px; color: #98a2b3; }
        #mr-auth-status.ok { color: #107c10; }
        .mr-set-note { font-size: 10px; line-height: 1.5; color: #98a2b3; margin-top: 6px; }
        .mr-set-note.warn { color: #c4320a; }

        @media (prefers-color-scheme: dark) {
            #mr-panel {
                --mr-bg: #1c2128;
                --mr-fg: #e6edf3;
                --mr-muted: #8b949e;
                --mr-line: #30363d;
                --mr-soft: #232a33;
            }
            #mr-level { background: #14304a; border-color: #1c4a70; color: #6cb6ff; }
            .mr-metric-top span:last-child { color: #c9d1d9; }
            #mr-status { background: linear-gradient(180deg, #1a2733, #16212b); border-color: #24384c; }
            #mr-status-text { color: #6cb6ff; }
            #mr-status-time { color: #c9d1d9; }
            .mr-btn:hover { background: #2a333d; border-color: #3d4854; }
            #mr-auth { background: #102434; border-color: #1e4a6b; }
            .mr-auth-title { color: #6cb6ff; }
            #mr-auth-in { background: #0f1c28; border-color: #1e4a6b; color: #e6edf3; }
            #mr-settings { background: #1c2128; color: #e6edf3; }
            .mr-set-title { color: #c9d1d9; }
            .mr-seg button, .mr-presets button { background: #232a33; border-color: #30363d; color: #c9d1d9; }
            .mr-seg button.active, .mr-presets button.active { background: #14304a; border-color: #2b88d8; color: #6cb6ff; }
            .mr-set-ghost { background: #232a33; border-color: #30363d; color: #c9d1d9; }
            .mr-version-badge { color: #6cb6ff; background: #102434; border-color: #1e4a6b; }
            .mr-update-btn { color: #6cb6ff; background: #102434; border-color: #1e4a6b; }
            .mr-set-note a { color: #6cb6ff; }
            #mr-reward-box { background: #ffffff; border-color: #d3e7f8; }
            .mr-check { color: #c9d1d9; }
            #mr-log-head { color: #8b949e; }
        }
    `);

    // 经典配色（还原旧版观感：白底圆形图标 + 简洁面板）
    GM_addStyle(`
        #mr-panel {
            left: 20px; right: auto; bottom: 20px;
            color: #333;
        }
        #mr-panel.pos-right { left: auto; right: 20px; }

        #mr-panel.collapsed {
            width: 44px; height: 44px;
            border-radius: 50%;
            background: #fff;
            border: 1px solid #e0e0e0;
            box-shadow: 0 4px 16px rgba(0, 120, 212, .3);
            color: #0078d4;
            cursor: pointer;
        }
        #mr-panel.collapsed:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(0, 120, 212, .4); }
        #mr-fab { width: 44px; height: 44px; background: none; box-shadow: none; color: #0078d4; }
        #mr-fab:hover { transform: none; box-shadow: none; }
        #mr-fab svg { width: 24px; height: 24px; fill: currentColor; stroke: none; }

        #mr-widget {
            width: 300px;
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            box-shadow: 0 6px 20px rgba(0, 0, 0, .14);
        }
        #mr-header {
            padding: 10px 12px;
            background: #f8f9fa;
            color: #333;
            border-bottom: 1px solid #eee;
            border-radius: 8px 8px 0 0;
        }
        #mr-title { font-size: 13px; font-weight: 600; color: #333; }
        #mr-sub { color: #999; }
        .mr-icon-btn { color: #777; background: none; border: 0; font-size: 14px; }
        .mr-icon-btn:hover { background: #eef0f2; color: #333; }
        #mr-set-head { background: #f8f9fa; color: #333; border-bottom: 1px solid #eee; }
        #mr-set-close { color: #999; font-size: 18px; }
        #mr-set-close:hover { color: #333; }

        #mr-points { color: #d83b01; font-size: 24px; letter-spacing: 0; }
        #mr-points-unit { color: #999; }
        #mr-level { color: #0078d4; background: none; border: 0; padding: 0; font-size: 11px; }
        .mr-metric-top { color: #555; }
        .mr-metric-top span:last-child { color: #333; }
        .mr-track { height: 4px; background: #eee; border-radius: 2px; }
        .mr-fill { background: #0078d4; }
        .mr-fill.green { background: #16a34a; }
        .mr-fill.orange { background: #ff8c00; }
        .mr-fill.purple { background: #7c3aed; }

        #mr-status { background: #f7f8fa; border: 1px solid #eee; border-radius: 6px; }
        #mr-status-text { color: #0078d4; }
        #mr-status-time { color: #333; }

        #mr-auth { background: #f2f8fd; border: 1px solid #d3e7f8; border-radius: 6px; }
        .mr-auth-title { color: #0f6cbd; }
        #mr-auth-in { border: 1px solid #cfe3f5; background: #fff; color: #333; border-radius: 4px; }
        .mr-auth-link { background: #eaf4fd; color: #0f6cbd; border: 1px solid #cfe3f5; border-radius: 4px; }
        .mr-auth-save { background: #0078d4; color: #fff; border: 0; border-radius: 4px; }

        .mr-btn { background: #f5f6f8; border: 1px solid #d0d0d0; border-radius: 4px; }
        .mr-btn:hover { background: #eceff3; border-color: #bbb; }
        .mr-btn.mr-primary { background: #0078d4; box-shadow: none; border: 0; border-radius: 4px; }
        .mr-btn.mr-primary:hover { background: #006abc; }

        #mr-log-wrap { border: 1px solid #eee; border-radius: 4px; }
        #mr-log-head { background: #fafafa; color: #888; }
        #mr-log { height: 112px; background: #fff; color: #666; }

        #mr-settings { background: #fff; color: #333; border-radius: 8px; }
        .mr-set-title { color: #555; }
        .mr-seg button, .mr-presets button { background: #fff; border-color: #ddd; color: #555; border-radius: 4px; }
        .mr-seg button.active, .mr-presets button.active { background: #e8f2fc; border-color: #0078d4; color: #0078d4; }
        .mr-set-ghost { background: #f5f5f5; border-color: #ddd; color: #555; }
        .mr-set-primary { background: #0078d4; }
        .mr-set-primary:hover { background: #006abc; }

        @media (prefers-color-scheme: dark) {
            #mr-panel { color: #e6edf3; }
            #mr-panel.collapsed { background: #1c2128; border-color: #30363d; color: #4da3ff; }
            #mr-widget { background: #1c2128; border-color: #30363d; }
            #mr-header, #mr-set-head { background: #232a33; border-color: #30363d; color: #e6edf3; }
            #mr-title, #mr-set-head span { color: #e6edf3; }
            #mr-sub, #mr-log-head { color: #8b949e; }
            #mr-points-unit { color: #8b949e; }
            .mr-metric-top span:last-child { color: #e6edf3; }
            .mr-track { background: #30363d; }
            #mr-status { background: #232a33; border-color: #30363d; }
            #mr-status-time { color: #e6edf3; }
            .mr-btn { background: #232a33; border-color: #30363d; color: #e6edf3; }
            .mr-btn:hover { background: #2c353f; }
            #mr-log { background: #1c2128; color: #9aa4b0; }
            #mr-settings { background: #1c2128; color: #e6edf3; }
            .mr-seg button, .mr-presets button { background: #232a33; border-color: #30363d; color: #c9d1d9; }
            .mr-set-title, .mr-check { color: #c9d1d9; }
            .mr-set-ghost { background: #232a33; border-color: #30363d; color: #c9d1d9; }
            #mr-auth { background: #102434; border-color: #1e4a6b; }
            #mr-auth-in { background: #0f1c28; border-color: #1e4a6b; color: #e6edf3; }
        }
    `);

    // ========== 图标 ==========
    const ICONS = {
        gift: '<svg viewBox="0 0 24 24"><path d="M20 6h-3V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v3h2v9c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-9h2V8c0-1.1-.9-2-2-2zm-9-2h2v2h-2V4zm0 16H6v-9h5v9zm6 0h-5v-9h5v9zm1.5-11H16V7h2v2zm-4.5 0h-2V7h2v2zm-4.5 0H7V7h2v2zm-3.5 0H4V7h1.5v2z"/></svg>',
        gear: '⚙️',
        collapse: '✕',
        search: '🔍',
        target: '🎯',
        check: '✅',
        rocket: '🚀'
    };

    // ========== UI ==========
    const panel = document.createElement('div');
    panel.id = 'mr-panel';
    panel.className = 'collapsed';
    panel.innerHTML = `
        <button id="mr-fab" title="Microsoft Rewards">${ICONS.gift}</button>
        <div id="mr-widget">
            <div id="mr-header">
                <div id="mr-logo">${ICONS.gift}</div>
                <div id="mr-titles">
                    <div id="mr-title">Microsoft Rewards</div>
                    <div id="mr-sub">自动任务助手</div>
                </div>
                <div id="mr-head-actions">
                    <button class="mr-icon-btn" id="mr-settings-btn" title="设置">${ICONS.gear}</button>
                    <button class="mr-icon-btn" id="mr-close" title="收起">${ICONS.collapse}</button>
                </div>
            </div>

            <div id="mr-points-box">
                <div><span id="mr-points">0</span><span id="mr-points-unit">积分</span></div>
                <div id="mr-badges">
                    <span id="mr-level" title="会员等级">🏅</span>
                </div>
            </div>

            <div class="mr-metric" id="mr-checkin-wrap">
                <div class="mr-metric-top"><span>每日活动</span><span id="mr-checkin">0/0</span></div>
                <div class="mr-track"><i class="mr-fill orange" id="mr-checkin-bar"></i></div>
            </div>
            <div class="mr-metric" id="mr-search-wrap">
                <div class="mr-metric-top"><span>必应搜索</span><span id="mr-search">0/0</span></div>
                <div class="mr-track"><i class="mr-fill" id="mr-search-bar"></i></div>
            </div>
            <div class="mr-metric" id="mr-promo-wrap">
                <div class="mr-metric-top"><span>日常任务</span><span id="mr-promo">0/0</span></div>
                <div class="mr-track"><i class="mr-fill green" id="mr-promo-bar"></i></div>
            </div>
            <div class="mr-metric" id="mr-read-wrap">
                <div class="mr-metric-top"><span>阅读任务</span><span id="mr-read">0/30</span></div>
                <div class="mr-track"><i class="mr-fill purple" id="mr-read-bar"></i></div>
            </div>

            <div id="mr-status">
                <div class="mr-status-line">
                    <span class="mr-status-dot"></span>
                    <span id="mr-status-text">就绪</span>
                    <span id="mr-status-time"></span>
                </div>
                <div class="mr-track mr-status-track"><i class="mr-fill" id="mr-status-bar"></i></div>
            </div>

            <div id="mr-auth" class="mr-hidden">
                <div class="mr-auth-title">每日活动需要微软授权</div>
                <button class="mr-auth-link" id="mr-auth-link">获取授权码</button>
                <input type="text" id="mr-auth-in" placeholder="粘贴跳转后的完整 URL">
                <button class="mr-auth-save" id="mr-auth-save">保存授权码</button>
            </div>

            <div id="mr-actions">
                <button class="mr-btn" id="btn-sign">${ICONS.check}<span>每日</span></button>
                <button class="mr-btn" id="btn-search">${ICONS.search}<span>搜索</span></button>
                <button class="mr-btn" id="btn-promo">${ICONS.target}<span>任务</span></button>
                <button class="mr-btn" id="btn-read">📖<span>阅读</span></button>
                <button class="mr-btn mr-primary" id="btn-all">${ICONS.rocket}<span>一键全部执行</span></button>
            </div>

            <div id="mr-log-wrap">
                <div id="mr-log-head"><span>运行日志</span><span id="mr-log-toggle">收起</span></div>
                <div id="mr-log"></div>
            </div>
        </div>
    `;
    document.body.appendChild(panel);

    const $ = id => document.querySelector(id);
    const nodes = {
        panel: $('#mr-panel'),
        widget: $('#mr-widget'),
        fab: $('#mr-fab'),
        close: $('#mr-close'),
        settingsBtn: $('#mr-settings-btn'),
        level: $('#mr-level'),
        points: $('#mr-points'),
        checkin: $('#mr-checkin'),
        checkinBar: $('#mr-checkin-bar'),
        checkinWrap: $('#mr-checkin-wrap'),
        search: $('#mr-search'),
        searchBar: $('#mr-search-bar'),
        searchWrap: $('#mr-search-wrap'),
        promo: $('#mr-promo'),
        promoBar: $('#mr-promo-bar'),
        promoWrap: $('#mr-promo-wrap'),
        read: $('#mr-read'),
        readBar: $('#mr-read-bar'),
        readWrap: $('#mr-read-wrap'),
        status: $('#mr-status'),
        statusText: $('#mr-status-text'),
        statusTime: $('#mr-status-time'),
        statusBar: $('#mr-status-bar'),
        btnSearch: $('#btn-search'),
        btnPromo: $('#btn-promo'),
        btnRead: $('#btn-read'),
        btnSign: $('#btn-sign'),
        btnAll: $('#btn-all'),
        boxAuth: $('#mr-auth'),
        btnAuthLink: $('#mr-auth-link'),
        inAuth: $('#mr-auth-in'),
        btnAuthSave: $('#mr-auth-save'),
        logWrap: $('#mr-log-wrap'),
        logHead: $('#mr-log-head'),
        logToggle: $('#mr-log-toggle'),
        logBox: $('#mr-log')
    };

    // ========== 日志 ==========
    const LOG_MAX_LINES = 200;
    function log(msg) {
        const line = document.createElement('div');
        line.textContent = `[${new Date().toLocaleTimeString('zh-CN', { hour12: false }).slice(0, 5)}] ${msg}`;
        nodes.logBox.appendChild(line);
        while (nodes.logBox.childNodes.length > LOG_MAX_LINES) {
            nodes.logBox.removeChild(nodes.logBox.firstChild);
        }
        nodes.logBox.scrollTop = nodes.logBox.scrollHeight;
    }

    // ========== 状态栏 / 倒计时 ==========
    function setStatus(text) {
        nodes.statusText.textContent = text;
        nodes.statusTime.textContent = '';
        nodes.statusBar.style.width = '0%';
        nodes.status.classList.toggle('busy', false);
    }

    function setBusyStatus(text) {
        nodes.statusText.textContent = text;
        nodes.statusTime.textContent = '';
        nodes.statusBar.style.width = '0%';
        nodes.status.classList.toggle('busy', true);
    }

    function setCountdown(label, remainMs, totalMs) {
        nodes.statusText.textContent = label;
        nodes.statusTime.textContent = formatSecs(remainMs / 1000);
        nodes.statusBar.style.width = `${totalMs ? clamp((remainMs / totalMs) * 100, 0, 100) : 0}%`;
        nodes.status.classList.toggle('busy', true);
    }

    // 可被暂停打断的等待：倒计时只更新状态栏，不再刷日志
    async function waitTick(ms, label, stopFn) {
        let end = Date.now() + ms;
        const total = ms;
        while (true) {
            if (stopFn && stopFn()) break;
            if (state.manualPaused) {
                setStatus('已暂停');
                const pausedMs = await waitWhilePaused();
                end += pausedMs;
            }
            const remain = end - Date.now();
            if (remain <= 0) break;
            setCountdown(label, remain, total);
            await sleep(Math.min(400, remain));
        }
        if (!state.manualPaused) setStatus('就绪');
    }

    // 打卡 / 任务间隔：跟随当前预设随机，并偶发长停顿
    function nextTaskDelay() {
        const preset = currentPreset();
        let ms = randomRange(preset.taskMin, preset.taskMax);
        if (Math.random() < 0.12) ms += randomRange(8000, 20000);
        return ms;
    }

    // 搜索每次 3 分、需 20 次，间隔要比普通任务明显更久
    function nextSearchDelay() {
        let ms = randomRange(15000, 28000);
        if (Math.random() < 0.2) ms += randomRange(8000, 16000);
        return ms;
    }

    // ========== 手动暂停 ==========
    function updateAllButton() {
        if (!nodes.btnAll) return;
        if (state.manualPaused) {
            nodes.btnAll.innerHTML = '<span>▶️ 继续执行</span>';
        } else if (state.running || state.allRunning || state.busyCount > 0) {
            nodes.btnAll.innerHTML = '<span>⏸️ 暂停执行</span>';
        } else {
            nodes.btnAll.innerHTML = '<span>🚀 一键全部执行</span>';
        }
    }

    // 未读取到账户信息前禁止任何操作；执行中同步锁定对应按钮
    function applyActionState() {
        const lock = !state.loaded;
        nodes.btnSign.disabled = lock || state.busy.sign;
        nodes.btnPromo.disabled = lock || state.busy.promo;
        nodes.btnRead.disabled = lock || state.busy.read;
        nodes.btnSearch.disabled = lock;
        nodes.btnAll.disabled = lock;
        nodes.btnSearch.innerHTML = state.running ? '<span>⏹️ 停止</span>' : '<span>🔍 搜索</span>';
    }

    function markBusy(delta) {
        state.busyCount = Math.max(0, state.busyCount + delta);
        updateAllButton();
    }

    function setManualPause(paused, opts = {}) {
        if (paused === state.manualPaused) return;
        state.manualPaused = paused;
        if (paused) {
            if (!state.pausePromise) {
                state.pausePromise = new Promise(resolve => { state.pauseResolver = resolve; });
            }
        } else if (state.pauseResolver) {
            const resolve = state.pauseResolver;
            state.pauseResolver = null;
            state.pausePromise = null;
            resolve();
        }
        updateAllButton();
        if (!opts.silent) log(paused ? '已手动暂停' : '已继续执行');
    }

    async function waitWhilePaused() {
        if (!state.manualPaused) return 0;
        if (!state.pausePromise) {
            state.pausePromise = new Promise(resolve => { state.pauseResolver = resolve; });
        }
        const start = Date.now();
        await state.pausePromise;
        return Date.now() - start;
    }

    // ========== 渲染 ==========
    function setMetric(el, bar, cur, max) {
        el.textContent = `${cur}/${max}`;
        bar.style.width = max ? `${clamp((cur / max) * 100, 0, 100)}%` : '0%';
    }

    function levelIcon(name, level) {
        const s = String(name || '');
        if (/钻石|diamond/i.test(s)) return '💎';
        if (/白金|platinum/i.test(s)) return '🏆';
        if (/金牌|gold/i.test(s)) return '🥇';
        if (/银牌|silver/i.test(s)) return '🥈';
        if (/铜牌|bronze/i.test(s)) return '🥉';
        if (level >= 3) return '🥇';
        if (level === 2) return '🥈';
        return '🏅';
    }

    function render() {
        // 数据未到达时显示模糊骨架，栏数与加载完成后保持一致
        const loading = !state.loaded;
        nodes.widget.classList.toggle('mr-loading', loading);

        const name = state.levelName;
        const icon = levelIcon(name, state.level);
        nodes.level.textContent = name ? `${icon} ${name}` : icon;
        nodes.level.title = name || '会员等级';
        nodes.points.textContent = Number(state.points || 0).toLocaleString('zh-CN');
        const hasRead = loading || state.readingMax > 0;
        nodes.checkinWrap.classList.toggle('mr-hidden', !loading && state.checkinMax === 0);
        nodes.searchWrap.classList.toggle('mr-hidden', !loading && state.searchMax === 0);
        nodes.promoWrap.classList.toggle('mr-hidden', !loading && state.promosTotal === 0);
        nodes.readWrap.classList.toggle('mr-hidden', !hasRead);
        nodes.btnRead.classList.toggle('mr-hidden', !hasRead);
        nodes.widget.querySelector('#mr-actions').classList.toggle('no-read', !hasRead);
        setMetric(nodes.checkin, nodes.checkinBar, state.checkinCur, state.checkinMax);
        setMetric(nodes.search, nodes.searchBar, state.searchCur, state.searchMax);
        setMetric(nodes.promo, nodes.promoBar, state.promosDone, state.promosTotal);
        setMetric(nodes.read, nodes.readBar, state.readingCur, state.readingMax);
        applyActionState();
    }

    // ========== 授权 ==========
    const AUTH_URL = 'https://login.live.com/oauth20_authorize.srf?client_id=0000000040170455&scope=service::prod.rewardsplatform.microsoft.com::MBI_SSL&response_type=code&redirect_uri=https://login.live.com/oauth20_desktop.srf';

    function showAuth() {
        nodes.panel.classList.remove('collapsed');
        nodes.boxAuth.classList.remove('mr-hidden');
        if (!state.authShown) {
            log('请先获取并保存微软授权码（每日活动需要）');
            state.authShown = true;
        }
    }

    nodes.btnAuthLink.onclick = () => {
        if (typeof GM_openInTab === 'function') GM_openInTab(AUTH_URL, { active: true });
        else window.open(AUTH_URL, '_blank');
    };

    nodes.btnAuthSave.onclick = () => {
        const val = nodes.inAuth.value.trim();
        const m = val.match(/[?&]code=([^&]+)/) || val.match(/M\.[A-Za-z0-9._-]+/);
        if (m) {
            GM_setValue('auth_code', decodeURIComponent(m[1] || m[0]));
            GM_setValue('refresh_token', '');
            state.accessToken = null;
            state.accessTokenExpiresAt = 0;
            nodes.boxAuth.classList.add('mr-hidden');
            refreshAuthStatus();
            cookieChecked = false;
            log('授权码已保存');
        } else {
            log('授权码格式不正确，请复制完整跳转 URL');
        }
    };

    let tokenPromise = null;

    async function getAccessToken(opts = {}) {
        const forceRefresh = !!opts.forceRefresh;
        const silent = !!opts.silent;
        const now = Date.now();
        if (!forceRefresh && state.accessToken && state.accessTokenExpiresAt && now < state.accessTokenExpiresAt - 60000) {
            return state.accessToken;
        }
        if (tokenPromise) return tokenPromise;

        tokenPromise = (async () => {
            if (forceRefresh) {
                state.accessToken = null;
                state.accessTokenExpiresAt = 0;
            }
            const code = GM_getValue('auth_code');
            const refreshToken = GM_getValue('refresh_token');
            if (!code && !refreshToken) {
                if (!silent) showAuth();
                return null;
            }

            const url = refreshToken
                ? `https://login.live.com/oauth20_token.srf?client_id=0000000040170455&refresh_token=${encodeURIComponent(refreshToken)}&scope=service::prod.rewardsplatform.microsoft.com::MBI_SSL&grant_type=REFRESH_TOKEN`
                : `https://login.live.com/oauth20_token.srf?client_id=0000000040170455&code=${encodeURIComponent(code)}&redirect_uri=https://login.live.com/oauth20_desktop.srf&grant_type=authorization_code`;

            try {
                const res = await request({ url, timeout: 20000, retries: 1 });
                const data = JSON.parse(res);
                if (data.access_token) {
                    state.accessToken = data.access_token;
                    state.accessTokenExpiresAt = data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : 0;
                    if (data.refresh_token) GM_setValue('refresh_token', data.refresh_token);
                    return data.access_token;
                }
                if (data.error) {
                    GM_setValue('refresh_token', '');
                    state.accessToken = null;
                    state.accessTokenExpiresAt = 0;
                    if (!silent) {
                        log('授权已失效，请重新授权');
                        showAuth();
                    }
                }
            } catch (e) {
                if (!silent) log(`授权失败：${e.message}`);
            }
            return null;
        })();

        try {
            return await tokenPromise;
        } finally {
            tokenPromise = null;
        }
    }

    async function withTokenRetry(fn) {
        let token = await getAccessToken();
        if (!token) throw new Error('未授权');
        try {
            return await fn(token);
        } catch (e) {
            if (e && (e.status === 401 || e.status === 403)) {
                token = await getAccessToken({ forceRefresh: true });
                if (!token) throw e;
                return await fn(token);
            }
            throw e;
        }
    }

    // ========== 数据获取（rewards.bing.com/dashboard + /earn） ==========
    /*
     * 自动化基准（对照 rewards.bing.com/earn 的任务分类）：
     * 1. 打卡任务        → 今日每日活动（DailySet）+ DAPI 每日打卡（type 103）
     * 2. 必应搜索        → 每次 3 分、每天最多 20 次，共 60 积分
     * 3. 日常任务        → 按实际读取到的任务积分汇总
     * 4. 阅读任务        → msnreadearn 单列，每次 +3 分
     * 5. 连续打卡 / 升级里程碑 → 随对应行为自动累计，不参与一键执行
     * 6. App / 移动端 / Xbox / 邀请 → 无法由网页脚本完成，直接跳过
     */
    function normalizePromo(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const a = raw.attributes && typeof raw.attributes === 'object' ? raw.attributes : {};
        const offerId = raw.offerId || raw.offerid || a.offerid || raw.name || '';
        if (!offerId || typeof offerId !== 'string') return null;
        const completeRaw = raw.complete === undefined ? (raw.isCompleted === undefined ? (a.complete === undefined ? a.completed : a.complete) : raw.isCompleted) : raw.complete;
        const unlockRaw = raw.unlockCriteria === undefined ? a.unlockCriteria : raw.unlockCriteria;
        const hasUnlock = unlockRaw !== undefined && unlockRaw !== null && unlockRaw !== false && unlockRaw !== ''
            && !/^(none|\$undefined|null)$/i.test(String(unlockRaw));
        return {
            offerId,
            title: String(raw.title || a.title || raw.name || offerId),
            hash: raw.hash || a.hash || '',
            complete: completeRaw === true || String(completeRaw).toLowerCase() === 'true' || String(raw.state || '').toLowerCase() === 'completed',
            locked: raw.isLocked === true || raw.isUnlocked === false || hasUnlock || String(raw.exclusiveLockedFeatureStatus || a.exclusiveLockedFeatureStatus || '').toLowerCase() === 'locked',
            priority: Number(raw.priority === undefined ? (a.priority === undefined ? 999 : a.priority) : raw.priority),
            progress: Number(raw.pointProgress === undefined ? (raw.progress === undefined ? (a.progress === undefined ? a.activityprogress : a.progress) : raw.progress) : raw.pointProgress) || 0,
            max: Number(raw.pointProgressMax === undefined ? (raw.max === undefined ? (a.max === undefined ? a.activitymax : a.max) : raw.max) : raw.pointProgressMax) || 0,
            points: Number(raw.points === undefined ? (raw.pointProgressMax === undefined ? (a.pointmax === undefined ? 0 : a.pointmax) : raw.pointProgressMax) : raw.points) || 0,
            destination: raw.destinationUrl || raw.destination || a.destination || '',
            type: String(raw.promotionType || raw.type || a.type || raw.activityType || '').toLowerCase(),
            promotional: raw.promotional === true || String(raw.promotional === undefined ? a.promotional : raw.promotional).toLowerCase() === 'true',
            hidden: raw.isHidden === true || String(raw.hidden === undefined ? a.hidden : raw.hidden).toLowerCase() === 'true'
        };
    }

    function mergePromo(prev, next) {
        const merged = { ...prev };
        for (const key of Object.keys(next)) {
            const val = next[key];
            if (val === '' || val === null || val === undefined) continue;
            if ((key === 'points' || key === 'max' || key === 'progress') && !val) continue;
            merged[key] = val;
        }
        merged.complete = prev.complete || next.complete;
        merged.locked = prev.locked || next.locked;
        return merged;
    }

    // 解码页面（Next.js Flight 流）文本：还原 \uXXXX 中文与转义引号
    function decodePageText(html) {
        const raw = String(html || '');
        const chunks = [];
        const pushRe = /self\.__next_f\.push\(\[\d+,\s*"((?:[^"\\]|\\.)*)"\]\)/gs;
        let m;
        while ((m = pushRe.exec(raw)) !== null) {
            try { chunks.push(JSON.parse(`"${m[1]}"`)); } catch (e) { }
        }
        let text;
        if (chunks.length) {
            // Flight 数据 + 页面实际标签（徽章图片 / alt / title 等）
            const rest = raw.replace(/<script[\s\S]*?<\/script>/gi, ' ');
            text = chunks.join('') + '\n' + rest;
        } else {
            text = raw;
        }
        text = text.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
        return text.replace(/\\"/g, '"');
    }

    // 从页面数据中提取指定 key 后的 JSON 数组（activityCards / dailySetItems 等）
    function extractJsonArrayAfterKey(text, key) {
        const s = String(text || '');
        const idx = s.indexOf(`"${key}":[`);
        if (idx < 0) return null;
        const start = s.indexOf('[', idx);
        if (start < 0) return null;
        let depth = 0, inStr = false, esc = false;
        for (let i = start; i < s.length; i++) {
            const ch = s[i];
            if (inStr) {
                if (esc) esc = false;
                else if (ch === '\\') esc = true;
                else if (ch === '"') inStr = false;
            } else if (ch === '"') {
                inStr = true;
            } else if (ch === '[') {
                depth++;
            } else if (ch === ']') {
                depth--;
                if (depth === 0) {
                    try { return JSON.parse(s.slice(start, i + 1)); } catch (e) { return null; }
                }
            }
        }
        return null;
    }

    function parseFlightPromos(html) {
        const items = [];
        const text = decodePageText(html);
        let m;
        const objRe = /\{[^{}]*?"(?:offerId|offerid)"\s*:\s*"([^"]+)"[^{}]*?\}/g;
        while ((m = objRe.exec(text)) !== null) {
            try {
                const cleaned = m[0].replace(/:\$undefined/g, ':null').replace(/:\$D[^\",}]*/g, ':null');
                items.push(JSON.parse(cleaned));
            } catch (e) { }
        }

        const seen = new Set(items.map(x => x && (x.offerId || x.offerid)).filter(Boolean));
        // 结构化卡片：可完整读取 isCompleted / isLocked / unlockCriteria 等字段
        for (const key of ['activityCards', 'dailySetItems', 'morePromotions']) {
            const arr = extractJsonArrayAfterKey(text, key);
            if (!Array.isArray(arr)) continue;
            for (const card of arr) {
                if (!card || typeof card !== 'object') continue;
                const id = card.offerId || card.offerid || (card.attributes && card.attributes.offerid) || card.name;
                if (!id || seen.has(id)) continue;
                seen.add(id);
                items.push(card);
            }
        }

        // 兼容旧版 SSR 页面：从 data-offer-id / data-hash 属性提取卡片
        for (const seg of html.split(/data-offer-id="/).slice(1)) {
            const idMatch = seg.match(/^([^"&]+)/);
            if (!idMatch) continue;
            let offerId = idMatch[1];
            try { offerId = decodeURIComponent(offerId); } catch (e) { }
            if (!offerId || seen.has(offerId)) continue;
            seen.add(offerId);
            const hashMatch = seg.slice(0, 800).match(/data-hash="([^"]+)"/);
            items.push({ offerId, hash: hashMatch ? hashMatch[1] : '' });
        }
        return items;
    }

    async function fetchDashboard() {
        const out = { promos: [], user: null, levelName: '', activeLevel: 0 };

        // 1) Dashboard / Earn 页面（新版页面把任务数据放在 Flight 流里）
        for (const page of ['https://rewards.bing.com/dashboard', 'https://rewards.bing.com/earn']) {
            try {
                const html = await request({
                    url: `${page}?_=${Date.now()}`,
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                        'User-Agent': CONFIG.ua.pc
                    },
                    useCookies: true
                });
                if (typeof html === 'string' && html) {
                    for (const raw of parseFlightPromos(html)) {
                        const promo = normalizePromo(raw);
                        if (promo) out.promos.push(promo);
                    }
                    const plain = decodePageText(html);
                    const pointsMatch = plain.match(/"(?:availablePoints|balance)"\s*:\s*(\d+)/);
                    if (pointsMatch) state.points = Number(pointsMatch[1]);

                    if (!out.activeLevel) out.activeLevel = parseActiveLevel(null, plain);
                    if (!out.levelName) {
                        const lvName = extractLevelName(null, plain, out.activeLevel);
                        if (lvName) out.levelName = lvName;
                    }
                }
            } catch (e) {
                console.warn(`[MR] ${page} 获取失败`, e);
            }
        }

        // 2) 数据接口（补充每日任务与计数器）
        try {
            const res = await request({
                url: `https://rewards.bing.com/api/getuserinfo?type=1&X-Requested-With=XMLHttpRequest&_=${Date.now()}`,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json, text/plain, */*',
                    'Referer': 'https://rewards.bing.com/dashboard',
                    'User-Agent': CONFIG.ua.pc
                },
                useCookies: true
            });
            const data = JSON.parse(res);
            const dashboard = data.dashboard || data;
            if (dashboard && (dashboard.userStatus || dashboard.morePromotions || dashboard.dailySetPromotions)) {
                out.user = dashboard.userStatus || null;
                if (!out.activeLevel) out.activeLevel = parseActiveLevel(out.user, res);
                if (!out.levelName) {
                    const lvName = extractLevelName(out.user, res, out.activeLevel);
                    if (lvName) out.levelName = lvName;
                }
                const dailyMap = dashboard.dailySetPromotions || {};
                const daily = dailyMap[getDateStr()] || Object.values(dailyMap).flat();
                const rawList = [...(daily || []), ...(dashboard.morePromotions || [])];
                for (const raw of rawList) {
                    const promo = normalizePromo(raw);
                    if (promo) out.promos.push(promo);
                }
            }
        } catch (e) {
            // 未登录 rewards.bing.com 时该接口返回 401；有 DAPI 时属正常，不打扰用户
            if (e && e.status === 401) console.debug('[MR] getuserinfo 401（页面态未登录，已跳过；DAPI 仍可用）');
            else console.warn('[MR] getuserinfo 获取失败', e);
        }

        return out;
    }

    async function fetchDapiOverview() {
        const token = await getAccessToken({ silent: true });
        if (!token) return null;
        try {
            const res = await withTokenRetry(t => request({
                url: 'https://prod.rewardsplatform.microsoft.com/dapi/me?channel=SAAndroid&options=8191',
                headers: {
                    'Authorization': `Bearer ${t}`,
                    'Content-Type': 'application/json; charset=UTF-8',
                    'User-Agent': CONFIG.ua.app,
                    'X-Rewards-AppId': CONFIG.appId,
                    'X-Rewards-IsMobile': 'true',
                    'X-Rewards-Country': 'cn',
                    'X-Rewards-Language': 'zh'
                }
            }));
            const data = JSON.parse(res);
            const r = data.response || {};
            const lvInfo = (r.levelInfo && typeof r.levelInfo === 'object') ? r.levelInfo : {};
            const dapiLevel = Number(lvInfo.activeLevel ?? r.level ?? lvInfo.currentLevel ?? 0) || 0;
            const dapiLevelName = normalizeLevelName(lvInfo.activeLevelName || lvInfo.levelName || lvInfo.name || r.levelName || '');
            return {
                balance: Number(r.balance || 0),
                level: dapiLevel,
                levelName: dapiLevelName,
                promos: (r.promotions || []).map(normalizePromo).filter(Boolean),
                counters: r.counters || {}
            };
        } catch (e) {
            return null;
        }
    }

    // 页面中与等级相关的结构化片段（levelInfo 优先，避免命中任务里的无关字段）
    function levelSegment(text) {
        const s = String(text || '');
        const info = s.match(/"levelInfo"\s*:\s*\{[^{}]{0,600}\}/i);
        return info ? info[0] : s;
    }

    // 解析当前会员等级数字（页面 activeLevel 优先，接口兜底）
    function parseActiveLevel(user, text) {
        const m = levelSegment(text).match(/"(?:activeLevel|currentLevel|levelNumber)"\s*:\s*(\d+)/i);
        if (m) return Number(m[1]);
        const info = (user && (user.levelInfo || {})) || {};
        const raw = info.activeLevel === undefined ? (user && user.level) : info.activeLevel;
        return parseInt(String(raw === undefined ? '' : raw).replace(/\D/g, ''), 10) || 0;
    }

    // 等级名称 → 数字（仅用于图标兜底）
    function levelFromName(name) {
        if (/钻石|diamond|白金|platinum/i.test(name)) return 4;
        if (/金牌|gold/i.test(name)) return 3;
        if (/银牌|silver/i.test(name)) return 2;
        if (/铜牌|bronze|copper/i.test(name)) return 1;
        if (/普通|member/i.test(name)) return 1;
        return 0;
    }

    // 统一等级名称写法（兼容 Gold / Silver / Member 等英文）
    function normalizeLevelName(raw) {
        const s = String(raw || '').trim();
        if (!s) return '';
        if (/gold|金牌/i.test(s)) return '金牌会员';
        if (/silver|银牌/i.test(s)) return '银牌会员';
        if (/bronze|copper|铜牌/i.test(s)) return '铜牌会员';
        if (/platinum|白金/i.test(s)) return '白金会员';
        if (/diamond|钻石/i.test(s)) return '钻石会员';
        if (/member|普通会员/i.test(s)) return '普通会员';
        if (/会员/.test(s)) return s;
        if (/^level\s*\d+$/i.test(s) || /^\d+$/.test(s)) return '';
        return '';
    }

    // 从徽章图片地址推断等级（如 gold.png / silver-member.svg / level3.png）
    function levelNameFromIcon(src) {
        const s = String(src || '');
        const m = s.match(/(gold|silver|bronze|platinum|diamond|level[\s_-]*([0-9]))/i);
        if (!m) return '';
        if (m[2]) {
            const n = Number(m[2]);
            if (n >= 3) return '金牌会员';
            if (n === 2) return '银牌会员';
            if (n === 1) return '普通会员';
            return '';
        }
        return normalizeLevelName(m[1]);
    }

    // 个人资料卡上的当前等级：如「金牌会员 了解详细信息」
    function extractProfileLevel(text) {
        const s = String(text || '');
        const idx = s.indexOf('了解详细信息');
        if (idx > 0) {
            const before = s.slice(Math.max(0, idx - 400), idx);
            const all = [...before.matchAll(/(普通|银牌|金牌|铜牌|白金|钻石)\s*会员/g)];
            if (all.length) return normalizeLevelName(all[all.length - 1][1] + '会员');
        }
        const m = s.match(/(?:当前等级|会员等级|我的等级)[\s\S]{0,40}?((?:普通|银牌|金牌|铜牌|白金|钻石)\s*会员)/);
        return m ? normalizeLevelName(m[1]) : '';
    }

    // 解析会员等级名称（以 rewards 页面实际展示为准；抓不到时返回空，由界面显示图标）
    function extractLevelName(user, text, level) {
        const s = String(text || '');
        const lv = level || parseActiveLevel(user, text);

        // 1) 个人资料卡上的当前等级（最可靠，避免误读等级列表里的其他名称）
        const profile = extractProfileLevel(s);
        if (profile) return profile;

        // 2) 当前等级名称字段（activeLevelName / currentLevelName）
        const current = s.match(/"(?:activeLevelName|currentLevelName)"\s*:\s*"([^"]{2,30})"/i);
        if (current) {
            const name = normalizeLevelName(current[1]);
            if (name) return name;
        }

        // 3) 页面徽章的 alt / aria-label / title
        const attr = s.match(/(?:alt|aria-label|title)\s*=\s*"([^"]{0,40}?(?:金牌|银牌|铜牌|白金|钻石|普通|gold|silver|bronze|platinum|diamond|member)[^"]{0,20}?)"/i);
        if (attr) {
            const name = normalizeLevelName(attr[1]);
            if (name) return name;
        }

        // 4) 徽章图片地址（gold.png / level2.svg 等）
        const icon = s.match(/["'(]([^"'()\s]*(?:gold|silver|bronze|platinum|diamond|level[\s_-]*\d)[^"'()\s]*\.(?:png|svg|webp|jpg|jpeg))["')]/i);
        if (icon) {
            const name = levelNameFromIcon(icon[1]);
            if (name) return name;
        }

        // 5) levelInfo 内其他名称（不读取 levelType，避免拿到等级列表里的其他等级）
        const segName = levelSegment(s).match(/"(?:levelName|levelDisplayName|memberLevelName|tierName)"\s*:\s*"([^"]{2,30})"/i);
        if (segName) {
            const name = normalizeLevelName(segName[1]);
            if (name) return name;
        }

        // 6) 页面等级阶梯：按 activeLevel 精确匹配，如 {"level":2,...,"levelName":"Gold"}
        if (s && lv) {
            const re1 = /"(?:level|activeLevel|levelNumber)"\s*:\s*(\d+)[^{}]{0,200}?"(?:levelName|activeLevelName|name|displayName|title)"\s*:\s*"([^"]{2,20})"/g;
            const re2 = /"(?:levelName|activeLevelName|name|displayName|title)"\s*:\s*"([^"]{2,20})"[^{}]{0,200}?"(?:level|activeLevel|levelNumber)"\s*:\s*(\d+)/g;
            let m;
            while ((m = re1.exec(s)) !== null) {
                if (Number(m[1]) === lv) {
                    const name = normalizeLevelName(m[2]);
                    if (name) return name;
                }
            }
            while ((m = re2.exec(s)) !== null) {
                if (Number(m[2]) === lv) {
                    const name = normalizeLevelName(m[1]);
                    if (name) return name;
                }
            }
        }

        // 7) 页面中只出现一种会员名称时，直接采用（如「金牌会员」）
        const tiers = new Set();
        const tierRe = /(普通|银牌|金牌|铜牌|白金|钻石)\s*会员/g;
        let tm;
        while ((tm = tierRe.exec(s)) !== null) tiers.add(tm[1]);
        if (tiers.size === 1) return normalizeLevelName([...tiers][0] + '会员');

        return '';
    }

    // 从当前页面 DOM 读取等级（cn.bing.com 右上角 / rewards 页面）
    function readLevelFromDom() {
        try {
            const text = document.body ? document.body.innerText : '';
            const profile = extractProfileLevel(text);
            if (profile) return profile;
            if (!document.querySelectorAll) return '';
            const els = document.querySelectorAll('[aria-label*="会员"], [title*="会员"], [alt*="会员"], #id_rh, #id_rb');
            for (const el of els) {
                const s = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''} ${el.getAttribute('alt') || ''} ${el.textContent || ''}`;
                const name = extractLevelName(null, s, 0);
                if (name) return name;
            }
            return '';
        } catch (e) {
            return '';
        }
    }

    // ---- 任务归类：与 rewards 页面栏目对齐 ----
    // 每日活动（打卡）：Gamification_DailySet_<lang>_<YYYYMMDD>_ChildN，每天重置
    function isDailySetPromo(p) {
        return !!p && /^Gamification_DailySet/i.test(p.offerId || '');
    }

    // 次日预载的每日活动（页面会提前下发），不计入今天
    function isFuturePromo(p) {
        const m = String((p && p.offerId) || '').match(/(20\d{6})/);
        if (!m) return false;
        const now = new Date();
        const today = Number(`${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`);
        return Number(m[1]) > today;
    }

    // 元数据 / 抽奖 / App 专属 / 搜索积分计数：既不是打卡也不是日常任务
    const META_OFFER = /^(level_info|redeem_info|user_info|user_redemption_challenge_exempt|gamification_streak_counter_promotion)$/i;
    const APP_OFFER = /(sapphire|fosbury|appnewbonus|appinstall|appmigration|install_rewardsapp)/i;
    function isNoisePromo(p) {
        if (!p) return true;
        const id = p.offerId || '';
        if (META_OFFER.test(id)) return true;
        if (/sweeps|sweepstake|highvaluesweepstakes/i.test(`${id} ${p.type || ''}`)) return true;
        if (APP_OFFER.test(id)) return true;
        if (/^WW_search_global/i.test(id)) return true; // 搜索积分任务，归「搜索」栏
        return isNonWebTask(p);
    }

    // 阅读赚分（msnreadearn / readarticle）：单独按钮与进度条，每次 +3 分
    function isReadingPromo(p) {
        return !!p && (/^ENUS_readarticle/i.test(p.offerId || '') || /msnreadearn/i.test(p.type || ''));
    }

    // Edge 每日浏览 30 分钟：由 Edge 客户端累计时长，网页脚本无法代完成
    function isEdgeBrowse(promo) {
        const title = String((promo && promo.title) || '');
        return /edge/i.test(title) && /(浏览|browse)/i.test(title) && /(30|分钟|minute|min\b)/i.test(title);
    }

    // app / 移动端 / 客户端专属任务：网页脚本无法完成，直接跳过
    const NON_WEB_TASK = /(mobile|android|ios|iphone|ipad|bing\s*app|rewards\s*app|移动|手机|安卓|应用|安装|下载应用|xbox|game\s*pass|windows\s*搜索|windows search|outlook)/i;
    function isNonWebTask(promo) {
        const text = `${(promo && promo.title) || ''} ${(promo && promo.offerId) || ''}`;
        if (/edge|desktop|pc|电脑|桌面/i.test(text)) return false;
        return NON_WEB_TASK.test(text);
    }

    // earn 页面上不可通过一次上报完成的任务：
    // 连续打卡 / 升级里程碑（连续 N 天、默认搜索引擎）、邀请好友、Xbox 等
    const NON_AUTO_TASK = /(连续打卡|连续\s*\d+\s*天|每日连续打卡|设为默认搜索引擎|default\s*search\s*engine|邀请|好友|朋友|refer\s*a\s*friend|game\s*pass|xbox)/i;
    function isNonAutoTask(promo) {
        const text = `${(promo && promo.title) || ''} ${(promo && promo.offerId) || ''}`;
        return isNonWebTask(promo) || NON_AUTO_TASK.test(text);
    }

    // 打卡相关的 offerId / 类型：DAPI promotions 里的连续打卡系列
    // 注意：DailySet 是日常任务（Quiz 等），不计入打卡；必须搭配 Gamification/Streak/CheckIn 才是打卡
    const CHECKIN_OFFER = /(Gamification_Streak|DailyCheckIn|Daily_Checkin|SearchStreak|SearchDaily_Streak|CheckInDaily|DailyLogin|DailyReward|SetDefaultSearch|Gamification_CheckIn|Gamification_DailyCheckIn|Streak_Daily|Daily_Streak)/i;
    const CHECKIN_TITLE = /(连续打卡|连续登录|每日登录|每日签到|每日打卡|每日连续|搜索连续|Edge.*连续|必应.*连续|连签|连胜)/i;
    function isCheckinPromo(p) {
        if (!p) return false;
        if (CHECKIN_OFFER.test(p.offerId || '')) return !isNonWebTask(p);
        if (CHECKIN_TITLE.test(p.title || '')) return !isNonWebTask(p);
        // DAPI 里 streak/checkin 类型任务带进度（如 1/3 天），也视为打卡；裸 daily 不计入
        if (/streak|checkin/i.test(p.type || '') && (p.max > 0 || p.points > 0)) return !isNonWebTask(p);
        return false;
    }

    // 面板统一按积分统计；已完成卡片缺少进度字段时按满积分计入
    function sumPromoPoints(promos, fallbackMax) {
        return promos.reduce((sum, p) => {
            const max = Number(p.max) > 0 ? Number(p.max) : (Number(p.points) > 0 ? Number(p.points) : fallbackMax);
            const cur = p.complete ? max : clamp(Number(p.progress) || 0, 0, max);
            sum.done += cur;
            sum.total += max;
            return sum;
        }, { done: 0, total: 0 });
    }

    // 原始 title 保留给任务识别；日志与状态只使用中文显示标题
    function promoDisplayTitle(promo) {
        if (!promo) return '奖励活动';
        if (promo.displayTitle) return promo.displayTitle;
        const title = String(promo.title || '').trim();
        if (/[\u3400-\u9fff]/.test(title)) return title;
        if (isDailySetPromo(promo)) {
            const child = String(promo.offerId || '').match(/_Child(\d+)$/i);
            return `每日活动${child ? ' ' + child[1] : ''}`;
        }
        if (isReadingPromo(promo)) return '阅读任务';
        if (/^WW_search_global/i.test(promo.offerId || '')) return '必应搜索';
        if (isCheckinPromo(promo)) return '每日签到';
        return '奖励活动';
    }

    async function updateData(opts = {}) {
        if (state.updatingPromise) return state.updatingPromise;
        state.updatingPromise = (async () => {
            const firstLoad = !state.loaded;
            if (firstLoad) setBusyStatus('正在读取账户信息…');
            try {
                const [dash, dapi] = await Promise.all([fetchDashboard(), fetchDapiOverview()]);

                // DAPI 继续提供权威状态与积分；同 offerId 的 HTML 中文标题只用于显示和日志
                const chineseTitles = new Map();
                for (const p of dash.promos) {
                    if (p && p.offerId && /[\u3400-\u9fff]/.test(p.title || '') && !chineseTitles.has(p.offerId)) {
                        chineseTitles.set(p.offerId, p.title);
                    }
                }
                const localizeTitle = p => chineseTitles.has(p.offerId) ? { ...p, displayTitle: chineseTitles.get(p.offerId) } : p;
                if (dapi && dapi.promos) dapi.promos = dapi.promos.map(localizeTitle);
                dash.promos = dash.promos.map(localizeTitle);

                // 账户信息以 OAuth(DAPI) 为准；未授权 / DAPI 失败时才回退到页面(cookie)解析
                let sourcePromos;
                let source = 'HTML';
                if (dapi && dapi.promos && dapi.promos.length) {
                    source = 'DAPI';
                    sourcePromos = dapi.promos;
                } else {
                    source = 'HTML';
                    const map = new Map();
                    for (const promo of dash.promos) {
                        if (!promo || !promo.offerId) continue;
                        map.set(promo.offerId, map.has(promo.offerId) ? mergePromo(map.get(promo.offerId), promo) : promo);
                    }
                    sourcePromos = [...map.values()];
                }

                // 调试：分别打印两个来源 + 归类结果，便于定位数量偏差（首次加载必打，便于核对）
                if (!opts.quiet || firstLoad) {
                    const fmt = (p, src) => `[${src}|${p.offerId}|${p.type || ''}|${p.complete ? '✓' : '○'}] ${shorten(promoDisplayTitle(p), 24)}${p.max ? ` (${p.progress}/${p.max})` : ''}`;
                    const lines = [
                        ...(dapi && dapi.promos ? dapi.promos.map(p => fmt(p, 'DAPI')) : []),
                        ...dash.promos.map(p => fmt(p, 'HTML'))
                    ];
                    if (lines.length) console.log('[MR promos]\n  ' + lines.slice(0, 80).join('\n  '));
                }

                state.allPromos = sourcePromos;
                const allPromos = sourcePromos.filter(p => !p.hidden && !p.locked);

                // 打卡 = 每日活动（今日 DailySet，每天重置）；识别不到时回退连续打卡类卡片
                let checkinPromos = allPromos.filter(p => isDailySetPromo(p) && !isFuturePromo(p) && !isNonWebTask(p));
                if (!checkinPromos.length) checkinPromos = allPromos.filter(isCheckinPromo);
                state.checkinPromos = checkinPromos;
                const checkinPoints = sumPromoPoints(checkinPromos, 10);
                state.checkinMax = checkinPoints.total;
                state.checkinCur = checkinPoints.done;

                // 日常任务：按实际读取到的任务汇总积分；阅读任务单列，不计入这里
                const autoPromos = allPromos.filter(p => !isDailySetPromo(p) && !isNoisePromo(p) && !isEdgeBrowse(p) && !isNonAutoTask(p) && !isReadingPromo(p));
                const dailyPoints = sumPromoPoints(autoPromos, 5);
                state.promos = autoPromos;
                state.promosTotal = dailyPoints.total;
                state.promosDone = dailyPoints.done;

                // 阅读任务：存在时才显示单独按键与进度条
                const readingPromos = allPromos.filter(isReadingPromo);
                const readingPoints = sumPromoPoints(readingPromos, 30);
                state.readingPromos = readingPromos;
                state.readingMax = readingPoints.total;
                state.readingCur = readingPoints.done;

                if (!opts.quiet || firstLoad) {
                    console.log('[MR counts] source=' + source,
                        'checkin=' + checkinPromos.map(p => `${p.offerId}${p.complete ? '(✓)' : ''}`).join(','),
                        'auto=' + state.promosDone + '/' + state.promosTotal,
                        'read=' + state.readingCur + '/' + state.readingMax);
                }

                // 等级：OAuth(DAPI) 优先，页面 / DOM 兜底
                const user = dash.user || {};
                const domLevelName = readLevelFromDom();
                if (dapi && dapi.level > 0) {
                    state.level = dapi.level;
                } else {
                    const rawLevel = (user.levelInfo && user.levelInfo.activeLevel) || user.level;
                    if (dash.activeLevel > 0) state.level = dash.activeLevel;
                    else if (rawLevel) state.level = parseInt(String(rawLevel).replace(/\D/g, ''), 10) || state.level;
                }

                // 等级名称：当前页面 DOM > OAuth(DAPI) > 看板页面；抓不到时清空，界面回退为图标
                const levelName = domLevelName || (dapi && dapi.levelName) || dash.levelName;
                if (levelName) {
                    state.levelName = levelName;
                    const byName = levelFromName(levelName);
                    if (byName) state.level = byName;
                } else if (dapi || dash.user || dash.activeLevel > 0) {
                    state.levelName = '';
                }

                // 积分：OAuth(DAPI) 优先
                if (dapi && dapi.balance) state.points = dapi.balance;
                else if (typeof user.availablePoints === 'number') state.points = user.availablePoints;

                // 必应搜索：每次 3 分，每日上限按等级区分（会员 15 / 银牌 30 / 金牌 60）；
                // 优先取 DAPI 搜索卡的真实上限（offerId 形如 WW_search_global_NewLevelN），缺失时按等级查表
                const searchCard = sourcePromos.find(p => /^WW_search_global/i.test(p.offerId || ''));
                const cardMax = searchCard ? Number(searchCard.max) || 0 : 0;
                const capByLevel = SEARCH_CAP_BY_LEVEL[state.level] || SEARCH_MAX;
                const searchMax = cardMax > 0 ? cardMax : capByLevel;
                const officialSearch = searchCard ? clamp(Number(searchCard.progress) || 0, 0, searchMax) : 0;
                state.searchMax = searchMax;
                state.searchCur = clamp(Math.max(officialSearch, state.searchCount * SEARCH_STEP), 0, searchMax);
                state.searchCount = Math.min(searchLimit(), Math.max(state.searchCount, Math.round(state.searchCur / SEARCH_STEP)));
                state.searchDone = state.searchCur >= searchMax;

                state.loaded = true;
                render();
                if (firstLoad) setStatus('就绪');
                if (!opts.quiet) {
                    if (!dash.user && !sourcePromos.length && !dapi) {
                        log('未能读取任务数据，请确认已登录 rewards.bing.com 并完成微软授权');
                    } else {
                        log(`数据已更新（${source}）：${state.levelName || 'Lv.' + state.level} · ${Number(state.points || 0).toLocaleString('zh-CN')} 积分 · 每日活动 ${state.checkinCur}/${state.checkinMax} · 搜索 ${state.searchCur}/${state.searchMax} · 任务 ${state.promosDone}/${state.promosTotal}${state.readingMax ? ` · 阅读 ${state.readingCur}/${state.readingMax}` : ''}`);
                    }
                }
                return true;
            } catch (e) {
                state.loaded = true;
                render();
                if (firstLoad) setStatus('读取失败');
                console.error('[MR] updateData', e);
                if (!opts.quiet) log(`数据获取失败：${e.message}`);
                return false;
            } finally {
                state.updatingPromise = null;
            }
        })();
        return state.updatingPromise;
    }

    // ========== PC 搜索 ==========
    async function doSearch(query) {
        const host = 'cn.bing.com';
        const ua = CONFIG.ua.pc;
        const searchUrl = `https://${host}/search?q=${encodeURIComponent(query)}&form=QBLH&mkt=zh-CN`;
        try {
            // 先用真实登录会话打开搜索结果页（关键：不能伪造 Cookie 头覆盖登录态）
            const html = await request({
                url: searchUrl,
                headers: {
                    'User-Agent': ua,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
                },
                useCookies: true
            });
            if (typeof html !== 'string' || !/b_results|b_algo/i.test(html)) {
                log('搜索结果页异常，本次不计分');
                return false;
            }

            const ig = uuid().replace(/-/g, '').toUpperCase();
            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': ua,
                'Referer': searchUrl,
                'Origin': `https://${host}`
            };

            try {
                await request({
                    method: 'POST',
                    url: `https://${host}/rewardsapp/ncheader?ver=88888888&IID=SERP.5047&IG=${ig}&ajaxreq=1`,
                    headers,
                    data: 'wb=1%3bi%3d1%3bv%3d1',
                    useCookies: true,
                    retries: 0
                });
            } catch (e) { /* ncheader 失败不阻断计分上报 */ }

            const act = await request({
                method: 'POST',
                url: `https://${host}/rewardsapp/reportActivity?IG=${ig}&IID=SERP.5047&q=${encodeURIComponent(query)}&form=QBLH&mkt=zh-CN&ajaxreq=1`,
                headers,
                data: `url=${encodeURIComponent(searchUrl)}&V=web`,
                useCookies: true,
                retries: 0
            });

            if (/IsAuthenticated"?\s*:\s*false/i.test(String(act))) {
                log('网页会话未登录，搜索不会计分，请先在 cn.bing.com 登录');
                return false;
            }
            return true;
        } catch (e) {
            log(`搜索失败：${e.message}`);
            return false;
        }
    }

    async function runSearch() {
        if (state.running) {
            state.running = false;
            applyActionState();
            updateAllButton();
            log('已停止搜索');
            return;
        }
        if (!state.loaded) {
            log('账户信息尚未读取完成，请稍候');
            return;
        }
        if (state.busyCount > 0) {
            log('请等待当前任务完成');
            return;
        }
        if (state.searchCur >= state.searchMax) {
            log(`今日必应搜索已拿满（${state.searchCur}/${state.searchMax}）`);
            return;
        }

        state.running = true;
        applyActionState();
        updateAllButton();

        try {
            await waitWhilePaused();
            await updateData({ quiet: true });
            const max = state.searchMax;
            const limit = searchLimit();
            if (state.searchCur >= max) {
                log(`今日必应搜索已拿满（${state.searchCur}/${max}）`);
                return;
            }

            const used = new Set();
            while (state.running && state.searchCount < limit && state.searchCur < max) {
                if (state.manualPaused) await waitWhilePaused();
                const query = await getHotQuery(used);
                used.add(query);
                setBusyStatus(`搜索 ${state.searchCount + 1}/${limit}`);
                log(`必应搜索 ${state.searchCount + 1}/${limit}：${shorten(query, 18)}`);

                const ok = await doSearch(query);
                if (!ok) {
                    log('搜索上报未被接受（请确认已登录 cn.bing.com）');
                    break;
                }

                state.searchCount = Math.min(limit, state.searchCount + 1);
                state.searchCur = Math.min(max, state.searchCur + SEARCH_STEP);
                state.searchDone = state.searchCur >= max;
                render();
                saveProgress();
                log(`搜索进度：${state.searchCur}/${max} 积分`);

                if (state.searchCur >= max) break;
                await waitTick(nextSearchDelay(), '搜索间隔', () => !state.running);
            }

            if (state.searchCur >= state.searchMax) log(`必应搜索已完成（今日 ${state.searchCur}/${state.searchMax} 积分）`);
            else if (!state.running) log(`搜索已停止：${state.searchCur}/${state.searchMax} 积分`);
        } catch (e) {
            log(`搜索流程异常：${e.message}`);
        } finally {
            state.running = false;
            applyActionState();
            setStatus('就绪');
            updateAllButton();
            updateData({ quiet: true });
        }
    }

    // ========== 任务 ==========
    let verifyToken = { value: '', at: 0 };
    let actionCache = { reportActivity: '', deployId: '', at: 0 };

    async function getVerificationToken(force) {
        if (!force && verifyToken.value && Date.now() - verifyToken.at < 5 * 60 * 1000) {
            return verifyToken.value;
        }
        try {
            const html = await request({
                url: 'https://rewards.bing.com/dashboard',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'User-Agent': CONFIG.ua.pc,
                    'Referer': 'https://rewards.bing.com/'
                },
                useCookies: true
            });
            const m = html.match(/name=["']__RequestVerificationToken["'][^>]*value=["']([^"']+)["']/i)
                || html.match(/RequestVerificationToken.*?value=["']([^"']+)["']/i)
                || html.match(/"verificationToken"\s*:\s*"([^"]+)"/i)
                || html.match(/"__RequestVerificationToken"\s*:\s*"([^"]+)"/i);
            verifyToken = { value: m ? m[1].replace(/&amp;/g, '&') : '', at: Date.now() };
        } catch (e) {
            verifyToken = { value: '', at: Date.now() };
        }
        return verifyToken.value;
    }

    async function visitDestination(url) {
        try {
            const abs = new URL(url, 'https://rewards.bing.com/');
            if (!/(^|\.)bing\.com$/i.test(abs.hostname)) return false;
            await request({
                url: abs.href,
                headers: {
                    'User-Agent': CONFIG.ua.pc,
                    'Referer': 'https://rewards.bing.com/dashboard',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                useCookies: true,
                retries: 0
            });
            // 模拟在目标页停留一段时间
            await sleep(randomRange(1500, 3500));
            return true;
        } catch (e) {
            return false;
        }
    }

    async function reportActivity(promo, token) {
        const form = new URLSearchParams({ id: promo.offerId, hash: promo.hash || '1', activityAmount: '1' });
        if (token) form.set('__RequestVerificationToken', token);
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': CONFIG.ua.pc,
            'Referer': 'https://rewards.bing.com/dashboard',
            'Origin': 'https://rewards.bing.com',
            'X-Requested-With': 'XMLHttpRequest'
        };
        if (token) headers['RequestVerificationToken'] = token;
        return request({
            method: 'POST',
            url: 'https://rewards.bing.com/api/reportactivity?X-Requested-With=XMLHttpRequest',
            headers,
            data: form.toString(),
            useCookies: true,
            retries: 0
        });
    }

    async function dapiActivity(promo) {
        return withTokenRetry(token => request({
            method: 'POST',
            url: 'https://prod.rewardsplatform.microsoft.com/dapi/me/activities',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8',
                'User-Agent': CONFIG.ua.app,
                'X-Rewards-AppId': CONFIG.appId,
                'X-Rewards-IsMobile': 'true',
                'X-Rewards-Country': 'cn',
                'X-Rewards-Language': 'zh'
            },
            data: JSON.stringify({
                amount: 1,
                country: 'cn',
                id: uuid().replace(/-/g, ''),
                type: 101,
                channel: 'SAAndroid',
                attributes: { offerid: promo.offerId }
            })
        }));
    }

    // 解析新版页面里的 Server Action ID（活动卡交卷主通道）
    async function resolveServerActions(force) {
        const cacheTtl = actionCache.reportActivity ? 30 * 60 * 1000 : 2 * 60 * 1000;
        if (!force && actionCache.at && Date.now() - actionCache.at < cacheTtl) {
            return actionCache;
        }
        try {
            const html = await request({
                url: 'https://rewards.bing.com/earn',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'User-Agent': CONFIG.ua.pc,
                    'Referer': 'https://rewards.bing.com/dashboard'
                },
                useCookies: true
            });
            const deployMatch = html.match(/[?&](?:amp;)?dpl=([A-Za-z0-9._-]+)/) || html.match(/"buildId":"([A-Za-z0-9._-]+)"/);
            const chunks = [...new Set(html.match(/\/_next\/static\/chunks\/[a-zA-Z0-9_\-/.]+\.js[^"']*/g) || [])];
            const hex = '[a-f0-9]{40,64}';
            const re = new RegExp(`(?:createServerReference|registerServerReference)\\s*\\)?\\s*\\(\\s*"(${hex})"([\\s\\S]{0,800}?)\\)`, 'g');

            for (let i = 0; i < chunks.length && i < 40; i += 6) {
                const batch = chunks.slice(i, i + 6);
                const texts = await Promise.all(batch.map(src => request({
                    url: 'https://rewards.bing.com' + src.split('?')[0],
                    headers: { 'User-Agent': CONFIG.ua.pc },
                    retries: 0
                }).catch(() => '')));

                for (const js of texts) {
                    if (!js) continue;
                    let m;
                    re.lastIndex = 0;
                    while ((m = re.exec(js)) !== null) {
                        const tail = js.slice(m.index, m.index + m[0].length + 240);
                        if (/reportActivity/.test(m[2] || '') || /reportActivity/.test(tail)) {
                            actionCache = {
                                reportActivity: m[1],
                                deployId: deployMatch ? deployMatch[1] : '',
                                at: Date.now()
                            };
                            return actionCache;
                        }
                    }
                }
            }
            actionCache = { reportActivity: '', deployId: deployMatch ? deployMatch[1] : '', at: Date.now() };
        } catch (e) {
            actionCache = { reportActivity: '', deployId: '', at: Date.now() };
        }
        return actionCache;
    }

    async function serverActionActivity(promo) {
        if (!promo.hash) return false;
        const actions = await resolveServerActions();
        if (!actions.reportActivity) return false;
        const tree = ['', { children: ['(nav)', { children: ['earn', { children: ['PAGE', {}, null, null, 4096] }, null, null, 4096] }, null, null, 4096] }, null, null, 4096 + 16];
        const headers = {
            'Accept': 'text/x-component',
            'Content-Type': 'text/plain;charset=UTF-8',
            'Next-Action': actions.reportActivity,
            'Next-Router-State-Tree': encodeURIComponent(JSON.stringify(tree)),
            'Referer': 'https://rewards.bing.com/earn',
            'Origin': 'https://rewards.bing.com'
        };
        if (actions.deployId) headers['X-Deployment-Id'] = actions.deployId;
        const res = await request({
            method: 'POST',
            url: 'https://rewards.bing.com/earn',
            headers,
            data: JSON.stringify([promo.hash, 11, {
                offerid: promo.offerId,
                isPromotional: '$undefined',
                timezoneOffset: String(new Date().getTimezoneOffset())
            }]),
            useCookies: true,
            retries: 0
        });
        return /^\d+:true\s*$/m.test(String(res || ''));
    }

    function isPromoEligible(promo) {
        if (!promo || !promo.offerId || promo.complete || promo.locked) return false;
        if (promo.hidden || promo.promotional) return false;
        if (promo.priority < 0) return false;
        const text = `${promo.title} ${promo.offerId} ${promo.destination}`.toLowerCase();
        return !/sweepstake|referandearn|refer and earn|orderhistory|\/redeem|install_rewardsapp|bing wallpaper|set bing as your default/.test(text);
    }

    // 阅读赚分每次 +3 分，按剩余积分计算还需阅读的篇数（最多 10 篇）
    function readRounds(promo) {
        if (!promo || promo.type !== 'msnreadearn') return 1;
        const max = Number(promo.max) > 0 ? Number(promo.max) : 30;
        const cur = Number(promo.progress) || 0;
        if (cur >= max) return 1;
        return clamp(Math.ceil((max - cur) / 3), 1, 10);
    }

    async function submitPromo(promo, token) {
        let accepted = false;

        // 通道 1：DAPI（与 Rewards App 同源）
        try {
            const hasToken = await getAccessToken({ silent: true });
            if (hasToken) {
                await dapiActivity(promo);
                accepted = true;
            }
        } catch (e) { /* 继续尝试其它通道 */ }

        // 通道 2：Next.js Server Action（新版活动卡主通道）
        try {
            if (await serverActionActivity(promo)) accepted = true;
        } catch (e) { /* 继续尝试旧接口 */ }

        // 通道 3：旧版 reportactivity（仅在有 verification token 时尝试）
        if (token) {
            try {
                await reportActivity(promo, token);
                accepted = true;
            } catch (e) {
                console.debug('[MR] 旧版 reportActivity 未通过', e && e.status);
            }
        }

        return accepted;
    }

    async function completePromo(promo, token) {
        // 模拟真实浏览：先停留一会儿再交卷
        await sleep(randomRange(900, 2400));

        const accepted = await submitPromo(promo, token);

        // 通道 4：访问目标页（部分 urlreward 卡需要）
        if (promo.destination) {
            return (await visitDestination(promo.destination)) || accepted;
        }
        return accepted;
    }

    async function runPromo() {
        if (state.busy.promo) return;
        if (!state.loaded) {
            log('账户信息尚未读取完成，请稍候');
            return;
        }
        if (state.busyCount > 0 && !state.allRunning) {
            log('请等待当前任务完成');
            return;
        }

        state.busy.promo = true;
        applyActionState();
        markBusy(1);

        try {
            await waitWhilePaused();
            setStatus('读取任务列表');
            log('正在读取 Rewards 任务...');
            await updateData({ quiet: true });

            const tasks = shuffle(state.promos.filter(isPromoEligible));
            if (!tasks.length) {
                log(`暂无可执行任务（已完成 ${state.promosDone}/${state.promosTotal}）`);
                return;
            }

            const token = await getVerificationToken();
            if (!token) console.debug('[MR] 未获取到 verificationToken，旧版上报通道将跳过（DAPI / Server Action 不受影响）');

            log(`待执行任务 ${tasks.length} 个`);
            let ok = 0;

            for (let i = 0; i < tasks.length; i++) {
                if (state.manualPaused) await waitWhilePaused();
                const promo = tasks[i];
                setBusyStatus(`任务 ${i + 1}/${tasks.length}：${shorten(promoDisplayTitle(promo), 14)}`);
                log(`任务 ${i + 1}/${tasks.length}：${shorten(promoDisplayTitle(promo), 20)}`);

                const done = await completePromo(promo, token);
                if (done) {
                    ok++;
                    log(`已提交：${shorten(promoDisplayTitle(promo), 20)}`);
                } else {
                    log(`提交失败：${shorten(promoDisplayTitle(promo), 20)}`);
                }

                if (i < tasks.length - 1) {
                    await waitTick(nextTaskDelay(), '任务间隔');
                }
            }

            setStatus('核对任务结果');
            log(`任务处理完成 ${ok}/${tasks.length}，正在核对...`);
            await sleep(3000);
            await updateData({ quiet: true });
            log(`任务状态已刷新：${state.promosDone}/${state.promosTotal}`);
        } catch (e) {
            log(`任务流程异常：${e.message}`);
        } finally {
            state.busy.promo = false;
            applyActionState();
            markBusy(-1);
            setStatus('就绪');
        }
    }

    // ========== 阅读任务 ==========
    async function runReading() {
        if (state.busy.read) return;
        if (!state.loaded) {
            log('账户信息尚未读取完成，请稍候');
            return;
        }
        if (state.busyCount > 0 && !state.allRunning) {
            log('请等待当前任务完成');
            return;
        }

        state.busy.read = true;
        applyActionState();
        markBusy(1);

        try {
            await waitWhilePaused();
            await updateData({ quiet: true });

            const pending = state.readingPromos.filter(p => !p.complete);
            if (!pending.length) {
                log(`阅读任务已完成（${state.readingCur}/${state.readingMax}）`);
                return;
            }

            let token = '';
            try { token = await getVerificationToken(); } catch (e) { }

            let ok = 0;
            for (const promo of pending) {
                const rounds = readRounds(promo);
                log(`阅读 ${shorten(promoDisplayTitle(promo), 20)}（${promo.progress || 0}/${promo.max || 30}）`);

                for (let i = 0; i < rounds; i++) {
                    if (state.manualPaused) await waitWhilePaused();
                    setBusyStatus(`阅读 ${i + 1}/${rounds}：${shorten(promoDisplayTitle(promo), 12)}`);

                    const accepted = await submitPromo(promo, token);
                    if (!accepted) {
                        log(`阅读上报未被接受：${shorten(promoDisplayTitle(promo), 16)}`);
                        break;
                    }
                    ok++;
                    if (i < rounds - 1) await waitTick(nextTaskDelay(), '阅读间隔');
                }
            }

            setStatus('核对阅读结果');
            log(`阅读处理完成 ${ok} 次，正在核对...`);
            await sleep(3000);
            await updateData({ quiet: true });
            log(`阅读状态已刷新：${state.readingCur}/${state.readingMax}`);
        } catch (e) {
            log(`阅读流程异常：${e.message}`);
        } finally {
            state.busy.read = false;
            applyActionState();
            markBusy(-1);
            setStatus('就绪');
        }
    }

    // ========== 每日活动（打卡） ==========
    // 领取每日签到积分（DAPI type 103，幂等：今日已领则返回 isDuplicate）
    async function claimDailyCheckinPoints(quiet) {
        try {
            const res = await withTokenRetry(token => request({
                method: 'POST',
                url: 'https://prod.rewardsplatform.microsoft.com/dapi/me/activities',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json; charset=utf-8',
                    'User-Agent': CONFIG.ua.app,
                    'X-Rewards-AppId': CONFIG.appId,
                    'X-Rewards-IsMobile': 'true',
                    'X-Rewards-Country': 'cn',
                    'X-Rewards-Language': 'zh'
                },
                data: JSON.stringify({
                    amount: 1,
                    id: uuid().replace(/-/g, ''),
                    type: 103,
                    country: 'cn',
                    channel: 'SAAndroid'
                })
            }));
            const data = JSON.parse(res);
            const activity = data.response && data.response.activity;
            if (activity && (activity.p || activity.points)) {
                if (!quiet) log(`每日活动签到成功，获得 ${activity.p || activity.points} 积分`);
                state.signDone = true;
                return true;
            } else if (data.response && (data.response.isDuplicate || activity === null)) {
                if (!quiet) log('今日已签到');
            } else {
                if (!quiet) log('每日签到请求已提交');
            }
            state.signDone = true;
        } catch (e) {
            if (!quiet) {
                log(`每日签到失败：${e.message}`);
                if (e.message === '未授权') showAuth();
            }
        }
        return false;
    }

    function getClaimablePromos() {
        return state.allPromos.filter(p => p && p.max > 0 && (p.progress || 0) >= p.max
            && !p.complete && !p.locked && !p.hidden && isPromoEligible(p));
    }

    // 一键全部执行末尾：扫描全部活动，领取后刷新并复查，避免漏掉未归类卡片
    async function claimRemaining() {
        try {
            await waitWhilePaused();
            setStatus('检查待领取积分');
            if (!await updateData({ quiet: true })) {
                log('待领取积分检查失败：无法刷新活动数据');
                return;
            }

            const claimable = getClaimablePromos();
            log(`已检查全部 ${state.allPromos.length} 项活动，发现 ${claimable.length} 项待领取积分`);

            // 每日签到接口幂等；卡片仅提交进度已满但尚未标记完成的项目
            let claimed = (await claimDailyCheckinPoints(true)) ? 1 : 0;
            let token = '';
            if (claimable.length) {
                try { token = await getVerificationToken(); } catch (e) { }
            }
            for (let i = 0; i < claimable.length; i++) {
                if (state.manualPaused) await waitWhilePaused();
                const promo = claimable[i];
                log(`领取 ${i + 1}/${claimable.length}：${shorten(promoDisplayTitle(promo), 20)}`);
                const done = await completePromo(promo, token);
                if (done) { claimed++; log(`已提交领取：${shorten(promoDisplayTitle(promo), 20)}`); }
                if (i < claimable.length - 1) await waitTick(nextTaskDelay(), '领取间隔');
            }

            if (claimed || claimable.length) await sleep(2500);
            setStatus('复查待领取积分');
            if (!await updateData({ quiet: true })) {
                log('积分领取已处理，但复查时无法刷新活动数据');
                return;
            }
            const remaining = getClaimablePromos();
            if (remaining.length) {
                const names = remaining.slice(0, 3).map(p => shorten(promoDisplayTitle(p), 20)).join('、');
                log(`领取后复查：仍有 ${remaining.length} 项待领取积分：${names}`);
            } else {
                log(`领取后复查：没有剩余待领取积分${claimed ? `（本次提交 ${claimed} 项）` : ''}`);
            }
        } catch (e) {
            log(`领取可领积分异常：${e.message}`);
        }
    }

    async function runCheckin() {
        if (state.busy.sign) return;
        if (!state.loaded) {
            log('账户信息尚未读取完成，请稍候');
            return;
        }
        state.busy.sign = true;
        applyActionState();
        markBusy(1);

        try {
            await waitWhilePaused();
            await updateData({ quiet: true });
            setStatus('每日活动中');
            log('正在执行每日活动...');
            await claimDailyCheckinPoints();

            // 每日活动：已完成的直接计入进度，只对未完成的卡片执行
            const pending = state.checkinPromos.filter(p => !p.complete);
            if (!pending.length) {
                log(`今日每日活动已完成（${state.checkinCur}/${state.checkinMax}）`);
            } else {
                log(`待完成：${pending.length} 个每日活动`);
                let token = '';
                try { token = await getVerificationToken(); } catch (e) { }
                let ok = 0;
                for (let i = 0; i < pending.length; i++) {
                    if (state.manualPaused) await waitWhilePaused();
                    const promo = pending[i];
                    setBusyStatus(`每日活动 ${i + 1}/${pending.length}：${shorten(promoDisplayTitle(promo), 12)}`);
                    log(`每日活动 ${i + 1}/${pending.length}：${shorten(promoDisplayTitle(promo), 20)}`);
                    const done = await completePromo(promo, token);
                    if (done) ok++;
                    log(done ? `已提交：${shorten(promoDisplayTitle(promo), 20)}` : `未能完成：${shorten(promoDisplayTitle(promo), 20)}`);
                    if (i < pending.length - 1) await waitTick(nextTaskDelay(), '每日活动间隔');
                }
                log(`每日活动处理完成 ${ok}/${pending.length}`);
            }

            setStatus('核对每日活动');
            await sleep(3000);
            await updateData({ quiet: true });
            if (state.checkinMax > 0) log(`每日活动状态已刷新：${state.checkinCur}/${state.checkinMax}`);
            else log('每日活动完成（未检测到连续打卡卡片）');
        } catch (e) {
            log(`每日活动流程异常：${e.message}`);
        } finally {
            state.busy.sign = false;
            applyActionState();
            markBusy(-1);
            setStatus('就绪');
        }
    }

    // ========== 设置弹窗 ==========
    const settingsMask = document.createElement('div');
    settingsMask.id = 'mr-settings-mask';
    settingsMask.className = 'mr-hidden';
    settingsMask.innerHTML = `
        <div id="mr-settings">
            <div id="mr-set-head">
                <span>设置</span>
                <button id="mr-set-close" title="关闭">×</button>
            </div>
            <div id="mr-set-body">
                <div class="mr-set-group">
                    <div class="mr-set-title">图标位置</div>
                    <div class="mr-seg" data-group="position">
                        <button data-val="left">左下角</button>
                        <button data-val="right">右下角</button>
                    </div>
                </div>
                <div class="mr-set-group">
                    <div class="mr-set-title">任务间隔 <span class="mr-set-hint">每日活动 / 任务 / 阅读通用</span></div>
                    <div class="mr-presets" data-group="preset">
                        <button data-val="fast"><b>快速</b><small>任务 1.2–2.5s</small></button>
                        <button data-val="recommended"><b>推荐</b><small>任务 2–4s</small></button>
                        <button data-val="safe"><b>保守</b><small>任务 3.5–7s</small></button>
                    </div>
                </div>
                <div class="mr-set-group">
                    <div class="mr-set-title">微软授权</div>
                    <div class="mr-set-auth">
                        <span id="mr-auth-status">授权状态：未授权</span>
                        <button id="mr-set-reauth" class="mr-set-ghost">重新授权</button>
                    </div>
                </div>
                <div class="mr-set-actions">
                    <button id="mr-set-save" class="mr-set-primary">保存设置</button>
                </div>
                <div class="mr-set-group">
                    <div class="mr-about-row">
                        <div class="mr-set-title">关于</div>
                        <div class="mr-version-row">
                            <a id="mr-set-version" class="mr-version-badge" href="https://github.com/junyi5d/Get-Microsoft-Rewards" target="_blank" rel="noopener"></a>
                            <button id="mr-set-update" class="mr-update-btn" title="检查更新" aria-label="检查更新">↻</button>
                        </div>
                    </div>
                    <div class="mr-set-note" id="mr-update-status"></div>
                </div>
                <div class="mr-reward">
                    <div class="mr-reward-tip">❤️ 免费应用 · 自愿赞助 · 感谢支持</div>
                    <button id="mr-reward-toggle" class="mr-reward-btn" aria-expanded="false">🎁 赞赏支持</button>
                    <div id="mr-reward-box" class="mr-hidden">
                        <img src="https://raw.githubusercontent.com/junyi5d/Get-Microsoft-Rewards/main/assets/wechat-reward-qr.png" alt="微信赞赏码">
                        <span>微信赞赏码</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(settingsMask);

    let draftSettings = { ...settings };

    const authStatusEl = settingsMask.querySelector('#mr-auth-status');

    // ---- 关于：版本号（链接到项目主页）+ 检查更新 ----
    const REPO_URL = 'https://github.com/junyi5d/Get-Microsoft-Rewards';
    const RAW_URL = 'https://raw.githubusercontent.com/junyi5d/Get-Microsoft-Rewards/main/GetMicrosoftRewards.user.js';
    // 版本号直接取脚本自身元数据，升级 @version 后界面自动同步，无需改代码
    const versionEl = settingsMask.querySelector('#mr-set-version');
    const updateStatusEl = settingsMask.querySelector('#mr-update-status');
    const updateBtnEl = settingsMask.querySelector('#mr-set-update');
    versionEl.textContent = SCRIPT_VERSION ? 'v' + SCRIPT_VERSION : '版本未知';
    versionEl.href = REPO_URL;

    function compareVersion(a, b) {
        const pa = String(a).split('.').map(Number);
        const pb = String(b).split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const x = pa[i] || 0;
            const y = pb[i] || 0;
            if (x !== y) return x > y ? 1 : -1;
        }
        return 0;
    }

    settingsMask.querySelector('#mr-set-update').onclick = async () => {
        updateStatusEl.className = 'mr-set-note';
        updateStatusEl.textContent = '正在检查更新…';
        updateBtnEl.classList.add('spin');
        try {
            const text = await request({
                url: `${RAW_URL}?_=${Date.now()}`,
                headers: { 'Accept': 'text/plain, */*', 'User-Agent': CONFIG.ua.pc },
                retries: 0
            });
            const m = String(text || '').match(/@version\s+([\d.]+)/);
            if (!m) throw new Error('无法解析版本号');
            const latest = m[1];
            if (compareVersion(latest, SCRIPT_VERSION || '0') > 0) {
                updateStatusEl.innerHTML = `发现新版本 v${latest} · <a href="${RAW_URL}?t=${Date.now()}" target="_blank" rel="noopener">更新到 v${latest}</a>`;
                updateStatusEl.className = 'mr-set-note warn';
                updateStatusEl.querySelector('a').onclick = e => {
                    e.preventDefault();
                    openUpdatePage(RAW_URL);
                };
            } else {
                updateStatusEl.textContent = `已是最新版本 v${SCRIPT_VERSION}`;
            }
        } catch (e) {
            updateStatusEl.textContent = `检查更新失败：${e.message}`;
            updateStatusEl.className = 'mr-set-note warn';
        } finally {
            updateBtnEl.classList.remove('spin');
        }
    };

    // 直接打开用户脚本地址，由篡改猴接管安装 / 更新
    function openUpdatePage(url) {
        const target = `${url}?t=${Date.now()}`;
        if (typeof GM_openInTab === 'function') GM_openInTab(target, { active: true });
        else window.open(target, '_blank');
    }

    const rewardBox = settingsMask.querySelector('#mr-reward-box');
    const rewardToggleEl = settingsMask.querySelector('#mr-reward-toggle');
    rewardToggleEl.onclick = () => {
        const show = rewardBox.classList.contains('mr-hidden');
        rewardBox.classList.toggle('mr-hidden', !show);
        rewardToggleEl.setAttribute('aria-expanded', String(show));
        rewardToggleEl.textContent = show ? '🎁 收起赞赏' : '🎁 赞赏支持';
    };

    function refreshAuthStatus() {
        let text = '授权状态：未授权';
        let ok = false;
        if (state.accessToken) {
            text = '授权状态：已授权（令牌有效）';
            ok = true;
        } else if (GM_getValue('refresh_token')) {
            text = '授权状态：已授权（刷新令牌已保存）';
            ok = true;
        } else if (GM_getValue('auth_code')) {
            text = '授权状态：已保存授权码，未验证';
        }
        authStatusEl.textContent = text;
        authStatusEl.className = ok ? 'ok' : '';
    }

    function syncSettingsUI() {
        settingsMask.querySelectorAll('[data-group]').forEach(group => {
            const key = group.getAttribute('data-group');
            group.querySelectorAll('button[data-val]').forEach(btn => {
                btn.classList.toggle('active', draftSettings[key] === btn.getAttribute('data-val'));
            });
        });
    }

    function openSettings() {
        draftSettings = { ...settings };
        syncSettingsUI();
        refreshAuthStatus();
        settingsMask.classList.remove('mr-hidden');
    }

    function applyPosition() {
        nodes.panel.classList.toggle('pos-right', settings.position === 'right');
    }

    nodes.settingsBtn.onclick = e => {
        e.stopPropagation();
        openSettings();
    };

    settingsMask.querySelector('#mr-set-close').onclick = () => settingsMask.classList.add('mr-hidden');

    settingsMask.querySelector('#mr-set-reauth').onclick = () => {
        GM_setValue('auth_code', '');
        GM_setValue('refresh_token', '');
        state.accessToken = null;
        state.accessTokenExpiresAt = 0;
        state.authShown = false;
        refreshAuthStatus();
        settingsMask.classList.add('mr-hidden');
        showAuth();
        if (typeof GM_openInTab === 'function') GM_openInTab(AUTH_URL, { active: true });
        else window.open(AUTH_URL, '_blank');
        log('已清除旧授权，请在打开的页面完成授权后粘贴跳转 URL');
    };

    settingsMask.onclick = e => {
        if (e.target === settingsMask) settingsMask.classList.add('mr-hidden');
    };

    settingsMask.querySelectorAll('[data-group]').forEach(group => {
        group.addEventListener('click', e => {
            const btn = e.target.closest('button[data-val]');
            if (!btn) return;
            draftSettings[group.getAttribute('data-group')] = btn.getAttribute('data-val');
            syncSettingsUI();
        });
    });

    settingsMask.querySelector('#mr-set-save').onclick = () => {
        settings = { ...DEFAULT_SETTINGS, ...draftSettings };
        if (!PRESETS[settings.preset]) settings.preset = 'recommended';
        saveSettings();
        applyPosition();
        settingsMask.classList.add('mr-hidden');
        log(`设置已保存：${settings.position === 'left' ? '左下角' : '右下角'} · ${currentPreset().label}间隔`);
    };

    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('Microsoft Rewards 设置', openSettings);
    }

    // ========== 交互 ==========
    nodes.fab.onclick = () => nodes.panel.classList.remove('collapsed');
    nodes.close.onclick = e => {
        e.stopPropagation();
        nodes.panel.classList.add('collapsed');
    };
    nodes.logHead.onclick = () => {
        nodes.logWrap.classList.toggle('collapsed');
        nodes.logToggle.textContent = nodes.logWrap.classList.contains('collapsed') ? '展开' : '收起';
    };

    nodes.btnSearch.onclick = runSearch;
    nodes.btnPromo.onclick = runPromo;
    nodes.btnRead.onclick = runReading;
    nodes.btnSign.onclick = runCheckin;

    nodes.btnAll.onclick = async () => {
        if (!state.loaded) {
            log('账户信息尚未读取完成，请稍候');
            return;
        }
        if (state.manualPaused || state.running || state.allRunning || state.busyCount > 0) {
            setManualPause(!state.manualPaused);
            return;
        }
        state.allRunning = true;
        updateAllButton();
        try {
            await waitWhilePaused();
            // 只执行当前未完成且可获得积分的栏目，顺序随机，模拟真人操作
            const tasks = [];
            if (state.checkinMax === 0 || state.checkinCur < state.checkinMax) tasks.push({ name: '每日活动', run: runCheckin });
            if (state.searchCur < state.searchMax) tasks.push({ name: '搜索', run: runSearch });
            if (state.promos.some(p => isPromoEligible(p))) tasks.push({ name: '任务', run: runPromo });
            if (state.readingPromos.some(p => isPromoEligible(p))) tasks.push({ name: '阅读', run: runReading });
            shuffle(tasks);
            if (tasks.length) {
                log(`一键执行开始：${tasks.map(t => t.name).join(' → ')}`);
                for (let i = 0; i < tasks.length; i++) {
                    await waitWhilePaused();
                    if (i > 0) await waitTick(nextTaskDelay(), '切换任务');
                    log(`一键任务 ${i + 1}/${tasks.length}：${tasks[i].name}`);
                    await tasks[i].run();
                }
            } else {
                log('今日可获得的积分任务均已完成');
            }
            // 全部任务结束后，扫描全部活动并领取待领取积分，最后刷新复查
            await claimRemaining();
            log('一键执行结束');
        } finally {
            state.allRunning = false;
            updateAllButton();
        }
    };

    // ========== 初始化 ==========
    (async () => {
        applyPosition();
        loadProgress();
        render();
        updateAllButton();
        log(`脚本就绪 v${SCRIPT_VERSION || '未知'}`);

        await updateData({ quiet: true });

        // 静默刷新，避免频繁打扰
        setInterval(() => {
            if (document.hidden) return;
            if (!state.updatingPromise && !state.running && !state.allRunning && !state.busyCount) {
                updateData({ quiet: true });
            }
        }, 5 * 60 * 1000);
    })();

})();
