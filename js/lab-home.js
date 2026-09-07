/* ============================================================
 * lab-home.js —— 架构实验室（首页）
 * 对应 L03《智能体总装图》+ L04《拆解一个真实智能体》
 * 13 模块：学习目标 → 情境导入 → 核心公式 → 人体类比总装图
 *   → Model-Harness → 拼装互动 → 组件抢答 → 拆解四问
 *   → 智能客服示范 → 真实案例库 → 五种Agent对比 → 小测验 → 进阶原理+小结
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

AgentLab.LabHome = (function () {
  var U = AgentLab.UI;
  var $ = U.$;
  // LP 在 render() 内延迟获取，避免 lab-perception.js 尚未加载时为 undefined

  /* ---------- 数据 ---------- */

  // 总装图节点
  var NODES = [
    { id: "perception", sec: "perception", area: "1 / 2", color: "per", icon: "eye", name: "感知器", en: "Perception · 上下文输入",
      job: "像<b>眼睛和耳朵</b>，负责<b>观察与编码</b>——把文字、语音、图像变成 AI 能理解的信息（多模态输入）。" },
    { id: "memory", sec: "memory", area: "2 / 1", color: "mem", icon: "book", name: "记忆器", en: "Memory · 上下文知识",
      job: "像<b>小本子</b>，负责<b>上下文与记忆</b>——短期记对话历史，长期存知识库（类似 RAG 检索增强）。" },
    { id: "planner", sec: "planner", area: "3 / 2", color: "plan", icon: "gear", name: "规划器", en: "Planner · ReAct 循环",
      job: "像<b>会思考的头脑</b>，负责<b>拆解步骤与推理</b>——把大任务拆成小步骤、排好顺序（ReAct 推理循环）。" },
    { id: "executor", sec: "executor", area: "2 / 3", color: "exe", icon: "hand", name: "执行器（工具）", en: "Executor / Tools",
      job: "像<b>手</b>，负责<b>动手干活</b>——调用天气、计算器等外部工具（Function Calling），真正把事情做出来。" }
  ];

  // 组件抢答题目
  var QUICK_Q = [
    { q: "它听懂了你说的话", comp: "感知器", why: "接收语音/文字输入是感知器的工作——把外界信息变成 AI 能理解的形式。", icon: "microphone" },
    { q: "它把'组织一次生日会'拆成了5个小步骤", comp: "规划器", why: "把大任务拆解成小步骤、排好顺序是规划器的核心能力。", icon: "list-check" },
    { q: "它记住了你上次说过喜欢坐地铁", comp: "记忆器", why: "跨对话记住用户偏好和历史信息是记忆器的工作——短期记忆+长期记忆。", icon: "bookmark" },
    { q: "它调用了天气工具查明天的温度", comp: "执行器", why: "调用外部工具（查天气、搜地图、算算术）是执行器（工具）的本领。", icon: "cloud-sun" },
    { q: "它看到了你上传的一张图片", comp: "感知器", why: "图像识别、OCR 文字识别都是感知器的多模态输入能力。", icon: "image" },
    { q: "它决定先查天气、再想穿什么、最后定出门时间", comp: "规划器", why: "排序步骤、决定先后顺序是规划器的 ReAct 循环在工作。", icon: "arrow-down-up" },
    { q: "它调出了班级课表告诉你下午有什么课", comp: "记忆器", why: "从班级知识库（长期记忆）中检索信息是记忆器+RAG 的工作。", icon: "calendar" },
    { q: "它用计算器算出了 25×4+10 的结果", comp: "执行器", why: "调用计算器工具完成精确计算是执行器的本领——AI 大脑不擅长精确算术，靠工具补。", icon: "calculator" },
    { q: "它把你的语音'明天穿什么'转成了文字", comp: "感知器", why: "语音转文字（ASR）是感知器的感知转化过程——语音模态→文字模态。", icon: "waveform" },
    { q: "它发现计划执行失败了，重新调整了步骤", comp: "规划器", why: "根据执行结果反思和调整计划是规划器的高级能力——反思（Reflection）。", icon: "arrow-path" },
    { q: "它联网搜索了'今天北京限行尾号'的最新信息", comp: "执行器", why: "联网搜索是执行器的感知类工具——主动获取外部最新信息，弥补大脑知识的时效性不足。", icon: "globe" },
    { q: "它记住了你们班的值日表，提醒你明天该你擦黑板", comp: "记忆器", why: "存储业务状态（值日表、课表、通知）并主动提醒是记忆器的业务状态记忆+主动服务能力。", icon: "bell" },
    { q: "它读取了你电脑屏幕上的报错信息", comp: "感知器", why: "屏幕截图、终端输出读取是感知器的环境感知能力——Coding Agent 的眼睛。", icon: "display" },
    { q: "它把一个复杂任务分成了'先搜索、再整理、最后写报告'三步", comp: "规划器", why: "任务分解和策略制定是规划器的核心——Plan-and-Execute 范式：先规划再执行。", icon: "map" },
    { q: "它调用了翻译工具把英文文章翻译成中文", comp: "执行器", why: "调用翻译 API 是执行器的工具调用能力——专业工具比大模型直接翻译更准确、更可控。", icon: "language" }
  ];

  // 真实案例拆解库
  var CASES = [
    {
      name: "智能客服（淘宝/京东）",
      icon: "headset",
      desc: "用户问'我的快递到哪了'，智能客服自动查询订单并回答。",
      perception: "接收用户文字输入'我的快递到哪了'；理解用户意图",
      planner: "判断需要查询订单→决定调用订单查询工具→组织回答结构",
      memory: "调取用户账号信息（知道是哪个用户的订单）；记住对话历史",
      executor: "调用订单查询 API，返回'快递已到北京转运中心'",
      aiagentbook: "ai-agent-book chapter1:53 — Coding Agent 增量开发策略的客服版：理解需求→搜索相关信息→调用工具→验证结果"
    },
    {
      name: "出行助手（高德/百度地图）",
      icon: "map",
      desc: "用户说'帮我规划明天去故宫的路线'，出行助手查天气、查路线、给出建议。",
      perception: "接收语音/文字输入；理解目的地和时间",
      planner: "拆解任务：查天气→查路线→算时间→给建议；排序步骤",
      memory: "记住用户常用出发地、交通偏好（地铁/开车）",
      executor: "调用天气 API、路线规划 API、实时路况 API",
      aiagentbook: "ai-agent-book chapter1:43 — Manus 合并观察空间与动作空间：出行助手同时扩大了'能看到什么'（路况/天气）和'能做什么'（导航/订票）"
    },
    {
      name: "智能家居（小爱同学/Siri/灵犀）",
      icon: "home",
      desc: "用户说'打开客厅灯，空调调到26度'，智能家居控制设备执行。",
      perception: "语音识别（ASR）听懂指令；理解设备名称和操作",
      planner: "拆解为两个子任务：①开灯 ②调空调；判断设备状态",
      memory: "记住用户习惯（如'晚上10点自动关灯'）；记住设备列表",
      executor: "调用智能家居 API，发送'打开客厅灯'和'空调26度'指令",
      aiagentbook: "网络资源 — 灵犀家庭智能体：融合'感知理解（脑输入）+规划决策（脑处理）+家庭记忆（脑记忆）+工具调用（脑输出）'的端到端智脑"
    },
    {
      name: "Coding Agent（腾讯 CodeBuddy）",
      icon: "code",
      desc: "程序员说'帮我给这个登录函数加上错误处理和单元测试'，CodeBuddy 读代码、理解项目结构、生成修改方案、编辑文件、运行测试、根据结果调试。",
      perception: "①读取当前打开的代码文件全文（含函数定义、变量、注释）；②扫描项目目录结构（src/、tests/、package.json 等）；③读取终端输出（编译错误、测试失败、日志）；④读取 Git 差异（git diff 看最近改了什么）；⑤读取选中的代码片段或光标所在行；⑥理解报错堆栈中的文件名和行号",
      planner: "增量开发策略（ai-agent-book chapter1:53）：第一步'理解需求'——把自然语言需求拆解为具体代码改动点；第二步'搜索相关代码'——在项目中找到需要修改的函数和它的调用方；第三步'定位修改位置'——确定在哪个文件哪一行插入/替换代码；第四步'生成代码补丁'——写出符合项目编码规范的新代码；第五步'运行测试验证'——执行单元测试看是否通过；第六步'根据失败结果调试'——如果测试失败，读取错误信息，回到第三步重新修改，形成 ReAct 循环",
      memory: "①记住项目代码规范（如阿里Java规范、ESLint规则、命名风格）；②记住之前的修改历史（这个函数上次改过什么）；③记住用户编码偏好（如喜欢用箭头函数还是function、注释写中文还是英文）；④记住项目技术栈（React+TypeScript还是Vue+JS、用Jest还是Mocha）；⑤记住项目的目录约定（组件放src/components、测试放tests/）",
      executor: "①代码搜索工具——跨文件符号检索（找到所有调用login()的地方）；②文件读写工具——读取文件内容、生成补丁、写入修改；③命令执行工具——运行npm test、npm run lint、npm run build；④Git操作工具——查看git diff、git status、自动生成commit message；⑤终端交互工具——读取命令输出、向终端输入指令；⑥MCP扩展工具——通过MCP协议接入第三方工具（如数据库查询、API调试）",
      aiagentbook: "ai-agent-book chapter1:53 — Coding Agent 增量开发策略：眼睛=需求/代码片段/终端输出/Git差异，手脚=代码搜索/文件读写/执行命令/Git操作，策略=增量开发（理解→搜索→编辑→测试→调试的ReAct循环）。腾讯CodeBuddy基于混元代码大模型+DeepSeek双引擎，支持VS Code/JetBrains插件，内置文件编辑/命令执行/Git操作/测试执行工具链，支持MCP协议扩展"
    },
    {
      name: "搜索 Agent（Deep Research）",
      icon: "search",
      desc: "用户说'帮我调研一下AI Agent的发展历史'，Deep Research 反复搜索、阅读、总结。",
      perception: "搜索结果、网页内容、论文摘要与引用；理解信息相关性",
      planner: "迭代深化：根据已有信息调整搜索方向，逐步综合出完整报告",
      memory: "记住已搜索的关键词、已阅读的网页、已整理的要点",
      executor: "搜索查询、网页读取、生成报告",
      aiagentbook: "ai-agent-book chapter1:54 — Deep Research 等搜索 Agent：眼睛=搜索结果/网页内容，手脚=搜索查询/网页读取/生成报告，策略=迭代深化"
    }
  ];

  // 五种 Agent 产品对比
  var AGENT_COMPARE = [
    { name: "腾讯 CodeBuddy（Coding Agent）", eye: "代码文件、目录结构、终端输出、Git差异、选中片段、报错堆栈", hand: "代码搜索、文件读写、命令执行（测试/lint/构建）、Git操作、MCP扩展", strategy: "增量开发ReAct循环：理解需求→搜索相关代码→定位修改位置→生成代码补丁→运行测试验证→根据失败结果调试" },
    { name: "Deep Research（搜索 Agent）", eye: "搜索结果、网页内容、论文摘要", hand: "搜索查询、网页读取、生成报告", strategy: "迭代深化：根据已有信息调整搜索方向" },
    { name: "Browser Use（电脑操控 Agent）", eye: "屏幕截图、DOM 树、操作结果", hand: "点击、输入、滚动、截图、执行代码", strategy: "视觉感知+操作：观察屏幕→识别目标→执行操作→验证" },
    { name: "豆包手机助手", eye: "手机截图、App 界面状态、系统反馈", hand: "点击、滑动、输入、打开 App", strategy: "意图理解+App 操控：理解需求→定位 App→执行操作→确认" },
    { name: "Pine AI（个人办事 Agent）", eye: "经授权的账户记录、账单结果、服务商资料", hand: "打电话、发邮件、填表单、与用户确认", strategy: "多步骤任务执行：收集信息→制定策略→联系服务商→谈判→汇报" }
  ];

  // 小测验
  var QUIZ = [
    { q: "AI 智能体的核心公式是什么？", opts: ["AI = 大脑 + 眼睛 + 手脚", "AI = 芯片 + 软件 + 网络", "AI = 数据 + 算法 + 算力", "AI = 输入 + 处理 + 输出"], ans: 0, why: "ai-agent-book 核心公式：Agent = LLM（大脑）+ 上下文（眼睛）+ 工具（手脚）。" },
    { q: "在人体类比中，'感知器'对应人体的哪个器官？", opts: ["大脑", "眼睛和耳朵", "手", "小本子"], ans: 1, why: "感知器像眼睛和耳朵，负责接收外界信息（文字、语音、图像）并转化为 AI 能理解的形式。" },
    { q: "'Model-Harness' 结构中，Harness 负责什么？", opts: ["负责策略决策和思考", "负责构造上下文、暴露工具接口、维护循环和状态", "负责存储用户数据", "负责渲染用户界面"], ans: 1, why: "Harness 是环绕模型的运行与治理层：构造上下文、暴露工具接口、维护循环和状态、实施权限验证纠正。Model（LLM）负责策略决策。" },
    { q: "拆解一个真实智能体时，'拆解四问'不包括以下哪个？", opts: ["它听到了什么？", "它怎么安排步骤？", "它的代码是谁写的？", "它调用了什么工具？"], ans: 2, why: "拆解四问：①它听到了什么？（感知器）②它怎么安排步骤？（规划器）③它记得你的上次提问吗？（记忆器）④它调用了什么工具？（执行器）。不包括'代码是谁写的'。" },
    { q: "腾讯 CodeBuddy（Coding Agent）的'手脚'主要是什么？", opts: ["搜索结果和网页内容", "代码搜索、文件读写、执行命令", "屏幕截图和 DOM 树", "打电话和发邮件"], ans: 1, why: "ai-agent-book chapter1:53 — Coding Agent 的手脚=代码搜索、文件读写、执行命令等开放式操作。腾讯CodeBuddy内置文件编辑/命令执行/Git操作/测试执行工具链。" },
    { q: "智能家居（小爱同学）中，'记住用户晚上10点自动关灯的习惯'属于哪个组件？", opts: ["感知器", "规划器", "记忆器", "执行器"], ans: 2, why: "记住用户习惯和偏好是记忆器的长期记忆功能——跨会话记住用户信息。" },
    { q: "'观察空间'和'动作空间'分别对应什么？", opts: ["大脑和手脚", "AI 能看到什么 和 AI 能做什么", "输入和输出", "硬件和软件"], ans: 1, why: "ai-agent-book chapter1:37 — 观察空间=AI 能接收到的所有信息，动作空间=AI 被允许执行的所有操作。没有进入观察空间的信息，对 AI 来说就像不存在。" },
    { q: "智能客服中，'调用订单查询 API 返回快递状态'属于哪个组件？", opts: ["感知器", "规划器", "记忆器", "执行器"], ans: 3, why: "调用外部工具（订单查询 API）获取真实数据是执行器（工具）的本领——AI 大脑不会自己查数据库，靠工具补。" },
    { q: "PPA 循环指的是什么？", opts: ["感知-规划-执行循环", "准备-执行-评估循环", "计划-处理-分析循环", "感知-处理-行动循环"], ans: 0, why: "PPA（Perception-Planning-Action）循环=感知-规划-执行，是智能体的核心工作循环：感知环境→规划行动→执行行动→观察结果→再规划。" },
    { q: "ai-agent-book 把工具分成几类？", opts: ["3类：感知、执行、协作", "5类：感知、执行、协作、事件触发、用户沟通", "2类：输入、输出", "4类：搜索、计算、控制、通信"], ans: 1, why: "ai-agent-book chapter4:7 — 工具五分类：①感知工具（获取信息）②执行工具（改变世界）③协作工具（与其他 Agent 分工）④事件触发工具（外部输入驱动）⑤用户沟通工具（主动与用户连接）。" },
    { q: "RAG（检索增强生成）主要解决什么问题？", opts: ["让 AI 跑得更快", "让 AI 能访问外部知识库，弥补模型知识的时效性和专业性不足", "让 AI 能生成图片", "让 AI 能听懂语音"], ans: 1, why: "RAG（Retrieval-Augmented Generation）= 检索+生成。先从外部知识库检索相关信息，再把检索结果注入上下文，让大模型基于真实知识生成回答。解决了大模型知识截止日期、专业领域知识不足、幻觉等问题。" },
    { q: "在 ReAct 循环中，'Act'（行动）之后紧接着是什么？", opts: ["直接给出最终答案", "观察（Observation）行动结果，再决定下一步思考", "结束任务", "重新规划整个任务"], ans: 1, why: "ReAct = Reasoning + Acting。循环是：思考（Thought）→行动（Action）→观察（Observation）→再思考（Thought）→... 直到得出最终答案。行动后必须观察结果，才能决定下一步。" }
  ];

  // 进阶原理卡
  var DEEP = [
    { term: "Agent = LLM + 上下文 + 工具", desc: "ai-agent-book chapter1:11 核心公式。LLM 是大脑（决策内核），上下文是眼睛（观察与历史），工具是手脚（感知与行动接口）。更直观的说法：Agent = 大脑 + 眼睛 + 手脚。" },
    { term: "Model-Harness 结构", desc: "ai-agent-book chapter1:25 — Model 负责策略决策（LLM），Harness 是环绕模型的运行与治理层：构造上下文、暴露工具接口、维护循环和状态、实施权限验证纠正。'上下文+工具'构成最小 Harness。" },
    { term: "观察空间与动作空间", desc: "ai-agent-book chapter1:37 — 观察空间=AI 能接收到的所有信息，动作空间=AI 被允许执行的所有操作。没有通过观察通道进入上下文的信息，对模型来说就像不存在；没有被动作接口允许的操作，模型只能停留在文字建议上。" },
    { term: "ReAct 循环", desc: "Reasoning + Acting，Agent 的核心执行模式：思考（Reasoning）→行动（Acting）→观察（Observation）→再思考，直到任务完成。每一轮循环都把工具结果追加到轨迹中，供下一轮推理使用。" },
    { term: "上下文 = 静态前缀 + 轨迹", desc: "ai-agent-book 核心公式。静态前缀=系统提示词+工具定义（固定不变），轨迹=消息历史（动态增长）。轨迹增长导致上下文窗口压力，工程上用摘要、滑动窗口、RAG 来管理。" },
    { term: "工具五分类", desc: "ai-agent-book chapter4:7 — ①感知工具（搜索引擎、文件系统、API）②执行工具（代码执行、文件操作、系统命令）③协作工具（委托子 Agent、请求人类确认）④事件触发工具（新邮件、定时、Webhook）⑤用户沟通工具（文字消息、语音通话、邮件）。" },
    { term: "PPA 循环（感知-规划-执行）", desc: "Perception-Planning-Action 循环是智能体的经典工作模式：感知环境状态→规划下一步行动→执行行动→观察结果→再规划。与 ReAct 类似，但 PPA 更强调感知-规划-执行的三段式闭环。" },
    { term: "Harness 工程：约束、验证、纠正", desc: "生产级 Agent 给规划加护栏：约束不许做的事（如禁止删除文件）、验证每一步结果（如语法检查）、做错了纠正重来。模型能力边界=Harness 价值所在——AI 会犯错，Harness 负责兜底。" },
    { term: "Agent 与 Environment 闭环交互", desc: "ai-agent-book chapter1:21 — 环境不断向 Agent 返回当前观察，Agent 根据已有上下文选择下一步行动；行动改变环境状态，新的状态再产生下一次观察，循环由此继续。这是理解所有 Agent 交互的最小结构。" },
    { term: "多智能体系统（Multi-Agent）", desc: "由多个智能体组成，通过通信、协商、竞争或协作完成复杂任务。例如智慧城市的交通调度系统（多个路口的信号灯智能体协同调整配时）。ai-agent-book 第10章深入讨论多 Agent 协作。" }
  ];

  /* ---------- 渲染 ---------- */
  function render() {
    var LP = AgentLab.LabPerception;
    var sec = $("sec-home");
    sec.innerHTML =
      /* 页面头部 */
      '<div class="hero">' +
        '<h1>架构实验室：<span class="grad">智能体总装图</span>与案例拆解</h1>' +
        '<div class="sub">L03《智能体总装图》+ L04《拆解一个真实智能体》—— 大语言模型"大脑" + 感知器、规划器、记忆器、执行器（工具）四大组件</div>' +
      '</div>' +

      /* 学习目标 */
      '<div class="lesson-goal card-per">' +
        '<h3>' + U.icon("target", 18) + ' 本课学习目标（L03+L04）</h3>' +
        '<div class="goal-list">' +
          '<div class="goal-item"><span class="goal-num">1</span>知道现代智能体的整体架构：大语言模型"大脑" + 感知器、规划器、记忆器、执行器（工具）四大组件；理解 Agent = 大脑 + 眼睛 + 手脚的核心公式</div>' +
          '<div class="goal-item"><span class="goal-num">2</span>能通过人体类比（眼睛→感知器、大脑→LLM、小本子→记忆器、手→执行器）理解各组件职责，并在总装图拼装互动中巩固</div>' +
          '<div class="goal-item"><span class="goal-num">3</span>掌握"拆解四问"（它听到了什么？它怎么安排步骤？它记得你的上次提问吗？它调用了什么工具？），能在真实案例（智能客服/出行助手/智能家居/Coding Agent/搜索 Agent）中定位四大组件</div>' +
          '<div class="goal-item"><span class="goal-num">4</span>了解 ai-agent-book 科学口径：Model-Harness 结构、观察空间与动作空间、ReAct 循环、工具五分类；建立"AI 不是魔法，是组件化协作"的理性认知</div>' +
        '</div>' +
      '</div>' +

      /* ① 情境导入：小机器人买早餐 */
      LP.card("brain", "① 情境导入：小机器人买早餐需要哪些本领？", "假如请一个小机器人帮你去买早餐，它需要哪些本领？我们一步步看——它用到了'眼睛、大脑、小本子、手'四样本领，AI 智能体也一样！",
        '<div class="buy-breakfast bb-enhanced">' +
          '<div class="bb-step bb-per" data-step="1">' +
            '<div class="bb-step-num">1</div>' +
            '<div class="bb-icon">' + U.icon("eye", 24) + '</div>' +
            '<div class="bb-text"><b>第一步：看见早餐店</b><br>它用眼睛看到早餐店在哪里、有什么吃的</div>' +
            '<div class="bb-comp-tag">→ 感知器</div>' +
          '</div>' +
          '<div class="bb-arrow">→</div>' +
          '<div class="bb-step bb-plan" data-step="2">' +
            '<div class="bb-step-num">2</div>' +
            '<div class="bb-icon">' + U.icon("brain", 24) + '</div>' +
            '<div class="bb-text"><b>第二步：想一想先买什么</b><br>它用大脑想：先买豆浆、再买包子、最后付钱</div>' +
            '<div class="bb-comp-tag">→ 规划器</div>' +
          '</div>' +
          '<div class="bb-arrow">→</div>' +
          '<div class="bb-step bb-mem" data-step="3">' +
            '<div class="bb-step-num">3</div>' +
            '<div class="bb-icon">' + U.icon("book", 24) + '</div>' +
            '<div class="bb-text"><b>第三步：记住你爱喝什么</b><br>它用小本子记住：你爱喝豆浆、不爱喝牛奶</div>' +
            '<div class="bb-comp-tag">→ 记忆器</div>' +
          '</div>' +
          '<div class="bb-arrow">→</div>' +
          '<div class="bb-step bb-exe" data-step="4">' +
            '<div class="bb-step-num">4</div>' +
            '<div class="bb-icon">' + U.icon("hand", 24) + '</div>' +
            '<div class="bb-text"><b>第四步：伸手去买、去付钱</b><br>它用手真正拿起早餐、付钱、递给你</div>' +
            '<div class="bb-comp-tag">→ 执行器</div>' +
          '</div>' +
        '</div>' +
        '<div class="bb-conclusion">' + U.icon("spark", 16) + ' <b>关键迁移：</b>人靠"眼睛、大脑、小本子、手"做事，AI 智能体靠"感知器、大语言模型、记忆器、执行器（工具）"做事——一一对应！</div>'
      ) +

      /* ② 核心公式 */
      LP.card("brain", "② Agent = 大脑 + 眼睛 + 手脚（ai-agent-book 核心公式）", "ai-agent-book 第1章给出了现代 Agent 的最小工程实现公式：<b>Agent = LLM（大语言模型）+ 上下文 + 工具</b>。换一种更直观的说法：<b>Agent = 大脑 + 眼睛 + 手脚</b>。",
        '<div class="formula-strip formula-center">' +
          '<div class="formula-title">现代智能体核心公式（ai-agent-book chapter1:11）</div>' +
          '<div class="formula-line">' +
            '<span class="f-item f-brain">LLM 大语言模型</span><span class="f-op">+</span>' +
            '<span class="f-item f-mem">上下文 Context</span><span class="f-op">+</span>' +
            '<span class="f-item f-exe">工具 Tools</span><span class="f-op">=</span>' +
            '<span class="f-item f-gold">AI Agent 智能体</span>' +
          '</div>' +
          '<div class="formula-note">大脑负责生成 · 记忆器与感知器共同构成"上下文" · 执行器就是"工具" · 规划器驱动循环</div>' +
        '</div>' +
        '<div class="formula-cards">' +
          '<div class="notebook formula-card">' +
            '<h4>' + U.icon("brain", 17) + ' 大脑 = LLM</h4>' +
            '<div class="line">不只是模型参数，是整个决策内核</div>' +
            '<div class="line">理解意图、思考规划、做出判断</div>' +
            '<div class="line">能力来自预训练（世界知识）+ 后训练（决策策略）</div>' +
          '</div>' +
          '<div class="notebook formula-card">' +
            '<h4>' + U.icon("eye", 17) + ' 眼睛 = 上下文</h4>' +
            '<div class="line">不只是输入文本，是每个决策点收到的信息</div>' +
            '<div class="line">来自环境的观察、用户记忆、领域知识</div>' +
            '<div class="line">自身状态和任务进展</div>' +
          '</div>' +
          '<div class="notebook formula-card">' +
            '<h4>' + U.icon("hand", 17) + ' 手脚 = 工具</h4>' +
            '<div class="line">Agent 用来感知或改变外部世界的接口</div>' +
            '<div class="line">从预定义工具调用到动态生成代码</div>' +
            '<div class="line">没有工具只能"纸上谈兵"，有了工具才能真正改变世界</div>' +
          '</div>' +
        '</div>'
      ) +

      /* ③ 智能体总装图 */
      LP.card("brain", "③ 智能体总装图", "把抽象的架构“变”成看得见、摸得着的形象。大语言模型“大脑”坐在正中间，四大组件围在四周，一起协作！点一点每个组件，进入它的实验室深入学习。",
        '<div class="analogy-center">' +
          '<div class="assembly" id="home-assembly" style="min-height:340px">' +
            '<svg class="lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
              '<path d="M50 50 L50 14"/><path d="M50 50 L16 50"/>' +
              '<path d="M50 50 L84 50"/><path d="M50 50 L50 86"/>' +
            '</svg>' +
          '</div>' +
          '<div class="assembly-hint">↑ 点一点每个组件，进入对应实验室</div>' +
        '</div>'
      ) +

      /* ④ Model-Harness 结构 */
      LP.card("brain", "④ Model-Harness 结构（ai-agent-book 科学口径）", "ai-agent-book chapter1:25 给出了 Agent 内部的双层结构：<b>Model</b>（大语言模型）负责策略决策，<b>Harness</b>（运行与治理层）负责构造上下文、暴露工具接口、维护循环和状态、实施权限验证纠正。“大脑+眼睛+手脚”是儿童化说法，Model-Harness 是科学口径。",
        '<div class="harness-diagram">' +
          '<div class="hd-outer">' +
            '<div class="hd-label">Agent 内部</div>' +
            '<div class="hd-harness">' +
              '<div class="hd-harness-label">Harness（运行与治理层）</div>' +
              '<div class="hd-row">' +
                '<div class="hd-box hd-ctx">' + U.icon("eye", 18) + '<br><b>上下文构造</b><br><small>把观察+历史组织成信息</small></div>' +
                '<div class="hd-box hd-model">' + U.icon("brain", 18) + '<br><b>Model (LLM)</b><br><small>策略决策：理解+思考+判断</small></div>' +
                '<div class="hd-box hd-tool">' + U.icon("hand", 18) + '<br><b>工具接口</b><br><small>暴露工具、执行调用</small></div>' +
              '</div>' +
              '<div class="hd-row">' +
                '<div class="hd-box hd-loop">' + U.icon("refresh", 16) + ' <b>循环与状态维护</b></div>' +
                '<div class="hd-box hd-guard">' + U.icon("shield", 16) + ' <b>权限·验证·纠正</b></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="hd-env">' +
            '<div class="hd-label">Environment 环境</div>' +
            '<div class="hd-env-items">' +
              '<span class="hd-env-item">文件</span><span class="hd-env-item">数据库</span>' +
              '<span class="hd-env-item">网页</span><span class="hd-env-item">用户</span>' +
              '<span class="hd-env-item">其他 Agent</span><span class="hd-env-item">物理世界</span>' +
            '</div>' +
            '<div style="font-size:12px;color:var(--c-sub);margin-top:6px">环境通过"观察"和"行动"接口与 Agent 闭环交互</div>' +
          '</div>' +
        '</div>' +
        '<div class="tip" style="margin-top:14px">' + U.icon("book", 16) + ' <b>ai-agent-book 原文：</b>"Harness 是 Agent 边界内环绕模型的运行与治理层，负责构造上下文、暴露工具接口、维护循环和状态，并实施权限、验证与纠正。"——生产系统还会在 Harness 中加入约束、验证和纠正，这就是"AI 会犯错，Harness 负责兜底"。</div>'
      ) +

      /* ⑤ 总装图拼装互动 */
      LP.card("brain", "⑤ 互动：总装图拼装——把组件放到正确位置", "像 L03 课上做的 A4 总装图拼装一样！<b>先点击下面的组件卡片选中它，再点击总装图上的正确位置</b>——大脑在中间，感知器在上（像眼睛），记忆器在左（像小本子），规划器在下（像思考的头脑），执行器在右（像手）。拼对了组件会点亮！",
        '<div class="assemble-game">' +
          '<div class="ag-board ag-cross" id="ag-board">' +
            '<div class="ag-slot ag-slot-top" data-slot="top"><span class="ag-slot-label">上方 · 眼睛</span></div>' +
            '<div class="ag-slot ag-slot-left" data-slot="left"><span class="ag-slot-label">左方 · 小本子</span></div>' +
            '<div class="ag-slot ag-slot-center" data-slot="center"><span class="ag-slot-label">中间 · 大脑</span></div>' +
            '<div class="ag-slot ag-slot-right" data-slot="right"><span class="ag-slot-label">右方 · 手</span></div>' +
            '<div class="ag-slot ag-slot-bottom" data-slot="bottom"><span class="ag-slot-label">下方 · 思考</span></div>' +
          '</div>' +
          '<div class="ag-pieces-wrap">' +
            '<div class="ag-pieces-title">' + U.icon("hand-pointer", 14) + ' 点击组件选中，再点击位置放置</div>' +
            '<div class="ag-pieces" id="ag-pieces">' +
              '<div class="ag-piece" data-comp="perception" data-slot="top">' + U.icon("eye", 20) + ' 感知器</div>' +
              '<div class="ag-piece" data-comp="memory" data-slot="left">' + U.icon("book", 20) + ' 记忆器</div>' +
              '<div class="ag-piece" data-comp="planner" data-slot="bottom">' + U.icon("gear", 20) + ' 规划器</div>' +
              '<div class="ag-piece" data-comp="executor" data-slot="right">' + U.icon("hand", 20) + ' 执行器</div>' +
              '<div class="ag-piece ag-brain" data-comp="brain" data-slot="center">' + U.icon("brain", 20) + ' 大语言模型</div>' +
            '</div>' +
          '</div>' +
          '<div class="row" style="margin-top:14px">' +
            '<button class="btn btn-ghost btn-sm" id="ag-reset">' + U.icon("reset", 14) + ' 重新拼装</button>' +
            '<span id="ag-status" class="ag-status-text">先点击一个组件卡片</span>' +
          '</div>' +
        '</div>'
      ) +

      /* ⑥ 组件抢答游戏 */
      LP.card("brain", "⑥ 游戏：组件抢答——这时用到了哪个组件？", "L03 课上的组件抢答！看看下面的生活场景，快速选择对应的组件。答对加星，看你是不是“组件小达人”！",
        '<div class="quick-game" id="home-quick">' +
          '<div class="qg-header">' +
            '<div class="qg-progress"><div class="qg-progress-bar" id="qg-progress-bar"></div></div>' +
            '<div class="qg-meta">' +
              '<span class="qg-count" id="qg-count">第 1/' + QUICK_Q.length + ' 题</span>' +
              '<div class="qg-meta-right">' +
                '<span class="qg-score" id="home-quick-score" data-score="0">★ 0</span>' +
                '<button class="btn btn-ghost btn-sm qg-restart" id="qg-restart">' + U.icon("refresh", 13) + ' 重新开始</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="qg-body" id="home-quick-body"></div>' +
        '</div>'
      ) +

      /* ⑦ 拆解四问与组件定位表 */
      LP.card("brain", "⑦ 拆解四问与组件定位表（L04 核心方法）", "L04 教我们用“拆解四问”来分析任何一个真实智能体——四个问题分别对应四个组件。再用“组件定位表”把案例功能和对应组件一一对应，抽象组件就“钉”在了真实功能上！",
        '<div class="fq-layout">' +
          '<div class="fq-left">' +
            '<div class="section-subtitle">' + U.icon("question-circle", 16) + ' 拆解四问（对应四大组件）</div>' +
            '<div class="four-questions fq-enhanced">' +
              '<div class="fq-item fq-per"><span class="fq-num">1</span><div><b>它听到了什么？</b><br><small>→ 感知器：接收了什么信息？（文字/语音/图像）</small></div></div>' +
              '<div class="fq-item fq-plan"><span class="fq-num">2</span><div><b>它怎么安排步骤？</b><br><small>→ 规划器：拆解了什么任务？排了什么顺序？</small></div></div>' +
              '<div class="fq-item fq-mem"><span class="fq-num">3</span><div><b>它记得你的上次提问吗？</b><br><small>→ 记忆器：记住了什么历史？调取了什么知识？</small></div></div>' +
              '<div class="fq-item fq-exe"><span class="fq-num">4</span><div><b>它调用了什么工具？</b><br><small>→ 执行器：用了什么外部能力？（查天气/搜地图/算算术）</small></div></div>' +
            '</div>' +
          '</div>' +
          '<div class="fq-right">' +
            '<div class="section-subtitle">' + U.icon("table", 16) + ' 组件定位表（模板）</div>' +
            '<div class="locate-table lt-enhanced">' +
              '<div class="lt-row lt-head"><span>案例功能</span><span>对应组件</span></div>' +
              '<div class="lt-row"><span>接收用户语音/文字输入</span><span class="lt-comp lt-per">感知器</span></div>' +
              '<div class="lt-row"><span>理解意图、拆解任务、排序步骤</span><span class="lt-comp lt-plan">规划器</span></div>' +
              '<div class="lt-row"><span>记住用户偏好、调取知识库</span><span class="lt-comp lt-mem">记忆器</span></div>' +
              '<div class="lt-row"><span>调用天气/搜索/计算等外部工具</span><span class="lt-comp lt-exe">执行器</span></div>' +
              '<div class="lt-row"><span>基于所有信息组织自然语言回答</span><span class="lt-comp lt-brain">大语言模型</span></div>' +
            '</div>' +
            '<div class="fq-tip">' + U.icon("spark", 16) + ' <b>规范汇报句式：</b>"它的感知器是____，规划器是____，记忆器是____，执行器（工具）是____。"——L04 课上分组汇报就用这个句式！</div>' +
          '</div>' +
        '</div>'
      ) +

      /* ⑧ 教师示范拆解：智能客服 */
      LP.card("brain", "⑧ 教师示范拆解：智能客服（逐环节暂停）", "L04 课上教师示范——以“用户问'我的快递到哪了'”为例，逐环节暂停，用拆解四问定位每个组件。点“下一步”一步步看！",
        '<div class="demo-flow" id="demo-flow">' +
          '<div class="df-step" data-step="0">' +
            '<div class="df-num">0</div>' +
            '<div class="df-content">' +
              '<div class="df-title">用户提问</div>' +
              '<div class="df-msg user-msg">我的快递到哪了？</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="row" style="margin-top:12px">' +
          '<button class="btn btn-brain" id="df-next">' + U.icon("play", 14) + ' 下一步</button>' +
          '<button class="btn btn-ghost btn-sm" id="df-reset">' + U.icon("reset", 14) + ' 重新演示</button>' +
          '<span id="df-status" style="color:var(--c-sub);font-size:14px;align-self:center">点"下一步"开始拆解</span>' +
        '</div>' +
        '<div class="df-locate" id="df-locate" style="display:none;margin-top:14px">' +
          '<div style="font-weight:700;margin-bottom:8px">组件定位表（智能客服）</div>' +
          '<div class="locate-table">' +
            '<div class="lt-row lt-head"><span>案例功能</span><span>对应组件</span></div>' +
            '<div class="lt-row"><span>接收用户文字"我的快递到哪了"</span><span style="color:var(--c-per-deep);font-weight:700">感知器</span></div>' +
            '<div class="lt-row"><span>判断需要查订单→决定调用订单查询工具</span><span style="color:var(--c-plan-deep);font-weight:700">规划器</span></div>' +
            '<div class="lt-row"><span>调取用户账号信息（知道是哪个用户的订单）</span><span style="color:var(--c-mem-deep);font-weight:700">记忆器</span></div>' +
            '<div class="lt-row"><span>调用订单查询 API，返回快递状态</span><span style="color:var(--c-exe-deep);font-weight:700">执行器</span></div>' +
            '<div class="lt-row"><span>基于工具结果组织自然语言回答</span><span style="color:var(--c-brain-deep);font-weight:700">大语言模型</span></div>' +
          '</div>' +
        '</div>'
      ) +

      /* ⑨ 真实案例拆解库 */
      LP.card("brain", "⑨ 真实案例拆解库：5 个真实 Agent", "L04 课上分组拆解的真实案例！选择一个案例，看它的四大组件分别是什么——智能客服、出行助手、智能家居、Coding Agent、搜索 Agent。每个案例都有完整的组件定位表和 ai-agent-book 依据。",
        '<div class="case-tabs" id="case-tabs">' +
          CASES.map(function (c, i) {
            return '<button class="case-tab' + (i === 0 ? ' active' : '') + '" data-case="' + i + '">' + U.icon(c.icon, 14) + ' ' + c.name + '</button>';
          }).join("") +
        '</div>' +
        '<div class="case-content" id="case-content"></div>'
      ) +

      /* ⑨+ Coding Agent 深度拆解：腾讯 CodeBuddy */
      LP.card("brain", "⑨⁺ 深度拆解：腾讯 CodeBuddy（Coding Agent 完整案例）", "上面案例库中 Coding Agent 只是简介，这里把腾讯 CodeBuddy 单独拿出来做<b>完整深度拆解</b>——从产品定位到四大组件，再到真实工作流程，一步步看懂一个专业编程 Agent 是怎么工作的。",
        // 产品定位
        '<div class="cb-deep">' +
          '<div class="cb-section cb-product">' +
            '<div class="cb-sec-head">' + U.icon("rocket", 18) + ' 产品定位</div>' +
            '<div class="cb-product-grid">' +
              '<div class="cb-pro-item"><b>出品方</b><span>腾讯云</span></div>' +
              '<div class="cb-pro-item"><b>双引擎</b><span>混元代码大模型 + DeepSeek</span></div>' +
              '<div class="cb-pro-item"><b>支持IDE</b><span>VS Code / JetBrains 全家桶</span></div>' +
              '<div class="cb-pro-item"><b>核心能力</b><span>代码补全 / 技术对话 / 单元测试 / 代码诊断 / 智能评审</span></div>' +
              '<div class="cb-pro-item"><b>工具链</b><span>文件编辑 / 命令执行 / Git操作 / 测试执行 / MCP扩展</span></div>' +
              '<div class="cb-pro-item"><b>中文理解</b><span>语义理解准确率 95%（国产工具领先）</span></div>' +
            '</div>' +
          '</div>' +

          // 感知器
          '<div class="cb-section cb-per">' +
            '<div class="cb-sec-head">' + U.icon("eye", 18) + ' 感知器：它"看到"了什么？</div>' +
            '<div class="cb-perception-list">' +
              '<div class="cb-per-item"><span class="cb-per-num">1</span><div><b>当前代码文件</b><p>读取打开的文件全文——函数定义、变量、注释、import 语句，理解代码结构和上下文</p></div></div>' +
              '<div class="cb-per-item"><span class="cb-per-num">2</span><div><b>项目目录结构</b><p>扫描 src/、tests/、package.json 等，了解项目技术栈、目录约定、依赖关系</p></div></div>' +
              '<div class="cb-per-item"><span class="cb-per-num">3</span><div><b>终端输出</b><p>读取编译错误、测试失败信息、运行日志、报错堆栈中的文件名和行号</p></div></div>' +
              '<div class="cb-per-item"><span class="cb-per-num">4</span><div><b>Git 差异</b><p>读取 git diff 看最近改了什么，git status 看哪些文件被修改，理解开发进度</p></div></div>' +
              '<div class="cb-per-item"><span class="cb-per-num">5</span><div><b>选中代码片段</b><p>读取用户选中的代码或光标所在行，精准定位用户想修改的位置</p></div></div>' +
              '<div class="cb-per-item"><span class="cb-per-num">6</span><div><b>用户自然语言需求</b><p>"帮我给这个函数加错误处理"——理解用户意图，拆解为具体代码改动点</p></div></div>' +
            '</div>' +
          '</div>' +

          // 规划器
          '<div class="cb-section cb-plan">' +
            '<div class="cb-sec-head">' + U.icon("gear", 18) + ' 规划器：它怎么"思考"步骤？</div>' +
            '<div class="cb-plan-flow">' +
              '<div class="cb-pf-step"><span class="cb-pf-num">1</span><div><b>理解需求</b><p>把"加错误处理"拆解为：识别可能出错的操作→选择错误处理方式（try-catch/返回错误码）→确定错误提示文案</p></div></div>' +
              '<div class="cb-pf-arrow">↓</div>' +
              '<div class="cb-pf-step"><span class="cb-pf-num">2</span><div><b>搜索相关代码</b><p>在项目中找到需要修改的函数、它的调用方、类似的错误处理写法（参考项目已有规范）</p></div></div>' +
              '<div class="cb-pf-arrow">↓</div>' +
              '<div class="cb-pf-step"><span class="cb-pf-num">3</span><div><b>定位修改位置</b><p>确定在哪个文件、哪一行、哪个函数内部插入或替换代码，不影响其他功能</p></div></div>' +
              '<div class="cb-pf-arrow">↓</div>' +
              '<div class="cb-pf-step"><span class="cb-pf-num">4</span><div><b>生成代码补丁</b><p>写出符合项目编码规范（如阿里Java规范、ESLint规则）的新代码，包含必要注释</p></div></div>' +
              '<div class="cb-pf-arrow">↓</div>' +
              '<div class="cb-pf-step"><span class="cb-pf-num">5</span><div><b>运行测试验证</b><p>执行 npm test / pytest，看单元测试是否通过，有没有引入新的 bug</p></div></div>' +
              '<div class="cb-pf-arrow">↓</div>' +
              '<div class="cb-pf-step cb-pf-final"><span class="cb-pf-num">6</span><div><b>根据失败结果调试</b><p>如果测试失败→读取错误信息→回到第3步重新修改，形成 <b>ReAct 循环</b>（观察→思考→行动→再观察）</p></div></div>' +
            '</div>' +
            '<div class="cb-tip">' + U.icon("spark", 14) + ' <b>ai-agent-book chapter1:53：</b>Coding Agent 的核心策略是"增量开发"——不是一次性写出全部代码，而是理解→搜索→编辑→测试→调试的循环迭代。这正是 ReAct（Reasoning + Acting）范式在编程场景的体现。</div>' +
          '</div>' +

          // 记忆器
          '<div class="cb-section cb-mem">' +
            '<div class="cb-sec-head">' + U.icon("book", 18) + ' 记忆器：它"记住"了什么？</div>' +
            '<div class="cb-memory-grid">' +
              '<div class="cb-mem-item"><div class="cb-mem-icon">' + U.icon("file-code", 16) + '</div><div><b>项目代码规范</b><p>阿里Java规范、ESLint规则、命名风格（驼峰/下划线）、注释语言</p></div></div>' +
              '<div class="cb-mem-item"><div class="cb-mem-icon">' + U.icon("history", 16) + '</div><div><b>修改历史</b><p>这个函数上次改过什么、用户之前要求过什么风格、哪些改动被接受/拒绝</p></div></div>' +
              '<div class="cb-mem-item"><div class="cb-mem-icon">' + U.icon("user", 16) + '</div><div><b>用户编码偏好</b><p>喜欢箭头函数还是function、写中文还是英文注释、偏好函数式还是面向对象</p></div></div>' +
              '<div class="cb-mem-item"><div class="cb-mem-icon">' + U.icon("layers", 16) + '</div><div><b>项目技术栈</b><p>React+TypeScript 还是 Vue+JS、用 Jest 还是 Mocha、数据库用 MySQL 还是 MongoDB</p></div></div>' +
              '<div class="cb-mem-item"><div class="cb-mem-icon">' + U.icon("folder-tree", 16) + '</div><div><b>目录约定</b><p>组件放 src/components、测试放 tests/、工具函数放 utils/、配置文件放 config/</p></div></div>' +
            '</div>' +
          '</div>' +

          // 执行器
          '<div class="cb-section cb-exe">' +
            '<div class="cb-sec-head">' + U.icon("hand", 18) + ' 执行器：它能"动手"做什么？</div>' +
            '<div class="cb-executor-grid">' +
              '<div class="cb-exe-item"><span class="cb-exe-tag">搜索</span><div><b>代码搜索</b><p>跨文件符号检索——找到所有调用 login() 的地方、找到某个类的所有子类、全局搜索某个变量</p></div></div>' +
              '<div class="cb-exe-item"><span class="cb-exe-tag">读写</span><div><b>文件读写</b><p>读取文件内容、生成代码补丁（diff）、写入修改、创建新文件、重命名文件</p></div></div>' +
              '<div class="cb-exe-item"><span class="cb-exe-tag">命令</span><div><b>命令执行</b><p>运行 npm test / npm run lint / npm run build / pytest，读取命令输出和退出码</p></div></div>' +
              '<div class="cb-exe-item"><span class="cb-exe-tag">Git</span><div><b>Git 操作</b><p>查看 git diff / git status / git log，自动生成标准化 commit message，支持代码审查</p></div></div>' +
              '<div class="cb-exe-item"><span class="cb-exe-tag">终端</span><div><b>终端交互</b><p>读取终端实时输出、向终端输入指令、处理交互式命令（如需要确认的操作）</p></div></div>' +
              '<div class="cb-exe-item"><span class="cb-exe-tag">扩展</span><div><b>MCP 扩展</b><p>通过 MCP（Model Context Protocol）接入第三方工具——数据库查询、API调试、云服务操作</p></div></div>' +
            '</div>' +
          '</div>' +

          // 真实工作流程
          '<div class="cb-section cb-flow">' +
            '<div class="cb-sec-head">' + U.icon("play-circle", 18) + ' 真实工作流程示例："帮我给登录函数加错误处理"</div>' +
            '<div class="cb-workflow">' +
              '<div class="cb-wf-step"><span class="cb-wf-phase">感知</span><div><b>① 读取上下文</b><p>打开 login.js，读取函数全文；扫描项目目录发现用的是 Express+Jest；终端显示上次测试有 2 个失败</p></div></div>' +
              '<div class="cb-wf-step"><span class="cb-wf-phase">规划</span><div><b>② 制定方案</b><p>识别出数据库查询可能出错→决定用 try-catch 包裹→错误信息返回 {success:false, error:"..."}→参考项目中其他函数的写法</p></div></div>' +
              '<div class="cb-wf-step"><span class="cb-wf-phase">记忆</span><div><b>③ 调取记忆</b><p>记住项目用 ESLint standard 规范、用户偏好箭头函数、错误信息写中文、测试文件放在 tests/auth.test.js</p></div></div>' +
              '<div class="cb-wf-step"><span class="cb-wf-phase">执行</span><div><b>④ 生成代码</b><p>在 login.js 第 42 行插入 try-catch，包裹 db.query() 调用；生成补丁并写入文件</p></div></div>' +
              '<div class="cb-wf-step"><span class="cb-wf-phase">执行</span><div><b>⑤ 运行测试</b><p>执行 npm test -- tests/auth.test.js，读取输出：3 passed, 0 failed ✓</p></div></div>' +
              '<div class="cb-wf-step"><span class="cb-wf-phase">感知</span><div><b>⑥ 验证结果</b><p>测试全部通过！读取 git diff 确认改动范围正确，没有误改其他代码</p></div></div>' +
              '<div class="cb-wf-step cb-wf-done"><span class="cb-wf-phase">完成</span><div><b>⑦ 汇报结果</b><p>「已为 login 函数添加错误处理：数据库查询失败时返回 {success:false, error:「登录服务暂不可用」}。全部 3 个测试通过。」——并自动生成 commit message</p></div></div>' +
            '</div>' +
          '</div>' +

          // ai-agent-book 依据
          '<div class="cb-ref-box">' +
            U.icon("book", 16) + ' <b>ai-agent-book 依据：</b>' +
            '<ul>' +
              '<li><b>chapter1:53</b> — Coding Agent 增量开发策略：眼睛=需求/代码片段/终端输出，手脚=代码搜索/文件读写/执行命令，策略=增量开发（理解→搜索→编辑→测试→调试的ReAct循环）</li>' +
              '<li><b>chapter4:7</b> — 工具五分类：CodeBuddy 的工具涵盖感知类（代码搜索）、执行类（文件读写/命令执行/Git操作）、协作类（MCP扩展）</li>' +
              '<li><b>chapter4:100</b> — MCP 协议：CodeBuddy 通过 MCP 接入第三方工具，像 USB 接口一样扩展能力</li>' +
              '<li><b>chapter3:72</b> — 记忆层次：CodeBuddy 记住项目规范（用户长期记忆）、修改历史（轨迹）、技术栈（业务状态）</li>' +
            '</ul>' +
          '</div>' +
        '</div>'
      ) +

      /* ⑩ 五种 Agent 产品对比 */
      LP.card("brain", "⑩ 五种 Agent 产品对比（ai-agent-book chapter1:51-59）", "ai-agent-book 第1章给出了五种真实 Agent 产品的对比——从眼睛（感知什么）、手脚（能做什么）、策略（怎么工作）三个维度对比。看看不同 Agent 的“手脚”有多不一样！",
        '<div class="agent-compare-cards">' +
          AGENT_COMPARE.map(function (a, i) {
            var icons = ["code", "search", "display", "mobile", "phone"];
            var colors = ["per", "plan", "mem", "exe", "brain"];
            return '<div class="acc-card acc-' + colors[i] + '">' +
              '<div class="acc-head">' +
                '<span class="acc-icon">' + U.icon(icons[i], 20) + '</span>' +
                '<span class="acc-name">' + a.name + '</span>' +
              '</div>' +
              '<div class="acc-body">' +
                '<div class="acc-row"><span class="acc-label acc-eye">眼睛</span><span class="acc-value">' + a.eye + '</span></div>' +
                '<div class="acc-row"><span class="acc-label acc-hand">手脚</span><span class="acc-value">' + a.hand + '</span></div>' +
                '<div class="acc-row"><span class="acc-label acc-strategy">策略</span><span class="acc-value">' + a.strategy + '</span></div>' +
              '</div>' +
            '</div>';
          }).join("") +
        '</div>' +
        '<div class="acc-conclusion">' + U.icon("book", 16) + ' <b>ai-agent-book 发现：</b>这些 Agent 系统有几个共同特征——都使用<b>开放式的动作空间</b>（不是从有限按钮中选择，而是能生成任意自然语言和代码）；都能<b>内部思考</b>（在采取行动前先思考和规划）；都能<b>持续交互</b>（根据环境反馈不断调整策略）。这些能力正是来自大脑、眼睛和手脚——即 LLM、上下文和工具——的协同作用。</div>'
      ) +

      /* ⑪ 小测验 */
      LP.card("brain", "⑪ 小测验：你是架构小达人吗？", "共 " + QUIZ.length + " 题，覆盖总装图、核心公式、Model-Harness、拆解四问、组件定位、五种 Agent 对比。答对一题加一颗星！全部答完后查看你的成绩。",
        '<div class="quiz-game" id="home-quiz">' +
          '<div class="qz-header">' +
            '<div class="qz-progress"><div class="qz-progress-bar" id="qz-progress-bar"></div></div>' +
            '<div class="qz-meta">' +
              '<span class="qz-count" id="qz-count">已答 0/' + QUIZ.length + ' 题</span>' +
              '<div class="qz-meta-right">' +
                '<span class="qz-score" id="home-quiz-score" data-score="0">★ 0</span>' +
                '<button class="btn btn-ghost btn-sm" id="home-quiz-restart">' + U.icon("refresh", 13) + ' 重新开始</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="qz-body" id="home-quiz-body"></div>' +
          '<div class="qz-result" id="qz-result" style="display:none"></div>' +
        '</div>'
      ) +

      /* ⑫ 进阶原理卡 + 课堂小结 */
      LP.deepCard("brain", "⑫ 进阶原理：Agent 架构的科学全景（ai-agent-book）", DEEP) +

      /* 课堂小结 */
      '<div class="lesson-summary card-per">' +
        '<h3>' + U.icon("check", 18) + ' 课堂小结（L03+L04）</h3>' +
        '<div class="summary-core"><b>核心结论：</b>现代 AI 智能体 = 大语言模型"大脑" + 感知器、规划器、记忆器、执行器（工具）四大组件。ai-agent-book 科学口径：Agent = LLM + 上下文 + 工具（大脑+眼睛+手脚），内部是 Model-Harness 双层结构。真实产品（智能客服/出行助手/智能家居/Coding Agent/搜索 Agent）都是这四大组件的协作——用"拆解四问"可以把任何智能体拆开看明白。</div>' +
        '<div class="summary-points">' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("brain", 14) + '</span><div><b>核心公式：</b>Agent = LLM（大脑）+ 上下文（眼睛）+ 工具（手脚）；人体类比：眼睛→感知器、大脑→LLM、小本子→记忆器、手→执行器</div></div>' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("gear", 14) + '</span><div><b>Model-Harness：</b>Model=LLM 负责策略决策；Harness=运行治理层，负责构造上下文、暴露工具、维护循环、权限验证纠正</div></div>' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("search", 14) + '</span><div><b>拆解四问：</b>①它听到了什么？（感知器）②它怎么安排步骤？（规划器）③它记得你的上次提问吗？（记忆器）④它调用了什么工具？（执行器）</div></div>' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("book", 14) + '</span><div><b>五种 Agent 对比：</b>腾讯CodeBuddy/Deep Research/Browser Use/豆包手机助手/Pine AI——共同特征：开放式动作空间、内部思考、持续交互</div></div>' +
        '</div>' +
        '<div class="summary-think"><b>课后思考：</b>请用"拆解四问"分析一个你身边的 AI 智能体（如手机语音助手、学习 App 里的 AI 老师），它的感知器、规划器、记忆器、执行器分别是什么？下节课分享！</div>' +
      '</div>' +

      /* 作品主线 + CTA */
      '<div class="works">' +
        '<div class="work-tag"><span class="dot dot-mem"></span>作品一：班级小管家（记忆型）——记住"我们班"</div>' +
        '<div class="work-tag"><span class="dot dot-exe"></span>作品二：天气小管家（工具型）——查天气给建议</div>' +
      '</div>' +
      '<div class="cta-row">' +
        '<button class="cta-big" id="btn-to-playground">进入智能体实验室 · 四样本领一起转</button>' +
      '</div>' +
      '<div class="course-line">' +
        '<span>课程脉络：</span>' +
        '<span class="step">起源</span>→<span class="step" style="background:var(--c-brain);color:#fff">架构（本课）</span>→<span class="step">感知器</span>→<span class="step">规划器</span>→<span class="step">记忆器</span>→<span class="step">执行器</span>→<span class="step">综合搭建</span>→<span class="step">成果展示</span>' +
      '</div>';

    /* 绑定事件 */
    bindAssembly();
    bindAssemble();
    bindQuick();
    bindDemoFlow();
    bindCases();
    bindQuiz();

    var btn = $("btn-to-playground");
    if (btn) btn.addEventListener("click", function () { U.showSection("playground"); });
  }

  /* ---------- ③ 总装图节点渲染 ---------- */
  function bindAssembly() {
    var map = $("home-assembly");
    if (!map) return;
    var brain =
      '<div class="node node-brain" data-sec="playground" style="grid-area: 2 / 2" role="button" tabindex="0">' +
        '<div class="nicon">' + U.icon("brain", 36) + '</div>' +
        '<div class="nbody">' +
          '<div class="nname">大语言模型"大脑"</div>' +
          '<div class="nen">LLM · Harness 编排</div>' +
          '<div class="njob">负责<b>理解与生成</b>——读懂"上下文"，安排"工具"，组织出回答（Agent 循环的核心）。</div>' +
          '<div class="go">点我进入智能体实验室 →</div>' +
        '</div>' +
      '</div>';
    var nodes = NODES.map(function (n) {
      return '<div class="node node-' + n.color + '" data-sec="' + n.sec + '" style="grid-area: ' + n.area + '" role="button" tabindex="0">' +
        '<div class="nicon">' + U.icon(n.icon, 28) + '</div>' +
        '<div class="nbody">' +
          '<div class="nname">' + n.name + '</div>' +
          '<div class="nen">' + n.en + '</div>' +
          '<div class="njob">' + n.job + '</div>' +
          '<div class="go">进入' + n.name + '实验室 →</div>' +
        '</div>' +
      '</div>';
    }).join("");
    map.insertAdjacentHTML("beforeend", brain + nodes);
    map.querySelectorAll(".node").forEach(function (nd) {
      var go = function () { U.showSection(nd.getAttribute("data-sec")); };
      nd.addEventListener("click", go);
      nd.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    });
  }

  /* ---------- ⑤ 拼装互动 ---------- */
  function bindAssemble() {
    var pieces = document.querySelectorAll("#ag-pieces .ag-piece");
    var slots = document.querySelectorAll("#ag-board .ag-slot");
    var status = $("ag-status");
    var placed = 0;
    var total = pieces.length;
    var selectedPiece = null;

    var compNames = { perception: "感知器", memory: "记忆器", planner: "规划器", executor: "执行器", brain: "大语言模型" };
    var slotNames = { top: "上方（像眼睛）", left: "左方（像小本子）", bottom: "下方（像思考的头脑）", right: "右方（像手）", center: "中间（大脑）" };

    function clearSelection() {
      pieces.forEach(function (p) { p.classList.remove("selected"); });
      selectedPiece = null;
    }

    pieces.forEach(function (p) {
      p.addEventListener("click", function () {
        if (p.classList.contains("placed")) return;
        if (selectedPiece === p) {
          clearSelection();
          status.textContent = "已取消选择，先点击一个组件卡片";
          status.className = "ag-status-text";
        } else {
          clearSelection();
          selectedPiece = p;
          p.classList.add("selected");
          var comp = p.getAttribute("data-comp");
          status.innerHTML = '<span class="ag-status-selected">已选中「' + compNames[comp] + '」，现在点击总装图上的位置</span>';
        }
      });
    });

    slots.forEach(function (slot) {
      slot.addEventListener("click", function () {
        if (slot.classList.contains("filled")) {
          status.innerHTML = '<span class="ag-status-warn">这个位置已经放了组件！</span>';
          return;
        }
        if (!selectedPiece) {
          status.innerHTML = '<span class="ag-status-warn">请先点击下面的组件卡片选中它！</span>';
          slot.classList.add("pulse");
          setTimeout(function () { slot.classList.remove("pulse"); }, 500);
          return;
        }
        var correctSlot = selectedPiece.getAttribute("data-slot");
        var targetSlot = slot.getAttribute("data-slot");
        var comp = selectedPiece.getAttribute("data-comp");

        if (correctSlot === targetSlot) {
          slot.innerHTML = "";
          selectedPiece.classList.remove("selected");
          selectedPiece.classList.add("placed");
          slot.appendChild(selectedPiece);
          slot.classList.add("correct", "filled");
          placed++;
          clearSelection();
          status.innerHTML = '<span class="ag-status-ok">✓ ' + compNames[comp] + '放对了！（' + placed + '/' + total + '）</span>';
          if (placed === total) {
            status.innerHTML = '<span class="ag-status-done">🎉 总装完成！四大组件+大脑全部就位！</span>';
            U.toast("总装完成！你是架构小达人！", "success");
          }
        } else {
          slot.classList.add("wrong");
          setTimeout(function () { slot.classList.remove("wrong"); }, 600);
          status.innerHTML = '<span class="ag-status-err">✗ 放错位置了！「' + compNames[comp] + '」应该放在' + slotNames[correctSlot] + '</span>';
        }
      });
    });

    $("ag-reset").addEventListener("click", function () {
      var piecesBox = $("ag-pieces");
      slots.forEach(function (slot) {
        var p = slot.querySelector(".ag-piece");
        if (p) {
          p.classList.remove("placed", "selected");
          piecesBox.appendChild(p);
        }
        slot.classList.remove("correct", "wrong", "filled");
        var slotLabel = { top: "上方 · 眼睛", left: "左方 · 小本子", center: "中间 · 大脑", right: "右方 · 手", bottom: "下方 · 思考" }[slot.getAttribute("data-slot")];
        slot.innerHTML = '<span class="ag-slot-label">' + slotLabel + '</span>';
      });
      placed = 0;
      selectedPiece = null;
      status.textContent = "先点击一个组件卡片";
      status.className = "ag-status-text";
    });
  }

  /* ---------- ⑥ 组件抢答 ---------- */
  function bindQuick() {
    var body = $("home-quick-body");
    var progressBar = $("qg-progress-bar");
    var countEl = $("qg-count");
    var scoreEl = $("home-quick-score");
    var idx = 0;
    var correctCount = 0;

    // 常驻重新开始按钮
    var restartBtn = $("qg-restart");
    if (restartBtn) {
      restartBtn.addEventListener("click", function () {
        idx = 0;
        correctCount = 0;
        scoreEl.setAttribute("data-score", "0");
        scoreEl.textContent = "★ 0";
        draw();
      });
    }

    var compMeta = {
      "感知器": { icon: "eye", color: "per", bg: "rgba(62,155,255,.08)", border: "var(--c-per)" },
      "规划器": { icon: "gear", color: "plan", bg: "rgba(255,159,46,.08)", border: "var(--c-plan)" },
      "记忆器": { icon: "book", color: "mem", bg: "rgba(47,191,113,.08)", border: "var(--c-mem)" },
      "执行器": { icon: "hand", color: "exe", bg: "rgba(255,90,95,.08)", border: "var(--c-exe)" }
    };

    function updateProgress() {
      var pct = (idx / QUICK_Q.length) * 100;
      progressBar.style.width = pct + "%";
      countEl.textContent = "第 " + (idx + 1) + "/" + QUICK_Q.length + " 题";
    }

    function draw() {
      if (idx >= QUICK_Q.length) {
        var pct = Math.round((correctCount / QUICK_Q.length) * 100);
        var rank = pct >= 90 ? "🏆 组件大师" : pct >= 70 ? "⭐ 组件达人" : pct >= 50 ? "👍 组件学徒" : "💪 继续加油";
        progressBar.style.width = "100%";
        countEl.textContent = "已完成 " + QUICK_Q.length + "/" + QUICK_Q.length + " 题";
        body.innerHTML =
          '<div class="qg-complete">' +
            '<div class="qg-complete-icon">' + U.icon("trophy", 48) + '</div>' +
            '<div class="qg-complete-title">抢答完成！</div>' +
            '<div class="qg-complete-stats">' +
              '<div class="qg-stat"><span class="qg-stat-num">' + correctCount + '</span><span class="qg-stat-label">答对</span></div>' +
              '<div class="qg-stat"><span class="qg-stat-num">' + (QUICK_Q.length - correctCount) + '</span><span class="qg-stat-label">答错</span></div>' +
              '<div class="qg-stat"><span class="qg-stat-num">' + pct + '%</span><span class="qg-stat-label">正确率</span></div>' +
            '</div>' +
            '<div class="qg-complete-rank">' + rank + '</div>' +
            '<button class="btn btn-brain" id="qg-restart">' + U.icon("refresh", 16) + ' 重新开始</button>' +
          '</div>';
        var restartBtn = $("qg-restart");
        if (restartBtn) {
          restartBtn.addEventListener("click", function () {
            idx = 0;
            correctCount = 0;
            scoreEl.setAttribute("data-score", "0");
            scoreEl.textContent = "★ 0";
            draw();
          });
        }
        return;
      }

      var q = QUICK_Q[idx];
      updateProgress();

      var optsHtml = Object.keys(compMeta).map(function (comp) {
        var m = compMeta[comp];
        return '<button class="qg-opt qg-opt-' + m.color + '" data-ans="' + comp + '">' +
          '<span class="qg-opt-icon">' + U.icon(m.icon, 22) + '</span>' +
          '<span class="qg-opt-text">' + comp + '</span>' +
        '</button>';
      }).join("");

      body.innerHTML =
        '<div class="qg-question">' +
          '<div class="qg-q-icon">' + U.icon(q.icon || "question", 24) + '</div>' +
          '<div class="qg-q-text">' + q.q + '</div>' +
        '</div>' +
        '<div class="qg-opts">' + optsHtml + '</div>' +
        '<div class="qg-feedback"></div>';

      body.querySelectorAll(".qg-opt").forEach(function (b) {
        b.addEventListener("click", function () {
          if (body.querySelector(".qg-opt.correct, .qg-opt.wrong")) return;
          var picked = b.getAttribute("data-ans");
          var fb = body.querySelector(".qg-feedback");
          if (picked === q.comp) {
            b.classList.add("correct");
            correctCount++;
            fb.innerHTML =
              '<div class="qg-fb qg-fb-ok">' +
                '<div class="qg-fb-head">' + U.icon("check-circle", 18) + ' 答对啦！</div>' +
                '<div class="qg-fb-body">' + q.why + '</div>' +
              '</div>';
            U.addScore(scoreEl, 1);
            U.celebrate(b);
          } else {
            b.classList.add("wrong");
            var right = body.querySelector('.qg-opt[data-ans="' + q.comp + '"]');
            if (right) right.classList.add("correct");
            fb.innerHTML =
              '<div class="qg-fb qg-fb-no">' +
                '<div class="qg-fb-head">' + U.icon("xmark-circle", 18) + ' 再想想～</div>' +
                '<div class="qg-fb-body">' + q.why + '</div>' +
              '</div>';
          }
          setTimeout(function () { idx++; draw(); }, 2200);
        });
      });
    }
    draw();
  }

  /* ---------- ⑧ 智能客服示范拆解 ---------- */
  function bindDemoFlow() {
    var steps = [
      { num: 1, title: "感知器工作", comp: "感知器", color: "per", icon: "eye",
        desc: "接收用户文字输入'我的快递到哪了'，理解用户意图",
        msg: "感知器：收到用户输入'我的快递到哪了'，转化为 AI 能理解的文字" },
      { num: 2, title: "规划器工作", comp: "规划器", color: "plan", icon: "gear",
        desc: "判断需要查询订单→决定调用订单查询工具→组织回答结构",
        msg: "规划器：用户问快递状态→需要查询订单→决定调用订单查询工具" },
      { num: 3, title: "记忆器工作", comp: "记忆器", color: "mem", icon: "book",
        desc: "调取用户账号信息（知道是哪个用户的订单），记住对话历史",
        msg: "记忆器：调取用户账号信息→确认用户身份→关联到该用户的订单" },
      { num: 4, title: "执行器工作", comp: "执行器", color: "exe", icon: "hand",
        desc: "调用订单查询 API，返回'快递已到北京转运中心'",
        msg: "执行器：调用订单查询 API→返回结果'快递已到北京转运中心，预计明天送达'" },
      { num: 5, title: "大语言模型组织回答", comp: "大语言模型", color: "brain", icon: "brain",
        desc: "基于工具返回的真实结果，组织自然语言回答给用户",
        msg: "大语言模型：基于工具结果组织回答→'你的快递已到北京转运中心，预计明天送达！'" }
    ];
    var cur = 0;
    var flow = $("demo-flow");
    var status = $("df-status");
    var locate = $("df-locate");

    $("df-next").addEventListener("click", function () {
      if (cur >= steps.length) return;
      var s = steps[cur];
      var stepEl = document.createElement("div");
      stepEl.className = "df-step df-step-" + s.color;
      stepEl.innerHTML =
        '<div class="df-num">' + s.num + '</div>' +
        '<div class="df-content">' +
          '<div class="df-title">' + U.icon(s.icon, 16) + ' ' + s.title + '（' + s.comp + '）</div>' +
          '<div class="df-desc">' + s.desc + '</div>' +
          '<div class="df-msg ai-msg">' + s.msg + '</div>' +
        '</div>';
      flow.appendChild(stepEl);
      cur++;
      if (cur < steps.length) {
        status.textContent = "已拆解 " + cur + "/5 步，继续点'下一步'";
      } else {
        status.innerHTML = '<span style="color:var(--c-per-deep);font-weight:700">✓ 拆解完成！四大组件+大脑全部定位！</span>';
        locate.style.display = "block";
        U.toast("智能客服拆解完成！", "success");
      }
      flow.scrollTop = flow.scrollHeight;
    });

    $("df-reset").addEventListener("click", function () {
      cur = 0;
      flow.innerHTML =
        '<div class="df-step" data-step="0">' +
          '<div class="df-num">0</div>' +
          '<div class="df-content">' +
            '<div class="df-title">用户提问</div>' +
            '<div class="df-msg user-msg">我的快递到哪了？</div>' +
          '</div>' +
        '</div>';
      status.textContent = "点'下一步'开始拆解";
      locate.style.display = "none";
    });
  }

  /* ---------- ⑨ 真实案例拆解库 ---------- */
  function bindCases() {
    var tabs = document.querySelectorAll("#case-tabs .case-tab");
    var content = $("case-content");

    function renderCase(idx) {
      var c = CASES[idx];
      content.innerHTML =
        '<div class="case-header">' +
          '<div class="case-icon">' + U.icon(c.icon, 28) + '</div>' +
          '<div>' +
            '<div class="case-name">' + c.name + '</div>' +
            '<div class="case-desc">' + c.desc + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="case-components">' +
          '<div class="cc-item cc-per">' +
            '<div class="cc-head">' + U.icon("eye", 16) + ' 感知器</div>' +
            '<div class="cc-body">' + c.perception + '</div>' +
          '</div>' +
          '<div class="cc-item cc-plan">' +
            '<div class="cc-head">' + U.icon("gear", 16) + ' 规划器</div>' +
            '<div class="cc-body">' + c.planner + '</div>' +
          '</div>' +
          '<div class="cc-item cc-mem">' +
            '<div class="cc-head">' + U.icon("book", 16) + ' 记忆器</div>' +
            '<div class="cc-body">' + c.memory + '</div>' +
          '</div>' +
          '<div class="cc-item cc-exe">' +
            '<div class="cc-head">' + U.icon("hand", 16) + ' 执行器（工具）</div>' +
            '<div class="cc-body">' + c.executor + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="case-ref">' + U.icon("book", 14) + ' ' + c.aiagentbook + '</div>';
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        renderCase(parseInt(tab.getAttribute("data-case"), 10));
      });
    });

    renderCase(0);
  }

  /* ---------- ⑪ 小测验 ---------- */
  function bindQuiz() {
    var body = $("home-quiz-body");
    var progressBar = $("qz-progress-bar");
    var countEl = $("qz-count");
    var scoreEl = $("home-quiz-score");
    var resultEl = $("qz-result");
    var answered = 0;
    var correctCount = 0;

    function updateProgress() {
      var pct = (answered / QUIZ.length) * 100;
      progressBar.style.width = pct + "%";
      countEl.textContent = "已答 " + answered + "/" + QUIZ.length + " 题";
    }

    function showResult() {
      var pct = Math.round((correctCount / QUIZ.length) * 100);
      var rank = pct >= 90 ? "🏆 架构大师" : pct >= 70 ? "⭐ 架构达人" : pct >= 50 ? "👍 架构学徒" : "💪 继续加油";
      resultEl.style.display = "block";
      resultEl.innerHTML =
        '<div class="qz-result-box">' +
          '<div class="qz-result-icon">' + U.icon("trophy", 40) + '</div>' +
          '<div class="qz-result-title">测验完成！</div>' +
          '<div class="qz-result-stats">' +
            '<div class="qz-stat"><span class="qz-stat-num">' + correctCount + '</span><span class="qz-stat-label">答对</span></div>' +
            '<div class="qz-stat"><span class="qz-stat-num">' + (QUIZ.length - correctCount) + '</span><span class="qz-stat-label">答错</span></div>' +
            '<div class="qz-stat"><span class="qz-stat-num">' + pct + '%</span><span class="qz-stat-label">正确率</span></div>' +
          '</div>' +
          '<div class="qz-result-rank">' + rank + '</div>' +
        '</div>';
      resultEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function draw() {
      answered = 0;
      correctCount = 0;
      updateProgress();
      resultEl.style.display = "none";
      scoreEl.setAttribute("data-score", "0");
      scoreEl.textContent = "★ 0";

      body.innerHTML = QUIZ.map(function (item, i) {
        return '<div class="qz-question" data-q="' + i + '">' +
          '<div class="qz-q-head">' +
            '<span class="qz-q-num">' + (i + 1) + '</span>' +
            '<span class="qz-q-text">' + item.q + '</span>' +
          '</div>' +
          '<div class="qz-opts">' +
            item.opts.map(function (opt, oi) {
              var letter = ["A", "B", "C", "D"][oi];
              return '<button class="qz-opt" data-i="' + i + '" data-oi="' + oi + '">' +
                '<span class="qz-opt-letter">' + letter + '</span>' +
                '<span class="qz-opt-text">' + opt + '</span>' +
              '</button>';
            }).join("") +
          '</div>' +
          '<div class="qz-feedback" data-fb="' + i + '"></div>' +
        '</div>';
      }).join("");

      body.querySelectorAll(".qz-opt").forEach(function (b) {
        b.addEventListener("click", function () {
          var i = parseInt(b.getAttribute("data-i"), 10);
          var oi = parseInt(b.getAttribute("data-oi"), 10);
          var item = QUIZ[i];
          var fb = body.querySelector('[data-fb="' + i + '"]');
          var btns = body.querySelectorAll('.qz-opt[data-i="' + i + '"]');
          var qBox = body.querySelector('.qz-question[data-q="' + i + '"]');
          if (btns[0].disabled) return;
          btns.forEach(function (x) { x.disabled = true; });
          answered++;
          if (oi === item.ans) {
            b.classList.add("correct");
            correctCount++;
            qBox.classList.add("qz-correct");
            fb.innerHTML =
              '<div class="qz-fb qz-fb-ok">' +
                U.icon("check-circle", 16) + ' <b>答对啦！</b> ' + item.why +
              '</div>';
            U.addScore(scoreEl, 1);
            U.celebrate(b);
          } else {
            b.classList.add("wrong");
            qBox.classList.add("qz-wrong");
            var rightBtn = body.querySelector('.qz-opt[data-i="' + i + '"][data-oi="' + item.ans + '"]');
            if (rightBtn) rightBtn.classList.add("correct");
            fb.innerHTML =
              '<div class="qz-fb qz-fb-no">' +
                U.icon("xmark-circle", 16) + ' <b>正确答案是 ' + ["A","B","C","D"][item.ans] + '。</b> ' + item.why +
              '</div>';
          }
          updateProgress();
          if (answered === QUIZ.length) {
            setTimeout(showResult, 600);
          }
        });
      });
    }
    draw();

    $("home-quiz-restart").addEventListener("click", function () {
      draw();
    });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    render();
  }

  return { init: init, render: render };
})();
