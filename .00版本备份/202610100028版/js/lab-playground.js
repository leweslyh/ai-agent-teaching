/* ============================================================
 * lab-playground.js —— 智能体实验室（综合实战，对应 L13）
 * 学生在这里和真正的智能体对话，同时看到：
 *   感知器 → 规划器 → 记忆器 → 执行器 → 大脑 五步管线点亮。
 * 还能现场关掉某个组件，看看智能体的本领怎么变小。
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

AgentLab.LabPlayground = (function () {
  var U = AgentLab.UI;
  var $ = U.$;
  var Agent = AgentLab.Agent;

  var history = [];       // 本次对话（短期记忆）
  var busy = false;

  var STAGES = [
    { id: "perception", name: "感知器", icon: "eye", color: "per", en: "观察 · 编码（多模态输入）" },
    { id: "planner", name: "规划器", icon: "gear", color: "plan", en: "推理 · 拆解（ReAct 循环）" },
    { id: "memory", name: "记忆器", icon: "book", color: "mem", en: "上下文 · 检索（短期 + 长期 / RAG）" },
    { id: "executor", name: "执行器（工具）", icon: "hand", color: "exe", en: "工具调用（Function Calling）" },
    { id: "brain", name: "大语言模型大脑", icon: "brain", color: "brain", en: "生成回答（LLM）" }
  ];

  var SUGGESTIONS = [
    "你好，我叫小明",
    "今天下午有什么课？",
    "明天会下雨吗？",
    "现在几点了？",
    "三天后是几号？",
    "边长4厘米的正方形面积是多少？",
    "60的30%是多少？",
    "1公顷等于多少平方米？",
    "72千米每小时等于多少米每秒？",
    "帮我计时25分钟（番茄钟）",
    "我们来玩猜数字游戏吧！",
    "成语接龙，开始！",
    "搜一下：长颈鹿的脖子为什么那么长",
    "“科学”用英语怎么说",
    "3千米等于多少米",
    "帮我算 25×4+10",
    "提醒我明天带美术工具"
  ];

  /* ---------- 渲染 ---------- */
  function render() {
    var sec = $("sec-playground");
    sec.innerHTML =
      '<div class="lab-head">' +
        '<div class="lab-icon" style="background:linear-gradient(135deg,#8a5cf6,#6b3fd1)">' + U.icon("robot", 30) + "</div>" +
        '<div><h1>智能体实验室</h1></div>' +
      "</div>" +

      /* 学习目标 */
      '<div class="lesson-goal card-brain">' +
        '<h3>' + U.icon("target", 18) + " 本课学习目标</h3>" +
        '<div class="goal-list">' +
          '<div class="goal-item"><span class="goal-num">1</span>看懂智能体的五步工作管线：感知 → 规划 → 记忆 → 执行 → 生成</div>' +
          '<div class="goal-item"><span class="goal-num">2</span>能拆开看一次真实请求的上下文（system + 历史 + 工具结果）</div>' +
          '<div class="goal-item"><span class="goal-num">3</span>会判断“关掉某个组件，任务还能不能完成”</div>' +
          '<div class="goal-item"><span class="goal-num">4</span>知道怎么评估一个智能体好不好：固定题集 + 明确指标 + 前后对比</div>' +
        "</div>" +
      "</div>" +

      '<div class="play-wrap">' +
        /* 左：对话 */
        '<div class="card chat-card">' +
          '<div class="chat-head">' +
            '<div class="chat-avatar">' + U.icon("robot", 24) + "</div>" +
            '<div style="font-weight:800">智能体小管家</div>' +
            '<button class="btn btn-ghost btn-sm" id="pg-clear" style="margin-left:auto">' + U.icon("reset", 15) + " 新对话</button>" +
          "</div>" +
          '<div class="chat-msgs" id="pg-msgs"></div>' +
          '<div class="chat-input">' +
            '<input type="text" id="pg-input" placeholder="输入你的问题，按回车发送……">' +
            '<button class="btn btn-per" id="pg-send">' + U.icon("send", 16) + " 发送</button>" +
          "</div>" +
        "</div>" +

        /* 右：管线面板 */
        '<div class="card pipe-card">' +
          '<h2 style="font-size:18px">' + U.icon("spark", 20) + ' 智能体内部工作台<span style="font-size:12px;color:var(--c-sub);font-weight:400">（正在哪一步，哪一步就亮起来）</span></h2>' +
          '<div class="pipe" id="pg-pipe">' +
            STAGES.map(function (s, i) {
              return (
                (i > 0 ? '<div class="pipe-arrow">▼</div>' : "") +
                '<div class="pipe-stage pipe-' + s.color + '" data-stage="' + s.id + '">' +
                  '<div class="picon">' + U.icon(s.icon, 22) + "</div>" +
                  '<div><div class="ptitle">' + s.name + "</div><div class='pstatus'>" + s.en + "</div></div>" +
                "</div>"
              );
            }).join("") +
          "</div>" +
          '<button class="btn btn-ghost btn-sm" id="pg-inspect-btn" style="margin-top:12px;width:100%">' + U.icon("search", 16) + " 拆开看看：这一轮我给大脑发了什么（上下文）</button>" +
          '<div class="inspect-box" id="pg-inspect" style="display:none">' +
            '<div style="font-size:13px;color:var(--c-sub);margin-bottom:6px">这是真实发送给 DeepSeek 的请求（system 提示词 + 历史 + 工具结果）。看懂它，就懂了“上下文工程”。</div>' +
            '<pre id="pg-inspect-pre" style="white-space:pre-wrap;font-size:12px;line-height:1.55;background:#1e1e28;color:#d8d8e8;border-radius:12px;padding:12px;max-height:280px;overflow:auto"></pre>' +
          "</div>" +
          '<div style="font-weight:700;margin:18px 0 4px;font-size:15px">' + U.icon("target", 18) + " 现场开关组件（Harness 约束）</div>" +
          '<div style="color:var(--c-sub);font-size:13px;margin-bottom:8px">关掉一个组件再提问，看看智能体的本领会怎么变化——这就是给 Agent 加“约束”。</div>' +
          '<div id="pg-flags">' +
            [
              { id: "perception", label: "感知器（观察）" },
              { id: "planner", label: "规划器（推理）" },
              { id: "memory", label: "记忆器（上下文）" },
              { id: "executor", label: "执行器（工具）" }
            ].map(function (f) {
              return '<div class="toggle-row"><span class="t-label">' + U.icon(
                f.id === "perception" ? "eye" : f.id === "planner" ? "gear" : f.id === "memory" ? "book" : "hand", 18
              ) + " " + f.label + "</span>" +
              '<label class="switch"><input type="checkbox" checked data-flag="' + f.id + '"><span class="slider"></span></label></div>';
            }).join("") +
          "</div>" +
        "</div>" +
      "</div>" +

      /* 新增配套实验（全部可自动判定） */
      AgentLab.LabPerception.card("brain", "实验：这句话会点亮哪些环节？（管线阶段预测）",
        "五步管线不是摆设。给一句真实提问，选出这一轮<b>真的会发生</b>的环节——没发生的动作也算答错。",
        '<div id="pg-phase"></div>') +

      AgentLab.LabPerception.card("brain", "实验：关掉一个组件，哪件事就做不成了？",
        "给 Agent 加约束的最直观方式，就是关掉某个组件。配好开关，再逐条验证“这件事还做不做得成”。",
        '<div id="pg-switch"></div>') +

      /* 新增：小测验 */
      AgentLab.LabPerception.card("brain", "小测验：综合验收——你是智能体小达人吗？",
        "共 " + PG_QUIZ.length + " 题，覆盖 Agent 公式、循环、Harness、评估与多智能体。答对一题加一颗星！",
        '<div class="game-box" id="pg-quiz"><div id="pg-quiz-body"></div></div>' +
        '<div class="score-line"><span class="score-badge" id="pg-quiz-score" data-score="0">★ 0</span><button class="btn btn-ghost btn-sm" id="pg-quiz-restart">重来</button></div>') +

      /* 新增：课堂小结 */
      AgentLab.LabPerception.card("brain", "课堂小结（L13 综合实战）",
        "把这一课串成一条线：一个智能体 = 一次循环 + 一层编排 + 一套评估。",
        '<div class="lesson-summary card-brain">' +
          '<h3>' + U.icon("check", 18) + " 核心结论</h3>" +
          '<div class="summary-core"><b>智能体 = LLM + 上下文 + 工具</b>，由 <b>Harness</b> 把它编排成一个能自我循环的系统：观察 → 推理 → 行动 → 再观察。四个组件各管一段：感知器把世界变成上下文，规划器决定怎么做，记忆器决定记住什么，执行器把决定变成真实动作。判断它好不好，不能靠“感觉”，要靠<b>固定题集 + 明确指标 + 前后对比</b>。</div>' +
          '<div class="summary-points">' +
            '<div class="sp-item"><span class="sp-icon" style="background:var(--c-brain)">' + U.icon("refresh", 14) + '</span><div><b>循环是关键：</b>能不能“看结果再决策”，是智能体与聊天机器人的分界线</div></div>' +
            '<div class="sp-item"><span class="sp-icon" style="background:var(--c-brain)">' + U.icon("shield", 14) + '</span><div><b>Harness 是护栏：</b>上下文、工具接口、约束、验证、纠正、审计——都在模型外面</div></div>' +
            '<div class="sp-item"><span class="sp-icon" style="background:var(--c-brain)">' + U.icon("target", 14) + '</span><div><b>评估是方向盘：</b>没有固定题集和指标，就不知道改动到底是在变好还是变坏</div></div>' +
            '<div class="sp-item"><span class="sp-icon" style="background:var(--c-brain)">' + U.icon("users", 14) + '</span><div><b>团队看任务：</b>能清晰拆成独立子任务才值得上多智能体；简单任务一个人更快更省</div></div>' +
          "</div>" +
          '<div class="summary-think"><b>课后思考：</b>如果让你给班级小管家再加一个组件，你会加什么？（提示：想想现在还有哪件事它做不好）加之前先想清楚：能测出它变好了吗？</div>' +
        "</div>") +

      /* 进阶原理互动课堂 */
      AgentLab.LabPerception.card("brain", "进阶原理互动课堂：智能体在真实 AI 系统里是什么？（ai-agent-book 第 1/7/10 章）",
        "下面 5 个概念对应《深入理解 AI Agent：设计原理与工程实践》（ai-agent-book 第 1/7/10 章）里的真实工程做法。<b>左边选概念，右边看讲解并亲手做实验</b>：每个概念都配了「一句话讲明白 / 打个比方 / 真实系统里是这样 / 动手实验 / 自检一问」，还能一键跳回对应的基础实验。",
        AgentLab.Adv.panelHTML({ key: "brain", concepts: pgConcepts() }));

    bind();

    /* 新增配套实验 + 小测验 + 进阶原理互动课堂 */
    bindPgPhase();
    bindPgSwitch();
    bindPgQuiz();
    bindPgAdv();
  }

  /* ---------- 对话区 ---------- */
  function addMsg(role, text, extraClass) {
    var box = $("pg-msgs");
    var d = document.createElement("div");
    d.className = "msg " + (role === "user" ? "user" : "ai") + (extraClass ? " " + extraClass : "");
    d.innerHTML = '<span class="who">' + (role === "user" ? "我" : "智能体小管家") + "</span>" + U.esc(text);
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    return d;
  }

  function setStage(id, text) {
    document.querySelectorAll(".pipe-stage").forEach(function (st) {
      st.classList.toggle("on", st.getAttribute("data-stage") === id);
    });
    var node = document.querySelector('.pipe-stage[data-stage="' + id + '"]');
    if (node && text) node.querySelector(".pstatus").textContent = text;
  }

  function clearStages() {
    document.querySelectorAll(".pipe-stage").forEach(function (st) {
      st.classList.remove("on");
      st.querySelector(".pstatus").textContent = STAGES.filter(function (s) { return s.id === st.getAttribute("data-stage"); })[0].en;
    });
  }

  /* ---------- 倒计时（计时器工具的 UI 部分） ---------- */
  var timerInterval = null;

  function beep() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      [0, 0.35, 0.7, 1.05, 1.4].forEach(function (t) {
        var osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = 880;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.28);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.3);
      });
    } catch (e) { /* 声音不可用不影响功能 */ }
  }

  function fmtTime(s) {
    var m = Math.floor(s / 60), sec = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  function startTimer(totalSec, label, pomodoro, remindText) {
    var box = $("pg-msgs");
    var d = document.createElement("div");
    d.className = "msg ai timer-bar";
    var descText = remindText ? ("专心做事，时间到会提醒你（" + remindText + "）") : "专心做事，时间到会提醒你";
    d.innerHTML = '<span class="who">⏳ 倒计时 ' + U.esc(label || "") + (pomodoro ? " · 番茄钟" : "") + (remindText ? " · 提醒：" + U.esc(remindText) : "") + "</span>" +
      '<div class="timer-num">' + fmtTime(totalSec) + '</div><div class="timer-desc">' + descText + '（可点下方取消计时）</div>' +
      '<button class="btn btn-ghost btn-sm timer-cancel">取消计时</button>';
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    if (timerInterval) clearInterval(timerInterval);

    var remain = totalSec;
    var numEl = d.querySelector(".timer-num");
    var cancelBtn = d.querySelector(".timer-cancel");
    cancelBtn.addEventListener("click", function () {
      if (timerInterval) clearInterval(timerInterval);
      d.remove();
    });
    timerInterval = setInterval(function () {
      remain--;
      if (remain <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        numEl.textContent = "时间到！";
        d.classList.add("timer-done");
        beep();
        var remindMsg = remindText ? ("⏰ 时间到！该" + remindText + "啦！") : ("⏰ " + label + " 到啦！");
        var tailMsg = pomodoro ? "番茄工作法建议：休息 5 分钟，站起来活动活动，再继续下一轮专注。" : (remindText ? "" : "休息一下，喝口水吧。");
        addMsg("ai", remindMsg + tailMsg);
      } else {
        numEl.textContent = fmtTime(remain);
      }
    }, 1000);
  }

  /* ---------- 发送 ---------- */
  var lastPayload = null;

  function renderPayload(p) {
    var pre = $("pg-inspect-pre");
    if (!pre) return;
    pre.textContent = JSON.stringify(p, null, 2);
  }

  async function send(text) {
    if (busy) return;
    text = (text || "").trim();
    if (!text) return;
    busy = true;
    $("pg-input").value = "";
    $("pg-send").disabled = true;

    addMsg("user", text);
    history.push({ role: "user", content: text });
    if (history.length > Agent.MAX_HISTORY) history = history.slice(-Agent.MAX_HISTORY);
    clearStages();

    try {
      await Agent.run(text, history, {
        onStage: function (id, status) { setStage(id, status); },
        onTool: function (tool) {
          addMsg("tool", "【执行器 · Function Calling】" + tool.summary + "\n工具结果：" + tool.result, "tool-note");
          if (tool.name === "计时器工具" && tool.payload && tool.payload.seconds) {
            startTimer(tool.payload.seconds, tool.payload.label, tool.payload.pomodoro, tool.payload.remindText);
          }
        },
        onPayload: function (messages) { lastPayload = messages; renderPayload(messages); },
        onDone: async function (answer) {
          history.push({ role: "assistant", content: answer });
          var el = addMsg("ai", "");
          await U.typewriter(el, answer, 12);
        },
        onError: function (err) {
          addMsg("ai", "出错了：" + (err.message || err) + "\n\n小提示（卡住三步走）：① 自己读一遍问题并复述 ② 把问题说清楚再问 AI ③ 还不行就求助老师/同伴。");
        }
      });
    } finally {
      busy = false;
      $("pg-send").disabled = false;
      $("pg-input").focus();
    }
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    var input = $("pg-input");
    var sendBtn = $("pg-send");

    function doSend() { send(input.value); }
    sendBtn.addEventListener("click", doSend);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") doSend(); });

    document.querySelectorAll("#pg-chips .chip-suggest").forEach(function (c) {
      c.addEventListener("click", function () { send(c.textContent); });
    });

    $("pg-clear").addEventListener("click", function () {
      history = [];
      lastPayload = null;
      $("pg-msgs").innerHTML = "";
      var ip = $("pg-inspect");
      if (ip) ip.style.display = "none";
      clearStages();
      U.toast("已开启新对话（短期记忆已清空）");
    });

    var inspectBtn = $("pg-inspect-btn");
    if (inspectBtn) {
      inspectBtn.addEventListener("click", function () {
        var box = $("pg-inspect");
        var isHidden = box.style.display === "none";
        box.style.display = isHidden ? "block" : "none";
        if (isHidden && lastPayload) renderPayload(lastPayload);
        if (isHidden && !lastPayload) {
          $("pg-inspect-pre").textContent = "（还没有请求记录）先问一句话，然后再次打开这里，就能看到这一轮真实发给 DeepSeek 的完整请求了。";
        }
      });
    }

    document.querySelectorAll("#pg-flags input[type=checkbox]").forEach(function (cb) {
      cb.checked = Agent.flags[cb.getAttribute("data-flag")] !== false;
      cb.addEventListener("change", function () {
        Agent.flags[cb.getAttribute("data-flag")] = cb.checked;
        U.toast(cb.checked ? "已打开：" + cb.parentElement.parentElement.querySelector(".t-label").textContent.trim() : "已关闭：" + cb.parentElement.parentElement.querySelector(".t-label").textContent.trim() + "，再问一句试试！");
      });
    });

    // 欢迎语
    var box = $("pg-msgs");
    box.innerHTML = '<div class="msg ai"><span class="who">智能体小管家</span>你好！我是智能体小管家。你可以问我班级的事、明天的天气，也可以让我算题、记提醒。发一句话，然后在右侧“内部工作台”观察我的 Agent 循环；点“拆开看看”，还能看到我这一轮真实收到的上下文。</div>';
  }

  /* ============================================================
   * 进阶原理互动课堂（智能体实验室）：5 个概念
   * 结构与交互由共享引擎 js/adv-classroom.js 渲染
   * ============================================================ */
  var PG_ADV = [
    {
      id: "formula", icon: "spark", nav: "Agent 公式", name: "Agent = LLM + 上下文 + 工具", en: "THE MINIMAL FORMULA",
      tip: "现代智能体的最小工程公式（ai-agent-book 第 1 章）：大脑负责生成，上下文决定它“知道什么”，工具决定它“能做什么”。",
      analogy: "像一个会自己办事的小队：<b>大脑</b>是队长（会想），<b>上下文</b>是队长的记事本（知道什么），<b>工具</b>是队员的手脚（能做），<b>规划器</b>是流程表（先做什么后做什么）。",
      real: "LLM 提供推理与生成；上下文（system 提示词 + 轨迹 + 检索结果）提供“已知条件”；工具提供“改变世界的能力”。三样缺一，就会退化成聊天机器人：缺工具只能输出文字，缺上下文每次从零开始，缺记忆记不住你。",
      quiz: { q: "只给 LLM 一个提示词、不给工具也不给记忆，它和 Agent 的本质差别是什么？", a: "差别在“闭环”：没有工具它只能输出文本、无法影响世界；没有记忆它每次都从零开始。Agent 的价值来自“能看到行动结果 → 再决策”的循环。" },
      links: [{ t: "内部工作台", el: "pg-pipe" }]
    },
    {
      id: "loop", icon: "refresh", nav: "Agent 循环", name: "Agent 循环", en: "THE AGENT LOOP",
      tip: "智能体不是“问一句答一句”，而是自主循环：观察 → 推理 → 行动 → 再观察，直到任务完成。",
      analogy: "像做实验：看现象（观察）→ 想原因（推理）→ 动手试（行动）→ 再看结果（观察）……一轮一轮逼近答案，而不是一次就交卷。",
      real: "循环必须有终止条件（任务完成 / 达到最大轮数 / 不可恢复错误）；每一轮都把工具结果追加进轨迹，供下一轮推理。工程上还会限制单任务的最大调用次数，避免死循环烧钱。",
      quiz: { q: "为什么“问一句答一句”的聊天机器人不算 Agent？", a: "因为它没有“根据结果再决策”的环节：回答完就结束了。Agent 必须能观察行动的结果，并据此决定下一步——这个闭环才是 Agent 的核心。" },
      links: [{ t: "内部工作台", el: "pg-pipe" }]
    },
    {
      id: "harness", icon: "shield", nav: "Harness 编排层", name: "Harness（编排层）", en: "HARNESS",
      tip: "包裹在模型外面的工程层：管理上下文、暴露工具、加约束、验证结果、出错纠正。没有它，模型只是聊天机器人。",
      analogy: "像给新老师配的“带教制度”：不是不信他的能力，而是要有流程、有检查、有兜底。",
      real: "Harness 负责：构造上下文、维护循环与状态、暴露工具接口、权限校验、结果验证、失败纠正、日志审计。模型能力边界之外的部分，正是 Harness 的价值所在——它决定系统能不能上线。",
      quiz: { q: "同一个模型，为什么在“网页聊天框”里和“接入 Harness 的系统”里表现差这么多？", a: "因为 Harness 决定了它能看到什么（上下文）、能用什么（工具）、被允许做什么（约束）、错了怎么补救（纠正）。模型只是整套系统里的一环。" },
      links: [{ t: "现场开关组件", el: "pg-flags" }]
    },
    {
      id: "evaluation", icon: "target", nav: "评估 Evaluation", name: "评估（Evaluation）", en: "EVALUATION",
      tip: "怎么知道智能体做得好不好？要有测试集 + 指标 + 反复评测，而不是“感觉还行”。",
      analogy: "像考试：只做一道题看不出水平，要有一份覆盖不同题型的卷子 + 明确的评分标准，才能说“他进步了”。",
      real: "真实项目的做法：准备覆盖典型场景的测试集（含边界情况）；定义可量化指标（任务完成率、回答准确率、工具调用成功率、成本与延迟）；改一版就跑一遍对比回归。ai-agent-book 第 7 章的核心：<b>没有评估，就没有改进方向</b>。",
      quiz: { q: "为什么“多试几句感觉不错”不算评估？", a: "因为没有固定题集、没有指标、没有对比基线——换个问题可能就是另一个结论。评估必须可重复、可比较，才能判断改动是“真的变好”还是“碰巧”。" },
      links: [{ t: "小测验：综合验收", el: "pg-quiz" }]
    },
    {
      id: "multiagent", icon: "users", nav: "多智能体协作", name: "多智能体协作（Multi-Agent）", en: "MULTI-AGENT",
      tip: "复杂任务可以让多个智能体分工：一个搜索、一个总结、一个检查——像一支小队。",
      analogy: "像小组做研究报告：有人查资料、有人写、有人检查错别字。分工能提高质量与速度，但也要有人负责汇总。",
      real: "常见模式：① 提议者-审核者（生成 + 独立审查）；② 流水线分工（搜索 → 总结 → 校对）；③ 并行探索 + 投票。代价是 Token 与协调成本上升，任务简单时反而更慢。ai-agent-book 第 10 章强调：<b>先能拆成独立子任务，再考虑多智能体</b>。",
      quiz: { q: "什么情况下“多智能体”反而不划算？", a: "任务简单、步骤少、一个人一次就能做好时——多智能体要多轮沟通、上下文复制，成本和延迟都上升。判断标准：任务能不能清晰地拆成独立子任务。" },
      links: [{ t: "内部工作台", el: "pg-pipe" }]
    }
  ];

  /* 概念 id → 交互类型 */
  var PG_TYPE = {
    formula: "decider", loop: "pipeline", harness: "switchboard",
    evaluation: "picker", multiagent: "sandbox"
  };

  var PG_DEMO = {
    formula: {
      title: "动手实验：这个需求该配哪些能力？", hint: "选两个答案", icon: "spark",
      emptyText: "先回答上面两个问题，系统会给出“该配什么”的建议。",
      questions: [
        { key: "ext", q: "① 这个需求需要“外部实时信息”吗？", opts: [{ k: "need", t: "需要（查天气 / 查课表 / 搜索）" }, { k: "no", t: "不需要（写一段话就行）" }] },
        { key: "mem", q: "② 需要“记住之前说过的事”吗？", opts: [{ k: "need", t: "需要（跨轮次、跨天）" }, { k: "no", t: "不需要，这一轮够用" }] }
      ],
      decide: function (ans) {
        if (ans.ext === "need" && ans.mem === "need") {
          return "<b>建议：完整 Agent（大脑 + 上下文 + 工具 + 规划器）</b><br>" +
            '<span class="dim">需要外部信息 → 必须配工具（执行器）；需要跨轮次记住 → 必须配长期记忆；多步任务 → 还要规划器拆解与排序。</span>' +
            '<br><b>典型场景：</b>班级小管家（查课表 + 记住“我是学习委员”）。';
        }
        if (ans.ext === "need") {
          return "<b>建议：大脑 + 工具即可，不必上长期记忆。</b><br>" +
            '<span class="dim">只要外部信息、不需要跨会话记人，那配好工具（执行器）+ 规划器就够；长期记忆会增加隐私与维护成本。</span>' +
            '<br><b>典型场景：</b>一次性的“查天气 / 算面积”——问完就结束。';
        }
        if (ans.mem === "need") {
          return "<b>建议：大脑 + 记忆即可，可以不配工具。</b><br>" +
            '<span class="dim">不需要外部实时数据，但要把之前的对话与班级信息带着，那就是上下文工程 + 长期记忆的活儿。</span>' +
            '<br><b>典型场景：</b>“接着上次继续写”“按我的偏好来回答”。';
        }
        return "<b>建议：普通对话就够，别上 Agent。</b><br>" +
          '<span class="dim">既不需要外部信息、也不需要记住什么，直接让模型生成即可。硬做成 Agent 只会增加复杂度、成本和出错点——<b>技术选型要匹配需求，过度设计也是错</b>。</span>' +
          '<br><b>典型场景：</b>润色一句话、把一段话改得更简单。';
      }
    },
    loop: {
      title: "动手实验：走一遍 Agent 循环", hint: "先猜后放", icon: "refresh",
      playLabel: "自动播放一轮循环", stepLabel: "单步推进", resetLabel: "重来",
      logTitle: "循环日志",
      stages: [
        { id: "obs", name: "观察", icon: "eye", en: "Observation", io: "拿到用户问题与当前上下文（“明天会下雨吗？”）" },
        { id: "think", name: "推理", icon: "brain", en: "Reasoning", io: "判断：这需要真实天气数据 → 应该调用天气工具" },
        { id: "act", name: "行动", icon: "wrench", en: "Acting", io: "调用 weather_query(city=北京, date=明天)" },
        { id: "recheck", name: "再观察", icon: "refresh", en: "Re-observe", io: "读到结果“小雨 15~19℃”，判断：信息够了，可以收尾" },
        { id: "deliver", name: "交付", icon: "check", en: "Final Answer", io: "回答“明天小雨，记得带伞”——任务完成，循环结束" }
      ],
      guess: {
        q: "先猜一猜：循环里哪一步决定了“要不要再来一轮”？",
        opts: [
          { k: "recheck", t: "再观察（看到结果后做判断）" },
          { k: "act", t: "行动（调用工具）" },
          { k: "deliver", t: "交付（给出回答）" }
        ],
        ans: "recheck",
        why: "只有看到行动的结果，才知道离目标还差多少：信息够了就交付，不够就再循环一轮。这个“看结果 → 再判断”的节点，才是 Agent 与聊天机器人最本质的区别。",
        hint: "想想“不看结果就继续做”会怎样。",
        revealAt: 3
      }
    },
    harness: {
      title: "动手实验：关掉 Harness 的某项能力，谁还能兜底？", hint: "点开关", icon: "shield",
      chipsTitle: "① Harness 负责的五件事（点一下可关掉）：",
      chips: [
        { id: "h1", label: "构造上下文（把该带的信息带上）", on: true },
        { id: "h2", label: "暴露工具接口 + 权限校验", on: true },
        { id: "h3", label: "加约束（不允许做的事）", on: true },
        { id: "h4", label: "验证结果（格式 / 非空 / 断言）", on: true },
        { id: "h5", label: "失败纠正 + 日志审计", on: true }
      ],
      viewTitle: "当前 Harness 生效的能力",
      viewNote: "这五件事都在模型外面——模型只负责生成，兜底靠 Harness。",
      viewEmpty: "Harness 全关：等于把模型直接接到用户面前。",
      actionsTitle: "② 这些环节还能被保障吗？",
      actions: [
        { id: "a1", label: "把班级课表带进这次上下文", need: ["h1"], hint: "上下文由 Harness 构造，模型自己拿不到外部信息。" },
        { id: "a2", label: "调用天气工具并确认有权限", need: ["h2"], hint: "工具接口与权限校验都在 Harness 层完成。" },
        { id: "a3", label: "拒绝执行“把全班作业都删掉”", need: ["h3"], hint: "约束是开发者写死的红线，不靠模型自觉。" },
        { id: "a4", label: "工具返回空值时要求重试", need: ["h4"], hint: "结果验证：空值、格式错、断言不过都要拦下来。" },
        { id: "a5", label: "出错后自动重试并把过程记进日志", need: ["h5"], hint: "纠正与审计：出问题要能自动补救、事后能查。" }
      ],
      resultEmpty: "点一件事试一试。",
      afterToggle: "Harness 能力变了——再点下面某件事，看看还有没有人兜底。",
      failTail: "Harness 的这项能力被关掉了——这一步就没人兜底，只能指望模型自觉。",
      okTail: "Harness 在，这一步有流程、有检查、有兜底。",
      onIcon: "shield", offIcon: "xmark"
    },
    evaluation: {
      title: "动手实验：哪些做法算“合格的评估”？", hint: "多选后检查", icon: "target",
      taskLabel: "情境：",
      task: "老师想知道“这次改动到底让智能体变好了吗”。请选出所有<b>合格的评估做法</b>。",
      checkLabel: "检查我选的做法",
      empty: "先点选你认为合格的做法，再点「检查我选的做法」。",
      passHtml: "合格评估的三要素：<b>固定题集 + 明确指标 + 前后对比</b>。",
      failHtml: "提示：判断标准是“换个时间、换个人来跑，结论会不会变”。",
      items: [
        { id: "v1", label: "准备一份覆盖典型问题的测试集（含边界情况）", ok: true, why: "固定题集是评估的地基：换个人、换一天跑，题目都一样。" },
        { id: "v2", label: "定义可量化指标：任务完成率 / 工具调用成功率 / 平均耗时", ok: true, why: "指标能量化“好到什么程度”，也能暴露“变快了但更容易错”这类权衡。" },
        { id: "v3", label: "改动前后各跑一遍同一份测试集，逐项对比", ok: true, why: "没有对比基线，就无法判断提升来自改动还是运气。" },
        { id: "v4", label: "把“不知道却硬答”的幻觉次数单独列成一项指标", ok: true, why: "把最危险的错误单独度量，才能防止“准确率上去了、可信度下来了”。" },
        { id: "v5", label: "自己试三个问题，感觉比之前顺", ok: false, why: "样本太少、没有指标、没有基线——换个问题结论就可能反转。" },
        { id: "v6", label: "看回答字数变多了，认为更详细更好", ok: false, why: "字数不是质量指标；啰嗦往往还意味着没抓住重点。" },
        { id: "v7", label: "换一个更强的模型，然后宣布效果提升", ok: false, why: "同时改变了变量又没有对比基线与题集，无法归因——评估要一次只改一处。" }
      ]
    },
    multiagent: {
      title: "动手实验：这个任务要不要上多智能体？", hint: "切开关对比", icon: "users",
      srcTitle: "① 选择任务：",
      sources: [
        {
          id: "essay",
          label: "写一篇 300 字作文",
          safe: "任务：写一篇 300 字的记叙文（一个人一次就能写完）。",
          evil: "任务特点：步骤少、不需要多源信息、也不需要交叉验证。"
        },
        {
          id: "research",
          label: "调研“AI 对教育的影响”并写报告",
          safe: "任务：调研多个来源 + 汇总成报告（信息多、需要交叉验证）。",
          evil: "任务特点：天然可拆成“搜索 / 汇总 / 核查”三类独立子任务。"
        }
      ],
      defaultId: "essay",
      guardOn: false,
      guardTitle: "② 用哪种组织方式：",
      guardLabelOn: "多智能体协作（搜索 / 写作 / 审查分工）",
      guardLabelOff: "单智能体独立完成",
      contentTitle: "任务与特点：",
      dataLabel: "① 任务：",
      injectLabel: "② 任务特点：",
      outHtml: function (src, guarded) {
        if (src.id === "essay") {
          return guarded
            ? "<b>多智能体来做这件事：不划算。</b><br>" +
              "· 三个智能体要来回传上下文、互相同步，协调成本比写作本身还高；<br>" +
              "· 质量提升有限（本来就一次能写好），Token 与耗时却翻几倍。<br>" +
              '<span class="dim">结论：任务太简单时，多智能体是“用更多流程换更少收益”。</span>'
            : "<b>单智能体独立完成：够用，而且更快更省。</b><span class=\"ok\">✓ 推荐</span><br>" +
              "· 一次生成就能达到目标；<br>· 没有跨智能体的沟通成本，也更容易复现和排查问题。<br>" +
              '<span class="dim">判断标准：任务能不能清晰拆成独立子任务——不能拆，就别拆团队。</span>';
        }
        return guarded
          ? "<b>多智能体协作：明显更合适。</b><span class=\"ok\">✓ 推荐</span><br>" +
            "· <b>搜索智能体</b>并行查多个来源；<br>· <b>写作智能体</b>只负责汇总与成文；<br>· <b>审查智能体</b>独立核查事实与引用（不共享写作过程，才能挑出问题）。<br>" +
            '<span class=\"dim\">代价：Token 与协调成本上升，但换来更高的覆盖度与可信度。</span>'
          : "<b>单智能体独立完成：能做完，但容易有盲区。</b><br>" +
            "· 一个人又查又写，容易只挑顺手的资料、漏掉反面证据；<br>· 自己审自己不可靠——写作与核对在同一套假设里进行。<br>" +
            '<span class=\"dim\">结论：信息多、要交叉验证的任务，值得为“独立审查”多花成本。</span>';
      }
    }
  };

  /* 概念 + 交互数据合体 */
  function pgConcepts() {
    return PG_ADV.map(function (c) {
      return {
        id: c.id, icon: c.icon, nav: c.nav, name: c.name, en: c.en,
        tip: c.tip, analogy: c.analogy, real: c.real, quiz: c.quiz, links: c.links,
        demo: PG_TYPE[c.id] || c.id,
        demoData: PG_DEMO[c.id] || {}
      };
    });
  }

  function bindPgAdv() {
    AgentLab.Adv.bind($("sec-playground"), { key: "brain", concepts: pgConcepts(), color: "brain" });
  }

  /* ---------- 新增实验 A：管线阶段预测（多选判定） ---------- */
  function bindPgPhase() {
    var host = $("pg-phase");
    if (!host) return;
    var d = {
      color: "brain",
      title: "动手实验：这句话会点亮哪些环节？", hint: "多选后检查", icon: "spark",
      taskLabel: "这一轮用户说：",
      task: "“明天会下雨吗？”（上一轮他说过“我在北京”）",
      checkLabel: "检查我选的环节",
      empty: "先点选你认为这一轮会发生的环节，再点「检查我选的环节」。",
      passHtml: "五步管线不是摆设：<b>感知 → 规划 → 记忆 → 执行 → 生成</b>，缺哪一步都会出问题。",
      failHtml: "提示：判断标准是“这一轮真的会发生这件事吗”——没发生的动作也算错。",
      items: [
        { id: "q1", label: "把“明天会下雨吗”整理成 user 消息（感知器）", ok: true, why: "感知器把口语问题整理成结构化上下文。" },
        { id: "q2", label: "判断要不要调用天气工具（规划器）", ok: true, why: "规划器负责意图理解与工具选择决策。" },
        { id: "q3", label: "把上一轮的“我在北京”带进上下文（记忆器）", ok: true, why: "没有城市就问不出天气——记忆器把城市补上了，这正是记忆的价值。" },
        { id: "q4", label: "调用 weather_query 拿到真实天气（执行器）", ok: true, why: "实时数据必须由工具提供，模型自己不知道明天的天气。" },
        { id: "q5", label: "生成“明天小雨，记得带伞”（大脑）", ok: true, why: "最后一步由大语言模型基于上下文生成回答。" },
        { id: "q6", label: "把用户上传的照片转成文字", ok: false, why: "这一轮没有图片输入，感知器的图像通道用不上。" },
        { id: "q7", label: "把这段对话写进长期记忆保存下来", ok: false, why: "用户没有要求“记住”，这一轮不需要写长期记忆（要写的话通常是“记住我在北京”这类明确指令）。" },
        { id: "q8", label: "调用计算器算 25×4+10", ok: false, why: "这一轮的任务是查天气，没有计算需求——乱调工具只会浪费 Token。" }
      ]
    };
    host.innerHTML = AgentLab.Adv.types.picker.demoHTML(d);
    AgentLab.Adv.types.picker.bind(host, d);
  }

  /* ---------- 新增实验 B：组件开关对能力的影响 ---------- */
  function bindPgSwitch() {
    var host = $("pg-switch");
    if (!host) return;
    var d = {
      color: "brain",
      title: "动手实验：关掉一个组件，哪件事就做不成了？", hint: "点开关", icon: "target",
      chipsTitle: "① 当前开启的组件（与上方工作台的开关一致；点一下可关掉）：",
      chips: [
        { id: "perception", label: "感知器（观察 / 把输入变成上下文）", on: true },
        { id: "planner", label: "规划器（推理 / 决定要不要用工具）", on: true },
        { id: "memory", label: "记忆器（上下文 / 短期 + 长期）", on: true },
        { id: "executor", label: "执行器（真正调用工具）", on: true }
      ],
      viewTitle: "当前开启的组件",
      viewNote: "大脑（模型）不在开关里——它关掉就彻底不能用了，所以这里只演示“组件级”的约束。",
      viewEmpty: "四个组件全关：只剩一个大模型，它只能凭记忆聊天。",
      actionsTitle: "② 这些事还做得成吗？",
      actions: [
        { id: "t1", label: "听懂你打的字（把输入变成上下文）", need: ["perception"], hint: "没有感知器，模型连你的问题都收不到。" },
        { id: "t2", label: "判断“这个问题要不要查工具”", need: ["planner"], hint: "没有规划器，模型不知道该不该动手、该用哪个工具。" },
        { id: "t3", label: "记住上一轮说的“我在北京”", need: ["memory"], hint: "没有记忆器，每次对话都从零开始问“你在哪个城市”。" },
        { id: "t4", label: "真正调用天气 / 计算器工具", need: ["executor"], hint: "没有执行器，工具就只是“说明书”，谁也调不动。" },
        { id: "t5", label: "准确回答“明天会下雨吗”", need: ["perception", "planner", "executor"], hint: "这一件事要三环配合：收到问题、决定查工具、真正查回来。" },
        { id: "t6", label: "回答“我是学习委员，课表怎么安排”", need: ["perception", "memory"], hint: "要同时用到“听懂问题”和“记住身份”，缺一个就只能泛泛回答。" }
      ],
      resultEmpty: "点一件事试一试。",
      afterToggle: "组件状态变了——再点下面某件事，看看还做不做得成。",
      failTail: "对应组件被关掉了——Agent 在这一环的本领就变小了（这正是“给 Agent 加约束”的直观含义）。",
      okTail: "所需组件都开着，这一步能完成。",
      onIcon: "check", offIcon: "xmark"
    };
    host.innerHTML = AgentLab.Adv.types.switchboard.demoHTML(d);
    AgentLab.Adv.types.switchboard.bind(host, d);
  }

  /* ---------- 新增：学习目标 / 小测验 / 课堂小结 ---------- */
  var PG_QUIZ = [
    { q: "现代智能体的最小工程公式是？", opts: ["LLM + 上下文 + 工具", "模型 + 网页 + 麦克风", "数据库 + 服务器 + 界面"], ans: 0, why: "ai-agent-book 第 1 章：大脑负责生成，上下文决定它知道什么，工具决定它能做什么。" },
    { q: "智能体与聊天机器人最本质的区别是？", opts: ["回答更长更详细", "能观察结果并据此再决策（闭环）", "用了更贵的模型"], ans: 1, why: "关键在“观察 → 再决策”的闭环：聊天机器人答完就结束，智能体会根据行动结果决定下一步。" },
    { q: "下面哪件事<b>不</b>是 Harness（编排层）负责的？", opts: ["管理上下文与工具接口", "加约束、验证结果、出错纠正", "训练模型参数"], ans: 2, why: "训练是模型侧的事；Harness 管的是模型外面的工程层：上下文、工具、约束、验证、纠正与审计。" },
    { q: "要判断“这次改动让智能体变好了吗”，最靠谱的做法是？", opts: ["自己试几句，感觉一下", "用固定测试集 + 明确指标，改动前后对比", "看回答字数是不是变多了"], ans: 1, why: "可重复、可比较才算评估：固定题集、量化指标、前后对比基线。" },
    { q: "什么情况下<b>不适合</b>上多智能体？", opts: ["任务能清晰拆成独立子任务", "任务简单、一次就能做好", "需要一人生成、一人独立审查"], ans: 1, why: "任务太简单时，多智能体的沟通与协调成本大于收益——能一个人做完就别组队。" }
  ];

  /* ---------- 小测验（单题闯关） ---------- */
  function bindPgQuiz() {
    AgentLab.Quiz.mount({
      host: "pg-quiz-body",
      color: "brain",
      name: "智能体小达人",
      star: "pg-quiz-score",
      restart: "pg-quiz-restart",
      questions: PG_QUIZ,
      hint: "再想想——可以回到上面的内部工作台和进阶课堂里找线索。"
    });
  }

  return { render: render };
})();
