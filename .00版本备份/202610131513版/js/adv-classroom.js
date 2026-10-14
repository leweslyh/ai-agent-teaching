/* ============================================================
 * adv-classroom.js —— 「进阶原理互动课堂」共享引擎
 *
 * 目标：把感知器实验室验证过的互动课堂（概念导航 + 讲解面板 + 动手实验 +
 *      自检一问 + 一键跳回对应实验）做成数据驱动的公共组件，
 *      让规划器 / 记忆器 / 执行器 / 智能体实验室等板块只写内容数据。
 *
 * 依赖：只依赖 AgentLab.UI（U.$ / U.icon / U.esc / U.toast / U.celebrate），
 *      不反向依赖任何 lab-*.js，避免循环依赖。
 * 约束：ES5 语法、无网络依赖，保证 file:// 双击可用。
 *
 * 对外接口：
 *   AgentLab.Adv.panelHTML({ key, concepts })   → 互动课堂结构（左导航 + 右面板）
 *   AgentLab.Adv.bind(cardEl, { key, concepts })→ 绑定导航/面板/自检/跳转/互动
 *   AgentLab.Adv.checklistHTML({ rows, ... })   → 通用「达标检查表」
 *   AgentLab.Adv.askOrDemo({ ... })             → 有 Key 调大模型，无 Key 走示例降级
 *   AgentLab.Adv.types                          → 可复用交互类型库（见文件末尾清单）
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

AgentLab.Adv = (function () {
  var U = AgentLab.UI;

  /* ---------- 通用小工具 ---------- */
  function esc(s) { return U.esc(s); }

  function head(title, hint, icon, color) {
    return '<div class="adv-demo-head">' + U.icon(icon || "lab", 16) + " " + title +
      (hint ? ' <span class="stage-pill pill-' + (color || "per") + '">' + hint + "</span>" : "") +
    "</div>";
  }

  /* 内置迷你测验：.game-q + .opt 判定（与各板块既有小测视觉一致） */
  /* 内置迷你测验：交给通用单题引擎（一题一题出现 + 结尾点评） */
  function bindMiniQuiz(host, items, wrongHint, color) {
    if (!host || !items || !items.length) return;
    AgentLab.Quiz.mini(host, items, { color: color || "per", hint: wrongHint });
  }

  /* ---------- 引擎：结构 ---------- */
  function conceptById(list, id) {
    var c = list[0];
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) c = list[i]; }
    return c;
  }

  function panelHTML(opt) {
    var key = opt.key || "per";
    return '<div class="adv-wrap">' +
      '<div class="adv-nav" data-nav="' + key + '">' +
        opt.concepts.map(function (c, i) {
          return '<button class="adv-nav-btn" data-id="' + c.id + '">' +
            '<span class="adv-no">' + (i + 1) + '</span>' +
            '<span class="adv-name">' + c.nav + '<small>' + (c.en || "") + '</small></span>' +
          '</button>';
        }).join("") +
      '</div>' +
      '<div class="adv-panel" data-panel="' + key + '"></div>' +
    '</div>';
  }

  /* 单个概念的讲解面板：一句话 / 打比方 / 真实系统 / 互动区 / 自检一问 / 跳转 */
  function contentHTML(c, opt) {
    var L = opt.labels || {};
    return '<div class="adv-title">' + U.icon(c.icon, 20) + " " + c.name +
        ' <span class="adv-en">' + (c.en || "") + "</span></div>" +
      '<div class="adv-tagline">' + c.tip + "</div>" +
      '<div class="adv-grid">' +
        '<div class="adv-block"><h5>' + U.icon("happy", 14) + " " + (L.analogy || "打个比方") + "</h5>" + c.analogy + "</div>" +
        '<div class="adv-block"><h5>' + U.icon("server", 14) + " " + (L.real || "真实 AI 系统里是这样") + "</h5>" + c.real + "</div>" +
      "</div>" +
      '<div data-demo="1"></div>' +
      '<div class="adv-quiz">' +
        '<div class="adv-q"><span class="stage-pill pill-brain">自检一问</span>' + c.quiz.q +
          '<span class="adv-q-tip">点我展开答案</span></div>' +
        '<div class="adv-a">' + c.quiz.a + "</div>" +
      "</div>" +
      (c.links && c.links.length
        ? '<div class="adv-links"><span class="adv-links-label">' + U.icon("link", 14) + " 去对应的实验动手：</span>" +
          c.links.map(function (l) {
            return '<button class="adv-jump" data-el="' + l.el + '">' + l.t + " →</button>";
          }).join("") + "</div>"
        : "");
  }

  /* ---------- 引擎：绑定 ---------- */
  function bind(root, opt) {
    if (!root) return;
    var nav = root.querySelector(".adv-nav");
    var panel = root.querySelector(".adv-panel");
    if (!nav || !panel) return;
    var active = opt.activeId || (opt.concepts[0] && opt.concepts[0].id);

    function paint() {
      nav.querySelectorAll(".adv-nav-btn").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-id") === active);
      });
      var c = conceptById(opt.concepts, active);
      panel.innerHTML = contentHTML(c, opt);

      /* 自检一问：点一下才展开答案 */
      var quiz = panel.querySelector(".adv-quiz");
      if (quiz) quiz.addEventListener("click", function () { quiz.classList.toggle("open"); });

      /* 一键跳回对应的基础实验，并高亮那张卡片 */
      panel.querySelectorAll(".adv-jump").forEach(function (b) {
        b.addEventListener("click", function () {
          var el = document.getElementById(b.getAttribute("data-el"));
          if (!el) return;
          var target = el.closest ? (el.closest(".card") || el) : el;
          if (!target || typeof target.scrollIntoView !== "function") return;
          try {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          } catch (e) {
            try { target.scrollIntoView(); } catch (e2) { }
          }
          target.classList.remove("adv-flash");
          void target.offsetWidth;
          target.classList.add("adv-flash");
        });
      });

      /* 互动区：只渲染当前概念的实验，避免一次性生成大量 DOM */
      var host = panel.querySelector("[data-demo]");
      var t = types[c.demo];
      var data = c.demoData || {};
      data.color = opt.color || "per";     // 交互内高亮色跟随所属板块语义色
      if (host && t) {
        host.innerHTML = t.demoHTML(data);
        var api = t.bind(host, data);      // 个别类型会返回“重绘句柄”，引擎自身不需要，外部可用
        if (api) panel._demoApi = api;
      }

      /* 通知外部：这个概念被打开了（用于学习进度、埋点等，可选，不影响其它实验室） */
      if (typeof opt.onActive === "function") {
        try { opt.onActive(c.id, c); } catch (e) { }
      }
    }

    nav.querySelectorAll(".adv-nav-btn").forEach(function (b) {
      b.addEventListener("click", function () { active = b.getAttribute("data-id"); paint(); });
    });
    paint();
  }

  /* ---------- 类型库 ---------- */
  var types = {};

  /* ============ 类型 1：modality —— 多按钮切换 + 工序链 + 内置小测 ============
   * data = { title, hint, icon, options:[{k,label,icon}], map:{k:{name,cost,chain:[],out}},
   *          defaultKey, endNode, quizTitle, quiz:[{q,opts,ans,why,hint}], empty } */
  types.modality = {
    demoHTML: function (d) {
      return '<div class="adv-demo">' +
        head(d.title, d.hint, d.icon, d.color) +
        '<div class="adv-row" data-a="pick">' +
          d.options.map(function (o) {
            return '<button class="adv-chip" data-k="' + o.k + '">' + U.icon(o.icon, 15) + " " + o.label + "</button>";
          }).join("") +
        "</div>" +
        '<div data-a="steps" style="margin-top:12px"></div>' +
        '<div class="adv-out" data-a="out">' + (d.empty || "先选一个，看看它的变化过程。") + "</div>" +
        (d.quiz && d.quiz.length ? '<div class="adv-demo-sub">' + (d.quizTitle || "小测") + '</div><div data-a="quiz"></div>' : "") +
      "</div>";
    },
    bind: function (host, d) {
      var pick = host.querySelector('[data-a="pick"]');
      if (!pick) return;
      var steps = host.querySelector('[data-a="steps"]');
      var out = host.querySelector('[data-a="out"]');

      function show(k) {
        var m = d.map && d.map[k];
        if (!m) {
          /* 容错：某个选项还没配演示数据时给出提示，而不是让面板停在上一屏 */
          steps.innerHTML = "";
          out.innerHTML = '<span class="dim">这个选项还没有配置演示数据。</span>';
          pick.querySelectorAll(".adv-chip").forEach(function (b) {
            b.classList.toggle("on", b.getAttribute("data-k") === k);
          });
          return;
        }
        pick.querySelectorAll(".adv-chip").forEach(function (b) {
          b.classList.toggle("on", b.getAttribute("data-k") === k);
        });
        steps.innerHTML = '<div class="adv-steps">' +
          m.chain.map(function (s, i) {
            return (i ? '<span class="arw">→</span>' : "") + '<span class="adv-step">' + s + "</span>";
          }).join("") +
          '<span class="arw">→</span><span class="adv-step" style="border-color:var(--c-brain);background:#FFF6E0">' +
            (d.endNode || "送进 AI 大脑") + "</span></div>" +
          '<div style="font-size:12.5px;color:var(--c-sub);margin-top:6px">' + m.name +
            "的代价：<b>" + m.cost + "</b></div>";
        out.innerHTML = m.out;
      }
      pick.querySelectorAll(".adv-chip").forEach(function (b) {
        b.addEventListener("click", function () { show(b.getAttribute("data-k")); });
      });
      /* 容错：默认键若不在数据里，回退到第一个选项，避免整块面板空白 */
      var first = d.options && d.options.length ? d.options[0].k : null;
      show(d.map && d.map[d.defaultKey] ? d.defaultKey : first);
      bindMiniQuiz(host.querySelector('[data-a="quiz"]'), d.quiz, d.quizHint, d.color);
    }
  };

  /* ============ 类型 2：switchboard —— 多开关 + 快照 + 动作依赖判定 ============
   * data = { title, hint, icon, chipsTitle, chips:[{id,label,on}],
   *          viewTitle, viewNote, viewEmpty,
   *          actionsTitle, actsTip（可选，动作区上方的一句提醒）,
   *          actions:[{id,label,need:[],hint}],
   *          resultEmpty, okTail, failTail,
   *          leadOk / leadFail（可选，自定义结论文案，用 {need} / {miss} 占位；不传则用默认句式）,
   *          onIcon, offIcon, chipOn, chipOff }
   * 判定逻辑：动作 need 里的信息若不在"打开"状态 → 无法执行（并指出缺哪一项）。 */
  types.switchboard = {
    demoHTML: function (d) {
      return '<div class="adv-demo">' +
        head(d.title, d.hint, d.icon, d.color) +
        '<div class="adv-demo-sub">' + d.chipsTitle + "</div>" +
        '<div class="adv-row" data-a="chips"></div>' +
        '<div class="adv-out" data-a="view"></div>' +
        '<div class="adv-demo-sub">' + d.actionsTitle + "</div>" +
        (d.actsTip ? '<div class="tip" style="margin:2px 0 8px">' + d.actsTip + "</div>" : "") +
        '<div class="adv-row" data-a="acts"></div>' +
        '<div class="adv-out" data-a="result">' + (d.resultEmpty || "点一个操作试一试。") + "</div>" +
      "</div>";
    },
    bind: function (host, d) {
      var chipsBox = host.querySelector('[data-a="chips"]');
      var viewBox = host.querySelector('[data-a="view"]');
      var actsBox = host.querySelector('[data-a="acts"]');
      var resultBox = host.querySelector('[data-a="result"]');
      if (!chipsBox) return;

      function labelOf(id) {
        var label = id;
        d.chips.forEach(function (o) { if (o.id === id) label = o.label; });
        return label;
      }
      function drawChips() {
        chipsBox.innerHTML = d.chips.map(function (o) {
          return '<button class="adv-chip ' + (o.on ? "on" : "off") + '" data-id="' + o.id + '">' +
            (o.on ? U.icon(d.onIcon || "eye", 14) : U.icon(d.offIcon || "xmark", 14)) + " " + o.label + "</button>";
        }).join("");
        chipsBox.querySelectorAll(".adv-chip").forEach(function (b) {
          b.addEventListener("click", function () {
            var id = b.getAttribute("data-id");
            d.chips.forEach(function (o) { if (o.id === id) o.on = !o.on; });
            drawChips();
            drawView();
            if (resultBox) resultBox.innerHTML = d.afterToggle || "状态变了——再点下面某个操作，看看还能不能执行。";
            // 可选回调：让外部（如智能体实验室）把开关同步到真实运行环境
            if (typeof d.onToggle === "function") d.onToggle(d.chips, id);
          });
        });
      }
      function drawView() {
        var on = d.chips.filter(function (o) { return o.on; });
        viewBox.innerHTML = "<b>" + d.viewTitle + "（" + on.length + " 条）：</b><br>" +
          (on.length
            ? on.map(function (o) { return '<span class="hl">' + o.label + "</span>"; }).join("　")
            : '<span class="dim">' + (d.viewEmpty || "空的——什么都看不到。") + "</span>") +
          (d.viewNote ? '<br><span class="dim">' + d.viewNote + "</span>" : "");
      }
      function drawActs() {
        if (!actsBox) return;
        actsBox.innerHTML = d.actions.map(function (a) {
          return '<button class="adv-chip" data-id="' + a.id + '">' + U.icon(a.icon || "wrench", 14) + " " + a.label + "</button>";
        }).join("");
        actsBox.querySelectorAll(".adv-chip").forEach(function (b) {
          b.addEventListener("click", function () {
            var a = null;
            d.actions.forEach(function (x) { if (x.id === b.getAttribute("data-id")) a = x; });
            if (!a) return;
            var miss = (a.need || []).filter(function (id) {
              var found = null;
              d.chips.forEach(function (o) { if (o.id === id) found = o; });
              return !(found && found.on);
            });
            /* leadFail / leadOk（可选）：换一套说法来讲结局。
             * 例：不是"信息都具备"，而是"故障被正确处理了：需要的「超时保护」都开着"。
             * 不传时逐字保持旧输出，既有板块零变化。 */
            var plainJoin = function (ids) {
              return (ids || []).map(function (id) { return labelOf(id); }).join("、");
            };
            var bracketJoin = function (ids) {
              return (ids || []).map(function (id) { return "【" + labelOf(id) + "】"; }).join("、");
            };
            if (miss.length) {
              resultBox.innerHTML = d.leadFail
                ? '<span class="no">✗ ' + d.leadFail.split("{miss}").join(plainJoin(miss)) + "</span>" +
                  (d.failTail || "") + (a.hint ? '<br><span class="dim">' + a.hint + "</span>" : "")
                : '<span class="no">✗ 无法执行：</span>缺少' + bracketJoin(miss) + "。" +
                  (d.failTail || "") + (a.hint ? '<br><span class="dim">' + a.hint + "</span>" : "");
            } else {
              resultBox.innerHTML = d.leadOk
                ? '<span class="ok">✓ ' + d.leadOk.split("{need}").join(plainJoin(a.need)) + "</span>" +
                  (d.okTail || "") + (a.ok || a.hint ? '<br><span class="dim">' + (a.ok || a.hint) + "</span>" : "")
                : '<span class="ok">✓ 可以执行：</span>它需要用到的信息（' + bracketJoin(a.need) + "）都具备。" +
                  (d.okTail || "") + (a.ok || a.hint ? '<br><span class="dim">' + (a.ok || a.hint) + "</span>" : "");
            }
          });
        });
      }
      drawChips();
      drawView();
      drawActs();

      /* 返回一个轻量句柄：外部可以同步开关状态并重绘（例如“上方工作台开关 ↔ 这个实验”） */
      return {
        redraw: function () { drawChips(); drawView(); },
        set: function (id, on) {
          d.chips.forEach(function (o) { if (o.id === id) o.on = !!on; });
          drawChips();
          drawView();
        }
      };
    }
  };

  /* ============ 类型 3：composer —— 消息池点选 + 规则校验 + 实时 JSON ============
   * data = { title, hint, icon, poolTitle, pool:[{role,text,tag,toolcall}], ctxTitle, jsonTitle,
   *          rules:{systemFirst:true, toolNeedsCall:true}, notes:{ok,used,systemLate,toolEarly,done},
   *          demoNoSystem:{label,note}, resetLabel, jsonBody:fn(msgs)->obj, emptyCtx } */
  types.composer = {
    demoHTML: function (d) {
      return '<div class="adv-demo">' +
        head(d.title, d.hint, d.icon, d.color) +
        '<div class="adv-demo-sub">' + d.poolTitle + "</div>" +
        '<div class="adv-row" data-a="pool"></div>' +
        '<div class="adv-demo-sub">' + d.ctxTitle + "</div>" +
        '<div data-a="ctx"><div class="adv-out">' + (d.emptyCtx || "还没有内容，先点上面的一条。") + "</div></div>" +
        '<div class="adv-demo-sub">' + d.jsonTitle + "</div>" +
        '<pre class="adv-pre" data-a="json">// 点上面的选项，这里会实时生成结果</pre>' +
        '<div class="adv-row" style="margin-top:10px">' +
          '<button class="btn btn-ghost btn-sm" data-a="demo">' + (d.demoNoSystem ? d.demoNoSystem.label : "演示对照") + "</button>" +
          '<button class="btn btn-ghost btn-sm" data-a="reset">' + (d.resetLabel || "清空重来") + "</button>" +
        "</div>" +
        '<div class="adv-out" data-a="note" style="display:none"></div>' +
      "</div>";
    },
    bind: function (host, d) {
      var pool = host.querySelector('[data-a="pool"]');
      if (!pool) return;
      var ctxBox = host.querySelector('[data-a="ctx"]');
      var jsonBox = host.querySelector('[data-a="json"]');
      var noteBox = host.querySelector('[data-a="note"]');
      var ctx = [];

      function roleTag(role) {
        return '<span class="role adv-role-' + role + '" style="font-size:11.5px;padding:2px 8px;border-radius:999px;font-weight:800">' + role + "</span>";
      }
      function say(html) {
        if (!noteBox) return;
        noteBox.style.display = "block";
        noteBox.innerHTML = html;
      }
      function draw() {
        pool.innerHTML = d.pool.map(function (m, i) {
          var used = ctx.indexOf(i) >= 0;
          return '<button class="adv-chip' + (used ? " off" : "") + '" data-i="' + i + '" style="max-width:100%;white-space:normal;text-align:left">' +
            roleTag(m.role) + " " + esc(m.text) + "</button>";
        }).join("");
        pool.querySelectorAll(".adv-chip").forEach(function (b) {
          b.addEventListener("click", function () { add(parseInt(b.getAttribute("data-i"), 10)); });
        });

        if (!ctx.length) {
          ctxBox.innerHTML = '<div class="adv-out">' + (d.emptyCtx || "还没有内容，先点上面的一条。") + "</div>";
          jsonBox.textContent = "// 点上面的选项，这里会实时生成结果";
          return;
        }
        ctxBox.innerHTML = ctx.map(function (i) {
          var m = d.pool[i];
          return '<div class="adv-msg">' + roleTag(m.role) + '<span class="adv-msg-txt">' + esc(m.text) +
            (m.tag ? '<br><span style="color:var(--c-sub);font-size:12px">' + m.tag + "</span>" : "") +
          "</span></div>";
        }).join("");
        jsonBox.textContent = JSON.stringify(
          d.jsonBody ? d.jsonBody(ctx.map(function (i) {
            return { role: d.pool[i].role, content: d.pool[i].text };
          })) : { messages: ctx.map(function (i) { return { role: d.pool[i].role, content: d.pool[i].text }; }) },
          null, 2);
        if (ctx.length === d.pool.length && d.notes && d.notes.done) say(d.notes.done);
      }
      function add(i) {
        var m = d.pool[i];
        if (!m) return;
        if (ctx.indexOf(i) >= 0) { say('<span class="dim">' + (d.notes ? d.notes.used : "这一条已经用过了。") + "</span>"); return; }
        if (d.rules && d.rules.systemFirst && m.role === "system" && ctx.length > 0) {
          say('<span class="no">✗ 位置不对：</span>' + (d.notes ? d.notes.systemLate : "规则必须放在最前面。")); return;
        }
        if (d.rules && d.rules.toolNeedsCall && m.role === "tool") {
          var hasCall = false;
          ctx.forEach(function (x) { if (d.pool[x].toolcall) hasCall = true; });
          if (!hasCall) { say('<span class="no">✗ 位置不对：</span>' + (d.notes ? d.notes.toolEarly : "它必须紧跟在工具调用之后。")); return; }
        }
        ctx.push(i);
        say('<span class="ok">✓ 已加入：</span>角色是 ' + m.role + (m.tag ? "（" + m.tag + "）" : "") + "。");
        draw();
      }

      pool.innerHTML = "";
      draw();

      var resetBtn = host.querySelector('[data-a="reset"]');
      if (resetBtn) resetBtn.addEventListener("click", function () {
        ctx = [];
        if (noteBox) noteBox.style.display = "none";
        draw();
      });
      var demoBtn = host.querySelector('[data-a="demo"]');
      if (demoBtn) demoBtn.addEventListener("click", function () {
        ctx = [];
        var skip = (d.demoNoSystem && d.demoNoSystem.skipRole) || "system";
        d.pool.forEach(function (m, i) { if (m.role !== skip) ctx.push(i); });
        draw();
        say('<span class="no">✗ 少了 ' + skip + "：</span>" + (d.demoNoSystem ? d.demoNoSystem.note : ""));
      });
    }
  };

  /* ============ 类型 4：calculator —— 输入 → 计算/费用/占比条 ============
   * data = { title, hint, icon, placeholder, defaultValue, buttonLabel, emptyText,
   *          compute(value) -> { html } } */
  types.calculator = {
    demoHTML: function (d) {
      return '<div class="adv-demo">' +
        head(d.title, d.hint, d.icon, d.color) +
        '<div class="adv-row">' +
          '<input type="text" data-a="input" value="' + esc(d.defaultValue || "") + '" placeholder="' + esc(d.placeholder || "") + '" style="flex:1;min-width:200px">' +
          '<button class="btn btn-per btn-sm" data-a="run">' + U.icon("spark", 14) + " " + (d.buttonLabel || "计算") + "</button>" +
        "</div>" +
        '<div class="adv-out" data-a="out">' + (d.emptyText || "输入内容后点按钮。") + "</div>" +
      "</div>";
    },
    bind: function (host, d) {
      var input = host.querySelector('[data-a="input"]');
      var btn = host.querySelector('[data-a="run"]');
      var out = host.querySelector('[data-a="out"]');
      if (!input || !btn) return;
      function run() {
        var v = input.value.trim();
        if (!v) { U.toast(d.emptyToast || "先输入内容"); return; }
        var r = d.compute(v, d);
        out.innerHTML = (r && r.html) || "";
      }
      btn.addEventListener("click", run);
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") run(); });
      if (d.autoRun !== false) run();
    }
  };

  /* ============ 类型 5：vectorMap —— 二维坐标点 + 最近邻 Top3 ============
   * data = { title, hint, icon, note, words:[{w,x,y,cluster}], defaultKey, topN,
   *          resultHtml(me, list, extra) -> html,
   *          threshold 可选 { label, value, min, max, step, unit, note } }
   * threshold 不传时行为与旧版完全一致；传入后启用「相关度门槛」：
   *   把本次查询最像的那一条记作 100 分，低于门槛的邻居不算命中、不会进入上下文。
   *   resultHtml 的第三个参数 extra = { thr, hits, below, best }，
   *   其中列表项自带 rel（0~100 的相关度得分）。 */
  types.vectorMap = {
    demoHTML: function (d) {
      var t = d.threshold;
      return '<div class="adv-demo">' +
        head(d.title, d.hint, d.icon, d.color) +
        (d.note ? '<div style="font-size:13px;color:var(--c-sub);margin-bottom:8px">' + d.note + "</div>" : "") +
        (t
          ? '<div class="adv-row" style="margin-bottom:8px">' +
              '<span style="font-size:13px;font-weight:800;min-width:104px">' + (t.label || "相关度门槛") + "</span>" +
              '<input type="range" data-a="thr" min="' + (t.min == null ? 0 : t.min) + '" max="' + (t.max == null ? 100 : t.max) +
                '" step="' + (t.step || 5) + '" value="' + (t.value == null ? 30 : t.value) + '" style="flex:1;min-width:150px;width:auto">' +
              '<b data-a="thrval" style="min-width:60px;text-align:right"></b>' +
            "</div>"
          : "") +
        '<div class="adv-map" data-a="map">' +
          '<span class="adv-axis" style="left:8px;bottom:6px">' + (d.axisX || "维度 1 →") + "</span>" +
          '<span class="adv-axis" style="left:8px;top:6px">' + (d.axisY || "↑ 维度 2") + "</span>" +
          d.words.map(function (w) {
            return '<button class="adv-dot" data-w="' + esc(w.w) + '" style="left:' + w.x + "%;top:" + w.y + '%">' + esc(w.w) + "</button>";
          }).join("") +
        "</div>" +
        '<div class="adv-out" data-a="out">' + (d.emptyText || "点地图上的任意一个词。") + "</div>" +
      "</div>";
    },
    bind: function (host, d) {
      var map = host.querySelector('[data-a="map"]');
      var out = host.querySelector('[data-a="out"]');
      if (!map) return;
      var thrInput = host.querySelector('[data-a="thr"]');
      var thrVal = host.querySelector('[data-a="thrval"]');
      var curWord = d.defaultKey;

      /* 相关度按“本次查询最像的那一条”归一成 0~100：最像的记 100 分，其余按比例换算，
       * 门槛滑条才读得懂（1/(1+距离) 的原始值都在 0.1 以下，直接入门槛没有意义）。 */
      function thrOf() { return thrInput ? parseFloat(thrInput.value) : null; }

      function pick(word) {
        var me = null;
        d.words.forEach(function (w) { if (w.w === word) me = w; });
        if (!me) return;
        curWord = word;
        var list = d.words.filter(function (w) { return w.w !== word; }).map(function (w) {
          var dist = Math.sqrt(Math.pow(w.x - me.x, 2) + Math.pow(w.y - me.y, 2));
          return { w: w, d: dist, sim: 1 / (1 + dist) };
        }).sort(function (a, b) { return a.d - b.d; });

        var n = d.topN || 3;
        var best = list.length ? list[0].sim : 1;
        list.forEach(function (x) { x.rel = Math.round(x.sim / best * 100); });

        var t = thrOf();
        var hits = t === null ? list.slice(0, n) : list.filter(function (x) { return x.rel >= t; });
        var below = t === null ? [] : list.filter(function (x) { return x.rel < t; });
        var hitNames = hits.map(function (x) { return x.w.w; });

        map.querySelectorAll(".adv-dot").forEach(function (b) {
          var w = b.getAttribute("data-w");
          var isMe = w === word;
          var isHit = hitNames.indexOf(w) >= 0;
          b.classList.toggle("active", isMe);
          b.classList.toggle("linked", isHit);
          b.classList.toggle("unlinked", t !== null && !isHit && !isMe);
        });

        var extra = { thr: t, hits: hits, below: below, best: best };
        out.innerHTML = d.resultHtml
          ? d.resultHtml(me, hits, extra)
          : ("<b>你选中了“" + me.w + "”</b><br>离它最近的 " + n + " 个：" +
            list.slice(0, n).map(function (x) { return '<span class="hl">' + x.w.w + "</span>（距离 " + x.d.toFixed(1) + "）"; }).join("　"));
      }

      map.querySelectorAll(".adv-dot").forEach(function (b) {
        b.addEventListener("click", function () { pick(b.getAttribute("data-w")); });
      });
      if (thrInput) {
        thrInput.addEventListener("input", function () {
          if (thrVal) thrVal.textContent = thrInput.value + ((d.threshold && d.threshold.unit) || " 分");
          if (curWord) pick(curWord);
        });
        if (thrVal) thrVal.textContent = thrInput.value + ((d.threshold && d.threshold.unit) || " 分");
      }
      if (curWord) pick(curWord);
    }
  };

  /* ============ 类型 6：decider —— 回答两组问题 → 组合出推荐结论 ============
   * data = { title, hint, icon, questions:[{key,q,opts:[{k,t}]}], decide(answers)->html, emptyText } */
  types.decider = {
    demoHTML: function (d) {
      return '<div class="adv-demo">' +
        head(d.title, d.hint, d.icon, d.color) +
        d.questions.map(function (q) {
          return '<div class="adv-demo-sub">' + q.q + "</div>" +
            '<div class="adv-row" data-q="' + q.key + '">' +
              q.opts.map(function (o) { return '<button class="adv-chip" data-k="' + o.k + '">' + o.t + "</button>"; }).join("") +
            "</div>";
        }).join("") +
        '<div class="adv-out" data-a="out">' + (d.emptyText || "先回答上面的问题，这里会给出结论。") + "</div>" +
      "</div>";
    },
    bind: function (host, d) {
      var out = host.querySelector('[data-a="out"]');
      if (!out) return;
      var ans = {};
      function decide() {
        var ready = d.questions.every(function (q) { return ans[q.key]; });
        if (!ready) return;
        out.innerHTML = d.decide(ans, d);
      }
      host.querySelectorAll('.adv-row[data-q]').forEach(function (row) {
        row.querySelectorAll(".adv-chip").forEach(function (b) {
          b.addEventListener("click", function () {
            ans[row.getAttribute("data-q")] = b.getAttribute("data-k");
            row.querySelectorAll(".adv-chip").forEach(function (x) { x.classList.toggle("on", x === b); });
            decide();
          });
        });
      });
    }
  };

  /* ============ 类型 7：sandbox —— 来源切换 + 防护开关 + 双结果对比 ============
   * data = { title, hint, icon, srcTitle, sources:[{id,label,safe,evil}], defaultId,
   *          guardOn:true, guardLabelOn, guardLabelOff, contentTitle, aiTitle,
   *          dataLabel, injectLabel, outHtml(src, guarded, d) -> html } */
  types.sandbox = {
    demoHTML: function (d) {
      return '<div class="adv-demo">' +
        head(d.title, d.hint, d.icon, d.color) +
        '<div class="adv-demo-sub">' + d.srcTitle + "</div>" +
        '<div class="adv-row" data-a="src">' +
          d.sources.map(function (s) {
            return '<button class="adv-chip" data-id="' + s.id + '">' + s.label + "</button>";
          }).join("") +
        "</div>" +
        '<div class="adv-out" data-a="content"></div>' +
        '<div class="adv-row" style="margin-top:10px">' +
          '<span style="font-size:13px;font-weight:800">' + (d.guardTitle || "安全防护：") + "</span>" +
          '<button class="adv-chip hot" data-a="guard" data-on="' + (d.guardOn === false ? "0" : "1") + '"></button>' +
        "</div>" +
        '<div class="adv-out" data-a="out"></div>' +
      "</div>";
    },
    bind: function (host, d) {
      var srcBox = host.querySelector('[data-a="src"]');
      var guardBtn = host.querySelector('[data-a="guard"]');
      var contentBox = host.querySelector('[data-a="content"]');
      var outBox = host.querySelector('[data-a="out"]');
      if (!srcBox || !guardBtn) return;
      var cur = d.sources[0];
      for (var i = 0; i < d.sources.length; i++) { if (d.sources[i].id === d.defaultId) cur = d.sources[i]; }

      function drawGuard() {
        var on = guardBtn.getAttribute("data-on") === "1";
        guardBtn.textContent = on ? (d.guardLabelOn || "防护已开启") : (d.guardLabelOff || "防护已关闭");
        guardBtn.classList.toggle("hot", on);
        guardBtn.classList.toggle("off", !on);
      }
      function draw() {
        var guarded = guardBtn.getAttribute("data-on") === "1";
        srcBox.querySelectorAll(".adv-chip").forEach(function (b) {
          b.classList.toggle("on", b.getAttribute("data-id") === cur.id);
        });
        contentBox.innerHTML = "<b>" + (d.contentTitle || "接收到的内容：") + "</b><br>" +
          '<span class="dim">' + (d.dataLabel || "① 正文（数据）：") + "</span>" + esc(cur.safe) + "<br>" +
          '<span class="no">' + (d.injectLabel || "② 夹带的指令：") + "</span>" + esc(cur.evil);
        outBox.innerHTML = d.outHtml(cur, guarded, d);
      }
      srcBox.querySelectorAll(".adv-chip").forEach(function (b) {
        b.addEventListener("click", function () {
          d.sources.forEach(function (s) { if (s.id === b.getAttribute("data-id")) cur = s; });
          draw();
        });
      });
      guardBtn.addEventListener("click", function () {
        guardBtn.setAttribute("data-on", guardBtn.getAttribute("data-on") === "1" ? "0" : "1");
        drawGuard();
        draw();
      });
      drawGuard();
      draw();
    }
  };

  /* ============ 类型 8：squeezer —— 滑条 → 占用条 + 被挤出标红 ============
   * data = { title, hint, icon, capacity, messages:[{role,t,tok,key,tag}], defaultIndex,
   *          sliderLabel, unitWord, keyWarnHtml, okHtml, infoTail } */
  types.squeezer = {
    demoHTML: function (d) {
      return '<div class="adv-demo">' +
        head(d.title, d.hint, d.icon, d.color) +
        '<div class="adv-row">' +
          '<span style="font-size:13px;font-weight:800">' + d.sliderLabel + "</span>" +
          '<input type="range" data-a="range" min="1" max="' + d.messages.length + '" value="' + (d.defaultIndex || 8) + '" style="flex:1;min-width:180px;width:auto">' +
          '<b data-a="num"></b><span style="font-size:13px;font-weight:800">' + d.unitWord + "</span>" +
        "</div>" +
        '<div style="margin-top:10px">' +
          '<div class="adv-bar"><div class="adv-bar-fill" data-a="bar" style="width:0%"></div></div>' +
          '<div data-a="info" style="font-size:12.5px;color:var(--c-sub);margin-top:5px"></div>' +
        "</div>" +
        '<div class="adv-out" data-a="list" style="max-height:300px;overflow:auto"></div>' +
      "</div>";
    },
    bind: function (host, d) {
      var range = host.querySelector('[data-a="range"]');
      if (!range) return;
      var num = host.querySelector('[data-a="num"]');
      var bar = host.querySelector('[data-a="bar"]');
      var info = host.querySelector('[data-a="info"]');
      var list = host.querySelector('[data-a="list"]');

      function draw() {
        var n = parseInt(range.value, 10) || 1;
        num.textContent = n;
        /* 从最新一条往旧累加：装不进容量的旧消息被挤出窗口 */
        var used = 0, keepFrom = n;
        for (var i = n - 1; i >= 0; i--) {
          if (used + d.messages[i].tok > d.capacity) { keepFrom = i + 1; break; }
          used += d.messages[i].tok;
          keepFrom = i;
        }
        var pct = Math.round(used / d.capacity * 100);
        bar.style.width = Math.min(pct, 100) + "%";
        bar.classList.toggle("danger", pct >= 85);
        info.innerHTML = "窗口容量 " + d.capacity + " Token（教学示意）　·　当前占用 <b>" + used + "</b> Token（" + pct + "%）　·　" +
          (keepFrom > 0 ? '<span class="no">已被挤出 ' + keepFrom + " 条</span>" : '<span class="ok">全部还在窗口里</span>') +
          (d.infoTail || "");

        list.innerHTML = d.messages.slice(0, n).map(function (m, i) {
          var isOut = i < keepFrom;
          return '<div class="adv-msg' + (isOut ? " squeezed" : "") + (m.key ? " key" : "") + '">' +
            '<span class="role adv-role-' + m.role + '">' + m.role + "</span>" +
            '<span class="adv-msg-txt">' + esc(m.t) +
              '<br><span style="color:var(--c-sub);font-size:12px">约 ' + m.tok + " Token" +
              (m.tag ? "　·　" + m.tag : "") +
              (isOut ? '　·　<span style="color:var(--c-exe-deep);font-weight:700">已被挤出窗口，AI 现在看不到它了</span>' : "") +
            "</span></span></div>";
        }).join("") + (keepFrom > 0 ? d.keyWarnHtml : d.okHtml);
      }
      range.addEventListener("input", draw);
      draw();
    }
  };

  /* ============ 类型 9：pipeline —— 多阶段管线：先猜 → 逐步揭示 ============
   * data = { title, hint, icon, stages:[{id,name,icon,color,desc,io}],
   *          guess:{q,opts:[{k,t}],ans,why,hint}, logTitle, playLabel, stepLabel, resetLabel } */
  types.pipeline = {
    demoHTML: function (d) {
      return '<div class="adv-demo">' +
        head(d.title, d.hint, d.icon, d.color) +
        '<div class="adv-row" data-a="nodes" style="align-items:stretch">' +
          d.stages.map(function (s, i) {
            return (i ? '<span class="pipe-line">▶</span>' : "") +
              '<div class="adv-pipe-node" data-id="' + s.id + '">' +
                "<div>" + U.icon(s.icon, 16) + " " + s.name + "</div>" +
                '<small style="font-weight:600;color:var(--c-sub)">' + (s.en || "") + "</small>" +
              "</div>";
          }).join("") +
        "</div>" +
        (d.guess ? '<div class="adv-demo-sub">' + d.guess.q + "</div>" +
          '<div class="adv-row" data-a="guess">' +
            d.guess.opts.map(function (o) { return '<button class="adv-chip" data-k="' + o.k + '">' + o.t + "</button>"; }).join("") +
          "</div>" +
          '<div class="quiz-feedback" data-a="guessfb"></div>' : "") +
        '<div class="adv-row" style="margin-top:12px">' +
          '<button class="btn btn-per btn-sm" data-a="play">' + U.icon("spark", 14) + " " + (d.playLabel || "自动播放一遍") + "</button>" +
          '<button class="btn btn-ghost btn-sm" data-a="step">' + (d.stepLabel || "单步推进") + "</button>" +
          '<button class="btn btn-ghost btn-sm" data-a="reset">' + (d.resetLabel || "重来") + "</button>" +
        "</div>" +
        '<div class="adv-demo-sub">' + (d.logTitle || "管线日志") + "</div>" +
        '<div class="adv-out" data-a="log" style="font-family:Consolas,monospace;font-size:13px;line-height:1.9"></div>' +
      "</div>";
    },
    bind: function (host, d) {
      var nodes = host.querySelector('[data-a="nodes"]');
      var log = host.querySelector('[data-a="log"]');
      var playBtn = host.querySelector('[data-a="play"]');
      var stepBtn = host.querySelector('[data-a="step"]');
      var resetBtn = host.querySelector('[data-a="reset"]');
      if (!nodes || !log) return;
      var at = -1, timer = null;

      function stop() { if (timer) { clearInterval(timer); timer = null; } }
      function setAt(i) {
        at = i;
        nodes.querySelectorAll(".adv-pipe-node").forEach(function (n, k) {
          n.classList.toggle("on", k === i);
          n.classList.toggle("done", k < i);
        });
        log.innerHTML = d.stages.slice(0, i + 1).map(function (s, k) {
          return '<div><span style="color:#f6b93b">' + (k + 1) + ". " + s.name + "</span> → " + s.io + "</div>";
        }).join("") || '<span style="color:#7f8db0">还没有开始。先点「单步推进」或「自动播放」。</span>';
      }
      function next() {
        if (at >= d.stages.length - 1) { stop(); return false; }
        setAt(at + 1);
        return true;
      }
      playBtn.addEventListener("click", function () {
        stop(); setAt(-1);
        timer = setInterval(function () { if (!next()) stop(); }, d.speed || 1100);
        next();
      });
      stepBtn.addEventListener("click", function () { stop(); if (!next()) U.toast("已经跑到最后一步了", "info"); });
      resetBtn.addEventListener("click", function () { stop(); setAt(-1); });
      setAt(-1);

      if (d.guess) {
        var gBox = host.querySelector('[data-a="guess"]');
        var gFb = host.querySelector('[data-a="guessfb"]');
        d.guess.opts.forEach(function (o, j) {
          var b = gBox.querySelectorAll(".adv-chip")[j];
          b.addEventListener("click", function () {
            if (gBox.classList.contains("done")) return;
            if (o.k === d.guess.ans) {
              gBox.classList.add("done");
              b.classList.add("on");
              gFb.innerHTML = '<span class="fb-ok">' + U.icon("check", 15) + " 答对了！" + d.guess.why + "</span>";
              U.celebrate(b);
              if (d.guess.revealAt !== undefined) setAt(d.guess.revealAt);
            } else {
              b.classList.add("wrong");
              setTimeout(function () { b.classList.remove("wrong"); }, 450);
              gFb.innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " " + (d.guess.hint || "再想想：先看任务最关键的是哪一步。") + "</span>";
            }
          });
        });
      }
    }
  };

  /* ============ 类型 10：sorter —— 步骤排序 + 依赖/并行判定 ============
   * data = { title, hint, icon, task, items:[{id,label,seq,group}], groupNote,
   *          successHtml, wrongHint, poolTitle, queueTitle } */
  types.sorter = {
    demoHTML: function (d) {
      return '<div class="adv-demo">' +
        head(d.title, d.hint, d.icon, d.color) +
        (d.task ? '<div class="tip" style="margin-bottom:12px"><b>任务：</b>' + d.task + "</div>" : "") +
        '<div class="adv-demo-sub">' + (d.queueTitle || "顺序队（点下面的步骤放进来）") + '</div>' +
        '<div class="order-list" data-a="queue"></div>' +
        '<div class="adv-demo-sub">' + (d.poolTitle || "候选步骤（点一条放进顺序队）") + '</div>' +
        '<div class="adv-row" data-a="pool"></div>' +
        '<div class="quiz-feedback" data-a="fb"></div>' +
        '<div class="adv-out" data-a="done" style="display:none"></div>' +
      "</div>";
    },
    bind: function (host, d) {
      var queue = host.querySelector('[data-a="queue"]');
      var pool = host.querySelector('[data-a="pool"]');
      var fb = host.querySelector('[data-a="fb"]');
      var done = host.querySelector('[data-a="done"]');
      if (!queue || !pool) return;
      var placed = [];
      var order = d.items.slice().sort(function (a, b) { return a.seq - b.seq; });

      function drawPool() {
        var rest = d.items.filter(function (it) { return placed.indexOf(it.id) < 0; });
        /* 洗牌（保持稳定：按 label 哈希排一次即可，便于课堂复现） */
        pool.innerHTML = rest.map(function (it) {
          return '<button class="adv-chip" data-id="' + it.id + '">' + it.label + "</button>";
        }).join("") || '<span class="dim">候选区空了。</span>';
        pool.querySelectorAll(".adv-chip").forEach(function (b) {
          b.addEventListener("click", function () { place(b.getAttribute("data-id")); });
        });
      }
      function drawQueue() {
        queue.innerHTML = placed.map(function (id, i) {
          var it = null;
          d.items.forEach(function (x) { if (x.id === id) it = x; });
          var alone = d.items.filter(function (x) { return x.group === it.group && x.group; }).length === 1;
          return '<div class="order-item done" style="' + (it.group && !alone ? "border-style:dashed" : "") + '">' +
            '<span class="num">' + (i + 1) + "</span>" + it.label +
            (it.group && !alone ? '<span style="margin-left:auto;font-size:11.5px;color:var(--c-sub)">与相邻步骤并行（' + it.group + "）</span>" : "") +
          "</div>";
        }).join("");
      }
      function place(id) {
        var it = null;
        d.items.forEach(function (x) { if (x.id === id) it = x; });
        var want = order[placed.length];
        if (it && want && it.id === want.id) {
          placed.push(id);
          drawPool();
          drawQueue();
          fb.innerHTML = '<span class="fb-ok">' + U.icon("check", 15) + " 对！这一步应该排在第 " + placed.length + " 位。</span>";
          if (placed.length === d.items.length) {
            fb.innerHTML = "";
            done.style.display = "block";
            done.innerHTML = (d.successHtml || "<b>全部排好了！</b>") +
              (d.groupNote ? '<br><span class="dim">' + d.groupNote + "</span>" : "");
            U.toast("顺序全对！", "success");
          }
        } else {
          var btn = pool.querySelector('.adv-chip[data-id="' + id + '"]');
          if (btn) {
            btn.classList.add("wrong");
            setTimeout(function () { btn.classList.remove("wrong"); }, 500);
          }
          fb.innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " " +
            (d.wrongHint || "这一步不该排在这里——想想它依赖哪一步的结果？") + "</span>";
        }
      }
      drawPool();
      drawQueue();
    }
  };

  /* ============ 类型 11：tuner —— 滑条调参 → 指标变化 + 判定 ============
   * data = { title, hint, icon, paramLabel, min, max, step, value, unit, metricLabel,
   *          compute(v) -> {value, note, level:"ok"|"warn"|"bad"}, best:{q,opts,ans,why,hint},
   *          touchedHint } */
  types.tuner = {
    demoHTML: function (d) {
      return '<div class="adv-demo">' +
        head(d.title, d.hint, d.icon, d.color) +
        '<div class="adv-row">' +
          '<span style="font-size:13px;font-weight:800;min-width:96px">' + d.paramLabel + "</span>" +
          '<input type="range" data-a="range" min="' + d.min + '" max="' + d.max + '" step="' + (d.step || 1) + '" value="' + d.value + '" style="flex:1;min-width:180px;width:auto">' +
          '<b data-a="pval" style="min-width:52px;text-align:right"></b>' +
        "</div>" +
        '<div style="margin-top:10px">' +
          '<div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--c-sub);margin-bottom:5px">' +
            "<span>" + d.metricLabel + "</span><b data-a=\"mval\"></b></div>" +
          '<div class="adv-bar"><div class="adv-bar-fill" data-a="bar" style="width:0%"></div></div>' +
        "</div>" +
        '<div class="adv-out" data-a="note"></div>' +
        (d.best ? '<div class="adv-demo-sub" data-a="qtitle" style="display:none">' + d.best.q + "</div>" +
          '<div class="adv-row" data-a="quiz" style="display:none"></div>' : "") +
      "</div>";
    },
    bind: function (host, d) {
      var range = host.querySelector('[data-a="range"]');
      if (!range) return;
      var pval = host.querySelector('[data-a="pval"]');
      var mval = host.querySelector('[data-a="mval"]');
      var bar = host.querySelector('[data-a="bar"]');
      var note = host.querySelector('[data-a="note"]');
      var touched = false;

      /* reveal = true 才允许亮出「拖一圈之后再判断」的判断题：
       * 绑定时只渲染初始状态，学生真的拖过滑条，问题才出现。 */
      function draw(reveal) {
        var v = parseFloat(range.value);
        pval.textContent = v + (d.unit || "");
        var r = d.compute(v, d) || {};
        var pct = Math.max(0, Math.min(100, r.value));
        bar.style.width = pct + "%";
        bar.classList.toggle("danger", r.level === "bad");
        mval.textContent = (r.label || Math.round(pct) + "%");
        note.innerHTML = '<span class="' + (r.level === "bad" ? "no" : r.level === "warn" ? "dim" : "ok") + '">' + (r.note || "") + "</span>";

        if (d.best && reveal && !touched) {
          touched = true;
          var qTitle = host.querySelector('[data-a="qtitle"]');
          var quiz = host.querySelector('[data-a="quiz"]');
          if (qTitle) qTitle.style.display = "block";
          if (quiz) {
            quiz.style.display = "flex";
            quiz.innerHTML = d.best.opts.map(function (o, j) {
              return '<button class="adv-chip" data-j="' + j + '">' + o + "</button>";
            }).join("");
            quiz.querySelectorAll(".adv-chip").forEach(function (b) {
              b.addEventListener("click", function () {
                if (quiz.classList.contains("done")) return;
                if (parseInt(b.getAttribute("data-j"), 10) === d.best.ans) {
                  quiz.classList.add("done");
                  b.classList.add("on");
                  note.innerHTML = '<span class="ok">' + U.icon("check", 15) + " 答对了！" + d.best.why + "</span>";
                  U.celebrate(b);
                } else {
                  b.classList.add("wrong");
                  setTimeout(function () { b.classList.remove("wrong"); }, 450);
                  note.innerHTML = '<span class="no">' + U.icon("xmark", 15) + " " + (d.best.hint || "把滑条拖一遍，比较不同取值下的指标再回答。") + "</span>";
                }
              });
            });
          }
        }
      }
      range.addEventListener("input", function () { draw(true); });
      range.addEventListener("change", function () { draw(true); });
      draw(false);
    }
  };

  /* ============ 类型 12：picker —— 多选判定（选出所有正确项） ============
   * 适用：任务分解（选出该拆出的子任务）、该记/不该记、该调哪些工具、计划有什么毛病
   * data = { title, hint, icon, task, items:[{id,label,ok,why}], checkLabel, empty, passHtml, failHtml } */
  types.picker = {
    demoHTML: function (d) {
      return '<div class="adv-demo">' +
        head(d.title, d.hint, d.icon, d.color) +
        (d.task ? '<div class="tip" style="margin-bottom:12px"><b>' + (d.taskLabel || "任务：") + "</b>" + d.task + "</div>" : "") +
        '<div class="adv-row" data-a="items"></div>' +
        '<div class="adv-row" style="margin-top:12px">' +
          '<button class="btn btn-per btn-sm" data-a="check">' + U.icon("check", 14) + " " + (d.checkLabel || "检查一下") + "</button>" +
          '<button class="btn btn-ghost btn-sm" data-a="reset">' + (d.resetLabel || "重来") + "</button>" +
        "</div>" +
        '<div class="adv-out" data-a="out">' + (d.empty || "先点选你认为正确的项，再点「检查一下」。") + "</div>" +
      "</div>";
    },
    bind: function (host, d) {
      var box = host.querySelector('[data-a="items"]');
      if (!box) return;
      var out = host.querySelector('[data-a="out"]');
      var picked = {};
      function draw() {
        box.innerHTML = d.items.map(function (it) {
          return '<button class="adv-chip" data-id="' + it.id + '">' +
            (picked[it.id] ? U.icon("check", 14) : "") + " " + it.label + "</button>";
        }).join("");
        box.querySelectorAll(".adv-chip").forEach(function (b) {
          b.addEventListener("click", function () {
            if (box.classList.contains("done")) return;
            var id = b.getAttribute("data-id");
            picked[id] = !picked[id];
            b.classList.toggle("on", !!picked[id]);
          });
        });
      }
      draw();

      host.querySelector('[data-a="check"]').addEventListener("click", function () {
        if (box.classList.contains("done")) return;
        var miss = [], wrong = [];
        d.items.forEach(function (it) {
          if (it.ok && !picked[it.id]) miss.push(it);
          if (!it.ok && picked[it.id]) wrong.push(it);
        });
        box.querySelectorAll(".adv-chip").forEach(function (b) {
          var it = null;
          d.items.forEach(function (x) { if (x.id === b.getAttribute("data-id")) it = x; });
          b.classList.toggle("correct", !!(it && it.ok));
          b.classList.toggle("wrong", !(it && it.ok));
          b.disabled = true;
        });
        if (!miss.length && !wrong.length) {
          box.classList.add("done");
          out.innerHTML = '<span class="ok">✓ 全对！</span>' + (d.passHtml || "") + "<br>" +
            d.items.map(function (it) { return "· <b>" + it.label + "</b>：" + it.why; }).join("<br>");
          U.toast("选得全对！", "success");
        } else {
          out.innerHTML = '<span class="no">✗ 还差一点：</span>' +
            (miss.length ? "漏掉了 " + miss.map(function (it) { return "【" + it.label + "】"; }).join("、") + "。" : "") +
            (wrong.length ? "多选了 " + wrong.map(function (it) { return "【" + it.label + "】"; }).join("、") + "。" : "") +
            (d.failHtml ? "<br>" + d.failHtml : "") +
            '<br><span class="dim">点「' + (d.resetLabel || "重来") + "」可以再试一次。</span>";
        }
      });

      host.querySelector('[data-a="reset"]').addEventListener("click", function () {
        picked = {};
        box.classList.remove("done");
        box.querySelectorAll(".adv-chip").forEach(function (b) { b.className = "adv-chip"; b.disabled = false; });
        draw();
        out.innerHTML = d.empty || "先点选你认为正确的项，再点「检查一下」。";
      });
    }
  };

  /* ============ 类型 13：annotator —— 在真实材料上点选目标片段 ============
   * 适用：从真实材料（网页正文 / 调用日志 / 用户原话）里“找到并标出”目标——
   *      比 picker（在一串按钮里挑）更接近真实任务：先得在材料里认出它。
   * data = { title, hint, icon, materialLabel, taskLabel, segments:[{text,ok,why}],
   *          checkLabel, resetLabel, empty, passHtml, failHtml, missLabel, wrongLabel } */
  types.annotator = {
    demoHTML: function (d) {
      return '<div class="adv-demo">' +
        head(d.title, d.hint, d.icon, d.color) +
        (d.materialLabel ? '<div class="adv-demo-sub">' + d.materialLabel + "</div>" : "") +
        (d.taskLabel ? '<div class="tip" style="margin-bottom:10px">' + d.taskLabel + "</div>" : "") +
        '<div class="adv-anno" data-a="mat">' +
          d.segments.map(function (s, i) {
            return '<button class="adv-seg" data-i="' + i + '">' + s.text + "</button>";
          }).join("") +
        "</div>" +
        '<div class="adv-row" style="margin-top:12px">' +
          '<button class="btn btn-per btn-sm" data-a="check">' + U.icon("check", 14) + " " + (d.checkLabel || "检查我标的") + "</button>" +
          '<button class="btn btn-ghost btn-sm" data-a="reset">' + (d.resetLabel || "重来") + "</button>" +
        "</div>" +
        '<div class="adv-out" data-a="out">' + (d.empty || "先点选你认为有问题的片段，再点「检查我标的」。") + "</div>" +
      "</div>";
    },
    bind: function (host, d) {
      var mat = host.querySelector('[data-a="mat"]');
      if (!mat) return;
      var out = host.querySelector('[data-a="out"]');
      var segs = mat.querySelectorAll(".adv-seg");
      var picked = {};
      var done = false;

      segs.forEach(function (b) {
        b.addEventListener("click", function () {
          if (done) return;
          var i = b.getAttribute("data-i");
          picked[i] = !picked[i];
          b.classList.toggle("sel", !!picked[i]);
        });
      });

      host.querySelector('[data-a="check"]').addEventListener("click", function () {
        if (done) return;
        done = true;
        var miss = [], wrong = [];
        segs.forEach(function (b) {
          var i = parseInt(b.getAttribute("data-i"), 10);
          var s = d.segments[i];
          var sel = !!picked[i];
          b.classList.remove("sel");
          b.classList.toggle("hit", !!s.ok && sel);
          b.classList.toggle("miss", !!s.ok && !sel);
          b.classList.toggle("wrong", !s.ok && sel);
          b.disabled = true;
          if (s.ok && !sel) miss.push(s);
          if (!s.ok && sel) wrong.push(s);
        });
        if (!miss.length && !wrong.length) {
          out.innerHTML = '<span class="ok">✓ 全对！</span>' + (d.passHtml || "") + "<br>" +
            d.segments.map(function (s) { return "· <b>" + s.text + "</b>：" + s.why; }).join("<br>");
          U.toast("标得全对！", "success");
        } else {
          out.innerHTML = '<span class="no">✗ 还差一点：</span>' +
            (miss.length ? (d.missLabel || "漏标了 ") + miss.length + " 处（橙色虚线框住的地方）。" : "") +
            (wrong.length ? (d.wrongLabel || "误标了 ") + wrong.length + " 处（红色叉号的地方）。" : "") +
            (d.failHtml ? "<br>" + d.failHtml : "") +
            '<br><span class="dim">点「' + (d.resetLabel || "重来") + "」可以再试一次。</span>";
        }
      });

      host.querySelector('[data-a="reset"]').addEventListener("click", function () {
        picked = {};
        done = false;
        segs.forEach(function (b) { b.className = "adv-seg"; b.disabled = false; });
        out.innerHTML = d.empty || "先点选你认为有问题的片段，再点「检查我标的」。";
      });
    }
  };

  /* ============ 类型 14：matcher —— 左右两列配对 ============
   * 适用：工具↔分类、记忆实例↔记忆类型、场景↔规划范式、信息↔存储格式……
   *      右侧允许多条左项共用（多个工具可以同属一类）。
   * data = { title, hint, icon, leftTitle, rightTitle,
   *          left:[{id,label,icon,why}], right:[{id,label,icon}], pairs:{左id:右id},
   *          checkLabel, resetLabel, empty, passHtml, failHtml, pickTip } */
  types.matcher = {
    demoHTML: function (d) {
      return '<div class="adv-demo">' +
        head(d.title, d.hint, d.icon, d.color) +
        '<div class="adv-demo-sub">' + (d.leftTitle || "① 先点左边一条：") + "</div>" +
        '<div class="adv-row" data-a="left"></div>' +
        '<div class="adv-demo-sub">' + (d.rightTitle || "② 再点右边它属于哪一类：") + "</div>" +
        '<div class="adv-row" data-a="right"></div>' +
        '<div class="adv-row" style="margin-top:12px">' +
          '<button class="btn btn-per btn-sm" data-a="check">' + U.icon("check", 14) + " " + (d.checkLabel || "检查配对") + "</button>" +
          '<button class="btn btn-ghost btn-sm" data-a="reset">' + (d.resetLabel || "重来") + "</button>" +
        "</div>" +
        '<div class="adv-out" data-a="out">' + (d.empty || "先点左边一条，再点右边它属于哪一类。") + "</div>" +
      "</div>";
    },
    bind: function (host, d) {
      var leftBox = host.querySelector('[data-a="left"]');
      var rightBox = host.querySelector('[data-a="right"]');
      if (!leftBox || !rightBox) return;
      var out = host.querySelector('[data-a="out"]');
      var pick = null;      /* 当前选中的左项 id */
      var ans = {};         /* 左 id -> 右 id */
      var done = false;

      function labelOf(list, id) {
        var t = id;
        list.forEach(function (x) { if (x.id === id) t = x.label; });
        return t;
      }
      function drawLeft() {
        leftBox.innerHTML = d.left.map(function (it) {
          var a = ans[it.id];
          return '<button class="adv-chip' + (pick === it.id ? " sel" : "") + (a ? " on" : "") +
            '" data-l="' + it.id + '" style="max-width:100%;white-space:normal;text-align:left">' +
            U.icon(it.icon || "box", 14) + " " + it.label +
            (a ? '　<b style="font-weight:800">→ ' + labelOf(d.right, a) + "</b>" : "") +
          "</button>";
        }).join("");
        leftBox.querySelectorAll(".adv-chip").forEach(function (b) {
          b.addEventListener("click", function () {
            if (done) return;
            var id = b.getAttribute("data-l");
            pick = (pick === id) ? null : id;
            drawLeft();
          });
        });
      }
      function drawRight() {
        var count = {};
        d.left.forEach(function (it) { if (ans[it.id]) count[ans[it.id]] = (count[ans[it.id]] || 0) + 1; });
        rightBox.innerHTML = d.right.map(function (it) {
          return '<button class="adv-chip' + (count[it.id] ? " on" : "") + '" data-r="' + it.id + '">' +
            U.icon(it.icon || "target", 14) + " " + it.label +
            (count[it.id] ? '　<b style="font-weight:800">已配 ' + count[it.id] + "</b>" : "") +
          "</button>";
        }).join("");
        rightBox.querySelectorAll(".adv-chip").forEach(function (b) {
          b.addEventListener("click", function () {
            if (done) return;
            if (!pick) { U.toast(d.pickTip || "先在左边点一条，再点这里", "info"); return; }
            ans[pick] = b.getAttribute("data-r");
            pick = null;
            drawLeft();
            drawRight();
          });
        });
      }
      drawLeft();
      drawRight();

      host.querySelector('[data-a="check"]').addEventListener("click", function () {
        if (done) return;
        var miss = [], wrong = [];
        d.left.forEach(function (it) {
          if (!ans[it.id]) miss.push(it);
          else if (ans[it.id] !== d.pairs[it.id]) wrong.push(it);
        });
        if (miss.length) {
          out.innerHTML = '<span class="no">还没配完：</span>还剩 ' + miss.length + " 条没有配对（" +
            miss.map(function (it) { return "【" + it.label + "】"; }).join("、") + "）。";
          return;
        }
        done = true;
        leftBox.querySelectorAll(".adv-chip").forEach(function (b) {
          var it = null;
          d.left.forEach(function (x) { if (x.id === b.getAttribute("data-l")) it = x; });
          var good = !!(it && ans[it.id] === d.pairs[it.id]);
          b.classList.toggle("correct", good);
          b.classList.toggle("wrong", !good);
          b.disabled = true;
        });
        rightBox.querySelectorAll(".adv-chip").forEach(function (b) { b.disabled = true; });
        if (!wrong.length) {
          out.innerHTML = '<span class="ok">✓ 全对！</span>' + (d.passHtml || "") + "<br>" +
            d.left.map(function (it) {
              return "· <b>" + it.label + "</b> → " + labelOf(d.right, d.pairs[it.id]) + (it.why ? "：" + it.why : "");
            }).join("<br>");
          U.toast("配对全对！", "success");
        } else {
          out.innerHTML = '<span class="no">✗ 有 ' + wrong.length + " 条配错了：</span>" +
            wrong.map(function (it) { return "【" + it.label + "】"; }).join("、") +
            (d.failHtml ? "<br>" + d.failHtml : "") +
            '<br><span class="dim">点「' + (d.resetLabel || "重来") + "」可以再试一次。</span>";
        }
      });

      host.querySelector('[data-a="reset"]').addEventListener("click", function () {
        ans = {};
        pick = null;
        done = false;
        drawLeft();
        drawRight();
        out.innerHTML = d.empty || "先点左边一条，再点右边它属于哪一类。";
      });
    }
  };

  /* ============ 类型 15：budget —— 上下文预算分配器 ============
   * 与 squeezer 的分工：squeezer 是“拖滑条看谁被挤出”，这里是“自己决定预算怎么分”，
   * 再看总量与溢出——同一个话题换一种视角，避免连看三遍同样的滑条。
   * data = { title, hint, icon, capacity, unitWord, note, resetLabel,
   *          parts:[{ id, label, icon, def, min, max, step, hint, drop:true, keep:true }],
   *          okHtml, overHtml, outHtml(info, d) 可选 } */
  types.budget = {
    demoHTML: function (d) {
      return '<div class="adv-demo">' +
        head(d.title, d.hint, d.icon, d.color) +
        '<div class="adv-row" style="justify-content:space-between">' +
          '<span style="font-size:13px;font-weight:800">窗口容量：' + d.capacity + " " + (d.unitWord || "Token") + "</span>" +
          '<span data-a="total" style="font-size:13px;font-weight:800"></span>' +
        "</div>" +
        '<div class="adv-budget-bar" data-a="bar"></div>' +
        '<div class="adv-budget-legend" data-a="legend"></div>' +
        '<div data-a="rows"></div>' +
        '<div class="adv-row" style="margin-top:10px">' +
          '<button class="btn btn-ghost btn-sm" data-a="reset">' + U.icon("refresh", 14) + " " + (d.resetLabel || "恢复默认预算") + "</button>" +
        "</div>" +
        '<div class="adv-out" data-a="out"></div>' +
      "</div>";
    },
    bind: function (host, d) {
      var bar = host.querySelector('[data-a="bar"]');
      var legend = host.querySelector('[data-a="legend"]');
      var rowsBox = host.querySelector('[data-a="rows"]');
      var totalBox = host.querySelector('[data-a="total"]');
      var out = host.querySelector('[data-a="out"]');
      if (!bar || !rowsBox) return;
      var vals = {};

      function defaults() {
        vals = {};
        d.parts.forEach(function (p) { vals[p.id] = p.def; });
      }

      /* 溢出时从后往前挤压“可丢”的部分（标 keep 的永不丢） */
      function squeeze(total) {
        var over = total - d.capacity;
        var cut = [];
        if (over <= 0) return cut;
        for (var i = d.parts.length - 1; i >= 0 && over > 0; i--) {
          var p = d.parts[i];
          if (!p.drop) continue;
          var c = Math.min(over, vals[p.id]);
          if (c > 0) { cut.push({ p: p, cut: c, left: vals[p.id] - c }); over -= c; }
        }
        return cut;
      }

      function drawRows() {
        rowsBox.innerHTML = d.parts.map(function (p) {
          return '<div class="adv-budget-row">' +
            '<span class="adv-budget-name">' + U.icon(p.icon || "box", 14) + " " + p.label + "</span>" +
            '<input type="range" data-p="' + p.id + '" min="' + (p.min == null ? 0 : p.min) + '" max="' + p.max +
              '" step="' + (p.step || 10) + '" value="' + vals[p.id] + '" style="flex:1;min-width:140px;width:auto">' +
            '<b data-v="' + p.id + '" class="adv-budget-val">' + vals[p.id] + "</b>" +
            (p.hint ? '<span class="adv-budget-hint">' + p.hint + "</span>" : "") +
          "</div>";
        }).join("");
        rowsBox.querySelectorAll("input[data-p]").forEach(function (r) {
          r.addEventListener("input", function () {
            var id = r.getAttribute("data-p");
            vals[id] = parseFloat(r.value) || 0;
            var t = rowsBox.querySelector('[data-v="' + id + '"]');
            if (t) t.textContent = vals[id];
            draw();
          });
        });
      }

      function draw() {
        var total = 0;
        d.parts.forEach(function (p) { total += vals[p.id]; });
        var cut = squeeze(total);
        var cutIds = {};
        cut.forEach(function (c) { cutIds[c.p.id] = c; });
        var pct = Math.round(total / d.capacity * 100);

        totalBox.innerHTML = "已用 <b>" + total + "</b> " + (d.unitWord || "Token") +
          '（<span class="' + (total > d.capacity ? "no" : "ok") + '">' + pct + "%</span>）";
        bar.classList.toggle("over", total > d.capacity);

        bar.innerHTML = d.parts.map(function (p) {
          var v = vals[p.id];
          var k = cutIds[p.id];
          var lost = k ? Math.min(100, k.cut / Math.max(v, 1) * 100) : 0;
          return '<div class="adv-budget-seg' + (k ? " cut" : "") + '" data-p="' + p.id +
            '" style="width:' + Math.min(100, v / d.capacity * 100).toFixed(2) + '%" title="' + p.label + " " + v + '">' +
            /* 只有被挤掉的那一小段画成斜纹，剩下的仍用本块的颜色 */
            (lost > 0 ? '<span class="adv-budget-cut" style="width:' + lost.toFixed(2) + '%"></span>' : "") +
          "</div>";
        }).join("");

        legend.innerHTML = d.parts.map(function (p) {
          var k = cutIds[p.id];
          return '<span class="adv-budget-key' + (k ? " cut" : "") + '">' + p.label +
            " <b>" + vals[p.id] + "</b>" +
            (k ? '　<span class="no">被挤出 ' + k.cut + (k.left > 0 ? "，只剩 " + k.left : "（全被挤掉）") + "</span>" : "") +
            "</span>";
        }).join("");

        if (typeof d.outHtml === "function") {
          out.innerHTML = d.outHtml({ total: total, capacity: d.capacity, pct: pct, cut: cut, vals: vals }, d);
        } else if (total > d.capacity) {
          out.innerHTML = (d.overHtml || '<span class="no">✗ 超预算了：</span>超出 ' + (total - d.capacity) + " " +
            (d.unitWord || "Token") + "，系统只能先挤掉可丢的部分。") +
            (d.note ? '<br><span class="dim">' + d.note + "</span>" : "");
        } else {
          out.innerHTML = (d.okHtml || '<span class="ok">✓ 预算没超：</span>四样内容都在窗口里，AI 同时看得到。') +
            (d.note ? '<br><span class="dim">' + d.note + "</span>" : "");
        }
      }

      defaults();
      drawRows();
      draw();
      host.querySelector('[data-a="reset"]').addEventListener("click", function () {
        defaults();
        drawRows();
        draw();
      });
    }
  };

  /* ============ 类型 16：apiCall —— 一次调用的「请求 ↔ 响应」对照 ============
   * 用途：把"怎么调用大模型"讲成两栏能看见的东西——左边是真正发出去的
   *       （请求行 / 请求头 / 请求体），右边是模型回来的（content / tool_calls / SSE）。
   * data = { title, hint, icon, modes:[{k,label}], defaultKey,
   *          req:{ method, url, headers:[{k,v}], body:{...} },
   *          resp:{
   *            "<k>": { json:{...}（用 text 时改传字符串）, text:"…（原始文本，如 SSE 片段）",
   *                     bodyPatch:{ stream:true }（该模式下请求体要改的字段）,
   *                     meta:"耗时 / usage 一行说明", note:"结论（支持 HTML）" }
   *          },
   *          sendLabel, pendingText, latency, emptyText }
   * 说明：切换模式会顺带把"这一轮要发的请求体"一起改掉（bodyPatch），
   *       所以学生能看到"参数变一点，回来的东西完全不一样"。 */
  types.apiCall = {
    demoHTML: function (d) {
      return '<div class="adv-demo">' +
        head(d.title, d.hint, d.icon, d.color) +
        '<div class="adv-row" data-a="modes">' +
          d.modes.map(function (m) {
            return '<button class="adv-chip" data-k="' + m.k + '">' + m.label + "</button>";
          }).join("") +
        "</div>" +
        '<div class="adv-io">' +
          '<div class="adv-io-col"><div class="adv-io-head">' + U.icon("send", 14) + " 发出去的（请求）</div>" +
            '<pre class="adv-pre" data-a="req"></pre></div>' +
          '<div class="adv-io-col"><div class="adv-io-head">' + U.icon("cloud", 14) + " 回来的（响应）</div>" +
            '<pre class="adv-pre" data-a="resp"></pre></div>' +
        "</div>" +
        '<div class="adv-row" style="margin-top:10px">' +
          '<button class="btn btn-per btn-sm" data-a="send">' + U.icon("spark", 14) + " " + (d.sendLabel || "发送请求") + "</button>" +
          '<span class="adv-api-meta" data-a="meta"></span>' +
        "</div>" +
        '<div class="adv-out" data-a="note">' + (d.emptyText || "选一个模式，再点「发送请求」，看看模型怎么回。") + "</div>" +
      "</div>";
    },
    bind: function (host, d) {
      var modesBox = host.querySelector('[data-a="modes"]');
      var reqBox = host.querySelector('[data-a="req"]');
      var respBox = host.querySelector('[data-a="resp"]');
      var sendBtn = host.querySelector('[data-a="send"]');
      var metaBox = host.querySelector('[data-a="meta"]');
      var noteBox = host.querySelector('[data-a="note"]');
      if (!modesBox || !reqBox || !respBox) return;
      var cur = d.defaultKey || d.modes[0].k;
      var timer = null;

      function respOf() { return d.resp[cur] || {}; }

      /* 该模式下真正要发出去的请求体：深拷贝一份，再按 bodyPatch 改写 */
      function bodyOf() {
        var body = JSON.parse(JSON.stringify(d.req.body));
        var patch = respOf().bodyPatch;
        if (patch) {
          Object.keys(patch).forEach(function (k) { body[k] = patch[k]; });
        }
        return body;
      }
      function drawReq() {
        var lines = d.req.method + " " + d.req.url;
        (d.req.headers || []).forEach(function (h) { lines += "\n" + h.k + ": " + h.v; });
        reqBox.textContent = lines + "\n\n" + JSON.stringify(bodyOf(), null, 2);
      }
      function drawModes() {
        modesBox.querySelectorAll(".adv-chip").forEach(function (b) {
          b.classList.toggle("on", b.getAttribute("data-k") === cur);
        });
      }
      function idle() {
        if (timer) { clearTimeout(timer); timer = null; }
        respBox.textContent = d.pendingText || "// 点「发送请求」，这里会出现模型回来的内容";
        if (metaBox) metaBox.textContent = "";
        if (noteBox) noteBox.innerHTML = d.emptyText || "选一个模式，再点「发送请求」，看看模型怎么回。";
      }
      function send() {
        if (timer) { clearTimeout(timer); timer = null; }
        var r = respOf();
        respBox.textContent = "// 请求已发出，等待模型返回……";
        if (metaBox) metaBox.textContent = "";
        if (noteBox) {
          noteBox.innerHTML = '<span class="dim">这一小段等待是真实存在的：数据要在网络上跑一个来回，模型还要一个字一个字算出来——它叫“推理延迟”。</span>';
        }
        timer = setTimeout(function () {
          timer = null;
          respBox.textContent = (typeof r.text === "string") ? r.text : JSON.stringify(r.json, null, 2);
          if (metaBox) metaBox.textContent = r.meta || "";
          if (noteBox) noteBox.innerHTML = r.note || "";
        }, d.latency || 700);
      }

      modesBox.querySelectorAll(".adv-chip").forEach(function (b) {
        b.addEventListener("click", function () {
          cur = b.getAttribute("data-k");
          drawModes();
          drawReq();      // 参数一起变：让学生看见"请求变了，回来的就不一样"
          idle();
          send();
        });
      });
      if (sendBtn) sendBtn.addEventListener("click", function () { send(); });
      drawModes();
      drawReq();
      idle();
    }
  };

  /* ============ 类型 17：race —— 双轨推进：同一件事，两种做法并排走 ============
   * 适用：有清单 vs 没清单（任务清单）、清单计划 vs 一段话计划（计划能不能被执行）……
   *      凡是「同一件事、两种做法、结果不同」的对比都能用它。
   * data = { title, hint, icon, task, taskLabel, stepLabel, allLabel, resetLabel,
   *          tracks:[{ id, label, icon, win:true, steps:[{t, tone:"ok"|"no"|"warn"|"dim"|""}], tail }],
   *          summary, quiz:{q,opts,ans,why,hint}, empty }
   * 交互：点「走一步」两栏同时推进一格；某一栏走完就停住并显示它的结局（tail）；
   *      两栏都走完之后才亮出对比结论（summary），并放出判断题——先动手、后结论。 */
  types.race = {
    demoHTML: function (d) {
      return '<div class="adv-demo">' +
        head(d.title, d.hint, d.icon, d.color) +
        (d.task ? '<div class="tip" style="margin-bottom:10px"><b>' + (d.taskLabel || "任务：") + "</b>" + d.task + "</div>" : "") +
        '<div class="adv-race" data-a="race"></div>' +
        '<div class="adv-row" style="margin-top:12px">' +
          '<button class="btn btn-per btn-sm" data-a="step">' + U.icon("send", 14) + " " + (d.stepLabel || "走一步") + "</button>" +
          '<button class="btn btn-ghost btn-sm" data-a="all">' + (d.allLabel || "一次走完") + "</button>" +
          '<button class="btn btn-ghost btn-sm" data-a="reset">' + (d.resetLabel || "重来") + "</button>" +
          '<span class="adv-api-meta" data-a="status"></span>' +
        "</div>" +
        '<div class="adv-out" data-a="sum">' + (d.empty || "点「走一步」，看两种做法各自会发生什么。") + "</div>" +
        (d.quiz
          ? '<div class="adv-demo-sub" data-a="qtitle" style="display:none">' + d.quiz.q + "</div>" +
            '<div class="adv-row" data-a="quiz" style="display:none"></div>'
          : "") +
      "</div>";
    },
    bind: function (host, d) {
      var box = host.querySelector('[data-a="race"]');
      if (!box) return;
      var sum = host.querySelector('[data-a="sum"]');
      var status = host.querySelector('[data-a="status"]');
      var stepBtn = host.querySelector('[data-a="step"]');
      var allBtn = host.querySelector('[data-a="all"]');
      var resetBtn = host.querySelector('[data-a="reset"]');
      var qTitle = host.querySelector('[data-a="qtitle"]');
      var qBox = host.querySelector('[data-a="quiz"]');
      var at = {};          /* track.id → 已经走了几步 */
      var tick = 0;
      var timer = null;
      var quizShown = false;

      function stop() { if (timer) { clearInterval(timer); timer = null; } }
      function finished(t) { return at[t.id] >= t.steps.length; }
      function allDone() { return d.tracks.every(finished); }
      function maxAt() {
        var m = 0;
        d.tracks.forEach(function (t) { if (at[t.id] > m) m = at[t.id]; });
        return m;
      }

      function draw() {
        box.innerHTML = d.tracks.map(function (t) {
          var n = at[t.id];
          var body = n
            ? t.steps.slice(0, n).map(function (s) {
                return '<div class="adv-race-step ' + (s.tone || "") + '">' + s.t + "</div>";
              }).join("")
            : '<div class="adv-race-empty">还没有开始——点下面的「走一步」。</div>';
          if (finished(t) && t.tail) {
            body += '<div class="adv-race-tail' + (t.win ? " win" : "") + '">' + t.tail + "</div>";
          }
          return '<div class="adv-race-col' + (finished(t) ? (t.win ? " win" : " lose") : "") + '">' +
            '<div class="adv-race-head">' + U.icon(t.icon || "box", 15) + " " + t.label +
              '<span class="adv-race-prog">' + n + " / " + t.steps.length + "</span></div>" +
            body +
          "</div>";
        }).join("");

        var done = allDone();
        if (status) {
          status.textContent = done
            ? "两栏都走完了——看下面的对比结论"
            : (tick ? "已经走了 " + maxAt() + " 步（两栏同时推进）" : "还没开始");
        }
        if (done) {
          if (sum) sum.innerHTML = d.summary || '<span class="ok">✓ 两栏都走完了。</span>';
          if (d.quiz && !quizShown) revealQuiz();
        }
        if (stepBtn) stepBtn.disabled = done;
        if (allBtn) allBtn.disabled = done;
      }

      function advance() {
        if (allDone()) return false;
        d.tracks.forEach(function (t) { if (!finished(t)) at[t.id] = at[t.id] + 1; });
        tick++;
        draw();
        return true;
      }

      /* 判断题：动手走完一轮才出现（先体验、后结论） */
      function revealQuiz() {
        quizShown = true;
        if (qTitle) qTitle.style.display = "block";
        if (!qBox || !d.quiz) return;
        qBox.style.display = "flex";
        qBox.innerHTML = d.quiz.opts.map(function (o, j) {
          return '<button class="adv-chip" data-j="' + j + '">' + o + "</button>";
        }).join("");
        qBox.querySelectorAll(".adv-chip").forEach(function (b) {
          b.addEventListener("click", function () {
            if (qBox.classList.contains("done")) return;
            var base = d.summary || "";
            if (parseInt(b.getAttribute("data-j"), 10) === d.quiz.ans) {
              qBox.classList.add("done");
              b.classList.add("on");
              if (sum) sum.innerHTML = base + '<br><span class="ok">' + U.icon("check", 15) + " 答对了！" + d.quiz.why + "</span>";
              U.celebrate(b);
            } else {
              b.classList.add("wrong");
              setTimeout(function () { b.classList.remove("wrong"); }, 450);
              if (sum) sum.innerHTML = base + '<br><span class="no">' + U.icon("xmark", 15) + " " + (d.quiz.hint || "再想想。") + "</span>";
            }
          });
        });
      }

      function reset() {
        stop();
        at = {};
        d.tracks.forEach(function (t) { at[t.id] = 0; });
        tick = 0;
        quizShown = false;
        if (qTitle) qTitle.style.display = "none";
        if (qBox) { qBox.style.display = "none"; qBox.classList.remove("done"); qBox.innerHTML = ""; }
        if (sum) sum.innerHTML = d.empty || "点「走一步」，看两种做法各自会发生什么。";
        draw();
      }

      if (stepBtn) stepBtn.addEventListener("click", function () { stop(); advance(); });
      if (allBtn) allBtn.addEventListener("click", function () {
        stop();
        allBtn.disabled = true;
        timer = setInterval(function () { if (!advance()) stop(); }, d.speed || 900);
      });
      if (resetBtn) resetBtn.addEventListener("click", reset);

      reset();
    }
  };

  /* ============ 类型 18：ranker —— 打分排名：谁会被想起来？ ============
   * 适用：记忆/检索的打分与排序（相关性 × 时间衰减 × 重要性），把“为什么想起了这一条”变成可计算。
   * data = { title, hint, icon, color, questionLabel, questions:[{k,t,rels:{itemId:0~100}}],
   *          items:[{id,label,days,imp}], decay:{label,value,min,max,step,unit,note},
   *          guess:{q}, revealLabel, resetLabel, outHtml(top, rows, d) }
   * 交互：① 先猜一条（点一条记忆）→ ② 点「揭开打分」看榜单（按分数排序 + 分数条）
   *      ③ 拖「时间衰减半衰期」滑条，实时看排序怎么变（旧记忆什么时候掉队）。 */
  types.ranker = {
    demoHTML: function (d) {
      return '<div class="adv-demo">' +
        head(d.title, d.hint, d.icon, d.color) +
        '<div class="adv-row" data-a="qs"></div>' +
        '<div class="adv-demo-sub" data-a="guessq">' + (d.guess ? d.guess.q : "先点一条你认为会被想起来的记忆：") + "</div>" +
        '<div class="adv-rank" data-a="list"></div>' +
        '<div class="adv-row" style="margin-top:10px">' +
          '<button class="btn btn-per btn-sm" data-a="reveal">' + U.icon("eye", 14) + " " + (d.revealLabel || "揭开打分") + "</button>" +
          '<button class="btn btn-ghost btn-sm" data-a="reset">' + (d.resetLabel || "重来") + "</button>" +
          '<span class="adv-api-meta" data-a="status"></span>' +
        "</div>" +
        (d.decay
          ? '<div class="adv-row" data-a="decayrow" style="margin-top:10px;display:none">' +
              '<span style="font-size:13px;font-weight:800;min-width:146px">' + d.decay.label + "</span>" +
              '<input type="range" data-a="decay" min="' + d.decay.min + '" max="' + d.decay.max + '" step="' + (d.decay.step || 1) + '" value="' + d.decay.value + '" style="flex:1;min-width:150px;width:auto">' +
              '<b data-a="decayval" style="min-width:70px;text-align:right"></b>' +
            "</div>"
          : "") +
        '<div class="adv-out" data-a="out"></div>' +
      "</div>";
    },
    bind: function (host, d) {
      var list = host.querySelector('[data-a="list"]');
      if (!list) return;
      var qsBox = host.querySelector('[data-a="qs"]');
      var out = host.querySelector('[data-a="out"]');
      var status = host.querySelector('[data-a="status"]');
      var revealBtn = host.querySelector('[data-a="reveal"]');
      var resetBtn = host.querySelector('[data-a="reset"]');
      var decayRow = host.querySelector('[data-a="decayrow"]');
      var decayInput = host.querySelector('[data-a="decay"]');
      var decayVal = host.querySelector('[data-a="decayval"]');
      var cur = 0;            /* 当前问题序号 */
      var guess = null;       /* 学生猜的那一条 id */
      var revealed = false;

      function question() { return d.questions[cur]; }
      function half() { return decayInput ? (parseFloat(decayInput.value) || 30) : 30; }
      function relOf(it) {
        var r = question().rels || {};
        return r[it.id] == null ? 0 : r[it.id];
      }
      /* 分数 = 相关性 × 时间衰减 × (0.8 + 重要性 × 0.4)，
       * 与 ai-agent-book 里“相关度 × 时间 × 重要性”的口径一致，再折算成 0~100 分便于比较。 */
      function scoreOf(it) {
        var decay = 1 / (1 + it.days / half());
        var s = (relOf(it) / 100) * decay * (0.8 + 0.4 * (Math.max(0, Math.min(5, it.imp)) / 5));
        return Math.max(0, Math.min(100, Math.round(s / 1.2 * 100)));
      }
      function rowsOf() {
        return d.items.map(function (it) {
          return { it: it, rel: relOf(it), pts: scoreOf(it) };
        });
      }

      function drawQs() {
        if (!qsBox) return;
        qsBox.innerHTML = d.questions.map(function (q, i) {
          return '<button class="adv-chip' + (i === cur ? " on" : "") + '" data-q="' + q.k + '">' + q.t + "</button>";
        }).join("");
        qsBox.querySelectorAll(".adv-chip").forEach(function (b) {
          b.addEventListener("click", function () {
            var k = b.getAttribute("data-q");
            d.questions.forEach(function (q, i) { if (q.k === k) cur = i; });
            guess = null;
            revealed = false;
            drawQs();
            draw();
          });
        });
      }

      function draw() {
        var rows = rowsOf().slice();
        if (revealed) rows.sort(function (a, b) { return b.pts - a.pts; });
        list.innerHTML = rows.map(function (r, i) {
          var picked = r.it.id === guess;
          var cls = "adv-rank-item";
          if (picked) cls += " picked";
          if (revealed) {
            cls += " show" + (i === 0 ? " top" : "");
            if (picked) cls += (i === 0 ? " right" : " wrong");
          }
          return '<button type="button" class="' + cls + '" data-id="' + r.it.id + '">' +
            '<span class="adv-rank-name">' + (revealed ? "<b>" + (i + 1) + "&nbsp;</b> " : "") + r.it.label + "</span>" +
            '<span class="adv-rank-meta">' + (r.it.days === 0 ? "今天记的" : r.it.days + " 天前记的") +
              "　·　重要性 " + r.it.imp + "/5" + (revealed ? "　·　相关性 " + r.rel + "/100" : "") + "</span>" +
            (revealed
              ? '<span class="adv-rank-bar"><i style="width:' + r.pts + '%"></i></span><b class="adv-rank-pts">' + r.pts + " 分</b>"
              : "") +
          "</button>";
        }).join("");
        list.querySelectorAll(".adv-rank-item").forEach(function (b) {
          b.addEventListener("click", function () {
            if (revealed) return;
            guess = b.getAttribute("data-id");
            draw();
          });
        });

        if (revealBtn) revealBtn.disabled = revealed;
        if (status) {
          status.textContent = revealed
            ? "按分数从高到低排名（实际只把前几条放进上下文）"
            : (guess ? "已记下你的猜测——点「揭开打分」看结果" : "先猜一条，再揭开打分");
        }
        if (decayRow) decayRow.style.display = revealed ? "flex" : "none";
        if (decayVal && d.decay) decayVal.textContent = half() + (d.decay.unit || " 天");
      }

      function reveal() {
        revealed = true;
        var rows = rowsOf().slice().sort(function (a, b) { return b.pts - a.pts; });
        var top = rows[0];
        var guessed = null, guessedRank = 0;
        rows.forEach(function (r, i) {
          if (r.it.id === guess) { guessed = r; guessedRank = i + 1; }
        });
        if (out) {
          if (d.outHtml) {
            out.innerHTML = d.outHtml(top, rows, d, { guess: guess, rank: guessedRank });
          } else {
            var msg = "";
            if (guess) {
              msg = guessedRank === 1
                ? '<span class="ok">✓ 猜对了！</span>'
                : '<span class="no">✗ 你猜的是「' + guessed.it.label + '」，它排在第 ' + guessedRank + " 名。</span>";
            }
            out.innerHTML = "<b>分数 = 相关性 × 时间衰减 × (0.8 + 重要性 × 0.4)</b><br>" + msg +
              '<br><span class="dim">排名第一的是「' + top.it.label + "」（" + top.pts +
              " 分）：它和当前问题最相关，时间也还新鲜。可以拖动下面的滑条，看老记忆什么时候掉队。</span>";
          }
        }
        draw();
      }

      if (revealBtn) revealBtn.addEventListener("click", reveal);
      if (resetBtn) resetBtn.addEventListener("click", function () {
        guess = null;
        revealed = false;
        if (decayInput && d.decay) decayInput.value = d.decay.value;
        if (out) out.innerHTML = "";
        draw();
      });
      if (decayInput) decayInput.addEventListener("input", function () { draw(); });

      drawQs();
      if (out && d.empty) out.innerHTML = d.empty;
      draw();
    }
  };

  /* ---------- 通用：达标检查表 ----------
   * opt = { rows, title, leftLabel, rightLabel, isDemo, note, verdict }
   * 设计目标：把“两个回答感觉差不多”变成“几比几”，并且用一句大白话把结论说清楚。
   * rows 里每项 = { n: 检查项, av/bv: 左右是否达标, ae/be: 实际检测到的值 }。 */
  function checklistHTML(opt) {
    var rows = opt.rows || [];
    var as = 0, bs = 0;
    rows.forEach(function (r) { if (r.av) as++; if (r.bv) bs++; });
    var total = rows.length;
    var L = opt.leftLabel || "模糊版";
    var R = opt.rightLabel || "清晰版";
    function cell(pass, ev) {
      return '<td class="' + (pass ? "yes" : "no") + '">' + (pass ? "✓" : "✗") + " " + esc(ev || "") + "</td>";
    }

    /* 一句话结论（没传就自动生成），用学生听得懂的大白话 */
    var verdict = opt.verdict;
    if (!verdict) {
      var head = R + " 做到 " + bs + " / " + total + " 项，" + L + " 做到 " + as + " / " + total + " 项。";
      if (bs > as) {
        verdict = head + "同样的 AI，换了问法就多做到 " + (bs - as) + " 项——差别不在 AI 聪不聪明，而在你的问法（要求说全了没有、说清楚了没有）。";
      } else if (bs === as) {
        verdict = head + "这次打平了。把右边的要求去掉几条再问一次：分数要是跟着掉，就说明这些分是“说清楚”换来的，不是运气。";
      } else {
        verdict = head + "这次反而左边更多，属于偶尔“撞对”。多问几次就会发现：说得清楚的那一边，结果更稳、更好复制。";
      }
    }

    return '<div class="cmp-verdict">' + U.icon("check", 18) + '<div><b>结论：</b>' + verdict + "</div></div>" +
      '<div class="cmp-chead">' + (opt.title || "达标检查表") +
        '<span class="cmp-chead-tip">✓ = 做到了，✗ = 没做到；括号里是实际检测到的值</span>' +
        (opt.isDemo ? '<span class="stage-pill pill-plan" style="margin-left:8px">示例演示（未配置 DeepSeek Key）</span>' : "") +
      "</div>" +
      '<table class="cmp-table"><thead><tr><th>检查项</th><th>' + esc(L) + "</th><th>" + esc(R) + "</th></tr></thead><tbody>" +
        rows.map(function (r) { return "<tr><td>" + r.n + "</td>" + cell(r.av, r.ae) + cell(r.bv, r.be) + "</tr>"; }).join("") +
      "</tbody></table>" +
      '<div class="cmp-score"><span>' + esc(L) + "达标：" + as + " / " + total + "</span>" +
        '<span>' + esc(R) + "达标：" + bs + " / " + total + "</span></div>" +
      (opt.note ? '<div class="tip" style="margin-top:10px">' + U.icon("info", 16) + " " + opt.note + "</div>" : "") +
      "<!--SCORE:" + JSON.stringify({ left: as, right: bs, total: total }) + "-->";
  }

  /* ---------- 通用：有 Key 调真实模型，无 Key 走内置示例 ---------- */
  /* opt = { system, user, demo: { left, right }, demoNote } → Promise<{mode,left,right,message}> */

  /* 单侧提问 + 空返回兜底：
   * 两侧同时提问时，偶发“某一侧成功但只返回了空内容”（服务端并发限流、
   * 或模型只输出了内部推理没写正文）。空字符串会走 fulfilled 分支，
   * 界面就会卡在“正在提问……”或只显示空白。这里自动单独重试那一侧一次——
   * 重试时另一侧早已结束，不构成并发，成功率更高。 */
  function askSide(systemPrompt, userText, askFn, apiOpts) {
    var fn = askFn || AgentLab.API.ask;
    function once() {
      return fn(systemPrompt, userText, apiOpts).then(function (t) {
        return String(t == null ? "" : t).trim();
      });
    }
    return once().then(function (t) {
      if (t) return t;
      return new Promise(function (r) { setTimeout(r, 900); })
        .then(once)
        .then(function (t2) { return t2 || ""; }, function () { return ""; });
    });
  }

  function askOrDemo(opt) {
    var hasKey = AgentLab.API && AgentLab.API.hasApiKey && AgentLab.API.hasApiKey();
    if (!hasKey) {
      if (opt.onDemo) opt.onDemo();
      return Promise.resolve({
        mode: "demo",
        left: opt.demo.left,
        right: opt.demo.right,
        message: opt.demoNote || "未配置 DeepSeek Key，本次用内置示例演示对比"
      });
    }
    var jobs = [
      askSide(opt.systemLeft || opt.system || "", opt.userLeft || opt.user || ""),
      askSide(opt.systemRight || opt.system || "", opt.userRight || opt.user || "")
    ];
    return Promise.allSettled(jobs).then(function (res) {
      if (res[0].status !== "fulfilled" || res[1].status !== "fulfilled") {
        var msg = ((res[0].reason || res[1].reason || {}).message) || "网络问题";
        return { mode: "error", message: msg, left: "", right: "", settled: res };
      }
      return { mode: "cloud", left: res[0].value, right: res[1].value, settled: res };
    });
  }

  return {
    panelHTML: panelHTML,
    bind: bind,
    checklistHTML: checklistHTML,
    askOrDemo: askOrDemo,
    askSide: askSide,
    types: types,
    bindMiniQuiz: bindMiniQuiz,
    head: head
  };
})();
