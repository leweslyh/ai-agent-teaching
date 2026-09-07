/* ============================================================
 * lab-executor.js —— 执行器实验室（对应 L11 / L12）
 * 13 模块：学习目标 → 认识执行器 → 工具五分类 → 有工具vs没工具
 *   → Function Calling机制 → 工具描述与选择 → 连线游戏
 *   → MCP协议 → 工具百宝箱 → 工具幻觉与约束 → 多工具协作
 *   → 小测验 → 进阶原理+课堂小结
 * 参考 ai-agent-book chapter4（工具五分类/工具描述/MCP/执行工具/协作工具）
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

AgentLab.LabExecutor = (function () {
  var U = AgentLab.UI;
  var $ = U.$;

  var TOOLS = [
    { id: "weather", icon: "cloud", name: "天气查询工具", desc: "查询某个城市某天的天气，返回温度、降水、风力。", category: "perception" },
    { id: "calc", icon: "calc", name: "计算器工具", desc: "快速算算术，比如 25 × 4 + 10。", category: "execution" },
    { id: "remind", icon: "bell", name: "提醒工具", desc: "帮同学记下“要带什么、要做什么”，到时间提醒。", category: "execution" },
    { id: "classInfo", icon: "book", name: "课表查询工具", desc: "从班级知识库查出我们班的课表、值日和通知。", category: "perception" },
    { id: "search", icon: "search", name: "联网搜索工具", desc: "上网搜索真实资料，比如“搜一下恐龙是什么”或“查查珠穆朗玛峰有多高”。", category: "perception" },
    { id: "translate", icon: "lang", name: "翻译工具", desc: "中英互译，比如“苹果用英语怎么说”或“把 hello 翻译成中文”。", category: "execution" },
    { id: "convert", icon: "ruler", name: "单位换算工具", desc: "长度、重量、温度等换算，比如“5米等于多少厘米”或“35摄氏度等于多少华氏度”。", category: "execution" },
    { id: "datetime", icon: "clock", name: "时间日期工具", desc: "查现在几点、今天几号、星期几，还能推算“三天后是几号”“下周五是几号”。", category: "perception" },
    { id: "shape", icon: "shape", name: "图形计算工具", desc: "算面积、周长、体积：正方形、长方形、三角形、梯形、圆、长方体……", category: "execution" },
    { id: "math", icon: "percent", name: "数学计算工具", desc: "算百分数、折扣、平均数，比如“60的30%是多少”“200元打8折”。", category: "execution" },
    { id: "timer", icon: "timer", name: "计时器工具", desc: "倒计时、番茄钟，比如“帮我计时25分钟”——到点真的会提醒。", category: "execution" },
    { id: "game", icon: "dice", name: "猜数字游戏工具", desc: "和智能体玩猜数字：想一个 1~100 的数，你猜它说“大了/小了”，顺便学会二分法。", category: "execution" },
    { id: "idiom", icon: "idiom", name: "成语接龙工具", desc: "成语接龙：智能体出题，你接成语，它还带释义和提示。", category: "execution" }
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
    { q: "小红考了90、85、95，平均分是多少？", ans: "math" },
    { q: "帮我计时25分钟（番茄钟）", ans: "timer" },
    { q: "我们来玩猜数字游戏吧！", ans: "game" },
    { q: "成语接龙，开始！", ans: "idiom" }
  ];

  // 小测验
  var QUIZ = [
    { q: "执行器（工具）在智能体中扮演什么角色？", opts: ["大脑，负责思考", "眼睛，负责看", "手，负责调用外部能力完成任务", "小本子，负责记忆"], ans: 2, why: "执行器就是 AI 的“手”——大语言模型自己不会实时查、不会真操作，执行器通过调用天气、计算、搜索等外部工具，把事真正办成。" },
    { q: "ai-agent-book 把工具分成几类？", opts: ["3类：感知、执行、协作", "5类：感知、执行、协作、事件触发、用户沟通", "2类：输入、输出", "4类：搜索、计算、控制、通信"], ans: 1, why: "ai-agent-book chapter4:7 — 工具五分类：①感知工具（获取信息）②执行工具（改变世界）③协作工具（与其他 Agent 分工）④事件触发工具（外部输入驱动）⑤用户沟通工具（主动与用户连接）。" },
    { q: "“查天气”“联网搜索”属于哪类工具？", opts: ["感知工具（获取信息）", "执行工具（改变世界）", "协作工具（与其他 Agent 分工）", "事件触发工具"], ans: 0, why: "ai-agent-book chapter4 — 感知工具负责获取信息：搜索引擎、文件系统、API、天气查询等。它们不改变世界，只是让 AI“看到”更多信息。" },
    { q: "“发消息”“下单”“设置提醒”属于哪类工具？", opts: ["感知工具", "执行工具（改变世界）", "协作工具", "用户沟通工具"], ans: 1, why: "ai-agent-book chapter4 — 执行工具负责改变世界：代码执行、文件操作、系统命令、发消息、下单等。它们真正对外部世界产生影响。" },
    { q: "Function Calling（函数调用）的工作机制是什么？", opts: ["AI 直接执行代码", "AI 输出一段 JSON 指令（如 {tool: 'get_weather', city: '北京'}），由程序去执行真正的工具", "AI 用自然语言告诉用户怎么做", "AI 调用浏览器插件"], ans: 1, why: "真实系统里，模型不是“动手”，而是输出一段结构化的 JSON 指令，指定要调用的工具名和参数，由 Harness 层的程序去执行真正的工具，再把结果返回给模型。" },
    { q: "MCP（模型上下文协议）的作用是什么？", opts: ["一种新的编程语言", "让智能体标准化地接上各种工具，相当于“工具的 USB 接口”", "一种数据库格式", "一种模型训练方法"], ans: 1, why: "ai-agent-book chapter4:100 — MCP（Model Context Protocol）是业界提出的标准化工具接入协议，相当于“工具的 USB 接口”——一个协议接遍所有工具，不需要为每个工具单独写适配代码。" },
    { q: "工具描述（Tool Description）为什么重要？", opts: ["让工具名字更好看", "告诉 AI 这个工具能干什么、需要什么参数，AI 才能正确选择和调用工具", "让工具运行更快", "用于工具分类"], ans: 1, why: "ai-agent-book chapter4:70 — 工具描述是 AI 选择工具的依据。好的描述包含：工具功能、参数说明、返回值格式。描述不清楚，AI 就可能选错工具或传错参数（导致幻觉）。" },
    { q: "“工具幻觉”指的是什么？", opts: ["工具运行出错", "模型编造不存在的工具或参数，或者编造工具返回结果", "工具返回了错误数据", "用户误用工具"], ans: 1, why: "模型可能“编造”不存在的工具名或参数（如调用一个根本没有的工具），或者在工具还没返回时就编造结果。生产系统用工具白名单、参数校验和结果验证来防止幻觉。" },
    { q: "“帮我规划明天的行程：先查天气，再查路线，最后设提醒”需要用到什么？", opts: ["单个工具", "多工具协作（一个任务依次调用多个工具）", "不需要工具", "只需要记忆器"], ans: 1, why: "复杂任务通常需要多工具协作：规划器拆解任务→依次调用天气工具、路线工具、提醒工具→每步结果追加到上下文→最后综合回答。这就是 ReAct 循环中工具的链式调用。" },
    { q: "生产系统防止工具幻觉的措施不包括以下哪个？", opts: ["工具白名单（只允许调用列表中的工具）", "参数校验（检查参数是否符合工具要求）", "结果验证（检查工具返回结果是否合理）", "让 AI 自由编造工具名以提高灵活性"], ans: 3, why: "生产系统用白名单、参数校验、结果验证来约束工具调用，防止 AI 编造不存在的工具或参数。让 AI 自由编造会增加幻觉风险，不是防幻觉措施。" }
  ];

  // 进阶原理卡
  var DEEP = [
    { term: "Function Calling（函数调用）", desc: "真实系统里，模型不是“动手”，而是输出一段 JSON 指令（如 {tool: 'get_weather', city: '北京'}），由 Harness 层的程序去执行真正的工具，再把结果返回给模型。本系统的执行器就是这个机制的简化版。" },
    { term: "工具 = API", desc: "每一个工具背后都是一个接口（API）：查天气调用天气服务、算数调用计算器、发消息调用消息系统。工具是智能体连接真实世界的“手”——没有 API，工具就无法真正执行。" },
    { term: "工具五分类", desc: "ai-agent-book chapter4:7 — ①感知工具（搜索引擎、文件系统、API——获取信息）②执行工具（代码执行、文件操作、系统命令——改变世界）③协作工具（委托子 Agent、请求人类确认——分工协作）④事件触发工具（新邮件、定时、Webhook——外部输入驱动）⑤用户沟通工具（文字消息、语音通话、邮件——主动连接用户）。" },
    { term: "工具描述（Tool Description）", desc: "ai-agent-book chapter4:70 — 工具描述是 AI 选择工具的依据，包含工具功能、参数说明、返回值格式。好的描述让 AI 能正确选择和调用工具；描述不清楚会导致选错工具或传错参数（幻觉）。" },
    { term: "MCP 协议", desc: "ai-agent-book chapter4:100 — MCP（Model Context Protocol）是业界提出的标准化工具接入协议，相当于“工具的 USB 接口”——一个协议接遍所有工具，不需要为每个工具单独写适配代码。支持本地工具、远程工具、SaaS 工具等多种来源。" },
    { term: "工具发现与幻觉风险", desc: "模型可能“编造”不存在的工具或参数（这叫幻觉）。生产系统会做工具白名单（只允许列表中的工具）、参数校验（检查参数类型和范围）和结果验证（检查返回结果是否合理）。你关掉工具后它“诚实说查不到”，正是约束起作用的体现。" },
    { term: "多工具协作（Tool Chaining）", desc: "复杂任务通常需要依次调用多个工具：规划器拆解任务→调用工具A→结果追加到上下文→调用工具B→...→最后综合回答。这是 ReAct 循环中工具的链式调用，每个工具的输出成为下一个工具的输入或模型推理的依据。" },
    { term: "感知工具 vs 执行工具", desc: "ai-agent-book chapter4 — 感知工具获取信息（搜索、查天气、读文件），不改变世界；执行工具改变世界（发消息、下单、写文件、执行代码）。两者配合：先用感知工具“看到”信息，再用执行工具“做出”行动。" },
    { term: "事件驱动工具（Event-Driven）", desc: "ai-agent-book chapter4 — 不是所有工具都由用户主动触发。事件触发工具由外部事件驱动：收到新邮件、定时任务到点、Webhook 回调。这让 Agent 能主动响应外部变化，而不是只在用户提问时才工作。" },
    { term: "Harness 中的工具治理", desc: "工具调用不是“模型说什么就执行什么”。Harness 层负责：工具注册与发现、参数校验与转换、执行与超时控制、结果格式化与注入、权限与安全审计。这就是“AI 会犯错，Harness 负责兜底”在执行器层面的体现。" }
  ];

  var matchDone = 0;

  /* ---------- 渲染 ---------- */
  function render() {
    var LP = AgentLab.LabPerception;
    var sec = $("sec-executor");
    sec.innerHTML =
      LP.labHead("exe", "hand", "执行器实验室", "让 AI 动手干活 · 组件篇·工具（L11–L12）") +

      /* 学习目标 */
      '<div class="lesson-goal card-exe">' +
        '<h3>' + U.icon("target", 18) + ' 本课学习目标（L11+L12）</h3>' +
        '<div class="goal-list">' +
          '<div class="goal-item"><span class="goal-num">1</span>理解执行器（工具）是 AI 的“手”——大语言模型自己不会实时查、不会真操作，执行器通过调用外部能力把事真正办成；掌握“有工具 vs 没工具”的本质区别</div>' +
          '<div class="goal-item"><span class="goal-num">2</span>了解 ai-agent-book 工具五分类（感知/执行/协作/事件触发/用户沟通），能判断天气、搜索、计算、提醒等工具分别属于哪类</div>' +
          '<div class="goal-item"><span class="goal-num">3</span>理解 Function Calling 机制（模型输出 JSON 指令→程序执行工具→结果返回模型）和工具描述的作用；了解 MCP 协议（工具的 USB 接口）</div>' +
          '<div class="goal-item"><span class="goal-num">4</span>建立工具安全与约束意识：知道工具幻觉风险（编造不存在的工具/参数），了解生产系统的白名单、参数校验、结果验证措施；理解多工具协作的链式调用模式</div>' +
        '</div>' +
      '</div>' +

      /* ① 认识执行器 */
      LP.card("exe", "① 认识执行器：AI 的“手”", "大语言模型自己不会“实时查”、不会“真操作”——就像人没手只能干着急。执行器（工具）就是 AI 的“手”，能调用查天气、算数、提醒、联网搜索、翻译、单位换算这些外部能力，把事真正办成！",
        '<div class="transform-flow">' +
          '<div class="tf-node">' + U.icon("brain", 20) + ' AI 大脑（想）</div>' +
          '<div class="tf-arrow">+</div>' +
          '<div class="tf-node" style="border-color:var(--c-exe)">' + U.icon("hand", 20) + ' 执行器·工具（做）</div>' +
          '<div class="tf-arrow">=</div>' +
          '<div class="tf-out">“查得到、算得出、搜得到、真办事”</div>' +
        '</div>' +
        '<div class="tip">' + U.icon("spark", 16) + ' 关键本领：<b>工具调用</b>是智能体区别于普通聊天机器人的关键之一——没工具只能“纸上谈兵”，有工具才能“真刀真枪”。工具越多，智能体本领越大。</div>'
      ) +

      /* ② 工具五分类 */
      LP.card("exe", "② 工具五分类（ai-agent-book chapter4:7）", "ai-agent-book 把工具分成五大类，每类有不同的职责。看看我们系统里的 13 个工具分别属于哪类？",
        '<div class="tool-categories">' +
          '<div class="tc-item tc-perception">' +
            '<div class="tc-head"><span class="tc-icon">' + U.icon("eye", 18) + '</span><b>感知工具</b><span class="tc-tag">获取信息</span></div>' +
            '<div class="tc-desc">让 AI“看到”更多信息，不改变世界</div>' +
            '<div class="tc-tools"><b>本系统中的：</b>天气查询、课表查询、联网搜索、时间日期</div>' +
          '</div>' +
          '<div class="tc-item tc-execution">' +
            '<div class="tc-head"><span class="tc-icon">' + U.icon("hand", 18) + '</span><b>执行工具</b><span class="tc-tag">改变世界</span></div>' +
            '<div class="tc-desc">真正对外部世界产生影响</div>' +
            '<div class="tc-tools"><b>本系统中的：</b>计算器、提醒、翻译、单位换算、图形计算、数学计算、计时器、猜数字、成语接龙</div>' +
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
        '<div class="tip" style="margin-top:12px">' + U.icon("book", 16) + ' <b>ai-agent-book 发现：</b>感知工具和执行工具是最基础的两类——先用感知工具“看到”信息，再用执行工具“做出”行动。协作、事件触发、用户沟通是更高级的工具形态，让 Agent 从“被动响应”走向“主动协作”。</div>'
      ) +

      /* ③ 有工具 vs 没工具 */
      LP.card("exe", "③ 实验：有工具 vs 没工具", "同一个问题“明天穿什么？”，先问一个没有工具的 AI，再问一个装了天气工具的 AI，看差在哪！",
        '<div class="row" style="margin-bottom:10px">' +
          '<button class="btn btn-gray" id="pg-notool">' + U.icon("xmark", 16) + ' 问没有工具的 AI</button>' +
          '<button class="btn btn-exe" id="pg-withtool">' + U.icon("cloud", 16) + ' 问有天气工具的 AI</button>' +
          '<button class="btn btn-ghost btn-sm" id="pg-tool-reset">重放</button>' +
        '</div>' +
        '<div class="tool-stage" id="pg-tool-log">' +
          '<span class="dim">$ 准备好了吗？先点上面的按钮，看看 AI 有没有“手”的区别。</span>' +
        '</div>' +
        '<div class="quiz-feedback" id="pg-tool-fb"></div>'
      ) +

      /* ④ Function Calling 机制 */
      LP.card("exe", "④ Function Calling 机制：AI 怎么“调用”工具？", "真实系统里，AI 不是直接“动手”，而是输出一段结构化的 JSON 指令，由程序去执行真正的工具。看看当你问“北京明天天气怎么样？”时，AI 内部发生了什么！",
        '<div class="fc-flow">' +
          '<div class="fc-step fc-1">' +
            '<div class="fc-num">1</div>' +
            '<div class="fc-title">用户提问</div>' +
            '<div class="fc-msg user-msg">北京明天天气怎么样？</div>' +
          '</div>' +
          '<div class="fc-arrow">↓</div>' +
          '<div class="fc-step fc-2">' +
            '<div class="fc-num">2</div>' +
            '<div class="fc-title">AI 大脑决定调用工具</div>' +
            '<div class="fc-desc">模型理解问题后，决定需要调用天气查询工具，并输出 JSON 指令</div>' +
            '<div class="fc-json">{<br>&nbsp;&nbsp;"tool": "get_weather",<br>&nbsp;&nbsp;"params": {<br>&nbsp;&nbsp;&nbsp;&nbsp;"city": "北京",<br>&nbsp;&nbsp;&nbsp;&nbsp;"date": "明天"<br>&nbsp;&nbsp;}<br>}</div>' +
          '</div>' +
          '<div class="fc-arrow">↓</div>' +
          '<div class="fc-step fc-3">' +
            '<div class="fc-num">3</div>' +
            '<div class="fc-title">程序执行工具</div>' +
            '<div class="fc-desc">Harness 层的程序收到 JSON 指令，调用真实的天气 API</div>' +
            '<div class="fc-msg ai-msg">$ 调用天气查询 API → 北京·明天<br>$ 工具返回：晴，15~25°C，微风</div>' +
          '</div>' +
          '<div class="fc-arrow">↓</div>' +
          '<div class="fc-step fc-4">' +
            '<div class="fc-num">4</div>' +
            '<div class="fc-title">结果返回模型，组织回答</div>' +
            '<div class="fc-desc">工具结果追加到上下文，模型基于真实结果生成自然语言回答</div>' +
            '<div class="fc-msg user-msg">北京明天晴天，气温15到25度，微风，适合穿薄外套哦！</div>' +
          '</div>' +
        '</div>' +
        '<div class="tip" style="margin-top:14px">' + U.icon("spark", 16) + ' <b>关键点：</b>AI 大脑不直接执行工具，而是输出“我要调用什么工具、传什么参数”的 JSON 指令。这就是 Function Calling——模型负责“决策”，程序负责“执行”，各司其职！</div>'
      ) +

      /* ⑤ 工具描述与选择 */
      LP.card("exe", "⑤ 工具描述与选择：AI 怎么知道该用哪个工具？", "ai-agent-book chapter4:70 — 工具描述是 AI 选择工具的依据。每个工具都要告诉 AI：我能干什么、需要什么参数、返回什么结果。描述不清楚，AI 就可能选错工具！",
        '<div class="tool-desc-demo">' +
          '<div class="td-item">' +
            '<div class="td-name">' + U.icon("cloud", 18) + ' 天气查询工具</div>' +
            '<div class="td-field"><b>功能：</b>查询某个城市某天的天气，返回温度、降水、风力</div>' +
            '<div class="td-field"><b>参数：</b>city（城市名，必填）、date（日期，可选，默认今天）</div>' +
            '<div class="td-field"><b>返回：</b>{temp: "15~25°C", weather: "晴", wind: "微风"}</div>' +
          '</div>' +
          '<div class="td-item">' +
            '<div class="td-name">' + U.icon("calc", 18) + ' 计算器工具</div>' +
            '<div class="td-field"><b>功能：</b>快速算算术，支持加减乘除和括号</div>' +
            '<div class="td-field"><b>参数：</b>expression（数学表达式，必填，如 "25*4+10"）</div>' +
            '<div class="td-field"><b>返回：</b>{result: 110}</div>' +
          '</div>' +
        '</div>' +
        '<div class="tip" style="margin-top:12px">' + U.icon("warn", 16) + ' <b>如果工具描述写得不好：</b>比如只写“工具1”不写功能，AI 就不知道该什么时候调用它，可能选错工具或传错参数（导致幻觉）。好的工具描述是执行器可靠工作的基础！</div>'
      ) +

      /* ⑥ 连线游戏 */
      LP.card("exe", "⑥ 游戏：这个任务该调用哪个工具？", "每个任务匹配一个最合适的工具，答对加星！共 " + MATCH.length + " 题。",
        '<div class="game-box" id="pg-toolgame">' +
          '<div class="row" style="margin-bottom:14px">' +
            TOOLS.map(function (t) {
              return '<span class="stage-pill pill-exe">' + U.icon(t.icon, 15) + " " + t.name + "</span>";
            }).join("") +
          "</div>" +
          '<div id="pg-toolgame-list"></div>' +
          '<div class="score-line"><span class="score-badge" id="pg-toolgame-score" data-score="0">★ 0</span><span id="pg-toolgame-note" style="color:var(--c-sub)"></span></div>' +
        '</div>'
      ) +

      /* ⑦ MCP 协议 */
      LP.card("exe", "⑦ MCP 协议：工具的“USB 接口”（ai-agent-book chapter4:100）", "如果每个工具都要单独写适配代码，那接 100 个工具就要写 100 套代码！MCP（Model Context Protocol）解决了这个问题——它是标准化的工具接入协议，相当于“工具的 USB 接口”。",
        '<div class="mcp-diagram">' +
          '<div class="mcp-center">' +
            '<div class="mcp-agent">' + U.icon("brain", 28) + '<br><b>AI Agent</b></div>' +
            '<div class="mcp-label">MCP 客户端</div>' +
          '</div>' +
          '<div class="mcp-arrows">' +
            '<div class="mcp-arrow">← 标准化协议 →</div>' +
            '<div class="mcp-arrow">← 标准化协议 →</div>' +
            '<div class="mcp-arrow">← 标准化协议 →</div>' +
          '</div>' +
          '<div class="mcp-servers">' +
            '<div class="mcp-server">' + U.icon("file", 20) + '<br><b>本地文件</b><br><small>读/写文件</small></div>' +
            '<div class="mcp-server">' + U.icon("cloud", 20) + '<br><b>远程 API</b><br><small>天气/搜索</small></div>' +
            '<div class="mcp-server">' + U.icon("code", 20) + '<br><b>SaaS 工具</b><br><small>邮件/日历</small></div>' +
            '<div class="mcp-server">' + U.icon("gear", 20) + '<br><b>数据库</b><br><small>SQL 查询</small></div>' +
            '<div class="mcp-server">' + U.icon("browser", 20) + '<br><b>浏览器</b><br><small>网页操作</small></div>' +
          '</div>' +
        '</div>' +
        '<div class="tip" style="margin-top:14px">' + U.icon("book", 16) + ' <b>ai-agent-book chapter4:100：</b>MCP 让 Agent 通过统一协议连接各种工具——本地工具、远程工具、SaaS 工具、数据库、浏览器等。不需要为每个工具单独写适配代码，就像 USB 接口让各种设备都能即插即用！</div>' +
        '<div class="tip" style="margin-top:8px">' + U.icon("spark", 16) + ' <b>MCP 的核心概念：</b>①MCP Server（工具提供方，如文件系统、数据库）②MCP Client（Agent 端，连接和调用 Server）③Tools（可调用的函数）④Resources（可读取的资源，如文件）⑤Prompts（可复用的提示模板）。</div>'
      ) +

      /* ⑧ 工具百宝箱 */
      LP.card("exe", "⑧ 工具百宝箱：开关工具试试", "这里是小管家身上的 " + TOOLS.length + " 种工具。试着关掉某个工具，再去“智能体实验室”问对应的问题，看看它的本领是不是就变小了？（开关会保存下来）",
        '<div id="pg-toolbox">' +
          TOOLS.map(function (t) {
            return '<div class="toggle-row">' +
              '<span class="t-label">' + U.icon(t.icon, 20) + " " + t.name + '<small style="color:var(--c-sub);font-weight:400;display:block">' + t.desc + "</small></span>" +
              '<label class="switch"><input type="checkbox" data-tool="' + t.id + '"><span class="slider"></span></label>' +
            "</div>";
          }).join("") +
        '</div>' +
        '<div class="tip">' + U.icon("target", 16) + ' 试试看：关掉“天气查询工具”，去智能体实验室问“明天穿什么？”，小管家是不是就答不上来啦？这就是“没工具只能纸上谈兵”！</div>'
      ) +

      /* ⑨ 工具幻觉与约束 */
      LP.card("exe", "⑨ 工具幻觉与约束：AI 会“编造”工具吗？", "模型可能“编造”不存在的工具或参数（这叫幻觉），或者在工具还没返回时就编造结果。生产系统用三道防线来防止幻觉！看看下面的场景，哪道防线在起作用？",
        '<div class="hallucination-demo">' +
          '<div class="hd-scenario">' +
            '<div class="hd-title">' + U.icon("warn", 18) + ' 危险场景：AI 编造了一个不存在的工具</div>' +
            '<div class="hd-msg">AI 输出：{ "tool": "get_user_password", "params": { "user": "小明" } }</div>' +
            '<div class="hd-result" style="color:var(--c-exe-deep)">✗ 这个工具根本不存在！如果直接执行，可能导致安全问题。</div>' +
          '</div>' +
          '<div class="hd-defenses">' +
            '<div class="hd-defense">' +
              '<div class="hd-dnum">1</div>' +
              '<div><b>工具白名单</b><br><small>只允许调用列表中的工具，不在列表中的直接拒绝</small></div>' +
            '</div>' +
            '<div class="hd-defense">' +
              '<div class="hd-dnum">2</div>' +
              '<div><b>参数校验</b><br><small>检查参数类型、范围、必填项，不符合就拒绝或修正</small></div>' +
            '</div>' +
            '<div class="hd-defense">' +
              '<div class="hd-dnum">3</div>' +
              '<div><b>结果验证</b><br><small>检查工具返回结果是否合理，异常时重试或报错</small></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="tip" style="margin-top:12px">' + U.icon("shield", 16) + ' <b>本系统的实践：</b>你关掉某个工具后，小管家会“诚实说查不到”，而不是编造结果——这就是工具白名单和约束起作用的体现！AI 会犯错，Harness 负责兜底。</div>'
      ) +

      /* ⑩ 多工具协作 */
      LP.card("exe", "⑩ 多工具协作：一个任务调用多个工具", "复杂任务通常需要依次调用多个工具——这叫工具链式调用（Tool Chaining）。看看“帮我规划明天的北京之行”需要调用哪些工具？",
        '<div class="multi-tool-flow">' +
          '<div class="mt-step mt-perception">' +
            '<div class="mt-icon">' + U.icon("cloud", 20) + '</div>' +
            '<div class="mt-content"><b>第1步：调用天气工具</b><br>查询北京明天的天气 → 结果：晴，15~25°C</div>' +
          '</div>' +
          '<div class="mt-arrow">↓ 结果追加到上下文</div>' +
          '<div class="mt-step mt-perception">' +
            '<div class="mt-icon">' + U.icon("search", 20) + '</div>' +
            '<div class="mt-content"><b>第2步：调用搜索工具</b><br>搜索“北京适合晴天去的景点” → 结果：故宫、颐和园、天坛</div>' +
          '</div>' +
          '<div class="mt-arrow">↓ 结果追加到上下文</div>' +
          '<div class="mt-step mt-execution">' +
            '<div class="mt-icon">' + U.icon("calc", 20) + '</div>' +
            '<div class="mt-content"><b>第3步：调用计算器工具</b><br>计算门票总费用：60+30+15=105元</div>' +
          '</div>' +
          '<div class="mt-arrow">↓ 结果追加到上下文</div>' +
          '<div class="mt-step mt-execution">' +
            '<div class="mt-icon">' + U.icon("bell", 20) + '</div>' +
            '<div class="mt-content"><b>第4步：调用提醒工具</b><br>设置明天早上7点的出发提醒</div>' +
          '</div>' +
          '<div class="mt-arrow">↓ 所有结果综合</div>' +
          '<div class="mt-step mt-final">' +
            '<div class="mt-icon">' + U.icon("brain", 20) + '</div>' +
            '<div class="mt-content"><b>AI 大脑综合所有工具结果，生成最终回答</b><br>“明天北京晴天，推荐去故宫、颐和园、天坛，门票共105元，已设好7点出发提醒！”</div>' +
          '</div>' +
        '</div>' +
        '<div class="tip" style="margin-top:14px">' + U.icon("spark", 16) + ' <b>ReAct 循环中的工具链：</b>每调用一个工具，结果就追加到上下文（轨迹），成为下一轮推理的依据。这就是“思考→行动→观察→再思考”的 ReAct 循环——工具的输出是下一个工具的输入或模型推理的依据。</div>'
      ) +

      /* ⑪ 小测验 */
      LP.card("exe", "⑪ 小测验：你是工具小达人吗？", "共 " + QUIZ.length + " 题，覆盖执行器角色、工具五分类、Function Calling、工具描述、MCP、工具幻觉、多工具协作。答对一题加一颗星！",
        '<div class="game-box" id="exe-quiz"><div id="exe-quiz-body"></div></div>' +
        '<div class="score-line"><span class="score-badge" id="exe-quiz-score" data-score="0">★ 0</span><button class="btn btn-ghost btn-sm" id="exe-quiz-restart">重来</button></div>'
      ) +

      /* ⑫ 进阶原理 + 课堂小结 */
      LP.deepCard("exe", "⑫ 进阶原理：执行器 = 工具调用 + 安全治理", DEEP) +

      '<div class="lesson-summary card-exe">' +
        '<h3>' + U.icon("check", 18) + ' 课堂小结（L11+L12）</h3>' +
        '<div class="summary-core"><b>核心结论：</b>执行器（工具）是 AI 的“手”——大语言模型自己不会实时查、不会真操作，执行器通过调用外部能力把事真正办成。ai-agent-book 把工具分成五类（感知/执行/协作/事件触发/用户沟通），真实系统用 Function Calling 机制（模型输出 JSON 指令→程序执行工具→结果返回模型），用 MCP 协议标准化接入各种工具。但工具不是“模型说什么就执行什么”——生产系统用白名单、参数校验、结果验证三道防线防止工具幻觉。复杂任务需要多工具协作（链式调用），每个工具的输出成为下一轮推理的依据。</div>' +
        '<div class="summary-points">' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("hand", 14) + '</span><div><b>执行器角色：</b>AI 的“手”——没工具只能“纸上谈兵”，有工具才能“真刀真枪”。工具越多，本领越大</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("gear", 14) + '</span><div><b>工具五分类：</b>感知（获取信息）/执行（改变世界）/协作（分工）/事件触发（外部驱动）/用户沟通（主动连接）</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("code", 14) + '</span><div><b>Function Calling：</b>模型输出 JSON 指令（工具名+参数）→程序执行工具→结果返回模型。模型负责决策，程序负责执行</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("shield", 14) + '</span><div><b>安全治理：</b>工具白名单+参数校验+结果验证，防止 AI 编造不存在的工具或参数（幻觉）。AI 会犯错，Harness 负责兜底</div></div>' +
        '</div>' +
        '<div class="summary-think"><b>课后思考：</b>请设计一个“班级活动小助手”需要哪些工具——至少列出 5 个工具，并说明每个工具属于五分类中的哪一类、需要什么参数、返回什么结果。下节课分享！</div>' +
      '</div>';

    bindToolDemo();
    bindToolGame();
    bindToolbox();
    bindQuiz();
  }

  /* ---------- ③ 有工具 vs 没工具 ---------- */
  function logLine(text, cls) {
    var log = $("pg-tool-log");
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
      var log = $("pg-tool-log");
      log.innerHTML = "";
      $("pg-tool-fb").innerHTML = "";
      logLine("$ 用户提问：“明天穿什么？”", "dim");
      logLine("$ 调用大语言模型……（这个 AI 没有安装任何工具）");
      logLine("$ AI 回答中……");
      try {
        var ans = await AgentLab.API.ask(
          "你是天气小管家，但你没有任何工具，无法实时查询天气。如果同学问天气相关问题，请如实告诉他你查不到天气，不能编造。",
          "明天穿什么？"
        );
        logLine("> " + ans.replace(/\n/g, "\n> "), "warn");
        $("pg-tool-fb").innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " 没工具：AI 只能“纸上谈兵”，查不到真实天气！</span>";
      } catch (e) {
        logLine("! 出错了：" + (e.message || e), "warn");
      }
      busy = false;
    }

    async function demoWithtool() {
      if (busy) return;
      busy = true;
      var log = $("pg-tool-log");
      log.innerHTML = "";
      $("pg-tool-fb").innerHTML = "";
      var w = AgentLab.weatherSim(AgentLab.CONFIG.defaultCity, "明天");
      logLine("$ 用户提问：“明天穿什么？”", "dim");
      logLine("$ 规划器说：这个问题需要调用天气工具", "");
      logLine("$ 调用工具：天气查询工具 → 查询" + w.city + "·" + w.date + "的天气…");
      await U.delay(900);
      logLine("$ 工具返回：" + w.text, "ok");
      await U.delay(600);
      logLine("$ 工具结果已交给 AI 大脑，正在组织回答…");
      try {
        var ans = await AgentLab.API.ask(
          "你是天气小管家。你刚刚通过天气查询工具查到了真实结果：" + w.text + "。" + w.suggest + "。请基于这个真实结果，用同学听得懂的话回答“明天穿什么”。",
          "明天穿什么？"
        );
        logLine("> " + ans.replace(/\n/g, "\n> "), "ok");
        $("pg-tool-fb").innerHTML = '<span class="fb-ok">' + U.icon("check", 15) + " 有工具：AI 先“查到”再“回答”——这就是执行器（工具）的本领！</span>";
      } catch (e) {
        logLine("! 出错了：" + (e.message || e), "warn");
      }
      busy = false;
    }

    $("pg-notool").addEventListener("click", demoNotool);
    $("pg-withtool").addEventListener("click", demoWithtool);
    $("pg-tool-reset").addEventListener("click", function () {
      $("pg-tool-log").innerHTML = '<span class="dim">$ 已清空，再点上面两个按钮对比一下吧！</span>';
      $("pg-tool-fb").innerHTML = "";
    });
  }

  /* ---------- ⑥ 连线游戏 ---------- */
  function bindToolGame() {
    var list = $("pg-toolgame-list");
    list.innerHTML = MATCH.map(function (m, i) {
      return '<div class="game-q" data-i="' + i + '">' +
        '<span class="qno">' + (i + 1) + "</span>" + m.q +
        '<div class="opts">' +
          TOOLS.map(function (t) {
            return '<button class="opt" data-mode="' + t.id + '">' + U.icon(t.icon, 18) + " " + t.name + "</button>";
          }).join("") +
        "</div>" +
        '<div class="quiz-feedback"></div></div>';
    }).join("");

    list.querySelectorAll(".game-q").forEach(function (box) {
      var i = parseInt(box.getAttribute("data-i"), 10);
      var m = MATCH[i];
      box.querySelectorAll(".opt").forEach(function (b) {
        b.addEventListener("click", function () {
          if (box.classList.contains("done")) return;
          var correct = b.getAttribute("data-mode") === m.ans;
          var fb = box.querySelector(".quiz-feedback");
          if (correct) {
            box.classList.add("done");
            b.classList.add("correct");
            var t = TOOLS.filter(function (x) { return x.id === m.ans; })[0];
            fb.innerHTML = '<span class="fb-ok">' + U.icon("check", 15) + " 答对啦！" + t.name + " 就是干这个的！</span>";
            U.addScore($("pg-toolgame-score"), 1);
            matchDone++;
            var note = $("pg-toolgame-note");
            if (note) note.textContent = "完成 " + matchDone + " / " + MATCH.length;
            U.celebrate(b);
            if (matchDone === MATCH.length) U.toast("全部匹配成功！执行器小达人！", "success");
          } else {
            b.classList.add("wrong");
            setTimeout(function () { b.classList.remove("wrong"); }, 450);
            fb.innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " 再想想：这个任务需要“查到真实信息”还是“算出来/记下来”？</span>";
          }
        });
      });
    });
  }

  /* ---------- ⑧ 工具百宝箱 ---------- */
  function bindToolbox() {
    var tools = AgentLab.Store.getTools();
    document.querySelectorAll('#pg-toolbox input[type="checkbox"]').forEach(function (cb) {
      cb.checked = !!tools[cb.getAttribute("data-tool")];
      cb.addEventListener("change", function () {
        var t = AgentLab.Store.getTools();
        t[cb.getAttribute("data-tool")] = cb.checked;
        AgentLab.Store.saveTools(t);
        U.toast(cb.checked ? "工具已装好！去智能体实验室试试吧" : "工具已关闭！去智能体实验室看看它有什么变化");
      });
    });
  }

  /* ---------- ⑪ 小测验 ---------- */
  function bindQuiz() {
    var body = $("exe-quiz-body");
    function draw() {
      body.innerHTML = QUIZ.map(function (item, i) {
        return '<div class="game-q">' +
          '<span class="qno">第 ' + (i + 1) + ' 题</span>' + item.q +
          '<div class="opts">' +
            item.opts.map(function (opt, oi) {
              return '<button class="opt" data-i="' + i + '" data-oi="' + oi + '">' + opt + '</button>';
            }).join("") +
          "</div>" +
          '<div class="quiz-feedback" data-fb="' + i + '"></div></div>';
      }).join("");
      body.querySelectorAll(".opt").forEach(function (b) {
        b.addEventListener("click", function () {
          var i = parseInt(b.getAttribute("data-i"), 10);
          var oi = parseInt(b.getAttribute("data-oi"), 10);
          var item = QUIZ[i];
          var fb = body.querySelector('[data-fb="' + i + '"]');
          var btns = body.querySelectorAll('.opt[data-i="' + i + '"]');
          if (btns[0].disabled) return;
          btns.forEach(function (x) { x.disabled = true; });
          if (oi === item.ans) {
            b.classList.add("correct");
            fb.innerHTML = '<span class="fb-ok">' + U.icon("check", 15) + " 答对啦！" + item.why + "</span>";
            U.addScore($("exe-quiz-score"), 1);
            U.celebrate(b);
          } else {
            b.classList.add("wrong");
            var rightBtn = body.querySelector('.opt[data-i="' + i + '"][data-oi="' + item.ans + '"]');
            if (rightBtn) rightBtn.classList.add("correct");
            fb.innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " 正确答案是：" + item.opts[item.ans] + "。" + item.why + "</span>";
          }
        });
      });
    }
    draw();
    $("exe-quiz-restart").addEventListener("click", function () {
      var sc = $("exe-quiz-score");
      sc.setAttribute("data-score", "0");
      sc.textContent = "★ 0";
      draw();
    });
  }

  return { render: render };
})();
