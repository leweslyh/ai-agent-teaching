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
    { id: "perception", sec: "perception", area: "1 / 2", color: "per", icon: "eye", name: "感知器", analogy: "像眼睛和耳朵",
      en: "Perception · 多模态输入", job: "把文字、语音、图像变成 AI 能理解的信息。" },
    { id: "memory", sec: "memory", area: "2 / 1", color: "mem", icon: "book", name: "记忆器", analogy: "像小本子",
      en: "Memory · 上下文与知识", job: "短期记对话历史，长期存知识库。" },
    { id: "planner", sec: "planner", area: "3 / 2", color: "plan", icon: "gear", name: "规划器", analogy: "像大脑的决策参谋",
      en: "Planner · ReAct 循环", job: "把大任务拆成小步骤、排好顺序，并决定调哪个工具。" },
    { id: "executor", sec: "executor", area: "2 / 3", color: "exe", icon: "hand", name: "执行器", analogy: "像手",
      en: "Executor · Function Calling", job: "调用外部工具，真正把事情做出来。" }
  ];

  // 组件抢答题目
  var QUICK_Q = [
    { q: "它听懂了你说的话", comp: "感知器", why: "接收语音/文字输入是感知器的工作——把外界信息变成 AI 能理解的形式。", icon: "microphone" },
    { q: "它把'组织一次生日会'拆成了5个小步骤", comp: "规划器", why: "把大任务拆解成小步骤、排好顺序是规划器的核心能力。", icon: "list-check" },
    { q: "它记住了你上次说过喜欢坐地铁", comp: "记忆器", why: "跨对话记住用户偏好和历史信息是记忆器的工作——短期记忆+长期记忆。", icon: "bookmark" },
    { q: "它调用了天气工具查明天的温度", comp: "执行器", why: "调用外部工具（查天气、搜地图、算算术）是执行器的本领。", icon: "cloud-sun" },
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
      desc: "用户问“我的快递到哪了”，智能客服自动查询订单并回答。",
      perception: "接收用户文字输入“我的快递到哪了”；理解用户意图",
      planner: "判断需要查询订单→决定调用订单查询工具→组织回答结构",
      memory: "调取用户账号信息（知道是哪个用户的订单）；记住对话历史",
      executor: "调用订单查询 API，返回'快递已到北京转运中心'",
      aiagentbook: "ai-agent-book chapter1:53 — Coding Agent 增量开发策略的客服版：理解需求→搜索相关信息→调用工具→验证结果"
    },
    {
      name: "出行助手（高德/百度地图）",
      icon: "map",
      desc: "用户说“帮我规划明天去故宫的路线”，出行助手查天气、查路线、给出建议。",
      perception: "接收语音/文字输入；理解目的地和时间",
      planner: "拆解任务：查天气→查路线→算时间→给建议；排序步骤",
      memory: "记住用户常用出发地、交通偏好（地铁/开车）",
      executor: "调用天气 API、路线规划 API、实时路况 API",
      aiagentbook: "ai-agent-book chapter1:43 — Manus 合并观察空间与动作空间：出行助手同时扩大了'能看到什么'（路况/天气）和'能做什么'（导航/订票）"
    },
    {
      name: "智能家居（小爱同学/Siri/灵犀）",
      icon: "home",
      desc: "用户说“打开客厅灯，空调调到26度”，智能家居控制设备执行。",
      perception: "语音识别（ASR）听懂指令；理解设备名称和操作",
      planner: "拆解为两个子任务：①开灯 ②调空调；判断设备状态",
      memory: "记住用户习惯（如“晚上10点自动关灯”）；记住设备列表",
      executor: "调用智能家居 API，发送'打开客厅灯'和'空调26度'指令",
      aiagentbook: "网络资源 — 灵犀家庭智能体：融合'感知理解（脑输入）+规划决策（脑处理）+家庭记忆（脑记忆）+工具调用（脑输出）'的端到端智脑"
    },
    {
      name: "Coding Agent（腾讯 CodeBuddy）",
      icon: "code",
      desc: "程序员说“帮我给这个登录函数加上错误处理和单元测试”，CodeBuddy 读代码、理解项目结构、生成修改方案、编辑文件、运行测试、根据结果调试。",
      perception: "①读取当前打开的代码文件全文（含函数定义、变量、注释）；②扫描项目目录结构（src/、tests/、package.json 等）；③读取终端输出（编译错误、测试失败、日志）；④读取 Git 差异（git diff 看最近改了什么）；⑤读取选中的代码片段或光标所在行；⑥理解报错堆栈中的文件名和行号",
      planner: "增量开发策略（ai-agent-book chapter1:53）：第一步“理解需求”——把自然语言需求拆解为具体代码改动点；第二步“搜索相关代码”——在项目中找到需要修改的函数和它的调用方；第三步“定位修改位置”——确定在哪个文件哪一行插入/替换代码；第四步“生成代码补丁”——写出符合项目编码规范的新代码；第五步“运行测试验证”——执行单元测试看是否通过；第六步“根据失败结果调试”——如果测试失败，读取错误信息，回到第三步重新修改，形成 ReAct 循环",
      memory: "①记住项目代码规范（如阿里Java规范、ESLint规则、命名风格）；②记住之前的修改历史（这个函数上次改过什么）；③记住用户编码偏好（如喜欢用箭头函数还是function、注释写中文还是英文）；④记住项目技术栈（React+TypeScript还是Vue+JS、用Jest还是Mocha）；⑤记住项目的目录约定（组件放src/components、测试放tests/）",
      executor: "①代码搜索工具——跨文件符号检索（找到所有调用login()的地方）；②文件读写工具——读取文件内容、生成补丁、写入修改；③命令执行工具——运行npm test、npm run lint、npm run build；④Git操作工具——查看git diff、git status、自动生成commit message；⑤终端交互工具——读取命令输出、向终端输入指令；⑥MCP扩展工具——通过MCP协议接入第三方工具（如数据库查询、API调试）",
      aiagentbook: "ai-agent-book chapter1:53 — Coding Agent 增量开发策略：眼睛=需求/代码片段/终端输出/Git差异，手脚=代码搜索/文件读写/执行命令/Git操作，策略=增量开发（理解→搜索→编辑→测试→调试的ReAct循环）。腾讯CodeBuddy基于混元代码大模型+DeepSeek双引擎，支持VS Code/JetBrains插件，内置文件编辑/命令执行/Git操作/测试执行工具链，支持MCP协议扩展"
    },
    {
      name: "搜索 Agent（Deep Research）",
      icon: "search",
      desc: "用户说“帮我调研一下AI Agent的发展历史”，Deep Research 反复搜索、阅读、总结。",
      perception: "搜索结果、网页内容、论文摘要与引用；理解信息相关性",
      planner: "迭代深化：根据已有信息调整搜索方向，逐步综合出完整报告",
      memory: "记住已搜索的关键词、已阅读的网页、已整理的要点",
      executor: "搜索查询、网页读取、生成报告",
      aiagentbook: "ai-agent-book chapter1:54 — Deep Research 等搜索 Agent：眼睛=搜索结果/网页内容，手脚=搜索查询/网页读取/生成报告，策略=迭代深化"
    }
  ];

  // 五种 Agent 产品对比（name 与 kind 拆开显示：名称 + 类型徽标）
  var AGENT_COMPARE = [
    { name: "腾讯 CodeBuddy", kind: "Coding Agent",
      eye: "代码文件、目录结构、终端输出、Git差异、选中片段、报错堆栈",
      hand: "代码搜索、文件读写、命令执行（测试/lint/构建）、Git操作、MCP扩展",
      strategy: "增量开发ReAct循环：理解需求→搜索相关代码→定位修改位置→生成代码补丁→运行测试验证→根据失败结果调试" },
    { name: "Deep Research", kind: "搜索 Agent",
      eye: "搜索结果、网页内容、论文摘要",
      hand: "搜索查询、网页读取、生成报告",
      strategy: "迭代深化：根据已有信息调整搜索方向" },
    { name: "Browser Use", kind: "电脑操控 Agent",
      eye: "屏幕截图、DOM 树、操作结果",
      hand: "点击、输入、滚动、截图、执行代码",
      strategy: "视觉感知+操作：观察屏幕→识别目标→执行操作→验证" },
    { name: "豆包手机助手", kind: "手机操控 Agent",
      eye: "手机截图、App 界面状态、系统反馈",
      hand: "点击、滑动、输入、打开 App",
      strategy: "意图理解+App 操控：理解需求→定位 App→执行操作→确认" },
    { name: "Pine AI", kind: "个人办事 Agent",
      eye: "经授权的账户记录、账单结果、服务商资料",
      hand: "打电话、发邮件、填表单、与用户确认",
      strategy: "多步骤任务执行：收集信息→制定策略→联系服务商→谈判→汇报" }
  ];

  /* 策略文本里的「→」拆成流程链，让箭头获得独立样式；无箭头时原样返回 */
  function strategyHTML(s) {
    var parts = String(s).split("→");
    if (parts.length <= 1) return s;
    return parts.map(function (x) {
      return '<span class="acc-step">' + x.trim() + '</span>';
    }).join('<span class="acc-arrow">→</span>');
  }

  /* 买早餐步骤卡：数字徽章 + 图标 + 标题/描述 + 组件标签（四张卡结构一致） */
  function bbStep(num, color, icon, title, desc, comp) {
    return '<div class="bb-step bb-' + color + '" data-step="' + num + '">' +
      '<div class="bb-step-num">' + num + '</div>' +
      '<div class="bb-icon">' + U.icon(icon, 22) + '</div>' +
      '<div class="bb-text"><b>' + title + '</b><span>' + desc + '</span></div>' +
      '<div class="bb-comp-tag">' + comp + '</div>' +
    '</div>';
  }

  // 小测验
  var QUIZ = [
    { q: "AI 智能体的核心公式是什么？", opts: ["AI = 大脑 + 眼睛 + 手脚", "AI = 芯片 + 软件 + 网络", "AI = 数据 + 算法 + 算力", "AI = 输入 + 处理 + 输出"], ans: 0, why: "ai-agent-book 核心公式：Agent = LLM（大脑）+ 上下文（眼睛）+ 工具（手脚）。" },
    { q: "在人体类比中，'感知器'对应人体的哪个器官？", opts: ["大脑", "眼睛和耳朵", "手", "小本子"], ans: 1, why: "感知器像眼睛和耳朵，负责接收外界信息（文字、语音、图像）并转化为 AI 能理解的形式。" },
    { q: "'Model-Harness' 结构中，Harness 负责什么？", opts: ["负责策略决策和思考", "负责构造上下文、暴露工具接口、维护循环和状态", "负责存储用户数据", "负责渲染用户界面"], ans: 1, why: "Harness 是环绕模型的运行与治理层：构造上下文、暴露工具接口、维护循环和状态、实施权限验证纠正。Model（LLM）负责策略决策。" },
    { q: "拆解一个真实智能体时，'拆解四问'不包括以下哪个？", opts: ["它听到了什么？", "它怎么安排步骤？", "它的代码是谁写的？", "它调用了什么工具？"], ans: 2, why: "拆解四问：①它听到了什么？（感知器）②它怎么安排步骤？（规划器）③它记得你的上次提问吗？（记忆器）④它调用了什么工具？（执行器）。不包括'代码是谁写的'。" },
    { q: "腾讯 CodeBuddy（Coding Agent）的'手脚'主要是什么？", opts: ["搜索结果和网页内容", "代码搜索、文件读写、执行命令", "屏幕截图和 DOM 树", "打电话和发邮件"], ans: 1, why: "ai-agent-book chapter1:53 — Coding Agent 的手脚=代码搜索、文件读写、执行命令等开放式操作。腾讯CodeBuddy内置文件编辑/命令执行/Git操作/测试执行工具链。" },
    { q: "智能家居（小爱同学）中，'记住用户晚上10点自动关灯的习惯'属于哪个组件？", opts: ["感知器", "规划器", "记忆器", "执行器"], ans: 2, why: "记住用户习惯和偏好是记忆器的长期记忆功能——跨会话记住用户信息。" },
    { q: "'观察空间'和'动作空间'分别对应什么？", opts: ["大脑和手脚", "AI 能看到什么 和 AI 能做什么", "输入和输出", "硬件和软件"], ans: 1, why: "ai-agent-book chapter1:37 — 观察空间=AI 能接收到的所有信息，动作空间=AI 被允许执行的所有操作。没有进入观察空间的信息，对 AI 来说就像不存在。" },
    { q: "智能客服中，'调用订单查询 API 返回快递状态'属于哪个组件？", opts: ["感知器", "规划器", "记忆器", "执行器"], ans: 3, why: "调用外部工具（订单查询 API）获取真实数据是执行器的本领——AI 大脑不会自己查数据库，靠工具补。" },
    { q: "PPA 循环指的是什么？", opts: ["感知-规划-执行循环", "准备-执行-评估循环", "计划-处理-分析循环", "感知-处理-行动循环"], ans: 0, why: "PPA（Perception-Planning-Action）循环=感知-规划-执行，是智能体的核心工作循环：感知环境→规划行动→执行行动→观察结果→再规划。" },
    { q: "ai-agent-book 把工具分成几类？", opts: ["3类：感知、执行、协作", "5类：感知、执行、协作、事件触发、用户沟通", "2类：输入、输出", "4类：搜索、计算、控制、通信"], ans: 1, why: "ai-agent-book chapter4:7 — 工具五分类：①感知工具（获取信息）②执行工具（改变世界）③协作工具（与其他 Agent 分工）④事件触发工具（外部输入驱动）⑤用户沟通工具（主动与用户连接）。" },
    { q: "RAG（检索增强生成）主要解决什么问题？", opts: ["让 AI 跑得更快", "让 AI 能访问外部知识库，弥补模型知识的时效性和专业性不足", "让 AI 能生成图片", "让 AI 能听懂语音"], ans: 1, why: "RAG（Retrieval-Augmented Generation）= 检索+生成。先从外部知识库检索相关信息，再把检索结果注入上下文，让大模型基于真实知识生成回答。解决了大模型知识截止日期、专业领域知识不足、幻觉等问题。" },
    { q: "在 ReAct 循环中，'Act'（行动）之后紧接着是什么？", opts: ["直接给出最终答案", "观察（Observation）行动结果，再决定下一步思考", "结束任务", "重新规划整个任务"], ans: 1, why: "ReAct = Reasoning + Acting。循环是：思考（Thought）→行动（Action）→观察（Observation）→再思考（Thought）→... 直到得出最终答案。行动后必须观察结果，才能决定下一步。" }
  ];

  /* 进阶原理卡：原静态网格数据（DEEP）已升级为下方互动课堂数据 BRAIN_CONCEPTS */

  /* ============================================================
   * ⑬ 进阶原理：Agent 架构的科学全景 —— 互动课堂数据
   * 与感知器 / 规划器 / 记忆器 / 执行器 / 智能体实验室同构：
   * 左导航 + 一句话 / 打比方 / 真实系统 / 动手互动 / 自检一问 / 跳回实验
   * ============================================================ */
  var BRAIN_CONCEPTS = [
    {
      id: "formula", icon: "robot", nav: "Agent 核心公式", name: "Agent = LLM + 上下文 + 工具", en: "AGENT FORMULA",
      tip: "Agent 的最小工程实现：<b>大脑（LLM）+ 眼睛（上下文）+ 手脚（工具）</b>——三样缺一，就不成 Agent。",
      analogy: "像人做一件事：<b>会想</b>（大脑）、<b>看得见</b>（眼睛）、<b>能动手</b>（手脚）。",
      real: "CodeBuddy 就是这三样的组合：混元 / DeepSeek 负责决策，打开的代码与对话历史构成上下文，文件读写与命令执行是工具。<b>拿掉上下文，它连你写的是什么语言都不知道</b>。",
      quiz: { q: "把「工具」去掉，Agent 还能做什么？", a: "只能「说」不能「做」——可以给出修改建议，但无法真正改文件、跑测试。这就是聊天机器人与 Agent 的分界线。" },
      demo: "switchboard",
      demoData: {
        title: "动手试试：缺了哪一样，任务还能完成吗？", hint: "点开关切换", icon: "robot",
        chipsTitle: "它现在拥有（点一下可以关掉）：",
        chips: [
          { id: "brain", label: "大脑 LLM（会思考）", on: true },
          { id: "ctx", label: "上下文（能看到信息）", on: true },
          { id: "tool", label: "工具（能动手）", on: true }
        ],
        viewTitle: "当前能力",
        viewNote: "关掉任意一项，再点下面的任务看结果。",
        viewEmpty: "什么都没有——它无法工作。",
        actionsTitle: "任务（点一下试试）：",
        actions: [
          { id: "blind", label: "不看资料，先给个思路", need: ["brain"] },
          { id: "read", label: "读懂这段代码并解释", need: ["brain", "ctx"] },
          { id: "edit", label: "改代码并跑通测试", need: ["brain", "ctx", "tool"], hint: "要「动手」就必须有工具。" }
        ],
        resultEmpty: "点一个任务试试。",
        okTail: " 它可以完成。", failTail: " 缺了它，这件事做不到。"
      },
      links: [{ t: "核心公式卡", el: "home-formula" }, { t: "总装图", el: "home-assembly" }]
    },
    {
      id: "harness", icon: "shield", nav: "Model-Harness", name: "Model-Harness 双层结构", en: "MODEL + HARNESS",
      tip: "科学口径：<b>Model</b> 负责决策（怎么想），<b>Harness</b> 负责治理（怎么管）——「上下文 + 工具」就是最小 Harness。",
      analogy: "像司机与车：司机决定往哪开（Model），方向盘、刹车、安全带保证「开车」这件事可控（Harness）。",
      real: "Harness 做四件事：<b>构造上下文</b>、<b>暴露工具接口</b>、<b>维护循环与状态</b>、<b>权限验证与纠正</b>。模型会犯错，护栏负责兜底——这也是「同一个模型，产品体验天差地别」的原因。",
      quiz: { q: "两个产品都用同一个大模型，为什么一个好用一个难用？", a: "差距常在 Harness：上下文怎么拼、工具怎么暴露、循环怎么收敛、错误怎么纠正。模型能力是上限，Harness 决定你能用到多少。" },
      demo: "sandbox",
      demoData: {
        title: "动手试试：护栏开 / 关，结果差多少？", hint: "切任务 + 开关护栏", icon: "shield",
        srcTitle: "任务（点一下切换）：",
        sources: [
          { id: "normal", label: "常规任务", safe: "把配置文件里的端口号从 3000 改成 8080", evil: "（没有夹带动作）" },
          { id: "risky", label: "危险任务", safe: "清理测试临时目录 dist/tmp/", evil: "顺手删掉整个 dist 目录" }
        ],
        defaultId: "normal",
        guardOn: true, guardLabelOn: "Harness 护栏：已开启", guardLabelOff: "Harness 护栏：已关闭",
        contentTitle: "Agent 收到的任务：",
        dataLabel: "① 用户要求：", injectLabel: "② 夹带的动作：",
        outHtml: function (src, guarded) {
          if (!guarded) {
            return '<span class="no">✗ 没有护栏：</span>模型直接照做——' +
              (src.id === "risky" ? "整个 dist 目录被删除，而且无法回滚。" : "改动生效了，但没有任何校验与记录。");
          }
          return '<span class="ok">✓ 护栏生效：</span>' +
            (src.id === "risky" ? "越权动作被<b>工具白名单</b>拦住，只清理了临时目录，并留下审计日志。" : "改完自动做<b>结果验证</b>（语法检查 + 启动测试），失败就回滚。");
        }
      },
      links: [{ t: "Model-Harness 卡", el: "home-harness" }]
    },
    {
      id: "obsact", icon: "eye", nav: "观察 / 动作空间", name: "观察空间与动作空间", en: "OBSERVATION & ACTION SPACE",
      tip: "两条边界：<b>观察空间</b>=它能收到的信息（没进来的 = 不存在）；<b>动作空间</b>=它被允许做的操作（没允许的 = 只能建议）。",
      analogy: "像蒙着眼、戴着手套干活：看不见的地方判断不了，手套外面的事情做不到。",
      real: "智能客服没接摄像头 → 你生气它也「看不见」；没有下单工具 → 它只能建议你「去 App 里下单」。<b>工程上先划这两条边界，再谈能力</b>。",
      quiz: { q: "用户说「我快被气死了」，为什么客服 Agent 还是照常回复？", a: "情绪没有通过观察通道进来（没有语气 / 表情输入），对模型来说等于不存在。要让它「懂情绪」，得先加感知通道，而不是怪模型不聪明。" },
      demo: "picker",
      demoData: {
        title: "动手试试：哪些信息它真的能看到？", hint: "多选后检查", icon: "eye",
        taskLabel: "场景：", task: "一个只接了「文字输入 + 物流查询工具」的客服 Agent 正在处理你的投诉。下列哪些是它<b>能感知到</b>的？",
        items: [
          { id: "text", label: "你发过去的文字", ok: true, why: "文字输入是最基本的观察通道。" },
          { id: "mood", label: "你打字时的语气与情绪", ok: false, why: "文字通道看不到语气——没有进入观察空间。" },
          { id: "order", label: "订单的物流状态（已接工具）", ok: true, why: "通过查询工具读进来，属于观察。" },
          { id: "face", label: "你此刻的表情", ok: false, why: "没有摄像头通道，表情对它来说不存在。" },
          { id: "history", label: "你上次咨询的记录（已存长期记忆）", ok: true, why: "长期记忆被检索进上下文，也算观察。" }
        ],
        checkLabel: "检查一下",
        passHtml: "判断标准只有一条：<b>有没有通过观察通道进入上下文</b>。没进来的信息，对 AI 来说等于不存在。",
        failHtml: "再想想：没接的通道 = 看不到（表情、语气都没有通道进来）。"
      },
      links: [{ t: "拆解四问", el: "home-fourq" }]
    },
    {
      id: "react", icon: "refresh", nav: "ReAct 循环", name: "ReAct 循环", en: "REASONING + ACTING",
      tip: "Agent 的核心执行模式：<b>思考 → 行动 → 观察 → 再思考</b>，直到任务完成；每一轮的结果都追加进轨迹。",
      analogy: "像做题打草稿：算一步、看一眼结果、再决定下一步——而不是硬憋一个大答案。",
      real: "CodeBuddy 改 bug 就是标准 ReAct：读报错（观察）→ 决定改哪一行（思考）→ 写补丁（行动）→ 跑测试（观察）→ 不通过就再来一轮。",
      quiz: { q: "为什么「先想完再一次性做完」不如 ReAct 稳？", a: "因为中间结果会出错。ReAct 每一步都看反馈、及时纠正，不会让一个错误假设带偏整条路线。" },
      demo: "pipeline",
      demoData: {
        title: "动手试试：一轮 ReAct 是怎么转的？", hint: "先猜后看", icon: "refresh",
        stages: [
          { id: "s1", name: "思考", icon: "brain", en: "Reasoning", io: "测试失败了，先读报错信息" },
          { id: "s2", name: "行动", icon: "wrench", en: "Acting", io: "调用工具：读取终端输出" },
          { id: "s3", name: "观察", icon: "eye", en: "Observation", io: "第 42 行：查询结果没做空值判断" },
          { id: "s4", name: "再思考", icon: "brain", en: "Reasoning", io: "给第 42 行加 try-catch，再跑一遍测试" }
        ],
        guess: { q: "先猜一下：ReAct 里「观察」之后紧接着做什么？", opts: [{ k: "a", t: "直接输出最终答案" }, { k: "b", t: "回到思考，重新决策" }], ans: "b", why: "——每一轮观察都会改变下一轮的判断，这正是 ReAct 比「一次想完」更强的原因。", hint: "想想「边做边调整」几个字。" },
        logTitle: "循环日志", playLabel: "自动播放一遍", stepLabel: "单步推进", resetLabel: "重来"
      },
      links: [{ t: "教师示范拆解", el: "demo-flow" }]
    },
    {
      id: "context", icon: "archive", nav: "上下文 = 前缀 + 轨迹", name: "上下文 = 静态前缀 + 轨迹", en: "CONTEXT FORMULA",
      tip: "上下文由两段拼成：<b>静态前缀</b>（系统提示词 + 工具定义，固定不变）+ <b>轨迹</b>（消息历史，越聊越长）。",
      analogy: "像一块黑板：板书（前缀）一直挂在那儿，你每说一句就添一行（轨迹）——写满了就得擦掉最早的内容。",
      real: "轨迹变长会挤爆上下文窗口。工程上用 <b>摘要</b>（把旧消息压成一段话）、<b>滑动窗口</b>（只保留最近 N 轮）、<b>RAG</b>（需要时再检索）来管理。",
      quiz: { q: "聊到第 50 轮，AI 突然忘了你第 1 轮说的名字，为什么？", a: "那条消息已经被滑出窗口 / 被摘要压缩掉了——它不在上下文里了。要么让系统做摘要保留，要么把关键信息写进长期记忆。" },
      demo: "squeezer",
      demoData: {
        title: "动手试试：轨迹变长，什么会被挤出去？", hint: "拖动滑条", icon: "archive",
        capacity: 320,
        messages: [
          { role: "system", t: "系统提示词：你是班级小管家，回答要简短", tok: 90 },
          { role: "user", t: "我叫小明，喜欢蓝色", tok: 30, key: true, tag: "关键信息，后面要考" },
          { role: "assistant", t: "你好小明，记住了", tok: 40 },
          { role: "user", t: "帮我看看今天的课程表", tok: 40 },
          { role: "assistant", t: "今天有语文、数学、体育", tok: 60 },
          { role: "user", t: "体育课要带什么", tok: 30 },
          { role: "assistant", t: "带运动鞋和水", tok: 40 },
          { role: "user", t: "那明天呢", tok: 30 },
          { role: "assistant", t: "明天有英语、美术、科学", tok: 60 },
          { role: "user", t: "我喜欢什么颜色？", tok: 30 }
        ],
        defaultIndex: 10,
        sliderLabel: "保留最近几条消息（含系统提示）：", unitWord: "条",
        keyWarnHtml: '<div class="no">注意：标红的消息已经被挤出窗口——AI 现在看不到它了，再问就会「失忆」。</div>',
        okHtml: '<div class="ok">关键消息还在窗口里，AI 能正常使用它。</div>',
        infoTail: ""
      },
      links: [{ t: "真实案例库", el: "case-tabs" }]
    },
    {
      id: "tools5", icon: "wrench", nav: "工具五分类", name: "工具五分类", en: "TOOL TAXONOMY",
      tip: "工具按用途分五类：<b>感知</b>（读世界）、<b>执行</b>（改世界）、<b>协作</b>（找帮手 / 找人确认）、<b>事件触发</b>（到点自动动）、<b>用户沟通</b>（发消息）。",
      analogy: "像教室里的分工：有人看（感知）、有人动手（执行）、有人去问老师（协作）、有闹钟到点响（事件）、有人负责通知（沟通）。",
      real: "分类的实际意义是<b>定风险等级</b>：感知类只读，可以放开用；执行类会改变真实世界，必须加确认与审计。CodeBuddy 的工具就覆盖了感知（代码搜索）与执行（文件读写 / 命令）两类。",
      quiz: { q: "「每天 7:30 自动检查课表并提醒」用的是哪一类工具？", a: "事件触发工具。它不需要人叫，到点自己动——这也是 Agent 从「问答」走向「常驻助手」的关键。" },
      demo: "picker",
      demoData: {
        title: "动手试试：哪些工具会「改变真实世界」？", hint: "多选后检查", icon: "wrench",
        taskLabel: "任务：", task: "下面这些工具里，哪些属于<b>执行类</b>（会改变真实世界，风险更高）？",
        items: [
          { id: "search", label: "联网搜索资料", ok: false, why: "只读——属于感知类。" },
          { id: "del", label: "删除服务器上的文件", ok: true, why: "会改变真实世界，而且不可逆。" },
          { id: "mail", label: "给全班群发通知邮件", ok: true, why: "发出去就收不回来，属于执行类。" },
          { id: "weather", label: "查询明天的天气", ok: false, why: "只读——属于感知类。" },
          { id: "pay", label: "自动完成一笔支付", ok: true, why: "涉及真实资金，风险最高。" }
        ],
        checkLabel: "检查一下",
        passHtml: "判断口诀：<b>只读的是感知，会留下后果的是执行</b>。执行类工具必须加确认、权限与审计。",
        failHtml: "再想想：搜索和查天气都只是「看」，不会改变任何东西。"
      },
      links: [{ t: "组件抢答", el: "home-quick" }]
    },
    {
      id: "ppa", icon: "zap", nav: "PPA 循环", name: "PPA 循环（感知-规划-执行）", en: "PERCEPTION-PLANNING-ACTION",
      tip: "智能体的经典工作模式：<b>感知环境 → 规划下一步 → 执行 → 观察结果 → 再规划</b>——与 ReAct 同源，更强调三段式闭环。",
      analogy: "像开车：看路况（感知）→ 决定变道还是刹车（规划）→ 打方向盘（执行）→ 再看一眼路况。",
      real: "智能家居就是典型 PPA：温度传感器读数（感知）→ 判断要不要开空调、设几度（规划）→ 调空调（执行）→ 复查是否达标（观察）。",
      quiz: { q: "PPA 里最容易跳过的是哪一步？跳过会怎样？", a: "最容易跳过「观察 / 复查」。跳过就不知道行动有没有生效——空调没开或温度没达标，Agent 却以为已经完成。" },
      demo: "sorter",
      demoData: {
        title: "动手试试：把 PPA 循环排好顺序", hint: "点步骤入队", icon: "zap",
        task: "让小管家「把教室空调调到 26 度」——按 PPA 把步骤排好。",
        queueTitle: "顺序队（点下面的步骤放进来）",
        poolTitle: "候选步骤（点一条放进顺序队）",
        items: [
          { id: "s3", label: "调用空调工具，设为 26 度", seq: 3 },
          { id: "s1", label: "感知当前室温与空调状态", seq: 1 },
          { id: "s4", label: "复查：温度是否已经达标", seq: 4 },
          { id: "s2", label: "规划：判断是否需要开、设几度", seq: 2 }
        ],
        wrongHint: "这一步依赖前一步的结果——先想想它需要先知道什么？",
        successHtml: "<b>全部排好了！</b>感知 → 规划 → 执行 → 复查，这就是 PPA 三段式闭环。",
        groupNote: ""
      },
      links: [{ t: "总装图拼装", el: "ag-board" }]
    },
    {
      id: "guard", icon: "lock", nav: "Harness 工程", name: "Harness 工程：约束、验证、纠正", en: "GUARDRAILS",
      tip: "给 Agent 加的三道护栏：<b>约束</b>（不许做什么）、<b>验证</b>（每步结果对不对）、<b>纠正</b>（错了自动重来）。",
      analogy: "像学骑车时家长扶的那只手：不替你骑，但会在你要摔的时候稳住车把。",
      real: "生产系统的三道防线：<b>工具白名单</b>（只允许调用列表内的工具）、<b>参数强校验</b>（字段 / 类型 / 范围）、<b>结果验证</b>（必须等工具真正返回才继续）。AI 会犯错，Harness 的价值就在兜底。",
      quiz: { q: "为什么护栏不能「一刀切」全设成最严？", a: "太严会打断流程、拖慢速度（每步都要人确认）。正确做法是按<b>动作的不可逆程度</b>分级：查天气放开，删文件 / 支付严管。" },
      demo: "tuner",
      demoData: {
        title: "动手试试：护栏强度怎么影响效率与安全？", hint: "拖动滑条", icon: "lock",
        paramLabel: "护栏强度：", min: 0, max: 100, step: 10, value: 50, unit: "%",
        metricLabel: "综合评估（安全 vs 效率）",
        compute: function (v) {
          if (v < 30) return { value: 25, label: "效率高 · 风险大", note: "几乎不校验——模型想做什么就做什么，出错直接生效。", level: "bad" };
          if (v < 70) return { value: 65, label: "平衡区", note: "关键动作（删除 / 支付 / 外发）需校验或人工确认，其余放行。", level: "ok" };
          return { value: 92, label: "最安全 · 最啰嗦", note: "每一步都校验与确认，安全但会打断流程、拖慢速度。", level: "warn" };
        },
        best: { q: "猜一猜：生产系统一般把护栏设在哪里？", opts: ["越低越好，先跑通再说", "按动作的不可逆程度分级"], ans: 1, why: "——只读操作放开，不可逆操作严管。护栏不是「一刀切」，而是按风险分级。", hint: "想想「查天气」和「删文件」的区别。" },
        touchedHint: "拖动滑条看看。"
      },
      links: [{ t: "小测验", el: "home-quiz" }]
    },
    {
      id: "loop", icon: "globe", nav: "与环境闭环", name: "Agent 与 Environment 闭环交互", en: "AGENT-ENVIRONMENT LOOP",
      tip: "最小交互结构：<b>环境 → 观察 → 行动 → 改变环境 → 新的观察</b>，循环往复，直到目标达成。",
      analogy: "像打乒乓球：你把球打过去（行动），球弹回来（观察），再决定怎么接下一板。",
      real: "搜索 Agent 就是这条闭环：搜索（行动）→ 读结果（观察）→ 发现信息不够 → 换关键词再搜（新行动）。<b>要不要继续，由「观察」决定，而不是事先写死几轮</b>。",
      quiz: { q: "这条闭环在什么条件下终止？", a: "目标达成，或触发停止条件（最大轮次 / 预算用尽 / 人工中止）。没有明确的停止条件，Agent 就会一直转下去。" },
      demo: "pipeline",
      demoData: {
        title: "动手试试：一次完整的「环境闭环」", hint: "单步推进", icon: "globe",
        stages: [
          { id: "e1", name: "环境状态", icon: "globe", io: "当前：教室 32℃，空气闷" },
          { id: "o1", name: "观察", icon: "eye", en: "Observation", io: "读到温度数值" },
          { id: "a1", name: "行动", icon: "zap", en: "Action", io: "调用工具：打开空调 26℃" },
          { id: "e2", name: "环境改变", icon: "refresh", io: "房间温度降到 26℃" },
          { id: "o2", name: "新的观察", icon: "eye", io: "已达标 → 结束任务" }
        ],
        guess: { q: "猜一猜：这次行动之后，Agent 会做什么？", opts: [{ k: "a", t: "结束——目标已达成" }, { k: "b", t: "不断重复开空调" }], ans: "a", why: "——闭环在「目标达成」时终止。没有新的观察触发，就不会再行动，这正是它与「无脑循环」的区别。", hint: "想想什么条件下该停下来。" },
        logTitle: "闭环日志", playLabel: "自动播放一遍", stepLabel: "单步推进", resetLabel: "重来"
      },
      links: [{ t: "教师示范拆解", el: "demo-flow" }]
    },
    {
      id: "multi", icon: "users", nav: "多智能体系统", name: "多智能体系统（Multi-Agent）", en: "MULTI-AGENT SYSTEM",
      tip: "多个 Agent 通过<b>通信、协商、协作</b>完成单个 Agent 搞不定的复杂任务——每个 Agent 只管自己那一段。",
      analogy: "像球队：前锋、后卫、守门员各司其职，靠传球（通信）把球送进门，没人能一个人踢完全场。",
      real: "智慧城市的信号灯调度：多个路口 Agent 协同调整配时，避免整条路堵死。多 Agent 的代价是<b>通信成本与冲突处理</b>——分工不清晰时，反而不如一个 Agent。",
      quiz: { q: "什么情况下「多 Agent」反而不划算？", a: "任务很小、或者几个 Agent 的目标互相冲突时——通信与协调的开销超过收益。先问「一个人能不能干完」，再决定要不要组队。" },
      demo: "picker",
      demoData: {
        title: "动手试试：哪些任务适合交给多个 Agent？", hint: "多选后检查", icon: "users",
        taskLabel: "任务：", task: "下列任务里，哪些<b>更适合多个 Agent 分工协作</b>？",
        items: [
          { id: "calc", label: "算一道两位数乘法", ok: false, why: "一次调用就能完成，分工反而更慢。" },
          { id: "report", label: "调研报告：查资料 + 写稿 + 校对", ok: true, why: "三段可并行 / 可串行分工，天然适合多 Agent。" },
          { id: "city", label: "智慧城市：多个路口的信号灯协同配时", ok: true, why: "每个路口一个 Agent，需要协同协商。" },
          { id: "essay", label: "给作文起一个标题", ok: false, why: "单点任务，不需要组队。" },
          { id: "game", label: "多角色对战的策略博弈", ok: true, why: "多角色各自决策、互相博弈，标准多 Agent 场景。" }
        ],
        checkLabel: "检查一下",
        passHtml: "判断口径：任务能不能<b>拆成相对独立的子目标</b>、子目标之间要不要协商。两者都成立，多 Agent 才划算。",
        failHtml: "再想想：能一次做完的小任务（乘法、起标题）不需要组队。"
      },
      links: [{ t: "真实案例库", el: "case-tabs" }]
    }
  ];

  /* 深度拆解模块：块标题（语义色徽章 + 标题 + 计数）/ 组标题 */
  function cbHead(color, icon, title, count) {
    return '<div class="cb-sec-head" data-color="' + color + '">' +
      '<span class="cb-ico">' + U.icon(icon, 15) + '</span>' +
      '<span class="cb-title">' + title + '</span>' +
      (count ? '<span class="cb-count">' + count + '</span>' : '') +
    '</div>';
  }
  function cbGroup(label) {
    return '<div class="cb-group-head"><span>' + label + '</span></div>';
  }

  /* ---------- 渲染 ---------- */
  function render() {
    var LP = AgentLab.LabPerception;
    var sec = $("sec-home");
    sec.innerHTML =
      /* 页面头部（与感知器等组件实验室统一：语义图标 + 标题 + meta 胶囊） */
      LP.labHead("brain", "brain", "架构实验室", "看懂智能体的全貌 · 架构篇·总装图（L03–L04）") +

      /* 本课学习地图：先给地图、再讲细节（借鉴 ai-agent-book 每章开篇的「本章知识脉络图」）
       * 每个节点可点 → 跳到对应的第一张卡片并高亮闪烁，兼作页内导航。 */
      U.sectionMap({
        title: "这一页要走的四步",
        hint: "共 13 张卡片 · 点任意一格可直接跳过去",
        color: "brain",
        groups: [
          { label: "先看懂一句话", items: [
            { t: "小机器人买早餐", el: "home-intro", note: "情境导入" },
            { t: "核心公式", el: "home-formula", note: "大脑+眼睛+手脚" }
          ] },
          { label: "拆开看结构", items: [
            { t: "智能体总装图", el: "home-assembly", note: "可点击" },
            { t: "总装图拼装", el: "ag-board", note: "把组件放对位置" },
            { t: "Model-Harness", el: "home-harness", note: "双层结构" }
          ] },
          { label: "动手拆一个真的", items: [
            { t: "拆解四问", el: "home-fourq", note: "L04 核心方法" },
            { t: "教师示范拆解", el: "demo-flow", note: "智能客服" },
            { t: "案例拆解库", el: "case-tabs", note: "5 个真实产品" },
            { t: "深度拆解 CodeBuddy", el: "home-codebuddy", note: "逐环节看" }
          ] },
          { label: "检验与进阶", items: [
            { t: "组件抢答", el: "home-quick", note: "10 题" },
            { t: "五种 Agent 对比", el: "home-compare", note: "产品横向比" },
            { t: "小测验", el: "home-quiz", note: "10 题" },
            { t: "进阶原理课堂", el: "adv-brain", note: "10 个概念" }
          ] }
        ]
      }) +

      /* 学习目标（与其他实验室统一：<h3> 标题 + 编号条目；不用深度拆解模块的 cbHead） */
      '<div class="lesson-goal card-brain">' +
        '<h3>' + U.icon("target", 18) + ' 本课学习目标</h3>' +
        '<div class="goal-list">' +
          '<div class="goal-item"><span class="goal-num">1</span>知道现代智能体的整体架构：大语言模型"大脑" + 感知器、规划器、记忆器、执行器四大组件；理解 Agent = 大脑 + 眼睛 + 手脚的核心公式</div>' +
          '<div class="goal-item"><span class="goal-num">2</span>能通过人体类比（眼睛→感知器、大脑→LLM、小本子→记忆器、手→执行器）理解各组件职责，并在总装图拼装互动中巩固</div>' +
          '<div class="goal-item"><span class="goal-num">3</span>掌握"拆解四问"（它听到了什么？它怎么安排步骤？它记得你的上次提问吗？它调用了什么工具？），能在真实案例（智能客服/出行助手/智能家居/Coding Agent/搜索 Agent）中定位四大组件</div>' +
          '<div class="goal-item"><span class="goal-num">4</span>了解 ai-agent-book 科学口径：Model-Harness 结构、观察空间与动作空间、ReAct 循环、工具五分类；建立"AI 不是魔法，是组件化协作"的理性认知</div>' +
        '</div>' +
      '</div>' +

      /* ① 情境导入：小机器人买早餐 */
      LP.card("brain", "① 情境导入：小机器人买早餐需要哪些本领？", "假如请一个机器人帮你去买早餐，它要完成下面四步——每步都用到一种“身体本领”，也正好对应 AI 智能体的一个组件。",
        '<div class="buy-breakfast bb-enhanced" id="home-intro">' +
          bbStep("1", "per", "eye", "看见早餐店", "它用眼睛看到早餐店在哪里、有什么吃的", "→ 感知器") +
          '<div class="bb-arrow" aria-hidden="true">→</div>' +
          bbStep("2", "plan", "brain", "想一想先买什么", "它用大脑想：先买豆浆、再买包子、最后付钱", "→ 规划器") +
          '<div class="bb-arrow" aria-hidden="true">→</div>' +
          bbStep("3", "mem", "book", "记住你爱喝什么", "它用小本子记住：你爱喝豆浆、不爱喝牛奶", "→ 记忆器") +
          '<div class="bb-arrow" aria-hidden="true">→</div>' +
          bbStep("4", "exe", "hand", "伸手去买、去付钱", "它用手真正拿起早餐、付钱、递给你", "→ 执行器") +
        '</div>' +
        '<div class="bb-conclusion">' + U.icon("spark", 16) + ' <b>关键迁移：</b>人靠「眼睛、大脑、小本子、手」做事，AI 智能体靠「感知器、大语言模型、记忆器、执行器」做事——一一对应！</div>'
      ) +

      /* ② 核心公式 */
      LP.card("brain", "② Agent = 大脑 + 眼睛 + 手脚（ai-agent-book 核心公式）", "ai-agent-book 第1章给出了现代 Agent 的最小工程实现公式：<b>Agent = LLM（大语言模型）+ 上下文 + 工具</b>。换一种更直观的说法：<b>Agent = 大脑 + 眼睛 + 手脚</b>。",
        '<span id="home-formula"></span><div class="formula-strip formula-center">' +
          '<div class="formula-title">现代智能体核心公式（ai-agent-book chapter1:11）</div>' +
          '<div class="formula-line">' +
            '<span class="f-item f-brain">' + U.icon("brain", 15) + 'LLM 大语言模型</span><span class="f-op">+</span>' +
            '<span class="f-item f-mem">' + U.icon("eye", 15) + '上下文 Context</span><span class="f-op">+</span>' +
            '<span class="f-item f-exe">' + U.icon("hand", 15) + '工具 Tools</span><span class="f-op">=</span>' +
            '<span class="f-item f-gold">' + U.icon("robot", 15) + 'AI Agent 智能体</span>' +
          '</div>' +
          '<div class="formula-note">大脑负责生成 · 记忆器与感知器共同构成"上下文" · 执行器就是"工具" · 规划器驱动循环</div>' +
        '</div>' +
        '<div class="formula-cards">' +
          '<div class="notebook formula-card">' +
            '<h4 class="fc-hd fc-hd-brain"><span class="fc-hd-ico">' + U.icon("brain", 16) + '</span>大脑 = LLM</h4>' +
            '<div class="fc-tag">整个 Agent 的<b>决策内核</b>，不只是模型参数</div>' +
            '<div class="fc-item">' + U.icon("book", 14) + '<b>有什么</b><span>预训练（世界知识）+ 后训练（决策策略）</span></div>' +
            '<div class="fc-item">' + U.icon("target", 14) + '<b>做什么</b><span>理解意图 · 思考规划 · 做出判断</span></div>' +
          '</div>' +
          '<div class="notebook formula-card">' +
            '<h4 class="fc-hd fc-hd-per"><span class="fc-hd-ico">' + U.icon("eye", 16) + '</span>眼睛 = 上下文</h4>' +
            '<div class="fc-tag">每个决策点收到的<b>全部信息</b>，不只是输入文本</div>' +
            '<div class="fc-item">' + U.icon("archive", 14) + '<b>有什么</b><span>环境观察 · 用户记忆 · 领域知识 · 任务进展</span></div>' +
            '<div class="fc-item">' + U.icon("search", 14) + '<b>做什么</b><span>决定模型能看到什么——没进入上下文的信息等于不存在</span></div>' +
          '</div>' +
          '<div class="notebook formula-card">' +
            '<h4 class="fc-hd fc-hd-exe"><span class="fc-hd-ico">' + U.icon("hand", 16) + '</span>手脚 = 工具</h4>' +
            '<div class="fc-tag">Agent 与外部世界之间的<b>接口</b></div>' +
            '<div class="fc-item">' + U.icon("box", 14) + '<b>有什么</b><span>预定义工具调用 → 动态生成代码</span></div>' +
            '<div class="fc-item">' + U.icon("zap", 14) + '<b>做什么</b><span>感知外部 · 改变外部；没工具只能「纸上谈兵」</span></div>' +
          '</div>' +
        '</div>'
      ) +

      /* ③ 智能体总装图 */
      LP.card("brain", "③ 智能体总装图", "把抽象架构变成看得见的形象：<b>大脑居中，四大组件围绕它协作</b>。每个节点都标注了人体类比，点任一节点可直接进入对应实验室。",
        '<div class="analogy-center">' +
          '<div class="assembly" id="home-assembly" style="min-height:340px">' +
            '<svg class="lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
              '<path d="M50 50 L50 14"/><path d="M50 50 L16 50"/>' +
              '<path d="M50 50 L84 50"/><path d="M50 50 L50 86"/>' +
            '</svg>' +
          '</div>' +
          '<div class="assembly-hint">中心为大脑（决策内核）· 四周为四大组件 · 点任一节点进入对应实验室</div>' +
        '</div>'
      ) +

      /* ④ Model-Harness 结构 */
      LP.card("brain", "④ Model-Harness 结构（ai-agent-book 科学口径）", "ai-agent-book chapter1:25 给出了 Agent 内部的双层结构：<b>Model</b>（大语言模型）负责策略决策，<b>Harness</b>（运行与治理层）负责构造上下文、暴露工具接口、维护循环和状态、实施权限验证纠正。“大脑+眼睛+手脚”是儿童化说法，Model-Harness 是科学口径。",
        '<span id="home-harness"></span><div class="harness-diagram">' +
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
      LP.card("brain", "⑤ 互动：总装图拼装——把组件放到正确位置", "像 L03 课的 A4 总装图拼装：<b>先点组件卡片选中，再点总装图上的正确位置</b>——大脑居中，感知器上、记忆器左、规划器下、执行器右。拼对了会点亮！",
        '<div class="assemble-game" id="ag-board">' +
          '<div class="ag-board ag-cross" id="ag-board">' +
            '<div class="ag-slot ag-slot-top" data-slot="top"><span class="ag-slot-label">上方 · 眼睛</span></div>' +
            '<div class="ag-slot ag-slot-left" data-slot="left"><span class="ag-slot-label">左方 · 小本子</span></div>' +
            '<div class="ag-slot ag-slot-center" data-slot="center"><span class="ag-slot-label">中间 · 大脑</span></div>' +
            '<div class="ag-slot ag-slot-right" data-slot="right"><span class="ag-slot-label">右方 · 手</span></div>' +
            '<div class="ag-slot ag-slot-bottom" data-slot="bottom"><span class="ag-slot-label">下方 · 决策参谋</span></div>' +
          '</div>' +
          '<div class="ag-pieces-wrap">' +
            '<div class="ag-pieces-title">' + U.icon("hand", 14) + ' 点击组件选中，再点击位置放置</div>' +
            '<div class="ag-pieces" id="ag-pieces">' +
              '<div class="ag-piece" data-comp="perception" data-slot="top"><span class="ag-ico">' + U.icon("eye", 16) + '</span>感知器</div>' +
              '<div class="ag-piece" data-comp="memory" data-slot="left"><span class="ag-ico">' + U.icon("book", 16) + '</span>记忆器</div>' +
              '<div class="ag-piece" data-comp="planner" data-slot="bottom"><span class="ag-ico">' + U.icon("gear", 16) + '</span>规划器</div>' +
              '<div class="ag-piece" data-comp="executor" data-slot="right"><span class="ag-ico">' + U.icon("hand", 16) + '</span>执行器</div>' +
              '<div class="ag-piece ag-brain" data-comp="brain" data-slot="center"><span class="ag-ico">' + U.icon("brain", 16) + '</span>大语言模型</div>' +
            '</div>' +
          '</div>' +
          '<div class="row" style="margin-top:14px">' +
            '<button class="btn btn-ghost btn-sm" id="ag-reset">' + U.icon("reset", 14) + ' 重新拼装</button>' +
            '<span id="ag-status" class="ag-status-text">先点击一个组件卡片</span>' +
          '</div>' +
        '</div>'
      ) +

      /* ⑥ 组件抢答游戏 */
      LP.card("brain", "⑥ 游戏：组件抢答——这时用到了哪个组件？", "看看下面的生活场景，快速选择对应的组件——看你是不是「组件小达人」！",
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
        '<span id="home-fourq"></span><div class="fq-layout">' +
          '<div class="fq-left">' +
            cbHead("brain", "info", "拆解四问（对应四大组件）", "4 问") +
            '<div class="four-questions fq-enhanced">' +
              '<div class="fq-item fq-per"><span class="fq-num">1</span><div><b>它听到了什么？</b><br><small>→ 感知器：接收了什么信息？（文字/语音/图像）</small></div></div>' +
              '<div class="fq-item fq-plan"><span class="fq-num">2</span><div><b>它怎么安排步骤？</b><br><small>→ 规划器：拆解了什么任务？排了什么顺序？</small></div></div>' +
              '<div class="fq-item fq-mem"><span class="fq-num">3</span><div><b>它记得你的上次提问吗？</b><br><small>→ 记忆器：记住了什么历史？调取了什么知识？</small></div></div>' +
              '<div class="fq-item fq-exe"><span class="fq-num">4</span><div><b>它调用了什么工具？</b><br><small>→ 执行器：用了什么外部能力？（查天气/搜地图/算算术）</small></div></div>' +
            '</div>' +
          '</div>' +
          '<div class="fq-right">' +
            cbHead("brain", "database", "组件定位表（模板）", "5 行") +
            '<div class="locate-table lt-enhanced">' +
              '<div class="lt-row lt-head"><span>案例功能</span><span>对应组件</span></div>' +
              '<div class="lt-row"><span>接收用户语音/文字输入</span><span class="lt-comp lt-per">感知器</span></div>' +
              '<div class="lt-row"><span>理解意图、拆解任务、排序步骤</span><span class="lt-comp lt-plan">规划器</span></div>' +
              '<div class="lt-row"><span>记住用户偏好、调取知识库</span><span class="lt-comp lt-mem">记忆器</span></div>' +
              '<div class="lt-row"><span>调用天气/搜索/计算等外部工具</span><span class="lt-comp lt-exe">执行器</span></div>' +
              '<div class="lt-row"><span>基于所有信息组织自然语言回答</span><span class="lt-comp lt-brain">大语言模型</span></div>' +
            '</div>' +
          '</div>' +
        '</div>'
      ) +

      /* ⑧ 教师示范拆解：智能客服 */
      LP.card("brain", "⑧ 教师示范拆解：智能客服", "以“用户问『我的快递到哪了』”为例，逐环节暂停：点一次「下一步」，就有一个组件开始工作——5 步走完，你会用<b>拆解四问</b>把智能客服完整拆开。",
        '<div class="demo-flow" id="demo-flow">' +
          dfStepHTML({ user: true, msg: "我的快递到哪了？" }) +
        '</div>' +
        '<div class="df-toolbar">' +
          '<button class="btn btn-brain" id="df-next">' + U.icon("spark", 14) + ' 下一步</button>' +
          '<button class="btn btn-ghost btn-sm" id="df-reset">' + U.icon("reset", 14) + ' 重新演示</button>' +
          '<span class="df-progress" id="df-progress" aria-hidden="true"></span>' +
          '<span class="df-status" id="df-status">点“下一步”，开始逐环节拆解</span>' +
        '</div>'
      ) +

      /* ⑨ 真实案例拆解库 */
      LP.card("brain", "⑨ 真实案例拆解库：5 个真实 Agent", "点标签切换案例——每个组件格标题旁的小字，就是它在回答「拆解四问」的哪一问；底部标注案例出处。",
        '<div class="case-tabs" id="case-tabs">' +
          CASES.map(function (c, i) {
            return '<button class="case-tab' + (i === 0 ? ' active' : '') + '" data-case="' + i + '">' + U.icon(c.icon, 14) + ' ' + c.name + '</button>';
          }).join("") +
        '</div>' +
        '<div class="case-content" id="case-content"></div>'
      ) +

      /* ⑩ Coding Agent 深度拆解：腾讯 CodeBuddy */
      LP.card("brain", "⑩ 深度拆解：腾讯 CodeBuddy", "把腾讯 CodeBuddy 单独拿出来做<b>完整深度拆解</b>——从产品定位到四大组件，再到真实工作流程。",
        // 模块内导览
        '<div class="cb-deep" id="home-codebuddy">' +
          '<div class="cb-toc">' +
            '<span class="cb-toc-label">' + U.icon("lab", 14) + ' 本模块导览</span>' +
            [
              ['cb-product', '01', '产品定位'],
              ['cb-per', '02', '感知器'],
              ['cb-plan', '03', '规划器'],
              ['cb-mem', '04', '记忆器'],
              ['cb-exe', '05', '执行器'],
              ['cb-flow', '06', '工作流程']
            ].map(function (t) {
              return '<button type="button" class="cb-toc-chip" data-cb="' + t[0] + '"><b>' + t[1] + '</b>' + t[2] + '</button>';
            }).join("") +
          '</div>' +

          // ① 产品定位
          '<div class="cb-section" id="cb-product">' +
            cbHead("brain", "rocket", "产品定位", "6 项") +
            '<div class="tx-facts tx-brain">' +
              [
                ['building', '出品方', '腾讯云'],
                ['zap', '双引擎', '混元 + DeepSeek'],
                ['keyboard', '支持 IDE', 'VS Code、JetBrains 全家桶'],
                ['spark', '核心能力', '补全 · 对话 · 测试 · 评审'],
                ['wrench', '工具链', '文件 · 命令 · Git · MCP'],
                ['lang', '中文理解', '语义准确率 95%']
              ].map(function (f) {
                return '<div class="tx-fact"><span class="tx-ico sm">' + U.icon(f[0], 16) + '</span>' +
                  '<span class="tx-fact-txt"><b>' + f[1] + '</b><span>' + f[2] + '</span></span></div>';
              }).join("") +
            '</div>' +
          '</div>' +

          // 四大组件
          cbGroup("四大组件拆解 · L03 总装图 × L04 拆解四问") +

          '<div class="cb-section" id="cb-per">' +
            cbHead("per", "eye", '感知器：它"看到"了什么？', "6 项") +
            '<div class="tx-grid tx-per">' +
              [
                ['txt', '当前代码文件', '读函数、变量、import，看懂结构'],
                ['archive', '项目目录结构', '识别技术栈与目录约定'],
                ['server', '终端输出', '捕获报错信息与堆栈行号'],
                ['link', 'Git 差异', '看懂最近改了什么'],
                ['target', '选中代码片段', '锁定你想改的那一行'],
                ['chat', '用户需求', '把「加错误处理」拆成改动点']
              ].map(function (x) {
                return '<div class="tx-chip"><span class="tx-ico">' + U.icon(x[0], 18) + '</span>' +
                  '<span class="tx-txt"><b>' + x[1] + '</b><i>' + x[2] + '</i></span></div>';
              }).join("") +
            '</div>' +
          '</div>' +

          // 规划器
          '<div class="cb-section" id="cb-plan">' +
            cbHead("plan", "gear", '规划器：它怎么"思考"步骤？', "6 步") +
            '<div class="cb-steps">' +
              [
                ['brain', '理解需求', '拆成「做什么、怎么做、提示什么」'],
                ['search', '搜索相关代码', '找到函数、调用方与同款写法'],
                ['target', '定位修改位置', '确定文件、行号、插入点'],
                ['pen', '生成代码补丁', '按项目规范写新代码'],
                ['check', '运行测试验证', '跑测试，确认没有引入 bug'],
                ['refresh', '失败就重试', '测试不通过就重来，直到跑通']
              ].map(function (s, i) {
                return '<div class="cb-step is-plan">' +
                  '<span class="cb-step-dot is-plan">' + U.icon(s[0], 16) + '</span>' +
                  '<div class="cb-step-body">' +
                    '<div class="cb-step-top">' +
                      '<span class="cb-step-no">' + (i < 9 ? '0' : '') + (i + 1) + '</span>' +
                      '<b>' + s[1] + '</b>' +
                    '</div>' +
                    '<i>' + s[2] + '</i>' +
                  '</div>' +
                '</div>';
              }).join("") +
            '</div>' +
            '<div class="cb-loop">' + U.icon("refresh", 14) +
              '<span>失败 → 读错误 → 回到<b>第 3 步</b>重新修改，循环迭代　<code>chapter1:53</code></span>' +
            '</div>' +
          '</div>' +

          // 记忆器
          '<div class="cb-section" id="cb-mem">' +
            cbHead("mem", "book", '记忆器：它"记住"了什么？', "5 项") +
            '<div class="tx-grid tx-mem">' +
              [
                ['keyboard', '代码规范', '命名风格、注释语言'],
                ['clock', '修改历史', '哪些改动被接受或拒绝'],
                ['user', '编码偏好', '箭头函数？中文注释？'],
                ['archive', '技术栈', '框架、测试、数据库选型'],
                ['database', '目录约定', '组件、测试、工具各放哪里']
              ].map(function (m) {
                return '<div class="tx-chip"><span class="tx-ico">' + U.icon(m[0], 16) + '</span>' +
                  '<span class="tx-txt"><b>' + m[1] + '</b><i>' + m[2] + '</i></span></div>';
              }).join("") +
            '</div>' +
          '</div>' +

          // 执行器
          '<div class="cb-section" id="cb-exe">' +
            cbHead("exe", "hand", '执行器：它能"动手"做什么？', "6 项") +
            '<div class="tx-grid tx-exe">' +
              [
                ['search', '搜索', '代码搜索', '跨文件找符号和调用'],
                ['pen', '读写', '文件读写', '读内容、写补丁、建文件'],
                ['calc', '命令', '命令执行', '跑 test、lint、build'],
                ['link', 'Git', 'Git 操作', 'diff、status、自动 commit'],
                ['server', '终端', '终端交互', '读实时输出、回传指令'],
                ['box', '扩展', 'MCP 扩展', '接入数据库、API、云服务']
              ].map(function (e) {
                return '<div class="tx-chip"><span class="tx-tag">' + U.icon(e[0], 12) + e[1] + '</span>' +
                  '<span class="tx-txt"><b>' + e[2] + '</b><i>' + e[3] + '</i></span></div>';
              }).join("") +
            '</div>' +
          '</div>' +

          // 真实工作流程
          '<div class="cb-section" id="cb-flow">' +
            cbHead("brain", "spark", '真实工作流程："帮我给登录函数加错误处理"', "7 步") +
            '<div class="cb-steps is-phased">' +
              [
                ['eye', 'is-per', '感知', '读取上下文', '读 login.js，发现 2 个测试失败'],
                ['brain', 'is-plan', '规划', '制定方案', '用 try-catch 包裹查询，参考已有写法'],
                ['database', 'is-mem', '记忆', '调取记忆', 'ESLint 规范 · 箭头函数 · 中文报错'],
                ['zap', 'is-exe', '执行', '生成代码', '在第 42 行插入 try-catch'],
                ['zap', 'is-exe', '执行', '运行测试', 'npm test → 3 passed, 0 failed'],
                ['eye', 'is-per', '感知', '验证结果', 'git diff 确认没有误改'],
                ['check', 'is-done', '完成', '汇报结果', '总结改动 + 自动生成 commit']
              ].map(function (w, i) {
                return '<div class="cb-step ' + w[1] + '">' +
                  '<span class="cb-step-dot ' + w[1] + '">' + U.icon(w[0], 16) + '</span>' +
                  '<div class="cb-step-body">' +
                    '<div class="cb-step-top">' +
                      '<span class="tx-phase ' + w[1] + '">' + w[2] + '</span>' +
                      '<b>' + w[3] + '</b>' +
                      '<span class="cb-step-no">第 ' + (i + 1) + ' / 7 步</span>' +
                    '</div>' +
                    '<i>' + w[4] + '</i>' +
                  '</div>' +
                '</div>';
              }).join("") +
            '</div>' +
          '</div>' +

          // ai-agent-book 依据
          '<div class="tx-points">' +
            '<div class="tx-point">' + U.icon("book", 16) +
              '<div class="tx-point-txt"><b>ai-agent-book 依据</b>——每处设计都有出处。</div>' +
            '</div>' +
            [
              ['chapter1:53', '增量开发', '理解 → 搜索 → 编辑 → 测试 → 调试'],
              ['chapter4:7', '工具分类', '感知类 · 执行类 · 协作类'],
              ['chapter4:100', 'MCP 协议', '工具的「USB 接口」'],
              ['chapter3:72', '记忆层次', '长期记忆 · 轨迹 · 业务状态']
            ].map(function (r) {
              return '<div class="tx-point">' + U.icon("check", 15) +
                '<div class="tx-point-txt"><code>' + r[0] + '</code>　<b>' + r[1] + '：</b>' + r[2] + '</div>' +
              '</div>';
            }).join("") +
          '</div>' +
        '</div>'
      ) +

      /* ⑪ 五种 Agent 产品对比 */
      LP.card("brain", "⑪ 五种 Agent 产品对比（ai-agent-book chapter1:51-59）", "五个真实 Agent 产品，从「眼睛（感知什么）、手脚（能做什么）、策略（怎么工作）」三个维度对比——看看谁的“手脚”伸得最远。",
        '<div class="agent-compare-cards" id="home-compare">' +
          AGENT_COMPARE.map(function (a, i) {
            var icons = ["code", "search", "display", "mobile", "phone"];
            var colors = ["per", "plan", "mem", "exe", "brain"];
            var no = (i + 1 < 10 ? "0" : "") + (i + 1);
            return '<div class="acc-card acc-' + colors[i] + '">' +
              '<div class="acc-head">' +
                '<span class="acc-no">' + no + '</span>' +
                '<span class="acc-icon">' + U.icon(icons[i], 18) + '</span>' +
                '<span class="acc-name">' + a.name + '</span>' +
                '<span class="acc-kind">' + a.kind + '</span>' +
              '</div>' +
              '<div class="acc-body">' +
                '<div class="acc-row"><span class="acc-label acc-eye">' + U.icon("eye", 12) + '眼睛</span><span class="acc-value">' + a.eye + '</span></div>' +
                '<div class="acc-row"><span class="acc-label acc-hand">' + U.icon("hand", 12) + '手脚</span><span class="acc-value">' + a.hand + '</span></div>' +
                '<div class="acc-row"><span class="acc-label acc-strategy">' + U.icon("gear", 12) + '策略</span><span class="acc-value">' + strategyHTML(a.strategy) + '</span></div>' +
              '</div>' +
            '</div>';
          }).join("") +
        '</div>' +
        '<div class="acc-conclusion">' + U.icon("book", 16) + ' <b>ai-agent-book 发现：</b>这些 Agent 系统有几个共同特征——都使用<b>开放式的动作空间</b>（不是从有限按钮中选择，而是能生成任意自然语言和代码）；都能<b>内部思考</b>（在采取行动前先思考和规划）；都能<b>持续交互</b>（根据环境反馈不断调整策略）。这些能力正是来自大脑、眼睛和手脚——即 LLM、上下文和工具——的协同作用。</div>'
      ) +

      /* ⑫ 小测验 */
      LP.card("brain", "⑫ 小测验：你是架构小达人吗？", "共 " + QUIZ.length + " 题，覆盖总装图、核心公式、Model-Harness、拆解四问、组件定位、五种 Agent 对比。答对一题加一颗星！全部答完后查看你的成绩。",
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

      /* ⑬ 进阶原理卡 + 课堂小结 */
      LP.card("brain", "⑬ 进阶原理：Agent 架构的科学全景（ai-agent-book）",
        "10 个真实工程概念（ai-agent-book）：<b>左边选概念，右边看讲解 + 动手实验</b>——每个都配「一句话 / 打个比方 / 真实系统 / 动手做 / 自检一问」。",
        AgentLab.Adv.panelHTML({ key: "brain", concepts: BRAIN_CONCEPTS })) +

      /* 课堂小结（与其他实验室统一：<h3> 标题；不用深度拆解模块的 cbHead） */
      '<div class="lesson-summary card-brain">' +
        '<h3 id="home-adv">' + U.icon("check", 18) + ' 课堂小结（L03+L04）</h3>' +
        '<div class="summary-core"><b>核心结论：</b>现代 AI 智能体 = 大语言模型"大脑" + 感知器、规划器、记忆器、执行器四大组件。ai-agent-book 科学口径：Agent = LLM + 上下文 + 工具（大脑+眼睛+手脚），内部是 Model-Harness 双层结构。真实产品（智能客服/出行助手/智能家居/Coding Agent/搜索 Agent）都是这四大组件的协作——用"拆解四问"可以把任何智能体拆开看明白。</div>' +
        '<div class="summary-points">' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("brain", 14) + '</span><div><b>核心公式：</b>Agent = LLM（大脑）+ 上下文（眼睛）+ 工具（手脚）；人体类比：眼睛→感知器、大脑→LLM、小本子→记忆器、手→执行器</div></div>' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("gear", 14) + '</span><div><b>Model-Harness：</b>Model=LLM 负责策略决策；Harness=运行治理层，负责构造上下文、暴露工具、维护循环、权限验证纠正</div></div>' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("search", 14) + '</span><div><b>拆解四问：</b>①它听到了什么？（感知器）②它怎么安排步骤？（规划器）③它记得你的上次提问吗？（记忆器）④它调用了什么工具？（执行器）</div></div>' +
          '<div class="sp-item"><span class="sp-icon">' + U.icon("book", 14) + '</span><div><b>五种 Agent 对比：</b>腾讯CodeBuddy/Deep Research/Browser Use/豆包手机助手/Pine AI——共同特征：开放式动作空间、内部思考、持续交互</div></div>' +
        '</div>' +
        '<div class="summary-think"><b>课后思考：</b>请用"拆解四问"分析一个你身边的 AI 智能体（如手机语音助手、学习 App 里的 AI 老师），它的感知器、规划器、记忆器、执行器分别是什么？下节课分享！</div>' +
      '</div>';
    /* 说明：本页原先在课堂小结之后还有一块「作品主线预告 + CTA」。
     * 它内含一个指向 L16（双作品联展）的点亮路径——L14–L16 是课堂展示环节、不进网页，
     * 该引用没有落点；主 CTA 又指向 L13（全课最后一站），与"先走完四个组件实验室"的
     * 课程顺序矛盾。按第三轮评审结论，整块删除，让「课堂小结」成为页面真正的最后一块。 */

    /* 绑定事件 */
    bindAssembly();
    bindAssemble();
    bindQuick();
    bindDemoFlow();
    bindCases();
    bindQuiz();
    bindAdvClassroom();
    bindCbToc();
    /* 原「进入感知器实验室」CTA 的绑定已随该区块一并删除（见页尾说明）。 */
  }

  /* ---------- ③ 总装图节点渲染 ---------- */
  function bindAssembly() {
    var map = $("home-assembly");
    if (!map) return;
    var brain =
      '<div class="node node-brain" data-sec="playground" role="button" tabindex="0">' +
        '<div class="nicon">' + U.icon("brain", 24) + '</div>' +
        '<div class="nhead"><span class="nname">大语言模型「大脑」</span><span class="nanalogy">像大脑</span></div>' +
        '<div class="nen">LLM · 决策内核</div>' +
        '<div class="njob">读懂上下文、决定下一步、组织回答。</div>' +
        '<div class="go">进入智能体实验室 →</div>' +
      '</div>';
    var nodes = NODES.map(function (n) {
      return '<div class="node node-' + n.color + '" data-sec="' + n.sec + '" role="button" tabindex="0">' +
        '<div class="nicon">' + U.icon(n.icon, 24) + '</div>' +
        '<div class="nhead"><span class="nname">' + n.name + '</span><span class="nanalogy">' + n.analogy + '</span></div>' +
        '<div class="nen">' + n.en + '</div>' +
        '<div class="njob">' + n.job + '</div>' +
        '<div class="go">进入' + n.name + '实验室 →</div>' +
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
    var slotNames = { top: "上方（像眼睛）", left: "左方（像小本子）", bottom: "下方（像大脑的决策参谋）", right: "右方（像手）", center: "中间（大脑）" };

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
        var slotLabel = { top: "上方 · 眼睛", left: "左方 · 小本子", center: "中间 · 大脑", right: "右方 · 手", bottom: "下方 · 决策参谋" }[slot.getAttribute("data-slot")];
        slot.innerHTML = '<span class="ag-slot-label">' + slotLabel + '</span>';
      });
      placed = 0;
      selectedPiece = null;
      status.textContent = "先点击一个组件卡片";
      status.className = "ag-status-text";
    });
  }

  /* ---------- ⑥ 组件抢答 ---------- */
  /* ---------- ⑥ 组件抢答（单题闯关，保留组件配色） ---------- */
  function bindQuick() {
    var compMeta = {
      "感知器": { icon: "eye", color: "per" },
      "规划器": { icon: "gear", color: "plan" },
      "记忆器": { icon: "book", color: "mem" },
      "执行器": { icon: "hand", color: "exe" }
    };
    AgentLab.Quiz.mount({
      host: "home-quick-body",
      color: "brain",
      name: "组件小达人",
      bar: "qg-progress-bar",
      count: "qg-count",
      star: "home-quick-score",
      restart: "qg-restart",
      optsCls: "qg-opts",
      questions: QUICK_Q.map(function (item) {
        return {
          q: item.q,
          opts: Object.keys(compMeta).map(function (comp) {
            var m = compMeta[comp];
            return {
              html: '<span class="qg-opt-icon">' + U.icon(m.icon, 22) + '</span><span class="qg-opt-text">' + comp + '</span>',
              key: comp,
              cls: "qg-opt qg-opt-" + m.color
            };
          }),
          ans: item.comp,
          why: item.why
        };
      }),
      hint: "想一想：这是在“接收信息”“做计划”“记东西”，还是“动手做事”？"
    });
  }

  /* ---------- ⑧ 智能客服示范拆解 ---------- */

  /* 单个步骤卡的 HTML：初始「用户提问」与后续拆解步骤共用，保证结构一致 */
  function dfStepHTML(s) {
    if (s.user) {
      return '<div class="df-step df-step-user">' +
        '<div class="df-num">' + U.icon("user", 15) + '</div>' +
        '<div class="df-content">' +
          '<div class="df-title">用户提问</div>' +
          '<div class="df-msg user-msg">' + s.msg + '</div>' +
        '</div>' +
      '</div>';
    }
    return '<div class="df-step df-step-' + s.color + '">' +
      '<div class="df-num">' + s.num + '</div>' +
      '<div class="df-content">' +
        '<div class="df-title">' + U.icon(s.icon, 15) + ' ' + s.title +
          '<span class="df-comp-tag df-comp-' + s.color + '">' + s.comp + '</span></div>' +
        (s.q ? '<div class="df-q">' + s.q + '</div>' : '') +
        '<div class="df-desc">' + s.desc + '</div>' +
        '<div class="df-msg ai-msg">' + s.msg + '</div>' +
      '</div>' +
    '</div>';
  }

  function bindDemoFlow() {
    var steps = [
      { num: 1, title: "感知器工作", comp: "感知器", color: "per", icon: "eye",
        q: "拆解四问 ①：它听到了什么？",
        desc: "接收用户文字输入“我的快递到哪了”，理解用户意图",
        msg: "感知器：收到用户输入“我的快递到哪了”，转化为 AI 能理解的文字" },
      { num: 2, title: "规划器工作", comp: "规划器", color: "plan", icon: "gear",
        q: "拆解四问 ②：它怎么安排步骤？",
        desc: "判断需要查询订单 → 决定调用订单查询工具 → 组织回答结构",
        msg: "规划器：用户问快递状态 → 需要查询订单 → 决定调用订单查询工具" },
      { num: 3, title: "记忆器工作", comp: "记忆器", color: "mem", icon: "book",
        q: "拆解四问 ③：它记得你的上次提问吗？",
        desc: "调取用户账号信息（知道是哪个用户的订单），记住对话历史",
        msg: "记忆器：调取用户账号信息 → 确认用户身份 → 关联到该用户的订单" },
      { num: 4, title: "执行器工作", comp: "执行器", color: "exe", icon: "hand",
        q: "拆解四问 ④：它调用了什么工具？",
        desc: "调用订单查询 API，返回“快递已到北京转运中心”",
        msg: "执行器：调用订单查询 API → 返回“快递已到北京转运中心，预计明天送达”" },
      { num: 5, title: "大语言模型组织回答", comp: "大语言模型", color: "brain", icon: "brain",
        q: "收尾：把工具查到的结果，变成一句“人话”",
        desc: "基于工具返回的真实结果，组织自然语言回答给用户",
        msg: "大语言模型：基于工具结果组织回答 → “你的快递已到北京转运中心，预计明天送达！”" }
    ];
    var cur = 0;
    var flow = $("demo-flow");
    var status = $("df-status");
    var progress = $("df-progress");
    var nextBtn = $("df-next");

    /* 进度点：5 个圆点，走完一步点亮一个，颜色与该步骤的组件色一致 */
    function renderProgress(n) {
      if (!progress) return;
      var html = "";
      for (var i = 0; i < steps.length; i++) {
        html += '<span class="df-pdot' + (i < n ? ' is-done df-pdot-' + steps[i].color : '') + '"></span>';
      }
      progress.innerHTML = html;
    }
    renderProgress(0);

    nextBtn.addEventListener("click", function () {
      if (cur >= steps.length) return;
      var holder = document.createElement("div");
      holder.innerHTML = dfStepHTML(steps[cur]);
      flow.appendChild(holder.firstChild);
      cur++;
      renderProgress(cur);
      if (cur < steps.length) {
        status.textContent = "已拆解 " + cur + "/" + steps.length + " 步，继续点「下一步」";
      } else {
        status.innerHTML = '<span class="df-done">✓ 拆解完成！四大组件 + 大脑全部定位！</span>';
        nextBtn.disabled = true;
        U.toast("智能客服拆解完成！", "success");
      }
      flow.scrollTop = flow.scrollHeight;
    });

    $("df-reset").addEventListener("click", function () {
      cur = 0;
      flow.innerHTML = dfStepHTML({ user: true, msg: "我的快递到哪了？" });
      renderProgress(0);
      nextBtn.disabled = false;
      status.textContent = "点“下一步”，开始逐环节拆解";
    });
  }

  /* ---------- ⑨ 真实案例拆解库 ---------- */
  function bindCases() {
    var tabs = document.querySelectorAll("#case-tabs .case-tab");
    var content = $("case-content");

    /* 组件长文本 → 列表：优先按 ①②③… / 第N步 拆分，其次按「；」拆分 */
    function splitItems(text) {
      var t = String(text || "").replace(/\s*（ai-agent-book[^）]*）/g, "").trim();
      var parts = t.split(/(?=[①②③④⑤⑥⑦⑧⑨⑩]|第[一二三四五六七八九十]步)/);
      if (parts.length < 2) parts = t.split("；");
      return parts.map(function (x) {
        return x.trim().replace(/[；。：:]+$/, "");
      }).filter(function (x) {
        return x.length > 1;
      }).map(function (x) {
        return "<li>" + x + "</li>";
      }).join("");
    }

    /* 「案例出处」拆成 出处代码标签 + 说明 两段 */
    function refHTML(ref) {
      var m = String(ref || "").match(/^([^—]+)—\s*(.+)$/);
      if (!m) return '<span class="case-ref-txt">' + ref + '</span>';
      return '<code class="case-ref-src">' + m[1].trim() + '</code>' +
        '<span class="case-ref-txt">' + m[2].trim() + '</span>';
    }

    function renderCase(idx) {
      var c = CASES[idx];
      var comps = [
        ["per", "eye", "感知器", "① 它听到了什么？", c.perception],
        ["plan", "gear", "规划器", "② 它怎么安排步骤？", c.planner],
        ["mem", "book", "记忆器", "③ 它记得你的上次提问吗？", c.memory],
        ["exe", "hand", "执行器", "④ 它调用了什么工具？", c.executor]
      ];
      content.innerHTML =
        '<div class="case-header">' +
          '<div class="case-icon">' + U.icon(c.icon, 26) + '</div>' +
          '<div class="case-head-txt">' +
            '<div class="case-name">' + c.name + '</div>' +
            '<div class="case-desc">' + c.desc + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="case-components">' +
          comps.map(function (x) {
            return '<div class="cc-item cc-' + x[0] + '">' +
              '<div class="cc-head"><span class="cc-ico">' + U.icon(x[1], 15) + '</span>' + x[2] +
                '<span class="cc-q">' + x[3] + '</span></div>' +
              '<ul class="cc-list">' + splitItems(x[4]) + '</ul>' +
            '</div>';
          }).join("") +
        '</div>' +
        '<div class="case-ref">' + U.icon("book", 14) + refHTML(c.aiagentbook) + '</div>';
      /* 重播切换动画（移除→强制回流→重新加类） */
      content.classList.remove("is-swap");
      void content.offsetWidth;
      content.classList.add("is-swap");
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
  /* ---------- ⑪ 小测验（单题闯关，保留题号字母样式） ---------- */
  function bindQuiz() {
    var LETTERS = "ABCDEF";
    AgentLab.Quiz.mount({
      host: "home-quiz-body",
      color: "brain",
      name: "架构小达人",
      bar: "qz-progress-bar",
      count: "qz-count",
      star: "home-quiz-score",
      restart: "home-quiz-restart",
      result: "qz-result",
      optsCls: "qz-opts",
      questions: QUIZ.map(function (item) {
        return {
          q: item.q,
          opts: item.opts.map(function (opt, oi) {
            return {
              html: '<span class="qz-opt-letter">' + LETTERS.charAt(oi) + '</span><span class="qz-opt-text">' + opt + '</span>',
              key: oi,
              cls: "qz-opt"
            };
          }),
          ans: item.ans,
          why: item.why
        };
      }),
      hint: "再想想——可以回到上面的总装图、核心公式和拆解四问里找线索。"
    });
  }

  /* ---------- ⑫ 进阶原理：互动课堂绑定（与其他实验室同引擎） ---------- */
  function bindAdvClassroom() {
    if (!AgentLab.Adv) return;
    AgentLab.Adv.bind($("sec-home"), { key: "brain", concepts: BRAIN_CONCEPTS, color: "brain" });
  }

  /* ---------- 深度拆解模块：内导览点击直达 ---------- */
  function bindCbToc() {
    var sec = $("sec-home");
    if (!sec) return;
    sec.querySelectorAll(".cb-toc-chip").forEach(function (b) {
      b.addEventListener("click", function () {
        var el = document.getElementById(b.getAttribute("data-cb"));
        if (!el || typeof el.scrollIntoView !== "function") return;
        var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        try {
          el.scrollIntoView(reduce ? { block: "start" } : { behavior: "smooth", block: "start" });
        } catch (e) { el.scrollIntoView(); }
      });
    });
  }

  /* ---------- 初始化 ---------- */
  function init() {
    render();
  }

  return { init: init, render: render };
})();
