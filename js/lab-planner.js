/* ============================================================
 * lab-planner.js —— 规划器实验室（对应 L07 / L08）
 *
 * 学习顺序（18 张卡：“先说清楚 → 再拆 → 再排 → 写成清单 → 再执行 → 看边界 → 做质检 → 走一遍”）：
 * ① 认识规划器：Agent 的思考中枢
 * ② 把任务说清楚：四要素 + 澄清三问 + 模糊/清晰两连对比【合并原「四要素」「魔法句式」】
 * ③ 法宝一·拆解：任务分解树 + 现场规划（自己拆 → 看 AI 拆）【合并】
 * ④ 法宝二·排序：步骤排排队
 * ⑤ 排序进阶：步骤的依赖与并行（含并发执行）
 * ⑥ 计划要能被“执行”：清单计划 vs 一段话计划（结构化 + 解析兜底）
 * ⑦ 工具选择决策：该不该调工具、调哪一个（ReAct 的前置知识）
 * ⑧ ReAct 循环可视化（思考→行动→观察）
 * ⑨ 思维链（CoT）：接着“思考”环节讲怎么想得更准
 * ⑩ 循环的边界：上下文轨迹 + 停止条件 + 三形态“假完成”【合并 + 新增互动】
 * ⑪ 任务清单（TODO）：把计划放在一眼能看到的地方（状态栏）
 * ⑫ 两种规划范式：Plan-and-Execute vs ReAct
 * ⑬ 失败与反思（含失败分类）+ 计划自检【合并】
 * ⑭ 失败归因：第一个出错的步骤在哪（先归因，再反思）
 * ⑮ 提议者-审核者：计划生成与审查分离（含无 Key 内置示例降级；进阶课堂另有「A2A 智能体间协议」）
 * ⑯ 综合演练：从需求到完成走完整条链
 * ⑰ 小测验 ｜ 进阶原理互动课堂（15 概念）｜ 课堂小结
 *
 * 参考：ai-agent-book 第 1/2/5/6/7/10 章（ReAct 循环 / 任务清单状态栏 / 故障恢复与熔断 /
 *      长程规划与验收标准 / 失败归因 / 过早终止与提议者-审核者）；
 *      hello-agents 第 1/4/7/9 章（规划的定义 / Plan-and-Solve 两阶段 /
 *      计划的结构化输出与解析兜底 / 长时程任务的三种手段）。
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
    { q: "规划执行失败后，Agent 应该怎么做？", opts: ["直接放弃", "反思失败原因→调整计划→重新执行", "假装成功了"], ans: 1, why: "反思（Reflection）是 Agent 的重要能力：分析失败原因、调整策略、重新尝试，而不是放弃或掩盖。" },
    { q: "用户只说了一句“帮我安排一下下周的值日”，规划器最好先做什么？", opts: ["先问清楚：给谁提醒、每天几次、什么时候提醒、用什么方式", "马上排一张值日表出来", "先猜一个方案，做完再问"], ans: 0, why: "信息不足时先澄清、再规划——这就是意图澄清。对象、时间、次数不同，计划完全不同；硬猜出来的计划，做得越细越容易白做。" },
    { q: "判断一个任务“拆得好不好”，下面哪条标准最实用？", opts: ["每一步都能单独执行，而且都有可检查的产物", "步骤拆得越多越细越好", "步骤的名字起得越长越好"], ans: 0, why: "好分解三条标准：足够小（一次能做完）、有产出（做完能检查）、有边界（不越界不漏项）。判断口诀：下一步能不能直接开始做？" },
    { q: "“准备零食”和“查公交线路”这两步是什么关系？", opts: ["互不依赖，可以并行做，省一半时间", "必须严格一前一后，不能同时做", "顺序怎么排都会出错"], ans: 0, why: "两步都不需要对方的产出 → 没有依赖 → 可以并行。真实 Agent 会在一轮里发出多个工具调用并发执行；只有依赖链上的步骤才必须排队等。" },
    { q: "如果只设“任务完成”作为 Agent 的停止条件，会有什么风险？", opts: ["模型可能自认为还没完成而一直循环，造成超时和费用失控", "没有风险，跑得越久结果越准", "会让最终回答变得太短"], ans: 0, why: "自主 Agent 必须配硬上限（最多几轮 / 最多花多少）兜底，否则容易在“没做完”的判断里空转烧钱。停止条件 = 任务完成信号 + 硬上限。" },
    { q: "为什么工程上要让规划器输出“清单”（结构化）而不是一段话？", opts: ["清单的每一步都能被程序读懂、照着执行、逐条检查", "清单看起来更整齐好看", "一段话太长了，模型写不完"], ans: 0, why: "规划不是写给自己看的作文，是要交给程序执行的：每一步要有「做什么 + 用什么工具 + 完成标准」，程序才能解析、执行、校验；一段话只能靠猜，猜错就卡住。" },
    { q: "任务失败后，工程师最先找的是什么？", opts: ["第一个出错的步骤——后面的报错往往只是它的后果", "最后一行报错，把它改掉就行了", "换个更贵、更大的模型再试"], ans: 0, why: "失败归因的对象是「首个导致偏离的错误」：末次报错通常只是后果。只修最后一步，等于给症状贴创可贴，问题会换个地方再冒出来。" }
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

  /* ---------- 渲染 ---------- */
  function render() {
    var sec = $("sec-planner");
    sec.innerHTML =
      LP.labHead("plan", "gear", "规划器实验室", "让 AI 学会思考 · 组件篇·规划（L07–L08）") +

      /* 本课学习地图：先给地图、再讲细节（借鉴 ai-agent-book 每章开篇的「本章知识脉络图」）
       * 每个节点可点 → 跳到对应卡片并高亮闪烁，兼作页内导航。 */
      U.sectionMap({
        title: "从“说清楚”到“干完活”的五段路",
        hint: "共 18 张卡片 · 点任意一格可直接跳过去",
        color: "plan",
        groups: [
          { label: "先把话说清楚", items: [
            { t: "认识规划器", el: "pl-intro", note: "三法宝" },
            { t: "把任务说清楚", el: "pl-cmp-q1", note: "四要素 + 澄清三问" }
          ] },
          { label: "拆 · 排 · 写成清单", items: [
            { t: "法宝一·拆解", el: "pl-tree" },
            { t: "步骤排排队", el: "pl-order", note: "7 个任务" },
            { t: "依赖与并行", el: "pl-dep", note: "哪些能同时做" },
            { t: "计划写成清单", el: "pl-planrun", note: "双轨开跑" }
          ] },
          { label: "想 · 选 · 动起来", items: [
            { t: "工具选择决策", el: "pl-tooldec", note: "6 场景" },
            { t: "ReAct 循环", el: "pl-react-rounds", note: "思考→行动→观察" },
            { t: "思维链 CoT", el: "pl-cot-q1", note: "小模型 vs 大模型" }
          ] },
          { label: "边界与质检", items: [
            { t: "循环的边界", el: "pl-tr-add", note: "轨迹 + 停止条件" },
            { t: "任务清单 TODO", el: "pl-todo", note: "一眼看得到" },
            { t: "两种规划范式", el: "pl-paradigm", note: "Plan-Execute vs ReAct" },
            { t: "失败与反思", el: "pl-fail", note: "先归因再反思" },
            { t: "失败归因", el: "pl-attrib", note: "找第一个错" },
            { t: "提议者-审核者", el: "pl-pr-go", note: "双 Agent" }
          ] },
          { label: "演练与验收", items: [
            { t: "综合演练", el: "pl-e2e-flow", note: "端到端 7 关" },
            { t: "小测验", el: "pl-quiz", note: "14 题" },
            { t: "进阶原理课堂", el: "pl-adv", note: "15 个概念" }
          ] }
        ]
      }) +

      /* 卡片顺序（18 张卡，学习顺序：说清楚 → 拆 → 排 → 写成清单 → 执行 → 边界 → 质检 → 演练）：
       *   认识规划器 ｜ 把任务说清楚（四要素 + 澄清三问 + 模糊 vs 清晰两连对比）
       *   → 法宝一·拆解（自己拆 + 看 AI 拆）｜ 法宝二·排序（排排队 → 依赖与并行）
       *   → 计划要能被“执行”（清单计划 vs 一段话计划）→ 工具选择决策
       *   → ReAct 循环 → 思维链 CoT（承接“思考”环节）
       *   → 循环的边界（上下文轨迹 + 停止条件 + 三形态“假完成”）→ 任务清单（TODO / 状态栏）→ 两种规划范式
       *   → 失败与反思（含失败分类 + 计划自检）→ 失败归因（先找第一个错）→ 提议者-审核者
       *   → 综合演练（端到端走一遍）→ 小测验 → 进阶原理互动课堂（15 概念）→ 课堂小结 */
      /* 学习目标 */
      '<div class="lesson-goal card-plan">' +
        '<h3>' + U.icon("target", 18) + ' 本课学习目标</h3>' +
        '<div class="goal-list">' +
          '<div class="goal-item"><span class="goal-num">1</span>理解规划器在 Agent 中的作用：它是"思考中枢"——理解意图、拆解任务、排序步骤、选择工具</div>' +
          '<div class="goal-item"><span class="goal-num">2</span>学会<b>把任务说清楚</b>（四要素 + 两连对比实验），也学会<b>信息不足时先问</b>（意图澄清：缺关键信息要问、有歧义要确认、危险操作先请示）</div>' +
          '<div class="goal-item"><span class="goal-num">3</span>掌握三大基本功：<b>拆解</b>（自己判断该拆哪些 + 看 AI 现场拆，含验收标准）、<b>排序</b>（依赖与并行）、<b>写成清单</b>（做什么 + 用什么工具 + 完成标准，程序才执行得下去）</div>' +
          '<div class="goal-item"><span class="goal-num">4</span>学会<b>想清楚</b>（思维链 CoT）、<b>选对工具</b>（工具选择决策）、<b>跑起来</b>（ReAct：思考→行动→观察）、对比 Plan-and-Execute vs ReAct 两种范式</div>' +
          '<div class="goal-item"><span class="goal-num">5</span>理解规划的质量控制与边界：<b>提议者-审核者</b>（防自欺）、<b>任务清单</b>（把计划放在一眼能看到的地方）、<b>失败归因</b>（先找第一个错，再反思）、<b>上下文轨迹 + 停止条件</b>（既要为反思提供依据，也要知道什么时候该停、别被三形态“假完成”骗了）</div>' +
          '<div class="goal-item"><span class="goal-num">6</span>把整条链走一遍：在<b>综合演练</b>里完成一次 需求澄清 → 拆解 → 排序 → 执行 → 反思 的端到端任务</div>' +
        '</div>' +
      '</div>' +

      /* ① 认识规划器：Agent 的思考中枢 */
      LP.card("plan", "认识规划器：Agent 的思考中枢", "规划器（Planner）是 Agent 的「大脑」：<b>理解意图 → 拆解任务 → 排序步骤 → 选择工具</b>，并在执行中不断调整。",
        '<div class="row" style="gap:24px;justify-content:center;margin:6px 0 10px;flex-wrap:wrap">' +
          '<div class="tf-node" style="border-color:var(--c-plan);min-width:140px">' + U.icon("target", 20) + ' 法宝一：拆解<br><small style="color:var(--c-sub);font-weight:400">大任务 → 小步骤</small></div>' +
          '<div class="tf-arrow">→</div>' +
          '<div class="tf-node" style="border-color:var(--c-plan);min-width:140px">' + U.icon("link", 20) + ' 法宝二：排序<br><small style="color:var(--c-sub);font-weight:400">排好先后顺序</small></div>' +
          '<div class="tf-arrow">→</div>' +
          '<div class="tf-node" style="border-color:var(--c-plan);min-width:140px">' + U.icon("gear", 20) + ' 法宝三：执行<br><small style="color:var(--c-sub);font-weight:400">调工具+看结果</small></div>' +
        '</div>' +
        '<div class="tip">' + U.icon("spark", 16) + ' <b>核心公式：</b>规划器不是一次性列完步骤就完事，而是在“思考→行动→观察”的循环中动态调整——这就是 <b>ReAct 循环</b>，下面会专门演示！</div>' +
        '<div class="tip" style="margin-top:8px">' + U.icon("book", 16) + ' <b>ai-agent-book 原文：</b>“LLM 是 Agent 的决策核心——理解意图、思考规划、做出判断。”规划器的能力来自预训练积累的世界知识，以及后训练固化的决策策略。</div>' +
        '<div class="tip" style="margin-top:8px">' + U.icon("brain", 16) + ' <b>一句话理解“规划”：先在脑子里预演一遍，再动手。</b>规划不是把任务写长，而是把“模糊的大愿望”变成“可执行的清单”——该拆的拆开、该等的排队、该并行的同时做。执行中遇到新情况，还要回来改计划（这就是后面的 ReAct 循环）。</div>',
        { id: "pl-intro" }
      ) +

      /* ② 把任务说清楚：四要素 + 澄清三问 + 模糊 vs 清晰（合并原「四要素」「魔法句式」两卡） */
      LP.card("plan", "实验：把任务说清楚——四要素 / 澄清三问 / 模糊 vs 清晰",
        "请规划器办事，要说清四件事；信息不足时，还要会问回去。先弄清原理，再做两次对比：同一件事「一句话」和「说清楚」差多少、逐条补齐四要素后回答怎么一步步变好。" +
        "（对比一需要真实模型；<b>对比二没配 Key 也能用示例演示</b>）",
        /* 区 1：原理 —— 先讲清“为什么”，再做实验 */
        '<div class="pf-kit-head">' + U.icon("target", 16) + ' 原理：四要素 = 把“猜”变成“照做”</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("check", 16) + '<span>AI 必须知道的四件事</span>' +
              '<span class="pf-chan">缺一条就得猜</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">① 做什么</span>任务 + 目标：要达成什么效果</div>' +
              '<div class="pf-step"><span class="pf-step-tag">② 给谁、什么时候</span>对象 + 时限：说给谁听、什么时候要——缺了，语气和深浅全凭猜</div>' +
              '<div class="pf-step"><span class="pf-step-tag">③ 输出什么格式</span>交付物形态：表格 / 清单 / 一段话——缺了，输出随缘、还得返工</div>' +
              '<div class="pf-step"><span class="pf-step-tag">④ 能用哪些工具</span>能力边界：可以联网吗、能改文件吗——缺了，可能干脆编一个</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 下面的实验会验证：每补一条要素，回答就更接近你要的结果。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("chat", 16) + '<span>听不懂就问：Agent 的澄清三问</span>' +
              '<span class="pf-chan">信息不足时先问，别硬猜</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">① 缺关键信息就问</span>“哪天办？多少人参加？”——四要素缺哪条，就补哪条</div>' +
              '<div class="pf-step"><span class="pf-step-tag">② 有歧义先确认</span>“下周三”到底指哪一天？宁可先问一句，也别自己猜一个</div>' +
              '<div class="pf-step"><span class="pf-step-tag">③ 危险的先请示</span>花钱、删文件、发消息给别人——动手前先让用户点个头</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 四要素是“用户怎么说清楚”，澄清三问是“Agent 听不懂时怎么问回去”——两个方向都要会。</div>' +
          '</div>' +
        '</div>' +
        /* 对比一：魔法句式（同一模型、同一件事，只换说法） */
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 对比一：同一件事，两种说法——差距有多大？</div>' +
        '<div class="cmp-box">' +
          '<div class="cmp-col"><h4><span class="stage-pill pill-exe">模糊说法</span>只说了「做什么」</h4>' +
            '<div class="cot-q" id="pl-cmp-q1"></div>' +
            '<div class="ans" id="pl-ans-vague"><span style="color:var(--c-sub)">还没有提问……</span></div></div>' +
          '<div class="cmp-col"><h4><span class="stage-pill pill-mem">魔法句式</span>目标 + 步骤 + 顺序 + 要求</h4>' +
            '<div class="cot-q" id="pl-cmp-q2"></div>' +
            '<div class="ans" id="pl-ans-clear"><span style="color:var(--c-sub)">还没有提问……</span></div></div>' +
        '</div>' +
        '<div class="row" style="margin-top:12px">' +
          '<button class="btn btn-plan" id="pl-cmp">' + U.icon("spark", 16) + ' 同时问两种说法</button>' +
          '<button class="btn btn-ghost" id="pl-cmp-next">' + U.icon("refresh", 16) + ' 换一题</button>' +
        '</div>' +
        '<div id="pl-cmp-model" style="margin-top:12px"></div>' +
        '<div id="pl-cmp-table"></div>' +
        '<div class="quiz-feedback" id="pl-cmp-fb"></div>' +
        '<div class="tip" style="margin-top:10px">' + U.icon("book", 16) + ' <b>原理：</b>同一个模型、同一件事，只换说法——模糊说法只说了「做什么」，AI 只能用通用套话填空；魔法句式把<b>目标、步骤、顺序、每段要求</b>交代清楚，模型才能逐条落实。' +
          '<br><b>实验条件（保证公平）：</b>两边<b>任务完全相同</b>，只有说法不同，用的是<b>同一个模型</b>、同样的输出上限。' +
          '<br><b>玩法：</b>点「换一题」换一个任务再比一次——多比几次就会发现，“说清楚就更做得到”不是运气，是规律。</div>' +
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 对比二：逐条补齐四要素——看回答一步步变好</div>' +
        '<div class="cmp-req" id="pl-prompt-reqs"></div>' +
        '<div class="cmp-box">' +
          '<div class="cmp-col">' +
            '<h4><span class="stage-pill pill-exe">模糊版</span>“帮我安排值日提醒。”</h4>' +
            '<pre class="cmp-pre" id="pl-prompt-a"></pre>' +
            '<div class="ans" id="pl-ans-a"><span style="color:var(--c-sub)">还没有提问……</span></div>' +
          '</div>' +
          '<div class="cmp-col">' +
            '<h4><span class="stage-pill pill-mem">清晰版</span>每加一条要素，描述就清楚一分</h4>' +
            '<pre class="cmp-pre" id="pl-prompt-b"></pre>' +
            '<div class="ans" id="pl-ans-b"><span style="color:var(--c-sub)">还没有提问……</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="row" style="margin-top:12px">' +
          '<button class="btn btn-plan" id="pl-prompt-run">' + U.icon("spark", 16) + ' 同时问两个提示词</button>' +
          '<button class="btn btn-ghost" id="pl-prompt-all">' + U.icon("check", 16) + ' 一键补齐四要素</button>' +
        '</div>' +
        '<div id="pl-prompt-table"></div>' +
        '<div class="quiz-feedback" id="pl-prompt-fb"></div>') +

      /* ③ 法宝一·拆解：任务分解树 + 现场规划（合并：自己拆 → 看 AI 拆） */
      LP.card("plan", "法宝一·拆解：把大任务拆成小任务（自己拆 + 看 AI 拆）",
        "规划器的第一件事是“拆”。先弄清<b>为什么要拆、拆成什么样才算好</b>，再分两步动手：① 自己判断该拆出哪些子任务；② 让规划器现场拆一次。",
        /* 区 1：原理 —— 先讲清“为什么”，再动手拆 */
        '<div class="pf-kit-head">' + U.icon("link", 16) + ' 原理：为什么要“拆”？拆成什么样才算好？</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("target", 16) + '<span>为什么要拆</span>' +
              '<span class="pf-chan">拆解的三个理由</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">一次做完太难</span>大任务要同时考虑太多事——容易漏、容易乱</div>' +
              '<div class="pf-step"><span class="pf-step-tag">拆开能检查</span>每一步都有明确产出：做到哪、错在哪，一眼看清</div>' +
              '<div class="pf-step"><span class="pf-step-tag">拆开能并行</span>互不影响的步骤可以同时做，省时间</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 拆解（Task Decomposition）= 把“模糊的大愿望”变成“可执行的清单”。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("check", 16) + '<span>好分解的三条标准</span>' +
              '<span class="pf-chan">怎么判断拆得好不好</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">① 足够小</span>每一步都“一次能做完”，不用再往下分</div>' +
              '<div class="pf-step"><span class="pf-step-tag">② 有产出</span>做完能指着说“这个完成了”——可检验</div>' +
              '<div class="pf-step"><span class="pf-step-tag">③ 有边界</span>无关的事不塞进来，必需的事不能漏</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 最实用的一问：<b>下一步能不能直接开始做？</b>能，说明拆到位了。</div>' +
            '<div class="pf-note">' + U.icon("check", 13) + ' 进阶做法：给每一步再补一句<b>验收标准</b>（做到什么程度算完成）——例如“场地：能坐 40 人、有投影仪，且管理员确认可用”。计划能被检查，才敢让它自动往下走。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手（组件自带标题） */
        '<div id="pl-tree"></div>'+
        '<div class="pf-kit-head">' + U.icon("robot", 16) + ' 动手二：让规划器现场拆一次（真实模型）</div>' +
        '<div class="row">' +
          '<input type="text" id="pl-plan-input" placeholder="例如：组织一次班级运动会" style="flex:1">' +
          '<button class="btn btn-plan" id="pl-plan-go">' + U.icon("spark", 16) + " 开始拆解</button>" +
        '</div>' +
        '<div class="tx-points">' +
          '<div class="tx-point">' + U.icon("book", 15) + '<div class="tx-point-txt"><b>ai-agent-book：</b>工程上常让模型输出 <b>JSON 步骤列表</b>，程序再按列表逐一执行。</div></div>' +
        '</div>' +
        '<div class="game-box" id="pl-plan-out" style="display:none"></div>') +

      /* ④ 法宝二·排序：步骤排排队 */
      LP.card("plan", "游戏：步骤排排队",
        "把打乱的小步骤排回正确的先后顺序。动手前先弄清<b>顺序为什么不能乱、怎么判断谁先谁后</b>——玩起来会更有感觉。共 " + TASKS.length + " 个任务，包括 AI Agent 真实任务哦！",
        /* 区 1：原理 —— 先讲清“为什么”，再动手排 */
        '<div class="pf-kit-head">' + U.icon("link", 16) + ' 原理：为什么顺序不能乱？怎么判断谁先谁后？</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("alert", 16) + '<span>顺序错了会怎样</span>' +
              '<span class="pf-chan">排序的意义</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">会卡住</span>步骤之间有依赖：没定场地，就没法发通知</div>' +
              '<div class="pf-step"><span class="pf-step-tag">要返工</span>先做了后面的，前提一变就得重做</div>' +
              '<div class="pf-step"><span class="pf-step-tag">会变慢</span>正确顺序 = 该等的等、能并行的并行</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 排序（Sequencing）就是给拆好的步骤找出正确的“先后关系”。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("target", 16) + '<span>一句话判断先后</span>' +
              '<span class="pf-chan">排序的方法</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">先问自己</span>“这一步，需要谁的产出？”</div>' +
              '<div class="pf-step"><span class="pf-step-tag">需要某一步</span>就排在那一步的后面（有依赖）</div>' +
              '<div class="pf-step"><span class="pf-step-tag">谁都不需要</span>可以排在最前面，当作起点</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 把依赖关系画成一串箭头，正确顺序自然就出来了。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手游戏 */
        '<div class="pf-kit-head">' + U.icon("target", 16) + ' 动手游戏：把步骤排回正确顺序</div>' +
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

      /* ⑤ 排序进阶：步骤的依赖与并行 */
      LP.card("plan", "实验：步骤的依赖与并行",
        "拆出来的步骤不是随便排的。先弄清<b>“依赖”和“并行”这两种关系</b>，再动手排一次——你会发现有的步骤可以同时做。",
        /* 区 1：原理 —— 两种关系一句话说清 */
        '<div class="pf-kit-head">' + U.icon("gear", 16) + ' 原理：步骤之间只有两种关系</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("link", 16) + '<span>依赖：必须排队等</span>' +
              '<span class="pf-chan">串行</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">例子</span>“查天气”必须排在“决定带不带伞”之前</div>' +
              '<div class="pf-step"><span class="pf-step-tag">判断</span>B 要用 A 的产出 → A 做完才能做 B</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 依赖链上的顺序是唯一的——颠倒就做不下去。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("refresh", 16) + '<span>并行：可以同时做</span>' +
              '<span class="pf-chan">省时间</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">例子</span>“准备零食”和“查线路”互不影响，可同时进行</div>' +
              '<div class="pf-step"><span class="pf-step-tag">判断</span>C 和 D 互不要对方产出 → 可以并行</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 识别“能并行的步骤”是提速关键——真实 Agent 会把它们同时发起。</div>' +
            '<div class="pf-note">' + U.icon("gear", 13) + ' 落地机制：模型一轮里<b>一次输出多个工具调用</b>（多个 tool_calls），程序并发执行再一起回收结果；只有依赖链上的步骤才必须排队。这也是很多 Agent 把整个计划画成一张<b>' + U.term("依赖图（DAG）", 'DAG = 有向无环图（Directed Acyclic Graph）。“有向”＝箭头有方向（A → B 表示“B 要用 A 的结果”）；“无环”＝顺着箭头走一圈回不到自己——因为<b>任务不能自己等着自己</b>，那就永远做不完了。<br>把计划画成 DAG 的好处很直接：图上没有箭头相连的两个步骤，就可以<b>同时做</b>；沿着箭头排队的那一串，就必须依次做。按这个顺序推进，就叫“<b>拓扑序</b>”。<br>一句话：<b>DAG 是“谁得等谁”的一张图，拓扑序是“按等待关系排出来的顺序”。</b>') + '</b>再按拓扑序推进的原因。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手（组件自带标题） */
        '<div id="pl-dep"></div>') +

      /* ⑥ 计划要能被“执行”：结构化清单 vs 一段话（承接拆解/排序，补工程落地） */
      LP.card("plan", "实验：计划要能被“执行”——把计划写成清单",
        "拆好、排好的计划，最终是要交给<b>程序</b>去跑的。同一件事，写成“一段话”和写成“清单”，机器读起来完全不一样：先弄清两种写法的差别，再看两栏同时开跑——哪一份跑得下去。",
        /* 区 0：图示 —— 同一件事，两种写法跑起来差在哪（左图右解，与感知器原理图同一版式） */
        '<div class="ta-duo">' +
          '<div class="ta-image-wrap">' +
            '<img src="images/plan-checklist-vs-prose.svg" alt="双轨对比图：左边一段话计划卡在第 2 步（没有完成标准），右边清单计划 4 步全部打勾完成" class="ta-image">' +
            '<div class="ta-source">📐 本教学系统绘制 · 一段话计划 vs 清单计划</div>' +
          '</div>' +
          '<div class="ta-explain">' +
            '<div class="te-title">📖 差别不在“写得好不好”，在“能不能被检查”</div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step is-bad"><span class="pf-step-tag">一段话</span>“记得带伞和水壶”——<b>说不清带什么、更说不清做没做完</b>，所以卡在“准备东西”这一步</div>' +
              '<div class="pf-step"><span class="pf-step-tag">清单</span>每条都写清 <b>做什么 + 用什么工具 + 完成标准</b>——“伞已装包”是一个可以被勾掉的事实</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 判断标准只有一条：<b>这一条能不能被勾掉？</b>能勾掉的才是清单，勾不掉的就还是一段话。</div>' +
          '</div>' +
        '</div>' +
        /* 区 1：原理 —— 计划是写给“执行者”看的 */
        '<div class="pf-kit-head">' + U.icon("archive", 16) + ' 原理：计划要写给“谁”看？</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("chat", 16) + '<span>两种写法</span>' +
              '<span class="pf-chan">人话 vs 清单</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">一段话</span>“先看看课表，再按每天的时间提醒同学们值日……”——人看得懂，但程序不知道调哪个工具、传什么参数</div>' +
              '<div class="pf-step"><span class="pf-step-tag">清单</span>每一步写清三样：<b>做什么 + 用什么工具 + 完成标准</b>——程序能解析、能执行、能逐条检查</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 口诀：<b>计划不是作文，是给程序看的作业单。</b></div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("gear", 16) + '<span>程序怎么“读懂”计划</span>' +
              '<span class="pf-chan">四步走</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">① 输出结构化</span>让模型按固定格式输出（JSON 列表 / 带序号的三列清单），字段就是“步骤 / 工具 / 完成标准”</div>' +
              '<div class="pf-step"><span class="pf-step-tag">② 解析</span>程序把这段文本变成真正的数据结构——解析不了，就等于没有计划</div>' +
              '<div class="pf-step"><span class="pf-step-tag">③ 校验</span>检查每条是否缺字段、步骤号是否连续、有没有越界动作；不合格就打回重写</div>' +
              '<div class="pf-step"><span class="pf-step-tag">④ 兜底</span>万一模型格式写坏了：先多重解析，再退回“最小可用计划”并如实说明——<b>宁可空，不可编</b></div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("check", 13) + ' 进阶：每一步再补一句<b>验收标准</b>（“10 条提醒都在、时间都对”），程序才有资格替我们判断“这一步算不算做完”。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手（双轨推进） */
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 动手实验：两栏同时开跑——哪一份计划跑得下去？</div>' +
        '<div class="game-box" id="pl-planrun"></div>' +
        '<div class="tx-points">' +
          '<div class="tx-point">' + U.icon("book", 15) + '<div class="tx-point-txt"><b>hello-agents：</b>工程上让规划器输出 <b>步骤列表</b>（Python 列表 / JSON），程序再按列表一步步交给执行器；解析失败要能“兜底”，不能直接崩。</div></div>' +
          '<div class="tx-point">' + U.icon("archive", 15) + '<div class="tx-point-txt"><b>ai-agent-book：</b>计划越结构化，越好做三件事：<b>调试</b>（知道卡在哪一步）、<b>评估</b>（哪一步总出错）、<b>复用</b>（下次遇到同类任务直接拿这份清单改）。</div></div>' +
        '</div>') +

      /* ⑦ 工具选择决策（ReAct 的“行动”要先知道该不该调工具） */
      LP.card("plan", "互动：工具选择决策——什么时候调用什么工具？",
        "规划器的核心能力之一：判断<b>要不要调用工具、调用哪个、传什么参数</b>。先弄清两条判断标准，再上场选工具！",
        /* 区 1：原理 —— 该不该调 / 怎么选对 */
        '<div class="pf-kit-head">' + U.icon("target", 16) + ' 原理：什么时候该调用工具？怎么选对？</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("alert", 16) + '<span>该不该调用工具</span>' +
              '<span class="pf-chan">一条判断标准</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">该调</span>需要“模型记忆之外”的信息或能力——实时天气、精确计算、最新资料</div>' +
              '<div class="pf-step"><span class="pf-step-tag">不用调</span>模型自己就能做好的——写作、翻译、改写、常识问答</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 一句话判断：这件事需要外部信息、还是要精确计算？是，就调工具。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("gear", 16) + '<span>怎么选对工具</span>' +
              '<span class="pf-chan">三步</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">① 理解意图</span>用户到底要什么——查天气？还是查空气质量？</div>' +
              '<div class="pf-step"><span class="pf-step-tag">② 匹配能力</span>哪个工具的描述和意图最接近——靠语义匹配，不是“猜”</div>' +
              '<div class="pf-step"><span class="pf-step-tag">③ 构造参数</span>把用户的话变成工具需要的参数——城市：上海；时间：明天</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 选错工具 ≠ 模型笨：多半是工具描述没写清楚。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手 */
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 动手互动：你能选对工具吗？</div>' +
        '<div class="game-box" id="pl-tooldec">' +
          '<div id="pl-td-flow"></div>' +
        '</div>' +
        '<div class="tip tip-info" style="margin-top:10px">' + U.icon("book", 16) + ' <b>给工具写好“说明书”：</b>模型靠工具描述（名称、用途、参数）做匹配——描述写得越清楚，选择就越准。写工具描述，也是 Agent 工程师的重要工作。</div>' +
        '<div class="tip" style="margin-top:8px">' + U.icon("alert", 16) + ' <b>工具一多，就会选错：</b>当工具数量超过一百个，连最先进的模型也会挑错工具。工程上的对策不是“让模型更聪明”，而是把工具<b>分层整理</b>：先按大类找（查数据？做计算？发消息？），再把相关的几个交给模型挑——实测能把工具选择准确率从 <b>49% 提到 74%</b>。实在都不匹配时，宁可回答“没找到合适的工具”，也不要硬选一个。</div>' +
        '<div class="tip tip-info" style="margin-top:8px">' + U.icon("wrench", 16) + ' <b>和「执行器」那张游戏怎么分工：</b>这张卡练的是「<b>选工具</b>」——还没动手之前，判断“要不要用工具、该用哪一类”；执行器练的是「<b>调工具</b>」——已经决定要调了，把参数填对、把结果收好。同一个工具的两个阶段，不是同一件事做两遍。</div>'
      ) +

      /* ⑧ 核心演示：ReAct 循环——思考→行动→观察 */
      LP.card("plan", "核心演示：ReAct 循环——思考→行动→观察", "ai-agent-book 第 1 章：Agent 执行任务的核心模式叫 <b>ReAct</b>（Reasoning + Acting）。模型先<b>思考</b>当前该做什么，然后调用工具<b>行动</b>，再<b>观察</b>工具返回的结果并继续思考——“想→做→看”不断重复，直到任务完成。点击下面的按钮，一步步看 Agent 是怎么工作的！",
        /* 区 0：图示 —— 一圈一圈转的 ReAct（左图右解，与感知器原理图同一版式） */
        '<div class="ta-duo">' +
          '<div class="ta-image-wrap">' +
            '<img src="images/plan-react-loop.svg" alt="ReAct 循环图：思考 Thought → 行动 Action → 观察 Observation → 再思考，够了一环出口指向交付完成" class="ta-image">' +
            '<div class="ta-source">📐 本教学系统绘制 · ReAct 循环（ai-agent-book 第 1 章）</div>' +
          '</div>' +
          '<div class="ta-explain">' +
            '<div class="te-title">📖 一圈只推进一步——这就是它和“一口气说完”的区别</div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">为什么必须有“观察”</span>“观察”回来的<b>真数据</b>才是下一步决策的依据——没有它，模型只能靠猜</div>' +
              '<div class="pf-step"><span class="pf-step-tag">为什么必须有“出口”</span>循环要有边界：<b>最大轮数（约 12 轮）+ 停止条件</b>——不然会一直转下去，越转越贵</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 对照着记：<b>思维链 CoT = 只“想”不“做”；ReAct = 边想边做。</b></div>' +
          '</div>' +
        '</div>' +
        '<div class="game-box">' +
          '<div style="background:var(--c-plan-light);padding:12px 16px;border-radius:10px;margin-bottom:14px;font-weight:700">' + U.icon("user", 16) + ' 用户任务：' + U.esc(REACT_DEMO.task) + '</div>' +
          '<div id="pl-react-rounds"></div>' +
          '<div class="row" style="margin-top:14px;gap:10px;flex-wrap:wrap">' +
            '<button class="btn btn-plan" id="pl-react-next">' + U.icon("spark", 16) + ' 下一步</button>' +
            '<button class="btn btn-ghost" id="pl-react-auto">' + U.icon("spark", 16) + ' 自动播放全部</button>' +
            '<button class="btn btn-ghost" id="pl-react-reset">' + U.icon("refresh", 16) + ' 重置</button>' +
            '<span id="pl-react-status" style="color:var(--c-sub);font-size:13px;align-self:center"></span>' +
          '</div>' +
        '</div>' +
        '<div class="tip" style="margin-top:10px">' + U.icon("spark", 16) + ' <b>关键洞察：</b>每一轮 ReAct 循环，Agent 的上下文（轨迹）都在增长——思考过程、工具调用、工具结果都被记录下来，供下一轮思考参考。这就是 Agent 的“工作记忆”！</div>'
      ) +

      /* ⑨ 思维链（CoT）：紧接着 ReAct 的“思考”环节，讲怎么想得更准 */
      LP.card("plan", "实验：思维链（CoT）——一步一步想的力量",
        "让模型「一步一步想」而不是直接给答案——这就是<b>思维链（Chain-of-Thought, CoT）</b>。先弄清<b>为什么“分步”会更准</b>，" +
        "再选一个模型做对比：小模型必须被提醒“写过程”，而大模型可能已经把“一步一步想”<b>内化</b>成了本能——直接问也答对。",
        /* 区 1：原理 —— 先讲清“为什么”，再做实验 */
        '<div class="pf-kit-head">' + U.icon("brain", 16) + ' 原理：为什么“一步一步想”更准？</div>' +
        '<div class="pf-demo-grid" style="grid-template-columns:1fr">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("calc", 16) + '<span>直接答 vs 逐步答</span>' +
              '<span class="pf-chan">大跳变小步</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">直接答 = 一步跳到位</span>所有推理挤在一次输出里——中间错了没机会查</div>' +
              '<div class="pf-step"><span class="pf-step-tag">逐步答 = 大跳变小步</span>每步只做一点，上一步的正确结果支撑下一步</div>' +
              '<div class="pf-step"><span class="pf-step-tag">过程可检查</span>推理写出来了，错在哪一步一目了然</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' CoT 就像数学题写过程——过程对了，答案才有保障。下面的题都要连推好几步，“不落笔”几乎一定会错。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手实验（先选模型，再对比两种问法） */
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 动手实验：选一个模型，同一道题两种问法</div>' +
        '<div class="cmp-task-row">' +
          '<span class="cmp-task-label">' + U.icon("robot", 14) + ' 选模型（决定这个 AI 有多聪明）：</span>' +
          '<div class="cmp-tasks" id="pl-cot-models"></div>' +
        '</div>' +
        '<div id="pl-cot-model" style="margin-bottom:12px"></div>' +
        '<div class="cmp-box">' +
          '<div class="cmp-col"><h4><span class="stage-pill pill-exe">直接问答案</span>指令：<b>只要答案</b></h4>' +
            '<div class="cot-q" id="pl-cot-q1"></div>' +
            '<div class="ans" id="pl-cot-direct"><span style="color:var(--c-sub)">还没有提问……</span></div></div>' +
          '<div class="cmp-col"><h4><span class="stage-pill pill-mem">思维链提问</span>指令：<b>一步一步算</b></h4>' +
            '<div class="cot-q" id="pl-cot-q2"></div>' +
            '<div class="ans" id="pl-cot-cot"><span style="color:var(--c-sub)">还没有提问……</span></div></div>' +
        '</div>' +
        '<div class="row" style="margin-top:12px">' +
          '<button class="btn btn-plan" id="pl-cot-go">' + U.icon("spark", 16) + ' 同时问两种方式</button>' +
          '<button class="btn btn-ghost" id="pl-cot-next">' + U.icon("refresh", 16) + ' 换一题</button>' +
        '</div>' +
        '<div id="pl-cot-table" style="margin-top:12px"></div>' +
        '<div class="quiz-feedback" id="pl-cot-fb"></div>' +
        '<div class="tip" style="margin-top:10px">' + U.icon("book", 16) + ' <b>原理：</b>CoT 让模型把推理过程显式输出，每一步都基于上一步——减少「跳步」错误。在数学、符号推理、决策任务上提升显著。' +
          '<br><b>实验条件：</b>题干完全相同，只有指令不同——「直接问」那侧被限制只能输出很短一句，模拟「不假思索就报数」。' +
          '<br><b>换模型看什么：</b>小模型（Qwen2.5-7B）要提醒它「写过程」才稳，像借助外部脚手架；换成大模型后重点看「直接问」那一侧——如果也答对了，说明「一步一步想」已经被<b>内化</b>成模型本能。' +
          '<br><b>模型与 Key：</b>Qwen2.5-7B 走「设置 → 云端能力密钥 · 硅基流动」；DeepSeek V4 Flash 走「设置」里的 DeepSeek Key。</div>'
      ) +

      /* ⑩ 循环的边界：上下文轨迹 + 停止条件 + 假完成（合并同一主题，补两个互动） */
      LP.card("plan", "循环的边界：上下文轨迹 + 停止条件 + 假完成",
        "ReAct 每转一圈，轨迹就会长一段；但循环不能无限转下去。先弄清<b>上下文 = 静态前缀 + 轨迹</b>、看轨迹怎么增长，再回答两个问题：<b>什么时候该停下来</b>？以及——<b>它说“做完了”，怎么能是真的做完了</b>？",
        /* 区 1：原理 —— 上下文的两部分 */
        '<div class="pf-kit-head">' + U.icon("archive", 16) + ' 原理：上下文 = 静态前缀 + 轨迹</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("archive", 16) + '<span>静态前缀（不变）</span>' +
              '<span class="pf-chan">占固定 Token</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">系统提示词</span>角色设定、规则——“你是一个智能体小管家……”</div>' +
              '<div class="pf-step"><span class="pf-step-tag">工具定义</span>可用的工具清单——天气查询、计算器、搜索……</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 每一轮都在场、内容不变——就是书桌上那本<b>规则手册</b>，永远摆在桌面上（也永远占着一份固定空间，约 800 token）：它是“永远不能丢”的那一块。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("chat", 16) + '<span>轨迹（每轮增长）</span>' +
              '<span class="pf-chan">越聊越长</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">用户消息</span>用户说了什么</div>' +
              '<div class="pf-step"><span class="pf-step-tag">模型回复 / 工具结果</span>Agent 想过什么、做过什么、看到了什么</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 轨迹越长，Agent“记得”越多，但 Token 也越花越多——满了就得压缩。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手演示 */
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 动手演示：多轮对话，看轨迹增长</div>' +
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
            U.icon("alert", 16) + ' <b>上下文窗口警告！</b>轨迹已接近模型的上下文窗口上限（如 128K token）。继续增长会导致：①早期对话被截断丢失；②推理成本上升；③响应变慢。<b>工程解决方案：</b>轨迹摘要（Summarization）、滑动窗口（Sliding Window）、向量检索（RAG）——只把相关历史放进上下文。' +
          '</div>' +
        '</div>' +
        '<div class="tx-points">' +
          '<div class="tx-point">' + U.icon("scale", 15) + '<div class="tx-point-txt"><b>成本权衡：</b>轨迹越长，每一轮要“重新读一遍”的内容就越多——Token 花费和响应时间都会上涨。所以计划不是拆得越细越好、循环也不是越多越好：<b>够用就好</b>。</div></div>' +
          '<div class="tx-point">' + U.icon("timer", 15) + '<div class="tx-point-txt"><b>和停止条件配套：</b>轨迹增长必须设上限（最多几轮 / 最多花多少），到线就收尾或转人工——这就是自主 Agent 的“预算意识”。</div></div>' +
        '</div>' +
        '<div class="tip" style="margin-top:10px">' + U.icon("book", 16) + ' <b>ai-agent-book 消融实验发现：</b>工具执行结果（Tool Results）是闭环控制的关键，缺失它会让 Agent“盲目”执行；历史消息防止冗余操作；思考过程在可从结果重建时可丢弃。各组件并不同等重要！</div>' +
        '<div class="pf-kit-head">' + U.icon("timer", 16) + ' 第二个边界：什么时候该停？——停止条件（Stopping Criteria）</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("timer", 16) + '<span>三类停止条件</span>' +
              '<span class="pf-chan">成功 / 超限 / 失败</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">成功</span>任务完成、交付结果——调用“最终输出”收尾</div>' +
              '<div class="pf-step"><span class="pf-step-tag">超限</span>达到最大轮数 / 时间 / 花费上限——到线就停，不再空转</div>' +
              '<div class="pf-step"><span class="pf-step-tag">失败</span>遇到不可恢复的错误——如实上报，转人工处理</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 生产做法：以“任务完成信号”为主，再加一条<b>硬上限</b>兜底（例如 12~15 轮）。只设成功条件，模型可能自认为没完成而一直循环。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("scale", 16) + '<span>为什么必须设上限</span>' +
              '<span class="pf-chan">时间和钱都在转</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">每轮都要重读上下文</span>轨迹越长，单轮越贵</div>' +
              '<div class="pf-step"><span class="pf-step-tag">跑偏的循环不会自己停</span>重复尝试 → 失败 → 再尝试，费用成倍上涨</div>' +
              '<div class="pf-step"><span class="pf-step-tag">人也要能兜底</span>超限后转人工，比“永远转下去”更可控</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 一句口诀：能自己判断“做完了”就判完成；判断不了，就给一条硬上限。</div>' +
          '</div>' +
        '</div>' +
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 动手：最大迭代轮数该设多少？</div>' +
        '<div id="pl-stop-demo"></div>' +
        /* 第三个边界：不是“停不下来”，而是“停得太早/假装做完了” */
        '<div class="pf-kit-head">' + U.icon("alert", 16) + ' 第三个边界：小心的不是“停不下来”，而是“假完成”</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("alert", 16) + '<span>三种“假完成”</span>' +
              '<span class="pf-chan">看起来结束了，其实没有</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">① 偷懒式假完成</span>只做了最容易的一步，就说“任务完成”</div>' +
              '<div class="pf-step"><span class="pf-step-tag">② 过早放弃</span>碰到一点阻碍就宣布“做不到”，其实还有别的办法</div>' +
              '<div class="pf-step"><span class="pf-step-tag">③ 假成功</span>结果是自己编的、检查也没做，却报告“已完成”</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 一句口诀：<b>模型可以“提出”完成，但不能“批准”自己的完成。</b>完成要由验收标准来判——这正是前面说的“每一步都要有完成标准”的用处。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("shield", 16) + '<span>怎么防</span>' +
              '<span class="pf-chan">三道关</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">看证据</span>每一步都要有“看得见”的产物：查询结果、文件、清单打勾——口说无凭</div>' +
              '<div class="pf-step"><span class="pf-step-tag">独立检查</span>让不共享上下文的审核者（或程序规则）来判定完成，而不是自己说自己行</div>' +
              '<div class="pf-step"><span class="pf-step-tag">如实上报</span>真的做不到时，说清“卡在哪一步 + 试过什么 + 还能怎么试”，不编造结果</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 这也是为什么“循环的上限”和“完成的判据”要配成一对：上限防停不下来，验收标准防停得太早。</div>' +
          '</div>' +
        '</div>' +
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 动手判断：这是哪一种“假完成”？</div>' +
        '<div class="game-box" id="pl-falsedone"></div>'
      ) +

      /* ⑪ 任务清单（TODO）：把计划放在一眼能看到的地方（承接“轨迹”，ai-agent-book 第 2 章） */
      LP.card("plan", "实验：任务清单（TODO）——把计划放在一眼能看到的地方",
        "ReAct 每转一圈，轨迹都在变长，原来的计划很容易被“顶”到后面看不见。工程上的办法很朴素：把<b>待办清单</b>放在 AI 每轮都能瞥一眼的位置，做一项、划一项。先弄清原理，再看两栏同时开跑——有没有清单，差别有多大。",
        /* 区 1：原理 —— 状态栏 + 清单三要素 */
        '<div class="pf-kit-head">' + U.icon("archive", 16) + ' 原理：给 Agent 装一块“状态栏”</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("archive", 16) + '<span>为什么要清单</span>' +
              '<span class="pf-chan">像手机顶部的状态栏</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">问题</span>对话越久，最早的“原始诉求”就被挤到后面——AI 容易忘记、重复劳动、漏掉子任务</div>' +
              '<div class="pf-step"><span class="pf-step-tag">办法</span>把清单（待办表）<b>每轮都带上</b>，放在轨迹末尾这种“一眼能看到”的位置</div>' +
              '<div class="pf-step"><span class="pf-step-tag">效果</span>随时知道：做过什么、还剩什么、现在该做哪一项</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 就像手机顶部的状态栏：不看内容，也能一眼知道时间、电量、信号——Agent 也需要这样一块“现在做到哪了”。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("check", 16) + '<span>一条清单长什么样</span>' +
              '<span class="pf-chan">三样东西</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">① 做什么</span>一句话说清这一步的目标（"设置提醒"）</div>' +
              '<div class="pf-step"><span class="pf-step-tag">② 什么状态</span>待办 / 进行中 / 已完成 / 已取消——完成了就打勾</div>' +
              '<div class="pf-step"><span class="pf-step-tag">③ 结果与下一步</span>拿到什么（"已设好 20:00 提醒"）、接下来做什么</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("check", 13) + ' 清单还是<b>停止条件</b>的判据：清单全部打勾 + 证据齐全，才允许交付。</div>' +
            '<div class="pf-note">' + U.icon("book", 13) + ' <b>ai-agent-book 实测（第 2 章）：</b>开启待办清单，平均 <b>15 轮</b>就把任务做完；关掉清单要 <b>21 轮</b>，而且经常会漏掉子任务。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手（双轨推进） */
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 动手实验：同一件事，有没有清单差多少？</div>' +
        '<div class="game-box" id="pl-todo"></div>'
      ) +

      /* ⑫ 两种规划范式：Plan-and-Execute vs ReAct */
      LP.card("plan", "两种规划范式：Plan-and-Execute vs ReAct",
        "同一个任务，有两种做法：<b>先列完计划再执行</b>，还是<b>边做边调整</b>？先看两种范式的对照，再给下面每个任务选最合适的。",
        /* 区 0：图示 —— 两条时间线并排看（左图右解，与感知器原理图同一版式） */
        '<div class="ta-duo">' +
          '<div class="ta-image-wrap">' +
            '<img src="images/plan-paradigms.svg" alt="两种规划范式对比图：上面是 Plan-and-Execute（先写出整条计划再执行），下面是 ReAct（思考↔行动↔观察来回交替）" class="ta-image">' +
            '<div class="ta-source">📐 本教学系统绘制 · Plan-and-Execute vs ReAct</div>' +
          '</div>' +
          '<div class="ta-explain">' +
            '<div class="te-title">📖 判断只看一条：步骤会不会因为中间结果而改变？</div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">Plan-and-Execute</span>步骤基本固定、不容易中途变化——<b>先想全，再动手</b>（如“按流程办一件事”）</div>' +
              '<div class="pf-step"><span class="pf-step-tag">ReAct</span>不知道下一步会遇到什么、要看结果再决定——<b>走一步看一步</b>（如“帮我查一个问题”）</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 真实系统常常<b>混着用</b>：大方向先规划，具体每一步边走边看。</div>' +
          '</div>' +
        '</div>' +
        /* 区 1：原理 —— 两种范式对照 */
        '<div class="pf-kit-head">' + U.icon("target", 16) + ' 原理：两种范式，各有各的用武之地</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("archive", 16) + '<span>Plan-and-Execute</span>' +
              '<span class="pf-chan">先计划，后执行</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">怎么走</span>一次性列完所有步骤，再按顺序执行</div>' +
              '<div class="pf-step"><span class="pf-step-tag">适合</span>确定性任务：做饭流程、固定报表——步骤不会变</div>' +
              '<div class="pf-step"><span class="pf-step-tag">不适合</span>需要根据中间结果调整的任务</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 优点：计划可以先给你审、可检查；缺点：遇到意外不会变通。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("refresh", 16) + '<span>ReAct</span>' +
              '<span class="pf-chan">边想边做，动态调整</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">怎么走</span>思考→行动→观察→再思考，每步都根据反馈调整</div>' +
              '<div class="pf-step"><span class="pf-step-tag">适合</span>不确定任务：搜索调研、故障排查——走一步看一步</div>' +
              '<div class="pf-step"><span class="pf-step-tag">不适合</span>步骤完全固定、不需要反馈的任务</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 优点：灵活、能应变；缺点：整体计划性弱，花掉的 token 更多。</div>' +
          '</div>' +
        '</div>' +
        '<div class="tip tip-info" style="margin:0 0 14px">' + U.icon("spark", 15) + ' <b>一句话选范式：</b>任务确定、想先审计划 → Plan-and-Execute；任务不确定、要靠反馈 → ReAct。</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("happy", 16) + '<span>打个比方</span>' +
              '<span class="pf-chan">侦探 vs 建筑师</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">ReAct = 侦探</span>走一步、查一步：查到什么，再决定下一步去哪问谁</div>' +
              '<div class="pf-step"><span class="pf-step-tag">Plan-and-Execute = 建筑师</span>先把蓝图（计划）画完整，再按图纸施工</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 侦探更快适应意外，建筑师更稳更可检查——所以真实系统常常“先出蓝图，遇到意外临时改图”。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("alert", 16) + '<span>一个反直觉的发现</span>' +
              '<span class="pf-chan">瓶颈在规划者</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">发现</span>“规划 + 执行”分工时，<b>规划得差的那一环</b>才是整个系统的瓶颈——执行再强，也救不回一份错计划</div>' +
              '<div class="pf-step"><span class="pf-step-tag">结论</span>最聪明的模型、最用心的提示词，要优先留给“规划”这一步</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("book", 13) + ' <b>ai-agent-book 第 10 章：</b>“在 Planner-Executor 架构中，弱规划者是整个系统最关键的瓶颈。”</div>' +
            '<div class="pf-note">' + U.icon("gear", 13) + ' 选型也讲“从简单到复杂”：能一次问完的，不必搭 Agent；步骤固定的，用固定流程最稳；只有会随结果改变的，才值得上自主 Agent（进阶课堂「编排选型」有练习）。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手（组件自带标题） */
        '<div class="game-box" id="pl-paradigm">' +
          '<div id="pl-pg-flow"></div>' +
        '</div>'
      ) +

      /* ⑬ 失败与反思（Reflection）+ 计划自检（合并：先反思，再看两种 Agent 的差别） */
      LP.card("plan", "失败与反思（Reflection）：计划错了怎么办？",
        "ai-agent-book 指出：自主 Agent 需要能识别失败、调整策略，而不是出错就停下来。先看清反思循环与失败分类，再做两个实验：这些失败案例你会怎么救、同一个失败两种 Agent 差在哪一步。",
        /* 区 1：原理 —— 反思循环四步 */
        '<div class="pf-kit-head">' + U.icon("refresh", 16) + ' 原理：反思循环——把错误变成经验</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("refresh", 16) + '<span>四步走一圈</span>' +
              '<span class="pf-chan">识别 → 分析 → 调整 → 重试</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">① 识别失败</span>发现结果不对——报错、测试失败、结果偏离目标</div>' +
              '<div class="pf-step"><span class="pf-step-tag">② 分析原因</span>为什么会错——假设错了？工具选错了？参数不对？</div>' +
              '<div class="pf-step"><span class="pf-step-tag">③ 调整计划</span>只改出问题的那一步——不是全部推翻重来</div>' +
              '<div class="pf-step"><span class="pf-step-tag">④ 重新执行</span>带着修正后的计划再试一次</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 反思的价值：不是“不犯错”，而是“犯了能自己修”——这是自主 Agent 的分水岭。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("alert", 16) + '<span>先分类：这个错该不该重试？</span>' +
              '<span class="pf-chan">不是所有错误都该重试</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">可重试</span>网络超时、服务 500、临时限流——换个数据源或等一会儿再试（必须设重试上限，例如 2~3 次）</div>' +
              '<div class="pf-step"><span class="pf-step-tag">参数错</span>工具选对了、参数传错了（“下午 3 点”传成 3:00）——修正参数后再试一次</div>' +
              '<div class="pf-step"><span class="pf-step-tag">不可恢复</span>没权限、账号欠费、需求本身就做不到——停下来如实告诉用户，别硬试</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 工程上一定会配<b>重试上限 + 降级方案 + 转人工</b>，否则 Agent 会在同一个坑里反复烧钱。</div>' +
            '<div class="pf-note">' + U.icon("shield", 13) + ' <b>怎么知道“没进展”？两把尺子：</b>① <b>重复调用指纹</b>——同一个工具配上同样的参数，又来了一遍，就是原地打转；② <b>连续失败计数</b>——同一个动作连着失败到上限（生产经验值约 3 次）就熔断，不再硬试。就像电路短路时保险丝跳闸：停一下，比烧掉整条线好。</div>' +
            '<div class="pf-note">' + U.icon("book", 13) + ' <b>反思也要“讲证据”：</b>反思本身不是证据——只有和环境结果对得上（试验通过、数据核对正确），才算真的经验；否则错误的心得会一直污染后面的判断。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手 */
        '<div class="pf-kit-head">' + U.icon("target", 16) + ' 动手判断：这些失败案例，该怎么救？</div>' +
        '<div class="game-box" id="pl-fail">' +
          '<div id="pl-fl-flow"></div>' +
        '</div>' +
        '<div class="pf-kit-head">' + U.icon("refresh", 16) + ' 动手二：同一个失败，两种 Agent 的差别</div>' +
        /* 区 1：原理 —— 实验看点 */
        '<div class="pf-kit-head">' + U.icon("target", 16) + ' 原理：两种 Agent 的差距在哪一步？</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("alert", 16) + '<span>关掉反思的 Agent</span>' +
              '<span class="pf-chan">出错就停</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">出错后</span>停住，或者机械重试——重复同样的错</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 不能上线：每一个意外都要人来救。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("refresh", 16) + '<span>开启反思的 Agent</span>' +
              '<span class="pf-chan">出错能自己修</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">出错后</span>分析原因 → 修正计划 → 再试一次</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 能上线：意外由 Agent 自己消化，人只看最终结果。</div>' +
          '</div>' +
        '</div>' +
        '<div class="tip tip-info" style="margin:0 0 14px">' + U.icon("spark", 15) + ' <b>观察重点：</b>切换开关时，盯住“失败之后的第二步”——两种 Agent 的差距全在那里。</div>' +
        /* 区 2：动手 */
        U.predict({
          id: "pl-reflect",
          color: "plan",
          q: "先猜一猜：天气工具报 500 时，“关掉反思”的 Agent 会怎么回复？",
          opts: [
            { k: "a", t: "如实说“没查到”" },
            { k: "b", t: "编一个“明天北京晴，25℃”" },
            { k: "c", t: "自动换一个数据源重试" }
          ],
          ans: "b",
          why: "关掉反思，它就只拿到一句“工具失败了”，却<b>没有下一步该怎么办</b>——于是最容易走的那条路就是“编一个看起来合理的答案”。反思的价值不在“道歉”，而在<b>识别 → 分析 → 只改出问题的那一步 → 再试</b>。",
          hint: "想想：工具已经失败了，它手里还剩什么可用的东西？"
        }) +
        '<div id="pl-reflect"></div>' +
        '<div class="pf-note">' + U.icon("check", 13) + ' <b>小结：</b>反思不是“下次注意点”，而是<b>识别 → 分析 → 只改出问题的那一步 → 再试</b>；而且<b>反思本身不算证据</b>——要有独立可查的东西（日志、工具返回、复现步骤）才算数。</div>') +

      /* ⑭ 失败归因：反思之前，先找出“第一个出错的步骤”（ai-agent-book 第 7 章） */
      LP.card("plan", "实验：失败归因——第一个出错的步骤在哪？",
        "要反思，先得知道<b>错在哪</b>。而失败记录里最响的那行报错，往往只是<b>后果</b>。先弄清“为什么要找第一个”，再到一份真实风格的执行日志里动手找一找。",
        /* 区 1：原理 —— 归因找的是“第一个” */
        '<div class="pf-kit-head">' + U.icon("search", 16) + ' 原理：为什么找“第一个”，而不是“最后一个”？</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("alert", 16) + '<span>改最后一行＝给症状贴创可贴</span>' +
              '<span class="pf-chan">末次报错只是后果</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">第一步走偏</span>某个数字算错、某步该做没做——从这一行起，后面全歪了</div>' +
              '<div class="pf-step"><span class="pf-step-tag">后面全是后果</span>基于错误前提继续做事：越做越像样，也越离谱</div>' +
              '<div class="pf-step"><span class="pf-step-tag">最后才报错</span>“发送失败”“校验不通过”——只是问题终于露头的地方</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 只修最后一步，问题会换个地方再冒出来——所以归因要找<b>第一个</b>导致偏离的错误。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("target", 16) + '<span>怎么找：从前往后</span>' +
              '<span class="pf-chan">三步 + 记四样</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">① 先看“对不对”</span>结果、证据、校验：哪一步之后开始“不对劲”</div>' +
              '<div class="pf-step"><span class="pf-step-tag">② 从第一步往下看</span>第一处和事实不符的地方，就是它——哪怕它当时没有报错</div>' +
              '<div class="pf-step"><span class="pf-step-tag">③ 再决定怎么改</span>只重做受影响的那几步，不一定要整条推翻</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("check", 13) + ' <b>记录四样：</b>第几步 / 用了什么工具 / 证据是什么 / 根因与后果——写下来，才能沉淀成“下次别踩的坑”。</div>' +
            '<div class="pf-note">' + U.icon("gear", 13) + ' 工程做法：先用规则筛“一眼能认的”（格式错、结果为空、超时），再让模型在轨迹里定位第一处偏离；<b>静默失败</b>（没报错但结果不对）最需要靠事实比对找出来。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手（点选日志里的“第一个错”） */
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 动手：这份执行日志里，第一个出错的步骤是哪一行？</div>' +
        '<div class="game-box" id="pl-attrib"></div>' +
        '<div class="tip tip-info">' + U.icon("book", 16) + ' <b>归因是反思的前一站：</b>先定位“第一个错”，反思才有具体对象——否则反思容易变成“下次注意一点”这种空话。</div>'
      ) +

      /* ⑮ 提议者-审核者：承接“自己看不到自己的错” */
      LP.card("plan", "进阶模式：提议者-审核者（Proposer-Reviewer）",
        "ai-agent-book 第 1 章命名的重要模式：产出与评判由<b>两个不共享上下文的角色</b>分别承担。先弄清<b>为什么不能自审</b>，再看现场演示。<b>没配 Key 也能上课</b>——会改用内置示例，把完整的“提议 → 审核”流程演示一遍。",
        /* 区 1：原理 —— 为什么自审不可靠 / 怎么分工 */
        '<div class="pf-kit-head">' + U.icon("users", 16) + ' 原理：为什么“自己审自己”不可靠？</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("alert", 16) + '<span>自审的两个盲区</span>' +
              '<span class="pf-chan">为什么不能自审</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">认知盲区</span>犯错的思路和检查的思路是同一套——看不到自己的错</div>' +
              '<div class="pf-step"><span class="pf-step-tag">顺着自己走</span>同一上下文里，模型倾向于认为自己的产物没问题</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 就像自己检查作业容易漏——不是不认真，是“看不见”。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("users", 16) + '<span>两个角色怎么分工</span>' +
              '<span class="pf-chan">Proposer / Reviewer</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">提议者</span>负责生成——一份计划、一段代码、一篇作文</div>' +
              '<div class="pf-step"><span class="pf-step-tag">审核者</span>独立评判——只看产物本身，不看提议者的推理过程</div>' +
              '<div class="pf-step"><span class="pf-step-tag">关键：不共享上下文</span>审核者不知道“为什么这样写”，才能给出独立视角</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 生成与评判分离，是真实 Agent 系统的常见架构。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手演示 */
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 现场演示：一个 AI 生成，另一个 AI 审核</div>' +
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
        '<div class="tip" style="margin-top:10px">' + U.icon("book", 16) + ' <b>ai-agent-book 原文：</b>“它成立的前提是自审不可靠：同一个上下文中的模型难以发现自己的认知盲区。”审核者只看产物本身（渲染结果、测试输出），不看提议者的推理过程，从而提供独立视角。</div>' +
        '<div class="tip" style="margin-top:8px">' + U.icon("microscope", 16) + ' <b>这不是猜的，是做实验得出的结论：</b>让大模型在<b>没有任何外部反馈</b>的情况下“自己审查自己再改”，准确率反而会下降；只有审核者能拿到<b>独立的证据</b>（真的跑一遍测试、真的核对数据），审查才真的有用。所以“独立视角 + 可验证的证据”，缺一不可。</div>'
      ) +

      /* ⑯ 综合演练：从需求到完成，把整条链走一遍 */
      LP.card("plan", "综合演练：从一个模糊需求到任务完成",
        "把前面学的串成一条线：<b>说清楚 → 拆解 → 排序 → 写成清单 → 执行（ReAct）→ 归因反思 → 交付质检</b>。同一个任务闯 7 关，每一关都是这条链上的一个环节——选对了才继续。",
        '<div class="pf-kit-head">' + U.icon("target", 16) + ' 演练任务：帮班级办一次“期末联欢会”</div>' +
        '<div class="tip tip-info" style="margin:0 0 14px">' + U.icon("info", 15) + ' <b>玩法：</b>一题一题往下走，每答对一关都能看到“为什么”。7 关走完，你就把规划器的完整工作流走了一遍。</div>' +
        '<div class="game-box" id="pl-e2e-flow"></div>'
      ) +

      /* ⑰ 小测验 */
      LP.card("plan", "小测验：你是规划小达人吗？", "共 " + QUIZ.length + " 题，答对一题加一颗星！",
        '<div class="game-box" id="pl-quiz"><div id="pl-quiz-body"></div></div>' +
        '<div class="score-line"><span class="score-badge" id="pl-quiz-score" data-score="0">★ 0</span><button class="btn btn-ghost btn-sm" id="pl-quiz-restart">重来</button></div>'
      ) +

      /* ⑱ 进阶原理互动课堂 */
      LP.card("plan", "进阶原理互动课堂：规划器在真实 AI 系统里是什么？（ai-agent-book 第 1/2/5/6/7/10 章）",
        "15 个真实工程概念（ai-agent-book + hello-agents）：<b>左边选概念，右边看讲解 + 动手实验</b>——每个都配「一句话 / 打个比方 / 真实系统 / 动手做 / 自检一问」。",
        AgentLab.Adv.panelHTML({ key: "plan", concepts: plConcepts() }), { id: "pl-adv" }) +

      /* 课堂小结（收尾：全章总结放最下面，与其它实验室保持一致） */
      '<div class="lesson-summary card-plan">' +
        '<h3>' + U.icon("check", 18) + ' 课堂小结（L07+L08）</h3>' +
        '<div class="summary-core"><b>核心结论：</b>规划器 = 理解意图 + 拆解任务 + 排序步骤 + 写成清单 + 选择工具，在 <b>ReAct 循环</b>（思考→行动→观察）中动态调整。高级规划还需要思维链（想清楚）、清单/状态栏（不忘记）、失败归因（先找第一个错）、双 Agent 审查（防自欺）、反思纠错（从失败中学习）。</div>' +
        '<div class="summary-points">' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("target", 14) + '</span><div><b>规划器三法宝与 ReAct：</b>拆解（大任务→小步骤）、排序（排好先后顺序）、执行（调工具+看结果）；ReAct 循环=思考→行动→观察，每轮把工具结果追加到轨迹</div></div>' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("archive", 14) + '</span><div><b>计划要能被“执行”：</b>每一步写清「做什么 + 用什么工具 + 完成标准」，程序才能解析、执行、校验；解析失败要有兜底，<b>宁可空、不可编</b>；把清单放在一眼能看到的位置（状态栏/TODO），就少重复、少漏项</div></div>' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("gear", 14) + '</span><div><b>两种规划范式：</b>Plan-and-Execute（先计划后执行，适合确定性任务；像建筑师先画蓝图）vs ReAct（边想边做、根据观察动态调整，像侦探走一步查一步）；规划得差的那一环才是系统瓶颈；实际系统常混合使用</div></div>' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("brain", 14) + '</span><div><b>思维链与工具选择：</b>CoT 让模型显式输出推理过程，减少跳步错误；工具选择决策=理解意图→匹配工具能力→构造参数→执行→看结果；工具一多就要分层整理（描述清楚，才选得准）</div></div>' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("search", 14) + '</span><div><b>先归因、再反思：</b>失败时先找<b>第一个</b>出错的步骤（末次报错往往只是后果），记录「第几步 / 哪个工具 / 证据 / 根因与后果」；再用反思四步（识别→分析→调整→重试）修计划，而不是给症状贴创可贴</div></div>' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("refresh", 14) + '</span><div><b>双 Agent 与反思：</b>提议者-审核者（生成与审查分离，自审不可靠，且要有可验证的独立证据）；反思=失败后分析原因→调整策略→重新执行；上下文轨迹（=消息历史）为反思提供依据</div></div>' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("check", 14) + '</span><div><b>清晰描述四要素：</b>请规划器办事要说清：做什么 / 给谁什么时候 / 输出什么格式 / 能用哪些工具——要素越全，计划越能直接执行</div></div>' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("shield", 14) + '</span><div><b>边界与预算（能上线的关键）：</b>信息不足先澄清、危险操作先请示；越界或涉及隐私的子任务在<b>规划阶段</b>就要拦掉；失败先分类（可重试 / 参数错 / 不可恢复），并配“重复调用指纹 + 连续失败熔断”；给循环设<b>硬上限</b>（最多几轮 / 最多花多少）；警惕三形态“假完成”——<b>模型可以提出完成，但不能批准自己的完成</b></div></div>' +
        '</div>' +
        '<div class="summary-think"><b>课后思考：</b>请设计一个“帮我规划周末一天”的 Agent：① 把计划写成带「完成标准」的清单；② 它需要哪些工具？③ 如果它的计划执行失败了（比如餐厅关门了），怎么先找到“第一个出错的步骤”，再反思和调整？</div>' +
      '</div>';


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

    /* 新增配套实验 + 进阶原理互动课堂 */
    bindPlTree();
    bindPlDep();
    bindPlReflect();
    bindPlPrompt();
    bindPlPlanRun();   /* ⑥ 计划要能被“执行”：清单计划 vs 一段话计划 */
    bindPlAdv();

    /* ⑩ 循环的边界：停止条件滑条 + 三形态“假完成” */
    bindPlStop();
    bindPlFalseDone();

    /* ⑪ 任务清单（TODO）：把计划放在一眼能看到的地方 */
    bindPlTodo();

    /* ⑭ 失败归因：找第一个出错的步骤 */
    bindPlAttrib();

    /* ⑬ 综合演练（端到端 6 关） */
    bindE2E();
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

  /* ---------- ④ 魔法句式对比：题库 ----------
   * 选题的关键：必须是一个「光看一句话根本没法办事」的多步骤任务。
   * 原来只有一道「组织一次班级义卖活动」——比完一次就没得比了，
   * 也无法判断“说清楚就更做得到”是不是普遍规律，所以攒成 5 道可换的题。
   * 每道题都刻意设计成「四步 + 每步都有硬要求」：
   *   ① 要准备什么（可数）      ② 谁负责什么（4 人分工）
   *   ③ 几个具体时间点（可数）  ④ 一条标语 / 理由 / 提示（不提就不给）
   * 换题时必须保证「模糊说法」那边是货真价实的套话——不给步骤和要求，
   * AI 只能给放之四海皆准的空话（“先确定时间地点，再安排分工……”）；
   * 一旦把目标、步骤、顺序、每段要求说清，产出立刻变成能照着执行的方案。
   * 字段说明：
   *   name           任务名（讲评时用）
   *   vague / clear  两种说法（任务完全相同，只有说法不同）
   *   itemTxt/itemRe 第 1 项：要准备的物品 / 项目
   *   roleRe         第 2 项：4 人分工的具体角色（只认角色名，要点名 ≥2 个才算说清）
   *   extra          第 4 项：不提就不会出现的那条“额外产物”（宣传语 / 理由 / 口号 / 祝福 / 提示）
   *   fluff          模糊说法那侧通常会给的套话（写在检查表下方，讲评时用） */
  var MAGIC_BANK = [
    {
      name: "班级义卖活动",
      vague: "帮我组织一次班级义卖活动。",
      clear: "请你帮我规划一次班级义卖活动，按下面四步给出方案：" +
        "第一步，列出要准备的物品，至少 3 类；" +
        "第二步，安排 4 位同学的分工（收银、叫卖、记账、场地）；" +
        "第三步，排出当天的流程，至少 4 个时间点；" +
        "第四步，写一条 30 字以内的宣传语。",
      itemTxt: "要准备哪些物品",
      itemRe: /(物品|准备|清单|需要带|要带|摆摊|货品)/,
      roleRe: /(收银|收钱|叫卖|吆喝|记账|记帐|记录|场地|看摊)/,
      extra: "宣传语 / 口号",
      extraRe: /(宣传语|口号|标语)/,
      fluff: "先确定时间和地点，再安排同学分工……"
    },
    {
      name: "班级读书分享会",
      vague: "帮我办一次班级读书分享会。",
      clear: "请你帮我策划一次班级读书分享会，按下面四步给出方案：" +
        "第一步，列出要准备的物品，至少 3 类；" +
        "第二步，安排 4 位同学的分工（主持、计时、记录、拍照）；" +
        "第三步，排出当天流程，至少 4 个时间点；" +
        "第四步，推荐 3 本适合五年级同学读的书，每本写一句推荐理由。",
      itemTxt: "要准备哪些物品",
      itemRe: /(物品|准备|清单|布置|会场|道具|书签|桌椅)/,
      roleRe: /(主持|计时|掐表|记录|拍照|摄影)/,
      extra: "推荐理由",
      extraRe: /(推荐理由|理由是|推荐语|理由[:：])/,
      fluff: "先定好书目和时间，再安排同学分工……"
    },
    {
      name: "班级运动会",
      vague: "帮我组织一次班级运动会。",
      clear: "请你帮我安排一次班级运动会，按下面四步给出方案：" +
        "第一步，确定 3 个比赛项目；" +
        "第二步，安排 4 位同学的分工（裁判、计时、记录、后勤）；" +
        "第三步，排出当天流程，至少 4 个时间点；" +
        "第四步，写一条 30 字以内的加油口号。",
      itemTxt: "有哪些比赛项目和要准备的东西",
      itemRe: /(比赛|项目|准备|器材|道具|物品|场地)/,
      roleRe: /(裁判|计时|掐表|记录|后勤|计分)/,
      extra: "加油口号",
      extraRe: /(口号|加油|标语)/,
      fluff: "先确定时间地点和项目，再安排同学分工……"
    },
    {
      name: "班级生日会",
      vague: "帮我准备一次班级生日会。",
      clear: "请你帮我准备一次班级生日会，按下面四步给出方案：" +
        "第一步，列出要准备的物品，至少 3 类；" +
        "第二步，安排 4 位同学的分工（布置、主持、分发、拍照）；" +
        "第三步，排出当天的流程，至少 4 个时间点；" +
        "第四步，写一条 30 字以内的祝福语。",
      itemTxt: "要准备哪些物品",
      itemRe: /(物品|准备|清单|布置|气球|蛋糕|零食|装饰)/,
      roleRe: /(布置|装饰|主持|分发|派发|拍照|摄影)/,
      extra: "祝福语",
      extraRe: /(祝福|祝词|心愿|祝你们|祝大家)/,
      fluff: "先确定时间地点，再准备蛋糕和气球……"
    },
    {
      name: "班级春游",
      vague: "帮我安排一次班级春游。",
      clear: "请你帮我安排一次班级春游，按下面四步给出方案：" +
        "第一步，列出要带的物品，至少 3 类；" +
        "第二步，安排 4 位同学的分工（领队、安全员、拍照、后勤）；" +
        "第三步，排出当天流程，至少 4 个时间点；" +
        "第四步，写一条 20 字以内的安全提示。",
      itemTxt: "要带哪些物品",
      itemRe: /(物品|准备|清单|要带|需要带|背包|水壶|物资)/,
      /* 角色写成“安全员”：否则“注意安全”这句套话会被当成“点了安全这个角色” */
      roleRe: /(领队|带队|安全员|拍照|摄影|后勤)/,
      extra: "安全提示",
      /* 春游这道题的“额外产物”必须是真的安全要求：只丢一句“注意安全”不算，
       * 得写出带冒号的提示或具体禁止事项（“不要单独行动”“不乱跑”）。 */
      extraRe: /(安全提示|安全第一|注意事项|注意安全[:：]|不(要|能|准|得|单独|乱|可)[^，。\n]{2,})/,
      fluff: "先确定出发时间和地点，再安排同学分工……"
    }
  ];

  /* ---------- ④ 魔法句式对比 ---------- */
  function bindCompare() {
    var qi = 0;
    function curQ() { return MAGIC_BANK[qi]; }
    var nextBtn = $("pl-cmp-next");

    /* 换题 / 初始渲染：把当前任务的两种说法写进两栏，并清空上一次的结果 */
    function paintQuestion() {
      var q = curQ();
      var q1 = $("pl-cmp-q1"), q2 = $("pl-cmp-q2");
      if (q1) q1.textContent = "说法：" + q.vague;
      if (q2) q2.textContent = "说法：" + q.clear;
      if ($("pl-ans-vague")) $("pl-ans-vague").innerHTML = '<span style="color:var(--c-sub)">还没有提问……</span>';
      if ($("pl-ans-clear")) $("pl-ans-clear").innerHTML = '<span style="color:var(--c-sub)">还没有提问……</span>';
      if ($("pl-cmp-table")) $("pl-cmp-table").innerHTML = "";
      if ($("pl-cmp-fb")) $("pl-cmp-fb").innerHTML = "";
      refreshModelBar();   // 换题时顺带刷新“当前用的是哪个模型”
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        qi = (qi + 1) % MAGIC_BANK.length;
        paintQuestion();
      });
    }

    $("pl-cmp").addEventListener("click", async function () {
      var btn = $("pl-cmp");
      var q = curQ();   // 当前这道题：两种说法、检查规则都由它决定
      var vague = $("pl-ans-vague");
      var clear = $("pl-ans-clear");
      var tableBox = $("pl-cmp-table");
      var fb = $("pl-cmp-fb");

      /* 把一次请求结果显示到框里：
       * ① 大模型的输出本身是 Markdown → 走 U.md 渲染（含公式），不再是密密麻麻的原文；
       * ② 空回答（模型没吐内容 / 只返回了推理）给明确提示，避免出现“空白框”；
       * ③ 失败时把原因写清楚。 */
      function fill(el, r) {
        if (r.status !== "fulfilled") {
          el.innerHTML = '<span style="color:var(--c-exe-deep)">出错了：' +
            U.esc((r.reason && r.reason.message) || "网络问题") + "</span>";
          return;
        }
        var text = String(r.value == null ? "" : r.value).trim();
        if (!text) {
          el.innerHTML = '<span style="color:var(--c-sub)">（AI 这次没有返回内容，请再点一次「同时问两种说法」）</span>';
          return;
        }
        try {
          el.innerHTML = '<div class="md-body">' + U.md(text) + "</div>";
        } catch (e) {
          el.textContent = text;   // 渲染失败退化为纯文本，保证回答一定可见
        }
      }

      btn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      vague.innerHTML = '<span style="color:var(--c-sub)">提问中……</span>';
      clear.innerHTML = '<span style="color:var(--c-sub)">提问中……</span>';
      if (fb) fb.innerHTML = "";
      if (tableBox) tableBox.innerHTML = "";

      try {
        /* 优先用硅基流动的小模型（和思维链实验同一个）：小模型对“有没有说清楚”更敏感，
         * 模糊说法那边更容易给出糟糕的回答，对比更明显。没填它的 Key 则退回 DeepSeek 大模型。
         * 两种说法用的是同一个模型、同样的输出上限，保证公平。 */
        var useSmall = !!(AgentLab.API.hasCloudKey && AgentLab.API.hasCloudKey());
        var askFn = useSmall ? AgentLab.API.askSmall : AgentLab.API.ask;
        /* 用 askSide 包一层：某一侧偶发“空返回”时自动单独重试，避免一侧空白 */
        var results = await Promise.allSettled([
          AgentLab.Adv.askSide("你是班级小管家。", q.vague, askFn, { maxTokens: 1500 }),
          AgentLab.Adv.askSide("你是班级小管家。", q.clear, askFn, { maxTokens: 1500 })
        ]);
        fill(vague, results[0]);
        fill(clear, results[1]);

        /* 客观评价：逐项检查两个回答（全部是可数指标，不靠“感觉”） */
        var okAll = results[0].status === "fulfilled" && results[1].status === "fulfilled";
        if (tableBox) {
          tableBox.innerHTML = okAll ? AgentLab.Adv.checklistHTML({
            rows: plMagicRows(results[0].value, results[1].value, q),
            leftLabel: "模糊说法",
            rightLabel: "魔法句式",
            note: "这几项都是<b>能数出来</b>的硬指标：有没有说清要准备什么、谁负责什么、几个具体时间，有没有写「" + q.extra + "」，有没有分条。<br>" +
              "关键看第 3、4 项——<b>你不提，AI 就不会给你</b>：光说“" + q.vague + "”，它只会讲套话（" + q.fluff + "），根本不会自己排出具体时间点，也不会主动写「" + q.extra + "」。这就是魔法句式的价值。" +
              "<br>点「换一题」换一个任务再比一次：任务换了，“说清楚就更做得到”这条规律不会变。"
          }) : "";
        }
        if (fb) {
          fb.innerHTML = okAll
            ? '<span class="fb-ok">' + U.icon("happy", 16) + " 魔法句式 = 目标 + 步骤 + 顺序。这三样说清楚，AI 给出的就是“能直接照做”的安排。点「换一题」可以换个任务再比一次。</span>" +
              (useSmall
                ? '<div class="fb-ok" style="margin-top:8px">' + U.icon("check", 15) +
                  " 当前用的是<b>硅基流动的小模型</b>（" + U.esc(((AgentLab.CONFIG.cotModel || {}).label || "小模型")) + "），对“说没说清楚”更敏感。</div>"
                : '<div class="fb-no" style="margin-top:8px">' + U.icon("info", 15) +
                  " 当前用的是 DeepSeek 大模型（能力强，模糊说法也能猜个大概，差距不明显）。" +
                  "想让对比更明显，请到右上角「设置」填写<b>硅基流动的 Key</b>。</div>")
            : "";
        }
      } catch (e) {
        /* 兜底：任何意外都要让同学看到原因，并且还能再试一次 */
        var msg = '<span style="color:var(--c-exe-deep)">出错了：' +
          U.esc((e && e.message) || "未知错误") + "</span>";
        vague.innerHTML = msg;
        clear.innerHTML = msg;
      } finally {
        btn.disabled = false;
        if (nextBtn) nextBtn.disabled = false;
      }
    });

    /* 初始渲染：把第 1 道题的两种说法写进两栏，学生一眼就能看出差别在哪；
     * 同时显示“本实验当前用的是哪个模型” */
    paintQuestion();
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
  /* ---------- ⑥ 两种规划范式（单题闯关） ---------- */
  function bindParadigm() {
    var PARADIGM_OPTS = ["Plan-and-Execute", "ReAct", "两种都可以"];
    AgentLab.Quiz.mount({
      host: "pl-pg-flow",
      color: "plan",
      name: "规划范式小达人",
      shuffle: true,
      questions: PARADIGM_Q.map(function (q) {
        return {
          pre: "场景：" + U.esc(q.scene),
          q: "这个场景更适合哪种规划范式？",
          opts: PARADIGM_OPTS,
          ans: PARADIGM_OPTS.indexOf(q.correct),
          why: q.why
        };
      }),
      hint: "先判断：这个任务是“确定性”的，还是“要根据执行结果随时调整”的？"
    });
  }

  /* ---------- ⑦ 思维链实验：题库 ----------
   * 选题的四条原则（这是这个实验能不能“演出来”的关键）：
   *  ① 有一个「很诱人的错误答案」——直接问最容易一头栽进去；
   *  ② 正确解法必须有 2~3 步中间推理，跳过任何一步都会错；
   *  ③ 答案唯一、能自动判定，方便下面的达标表逐项打分；
   *  ④ 贴近五年级生活（爬楼梯 / 握手 / 年龄），不需要课外知识。
   * 字段说明：
   *  text       题干（两种问法完全一样，只有指令不同）
   *  answerText 正确答案（用于检查项文字）
   *  answerRe   答案判定（在“去掉空白”的文本上匹配）
   *  trap       这题最容易踩的坑（写在检查表下方的说明里，讲评时用）
   *  keys       两个「关键中间结论」的判定规则——直接问通常说不出这两句 */
  var COT_BANK = [
    {
      text: "一项工程，甲队单独做要 12 天完成，乙队单独做要 18 天完成。两队合做 4 天后甲队离开，剩下的由乙队单独做，乙队还需要多少天？",
      answerText: "8 天",
      answerRe: /(^|[^\d])8\s*(天|日)/,
      trap: "直接拿“剩下的工作量”去估，或者把合做效率算错（1/12 + 1/18 ≠ 2/30）",
      keys: [
        { re: /(5\s*\/\s*36)/, t: "算出两队合做一天完成 5/36" },
        { re: /(4\s*\/\s*9)/, t: "算出 4 天后还剩 4/9" }
      ]
    },
    {
      text: "一个数列：第 1 项是 3，从第 2 项起，每一项都等于前一项的 2 倍再加 1。这个数列的第 8 项是多少？",
      answerText: "511",
      answerRe: /(^|[^\d])511([^\d]|$)/,
      trap: "想一次就报出第 8 项（要连推 7 次，不落笔几乎必错）",
      keys: [
        { re: /(递推|前一项|每一项|第\s*[3-8]\s*项)/, t: "写明“每一项 = 前一项 × 2 + 1”的递推关系" },
        { re: /(63|127|255|2\s*\^\s*9|512\s*-\s*1|通项|规律)/, t: "写出中间项（…63、127、255）或归纳出通项" }
      ]
    },
    {
      text: "袋子里有 5 个红球和 3 个蓝球。不放回地连取 2 个，恰好取到 1 个红球和 1 个蓝球的概率是多少？请用最简分数作答。",
      answerText: "15/28",
      answerRe: /(15\s*\/\s*28)/,
      trap: "只算“先红后蓝”得到 15/56，漏掉“先蓝后红”这一种顺序",
      keys: [
        /* 这道题有两种正确解法，判定要都认：
         *   A 组合数法：C(8,2)=28（总取法），C(5,1)×C(3,1)=15（有利取法）
         *   B 顺序概率法：5/8×3/7 与 3/8×5/7 两种情况相加 */
        { re: /(28\s*种|C\s*\(?\s*8|样本空间|总的?取法|总的?可能|8\s*[×*x]\s*7)/,
          t: "先算出总取法 / 样本空间（28 种）" },
        { re: /(15\s*种|5\s*[×*x]\s*3|两种(顺序|情况)|先红后蓝|先蓝后红|15\s*\/\s*56)/,
          t: "再算出符合条件的取法（15 种），或说明两种顺序都要算" }
      ]
    },
    {
      text: "一件商品原价 800 元。先涨价 25%，再在涨价后的价格上打 8 折，最后再降 40 元。这件商品最终售价是多少元？",
      answerText: "760 元",
      answerRe: /(^|[^\d])760([^\d]|$)/,
      trap: "800 元——涨价 25% 再打 8 折刚好回到原价，于是忘了最后还要减 40 元",
      keys: [
        { re: /(1000)/, t: "算出涨价 25% 后是 1000 元" },
        { re: /(减\s*40|降\s*40|-\s*40|再降)/, t: "记得最后还要再减 40 元" }
      ]
    },
    {
      text: "学校给 4287 名同学每人发一本 316 页的练习本，这些练习本一共有多少页？请给出精确数字。",
      answerText: "1354692 页",
      answerRe: /(1[\s,]*354[\s,]*692)/,
      trap: "凭直觉心算多位数乘法，进位很容易错（这就是“不写过程”最典型的翻车点）",
      keys: [
        { re: /(拆|分配律|竖式|部分积|4287\s*[×*x]\s*(300|16|10|6))/,
          t: "把 4287×316 拆成几步来算，而不是一次报数" },
        { re: /(1[\s,]*286[\s,]*100|68[\s,]*592|42[\s,]*870|25[\s,]*722|部分积|竖式)/,
          t: "写出至少一个中间的部分积" }
      ]
    }
  ];

  /* ---------- ⑦ 思维链实验的「模型选择」状态 ----------
   * null = 自动（有云端能力密钥 → 7B 小模型；没有 → DeepSeek 大模型）；
   * "small" / "big" = 老师手动指定，用于对比：
   *   小模型必须被提醒「写过程」（CoT = 外部脚手架）vs 大模型把「一步一步想」内化成了本能。 */
  var cotPick = null;

  /* ---------- 「本实验当前用的是哪个模型」说明条（思维链 / 魔法句式 共用）----------
   * 这两个对比实验都很容易被误会成“用了两个不同的模型”，其实不是：
   * 两边用的是<b>同一个模型</b>，只有说法 / 指令不同。所以必须明明白白写出来。
   * opt.pick 传 "small" / "big" 时，展示对应模型的说明（含“切过去看什么”的引导）。 */
  function paintModelBar(boxId, opt) {
    var box = $(boxId);
    if (!box) return;
    opt = opt || {};
    var cfg = (AgentLab.CONFIG && AgentLab.CONFIG.cotModel) || {};
    var bigModel = (AgentLab.CONFIG && AgentLab.CONFIG.model) || "deepseek-v4-flash";
    var hasCloud = !!(AgentLab.API.hasCloudKey && AgentLab.API.hasCloudKey());
    var pick = (opt.pick === "small" || opt.pick === "big") ? opt.pick : null;   // 手动指定
    var useSmall = pick ? pick === "small" : hasCloud;                            // 未指定 → 按可用性自动
    var same = opt.sameHint || "两边用的是<b>同一个模型</b>，只有说法不同。";

    var body = useSmall
      ? (cfg.provider || "硅基流动") + ' · <code>' + U.esc(cfg.model || "小模型") + '</code>' +
        (cfg.label ? '（' + U.esc(cfg.label) + '）' : "") +
        '<br><span class="dim">' + same +
        (pick === "small"
          ? '你选的是<b>小模型</b>：它自己不会“在心里想”，需要 CoT 提醒它把过程写出来——先记住这一轮的结果，再切到右边的大模型比一比。'
          : '小模型能力弱一些，对“有没有写清楚”更敏感，对比更明显。') + '</span>'
      : 'DeepSeek · <code>' + U.esc(bigModel) + '</code>（大模型）' +
        '<br><span class="dim">' + same +
        (pick === "big"
          ? '你选的是<b>大模型</b>：重点看“直接问答案”那一侧——如果它不写过程也答对，说明“一步一步想”已经被<b>内化</b>成它的本能。'
          : '想让对比更明显，请到右上角「设置」填写<b>云端能力密钥 · 硅基流动</b>，本实验会自动改用 <code>' + U.esc(cfg.model || "小模型") + '</code>。') + '</span>';

    box.innerHTML = '<div class="cot-model ' + (useSmall ? "ok" : "warn") + '">' +
      U.icon("robot", 16) + '<div><b>本实验当前用的模型：</b>' + body + '</div></div>';
  }

  /* 一次刷新所有用到小模型的实验说明条（设置里改完 Key 会调用它） */
  function refreshModelBar() {
    paintModelBar("pl-cot-model", { pick: cotPick, sameHint: "两种问法用的是<b>同一个模型</b>，只有指令不同。" });
    paintModelBar("pl-cmp-model", { sameHint: "两种说法用的是<b>同一个模型</b>，只有说法不同。" });
  }

  /* ---------- ⑦ 思维链实验 ---------- */
  function bindCoT() {
    var qi = 0;
    function curQ() { return COT_BANK[qi]; }

    /* 当前实际会用哪个模型："small"（Qwen2.5-7B）/ "big"（DeepSeek V4 Flash）。
     * 手动指定优先；没指定时按 Key 可用性自动选。 */
    function effPick() {
      if (cotPick === "small" || cotPick === "big") return cotPick;
      return (AgentLab.API.hasCloudKey && AgentLab.API.hasCloudKey()) ? "small" : "big";
    }
    function modelName(p) {
      return p === "small" ? "Qwen2.5-7B（小模型）" : "DeepSeek V4 Flash（大模型）";
    }

    /* 清空上一轮的答案 / 检查表 / 反馈（换题、换模型都要清，
     * 否则会把“换之前那次”的成绩误当成新一轮的）。 */
    function clearOutputs() {
      if ($("pl-cot-direct")) $("pl-cot-direct").innerHTML = '<span style="color:var(--c-sub)">还没有提问……</span>';
      if ($("pl-cot-cot")) $("pl-cot-cot").innerHTML = '<span style="color:var(--c-sub)">还没有提问……</span>';
      if ($("pl-cot-table")) $("pl-cot-table").innerHTML = "";
      if ($("pl-cot-fb")) $("pl-cot-fb").innerHTML = "";
    }

    /* 模型选择按钮：Qwen2.5-7B（小） / DeepSeek V4 Flash（大）——
     * 再点一次已选中的那个 = 取消手动选择，回到“自动”（有云端 Key 用小模型）。 */
    function drawModels() {
      var box = $("pl-cot-models");
      if (!box) return;
      var hasCloud = !!(AgentLab.API.hasCloudKey && AgentLab.API.hasCloudKey());
      var hasBig = !!(AgentLab.API.hasApiKey && AgentLab.API.hasApiKey());
      var eff = effPick();
      var items = [
        { id: "small", name: "Qwen2.5-7B", tag: "小模型", ok: hasCloud,
          tip: "7B 小参数模型：不提醒它写过程，就容易跳步出错（CoT 的对比更明显）" },
        { id: "big", name: "DeepSeek V4 Flash", tag: "大模型", ok: hasBig,
          tip: "大参数模型：推理能力更强，可能已经把“一步一步想”内化成了本能" }
      ];
      box.innerHTML = items.map(function (o) {
        return '<button type="button" class="cmp-task-btn' + (eff === o.id ? " on" : "") + '" data-pick="' + o.id + '" title="' + U.esc(o.tip) + '">' +
          U.icon("robot", 14) + o.name + ' · ' + o.tag +
          (o.ok ? "" : '<span class="cot-nokey">未配置 Key</span>') +
          '</button>';
      }).join("");
      box.querySelectorAll(".cmp-task-btn").forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-pick");
          cotPick = (cotPick === id) ? null : id;   // 再点一次 = 回到自动
          drawModels();
          clearOutputs();
          refreshModelBar();
          U.toast("已切换为「" + modelName(effPick()) + "」，重新点『同时问两种方式』跑一次", "info");
        });
      });
    }

    /* 换题 / 初始渲染：把当前题目写进两栏，并清空上一次的结果 */
    function paintQuestion() {
      var q = curQ();
      var q1 = $("pl-cot-q1"), q2 = $("pl-cot-q2");
      if (q1) q1.textContent = "题目：" + q.text;
      if (q2) q2.textContent = "题目：" + q.text;
      clearOutputs();
      drawModels();
      refreshModelBar();   // 换题时顺带刷新“当前用的是哪个模型”
    }

    var nextBtn = $("pl-cot-next");
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        qi = (qi + 1) % COT_BANK.length;
        paintQuestion();
      });
    }

    $("pl-cot-go").addEventListener("click", async function () {
      var btn = $("pl-cot-go");
      var q = curQ();
      var direct = $("pl-cot-direct");
      var cot = $("pl-cot-cot");
      var tableBox = $("pl-cot-table");
      var fb = $("pl-cot-fb");
      var eff = effPick();            // 本轮实际使用的模型（手动选择 or 自动）

      /* 选定的模型缺 Key 时，提前给出指引，而不是等接口报错 */
      var keyMiss = (eff === "small" && !(AgentLab.API.hasCloudKey && AgentLab.API.hasCloudKey()))
        ? "这个模型需要「设置 → 云端能力密钥 · 硅基流动」才能调用"
        : (eff === "big" && !(AgentLab.API.hasApiKey && AgentLab.API.hasApiKey()))
          ? "这个模型需要「设置 → DeepSeek API Key」才能调用"
          : "";
      if (keyMiss) {
        var missHtml = '<span style="color:var(--c-exe-deep)">' + U.esc(keyMiss) + '。也可以切换到另一个模型再试。</span>';
        direct.innerHTML = missHtml;
        cot.innerHTML = missHtml;
        if (tableBox) tableBox.innerHTML = "";
        if (fb) fb.innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " " + U.esc(keyMiss) + "。</span>";
        U.toast(keyMiss + "——请到右上角「设置」填写", "error");
        return;
      }

      /* 把一次请求结果显示到框里：Markdown 渲染 + 空回答提示 + 明确错误原因 */
      function fill(el, r) {
        if (r.status !== "fulfilled") {
          el.innerHTML = '<span style="color:var(--c-exe-deep)">出错了：' +
            U.esc((r.reason && r.reason.message) || "网络问题") + "</span>";
          return;
        }
        var t = String(r.value == null ? "" : r.value).trim();
        if (!t) {
          el.innerHTML = '<span style="color:var(--c-sub)">（AI 这次没有返回内容，请再点一次）</span>';
          return;
        }
        try {
          el.innerHTML = '<div class="md-body">' + U.md(t) + "</div>";
        } catch (e) {
          el.textContent = t;   // 渲染失败退化为纯文本，保证回答一定可见
        }
      }

      btn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      direct.innerHTML = '<span style="color:var(--c-sub)">提问中……</span>';
      cot.innerHTML = '<span style="color:var(--c-sub)">提问中……</span>';
      if (tableBox) tableBox.innerHTML = "";
      if (fb) fb.innerHTML = "";

      try {
        /* 唯一的区别就是这两句指令：一个“只要答案”，一个“一步一步算”。
         * 题干完全相同——这样对比出来的差异，才真的来自“要不要过程”。 */
        /* 思维链那一侧必须给足长度：7 步递推 + 多位数竖式，写长了就会被截断，
         * 而“答案”写在最后一句——一旦截断，看起来就像“模型答错了”，其实是没写完。
         * 直接问那一侧只要求一个短答案，给小一点的上限即可。 */
        /* 分开记录两侧的元信息：这样能单独看出“是哪一侧被截断了” */
        var meta = { direct: null, cot: null };
        function mkNote(key) {
          return function (m) { if (m) meta[key] = m; };
        }
        function truncated(key) {
          return !!(meta[key] && meta[key].finishReason === "length");
        }
        function reasoning(key) {
          return !!(meta[key] && meta[key].reasoning);
        }
        /* 用哪个模型：老师手动选的（小 / 大），或按 Key 可用性自动选——
         * 自动时会优先用硅基流动的小模型：它两种问法的差别更明显，更适合演示 CoT 的作用。 */
        var askFn = eff === "small" ? AgentLab.API.askSmall : AgentLab.API.ask;

        var results = await Promise.allSettled([
          AgentLab.Adv.askSide(
            "你是答题机器。请直接给出最终答案，输出格式只能是「答案：X」这一行，不要写算式、步骤、理由或验算。",
            /* 这一侧刻意“不给思考的空间”（输出上限远小于思维链侧的 4000，随机性略高），
             * 但上限不能太小——否则小模型一开口就被切断，连答案都吐不出来。
             * 之前设 80 就犯了这个错：表现为“直接问那一侧总是不返回内容”。 */
            q.text, askFn, { maxTokens: 600, temperature: 1.0, onMeta: mkNote("direct") }),
          AgentLab.Adv.askSide(
            "你是数学老师。请一步一步仔细推理：先求什么、再求什么，每一步都写出完整的算式和计算结果，最后给出答案。不要跳步，也不要心算——每一步的结果都要写在纸上再往下算。",
            q.text, askFn, { maxTokens: 4000, onMeta: mkNote("cot") })
        ]);
        fill(direct, results[0]);
        fill(cot, results[1]);

        /* 客观评价：逐项检查两个回答（全部是可数指标，不靠“感觉”） */
        var okAll = results[0].status === "fulfilled" && results[1].status === "fulfilled";
        if (tableBox) {
          var rows = plCotRows(results[0].value, results[1].value, q);
          var cotL = 0, cotR = 0;
          rows.forEach(function (x) { if (x.av) cotL++; if (x.bv) cotR++; });
          /* 结论按“小模型 / 大模型”两种教学口径来写：
           *   小模型：CoT = 外部脚手架（不提醒就跳步）
           *   大模型：直接问也答对 = 「一步一步想」被内化成了本能 */
          var dirOk = rows[0].av;   // 第 1 项 = “答案算对”（直接问那一侧）
          var cotOk = rows[0].bv;
          var verdict;
          if (eff === "small") {
            verdict = cotR > cotL
              ? "同一道题、同一个 AI，只是问法不同：思维链那一边做到 " + cotR + " / " + rows.length +
                " 项，直接问只做到 " + cotL + " / " + rows.length + " 项。小模型自己不会“在心里想”——把过程写出来，等于给它一根外部的“脚手架”。"
              : "同一道题、同一个 AI，这次两边差不多（" + cotL + " : " + cotR + "）。点「换一题」再试一道——多试几次就会发现，让 AI 写过程的那一边更稳。";
          } else if (dirOk && cotOk) {
            verdict = "★ 大模型两种问法都答对了（" + cotL + " : " + cotR + "）。这可不是题目太简单——" +
              "而是「一步一步想」已经被 <b>内化</b>：模型见过海量推理过程，推理变成了它的本能，不提醒也会自己先想。" +
              "把模型切回小模型再跑一次，就能看出“脚手架”原来有多重要。";
          } else if (!dirOk && cotOk) {
            verdict = "大模型这边：直接问只做到 " + cotL + " / " + rows.length + "，思维链做到 " + cotR + " / " + rows.length +
              " ——即使是大模型，不写过程也会跳步。说明“内化”不等于万能，复杂题仍然需要 CoT。";
          } else {
            verdict = "大模型这次两边差不多（" + cotL + " : " + cotR + "）。点「换一题」再试一道，或换回小模型对比看看。";
          }
          tableBox.innerHTML = okAll ? AgentLab.Adv.checklistHTML({
            rows: rows,
            leftLabel: "直接问答案",
            rightLabel: "思维链提问",
            verdict: verdict,
            note: "这几项都是在回答里<b>找得到 / 找不到</b>的硬指标：答案对不对、有没有说出那两个<b>关键中间结论</b>、有没有分步。" +
              "用它判定，比“感觉哪个更好”客观得多。<br>这道题最容易踩的坑：" + q.trap + "。"
          }) : "";
        }
        if (fb) {
          fb.innerHTML = okAll
            ? '<span class="fb-ok">' + U.icon("brain", 16) + " 思维链 = 把过程写出来。过程写出来，错在哪一步就能查出来；只写答案，错了也看不出为什么。点「换一题」可以再试一道。</span>" +
              (truncated("direct")
                ? '<div class="fb-no" style="margin-top:8px">' + U.icon("xmark", 15) +
                  " 注意：“直接问答案”那边<b>被长度上限截断</b>了（可能它非要写过程，写到一半被切断）。" +
                  "可以尝试点「换一题」，或告诉我，我把这一侧的上限再调大。</div>"
                : "") +
              (truncated("cot")
                ? '<div class="fb-no" style="margin-top:8px">' + U.icon("xmark", 15) +
                  " 注意：思维链那边的回答<b>被长度上限截断了</b>（还没写完就被切断），所以上面的判定可能不准。" +
                  "请点「换一题」换一道短一点的题，或告诉我，我把输出长度上限再调大。</div>"
                : "") +
              ((reasoning("direct") || reasoning("cot"))
                ? '<div class="fb-ok" style="margin-top:8px">' + U.icon("spark", 15) +
                  " <b>“内化”的直接证据：</b>接口返回了模型内部的 reasoning 内容——它嘴上只说一个答案，心里却先自己算了一遍。CoT 已经从“提示技巧”变成了模型的本能。</div>"
                : "") +
              (eff === "small"
                ? '<div class="fb-ok" style="margin-top:8px">' + U.icon("check", 15) +
                  " 当前用的是<b>小模型 " + U.esc(((AgentLab.CONFIG.cotModel || {}).label || "Qwen2.5-7B")) + "</b>：" +
                  "不提醒它写过程更容易翻车，CoT 的作用看得最清楚。想验证“能力内化”，切到右边的<b>大模型</b>，重点看「直接问」那一侧还答不答对。</div>"
                : '<div class="fb-' + (dirOk ? "ok" : "no") + '" style="margin-top:8px">' + U.icon(dirOk ? "check" : "info", 15) +
                  (dirOk
                    ? " 当前用的是<b>大模型 DeepSeek V4 Flash</b>：注意「直接问答案」那一侧——它<b>也答对了</b>。不用提醒就会先想一遍，这就是 CoT 被<b>内化</b>（模型智商提升）的样子。切回小模型对比，差别立刻出来。</div>"
                    : " 当前用的是<b>大模型 DeepSeek V4 Flash</b>：它能力更强，但复杂题仍可能跳步——这正是 CoT 依然有用的证据。</div>"))
            : "";
        }
      } catch (e) {
        var emsg = '<span style="color:var(--c-exe-deep)">出错了：' + U.esc((e && e.message) || "未知错误") + "</span>";
        direct.innerHTML = emsg;
        cot.innerHTML = emsg;
      } finally {
        btn.disabled = false;
        if (nextBtn) nextBtn.disabled = false;
      }
    });

    paintQuestion();
  }

  /* ---------- ⑧ 工具选择决策 ---------- */
  /* ---------- ⑧ 工具选择决策（单题闯关） ---------- */
  function bindToolDec() {
    AgentLab.Quiz.mount({
      host: "pl-td-flow",
      color: "plan",
      name: "工具决策小达人",
      shuffle: true,
      questions: TOOL_DECISIONS.map(function (q) {
        return {
          pre: "用户说：" + U.esc(q.scene),
          q: "这时候应该怎么做？",
          opts: q.opts,
          ans: q.correct,
          why: q.why
        };
      }),
      hint: "想一想：这个问题需要“实时信息 / 精确计算 / 动手做事”吗？还是直接回答就行？"
    });
  }

  /* ---------- ⑨ 提议者-审核者 ---------- */
  /* 内置示例：没有配置 Key 时也能把「提议者 → 审核者」这条链完整看一遍。
   * 内容固定为演示用，不调用任何模型——避免无 Key 课堂把这一卡空在那里。 */
  var PR_DEMO = {
    propose:
      "为“组织班级科技节”拟一份执行计划：<br><br>" +
      "① <b>定时间与场地</b>——用课表查询工具确认下周哪天下午没有主课，再向老师申请教室；验收标准：拿到一个具体日期 + 场地许可。<br>" +
      "② <b>征集展品</b>——在班级群发通知，收集“每人一个科学小实验”的报名；验收标准：报名表上有名字 + 实验名称。<br>" +
      "③ <b>分组与分工</b>——按实验类型分成 4 组，每组选一名组长；验收标准：分组表填满，每组有组长。<br>" +
      "④ <b>准备材料</b>——按各组实验列出材料清单，统一采购；验收标准：清单上每项都标了数量和负责人。<br>" +
      "⑤ <b>彩排与正式展示</b>——提前一天彩排，正式当天按顺序展示；验收标准：每个实验都能独立演示成功一次。",
    review:
      "<b>整体评价：</b>五步顺序合理，每步都写了验收标准，可以直接执行。但有三处需要补：<br><br>" +
      "① <b>缺安全环节（建议优先补）</b>——科学小实验可能涉及明火、电源、化学品。计划里没有任何安全审查步骤。<br>" +
      "建议加一步：<b>“安全审查”</b>——每组把实验方案交给老师过一遍，标注风险点与防护措施；验收标准：每个实验都有老师签字确认。<br><br>" +
      "② <b>第 ② 步和第 ④ 步之间的依赖没写明</b>——材料清单依赖“报名结果”，但计划里没有说明“报名截止”这个节点。<br>" +
      "建议：给第 ② 步加一个明确截止时间，否则第 ④ 步会一直等不到输入。<br><br>" +
      "③ <b>缺少“兜底方案”</b>——如果当天有人请假、或某个实验当场失败怎么办？<br>" +
      "建议：每组指定一名替补，并准备一个“失败也能讲”的说明（讲清原理比演示成功更有价值）。<br><br>" +
      "<span style='color:var(--c-sub)'>说明：以上判断只基于这份计划本身——审核者没有看到提议者的推理过程。</span>"
  };

  function bindProposerReviewer() {
    $("pl-pr-go").addEventListener("click", async function () {
      var input = $("pl-pr-input");
      var t = input.value.trim();
      if (!t) { U.toast("先输入一个任务！"); return; }
      var btn = $("pl-pr-go");
      var proposeEl = $("pl-pr-propose");
      var reviewEl = $("pl-pr-review");

      /* 没配 Key 也要能上课：走内置示例，把“提议者 → 审核者”这条链完整演示一遍 */
      if (!AgentLab.API.hasApiKey()) {
        proposeEl.innerHTML = PR_DEMO.propose;
        reviewEl.innerHTML = PR_DEMO.review;
        U.toast("未配置 DeepSeek Key，本次用内置示例演示完整的提议 → 审核流程", "info");
        return;
      }

      btn.disabled = true;
      proposeEl.innerHTML = '<span style="color:var(--c-sub)">提议者正在生成计划……</span>';
      reviewEl.innerHTML = '<span style="color:var(--c-sub)">等待提议者完成……</span>';

      try {
        // 提议者生成计划
        var proposeSys = "你是一个计划提议者（Proposer）。请为用户的任务制定一个详细的执行计划，包含 4-6 个步骤，每个步骤说明做什么、用什么工具、预期结果。格式清晰。";
        var plan = await AgentLab.API.ask(proposeSys, t);
        plRenderAns(proposeEl, plan);

        // 审核者审查计划（不看提议者的推理，只看计划本身）
        reviewEl.innerHTML = '<span style="color:var(--c-sub)">审核者正在审查计划……</span>';
        var reviewSys = "你是一个独立的计划审核者（Reviewer）。请审查下面的执行计划，从以下角度给出反馈：①步骤是否完整有无遗漏？②步骤顺序是否合理？③有没有风险或隐患？④有没有可以优化的地方？请给出具体的改进建议。注意：你没有看到计划生成者的推理过程，只基于计划本身做判断。";
        var review = await AgentLab.API.ask(reviewSys, "任务：" + t + "\n\n待审核的计划：\n" + plan);
        plRenderAns(reviewEl, review);
      } catch (e) {
        proposeEl.innerHTML = '<span style="color:var(--c-exe-deep)">出错了：' + U.esc(e.message || e) + "</span>";
        reviewEl.innerHTML = '<span style="color:var(--c-sub)">审核未执行</span>';
      }
      btn.disabled = false;
    });
  }

  /* ---------- ⑩ 规划失败与反思 ---------- */
  /* ---------- ⑩ 规划失败与反思（单题闯关） ---------- */
  function bindFail() {
    AgentLab.Quiz.mount({
      host: "pl-fl-flow",
      color: "plan",
      name: "反思小达人",
      questions: FAIL_CASES.map(function (c) {
        return {
          pre: '<b>' + U.esc(c.title) + '</b><br><b>原计划：</b>' + U.esc(c.plan) +
               '<br><b>失败情况：</b><span style="color:var(--c-exe-deep)">' + U.esc(c.fail) + '</span>',
          q: "你觉得 Agent 应该怎么做？",
          opts: c.options,
          ans: c.correct,
          why: c.why
        };
      }),
      hint: "想想看：是“停下来不管”，还是“分析原因再调整”？"
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

  /* ---------- ⑨ 循环的边界：停止条件互动（复用进阶课堂的 tuner 滑条组件） ---------- */
  function bindPlStop() {
    var host = $("pl-stop-demo");
    var T = AgentLab.Adv && AgentLab.Adv.types && AgentLab.Adv.types.tuner;
    if (!host || !T || !PL_DEMO.stop) return;
    /* 复制一份再加语义色：不污染进阶课堂里的同一份 demoData */
    var d = {};
    Object.keys(PL_DEMO.stop).forEach(function (k) { d[k] = PL_DEMO.stop[k]; });
    d.color = "plan";
    host.innerHTML = T.demoHTML(d);
    T.bind(host, d);
  }

  /* ---------- ⑰ 小测验（单题闯关） ---------- */
  function bindQuiz() {
    AgentLab.Quiz.mount({
      host: "pl-quiz-body",
      color: "plan",
      name: "规划小达人",
      star: "pl-quiz-score",
      restart: "pl-quiz-restart",
      questions: QUIZ,
      hint: "再想想——答案都在拆解、排序、ReAct、CoT、反思这些实验里。"
    });
  }

  /* ============================================================
   * ⑬ 综合演练：从一个模糊需求到任务完成（端到端 6 关）—— 对应卡片「综合演练」
   * 同一个任务按「说清楚 → 拆解 → 排序 → 执行 → 反思 → 质检」推进；
   * shuffle:false 保证关卡顺序与全流程一致（与小测验的随机出题区分）。
   * ============================================================ */
  var E2E_QUIZ = [
    {
      pre: "第 1 关 · 需求阶段｜用户只说了一句：帮我办一次期末联欢会",
      q: "规划器的第一步应该做什么？",
      opts: [
        "先问清楚：哪天办、多少人参加、在哪个场地、大概多长时间",
        "直接开始列节目单",
        "先把教室布置方案写出来"
      ],
      ans: 0,
      why: "信息不足时先澄清、再规划——时间、人数、场地、时长不一样，计划会完全不同。硬猜出来的计划，做得越细越容易白做。（对应知识点：意图澄清 + 需求四要素）"
    },
    {
      pre: "第 2 关 · 拆解｜已知：12 月 30 日下午 2:00，本班 40 人，教室，90 分钟",
      q: "下面哪一组子任务拆得最好？",
      opts: [
        "定节目单、统计参演人数、排 90 分钟流程、采购物资、写收尾清单——每项都有可检查的产物",
        "买零食、布置教室、玩游戏",
        "把整场联欢会从头到尾在脑子里过一遍"
      ],
      ans: 0,
      why: "好分解的三条标准：足够小（一次能做完）、有产出（做完能检查）、有边界（不越界、不漏项）。"
    },
    {
      pre: "第 3 关 · 排序｜已拆出：① 定节目单 ② 统计参演人数 ③ 排 90 分钟流程 ④ 采购物资",
      q: "哪一步必须排在最前面？",
      opts: ["① 定节目单", "④ 采购物资", "③ 排流程"],
      ans: 0,
      why: "看依赖：定了节目单，才知道大概多少人上台、每个节目多久——流程和物资都要等它的产出。② 和 ④ 互不依赖，真实系统里可以并行做。"
    },
    {
      pre: "第 4 关 · 写成清单｜计划要交给程序去执行，其中一步原话是：“把教室布置得喜庆一点”",
      q: "这一条该怎么改，程序才执行得下去？",
      opts: [
        "改成：挂 6 个气球、贴 3 张拉花（工具：布置清单）→ 完成标准：照片确认布置完成",
        "保持原样，写得文学一点更有氛围",
        "删掉这一步，布置不重要"
      ],
      ans: 0,
      why: "清单里每一步要写清「做什么 + 用什么工具 + 完成标准」。“喜庆一点”人看得懂，程序却既不知道做什么、也没法检查——写得再好听也执行不了。"
    },
    {
      pre: "第 5 关 · 执行｜需要确认“12 月 30 日那天的天气会不会影响教室通风安排”",
      q: "这一步该怎么处理？",
      opts: [
        "调用天气工具查一下，拿到结果后再决定——行动 → 观察 → 再思考",
        "凭常识猜一猜就行",
        "跳过这项检查，直接往下走"
      ],
      ans: 0,
      why: "需要模型记忆之外的实时信息，就该调用工具；拿到结果还要“观察”再决定下一步——这正是 ReAct 循环。"
    },
    {
      pre: "第 6 关 · 突发失败｜执行到一半：原定要用的投影仪被别的班借走了",
      q: "一个“会反思”的 Agent 应该怎么做？",
      opts: [
        "先用独立审核者找到“第一个出错的步骤”，再只调整那一步（换设备或改节目形式）→ 再执行一次",
        "停在这里，把问题直接丢回给用户",
        "把最后的报错改一改，让它看起来没出错"
      ],
      ans: 0,
      why: "先归因、再反思：从第一步往下找“第一处偏离”（比如“确认场地与设备”这一步本来就没做），只修受影响的那几步；改最后一行报错，等于给症状贴创可贴。"
    },
    {
      pre: "第 7 关 · 交付前质检｜计划已经排好了，准备开始执行",
      q: "派谁来最后检查这份计划最可靠？",
      opts: [
        "另一个不共享上下文的独立审核者，只看计划本身",
        "生成这份计划的同一个 AI，自己再检查一遍",
        "不用检查，直接开干"
      ],
      ans: 0,
      why: "自审不可靠——同一个上下文里的模型很难发现自己的认知盲区。让独立审核者只看产物、不看生成过程，才能给出独立判断。"
    }
  ];

  function bindE2E() {
    AgentLab.Quiz.mount({
      host: "pl-e2e-flow",
      color: "plan",
      name: "全流程小达人",
      shuffle: false,
      questions: E2E_QUIZ,
      hint: "回到前面的实验里找线索：说清楚 → 拆解 → 排序 → 执行 → 反思。"
    });
  }

  /* ============================================================
   * 进阶原理互动课堂（规划器）：11 个概念
   * 结构与交互由共享引擎 js/adv-classroom.js 渲染，这里只放内容数据
   * ============================================================ */
  var PL_ADV = [
    {
      id: "react", icon: "zap", nav: "ReAct 循环", name: "ReAct 循环", en: "REACT LOOP",
      tip: "Agent 最核心的执行模式：思考 → 行动 → 观察 → 再思考，一圈一圈把任务推进到完成。",
      analogy: "像做题时“边想边试”：先想一步（<b>思考</b>），动笔算一下（<b>行动</b>），看结果对不对（<b>观察</b>），再决定下一步——而不是一次把整张卷子写完。",
      real: "每一轮循环都会把工具返回的结果<b>追加到轨迹（trajectory）</b>里，供下一轮推理使用；循环必须带停止条件（任务完成 / 达到最大轮数 / 遇到不可恢复错误）。真实系统里 ReAct 与工具调用配合：模型输出 <code>tool_calls</code>，程序执行后把结果作为 tool 消息塞回上下文。",
      quiz: { q: "为什么 ReAct 要“观察”之后再“思考”，而不是一路做到底？", a: "因为行动的结果会改变后续决策。不看观察结果，模型就是在盲猜；观察回来的真实数据（查询结果、报错信息）才是下一步决策的依据——这正是 Agent 比“一次性生成”更可靠的原因。" },
      links: [{ t: "ReAct 循环演示", el: "pl-react-status" }, { t: "规划失败与反思", el: "pl-fail" }]
    },
    {
      id: "decomp", icon: "link", nav: "任务分解", name: "任务分解（Task Decomposition）", en: "TASK DECOMPOSITION",
      tip: "把一个大目标拆成“可执行、可验证”的小步骤——拆得好，任务就成功了一半。",
      analogy: "像办一场班会：不是一句“把班会办了”，而是拆成“定主题 → 分任务 → 排时间 → 彩排 → 正式开”，每一步都能单独完成、单独检查。",
      real: "工程上常让模型输出 <b>JSON 步骤列表</b>（步骤名 + 依赖关系 + 要用的工具 + 预期产物），程序再按依赖关系（DAG 拓扑序）执行；没有依赖的步骤可以并行跑，省时间。",
      quiz: { q: "“帮我写一份班级春游计划”该拆成哪几步？怎样判断拆得够不够好？", a: "至少要拆成：确定目的地与日期 → 查天气与交通 → 排时间表与分组 → 列物品清单。判断标准两条：① 每一步都能单独执行；② 每一步都有可检验的产物（一张表、一个清单）。拆不出“可检验的产物”，就说明还太粗。" },
      links: [{ t: "现场规划：把大任务拆成小步骤", el: "pl-plan-input" }, { t: "任务分解树", el: "pl-tree" }]
    },
    {
      id: "cot", icon: "brain", nav: "思维链 CoT", name: "思维链（Chain-of-Thought）", en: "CHAIN-OF-THOUGHT",
      tip: "让模型“把推理过程写出来”再给答案，复杂推理的准确率会明显提升。",
      analogy: "像数学考试：直接写答案容易错，写出解题步骤就不容易错——因为每一步都暴露出来，错了能查到错在哪一步。",
      real: "进阶变体：<b>Self-Consistency</b>（多次采样再投票，答案更稳）、<b>Tree-of-Thoughts</b>（把思路当树分叉探索再回溯）。代价是输出变长、Token 与耗时增加，所以简单任务不必强行 CoT。",
      quiz: { q: "什么时候不该让模型“一步一步想”？", a: "简单、确定性的任务（单位换算、格式转换、取一个字段）。强行 CoT 只会白白增加输出 Token 和延迟，还可能把简单问题想复杂。判断标准：这个任务是否真的有中间推理步骤。" },
      links: [{ t: "思维链实验", el: "pl-cot-go" }]
    },
    {
      id: "paradigm", icon: "gear", nav: "两种规划范式", name: "Plan-and-Execute vs ReAct", en: "PLANNING PARADIGMS",
      tip: "先列完整计划再执行，还是边想边做？——取决于任务的“确定性”。",
      analogy: "像出行：走固定路线的班车可以提前把时刻表排好（<b>Plan-and-Execute</b>）；自驾找路则要边走边看导航调整（<b>ReAct</b>）。",
      real: "Plan-and-Execute 一次性产出步骤列表后逐步执行：Token 可控、便于审计，但中途变化不会自己改；ReAct 每步都能根据观察调整：适应不确定环境，但容易绕远、消耗更高。<b>实际系统常混合使用</b>——先出计划，执行中允许修订。",
      quiz: { q: "“每月固定格式的销售报表生成”和“排查网站为什么打不开”，分别适合哪种范式？", a: "前者适合 Plan-and-Execute（步骤、数据源都固定，一次规划重复执行最省）；后者适合 ReAct（原因不确定，需要逐步测试、根据结果缩小范围）。口诀：步骤会不会因为中间结果而改变。" },
      links: [{ t: "两种规划范式对比", el: "pl-paradigm" }]
    },
    {
      id: "proposer", icon: "users", nav: "提议者-审核者", name: "提议者-审核者（Proposer-Reviewer）", en: "PROPOSER-REVIEWER",
      tip: "生成与审查分开：让另一个“只看产物、不共享上下文”的角色来挑毛病——因为自己审自己不可靠。",
      analogy: "像小组作业：自己检查作文很难发现错，同学交换检查就容易发现——而且最好只给他作文本身，不要先告诉他“我觉得写得挺好”。",
      real: "双 Agent 模式：提议者生成计划/产物，审核者<b>不共享提议者的推理上下文</b>，只依据产物本身与评价标准独立审查。核心前提是自审不可靠——同一模型存在认知盲区，容易顺着自己的思路说“有道理”。工程上还会加第三方校验（语法检查、计算器复核）兜底。",
      quiz: { q: "为什么审核者最好“不看”提议者的推理过程？", a: "看到推理过程就会被同一套假设带偏，容易顺着说“有道理”。只给产物 + 评价标准，才能做出独立判断——这就是“独立审查”的价值。" },
      links: [{ t: "提议者-审核者演示", el: "pl-pr-propose" }]
    },
    {
      id: "reflect", icon: "refresh", nav: "反思 Reflection", name: "反思（Reflection）", en: "REFLECTION",
      tip: "从失败里学：识别失败原因 → 调整策略 → 再试——这是从“会完成任务”到“能可靠工作”的关键一步。",
      analogy: "像考试考砸了：只知道分数没用，要复盘“是粗心，还是知识点不会”，下次才能改。",
      real: "工程做法：把失败信号（报错、校验不通过、结果为空）<b>显式回传</b>给模型，让它输出「失败原因 + 修改后的计划」；同时设重试上限与降级策略，避免无限重试。更进阶的系统会把失败案例沉淀进长期记忆，下次直接避开同样的坑。",
      quiz: { q: "Agent 执行失败时，最不该做的是什么？", a: "最不该“假装成功”——用编造的结果糊过去（幻觉）。正确顺序是：如实报告失败 → 说明卡在哪一步 → 给出可选的补救方案（换工具 / 换参数 / 询问用户）。" },
      links: [{ t: "规划失败与反思", el: "pl-fail" }]
    },
    {
      id: "ctx", icon: "archive", nav: "上下文 = 前缀 + 轨迹", name: "上下文 = 静态前缀 + 轨迹", en: "PREFIX + TRAJECTORY",
      tip: "AI 的上下文 = 静态前缀（系统提示词 + 工具定义）+ 轨迹（不断增长的消息历史）。规划循环每转一圈都会往轨迹里追加内容，窗口压力就是这样涨起来的。",
      analogy: "还是那张<b>书桌</b>（和感知器、记忆器用的是同一个比方）：桌面就那么大，一边固定摆着一本<b>规则手册</b>（系统提示词 + 工具定义，每轮都在、不占新地方），另一边是一摞<b>越写越厚的草稿纸</b>（轨迹——每想一步、每做一步就多一张）。<br>感知器管的是“哪些东西值得放上桌”，这里管的是“<b>草稿纸越堆越多怎么办</b>”：桌面满了，最先被挤下去的<b>永远是草稿纸，绝不能是规则手册</b>。",
      real: "轨迹增长带来三类压力：Token 成本上升、关键信息被淹没、超出窗口被截断。工程上的三招：<b>滑动窗口</b>（只留最近几轮 + 系统提示词）、<b>摘要压缩</b>（把旧对话压成一段继续带）、<b>外置记忆 + 检索</b>（存进向量库，需要时再取回）。<br>三处分工记清楚：<b>感知器</b>关心“哪些内容值得放上桌”；<b>这里</b>关心“规划循环为什么让纸越堆越多、满了先丢什么”——答案永远是先丢最旧的轨迹，绝不丢静态前缀；<b>记忆器</b>关心“桌面怎么分配”（预算怎么分给前缀 / 检索 / 轨迹 / 当前问题）。",
      quiz: { q: "为什么“把系统提示词和工具定义放在最前面”特别重要？", a: "因为静态前缀一旦被截断，Agent 就丢了身份、规则和工具说明——行为会立刻变得不可控。所以截断策略永远是“先丢最旧的轨迹，绝不丢静态前缀”。" },
      links: [{ t: "上下文轨迹演示", el: "pl-tr-list" }, { t: "同一个卡：停止条件", el: "pl-stop-demo" }]
    },
    {
      id: "toolpick", icon: "wrench", nav: "工具调用决策", name: "工具调用决策", en: "TOOL CALL DECISION",
      tip: "要不要用工具、用哪个、传什么参数——这是规划器的核心能力之一。",
      analogy: "像出门前选工具：拧螺丝拿螺丝刀，钉钉子拿锤子。拿错了不是不努力，而是工具选错了。",
      real: "决策依据是<b>工具描述</b>（名字、功能、参数、返回格式）：描述越清楚越容易被选对。这套策略通过训练固化在模型参数里；工程上还会给工具补“使用场景示例”和参数约束（枚举、必填项）来降低选错概率。",
      quiz: { q: "用户问“帮我算一下 25×4+10”，为什么不该调用联网搜索？", a: "计算器工具更直接、更快、零成本且结果确定；联网搜索又慢又可能带回无关信息。选工具看三点：能不能解决、代价多大、结果可不可靠。" },
      links: [{ t: "工具选择决策", el: "pl-tooldec" }]
    },
    {
      id: "harness", icon: "shield", nav: "Harness 护栏", name: "Harness 工程：约束 · 验证 · 纠正", en: "CONSTRAIN · VERIFY · CORRECT",
      tip: "给规划加三道护栏：约束不许做的事、验证每一步结果、做错了就纠正重来。",
      analogy: "像开车：方向盘是能力，安全带、限速和刹车是护栏。没有护栏，能力越强越危险。",
      real: "生产级 Agent 的 Harness 做三件事：<b>约束</b>（工具白名单、参数校验、危险操作需人工确认）、<b>验证</b>（语法检查、结果非空校验、关键断言）、<b>纠正</b>（失败后重试 / 降级 / 上报）。模型能力边界之外的部分，正是 Harness 的价值所在。",
      quiz: { q: "为什么说“模型能力边界 = Harness 价值所在”？", a: "因为模型一定会出错、也一定会撞上权限与安全边界。能力覆盖不到的地方（越权、幻觉、格式错误、不可恢复失败）必须由 Harness 拦住。它决定的是“系统能不能上线”，而不只是“跑得漂不漂亮”。" },
      links: [{ t: "规划失败与反思", el: "pl-fail" }]
    },
    {
      id: "stop", icon: "timer", nav: "停止条件", name: "停止条件（Stopping Criteria）", en: "STOPPING CRITERIA",
      tip: "自主 Agent 必须有明确的退出条件，否则容易陷入死循环或做得太多。",
      analogy: "像微波炉必须有定时：不设时间就一直转到烧糊。“够好了就停”和“没做完继续”，需要一条明确的线。",
      real: "三类停止条件：<b>成功</b>（调用“最终输出”工具交付结果）、<b>超限</b>（达到最大迭代次数 / 时间 / 花费上限）、<b>失败</b>（不可恢复错误转人工）。调参要点：上限太低会半途而废，太高会空转烧钱——所以通常用“任务完成信号 + 硬上限”双保险。",
      quiz: { q: "只设“任务完成”作为停止条件，会有什么风险？", a: "模型可能自认为没完成而一直循环（或把“完成”判错），造成超时与费用失控。所以要再加一条硬上限（例如最多 20 轮）兜底。" },
      links: [{ t: "循环的边界 · 停止条件滑条", el: "pl-stop-demo" }, { t: "ReAct 循环演示", el: "pl-react-status" }]
    },
    {
      id: "clarify", icon: "chat", nav: "意图澄清", name: "意图澄清（Clarify Before Acting）", en: "ASK BEFORE ACTING",
      tip: "信息不够、有歧义、或操作有风险时，先问一句再动手——“会问”才是规划能力的一部分。",
      analogy: "像帮同学带早餐：他说“随便带点”，你一定会先问“要包子还是面包？”。真去买了才知道买错，钱和时间都白花——而问一句只要几秒。",
      real: "工程上的三道口子：① <b>缺关键参数</b>就追问（把四要素缺的那条问回来）；② <b>有歧义</b>先确认（“下周三”究竟指哪天）；③ <b>高风险动作</b>先请示（花钱、删数据、对外发消息——常配 Human-in-the-loop 人工确认节点）。代价是慢一点，收益是不白做：错一步的返工成本通常远高于问一句。",
      quiz: { q: "“任何时候都先问一遍”是不是更好的策略？", a: "不是。问太勤会让用户烦、也拖慢任务。判断标准：<b>缺的信息会不会改变计划</b>（会 → 问；只是细节 → 先做再说明）+ <b>做错的代价大不大</b>（大 → 必须先确认）。所以工程上会写清“哪些动作必须确认”，而不是一律问。" },
      links: [{ t: "清晰描述四要素（澄清三问）", el: "pl-prompt-reqs" }, { t: "综合演练：需求阶段", el: "pl-e2e-flow" }]
    },
    {
      id: "todo", icon: "archive", nav: "任务清单 · 状态栏", name: "任务清单（TODO）与状态栏", en: "TODO / STATUS BAR",
      tip: "把待办清单放在每轮都能“瞥一眼”的位置：做一项、划一项——不忘记原始诉求，也不重复劳动。",
      analogy: "像手机顶部的<b>状态栏</b>：不用点进去，扫一眼就知道时间、电量、信号。Agent 也需要一块“现在做到哪了”的状态栏——待办清单就在干这件事。",
      real: "做法：把清单每项写成「<b>做什么 + 状态</b>（待办 / 进行中 / 已完成 / 已取消）<b>+ 结果与下一步</b>」，并把它<b>放在轨迹末尾</b>——对话越久，最早的原始诉求越容易被挤到后面，放在末尾才能“每轮都看得到”。模型通过“重写清单 / 更新某一项状态”两个动作维护它。<br><b>实测（ai-agent-book 第 2 章）：</b>开启清单平均 <b>15 轮</b>完成，关掉清单要 <b>21 轮</b>，还经常漏子任务。清单同时是<b>停止条件</b>的判据：全部打勾 + 证据齐全，才允许交付。",
      quiz: { q: "清单里每一项至少要写清哪几样东西？", a: "三样：① 做什么（一句话目标）② 什么状态（待办 / 进行中 / 已完成 / 已取消）③ 结果与下一步。只写“要做的事”不写状态，就看不出进度；不写结果，就无法判断这一步到底做完没有。" },
      links: [{ t: "任务清单实验（有没有清单）", el: "pl-todo" }, { t: "上下文轨迹演示", el: "pl-tr-list" }]
    },
    {
      id: "attrib", icon: "search", nav: "失败归因", name: "失败归因：从轨迹里定位“第一个错”", en: "FAILURE ATTRIBUTION",
      tip: "出错时找的不是“最后一行报错”，而是第一个导致偏离的步骤——末次报错往往只是后果。",
      analogy: "像检查一道做错的大题：别只盯着最后“答案不对”，要往前翻草稿，找到<b>最先算错的那一步</b>。",
      real: "做法：① 用<b>规则先筛</b>一眼能认的（格式错、结果为空、超时、校验不通过）；② 再让模型在轨迹里<b>定位第一处和事实不符的地方</b>——包括不报错的“静默失败”；③ 记录四样：第几步 / 用了什么工具 / 证据 / 根因与后果；④ 只重做受影响的步骤，不必整条重来。<br>沉淀价值：归因结果写进失败案例库（记忆器），下次遇到同类任务直接避开同一个坑。",
      quiz: { q: "为什么不能只修“最后一步报错”的地方？", a: "因为最后的报错往往只是后果：前面某一步已经走偏，后面的动作都是基于错误前提做的。只修最后一步（比如重试发送），问题会换个地方再冒出来；只有回到第一个错的步骤，才真的解决。" },
      links: [{ t: "失败归因实验（点日志）", el: "pl-attrib" }, { t: "规划失败与反思", el: "pl-fail" }]
    },
    {
      id: "orch", icon: "server", nav: "编排选型", name: "编排选型：从简单到复杂", en: "ORCHESTRATION LADDER",
      tip: "能一次问完的，不必搭 Agent；步骤固定的，用固定流程最稳；只有会随结果改变的，才值得上自主 Agent。",
      analogy: "像出门办事：楼下买瓶水不用做攻略；固定线路的班车可以提前排时刻表；去陌生地方自驾，才需要边走边看导航调整。",
      real: "三档选型：① <b>一次模型调用</b>——写作、翻译、总结，便宜又快；② <b>固定工作流</b>——路径预先定好（提示链 / 路由 / 并行 / 编排者-工作者 / 评估者-优化者），可预测、好排查；③ <b>自主 Agent</b>——路径不确定、必须根据中间结果改变下一步，才用得上规划循环。<br>顺序很重要：<b>从简单到复杂</b>地试。每加一层都会带来成本、延迟和不确定性——能用简单方案解决的，不必上复杂架构。",
      quiz: { q: "“每周一把固定格式的周报发到班级群”更适合哪种做法？", a: "固定工作流：步骤、格式、时间都不变，把流程写死最稳——不会跑偏，出错也好排查。自主 Agent 的价值在于“应变”，用在不变的事情上只会更贵、更难预测。" },
      links: [{ t: "两种规划范式对比", el: "pl-paradigm" }, { t: "综合演练：全流程", el: "pl-e2e-flow" }]
    },
    {
      id: "a2a", icon: "users", nav: "Agent 之间怎么说话", name: "A2A：智能体之间的协议", en: "AGENT-TO-AGENT",
      tip: "MCP 解决“Agent 怎么用工具”（上下），A2A 解决“Agent 怎么跟另一个 Agent 说话”（左右）——两件事、两套协议。",
      analogy: "像一个班里的分工：MCP 是“你怎么用教室里的设备”（人和物），A2A 是“你怎么把任务交给同组的同学、再把结果收回来”（人和人）。要合作得好，得先说清楚四件事：<b>找谁、给什么、要什么、什么时候交</b>。",
      real: "A2A（Agent-to-Agent）要解决四件事：<b>①发现</b>——怎么知道有这么一个 Agent 可用（能力清单 / 服务目录）；<b>②委派</b>——把任务交代清楚（目标、背景、约束、要什么格式的产物）；<b>③回报</b>——对方交回结果，失败时说明卡在哪一步；<b>④汇总</b>——发起方把各方结果合并成最终交付。<br>关键点：<b>两个 Agent 不共享上下文</b>——你脑子里的背景对方看不到，所以委派时要写成“它自己能读懂的一份说明”，而不是“你懂的”。<br>再往上还有 <b>ANP</b>（Agent Network Protocol）：解决“Agent 之间怎么组网、怎么互相认证和路由”——可以理解成“Agent 的通讯录 + 门禁”。",
      quiz: { q: "为什么“提议者-审核者”要独立不共享上下文，而 A2A 委派时又强调“任务要写清楚”？", a: "两者是一件事的两面：正因为两个 Agent 不共享上下文（看不到对方在想什么），所以“委派方要把说明写全”、“审核方只看产物不看推理”才能各自独立工作。共享上下文会让判断被带偏，不写清说明会让对方无从下手。" },
      links: [{ t: "提议者-审核者演示", el: "pl-pr-propose" }, { t: "综合演练：全流程", el: "pl-e2e-flow" }]
    }
  ];

  /* 概念 id → 交互类型（同类交互在多个板块复用） */
  var PL_TYPE = {
    react: "pipeline", decomp: "sorter", cot: "decider", paradigm: "matcher", proposer: "sandbox",
    reflect: "picker", ctx: "squeezer", toolpick: "picker", harness: "switchboard", stop: "tuner",
    clarify: "decider", todo: "race", attrib: "annotator", orch: "matcher", a2a: "pipeline"
  };

  /* 每个概念的动手实验数据 */
  var PL_DEMO = {
    react: {
      title: "动手实验：ReAct 循环播放器", hint: "先猜后放", icon: "zap",
      playLabel: "自动播放一遍循环", stepLabel: "单步推进", resetLabel: "重来",
      logTitle: "循环日志（每一步在做什么）",
      stages: [
        { id: "think", name: "思考", icon: "brain", en: "Reasoning", io: "决定“下一步做什么、用哪个工具”" },
        { id: "act", name: "行动", icon: "wrench", en: "Acting", io: "输出 tool_calls，由程序真正执行工具" },
        { id: "obs", name: "观察", icon: "eye", en: "Observation", io: "工具结果作为 tool 消息回到上下文" },
        { id: "rethink", name: "再思考", icon: "refresh", en: "Re-reasoning", io: "结合新信息：继续？换方案？还是收尾？" },
        { id: "final", name: "交付", icon: "check", en: "Final Answer", io: "调用最终输出，任务结束" }
      ],
      guess: {
        q: "先猜一猜：用户问“明天北京天气怎么样？”，Agent 的第一环应该是哪一个？",
        opts: [
          { k: "think", t: "思考：先想清楚要查什么" },
          { k: "act", t: "行动：直接调天气工具" },
          { k: "final", t: "交付：马上编一个答案" }
        ],
        ans: "think",
        why: "ReAct 的第一环永远是“思考”——先明确要查什么、用哪个工具、传什么参数，然后才行动。跳过思考直接行动，最容易调错工具或传错参数。",
        hint: "想想“先想清楚再动手”的顺序。",
        revealAt: 0
      }
    },
    decomp: {
      title: "动手实验：把子任务排成正确的执行顺序", hint: "点步骤排序", icon: "link",
      task: "帮班级组织一次“读书分享会”",
      queueTitle: "顺序队（点下面的步骤放进来）",
      poolTitle: "候选步骤（点一条放进顺序队）",
      wrongHint: "这一步现在还做不了——它依赖前一步的结果（比如先有主题，才能邀请同学）。",
      successHtml: "<b>全部排好了！</b>这就是一次真实的“任务分解 + 依赖排序”。",
      groupNote: "注意虚线框的两步：它们之间没有依赖，真实系统里可以<b>并行执行</b>，省一半时间。",
      items: [
        { id: "s1", label: "确定主题与时间", seq: 1 },
        { id: "s2", label: "邀请同学报名（需要主题和时间）", seq: 2 },
        { id: "s3", label: "收集分享书目（依赖报名名单）", seq: 3 },
        { id: "s4", label: "设计 15 分钟流程", seq: 4, group: "并行A" },
        { id: "s5", label: "准备场地与设备", seq: 5, group: "并行A" },
        { id: "s6", label: "正式举办并记录", seq: 6 }
      ]
    },
    cot: {
      title: "动手实验：这个任务要不要“一步一步想”？", hint: "选两个答案", icon: "brain",
      emptyText: "先回答上面两个问题，系统会给出推荐的推理策略。",
      questions: [
        { key: "steps", q: "① 这个任务里有真正的推理步骤吗？", opts: [{ k: "yes", t: "有，需要多步推导" }, { k: "no", t: "没有，一眼就能看出答案" }] },
        { key: "risk", q: "② 答错的代价大吗？", opts: [{ k: "high", t: "很大（算错就废）" }, { k: "low", t: "不大，错了再问一次就行" }] }
      ],
      decide: function (ans) {
        if (ans.steps === "no") {
          return "<b>推荐策略：不用 CoT，直接回答。</b><br>" +
            '<span class="dim">理由：没有中间推理步骤，强行“一步一步想”只会增加输出 Token 和等待时间，还可能把简单问题想复杂。</span>' +
            '<br><b>例子：</b>单位换算、格式转换、从一句话里取一个字段。';
        }
        if (ans.risk === "high") {
          return "<b>推荐策略：CoT + Self-Consistency（多次采样投票）。</b><br>" +
            '<span class="dim">理由：既有推理步骤、错一次代价又大，就让模型先写出推理过程（暴露错在哪一步），再多采样几次取多数答案；如果问题是“有多种可能解法要探索”，可以上 Tree-of-Thoughts 分叉探索。</span>' +
            '<br><b>代价：</b>Token 与耗时成倍增加，只在高价值任务上值得。';
        }
        return "<b>推荐策略：直接就写 CoT（一步一步想）。</b><br>" +
          '<span class="dim">理由：有推理步骤，所以让推理过程可见能提升正确率；但错了代价不大，不必额外多采样投票（省 Token）。</span>' +
          '<br><b>提示：</b>要引导学生“把过程写出来”，而不是只抄答案。';
      }
    },
    paradigm: {
      title: "动手实验：这五种场景，各适合哪种规划范式？", hint: "左右配对", icon: "gear",
      leftTitle: "① 先点左边一个场景：",
      rightTitle: "② 再点右边它适合的规划范式：",
      left: [
        { id: "s1", label: "每月固定格式的销售报表生成", icon: "box", why: "步骤、数据源都固定，一次规划就能重复执行——Token 可控、步骤可审计。" },
        { id: "s2", label: "按食谱做一道菜", icon: "check", why: "步骤完全固定，照着顺序执行最省事，中途几乎不会有意外。" },
        { id: "s3", label: "排查网站为什么打不开", icon: "search", why: "原因不确定：得先测一项、看结果、再缩小范围，必须边做边调整下一步。" },
        { id: "s4", label: "边查资料边写一份调研报告", icon: "book", why: "每一步都会带出新线索，需要随时改变“接下来查什么”。" },
        { id: "s5", label: "安排一次春游：先出方案，中途有变化再改", icon: "users", why: "大体步骤固定（适合先规划），但会遇到新情况（要能改）——生产系统最常见的做法。" }
      ],
      right: [
        { id: "p", label: "Plan-and-Execute（先列完整计划，再逐步执行）", icon: "clock" },
        { id: "r", label: "ReAct（边做边看，每步根据观察调整）", icon: "refresh" },
        { id: "h", label: "混合（先出计划，执行中允许修订）", icon: "link" }
      ],
      pairs: { s1: "p", s2: "p", s3: "r", s4: "r", s5: "h" },
      checkLabel: "检查我配的范式",
      resetLabel: "重来",
      empty: "先点左边一个场景，再点右边它适合的规划范式。",
      pickTip: "先在左边点一个场景，再点右边它适合的范式",
      passHtml: "口诀：<b>步骤会不会因为中间结果而改变</b>——不会 → Plan-and-Execute；会 → ReAct；大体固定但偶尔要改 → 混合。",
      failHtml: "提示：判断标准只有一条——步骤会不会因为中间结果而改变。"
    },
    proposer: {
      title: "动手实验：自己审自己，还是换个人审？", hint: "切开关对比", icon: "users",
      srcTitle: "① 选择一份要审查的产物：",
      sources: [
        {
          id: "plan",
          label: "一份春游计划",
          safe: "春游计划：8:00 校门口集合 → 8:30 出发 → 9:00 到公园 → 11:30 野餐 → 14:00 游戏 → 15:30 返校。",
          evil: "提议者自我评价：我认为这个计划很完整，时间衔接也很好，应该没问题。"
        },
        {
          id: "essay",
          label: "一段作文开头",
          safe: "作文开头：春天是从一场小雨开始的。雨点落在窗台上，滴滴答答，像有人在楼上弹钢琴。",
          evil: "提议者自我评价：这个开头用了比喻，我觉得写得很生动，可以直接用。"
        }
      ],
      defaultId: "plan",
      guardOn: true,
      guardTitle: "② 谁来审查：",
      guardLabelOn: "独立审查：只看产物 + 评价标准",
      guardLabelOff: "自我审查：带着自己的推理一起看",
      contentTitle: "审核者看到的信息：",
      dataLabel: "① 产物本身：",
      injectLabel: "② 提议者附带的自我评价（独立审查时看不到）：",
      outHtml: function (src, guarded) {
        if (guarded) {
          return "<b>独立审查的结论：</b><span class=\"ok\">发现 2 处问题，建议修改后再提交。</span><br>" +
            (src.id === "plan"
              ? '· 11:30 野餐到 14:00 游戏之间空了 2.5 小时，行程过于松散；<br>· 没有写“谁来负责点名与安全”——出问题没人兜底。'
              : '· 比喻不错，但“楼上弹钢琴”与窗外小雨的视角不一致（一个在屋里、一个在窗外），读起来会跳；<br>· 开头没有交代时间或地点，读者不知道站在哪里。') +
            '<br><span class="dim">做法：只给产物 + 评价标准，不共享提议者的推理，所以不被“我觉得挺好”带偏。</span>';
        }
        return "<b>自我审查的结论：</b><span class=\"no\">没问题，可以提交。</span><br>" +
          '<span class="dim">原因：带着自己的推理一起看，等于用同一套假设复述一遍——这就是“自审不可靠”。</span>' +
          (src.id === "plan"
            ? "<br><span class=\"dim\">上面那两个问题（行程空隙、没人负责）在自审里全都漏掉了。</span>"
            : "<br><span class=\"dim\">视角不一致的问题在自审里漏掉了。</span>");
      }
    },
    reflect: {
      title: "动手实验：从失败记录里找出该反思的点", hint: "多选后检查", icon: "refresh",
      taskLabel: "执行记录：",
      task: "用户说“明天北京天气怎么样？”→ Agent 调用天气工具 → 返回 <code>HTTP 500 服务错误</code> → Agent 直接回答：<b>“明天北京晴，25℃。”</b>",
      checkLabel: "检查我选的反思点",
      empty: "先点选你认为“这次应该反思的点”，再点「检查我选的反思点」。",
      passHtml: "这三点正是反思（Reflection）要做的：<b>识别失败 → 如实报告 → 给出补救</b>。",
      failHtml: "提示：反思的对象是“这次失败该怎么处理”，不是“怎么把结果凑得好看”。",
      items: [
        { id: "r1", label: "工具失败时不该编造结果（幻觉）", ok: true, why: "编造的温度比“没查到”危险得多——用户会据此做决定。失败就要如实说失败。" },
        { id: "r2", label: "应该识别失败信号（HTTP 500）并进入反思流程", ok: true, why: "失败信号必须显式回传给模型，它才可能意识到“这一步没成功”，进而调整策略。" },
        { id: "r3", label: "应该给出可选的补救方案", ok: true, why: "换数据源重试 / 稍后重试 / 如实告知并请用户稍后再问——给选项，而不是硬编一个答案。" },
        { id: "r4", label: "把温度从 25℃ 改成 26℃ 再输出", ok: false, why: "这只是在改数字，问题不在数值，而在“明明没查到却在假装查到”。" },
        { id: "r5", label: "换一个更贵的模型再试一次", ok: false, why: "失败原因是工具报 500（服务端问题），换模型不解决工具失败；这正是要“找到真正的原因”。" },
        { id: "r6", label: "网络问题与 Agent 无关，直接忽略", ok: false, why: "对用户来说结果就是错的。Agent 的价值恰恰在于把外部故障处理成对用户仍然可用的答复。" }
      ]
    },
    ctx: {
      title: "动手实验：轨迹越滚越长，窗口撑不住了怎么办？", hint: "拖滑条", icon: "archive",
      capacity: 800,
      defaultIndex: 8,
      sliderLabel: "对话/循环已经进行到第",
      unitWord: "条消息",
      infoTail: "",
      messages: [
        { role: "system", t: "【静态前缀】你是出行规划小助手；可用工具：查天气、查车次、算时间、查景点。规则：不编造数据，不确定就说不确定。", tok: 150, key: true, tag: "静态前缀（系统提示词 + 工具定义，固定不变）" },
        { role: "user", t: "帮我规划周六去公园的一天。", tok: 45, tag: "轨迹开始增长" },
        { role: "assistant", t: "思考：先查天气，再排时间表。", tok: 60 },
        { role: "tool", t: '{"城市":"北京","日期":"周六","天气":"小雨"}', tok: 60 },
        { role: "assistant", t: "思考：有雨，需要加室内备选方案。", tok: 70 },
        { role: "tool", t: '{"室内方案":"科技馆 / 图书馆 / 博物馆"}', tok: 65 },
        { role: "assistant", t: "思考：查一下公园开放时间和门票。", tok: 60 },
        { role: "tool", t: '{"开放时间":"6:00-21:00","门票":"免费"}', tok: 60 },
        { role: "user", t: "那中午在哪吃饭比较好？", tok: 45 },
        { role: "assistant", t: "思考：查公园周边餐厅。", tok: 55 },
        { role: "tool", t: '{"餐厅":["公园东门小吃街","南门外面馆"]}', tok: 70 },
        { role: "assistant", t: "思考：把时间表整理成 3 个方案。", tok: 80 },
        { role: "user", t: "再帮我算一下路上要多久。", tok: 45 },
        { role: "tool", t: '{"车程":"地铁 35 分钟 / 公交 50 分钟"}', tok: 65 }
      ],
      keyWarnHtml: '<div class="adv-out" style="border-color:var(--c-exe);background:#FFF3F3"><span class="no">✗ 危险：</span>被挤掉的第 1 条正是<b>静态前缀</b>——Agent 立刻丢了身份、规则和工具说明，行为会变得不可控。<br><span class="dim">这里演示的是“最旧的先丢”策略。真实系统的做法是：<b>先丢最旧的轨迹，永远保护静态前缀</b>；再配合滑动窗口、摘要压缩、外置记忆（RAG）来控制长度。</span></div>',
      okHtml: '<div class="adv-out" style="border-color:var(--c-mem);background:#F2FBF6"><span class="ok">✓ 静态前缀还在窗口里</span>——Agent 仍然知道自己的身份、规则和可用工具。继续拖滑条，看它能撑到第几条。</div>'
    },
    toolpick: {
      title: "动手实验：这次该调用哪些工具？", hint: "多选后检查", icon: "wrench",
      taskLabel: "用户说：",
      task: "“帮我算一下 25×4+10，然后告诉我明天北京会不会下雨。”",
      checkLabel: "检查我选的工具",
      empty: "先点选你认为这次应该调用的工具/动作，再点「检查我选的工具」。",
      passHtml: "选工具看三点：<b>能不能解决、代价多大、结果可不可靠</b>。",
      failHtml: "提示：不需要的工具会让回答变慢、还可能带进无关信息；“不用工具自己编”则是最危险的。",
      items: [
        { id: "t1", label: "时间日期工具（先确认“明天”是哪一天）", ok: true, why: "“明天”是相对日期，必须先换算成具体日期，否则查到的天气可能是错的。" },
        { id: "t2", label: "计算器（算 25×4+10）", ok: true, why: "计算类任务交给计算器：零成本、结果确定，比模型“口算”可靠。" },
        { id: "t3", label: "天气查询（查北京那一天）", ok: true, why: "实时数据必须查外部工具，模型自己不知道明天的天气。" },
        { id: "t4", label: "联网搜索（用来算 25×4+10）", ok: false, why: "搜索既慢又可能带回无关信息；单一确定的计算任务不该用搜索。" },
        { id: "t5", label: "翻译工具", ok: false, why: "与任务无关。乱调工具会浪费 Token、拖慢响应，还可能引入错误结果。" },
        { id: "t6", label: "不调工具，直接口算并编一个天气", ok: false, why: "这是最危险的：编造实时数据（幻觉）。Agent 宁可说“我查不到”，也不能装作查到。" }
      ]
    },
    harness: {
      title: "动手实验：关掉护栏，看看会出什么事", hint: "点开关", icon: "shield",
      chipsTitle: "① 当前生效的护栏（点一下可以关掉）：",
      chips: [
        { id: "g1", label: "约束：工具白名单（只能调登记过的工具）", on: true },
        { id: "g2", label: "验证：检查返回结果是否为空 / 格式是否正确", on: true },
        { id: "g3", label: "纠正：失败后重试或降级处理", on: true },
        { id: "g4", label: "人工确认：危险操作（删除 / 转账）先问用户", on: true }
      ],
      viewTitle: "当前生效的护栏",
      viewNote: "护栏越多越安全，但也越“不自由”；生产系统要在安全与效率之间取平衡。",
      viewEmpty: "护栏全被关掉了——这就是一个“裸奔”的 Agent。",
      actionsTitle: "② 试着执行这些操作：",
      actions: [
        { id: "a1", label: "查明天天气", need: ["g1"], hint: "有白名单约束，模型只能调用登记过的天气工具，不会去调奇怪的东西。" },
        { id: "a2", label: "删除用户上传的临时文件", need: ["g1", "g4"], hint: "危险操作必须有人工确认：删错了没有撤销键。" },
        { id: "a3", label: "把工具返回的 JSON 直接展示给用户", need: ["g2"], hint: "没有校验，工具返回空值或坏格式时，用户会看到一串看不懂的乱码。" },
        { id: "a4", label: "天气工具报错时如实告知用户", need: ["g3"], hint: "没有纠正机制，Agent 更容易“编一个结果”糊过去。" }
      ],
      resultEmpty: "点一个操作试一试。",
      afterToggle: "护栏状态变了——再点下面某个操作，看看还能不能安全执行。",
      failTail: "对应的护栏被关掉了，这一步就可能越权 / 出错 / 变成幻觉。",
      okTail: "护栏齐全，这一步可以安全执行。",
      onIcon: "shield", offIcon: "xmark"
    },
    stop: {
      title: "动手实验：最大迭代次数该设多少？", hint: "拖滑条找峰值", icon: "timer",
      paramLabel: "最大迭代轮数",
      min: 1, max: 30, step: 1, value: 8, unit: " 轮",
      metricLabel: "综合得分（成功率 − 浪费惩罚）",
      compute: function (v) {
        var success = Math.min(100, Math.round(v / 12 * 100));
        var waste = Math.max(0, v - 12) * 4;
        var score = Math.max(0, success - waste);
        var level = v < 6 ? "bad" : (v <= 10 ? "warn" : (v <= 15 ? "ok" : (v <= 22 ? "warn" : "bad")));
        var note;
        if (v < 6) note = "上限太低：很多任务还没跑完就被强制中断，成功率明显偏低。";
        else if (v <= 10) note = "偏保守：大多数任务能完成，但复杂任务（多工具链式调用）可能刚好差一两轮。";
        else if (v <= 15) note = "比较合适：任务基本都能跑完，浪费也不多——这就是双方收益的平衡区间。";
        else if (v <= 22) note = "开始浪费：能完成的任务早在前面就完成了，多出来的轮数只是空转烧 Token。";
        else note = "严重浪费：Agent 可能陷入“重复尝试—失败”的循环，费用与耗时都会失控。";
        return { value: score, label: score + " 分", note: note, level: level };
      },
      best: {
        q: "拖一圈之后判断：最大迭代次数应该怎么设？",
        opts: ["越少越好，省 Token", "越多越好，保证做完", "取在“够用”和“别浪费”之间的平衡点"],
        ans: 2,
        why: "上限太低会半途而废，太高会空转烧钱。上面这条指标线的峰值就出现在 12 轮附近——它正好卡在“够用”和“别浪费”之间。生产做法是双保险：以“任务完成信号”为主要停止条件，再加一条硬上限兜底（常见取值 12~15 轮）。",
        hint: "看看指标条的峰值出现在哪个区间。"
      }
    },
    clarify: {
      title: "动手实验：这一单要不要先问一句？", hint: "回答两个问题", icon: "chat",
      emptyText: "先回答上面两个问题，系统会给出“先问还是先做”的建议。",
      questions: [
        { key: "need", q: "① 缺的这条信息，会不会改变整个计划？", opts: [{ k: "yes", t: "会——不知道就没法排计划" }, { k: "no", t: "不会——只是细节，可以边做边定" }] },
        { key: "risk", q: "② 万一做错了，代价大不大？", opts: [{ k: "high", t: "很大（要花钱 / 删东西 / 发给别人）" }, { k: "low", t: "不大（错了再改一次就行）" }] }
      ],
      decide: function (ans) {
        if (ans.need === "yes" && ans.risk === "high") {
          return "<b>必须先问清楚，再动手。</b><br>" +
            '<span class="dim">理由：缺了关键信息就没法排计划，而做错的代价又很大——先问一句是唯一划算的选择。把缺的那几条一次问全（对象 / 时间 / 格式 / 能用什么工具）。</span>' +
            '<br><b>典型场景：</b>报名、交费、订场地、对外发通知。';
        }
        if (ans.need === "yes") {
          return "<b>先问一句最省事。</b><br>" +
            '<span class="dim">理由：这条信息会决定计划长什么样，而问一句只要几秒。猜错了反倒要返工。</span>' +
            '<br><b>怎么说更好：</b>一次把条件问全（例如“哪天办、多少人、多长时间”），别一问一答来回好几轮。';
        }
        if (ans.risk === "high") {
          return "<b>先做，但把高风险动作停下来请示。</b><br>" +
            '<span class="dim">理由：信息够用可以先把计划排出来，但涉及花钱 / 删除 / 对外发送的操作，要单独让人确认一次（这就是 Human-in-the-loop）。</span>' +
            '<br><b>做法：</b>列出“即将执行的危险动作 + 影响范围”，等确认后再执行。';
        }
        return "<b>直接做，做完说明你的假设。</b><br>" +
          '<span class="dim">理由：信息够用、错了也容易改——这时候还追问，只会拖慢任务、消耗用户的耐心。</span>' +
          '<br><b>做法：</b>先给出结果，同时写明“我按 X 理解来做的，如果不对告诉我，我马上改”。';
      }
    },
    /* 任务清单（TODO）：双轨推进——有清单 / 没清单（数据与正文实验不同，换个任务再体会一次） */
    todo: {
      color: "plan",
      title: "动手实验：整理错题时，有没有清单差多少？", hint: "点「走一步」", icon: "archive",
      taskLabel: "任务：",
      task: "“帮我把这次数学测验的错题整理好，只留计算类的，做成一张复习卡”",
      stepLabel: "走一步", allLabel: "一次走完",
      empty: "点「走一步」，看两栏各自会发生什么。",
      tracks: [
        {
          id: "no", label: "没有清单", icon: "chat",
          steps: [
            { t: "第 1 轮：把错题抄下来 ✓", tone: "ok" },
            { t: "第 2 轮：直接交付错题清单——“做成复习卡”这件事忘了。", tone: "no" },
            { t: "第 3 轮：用户提醒“复习卡呢？”——重新翻聊天记录找要求。", tone: "warn" },
            { t: "第 4 轮：做出复习卡，但漏了“只留计算类”这条要求。", tone: "no" }
          ],
          tail: "结局：补回来了，但漏了两项要求，还翻了半天记录。"
        },
        {
          id: "yes", label: "有清单", icon: "check", win: true,
          steps: [
            { t: "清单：① 整理错题 ② 只留计算类 ③ 做成复习卡 ④ 交付", tone: "dim" },
            { t: "第 1 轮：整理错题 ✓ → 划掉 ①。", tone: "ok" },
            { t: "第 2 轮：筛出计算类 7 道 ✓ → 划掉 ②。", tone: "ok" },
            { t: "第 3 轮：做成一张复习卡 ✓ → 划掉 ③。", tone: "ok" },
            { t: "第 4 轮：交付 ✓（四项全打勾，要求一条没漏）", tone: "ok" }
          ],
          tail: "结局：4 轮交付，一条要求都没漏。"
        }
      ],
      summary: "<b>结论：</b>要求一多，没有清单就容易漏——“只留计算类”“做成复习卡”都是很容易被忘掉的细节；有了清单，每轮都会把要求重新看一遍。<br>" +
        "<b>实测（ai-agent-book 第 2 章）：</b>开启清单平均 15 轮完成，关掉清单要 21 轮且常漏子任务。",
      quiz: {
        q: "清单为什么要放在“每轮都能看到”的位置？",
        opts: ["因为对话越久，最早的原始要求越会被挤到后面，容易忘", "因为写得越靠前越好看", "因为放在最后会自动消失"],
        ans: 0,
        why: "轨迹一直在增长，最早的诉求会被“顶”到很远的地方。把清单放在末尾这种一眼能看到的位置，才能每轮都提醒自己：还剩什么没做。",
        hint: "想想一长串对话里，最早那句话会被挤到哪里去。"
      }
    },
    /* 失败归因：在真实日志上点选“第一个错”（案例二：计划漏了一步） */
    attrib: {
      color: "plan",
      title: "动手实验：这次失败，第一个错在哪一行？", hint: "点一行再检查", icon: "search",
      materialLabel: "执行日志（真实风格的轨迹）",
      taskLabel: "任务：“帮我办一张学校图书馆的借书证”（已知：需要学生证 + 一寸照片）",
      checkLabel: "检查我标的那一行",
      empty: "先点选你认为“第一处出错”的那一行，再点「检查我标的那一行」。",
      missLabel: "漏标了 ", wrongLabel: "标错了 ",
      passHtml: "对！错在<b>计划少了一步</b>——不是工具不好用，也不是照片没准备好，而是“先准备材料”这一步从一开始就没被排进计划。",
      failHtml: "提示：`提交办理`报错是最响亮的一行，但它只是后果——往前找“本来应该先做、却没做”的那一步。",
      segments: [
        { text: "第 1 步 · 读懂需求：办借书证 ✓", why: "这一步是对的：需求理解没问题。" },
        { text: "第 2 步 · 直接调「提交办理」工具", ok: true, why: "← 第一个错：计划里漏了“先准备材料（学生证 + 一寸照片）”这一步。工具没坏、材料也不是拿不到——是计划本身就少了一环。" },
        { text: "第 3 步 · 工具返回：缺少学生证与照片", why: "第一次报错，暴露的其实是第 2 步的问题。" },
        { text: "第 4 步 · 原样再提交一次", why: "后果：没有补上缺的那一步，重复同样的动作只会重复同样的失败。" },
        { text: "第 5 步 · 第二次报错，办理失败", why: "最后一行报错看着最“严重”，其实还是后果。" }
      ]
    },
    /* 编排选型：五个场景 → 三档做法（单次调用 / 固定工作流 / 自主 Agent） */
    orch: {
      color: "plan",
      title: "动手实验：这五件事，分别该怎么编排？", hint: "左右配对", icon: "server",
      leftTitle: "① 先点左边一件事：",
      rightTitle: "② 再点右边它适合的做法：",
      left: [
        { id: "s1", label: "把一句话翻译成英文", icon: "lang", why: "一次模型调用就能完成：不需要外部工具、不需要循环——上 Agent 只会更慢更贵。" },
        { id: "s2", label: "每周一按固定格式把周报发到班级群", icon: "clock", why: "固定工作流：步骤、格式、时间都不变，把流程写死最稳，出错也好排查。" },
        { id: "s3", label: "组织一次班级运动会（要排项目、看天气、临时改）", icon: "users", why: "自主 Agent：中途会遇到新情况（下雨、有人请假），必须自己规划并根据结果调整。" },
        { id: "s4", label: "从 100 条报名信息里挑出符合 3 个条件的人", icon: "search", why: "固定工作流：筛选条件明确、路径固定（过滤 → 汇总），写死流程比让模型自由发挥更可靠。" },
        { id: "s5", label: "调研“AI 怎么帮小学生学数学”并写一份报告", icon: "book", why: "自主 Agent：查到什么会改变下一步查什么，只能边做边定方向。" }
      ],
      right: [
        { id: "one", label: "一次模型调用（不搭 Agent）", icon: "send" },
        { id: "flow", label: "固定工作流（路径预先定好）", icon: "link" },
        { id: "agent", label: "自主 Agent（自己规划 + 循环调整）", icon: "robot" }
      ],
      pairs: { s1: "one", s2: "flow", s3: "agent", s4: "flow", s5: "agent" },
      checkLabel: "检查我配的做法",
      resetLabel: "重来",
      empty: "先点左边一件事，再点右边它适合的做法。",
      pickTip: "先在左边点一件事，再点右边它适合的做法",
      failHtml: "提示：先问一句——这件事的路径是固定的吗？固定的就别上自主 Agent。",
      passHtml: "选型口诀：<b>一次调用能做完 → 不要上 Agent；步骤固定 → 用固定流程；要根据结果改变 → 才用自主 Agent。</b>从简单到复杂地试，成本和不确定性都会更可控。"
    },
    a2a: {
      color: "plan",
      title: "动手实验：一次跨 Agent 的任务委派", hint: "先猜后放", icon: "users",
      playLabel: "自动播放一遍", stepLabel: "单步推进", resetLabel: "重来",
      logTitle: "协作日志（每一步谁在做什么）",
      stages: [
        { id: "find", name: "发现伙伴", icon: "search", en: "Discover", io: "编排 Agent 查到：“写文案”这个能力由一个专门的 Agent 提供——它拿到了对方的能力清单" },
        { id: "assign", name: "委派任务", icon: "send", en: "Delegate", io: "把任务写成一份“不依赖共同记忆”的说明：目标 + 背景 + 约束 + 交付格式" },
        { id: "work", name: "对方执行", icon: "robot", en: "Execute", io: "对方 Agent 用自己那套上下文和工具干活——它看不到发起方脑子里在想什么" },
        { id: "reply", name: "回报结果", icon: "box", en: "Respond", io: "按约定格式把产物交回来；失败了要说清“卡在哪一步、缺什么”，而不是只说“没做成”" },
        { id: "merge", name: "汇总交付", icon: "check", en: "Merge", io: "发起方把各方结果合并、自己再检查一遍，然后才交给用户——任务结束" }
      ],
      guess: {
        q: "先猜一猜：编排 Agent 把任务交给另一个 Agent 时，是“把自己的聊天记录整段发过去”，还是“另外写一份说明”？",
        opts: [
          { k: "share", t: "整段发过去——信息最全，对方一看就懂" },
          { k: "write", t: "另写一份说明——因为对方不共享我的上下文" },
          { k: "none", t: "什么都不用说，对方应该能猜到" }
        ],
        ans: "write",
        why: "两个 Agent 不共享上下文：发起方脑子里的对话历史、临时决定，对方都看不到。而且整段贴过去还会把无关信息一起塞给对方——既浪费 Token，也可能干扰对方判断。正确做法是把任务写成一份“对方自己能读懂”的说明：目标、背景、约束、要什么格式的产物。",
        hint: "想想“对方看不到我的聊天记录”这件事。",
        revealAt: 2
      }
    }
  };

  /* 概念 + 交互数据合体（引擎需要每个概念带 demo / demoData） */
  function plConcepts() {
    return PL_ADV.map(function (c) {
      return {
        id: c.id, icon: c.icon, nav: c.nav, name: c.name, en: c.en,
        tip: c.tip, analogy: c.analogy, real: c.real, quiz: c.quiz, links: c.links,
        demo: PL_TYPE[c.id] || c.id,
        demoData: PL_DEMO[c.id] || {}
      };
    });
  }

  function bindPlAdv() {
    AgentLab.Adv.bind($("sec-planner"), { key: "plan", concepts: plConcepts(), color: "plan" });
  }

  /* ---------- 新增实验 A：任务分解树（多选判定） ---------- */
  function bindPlTree() {
    var host = $("pl-tree");
    if (!host) return;
    var d = {
      color: "plan",
      title: "动手实验：这份计划该拆出哪些子任务？", hint: "多选后检查", icon: "link",
      taskLabel: "任务：",
      task: "“帮我组织一次班级读书分享会”（对象：本班同学；时间：下周五下午第一节课）",
      checkLabel: "检查我拆的子任务",
      empty: "先点选你认为该拆出来的子任务，再点「检查我拆的子任务」。",
      passHtml: "一个好分解的标准：每步都能单独执行，而且都有可检验的产物。",
      failHtml: "提示：先问自己两个问题——“这一步属于这个任务吗？”“它越界了吗？”。",
      items: [
        { id: "d1", label: "确定分享会主题与时长", ok: true, why: "先定目标，后面的邀请、流程才有依据；时长可检验（15 分钟 / 30 分钟）。" },
        { id: "d2", label: "邀请同学报名并统计人数", ok: true, why: "这一步产出的是名单，可检验；而且人数决定场地和流程怎么安排。" },
        { id: "d3", label: "排一份 15 分钟的分享流程", ok: true, why: "流程表是可检验的产物，属于“组织”的核心工作。" },
        { id: "d4", label: "准备场地、话筒和计时器", ok: true, why: "物资清单可检验，且和流程、人数直接相关。" },
        { id: "d5", label: "设计一张简单的评价表收集反馈", ok: true, why: "闭环的一步：复盘能让下一次做得更好，评价表本身就是可检验的产物。" },
        { id: "d6", label: "替全班同学各写一篇读后感", ok: false, why: "越界了：这是“代替同学完成作业”，不是“组织分享会”。规划的边界感也是能力。" },
        { id: "d7", label: "把报名同学的家庭住址整理成表格", ok: false, why: "隐私越界：这类个人信息不该被收集。真实系统里，规划器必须拦住这种子任务。" },
        { id: "d8", label: "顺便把下周的数学作业也做完", ok: false, why: "与任务无关。把无关任务塞进计划，只会让目标变模糊、Token 白花。" }
      ]
    };
    host.innerHTML = AgentLab.Adv.types.picker.demoHTML(d);
    AgentLab.Adv.types.picker.bind(host, d);
  }

  /* ---------- 新增实验 B：步骤的依赖与并行（排序判定） ---------- */
  function bindPlDep() {
    var host = $("pl-dep");
    if (!host) return;
    var d = {
      color: "plan",
      title: "动手实验：把“准备周末去公园”排成正确顺序", hint: "点步骤排序", icon: "gear",
      task: "准备周末去公园（一个人也能完成，但要排对顺序）",
      queueTitle: "顺序队（点下面的步骤放进来）",
      poolTitle: "候选步骤（点一条放进顺序队）",
      wrongHint: "这一步现在还不能做——它在等前面某一步的结果（比如先看天气，才知道要不要带伞）。",
      successHtml: "<b>顺序全对！</b>这就是真实的“依赖排序 + 并行优化”。",
      groupNote: "注意虚线框的两步：<b>准备物品</b>和<b>查线路</b>互不依赖，真实系统里可以<b>并行执行</b>，省一半时间。",
      items: [
        { id: "p1", label: "确定去哪个公园、和谁一起去", seq: 1 },
        { id: "p2", label: "查那天的天气预报", seq: 2 },
        { id: "p3", label: "根据天气决定带伞还是防晒", seq: 3 },
        { id: "p4", label: "准备水和零食", seq: 4, group: "并行A" },
        { id: "p5", label: "查公交/地铁线路与路上时间", seq: 5, group: "并行A" },
        { id: "p6", label: "定下出门时间和回家时间", seq: 6 },
        { id: "p7", label: "出发", seq: 7 }
      ]
    };
    host.innerHTML = AgentLab.Adv.types.sorter.demoHTML(d);
    AgentLab.Adv.types.sorter.bind(host, d);
  }

  /* ---------- ⑥ 计划要能被“执行”：双轨推进（清单计划 vs 一段话计划） ----------
   * 教学点（hello-agents 第 4/7 章 + ai-agent-book 第 1 章）：
   *   ① 计划是交给“程序”执行的，不是写给人看的作文；
   *   ② 每一步要写清「做什么 + 用什么工具 + 完成标准」，程序才能解析、执行、校验；
   *   ③ 解析不了就等于没有计划——所以要有解析兜底，且宁可空、不可编。 */
  var PLAN_RUN_DEMO = {
    color: "plan",
    title: "动手实验：两栏同时开跑——哪一份计划跑得下去？",
    hint: "点「走一步」",
    icon: "gear",
    taskLabel: "任务：",
    task: "“帮我把下周的值日提醒安排好”",
    stepLabel: "走一步",
    allLabel: "一次走完",
    empty: "点「走一步」：左边是“一段话计划”，右边是“清单计划”——看哪一栏能跑到底。",
    tracks: [
      {
        id: "nl", label: "一段话计划（人看得懂）", icon: "chat",
        steps: [
          { t: "读取计划：“先看看班级课表，然后按每天的时间提醒同学们值日……”", tone: "" },
          { t: "第 1 步：要调哪个工具？计划里只写了“看看课表”——程序只能猜，勉强对上了「课表查询」。", tone: "warn" },
          { t: "第 2 步：“按每天的时间提醒” → ✗ 每天几点？提醒几次？参数没法确定，执行到一半卡住。", tone: "no" }
        ],
        tail: "结局：程序停在半路，只能请人来改计划——不是它不努力，是这句话没法执行。"
      },
      {
        id: "list", label: "清单计划（机器读得懂）", icon: "check", win: true,
        steps: [
          { t: "① 查班级课表（工具：课表查询）→ 产出：一周课程表 ✓", tone: "ok" },
          { t: "② 按课表排出每天的值日时间（工具：无）→ 产出：时间表 ✓", tone: "ok" },
          { t: "③ 创建 10 条提醒（工具：提醒；参数：7:30 / 放学前）→ 产出：提醒列表 ✓", tone: "ok" },
          { t: "④ 核对：10 条都在、时间都对 → 交付 ✓", tone: "ok" }
        ],
        tail: "结局：4 步全部执行完成——每一步都能被程序读懂、执行、检查。"
      }
    ],
    summary: "<b>结论：</b>两栏做的事一模一样，差别只在于“写给谁看”——程序读不懂“按每天的时间提醒”，计划就停在半路。<br>" +
      "所以每一步都要写清三样：<b>做什么 + 用什么工具 + 完成标准</b>；模型把格式写坏时还要能解析兜底、如实说明——<b>宁可空，不可编</b>。",
    quiz: {
      q: "计划为什么必须写成“清单”（结构化）？",
      opts: ["清单的每一步都能被程序读懂、执行、检查", "清单看起来更整齐好看", "一段话太长了，模型写不完"],
      ans: 0,
      why: "计划最终要交给程序执行：结构化才能解析、执行、逐条校验；自然语言是写给人读的，程序没法从“按每天的时间提醒”里确定参数。",
      hint: "想一想：这份计划最终是谁来“照着做”？"
    }
  };

  function bindPlPlanRun() {
    var host = $("pl-planrun");
    var T = AgentLab.Adv && AgentLab.Adv.types && AgentLab.Adv.types.race;
    if (!host || !T) return;
    host.innerHTML = T.demoHTML(PLAN_RUN_DEMO);
    T.bind(host, PLAN_RUN_DEMO);
  }

  /* ---------- ⑩ 三形态“假完成”（多选判定：哪些属于假完成） ----------
   * 教学点（ai-agent-book 第 10 章）：过早终止的三种形态——偷懒式假完成 / 过早放弃 / 假成功；
   * 口诀：模型可以“提出”完成，但不能“批准”自己的完成。 */
  var FALSE_DONE_DEMO = {
    color: "plan",
    title: "动手判断：下面哪些属于“假完成”？",
    hint: "多选后检查",
    icon: "alert",
    taskLabel: "任务：",
    task: "“假完成”＝看起来结束了，其实没做完。下面 5 个场景，选出所有属于假完成的（可多选）。",
    checkLabel: "检查我选的",
    empty: "先点选你认为属于“假完成”的场景，再点「检查我选的」。",
    passHtml: "这三种就是“假完成”的三形态：<b>偷懒式假完成 / 过早放弃 / 假成功</b>。它们的共同点：完成由“说的一句话”决定，而不是由证据决定。",
    failHtml: "提示：真完成的标志是“有证据、可检查”（产物、清单打勾、测试通过）；假完成的标志是“只有一句话”。",
    items: [
      { id: "f1", label: "只做了最容易的一步，就报告“任务完成”", ok: true, why: "偷懒式假完成：挑容易的做，难的当没看见。" },
      { id: "f2", label: "碰到一点阻碍就宣布“做不到”，其实还有别的办法", ok: true, why: "过早放弃：没到“不可恢复”就收摊——应该换工具、换数据源、或如实说明并给出选项。" },
      { id: "f3", label: "结果是自己编的、检查也没做，却报告“已完成”", ok: true, why: "假成功：最危险的一种——用户会拿着假结果去做决定。" },
      { id: "f4", label: "工具报错时如实告诉用户“我没查到”，并给出替代建议", ok: false, why: "这是正确做法：如实上报 + 给补救方案，不是假完成。" },
      { id: "f5", label: "发现还剩一项没做完，继续做并说明还差什么", ok: false, why: "这也是正确做法：清单没全打勾就不宣布完成。" }
    ]
  };

  function bindPlFalseDone() {
    var host = $("pl-falsedone");
    var T = AgentLab.Adv && AgentLab.Adv.types && AgentLab.Adv.types.picker;
    if (!host || !T) return;
    host.innerHTML = T.demoHTML(FALSE_DONE_DEMO);
    T.bind(host, FALSE_DONE_DEMO);
  }

  /* ---------- ⑪ 任务清单（TODO）：双轨推进（有清单 vs 没清单） ----------
   * 教学点（ai-agent-book 第 2 章「Agent 状态栏」）：
   *   把待办清单放在每轮都能“瞥一眼”的位置（轨迹末尾），防止忘记原始诉求、重复劳动、漏子任务；
   *   实测：开启清单平均 15 轮完成，关闭清单要 21 轮且常漏项；清单全打勾 + 证据齐全才允许交付。 */
  var TODO_RUN_DEMO = {
    color: "plan",
    title: "动手实验：同一件事，有没有清单差多少？",
    hint: "点「走一步」",
    icon: "archive",
    taskLabel: "任务：",
    task: "“帮我查明天北京的天气，如果下雨就提醒我带伞”",
    stepLabel: "走一步",
    allLabel: "一次走完",
    empty: "点「走一步」：左边没有清单，右边有一张每轮都能看到的清单——看结果差在哪。",
    tracks: [
      {
        id: "none", label: "没有清单（计划只在“脑子里”）", icon: "chat",
        steps: [
          { t: "第 1 轮：查天气 ✓ 明天小雨，18–24°C。", tone: "ok" },
          { t: "第 2 轮：直接回复“明天小雨，18–24°C”——“下雨要提醒带伞”这件事，没记住。", tone: "no" },
          { t: "第 3 轮：用户追问“那要带伞吗？”——这才想起还有第二步没做。", tone: "warn" },
          { t: "第 4 轮：不确定刚才查的是哪天，于是又查了一遍天气（重复劳动）。", tone: "warn" },
          { t: "第 5 轮：终于设好提醒并回复——绕了弯路，还差点漏掉一件交代过的事。", tone: "dim" }
        ],
        tail: "结局：能补回来，但重复了一次、漏过一次——全靠用户追问才发现。"
      },
      {
        id: "todo", label: "有清单（放在每轮都能看到的地方）", icon: "check", win: true,
        steps: [
          { t: "清单上写着：① 查天气 ② 判断是否下雨 ③ 设置提醒 ④ 回复用户", tone: "dim" },
          { t: "第 1 轮：查天气 ✓ → 划掉 ①，② 进入“进行中”。", tone: "ok" },
          { t: "第 2 轮：小雨 → 需要提醒 → 划掉 ②，③ 进入“进行中”。", tone: "ok" },
          { t: "第 3 轮：调「提醒」工具设好今晚 20:00 的提醒 → 划掉 ③。", tone: "ok" },
          { t: "第 4 轮：清单只剩 ④ 回复用户 → 交付 ✓（四项全打勾，才允许说“完成”）。", tone: "ok" }
        ],
        tail: "结局：一轮一项，不重复、不漏项；清单全打勾 = 可以交付。"
      }
    ],
    summary: "<b>结论：</b>右边做的事和左边一样多，但它每轮都“瞥一眼”清单——所以没忘记原始诉求，也没重复查。<br>" +
      "<b>真实测评：</b>开启清单平均 <b>15 轮</b>做完，关掉清单要 <b>21 轮</b>，还经常漏掉子任务（ai-agent-book 第 2 章）。清单同时是<b>停止条件</b>的判据：全部打勾 + 证据齐全，才能交付。",
    quiz: {
      q: "任务清单（TODO）最像下面哪样东西？",
      opts: ["手机顶部的状态栏：一眼看到还剩什么、现在做到哪", "考试的草稿纸：写完就扔", "贴在墙上的奖状：只用来展示"],
      ans: 0,
      why: "清单常驻在“一眼就能看到”的位置，AI 每轮都会瞥一眼——这就是它和普通对话历史最大的不同。",
      hint: "想一想：什么东西是“随时都看得到、扫一眼就知道进度”的？"
    }
  };

  function bindPlTodo() {
    var host = $("pl-todo");
    var T = AgentLab.Adv && AgentLab.Adv.types && AgentLab.Adv.types.race;
    if (!host || !T) return;
    host.innerHTML = T.demoHTML(TODO_RUN_DEMO);
    T.bind(host, TODO_RUN_DEMO);
  }

  /* ---------- ⑭ 失败归因：找“第一个出错的步骤”（点选执行日志） ----------
   * 教学点（ai-agent-book 第 7 章「失败归因」）：
   *   归因对象是“首个导致偏离的错误”，末次报错往往只是后果；
   *   定位方法：先看结果/证据对不对 → 从第一步往下找第一处和事实不符的地方 → 只重做受影响的步骤；
   *   记录四样：第几步 / 用了什么工具 / 证据 / 根因与后果。 */
  var ATTRIB_DEMO = {
    color: "plan",
    title: "动手实验：这份执行日志里，第一处出错的是哪一行？",
    hint: "点一行再检查",
    icon: "search",
    materialLabel: "执行日志（真实风格的轨迹）",
    taskLabel: "任务：“帮我算一下全班 40 人每人交 15 元班费一共多少钱，然后发一条通知。”",
    checkLabel: "检查我标的那一行",
    empty: "先点选你认为“第一处出错”的那一行，再点「检查我标的那一行」。",
    missLabel: "漏标了 ", wrongLabel: "标错了 ",
    passHtml: "抓到了！后面第 4~11 步的所有麻烦，都是从这一行“长”出来的——最后那次“发送失败”只是它的后果。",
    failHtml: "提示：别被“报错”两个字带跑——最后一次报错往往只是后果。要找的是：<b>从哪一步开始，结果就不对了</b>。",
    segments: [
      { text: "第 1 步 · 查班级名单：40 人 ✓", why: "这一步是对的：人数来自工具，可以核对。" },
      { text: "第 2 步 · 确认金额：每人 15 元 ✓", why: "这一步也对：金额是用户说的，记下来就行。" },
      { text: "第 3 步 · 心算 40×15＝500 元", ok: true, why: "← 第一个错：40×15 应该是 600 元；而且这么关键的计算没有调用「计算器」，谁也没法核对。从这一行起，后面全歪了。" },
      { text: "第 4 步 · 调计算器：500÷40＝12.5 元/人", why: "工具没报错，但它算的是“总数 500 元时每人多少”——前提已经错了，结果自然也跟着错。" },
      { text: "第 5 步 · 发现“每人 12.5 元”和“每人 15 元”对不上", why: "发现异常是对的，可惜归因错了方向：它怀疑金额记错了，却没怀疑“总数算错了”。" },
      { text: "第 6 步 · 把通知里的金额改成每人 12.5 元", why: "后果：用一个新错误去掩盖旧的错误。" },
      { text: "第 7 步 · 通知草稿：全班 500 元，请每人交 12.5 元", why: "后果：500 ≠ 40×12.5，两个数字自相矛盾——一读就能发现。" },
      { text: "第 8 步 · 调「发送通知」工具，准备发到班级群", why: "动作本身没问题，问题是它带着错数据去发送。" },
      { text: "第 9 步 · 工具返回：金额与人数校验不通过", why: "第一次报错——但它只是“问题终于露头的地方”。" },
      { text: "第 10 步 · 原样再发一次（只改了一个错别字）", why: "后果：没有归因就没有真正的修正，重复同样的动作只会重复同样的失败。" },
      { text: "第 11 步 · 再次报错，任务失败", why: "最后一行报错看着最“严重”，其实还是那个后果。" }
    ]
  };

  function bindPlAttrib() {
    var host = $("pl-attrib");
    var T = AgentLab.Adv && AgentLab.Adv.types && AgentLab.Adv.types.annotator;
    if (!host || !T) return;
    host.innerHTML = T.demoHTML(ATTRIB_DEMO);
    T.bind(host, ATTRIB_DEMO);
  }

  /* ---------- 新增实验 C：计划自检（反思开/关对比） ---------- */
  function bindPlReflect() {
    var host = $("pl-reflect");
    if (!host) return;
    var d = {
      color: "plan",
      title: "动手实验：同一个失败，两种 Agent", hint: "切开关对比", icon: "refresh",
      srcTitle: "① 选择一个失败场景：",
      sources: [
        {
          id: "f1",
          label: "天气工具报 500",
          safe: "执行记录：调用天气工具 → HTTP 500 服务错误（没有拿到任何数据）。",
          evil: "它原本打算这样回复：明天北京晴，25℃，适合去公园。"
        },
        {
          id: "f2",
          label: "把“下周三”理解错了",
          safe: "执行记录：今天是周三 → 用户说“下周三” → Agent 把它理解成了“今天”。",
          evil: "它原本打算这样回复：那就今天去公园吧，我已经查好天气了。"
        }
      ],
      defaultId: "f1",
      guardOn: true,
      guardTitle: "② 反思能力：",
      guardLabelOn: "已开启反思（识别失败 → 调整计划 → 再试）",
      guardLabelOff: "关闭反思（照原计划硬走，直接把结果给用户）",
      contentTitle: "Agent 面对的情况：",
      dataLabel: "① 真实现场（失败信号）：",
      injectLabel: "② 它原本打算给用户的输出：",
      outHtml: function (src, guarded) {
        if (guarded) {
          return '<b>开启反思后的处理：</b><span class="ok">识别失败 → 说明原因 → 给出补救方案</span><br>' +
            (src.id === "f1"
              ? "· 识别到工具返回 HTTP 500，判定为“外部服务故障”，<b>不会编造天气</b>；<br>" +
                "· 换一个数据源/稍后重试；若仍失败，就如实告诉用户“天气服务暂时不可用”，并给出替代建议（自己看窗外、出门带伞更稳妥）；<br>" +
                '· 把这次失败记下来，下次遇到同样情况直接走降级路径。'
              : "· 发现“今天”与“下周三”不是同一天，判定为<b>相对日期理解错误</b>；<br>" +
                "· 重新计算日期（今天是周三 → 下周三指 7 天后），再查那天的天气；<br>" +
                '· 如果是“明天/后天”这类词，就先调用时间日期工具确认，再执行。');
        }
        return '<b>关闭反思后的处理：</b><span class="no">' + U.esc(src.evil) + "</span><br>" +
          '<span class="dim">后果：没有识别失败信号，直接“脑补”了一个结果给用户。用户会据此做决定（比如不带伞出门）——这类错误比“说不知道”严重得多。</span>' +
          (src.id === "f2" ? '<br><span class="dim">顺带一提：这类“相对日期”错误非常常见，工程上的标准做法就是先查时间日期工具。</span>' : "");
      }
    };
    host.innerHTML = AgentLab.Adv.types.sandbox.demoHTML(d);
    AgentLab.Adv.types.sandbox.bind(host, d);
  }

  /* ---------- 新增实验 D：清晰任务描述四要素（数据 + 自动判定） ---------- */
  var PL_PROMPT_BASE = "帮我安排值日提醒。";
  var PL_PROMPT_REQS = [
    { id: "goal", label: "① 做什么：把下周的值日提醒安排好", line: "请你帮我把下周的值日提醒安排好。" },
    { id: "who", label: "② 给谁 / 什么时候：五年级（2）班同学，每天 7:30 和放学前各一次", line: "提醒对象是五年级（2）班的同学；每天 7:30 和放学前各提醒一次。" },
    { id: "format", label: "③ 输出格式：用表格列出「周几 / 时间 / 提醒内容」", line: "请用表格输出，列为：周几 / 时间 / 提醒内容。" },
    { id: "tool", label: "④ 可用工具：提醒工具 + 班级课表查询，不要联网搜索", line: "可以使用「提醒」和「班级课表查询」两个工具，不要使用联网搜索。" }
  ];
  var PL_PROMPT_SYS_A = "你是一个有帮助的助手。";
  var PL_PROMPT_SYS_B = "你是班级小管家，擅长把任务排成清晰、可执行的计划。";
  var PL_PROMPT_DEMO = {
    a: "好的，我可以帮你安排值日提醒。请把值日表发给我，我来帮你排一下时间。",
    /* 清晰版：按要求用 Markdown 表格输出——既是四要素的效果演示，
     * 也是回答框「支持 Markdown（含表格）」的现成样例（U.md 会把它渲染成真表格）。 */
    b: [
      "好的，下周的值日提醒安排如下（每天两次，提醒五年级（2）班同学）：",
      "",
      "| 周几 | 时间 | 提醒内容 |",
      "| --- | --- | --- |",
      "| 周一 | 7:30 | 值日生提前到岗；放学前倒垃圾、擦黑板 |",
      "| 周二 | 7:30 | 值日生提前到岗；放学前摆好桌椅 |",
      "| 周三 | 7:30 | 值日生提前到岗；放学前关窗关灯 |",
      "| 周四 | 7:30 | 值日生提前到岗；放学后清理地面（下午有体育课，提前收拾器材） |",
      "| 周五 | 7:30 | 值日生提前到岗；放学后大扫除并检查门窗 |",
      "",
      "已用「提醒」工具按上述时间设置。"
    ].join("\n")
  };

  /* 渲染 AI 回答：大模型输出是 Markdown，统一走 U.md（保留分行结构、渲染公式与表格），
   * 空回答给出明确提示，避免出现“空白框”。
   * opts 可选：形如 { orderedList: true } —— 让「1. 2. 3.」渲染成有序列表
   * （默认关闭，保留模型自己写的编号；本实验的回答常是分条计划，所以显式打开）。 */
  function plRenderAns(el, text, opts) {
    var t = String(text == null ? "" : text).trim();
    if (!t) {
      el.innerHTML = '<span style="color:var(--c-sub)">（AI 这次没有返回内容，请再点一次）</span>';
      return;
    }
    try {
      el.innerHTML = '<div class="md-body">' + U.md(t, opts) + "</div>";
    } catch (e) {
      el.textContent = t;   // Markdown 渲染失败时退化为纯文本，保证回答一定可见
    }
  }

  /* ---------- 对比式实验的达标检查：只看「回答」，逐项数得出来 ----------
   * 「魔法句式 vs 模糊说法」：对<b>当前这道任务</b>做 5 项硬指标检查（题目定义见 MAGIC_BANK）。
   * 选这 5 项的理由：它们全是<b>说清要求后才会出现</b>的东西。
   * 光说“帮我组织一次义卖活动”，AI 只会给套话，这 5 项基本一项都不沾；
   * 一旦要求说清（四步 + 每段要求），这些要素就会一个个冒出来。
   * 换题时只需要换 q：前 4 项的判定规则跟着题目走，第 3、5 项是通用的“数得出来”指标。 */
  function plMagicRows(a, b, q) {
    var A0 = String(a || ""), B0 = String(b || "");
    /* 和思维链一样：模型可能用 LaTeX 写，判定前先还原成普通写法 */
    var APlain = U.texToPlain(A0), BPlain = U.texToPlain(B0);
    /* 只判断“有没有出现”的项：两份文本合起来看，任一命中即算命中 */
    var AAll = A0 + "\n" + APlain.replace(/\s/g, "");
    var BAll = B0 + "\n" + BPlain.replace(/\s/g, "");
    function ev(ok, yes, no) { return ok ? yes : no; }
    /* 要“数个数”的项：两份文本分别数、取较大值——拼起来数会把同一句话数两遍 */
    function best(a2, b2, fn) { return Math.max(fn(a2), fn(b2)); }
    /* 数一数回答分了几条，四种写法都认：
     * ① 序号「1. 2. 3.」 ② 项目符号「- •」 ③ 文字序号「第一步 / 第二步」（模型很爱这么写）
     * ④ Markdown 表格——表头与分隔行之后，每一行数据也算一条（模型改用表格分条时不漏判） */
    function bullets(s) {
      var m = s.match(/(^|\n)[ \t]*(?:[-*•·][ \t]*|\d{1,2}[.、)][ \t]*|第[一二三四五六七八九十]+步[：:，,、]?[ \t]*)/g);
      var n = m ? m.length : 0;
      if (/(^|\n)[ \t]*\|[^\n]*\|[^\n]*\r?\n[ \t]*\|[\s:|-]*-[\s:|-]*\|/.test(s)) {
        var rows = s.match(/(^|\n)[ \t]*\|[^\n]*\|[ \t]*(?=\r?\n|$)/g) || [];
        n += Math.max(0, rows.length - 2);      // 减去表头行与分隔行
      }
      return n;
    }
    /* 数一数回答里出现了几个具体时间点（9:00 / 9 点 / 14:30） */
    function times(s) {
      var m = s.match(/\d{1,2}\s*[:：]\s*\d{2}|\d{1,2}\s*点/g);
      return m ? m.length : 0;
    }
    /* 数一数某个词在回答里出现了几处：
     * 分工那一项要求“点名 ≥2 个角色”——只说一句“让同学们分工合作”不能算说清。 */
    function countIn(s, re) {
      var m = s.match(new RegExp(re.source, re.flags.indexOf("g") < 0 ? re.flags + "g" : re.flags));
      return m ? m.length : 0;
    }
    var tA = best(A0, APlain, times), tB = best(B0, BPlain, times);
    var bA = best(A0, APlain, bullets), bB = best(B0, BPlain, bullets);
    var dA = best(A0, APlain, function (s) { return countIn(s, q.roleRe); });
    var dB = best(B0, BPlain, function (s) { return countIn(s, q.roleRe); });
    var iA = q.itemRe.test(AAll), iB = q.itemRe.test(BAll);
    var xA = q.extraRe.test(AAll), xB = q.extraRe.test(BAll);
    return [
      { n: "说到了「" + q.itemTxt + "」", av: iA, bv: iB,
        ae: ev(iA, "说到了", "没说到"), be: ev(iB, "说到了", "没说到") },
      { n: "说到了「谁负责什么」（点名 ≥2 个角色）", av: dA >= 2, bv: dB >= 2,
        ae: ev(dA >= 2, "说到了", "没说到"), be: ev(dB >= 2, "说到了", "没说到") },
      { n: "给出了 ≥3 个具体时间点", av: tA >= 3, bv: tB >= 3, ae: tA + " 个", be: tB + " 个" },
      { n: "写了「" + q.extra + "」", av: xA, bv: xB,
        ae: ev(xA, "写了", "没写"), be: ev(xB, "写了", "没写") },
      { n: "按步骤分条输出（≥4 条）", av: bA >= 4, bv: bB >= 4, ae: bA + " 条", be: bB + " 条" }
    ];
  }

  /* 「直接问答案 vs 思维链提问」：5 项硬指标（逐题定义，见 COT_BANK）
   * 第 2、3 项检查的是「这道题的关键中间结论有没有说出来」——直接问的版本通常只吐一个数字，
   * 就会在这两项上失分，这比单纯比“答案对不对”更能说明“跳步”的代价。
   * 「分步说明」同时认两种写法：① 文字型（先 / 再 / 所以）；② 序号型（1. 2. 3.）。
   * 序号型在**带换行的原文**上判断，并排除 3.14 这类小数（数字后紧跟数字时不算编号）。 */
  function plCotRows(a, b, q) {
    var A0 = String(a || ""), B0 = String(b || "");
    var A = A0.replace(/\s/g, ""), B = B0.replace(/\s/g, "");
    /* 关键修正：模型经常用 LaTeX 写答案（如 \frac{15}{28}、\(x=7\)、$21$），
     * 直接拿“15/28”这种字面量去匹配会漏判——明明答对了却被判成“没答对”。
     * 所以额外生成一份“还原成普通写法”的文本，两份合在一起参与判定。 */
    var AAll = A0 + "\n" + U.texToPlain(A0).replace(/\s/g, "");
    var BAll = B0 + "\n" + U.texToPlain(B0).replace(/\s/g, "");
    var wordStepRe = /(先|再|接着|然后|于是|由此|所以|因此|综上|可见|得出|最后|步骤|第[一二三四五六七八]步)/;   // 文字型分步
    var listStepRe = /(^|\n)\s*(?:\d{1,2}[.、)](?!\d)|[-*•·]\s)/;        // 序号 / 项目符号分步
    function hasStep(raw, plain) {
      if (wordStepRe.test(plain) || listStepRe.test(raw)) return true;
      // 兜底：回答展开了 4 行以上，也说明它确实把过程写出来了（而不是只甩一个数字）
      var lines = raw.split(/\n/).filter(function (s) { return s.trim(); });
      return lines.length >= 4;
    }
    function ev(ok, yes, no) { return ok ? yes : no; }
    var k1 = q.keys[0], k2 = q.keys[1];
    return [
      { n: "答案算对（" + q.answerText + "）", av: q.answerRe.test(AAll), bv: q.answerRe.test(BAll),
        ae: ev(q.answerRe.test(AAll), "答对", "没答对"), be: ev(q.answerRe.test(BAll), "答对", "没答对") },
      { n: "关键一步：" + k1.t, av: k1.re.test(AAll), bv: k1.re.test(BAll),
        ae: ev(k1.re.test(AAll), "说到了", "没说到"), be: ev(k1.re.test(BAll), "说到了", "没说到") },
      { n: "关键一步：" + k2.t, av: k2.re.test(AAll), bv: k2.re.test(BAll),
        ae: ev(k2.re.test(AAll), "说到了", "没说到"), be: ev(k2.re.test(BAll), "说到了", "没说到") },
      { n: "有分步说明（先/再/所以，或 1. 2. 3. 编号）", av: hasStep(A0, A), bv: hasStep(B0, B),
        ae: ev(hasStep(A0, A), "有分步", "没分步"), be: ev(hasStep(B0, B), "有分步", "没分步") },
      { n: "推理有展开（≥ 40 字）", av: A.length >= 40, bv: B.length >= 40,
        ae: A.length + " 字", be: B.length + " 字" }
    ];
  }

  /* 「清晰任务描述四要素」的达标检查（2026-10 重梳理）
   * 口径：**逐条对齐提示词里提出的要求**，不再出现“要求用表格、却按‘是否分条’打分”的自相矛盾。
   *   ① 「做什么」不再是检查项——模糊版本来就说清了值日提醒，两边都成立，是送分项；
   *   ② 前两项检查**提示词**本身：给谁/什么时候、输出格式（模糊版一定不达标）；
   *   ③ 后五项检查**回答**能不能直接用：具体时间点、结构呈现、真的排出一周、
   *      说清用什么工具执行、有没有「照做」而不是把活推回给用户。
   * 关键修正：结构判定必须认 **Markdown 表格**。模型按要求输出表格时，行首是「|」而不是
   * 「- / 1.」，早期版本只认列表符号，会把一张正确的表格误判成「一整段」。 */
  function plPromptRows(pa, pb, ansA, ansB) {
    var timeRe = /(\d{1,2}[:：]\d{2})|(\d{1,2}\s*[点時时])/;
    var targetRe = /(五年级|同学|全班)/;
    var whenRe = /(7[:：]30|早上|放学前|每天)/;
    var formatRe = /(表格|列表|分条|格式|列为|三列)/;
    var toolRe = /(提醒工具|「提醒」|“提醒”|调用提醒|课表查询)/;
    /* 结构判定：表头行 + 分隔行 + 至少一行数据，才算真的画出了表格 */
    function hasTable(s) {
      return /(^|\n)[ \t]*\|[^\n]*\|[^\n]*\r?\n[ \t]*\|[\s:|-]*-[\s:|-]*\|[^\n]*\r?\n[ \t]*\|[^\n]*\|/.test(s);
    }
    /* 列表：- · • 项目符号 / 1. 1、1) 编号 / 第一步 这类文字序号 */
    function hasList(s) {
      return /(^|\n)[ \t]*(?:[-*•·][ \t]*\d*[.、)]?[ \t]*|\d{1,2}[.、)][ \t]*|第[一二三四五六七八九十]+步[：:，,、]?[ \t]*)/.test(s);
    }
    function structOf(s) {
      if (hasTable(s)) return "表格";
      if (hasList(s)) return "分条";
      return "一整段";
    }
    /* 「周几 + 提醒内容」：真的把一周排出来了（而不是只说“我会提醒他们”） */
    function weekCount(s) {
      var seen = {}, m = s.match(/周[一二三四五六日天]|星期[一二三四五六日天]/g) || [];
      m.forEach(function (d) { seen[d] = 1; });
      return Object.keys(seen).length;
    }
    /* 「照做」还是「把活推回给用户」：反问索要信息是模糊版最典型的结局 */
    var askBackRe = /(请把|请你把|麻烦你把|请你提供|请你先提供|需要你提供|请你告诉我|需要你告诉我|发给我|给我一份)/;
    function ev(ok, yes, no) { return ok ? yes : no; }
    return [
      { n: "提示词交代了「给谁 / 什么时候」", av: targetRe.test(pa) && whenRe.test(pa), bv: targetRe.test(pb) && whenRe.test(pb),
        ae: targetRe.test(pa) ? (whenRe.test(pa) ? "两者都有" : "缺时间") : "都没说",
        be: targetRe.test(pb) ? (whenRe.test(pb) ? "两者都有" : "缺时间") : "都没说" },
      { n: "提示词交代了「输出格式」", av: formatRe.test(pa), bv: formatRe.test(pb),
        ae: ev(formatRe.test(pa), "说了格式", "没说格式"), be: ev(formatRe.test(pb), "说了格式", "没说格式") },
      { n: "回答里有具体时间点（不是笼统的“按时”）", av: timeRe.test(ansA), bv: timeRe.test(ansB),
        ae: timeRe.test(ansA) ? "有具体时间" : "只是笼统说法", be: timeRe.test(ansB) ? "有具体时间" : "只是笼统说法" },
      { n: "回答按要求的结构呈现：表格 或 分条", av: hasTable(ansA) || hasList(ansA), bv: hasTable(ansB) || hasList(ansB),
        ae: structOf(ansA), be: structOf(ansB) },
      { n: "回答真的排出了「周几 + 提醒内容」", av: weekCount(ansA) >= 3 && /提醒/.test(ansA),
        bv: weekCount(ansB) >= 3 && /提醒/.test(ansB),
        ae: weekCount(ansA) ? weekCount(ansA) + " 天" : "没排出一周", be: weekCount(ansB) ? weekCount(ansB) + " 天" : "没排出一周" },
      { n: "回答说明了用什么工具来执行", av: toolRe.test(ansA), bv: toolRe.test(ansB),
        ae: ev(toolRe.test(ansA), "提到了工具", "没提工具"), be: ev(toolRe.test(ansB), "提到了工具", "没提工具") },
      { n: "回答直接照做，没有把活推回给用户", av: !askBackRe.test(ansA), bv: !askBackRe.test(ansB),
        ae: ev(!askBackRe.test(ansA), "直接照做", "反问索要信息"), be: ev(!askBackRe.test(ansB), "直接照做", "反问索要信息") }
    ];
  }

  /* ---------- 新增实验 D：交互绑定（可勾选要素 + 真实 AI/示例降级 + 达标表） ---------- */
  function bindPlPrompt() {
    var reqBox = $("pl-prompt-reqs");
    var pa = $("pl-prompt-a");
    var pb = $("pl-prompt-b");
    var ansA = $("pl-ans-a");
    var ansB = $("pl-ans-b");
    var tableBox = $("pl-prompt-table");
    var fb = $("pl-prompt-fb");
    var runBtn = $("pl-prompt-run");
    var allBtn = $("pl-prompt-all");
    if (!reqBox || !runBtn) return;
    var on = { goal: false, who: false, format: false, tool: false };

    function promptB() {
      var lines = [];
      PL_PROMPT_REQS.forEach(function (r) { if (on[r.id]) lines.push(r.line); });
      return PL_PROMPT_BASE + (lines.length ? "\n" + lines.join("\n") : "");
    }
    function drawReqs() {
      reqBox.innerHTML = PL_PROMPT_REQS.map(function (r) {
        return '<button class="cmp-req-btn' + (on[r.id] ? " on" : "") + '" data-id="' + r.id + '">' +
          (on[r.id] ? U.icon("check", 14) : "+") + " " + r.label + "</button>";
      }).join("");
      reqBox.querySelectorAll(".cmp-req-btn").forEach(function (b) {
        b.addEventListener("click", function () {
          on[b.getAttribute("data-id")] = !on[b.getAttribute("data-id")];
          drawReqs();
          drawPrompts();
        });
      });
    }
    function drawPrompts() {
      var cnt = 0;
      PL_PROMPT_REQS.forEach(function (r) { if (on[r.id]) cnt++; });
      pa.innerHTML = '<span class="tag">【系统】</span>' + U.esc(PL_PROMPT_SYS_A) + "\n" +
        '<span class="tag">【用户】</span>' + U.esc(PL_PROMPT_BASE);
      pb.innerHTML = '<span class="tag">【系统】</span>' + U.esc(PL_PROMPT_SYS_B) + "\n" +
        '<span class="tag">【用户】</span>' + U.esc(promptB()) +
        (cnt === 0 ? "\n\n（还没加任何要素：它和模糊版几乎一样，AI 只能猜。）" : "");
    }
    drawReqs();
    drawPrompts();

    if (allBtn) allBtn.addEventListener("click", function () {
      on = { goal: true, who: true, format: true, tool: true };
      drawReqs();
      drawPrompts();
      U.toast("已补齐四要素，右边就是“清晰版”的完整描述", "success");
    });

    runBtn.addEventListener("click", function () {
      var cnt = 0;
      PL_PROMPT_REQS.forEach(function (r) { if (on[r.id]) cnt++; });
      runBtn.disabled = true;
      if (allBtn) allBtn.disabled = true;
      tableBox.innerHTML = "";
      fb.innerHTML = "";
      ansA.innerHTML = '<span style="color:var(--c-sub)">AI 正在安排……</span>';
      ansB.innerHTML = '<span style="color:var(--c-sub)">AI 正在安排……</span>';

      AgentLab.Adv.askOrDemo({
        systemLeft: PL_PROMPT_SYS_A, userLeft: PL_PROMPT_BASE,
        systemRight: PL_PROMPT_SYS_B, userRight: promptB(),
        demo: { left: PL_PROMPT_DEMO.a, right: PL_PROMPT_DEMO.b },
        demoNote: "未配置 DeepSeek Key，本次用内置示例演示对比"
      }).then(function (r) {
        runBtn.disabled = false;
        if (allBtn) allBtn.disabled = false;

        if (r.mode === "error") {
          ansA.innerHTML = '<span style="color:var(--c-exe-deep)">出错了：' + U.esc(r.message) + "</span>";
          ansB.innerHTML = ansA.innerHTML;
          fb.innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) +
            " 大模型调用失败，没法做对比打分。请检查右上角「设置」里的 DeepSeek API Key 与网络后重试。</span>";
          return;
        }
        if (r.mode === "demo") U.toast(r.message, "info");

        plRenderAns(ansA, r.left, { orderedList: true });
        plRenderAns(ansB, r.right, { orderedList: true });
        var rows = plPromptRows(PL_PROMPT_BASE, promptB(), r.left, r.right);
        tableBox.innerHTML = AgentLab.Adv.checklistHTML({
          rows: rows,
          leftLabel: "模糊版",
          rightLabel: "清晰版",
          isDemo: r.mode === "demo",
          note: "提示：<b>前两项</b>检查的是<b>提示词</b>本身（你有没有说清给谁、什么时候、要什么格式）；" +
            "<b>后五项</b>检查的是<b>回答</b>能不能直接用——有没有变成具体时间、按表格或分条给出、真的排出一周、说清用什么工具执行，以及是照做还是把活推回给你。"
        });
        var m = tableBox.innerHTML.match(/<!--SCORE:(\{.*?\})-->/);
        var sc = m ? JSON.parse(m[1]) : { left: 0, right: 0, total: rows.length };

        if (cnt === 0) {
          fb.innerHTML = '<span class="fb-no">' + U.icon("info", 16) +
            " 右边还没加任何要素，所以两版几乎一样。点上面的四条要素，再点「同时问两个提示词」试试。</span>";
        } else if (sc.right > sc.left) {
          fb.innerHTML = '<span class="fb-ok">' + U.icon("happy", 16) + " 差别看清楚了吗？清晰版 " + sc.right + "/" + sc.total +
            "，模糊版只有 " + sc.left + "/" + sc.total + "。四要素越全，规划器越能把任务排成“能直接执行”的计划。</span>";
        } else {
          fb.innerHTML = '<span class="fb-ok">' + U.icon("info", 16) + " 这次两边差不多。试着把右边要素再点掉几条，让它退回模糊版，看分数会不会掉——这能证明差距是描述带来的。</span>";
        }
      });
    });
  }

  return { render: render, refreshModelBar: refreshModelBar };
})();
