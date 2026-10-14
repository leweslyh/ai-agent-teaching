/* ============================================================
 * config.js —— 教学系统配置
 * 这里集中管理：API 密钥、模型、班级知识库默认值、
 * 天气辅助函数（真实数据由 api.js 联网获取）、以及四大组件的文案。
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

AgentLab.CONFIG = {
  /* ---------- DeepSeek API（静态版：浏览器直连，Key 由用户输入） ---------- */
  apiKey: "",
  model: "deepseek-v4-flash",
  temperature: 0.7,
  /* 单次回复的长度上限。原来是 1200，会把“一步一步推理”的长回答中途切断
   * （思维链要写 7 步推导 + 多位数竖式，1200 不够），导致最后那句“答案”根本没写出来。
   * 这里放宽到 4000；个别模块（如思维链实验）还会再单独调大。 */
  maxTokens: 4000,
  deepseekUrl: "https://api.deepseek.com/chat/completions",
  /* DeepSeek 新版 Responses 接口（联网搜索 web_search 只在这条链路上声明；
   * chat/completions 不支持。注意：接口对不支持的内置工具会“静默忽略”，
   * 所以 api.js 里的判定标准是“响应里真的出现了搜索痕迹”，否则当作没搜到。 */
  responsesUrl: "https://api.deepseek.com/responses",
  /* DeepSeek 服务端联网搜索开关。
   * 实测（2026-10，Key 有效）：/responses 会静默忽略 web_search 工具（模型自己在思维链里
   * 说“我没有联网工具”），/chat/completions 直接 422——所以这条路当前走不通，
   * 系统会自动落到“必应 RSS → 大模型已有知识兜底”。
   * 保留开关的原因：一旦 DeepSeek 侧放开，改回 true 即可启用；
   * 即便开着，代码也只在响应里真出现搜索痕迹时才认账，不会把模型的话冒充成搜索结果。 */
  deepseekWebSearch: true,

  /* ---------- 云端能力（感知器实验室用；均为 OpenAI 兼容接口） ----------
   * 默认服务商：硅基流动 SiliconFlow。
   * 关键点：语音识别（ASR）与图片识别（OCR）共用同一个 API Key，
   * 用户只需在“设置”里填一次。密钥保存在本机浏览器，浏览器直连服务商。
   * 未配置密钥或无法联网时，实验室自动降级为“示例演示”继续教学。 */
  cloud: {
    provider: "硅基流动 SiliconFlow",
    url: "https://api.siliconflow.cn/v1",       // OpenAI 兼容根地址
    key: "",                                    // 由用户在“设置”中输入
    signupUrl: "https://cloud.siliconflow.cn/",
    /* Token 化实验的“真实分词计数”用这个 LLM：
     * 走 chat 接口的 usage.prompt_tokens，自动扣除对话模板的固定开销后
     * = 输入文本本身的真实 Token 数。这类分词器对中文做过词级合并，
     * 和课堂讲的 DeepSeek 口径一致（“人工智能”≈1~2 个 Token）。
     * 选免费模型即可（每次调用只有几个 Token 的开销） */
    tokenChatModel: "Qwen/Qwen2.5-7B-Instruct"
  },

  /* ---------- 「思维链（CoT）」实验专用：硅基流动的小模型 ----------
   * 为什么单独用？因为现在的大模型太聪明，两种问法都答得对，看不出差距。
   * 小模型不落笔就更容易翻车，对比效果明显得多。
   * 注意：这一项<b>不出现在系统设置里</b>——老师只要填好「云端能力密钥」即可，
   * 实验模块内部自己调用，不需要任何额外配置。 */
  cotModel: {
    provider: "硅基流动 SiliconFlow",
    url: "https://api.siliconflow.cn/v1/chat/completions",
    model: "Qwen/Qwen2.5-7B-Instruct",   // 7B 小模型：多步推理不写过程容易错
    label: "硅基流动小模型（7B）"
  },

  /* 语音识别 ASR：音频 → 文字 */
  asr: {
    model: "FunAudioLLM/SenseVoiceSmall",
    url: "https://api.siliconflow.cn/v1/audio/transcriptions",
    maxSeconds: 30        // 单次录音上限，防止无意长录
  },

  /* 图片识别 OCR：图像 → 文字（用视觉大模型，比传统 OCR 更准）
   * models 是"按序兜底"清单：主模型被平台下线（接口返回 400 Model does not exist）
   * 时，api.js 会自动换下一个备用模型重试，课堂演示就不会因单个模型下线而必失败。
   * 当前平台可用（2026-10 实测）：
   *   Qwen/Qwen3-VL-8B-Instruct      快、便宜，推荐课堂使用 ← 主用
   *   Qwen/Qwen3-VL-30B-A3B-Instruct 更强，单价更高
   *   PaddlePaddle/PaddleOCR-VL-1.5  专门做 OCR
   * 换模型后若报 Model does not exist，可访问
   *   GET https://api.siliconflow.cn/v1/models
   * 查询当前可用清单（需要带 Bearer 密钥）。 */
  ocr: {
    /* 按序兜底清单（前面的失败自动换下一个，全部失败才降级示例演示）：
     *   字符串条目 = 硅基流动模型（用「云端能力密钥」）；
     *   对象条目   = 指定服务商（keyFrom:"main" 表示用「DeepSeek 主密钥」）。
     * DeepSeek V4.1 Flash（2026-09 发布）原生支持视觉理解，走 OpenAI 兼容
     * 格式 + base64 图片，作为硅基流动全线不可用时的最终兜底。 */
    models: [
      "PaddlePaddle/PaddleOCR-VL-1.5",
      "Qwen/Qwen3-VL-8B-Instruct",
      "Qwen/Qwen3-VL-30B-A3B-Instruct",
      "deepseek-ai/DeepSeek-OCR",
      { model: "deepseek-v4.1-flash", url: "https://api.deepseek.com/chat/completions", keyFrom: "main", label: "DeepSeek V4.1 Flash（DeepSeek 官方）" }
    ],
    model: "PaddlePaddle/PaddleOCR-VL-1.5",   // 主模型（兼容旧读取处，与 models 第一位一致）
    url: "https://api.siliconflow.cn/v1/chat/completions",
    maxSide: 1024         // 上传前把长边压到该像素内——过大图的 base64 请求体（可达 1MB+）
                          // 在部分网络环境下会被掐断（超时/Failed to fetch），1024 对课堂 OCR 足够清晰
  },

  /* ---------- 天气默认城市 ---------- */
  defaultCity: "北京",

  /* ---------- 默认班级知识库（学生可随时在“记忆器”里修改） ---------- */
  defaultClassInfo: {
    className: "五年级（2）班",
    slogan: "快乐学习，天天向上",
    schedule: "今天下午有体育课和美术课",
    duty: "今天是小红和小明值日",
    dutyRule: "值日按学号轮流，每人一周一次",
    notice: "下周二开家长会，请提醒爸爸妈妈准时参加",
    teacher: "王老师"
  },

  /* ---------- 默认《班级小管家说明书》 ---------- */
  defaultManual: {
    know: "我知道我们班的课表、值日表和班级通知。",
    notKnow: "我不知道同学们的家庭住址、电话号码、身份证号等隐私信息。",
    speak: "我要用五年级学生听得懂的话回答，语气清晰专业但不枯燥，回答简短有逻辑；不知道的事情就直说“这个我不知道”，绝不编造。"
  },

  /* ---------- 工具开关（默认全开） ---------- */
  defaultTools: {
    weather: true,      // 天气查询
    calc: true,         // 计算器
    remind: true,       // 提醒
    classInfo: true,    // 课表查询（班级知识库）
    search: true,       // 联网搜索
    translate: true,    // 翻译
    convert: true,      // 单位换算
    datetime: true,     // 时间日期
    shape: true,        // 图形计算（面积/周长/体积）
    math: true,         // 数学计算（百分数/折扣/平均数）
    timer: true         // 计时器（倒计时/番茄钟）
  }
};

/* ---------- 天气：真实数据（Open-Meteo，免费、无需 Key、支持 CORS）
 * 不再使用模拟数据。由 js/api.js 的 AgentLab.API.getWeather() 联网获取，
 * 这里只提供三个纯函数：WMO 天气码转文字、风速转风力、日期偏移换算。 ---------- */

/* WMO 天气码 → [中文描述, 是否为降水] */
AgentLab.WMO_TEXT = {
  0: ["晴", false], 1: ["晴间多云", false], 2: ["多云", false], 3: ["阴", false],
  45: ["有雾", false], 48: ["雾凇", false],
  51: ["小毛毛雨", true], 53: ["毛毛雨", true], 55: ["大毛毛雨", true],
  56: ["冻毛毛雨", true], 57: ["强冻毛毛雨", true],
  61: ["小雨", true], 63: ["中雨", true], 65: ["大雨", true],
  66: ["冻雨", true], 67: ["强冻雨", true],
  71: ["小雪", true], 73: ["中雪", true], 75: ["大雪", true], 77: ["雪粒", true],
  80: ["小阵雨", true], 81: ["阵雨", true], 82: ["强阵雨", true],
  85: ["小阵雪", true], 86: ["大阵雪", true],
  95: ["雷阵雨", true], 96: ["雷阵雨伴小冰雹", true], 99: ["雷阵雨伴大冰雹", true]
};
AgentLab.wmoText = function (code) {
  var v = AgentLab.WMO_TEXT[code];
  return v ? { text: v[0], isRain: v[1] } : { text: "未知天气", isRain: false };
};

/* 风速（km/h）→ 风力等级（近似蒲福风级） */
AgentLab.windLevel = function (kmh) {
  var t = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  var lv = 0;
  for (var i = 0; i < t.length; i++) { if (kmh >= t[i]) lv = i + 1; }
  return lv + "级";
};

/* 把“今天/明天/后天/周末/下周……”换算成距今天数 */
AgentLab.dayOffset = function (dateKey) {
  var now = new Date();
  if (dateKey === "明天" || dateKey === "明早" || dateKey === "明晚") return { offset: 1, label: dateKey };
  if (dateKey === "后天") return { offset: 2, label: "后天" };
  if (dateKey === "周末") {
    var d = (6 - now.getDay() + 7) % 7;
    return { offset: d, label: "周末（周六）" };
  }
  if (dateKey === "下周") return { offset: 7, label: "下周同期" };
  return { offset: 0, label: "今天" };
};

/* 根据真实天气给出生活建议 */
AgentLab.weatherSuggest = function (cond, isRain, tHigh, tLow) {
  if (isRain) {
    if (cond.indexOf("雪") >= 0) return "有雪，注意保暖防滑，出门穿厚外套和防滑的鞋子";
    return "有降水，记得带伞，最好穿防水的外套和防滑的鞋子";
  }
  if (tHigh >= 30) return "天气热，穿短袖就行，记得多喝水、注意防晒";
  if (tLow <= 5) return "比较冷，建议穿羽绒服或厚外套，注意保暖";
  if (tLow <= 12) return "早晚有点凉，建议穿长袖加一件薄外套";
  return "温度舒适，穿短袖或薄长袖都可以";
};

/* 智能体提示词模板（含班级知识库与说明书边界）
 * 教学口径（全站统一，勿改）：
 *   · “规划器”是交给大脑的一项【决策职责】：拆解 / 排序 / 选工具，每一轮都参与，
 *     产出是动作（assistant 消息里的 tool_calls），不是“思考模式”。
 *   · “思考模式”是大模型的【能力开关】：只决定要不要把推理过程（reasoning_content）
 *     写出来，与规划器无关——关掉它，规划照常发生，只是看不见推理过程。
 *   · 长期记忆档案（班级知识库、边界说明书）随 system 一起给模型——记忆本身不是
 *     第五种角色，它是“借”system 这个角色放进上下文的；短期对话按 user/assistant
 *     原样回放；工具结果走 tool 角色；更大的知识库则走 RAG：检索出的片段随 user
 *     消息一起给（见记忆器实验室）。 */
/* 当前时间行：同学说“今天 / 明天 / 后天 / 周末”时，模型才知道相对哪一天。
 * 少了它，问“明天会下雨吗”连“明天”是几号都只能靠猜——真实 Harness 都会注入。
 * 抽成公共函数：默认「智能体小管家」与「作品展示」里两个作品都复用它，口径一致。 */
AgentLab.nowLine = function () {
  var now = new Date();
  var wkCN = ["日", "一", "二", "三", "四", "五", "六"];
  var pad2 = function (n) { return (n < 10 ? "0" : "") + n; };
  return "【当前时间】现在是 " + now.getFullYear() + "年" + (now.getMonth() + 1) + "月" + now.getDate() +
    "日 星期" + wkCN[now.getDay()] + " " + pad2(now.getHours()) + ":" + pad2(now.getMinutes()) +
    "——同学说“今天 / 明天 / 后天 / 周末”时，按这个日期换算。";
};

/* 班级知识库是否真的有内容（决定 prompt 里是给出内容还是“小本子是空的”）。 */
AgentLab.hasClassInfo = function (classInfo) {
  return !!(classInfo && ["className", "slogan", "schedule", "duty", "dutyRule", "notice", "teacher"]
    .some(function (k) { return classInfo[k] && String(classInfo[k]).trim(); }));
};

AgentLab.buildSystemPrompt = function (classInfo, manual) {
  var kb = AgentLab.formatClassInfo(classInfo);
  var hasKb = AgentLab.hasClassInfo(classInfo);
  var nowLine = AgentLab.nowLine();
  var lines = [
    "你是一个帮助小学生学习 AI 的“智能体小管家”（同学们在界面上就叫你这个名字）。",
    "你由一个“大脑”（大语言模型）和四大组件协作完成一件事：感知器（听懂问题）、规划器（决定怎么做）、记忆器（记住信息）、执行器（调用工具去做）。",
    "其中的“规划器”是你的一项决策职责：理解意图 → 拆解任务 → 排出先后顺序 → 选择工具，每一步拿到结果后再决定下一步，每一轮都要参与。",
    "注意：“规划器”和“思考模式”是两回事——思考模式只决定你要不要把推理过程写出来；就算不写，规划这件事该做还是要做（该拆步就拆步，该调工具就调工具）。",
    "你的工具包括：天气查询、计算器、提醒、班级课表查询、联网搜索、翻译、单位换算、时间日期、图形计算、数学计算、计时器。",
    nowLine,
    "",
    "【班级知识库】（来自记忆器的长期记忆）",
    hasKb ? kb : "（长期记忆小本子现在是空的——你不记得班级的任何事）",
    // null 表示“这一行不放”，最后统一过滤掉（避免留下多余空行）
    hasKb ? "（同学问班级的事——课表、值日、通知、班名、班主任、口号——就从这里找答案；这里没有的就直说不确定，别编造。）" : null,
    "",
    "【边界说明书】（知道什么 / 不知道什么 / 该怎么说话）",
    "我" + (manual && manual.know ? "知道" : "不知道") + "：" + (manual ? (manual.know || "略") : "略"),
    "我不知道：" + (manual ? (manual.notKnow || "同学的隐私信息") : "同学的隐私信息"),
    "该怎么说话：" + (manual ? (manual.speak || "简短清楚，学生听得懂") : "简短清楚，学生听得懂"),
    "",
    "【做事方式】（规划器怎么工作——先做什么、再做什么）",
    "1. 先读懂同学真正想要什么，再决定怎么做；不要一上来就调工具。",
    "2. 一件事要好几步才能完成时（例如“看明天会不会下雨，要下雨就提醒我带伞，再算一下一共多少钱”），先把任务拆成几步、排出先后顺序，再一步一步做。",
    "3. 每一步都先调用需要的工具、拿到结果，再看结果决定下一步；不要跳过中间结果硬猜。",
    "4. 有步骤要依赖前面结果时（例如“下雨才提醒”），必须等前面那一步的结果出来，再决定要不要做。",
    "5. 信息不够就先反问同学补齐（例如“要计多少分钟”），不要自己替他定。",
    "6. 所有步骤做完后，把结果汇总成一段简短的话回答同学。",
    "",
    "【回答要求】",
    "1. 用五年级学生听得懂的话回答，清晰专业但不幼稚，语气友好、有逻辑。",
    "2. 回答尽量简洁（一般 2~4 句话），先说结论，再给依据。",
    "3. 如果通过工具查到了信息（如天气、计算结果、搜索结果、译文、换算结果），要明确告诉同学“我查到了：……”再给出答案或建议。",
    "4. 不知道的事情要直说“这个我不知道”，绝不编造。",
    "5. 如果同学的问题涉及家庭住址、电话号码等隐私，要提醒他：不要把隐私告诉 AI。",
    "6. 当使用联网搜索工具时，基于搜索结果回答，并可以说“这是我在网上查到的”。",
    "7. 同学要计时、倒计时、番茄钟但没说要计多久时，用反问补齐（例如“要计多少分钟？比如25分钟”），不要自己替他定一个时长。"
  ];
  return lines.filter(function (l) { return l !== null; }).join("\n");
};

/* 把班级信息格式化成知识库文本 */
AgentLab.formatClassInfo = function (info) {
  info = info || AgentLab.CONFIG.defaultClassInfo;
  return [
    "班名：" + (info.className || ""),
    "班级口号：" + (info.slogan || ""),
    "课程表：" + (info.schedule || ""),
    "值日安排：" + (info.duty || "") + "；规则：" + (info.dutyRule || ""),
    "班级通知：" + (info.notice || ""),
    "班主任：" + (info.teacher || "")
  ].join("\n");
};

/* ============================================================
 * 作品档案（AgentLab.WORKS）——「作品展示」栏目专用
 * ------------------------------------------------------------
 * 每个作品 = 一个真正能跑的智能体：一份专属系统提示词 + 一套专属工具子集。
 *   · lab-works.js 只负责「渲染」这些数据（简介 / 制作步骤 / 原理 / 示例场景）；
 *   · agent.js 的 run(userText, history, hooks, profile) 负责「执行」——接真实大模型。
 * 想再加一个作品？在 WORKS 里加一条即可，页面会自动多出一个作品板块。
 * ============================================================ */

/* 公共「做事方式 / 回答要求」段落：与默认小管家口径一致，避免各作品各说一套。 */
AgentLab.workCommonRules = function () {
  return [
    "",
    "【做事方式】（规划器怎么工作——先做什么、再做什么）",
    "1. 先读懂同学真正想要什么，再决定怎么做；不要一上来就调工具。",
    "2. 一件事要好几步才能完成时（例如“看明天会不会下雨，要下雨就提醒我带伞，再算一下一共多少钱”），先把任务拆成几步、排出先后顺序，再一步一步做。",
    "3. 每一步都先调用需要的工具、拿到结果，再看结果决定下一步；不要跳过中间结果硬猜。",
    "4. 有步骤要依赖前面结果时（例如“下雨才提醒”），必须等前面那一步的结果出来，再决定要不要做。",
    "5. 信息不够就先反问同学补齐（例如“要计多少分钟”），不要自己替他定。",
    "6. 所有步骤做完后，把结果汇总成一段简短的话回答同学。",
    "",
    "【回答要求】",
    "1. 用五年级学生听得懂的话回答，清晰专业但不幼稚，语气友好、有逻辑。",
    "2. 回答尽量简洁（一般 2~4 句话），先说结论，再给依据。",
    "3. 如果通过工具查到了信息（如天气、计算结果、搜索结果、译文、换算结果），要明确告诉同学“我查到了：……”再给出答案或建议。",
    "4. 不知道的事情要直说“这个我不知道”，绝不编造。",
    "5. 如果同学的问题涉及家庭住址、电话号码等隐私，要提醒他：不要把隐私告诉 AI。",
    "6. 当使用联网搜索工具时，基于搜索结果回答，并可以说“这是我在网上查到的”。",
    "7. 同学要计时、倒计时、番茄钟但没说要计多久时，用反问补齐（例如“要计多少分钟？比如25分钟”），不要自己替他定一个时长。"
  ];
};

/* 由「作品数据 + 班级知识库 + 公共规则」组装出一段完整的系统提示词。
 * classInfo / manual 来自记忆器（localStorage），由 agent.js 在运行时注入。 */
AgentLab.buildWorkPrompt = function (work, classInfo, manual) {
  var kb = AgentLab.formatClassInfo(classInfo);
  var hasKb = AgentLab.hasClassInfo(classInfo);
  var lines = [
    work.roleIntro,
    "你由一个“大脑”（大语言模型）和四大组件协作完成一件事：感知器（听懂问题）、规划器（决定怎么做）、记忆器（记住信息）、执行器（调用工具去做）。",
    "其中的“规划器”是你的一项决策职责：理解意图 → 拆解任务 → 排出先后顺序 → 选择工具，每一步拿到结果后再决定下一步，每一轮都要参与。",
    "注意：“规划器”和“思考模式”是两回事——思考模式只决定你要不要把推理过程写出来；就算不写，规划这件事该做还是要做（该拆步就拆步，该调工具就调工具）。",
    "你的工具包括：" + work.toolLine + "。",
    work.scopeNote,
    AgentLab.nowLine()
  ];
  if (work.usesClassKB) {
    lines.push(
      "",
      "【班级知识库】（来自记忆器的长期记忆）",
      hasKb ? kb : "（长期记忆小本子现在是空的——你不记得班级的任何事）",
      hasKb ? "（同学问班级的事——课表、值日、通知、班名、班主任、口号——就从这里找答案；这里没有的就直说不确定，别编造。）" : null
    );
  }
  lines.push(
    "",
    "【边界说明书】（知道什么 / 不知道什么 / 该怎么说话）",
    "我" + (manual && manual.know ? "知道" : "不知道") + "：" + (manual ? (manual.know || "略") : "略"),
    "我不知道：" + (manual ? (manual.notKnow || "同学的隐私信息") : "同学的隐私信息"),
    "该怎么说话：" + (manual ? (manual.speak || "简短清楚，学生听得懂") : "简短清楚，学生听得懂")
  );
  return lines.concat(AgentLab.workCommonRules())
    .filter(function (l) { return l !== null; }).join("\n");
};

AgentLab.WORKS = {
  /* ===================== 作品一：班级小助手 ===================== */
  classAssistant: {
    id: "classAssistant",
    name: "班级小助手",
    badge: "作品一",
    icon: "book",
    avatar: "user",
    accent: "works",
    tagline: "记住班里的事，帮同学查课表、做提醒",
    /* —— 简介 —— */
    intro: {
      what: "班级小助手是一个专门服务班级的智能体。它把班级的课表、值日、通知都记在“长期记忆”里，同学问什么、要提醒什么，它都能接住。",
      forWho: "给全班同学用：记不清课表、怕忘带东西、想找人帮忙算一算，都可以问它。",
      can: [
        "查课表：今天下午有哪几节课、明天第一节是什么",
        "记提醒：提醒我明天带美术工具",
        "算一算：作业分数、买东西一共多少钱",
        "查班级的事：值日怎么轮、最近有什么通知"
      ]
    },
    /* —— 执行用：系统提示词 + 工具子集 —— */
    toolKeys: ["classInfo", "remind", "timer", "calc", "datetime", "translate", "search"],
    toolLine: "班级课表查询、提醒、计时器、计算器、时间日期、翻译、联网搜索",
    roleIntro: "你是“班级小助手”，一个专门帮助五年级同学管理班级事务的智能体（同学们在界面上就叫你这个名字）。",
    scopeNote: "注意：天气查询、单位换算、图形计算这些不在你的本领里——遇到就如实告诉同学“这不在我的本领里，去问出行小管家更合适”。",
    usesClassKB: true,
    /* —— 演示区 —— */
    greeting: "我是班级小助手。班里的事——课表、值日、通知、提醒——都可以问我。",
    suggestions: [
      "今天下午有什么课？",
      "提醒我明天带美术工具",
      "帮我算 25×4+10 等于多少",
      "这周的值日是怎么轮的？"
    ],
    principleNote: "你问的每句话，都先过感知器→再由规划器决定“查课表还是设提醒”→去记忆器取班级知识、或让执行器调工具→最后组织成回答。",
    /* —— 制作过程（分步骤图解） —— */
    steps: [
      { icon: "target", title: "定目标", text: "先想清楚它要帮同学做什么：管好班里的事——查课表、做提醒、算算数。目标越具体，后面越好做。" },
      { icon: "eye", title: "配感知器", text: "接上一个“会听话”的感知器：把同学打的字（以后还能加语音）变成大模型能读懂的输入。" },
      { icon: "pen", title: "写系统提示词", text: "给大脑写一份“岗位说明书”：它是班级小助手、只服务班级事务、该用哪几个工具、说话要简短清楚。" },
      { icon: "wrench", title: "装工具", text: "给执行器装上趁手的工具：课表查询、提醒、计时器、计算器、时间日期、翻译、搜索，一个一个接好。" },
      { icon: "database", title: "接记忆", text: "把班级知识库（课表、值日、通知）放进记忆器的长期记忆里，让它“记得住班级的事”。" },
      { icon: "check", title: "联调测试", text: "一句一句地试：课表问得对不对？提醒设得准不准？越界的问题会不会老实拒答？发现问题就回去改提示词。" }
    ],
    /* —— 原理拆解（对照四大组件） —— */
    principles: [
      { comp: "感知器", icon: "eye", color: "per", text: "同学的每一句话先经过它：分词、算 Token，把“今天下午有什么课”变成模型能读的输入。" },
      { comp: "规划器", icon: "gear", color: "plan", text: "它决定怎么做：听懂“查课表”这个意图、选出课表工具；一句话里有两件事时，就先拆步再排顺序。" },
      { comp: "记忆器", icon: "book", color: "mem", text: "班级知识库就存在这里：课表、值日、通知都在长期记忆里，同学一问就能取出来。" },
      { comp: "执行器", icon: "hand", color: "exe", text: "它负责动手：真正去“查课表”“设提醒”“按计算器”，把结果交回给大脑组织成回答。" }
    ]
  },

  /* ===================== 作品二：出行小管家 ===================== */
  travelAssistant: {
    id: "travelAssistant",
    name: "出行小管家",
    badge: "作品二",
    icon: "plane",
    avatar: "plane",
    accent: "works",
    tagline: "出门先看天，帮你查天气、算路程、做提醒",
    /* —— 简介 —— */
    intro: {
      what: "出行小管家是一个专门服务“出门与旅行”的智能体。出门前帮你查天气、算路程、换算单位，需要时还能记一条件提醒（比如“下雨就带伞”）。",
      forWho: "给要出门、要旅行的同学和家人用：春游、上学路上、假期出行前的准备，都可以问它。",
      can: [
        "查天气：明天杭州会下雨吗、要不要带伞",
        "算路程与费用：5 公里等于多少米、打车大概多少钱",
        "换算单位：摄氏度转华氏度、公里转英里",
        "做提醒：出门前提醒我带水壶"
      ]
    },
    /* —— 执行用：系统提示词 + 工具子集 —— */
    toolKeys: ["weather", "convert", "datetime", "calc", "remind", "timer", "search"],
    toolLine: "天气查询、单位换算、时间日期、计算器、提醒、计时器、联网搜索",
    roleIntro: "你是“出行小管家”，一个专门帮助五年级同学准备出门与旅行的智能体（同学们在界面上就叫你这个名字）。",
    scopeNote: "注意：班级课表、班级值日、班级通知这些不在你的本领里——遇到就如实告诉同学“这不在我的本领里，去问班级小助手更合适”。",
    usesClassKB: false,
    /* —— 演示区 —— */
    greeting: "我是出行小管家。出门前的事——看天气、算路程、换单位、做提醒——都可以问我。",
    suggestions: [
      "明天杭州会下雨吗？要不要带伞",
      "5 公里等于多少米？",
      "从上海到北京坐高铁大概要多久？",
      "提醒我出门前带水壶"
    ],
    principleNote: "它和班级小助手是同一套四组件搭的：只是把“记忆”换成了行程信息，把“工具”换成了天气和换算——这就是为什么它专管出行。",
    /* —— 制作过程（分步骤图解） —— */
    steps: [
      { icon: "target", title: "定目标", text: "先想清楚它要帮同学做什么：出门和旅行时的事——看天气、算路程、换算单位、做提醒。" },
      { icon: "eye", title: "配感知器", text: "同样接一个感知器：把“明天杭州会下雨吗”变成大模型能读懂的输入。" },
      { icon: "pen", title: "写系统提示词", text: "写岗位说明书：它是出行小管家、只服务出行话题、优先用天气和换算工具、说话要简短清楚。" },
      { icon: "wrench", title: "装工具", text: "装上出行用得上的工具：天气查询、单位换算、时间日期、计算器、提醒、计时器、搜索。" },
      { icon: "database", title: "接记忆", text: "它不需要记班级课表，记忆更简单：记住这次行程的信息（目的地、日期、要带的东西），下次还能接着聊。" },
      { icon: "check", title: "联调测试", text: "一句一句地试：天气查得准不准？换算对不对？“下雨才提醒”这种有依赖的步骤顺序对不对？不对就回去改。" }
    ],
    /* —— 原理拆解（对照四大组件） —— */
    principles: [
      { comp: "感知器", icon: "eye", color: "per", text: "同样先过感知器：把“明天杭州会下雨吗”切词、算 Token，变成模型能读的输入。" },
      { comp: "规划器", icon: "gear", color: "plan", text: "它把出行问题拆开：先查天气，若下雨就再设一条带伞提醒——先做哪步、后做哪步由它来排。" },
      { comp: "记忆器", icon: "book", color: "mem", text: "它记住的是这次出行的信息（目的地、日期、要带的东西），下次接着聊时还记得。" },
      { comp: "执行器", icon: "hand", color: "exe", text: "它调用天气、换算、搜索等工具去查真实数据，再把结果汇总成一句贴心的提醒。" }
    ]
  }
};

/* 作品顺序（页面按这个顺序展示；想调整展示顺序改这里即可） */
AgentLab.WORK_ORDER = ["classAssistant", "travelAssistant"];

/* 把一个作品档案转成 agent.js 需要的「profile」（执行用）：工具子集 + 专属系统提示词。
 * lab-works.js 里用 AgentLab.Agent.run(text, history, hooks, AgentLab.profileFor(work)) 即可。 */
AgentLab.profileFor = function (workOrId) {
  var work = typeof workOrId === "string" ? AgentLab.WORKS[workOrId] : workOrId;
  if (!work) return null;
  return {
    id: work.id,
    name: work.name,
    toolKeys: work.toolKeys,
    systemPrompt: function (classInfo, manual) {
      return AgentLab.buildWorkPrompt(work, classInfo, manual);
    }
  };
};
