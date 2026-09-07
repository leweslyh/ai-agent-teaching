/* ============================================================
 * main.js —— 入口：初始化导航、设置、渲染全部实验室
 * 静态版：添加首次使用 API Key 引导
 * ============================================================ */

(function () {
  var U = AgentLab.UI;
  var $ = U.$;

  function initNav() {
    document.querySelectorAll(".nav-tab").forEach(function (b) {
      b.addEventListener("click", function () {
        U.showSection(b.getAttribute("data-sec"));
      });
    });
    document.querySelectorAll("[data-back='home']").forEach(function (b) {
      b.addEventListener("click", function () { U.showSection("home"); });
    });
  }

  function initSettings() {
    var mask = $("settings-mask");
    var key = $("set-key");
    var model = $("set-model");

    function open() {
      var api = AgentLab.Store.getApi();
      key.value = api.key || "";
      model.value = api.model || AgentLab.CONFIG.model;
      mask.classList.add("show");
      setTimeout(function () { key.focus(); }, 50);
    }
    function close() { mask.classList.remove("show"); }

    $("btn-settings").addEventListener("click", open);
    $("set-cancel").addEventListener("click", close);
    mask.addEventListener("click", function (e) { if (e.target === mask) close(); });
    $("set-save").addEventListener("click", function () {
      var k = key.value.trim();
      if (k && k.length < 10) {
        U.toast("API Key 格式不正确，请检查（应以 sk- 开头）", "error");
        return;
      }
      AgentLab.Store.saveApi({ key: k, model: model.value });
      U.toast("设置已保存！" + (k ? "可以开始使用 AI 对话了" : "（未设置 Key，知识讲解和游戏仍可使用）"), "success");
      close();
    });
  }

  /* ---------- 首次使用 API Key 引导 ---------- */
  function initApiKeyGuide() {
    var mask = $("apikey-mask");
    var input = $("apikey-input");
    if (!mask) return;

    // 检查是否已设置过 Key 或已跳过引导
    var api = AgentLab.Store.getApi();
    var hasKey = api.key && api.key.length > 10;
    var skipped = AgentLab.Store.get("apikey_guide_skipped");

    if (hasKey || skipped) return; // 已设置或已跳过，不显示

    // 延迟 1 秒显示，让页面先渲染
    setTimeout(function () {
      mask.style.display = "flex";
      setTimeout(function () { input.focus(); }, 300);
    }, 1000);

    function close() {
      mask.style.display = "none";
    }

    $("apikey-save").addEventListener("click", function () {
      var k = input.value.trim();
      if (!k) {
        U.toast("请输入 API Key，或点击「稍后再说」", "error");
        return;
      }
      if (k.length < 10) {
        U.toast("API Key 格式不正确，请检查（应以 sk- 开头）", "error");
        return;
      }
      AgentLab.Store.saveApi({ key: k, model: AgentLab.CONFIG.model });
      U.toast("API Key 已保存！可以开始使用 AI 对话了 🎉", "success");
      close();
    });

    $("apikey-skip").addEventListener("click", function () {
      AgentLab.Store.set("apikey_guide_skipped", "1");
      U.toast("已跳过。知识讲解、游戏、小测验不需要 Key 也能使用～", "info");
      close();
    });

    // 回车保存
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") $("apikey-save").click();
    });
  }

  function init() {
    AgentLab.LabOrigin.render();
    AgentLab.LabHome.init();
    AgentLab.LabPerception.render();
    AgentLab.LabPlanner.render();
    AgentLab.LabMemory.render();
    AgentLab.LabExecutor.render();
    AgentLab.LabPlayground.render();
    initNav();
    initSettings();
    initApiKeyGuide();

    // 默认显示起源实验室
    U.showSection("origin");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
