/* ============================================================
 * lab-executor.js —— 执行器实验室（对应 L11 / L12）
 * 20 模块（教学主线：讲一张练一张，实验卡紧跟对应知识卡）：
 *   认识执行器 → 工具五分类 → 实验：有工具vs没工具 → Function Calling机制
 *   → 实验：参数组装 → 工具描述与选择 → 实验：描述调参 → 选工具游戏
 *   → 工具百宝箱 → 工具幻觉与约束 → 实验：四道防线
 *   → 实验：工具不能“偷偷改”参数（参数保真与静默失败）
 *   → 实验：失败了能不能重试？（幂等与两段式确认）
 *   → 实验：AI 写的代码在哪跑？（代码执行与沙盒）
 *   → 多工具协作 → 实验：预测工具链 → MCP协议 → 实验：该不该上MCP
 *   → 小测验 → 进阶原理课堂（13 概念）+ 课堂小结
 * 卡片编号全部自动生成（numberCards 按栏目内顺序补圈码）
 * 参考 ai-agent-book chapter4（工具五分类 / 工具描述 / 参数保真 / 代码执行沙盒 / MCP /
 *      协作工具）、chapter5（故障与错误恢复：重试上限 / 熔断 / 幂等 / 结构化错误回喂）、
 *      chapter1（防呆设计与 ACI）；
 *      hello-agents 第十二章（BFCL 工具调用评测）、Extra05（MCP 与 Skill 的 token 账本）。
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

AgentLab.LabExecutor = (function () {
  var U = AgentLab.UI;
  var $ = U.$;

  var TOOLS = [
    { id: "weather", icon: "cloud", name: "天气查询工具", desc: "查询某个城市某天的天气，返回温度、降水、风力。", category: "perception" },
    { id: "calc", icon: "calc", name: "计算器工具", desc: "快速算四则运算（加减乘除与括号），比如 25 × 4 + 10；折扣、百分数、平均数交给「数学计算工具」。", category: "execution" },
    { id: "remind", icon: "bell", name: "提醒工具", desc: "帮同学记下“要带什么、要做什么”，到时间提醒。", category: "execution" },
    { id: "classInfo", icon: "book", name: "课表查询工具", desc: "从班级知识库查出我们班的课表、值日和通知。", category: "perception" },
    { id: "search", icon: "search", name: "联网搜索工具", desc: "上网搜索真实资料，比如“搜一下恐龙是什么”或“查查珠穆朗玛峰有多高”。", category: "perception" },
    { id: "translate", icon: "lang", name: "翻译工具", desc: "中英互译，比如“苹果用英语怎么说”或“把 hello 翻译成中文”。", category: "execution" },
    { id: "convert", icon: "ruler", name: "单位换算工具", desc: "长度、重量、温度等换算，比如“5米等于多少厘米”或“35摄氏度等于多少华氏度”。", category: "execution" },
    { id: "datetime", icon: "clock", name: "时间日期工具", desc: "查现在几点、今天几号、星期几，还能推算“三天后是几号”“下周五是几号”。", category: "perception" },
    { id: "shape", icon: "shape", name: "图形计算工具", desc: "算面积、周长、体积：正方形、长方形、三角形、梯形、圆、长方体……", category: "execution" },
    { id: "math", icon: "percent", name: "数学计算工具", desc: "算百分数、折扣、平均数，比如“60的30%是多少”“200元打8折”。", category: "execution" },
    { id: "timer", icon: "timer", name: "计时器工具", desc: "倒计时、番茄钟，比如“帮我计时25分钟”——到点真的会提醒。", category: "execution" }
  ];

  var MATCH = [
    { q: "明天会下雨吗？", ans: "weather" },
    { q: "算一算 6 × 7 等于多少？", ans: "calc" },
    { q: "别忘了明天带美术工具！", ans: "remind" },
    { q: "我们班今天下午有什么课？", ans: "classInfo" },
    { q: "搜一下：长颈鹿的脖子为什么那么长？", ans: "search" },
    { q: "“科学”用英语怎么说？", ans: "translate" },
    { q: "3千米等于多少米？", ans: "convert" },
    { q: "现在几点了？今天星期几？", ans: "datetime" },
    { q: "边长4厘米的正方形面积是多少？", ans: "shape" },
    { q: "一本书 60 元，打 9 折要付多少钱？", ans: "math" },
    { q: "帮我计时25分钟（番茄钟）", ans: "timer" }
  ];

  // 小测验
  var QUIZ = [
    { q: "执行器在智能体中扮演什么角色？", opts: ["大脑，负责思考", "眼睛，负责看", "手，负责调用外部能力完成任务", "小本子，负责记忆"], ans: 2, why: "执行器就是 AI 的“手”——大语言模型自己不会实时查、不会真操作，执行器通过调用天气、计算、搜索等外部工具，把事真正办成。" },
    { q: "ai-agent-book 把工具分成几类？", opts: ["3类：感知、执行、协作", "5类：感知、执行、协作、事件触发、用户沟通", "2类：输入、输出", "4类：搜索、计算、控制、通信"], ans: 1, why: "ai-agent-book chapter4:7 — 工具五分类：①感知工具（获取信息）②执行工具（改变世界）③协作工具（与其他 Agent 分工）④事件触发工具（外部输入驱动）⑤用户沟通工具（主动与用户连接）。" },
    { q: "“查天气”“联网搜索”属于哪类工具？", opts: ["感知工具（获取信息）", "执行工具（改变世界）", "协作工具（与其他 Agent 分工）", "事件触发工具"], ans: 0, why: "ai-agent-book chapter4 — 感知工具负责获取信息：搜索引擎、文件系统、API、天气查询等。它们不改变世界，只是让 AI“看到”更多信息。" },
    { q: "“发消息”“下单”“设置提醒”属于哪类工具？", opts: ["感知工具", "执行工具（改变世界）", "协作工具", "用户沟通工具"], ans: 1, why: "ai-agent-book chapter4 — 执行工具负责改变世界：代码执行、文件操作、系统命令、发消息、下单等。它们真正对外部世界产生影响。" },
    { q: "“每天早上 7:30 自动提醒今天谁值日”属于哪种方式？", opts: ["用户每次自己提问触发", "事件触发工具：定时到点，自动执行", "记忆器自动回答", "执行器坏了"], ans: 1, why: "ai-agent-book chapter4 — 事件触发工具由外部事件驱动：定时任务到点、收到新邮件、Webhook 回调。它让 Agent 不需要用户每次提问也能主动做事——这是从“被动回答”走向“主动服务”的关键一步。" },
    { q: "Function Calling（函数调用）的工作机制是什么？", opts: ["AI 直接执行代码", "AI 输出一段 JSON 指令（工具名 + 参数，如 weather_query、city: '北京'），由程序去执行真正的工具", "AI 用自然语言告诉用户怎么做", "AI 调用浏览器插件"], ans: 1, why: "真实系统里，模型不是“动手”，而是输出一段结构化的 JSON 指令，指定要调用的工具名和参数，由 Harness 层的程序去执行真正的工具，再把结果返回给模型。" },
    { q: "MCP（模型上下文协议）的作用是什么？", opts: ["一种新的编程语言", "让智能体标准化地接上各种工具，相当于“工具的 USB 接口”", "一种数据库格式", "一种模型训练方法"], ans: 1, why: "ai-agent-book chapter4:100 — MCP（Model Context Protocol）是业界提出的标准化工具接入协议，相当于“工具的 USB 接口”——一个协议接遍所有工具，不需要为每个工具单独写适配代码。" },
    { q: "工具描述（Tool Description）为什么重要？", opts: ["让工具名字更好看", "告诉 AI 这个工具能干什么、需要什么参数，AI 才能正确选择和调用工具", "让工具运行更快", "用于工具分类"], ans: 1, why: "ai-agent-book chapter4:70 — 工具描述是 AI 选择工具的依据。好的描述包含：工具功能、参数说明、返回值格式。描述不清楚，AI 就可能选错工具或传错参数（导致幻觉）。" },
    { q: "“工具幻觉”指的是什么？", opts: ["工具运行出错", "模型编造不存在的工具或参数，或者编造工具返回结果", "工具返回了错误数据", "用户误用工具"], ans: 1, why: "模型可能“编造”不存在的工具名或参数（如调用一个根本没有的工具），或者在工具还没返回时就编造结果。生产系统用工具白名单、参数强校验、等待回填和结果验证四道防线来防止幻觉。" },
    { q: "“帮我规划明天的行程：先查天气，再查路线，最后设提醒”需要用到什么？", opts: ["单个工具", "多工具协作（一个任务依次调用多个工具）", "不需要工具", "只需要记忆器"], ans: 1, why: "复杂任务通常需要多工具协作：规划器拆解任务→依次调用天气工具、路线工具、提醒工具→每步结果追加到上下文→最后综合回答。这就是 ReAct 循环中工具的链式调用。" },
    { q: "生产系统防止工具幻觉的措施不包括以下哪个？", opts: ["工具白名单（只允许调用列表中的工具）", "参数校验（检查参数是否符合工具要求）", "结果验证（检查工具返回结果是否合理）", "让 AI 自由编造工具名以提高灵活性"], ans: 3, why: "生产系统用四道防线约束工具调用：白名单（防编工具）、参数强校验（防编参数）、等待回填（防编结果）、结果验证（防坏数据）。让 AI 自由编造会增加幻觉风险，不是防幻觉措施。" },
    { q: "智能体请求“删除张三的作业文件”，最稳妥的处理方式是？", opts: ["立刻直接删除，越快越好", "检查权限 → 转人工确认 → 确认后才执行，并记审计日志", "让模型反复确认三遍再删", "把文件先发给模型看一遍再删"], ans: 1, why: "删除不可撤销，属于高危操作。除了白名单和参数校验，还要人工确认（先问老师）并留下审计日志——模型可以提请求，但不能自己决定要不要执行。治理强度 = 操作的不可逆程度 × 影响范围。" },
    { q: "工具“静默截断”指的是什么？为什么它比直接报错更危险？", opts: ["工具只返回了前 20 条，却没说明还有 100 条——Agent 会以为这就是全部，从而算出错误结论", "工具返回得太慢", "工具自动把参数改成了别的值", "工具报错后没有重试"], ans: 0, why: "报错至少会被发现，静默截断却让 Agent“看到了不完整的数据还以为完整”。正确做法是显式说明（“已显示第 1-20 行，共 120 行”）并把完整结果留在可再次读取的地方。" },
    { q: "同一个动作超时了，为什么不能一律“再试一次”？", opts: ["因为有些动作不能重复做（发通知、交班费、下单）——重试可能做两遍，要先判断是否可重试，并给动作带上“幂等键”", "因为重试一定会失败", "因为重试不需要花钱", "因为模型不喜欢重试"], ans: 0, why: "重试安全的前提是“幂等”：重复执行同一个请求，结果只生效一次（像按两次电梯按钮不会来两部电梯）。对不可重复的动作，要么带幂等键，要么改成“先确认、再执行”两段式。" },
    { q: "为什么 AI 写的代码要放进沙盒里跑？", opts: ["因为沙盒里跑得更快", "因为代码是“真的会动手”的：沙盒用隔离环境 + 默认断网 + 超时限制，把破坏范围关在小圈子里", "因为沙盒能自动改错", "因为沙盒可以省 Token"], ans: 1, why: "代码执行是执行力最强、也最危险的工具：能读文件、能联网、能删东西。沙盒不是“多装一个环境”，而是把执行关进隔离的圈子里（进程/容器/微型虚拟机），默认断网、限时、限量，出事也只影响沙盒。" }
  ];

  /* ---------- 渲染 ---------- */
  function render() {
    var LP = AgentLab.LabPerception;
    var sec = $("sec-executor");
    sec.innerHTML =
      LP.labHead("exe", "hand", "执行器实验室", "让 AI 动手干活 · 组件篇·工具（L11–L12）") +

      /* 学习目标 */
      '<div class="lesson-goal card-exe">' +
        '<h3>' + U.icon("target", 18) + ' 本课学习目标</h3>' +
        '<div class="goal-list">' +
          '<div class="goal-item"><span class="goal-num">1</span>理解执行器是 AI 的“手”——大语言模型自己不会实时查、不会真操作，执行器通过调用外部能力把事真正办成；掌握“有工具 vs 没工具”的本质区别</div>' +
          '<div class="goal-item"><span class="goal-num">2</span>了解 ai-agent-book 工具五分类（感知/执行/协作/事件触发/用户沟通），能判断天气、搜索、计算、提醒等工具分别属于哪类</div>' +
          '<div class="goal-item"><span class="goal-num">3</span>理解 Function Calling 机制（模型输出 JSON 指令→程序执行工具→结果返回模型）和工具描述的作用；了解 MCP 协议（工具的 USB 接口）</div>' +
          '<div class="goal-item"><span class="goal-num">4</span>建立工具安全与约束意识：知道工具幻觉风险（编造不存在的工具/参数/结果），了解生产系统的四道防线（白名单、参数强校验、等待回填、结果验证）与高危操作人工确认；理解多工具协作的链式调用模式</div>' +
          '<div class="goal-item"><span class="goal-num">5</span>知道工具必须“<b>保真</b>”：不许偷偷改参数、不许偷偷截断结果——静默失败比报错更危险</div>' +
          '<div class="goal-item"><span class="goal-num">6</span>会判断“这一步能不能重试”：区分可重试与不可重试的动作，认识<b>幂等</b>与“先确认再执行”，并知道 AI 写的代码要关进<b>沙盒</b>里跑</div>' +
        '</div>' +
      '</div>' +

      /* 认识执行器 */
      LP.card("exe", "认识执行器：AI 的“手”", "大模型自己不会查天气、不会算数——执行器（<b>工具</b>）就是 AI 的「手」，把事真正办成。",
        '<div class="transform-flow">' +
          '<div class="tf-node">' + U.icon("brain", 20) + ' AI 大脑（想）</div>' +
          '<div class="tf-arrow">+</div>' +
          '<div class="tf-node" style="border-color:var(--c-exe)">' + U.icon("hand", 20) + ' 执行器·工具（做）</div>' +
          '<div class="tf-arrow">=</div>' +
          '<div class="tf-out">“查得到、算得出、搜得到、真办事”</div>' +
        '</div>' +
        '<div class="tip">' + U.icon("spark", 16) + ' 关键本领：<b>工具调用</b>是智能体区别于普通聊天机器人的关键之一——没工具只能“纸上谈兵”，有工具才能“真刀真枪”。工具越多，能办的事越多；但也不是越多越好——工具太多容易挑花眼，按需要配齐最合适（进阶课堂「工具五分类」里有细讲）。</div>'
      ) +

      /* 工具五分类 */
      LP.card("exe", "工具五分类（ai-agent-book chapter4:7）",
        "ai-agent-book 把工具分成五大类，每类有不同的职责。先看清五类的定义与例子，再点下面的工具，看它属于哪一类。",
        '<div class="tool-categories" id="exe-cat-cards">' +
          '<div class="tc-item tc-perception">' +
            '<div class="tc-head"><span class="tc-icon">' + U.icon("eye", 18) + '</span><b>感知工具</b><span class="tc-tag">获取信息</span></div>' +
            '<div class="tc-desc">让 AI“看到”更多信息，不改变世界</div>' +
            '<div class="tc-tools"><b>本系统中的：</b>天气查询、课表查询、联网搜索、时间日期<br><b>真实系统里的：</b>搜索引擎、读文件、查数据库、调 API——把信息“读进来”，不改变世界</div>' +
          '</div>' +
          '<div class="tc-item tc-execution">' +
            '<div class="tc-head"><span class="tc-icon">' + U.icon("hand", 18) + '</span><b>执行工具</b><span class="tc-tag">改变世界</span></div>' +
            '<div class="tc-desc">真正对外部世界产生影响</div>' +
            '<div class="tc-tools"><b>本系统中的：</b>计算器、提醒、翻译、单位换算、图形计算、数学计算、计时器<br><b>真实系统里的：</b>发消息、下单付款、写文件、执行代码、控制设备——真正让世界发生变化</div>' +
          '</div>' +
          '<div class="tc-item tc-collab">' +
            '<div class="tc-head"><span class="tc-icon">' + U.icon("users", 18) + '</span><b>协作工具</b><span class="tc-tag">分工协作</span></div>' +
            '<div class="tc-desc">委托子 Agent、请求人类确认，与其他智能体分工</div>' +
            '<div class="tc-tools"><b>例子：</b>复杂任务拆给多个子 Agent 并行处理，或在关键步骤请求用户确认</div>' +
          '</div>' +
          '<div class="tc-item tc-event">' +
            '<div class="tc-head"><span class="tc-icon">' + U.icon("bell", 18) + '</span><b>事件触发工具</b><span class="tc-tag">外部驱动</span></div>' +
            '<div class="tc-desc">由外部事件驱动，不是用户主动触发</div>' +
            '<div class="tc-tools"><b>例子：</b>收到新邮件、定时任务到点、Webhook 回调、传感器数据变化</div>' +
          '</div>' +
          '<div class="tc-item tc-user">' +
            '<div class="tc-head"><span class="tc-icon">' + U.icon("happy", 18) + '</span><b>用户沟通工具</b><span class="tc-tag">主动连接</span></div>' +
            '<div class="tc-desc">主动与用户连接，不是只在用户提问时才回应</div>' +
            '<div class="tc-tools"><b>例子：</b>发文字消息、语音通话、邮件通知、推送提醒</div>' +
          '</div>' +
        '</div>' +
        /* 互动：工具地图 —— 兑现副标题“看看工具分别属于哪类” */
        '<div class="pf-kit-head">' + U.icon("target", 16) + ' 点一点：我们系统里的工具属于哪一类？</div>' +
        '<div class="tc-map" id="exe-cat-map">' +
          TOOLS.map(function (t) {
            return '<button type="button" class="tc-chip" data-cat="' + (t.category || "execution") + '">' +
              U.icon(t.icon, 14) + t.name + '</button>';
          }).join("") +
        '</div>' +
        '<div class="tc-tipline" id="exe-cat-tip">' + U.icon("spark", 14) + ' 点上面任意一个工具，对应的类别卡会亮起来。</div>' +
        '<div class="tip tip-info" style="margin-top:12px">' + U.icon("book", 16) + ' <b>ai-agent-book 发现：</b>感知工具和执行工具是最基础的两类——先用感知工具“看到”信息，再用执行工具“做出”行动。协作、事件触发、用户沟通是更高级的工具形态，让 Agent 从“被动响应”走向“主动协作”。</div>'
      ) +

      /* 实验：有工具 vs 没工具：原理 → 双栏对比实验 */
      LP.card("exe", "实验：有工具 vs 没工具",
        "同一个问题“明天穿什么？”，分别问两个 AI——一个没装工具、一个装了天气工具。先弄清<b>差别出在哪</b>，再动手各问一次，两边回答并排对照。",
        /* 区 1：原理 —— 大模型的三个“做不到” */
        '<div class="pf-kit-head">' + U.icon("hand", 16) + ' 原理：没有工具的 AI，只能“纸上谈兵”</div>' +
        '<div class="pf-demo-grid" style="grid-template-columns:1fr">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("alert", 16) + '<span>大模型的三个“做不到”</span>' +
              '<span class="pf-chan">为什么必须有工具</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">查不到</span>知识有截止日期——实时天气、今天几号，它根本不知道</div>' +
              '<div class="pf-step"><span class="pf-step-tag">算不准</span>复杂计算、单位换算容易出错——它是在“猜下一个字”</div>' +
              '<div class="pf-step"><span class="pf-step-tag">动不了</span>发消息、设提醒、改文件——只能说，不能做</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 于是它只有两条路：如实说“不知道”，或者……编一个（这就是幻觉）。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：双栏对比 —— 两边结果并排，可反复问 */
        '<div class="pf-kit-head">' + U.icon("target", 16) + ' 动手对比：同一个问题，各问一次，并排看结果</div>' +
        '<div class="row" style="margin-bottom:10px">' +
          '<button class="btn btn-gray" id="pg-notool">' + U.icon("xmark", 16) + ' 问没有工具的 AI</button>' +
          '<button class="btn btn-exe" id="pg-withtool">' + U.icon("cloud", 16) + ' 问有天气工具的 AI</button>' +
          '<button class="btn btn-ghost btn-sm" id="pg-tool-reset">' + U.icon("refresh", 15) + ' 重放</button>' +
        '</div>' +
        '<div class="tvs-wrap">' +
          '<div class="tvs-col is-no">' +
            '<div class="tvs-head">' + U.icon("xmark", 14) + ' 没有工具的 AI</div>' +
            '<div class="tool-stage tvs-stage" id="pg-notool-log"><span class="dim">$ 还没问过——点上面左边的按钮试试。</span></div>' +
          '</div>' +
          '<div class="tvs-col is-yes">' +
            '<div class="tvs-head">' + U.icon("check", 14) + ' 有天气工具的 AI</div>' +
            '<div class="tool-stage tvs-stage" id="pg-withtool-log"><span class="dim">$ 还没问过——点上面右边的按钮试试。</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="quiz-feedback" id="pg-tool-fb"></div>'
      ) +

      /* Function Calling 机制：原理（两个角色）→ 分步接力演示 */
      LP.card("exe", "Function Calling 机制：AI 怎么“调用”工具？",
        "真实系统里，AI 不是直接“动手”，而是输出一段结构化的 JSON 指令，由程序去执行真正的工具。先弄清<b>两个角色怎么分工</b>，再分步看一次完整接力。",
        /* 区 1：原理 —— 决策方 / 执行方 */
        '<div class="pf-kit-head">' + U.icon("hand", 16) + ' 原理：AI 不“动手”，它只写“委托单”</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("brain", 16) + '<span>AI 大脑（决策方）</span>' +
              '<span class="pf-chan">只写指令</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">决定</span>要不要用工具、用<b>哪个</b>工具</div>' +
              '<div class="pf-step"><span class="pf-step-tag">产出</span>一段结构化 JSON：<b>调什么、传什么参数</b></div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 它没有能力真的去查天气——只能写一张“委托单”。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("gear", 16) + '<span>程序 Harness（执行方）</span>' +
              '<span class="pf-chan">只办事情</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">执行</span>收到 JSON，校验参数，调用真实的 API / 工具</div>' +
              '<div class="pf-step"><span class="pf-step-tag">回填</span>把结果送回模型，由模型组织成人话</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 它就是模型的“手”：<b>模型负责决策，程序负责执行</b>。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：分步接力演示（左 = AI 大脑 / 右 = 程序，体现两个角色交替） */
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 分步接力：问一次天气，看两个角色怎么交接</div>' +
        '<div class="game-box">' +
          '<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">' +
            '<button class="btn btn-exe btn-sm" id="exe-fc-next">' + U.icon("spark", 15) + ' 下一步</button>' +
            '<button class="btn btn-ghost btn-sm" id="exe-fc-auto">自动播放</button>' +
            '<button class="btn btn-ghost btn-sm" id="exe-fc-reset">' + U.icon("refresh", 15) + ' 重来</button>' +
            '<span id="exe-fc-progress" style="color:var(--c-sub);font-size:13px;margin-left:auto">第 0 / 4 步</span>' +
          '</div>' +
          '<div class="fcr-flow" id="exe-fc-flow">' +
            /* ① 用户提问（居中） */
            '<div class="fcr-step is-user" data-fc="1">' +
              '<div class="fcr-head"><span class="fcr-badge">①</span><span class="fcr-who">用户</span></div>' +
              '<div class="fcr-msg">北京明天天气怎么样？</div>' +
            '</div>' +
            '<div class="fcr-link" data-fc="1"><span>↓</span><b>提问</b></div>' +
            /* ② AI 大脑：输出 JSON（左） */
            '<div class="fcr-step is-ai" data-fc="2">' +
              '<div class="fcr-head"><span class="fcr-badge">②</span><span class="fcr-who">AI 大脑</span>' +
                '<span class="fcr-role">决策：调什么工具、传什么参数</span></div>' +
              '<div class="fcr-desc">看懂问题，先把“明天”换算成具体日期，再输出一段 JSON 指令：</div>' +
              '<div class="fcr-json">{ "tool": "weather_query",<br>&nbsp;&nbsp;"arguments": { "city": "北京", "date": "2026-10-12" } }</div>' +
            '</div>' +
            '<div class="fcr-link is-flow" data-fc="2"><span>↓</span><b>JSON 指令（模型 → 程序）</b></div>' +
            /* ③ 程序执行（右） */
            '<div class="fcr-step is-prog" data-fc="3">' +
              '<div class="fcr-head"><span class="fcr-badge">③</span><span class="fcr-who">程序 Harness</span>' +
                '<span class="fcr-role">执行：真调 API、回填结果</span></div>' +
              '<div class="fcr-desc">校验参数后，调用真实的天气 API：</div>' +
              '<div class="fcr-term">$ 调用 weather_query(city=北京, date=2026-10-12)<br>$ 返回：晴，15~25°C，微风</div>' +
            '</div>' +
            '<div class="fcr-link is-flow" data-fc="3"><span>↑</span><b>工具结果（程序 → 模型）</b></div>' +
            /* ④ AI 大脑组织回答（左） */
            '<div class="fcr-step is-ai" data-fc="4">' +
              '<div class="fcr-head"><span class="fcr-badge">④</span><span class="fcr-who">AI 大脑</span>' +
                '<span class="fcr-role">组织回答：基于真实结果说话</span></div>' +
              '<div class="fcr-desc">工具结果追加到上下文，模型据此组织回答：</div>' +
              '<div class="fcr-msg">北京明天晴天，气温 15 到 25 度，微风，适合穿薄外套哦！</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="tip tip-info" style="margin-top:12px">' + U.icon("info", 15) + ' <b>关键点：</b>模型负责“决策”、程序负责“执行”，JSON 就是两者之间的“委托单”。注意箭头方向——<b>指令向下传，结果向上回</b>，一来一回才完成一次工具调用。下面紧跟着「给这次调用填参数」实验，可以亲手组装一次参数。</div>'
      ) +

      /* 实验：给这次调用填参数（紧跟 Function Calling） */
      LP.card("exe", "实验：给这次调用填参数（Function Calling 组装器）",
        "模型要调用工具，必须把参数填对。先弄清<b>参数校验到底看哪三件事</b>，再给一次真实请求，选出所有<b>必填且合法</b>的参数。",
        /* 区 1：原理 —— 校验三件事 */
        '<div class="pf-kit-head">' + U.icon("wrench", 16) + ' 原理：模型只“填参数”，由程序校验后才执行</div>' +
        '<div class="pf-demo-grid" style="grid-template-columns:1fr">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("check", 16) + '<span>参数校验就看三件事</span>' +
              '<span class="pf-chan">必填 / 格式 / 越界</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">① 必填齐不齐</span>schema 要求的字段一个都不能少</div>' +
              '<div class="pf-step"><span class="pf-step-tag">② 类型格式对不对</span>日期要 YYYY-MM-DD，枚举只能在给定的取值里</div>' +
              '<div class="pf-step"><span class="pf-step-tag">③ 有没有越界</span>schema 里没有的字段（尤其密钥）一律拒绝</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 参数校验是执行器最重要的安全闸门——<b>不靠模型自觉，靠程序硬拦</b>。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手（组件自带标题） */
        '<div id="exe-args"></div>') +

      /* 工具描述与选择：原理 → 真实示例 */
      LP.card("exe", "工具描述与选择：AI 怎么知道该用哪个工具？",
        "工具描述 = AI 选工具的依据。先弄清<b>一份描述要写清哪四样（功能 / 参数 / 返回 / 场景）</b>，再看两个真实工具的描述长什么样。",
        /* 区 1：原理 —— 四要素 + 写不清的后果 */
        '<div class="pf-kit-head">' + U.icon("pen", 16) + ' 原理：描述就是工具的“名片”，写在模型能读到的地方</div>' +
        '<div class="pf-demo-grid" style="grid-template-columns:1fr">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("check", 16) + '<span>写清四样，模型才选得对</span>' +
              '<span class="pf-chan">功能 / 参数 / 返回 / 场景</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">功能</span>这个工具能干什么——一句话说清用途</div>' +
              '<div class="pf-step"><span class="pf-step-tag">参数</span>要传什么、什么类型、哪些必填</div>' +
              '<div class="pf-step"><span class="pf-step-tag">返回</span>会给回什么结果——模型据此判断下一步</div>' +
              '<div class="pf-step"><span class="pf-step-tag">场景</span>什么时候该用它、什么时候不该用——和其他工具怎么区分</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 描述写得含糊（如只写“工具1”），模型就会选错工具或传错参数——这也是幻觉的来源之一。好的描述，是执行器可靠工作的基础。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：真实示例 */
        '<div class="pf-kit-head">' + U.icon("target", 16) + ' 实例：两个真实工具的描述长这样</div>' +
        '<div class="tool-desc-demo">' +
          '<div class="td-item">' +
            '<div class="td-name">' + U.icon("cloud", 18) + ' 天气查询工具</div>' +
            '<div class="td-field"><b>功能：</b>查询某个城市某天的天气，返回温度、降水、风力</div>' +
            '<div class="td-field"><b>参数：</b>city（城市名，必填）、date（日期 YYYY-MM-DD，可选，默认今天）</div>' +
            '<div class="td-field"><b>返回：</b>{temp: "15~25°C", weather: "晴", wind: "微风"}</div>' +
            '<div class="td-field"><b>场景：</b>问“某天天气、穿什么、要不要带伞”时用——不是查历史气候</div>' +
          '</div>' +
          '<div class="td-item">' +
            '<div class="td-name">' + U.icon("calc", 18) + ' 计算器工具</div>' +
            '<div class="td-field"><b>功能：</b>快速算四则运算，支持加减乘除和括号</div>' +
            '<div class="td-field"><b>参数：</b>expression（数学表达式，必填，如 "25*4+10"）</div>' +
            '<div class="td-field"><b>返回：</b>{result: 110}</div>' +
            '<div class="td-field"><b>场景：</b>纯四则运算时用；折扣、百分数、平均数交给「数学计算工具」</div>' +
          '</div>' +
        '</div>' +
        '<div class="tip tip-warn" style="margin-top:12px">' + U.icon("alert", 16) + ' <b>如果工具描述写得不好：</b>比如只写“工具1”、不写功能和使用场景，AI 就不知道该什么时候调用它，可能选错工具或传错参数（导致幻觉）。下面紧跟着「工具描述写多细才够」实验，可以亲手调一调。</div>'
      ) +

      /* 实验：工具描述写多细才够（紧跟工具描述） */
      LP.card("exe", "实验：工具描述写多细才够？（准确率调参）",
        "工具描述是模型选工具的唯一依据。先弄清<b>一份合格描述要写清哪四样</b>，再拖滑条看准确率怎么变——过简会混淆，过详又会淹没关系。",
        /* 区 1：原理 —— 四要素 + 两种掉分写法 */
        '<div class="pf-kit-head">' + U.icon("pen", 16) + ' 原理：工具描述 = 写给模型看的“说明书”</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("check", 16) + '<span>写全四要素就够</span>' +
              '<span class="pf-chan">功能 / 参数 / 返回 / 场景</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">功能</span>这个工具是干什么的（一句话说清）</div>' +
              '<div class="pf-step"><span class="pf-step-tag">参数</span>要传什么、什么类型、哪些必填</div>' +
              '<div class="pf-step"><span class="pf-step-tag">返回</span>会拿回什么结果</div>' +
              '<div class="pf-step"><span class="pf-step-tag">场景</span>什么时候该用它（和其他工具怎么区分）</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 四要素齐了，选择准确率就到顶。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("alert", 16) + '<span>两种写法都会掉分</span>' +
              '<span class="pf-chan">太简 / 太冗</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">太简</span>只写个名字（do_stuff）——模型分不清用哪个、该传什么</div>' +
              '<div class="pf-step"><span class="pf-step-tag">太冗</span>大段说明占预算，还把关键信息（必填、枚举值）淹没掉</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 给工具写好描述，是 Agent 工程师的核心工作之一。</div>' +
          '</div>' +
        '</div>' +
        '<div class="tip" style="margin-top:10px">' + U.icon("microscope", 16) + ' <b>两个可以量化的结论：</b>① 描述里附上 <b>1~5 个真实的调用示例</b>，工具选择准确率能从约 <b>72% 提到 90%</b>——示例比形容词管用；② 边界要写清（“不能做什么”），否则模型会自行猜测，把不该用它的时候也调用它。</div>' +
        /* 区 2：动手（组件自带标题） */
        '<div id="exe-desc"></div>') +

      /* 工具选择游戏（单题闯关：11 个任务各选一个工具） */
      LP.card("exe", "游戏：这个任务该调用哪个工具？",
        "每个任务从工具库里挑一个最合适的，答对加星！共 " + MATCH.length + " 题。判断口诀：这是要「查一个信息」「做一次计算」，还是「动手做一件事」？",
        '<div class="game-box" id="pg-toolgame">' +
          '<div id="pg-toolgame-list"></div>' +
          '<div class="score-line"><span class="score-badge" id="pg-toolgame-score" data-score="0">★ 0</span><span id="pg-toolgame-note" style="color:var(--c-sub)"></span></div>' +
        '</div>'
      ) +

      /* 工具百宝箱：按五分类分组 + 能力计数（关闭立即生效于智能体实验室） */
      LP.card("exe", "工具百宝箱：开关工具试试",
        "小管家身上装着 " + TOOLS.length + " 种工具（本系统只装了两类工具，所以分成两组）。关掉一个，它的本领就少一样——开关会立即作用于「智能体实验室」，可以随时去验证。",
        '<div class="tbx-bar">' +
          '<span class="tbx-count" id="pg-toolbox-count">' + U.icon("hand", 15) + ' 已开启 <b>…</b> 项能力</span>' +
          '<span class="tbx-note">关闭后立即生效于「智能体实验室」</span>' +
        '</div>' +
        '<div id="pg-toolbox" class="tbx-grid">' +
          [["perception", "感知工具", "eye", "获取信息"],
           ["execution", "执行工具", "hand", "改变世界"]].map(function (cat) {
            var list = TOOLS.filter(function (t) { return (t.category || "execution") === cat[0]; });
            return '<div class="tbx-group">' +
              '<div class="tbx-group-head">' + U.icon(cat[2], 15) + '<b>' + cat[1] + '</b><span>' + cat[3] + '</span></div>' +
              list.map(function (t) {
                return '<div class="toggle-row">' +
                  '<span class="t-label">' + U.icon(t.icon, 20) + '<span class="t-txt"><b>' + t.name + '</b><small style="color:var(--c-sub);font-weight:400">' + t.desc + "</small></span></span>" +
                  '<label class="switch"><input type="checkbox" data-tool="' + t.id + '"><span class="slider"></span></label>' +
                  "</div>";
              }).join("") +
            '</div>';
          }).join("") +
        '</div>' +
        '<div class="tip">' + U.icon("target", 16) + ' 试试看：关掉“天气查询工具”，去智能体实验室问“明天穿什么？”，小管家是不是就答不上来啦？这就是“没工具只能纸上谈兵”！</div>' +
        '<div class="tip tip-warn" style="margin-top:8px">' + U.icon("alert", 16) + ' <b>工具不是越多越好（有实测）：</b>当工具数量超过 <b>100 个</b>，连最先进的模型也会开始挑错——把 120 多个工具的说明全都塞进上下文，光工具定义就超过 <b>5 万 Token</b>，小模型甚至会出现“忘记用工具、指令都不遵守”。<br>解法不是“让模型更聪明”，而是<b>按需加载</b>：先按大类筛，再把相关的几个交给模型挑——实测准确率能从 <b>49% 提到 74%</b>。就像查工具书：没人从第一页读到最后一页，都是顺着目录查词条。</div>' +
        '<div class="tip" style="margin-top:8px">' + U.icon("wrench", 16) + ' <b>那要不要给每件事都做一个专用工具？</b>不一定要——<b>一个通用的“代码执行”往往顶得上一堆小工具</b>（算数、改文件、处理数据都能做）。只有这四种情况才值得专门造一个：① 需要严格控制<b>安全权限</b>；② 要屏蔽不同平台/系统的差异；③ 使用<b>频率极高</b>、值得优化；④ 参数很复杂、需要专门校验。<br>反过来也要注意：通用工具“什么都能做”，就意味着它带来的风险也更大——所以它更需要沙盒（下面第三张实验卡会讲）。</div>'
      ) +

      /* 工具幻觉与约束：“幻觉三连 + 坏数据”展示（与下方「四道防线」实验互补） */
      LP.card("exe", "工具幻觉与约束：AI 会“编造”工具吗？",
        "模型可能<b>编造</b>三种东西：不存在的工具、错误的参数、没拿到就编的结果；还可能把工具返回的<b>坏数据</b>照单全收。先看清这四类风险长什么样，下面紧跟着做「四道防线」实验——看哪道防线各拦哪一种。",
        '<div class="pf-kit-head">' + U.icon("alert", 16) + ' 四类风险 ↔ 四道防线（一一对应）</div>' +
        '<div class="pf-demo-grid pf-cols-2">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("xmark", 16) + '<span>① 编工具</span>' +
              '<span class="pf-chan">调用不存在的工具</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step is-bad"><span class="pf-step-tag">AI 输出</span>{ "tool": "get_user_password", "params": { "user": "小明" } }</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("shield", 13) + ' 危害：可能触发危险操作。→ 被 <b>① 白名单</b> 拦住。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("xmark", 16) + '<span>② 编参数</span>' +
              '<span class="pf-chan">塞进 schema 外的字段</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step is-bad"><span class="pf-step-tag">AI 输出</span>{ "city": "北京", "user_token": "sk-abc123" }</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("shield", 13) + ' 危害：越界字段，甚至把密钥带出去。→ 被 <b>② 参数强校验</b> 拦住。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("xmark", 16) + '<span>③ 编结果</span>' +
              '<span class="pf-chan">工具没返回就抢答</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step is-bad"><span class="pf-step-tag">AI 输出</span>“明天北京晴，25℃”（可天气工具其实刚报了 HTTP 500）</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("shield", 13) + ' 危害：用户拿着假数据做决定。→ 被 <b>③ 等待回填</b> 拦住。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("alert", 16) + '<span>④ 照单全收坏数据</span>' +
              '<span class="pf-chan">工具真返回了，但明显不对</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step is-bad"><span class="pf-step-tag">工具返回</span>{ "temp": "-200℃" }——接口故障或数据源出错时会出现这种脏数据</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("shield", 13) + ' 危害：模型把坏数据当真话转给用户。→ 被 <b>④ 结果验证</b> 拦住（检查返回值是否在合理范围）。</div>' +
          '</div>' +
        '</div>' +
        '<div class="tip tip-ok" style="margin-top:12px">' + U.icon("shield", 16) + ' <b>本系统的实践：</b>你关掉某个工具后，小管家会“诚实说查不到”，而不是编造结果——这就是白名单和约束起作用的体现！AI 会犯错，Harness 负责兜底。另外，<b>高危操作</b>（删文件、群发消息）执行前必须<b>人工确认</b>，每次调用都记<b>审计日志</b>——模型可以提请求，但不能自己决定要不要执行（详见进阶课堂「工具治理」）。</div>'
      ) +

      /* 实验：工具幻觉的四道防线（紧跟工具幻觉与约束） */
      LP.card("exe", "实验：工具幻觉的四道防线",
        "模型会编工具、编参数、编结果，还可能照单全收坏数据。先看清<b>四类风险和四道防线怎么一一对应</b>，再关掉一道，看哪类风险就漏过去了。",
        /* 区 1：原理 —— 四类风险 ↔ 四道防线 */
        '<div class="pf-kit-head">' + U.icon("shield", 16) + ' 原理：四类风险，四道防线各拦一种</div>' +
        '<div class="pf-demo-grid" style="grid-template-columns:1fr">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("shield", 16) + '<span>四类风险 ↔ 四道防线</span>' +
              '<span class="pf-chan">一一对应</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">编工具</span>调用根本不存在的工具 → <b>① 白名单</b>拦住</div>' +
              '<div class="pf-step"><span class="pf-step-tag">编参数</span>塞进 schema 外的字段或密钥 → <b>② 参数强校验</b>拦住</div>' +
              '<div class="pf-step"><span class="pf-step-tag">编结果</span>工具还没返回就先说答案 → <b>③ 等待回填</b>拦住</div>' +
              '<div class="pf-step"><span class="pf-step-tag">坏数据</span>返回值明显不合理（如 -200℃）→ <b>④ 结果验证</b>拦住</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 四道防线都在<b>程序侧</b>——是硬约束，不是靠模型“自觉不乱编”。</div>' +
            '<div class="pf-note">' + U.icon("refresh", 13) + ' <b>失败之后还有两招：</b>① <b>结构化错误回喂</b>——把“哪一步、为什么失败、缺什么”写清楚交回模型，让它据此改正（实测能把恢复成功率从约 60% 提到 95%），而不是只丢一句“出错了”；② <b>熔断</b>——同一个动作连续失败到上限（生产经验值约 3 次）就停下转人工，别让它原地打转烧钱。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手（组件自带标题） */
        '<div id="exe-guard"></div>') +

      /* 新卡：工具不能“偷偷改”参数——参数保真与静默失败（ai-agent-book chapter4:90） */
      LP.card("exe", "实验：工具不能“偷偷改”——参数保真与静默失败",
        "四道防线防的是“模型编造”。还有一类更隐蔽的坑：<b>工具自己偷偷动了手脚</b>——把参数悄悄改掉、把结果悄悄截断，却什么也不说。先弄清为什么这比报错更危险，再去日志里把它找出来。",
        /* 区 1：原理 —— 工具要“保真”：原样接收、如实回传 */
        '<div class="pf-kit-head">' + U.icon("wrench", 16) + ' 原理：工具的两条“保真”原则</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("check", 16) + '<span>两条保真原则</span>' +
              '<span class="pf-chan">不改参数 · 不藏信息</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">① 不许静默改参数</span>模型传什么就是什么；确实需要规范化（比如把中文引号转成英文），也要<b>把改动写进返回结果</b></div>' +
              '<div class="pf-step"><span class="pf-step-tag">② 不许静默截断</span>结果太长可以只回一部分，但必须<b>明确说明</b>：“已显示第 1-20 行，共 120 行”，并给出再读的办法</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 一句话：<b>可以少说，不能瞒着改。</b>“不告诉模型就动手”＝让模型基于假信息做决策。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("alert", 16) + '<span>为什么“静默”比“报错”更危险</span>' +
              '<span class="pf-chan">报错会被发现，静默不会</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">报错</span>Agent 立刻知道这一步没成功 → 可以重试、换工具、如实告知用户</div>' +
              '<div class="pf-step"><span class="pf-step-tag">静默失败</span>Agent 以为成功了，拿着<b>不完整或已被改过的结果</b>继续往下做——错误会一路传到最后</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("book", 13) + ' <b>ai-agent-book 提醒：</b>工具把参数“悄悄规整”（弯引号改直引号）或“悄悄加参数”，会让调用永远匹配不上、或旧版本必然失败——而且模型完全不知道自己被改了。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手（在日志里找出被偷偷动过的地方） */
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 动手：这份调用日志里，工具“偷偷动手脚”的地方在哪？</div>' +
        '<div class="game-box" id="exe-fidelity"></div>' +
        '<div class="tip tip-info">' + U.icon("scale", 16) + ' <b>同样的道理也适用于人：</b>同学让你帮忙带早餐，“随便带点”你不能自己改成“带十个包子还不告诉他”——要么按说的做，要么说清你的改动。</div>') +

      /* 新卡：失败了能不能重试——幂等与两段式确认（ai-agent-book chapter5:174） */
      LP.card("exe", "实验：失败了能不能重试？——幂等与两段式确认",
        "工具超时、报错的时候，“再试一次”几乎是最自然的反应。但有些动作<b>重试一次就等于做了两遍</b>——多发的通知收不回来，多交的班费也不好退。先弄清区别，再看两栏同时开跑。",
        /* 区 1：原理 —— 可重试 / 不可重试 + 两招保平安 */
        '<div class="pf-kit-head">' + U.icon("refresh", 16) + ' 原理：重试前先问一句“做两遍会怎样？”</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("check", 16) + '<span>可以放心重试</span>' +
              '<span class="pf-chan">重复做没有副作用</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">查询类</span>查天气、查课表、搜索——再查一次，结果一样</div>' +
              '<div class="pf-step"><span class="pf-step-tag">可覆盖的写操作</span>“把文件名改成 X”“把状态设成已完成”——同一个结果再做一遍还是它</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 判断口径：这个动作重复执行，<b>结果会不会变多或变乱</b>。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("alert", 16) + '<span>不能随便重试</span>' +
              '<span class="pf-chan">做两遍＝两个后果</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">对外发送</span>发通知、发消息、提交作业——重试可能发两遍、交两次</div>' +
              '<div class="pf-step"><span class="pf-step-tag">花钱 / 删除</span>下单、交费、删文件——后果不可逆，做两遍就是两次损失</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("shield", 13) + ' 两招保平安：<b>① 幂等键</b>——给这件事一个编号，服务端见到同一个编号只办一次（像按两次电梯按钮，不会来两部电梯）；<b>② 两段式</b>——先“预检/请示”，确认后再“执行”。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手演示（双轨推进） */
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 动手实验：超时之后，两种做法结局完全不同</div>' +
        '<div class="game-box" id="exe-idem"></div>' +
        /* 区 3：动手判断 */
        '<div class="pf-kit-head">' + U.icon("target", 16) + ' 动手判断：哪些动作可以放心重试？</div>' +
        '<div class="game-box" id="exe-retry"></div>') +

      /* 新卡：AI 写的代码在哪跑——代码执行与沙盒（ai-agent-book chapter5:335） */
      LP.card("exe", "实验：AI 写的代码在哪跑？——代码执行与沙盒",
        "代码执行是执行力最强的工具：能算、能改文件、能联网——<b>能做的事越多，做坏事的空间也越大</b>。所以真实系统从不让它直接在你的电脑上跑，而是先关进<b>沙盒</b>。先弄清沙盒管住哪几件事，再切换开关看后果。",
        /* 区 1：原理 —— 沙盒管四件事 + 三档隔离 */
        '<div class="pf-kit-head">' + U.icon("shield", 16) + ' 原理：沙盒不是“多装个软件”，而是把执行关进小圈子</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("lock", 16) + '<span>沙盒管住四件事</span>' +
              '<span class="pf-chan">能碰什么、能去哪、能跑多久、能说多少</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">能碰什么</span>只能访问指定的工作目录，碰不到你的文档、照片、系统文件</div>' +
              '<div class="pf-step"><span class="pf-step-tag">能去哪</span>默认<b>断网</b>；必须联网时按白名单放行——<b>偷到东西也传不出去</b></div>' +
              '<div class="pf-step"><span class="pf-step-tag">能跑多久</span>设超时（例如 120 秒），跑太久就中止，并<b>返回结构化错误</b>而不是悄悄杀掉</div>' +
              '<div class="pf-step"><span class="pf-step-tag">能说多少</span>输出太长要截断并说明，完整结果留在沙盒里可再读</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 一句话：<b>让代码“看得见该看的、够不着不该碰的、跑不出圈外”。</b></div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("box", 16) + '<span>隔离有三档</span>' +
              '<span class="pf-chan">进程 / 容器 / 微型虚拟机</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">进程级</span>同一台机器上开个受限进程——最轻，隔离也最弱</div>' +
              '<div class="pf-step"><span class="pf-step-tag">容器</span>像“独立的玻璃房”：有自己的文件系统和依赖，是目前最常见的做法</div>' +
              '<div class="pf-step"><span class="pf-step-tag">微型虚拟机</span>最接近“另一台机器”，隔离最强、启动略慢，用于高风险执行</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("alert", 13) + ' 常见误解：<b>“装个虚拟环境（venv）＝沙盒”是错的。</b>虚拟环境只管“用哪个 Python、装哪些包”，它拦不住删文件、也拦不住联网——安全和环境是两件事。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手（开关 + 两段代码对照） */
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 动手实验：同一段代码，有没有沙盒，结局差多少？</div>' +
        '<div class="game-box" id="exe-sandbox"></div>') +

      /* 多工具协作：原理 → 分步接力（工具链 + 上下文同步增长） */
      LP.card("exe", "多工具协作：一个任务调用多个工具",
        "复杂任务通常需要依次调用多个工具——这叫工具链式调用（Tool Chaining）。先弄清<b>为什么要“链”、顺序由什么决定</b>，再分步看一次链式调用。",
        /* 区 1：原理 —— 为什么要链 / 顺序由依赖决定 */
        '<div class="pf-kit-head">' + U.icon("gear", 16) + ' 原理：复杂任务 = 一串工具接力</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("hand", 16) + '<span>为什么要“链”</span>' +
              '<span class="pf-chan">单工具答不了复杂问题</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">单工具</span>只回答一个具体问题——查天气、算数、搜资料</div>' +
              '<div class="pf-step"><span class="pf-step-tag">链式调用</span>把大任务拆成几步，<b>每步的结果是下一步的输入</b></div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 每调用一个工具，结果就追加到轨迹——这就是 ReAct 循环里的“观察”。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("link", 16) + '<span>顺序由依赖决定</span>' +
              '<span class="pf-chan">有依赖要等 / 无依赖可并行</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">有依赖</span>算门票要先知道景点价格 → 必须等搜景点完成</div>' +
              '<div class="pf-step"><span class="pf-step-tag">无依赖</span>查天气和搜景点互不影响 → 真实系统里可并行发起</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 链的顺序不是“想到哪做到哪”，而是由数据依赖推出来的。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：分步接力 —— 左：工具链 / 右：上下文同步增长（把“结果追加到上下文”可视化） */
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 分步接力：看工具链怎么一步步长出来</div>' +
        '<div class="mtc-bar">' +
          '<button class="btn btn-exe btn-sm" id="exe-mt-next">' + U.icon("spark", 15) + ' 下一步</button>' +
          '<button class="btn btn-ghost btn-sm" id="exe-mt-auto">自动播放</button>' +
          '<button class="btn btn-ghost btn-sm" id="exe-mt-reset">' + U.icon("refresh", 15) + ' 重来</button>' +
          '<span id="exe-mt-progress" class="mtc-progress">第 0 / 5 步</span>' +
        '</div>' +
        '<div class="mtc-wrap" id="exe-mt-flow">' +
          '<div class="mtc-chain">' +
            '<div class="mtc-step" data-mt="1">' +
              '<span class="mtc-ic">' + U.icon("cloud", 17) + '</span>' +
              '<div class="mtc-body"><div class="mtc-line"><b>查天气</b><span class="mtc-tag is-sense">感知工具</span></div>' +
                '<div class="mtc-out">北京明天：晴，15~25°C</div></div>' +
            '</div>' +
            '<div class="mtc-step" data-mt="2">' +
              '<span class="mtc-ic">' + U.icon("search", 17) + '</span>' +
              '<div class="mtc-body"><div class="mtc-line"><b>搜景点</b><span class="mtc-tag is-sense">感知工具</span></div>' +
                '<div class="mtc-out">“适合晴天去的景点” → 故宫、颐和园、天坛</div></div>' +
            '</div>' +
            '<div class="mtc-step" data-mt="3">' +
              '<span class="mtc-ic">' + U.icon("calc", 17) + '</span>' +
              '<div class="mtc-body"><div class="mtc-line"><b>算门票</b><span class="mtc-tag is-do">计算工具</span>' +
                '<span class="mtc-dep">依赖第 2 步</span></div>' +
                '<div class="mtc-out">60 + 30 + 15 = 105 元</div></div>' +
            '</div>' +
            '<div class="mtc-step" data-mt="4">' +
              '<span class="mtc-ic">' + U.icon("bell", 17) + '</span>' +
              '<div class="mtc-body"><div class="mtc-line"><b>设提醒</b><span class="mtc-tag is-do">提醒工具</span></div>' +
                '<div class="mtc-out">已设置明早 7:00 出发提醒</div></div>' +
            '</div>' +
            '<div class="mtc-final" data-mt="5">' +
              '<span class="mtc-ic">' + U.icon("brain", 17) + '</span>' +
              '<div class="mtc-body"><div class="mtc-line"><b>AI 综合所有结果，生成回答</b></div>' +
                '<div class="mtc-out">“明天北京晴天，推荐故宫、颐和园、天坛，门票共 105 元，已设好 7 点出发提醒！”</div></div>' +
            '</div>' +
          '</div>' +
          '<aside class="mtc-ctx">' +
            '<div class="mtc-ctx-head">' + U.icon("archive", 14) + ' 上下文（轨迹）在同步变长</div>' +
            '<div class="mtc-ctx-list">' +
              '<div class="mtc-ctx-item" data-mt="0"><span class="mtc-role">用户</span>帮我规划明天去北京玩</div>' +
              '<div class="mtc-ctx-item" data-mt="1"><span class="mtc-role">工具</span>天气：晴，15~25°C</div>' +
              '<div class="mtc-ctx-item" data-mt="2"><span class="mtc-role">工具</span>景点：故宫、颐和园、天坛</div>' +
              '<div class="mtc-ctx-item" data-mt="3"><span class="mtc-role">工具</span>门票合计 105 元</div>' +
              '<div class="mtc-ctx-item" data-mt="4"><span class="mtc-role">工具</span>已设明早 7:00 提醒</div>' +
              '<div class="mtc-ctx-item" data-mt="5"><span class="mtc-role">模型</span>最终回答：推荐故宫…</div>' +
            '</div>' +
          '</aside>' +
        '</div>' +
        '<div class="tip tip-info" style="margin-top:12px">' + U.icon("info", 15) + ' <b>关键点：</b>注意右边“上下文”在同步变长——<b>工具的输出就是下一轮推理的输入</b>，链越长，轨迹里的依据越全，回答才越靠谱。下面紧跟着「预测多工具链式调用」实验，来预判每一步该调哪个工具。</div>'
      ) +

      /* 实验：预测多工具链式调用（紧跟多工具协作） */
      LP.card("exe", "实验：预测多工具链式调用",
        "复杂任务要按依赖顺序调用多个工具。先弄清<b>顺序是由“数据依赖”决定的</b>，再预测每一步会调用哪个工具，最后和真实过程对照。",
        /* 区 1：原理 —— 依赖决定顺序 */
        '<div class="pf-kit-head">' + U.icon("refresh", 16) + ' 原理：多工具协作靠“数据依赖”串起来</div>' +
        '<div class="pf-demo-grid" style="grid-template-columns:1fr">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("link", 16) + '<span>上一步的输出 = 下一步的输入</span>' +
              '<span class="pf-chan">依赖决定顺序</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">有依赖</span>生成行程要用“天气 + 景点”两个结果 → 必须先拿到它们</div>' +
              '<div class="pf-step"><span class="pf-step-tag">无依赖</span>查天气和查景点互不影响 → 可以并行发起，省一半时间</div>' +
              '<div class="pf-step"><span class="pf-step-tag">失败要有兜底</span>中间任何一环失败，整条链要能停下来并如实说明</div>' +
              '<div class="pf-step"><span class="pf-step-tag">并行要“声明”</span>工具得先声明自己“支持同时调用吗”——<b>默认是不支持</b>（安全第一）；声明了才允许一批同时发起</div>' +
              '<div class="pf-step"><span class="pf-step-tag">一个失败，只波及依赖它的</span><b>级联中止</b>：并行的几个调用里有一个失败，只中止“要用它结果”的那几个，互不相干的照常完成——不必整批重来</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 链越长，越需要“中间结果可检查”——否则错了也不知道错在哪一步。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手（组件自带标题） */
        '<div id="exe-chain"></div>') +

      /* MCP 协议：原理（N×M vs N+M）→ 连线对比 → 五要素 */
      LP.card("exe", "MCP 协议：工具的“USB 接口”（ai-agent-book chapter4:100）",
        "接 100 个工具就要写 100 套适配代码？MCP 是标准化的工具接入协议——相当于「<b>工具的 USB 接口</b>」。先看清<b>没有标准 vs 有标准</b>的差别，再看它带来什么。",
        /* 区 1：原理 —— 乘法 vs 加法 */
        '<div class="pf-kit-head">' + U.icon("link", 16) + ' 原理：没有标准会“适配爆炸”，有了标准才能“即插即用”</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("alert", 16) + '<span>没有统一标准</span>' +
              '<span class="pf-chan">N × M</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">每个模型</span>都要为每个工具单独写一套适配代码</div>' +
              '<div class="pf-step"><span class="pf-step-tag">后果</span>3 个模型 × 3 个工具 = <b>9 套</b>；改一个工具，要动好几处</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 复杂度是<b>乘法</b>——工具和模型越多，适配代码爆炸式增长。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("check", 16) + '<span>有 MCP 统一协议</span>' +
              '<span class="pf-chan">N + M</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">工具侧</span>按协议暴露一次，任何支持 MCP 的客户端都能调用</div>' +
              '<div class="pf-step"><span class="pf-step-tag">客户端</span>接入一次协议，就用上全部 MCP 工具</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 复杂度变成<b>加法</b>——这就是 MCP 被称为“USB 接口”的原因。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：连线对比 —— 核心记忆点 */
        '<div class="pf-kit-head">' + U.icon("target", 16) + ' 对比：接同样多的工具，连线差多少？</div>' +
        '<div class="mcp-cmp">' +
          '<div class="mcp-pane is-bad">' +
            '<div class="mcp-pane-head">' + U.icon("xmark", 15) + ' 没有统一标准：N × M</div>' +
            '<svg class="mcp-svg" viewBox="0 0 240 148" role="img" aria-label="没有统一标准时，3 个模型与 3 个工具两两相连，共 9 条适配连线">' +
              '<line class="ln" x1="42" y1="24" x2="198" y2="24"/>' +
              '<line class="ln" x1="42" y1="24" x2="198" y2="74"/>' +
              '<line class="ln" x1="42" y1="24" x2="198" y2="124"/>' +
              '<line class="ln" x1="42" y1="74" x2="198" y2="24"/>' +
              '<line class="ln" x1="42" y1="74" x2="198" y2="74"/>' +
              '<line class="ln" x1="42" y1="74" x2="198" y2="124"/>' +
              '<line class="ln" x1="42" y1="124" x2="198" y2="24"/>' +
              '<line class="ln" x1="42" y1="124" x2="198" y2="74"/>' +
              '<line class="ln" x1="42" y1="124" x2="198" y2="124"/>' +
              '<circle class="nd" cx="30" cy="24" r="12"/><circle class="nd" cx="30" cy="74" r="12"/><circle class="nd" cx="30" cy="124" r="12"/>' +
              '<circle class="nd" cx="210" cy="24" r="12"/><circle class="nd" cx="210" cy="74" r="12"/><circle class="nd" cx="210" cy="124" r="12"/>' +
              '<text class="tx" x="30" y="28">A</text><text class="tx" x="30" y="78">B</text><text class="tx" x="30" y="128">C</text>' +
              '<text class="tx" x="210" y="28">1</text><text class="tx" x="210" y="78">2</text><text class="tx" x="210" y="128">3</text>' +
            '</svg>' +
            '<div class="mcp-pane-foot"><span>3 个模型 × 3 个工具</span><b>= 9 套适配代码</b></div>' +
          '</div>' +
          '<div class="mcp-pane is-ok">' +
            '<div class="mcp-pane-head">' + U.icon("check", 15) + ' 有 MCP：N + M</div>' +
            '<svg class="mcp-svg" viewBox="0 0 240 148" role="img" aria-label="有 MCP 时，3 个模型与 3 个工具各自只连到中间一层协议，共 6 条连线">' +
              '<line class="ln" x1="42" y1="24" x2="86" y2="74"/>' +
              '<line class="ln" x1="42" y1="74" x2="86" y2="74"/>' +
              '<line class="ln" x1="42" y1="124" x2="86" y2="74"/>' +
              '<line class="ln" x1="154" y1="74" x2="198" y2="24"/>' +
              '<line class="ln" x1="154" y1="74" x2="198" y2="74"/>' +
              '<line class="ln" x1="154" y1="74" x2="198" y2="124"/>' +
              '<rect class="bar" x="86" y="63" width="68" height="22" rx="7"/>' +
              '<text class="tx-bar" x="120" y="78">MCP 协议</text>' +
              '<circle class="nd" cx="30" cy="24" r="12"/><circle class="nd" cx="30" cy="74" r="12"/><circle class="nd" cx="30" cy="124" r="12"/>' +
              '<circle class="nd" cx="210" cy="24" r="12"/><circle class="nd" cx="210" cy="74" r="12"/><circle class="nd" cx="210" cy="124" r="12"/>' +
              '<text class="tx" x="30" y="28">A</text><text class="tx" x="30" y="78">B</text><text class="tx" x="30" y="128">C</text>' +
              '<text class="tx" x="210" y="28">1</text><text class="tx" x="210" y="78">2</text><text class="tx" x="210" y="128">3</text>' +
            '</svg>' +
            '<div class="mcp-pane-foot"><span>3 个模型 + 3 个工具</span><b>= 6 处接入</b></div>' +
          '</div>' +
        '</div>' +
        '<div class="tip tip-ok" style="margin-top:12px">' + U.icon("spark", 15) + ' <b>一句话记住：</b>MCP 把“乘法”变成了“加法”——工具实现一次、客户端接入一次，工具生态才能真正长起来。</div>' +
        /* 区 3：五要素 */
        '<div class="pf-kit-head">' + U.icon("archive", 16) + ' MCP 的五个要素</div>' +
        '<div class="pf-kit">' +
          [
            ["database", "Server", "工具提供方——把能力按协议暴露出来"],
            ["gear", "Client", "Agent 端——负责发现并调用这些工具"],
            ["wrench", "Tools", "可调用的函数——真正能执行的动作"],
            ["archive", "Resources", "可读的资源——文件、数据、文档"],
            ["chat", "Prompts", "提示模板——预设好的任务模板"]
          ].map(function (k) {
            return '<div class="pf-kit-item">' +
              '<span class="pf-kit-icon">' + U.icon(k[0], 15) + '</span>' +
              '<div class="pf-kit-txt"><b>' + k[1] + '</b><span>' + k[2] + '</span></div>' +
            '</div>';
          }).join("") +
        '</div>' +
        '<div class="tip tip-info" style="margin-top:12px">' + U.icon("book", 15) + ' <b>ai-agent-book chapter4:100：</b>MCP 让 Agent 通过统一协议连接各种工具——<b>本地工具、远程工具、SaaS 工具、数据库、浏览器</b>等，就像 USB 接口让各种设备都能即插即用。下面紧跟着「该不该上 MCP」实验，用两个真实场景判断一下。</div>' +
        '<div class="tip tip-warn" style="margin-top:8px">' + U.icon("calc", 16) + ' <b>别忘了算 Token 账：</b>接 MCP 服务器时，它的<b>全部工具说明会进到每一次会话</b>——只接 5 个服务器，就可能带来<b>上万 Token</b> 的工具定义，占掉 200K 窗口的近三分之一；社区还有案例：直接接一个 MCP 服务器，初始加载 <b>16000 Token</b>。<br>所以现在流行一层“<b>渐进式披露</b>”的做法：平时只挂一份很短的<b>目录</b>（每个技能约 <b>100 Token</b>，装 50 个也才约 5000），真正用到某个技能时，再把它<b>按需</b>加载进来——同一个案例里，初始开销从 16000 降到了 <b>500</b>。</div>' +
        '<div class="tip" style="margin-top:8px">' + U.icon("shield", 16) + ' <b>MCP 也带来了新的安全风险（三类）：</b>① <b>工具描述投毒</b>——描述里夹带指令，每次会话都生效；② <b>恶意或被劫持的服务器</b>——供应链风险；③ <b>同名工具遮蔽</b>——用同名工具把调用“劫持”到别处。<br>所以接 MCP 要和装 App 一样谨慎：<b>只接可信来源、看清权限声明、关键操作仍然人工确认</b>。</div>'
      ) +

      /* 实验：该不该上 MCP（紧跟 MCP 协议） */
      LP.card("exe", "实验：该不该上 MCP？（场景判断）",
        "上不上 MCP，不看“新不新”，看<b>规模和复用</b>。先记住选型口诀，再判断两个真实场景——选完会给建议。",
        /* 区 1：原理 —— 选型口诀 */
        '<div class="pf-kit-head">' + U.icon("wrench", 16) + ' 原理：先看规模，再看复用——技术选型要匹配当前规模</div>' +
        '<div class="pf-demo-grid" style="grid-template-columns:1fr">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("check", 16) + '<span>两个问题，决定要不要上 MCP</span>' +
              '<span class="pf-chan">规模 / 复用</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">① 规模</span>工具很少、客户端也少（1~2 个）→ 直接写适配就够；工具多或要接多个客户端 / 模型 → 上 MCP</div>' +
              '<div class="pf-step"><span class="pf-step-tag">② 复用</span>只在自家系统里用 → 可以先用最简方案；要给外部团队 / 第三方复用 → 上 MCP（统一接口才谈得上共享）</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 先用得起，再考虑标准化——工具长大了再迁移到 MCP，也不迟。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手（组件自带标题） */
        '<div id="exe-mcp"></div>') +

      /* 小测验 */
      LP.card("exe", "小测验：你是工具小达人吗？", "共 " + QUIZ.length + " 题，覆盖执行器角色、工具五分类、Function Calling、工具描述、参数保真、重试与幂等、代码沙盒、MCP、工具幻觉、多工具协作与工具治理。答对一题加一颗星！",
        '<div class="game-box" id="exe-quiz"><div id="exe-quiz-body"></div></div>' +
        '<div class="score-line"><span class="score-badge" id="exe-quiz-score" data-score="0">★ 0</span><button class="btn btn-ghost btn-sm" id="exe-quiz-restart">重来</button></div>'
      ) +

      /* 进阶原理互动课堂 + 课堂小结 */
      LP.card("exe", "进阶原理互动课堂：执行器在真实 AI 系统里是什么？（ai-agent-book 第 4/5 章 + hello-agents 第 12 章）",
        "13 个真实工程概念（ai-agent-book + hello-agents）：<b>左边选概念，右边看讲解 + 动手实验</b>——每个都配「一句话 / 打个比方 / 真实系统 / 动手做 / 自检一问」。",
        AgentLab.Adv.panelHTML({ key: "exe", concepts: exeConcepts() })) +

      '<div class="lesson-summary card-exe">' +
        '<h3>' + U.icon("check", 18) + ' 课堂小结（L11+L12）</h3>' +
        '<div class="summary-core"><b>核心结论：</b>执行器是 AI 的“手”——大语言模型自己不会实时查、不会真操作，执行器通过调用外部能力把事真正办成。ai-agent-book 把工具分成五类（感知/执行/协作/事件触发/用户沟通），真实系统用 Function Calling 机制（模型输出 JSON 指令→程序执行工具→结果返回模型），用 MCP 协议标准化接入各种工具。但工具不是“模型说什么就执行什么”——生产系统用白名单、参数强校验、等待回填、结果验证四道防线防止工具幻觉，还要求工具<b>保真</b>（不许偷偷改参数、不许偷偷截断），重试前先判断<b>能不能重试</b>（幂等 / 两段式确认），代码执行要关进<b>沙盒</b>，高危操作人工确认并记审计日志。复杂任务需要多工具协作（链式调用），每个工具的输出成为下一轮推理的依据。</div>' +
        '<div class="summary-points">' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("hand", 14) + '</span><div><b>执行器角色：</b>AI 的“手”——没工具只能“纸上谈兵”，有工具才能“真刀真枪”。工具越多能办的事越多，但要按需要配齐（超过 100 个工具连强模型也会选错，按需检索能把准确率从 49% 提到 74%）</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("gear", 14) + '</span><div><b>工具五分类：</b>感知（获取信息）/执行（改变世界）/协作（分工）/事件触发（外部驱动）/用户沟通（主动连接）；优先考虑通用执行器，只有四类情况才值得造专用工具</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("keyboard", 14) + '</span><div><b>Function Calling：</b>模型输出 JSON 指令（工具名+参数）→程序执行工具→结果返回模型。模型负责决策，程序负责执行；描述里附 1~5 个真实示例，准确率可从 72% 提到 90%</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("shield", 14) + '</span><div><b>安全治理：</b>白名单+参数强校验+等待回填+结果验证四道防线，防止 AI 编造工具/参数/结果或照单全收坏数据；失败要“结构化回喂”（恢复率 60%→95%）并设熔断（连续失败约 3 次就停）；高危操作人工确认、全程审计日志。AI 会犯错，Harness 负责兜底</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("check", 14) + '</span><div><b>工具要“保真”：</b>可以少说，不能瞒着改——静默改参数、静默截断都会让 Agent 拿着假信息做决策，比直接报错更危险</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("refresh", 14) + '</span><div><b>重试与沙盒：</b>可重试（查询、可覆盖的写操作）vs 不可重试（发通知、花钱、删除）；两招保平安=幂等键 + 两段式确认。AI 写的代码要进沙盒：限目录、默认断网、设超时、限输出——装个虚拟环境不等于沙盒</div></div>' +
        '</div>' +
        '<div class="summary-think"><b>课后思考：</b>请设计一个“班级活动小助手”需要哪些工具——至少列出 5 个工具，并说明每个工具属于五分类中的哪一类、需要什么参数、返回什么结果；其中<b>哪些动作不能重复执行</b>（属于不可重试），你打算怎么保护它们？下节课分享！</div>' +
      '</div>';

    bindToolDemo();
    bindFcRelay();
    bindMtChain();
    bindToolGame();
    bindToolbox();
    bindExeCatMap();
    bindQuiz();

    /* 实验卡绑定 + 进阶原理互动课堂 */
    bindExeArgs();
    bindExeDesc();
    bindExeGuard();
    bindExeFidelity();   /* 参数保真与静默失败：在日志里找“偷偷动手脚” */
    bindExeIdem();       /* 幂等与重试安全：双轨推进 */
    bindExeRetry();      /* 哪些动作可以放心重试：多选判定 */
    bindExeSandbox();    /* 代码执行与沙盒：开关 + 两段代码对照 */
    bindExeChain();
    bindExeMcp();
    bindExeAdv();
  }

  /* ---------- Function Calling 分步接力（逐步揭示四个步骤） ---------- */
  function bindFcRelay() {
    var host = $("exe-fc-flow");
    if (!host) return;
    var nextBtn = $("exe-fc-next");
    var autoBtn = $("exe-fc-auto");
    var resetBtn = $("exe-fc-reset");
    var prog = $("exe-fc-progress");
    var TOTAL = 4;
    var cur = 0;
    var timer = null;

    function draw() {
      var nodes = host.querySelectorAll("[data-fc]");
      for (var i = 0; i < nodes.length; i++) {
        var n = parseInt(nodes[i].getAttribute("data-fc"), 10);
        if (n <= cur) nodes[i].classList.add("is-on");
        else nodes[i].classList.remove("is-on");
      }
      if (prog) prog.textContent = "第 " + cur + " / " + TOTAL + " 步";
      if (nextBtn) nextBtn.disabled = cur >= TOTAL;
      if (autoBtn) autoBtn.disabled = cur >= TOTAL;
    }
    function stopAuto() {
      if (timer) { clearInterval(timer); timer = null; }
      if (autoBtn) autoBtn.textContent = "自动播放";
    }
    if (nextBtn) nextBtn.addEventListener("click", function () {
      if (cur < TOTAL) { cur++; draw(); }
    });
    if (autoBtn) autoBtn.addEventListener("click", function () {
      if (timer) { stopAuto(); return; }
      if (cur >= TOTAL) return;
      timer = setInterval(function () {
        if (cur < TOTAL) { cur++; draw(); }
        else stopAuto();
      }, 950);
      autoBtn.textContent = "暂停";
    });
    if (resetBtn) resetBtn.addEventListener("click", function () {
      stopAuto(); cur = 0; draw();
    });
    draw();
  }

  /* ---------- 多工具协作：分步接力（工具链 + 上下文同步增长） ---------- */
  function bindMtChain() {
    var host = $("exe-mt-flow");
    if (!host) return;
    var nextBtn = $("exe-mt-next");
    var autoBtn = $("exe-mt-auto");
    var resetBtn = $("exe-mt-reset");
    var prog = $("exe-mt-progress");
    var TOTAL = 5;
    var cur = 0;
    var timer = null;

    function draw() {
      var nodes = host.querySelectorAll("[data-mt]");
      for (var i = 0; i < nodes.length; i++) {
        var n = parseInt(nodes[i].getAttribute("data-mt"), 10);
        if (n <= cur) nodes[i].classList.add("is-on");
        else nodes[i].classList.remove("is-on");
      }
      if (prog) prog.textContent = "第 " + cur + " / " + TOTAL + " 步";
      if (nextBtn) nextBtn.disabled = cur >= TOTAL;
      if (autoBtn) autoBtn.disabled = cur >= TOTAL;
    }
    function stopAuto() {
      if (timer) { clearInterval(timer); timer = null; }
      if (autoBtn) autoBtn.textContent = "自动播放";
    }
    if (nextBtn) nextBtn.addEventListener("click", function () {
      if (cur < TOTAL) { cur++; draw(); }
    });
    if (autoBtn) autoBtn.addEventListener("click", function () {
      if (timer) { stopAuto(); return; }
      if (cur >= TOTAL) return;
      timer = setInterval(function () {
        if (cur < TOTAL) { cur++; draw(); }
        else stopAuto();
      }, 950);
      autoBtn.textContent = "暂停";
    });
    if (resetBtn) resetBtn.addEventListener("click", function () {
      stopAuto(); cur = 0; draw();
    });
    draw();
  }

  /* ---------- 实验：有工具 vs 没工具 ---------- */
  function logLine(text, cls, boxId) {
    var log = $(boxId || "pg-tool-log");
    if (!log) return;
    var d = document.createElement("div");
    d.className = cls || "";
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  function bindToolDemo() {
    var busy = false;

    async function demoNotool() {
      if (busy) return;
      busy = true;
      var log = $("pg-notool-log");
      if (!log) { busy = false; return; }
      log.innerHTML = "";
      $("pg-tool-fb").innerHTML = "";
      logLine("$ 用户提问：“明天穿什么？”", "dim", "pg-notool-log");
      logLine("$ 调用大语言模型……（这个 AI 没有安装任何工具）", "", "pg-notool-log");
      logLine("$ AI 回答中……", "", "pg-notool-log");
      /* 没配 DeepSeek Key：用内置示例演示，保证课堂不中断 */
      if (!AgentLab.API.hasApiKey()) {
        await U.delay(600);
        logLine("> 我查不到明天的天气——因为我没有任何工具，不能实时查询，也不能编一个给你。", "warn", "pg-notool-log");
        logLine("（示例演示：配置 DeepSeek Key 后，这里会是真实大模型的回答）", "dim", "pg-notool-log");
        $("pg-tool-fb").innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " 没工具：AI 只能“纸上谈兵”，查不到真实天气！</span>";
        busy = false;
        return;
      }
      try {
        var ans = await AgentLab.API.ask(
          "你是天气小管家，但你没有任何工具，无法实时查询天气。如果同学问天气相关问题，请如实告诉他你查不到天气，不能编造。",
          "明天穿什么？"
        );
        logLine("> " + ans.replace(/\n/g, "\n> "), "warn", "pg-notool-log");
        $("pg-tool-fb").innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " 没工具：AI 只能“纸上谈兵”，查不到真实天气！</span>";
      } catch (e) {
        logLine("! 出错了：" + (e.message || e), "warn", "pg-notool-log");
      }
      busy = false;
    }

    async function demoWithtool() {
      if (busy) return;
      busy = true;
      var log = $("pg-withtool-log");
      if (!log) { busy = false; return; }
      log.innerHTML = "";
      $("pg-tool-fb").innerHTML = "";
      logLine("$ 用户提问：“明天穿什么？”", "dim", "pg-withtool-log");
      logLine("$ 规划器说：这个问题需要调用天气工具", "", "pg-withtool-log");
      logLine("$ 调用工具：天气查询工具 → 联网查询" + AgentLab.CONFIG.defaultCity + "·明天的天气…", "", "pg-withtool-log");
      var w = await AgentLab.API.getWeather(AgentLab.CONFIG.defaultCity, "明天");
      if (!w || !w.ok) {
        logLine("! " + ((w && w.error) || "天气服务暂时不可用"), "warn", "pg-withtool-log");
        busy = false;
        return;
      }
      logLine("$ 工具返回：" + w.text, "ok", "pg-withtool-log");
      await U.delay(600);
      logLine("$ 工具结果已交给 AI 大脑，正在组织回答…", "", "pg-withtool-log");
      /* 没配 DeepSeek Key：天气结果是真的，回答用内置示例演示 */
      if (!AgentLab.API.hasApiKey()) {
        await U.delay(600);
        logLine("> 根据工具查到的真实天气：" + w.text + "。" + w.suggest + "。", "ok", "pg-withtool-log");
        logLine("（示例演示：配置 DeepSeek Key 后，这里会是真实大模型基于工具结果的回答）", "dim", "pg-withtool-log");
        $("pg-tool-fb").innerHTML = '<span class="fb-ok">' + U.icon("check", 15) + " 有工具：AI 先“查到”再“回答”——这就是执行器的本领！</span>";
        busy = false;
        return;
      }
      try {
        var ans = await AgentLab.API.ask(
          "你是天气小管家。你刚刚通过天气查询工具查到了真实结果：" + w.text + "。" + w.suggest + "。请基于这个真实结果，用同学听得懂的话回答“明天穿什么”。",
          "明天穿什么？"
        );
        logLine("> " + ans.replace(/\n/g, "\n> "), "ok", "pg-withtool-log");
        $("pg-tool-fb").innerHTML = '<span class="fb-ok">' + U.icon("check", 15) + " 有工具：AI 先“查到”再“回答”——这就是执行器的本领！</span>";
      } catch (e) {
        logLine("! 出错了：" + (e.message || e), "warn", "pg-withtool-log");
      }
      busy = false;
    }

    $("pg-notool").addEventListener("click", demoNotool);
    $("pg-withtool").addEventListener("click", demoWithtool);
    $("pg-tool-reset").addEventListener("click", function () {
      $("pg-notool-log").innerHTML = '<span class="dim">$ 已清空——再点上面的按钮试一次。</span>';
      $("pg-withtool-log").innerHTML = '<span class="dim">$ 已清空——再点上面的按钮试一次。</span>';
      $("pg-tool-fb").innerHTML = "";
    });
  }

  /* ---------- 工具选择游戏（单题闯关） ---------- */
  function bindToolGame() {
    AgentLab.Quiz.mount({
      host: "pg-toolgame-list",
      color: "exe",
      name: "工具小达人",
      star: "pg-toolgame-score",
      count: "pg-toolgame-note",
      questions: MATCH.map(function (m) {
        var tool = null;
        TOOLS.forEach(function (t) { if (t.id === m.ans) tool = t; });
        return {
          q: m.q,
          opts: TOOLS.map(function (t) { return { html: U.icon(t.icon, 16) + " " + t.name, key: t.id }; }),
          ans: m.ans,
          why: tool ? "该用「" + tool.name + "」——" + tool.desc : ""
        };
      }),
      hint: "想一想：这个任务是要“查一个真实信息”，还是“做一次精确计算”，或者“动手做一件事”？"
    });
  }

  /* ---------- 工具地图：点工具 → 高亮对应类别卡 + 提示 ---------- */
  function bindExeCatMap() {
    var map = $("exe-cat-map");
    if (!map) return;
    var tip = $("exe-cat-tip");
    var CAT_INFO = {
      perception: { name: "感知工具", cls: "tc-perception", desc: "获取信息，不改变世界" },
      execution:  { name: "执行工具", cls: "tc-execution",  desc: "真正对外部世界产生影响" }
    };
    map.addEventListener("click", function (e) {
      var chip = e.target && e.target.closest ? e.target.closest(".tc-chip") : null;
      if (!chip) return;
      var info = CAT_INFO[chip.getAttribute("data-cat")];
      if (!info) return;
      var cards = document.querySelectorAll("#exe-cat-cards .tc-item");
      for (var i = 0; i < cards.length; i++) cards[i].classList.remove("is-hit");
      var target = document.querySelector("#exe-cat-cards ." + info.cls);
      if (target) {
        target.classList.add("is-hit");
        target.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
      if (tip) {
        tip.innerHTML = U.icon("check", 14) + ' <b>' + chip.textContent.replace(/\s+/g, " ").trim() +
          '</b> 属于 <b>' + info.name + '</b>（' + info.desc + '）。';
      }
    });
  }

  /* ---------- 工具百宝箱（分组 + 能力计数） ---------- */
  function bindToolbox() {
    var tools = AgentLab.Store.getTools();

    /* 能力计数：让“关掉一个 = 少一样本领”可见 */
    function refreshCount() {
      var t = AgentLab.Store.getTools();
      var on = 0, total = 0;
      document.querySelectorAll('#pg-toolbox input[type="checkbox"]').forEach(function (cb) {
        total++;
        if (t[cb.getAttribute("data-tool")]) on++;
      });
      var el = $("pg-toolbox-count");
      if (el) el.innerHTML = U.icon("hand", 15) + ' 已开启 <b>' + on + ' / ' + total + '</b> 项能力';
    }

    document.querySelectorAll('#pg-toolbox input[type="checkbox"]').forEach(function (cb) {
      cb.checked = !!tools[cb.getAttribute("data-tool")];
      cb.addEventListener("change", function () {
        var t = AgentLab.Store.getTools();
        t[cb.getAttribute("data-tool")] = cb.checked;
        AgentLab.Store.saveTools(t);
        refreshCount();
        U.toast(cb.checked ? "工具已装好，小管家的本领 +1！" : "工具已关闭——去「智能体实验室」问问看它的变化");
      });
    });
    refreshCount();
  }

  /* ---------- 小测验（单题闯关） ---------- */
  function bindQuiz() {
    AgentLab.Quiz.mount({
      host: "exe-quiz-body",
      color: "exe",
      name: "工具小达人",
      star: "exe-quiz-score",
      restart: "exe-quiz-restart",
      questions: QUIZ,
      hint: "再想想——可以回到工具五分类、Function Calling 和工具幻觉那几张卡片找答案。"
    });
  }

  /* ============================================================
   * 进阶原理互动课堂（执行器）：10 个概念
   * 结构与交互由共享引擎 js/adv-classroom.js 渲染
   * ============================================================ */
  var EXE_ADV = [
    {
      id: "fc", icon: "wrench", nav: "Function Calling", name: "Function Calling（函数调用）", en: "FUNCTION CALLING",
      tip: "模型不是直接“动手”，而是输出一段结构化指令（tool_calls），由程序去执行真正的工具——这就是 Function Calling。",
      analogy: "像点菜：你（模型）说出“要一份番茄炒蛋”（结构化订单），厨房（程序）真的去炒。你不动手，但要说清点什么。",
      real: "流程：模型输出 <code>tool_calls</code>（工具名 + 参数 JSON）→ 程序校验参数 → 执行真实 API → 结果作为 <code>tool</code> 消息回填上下文 → 模型继续推理。模型只负责“决定调什么、传什么”，真正的执行、鉴权、限流都在程序侧。",
      quiz: { q: "为什么参数校验必须放在程序侧，不能只靠模型？", a: "模型可能给出格式错误、越界甚至恶意的参数（金额写错、用了别人的 ID）。程序侧的校验（类型、枚举、范围、权限）是最后一道防线——模型说什么都不能直接执行。" },
      links: [{ t: "Function Calling 分步接力", el: "exe-fc-flow" }, { t: "参数组装实战", el: "exe-args" }]
    },
    {
      id: "api", icon: "server", nav: "工具 = API", name: "工具 = API", en: "TOOL AS API",
      tip: "每个工具背后都是一个接口（API）：查天气=天气接口，算数=计算服务。工具就是“给模型用的 API 说明书”。",
      analogy: "像家里的电器插头：不管电器是什么，都插同一种插座（统一接口）；模型只要知道“这个插座能干什么”就能用。",
      real: "一次真实调用包含：请求（参数 + 鉴权头）→ 服务端处理 → 响应（JSON）→ 解析成模型能读的文本。工程要点：<b>超时与重试</b>、<b>幂等</b>（重复调用不出错）、<b>错误码映射</b>（把 500 翻译成“服务暂时不可用”）。",
      quiz: { q: "为什么工具调用必须设超时？", a: "外部服务可能卡住不返回。不设超时，Agent 会一直等下去：用户看到转圈、Token 与时间都在烧。超时后要能降级——重试、换数据源，或如实告知。" },
      links: [{ t: "有工具 vs 没工具", el: "pg-withtool" }]
    },
    {
      id: "five", icon: "box", nav: "工具五分类", name: "工具五分类", en: "5 CATEGORIES OF TOOLS",
      tip: "ai-agent-book 把工具分成五类：感知、执行、协作、事件触发、用户沟通——分类决定了“该给 Agent 配哪些工具”。",
      analogy: "像文具盒：笔、尺子、胶水、剪刀、便签各有用途。你不会给一个只画画的人配剪刀。",
      real: "五类各管一件事：<b>感知工具</b>（查天气 / 搜索——把信息读进来）、<b>执行工具</b>（算数换算 / 下单发消息——对世界或数据做出改变）、<b>协作工具</b>（委托子 Agent / 请求人工确认——分工）、<b>事件触发工具</b>（定时任务 / 新消息回调——外部驱动）、<b>用户沟通工具</b>（主动发消息 / 通知——连接用户）。配工具的原则是“按场景配必要的一组”，不是“什么都有”。",
      quiz: { q: "为什么“工具越多越好”是错的？", a: "工具越多，可选项越多，模型选错的概率越高；而且每个工具的定义都要占用上下文。正确做法是按场景配最必要的一组，需要时再加。" },
      links: [{ t: "工具抢答游戏", el: "pg-toolgame" }]
    },
    {
      id: "desc", icon: "pen", nav: "工具描述", name: "工具描述（Tool Description）", en: "TOOL DESCRIPTION",
      tip: "工具描述是模型选择工具的唯一依据：写得清楚，才可能选对。",
      analogy: "像给遥控器按键贴标签：只写“按钮 1、按钮 2”没人会用；写成“电源、音量+、频道-”人人都会。",
      real: "一份好描述写全<b>四要素</b>：<b>功能</b>（一句话说清用途，名字最好动词开头）、<b>参数</b>（类型 / 是否必填 / 枚举值）、<b>返回</b>（会拿回什么结果）、<b>场景</b>（什么时候该用、什么时候不该用）。描述含糊是“选错工具”的第一大原因。",
      quiz: { q: "“工具名：do_stuff；描述：处理数据”有什么问题？", a: "名字没说明做什么、描述里没有参数与返回说明，模型无法判断该不该用它。改法示例：weather_query +“查询指定城市指定日期的天气，参数 city（中文城市名）、date（YYYY-MM-DD）”。" },
      links: [{ t: "工具抢答游戏", el: "pg-toolgame" }, { t: "描述质量调参", el: "exe-desc" }]
    },
    {
      id: "mcp", icon: "link", nav: "MCP 协议", name: "MCP 协议", en: "MODEL CONTEXT PROTOCOL",
      tip: "MCP 是工具的“USB 接口”：统一协议后，工具接一次就能被不同模型 / 应用复用。",
      analogy: "像 USB：以前每种设备一个专用接口，现在统一成一个口，插上就能用。",
      real: "没有标准时，N 个工具 × M 个模型 = N×M 套适配代码；有了 MCP，工具按协议暴露一次，任何支持 MCP 的客户端都能调用——把乘法变成了加法。它还带来统一的能力发现（列出有哪些工具）与权限声明。",
      quiz: { q: "为什么说 MCP 把“乘法变成加法”？", a: "没有标准时，工具与模型两两适配是 N×M；有了统一协议，工具只需实现一次、客户端只需接入一次，复杂度降到 N+M。工具生态才能真正长起来。" },
      links: [{ t: "该不该上 MCP（场景判断）", el: "exe-mcp" }, { t: "工具百宝箱", el: "pg-toolbox" }]
    },
    {
      id: "hallu", icon: "alert", nav: "工具幻觉", name: "工具发现与幻觉风险", en: "TOOL HALLUCINATION",
      tip: "模型可能“编造”根本不存在的工具或参数——这叫工具幻觉。",
      analogy: "像有人一本正经地说“我用第五种方法解决的”，其实根本没有第五种方法：听起来合理，机器一执行就报错。",
      real: "三种典型幻觉：<b>编工具</b>（调用不存在的函数）、<b>编参数</b>（传了 schema 里没有的字段）、<b>编结果</b>（工具还没返回就先把答案说了）；还要防一类<b>坏数据</b>（工具真返回了但结果明显不对）。四道防线：只暴露白名单工具、参数强校验、必须等 tool 消息回填才能继续生成、结果验证（检查返回值是否合理）。",
      quiz: { q: "“工具还没返回，模型就把天气说出来了”属于哪种幻觉？", a: "编造结果。它跳过了“观察”这一步，直接给出答案。防线是：工具调用之后必须等待 tool 消息回填，才允许生成最终回答。" },
      links: [{ t: "工具幻觉与约束", el: "pg-tool-fb" }]
    },
    {
      id: "chain", icon: "refresh", nav: "多工具协作", name: "多工具协作（Tool Chaining）", en: "TOOL CHAINING",
      tip: "复杂任务要按依赖顺序调用多个工具——这叫工具链式调用。",
      analogy: "像做一顿饭：先买菜（查信息）→ 再洗切（处理）→ 才下锅（执行）。顺序错了，饭做不成。",
      real: "链式调用的关键：<b>依赖关系</b>（上一步的输出是下一步的输入）、<b>中间结果校验</b>（拿不到就中止，而不是硬走）、<b>失败恢复</b>（换工具 / 换参数 / 上报）。工程上还会给单次任务设最大调用次数（停止条件）。",
      quiz: { q: "工具链：查天气 → 查景点 → 生成行程。哪个顺序不能反？为什么？", a: "不能反。生成行程需要“天气”与“景点”两个结果；而查景点通常不需要先知道天气。顺序必须服从数据依赖，而不是“哪个先问到”。" },
      links: [{ t: "预测多工具链式调用", el: "exe-chain" }]
    },
    {
      id: "sense", icon: "eye", nav: "感知 vs 执行工具", name: "感知工具 vs 执行工具", en: "READ vs WRITE TOOLS",
      tip: "工具分两类用途：一类“把世界读进来”（感知），一类“把决定做出去”（执行）——风险等级完全不同。",
      analogy: "像眼睛和手：看错了可以再看（低风险）；手一挥可能打翻东西（高风险）。",
      real: "<b>感知工具</b>（查询 / 搜索 / 读文件）只读、风险低，可以放开用；<b>执行工具</b>（下单 / 发消息 / 删除 / 转账）会改变真实世界，必须加人工确认、权限校验、额度限制与审计日志。",
      quiz: { q: "为什么“删除文件”和“查询天气”要用完全不同的治理强度？", a: "因为可逆性不同：查天气看错了没有影响，删文件删错了无法撤销。治理强度应当按“操作的不可逆程度与影响范围”来定。" },
      links: [{ t: "工具百宝箱", el: "pg-toolbox" }]
    },
    {
      id: "event", icon: "clock", nav: "事件驱动工具", name: "事件驱动工具（Event-Driven）", en: "EVENT-DRIVEN TOOLS",
      tip: "有些工具不是“被叫才做”，而是“到点自己动”：定时任务、消息回调、监控告警——这叫事件驱动。",
      analogy: "像闹钟与门铃：闹钟到点自己响（定时事件），门铃有人按才响（回调事件）——都不需要你一直守着。",
      real: "事件驱动让 Agent 从“问答机器人”变成“常驻助手”：<b>定时触发</b>（每天 7:30 检查课表并提醒）、<b>订阅回调</b>（有新邮件就处理）、<b>阈值告警</b>（库存低于阈值就补货）。工程上要处理重复触发、事件失序，以及“事件来了但用户不在”的情况。",
      quiz: { q: "“每天早上 7:30 自动提醒今天值日”属于哪种触发？", a: "定时触发（cron 类事件）。它不需要用户提问，时间到了就执行——这正是 Agent 从被动回答走向主动服务的关键一步。" },
      links: [{ t: "工具百宝箱", el: "pg-toolbox" }]
    },
    {
      id: "gov", icon: "shield", nav: "工具治理", name: "Harness 中的工具治理", en: "TOOL GOVERNANCE",
      tip: "“模型说什么就执行什么”是危险的：工具调用必须经过治理层。",
      analogy: "像门禁：不是谁刷卡都能进机房，得有权限、得登记，危险操作还得主管确认。",
      real: "治理四件事：<b>白名单</b>（只能调登记过的工具）、<b>参数校验</b>（类型 / 范围 / 枚举）、<b>人工确认</b>（危险操作先问人）、<b>审计日志</b>（谁在什么时候调了什么、结果如何）。这一层不在模型里，而在系统的 Harness 层。",
      quiz: { q: "为什么审计日志是治理的必需品？", a: "出问题时，它是唯一能还原“发生了什么”的依据：调了哪个工具、传了什么参数、谁批准的。没有日志，故障排查与责任界定都无从下手。" },
      links: [{ t: "工具百宝箱", el: "pg-toolbox" }]
    },
    {
      id: "aci", icon: "wrench", nav: "工具设计（ACI）", name: "工具设计：给 Agent 用的界面（ACI）", en: "AGENT-COMPUTER INTERFACE",
      tip: "工具不是“把底层接口原样暴露给模型”，而是按“Agent 要达成什么目标”来设计——这才是给机器用的界面。",
      analogy: "像给新同学写“教室设备使用说明”：不写“按下第二排第三个开关”，而写“想投影就按这里”。<b>按目标设计</b>，而不是按零件设计。",
      real: "三条设计原则：① 工具的粒度要匹配<b>目标</b>（“查资料并整理”比“GET /api/v1/search?q=”好用）；② <b>防呆</b>——让错误从设计上发生不了（SIM 卡的缺角只能一个方向插、微波炉门没关好就不加热）；③ 优先考虑<b>通用执行器</b>（一个代码执行能顶几十个小工具），只有四种情况才值得专门造工具：安全权限、屏蔽平台差异、超高频调用、参数复杂需要强校验。<br>此外工具必须<b>保真</b>：不改参数、不藏截断。",
      quiz: { q: "为什么“一个通用的代码执行工具”常常比“几十个专用小工具”更好用？", a: "因为模型不必在几十个相似工具里挑（工具越多越容易选错、定义也越占上下文），它只需写一小段代码就能组合出想要的能力。但通用工具的权限更大，所以要关进沙盒、限制目录与网络——能力与约束要一起给。" },
      links: [{ t: "工具描述与选择", el: "exe-desc" }, { t: "实验：代码执行与沙盒", el: "exe-sandbox" }]
    },
    {
      id: "idem", icon: "key", nav: "幂等与重试", name: "幂等与重试安全", en: "IDEMPOTENCY & SAFE RETRY",
      tip: "重试前先问一句：这个动作做两遍，会不会变成两件事？会，就必须加保护。",
      analogy: "像按电梯按钮：按两次不会叫来两部电梯（幂等）；但“发送”按钮按两次，可能真的发出两条消息（不幂等）。",
      real: "判据：<b>重复执行是否产生额外副作用</b>。查询与可覆盖的写操作可以放心重试；对外发送、花钱、删除这类动作必须保护：① <b>幂等键</b>——给这件事一个唯一编号，服务端见过就不再重复执行；② <b>两段式</b>——先预检/请示，确认后再执行（人工确认超时通常按“保守”处理，即不执行）。<br>工程上还要配：重复调用指纹（同名工具同参数又出现＝原地打转）、连续失败计数与熔断（连续失败约 3 次转人工）。",
      quiz: { q: "“发通知超时了，直接再发一次”可能带来什么后果？", a: "可能真的发出两条通知（发送不可重复）。正确做法是带幂等键重试，或先查状态；对不可重复的动作，宁可多问一句，也不要多做一遍。" },
      links: [{ t: "实验：失败了能不能重试", el: "exe-idem" }, { t: "实验：四道防线", el: "exe-guard" }]
    },
    {
      id: "exec", icon: "lock", nav: "代码执行与沙盒", name: "代码执行与沙盒隔离", en: "CODE EXECUTION & SANDBOX",
      tip: "代码执行是执行力最强的工具——所以它必须跑在沙盒里：限目录、默认断网、设超时、限输出。",
      analogy: "像让孩子用真工具做木工：不给他整间屋子随便动，而是给他一张工作台（限定范围）、戴上护目镜（超时与限量），旁边还有老师看着（日志与确认）。",
      real: "沙盒管四件事：<b>能碰什么</b>（只能访问工作目录）、<b>能去哪</b>（默认断网、白名单放行）、<b>能跑多久</b>（超时中止，并把原因结构化回传）、<b>能说多少</b>（输出截断要说明，完整结果留档可再读）。<br>隔离强度三档：进程级 → 容器（最常见）→ 微型虚拟机（最强）。<b>虚拟环境（venv）不是沙盒</b>：它管“用哪个环境”，拦不住删文件与联网。代码编排还能省 Token（中间结果留在执行环境，只回传最终结果）。",
      quiz: { q: "为什么“默认断网”是沙盒里最关键的一条？", a: "因为断网能一次挡住最坏的结果——把数据偷偷传出去。即使代码读到了敏感内容，没有网络出口就带不走；确实需要联网时再按白名单放行，风险可控。" },
      links: [{ t: "实验：代码执行与沙盒", el: "exe-sandbox" }, { t: "工具百宝箱", el: "pg-toolbox" }]
    }
  ];

  /* 概念 id → 交互类型 */
  var EXE_TYPE = {
    fc: "composer", api: "pipeline", five: "matcher", desc: "sandbox", mcp: "decider",
    hallu: "annotator", chain: "sorter", sense: "decider", event: "switchboard", gov: "sandbox",
    /* 新增三概念：工具设计 / 重试安全 / 代码执行沙盒 */
    aci: "matcher", idem: "race", exec: "switchboard"
  };

  var EXE_DEMO = {
    fc: {
      title: "动手实验：Function Calling 的消息是怎么拼的？", hint: "按顺序点", icon: "wrench",
      poolTitle: "① 消息池（点一条放进上下文，注意角色顺序是否合法）",
      ctxTitle: "② 你拼出来的上下文",
      jsonTitle: "③ 真正发给模型的请求体（JSON，含工具定义）",
      emptyCtx: "还没有消息。先点第一条。",
      pool: [
        { role: "system", text: "你是天气小助手；需要天气时必须调用 weather_query 工具，不要自己编造。", tag: "开发者规则：必须用工具" },
        { role: "user", text: "明天北京会下雨吗？", tag: "用户提问" },
        { role: "assistant", text: '{"tool_calls":[{"name":"weather_query","arguments":{"city":"北京","date":"2026-10-12"}}]}', toolcall: true, tag: "模型输出：结构化调用指令（tool_calls）" },
        { role: "tool", text: '{"city":"北京","date":"2026-10-12","weather":"小雨","temp":"15~19℃"}', tag: "程序执行工具后回填的真实结果" },
        { role: "assistant", text: "明天北京小雨，15~19℃，记得带伞。", tag: "模型基于工具结果生成回答" }
      ],
      rules: { systemFirst: true, toolNeedsCall: true },
      notes: {
        used: "这条消息已经放过了。",
        systemLate: "system（规则）必须放最前面——它是开发者级约束；放到中间就降级成普通内容了。",
        toolEarly: "tool 消息必须紧跟在“模型请求调用工具”的那条 assistant 消息之后，模型才知道这条结果是在回答哪个请求。",
        done: '✓ 这就是 Function Calling 的完整一轮：system 定规则 → user 提问 → assistant 输出 tool_calls → tool 回填真实结果 → assistant 给出回答。<br><span class="dim">注意：模型全程没有“动手”，动手的是程序。</span>'
      },
      demoNoSystem: {
        label: "演示：少了 system 规则会怎样",
        skipRole: "system",
        note: "模型不知道“必须调用工具”，就可能直接凭记忆编一个天气——这正是幻觉的来源。"
      },
      resetLabel: "清空重来",
      jsonBody: function (msgs) {
        return {
          model: AgentLab.Store.getApi().model || AgentLab.CONFIG.model,
          messages: msgs,
          tools: [{
            type: "function",
            function: {
              name: "weather_query",
              description: "查询指定城市指定日期的天气",
              parameters: { type: "object", properties: { city: { type: "string" }, date: { type: "string" } }, required: ["city", "date"] }
            }
          }],
          temperature: AgentLab.CONFIG.temperature
        };
      }
    },
    api: {
      title: "动手实验：一次工具调用的完整链路", hint: "先猜后放", icon: "server",
      playLabel: "自动播放一遍", stepLabel: "单步推进", resetLabel: "重来",
      logTitle: "调用链路日志",
      stages: [
        { id: "validate", name: "参数校验", icon: "check", en: "Validate", io: "类型 / 必填 / 枚举 / 范围——模型给的参数先过一遍" },
        { id: "auth", name: "鉴权", icon: "key", en: "Authorize", io: "带上密钥或令牌，确认这次调用有权限" },
        { id: "request", name: "发请求", icon: "send", en: "Request", io: "按接口格式发出（含超时设置）" },
        { id: "server", name: "服务端处理", icon: "server", en: "Server", io: "真正干活的地方：可能成功，也可能返回 4xx / 5xx" },
        { id: "parse", name: "解析响应", icon: "box", en: "Parse", io: "把 JSON 变成模型能读的文本；错误码翻译成人话" }
      ],
      guess: {
        q: "先猜一猜：哪一环最容易被忽略，却决定了安全性？",
        opts: [
          { k: "validate", t: "参数校验" },
          { k: "request", t: "发请求" },
          { k: "parse", t: "解析响应" }
        ],
        ans: "validate",
        why: "参数校验最容易被跳过，但它决定了“模型说的能不能直接执行”。类型错、越界、枚举非法都在这里挡住；模型给的参数永远不能直接透传给真实系统。",
        hint: "想想“模型说什么就执行什么”会发生什么。",
        revealAt: 0
      }
    },
    five: {
      title: "动手实验：这些工具各属于哪一类？", hint: "左右配对", icon: "box",
      leftTitle: "① 先点左边一个工具：",
      rightTitle: "② 再点右边它属于哪一类：",
      left: [
        { id: "t1", label: "天气查询", icon: "cloud", why: "只读：把外部信息读回来，属于感知工具。" },
        { id: "t2", label: "联网搜索", icon: "search", why: "只读：从外部获取信息，属于感知工具。" },
        { id: "t3", label: "时间日期", icon: "clock", why: "只读：读的是系统时钟，获取信息，也属于感知工具。" },
        { id: "t4", label: "计算器", icon: "calc", why: "它对数据做“计算处理”，真正产出了新结果，属于执行工具。" },
        { id: "t5", label: "提醒工具", icon: "timer", why: "它会在未来某个时间执行动作、改变计划，属于执行工具。" },
        { id: "t6", label: "单位换算", icon: "ruler", why: "它把数值转换成另一种单位，属于执行工具（对数据做出改变）。" },
        { id: "t7", label: "委托子 Agent 去查资料", icon: "users", why: "把活儿分给另一个智能体去做，属于协作工具（分工协作）。" },
        { id: "t8", label: "定时任务：每天 7:30 检查课表", icon: "clock", why: "不需要用户提问，到点自己触发，属于事件触发工具。" },
        { id: "t9", label: "主动发消息通知家长", icon: "send", why: "系统主动与用户连接，而不是等用户来问，属于用户沟通工具。" }
      ],
      right: [
        { id: "per", label: "感知工具（把信息读进来）", icon: "eye" },
        { id: "exe", label: "执行工具（改变世界）", icon: "hand" },
        { id: "co", label: "协作工具（与其他 Agent 分工）", icon: "users" },
        { id: "ev", label: "事件触发工具（外部事件驱动）", icon: "bell" },
        { id: "us", label: "用户沟通工具（主动连接用户）", icon: "happy" }
      ],
      pairs: { t1: "per", t2: "per", t3: "per", t4: "exe", t5: "exe", t6: "exe", t7: "co", t8: "ev", t9: "us" },
      checkLabel: "检查我配的类别",
      resetLabel: "重来",
      empty: "先点左边一个工具，再点右边它属于哪一类。",
      pickTip: "先在左边点一个工具，再点右边它属于哪一类",
      passHtml: "五类工具的分工：<b>感知</b>把信息读进来、<b>执行</b>把决定做出去、<b>协作</b>找人分工、<b>事件触发</b>到点自己动、<b>用户沟通</b>主动连上人。配工具的原则是“按场景配必要的一组”，不是“什么都有”。",
      failHtml: "口诀：它只是把信息<b>读进来</b>（感知）、真的<b>改变</b>了什么（执行），还是让别人做 / 到点自己做 / 主动找人（协作 / 事件触发 / 用户沟通）？"
    },
    desc: {
      title: "动手实验：同一件事，两种工具描述", hint: "换一份描述再对比", icon: "pen",
      srcTitle: "① 选择用户需求（全程不变）：",
      sources: [
        {
          id: "d1",
          label: "“从家到学校要多久？”",
          safe: "用户需求：今天下午 3 点从家到学校要多久？（他需要的是路程时间）",
          evil: "现在的工具描述：route_calc —— “算路线”。没有参数说明、没有返回格式、没说什么时候该用。"
        },
        {
          id: "d2",
          label: "“把‘你好’翻成英文”",
          safe: "用户需求：把“你好”翻译成英文。",
          evil: "现在的工具描述：process —— “处理文本”。完全没有说明它翻译不翻译、支持哪些语言。"
        }
      ],
      defaultId: "d1",
      guardOn: true,
      guardTitle: "② 工具描述换一换：",
      guardLabelOn: "换成完整描述（功能 + 参数 + 返回 + 使用场景）",
      guardLabelOff: "换成含糊描述（只有一个名字）",
      contentTitle: "同一件事，模型看到的只有“需求 + 描述”：",
      dataLabel: "① 用户需求（不变）：",
      injectLabel: "② 工具描述（要对比的就是这里）：",
      outHtml: function (src, guarded) {
        if (guarded) {
          return "<b>模型的选择：选对工具，参数也填对了。</b><br>" +
            (src.id === "d1"
              ? '· 调用 <code>route_calc(from="家", to="学校", depart_time="15:00")</code>；<br>· 因为描述里写明了“输入起点终点与出发时间，返回预计时长（分钟）”，模型知道该传什么。'
              : '· 调用 <code>translate(text="你好", target_lang="en")</code>；<br>· 因为描述里写明了“支持中英互译，参数 text 与 target_lang”，模型不会把它当成“随便处理一下文本”。') +
            '<br><span class="dim">结论：描述写清楚，模型才能“选对 + 传对”。描述是工具与模型之间唯一的说明书。</span>';
        }
        return "<b>模型的选择：很可能选错或乱填参数。</b><br>" +
          (src.id === "d1"
            ? '· 看到“route_calc —— 算路线”，模型可能去算“家到学校有多远”（距离）而不是时长，也可能漏掉出发时间；<br>· 运气好能蒙对，运气不好就答非所问——<b>这种不确定性在课堂演示里最容易被当成“AI 不聪明”</b>。'
            : '· 看到“process —— 处理文本”，模型甚至无法确定它能不能翻译，可能干脆不调用工具、自己瞎翻一段；<br>· 结果看起来“也像那么回事”，但工具白配了。') +
          '<br><span class="dim">改法：把名字改成动词短语，补上参数（类型 / 必填 / 枚举）、返回格式和“什么时候该用”。</span>';
      }
    },
    mcp: {
      title: "动手实验：这套系统该不该上 MCP？", hint: "选两个答案", icon: "link",
      emptyText: "先回答上面两个问题，系统会给出建议。",
      questions: [
        { key: "scale", q: "① 工具与客户端的数量规模？", opts: [{ k: "few", t: "很少（1~2 个工具，1 个客户端）" }, { k: "many", t: "多（工具多，或要对接多个客户端 / 模型）" }] },
        { key: "share", q: "② 这些工具要给外部团队或第三方复用吗？", opts: [{ k: "yes", t: "需要，要给别人用" }, { k: "no", t: "不需要，只在自家系统里用" }] }
      ],
      decide: function (ans) {
        if (ans.scale === "many") {
          return "<b>建议上 MCP。</b><br>" +
            '<span class="dim">理由：工具与客户端一多，两两适配就是 N×M 套代码。统一协议后变成 N+M——工具实现一次，任何支持 MCP 的客户端都能接。工程上还顺带获得统一的能力发现与权限声明。</span>' +
            '<br><b>代价：</b>要多维护一层协议接入，小项目会显得“重”。';
        }
        if (ans.share === "yes") {
          return "<b>也建议上 MCP。</b><br>" +
            '<span class="dim">理由：一旦要给外部团队复用，统一接口就是刚需——否则每来一个团队就得写一套适配。协议的价值在“多方协作”时才真正体现。</span>';
        }
        return "<b>先用最简方案：直接写工具适配就够。</b><br>" +
          '<span class="dim">理由：规模小、只在一个系统里用，直接按自家框架写工具函数最快、最省事。等工具数量或接入方变多，再迁移到 MCP 也不迟——技术选型要匹配当前规模。</span>' +
          '<br><b>提示：</b>这正是工程上常见的判断方式：先用得起，再考虑标准化。';
      }
    },
    hallu: {
      title: "动手实验：这段调用日志里，哪些行为是幻觉？", hint: "在材料上点选", icon: "alert",
      materialLabel: "一次真实风格的调用日志：",
      taskLabel: "点选日志里所有属于<b>工具幻觉</b>的行为（编造工具 / 编造参数 / 编造结果）。",
      checkLabel: "检查我标的幻觉行为",
      resetLabel: "重来",
      empty: "先点选你认为属于幻觉的行为，再点「检查我标的幻觉行为」。",
      passHtml: "四道防线：<b>只暴露白名单工具</b>（防编工具）、<b>参数强校验</b>（防编参数）、<b>必须等 tool 消息回填才能生成</b>（防编结果）、<b>结果验证</b>（防坏数据）。",
      failHtml: "提示：区分“正常的工具调用”和“凭空造出来的东西”。",
      segments: [
        { text: "用户问“明天北京天气怎么样？”，模型随后输出：", ok: false, why: "这是正常的用户提问与模型输出，本身不是幻觉。" },
        { text: "调用工具 get_flight_price", ok: true, why: "编造工具：工具箱里根本没有这个工具（登记表里只有 weather_query / calculator / reminder），白名单校验会直接拒绝。" },
        { text: "，参数里塞了 schema 没有的 user_token=\"sk-abc123\"", ok: true, why: "编造参数，而且是最危险的一类：把密钥写进了参数。参数强校验（只允许登记过的字段）能拦住它。" },
        { text: "；紧接着又说“明天北京晴，25℃”", ok: true, why: "编造结果：工具还没返回就把天气说出来了，跳过了“观察”这一步。必须等 tool 消息回填后才能生成最终回答。" },
        { text: "；工具箱里实际登记的是 weather_query、calculator、reminder。", ok: false, why: "这是工具登记表——它正是用来判断“有没有编工具”的依据，本身不是幻觉。" },
        { text: "对照：正确的一轮应该调用 weather_query(city, date)，等工具结果回填后再回答。", ok: false, why: "这是正确做法：先观察、再回答，就不会编造。" }
      ]
    },
    chain: {
      title: "动手实验：把工具链排成正确顺序", hint: "点步骤排序", icon: "refresh",
      task: "帮我安排明天去公园：查天气、查景点、生成行程、发给用户确认、设置出行提醒",
      queueTitle: "调用顺序（点下面的步骤放进来）",
      poolTitle: "候选调用（点一条放进顺序队）",
      wrongHint: "这一步现在还调不了——它在等前面某一步的结果（比如没有天气和景点信息，生成不了行程）。",
      successHtml: "<b>顺序全对！</b>这就是 Tool Chaining：每一步的输入来自上一步的输出。",
      groupNote: "注意虚线框的两步：<b>查天气</b>和<b>查景点</b>互不依赖，真实系统里可以<b>并行调用</b>，省一半时间。",
      items: [
        { id: "c1", label: "查明天天气", seq: 1, group: "并行A" },
        { id: "c2", label: "查公园景点与开放时间", seq: 2, group: "并行A" },
        { id: "c3", label: "结合天气与景点生成行程", seq: 3 },
        { id: "c4", label: "把行程发给用户确认", seq: 4 },
        { id: "c5", label: "用户确认后设置出行提醒", seq: 5 }
      ]
    },
    sense: {
      title: "动手实验：这个工具该配多强的治理？", hint: "选两个答案", icon: "eye",
      emptyText: "先回答上面两个问题，系统会给出判断与理由。",
      questions: [
        { key: "cat", q: "① 这个工具属于哪一类？—— delete_file（删除文件）", opts: [{ k: "read", t: "感知工具（只读，把信息读进来）" }, { k: "write", t: "执行工具（会改变真实世界）" }] },
        { key: "gov", q: "② 该给它配多强的治理？", opts: [{ k: "loose", t: "宽松（和只读工具一样）" }, { k: "strict", t: "严格（权限 + 人工确认 + 审计）" }] }
      ],
      decide: function (ans) {
        var right = ans.cat === "write" && ans.gov === "strict";
        return (right ? '<span class="ok">✓ 判断正确：</span>' : '<span class="no">再想想：</span>') +
          "<b>delete_file 是执行工具</b>，必须配<b>严格治理</b>。<br>" +
          '<span class="dim">理由：它<b>改变了真实世界</b>，而且不可撤销——删错就没有撤销键。所以要有权限校验、人工确认、以及审计日志。</span><br>' +
          '<b>对照一下感知工具：</b>查询天气、搜索资料都是“只读”，看错了没有影响，可以放开用、连确认都不需要。<br>' +
          '<span class="dim">通用原则：治理强度 = 操作的<b>不可逆程度 × 影响范围</b>。删除文件、转账、群发消息都是最高一档。</span>';
      }
    },
    event: {
      title: "动手实验：订阅了哪些事件，Agent 才会主动做事", hint: "点开关", icon: "clock",
      chipsTitle: "① 已订阅的事件（点一下可取消订阅）：",
      chips: [
        { id: "e1", label: "定时事件：每天 7:30 检查课表", on: true },
        { id: "e2", label: "回调事件：收到新作业通知", on: true },
        { id: "e3", label: "阈值事件：粉笔库存低于 2 盒", on: false },
        { id: "e4", label: "人工触发：用户主动提问", on: true }
      ],
      viewTitle: "当前已订阅的事件",
      viewNote: "事件订阅决定了 Agent 能“主动做什么”——没有订阅的事件，它根本不会被唤醒。",
      viewEmpty: "一个事件都没订阅：Agent 只能等用户提问，完全被动。",
      actionsTitle: "② 这些主动行为能生效吗？",
      actions: [
        { id: "a1", label: "早上自动提醒今天谁值日", need: ["e1"], hint: "定时事件：到点自己触发，不需要用户提问。" },
        { id: "a2", label: "老师发新作业时自动记进知识库", need: ["e2"], hint: "回调事件：外部系统推过来，Agent 被动接收后处理。" },
        { id: "a3", label: "粉笔快用完时提醒班长去领", need: ["e3"], hint: "阈值事件：先要有“盯着库存”的订阅，越过阈值才触发。" },
        { id: "a4", label: "回答用户提问", need: ["e4"], hint: "人工触发：这是最基础的一条，本质上“用户提问”也是一个事件。" }
      ],
      resultEmpty: "点一件事试一试。",
      afterToggle: "订阅状态变了——再点下面某件事，看看还能不能被唤醒。",
      failTail: "对应的事件没有订阅——Agent 不会被唤醒，这件事永远不会自动发生。",
      okTail: "事件已订阅，到点或收到通知时就会触发执行。",
      onIcon: "clock", offIcon: "xmark"
    },
    gov: {
      title: "动手实验：有治理 vs 没治理，同一句指令的两种结局", hint: "开关治理层再看结局", icon: "shield",
      srcTitle: "① 选择一条模型发起的工具调用：",
      sources: [
        {
          id: "g1",
          label: "删除一个作业文件",
          safe: "模型请求：delete_file(path=\"/五年级2班/张三的作业.docx\")",
          evil: "风险点：删除不可撤销；而且路径指向具体某个学生的文件，属于高影响操作。"
        },
        {
          id: "g2",
          label: "给全体家长发通知",
          safe: "模型请求：send_message(to=\"全体家长\", text=\"明天不上学\")",
          evil: "风险点：一次误发影响面极大；“明天不上学”这类内容必须先人工确认。"
        }
      ],
      defaultId: "g1",
      guardOn: true,
      guardTitle: "② 系统治理层（模型管不着的一层）：",
      guardLabelOn: "治理开启：白名单 → 参数校验 → 人工确认 → 审计日志",
      guardLabelOff: "治理关闭：模型提什么就执行什么",
      contentTitle: "模型提交的这一条请求 + 它可能造成的后果：",
      dataLabel: "① 模型的请求：",
      injectLabel: "② 直接执行的风险：",
      outHtml: function (src, guarded) {
        if (guarded) {
          return "<b>治理层的处理：</b><span class=\"ok\">拦截 → 要求人工确认 → 记入审计日志</span><br>" +
            (src.id === "g1"
              ? "· 白名单检查：delete_file 在白名单里，但属于<b>高危工具</b>；<br>· 参数校验：路径存在、文件确实属于该班级；<br>· <b>转人工确认</b>：“即将删除张三的作业.docx，确认吗？”——老师点“取消”，操作终止；<br>· 审计日志记下：谁、何时、请求了什么、结果如何。"
              : "· 参数校验：收件人“全体家长”属于<b>群发</b>，命中高危规则；<br>· <b>转人工确认</b>：“即将向全体家长发送‘明天不上学’，确认吗？”；<br>· 老师发现内容有误（实际是“明天下午不上课”），改完再发；<br>· 全程留痕，事后可追查。") +
            '<br><span class="dim">治理层的价值：它不在模型里，而在系统的 Harness 层——模型可以提请求，但<b>不能决定要不要执行</b>。</span>';
        }
        return "<b>没有治理层，直接执行：</b><span class=\"no\">请求被原样执行</span><br>" +
          (src.id === "g1"
            ? "· 张三的作业文件当场被删除，无法恢复；<br>· 没有任何确认、没有日志——出事后连“是谁删的、为什么删”都查不到。"
            : "· 全体家长同时收到“明天不上学”，第二天大量学生没来上课；<br>· 事后再解释，信任已经受损。") +
          '<br><span class="dim">这两类事故在生产系统里都真实发生过——它们和“模型聪不聪明”无关，纯粹是<b>缺少工具治理</b>。</span>';
      }
    },
    /* 工具设计（ACI）：通用执行器 vs 专用工具 */
    aci: {
      title: "动手实验：这些需求，该用通用执行器还是专门造工具？", hint: "左右配对", icon: "wrench",
      leftTitle: "① 先点左边一个需求：",
      rightTitle: "② 再点右边它适合的做法：",
      left: [
        { id: "d1", label: "经常要算各种公式、处理表格数据", icon: "calc", why: "优先通用执行器：给一个“代码/脚本执行”能力，什么公式都能算——比做几十个小计算器划算得多。" },
        { id: "d2", label: "只允许读取指定目录，绝不能碰其他地方", icon: "lock", why: "专用工具：安全权限是造专用工具的典型理由——把边界写死在工具里。" },
        { id: "d3", label: "手机、电脑、网页上都要用，还要屏蔽系统差异", icon: "globe", why: "专用工具：屏蔽平台差异，让模型不用关心“在哪个系统上跑”。" },
        { id: "d4", label: "这个动作每天要用上千次，值得专门优化", icon: "zap", why: "专用工具：超高频调用，专用工具能做更快、更稳。" },
        { id: "d5", label: "参数很复杂（多字段、有枚举、要校验范围）", icon: "ruler", why: "专用工具：复杂参数需要强校验，专用工具能把规则写清楚、挡住非法输入。" },
        { id: "d6", label: "偶尔让 AI 写一小段代码算个结果", icon: "spark", why: "通用执行器：偶尔用一次，不必专门造工具——但要跑在沙盒里。" }
      ],
      right: [
        { id: "gen", label: "优先通用执行器（一个顶多个）", icon: "brain" },
        { id: "spec", label: "值得专门造一个工具", icon: "wrench" }
      ],
      pairs: { d1: "gen", d2: "spec", d3: "spec", d4: "spec", d5: "spec", d6: "gen" },
      checkLabel: "检查我配的做法",
      resetLabel: "重来",
      empty: "先点左边一个需求，再点右边它适合的做法。",
      pickTip: "先在左边点一个需求，再点右边它适合的做法",
      failHtml: "提示：先问一句——这件事需要“严格权限边界 / 屏蔽平台差异 / 超高频 / 复杂参数”吗？都不需要，就先用通用执行器。",
      passHtml: "设计口诀：<b>通用执行器优先（一个顶几十个小工具）；只有四种情况才专门造工具——安全权限、屏蔽平台差异、超高频调用、参数复杂需强校验。</b>"
    },
    /* 幂等与重试安全：双轨推进（精简版） */
    idem: {
      color: "exe",
      title: "动手实验：同一件事，重试方式不同，结果差多少？", hint: "点「走一步」", icon: "key",
      taskLabel: "任务：", task: "“帮我把「明天带美术工具」的通知发到班级群。”",
      stepLabel: "走一步", allLabel: "一次走完",
      empty: "点「走一步」，看两栏分别会发生什么。",
      tracks: [
        {
          id: "raw", label: "超时就重发（没有编号）", icon: "send",
          steps: [
            { t: "第 1 次发 → 超时（不确定对方收到没有）。", tone: "warn" },
            { t: "直接重发 → 又超时。", tone: "warn" },
            { t: "再发一次 → 成功。", tone: "ok" },
            { t: "同学们收到 <b>3 条</b>一样的通知，以为是三件事。", tone: "no" }
          ],
          tail: "结局：多做了两遍，而且收不回来。"
        },
        {
          id: "idem", label: "带编号再重试（幂等键）", icon: "key", win: true,
          steps: [
            { t: "第 1 次发（编号 notice-01）→ 超时。", tone: "warn" },
            { t: "带同一个编号重试 → 服务端认出“办过了”，直接返回上次结果。", tone: "ok" },
            { t: "同学们只收到 <b>1 条</b>通知，Agent 也拿到了真实状态。", tone: "ok" }
          ],
          tail: "结局：同一件事带同一个编号，重复请求只生效一次。"
        }
      ],
      summary: "<b>结论：</b>按下按钮之前先想——“做两遍会不会变成两件事？”会，就加幂等键，或改成“先确认、再执行”两段式。",
      quiz: {
        q: "下面哪个动作最不能“失败就重发”？",
        opts: ["把任务状态改成“已完成”", "在班级群发送一条通知", "查询明天的天气", "把文件名改成新名字"],
        ans: 1,
        why: "发通知不可重复：重发一次就多一条，而且收不回来。查询、可覆盖的写操作（改状态、改文件名）重试都安全。",
        hint: "想想哪个动作“做两遍会被大家看见”。"
      }
    },
    /* 代码执行与沙盒：保护开关 + 动作判定 */
    exec: {
      title: "动手实验：沙盒的保护关掉了，哪一步就危险了？", hint: "点开关", icon: "lock",
      chipsTitle: "① 当前生效的沙盒保护（点一下可以关掉）：",
      chips: [
        { id: "g1", label: "限目录：只能访问工作目录", on: true },
        { id: "g2", label: "默认断网：联网须白名单放行", on: true },
        { id: "g3", label: "超时中止：默认 120 秒，并结构化回传原因", on: true },
        { id: "g4", label: "输出限量：截断要说明，完整结果留档可再读", on: true },
        { id: "g5", label: "人工确认：危险动作（删除 / 外发）先问人", on: true }
      ],
      viewTitle: "当前生效的保护",
      viewNote: "这些保护都不在模型里，而在执行环境里——模型可以提出请求，但碰不到圈外的世界。",
      viewEmpty: "一条保护都没有：代码等于直接在你的电脑上跑。",
      actionsTitle: "② 试试执行这些代码：",
      actsTip: "先关掉一条保护，再点动作——看它会不会出圈。",
      actions: [
        { id: "a1", label: "读工作目录里的 scores.csv 并求平均", need: ["g1"], hint: "有“限目录”，它最多只能碰工作目录里的文件；关掉之后，它就能去读你电脑上任何地方的文件。" },
        { id: "a2", label: "从网上下载一份数据来处理", need: ["g2"], hint: "默认断网 + 白名单，既能做事又不至于“偷偷把数据传出去”；断网规则一关，代码可以连任何地址。" },
        { id: "a3", label: "跑一段来历不明的脚本", need: ["g1", "g2", "g5"], hint: "三段保护一起上：限目录 + 联网规矩 + 人工确认——来历不明的脚本最需要“有人看一眼再跑”。" },
        { id: "a4", label: "跑一个可能很慢的任务（比如几万次循环）", need: ["g3"], hint: "没有超时中止，它可能一直占着机器；有超时时会把“为什么被中止”结构化地告诉 Agent。" },
        { id: "a5", label: "处理一份会产生很长输出的数据", need: ["g4"], hint: "输出限量 + 说明截断，才不会把上下文塞满、也不会让 Agent 误以为“就这么多”。" }
      ],
      resultEmpty: "点一个动作试一试。",
      afterToggle: "保护状态变了——再点下面某个动作，看看还安不安全。",
      failTail: "缺少对应的保护，这一步就可能碰到不该碰的文件、偷偷联网外传、或一直跑下去。",
      okTail: "保护齐全，这一步可以在可控范围内执行。",
      onIcon: "lock", offIcon: "xmark"
    }
  };

  /* 概念 + 交互数据合体 */
  function exeConcepts() {
    return EXE_ADV.map(function (c) {
      return {
        id: c.id, icon: c.icon, nav: c.nav, name: c.name, en: c.en,
        tip: c.tip, analogy: c.analogy, real: c.real, quiz: c.quiz, links: c.links,
        demo: EXE_TYPE[c.id] || c.id,
        demoData: EXE_DEMO[c.id] || {}
      };
    });
  }

  function bindExeAdv() {
    AgentLab.Adv.bind($("sec-executor"), { key: "exe", concepts: exeConcepts(), color: "exe" });
  }

  /* ---------- 实验：参数组装器（多选判定） ---------- */
  function bindExeArgs() {
    var host = $("exe-args");
    if (!host) return;
    var d = {
      color: "exe",
      title: "动手实验：这次调用该填哪些参数？", hint: "多选后检查", icon: "wrench",
      taskLabel: "上下文：",
      task: "用户问“北京明天会下雨吗？”　工具定义：<code>weather_query</code> 必填 <code>city</code>(string)、<code>date</code>(string, YYYY-MM-DD)，可选 <code>unit</code>(枚举 celsius / fahrenheit)",
      checkLabel: "检查我选的参数",
      empty: "先点选你认为“必填且合法”的参数，再点「检查我选的参数」。",
      passHtml: "参数校验就看三件事：<b>必填齐不齐、类型格式对不对、有没有越界或不该出现的字段</b>。",
      failHtml: "提示：区分“合法的参数写入”和“格式不对 / schema 里没有 / 越界”的写法。",
      items: [
        { id: "p1", label: 'city = "北京"', ok: true, why: "必填项，值就是工具要的城市名，合法。" },
        { id: "p2", label: 'date = "2026-10-12"', ok: true, why: "必填项，格式符合 YYYY-MM-DD（口语里的“明天”要先换算成具体日期）。" },
        { id: "p3", label: 'unit = "celsius"', ok: true, why: "可选项，取值在枚举里，合法。" },
        { id: "p4", label: 'user_token = "sk-abc123"', ok: false, why: "schema 里没有这个字段，还把密钥塞进了参数——最危险的一类“编参数”。" },
        { id: "p5", label: 'date = "明天"', ok: false, why: "格式不合法：工具要求 YYYY-MM-DD。要先把“明天”换算成具体日期。" },
        { id: "p6", label: 'city = "北京｜上海"', ok: false, why: "一个参数塞了两个值，越界了。多城市要分多次调用。" }
      ]
    };
    host.innerHTML = AgentLab.Adv.types.picker.demoHTML(d);
    AgentLab.Adv.types.picker.bind(host, d);
  }

  /* ---------- 实验：工具描述质量调参 ---------- */
  function bindExeDesc() {
    var host = $("exe-desc");
    if (!host) return;
    var d = {
      color: "exe",
      title: "动手实验：描述写多细，模型才选得对？", hint: "拖滑条找峰值", icon: "pen",
      paramLabel: "工具描述详细程度",
      min: 0, max: 100, step: 5, value: 30, unit: "%",
      metricLabel: "工具选择准确率（估算）",
      compute: function (v) {
        var score, level, note;
        if (v < 20) {
          score = Math.round(30 + v); level = "bad";
          note = "描述太简：只有一个名字（如 do_stuff / process），模型分不清该用哪个工具、该传什么，经常选错或干脆不调用。";
        } else if (v <= 45) {
          score = Math.round(50 + (v - 20) * 1.2); level = "warn";
          note = "有好转但仍不够：写了功能，却没写参数类型与返回格式，模型容易填错参数。";
        } else if (v <= 80) {
          score = Math.round(94 + (v - 60) * 0.25); level = "ok";
          note = "合适：功能 + 参数 + 返回 + 使用场景四要素齐了，模型能分辨“该不该用、该传什么”，准确率到顶。";
        } else {
          score = Math.max(70, Math.round(99 - (v - 80) * 0.9)); level = "warn";
          note = "开始下降：文字堆太多会占用上下文预算，还可能把关键信息（参数名、必填）淹没在大段说明里。";
        }
        return { value: score, label: score + " %", note: note, level: level };
      },
      best: {
        q: "拖一圈之后判断：工具描述该写多细？",
        opts: ["越短越好（省 Token）", "越长越好（说明更全）", "写全四要素就够：功能 / 参数 / 返回 / 使用场景"],
        ans: 2,
        why: "描述的价值是“让模型能分辨该不该用、该传什么”。四要素齐了准确率就到顶；再堆字只会占预算、还可能淹没关键信息（必填项、枚举值）。",
        hint: "看准确率的峰值出现在哪一段。"
      }
    };
    host.innerHTML = AgentLab.Adv.types.tuner.demoHTML(d);
    AgentLab.Adv.types.tuner.bind(host, d);
  }

  /* ---------- 实验：工具幻觉的四道防线 ---------- */
  function bindExeGuard() {
    var host = $("exe-guard");
    if (!host) return;
    var d = {
      color: "exe",
      title: "动手实验：关掉一道防线，哪种风险就漏过去了？", hint: "点开关", icon: "shield",
      chipsTitle: "① 当前生效的防线（点一下可关掉）：",
      chips: [
        { id: "w1", label: "① 白名单：只暴露登记过的工具", on: true },
        { id: "w2", label: "② 参数强校验：只接受 schema 里的字段", on: true },
        { id: "w3", label: "③ 等待回填：tool 消息回来前不许生成回答", on: true },
        { id: "w4", label: "④ 结果验证：检查工具返回的数据是否合理", on: true }
      ],
      viewTitle: "当前生效的防线",
      viewNote: "四道防线分别对应四类风险：编工具 / 编参数 / 编结果 / 坏数据照单全收。",
      viewEmpty: "四道防线全关：模型想调什么就调什么、想说什么就说什么。",
      actionsTitle: "② 试着让模型“犯一次错”：",
      actions: [
        { id: "h1", label: "模型想调用不存在的 get_flight_price", need: ["w1"], hint: "白名单里没有这个工具，直接拒绝——拦住“编工具”。" },
        { id: "h2", label: "模型在参数里塞了 user_token 和密钥", need: ["w2"], hint: "参数强校验只放行 schema 里的字段——拦住“编参数”，也顺手挡住了密钥外泄。" },
        { id: "h3", label: "工具还没返回，模型想先说答案", need: ["w3"], hint: "规则要求必须等 tool 消息回填才能生成——拦住“编结果”。" },
        { id: "h4", label: "工具返回了温度 -200℃，模型想直接采用", need: ["w4"], hint: "结果验证会检查返回值是否在合理范围（比如 -50~60℃）——拦住“坏数据”。" }
      ],
      resultEmpty: "点一条试一试。",
      afterToggle: "防线状态变了——再点下面某条，看看还会不会被拦住。",
      failTail: "对应的防线被关掉了，这类风险就会直接漏过去。",
      okTail: "防线在，这类请求会被立刻拦住（或强制进入等待）。",
      onIcon: "shield", offIcon: "xmark"
    };
    host.innerHTML = AgentLab.Adv.types.switchboard.demoHTML(d);
    AgentLab.Adv.types.switchboard.bind(host, d);
  }

  /* ---------- 实验：多工具链式调用预测 ---------- */
  function bindExeChain() {
    var host = $("exe-chain");
    if (!host) return;
    var d = {
      color: "exe",
      title: "动手实验：预测这条工具链", hint: "先猜后放", icon: "refresh",
      playLabel: "自动播放整条链", stepLabel: "单步推进", resetLabel: "重来",
      logTitle: "工具链日志",
      stages: [
        { id: "parse", name: "识别任务", icon: "brain", en: "Parse", io: "“帮我安排明天去公园” → 拆出：天气、景点、行程、提醒" },
        { id: "weather", name: "调天气工具", icon: "cloud", en: "weather_query", io: "入参 city=北京, date=明天 → 返回“小雨 15~19℃”" },
        { id: "scenery", name: "调景点工具", icon: "globe", en: "spot_query", io: "入参 park=朝阳公园 → 返回开放时间与室内场馆" },
        { id: "plan", name: "生成行程", icon: "gear", en: "LLM", io: "把“天气 + 景点”两个结果合成行程方案（依赖前两步）" },
        { id: "send", name: "发送确认", icon: "send", en: "send_message", io: "把行程发给用户确认；确认后再设置提醒" }
      ],
      guess: {
        q: "先猜一猜：生成行程这一步，必须先拿到什么？",
        opts: [
          { k: "both", t: "天气和景点两个结果都要" },
          { k: "weather", t: "只要天气结果" },
          { k: "scenery", t: "只要景点结果" }
        ],
        ans: "both",
        why: "生成行程同时依赖“下不下雨”（决定室内/室外）和“景点开放时间/场馆”（决定去哪）。这就是数据依赖：上一步的输出是下一步的输入，缺一个都生成不出可执行的行程。",
        hint: "想想行程里要写哪些信息，这些信息从哪来。",
        revealAt: 3
      }
    };
    host.innerHTML = AgentLab.Adv.types.pipeline.demoHTML(d);
    AgentLab.Adv.types.pipeline.bind(host, d);
  }

  /* ---------- 实验：参数保真与静默失败（在调用日志上点选） ----------
   * 教学点（ai-agent-book chapter4:90-98、chapter4:336）：
   *   静默输入转换（弯引号被改直引号）、静默参数注入、静默截断（只返回前 20 条不说）；
   *   正确做法：明确告知（"已显示第 1-20 行，共 120 行"）+ 完整结果可再读。 */
  function bindExeFidelity() {
    var host = $("exe-fidelity");
    var T = AgentLab.Adv && AgentLab.Adv.types && AgentLab.Adv.types.annotator;
    if (!host || !T) return;
    var d = {
      color: "exe",
      title: "动手实验：这份调用日志里，工具“偷偷动手脚”的地方在哪？", hint: "点一行再检查", icon: "wrench",
      materialLabel: "一次工具调用的完整日志（Agent ↔ 工具）",
      taskLabel: "任务：Agent 要“明天 7:30 提醒值日”，并顺带查一下全班名单。",
      checkLabel: "检查我标的行",
      empty: "先点选你认为“工具自己偷偷改了、却没说”的那些行，再点「检查我标的行」。",
      missLabel: "漏标了 ", wrongLabel: "标错了 ",
      passHtml: "找齐了！这三处都属于<b>静默失败</b>：工具自己动了手，却没有告诉 Agent。报错至少会被发现，静默不会——Agent 会拿着被改过、被截断的信息一路做下去。",
      failHtml: "提示：要区分“工具明确告知的”（比如报错、说明只显示前 20 行）和“工具偷偷做的”。<b>可以少说，不能瞒着改。</b>",
      segments: [
        { text: "模型输出参数：{ 日期：“明天”，标题：“值日提醒” }", why: "正常：这是模型给出的原始参数，内容清楚。" },
        { text: "工具内部：自己把“明天”换算成“今天”后执行（没有回传说明）", ok: true, why: "← 静默改参数：工具擅自改了日期，而且没告诉 Agent。Agent 以为提醒设在明天，实际设在今天——用户第二天不会收到提醒。" },
        { text: "工具返回：提醒已创建 ✓（完全没提日期被改过）", ok: true, why: "← 静默：返回里看不到“改过什么”。Agent 无法察觉，错误会一路传到最终回答。" },
        { text: "工具返回名单：只给了前 20 条，没有说明还有更多", ok: true, why: "← 静默截断：Agent 会以为全班只有 20 人，据此算班费、发通知都会出错。正确写法是“已显示第 1-20 行，共 120 行”。" },
        { text: "工具返回报错：{ 缺参数 city，请补充后再调用 }", why: "这是<b>正确</b>做法：把失败原因结构化地说清楚，Agent 才能改正后重试。" },
        { text: "工具返回：已显示第 1-20 行，共 120 行（完整名单存于 list.txt，可再读）", why: "这也是<b>正确</b>做法：明确告知截断 + 给出再读的办法——Agent 知道“我还没看全”。" }
      ]
    };
    host.innerHTML = T.demoHTML(d);
    T.bind(host, d);
  }

  /* ---------- 实验：幂等与重试安全（双轨推进） ----------
   * 教学点（ai-agent-book chapter5:174-225 + chapter4:410）：
   *   先判断“值不值得重试”；重复调用指纹 + 连续失败计数；幂等键让重试只生效一次；
   *   不可重复的动作改用“预检/请示 → 确认 → 执行”两段式（人工确认）。 */
  function bindExeIdem() {
    var host = $("exe-idem");
    var T = AgentLab.Adv && AgentLab.Adv.types && AgentLab.Adv.types.race;
    if (!host || !T) return;
    var d = {
      color: "exe",
      title: "动手实验：工具超时之后，两种做法结局完全不同", hint: "点「走一步」", icon: "refresh",
      taskLabel: "任务：",
      task: "“帮我在班级群里发一条通知：明天带美术工具。”（发通知是<b>不可重复</b>的动作）",
      stepLabel: "走一步", allLabel: "一次走完",
      empty: "点「走一步」：左边是“超时就重发”，右边是“带编号再重试”——看同学们收到几条通知。",
      tracks: [
        {
          id: "raw", label: "超时就重发（没有编号）", icon: "send",
          steps: [
            { t: "第 1 次调用「发通知」工具 → 请求超时（不知道对方到底收到没有）。", tone: "warn" },
            { t: "没多想，直接重发一次 → 又超时。", tone: "warn" },
            { t: "再发第三次 → 这次返回成功。", tone: "ok" },
            { t: "结果：同学们收到了 <b>3 条一模一样</b>的通知，还以为是三件事。", tone: "no" }
          ],
          tail: "结局：消息发出去了，但“多做了两遍”——发出去的通知收不回来，只能再发一条道歉。"
        },
        {
          id: "idem", label: "带上“编号”再重试（幂等键）", icon: "key", win: true,
          steps: [
            { t: "第 1 次调用，带上这次任务的编号 notice-1013-01 → 超时。", tone: "warn" },
            { t: "重试时带<b>同一个编号</b> → 服务端认出“这件事已经办过”，直接返回上一次的结果。", tone: "ok" },
            { t: "Agent 由此确认：通知已经发出去了，不需要再发。", tone: "ok" },
            { t: "结果：同学们只收到 <b>1 条</b>通知，Agent 也掌握了真实状态。", tone: "ok" }
          ],
          tail: "结局：同一件事带着同一个编号，重复请求只会生效一次——就像按两次电梯按钮，不会来两部电梯。"
        }
      ],
      summary: "<b>结论：</b>能否放心重试，取决于<b>重复执行会不会产生额外后果</b>。<br>查询类、可覆盖的写操作可以重试；" +
        "对外发送、花钱、删除这类动作必须保护起来：<b>① 幂等键</b>（同一件事带同一个编号）；<b>② 两段式</b>（先预检/请示，确认后再执行）。",
      quiz: {
        q: "为什么“幂等键”能让重试变安全？",
        opts: ["因为它让服务端能认出“这是同一件事”，重复请求只生效一次", "因为它让请求变快", "因为它会自动重试三次", "因为它能防止网络超时"],
        ans: 0,
        why: "幂等键是给这件事贴的唯一编号：服务端见过这个编号，就知道它已经办过了——于是不再重复执行，而是把上次的结果直接还给你。",
        hint: "想想按电梯按钮：按两次，电梯不会来两部。"
      }
    };
    host.innerHTML = T.demoHTML(d);
    T.bind(host, d);
  }

  /* ---------- 实验：哪些动作可以放心重试（多选判定） ---------- */
  function bindExeRetry() {
    var host = $("exe-retry");
    if (!host) return;
    var d = {
      color: "exe",
      title: "动手判断：哪些动作可以放心重试？", hint: "多选后检查", icon: "refresh",
      taskLabel: "口径：",
      task: "“可以放心重试”＝重复执行一次，<b>结果不会变多、也不会变乱</b>。选出所有可以放心重试的动作。",
      checkLabel: "检查我选的",
      empty: "先点选你认为可以放心重试的动作，再点「检查我选的」。",
      passHtml: "口诀：<b>只是“看”和“覆盖”的重试安全；会“多一次对外影响”的不能随便重试。</b>",
      failHtml: "提示：问自己一句——“这个动作做两遍，会不会变成两件事？”",
      items: [
        { id: "t1", label: "查天气（超时后重试）", ok: true, why: "纯查询：再查一次结果一样，没有副作用。" },
        { id: "t2", label: "把文件名改成“数学作业-小明”", ok: true, why: "可覆盖的写操作：同一个结果再做一遍还是它，不会变成两份文件。" },
        { id: "t3", label: "把任务状态标成“已完成”", ok: true, why: "同样是可覆盖的写操作：重复标记不影响结果。" },
        { id: "t4", label: "在班级群发一条通知", ok: false, why: "<b>不可重试</b>：发两遍就是两条通知，同学会以为是两件事——已发出的消息收不回来。要用幂等键或先确认。" },
        { id: "t5", label: "提交作业", ok: false, why: "<b>不可重试</b>：可能交两次，老师那边会出现重复记录。" },
        { id: "t6", label: "扣班费 / 转账", ok: false, why: "<b>不可重试</b>：做两遍就是两笔钱，而且不可逆——这类动作必须先确认再执行。" }
      ]
    };
    host.innerHTML = AgentLab.Adv.types.picker.demoHTML(d);
    AgentLab.Adv.types.picker.bind(host, d);
  }

  /* ---------- 实验：代码执行与沙盒（开关 + 两段代码对照） ----------
   * 教学点（ai-agent-book chapter5:335、chapter4:68）：
   *   沙盒管四件事：能碰什么（限目录）、能去哪（默认断网、白名单放行）、能跑多久（超时 120 秒并结构化返回）、
   *   能说多少（输出限量）；隔离三档：进程 / 容器 / 微型虚拟机；venv 不是沙盒。 */
  function bindExeSandbox() {
    var host = $("exe-sandbox");
    if (!host) return;
    var d = {
      color: "exe",
      title: "动手实验：同一段代码，有没有沙盒，结局差多少？", hint: "切开关对比", icon: "lock",
      srcTitle: "① 选择一段要执行的代码：",
      sources: [
        {
          id: "c1",
          label: "统计平均分（只读计算）",
          safe: "读入 scores.csv → 算平均分 → 打印结果。（看起来最安全的一段）",
          evil: "风险点：它仍然要读写文件。如果运行目录指错了，它碰到的可能就不是数据文件——一次误删或者覆盖，同样无法撤销。"
        },
        {
          id: "c2",
          label: "从网上抄来的“整理脚本”",
          safe: "把“作业”目录里的文件按姓名重命名，方便收作业。",
          evil: "风险点：脚本中间夹着一行——把整个目录打包上传到某个网址。这是最典型的“偷偷把东西传出去”。"
        }
      ],
      defaultId: "c1",
      guardOn: true,
      guardTitle: "② 代码沙盒：",
      guardLabelOn: "已开启（限目录 + 默认断网 + 120 秒超时 + 输出限量）",
      guardLabelOff: "已关闭（代码直接在你的电脑上跑）",
      contentTitle: "这段代码要做什么：",
      dataLabel: "① 它明面上要做的事：",
      injectLabel: "② 需要留意的风险点：",
      outHtml: function (src, guarded) {
        if (guarded) {
          return '<b>执行结果：<span class="ok">在沙盒里跑完，一切可控</span></b><br>' +
            '· <b>限目录</b>：只能读写指定的工作目录，碰不到你的文档、照片和系统文件；<br>' +
            '· <b>默认断网</b>：要联网的代码直接失败——<b>偷到东西也传不出去</b>；必须联网时按白名单放行；<br>' +
            '· <b>限时</b>：跑超过 120 秒就中止，并把“为什么被中止”<b>结构化地回传</b>给 Agent，而不是悄悄杀掉；<br>' +
            '· <b>限输出</b>：结果太长会截断并说明，完整结果留在沙盒里可以再读。<br>' +
            '<span class="dim">就算出问题，影响也只留在沙盒这个“小圈子”里——删掉重建就行。' +
            (src.id === "c2" ? '<br>这段脚本的“上传”那一行会在断网环境下失败，Agent 会看到明确的错误，进而追问：为什么要上传？' : "") + "</span>";
        }
        return '<b>执行结果：<span class="no">代码直接在你的电脑上跑了</span></b><br>' +
          '· 它能<b>读到你所有的文件</b>（作业、照片、聊天记录……）；<br>' +
          '· 它能<b>连上网络</b>，把读到的东西发到任何地方；<br>' +
          '· 它能<b>删文件、改系统设置</b>——删掉的东西没有回收站；<br>' +
          '· 跑飞了也没有时间限制，它可能一直占用你的电脑。<br>' +
          '<span class="dim">这不是吓唬人：这就是为什么“让 AI 帮我在电脑上做事”，一定要跑在沙盒（隔离环境）里。' +
          (src.id === "c2" ? '<br>上面那段脚本，现在就会真的把整个目录打包上传出去——而且没有任何人拦它。' : "") + "</span>";
      }
    };
    host.innerHTML = AgentLab.Adv.types.sandbox.demoHTML(d);
    AgentLab.Adv.types.sandbox.bind(host, d);
  }

  /* ---------- 实验：该不该上 MCP（场景判断） ---------- */
  function bindExeMcp() {
    var host = $("exe-mcp");
    if (!host) return;
    var d = {
      color: "exe",
      title: "动手实验：该不该上 MCP？", hint: "两个场景各选一个答案", icon: "link",
      emptyText: "先回答上面两个问题，系统会给出建议。",
      questions: [
        { key: "a", q: "场景 A：班级小管家只有 2 个工具（天气 + 计算器），只在本班自己用。该不该上 MCP？",
          opts: [{ k: "no", t: "先不上：直接写工具适配就够" }, { k: "yes", t: "上 MCP：先标准化再说" }] },
        { key: "b", q: "场景 B：学校要做“校园工具平台”：10 个工具要接给 3 个系统（小管家 / 图书助手 / 课表机器人）复用。该不该上 MCP？",
          opts: [{ k: "yes", t: "上 MCP：N×M 变 N+M" }, { k: "no", t: "不上：每个系统各写一套适配" }] }
      ],
      decide: function (ans) {
        var right = ans.a === "no" && ans.b === "yes";
        return (right ? '<span class="ok">✓ 判断正确！</span>' : '<span class="no">再想想：</span>') +
          "<b>场景 A 先用最简方案</b>——规模小、自己用，直接写工具适配最快、最省事；<b>场景 B 该上 MCP</b>——工具多、要接 3 个系统复用，统一协议把 N×M 变成 N+M。<br>" +
          '<span class="dim">口诀：先看规模，再看复用——技术选型要匹配当前规模；先用得起，再考虑标准化。</span>';
      }
    };
    host.innerHTML = AgentLab.Adv.types.decider.demoHTML(d);
    AgentLab.Adv.types.decider.bind(host, d);
  }

  return { render: render };
})();
