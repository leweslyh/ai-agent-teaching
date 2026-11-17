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
    // 点击顶栏品牌（图标 + 标题）返回首页
    var brand = $("brand-home");
    if (brand) brand.addEventListener("click", function () {
      U.showSection("cover");
    });
  }

  function initSettings() {
    var mask = $("settings-mask");
    var key = $("set-key");
    var asrKey = $("set-asr-key");

    function open() {
      var api = AgentLab.Store.getApi();
      var cloud = AgentLab.Store.getCloud();
      key.value = api.key || "";
      if (asrKey) asrKey.value = (cloud && cloud.key) || "";
      mask.classList.add("show");
      setTimeout(function () { key.focus(); }, 50);
    }
    function close() { mask.classList.remove("show"); }

    $("btn-settings").addEventListener("click", open);
    $("set-cancel").addEventListener("click", close);
    mask.addEventListener("click", function (e) { if (e.target === mask) close(); });

    /* 声音测试：点一下就知道“这台设备到底能不能响”，
     * 不响时直接说明原因（浏览器拦截 / 系统静音），不用去猜。 */
    var soundBtn = $("set-sound-test");
    if (soundBtn) soundBtn.addEventListener("click", function () {
      AgentLab.UI.Alarm.unlock();
      AgentLab.UI.Alarm.test();          // 响两声，并自己弹一条“能不能响”的 toast
      var tip = $("set-sound-state");
      setTimeout(function () {
        var s = AgentLab.UI.Alarm.state();
        var ok = s === "running";
        if (tip) {
          tip.textContent = ok
            ? "音频已就绪（running）：没听到就检查系统音量 / 标签页是否静音"
            : "音频被浏览器拦住了（" + s + "）：请先在页面上随便点一下，再点一次测试";
          tip.className = "sound-state " + (ok ? "is-ok" : "is-bad");
        }
      }, 500);
    });

    // 清除浏览器本地保存的两个密钥（DeepSeek + 硅基流动），恢复到未设置状态
    var clearBtn = $("set-clear");
    if (clearBtn) clearBtn.addEventListener("click", function () {
      if (!confirm("确定要清除本机保存的密钥吗？\n\n清除后 AI 对话、语音/图片识别将不可用，需要重新输入密钥。")) return;
      AgentLab.Store.resetApi();
      AgentLab.Store.resetCloud();
      key.value = "";
      if (asrKey) asrKey.value = "";
      U.toast("已清除本机保存的密钥（知识讲解、游戏、小测验仍可正常使用）", "success");
      if (AgentLab.LabPerception && AgentLab.LabPerception.refreshStatus) {
        AgentLab.LabPerception.refreshStatus();
      }
      if (AgentLab.LabPlanner && AgentLab.LabPlanner.refreshModelBar) {
        AgentLab.LabPlanner.refreshModelBar();
      }
    });

    $("set-save").addEventListener("click", function () {
      var k = key.value.trim();
      if (k && k.length < 10) {
        U.toast("API Key 格式不正确，请检查（应以 sk- 开头）", "error");
        return;
      }
      /* 模型固定用系统默认的（config.js 里的 model，当前是 DeepSeek V4.1 Flash 1017）：
       * 设置里只让老师填 Key，不再选模型；升级模型只需改 config.js 一处 */
      AgentLab.Store.saveApi({ key: k, model: AgentLab.CONFIG.model });

      var ck = asrKey ? asrKey.value.trim() : "";
      if (ck && ck.length < 10) {
        U.toast("云端能力密钥格式不正确，请检查（应以 sk- 开头）", "error");
        return;
      }
      AgentLab.Store.saveCloud({ key: ck });

      U.toast("设置已保存！" + (k ? "可以开始使用 AI 对话了" : "（未设置 Key，知识讲解和游戏仍可使用）"), "success");
      close();
      // 密钥变化后刷新各实验室的状态提示（感知器的云端能力 / 思维链实验当前用的模型）
      if (AgentLab.LabPerception && AgentLab.LabPerception.refreshStatus) {
        AgentLab.LabPerception.refreshStatus();
      }
      if (AgentLab.LabPlanner && AgentLab.LabPlanner.refreshModelBar) {
        AgentLab.LabPlanner.refreshModelBar();
      }
    });
  }

  /* ---------- 首次使用 API Key 引导 ----------
   * 与右上角「设置」用同一套字段：DeepSeek 主密钥 + 硅基流动云端能力密钥。
   * 两个都独立、都可留空；至少填一个才允许保存（否则走「稍后再说」）。 */
  function initApiKeyGuide() {
    var mask = $("apikey-mask");
    var input = $("apikey-input");
    var sfInput = $("apikey-sf-input");
    if (!mask) return;

    var api = AgentLab.Store.getApi();
    var cloud = AgentLab.Store.getCloud();

    // 任何一个 Key 已设置，或已经点过「稍后再说」，就不再打扰
    var hasKey = (api.key && api.key.length > 10) || (cloud && cloud.key && cloud.key.length > 10);
    var skipped = AgentLab.Store.get("apikey_guide_skipped");
    if (hasKey || skipped) return;

    // 延迟 1 秒显示，让页面先渲染
    setTimeout(function () {
      if (input) input.value = api.key || "";
      if (sfInput) sfInput.value = (cloud && cloud.key) || "";
      mask.style.display = "flex";
      setTimeout(function () {
        // 已经有哪一项就聚焦另一项；都没有就聚焦 DeepSeek
        var target = (api.key && sfInput) ? sfInput : (input || sfInput);
        if (target && target.focus) target.focus();
      }, 300);
    }, 1000);

    function close() {
      mask.style.display = "none";
    }

    function save() {
      var k = input ? input.value.trim() : "";
      var ck = sfInput ? sfInput.value.trim() : "";

      if (!k && !ck) {
        U.toast("两个 Key 至少填一个；也可以点「稍后再说」先逛实验室", "error");
        return;
      }
      if (k && k.length < 10) {
        U.toast("DeepSeek API 密钥格式不正确（应以 sk- 开头）", "error");
        return;
      }
      if (ck && ck.length < 10) {
        U.toast("硅基流动密钥格式不正确（应以 sk- 开头）", "error");
        return;
      }

      if (k) AgentLab.Store.saveApi({ key: k, model: AgentLab.CONFIG.model });
      if (ck) AgentLab.Store.saveCloud({ key: ck });

      var parts = [];
      if (k) parts.push("AI 对话已可用");
      else parts.push("没填 DeepSeek Key，AI 对话会降级");
      if (ck) parts.push("云端能力（语音 / 图片识别 / 思维链）已就绪");
      U.toast("Key 已保存！" + parts.join("；"), "success");
      close();

      // 与设置里保存后一样：刷新各实验室的状态提示
      if (AgentLab.LabPerception && AgentLab.LabPerception.refreshStatus) {
        AgentLab.LabPerception.refreshStatus();
      }
      if (AgentLab.LabPlanner && AgentLab.LabPlanner.refreshModelBar) {
        AgentLab.LabPlanner.refreshModelBar();
      }
    }

    $("apikey-save").addEventListener("click", save);

    $("apikey-skip").addEventListener("click", function () {
      AgentLab.Store.set("apikey_guide_skipped", "1");
      U.toast("已跳过。知识讲解、游戏、小测验不需要 Key 也能使用～", "info");
      close();
    });

    // 回车保存（两个输入框都支持）
    [input, sfInput].forEach(function (el) {
      if (!el) return;
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter") $("apikey-save").click();
      });
    });
  }

  function init() {
    AgentLab.LabCover.render();
    AgentLab.LabOrigin.render();
    AgentLab.LabHome.init();
    AgentLab.LabPerception.render();
    AgentLab.LabPlanner.render();
    AgentLab.LabMemory.render();
    AgentLab.LabExecutor.render();
    AgentLab.LabPlayground.render();
    AgentLab.LabWorks.render();

    // 全部栏目渲染完成后，统一卡片编号（各栏目口径一致）
    AgentLab.LabPerception.numberCards();

    initNav();
    initSettings();
    initApiKeyGuide();

    // 默认显示封面页
    U.showSection("cover");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
