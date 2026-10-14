/* ============================================================
 * lab-cover.js —— 封面页（Apple 官网极简风）
 * 结构只有两段：
 *   ① 主视觉：课程徽章 + 超大标题 + 一句话 + 主按钮 + 功能标签
 *   ② 导览区：七个实验室入口卡片（可点击直达）
 * 原环形图、课程地图、四卡使用提示、公式过渡句与页脚提示已移除。
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

AgentLab.LabCover = (function () {
  var U = AgentLab.UI;
  var $ = U.$;

  /* ---------- 实验室导览：7 个栏目（点击直达） ----------
   * desc 一句话（≤22 字），讲清“这里玩什么”即可，细节留给各实验室首页。
   * color/deep 只用于图标色块（卡片本身黑白，苹果式克制）；
   * finale = 智能体实验室：收尾卡，与其他卡片同配色，单独居中一行。 */
  var LABS = [
    { sec: "origin", name: "起源实验室", course: "L01 – L02", icon: "rocket",
      desc: "AI 发展史 · 图灵测试 · 大模型工作原理",
      color: "var(--c-ori)", deep: "var(--c-ori-deep)" },
    { sec: "home", name: "架构实验室", course: "L03 – L04", icon: "brain",
      desc: "总装图 · 拆解真实的智能体",
      color: "var(--c-brain)", deep: "var(--c-brain-deep)" },
    { sec: "perception", name: "感知器实验室", course: "L05 – L06", icon: "eye",
      desc: "语音与图像识别 · 消息角色 · Token",
      color: "var(--c-per)", deep: "var(--c-per-deep)" },
    { sec: "planner", name: "规划器实验室", course: "L07 – L08", icon: "gear",
      desc: "任务拆解 · ReAct · 思维链",
      color: "var(--c-plan)", deep: "var(--c-plan-deep)" },
    { sec: "memory", name: "记忆器实验室", course: "L09 – L10", icon: "book",
      desc: "记忆三层次 · 班级知识库 RAG",
      color: "var(--c-mem)", deep: "var(--c-mem-deep)" },
    { sec: "executor", name: "执行器实验室", course: "L11 – L12", icon: "hand",
      desc: "工具调用 · Function Calling · MCP",
      color: "var(--c-exe)", deep: "var(--c-exe-deep)" },
    { sec: "playground", name: "智能体实验室", course: "L13 · 综合实战", icon: "robot",
      desc: "和真正的智能体对话，实时看它的感知、规划、记忆与执行",
      color: "#8a5cf6", deep: "#5a3de0", finale: true }
  ];

  /* ---------- 渲染 ---------- */
  function render() {
    var sec = $("sec-cover");
    if (!sec) return;

    sec.innerHTML =
      /* ---------- ① 主视觉 ---------- */
      '<div class="cv-hero">' +
        '<div class="cv-badge">' + U.icon("bookopen", 14) + '配套《AI智能体科普实践课》</div>' +
        '<h1 class="cv-title">AI智能体<span class="cv-grad">互动学习</span>实验室</h1>' +
        '<p class="cv-lead">玩游戏、做实验、和真正的 AI 对话——直观看懂智能体的四大组件，以及大语言模型“大脑”如何把它们协作起来。</p>' +
        '<div class="cv-cta">' +
          '<button class="cv-go" data-goto="origin">开始探索 · 起源实验室' + U.icon("back", 16) + '</button>' +
        '</div>' +
        '<div class="cv-tags">' +
          '<span>知识讲解</span><span>互动游戏</span><span>动手实验</span><span>真实 AI 对话</span><span>小测验</span>' +
        '</div>' +
      '</div>' +

      /* ---------- ② 导览区（浅灰分区） ---------- */
      '<div class="cv-nav">' +
        '<h2 class="cv-h2">七个实验室，带你逐个拆开看</h2>' +
        '<div class="cv-grid">' +
          LABS.map(function (l, i) {
            return '<button class="cv-card' + (l.finale ? ' is-finale' : '') + '" data-goto="' + l.sec + '" style="--i:' + i + '">' +
              '<span class="cv-ico" style="background:linear-gradient(140deg,' + l.color + ',' + l.deep + ')">' + U.icon(l.icon, 22) + '</span>' +
              '<span class="cv-txt">' +
                '<span class="cv-top"><b>' + l.name + '</b><span class="cv-course">' + l.course + '</span></span>' +
                '<span class="cv-desc">' + l.desc + '</span>' +
              '</span>' +
              '<span class="cv-arrow">' + U.icon("back", 16) + '</span>' +
            '</button>';
          }).join('') +
        '</div>' +
      '</div>';

    bind();
  }

  /* ---------- 事件绑定：导览按钮 → 切换栏目 ---------- */
  function bind() {
    var sec = $("sec-cover");
    if (!sec) return;
    sec.querySelectorAll("[data-goto]").forEach(function (b) {
      b.addEventListener("click", function () {
        U.showSection(b.getAttribute("data-goto"));
      });
    });
  }

  return { render: render };
})();
