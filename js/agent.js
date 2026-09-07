/* ============================================================
 * agent.js —— 智能体核心：四大组件协作管线
 *
 * 学生每说一句话，智能体就按顺序“点亮”五个部件：
 *   感知器（听懂问题）→ 规划器（安排步骤）→ 记忆器（翻小本子）
 *   → 执行器（调用工具）→ 大语言模型大脑（组织回答）
 * 通过动画让学生直观看到“四样本领一起转起来”。
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

AgentLab.Agent = (function () {

  var STAGE_DELAY = 700;   // 每个阶段动画时长（毫秒）
  var MAX_HISTORY = 8;     // 短期记忆：最多保留的对话轮数

  /* 组件开关（智能体实验室里可以现场关掉某个组件看效果） */
  var flags = { perception: true, planner: true, memory: true, executor: true };

  /* 中文数字 → 阿拉伯数字（支持：一~十、两、X十、十X、X百、X千） */
  var CN_NUM = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 百: 100, 千: 1000 };

  function parseCnNum(s) {
    if (!s) return null;
    if (/^\d/.test(s)) return parseFloat(s);
    var m;
    if ((m = s.match(/^([一二两三四五六七八九])(百|千)$/))) return CN_NUM[m[1]] * CN_NUM[m[2]];
    if ((m = s.match(/^([一二两三四五六七八九])十([一二两三四五六七八九])?$/))) return CN_NUM[m[1]] * 10 + (m[2] ? CN_NUM[m[2]] : 0);
    if ((m = s.match(/^十([一二两三四五六七八九])?$/))) return 10 + (m[1] ? CN_NUM[m[1]] : 0);
    if (CN_NUM[s] !== undefined) return CN_NUM[s];
    return null;
  }

  /* ---------- 意图识别（本地规则，相当于“规划器”的第一步） ---------- */

  function detectIntent(text) {
    var t = (text || "").replace(/\s+/g, "");
    var tools = AgentLab.Store.getTools();
    var intent = { needTool: false, toolName: "", params: {}, plan: [] };

    // 1) 计算题 → 计算器工具（支持“25乘4加10”这类中文算式）
    var calcSrc = t
      .replace(/乘以/g, "*").replace(/乘/g, "*")
      .replace(/除以/g, "/").replace(/除/g, "/")
      .replace(/加/g, "+").replace(/减/g, "-")
      .replace(/等于多少|是多少|等于/g, "");
    var calcMatch = calcSrc.match(/(?:计算|算一下|算算|帮我算)?\s*([0-9]+(?:\s*[+\-*/×÷]\s*[0-9]+)+)/);
    if (tools.calc && calcMatch) {
      var expr = calcMatch[1].replace(/×/g, "*").replace(/÷/g, "/").replace(/\s+/g, "");
      if (/^[0-9+\-*/().]+$/.test(expr) && expr.length <= 30) {
        intent.needTool = true;
        intent.toolName = "calc";
        intent.params.expr = expr;
        intent.plan = ["听懂题目", "调出计算器工具", "算出结果", "告诉同学答案和算法"];
        return intent;
      }
    }

    // 2) 天气问题 → 天气查询工具
    var weatherRe = /(天气|下雨|雨|气温|温度|多少度|穿什么|带不带伞|带伞|风力|风大|冷不冷|热不热|适不适合运动|适合.*运动|运动.*适合|出行|要不要.*(伞|外套)|穿.*衣服)/;
    if (tools.weather && weatherRe.test(t)) {
      var dateKey = "今天";
      if (/后天/.test(t)) dateKey = "后天";
      else if (/明晚/.test(t)) dateKey = "明晚";
      else if (/明天|明早/.test(t)) dateKey = "明天";
      else if (/周末/.test(t)) dateKey = "周末";
      else if (/下周/.test(t)) dateKey = "下周";
      // 识别问题里提到的城市（常见城市清单），没提到就用默认城市
      var city = AgentLab.CONFIG.defaultCity;
      var cityMatch = t.match(/(北京|上海|广州|深圳|杭州|成都|重庆|武汉|西安|南京|天津|苏州|长沙|青岛|大连|厦门|郑州|济南|沈阳|哈尔滨|昆明|贵阳|南宁|福州|合肥|南昌|太原|石家庄|乌鲁木齐|拉萨|西宁|兰州|银川|呼和浩特|香港|澳门|台北)/);
      if (cityMatch) city = cityMatch[0];
      intent.needTool = true;
      intent.toolName = "weather";
      intent.params.city = city;
      intent.params.dateKey = dateKey;
      intent.plan = ["听懂问题是问天气", "调出天气查询工具", "查到" + city + dateKey + "的天气", "根据天气给出穿衣/带伞建议"];
      return intent;
    }

    // 3) 计时 / 倒计时 / 番茄钟 / 延时提醒 → 计时器工具（真实倒计时，配合番茄工作法）
    //    注意：必须在"提醒工具"之前检测，否则"10秒后提醒我写作业"会被误判为提醒工具
    var timerRe = /(计时|倒计时|定时|闹钟|番茄|沙漏|后提醒|之后提醒|后叫我|之后叫我|后告诉我|之后告诉我|分钟后|秒后|小时后)/;
    if (tools.timer && timerRe.test(t)) {
      var dur = parseDuration(t);
      if (dur) {
        var lbl = dur.seconds < 60 ? dur.seconds + "秒" : (dur.seconds >= 3600 ? (dur.seconds / 3600) + "小时" : dur.minutes + "分钟");
        // 提取提醒内容（如"10秒后提醒我写作业"→"写作业"）
        var remindText = "";
        var rm = t.match(/(?:后|之后)(?:提醒我|叫我|告诉我)(.+)/);
        if (rm) remindText = rm[1].replace(/[。！？，,.\s]+$/, "").trim();
        intent.needTool = true;
        intent.toolName = "timer";
        intent.params.seconds = dur.seconds;
        intent.params.label = remindText ? (lbl + "·" + remindText) : lbl;
        intent.params.remindText = remindText;
        intent.params.pomodoro = /番茄/.test(t);
        intent.plan = ["听懂要计时多久" + (remindText ? "（提醒：" + remindText + "）" : ""), "调出计时器工具", "开始倒计时", "时间到提醒同学"];
        return intent;
      }
    }

    // 4) 提醒任务 → 提醒工具（仅记下内容，不启动真实倒计时）
    if (tools.remind && /(提醒|别忘了|记得.*(带|提醒|交)|帮我记)/.test(t)) {
      intent.needTool = true;
      intent.toolName = "remind";
      intent.params.text = text;
      intent.plan = ["听懂要提醒什么", "调出提醒工具", "记下提醒内容", "告诉同学我已经记住了"];
      return intent;
    }

    // 4) 翻译任务 → 翻译工具
    if (tools.translate && /(翻译|译成|英语怎么说|英文怎么说|用英语|用英文|英语是|英文是|translate)/i.test(t)) {
      var target = /中文|汉语/.test(t) ? "zh" : "en";
      var src = text.replace(/帮我|请/g, "")
        .replace(/把/g, " ")
        .replace(/翻译成|译成|成中文|成汉语|成英语|成英文|英语怎么说|英文怎么说|用英语怎么说|用英文怎么说|用英语|用英文|翻译|translate/gi, " ")
        .replace(/[“”"']/g, "")
        .replace(/[，。！？,.;:：!?]/g, " ").replace(/\s+/g, " ").trim();
      intent.needTool = true;
      intent.toolName = "translate";
      intent.params.text = src || text;
      intent.params.target = target;
      intent.plan = ["听懂要翻译什么", "调出翻译工具", "把内容翻译成" + (target === "zh" ? "中文" : "英语"), "把译文告诉同学"];
      return intent;
    }

    // 5) 单位换算任务 → 单位换算工具（确定性工具：不靠大模型，100% 精确）
    // 先按“单字数字”解析（一千米→1千米）；匹配不到再按“复合数字”解析（一百厘米→100厘米）
    var NUM_SINGLE = "[0-9]+(?:\\.[0-9]+)?|[一二两三四五六七八九]十[一二两三四五六七八九]?|十[一二两三四五六七八九]?|[一二两三四五六七八九十]";
    var NUM_FULL = NUM_SINGLE + "|[一二两三四五六七八九][百千]";
    var UNITS_RE = "(平方千米|平方公里|公顷|平方米|平方分米|平方厘米|平方毫米|千米每小时|公里每小时|千米每时|公里每时|千米/小时|公里/小时|千米/时|公里/时|米每秒|米/秒|米每分钟|米/分|千米|公里|米|分米|厘米|毫米|吨|千克|公斤|克|斤|毫升|升|小时|分钟|秒|天)";
    var TEMP_RE = "(摄氏度|华氏度)";
    var CONN = "(?:等于多少|等于|换成|是多少|多少|换算成)?";
    var m5 = null;
    if (!m5) m5 = t.match(new RegExp("(" + NUM_SINGLE + ")\\s*" + TEMP_RE + "\\s*" + CONN + "\\s*" + TEMP_RE));
    if (!m5) m5 = t.match(new RegExp("(" + NUM_SINGLE + ")\\s*" + UNITS_RE + "\\s*" + CONN + "\\s*" + UNITS_RE));
    if (!m5) m5 = t.match(new RegExp("(" + NUM_FULL + ")\\s*" + TEMP_RE + "\\s*" + CONN + "\\s*" + TEMP_RE));
    if (!m5) m5 = t.match(new RegExp("(" + NUM_FULL + ")\\s*" + UNITS_RE + "\\s*" + CONN + "\\s*" + UNITS_RE));
    if (tools.convert && m5) {
      var num5 = parseCnNum(m5[1]);
      if (num5 !== null && m5[2] !== m5[3]) {
        intent.needTool = true;
        intent.toolName = "convert";
        intent.params.value = num5;
        intent.params.from = m5[2];
        intent.params.to = m5[3];
        intent.plan = ["听懂要换算什么", "调出单位换算工具", "按换算规则算出结果", "把结果告诉同学"];
        return intent;
      }
    }

    // 6) 时间日期 → 时间日期工具（确定性工具：读取真实系统时间，支持日期推算）
    if (tools.datetime && /(几点|几点了|现在时间|当前时间|几号|多少号|星期几|周几|礼拜几|什么日期|日期|几天后|天后|是什么时候)/.test(t)) {
      intent.needTool = true;
      intent.toolName = "datetime";
      intent.params.text = text;
      intent.plan = ["听懂要查时间还是日期", "调出时间日期工具", "读取系统时钟/推算日期", "把结果告诉同学"];
      return intent;
    }

    // 7) 图形计算（面积/周长/体积） → 图形计算工具（确定性工具）
    if (tools.shape && /(面积|周长|体积|表面积)/.test(t)) {
      var nums7 = (t.match(/\d+(?:\.\d+)?/g) || []).map(parseFloat);
      var shape7 = null;
      if (/正方形/.test(t)) shape7 = "square";
      else if (/正方体/.test(t)) shape7 = "cube";
      else if (/长方形|矩形/.test(t)) shape7 = "rect";
      else if (/长方体/.test(t)) shape7 = "cuboid";
      else if (/三角形/.test(t)) shape7 = "triangle";
      else if (/平行四边形/.test(t)) shape7 = "parallelogram";
      else if (/梯形/.test(t)) shape7 = "trapezoid";
      else if (/圆/.test(t)) shape7 = "circle";
      var needNums = { square: 1, cube: 1, rect: 2, cuboid: 3, triangle: 2, parallelogram: 2, trapezoid: 3, circle: 1 };
      if (shape7 && nums7.length >= (needNums[shape7] || 1)) {
        intent.needTool = true;
        intent.toolName = "shape";
        intent.params.shape = shape7;
        intent.params.nums = nums7;
        intent.params.diameter = /直径/.test(t);
        intent.plan = ["听懂要算什么图形", "调出图形计算工具", "套用面积/周长/体积公式", "把计算结果和公式告诉同学"];
        return intent;
      }
    }

    // 8) 百分数 / 折扣 / 平均数 → 数学计算工具（确定性工具）
    if (tools.math && (/(平均|均分|平均值)/.test(t) || /%|百分之|打.*折|折后/.test(t))) {
      var nums8 = (t.match(/\d+(?:\.\d+)?/g) || []).map(parseFloat);
      var isAvg = /平均|均分|平均值/.test(t);
      var isPct = /%|百分之/.test(t);
      var isDiscount = /打.*折|折后/.test(t);
      if (isAvg && nums8.length >= 2) {
        intent.needTool = true;
        intent.toolName = "math";
        intent.params.kind = "average";
        intent.params.nums = nums8;
        intent.plan = ["听懂要算平均数", "调出数学计算工具", "把几个数加起来再平均", "把结果告诉同学"];
        return intent;
      }
      if (isPct) {
        var basePct = null, ratePct = null;
        if (/百分之/.test(t)) {
          var pctM2 = t.match(/百分之\s*(\d+(?:\.\d+)?)\s*(?:的|是)?\s*(\d+(?:\.\d+)?)/);
          if (pctM2) { basePct = parseFloat(pctM2[2]); ratePct = parseFloat(pctM2[1]); }
        } else {
          var pctM1 = t.match(/(\d+(?:\.\d+)?)\s*(?:的|是)?\s*(\d+(?:\.\d+)?)\s*%/) ||
                      t.match(/(\d+(?:\.\d+)?)\s*%\s*(?:的|是)?\s*(\d+(?:\.\d+)?)/);
          if (pctM1) { basePct = parseFloat(pctM1[1]); ratePct = parseFloat(pctM1[2]); }
        }
        if (basePct !== null) {
          intent.needTool = true;
          intent.toolName = "math";
          intent.params.kind = "percent";
          intent.params.base = basePct;
          intent.params.rate = ratePct;
          intent.plan = ["听懂要算百分之几", "调出数学计算工具", "用“总数 × 百分比”算出结果", "把结果告诉同学"];
          return intent;
        }
      }
      if (isDiscount && nums8.length >= 2) {
        // “200元打8折” → base=200, rate=8
        intent.needTool = true;
        intent.toolName = "math";
        intent.params.kind = "discount";
        intent.params.base = nums8[0];
        intent.params.rate = nums8[1];
        intent.plan = ["听懂要算折后价", "调出数学计算工具", "用“原价 × 折扣”算出折后价", "把结果告诉同学"];
        return intent;
      }
    }

    // 9) 班级知识 → 查班级知识库（记忆器负责，不需要外部工具）
    if (tools.classInfo && /(课表|值日|通知|班名|班主任|口号|班级|我们班|什么课|今天.*课|明天.*课)/.test(t)) {
      intent.toolName = "classInfo";
      intent.plan = ["听懂是关于我们班的问题", "翻开长期记忆小本子", "找到班级知识库里的信息", "组织回答"];
      return intent;
    }

    // 10) 联网搜索任务 → 联网搜索工具
    if (tools.search && /(搜索|搜一下|搜一搜|搜搜|搜|百度|上网查|网上查|查一下|查查|查资料|了解一下|科普|百科|最新|新闻|是什么|什么是|啥是|啥叫|怎么回事)/.test(t)) {
      var q = text.replace(/帮我|请/g, "")
        .replace(/搜索一下|搜一下|搜一搜|搜搜|上网搜|网上搜|百度一下|上网查|网上查|查一下|查查|查资料|了解一下|科普一下|最新|新闻/g, " ")
        .replace(/什么是|是什么|是啥|啥是|啥叫|是怎么回事|是什么东西|是什么原因/g, " ")
        .replace(/[，。！？,.;:：!?]/g, " ").replace(/\s+/g, " ").trim();
      if (q && q.length <= 50) {
        intent.needTool = true;
        intent.toolName = "search";
        intent.params.query = q;
        intent.plan = ["听懂要搜什么", "调出联网搜索工具", "上网查到相关资料", "把查到的东西整理成回答"];
        return intent;
      }
    }

    // 11) 猜数字游戏 → 猜数字工具（游戏状态在本次会话内保持）
    if (tools.game && (/(猜数字|猜数|玩猜|我想个数字|数字游戏)/.test(t) || (gameState && /我猜|猜[0-9]|猜是|答案是|猜的|不玩了|结束|退出|停/.test(t)))) {
      if (/不玩了|结束|退出|停/.test(t) && gameState) {
        intent.needTool = true;
        intent.toolName = "game";
        intent.params.action = "stop";
        intent.plan = ["听懂要结束游戏", "调出猜数字工具", "结算游戏", "告诉同学答案和猜的次数"];
        return intent;
      }
      if (/猜数字|猜数|玩猜|我想个数字|数字游戏/.test(t) && !gameState) {
        intent.needTool = true;
        intent.toolName = "game";
        intent.params.action = "start";
        intent.plan = ["听懂要玩猜数字", "调出猜数字工具", "想好一个1到100的数字", "开始游戏"];
        return intent;
      }
      if (gameState) {
        var gM = t.match(/(\d+(?:\.\d+)?)/);
        if (gM) {
          intent.needTool = true;
          intent.toolName = "game";
          intent.params.action = "guess";
          intent.params.guess = parseFloat(gM[1]);
          intent.plan = ["听懂同学猜的数字", "调出猜数字工具", "比较大小", "告诉同学大了/小了/猜中"];
          return intent;
        }
      }
    }

    // 12) 成语接龙 → 成语接龙工具（内置成语库 + 释义）
    if (tools.idiom && (/(成语接龙|接龙|玩成语)/.test(t) || idiomState)) {
      if (/不玩了|结束|退出|停/.test(t) && idiomState) {
        intent.needTool = true;
        intent.toolName = "idiom";
        intent.params.action = "stop";
        intent.plan = ["听懂要结束接龙", "调出成语接龙工具", "结算", "告诉同学战果"];
        return intent;
      }
      if (/(成语接龙|接龙|玩成语)/.test(t) && !idiomState) {
        intent.needTool = true;
        intent.toolName = "idiom";
        intent.params.action = "start";
        intent.plan = ["听懂要玩成语接龙", "调出成语接龙工具", "从成语库出一个成语", "开始游戏"];
        return intent;
      }
      if (idiomState) {
        if (/提示|不会|帮帮我|想不出来|给点提示/.test(t)) {
          intent.needTool = true;
          intent.toolName = "idiom";
          intent.params.action = "hint";
          intent.plan = ["同学需要提示", "调出成语接龙工具", "找一个以X开头的成语", "给提示"];
          return intent;
        }
        intent.needTool = true;
        intent.toolName = "idiom";
        intent.params.action = "answer";
        intent.params.word = (text || "").replace(/[，。！？,.!?、\s]/g, "").trim();
        intent.plan = ["听懂同学接的成语", "调出成语接龙工具", "检查首字是否接得上", "宣布结果并出下一题"];
        return intent;
      }
    }

    // 13) 普通问题
    intent.plan = ["听懂你的问题", "回想学过的本领和知识", "组织一个清楚、简短的回答"];
    return intent;
  }

  /* ---------- 工具执行（执行器） ---------- */

  /* 时长解析：把“25分钟”“3小时”“30秒”“半小时”等变成秒数 */
  function parseDuration(t) {
    if (!t) return null;
    var m;
    if ((m = t.match(/(\d+(?:\.\d+)?)\s*(小时|分钟|秒钟|秒)/))) {
      var v = parseFloat(m[1]);
      var unit = m[2];
      var sec = unit === "小时" ? v * 3600 : unit === "分钟" ? v * 60 : v;
      if (sec <= 0 || sec > 36000) return null;
      return { seconds: sec, minutes: Math.round(sec / 60 * 10) / 10 };
    }
    if ((m = t.match(/([一二两三四五六七八九十]+)\s*(小时|分钟|秒钟|秒)/))) {
      var cv = parseCnNum(m[1]);
      if (cv !== null) {
        var sec2 = m[2] === "小时" ? cv * 3600 : m[2] === "分钟" ? cv * 60 : cv;
        if (sec2 <= 0 || sec2 > 36000) return null;
        return { seconds: sec2, minutes: Math.round(sec2 / 60 * 10) / 10 };
      }
    }
    if (/半小时/.test(t)) return { seconds: 1800, minutes: 30 };
    return null;
  }

  var CONVERT_UNITS = {
    length: { 千米: 1000, 公里: 1000, 米: 1, 分米: 0.1, 厘米: 0.01, 毫米: 0.001 },
    weight: { 吨: 1000, 千克: 1, 公斤: 1, 克: 0.001, 斤: 0.5 },
    volume: { 升: 1, 毫升: 0.001 },
    time: { 天: 86400, 小时: 3600, 分钟: 60, 秒: 1 },
    area: { 平方千米: 1000000, 平方公里: 1000000, 公顷: 10000, 平方米: 1, 平方分米: 0.01, 平方厘米: 0.0001, 平方毫米: 0.000001 },
    speed: { 千米每小时: 1000 / 3600, 公里每小时: 1000 / 3600, 千米每时: 1000 / 3600, 公里每时: 1000 / 3600, "千米/小时": 1000 / 3600, "公里/小时": 1000 / 3600, "千米/时": 1000 / 3600, "公里/时": 1000 / 3600, 米每秒: 1, "米/秒": 1, 米每分钟: 1 / 60, "米/分": 1 / 60 }
  };

  /* ---------- 游戏状态（猜数字 / 成语接龙，本次会话内有效） ---------- */
  var gameState = null;   // { secret, attempts, low, high }
  var idiomState = null;  // { lastChar, count, used }

  /* ---------- 同音字组表（同音模式：谐音接龙） ---------- */
  var HOMOPHONE_GROUPS = [
    ["一","衣","医","依","壹","仪","宜","怡","贻","颐","遗","疑","已","以","蚁","倚","椅","义","亿","忆","艺","议","亦","异","役","抑","易","疫","益","谊","逸","意","溢","毅","翼"],
    ["不","步","部","布","怖","簿"],
    ["人","仁","壬","忍","刃","认","仞","任","妊","纫","韧"],
    ["大","达","答","打","代","带","待","怠","袋","逮","戴","黛"],
    ["小","晓","筱","孝","肖","笑","效","校","啸"],
    ["上","尚","赏","裳"],
    ["下","夏","吓","厦","罅"],
    ["天","添","田","甜","填","恬","腆","舔"],
    ["地","的","得","德","底","低","滴","笛","敌","涤","嫡","邸","抵","弟","帝","递","第","谛","缔","棣"],
    ["山","删","衫","杉","姗","珊","扇","善","擅","膳","赡"],
    ["水","税","睡","谁"],
    ["火","伙","或","货","获","祸","惑","霍","豁"],
    ["风","丰","封","疯","峰","锋","蜂","烽","逢","缝","讽","凤","奉"],
    ["雨","与","于","予","余","鱼","愉","渔","隅","愚","榆","虞","舆","语","禹","屿","宇","羽","玉","育","郁","狱","浴","欲","域","裕","遇","御","豫","誉","寓"],
    ["花","华","哗","骅","铧","滑","划","画","话","桦"],
    ["月","约","曰","乐","跃","岳","钥","越","粤"],
    ["明","名","鸣","铭","茗","溟","瞑","螟","酩","命"],
    ["白","百","柏","摆","败","拜","稗"],
    ["红","洪","宏","弘","鸿","虹","哄","烘","轰","泓"],
    ["金","今","斤","津","筋","襟","禁","锦","仅","紧","谨","尽","进","近","劲","晋","浸","烬"],
    ["石","时","十","什","实","识","史","使","始","驶","士","氏","世","市","示","式","事","侍","势","视","试","饰","室","是","适","逝","释","誓","噬"],
    ["土","吐","兔","途","图","徒","涂","屠"],
    ["木","目","牧","幕","慕","墓","暮","募","睦","穆"],
    ["手","首","守","寿","受","兽","售","授","瘦","狩"],
    ["飞","非","菲","啡","绯","扉","蜚","翡","匪","诽","悱","斐","吠","废","沸","肺","费"],
    ["龙","隆","笼","聋","珑","咙","胧","拢","垄","楼","娄","搂","篓","漏","陋","露","路","陆","录","鹿","碌","禄","戮","辘","麓","鹭"],
    ["虎","呼","乎","忽","惚","狐","弧","胡","壶","葫","瑚","蝴","糊","浒","唬","互","户","护","沪","怙"],
    ["马","吗","妈","麻","蟆","摩","磨","魔","抹","末","莫","墨","默","沫","漠","寞","陌","脉","蓦"],
    ["羊","阳","杨","扬","洋","佯","徉","烊","仰","养","氧","痒","怏","样","漾"],
    ["心","新","欣","辛","薪","馨","鑫","芯","锌","信","衅"],
    ["兴","星","腥","猩","惺","刑","行","形","型","邢","醒","杏","幸","性","姓"],
    ["书","叔","殊","梳","淑","疏","蔬","舒","输","枢","姝","倏","塾","熟","薯","曙","署","蜀","黍","鼠","属","数","束","述","树","竖","恕","庶","墅","漱"],
    ["词","辞","慈","瓷","祠","雌","糍","此","次","刺","赐","伺"],
    ["舞","五","午","伍","武","侮","捂","牾","骛","鹜","兀","勿","务","戊","物","误","悟","晤","雾","焐"],
    ["琴","勤","秦","禽","擒","噙","芹","沁","寝"],
    ["棋","其","奇","歧","祈","祁","骑","齐","旗","祺","琪","琦","麒","乞","企","启","起","绮","气","弃","汽","泣","契","砌","器","憩"],
    ["三","叁","毵","伞","散","馓"],
    ["四","寺","似","饲","肆","嗣","俟","耜","笥","姒","驷"],
    ["六","陆","录","鹿","碌","禄","戮","辘","麓","鹭"],
    ["七","妻","栖","凄","戚","期","欺","漆","柒","蹊","乞","企","启","起","绮","气","弃","汽","泣","契","砌","器","憩"],
    ["八","巴","吧","疤","捌","粑","笆","拔","跋","魃","把","靶","坝","爸","罢","霸","灞"],
    ["九","久","酒","灸","韭","旧","臼","舅","咎","疚","柩","厩","救","就","鹫"],
    ["千","迁","钎","牵","铅","谦","签","愆","骞","前","钱","潜","遣","浅","倩","堑","嵌","欠","歉"],
    ["万","弯","湾","蜿","豌","丸","完","玩","顽","烷","宛","婉","惋","绾","琬","畹","腕","皖"],
    ["云","匀","允","陨","损","运","韵","孕","蕴"],
    ["雪","学","穴","噱","血","谑"],
    ["冰","兵","丙","柄","炳","饼","禀","并","病","摒"],
    ["河","何","呵","禾","和","合","盒","涸","貉","颌","阁","格","革","隔","嗝","膈","葛","蛤","赫","褐","鹤","贺","壑"],
    ["江","将","姜","僵","疆","缰","讲","奖","桨","蒋","匠","降","酱","犟"],
    ["海","嗨","胲","醢","亥","骇","害","氦","嗐"],
    ["歌","哥","鸽","搁","割","革","格","阁","隔","嗝","膈","葛","蛤","赫","褐","鹤","贺","壑"],
    ["凶","兄","胸","雄","熊"],
    ["休","修","羞","朽","秀","袖","绣","锈","嗅"],
    ["须","虚","需","墟","戌","徐","许","栩","畜","续","絮","蓄","叙","序","绪"],
    ["耳","二","儿","而","尔","饵","洱","贰"],
    ["虫","重","崇","宠","冲","忡","舂","憧","种","肿","踵","仲","众","咒","宙","昼","骤","皱","胄"],
    ["日","入","褥","软","阮","瑞","锐","闰","润"],
    ["光","广","逛"],
    ["口","扣","寇","叩","筘"],
    ["足","族","卒","祖","阻","组","诅","俎"],
    ["牛","扭","纽","钮","忸","狃","农","浓","脓","弄"],
    ["后","厚","候","猴","喉","瘊","糇","逅"],
    ["中","钟","终","忠","衷","肿","种","重","众","仲","咒","宙","昼","骤","皱","胄"],
    ["有","友","右","又","幼","幽","优","忧","悠","尤","由","邮","油","游","犹","酉","莠","诱","釉","鼬"],
    ["用","勇","永","涌","蛹","咏","泳","庸","慵","拥","痈","雍","臃","雝","饔"],
    ["我","卧","握","沃","龌","渥","斡","肟"],
    ["你","拟","逆","腻","匿","溺","倪","霓","猊","鲵","伲","泥"],
    ["他","她","它","塌","踏","塔","獭","挞","闼","遢","溻","褟"],
    ["们","门","闷","焖","扪","钔","懑","亹"],
    ["说","硕","税","朔","烁","铄","槊","蒴","妁","哾"],
    ["做","作","坐","座","昨","左","佐","撮","嘬","柞","胙","阼","怍","祚","酢"],
    ["去","趣","取","区","曲","驱","躯","岖","趋","蛆","黢","娶","龋","觑","戌","戍","瞿","衢","劬","朐","鸲","蠼"],
    ["来","莱","睐","徕","涞","铼","赉","崃","梾","俫"],
    ["对","队","兑","怼","憝","镦","碓","煺"],
    ["要","药","耀","钥","谣","摇","遥","窑","瑶","尧","肴","姚","珧","徭","繇","鳐","窈","舀","疟","钥","勒"],
    ["会","慧","汇","惠","绘","卉","讳","诲","秽","彗","晦","贿","喙","烩","荟","蕙","蟪","浍","桧","郐","狯","蒯","哙","侩","刽","脍","郐"]
  ];
  /* 字 → 组索引 的快速映射 */
  var CHAR_TO_GROUP = {};
  HOMOPHONE_GROUPS.forEach(function (group, idx) {
    group.forEach(function (ch) { CHAR_TO_GROUP[ch] = idx; });
  });
  /* 判断两个字是否同音（同字当然同音；都在同音字表中且同组则同音） */
  function isHomophone(a, b) {
    if (a === b) return true;
    var ga = CHAR_TO_GROUP[a];
    var gb = CHAR_TO_GROUP[b];
    return ga !== undefined && ga === gb;
  }

  var IDIOMS = [
    ["一心一意", "心思专一，没有杂念"],
    ["一马当先", "冲在最前面，带头干"],
    ["一鸣惊人", "平时不显眼，一出手就让人吃惊"],
    ["一帆风顺", "做事非常顺利"],
    ["一诺千金", "答应过的事一定算数"],
    ["一视同仁", "对所有人都一样对待"],
    ["一箭双雕", "一个行动同时达到两个目的"],
    ["一石二鸟", "做一件事得到两个好处"],
    ["一尘不染", "非常干净，也指品行纯洁"],
    ["一丝不苟", "做事认真仔细，一点不马虎"],
    ["二话不说", "马上就办，不犹豫"],
    ["二龙戏珠", "两条龙戏耍一颗宝珠"],
    ["三心二意", "做事不专心，拿不定主意"],
    ["三顾茅庐", "诚心诚意多次邀请人才"],
    ["三生有幸", "运气非常好，非常荣幸"],
    ["四面八方", "各个方向、各个地方"],
    ["四通八达", "道路通畅，哪里都通"],
    ["五光十色", "颜色鲜艳，花样繁多"],
    ["五花八门", "花样很多，种类繁杂"],
    ["五湖四海", "全国各地"],
    ["六神无主", "慌乱，拿不定主意"],
    ["七上八下", "心里忐忑不安"],
    ["七嘴八舌", "大家抢着说话"],
    ["八面玲珑", "处事圆滑，各方都应付得好"],
    ["九牛一毛", "极大数量中的一点点"],
    ["九死一生", "经历极大危险，侥幸活下来"],
    ["十全十美", "各方面都非常完美"],
    ["百发百中", "每次都能命中"],
    ["百折不挠", "受挫很多次也不放弃"],
    ["千钧一发", "极其危急的时刻"],
    ["千变万化", "变化非常多"],
    ["万紫千红", "形容花朵色彩繁多艳丽"],
    ["万众一心", "大家团结一条心"],
    ["马到成功", "一行动就获得成功"],
    ["马不停蹄", "不停歇地赶路或做事"],
    ["龙飞凤舞", "笔势活泼，也形容姿态优美"],
    ["龙马精神", "精神旺盛，充满活力"],
    ["虎头蛇尾", "开头声势大，结尾草草收场"],
    ["虎背熊腰", "身材魁梧强壮"],
    ["画龙点睛", "关键处加上一笔，使整体生动"],
    ["画蛇添足", "多此一举，反而坏事"],
    ["守株待兔", "不努力，想靠运气成功"],
    ["亡羊补牢", "出了问题及时补救，还不算晚"],
    ["井底之蛙", "见识短浅的人"],
    ["掩耳盗铃", "自己骗自己"],
    ["刻舟求剑", "死守老办法，不知变通"],
    ["拔苗助长", "违反规律急于求成，反而坏事"],
    ["自相矛盾", "自己的言行互相冲突"],
    ["胸有成竹", "做事之前已有把握"],
    ["杯弓蛇影", "疑神疑鬼，自己吓自己"],
    ["对牛弹琴", "对不懂道理的人讲道理"],
    ["闻鸡起舞", "有志向的人及时奋发"],
    ["卧薪尝胆", "忍辱负重，立志报仇"],
    ["破釜沉舟", "下定决心，不留退路"],
    ["纸上谈兵", "光说理论，不会实干"],
    ["望梅止渴", "用空想安慰自己"],
    ["草木皆兵", "形容极度惊恐，疑神疑鬼"],
    ["四面楚歌", "陷入孤立无援的境地"],
    ["精卫填海", "意志坚定，不畏艰难"],
    ["愚公移山", "不怕困难，坚持到底"],
    ["天衣无缝", "事物完美无缺，没有破绽"],
    ["水滴石穿", "坚持不懈，终能成功"],
    ["铁杵成针", "只要有恒心，再难的事也能做成"],
    ["点石成金", "把不好的变成好的"],
    ["金碧辉煌", "装饰华丽，光彩夺目"],
    ["光明磊落", "胸怀坦白，光明正大"],
    ["落落大方", "举止自然得体"],
    ["大公无私", "办事公正，没有私心"],
    ["丝丝入扣", "紧密配合，环环相扣"],
    ["扣人心弦", "形容感动人心"],
    ["来日方长", "以后的日子还长"],
    ["长驱直入", "军队快速前进，不可阻挡"],
    ["入木三分", "见解或笔力深刻有力"],
    ["分秒必争", "时间抓得很紧"],
    ["争先恐后", "抢着往前，唯恐落后"],
    ["后来居上", "后起的超过了先前的"],
    ["上善若水", "最高的德行像水一样"],
    ["水到渠成", "条件成熟，事情自然成功"],
    ["风华正茂", "年轻有为，才华正盛"],
    ["竹报平安", "平安家信"],
    ["安步当车", "从容步行，代替乘车"],
    ["车水马龙", "车马很多，热闹非凡"],
    ["龙腾虎跃", "生龙活虎，非常活跃"],
    ["跃跃欲试", "急切想试一试"],
    ["势如破竹", "节节胜利，不可阻挡"],
    ["竹篮打水", "白费力气，一场空"],
    ["水落石出", "真相大白"],
    ["出生入死", "冒着生命危险"],
    ["死里逃生", "从极危险中逃脱"],
    ["生气勃勃", "充满活力"],
    ["勃然大怒", "突然发怒"],
    ["怒发冲冠", "愤怒到极点"],
    ["土崩瓦解", "彻底崩溃，不可收拾"],
    ["助人为乐", "把帮助别人当作快乐"],
    ["乐在其中", "在做的事情中得到乐趣"],
    ["中庸之道", "不偏不倚的处世态度"],
    ["道听途说", "路上听来的传闻，没有根据"],
    ["说一不二", "说话算数，不改变"],
    ["珠联璧合", "美好的事物凑在一起"],
    ["合情合理", "合乎情理"],
    ["理直气壮", "理由充分，说话有气势"],
    ["壮志凌云", "志向远大"],
    ["云开见日", "黑暗过去，光明到来"],
    ["日新月异", "每天每月都有新变化"],
    ["异想天开", "想法离奇，不切实际"],
    ["开天辟地", "开创前所未有的事业"],
    ["地大物博", "土地广大，物产丰富"],
    ["博学多才", "学识广博，有多方面才能"],
    ["才高八斗", "才华极高"],
    ["斗志昂扬", "斗争意志高涨"],
    ["扬眉吐气", "摆脱压抑后的畅快"],
    ["气吞山河", "气势可以吞没山河"],
    ["海阔天空", "大自然广阔，也形容谈话无拘无束"],
    ["空前绝后", "以前没有，以后也不会有"],
    ["后生可畏", "年轻人很厉害，令人敬畏"],
    ["畏首畏尾", "胆子小，顾虑多"],
    ["掉以轻心", "对事情采取轻率的态度"],
    ["心花怒放", "心里高兴得像花儿盛开"],
    ["放虎归山", "把坏人放回老巢，留下祸根"],
    ["山清水秀", "山水风景优美"],
    ["秀外慧中", "外表清秀，内心聪明"],
    ["中流砥柱", "在动荡环境中起支柱作用的人"],
    ["道貌岸然", "外表严肃正经，实际虚伪"],
    ["然荻读书", "刻苦读书"],
    ["书声琅琅", "读书声音响亮"],
    ["琅琅上口", "文辞顺口，好读"],
    ["口若悬河", "说话像河水下泻，滔滔不绝"],
    ["晏然自若", "镇定自若"],
    ["若无其事", "好像没有那回事一样"],
    ["事半功倍", "费力小，收效大"],
    ["倍道兼行", "加快速度，一天走两天的路"],
    ["行云流水", "文章自然流畅"],
    ["出类拔萃", "超出同类之上"],
    ["萃萃学子", "众多学生"],
    ["子虚乌有", "虚构的，不存在的"],
    ["有备无患", "事先有准备，就可以避免祸患"],
    ["患得患失", "担心得不到，得到了又担心失去"],
    ["失而复得", "失去后又重新得到"],
    ["得心应手", "心里怎么想，手里就能怎么做"],
    ["手忙脚乱", "做事慌张，没有条理"],
    ["乱七八糟", "混乱，没有条理"],
    ["糟糠之妻", "共患难的妻子"],
    ["妻离子散", "一家人被迫分离"],
    ["散兵游勇", "没有组织的零散人员"],
    ["勇往直前", "勇敢地一直向前进"],
    ["前仆后继", "前面的倒下了，后面的紧跟上去"],
    ["继往开来", "继承前人的事业，开辟未来的道路"],
    ["来龙去脉", "事情的前因后果"],
    ["脉脉含情", "用眼神表达情意"],
    ["情同手足", "感情深厚，像兄弟一样"],
    ["足智多谋", "智慧多，计谋多"],
    ["谋事在人", "事情的成败在于人的努力"],
    ["人山人海", "人群如山似海，形容人极多"],
    ["海枯石烂", "海水干涸，石头腐烂，形容历时久远"],
    ["烂熟于心", "对事情极其熟悉"],
    ["心满意足", "心里非常满足"],
    ["足不逾户", "待在家里不出门"],
    ["户枢不蠹", "经常转动的门轴不会被虫蛀"],
    ["蠹国害民", "危害国家和人民"],
    ["民不聊生", "人民无法生活下去"],
    ["生龙活虎", "活泼矫健，富有生气"],
    ["虎视眈眈", "贪婪而凶狠地注视"],
    ["眈眈相向", "凶狠地互相对视"],
    ["向隅而泣", "面对墙角哭泣，形容孤独绝望"],
    ["泣不成声", "哭得发不出声音"],
    ["声东击西", "表面上喊打东边，实际上攻打西边"],
    ["西风落叶", "秋天的景象，也形容事物衰落"],
    ["叶公好龙", "表面上爱好某事物，实际上并不真爱好"],
    ["龙马精神", "精神旺盛"],
    ["神出鬼没", "像神鬼那样出没无常"],
    ["没齿难忘", "一辈子也忘不了"],
    ["忘恩负义", "忘记别人对自己的恩情，做出对不起别人的事"],
    ["义不容辞", "道义上不允许推辞"],
    ["辞旧迎新", "告别旧的，迎接新的"],
    ["新陈代谢", "新的事物代替旧的事物"],
    ["谢天谢地", "表示感激或庆幸"],
    ["地老天荒", "经历的时间极久"],
    ["荒无人烟", "十分荒凉，没有人家"],
    ["烟消云散", "像烟雾和云气一样消散"],
    ["散闷消愁", "排解烦闷和忧愁"],
    ["愁眉苦脸", "皱着眉头，哭丧着脸"],
    ["脸黄肌瘦", "脸色发黄，身体消瘦"],
    ["瘦骨嶙峋", "形容人或动物消瘦露骨"],
    ["峋嶙怪石", "奇形怪状的石头"],
    ["石破天惊", "形容事情或文章议论新奇惊人"],
    ["惊天动地", "形容声势浩大或事业伟大"],
    ["地动山摇", "地震发生时大地颤动，山河摇摆"],
    ["摇旗呐喊", "比喻替别人助长声势"],
    ["喊冤叫屈", "为自己的冤屈呼喊"],
    ["屈指可数", "扳着手指就可以数清楚，形容数量稀少"],
    ["数一数二", "不算第一也算第二，形容突出"],
    ["二心三意", "想这样又想那样，犹豫不决"],
    ["意味深长", "意思含蓄深远，耐人寻味"],
    ["长话短说", "把很长的话精简成简短的话"],
    ["说三道四", "随意评论，乱加谈论"],
    ["四面八方", "各个方向"],
    ["方兴未艾", "事物正在发展，尚未达到止境"],
    ["艾发衰容", "头发苍白，容颜衰老"],
    ["容光焕发", "脸上光彩四射，身体健康"],
    ["发号施令", "发布命令，指挥别人"],
    ["令行禁止", "下令行动就立即行动，下令停止就立即停止"],
    ["止戈为武", "平定暴乱，停止用兵，才是真正的武功"],
    ["武艺高强", "武术本领高超"],
    ["强弩之末", "强弩所发的箭，已达射程的尽头，比喻强大的力量已经衰弱"],
    ["末路穷途", "形容到了无路可走的地步"],
    ["途穷日暮", "无路可走，天色已晚，比喻处境十分困难"],
    ["暮鼓晨钟", "佛教规矩，寺里晚上打鼓，早晨敲钟，比喻可以使人警觉醒悟的话"],
    ["钟灵毓秀", "凝聚了天地间的灵气，孕育着优秀的人物"],
    ["秀色可餐", "美丽的容貌或秀丽的景色好像可以当饭吃"],
    ["餐风饮露", "形容旅途或野外生活的艰苦"],
    ["露出马脚", "比喻暴露了隐蔽的事实真相"],
    ["脚踏实地", "比喻做事踏实认真"],
    ["地广人稀", "土地广阔，人烟稀少"],
    ["稀世珍宝", "世间很少有的珍贵宝物"],
    ["宝刀未老", "形容人到老年还依然威猛，不减当年"],
    ["老当益壮", "年纪虽老而志气更旺盛，干劲更足"],
    ["壮士断腕", "比喻做事要当机立断，不可犹豫不决"],
    ["腕底生风", "形容写字、画画时笔势矫健奔放"],
    ["风调雨顺", "风雨适合农时，形容年成好"],
    ["顺理成章", "写文章或做事情顺着条理就能做好"],
    ["章台杨柳", "比喻窈窕美丽的女子"],
    ["柳暗花明", "垂柳浓密，鲜花夺目，形容柳树成荫，繁花似锦的春天景象"],
    ["明察秋毫", "目光敏锐，连极小的东西都看得清清楚楚"],
    ["毫不犹豫", "形容做事非常果断，丝毫没有迟疑"],
    ["豫章故郡", "指江西南昌"],
    ["郡县制度", "古代中央集权体制下的地方行政制度"],
    ["治病救人", "比喻针对某人的缺点错误进行分析，目的是帮助他改正"],
    ["人山人海", "人群如山似海，形容人聚集得非常多"]
  ];

  async function runTool(intent) {
    var p = intent.params;
    if (intent.toolName === "weather") {
      var w = AgentLab.weatherSim(p.city, p.dateKey);
      return {
        name: "天气查询工具",
        summary: "查询" + p.city + p.dateKey + "天气",
        result: w.text + "。" + w.suggest + "。",
        payload: w
      };
    }
    if (intent.toolName === "calc") {
      var expr = p.expr;
      var value;
      try {
        value = Function("return (" + expr + ")")();
        if (typeof value !== "number" || !isFinite(value)) throw new Error("bad");
        value = Math.round(value * 1e6) / 1e6;
      } catch (e) {
        value = null;
      }
      return {
        name: "计算器工具",
        summary: "计算 " + expr,
        result: value === null ? "这个算式我算不了" : (expr + " = " + value),
        payload: { expr: expr, value: value }
      };
    }
    if (intent.toolName === "remind") {
      return {
        name: "提醒工具",
        summary: "记录一条提醒",
        result: "好的，我已经把“" + p.text + "”记下来了，到时间我会提醒你。",
        payload: {}
      };
    }
    if (intent.toolName === "search") {
      try {
        var res = await AgentLab.API.search(p.query);
        if (res.blocked) {
          return {
            name: "联网搜索工具",
            summary: "搜索“" + p.query + "”",
            result: "这个话题不适合课堂搜索，请换一个内容再来问我。",
            payload: { blocked: true }
          };
        }
        if (!res.results || !res.results.length) {
          return {
            name: "联网搜索工具",
            summary: "搜索“" + p.query + "”",
            result: "没有搜到关于“" + p.query + "”的相关资料，请换个问法试试。",
            payload: { results: [] }
          };
        }
        var lines = res.results.slice(0, 4).map(function (r, i) {
          return (i + 1) + ". " + (r.title || "") + "（" + (r.source || "") + "）\n   " + (r.snippet || "") + "\n   " + (r.url || "");
        });
        return {
          name: "联网搜索工具",
          summary: "搜索“" + p.query + "”",
          result: lines.join("\n"),
          payload: res
        };
      } catch (e) {
        return {
          name: "联网搜索工具",
          summary: "搜索“" + p.query + "”",
          result: "搜索服务暂时不可用：" + (e.message || "网络错误"),
          payload: {}
        };
      }
    }
    if (intent.toolName === "translate") {
      try {
        var sys = "你是一个专业的翻译工具。把用户给的内容翻译成" + (p.target === "zh" ? "简体中文" : "英语") + "。只输出译文本身，不要任何解释、注释或前后缀。";
        var ans = await AgentLab.API.ask(sys, p.text);
        return {
          name: "翻译工具",
          summary: "把“" + p.text + "”翻译成" + (p.target === "zh" ? "中文" : "英文"),
          result: ans || "（翻译工具没有返回结果）",
          payload: { text: p.text, target: p.target }
        };
      } catch (e) {
        return {
          name: "翻译工具",
          summary: "翻译“" + p.text + "”",
          result: "翻译服务暂时不可用：" + (e.message || "网络错误"),
          payload: {}
        };
      }
    }
    if (intent.toolName === "convert") {
      var num = p.value;
      var from = p.from, to = p.to;
      var resultText = "";
      if (from === "摄氏度" || from === "华氏度") {
        if (from === to) {
          resultText = from + "和" + to + "是同一个单位，不需要换算";
        } else if (from === "摄氏度") {
          resultText = num + "摄氏度 = " + Math.round((num * 9 / 5 + 32) * 100) / 100 + " 华氏度";
        } else {
          resultText = num + "华氏度 = " + Math.round(((num - 32) * 5 / 9) * 100) / 100 + " 摄氏度";
        }
      } else {
        var cat = null;
        for (var c in CONVERT_UNITS) {
          if (CONVERT_UNITS[c][from] !== undefined && CONVERT_UNITS[c][to] !== undefined) { cat = c; break; }
        }
        if (!cat) {
          resultText = "这两个单位不能直接换算";
        } else {
          var base = CONVERT_UNITS[cat];
          var v = num * base[from] / base[to];
          v = Math.round(v * 1e6) / 1e6;
          resultText = num + from + " = " + v + " " + to;
        }
      }
      return {
        name: "单位换算工具",
        summary: "换算 " + num + from + " → " + to,
        result: resultText,
        payload: { value: num, from: from, to: to }
      };
    }
    if (intent.toolName === "datetime") {
      var now = new Date();
      var wk = ["日", "一", "二", "三", "四", "五", "六"];
      var pad = function (n) { return (n < 10 ? "0" : "") + n; };
      var y = now.getFullYear(), mo = now.getMonth() + 1, d = now.getDate();
      var hh = pad(now.getHours()), mm = pad(now.getMinutes()), ss = pad(now.getSeconds());
      var wd = wk[now.getDay()];
      var todayText = y + "年" + mo + "月" + d + "日 星期" + wd;
      var nowText = "现在是 " + hh + ":" + mm + ":" + ss + "，" + todayText;
      var parts = [nowText];
      // 日期推算：N天后 / 明天 / 后天 / 下周X
      var target = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var offM = p.text.match(/([0-9]+|[一二两三四五六七八九十]+)\s*天(?:后|之后|以后)/);
      var offsetLabel = null;
      if (offM) {
        var offv = /^[0-9]/.test(offM[1]) ? parseInt(offM[1], 10) : parseCnNum(offM[1]);
        if (offv !== null) { target.setDate(target.getDate() + offv); offsetLabel = offM[1] + "天后"; }
      }
      else if (/后天/.test(p.text)) { target.setDate(target.getDate() + 2); offsetLabel = "后天"; }
      else if (/明天/.test(p.text)) { target.setDate(target.getDate() + 1); offsetLabel = "明天"; }
      else if (/昨天/.test(p.text)) { target.setDate(target.getDate() - 1); offsetLabel = "昨天"; }
      var nextM = p.text.match(/下(?:周|星期|礼拜)([一二三四五六日天])/);
      if (nextM) {
        var want = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 }[nextM[1]];
        var diff = (want - now.getDay() + 7) % 7;
        diff = diff === 0 ? 7 : diff;
        target.setDate(target.getDate() + diff);
        offsetLabel = "下周" + nextM[1];
      }
      if (offsetLabel) {
        var wd2 = wk[target.getDay()];
        parts.push(offsetLabel + "是 " + target.getFullYear() + "年" + (target.getMonth() + 1) + "月" + target.getDate() + "日 星期" + wd2);
      }
      return {
        name: "时间日期工具",
        summary: "查询当前时间/日期",
        result: parts.join("；"),
        payload: { now: nowText, today: todayText, offset: offsetLabel }
      };
    }
    if (intent.toolName === "shape") {
      var nums = p.nums;
      var R2 = function (x) { return Math.round(x * 100) / 100; };
      var out = [];
      var shapeCN = { square: "正方形", cube: "正方体", rect: "长方形", cuboid: "长方体", triangle: "三角形", parallelogram: "平行四边形", trapezoid: "梯形", circle: "圆" }[p.shape];
      if (p.shape === "square") {
        var a = nums[0];
        out.push(shapeCN + "边长 " + a + "：面积 = " + a + "×" + a + " = " + R2(a * a) + "（平方单位）；周长 = 4×" + a + " = " + R2(4 * a));
      } else if (p.shape === "cube") {
        var a2 = nums[0];
        out.push(shapeCN + "棱长 " + a2 + "：体积 = " + a2 + "³ = " + R2(a2 * a2 * a2) + "（立方单位）；表面积 = 6×" + a2 + "² = " + R2(6 * a2 * a2));
      } else if (p.shape === "rect") {
        var w = nums[0], h = nums[1];
        out.push(shapeCN + "长" + w + " 宽" + h + "：面积 = " + w + "×" + h + " = " + R2(w * h) + "（平方单位）；周长 = 2×(" + w + "+" + h + ") = " + R2(2 * (w + h)));
      } else if (p.shape === "cuboid") {
        var l = nums[0], w2 = nums[1], h2 = nums[2];
        out.push(shapeCN + "长" + l + " 宽" + w2 + " 高" + h2 + "：体积 = " + l + "×" + w2 + "×" + h2 + " = " + R2(l * w2 * h2) + "（立方单位）；表面积 = 2×(" + l + "×" + w2 + "+" + l + "×" + h2 + "+" + w2 + "×" + h2 + ") = " + R2(2 * (l * w2 + l * h2 + w2 * h2)));
      } else if (p.shape === "triangle") {
        var b = nums[0], h3 = nums[1];
        out.push(shapeCN + "底" + b + " 高" + h3 + "：面积 = 底×高÷2 = " + b + "×" + h3 + "÷2 = " + R2(b * h3 / 2));
      } else if (p.shape === "parallelogram") {
        var b2 = nums[0], h4 = nums[1];
        out.push(shapeCN + "底" + b2 + " 高" + h4 + "：面积 = 底×高 = " + b2 + "×" + h4 + " = " + R2(b2 * h4));
      } else if (p.shape === "trapezoid") {
        var up = nums[0], dn = nums[1], h5 = nums[2];
        out.push(shapeCN + "上底" + up + " 下底" + dn + " 高" + h5 + "：面积 = (上底+下底)×高÷2 = (" + up + "+" + dn + ")×" + h5 + "÷2 = " + R2((up + dn) * h5 / 2));
      } else if (p.shape === "circle") {
        var r = p.diameter ? nums[0] / 2 : nums[0];
        var pi = Math.PI;
        out.push(shapeCN + "半径 " + r + "：面积 = πr² = " + R2(pi * r * r) + "（平方单位）；周长 = 2πr = " + R2(2 * pi * r) + (p.diameter ? "（按直径" + nums[0] + "推算半径）" : ""));
      }
      return {
        name: "图形计算工具",
        summary: "计算" + shapeCN + (p.shape === "circle" && p.diameter ? "（直径" + nums[0] + "）" : "") + "的面积/周长/体积",
        result: out.join("；"),
        payload: { shape: p.shape, nums: nums }
      };
    }
    if (intent.toolName === "math") {
      var R3 = function (x) { return Math.round(x * 100) / 100; };
      if (p.kind === "average") {
        var sum = 0;
        p.nums.forEach(function (n) { sum += n; });
        var avg = R3(sum / p.nums.length);
        return {
          name: "数学计算工具",
          summary: "求 " + p.nums.join("、") + " 的平均数",
          result: "平均数 = " + p.nums.join(" + ") + " ÷ " + p.nums.length + " = " + R3(sum) + " ÷ " + p.nums.length + " = " + avg,
          payload: { kind: "average", avg: avg }
        };
      }
      if (p.kind === "percent") {
        var v = R3(p.base * p.rate / 100);
        return {
          name: "数学计算工具",
          summary: "求 " + p.base + " 的 " + p.rate + "%",
          result: p.base + " × " + p.rate + "% = " + p.base + " × 0." + (p.rate < 10 ? "0" : "") + p.rate + " = " + v,
          payload: { kind: "percent", value: v }
        };
      }
      if (p.kind === "discount") {
        var v2 = R3(p.base * p.rate / 10);
        return {
          name: "数学计算工具",
          summary: p.base + "元 打" + p.rate + "折",
          result: "折后价 = " + p.base + " × " + p.rate + "÷10 = " + p.base + " × " + R3(p.rate / 10) + " = " + v2 + " 元",
          payload: { kind: "discount", value: v2 }
        };
      }
      return {
        name: "数学计算工具",
        summary: "数学计算",
        result: "这个数学问题缺少必要数字，请把数字补全再问我。",
        payload: {}
      };
    }
    if (intent.toolName === "timer") {
      var secs = p.seconds;
      var label = p.label;
      var remindText = p.remindText || "";
      return {
        name: "计时器工具",
        summary: "开始 " + label + " 倒计时" + (p.pomodoro ? "（番茄钟）" : ""),
        result: "倒计时已开始：" + label + "。时间到我会提醒！" + (remindText ? "（提醒内容：" + remindText + "）" : "") + (p.pomodoro ? "番茄工作法：专注" + label + "，然后休息5分钟。" : ""),
        payload: { seconds: secs, minutes: p.minutes, label: label, pomodoro: p.pomodoro, remindText: remindText }
      };
    }
    if (intent.toolName === "game") {
      if (p.action === "start") {
        gameState = { secret: Math.floor(Math.random() * 100) + 1, attempts: 0, low: 1, high: 100 };
        return {
          name: "猜数字游戏工具",
          summary: "开始猜数字游戏",
          result: "我已经想好了一个 1 到 100 之间的整数。你每猜一次，我会告诉你“大了”还是“小了”。来吧，猜猜看！",
          payload: { action: "start", low: 1, high: 100 }
        };
      }
      if (p.action === "stop") {
        var old = gameState;
        gameState = null;
        return {
          name: "猜数字游戏工具",
          summary: "结束猜数字游戏",
          result: old ? "游戏结束！答案是 " + old.secret + "，你一共猜了 " + old.attempts + " 次。" : "现在没有进行中的猜数字游戏。",
          payload: { action: "stop", secret: old && old.secret, attempts: old && old.attempts }
        };
      }
      if (p.action === "guess") {
        if (!gameState) {
          return {
            name: "猜数字游戏工具",
            summary: "猜数字",
            result: "还没有开始游戏呢，说“猜数字”我们就开始。",
            payload: { action: "none" }
          };
        }
        var g = p.guess;
        if (typeof g !== "number" || !isFinite(g) || g < 1 || g > 100 || g !== Math.floor(g)) {
          return {
            name: "猜数字游戏工具",
            summary: "猜数字",
            result: "请输入 1 到 100 之间的整数。",
            payload: { action: "invalid" }
          };
        }
        gameState.attempts++;
        if (g === gameState.secret) {
          var finalAttempts = gameState.attempts;
          var s = gameState.secret;
          gameState = null;
          return {
            name: "猜数字游戏工具",
            summary: "猜中啦",
            result: "猜中啦！答案就是 " + s + "，你用了 " + finalAttempts + " 次。" + (finalAttempts <= 7 ? "哇，不超过 7 次，你是二分法高手！" : "想一想：每次把范围砍一半（二分法），最多 7 次就能猜中 1~100 里的任何数。"),
            payload: { action: "win", secret: s, attempts: finalAttempts }
          };
        }
        if (g < gameState.secret) { gameState.low = Math.max(gameState.low, g + 1); }
        else { gameState.high = Math.min(gameState.high, g - 1); }
        return {
          name: "猜数字游戏工具",
          summary: "猜 " + g,
          result: (g < gameState.secret ? "小了！" : "大了！") + " 范围缩小到 " + gameState.low + " ~ " + gameState.high + "。继续猜（已猜 " + gameState.attempts + " 次）。",
          payload: { action: "again", low: gameState.low, high: gameState.high, attempts: gameState.attempts }
        };
      }
      return {
        name: "猜数字游戏工具",
        summary: "猜数字",
        result: "猜数字游戏：说“猜数字”开始，然后猜 1~100 里的整数。",
        payload: {}
      };
    }
    if (intent.toolName === "idiom") {
      if (p.action === "start") {
        var starts = {};
        IDIOMS.forEach(function (it) { var c = it[0].charAt(0); starts[c] = (starts[c] || 0) + 1; });
        var pool = IDIOMS.filter(function (it) { return starts[it[0].charAt(it[0].length - 1)] > 0; });
        var pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : IDIOMS[0];
        var w = pick[0];
        idiomState = { lastChar: w.charAt(w.length - 1), count: 0, used: [w] };
        return {
          name: "成语接龙工具",
          summary: "开始成语接龙",
          result: "好，我先来：" + w + "（" + pick[1] + "）。请你接一个以“" + idiomState.lastChar + "”开头的成语！",
          payload: { action: "start", word: w, lastChar: idiomState.lastChar }
        };
      }
      if (p.action === "stop") {
        var oldI = idiomState;
        idiomState = null;
        return {
          name: "成语接龙工具",
          summary: "结束成语接龙",
          result: oldI ? "接龙结束！你一共接上了 " + oldI.count + " 个成语，真棒！" : "现在没有进行中的接龙。",
          payload: { action: "stop", count: oldI && oldI.count }
        };
      }
      if (p.action === "hint") {
        if (!idiomState) {
          return { name: "成语接龙工具", summary: "成语接龙", result: "还没有开始接龙呢，说“成语接龙”就开始。", payload: {} };
        }
        var cands = IDIOMS.filter(function (it) { return it[0].charAt(0) === idiomState.lastChar && idiomState.used.indexOf(it[0]) < 0; });
        var hintW = cands.length ? cands[0] : null;
        return {
          name: "成语接龙工具",
          summary: "提示",
          result: hintW ? "提示：以“" + idiomState.lastChar + "”开头的成语有“" + hintW[0] + "”（" + hintW[1] + "）。你能想到别的吗？" : "接“" + idiomState.lastChar + "”的成语库暂时没有了，你可以自创一个首字为“" + idiomState.lastChar + "”的四字词！",
          payload: { action: "hint", word: hintW && hintW[0] }
        };
      }
      if (p.action === "answer") {
        if (!idiomState) {
          return { name: "成语接龙工具", summary: "成语接龙", result: "还没有开始接龙呢，说“成语接龙”就开始。", payload: {} };
        }
        var w2 = p.word || "";
        if (w2.length < 2) {
          return { name: "成语接龙工具", summary: "成语接龙", result: "请说出一个四字成语来接龙。", payload: {} };
        }
        var first = w2.charAt(0);
        var isStrict = (first === idiomState.lastChar);
        var isHomophoneMatch = !isStrict && isHomophone(first, idiomState.lastChar);
        if (!isStrict && !isHomophoneMatch) {
          return {
            name: "成语接龙工具",
            summary: "接“" + idiomState.lastChar + "”",
            result: "不对哦，接龙要以上一个成语的最后一个字“" + idiomState.lastChar + "”开头（同音谐音字也可以）。你接的是“" + w2 + "”，第一个字是“" + first + "”。再试试，也可以说“提示”。",
            payload: { action: "wrong", lastChar: idiomState.lastChar }
          };
        }
        idiomState.count++;
        idiomState.used.push(w2);
        var def = null;
        for (var i = 0; i < IDIOMS.length; i++) {
          if (IDIOMS[i][0] === w2) { def = IDIOMS[i][1]; break; }
        }
        var last = w2.charAt(w2.length - 1);
        var homophoneNote = isHomophoneMatch ? "（谐音接龙！“" + first + "”和“" + idiomState.lastChar + "”读音相同）" : "";
        // 智能体接龙：从库中选一个以 last 开头、或与 last 同音的字开头、未用过的成语接上
        var aiCands = IDIOMS.filter(function (it) {
          var aiFirst = it[0].charAt(0);
          return (aiFirst === last || isHomophone(aiFirst, last)) && idiomState.used.indexOf(it[0]) < 0;
        });
        if (aiCands.length) {
          var aiPick = aiCands[Math.floor(Math.random() * aiCands.length)];
          idiomState.used.push(aiPick[0]);
          var aiLast = aiPick[0].charAt(aiPick[0].length - 1);
          var aiHomophone = (aiPick[0].charAt(0) !== last) ? "（谐音接“" + last + "”）" : "";
          idiomState.lastChar = aiLast;
          return {
            name: "成语接龙工具",
            summary: "接上“" + w2 + "”",
            result: "接得好！“" + w2 + "”" + homophoneNote + (def ? "：" + def + "。" : "（这个成语我没有收录，你比我厉害！）") + " 我接：“" + aiPick[0] + "”" + aiHomophone + "（" + aiPick[1] + "）。现在该你接“" + aiLast + "”开头的成语啦（同音谐音字也可以）！",
            payload: { action: "ok", word: w2, aiWord: aiPick[0], lastChar: aiLast, count: idiomState.count, homophone: isHomophoneMatch }
          };
        }
        // 智能体接不上，学生赢
        var finalCount = idiomState.count;
        idiomState = null;
        return {
          name: "成语接龙工具",
          summary: "接龙结束",
          result: "接得好！“" + w2 + "”" + homophoneNote + (def ? "：" + def + "。" : "") + " 这个“" + last + "”字我接不上啦，你赢了！一共接了 " + finalCount + " 个成语，厉害！",
          payload: { action: "win", word: w2, count: finalCount }
        };
      }
      return {
        name: "成语接龙工具",
        summary: "成语接龙",
        result: "成语接龙：说“成语接龙”开始，然后接一个首字与上一成语末字相同的成语。",
        payload: {}
      };
    }
    return null;
  }

  /* ---------- 记忆收集（记忆器） ---------- */

  function collectMemory(history) {
    var classInfo = AgentLab.Store.getClassInfo();
    var manual = AgentLab.Store.getManual();
    var tools = AgentLab.Store.getTools();
    var kbItems = 0;
    ["className", "slogan", "schedule", "duty", "notice", "teacher"].forEach(function (k) {
      if (classInfo[k] && String(classInfo[k]).trim()) kbItems++;
    });
    return {
      classInfo: classInfo,
      manual: manual,
      tools: tools,
      kbItems: kbItems,
      historyCount: history ? history.length : 0
    };
  }

  /* ---------- 组装发给大脑的消息 ---------- */

  function buildMessages(intent, userText, memory, history, toolResult, toolBlocked) {
    var sys = AgentLab.buildSystemPrompt(memory.classInfo, memory.manual);
    var messages = [{ role: "system", content: sys }];

    // 短期记忆：最近几轮对话原样保留
    (history || []).forEach(function (m) {
      messages.push({ role: m.role, content: m.content });
    });

    // 把工具结果“喂”给大脑（教学口径：执行器查到的东西，大脑要拿来用）
    var userPayload = userText;
    if (toolResult) {
      userPayload = userText + "\n\n【执行器工具结果】你刚刚通过" + toolResult.name + toolResult.summary + "，查到的结果是：\n" + toolResult.result + "\n请用同学听得懂的话，基于这个真实结果回答。";
    } else if (toolBlocked) {
      userPayload = userText + "\n\n【执行器被关闭】你没有成功调用任何工具，查不到真实数据。请如实告诉同学：这个工具没有打开/执行器被关掉了，我查不到，所以不能告诉你答案。绝对不要编造数字或结果。";
    } else if (intent.toolName === "classInfo") {
      userPayload = userText + "\n\n【记忆器提示】你的班级知识库里存着：\n" + AgentLab.formatClassInfo(memory.classInfo) + "\n请从中找出答案回答。";
    }
    messages.push({ role: "user", content: userPayload });
    return messages;
  }

  /* ---------- 对外主流程 ---------- */

  function delay(ms) {
    return new Promise(function (res) { setTimeout(res, ms); });
  }

  /**
   * 运行一轮完整的“感知→规划→记忆→执行→大脑”流程
   * @param {string} userText 学生说的话
   * @param {Array} history   此前的对话（短期记忆）
   * @param {Object} hooks    { onStage(stageId, text), onTool(toolInfo), onDone(answer), onError(err) }
   */
  async function run(userText, history, hooks) {
    hooks = hooks || {};
    var t0 = Date.now();
    try {
      // ① 感知器
      if (!flags.perception) {
        hooks.onStage && hooks.onStage("perception", "感知器被关闭了，听不到任何声音");
        await delay(500);
        hooks.onStage && hooks.onStage("brain", "大脑没事做");
        hooks.onDone && hooks.onDone("我什么也听不到……（感知器被关掉了，请你先把它打开！）");
        return "我什么也听不到……（感知器被关掉了，请你先把它打开！）";
      }
      hooks.onStage && hooks.onStage("perception", "收到你的问题：" + userText);
      await delay(STAGE_DELAY);

      // ② 规划器
      var intent = detectIntent(userText);
      if (flags.planner) {
        hooks.onStage && hooks.onStage("planner", "制定计划：" + intent.plan.join(" → "));
        await delay(STAGE_DELAY + 300);
      } else {
        hooks.onStage && hooks.onStage("planner", "规划器被关闭，想到哪说到哪");
        await delay(300);
      }

      // ③ 记忆器
      var memory = collectMemory(flags.memory ? history : []);
      if (!flags.memory) {
        // 记忆器被关闭：连班级知识库也一起“忘掉”，教学演示才真实
        memory.classInfo = {};
        memory.manual = "";
        memory.kbItems = 0;
      }
      if (flags.memory) {
        var memText = "翻开长期记忆小本子：找到班级知识 " + memory.kbItems + " 条";
        if (memory.historyCount > 0) memText += "，本次对话 " + memory.historyCount + " 轮";
        hooks.onStage && hooks.onStage("memory", memText);
      } else {
        hooks.onStage && hooks.onStage("memory", "记忆器被关闭，翻不了小本子，也不记得刚才说过的话");
      }
      await delay(STAGE_DELAY);

      // ④ 执行器
      var toolResult = null;
      var toolBlocked = null;
      var TOOL_LABELS = {
        weather: "天气查询工具", calc: "计算器工具", remind: "提醒工具",
        search: "联网搜索工具", translate: "翻译工具", convert: "单位换算工具",
        datetime: "时间日期工具", shape: "图形计算工具", math: "数学计算工具",
        timer: "计时器工具", game: "猜数字游戏工具", idiom: "成语接龙工具"
      };
      if (intent.needTool) {
        if (flags.executor && memory.tools[intent.toolName] !== false) {
          var toolLabel = TOOL_LABELS[intent.toolName] || "工具";
          hooks.onStage && hooks.onStage("executor", "调用工具：" + toolLabel);
          toolResult = await runTool(intent);
          hooks.onTool && toolResult && hooks.onTool(toolResult);
        } else if (!flags.executor) {
          toolBlocked = "executorOff";
          hooks.onStage && hooks.onStage("executor", "执行器被关闭了，没法调用工具");
        } else {
          toolBlocked = "toolOff";
          hooks.onStage && hooks.onStage("executor", "这个工具被关掉了，没法调用");
        }
        await delay(STAGE_DELAY);
      } else if (intent.toolName === "classInfo") {
        hooks.onStage && hooks.onStage("executor", "这个问题不用外部工具，用记忆器里的班级知识就能回答");
        await delay(STAGE_DELAY - 200);
      } else {
        hooks.onStage && hooks.onStage("executor", "这个问题不需要调用工具，直接回答");
        await delay(STAGE_DELAY - 200);
      }

      // ⑤ 大语言模型大脑
      hooks.onStage && hooks.onStage("brain", "大语言模型正在组织回答…");
      var messages = buildMessages(intent, userText, memory, flags.memory ? history : [], toolResult, toolBlocked);
      // 把真实发给大脑的载荷暴露给页面（教学：让学生看到“上下文”长什么样）
      hooks.onPayload && hooks.onPayload(messages, { toolResult: toolResult, toolBlocked: toolBlocked, intent: intent, memory: memory });
      var answer = await AgentLab.API.chat(messages);
      if (!answer || !answer.trim()) answer = "（大脑没有说出话来，请再问我一次吧）";
      hooks.onStage && hooks.onStage("brain", "回答完成，用时 " + Math.round((Date.now() - t0) / 100) / 10 + " 秒");
      hooks.onDone && hooks.onDone(answer);
      return answer;
    } catch (e) {
      hooks.onError && hooks.onError(e);
      throw e;
    }
  }

  return {
    run: run,
    detectIntent: detectIntent,
    runTool: runTool,
    flags: flags,
    MAX_HISTORY: MAX_HISTORY
  };
})();
