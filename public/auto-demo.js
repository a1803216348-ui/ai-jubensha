/* AI 剧本杀 · 自动演示驱动 v2（无人值守循环 · 玩家自动提问 · 约 3–4 分钟/局）
 * 开启：访问 /?auto=1  或点右下角「▶ 开始」
 * 关闭：/?auto=0 或点「■ 停止」
 * 玩家（你）会自动抛出侦探式提问（右侧气泡），NPC 即时作答（左侧），形成真实问答；
 *   每个可发言阶段问一题、随即推进，控制总时长在 3–4 分钟。
 */
(function () {
  'use strict';
  var KEY = 'aidm_autodemo';
  var on = function () { return localStorage.getItem(KEY) === '1'; };
  try {
    var u = new URL(location.href);
    if (u.searchParams.get('auto') === '1') localStorage.setItem(KEY, '1');
    if (u.searchParams.get('auto') === '0') localStorage.removeItem(KEY);
  } catch (e) {}

  /* ---------- 节奏参数（目标 3–4 分钟/局） ---------- */
  var SETTLE = 40000;      // 单次生成最长等待
  var STABLE_MS = 1500;    // 正文 1.5s 不变即认为生成完成
  var READ_PAUSE = 2200;   // 一问一答后留给观众阅读的时间
  var QUESTION_BUDGET = 4; // 每局玩家自动提问次数上限
  var REPLAY_TAB_MS = 4500;// 复盘每个标签展示时长
  var STUCK_LIMIT = 130000;// 看门狗：超过这个时间无任何进展，就强制重开下一局

  /* ---------- 玩家自动提问池（通用，适配任意本子） ---------- */
  var QUESTIONS = [
    '案发当晚，各位都在哪里、在做什么？',
    '谁是最后一个见到死者的人？',
    '现场最关键的那条线索，说明了什么？',
    '在场谁和死者有旧怨或利害冲突？',
    '有没有人的说法前后矛盾？我想听听疑点。',
    '凶手最可能用的是什么手法？',
    '如果现在就要指认，谁的嫌疑最大、为什么？'
  ];

  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var lower = function (s) { return (s || '').trim(); };
  function byText(t, sel) {
    var nodes = document.querySelectorAll(sel || 'button,a');
    for (var i = 0; i < nodes.length; i++) if (lower(nodes[i].textContent).indexOf(t) >= 0) return nodes[i];
    return null;
  }
  function allByText(prefix, sel) {
    return [].slice.call(document.querySelectorAll(sel || 'button')).filter(function (e) {
      return lower(e.textContent).indexOf(prefix) === 0;
    });
  }
  function phaseLabel() {
    var m = document.body.innerText.match(/阶段\s*\d+\/\d+[^\n]*/);
    return m ? m[0] : '';
  }
  async function settle(timeout) {
    timeout = timeout || SETTLE;
    var last = -1, t0 = Date.now(), stableStart = Date.now();
    while (Date.now() - t0 < timeout) {
      var len = document.body.innerText.length;
      if (len === last) { if (Date.now() - stableStart >= STABLE_MS) return; }
      else { last = len; stableStart = Date.now(); }
      await sleep(500);
    }
  }

  /* 玩家发问：切到公共大厅 → 写入文本框 → 回车发送（右侧出现"你"的气泡） */
  async function askPlayer(text) {
    var hall = byText('公共大厅', 'button'); if (hall) { hall.click(); await sleep(500); }
    var ta = document.querySelector('textarea');
    if (!ta || /尚未开放/.test(ta.placeholder || '')) return false;
    var setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, text);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await sleep(450);
    var ta2 = document.querySelector('textarea');
    if (ta2 && ta2.value) { var sb = byText('发送', 'button') || byText('发言', 'button') || byText('提交', 'button'); if (sb) sb.click(); }
    return true;
  }

  /* ---------- 浮动控制条 ---------- */
  var bar;
  function ui() {
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'aidm-auto-bar';
      bar.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:99999;font:13px/1.4 system-ui,sans-serif;' +
        'display:flex;gap:8px;align-items:center;background:rgba(20,20,28,.92);color:#eee;' +
        'border:1px solid #444;border-radius:10px;padding:8px 12px;box-shadow:0 6px 24px rgba(0,0,0,.5)';
      document.documentElement.appendChild(bar);
    }
    var running = on();
    bar.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:' +
      (running ? '#4ade80' : '#888') + ';display:inline-block;' + (running ? 'box-shadow:0 0 8px #4ade80' : '') + '"></span>' +
      '<span id="aidm-auto-status" style="letter-spacing:.5px">' + (running ? '自动演示中' : '自动演示') + '</span>';
    var btn = document.createElement('button');
    btn.textContent = running ? '■ 停止' : '▶ 开始';
    btn.style.cssText = 'background:' + (running ? '#7f1d1d' : '#1d4ed8') + ';color:#fff;border:none;border-radius:7px;padding:5px 12px;cursor:pointer;font:inherit';
    btn.onclick = function () {
      if (on()) { localStorage.removeItem(KEY); ui(); }
      else { localStorage.setItem(KEY, '1'); location.assign('/?auto=1'); }
    };
    bar.appendChild(btn);
  }
  function status(t) { var s = document.getElementById('aidm-auto-status'); if (s) s.textContent = t; }

  /* ---------- 各页面驱动 ---------- */
  async function driveHome() {
    var guest = byText('游客模式', 'button,a'); if (guest) { guest.click(); await sleep(1200); }
    var lib = byText('内置剧本库', 'a') || byText('剧本库', 'a');
    if (lib) { lib.click(); await sleep(1500); return; }
    location.assign('/library');
  }

  async function driveLibrary() {
    // 已展开则直接开局；否则随机展开一个本子
    var start = byText('开始游戏', 'button');
    if (!start) {
      var cards = allByText('查看简介与选角');
      if (!cards.length) { await sleep(900); return; }
      cards[Math.floor(Math.random() * cards.length)].click();
      await sleep(1200);
      for (var k = 0; k < 10 && !start; k++) { await sleep(500); start = byText('开始游戏', 'button'); }
    }
    if (start) { start.click(); await sleep(2800); }
    else { await sleep(1000); }
  }

  var curGid = null, qBudget = 0, qIdx = 0;
  async function driveGame() {
    var gid = location.pathname;
    if (gid !== curGid) { curGid = gid; qBudget = QUESTION_BUDGET; qIdx = Math.floor(Math.random() * QUESTIONS.length); }
    status('演示 · ' + phaseLabel());

    // A) 本局已结束 / 可进复盘 → 直接进复盘页（认按钮，兼容各种结局命名，避免卡在末尾）
    var rep = byText('进入复盘揭秘', 'button') || byText('查看复盘', 'button,a');
    if (rep) { rep.click(); await sleep(2400); return; }

    // B) 指认/投票：只要「投票」tab 点开有「投给」选项就投
    //    （兼容"投票指凶 / 真相确认+指认 / 指认凶手"等不同剧本的命名）
    var voteTab = byText('投票', 'button');
    if (voteTab) {
      voteTab.click(); await sleep(900);
      var opts = allByText('投给');
      if (opts.length) {
        opts[Math.floor(Math.random() * opts.length)].click();
        await settle(70000); await sleep(3800);
        var rep2 = byText('进入复盘揭秘', 'button') || byText('查看复盘', 'button,a');
        if (rep2) { rep2.click(); await sleep(2400); }
        return;
      }
      var hall0 = byText('公共大厅', 'button'); if (hall0) { hall0.click(); await sleep(300); }
    }

    // C) 玩家自动提问（右侧），NPC 作答（左侧）
    var asked = false;
    if (qBudget > 0) {
      var hall = byText('公共大厅', 'button'); if (hall) { hall.click(); await sleep(400); }
      var ta = document.querySelector('textarea');
      if (ta && !/尚未开放/.test(ta.placeholder || '')) {
        var q = QUESTIONS[qIdx % QUESTIONS.length]; qIdx++;
        await askPlayer(q);
        await settle(SETTLE);
        await sleep(READ_PAUSE);
        qBudget--; asked = true;
      }
    }

    // D) 推进；若已无「下一阶段」按钮，再尝试进复盘，避免在末尾卡死
    var next = byText('立即进入下一阶段', 'button') || byText('进入下一阶段', 'button');
    if (next) { next.click(); await settle(SETTLE); await sleep(asked ? 700 : 1300); }
    else {
      var rep3 = byText('进入复盘揭秘', 'button') || byText('查看复盘', 'button,a');
      if (rep3) { rep3.click(); await sleep(2400); }
      else { await sleep(1300); }
    }
  }

  async function driveReplay() {
    status('演示 · 复盘揭秘');
    var tabs = ['真相揭示', '全角色剧本', '投票记录'];
    for (var i = 0; i < tabs.length; i++) { var b = byText(tabs[i]); if (b) { b.click(); await sleep(REPLAY_TAB_MS); } }
    await sleep(2500);
    location.assign('/library'); // 重开下一轮（脚本随页面重载自动续跑）
  }

  /* ---------- 看门狗 / 错误恢复 ---------- */
  function progressSig() {
    return location.pathname + '|' + phaseLabel() + '|' + Math.round(document.body.innerText.length / 60);
  }
  function looksBroken() {
    return /This page could not be found|Application error|Internal Server Error|应用出错|出错了|页面崩溃/.test(document.body.innerText);
  }
  async function recover() {
    status('恢复中 · 重开下一局');
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    location.assign('/library');
    await sleep(2600);
  }

  /* ---------- 主循环 ---------- */
  var lastSig = '', stuckSince = Date.now();
  async function loop() {
    ui();
    await sleep(1300);
    lastSig = ''; stuckSince = Date.now();
    while (on()) {
      try {
        if (looksBroken()) { await recover(); continue; }
        var p = location.pathname;
        if (p.indexOf('/game') === 0) await driveGame();
        else if (p.indexOf('/replay') === 0) await driveReplay();
        else if (p.indexOf('/library') === 0) await driveLibrary();
        else await driveHome();
      } catch (e) { console.warn('[auto-demo]', e); await sleep(2000); }

      // 看门狗：长时间无任何进展 → 强制重开，避免演示当场卡死
      var s = progressSig();
      if (s !== lastSig) { lastSig = s; stuckSince = Date.now(); }
      else if (Date.now() - stuckSince > STUCK_LIMIT) { stuckSince = Date.now(); lastSig = ''; await recover(); }

      await sleep(900);
    }
    ui();
  }

  function boot() { ui(); if (on()) loop(); }
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(boot, 400);
  else window.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 400); });
})();
