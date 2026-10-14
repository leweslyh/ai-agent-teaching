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

  /* ---------- 渲染 ---------- */
  function render() {
    var sec = $("sec-planner");
    sec.innerHTML =
      LP.labHead("plan", "gear", "规划器实验室", "让 AI 学会思考 · 组件篇·规划（L07–L08）") +

      /* 学习目标 */
      '<div class="lesson-goal card-plan">' +
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
            '<button class="btn btn-plan" id="pl-react-next">' + U.icon("spark", 16) + ' 下一步</button>' +
            '<button class="btn btn-ghost" id="pl-react-auto">' + U.icon("spark", 16) + ' 自动播放全部</button>' +
            '<button class="btn btn-ghost" id="pl-react-reset">' + U.icon("refresh", 16) + ' 重置</button>' +
            '<span id="pl-react-status" style="color:var(--c-sub);font-size:13px;align-self:center"></span>' +
          '</div>' +
        '</div>' +
        '<div class="tip" style="margin-top:10px">' + U.icon("spark", 16) + ' <b>关键洞察：</b>每一轮 ReAct 循环，Agent 的上下文（轨迹）都在增长——思考过程、工具调用、工具结果都被记录下来，供下一轮思考参考。这就是 Agent 的“工作记忆”！</div>'
      ) +

      /* ④ 魔法句式对比 */
      LP.card("plan", "实验：魔法句式 vs 模糊说法", "题库里是 5 个「只说一句话根本没法办事」的任务：<b>班级义卖 · 读书分享会 · 班级运动会 · 生日会 · 班级春游</b>。左边只丢一句“做什么”，剩下的全靠 AI 猜；右边把<b>目标 + 步骤 + 顺序 + 每段要求</b>一次说清。<b>两边用的是同一个模型</b>，差距到底有多大？问完会自动逐项打分对比，点「换一题」换个任务再比一次。",
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
        '<div class="tip" style="margin-top:10px">' + U.icon("book", 16) + ' <b>原理：</b>同一个模型、同一件事，只换说法：模糊说法只说了「做什么」，AI 只能拿通用套话填空（“先确定时间地点，再安排分工……”）；魔法句式把<b>目标、步骤、顺序、每段要求</b>都交代清楚，模型就能逐条落实。' +
          '<br><b>实验条件（保证公平）：</b>两边<b>任务完全相同</b>，只有说法不同，用的是<b>同一个模型</b>、同样的输出上限。' +
          '<br><b>玩法：</b>点「换一题」换一个任务再比一次——多比几次就会发现，“说清楚就更做得到”不是运气，是规律。</div>'
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
          '<div id="pl-pg-flow"></div>' +
        '</div>'
      ) +

      /* ⑦ 思维链实验 */
      LP.card("plan", "实验：思维链（CoT）——一步一步想的力量", "ai-agent-book 指出：让模型“一步一步思考”而不是直接给答案，能显著提升复杂任务的正确率——这就是<b>思维链（Chain-of-Thought, CoT）</b>。这里的题<b>都要连推好几步</b>（多位数乘法、7 次递推、分率链、概率、三段价格）——不落笔就几乎一定会错。题干完全一样，<b>只有指令不同</b>，问完会自动逐项检查两个回答。",
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
        '<div id="pl-cot-model" style="margin-top:12px"></div>' +
        '<div id="pl-cot-table"></div>' +
        '<div class="quiz-feedback" id="pl-cot-fb"></div>' +
        '<div class="tip" style="margin-top:10px">' + U.icon("book", 16) + ' <b>原理：</b>CoT 让模型把推理过程显式输出，每一步都建立在上一步的结果上，减少了“跳步”导致的错误。研究表明，CoT 在数学、符号推理、决策任务上都能显著提升表现。' +
          '<br><b>实验条件（保证公平）：</b>两边<b>题干完全相同</b>，只有指令不同——“直接问”那一侧还被限制成只能输出很短的一句（相当于没有地方写过程），随机性也略高，用来模拟“不假思索就报数”。' +
          '<br><b>用什么模型：</b>本实验优先使用<b>硅基流动的小模型</b>（在系统设置里填「云端能力密钥」即可，<b>不需要额外配置</b>）；没填则用 DeepSeek 大模型。</div>'
      ) +

      /* ⑧ 工具选择决策 */
      LP.card("plan", "互动：工具选择决策——什么时候调用什么工具？", "规划器的核心能力之一是<b>工具选择</b>：理解用户意图后，判断要不要调用工具、调用哪个、传什么参数。ai-agent-book 指出，这个决策策略是通过强化学习固化在模型参数里的。来试试你能不能选对工具！",
        '<div class="game-box" id="pl-tooldec">' +
          '<div id="pl-td-flow"></div>' +
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
          '<div id="pl-fl-flow"></div>' +
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
            U.icon("alert", 16) + ' <b>上下文窗口警告！</b>轨迹已接近模型的上下文窗口上限（如 128K token）。继续增长会导致：①早期对话被截断丢失；②推理成本上升；③响应变慢。<b>工程解决方案：</b>轨迹摘要（Summarization）、滑动窗口（Sliding Window）、向量检索（RAG）——只把相关历史放进上下文。' +
          '</div>' +
        '</div>' +
        '<div class="tip" style="margin-top:10px">' + U.icon("book", 16) + ' <b>ai-agent-book 消融实验发现：</b>工具执行结果（Tool Results）是闭环控制的关键，缺失它会让 Agent“盲目”执行；历史消息防止冗余操作；思考过程在可从结果重建时可丢弃。各组件并不同等重要！</div>'
      ) +

      /* 课堂小结 */
      '<div class="lesson-summary card-plan">' +
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

      /* ⑫ 新增配套实验（全部可自动判定） */
      LP.card("plan", "实验：把大任务拆成小任务（任务分解树）",
        "规划器的第一件事是“拆”。给一个真实任务，选出所有该拆出来的子任务——注意：越界的事、与任务无关的事，都不该出现在计划里。",
        '<div id="pl-tree"></div>') +

      LP.card("plan", "实验：步骤的依赖与并行",
        "拆出来的步骤不是随便排的：有的必须等前一步的结果（依赖），有的可以同时做（并行）。把“准备周末去公园”的步骤排成正确顺序，排错会被拦下来。",
        '<div id="pl-dep"></div>') +

      LP.card("plan", "实验：计划自检——同一个失败，两种 Agent",
        "执行中出问题是常态。同一个失败场景，关掉“反思”和开启“反思”，Agent 的处理方式完全不同。切开关对比一下，再想想哪一种能上线。",
        '<div id="pl-reflect"></div>') +

      LP.card("plan", "实验：清晰的任务描述四要素（真实 AI 对比）",
        "请规划器办事，要说清四件事：<b>做什么 / 给谁什么时候 / 输出什么格式 / 能用哪些工具</b>。左边只说一句，右边把四要素补齐，再同时问 AI，最后看自动达标表。（没配 Key 也能用示例演示）",
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

      /* ⑬ 小测验 */
      LP.card("plan", "小测验：你是规划小达人吗？", "共 " + QUIZ.length + " 题，答对一题加一颗星！",
        '<div class="game-box" id="pl-quiz"><div id="pl-quiz-body"></div></div>' +
        '<div class="score-line"><span class="score-badge" id="pl-quiz-score" data-score="0">★ 0</span><button class="btn btn-ghost btn-sm" id="pl-quiz-restart">重来</button></div>'
      ) +

      /* ⑭ 进阶原理互动课堂 */
      LP.card("plan", "进阶原理互动课堂：规划器在真实 AI 系统里是什么？（ai-agent-book 第 1/3/7 章）",
        "下面 10 个概念对应《深入理解 AI Agent：设计原理与工程实践》（ai-agent-book）里的真实工程做法。<b>左边选概念，右边看讲解并亲手做实验</b>：每个概念都配了「一句话讲明白 / 打个比方 / 真实系统里是这样 / 动手实验 / 自检一问」，最后还能一键跳回对应的基础实验。",
        AgentLab.Adv.panelHTML({ key: "plan", concepts: plConcepts() }));


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
    bindPlAdv();
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
        el.innerHTML = text
          ? '<div class="md-body">' + U.md(text) + "</div>"
          : '<span style="color:var(--c-sub)">（AI 这次没有返回内容，请再点一次「同时问两种说法」）</span>';
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
        var results = await Promise.allSettled([
          askFn("你是班级小管家。", q.vague, { maxTokens: 1500 }),
          askFn("你是班级小管家。", q.clear, { maxTokens: 1500 })
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
    }
  ];

  /* ---------- 「本实验当前用的是哪个模型」说明条（思维链 / 魔法句式 共用）----------
   * 这两个对比实验都很容易被误会成“用了两个不同的模型”，其实不是：
   * 两边用的是<b>同一个模型</b>，只有说法 / 指令不同。所以必须明明白白写出来。
   * 用的是硅基流动的小模型（见 CONFIG.cotModel）；没填它的 Key 时退回 DeepSeek 大模型。 */
  function paintModelBar(boxId, opt) {
    var box = $(boxId);
    if (!box) return;
    opt = opt || {};
    var cfg = (AgentLab.CONFIG && AgentLab.CONFIG.cotModel) || {};
    var bigModel = (AgentLab.CONFIG && AgentLab.CONFIG.model) || "deepseek-v4-flash";
    var useSmall = !!(AgentLab.API.hasCloudKey && AgentLab.API.hasCloudKey());
    var same = opt.sameHint || "两边用的是<b>同一个模型</b>，只有说法不同。";

    box.innerHTML = '<div class="cot-model ' + (useSmall ? "ok" : "warn") + '">' +
      U.icon("robot", 16) +
      '<div><b>本实验当前用的模型：</b>' + (
        useSmall
          ? (cfg.provider || "硅基流动") + ' · <code>' + U.esc(cfg.model || "小模型") + '</code>' +
            (cfg.label ? '（' + U.esc(cfg.label) + '）' : "") +
            '<br><span class="dim">' + same + '小模型能力弱一些，对“有没有说清楚”更敏感，对比更明显。</span>'
          : 'DeepSeek · <code>' + U.esc(bigModel) + '</code>（大模型）' +
            '<br><span class="dim">' + same +
            '想让对比更明显，请到右上角「设置」填写<b>云端能力密钥 · 硅基流动</b>，' +
            '本实验会自动改用 <code>' + U.esc(cfg.model || "小模型") + '</code>。</span>'
      ) + '</div></div>';
  }

  /* 一次刷新所有用到小模型的实验说明条（设置里改完 Key 会调用它） */
  function refreshModelBar() {
    paintModelBar("pl-cot-model", { sameHint: "两种问法用的是<b>同一个模型</b>，只有指令不同。" });
    paintModelBar("pl-cmp-model", { sameHint: "两种说法用的是<b>同一个模型</b>，只有说法不同。" });
  }

  /* ---------- ⑦ 思维链实验 ---------- */
  function bindCoT() {
    var qi = 0;
    function curQ() { return COT_BANK[qi]; }

    /* 换题 / 初始渲染：把当前题目写进两栏，并清空上一次的结果 */
    function paintQuestion() {
      var q = curQ();
      var q1 = $("pl-cot-q1"), q2 = $("pl-cot-q2");
      if (q1) q1.textContent = "题目：" + q.text;
      if (q2) q2.textContent = "题目：" + q.text;
      if ($("pl-cot-direct")) $("pl-cot-direct").innerHTML = '<span style="color:var(--c-sub)">还没有提问……</span>';
      if ($("pl-cot-cot")) $("pl-cot-cot").innerHTML = '<span style="color:var(--c-sub)">还没有提问……</span>';
      if ($("pl-cot-table")) $("pl-cot-table").innerHTML = "";
      if ($("pl-cot-fb")) $("pl-cot-fb").innerHTML = "";
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

      /* 把一次请求结果显示到框里：Markdown 渲染 + 空回答提示 + 明确错误原因 */
      function fill(el, r) {
        if (r.status !== "fulfilled") {
          el.innerHTML = '<span style="color:var(--c-exe-deep)">出错了：' +
            U.esc((r.reason && r.reason.message) || "网络问题") + "</span>";
          return;
        }
        var t = String(r.value == null ? "" : r.value).trim();
        el.innerHTML = t
          ? '<div class="md-body">' + U.md(t) + "</div>"
          : '<span style="color:var(--c-sub)">（AI 这次没有返回内容，请再点一次）</span>';
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
        /* 优先用硅基流动的“小模型”：大模型太聪明，两种问法都答得对，看不出差别。
         * 只要在设置里填了「云端能力密钥 · 硅基流动」，就自动用它；
         * 没填则退回 DeepSeek 大模型（对比效果会弱一些）。 */
        var useSmall = !!(AgentLab.API.hasCloudKey && AgentLab.API.hasCloudKey());
        var askFn = useSmall ? AgentLab.API.askSmall : AgentLab.API.ask;

        var results = await Promise.allSettled([
          askFn(
            "你是答题机器。请直接给出最终答案，输出格式只能是「答案：X」这一行，不要写算式、步骤、理由或验算。",
            /* 这一侧刻意“不给思考的空间”（输出上限远小于思维链侧的 4000，随机性略高），
             * 但上限不能太小——否则小模型一开口就被切断，连答案都吐不出来。
             * 之前设 80 就犯了这个错：表现为“直接问那一侧总是不返回内容”。 */
            q.text, { maxTokens: 600, temperature: 1.0, onMeta: mkNote("direct") }),
          askFn(
            "你是数学老师。请一步一步仔细推理：先求什么、再求什么，每一步都写出完整的算式和计算结果，最后给出答案。不要跳步，也不要心算——每一步的结果都要写在纸上再往下算。",
            q.text, { maxTokens: 4000, onMeta: mkNote("cot") })
        ]);
        fill(direct, results[0]);
        fill(cot, results[1]);

        /* 客观评价：逐项检查两个回答（全部是可数指标，不靠“感觉”） */
        var okAll = results[0].status === "fulfilled" && results[1].status === "fulfilled";
        if (tableBox) {
          var rows = plCotRows(results[0].value, results[1].value, q);
          var cotL = 0, cotR = 0;
          rows.forEach(function (x) { if (x.av) cotL++; if (x.bv) cotR++; });
          tableBox.innerHTML = okAll ? AgentLab.Adv.checklistHTML({
            rows: rows,
            leftLabel: "直接问答案",
            rightLabel: "思维链提问",
            verdict: cotR > cotL
              ? "同一道题、同一个 AI，只是问法不同：思维链那一边做到 " + cotR + " / " + rows.length +
                " 项，直接问只做到 " + cotL + " / " + rows.length + " 项。差别不在 AI 聪不聪明，而在你有没有让它把「过程」写出来。"
              : "同一道题、同一个 AI，这次两边差不多（" + cotL + " : " + cotR + "）。点「换一题」再试一道——多试几次就会发现，让 AI 写过程的那一边更稳。",
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
                ? '<div class="fb-no" style="margin-top:8px">' + U.icon("info", 15) +
                  " 注意：当前模型<b>自带内部思维链</b>（接口返回了 reasoning_content）。" +
                  "这类模型即使在“只给答案”模式下也会先偷偷想一遍，所以<b>两边都可能答对</b>——这是模型特性，不是题目问题。</div>"
                : "") +
              (useSmall
                ? '<div class="fb-ok" style="margin-top:8px">' + U.icon("check", 15) +
                  " 当前用的是<b>硅基流动的小模型</b>（" + ((AgentLab.CONFIG.cotModel || {}).label || "小模型") + "），不写过程更容易翻车，对比效果更明显。</div>"
                : '<div class="fb-no" style="margin-top:8px">' + U.icon("info", 15) +
                  " 当前用的是 DeepSeek 大模型（能力很强，两种问法都可能答对，差距不明显）。" +
                  "想让对比更明显，请到右上角「设置」填写<b>硅基流动的 Key</b>，本实验会自动改用小模型。</div>")
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

  /* ---------- ⑫ 小测验 ---------- */
  /* ---------- ⑬ 小测验（单题闯关） ---------- */
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
   * 进阶原理互动课堂（规划器）：10 个概念
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
      links: [{ t: "现场规划：把大任务拆成小步骤", el: "pl-plan-input" }, { t: "新增：任务分解树", el: "pl-tree" }]
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
      tip: "AI 的上下文 = 静态前缀（系统提示词 + 工具定义）+ 轨迹（不断增长的消息历史）。轨迹越久，窗口压力越大。",
      analogy: "像一本工作手册：前面几页是固定规则（每天都不变），后面是随手记的流水账（越写越厚）。手册就那么大，流水账多了就得撕掉旧页或做摘要。",
      real: "轨迹增长带来三类压力：Token 成本上升、关键信息被淹没、超出窗口被截断。工程上的三招：<b>滑动窗口</b>（只留最近几轮 + 系统提示词）、<b>摘要压缩</b>（把旧对话压成一段继续带）、<b>外置记忆 + 检索</b>（存进向量库，需要时再取回）。",
      quiz: { q: "为什么“把系统提示词和工具定义放在最前面”特别重要？", a: "因为静态前缀一旦被截断，Agent 就丢了身份、规则和工具说明——行为会立刻变得不可控。所以截断策略永远是“先丢最旧的轨迹，绝不丢静态前缀”。" },
      links: [{ t: "上下文轨迹演示", el: "pl-tr-list" }]
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
      links: [{ t: "ReAct 循环演示", el: "pl-react-status" }]
    }
  ];

  /* 概念 id → 交互类型（同类交互在多个板块复用） */
  var PL_TYPE = {
    react: "pipeline", decomp: "sorter", cot: "decider", paradigm: "decider", proposer: "sandbox",
    reflect: "picker", ctx: "squeezer", toolpick: "picker", harness: "switchboard", stop: "tuner"
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
      title: "动手实验：先列计划，还是边走边做？", hint: "选两个答案", icon: "gear",
      emptyText: "先回答上面两个问题，系统会推荐一种规划范式。",
      questions: [
        { key: "fixed", q: "① 步骤是否固定？", opts: [{ k: "yes", t: "固定（每次都差不多）" }, { k: "no", t: "不固定（要看中间结果）" }] },
        { key: "change", q: "② 执行中会不会遇到新情况？", opts: [{ k: "rare", t: "很少，基本按计划走" }, { k: "often", t: "经常会，需要随机应变" }] }
      ],
      decide: function (ans) {
        if (ans.fixed === "yes" && ans.change === "rare") {
          return "<b>推荐范式：Plan-and-Execute。</b><br>" +
            '<span class="dim">理由：步骤固定、环境稳定，一次把计划列完再逐步执行最省——Token 可控、步骤可审计、结果可复现。典型场景：每月固定格式的报表、按食谱做菜。</span>' +
            '<br><b>代价：</b>中途出现变化时它不会自己改，需要人工介入。';
        }
        if (ans.fixed === "no" && ans.change === "often") {
          return "<b>推荐范式：ReAct。</b><br>" +
            '<span class="dim">理由：步骤取决于中间结果、环境还在变，必须边做边看、每步都根据观察调整下一步。典型场景：调研报告、故障排查、订餐厅。</span>' +
            '<br><b>代价：</b>容易绕远、Token 消耗更高，需要设停止条件兜底。';
        }
        return "<b>推荐范式：混合——先出计划，执行中允许修订。</b><br>" +
          '<span class="dim">理由：步骤大体固定（适合先规划），但会遇到新情况（需要动态调整），所以工程上常让模型先生成步骤列表，再把每一步当作一个小 ReAct 循环来执行，遇到变化就修订剩余步骤。</span>' +
          '<br><b>提示：</b>这也是真实生产系统里最常见的做法。';
      }
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
        why: "上限太低会半途而废，太高会空转烧钱。生产做法是双保险：以“任务完成信号”为主要停止条件，再加一条硬上限兜底（例如 12~15 轮）。",
        hint: "看看指标条的峰值出现在哪个区间。"
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
    b: [
      "好的，下周的值日提醒安排如下（每天两次，提醒五年级（2）班同学）：",
      "1. 周一 7:30 值日生提前到岗；放学前记得倒垃圾、擦黑板。",
      "2. 周二 7:30 值日生提前到岗；放学前记得摆好桌椅。",
      "3. 周三 7:30 值日生提前到岗；放学前记得关窗关灯。",
      "4. 周四 7:30 值日生提前到岗；放学前记得清理地面。",
      "5. 周五 7:30 值日生提前到岗；放学前做一次大扫除并检查门窗。",
      "已用「提醒」工具按上述时间设置；「班级课表查询」显示周四下午有体育课，请提醒值日生提前收拾器材。"
    ].join("\n")
  };

  /* 渲染 AI 回答：大模型输出是 Markdown，统一走 U.md（保留分行结构、渲染公式），
   * 空回答给出明确提示，避免出现“空白框”。 */
  function plRenderAns(el, text) {
    var t = String(text == null ? "" : text).trim();
    el.innerHTML = t
      ? '<div class="md-body">' + U.md(t) + "</div>"
      : '<span style="color:var(--c-sub)">（AI 这次没有返回内容，请再点一次）</span>';
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
    /* 数一数回答分了几条，三种写法都认：
     * ① 序号「1. 2. 3.」 ② 项目符号「- •」 ③ 文字序号「第一步 / 第二步」（模型很爱这么写） */
    function bullets(s) {
      var m = s.match(/(^|\n)[ \t]*(?:[-*•·][ \t]*|\d{1,2}[.、)][ \t]*|第[一二三四五六七八九十]+步[：:，,、]?[ \t]*)/g);
      return m ? m.length : 0;
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

  /* 5 项可自动判定的达标检查（对提示词与回答都做规则检测） */
  function plPromptRows(pa, pb, ansA, ansB) {
    var timeRe = /(\d{1,2}[:：]\d{2})|(\d{1,2}\s*[点時时])/;
    var listRe = /(^|\n)\s*(\d+[.、)]|[-·•])/;
    var targetRe = /(五年级|同学|全班)/;
    var whenRe = /(7[:：]30|早上|放学前|每天)/;
    return [
      { n: "提示词说清了「做什么」", av: /值日|提醒/.test(pa), bv: /值日|提醒/.test(pb), ae: "提到了值日提醒", be: "提到了值日提醒" },
      { n: "提示词说清了「给谁 + 什么时候」", av: targetRe.test(pa) && whenRe.test(pa), bv: targetRe.test(pb) && whenRe.test(pb),
        ae: targetRe.test(pa) ? (whenRe.test(pa) ? "两者都有" : "缺时间") : "都没说",
        be: targetRe.test(pb) ? (whenRe.test(pb) ? "两者都有" : "缺时间") : "都没说" },
      { n: "回答里有具体时间点", av: timeRe.test(ansA), bv: timeRe.test(ansB),
        ae: timeRe.test(ansA) ? "有具体时间" : "只是笼统说法", be: timeRe.test(ansB) ? "有具体时间" : "只是笼统说法" },
      { n: "回答按条目列出（不是一整段）", av: listRe.test(ansA), bv: listRe.test(ansB),
        ae: listRe.test(ansA) ? "有分条" : "一整段", be: listRe.test(ansB) ? "有分条" : "一整段" },
      { n: "回答用上了指定格式 / 工具", av: /(表格|提醒工具|课表查询)/.test(ansA), bv: /(表格|提醒工具|课表查询)/.test(ansB),
        ae: /(表格|提醒工具|课表查询)/.test(ansA) ? "提到了" : "没提到", be: /(表格|提醒工具|课表查询)/.test(ansB) ? "提到了" : "没提到" }
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

        plRenderAns(ansA, r.left);
        plRenderAns(ansB, r.right);
        var rows = plPromptRows(PL_PROMPT_BASE, promptB(), r.left, r.right);
        tableBox.innerHTML = AgentLab.Adv.checklistHTML({
          rows: rows,
          leftLabel: "模糊版",
          rightLabel: "清晰版",
          isDemo: r.mode === "demo",
          note: "提示：前两项检查的是<b>提示词</b>本身（你有没有说清），后三项检查的是<b>回答</b>的可执行程度（有没有变成具体时间、条目、指定格式）。"
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
