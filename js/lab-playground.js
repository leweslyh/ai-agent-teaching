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

      /* 进阶原理：Agent 循环与工程全景 */
      AgentLab.LabPerception.deepCard("brain", "进阶原理：Agent 循环与工程全景（ai-agent-book 第 1/7/10 章）", [
        { term: "Agent = LLM + 上下文 + 工具", desc: "这是现代智能体的最小工程公式（ai-agent-book 第 1 章）：大脑负责生成，上下文由感知与记忆提供，工具由执行器调用，规划器驱动循环。" },
        { term: "Agent 循环", desc: "智能体不是“问一句答一句”，而是自主地循环：观察 → 推理 → 行动 → 再观察……直到任务完成。你看到的五步管线就是一次完整循环的可视化。" },
        { term: "Harness（编排层）", desc: "包裹在模型外面的工程层：管理上下文、暴露工具接口、加约束、验证结果、出错纠正。没有 Harness，模型只是聊天机器人；有了它，才是 Agent。" },
        { term: "评估（Evaluation）", desc: "怎么知道智能体做得好不好？真实项目会准备测试集、定义指标（如任务完成率、回答准确性），反复评测再改进——这是 ai-agent-book 第 7 章的核心。" },
        { term: "多智能体协作（Multi-Agent）", desc: "更复杂的任务会让多个智能体分工合作：一个负责搜索、一个负责总结、一个负责检查，就像一支小队。群体智能往往高于单个个体（第 10 章）。" }
      ]);

    bind();
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

  return { render: render };
})();
