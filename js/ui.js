/* ============================================================
 * ui.js —— 界面小工具
 * 页面切换、打字机效果、提示气泡、SVG 图标、防抖等。
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

AgentLab.UI = (function () {

  /* ---------- 基础 ---------- */
  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------- 页面切换 ---------- */
  var sections = ["origin", "home", "perception", "planner", "memory", "executor", "playground"];

  function showSection(id) {
    sections.forEach(function (s) {
      var el = $("sec-" + s);
      if (el) el.classList.toggle("active", s === id);
    });
    document.querySelectorAll(".nav-tab").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-sec") === id);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- 打字机效果 ---------- */
  async function typewriter(el, text, speed) {
    speed = speed || 14;
    el.innerHTML = "";
    var buf = "";
    for (var i = 0; i < text.length; i++) {
      buf += text[i];
      el.innerHTML = esc(buf).replace(/\n/g, "<br>");
      if (i % 4 === 0) await delay(speed);
    }
    return el;
  }

  /* ---------- 提示气泡 ---------- */
  var toastTimer = null;
  function toast(msg, type) {
    var box = $("toast-box");
    if (!box) return;
    box.innerHTML = '<div class="toast ' + (type || "info") + '">' + esc(msg) + "</div>";
    box.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.classList.remove("show"); }, 3200);
  }

  /* ---------- 彩带/星星小动画（答对时） ---------- */
  function celebrate(el) {
    if (!el) return;
    el.classList.remove("celebrate");
    void el.offsetWidth;  // 重启动画
    el.classList.add("celebrate");
  }

  /* ---------- SVG 图标 ---------- */
  var ICONS = {
    eye: '<circle cx="12" cy="12" r="3.2"/><path d="M2.5 12S6.5 5.5 12 5.5 21.5 12 21.5 12 17.5 18.5 12 18.5 2.5 12 2.5 12z"/>',
    gear: '<path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z"/><path d="M19.4 13.5l1.5 1.2-1.8 3.1-1.9-.7a7 7 0 0 1-1.6.9l-.3 2H10.7l-.3-2a7 7 0 0 1-1.6-.9l-1.9.7-1.8-3.1 1.5-1.2a6.9 6.9 0 0 1 0-1.8L5.1 10.5l1.8-3.1 1.9.7a7 7 0 0 1 1.6-.9l.3-2h2.6l.3 2a7 7 0 0 1 1.6.9l1.9-.7 1.8 3.1-1.5 1.2a6.9 6.9 0 0 1 0 1.8z"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z"/><path d="M8 7.5h8M8 11h8" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
    hand: '<path d="M8.5 12.5V6a1.5 1.5 0 0 1 3 0v5.5M11.5 11V4.8a1.5 1.5 0 0 1 3 0V11M14.5 11V6.2a1.5 1.5 0 0 1 3 0V13c0 4-2.2 6.5-5.5 6.5-3.4 0-5-2.2-5.5-5.5L5.7 11a1.5 1.5 0 0 1 2.4-1.7l.4.5"/>',
    brain: '<path d="M12 4c-1.6 0-2.6 1-2.9 2.3C8 5.8 6.8 6.4 6.3 7.8 4.6 8.4 3.6 10 3.9 11.7 3 12.9 3.2 14.7 4.4 15.6 4.6 17.4 6.2 18.7 8 18.7c.5 0 1-.1 1.5-.3.7 1.6 2.3 2.6 4.1 2.3V4z"/><path d="M12 4c1.6 0 2.6 1 2.9 2.3C16 5.8 17.2 6.4 17.7 7.8c1.7.6 2.7 2.2 2.4 3.9.9 1.2.7 3-.5 3.9-.2 1.8-1.8 3.1-3.6 3.1-.5 0-1-.1-1.5-.3-.7 1.6-2.3 2.6-4.1 2.3V4z"/>',
    robot: '<rect x="5" y="7" width="14" height="11" rx="3"/><circle cx="9.5" cy="12.5" r="1.4"/><circle cx="14.5" cy="12.5" r="1.4"/><path d="M12 7V4.5M12 4.5h-2.2M9.8 18v1.8a1 1 0 0 0 1 1h2.4a1 1 0 0 0 1-1V18" stroke-width="1.5" stroke-linecap="round" fill="none"/><path d="M2.5 12v2.5M21.5 12v2.5" stroke-width="2" stroke-linecap="round" fill="none"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
    img: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l4.5-4.5 3 3L16 11l4 4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    txt: '<path d="M5 3.5h10l4 4v13H5v-17z"/><path d="M15 3.5v4h4M8.5 11h7M8.5 14.5h7M8.5 18h4.5" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17 9.2 3.8 3.8 0 0 1 16.5 18H7z"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7h7M8.5 12.5h.01M12 12.5h.01M15.5 12.5h.01M8.5 16h.01M12 16h.01M15.5 16h.01" stroke-width="2" stroke-linecap="round"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2.5h-15L6 16z"/><path d="M10 21a2.2 2.2 0 0 0 4 0" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5" stroke-width="2" stroke-linecap="round" fill="none"/>',
    lang: '<path d="M4 5h9M8.5 3v2M6.5 5c0 4 3 6.5 7 7.5M14 10c-1 2-3 4.5-6 6M14 14.5l4 7M15 16.5h6M14.5 21.5l-2 3" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    ruler: '<rect x="3" y="9.5" width="18" height="5" rx="1.2" transform="rotate(-8 12 12)"/><path d="M7 10.6l-.7 2M10.6 9.8l-.7 2M14.2 9l-.7 2M17.8 8.3l-.7 2" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    shape: '<path d="M4 18L12 5l8 13H4z"/><path d="M8.8 14.5h6.4" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
    percent: '<circle cx="8" cy="8" r="3.2"/><circle cx="16" cy="16" r="3.2"/><path d="M19.5 4.5l-15 15" stroke-width="1.9" stroke-linecap="round" fill="none"/>',
    timer: '<circle cx="12" cy="13" r="7.5"/><path d="M9 2.5h6M12 2.5V6" stroke-width="1.8" stroke-linecap="round"/><path d="M12 9.5V13l2.6 1.8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.3" fill="currentColor"/><circle cx="15" cy="9" r="1.3" fill="currentColor"/><circle cx="9" cy="15" r="1.3" fill="currentColor"/><circle cx="15" cy="15" r="1.3" fill="currentColor"/>',
    idiom: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M8 9.5h8M8 12.5h5" stroke-width="1.5" stroke-linecap="round"/><path d="M17.5 13l2.5 3.5-1 .8L16.5 14" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    xmark: '<path d="M6 6l12 12M18 6L6 18" stroke-width="2.6" stroke-linecap="round" fill="none"/>',
    star: '<path d="M12 3.6l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6-5.1-2.8-5.1 2.8 1.1-5.6-4.2-3.9 5.7-.7 2.5-5.2z"/>',
    send: '<path d="M4 11.5L20 4l-5.5 16-3.2-6.3L4 11.5z"/><path d="M11.3 13.7L20 4" stroke-width="1.4" stroke-linecap="round" fill="none"/>',
    back: '<path d="M15 5l-7 7 7 7" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4h-4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    reset: '<path d="M4.5 12a7.5 7.5 0 1 1 2.2 5.3"/><path d="M4.5 19.5v-4.5H9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l3 3M13.5 9.5l2.5 2.5" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.2" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
    happy: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.2 2 3.5 2 3.5-2 3.5-2M9 9.5h.01M15 9.5h.01" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.3"/>',
    link: '<path d="M9.5 14.5l5-5M7.5 12.5l-2 2a3.2 3.2 0 0 0 4.5 4.5l2.5-2.5M16.5 11.5l2-2a3.2 3.2 0 0 0-4.5-4.5l-2.5 2.5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    /* ===== 职业相关图标补充 ===== */
    pen: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-.4-.4-2.1 2.5-2.5z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    lab: '<path d="M9 3h6M10 3v6.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V3M7.5 15h9" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" stroke-width="1.7" fill="none"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4M12 15v3" stroke-width="1.7" stroke-linecap="round" fill="none"/>',
    alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M12 9v4M12 17h.01" stroke-width="2" stroke-linecap="round"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8a2 2 0 0 0-3 0zM12 15l-3-3c.5-4 3-7 7-9 2 4 1 7-1 9-1.5 1.5-3 2-3 2z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="15" cy="9" r="1.2"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6" stroke-width="2" stroke-linecap="round"/>',
    car: '<path d="M5 17h14M5 17v-3l2-5h10l2 5v3M5 17a2 2 0 1 0 4 0M15 17a2 2 0 1 0 4 0" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="12" cy="13" r="4"/>',
    factory: '<path d="M2 20h20M4 20V8l6 4V8l6 4V4h4v16" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    box: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M3.3 7L12 12l8.7-5M12 22V12" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20v-1a6 6 0 0 1 12 0v1M16 5.5a3.5 3.5 0 0 1 0 6.5M21.5 20v-1a6 6 0 0 0-4-5.6" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    scale: '<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0L5 7zM19 7l-3 7a3 3 0 0 0 6 0l-3-7M8 21h8" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" stroke-width="1.7" fill="none"/>',
    cog: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5l1.5 1.2-1.8 3.1-1.9-.7a7 7 0 0 1-1.6.9l-.3 2H10.7l-.3-2a7 7 0 0 1-1.6-.9l-1.9.7-1.8-3.1 1.5-1.2a6.9 6.9 0 0 1 0-1.8L5.1 10.5l1.8-3.1 1.9.7a7 7 0 0 1 1.6-.9l.3-2h2.6l.3 2a7 7 0 0 1 1.6.9l1.9-.7 1.8 3.1-1.5 1.2a6.9 6.9 0 0 1 0 1.8z" stroke-width="1.5" fill="none"/>',
    ticket: '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" stroke-width="1.7" fill="none"/><path d="M13 6v12" stroke-width="1.7" stroke-dasharray="2 2"/>',
    headset: '<path d="M3 14v-2a9 9 0 0 1 18 0v2M3 14a2 2 0 0 1 2-2h1v6H5a2 2 0 0 1-2-2v-2zM21 14a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2v-2zM19 18a3 3 0 0 1-3 3h-2" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 3 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 9 8.4z" stroke-width="1.7" fill="none"/><path d="M8 11h.01M12 11h.01M16 11h.01" stroke-width="2.5" stroke-linecap="round"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01" stroke-width="2.5" stroke-linecap="round"/>',
    archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" stroke-width="1.7" stroke-linecap="round" fill="none"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" stroke-width="1.7" fill="none"/>',
    graduation: '<path d="M22 10L12 5 2 10l10 5 10-5z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 10v5" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    stethoscope: '<path d="M6 3v5a4 4 0 0 0 8 0V3M6 3H4m4 0h2M14 3v5a4 4 0 0 1-4 4M20 16a4 4 0 0 1-8 0v-3" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="20" cy="16" r="2"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/><path d="M12 21a3 3 0 0 1-3-3c0-1.5 1.5-2 1.5-3.5S12 13 12 13s1.5.5 1.5 1.5S15 16.5 15 18a3 3 0 0 1-3 3z" stroke-width="1.5" fill="none"/>',
    microscope: '<path d="M6 18h12M9 18a3 3 0 0 0 3-3V6M12 6l3-3 3 3M12 10h4M14 13h2" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 16-9 0 10-4 16-9 16z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M4 20c3-5 7-8 13-9" stroke-width="1.7" stroke-linecap="round" fill="none"/>',
    utensils: '<path d="M3 2v7a3 3 0 0 0 6 0V2M6 2v20M17 2c-2 0-3 2-3 5s1 4 3 4v11" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    truck: '<rect x="1" y="6" width="13" height="10" rx="1"/><path d="M14 9h4l3 3v4h-7M6 19a2 2 0 1 0 4 0M17 19a2 2 0 1 0 4 0" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    plane: '<path d="M17.8 19.2L16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2a.8.8 0 0 0-.8 1.3L8 11l-3 3-2 .5 2 4 4-2 3 3 3.5-2.4a.8.8 0 0 0 .3-.9z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" stroke-width="2" stroke-linecap="round"/>',
    dollar: '<line x1="12" y1="2" x2="12" y2="22" stroke-width="1.7"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke-width="1.7" stroke-linecap="round" fill="none"/>',
    bookopen: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  };

  function icon(name, size) {
    size = size || 22;
    return '<svg class="icon" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.info) + "</svg>";
  }

  /* ---------- 飘分/加星 ---------- */
  function addScore(el, delta) {
    if (!el) return;
    var cur = parseInt(el.getAttribute("data-score") || "0", 10) + delta;
    el.setAttribute("data-score", String(cur));
    el.textContent = "★ " + cur;
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
  }

  return {
    $: $, esc: esc, delay: delay, showSection: showSection,
    typewriter: typewriter, toast: toast, celebrate: celebrate,
    icon: icon, addScore: addScore
  };
})();
