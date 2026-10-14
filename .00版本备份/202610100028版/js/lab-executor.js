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
        '<div class="tip" style="margin-top:12px">' + U.icon("alert", 16) + ' <b>如果工具描述写得不好：</b>比如只写“工具1”不写功能，AI 就不知道该什么时候调用它，可能选错工具或传错参数（导致幻觉）。好的工具描述是执行器可靠工作的基础！</div>'
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
            '<div class="mcp-server">' + U.icon("bookopen", 20) + '<br><b>本地文件</b><br><small>读/写文件</small></div>' +
            '<div class="mcp-server">' + U.icon("cloud", 20) + '<br><b>远程 API</b><br><small>天气/搜索</small></div>' +
            '<div class="mcp-server">' + U.icon("keyboard", 20) + '<br><b>SaaS 工具</b><br><small>邮件/日历</small></div>' +
            '<div class="mcp-server">' + U.icon("gear", 20) + '<br><b>数据库</b><br><small>SQL 查询</small></div>' +
            '<div class="mcp-server">' + U.icon("globe", 20) + '<br><b>浏览器</b><br><small>网页操作</small></div>' +
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
            '<div class="hd-title">' + U.icon("alert", 18) + ' 危险场景：AI 编造了一个不存在的工具</div>' +
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

      /* 新增配套实验（全部可自动判定） */
      LP.card("exe", "实验：给这次调用填参数（Function Calling 组装器）",
        "模型要调用工具，必须把参数填对。给一次真实请求，选出所有<b>必填且合法</b>的参数——注意：多填、乱填、把敏感信息塞进参数，都是事故。",
        '<div id="exe-args"></div>') +

      LP.card("exe", "实验：工具描述写多细才够？（准确率调参）",
        "工具描述是模型选工具的唯一依据。拖滑条调整“描述详细程度”，观察“选择准确率”的变化——过简会和别的工具混淆，过详又会冗长占预算。",
        '<div id="exe-desc"></div>') +

      LP.card("exe", "实验：工具幻觉的三道防线",
        "模型会编工具、编参数、编结果。三道防线（白名单 / 参数校验 / 等待回填）分别能拦住哪种？关掉一道，看看哪类幻觉就漏过去了。",
        '<div id="exe-guard"></div>') +

      LP.card("exe", "实验：预测多工具链式调用",
        "复杂任务要按依赖顺序调用多个工具。先预测每一步会调用哪个工具，再逐段揭示真实过程，最后和你的预测对照。",
        '<div id="exe-chain"></div>') +

      /* ⑪ 小测验 */
      LP.card("exe", "小测验：你是工具小达人吗？", "共 " + QUIZ.length + " 题，覆盖执行器角色、工具五分类、Function Calling、工具描述、MCP、工具幻觉、多工具协作。答对一题加一颗星！",
        '<div class="game-box" id="exe-quiz"><div id="exe-quiz-body"></div></div>' +
        '<div class="score-line"><span class="score-badge" id="exe-quiz-score" data-score="0">★ 0</span><button class="btn btn-ghost btn-sm" id="exe-quiz-restart">重来</button></div>'
      ) +

      /* ⑫ 进阶原理 + 课堂小结 */
      /* ⑫ 进阶原理互动课堂 */
      LP.card("exe", "进阶原理互动课堂：执行器在真实 AI 系统里是什么？（ai-agent-book 第 2/6 章）",
        "下面 10 个概念对应《深入理解 AI Agent：设计原理与工程实践》（ai-agent-book）里的真实工程做法。<b>左边选概念，右边看讲解并亲手做实验</b>：每个概念都配了「一句话讲明白 / 打个比方 / 真实系统里是这样 / 动手实验 / 自检一问」，还能一键跳回对应的基础实验。",
        AgentLab.Adv.panelHTML({ key: "exe", concepts: exeConcepts() })) +

      '<div class="lesson-summary card-exe">' +
        '<h3>' + U.icon("check", 18) + ' 课堂小结（L11+L12）</h3>' +
        '<div class="summary-core"><b>核心结论：</b>执行器（工具）是 AI 的“手”——大语言模型自己不会实时查、不会真操作，执行器通过调用外部能力把事真正办成。ai-agent-book 把工具分成五类（感知/执行/协作/事件触发/用户沟通），真实系统用 Function Calling 机制（模型输出 JSON 指令→程序执行工具→结果返回模型），用 MCP 协议标准化接入各种工具。但工具不是“模型说什么就执行什么”——生产系统用白名单、参数校验、结果验证三道防线防止工具幻觉。复杂任务需要多工具协作（链式调用），每个工具的输出成为下一轮推理的依据。</div>' +
        '<div class="summary-points">' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("hand", 14) + '</span><div><b>执行器角色：</b>AI 的“手”——没工具只能“纸上谈兵”，有工具才能“真刀真枪”。工具越多，本领越大</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("gear", 14) + '</span><div><b>工具五分类：</b>感知（获取信息）/执行（改变世界）/协作（分工）/事件触发（外部驱动）/用户沟通（主动连接）</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("keyboard", 14) + '</span><div><b>Function Calling：</b>模型输出 JSON 指令（工具名+参数）→程序执行工具→结果返回模型。模型负责决策，程序负责执行</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("shield", 14) + '</span><div><b>安全治理：</b>工具白名单+参数校验+结果验证，防止 AI 编造不存在的工具或参数（幻觉）。AI 会犯错，Harness 负责兜底</div></div>' +
        '</div>' +
        '<div class="summary-think"><b>课后思考：</b>请设计一个“班级活动小助手”需要哪些工具——至少列出 5 个工具，并说明每个工具属于五分类中的哪一类、需要什么参数、返回什么结果。下节课分享！</div>' +
      '</div>';

    bindToolDemo();
    bindToolGame();
    bindToolbox();
    bindQuiz();

    /* 新增配套实验 + 进阶原理互动课堂 */
    bindExeArgs();
    bindExeDesc();
    bindExeGuard();
    bindExeChain();
    bindExeAdv();
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
      logLine("$ 用户提问：“明天穿什么？”", "dim");
      logLine("$ 规划器说：这个问题需要调用天气工具", "");
      logLine("$ 调用工具：天气查询工具 → 联网查询" + AgentLab.CONFIG.defaultCity + "·明天的天气…");
      var w = await AgentLab.API.getWeather(AgentLab.CONFIG.defaultCity, "明天");
      if (!w || !w.ok) {
        logLine("! " + ((w && w.error) || "天气服务暂时不可用"), "warn");
        busy = false;
        return;
      }
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
  /* ---------- ⑥ 工具选择游戏（单题闯关） ---------- */
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
  /* ---------- ⑪ 小测验（单题闯关） ---------- */
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
      links: [{ t: "工具调用日志", el: "pg-tool-log" }, { t: "新增：参数组装实战", el: "exe-args" }]
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
      tip: "ai-agent-book 把工具分成五类：信息查询、计算处理、操作执行、沟通协作、记忆管理——分类决定了“该给 Agent 配哪些工具”。",
      analogy: "像文具盒：笔、尺子、胶水、剪刀、便签各有用途。你不会给一个只画画的人配剪刀。",
      real: "五类对应五类需求：<b>信息查询</b>（查天气 / 搜索）、<b>计算处理</b>（算数 / 换算）、<b>操作执行</b>（下单 / 发消息）、<b>沟通协作</b>（翻译 / 写邮件）、<b>记忆管理</b>（写笔记 / 检索知识库）。配工具的原则是“按场景配必要的一组”，不是“什么都有”。",
      quiz: { q: "为什么“工具越多越好”是错的？", a: "工具越多，可选项越多，模型选错的概率越高；而且每个工具的定义都要占用上下文。正确做法是按场景配最必要的一组，需要时再加。" },
      links: [{ t: "工具抢答游戏", el: "pg-toolgame" }]
    },
    {
      id: "desc", icon: "pen", nav: "工具描述", name: "工具描述（Tool Description）", en: "TOOL DESCRIPTION",
      tip: "工具描述是模型选择工具的唯一依据：写得清楚，才可能选对。",
      analogy: "像给遥控器按键贴标签：只写“按钮 1、按钮 2”没人会用；写成“电源、音量+、频道-”人人都会。",
      real: "一份好描述包含：<b>名字</b>（动词开头）、<b>功能一句话</b>、<b>参数说明</b>（类型 / 是否必填 / 枚举值）、<b>返回格式</b>、<b>使用场景示例</b>（什么时候该用、什么时候不该用）。描述含糊是“选错工具”的第一大原因。",
      quiz: { q: "“工具名：do_stuff；描述：处理数据”有什么问题？", a: "名字没说明做什么、描述里没有参数与返回说明，模型无法判断该不该用它。改法示例：weather_query +“查询指定城市指定日期的天气，参数 city（中文城市名）、date（YYYY-MM-DD）”。" },
      links: [{ t: "工具抢答游戏", el: "pg-toolgame" }, { t: "新增：描述质量调参", el: "exe-desc" }]
    },
    {
      id: "mcp", icon: "link", nav: "MCP 协议", name: "MCP 协议", en: "MODEL CONTEXT PROTOCOL",
      tip: "MCP 是工具的“USB 接口”：统一协议后，工具接一次就能被不同模型 / 应用复用。",
      analogy: "像 USB：以前每种设备一个专用接口，现在统一成一个口，插上就能用。",
      real: "没有标准时，N 个工具 × M 个模型 = N×M 套适配代码；有了 MCP，工具按协议暴露一次，任何支持 MCP 的客户端都能调用——把乘法变成了加法。它还带来统一的能力发现（列出有哪些工具）与权限声明。",
      quiz: { q: "为什么说 MCP 把“乘法变成加法”？", a: "没有标准时，工具与模型两两适配是 N×M；有了统一协议，工具只需实现一次、客户端只需接入一次，复杂度降到 N+M。工具生态才能真正长起来。" },
      links: [{ t: "工具百宝箱", el: "pg-toolbox" }]
    },
    {
      id: "hallu", icon: "alert", nav: "工具幻觉", name: "工具发现与幻觉风险", en: "TOOL HALLUCINATION",
      tip: "模型可能“编造”根本不存在的工具或参数——这叫工具幻觉。",
      analogy: "像有人一本正经地说“我用第五种方法解决的”，其实根本没有第五种方法：听起来合理，机器一执行就报错。",
      real: "三种典型幻觉：<b>编工具</b>（调用不存在的函数）、<b>编参数</b>（传了 schema 里没有的字段）、<b>编结果</b>（工具还没返回就先把答案说了）。三道防线：只暴露白名单工具、参数强校验、必须等 tool 消息回填才能继续生成。",
      quiz: { q: "“工具还没返回，模型就把天气说出来了”属于哪种幻觉？", a: "编造结果。它跳过了“观察”这一步，直接给出答案。防线是：工具调用之后必须等待 tool 消息回填，才允许生成最终回答。" },
      links: [{ t: "工具幻觉与约束", el: "pg-tool-fb" }]
    },
    {
      id: "chain", icon: "refresh", nav: "多工具协作", name: "多工具协作（Tool Chaining）", en: "TOOL CHAINING",
      tip: "复杂任务要按依赖顺序调用多个工具——这叫工具链式调用。",
      analogy: "像做一顿饭：先买菜（查信息）→ 再洗切（处理）→ 才下锅（执行）。顺序错了，饭做不成。",
      real: "链式调用的关键：<b>依赖关系</b>（上一步的输出是下一步的输入）、<b>中间结果校验</b>（拿不到就中止，而不是硬走）、<b>失败恢复</b>（换工具 / 换参数 / 上报）。工程上还会给单次任务设最大调用次数（停止条件）。",
      quiz: { q: "工具链：查天气 → 查景点 → 生成行程。哪个顺序不能反？为什么？", a: "不能反。生成行程需要“天气”与“景点”两个结果；而查景点通常不需要先知道天气。顺序必须服从数据依赖，而不是“哪个先问到”。" },
      links: [{ t: "多工具协作", el: "pg-toolgame" }]
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
    }
  ];

  /* 概念 id → 交互类型 */
  var EXE_TYPE = {
    fc: "composer", api: "pipeline", five: "picker", desc: "sandbox", mcp: "decider",
    hallu: "picker", chain: "sorter", sense: "decider", event: "switchboard", gov: "sandbox"
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
        { role: "assistant", text: '{"tool_calls":[{"name":"weather_query","arguments":{"city":"北京","date":"2026-10-10"}}]}', toolcall: true, tag: "模型输出：结构化调用指令（tool_calls）" },
        { role: "tool", text: '{"city":"北京","date":"2026-10-10","weather":"小雨","temp":"15~19℃"}', tag: "程序执行工具后回填的真实结果" },
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
      title: "动手实验：哪些属于“信息查询类”工具？", hint: "多选后检查", icon: "box",
      taskLabel: "任务：",
      task: "下面是小管家工具盒里的工具。请选出所有属于<b>信息查询类</b>（只读、把世界读进来）的工具。",
      checkLabel: "检查我选的工具",
      empty: "先点选你认为属于信息查询类的工具，再点「检查我选的工具」。",
      passHtml: "五类工具：信息查询 / 计算处理 / 操作执行 / 沟通协作 / 记忆管理——分类决定了该给 Agent 配哪些工具。",
      failHtml: "提示：判断口诀——它只是“读”信息，还是会“改变”什么东西？",
      items: [
        { id: "f1", label: "天气查询", ok: true, why: "只读：把外部信息读回来，属于信息查询。" },
        { id: "f2", label: "联网搜索", ok: true, why: "只读：从外部获取信息，属于信息查询。" },
        { id: "f3", label: "班级课表查询", ok: true, why: "只读：查的是记忆器里的知识库，也属于信息查询。" },
        { id: "f4", label: "计算器", ok: false, why: "它做的是“计算处理”——把输入算出结果，不是查询外部信息。" },
        { id: "f5", label: "提醒工具", ok: false, why: "它会在未来某个时间“执行动作”，属于操作执行。" },
        { id: "f6", label: "翻译工具", ok: false, why: "它做的是语言转换，属于沟通协作。" },
        { id: "f7", label: "猜数字游戏", ok: false, why: "与查询无关，属于互动娱乐类工具（不在五分类的核心三问里）。" }
      ]
    },
    desc: {
      title: "动手实验：同一件事，两种工具描述", hint: "切开关对比", icon: "pen",
      srcTitle: "① 选择用户需求：",
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
      guardTitle: "② 工具描述质量：",
      guardLabelOn: "描述完整（功能 + 参数 + 返回 + 使用场景）",
      guardLabelOff: "描述含糊（只有一个名字）",
      contentTitle: "需求与工具描述：",
      dataLabel: "① 用户需求：",
      injectLabel: "② 工具描述：",
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
      title: "动手实验：这段调用日志里，哪些是幻觉？", hint: "多选后检查", icon: "alert",
      taskLabel: "调用日志：",
      task: "用户问“明天北京天气怎么样？”。<br>① 模型输出：<code>{\"tool_calls\":[{\"name\":\"get_flight_price\",\"arguments\":{\"city\":\"北京\",\"user_token\":\"sk-abc123\"}}]}</code><br>② 模型紧接着又输出：“明天北京晴，25℃。”<br>③ 工具箱里实际登记的工具只有：weather_query、calculator、reminder。",
      checkLabel: "检查我选的幻觉行为",
      empty: "先点选你认为属于幻觉的行为，再点「检查我选的幻觉行为」。",
      passHtml: "三道防线：<b>只暴露白名单工具</b>（防编工具）、<b>参数强校验</b>（防编参数）、<b>必须等 tool 消息回填才能生成</b>（防编结果）。",
      failHtml: "提示：区分“正常的工具调用”和“凭空造出来的东西”。",
      items: [
        { id: "h1", label: "调用了不存在的 get_flight_price", ok: true, why: "编造工具：工具箱里根本没有这个工具。白名单校验会直接拒绝。" },
        { id: "h2", label: "参数里塞了 schema 没有的 user_token，还带了密钥", ok: true, why: "编造参数，而且是最危险的一类：把密钥写进了参数。参数强校验（只允许登记过的字段）能拦住它。" },
        { id: "h3", label: "工具还没返回就先把天气说出来了", ok: true, why: "编造结果：跳过了“观察”这一步。规则上必须等 tool 消息回填后才能生成最终回答。" },
        { id: "h4", label: "调用了 weather_query 并传了 city 与 date", ok: false, why: "这是正常的 Function Calling：工具在登记表里、参数符合 schema。" },
        { id: "h5", label: "等工具返回后再生成回答", ok: false, why: "这是正确做法：先观察、再回答，就不会编造。" }
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
      title: "动手实验：有治理 vs 没治理，同一句指令的两种结局", hint: "切开关对比", icon: "shield",
      srcTitle: "① 选择模型发起的工具调用：",
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
      guardTitle: "② 工具治理层：",
      guardLabelOn: "已开启（白名单 + 参数校验 + 人工确认 + 审计日志）",
      guardLabelOff: "未开启（模型说什么就执行什么）",
      contentTitle: "模型发起的调用与风险：",
      dataLabel: "① 模型请求：",
      injectLabel: "② 风险点：",
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

  /* ---------- 新增实验 A：参数组装器（多选判定） ---------- */
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
        { id: "p2", label: 'date = "2026-10-10"', ok: true, why: "必填项，格式符合 YYYY-MM-DD（口语里的“明天”要先换算成具体日期）。" },
        { id: "p3", label: 'unit = "celsius"', ok: true, why: "可选项，取值在枚举里，合法。" },
        { id: "p4", label: 'user_token = "sk-abc123"', ok: false, why: "schema 里没有这个字段，还把密钥塞进了参数——最危险的一类“编参数”。" },
        { id: "p5", label: 'date = "明天"', ok: false, why: "格式不合法：工具要求 YYYY-MM-DD。要先把“明天”换算成具体日期。" },
        { id: "p6", label: 'city = "北京｜上海"', ok: false, why: "一个参数塞了两个值，越界了。多城市要分多次调用。" }
      ]
    };
    host.innerHTML = AgentLab.Adv.types.picker.demoHTML(d);
    AgentLab.Adv.types.picker.bind(host, d);
  }

  /* ---------- 新增实验 B：工具描述质量调参 ---------- */
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

  /* ---------- 新增实验 C：工具幻觉的三道防线 ---------- */
  function bindExeGuard() {
    var host = $("exe-guard");
    if (!host) return;
    var d = {
      color: "exe",
      title: "动手实验：关掉一道防线，哪种幻觉就漏过去了？", hint: "点开关", icon: "shield",
      chipsTitle: "① 当前生效的防线（点一下可关掉）：",
      chips: [
        { id: "w1", label: "① 白名单：只暴露登记过的工具", on: true },
        { id: "w2", label: "② 参数强校验：只接受 schema 里的字段", on: true },
        { id: "w3", label: "③ 等待回填：tool 消息回来前不许生成回答", on: true }
      ],
      viewTitle: "当前生效的防线",
      viewNote: "三道防线分别对应三类幻觉：编工具 / 编参数 / 编结果。",
      viewEmpty: "三道防线全关：模型想调什么就调什么、想说什么就说什么。",
      actionsTitle: "② 试着让模型“犯一次错”：",
      actions: [
        { id: "h1", label: "模型想调用不存在的 get_flight_price", need: ["w1"], hint: "白名单里没有这个工具，直接拒绝——拦住“编工具”。" },
        { id: "h2", label: "模型在参数里塞了 user_token 和密钥", need: ["w2"], hint: "参数强校验只放行 schema 里的字段——拦住“编参数”，也顺手挡住了密钥外泄。" },
        { id: "h3", label: "工具还没返回，模型想先说答案", need: ["w3"], hint: "规则要求必须等 tool 消息回填才能生成——拦住“编结果”。" }
      ],
      resultEmpty: "点一条试一试。",
      afterToggle: "防线状态变了——再点下面某条，看看还会不会被拦住。",
      failTail: "对应的防线被关掉了，这类幻觉就会直接漏过去。",
      okTail: "防线在，这类请求会被立刻拦住（或强制进入等待）。",
      onIcon: "shield", offIcon: "xmark"
    };
    host.innerHTML = AgentLab.Adv.types.switchboard.demoHTML(d);
    AgentLab.Adv.types.switchboard.bind(host, d);
  }

  /* ---------- 新增实验 D：多工具链式调用预测 ---------- */
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

  return { render: render };
})();
