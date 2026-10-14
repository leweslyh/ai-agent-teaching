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

    // 11) 普通问题
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

  async function runTool(intent) {
    var p = intent.params;
    if (intent.toolName === "weather") {
      // 真实天气：联网调用 Open-Meteo（免费、无需 Key），失败时如实告知，绝不编造
      var w = await AgentLab.API.getWeather(p.city, p.dateKey);
      if (!w || !w.ok) {
        return {
          name: "天气查询工具",
          summary: "查询" + p.city + p.dateKey + "天气",
          result: (w && w.error ? w.error : "天气服务暂时不可用") +
            "。请如实告诉同学：这次没有查到真实天气，不要编造任何数字。",
          payload: w || {}
        };
      }
      return {
        name: "天气查询工具",
        summary: "查询" + w.city + w.date + "天气",
        result: w.text + "。" + w.suggest + "。（数据来源：" + w.source + "）",
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
        if (res.mode === "deepseek") {
          /* ① DeepSeek 服务端联网搜索：拿回的是“搜索后整理的资料”+ 引用来源，
           * 不是一列网页——这一点要在结果里写清楚，方便学生对照着看。 */
          var src = "";
          if (res.results && res.results.length) {
            src = "\n来源：\n" + res.results.slice(0, 5).map(function (r, i) {
              return (i + 1) + ". " + (r.title || "") + (r.url ? "　" + r.url : "");
            }).join("\n");
          }
          return {
            name: "联网搜索工具",
            summary: "搜索“" + p.query + "”（DeepSeek 服务端联网搜索）",
            result: "联网搜索成功。以下是搜索后整理出的资料：\n" + res.summary + src +
                    "\n（资料由 DeepSeek 服务端联网获取并整理）",
            payload: { mode: "deepseek", query: p.query, summary: res.summary }
          };
        }
        if (res.fallback) {
          /* 联网没成功 → 大模型已有知识兜底。必须如实标注“不是刚查到的网页”，
           * 让大脑在回答时也告诉同学这一点——宁可说明来源，也不能冒充搜索结果。 */
          return {
            name: "联网搜索工具",
            summary: "搜索“" + p.query + "”（联网没成功 → 用大脑已有知识兜底）",
            result: "联网搜索暂时没成功：这台设备的网络访问不到搜索引擎。\n" +
                    "下面是大模型用自己学过的知识整理的回答——不是刚查到的网页，" +
                    "回答时请先向同学说明这一点：\n" + res.summary +
                    (res.trace ? "\n（诊断：" + res.trace + "）" : ""),
            payload: { fallback: true, query: p.query, summary: res.summary }
          };
        }
        if (!res.results || !res.results.length) {
          return {
            name: "联网搜索工具",
            summary: "搜索“" + p.query + "”",
            result: res.error || ("没有搜到关于“" + p.query + "”的相关资料，请换个问法试试。"),
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

  /* ---------- 组装发给大脑的消息 ----------
   * 消息四角色（Chat 协议）：system 定规则、user 提问、assistant 回话、tool 回传数据。
   * 记忆不是第五种角色——它存在上下文之外，被“翻出来”时才借一个角色放进上下文：
   *   · 长期记忆档案（班级知识库、边界说明书）→ 一直随 system 一起给；
   *   · 短期记忆（轨迹）→ 原样回放成 user / assistant 历史；
   *   · 工具结果 → 走 tool 角色（这是执行器的产物，不算记忆）。 */

  /* 工具名（中文意图 key）→ Function Calling 里的英文函数名 */
  var TOOL_FN = {
    weather: "weather_query", calc: "calculator", remind: "reminder_set",
    search: "web_search", translate: "translate_text", convert: "unit_convert",
    datetime: "datetime_now", shape: "shape_calc", math: "math_calc", timer: "timer_start"
  };

  /* ---------- 工具结果的“写法兼容层” ----------
   * 标准写法（mode = ""）：assistant(tool_calls) + tool 两条消息，和真实 API 一致。
   * 但个别模型有额外要求，按下面的顺序自动降级；用哪种写法会记在浏览器里，
   * 同一个模型下次直接用能用的写法，不再多花一次请求：
   *   ""          → 标准写法；
   *   "reasoning" → 标准写法 + 给 assistant 补一个空 reasoning_content
   *                 （DeepSeek V4 等思考模式：带 tool_calls 的 assistant 消息必须回传该字段，
   *                  否则接口报 400 “reasoning_content … must be passed back”）；
   *   "legacy"    → 把工具结果拼进 user 消息（最兼容，牺牲一点“真实形态”）。 */
  var COMPAT_KEY = "agentlab_tool_compat_v1";

  function getCompat(model) {
    var all = AgentLab.Store.get(COMPAT_KEY, {}) || {};
    return all[model] || "";
  }

  function setCompat(model, mode) {
    var all = AgentLab.Store.get(COMPAT_KEY, {}) || {};
    if (all[model] === mode) return;
    all[model] = mode;
    AgentLab.Store.set(COMPAT_KEY, all);
  }

  /* 这次失败能不能靠“换一种写法”解决？返回下一种写法，或 null（换写法也没用） */
  function nextCompatMode(mode, err) {
    var msg = ((err && err.message) || "") + "";
    // 模型名不对、密钥不对、网络不通……换写法都没用，直接把错误抛出去
    if (/模型名|not\s+exist|unknown\s+model|API\s*密钥|网络连接失败|请求超时|余额/i.test(msg)) return null;

    // 思考模式要求回传 reasoning_content：先补字段，再不行才退到最兼容写法
    if (/reasoning_content|thinking\s*mode|思考模式/i.test(msg)) {
      if (mode === "") return "reasoning";
      if (mode === "reasoning") return "legacy";
      return null;
    }
    // 其他“消息格式被拒”的情况：直接退到最兼容的写法
    if (mode !== "legacy" && (/tool_calls|tool_call_id|角色|格式|invalid|message/i.test(msg) || (err && err.status) === 400)) {
      return "legacy";
    }
    return null;
  }

  /**
   * @param {Object} [opts] { mode: "" | "reasoning" | "legacy" } —— 工具结果的写法（见上方说明）
   */
  function buildMessages(intent, userText, memory, history, toolResult, toolBlocked, opts) {
    var mode = (opts && opts.mode) || "";
    var legacyToolResult = mode === "legacy";
    var sys = AgentLab.buildSystemPrompt(memory.classInfo, memory.manual);
    var messages = [{ role: "system", content: sys }];

    // 短期记忆：最近几轮对话原样保留（它们本来就带着 user / assistant 的角色）
    (history || []).forEach(function (m) {
      messages.push({ role: m.role, content: m.content });
    });

    // 这一轮的 user 消息：班级档案已经随 system 一起给了，不再重复塞一遍
    var userPayload = userText;
    if (toolBlocked) {
      userPayload = userText + "\n\n【执行器被关闭】你没有成功调用任何工具，查不到真实数据。请如实告诉同学：这个工具没有打开/执行器被关掉了，我查不到，所以不能告诉你答案。绝对不要编造数字或结果。";
    } else if (toolResult && legacyToolResult) {
      userPayload = userText + "\n\n【执行器工具结果】你刚刚通过" + toolResult.name + toolResult.summary + "，查到的结果是：\n" + toolResult.result + "\n请用同学听得懂的话，基于这个真实结果回答。";
    }
    messages.push({ role: "user", content: userPayload });

    // 工具结果：标准写法是 assistant 请求调用（tool_calls）+ tool 回传数据 两条消息。
    // 教学说明：本项目由规划器在本地判定调用哪个工具（省一次往返），
    //          但发给模型时仍写成标准的 tool_calls，和真实 Function Calling 的样子一致。
    if (toolResult && !legacyToolResult) {
      var callId = "call_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      var callMsg = {
        role: "assistant",
        content: "",
        tool_calls: [{
          id: callId,
          type: "function",
          function: {
            name: TOOL_FN[intent.toolName] || "tool_call",
            arguments: JSON.stringify(intent.params || {})
          }
        }]
      };
      // 思考模式（DeepSeek V4 等）要求带 tool_calls 的 assistant 消息回传 reasoning_content 字段
      if (mode === "reasoning") callMsg.reasoning_content = "";
      messages.push(callMsg);
      messages.push({ role: "tool", tool_call_id: callId, content: toolResult.result });
    }
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
   * @param {Object} hooks    { onStage(stageId, text, flag), onTool(toolInfo), onPayload(msgs, info),
   *                            onDone(answer), onError(err) }
   *                          onStage 的第三个参数 flag === "skip" 表示“这一环本轮不参与”
   *                          （例如本轮不需要调用工具）——界面据此显示成灰色“未参与”，而不是点亮
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
        timer: "计时器工具"
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
        // 第三个参数 "skip"：告诉界面“这一环本轮不参与”，不要点亮它
        hooks.onStage && hooks.onStage("executor", "不用外部工具：用记忆器里的班级知识就能回答", "skip");
        await delay(STAGE_DELAY - 200);
      } else {
        hooks.onStage && hooks.onStage("executor", "不需要调用工具：直接交给大脑回答", "skip");
        await delay(STAGE_DELAY - 200);
      }

      // ⑤ 大语言模型大脑
      hooks.onStage && hooks.onStage("brain", "大语言模型正在组织回答…");
      /* 工具结果换“写法”重试：标准写法不行就补 reasoning_content，再不行就退回兼容写法，
       * 并把能用的写法按模型名记在浏览器里（下次不再多花一次请求）。 */
      var model = (AgentLab.API.getSettings && AgentLab.API.getSettings().model) || AgentLab.CONFIG.model;
      var mode = toolResult ? getCompat(model) : "";
      var learned = "";
      var answer = null;
      var lastErr = null;
      for (var attempt = 0; attempt < 3; attempt++) {
        var messages = buildMessages(intent, userText, memory, flags.memory ? history : [], toolResult, toolBlocked, { mode: mode });
        // 把真实发给大脑的载荷暴露给页面（教学：让学生看到“上下文”长什么样）
        hooks.onPayload && hooks.onPayload(messages, { toolResult: toolResult, toolBlocked: toolBlocked, intent: intent, memory: memory, mode: mode });
        try {
          answer = await AgentLab.API.chat(messages);
          if (learned) setCompat(model, learned);   // 记住：这个模型要用这种写法
          break;
        } catch (err) {
          lastErr = err;
          var nextMode = toolResult ? nextCompatMode(mode, err) : null;
          if (!nextMode) throw err;
          mode = nextMode;
          learned = nextMode;
        }
      }
      if (answer === null && lastErr) throw lastErr;
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
