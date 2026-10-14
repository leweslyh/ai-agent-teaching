/* ============================================================
 * reveal.js —— 苹果风滚动进场动画
 * 设计原则：
 *   1) 只有本脚本成功执行并给 <html> 加上 .js-reveal 后，元素才会被隐藏；
 *      JS 失败 / 被禁用 / 不支持 IntersectionObserver / 用户开启「减少动态效果」时，
 *      一概不加这个类 —— 元素默认可见，绝不会出现白屏。
 *   2) 只作用于结构性大块（卡片 / 页头 / 分隔条），不动正文与小组件。
 *   3) 单个共享 IntersectionObserver，进场后立即 unobserve，不做持续回调。
 *   4) 栏目切换时重新扫描（section 默认 display:none，隐藏元素没有盒子）。
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

AgentLab.Reveal = (function () {

  var SELECTOR = ".card, .lab-head, .lab-brief, .sec-map, .lesson-divider, .lesson-goal, .lesson-summary, .formula-strip";
  var STAGGER_MS = 60;      /* 同屏多块的阶梯延迟 */
  var STAGGER_MAX = 6;      /* 超过 6 块后不再累加延迟，避免尾部等太久 */

  var io = null;
  var enabled = false;
  var observer = null;      /* section 的 class 变化监听 */

  function supported() {
    return typeof window.IntersectionObserver === "function";
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function init() {
    if (enabled) return;
    if (!supported() || reducedMotion()) return;   /* 降级：不加 .js-reveal，元素保持可见 */

    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        showIn(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });

    document.documentElement.classList.add("js-reveal");
    enabled = true;

    watchSections();
    refresh();
  }

  /* 进场：加上 is-in 触发过渡，动画结束后把 reveal/is-in 摘掉，
     让元素回到「无进场类」的原始状态（否则 .reveal 的 transform 会压过 :hover 抬升）。 */
  function showIn(el) {
    el.classList.add("is-in");
    clearTimeout(el._revealTimer);
    var delay = parseInt(el.style.transitionDelay || "0", 10) || 0;
    el._revealTimer = setTimeout(function () {
      el.classList.remove("reveal", "is-in");
      el.style.transitionDelay = "";
      el._revealTimer = 0;
    }, delay + 750);
  }

  /* 监听 section 的 class 变化：栏目切换时重新扫描 */
  function watchSections() {
    if (observer || typeof window.MutationObserver !== "function") return;
    observer = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        if (m.attributeName === "class" && m.target.classList.contains("active")) {
          refresh();
        }
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll(".section"), function (sec) {
      observer.observe(sec, { attributes: true, attributeFilter: ["class"] });
    });
  }

  /* 重新扫描：只处理当前激活栏目的块，之前的重置掉以便再次进场 */
  function refresh() {
    if (!enabled) return;

    var secs = document.querySelectorAll(".section.active");
    if (!secs.length) secs = document.querySelectorAll(".section");

    Array.prototype.forEach.call(secs, function (sec) {
      var blocks = sec.querySelectorAll(SELECTOR);
      var i = 0;
      Array.prototype.forEach.call(blocks, function (el) {
        /* 跳过大块内部嵌套的同类（例如卡片里的 lesson-goal），只取顶层块 */
        if (el.parentElement && el.parentElement.closest(SELECTOR)) return;

        clearTimeout(el._revealTimer);
        el.classList.add("reveal");
        el.classList.remove("is-in");
        el.style.transitionDelay = (Math.min(i, STAGGER_MAX) * STAGGER_MS) + "ms";
        i++;
        io.unobserve(el);
        io.observe(el);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { init: init, refresh: refresh, isEnabled: function () { return enabled; } };
})();
