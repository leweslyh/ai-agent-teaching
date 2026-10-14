/* ============================================================
 * 作品展示 · lab-works.js
 * ------------------------------------------------------------
 * 第 8 个栏目：展示两个由四大组件真实搭出来的智能体作品——
 *   作品一「班级小助手」、作品二「出行小管家」。
 * 每个作品 = 简介 + 制作过程（分步图解）+ 原理拆解（四组件）
 *          + 岗位说明书（真实系统提示词）+ 可交互实时演示（左对话 / 右内部工作台）。
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

  /* 每个环节触发时点亮哪几条边——与「智能体实验室」内部工作台同一张映射表。
   * 执行器那两条边都连大脑：进线是大脑把参数写好后交给它，出线是工具结果回流给大脑。 */
  var STAGE_EDGES = {
    perception: ["per-brain"],
    memory: ["brain-mem-out", "brain-mem-in"],
    executor: ["brain-exe-out", "brain-exe-in"],
    planner: ["brain-plan", "plan-brain"],
    brain: ["per-brain", "brain-mem-out", "brain-mem-in", "brain-exe-out", "brain-exe-in", "brain-plan", "plan-brain"]
  };
  /* ①② 两枚标签跟着自己那条边一起亮/暗 */
  var TAG_EDGE = { "exe-out": "brain-exe-out", "exe-in": "brain-exe-in" };

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
              { t: "怎么做出来的", el: "steps-classAssistant" },
              { t: "背后原理", el: "principles-classAssistant" },
              { t: "岗位说明书", el: "prompt-classAssistant" },
              { t: "和它聊聊", el: "demo-classAssistant" }
            ]
          },
          {
            label: "作品二 · 出行小管家", items: [
              { t: "它是什么", el: "work-travelAssistant" },
              { t: "怎么做出来的", el: "steps-travelAssistant" },
              { t: "背后原理", el: "principles-travelAssistant" },
              { t: "岗位说明书", el: "prompt-travelAssistant" },
              { t: "和它聊聊", el: "demo-travelAssistant" }
            ]
          },
          {
            label: "收尾 · 对比与总结", items: [
              { t: "两个作品对比", el: "works-summary" }
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
          '<div class="goal-item"><span class="goal-num">5</span>能读懂一份真实的「岗位说明书」（系统提示词）：它是谁 · 能用哪些工具 · 什么不做 · 怎么做事</div>' +
        "</div>" +
      "</div>" +

      works.map(workBlock).join("") +

      summaryCard();

    /* 重置运行时状态并写上一句欢迎语 */
    RT = {};
    works.forEach(function (w) {
      RT[w.id] = { history: [], busy: false, tools: 0, t0: 0, wb: null };
      addMsg(w, "ai", w.greeting);
      wbReset(w);
    });

    bind();
  }

  /* ---------- 单个作品的完整板块 ---------- */
  function workBlock(work) {
    return worksHero(work) +
      introCard(work) +
      stepsCard(work) +
      principlesCard(work) +
      promptCard(work) +
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

  /* ③′ 岗位说明书卡：把真实发给大模型的 system 提示词摊开给学生看。
   * 与运行时完全同源——调用同一支 AgentLab.buildWorkPrompt()，
   * 所以这里看到的就是它真正收到的那份「岗位说明书」（含记忆器里当前的班级知识库）。 */
  function promptCard(work) {
    var classInfo = (AgentLab.Store && AgentLab.Store.getClassInfo) ? AgentLab.Store.getClassInfo() : null;
    var manual = (AgentLab.Store && AgentLab.Store.getManual) ? AgentLab.Store.getManual() : null;
    var prompt = "";
    try { prompt = AgentLab.buildWorkPrompt(work, classInfo, manual) || ""; } catch (e) { prompt = ""; }
    var hasKb = !!(AgentLab.hasClassInfo && AgentLab.hasClassInfo(classInfo));
    var scope = String(work.scopeNote || "").replace(/^注意：/, "");

    /* 五段结构：学生最怕"一大段看不懂"，所以先给一张"它由哪几段组成"的对照，
     * 每段说清"这段是干什么的"，再让他按需展开看原文。 */
    var segs = [
      { k: "①", t: "它是谁", on: true, d: "一句话交代身份与职责——模型从这一句开始进入角色。" },
      { k: "②", t: "能用哪些工具", on: true, d: (work.toolKeys || []).length + " 个工具逐个点名：" + U.esc(work.toolLine) + "。" },
      { k: "③", t: "边界：什么不做", on: true, d: U.esc(scope) },
      {
        k: "④", t: "长期记忆", on: !!work.usesClassKB,
        d: work.usesClassKB
          ? (hasKb
            ? "班级知识库（课表 / 值日 / 通知）整段放进提示词——这就是「记忆器」在起作用。"
            : "班级知识库现在是空的：去「记忆器」页填一份课表，这一段就会自动出现在提示词里。")
          : "它不带班级知识库——出行的信息不必写进系统提示词。"
      },
      { k: "⑤", t: "做事方式 + 回答要求", on: true, d: "先想再动、拆步排序、缺信息先反问；说话简短、先给结论、不知道就直说。" }
    ];

    return LP.card("works",
      "它的岗位说明书：提示词长什么样",
      work.badge + " · 真实系统提示词（每次提问都会发给大模型的那一段）",
      '<div class="works-prompt-lead">' + U.icon("pen", 15) +
        ' 提示词（Prompt）就是写给大脑的<b>岗位说明书</b>：它不教模型怎么说话（那是大模型自己的本事），' +
        '而是规定<b>它是谁、能用什么工具、什么不做、怎么做事</b>。下面这份，就是运行时真正会发给 DeepSeek 的那一段。</div>' +
      '<div class="works-prompt-segs">' + segs.map(function (s) {
        return '<div class="wps-item' + (s.on ? "" : " is-off") + '">' +
          '<span class="wps-k">' + s.k + "</span>" +
          '<div class="wps-body"><div class="wps-t">' + s.t + "</div>" +
            '<div class="wps-d">' + s.d + "</div></div>" +
        "</div>";
      }).join("") + "</div>" +
      '<details class="works-prompt-box">' +
        "<summary>" + U.icon("search", 14) + " 展开看完整提示词（" +
          (prompt ? prompt.split("\n").length : 0) + " 行 · " + prompt.length + " 字）</summary>" +
        '<pre class="works-prompt-pre">' + U.esc(prompt) + "</pre>" +
        '<div class="works-prompt-foot">' + U.icon("info", 13) +
          " 这段文字<b>每次提问都会一起发出去</b>（所以它越啰嗦，花的 Token 越多）。" +
          "想改它的性格？改这几行就够了——改完回「智能体实验室」用开关做一次前后对比。</div>" +
      "</details>",
      { id: "prompt-" + work.id });
  }

  /* 演示区右栏的总装图：大脑居中、四组件环绕。
   * 刻意复用「智能体实验室 · 内部工作台」的 .pg-hub 系列样式：
   * 学生在两页看到的是同一张图、同一套语言（节点与连线引用同一组 CSS 变量，缩放不会错位）。 */
  function hubHTML() {
    return '<i class="pg-hub-edge v to-down" data-edge="per-brain"></i>' +
      '<i class="pg-hub-edge h to-left" data-edge="brain-mem-out"></i>' +
      '<i class="pg-hub-edge h to-right" data-edge="brain-mem-in"></i>' +
      '<i class="pg-hub-edge h to-right" data-edge="brain-exe-out"></i>' +
      '<i class="pg-hub-edge h to-left" data-edge="brain-exe-in"></i>' +
      '<i class="pg-hub-edge v to-down" data-edge="brain-plan"></i>' +
      '<i class="pg-hub-edge v to-up" data-edge="plan-brain"></i>' +
      '<span class="pg-hub-tag" data-tag="exe-out">① 按接口写参数</span>' +
      '<span class="pg-hub-tag" data-tag="exe-in">② 结果回传</span>' +
      LIGHT.map(function (l) {
        return '<div class="pg-hub-node n-' + l.color + '" data-stage="' + l.id + '">' +
          '<span class="pg-hub-mark"></span>' +
          '<span class="pg-hub-ico">' + U.icon(l.icon, 19) + "</span>" +
          '<span class="pg-hub-name">' + l.name + "</span>" +
          '<span class="pg-hub-round"></span>' +
        "</div>";
      }).join("");
  }

  /* ④ 可交互实时演示卡（左：对话；右：内部工作台） */
  function demoCard(work) {
    var chips = (work.suggestions || []).map(function (s) {
      return '<button type="button" class="chip-suggest" data-q="' + U.esc(s) + '">' + U.esc(s) + "</button>";
    }).join("");

    var keyHint = hasKey() ? "" :
      '<div class="works-keyhint">' + U.icon("info", 14) +
        /* 文字包在一个 span 里：.works-keyhint 是 flex 容器，
         * 裸文本节点会被拆成多个 flex 项，行宽一变就断得七零八落 */
        '<span class="wk-txt"> 当前没有配置 API Key —— 对话会走 <b>本地规则降级演示</b>（仍能看到四组件的流程）。' +
        "在页面右上角「设置」里填入 Key，就能和真实智能体对话。</span></div>";

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
            '<div class="works-live-title">' + U.icon("brain", 16) + " 它的内部工作台" +
              '<span class="wl-sub">每一步都看得见</span></div>' +
            '<div class="works-live-meta">' +
              '<span class="wl-meta"><i>轮次</i><b data-meta="round">0</b></span>' +
              '<span class="wl-meta"><i>工具</i><b data-meta="tools">0</b></span>' +
              '<span class="wl-meta"><i>用时</i><b data-meta="ms">—</b></span>' +
            "</div>" +
          "</div>" +
          '<div class="pipe-bar">' +
            '<span class="pipe-state" id="w-state-' + work.id + '">待机</span>' +
            '<span class="pipe-legend"><i class="lg lg-done"></i>本轮参与<i class="lg lg-skip"></i>本轮未参与</span>' +
          "</div>" +
          '<div class="pg-hub" id="w-hub-' + work.id + '">' + hubHTML() + "</div>" +
          '<div class="pipe-log-head">' + U.icon("clock", 15) + " 本轮轨迹" +
            '<span data-trace-n>0 步</span></div>' +
          '<div class="pipe-log" id="w-log-' + work.id + '">' +
            '<div class="pg-log-empty">发一句话试试——这里会按轮次记下它每一步做了什么。</div>' +
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

  /* ---------- 内部工作台：统计胶囊 / 总装图 / 本轮轨迹 ---------- */

  function setMeta(work, key, val) {
    var el = document.querySelector("#w-live-" + work.id + ' [data-meta="' + key + '"]');
    if (el) el.textContent = val;
  }

  /* ---------- 内部工作台（与智能体实验室同口径的三态 + 组件轨迹） ----------
   * 三态：进行中（放大发光）/ 已完成（描边）/ 本轮未参与（虚线灰底）。
   * 连线高亮 + 轨迹行都来自 agent.js 的真实回调，界面不替它编。 */

  function wbOf(work) {
    var rt = RT[work.id];
    if (!rt) return null;
    if (!rt.wb) rt.wb = { stages: {}, log: [], active: null, round: 0, t0: 0, status: "idle" };
    return rt.wb;
  }

  /* 状态牌：待机 / 运行中 / 本轮完成 / 出错了 */
  function wbStatus(work, state, text) {
    var s = wbOf(work);
    if (s) s.status = state;
    var el = $("w-state-" + work.id);
    if (!el) return;
    el.classList.remove("is-running", "is-done", "is-error");
    if (state === "run") el.classList.add("is-running");
    else if (state === "done") el.classList.add("is-done");
    else if (state === "error") el.classList.add("is-error");
    el.textContent = text || (state === "run" ? "运行中…"
      : state === "done" ? "本轮完成" : state === "error" ? "出错了" : "待机");
  }

  function wbPaintNodes(work) {
    var s = wbOf(work);
    var host = $("w-hub-" + work.id);
    if (!s || !host) return;
    host.querySelectorAll(".pg-hub-node").forEach(function (node) {
      var st = s.stages[node.getAttribute("data-stage")] || { status: "idle" };
      node.classList.toggle("is-run", st.status === "run");
      node.classList.toggle("is-done", st.status === "done");
      node.classList.toggle("is-skip", st.status === "skip");
      var mk = node.querySelector(".pg-hub-mark");
      if (mk) {
        mk.textContent = st.status === "done" ? "✓"
          : st.status === "skip" ? "–"
            : st.status === "run" ? "●" : "";
      }
      var rd = node.querySelector(".pg-hub-round");
      if (rd) {
        var used = st.status === "run" || st.status === "done";
        rd.textContent = used && st.round ? "R" + st.round : "";
        rd.style.display = rd.textContent ? "" : "none";
      }
    });
    wbPaintEdges(work);
  }

  /* 连线高亮：某个组件参与过，它牵出的边就亮（大脑参与＝所有边）；
   * 但「本轮未参与」的环节名下的边一律不亮——否则会出现
   * 「执行器本轮未参与」和「① 按接口写参数」同时亮着的自相矛盾。 */
  function wbPaintEdges(work) {
    var s = wbOf(work);
    var host = $("w-hub-" + work.id);
    if (!s || !host) return;
    var on = {}, off = {};
    LIGHT.forEach(function (l) {
      var st = s.stages[l.id] || {};
      (STAGE_EDGES[l.id] || []).forEach(function (e) {
        if (st.status === "skip") off[e] = true;
        if (st.status === "run" || st.status === "done") on[e] = true;
      });
    });
    host.querySelectorAll(".pg-hub-edge").forEach(function (el) {
      var id = el.getAttribute("data-edge");
      el.classList.toggle("is-on", !!on[id] && !off[id]);
    });
    host.querySelectorAll(".pg-hub-tag").forEach(function (el) {
      var eid = TAG_EDGE[el.getAttribute("data-tag")];
      el.classList.toggle("is-on", !!on[eid] && !off[eid]);
    });
  }

  /* 追一行轨迹：同一组件、同一轮、同一句话的重复触发不重复记；
   * round 传 null 表示"跟着当前轮次走"（工具调用 / 收尾 / 出错这类行）。 */
  function wbAddLog(work, id, text, skip, round, meta) {
    var s = wbOf(work);
    if (!s || !text) return;
    var k = (round === null || round === undefined) ? (s.round || 0) : round;
    var last = s.log[s.log.length - 1];
    if (last && last.id === id && last.round === k && last.text === text && !!last.skip === !!skip) return;
    s.log.push({
      id: id, meta: meta, text: text, skip: !!skip, round: k,
      at: s.t0 ? Date.now() - s.t0 : 0
    });
  }

  /* 轨迹渲染：按轮次分组，每行给出「谁 / 做了什么 / 第几秒」 */
  function wbPaintLog(work) {
    var s = wbOf(work);
    var box = $("w-log-" + work.id);
    if (!s || !box) return;
    var n = document.querySelector("#w-live-" + work.id + " [data-trace-n]");
    if (!s.log.length) {
      box.innerHTML = '<div class="pg-log-empty">发一句话试试——这里会按轮次记下它每一步做了什么。</div>';
      if (n) n.textContent = "0 步";
      return;
    }
    var order = [], groups = {};
    s.log.forEach(function (row) {
      var k = row.round || 0;
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(row);
    });
    box.innerHTML = order.sort(function (a, b) { return a - b; }).map(function (k) {
      return '<div class="pg-log-round"><span class="pglr">' + (k === 0 ? "接入" : "第 " + k + " 轮") + "</span>" +
        groups[k].map(logRowHTML).join("") + "</div>";
    }).join("");
    box.scrollTop = box.scrollHeight;
    if (n) n.textContent = s.log.length + " 步";
  }

  /* 一行轨迹：四组件行走各自语义色，工具调用 / 收尾 / 出错走专用色 */
  function logRowHTML(row) {
    var meta = row.meta || STAGE_ROW[row.id] || { name: row.id, icon: "gear", color: "brain" };
    return '<div class="pg-log-row c-' + meta.color + (row.skip ? " is-skip" : "") + '">' +
      '<span class="pg-log-dot">' + U.icon(meta.icon, 13) + "</span>" +
      '<span class="pg-log-body"><b>' + U.esc(meta.name) + "</b>" + U.esc(row.text || "") + "</span>" +
      '<span class="pg-log-ms">+' + ((row.at || 0) / 1000).toFixed(1) + "s</span>" +
    "</div>";
  }

  /* 轨迹里那些「不是四组件」的行 */
  var ROW_TOOL = { name: "工具调用", icon: "wrench", color: "exe" };
  var ROW_STOP = { name: "收尾", icon: "check", color: "stop" };
  var ROW_ERR = { name: "出错", icon: "alert", color: "err" };

  function wbFinish(work, id) {
    var s = wbOf(work);
    var st = s && s.stages[id];
    if (st && st.status === "run") st.status = "done";
  }

  /* 某个组件参与本轮：flag 为 "skip" 时只记一句"本轮未参与"，不点亮 */
  function wbStage(work, id, text, flag, round) {
    var s = wbOf(work);
    if (!s) return;
    if (round) s.round = Math.max(s.round, round);
    var st = s.stages[id] || (s.stages[id] = { status: "idle", text: "", round: 0 });
    if (flag === "skip") {
      if (st.status === "idle") {
        st.status = "skip";
        st.text = text || "";
        wbAddLog(work, id, text, true, round, null);
      }
    } else {
      /* 上一个组件的工作到此结束：定格为"已完成" */
      if (s.active && s.active !== id) wbFinish(work, s.active);
      st.status = "run";
      if (text) st.text = text;
      if (round) st.round = round;
      s.active = id;
      wbAddLog(work, id, text, false, round, null);
    }
    wbPaintNodes(work);
    wbPaintLog(work);
  }

  /* 一轮真正结束：定格"完成"，一次都没露面的组件标成"本轮未参与" */
  function wbEndRun(work) {
    var s = wbOf(work);
    if (!s) return;
    if (s.active) { wbFinish(work, s.active); s.active = null; }
    LIGHT.forEach(function (l) {
      var st = s.stages[l.id];
      if (!st || st.status === "idle") {
        s.stages[l.id] = { status: "skip", text: "本轮没用上：这个环节这次没有参与", round: 0 };
        wbAddLog(work, l.id, "本轮没用上：这个环节这次没有参与", true, 0, null);
      }
    });
    wbPaintNodes(work);
    wbPaintLog(work);
  }

  /* 开跑：统计归零、节点熄灭、连线全暗、轨迹清空 */
  function wbStart(work) {
    var s = wbOf(work);
    if (!s) return;
    s.stages = {}; s.log = []; s.active = null; s.round = 0; s.t0 = Date.now();
    setMeta(work, "round", "0");
    setMeta(work, "tools", "0");
    setMeta(work, "ms", "—");
    wbPaintNodes(work);
    wbPaintLog(work);
    wbStatus(work, "run");
  }

  /* 复位到"待机"（渲染完成、点「新对话」时用） */
  function wbReset(work) {
    wbStart(work);
    wbStatus(work, "idle");
  }

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
    rt.tools = 0;
    rt.t0 = Date.now();
    /* 开跑：工作台复位（节点熄灭、连线全暗、轨迹清空）+ 状态牌转「运行中」 */
    wbStart(work);

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
        /* 每一步都同时做两件事：点亮总装图（状态）+ 往轨迹里追一行（证据）。
         * 文字全部来自 agent.js 的真实回调，界面不替它编。 */
        onStage: function (id, t, flag, round) {
          wbStage(work, id, t, flag, round);
          if (typeof round === "number" && round > 0) setMeta(work, "round", round);
        },
        onTool: function (tool) {
          if (!tool || !tool.name) return;
          rt.tools += 1;
          setMeta(work, "tools", rt.tools);
          addNote(work, U.icon("wrench", 13) + " 执行器调用了工具：<b>" + U.esc(tool.name) + "</b>");
          wbAddLog(work, "tool",
            tool.name + "：" + (tool.summary || "") + " → " + (tool.result || "（没有返回结果）"),
            false, null, ROW_TOOL);
          wbPaintLog(work);
        },
        onStop: function (info) {
          if (!info) return;
          if (info.rounds) setMeta(work, "round", info.rounds);
          if (typeof info.tools === "number") { rt.tools = info.tools; setMeta(work, "tools", rt.tools); }
          /* 先把"没露面的组件"标成本轮未参与，再落收尾那一行——收尾永远排在最后 */
          wbEndRun(work);
          wbAddLog(work, "stop", info.reason || "本轮结束", false, null, ROW_STOP);
          wbPaintLog(work);
        },
        onDone: async function (answer) {
          rt.history.push({ role: "assistant", content: answer });
          setMeta(work, "ms", ((Date.now() - rt.t0) / 1000).toFixed(1) + "s");
          /* 有些降级路径不会走 onStop：这里再收一次尾（幂等），
           * 免得最后一个环节永远停在"进行中"、一直闪着 */
          wbEndRun(work);
          wbStatus(work, "done");
          var el = addMsg(work, "ai", "");
          if (el) await U.typewriter(el, answer, 12);
        },
        onError: function (err) {
          wbAddLog(work, "err", (err && err.message) || String(err), false, null, ROW_ERR);
          wbPaintLog(work);
          wbStatus(work, "error");
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
    wbReset(work);
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
