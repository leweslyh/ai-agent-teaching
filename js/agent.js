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

  /* ---------- 计时器：时长解析 + 识别 ----------
   * 计时器是最容易被漏调的工具，所以单独抽出来、放在所有规则最前面判定。
   * 因为别的规则关键词更“宽”，很容易把它截胡：
   *   “计时的时候外面下雨吗”  → 被天气规则抢走；
   *   “25分钟提醒我去喝水”    → 被提醒规则抢走；
   *   “计时25分钟，然后25×4等于多少” → 被计算器规则抢走。
   * 漏掉的代价是“明明说了要计时，却只聊天不调工具”，这在课堂上最伤。 */

  /* 单位 → 秒。“分”“钟”都可省略：学生最常写的是「10分后」这种省字说法，
   * 写得太死板（只认「分钟」）就会大面积漏判。 */
  var DUR_SEC = { "小时": 3600, "钟头": 3600, "分钟": 60, "分": 60, "秒钟": 1, "秒": 1 };

  /* 数字 + 单位。「半」也算一个数，所以「半小时」「半分钟」都能识别。 */
  var DUR_RE = /([0-9]+(?:\.[0-9]+)?|半|[一二两三四五六七八九十百]+)\s*(小时|钟头|分钟|秒钟|秒|分)/g;

  /* 「一刻钟」「一个半小时」这类整体说法：必须先判，否则会被拆成「半小时」少算一半。 */
  var DUR_FRAG = [
    { re: /一个半(?:小时|钟头|钟)/, sec: 5400 },
    { re: /一刻钟/, sec: 900 }
  ];

  /**
   * 把一句话里的时长解析成秒数。
   * 多个时长直接相加——「1小时后30分钟」「5分2秒」都算得对。
   * @returns {?{seconds:number, minutes:number}} 解析不出来返回 null
   */
  function parseDuration(t) {
    if (!t) return null;
    var i, m;
    for (i = 0; i < DUR_FRAG.length; i++) {
      if (DUR_FRAG[i].re.test(t)) return durObj(DUR_FRAG[i].sec);
    }
    var sec = 0, hit = false;
    DUR_RE.lastIndex = 0;              // 正则带 /g，必须手动复位，否则第二次调用会漏
    while ((m = DUR_RE.exec(t)) !== null) {
      var num = m[1];
      var v = /^[0-9]/.test(num) ? parseFloat(num) : (num === "半" ? 0.5 : parseCnNum(num));
      if (v === null || isNaN(v)) continue;
      sec += v * DUR_SEC[m[2]];
      hit = true;
    }
    if (!hit || sec < 1) return null;
    /* 超上限只做钳制，不静默丢弃——丢弃就又退回“只聊天不调工具”了。
     * 标签用真实秒数重新格式化，所以钳到 24 小时学生也能看懂。 */
    return durObj(Math.min(Math.round(sec), 86400));
  }

  function durObj(sec) {
    return { seconds: sec, minutes: Math.round(sec / 60 * 10) / 10 };
  }

  /* 把句子里所有时长片段都抠掉，看看还剩什么——
   * 剩下的如果是语气词/祈使前缀（「来一个」「我想要」），说明这就是一句计时请求；
   * 如果还剩实质内容（「每天」「能做完吗」），那它只是一句话里的时间状语，不该起计时器。 */
  function durResidue(t) {
    return t.replace(DUR_RE, "")
      .replace(/一个半(?:小时|钟头|钟)/g, "")
      .replace(/一刻钟/g, "")
      .replace(/[。！!，,、？?；;：:\s]/g, "");
  }

  /* 允许的“残渣”：纯语气、礼貌用语和起手式 */
  var DUR_RESIDUE_OK = /^(帮我|给我|我要|我想|我需要|想要|来一个|来个|来|开始|启动|设一个|定一个|定个|加一个|安排|再|先|的|一个|个|吧|了|啊|呀|请|please)?$/;

  /* 秒数 → 人话标签（25分钟 / 1.5小时 / 30秒） */
  function fmtDuration(sec) {
    if (sec < 60) return sec + "秒";
    if (sec >= 3600) return (Math.round(sec / 3600 * 10) / 10) + "小时";
    return (Math.round(sec / 60 * 10) / 10) + "分钟";
  }

  /* 触发词：宁可多召回也别漏，误召回还有澄清问题兜着。 */
  var TIMER_RE = /(计时|计个?时|倒计时|倒着?数|定时|闹钟|番茄|沙漏|秒表|专注|数一?数|分钟?后|秒钟?后|小时?后|钟头?后|以后提醒|之后提醒|后提醒|后叫|后喊|后告诉|到点|时间到)/;
  /* 兜底①：祈使句 + 动作 + 时长——“帮我背单词20分钟”“我想专注25分钟”。 */
  var TIMER_ACT = /(?:帮我|给我|我要|我想|来一?个|开始|先|再|然后)?\s*(?:看|背|读|写|练|跑|跳|睡|站|蹲|复习|预习|锻炼|专注|冥想|数|计时|倒计时)\D{0,8}[0-9]/;
  /* 兜底②：有明确时长 + 有“提醒/叫我”这类动作词——“25分钟提醒我去喝水”。 */
  var TIMER_IMP = /(提醒我|叫我|喊我|告诉我|别忘|记着)/;

  /* 从句子里抽出“到点要做什么”，抽不出就返回空串（不要把“提醒我”本身当成内容） */
  function parseRemindText(t) {
    /* 前缀用贪婪的 .*，让它锚定“最后一个时长词后面的内容”——
     * 「1小时后30分钟提醒我写作业」要抓的是“写作业”，不能从“小时后”开始一路吞下去。 */
    var m = t.match(/.*(?:秒钟|秒|分钟|分|小时|钟头)后(?:之后|以后)?\s*(?:再)?\s*(?:提醒我|叫我|喊我|告诉我)?\s*(?:该|要|得|去)?\s*(.+)/) ||
            t.match(/(?:提醒我|叫我|喊我|告诉我)\s*(?:在)?\s*(?:该|要|得|去)?\s*(.+)/);
    if (!m) return "";
    /* 抽取区间里可能还夹着别的时长（「1小时后30分钟提醒我写作业」），
     * 所以先把残留的时长片段清掉，再剥掉开头的动作词和结尾的语气词。 */
    var s = m[1]
      .replace(DUR_RE, "")
      .replace(/^(再|去|该|要|得|提醒我|叫我|喊我|告诉我)/, "")
      .replace(/(了|啊|呀|吧|哦|嘛|喔)$/, "")
      .replace(/[。！？，,、.\s；;：:！!]+$/, "")
      .trim();
    /* “25分钟后提醒我” 只有动作没有内容，不要把“提醒我”当成提醒内容 */
    if (!s || /^(提醒我|叫我|喊我|告诉我|再|该|要|得|去)$/.test(s)) return "";
    return s;
  }

  /**
   * 计时器意图判定（放在 detectIntent 最前面调用）
   * @returns {?Object} 命中返回 intent，否则 null
   */
  function detectTimer(t, tools) {
    if (!tools.timer) return null;
    var dur = parseDuration(t);
    /* 触发条件只要满足其一：命中关键词；有时长 + 祈使动作；有时长 + “提醒/叫我”；
     * 或时长就是句子的全部（“25分钟”“来一个一刻钟”）。
     * 最后这条靠“抠掉时长看残渣”实现，能挡住“每天25分钟”“3小时能做完吗”这类误判。 */
    var onlyDur = !!dur && DUR_RESIDUE_OK.test(durResidue(t));
    if (!TIMER_RE.test(t) && !(dur && (TIMER_ACT.test(t) || TIMER_IMP.test(t) || onlyDur))) return null;

    var intent = { needTool: true, toolName: "timer", params: {}, plan: [] };
    var pomodoro = /番茄|专注/.test(t);

    /* 听出是计时请求、但同学没说计多久：照样把工具调出来，让大脑去反问。
     * 这样这一轮工作台里能看到“执行器真的参与了”，而不是“什么都没发生”。 */
    if (!dur) {
      intent.needDuration = true;
      intent.plan = ["听出这是要计时/倒计时", "调出计时器工具", "发现还没说计时多久", "反问同学要计多长时间"];
      return intent;
    }

    var remindText = parseRemindText(t);
    var lbl = fmtDuration(dur.seconds);
    intent.params = {
      seconds: dur.seconds,
      minutes: dur.minutes,
      label: remindText ? (lbl + "·" + remindText) : lbl,
      remindText: remindText,
      pomodoro: pomodoro
    };
    intent.plan = ["听懂要计时多久" + (remindText ? "（提醒：" + remindText + "）" : ""),
      "调出计时器工具", "开始倒计时", "时间到提醒同学"];
    return intent;
  }

  /* ---------- 意图识别（本地规则，相当于“规划器”的第一步） ---------- */

  function detectIntent(text) {
    var t = (text || "").replace(/\s+/g, "");
    var tools = AgentLab.Store.getTools();
    var intent = { needTool: false, toolName: "", params: {}, plan: [] };

    /* 计时器抢在所有规则前面（原因见 detectTimer 上方注释） */
    var timerIntent = detectTimer(t, tools);
    if (timerIntent) return timerIntent;

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

    // 3) 提醒任务 → 提醒工具（仅记下内容，不启动真实倒计时）
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
      /* 无 Key（降级模式）时翻译必然调不动——提前如实说明，
       * 比让它走到请求失败再看报错更清楚（课堂演示时不尴尬）。 */
      if (!(AgentLab.API.hasApiKey && AgentLab.API.hasApiKey())) {
        return {
          name: "翻译工具",
          summary: "把“" + p.text + "”翻译成" + (p.target === "zh" ? "中文" : "英文"),
          result: "翻译工具需要大模型来干活，而当前没有配置 API Key（降级模式只演示流程）——配置 Key 之后就能真的翻译。",
          payload: { needKey: true }
        };
      }
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
      /* 听出是计时请求、但同学没说计多久：工具照样调出来，由大脑去反问。
       * 早前这里是直接返回 null，工作台显示“什么都没发生”——学生看到的
       * 就只是小管家随口一句话，完全看不出执行器其实该上场。 */
      if (!secs) {
        return {
          name: "计时器工具",
          summary: "准备开始倒计时",
          result: "计时器已经准备好了，但同学还没有说要计多长时间。\n" +
            "请反问他要计多久，并顺手给两个例子，例如“计时25分钟”或“来一个25分钟的番茄钟”。",
          payload: { needDuration: true }
        };
      }
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

  /* ---------- 工具的「说明书」：交给大模型看的那一份 ----------
   * 这一步是整个架构的关键：把工具的 schema 连同消息一起发给模型，
   * **规划就不再是程序替模型做的决定，而是模型自己读说明后做的决定**。
   * 以前是本地正则先判好工具、再把结果伪造进消息——模型其实没有参与决策。
   * description 写得越具体，模型选工具和填参数就越准，所以这里逐条写清
   * “什么时候该用它”“参数怎么算”。 */
  var TOOL_SCHEMAS = [
    {
      key: "calc", fn: "calculator",
      desc: "精确计算一个算式。只要需要算数就必须用它，不要自己心算。",
      props: { expr: { type: "string", desc: "算式，用 + - * / 表示，例如 25*4+10、100/4" } },
      req: ["expr"]
    },
    {
      key: "weather", fn: "weather_query",
      desc: "查询某个城市某天的真实天气。同学问天气、下不下雨、气温多少度、要不要带伞、穿什么、适不适合运动时用它。",
      props: {
        city: { type: "string", desc: "城市名，例如 北京、上海。同学没提就用 北京" },
        dateKey: { type: "string", desc: "今天 / 明天 / 明早 / 明晚 / 后天 / 周末 / 下周" }
      }, req: ["city"]
    },
    {
      key: "timer", fn: "timer_start",
      desc: "启动一个真实倒计时（计时器 / 番茄钟 / 闹钟）。同学说“计时X分钟”“X分钟后提醒我”“来个番茄钟”“定个闹钟”时用它。" +
        "注意 seconds 必须是<b>换算成秒的整数</b>：25分钟=1500，10分钟=600，5分钟=300，半小时=1800，1.5小时=5400。",
      props: {
        seconds: { type: "number", desc: "倒计时秒数。25分钟填1500；10分钟填600；半小时填1800" },
        label: { type: "string", desc: "简短标签，例如 25分钟·写作业。同学没说要做什么就只写时长" },
        remindText: { type: "string", desc: "时间到了要提醒他做什么；同学没说就留空字符串" },
        pomodoro: { type: "boolean", desc: "同学说的是番茄钟或“专注”就填 true，否则 false" }
      }, req: ["seconds"]
    },
    {
      key: "remind", fn: "reminder_set",
      desc: "记下一条提醒事项（只记录，不启动倒计时）。同学说“提醒我明天带美术工具”“别忘了交作业”时用它。",
      props: { text: { type: "string", desc: "要提醒的内容原文" } }, req: ["text"]
    },
    {
      key: "datetime", fn: "datetime_now",
      desc: "读取真实的系统时间/日期，或推算某天是星期几。今天几号、星期几、几天后是星期几、现在几点时用它。",
      props: { text: { type: "string", desc: "同学的原话（用来判断要推算哪一天）" } }, req: []
    },
    {
      key: "convert", fn: "unit_convert",
      desc: "做单位换算（长度、重量、面积、体积、速度、摄氏度↔华氏度）。同学问“X等于多少Y”时用它。",
      props: {
        value: { type: "number", desc: "要换算的数值" },
        from: { type: "string", desc: "原单位，如 米、千米、千克、摄氏度" },
        to: { type: "string", desc: "目标单位，如 厘米、公斤、华氏度" }
      }, req: ["value", "from", "to"]
    },
    {
      key: "math", fn: "math_calc",
      desc: "算平均数、求百分之几、算打折后的价钱。用它算，别自己算。",
      props: {
        kind: { type: "string", desc: "average（平均数）/ percent（百分之几）/ discount（打折）" },
        nums: { type: "array", items: { type: "number" }, desc: "average 用：参与平均的所有数" },
        base: { type: "number", desc: "percent / discount 用：总数或原价" },
        rate: { type: "number", desc: "percent 用百分数（如 20 表示 20%）；discount 用折数（如 8 表示八折）" }
      }, req: ["kind"]
    },
    {
      key: "shape", fn: "shape_calc",
      desc: "计算图形的面积/周长/体积/表面积（正方形、长方形、三角形、圆、长方体、正方体等）。",
      props: {
        shape: { type: "string", desc: "square / rect / triangle / circle / cube / cuboid / parallelogram / trapezoid" },
        nums: { type: "array", items: { type: "number" }, desc: "边长、长宽高、底和高等，按形状顺序填" },
        diameter: { type: "boolean", desc: "同学给的是直径而不是半径时填 true" }
      }, req: ["shape", "nums"]
    },
    {
      key: "translate", fn: "translate_text",
      desc: "翻译成中文或英文。",
      props: {
        text: { type: "string", desc: "要翻译的原文" },
        target: { type: "string", desc: "zh 表示译成中文，en 表示译成英文" }
      }, req: ["text"]
    },
    {
      key: "search", fn: "web_search",
      desc: "联网搜索资料。同学问课外知识、查百科、问「是什么/为什么」时用它。班级和课表类问题不要用。",
      props: { query: { type: "string", desc: "搜索关键词，不要包含“帮我搜索一下”这类客套话" } }, req: ["query"]
    }
  ];

  /* 英文函数名 → 中文意图 key（模型返回的是英文名，要映回本地实现） */
  var FN_TO_KEY = (function () {
    var m = {};
    Object.keys(TOOL_FN).forEach(function (k) { m[TOOL_FN[k]] = k; });
    return m;
  })();

  function schemasFor(tools) {
    return TOOL_SCHEMAS.filter(function (s) { return tools[s.key] !== false; })
      .map(function (s) {
        var properties = {}, required = [];
        for (var p in s.props) {
          properties[p] = { type: s.props[p].type, description: s.props[p].desc };
          if (s.props[p].items) properties[p].items = s.props[p].items;
        }
        s.req.forEach(function (r) { required.push(r); });
        return {
          type: "function",
          function: {
            name: s.fn,
            description: s.desc.replace(/<\/?b>/g, ""),
            parameters: { type: "object", properties: properties, required: required }
          }
        };
      });
  }

  /* ---------- 参数校验与兜底（Harness 该干的活） ----------
   * 模型偶尔会漏填参数或换单位。这里做三件事：补默认、把单位名对齐本地口径、
   * 以及实在补不上时从原句里再解析一次。补不上就把 needDuration 之类标记带下去，
   * 让工具返回“请你补充”——而不是默默算出一个错的数。 */
  function normalizeParams(key, raw, userText) {
    var p = {};
    if (raw && typeof raw === "object") for (var k in raw) p[k] = raw[k];
    var ut = userText || "";

    if (key === "calc") {
      if (!p.expr) p.expr = ut;
    } else if (key === "weather") {
      if (!p.city || typeof p.city !== "string") p.city = AgentLab.CONFIG.defaultCity;
      if (!p.dateKey) p.dateKey = /明天|明早/.test(ut) ? "明天" : /后天/.test(ut) ? "后天" : /明晚/.test(ut) ? "明晚" : /周末/.test(ut) ? "周末" : /下周/.test(ut) ? "下周" : "今天";
    } else if (key === "timer") {
      /* 时长以“同学的原话”为准，不以模型填的数为准。
       * 模型经常把“25分钟”原样填进 seconds（=25，实际只有 25 秒），
       * 而“同学说要计多久”才是真实需求，所以这里优先解析原句。 */
      var s = p.seconds;
      if (typeof s === "string") {
        var sd = parseDuration(s);
        s = sd ? sd.seconds : parseFloat(s);
      }
      var d = parseDuration(ut) || (typeof p.seconds === "string" ? parseDuration(p.seconds) : null) ||
        parseDuration(String(p.label || "")) || parseDuration(String(p.remindText || ""));
      if (d) s = d.seconds;
      if (!s || isNaN(s) || s <= 0) s = 0;
      p.seconds = s;
      if (!p.label) {
        var lb = p.seconds ? fmtDuration(p.seconds) : "";
        p.label = (p.remindText ? (lb + "·" + p.remindText) : lb);
      }
      if (!p.remindText) p.remindText = parseRemindText(ut);
      if (p.pomodoro === undefined) p.pomodoro = /番茄|专注/.test(ut);
    } else if (key === "datetime") {
      p.text = ut;
    } else if (key === "remind" || key === "search" || key === "translate") {
      var field = key === "remind" ? "text" : "query";
      if (!p[field]) p[field] = ut;
      if (!p.text && key === "translate") p.text = ut;
      if (!p.target) p.target = /中文|汉语/.test(ut) ? "zh" : "en";
    } else if (key === "convert") {
      if (typeof p.value === "string") p.value = parseFloat(p.value);
      if (isNaN(p.value) || p.value === null) p.value = parseCnNum(String(p.value || ""));
    } else if (key === "shape") {
      if (!Array.isArray(p.nums)) {
        var ns = (ut.match(/\d+(?:\.\d+)?/g) || []).map(parseFloat);
        p.nums = ns;
      }
      if (p.diameter === undefined) p.diameter = /直径/.test(ut);
    } else if (key === "math") {
      if (!Array.isArray(p.nums)) p.nums = (ut.match(/\d+(?:\.\d+)?/g) || []).map(parseFloat);
      if (typeof p.rate === "string") p.rate = parseFloat(p.rate);
      if (typeof p.base === "string") p.base = parseFloat(p.base);
    }
    return p;
  }

  /* 执行模型点名要用的那个工具 */
  function execFn(fnName, rawArgs, userText) {
    var key = FN_TO_KEY[fnName];
    if (!key) {
      return {
        name: "未知工具",
        summary: "尝试调用 " + fnName,
        result: "这个工具不存在，请只用我给你的工具清单里的工具。",
        payload: { unknown: fnName }
      };
    }
    var args = rawArgs;
    if (typeof args === "string") { try { args = JSON.parse(args || "{}"); } catch (e) { args = {}; } }
    var r = runTool({ toolName: key, params: normalizeParams(key, args, userText) });
    return r || { name: "工具", summary: "执行 " + key, result: "这个工具没有返回结果。", payload: {} };
  }

  function toolLabelOf(key) {
    return { weather: "天气查询", calc: "计算器", remind: "提醒", search: "联网搜索", translate: "翻译", convert: "单位换算", datetime: "时间日期", shape: "图形计算", math: "数学计算", timer: "计时器" }[key] || key;
  }

  /* 工具说明书原文：规划器"选工具"的第二步要拿它当证据给学生看 */
  function toolDescOf(fn) {
    for (var i = 0; i < TOOL_SCHEMAS.length; i++) if (TOOL_SCHEMAS[i].fn === fn) return TOOL_SCHEMAS[i].desc;
    return "";
  }

  /**
   * 规划器"选工具"的三步（口径与规划器实验室「工具选择决策」卡完全一致）：
   *   ① 理解意图  ② 匹配能力  ③ 构造参数
   * 每一步都用这一次的真实数据填，让学生看到规划不是"猜"，是有依据的匹配。
   */
  function pickSteps(call, userText, toolTotal) {
    var fn = (call && call.function && call.function.name) || "";
    var args = (call && call.function && call.function.arguments) || "";
    var desc = toolDescOf(fn);
    return [
      ["① 理解意图", "同学要的是：" + userText],
      ["② 匹配能力", "从 " + toolTotal + " 份工具说明书里挑中 " + fn +
        (desc ? "（说明书原文：" + desc + "）" : "")],
      ["③ 构造参数", args]
    ];
  }

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
    var messages = [
      { role: "system", content: sys },
    ];

    // 短期记忆：最近几轮对话原样保留（它们本来就带着 user / assistant 的角色）。
    // 注意要剔掉“和本次提问重复的那条”，否则会出现两条一模一样的 user 消息。
    (function () {
      var past = flags.memory ? stripCurrentUser(history, userText) : [];
      past.forEach(function (m) { messages.push({ role: m.role, content: m.content }); });
    })();

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

  var MAX_ROUNDS = 4;   // ReAct 循环上限：模型可能连续调多个工具，但不能无限转

  function modelName() {
    return (AgentLab.API.getSettings && AgentLab.API.getSettings().model) || AgentLab.CONFIG.model || "";
  }

  /* system 消息 = 规则 + 长期记忆档案 + 执行器状态。
   * 注意：长期记忆是<b>借 system 角色</b>进上下文的，它没有自己的角色——
   * 这是“记忆片段要给一个角色”最典型的例子。 */
  function buildSys(memory, executorOn) {
    var sys = AgentLab.buildSystemPrompt(memory.classInfo, memory.manual);
    sys += executorOn
      ? "\n\n【执行器】你有一批工具可以用。凡是需要外部信息（天气、时间、搜索）或精确计算（算数、换算、图形、计时）的地方，" +
        "请先调用工具拿到真实结果，再根据工具返回的内容回答；不要凭空编造数字。工具结果回来后你还要再看一遍，才能给出最终答案。"
      : "\n\n【执行器已关闭】这一轮你没有可用工具。凡是需要查真实数据的问题（天气、现在几点、换算结果等），" +
        "请直接告诉同学“我现在没有工具，查不到真实数据”，绝对不要编造。";
    return sys;
  }

  /* 从响应里取出 assistant 消息（兼容网关把 choices 挪位置的情况） */
  function pickMessage(data) {
    var ch = data && (data.choices || data.output);
    if (Array.isArray(ch) && ch.length) return ch[0].message || ch[0] || {};
    if (data && data.message) return data.message;
    return {};
  }

  function callBrain(messages, tools, plannerOn) {
    var body = { model: modelName(), messages: messages, temperature: 0.3, stream: false };
    if (tools && tools.length) {
      body.tools = tools;
      body.tool_choice = "auto";          // auto：模型有权判断“要不要调”
    }
    /* 规划器开关 → 真实对应“要不要让模型先推理再答”（DeepSeek 的 thinking）。
     * 开：先推理再规划；关：直接答，最快。两种都是真实机制，不是演出来的。
     * plannerOn === null：平台不支持 thinking 字段（上次被 400 拒绝过），干脆不发。 */
    if (plannerOn !== null) {
      body.thinking = { type: plannerOn ? "enabled" : "disabled" };
    }
    return AgentLab.API.callRaw({
      method: "POST",
      url: AgentLab.API.DEEPSEEK_URL || "https://api.deepseek.com/chat/completions",
      headers: [{ k: "Content-Type", v: "application/json" }],
      body: body
    });
  }

  function ctxDesc(messages) {
    var roles = messages.map(function (m) {
      if (m.role === "system") return "system(规则+长期记忆)";
      if (m.role === "tool") return "tool(工具结果)";
      if (m.role === "assistant" && m.tool_calls) return "assistant(要调工具)";
      return m.role;
    });
    return messages.length + " 条：" + roles.join(" → ");
  }

  /* 这一次的提问，调用方通常已经先压进 history 了（界面上要先把气泡显示出来）。
   * 如果这里再原样 push 一次，上下文里就会出现两条一模一样的 user 消息——
   * 模型会当成学生连着问了两遍，既浪费 token，也容易答偏。
   * 所以先把“和本次提问重复的那条”从历史尾部剔掉。 */
  function stripCurrentUser(history, userText) {
    var h = (history || []).slice();
    while (h.length && h[h.length - 1].role === "user" && h[h.length - 1].content === userText) h.pop();
    return h;
  }

  /* ================= 引擎一：真·LLM 驱动多轮 ReAct =================
   * 流程（和大模型反复交互，直到它不再要工具为止）：
   *   感知 → 组装上下文(含长期记忆) → 大脑规划 → tool_calls → 执行器
   *        → 结果作为 tool 角色拼回 → 大脑再看一遍（第 2 轮）→ …→ 最终答案
   * 每一次调用大脑，上下文都要重新拼一次，所以记忆是“每轮都在”，不是查一次就完。 */
  async function runLLM(userText, history, memory, hooks, t0) {
    var tools = memory.tools;
    var executorOn = !!flags.executor;
    var wireTools = executorOn ? schemasFor(tools) : [];   // 执行器关闭 → 请求里根本不带 tools
    var thinkingStripped = false;   // thinking 参数被平台拒绝过一次后，本轮不再发它

    var messages = [{ role: "system", content: buildSys(memory, executorOn) }];
    var past = flags.memory ? stripCurrentUser(history, userText) : [];
    past.forEach(function (m) { messages.push({ role: m.role, content: m.content }); });
    messages.push({ role: "user", content: userText });

    hooks.onPayload && hooks.onPayload(messages, { engine: "llm", round: 0, memory: memory });
    hooks.onContext && hooks.onContext(messages, "start");

    var round = 0, toolCount = 0;
    while (round < MAX_ROUNDS) {
      round++;
      var isLastRound = (round === MAX_ROUNDS);

      /* —— 记忆器：每一轮都要重新拼上下文 —— */
      if (flags.memory) {
        hooks.onStage && hooks.onStage("memory", "第" + round + "轮拼上下文：" + ctxDesc(messages), null, round);
      } else {
        hooks.onStage && hooks.onStage("memory", "记忆器被关闭：这一轮既没有长期记忆，也没有之前的对话", "skip", round);
      }

      /* —— 规划器：真实模式下它就是"大脑自己决定要不要调工具" ——
       * 必须点亮：否则学生"真实跑一遍"会看到规划器显示"本轮未参与"，
       * 与实验①的答案（每轮都参与）直接矛盾。
       * 规划器开关在这里的真实含义 = thinking 模式开/关（见 callBrain）。 */
      hooks.onStage && hooks.onStage("planner",
        "第" + round + "轮：读工具说明书，判断要不要调工具（tool_choice=auto" +
        (flags.planner ? "，思考模式已开" : "，思考模式已关") + "）", null, round);

      /* —— 大脑（它自己决定要不要调工具）—— */
      hooks.onStage && hooks.onStage("brain",
        "第" + round + "轮：把 " + messages.length + " 条消息发给大脑，等它规划…" +
        (isLastRound ? "（已到循环上限，这一轮必须给出答案）" : ""), null, round);

      var data;
      try {
        data = await callBrain(messages, wireTools, flags.planner);
      } catch (err) {
        /* thinking 参数不被当前模型/平台支持时（400），剥掉它再试一次。
         * 否则"关掉规划器"这个课堂动作本身会让整轮失败，实验就做不成了。 */
        var em = String((err && err.message) || "");
        if (!thinkingStripped && (err && err.status) === 400 && /thinking/i.test(em)) {
          thinkingStripped = true;
          data = await callBrain(messages, wireTools, null);
        } else {
          throw err;
        }
      }
      var msg = pickMessage(data);
      var calls = msg.tool_calls;
      var finish = (data.choices && data.choices[0] && data.choices[0].finish_reason) || "";

      hooks.onPayload && hooks.onPayload(messages, { engine: "llm", round: round, memory: memory });

      /* —— ReAct 第①步「思考」：把这一轮真实想的东西摊开给学生看 ——
       * 思考模式开着就有 reasoning_content 可看；关着就明说"没有推理过程"，
       * 这正好演示"规划器开关 = 看不看得见思考"，比一句通用说明有用得多。 */
      hooks.onThink && hooks.onThink({
        round: round,
        text: (msg.reasoning_content || "").trim(),
        thinkingOn: !!flags.planner
      });

      if (!calls || !calls.length) {
        /* 没有 tool_calls = 大脑认为可以收尾了 → 这就是 ReAct 循环的终止条件 */
        var a0 = { role: "assistant", content: msg.content || "" };
        messages.push(a0);
        hooks.onContext && hooks.onContext(messages, "final");
        hooks.onStage && hooks.onStage("brain",
          "第" + round + "轮：大脑没有再要工具，给出最终答案", null, round);
        hooks.onStop && hooks.onStop({
          reason: finish === "stop"
            ? "finish_reason=stop —— 模型自己认为任务完成了"
            : "模型没有返回 tool_calls，直接收尾",
          rounds: round, tools: toolCount
        });
        return { answer: msg.content || "", rounds: round, tools: toolCount };
      }

      /* 模型原样回传（reasoning_content 若有就一起带回去，兼容思考模式接口） */
      var aMsg = { role: "assistant", content: msg.content || "", tool_calls: calls };
      if (msg.reasoning_content != null) aMsg.reasoning_content = msg.reasoning_content;
      messages.push(aMsg);

      var names = calls.map(function (c) {
        return toolLabelOf(FN_TO_KEY[c.function && c.function.name] || "?") + "工具";
      }).join("、");

      /* —— ReAct 第②步「行动」：规划器的产出就是这个"计划" ——
       * 同时把"怎么选到这个工具"的三步依据一起交出去，对应规划器实验室那张卡。 */
      hooks.onPlan && hooks.onPlan({
        round: round,
        names: names,
        picks: calls.map(function (c) {
          return {
            fn: (c.function && c.function.name) || "",
            args: (c.function && c.function.arguments) || "",
            steps: pickSteps(c, userText, wireTools.length)
          };
        })
      });
      hooks.onStage && hooks.onStage("planner",
        "第" + round + "轮计划：调 " + names, null, round);

      /* —— 执行器 —— */
      if (!executorOn) {
        hooks.onStage && hooks.onStage("executor", "执行器被关闭，工具结果拿不回来", "skip", round);
        messages.push({ role: "user", content: "【系统提示】执行器已关闭，你刚才要的这些工具拿不到结果。请如实告诉同学你查不到，不要编造。" });
        continue;
      }
      hooks.onStage && hooks.onStage("executor", "大脑点名要调：" + names + "（第" + round + "轮）", null, round);

      for (var i = 0; i < calls.length; i++) {
        var fn = (calls[i].function || {});
        var r = await execFn(fn.name, fn.arguments, userText);
        toolCount++;
        hooks.onTool && r && hooks.onTool(r);
        messages.push({
          role: "tool",
          tool_call_id: calls[i].id,
          name: fn.name,
          content: (r && r.result) || "这个工具没有返回结果。"
        });
      }
      hooks.onContext && hooks.onContext(messages, "tool");

      /* —— ReAct 第③步「观察」：工具回来的东西 —— */
      hooks.onObserve && hooks.onObserve({
        round: round,
        results: calls.map(function (c, i) {
          var m = messages[messages.length - calls.length + i];
          return {
            fn: (c.function && c.function.name) || "",
            text: (m && m.content) || ""
          };
        })
      });

      if (isLastRound) {
        messages.push({ role: "user", content: "【系统提示】你已经用完了工具调用次数，请基于目前拿到的信息直接给出最终答案。" });
        hooks.onStop && hooks.onStop({
          reason: "到达循环上限 " + MAX_ROUNDS + " 轮 —— 强制收尾，把已经拿到的信息交给模型作答",
          rounds: round, tools: toolCount
        });
      } else {
        await delay(180);
      }
    }

    /* 理论上走不到这里，但留一个兜底免得整轮白跑 */
    var last = await callBrain(messages, wireTools, flags.planner);
    return { answer: pickMessage(last).content || "", rounds: round, tools: toolCount };
  }

  /* 降级引擎的兜底回答：没配 Key 时大模型这一步由本地规则代劳。
   * 关键是要"如实"——明说这是降级演示，并把工具真实跑完的结果摆出来，
   * 让无 Key 的学生也能看完"工具真的被调用"的完整管线，而不是看到一句"出错了"。 */
  function rulesFallbackAnswer(toolResult, userText) {
    var head = "（降级演示：未配置 API Key，这一句由本地规则代劳——配好 Key 后再问一遍，就能看到大模型基于工具结果组织的真实回答）";
    if (toolResult) {
      return head + "\n\n工具这边是真的跑完了：\n【" + toolResult.name + "】" + toolResult.summary + "\n→ " + toolResult.result;
    }
    return head + "\n\n这一轮没有调用工具。你可以拿同一句话对比两种模式：降级模式（现在）与真实模式（配好 Key 后）——工作台的点亮方式一样，但“谁做的决定”不一样。";
  }

  /* ================= 引擎二：无 Key 时的规则降级 =================
   * 没有 API Key 就调不动大模型，此时退回本地正则判定。
   * 关键是要<b>如实告诉学生这是降级路径</b>——规划不是模型做的，是规则做的。
   * 仍然按"两轮"演出来，让回路结构在离线时也看得见。 */
  async function runRules(userText, history, memory, hooks, t0) {
    var intent = detectIntent(userText);

    hooks.onStage && hooks.onStage("planner", "【降级】规划由本地规则代劳（没配 Key，大模型没参与）：" + intent.plan.join(" → "), null, 1);

    var toolResult = null, toolBlocked = null;
    var TOOL_LABELS = {
      weather: "天气查询工具", calc: "计算器工具", remind: "提醒工具",
      search: "联网搜索工具", translate: "翻译工具", convert: "单位换算工具",
      datetime: "时间日期工具", shape: "图形计算工具", math: "数学计算工具",
      timer: "计时器工具"
    };
    if (intent.needTool) {
      if (flags.executor && memory.tools[intent.toolName] !== false) {
        var toolLabel = TOOL_LABELS[intent.toolName] || "工具";
        hooks.onStage && hooks.onStage("executor", "第1轮：调用" + toolLabel, null, 1);
        toolResult = await runTool(intent);
        hooks.onTool && toolResult && hooks.onTool(toolResult);
      } else if (!flags.executor) {
        toolBlocked = "executorOff";
        hooks.onStage && hooks.onStage("executor", "执行器被关闭了，没法调用工具", "skip", 1);
      } else {
        toolBlocked = "toolOff";
        hooks.onStage && hooks.onStage("executor", "这个工具被关掉了，没法调用", "skip", 1);
      }
      await delay(200);
    } else if (intent.toolName === "classInfo") {
      hooks.onStage && hooks.onStage("executor", "不用外部工具：用记忆器里的班级知识就能回答", "skip", 1);
    } else {
      hooks.onStage && hooks.onStage("executor", "不需要调用工具：直接交给大脑回答", "skip", 1);
    }

    /* 降级模式也要按 ReAct 三步走，口径和真实模式一致：
     * 思考（规则怎么判的）→ 行动（调哪个工具、什么参数）→ 观察（工具回了什么）。
     * 差别只在"思考"是正则写死的，不是模型自己想的一一这一点必须如实标注。 */
    hooks.onThink && hooks.onThink({
      round: 1,
      text: "【降级】由本地正则规则判定：" + intent.plan.join(" → "),
      thinkingOn: false,
      isRules: true
    });
    if (intent.needTool && toolResult) {
      hooks.onPlan && hooks.onPlan({
        round: 1,
        names: toolResult.name,
        picks: [{
          fn: TOOL_FN[intent.toolName] || "",
          args: JSON.stringify(intent.params || {}),
          steps: [
            ["① 理解意图", "同学要的是：" + userText],
            ["② 匹配能力", "【降级】由本地正则匹配关键词选中，不是模型读说明书选的"],
            ["③ 构造参数", JSON.stringify(intent.params || {})]
          ]
        }]
      });
      hooks.onObserve && hooks.onObserve({
        round: 1,
        results: [{ fn: TOOL_FN[intent.toolName] || "", text: toolResult.result || "" }]
      });
    } else if (intent.needTool) {
      hooks.onPlan && hooks.onPlan({
        round: 1, names: "（工具未执行）",
        picks: [{
          fn: TOOL_FN[intent.toolName] || "", args: "",
          steps: [["① 理解意图", "同学要的是：" + userText],
            ["② 匹配能力", "规则判出要调 " + (toolLabelOf(intent.toolName)) + "，但执行器被关掉了，没执行"],
            ["③ 构造参数", "（未执行，无参数）"]]
        }]
      });
    }
    if (toolResult) {
      hooks.onStage && hooks.onStage("memory", "把工具结果作为 tool 角色拼回上下文，进入第2轮", null, 2);
      hooks.onStage && hooks.onStage("brain", "第2轮：大脑带着工具结果重新组织回答…", null, 2);
      hooks.onStop && hooks.onStop({ reason: "降级演示：规则只判一次，不进入真正的多轮循环", rounds: 2, tools: 1 });
    } else {
      hooks.onStage && hooks.onStage("brain", "第1轮：大脑直接组织回答…", null, 1);
      hooks.onStop && hooks.onStop({ reason: "降级演示：这一轮不需要工具，直接作答", rounds: 1, tools: 0 });
    }

    var mode = toolResult ? getCompat(modelName()) : "";
    var answer = null;
    /* 没配 Key：根本不发请求，直接用兜底回答（见 rulesFallbackAnswer）。
     * 有 Key 但调用失败：仍然抛错——那种情况必须让用户看到真实错误，
     * 不能用兜底冒充成功。 */
    if (!(AgentLab.API.hasApiKey && AgentLab.API.hasApiKey())) {
      answer = rulesFallbackAnswer(toolResult, userText);
    }
    for (var attempt = 0; attempt < 3 && answer === null; attempt++) {
      var messages = buildMessages(intent, userText, memory, flags.memory ? history : [], toolResult, toolBlocked, { mode: mode });
      hooks.onPayload && hooks.onPayload(messages, { engine: "rules", round: toolResult ? 2 : 1, toolResult: toolResult, memory: memory, mode: mode });
      try {
        answer = await AgentLab.API.chat(messages);
        break;
      } catch (err) {
        var next = toolResult ? nextCompatMode(mode, err) : null;
        if (!next) throw err;
        mode = next;
      }
    }
    return { answer: answer || "（大脑没有说出话来，请再问我一次吧）", rounds: toolResult ? 2 : 1, tools: toolResult ? 1 : 0 };
  }

  /**
   * 运行一轮完整流程
   * @param {string} userText 学生说的话
   * @param {Array} history   此前的对话（短期记忆）
   * @param {Object} hooks    { onEngine(mode, info), onStage(id, text, flag, round),
   *                            onThink({round,text,thinkingOn,isRules}),      ← ReAct①思考
   *                            onPlan({round,names,picks}),                   ← ReAct②行动（规划器的产出）
   *                            onObserve({round,results}),                    ← ReAct③观察
   *                            onStop({reason,rounds,tools}),                 ← 为什么停了
   *                            onContext(messages, kind), onTool(toolInfo), onPayload(msgs, info),
   *                            onDone(answer), onError(err) }
   */
  async function run(userText, history, hooks) {
    hooks = hooks || {};
    var t0 = Date.now();
    try {
      /* ① 感知器：把学生的原话接进来 */
      if (!flags.perception) {
        hooks.onStage && hooks.onStage("perception", "感知器被关闭了，听不到任何声音", "skip", 0);
        await delay(500);
        hooks.onStage && hooks.onStage("brain", "大脑没事做");
        hooks.onDone && hooks.onDone("我什么也听不到……（感知器被关掉了，请你先把它打开！）");
        return "我什么也听不到……（感知器被关掉了，请你先把它打开！）";
      }
      hooks.onStage && hooks.onStage("perception", "听到：" + userText);
      await delay(STAGE_DELAY);

      /* ② 记忆器：把长期记忆和短期轨迹备好，后面每一轮都要带上 */
      var memory = collectMemory(flags.memory ? history : []);
      if (!flags.memory) {
        memory.classInfo = {}; memory.manual = ""; memory.kbItems = 0;
      }
      if (flags.memory) {
        var memText = "翻开长期记忆小本子：找到班级知识 " + memory.kbItems + " 条";
        if (memory.historyCount > 0) memText += "，本次对话 " + memory.historyCount + " 轮";
        hooks.onStage && hooks.onStage("memory", memText, null, 0);
      } else {
        hooks.onStage && hooks.onStage("memory", "记忆器被关闭，翻不了小本子，也不记得刚才说过的话", "skip", 0);
      }
      await delay(200);

      /* ③ 引擎分流：有 Key 走真·LLM 多轮；没 Key 走规则降级 */
      var useLLM = !!(AgentLab.API.hasApiKey && AgentLab.API.hasApiKey());
      hooks.onEngine && hooks.onEngine(useLLM ? "llm" : "rules", {
        tools: memory.tools, executor: flags.executor, planner: flags.planner, memory: flags.memory
      });

      var out = useLLM
        ? await runLLM(userText, history, memory, hooks, t0)
        : await runRules(userText, history, memory, hooks, t0);

      if (!out.answer || !out.answer.trim()) out.answer = "（大脑没有说出话来，请再问我一次吧）";
      hooks.onStage && hooks.onStage("brain", "回答完成，共 " + out.rounds + " 轮 / " + out.tools + " 次工具调用，用时 " + Math.round((Date.now() - t0) / 100) / 10 + " 秒", null, out.rounds);
      hooks.onDone && hooks.onDone(out.answer);
      return out.answer;
    } catch (e) {
      hooks.onError && hooks.onError(e);
      throw e;
    }
  }

  return {
    run: run,
    detectIntent: detectIntent,
    runTool: runTool,
    schemasFor: schemasFor,
    TOOL_SCHEMAS: TOOL_SCHEMAS,
    flags: flags,
    MAX_HISTORY: MAX_HISTORY,
    MAX_ROUNDS: MAX_ROUNDS
  };
})();
