/* ============================================================
 * config.js —— 教学系统配置
 * 这里集中管理：API 密钥、模型、班级知识库默认值、
 * 天气演示工具、以及四大组件的文案。
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

AgentLab.CONFIG = {
  /* ---------- DeepSeek API（静态版：浏览器直连，Key 由用户输入） ---------- */
  apiKey: "",
  model: "deepseek-v4-flash",
  temperature: 0.7,
  maxTokens: 1200,
  deepseekUrl: "https://api.deepseek.com/chat/completions",

  /* ---------- 天气演示工具 ---------- */
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
    timer: true,        // 计时器（倒计时/番茄钟）
    game: true,         // 猜数字游戏
    idiom: true         // 成语接龙
  }
};

/* 天气演示工具：根据“城市 + 日期”生成稳定的模拟数据（便于课堂演示，
 * 数据仅为教学演示，不代表真实天气预报；可替换为真实天气 API） */
AgentLab.weatherSim = function (city, dateKey) {
  var seed = 0;
  var s = (city || "北京") + "|" + (dateKey || "今天");
  for (var i = 0; i < s.length; i++) seed = (seed * 31 + s.charCodeAt(i)) % 100000;
  var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  var conditions = [
    ["晴", 0.05], ["多云", 0.25], ["阴", 0.45], ["小雨", 0.65], ["中雨", 0.8], ["雷阵雨", 0.92]
  ];
  var c = "多云";
  var r = rnd();
  for (var k = 0; k < conditions.length; k++) {
    if (r <= conditions[k][1]) { c = conditions[k][0]; break; }
  }
  var isRain = (c.indexOf("雨") >= 0) || (c === "阴" && rnd() < 0.2);
  var tLow = 18 + Math.floor(rnd() * 8);          // 18~25
  var tHigh = tLow + 5 + Math.floor(rnd() * 6);   // 高 5~10 度
  var wind = ["1级", "2级", "3级", "4级"][Math.floor(rnd() * 4)];
  var rainProb = isRain ? (55 + Math.floor(rnd() * 40)) : Math.floor(rnd() * 20);
  var suggest = isRain
    ? "记得带伞，最好穿防水的外套和防滑的鞋子"
    : (tHigh >= 30 ? "天气热，穿短袖就行，记得多喝水" : "早晚有点凉，建议穿短袖加一件薄外套");

  return {
    city: city, date: dateKey, condition: c, tempLow: tLow, tempHigh: tHigh,
    wind: wind, rainProb: rainProb, isRain: isRain, suggest: suggest,
    text: city + "·" + dateKey + "：" + c + "，" + tLow + "~" + tHigh + "℃，降水概率" + rainProb + "%，风力" + wind
  };
};

/* 智能体提示词模板（含班级知识库与说明书边界） */
AgentLab.buildSystemPrompt = function (classInfo, manual) {
  var kb = AgentLab.formatClassInfo(classInfo);
  var lines = [
    "你是一个帮助小学生学习 AI 的“智能体小管家”，名字叫小智。",
    "你拥有四大组件：感知器（听懂问题）、规划器（安排步骤）、记忆器（记住信息）、执行器（工具）。",
    "你的工具包括：天气查询、计算器、提醒、班级课表查询、联网搜索、翻译、单位换算、时间日期、图形计算、数学计算、计时器、猜数字游戏、成语接龙。",
    "",
    "【班级知识库】（来自记忆器的长期记忆）",
    kb,
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
  return lines.join("\n");
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
