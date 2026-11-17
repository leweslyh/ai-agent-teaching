/* ============================================================
 * lab-executor.js —— 执行器实验室（L11 / L12，共 4 课时）
 *
 * 21 张卡。**源码顺序 ≠ 上课顺序**：本文件按“讲一张、练一张”书写（修改时不必
 * 在几百行字符串里搬内容），上课顺序由本文件末尾的 PLAN 统一重排为 4 课时：
 *   第 1 课时 先给它一双手：认识执行器 → 工具百宝箱（先玩）→ 有工具vs没工具 → 工具分类
 *              → 工具从哪来
 *   第 2 课时 它怎么把事办成：Function Calling → 填参数 → 工具描述 → 描述调参 → 选工具
 *   第 3 课时 它会出错：故障注入台（先看事故）→ 幻觉与四道防线 → 参数保真 → 重试与幂等
 *   第 4 课时 敢放手：代码沙盒 → 多工具协作 → 预测工具链 → MCP → 该不该上MCP
 *              → 小测验 → 进阶原理课堂（选做）
 * 重排只搬 DOM 节点、不复制卡片内容；PLAN 里任何一张卡匹配不上就整体放弃重排
 * （保底保持源码顺序，页面功能不受影响）。numberCards() 在 main.js 里晚于 render
 * 执行，所以圈码会自动跟着新顺序走。
 * 卡片编号全部自动生成（numberCards 按栏目内顺序补圈码）
 * 参考 ai-agent-book chapter4（工具分类 / 工具描述 / 参数保真 / 代码执行沙盒 / MCP /
 *      协作工具）、chapter5（故障与错误恢复：重试上限 / 熔断 / 幂等 / 结构化错误回喂）、
 *      chapter1（防呆设计与 ACI）；
 *      hello-agents 第十二章（BFCL 工具调用评测）、Extra05（MCP 与 Skill 的 token 账本）。
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

AgentLab.LabExecutor = (function () {
  var U = AgentLab.UI;
  var $ = U.$;

  /* 工具分类（做什么）：read 读 / compute 算 / act 做 / dispatch 派。
   * 另有一个不属于“做什么”的标签：scheduled（到点自己动）。
   * 口径见本文件「工具分类」卡：先问“碰不碰外面的东西”，再问“什么时候开始做”。 */
  var TOOLS = [
    { id: "weather", icon: "cloud", name: "天气查询工具", desc: "查询某个城市某天的天气，返回温度、降水、风力。", category: "read" },
    { id: "calc", icon: "calc", name: "计算器工具", desc: "快速算四则运算（加减乘除与括号），比如 25 × 4 + 10；折扣、百分数、平均数交给「数学计算工具」。", category: "compute" },
    { id: "remind", icon: "bell", name: "提醒工具", desc: "帮同学记下“要带什么、要做什么”，到时间提醒。", category: "act", tag: "scheduled" },
    { id: "classInfo", icon: "book", name: "课表查询工具", desc: "从班级知识库查出我们班的课表、值日和通知。", category: "read" },
    { id: "search", icon: "search", name: "联网搜索工具", desc: "由 DeepSeek 服务端联网搜索真实资料，需要时还会抓取网页正文，比如“搜一下恐龙是什么”或“打开这个网页看看写了什么”。", category: "read" },
    { id: "translate", icon: "lang", name: "翻译工具", desc: "中英互译，比如“苹果用英语怎么说”或“把 hello 翻译成中文”。", category: "compute" },
    { id: "convert", icon: "ruler", name: "单位换算工具", desc: "长度、重量、温度等换算，比如“5米等于多少厘米”或“35摄氏度等于多少华氏度”。", category: "compute" },
    { id: "datetime", icon: "clock", name: "时间日期工具", desc: "查现在几点、今天几号、星期几，还能推算“三天后是几号”“下周五是几号”。", category: "read" },
    { id: "shape", icon: "shape", name: "图形计算工具", desc: "算面积、周长、体积：正方形、长方形、三角形、梯形、圆、长方体……", category: "compute" },
    { id: "math", icon: "percent", name: "数学计算工具", desc: "算百分数、折扣、平均数，比如“60的30%是多少”“200元打8折”。", category: "compute" },
    { id: "timer", icon: "timer", name: "计时器工具", desc: "倒计时、番茄钟，比如“帮我计时25分钟”——到点真的会提醒。", category: "act", tag: "scheduled" }
  ];

  /* ============================================================
   * 工具百宝箱「试一试」：每件工具各自一块图形界面
   * ------------------------------------------------------------
   * 不是“给一句话看结果”，而是每件工具都有像样的控件：
   * 城市 + 日期、算式 + 小键盘、单位下拉、图形参数、倒计时条……
   * 学生先在界面上把参数填好，再点「运行这个工具」。
   * 真正的执行统一走 AgentLab.Agent.tryTool（与智能体跑一轮同一份实现），
   * 界面只负责“把参数收齐、把结果摆清楚”。
   * ============================================================ */

  /* --- 控件零件：全部带 data-f / data-chip，取值统一走下面三个读值函数 --- */
  function tbxFld(id, label, k, opt) {
    opt = opt || {};
    var key = id + "-" + k;
    var head = '<label class="tbx-fld"><span>' + label + "</span>";
    if (opt.type === "select") {
      return head + '<select data-f="' + key + '">' +
        (opt.options || []).map(function (o) {
          var v = typeof o === "string" ? o : o.v;
          var t = typeof o === "string" ? o : o.t;
          return '<option value="' + U.esc(v) + '"' + (v === opt.value ? " selected" : "") + ">" + U.esc(t) + "</option>";
        }).join("") + "</select></label>";
    }
    var isNum = opt.type === "number";
    return head + '<input type="' + (isNum ? "number" : "text") + '" data-f="' + key + '"' +
      ' value="' + U.esc(opt.value == null ? "" : String(opt.value)) + '"' +
      (isNum ? ' inputmode="decimal"' : "") +
      (opt.ph ? ' placeholder="' + U.esc(opt.ph) + '"' : "") + "></label>";
  }

  function tbxChips(id, label, k, opts, val, repaint) {
    return '<div class="tbx-fld"><span>' + label + '</span><div class="tbx-chiprow">' +
      (opts || []).map(function (o) {
        var v = typeof o === "string" ? o : o.v;
        var t = typeof o === "string" ? o : o.t;
        return '<button type="button" class="tbx-chip' + (v === val ? " is-on" : "") + '"' +
          ' data-chip="' + id + "-" + k + '" data-group="' + id + "-" + k + '"' +
          ' data-val="' + U.esc(v) + '"' + (repaint ? ' data-repaint="1"' : "") + ">" + U.esc(t) + "</button>";
      }).join("") + "</div></div>";
  }

  function tbxVal(panel, id, k) {
    var el = panel.querySelector('[data-f="' + id + "-" + k + '"]');
    return el ? String(el.value == null ? "" : el.value).trim() : "";
  }
  function tbxNum(panel, id, k) {
    var n = parseFloat(tbxVal(panel, id, k));
    return isNaN(n) ? 0 : n;
  }
  function tbxChip(id, k) {
    /* 按“这块面板”查，而不是整页查：#pg-toolbox 里已经不放试用面板了（弹窗挂在 body 下） */
    var panel = document.getElementById("tbx-try-" + id);
    var el = panel && panel.querySelector('[data-chip="' + id + "-" + k + '"].is-on');
    return el ? el.getAttribute("data-val") : "";
  }

  /* 时间戳 → “11月5日 21:40:12”：把工具解析出的响铃时间写成人能核对的样子 */
  function stampOf(at) {
    var d = new Date(at);
    if (!at || isNaN(d.getTime())) return "";
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return (d.getMonth() + 1) + "月" + d.getDate() + "日 " +
      p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  /* --- 单位换算：下拉里只放“本系统真的会算”的单位（与 agent.js 的换算表一致） --- */
  var UNIT_GROUPS = [
    { k: "length", t: "长度", units: ["千米", "米", "分米", "厘米", "毫米"] },
    { k: "weight", t: "重量", units: ["吨", "千克", "克", "斤"] },
    { k: "area", t: "面积", units: ["平方千米", "公顷", "平方米", "平方分米", "平方厘米"] },
    { k: "volume", t: "体积", units: ["升", "毫升"] },
    { k: "speed", t: "速度", units: ["千米每小时", "米每秒"] },
    { k: "temp", t: "温度", units: ["摄氏度", "华氏度"] }
  ];
  function unitGroup(k) {
    for (var i = 0; i < UNIT_GROUPS.length; i++) if (UNIT_GROUPS[i].k === k) return UNIT_GROUPS[i];
    return UNIT_GROUPS[0];
  }

  /* --- 图形计算：选什么图形，就只问这个图形要的参数 --- */
  var SHAPES = {
    square: { t: "正方形", ins: [["边长（厘米）", "a"]], nums: ["a"],
      ask: function (v) { return "边长" + v.a + "厘米的正方形面积是多少？"; } },
    rect: { t: "长方形", ins: [["长（厘米）", "w"], ["宽（厘米）", "h"]], nums: ["w", "h"],
      ask: function (v) { return "长" + v.w + "厘米、宽" + v.h + "厘米的长方形面积是多少？"; } },
    triangle: { t: "三角形", ins: [["底（厘米）", "b"], ["高（厘米）", "h"]], nums: ["b", "h"],
      ask: function (v) { return "底" + v.b + "厘米、高" + v.h + "厘米的三角形面积是多少？"; } },
    circle: { t: "圆", ins: [["半径（厘米）", "r"]], nums: ["r"],
      ask: function (v) { return "半径" + v.r + "厘米的圆，面积和周长是多少？"; } },
    cube: { t: "正方体", ins: [["棱长（厘米）", "a"]], nums: ["a"],
      ask: function (v) { return "棱长" + v.a + "厘米的正方体，体积和表面积是多少？"; } },
    cuboid: { t: "长方体", ins: [["长（厘米）", "l"], ["宽（厘米）", "w"], ["高（厘米）", "h"]], nums: ["l", "w", "h"],
      ask: function (v) { return "长" + v.l + "、宽" + v.w + "、高" + v.h + "厘米的长方体体积是多少？"; } },
    parallelogram: { t: "平行四边形", ins: [["底（厘米）", "b"], ["高（厘米）", "h"]], nums: ["b", "h"],
      ask: function (v) { return "底" + v.b + "厘米、高" + v.h + "厘米的平行四边形面积是多少？"; } },
    trapezoid: { t: "梯形", ins: [["上底（厘米）", "up"], ["下底（厘米）", "dn"], ["高（厘米）", "h"]], nums: ["up", "dn", "h"],
      ask: function (v) { return "上底" + v.up + "、下底" + v.dn + "、高" + v.h + "厘米的梯形面积是多少？"; } }
  };

  /* --- 数学计算：换一种算法，就换一组参数 --- */
  var MATH_KINDS = {
    percent: { t: "百分数", ins: [["总数", "base", "60"], ["百分之几（%）", "rate", "30"]],
      ask: function (v) { return v.base + "的" + v.rate + "%是多少？"; },
      params: function (v) { return { kind: "percent", base: parseFloat(v.base), rate: parseFloat(v.rate) }; } },
    discount: { t: "折扣", ins: [["原价（元）", "base", "200"], ["打几折", "rate", "8"]],
      ask: function (v) { return v.base + "元打" + v.rate + "折要付多少钱？"; },
      params: function (v) { return { kind: "discount", base: parseFloat(v.base), rate: parseFloat(v.rate) }; } },
    average: { t: "平均数", ins: [["几个数（逗号或空格分开）", "nums", "60, 70, 80"]],
      ask: function (v) { return v.nums + " 的平均数是多少？"; },
      params: function (v) {
        return {
          kind: "average",
          nums: String(v.nums).split(/[,，\s]+/).map(parseFloat).filter(function (n) { return !isNaN(n); })
        };
      } }
  };

  var CLASS_ASKS = {
    all: "班级信息", schedule: "课程表", duty: "值日安排", notice: "最近的通知", teacher: "班主任是谁"
  };

  /* --- 说明：这次试用和真实对话哪里不一样（不糊弄学生） --- */
  var TRY_NOTE = {
    remind: "选「10 秒后（演示）」再运行，真的会到点响铃；提醒只在当前页面开着时有效。",
    classInfo: "它读的是「记忆器实验室」里的班级知识库——小本子是空的就查不到。",
    search: "联网搜索要花几秒；没配 DeepSeek Key 或断网时会自动降级（并如实说明）。",
    translate: "翻译要调用大模型，需要先在右上角「设置」里填 DeepSeek Key。",
    timer: "这里的倒计时是真的；「智能体实验室」对话里的倒计时条也走同一套秒数。"
  };

  /* --- 每件工具的界面：body() 画控件，read() 把控件收成「参数 + 一句原话」 --- */
  var TRY_UI = {
    weather: {
      body: function (id) {
        return tbxFld(id, "城市", "city", { value: "北京", ph: "例如 北京 / 杭州" }) +
          tbxChips(id, "哪一天", "dateKey", ["今天", "明天", "后天", "周末", "下周"], "明天");
      },
      read: function (panel, id) {
        var city = tbxVal(panel, id, "city") || "北京";
        var d = tbxChip(id, "dateKey") || "今天";
        return { params: { city: city, dateKey: d }, text: d + city + "天气怎么样？" };
      }
    },
    calc: {
      body: function (id) {
        var keys = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "-", "0", ".", "(", ")"];
        return tbxFld(id, "算式", "expr", { value: "25×4+10", ph: "例如 25×4+10" }) +
          '<div class="tbx-keypad">' +
            keys.map(function (k) {
              return '<button type="button" class="tbx-key" data-kp="' + k + '" data-kpid="' + id + '">' + k + "</button>";
            }).join("") +
            '<button type="button" class="tbx-key is-fn" data-kp="back" data-kpid="' + id + '">⌫</button>' +
            '<button type="button" class="tbx-key is-fn" data-kp="clear" data-kpid="' + id + '">C</button>' +
            '<button type="button" class="tbx-key is-run" data-kp="run" data-kpid="' + id + '">=</button>' +
          "</div>" +
          '<div class="tbx-khint">点小键盘拼算式，按 = 就直接运行</div>';
      },
      read: function (panel, id) {
        var e = tbxVal(panel, id, "expr")
          .replace(/×/g, "*").replace(/÷/g, "/").replace(/[−–]/g, "-");
        return { params: { expr: e || "0" }, text: e + " 等于多少？" };
      }
    },
    remind: {
      body: function (id) {
        return tbxFld(id, "提醒内容", "what", { value: "带美术工具", ph: "例如 带美术工具" }) +
          tbxChips(id, "什么时候", "when", [
            { v: "10秒后", t: "10 秒后（演示）" }, "明天", "后天", "这周五"
          ], "10秒后") +
          /* 时间必须能自己填：只给四个预设，学生想设“20 分钟后”“17:30”“明天早上 7:30”就设不了。
           * 填了这一格就以它为准，和真实对话一样——时间从“原话”里读，不进参数。 */
          tbxFld(id, "或者自己填时间（填了就按这里算）", "whenText",
            { ph: "例如 20分钟后 / 17:30 / 明天早上7:30" });
      },
      read: function (panel, id) {
        var what = tbxVal(panel, id, "what") || "带美术工具";
        var custom = tbxVal(panel, id, "whenText");
        /* 英文单位（30s / 5min / 1h）单独写时要补一个“后”，拼出来才是
         * 「提醒我30s后…」这种能被解析的句子（parseDuration 只认带“后/内”的英文单位）。 */
        if (/^[0-9]+(\.[0-9]+)?\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)$/i.test(custom)) {
          custom += "后";
        }
        var when = custom || tbxChip(id, "when") || "";
        /* 参数里只放“提醒什么”；“什么时候”由原话带过去——
         * 和真实对话里一样：模型给内容，时间从同学的原话里读。 */
        return { params: { text: what }, text: "提醒我" + when + what };
      }
    },
    classInfo: {
      body: function (id) {
        return tbxChips(id, "想查什么", "type", [
          { v: "all", t: "全部" }, { v: "schedule", t: "课程表" }, { v: "duty", t: "值日" },
          { v: "notice", t: "通知" }, { v: "teacher", t: "班主任" }
        ], "all");
      },
      read: function (panel, id) {
        var t = tbxChip(id, "type") || "all";
        return { params: { type: t }, text: "查一下我们班的" + (CLASS_ASKS[t] || "班级信息") };
      }
    },
    search: {
      body: function (id) {
        return tbxFld(id, "搜索词", "query", { value: "天空为什么是蓝色的" }) +
          tbxFld(id, "或者：网页地址（填了就抓这一页）", "url", { ph: "https://…" });
      },
      read: function (panel, id) {
        var q = tbxVal(panel, id, "query") || "长颈鹿";
        var u = tbxVal(panel, id, "url");
        return u
          ? { params: { url: u, query: q }, text: "打开 " + u + " 看看写了什么" }
          : { params: { query: q }, text: "搜一下：" + q };
      }
    },
    translate: {
      body: function (id) {
        return tbxFld(id, "要翻译的内容", "text", { value: "科学" }) +
          tbxChips(id, "方向", "dir", [{ v: "en", t: "中 → 英" }, { v: "zh", t: "英 → 中" }], "en");
      },
      read: function (panel, id) {
        var text = tbxVal(panel, id, "text") || "科学";
        var dir = tbxChip(id, "dir") || "en";
        return {
          params: { text: text, target: dir },
          text: dir === "en" ? "“" + text + "”用英语怎么说？" : "把“" + text + "”翻译成中文"
        };
      }
    },
    convert: {
      body: function (id) {
        return tbxChips(id, "哪一类", "cat",
          UNIT_GROUPS.map(function (g) { return { v: g.k, t: g.t }; }), "length", true) +
          tbxFld(id, "数值", "value", { type: "number", value: "3" }) +
          '<div class="tbx-dyn" id="tbx-dyn-' + id + '"></div>';
      },
      dyn: function (id) {
        var g = unitGroup(tbxChip(id, "cat") || "length");
        return '<div class="tbx-fld-pair">' +
          tbxFld(id, "从", "from", { type: "select", options: g.units, value: g.units[0] }) +
          tbxFld(id, "到", "to", { type: "select", options: g.units, value: g.units[1] || g.units[0] }) +
          "</div>";
      },
      read: function (panel, id) {
        var v = tbxNum(panel, id, "value");
        var from = tbxVal(panel, id, "from") || "千米";
        var to = tbxVal(panel, id, "to") || "米";
        return { params: { value: v, from: from, to: to }, text: v + from + "等于多少" + to + "？" };
      }
    },
    datetime: {
      body: function (id) {
        return tbxChips(id, "想知道什么", "ask", [
          { v: "现在几点了？", t: "现在几点" },
          { v: "今天几号？", t: "今天几号" },
          { v: "今天是星期几？", t: "今天星期几" },
          { v: "三天后是几号？", t: "三天后是几号" },
          { v: "下周五是几号？", t: "下周五是几号" }
        ], "现在几点了？");
      },
      read: function (panel, id) {
        var ask = tbxChip(id, "ask") || "现在几点了？";
        return { params: { text: ask }, text: ask };
      }
    },
    shape: {
      body: function (id) {
        return tbxChips(id, "什么图形", "shape",
          Object.keys(SHAPES).map(function (k) { return { v: k, t: SHAPES[k].t }; }), "square", true) +
          '<div class="tbx-dyn" id="tbx-dyn-' + id + '"></div>';
      },
      dyn: function (id) {
        var s = SHAPES[tbxChip(id, "shape") || "square"];
        return '<div class="tbx-fld-pair">' + s.ins.map(function (f) {
          return tbxFld(id, f[0], f[1], { type: "number", value: "4" });
        }).join("") + "</div>";
      },
      read: function (panel, id) {
        var key = tbxChip(id, "shape") || "square";
        var s = SHAPES[key];
        var v = {};
        s.nums.forEach(function (k) { v[k] = tbxNum(panel, id, k); });
        return {
          params: { shape: key, nums: s.nums.map(function (k) { return v[k]; }) },
          text: s.ask(v)
        };
      }
    },
    math: {
      body: function (id) {
        return tbxChips(id, "算什么", "kind",
          Object.keys(MATH_KINDS).map(function (k) { return { v: k, t: MATH_KINDS[k].t }; }), "percent", true) +
          '<div class="tbx-dyn" id="tbx-dyn-' + id + '"></div>';
      },
      dyn: function (id) {
        var kind = MATH_KINDS[tbxChip(id, "kind") || "percent"];
        return '<div class="tbx-fld-pair">' + kind.ins.map(function (f) {
          return tbxFld(id, f[0], f[1], { value: f[2] });
        }).join("") + "</div>";
      },
      read: function (panel, id) {
        var k = tbxChip(id, "kind") || "percent";
        var kind = MATH_KINDS[k];
        var v = {};
        kind.ins.forEach(function (f) { v[f[1]] = tbxVal(panel, id, f[1]); });
        return { params: kind.params(v), text: kind.ask(v) };
      }
    },
    timer: {
      body: function (id) {
        return tbxChips(id, "计多久", "mins", [
          { v: "10", t: "10 秒（演示）" },
          { v: "300", t: "5 分钟" },
          { v: "600", t: "10 分钟" },
          { v: "900", t: "15 分钟" },
          { v: "1500", t: "25 分钟" },
          { v: "2700", t: "45 分钟" }
        ], "1500") +
          tbxFld(id, "或者自己填（分钟）", "custom", { type: "number", ph: "例如 15" }) +
          '<div class="tbx-count" id="tbx-count-' + id + '"></div>';
      },
      read: function (panel, id) {
        var custom = tbxNum(panel, id, "custom");
        var secs = custom > 0 ? Math.round(custom * 60) : parseInt(tbxChip(id, "mins") || "1500", 10);
        var label = secs < 60 ? (secs + "秒") : (Math.round(secs / 60) + "分钟");
        return {
          params: { seconds: secs, label: label, pomodoro: secs === 1500 },
          text: "帮我计时" + label
        };
      }
    }
  };

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
    { q: "一本书 60 元，打 9 折要付多少钱？", ans: "math" },
    { q: "帮我计时25分钟（番茄钟）", ans: "timer" }
  ];

  // 小测验
  var QUIZ = [
    { q: "执行器在智能体中扮演什么角色？", opts: ["大脑，负责思考", "眼睛，负责看", "手，负责调用外部能力完成任务", "小本子，负责记忆"], ans: 2, why: "执行器就是 AI 的“手”——大语言模型自己不会实时查、不会真操作，执行器通过调用天气、计算、搜索等外部工具，把事真正办成。" },
    { q: "“联网搜索资料”“帮我把作业提交到班级群”“每周一早上 8 点自动把本周课表发到群里”——按本课的分类，这三件事分别是什么？", opts: ["读 → 做 → 再贴一个「到点自己动」的标签", "做 → 读 → 派", "读 → 派 → 做", "算 → 做 → 读"], ans: 0, why: "先看“它做了什么”：搜索是把信息读进来 → <b>读</b>；提交作业让系统里真的多了一条记录 → <b>做</b>；自动发课表这件事本身也是“做”，只是由时间触发，所以再贴一个<b>「到点自己动」的标签</b>——标签回答“什么时候做”，不是第五类。" },
    { q: "“查天气”“联网搜索”属于哪类工具？", opts: ["读（把信息拿进来，世界不变）", "算（只加工手上已有的东西）", "做（让外面真的发生变化）", "派（把活交给别的 Agent 或人）"], ans: 0, why: "它们只是把外部信息读回来，没有改变任何东西——属于<b>读</b>。“读”不等于“没用”：Agent 答得对不对，先取决于它读到了什么。" },
    { q: "“发消息”“下单”“设置提醒”属于哪类工具？", opts: ["读", "算", "做（让外面真的发生变化）", "派"], ans: 2, why: "它们都会在外面留下后果：群里多一条消息、账户少一笔钱、闹钟真的会响——属于<b>做</b>。这一类风险最高，所以要加确认、权限与日志。" },
    { q: "“每天早上 7:30 自动提醒今天谁值日”——这里的“到点自己动”是什么？", opts: ["第五类工具", "一个触发标签：说明它什么时候开始做", "一种记忆", "一种模型"], ans: 1, why: "“到点自己动”回答的是<b>什么时候做</b>，不是<b>做什么</b>：这件事的类别仍然是“做”（它真的会响铃、发消息），只是由时间触发。把“谁发起”当成类别，才会出现“同一个提醒既像执行、又像事件触发”的混乱。" },
    { q: "Function Calling（函数调用）的工作机制是什么？", opts: ["AI 直接执行代码", "AI 输出一段 JSON 指令（工具名 + 参数，如 weather_query、city: '北京'），由程序去执行真正的工具", "AI 用自然语言告诉用户怎么做", "AI 调用浏览器插件"], ans: 1, why: "真实系统里，模型不是“动手”，而是输出一段结构化的 JSON 指令，指定要调用的工具名和参数，由 Harness 层的程序去执行真正的工具，再把结果返回给模型。" },
    { q: "MCP（模型上下文协议）的作用是什么？", opts: ["一种新的编程语言", "让智能体标准化地接上各种工具，相当于“工具的 USB 接口”", "一种数据库格式", "一种模型训练方法"], ans: 1, why: "MCP（Model Context Protocol）是业界提出的标准化工具接入协议，相当于“工具的 USB 接口”——一个协议接遍所有工具，不需要为每个工具单独写适配代码。" },
    { q: "工具描述（Tool Description）为什么重要？", opts: ["让工具名字更好看", "告诉 AI 这个工具能干什么、需要什么参数，AI 才能正确选择和调用工具", "让工具运行更快", "用于工具分类"], ans: 1, why: "工具描述是 AI 选择工具的依据。好的描述包含：工具功能、参数说明、返回值格式。描述不清楚，AI 就可能选错工具或传错参数（导致幻觉）。" },
    { q: "“工具幻觉”指的是什么？", opts: ["工具运行出错", "模型编造不存在的工具或参数，或者编造工具返回结果", "工具返回了错误数据", "用户误用工具"], ans: 1, why: "模型可能“编造”不存在的工具名或参数（如调用一个根本没有的工具），或者在工具还没返回时就编造结果。生产系统用工具白名单、参数强校验、等待回填和结果验证四道防线来防止幻觉。" },
    { q: "“帮我规划明天的行程：先查天气，再查路线，最后设提醒”需要用到什么？", opts: ["单个工具", "多工具协作（一个任务依次调用多个工具）", "不需要工具", "只需要记忆器"], ans: 1, why: "复杂任务通常需要多工具协作：规划器拆解任务→依次调用天气工具、路线工具、提醒工具→每步结果追加到上下文→最后综合回答。这就是 ReAct 循环中工具的链式调用。" },
    { q: "下面哪一句是防止工具幻觉的<b>正确</b>做法？", opts: ["让 AI 自由编造工具名，这样更灵活", "只暴露白名单里的工具，参数按 schema 强校验", "工具还没返回，就先按经验给个答案", "工具返回什么都直接转给用户"], ans: 1, why: "白名单挡住“编工具”，参数强校验挡住“编参数”，等待回填挡住“编结果”，结果验证挡住“坏数据”。四道防线全部在程序侧——不靠模型自觉。" },
    { q: "智能体请求“删除张三的作业文件”，最稳妥的处理方式是？", opts: ["立刻直接删除，越快越好", "检查权限 → 转人工确认 → 确认后才执行，并记审计日志", "让模型反复确认三遍再删", "把文件先发给模型看一遍再删"], ans: 1, why: "删除不可撤销，属于高危操作。除了白名单和参数校验，还要人工确认（先问老师）并留下审计日志——模型可以提请求，但不能自己决定要不要执行。治理强度 = 操作的不可逆程度 × 影响范围。" },
    { q: "工具“静默截断”指的是什么？为什么它比直接报错更危险？", opts: ["工具只返回了前 20 条，却没说明还有 100 条——Agent 会以为这就是全部，从而算出错误结论", "工具返回得太慢", "工具自动把参数改成了别的值", "工具报错后没有重试"], ans: 0, why: "报错至少会被发现，静默截断却让 Agent“看到了不完整的数据还以为完整”。正确做法是显式说明（“已显示第 1-20 行，共 120 行”）并把完整结果留在可再次读取的地方。" },
    { q: "同一个动作超时了，为什么不能一律“再试一次”？", opts: ["因为有些动作不能重复做（发通知、交班费、下单）——重试可能做两遍，要先判断是否可重试，并给动作带上“幂等键”", "因为重试一定会失败", "因为重试不需要花钱", "因为模型不喜欢重试"], ans: 0, why: "重试安全的前提是“幂等”：重复执行同一个请求，结果只生效一次（像按两次电梯按钮不会来两部电梯）。对不可重复的动作，要么带幂等键，要么改成“先确认、再执行”两段式。" },
    { q: "为什么 AI 写的代码要放进沙盒里跑？", opts: ["因为沙盒里跑得更快", "因为代码是“真的会动手”的：沙盒用隔离环境 + 默认断网 + 超时限制，把破坏范围关在小圈子里", "因为沙盒能自动改错", "因为沙盒可以省 Token"], ans: 1, why: "代码执行是执行力最强、也最危险的工具：能读文件、能联网、能删东西。沙盒不是“多装一个环境”，而是把执行关进隔离的圈子里（进程/容器/微型虚拟机），默认断网、限时、限量，出事也只影响沙盒。" }
  ];

  /* ---------- MCP 连线对比图：5 个模型 × 5 个工具 ----------
   * 每张图都由「列标题 + 连线 + 节点」三段拼成（节点最后画，压在连线之上）。
   * 5 行节点的 y 坐标与两列 x 坐标固定在这里，连线端点从节点边缘起止。 */
  var MCP_ROWS = [48, 80, 112, 144, 176];
  var MCP_LABEL_L = ["A", "B", "C", "D", "E"];
  var MCP_LABEL_R = ["1", "2", "3", "4", "5"];

  function mcpCaptions() {
    return '<text class="tx-cap" x="40" y="16">模型 / 应用</text>' +
      '<text class="tx-cap" x="220" y="16">工具</text>';
  }

  /* 没有标准：左列每个节点连到右列每个节点 —— 5 × 5 = 25 条 */
  function mcpMesh() {
    var out = "";
    MCP_ROWS.forEach(function (y1) {
      MCP_ROWS.forEach(function (y2) {
        out += '<line class="ln" x1="43" y1="' + y1 + '" x2="217" y2="' + y2 + '"/>';
      });
    });
    return out;
  }

  /* 有 MCP：每一侧只跟中间协议条连一次 —— 5 + 5 = 10 条 */
  function mcpFan() {
    var out = "";
    MCP_ROWS.forEach(function (y) {
      out += '<line class="ln" x1="43" y1="' + y + '" x2="96" y2="112"/>' +
        '<line class="ln" x1="164" y1="112" x2="217" y2="' + y + '"/>';
    });
    return out;
  }

  /* 两列节点（圆 + 标签） */
  function mcpNodes() {
    var out = "";
    MCP_ROWS.forEach(function (y, i) {
      out += '<circle class="nd" cx="30" cy="' + y + '" r="13"/>' +
        '<text class="tx" x="30" y="' + (y + 4) + '">' + MCP_LABEL_L[i] + '</text>' +
        '<circle class="nd" cx="230" cy="' + y + '" r="13"/>' +
        '<text class="tx" x="230" y="' + (y + 4) + '">' + MCP_LABEL_R[i] + '</text>';
    });
    return out;
  }

  /* ============================================================
   * 4 课时排布（PLAN）
   * ------------------------------------------------------------
   * 源码按“讲一张、练一张”书写，上课顺序按 4 课时走。这里只做一件事：
   * 按 PLAN 的顺序，把已经渲染好的 .card 节点重新插到 .lesson-summary 之前，
   * 并在每组前插入一条课时分隔条。
   * 为什么不在源码里搬块：卡片是上百行字符串拼接，来回搬容易漏行，
   * 两份内容日后必然漂移。搬节点只有一份内容；圈码由 numberCards 在 main.js
   * 里晚于 render 执行，所以会自动跟着新顺序重排。
   * 保底：任何一张卡在 PLAN 里找不到，或排完还剩卡没登记，就整体放弃重排，
   * 保持源码顺序（页面功能不受影响，只是顺序退回旧版）。
   * ============================================================ */
  var PLAN = [
    { part: "第 1 课时 · 先给它一双手", min: "40 分钟",
      keys: ["认识执行器", "工具百宝箱", "有工具 vs 没工具", "工具分类", "工具从哪来"] },
    { part: "第 2 课时 · 它怎么把事办成", min: "40 分钟",
      keys: ["Function Calling 机制", "给这次调用填参数", "工具描述与选择", "工具描述写多细", "该调用哪个工具"] },
    { part: "第 3 课时 · 它会出错", min: "40 分钟",
      keys: ["故障注入台", "工具幻觉与约束", "偷偷改", "失败了能不能重试"] },
    { part: "第 4 课时 · 敢放手", min: "40 分钟",
      keys: ["代码在哪跑", "多工具协作", "预测多工具链式调用", "MCP 协议", "该不该上 MCP", "小测验", "进阶原理互动课堂"] }
  ];

  /* 故障注入的“关页兜底还原”：只在模块加载时注册一次监听（render 可能被再次调用，
   * 绑定在节点上的监听器会随节点一起消失，绑在 window 上的不会）。 */
  var injectRestore = null;
  window.addEventListener("beforeunload", function () {
    if (injectRestore) { try { injectRestore(); } catch (e) { } }
  });

  function applyPlan(sec) {
    var tail = sec.querySelector(".lesson-summary");
    if (!tail) return;
    var pool = Array.prototype.filter.call(sec.children, function (el) {
      return el.classList && el.classList.contains("card");
    });
    if (!pool.length) return;

    var seq = [];
    PLAN.forEach(function (p) {
      var bar = document.createElement("div");
      bar.className = "lesson-part";
      bar.innerHTML = '<span class="lp-name">' + p.part + '</span>' +
        '<span class="lp-min">约 ' + p.min + '</span>';
      seq.push(bar);
      p.keys.forEach(function (key) {
        for (var i = 0; i < pool.length; i++) {
          var h2 = pool[i].querySelector("h2");
          if (h2 && h2.textContent.indexOf(key) >= 0) {
            seq.push(pool[i]);
            pool.splice(i, 1);
            return;
          }
        }
      });
    });

    if (pool.length) return;   /* 有卡没登记 → 不重排，宁可旧顺序也不丢内容 */
    seq.forEach(function (node) { sec.insertBefore(node, tail); });
  }

  /* ---------- 渲染 ---------- */
  function render() {
    var LP = AgentLab.LabPerception;
    var sec = $("sec-executor");
    sec.innerHTML =
      LP.labHead("exe", "hand", "执行器实验室", "让 AI 动手干活 · 4 课时 · 组件篇·工具（L11–L12）") +

      /* 大屏课堂版入口：第七课（执行器）与第八课（工具调用）各一页，左右并排。
       * 为什么放这里：这两课都挂在这条线上，老师备完第七课，第八课就在旁边，不用另找入口。
       * 版式：和全站卡片同一套（白底 + 细描边 + 柔和阴影），只留「第几课 / 标题 / 三个关键词 / 按钮」；
       * 关卡数挪到右上角小标里——原来那句一长串箭头说明，投屏上根本读不完。 */
      '<div class="lesson-entry-row">' +
        '<div class="lesson-entry">' +
          '<div class="le-top"><span class="le-icon">' + U.icon("hand", 20) + '</span>' +
            '<span class="le-no">第七课</span>' +
            '<span class="le-count">6 关</span></div>' +
          '<b>执行器小课堂</b>' +
          '<span class="le-desc">执行器是什么 → 工具有哪些 → 它怎么自己挑工具。</span>' +
          '<a class="le-btn" href="lesson-executor.html">打开课堂版<span class="le-arrow">→</span></a>' +
        '</div>' +
        '<div class="lesson-entry le-tool">' +
          '<div class="le-top"><span class="le-icon">' + U.icon("wrench", 20) + '</span>' +
            '<span class="le-no">第八课</span>' +
            '<span class="le-count">10 关</span></div>' +
          '<b>工具调用小课堂</b>' +
          '<span class="le-desc">接口长什么样 → 四步法怎么调 → 出错怎么查。</span>' +
          '<a class="le-btn" href="lesson-tools.html">打开课堂版<span class="le-arrow">→</span></a>' +
        '</div>' +
      '</div>' +

      /* 本课学习地图：4 课时主线。每个节点可点 → 跳到对应卡片并高亮闪烁，兼作页内导航。
       * 说明：sectionMap 只渲染 t / el / tag / opt（旧的 title/hint/note 已不再输出），
       * 所以课时与时长写在 group.label 和 it.tag 里，不再留会误导的“共 N 张卡片”小字。 */
      U.sectionMap({
        head: "本课学习地图 · 4 课时",
        color: "exe",
        groups: [
          { label: "第 1 课时 · 先给它一双手（40′）", items: [
            { t: "认识执行器", el: "exe-intro", tag: "8′" },
            { t: "工具百宝箱", el: "pg-toolbox", tag: "9′" },
            { t: "有工具 vs 没工具", el: "pg-notool", tag: "7′" },
            { t: "工具分类：读·算·做·派", el: "exe-cat-map", tag: "7′" },
            { t: "工具从哪来", el: "exe-tool-source", tag: "9′" }
          ] },
          { label: "第 2 课时 · 它怎么把事办成（40′）", items: [
            { t: "Function Calling", el: "exe-fc-flow", tag: "10′" },
            { t: "填参数组装器", el: "exe-args", tag: "8′" },
            { t: "工具描述与选择", el: "exe-desc-principle", tag: "8′" },
            { t: "描述写多细", el: "exe-desc", tag: "8′" },
            { t: "该调用哪个工具", el: "pg-toolgame", tag: "6′" }
          ] },
          { label: "第 3 课时 · 它会出错（40′）", items: [
            { t: "故障注入台", el: "exe-inject", tag: "10′" },
            { t: "幻觉与四道防线", el: "exe-guard", tag: "10′" },
            { t: "参数保真", el: "exe-fidelity", tag: "10′" },
            { t: "重试与幂等", el: "exe-idem", tag: "10′" }
          ] },
          { label: "第 4 课时 · 敢放手（40′）", items: [
            { t: "代码与沙盒", el: "exe-sandbox", tag: "10′" },
            { t: "多工具协作", el: "exe-mt-flow", tag: "6′" },
            { t: "预测工具链", el: "exe-chain", tag: "6′" },
            { t: "MCP 协议", el: "exe-mcp-card", tag: "6′" },
            { t: "该不该上 MCP", el: "exe-mcp", tag: "5′" },
            { t: "小测验", el: "exe-quiz", tag: "7′" },
            { t: "进阶课堂", el: "exe-adv", tag: "选做", opt: true }
          ] }
        ]
      }) +

      /* 学习目标：按 4 课时写成“我能…”（可观察、可验收），最后一条是学生产出 */
      '<div class="lesson-goal card-exe">' +
        '<h3>' + U.icon("target", 18) + ' 本课学习目标（4 课时）</h3>' +
        '<div class="goal-list">' +
          '<div class="goal-item"><span class="goal-num">1</span><b>第 1 课时｜我能分清“岗位”和“家伙”</b>：说出执行器与工具的关系；关掉一个工具后，讲清小管家少做了什么、为什么就答不上来；把 11 个工具按“读 / 算 / 做 / 派”归好，并说清哪些还要贴「到点自己动」。</div>' +
          '<div class="goal-item"><span class="goal-num">2</span><b>第 2 课时｜我能说清一次调用怎么完成</b>：排出“用户 → AI 大脑 → 程序 → 工具 → 回填”的顺序；说出填参数要过哪三关；用四要素判断一份工具描述写得好不好。</div>' +
          '<div class="goal-item"><span class="goal-num">3</span><b>第 3 课时｜我能看出它哪里出了错</b>：在一次坏掉的调用里找出“工具偷偷改了却没说”的地方；判断一个动作能不能放心重试，并说出为什么。</div>' +
          '<div class="goal-item"><span class="goal-num">4</span><b>第 4 课时｜我敢放手让它做</b>：说出沙盒管住的四件事；用“规模 + 复用”判断一个小项目该不该上 MCP；遇到代码执行，先想到关进沙盒。</div>' +
          '<div class="goal-item"><span class="goal-num">★</span><b>本课产出</b>：给班级小助手挑 5 个工具，各写一句“给 AI 看的说明书”，并标出哪些动作不能重试（设计单第 3 步）。</div>' +
        '</div>' +
      '</div>' +

      /* 认识执行器 */
      LP.card("exe", "认识执行器：AI 的“手”",
        "大模型会想、会说，但不会真的去查、去做。执行器就是智能体里<b>负责动手的部件</b>；它手里的每样本领，叫一个<b>工具</b>。",
        '<div class="transform-flow">' +
          '<div class="tf-node">' + U.icon("brain", 20) + ' AI 大脑（想）</div>' +
          '<div class="tf-arrow">+</div>' +
          '<div class="tf-node" style="border-color:var(--c-exe)">' + U.icon("hand", 20) + ' 执行器（做）</div>' +
          '<div class="tf-arrow">=</div>' +
          '<div class="tf-out">“查得到、算得出、搜得到、真办事”</div>' +
        '</div>' +
        '<div class="pf-note" style="margin-top:10px">' + U.icon("info", 13) + ' <b>一句话分清：执行器是“岗位”，工具是“家伙”。</b>天气查询、计算器、提醒……都是它手边的工具。</div>' +
        '<div class="tip">' + U.icon("spark", 16) + ' <b>工具调用</b>，是智能体区别于聊天机器人的关键：能查、能算、能真的办事。接下来先看它手边有哪些工具、怎么分类。</div>', { id: "exe-intro" }
      ) +

      /* 工具分类（放在百宝箱与对照实验之后：先玩过，再分类）
       * 口径：四类“做什么”（读 / 算 / 做 / 派）+ 一个“什么时候做”的标签（到点自己动）。
       * 为什么不用书里的五类做主线：原来的五类把“作用对象”（读/写）和“谁发起”
       * （事件触发 / 用户沟通）放在同一层，同一个“提醒”能同时落进三个类，学生只能背；
       * 而且本系统只有两类实例，另外三类只能靠虚构例子练。四类只看“它做了什么”，
       * 标签只看“什么时候开始做”，每个工具因此只有一个类。 */
      LP.card("exe", "工具分类：读、算、做、派",
        "一件工具 = <b>名字 + 参数 + 返回</b>（例：<code>get_weather</code> + 城市、日期 → 天气）。",
        '<div class="tool-categories" id="exe-cat-cards">' +
          '<div class="tc-item tc-read">' +
            '<div class="tc-head"><span class="tc-icon">' + U.icon("eye", 18) + '</span><b>读</b><span class="tc-tag">信息进来</span></div>' +
            '<div class="tc-desc">把外面的信息拿进来，世界不变</div>' +
            '<div class="tc-tools"><b>本系统：</b>天气、课表、搜索、时间日期<br><b>真实系统：</b>搜索引擎、读文件</div>' +
          '</div>' +
          '<div class="tc-item tc-compute">' +
            '<div class="tc-head"><span class="tc-icon">' + U.icon("calc", 18) + '</span><b>算</b><span class="tc-tag">内部加工</span></div>' +
            '<div class="tc-desc">只加工手上已有的东西，外面不变</div>' +
            '<div class="tc-tools"><b>本系统：</b>计算器、换算、图形、数学、翻译<br><b>真实系统：</b>代码计算、格式转换</div>' +
          '</div>' +
          '<div class="tc-item tc-act">' +
            '<div class="tc-head"><span class="tc-icon">' + U.icon("hand", 18) + '</span><b>做</b><span class="tc-tag">改变世界</span></div>' +
            '<div class="tc-desc">让外面真的发生变化，包括给人发消息</div>' +
            '<div class="tc-tools"><b>本系统：</b>提醒、计时器<br><b>真实系统：</b>发消息、下单、写文件</div>' +
          '</div>' +
          '<div class="tc-item tc-dispatch">' +
            '<div class="tc-head"><span class="tc-icon">' + U.icon("users", 18) + '</span><b>派</b><span class="tc-tag">交给别人</span></div>' +
            '<div class="tc-desc">把活交给别的 Agent 或人</div>' +
            '<div class="tc-tools"><b>本系统：</b>暂无<br><b>真实系统：</b>子 Agent、请人确认</div>' +
          '</div>' +
        '</div>' +
        /* 8 个例子的验收练习（matcher） */
        '<div class="pf-kit-head" style="margin-top:14px">' + U.icon("wrench", 16) + ' 验收：8 个例子各属哪一类？</div>' +
        /* 不再套 .game-box：每行自己有边框，再套一层虚线框反而显脏 */
        '<div id="exe-cat-practice"></div>'
      ) +

      /* 实验：有工具 vs 没工具：原理 → 双栏对比实验 */
      LP.card("exe", "实验：有工具 vs 没工具",
        "同一个问题“明天穿什么？”，问两个 AI：一个没装工具，一个装了天气工具。",
        /* 原理收进按钮后面：先做对比，想追问“为什么”时再展开。
         * 重排后是三块并排的“做不到”，比原来的三段竖排更好扫读。 */
        '<button type="button" class="pf-reveal-btn" id="pg-why-toggle" aria-expanded="false" aria-controls="pg-tool-why">' +
          U.icon("alert", 15) + '<span class="pf-reveal-txt">先看原理：没有工具，AI 会怎样？</span>' +
        "</button>" +
        '<div class="tool-why" id="pg-tool-why" hidden>' +
          '<div class="tool-why-grid">' +
            '<div class="tool-why-item"><b>' + U.icon("cloud", 16) + '查不到</b><span>知识有截止日期：今天的天气、今天的新闻，它不知道。</span></div>' +
            '<div class="tool-why-item"><b>' + U.icon("calc", 16) + '算不准</b><span>复杂计算、单位换算容易错——它在“猜下一个字”。</span></div>' +
            '<div class="tool-why-item"><b>' + U.icon("hand", 16) + '动不了</b><span>发消息、设提醒、改文件——只能说，不能做。</span></div>' +
          '</div>' +
          '<div class="tool-why-foot">所以它只有两条路：如实说“不知道”，或者编一个——这就是“幻觉”。</div>' +
        '</div>' +
        /* 区 2：双栏对比 —— 两边结果并排，可反复问 */
        '<div class="pf-kit-head">' + U.icon("target", 16) + ' 动手对比：各问一次，看看差别</div>' +
        '<div class="row" style="margin-bottom:10px">' +
          '<button class="btn btn-gray" id="pg-notool">' + U.icon("xmark", 16) + ' 问没有工具的 AI</button>' +
          '<button class="btn btn-exe" id="pg-withtool">' + U.icon("cloud", 16) + ' 问有天气工具的 AI</button>' +
          '<button class="btn btn-ghost btn-sm" id="pg-tool-reset">' + U.icon("refresh", 15) + ' 重放</button>' +
        '</div>' +
        '<div class="tvs-wrap">' +
          '<div class="tvs-col is-no">' +
            '<div class="tvs-head">' + U.icon("xmark", 14) + ' 没有工具的 AI</div>' +
            '<div class="tool-stage tvs-stage" id="pg-notool-log"><span class="dim">$ 还没问过——点上面左边的按钮试试。</span></div>' +
          '</div>' +
          '<div class="tvs-col is-yes">' +
            '<div class="tvs-head">' + U.icon("check", 14) + ' 有天气工具的 AI</div>' +
            '<div class="tool-stage tvs-stage" id="pg-withtool-log"><span class="dim">$ 还没问过——点上面右边的按钮试试。</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="quiz-feedback" id="pg-tool-fb"></div>'
      ) +

      /* 工具从哪来：自己写 vs 调外部（放在对比之后、Function Calling 之前）
       * 五年级只需要记住两条路：自己写（函数→登记→点名就调）、调外部（地址→钥匙→请求→收结果）。 */
      LP.card("exe", "工具从哪来：自己写，还是调外部？",
        "工具不是天上掉下来的：要么你自己写一个，要么去调用别人做好的服务。",
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("wrench", 16) + '<span>自己写的工具</span>' +
              '<span class="pf-chan">三步</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">① 写函数</span>用几行代码算出一个结果，比如 <code>area(长, 宽)</code>。</div>' +
              '<div class="pf-step"><span class="pf-step-tag">② 登记</span>把名字、参数、返回写成一份“说明书”，交给模型看。</div>' +
              '<div class="pf-step"><span class="pf-step-tag">③ 点名就调</span>模型说“用 area，长 4 宽 3”，你的代码直接执行，<b>不联网</b>。</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 例：计算器、单位换算、图形计算——都是程序里自己写好的。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("cloud", 16) + '<span>调用外部工具</span>' +
              '<span class="pf-chan">四步</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">① 拼地址</span>找到服务的网址，比如天气服务的 <code>api.open-meteo.com</code>。</div>' +
              '<div class="pf-step"><span class="pf-step-tag">② 带钥匙</span>有的服务要 Key；天气这个不要，搜索要。</div>' +
              '<div class="pf-step"><span class="pf-step-tag">③ 发请求</span>把参数装进去：城市 = 北京，时间 = 明天。</div>' +
              '<div class="pf-step"><span class="pf-step-tag">④ 收结果</span>收到一段 JSON，取出“晴，15~25°C”。</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 例：天气查询、网页搜索——都是别人做好的服务，我们只是去“点单”。</div>' +
          '</div>' +
        '</div>' +
        '<div class="tip">' + U.icon("spark", 16) + ' <b>一句话记住：</b>自己写 = <b>函数 + 说明书 + 点名就调</b>；调外部 = <b>地址 + 钥匙 + 参数 + 收结果</b>。</div>',
        { id: "exe-tool-source" }
      ) +

      /* Function Calling 机制：原理（两个角色）→ 分步接力演示 */
      LP.card("exe", "Function Calling 机制：AI 怎么“调用”工具？",
        "AI 不直接动手：它写一段 JSON（调哪个工具、传什么参数），由程序去执行，再把结果送回来。",
        /* 原来的「区 0：四步流程图 + 先把角色分清楚」左图右解整块已按需求删除，
         * 直接进「原理：决策方 / 执行方」，再分步看一次完整接力；
         * 配套图 images/exe-function-calling.svg 已一并删除。 */
        /* 区 1：原理 —— 决策方 / 执行方 */
        '<div class="pf-kit-head">' + U.icon("hand", 16) + ' 原理：AI 不“动手”，它只写“委托单”</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("brain", 16) + '<span>AI 大脑（决策方）</span>' +
              '<span class="pf-chan">只写指令</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">决定</span>要不要用工具、用<b>哪个</b>工具</div>' +
              '<div class="pf-step"><span class="pf-step-tag">产出</span>一段结构化 JSON：<b>调什么、传什么参数</b></div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 它没有能力真的去查天气——只能写一张“委托单”。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("gear", 16) + '<span>程序（执行方）</span>' +
              '<span class="pf-chan">只办事情</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">执行</span>收到 JSON，校验参数，调用真实的 API / 工具</div>' +
              '<div class="pf-step"><span class="pf-step-tag">回填</span>把结果送回模型，由模型组织成人话</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 程序就是智能体的<b>执行器</b>：模型负责决策，程序负责执行。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：一次完整接力 —— 四张子卡片 2×2 蛇形排列，箭头即信息流向 */
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 一次完整接力：问一次天气，看两个角色怎么交接</div>' +
        '<div class="fcq">' +
          '<ol class="fcq-grid" id="exe-fc-flow">' +
            /* ① 用户提问：整条链路的起点 */
            '<li class="fcq-card is-user fcq-to-right">' +
              '<div class="fcq-head"><span class="fcq-no">1</span><span class="fcq-role">用户</span><span class="fcq-desc">提出需求</span></div>' +
              '<div class="fcq-quote">北京明天天气怎么样？</div>' +
              '<p class="fcq-note">话里有两个参数：<b>城市 = 北京</b>、<b>时间 = 明天</b>。</p>' +
              '<p class="fcq-note">但没说调哪个工具——交给 AI 大脑翻译。</p>' +
            '</li>' +
            /* ② AI 大脑：把原话翻译成委托单 */
            '<li class="fcq-card is-ai fcq-to-down">' +
              '<div class="fcq-head"><span class="fcq-no">2</span><span class="fcq-role">AI 大脑</span><span class="fcq-desc">决策方 · 收到用户原话</span></div>' +
              '<p class="fcq-note">把“明天”换成具体日期，写一条 JSON：</p>' +
              '<pre class="fcq-code">{\n  "tool": "weather_query",\n  "arguments": { "city": "北京", "date": "2026-10-12" }\n}</pre>' +
              '<p class="fcq-note is-bottom">它查不了天气，只能写这张“委托单”。</p>' +
            '</li>' +
            /* ③ 程序：照着委托单真去执行 */
            '<li class="fcq-card is-prog fcq-to-left">' +
              '<div class="fcq-head"><span class="fcq-no">3</span><span class="fcq-role">程序</span><span class="fcq-desc">执行方 · 收到委托单</span></div>' +
              '<p class="fcq-note">校验参数，调用真实的天气接口：</p>' +
              '<pre class="fcq-code">$ weather_query(city="北京", date="2026-10-12")\n→ 晴，15~25°C，微风</pre>' +
              '<p class="fcq-note is-bottom">结果原样送回，不作解释。</p>' +
            '</li>' +
            /* ④ AI 大脑：把工具结果说成人话 */
            '<li class="fcq-card is-ai">' +
              '<div class="fcq-head"><span class="fcq-no">4</span><span class="fcq-role">AI 大脑</span><span class="fcq-desc">收到工具结果 · 组织回答</span></div>' +
              '<div class="fcq-answer">北京明天晴，15~25℃，微风，适合穿薄外套。</div>' +
              '<p class="fcq-note is-bottom">结果回到上下文，模型把它说成人话。</p>' +
            '</li>' +
          '</ol>' +
        '</div>' +
        /* 请求 ↔ 响应：复用感知器的 apiCall 类型（同一套视觉语言，出现在两个不同场景） */
        '<div class="pf-kit-head" style="margin-top:16px">' + U.icon("cloud", 16) + ' 真实里长什么样：一次工具调用的「请求 ↔ 响应」</div>' +
        '<div id="exe-fc-io"></div>'
      ) +

      /* 实验：给这次调用填参数（紧跟 Function Calling） */
      LP.card("exe", "实验：给这次调用填参数（Function Calling 组装器）",
        "模型要调用工具，必须把参数填对。先弄清<b>参数校验到底看哪三件事</b>，再给一次真实请求，选出所有<b>必填且合法</b>的参数。",
        /* 区 1：原理 —— 校验三件事 */
        '<div class="pf-kit-head">' + U.icon("wrench", 16) + ' 原理：模型只“填参数”，由程序校验后才执行</div>' +
        '<div class="pf-demo-grid" style="grid-template-columns:1fr">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("check", 16) + '<span>参数校验就看三件事</span>' +
              '<span class="pf-chan">必填 / 格式 / 越界</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">① 必填齐不齐</span>schema 要求的字段一个都不能少</div>' +
              '<div class="pf-step"><span class="pf-step-tag">② 类型格式对不对</span>日期要 YYYY-MM-DD，枚举只能在给定的取值里</div>' +
              '<div class="pf-step"><span class="pf-step-tag">③ 有没有越界</span>schema 里没有的字段（尤其密钥）一律拒绝</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 参数校验是执行器最重要的安全闸门——<b>不靠模型自觉，靠程序硬拦</b>。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手（组件自带标题） */
        '<div id="exe-args"></div>') +

      /* 工具描述与选择：原理 → 真实示例 */
      LP.card("exe", "工具描述与选择：AI 怎么知道该用哪个工具？",
        "工具描述 = AI 选工具的依据。先弄清<b>一份描述要写清哪四样（功能 / 参数 / 返回 / 场景）</b>，再看两个真实工具的描述长什么样。",
        /* 区 1：原理 —— 四要素 + 写不清的后果 */
        '<div class="pf-kit-head">' + U.icon("pen", 16) + ' 原理：描述就是工具的“名片”，写在模型能读到的地方</div>' +
        '<div class="pf-demo-grid" style="grid-template-columns:1fr">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("check", 16) + '<span>写清四样，模型才选得对</span>' +
              '<span class="pf-chan">功能 / 参数 / 返回 / 场景</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">功能</span>这个工具能干什么——一句话说清用途</div>' +
              '<div class="pf-step"><span class="pf-step-tag">参数</span>要传什么、什么类型、哪些必填</div>' +
              '<div class="pf-step"><span class="pf-step-tag">返回</span>会给回什么结果——模型据此判断下一步</div>' +
              '<div class="pf-step"><span class="pf-step-tag">场景</span>什么时候该用它、什么时候不该用——和其他工具怎么区分</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 描述写得含糊（如只写“工具1”），模型就会选错工具或传错参数——这也是幻觉的来源之一。好的描述，是执行器可靠工作的基础。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：真实示例 */
        '<div class="pf-kit-head">' + U.icon("target", 16) + ' 实例：两个真实工具的描述长这样</div>' +
        '<div class="tool-desc-demo">' +
          '<div class="td-item">' +
            '<div class="td-name">' + U.icon("cloud", 18) + ' 天气查询工具</div>' +
            '<div class="td-field"><b>功能：</b>查询某个城市某天的天气，返回温度、降水、风力</div>' +
            '<div class="td-field"><b>参数：</b>city（城市名，必填）、date（日期 YYYY-MM-DD，可选，默认今天）</div>' +
            '<div class="td-field"><b>返回：</b>{temp: "15~25°C", weather: "晴", wind: "微风"}</div>' +
            '<div class="td-field"><b>场景：</b>问“某天天气、穿什么、要不要带伞”时用——不是查历史气候</div>' +
          '</div>' +
          '<div class="td-item">' +
            '<div class="td-name">' + U.icon("calc", 18) + ' 计算器工具</div>' +
            '<div class="td-field"><b>功能：</b>快速算四则运算，支持加减乘除和括号</div>' +
            '<div class="td-field"><b>参数：</b>expression（数学表达式，必填，如 "25*4+10"）</div>' +
            '<div class="td-field"><b>返回：</b>{result: 110}</div>' +
            '<div class="td-field"><b>场景：</b>纯四则运算时用；折扣、百分数、平均数交给「数学计算工具」</div>' +
          '</div>' +
        '</div>' +
        '<div class="tip tip-warn" style="margin-top:12px">' + U.icon("alert", 16) + ' <b>如果工具描述写得不好：</b>比如只写“工具1”、不写功能和使用场景，AI 就不知道该什么时候调用它，可能选错工具或传错参数（导致幻觉）。下面紧跟着「工具描述写多细才够」实验，可以亲手调一调。</div>',
        { id: "exe-desc-principle" }
      ) +

      /* 实验：工具描述写多细才够（紧跟工具描述） */
      LP.card("exe", "实验：工具描述写多细才够？（准确率调参）",
        "上一张已经知道四要素是哪四样，这一张只做一件事：拖滑条，看准确率什么时候到顶、什么时候开始掉。",
        /* 区 1：不再重复四要素清单（上一张卡已逐条讲过），只留“为什么会掉分” */
        '<div class="pf-kit-head">' + U.icon("pen", 16) + ' 原理：说明书缺一样，模型就得猜</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("check", 16) + '<span>四要素齐了就到顶</span>' +
              '<span class="pf-chan">约 90%</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">缺一样</span>模型只能靠猜——猜错就是<b>选错工具</b>，或者把参数填成它想象的样子</div>' +
              '<div class="pf-step"><span class="pf-step-tag">齐了</span>准确率到顶；再往上堆字，只会把必填项和取值要求淹没掉</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 下面滑条的峰值就在“四要素写全”这一段，记住它出现的位置，比记住数字有用。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("alert", 16) + '<span>两种写法都会掉分</span>' +
              '<span class="pf-chan">太简 / 太冗</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">太简</span>只写个名字（do_stuff）——模型分不清用哪个、该传什么</div>' +
              '<div class="pf-step"><span class="pf-step-tag">太冗</span>大段说明占地方，还把关键信息（必填、能填哪些值）淹没掉</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 给工具写好描述，是智能体工程师的核心工作之一。</div>' +
          '</div>' +
        '</div>' +
        '<div class="tip" style="margin-top:10px">' + U.icon("microscope", 16) + ' <b>两个可以量化的结论：</b>① 描述里附上 <b>1~5 个真实的调用示例</b>，工具选择准确率能从约 <b>72% 提到 90%</b>——示例比形容词管用；② 边界要写清（“不能做什么”），否则模型会自行猜测，把不该用它的时候也调用它。</div>' +
        /* 区 2：动手（组件自带标题） */
        U.predict({
          id: "exe-desc",
          color: "exe",
          q: "先猜一猜：把工具描述的详细程度从最低一路拖到拉满，准确率会怎么变？",
          opts: [
            { k: "a", t: "一直升——写得越详细越好" },
            { k: "b", t: "四要素齐了就基本到顶，再堆字反而下降" },
            { k: "c", t: "一直降——描述越长越干扰" }
          ],
          ans: "b",
          why: "描述写清<b>四要素</b>（功能 / 参数 / 返回 / 使用场景）、再附 1~5 个真实示例，准确率大约能到 90%；再往上堆字，只会把<b>必填项和枚举值</b>淹没在废话里。所以是“先升、到顶、再略降”。",
          hint: "把滑条慢慢拖一圈，注意看指标是在什么时候停止上升的。"
        }) +
        '<div id="exe-desc"></div>' +
        '<div class="pf-note">' + U.icon("check", 13) + ' <b>小结：</b>描述写全<b>四要素</b>（功能 / 参数 / 返回 / 使用场景）+ 1~5 个真实示例，准确率大约到 90% 就到顶了；再堆字只会淹没必填项与枚举值。</div>') +

      /* 工具选择游戏（单题闯关：11 个任务各选一个工具） */
      LP.card("exe", "游戏：这个任务该调用哪个工具？（执行视角）",
        "每个任务从工具库里挑一个最合适的，答对加星！共 " + MATCH.length + " 题。判断口诀：这是要「查一个信息」「做一次计算」，还是「动手做一件事」？" +
        '<br><b>和规划器那张卡怎么分工：</b>规划器练的是「<b>选工具</b>」——还没动手之前，先想清楚“要不要用工具、该用哪一类”；这里练的是「<b>调工具</b>」——已经决定要调了，把参数填对、把结果收好。同一件事的两个阶段，不是两遍。',
        '<div class="game-box" id="pg-toolgame">' +
          '<div id="pg-toolgame-list"></div>' +
          '<div class="score-line"><span class="score-badge" id="pg-toolgame-score" data-score="0">★ 0</span><span id="pg-toolgame-note" style="color:var(--c-sub)"></span></div>' +
        '</div>'
      ) +

      /* 工具百宝箱：按“读 / 算 / 做”分组 + 能力计数（关闭立即生效于智能体实验室） */
      LP.card("exe", "工具百宝箱：开关工具试试",
        "",
        '<div class="tbx-bar">' +
          '<span class="tbx-count" id="pg-toolbox-count">' + U.icon("hand", 15) + ' 已开启 <b>…</b> 项能力</span>' +
          '<span class="tbx-note">开关立即生效 · 点工具名可试用</span>' +
        '</div>' +
        '<div id="pg-toolbox" class="tbx-grid">' +
          [["read", "读 · 信息拿进来", "eye", "4 件"],
           ["compute", "算 · 只加工不碰外面", "calc", "5 件"],
           ["act", "做 · 让外面真的变", "hand", "2 件"]].map(function (cat) {
            var list = TOOLS.filter(function (t) { return (t.category || "act") === cat[0]; });
            return '<div class="tbx-group">' +
              '<div class="tbx-group-head">' + U.icon(cat[2], 15) + '<b>' + cat[1] + '</b><span>' + cat[3] + '</span></div>' +
              list.map(function (t) {
                var ui = TRY_UI[t.id];
                var note = TRY_NOTE[t.id];
                return '<div class="toggle-row" data-tryrow="' + t.id + '">' +
                  '<button type="button" class="t-label tbx-try-open" data-try="' + t.id + '" aria-expanded="false" aria-haspopup="dialog" title="点一下，打开试用窗口">' +
                    U.icon(t.icon, 20) +
                    '<span class="t-txt"><b>' + t.name + '<span class="tbx-try-chip">▶ 试一试</span></b>' +
                    '<small style="color:var(--c-sub);font-weight:400">' + t.desc + "</small></span>" +
                  "</button>" +
                  '<label class="switch"><input type="checkbox" data-tool="' + t.id + '"><span class="slider"></span></label>' +
                  "</div>" +
                  '<div class="tbx-modal" id="tbx-try-' + t.id + '" hidden>' +
                    '<div class="tbx-modal-mask" data-try-close="' + t.id + '"></div>' +
                    '<div class="tbx-modal-card" role="dialog" aria-modal="true" aria-labelledby="tbx-modal-title-' + t.id + '">' +
                      '<div class="tbx-modal-head">' +
                        '<b id="tbx-modal-title-' + t.id + '">试用：' + t.name + "</b>" +
                        '<button type="button" class="tbx-modal-x" data-try-close="' + t.id + '" aria-label="关闭试用窗口">' +
                          U.icon("xmark", 16) + "</button>" +
                      "</div>" +
                      '<div class="tbx-modal-body">' +
                        '<div class="tbx-try-lead">自己把参数填一填，再点「运行这个工具」</div>' +
                        '<div class="tbx-ui" data-ui="' + t.id + '">' + (ui ? ui.body(t.id) : "") + "</div>" +
                        '<div class="tbx-try-act">' +
                          '<button type="button" class="tbx-try-run" data-try-run="' + t.id + '">运行这个工具</button>' +
                          '<button type="button" class="tbx-try-input-btn" data-try-input="' + t.id + '" aria-expanded="false">' +
                            U.icon("term", 13) + ' 查看输入参数</button>' +
                          '<span class="tbx-try-hint">运行后会给出「原话 → 参数 → 工具返回」</span>' +
                        "</div>" +
                        '<div class="tbx-try-input" id="tbx-input-' + t.id + '" hidden></div>' +
                        (note ? '<div class="tbx-try-note">' + U.icon("alert", 13) + "<span>" + note + "</span></div>" : "") +
                        '<div class="tbx-try-out" id="tbx-try-out-' + t.id + '"></div>' +
                      "</div>" +
                    "</div>" +
                  "</div>";
              }).join("") +
            '</div>';
          }).join("") +
        '</div>' +
        '<div class="tip">' + U.icon("target", 16) + ' 试试看：关掉“天气查询工具”，去智能体实验室问“明天穿什么？”，小管家是不是就答不上来啦？这就是“没工具只能纸上谈兵”！</div>' +
        '<div class="tip tip-warn tip-extra" style="margin-top:8px">' + U.icon("alert", 16) + ' <b>工具不是越多越好：</b>工具一多，光把每件工具的说明书都塞进上下文，就要占掉一大块地方——相当于每次说话前，先背一遍整本工具目录；工具上百个时，连最强的模型也会挑错，小模型甚至会“忘记用工具、连指令都不遵守”。<br>解法不是“让模型更聪明”，而是<b>按需加载</b>：先按大类筛，再把相关的几件交给模型挑——同样的实验里，选对工具的准确率从大约一半提到了四分之三。就像查工具书：没人从第一页读到最后一页，都是顺着目录查词条。</div>' +
        '<div class="tip tip-extra" style="margin-top:8px">' + U.icon("wrench", 16) + ' <b>那要不要给每件事都做一个专用工具？</b>不一定要——<b>一个通用的“代码执行”往往顶得上一堆小工具</b>（算数、改文件、处理数据都能做）。只有这四种情况才值得专门造一个：① 需要严格控制<b>安全权限</b>；② 要屏蔽不同平台/系统的差异；③ 使用<b>频率极高</b>、值得优化；④ 参数很复杂、需要专门校验。<br>反过来也要注意：通用工具“什么都能做”，就意味着它带来的风险也更大——所以它更需要沙盒（后面有专门的实验卡会讲）。</div>'
      ) +

      /* 工具幻觉与约束：四类风险 + 四道防线 + 动手实验（原「工具幻觉与约束」与「四道防线实验」两张卡合并）
       * 合并理由：两张卡把同一组“四类风险 ↔ 四道防线”各讲了一遍，信息重复而卡位浪费；
       *          现在一张卡走完“看清风险 → 知道谁拦 → 亲手关掉一道看漏什么”。 */
      LP.card("exe", "工具幻觉与约束：AI 会“编造”工具吗？",
        "上一张你自己弄坏过系统——现在看它本该被谁拦住。模型可能<b>编造</b>三种东西：不存在的工具、错误的参数、没拿到就编的结果；还可能把工具返回的<b>坏数据</b>照单全收。先看清这四类风险长什么样、各由哪道防线拦住，再<b>亲手关掉一道防线</b>，看哪类风险就漏过去了。",
        '<div class="pf-kit-head">' + U.icon("alert", 16) + ' 原理：四类风险 ↔ 四道防线（一一对应）</div>' +
        '<div class="pf-demo-grid pf-cols-2">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("xmark", 16) + '<span>① 编工具</span>' +
              '<span class="pf-chan">调用不存在的工具</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step is-bad"><span class="pf-step-tag">AI 输出</span>{ "tool": "get_user_password", "params": { "user": "小明" } }</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("shield", 13) + ' 危害：可能触发危险操作。→ 被 <b>① 白名单</b> 拦住。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("xmark", 16) + '<span>② 编参数</span>' +
              '<span class="pf-chan">塞进 schema 外的字段</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step is-bad"><span class="pf-step-tag">AI 输出</span>{ "city": "北京", "user_token": "sk-abc123" }</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("shield", 13) + ' 危害：越界字段，甚至把密钥带出去。→ 被 <b>② 参数强校验</b> 拦住。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("xmark", 16) + '<span>③ 编结果</span>' +
              '<span class="pf-chan">工具没返回就抢答</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step is-bad"><span class="pf-step-tag">AI 输出</span>“明天北京晴，25℃”（可天气工具其实刚报了 HTTP 500）</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("shield", 13) + ' 危害：用户拿着假数据做决定。→ 被 <b>③ 等待回填</b> 拦住。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("alert", 16) + '<span>④ 照单全收坏数据</span>' +
              '<span class="pf-chan">工具真返回了，但明显不对</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step is-bad"><span class="pf-step-tag">工具返回</span>{ "temp": "-200℃" }——接口故障或数据源出错时会出现这种脏数据</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("shield", 13) + ' 危害：模型把坏数据当真话转给用户。→ 被 <b>④ 结果验证</b> 拦住（检查返回值是否在合理范围）。</div>' +
          '</div>' +
        '</div>' +
        '<div class="pf-demo-grid" style="grid-template-columns:1fr;margin-top:12px">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("shield", 16) + '<span>四道防线为什么是“硬约束”</span>' +
              '<span class="pf-chan">程序侧兜底</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">在程序侧</span>四道防线都不在模型里——不是靠它“自觉不乱编”，而是程序卡住</div>' +
              '<div class="pf-step"><span class="pf-step-tag">失败之后两招</span>① <b>结构化错误回喂</b>：把“哪一步、为什么失败、缺什么”写清楚交回模型（实测恢复成功率约 60% → 95%）；② <b>熔断</b>：同一动作连续失败到上限（生产经验值约 3 次）就停下转人工</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 只丢一句“出错了”，模型只能靠猜——所以错误信息要写清“哪一步 + 为什么 + 缺什么”。</div>' +
          '</div>' +
        '</div>' +
        '<div class="tip tip-ok" style="margin-top:12px">' + U.icon("shield", 16) + ' <b>本系统的实践：</b>你关掉某个工具后，小管家会“诚实说查不到”，而不是编造结果——这就是白名单和约束起作用的体现！AI 会犯错，程序负责兜底。另外，<b>高危操作</b>（删文件、群发消息）执行前必须<b>人工确认</b>，每次调用都记<b>审计日志</b>——模型可以提请求，但不能自己决定要不要执行（详见进阶课堂「工具治理」）。</div>' +
        /* 区 2：动手（组件自带标题） */
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 动手实验：关掉一道防线，看哪类风险漏过去</div>' +
        U.predict({
          id: "exe-guard",
          color: "exe",
          q: "先猜一猜：把「② 参数强校验」关掉，哪一类风险会直接漏过去？",
          opts: [
            { k: "a", t: "编工具——模型虚构一个根本不存在的工具" },
            { k: "b", t: "编参数——把 user_token、密钥一起塞进参数发出去" },
            { k: "c", t: "编结果——工具没返回，它自己编一个" }
          ],
          ans: "b",
          why: "四道防线一一对应四类风险：<b>白名单</b>挡“编工具”、<b>参数强校验</b>挡“编参数”、<b>等待回填</b>挡“编结果”、<b>结果验证</b>挡“坏数据照单全收”。关掉哪一道，对应那一类就漏过去——而且四道防线都在<b>程序侧</b>，不靠模型自觉。",
          hint: "先把四道防线和四类风险一条条对上，再看你关掉的是第几道。"
        }) +
        '<div id="exe-guard"></div>' +
        '<div class="pf-note">' + U.icon("check", 13) + ' <b>小结：</b>四道防线一一对应四类风险，而且全部在<b>程序侧</b>——不靠模型自觉。再配上「结构化错误回喂（恢复率 60%→95%）」与「连续失败熔断（约 3 次）转人工」，工具调用才算稳。</div>') +

      /* 故障注入台（对应评审"实验维度"第 1 条：从"看别人准备好的失败"升级为"自己把系统弄坏再修好"）
       * 为什么紧跟四道防线：学生刚知道每道防线防什么，正好由他亲手关掉/绕开，
       * 看事故怎么发生——先看见后果，再明白那道防线为什么必须有。
       * 三条注入全部走真实调用路径（真跑 Agent.run），跑完自动还原，不留下坏状态。 */
      LP.card("exe", "实验：故障注入台——这一次，由你来把系统弄坏",
        "这张先不讲道理：<b>故障由你注入</b>，然后真的让智能体跑一句，看它会出什么事。<b>先看见事故，下一张再学四道防线。</b>注入只在这一轮生效、跑完自动还原，不会弄坏你的系统。",
        '<div id="exe-inject"></div>') +

      /* 新卡：工具不能“偷偷改”参数——参数保真与静默失败（ai-agent-book chapter4:90） */
      LP.card("exe", "实验：工具不能“偷偷改”——参数保真与静默失败",
        "四道防线防的是“模型编造”。还有一类更隐蔽的坑：<b>工具自己偷偷动了手脚</b>——把参数悄悄改掉、把结果悄悄截断，却什么也不说。先弄清为什么这比报错更危险，再去日志里把它找出来。",
        /* 区 1：原理 —— 工具要“保真”：原样接收、如实回传 */
        '<div class="pf-kit-head">' + U.icon("wrench", 16) + ' 原理：工具的两条“保真”原则</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("check", 16) + '<span>两条保真原则</span>' +
              '<span class="pf-chan">不改参数 · 不藏信息</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">① 不许静默改参数</span>模型传什么就是什么；确实需要规范化（比如把中文引号转成英文），也要<b>把改动写进返回结果</b></div>' +
              '<div class="pf-step"><span class="pf-step-tag">② 不许静默截断</span>结果太长可以只回一部分，但必须<b>明确说明</b>：“已显示第 1-20 行，共 120 行”，并给出再读的办法</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 一句话：<b>可以少说，不能瞒着改。</b>“不告诉模型就动手”＝让模型基于假信息做决策。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("alert", 16) + '<span>为什么“静默”比“报错”更危险</span>' +
              '<span class="pf-chan">报错会被发现，静默不会</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">报错</span>Agent 立刻知道这一步没成功 → 可以重试、换工具、如实告知用户</div>' +
              '<div class="pf-step"><span class="pf-step-tag">静默失败</span>Agent 以为成功了，拿着<b>不完整或已被改过的结果</b>继续往下做——错误会一路传到最后</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("book", 13) + ' <b>工程提醒：</b>工具把参数“悄悄规整”（弯引号改直引号）或“悄悄加参数”，会让调用永远匹配不上、或旧版本必然失败——而且模型完全不知道自己被改了。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手（在日志里找出被偷偷动过的地方） */
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 动手：这份调用日志里，工具“偷偷动手脚”的地方在哪？</div>' +
        '<div class="game-box" id="exe-fidelity"></div>' +
        '<div class="tip tip-info">' + U.icon("scale", 16) + ' <b>同样的道理也适用于人：</b>同学让你帮忙带早餐，“随便带点”你不能自己改成“带十个包子还不告诉他”——要么按说的做，要么说清你的改动。</div>') +

      /* 新卡：失败了能不能重试——幂等与两段式确认（ai-agent-book chapter5:174） */
      LP.card("exe", "实验：失败了能不能重试？——幂等与两段式确认",
        "工具超时、报错的时候，“再试一次”几乎是最自然的反应。但有些动作<b>重试一次就等于做了两遍</b>——多发的通知收不回来，多交的班费也不好退。先弄清区别，再看两栏同时开跑。",
        /* 区 1：原理 —— 可重试 / 不可重试 + 两招保平安 */
        '<div class="pf-kit-head">' + U.icon("refresh", 16) + ' 原理：重试前先问一句“做两遍会怎样？”</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("check", 16) + '<span>可以放心重试</span>' +
              '<span class="pf-chan">重复做没有副作用</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">查询类</span>查天气、查课表、搜索——再查一次，结果一样</div>' +
              '<div class="pf-step"><span class="pf-step-tag">可覆盖的写操作</span>“把文件名改成 X”“把状态设成已完成”——同一个结果再做一遍还是它</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 判断口径：这个动作重复执行，<b>结果会不会变多或变乱</b>。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("alert", 16) + '<span>不能随便重试</span>' +
              '<span class="pf-chan">做两遍＝两个后果</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">对外发送</span>发通知、发消息、提交作业——重试可能发两遍、交两次</div>' +
              '<div class="pf-step"><span class="pf-step-tag">花钱 / 删除</span>下单、交费、删文件——后果不可逆，做两遍就是两次损失</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("shield", 13) + ' 两招保平安：<b>① 幂等键</b>——给这件事一个编号，服务端见到同一个编号只办一次（像按两次电梯按钮，不会来两部电梯）；<b>② 两段式</b>——先“预检/请示”，确认后再“执行”。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手演示（双轨推进） */
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 动手实验：超时之后，两种做法结局完全不同</div>' +
        '<div class="game-box" id="exe-idem"></div>' +
        /* 区 3：动手判断 */
        '<div class="pf-kit-head">' + U.icon("target", 16) + ' 动手判断：哪些动作可以放心重试？</div>' +
        '<div class="game-box" id="exe-retry"></div>') +

      /* 新卡：AI 写的代码在哪跑——代码执行与沙盒（ai-agent-book chapter5:335） */
      LP.card("exe", "实验：AI 写的代码在哪跑？——代码执行与沙盒",
        "代码执行是执行力最强的工具：能算、能改文件、能联网——<b>能做的事越多，做坏事的空间也越大</b>。所以真实系统从不让它直接在你的电脑上跑，而是先关进<b>沙盒</b>。先弄清沙盒管住哪几件事，再切换开关看后果。",
        /* 区 1：原理 —— 沙盒管四件事 + 三档隔离 */
        '<div class="pf-kit-head">' + U.icon("shield", 16) + ' 原理：沙盒不是“多装个软件”，而是把执行关进小圈子</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("lock", 16) + '<span>沙盒管住四件事</span>' +
              '<span class="pf-chan">能碰什么、能去哪、能跑多久、能说多少</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">能碰什么</span>只能访问指定的工作目录，碰不到你的文档、照片、系统文件</div>' +
              '<div class="pf-step"><span class="pf-step-tag">能去哪</span>默认<b>断网</b>；必须联网时按白名单放行——<b>偷到东西也传不出去</b></div>' +
              '<div class="pf-step"><span class="pf-step-tag">能跑多久</span>设超时（例如 120 秒），跑太久就中止，并<b>返回结构化错误</b>而不是悄悄杀掉</div>' +
              '<div class="pf-step"><span class="pf-step-tag">能说多少</span>输出太长要截断并说明，完整结果留在沙盒里可再读</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 一句话：<b>让代码“看得见该看的、够不着不该碰的、跑不出圈外”。</b></div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("box", 16) + '<span>隔离有三档</span>' +
              '<span class="pf-chan">进程 / 容器 / 微型虚拟机</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">进程级</span>同一台机器上开个受限进程——最轻，隔离也最弱</div>' +
              '<div class="pf-step"><span class="pf-step-tag">容器</span>像“独立的玻璃房”：有自己的文件系统和依赖，是目前最常见的做法</div>' +
              '<div class="pf-step"><span class="pf-step-tag">微型虚拟机</span>最接近“另一台机器”，隔离最强、启动略慢，用于高风险执行</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("alert", 13) + ' 常见误解：<b>“装个' + U.term("虚拟环境（venv）", 'venv 是 Python 自带的一个功能：给每个项目单独开一份“工具柜”——你用哪个版本的 Python、装了哪些库，各项目互不打扰。<br>它解决的是<b>“环境不打架”</b>，不是<b>“代码不乱跑”</b>：venv 里的程序照样能删文件、照样能联网。所以它拦不住破坏性操作——那要靠沙盒（限目录、断网、超时、限量）。一句话：<b>venv 管“用哪套工具”，沙盒管“能碰什么东西”。</b>') + '＝沙盒”是错的。</b>虚拟环境只管“用哪个 Python、装哪些包”，它拦不住删文件、也拦不住联网——安全和环境是两件事。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手（开关 + 两段代码对照） */
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 动手实验：同一段代码，有没有沙盒，结局差多少？</div>' +
        '<div class="game-box" id="exe-sandbox"></div>') +

      /* 多工具协作：原理 → 分步接力（工具链 + 上下文同步增长） */
      LP.card("exe", "多工具协作：一个任务调用多个工具",
        "复杂任务通常需要依次调用多个工具——这叫工具链式调用（Tool Chaining）。先弄清<b>为什么要“链”、顺序由什么决定</b>，再分步看一次链式调用。",
        /* 区 1：原理 —— 为什么要链 / 顺序由依赖决定 */
        '<div class="pf-kit-head">' + U.icon("gear", 16) + ' 原理：复杂任务 = 一串工具接力</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("hand", 16) + '<span>为什么要“链”</span>' +
              '<span class="pf-chan">单工具答不了复杂问题</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">单工具</span>只回答一个具体问题——查天气、算数、搜资料</div>' +
              '<div class="pf-step"><span class="pf-step-tag">链式调用</span>把大任务拆成几步，<b>每步的结果是下一步的输入</b></div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 每调用一个工具，结果就追加到轨迹——这就是 ReAct 循环里的“观察”。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("link", 16) + '<span>顺序由依赖决定</span>' +
              '<span class="pf-chan">有依赖要等 / 无依赖可并行</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">有依赖</span>算门票要先知道景点价格 → 必须等搜景点完成</div>' +
              '<div class="pf-step"><span class="pf-step-tag">无依赖</span>查天气和搜景点互不影响 → 真实系统里可并行发起</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 链的顺序不是“想到哪做到哪”，而是由数据依赖推出来的。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：分步接力 —— 左：工具链 / 右：上下文同步增长（把“结果追加到上下文”可视化） */
        '<div class="pf-kit-head">' + U.icon("spark", 16) + ' 分步接力：看工具链怎么一步步长出来</div>' +
        '<div class="mtc-bar">' +
          '<button class="btn btn-exe btn-sm" id="exe-mt-next">' + U.icon("spark", 15) + ' 下一步</button>' +
          '<button class="btn btn-ghost btn-sm" id="exe-mt-auto">自动播放</button>' +
          '<button class="btn btn-ghost btn-sm" id="exe-mt-reset">' + U.icon("refresh", 15) + ' 重来</button>' +
          '<span id="exe-mt-progress" class="mtc-progress">第 0 / 5 步</span>' +
        '</div>' +
        '<div class="mtc-wrap" id="exe-mt-flow">' +
          '<div class="mtc-chain">' +
            '<div class="mtc-step" data-mt="1">' +
              '<span class="mtc-ic">' + U.icon("cloud", 17) + '</span>' +
              '<div class="mtc-body"><div class="mtc-line"><b>查天气</b><span class="mtc-tag is-sense">读</span></div>' +
                '<div class="mtc-out">北京明天：晴，15~25°C</div></div>' +
            '</div>' +
            '<div class="mtc-step" data-mt="2">' +
              '<span class="mtc-ic">' + U.icon("search", 17) + '</span>' +
              '<div class="mtc-body"><div class="mtc-line"><b>搜景点</b><span class="mtc-tag is-sense">读</span></div>' +
                '<div class="mtc-out">“适合晴天去的景点” → 故宫、颐和园、天坛</div></div>' +
            '</div>' +
            '<div class="mtc-step" data-mt="3">' +
              '<span class="mtc-ic">' + U.icon("calc", 17) + '</span>' +
              '<div class="mtc-body"><div class="mtc-line"><b>算门票</b><span class="mtc-tag is-do">计算工具</span>' +
                '<span class="mtc-dep">依赖第 2 步</span></div>' +
                '<div class="mtc-out">60 + 30 + 15 = 105 元</div></div>' +
            '</div>' +
            '<div class="mtc-step" data-mt="4">' +
              '<span class="mtc-ic">' + U.icon("bell", 17) + '</span>' +
              '<div class="mtc-body"><div class="mtc-line"><b>设提醒</b><span class="mtc-tag is-do">提醒工具</span></div>' +
                '<div class="mtc-out">已设置明早 7:00 出发提醒</div></div>' +
            '</div>' +
            '<div class="mtc-final" data-mt="5">' +
              '<span class="mtc-ic">' + U.icon("brain", 17) + '</span>' +
              '<div class="mtc-body"><div class="mtc-line"><b>AI 综合所有结果，生成回答</b></div>' +
                '<div class="mtc-out">“明天北京晴天，推荐故宫、颐和园、天坛，门票共 105 元，已设好 7 点出发提醒！”</div></div>' +
            '</div>' +
          '</div>' +
          '<aside class="mtc-ctx">' +
            '<div class="mtc-ctx-head">' + U.icon("archive", 14) + ' 上下文（轨迹）在同步变长</div>' +
            '<div class="mtc-ctx-list">' +
              '<div class="mtc-ctx-item" data-mt="0"><span class="mtc-role">用户</span>帮我规划明天去北京玩</div>' +
              '<div class="mtc-ctx-item" data-mt="1"><span class="mtc-role">工具</span>天气：晴，15~25°C</div>' +
              '<div class="mtc-ctx-item" data-mt="2"><span class="mtc-role">工具</span>景点：故宫、颐和园、天坛</div>' +
              '<div class="mtc-ctx-item" data-mt="3"><span class="mtc-role">工具</span>门票合计 105 元</div>' +
              '<div class="mtc-ctx-item" data-mt="4"><span class="mtc-role">工具</span>已设明早 7:00 提醒</div>' +
              '<div class="mtc-ctx-item" data-mt="5"><span class="mtc-role">模型</span>最终回答：推荐故宫…</div>' +
            '</div>' +
          '</aside>' +
        '</div>' +
        '<div class="tip tip-info" style="margin-top:12px">' + U.icon("info", 15) + ' <b>关键点：</b>注意右边“上下文”在同步变长——<b>工具的输出就是下一轮推理的输入</b>，链越长，轨迹里的依据越全，回答才越靠谱。下面紧跟着「预测多工具链式调用」实验，来预判每一步该调哪个工具。</div>'
      ) +

      /* 实验：预测多工具链式调用（紧跟多工具协作） */
      LP.card("exe", "实验：预测多工具链式调用",
        "复杂任务要按依赖顺序调用多个工具。先弄清<b>顺序是由“数据依赖”决定的</b>，再预测每一步会调用哪个工具，最后和真实过程对照。",
        /* 区 1：原理 —— 依赖决定顺序 */
        '<div class="pf-kit-head">' + U.icon("refresh", 16) + ' 原理：多工具协作靠“数据依赖”串起来</div>' +
        '<div class="pf-demo-grid" style="grid-template-columns:1fr">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("link", 16) + '<span>上一步的输出 = 下一步的输入</span>' +
              '<span class="pf-chan">依赖决定顺序</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">有依赖</span>生成行程要用“天气 + 景点”两个结果 → 必须先拿到它们</div>' +
              '<div class="pf-step"><span class="pf-step-tag">无依赖</span>查天气和查景点互不影响 → 可以并行发起，省一半时间</div>' +
              '<div class="pf-step"><span class="pf-step-tag">失败要有兜底</span>中间任何一环失败，整条链要能停下来并如实说明</div>' +
              '<div class="pf-step"><span class="pf-step-tag">并行要“声明”</span>工具得先声明自己“支持同时调用吗”——<b>默认是不支持</b>（安全第一）；声明了才允许一批同时发起</div>' +
              '<div class="pf-step"><span class="pf-step-tag">一个失败，只波及依赖它的</span><b>级联中止</b>：并行的几个调用里有一个失败，只中止“要用它结果”的那几个，互不相干的照常完成——不必整批重来</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 链越长，越需要“中间结果可检查”——否则错了也不知道错在哪一步。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手（组件自带标题） */
        /* 原来这里问的是“必须先拿到什么”，和下面 pipeline 自带的猜题完全重复；
         * 改成问“哪两步可以同时做”，把“依赖决定顺序、无依赖可并行”单独练一次。 */
        U.predict({
          id: "exe-chain",
          color: "exe",
          q: "先猜一猜：这条链里，哪两步其实可以同时做？",
          opts: [
            { k: "a", t: "查天气 和 搜景点——它们互不依赖" },
            { k: "b", t: "算门票 和 设提醒——前后必须接上" },
            { k: "c", t: "每一步都得排队，一步也不能同时" }
          ],
          ans: "a",
          why: "查天气和搜景点互不依赖，真实系统里可以同时发起，省一半时间；算门票要用景点结果、设提醒要等行程定下来，所以必须排队。<b>顺序不是“想到哪做到哪”，而是由数据依赖推出来的。</b>",
          hint: "问自己：哪两步之间，谁也不需要等谁的结果？"
        }) +
        '<div id="exe-chain"></div>' +
        '<div class="pf-note">' + U.icon("check", 13) + ' <b>小结：</b>链式调用看<b>依赖</b>——先画清这一步的输入指向谁；并行要先显式声明是否支持并发（默认否），失败要<b>级联中止</b>：只停掉依赖它的分支，别误伤无关的调用。</div>') +

      /* MCP 协议：原理（N×M vs N+M）→ 连线对比 → 五要素 */
      LP.card("exe", "MCP 协议：工具的“USB 接口”（ai-agent-book 第 4 章）",
        "接 100 个工具就要写 100 套适配代码？MCP 是标准化的工具接入协议——相当于「<b>工具的 USB 接口</b>」。先看清<b>没有标准 vs 有标准</b>的差别，再看它带来什么。",
        /* 原「区 0：N×M 收敛图 + 这张图真正想说的是“接口标准”的价值」左图右解整块已删除
         * ——它和下面「区 2：连线对比」讲的是同一件事（都画 N×M 与 N+M），重复；
         * 配套图 images/exe-mcp-nm.svg 也一并删除。该块里的 Token 代价提示没有丢：
         * 本卡末尾的「别忘了算 Token 账」写得更完整。 */
        /* 区 1：原理 —— 乘法 vs 加法 */
        '<div class="pf-kit-head">' + U.icon("link", 16) + ' 原理：没有标准会“适配爆炸”，有了标准才能“即插即用”</div>' +
        '<div class="pf-demo-grid">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("alert", 16) + '<span>没有统一标准</span>' +
              '<span class="pf-chan">N × M</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">每个模型</span>都要为每个工具单独写一套适配代码</div>' +
              '<div class="pf-step"><span class="pf-step-tag">后果</span>5 个模型 × 5 个工具 = <b>25 套</b>；改一个工具，要动好几处</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 复杂度是<b>乘法</b>——工具和模型越多，适配代码爆炸式增长。</div>' +
          '</div>' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("check", 16) + '<span>有 MCP 统一协议</span>' +
              '<span class="pf-chan">N + M</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">工具侧</span>按协议暴露一次，任何支持 MCP 的客户端都能调用</div>' +
              '<div class="pf-step"><span class="pf-step-tag">客户端</span>接入一次协议，就用上全部 MCP 工具</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 复杂度变成<b>加法</b>——这就是 MCP 被称为“USB 接口”的原因。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：连线对比 —— 核心记忆点（5 个模型 + 5 个工具：25 条 vs 10 条）
         * 两图同版式：列标题（模型 / 应用 ↔ 工具）+ 算式胶囊 + 等宽的图，可直接对着数连线。
         * 取 5 而不取 3：3 × 3 = 9 对 3 + 3 = 6 只差 3 条，看不出“乘法爆炸”；
         * 5 × 5 = 25 对 5 + 5 = 10 差 15 条，差距肉眼可见。 */
        '<div class="pf-kit-head">' + U.icon("target", 16) + ' 对比：同样是 5 个模型、5 个工具，连线差多少？</div>' +
        '<div class="mcp-cmp">' +
          '<div class="mcp-pane is-bad">' +
            '<div class="mcp-pane-head">' + U.icon("xmark", 15) + ' 没有统一标准' +
              '<span class="mcp-chan">N × M</span></div>' +
            '<svg class="mcp-svg" viewBox="0 0 260 196" role="img" aria-label="没有统一标准时，5 个模型与 5 个工具两两都要对接，共 25 条适配连线">' +
              mcpCaptions() + mcpMesh() + mcpNodes() +
            '</svg>' +
            '<div class="mcp-pane-foot"><span>5 个模型 × 5 个工具，两两都要单独对接</span><b>= 25 条连线</b></div>' +
          '</div>' +
          '<div class="mcp-pane is-ok">' +
            '<div class="mcp-pane-head">' + U.icon("check", 15) + ' 有 MCP 统一协议' +
              '<span class="mcp-chan">N + M</span></div>' +
            '<svg class="mcp-svg" viewBox="0 0 260 196" role="img" aria-label="有 MCP 时，5 个模型与 5 个工具各自只对接中间一层协议，共 10 条连线">' +
              mcpCaptions() + mcpFan() +
              '<rect class="bar" x="96" y="100" width="68" height="24" rx="8"/>' +
              '<text class="tx-bar" x="130" y="116">MCP 协议</text>' +
              mcpNodes() +
            '</svg>' +
            '<div class="mcp-pane-foot"><span>5 个模型 + 5 个工具，各自只对接协议一次</span><b>= 10 条连线</b></div>' +
          '</div>' +
        '</div>' +
        /* 结论条：把两张图压成一句能记住的话（原来这里的 tip-ok 一句话已并进来，不再重复） */
        '<div class="mcp-concl">' +
          '<span class="mc-tag is-mul">N × M</span>' +
          '<span class="mc-to">→</span>' +
          '<span class="mc-tag is-add">N + M</span>' +
          '<span class="mc-txt"><b>新增一个工具时：</b>原来要给 5 个模型各写一套适配（5 × 5 = 25 条），现在只要在协议侧接 1 次（5 + 5 = 10 条）。工具实现一次、客户端接入一次——这就是 MCP 让工具生态真正长起来的原因。</span>' +
        '</div>' +
        /* 区 3：五要素 */
        '<div class="pf-kit-head">' + U.icon("archive", 16) + ' MCP 的五个要素</div>' +
        '<div class="pf-kit">' +
          [
            ["database", "Server", "工具提供方——把能力按协议暴露出来"],
            ["gear", "Client", "Agent 端——负责发现并调用这些工具"],
            ["wrench", "Tools", "可调用的函数——真正能执行的动作"],
            ["archive", "Resources", "可读的资源——文件、数据、文档"],
            ["chat", "Prompts", "提示模板——预设好的任务模板"]
          ].map(function (k) {
            return '<div class="pf-kit-item">' +
              '<span class="pf-kit-icon">' + U.icon(k[0], 15) + '</span>' +
              '<div class="pf-kit-txt"><b>' + k[1] + '</b><span>' + k[2] + '</span></div>' +
            '</div>';
          }).join("") +
        '</div>' +
        '<div class="tip tip-info" style="margin-top:12px">' + U.icon("book", 15) + ' <b>MCP 的关键一句话：</b>MCP 让 Agent 通过统一协议连接各种工具——<b>本地工具、远程工具、SaaS 工具、数据库、浏览器</b>等，就像 USB 接口让各种设备都能即插即用。下面紧跟着「该不该上 MCP」实验，用两个真实场景判断一下。</div>' +
        '<div class="tip tip-warn" style="margin-top:8px">' + U.icon("calc", 16) + ' <b>别忘了算“说明书”的账：</b>接 MCP 服务器时，它的<b>全部工具说明会进到每一次会话</b>——只接几个服务器，说明书就能占掉上下文的一大块，相当于每次说话前先背一遍整本工具目录；背得越多，留给正事的空间越少。<br>所以现在流行一层“<b>渐进式披露</b>”：平时只挂一份很短的<b>目录</b>（每个工具一两行），真正用到哪个，再把它的完整说明<b>按需</b>调进来——就像先看目录，再翻到那一页。</div>' +
        '<div class="tip" style="margin-top:8px">' + U.icon("shield", 16) + ' <b>MCP 也带来了新的安全风险（三类）：</b>① <b>工具描述投毒</b>——描述里夹带指令，每次会话都生效；② <b>恶意或被劫持的服务器</b>——' + U.term("供应链风险", 'MCP 服务器通常是别人写的、别人部署的。你只是“接进来用”，但它的代码、它依赖的库、它背后的服务，任何一环出问题都会传导到你这里——这条“上游 → 下游”的链条就是供应链。<br>像班里订外卖：你只点了自己那份，可商家用的食材、打包的人、跑腿的人，任何一环出问题都会落到你身上。所以工程上要<b>只接可信来源、锁定版本、审一遍权限声明</b>。') + '；③ <b>' + U.term("同名工具遮蔽", '你本来就有一个 <code>send_message</code> 工具，接进来的 MCP 服务器也提供了一个<b>同名</b>工具。如果发现与注册顺序没处理好，模型以为调的是“自己的那个”，实际执行的却是别人的——调用就被悄悄“劫持”到别处了。<br>防御很直接：<b>工具名全局唯一</b>（加前缀，如 <code>mcp_xxx.send_message</code>）、<b>注册冲突时报错而不是覆盖</b>、关键操作仍然人工确认。') + '</b>——用同名工具把调用“劫持”到别处。<br>所以接 MCP 要和装 App 一样谨慎：<b>只接可信来源、看清权限声明、关键操作仍然人工确认</b>。</div>'
      ) +

      /* 实验：该不该上 MCP（紧跟 MCP 协议） */
      LP.card("exe", "实验：该不该上 MCP？（场景判断）",
        "上不上 MCP，不看“新不新”，看<b>规模和复用</b>。先记住选型口诀，再判断两个真实场景——选完会给建议。",
        /* 区 1：原理 —— 选型口诀 */
        '<div class="pf-kit-head">' + U.icon("wrench", 16) + ' 原理：先看规模，再看复用——技术选型要匹配当前规模</div>' +
        '<div class="pf-demo-grid" style="grid-template-columns:1fr">' +
          '<div class="pf-card">' +
            '<div class="pf-card-head">' + U.icon("check", 16) + '<span>两个问题，决定要不要上 MCP</span>' +
              '<span class="pf-chan">规模 / 复用</span></div>' +
            '<div class="pf-flow">' +
              '<div class="pf-step"><span class="pf-step-tag">① 规模</span>工具很少、客户端也少（1~2 个）→ 直接写适配就够；工具多或要接多个客户端 / 模型 → 上 MCP</div>' +
              '<div class="pf-step"><span class="pf-step-tag">② 复用</span>只在自家系统里用 → 可以先用最简方案；要给外部团队 / 第三方复用 → 上 MCP（统一接口才谈得上共享）</div>' +
            '</div>' +
            '<div class="pf-note">' + U.icon("info", 13) + ' 先用得起，再考虑标准化——工具长大了再迁移到 MCP，也不迟。</div>' +
          '</div>' +
        '</div>' +
        /* 区 2：动手（组件自带标题） */
        '<div id="exe-mcp"></div>', { id: "exe-mcp-card" }) +

      /* 小测验 */
      LP.card("exe", "小测验：你是工具小达人吗？", "共 " + QUIZ.length + " 题，覆盖执行器角色、工具分类（读/算/做/派 + 触发标签）、Function Calling、工具描述、参数保真、重试与幂等、代码沙盒、MCP、工具幻觉、多工具协作与工具治理。答对一题加一颗星！",
        '<div class="game-box" id="exe-quiz"><div id="exe-quiz-body"></div></div>' +
        '<div class="score-line"><span class="score-badge" id="exe-quiz-score" data-score="0">★ 0</span><button class="btn btn-ghost btn-sm" id="exe-quiz-restart">重来</button></div>'
      ) +

      /* 进阶原理互动课堂 + 课堂小结 */
      LP.card("exe", "进阶原理互动课堂：执行器在真实系统里是什么？（选做）",
        "13 个真实工程概念（学有余力再看）：<b>左边选概念，右边看讲解 + 动手实验</b>——每个都配「一句话 / 打个比方 / 真实系统 / 动手做 / 自检一问」。主线四课时不依赖这一张。",
        AgentLab.Adv.panelHTML({ key: "exe", concepts: exeConcepts() }), { id: "exe-adv" }) +

      '<div class="lesson-summary card-exe">' +
        '<h3>' + U.icon("check", 18) + ' 课堂小结（4 课时）</h3>' +
        U.designCta(3, "给每个工具写一句“给 AI 看的说明书”——写得含糊，模型就会选错工具、传错参数") +
        '<div class="summary-core"><b>核心结论：</b>执行器是智能体的“岗位”，工具是它的“家伙”——大语言模型自己不会实时查、不会真操作，执行器通过调用外部能力把事真正办成。工具按“做什么”分四类：<b>读</b>（把信息拿进来）/ <b>算</b>（只加工，不碰外面）/ <b>做</b>（让外面真的变）/ <b>派</b>（交给别的 Agent 或人）；再按“什么时候开始做”贴一个<b>「到点自己动」</b>标签。真实系统用 Function Calling 机制（模型输出 JSON 指令→程序执行工具→结果返回模型），用 MCP 协议标准化接入各种工具。但工具不是“模型说什么就执行什么”——生产系统用白名单、参数强校验、等待回填、结果验证四道防线防止工具幻觉，还要求工具<b>保真</b>（不许偷偷改参数、不许偷偷截断），重试前先判断<b>能不能重试</b>（幂等 / 两段式确认），代码执行要关进<b>沙盒</b>，高危操作人工确认并记审计日志。复杂任务需要多工具协作（链式调用），每个工具的输出成为下一轮推理的依据。</div>' +
        '<div class="summary-points">' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("hand", 14) + '</span><div><b>执行器与工具：</b>执行器是岗位，工具是本领——没工具只能“纸上谈兵”，有工具才能“真刀真枪”。工具越多能办的事越多，但要按需要配齐（工具上百个时连强模型也会选错，按需检索能把准确率从大约一半提到四分之三）</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("gear", 14) + '</span><div><b>工具分类：</b>读（把信息拿进来）/算（只加工，不碰外面）/做（让外面真的变）/派（交给别的 Agent 或人），再按“什么时候开始做”贴「到点自己动」标签；优先考虑通用执行器，只有四类情况才值得造专用工具</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("keyboard", 14) + '</span><div><b>Function Calling：</b>模型输出 JSON 指令（工具名+参数）→程序执行工具→结果返回模型。模型负责决策，程序负责执行；描述里附 1~5 个真实示例，准确率可从 72% 提到 90%</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("shield", 14) + '</span><div><b>安全治理：</b>白名单+参数强校验+等待回填+结果验证四道防线，防止 AI 编造工具/参数/结果或照单全收坏数据；失败要“结构化回喂”（有工程实测：把失败原因说清楚，恢复率大约从六成提到九成半）并设熔断（连续失败约 3 次就停）；高危操作人工确认、全程审计日志。AI 会犯错，程序负责兜底</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("check", 14) + '</span><div><b>工具要“保真”：</b>可以少说，不能瞒着改——静默改参数、静默截断都会让 Agent 拿着假信息做决策，比直接报错更危险</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-exe)">' + U.icon("refresh", 14) + '</span><div><b>重试与沙盒：</b>可重试（查询、可覆盖的写操作）vs 不可重试（发通知、花钱、删除）；两招保平安=幂等键 + 两段式确认。AI 写的代码要进沙盒：限目录、默认断网、设超时、限输出——装个虚拟环境不等于沙盒</div></div>' +
        '</div>' +
        '<div class="summary-think"><b>课后思考：</b>请设计一个“班级活动小助手”需要哪些工具——至少列出 5 个工具，并说明每个工具属于读/算/做/派中的哪一类、要不要贴「到点自己动」标签、需要什么参数、返回什么结果；其中<b>哪些动作不能重复执行</b>（属于不可重试），你打算怎么保护它们？下节课分享！</div>' +
      '</div>';

    applyPlan(sec);   /* 4 课时排布：只搬节点，见文件上方 PLAN */

    bindToolDemo();
    bindFcApiPanel();
    bindMtChain();
    bindToolGame();
    bindToolbox();
    bindExeCatPractice();
    bindQuiz();

    /* 实验卡绑定 + 进阶原理互动课堂 */
    bindExeArgs();
    bindExeDesc();
    bindExeGuard();
    bindExeFidelity();   /* 参数保真与静默失败：在日志里找“偷偷动手脚” */
    bindExeIdem();       /* 幂等与重试安全：双轨推进 */
    bindExeRetry();      /* 哪些动作可以放心重试：多选判定 */
    bindExeSandbox();    /* 代码执行与沙盒：开关 + 两段代码对照 */
    bindExeChain();
    bindExeMcp();
    bindExeAdv();
  bindExeInject();    /* 故障注入台：学生自己把工具弄坏，再定位 */
  }

  /* ---------- Function Calling 的「请求 ↔ 响应」数据（复用 adv-classroom 的 apiCall 类型） ----------
   * 五个开关互相独立、可任意组合：系统提示词 / 思考模式 / JSON 格式 / 流式返回 / 工具调用。
   * 题目用一道简短的五年级应用题，工具换成"计算器"——因为这道题
   * 心算就有把握（50−3×12=14），学生能一眼判断模型算得对不对，
   * 于是"要不要给工具"这件事被单独凸显出来，而不是被"算错了"带偏。 */
  var FC_CALC_TOOL = {
    type: "function",
    function: {
      name: "calculator",
      description: "计算一个算式并返回结果",
      parameters: {
        type: "object",
        properties: { expression: { type: "string", description: "要计算的算式，例如 50-3*12" } },
        required: ["expression"]
      }
    }
  };

  var FC_IO = {
    color: "exe",
    title: "动手实验：改一个参数，回来的结构就换一个",
    hint: "开关参数 + 亲手发送",
    icon: "cloud",
    /* 预设题目：全部是五年级口算题，和 calculator 工具配套。
       * label 一律 4 个字（按钮排版整齐），完整题目点击后填进输入框。 */
    presets: [
      { label: "打折倒推", q: "一件衣服打八折后是 96 元，原价是多少元？" },
      { label: "排队人数", q: "小明排在一队里，他前面有 8 人，后面有 6 人，这一队一共有多少人？" },
      { label: "梨树棵数", q: "果园里有苹果树 240 棵，梨树比苹果树的 3 倍少 60 棵，梨树有多少棵？" },
      { label: "汽车速度", q: "一辆汽车 3 小时行了 195 千米，照这样计算，7 小时能行多少千米？" }
    ],
    /* 这张卡只把「常用参数」做成了开关，官方文档里还有大量可调字段，
     * 给一个进阶入口，让学生知道手上这几个并不是全部。 */
    apiDoc: "https://api-docs.deepseek.com/zh-cn/api/create-chat-completion",
    req: {
      method: "POST",
      url: "https://api.deepseek.com/chat/completions",
      headers: [
        { k: "Content-Type", v: "application/json" },
        { k: "Authorization", v: "Bearer sk-你的密钥（真实请求里是完整的一串）" }
      ],
      body: {
        model: "deepseek-flash",
        messages: [
          { role: "system", content: "你是一个五年级数学小助手。回答要简短，只说结果和一句话理由。" },
          { role: "user", content: "小明有 50 元，买 3 支每支 12 元的笔，还剩多少元？" }
        ],
        temperature: 0.3,
        stream: false
      }
    },
    toggles: [
      {
        k: "sys", label: "系统提示词", on: true, onIcon: "check", offIcon: "xmark",
        note: '<span class="ok">开启：</span>请求第一条是 <code>system</code>，把规则前置到最前面——' +
          "这是<b>开发者级别</b>的硬约束。<br>" +
          '<span class="no">关闭：</span>整条 system 消息消失，别的开关带来的要求只能<b>降级</b>塞进 user 消息——' +
          "那只是“用户的普通要求”，模型可能遵守、也可能带偏。" +
          '试一下：关掉它再开工具开关，"必须调用 calculator"这句就从硬约束降级成了随口一提。</span>'
      },
      {
        k: "tool", label: "工具调用", on: true, onIcon: "wrench", offIcon: "xmark", conflicts: ["json"],
        apply: function (b) {
          b.tools = [JSON.parse(JSON.stringify(FC_CALC_TOOL))];
          b.tool_choice = "required";
        },
        sysAdd: "需要算数的地方，一律调用 calculator 工具来算，不要自己心算。",
        note: '<span class="ok">这是执行器的核心开关：</b>请求体多出 <code>tools</code> 与 ' +
          '<code>tool_choice:"required"</code>：</span>回来的是 <code>tool_calls</code>，' +
          '<b>content 变成 null、finish_reason 变成 tool_calls</b>——模型<b>没有回答</b>，只是“提出请求”。<br>' +
          "<b>接下来必须由程序：</b>① 校验参数 → ② 真的去调计算器 → ③ 把结果作为一条 <code>tool</code> " +
          "消息追加进 messages → ④ <b>再调一次大模型</b>，它才会说出“还剩 14 元”。<br>" +
          '<span class="dim">为什么必须写 <code>tool_choice:"required"</code>？只声明 <code>tools</code> 时它默认是 ' +
          "<code>auto</code>——模型<b>有权不调</b>，而这道题心算就能答，它往往就直接答了，工具形同虚设。" +
          '<br><span class="dim">与思考模式一起开：接口不允许同时带 <code>tool_choice:"required"</code>，' +
          '会自动换成 <code>auto</code>——工具照样能被调用，只是这回由模型自己判断。</span>' +
          "这是真实工程里保证工具被用上的标准做法。</span>"
      },
      {
        k: "think", label: "思考模式", on: false, onIcon: "brain", offIcon: "xmark",
        apply: function (b) { b.thinking = { type: "enabled" }; },
        note: '<b>请求体多出 <code>"thinking": {"type":"enabled"}</code>：</b>模型先在 ' +
          "<code>reasoning_content</code> 里推理再回答，响应体<b>多一个字段</b>，耗时也明显变长。<br>" +
          '<span class="dim">关掉写 <code>{"thinking":{"type":"disabled"}}</code>。' +
          "思考模式和工具调用是<b>两条独立能力</b>——把思考打开、工具也开着，可以观察两者怎么叠加。</span>"
      },
      {
        k: "json", label: "JSON 格式", on: false, conflicts: ["tool"],
        apply: function (b) { b.response_format = { type: "json_object" }; },
        sysAdd: '请用 JSON 格式输出，例如 {"answer": 14, "reason": "50-36=14"}。',
        note: '<b>请求体多出 <code>"response_format": {"type":"json_object"}</code>：</b>回答变成' +
          "<b>结构化 JSON</b>，程序可以直接取字段，不用从自然语言里猜数字。<br>" +
          '<span class="no">注意开关打开时提示词里也补了“用 JSON 格式输出”——接口要求<b>提示词中必须出现 json</b>，' +
          "只改参数不改提示词会直接报错。这就是“<b>参数和提示词必须同步改</b>”。</span>"
      },
      {
        k: "stream", label: "流式返回", on: false, onIcon: "send", offIcon: "xmark",
        apply: function (b) { b.stream = true; },
        note: '<b>请求体只是把 <code>"stream": false</code> 改成 <code>true</code>：</b>回来的东西从' +
          "“一次给完整 JSON”变成<b>一小块一小块推回来（SSE 格式）</b>，最后以 <code>data: [DONE]</code> 收尾。" +
          '<span class="dim">好处是<b>首字更快</b>——网页上“一个一个字蹦出来”的打字机效果就是这么来的。</span>'
      }
    ],
    fallback: {
      json: {
        choices: [{
          index: 0,
          finish_reason: "tool_calls",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "call_demo",
              type: "function",
              function: { name: "calculator", arguments: '{"expression":"50-3*12"}' }
            }]
          }
        }],
        usage: { prompt_tokens: 132, completion_tokens: 24, total_tokens: 156 }
      },
      meta: "示例耗时 1.4s ・ finish_reason: tool_calls",
      note: "<b>这是最典型的一次工具调用：</b>模型只交出一张“委托单”（要调 calculator、参数是什么），" +
        "并没有自己算出答案。"
    },
    sendLabel: "发送请求",
    latency: 700
  };

  /* ---------- Function Calling 的「请求 ↔ 响应」面板 ----------
   * 四张子卡片是静态的（不逐步揭示），这里只负责下方 apiCall 面板 */
  function bindFcApiPanel() {
    var io = $("exe-fc-io");
    if (io && AgentLab.Adv && AgentLab.Adv.types && AgentLab.Adv.types.apiCall) {
      io.innerHTML = AgentLab.Adv.types.apiCall.demoHTML(FC_IO);
      AgentLab.Adv.types.apiCall.bind(io, FC_IO);
    }
  }

  /* ---------- 多工具协作：分步接力（工具链 + 上下文同步增长） ---------- */
  function bindMtChain() {
    var host = $("exe-mt-flow");
    if (!host) return;
    var nextBtn = $("exe-mt-next");
    var autoBtn = $("exe-mt-auto");
    var resetBtn = $("exe-mt-reset");
    var prog = $("exe-mt-progress");
    var TOTAL = 5;
    var cur = 0;
    var timer = null;

    function draw() {
      var nodes = host.querySelectorAll("[data-mt]");
      for (var i = 0; i < nodes.length; i++) {
        var n = parseInt(nodes[i].getAttribute("data-mt"), 10);
        if (n <= cur) nodes[i].classList.add("is-on");
        else nodes[i].classList.remove("is-on");
      }
      if (prog) prog.textContent = "第 " + cur + " / " + TOTAL + " 步";
      if (nextBtn) nextBtn.disabled = cur >= TOTAL;
      if (autoBtn) autoBtn.disabled = cur >= TOTAL;
    }
    function stopAuto() {
      if (timer) { clearInterval(timer); timer = null; }
      if (autoBtn) autoBtn.textContent = "自动播放";
    }
    if (nextBtn) nextBtn.addEventListener("click", function () {
      if (cur < TOTAL) { cur++; draw(); }
    });
    if (autoBtn) autoBtn.addEventListener("click", function () {
      if (timer) { stopAuto(); return; }
      if (cur >= TOTAL) return;
      timer = setInterval(function () {
        if (cur < TOTAL) { cur++; draw(); }
        else stopAuto();
      }, 950);
      autoBtn.textContent = "暂停";
    });
    if (resetBtn) resetBtn.addEventListener("click", function () {
      stopAuto(); cur = 0; draw();
    });
    draw();
  }

  /* ---------- 实验：有工具 vs 没工具 ---------- */
  function logLine(text, cls, boxId) {
    var log = $(boxId || "pg-tool-log");
    if (!log) return;
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
      var log = $("pg-notool-log");
      if (!log) { busy = false; return; }
      log.innerHTML = "";
      $("pg-tool-fb").innerHTML = "";
      logLine("$ 用户提问：“明天穿什么？”", "dim", "pg-notool-log");
      logLine("$ 调用大语言模型……（这个 AI 没有安装任何工具）", "", "pg-notool-log");
      logLine("$ AI 回答中……", "", "pg-notool-log");
      /* 没配 DeepSeek Key：用内置示例演示，保证课堂不中断 */
      if (!AgentLab.API.hasApiKey()) {
        await U.delay(600);
        logLine("> 我查不到明天的天气——因为我没有任何工具，不能实时查询，也不能编一个给你。", "warn", "pg-notool-log");
        logLine("（示例演示：配置 DeepSeek Key 后，这里会是真实大模型的回答）", "dim", "pg-notool-log");
        $("pg-tool-fb").innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " 没工具：AI 只能“纸上谈兵”，查不到真实天气！</span>";
        busy = false;
        return;
      }
      try {
        var ans = await AgentLab.API.ask(
          "你是天气小管家，但你没有任何工具，无法实时查询天气。如果同学问天气相关问题，请如实告诉他你查不到天气，不能编造。",
          "明天穿什么？"
        );
        logLine("> " + ans.replace(/\n/g, "\n> "), "warn", "pg-notool-log");
        $("pg-tool-fb").innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " 没工具：AI 只能“纸上谈兵”，查不到真实天气！</span>";
      } catch (e) {
        logLine("! 出错了：" + (e.message || e), "warn", "pg-notool-log");
      }
      busy = false;
    }

    async function demoWithtool() {
      if (busy) return;
      busy = true;
      var log = $("pg-withtool-log");
      if (!log) { busy = false; return; }
      log.innerHTML = "";
      $("pg-tool-fb").innerHTML = "";
      logLine("$ 用户提问：“明天穿什么？”", "dim", "pg-withtool-log");
      logLine("$ 规划器说：这个问题需要调用天气工具", "", "pg-withtool-log");
      logLine("$ 调用工具：天气查询工具 → 联网查询" + AgentLab.CONFIG.defaultCity + "·明天的天气…", "", "pg-withtool-log");
      var w = await AgentLab.API.getWeather(AgentLab.CONFIG.defaultCity, "明天");
      if (!w || !w.ok) {
        logLine("! " + ((w && w.error) || "天气服务暂时不可用"), "warn", "pg-withtool-log");
        busy = false;
        return;
      }
      logLine("$ 工具返回：" + w.text, "ok", "pg-withtool-log");
      await U.delay(600);
      logLine("$ 工具结果已交给 AI 大脑，正在组织回答…", "", "pg-withtool-log");
      /* 没配 DeepSeek Key：天气结果是真的，回答用内置示例演示 */
      if (!AgentLab.API.hasApiKey()) {
        await U.delay(600);
        logLine("> 根据工具查到的真实天气：" + w.text + "。" + w.suggest + "。", "ok", "pg-withtool-log");
        logLine("（示例演示：配置 DeepSeek Key 后，这里会是真实大模型基于工具结果的回答）", "dim", "pg-withtool-log");
        $("pg-tool-fb").innerHTML = '<span class="fb-ok">' + U.icon("check", 15) + " 有工具：AI 先“查到”再“回答”——这就是执行器的本领！</span>";
        busy = false;
        return;
      }
      try {
        var ans = await AgentLab.API.ask(
          "你是天气小管家。你刚刚通过天气查询工具查到了真实结果：" + w.text + "。" + w.suggest + "。请基于这个真实结果，用同学听得懂的话回答“明天穿什么”。",
          "明天穿什么？"
        );
        logLine("> " + ans.replace(/\n/g, "\n> "), "ok", "pg-withtool-log");
        $("pg-tool-fb").innerHTML = '<span class="fb-ok">' + U.icon("check", 15) + " 有工具：AI 先“查到”再“回答”——这就是执行器的本领！</span>";
      } catch (e) {
        logLine("! 出错了：" + (e.message || e), "warn", "pg-withtool-log");
      }
      busy = false;
    }

    $("pg-notool").addEventListener("click", demoNotool);
    $("pg-withtool").addEventListener("click", demoWithtool);
    $("pg-tool-reset").addEventListener("click", function () {
      $("pg-notool-log").innerHTML = '<span class="dim">$ 已清空——再点上面的按钮试一次。</span>';
      $("pg-withtool-log").innerHTML = '<span class="dim">$ 已清空——再点上面的按钮试一次。</span>';
      $("pg-tool-fb").innerHTML = "";
    });

    /* 原理默认收着：先做对比，想追问“为什么”时再展开 */
    var whyBtn = $("pg-why-toggle"), whyBox = $("pg-tool-why");
    if (whyBtn && whyBox) {
      whyBtn.addEventListener("click", function () {
        var open = whyBox.hidden;
        whyBox.hidden = !open;
        whyBtn.setAttribute("aria-expanded", open ? "true" : "false");
        var txt = whyBtn.querySelector(".pf-reveal-txt");
        if (txt) txt.textContent = open ? "收起原理" : "先看原理：没有工具，AI 会怎样？";
      });
    }
  }

  /* ---------- 工具选择游戏（单题闯关） ---------- */
  function bindToolGame() {
    AgentLab.Quiz.mount({
      host: "pg-toolgame-list",
      card: "exe-desc",   /* 回看：工具描述写多细才够（游戏考的就是"描述与选择"） */
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

  /* ---------- 四类验收：一行一个例子，直接点类别 ----------
   * 原来的左右配对要“先点左边、再点右边、最后检查”，步骤多、两个 chip 堆也显得乱。
   * 现在改成每行一道小题：点一下类别就判，错了立刻标出正确项并解释。
   * “到点自己动”不在这道题里判——它是标签，单独用下一道 picker 练。 */
  function bindExeCatPractice() {
    var host = $("exe-cat-practice");
    if (!host) return;

    var DATA = [
      { name: "天气查询", q: "把明天的天气读回来", icon: "cloud", ans: "rd", why: "信息被读进来，世界没变——读。" },
      { name: "计算器", q: "算 25 × 4 + 10 等于多少", icon: "calc", ans: "cp", why: "只加工手上的数字，不读外部、也不改外部——算。" },
      { name: "群发通知", q: "在班级群里发一条通知", icon: "send", ans: "ac", why: "群里真的多了一条消息，世界被改变了——做。" },
      { name: "拆给小助手", q: "把长任务拆给两个小助手一起做", icon: "users", ans: "dp", why: "活交给了别的智能体——派。" },
      { name: "联网搜索", q: "搜一下恐龙是什么", icon: "search", ans: "rd", why: "把网上的真实资料取进来，世界没变——读。" },
      { name: "时间日期", q: "现在几点、今天星期几", icon: "clock", ans: "rd", why: "把当前时间读进来，世界没变——读。" },
      { name: "翻译", q: "把“苹果”翻译成英语", icon: "lang", ans: "cp", why: "只加工手上的字句，外面没变——算。" },
      { name: "提醒", q: "到时间提醒我带跳绳", icon: "bell", ans: "ac", why: "到点真的会去提醒人，世界被改变了——做（再贴一个「到点自己动」标签：响这件事是它自己发生的）。" }
    ];
    var OPTS = [
      { k: "rd", t: "读" },
      { k: "cp", t: "算" },
      { k: "ac", t: "做" },
      { k: "dp", t: "派" }
    ];
    var score = 0, answered = 0;

    function labelOf(k) {
      for (var i = 0; i < OPTS.length; i++) if (OPTS[i].k === k) return OPTS[i].t;
      return k;
    }

    host.innerHTML =
      '<div class="ecp-list">' +
        DATA.map(function (it, i) {
          return '<div class="ecp-row" data-i="' + i + '">' +
            '<div class="ecp-q">' + U.icon(it.icon, 16) +
              "<span><b>" + it.name + "</b><small>" + it.q + "</small></span></div>" +
            '<div class="ecp-opts">' +
              OPTS.map(function (o) {
                return '<button type="button" class="ecp-opt" data-k="' + o.k + '">' + o.t + "</button>";
              }).join("") +
            "</div>" +
            '<div class="ecp-why" hidden></div>' +
          "</div>";
        }).join("") +
      "</div>" +
      '<div class="ecp-bar">' +
        '<span class="ecp-score" id="ecp-score" aria-live="polite">答对 0 / ' + DATA.length + "</span>" +
        '<button type="button" class="ecp-reset" id="ecp-reset">重来</button>' +
        '<span class="ecp-hint">点一下你认为对的那一类</span>' +
      "</div>";

    function updateScore() {
      var el = $("ecp-score");
      if (!el) return;
      el.textContent = "答对 " + score + " / " + DATA.length;
      el.classList.toggle("is-full", answered === DATA.length && score === DATA.length);
      if (answered === DATA.length && score === DATA.length) el.textContent = "全对！";
    }

    host.addEventListener("click", function (e) {
      var reset = e.target.closest(".ecp-reset");
      if (reset) {
        score = 0; answered = 0;
        host.querySelectorAll(".ecp-row").forEach(function (row) {
          row.classList.remove("is-done");
          row.querySelectorAll(".ecp-opt").forEach(function (x) {
            x.disabled = false;
            x.classList.remove("is-ok", "is-no");
          });
          var why = row.querySelector(".ecp-why");
          why.hidden = true;
          why.innerHTML = "";
        });
        updateScore();
        return;
      }
      var b = e.target.closest(".ecp-opt");
      if (!b) return;
      var row = b.closest(".ecp-row");
      if (!row || row.classList.contains("is-done")) return;
      var it = DATA[+row.getAttribute("data-i")];
      var ok = b.getAttribute("data-k") === it.ans;
      row.classList.add("is-done");
      row.querySelectorAll(".ecp-opt").forEach(function (x) {
        x.disabled = true;
        if (x.getAttribute("data-k") === it.ans) x.classList.add("is-ok");
      });
      if (!ok) b.classList.add("is-no");
      var why = row.querySelector(".ecp-why");
      why.hidden = false;
      why.innerHTML = ok
        ? '<span class="ok">✓ 对！</span> ' + it.why
        : '<span class="no">不对。</span> 正确答案是「' + labelOf(it.ans) + '」：' + it.why;
      answered++;
      if (ok) score++;
      updateScore();
    });
  }

  /* ---------- 工具百宝箱（分组 + 能力计数） ---------- */
  /* 试用弹窗同一时间只可能开一个，Esc 关闭交给这一个全局监听：
   * 每次渲染只更新 tryModalState.close，不会累积重复的 keydown。 */
  var tryModalState = { close: null };
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !tryModalState.close) return;
    e.preventDefault();
    tryModalState.close();
  });

  function bindToolbox() {
    var tools = AgentLab.Store.getTools();

    /* 能力计数：让“关掉一个 = 少一样本领”可见 */
    function refreshCount() {
      var t = AgentLab.Store.getTools();
      var on = 0, total = 0;
      document.querySelectorAll('#pg-toolbox input[type="checkbox"]').forEach(function (cb) {
        total++;
        if (t[cb.getAttribute("data-tool")]) on++;
      });
      var el = $("pg-toolbox-count");
      if (el) el.innerHTML = U.icon("hand", 15) + ' 已开启 <b>' + on + ' / ' + total + '</b> 项能力';
    }

    document.querySelectorAll('#pg-toolbox input[type="checkbox"]').forEach(function (cb) {
      cb.checked = !!tools[cb.getAttribute("data-tool")];
      cb.addEventListener("change", function () {
        var t = AgentLab.Store.getTools();
        t[cb.getAttribute("data-tool")] = cb.checked;
        AgentLab.Store.saveTools(t);
        refreshCount();
        U.toast(cb.checked ? "工具已装好，小管家的本领 +1！" : "工具已关闭——去「智能体实验室」问问看它的变化");
      });
    });
    refreshCount();

    /* ---------- 「试一试」：点工具名展开面板，点按钮真的执行一次 ----------
     * 为什么走 AgentLab.Agent.tryTool：它和智能体跑一轮用的是同一份工具实现，
     * 学生在这里看到的结果就是真实结果——不是另写一套演示数据糊弄人。
     * 同时只展开一个面板，页面上不会堆着一排参数与结果。 */
    var openTryId = null;

    /* 打开 / 收起试用弹窗。同一时间只开一个；开着时锁住页面滚动，
     * 关掉后焦点还给刚才点的那个工具名——键盘用户不会“掉”到页面背后。 */
    var lastFocus = null;
    function setTryOpen(id, open) {
      var panel = $("tbx-try-" + id);
      var btn = document.querySelector('#pg-toolbox [data-try="' + id + '"]');
      if (panel) panel.hidden = !open;
      if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        openTryId = id;
        lastFocus = document.activeElement;
        tryModalState.close = function () { setTryOpen(id, false); };
        document.body.classList.add("tbx-modal-open");
        /* 焦点先落到第一个能填的控件；没有就落到关闭按钮 */
        var first = panel && (panel.querySelector(".tbx-modal-body input, .tbx-modal-body select") ||
          panel.querySelector(".tbx-modal-x"));
        if (first) setTimeout(function () {
          try { first.focus({ preventScroll: true }); } catch (e) { try { first.focus(); } catch (e2) { } }
        }, 0);
      } else {
        if (openTryId === id) openTryId = null;
        /* 收起弹窗时把“查看输入参数”的子面板一起收掉：否则下次打开会看到上次的旧内容 */
        var x = $("tbx-input-" + id);
        if (x) x.hidden = true;
        var b2 = panel && panel.querySelector("[data-try-input]");
        if (b2) b2.setAttribute("aria-expanded", "false");
        if (!openTryId) {
          tryModalState.close = null;
          document.body.classList.remove("tbx-modal-open");
          if (lastFocus && lastFocus.focus) {
            try { lastFocus.focus({ preventScroll: true }); } catch (e) { }
          }
          lastFocus = null;
        }
      }
    }

    function toggleTry(id) {
      if (openTryId && openTryId !== id) setTryOpen(openTryId, false);
      var panel = $("tbx-try-" + id);
      if (!panel) return;
      setTryOpen(id, panel.hidden);
    }

    /* ---------- 图形界面的几个小机制 ---------- */
    /* 单选 chip：同一组里只亮一个；带 data-repaint 的（类别 / 图形 / 算法）
     * 改完要重画参数区——换图形就换一组参数，界面不糊弄。 */
    document.querySelectorAll('#pg-toolbox [data-chip]').forEach(function (c) {
      c.addEventListener("click", function () {
        var g = c.getAttribute("data-group");
        /* 在“这一块试用面板”里取消同组高亮——面板已经搬到 body 下，不能再按 #pg-toolbox 查 */
        var scope = c.closest(".tbx-try-input, .tbx-modal, .tbx-ui") || document;
        scope.querySelectorAll('[data-chip][data-group="' + g + '"]').forEach(function (x) {
          x.classList.remove("is-on");
        });
        c.classList.add("is-on");
        if (c.getAttribute("data-repaint")) {
          var host = c.closest(".tbx-ui");
          if (host) paintDyn(host.getAttribute("data-ui"));
        }
      });
    });

    /* 动态参数区：换算的单位下拉 / 图形的边长 / 算法的参数 */
    function paintDyn(id) {
      var box = $("tbx-dyn-" + id);
      var ui = TRY_UI[id];
      if (box && ui && ui.dyn) box.innerHTML = ui.dyn(id);
    }
    Object.keys(TRY_UI).forEach(function (id) { paintDyn(id); });

    /* 计算器小键盘：拼算式；= 直接运行 */
    document.querySelectorAll('#pg-toolbox .tbx-key').forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-kpid") || "calc";
        var k = b.getAttribute("data-kp");
        var panel = $("tbx-try-" + id);
        var input = panel && panel.querySelector('[data-f="' + id + '-expr"]');
        if (!input) return;
        if (k === "back") input.value = input.value.slice(0, -1);
        else if (k === "clear") input.value = "";
        else if (k === "run") { runTry(id, document.querySelector('[data-try-run="' + id + '"]')); return; }
        else input.value += k;
        input.focus();
      });
    });

    /* 计时器：面板里真的倒计时（到点停住并提示） */
    var tryTimerIv = {};
    function startTryTimer(id, seconds, label) {
      var box = $("tbx-count-" + id);
      if (!box) return;
      if (tryTimerIv[id]) { clearInterval(tryTimerIv[id]); tryTimerIv[id] = null; }
      var total = Math.max(1, seconds), remain = total;
      function mmss(n) {
        var m = Math.floor(n / 60), s = n % 60;
        return m + ":" + (s < 10 ? "0" + s : s);
      }
      function paint() {
        box.innerHTML = '<div class="tbx-timer"><b>' + mmss(remain) + "</b>" +
          '<div class="tbx-timer-bar"><i style="width:' + Math.round((1 - remain / total) * 100) + '%"></i></div></div>';
      }
      paint();
      tryTimerIv[id] = setInterval(function () {
        remain--;
        if (remain <= 0) {
          clearInterval(tryTimerIv[id]); tryTimerIv[id] = null;
          box.innerHTML = '<div class="tbx-timer is-done"><b>时间到！</b><span>' +
            (total >= 60 ? Math.round(total / 60) + " 分钟到了" : total + " 秒到了") + "</span></div>";
          /* 到点真的响：和「智能体实验室」的计时器共用同一套响铃 */
          if (AgentLab.Alarm) {
            AgentLab.Alarm.ring({ text: "⏰ " + (label || (total >= 60 ? Math.round(total / 60) + " 分钟" : total + " 秒")) + " 到啦！" });
          }
          return;
        }
        paint();
      }, 1000);
    }

    /* ---------- 「查看输入参数」 ----------
     * 试用不经过大模型，那这次到底“输入了什么”？把执行器收到的那一份原样摊开：
     * 函数名 + 参数（归一化后）+ 原话。面板里填的另列一份，两者的差异一眼能看出来。 */
    function paintTryInput(id) {
      var panel = $("tbx-try-" + id);
      var box = $("tbx-input-" + id);
      var ui = TRY_UI[id];
      if (!panel || !box || !ui) return;
      var inp = ui.read(panel, id) || { params: {}, text: "" };
      var d = AgentLab.Agent.previewToolInput(id, inp.params || {}, inp.text || "");
      var full = { function: d.fn || "", name: d.name, arguments: d.params, userText: d.userText };
      var same = JSON.stringify(d.panelParams) === JSON.stringify(d.params);
      /* 这件工具内部会不会自己调模型：翻译一定会，联网搜索只有降级才可能，其余不会。
       * 同一块面板里说清楚，不再单开第二个“大模型上下文”弹层。 */
      var calls = (AgentLab.Agent.modelCallsFor ? AgentLab.Agent.modelCallsFor(id, inp.params || {}) : []) || [];
      var willCall = calls.filter(function (c) { return c.when === "run"; });

      /* 提醒工具的参数里没有“时间”，学生很容易以为输入少了东西。
       * 这里单独把“工具自己从原话里解析出来的时间”摊开——它确实不在 arguments 里。 */
      var derivedHtml = "";
      if (d.derived) {
        var whenText = d.derived.ok
          ? U.esc(d.derived.label) + "（" + U.esc(stampOf(d.derived.at)) + " 响铃）"
          : "没解析出时间——这次只会记下内容，不会响铃";
        derivedHtml = '<div class="tbx-ctx-block">' +
          '<div class="tbx-ctx-cap"><b>时间为什么不在参数里？</b><span>' +
            "提醒工具的 arguments 只装“提醒什么”；“什么时候响”是它自己<b>从原话里解析</b>出来的（" +
            "parseRemindWhen：先找时长/日期/钟点，再换算成时间戳）。所以参数看着短，其实没缺东西。</span></div>" +
          '<div class="tbx-in-rows">' +
            '<div class="tbx-in-row"><b>原话</b><code>' + U.esc(d.userText) + "</code></div>" +
            '<div class="tbx-in-row"><b>解析出的时间</b><code>' + whenText + "</code></div>" +
          "</div>" +
        "</div>";
      }

      /* 模型那一节：会调就列出请求体，不会调就用一句话交代，不再另开一个面板 */
      var modelHtml = "";
      if (willCall.length) {
        modelHtml += '<div class="tbx-ctx-head is-model">' +
          '<span class="tbx-ctx-tag">经过大模型</span>' +
          "<span>翻译工具自己不会翻译——它内部就是把下面这份请求发给模型，再把译文原样返回。<b>但“翻什么、译成哪种语言”仍是你在面板里定的</b>，模型没有参与这部分。</span></div>";
      } else if (calls.length) {
        modelHtml += '<div class="tbx-ctx-head is-maybe">' +
          '<span class="tbx-ctx-tag">可能经过</span>' +
          "<span>主通道<b>不经过聊天大模型</b>：搜索接口只返回网页（标题 + 摘要 + 链接），不生成文字；只有联网失败、改走「知识兜底」时才会把下面这份请求发给模型。</span></div>";
      } else {
        modelHtml += '<div class="tbx-in-none">这次<b>不经过大模型</b>：参数是你在面板里填的，直接交给执行器——所以没配 Key 也能试。</div>';
      }
      calls.forEach(function (c) {
        modelHtml += '<div class="tbx-ctx-block">' +
          '<div class="tbx-ctx-cap"><b>' + U.esc(c.label) + '</b><span>' + U.esc(c.note || "") + "</span></div>" +
          '<pre class="tbx-ctx-pre">' + U.esc(JSON.stringify(c.body, null, 2)) + "</pre>" +
          "</div>";
      });

      /* 对照：同一句原话走「智能体实验室」，模型第一轮会收到什么（预览，不发送） */
      var previewHtml = "";
      if (AgentLab.Agent.previewRequest) {
        previewHtml = '<details class="tbx-ctx-more">' +
          "<summary>对照：换到「智能体实验室」里问同一句话，模型第一轮会收到什么？（预览，不会发出）</summary>" +
          '<div class="tbx-ctx-cap"><span>真实对话和试用的差别就在这份请求里：多了一整份 <code>system</code>（规则 + 长期记忆 + 执行器要求）和 <code>tools</code>（已开启工具的说明书）。' +
          "模型读完这些，才自己决定调哪件工具、参数填什么；而试用面板把这一步跳过了，参数是你直接填的。</span></div>" +
          '<pre class="tbx-ctx-pre">' + U.esc(JSON.stringify(AgentLab.Agent.previewRequest(inp.text || ""), null, 2)) + "</pre>" +
          "</details>";
      }

      box.innerHTML =
        '<div class="tbx-ctx-head is-exe">' +
          '<span class="tbx-ctx-tag">执行器收到的输入</span>' +
          "<span>工具只认下面这几样：<b>函数名 + 参数 + 原话</b>。参数在这一步已经过“参数校验与兜底”（补默认值、对齐单位、从原话里纠正数字），所以可能和你在面板里填的不完全一样。</span>" +
        "</div>" +
        '<div class="tbx-ctx-block">' +
          '<div class="tbx-ctx-cap"><b>完整输入</b><span>这就是执行器拿到的全部东西——它不知道大模型，也不知道界面。</span></div>' +
          '<pre class="tbx-ctx-pre">' + U.esc(JSON.stringify(full, null, 2)) + "</pre>" +
        "</div>" +
        derivedHtml +
        '<div class="tbx-ctx-block">' +
          '<div class="tbx-ctx-cap"><b>面板里填的（归一化之前）</b><span>' +
            (same ? "与上面完全一致，说明这次不需要补默认值或纠正数字。" : "和上面不一样的地方，就是执行器补上 / 改好的：以“完整输入”里那份为准。") +
          "</span><code class=\"tbx-in-code\">" + U.esc(JSON.stringify(d.panelParams)) + "</code></div>" +
        "</div>" +
        modelHtml +
        previewHtml;
    }

    function runTry(id, btn) {
      var panel = $("tbx-try-" + id);
      var out = $("tbx-try-out-" + id);
      var ui = TRY_UI[id];
      if (!panel || !out || !ui) return;
      /* 点“运行”就是用户手势：解锁音频，计时器到点才响得出来 */
      if (AgentLab.Alarm) AgentLab.Alarm.unlock();
      var inp = ui.read(panel, id) || { params: {}, text: "" };
      if (btn) { btn.disabled = true; btn.textContent = "正在执行…"; }
      out.innerHTML = '<span class="tbx-try-wait">工具正在执行，请稍等…</span>';
      if (id === "timer") startTryTimer(id, inp.params.seconds || 0, inp.params.label);

      AgentLab.Agent.tryTool(id, inp.params || {}, inp.text || "").then(function (r) {
        var params = (r && r.params) || inp.params || {};
        /* 参数是谁填的，必须写清楚：这里是同学在面板里填的，不是模型。
         * 只有翻译（内部调模型）和搜索的知识兜底（降级才走）会让模型参与。 */
        var viaModel;
        if (r && r.payload && r.payload.fallback) {
          viaModel = "这一次联网没成功，走了「知识兜底」——<b>确实调用了大模型</b>";
        } else if (id === "translate") {
          viaModel = (r && r.payload && r.payload.needKey)
            ? "这一次<b>没有</b>调用大模型：翻译需要先配 Key，现在只是演示流程"
            : "这一次翻译工具<b>内部调用了 1 次大模型</b>（参数仍是你填的）";
        } else {
          viaModel = "这一次<b>没有经过大模型</b>——参数是你填的，直接交给执行器";
        }
        out.innerHTML =
          '<div class="tbx-try-params"><b>原话</b>' + U.esc(inp.text || "") + "</div>" +
          '<div class="tbx-try-params"><b>参数（你在面板里填的）</b><code>' + U.esc(JSON.stringify(params)) + "</code></div>" +
          '<div class="tbx-try-result"><b>工具返回</b><div>' + U.esc((r && r.result) || "（没有返回结果）") + "</div></div>" +
          '<div class="tbx-try-who"><span>' + viaModel + "</span></div>";
        /* 「查看输入参数」若正开着，参数刚变过，跟着重算一遍 */
        var inBox = $("tbx-input-" + id);
        if (inBox && !inBox.hidden) paintTryInput(id);
      }).catch(function (e) {
        out.innerHTML = '<div class="tbx-try-err">' + U.icon("alert", 13) + " " +
          U.esc((e && e.message) || "这次没跑通，请稍后再试。") + "</div>";
      }).then(function () {
        if (btn) { btn.disabled = false; btn.textContent = "运行这个工具"; }
      });
    }

    document.querySelectorAll('#pg-toolbox [data-try]').forEach(function (b) {
      b.addEventListener("click", function () { toggleTry(b.getAttribute("data-try")); });
    });
    document.querySelectorAll('#pg-toolbox [data-try-run]').forEach(function (b) {
      b.addEventListener("click", function () { runTry(b.getAttribute("data-try-run"), b); });
    });
    /* 「查看输入参数」：只留这一个入口。每次展开都按当前控件值重算，
     * 看到的永远是“这次会发给执行器的那一份”。 */
    document.querySelectorAll('#pg-toolbox [data-try-input]').forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-try-input");
        var box = $("tbx-input-" + id);
        if (!box) return;
        var open = box.hidden;
        if (open) paintTryInput(id);
        box.hidden = !open;
        b.setAttribute("aria-expanded", open ? "true" : "false");
        if (open && box.scrollIntoView) {
          try { box.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) { }
        }
      });
    });

    /* 弹窗关闭：遮罩空白处、右上角 × 都走这一条 */
    document.querySelectorAll('#pg-toolbox .tbx-modal [data-try-close]').forEach(function (b) {
      b.addEventListener("click", function () { setTryOpen(b.getAttribute("data-try-close"), false); });
    });

    /* 试用弹窗搬到 body 下：卡片带 hover 位移（transform），
     * 留在卡片里 position:fixed 会以卡片为参照系，弹窗位置会跟着卡片跑偏。
     * 事件都绑在元素自己身上，搬家不影响；重新渲染时清掉上一轮的旧弹窗。 */
    var host = document.getElementById("tbx-modal-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "tbx-modal-host";
      document.body.appendChild(host);
    }
    host.innerHTML = "";
    document.querySelectorAll("#pg-toolbox .tbx-modal").forEach(function (m) { host.appendChild(m); });
    /* 重新渲染可能发生在弹窗开着的时候：状态一起复位，别留下锁滚动的 body */
    openTryId = null;
    tryModalState.close = null;
    document.body.classList.remove("tbx-modal-open");
  }

  /* ---------- 小测验（单题闯关） ---------- */
  function bindQuiz() {
    AgentLab.Quiz.mount({
      host: "exe-quiz-body",
      card: "sec-map-executor",   /* 章末综合小测（15 题覆盖整课）→ 回看本课学习地图，自己挑卡 */
      color: "exe",
      name: "工具小达人",
      star: "exe-quiz-score",
      restart: "exe-quiz-restart",
      questions: QUIZ,
      hint: "再想想——可以回到工具分类、Function Calling 和工具幻觉那几张卡片找答案。"
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
      links: [{ t: "Function Calling 分步接力", el: "exe-fc-flow" }, { t: "参数组装实战", el: "exe-args" }]
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
      id: "five", icon: "box", nav: "工具分类", name: "工具分类（读·算·做·派 + 标签）", en: "TOOL TAXONOMY",
      tip: "ai-agent-book 第 4 章把工具分成五类（感知 / 执行 / 协作 / 事件触发 / 用户沟通）。本课按“做什么”重新排成四类：<b>读</b>（把信息拿进来）、<b>算</b>（只加工，不碰外面）、<b>做</b>（让外面真的变）、<b>派</b>（交给别的 Agent 或人）；再把“什么时候做”单独做成一个标签<b>「到点自己动」</b>。",
      analogy: "像教室里的分工：有人看（读）、有人算（算）、有人动手（做）、有人去请别人帮忙（派）；闹钟到点响不是第五种人，它只是“到点自己动”的标签。",
      real: "为什么这么排：书里的五类同时用了两个特征——<b>作用对象</b>（读 / 改）和<b>谁发起</b>（Agent 调用 / 外部触发），所以同一个“提醒”能同时像执行、事件触发和用户沟通。四类只问“它做了什么”，每个工具因此只有一个类；风险等级也按类给：<b>读</b>可以放开用，<b>算</b>基本无副作用，<b>做</b>会留下后果、必须加确认与审计，<b>派</b>还要管住被委托方。配工具的原则是“按场景配必要的一组”，不是“什么都有”。",
      quiz: { q: "为什么“工具越多越好”是错的？", a: "工具越多，可选项越多，模型选错的概率越高；而且每个工具的定义都要占用上下文。正确做法是按场景配最必要的一组，需要时再加。" },
      links: [{ t: "工具抢答游戏", el: "pg-toolgame" }]
    },
    {
      id: "desc", icon: "pen", nav: "工具描述", name: "工具描述（Tool Description）", en: "TOOL DESCRIPTION",
      tip: "工具描述是模型选择工具的唯一依据：写得清楚，才可能选对。",
      analogy: "像给遥控器按键贴标签：只写“按钮 1、按钮 2”没人会用；写成“电源、音量+、频道-”人人都会。",
      real: "一份好描述写全<b>四要素</b>：<b>功能</b>（一句话说清用途，名字最好动词开头）、<b>参数</b>（类型 / 是否必填 / 枚举值）、<b>返回</b>（会拿回什么结果）、<b>场景</b>（什么时候该用、什么时候不该用）。描述含糊是“选错工具”的第一大原因。",
      quiz: { q: "“工具名：do_stuff；描述：处理数据”有什么问题？", a: "名字没说明做什么、描述里没有参数与返回说明，模型无法判断该不该用它。改法示例：weather_query +“查询指定城市指定日期的天气，参数 city（中文城市名）、date（YYYY-MM-DD）”。" },
      links: [{ t: "工具抢答游戏", el: "pg-toolgame" }, { t: "描述质量调参", el: "exe-desc" }]
    },
    {
      id: "mcp", icon: "link", nav: "MCP 协议", name: "MCP 协议", en: "MODEL CONTEXT PROTOCOL",
      tip: "MCP 是工具的“USB 接口”：统一协议后，工具接一次就能被不同模型 / 应用复用。",
      analogy: "像 USB：以前每种设备一个专用接口，现在统一成一个口，插上就能用。",
      real: "没有标准时，N 个工具 × M 个模型 = N×M 套适配代码；有了 MCP，工具按协议暴露一次，任何支持 MCP 的客户端都能调用——把乘法变成了加法。它还带来统一的能力发现（列出有哪些工具）与权限声明。",
      quiz: { q: "为什么说 MCP 把“乘法变成加法”？", a: "没有标准时，工具与模型两两适配是 N×M；有了统一协议，工具只需实现一次、客户端只需接入一次，复杂度降到 N+M。工具生态才能真正长起来。" },
      links: [{ t: "该不该上 MCP（场景判断）", el: "exe-mcp" }, { t: "工具百宝箱", el: "pg-toolbox" }]
    },
    {
      id: "hallu", icon: "alert", nav: "工具幻觉", name: "工具发现与幻觉风险", en: "TOOL HALLUCINATION",
      tip: "模型可能“编造”根本不存在的工具或参数——这叫工具幻觉。",
      analogy: "像有人一本正经地说“我用第五种方法解决的”，其实根本没有第五种方法：听起来合理，机器一执行就报错。",
      real: "三种典型幻觉：<b>编工具</b>（调用不存在的函数）、<b>编参数</b>（传了 schema 里没有的字段）、<b>编结果</b>（工具还没返回就先把答案说了）；还要防一类<b>坏数据</b>（工具真返回了但结果明显不对）。四道防线：只暴露白名单工具、参数强校验、必须等 tool 消息回填才能继续生成、结果验证（检查返回值是否合理）。",
      quiz: { q: "“工具还没返回，模型就把天气说出来了”属于哪种幻觉？", a: "编造结果。它跳过了“观察”这一步，直接给出答案。防线是：工具调用之后必须等待 tool 消息回填，才允许生成最终回答。" },
      links: [{ t: "工具幻觉与约束", el: "pg-tool-fb" }]
    },
    {
      id: "chain", icon: "refresh", nav: "多工具协作", name: "多工具协作（Tool Chaining）", en: "TOOL CHAINING",
      tip: "复杂任务要按依赖顺序调用多个工具——这叫工具链式调用。",
      analogy: "像做一顿饭：先买菜（查信息）→ 再洗切（处理）→ 才下锅（执行）。顺序错了，饭做不成。",
      real: "链式调用的关键：<b>依赖关系</b>（上一步的输出是下一步的输入）、<b>中间结果校验</b>（拿不到就中止，而不是硬走）、<b>失败恢复</b>（换工具 / 换参数 / 上报）。工程上还会给单次任务设最大调用次数（停止条件）。",
      quiz: { q: "工具链：查天气 → 查景点 → 生成行程。哪个顺序不能反？为什么？", a: "不能反。生成行程需要“天气”与“景点”两个结果；而查景点通常不需要先知道天气。顺序必须服从数据依赖，而不是“哪个先问到”。" },
      links: [{ t: "预测多工具链式调用", el: "exe-chain" }]
    },
    {
      id: "sense", icon: "eye", nav: "读 / 算 / 做", name: "读、算、做：三类，三种风险", en: "READ / COMPUTE / ACT",
      tip: "四类工具里，风险主要看“碰不碰外面”：<b>读</b>只拿信息、<b>算</b>只在内部加工、<b>做</b>会留下后果，<b>派</b>还要管住被委托的一方。",
      analogy: "像看、算、动手：看错了可以再看（低风险）；算错了重算一遍（没有副作用）；手一挥可能打翻东西（高风险）。",
      real: "<b>读</b>（查询 / 搜索 / 读文件）只读、风险低，可以放开用；<b>算</b>（计算 / 换算 / 翻译）不碰外部，基本没有副作用，但结果错了会误导决策，要有校验；<b>做</b>（下单 / 发消息 / 删除 / 转账）会改变真实世界，必须加人工确认、权限校验、额度限制与审计日志；<b>派</b>（子 Agent / 请人确认）还要管住被委托方有没有越权。",
      quiz: { q: "为什么“删除文件”和“查询天气”要用完全不同的治理强度？", a: "因为可逆性不同：查天气看错了没有影响，删文件删错了无法撤销。治理强度应当按“操作的不可逆程度与影响范围”来定——而不是按模型说得有多确定。" },
      links: [{ t: "工具分类", el: "exe-cat-cards" }, { t: "工具百宝箱", el: "pg-toolbox" }]
    },
    {
      id: "event", icon: "clock", nav: "触发方式：到点自己动", name: "触发方式：到点自己动（Event-Driven）", en: "EVENT-DRIVEN",
      tip: "它不是独立的一类工具，而是一个<b>标签</b>：有些事不是“被叫才做”，而是“到点/有事自己动”——定时任务、消息回调、监控告警。",
      analogy: "像闹钟与门铃：闹钟到点自己响（定时事件），门铃有人按才响（回调事件）——都不需要你一直守着。",
      real: "事件驱动让 Agent 从“问答机器人”变成“常驻助手”：<b>定时触发</b>（每天 7:30 检查课表并提醒——这类“到点自己就跑”的定时规则，工程上叫 " + U.term("cron", 'cron 是 Linux 上一个经典的后台定时服务：写一行「<code>分 时 日 月 周</code>」格式的规则——比如 <code>30 7 * * *</code> 就表示“每天 7:30”——系统到点自动执行，不需要任何人提问。<br>所以“cron 类事件”＝按时间表自动触发的事件。Agent 的“主动服务”能力，很多就架在这类定时机制上。') + "）、<b>订阅回调</b>（有新邮件就处理）、<b>阈值告警</b>（库存低于阈值就补货）。注意：在本课的分类里它不占一个类——这些动作仍然是“<b>做</b>”（真的会执行、会留下后果），只是<b>出发方式</b>不同。工程上要处理重复触发、事件失序，以及“事件来了但用户不在”的情况。",
      quiz: { q: "“每天早上 7:30 自动提醒今天值日”——它的类别和标签分别是什么？", a: "类别是“做”（真的会检查、会提醒，留下后果），标签是“到点自己动”（定时触发，没人叫它）。标签回答“什么时候做”，不是第五类。" },
      links: [{ t: "工具百宝箱", el: "pg-toolbox" }]
    },
    {
      id: "gov", icon: "shield", nav: "工具治理", name: "Harness 中的工具治理", en: "TOOL GOVERNANCE",
      tip: "“模型说什么就执行什么”是危险的：工具调用必须经过治理层。",
      analogy: "像门禁：不是谁刷卡都能进机房，得有权限、得登记，危险操作还得主管确认。",
      real: "治理四件事：<b>白名单</b>（只能调登记过的工具）、<b>参数校验</b>（类型 / 范围 / 枚举）、<b>人工确认</b>（危险操作先问人）、<b>审计日志</b>（谁在什么时候调了什么、结果如何）。这一层不在模型里，而在系统的 Harness 层。",
      quiz: { q: "为什么审计日志是治理的必需品？", a: "出问题时，它是唯一能还原“发生了什么”的依据：调了哪个工具、传了什么参数、谁批准的。没有日志，故障排查与责任界定都无从下手。" },
      links: [{ t: "工具百宝箱", el: "pg-toolbox" }]
    },
    {
      id: "aci", icon: "wrench", nav: "工具设计（ACI）", name: "工具设计：给 Agent 用的界面（ACI）", en: "AGENT-COMPUTER INTERFACE",
      tip: "工具不是“把底层接口原样暴露给模型”，而是按“Agent 要达成什么目标”来设计——这才是给机器用的界面。",
      analogy: "像给新同学写“教室设备使用说明”：不写“按下第二排第三个开关”，而写“想投影就按这里”。<b>按目标设计</b>，而不是按零件设计。",
      real: "三条设计原则：① 工具的粒度要匹配<b>目标</b>（“查资料并整理”比“GET /api/v1/search?q=”好用）；② <b>防呆</b>——让错误从设计上发生不了（SIM 卡的缺角只能一个方向插、微波炉门没关好就不加热）；③ 优先考虑<b>通用执行器</b>（一个代码执行能顶几十个小工具），只有四种情况才值得专门造工具：安全权限、屏蔽平台差异、超高频调用、参数复杂需要强校验。<br>此外工具必须<b>保真</b>：不改参数、不藏截断。",
      quiz: { q: "为什么“一个通用的代码执行工具”常常比“几十个专用小工具”更好用？", a: "因为模型不必在几十个相似工具里挑（工具越多越容易选错、定义也越占上下文），它只需写一小段代码就能组合出想要的能力。但通用工具的权限更大，所以要关进沙盒、限制目录与网络——能力与约束要一起给。" },
      links: [{ t: "工具描述与选择", el: "exe-desc" }, { t: "实验：代码执行与沙盒", el: "exe-sandbox" }]
    },
    {
      id: "idem", icon: "key", nav: "幂等与重试", name: "幂等与重试安全", en: "IDEMPOTENCY & SAFE RETRY",
      tip: "重试前先问一句：这个动作做两遍，会不会变成两件事？会，就必须加保护。",
      analogy: "像按电梯按钮：按两次不会叫来两部电梯（幂等）；但“发送”按钮按两次，可能真的发出两条消息（不幂等）。",
      real: "判据：<b>重复执行是否产生额外副作用</b>。查询与可覆盖的写操作可以放心重试；对外发送、花钱、删除这类动作必须保护：① <b>幂等键</b>——给这件事一个唯一编号，服务端见过就不再重复执行；② <b>两段式</b>——先预检/请示，确认后再执行（人工确认超时通常按“保守”处理，即不执行）。<br>工程上还要配：重复调用指纹（同名工具同参数又出现＝原地打转）、连续失败计数与熔断（连续失败约 3 次转人工）。",
      quiz: { q: "“发通知超时了，直接再发一次”可能带来什么后果？", a: "可能真的发出两条通知（发送不可重复）。正确做法是带幂等键重试，或先查状态；对不可重复的动作，宁可多问一句，也不要多做一遍。" },
      links: [{ t: "实验：失败了能不能重试", el: "exe-idem" }, { t: "实验：四道防线", el: "exe-guard" }]
    },
    {
      id: "exec", icon: "lock", nav: "代码执行与沙盒", name: "代码执行与沙盒隔离", en: "CODE EXECUTION & SANDBOX",
      tip: "代码执行是执行力最强的工具——所以它必须跑在沙盒里：限目录、默认断网、设超时、限输出。",
      analogy: "像让孩子用真工具做木工：不给他整间屋子随便动，而是给他一张工作台（限定范围）、戴上护目镜（超时与限量），旁边还有老师看着（日志与确认）。",
      real: "沙盒管四件事：<b>能碰什么</b>（只能访问工作目录）、<b>能去哪</b>（默认断网、白名单放行）、<b>能跑多久</b>（超时中止，并把原因结构化回传）、<b>能说多少</b>（输出截断要说明，完整结果留档可再读）。<br>隔离强度三档：进程级 → 容器（最常见）→ 微型虚拟机（最强）。<b>虚拟环境（venv）不是沙盒</b>：它管“用哪个环境”，拦不住删文件与联网。代码编排还能省 Token（中间结果留在执行环境，只回传最终结果）。",
      quiz: { q: "为什么“默认断网”是沙盒里最关键的一条？", a: "因为断网能一次挡住最坏的结果——把数据偷偷传出去。即使代码读到了敏感内容，没有网络出口就带不走；确实需要联网时再按白名单放行，风险可控。" },
      links: [{ t: "实验：代码执行与沙盒", el: "exe-sandbox" }, { t: "工具百宝箱", el: "pg-toolbox" }]
    }
  ];

  /* 概念 id → 交互类型 */
  var EXE_TYPE = {
    fc: "composer", api: "pipeline", five: "matcher", desc: "sandbox", mcp: "decider",
    hallu: "annotator", chain: "sorter", sense: "decider", event: "switchboard", gov: "sandbox",
    /* 新增三概念：工具设计 / 重试安全 / 代码执行沙盒 */
    aci: "matcher", idem: "race", exec: "switchboard"
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
        { role: "assistant", text: '{"tool_calls":[{"name":"weather_query","arguments":{"city":"北京","date":"2026-10-12"}}]}', toolcall: true, tag: "模型输出：结构化调用指令（tool_calls）" },
        { role: "tool", text: '{"city":"北京","date":"2026-10-12","weather":"小雨","temp":"15~19℃"}', tag: "程序执行工具后回填的真实结果" },
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
          model: (AgentLab.API.getSettings && AgentLab.API.getSettings().model) || AgentLab.CONFIG.model,
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
      title: "动手实验：这些工具各属于哪一类？", hint: "左右配对", icon: "box",
      leftTitle: "① 先点左边一个工具：",
      rightTitle: "② 再点右边它属于哪一类：",
      left: [
        { id: "t1", label: "天气查询", icon: "cloud", why: "只读：把外部信息读回来，属于读。" },
        { id: "t2", label: "联网搜索", icon: "search", why: "只读：从外部获取信息，属于读。" },
        { id: "t3", label: "时间日期", icon: "clock", why: "只读：读的是系统时钟，获取信息，也属于读。" },
        { id: "t4", label: "计算器", icon: "calc", why: "只加工手上的数字，不读外部、也不改外部，属于算。" },
        { id: "t5", label: "单位换算", icon: "ruler", why: "把数值换成另一种单位，外面什么都没变，属于算。" },
        { id: "t6", label: "提醒工具", icon: "bell", why: "它会真的记下一件事、到点响铃，留下后果，属于做（再贴「到点自己动」标签）。" },
        { id: "t7", label: "主动发消息通知家长", icon: "send", why: "消息真的发出去了，留下后果，属于做（对象是人）。" },
        { id: "t8", label: "委托子 Agent 去查资料", icon: "users", why: "活儿交给了另一个智能体，属于派。" },
        { id: "t9", label: "定时任务：每天 7:30 检查课表", icon: "clock", why: "它真的会去检查、会执行，属于做；只是出发方式是「到点自己动」。" }
      ],
      right: [
        { id: "rd", label: "读（把信息拿进来）", icon: "eye" },
        { id: "cp", label: "算（只加工，不碰外面）", icon: "calc" },
        { id: "ac", label: "做（让外面真的变）", icon: "hand" },
        { id: "dp", label: "派（交给别的 Agent 或人）", icon: "users" }
      ],
      pairs: { t1: "rd", t2: "rd", t3: "rd", t4: "cp", t5: "cp", t6: "ac", t7: "ac", t8: "dp", t9: "ac" },
      checkLabel: "检查我配的类别",
      resetLabel: "重来",
      empty: "先点左边一个工具，再点右边它属于哪一类。",
      pickTip: "先在左边点一个工具，再点右边它属于哪一类",
      passHtml: "四类看“做什么”：<b>读</b>把信息拿进来、<b>算</b>只在内部加工、<b>做</b>让外面真的变、<b>派</b>交给别人。再看“什么时候做”：到点/有事自己动 → 贴<b>「到点自己动」</b>标签（提醒、定时任务）。配工具的原则是“按场景配必要的一组”，不是“什么都有”。",
      failHtml: "口诀：它碰外面的东西了吗？没碰 → <b>读</b>（拿进来）/ <b>算</b>（自己加工）；碰了 → <b>做</b>（自己动手）/ <b>派</b>（让别人动手）。"
    },
    desc: {
      title: "动手实验：同一件事，两种工具描述", hint: "换一份描述再对比", icon: "pen",
      srcTitle: "① 选择用户需求（全程不变）：",
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
      guardTitle: "② 工具描述换一换：",
      guardLabelOn: "换成完整描述（功能 + 参数 + 返回 + 使用场景）",
      guardLabelOff: "换成含糊描述（只有一个名字）",
      contentTitle: "同一件事，模型看到的只有“需求 + 描述”：",
      dataLabel: "① 用户需求（不变）：",
      injectLabel: "② 工具描述（要对比的就是这里）：",
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
      title: "动手实验：这段调用日志里，哪些行为是幻觉？", hint: "在材料上点选", icon: "alert",
      materialLabel: "一次真实风格的调用日志：",
      taskLabel: "点选日志里所有属于<b>工具幻觉</b>的行为（编造工具 / 编造参数 / 编造结果）。",
      checkLabel: "检查我标的幻觉行为",
      resetLabel: "重来",
      empty: "先点选你认为属于幻觉的行为，再点「检查我标的幻觉行为」。",
      passHtml: "四道防线：<b>只暴露白名单工具</b>（防编工具）、<b>参数强校验</b>（防编参数）、<b>必须等 tool 消息回填才能生成</b>（防编结果）、<b>结果验证</b>（防坏数据）。",
      failHtml: "提示：区分“正常的工具调用”和“凭空造出来的东西”。",
      segments: [
        { text: "用户问“明天北京天气怎么样？”，模型随后输出：", ok: false, why: "这是正常的用户提问与模型输出，本身不是幻觉。" },
        { text: "调用工具 get_flight_price", ok: true, why: "编造工具：工具箱里根本没有这个工具（登记表里只有 weather_query / calculator / reminder），白名单校验会直接拒绝。" },
        { text: "，参数里塞了 schema 没有的 user_token=\"sk-abc123\"", ok: true, why: "编造参数，而且是最危险的一类：把密钥写进了参数。参数强校验（只允许登记过的字段）能拦住它。" },
        { text: "；紧接着又说“明天北京晴，25℃”", ok: true, why: "编造结果：工具还没返回就把天气说出来了，跳过了“观察”这一步。必须等 tool 消息回填后才能生成最终回答。" },
        { text: "；工具箱里实际登记的是 weather_query、calculator、reminder。", ok: false, why: "这是工具登记表——它正是用来判断“有没有编工具”的依据，本身不是幻觉。" },
        { text: "对照：正确的一轮应该调用 weather_query(city, date)，等工具结果回填后再回答。", ok: false, why: "这是正确做法：先观察、再回答，就不会编造。" }
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
        { key: "cat", q: "① 这个工具属于哪一类？—— delete_file（删除文件）", opts: [{ k: "read", t: "读（只拿信息，世界不变）" }, { k: "act", t: "做（会改变真实世界）" }] },
        { key: "gov", q: "② 该给它配多强的治理？", opts: [{ k: "loose", t: "宽松（和「读」一样）" }, { k: "strict", t: "严格（权限 + 人工确认 + 审计）" }] }
      ],
      decide: function (ans) {
        var right = ans.cat === "act" && ans.gov === "strict";
        return (right ? '<span class="ok">✓ 判断正确：</span>' : '<span class="no">再想想：</span>') +
          "<b>delete_file 属于「做」</b>，必须配<b>严格治理</b>。<br>" +
          '<span class="dim">理由：它<b>改变了真实世界</b>，而且不可撤销——删错就没有撤销键。所以要有权限校验、人工确认、以及审计日志。</span><br>' +
          '<b>对照一下「读」：</b>查询天气、搜索资料都是只读，看错了没有影响，可以放开用、连确认都不需要。<br>' +
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
      title: "动手实验：有治理 vs 没治理，同一句指令的两种结局", hint: "开关治理层再看结局", icon: "shield",
      srcTitle: "① 选择一条模型发起的工具调用：",
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
      guardTitle: "② 系统治理层（模型管不着的一层）：",
      guardLabelOn: "治理开启：白名单 → 参数校验 → 人工确认 → 审计日志",
      guardLabelOff: "治理关闭：模型提什么就执行什么",
      contentTitle: "模型提交的这一条请求 + 它可能造成的后果：",
      dataLabel: "① 模型的请求：",
      injectLabel: "② 直接执行的风险：",
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
    },
    /* 工具设计（ACI）：通用执行器 vs 专用工具 */
    aci: {
      title: "动手实验：这些需求，该用通用执行器还是专门造工具？", hint: "左右配对", icon: "wrench",
      leftTitle: "① 先点左边一个需求：",
      rightTitle: "② 再点右边它适合的做法：",
      left: [
        { id: "d1", label: "经常要算各种公式、处理表格数据", icon: "calc", why: "优先通用执行器：给一个“代码/脚本执行”能力，什么公式都能算——比做几十个小计算器划算得多。" },
        { id: "d2", label: "只允许读取指定目录，绝不能碰其他地方", icon: "lock", why: "专用工具：安全权限是造专用工具的典型理由——把边界写死在工具里。" },
        { id: "d3", label: "手机、电脑、网页上都要用，还要屏蔽系统差异", icon: "globe", why: "专用工具：屏蔽平台差异，让模型不用关心“在哪个系统上跑”。" },
        { id: "d4", label: "这个动作每天要用上千次，值得专门优化", icon: "zap", why: "专用工具：超高频调用，专用工具能做更快、更稳。" },
        { id: "d5", label: "参数很复杂（多字段、有枚举、要校验范围）", icon: "ruler", why: "专用工具：复杂参数需要强校验，专用工具能把规则写清楚、挡住非法输入。" },
        { id: "d6", label: "偶尔让 AI 写一小段代码算个结果", icon: "spark", why: "通用执行器：偶尔用一次，不必专门造工具——但要跑在沙盒里。" }
      ],
      right: [
        { id: "gen", label: "优先通用执行器（一个顶多个）", icon: "brain" },
        { id: "spec", label: "值得专门造一个工具", icon: "wrench" }
      ],
      pairs: { d1: "gen", d2: "spec", d3: "spec", d4: "spec", d5: "spec", d6: "gen" },
      checkLabel: "检查我配的做法",
      resetLabel: "重来",
      empty: "先点左边一个需求，再点右边它适合的做法。",
      pickTip: "先在左边点一个需求，再点右边它适合的做法",
      failHtml: "提示：先问一句——这件事需要“严格权限边界 / 屏蔽平台差异 / 超高频 / 复杂参数”吗？都不需要，就先用通用执行器。",
      passHtml: "设计口诀：<b>通用执行器优先（一个顶几十个小工具）；只有四种情况才专门造工具——安全权限、屏蔽平台差异、超高频调用、参数复杂需强校验。</b>"
    },
    /* 幂等与重试安全：双轨推进（精简版） */
    idem: {
      color: "exe",
      title: "动手实验：同一件事，重试方式不同，结果差多少？", hint: "点「走一步」", icon: "key",
      taskLabel: "任务：", task: "“帮我把「明天带美术工具」的通知发到班级群。”",
      stepLabel: "走一步", allLabel: "一次走完",
      empty: "点「走一步」，看两栏分别会发生什么。",
      tracks: [
        {
          id: "raw", label: "超时就重发（没有编号）", icon: "send",
          steps: [
            { t: "第 1 次发 → 超时（不确定对方收到没有）。", tone: "warn" },
            { t: "直接重发 → 又超时。", tone: "warn" },
            { t: "再发一次 → 成功。", tone: "ok" },
            { t: "同学们收到 <b>3 条</b>一样的通知，以为是三件事。", tone: "no" }
          ],
          tail: "结局：多做了两遍，而且收不回来。"
        },
        {
          id: "idem", label: "带编号再重试（幂等键）", icon: "key", win: true,
          steps: [
            { t: "第 1 次发（编号 notice-01）→ 超时。", tone: "warn" },
            { t: "带同一个编号重试 → 服务端认出“办过了”，直接返回上次结果。", tone: "ok" },
            { t: "同学们只收到 <b>1 条</b>通知，Agent 也拿到了真实状态。", tone: "ok" }
          ],
          tail: "结局：同一件事带同一个编号，重复请求只生效一次。"
        }
      ],
      summary: "<b>结论：</b>按下按钮之前先想——“做两遍会不会变成两件事？”会，就加幂等键，或改成“先确认、再执行”两段式。",
      quiz: {
        q: "下面哪个动作最不能“失败就重发”？",
        opts: ["把任务状态改成“已完成”", "在班级群发送一条通知", "查询明天的天气", "把文件名改成新名字"],
        ans: 1,
        why: "发通知不可重复：重发一次就多一条，而且收不回来。查询、可覆盖的写操作（改状态、改文件名）重试都安全。",
        hint: "想想哪个动作“做两遍会被大家看见”。"
      }
    },
    /* 代码执行与沙盒：保护开关 + 动作判定 */
    exec: {
      title: "动手实验：沙盒的保护关掉了，哪一步就危险了？", hint: "点开关", icon: "lock",
      chipsTitle: "① 当前生效的沙盒保护（点一下可以关掉）：",
      chips: [
        { id: "g1", label: "限目录：只能访问工作目录", on: true },
        { id: "g2", label: "默认断网：联网须白名单放行", on: true },
        { id: "g3", label: "超时中止：默认 120 秒，并结构化回传原因", on: true },
        { id: "g4", label: "输出限量：截断要说明，完整结果留档可再读", on: true },
        { id: "g5", label: "人工确认：危险动作（删除 / 外发）先问人", on: true }
      ],
      viewTitle: "当前生效的保护",
      viewNote: "这些保护都不在模型里，而在执行环境里——模型可以提出请求，但碰不到圈外的世界。",
      viewEmpty: "一条保护都没有：代码等于直接在你的电脑上跑。",
      actionsTitle: "② 试试执行这些代码：",
      actsTip: "先关掉一条保护，再点动作——看它会不会出圈。",
      actions: [
        { id: "a1", label: "读工作目录里的 scores.csv 并求平均", need: ["g1"], hint: "有“限目录”，它最多只能碰工作目录里的文件；关掉之后，它就能去读你电脑上任何地方的文件。" },
        { id: "a2", label: "从网上下载一份数据来处理", need: ["g2"], hint: "默认断网 + 白名单，既能做事又不至于“偷偷把数据传出去”；断网规则一关，代码可以连任何地址。" },
        { id: "a3", label: "跑一段来历不明的脚本", need: ["g1", "g2", "g5"], hint: "三段保护一起上：限目录 + 联网规矩 + 人工确认——来历不明的脚本最需要“有人看一眼再跑”。" },
        { id: "a4", label: "跑一个可能很慢的任务（比如几万次循环）", need: ["g3"], hint: "没有超时中止，它可能一直占着机器；有超时时会把“为什么被中止”结构化地告诉 Agent。" },
        { id: "a5", label: "处理一份会产生很长输出的数据", need: ["g4"], hint: "输出限量 + 说明截断，才不会把上下文塞满、也不会让 Agent 误以为“就这么多”。" }
      ],
      resultEmpty: "点一个动作试一试。",
      afterToggle: "保护状态变了——再点下面某个动作，看看还安不安全。",
      failTail: "缺少对应的保护，这一步就可能碰到不该碰的文件、偷偷联网外传、或一直跑下去。",
      okTail: "保护齐全，这一步可以在可控范围内执行。",
      onIcon: "lock", offIcon: "xmark"
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

  /* ============================================================
   * 故障注入台：三条真实可注入的故障，每条对应四道防线里的一道
   *   ① 假数据   —— 工具真的返回了，但数据明显不合理（下红雨 / -999℃）
   *   ② 超时失败 —— 工具调用直接失败
   *   ③ 没有工具 —— 白名单里一个工具都不给
   * 全部走真实调用路径（AgentLab.Agent.run），跑完立刻还原注入——绝不留坏状态。
   * 判语只在能可靠判断时给结论（例如注入值是否出现在回答里），其余交给学生自己看。
   * ============================================================ */
  function bindExeInject() {
    var host = $("exe-inject");
    if (!host) return;
    var Agent = AgentLab.Agent;

    var INJ = [
      {
        id: "dirty", label: "让天气工具返回“假数据”（下红雨、-999℃）",
        fence: "对应防线：结果验证——工具真返回了，格式也对，只是数据离谱",
        q: "明天会下雨吗？",
        probe: /红雨|-999/,
        expect: "它多半会<b>一字不差地照抄</b>这份假数据——工具没报错，模型就不会怀疑数据。",
        lesson: "所以“结果验证”必须在<b>程序侧</b>做（温度范围、单位、常识检查），不能指望模型自己看出来。"
      },
      {
        id: "timeout", label: "让工具调用“超时失败”（网络断了）",
        fence: "对应防线：等待回填 + 结构化错误回喂",
        q: "明天会下雨吗？",
        probe: /超时|失败|没查到|查不到|暂时|网络|稍后再试/,
        expect: "重点看它有没有<b>如实说“这次没查到”</b>。",
        lesson: "失败不可怕，可怕的是“工具还没回来，模型先把答案说了”——所以必须等 tool 消息回填才能生成。"
      },
      {
        id: "notools", label: "白名单里“一个工具都不给”",
        fence: "对应防线：白名单——没暴露的工具，它想调也调不到",
        q: "明天会下雨吗？",
        probe: /℃|度|下雨|雨|晴|气温|多云/,
        expect: "没有工具，它只能凭学过的知识说话。看它是<b>老老实实说“我查不到”</b>，还是照样报出一份天气。",
        lesson: "这就是“只有大脑、没有手脚”的样子：观察空间里没有真实数据，任何具体数字都只能是编的。"
      }
    ];

    host.innerHTML =
      '<div class="inj-list">' + INJ.map(function (it) {
        /* 防线提示不在勾选时给出——先让学生看事故、自己猜哪道防线该拦住它，
         * 跑完再在结果里揭晓（原来的写法等于把答案印在题目上）。 */
        return '<div class="toggle-row inj-row"><span class="t-label">' + U.icon("alert", 18) + " " + it.label +
          '<span class="inj-fence">先猜：哪道防线该拦住它？</span></span>' +
          '<label class="switch"><input type="checkbox" data-inj="' + it.id + '"><span class="slider"></span></label></div>';
      }).join("") + "</div>" +
      '<div class="pg-try" style="margin-top:10px">' +
        '<button class="btn btn-per btn-sm" id="exe-inject-run">' + U.icon("send", 14) + " 注入并让它跑一遍</button>" +
        '<span class="pg-try-tip">勾一条或几条都行；跑完自动还原。</span>' +
      "</div>" +
      '<div class="inj-out" id="exe-inject-out">还没有注入过。勾一条故障，再点左边的按钮。</div>';

    var out = $("exe-inject-out");

    /* 装注入 → 返回还原函数。三条都只改“运行时”，不写进任何配置。 */
    function install(ids) {
      var restores = [];
      if (ids.indexOf("dirty") >= 0 || ids.indexOf("timeout") >= 0) {
        var ow = AgentLab.API.getWeather;
        restores.push(function () { AgentLab.API.getWeather = ow; });
        if (ids.indexOf("dirty") >= 0) {
          AgentLab.API.getWeather = function (city, dateKey) {
            return Promise.resolve({
              ok: true, city: city || "北京", date: dateKey || "明天",
              text: "明天" + (city || "北京") + "下红雨，气温 -999℃，风力 88 级",
              suggest: "记得把伞加固一下", source: "（被你注入的假数据）"
            });
          };
        } else {
          AgentLab.API.getWeather = function () {
            return Promise.reject(new Error("网络连接超时（你注入的故障）"));
          };
        }
      }
      if (ids.indexOf("notools") >= 0) {
        var ot = AgentLab.Store.getTools();
        var off = {};
        for (var k in ot) off[k] = false;
        AgentLab.Store.saveTools(off);
        restores.push(function () { AgentLab.Store.saveTools(ot); });
      }
      return function () { restores.forEach(function (f) { try { f(); } catch (e) { } }); };
    }

    function cut(s, n) {
      s = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
      return s.length > n ? s.slice(0, n) + "…" : (s || "（它没有说出话来）");
    }

    function paint(results) {
      out.innerHTML =
        '<div class="inj-note">已经跑完并<b>自动还原</b>注入——你的系统现在是好的。</div>' +
        results.map(function (r) {
          var hit = r.it.probe.test(r.ans || "");
          var verdict = r.err
            ? "这一轮直接报错了：<b>" + U.esc(r.err) + "</b>"
            : (r.it.id === "dirty"
              ? (hit ? "它把注入的假数据<b>照抄出来了</b>（回答里出现了“红雨 / -999℃”）。"
                : "回答里没出现注入的异常值——可能这一轮没走天气工具，再跑一次看看。")
              : (r.it.id === "timeout"
                ? (hit ? "它<b>如实说了没查到</b>——这正是我们想要的。"
                  : "它没有说“查不到”，而是给出了具体内容：要警惕它在<b>替失败的工具编结果</b>。")
                : (hit ? "没有工具，它<b>照样说出了天气</b>：这些数字只能来自它自己的记忆，不可信。"
                  : "它<b>没有编具体天气</b>，而是承认查不到——这就是“够诚实”的样子。")));
          return '<div class="inj-card">' +
            '<div class="inj-t">注入：' + U.esc(r.it.label) + "</div>" +
            '<div class="inj-fence inj-fence-ans">' + r.it.fence + "</div>" +
            '<div class="inj-q">问它的是：「' + U.esc(r.it.q) + "」</div>" +
            '<div class="inj-ans">' + U.esc(cut(r.ans, 200)) + "</div>" +
            '<div class="inj-verdict">' + verdict + "</div>" +
            /* 判定只靠关键词探测，不同机器上可能不同——把最后一步交给学生判断，
             * 比给一个“系统说了算”的结论更接近真实课堂讨论。 */
            '<div class="inj-judge">由你判断：这句话是在<b>说实话</b>，还是在<b>替工具圆场</b>？和同桌对一下答案。</div>' +
            '<div class="inj-more">原本会怎样：' + r.it.expect + "<br>" + r.it.lesson + "</div>" +
          "</div>";
        }).join("") +
        '<div class="inj-note"><b>所以这四道防线为什么必须写在程序里：</b>模型不会替你怀疑工具、' +
        "也不会替你判断失败。它只能照着上下文说话——把关的事，得由 Harness 那一层做。</div>" +
        '<div class="inj-q-box"><b>再想一步：</b>三条注入里，哪一条最危险？' +
        "提示：报错会被看见，坏数据却会被当成真的用下去——所以“静默失败”比“直接报错”更难防。</div>";
    }

    $("exe-inject-run").addEventListener("click", function () {
      var btn = this;
      var ids = [];
      host.querySelectorAll("[data-inj]").forEach(function (cb) {
        if (cb.checked) ids.push(cb.getAttribute("data-inj"));
      });
      if (!ids.length) {
        U.toast("先勾一条故障，再点这个按钮", "info");
        return;
      }
      btn.disabled = true;
      var items = INJ.filter(function (it) { return ids.indexOf(it.id) >= 0; });
      var restore = install(ids);
      /* 还原只做一次；再加两条兜底：请求挂住 25 秒、或学生中途关页/切走，
       * 都不会把“工具全关”的坏状态留在本机（notools 分支改的是 Store）。 */
      var restored = false;
      function doRestore() {
        if (restored) return;
        restored = true;
        try { restore(); } catch (e) { }
      }
      var safety = setTimeout(doRestore, 25000);
      injectRestore = doRestore;   /* 见模块顶部：关页/切走时也还原 */
      out.innerHTML = "注入完成，正在让它真的跑一遍……";
      var results = [], i = 0;

      (function step() {
        if (i >= items.length) {
          clearTimeout(safety);
          doRestore();
          injectRestore = null;
          paint(results);
          btn.disabled = false;
          return;
        }
        var it = items[i++];
        var ans = "";
        Agent.run(it.q, [], { onDone: function (a) { ans = String(a == null ? "" : a); } })
          .then(function (res) {
            if (!ans && res && res.answer) ans = res.answer;
            results.push({ it: it, ans: ans });
            step();
          })
          .catch(function (e) {
            results.push({ it: it, ans: "", err: (e && e.message) || String(e) });
            step();
          });
      })();
    });
  }

  function bindExeAdv() {
    AgentLab.Adv.bind($("sec-executor"), { key: "exe", concepts: exeConcepts(), color: "exe" });
  }

  /* ---------- 实验：参数组装器（多选判定） ---------- */
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
        { id: "p2", label: 'date = "2026-10-12"', ok: true, why: "必填项，格式符合 YYYY-MM-DD（口语里的“明天”要先换算成具体日期）。" },
        { id: "p3", label: 'unit = "celsius"', ok: true, why: "可选项，取值在枚举里，合法。" },
        { id: "p4", label: 'user_token = "sk-abc123"', ok: false, why: "schema 里没有这个字段，还把密钥塞进了参数——最危险的一类“编参数”。" },
        { id: "p5", label: 'date = "明天"', ok: false, why: "格式不合法：工具要求 YYYY-MM-DD。要先把“明天”换算成具体日期。" },
        { id: "p6", label: 'city = "北京｜上海"', ok: false, why: "一个参数塞了两个值，越界了。多城市要分多次调用。" }
      ]
    };
    host.innerHTML = AgentLab.Adv.types.picker.demoHTML(d);
    AgentLab.Adv.types.picker.bind(host, d);
  }

  /* ---------- 实验：工具描述质量调参 ---------- */
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
        /* 峰值刻意压在 90%：卡内文字、预测答案、小结与全课总结都写“约到 90% 就到顶”。
         * 之前这里是 94~99%，学生拖到峰值会看到 99%，和课本口径对不上。 */
        if (v < 20) {
          score = Math.round(30 + v); level = "bad";
          note = "描述太简：只有一个名字（如 do_stuff / process），模型分不清该用哪个工具、该传什么，经常选错或干脆不调用。";
        } else if (v <= 45) {
          score = Math.round(50 + (v - 20) * 1.2); level = "warn";
          note = "有好转但仍不够：写了功能，却没写参数类型与返回格式，模型容易填错参数。";
        } else if (v <= 80) {
          score = Math.round(86 + (v - 46) * 0.12); level = "ok";
          note = "合适：功能 + 参数 + 返回 + 使用场景四要素齐了，模型能分辨“该不该用、该传什么”，准确率到顶（约 90%）。";
        } else {
          score = Math.max(72, Math.round(90 - (v - 80) * 0.9)); level = "warn";
          note = "开始下降：文字堆太多会占用上下文，还可能把关键信息（参数名、必填）淹没在大段说明里。";
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

  /* ---------- 实验：工具幻觉的四道防线 ---------- */
  function bindExeGuard() {
    var host = $("exe-guard");
    if (!host) return;
    var d = {
      color: "exe",
      title: "动手实验：关掉一道防线，哪种风险就漏过去了？", hint: "点开关", icon: "shield",
      chipsTitle: "① 当前生效的防线（点一下可关掉）：",
      chips: [
        { id: "w1", label: "① 白名单：只暴露登记过的工具", on: true },
        { id: "w2", label: "② 参数强校验：只接受 schema 里的字段", on: true },
        { id: "w3", label: "③ 等待回填：tool 消息回来前不许生成回答", on: true },
        { id: "w4", label: "④ 结果验证：检查工具返回的数据是否合理", on: true }
      ],
      viewTitle: "当前生效的防线",
      viewNote: "四道防线分别对应四类风险：编工具 / 编参数 / 编结果 / 坏数据照单全收。",
      viewEmpty: "四道防线全关：模型想调什么就调什么、想说什么就说什么。",
      actionsTitle: "② 试着让模型“犯一次错”：",
      actions: [
        { id: "h1", label: "模型想调用不存在的 get_flight_price", need: ["w1"], hint: "白名单里没有这个工具，直接拒绝——拦住“编工具”。" },
        { id: "h2", label: "模型在参数里塞了 user_token 和密钥", need: ["w2"], hint: "参数强校验只放行 schema 里的字段——拦住“编参数”，也顺手挡住了密钥外泄。" },
        { id: "h3", label: "工具还没返回，模型想先说答案", need: ["w3"], hint: "规则要求必须等 tool 消息回填才能生成——拦住“编结果”。" },
        { id: "h4", label: "工具返回了温度 -200℃，模型想直接采用", need: ["w4"], hint: "结果验证会检查返回值是否在合理范围（比如 -50~60℃）——拦住“坏数据”。" }
      ],
      resultEmpty: "点一条试一试。",
      afterToggle: "防线状态变了——再点下面某条，看看还会不会被拦住。",
      failTail: "对应的防线被关掉了，这类风险就会直接漏过去。",
      okTail: "防线在，这类请求会被立刻拦住（或强制进入等待）。",
      onIcon: "shield", offIcon: "xmark"
    };
    host.innerHTML = AgentLab.Adv.types.switchboard.demoHTML(d);
    AgentLab.Adv.types.switchboard.bind(host, d);
  }

  /* ---------- 实验：多工具链式调用预测 ---------- */
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

  /* ---------- 实验：参数保真与静默失败（在调用日志上点选） ----------
   * 教学点（ai-agent-book chapter4:90-98、chapter4:336）：
   *   静默输入转换（弯引号被改直引号）、静默参数注入、静默截断（只返回前 20 条不说）；
   *   正确做法：明确告知（"已显示第 1-20 行，共 120 行"）+ 完整结果可再读。 */
  function bindExeFidelity() {
    var host = $("exe-fidelity");
    var T = AgentLab.Adv && AgentLab.Adv.types && AgentLab.Adv.types.annotator;
    if (!host || !T) return;
    var d = {
      color: "exe",
      title: "动手实验：这份调用日志里，工具“偷偷动手脚”的地方在哪？", hint: "点一行再检查", icon: "wrench",
      materialLabel: "一次工具调用的完整日志（Agent ↔ 工具）",
      taskLabel: "任务：Agent 要“明天 7:30 提醒值日”，并顺带查一下全班名单。",
      checkLabel: "检查我标的行",
      empty: "先点选你认为“工具自己偷偷改了、却没说”的那些行，再点「检查我标的行」。",
      missLabel: "漏标了 ", wrongLabel: "标错了 ",
      passHtml: "找齐了！这三处都属于<b>静默失败</b>：工具自己动了手，却没有告诉 Agent。报错至少会被发现，静默不会——Agent 会拿着被改过、被截断的信息一路做下去。",
      failHtml: "提示：要区分“工具明确告知的”（比如报错、说明只显示前 20 行）和“工具偷偷做的”。<b>可以少说，不能瞒着改。</b>",
      segments: [
        { text: "模型输出参数：{ 日期：“明天”，标题：“值日提醒” }", why: "正常：这是模型给出的原始参数，内容清楚。" },
        { text: "工具内部：自己把“明天”换算成“今天”后执行（没有回传说明）", ok: true, why: "← 静默改参数：工具擅自改了日期，而且没告诉 Agent。Agent 以为提醒设在明天，实际设在今天——用户第二天不会收到提醒。" },
        { text: "工具返回：提醒已创建 ✓（完全没提日期被改过）", ok: true, why: "← 静默：返回里看不到“改过什么”。Agent 无法察觉，错误会一路传到最终回答。" },
        { text: "工具返回名单：只给了前 20 条，没有说明还有更多", ok: true, why: "← 静默截断：Agent 会以为全班只有 20 人，据此算班费、发通知都会出错。正确写法是“已显示第 1-20 行，共 120 行”。" },
        { text: "工具返回报错：{ 缺参数 city，请补充后再调用 }", why: "这是<b>正确</b>做法：把失败原因结构化地说清楚，Agent 才能改正后重试。" },
        { text: "工具返回：已显示第 1-20 行，共 120 行（完整名单存于 list.txt，可再读）", why: "这也是<b>正确</b>做法：明确告知截断 + 给出再读的办法——Agent 知道“我还没看全”。" }
      ]
    };
    host.innerHTML = T.demoHTML(d);
    T.bind(host, d);
  }

  /* ---------- 实验：幂等与重试安全（双轨推进） ----------
   * 教学点（ai-agent-book chapter5:174-225 + chapter4:410）：
   *   先判断“值不值得重试”；重复调用指纹 + 连续失败计数；幂等键让重试只生效一次；
   *   不可重复的动作改用“预检/请示 → 确认 → 执行”两段式（人工确认）。 */
  function bindExeIdem() {
    var host = $("exe-idem");
    var T = AgentLab.Adv && AgentLab.Adv.types && AgentLab.Adv.types.race;
    if (!host || !T) return;
    var d = {
      color: "exe",
      title: "动手实验：工具超时之后，两种做法结局完全不同", hint: "点「走一步」", icon: "refresh",
      taskLabel: "任务：",
      task: "“帮我在班级群里发一条通知：明天带美术工具。”（发通知是<b>不可重复</b>的动作）",
      stepLabel: "走一步", allLabel: "一次走完",
      empty: "点「走一步」：左边是“超时就重发”，右边是“带编号再重试”——看同学们收到几条通知。",
      tracks: [
        {
          id: "raw", label: "超时就重发（没有编号）", icon: "send",
          steps: [
            { t: "第 1 次调用「发通知」工具 → 请求超时（不知道对方到底收到没有）。", tone: "warn" },
            { t: "没多想，直接重发一次 → 又超时。", tone: "warn" },
            { t: "再发第三次 → 这次返回成功。", tone: "ok" },
            { t: "结果：同学们收到了 <b>3 条一模一样</b>的通知，还以为是三件事。", tone: "no" }
          ],
          tail: "结局：消息发出去了，但“多做了两遍”——发出去的通知收不回来，只能再发一条道歉。"
        },
        {
          id: "idem", label: "带上“编号”再重试（幂等键）", icon: "key", win: true,
          steps: [
            { t: "第 1 次调用，带上这次任务的编号 notice-1013-01 → 超时。", tone: "warn" },
            { t: "重试时带<b>同一个编号</b> → 服务端认出“这件事已经办过”，直接返回上一次的结果。", tone: "ok" },
            { t: "Agent 由此确认：通知已经发出去了，不需要再发。", tone: "ok" },
            { t: "结果：同学们只收到 <b>1 条</b>通知，Agent 也掌握了真实状态。", tone: "ok" }
          ],
          tail: "结局：同一件事带着同一个编号，重复请求只会生效一次——就像按两次电梯按钮，不会来两部电梯。"
        }
      ],
      summary: "<b>结论：</b>能否放心重试，取决于<b>重复执行会不会产生额外后果</b>。<br>查询类、可覆盖的写操作可以重试；" +
        "对外发送、花钱、删除这类动作必须保护起来：<b>① 幂等键</b>（同一件事带同一个编号）；<b>② 两段式</b>（先预检/请示，确认后再执行）。",
      quiz: {
        q: "为什么“幂等键”能让重试变安全？",
        opts: ["因为它让服务端能认出“这是同一件事”，重复请求只生效一次", "因为它让请求变快", "因为它会自动重试三次", "因为它能防止网络超时"],
        ans: 0,
        why: "幂等键是给这件事贴的唯一编号：服务端见过这个编号，就知道它已经办过了——于是不再重复执行，而是把上次的结果直接还给你。",
        hint: "想想按电梯按钮：按两次，电梯不会来两部。"
      }
    };
    host.innerHTML = T.demoHTML(d);
    T.bind(host, d);
  }

  /* ---------- 实验：哪些动作可以放心重试（多选判定） ---------- */
  function bindExeRetry() {
    var host = $("exe-retry");
    if (!host) return;
    var d = {
      color: "exe",
      title: "动手判断：哪些动作可以放心重试？", hint: "多选后检查", icon: "refresh",
      taskLabel: "口径：",
      task: "“可以放心重试”＝重复执行一次，<b>结果不会变多、也不会变乱</b>。选出所有可以放心重试的动作。",
      checkLabel: "检查我选的",
      empty: "先点选你认为可以放心重试的动作，再点「检查我选的」。",
      passHtml: "口诀：<b>只是“看”和“覆盖”的重试安全；会“多一次对外影响”的不能随便重试。</b>",
      failHtml: "提示：问自己一句——“这个动作做两遍，会不会变成两件事？”",
      items: [
        { id: "t1", label: "查天气（超时后重试）", ok: true, why: "纯查询：再查一次结果一样，没有副作用。" },
        { id: "t2", label: "把文件名改成“数学作业-小明”", ok: true, why: "可覆盖的写操作：同一个结果再做一遍还是它，不会变成两份文件。" },
        { id: "t3", label: "把任务状态标成“已完成”", ok: true, why: "同样是可覆盖的写操作：重复标记不影响结果。" },
        { id: "t4", label: "在班级群发一条通知", ok: false, why: "<b>不可重试</b>：发两遍就是两条通知，同学会以为是两件事——已发出的消息收不回来。要用幂等键或先确认。" },
        { id: "t5", label: "提交作业", ok: false, why: "<b>不可重试</b>：可能交两次，老师那边会出现重复记录。" },
        { id: "t6", label: "扣班费 / 转账", ok: false, why: "<b>不可重试</b>：做两遍就是两笔钱，而且不可逆——这类动作必须先确认再执行。" }
      ]
    };
    host.innerHTML = AgentLab.Adv.types.picker.demoHTML(d);
    AgentLab.Adv.types.picker.bind(host, d);
  }

  /* ---------- 实验：代码执行与沙盒（开关 + 两段代码对照） ----------
   * 教学点（ai-agent-book chapter5:335、chapter4:68）：
   *   沙盒管四件事：能碰什么（限目录）、能去哪（默认断网、白名单放行）、能跑多久（超时 120 秒并结构化返回）、
   *   能说多少（输出限量）；隔离三档：进程 / 容器 / 微型虚拟机；venv 不是沙盒。 */
  function bindExeSandbox() {
    var host = $("exe-sandbox");
    if (!host) return;
    var d = {
      color: "exe",
      title: "动手实验：同一段代码，有没有沙盒，结局差多少？", hint: "切开关对比", icon: "lock",
      srcTitle: "① 选择一段要执行的代码：",
      sources: [
        {
          id: "c1",
          label: "统计平均分（只读计算）",
          safe: "读入 scores.csv → 算平均分 → 打印结果。（看起来最安全的一段）",
          evil: "风险点：它仍然要读写文件。如果运行目录指错了，它碰到的可能就不是数据文件——一次误删或者覆盖，同样无法撤销。"
        },
        {
          id: "c2",
          label: "从网上抄来的“整理脚本”",
          safe: "把“作业”目录里的文件按姓名重命名，方便收作业。",
          evil: "风险点：脚本中间夹着一行——把整个目录打包上传到某个网址。这是最典型的“偷偷把东西传出去”。"
        }
      ],
      defaultId: "c1",
      guardOn: true,
      guardTitle: "② 代码沙盒：",
      guardLabelOn: "已开启（限目录 + 默认断网 + 120 秒超时 + 输出限量）",
      guardLabelOff: "已关闭（代码直接在你的电脑上跑）",
      contentTitle: "这段代码要做什么：",
      dataLabel: "① 它明面上要做的事：",
      injectLabel: "② 需要留意的风险点：",
      outHtml: function (src, guarded) {
        if (guarded) {
          return '<b>执行结果：<span class="ok">在沙盒里跑完，一切可控</span></b><br>' +
            '· <b>限目录</b>：只能读写指定的工作目录，碰不到你的文档、照片和系统文件；<br>' +
            '· <b>默认断网</b>：要联网的代码直接失败——<b>偷到东西也传不出去</b>；必须联网时按白名单放行；<br>' +
            '· <b>限时</b>：跑超过 120 秒就中止，并把“为什么被中止”<b>结构化地回传</b>给 Agent，而不是悄悄杀掉；<br>' +
            '· <b>限输出</b>：结果太长会截断并说明，完整结果留在沙盒里可以再读。<br>' +
            '<span class="dim">就算出问题，影响也只留在沙盒这个“小圈子”里——删掉重建就行。' +
            (src.id === "c2" ? '<br>这段脚本的“上传”那一行会在断网环境下失败，Agent 会看到明确的错误，进而追问：为什么要上传？' : "") + "</span>";
        }
        return '<b>执行结果：<span class="no">代码直接在你的电脑上跑了</span></b><br>' +
          '· 它能<b>读到你所有的文件</b>（作业、照片、聊天记录……）；<br>' +
          '· 它能<b>连上网络</b>，把读到的东西发到任何地方；<br>' +
          '· 它能<b>删文件、改系统设置</b>——删掉的东西没有回收站；<br>' +
          '· 跑飞了也没有时间限制，它可能一直占用你的电脑。<br>' +
          '<span class="dim">这不是吓唬人：这就是为什么“让 AI 帮我在电脑上做事”，一定要跑在沙盒（隔离环境）里。' +
          (src.id === "c2" ? '<br>上面那段脚本，现在就会真的把整个目录打包上传出去——而且没有任何人拦它。' : "") + "</span>";
      }
    };
    host.innerHTML = AgentLab.Adv.types.sandbox.demoHTML(d);
    AgentLab.Adv.types.sandbox.bind(host, d);
  }

  /* ---------- 实验：该不该上 MCP（场景判断） ---------- */
  function bindExeMcp() {
    var host = $("exe-mcp");
    if (!host) return;
    var d = {
      color: "exe",
      title: "动手实验：该不该上 MCP？", hint: "两个场景各选一个答案", icon: "link",
      emptyText: "先回答上面两个问题，系统会给出建议。",
      questions: [
        { key: "a", q: "场景 A：班级小管家只有 2 个工具（天气 + 计算器），只在本班自己用。该不该上 MCP？",
          opts: [{ k: "no", t: "先不上：直接写工具适配就够" }, { k: "yes", t: "上 MCP：先标准化再说" }] },
        { key: "b", q: "场景 B：学校要做“校园工具平台”：10 个工具要接给 3 个系统（小管家 / 图书助手 / 课表机器人）复用。该不该上 MCP？",
          opts: [{ k: "yes", t: "上 MCP：N×M 变 N+M" }, { k: "no", t: "不上：每个系统各写一套适配" }] }
      ],
      decide: function (ans) {
        var right = ans.a === "no" && ans.b === "yes";
        return (right ? '<span class="ok">✓ 判断正确！</span>' : '<span class="no">再想想：</span>') +
          "<b>场景 A 先用最简方案</b>——规模小、自己用，直接写工具适配最快、最省事；<b>场景 B 该上 MCP</b>——工具多、要接 3 个系统复用，统一协议把 N×M 变成 N+M。<br>" +
          '<span class="dim">口诀：先看规模，再看复用——技术选型要匹配当前规模；先用得起，再考虑标准化。</span>';
      }
    };
    host.innerHTML = AgentLab.Adv.types.decider.demoHTML(d);
    AgentLab.Adv.types.decider.bind(host, d);
  }

  return { render: render };
})();
