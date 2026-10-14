/* ============================================================
 * quiz-flow.js —— 全站通用「单题闯关」答题引擎（AgentLab.Quiz）
 *
 * 解决的问题：把散落在 7 个板块里的选择题（小测验 / 游戏题 / 判断题）
 * 从“一次性把 N 题铺满页面”改成“一题一题出现”的闯关流程：
 *   ① 一次只显示 1 题，答完这题才出下一题；
 *   ② 答对：即时判定 + 加星 + 庆祝动效 + 讲解，自动进入下一题；
 *   ③ 答错：抖动提示，先给一次“再想想”的机会；第二次才揭示答案与讲解；
 *   ④ 全部答完：给出得分、等级点评、鼓励语、需要回顾的题目与“再来一次”。
 *
 * 只依赖 AgentLab.UI（$ / icon / esc / celebrate / addScore / toast），
 * 不依赖任何 lab-*.js，可被任意板块调用。
 *
 * 用法：
 *   AgentLab.Quiz.mount({
 *     host: "mem-quiz-body",        // 必须：题目容器（id 或元素）
 *     color: "mem",                 // 可选：语义色 per/plan/mem/exe/brain/ori
 *     questions: QUIZ,              // 必须：题目数组（见下方兼容格式）
 *     judge: ["用到了记忆", "没用到记忆"], // 可选：ans 为 true/false 时的两个选项文案
 *     star: "mem-quiz-score",       // 可选：页面既有的星标元素 id
 *     bar: "qz-progress-bar",       // 可选：页面既有的进度条 id
 *     count: "qz-count",            // 可选：页面既有的题号计数元素 id
 *     restart: "mem-quiz-restart",  // 可选：页面既有的“重新开始”按钮 id
 *     result: "qz-result",          // 可选：页面既有的结果容器 id
 *     name: "记忆小达人",            // 可选：点评里用的称号
 *     hint: "再想想，可以回到上面的实验里找线索。", // 可选：答错提示
 *     onFinish: function (score, total) {} // 可选：结束回调
 *   });
 *
 * 兼容的历史题目字段（自动识别，无需改数据）：
 *   题干：q | question          序号/前置：pre | scenario | scene
 *   选项：opts | options（元素为字符串，或 {t,k} / {html,key}）
 *   答案：ans | correct（数字=选项序号，字符串=选项 key 或选项原文，布尔=判断题）
 *   讲解：why                   提示：hint
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

(function () {
  var U = window.AgentLab.UI;
  var $ = U.$;

  function esc(s) { return U.esc(s); }
  function node(x) { return typeof x === "string" ? document.getElementById(x) : x; }
  var COLOR_OK = { per: 1, plan: 1, mem: 1, exe: 1, brain: 1, ori: 1 };

  /* ---------- 题目归一化（把各板块的历史数据统一成一种形态） ---------- */
  function normOpts(q, judge) {
    var raw = q.opts || q.options || null;
    if (raw && raw.length) {
      return raw.map(function (o, i) {
        if (typeof o === "string") return { html: o, key: i, text: o, cls: "", why: "" };
        var text = o.t != null ? o.t : (o.html != null ? o.html : o.label);
        return {
          html: text,
          key: (o.k != null ? o.k : (o.key != null ? o.key : i)),
          text: text,
          cls: o.cls || "",
          why: o.why || ""
        };
      });
    }
    if (judge && typeof q.ans === "boolean") {
      return [
        { html: judge[0], key: true, text: judge[0], cls: "", why: "" },
        { html: judge[1], key: false, text: judge[1], cls: "", why: "" }
      ];
    }
    return [];
  }

  /* 答案归一化：支持数字序号 / 字符串 key 或选项原文 / 布尔判断 / 数组（多个正确项都算对） */
  function normAns(q, list) {
    var a = (q.ans != null) ? q.ans : q.correct;
    function one(v) {
      if (typeof v === "number") return list[v] ? list[v].key : v;
      if (typeof v === "string") {
        for (var i = 0; i < list.length; i++) {
          if (list[i].key === v || list[i].text === v || list[i].html === v) return list[i].key;
        }
      }
      return v;
    }
    if (Array.isArray(a)) {
      return a.map(function (v) { return one(v); });
    }
    return one(a);
  }

  function normPre(q) {
    var out = "";
    if (q.pre) out += '<div class="flow-pre">' + (q.preLabel ? '<b>' + esc(q.preLabel) + '</b> ' : "") + q.pre + "</div>";
    if (q.scenario) out += '<div class="flow-pre"><b>场景</b> ' + esc(q.scenario) + "</div>";
    if (q.scene) out += '<div class="flow-pre"><b>场景</b> ' + esc(q.scene) + "</div>";
    return out;
  }

  function normalize(list, judge, doShuffle) {
    return (list || []).map(function (q, i) {
      var opts = normOpts(q, judge);
      var ans = normAns(q, opts);
      if (doShuffle) {
        for (var k = opts.length - 1; k > 0; k--) {
          var r = Math.floor(Math.random() * (k + 1));
          var t = opts[k]; opts[k] = opts[r]; opts[r] = t;
        }
      }
      return {
        no: i + 1,
        pre: normPre(q),
        q: q.q != null ? q.q : (q.question != null ? q.question : ""),
        opts: opts,
        ans: ans,
        why: q.why || "",
        hint: q.hint || ""
      };
    });
  }

  /* ---------- 点评分级（hasReview：是否有需要回顾的题） ---------- */
  function grade(score, total, name, hasReview) {
    var r = total ? score / total : 0;
    var who = name || "小达人";
    if (r === 1) {
      return {
        icon: "star",
        title: "全对！你就是" + who + "！",
        msg: "一共 " + total + " 题，你<b>一次就答对全部 " + total + " 题</b>，说明这些概念你已经真的懂了——不是记住了选项，是真的会判断。",
        tips: [
          "给自己一个掌声：满分很难得，尤其是" + total + " 题全对。",
          "想更厉害？试着把这几道题讲给同桌听——能讲清楚，才算真会。"
        ]
      };
    }
    if (r >= 0.8) {
      return {
        icon: "happy",
        title: "非常棒！只差一点点就满分",
        msg: "一次答对 <b>" + score + "/" + total + "</b> 题，只有 " + (total - score) + " 题没一次答对——你的理解已经很扎实了。",
        tips: [
          hasReview ? "把下面列出的那几题再看一眼，你就能完全拿下。" : "再点“再来一次”，试试能不能全对。",
          "有点犹豫的那几题，往往是最“像”的干扰项——说明你已经会区分细节了。"
        ]
      };
    }
    if (r >= 0.6) {
      return {
        icon: "check",
        title: "做得不错！再来一轮就更稳",
        msg: "一次答对 <b>" + score + "/" + total + "</b> 题。有些概念容易混，这很正常——把它们找出来就是收获。",
        tips: [
          hasReview ? "回到上面的实验卡片，把下面列出的那几题涉及的操作亲手做一遍，比再看一遍文字管用。" : "回到上面的实验卡片，把相关操作亲手做一遍，比再看一遍文字管用。",
          "然后再点“再来一次”，看看是不是全对了。"
        ]
      };
    }
    return {
      icon: "refresh",
      title: "别急，这些概念确实有点绕",
      msg: "这一轮一次答对 <b>" + score + "/" + total + "</b> 题。答错不等于不会——只是还没把这些词和真实场景连起来。",
      tips: [
        "建议先回到上面的实验卡片，动手玩一遍再来挑战。",
        hasReview ? "重点看下面列出的这几题，它们对应的是最关键的几个概念。" : "点“再来一次”再试一轮，第二轮通常就顺手多了。",
        "记住：能说出“为什么其他选项不对”，才是真的会了。"
      ]
    };
  }

  /* ---------- 主流程 ---------- */
  function mount(cfg) {
    var host = node(cfg.host);
    if (!host) return null;

    var qs = normalize(cfg.questions, cfg.judge, cfg.shuffle);
    if (!qs.length) return null;

    var color = COLOR_OK[cfg.color] ? cfg.color : "per";
    var starEl = node(cfg.star);
    var barEl = node(cfg.bar);
    var countEl = node(cfg.count);
    var restartEl = node(cfg.restart);
    var resultEl = node(cfg.result);
    var hasOwnHead = !(barEl || countEl);

    var total = qs.length;
    var state = { idx: 0, score: 0, tries: 0, wrong: [], retried: [], done: false, timer: null };

    function clearTimer() { if (state.timer) { clearTimeout(state.timer); state.timer = null; } }

    function setProgress() {
      /* 进度按“正在做第几题”算，第 1 题就有一段进度，学生更有推进感 */
      var pct = Math.round((state.idx + 1) / total * 100);
      if (barEl) barEl.style.width = Math.min(pct, 100) + "%";
      if (countEl) countEl.textContent = "第 " + Math.min(state.idx + 1, total) + "/" + total + " 题";
    }

    function headHTML() {
      if (!hasOwnHead) return "";
      return '<div class="flow-head">' +
        '<div class="flow-bar"><i style="width:' + Math.round((state.idx + 1) / total * 100) + '%"></i></div>' +
        '<div class="flow-meta"><span class="flow-count">第 ' + (state.idx + 1) + "/" + total + ' 题</span>' +
        (starEl ? "" : '<span class="score-badge" data-flow-star="1" data-score="0">★ 0</span>') +
        "</div></div>";
    }

    function draw() {
      clearTimer();
      if (state.idx >= total) { finish(); return; }
      var q = qs[state.idx];
      state.tries = 0;

      host.innerHTML =
        headHTML() +
        '<div class="flow-card">' +
          q.pre +
          '<div class="flow-q"><span class="flow-no">' + q.no + "</span><span>" + q.q + "</span></div>" +
          '<div class="opts flow-opts' + (cfg.optsCls ? " " + cfg.optsCls : "") + '">' +
            q.opts.map(function (o, j) {
              return '<button class="opt' + (o.cls ? " " + o.cls : "") + '" data-j="' + j +
                '" data-key="' + esc(String(o.key)) + '">' + o.html + "</button>";
            }).join("") +
          "</div>" +
          '<div class="quiz-feedback"></div>' +
          '<div class="flow-actions"><button class="btn btn-ghost btn-sm flow-next" style="display:none">下一题 →</button></div>' +
        "</div>";

      if (!starEl) {
        var own = host.querySelector("[data-flow-star]");
        if (own) own.setAttribute("data-score", String(state.score));
        if (own) own.textContent = "★ " + state.score;
      }
      bindQuestion(q);
      setProgress();
    }

    function fbBox() { return host.querySelector(".quiz-feedback"); }
    function nextBtn() { return host.querySelector(".flow-next"); }

    function showNext(afterMs) {
      var b = nextBtn();
      if (b) {
        b.style.display = "";
        b.textContent = (state.idx + 1 >= total) ? "看结果 →" : "下一题 →";
      }
      state.timer = setTimeout(advance, afterMs);
    }

    function advance() {
      clearTimer();
      state.idx++;
      draw();
    }

    function lockAll() {
      host.querySelectorAll(".flow-opts .opt").forEach(function (b) { b.disabled = true; });
    }

    function bindQuestion(q) {
      var opts = host.querySelectorAll(".flow-opts .opt");
      var ansSet = (Array.isArray(q.ans) ? q.ans : [q.ans]).map(function (v) { return String(v); });
      var opted = q.opts;

      function whyOf(idx) {
        var o = opted[parseInt(idx, 10)];
        return (o && o.why) || q.why || "";
      }

      opts.forEach(function (b) {
        b.addEventListener("click", function () {
          if (b.disabled || b.classList.contains("correct")) return;
          var key = String(b.getAttribute("data-key"));
          var right = ansSet.indexOf(key) >= 0;

          if (right) {
            b.classList.add("correct");
            lockAll();
            U.celebrate(b);
            if (state.tries === 0) {
              state.score++;
              if (starEl) U.addScore(starEl, 1);
              else {
                var own = host.querySelector("[data-flow-star]");
                if (own) { own.setAttribute("data-score", String(state.score)); own.textContent = "★ " + state.score; own.classList.add("pop"); }
              }
            } else {
              /* 第二次才答对：不加星，但记进回顾清单，方便结尾点评 */
              state.retried.push(q.no);
            }
            fbBox().innerHTML = '<span class="fb-ok">' + U.icon("check", 15) + " 答对了！" + whyOf(b.getAttribute("data-j")) + "</span>";
            showNext(1600);
          } else {
            state.tries++;
            if (state.tries === 1) {
              /* 第一次错：给一次“再想想”的机会，不揭答案；已试过的选项先锁住，避免重复点同一个 */
              b.classList.add("wrong");
              setTimeout(function () { b.classList.remove("wrong"); }, 500);
              b.disabled = true;
              b.classList.add("flow-tried");
              fbBox().innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " " +
                esc(q.hint || cfg.hint || "再想想——也可以回到上面的实验里找线索。") + "</span>";
            } else {
              /* 第二次错：揭示正确项并讲解，本题不加星 */
              lockAll();
              opts.forEach(function (x) {
                if (ansSet.indexOf(String(x.getAttribute("data-key"))) >= 0) x.classList.add("correct");
              });
              b.classList.add("wrong");
              state.wrong.push(q.no);
              fbBox().innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " 正确答案已标出。" +
                (q.why || "") + "</span>";
              showNext(2600);
            }
          }
        });
      });

      var nb = nextBtn();
      if (nb) nb.addEventListener("click", advance);
    }

    function finish() {
      state.done = true;
      var names = state.wrong.concat(state.retried).sort(function (a, b) { return a - b; });
      var g = grade(state.score, total, cfg.name, names.length > 0);
      var pct = Math.round(state.score / total * 100);
      var wrongList = names.length
        ? '<div class="fr-tips"><b>需要回顾的题（共 ' + names.length + " 题）：</b>" +
            names.map(function (n) {
              var q = qs[n - 1];
              var t = String(q.q).replace(/<[^>]+>/g, "");
              var tag = state.wrong.indexOf(n) >= 0 ? "两次都没选对" : "第二次才选对";
              return '<div class="fr-tip-item">· 第 ' + n + " 题：" + esc(t.slice(0, 32)) + (t.length > 32 ? "…" : "") +
                ' <span class="fr-tag">' + tag + "</span></div>";
            }).join("") + "</div>"
        : "";

      var html =
        '<div class="flow-result" data-color="' + color + '">' +
          '<div class="fr-icon">' + U.icon(g.icon, 40) + "</div>" +
          '<div class="fr-title">' + g.title + "</div>" +
          '<div class="fr-score">一次答对 <b>' + state.score + " / " + total + "</b> 题（" + pct + "%）</div>" +
          '<div class="fr-bar"><i style="width:' + pct + '%"></i></div>' +
          '<div class="fr-msg">' + g.msg + "</div>" +
          '<div class="fr-tips">' + g.tips.map(function (t) { return '<div class="fr-tip-item">· ' + t + "</div>"; }).join("") + "</div>" +
          wrongList +
          '<div class="fr-actions"><button class="btn btn-per" data-flow-again="1">' + U.icon("refresh", 16) + " 再来一次</button></div>" +
        "</div>";

      if (resultEl) {
        host.style.display = "none";
        resultEl.style.display = "";
        resultEl.innerHTML = html;
      } else {
        host.innerHTML = html;
      }
      if (barEl) barEl.style.width = "100%";
      if (countEl) countEl.textContent = "已答完 " + total + "/" + total + " 题";

      var again = (resultEl || host).querySelector("[data-flow-again]");
      if (again) again.addEventListener("click", reset);
      if (U.toast && state.score === total) U.toast("全部答对，太棒了！", "success");
      if (typeof cfg.onFinish === "function") cfg.onFinish(state.score, total);
    }

    function reset() {
      clearTimer();
      state.idx = 0;
      state.score = 0;
      state.tries = 0;
      state.wrong = [];
      state.retried = [];
      state.done = false;
      if (resultEl) { resultEl.style.display = "none"; resultEl.innerHTML = ""; }
      host.style.display = "";
      if (starEl) { starEl.setAttribute("data-score", "0"); starEl.textContent = "★ 0"; }
      draw();
    }

    if (restartEl) restartEl.addEventListener("click", reset);
    host.setAttribute("data-color", color);
    draw();

    return { reset: reset, state: state };
  }

  /* ---------- 给“进阶课堂”等内嵌小测用的极简入口 ---------- */
  function mini(hostEl, items, opts) {
    var o = opts || {};
    return mount({
      host: hostEl,
      color: o.color || "per",
      questions: items,
      name: o.name || "小达人",
      judge: o.judge,
      hint: o.hint,
      star: o.star,
      restart: o.restart
    });
  }

  window.AgentLab.Quiz = { mount: mount, mini: mini, grade: grade };
})();
