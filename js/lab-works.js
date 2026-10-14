/* ============================================================
 * 作品展示 · lab-works.js
 * ------------------------------------------------------------
 * 第 8 个栏目：展示两个由四大组件真实搭出来的智能体作品——
 *   作品一「班级小助手」、作品二「出行小管家」。
 * 每个作品 = 简介 + 制作过程（分步图解）+ 原理拆解（四组件）+ 可交互实时演示。
 *
 * 职责分工（单一职责）：
 *   · 本文件只负责「渲染 + 交互」；
 *   · 作品内容（提示词 / 工具子集 / 示例 / 制作步骤）在 config.js 的 AgentLab.WORKS 里；
 *   · 真实智能体的执行复用 agent.js 的 Agent.run(text, history, hooks, profile)。
 * 想加新作品：只改 config.js 的 AgentLab.WORKS + WORK_ORDER，本文件无需改动。
 * ============================================================ */
window.AgentLab = window.AgentLab || {};

AgentLab.LabWorks = (function () {
  var U = AgentLab.UI;
  var $ = U.$;
  var LP = AgentLab.LabPerception;
  var Agent = AgentLab.Agent;

  /* 每个作品一份运行时状态：短期记忆（对话）+ 是否正在忙 + 本轮内部工作信息。
   * 与「智能体实验室」各自独立，互不影响。 */
  var RT = {};

  /* 演示区的「内部工作小灯」：大脑居中、四组件环绕（与「智能体实验室」的内部工作台同口径）。
   * 对话时按真实执行顺序同步亮起来，把原理讲在当场。 */
  var LIGHT = [
    { id: "brain", name: "大脑", icon: "brain", color: "brain" },
    { id: "perception", name: "感知器", icon: "eye", color: "per" },
    { id: "planner", name: "规划器", icon: "gear", color: "plan" },
    { id: "memory", name: "记忆器", icon: "book", color: "mem" },
    { id: "executor", name: "执行器", icon: "hand", color: "exe" }
  ];

  /* stage id → 小灯元数据。轨迹行直接复用这张表，
   * 不另造一套阶段名（阶段名与回调口径全站只有一份：agent.js）。 */
  var STAGE_ROW = {};
  LIGHT.forEach(function (l) { STAGE_ROW[l.id] = l; });

  /* 工具 key → 中文标签（用于作品头部的「工具胶囊」） */
  var TOOL_LABEL = {
    weather: "天气查询", calc: "计算器", remind: "提醒", classInfo: "课表查询",
    search: "联网搜索", translate: "翻译", convert: "单位换算", datetime: "时间日期",
    shape: "图形计算", math: "数学计算", timer: "计时器"
  };

  /* ---------- 小工具 ---------- */
  function hasKey() { return !!(AgentLab.API && AgentLab.API.hasApiKey && AgentLab.API.hasApiKey()); }

  /* ---------- 页面渲染 ---------- */
  function render() {
    var sec = $("sec-works");
    if (!sec) return;

    var works = (AgentLab.WORK_ORDER || []).map(function (id) { return AgentLab.WORKS[id]; })
      .filter(function (w) { return !!w; });

    sec.innerHTML =
      LP.labHead("works", "star", "作品展示",
        "看两个用四组件搭出来的真实智能体 · 作品集") +

      /* 本课学习地图（与学习目标并排折叠，装配见 ui.js 的 foldBrief） */
      U.sectionMap({
        color: "works",
        head: "本课学习地图",
        groups: [
          {
            label: "作品一 · 班级小助手", items: [
              { t: "它是什么", el: "work-classAssistant" },
              { t: "怎么做出来的", el: "steps-classAssistant", note: "分步图解" },
              { t: "背后原理", el: "principles-classAssistant", note: "四组件" },
              { t: "和它聊聊", el: "demo-classAssistant", note: "实时对话" }
            ]
          },
          {
            label: "作品二 · 出行小管家", items: [
              { t: "它是什么", el: "work-travelAssistant" },
              { t: "怎么做出来的", el: "steps-travelAssistant", note: "分步图解" },
              { t: "背后原理", el: "principles-travelAssistant", note: "四组件" },
              { t: "和它聊聊", el: "demo-travelAssistant", note: "实时对话" }
            ]
          },
          {
            label: "收尾 · 对比与总结", items: [
              { t: "两个作品对比", el: "works-summary", note: "小结" }
            ]
          }
        ]
      }) +

      /* 学习目标（card-works：作品展示专属青绿，与页头图标同色系） */
      '<div class="lesson-goal card-works">' +
        '<h3>' + U.icon("target", 18) + " 本课学习目标</h3>" +
        '<div class="goal-list">' +
          '<div class="goal-item"><span class="goal-num">1</span>看懂两个真实作品是怎么用「感知器 / 规划器 / 记忆器 / 执行器」搭出来的</div>' +
          '<div class="goal-item"><span class="goal-num">2</span>能按六步说清一个智能体的制作过程：定目标 → 配感知 → 写提示词 → 装工具 → 接记忆 → 联调</div>' +
          '<div class="goal-item"><span class="goal-num">3</span>发现两个作品用的是同一套四组件，差别只在「记忆内容」和「工具配置」</div>' +
          '<div class="goal-item"><span class="goal-num">4</span>敢自己动手，照着这套方法搭一个属于自己的小智能体</div>' +
        "</div>" +
      "</div>" +

      works.map(workBlock).join("") +

      summaryCard();

    /* 重置运行时状态并写上一句欢迎语 */
    RT = {};
    works.forEach(function (w) {
      RT[w.id] = { history: [], busy: false, tools: 0, t0: 0 };
      addMsg(w, "ai", w.greeting);
      resetTrace(w);
    });

    bind();
  }

  /* ---------- 单个作品的完整板块 ---------- */
  function workBlock(work) {
    return worksHero(work) +
      introCard(work) +
      stepsCard(work) +
      principlesCard(work) +
      demoCard(work);
  }

  /* 作品头（不是编号卡，是一条“作品集”横幅，给学生进入作品的仪式感） */
  function worksHero(work) {
    var tools = (work.toolKeys || []).map(function (k) {
      return '<span class="works-tool">' + U.esc(TOOL_LABEL[k] || k) + "</span>";
    }).join("");
    return '<div class="works-hero" data-color="works">' +
      '<div class="works-hero-ico">' + U.icon(work.icon, 26) + "</div>" +
      '<div class="works-hero-txt">' +
        '<div class="works-hero-badge">' + U.esc(work.badge) + "</div>" +
        '<h2 class="works-hero-name">' + U.esc(work.name) + "</h2>" +
        '<div class="works-hero-tag">' + U.esc(work.tagline) + "</div>" +
      "</div>" +
      '<div class="works-hero-tools"><span class="works-tools-label">' + U.icon("wrench", 13) + ' 它装好的工具</span>' +
        '<span class="works-tools-row">' + tools + "</span></div>" +
    "</div>";
  }

  /* ① 简介卡 */
  function introCard(work) {
    var can = (work.intro.can || []).map(function (c) {
      return "<li>" + U.esc(c) + "</li>";
    }).join("");
    return LP.card("works",
      "先认识它：" + work.name,
      work.badge + " · 它是什么、能帮同学做什么",
      '<div class="works-intro">' +
        '<p class="works-intro-lead">' + U.esc(work.intro.what) + "</p>" +
        '<div class="works-intro-for"><span class="wi-label">' + U.icon("users", 14) + ' 给谁用</span>' +
          U.esc(work.intro.forWho) + "</div>" +
        '<div class="works-can"><div class="works-can-title">' + U.icon("check", 14) + ' 它能帮你</div>' +
          '<ul class="works-can-list">' + can + "</ul></div>" +
      "</div>",
      { id: "work-" + work.id });
  }

  /* ② 制作过程卡（分步骤图解） */
  function stepsCard(work) {
    var steps = (work.steps || []).map(function (s, i) {
      return '<li class="works-step" data-i="' + i + '">' +
        '<span class="ws-no">' + (i + 1) + "</span>" +
        '<span class="ws-ico">' + U.icon(s.icon, 16) + "</span>" +
        '<div class="ws-body"><div class="ws-title">' + U.esc(s.title) + "</div>" +
          '<div class="ws-text">' + U.esc(s.text) + "</div></div>" +
      "</li>";
    }).join("");
    return LP.card("works",
      "怎么做出来的：六步搭好一个智能体",
      work.badge + " · 制作过程（一步步图解）",
      '<div class="works-steps-head">' +
        '<span class="works-steps-hint">' + U.icon("info", 13) +
          " 点「一步一步点亮」，跟着走一遍制作流程；也可以点每一格单独看。</span>" +
        '<button type="button" class="btn btn-ghost btn-sm works-steps-btn" data-steps="' + work.id + '">' +
          U.icon("spark", 14) + " 一步一步点亮</button>" +
      "</div>" +
      '<ol class="works-steps">' + steps + "</ol>",
      { id: "steps-" + work.id });
  }

  /* ③ 原理拆解卡（对照四大组件） */
  function principlesCard(work) {
    var items = (work.principles || []).map(function (p) {
      return '<div class="works-prin-item" data-color="' + p.color + '">' +
        '<span class="wp-ico">' + U.icon(p.icon, 18) + "</span>" +
        '<div class="wp-body"><div class="wp-comp">' + U.esc(p.comp) + "</div>" +
          '<div class="wp-text">' + U.esc(p.text) + "</div></div>" +
      "</div>";
    }).join("");
    return LP.card("works",
      "背后原理：四大组件各管一段",
      work.badge + " · 它是怎么被“拆”出来理解的",
      '<div class="works-prin">' + items + "</div>" +
      '<div class="works-prin-note">' + U.icon("zap", 14) +
        " 记住这句话：<b>智能体 = 大脑（大模型）+ 感知器 + 规划器 + 记忆器 + 执行器</b>。" +
        "换一个作品，换的往往只是记忆里存什么、执行器装哪些工具。</div>",
      { id: "principles-" + work.id });
  }

  /* ④ 可交互实时演示卡 */
  function demoCard(work) {
    var chips = (work.suggestions || []).map(function (s) {
      return '<button type="button" class="chip-suggest" data-q="' + U.esc(s) + '">' + U.esc(s) + "</button>";
    }).join("");

    var lights = LIGHT.map(function (l) {
      return '<div class="works-light" data-stage="' + l.id + '" data-color="' + l.color + '">' +
        '<span class="wl-ico">' + U.icon(l.icon, 15) + "</span>" +
        '<span class="wl-name">' + l.name + "</span>" +
        '<span class="wl-txt">等待提问……</span>' +
      "</div>";
    }).join("");

    var keyHint = hasKey() ? "" :
      '<div class="works-keyhint">' + U.icon("info", 14) +
        " 当前没有配置 API Key —— 对话会走 <b>本地规则降级演示</b>（仍能看到四组件的流程）。" +
        "在页面右上角「设置」里填入 Key，就能和真实智能体对话。</div>";

    return LP.card("works",
      "试试看：和它聊两句",
      work.badge + " · 实时演示（真实对话 · 会消耗 API Key）",
      '<div class="works-demo" data-work="' + work.id + '">' +
        '<div class="works-chat">' +
          '<div class="chat-head">' +
            '<div class="chat-avatar">' + U.icon(work.avatar, 22) + "</div>" +
            '<div class="works-chat-id"><b>' + U.esc(work.name) + "</b>" +
              "<span>" + U.esc(work.badge) + " · 真实智能体</span></div>" +
            '<button type="button" class="btn btn-ghost btn-sm works-clear" data-wclear="' + work.id + '" style="margin-left:auto">' +
              U.icon("reset", 14) + " 新对话</button>" +
          "</div>" +
          keyHint +
          '<div class="chat-msgs" id="w-msgs-' + work.id + '"></div>' +
          '<div class="chip-row" id="w-chips-' + work.id + '">' + chips + "</div>" +
          '<div class="chat-input">' +
            '<input type="text" id="w-input-' + work.id + '" placeholder="输入你的问题，按回车发送……">' +
            '<button type="button" class="btn btn-works" id="w-send-' + work.id + '">' +
              U.icon("send", 16) + " 发送</button>" +
          "</div>" +
        "</div>" +
        '<aside class="works-live" id="w-live-' + work.id + '">' +
          '<div class="works-live-head">' +
            '<div class="works-live-title">' + U.icon("brain", 16) + " 它在想什么" +
              '<span class="wl-sub">内部工作信息</span></div>' +
            '<div class="works-live-meta">' +
              '<span class="wl-meta"><i>轮次</i><b data-meta="round">0</b></span>' +
              '<span class="wl-meta"><i>工具</i><b data-meta="tools">0</b></span>' +
              '<span class="wl-meta"><i>用时</i><b data-meta="ms">—</b></span>' +
            "</div>" +
          "</div>" +
          '<div class="works-stages" id="w-stages-' + work.id + '">' + lights + "</div>" +
          '<div class="works-trace-wrap">' +
            '<div class="works-trace-head">' + U.icon("archive", 14) + " 本轮轨迹" +
              '<span class="works-trace-n" data-trace-n>0 步</span></div>' +
            '<div class="works-trace" id="w-trace-' + work.id + '">' +
              '<div class="works-trace-empty">发一句话试试——这里会按顺序记下它每一步做了什么。</div>' +
            "</div>" +
          "</div>" +
          '<div class="works-note"><b>它背后的原理：</b>' + U.esc(work.principleNote) + "</div>" +
        "</aside>" +
      "</div>",
      { id: "demo-" + work.id });
  }

  /* ⑤ 收尾对比小结卡 */
  function summaryCard() {
    var rows = [
      ["它是谁", "班级里的事务小帮手", "出门旅行前的小参谋"],
      ["感知器", "把同学的问题变成模型能读的输入", "把出行的问题变成模型能读的输入"],
      ["规划器", "听懂“查课表 / 设提醒”，选出工具、排好顺序", "听懂“查天气 / 换单位”，把出行任务拆成几步"],
      ["记忆器", "班级知识库：课表 · 值日 · 通知", "本次行程信息：目的地 · 日期 · 要带的东西"],
      ["执行器", "课表查询、提醒、计时、计算、翻译、搜索", "天气查询、单位换算、时间、计算、提醒、搜索"],
      ["适合问它", "“今天下午有什么课？”", "“明天杭州会下雨吗？要不要带伞”"]
    ];
    var table = '<table class="works-cmp"><thead><tr>' +
      "<th>比一比</th><th>班级小助手</th><th>出行小管家</th></tr></thead><tbody>" +
      rows.map(function (r) {
        return "<tr><th>" + U.esc(r[0]) + "</th><td>" + U.esc(r[1]) + "</td><td>" + U.esc(r[2]) + "</td></tr>";
      }).join("") +
      "</tbody></table>";

    return LP.card("works",
      "两个作品比一比：同一套四组件，不同的记忆与工具",
      "作品一 + 作品二 · 对比与小结",
      '<div class="works-cmp-wrap">' + table + "</div>" +
      '<div class="summary-core"><b>结论：</b>两个作品都是同一套「大脑 + 感知器 + 规划器 + 记忆器 + 执行器」搭出来的——' +
        "它们真正的差别只有两处：<b>记忆器里存什么</b>（一个存班级知识库，一个存行程信息）、" +
        "<b>执行器装哪些工具</b>（一个装课表查询，一个装天气与换算）。</div>" +
      '<div class="works-formula">' +
        '<div class="works-formula-title">' + U.icon("spark", 15) + " 搭智能体的通用六步</div>" +
        '<div class="works-formula-steps">' +
          ["定目标", "配感知", "写提示词", "装工具", "接记忆", "联调测试"].map(function (s) {
            return '<span class="wf-step">' + s + "</span>";
          }).join('<i class="wf-arrow">→</i>') +
        "</div>" +
        '<div class="works-formula-note">照着走一遍，你也能搭一个属于自己的小智能体——比如“作业小助手”“运动小教练”。</div>' +
      "</div>",
      { id: "works-summary" });
  }

  /* ---------- 演示区：对话与四组件小灯 ---------- */
  function addMsg(work, role, text, cls) {
    var box = $("w-msgs-" + work.id);
    if (!box) return null;
    var d = document.createElement("div");
    d.className = "msg " + (role === "user" ? "user" : "ai") + (cls ? " " + cls : "");
    d.innerHTML = '<span class="who">' + (role === "user" ? "我" : U.esc(work.name)) + "</span>" + U.esc(text);
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    return d;
  }

  function addNote(work, html) {
    var box = $("w-msgs-" + work.id);
    if (!box) return;
    var d = document.createElement("div");
    d.className = "msg tool-note";
    d.innerHTML = html;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }

  /* ---------- 内部工作信息：统计胶囊 / 小灯行 / 本轮轨迹 ---------- */

  function clip(s, n) {
    s = String(s == null ? "" : s);
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }

  function setMeta(work, key, val) {
    var el = document.querySelector("#w-live-" + work.id + ' [data-meta="' + key + '"]');
    if (el) el.textContent = val;
  }

  /* 清空这一轮的内部工作信息：统计归零、小灯熄灭、轨迹留一句引导 */
  function resetTrace(work) {
    var box = $("w-trace-" + work.id);
    if (box) {
      box.innerHTML = '<div class="works-trace-empty">发一句话试试——这里会按顺序记下它每一步做了什么。</div>';
    }
    var n = document.querySelector("#w-live-" + work.id + " [data-trace-n]");
    if (n) n.textContent = "0 步";
    setMeta(work, "round", "0");
    setMeta(work, "tools", "0");
    setMeta(work, "ms", "—");

    var st = $("w-stages-" + work.id);
    if (!st) return;
    st.querySelectorAll(".works-light").forEach(function (row) {
      row.classList.remove("on", "skip");
      var t = row.querySelector(".wl-txt");
      if (t) t.textContent = "等待提问……";
    });
  }

  /* 点亮某个组件的小灯：flag 为 "skip" 时标灰（本轮未参与），否则点亮。
   * text 是 agent.js 回调里的真实一句，缩略后贴在小灯右侧——一眼看出"它刚才做了什么"。 */
  function markLight(work, stageId, flag, text) {
    var box = $("w-stages-" + work.id);
    if (!box) return;
    var row = box.querySelector('.works-light[data-stage="' + stageId + '"]');
    if (!row) return;
    row.classList.remove("on", "skip");
    row.classList.add(flag === "skip" ? "skip" : "on");
    var t = row.querySelector(".wl-txt");
    if (t && text) t.textContent = flag === "skip" ? "本轮未参与" : clip(text, 32);
  }

  /* 往「本轮轨迹」追一行：按真实发生顺序记录，颜色/图标沿用该阶段自己的语义色 */
  function pushTrace(work, row, text) {
    var box = $("w-trace-" + work.id);
    if (!box || !text) return;
    var empty = box.querySelector(".works-trace-empty");
    if (empty && empty.parentNode) empty.parentNode.removeChild(empty);
    var d = document.createElement("div");
    d.className = "wt-row c-" + row.color;
    d.innerHTML = '<span class="wt-who">' + U.icon(row.icon, 13) + " " + U.esc(row.name) + "</span>" +
      '<span class="wt-txt">' + U.esc(text) + "</span>";
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    var n = document.querySelector("#w-live-" + work.id + " [data-trace-n]");
    if (n) n.textContent = box.querySelectorAll(".wt-row").length + " 步";
  }

  /* 轨迹里那些"不是四组件"的行：工具调用 / 收尾 / 出错 */
  var ROW_TOOL = { name: "工具调用", icon: "wrench", color: "tool" };
  var ROW_STOP = { name: "收尾", icon: "check", color: "stop" };
  var ROW_ERR = { name: "出错", icon: "alert", color: "err" };

  /* 发一句话，跑一轮真实智能体流程 */
  async function send(work, text) {
    var rt = RT[work.id];
    if (!rt || rt.busy) return;
    text = (text || "").trim();
    if (!text) return;

    rt.busy = true;
    var input = $("w-input-" + work.id);
    var btn = $("w-send-" + work.id);
    if (input) input.value = "";
    if (btn) btn.disabled = true;

    rt.history.push({ role: "user", content: text });
    if (rt.history.length > Agent.MAX_HISTORY) rt.history = rt.history.slice(-Agent.MAX_HISTORY);

    addMsg(work, "user", text);
    resetTrace(work);
    rt.tools = 0;
    rt.t0 = Date.now();

    /* 作品演示始终以「完整能力」运行：临时打开四个组件，跑完即还原，
     * 这样在「智能体实验室」里关掉过开关，也不会影响这里的作品演示。 */
    var saved = {
      perception: Agent.flags.perception, planner: Agent.flags.planner,
      memory: Agent.flags.memory, executor: Agent.flags.executor
    };
    Agent.flags.perception = true;
    Agent.flags.planner = true;
    Agent.flags.memory = true;
    Agent.flags.executor = true;

    var profile = AgentLab.profileFor(work);

    try {
      await Agent.run(text, rt.history, {
        /* 每一步都同时做两件事：点亮小灯（状态）+ 往轨迹里追一行（证据）。
         * 文字全部来自 agent.js 的真实回调，界面不替它编。 */
        onStage: function (id, t, flag, round) {
          markLight(work, id, flag, t);
          var row = STAGE_ROW[id];
          if (row) pushTrace(work, row, flag === "skip" ? "（本轮未参与）" + (t || "") : t);
          if (typeof round === "number" && round > 0) setMeta(work, "round", round);
        },
        onTool: function (tool) {
          if (!tool || !tool.name) return;
          rt.tools += 1;
          setMeta(work, "tools", rt.tools);
          addNote(work, U.icon("wrench", 13) + " 执行器调用了工具：<b>" + U.esc(tool.name) + "</b>");
          pushTrace(work, ROW_TOOL,
            tool.name + "：" + (tool.summary || "") + " → " + (tool.result || "（没有返回结果）"));
        },
        onStop: function (info) {
          if (!info) return;
          if (info.rounds) setMeta(work, "round", info.rounds);
          if (typeof info.tools === "number") { rt.tools = info.tools; setMeta(work, "tools", rt.tools); }
          pushTrace(work, ROW_STOP, info.reason || "本轮结束");
        },
        onDone: async function (answer) {
          rt.history.push({ role: "assistant", content: answer });
          setMeta(work, "ms", ((Date.now() - rt.t0) / 1000).toFixed(1) + "s");
          var el = addMsg(work, "ai", "");
          if (el) await U.typewriter(el, answer, 12);
        },
        onError: function (err) {
          pushTrace(work, ROW_ERR, (err && err.message) || String(err));
          addMsg(work, "ai",
            "出错了：" + ((err && err.message) || err) +
            "\n\n小提示（卡住三步走）：① 自己读一遍问题并复述 ② 把问题说清楚再问 AI ③ 还不行就求助老师/同伴。");
        }
      }, profile);
    } catch (e) {
      /* 错误已由 onError 提示给学生，这里吞掉异常，避免控制台出现“未处理的 Promise 拒绝”噪音 */
    } finally {
      Agent.flags.perception = saved.perception;
      Agent.flags.planner = saved.planner;
      Agent.flags.memory = saved.memory;
      Agent.flags.executor = saved.executor;
      rt.busy = false;
      if (btn) btn.disabled = false;
      if (input) input.focus();
    }
  }

  /* 清空某个作品的对话，回到欢迎语 */
  function clearChat(work) {
    var rt = RT[work.id];
    if (!rt || rt.busy) return;
    rt.history = [];
    var box = $("w-msgs-" + work.id);
    if (box) box.innerHTML = "";
    addMsg(work, "ai", work.greeting);
    resetTrace(work);
  }

  /* 制作步骤：点一次「一步一步点亮」，依次点亮下一格；全亮后再点则全部熄灭重来 */
  function stepNext(workId) {
    var ol = document.querySelector('#steps-' + workId + ' .works-steps');
    if (!ol) return;
    var items = Array.prototype.slice.call(ol.querySelectorAll(".works-step"));
    var next = items.filter(function (n) { return !n.classList.contains("lit"); })[0];
    if (!next) {
      items.forEach(function (n) { n.classList.remove("lit"); });
      return;
    }
    next.classList.add("lit");
    next.scrollIntoView && next.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /* ---------- 事件绑定（渲染后调用一次） ---------- */
  function bind() {
    var sec = $("sec-works");
    if (!sec) return;

    (AgentLab.WORK_ORDER || []).forEach(function (id) {
      var work = AgentLab.WORKS[id];
      if (!work) return;
      var input = $("w-input-" + id);
      var btn = $("w-send-" + id);
      var chips = $("w-chips-" + id);
      var clr = sec.querySelector('[data-wclear="' + id + '"]');

      if (btn) btn.addEventListener("click", function () { send(work, input ? input.value : ""); });
      if (input) input.addEventListener("keydown", function (e) { if (e.key === "Enter") send(work, input.value); });
      if (chips) chips.addEventListener("click", function (e) {
        var c = e.target.closest && e.target.closest(".chip-suggest");
        if (c) send(work, c.getAttribute("data-q") || c.textContent);
      });
      if (clr) clr.addEventListener("click", function () { clearChat(work); });
    });

    /* 制作步骤：按钮「一步一步点亮」+ 单格点击切换（统一委托，避免逐个绑定） */
    sec.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var sb = t.closest(".works-steps-btn");
      if (sb) { stepNext(sb.getAttribute("data-steps")); return; }
      var st = t.closest(".works-step");
      if (st) st.classList.toggle("lit");
    });
  }

  return { render: render };
})();
