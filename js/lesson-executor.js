/* ============================================================
 * lesson-executor.js —— 「执行器小课堂」大屏课堂版
 * ------------------------------------------------------------
 * 原则：**不另写一套内容**。整页直接调用执行器实验室的 render()，
 * 渲染完成后只保留六张卡（按上课顺序重排），其余卡片/地图/小结移除。
 * 这样工具百宝箱、有/无工具对照、工具分类、工具从哪来、Function Calling（含
 * “改一个参数，回来的结构就换一个”实验）全部是原系统那一份，
 * 修一处两边同时生效。
 *
 * 本文件只负责“课堂外壳”：
 *   ① 裁出六张卡 + 重新编号（复用 LabPerception.numberCards）
 *   ② 顶部六关导航 / 右下角上一张下一张
 *   ③ 大屏字号（0.85～1.5，记住选择）+ 全屏
 * ============================================================ */
(function () {
  var U = AgentLab.UI;
  var $ = function (id) { return document.getElementById(id); };

  /* 六关：匹配卡片标题关键字 → 导航文字。顺序就是上课顺序。 */
  /* 上课顺序：先讲“是什么”，再讲“怎么用”，最后讲“怎么被调用”。
   * 与实验室源码顺序不同（实验室是先玩百宝箱再分类），这里按课堂逻辑重排。 */
  var STEPS = [
    { match: "认识执行器", nav: "① 执行器" },
    { match: "工具分类", nav: "② 工具与分类" },
    { match: "工具百宝箱", nav: "③ 试用工具" },
    { match: "有工具 vs 没工具", nav: "④ 有 / 没工具" },
    { match: "工具从哪来", nav: "⑤ 工具从哪来" },
    { match: "Function Calling 机制", nav: "⑥ 怎么调用" }
  ];

  var sec = $("sec-executor");
  if (!sec || !AgentLab.LabExecutor) return;

  /* ---------- ① 用原实验室渲染，再裁出六张卡 ---------- */
  AgentLab.LabExecutor.render();

  var allCards = Array.prototype.slice.call(sec.children).filter(function (n) {
    return n.classList && n.classList.contains("card");
  });

  var kept = [];
  STEPS.forEach(function (s) {
    for (var i = 0; i < allCards.length; i++) {
      var h2 = allCards[i].querySelector("h2");
      if (h2 && h2.textContent.indexOf(s.match) >= 0 && kept.indexOf(allCards[i]) < 0) {
        kept.push(allCards[i]);
        return;
      }
    }
  });
  /* 保底：万一实验室改了卡片标题，退回“前六张”，页面仍能用 */
  if (kept.length !== STEPS.length) {
    if (window.console) console.warn("[lesson] 未匹配到全部六张卡，退回前六张");
    kept = allCards.slice(0, STEPS.length);
  }

  /* 只留这六张，并把它们按上课顺序排好 */
  Array.prototype.slice.call(sec.children).forEach(function (n) {
    if (kept.indexOf(n) < 0) sec.removeChild(n);
  });
  kept.forEach(function (c) { sec.appendChild(c); });

  /* ---------- ①.5 课堂版：把「认识执行器」换成更亮、更具体的一版 ---------- */
  (function enhanceIntroCard() {
    var intro = null;
    for (var i = 0; i < kept.length; i++) {
      var h2 = kept[i].querySelector("h2");
      if (h2 && h2.textContent.indexOf("认识执行器") >= 0) { intro = kept[i]; break; }
    }
    if (!intro) return;
    var sub = intro.querySelector(".sub");
    var body = intro.querySelector(".card-body");
    if (!sub || !body) return;

    sub.innerHTML = "大模型会想、会说，却不会真的去查、去做。执行器就是智能体里<b>负责动手的岗位</b>；岗位上摆的每一件<b>工具</b>，都是一样本领。";

    body.innerHTML =
      '<div class="ls-exe-compare">' +
        '<div class="ls-exe-side is-brain">' +
          '<span class="ls-exe-kicker">只有大脑</span>' +
          '<div class="ls-exe-line">会想 · 会说 · 会猜</div>' +
          '<p>问它今天几号，它可能猜一个日期。</p>' +
        '</div>' +
        '<div class="ls-exe-switch">加上执行器</div>' +
        '<div class="ls-exe-side is-exe">' +
          '<span class="ls-exe-kicker">大脑 + 执行器</span>' +
          '<div class="ls-exe-line">能查 · 能算 · 能办事</div>' +
          '<p>问它今天几号，它读时钟再回答。</p>' +
        '</div>' +
      '</div>' +
      '<div class="ls-exe-duo">' +
        '<div class="ls-exe-mini">' +
          '<span class="ls-exe-tag">岗位</span><b>执行器</b>' +
          '<p>回答“谁来动手”。换工具，岗位不变。</p>' +
        '</div>' +
        '<div class="ls-exe-mini">' +
          '<span class="ls-exe-tag is-tool">家伙</span><b>工具</b>' +
          '<p>回答“用什么动手”。天气、计算器、提醒……都是工具。</p>' +
        '</div>' +
      '</div>';
  })();

  /* 复用原站的卡片编号（圈码 ①–⑥） */
  if (AgentLab.LabPerception && AgentLab.LabPerception.numberCards) {
    AgentLab.LabPerception.numberCards();
  }

  /* ---------- ② 顶部六关导航 ---------- */
  var nav = $("ls-nav");
  var current = 0;
  var navBtns = [];

  STEPS.forEach(function (s, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ls-nav-btn";
    b.textContent = s.nav;
    b.addEventListener("click", function () { goTo(i); });
    nav.appendChild(b);
    navBtns.push(b);
  });

  function setActive(i) {
    current = i;
    navBtns.forEach(function (b, k) { b.classList.toggle("is-on", k === i); });
    var pos = $("ls-pager-pos");
    if (pos) pos.textContent = (i + 1) + " / " + kept.length;
    var prev = $("ls-prev"), next = $("ls-next");
    if (prev) prev.disabled = i <= 0;
    if (next) next.disabled = i >= kept.length - 1;
  }

  function goTo(i) {
    i = Math.max(0, Math.min(kept.length - 1, i));
    kept[i].scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(i);
  }

  window.addEventListener("scroll", function () {
    var idx = 0;
    for (var i = 0; i < kept.length; i++) {
      if (kept[i].getBoundingClientRect().top <= 140) idx = i;
    }
    if (idx !== current) setActive(idx);
  }, { passive: true });

  /* ---------- ③ 大屏字号：整体缩放卡片区 ---------- */
  var stage = $("ls-stage");
  var wrap = $("ls-scale");
  var label = $("ls-scale-label");
  var MIN = 0.85, MAX = 1.5, STEP = 0.1;

  /* 没有存过：大屏（≥1100px）默认放大到 115%，小屏保持 100%，
     免得一进手机/小笔记本就挤成一列 */
  var raw = AgentLab.Store.get("lesson_scale_v1", null);
  var num = parseFloat(raw);
  var scale = (raw === null || raw === undefined || !isFinite(num))
    ? (window.innerWidth >= 1100 ? 1.15 : 1.0)
    : num;

  function fitHeight() {
    /* 缩放不改变布局高度，所以用「未缩放高度 × 倍率」把外层撑到同样高，
       否则页面底部会多出一大块空白 / 滚动条对不上。 */
    if (!wrap || !stage) return;
    wrap.style.height = (stage.offsetHeight * scale) + "px";
  }

  function applyScale(z, save) {
    scale = Math.min(MAX, Math.max(MIN, Math.round(z * 100) / 100));
    stage.style.transformOrigin = "top left";
    stage.style.transform = "scale(" + scale + ")";
    stage.style.width = (100 / scale) + "%";
    /* 滚到某张卡时，视觉上留 70px 给顶栏；因为 scroll-margin 也会被 scale 放大，
       所以按倍率折回去写。 */
    stage.style.setProperty("--ls-scroll-gap", (70 / scale) + "px");
    fitHeight();
    if (label) label.textContent = Math.round(scale * 100) + "%";
    if (save !== false) AgentLab.Store.set("lesson_scale_v1", scale);
  }

  var smaller = $("ls-smaller"), bigger = $("ls-bigger");
  if (smaller) smaller.addEventListener("click", function () { applyScale(scale - STEP); });
  if (bigger) bigger.addEventListener("click", function () { applyScale(scale + STEP); });

  window.addEventListener("resize", function () { applyScale(scale, false); });
  if (window.ResizeObserver) {
    /* 卡片里的实验一展开（配对结果、截图等），高度会变——跟着更新外层高度 */
    new ResizeObserver(function () { fitHeight(); }).observe(stage);
  }

  applyScale(scale);

  /* ---------- 全屏 ---------- */
  var full = $("ls-full");
  if (full) {
    full.addEventListener("click", function () {
      if (!document.fullscreenElement) {
        var p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
        if (p && p.catch) p.catch(function () { });
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    });
    document.addEventListener("fullscreenchange", function () {
      full.textContent = document.fullscreenElement ? "退出全屏" : "全屏";
      setTimeout(fitHeight, 60);
    });
  }

  /* ---------- 右下角翻页 ---------- */
  var pager = $("ls-pager");
  if (pager) {
    pager.hidden = false;
    $("ls-prev").addEventListener("click", function () { goTo(current - 1); });
    $("ls-next").addEventListener("click", function () { goTo(current + 1); });
  }

  /* 键盘：← / → 翻张，PgUp / PgDn 交给浏览器 */
  document.addEventListener("keydown", function (e) {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(current + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goTo(current - 1); }
  });

  /* 先隐藏后显示：避免裁卡前闪一下整节内容 */
  stage.classList.add("is-ready");
  setActive(0);
})();
