/* ============================================================
 * store.js —— 记忆器数据存取（localStorage）
 * 班级知识库、说明书、工具开关、API 设置都保存在本地浏览器里，
 * 关闭页面再打开也不会丢（这就是“长期记忆小本子”）。
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

AgentLab.Store = (function () {
  var KEYS = {
    classInfo: "agentlab_class_info_v1",
    manual: "agentlab_manual_v1",
    tools: "agentlab_tools_v1",
    api: "agentlab_api_v1"
  };

  function read(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      if (v === null || v === undefined) return fallback;
      return JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    /* ---------- 通用存取（任意 key-value） ---------- */
    get: function (key, fallback) {
      try {
        var v = localStorage.getItem("agentlab_" + key);
        if (v === null || v === undefined) return fallback;
        return JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        localStorage.setItem("agentlab_" + key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },

    /* ---------- 班级知识库（长期记忆） ---------- */
    getClassInfo: function () {
      return read(KEYS.classInfo, AgentLab.CONFIG.defaultClassInfo);
    },
    saveClassInfo: function (info) {
      return write(KEYS.classInfo, info);
    },
    resetClassInfo: function () {
      localStorage.removeItem(KEYS.classInfo);
    },

    /* ---------- 《小管家说明书》 ---------- */
    getManual: function () {
      return read(KEYS.manual, AgentLab.CONFIG.defaultManual);
    },
    saveManual: function (manual) {
      return write(KEYS.manual, manual);
    },
    resetManual: function () {
      localStorage.removeItem(KEYS.manual);
    },

    /* ---------- 工具开关 ---------- */
    getTools: function () {
      var t = read(KEYS.tools, null);
      var d = AgentLab.CONFIG.defaultTools;
      if (!t) return Object.assign({}, d);
      var out = {};
      for (var k in d) out[k] = (t[k] === undefined) ? d[k] : !!t[k];
      return out;
    },
    saveTools: function (tools) {
      return write(KEYS.tools, tools);
    },

    /* ---------- API 设置 ---------- */
    getApi: function () {
      return read(KEYS.api, {
        key: AgentLab.CONFIG.apiKey,
        model: AgentLab.CONFIG.model
      });
    },
    saveApi: function (api) {
      return write(KEYS.api, api);
    }
  };
})();
