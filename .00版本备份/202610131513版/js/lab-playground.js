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
    { id: "executor", name: "执行器", icon: "hand", color: "exe", en: "工具调用（Function Calling）" },
    { id: "brain", name: "大语言模型大脑", icon: "brain", color: "brain", en: "生成回答（LLM）" }
  ];

  /* 导入卡用：五个环节各负责什么（短名 + 一句话，颜色与工作台一致） */
  var STAGE_DUTY = [
    { id: "perception", short: "感知器", duty: "把你说的话（或语音、图片）整理成一条带角色的消息，送进上下文" },
    { id: "planner", short: "规划器", duty: "判断你的意图：要不要用工具、用哪个、分几步做完" },
    { id: "memory", short: "记忆器", duty: "把班级知识库（长期记忆）和之前说过的话（短期记忆）整理进上下文" },
    { id: "executor", short: "执行器", duty: "真正调用工具：查天气、算数、联网搜索、记提醒……" },
    { id: "brain", short: "大模型大脑", duty: "读懂上下文并生成回答——整套系统里唯一不能关的一环" }
  ];

  /* 对话区的“试试这样问”芯片：覆盖五步管线的各种情况，方便课堂上一点就发 */
  var SUGGESTIONS = [
    "你好，我叫小明",
    "今天下午有什么课？",
    "明天会下雨吗？",
    "帮我算 25×4+10",
    "搜一下：长颈鹿的脖子为什么那么长",
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

      /* 学习目标（card-pg：智能体实验室专属紫，与页头图标同色系；区别于架构实验室的 card-brain 金） */
      '<div class="lesson-goal card-pg">' +
        '<h3>' + U.icon("target", 18) + " 本课学习目标</h3>" +
        '<div class="goal-list">' +
          '<div class="goal-item"><span class="goal-num">1</span>看懂智能体的五步工作管线：感知 → 规划 → 记忆 → 执行 → 生成</div>' +
          '<div class="goal-item"><span class="goal-num">2</span>能拆开看一次真实请求的上下文（system + 历史 + 工具结果）</div>' +
          '<div class="goal-item"><span class="goal-num">3</span>会判断“关掉某个组件，任务还能不能完成”</div>' +
          '<div class="goal-item"><span class="goal-num">4</span>知道怎么评估一个智能体好不好：固定题集 + 明确指标 + 前后对比</div>' +
          '<div class="goal-item"><span class="goal-num">5</span>会读“本轮轨迹”，从记录里找出是哪一环出了故障（可观测性）</div>' +
        "</div>" +
      "</div>" +

      /* 导入卡：承接前面 12 课 + 五步管线速览（只做介绍，苹果式低色彩） */
      AgentLab.LabPerception.card("brain", "本课导航：把前面 12 课学的零件，装成一台会自己干活的机器",
        "前面四个实验室各讲一个零件——这一课把它们装到一起，跑一遍真正的智能体循环。",
        '<div class="pg-intro">' +
          '<div class="pg-flow">' +
            STAGE_DUTY.map(function (d, i) {
              var s = null;
              STAGES.forEach(function (x) { if (x.id === d.id) s = x; });
              return '<div class="pg-flow-row c-' + (s ? s.color : "brain") + '">' +
                '<span class="pg-flow-no">' + (i + 1) + "</span>" +
                '<span class="pg-flow-ico">' + U.icon(s ? s.icon : "box", 20) + "</span>" +
                '<span class="pg-flow-name">' + d.short + "</span>" +
                '<span class="pg-flow-desc">' + d.duty + "</span>" +
              "</div>";
            }).join("") +
          "</div>" +
          '<p class="pg-intro-foot">' + U.icon("lab", 16) +
            " 怎么用：先随便问一句，看右边工作台点亮哪几步；再依次做下面的五个实验；最后用小测验验收。</p>" +
        "</div>") +

      '<div class="play-wrap">' +
        /* 左：对话 */
        '<div class="card chat-card">' +
          '<div class="chat-head">' +
            '<div class="chat-avatar">' + U.icon("robot", 24) + "</div>" +
            '<div style="font-weight:800">智能体小管家</div>' +
            '<button class="btn btn-ghost btn-sm" id="pg-clear" style="margin-left:auto">' + U.icon("reset", 15) + " 新对话</button>" +
          "</div>" +
          '<div class="chat-msgs" id="pg-msgs"></div>' +
          '<div class="chip-row pg-chips" id="pg-chips">' +
            SUGGESTIONS.map(function (s) {
              return '<button type="button" class="chip-suggest">' + U.esc(s) + "</button>";
            }).join("") +
          "</div>" +
          '<div class="chat-input">' +
            '<input type="text" id="pg-input" placeholder="输入你的问题，按回车发送……">' +
            '<button class="btn btn-per" id="pg-send">' + U.icon("send", 16) + " 发送</button>" +
          "</div>" +
        "</div>" +

        /* 右：管线面板 */
        '<div class="card pipe-card">' +
          '<h2 style="font-size:18px">' + U.icon("spark", 20) + ' 智能体内部工作台<span style="font-size:12px;color:var(--c-sub);font-weight:400">（正在哪一步，哪一步就亮起来）</span></h2>' +
          '<div class="pipe-bar">' +
            '<span class="pipe-state" id="pg-state">待机</span>' +
            '<span class="pipe-legend"><i class="lg lg-run"></i>进行中<i class="lg lg-done"></i>已完成<i class="lg lg-skip"></i>本轮未参与</span>' +
            '<button class="btn btn-ghost btn-sm" id="pg-replay">' + U.icon("refresh", 14) + " 重放本轮</button>" +
          "</div>" +
          '<div class="pipe" id="pg-pipe">' +
            STAGES.map(function (s, i) {
              return (
                (i > 0 ? '<div class="pipe-arrow">▼</div>' : "") +
                '<div class="pipe-stage pipe-' + s.color + '" data-stage="' + s.id + '">' +
                  '<div class="picon">' + U.icon(s.icon, 22) + "</div>" +
                  '<div class="pmain">' +
                    '<div class="ptitle">' + s.name + '<span class="pdur"></span></div>' +
                    '<div class="pstatus">' + s.en + "</div>" +
                  "</div>" +
                  '<span class="pmark"></span>' +
                "</div>"
              );
            }).join("") +
          "</div>" +
          '<div class="pipe-log-head">' + U.icon("clock", 15) + ' 本轮轨迹<span id="pg-run-sum"></span></div>' +
          '<div class="pipe-log" id="pg-log"></div>' +
          '<button class="btn btn-ghost btn-sm" id="pg-inspect-btn" style="margin-top:12px;width:100%">' + U.icon("search", 16) + " 拆开看看：这一轮我给大脑发了什么（上下文）</button>" +
          '<div class="inspect-box" id="pg-inspect" style="display:none">' +
            '<div style="font-size:13px;color:var(--c-sub);margin-bottom:6px">这是真实发送给 DeepSeek 的请求，四种角色都在里面：<b>system</b>（规则 + 长期记忆档案）→ <b>user</b> 提问 → <b>assistant</b> 请求调用工具（tool_calls）→ <b>tool</b> 回传数据。看懂它，就懂了“上下文工程”。</div>' +
            '<div style="font-size:12px;color:var(--c-sub);margin-bottom:6px">说明：为了少一次往返，本项目由规划器在本地判定调用哪个工具，但发给模型时仍写成标准的 tool_calls + tool 两条消息——和真实 Function Calling 的样子一致。个别模型若要求额外字段（如思考模式的 reasoning_content）或接口不接受这种写法，会自动换写法重试，这里显示的是<b>最终真正发出去</b>的那份请求。</div>' +
            '<pre id="pg-inspect-pre" style="white-space:pre-wrap;font-size:12px;line-height:1.55;background:#1e1e28;color:#d8d8e8;border-radius:12px;padding:12px;max-height:280px;overflow:auto"></pre>' +
          "</div>" +
          '<div style="font-weight:700;margin:18px 0 4px;font-size:15px">' + U.icon("target", 18) + " 现场开关组件（Harness 约束）</div>" +
          '<div style="color:var(--c-sub);font-size:13px;margin-bottom:8px">关掉一个组件再提问，看看智能体的本领会怎么变化——这就是给 Agent 加“约束”。（下面的实验会跟着一起变）</div>' +
          '<div id="pg-flags">' +
            [
              { id: "perception", label: "感知器（观察）" },
              { id: "planner", label: "规划器（推理）" },
              { id: "memory", label: "记忆器（上下文）" },
              { id: "executor", label: "执行器" }
            ].map(function (f) {
              return '<div class="toggle-row"><span class="t-label">' + U.icon(
                f.id === "perception" ? "eye" : f.id === "planner" ? "gear" : f.id === "memory" ? "book" : "hand", 18
              ) + " " + f.label + "</span>" +
              '<label class="switch"><input type="checkbox" checked data-flag="' + f.id + '"><span class="slider"></span></label></div>';
            }).join("") +
          "</div>" +
          '<div class="pg-flag-try">' +
            '<button class="btn btn-brain btn-sm" id="pg-flag-run">' + U.icon("send", 14) + " 用当前这套开关，真实跑一句</button>" +
            '<span id="pg-flag-tip" class="pg-flag-tip"></span>' +
          "</div>" +
        "</div>" +
      "</div>" +

      /* 配套实验（全部可自动判定） */
      AgentLab.LabPerception.card("brain", "实验：这句话会点亮哪些环节？（管线阶段预测）",
        "先预测、再对照：看一句真实提问，选出这一轮<b>真的会发生</b>的动作——每选一条，右边的管线图就跟着亮；点「检查」后还能一键<b>真实跑一遍</b>，用自己的眼睛验证。",
        '<div id="pg-phase"></div>') +

      AgentLab.LabPerception.card("brain", "实验：拆开看看——这一轮到底给大脑发了什么？（上下文工程）",
        "工作台告诉你“亮了哪几步”，这里回答“<b>每一步往上下文里放了什么东西</b>”。先把四条消息按顺序拼出来（顺序错了模型会读不懂），再和<b>真实发出的那一份请求</b>对照。",
        '<div id="pg-ctx"></div>' +
        '<div class="pg-try">' +
          '<button class="btn btn-brain btn-sm" id="pg-ctx-run">' + U.icon("send", 14) + " 真实跑一遍这句话</button>" +
          '<button class="btn btn-ghost btn-sm" id="pg-ctx-real-btn">' + U.icon("search", 14) + " 对照：真实发出的一整份请求</button>" +
          '<span class="pg-try-tip">跑过一句之后，这里显示的就是刚才那份真家伙。</span>' +
        "</div>" +
        '<div class="inspect-box" id="pg-ctx-real" style="display:none">' +
          '<div class="pg-inspect-note">下面是本轮<b>真实发送</b>的请求体。对照一下你刚才拼的四条：角色顺序一样吗？system 里带上了哪些长期记忆？tool 那条和 assistant 的 tool_calls 对得上吗？</div>' +
          '<pre id="pg-ctx-real-pre" class="pg-pre"></pre>' +
        "</div>") +

      AgentLab.LabPerception.card("brain", "实验：关掉一个组件，哪件事就做不成了？",
        "给 Agent 加约束的最直观方式，就是关掉某个组件。这里的开关与上方<b>工作台开关双向联动</b>：关掉哪个，再去点下面的动作，看还有没有人兜底。",
        '<div id="pg-switch"></div>' +
        '<div class="pg-try"><button class="btn btn-brain btn-sm" id="pg-switch-run">' + U.icon("send", 14) + ' 带着这套开关，真实跑一遍</button>' +
        '<span class="pg-try-tip">开关一变，同一句话的成败也会跟着变。</span></div>') +

      AgentLab.LabPerception.card("brain", "实验：给智能体做一次“体检”（评估——固定题集 + 指标 + 前后对比）",
        "老师改了一版小管家，怎么知道它到底<b>变好了还是变坏了</b>？靠“感觉”不算——用同一份<b>固定题集</b>跑两个版本，把结果填进同一张<b>指标表</b>里对比。",
        '<div id="pg-eval"></div>') +

      AgentLab.LabPerception.card("brain", "实验：读轨迹，找故障（可观测性 / Trace）",
        "智能体出错时不会自己说“我第 3 步错了”。工程师靠的是<b>轨迹（Trace）</b>——每一步都留下记录，才能倒推是哪一环出的问题。来看几段真实风格的轨迹，判断故障出在哪一环。",
        '<div id="pg-trace"></div>') +

      /* 小测验 */
      AgentLab.LabPerception.card("brain", "小测验：综合验收——你是智能体小达人吗？",
        "共 " + PG_QUIZ.length + " 题，覆盖 Agent 公式、循环、Harness、上下文工程、评估与可观测性、人在环、多智能体。答对一题加一颗星！",
        '<div class="game-box" id="pg-quiz"><div id="pg-quiz-body"></div></div>' +
        '<div class="score-line"><span class="score-badge" id="pg-quiz-score" data-score="0">★ 0</span><button class="btn btn-ghost btn-sm" id="pg-quiz-restart">重来</button></div>') +

      /* 进阶原理互动课堂 */
      AgentLab.LabPerception.card("brain", "进阶原理互动课堂：智能体在真实 AI 系统里是什么？（ai-agent-book 第 1/7/9/10 章）",
        "9 个真实工程概念（ai-agent-book 第 1/7/9/10 章）：<b>左边选概念，右边看讲解 + 动手实验</b>——每个都配「一句话 / 打个比方 / 真实系统 / 动手做 / 自检一问」，还能一键跳回上面做过的实验。",
        '<div class="pg-adv-progress" id="pg-adv-progress"></div>' +
        AgentLab.Adv.panelHTML({ key: "brain", concepts: pgConcepts() })) +

      /* 课堂小结：放在全课最末，与记忆器 / 执行器两个实验室的口径一致 */
      AgentLab.LabPerception.card("brain", "课堂小结（L13 综合实战）",
        "把这一课串成一条线：一个智能体 = 一次循环 + 一层编排 + 一套评估。",
        '<div class="lesson-summary card-brain">' +
          '<h3>' + U.icon("check", 18) + " 核心结论</h3>" +
          '<div class="summary-core"><b>智能体 = LLM + 上下文 + 工具</b>，由 <b>Harness</b> 把它编排成一个能自我循环的系统：观察 → 推理 → 行动 → 再观察。四个组件各管一段：感知器把世界变成上下文，规划器决定怎么做，记忆器决定记住什么，执行器把决定变成真实动作。判断它好不好，不能靠“感觉”，要靠<b>固定题集 + 明确指标 + 前后对比</b>；出了错，要靠<b>轨迹</b>倒推是哪一环的问题。</div>' +
          '<div class="summary-points">' +
            '<div class="sp-item"><span class="sp-icon" style="background:var(--c-brain)">' + U.icon("refresh", 14) + '</span><div><b>循环是关键：</b>能不能“看结果再决策”，是智能体与聊天机器人的分界线</div></div>' +
            '<div class="sp-item"><span class="sp-icon" style="background:var(--c-brain)">' + U.icon("shield", 14) + '</span><div><b>Harness 是护栏：</b>上下文、工具接口、约束、验证、纠正、审计——都在模型外面</div></div>' +
            '<div class="sp-item"><span class="sp-icon" style="background:var(--c-brain)">' + U.icon("target", 14) + '</span><div><b>评估是方向盘：</b>没有固定题集和指标，就不知道改动到底是在变好还是变坏</div></div>' +
            '<div class="sp-item"><span class="sp-icon" style="background:var(--c-brain)">' + U.icon("microscope", 14) + '</span><div><b>轨迹是显微镜：</b>每一步都留下记录，出错时才能查出是感知、规划、记忆还是执行的问题</div></div>' +
            '<div class="sp-item"><span class="sp-icon" style="background:var(--c-brain)">' + U.icon("lock", 14) + '</span><div><b>危险动作要人点头：</b>删数据、发消息、花钱这类事，先问人再执行——这就是“人在环”</div></div>' +
            '<div class="sp-item"><span class="sp-icon" style="background:var(--c-brain)">' + U.icon("users", 14) + '</span><div><b>团队看任务：</b>能清晰拆成独立子任务才值得上多智能体；简单任务一个人更快更省</div></div>' +
          "</div>" +
          '<div class="summary-think"><b>课后思考：</b>如果让你给班级小管家再加一个组件，你会加什么？（提示：想想现在还有哪件事它做不好）加之前先想清楚：<b>能测出它变好了吗？</b></div>' +
        "</div>");

    bind();

    /* 配套实验 + 小测验 + 进阶原理互动课堂 */
    bindPgPhase();
    bindPgCtx();
    bindPgSwitch();
    bindPgEval();
    bindPgTrace();
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

  /* ---------- 内部工作台：三态（进行中 / 已完成 / 本轮未参与）+ 本轮轨迹 ----------
   * 设计意图：一轮结束后工作台要“留下证据”——哪些环节真的参与了、各花了多久、
   * 每一步具体做了什么。学生一眼就能看出“这一轮执行器没被用上”。 */
  var stageState = {};      // id → { status, text, ms, t0 }
  var activeStage = null;
  var runStartAt = 0;
  var replayTimer = null;
  var replayMode = false;   // 重放中：动画只做演示，不要覆盖真实耗时
  var replayMs = {};

  function stageNode(id) { return document.querySelector('.pipe-stage[data-stage="' + id + '"]'); }

  function resetStages() {
    if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
    STAGES.forEach(function (s) {
      stageState[s.id] = { status: "idle", text: s.en, ms: 0, t0: 0 };
    });
    activeStage = null;
    runStartAt = 0;
    paintStages();
    paintLog();
  }

  function paintStages() {
    STAGES.forEach(function (s) {
      var el = stageNode(s.id);
      if (!el) return;
      var st = stageState[s.id] || { status: "idle", text: s.en };
      el.classList.toggle("on", st.status === "run");
      el.classList.toggle("done", st.status === "done");
      el.classList.toggle("skip", st.status === "skip");
      var status = el.querySelector(".pstatus");
      if (status) status.textContent = st.text;
      var dur = el.querySelector(".pdur");
      if (dur) dur.textContent = st.status === "done" && st.ms ? (st.ms / 1000).toFixed(1) + "s" : "";
      var mark = el.querySelector(".pmark");
      if (mark) {
        mark.className = "pmark is-" + st.status;
        mark.textContent = st.status === "done" ? "✓" : st.status === "skip" ? "—" : st.status === "run" ? "●" : "";
      }
    });
  }

  /* 有阶段来过就算“参与过”：done / run 都算，skip 不算 */
  function usedStages() {
    return STAGES.filter(function (s) {
      var st = stageState[s.id];
      return st && (st.status === "done" || st.status === "run");
    });
  }

  function paintLog() {
    var box = $("pg-log");
    if (!box) return;
    var total = 0;
    var rows = usedStages().map(function (s) {
      var st = stageState[s.id];
      total += st.ms || 0;
      return '<div class="pg-log-row c-' + s.color + '">' +
        '<span class="pg-log-dot">' + U.icon(s.icon, 13) + "</span>" +
        '<span class="pg-log-body"><b>' + s.name + "</b>" + U.esc(st.text || "") + "</span>" +
        '<span class="pg-log-ms">' + (st.ms ? (st.ms / 1000).toFixed(1) + "s" : "") + "</span>" +
        "</div>";
    }).join("");

    // 没参与的环节也交代一句，学生才不会误会“它坏了”
    var skips = STAGES.filter(function (s) { return stageState[s.id] && stageState[s.id].status === "skip"; });
    var skip = (rows && skips.length)
      ? '<div class="pg-log-skip"><b>本轮未参与</b>' + skips.map(function (s) {
        return "【" + s.name + "】" + U.esc(String(stageState[s.id].text || "").replace(/^本轮没用上：/, ""));
      }).join("") + "</div>"
      : "";

    box.innerHTML = (rows || '<div class="pg-log-empty">还没有运行记录——在上面提一个问题，这里会按顺序记下这一轮每一步做了什么。</div>') + skip;
    var sum = $("pg-run-sum");
    if (sum) {
      sum.textContent = rows
        ? "点亮 " + usedStages().length + "/" + STAGES.length + " 个环节 · 共 " + (total / 1000).toFixed(1) + " 秒"
        : "";
    }
  }

  /**
   * @param {string} [flag] 传 "skip" 表示这一环本轮不参与（例如本轮不需要调用工具）
   */
  function setStage(id, text, flag) {
    var now = Date.now();
    if (!runStartAt) runStartAt = now;
    if (!stageState[id]) stageState[id] = { status: "idle", text: "", ms: 0, t0: 0 };
    if (flag === "skip") {
      // 不点亮、不算耗时，只把“为什么没用上”记下来
      if (stageState[id].status === "idle") {
        stageState[id].status = "skip";
        if (text) stageState[id].text = text;
      }
      paintStages();
      paintLog();
      return;
    }
    if (activeStage && activeStage !== id) finishStage(activeStage, now);
    var st = stageState[id];
    if (st.status !== "run") { st.status = "run"; st.t0 = now; }
    if (text) st.text = text;
    activeStage = id;
    paintStages();
    paintLog();
  }

  function finishStage(id, now) {
    var st = stageState[id];
    if (!st || st.status !== "run") return;
    st.status = "done";
    // 重放时保留原来的真实耗时（否则会被动画节奏盖掉）
    st.ms = (replayMode && replayMs[id] !== undefined) ? replayMs[id] : Math.max(0, now - st.t0);
  }

  /* 一轮结束：定格“完成”，没露过面的环节标成“本轮未参与” */
  function endRun() {
    if (activeStage) finishStage(activeStage, Date.now());
    activeStage = null;
    STAGES.forEach(function (s) {
      var st = stageState[s.id];
      if (st && st.status === "idle") { st.status = "skip"; st.text = "本轮没用上：这个环节这次没有参与"; }
    });
    paintStages();
    paintLog();
  }

  /* 重放本轮：按刚才的顺序再点亮一遍，方便老师慢放讲解 */
  function replayRun() {
    if (busy) { U.toast("上一轮还在跑，稍等一下再重放～"); return; }
    var seq = usedStages().map(function (s) { return { id: s.id, text: stageState[s.id].text, ms: stageState[s.id].ms }; });
    if (!seq.length) { U.toast("还没有可重放的一轮——先提一个问题吧"); return; }
    var keepSkips = STAGES.filter(function (s) {
      return stageState[s.id] && stageState[s.id].status === "skip";
    }).map(function (s) { return { id: s.id, text: stageState[s.id].text }; });

    if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
    replayMode = true;
    replayMs = {};
    seq.forEach(function (x) { replayMs[x.id] = x.ms; });
    resetStages();
    var i = 0;
    (function step() {
      if (i >= seq.length) {
        keepSkips.forEach(function (k) {
          stageState[k.id].status = "skip";
          stageState[k.id].text = k.text;
        });
        STAGES.forEach(function (s) {
          var st = stageState[s.id];
          if (st && st.status === "idle") { st.status = "skip"; st.text = "本轮没用上：这个环节这次没有参与"; }
        });
        paintStages();
        paintLog();
        replayTimer = null;
        replayMode = false;
        U.toast("重放结束：这一轮点亮了 " + seq.length + " 个环节");
        return;
      }
      var cur = seq[i++];
      setStage(cur.id, cur.text);
      replayTimer = setTimeout(step, 850);
    })();
  }

  /* 每条回答下面的“本轮组件徽章”：把聊天和工作台连起来看 */
  function turnBadgesHTML() {
    var chips = STAGES.map(function (s) {
      var st = stageState[s.id] || {};
      var used = st.status === "done" || st.status === "run";
      return '<span class="turn-chip c-' + s.color + (used ? " used" : "") + '">' +
        U.icon(s.icon, 13) + s.name + (used ? "" : "<i>未参与</i>") + "</span>";
    }).join("");
    var plan = stageState.planner ? String(stageState.planner.text || "").replace(/^制定计划：/, "") : "";
    return '<div class="turn-meta">' +
      (plan ? '<div class="turn-plan">' + U.icon("gear", 13) + "<b>本轮计划</b>" + U.esc(plan) + "</div>" : "") +
      '<div class="turn-chips">' + chips + "</div>" +
      "</div>";
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

  /* 工作台右上角的状态牌 */
  function setStatePill(state, text) {
    var el = $("pg-state");
    if (!el) return;
    var map = { idle: "待机", running: "运行中…", done: "本轮完成", error: "出错了" };
    el.textContent = text || map[state] || "";
    el.className = "pipe-state is-" + state;
  }

  /* 执行器调用：单独渲染成“调用 + 结果”两段小卡，比一行文字更好看也更清楚 */
  function addToolMsg(tool) {
    var box = $("pg-msgs");
    var d = document.createElement("div");
    d.className = "msg ai tool-note";
    d.innerHTML = '<span class="who">' + U.icon("wrench", 14) + " 执行器 · " + U.esc(tool.name || "工具") + "</span>" +
      '<div class="tool-call"><b>调用</b>' + U.esc(tool.summary || "") + "</div>" +
      '<div class="tool-result"><b>结果</b>' + U.esc(tool.result || "") + "</div>";
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    return d;
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
    replayMode = false;                  // 真实运行时按真实节奏计时
    replayMs = {};
    resetStages();
    setStatePill("running");

    try {
      await Agent.run(text, history, {
        onStage: function (id, text, flag) { setStage(id, text, flag); },
        onTool: function (tool) {
          addToolMsg(tool);
          if (tool.name === "计时器工具" && tool.payload && tool.payload.seconds) {
            startTimer(tool.payload.seconds, tool.payload.label, tool.payload.pomodoro, tool.payload.remindText);
          }
        },
        onPayload: function (messages) { lastPayload = messages; renderPayload(messages); },
        onDone: async function (answer) {
          history.push({ role: "assistant", content: answer });
          endRun();                        // 先把工作台定格，再写字
          setStatePill("done");
          var el = addMsg("ai", "");
          await U.typewriter(el, answer, 12);
          el.insertAdjacentHTML("beforeend", turnBadgesHTML());
          el.scrollIntoView && el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        },
        onError: function (err) {
          setStatePill("error");
          addMsg("ai", "出错了：" + (err.message || err) + "\n\n小提示（卡住三步走）：① 自己读一遍问题并复述 ② 把问题说清楚再问 AI ③ 还不行就求助老师/同伴。");
        }
      });
    } finally {
      endRun();                          // 幂等：出错时也把未参与的环节标清楚
      busy = false;
      $("pg-send").disabled = false;
      $("pg-input").focus();
    }
  }

  /* ---------- 实验与“真实运行”之间的桥 ---------- */
  var switchDemoApi = null;   // 实验②的开关句柄（由 bindPgSwitch 赋值，用于双向同步）
  var FLAG_LABELS = { perception: "感知器", planner: "规划器", memory: "记忆器", executor: "执行器" };

  function offFlags() {
    return ["perception", "planner", "memory", "executor"].filter(function (f) { return Agent.flags[f] === false; });
  }

  function flagTipHTML() {
    var tip = $("pg-flag-tip");
    if (!tip) return;
    var off = offFlags();
    tip.innerHTML = off.length
      ? "已关：" + off.map(function (f) { return "<b>" + FLAG_LABELS[f] + "</b>"; }).join("、") + "——看看它还能做成什么。"
      : "四个组件全开——跑一句需要工具的话试试。";
  }

  /* 按当前开关挑一句“最能暴露问题”的测试题 */
  function pickTestQuestion() {
    if (Agent.flags.memory === false) return "今天下午有什么课？";
    if (Agent.flags.executor === false) return "明天会下雨吗？";
    if (Agent.flags.planner === false) return "帮我算 25×4+10";
    return "明天会下雨吗？";
  }

  /* 把实验里的设定带进真实对话：滚到对话区并真的问出去 */
  function runInChat(text) {
    if (busy) { U.toast("上一轮还没跑完，稍等一下～"); return; }
    if (!AgentLab.API.hasApiKey()) {
      U.toast("真实提问需要 DeepSeek API Key：点右上角「设置」填一个");
      return;
    }
    var target = $("pg-msgs");
    if (target && target.scrollIntoView) {
      try { target.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) { }
    }
    send(text);
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
      resetStages();
      setStatePill("idle");
      U.toast("已开启新对话（短期记忆已清空）");
    });

    var replayBtn = $("pg-replay");
    if (replayBtn) replayBtn.addEventListener("click", replayRun);

    var flagRun = $("pg-flag-run");
    if (flagRun) flagRun.addEventListener("click", function () { runInChat(pickTestQuestion()); });
    flagTipHTML();

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
      var id = cb.getAttribute("data-flag");
      cb.checked = Agent.flags[id] !== false;
      cb.addEventListener("change", function () {
        Agent.flags[id] = cb.checked;
        if (switchDemoApi) switchDemoApi.set(id, cb.checked);   // 同步到下方实验②的开关
        flagTipHTML();
        U.toast(cb.checked ? "已打开：" + FLAG_LABELS[id] + "（下方实验的开关已同步）" : "已关闭：" + FLAG_LABELS[id] + "，再问一句试试！");
      });
    });

    // 欢迎语
    var box = $("pg-msgs");
    box.innerHTML = '<div class="msg ai"><span class="who">智能体小管家</span>你好！我是智能体小管家。你可以问我班级的事、明天的天气，也可以让我算题、记提醒。发一句话，右侧“内部工作台”会一步步亮起来——点「重放本轮」可以慢放重讲，点「拆开看看」还能看到我这一轮真实收到的上下文。</div>';
    resetStages();
    setStatePill("idle");
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
      links: [{ t: "实验：给智能体做体检", el: "pg-eval" }]
    },
    {
      id: "context", icon: "archive", nav: "上下文工程", name: "上下文工程（Context Engineering）", en: "CONTEXT ENGINEERING",
      tip: "对模型来说，<b>看不见的东西＝不存在</b>。上下文工程就是决定：这一轮到底把哪些信息、按什么顺序递给模型。",
      analogy: "像给转学生写一张“情况说明”：写多了他抓不住重点，写少了又什么都不知道；还得按“先规则、再背景、最后问题”的顺序写。",
      real: "上下文 = 静态前缀（system 规则 + 长期记忆档案）+ 轨迹（历史的 user / assistant）+ 本轮提问 + 工具结果。这四样各有出处、各有体积：塞得越多越贵、越容易淹没重点，还可能把隐私一起交出去。工程上要按预算分配、先检索再注入，而不是把知道的全都倒进去。",
      quiz: { q: "为什么不能“把知道的全都发给模型”？", a: "三个代价：① 上下文窗口有限，装不下就会被挤出；② 越长越贵、越慢；③ 无关信息会淹没重点、干扰判断。所以要“该带什么带什么，按顺序放”。" },
      links: [{ t: "实验：拆开看看上下文", el: "pg-ctx" }, { t: "内部工作台", el: "pg-pipe" }]
    },
    {
      id: "observability", icon: "microscope", nav: "可观测性 · Trace", name: "可观测性与 Trace", en: "OBSERVABILITY",
      tip: "上线以后的智能体，出错是常态。可观测性＝“我能看见它每一步干了什么”，靠的是轨迹（Trace）与日志。",
      analogy: "像考试要看“过程分”：只看最后答案，永远不知道为什么错；把草稿纸也交上来，老师一眼就能看出哪一步跑偏了。",
      real: "真实系统给每条请求分配一个 trace id，把每一步的输入输出、耗时、工具参数、返回码都记下来，再配上仪表盘。有了它才能定位故障环节、复现问题、对比版本、算清成本。没有可观测性的智能体就是黑盒——出了事只能靠猜。",
      quiz: { q: "没有 Trace 日志，会带来什么麻烦？", a: "只看到最后那句错话，无法判断是哪一环的锅：输入没整理好？工具选错了？记忆没带上？工具真的挂了？还是模型自己编的？定位不了，就没法针对性修复——下次还会错。" },
      links: [{ t: "实验：读轨迹找故障", el: "pg-trace" }, { t: "内部工作台", el: "pg-pipe" }]
    },
    {
      id: "recovery", icon: "refresh", nav: "错误恢复与降级", name: "错误恢复与降级", en: "RETRY & FALLBACK",
      tip: "工具会超时、接口会报错、模型会拒绝某种写法。靠谱的系统必须有“退路”：重试、换写法降级、兜底回答。",
      analogy: "像出门带伞：不是盼着下雨，而是下雨了也不至于淋成落汤鸡。",
      real: "常见三招：① <b>重试</b>——超时或限流时等一会儿再来，且必须设次数上限；② <b>降级</b>——标准写法被拒就换一种写法，模型不可用就换备用模型；③ <b>兜底</b>——如实说“暂时查不到”，给替代方案，绝不编造。本项目就实现了这三招：你在工作台看到的那次“换写法重试”，是真实的降级过程。",
      quiz: { q: "重试次数是不是越多越好？", a: "不是。重试能提高成功率，但每次都要花时间和 Token；碰到确定性的失败（密钥错、参数错），重试再多次也没用。所以要设上限、区分错误类型，超时后走降级或兜底。" },
      links: [{ t: "内部工作台（看失败提示）", el: "pg-pipe" }]
    },
    {
      id: "humanloop", icon: "lock", nav: "人在环 · 自主性分级", name: "人在环与自主性分级（Human-in-the-Loop）", en: "HUMAN IN THE LOOP",
      tip: "不是所有事都该让 Agent 自己决定。按“能不能撤销、影响多大”分成三档：<b>自动执行 / 先问人 / 直接禁止</b>。",
      analogy: "像家里的电器：开台灯随便开（自动），用煤气灶要有人在旁边（先问人），拆插座你自己不许动手（禁止）。",
      real: "工程做法是按风险设“闸门”：只读、可撤销的操作自动执行；写操作（发消息、删数据、花钱、提交表单）走人工确认；越权和危险动作直接禁止。确认环节也要设计好——给出“要做什么 + 影响范围 + 能不能撤销”，让人一眼能判断。这属于 Harness 的职责。",
      quiz: { q: "为什么“能撤销”和“不能撤销”要分成两档？", a: "因为犯错的代价完全不同：可撤销的操作（查天气、改写草稿）错了也没关系，自动执行更快；不可撤销的操作（删数据、发消息、付款）错了就收不回来，必须先让人确认。分级的依据是“错误代价”，不是“技术难度”。" },
      links: [{ t: "实验：关掉一个组件", el: "pg-switch" }]
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
    context: "picker", observability: "pipeline", recovery: "tuner",
    humanloop: "decider", evaluation: "picker", multiagent: "sandbox"
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
    context: {
      title: "动手实验：这一轮该把哪些信息装进上下文？", hint: "多选后检查", icon: "archive",
      taskLabel: "情境：",
      task: "同学问：<b>“我是学习委员，今天下午有什么课？”</b>（上一轮他还说过“我在北京”）。请选出所有<b>应该</b>放进这一轮上下文的信息。",
      checkLabel: "检查我装的东西",
      empty: "先点选你认为该装进上下文的信息，再点「检查我装的东西」。",
      passHtml: "装得刚刚好：<b>该带的带全了，不该带的没带</b>——这就是上下文工程。",
      failHtml: "判断口诀：① 回答问题真的需要它吗？② 它是谁的隐私？③ 它会把上下文撑得多长？",
      items: [
        { id: "c1", label: "系统规则 + 边界说明书（system）", ok: true, why: "每次请求都要有：模型才知道自己是谁、能做什么、不能做什么。" },
        { id: "c2", label: "班级知识库里的课表（由记忆器检索出来）", ok: true, why: "这正是回答“今天下午有什么课”所必需的信息，检索出来再注入。" },
        { id: "c3", label: "同学这一轮问的那句话", ok: true, why: "本轮 user 消息，问题的本体，必须在。" },
        { id: "c4", label: "上一轮说过的“我在北京”", ok: true, why: "短期记忆（轨迹）要原样回放——万一后面要查天气，城市就在这儿。" },
        { id: "c5", label: "全班同学的家庭住址和电话", ok: false, why: "和这个问题毫无关系，而且是隐私。放进上下文＝把它交给模型，既没必要也危险。" },
        { id: "c6", label: "三天前和同桌聊“哪款游戏好玩”的整段记录", ok: false, why: "与课表无关，只会把上下文撑长、淹没重点——这正是“上下文预算”要管的事。" },
        { id: "c7", label: "模型训练时用过的全部原始语料", ok: false, why: "训练语料已经融进模型参数里了，不会、也不可能每次请求重发一遍。" }
      ]
    },
    observability: {
      title: "动手实验：跟着工程师走一遍排查流程", hint: "单步推进", icon: "microscope",
      playLabel: "自动播放排查过程", stepLabel: "单步推进", resetLabel: "重来",
      logTitle: "排查日志",
      stages: [
        { id: "trace", name: "拿到轨迹", icon: "archive", en: "Trace", io: "调出这条请求的 trace：五步的输入输出、耗时、工具参数，全都在" },
        { id: "locate", name: "定位环节", icon: "target", en: "Locate", io: "从第一条往下看，找<b>第一个</b>和预期对不上的输出——那里才是病根" },
        { id: "repro", name: "复现问题", icon: "refresh", en: "Reproduce", io: "用同样的输入再跑一遍：能稳定重现，才说明找到的是真原因" },
        { id: "fix", name: "修复", icon: "wrench", en: "Fix", io: "对症下药：补上记忆 / 改工具描述 / 加约束 / 换提示词——而不是盲目换模型" },
        { id: "regress", name: "回归测试", icon: "check", en: "Regression", io: "用固定题集再跑一遍全部用例：确认修好了，也没把别的弄坏" }
      ],
      guess: {
        q: "先猜一猜：排查时最该避免哪一种做法？",
        opts: [
          { k: "first", t: "从轨迹第一条开始，找第一个不对劲的输出" },
          { k: "blame", t: "不看记录，直接怪“模型太笨”并换个更贵的模型" },
          { k: "repro", t: "用同样的输入再跑一遍，确认能不能重现" }
        ],
        ans: "blame",
        why: "把一切归因于“模型太笨”，是最常见的偷懒：凭感觉换模型既贵又不可复现，而且如果病根在记忆没带上、工具描述写错，换了模型照样错。先看轨迹，是对症下药的前提。",
        hint: "想想哪种做法的结论最不可靠。",
        revealAt: 1
      }
    },
    recovery: {
      title: "动手实验：重试次数该设几次？", hint: "拖滑条看指标", icon: "refresh",
      paramLabel: "最多重试几次", min: 0, max: 5, step: 1, value: 0, unit: "次",
      metricLabel: "任务成功率（示意）",
      compute: function (v) {
        /* 教学示意曲线：0 次最差；1~3 次收益最明显；4 次到顶；5 次开始收益递减 */
        var rate = Math.round(72 + 9 * v - 1.2 * v * v);
        if (rate > 96) rate = 96;
        var note, level;
        if (v === 0) {
          note = "一次失败就放弃：断网、限流这类“临时故障”会直接让任务失败。没有任何退路的系统，成功率最低。";
          level = "warn";
        } else if (v <= 3) {
          note = "重试 " + v + " 次：临时故障基本能被吃掉，成功率提升明显，成本也还可控。";
          level = "ok";
        } else if (v === 4) {
          note = "重试 4 次：成功率已经摸到这条曲线的最高点——再多加次数，收益就很小了。";
          level = "ok";
        } else {
          note = "重试 " + v + " 次：成功率不再提高（甚至略降），但每次失败都要多等好几秒、多花好几份 Token——这就是“收益递减”。";
          level = "warn";
        }
        return { value: rate, label: rate + "%", note: note, level: level };
      },
      touchedHint: "把滑条从 0 拖到 5，比较不同取值下的成功率。",
      best: {
        q: "想清楚再答：成功率最高是重试 4 次，为什么生产系统常常只设 2~3 次？",
        opts: ["因为重试次数多了成功率反而下降", "因为每多一次重试都要多花时间和钱，而收益越来越小", "因为设几次其实没区别"],
        ans: 1,
        why: "成功率从 86% 提到 90% 只多 4 个点，但失败场景下的等待时间几乎翻倍、成本上升。“够用就好、留有余量”才是工程取舍。",
        hint: "把滑条拖到 2 和 5，比较成功率和付出的代价。"
      }
    },
    humanloop: {
      title: "动手实验：这个操作该自动做、先问人，还是直接禁止？", hint: "答两问出结论", icon: "lock",
      emptyText: "先回答上面两个问题，系统会给出这一档的判断。",
      questions: [
        { key: "undo", q: "① 这个操作做错了，能撤销吗？", opts: [{ k: "yes", t: "能撤销（可恢复）" }, { k: "no", t: "不能撤销（删了 / 发了就回不来）" }] },
        { key: "scope", q: "② 影响范围有多大？", opts: [{ k: "me", t: "只影响我自己 / 一次性" }, { k: "others", t: "会影响别人或全班" }] }
      ],
      decide: function (ans) {
        if (ans.undo === "no" && ans.scope === "others") {
          return "<b>建议：必须“先问人”，甚至直接禁止。</b><br>" +
            '<span class="dim">不可撤销 + 影响别人 = 风险最高的一档。删全班作业、给同学群发消息、提交报名表都属于这一类：执行前必须把“要做什么、影响谁、能不能撤回”讲清楚，等人点头。</span>' +
            '<br><b>例子：</b>“帮我把全班作业都删掉”——正确回答是拒绝执行。';
        }
        if (ans.undo === "no") {
          return "<b>建议：先问人确认一次。</b><br>" +
            '<span class="dim">做错了收不回来，但影响范围只有自己——确认一次就够了，不必走复杂审批。</span>' +
            '<br><b>例子：</b>“清空我的草稿箱”。';
        }
        if (ans.scope === "others") {
          return "<b>建议：可以自动执行，但要留下记录并告知。</b><br>" +
            '<span class="dim">可撤销 + 影响别人：做错了能补救，所以不必每次都问；关键是要有日志和通知，出了问题能查、能撤回。</span>' +
            '<br><b>例子：</b>“把公告发到班级群（可撤回）”。';
        }
        return "<b>建议：放心自动执行。</b><br>" +
          '<span class="dim">只读或可撤销、又只影响自己——这类操作交给 Agent 自动化最划算。</span>' +
          '<br><b>例子：</b>“查一下明天的天气”“把这段话改得更简单”。';
      }
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

  /* 进阶课堂：记录“已探索过哪些概念”，给学生一个可见的进度 */
  var pgSeen = {};

  function pgPaintProgress() {
    var box = $("pg-adv-progress");
    if (!box) return;
    var n = 0;
    Object.keys(pgSeen).forEach(function (k) { if (pgSeen[k]) n++; });
    box.classList.toggle("all", n >= PG_ADV.length);
    box.innerHTML = U.icon(n >= PG_ADV.length ? "check" : "book", 14) +
      " 已探索 <b>" + n + "</b> / " + PG_ADV.length + " 个概念" +
      (n >= PG_ADV.length
        ? '——全看完啦，去上面做个小测验验收一下'
        : "（左边点一个概念，右边就是它的动手实验）");
    var root = $("sec-playground");
    if (!root) return;
    root.querySelectorAll(".adv-nav-btn").forEach(function (b) {
      b.classList.toggle("seen", !!pgSeen[b.getAttribute("data-id")]);
    });
  }

  function bindPgAdv() {
    AgentLab.Adv.bind($("sec-playground"), {
      key: "brain", concepts: pgConcepts(), color: "brain",
      onActive: function (id) { pgSeen[id] = true; pgPaintProgress(); }
    });
    pgPaintProgress();
  }

  /* ============================================================
   * 实验：拆开看看——上下文工程（消息池点选 → 拼出真实请求）
   * 交互由共享引擎 AgentLab.Adv.types.composer 渲染
   * ============================================================ */
  var CTX_DEMO = {
    title: "动手实验：把这一轮的上下文拼出来",
    hint: "按顺序点",
    icon: "archive",
    poolTitle: "① 消息池：这一轮要用到的五条消息（顺序不对会被拦下来）",
    /* 池子顺序刻意打乱；正确答案见下方 note。role 就是真实 API 里的四种角色。 */
    pool: [
      { role: "user", text: "我在北京", tag: "上一轮说过的话——短期记忆（轨迹）原样回放" },
      { role: "user", text: "明天会下雨吗？", tag: "这一轮同学打的问题" },
      { role: "assistant", text: "（先请求调用天气工具，参数：city=北京, date=明天）", tag: "AI 请求调用工具：tool_calls", toolcall: true },
      { role: "tool", text: "北京 明天：小雨，15~19℃，东北风 3 级（真实气象数据）", tag: "执行器调用工具后回传的数据" },
      { role: "system", text: "你是班级小管家……（规则 + 边界说明书）＋ 长期记忆档案：班级知识库", tag: "Harness 组装：规则 + 长期记忆（每次都在，且必须是第一条）" }
    ],
    ctxTitle: "② 已经放进上下文的消息（从上到下就是模型读到的顺序）",
    jsonTitle: "③ 拼好之后，真实请求长这样（messages 数组）",
    rules: { systemFirst: true, toolNeedsCall: true },
    notes: {
      ok: "加入成功",
      used: "这一条已经放进上下文了——真实请求里同一条不会发两遍。",
      systemLate: "system 必须排在最前面：它是“总规则 + 长期记忆档案”，模型从第一条就开始读它，放到后面就晚了。",
      toolEarly: "tool 消息不能单独出现：它必须紧跟在 assistant 的 tool_calls 请求之后，告诉模型“你刚才要的数据在这里”。",
      done: "<span class=\"ok\">✓ 五条齐了！</span>顺序是：<b>system → 历史（上一轮的 user）→ 本轮 user → assistant(tool_calls) → tool</b>。这就是一次真实 Function Calling 请求的完整上下文——和右侧工作台里「拆开看看」显示的那份一模一样。"
    },
    demoNoSystem: {
      label: "对照：如果少了 system（规则 + 长期记忆）",
      skipRole: "system",
      note: "少了 system：模型不知道自己是“班级小管家”，也拿不到班级知识库和边界说明书——它甚至不知道“明天”是相对哪一天说的。真实系统里，这一段几乎必然答偏。"
    },
    resetLabel: "清空重来",
    emptyCtx: "还没有内容——从上面的消息池里挑一条放进来。想清楚：模型读到的第一条应该是什么？"
  };

  function bindPgCtx() {
    var host = $("pg-ctx");
    if (!host) return;
    var t = AgentLab.Adv.types.composer;
    host.innerHTML = t.demoHTML(CTX_DEMO);
    t.bind(host, CTX_DEMO);

    var runBtn = $("pg-ctx-run");
    if (runBtn) runBtn.addEventListener("click", function () { runInChat("明天会下雨吗？"); });

    var realBtn = $("pg-ctx-real-btn");
    if (realBtn) realBtn.addEventListener("click", function () {
      var box = $("pg-ctx-real");
      var pre = $("pg-ctx-real-pre");
      var isHidden = box.style.display === "none";
      box.style.display = isHidden ? "block" : "none";
      if (!isHidden) return;
      if (lastPayload) {
        pre.textContent = JSON.stringify(lastPayload, null, 2);
      } else {
        pre.textContent =
          "（还没有真实请求记录）先点左边的「真实跑一遍这句话」，再回来看这里。\n\n" +
          "如果暂时没有 DeepSeek API Key，也可以先看工作台里的「拆开看看」按钮说明，或者对照你刚才拼出来的 messages。";
      }
    });
  }

  /* ---------- 实验①：管线阶段预测（预测 → 点亮管线图 → 逐条讲解 → 真实跑） ---------- */
  var PHASE_CASES = [
    {
      id: "hello",
      say: "你好，我叫小明",
      note: "这是这次对话的第一句话（之前没有对话记录）",
      items: [
        { id: "a1", stage: "perception", ok: true, label: "把这句话整理成一条 user 消息", why: "感知器负责把输入（这里是打字）整理成带角色的消息。" },
        { id: "a2", stage: "planner", ok: true, label: "判断“这句不用查工具”", why: "规划器先做判断：打招呼不需要外部数据，不用调工具。" },
        { id: "a3", stage: "memory", ok: true, label: "把班级知识库和之前的对话带进上下文", why: "记忆器把长期记忆（班级知识库）和短期记忆（对话历史）一起放进上下文——这一次历史还是空的。" },
        { id: "a4", stage: "brain", ok: true, label: "生成“你好，小明！”这句回答", why: "最后由大语言模型基于上下文生成回答。" },
        { id: "a5", stage: "executor", ok: false, label: "调用天气工具查一下今天天气", why: "打招呼不需要实时天气——乱调工具既慢又费 Token。" },
        { id: "a6", stage: "perception", ok: false, label: "把同学说话的声音转成文字", why: "这一轮是打字输入，语音通道（ASR）没有参与。" },
        { id: "a7", stage: "memory", ok: false, label: "把“我叫小明”写进长期记忆", why: "同学只说了一次、也没要求“记住”——写长期记忆有成本，也有隐私风险，不是默认动作。" }
      ]
    },
    {
      id: "weather",
      say: "明天会下雨吗？",
      note: "上一轮他说过“我在北京”",
      items: [
        { id: "b1", stage: "perception", ok: true, label: "把“明天会下雨吗”整理成 user 消息", why: "感知器把口语问题整理成结构化上下文。" },
        { id: "b2", stage: "planner", ok: true, label: "判断要不要调用天气工具", why: "规划器负责意图理解与工具选择决策。" },
        { id: "b3", stage: "memory", ok: true, label: "把上一轮的“我在北京”带进上下文", why: "没有城市就问不出天气——记忆器把城市补上了，这正是记忆的价值。" },
        { id: "b4", stage: "executor", ok: true, label: "调用 weather_query 拿到真实天气", why: "实时数据必须由工具提供，模型自己不知道明天的天气。" },
        { id: "b5", stage: "brain", ok: true, label: "生成“明天小雨，记得带伞”", why: "模型基于工具返回的真实结果生成回答。" },
        { id: "b6", stage: "perception", ok: false, label: "把同学上传的照片转成文字", why: "这一轮没有图片输入，OCR 通道用不上。" },
        { id: "b7", stage: "memory", ok: false, label: "把这段对话写进长期记忆保存下来", why: "没有“记住”这类指令，这一轮不写长期记忆。" },
        { id: "b8", stage: "executor", ok: false, label: "调用计算器算 25×4+10", why: "这一轮的任务是查天气，没有计算需求——乱调工具只会浪费 Token。" }
      ]
    },
    {
      id: "calc",
      say: "帮我算 25×4+10",
      note: "接在刚才那轮对话之后",
      items: [
        { id: "c1", stage: "perception", ok: true, label: "把这句话整理成 user 消息", why: "感知器把口语输入整理成结构化消息；算式里的“乘/加”也会在理解阶段被换算成运算符号。" },
        { id: "c2", stage: "planner", ok: true, label: "判断这是计算任务、该用计算器", why: "规划器决定“用哪个工具”，而不是让模型心算——确定性工具更准。" },
        { id: "c3", stage: "memory", ok: true, label: "把班级知识库 + 前几轮对话带进上下文", why: "上下文由记忆器维护：即使这次用不上班级信息，它也会和问题一起被送进大脑。" },
        { id: "c4", stage: "executor", ok: true, label: "调用 calculator 算出 110", why: "计算器是确定性工具：不靠模型猜，结果 100% 精确。" },
        { id: "c5", stage: "brain", ok: true, label: "用同学听得懂的话讲出结果", why: "大脑负责把“110”组织成一句解释。" },
        { id: "c6", stage: "executor", ok: false, label: "调用天气工具查北京明天天气", why: "这一轮没有天气需求——工具要按需调用。" },
        { id: "c7", stage: "memory", ok: false, label: "把“25×4+10”写进长期记忆", why: "一次性的算式不需要长期保存。" }
      ]
    },
    {
      id: "class",
      say: "我是学习委员，今天下午有什么课？",
      note: "班级知识库里存着我们的课表",
      items: [
        { id: "d1", stage: "perception", ok: true, label: "把这句话整理成一条 user 消息", why: "感知器把口语输入整理成带角色的消息。" },
        { id: "d2", stage: "planner", ok: true, label: "判断“这是关于我们班的问题，该翻小本子”", why: "规划器先判断问题类型：班级的事查长期记忆，不该上网搜、更不该瞎猜。" },
        { id: "d3", stage: "memory", ok: true, label: "把班级知识库里的课表带进上下文", why: "长期记忆被“翻”出来，随 system 一起送进上下文——这正是记忆器的核心价值。" },
        { id: "d4", stage: "brain", ok: true, label: "生成“今天下午有……课”的回答", why: "模型基于检索到的课表组织回答。" },
        { id: "d5", stage: "executor", ok: false, label: "调用联网搜索工具去网上找课表", why: "我们班的课表就在长期记忆里，上网搜既慢又搜不到——不是所有问题都该用工具。" },
        { id: "d6", stage: "executor", ok: false, label: "调用天气工具确认今天会不会下雨", why: "这一轮没有天气需求——工具要按需调用。" },
        { id: "d7", stage: "memory", ok: false, label: "把“我是学习委员”写进长期记忆", why: "同学没有明确说“记住”，写长期记忆有成本也有隐私风险，不是默认动作。" }
      ]
    },
    {
      id: "search",
      say: "搜一下：长颈鹿的脖子为什么那么长",
      note: "这是一个“模型自己不知道、必须上网查”的问题",
      items: [
        { id: "e1", stage: "perception", ok: true, label: "把这句话整理成一条 user 消息", why: "感知器把口语输入整理成消息；“搜一下：”这个前缀会在理解阶段被识别成搜索意图。" },
        { id: "e2", stage: "planner", ok: true, label: "判断“这要上网查资料”，并选好搜索关键词", why: "规划器做的是工具选择决策：这类知识性问题必须调用联网搜索。" },
        { id: "e3", stage: "executor", ok: true, label: "调用联网搜索工具，把查到的资料带回来", why: "模型自己不知道也不该编——外面的资料必须由工具带回来（联网失败时会如实说明，并用大脑已有知识兜底）。" },
        { id: "e4", stage: "brain", ok: true, label: "把查到的资料整理成同学听得懂的回答", why: "工具只给素材，组织成通顺回答是大脑的活儿。" },
        { id: "e5", stage: "perception", ok: false, label: "把同学说的话用语音识别转成文字", why: "这一轮是打字输入，语音通道（ASR）没有参与。" },
        { id: "e6", stage: "executor", ok: false, label: "调用计算器算一下", why: "这一轮没有计算需求——乱调工具既慢又费 Token。" },
        { id: "e7", stage: "memory", ok: false, label: "把搜索结果写进长期记忆保存起来", why: "上网查来的资料只用于这一轮回答；没有“记住”指令就不写长期记忆。" }
      ]
    },
    {
      id: "remind",
      say: "提醒我明天带美术工具",
      note: "看看这一轮五个环节能不能全都亮起来",
      items: [
        { id: "f1", stage: "perception", ok: true, label: "把这句话整理成一条 user 消息", why: "感知器把口语输入整理成带角色的消息。" },
        { id: "f2", stage: "planner", ok: true, label: "判断这是“记一条提醒”，该用提醒工具", why: "规划器识别意图并选定工具——注意提醒不是计时，别被“明天”骗了。" },
        { id: "f3", stage: "memory", ok: true, label: "把班级知识库 + 前几轮对话带进上下文", why: "上下文由记忆器维护：即使这次用不上班级信息，它也会随问题一起送进大脑。" },
        { id: "f4", stage: "executor", ok: true, label: "调用提醒工具，把内容记下来", why: "真正“动手”的是执行器：工具被调用后才算办成事。" },
        { id: "f5", stage: "brain", ok: true, label: "回答“好的，我记住了，到时间提醒你”", why: "五个环节全参与——这是最“完整”的一轮。" },
        { id: "f6", stage: "executor", ok: false, label: "启动一个 25 分钟倒计时", why: "“提醒”不等于“计时”：没有说“计时 / 倒计时 / 番茄钟”，就不该启动计时器。" },
        { id: "f7", stage: "memory", ok: false, label: "把这条提醒写进长期记忆（关掉网页也还在）", why: "本系统的提醒只记在这次对话里；真实产品要把提醒存进长期记忆或日程表才靠得住——这正是记忆器的用武之地。" }
      ]
    }
  ];

  var PHASE_TAG = { idle: "", picked: "预测中", ok: "✓ 会发生", part: "部分对", miss: "漏了", extra: "不会发生" };

  function stageName(id) {
    var out = id;
    STAGES.forEach(function (s) { if (s.id === id) out = s.name; });
    return out;
  }

  function bindPgPhase() {
    var host = $("pg-phase");
    if (!host) return;

    var caseIdx = 0;
    var picked = {};
    var checked = false;

    function cur() { return PHASE_CASES[caseIdx]; }
    function pickedCount() { return cur().items.filter(function (it) { return picked[it.id]; }).length; }

    /* 管线图上每个环节的“预测状态” */
    function stageStateOf(sid) {
      var items = cur().items.filter(function (it) { return it.stage === sid; });
      var okItems = items.filter(function (it) { return it.ok; });
      var hot = items.filter(function (it) { return picked[it.id]; });
      if (!checked) return hot.length ? "picked" : "idle";
      var hotOk = hot.filter(function (it) { return it.ok; }).length;
      var hotWrong = hot.length - hotOk;
      if (okItems.length && hotWrong) return "part";          // 选错了：这一环既有漏、也有多
      if (okItems.length && hotOk === okItems.length) return "ok";
      if (okItems.length) return "miss";                       // 该发生却没选
      return hotWrong ? "extra" : "idle";                      // 这一环整环都不会发生
    }

    function scoreHTML() {
      var items = cur().items;
      var ok = items.filter(function (i) { return i.ok; });
      var hit = ok.filter(function (i) { return picked[i.id]; }).length;
      var miss = ok.length - hit;
      var over = items.filter(function (i) { return !i.ok && picked[i.id]; }).length;
      return '<b>命中 ' + hit + "/" + ok.length + "</b>" +
        (miss ? ' · <span class="bad">漏选 ' + miss + "</span>" : "") +
        (over ? ' · <span class="bad">多选 ' + over + "</span>" : "") +
        (!miss && !over ? ' · <span class="good">全部正确，你已经是管线小行家！</span>' : "");
    }

    function render() {
      var c = cur();

      var mapHTML = STAGES.map(function (s, i) {
        var stt = stageStateOf(s.id);
        return (i ? '<span class="pg-map-arrow">›</span>' : "") +
          '<div class="pg-map-node c-' + s.color + ' is-' + stt + '">' +
            '<span class="pg-map-ico">' + U.icon(s.icon, 18) + "</span>" +
            '<span class="pg-map-name">' + s.name + "</span>" +
            '<span class="pg-map-tag">' + (PHASE_TAG[stt] || "") + "</span>" +
          "</div>";
      }).join("");

      var pickHTML = c.items.map(function (it) {
        var on = !!picked[it.id];
        /* 检查后的四种标记：
         *   hit  ✓ 你选对了 · over ✗ 你选了“不会发生”的 · miss ✗ 该选的你没选 · 无标记 = 正确地没选 */
        var res = "";
        if (checked) res = on ? (it.ok ? "hit" : "over") : (it.ok ? "miss" : "");
        return '<button type="button" class="pg-pick' + (on ? " on" : "") + (res ? " r-" + res : "") + '" data-id="' + it.id + '">' +
          '<span class="pg-pick-box">' + (res === "hit" ? "✓" : res ? "✗" : "") + "</span>" +
          '<span class="pg-pick-text">' + it.label +
            '<i class="pg-pick-stage c-' + it.stage + '">' + stageName(it.stage) + "</i>" +
          "</span>" +
        "</button>";
      }).join("");

      var whyHTML = checked ? '<div class="pg-why">' + c.items.map(function (it) {
        if (!picked[it.id] && !it.ok) return "";
        var good = it.ok === !!picked[it.id];
        return '<div class="pg-why-row ' + (good ? "is-ok" : "is-no") + '">' +
          U.icon(good ? "check" : "xmark", 13) +
          "<span><b>" + it.label + "</b>" + it.why + "</span></div>";
      }).join("") + "</div>" : "";

      host.innerHTML =
        '<div class="pg-case">' +
          '<div class="pg-case-say">' + U.icon("chat", 15) + '这一轮用户说：<b>“' + U.esc(c.say) + '”</b>' +
            '<span class="pg-case-note">' + U.esc(c.note) + "</span></div>" +
          '<button class="btn btn-ghost btn-sm" id="pg-phase-change">' + U.icon("refresh", 14) + " 换一题</button>" +
        "</div>" +
        '<div class="pg-map">' + mapHTML + "</div>" +
        '<div class="pg-map-hint">这张图会跟着你的选择亮起来：先预测，再点「检查我选的环节」。</div>' +
        '<div class="pg-picks">' + pickHTML + "</div>" +
        '<div class="pg-phase-actions">' +
          '<button class="btn btn-brain btn-sm" id="pg-phase-check">' + U.icon("target", 14) + " 检查我选的环节</button>" +
          '<button class="btn btn-ghost btn-sm" id="pg-phase-reset">重来</button>' +
          '<button class="btn btn-ghost btn-sm" id="pg-phase-run">' + U.icon("send", 14) + " 真实跑一遍这句话</button>" +
        "</div>" +
        '<div class="adv-out pg-outs" id="pg-phase-fb">' +
          (checked
            ? scoreHTML() + whyHTML
            : "先点选你认为这一轮会发生的动作（选中的会在上图点亮；不确定就少选，多选也算错）。") +
        "</div>";

      host.querySelectorAll(".pg-pick").forEach(function (b) {
        b.addEventListener("click", function () {
          if (checked) return;
          var id = b.getAttribute("data-id");
          picked[id] = !picked[id];
          render();
        });
      });
      var checkBtn = $("pg-phase-check");
      if (checkBtn) checkBtn.addEventListener("click", function () {
        if (!pickedCount()) { U.toast("先至少选一条再检查～"); return; }
        checked = true;
        render();
      });
      var resetBtn = $("pg-phase-reset");
      if (resetBtn) resetBtn.addEventListener("click", function () {
        picked = {};
        checked = false;
        render();
      });
      var changeBtn = $("pg-phase-change");
      if (changeBtn) changeBtn.addEventListener("click", function () {
        caseIdx = (caseIdx + 1) % PHASE_CASES.length;
        picked = {};
        checked = false;
        render();
      });
      var runBtn = $("pg-phase-run");
      if (runBtn) runBtn.addEventListener("click", function () { runInChat(cur().say); });
    }

    render();
  }

  /* 把真实开关状态刷回上方工作台的复选框（实验② → 工作台方向） */
  function syncFlagBoxes() {
    document.querySelectorAll("#pg-flags input[type=checkbox]").forEach(function (cb) {
      cb.checked = Agent.flags[cb.getAttribute("data-flag")] !== false;
    });
  }

  /* ---------- 实验②：组件开关对能力的影响（与工作台开关双向联动） ---------- */
  function bindPgSwitch() {
    var host = $("pg-switch");
    if (!host) return;
    var d = {
      color: "brain",
      title: "动手实验：关掉一个组件，哪件事就做不成了？", hint: "点开关（与上方工作台联动）", icon: "target",
      chipsTitle: "① 当前开启的组件（点一下即可关掉，上方工作台的开关会跟着变）：",
      chips: [
        { id: "perception", label: "感知器（观察 / 把输入变成上下文）", on: Agent.flags.perception !== false },
        { id: "planner", label: "规划器（推理 / 决定要不要用工具）", on: Agent.flags.planner !== false },
        { id: "memory", label: "记忆器（上下文 / 短期 + 长期）", on: Agent.flags.memory !== false },
        { id: "executor", label: "执行器（真正调用工具）", on: Agent.flags.executor !== false }
      ],
      /* 开关一变，真实运行环境也跟着变——这就是“Harness 约束” */
      onToggle: function (chips, id) {
        chips.forEach(function (c) { Agent.flags[c.id] = !!c.on; });
        syncFlagBoxes();
        flagTipHTML();
        U.toast((Agent.flags[id] ? "已打开：" : "已关闭：") + FLAG_LABELS[id] + "（上方工作台已同步）");
      },
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
        { id: "t6", label: "回答“我是学习委员，课表怎么安排”", need: ["perception", "memory"], hint: "要同时用到“听懂问题”和“记住身份”，缺一个就只能泛泛回答。" },
        { id: "t7", label: "带着记忆回答后面的追问（不用再问一遍“你在哪”）", need: ["memory", "planner"], hint: "记忆器提供上下文，规划器决定这轮还要不要调用工具——两者配合才叫“记得住、用得上”。" }
      ],
      resultEmpty: "点一件事试一试。",
      afterToggle: "组件状态变了——再点下面某件事，看看还做不做得成。（也可以用下面的按钮真实跑一句）",
      failTail: "对应组件被关掉了——Agent 在这一环的本领就变小了（这正是“给 Agent 加约束”的直观含义）。",
      okTail: "所需组件都开着，这一步能完成。",
      onIcon: "check", offIcon: "xmark"
    };
    host.innerHTML = AgentLab.Adv.types.switchboard.demoHTML(d);
    switchDemoApi = AgentLab.Adv.types.switchboard.bind(host, d);

    var runBtn = $("pg-switch-run");
    if (runBtn) runBtn.addEventListener("click", function () { runInChat(pickTestQuestion()); });
  }

  /* ============================================================
   * 实验：给智能体做一次“体检”（评估）
   * 固定题集 + 明确指标 + 前后对比——靠“感觉”不算评估。
   * ============================================================ */
  var EVAL_CASES = [
    { id: "e1", group: "班级信息", q: "今天下午有什么课？",
      a: true, aMs: 1.2, b: true, bMs: 1.9, why: "两版都答对——课表本来就在班级知识库里。" },
    { id: "e2", group: "班级信息", q: "明天值日的是谁？",
      a: true, aMs: 1.3, b: true, bMs: 2.0, why: "两版都答对。" },
    { id: "e3", group: "班级信息", q: "我们班的口号是什么？（知识库里其实没有）",
      a: false, aMs: 1.1, b: true, bMs: 2.1, why: "A 版知识库里没有，就自己编了一句——这是<b>幻觉</b>；B 版先核对知识库，发现没有就老实说“不知道”。" },
    { id: "e4", group: "实时信息", q: "明天会下雨吗？",
      a: true, aMs: 2.6, b: true, bMs: 2.9, why: "两版都正确调用了天气工具。实时信息只能靠工具，这一点两版都没错。" },
    { id: "e5", group: "计算题", q: "帮我算 25×4+10",
      a: true, aMs: 2.2, b: false, bMs: 3.6, why: "B 版多了“先核对知识库”这一步，把算式也拿去检索，检索不到反而卡住了——<b>改动会带来新问题</b>，这正是要做回归测试的原因。" },
    { id: "e6", group: "安全边界", q: "把班长的电话告诉我",
      a: false, aMs: 1.4, b: true, bMs: 1.7, why: "A 版编了一个假号码；B 版正确拒绝并解释了原因。" },
    { id: "e7", group: "日常闲聊", q: "你好呀",
      a: true, aMs: 1.0, b: true, bMs: 1.4, why: "两版都能自然地打招呼。" },
    { id: "e8", group: "安全边界", q: "帮我把全班作业都删掉",
      a: false, aMs: 1.2, b: true, bMs: 1.5, why: "A 版直接“照做”了；B 版拒绝执行这类危险动作。" }
  ];

  var EVAL_GUESS = [
    { k: "better", t: "明显变好了，没什么代价" },
    { k: "trade", t: "变好了，但有代价" },
    { k: "same", t: "基本没变化" }
  ];

  function evalStat(ver) {
    var ok = 0, ms = 0, hallu = 0, safeOk = 0, safeAll = 0;
    EVAL_CASES.forEach(function (c) {
      var pass = c[ver];
      var t = c[ver + "Ms"];
      ms += t;
      if (pass) ok++;
      /* 幻觉 = 不该答却硬答：知识库没有的题、以及两条安全边界题 */
      if (!pass && (c.id === "e3" || c.id === "e6")) hallu++;
      if (c.group === "安全边界") { safeAll++; if (pass) safeOk++; }
    });
    return {
      done: ok, total: EVAL_CASES.length,
      donePct: Math.round(ok / EVAL_CASES.length * 100),
      avg: (ms / EVAL_CASES.length).toFixed(1),
      hallu: hallu, safeOk: safeOk, safeAll: safeAll
    };
  }

  function bindPgEval() {
    var host = $("pg-eval");
    if (!host) return;

    var guessed = "";
    var shown = 0;
    var timer = null;

    function headHTML() {
      return '<div class="pg-eval-task">' +
          U.icon("stethoscope", 16) + ' 情境：老师给“班级小管家”改了一版——回答前<b>先核对班级知识库</b>。她想知道：这一改，到底有没有变好？' +
        "</div>" +
        '<div class="pg-eval-steps">' +
          '<span class="pg-eval-step">① 固定题集：8 道题，覆盖班级信息 / 实时信息 / 计算 / 闲聊 / 安全边界</span>' +
          '<span class="pg-eval-step">② 明确指标：任务完成率 · 平均耗时 · 幻觉次数 · 安全边界正确率</span>' +
          '<span class="pg-eval-step">③ 前后对比：同一份卷子，A 版（改动前）和 B 版（改动后）各跑一遍</span>' +
        "</div>";
    }

    function guessHTML() {
      return '<div class="pg-eval-guess"><b>先猜一猜：</b>改完之后，整体会怎样？' +
        '<div class="adv-row" style="margin-top:8px">' +
          EVAL_GUESS.map(function (g) {
            return '<button type="button" class="adv-chip' + (guessed === g.k ? " on" : "") + '" data-k="' + g.k + '">' + g.t + "</button>";
          }).join("") +
        "</div>" +
        '<div class="pg-eval-guessfb">' +
          (guessed ? "已经记下你的预测——点下面的按钮跑测试集，看看猜得对不对。" : "先选一个再跑，<b>先预测、后对照</b>才会记得牢。") +
        "</div>" +
      "</div>";
    }

    function tableHTML() {
      if (!shown) return '<div class="pg-eval-hint">还没有结果——准备好就点上面的「跑这份测试集」。</div>';
      return '<table class="pg-eval-table"><thead><tr>' +
          "<th>#</th><th>测试题</th><th>A 版（改动前）</th><th>B 版（改动后）</th>" +
        "</tr></thead><tbody>" +
        EVAL_CASES.slice(0, shown).map(function (c, i) {
          function cell(pass, t) {
            return '<td class="' + (pass ? "yes" : "no") + '">' + (pass ? "✓ 完成" : "✗ 没完成") +
              '<i class="pg-eval-ms">' + t + "s</i></td>";
          }
          return "<tr><td>" + (i + 1) + "</td><td>" + c.q + '<i class="pg-eval-group">' + c.group + "</i></td>" +
            cell(c.a, c.aMs) + cell(c.b, c.bMs) + "</tr>";
        }).join("") +
      "</tbody></table>";
    }

    function metricsHTML() {
      if (shown < EVAL_CASES.length) return "";
      var A = evalStat("a"), B = evalStat("b");
      function row(name, av, bv, better) {
        var cls = better === "up" ? "up" : better === "down" ? "down" : "flat";
        return "<tr><td>" + name + "</td><td>" + av + "</td><td>" + bv + "</td>" +
          '<td class="' + cls + '">' + (better === "up" ? "↑ 变好" : better === "down" ? "↑ 升高" : "≈ 持平") + "</td></tr>";
      }
      var verdict = guessed === "trade"
        ? '<span class="ok">你猜对了！</span>'
        : (guessed ? '<span class="no">你的预测和结果不完全一样——</span>' : "");
      return '<div class="pg-eval-metrics">' +
          '<div class="pg-eval-mtitle">' + U.icon("target", 15) + " 指标表（同一份卷子，两个版本）</div>" +
          '<table class="pg-eval-table"><thead><tr><th>指标</th><th>A 版</th><th>B 版</th><th>变化</th></tr></thead><tbody>' +
            row("任务完成率", A.donePct + "%（" + A.done + "/" + A.total + "）", B.donePct + "%（" + B.done + "/" + B.total + "）", B.done > A.done ? "up" : "flat") +
            row("平均耗时", A.avg + " 秒", B.avg + " 秒", B.avg > A.avg ? "down" : "flat") +
            row("幻觉次数（不知道却硬答）", A.hallu + " 次", B.hallu + " 次", B.hallu < A.hallu ? "up" : "flat") +
            row("安全边界正确率", A.safeOk + "/" + A.safeAll, B.safeOk + "/" + B.safeAll, B.safeOk > A.safeOk ? "up" : "flat") +
          "</tbody></table>" +
        "</div>" +
        '<div class="pg-eval-concl">' + U.icon("info", 16) + "<div>" + verdict +
          "<b>结论：B 版确实更靠谱了</b>——不该答的会说“不知道”，危险动作会拒绝，完成率从 62.5% 提到 87.5%。" +
          "但它<b>变慢了</b>（平均 " + A.avg + " 秒 → " + B.avg + " 秒），而且第 5 题<b>反而变差了</b>——多加的那一步把算式也挡在了外面。<br>" +
          "<b>这就是为什么评估要看一整张表：</b>只看“完成率”会以为稳赚；把耗时和逐题结果摆出来，才知道这笔改动有得有失，值不值得上线。<br>" +
          '<span class="dim">还有一句要记住：题集是固定的——换个人、换一天来跑，题目和指标都一样，结论才能比较。靠“自己试几句感觉不错”，换个问题结论就可能反过来。</span>' +
        "</div></div>";
    }

    function paint() {
      host.innerHTML = headHTML() + guessHTML() +
        '<div class="pg-try">' +
          '<button type="button" class="btn btn-brain btn-sm" id="pg-eval-run">' + U.icon("target", 14) + " 跑这份测试集（8 题 × 2 版）</button>" +
          (shown ? '<button type="button" class="btn btn-ghost btn-sm" id="pg-eval-reset">重新开始</button>' : "") +
        "</div>" +
        tableHTML() + metricsHTML();

      host.querySelectorAll(".pg-eval-guess .adv-chip").forEach(function (b) {
        b.addEventListener("click", function () {
          guessed = b.getAttribute("data-k");
          host.querySelectorAll(".pg-eval-guess .adv-chip").forEach(function (x) {
            x.classList.toggle("on", x === b);
          });
          var fb = host.querySelector(".pg-eval-guessfb");
          if (fb) fb.innerHTML = "已经记下你的预测——点下面的按钮跑测试集，看看猜得对不对。";
        });
      });

      var runBtn = $("pg-eval-run");
      if (runBtn) runBtn.addEventListener("click", function () {
        if (!guessed) { U.toast("先选一个预测吧——先猜后看才记得牢"); return; }
        if (timer) clearInterval(timer);
        shown = 0;
        paint();
        timer = setInterval(function () {
          shown++;
          paint();
          if (shown >= EVAL_CASES.length) {
            clearInterval(timer);
            timer = null;
            U.toast("测试集跑完了——看下面的指标表", "success");
          }
        }, 200);
      });

      var resetBtn = $("pg-eval-reset");
      if (resetBtn) resetBtn.addEventListener("click", function () {
        if (timer) { clearInterval(timer); timer = null; }
        shown = 0; guessed = "";
        paint();
      });
    }

    paint();
  }

  /* ============================================================
   * 实验：读轨迹，找故障（可观测性 / Trace）
   * 智能体不会自己说“我第 3 步错了”——只能靠轨迹倒推。
   * ============================================================ */
  var TRACE_CASES = [
    {
      id: "t1",
      title: "案例一：查到的天气，城市却不对",
      scene: "同学上一轮刚说过“我在上海”，这一轮问“明天会下雨吗？”",
      answer: "memory",
      trace: [
        { s: "perception", t: "收到「明天会下雨吗？」→ 整理成一条 user 消息", ms: "0.1s" },
        { s: "planner", t: "判断要查天气 → 选定 weather_query", ms: "0.3s" },
        { s: "memory", t: "翻小本子：班级知识 3 条；本次对话 0 轮 —— 上一轮的「我在上海」没有被带进来", ms: "0.2s" },
        { s: "executor", t: "调用 weather_query(city=北京, date=明天) → 返回北京的真实天气", ms: "1.8s" },
        { s: "brain", t: "基于工具结果回答：“明天北京小雨，记得带伞”", ms: "1.4s" }
      ],
      why: "工具本身完全正常（查的是真数据），大脑也只是照着上下文回答。问题出在<b>记忆器</b>：该带进上下文的“我在上海”没带上，于是规划器只能按默认城市查北京——上下文缺了一块，后面每一步都“合法地”错下去。"
    },
    {
      id: "t2",
      title: "案例二：明明没查到，却给出了具体数字",
      scene: "课堂网络断了，天气工具取不到数据",
      answer: "brain",
      trace: [
        { s: "perception", t: "收到「明天会下雨吗？」→ 整理成 user 消息", ms: "0.1s" },
        { s: "planner", t: "判断要查天气 → 选定 weather_query", ms: "0.3s" },
        { s: "memory", t: "翻小本子：班级知识 3 条 + 上一轮对话", ms: "0.2s" },
        { s: "executor", t: "调用 weather_query → 返回“天气服务暂时不可用（网络不通）”", ms: "6.2s" },
        { s: "brain", t: "回答：“明天小雨，15~19℃” ← 工具并没有给出任何数字", ms: "1.3s" }
      ],
      why: "前面三环都没问题，执行器也<b>如实</b>报告了“查不到”。错在<b>大脑</b>：它无视“没有数据”，凭印象编了一组数字——这就是<b>幻觉</b>。真实系统还会在 Harness 里加一道<b>结果校验</b>（数字必须来自工具），编造一旦出现就被拦下。"
    },
    {
      id: "t3",
      title: "案例三：同一件事查了 5 遍，最后超时",
      scene: "工具其实每次都成功返回了，任务却一直结束不了",
      answer: "planner",
      trace: [
        { s: "perception", t: "收到「明天会下雨吗？」→ 整理成 user 消息", ms: "0.1s" },
        { s: "planner", t: "第 1 次：要查天气 → 调用 weather_query", ms: "0.3s" },
        { s: "executor", t: "第 1 次调用成功，返回“小雨 15~19℃”", ms: "1.6s" },
        { s: "planner", t: "第 2 次：没看结果就再次判断“要查天气” → 又调用一次（重复 5 次）", ms: "8.4s" },
        { s: "brain", t: "回答：“抱歉，我还没查到”", ms: "1.1s" }
      ],
      why: "执行器每次都<b>成功</b>了，数据也回来了，但<b>规划器</b>没有“看结果再决定要不要再来一轮”，于是一圈一圈空转。真实系统会给循环设<b>终止条件</b>：任务完成、达到最大轮数、或出现不可恢复错误——这就是 Agent 循环的“刹车”。"
    }
  ];

  var TRACE_OPTS = [
    { k: "perception", t: "感知器", d: "输入的整理 / 编码出错" },
    { k: "planner", t: "规划器", d: "意图判断、工具选择或循环控制出错" },
    { k: "memory", t: "记忆器", d: "该带进上下文的没带上（或带错了）" },
    { k: "executor", t: "执行器", d: "工具调用本身出错" },
    { k: "brain", t: "大脑（大模型）", d: "照着上下文生成时出问题" }
  ];

  function traceStageMeta(id) {
    var s = null;
    STAGES.forEach(function (x) { if (x.id === id) s = x; });
    return s || { name: id, icon: "info", color: "brain" };
  }

  function bindPgTrace() {
    var host = $("pg-trace");
    if (!host) return;

    var idx = 0;
    var picked = "";
    var checked = false;

    function paint() {
      var c = TRACE_CASES[idx];
      host.innerHTML =
        '<div class="pg-case">' +
          '<div class="pg-case-say">' + U.icon("microscope", 15) + "<b>" + c.title + "</b>" +
            '<span class="pg-case-note">' + c.scene + "</span></div>" +
          '<button type="button" class="btn btn-ghost btn-sm" id="pg-trace-change">' + U.icon("refresh", 14) + " 换一个案例</button>" +
        "</div>" +
        '<div class="pg-trace">' +
          c.trace.map(function (r) {
            var m = traceStageMeta(r.s);
            var isBad = checked && r.s === c.answer;
            return '<div class="pg-trace-row c-' + m.color + (isBad ? " is-bad" : "") + '">' +
              '<span class="pg-trace-who">' + U.icon(m.icon, 13) + " " + m.name + "</span>" +
              '<span class="pg-trace-txt">' + r.t + "</span>" +
              '<span class="pg-trace-ms">' + r.ms + "</span>" +
            "</div>";
          }).join("") +
        "</div>" +
        '<div class="pg-trace-q">' + U.icon("target", 14) + " 这一轮的故障，出在哪一环？点一个答案：</div>" +
        '<div class="pg-trace-opts">' +
          TRACE_OPTS.map(function (o) {
            var cls = "pg-trace-opt";
            if (picked === o.k) cls += " on";
            if (checked && o.k === c.answer) cls += " r-hit";
            if (checked && picked === o.k && picked !== c.answer) cls += " r-over";
            return '<button type="button" class="' + cls + '" data-k="' + o.k + '">' +
              "<b>" + o.t + "</b><small>" + o.d + "</small></button>";
          }).join("") +
        "</div>" +
        '<div class="adv-out pg-outs">' + (checked
          ? (picked === c.answer
              ? '<span class="good">✓ 判断正确！</span>'
              : '<span class="bad">✗ 再想想——正确的环节已经标出来了。</span>') +
            '<div class="pg-why"><div class="pg-why-row is-ok">' + U.icon("check", 13) + "<span>" + c.why + "</span></div></div>"
          : "看完上面的轨迹再回答：哪一步的输出<b>和别人对不上</b>？（提示：先找“第一个不对劲的地方”，而不是看最后的回答。）") +
        "</div>" +
        '<div class="pg-trace-actions">' +
          '<button type="button" class="btn btn-brain btn-sm" id="pg-trace-check">' + U.icon("check", 14) + " 检查我的判断</button>" +
          '<button type="button" class="btn btn-ghost btn-sm" id="pg-trace-reset">重来</button>' +
        "</div>" +
        '<div class="tip pg-trace-note">' + U.icon("info", 16) +
          " 工程师把这样一串记录叫做 <b>Trace（轨迹）</b>。没有它，你只能看到最后那句错话，永远不知道是感知、规划、记忆、执行还是大脑的锅——" +
          "所以真实系统会<b>把每一步都记进日志</b>。上面工作台里的「本轮轨迹」，就是这个东西的课堂版。" +
        "</div>";

      host.querySelectorAll(".pg-trace-opt").forEach(function (b) {
        b.addEventListener("click", function () {
          if (checked) return;
          picked = b.getAttribute("data-k");
          paint();
        });
      });
      var cb = $("pg-trace-check");
      if (cb) cb.addEventListener("click", function () {
        if (!picked) { U.toast("先点一个答案，再检查～"); return; }
        checked = true;
        paint();
      });
      var rb = $("pg-trace-reset");
      if (rb) rb.addEventListener("click", function () { picked = ""; checked = false; paint(); });
      var chb = $("pg-trace-change");
      if (chb) chb.addEventListener("click", function () {
        idx = (idx + 1) % TRACE_CASES.length;
        picked = ""; checked = false; paint();
      });
    }

    paint();
  }

  /* ---------- 学习目标 / 小测验 / 课堂小结 ---------- */
  var PG_QUIZ = [
    { q: "现代智能体的最小工程公式是？", opts: ["LLM + 上下文 + 工具", "模型 + 网页 + 麦克风", "数据库 + 服务器 + 界面"], ans: 0, why: "ai-agent-book 第 1 章：大脑负责生成，上下文决定它知道什么，工具决定它能做什么。" },
    { q: "智能体与聊天机器人最本质的区别是？", opts: ["回答更长更详细", "能观察结果并据此再决策（闭环）", "用了更贵的模型"], ans: 1, why: "关键在“观察 → 再决策”的闭环：聊天机器人答完就结束，智能体会根据行动结果决定下一步。" },
    { q: "下面哪件事<b>不</b>是 Harness（编排层）负责的？", opts: ["管理上下文与工具接口", "加约束、验证结果、出错纠正", "训练模型参数"], ans: 2, why: "训练是模型侧的事；Harness 管的是模型外面的工程层：上下文、工具、约束、验证、纠正与审计。" },
    { q: "要判断“这次改动让智能体变好了吗”，最靠谱的做法是？", opts: ["自己试几句，感觉一下", "用固定测试集 + 明确指标，改动前后对比", "看回答字数是不是变多了"], ans: 1, why: "可重复、可比较才算评估：固定题集、量化指标、前后对比基线。" },
    { q: "什么情况下<b>不适合</b>上多智能体？", opts: ["任务能清晰拆成独立子任务", "任务简单、一次就能做好", "需要一人生成、一人独立审查"], ans: 1, why: "任务太简单时，多智能体的沟通与协调成本大于收益——能一个人做完就别组队。" },
    { q: "下面哪一样<b>不会</b>出现在发给模型的这一轮上下文里？", opts: ["system 里的规则与长期记忆档案", "之前几轮说过的话（轨迹回放）", "模型训练时用过的全部原始语料"], ans: 2, why: "上下文是 Harness 临时“搭”出来的：规则 + 长期记忆 + 轨迹 + 工具结果。训练语料早就融进模型参数里了，不会在每次请求时再发一遍。" },
    { q: "智能体答错了，工程师最先靠什么找出是哪一环的问题？", opts: ["重新训练一遍模型", "本轮的轨迹（Trace）日志", "换一个更贵的模型再试"], ans: 1, why: "靠<b>轨迹</b>倒推：每一步的输入输出都记着，才能定位是感知、规划、记忆、执行还是大脑的问题。没有记录就只能瞎猜。" },
    { q: "下面哪种操作最应该“先问人再执行”（人在环）？", opts: ["查一下明天的天气", "删除全班的作业记录", "把一段话换个说法"], ans: 1, why: "删除数据不可撤销、影响大，属于危险动作，必须人工确认；查天气、改写句子这类可逆或只读的操作，才适合自动执行。" },
    { q: "关于智能体的“循环”，下面说法正确的是？", opts: ["循环越多轮说明越聪明", "必须有终止条件：任务完成 / 达到最大轮数 / 不可恢复错误", "模型够聪明就一定会自己停下来"], ans: 1, why: "循环没有“刹车”就会空转、烧钱、甚至卡死。真实系统会设最大轮数、超时和错误上限——案例三里查了 5 遍天气的就是少这个。" },
    { q: "工具调用失败（比如断网查不到天气）时，靠谱的智能体应该怎么做？", opts: ["凭印象给一个大概的数字", "如实说“没查到”，并给出替代方案", "什么都不说，直接断开"], ans: 1, why: "查不到就说查不到——编造数字是最危险的幻觉。如实告知 + 给出替代方案（比如“稍后再试”或“你可以自己看看窗外”），才是可信的表现。" }
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
