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
   * 注意：模型名会随平台上下线变化。原写的 Qwen/Qwen2.5-VL-7B-Instruct
   * 在硅基流动已下线（接口返回 400 Model does not exist），会导致图片识别必定失败。
   * 当前平台可用（2026-10 实测）：
   *   Qwen/Qwen3-VL-8B-Instruct      快、便宜，推荐课堂使用 ← 现用
   *   Qwen/Qwen3-VL-30B-A3B-Instruct 更强，单价更高
   *   PaddlePaddle/PaddleOCR-VL-1.5  专门做 OCR
   * 换模型后若报 Model does not exist，可访问
   *   GET https://api.siliconflow.cn/v1/models
   * 查询当前可用清单（需要带 Bearer 密钥）。 */
  ocr: {
    model: "Qwen/Qwen3-VL-8B-Instruct",
    url: "https://api.siliconflow.cn/v1/chat/completions",
    maxSide: 1600         // 上传前把长边压到该像素内，控制 token 消耗
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
 * 教学口径：长期记忆档案（班级知识库、边界说明书）随 system 一起给模型——
 * 记忆本身不是第五种角色，它是“借”system 这个角色放进上下文的；
 * 更大的知识库则走 RAG：检索出的片段随 user 消息一起给（见记忆器实验室）。 */
AgentLab.buildSystemPrompt = function (classInfo, manual) {
  var kb = AgentLab.formatClassInfo(classInfo);
  var hasKb = !!(classInfo && ["className", "slogan", "schedule", "duty", "dutyRule", "notice", "teacher"]
    .some(function (k) { return classInfo[k] && String(classInfo[k]).trim(); }));
  var lines = [
    "你是一个帮助小学生学习 AI 的“智能体小管家”，名字叫小智。",
    "你拥有四大组件：感知器（听懂问题）、规划器（安排步骤）、记忆器（记住信息）、执行器。",
    "你的工具包括：天气查询、计算器、提醒、班级课表查询、联网搜索、翻译、单位换算、时间日期、图形计算、数学计算、计时器。",
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
    "【回答要求】",
    "1. 用五年级学生听得懂的话回答，清晰专业但不幼稚，语气友好、有逻辑。",
    "2. 回答尽量简洁（一般 2~4 句话），先说结论，再给依据。",
    "3. 如果通过工具查到了信息（如天气、计算结果、搜索结果、译文、换算结果），要明确告诉同学“我查到了：……”再给出答案或建议。",
    "4. 不知道的事情要直说“这个我不知道”，绝不编造。",
    "5. 如果同学的问题涉及家庭住址、电话号码等隐私，要提醒他：不要把隐私告诉 AI。",
    "6. 当使用联网搜索工具时，基于搜索结果回答，并可以说“这是我在网上查到的”。"
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
