/* ============================================================
 * ui.js —— 界面小工具
 * 页面切换、打字机效果、提示气泡、SVG 图标、防抖等。
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

AgentLab.UI = (function () {

  /* ---------- 基础 ---------- */
  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------- 轻量 LaTeX 数学渲染（大模型常输出 \( \) 与 \[ \]） ----------
   * 不依赖任何外部库（避免 CDN 不可达时又报错），把常见数学写法转成 HTML：
   * 分数 \frac{}{}、根号 \sqrt{}/\sqrt[3]{}、上标 ^、下标 _、
   * 常用符号（\times \div \leq \geq \neq \approx \infty \angle …）与希腊字母。
   * 输入是“原始 LaTeX 文本”，函数内部自行转义，调用方无需先 esc。 ---------- */
  var TEX_SYMBOLS = {
    times: "×", div: "÷", cdot: "·", pm: "±", mp: "∓",
    le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠",
    approx: "≈", equiv: "≡", propto: "∝", sim: "∼",
    rightarrow: "→", to: "→", leftarrow: "←", Rightarrow: "⇒",
    leftrightarrow: "↔", mapsto: "↦",
    in: "∈", notin: "∉", subset: "⊂", subseteq: "⊆", cup: "∪", cap: "∩", emptyset: "∅",
    infinity: "∞", infty: "∞", partial: "∂", nabla: "∇",
    angle: "∠", perp: "⊥", parallel: "∥", triangle: "△", square: "□", circ: "○", degree: "°",
    sum: "∑", prod: "∏", int: "∫", lim: "lim", log: "log", ln: "ln",
    sin: "sin", cos: "cos", tan: "tan", max: "max", min: "min",
    alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", epsilon: "ε", varepsilon: "ε",
    zeta: "ζ", eta: "η", theta: "θ", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ",
    pi: "π", Pi: "Π", rho: "ρ", sigma: "σ", Sigma: "Σ", tau: "τ", phi: "φ", varphi: "φ",
    chi: "χ", psi: "ψ", omega: "ω", Omega: "Ω",
    ldots: "…", cdots: "⋯", dots: "…", vdots: "⋮", ddots: "⋱",
    quad: "\u2003", qquad: "\u2003\u2003", space: " "
  };

  function tex(raw) {
    var src = String(raw == null ? "" : raw);

    /* 读一个 {…} 参数（支持嵌套）；没有花括号时读一个“记号” */
    function readGroup(str, i) {
      while (str[i] === " ") i++;
      if (str[i] !== "{") {
        var m = /^\\[a-zA-Z]+/.exec(str.slice(i));
        if (m) return { text: m[0], end: i + m[0].length };
        if (str[i] === "\\") return { text: str.substr(i, 2), end: i + 2 };
        return { text: str[i] === undefined ? "" : str[i], end: i + 1 };
      }
      var depth = 0, j = i;
      for (; j < str.length; j++) {
        if (str[j] === "{") depth++;
        else if (str[j] === "}") { depth--; if (depth === 0) break; }
      }
      return { text: str.slice(i + 1, j), end: j + 1 };
    }
    /* 读可选的 […] 参数（如 \sqrt[3]{8}） */
    function readOpt(str, i) {
      while (str[i] === " ") i++;
      if (str[i] !== "[") return { text: null, end: i };
      var depth = 0, j = i;
      for (; j < str.length; j++) {
        if (str[j] === "[") depth++;
        else if (str[j] === "]") { depth--; if (depth === 0) break; }
      }
      return { text: str.slice(i + 1, j), end: j + 1 };
    }

    function parse(str) {
      var out = "", i = 0;
      while (i < str.length) {
        var ch = str[i];

        if (ch === "\\") {
          var m = /^\\([a-zA-Z]+)/.exec(str.slice(i));
          if (m) {
            var name = m[1];
            i += m[0].length;

            if (name === "frac" || name === "dfrac" || name === "tfrac") {
              var na = readGroup(str, i); i = na.end;
              var de = readGroup(str, i); i = de.end;
              out += '<span class="tex-frac"><span class="tex-num">' + parse(na.text) +
                '</span><span class="tex-den">' + parse(de.text) + "</span></span>";
              continue;
            }
            if (name === "sqrt") {
              var op = readOpt(str, i); i = op.end;
              var rd = readGroup(str, i); i = rd.end;
              out += '<span class="tex-sqrt">' +
                (op.text ? '<sup class="tex-rootidx">' + parse(op.text) + "</sup>" : "") +
                '√<span class="tex-radicand">' + parse(rd.text) + "</span></span>";
              continue;
            }
            if (name === "overline" || name === "bar") {
              var ov = readGroup(str, i); i = ov.end;
              out += '<span class="tex-overline">' + parse(ov.text) + "</span>";
              continue;
            }
            if (name === "vec") {
              var vc = readGroup(str, i); i = vc.end;
              out += '<span class="tex-vec">' + parse(vc.text) + "</span>";
              continue;
            }
            if (name === "text" || name === "mathrm" || name === "operatorname" ||
                name === "textbf" || name === "textit") {
              var tg = readGroup(str, i); i = tg.end;
              out += '<span class="tex-text">' + esc(tg.text) + "</span>";
              continue;
            }
            if (name === "begin" || name === "end") {
              var env = readGroup(str, i); i = env.end;
              if (name === "begin" && /^(array|tabular|matrix|pmatrix|bmatrix|vmatrix|cases|aligned|align)/.test((env.text || "").trim())) {
                // 只在后面确实跟着 {…} 时才把它当“列格式”读掉，否则会误吞正文首字符
                var ck = i;
                while (str[ck] === " ") ck++;
                if (str[ck] === "{") {
                  var cols = readGroup(str, i); i = cols.end;
                }
              }
              continue;   // 环境标签本身不显示（换行靠 \\）
            }
            if (name === "left" || name === "right" || name === "displaystyle" ||
                name === "textstyle" || name === "limits" || name === "nolimits") {
              continue;   // 丢弃，后续符号照常解析
            }
            if (Object.prototype.hasOwnProperty.call(TEX_SYMBOLS, name)) {
              out += esc(TEX_SYMBOLS[name]);
              continue;
            }
            // 未知命令：若后面紧跟 {…} 就只保留内容，否则原样输出命令名
            var k = i;
            while (str[k] === " ") k++;
            if (str[k] === "{") {
              var ug = readGroup(str, i); i = ug.end;
              out += parse(ug.text);
            } else {
              out += esc(name);
            }
            continue;
          }

          // 反斜杠 + 单个字符
          var nx = str[i + 1];
          if (nx === undefined) { i++; continue; }
          if (nx === "\\") { out += "<br>"; i += 2; continue; }          // \\ 换行
          if (nx === "," || nx === ";" || nx === ":" || nx === "!") { out += '<span class="tex-thin"></span>'; i += 2; continue; }
          if (nx === " ") { out += " "; i += 2; continue; }
          out += esc(nx); i += 2; continue;                              // \{ \} \% \$ \& \_ \# 等
        }

        if (ch === "^" || ch === "_") {
          var sg = readGroup(str, i + 1);
          i = sg.end;
          if (ch === "^" && sg.text.trim() === "\\circ") { out += "°"; continue; }   // 90^\circ → 90°
          out += ch === "^" ? "<sup>" + parse(sg.text) + "</sup>" : "<sub>" + parse(sg.text) + "</sub>";
          continue;
        }
        if (ch === "{") {
          var gr = readGroup(str, i); i = gr.end;
          out += parse(gr.text);
          continue;
        }
        if (ch === "}") { i++; continue; }
        if (ch === "&") { i++; continue; }   // 对齐标记（aligned / array 环境）

        out += esc(ch);
        i++;
      }
      return out;
    }

    return parse(src);
  }

  /* ---------- LaTeX → 普通写法（用于“自动判定”，不是用于显示） ----------
   * 模型很喜欢用 LaTeX 写答案：\frac{15}{28}、\(x=7\)、$21$、
   * \dfrac{1}{2} 等等。显示端由 md()/tex() 渲染成漂亮的分数，
   * 但**自动判定**如果直接匹配 "15/28" 就会漏判——所以先还原成普通写法再比对。 */
  function texToPlain(src) {
    var s = String(src == null ? "" : src);
    var i, t;

    // ① \frac{A}{B} / \dfrac / \tfrac → A/B（支持嵌套，多轮替换）
    for (i = 0; i < 8; i++) {
      t = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1/$2");
      if (t === s) break;
      s = t;
    }
    // ② \sqrt{A} → √A；\text{A} → A
    s = s.replace(/\\sqrt\s*(?:\[[^\]]*\])?\s*\{([^{}]*)\}/g, "√$1");
    s = s.replace(/\\text\s*\{([^{}]*)\}/g, "$1");

    // ③ 去掉数学定界符与常见排版命令
    s = s.replace(/\\\(|\\\)|\\\[|\\\]|\$\$/g, "").replace(/\$/g, "");
    s = s.replace(/\\(?:left|right|displaystyle|textstyle|limits)\b/g, "");

    // ④ 常见符号还原
    s = s.replace(/\\times/g, "×").replace(/\\div/g, "÷").replace(/\\cdot/g, "·")
         .replace(/\\%|\\%/g, "%").replace(/\\,/g, " ").replace(/\\;/g, " ")
         .replace(/\\quad/g, " ");

    return s;
  }

  /* ---------- 极简 Markdown → HTML（安全子集） ----------
   * 大模型的输出通常是 Markdown。这里的关键做法是：
   * 先把整段文本做 HTML 转义，再把 Markdown 语法转成标签——
   * 所以模型给的内容永远不会被当成 HTML 执行（防 XSS）。
   * 支持：标题 #~######、粗体 **x**、斜体 *x*、行内代码 `x`、代码块 ```、
   *       无序列表、引用 >、分隔线 ---、链接 [文字](https://...)，
   *       **表格**（| 表头 | 表头 | + |---|---| 分隔行，可带 :--- 对齐），
   *       以及 LaTeX 数学公式 \( \) \[ \] 与 $ $$（交给上面的 tex() 渲染）。
   * 默认不支持：数字编号（1. 2. 3.）转成有序列表——按原文显示，保留模型自己写的编号；
   *           如确需开启，调用 U.md(text, { orderedList: true })。 */
  function md(src, opts) {
    if (src == null) return "";
    opts = opts || {};
    var s = String(src).replace(/\r\n?/g, "\n");

    // ① 先取出围栏代码块（保留原文，最后统一转义）
    var blocks = [];
    s = s.replace(/```[ \t]*([\w+#.-]*)[ \t]*\n?([\s\S]*?)```/g, function (m, lang, code) {
      blocks.push({ lang: lang || "", code: code });
      return "\u0000B" + (blocks.length - 1) + "\u0000";
    });

    // ② 取出数学公式（LaTeX）——必须在转义之前，而且取出后不再参与 Markdown 解析，
    //    否则 \(x_1 + x_2\) 里的下划线会被当成斜体语法、把公式弄坏。
    var maths = [];
    function holdMath(inner, display) {
      maths.push({ tex: inner, display: !!display });
      return "\u0000" + (display ? "D" : "M") + (maths.length - 1) + "\u0000";
    }
    s = s.replace(/\\\[([\s\S]*?)\\\]/g, function (m, inner) { return holdMath(inner, true); });   // \[ … \]
    s = s.replace(/\\\(([\s\S]*?)\\\)/g, function (m, inner) { return holdMath(inner, false); });  // \( … \)
    s = s.replace(/\$\$([\s\S]*?)\$\$/g, function (m, inner) { return holdMath(inner, true); });    // $$ … $$
    s = s.replace(/\$([^$\n]+)\$/g, function (m, inner) {                                           // $ … $
      if (/^\s|\s$/.test(inner)) return m;   // 形如“$5 到 $10”的货币写法，原样保留不当作公式
      return holdMath(inner, false);
    });

    // ③ 整体转义 HTML（关键安全步骤，必须在解析 Markdown 之前）
    s = esc(s);

    // ③ 取出行内代码（此时内容已经转义过了）
    var codes = [];
    s = s.replace(/`([^`\n]+)`/g, function (m, c) {
      codes.push(c);
      return "\u0000C" + (codes.length - 1) + "\u0000";
    });

    // ④ 链接（只允许 http/https，其它一律当普通文本）
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // ⑤ 粗体 / 斜体（用 \w 边界，避免把 2*3*4 这类算式误当斜体）
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
         .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
         .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
         .replace(/(^|[^_\w])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");

    // ⑥ 表格：连续的 | … | 行，且第二行是分隔行（|---|---| 或 |:--|--:|）
    //    必须整体抽出——逐行解析会把表格拆成一堆普通段落，学生看到的是一串 | 号。
    //    抽出时机放在行内处理（链接 / 粗体 / 代码）之后：单元格里的 **粗体**、`代码`
    //    已经被转成 HTML 或占位符，最后统一回填；表格 HTML 本身不再参与后续解析。
    var tables = [];
    s = s.replace(/(^|\n)([ \t]*\|[^\n]*\|[ \t]*(?:\r?\n[ \t]*\|[^\n]*\|[ \t]*)+)/g,
      function (full, lead, block) {
        var rows = block.replace(/\r/g, "").split("\n").map(function (l) {
          return l.trim().replace(/^\|/, "").replace(/\|$/, "");
        });
        if (rows.length < 2) return full;
        var sep = rows[1].trim();
        if (!/^[\s:|-]+$/.test(sep) || sep.indexOf("-") < 0) return full;   // 第二行必须是分隔行
        function cells(line) { return line.split("|").map(function (c) { return c.trim(); }); }
        var head = cells(rows[0]);
        var body = rows.slice(2).map(cells);
        var html = '<div class="md-table-wrap"><table class="md-table"><thead><tr>' +
          head.map(function (c) { return "<th>" + c + "</th>"; }).join("") +
          "</tr></thead>";
        if (body.length) {
          html += "<tbody>" + body.map(function (r) {
            return "<tr>" + head.map(function (x, i) {
              return "<td>" + (r[i] == null ? "" : r[i]) + "</td>";
            }).join("") + "</tr>";
          }).join("") + "</tbody>";
        }
        html += "</table></div>";
        tables.push(html);
        return lead + "\u0000T" + (tables.length - 1) + "\u0000";
      });

    // ⑦ 逐行处理块级元素
    var out = [], para = [], quote = [], listType = null;

    function flushPara() {
      if (para.length) { out.push("<p>" + para.join("<br>") + "</p>"); para = []; }
    }
    function closeList() {
      if (listType) { out.push("</" + listType + ">"); listType = null; }
    }
    function flushQuote() {
      if (quote.length) { out.push("<blockquote>" + quote.join("<br>") + "</blockquote>"); quote = []; }
    }

    s.split("\n").forEach(function (line) {
      var t = line.trim();

      var q = t.match(/^&gt;\s?(.*)$/);
      if (q) { flushPara(); closeList(); quote.push(q[1]); return; }
      flushQuote();

      if (/^\u0000[BD]\d+\u0000$/.test(t)) { flushPara(); closeList(); out.push(t); return; }

      var tb = t.match(/^\u0000T(\d+)\u0000$/);
      if (tb) { flushPara(); closeList(); out.push(tables[+tb[1]] || ""); return; }
      if (!t) { flushPara(); closeList(); return; }

      var h = t.match(/^(#{1,6})\s+(.+)$/);
      if (h) {
        flushPara(); closeList();
        var lv = h[1].length;
        out.push("<h" + lv + ">" + h[2] + "</h" + lv + ">");
        return;
      }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flushPara(); closeList(); out.push("<hr>"); return; }

      var li = t.match(/^[-*+]\s+(.+)$/);
      if (li) {
        flushPara();
        if (listType !== "ul") { closeList(); out.push("<ul>"); listType = "ul"; }
        out.push("<li>" + li[1] + "</li>");
        return;
      }

      // 数字编号默认不转有序列表：模型的“1. 2. 3.”按原文显示，
      // 避免被浏览器重新编号、改变缩进。需要时用 U.md(text, { orderedList: true }) 开启。
      if (opts.orderedList) {
        var oli = t.match(/^\d+[.)]\s+(.+)$/);
        if (oli) {
          flushPara();
          if (listType !== "ol") { closeList(); out.push("<ol>"); listType = "ol"; }
          out.push("<li>" + oli[1] + "</li>");
          return;
        }
      }

      closeList();

      // 一行里出现“整块公式 \[…\]”时要把段落断开，否则 <div> 会被塞进 <p> 里（非法嵌套）
      if (/\u0000D\d+\u0000/.test(t)) {
        t.split(/(\u0000D\d+\u0000)/).forEach(function (seg) {
          if (!seg) return;
          if (/^\u0000D\d+\u0000$/.test(seg)) { flushPara(); out.push(seg); }
          else { para.push(seg); }
        });
        return;
      }

      para.push(t);
    });
    flushQuote();
    flushPara();
    closeList();

    var html = out.join("\n");

    // ⑧ 回填行内代码、数学公式与代码块
    html = html.replace(/\u0000C(\d+)\u0000/g, function (m, n) {
      return "<code>" + (codes[+n] || "") + "</code>";
    });
    html = html.replace(/\u0000([DM])(\d+)\u0000/g, function (m, kind, n) {
      var item = maths[+n];
      if (!item) return "";
      var body = tex(item.display ? String(item.tex).trim() : item.tex);
      return item.display
        ? '<div class="tex-display">' + body + "</div>"
        : '<span class="tex-inline">' + body + "</span>";
    });
    html = html.replace(/\u0000B(\d+)\u0000/g, function (m, n) {
      var b = blocks[+n] || { code: "" };
      return '<pre class="md-pre"><code>' + esc(String(b.code).replace(/^\n+|\n+$/g, "")) + "</code></pre>";
    });

    return html;
  }

  /* ---------- 页面切换 ---------- */
  var sections = ["cover", "origin", "home", "perception", "planner", "memory", "executor", "playground"];

  function showSection(id) {
    sections.forEach(function (s) {
      var el = $("sec-" + s);
      if (el) el.classList.toggle("active", s === id);
    });
    /* 栏目首次激活时，把「本课学习地图」与「本课学习目标」并排配成一组可折叠卡。
     * 必须在这里同步做完：进场动画靠 MutationObserver 监听 class 变化触发，
     * 而它的回调是微任务，一定排在本次同步任务之后——扫描到的就是折叠好的结构。 */
    foldBrief($("sec-" + id));
    document.querySelectorAll(".nav-tab").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-sec") === id);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- 打字机效果 ---------- */
  async function typewriter(el, text, speed) {
    speed = speed || 14;
    el.innerHTML = "";
    var buf = "";
    for (var i = 0; i < text.length; i++) {
      buf += text[i];
      el.innerHTML = esc(buf).replace(/\n/g, "<br>");
      if (i % 4 === 0) await delay(speed);
    }
    return el;
  }

  /* ---------- 提示气泡 ---------- */
  var toastTimer = null;
  function toast(msg, type) {
    var box = $("toast-box");
    if (!box) return;
    box.innerHTML = '<div class="toast ' + (type || "info") + '">' + esc(msg) + "</div>";
    box.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.classList.remove("show"); }, 3200);
  }

  /* ---------- 彩带/星星小动画（答对时） ---------- */
  function celebrate(el) {
    if (!el) return;
    el.classList.remove("celebrate");
    void el.offsetWidth;  // 重启动画
    el.classList.add("celebrate");
  }

  /* ---------- SVG 图标 ---------- */
  var ICONS = {
    eye: '<circle cx="12" cy="12" r="3.2"/><path d="M2.5 12S6.5 5.5 12 5.5 21.5 12 21.5 12 17.5 18.5 12 18.5 2.5 12 2.5 12z"/>',
    gear: '<path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z"/><path d="M19.4 13.5l1.5 1.2-1.8 3.1-1.9-.7a7 7 0 0 1-1.6.9l-.3 2H10.7l-.3-2a7 7 0 0 1-1.6-.9l-1.9.7-1.8-3.1 1.5-1.2a6.9 6.9 0 0 1 0-1.8L5.1 10.5l1.8-3.1 1.9.7a7 7 0 0 1 1.6-.9l.3-2h2.6l.3 2a7 7 0 0 1 1.6.9l1.9-.7 1.8 3.1-1.5 1.2a6.9 6.9 0 0 1 0 1.8z"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z"/><path d="M8 7.5h8M8 11h8" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
    hand: '<path d="M8.5 12.5V6a1.5 1.5 0 0 1 3 0v5.5M11.5 11V4.8a1.5 1.5 0 0 1 3 0V11M14.5 11V6.2a1.5 1.5 0 0 1 3 0V13c0 4-2.2 6.5-5.5 6.5-3.4 0-5-2.2-5.5-5.5L5.7 11a1.5 1.5 0 0 1 2.4-1.7l.4.5"/>',
    brain: '<path d="M12 4c-1.6 0-2.6 1-2.9 2.3C8 5.8 6.8 6.4 6.3 7.8 4.6 8.4 3.6 10 3.9 11.7 3 12.9 3.2 14.7 4.4 15.6 4.6 17.4 6.2 18.7 8 18.7c.5 0 1-.1 1.5-.3.7 1.6 2.3 2.6 4.1 2.3V4z"/><path d="M12 4c1.6 0 2.6 1 2.9 2.3C16 5.8 17.2 6.4 17.7 7.8c1.7.6 2.7 2.2 2.4 3.9.9 1.2.7 3-.5 3.9-.2 1.8-1.8 3.1-3.6 3.1-.5 0-1-.1-1.5-.3-.7 1.6-2.3 2.6-4.1 2.3V4z"/>',
    robot: '<rect x="5" y="7" width="14" height="11" rx="3"/><circle cx="9.5" cy="12.5" r="1.4"/><circle cx="14.5" cy="12.5" r="1.4"/><path d="M12 7V4.5M12 4.5h-2.2M9.8 18v1.8a1 1 0 0 0 1 1h2.4a1 1 0 0 0 1-1V18" stroke-width="1.5" stroke-linecap="round" fill="none"/><path d="M2.5 12v2.5M21.5 12v2.5" stroke-width="2" stroke-linecap="round" fill="none"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
    img: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l4.5-4.5 3 3L16 11l4 4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    txt: '<path d="M5 3.5h10l4 4v13H5v-17z"/><path d="M15 3.5v4h4M8.5 11h7M8.5 14.5h7M8.5 18h4.5" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17 9.2 3.8 3.8 0 0 1 16.5 18H7z"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7h7M8.5 12.5h.01M12 12.5h.01M15.5 12.5h.01M8.5 16h.01M12 16h.01M15.5 16h.01" stroke-width="2" stroke-linecap="round"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2.5h-15L6 16z"/><path d="M10 21a2.2 2.2 0 0 0 4 0" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5" stroke-width="2" stroke-linecap="round" fill="none"/>',
    lang: '<path d="M4 5h9M8.5 3v2M6.5 5c0 4 3 6.5 7 7.5M14 10c-1 2-3 4.5-6 6M14 14.5l4 7M15 16.5h6M14.5 21.5l-2 3" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    ruler: '<rect x="3" y="9.5" width="18" height="5" rx="1.2" transform="rotate(-8 12 12)"/><path d="M7 10.6l-.7 2M10.6 9.8l-.7 2M14.2 9l-.7 2M17.8 8.3l-.7 2" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    shape: '<path d="M4 18L12 5l8 13H4z"/><path d="M8.8 14.5h6.4" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
    percent: '<circle cx="8" cy="8" r="3.2"/><circle cx="16" cy="16" r="3.2"/><path d="M19.5 4.5l-15 15" stroke-width="1.9" stroke-linecap="round" fill="none"/>',
    timer: '<circle cx="12" cy="13" r="7.5"/><path d="M9 2.5h6M12 2.5V6" stroke-width="1.8" stroke-linecap="round"/><path d="M12 9.5V13l2.6 1.8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.3" fill="currentColor"/><circle cx="15" cy="9" r="1.3" fill="currentColor"/><circle cx="9" cy="15" r="1.3" fill="currentColor"/><circle cx="15" cy="15" r="1.3" fill="currentColor"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    xmark: '<path d="M6 6l12 12M18 6L6 18" stroke-width="2.6" stroke-linecap="round" fill="none"/>',
    star: '<path d="M12 3.6l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6-5.1-2.8-5.1 2.8 1.1-5.6-4.2-3.9 5.7-.7 2.5-5.2z"/>',
    send: '<path d="M4 11.5L20 4l-5.5 16-3.2-6.3L4 11.5z"/><path d="M11.3 13.7L20 4" stroke-width="1.4" stroke-linecap="round" fill="none"/>',
    back: '<path d="M15 5l-7 7 7 7" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4h-4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    reset: '<path d="M4.5 12a7.5 7.5 0 1 1 2.2 5.3"/><path d="M4.5 19.5v-4.5H9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l3 3M13.5 9.5l2.5 2.5" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.2" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
    happy: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.2 2 3.5 2 3.5-2 3.5-2M9 9.5h.01M15 9.5h.01" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.3"/>',
    link: '<path d="M9.5 14.5l5-5M7.5 12.5l-2 2a3.2 3.2 0 0 0 4.5 4.5l2.5-2.5M16.5 11.5l2-2a3.2 3.2 0 0 0-4.5-4.5l-2.5 2.5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    /* ===== 职业相关图标补充 ===== */
    pen: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-.4-.4-2.1 2.5-2.5z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    lab: '<path d="M9 3h6M10 3v6.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V3M7.5 15h9" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" stroke-width="1.7" fill="none"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4M12 15v3" stroke-width="1.7" stroke-linecap="round" fill="none"/>',
    alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M12 9v4M12 17h.01" stroke-width="2" stroke-linecap="round"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8a2 2 0 0 0-3 0zM12 15l-3-3c.5-4 3-7 7-9 2 4 1 7-1 9-1.5 1.5-3 2-3 2z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="15" cy="9" r="1.2"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6" stroke-width="2" stroke-linecap="round"/>',
    car: '<path d="M5 17h14M5 17v-3l2-5h10l2 5v3M5 17a2 2 0 1 0 4 0M15 17a2 2 0 1 0 4 0" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="12" cy="13" r="4"/>',
    factory: '<path d="M2 20h20M4 20V8l6 4V8l6 4V4h4v16" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    box: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M3.3 7L12 12l8.7-5M12 22V12" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20v-1a6 6 0 0 1 12 0v1M16 5.5a3.5 3.5 0 0 1 0 6.5M21.5 20v-1a6 6 0 0 0-4-5.6" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    scale: '<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0L5 7zM19 7l-3 7a3 3 0 0 0 6 0l-3-7M8 21h8" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" stroke-width="1.7" fill="none"/>',
    cog: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5l1.5 1.2-1.8 3.1-1.9-.7a7 7 0 0 1-1.6.9l-.3 2H10.7l-.3-2a7 7 0 0 1-1.6-.9l-1.9.7-1.8-3.1 1.5-1.2a6.9 6.9 0 0 1 0-1.8L5.1 10.5l1.8-3.1 1.9.7a7 7 0 0 1 1.6-.9l.3-2h2.6l.3 2a7 7 0 0 1 1.6.9l1.9-.7 1.8 3.1-1.5 1.2a6.9 6.9 0 0 1 0 1.8z" stroke-width="1.5" fill="none"/>',
    ticket: '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" stroke-width="1.7" fill="none"/><path d="M13 6v12" stroke-width="1.7" stroke-dasharray="2 2"/>',
    headset: '<path d="M3 14v-2a9 9 0 0 1 18 0v2M3 14a2 2 0 0 1 2-2h1v6H5a2 2 0 0 1-2-2v-2zM21 14a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2v-2zM19 18a3 3 0 0 1-3 3h-2" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 3 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 9 8.4z" stroke-width="1.7" fill="none"/><path d="M8 11h.01M12 11h.01M16 11h.01" stroke-width="2.5" stroke-linecap="round"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01" stroke-width="2.5" stroke-linecap="round"/>',
    archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" stroke-width="1.7" stroke-linecap="round" fill="none"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" stroke-width="1.7" fill="none"/>',
    graduation: '<path d="M22 10L12 5 2 10l10 5 10-5z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 10v5" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    stethoscope: '<path d="M6 3v5a4 4 0 0 0 8 0V3M6 3H4m4 0h2M14 3v5a4 4 0 0 1-4 4M20 16a4 4 0 0 1-8 0v-3" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="20" cy="16" r="2"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/><path d="M12 21a3 3 0 0 1-3-3c0-1.5 1.5-2 1.5-3.5S12 13 12 13s1.5.5 1.5 1.5S15 16.5 15 18a3 3 0 0 1-3 3z" stroke-width="1.5" fill="none"/>',
    microscope: '<path d="M6 18h12M9 18a3 3 0 0 0 3-3V6M12 6l3-3 3 3M12 10h4M14 13h2" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 16-9 0 10-4 16-9 16z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M4 20c3-5 7-8 13-9" stroke-width="1.7" stroke-linecap="round" fill="none"/>',
    utensils: '<path d="M3 2v7a3 3 0 0 0 6 0V2M6 2v20M17 2c-2 0-3 2-3 5s1 4 3 4v11" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    truck: '<rect x="1" y="6" width="13" height="10" rx="1"/><path d="M14 9h4l3 3v4h-7M6 19a2 2 0 1 0 4 0M17 19a2 2 0 1 0 4 0" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    plane: '<path d="M17.8 19.2L16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2a.8.8 0 0 0-.8 1.3L8 11l-3 3-2 .5 2 4 4-2 3 3 3.5-2.4a.8.8 0 0 0 .3-.9z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" stroke-width="2" stroke-linecap="round"/>',
    dollar: '<line x1="12" y1="2" x2="12" y2="22" stroke-width="1.7"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke-width="1.7" stroke-linecap="round" fill="none"/>',
    bookopen: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    /* 折叠地图：给「本课学习地图」用（与「本课学习目标」的 target 靶心区分开） */
    map: '<path d="M9 4.2 3 6.4v13.4l6-2.2 6 2.2 6-2.2V4.2l-6 2.2z"/><path d="M9 4.2v13.4M15 6.4v13.4"/>'
  };

  function icon(name, size) {
    size = size || 22;
    return '<svg class="icon" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.info) + "</svg>";
  }

  /* ---------- 飘分/加星 ---------- */
  function addScore(el, delta) {
    if (!el) return;
    var cur = parseInt(el.getAttribute("data-score") || "0", 10) + delta;
    el.setAttribute("data-score", String(cur));
    el.textContent = "★ " + cur;
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
  }

  /* ---------- 术语折叠解释 ----------
   * 超纲术语的就地展开：正文里出现专业名词时不再另起一段解释，而是把它做成
   * 「虚线术语 + ? 小标」，学生想深究就点一下，就地展开；不点则不影响阅读节奏。
   * 用法：U.term("Chat Template", "……解释（可含 HTML）……")
   * 全站共用一份事件委托，各页面不需要单独写绑定。 ---------- */
  var termSeq = 0;

  function term(label, html) {
    termSeq++;
    return '<span class="termq-wrap">' +
      '<button type="button" class="termq" data-term="' + termSeq + '" aria-expanded="false">' +
        esc(label) + '<span class="termq-mark" aria-hidden="true">?</span>' +
      '</button>' +
      '<span class="termq-box" data-term-box="' + termSeq + '" hidden>' + html + '</span>' +
    '</span>';
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    var btn = (t && t.closest) ? t.closest(".termq") : null;
    if (!btn) return;
    var id = btn.getAttribute("data-term");
    var box = document.querySelector('[data-term-box="' + id + '"]');
    if (!box) return;
    var opening = box.hasAttribute("hidden");
    if (opening) { box.removeAttribute("hidden"); } else { box.setAttribute("hidden", ""); }
    btn.setAttribute("aria-expanded", opening ? "true" : "false");
    btn.classList.toggle("on", opening);
  });

  /* ---------- 跳转并高亮（「本课学习地图」与进阶课堂「去对应的实验」共用） ----------
   * 抽成公共函数的原因：两处都要做「按 id 找元素 → 平滑滚动 → 闪烁提示」，
   * 各写一份的话，滚动方式、高亮类名、降级处理很容易走样。
   * 安全约定：id 为空或元素不存在时静默返回 false（不抛错）；
   * scrollIntoView 抛错（老浏览器不认配置对象）时降级为无参调用。
   * opt.self = true 时只高亮该元素本身，不向上找整张卡片。 */
  function jumpTo(elId, opt) {
    if (!elId) return false;
    var el = document.getElementById(String(elId));
    if (!el) return false;
    /* 目标常常是卡内某个小容器，闪烁整张卡片比闪烁一个小方块更容易被看见 */
    var target = (opt && opt.self) ? el : ((el.closest && el.closest(".card")) || el);
    if (!target || typeof target.scrollIntoView !== "function") return false;
    try {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      try { target.scrollIntoView(); } catch (e2) { }
    }
    target.classList.remove("adv-flash");
    void target.offsetWidth;                 /* 强制回流，让同一个动画能重放 */
    target.classList.add("adv-flash");
    return true;
  }

  /* ---------- 本课学习地图（每页开篇的「认知地图 + 页内导航」） ----------
   * 依据：ai-agent-book 每章开篇必有一张「本章知识脉络图」——先给地图、再讲细节。
   * 本系统七个板块原先都是直接进第一张卡，学生看不到全局、也不知道自己走到哪了。
   * 只产出 HTML，不在渲染期绑定事件；点击统一交给文件末尾那份 document 级委托。 */
  function sectionMap(opt) {
    opt = opt || {};
    var groups = opt.groups || [];
    if (groups.length === 0) return "";

    /* 这张地图与「本课学习目标」并列成一组可折叠卡（装配见 foldBrief）。
     * 表头恒定写「本课学习地图」，和「本课学习目标」配成一对；正文只放分组节点，
     * 不挂说明文字——标题说明（opt.title）、规模小字（opt.hint）以及页脚
     * 「点任意一格可直接跳到…」已按需求去掉，保持地图卡极简。 */
    return '<div class="sec-map" data-color="' + esc(opt.color || "per") + '">' +
      '<div class="sec-map-head">' + icon("map", 17) +
        '<b>' + esc(opt.head || "本课学习地图") + '</b>' +
      '</div>' +
      '<div class="sec-map-body">' +
        groups.map(function (g, gi) {
          return '<div class="sec-map-group">' +
            '<span class="sec-map-glabel"><i>' + (gi + 1) + '</i>' + esc(g.label || "") + '</span>' +
            '<span class="sec-map-items">' + (g.items || []).map(function (it) {
              var inner = '<span class="sec-map-t">' + esc(it.t || "") + '</span>' +
                (it.note ? '<span class="sec-map-note">' + esc(it.note) + '</span>' : "");
              /* 带 el 的节点可点（跳转 + 高亮）；不带的只作展示，不误导学生去点 */
              return it.el
                ? '<button type="button" class="sec-map-node" data-jump="' + esc(it.el) + '">' + inner + '</button>'
                : '<span class="sec-map-node is-plain">' + inner + '</span>';
            }).join("") + '</span>' +
          '</div>';
        }).join("") +
      '</div>' +
    '</div>';
  }

  /* ---------- 栏目导览组：「本课学习地图」+「本课学习目标」并排折叠 ----------
   * 各页 render() 里这两块本来就是相邻输出的顶层块。这里在栏目首次激活时把它们
   * 包进 .lab-brief（两栏并排），并把各自的表头换成可折叠按钮，默认折叠。
   *
   * 三条设计约束：
   *   ① 幂等——每个栏目只处理一次（data-brief="1" 打标），反复切栏目不会重复包；
   *   ② 只搬不重建——可折叠区里的原有子节点整体搬进 .brief-body，不重新生成 HTML，
   *      因此在里面的事件绑定、元素 id、图片都原样保留；
   *   ③ 降级——找不到「地图在前、目标在后」这一种相邻关系时原地退回，
   *      两块保持原来的纵向排布与样式，页面上看不出异常。 */
  function foldBrief(sec) {
    if (!sec || sec.getAttribute("data-brief") === "1") return;
    sec.setAttribute("data-brief", "1");

    var map = null, goal = null;
    Array.prototype.forEach.call(sec.children, function (el) {
      if (goal) return;
      if (!map) { if (el.classList.contains("sec-map")) map = el; return; }
      if (el.classList.contains("lesson-goal")) goal = el;
    });
    if (!map || !goal) return;

    /* 语义色提到容器上：两块共用同一套 --sm-c/t/l/i，标题与序号球的颜色自动一致 */
    var wrap = document.createElement("div");
    wrap.className = "lab-brief";
    var theme = map.getAttribute("data-color");
    if (theme) wrap.setAttribute("data-color", theme);
    sec.insertBefore(wrap, map);

    foldCard(map, wrap, "map");
    foldCard(goal, wrap, "goal");
  }

  /* 单块折叠：把原表头换成带箭头的按钮，其余内容整体收进可折叠区 */
  function foldCard(card, wrap, kind) {
    var head = card.querySelector(kind === "map" ? ".sec-map-head" : "h3");
    if (!head) { wrap.appendChild(card); return; }   /* 表头结构不符：不折叠，原样放入 */

    var ico = head.querySelector(".icon");
    var titleEl = head.querySelector("b") || head;
    var title = (titleEl.textContent || "").trim() ||
      (kind === "map" ? "本课学习地图" : "本课学习目标");

    var body = document.createElement("div");
    body.className = "brief-body";
    body.hidden = true;
    Array.prototype.slice.call(card.childNodes).forEach(function (n) {
      if (n !== head) body.appendChild(n);
    });
    card.removeChild(head);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "brief-head";
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML =
      (ico ? ico.outerHTML : icon(kind === "map" ? "map" : "target", 18)) +
      '<span class="brief-title">' + esc(title) + "</span>" +
      '<span class="brief-chev" aria-hidden="true"></span>';

    card.classList.add("brief-card", "is-folded");
    card.setAttribute("data-brief-kind", kind);
    card.insertBefore(btn, card.firstChild);
    card.appendChild(body);
    wrap.appendChild(card);

    btn.addEventListener("click", function () {
      var collapsed = card.classList.toggle("is-folded");
      body.hidden = collapsed;
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });
  }

  /* ---------- 预测条（先猜 → 再跑 → 看是否猜中） ----------
   * 依据：ai-agent-book 的课件把「先说出预测，再说清什么样的观察会推翻它」
   * 写成每个演示之前的硬规则——预测→验证是科学思维的基本动作。
   * 松耦合设计：这里只负责「渲染 + 记录选择」；每个实验在它自己「跑完」的位置
   * 调一次 predictResolve(id) 来展开对照。实验若从不调用，预测条就停在
   * 「已记录预测」状态——不报错、不阻塞、不假装跑过。
   * predictResolve 幂等：重复调用只展开一次，保留学生第一次看到的对照结果。 */
  var predState = {};
  var predSeq = 0;

  function predict(opt) {
    opt = opt || {};
    var id = String(opt.id || ("pred" + (++predSeq)));
    var opts = opt.opts || [];
    var ansText = "";
    opts.forEach(function (o) { if (o.k === opt.ans) ansText = String(o.t || ""); });
    predState[id] = {
      ans: opt.ans, ansText: ansText, why: opt.why || "",
      hint: opt.hint || "", picked: null
    };
    return '<div class="predict-bar" data-predict="' + esc(id) + '" data-color="' + esc(opt.color || "per") + '">' +
      '<div class="predict-head">' + icon("target", 15) +
        '<b>先猜一猜</b><span class="predict-q">' + (opt.q || "") + '</span></div>' +
      '<div class="predict-opts">' + opts.map(function (o) {
        return '<button type="button" class="predict-opt" data-k="' + esc(o.k) + '">' + o.t + '</button>';
      }).join("") + '</div>' +
      '<div class="predict-fb">' + icon("info", 13) + ' 选一个你的预测；跑完这里会告诉你猜中没有。</div>' +
    '</div>';
  }

  function predictResolve(id) {
    var key = String(id);
    var box = document.querySelector('.predict-bar[data-predict="' + key + '"]');
    if (!box) return false;
    if (box.classList.contains("is-done")) return false;     /* 幂等：只展开一次 */
    box.classList.add("is-done");
    var st = predState[key];
    var fb = box.querySelector(".predict-fb");
    if (!st || !fb) return true;
    if (st.picked == null) {
      box.classList.add("is-skip");
      fb.innerHTML = icon("info", 13) + ' 这次没下注。正确答案是：<b>' + st.ansText + '</b>' +
        (st.why ? '<br>' + st.why : "");
      return true;
    }
    if (st.picked === st.ans) {
      box.classList.add("is-right");
      fb.innerHTML = '<span class="fb-ok">' + icon("check", 14) + ' 猜中了！</span>' + (st.why || "");
      celebrate(box.querySelector('.predict-opt[data-k="' + st.picked + '"]'));
    } else {
      box.classList.add("is-wrong");
      fb.innerHTML = '<span class="fb-no">' + icon("xmark", 14) + ' 没猜中——正确答案是「' + st.ansText + '」</span>' +
        (st.why ? '<br>' + st.why : "") +
        (st.hint ? '<br><span class="predict-hint">' + st.hint + '</span>' : "");
    }
    return true;
  }

  /* 本课学习地图 + 预测条的点击：一次 document 级委托，
   * 避免每次页面重渲染都要重新绑定（与上面的术语折叠同一做法）。 */
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;

    /* ① 地图节点（以及任何带 data-jump 的元素）：跳转 + 高亮 */
    var jump = t.closest("[data-jump]");
    if (jump) {
      e.preventDefault();
      jumpTo(jump.getAttribute("data-jump"));
      return;
    }

    /* ② 预测条：记录选择；展开对照之前可以反复改 */
    var pick = t.closest(".predict-opt");
    if (!pick) return;
    var bar = pick.closest(".predict-bar");
    if (!bar || bar.classList.contains("is-done")) return;
    var st = predState[bar.getAttribute("data-predict")];
    if (!st) return;
    st.picked = pick.getAttribute("data-k");
    Array.prototype.forEach.call(bar.querySelectorAll(".predict-opt"), function (b) {
      b.classList.toggle("on", b === pick);
    });
    var fb = bar.querySelector(".predict-fb");
    if (fb) {
      fb.innerHTML = icon("check", 13) + ' 已记录你的预测：<b>' + pick.textContent +
        '</b> —— 跑完再回来看看猜中没有。';
    }
  });

  return {
    $: $, esc: esc, delay: delay, showSection: showSection,
    typewriter: typewriter, toast: toast, celebrate: celebrate, md: md,
    icon: icon, addScore: addScore, tex: tex, texToPlain: texToPlain,
    term: term,
    jumpTo: jumpTo, sectionMap: sectionMap,
    predict: predict, predictResolve: predictResolve,
    foldBrief: foldBrief
  };
})();
