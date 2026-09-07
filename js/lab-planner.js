/* ============================================================
 * lab-planner.js —— 规划器实验室（对应 L07 / L08）
 * 1. 认识规划器：Agent 的思考中枢
 * 2. 拆解排序游戏
 * 3. ReAct 循环可视化（思考→行动→观察）
 * 4. 魔法句式：模糊 vs 清晰 提示词对比
 * 5. 现场规划：大任务 → 小步骤
 * 6. Plan-and-Execute vs ReAct 两种规划范式
 * 7. 思维链（CoT）实验：一步一步想的力量
 * 8. 工具选择决策：什么时候调用什么工具
 * 9. 提议者-审核者：计划生成与审查分离
 * 10. 规划失败与反思：计划错了怎么办
 * 11. 上下文轨迹：Agent 的记忆在增长
 * 12. 小测验
 * 13. 进阶原理卡
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

AgentLab.LabPlanner = (function () {
  var U = AgentLab.UI;
  var $ = U.$;
  var LP = AgentLab.LabPerception;

  /* ---------- 排序游戏数据 ---------- */
  var TASKS = [
    { name: "准备春游", steps: ["定好出发时间", "收拾零食和水壶", "到校门口集合", "上车出发", "到达公园开始玩"] },
    { name: "做一顿早餐", steps: ["先把粥煮上", "趁煮粥时煎蛋", "洗好水果", "端上桌开吃"] },
    { name: "整理书包去上学", steps: ["对照课表拿出课本", "放进书包按科目放好", "带上水壶和文具盒", "背上书包出门"] },
    { name: "组织一次生日会", steps: ["定下日期和地点", "发邀请告诉好朋友", "准备蛋糕和气球", "当天布置会场", "和大家一起庆祝"] },
    { name: "写一篇科学小论文", steps: ["确定研究题目", "查资料收集证据", "设计实验或观察", "记录数据和发现", "撰写论文并修改"] },
    { name: "用 AI 查天气并提醒带伞", steps: ["理解用户意图：查天气+提醒", "调用天气工具获取数据", "分析是否会下雨", "生成提醒消息", "发送提醒给用户"] },
    { name: "组织班级读书会", steps: ["选定共读书目", "制定阅读进度表", "分组分配讨论任务", "安排分享会时间", "现场主持并总结"] }
  ];

  /* ---------- 小测验 ---------- */
  var QUIZ = [
    { q: "规划器的两件法宝是什么？", opts: ["拆解和排序", "说话和走路", "写字和画画"], ans: 0, why: "先把大任务拆成小步骤（拆解），再给步骤排好先后顺序（排序）。" },
    { q: "ReAct 循环的三个环节是什么？", opts: ["吃饭、睡觉、打游戏", "思考（Reason）→ 行动（Act）→ 观察（Observe）", "输入、输出、存储"], ans: 1, why: "ReAct = Reasoning + Acting，实际循环是思考→行动→观察→再思考，直到任务完成。" },
    { q: "“先切西瓜，再端上桌，最后拿勺子”——这是在做什么？", opts: ["拆解", "排序", "记忆"], ans: 1, why: "给已经拆好的步骤排先后顺序，就是排序。顺序反了可不行！" },
    { q: "思维链（Chain-of-Thought）的核心思想是什么？", opts: ["让 AI 直接给答案", "让 AI 一步一步思考，显式输出推理过程", "让 AI 少说话"], ans: 1, why: "CoT 让模型把推理过程写出来，就像数学题写过程，能显著减少跳跃性错误。" },
    { q: "提议者-审核者模式中，为什么不能让同一个 AI 自审？", opts: ["太费时间", "同一个模型有认知盲区，难以发现自己的错误", "审核者不需要智能"], ans: 1, why: "自审不可靠——同一个上下文的模型难以发现自己的认知盲区，所以生成和审查要分离。" },
    { q: "Agent 的上下文（Context）由哪两部分组成？", opts: ["系统提示 + 用户消息", "静态前缀（系统提示+工具定义）+ 轨迹（消息历史）", "输入 + 输出"], ans: 1, why: "上下文 = 静态前缀 + 轨迹。静态前缀不变，轨迹随对话不断增长。" },
    { q: "Plan-and-Execute 和 ReAct 的主要区别是什么？", opts: ["没有区别", "Plan-and-Execute 先列完所有步骤再执行；ReAct 边想边做，根据观察调整", "Plan-and-Execute 更快"], ans: 1, why: "Plan-and-Execute 适合确定性任务，ReAct 适合需要根据反馈动态调整的不确定任务。" },
    { q: "规划执行失败后，Agent 应该怎么做？", opts: ["直接放弃", "反思失败原因→调整计划→重新执行", "假装成功了"], ans: 1, why: "反思（Reflection）是 Agent 的重要能力：分析失败原因、调整策略、重新尝试，而不是放弃或掩盖。" }
  ];

  /* ---------- ReAct 循环演示数据 ---------- */
  var REACT_DEMO = {
    task: "帮我查明天北京的天气，如果下雨就提醒我带伞",
    rounds: [
      {
        thought: "用户想知道明天北京天气，还要求下雨时提醒带伞。我需要先调用天气工具获取数据。",
        action: "调用「天气查询」工具：城市=北京，日期=明天",
        observe: "天气工具返回：北京明天小雨，气温 18-24°C，降水概率 80%。"
      },
      {
        thought: "明天北京有小雨，降水概率 80%，符合用户说的“下雨”条件。我需要生成一条提醒消息。",
        action: "调用「提醒」工具：内容=明天北京有小雨，记得带伞！时间=今天晚上 8 点",
        observe: "提醒工具返回：已设置提醒，将于今天 20:00 推送。"
      },
      {
        thought: "天气查到了，提醒也设好了。任务完成，可以给用户最终回复了。",
        action: "生成最终回复（不再调用工具）",
        observe: "（任务完成，退出 ReAct 循环）"
      }
    ]
  };

  /* ---------- 工具选择决策数据 ---------- */
  var TOOL_DECISIONS = [
    { scene: "用户问：“今天北京多少度？”", correct: "天气查询", opts: ["天气查询", "计算器", "翻译工具"], why: "查询实时天气，需要调用天气工具获取外部数据。" },
    { scene: "用户问：“345 × 678 等于多少？”", correct: "计算器", opts: ["搜索工具", "计算器", "天气查询"], why: "精确数学计算，计算器比大模型心算更可靠。" },
    { scene: "用户说：“把这句话翻译成英文：你好世界”", correct: "翻译工具", opts: ["翻译工具", "计算器", "提醒工具"], why: "语言转换任务，翻译工具专门处理。" },
    { scene: "用户问：“2024 年诺贝尔奖物理学奖得主是谁？”", correct: "联网搜索", opts: ["计算器", "联网搜索", "单位换算"], why: "模型参数记忆可能过时或不确定，需要搜索最新事实。" },
    { scene: "用户说：“25 分钟后提醒我交作业”", correct: "提醒/计时器", opts: ["天气查询", "提醒/计时器", "翻译工具"], why: "时间触发的任务，需要提醒或计时器工具。" },
    { scene: "用户问：“5 千米等于多少英里？”", correct: "单位换算", opts: ["单位换算", "计算器", "搜索工具"], why: "单位转换有固定公式，单位换算工具直接处理。" }
  ];

  /* ---------- 规划失败案例 ---------- */
  var FAIL_CASES = [
    {
      title: "案例一：天气工具返回错误",
      plan: "用户问上海天气 → 调用天气工具 → 回复结果",
      fail: "天气工具返回：“API 调用失败，服务暂不可用”",
      options: ["放弃任务，告诉用户“查不了”", "换一个天气数据源重试，或用搜索工具查天气", "随便编一个天气告诉用户"],
      correct: 1,
      why: "Agent 应该有容错能力：换工具、换数据源、降级处理，而不是放弃或编造。"
    },
    {
      title: "案例二：计划步骤遗漏",
      plan: "组织班级电影活动 → 选电影 → 通知同学 → 当天放映",
      fail: "放映时发现没有投影仪，也没有确认教室可用",
      options: ["怪同学没准备好", "反思：计划遗漏了“确认场地和设备”步骤，下次规划要加入", "以后再也不组织活动了"],
      correct: 1,
      why: "反思失败原因，把遗漏的步骤补进未来的规划中——这就是从经验中学习。"
    },
    {
      title: "案例三：工具参数传错",
      plan: "用户说“提醒我明天下午 3 点开会” → 调用提醒工具",
      fail: "提醒在凌晨 3 点响了——参数把“下午 3 点”传成了“3:00”（24小时制理解为凌晨）",
      options: ["告诉用户“是你自己没说清楚”", "反思：时间参数需要明确 AM/PM 或 24 小时制，下次规划时要确认参数语义", "把提醒工具删掉"],
      correct: 1,
      why: "工具调用的参数语义很重要。规划器不仅要选对工具，还要传对参数，并从错误中学习。"
    }
  ];

  var orderState = { taskIdx: 0, picked: [] };
  var quizState = {};
  var reactState = { round: 0, step: 0 };
  var toolDecState = { idx: 0, score: 0 };
  var failState = { idx: 0 };

  /* ---------- 渲染 ---------- */
  function render() {
    var sec = $("sec-planner");
    sec.innerHTML =
      LP.labHead("plan", "gear", "规划器实验室", "让 AI 学会思考 · 组件篇·规划（L07–L08）") +

      /* 学习目标 */
      '<div class="lesson-goal card-per">' +
        '<h3>' + U.icon("target", 18) + ' 本课学习目标</h3>' +
        '<div class="goal-list">' +
          '<div class="goal-item"><span class="goal-num">1</span>理解规划器在 Agent 中的作用：它是"思考中枢"——理解意图、拆解任务、排序步骤、选择工具</div>' +
          '<div class="goal-item"><span class="goal-num">2</span>掌握规划器的核心机制：<b>拆解</b>（大任务→小步骤）、<b>排序</b>（排好先后顺序）、<b>ReAct 循环</b>（思考→行动→观察）</div>' +
          '<div class="goal-item"><span class="goal-num">3</span>理解<b>思维链（CoT）</b>和<b>工具选择决策</b>，了解提议者-审核者双 Agent 模式</div>' +
          '<div class="goal-item"><span class="goal-num">4</span>理解<b>反思（Reflection）</b>的重要性和上下文轨迹对规划的支撑，对比 Plan-and-Execute vs ReAct 两种范式</div>' +
        '</div>' +
      '</div>' +

      /* ① 认识规划器 */
      LP.card("plan", "认识规划器：Agent 的思考中枢", "规划器（Planner）是 Agent 的“大脑”——它负责理解意图、拆解任务、排序步骤、选择工具，并在执行中不断调整。ai-agent-book 指出：LLM 收到请求后，要先解析真实意图（用户说的往往不是他真正想要的），再将复杂任务拆解成可执行步骤，执行中持续判断下一步该做什么。",
        '<div class="row" style="gap:24px;justify-content:center;margin:6px 0 10px;flex-wrap:wrap">' +
          '<div class="tf-node" style="border-color:var(--c-plan);min-width:140px">' + U.icon("target", 20) + ' 法宝一：拆解<br><small style="color:var(--c-sub);font-weight:400">大任务 → 小步骤</small></div>' +
          '<div class="tf-arrow">→</div>' +
          '<div class="tf-node" style="border-color:var(--c-plan);min-width:140px">' + U.icon("link", 20) + ' 法宝二：排序<br><small style="color:var(--c-sub);font-weight:400">排好先后顺序</small></div>' +
          '<div class="tf-arrow">→</div>' +
          '<div class="tf-node" style="border-color:var(--c-plan);min-width:140px">' + U.icon("gear", 20) + ' 法宝三：执行<br><small style="color:var(--c-sub);font-weight:400">调工具+看结果</small></div>' +
        '</div>' +
        '<div class="tip">' + U.icon("spark", 16) + ' <b>核心公式：</b>规划器不是一次性列完步骤就完事，而是在“思考→行动→观察”的循环中动态调整——这就是 <b>ReAct 循环</b>，下面会专门演示！</div>' +
        '<div class="tip" style="margin-top:8px">' + U.icon("book", 16) + ' <b>ai-agent-book 原文：</b>“LLM 是 Agent 的决策核心——理解意图、思考规划、做出判断。”规划器的能力来自预训练积累的世界知识，以及后训练固化的决策策略。</div>'
      ) +

      /* ② 拆解排序游戏 */
      LP.card("plan", "游戏：步骤排排队", "把打乱的小步骤排回正确的先后顺序：先点下面的步骤条，它会排进“顺序队”；点错了就点一下顺序队里的步骤把它放回去。共 " + TASKS.length + " 个任务，包括 AI Agent 真实任务哦！",
        '<div class="game-box" id="pl-order">' +
          '<div class="game-q"><span class="qno">任务</span><span id="pl-order-name"></span></div>' +
          '<div style="font-weight:700;margin-bottom:6px">我的顺序队（点步骤可撤回）：</div>' +
          '<div class="order-list" id="pl-order-list"><span style="color:var(--c-sub);font-size:14px">（空）先把步骤点进来排队</span></div>' +
          '<div style="font-weight:700;margin:14px 0 6px">步骤池（点击加入顺序队）：</div>' +
          '<div class="pool" id="pl-order-pool"></div>' +
          '<div class="row" style="margin-top:14px">' +
            '<button class="btn btn-plan" id="pl-order-check">' + U.icon("check", 16) + ' 检查顺序</button>' +
            '<button class="btn btn-ghost" id="pl-order-prev">上一题</button>' +
            '<button class="btn btn-ghost" id="pl-order-next">下一题</button>' +
          '</div>' +
          '<div class="quiz-feedback" id="pl-order-fb"></div>' +
        '</div>'
      ) +

      /* ③ ReAct 循环可视化 */
      LP.card("plan", "核心演示：ReAct 循环——思考→行动→观察", "ai-agent-book 第 1 章：Agent 执行任务的核心模式叫 <b>ReAct</b>（Reasoning + Acting）。模型先<b>思考</b>当前该做什么，然后调用工具<b>行动</b>，再<b>观察</b>工具返回的结果并继续思考——“想→做→看”不断重复，直到任务完成。点击下面的按钮，一步步看 Agent 是怎么工作的！",
        '<div class="game-box">' +
          '<div style="background:var(--c-plan-light);padding:12px 16px;border-radius:10px;margin-bottom:14px;font-weight:700">' + U.icon("user", 16) + ' 用户任务：' + U.esc(REACT_DEMO.task) + '</div>' +
          '<div id="pl-react-rounds"></div>' +
          '<div class="row" style="margin-top:14px;gap:10px;flex-wrap:wrap">' +
            '<button class="btn btn-plan" id="pl-react-next">' + U.icon("play", 16) + ' 下一步</button>' +
            '<button class="btn btn-ghost" id="pl-react-auto">' + U.icon("spark", 16) + ' 自动播放全部</button>' +
            '<button class="btn btn-ghost" id="pl-react-reset">' + U.icon("refresh", 16) + ' 重置</button>' +
            '<span id="pl-react-status" style="color:var(--c-sub);font-size:13px;align-self:center"></span>' +
          '</div>' +
        '</div>' +
        '<div class="tip" style="margin-top:10px">' + U.icon("spark", 16) + ' <b>关键洞察：</b>每一轮 ReAct 循环，Agent 的上下文（轨迹）都在增长——思考过程、工具调用、工具结果都被记录下来，供下一轮思考参考。这就是 Agent 的“工作记忆”！</div>'
      ) +

      /* ④ 魔法句式对比 */
      LP.card("plan", "实验：魔法句式 vs 模糊说法", "同一个任务“安排值日提醒”，用两种说法请 AI 帮忙，看看清晰的说法是不是让 AI 更会办事？这就是提示工程（Prompt Engineering）的力量——你怎么说，决定了 AI 怎么想。",
        '<div class="cmp-box">' +
          '<div class="cmp-col"><h4><span class="stage-pill pill-exe">模糊说法</span>“帮我安排值日提醒”</h4>' +
            '<div class="ans" id="pl-ans-vague"><span style="color:var(--c-sub)">还没有提问……</span></div></div>' +
          '<div class="cmp-col"><h4><span class="stage-pill pill-mem">魔法句式</span>“请你帮我做值日提醒：第一步查值日名单，第二步定提醒时间，第三步发出提醒”</h4>' +
            '<div class="ans" id="pl-ans-clear"><span style="color:var(--c-sub)">还没有提问……</span></div></div>' +
        '</div>' +
        '<div class="row" style="margin-top:12px">' +
          '<button class="btn btn-plan" id="pl-cmp">' + U.icon("spark", 16) + ' 同时问两种说法</button>' +
        '</div>' +
        '<div class="quiz-feedback" id="pl-cmp-fb"></div>'
      ) +

      /* ⑤ 现场规划 */
      LP.card("plan", "现场规划：把大任务拆成小步骤", "输入一个大任务（比如“组织一次班级运动会”“准备周末去公园”），规划器会帮你拆成一二三四步！这就是任务分解（Task Decomposition）——ai-agent-book 指出，工程上常让模型输出 JSON 格式的步骤列表，程序再按列表逐一执行。",
        '<div class="row">' +
          '<input type="text" id="pl-plan-input" placeholder="例如：组织一次班级运动会" style="flex:1">' +
          '<button class="btn btn-plan" id="pl-plan-go">' + U.icon("spark", 16) + " 开始拆解</button>" +
        '</div>' +
        '<div class="game-box" id="pl-plan-out" style="display:none"></div>'
      ) +

      /* ⑥ Plan-and-Execute vs ReAct */
      LP.card("plan", "两种规划范式：Plan-and-Execute vs ReAct", "不是所有任务都用同一种规划方式！ai-agent-book 和工程实践中有两种主流范式：<b>Plan-and-Execute</b>（先计划后执行）先一次性列完所有步骤，再逐一执行，适合确定性强的任务；<b>ReAct</b>（边想边做）每一步都根据观察结果调整下一步，适合不确定、需要反馈的任务。看看下面的对比，给每个任务选最合适的范式！",
        '<div class="cmp-box" style="margin-bottom:14px">' +
          '<div class="cmp-col">' +
            '<h4><span class="stage-pill pill-mem">Plan-and-Execute</span>先计划，后执行</h4>' +
            '<div style="font-size:14px;line-height:1.8">' +
              '<div>✓ 一次性列出全部步骤</div>' +
              '<div>✓ 步骤确定后不再改动</div>' +
              '<div>✓ 适合：做饭流程、固定报表、确定性任务</div>' +
              '<div>✗ 不适合：需要根据中间结果调整的任务</div>' +
            '</div>' +
          '</div>' +
          '<div class="cmp-col">' +
            '<h4><span class="stage-pill pill-per">ReAct</span>边想边做，动态调整</h4>' +
            '<div style="font-size:14px;line-height:1.8">' +
              '<div>✓ 思考→行动→观察→再思考</div>' +
              '<div>✓ 每一步都根据反馈调整</div>' +
              '<div>✓ 适合：搜索调研、故障排查、不确定任务</div>' +
              '<div>✗ 不适合：步骤完全固定、不需要反馈的任务</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="game-box" id="pl-paradigm">' +
          '<div class="game-q"><span class="qno" id="pl-pg-qno">1</span><span id="pl-pg-scene"></span></div>' +
          '<div class="opts" id="pl-pg-opts"></div>' +
          '<div class="quiz-feedback" id="pl-pg-fb"></div>' +
          '<div class="row" style="margin-top:10px">' +
            '<button class="btn btn-ghost btn-sm" id="pl-pg-next">下一题</button>' +
            '<span style="color:var(--c-sub);font-size:13px;align-self:center">得分：<span id="pl-pg-score">0</span> / ' + PARADIGM_Q.length + '</span>' +
          '</div>' +
        '</div>'
      ) +

      /* ⑦ 思维链实验 */
      LP.card("plan", "实验：思维链（CoT）——一步一步想的力量", "ai-agent-book 指出：让模型“一步一步思考”而不是直接给答案，能显著提升复杂任务的正确率——这就是<b>思维链（Chain-of-Thought, CoT）</b>。就像数学题要写过程，不能只写答案。同一个逻辑题，用两种方式问 AI，对比一下！",
        '<div class="cmp-box">' +
          '<div class="cmp-col"><h4><span class="stage-pill pill-exe">直接问答案</span>“一个数加 5 等于 12，这个数乘 3 是多少？”</h4>' +
            '<div class="ans" id="pl-cot-direct"><span style="color:var(--c-sub)">还没有提问……</span></div></div>' +
          '<div class="cmp-col"><h4><span class="stage-pill pill-mem">思维链提问</span>“请一步一步思考：一个数加 5 等于 12，这个数乘 3 是多少？先求这个数，再计算乘法。”</h4>' +
            '<div class="ans" id="pl-cot-cot"><span style="color:var(--c-sub)">还没有提问……</span></div></div>' +
        '</div>' +
        '<div class="row" style="margin-top:12px">' +
          '<button class="btn btn-plan" id="pl-cot-go">' + U.icon("spark", 16) + ' 同时问两种方式</button>' +
        '</div>' +
        '<div class="tip" style="margin-top:10px">' + U.icon("book", 16) + ' <b>原理：</b>CoT 让模型把推理过程显式输出，每一步都建立在上一步的结果上，减少了“跳步”导致的错误。研究表明，CoT 在数学、符号推理、决策任务上都能显著提升表现。</div>'
      ) +

      /* ⑧ 工具选择决策 */
      LP.card("plan", "互动：工具选择决策——什么时候调用什么工具？", "规划器的核心能力之一是<b>工具选择</b>：理解用户意图后，判断要不要调用工具、调用哪个、传什么参数。ai-agent-book 指出，这个决策策略是通过强化学习固化在模型参数里的。来试试你能不能选对工具！",
        '<div class="game-box" id="pl-tooldec">' +
          '<div class="game-q"><span class="qno" id="pl-td-qno">1</span><span id="pl-td-scene"></span></div>' +
          '<div class="opts" id="pl-td-opts"></div>' +
          '<div class="quiz-feedback" id="pl-td-fb"></div>' +
          '<div class="row" style="margin-top:10px">' +
            '<button class="btn btn-ghost btn-sm" id="pl-td-next">下一题</button>' +
            '<span style="color:var(--c-sub);font-size:13px;align-self:center">得分：<span id="pl-td-score">0</span> / ' + TOOL_DECISIONS.length + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="tip" style="margin-top:10px">' + U.icon("spark", 16) + ' <b>决策逻辑：</b>理解意图 → 匹配工具能力 → 构造参数 → 执行 → 看结果。模型不是“猜”用什么工具，而是根据工具描述（名称、用途、参数）和用户意图的语义匹配来决策。</div>'
      ) +

      /* ⑨ 提议者-审核者 */
      LP.card("plan", "进阶模式：提议者-审核者（Proposer-Reviewer）", "ai-agent-book 第 1 章命名的重要模式：<b>提议者-审核者</b>——产出与评判由两个不共享上下文的角色分别承担。为什么不能自审？因为<b>同一个模型有认知盲区</b>，很难发现自己的错误。下面演示：一个 AI 生成计划，另一个 AI 审核并给出改进建议！",
        '<div class="row" style="margin-bottom:12px">' +
          '<input type="text" id="pl-pr-input" placeholder="输入一个任务，例如：组织班级科技节" style="flex:1">' +
          '<button class="btn btn-plan" id="pl-pr-go">' + U.icon("spark", 16) + ' 生成计划并审核</button>' +
        '</div>' +
        '<div class="cmp-box">' +
          '<div class="cmp-col">' +
            '<h4><span class="stage-pill pill-per">提议者（Proposer）</span>生成计划</h4>' +
            '<div class="ans" id="pl-pr-propose" style="min-height:160px"><span style="color:var(--c-sub)">等待生成……</span></div>' +
          '</div>' +
          '<div class="cmp-col">' +
            '<h4><span class="stage-pill pill-exe">审核者（Reviewer）</span>审查与建议</h4>' +
            '<div class="ans" id="pl-pr-review" style="min-height:160px"><span style="color:var(--c-sub)">等待审核……</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="tip" style="margin-top:10px">' + U.icon("book", 16) + ' <b>ai-agent-book 原文：</b>“它成立的前提是自审不可靠：同一个上下文中的模型难以发现自己的认知盲区。”审核者只看产物本身（渲染结果、测试输出），不看提议者的推理过程，从而提供独立视角。</div>'
      ) +

      /* ⑩ 规划失败与反思 */
      LP.card("plan", "规划失败与反思（Reflection）：计划错了怎么办？", "ai-agent-book 指出：自主 Agent 需要能识别失败、调整策略，而不是出错就停下来。<b>反思（Reflection）</b>是 Agent 的重要能力——分析失败原因、调整计划、重新执行。看看下面这些真实失败案例，你会怎么选择？",
        '<div class="game-box" id="pl-fail">' +
          '<div class="game-q"><span class="qno" id="pl-fl-qno">1</span><span id="pl-fl-title"></span></div>' +
          '<div style="background:var(--c-plan-light);padding:10px 14px;border-radius:8px;margin:8px 0;font-size:14px">' +
            '<b>原计划：</b><span id="pl-fl-plan"></span><br>' +
            '<b>失败情况：</b><span id="pl-fl-fail" style="color:var(--c-exe-deep)"></span>' +
          '</div>' +
          '<div style="font-weight:700;margin-bottom:6px">你觉得 Agent 应该怎么做？</div>' +
          '<div class="opts" id="pl-fl-opts"></div>' +
          '<div class="quiz-feedback" id="pl-fl-fb"></div>' +
          '<div class="row" style="margin-top:10px">' +
            '<button class="btn btn-ghost btn-sm" id="pl-fl-next">下一个案例</button>' +
          '</div>' +
        '</div>'
      ) +

      /* ⑪ 上下文轨迹 */
      LP.card("plan", "上下文轨迹（Trajectory）：Agent 的工作记忆在增长", "ai-agent-book 第 1 章核心公式：<b>Agent 的上下文 = 静态前缀 + 轨迹</b>。静态前缀是系统提示词和工具定义（不变），轨迹是随交互不断增长的消息历史（用户消息、模型回复、工具结果）。下面模拟一个多轮对话，看看轨迹是怎么增长的！",
        '<div class="game-box">' +
          '<div class="row" style="margin-bottom:12px;gap:8px;flex-wrap:wrap">' +
            '<button class="btn btn-plan btn-sm" id="pl-tr-add">+ 添加一轮对话</button>' +
            '<button class="btn btn-ghost btn-sm" id="pl-tr-reset">重置</button>' +
            '<span style="color:var(--c-sub);font-size:13px;align-self:center">当前轨迹：<b id="pl-tr-count">0</b> 轮 · 约 <b id="pl-tr-tokens">0</b> token</span>' +
          '</div>' +
          '<div style="display:flex;gap:12px;flex-wrap:wrap">' +
            '<div style="flex:1;min-width:280px">' +
              '<div style="font-weight:700;margin-bottom:6px">静态前缀（不变，约 800 token）</div>' +
              '<div style="background:#f5f5f5;border-radius:8px;padding:10px;font-size:13px;color:var(--c-sub);line-height:1.6">' +
                '[系统提示词] 你是一个智能体小管家…<br>' +
                '[工具定义] 天气查询、计算器、翻译、搜索…<br>' +
                '<span style="color:#999">（这部分每轮都一样，占用固定 token）</span>' +
              '</div>' +
            '</div>' +
            '<div style="flex:2;min-width:280px">' +
              '<div style="font-weight:700;margin-bottom:6px">轨迹（每轮增长）</div>' +
              '<div id="pl-tr-list" style="max-height:300px;overflow-y:auto;border:1px solid #eee;border-radius:8px;padding:8px">' +
                '<span style="color:var(--c-sub);font-size:13px">（还没有对话，点击“添加一轮对话”开始）</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div id="pl-tr-warning" style="display:none;margin-top:10px;padding:10px 14px;background:#fff3cd;border-radius:8px;color:#856404;font-size:14px">' +
            U.icon("warn", 16) + ' <b>上下文窗口警告！</b>轨迹已接近模型的上下文窗口上限（如 128K token）。继续增长会导致：①早期对话被截断丢失；②推理成本上升；③响应变慢。<b>工程解决方案：</b>轨迹摘要（Summarization）、滑动窗口（Sliding Window）、向量检索（RAG）——只把相关历史放进上下文。' +
          '</div>' +
        '</div>' +
        '<div class="tip" style="margin-top:10px">' + U.icon("book", 16) + ' <b>ai-agent-book 消融实验发现：</b>工具执行结果（Tool Results）是闭环控制的关键，缺失它会让 Agent“盲目”执行；历史消息防止冗余操作；思考过程在可从结果重建时可丢弃。各组件并不同等重要！</div>'
      ) +

      /* 课堂小结 */
      '<div class="lesson-summary card-per">' +
        '<h3>' + U.icon("check", 18) + ' 课堂小结</h3>' +
        '<div class="summary-core"><b>核心结论：</b>规划器 = 理解意图 + 拆解任务 + 排序步骤 + 选择工具，在 <b>ReAct 循环</b>（思考→行动→观察）中动态调整。高级规划还需要思维链（想清楚）、工具选择（选对工具）、双 Agent 审查（防自欺）、反思纠错（从失败中学习）。</div>' +
        '<div class="summary-points">' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("target", 14) + '</span><div><b>规划器三法宝与 ReAct：</b>拆解（大任务→小步骤）、排序（排好先后顺序）、执行（调工具+看结果）；ReAct 循环=思考→行动→观察，每轮把工具结果追加到轨迹</div></div>' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("gear", 14) + '</span><div><b>两种规划范式：</b>Plan-and-Execute（先计划后执行，适合确定性任务）vs ReAct（边想边做、根据观察动态调整，适合不确定任务）；实际系统常混合使用</div></div>' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("brain", 14) + '</span><div><b>思维链与工具选择：</b>CoT 让模型显式输出推理过程，减少跳步错误；工具选择决策=理解意图→匹配工具能力→构造参数→执行→看结果</div></div>' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("refresh", 14) + '</span><div><b>双 Agent 与反思：</b>提议者-审核者（生成与审查分离，自审不可靠）；反思=失败后分析原因→调整策略→重新执行；上下文轨迹（=消息历史）为反思提供依据</div></div>' +
        '</div>' +
        '<div class="summary-think"><b>课后思考：</b>请设计一个"帮我规划周末一天"的 Agent，它需要哪些工具？如果它的计划执行失败了（比如餐厅关门了），它应该怎么反思和调整？</div>' +
      '</div>' +

      /* ⑫ 小测验 */
      LP.card("plan", "小测验：你是规划小达人吗？", "共 " + QUIZ.length + " 题，答对一题加一颗星！",
        '<div class="game-box" id="pl-quiz"><div id="pl-quiz-body"></div></div>' +
        '<div class="score-line"><span class="score-badge" id="pl-quiz-score" data-score="0">★ 0</span><button class="btn btn-ghost btn-sm" id="pl-quiz-restart">重来</button></div>'
      ) +

      /* ⑬ 进阶原理卡 */
      LP.deepCard("plan", "进阶原理：规划器的工程全景（ai-agent-book）", [
        { term: "ReAct 循环", desc: "Reasoning + Acting，Agent 的核心执行模式：思考→行动→观察→再思考，直到任务完成。每一轮循环都把工具结果追加到轨迹中，供下一轮推理使用。" },
        { term: "任务分解（Task Decomposition）", desc: "把大目标拆成可执行的小步骤。工程上常让模型输出 JSON 格式的步骤列表（含步骤名、依赖关系、工具调用），程序再按 DAG 拓扑顺序执行。" },
        { term: "思维链（Chain-of-Thought）", desc: "让模型显式输出推理过程而非直接给答案，在数学、符号推理、决策任务上显著提升正确率。进阶变体包括 Self-Consistency（多次采样投票）、Tree-of-Thoughts（树状探索）。" },
        { term: "Plan-and-Execute vs ReAct", desc: "两种规划范式。Plan-and-Execute 先一次性列完步骤再执行，适合确定性任务；ReAct 边想边做、根据观察动态调整，适合不确定任务。实际系统常混合使用。" },
        { term: "提议者-审核者（Proposer-Reviewer）", desc: "生成与审查分离的双 Agent 模式。提议者生成计划/产物，审核者独立审查（不共享上下文，只看产物）。核心前提是自审不可靠——同一模型有认知盲区。" },
        { term: "反思（Reflection）", desc: "Agent 从执行结果中学习调整的能力：分析失败原因、识别策略问题、修改计划后重试。是 Agent 从“会完成任务”到“能可靠工作”的关键。" },
        { term: "上下文 = 静态前缀 + 轨迹", desc: "ai-agent-book 核心公式。静态前缀=系统提示词+工具定义（固定），轨迹=消息历史（动态增长）。轨迹增长导致上下文窗口压力，工程上用摘要、滑动窗口、RAG 来管理。" },
        { term: "工具调用决策", desc: "何时调用工具、调用哪个、传什么参数——这个决策策略通过强化学习固化在模型参数里。Kimi K3 等模型能连续执行 200-300 次工具调用而保持思考一致性。" },
        { term: "Harness 工程：约束、验证、纠正", desc: "生产级 Agent 给规划加护栏：约束不许做的事（如禁止删除文件）、验证每一步结果（如语法检查）、做错了纠正重来。模型能力边界=Harness 价值所在。" },
        { term: "停止条件（Stopping Criteria）", desc: "自主 Agent 必须有明确的退出条件：任务完成（调用最终输出工具）、达到最大迭代次数、遭遇不可恢复错误。否则容易陷入死循环或过度执行。" }
      ]);

    bindOrder();
    bindReAct();
    bindCompare();
    bindPlan();
    bindParadigm();
    bindCoT();
    bindToolDec();
    bindProposerReviewer();
    bindFail();
    bindTrajectory();
    bindQuiz();
  }

  /* ---------- 规划范式题目 ---------- */
  var PARADIGM_Q = [
    { scene: "按照固定食谱做一道西红柿炒鸡蛋", correct: "Plan-and-Execute", why: "步骤固定、不需要根据中间结果调整，先列完步骤再执行更高效。" },
    { scene: "在网上调研“AI 对教育的影响”并写一份报告", correct: "ReAct", why: "搜索结果不确定，需要根据搜到的内容动态调整下一步搜索方向，ReAct 更合适。" },
    { scene: "排查网站为什么打不开（可能是 DNS、服务器、代码多种原因）", correct: "ReAct", why: "故障排查需要逐步测试、根据结果缩小范围，是典型的 ReAct 场景。" },
    { scene: "每月固定格式的销售报表生成", correct: "Plan-and-Execute", why: "数据源、格式、步骤都固定，Plan-and-Execute 一次规划重复执行即可。" },
    { scene: "帮用户预订餐厅（需要查空位、看评价、确认用户偏好）", correct: "ReAct", why: "需要多轮交互和反馈，根据查到的空位和用户反馈动态调整选择。" }
  ];

  /* ---------- ② 排序游戏 ---------- */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function drawOrder() {
    var task = TASKS[orderState.taskIdx];
    $("pl-order-name").textContent = task.name + "（共 " + task.steps.length + " 步）";
    orderState.picked = [];
    var pool = $("pl-order-pool");
    pool.innerHTML = shuffle(task.steps).map(function (s) {
      return '<button class="pool-chip" data-step="' + U.esc(s) + '">' + U.esc(s) + "</button>";
    }).join("");
    refreshOrderList();
    $("pl-order-fb").innerHTML = "";
    $("pl-order-check").disabled = false;
  }

  function refreshOrderList() {
    var list = $("pl-order-list");
    if (orderState.picked.length === 0) {
      list.innerHTML = '<span style="color:var(--c-sub);font-size:14px">（空）先把步骤点进来排队</span>';
    } else {
      list.innerHTML = orderState.picked.map(function (s, i) {
        return '<div class="order-item" data-step="' + U.esc(s) + '"><span class="num">' + (i + 1) + '</span>' + U.esc(s) + "</div>";
      }).join("");
      list.querySelectorAll(".order-item").forEach(function (item) {
        item.addEventListener("click", function () {
          if (item.classList.contains("done")) return;
          var s = item.getAttribute("data-step");
          orderState.picked = orderState.picked.filter(function (x) { return x !== s; });
          var chip = $("pl-order-pool").querySelector('[data-step="' + CSS.escape(s) + '"]');
          if (chip) { chip.classList.remove("picked"); chip.disabled = false; }
          refreshOrderList();
        });
      });
    }
    $("pl-order-pool").querySelectorAll(".pool-chip").forEach(function (chip) {
      var inPicked = orderState.picked.indexOf(chip.getAttribute("data-step")) >= 0;
      chip.classList.toggle("picked", inPicked);
      chip.disabled = inPicked;
    });
  }

  function bindOrder() {
    drawOrder();
    $("pl-order-pool").addEventListener("click", function (e) {
      var chip = e.target.closest(".pool-chip");
      if (!chip || chip.disabled) return;
      var s = chip.getAttribute("data-step");
      orderState.picked.push(s);
      refreshOrderList();
    });
    $("pl-order-check").addEventListener("click", function () {
      var task = TASKS[orderState.taskIdx];
      var fb = $("pl-order-fb");
      if (orderState.picked.length !== task.steps.length) {
        fb.innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " 还差 " + (task.steps.length - orderState.picked.length) + " 步没排进来，再找找！</span>";
        return;
      }
      var ok = true;
      var wrongIdx = -1;
      for (var i = 0; i < task.steps.length; i++) {
        if (orderState.picked[i] !== task.steps[i]) { ok = false; wrongIdx = i; break; }
      }
      var items = $("pl-order-list").querySelectorAll(".order-item");
      if (ok) {
        items.forEach(function (it) { it.classList.add("done"); });
        fb.innerHTML = '<span class="fb-ok">' + U.icon("check", 15) + " 完全正确！" + task.name + "就按这个顺序来！</span>";
        $("pl-order-check").disabled = true;
        U.toast("排对了！+" + task.steps.length + " 颗星", "success");
        for (var k = 0; k < task.steps.length; k++) {
          (function (idx) { setTimeout(function () { U.celebrate(items[idx]); }, idx * 200); })(k);
        }
      } else {
        items[wrongIdx].classList.add("wrong");
        setTimeout(function () { items[wrongIdx].classList.remove("wrong"); }, 600);
        fb.innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " 第 " + (wrongIdx + 1) + " 步不太对，想一想：这一步应该放在哪？</span>";
      }
    });
    $("pl-order-prev").addEventListener("click", function () {
      orderState.taskIdx = (orderState.taskIdx - 1 + TASKS.length) % TASKS.length;
      drawOrder();
    });
    $("pl-order-next").addEventListener("click", function () {
      orderState.taskIdx = (orderState.taskIdx + 1) % TASKS.length;
      drawOrder();
    });
  }

  /* ---------- ③ ReAct 循环可视化 ---------- */
  function reactRoundHTML(roundIdx, step) {
    var r = REACT_DEMO.rounds[roundIdx];
    var steps = [
      { label: "思考（Thought）", icon: "brain", content: r.thought, color: "var(--c-plan)" },
      { label: "行动（Action）", icon: "gear", content: r.action, color: "var(--c-per)" },
      { label: "观察（Observation）", icon: "eye", content: r.observe, color: "var(--c-mem)" }
    ];
    var html = '<div style="margin-bottom:14px;padding:12px;border:2px solid var(--c-plan-light);border-radius:12px;background:#fafafa">' +
      '<div style="font-weight:700;color:var(--c-plan);margin-bottom:8px">第 ' + (roundIdx + 1) + ' 轮 ReAct 循环</div>';
    for (var i = 0; i <= Math.min(step, 2); i++) {
      var s = steps[i];
      var visible = (i < step) || (i === step && step <= 2);
      if (!visible) continue;
      html += '<div style="display:flex;gap:10px;margin-bottom:8px;align-items:flex-start;opacity:' + (i === step ? '1' : '0.85') + '">' +
        '<span style="background:' + s.color + ';color:#fff;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;white-space:nowrap;flex-shrink:0">' + U.icon(s.icon, 12) + ' ' + s.label + '</span>' +
        '<span style="font-size:14px;line-height:1.7;flex:1">' + U.esc(s.content) + '</span>' +
        '</div>';
      if (i < Math.min(step, 2)) {
        html += '<div style="text-align:center;color:#ccc;font-size:18px;line-height:0.5">↓</div>';
      }
    }
    html += '</div>';
    return html;
  }

  function updateReActDisplay() {
    var container = $("pl-react-rounds");
    var html = "";
    for (var i = 0; i < reactState.round; i++) {
      html += reactRoundHTML(i, 3); // 已完成的轮显示全部3步
    }
    if (reactState.round < REACT_DEMO.rounds.length) {
      html += reactRoundHTML(reactState.round, reactState.step);
    }
    container.innerHTML = html;
    var status = $("pl-react-status");
    if (reactState.round >= REACT_DEMO.rounds.length) {
      status.textContent = "✅ 全部 " + REACT_DEMO.rounds.length + " 轮循环完成，任务结束！";
    } else {
      var stepNames = ["思考中…", "行动中…", "观察中…"];
      status.textContent = "第 " + (reactState.round + 1) + "/" + REACT_DEMO.rounds.length + " 轮 · " + stepNames[reactState.step] + "（点击下一步继续）";
    }
  }

  function bindReAct() {
    reactState = { round: 0, step: 0 };
    updateReActDisplay();

    function nextStep() {
      if (reactState.round >= REACT_DEMO.rounds.length) return;
      reactState.step++;
      if (reactState.step > 2) {
        reactState.step = 0;
        reactState.round++;
      }
      updateReActDisplay();
    }

    $("pl-react-next").addEventListener("click", nextStep);

    $("pl-react-auto").addEventListener("click", function () {
      var btn = $("pl-react-auto");
      btn.disabled = true;
      var total = REACT_DEMO.rounds.length * 3;
      var count = 0;
      var timer = setInterval(function () {
        nextStep();
        count++;
        if (count >= total || reactState.round >= REACT_DEMO.rounds.length) {
          clearInterval(timer);
          btn.disabled = false;
        }
      }, 800);
    });

    $("pl-react-reset").addEventListener("click", function () {
      reactState = { round: 0, step: 0 };
      updateReActDisplay();
    });
  }

  /* ---------- ④ 魔法句式对比 ---------- */
  function bindCompare() {
    $("pl-cmp").addEventListener("click", async function () {
      var btn = $("pl-cmp");
      btn.disabled = true;
      var vague = $("pl-ans-vague");
      var clear = $("pl-ans-clear");
      vague.innerHTML = '<span style="color:var(--c-sub)">提问中……</span>';
      clear.innerHTML = '<span style="color:var(--c-sub)">提问中……</span>';
      $("pl-cmp-fb").innerHTML = "";

      var results = await Promise.allSettled([
        AgentLab.API.ask("你是班级小管家。", "帮我安排值日提醒"),
        AgentLab.API.ask("你是班级小管家。", "请你帮我做值日提醒：第一步查值日名单，第二步定提醒时间，第三步发出提醒。")
      ]);
      function fill(el, r) {
        el.innerHTML = r.status === "fulfilled"
          ? U.esc(r.value)
          : '<span style="color:var(--c-exe-deep)">出错了：' + U.esc(r.reason && r.reason.message || "网络问题") + "</span>";
      }
      fill(vague, results[0]);
      fill(clear, results[1]);
      $("pl-cmp-fb").innerHTML = '<span class="fb-ok">' + U.icon("happy", 16) + " 发现了吗？用“目标—步骤—顺序”句式，AI 就能说出完整、有序的安排——这就是提示工程的力量！</span>";
      btn.disabled = false;
    });
  }

  /* ---------- ⑤ 现场规划 ---------- */
  function bindPlan() {
    $("pl-plan-go").addEventListener("click", async function () {
      var input = $("pl-plan-input");
      var t = input.value.trim();
      if (!t) { U.toast("先输入一个大任务吧！"); return; }
      var out = $("pl-plan-out");
      var btn = $("pl-plan-go");
      btn.disabled = true;
      out.style.display = "block";
      out.innerHTML = '<div style="color:var(--c-sub)">规划器正在思考……</div>';
      try {
        var sys = "你是一个聪明的规划器。请把用户说的大任务拆解成 3~6 个清楚的小步骤，并排好先后顺序。只输出步骤本身，每行一个步骤，用“第一步”“第二步”开头，不要输出其他解释。";
        var answer = await AgentLab.API.ask(sys, t);
        var steps = answer.split("\n").map(function (s) { return s.replace(/^\s*\d+[.、)]\s*/, "").replace(/^(第一步|第二步|第三步|第四步|第五步|第六步|第\d+步)[:：、]?\s*/, "").trim(); }).filter(function (s) { return s; });
        if (steps.length === 0) steps = [answer.trim()];
        out.innerHTML = '<div style="font-weight:700;margin-bottom:10px">规划器把「' + U.esc(t) + "」拆成了 " + steps.length + " 步：</div>";
        steps.forEach(function (s, i) {
          var d = document.createElement("div");
          d.className = "order-item done";
          d.style.marginBottom = "8px";
          d.style.opacity = "0";
          d.style.transform = "translateX(-10px)";
          d.innerHTML = '<span class="num">' + (i + 1) + "</span>" + U.esc(s);
          out.appendChild(d);
          setTimeout(function () {
            d.style.transition = "all .4s";
            d.style.opacity = "1";
            d.style.transform = "none";
          }, 200 + i * 450);
        });
        out.insertAdjacentHTML("beforeend", '<div style="color:var(--c-sub);font-size:13px;margin-top:10px">这是 Plan-and-Execute 模式：先一次性列完步骤。实际执行中如果某步失败，Agent 会切换到 ReAct 模式动态调整！</div>');
      } catch (e) {
        out.innerHTML = '<span style="color:var(--c-exe-deep)">出错了：' + U.esc(e.message || e) + "</span>";
      }
      btn.disabled = false;
    });
  }

  /* ---------- ⑥ 规划范式选择 ---------- */
  function drawParadigm() {
    var q = PARADIGM_Q[plParadigmIdx];
    $("pl-pg-qno").textContent = (plParadigmIdx + 1) + "/" + PARADIGM_Q.length;
    $("pl-pg-scene").textContent = q.scene;
    $("pl-pg-opts").innerHTML = ["Plan-and-Execute", "ReAct", "两种都可以"].map(function (o, j) {
      return '<button class="opt" data-j="' + j + '">' + o + "</button>";
    }).join("");
    $("pl-pg-fb").innerHTML = "";
    $("pl-pg-opts").querySelectorAll(".opt").forEach(function (b) {
      b.addEventListener("click", function () {
        var j = parseInt(b.getAttribute("data-j"), 10);
        var correctIdx = (q.correct === "Plan-and-Execute") ? 0 : (q.correct === "ReAct") ? 1 : 2;
        var btns = $("pl-pg-opts").querySelectorAll(".opt");
        btns.forEach(function (x) { x.disabled = true; });
        if (j === correctIdx) {
          b.classList.add("correct");
          plParadigmScore++;
          $("pl-pg-score").textContent = plParadigmScore;
          $("pl-pg-fb").innerHTML = '<span class="fb-ok">' + U.icon("check", 15) + " 正确！" + q.why + "</span>";
          U.celebrate(b);
        } else {
          b.classList.add("wrong");
          btns[correctIdx].classList.add("correct");
          $("pl-pg-fb").innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " 正确答案是「" + q.correct + "」。" + q.why + "</span>";
        }
      });
    });
  }
  var plParadigmIdx = 0;
  var plParadigmScore = 0;
  function bindParadigm() {
    drawParadigm();
    $("pl-pg-next").addEventListener("click", function () {
      plParadigmIdx = (plParadigmIdx + 1) % PARADIGM_Q.length;
      drawParadigm();
    });
  }

  /* ---------- ⑦ 思维链实验 ---------- */
  function bindCoT() {
    $("pl-cot-go").addEventListener("click", async function () {
      var btn = $("pl-cot-go");
      btn.disabled = true;
      var direct = $("pl-cot-direct");
      var cot = $("pl-cot-cot");
      direct.innerHTML = '<span style="color:var(--c-sub)">提问中……</span>';
      cot.innerHTML = '<span style="color:var(--c-sub)">提问中……</span>';
      var question = "一个数加 5 等于 12，这个数乘 3 是多少？";
      var results = await Promise.allSettled([
        AgentLab.API.ask("你是一个数学助手，直接给出答案。", question),
        AgentLab.API.ask("你是一个数学助手，请一步一步思考，先求这个数，再计算乘法，最后给出答案。", question)
      ]);
      function fill(el, r) {
        el.innerHTML = r.status === "fulfilled" ? U.esc(r.value) : '<span style="color:var(--c-exe-deep)">出错了</span>';
      }
      fill(direct, results[0]);
      fill(cot, results[1]);
      btn.disabled = false;
    });
  }

  /* ---------- ⑧ 工具选择决策 ---------- */
  function drawToolDec() {
    var q = TOOL_DECISIONS[toolDecState.idx];
    $("pl-td-qno").textContent = (toolDecState.idx + 1) + "/" + TOOL_DECISIONS.length;
    $("pl-td-scene").textContent = q.scene;
    $("pl-td-opts").innerHTML = shuffle(q.opts).map(function (o) {
      return '<button class="opt" data-opt="' + U.esc(o) + '">' + o + "</button>";
    }).join("");
    $("pl-td-fb").innerHTML = "";
    $("pl-td-opts").querySelectorAll(".opt").forEach(function (b) {
      b.addEventListener("click", function () {
        var chosen = b.getAttribute("data-opt");
        var btns = $("pl-td-opts").querySelectorAll(".opt");
        btns.forEach(function (x) { x.disabled = true; });
        if (chosen === q.correct) {
          b.classList.add("correct");
          toolDecState.score++;
          $("pl-td-score").textContent = toolDecState.score;
          $("pl-td-fb").innerHTML = '<span class="fb-ok">' + U.icon("check", 15) + " 正确！" + q.why + "</span>";
          U.celebrate(b);
        } else {
          b.classList.add("wrong");
          btns.forEach(function (x) { if (x.getAttribute("data-opt") === q.correct) x.classList.add("correct"); });
          $("pl-td-fb").innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " 正确答案是「" + q.correct + "」。" + q.why + "</span>";
        }
      });
    });
  }
  function bindToolDec() {
    toolDecState = { idx: 0, score: 0 };
    drawToolDec();
    $("pl-td-next").addEventListener("click", function () {
      toolDecState.idx = (toolDecState.idx + 1) % TOOL_DECISIONS.length;
      drawToolDec();
    });
  }

  /* ---------- ⑨ 提议者-审核者 ---------- */
  function bindProposerReviewer() {
    $("pl-pr-go").addEventListener("click", async function () {
      var input = $("pl-pr-input");
      var t = input.value.trim();
      if (!t) { U.toast("先输入一个任务！"); return; }
      var btn = $("pl-pr-go");
      var proposeEl = $("pl-pr-propose");
      var reviewEl = $("pl-pr-review");
      btn.disabled = true;
      proposeEl.innerHTML = '<span style="color:var(--c-sub)">提议者正在生成计划……</span>';
      reviewEl.innerHTML = '<span style="color:var(--c-sub)">等待提议者完成……</span>';

      try {
        // 提议者生成计划
        var proposeSys = "你是一个计划提议者（Proposer）。请为用户的任务制定一个详细的执行计划，包含 4-6 个步骤，每个步骤说明做什么、用什么工具、预期结果。格式清晰。";
        var plan = await AgentLab.API.ask(proposeSys, t);
        proposeEl.innerHTML = U.esc(plan);

        // 审核者审查计划（不看提议者的推理，只看计划本身）
        reviewEl.innerHTML = '<span style="color:var(--c-sub)">审核者正在审查计划……</span>';
        var reviewSys = "你是一个独立的计划审核者（Reviewer）。请审查下面的执行计划，从以下角度给出反馈：①步骤是否完整有无遗漏？②步骤顺序是否合理？③有没有风险或隐患？④有没有可以优化的地方？请给出具体的改进建议。注意：你没有看到计划生成者的推理过程，只基于计划本身做判断。";
        var review = await AgentLab.API.ask(reviewSys, "任务：" + t + "\n\n待审核的计划：\n" + plan);
        reviewEl.innerHTML = U.esc(review);
      } catch (e) {
        proposeEl.innerHTML = '<span style="color:var(--c-exe-deep)">出错了：' + U.esc(e.message || e) + "</span>";
        reviewEl.innerHTML = '<span style="color:var(--c-sub)">审核未执行</span>';
      }
      btn.disabled = false;
    });
  }

  /* ---------- ⑩ 规划失败与反思 ---------- */
  function drawFail() {
    var c = FAIL_CASES[failState.idx];
    $("pl-fl-qno").textContent = (failState.idx + 1) + "/" + FAIL_CASES.length;
    $("pl-fl-title").textContent = c.title;
    $("pl-fl-plan").textContent = c.plan;
    $("pl-fl-fail").textContent = c.fail;
    $("pl-fl-opts").innerHTML = c.options.map(function (o, j) {
      return '<button class="opt" data-j="' + j + '">' + o + "</button>";
    }).join("");
    $("pl-fl-fb").innerHTML = "";
    $("pl-fl-opts").querySelectorAll(".opt").forEach(function (b) {
      b.addEventListener("click", function () {
        var j = parseInt(b.getAttribute("data-j"), 10);
        var btns = $("pl-fl-opts").querySelectorAll(".opt");
        btns.forEach(function (x) { x.disabled = true; });
        if (j === c.correct) {
          b.classList.add("correct");
          $("pl-fl-fb").innerHTML = '<span class="fb-ok">' + U.icon("check", 15) + " 正确！" + c.why + "</span>";
          U.celebrate(b);
        } else {
          b.classList.add("wrong");
          btns[c.correct].classList.add("correct");
          $("pl-fl-fb").innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " 正确做法：" + c.options[c.correct] + "。" + c.why + "</span>";
        }
      });
    });
  }
  function bindFail() {
    failState = { idx: 0 };
    drawFail();
    $("pl-fl-next").addEventListener("click", function () {
      failState.idx = (failState.idx + 1) % FAIL_CASES.length;
      drawFail();
    });
  }

  /* ---------- ⑪ 上下文轨迹 ---------- */
  var TRAJECTORY_ROUNDS = [
    { user: "明天北京天气怎么样？", assistant: "我需要调用天气工具查询北京明天的天气。", tool: "天气工具返回：北京明天晴，15-25°C。", final: "北京明天晴天，气温 15-25°C，适合外出！" },
    { user: "那上海呢？", assistant: "用户继续问上海天气，我需要再次调用天气工具。", tool: "天气工具返回：上海明天小雨，18-22°C。", final: "上海明天有小雨，气温 18-22°C，记得带伞！" },
    { user: "帮我比较一下这两个城市", assistant: "用户要求比较，我需要回顾之前两轮的天气数据。", tool: "（无需调用工具，从轨迹中读取已有数据）", final: "北京明天晴 15-25°C，上海明天小雨 18-22°C。北京更温暖干燥，上海更凉爽湿润，去上海记得带伞！" },
    { user: "如果我下周去上海，需要带什么？", assistant: "用户问下周的穿搭建议，需要查下周天气并结合上海气候特点。", tool: "天气工具返回：上海下周以多云为主，16-24°C，偶尔有小雨。", final: "下周上海 16-24°C，多云偶有小雨。建议带薄外套、长袖衬衫，折叠伞必备，鞋子选防水的！" },
    { user: "帮我把这些信息整理成一份出行清单", assistant: "用户要求整理清单，我需要综合前面所有对话的信息。", tool: "（无需调用工具，从完整轨迹中提取所有相关信息）", final: "【上海出行清单】①衣物：薄外套、长袖衬衫、换洗衣物；②雨具：折叠伞、防水鞋；③天气：下周 16-24°C，多云偶有小雨；④对比：比北京凉爽湿润，比北京更需要防雨。祝旅途愉快！" }
  ];
  var trajState = { round: 0 };

  function updateTrajectory() {
    var list = $("pl-tr-list");
    var count = $("pl-tr-count");
    var tokens = $("pl-tr-tokens");
    var warning = $("pl-tr-warning");

    if (trajState.round === 0) {
      list.innerHTML = '<span style="color:var(--c-sub);font-size:13px">（还没有对话，点击“添加一轮对话”开始）</span>';
      count.textContent = "0";
      tokens.textContent = "0";
      warning.style.display = "none";
      return;
    }

    var html = "";
    var totalTokens = 0;
    for (var i = 0; i < trajState.round; i++) {
      var r = TRAJECTORY_ROUNDS[i];
      var roundTokens = r.user.length * 2 + r.assistant.length * 2 + r.tool.length * 2 + r.final.length * 2;
      totalTokens += roundTokens;
      html += '<div style="margin-bottom:10px;padding:8px;border-left:3px solid var(--c-plan);border-radius:0 6px 6px 0;background:#fafafa">' +
        '<div style="font-size:12px;color:var(--c-plan);font-weight:700;margin-bottom:4px">第 ' + (i + 1) + ' 轮（约 ' + roundTokens + ' token）</div>' +
        '<div style="font-size:13px;line-height:1.6">' +
          '<div><b>👤 用户：</b>' + U.esc(r.user) + '</div>' +
          '<div><b>🤖 思考：</b>' + U.esc(r.assistant) + '</div>' +
          '<div><b>🔧 工具：</b>' + U.esc(r.tool) + '</div>' +
          '<div><b>💬 回复：</b>' + U.esc(r.final) + '</div>' +
        '</div></div>';
    }
    list.innerHTML = html;
    count.textContent = trajState.round;
    tokens.textContent = (800 + totalTokens).toLocaleString();

    // 模拟上下文窗口警告（第5轮时显示，实际是 128K 窗口，这里用模拟值教学）
    if (trajState.round >= 4) {
      warning.style.display = "block";
    } else {
      warning.style.display = "none";
    }
  }

  function bindTrajectory() {
    trajState = { round: 0 };
    updateTrajectory();
    $("pl-tr-add").addEventListener("click", function () {
      if (trajState.round >= TRAJECTORY_ROUNDS.length) {
        U.toast("已完成全部 " + TRAJECTORY_ROUNDS.length + " 轮演示！可以重置后再看");
        return;
      }
      trajState.round++;
      updateTrajectory();
    });
    $("pl-tr-reset").addEventListener("click", function () {
      trajState = { round: 0 };
      updateTrajectory();
    });
  }

  /* ---------- ⑫ 小测验 ---------- */
  function bindQuiz() {
    var body = $("pl-quiz-body");
    function draw() {
      body.innerHTML = QUIZ.map(function (item, i) {
        return '<div class="game-q">' +
          '<span class="qno">' + (i + 1) + "</span>" + item.q +
          '<div class="opts">' + item.opts.map(function (o, j) {
            return '<button class="opt" data-i="' + i + '" data-j="' + j + '">' + o + "</button>";
          }).join("") + "</div>" +
          '<div class="quiz-feedback" data-fb="' + i + '"></div></div>';
      }).join("");
      body.querySelectorAll(".opt").forEach(function (b) {
        b.addEventListener("click", function () {
          var i = parseInt(b.getAttribute("data-i"), 10);
          var j = parseInt(b.getAttribute("data-j"), 10);
          var item = QUIZ[i];
          var fb = body.querySelector('[data-fb="' + i + '"]');
          var btns = body.querySelectorAll('.opt[data-i="' + i + '"]');
          if (btns[0].disabled) return;
          btns.forEach(function (x) { x.disabled = true; });
          if (j === item.ans) {
            b.classList.add("correct");
            fb.innerHTML = '<span class="fb-ok">' + U.icon("check", 15) + " 答对啦！" + item.why + "</span>";
            U.addScore($("pl-quiz-score"), 1);
            U.celebrate(b);
          } else {
            b.classList.add("wrong");
            btns[item.ans].classList.add("correct");
            fb.innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " 正确答案：" + item.opts[item.ans] + "。" + item.why + "</span>";
          }
        });
      });
    }
    draw();
    $("pl-quiz-restart").addEventListener("click", function () {
      var sc = $("pl-quiz-score");
      sc.setAttribute("data-score", "0");
      sc.textContent = "★ 0";
      draw();
    });
  }

  return { render: render };
})();
