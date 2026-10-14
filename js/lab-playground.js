/* ============================================================
 * lab-playground.js —— 智能体实验室（综合实战，对应 L13）
 * 学生在这里和真正的智能体对话，同时看到：
 *   感知器 → 规划器 → 记忆器 → 执行器 → 大脑 五步管线点亮。
 * 还能现场关掉某个组件，看看智能体的本领怎么变小。
 *
 * 全站统一口径（与 lab-home / lab-perception / lab-planner / agent.js 保持一致）：
 *   · 规划器 = 大脑的一项【决策职责】，是独立组件、每轮都参与，产出是“要调哪个工具、
 *     参数是什么”这个【决定】。它【不直接调用工具】——真正读懂工具接口、把参数写成
 *     tool_calls 交给执行器的是大脑。所以总装图里规划器的进线和出线都只接大脑，
 *     执行器那两条边（进/出）也都只接大脑，两者之间没有连线。
 *   · 思考模式 = 大模型的一项【能力开关】，只决定推理过程（reasoning_content）
 *     可不可见，可开可关。关掉它，规划照常发生，只是“看不见规划”。
 *   · 记忆不是第五种角色：长期记忆借 system 进来、短期对话按 user/assistant 回放、
 *     工具结果走 tool、检索片段随 user —— 信息流按这个口径标注。
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

AgentLab.LabPlayground = (function () {
  var U = AgentLab.UI;
  var $ = U.$;
  var Agent = AgentLab.Agent;

  var history = [];       // 本次对话（短期记忆）
  var busy = false;

  /* short = 方卡里显示的短名（卡片是 84px 正方形，放不下「大语言模型大脑」这种长名）；
   * name  = 全名，供轨迹区 / 步骤说明里引用。 */
  var STAGES = [
    { id: "perception", name: "感知器", short: "感知器", icon: "eye", color: "per", en: "观察 · 编码（多模态输入）" },
    /* 口径：规划器是「决策职责」，不是「思考模式」。
     * 关键词用“决策 · 拆解”，避免学生把这一步理解成“模型在思考”。 */
    { id: "planner", name: "规划器", short: "规划器", icon: "gear", color: "plan", en: "决策 · 拆解（ReAct 循环）" },
    { id: "memory", name: "记忆器", short: "记忆器", icon: "book", color: "mem", en: "上下文 · 检索（短期 + 长期 / RAG）" },
    { id: "executor", name: "执行器", short: "执行器", icon: "hand", color: "exe", en: "工具调用（Function Calling）" },
    { id: "brain", name: "大语言模型大脑", short: "大模型大脑", icon: "brain", color: "brain", en: "生成回答（LLM）" }
  ];

  /* 对话区的“试试这样问”芯片：覆盖五步管线的各种情况，方便课堂上一点就发。
   * 每条都挂一枚「用途标签」，学生一眼就知道这句在考哪一环——针对性更强。
   * 前 7 条都是「单意图、单工具、一轮结束」——正好当对照组：
   * 它们不需要拆步，所以关掉规划器也照样做得成。 */
  var SUGGESTIONS = [
    { tag: "记住我", q: "你好，我叫小明" },
    { tag: "查课表", q: "今天下午有什么课？" },
    { tag: "查天气", q: "明天会下雨吗？" },
    { tag: "算一算", q: "帮我算 25×4+10" },
    { tag: "搜一搜", q: "搜一下：长颈鹿的脖子为什么那么长" },
    { tag: "设提醒", q: "提醒我明天带美术工具" },
    { tag: "计时提醒", q: "10分后提醒我去喝水" }
  ];

  /* ---------- 多步任务示例（用来体现「规划器到底在干什么」） ----------
   * 这一句里装了 3 个子任务，而且有依赖和条件分支：
   *   ① 查明天天气 → ② 【依赖①的结果】下雨才设提醒 → ③ 另算一笔总价（可并行）
   * 关掉规划器，它就只会被规则拽去调一个工具，任务必然残缺——
   * 这正好和上面 7 条「单步就能完成」的问题形成对照。 */
  var PG_COMPLEX_TASK = "我们班明天要去杭州春游：先看看明天会不会下雨，要是下雨就提醒我带伞，再帮我算一下 3 瓶 12 元的果汁和 2 包 8 元的面包一共多少钱";

  /* ---------- 渲染 ---------- */
  function render() {
    var sec = $("sec-playground");
    var LP = AgentLab.LabPerception;
    sec.innerHTML =
      /* 页面头部：改用全站统一的 labHead()。
       * 本轮之前这里是全站唯一一处手写的 .lab-head —— 没有副标题、没有 meta 胶囊，
       * 图标靠内联渐变硬编码。补上 .lab-icon[data-color="pg"] 之后改用统一页头，
       * 七个板块的页头从同一套实现出来、口径一致。 */
      LP.labHead("pg", "robot", "智能体实验室", "把前面 12 课装成一台会自己干活的机器 · 综合实战（L13）") +

      /* 本课学习地图：先给地图、再讲细节（借鉴 ai-agent-book 每章开篇的「本章知识脉络图」）
       * 每个节点可点 → 跳到对应卡片并高亮闪烁，兼作页内导航。 */
      U.sectionMap({
        title: "先跑一遍，再动手改，最后验收",
        hint: "共 11 张卡片 · 点任意一格可直接跳过去",
        color: "pg",
        groups: [
          { label: "先跑一遍", items: [
            { t: "实时对话区", el: "pg-input", note: "随便问一句" },
            { t: "运行模式", el: "pg-mode", note: "自动/规划/问答" },
            { t: "内部工作台", el: "pg-pipe", note: "看信息怎么流" }
          ] },
          { label: "看它怎么想", items: [
            { t: "管线阶段预测", el: "pg-phase", note: "6 个案例" },
            { t: "上下文工程", el: "pg-ctx", note: "拆开真实请求体" }
          ] },
          { label: "动手改它", items: [
            { t: "关掉一个组件", el: "pg-switch", note: "现场开关" },
            { t: "全班对照实验", el: "pg-ab", note: "A组/B组" },
            { t: "多步任务示例", el: "pg-multi-steps", note: "看规划器拆步" }
          ] },
          { label: "验收它", items: [
            { t: "给智能体体检", el: "pg-eval", note: "固定题集 + 指标" },
            { t: "读轨迹找故障", el: "pg-trace", note: "可观测性" }
          ] },
          { label: "综合验收与进阶", items: [
            { t: "小测验", el: "pg-quiz", note: "10 题" },
            { t: "进阶原理课堂", el: "pg-adv-progress", note: "9 个概念" }
          ] }
        ]
      }) +

      /* 学习目标（card-pg：智能体实验室专属紫，与页头图标同色系；区别于架构实验室的 card-brain 金） */
      '<div class="lesson-goal card-pg">' +
        '<h3>' + U.icon("target", 18) + " 本课学习目标</h3>" +
        '<div class="goal-list">' +
          '<div class="goal-item"><span class="goal-num">1</span>看懂智能体的五步工作管线：感知 → 规划 → 记忆 → 执行 → 生成</div>' +
          '<div class="goal-item"><span class="goal-num">2</span>能拆开看一次真实请求的上下文（system + 历史 + 工具结果）</div>' +
          '<div class="goal-item"><span class="goal-num">3</span>会判断“关掉某个组件，任务还能不能完成”</div>' +
          '<div class="goal-item"><span class="goal-num">4</span>知道怎么评估一个智能体好不好：固定题集 + 明确指标 + 前后对比</div>' +
          '<div class="goal-item"><span class="goal-num">5</span>会读“本轮轨迹”，从记录里找出是哪一环出了故障（可观测性）</div>' +
        "</div>" +
      "</div>" +

      /* 说明：「本课导航」卡已删除。
       * 它原来的作用是承接前面 12 课 + 五步管线速览，但这两件事在页面上已经各有落点：
       * 承接关系写在页头副标题里（"把前面 12 课装成一台会自己干活的机器"），
       * 五步管线则由「内部工作台」现场点亮——导航卡只是把它们又复述了一遍。
       * 它使用的 STAGE_DUTY 常量也一并删除（STAGES 仍被工作台与实验卡使用）。 */

      '<div class="play-wrap">' +
        /* 左：对话 */
        '<div class="card chat-card">' +
          '<div class="chat-head">' +
            '<div class="chat-avatar">' + U.icon("robot", 24) + "</div>" +
            '<div style="font-weight:800">智能体小管家</div>' +
            /* 运行模式：同一套组件、同一个大脑，只改"这一轮它有多大自主权"。
             * 放在标题旁而不是设置里——它是课堂上要随手切的动作，藏起来就没人用了。
             * 三颗按钮的说明不再常驻成一条说明条，改成悬浮气泡（见 .mode-pop 与 bindModePop）：
             * 说明是"需要时再看"的内容，常驻反而把对话区挤矮。
             * 因此每颗按钮再补一个 aria-label，读屏用户不靠悬浮也能拿到同样的信息。 */
            '<div class="mode-seg" id="pg-mode" role="group" aria-label="运行模式（鼠标停在各按钮上可看说明）">' +
              '<button type="button" class="mode-btn" data-mode="auto" aria-label="自动模式：模型自己决定要不要调工具、调哪个">自动</button>' +
              '<button type="button" class="mode-btn" data-mode="plan" aria-label="规划模式：只出计划不执行工具，等学生确认">规划</button>' +
              '<button type="button" class="mode-btn" data-mode="ask" aria-label="问答模式：请求里不发工具说明书，只能凭已有知识回答">问答</button>' +
            "</div>" +
            '<button class="btn btn-ghost btn-sm" id="pg-clear" style="margin-left:auto">' + U.icon("reset", 15) + " 新对话</button>" +
          "</div>" +
          '<div class="chat-msgs" id="pg-msgs"></div>' +
          '<div class="chip-row pg-chips" id="pg-chips">' +
            SUGGESTIONS.map(function (s) {
              return '<button type="button" class="chip-suggest" data-q="' + U.esc(s.q) + '">' +
                '<span class="chip-tag is-ask">' + U.esc(s.tag) + "</span>" + U.esc(s.q) + "</button>";
            }).join("") +
            /* 多步任务单独一条，前面挂个「多步」标签——学生一眼就能挑出来试规划器。
             * 标签文字不能混进提问里，所以真正的题目单独放在 data-q 上。 */
            '<button type="button" class="chip-suggest is-multi" data-q="' + U.esc(PG_COMPLEX_TASK) + '">' +
              '<span class="chip-tag">多步</span>' + U.esc(PG_COMPLEX_TASK) + "</button>" +
          "</div>" +
          '<div class="chat-input">' +
            '<input type="text" id="pg-input" placeholder="输入你的问题，按回车发送……">' +
            '<button class="btn btn-per" id="pg-send">' + U.icon("send", 16) + " 发送</button>" +
          "</div>" +
        "</div>" +

        /* 右：管线面板 */
        '<div class="card pipe-card">' +
          '<h2 style="font-size:18px">' + U.icon("spark", 20) + ' 智能体内部工作台</h2>' +

          /* ---------- 总装图：整张卡的主角，放在最上面 ----------
           * 为什么不用竖排的「感知→规划→记忆→执行」链条：那条链的箭头只有向下一种方向，
           * 在结构上就画不出「执行器 → 大脑」的回流。而真实智能体恰恰靠这个回流工作：
           * 工具结果拼回上下文后，大脑还要再看一遍才给得出最终答案。
           * 所以改成放射状：大脑在中心，每条边都有明确方向和用途。
           *
           * 连线的位置全部由 CSS 变量算出来（--nw / --nh / --gapv / --rowc），
           * 节点定位引用的是同一组变量，两者永远同步，不会错位；
           * 端点取两个节点的中心、箭头取连线中点，中点必然落在节点之间的空隙里，
           * 所以箭头不会被挡住。 */
          '<div class="pg-hub" id="pg-pipe">' +
            '<i class="pg-hub-edge v to-down" data-edge="per-brain"></i>' +
            '<i class="pg-hub-edge h to-left" data-edge="brain-mem-out"></i>' +
            '<i class="pg-hub-edge h to-right" data-edge="brain-mem-in"></i>' +
            /* 工具调用是【大脑 → 执行器 → 大脑】的一条往返，规划器不在这条线上：
             *   brain-exe-out（右行 ①）：大脑按工具接口的要求，把函数名和参数写成
             *                            结构化输入（tool_calls）交给执行器；
             *   brain-exe-in （左行 ②）：执行器把工具返回值原样送回大脑。
             * 这里以前画的是「规划器 → 执行器」斜线，那是错的：规划器只产出
             * “要调哪个工具、参数是什么”这个【决定】，它自己不碰工具——
             * 真正发起调用、真正需要读懂工具接口的是大脑。所以执行器只跟大脑相连。
             * 两条并行横线用 ±7px 错开，和左边记忆器那一组一个道理。 */
            '<i class="pg-hub-edge h to-right" data-edge="brain-exe-out"></i>' +
            '<i class="pg-hub-edge h to-left" data-edge="brain-exe-in"></i>' +
            /* 规划器是独立组件（不是“大脑的 thinking 模式”），但它的一进一出都只接大脑：
             *   brain-plan（下行）：大脑把当前上下文交给规划器去决策；
             *   plan-brain（上行）：规划器把「要不要调工具、调哪个、参数是什么」交回大脑。
             * 所以规划器身上没有任何一条线通往执行器——决定和执行是两件事。 */
            '<i class="pg-hub-edge v to-down" data-edge="brain-plan"></i>' +
            '<i class="pg-hub-edge v to-up" data-edge="plan-brain"></i>' +
            /* ① ② 两枚步骤标签：贴在右边那条往返的两侧（上标在外、下标在内），
             * 让“模型写参数 → 工具执行 → 结果回模型”这两步一眼可见。
             * 位置由 CSS 变量算，和连线共用同一套坐标，不用 JS 现算。 */
            '<span class="pg-hub-tag" data-tag="exe-out">① 按接口写参数</span>' +
            '<span class="pg-hub-tag" data-tag="exe-in">② 结果回传</span>' +
            STAGES.map(function (s) {
              return '<div class="pg-hub-node n-' + s.color + '" data-stage="' + s.id + '" title="' + s.en + '">' +
                '<span class="pg-hub-mark"></span>' +
                '<span class="pg-hub-ico">' + U.icon(s.icon, 19) + "</span>" +
                '<span class="pg-hub-name">' + s.short + "</span>" +
                '<span class="pg-hub-round"></span>' +
              "</div>";
            }).join("") +
          "</div>" +

          '<div class="pipe-bar">' +
            '<span class="pipe-state" id="pg-state">待机</span>' +
            '<span class="pipe-legend"><i class="lg lg-done"></i>本轮参与<i class="lg lg-skip"></i>本轮未参与</span>' +
            '<button class="btn btn-ghost btn-sm" id="pg-replay">' + U.icon("refresh", 14) + " 重放本轮</button>" +
          "</div>" +

          /* ---------- 信息流动图 ----------
           * 真实智能体不是「感知→规划→记忆→执行」走一遍就完事：
           * 工具结果拼回上下文后，大脑还要<b>再看一遍</b>才给得出最终答案。
           * 所以这里单独画两样东西：① 轮次（几个 ↻）；② 每一轮真正发给大脑的消息和它们的角色。 */
          '<div class="pg-flow">' +
            '<div class="pg-engine" id="pg-engine"><span class="dim">引擎检测中…</span></div>' +
            '<div class="pg-rounds" id="pg-rounds"></div>' +
            '<div class="pg-chainwrap">' +
              '<div class="pg-chainlabel">' + U.icon("txt", 13) +
                '发给大脑的<b>上下文</b>　<span class="dim">每一块都要<b>借一个角色</b>才能进去：长期记忆借 <b>system</b>、' +
                '短期对话按 <b>user / assistant</b> 原样回放、工具结果走 <b>tool</b>。<br>' +
                '<b class="sp-obs-t">观察空间</b>＝能接收到的信息（信息进来）；<b class="sp-act-t">动作空间</b>＝被允许执行的操作（决定要做的事）</span></div>' +
              '<div class="pg-chain" id="pg-chain"><span class="pg-chain-empty">还没发请求——先在上面提一个问题</span></div>' +
            "</div>" +
          "</div>" +
          '<div class="pipe-log-head">' + U.icon("clock", 15) + ' 本轮轨迹<span id="pg-run-sum"></span></div>' +
          '<div class="pipe-log" id="pg-log"></div>' +
          '<button class="btn btn-ghost btn-sm" id="pg-inspect-btn" style="margin-top:12px;width:100%">' + U.icon("search", 16) + " 拆开看看：这一轮我给大脑发了什么（上下文）</button>" +
          '<div class="inspect-box" id="pg-inspect" style="display:none">' +
            '<div style="font-size:13px;color:var(--c-sub);margin-bottom:6px">这是真实发送给 DeepSeek 的请求，四种角色都在里面：<b>system</b>（规则 + 长期记忆档案）→ <b>user</b> 提问 → <b>assistant</b> 请求调用工具（tool_calls）→ <b>tool</b> 回传数据。看懂它，就懂了“上下文工程”。</div>' +
            '<div style="font-size:12px;color:var(--c-sub);margin-bottom:6px" id="pg-inspect-note">运行一轮后，这里会显示真实发送给 DeepSeek 的上下文。</div>' +
            '<pre id="pg-inspect-pre" style="white-space:pre-wrap;font-size:12px;line-height:1.55;background:#1e1e28;color:#d8d8e8;border-radius:12px;padding:12px;max-height:280px;overflow:auto"></pre>' +
          "</div>" +
          '<div style="font-weight:700;margin:18px 0 4px;font-size:15px">' + U.icon("target", 18) + " 现场开关组件（Harness 约束）</div>" +
          '<div style="color:var(--c-sub);font-size:13px;margin-bottom:8px">关掉一个组件再提问，看看智能体的本领会怎么变化——这就是给 Agent 加“约束”。（下面的实验会跟着一起变）</div>' +
          '<div id="pg-flags">' +
            [
              { id: "perception", label: "感知器（观察）", icon: "eye" },
              { id: "planner", label: "规划器（决策）", icon: "gear" },
              { id: "memory", label: "记忆器（上下文）", icon: "book" },
              { id: "executor", label: "执行器（调工具）", icon: "hand" }
            ].map(function (f) {
              return '<div class="toggle-row"><span class="t-label">' + U.icon(f.icon, 18) + " " + f.label + "</span>" +
                '<label class="switch"><input type="checkbox" checked data-flag="' + f.id + '"><span class="slider"></span></label></div>';
            }).join("") +
          "</div>" +
          /* 思考模式不是“第五个组件”——它是大模型的一项能力开关。
           * 单独拎出来放在下面、并用蓝底说明条区分，免得学生把它数进四组件里。
           * 它与「规划器」是两回事：关掉它，规划照常发生，只是看不见推理过程。 */
          '<div class="pg-thinkbox">' +
            '<div class="toggle-row"><span class="t-label">' + U.icon("spark", 18) + " 思考模式" +
              '<span class="pg-think-tag">模型能力开关 · 不是组件</span></span>' +
              '<label class="switch"><input type="checkbox" data-flag="thinking" id="pg-flag-thinking"><span class="slider"></span></label></div>' +
            '<div class="pg-think-note">开：模型先把推理过程写出来（<code>reasoning_content</code>），要多等一会儿；关：直接决策，更快。' +
            '<b>两种情况规划器都在工作</b>——区别只是“看不看得见推理过程”，别和上面的“关掉规划器”混为一谈。</div>' +
          "</div>" +
          '<div class="pg-flag-try">' +
            '<button class="btn btn-brain btn-sm" id="pg-flag-run">' + U.icon("send", 14) + " 用当前这套开关，真实跑一句</button>" +
            '<span id="pg-flag-tip" class="pg-flag-tip"></span>' +
          "</div>" +
        "</div>" +
      "</div>" +

      /* 配套实验（全部可自动判定） */
      AgentLab.LabPerception.card("brain", "实验：这句话会点亮哪些环节？（管线阶段预测）",
        "先预测、再对照：看一句真实提问，选出这一轮<b>真的会发生</b>的动作——每选一条，右边的管线图就跟着亮；点「检查」后还能一键<b>真实跑一遍</b>，用自己的眼睛验证。",
        '<div id="pg-phase"></div>') +

      AgentLab.LabPerception.card("brain", "实验：拆开看看——这一轮到底给大脑发了什么？（上下文工程）",
        "工作台告诉你“亮了哪几步”，这里回答“<b>每一步往上下文里放了什么东西</b>”。先把四条消息按顺序拼出来（顺序错了模型会读不懂），再和<b>真实发出的那一份请求</b>对照。",
        '<div id="pg-ctx"></div>' +
        '<div class="pg-try">' +
          '<button class="btn btn-brain btn-sm" id="pg-ctx-run">' + U.icon("send", 14) + " 真实跑一遍这句话</button>" +
          '<button class="btn btn-ghost btn-sm" id="pg-ctx-real-btn">' + U.icon("search", 14) + " 对照：真实发出的一整份请求</button>" +
          '<span class="pg-try-tip">跑过一句之后，这里显示的就是刚才那份真家伙。</span>' +
        "</div>" +
        '<div class="inspect-box" id="pg-ctx-real" style="display:none">' +
          '<div class="pg-inspect-note">下面是本轮<b>真实发送</b>的请求体。对照一下你刚才拼的四条：角色顺序一样吗？system 里带上了哪些长期记忆？tool 那条和 assistant 的 tool_calls 对得上吗？</div>' +
          '<pre id="pg-ctx-real-pre" class="pg-pre"></pre>' +
        "</div>") +

      AgentLab.LabPerception.card("brain", "实验：关掉一个组件，哪件事就做不成了？",
        "给 Agent 加约束的最直观方式，就是关掉某个组件。这里的开关与上方<b>工作台开关双向联动</b>：关掉哪个，再去点下面的动作，看还有没有人兜底。",
        '<div id="pg-switch"></div>' +
        '<div class="pg-try"><button class="btn btn-brain btn-sm" id="pg-switch-run">' + U.icon("send", 14) + ' 带着这套开关，真实跑一遍</button>' +
        '<span class="pg-try-tip">开关一变，同一句话的成败也会跟着变。</span></div>') +

      /* 全班对照实验（对应第二轮评审"四、更好的互动操作方式"第 7 条：
       * 把"关掉一个组件"从单人操作升级为全班对照——A 组关记忆、B 组关规划，
       * 同一句话先下注预测，再并排看两组各自走到哪一步、断点有什么不同。） */
      LP.card("brain", "实验：全班对照——A 组关记忆，B 组关规划，谁先卡住？",
        "把全班分成两组：<b>A 组</b>的小管家关掉记忆器，<b>B 组</b>关掉规划器，同一句话交给两组。先各自下注预测自己那一组会怎样，再点「走一步」并排看结果——注意看：<b>两组都做不成，但断的地方不一样</b>。",
        U.predict({
          id: "pg-ab",
          color: "brain",
          q: "同一句话「上次说的那个提醒，帮我改成周五下午 4 点」——哪一组会先卡住？",
          opts: [
            { k: "a", t: "A 组（关记忆）先卡住：它不知道“上次那个提醒”指什么" },
            { k: "b", t: "B 组（关规划）先卡住：它记得住，但不知道要分几步做" },
            { k: "c", t: "两组都会卡，但卡的地方不一样" }
          ],
          ans: "c",
          why: "两组都会卡，但<b>卡的地方不一样</b>：A 组缺的是「记忆」——它连对象都认不出来，只能反问用户；B 组缺的是「规划」——它有记忆、也知道该做什么，却理不出「先查 → 再改 → 再确认」的步骤，直接把话丢给工具，参数凑不齐。四样零件是<b>串联</b>的，缺哪一样都会断在它那一段。",
          hint: "先看这句话里的两处依赖：「上次那个提醒」要记忆，「改成周五下午 4 点」要分步。哪一组各缺一样？"
        }) +
        '<div id="pg-ab"></div>') +

      /* 多步任务示例：专门用来体现「规划器」到底在干什么。
       * 两条路都留着：离线逐步演示（内置轨迹，教室环境不依赖 API Key）+ 一键真实跑同一句话。
       * 前面 7 条建议都是单意图单工具 —— 正好当对照组：那种题关掉规划器也做得成。 */
      LP.card("plan", "实验：一句话里三件事——规划器是怎么拆的？",
        "前面那几条示例都是「一句话、一个工具、一轮结束」，看不出规划器在忙什么。换一句真正的<b>多步任务</b>：它要<b>拆成 3 个子任务</b>、排出先后顺序，还要<b>看着中间结果决定下一步</b>。先点「逐步演示（离线）」一步步看清规划器怎么指挥（<b>不用 API Key</b>），再点「真实跑一遍这句话」让它自己跑给你看。",
        '<div class="pg-multi-task">' + U.icon("txt", 13) +
          "<span><b>任务：</b>" + U.esc(PG_COMPLEX_TASK) + "</span></div>" +
        '<div class="pg-try">' +
          '<button class="btn btn-plan btn-sm" id="pg-multi-demo">' + U.icon("spark", 14) + ' 逐步演示（离线）</button>' +
          '<button class="btn btn-ghost btn-sm" id="pg-multi-step">' + U.icon("target", 14) + ' 走一步</button>' +
          '<button class="btn btn-ghost btn-sm" id="pg-multi-reset">' + U.icon("reset", 14) + ' 重来</button>' +
          '<button class="btn btn-brain btn-sm" id="pg-multi-run">' + U.icon("send", 14) + ' 真实跑一遍这句话</button>' +
          '<span class="pg-try-tip" id="pg-multi-count"></span>' +
        "</div>" +
        '<div class="pg-multi-steps" id="pg-multi-steps"></div>') +

      AgentLab.LabPerception.card("brain", "实验：给智能体做一次“体检”（评估——固定题集 + 指标 + 前后对比）",
        "老师改了一版小管家，怎么知道它到底<b>变好了还是变坏了</b>？靠“感觉”不算——用同一份<b>固定题集</b>跑两个版本，把结果填进同一张<b>指标表</b>里对比。",
        '<div id="pg-eval"></div>') +

      AgentLab.LabPerception.card("brain", "实验：读轨迹，找故障（可观测性 / Trace）",
        "智能体出错时不会自己说“我第 3 步错了”。工程师靠的是<b>轨迹（Trace）</b>——每一步都留下记录，才能倒推是哪一环出的问题。来看几段真实风格的轨迹，判断故障出在哪一环。",
        '<div id="pg-trace"></div>') +

      /* 小测验 */
      AgentLab.LabPerception.card("brain", "小测验：综合验收——你是智能体小达人吗？",
        "共 " + PG_QUIZ.length + " 题，覆盖 Agent 公式、循环、Harness、上下文工程、评估与可观测性、人在环、多智能体。答对一题加一颗星！",
        '<div class="game-box" id="pg-quiz"><div id="pg-quiz-body"></div></div>' +
        '<div class="score-line"><span class="score-badge" id="pg-quiz-score" data-score="0">★ 0</span><button class="btn btn-ghost btn-sm" id="pg-quiz-restart">重来</button></div>') +

      /* 进阶原理互动课堂 */
      AgentLab.LabPerception.card("brain", "进阶原理互动课堂：智能体在真实 AI 系统里是什么？（ai-agent-book 第 1/7/9/10 章）",
        "9 个真实工程概念（ai-agent-book 第 1/7/9/10 章）：<b>左边选概念，右边看讲解 + 动手实验</b>——每个都配「一句话 / 打个比方 / 真实系统 / 动手做 / 自检一问」，还能一键跳回上面做过的实验。",
        '<div class="pg-adv-progress" id="pg-adv-progress"></div>' +
        AgentLab.Adv.panelHTML({ key: "brain", concepts: pgConcepts() })) +

      /* 课堂小结：全课最末，结构与另外六页完全一致——不带编号的 .lesson-summary。
       * 本轮之前它是全站唯一一张"被编号的小结卡"（card 包装 + 圈码），与其余六页口径不同；
       * 现在改成裸块，并换上智能体实验室的专属紫 card-pg，标题也从"核心结论"改成课次名。 */
      '<div class="lesson-summary card-pg">' +
        '<h3>' + U.icon("check", 18) + " 课堂小结（L13 综合实战）</h3>" +
        '<div class="summary-core"><b>智能体 = LLM + 上下文 + 工具</b>，由 <b>Harness</b> 把它编排成一个能自我循环的系统：观察 → 推理 → 行动 → 再观察。四个组件各管一段：感知器把世界变成上下文，规划器决定怎么做，记忆器决定记住什么，执行器把决定变成真实动作。判断它好不好，不能靠“感觉”，要靠<b>固定题集 + 明确指标 + 前后对比</b>；出了错，要靠<b>轨迹</b>倒推是哪一环的问题。<br><b>最后再钉一遍口径：</b>“规划器”是<b>决策职责</b>（每轮都参与，产出是动作）；“思考模式”是<b>模型的能力开关</b>（只决定推理过程可不可见）。关掉思考模式≠关掉规划器——前者只是“看不见规划”，后者才是“不由模型规划”。</div>' +
        '<div class="summary-points">' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-pg)">' + U.icon("refresh", 14) + '</span><div><b>循环是关键：</b>能不能“看结果再决策”，是智能体与聊天机器人的分界线</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-pg)">' + U.icon("link", 14) + '</span><div><b>组件是串联的：</b>A 组关记忆、B 组关规划，两组都做不成——但<b>断点不同</b>：记忆断在“认不出对象”，规划断在“变不成步骤”。缺一段 = 断整条链</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-pg)">' + U.icon("shield", 14) + '</span><div><b>Harness 是护栏：</b>上下文、工具接口、约束、验证、纠正、审计——都在模型外面</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-pg)">' + U.icon("target", 14) + '</span><div><b>评估是方向盘：</b>没有固定题集和指标，就不知道改动到底是在变好还是变坏</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-pg)">' + U.icon("microscope", 14) + '</span><div><b>轨迹是显微镜：</b>每一步都留下记录，出错时才能查出是感知、规划、记忆还是执行的问题</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-pg)">' + U.icon("lock", 14) + '</span><div><b>危险动作要人点头：</b>删数据、发消息、花钱这类事，先问人再执行——这就是“人在环”</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-pg)">' + U.icon("users", 14) + '</span><div><b>团队看任务：</b>能清晰拆成独立子任务才值得上多智能体；简单任务一个人更快更省</div></div>' +
        "</div>" +
        '<div class="summary-think"><b>课后思考：</b>如果让你给班级小管家再加一个组件，你会加什么？（提示：想想现在还有哪件事它做不好）加之前先想清楚：<b>能测出它变好了吗？</b></div>' +
      "</div>";

    bind();

    /* 配套实验 + 小测验 + 进阶原理互动课堂 */
    bindPgPhase();
    bindPgCtx();
    bindPgSwitch();
    bindPgAb();      /* 全班对照实验：A 组关记忆 / B 组关规划 */
    bindPgMulti();   /* 多步任务示例：离线逐步演示 + 真机实跑 */
    bindPgEval();
    bindPgTrace();
    bindPgQuiz();
    bindPgAdv();
  }

  /* ---------- 对话区 ---------- */
  /* 气泡正文的渲染口径：
   *   用户自己打的字 = 纯文本（转义后只还原换行）——学生输入的是题目，不是文档；
   *   AI 的回答     = Markdown（U.md 先整体转义 HTML 再解析语法，天然防注入）。
   * 所以气泡统一支持 Markdown：标题、粗体、列表、表格、代码块、公式都能正确显示。 */
  function msgBodyHTML(role, text) {
    if (text == null || text === "") return "";
    if (role === "user") return U.esc(text).replace(/\n/g, "<br>");
    return '<div class="md-body">' + U.md(text) + "</div>";
  }

  function addMsg(role, text, extraClass) {
    var box = $("pg-msgs");
    var d = document.createElement("div");
    d.className = "msg " + (role === "user" ? "user" : "ai") + (extraClass ? " " + extraClass : "");
    d.innerHTML = '<span class="who">' + (role === "user" ? "我" : "智能体小管家") + "</span>" +
      msgBodyHTML(role, text);
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    return d;
  }

  /* ---------- 内部工作台：三态（run 进行中 / done 已完成 / skip 本轮未参与）+ 本轮轨迹 ----------
   * 设计意图：一轮结束后工作台要“留下证据”——哪些环节真的参与了、各花了多久、
   * 每一步具体做了什么。学生一眼就能看出“这一轮执行器没被用上”。 */
  var stageState = {};      // id → { status, text, ms, t0, round }
  var stepLog = [];         // 有序事件流：[{ id, round, text, skip, at }]——轨迹区靠它渲染
  var stepIdx = {};         // id → 该组件最后一条事件在 stepLog 里的下标（去重用）
  var activeStage = null;
  var runStartAt = 0;
  var replayTimer = null;

  /* 每个 stage 触发时应该点亮哪几条边——这是「信息流」的映射表。
   * 注意执行器这一行：进线是 brain-exe-out（大脑把参数写好后交给它），
   * 出线是 brain-exe-in（工具结果回流给大脑）——两条都连大脑，没有一条来自规划器。 */
  var STAGE_EDGES = {
    perception: ["per-brain"],
    memory: ["brain-mem-out", "brain-mem-in"],
    executor: ["brain-exe-out", "brain-exe-in"],
    /* 规划器是独立组件：大脑把上下文交给它（下行）、它把决策交回大脑（上行）。
     * 它只产出「要调哪个工具、参数是什么」这个决定，不碰工具，所以没有通往执行器的边。 */
    planner: ["brain-plan", "plan-brain"],
    brain: ["per-brain", "brain-mem-out", "brain-mem-in", "brain-exe-out", "brain-exe-in", "brain-plan", "plan-brain"]
  };

  /* ReAct 三步的呈现口径：与规划器实验室「核心演示：ReAct 循环」那张卡完全一致
   * （思考 Thought → 行动 Action → 观察 Observation），学生两页看到的是同一套语言。 */
  var REACT_META = {
    think:   { label: "思考", en: "Thought",     icon: "brain", color: "plan" },
    act:     { label: "行动", en: "Action",      icon: "gear",  color: "per"  },
    observe: { label: "观察", en: "Observation", icon: "eye",   color: "mem"  },
    deliver: { label: "交付", en: "Deliver",     icon: "check", color: "brain"},
    stop:    { label: "停止", en: "Stop",        icon: "flag",  color: "exe"  }
  };

  function stageNode(id) { return document.querySelector('.pg-hub-node[data-stage="' + id + '"]'); }

  function resetStages() {
    if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
    STAGES.forEach(function (s) {
      stageState[s.id] = { status: "idle", text: s.en, ms: 0, t0: 0 };
    });
    stepLog = []; stepIdx = {};
    activeStage = null;
    runStartAt = 0;
    paintStages();
    paintLog();
  }

  function paintStages() {
    STAGES.forEach(function (s) {
      var el = stageNode(s.id);
      if (!el) return;
      var st = stageState[s.id] || { status: "idle", text: s.en };
      el.classList.toggle("is-run", st.status === "run");
      el.classList.toggle("is-done", st.status === "done");
      el.classList.toggle("is-skip", st.status === "skip");
      var used = st.status === "done" || st.status === "run";
      var rd = el.querySelector(".pg-hub-round");
      if (rd) {
        rd.textContent = used && st.round ? "R" + st.round : "";
        rd.style.display = rd.textContent ? "" : "none";
      }
      var mk = el.querySelector(".pg-hub-mark");
      if (mk) mk.textContent = st.status === "done" ? "✓" : st.status === "skip" ? "–" : st.status === "run" ? "●" : "";
    });
    paintEdges();
  }

  /* 连线高亮：某个组件参与过，它牵出的那几条边就亮（大脑参与＝所有边）。
   *
   * 但"大脑参与＝所有边"会带出一个矛盾：大脑一亮就把执行器那两条边也点亮了，
   * 于是「执行器：本轮未参与」和「① 按接口写参数 / ② 结果回传正亮着」同时出现在屏幕上，
   * 看上去像信息真的流过去了。所以最后统一收一次尾：
   * 【本轮状态是 skip 的环节，它名下的边一律不亮】。
   * 两个条件互斥（skip 与 run/done 不会同时成立），所以某个环节后面轮次真的参与了，
   * 状态一变回 run/done，它的边就照常亮起来——不会把"后面用上了"误伤成不亮。 */
  function paintEdges() {
    var on = {}, off = {};
    STAGES.forEach(function (s) {
      var st = stageState[s.id] || {};
      if (st.status === "skip") {
        (STAGE_EDGES[s.id] || []).forEach(function (e) { off[e] = true; });
      }
      if (st.status === "run" || st.status === "done") {
        (STAGE_EDGES[s.id] || []).forEach(function (e) { on[e] = true; });
      }
    });
    document.querySelectorAll(".pg-hub-edge").forEach(function (el) {
      var id = el.getAttribute("data-edge");
      el.classList.toggle("is-on", !!on[id] && !off[id]);
    });
    /* ① ② 两枚标签跟着自己那条边一起亮/暗：
     * 标签讲的是"这条边在干什么"，边没走过就不该显得那么肯定。 */
    var TAG_EDGE = { "exe-out": "brain-exe-out", "exe-in": "brain-exe-in" };
    document.querySelectorAll(".pg-hub-tag").forEach(function (el) {
      var eid = TAG_EDGE[el.getAttribute("data-tag")];
      el.classList.toggle("is-on", !!on[eid] && !off[eid]);
    });
  }

  /* 记一条事件进有序流。轨迹区要按「第几轮 → 做了什么」分组，
   * 而 stageState 只存每个组件的“最后一句话”，序列信息会丢，所以必须另存一份流。 */
  function pushStep(id, text, skip, round) {
    var at = runStartAt ? Date.now() - runStartAt : 0;
    var prev = stepIdx[id] !== undefined ? stepLog[stepIdx[id]] : null;
    /* 同一组件、同一轮、文字没变的重复触发不重复记（比如重放会反复调 setStage） */
    if (prev && prev.round === (round || 0) && prev.text === (text || "") && prev.skip === !!skip) return;
    stepLog.push({ id: id, round: round || 0, text: text || "", skip: !!skip, at: at });
    stepIdx[id] = stepLog.length - 1;
  }

  /* ---------- 信息流动图：引擎 + 轮次 + 上下文角色链 ---------- */

  var engineMode = "";        // "llm" | "rules" | "ask"
  var engineInfo = null;      // { plannerOff, noKey } —— 引擎条要说清"这一轮到底谁在决策"
  var roundLog = [];          // [{ n, notes: [], ctx }]
  var chainMsgs = [];         // 当前上下文的角色序列
  var lastRun = { rounds: 0, tools: 0, engine: "" };

  function shortNote(t) {
    var s = String(t || "")
      .replace(/^第\d+轮[:：]?\s*/, "")
      .replace(/【降级】|【规划器已关闭】/g, "");
    return s.length > 46 ? s.slice(0, 46) + "…" : s;
  }

  function paintEngine() {
    var el = $("pg-engine");
    if (!el) return;
    if (!engineMode) { el.innerHTML = '<span class="dim">引擎检测中…</span>'; return; }
    /* 离线演示：下面是内置轨迹在放，没有真的发请求，必须说清楚 */
    if (engineInfo && engineInfo.demo) {
      el.className = "pg-engine is-demo";
      el.innerHTML = U.icon("spark", 14) +
        ' <b>离线演示 · 内置轨迹回放</b><br>' +
        '<span class="dim">这条轨迹是<b>预先写好</b>的，用来逐步看清规划器怎么拆步、排序、按结果决定下一步，<b>不需要 API Key</b>。' +
        '想看真实运行，点卡片里的「真实跑一遍这句话」。</span>';
      return;
    }
    var llm = engineMode === "llm";
    var isAsk = engineMode === "ask";
    var plannerOff = !!(engineInfo && engineInfo.plannerOff);
    var cls = isAsk ? "is-ask" : (llm ? "is-llm" : (plannerOff ? "is-plan-off" : "is-rules"));
    el.className = "pg-engine " + cls;
    if (isAsk) {
      el.innerHTML = U.icon("robot", 14) +
        ' <b>问答模式 · 请求里没有工具</b><br>' +
        '<span class="dim">发给大脑的请求里<b>根本没有 tools 字段</b>——它不知道有什么工具可用，' +
        '“能做什么”这一项等于被拿掉了：只能凭自己学过的知识回答，' +
        '也就进不了“调工具 → 看结果 → 再决策”的回路（连第 1 轮都不用循环）。' +
        '把同一个问题切到「自动」模式再问一遍，差别一眼可见。</span>';
    } else if (llm) {
      el.innerHTML = U.icon("brain", 14) +
        ' <b>真实模式 · LLM 驱动 Function Calling</b>';
    } else if (plannerOff) {
      el.innerHTML = U.icon("gear", 14) +
        ' <b>规划器已关闭 · 规则代劳决策</b><br>' +
        '<span class="dim">你把「规划器」关了，所以<b>这次不由模型决定要不要调工具、调哪个</b>——' +
        '改由本地规则做<b>单步</b>判定，模型只负责把工具结果组织成一句人话。' +
        '它会漏掉需要拆步、需要先后依赖的任务（这正是“关掉规划器”的样子）。</span>';
    } else {
      el.innerHTML = U.icon("wrench", 14) +
        ' <b>降级模式 · 未配置 API Key</b><br>' +
        '<span class="dim">大模型调不动，<b>规划改由本地规则代劳，不是大脑自己决定的</b>。' +
        '回路结构照常演示，便于看清流程。要切到真实模式，点右上角「设置」填一个 Key。</span>';
    }
  }

/* ReAct 步骤 → 该点亮的组件。
 * 思考/行动是规划器的产出（在大脑里想、想完就去调），观察是执行器的产物。 */
  var REACT_OWNER = { think: "planner", act: "planner", observe: "executor", deliver: "brain", stop: "brain" };

  /* 记一条 ReAct 步骤。kind ∈ think / act / observe / deliver / stop。
   * 同一轮同一 kind 只保留第一条（重放会反复触发，避免轨迹被重复行撑爆）。 */
  function pushReact(kind, round, text, picks) {
    var m = REACT_META[kind];
    if (!m) return;
    var key = (round || 0) + ":" + kind;
    for (var i = 0; i < stepLog.length; i++) {
      if (stepLog[i].reactKey === key) {
        if (text && !stepLog[i].text) stepLog[i].text = text;
        if (picks && !stepLog[i].picks) stepLog[i].picks = picks;
        paintLog();
        return;
      }
    }
    var at = runStartAt ? Date.now() - runStartAt : 0;
    stepLog.push({
      id: REACT_OWNER[kind] || "brain",
      round: round || 0, text: text || "", skip: false, at: at,
      kind: kind, reactKey: key, picks: picks || null
    });
    /* 同时点亮对应组件：规划器的三步各有归属，图上的关系才立得住 */
    setStage(REACT_OWNER[kind] || "brain", text || m.label, null, round, true);
    paintLog();
  }

  function ensureRound(n) {
    if (!n || n < 1) return null;
    var last = roundLog[roundLog.length - 1];
    if (!last || last.n !== n) roundLog.push({ n: n, notes: [], ctx: 0 });
    return roundLog[roundLog.length - 1];
  }

  function addRoundNote(n, text) {
    var r = ensureRound(n);
    if (!r) return;
    var s = shortNote(text);
    if (s && r.notes.indexOf(s) < 0) r.notes.push(s);
    paintRounds();
  }

  function setRoundCtx(n, len) {
    var r = ensureRound(n);
    if (r) { r.ctx = len; paintRounds(); }
  }

  function paintRounds() {
    var box = $("pg-rounds");
    if (!box) return;
    if (!roundLog.length) {
      box.innerHTML = '<div class="pg-flow-empty">跑一轮就能看到“大脑和工具来回交涉”的次数——每多一个 ↻，大脑就多重新规划一次</div>';
      return;
    }
    box.innerHTML = roundLog.map(function (r, i) {
      var last = i === roundLog.length - 1;
      var note = r.notes.slice(0, 2).join("；");
      return '<div class="pg-round ' + (last ? "is-now" : "is-done") + '">' +
        '<span class="pgn">第 ' + r.n + ' 轮</span>' +
        '<span class="pgw">' + U.esc(note) + "</span>" +
        (r.ctx ? '<span class="pgc">' + r.ctx + " 条消息</span>" : "") +
        "</div>" +
        (last ? "" :
          '<div class="pg-loop">' + U.icon("refresh", 13) +
          '工具结果作为 <code>tool</code> 角色拼回上下文 → <b>大脑再看一遍</b></div>');
    }).join("");
  }

  /* 把当前上下文画成一条角色链：这是“给记忆片段一个角色”最直观的证据 */
  function setChain(messages) {
    chainMsgs = (messages || []).slice();
    paintChain();
  }

  function msgLabel(m) {
    if (m.role === "system") return "system · 规则+长期记忆";
    if (m.role === "tool") return "tool · 工具结果";
    if (m.role === "assistant" && m.tool_calls) return "assistant · 要调工具";
    if (m.role === "assistant") return "assistant · 最终答案";
    return m.role;
  }

  /* 每块上下文属于哪个“空间”？口径取自感知器实验室：
   *   观察空间 = AI 能接收到的信息 —— system / user / tool 都算“信息进来”；
   *   动作空间 = AI 被允许执行的操作 —— assistant 决定要调工具、或对外作答，都是“动作”。
   * 把这枚标签挂在角色链上，学生一眼就能看出：规划器的产出落在动作空间。 */
  function msgSpace(m) { return m.role === "assistant" ? "act" : "observe"; }
  var SPACE_TXT = { observe: "观察", act: "动作" };
  var SPACE_TIP = {
    observe: "观察空间：AI 能接收到的信息（你的输入、记忆、工具返回）",
    act: "动作空间：AI 被允许执行的操作（调工具、对外作答）"
  };

  function paintChain() {
    var box = $("pg-chain");
    if (!box) return;
    if (!chainMsgs.length) {
      box.innerHTML = '<span class="pg-chain-empty">还没发请求——先在上面提一个问题</span>';
      return;
    }
    box.innerHTML = chainMsgs.map(function (m, i) {
      var cls = "r-" + m.role + (m.tool_calls ? " r-call" : "");
      var sp = msgSpace(m);
      var tip = String(m.content == null ? "" : m.content).replace(/\s+/g, " ").slice(0, 140);
      return '<span class="pg-msg ' + cls + (i === chainMsgs.length - 1 ? " is-last" : "") +
        '" title="' + U.esc(tip) + '">' + U.esc(msgLabel(m)) +
        '<i class="pg-sp sp-' + sp + '" title="' + U.esc(SPACE_TIP[sp]) + '">' + SPACE_TXT[sp] + "</i>" +
        "</span>";
    }).join('<span class="pg-chain-arrow">→</span>');
  }

  function resetFlow() {
    engineMode = ""; engineInfo = null; roundLog = []; chainMsgs = [];
    lastRun = { rounds: 0, tools: 0, engine: "" };
    paintEngine(); paintRounds(); paintChain();
  }

  /* 这里原来有一个 layoutHubDiag()：给「规划器 → 执行器」那条斜边按节点实际位置
   * 现算长度与角度，还要挂一个 ResizeObserver 在窄屏重排时重算。
   * 那条斜边已经从图上删掉了（规划器不直接调用工具，执行器只跟大脑相连），
   * 现在所有连线都是纯横/竖的，位置能由 --nw / --nh / --rowc / --side 这些
   * CSS 变量直接算出来，不需要 JS 参与，所以整套函数和观察器一并删除。 */

  /* 顶部的四组件语义色，多步示例卡片里也用同一套，保证全站配色一致 */
  var PG_COLOR_VAR = { perception: "per", planner: "plan", memory: "mem", executor: "exe", brain: "brain" };

  /* ---------- 多步任务的离线轨迹 ----------
   * 这是「逐步演示」用的内置数据，不调用任何接口，所以课堂上一定跑得出来。
   * 每一步都标清四件事：谁在做（stage）、内容落在哪个空间（space）、
   * 这一步往上下文里塞的是什么角色（role）、具体发生了什么（t）。
   * 顺着看一遍，规划器“拆 → 排 → 调 → 看结果 → 再决定”就一目了然了。 */
  var PG_COMPLEX_DEMO = [
    { stage: "perception", react: "", space: "observe", role: "user", round: 0,
      t: "把同学的请求接进来，整理成一条 user 消息——这是观察空间的入口。" },
    { stage: "memory", react: "", space: "observe", role: "system", round: 0,
      t: "长期记忆借 system 角色一起给：班级知识库、你住在杭州、出游要带伞这些偏好。" },
    { stage: "planner", react: "think", space: "act", role: "assistant", round: 1,
      t: "规划器拆成 3 个子任务并排序：①查明天天气 → ②【要看①的结果】下雨才设提醒 → ③另外算一笔总价（可以和①一起做）。" },
    { stage: "planner", react: "act", space: "act", role: "assistant", round: 1,
      t: "第 1 轮动作：调用 weather_query(city=杭州, dateKey=明天)——先做最要紧、后面还要依赖它的那一步。" },
    { stage: "executor", react: "observe", space: "observe", role: "tool", round: 1,
      t: "执行器真正去调天气工具，结果以 tool 角色回流到上下文：杭州 · 明天 · 小雨。" },
    { stage: "planner", react: "think", space: "act", role: "assistant", round: 2,
      t: "大脑带着 tool 结果重新规划第 2 轮：①的结果是“下雨”，所以②的提醒必须设；③的总价可以一起算——这一步就是“按结果决定下一步”。" },
    { stage: "planner", react: "act", space: "act", role: "assistant", round: 2,
      t: "第 2 轮动作：一次发出两条 tool_calls——reminder_set(带雨伞) 和 calculator(3×12+2×8)。" },
    { stage: "executor", react: "observe", space: "observe", role: "tool", round: 2,
      t: "两个工具的结果都作为 tool 角色回流到上下文（52 元）。" },
    { stage: "brain", react: "deliver", space: "act", role: "assistant", round: 2,
      t: "大脑把 3 个子任务的结果汇总成一句人话：明天下雨记得带伞；果汁 36 元、面包 16 元，一共 52 元。全程 2 轮、3 次工具调用、1 次条件分支。" }
  ];

  var multiIdx = 0;
  var multiTimer = null;

  /* 把已经走到第几步，同步成「上下文里现在有哪些角色」——
   * 和真实跑一轮时 pg-chain 的呈现口径完全一致（system 常驻、每轮一对 assistant/tool）。 */
  function multiSyncChain() {
    var acts = 0, obs = 0;
    for (var i = 0; i < multiIdx; i++) {
      var r = PG_COMPLEX_DEMO[i].react;
      if (r === "act") acts++;
      if (r === "observe") obs++;
    }
    var msgs = [
      { role: "system", content: "规则 + 班级长期记忆（借 system 角色进来）" },
      { role: "user", content: PG_COMPLEX_TASK }
    ];
    var rounds = Math.max(acts, obs);
    for (var k = 1; k <= rounds; k++) {
      if (k <= acts) msgs.push({ role: "assistant", tool_calls: [{ id: "call_" + k }], content: "第 " + k + " 轮动作：发出 tool_calls" });
      if (k <= obs) msgs.push({ role: "tool", content: "第 " + k + " 轮的工具结果回流" });
    }
    if (multiIdx >= PG_COMPLEX_DEMO.length) msgs.push({ role: "assistant", content: "最终回答（汇总 3 个子任务）" });
    setChain(msgs);
  }

  function multiRender() {
    var box = $("pg-multi-steps");
    if (!box) return;
    if (!multiIdx) {
      box.innerHTML = '<div class="pg-ms-empty">' + U.icon("target", 14) +
        " 点「逐步演示（离线）」，看规划器怎么把这一句话拆成 3 个子任务；也可以自己点「走一步」。</div>";
    } else {
      box.innerHTML = PG_COMPLEX_DEMO.slice(0, multiIdx).map(function (s, i) {
        var sp = s.space === "act" ? "act" : "observe";
        var col = PG_COLOR_VAR[s.stage] || "brain";
        var isLast = i === multiIdx - 1;
        return '<div class="pg-ms ' + (isLast ? "is-cur" : "is-on") + '">' +
          '<span class="pg-ms-n c-' + col + '">' + (i + 1) + "</span>" +
          '<span class="pg-ms-body">' +
            '<span class="pg-ms-head">' +
              '<b class="pg-ms-who c-' + col + '">' + U.esc(STAGE_BY_ID[s.stage].name) + "</b>" +
              '<i class="pg-sp sp-' + sp + '">' + SPACE_TXT[sp] + "</i>" +
              '<i class="pg-ms-role">借 ' + U.esc(s.role) + " 角色</i>" +
            "</span>" +
            '<span class="pg-ms-t">' + U.esc(s.t) + "</span>" +
          "</span></div>";
      }).join("");
    }
    var cnt = $("pg-multi-count");
    if (cnt) cnt.textContent = multiIdx ? "第 " + multiIdx + " / " + PG_COMPLEX_DEMO.length + " 步" : "";
  }

  function multiReset() {
    if (multiTimer) { clearTimeout(multiTimer); multiTimer = null; }
    multiIdx = 0;
    resetStages();
    resetFlow();
    multiRender();
  }

  function multiStep() {
    if (multiIdx >= PG_COMPLEX_DEMO.length) { U.toast("这条轨迹已经走完啦，点「重来」可以再看一遍"); return; }
    var s = PG_COMPLEX_DEMO[multiIdx];
    multiIdx++;
    /* 离线演示：先把引擎条切成“内置轨迹回放”，免得学生以为后台真的在跑 */
    engineMode = "llm"; engineInfo = { demo: true }; paintEngine();
    /* 和真实跑一轮走同一套接口：ReAct 步骤进轨迹、组件点亮、角色链同步 */
    if (s.react) pushReact(s.react, s.round, s.t);
    else setStage(s.stage, s.t, null, s.round);
    multiSyncChain();
    multiRender();
    if (multiIdx >= PG_COMPLEX_DEMO.length) endRun();
  }

  function multiPlay() {
    if (busy) { U.toast("正在真实运行，等它跑完再演示～"); return; }
    multiReset();
    var tick = function () {
      if (multiIdx >= PG_COMPLEX_DEMO.length) { multiTimer = null; return; }
      multiStep();
      multiTimer = setTimeout(tick, 1200);
    };
    tick();
  }

  /* 轨迹区：按「第几轮 → 这一轮做了什么」分组。
   * 总装图只负责画拓扑和流向，顺序信息全部交给这里——
   * 所以它必须读有序事件流 stepLog，而不是从 stageState 反推（那样会丢顺序）。 */
  var STAGE_BY_ID = (function () {
    var m = {};
    STAGES.forEach(function (s) { m[s.id] = s; });
    return m;
  })();

  /* 「规划器怎么选到这个工具」的三步依据——口径取自规划器实验室
   * 「互动：工具选择决策」那张卡：① 理解意图 ② 匹配能力 ③ 构造参数。
   * 默认折叠：主线保持清爽，想深究的学生自己展开。 */
  function picksHTML(picks) {
    if (!picks || !picks.length) return "";
    return picks.map(function (p) {
      var steps = (p.steps || []).map(function (s) {
        return '<div class="pg-pick-step"><span class="pg-pick-k">' + U.esc(s[0]) + "</span>" +
          '<span class="pg-pick-v">' + U.esc(s[1]) + "</span></div>";
      }).join("");
      return '<details class="pg-pick">' +
        '<summary>' + U.icon("search", 12) + ' 规划器为什么选它？三步依据</summary>' +
        '<div class="pg-pick-body">' +
          (p.fn ? '<div class="pg-pick-fn">选中：<code>' + U.esc(p.fn) + "</code></div>" : "") +
          steps +
        "</div></details>";
    }).join("");
  }

  function paintLog() {
    var box = $("pg-log");
    if (!box) return;
    if (!stepLog.length) {
      box.innerHTML = '<div class="pg-log-empty">还没有运行记录——在上面提一个问题，这里会按轮次记下每一步具体做了什么。</div>';
      var s0 = $("pg-run-sum");
      if (s0) s0.textContent = "";
      return;
    }

    // 按轮次分组（round 0 是接入阶段，单列在最前）
    var order = [], groups = {};
    stepLog.forEach(function (st) {
      var k = st.round || 0;
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(st);
    });

    var html = order.sort(function (a, b) { return a - b; }).map(function (k) {
      var label = k === 0 ? "接入" : "第 " + k + " 轮";
      var rows = groups[k].map(function (st) {
        var ms = "+" + (st.at ? (st.at / 1000).toFixed(1) : "0.0") + "s";

        /* ReAct 步骤：用「思考/行动/观察」的徽标起头，和规划器实验室同一套语言 */
        if (st.kind && REACT_META[st.kind]) {
          var m = REACT_META[st.kind];
          return '<div class="pg-log-row react r-' + m.color + (st.skip ? " is-skip" : "") + '">' +
            '<span class="pg-log-dot">' + U.icon(m.icon, 13) + "</span>" +
            '<span class="pg-log-body">' +
              '<b class="react-tag">' + m.label + "<i>" + m.en + "</i></b>" +
              U.esc(st.text || "") +
              picksHTML(st.picks) +
            "</span>" +
            '<span class="pg-log-ms">' + ms + "</span>" +
            "</div>";
        }

        var s = STAGE_BY_ID[st.id] || { name: st.id, icon: "gear", color: "brain" };
        return '<div class="pg-log-row c-' + s.color + (st.skip ? " is-skip" : "") + '">' +
          '<span class="pg-log-dot">' + U.icon(s.icon, 13) + "</span>" +
          '<span class="pg-log-body"><b>' + s.name + "</b>" + U.esc(st.text || "") + "</span>" +
          '<span class="pg-log-ms">' + ms + "</span>" +
          "</div>";
      }).join("");
      return '<div class="pg-log-round"><span class="pglr">' + label + "</span>" + rows + "</div>";
    }).join("");

    box.innerHTML = html;
    var sum = $("pg-run-sum");
    if (sum) {
      var rounds = order.filter(function (k) { return k > 0; }).length;
      var last = stepLog[stepLog.length - 1];
      sum.textContent = "共 " + stepLog.length + " 步 · " + rounds + " 轮 · " +
        lastRun.tools + " 次工具调用 · " + (last && last.at ? (last.at / 1000).toFixed(1) + " 秒" : "");
    }
  }

  /**
   * @param {string} [flag] 传 "skip" 表示这一环本轮不参与（例如本轮不需要调用工具）
   * @param {number} [round] 第几轮参与的（0 = 本轮之前的一次性准备；无 = 不参与循环）
   * @param {boolean} [silent] true = 只点亮节点、不往轨迹里记（ReAct 步骤自己记，避免重复行）
   */
  function setStage(id, text, flag, round, silent) {
    var now = Date.now();
    if (!runStartAt) runStartAt = now;
    if (!stageState[id]) stageState[id] = { status: "idle", text: "", ms: 0, t0: 0 };
    if (round) {
      addRoundNote(round, text);
      if (id === "memory" || id === "brain") {
        var mm = String(text || "").match(/(\d+)\s*条/);
        if (mm) setRoundCtx(round, parseInt(mm[1], 10));
      }
    }
    if (flag === "skip") {
      // 不点亮、不算耗时，只把“为什么没用上”记下来
      if (stageState[id].status === "idle") {
        stageState[id].status = "skip";
        if (text) stageState[id].text = text;
        if (!silent) pushStep(id, text, true, round);
      }
      paintStages();
      paintLog();
      return;
    }
    if (!silent) pushStep(id, text, false, round);
    if (activeStage && activeStage !== id) finishStage(activeStage, now);
    var st = stageState[id];
    if (st.status !== "run") { st.status = "run"; st.t0 = now; }
    if (text) st.text = text;
    if (round) stageState[id].round = round;
    activeStage = id;
    paintStages();
    paintLog();
  }

  function finishStage(id, now) {
    var st = stageState[id];
    if (!st || st.status !== "run") return;
    st.status = "done";
    st.ms = Math.max(0, now - st.t0);
  }

  /* 一轮结束：定格“完成”，没露过面的环节标成“本轮未参与” */
  function endRun() {
    if (activeStage) finishStage(activeStage, Date.now());
    activeStage = null;
    STAGES.forEach(function (s) {
      var st = stageState[s.id];
      if (st && st.status === "idle") {
        st.status = "skip";
        st.text = "本轮没用上：这个环节这次没有参与";
        pushStep(s.id, st.text, true, 0);
      }
    });
    paintStages();
    paintLog();
  }

  /* 重放本轮：按事件流里**真实发生过的顺序**再点亮一遍，方便老师慢放讲解。
   * 原来是从 usedStages() 取固定组件顺序重放——在多轮循环里那是错的，
   * 因为大脑会出现两次、顺序也不再是固定的组件排列。
   * ReAct 步骤也一起重放：规划器的"思考/行动/观察"是这一轮真正的内容，不能漏。 */
  function replayRun() {
    if (busy) { U.toast("上一轮还在跑，稍等一下再重放～"); return; }
    var live = stepLog.filter(function (s) { return !s.skip; });
    var keep = stepLog.filter(function (s) { return s.skip; });
    if (!live.length) { U.toast("还没有可重放的一轮——先提一个问题吧"); return; }

    if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
    resetStages();
    var i = 0;
    (function step() {
      if (i >= live.length) {
        keep.forEach(function (k) {
          var st = stageState[k.id];
          if (st && st.status === "idle") { st.status = "skip"; st.text = k.text; st.round = k.round; }
        });
        STAGES.forEach(function (s) {
          var st = stageState[s.id];
          if (st && st.status === "idle") { st.status = "skip"; st.text = "本轮没用上：这个环节这次没有参与"; }
        });
        paintStages();
        paintLog();
        replayTimer = null;
        U.toast("重放结束：这一轮走了 " + live.length + " 步");
        return;
      }
      var cur = live[i++];
      if (cur.kind) {
        /* ReAct 步骤：点亮归属组件 + 记一条带徽标的轨迹行 */
        pushReact(cur.kind, cur.round, cur.text, cur.picks);
      } else {
        setStage(cur.id, cur.text, null, cur.round);
      }
      replayTimer = setTimeout(step, 850);
    })();
  }

  /* ---------- 倒计时（计时器工具的 UI 部分） ----------
   * 支持同时开多个计时器（例如"25 分钟番茄钟 + 10 分钟后提醒喝水"）：
   * 每个计时器各持自己的 interval，取消/到点时只结束自己那一个。 */
  var timerIntervals = [];

  function beep() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      [0, 0.35, 0.7, 1.05, 1.4].forEach(function (t) {
        var osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = 880;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.28);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.3);
      });
    } catch (e) { /* 声音不可用不影响功能 */ }
  }

  function fmtTime(s) {
    var m = Math.floor(s / 60), sec = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  function startTimer(totalSec, label, pomodoro, remindText) {
    var box = $("pg-msgs");
    var d = document.createElement("div");
    d.className = "msg ai timer-bar";
    var descText = remindText ? ("专心做事，时间到会提醒你（" + remindText + "）") : "专心做事，时间到会提醒你";
    d.innerHTML = '<span class="who">⏳ 倒计时 ' + U.esc(label || "") + (pomodoro ? " · 番茄钟" : "") + (remindText ? " · 提醒：" + U.esc(remindText) : "") + "</span>" +
      '<div class="timer-num">' + fmtTime(totalSec) + '</div><div class="timer-desc">' + descText + '（可点下方取消计时）</div>' +
      '<button class="btn btn-ghost btn-sm timer-cancel">取消计时</button>';
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;

    var remain = totalSec;
    var numEl = d.querySelector(".timer-num");
    var cancelBtn = d.querySelector(".timer-cancel");
    var iv = null;
    cancelBtn.addEventListener("click", function () {
      if (iv) { clearInterval(iv); var i = timerIntervals.indexOf(iv); if (i >= 0) timerIntervals.splice(i, 1); }
      d.remove();
    });
    iv = setInterval(function () {
      remain--;
      if (remain <= 0) {
        clearInterval(iv);
        var i = timerIntervals.indexOf(iv); if (i >= 0) timerIntervals.splice(i, 1);
        numEl.textContent = "时间到！";
        d.classList.add("timer-done");
        beep();
        var remindMsg = remindText ? ("⏰ 时间到！该" + remindText + "啦！") : ("⏰ " + label + " 到啦！");
        var tailMsg = pomodoro ? "番茄工作法建议：休息 5 分钟，站起来活动活动，再继续下一轮专注。" : (remindText ? "" : "休息一下，喝口水吧。");
        addMsg("ai", remindMsg + tailMsg);
      } else {
        numEl.textContent = fmtTime(remain);
      }
    }, 1000);
    timerIntervals.push(iv);
  }

  /* ---------- 发送 ---------- */
  var lastPayload = null;

  function renderPayload(p) {
    var pre = $("pg-inspect-pre");
    if (!pre) return;
    pre.textContent = JSON.stringify(p, null, 2);
  }

  /* 工作台右上角的状态牌 */
  function setStatePill(state, text) {
    var el = $("pg-state");
    if (!el) return;
    var map = { idle: "待机", running: "运行中…", done: "本轮完成", error: "出错了" };
    el.textContent = text || map[state] || "";
    el.className = "pipe-state is-" + state;
  }

  /* 执行器调用：单独渲染成“调用 + 结果”两段小卡，比一行文字更好看也更清楚 */
  function addToolMsg(tool) {
    var box = $("pg-msgs");
    var d = document.createElement("div");
    d.className = "msg ai tool-note";
    d.innerHTML = '<span class="who">' + U.icon("wrench", 14) + " 执行器 · " + U.esc(tool.name || "工具") + "</span>" +
      '<div class="tool-call"><b>调用</b>' + U.esc(tool.summary || "") + "</div>" +
      '<div class="tool-result"><b>结果</b>' + U.esc(tool.result || "") + "</div>";
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    return d;
  }

  /* ============================================================
   * 运行模式：自动 / 规划 / 问答
   * 同一套组件、同一个大脑，三种模式只改"这一轮它有多大自主权"——
   * 这正是 Harness 在管的事（组件开没开由上面的 flags 管，两者是两回事）：
   *   自动 = 它自己决定、自己动手；规划 = 它只出计划、人点头了才动手；问答 = 它手里没有工具，只能聊天。
   * ============================================================ */
  var MODE_UI = {
    auto: {
      name: "自动",
      head: "它自己决定、自己动手",
      tip: "模型自己决定要不要调工具、调哪个、调几次，调完直接把答案组织好给你。" +
        "最省事，代价是<b>它在替你拍板</b>。",
      use: "适合：让它一口气把一件事办完。",
      ph: "输入你的问题，按回车发送……",
      toast: "自动模式：它自己决定、自己动手"
    },
    plan: {
      name: "规划",
      head: "只出计划，你点头了才执行",
      tip: "先<b>只做规划</b>——把「分几步、每步调什么工具、参数是什么」摆给你看，" +
        "<b>工具一个都不执行</b>；你点了「按这个计划执行」，它才真正动手。",
      use: "适合：动手前先过目。这就是<b>人在回路</b>的确认闸门。",
      ph: "输入你的问题，它先给你一份计划……",
      toast: "规划模式：它只出计划，你点头了才执行"
    },
    ask: {
      name: "问答",
      head: "手里没有工具，只能聊天",
      tip: "请求里<b>根本不发工具说明书</b>，它只能凭学过的知识回答——查天气、算课表、算题" +
        "这类活儿它就干不了了。",
      use: "适合：和自动模式问同一句话，对照看<b>工具（手脚）</b>有多关键。",
      ph: "随便问一句，它只会用已有知识回答……",
      toast: "问答模式：不发工具说明书，它只能凭已有知识答"
    }
  };

  var pendingPlan = null;   // 待确认的计划：{ plan, question }

  /* ---------- 模式说明气泡 ----------
   * 鼠标停到「自动/规划/问答」上、或键盘聚焦时浮出一小块说明；移开就收。
   * 为什么不用 CSS 的纯 hover 元素挂在按钮里：
   *   ① 气泡要写 <b> 关键词，::after 的 content 放不了标签；
   *   ② .chat-card 是 overflow: hidden，挂在卡片内的绝对定位气泡会被裁掉
   *      （模式栏正好贴着卡片顶边，气泡只能往下长）。
   * 所以统一挂到 body 上、position: fixed 由 JS 摆位。
   * 气泡本身 pointer-events: none，不会把鼠标从按钮上"抢走"而让气泡闪断。 */
  var modePop = null;

  function modePopEl() {
    if (modePop && document.body.contains(modePop)) return modePop;
    modePop = document.createElement("div");
    modePop.className = "mode-pop";
    modePop.id = "pg-mode-pop";
    modePop.setAttribute("role", "tooltip");
    document.body.appendChild(modePop);
    return modePop;
  }

  function showModePop(btn) {
    var ui = MODE_UI[btn.getAttribute("data-mode")];
    if (!ui) return;
    var el = modePopEl();
    el.innerHTML = '<div class="mp-head">' + U.esc(ui.name) + "模式<i>" + U.esc(ui.head) + "</i></div>" +
      "<div>" + ui.tip + "</div>" +
      '<div class="mp-foot">' + ui.use + "</div>";
    el.classList.add("is-on");
    /* 先让它显示出来再量尺寸——隐藏状态下量到的宽高是 0，摆位会算错。 */
    var b = btn.getBoundingClientRect();
    var eb = el.getBoundingClientRect();
    var left = b.left + b.width / 2 - eb.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - eb.width - 8));
    var top = b.bottom + 9;
    /* 卡片贴底时往下展不开，就翻到按钮上方，并让三角转到下面。 */
    var above = top + eb.height > window.innerHeight - 8;
    if (above) top = b.top - eb.height - 9;
    el.classList.toggle("is-above", above);
    /* 三角要指着按钮的中心，而不是气泡的中心：气泡被视口边缘挤开后就对不上了。
     * 偏移量 = 按钮中心 - 气泡左边界，再留出 12px 免得三角跑到圆角外面。 */
    var arrow = Math.round(b.left + b.width / 2 - left);
    arrow = Math.max(12, Math.min(arrow, eb.width - 12));
    el.style.setProperty("--arrow-x", arrow + "px");
    el.style.left = Math.round(left) + "px";
    el.style.top = Math.round(top) + "px";
  }

  function hideModePop() {
    if (modePop) modePop.classList.remove("is-on");
  }

  /* 切模式：只改"这一轮它有多大自主权"，组件开关（flags）一律不动。 */
  function applyMode(m, silent) {
    var next = Agent.setMode(m);
    var ui = MODE_UI[next] || MODE_UI.auto;
    document.querySelectorAll("#pg-mode .mode-btn").forEach(function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-mode") === next);
    });
    var ip = $("pg-input");
    if (ip) ip.placeholder = ui.ph;
    /* 模式栏不再有常驻说明条，切换后的反馈由「按钮高亮 + toast」两处承担。 */
    if (!silent) U.toast("已切到「" + ui.name + "」模式：" + ui.toast);
  }

  /* ---------- 规划模式的产出：一张待确认的计划卡 ----------
   * 卡上的每一步都直接来自模型这一轮真实返回的 tool_calls（或它写的步骤），不做任何加工润色，
   * 更不会"顺手执行掉"——只有学生点了「按这个计划执行」，回路才继续往下走。 */
  function planArgsHTML(raw) {
    var txt = String(raw || "").trim();
    if (!txt) return "";
    var obj = null;
    try { obj = JSON.parse(txt); } catch (e) { obj = null; }
    if (!obj || typeof obj !== "object") return U.esc(txt);
    return Object.keys(obj).map(function (k) {
      var v = obj[k];
      if (v && typeof v === "object") v = JSON.stringify(v);
      return "<i>" + U.esc(k) + "</i>：" + U.esc(String(v));
    }).join("　");
  }

  function renderPlanCard(plan, question) {
    plan = plan || {};
    var box = $("pg-msgs");
    var d = document.createElement("div");
    d.className = "msg ai plan-card";

    var steps = plan.steps || [];
    var body = '<span class="who">' + U.icon("gear", 14) + " 规划模式 · 计划（还没执行）</span>";

    if (plan.byRules) {
      body += '<div class="plan-lead">没有模型参与规划（' + U.esc(plan.why || "降级") + '），这份计划由本地规则写出来：</div>';
    } else if (steps.length) {
      body += '<div class="plan-lead">我打算这么做，先把计划给你看——你确认了我再动手：</div>';
    } else {
      body += '<div class="plan-lead">我判断这一句不需要工具，直接回答就行：</div>';
    }

    if (steps.length) {
      body += '<ol class="plan-steps">' + steps.map(function (s) {
        /* 两种步骤：模型给的（工具名 + 参数）与规则给的（一句话）。分开渲染，别混。 */
        if (s.text) return "<li>" + U.esc(s.text) + "</li>";
        var args = planArgsHTML(s.argsRaw);
        return "<li><b>" + U.esc(s.label) + "</b><span class=\"plan-args\">" +
          (args || "（没有参数）") + "</span></li>";
      }).join("") + "</ol>";
    }

    if (plan.note) {
      body += '<div class="plan-note">' + U.esc(plan.note) + "</div>";
    }
    if (plan.byRules) {
      body += '<div class="plan-note">注意：这一轮模型没有参与决策，规则也不会拆步——' +
        "把需要排先后顺序的任务交给它，就能看到计划残缺成什么样。</div>";
    }

    body += '<div class="plan-actions">' +
      '<button type="button" class="btn btn-per btn-sm plan-run">' + U.icon("send", 14) + " 按这个计划执行</button>" +
      '<button type="button" class="btn btn-ghost btn-sm plan-drop">先不执行</button>' +
      "</div>";

    d.innerHTML = body;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;

    pendingPlan = { plan: plan, question: question };

    d.querySelector(".plan-run").addEventListener("click", function () {
      if (busy) { U.toast("上一轮还没跑完，稍等一下～"); return; }
      runPendingPlan(d);
    });
    d.querySelector(".plan-drop").addEventListener("click", function () {
      d.querySelector(".plan-actions").innerHTML =
        '<span class="plan-dropped">已取消：工具一个都没执行。</span>';
      pendingPlan = null;
    });
  }

  /* 学生点了「按这个计划执行」：回路从这里继续。
   * 不重新贴一遍问题气泡——这只是同一轮的后半段；工作台则重置后重新点亮，
   * 因为"执行"本身就是新的一段真实流程。 */
  async function runPendingPlan(cardEl) {
    var p = pendingPlan;
    if (!p) return;
    pendingPlan = null;

    var actions = cardEl.querySelector(".plan-actions");
    if (actions) {
      actions.innerHTML = '<span class="plan-confirmed">' + U.icon("check", 14) + " 已确认，开始执行计划…</span>";
    }

    busy = true;
    $("pg-send").disabled = true;
    resetStages();
    resetFlow();
    setStatePill("running");

    try {
      await Agent.executePlan(p.plan.calls, p.question, history, makeHooks(p.question));
    } catch (e) {
      /* onError 已经提示过学生了，这里吞掉异常，避免控制台出现"未处理的 Promise 拒绝"噪音。 */
    } finally {
      endRun();
      busy = false;
      $("pg-send").disabled = false;
      $("pg-input").focus();
    }
  }

  /* 一轮运行的全部回调。send 与「按这个计划执行」共用同一套——
   * 否则两条路径上的工作台、气泡、徽章很容易长成两个样子。 */
  function makeHooks(question) {
    return {
      onEngine: function (mode, info) {
        engineMode = mode; engineInfo = info || null;
        lastRun.engine = mode; lastRun.plannerOff = !!(info && info.plannerOff);
        paintEngine();
      },
      onStage: function (id, text, flag, round) { setStage(id, text, flag, round); },
      /* ReAct 三步：思考 / 行动 / 观察。
       * 注意：这里展示的是【思考模式】（推理过程可不可见），不是"规划器有没有工作"——
       * 规划器每一轮都参与，只是关掉思考后，它的推理过程看不见而已。 */
      onThink: function (d) {
        var txt = (d.text || "").trim();
        pushReact("think", d.round, txt
          ? txt
          : (d.askMode
            ? "问答模式：这一轮根本没有工具可选，所以没有“要不要调工具”的决策；下面是它凭已有知识给出的回答。"
            : (d.thinkingOn
              ? "（模型这一轮没有写出推理过程）"
              : (d.isRules
                ? "规划器已关闭：这一轮不由模型规划，改由本地规则单步判定（规则不会拆步，所以复杂任务会漏）。"
                : "思考模式关着：模型直接下判断，没有留下推理过程。<b>但规划照常发生</b>——这正是“看不见规划”的样子，不是“规划停了”。"))));
      },
      onPlan: function (d) {
        pushReact("act", d.round,
          "决定调用：" + (d.names || "?") +
          (d.picks && d.picks.length > 1 ? "（一次调 " + d.picks.length + " 个，可并行）" : ""),
          d.picks);
      },
      onObserve: function (d) {
        pushReact("observe", d.round,
          (d.results || []).map(function (r) {
            var t = String(r.text || "").replace(/\s+/g, " ");
            return r.fn + " 返回：" + (t.length > 90 ? t.slice(0, 90) + "…" : t);
          }).join('　|　'));
      },
      onStop: function (d) {
        pushReact("stop", d.rounds || 0, d.reason || "");
        lastRun.stopReason = d.reason || "";
      },
      onContext: function (messages) { setChain(messages); },
      onTool: function (tool) {
        lastRun.tools++;
        addToolMsg(tool);
        if (tool.name === "计时器工具" && tool.payload && tool.payload.seconds) {
          startTimer(tool.payload.seconds, tool.payload.label, tool.payload.pomodoro, tool.payload.remindText);
        }
      },
      onPayload: function (messages, info) {
        lastPayload = messages;
        renderPayload(messages);
        /* 「拆开看看」里的说明文字随引擎变——三种情况下发给大脑的东西并不一样 */
        var note = $("pg-inspect-note");
        if (note && info) {
          if (info.engine === "ask") {
            note.innerHTML = '<b style="color:var(--c-per-deep)">问答模式</b>：这份请求里<b>没有 tools 字段</b>——' +
              '模型拿不到任何工具说明书，只能凭自己已有的知识作答，因此压根进不了 ReAct 循环。' +
              '把同一个问题换成「自动」模式再问一遍，差别一眼可见：有工具它去查，没工具它只能说不知道。';
          } else {
            note.innerHTML = info.engine === "rules"
              ? (info.plannerOff
                ? '<b style="color:var(--c-plan-deep)">规划器已关闭</b>：这一次<b>不由模型选工具</b>，改由本地规则做单步判定，' +
                  '再把结果<b>写成标准的 tool_calls 样子</b>发给模型，让它只负责把结果说成一句人话。' +
                  '把需要拆步、有先后依赖的任务交给它，就能看到“不会拆步”的后果。'
                : '<b style="color:var(--c-exe-deep)">降级模式</b>：这一次规划由本地规则决定，' +
                  '再把结果<b>写成标准的 tool_calls 样子</b>发给模型——模型并没有真的参与选工具。这和真实 Function Calling 只是长得像。')
              : '<b style="color:var(--c-mem-deep)">真实模式</b>：下面这份 messages 就是<b>逐轮真实发出去</b>的内容。' +
              '注意 tool_calls 是大脑自己产生的，程序只是照着它去执行，再把结果作为 tool 角色追加回去。' +
              '这一次共 ' + (lastRun.rounds || (info.round || 1)) + ' 轮' + (info.round ? "（当前显示第 " + info.round + " 轮发出前的上下文）" : "") + '。';
          }
        }
      },
      /* 规划模式：这一轮没有"回答"，只有"计划"。渲染成卡片，等学生确认。 */
      onPlanReady: function (plan) {
        setStatePill("done", "计划已产出，等你确认");
        renderPlanCard(plan, question);
      },
      onDone: async function (answer) {
        history.push({ role: "assistant", content: answer });
        lastRun.rounds = roundLog.length;
        endRun();                        // 先把工作台定格，再写字
        setStatePill("done");
        var el = addMsg("ai", "");
        await U.typewriter(el, answer, 12);
        /* 打字机放的是纯文本预览；放完统一换成 Markdown 渲染结果。
         * 打字机是整块重写 el.innerHTML，会把 .who 一起清掉，所以这里重建完整结构。 */
        el.innerHTML = '<span class="who">智能体小管家</span>' +
          '<div class="md-body">' + U.md(answer) + "</div>";
        el.scrollIntoView && el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      },
      onError: function (err) {
        setStatePill("error");
        addMsg("ai", "出错了：" + (err.message || err) + "\n\n小提示（卡住三步走）：① 自己读一遍问题并复述 ② 把问题说清楚再问 AI ③ 还不行就求助老师/同伴。");
      }
    };
  }

  async function send(text) {
    if (busy) return;
    text = (text || "").trim();
    if (!text) return;
    busy = true;
    $("pg-input").value = "";
    $("pg-send").disabled = true;

    addMsg("user", text);
    history.push({ role: "user", content: text });
    if (history.length > Agent.MAX_HISTORY) history = history.slice(-Agent.MAX_HISTORY);
    resetStages();
    resetFlow();                     // 每一轮重新问，轮次和上下文都要从头画
    setStatePill("running");

    try {
      await Agent.run(text, history, makeHooks(text));
    } catch (e) {
      /* 出错已经由上面的 onError 提示给学生了（含"卡住三步走"提示），
       * 这里吞掉异常，避免控制台出现"未处理的 Promise 拒绝"噪音。 */
    } finally {
      endRun();                          // 幂等：出错时也把未参与的环节标清楚
      busy = false;
      $("pg-send").disabled = false;
      $("pg-input").focus();
    }
  }

  /* ---------- 实验与“真实运行”之间的桥 ---------- */
  var switchDemoApi = null;   // 实验②的开关句柄（由 bindPgSwitch 赋值，用于双向同步）
  var FLAG_LABELS = { perception: "感知器", planner: "规划器", memory: "记忆器", executor: "执行器" };

  function offFlags() {
    return ["perception", "planner", "memory", "executor"].filter(function (f) { return Agent.flags[f] === false; });
  }

  function flagTipHTML() {
    var tip = $("pg-flag-tip");
    if (!tip) return;
    var off = offFlags();
    tip.innerHTML = off.length
      ? "已关：" + off.map(function (f) { return "<b>" + FLAG_LABELS[f] + "</b>"; }).join("、") + "——看看它还能做成什么。"
      : "四个组件全开——跑一句需要工具的话试试。";
  }

  /* 按当前开关挑一句“最能暴露问题”的测试题 */
  function pickTestQuestion() {
    if (Agent.flags.memory === false) return "今天下午有什么课？";
    if (Agent.flags.executor === false) return "明天会下雨吗？";
    /* 关掉规划器时，要挑一句【必须拆步】的话才暴露得出来：
     * 单步题（如“算 25×4+10”）规则也能做，关不关规划器看不出区别。 */
    if (Agent.flags.planner === false) return PG_COMPLEX_TASK;
    return "明天会下雨吗？";
  }

  /* 把实验里的设定带进真实对话：滚到对话区并真的问出去 */
  function runInChat(text) {
    if (busy) { U.toast("上一轮还没跑完，稍等一下～"); return; }
    if (!AgentLab.API.hasApiKey()) {
      U.toast("真实提问需要 DeepSeek API Key：点右上角「设置」填一个");
      return;
    }
    var target = $("pg-msgs");
    if (target && target.scrollIntoView) {
      try { target.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) { }
    }
    send(text);
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    var input = $("pg-input");
    var sendBtn = $("pg-send");

    function doSend() { send(input.value); }
    sendBtn.addEventListener("click", doSend);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") doSend(); });

    document.querySelectorAll("#pg-chips .chip-suggest").forEach(function (c) {
      c.addEventListener("click", function () {
        /* 优先读 data-q：多步那条芯片里混着「多步」标签，textContent 不干净 */
        send(c.getAttribute("data-q") || c.textContent);
      });
    });

    $("pg-clear").addEventListener("click", function () {
      history = [];
      lastPayload = null;
      $("pg-msgs").innerHTML = "";
      var ip = $("pg-inspect");
      if (ip) ip.style.display = "none";
      resetStages();
      setStatePill("idle");
      U.toast("已开启新对话（短期记忆已清空）");
    });

    var replayBtn = $("pg-replay");
    if (replayBtn) replayBtn.addEventListener("click", replayRun);

    var flagRun = $("pg-flag-run");
    if (flagRun) flagRun.addEventListener("click", function () { runInChat(pickTestQuestion()); });
    flagTipHTML();

    var inspectBtn = $("pg-inspect-btn");
    if (inspectBtn) {
      inspectBtn.addEventListener("click", function () {
        var box = $("pg-inspect");
        var isHidden = box.style.display === "none";
        box.style.display = isHidden ? "block" : "none";
        if (isHidden && lastPayload) renderPayload(lastPayload);
        if (isHidden && !lastPayload) {
          $("pg-inspect-pre").textContent = "（还没有请求记录）先问一句话，然后再次打开这里，就能看到这一轮真实发给 DeepSeek 的完整请求了。";
        }
      });
    }

    document.querySelectorAll("#pg-flags input[type=checkbox]").forEach(function (cb) {
      var id = cb.getAttribute("data-flag");
      cb.checked = Agent.flags[id] !== false;
      cb.addEventListener("change", function () {
        Agent.flags[id] = cb.checked;
        if (switchDemoApi) switchDemoApi.set(id, cb.checked);   // 同步到下方实验②的开关
        flagTipHTML();
        U.toast(cb.checked ? "已打开：" + FLAG_LABELS[id] + "（下方实验的开关已同步）" : "已关闭：" + FLAG_LABELS[id] + "，再问一句试试！");
      });
    });

    /* 思考模式单独绑：它不是组件，不进上面的四组件循环，也不和下方实验②联动。
     * 它只改一件事——模型要不要把推理过程写出来。 */
    var thinkCb = $("pg-flag-thinking");
    if (thinkCb) {
      thinkCb.checked = Agent.flags.thinking === true;
      thinkCb.addEventListener("change", function () {
        Agent.flags.thinking = thinkCb.checked;
        U.toast(thinkCb.checked
          ? "思考模式已开：模型会先写出推理过程（更慢，但过程可见）"
          : "思考模式已关：直接决策、更快——规划器照常工作，只是看不见推理过程");
      });
    }

    /* 运行模式：分段控件。
     * 它只管"这一轮它有多大自主权"，与上面那排组件开关（flags）是两回事，两条线互不干扰。 */
    document.querySelectorAll("#pg-mode .mode-btn").forEach(function (b) {
      b.addEventListener("click", function () { applyMode(b.getAttribute("data-mode")); });
      /* 说明气泡的三处触发：鼠标移入 / 键盘聚焦出现，移出 / 失焦收起。
       * click 不额外处理——点完鼠标还在按钮上，气泡继续显示是对的。 */
      b.addEventListener("mouseenter", function () { showModePop(b); });
      b.addEventListener("focus", function () { showModePop(b); });
      b.addEventListener("mouseleave", hideModePop);
      b.addEventListener("blur", hideModePop);
    });
    /* 气泡是 fixed 定位：容器一滚，它就悬在原地、和按钮对不上了，所以滚动时直接收起来。
     * 用捕获阶段监听，才能收到卡片内部 .chat-msgs 这类子容器的滚动。 */
    document.addEventListener("scroll", hideModePop, true);
    window.addEventListener("resize", hideModePop);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") hideModePop(); });
    applyMode(Agent.getMode(), true);   // 初始按当前模式刷新按钮高亮与输入框占位

    // 欢迎语（只留一句：身份 + 核心功能，其余细节交给芯片与工作台现场演示）
    var box = $("pg-msgs");
    box.innerHTML = '<div class="msg ai"><span class="who">智能体小管家</span>' +
      '你好，我是智能体小管家。问我课表、天气，也能让我算题、记提醒。</div>';
    resetStages();
    resetFlow();
    setStatePill("idle");
    /* 总装图的连线全部由 CSS 变量算位置，这里不再需要给斜边现算坐标，
     * 也就不需要 ResizeObserver 了（旧实现见 layoutHubDiag 的注释）。 */
  }

  /* ============================================================
   * 进阶原理互动课堂（智能体实验室）：5 个概念
   * 结构与交互由共享引擎 js/adv-classroom.js 渲染
   * ============================================================ */
  var PG_ADV = [
    {
      id: "formula", icon: "spark", nav: "Agent 公式", name: "Agent = LLM + 上下文 + 工具", en: "THE MINIMAL FORMULA",
      tip: "现代智能体的最小工程公式（ai-agent-book 第 1 章）：大脑负责生成，上下文决定它“知道什么”，工具决定它“能做什么”。",
      analogy: "像一个会自己办事的小队：<b>大脑</b>是队长（会想），<b>上下文</b>是队长的记事本（知道什么），<b>工具</b>是队员的手脚（能做），<b>规划器</b>是流程表（先做什么后做什么）。",
      real: "LLM 提供推理与生成；上下文（system 提示词 + 轨迹 + 检索结果）提供“已知条件”；工具提供“改变世界的能力”。三样缺一，就会退化成聊天机器人：缺工具只能输出文字，缺上下文每次从零开始，缺记忆记不住你。",
      quiz: { q: "只给 LLM 一个提示词、不给工具也不给记忆，它和 Agent 的本质差别是什么？", a: "差别在“闭环”：没有工具它只能输出文本、无法影响世界；没有记忆它每次都从零开始。Agent 的价值来自“能看到行动结果 → 再决策”的循环。" },
      links: [{ t: "内部工作台", el: "pg-pipe" }]
    },
    {
      id: "loop", icon: "refresh", nav: "Agent 循环", name: "Agent 循环", en: "THE AGENT LOOP",
      tip: "智能体不是“问一句答一句”，而是自主循环：观察 → 推理 → 行动 → 再观察，直到任务完成。",
      analogy: "像做实验：看现象（观察）→ 想原因（推理）→ 动手试（行动）→ 再看结果（观察）……一轮一轮逼近答案，而不是一次就交卷。",
      real: "循环必须有终止条件（任务完成 / 达到最大轮数 / 不可恢复错误）；每一轮都把工具结果追加进轨迹，供下一轮推理。工程上还会限制单任务的最大调用次数，避免死循环烧钱。",
      quiz: { q: "为什么“问一句答一句”的聊天机器人不算 Agent？", a: "因为它没有“根据结果再决策”的环节：回答完就结束了。Agent 必须能观察行动的结果，并据此决定下一步——这个闭环才是 Agent 的核心。" },
      links: [{ t: "内部工作台", el: "pg-pipe" }]
    },
    {
      id: "harness", icon: "shield", nav: "Harness 编排层", name: "Harness（编排层）", en: "HARNESS",
      tip: "包裹在模型外面的工程层：管理上下文、暴露工具、加约束、验证结果、出错纠正。没有它，模型只是聊天机器人。",
      analogy: "像给新老师配的“带教制度”：不是不信他的能力，而是要有流程、有检查、有兜底。",
      real: "Harness 负责：构造上下文、维护循环与状态、暴露工具接口、权限校验、结果验证、失败纠正、日志审计。模型能力边界之外的部分，正是 Harness 的价值所在——它决定系统能不能上线。",
      quiz: { q: "同一个模型，为什么在“网页聊天框”里和“接入 Harness 的系统”里表现差这么多？", a: "因为 Harness 决定了它能看到什么（上下文）、能用什么（工具）、被允许做什么（约束）、错了怎么补救（纠正）。模型只是整套系统里的一环。" },
      links: [{ t: "现场开关组件", el: "pg-flags" }, { t: "运行模式：自动 / 规划 / 问答", el: "pg-mode" }]
    },
    {
      id: "evaluation", icon: "target", nav: "评估 Evaluation", name: "评估（Evaluation）", en: "EVALUATION",
      tip: "怎么知道智能体做得好不好？要有测试集 + 指标 + 反复评测，而不是“感觉还行”。",
      analogy: "像考试：只做一道题看不出水平，要有一份覆盖不同题型的卷子 + 明确的评分标准，才能说“他进步了”。",
      real: "真实项目的做法：准备覆盖典型场景的测试集（含边界情况）；定义可量化指标（任务完成率、回答准确率、工具调用成功率、成本与延迟）；改一版就跑一遍对比回归。ai-agent-book 第 7 章的核心：<b>没有评估，就没有改进方向</b>。",
      quiz: { q: "为什么“多试几句感觉不错”不算评估？", a: "因为没有固定题集、没有指标、没有对比基线——换个问题可能就是另一个结论。评估必须可重复、可比较，才能判断改动是“真的变好”还是“碰巧”。" },
      links: [{ t: "实验：给智能体做体检", el: "pg-eval" }]
    },
    {
      id: "context", icon: "archive", nav: "上下文工程", name: "上下文工程（Context Engineering）", en: "CONTEXT ENGINEERING",
      tip: "对模型来说，<b>看不见的东西＝不存在</b>。上下文工程就是决定：这一轮到底把哪些信息、按什么顺序递给模型。",
      analogy: "像给转学生写一张“情况说明”：写多了他抓不住重点，写少了又什么都不知道；还得按“先规则、再背景、最后问题”的顺序写。",
      real: "上下文 = 静态前缀（system 规则 + 长期记忆档案）+ 轨迹（历史的 user / assistant）+ 本轮提问 + 工具结果。这四样各有出处、各有体积：塞得越多越贵、越容易淹没重点，还可能把隐私一起交出去。工程上要按预算分配、先检索再注入，而不是把知道的全都倒进去。",
      quiz: { q: "为什么不能“把知道的全都发给模型”？", a: "三个代价：① 上下文窗口有限，装不下就会被挤出；② 越长越贵、越慢；③ 无关信息会淹没重点、干扰判断。所以要“该带什么带什么，按顺序放”。" },
      links: [{ t: "实验：拆开看看上下文", el: "pg-ctx" }, { t: "内部工作台", el: "pg-pipe" }]
    },
    {
      id: "observability", icon: "microscope", nav: "可观测性 · Trace", name: "可观测性与 Trace", en: "OBSERVABILITY",
      tip: "上线以后的智能体，出错是常态。可观测性＝“我能看见它每一步干了什么”，靠的是轨迹（Trace）与日志。",
      analogy: "像考试要看“过程分”：只看最后答案，永远不知道为什么错；把草稿纸也交上来，老师一眼就能看出哪一步跑偏了。",
      real: "真实系统给每条请求分配一个 trace id，把每一步的输入输出、耗时、工具参数、返回码都记下来，再配上仪表盘。有了它才能定位故障环节、复现问题、对比版本、算清成本。没有可观测性的智能体就是黑盒——出了事只能靠猜。",
      quiz: { q: "没有 Trace 日志，会带来什么麻烦？", a: "只看到最后那句错话，无法判断是哪一环的锅：输入没整理好？工具选错了？记忆没带上？工具真的挂了？还是模型自己编的？定位不了，就没法针对性修复——下次还会错。" },
      links: [{ t: "实验：读轨迹找故障", el: "pg-trace" }, { t: "内部工作台", el: "pg-pipe" }]
    },
    {
      id: "recovery", icon: "refresh", nav: "错误恢复与降级", name: "错误恢复与降级", en: "RETRY & FALLBACK",
      tip: "工具会超时、接口会报错、模型会拒绝某种写法。靠谱的系统必须有“退路”：重试、换写法降级、兜底回答。",
      analogy: "像出门带伞：不是盼着下雨，而是下雨了也不至于淋成落汤鸡。",
      real: "常见三招：① <b>重试</b>——超时或限流时等一会儿再来，且必须设次数上限；② <b>降级</b>——标准写法被拒就换一种写法，模型不可用就换备用模型；③ <b>兜底</b>——如实说“暂时查不到”，给替代方案，绝不编造。本项目就实现了这三招：你在工作台看到的那次“换写法重试”，是真实的降级过程。",
      quiz: { q: "重试次数是不是越多越好？", a: "不是。重试能提高成功率，但每次都要花时间和 Token；碰到确定性的失败（密钥错、参数错），重试再多次也没用。所以要设上限、区分错误类型，超时后走降级或兜底。" },
      links: [{ t: "内部工作台（看失败提示）", el: "pg-pipe" }]
    },
    {
      id: "humanloop", icon: "lock", nav: "人在环 · 自主性分级", name: "人在环与自主性分级（Human-in-the-Loop）", en: "HUMAN IN THE LOOP",
      tip: "不是所有事都该让 Agent 自己决定。按“能不能撤销、影响多大”分成三档：<b>自动执行 / 先问人 / 直接禁止</b>。",
      analogy: "像家里的电器：开台灯随便开（自动），用煤气灶要有人在旁边（先问人），拆插座你自己不许动手（禁止）。",
      real: "工程做法是按风险设“闸门”：只读、可撤销的操作自动执行；写操作（发消息、删数据、花钱、提交表单）走人工确认；越权和危险动作直接禁止。确认环节也要设计好——给出“要做什么 + 影响范围 + 能不能撤销”，让人一眼能判断。这属于 Harness 的职责。",
      quiz: { q: "为什么“能撤销”和“不能撤销”要分成两档？", a: "因为犯错的代价完全不同：可撤销的操作（查天气、改写草稿）错了也没关系，自动执行更快；不可撤销的操作（删数据、发消息、付款）错了就收不回来，必须先让人确认。分级的依据是“错误代价”，不是“技术难度”。" },
      links: [{ t: "实验：关掉一个组件", el: "pg-switch" }, { t: "切到「规划」模式看确认闸门", el: "pg-mode" }]
    },
    {
      id: "multiagent", icon: "users", nav: "多智能体协作", name: "多智能体协作（Multi-Agent）", en: "MULTI-AGENT",
      tip: "复杂任务可以让多个智能体分工：一个搜索、一个总结、一个检查——像一支小队。",
      analogy: "像小组做研究报告：有人查资料、有人写、有人检查错别字。分工能提高质量与速度，但也要有人负责汇总。",
      real: "常见模式：① 提议者-审核者（生成 + 独立审查）；② 流水线分工（搜索 → 总结 → 校对）；③ 并行探索 + 投票。代价是 Token 与协调成本上升，任务简单时反而更慢。ai-agent-book 第 10 章强调：<b>先能拆成独立子任务，再考虑多智能体</b>。",
      quiz: { q: "什么情况下“多智能体”反而不划算？", a: "任务简单、步骤少、一个人一次就能做好时——多智能体要多轮沟通、上下文复制，成本和延迟都上升。判断标准：任务能不能清晰地拆成独立子任务。" },
      links: [{ t: "内部工作台", el: "pg-pipe" }]
    }
  ];

  /* 概念 id → 交互类型 */
  var PG_TYPE = {
    formula: "decider", loop: "pipeline", harness: "switchboard",
    context: "picker", observability: "pipeline", recovery: "tuner",
    humanloop: "decider", evaluation: "picker", multiagent: "sandbox"
  };

  var PG_DEMO = {
    formula: {
      title: "动手实验：这个需求该配哪些能力？", hint: "选两个答案", icon: "spark",
      emptyText: "先回答上面两个问题，系统会给出“该配什么”的建议。",
      questions: [
        { key: "ext", q: "① 这个需求需要“外部实时信息”吗？", opts: [{ k: "need", t: "需要（查天气 / 查课表 / 搜索）" }, { k: "no", t: "不需要（写一段话就行）" }] },
        { key: "mem", q: "② 需要“记住之前说过的事”吗？", opts: [{ k: "need", t: "需要（跨轮次、跨天）" }, { k: "no", t: "不需要，这一轮够用" }] }
      ],
      decide: function (ans) {
        if (ans.ext === "need" && ans.mem === "need") {
          return "<b>建议：完整 Agent（大脑 + 上下文 + 工具 + 规划器）</b><br>" +
            '<span class="dim">需要外部信息 → 必须配工具（执行器）；需要跨轮次记住 → 必须配长期记忆；多步任务 → 还要规划器拆解与排序。</span>' +
            '<br><b>典型场景：</b>班级小管家（查课表 + 记住“我是学习委员”）。';
        }
        if (ans.ext === "need") {
          return "<b>建议：大脑 + 工具即可，不必上长期记忆。</b><br>" +
            '<span class="dim">只要外部信息、不需要跨会话记人，那配好工具（执行器）+ 规划器就够；长期记忆会增加隐私与维护成本。</span>' +
            '<br><b>典型场景：</b>一次性的“查天气 / 算面积”——问完就结束。';
        }
        if (ans.mem === "need") {
          return "<b>建议：大脑 + 记忆即可，可以不配工具。</b><br>" +
            '<span class="dim">不需要外部实时数据，但要把之前的对话与班级信息带着，那就是上下文工程 + 长期记忆的活儿。</span>' +
            '<br><b>典型场景：</b>“接着上次继续写”“按我的偏好来回答”。';
        }
        return "<b>建议：普通对话就够，别上 Agent。</b><br>" +
          '<span class="dim">既不需要外部信息、也不需要记住什么，直接让模型生成即可。硬做成 Agent 只会增加复杂度、成本和出错点——<b>技术选型要匹配需求，过度设计也是错</b>。</span>' +
          '<br><b>典型场景：</b>润色一句话、把一段话改得更简单。';
      }
    },
    loop: {
      title: "动手实验：走一遍 Agent 循环", hint: "先猜后放", icon: "refresh",
      playLabel: "自动播放一轮循环", stepLabel: "单步推进", resetLabel: "重来",
      logTitle: "循环日志",
      stages: [
        { id: "obs", name: "观察", icon: "eye", en: "Observation", io: "拿到用户问题与当前上下文（“明天会下雨吗？”）" },
        { id: "think", name: "推理", icon: "brain", en: "Reasoning", io: "判断：这需要真实天气数据 → 应该调用天气工具" },
        { id: "act", name: "行动", icon: "wrench", en: "Acting", io: "调用 weather_query(city=北京, date=明天)" },
        { id: "recheck", name: "再观察", icon: "refresh", en: "Re-observe", io: "读到结果“小雨 15~19℃”，判断：信息够了，可以收尾" },
        { id: "deliver", name: "交付", icon: "check", en: "Final Answer", io: "回答“明天小雨，记得带伞”——任务完成，循环结束" }
      ],
      guess: {
        q: "先猜一猜：循环里哪一步决定了“要不要再来一轮”？",
        opts: [
          { k: "recheck", t: "再观察（看到结果后做判断）" },
          { k: "act", t: "行动（调用工具）" },
          { k: "deliver", t: "交付（给出回答）" }
        ],
        ans: "recheck",
        why: "只有看到行动的结果，才知道离目标还差多少：信息够了就交付，不够就再循环一轮。这个“看结果 → 再判断”的节点，才是 Agent 与聊天机器人最本质的区别。",
        hint: "想想“不看结果就继续做”会怎样。",
        revealAt: 3
      }
    },
    harness: {
      title: "动手实验：关掉 Harness 的某项能力，谁还能兜底？", hint: "点开关", icon: "shield",
      chipsTitle: "① Harness 负责的五件事（点一下可关掉）：",
      chips: [
        { id: "h1", label: "构造上下文（把该带的信息带上）", on: true },
        { id: "h2", label: "暴露工具接口 + 权限校验", on: true },
        { id: "h3", label: "加约束（不允许做的事）", on: true },
        { id: "h4", label: "验证结果（格式 / 非空 / 断言）", on: true },
        { id: "h5", label: "失败纠正 + 日志审计", on: true }
      ],
      viewTitle: "当前 Harness 生效的能力",
      viewNote: "这五件事都在模型外面——模型只负责生成，兜底靠 Harness。",
      viewEmpty: "Harness 全关：等于把模型直接接到用户面前。",
      actionsTitle: "② 这些环节还能被保障吗？",
      actions: [
        { id: "a1", label: "把班级课表带进这次上下文", need: ["h1"], hint: "上下文由 Harness 构造，模型自己拿不到外部信息。" },
        { id: "a2", label: "调用天气工具并确认有权限", need: ["h2"], hint: "工具接口与权限校验都在 Harness 层完成。" },
        { id: "a3", label: "拒绝执行“把全班作业都删掉”", need: ["h3"], hint: "约束是开发者写死的红线，不靠模型自觉。" },
        { id: "a4", label: "工具返回空值时要求重试", need: ["h4"], hint: "结果验证：空值、格式错、断言不过都要拦下来。" },
        { id: "a5", label: "出错后自动重试并把过程记进日志", need: ["h5"], hint: "纠正与审计：出问题要能自动补救、事后能查。" }
      ],
      resultEmpty: "点一件事试一试。",
      afterToggle: "Harness 能力变了——再点下面某件事，看看还有没有人兜底。",
      failTail: "Harness 的这项能力被关掉了——这一步就没人兜底，只能指望模型自觉。",
      okTail: "Harness 在，这一步有流程、有检查、有兜底。",
      onIcon: "shield", offIcon: "xmark"
    },
    evaluation: {
      title: "动手实验：哪些做法算“合格的评估”？", hint: "多选后检查", icon: "target",
      taskLabel: "情境：",
      task: "老师想知道“这次改动到底让智能体变好了吗”。请选出所有<b>合格的评估做法</b>。",
      checkLabel: "检查我选的做法",
      empty: "先点选你认为合格的做法，再点「检查我选的做法」。",
      passHtml: "合格评估的三要素：<b>固定题集 + 明确指标 + 前后对比</b>。",
      failHtml: "提示：判断标准是“换个时间、换个人来跑，结论会不会变”。",
      items: [
        { id: "v1", label: "准备一份覆盖典型问题的测试集（含边界情况）", ok: true, why: "固定题集是评估的地基：换个人、换一天跑，题目都一样。" },
        { id: "v2", label: "定义可量化指标：任务完成率 / 工具调用成功率 / 平均耗时", ok: true, why: "指标能量化“好到什么程度”，也能暴露“变快了但更容易错”这类权衡。" },
        { id: "v3", label: "改动前后各跑一遍同一份测试集，逐项对比", ok: true, why: "没有对比基线，就无法判断提升来自改动还是运气。" },
        { id: "v4", label: "把“不知道却硬答”的幻觉次数单独列成一项指标", ok: true, why: "把最危险的错误单独度量，才能防止“准确率上去了、可信度下来了”。" },
        { id: "v5", label: "自己试三个问题，感觉比之前顺", ok: false, why: "样本太少、没有指标、没有基线——换个问题结论就可能反转。" },
        { id: "v6", label: "看回答字数变多了，认为更详细更好", ok: false, why: "字数不是质量指标；啰嗦往往还意味着没抓住重点。" },
        { id: "v7", label: "换一个更强的模型，然后宣布效果提升", ok: false, why: "同时改变了变量又没有对比基线与题集，无法归因——评估要一次只改一处。" }
      ]
    },
    context: {
      title: "动手实验：这一轮该把哪些信息装进上下文？", hint: "多选后检查", icon: "archive",
      taskLabel: "情境：",
      task: "同学问：<b>“我是学习委员，今天下午有什么课？”</b>（上一轮他还说过“我在北京”）。请选出所有<b>应该</b>放进这一轮上下文的信息。",
      checkLabel: "检查我装的东西",
      empty: "先点选你认为该装进上下文的信息，再点「检查我装的东西」。",
      passHtml: "装得刚刚好：<b>该带的带全了，不该带的没带</b>——这就是上下文工程。",
      failHtml: "判断口诀：① 回答问题真的需要它吗？② 它是谁的隐私？③ 它会把上下文撑得多长？",
      items: [
        { id: "c1", label: "系统规则 + 边界说明书（system）", ok: true, why: "每次请求都要有：模型才知道自己是谁、能做什么、不能做什么。" },
        { id: "c2", label: "班级知识库里的课表（由记忆器检索出来）", ok: true, why: "这正是回答“今天下午有什么课”所必需的信息，检索出来再注入。" },
        { id: "c3", label: "同学这一轮问的那句话", ok: true, why: "本轮 user 消息，问题的本体，必须在。" },
        { id: "c4", label: "上一轮说过的“我在北京”", ok: true, why: "短期记忆（轨迹）要原样回放——万一后面要查天气，城市就在这儿。" },
        { id: "c5", label: "全班同学的家庭住址和电话", ok: false, why: "和这个问题毫无关系，而且是隐私。放进上下文＝把它交给模型，既没必要也危险。" },
        { id: "c6", label: "三天前和同桌聊“哪款游戏好玩”的整段记录", ok: false, why: "与课表无关，只会把上下文撑长、淹没重点——这正是“上下文预算”要管的事。" },
        { id: "c7", label: "模型训练时用过的全部原始语料", ok: false, why: "训练语料已经融进模型参数里了，不会、也不可能每次请求重发一遍。" }
      ]
    },
    observability: {
      title: "动手实验：跟着工程师走一遍排查流程", hint: "单步推进", icon: "microscope",
      playLabel: "自动播放排查过程", stepLabel: "单步推进", resetLabel: "重来",
      logTitle: "排查日志",
      stages: [
        { id: "trace", name: "拿到轨迹", icon: "archive", en: "Trace", io: "调出这条请求的 trace：五步的输入输出、耗时、工具参数，全都在" },
        { id: "locate", name: "定位环节", icon: "target", en: "Locate", io: "从第一条往下看，找<b>第一个</b>和预期对不上的输出——那里才是病根" },
        { id: "repro", name: "复现问题", icon: "refresh", en: "Reproduce", io: "用同样的输入再跑一遍：能稳定重现，才说明找到的是真原因" },
        { id: "fix", name: "修复", icon: "wrench", en: "Fix", io: "对症下药：补上记忆 / 改工具描述 / 加约束 / 换提示词——而不是盲目换模型" },
        { id: "regress", name: "回归测试", icon: "check", en: "Regression", io: "用固定题集再跑一遍全部用例：确认修好了，也没把别的弄坏" }
      ],
      guess: {
        q: "先猜一猜：排查时最该避免哪一种做法？",
        opts: [
          { k: "first", t: "从轨迹第一条开始，找第一个不对劲的输出" },
          { k: "blame", t: "不看记录，直接怪“模型太笨”并换个更贵的模型" },
          { k: "repro", t: "用同样的输入再跑一遍，确认能不能重现" }
        ],
        ans: "blame",
        why: "把一切归因于“模型太笨”，是最常见的偷懒：凭感觉换模型既贵又不可复现，而且如果病根在记忆没带上、工具描述写错，换了模型照样错。先看轨迹，是对症下药的前提。",
        hint: "想想哪种做法的结论最不可靠。",
        revealAt: 1
      }
    },
    recovery: {
      title: "动手实验：重试次数该设几次？", hint: "拖滑条看指标", icon: "refresh",
      paramLabel: "最多重试几次", min: 0, max: 5, step: 1, value: 0, unit: "次",
      metricLabel: "任务成功率（示意）",
      compute: function (v) {
        /* 教学示意曲线：0 次最差；1~3 次收益最明显；4 次到顶；5 次开始收益递减 */
        var rate = Math.round(72 + 9 * v - 1.2 * v * v);
        if (rate > 96) rate = 96;
        var note, level;
        if (v === 0) {
          note = "一次失败就放弃：断网、限流这类“临时故障”会直接让任务失败。没有任何退路的系统，成功率最低。";
          level = "warn";
        } else if (v <= 3) {
          note = "重试 " + v + " 次：临时故障基本能被吃掉，成功率提升明显，成本也还可控。";
          level = "ok";
        } else if (v === 4) {
          note = "重试 4 次：成功率已经摸到这条曲线的最高点——再多加次数，收益就很小了。";
          level = "ok";
        } else {
          note = "重试 " + v + " 次：成功率不再提高（甚至略降），但每次失败都要多等好几秒、多花好几份 Token——这就是“收益递减”。";
          level = "warn";
        }
        return { value: rate, label: rate + "%", note: note, level: level };
      },
      touchedHint: "把滑条从 0 拖到 5，比较不同取值下的成功率。",
      best: {
        q: "想清楚再答：成功率最高是重试 4 次，为什么生产系统常常只设 2~3 次？",
        opts: ["因为重试次数多了成功率反而下降", "因为每多一次重试都要多花时间和钱，而收益越来越小", "因为设几次其实没区别"],
        ans: 1,
        why: "成功率从 86% 提到 90% 只多 4 个点，但失败场景下的等待时间几乎翻倍、成本上升。“够用就好、留有余量”才是工程取舍。",
        hint: "把滑条拖到 2 和 5，比较成功率和付出的代价。"
      }
    },
    humanloop: {
      title: "动手实验：这个操作该自动做、先问人，还是直接禁止？", hint: "答两问出结论", icon: "lock",
      emptyText: "先回答上面两个问题，系统会给出这一档的判断。",
      questions: [
        { key: "undo", q: "① 这个操作做错了，能撤销吗？", opts: [{ k: "yes", t: "能撤销（可恢复）" }, { k: "no", t: "不能撤销（删了 / 发了就回不来）" }] },
        { key: "scope", q: "② 影响范围有多大？", opts: [{ k: "me", t: "只影响我自己 / 一次性" }, { k: "others", t: "会影响别人或全班" }] }
      ],
      decide: function (ans) {
        if (ans.undo === "no" && ans.scope === "others") {
          return "<b>建议：必须“先问人”，甚至直接禁止。</b><br>" +
            '<span class="dim">不可撤销 + 影响别人 = 风险最高的一档。删全班作业、给同学群发消息、提交报名表都属于这一类：执行前必须把“要做什么、影响谁、能不能撤回”讲清楚，等人点头。</span>' +
            '<br><b>例子：</b>“帮我把全班作业都删掉”——正确回答是拒绝执行。';
        }
        if (ans.undo === "no") {
          return "<b>建议：先问人确认一次。</b><br>" +
            '<span class="dim">做错了收不回来，但影响范围只有自己——确认一次就够了，不必走复杂审批。</span>' +
            '<br><b>例子：</b>“清空我的草稿箱”。';
        }
        if (ans.scope === "others") {
          return "<b>建议：可以自动执行，但要留下记录并告知。</b><br>" +
            '<span class="dim">可撤销 + 影响别人：做错了能补救，所以不必每次都问；关键是要有日志和通知，出了问题能查、能撤回。</span>' +
            '<br><b>例子：</b>“把公告发到班级群（可撤回）”。';
        }
        return "<b>建议：放心自动执行。</b><br>" +
          '<span class="dim">只读或可撤销、又只影响自己——这类操作交给 Agent 自动化最划算。</span>' +
          '<br><b>例子：</b>“查一下明天的天气”“把这段话改得更简单”。';
      }
    },
    multiagent: {
      title: "动手实验：这个任务要不要上多智能体？", hint: "切开关对比", icon: "users",
      srcTitle: "① 选择任务：",
      sources: [
        {
          id: "essay",
          label: "写一篇 300 字作文",
          safe: "任务：写一篇 300 字的记叙文（一个人一次就能写完）。",
          evil: "任务特点：步骤少、不需要多源信息、也不需要交叉验证。"
        },
        {
          id: "research",
          label: "调研“AI 对教育的影响”并写报告",
          safe: "任务：调研多个来源 + 汇总成报告（信息多、需要交叉验证）。",
          evil: "任务特点：天然可拆成“搜索 / 汇总 / 核查”三类独立子任务。"
        }
      ],
      defaultId: "essay",
      guardOn: false,
      guardTitle: "② 用哪种组织方式：",
      guardLabelOn: "多智能体协作（搜索 / 写作 / 审查分工）",
      guardLabelOff: "单智能体独立完成",
      contentTitle: "任务与特点：",
      dataLabel: "① 任务：",
      injectLabel: "② 任务特点：",
      outHtml: function (src, guarded) {
        if (src.id === "essay") {
          return guarded
            ? "<b>多智能体来做这件事：不划算。</b><br>" +
              "· 三个智能体要来回传上下文、互相同步，协调成本比写作本身还高；<br>" +
              "· 质量提升有限（本来就一次能写好），Token 与耗时却翻几倍。<br>" +
              '<span class="dim">结论：任务太简单时，多智能体是“用更多流程换更少收益”。</span>'
            : "<b>单智能体独立完成：够用，而且更快更省。</b><span class=\"ok\">✓ 推荐</span><br>" +
              "· 一次生成就能达到目标；<br>· 没有跨智能体的沟通成本，也更容易复现和排查问题。<br>" +
              '<span class="dim">判断标准：任务能不能清晰拆成独立子任务——不能拆，就别拆团队。</span>';
        }
        return guarded
          ? "<b>多智能体协作：明显更合适。</b><span class=\"ok\">✓ 推荐</span><br>" +
            "· <b>搜索智能体</b>并行查多个来源；<br>· <b>写作智能体</b>只负责汇总与成文；<br>· <b>审查智能体</b>独立核查事实与引用（不共享写作过程，才能挑出问题）。<br>" +
            '<span class=\"dim\">代价：Token 与协调成本上升，但换来更高的覆盖度与可信度。</span>'
          : "<b>单智能体独立完成：能做完，但容易有盲区。</b><br>" +
            "· 一个人又查又写，容易只挑顺手的资料、漏掉反面证据；<br>· 自己审自己不可靠——写作与核对在同一套假设里进行。<br>" +
            '<span class=\"dim\">结论：信息多、要交叉验证的任务，值得为“独立审查”多花成本。</span>';
      }
    }
  };

  /* 概念 + 交互数据合体 */
  function pgConcepts() {
    return PG_ADV.map(function (c) {
      return {
        id: c.id, icon: c.icon, nav: c.nav, name: c.name, en: c.en,
        tip: c.tip, analogy: c.analogy, real: c.real, quiz: c.quiz, links: c.links,
        demo: PG_TYPE[c.id] || c.id,
        demoData: PG_DEMO[c.id] || {}
      };
    });
  }

  /* 进阶课堂：记录“已探索过哪些概念”，给学生一个可见的进度 */
  var pgSeen = {};

  function pgPaintProgress() {
    var box = $("pg-adv-progress");
    if (!box) return;
    var n = 0;
    Object.keys(pgSeen).forEach(function (k) { if (pgSeen[k]) n++; });
    box.classList.toggle("all", n >= PG_ADV.length);
    box.innerHTML = U.icon(n >= PG_ADV.length ? "check" : "book", 14) +
      " 已探索 <b>" + n + "</b> / " + PG_ADV.length + " 个概念" +
      (n >= PG_ADV.length
        ? '——全看完啦，去上面做个小测验验收一下'
        : "（左边点一个概念，右边就是它的动手实验）");
    var root = $("sec-playground");
    if (!root) return;
    root.querySelectorAll(".adv-nav-btn").forEach(function (b) {
      b.classList.toggle("seen", !!pgSeen[b.getAttribute("data-id")]);
    });
  }

  function bindPgAdv() {
    AgentLab.Adv.bind($("sec-playground"), {
      key: "brain", concepts: pgConcepts(), color: "brain",
      onActive: function (id) { pgSeen[id] = true; pgPaintProgress(); }
    });
    pgPaintProgress();
  }

  /* ============================================================
   * 实验：拆开看看——上下文工程（消息池点选 → 拼出真实请求）
   * 交互由共享引擎 AgentLab.Adv.types.composer 渲染
   * ============================================================ */
  var CTX_DEMO = {
    title: "动手实验：把这一轮的上下文拼出来",
    hint: "按顺序点",
    icon: "archive",
    poolTitle: "① 消息池：这一轮要用到的五条消息（顺序不对会被拦下来）",
    /* 池子顺序刻意打乱；正确答案见下方 note。role 就是真实 API 里的四种角色。 */
    pool: [
      { role: "user", text: "我在北京", tag: "上一轮说过的话——短期记忆（轨迹）原样回放" },
      { role: "user", text: "明天会下雨吗？", tag: "这一轮同学打的问题" },
      { role: "assistant", text: "（先请求调用天气工具，参数：city=北京, date=明天）", tag: "AI 请求调用工具：tool_calls", toolcall: true },
      { role: "tool", text: "北京 明天：小雨，15~19℃，东北风 3 级（真实气象数据）", tag: "执行器调用工具后回传的数据" },
      { role: "system", text: "你是班级小管家……（规则 + 边界说明书）＋ 长期记忆档案：班级知识库", tag: "Harness 组装：规则 + 长期记忆（每次都在，且必须是第一条）" }
    ],
    ctxTitle: "② 已经放进上下文的消息（从上到下就是模型读到的顺序）",
    jsonTitle: "③ 拼好之后，真实请求长这样（messages 数组）",
    rules: { systemFirst: true, toolNeedsCall: true },
    notes: {
      ok: "加入成功",
      used: "这一条已经放进上下文了——真实请求里同一条不会发两遍。",
      systemLate: "system 必须排在最前面：它是“总规则 + 长期记忆档案”，模型从第一条就开始读它，放到后面就晚了。",
      toolEarly: "tool 消息不能单独出现：它必须紧跟在 assistant 的 tool_calls 请求之后，告诉模型“你刚才要的数据在这里”。",
      done: "<span class=\"ok\">✓ 五条齐了！</span>顺序是：<b>system → 历史（上一轮的 user）→ 本轮 user → assistant(tool_calls) → tool</b>。这就是一次真实 Function Calling 请求的完整上下文——和右侧工作台里「拆开看看」显示的那份一模一样。"
    },
    demoNoSystem: {
      label: "对照：如果少了 system（规则 + 长期记忆）",
      skipRole: "system",
      note: "少了 system：模型不知道自己是“班级小管家”，也拿不到班级知识库、边界说明书和当前日期——“明天”相对哪一天、你能问他什么，全都不确定，真实系统里这一段几乎必然答偏。"
    },
    resetLabel: "清空重来",
    emptyCtx: "还没有内容——从上面的消息池里挑一条放进来。想清楚：模型读到的第一条应该是什么？"
  };

  function bindPgCtx() {
    var host = $("pg-ctx");
    if (!host) return;
    var t = AgentLab.Adv.types.composer;
    host.innerHTML = t.demoHTML(CTX_DEMO);
    t.bind(host, CTX_DEMO);

    var runBtn = $("pg-ctx-run");
    if (runBtn) runBtn.addEventListener("click", function () { runInChat("明天会下雨吗？"); });

    var realBtn = $("pg-ctx-real-btn");
    if (realBtn) realBtn.addEventListener("click", function () {
      var box = $("pg-ctx-real");
      var pre = $("pg-ctx-real-pre");
      var isHidden = box.style.display === "none";
      box.style.display = isHidden ? "block" : "none";
      if (!isHidden) return;
      if (lastPayload) {
        pre.textContent = JSON.stringify(lastPayload, null, 2);
      } else {
        pre.textContent =
          "（还没有真实请求记录）先点左边的「真实跑一遍这句话」，再回来看这里。\n\n" +
          "如果暂时没有 DeepSeek API Key，也可以先看工作台里的「拆开看看」按钮说明，或者对照你刚才拼出来的 messages。";
      }
    });
  }

  /* ---------- 实验①：管线阶段预测（预测 → 点亮管线图 → 逐条讲解 → 真实跑） ---------- */
  var PHASE_CASES = [
    {
      id: "hello",
      say: "你好，我叫小明",
      note: "这是这次对话的第一句话（之前没有对话记录）",
      items: [
        { id: "a1", stage: "perception", ok: true, label: "把这句话整理成一条 user 消息", why: "感知器负责把输入（这里是打字）整理成带角色的消息。" },
        { id: "a2", stage: "planner", ok: true, label: "判断“这句不用查工具”", why: "规划器先做判断：打招呼不需要外部数据，不用调工具。" },
        { id: "a3", stage: "memory", ok: true, label: "把班级知识库和之前的对话带进上下文", why: "记忆器把长期记忆（班级知识库）和短期记忆（对话历史）一起放进上下文——这一次历史还是空的。" },
        { id: "a4", stage: "brain", ok: true, label: "生成“你好，小明！”这句回答", why: "最后由大语言模型基于上下文生成回答。" },
        { id: "a5", stage: "executor", ok: false, label: "调用天气工具查一下今天天气", why: "打招呼不需要实时天气——乱调工具既慢又费 Token。" },
        { id: "a6", stage: "perception", ok: false, label: "把同学说话的声音转成文字", why: "这一轮是打字输入，语音通道（ASR）没有参与。" },
        { id: "a7", stage: "memory", ok: false, label: "把“我叫小明”写进长期记忆", why: "同学只说了一次、也没要求“记住”——写长期记忆有成本，也有隐私风险，不是默认动作。" }
      ]
    },
    {
      id: "weather",
      say: "明天会下雨吗？",
      note: "上一轮他说过“我在北京”",
      items: [
        { id: "b1", stage: "perception", ok: true, label: "把“明天会下雨吗”整理成 user 消息", why: "感知器把口语问题整理成结构化上下文。" },
        { id: "b2", stage: "planner", ok: true, label: "判断要不要调用天气工具", why: "规划器负责意图理解与工具选择决策。" },
        { id: "b3", stage: "memory", ok: true, label: "把上一轮的“我在北京”带进上下文", why: "没有城市就问不出天气——记忆器把城市补上了，这正是记忆的价值。" },
        { id: "b4", stage: "executor", ok: true, label: "调用 weather_query 拿到真实天气", why: "实时数据必须由工具提供，模型自己不知道明天的天气。" },
        { id: "b5", stage: "brain", ok: true, label: "生成“明天小雨，记得带伞”", why: "模型基于工具返回的真实结果生成回答。" },
        { id: "b6", stage: "perception", ok: false, label: "把同学上传的照片转成文字", why: "这一轮没有图片输入，OCR 通道用不上。" },
        { id: "b7", stage: "executor", ok: false, label: "顺手把 15~19℃ 换算成华氏度", why: "同学只问下不下雨，没问华氏度——工具要按需调用，顺带转换只会让回答更长更慢。" },
        { id: "b8", stage: "executor", ok: false, label: "调用计算器算 25×4+10", why: "这一轮的任务是查天气，没有计算需求——乱调工具只会浪费 Token。" }
      ]
    },
    {
      id: "calc",
      say: "帮我算 25×4+10",
      note: "接在刚才那轮对话之后",
      items: [
        { id: "c1", stage: "perception", ok: true, label: "把这句话整理成 user 消息", why: "感知器把口语输入整理成结构化消息；算式里的“乘/加”也会在理解阶段被换算成运算符号。" },
        { id: "c2", stage: "planner", ok: true, label: "判断这是计算任务、该用计算器", why: "规划器决定“用哪个工具”，而不是让模型心算——确定性工具更准。" },
        { id: "c3", stage: "memory", ok: true, label: "把班级知识库 + 前几轮对话带进上下文", why: "上下文由记忆器维护：即使这次用不上班级信息，它也会和问题一起被送进大脑。" },
        { id: "c4", stage: "executor", ok: true, label: "调用 calculator 算出 110", why: "计算器是确定性工具：不靠模型猜，结果 100% 精确。" },
        { id: "c5", stage: "brain", ok: true, label: "用同学听得懂的话讲出结果", why: "大脑负责把“110”组织成一句解释。" },
        { id: "c6", stage: "executor", ok: false, label: "调用天气工具查北京明天天气", why: "这一轮没有天气需求——工具要按需调用。" },
        { id: "c7", stage: "planner", ok: false, label: "先让大脑心算一遍，再用计算器验证", why: "确定性计算直接交给工具，不让模型心算——心算可能错，还多花一轮；工具才是干这个的。" }
      ]
    },
    {
      id: "class",
      say: "我是学习委员，今天下午有什么课？",
      note: "班级知识库里存着我们的课表",
      items: [
        { id: "d1", stage: "perception", ok: true, label: "把这句话整理成一条 user 消息", why: "感知器把口语输入整理成带角色的消息。" },
        { id: "d2", stage: "planner", ok: true, label: "判断“这是关于我们班的问题，该翻小本子”", why: "规划器先判断问题类型：班级的事查长期记忆，不该上网搜、更不该瞎猜。" },
        { id: "d3", stage: "memory", ok: true, label: "把班级知识库里的课表带进上下文", why: "长期记忆被“翻”出来，随 system 一起送进上下文——这正是记忆器的核心价值。" },
        { id: "d4", stage: "brain", ok: true, label: "生成“今天下午有……课”的回答", why: "模型基于检索到的课表组织回答。" },
        { id: "d5", stage: "executor", ok: false, label: "调用联网搜索工具去网上找课表", why: "我们班的课表就在长期记忆里，上网搜既慢又搜不到——不是所有问题都该用工具。" },
        { id: "d6", stage: "executor", ok: false, label: "调用天气工具确认今天会不会下雨", why: "这一轮没有天气需求——工具要按需调用。" },
        { id: "d7", stage: "executor", ok: false, label: "调用翻译工具，把课表译成英文", why: "同学用中文问中文课表——工具要按需调用，没人要求翻译就别加戏。" }
      ]
    },
    {
      id: "search",
      say: "搜一下：长颈鹿的脖子为什么那么长",
      note: "这是一个“模型自己不知道、必须上网查”的问题",
      items: [
        { id: "e1", stage: "perception", ok: true, label: "把这句话整理成一条 user 消息", why: "感知器把口语输入整理成消息；“搜一下：”这个前缀会在理解阶段被识别成搜索意图。" },
        { id: "e2", stage: "planner", ok: true, label: "判断“这要上网查资料”，并选好搜索关键词", why: "规划器做的是工具选择决策：这类知识性问题必须调用联网搜索。" },
        { id: "e3", stage: "executor", ok: true, label: "调用联网搜索工具，把查到的资料带回来", why: "模型自己不知道也不该编——外面的资料必须由工具带回来（联网失败时会如实说明，并用大脑已有知识兜底）。" },
        { id: "e4", stage: "brain", ok: true, label: "把查到的资料整理成同学听得懂的回答", why: "工具只给素材，组织成通顺回答是大脑的活儿。" },
        { id: "e5", stage: "brain", ok: false, label: "先凭自己的知识答，再决定要不要搜", why: "知识性问题模型自己就没把握——“先凭印象答”正是幻觉的来源：先搜到资料，再组织回答。" },
        { id: "e6", stage: "executor", ok: false, label: "调用计算器算一下", why: "这一轮没有计算需求——乱调工具既慢又费 Token。" },
        { id: "e7", stage: "memory", ok: false, label: "把搜到的资料加进班级知识库", why: "班级知识库存的是“我们班自己的事”；网上随手搜来的东西混进去，以后就问不清哪句是哪来的了——什么该进长期记忆，要有明确规则。" }
      ]
    },
    {
      id: "remind",
      say: "提醒我明天带美术工具",
      note: "看看这一轮五个环节能不能全都亮起来",
      items: [
        { id: "f1", stage: "perception", ok: true, label: "把这句话整理成一条 user 消息", why: "感知器把口语输入整理成带角色的消息。" },
        { id: "f2", stage: "planner", ok: true, label: "判断这是“记一条提醒”，该用提醒工具", why: "规划器识别意图并选定工具——注意提醒不是计时，别被“明天”骗了。" },
        { id: "f3", stage: "memory", ok: true, label: "把班级知识库 + 前几轮对话带进上下文", why: "上下文由记忆器维护：即使这次用不上班级信息，它也会随问题一起送进大脑。" },
        { id: "f4", stage: "executor", ok: true, label: "调用提醒工具，把内容记下来", why: "真正“动手”的是执行器：工具被调用后才算办成事。" },
        { id: "f5", stage: "brain", ok: true, label: "回答“好的，我记住了，到时间提醒你”", why: "五个环节全参与——这是最“完整”的一轮。" },
        { id: "f6", stage: "executor", ok: false, label: "启动一个 25 分钟倒计时", why: "“提醒”不等于“计时”：没有说“计时 / 倒计时 / 番茄钟”，就不该启动计时器。" },
        { id: "f7", stage: "memory", ok: false, label: "把这条提醒写进长期记忆（关掉网页也还在）", why: "本系统的提醒只记在这次对话里；真实产品要把提醒存进长期记忆或日程表才靠得住——这正是记忆器的用武之地。" }
      ]
    }
  ];

  var PHASE_TAG = { idle: "", picked: "预测中", ok: "✓ 会发生", part: "部分对", miss: "漏了", extra: "不会发生" };

  function stageName(id) {
    var out = id;
    STAGES.forEach(function (s) { if (s.id === id) out = s.name; });
    return out;
  }

  function bindPgPhase() {
    var host = $("pg-phase");
    if (!host) return;

    var caseIdx = 0;
    var picked = {};
    var checked = false;

    function cur() { return PHASE_CASES[caseIdx]; }
    function pickedCount() { return cur().items.filter(function (it) { return picked[it.id]; }).length; }

    /* 管线图上每个环节的“预测状态” */
    function stageStateOf(sid) {
      var items = cur().items.filter(function (it) { return it.stage === sid; });
      var okItems = items.filter(function (it) { return it.ok; });
      var hot = items.filter(function (it) { return picked[it.id]; });
      if (!checked) return hot.length ? "picked" : "idle";
      var hotOk = hot.filter(function (it) { return it.ok; }).length;
      var hotWrong = hot.length - hotOk;
      if (okItems.length && hotWrong) return "part";          // 选错了：这一环既有漏、也有多
      if (okItems.length && hotOk === okItems.length) return "ok";
      if (okItems.length) return "miss";                       // 该发生却没选
      return hotWrong ? "extra" : "idle";                      // 这一环整环都不会发生
    }

    function scoreHTML() {
      var items = cur().items;
      var ok = items.filter(function (i) { return i.ok; });
      var hit = ok.filter(function (i) { return picked[i.id]; }).length;
      var miss = ok.length - hit;
      var over = items.filter(function (i) { return !i.ok && picked[i.id]; }).length;
      return '<b>命中 ' + hit + "/" + ok.length + "</b>" +
        (miss ? ' · <span class="bad">漏选 ' + miss + "</span>" : "") +
        (over ? ' · <span class="bad">多选 ' + over + "</span>" : "") +
        (!miss && !over ? ' · <span class="good">全部正确，你已经是管线小行家！</span>' : "");
    }

    function render() {
      var c = cur();

      var mapHTML = STAGES.map(function (s, i) {
        var stt = stageStateOf(s.id);
        return (i ? '<span class="pg-map-arrow">›</span>' : "") +
          '<div class="pg-map-node c-' + s.color + ' is-' + stt + '">' +
            '<span class="pg-map-ico">' + U.icon(s.icon, 18) + "</span>" +
            '<span class="pg-map-name">' + s.name + "</span>" +
            '<span class="pg-map-tag">' + (PHASE_TAG[stt] || "") + "</span>" +
          "</div>";
      }).join("");

      var pickHTML = c.items.map(function (it) {
        var on = !!picked[it.id];
        /* 检查后的四种标记：
         *   hit  ✓ 你选对了 · over ✗ 你选了“不会发生”的 · miss ✗ 该选的你没选 · 无标记 = 正确地没选 */
        var res = "";
        if (checked) res = on ? (it.ok ? "hit" : "over") : (it.ok ? "miss" : "");
        return '<button type="button" class="pg-pick' + (on ? " on" : "") + (res ? " r-" + res : "") + '" data-id="' + it.id + '">' +
          '<span class="pg-pick-box">' + (res === "hit" ? "✓" : res ? "✗" : "") + "</span>" +
          '<span class="pg-pick-text">' + it.label +
            '<i class="pg-pick-stage c-' + it.stage + '">' + stageName(it.stage) + "</i>" +
          "</span>" +
        "</button>";
      }).join("");

      var whyHTML = checked ? '<div class="pg-why">' + c.items.map(function (it) {
        if (!picked[it.id] && !it.ok) return "";
        var good = it.ok === !!picked[it.id];
        return '<div class="pg-why-row ' + (good ? "is-ok" : "is-no") + '">' +
          U.icon(good ? "check" : "xmark", 13) +
          "<span><b>" + it.label + "</b>" + it.why + "</span></div>";
      }).join("") + "</div>" : "";

      host.innerHTML =
        '<div class="pg-case">' +
          '<div class="pg-case-say">' + U.icon("chat", 15) + '这一轮用户说：<b>“' + U.esc(c.say) + '”</b>' +
            '<span class="pg-case-note">' + U.esc(c.note) + "</span></div>" +
          '<button class="btn btn-ghost btn-sm" id="pg-phase-change">' + U.icon("refresh", 14) + " 换一题</button>" +
        "</div>" +
        '<div class="pg-map">' + mapHTML + "</div>" +
        '<div class="pg-map-hint">这张图会跟着你的选择亮起来：先预测，再点「检查我选的环节」。</div>' +
        '<div class="pg-picks">' + pickHTML + "</div>" +
        '<div class="pg-phase-actions">' +
          '<button class="btn btn-brain btn-sm" id="pg-phase-check">' + U.icon("target", 14) + " 检查我选的环节</button>" +
          '<button class="btn btn-ghost btn-sm" id="pg-phase-reset">重来</button>' +
          '<button class="btn btn-ghost btn-sm" id="pg-phase-run">' + U.icon("send", 14) + " 真实跑一遍这句话</button>" +
        "</div>" +
        '<div class="adv-out pg-outs" id="pg-phase-fb">' +
          (checked
            ? scoreHTML() + whyHTML
            : "先点选你认为这一轮会发生的动作（选中的会在上图点亮；不确定就少选，多选也算错）。") +
        "</div>";

      host.querySelectorAll(".pg-pick").forEach(function (b) {
        b.addEventListener("click", function () {
          if (checked) return;
          var id = b.getAttribute("data-id");
          picked[id] = !picked[id];
          render();
        });
      });
      var checkBtn = $("pg-phase-check");
      if (checkBtn) checkBtn.addEventListener("click", function () {
        if (!pickedCount()) { U.toast("先至少选一条再检查～"); return; }
        checked = true;
        render();
      });
      var resetBtn = $("pg-phase-reset");
      if (resetBtn) resetBtn.addEventListener("click", function () {
        picked = {};
        checked = false;
        render();
      });
      var changeBtn = $("pg-phase-change");
      if (changeBtn) changeBtn.addEventListener("click", function () {
        caseIdx = (caseIdx + 1) % PHASE_CASES.length;
        picked = {};
        checked = false;
        render();
      });
      var runBtn = $("pg-phase-run");
      if (runBtn) runBtn.addEventListener("click", function () { runInChat(cur().say); });
    }

    render();
  }

  /* 把真实开关状态刷回上方工作台的复选框（实验② → 工作台方向） */
  function syncFlagBoxes() {
    document.querySelectorAll("#pg-flags input[type=checkbox]").forEach(function (cb) {
      cb.checked = Agent.flags[cb.getAttribute("data-flag")] !== false;
    });
  }

  /* ---------- 全班对照实验：同一句话，A 组关记忆 / B 组关规划 ----------
   * 复用共享引擎的 race（双轨并排推进）——这里只喂数据，交互逻辑不另写一套。
   * onDone：两栏都走完时由引擎回调（adv-classroom.js 的 fireOnDone），
   *         用来展开上方预测条的「你猜对了吗」对照结果。 */
  var PG_AB_DEMO = {
    color: "brain",
    title: "同一句话，两组各走到哪一步？",
    hint: "双轨推进 · 先下注再看",
    icon: "users",
    taskLabel: "同一个任务：",
    task: "“上次说的那个提醒，帮我改成周五下午 4 点。”",
    stepLabel: "走一步（两组同时推进）",
    allLabel: "一次走完",
    resetLabel: "重来",
    onDone: function () { U.predictResolve("pg-ab"); },
    tracks: [
      {
        id: "noMem", label: "A 组：关掉记忆器", icon: "book",
        steps: [
          { t: "第 1 步：收到请求 ——「改成周五下午 4 点」。", tone: "dim" },
          { t: "第 2 步：规划器开始拆 —— 改的是哪个提醒？得先想起“上次说的那个”。", tone: "warn" },
          { t: "第 3 步：去翻记忆 —— <b>记忆器是关着的，里面什么都没有</b>。", tone: "no" },
          { t: "第 4 步：只能反问用户 ——「你说的是哪个提醒？请把内容再说一遍。」", tone: "no" },
          { t: "第 5 步：用户把说过的话重说一遍，才勉强做下去。", tone: "warn" }
        ],
        tail: "结局：能做，但要多花一轮，还要用户重复自己说过的话——这不是“记不住”，是“根本没记”。"
      },
      {
        id: "noPlan", label: "B 组：关掉规划器", icon: "gear",
        steps: [
          { t: "第 1 步：收到请求。记忆里确实存着「周三 8:00 交美术作业」这条提醒。", tone: "dim" },
          { t: "第 2 步：规划器关着 —— <b>不由模型决定怎么做，改由本地规则做单步判定</b>：它只会按关键词挑一个工具，不会拆步骤、更不会“先查再改再确认”。", tone: "warn" },
          { t: "第 3 步：规则挑中“提醒”工具，可它只收一个参数——<b>要提醒的内容原文</b>。“上次说的那个提醒”到底该填成什么？没有人负责把这句话展开成明白话。", tone: "no" },
          { t: "第 4 步：它只能把原话硬塞进去、或者凭感觉猜一个内容 —— 猜错了，就等于把提醒改成了另一件事。", tone: "no" },
          { t: "第 5 步：工具报错或写错，用户还得回头检查一遍。", tone: "warn" }
        ],
        tail: "结局：记得住，却办不成——有记忆不等于会办事，“把话变成步骤”是另一件事；规则只会单步匹配，接不住要拆步的活。"
      }
    ],
    summary: "<b>结论：</b>四样零件<b>串成一条接力链</b>：感知器把世界变成上下文 → 规划器决定怎么做 → 记忆器决定记住什么 → 执行器把决定变成动作（结果还会流回大脑，进入下一轮）。缺了哪一段，整条链就在那一段断掉，<b>而且断点各不相同</b>。<br>" +
      "<b>两组对照着看：</b>A 组缺记忆，后果是“认不出对象、要多问一轮”；B 组缺规划，后果是“记得住却办不成、还可能猜错参数”。这也正好解释了为什么评估一个智能体不能只看“答得好不好”——要看<b>是哪一环出了问题</b>。",
    quiz: {
      q: "为什么“关掉一个组件”，整件事就做不成了？",
      opts: [
        "因为它们串成一条接力链——上一步的输出是下一步的输入（执行器的结果还会流回大脑），断一段就断整条链",
        "因为关掉组件会让模型本身变笨",
        "因为四个组件本来可以互相替代，只是这次没替代上"
      ],
      ans: 0,
      why: "四样零件不是四个可选插件，而是一条流水线：感知器产出上下文、规划器产出步骤、记忆器产出可复用的结论、执行器产出真实动作；而且执行器的结果会作为 tool 角色流回大脑，进入下一轮。任何一段断了，下游都拿不到输入，所以是“断一段 = 断整条链”。",
      hint: "想想接力赛——掉了棒的那一棒之后，后面的人还跑得下去吗？"
    }
  };

  function bindPgAb() {
    var host = $("pg-ab");
    if (!host) return;
    host.innerHTML = AgentLab.Adv.types.race.demoHTML(PG_AB_DEMO);
    AgentLab.Adv.types.race.bind(host, PG_AB_DEMO);
  }

  /* ---------- 多步任务示例：离线逐步演示 + 真机实跑 ---------- */
  function bindPgMulti() {
    var demo = $("pg-multi-demo");
    var step = $("pg-multi-step");
    var reset = $("pg-multi-reset");
    var run = $("pg-multi-run");
    if (!demo) return;
    multiIdx = 0;
    multiRender();
    demo.addEventListener("click", multiPlay);
    step.addEventListener("click", function () {
      if (busy) { U.toast("正在真实运行，等它跑完再演示～"); return; }
      if (multiTimer) { clearTimeout(multiTimer); multiTimer = null; }
      multiStep();
    });
    reset.addEventListener("click", multiReset);
    if (run) {
      run.addEventListener("click", function () {
        multiReset();            /* 先清空，免得离线轨迹和真实运行混在一起 */
        send(PG_COMPLEX_TASK);
      });
    }
  }

  /* ---------- 实验②：组件开关对能力的影响（与工作台开关双向联动） ---------- */
  function bindPgSwitch() {
    var host = $("pg-switch");
    if (!host) return;
    var d = {
      color: "brain",
      title: "动手实验：关掉一个组件，哪件事就做不成了？", hint: "点开关（与上方工作台联动）", icon: "target",
      chipsTitle: "① 当前开启的组件（点一下即可关掉，上方工作台的开关会跟着变）：",
      chips: [
        { id: "perception", label: "感知器（观察 / 把输入变成上下文）", on: Agent.flags.perception !== false },
        { id: "planner", label: "规划器（决策 / 决定要不要用工具、用哪个）", on: Agent.flags.planner !== false },
        { id: "memory", label: "记忆器（上下文 / 短期 + 长期）", on: Agent.flags.memory !== false },
        { id: "executor", label: "执行器（真正调用工具）", on: Agent.flags.executor !== false }
      ],
      /* 开关一变，真实运行环境也跟着变——这就是“Harness 约束” */
      onToggle: function (chips, id) {
        chips.forEach(function (c) { Agent.flags[c.id] = !!c.on; });
        syncFlagBoxes();
        flagTipHTML();
        U.toast((Agent.flags[id] ? "已打开：" : "已关闭：") + FLAG_LABELS[id] + "（上方工作台已同步）");
      },
      viewTitle: "当前开启的组件",
      viewNote: "大脑（模型）不在开关里——它关掉就彻底不能用了，所以这里只演示“组件级”的约束。",
      viewEmpty: "四个组件全关：只剩一个大模型，它只能凭记忆聊天。",
      actionsTitle: "② 这些事还做得成吗？",
      actions: [
        { id: "t1", label: "听懂你打的字（把输入变成上下文）", need: ["perception"], hint: "没有感知器，模型连你的问题都收不到。" },
        { id: "t2", label: "判断“这个问题要不要查工具”", need: ["planner"], hint: "没有规划器，模型不知道该不该动手、该用哪个工具。" },
        { id: "t3", label: "记住上一轮说的“我在北京”", need: ["memory"], hint: "没有记忆器，每次对话都从零开始问“你在哪个城市”。" },
        { id: "t4", label: "真正调用天气 / 计算器工具", need: ["executor"], hint: "没有执行器，工具就只是“说明书”，谁也调不动。" },
        { id: "t5", label: "准确回答“明天会下雨吗”", need: ["perception", "planner", "executor"], hint: "这一件事要三环配合：收到问题、决定查工具、真正查回来。" },
        { id: "t6", label: "回答“我是学习委员，课表怎么安排”", need: ["perception", "memory"], hint: "要同时用到“听懂问题”和“记住身份”，缺一个就只能泛泛回答。" },
        { id: "t7", label: "带着记忆回答后面的追问（不用再问一遍“你在哪”）", need: ["memory", "planner"], hint: "记忆器提供上下文，规划器决定这轮还要不要调用工具——两者配合才叫“记得住、用得上”。" }
      ],
      resultEmpty: "点一件事试一试。",
      afterToggle: "组件状态变了——再点下面某件事，看看还做不做得成。（也可以用下面的按钮真实跑一句）",
      failTail: "对应组件被关掉了——Agent 在这一环的本领就变小了（这正是“给 Agent 加约束”的直观含义）。",
      okTail: "所需组件都开着，这一步能完成。",
      onIcon: "check", offIcon: "xmark"
    };
    host.innerHTML = AgentLab.Adv.types.switchboard.demoHTML(d);
    switchDemoApi = AgentLab.Adv.types.switchboard.bind(host, d);

    var runBtn = $("pg-switch-run");
    if (runBtn) runBtn.addEventListener("click", function () { runInChat(pickTestQuestion()); });
  }

  /* ============================================================
   * 实验：给智能体做一次“体检”（评估）
   * 固定题集 + 明确指标 + 前后对比——靠“感觉”不算评估。
   * ============================================================ */
  var EVAL_CASES = [
    { id: "e1", group: "班级信息", q: "今天下午有什么课？",
      a: true, aMs: 1.2, b: true, bMs: 1.9, why: "两版都答对——课表本来就在班级知识库里。" },
    { id: "e2", group: "班级信息", q: "明天值日的是谁？",
      a: true, aMs: 1.3, b: true, bMs: 2.0, why: "两版都答对。" },
    { id: "e3", group: "班级信息", q: "我们班的口号是什么？（知识库里其实没有）",
      a: false, aMs: 1.1, b: true, bMs: 2.1, why: "A 版知识库里没有，就自己编了一句——这是<b>幻觉</b>；B 版先核对知识库，发现没有就老实说“不知道”。" },
    { id: "e4", group: "实时信息", q: "明天会下雨吗？",
      a: true, aMs: 2.6, b: true, bMs: 2.9, why: "两版都正确调用了天气工具。实时信息只能靠工具，这一点两版都没错。" },
    { id: "e5", group: "计算题", q: "帮我算 25×4+10",
      a: true, aMs: 2.2, b: false, bMs: 3.6, why: "B 版多了“先核对知识库”这一步，把算式也拿去检索，检索不到反而卡住了——<b>改动会带来新问题</b>，这正是要做回归测试的原因。" },
    { id: "e6", group: "安全边界", q: "把班长的电话告诉我",
      a: false, aMs: 1.4, b: true, bMs: 1.7, why: "A 版编了一个假号码；B 版正确拒绝并解释了原因。" },
    { id: "e7", group: "日常闲聊", q: "你好呀",
      a: true, aMs: 1.0, b: true, bMs: 1.4, why: "两版都能自然地打招呼。" },
    { id: "e8", group: "安全边界", q: "帮我把全班作业都删掉",
      a: false, aMs: 1.2, b: true, bMs: 1.5, why: "A 版直接“照做”了；B 版拒绝执行这类危险动作。" }
  ];

  var EVAL_GUESS = [
    { k: "better", t: "明显变好了，没什么代价" },
    { k: "trade", t: "变好了，但有代价" },
    { k: "same", t: "基本没变化" }
  ];

  function evalStat(ver) {
    var ok = 0, ms = 0, hallu = 0, safeOk = 0, safeAll = 0;
    EVAL_CASES.forEach(function (c) {
      var pass = c[ver];
      var t = c[ver + "Ms"];
      ms += t;
      if (pass) ok++;
      /* 幻觉 = 不该答却硬答：知识库没有的题、以及两条安全边界题 */
      if (!pass && (c.id === "e3" || c.id === "e6")) hallu++;
      if (c.group === "安全边界") { safeAll++; if (pass) safeOk++; }
    });
    return {
      done: ok, total: EVAL_CASES.length,
      donePct: Math.round(ok / EVAL_CASES.length * 100),
      avg: (ms / EVAL_CASES.length).toFixed(1),
      hallu: hallu, safeOk: safeOk, safeAll: safeAll
    };
  }

  function bindPgEval() {
    var host = $("pg-eval");
    if (!host) return;

    var guessed = "";
    var shown = 0;
    var timer = null;

    function headHTML() {
      return '<div class="pg-eval-task">' +
          U.icon("stethoscope", 16) + ' 情境：老师给“班级小管家”改了一版——回答前<b>先核对班级知识库</b>。她想知道：这一改，到底有没有变好？' +
        "</div>" +
        '<div class="pg-eval-steps">' +
          '<span class="pg-eval-step">① 固定题集：8 道题，覆盖班级信息 / 实时信息 / 计算 / 闲聊 / 安全边界</span>' +
          '<span class="pg-eval-step">② 明确指标：任务完成率 · 平均耗时 · 幻觉次数 · 安全边界正确率</span>' +
          '<span class="pg-eval-step">③ 前后对比：同一份卷子，A 版（改动前）和 B 版（改动后）各跑一遍</span>' +
        "</div>";
    }

    function guessHTML() {
      return '<div class="pg-eval-guess"><b>先猜一猜：</b>改完之后，整体会怎样？' +
        '<div class="adv-row" style="margin-top:8px">' +
          EVAL_GUESS.map(function (g) {
            return '<button type="button" class="adv-chip' + (guessed === g.k ? " on" : "") + '" data-k="' + g.k + '">' + g.t + "</button>";
          }).join("") +
        "</div>" +
        '<div class="pg-eval-guessfb">' +
          (guessed ? "已经记下你的预测——点下面的按钮跑测试集，看看猜得对不对。" : "先选一个再跑，<b>先预测、后对照</b>才会记得牢。") +
        "</div>" +
      "</div>";
    }

    function tableHTML() {
      if (!shown) return '<div class="pg-eval-hint">还没有结果——准备好就点上面的「跑这份测试集」。</div>';
      return '<table class="pg-eval-table"><thead><tr>' +
          "<th>#</th><th>测试题</th><th>A 版（改动前）</th><th>B 版（改动后）</th>" +
        "</tr></thead><tbody>" +
        EVAL_CASES.slice(0, shown).map(function (c, i) {
          function cell(pass, t) {
            return '<td class="' + (pass ? "yes" : "no") + '">' + (pass ? "✓ 完成" : "✗ 没完成") +
              '<i class="pg-eval-ms">' + t + "s</i></td>";
          }
          return "<tr><td>" + (i + 1) + "</td><td>" + c.q + '<i class="pg-eval-group">' + c.group + "</i></td>" +
            cell(c.a, c.aMs) + cell(c.b, c.bMs) + "</tr>";
        }).join("") +
      "</tbody></table>";
    }

    function metricsHTML() {
      if (shown < EVAL_CASES.length) return "";
      var A = evalStat("a"), B = evalStat("b");
      function row(name, av, bv, better) {
        var cls = better === "up" ? "up" : better === "down" ? "down" : "flat";
        return "<tr><td>" + name + "</td><td>" + av + "</td><td>" + bv + "</td>" +
          '<td class="' + cls + '">' + (better === "up" ? "↑ 变好" : better === "down" ? "↑ 升高" : "≈ 持平") + "</td></tr>";
      }
      var verdict = guessed === "trade"
        ? '<span class="ok">你猜对了！</span>'
        : (guessed ? '<span class="no">你的预测和结果不完全一样——</span>' : "");
      return '<div class="pg-eval-metrics">' +
          '<div class="pg-eval-mtitle">' + U.icon("target", 15) + " 指标表（同一份卷子，两个版本）</div>" +
          '<table class="pg-eval-table"><thead><tr><th>指标</th><th>A 版</th><th>B 版</th><th>变化</th></tr></thead><tbody>' +
            row("任务完成率", A.donePct + "%（" + A.done + "/" + A.total + "）", B.donePct + "%（" + B.done + "/" + B.total + "）", B.done > A.done ? "up" : "flat") +
            row("平均耗时", A.avg + " 秒", B.avg + " 秒", B.avg > A.avg ? "down" : "flat") +
            row("幻觉次数（不知道却硬答）", A.hallu + " 次", B.hallu + " 次", B.hallu < A.hallu ? "up" : "flat") +
            row("安全边界正确率", A.safeOk + "/" + A.safeAll, B.safeOk + "/" + B.safeAll, B.safeOk > A.safeOk ? "up" : "flat") +
          "</tbody></table>" +
        "</div>" +
        '<div class="pg-eval-concl">' + U.icon("info", 16) + "<div>" + verdict +
          "<b>结论：B 版确实更靠谱了</b>——不该答的会说“不知道”，危险动作会拒绝，完成率从 62.5% 提到 87.5%。" +
          "但它<b>变慢了</b>（平均 " + A.avg + " 秒 → " + B.avg + " 秒），而且第 5 题<b>反而变差了</b>——多加的那一步把算式也挡在了外面。<br>" +
          "<b>这就是为什么评估要看一整张表：</b>只看“完成率”会以为稳赚；把耗时和逐题结果摆出来，才知道这笔改动有得有失，值不值得上线。<br>" +
          '<span class="dim">还有一句要记住：题集是固定的——换个人、换一天来跑，题目和指标都一样，结论才能比较。靠“自己试几句感觉不错”，换个问题结论就可能反过来。</span>' +
        "</div></div>";
    }

    function paint() {
      host.innerHTML = headHTML() + guessHTML() +
        '<div class="pg-try">' +
          '<button type="button" class="btn btn-brain btn-sm" id="pg-eval-run">' + U.icon("target", 14) + " 跑这份测试集（8 题 × 2 版）</button>" +
          (shown ? '<button type="button" class="btn btn-ghost btn-sm" id="pg-eval-reset">重新开始</button>' : "") +
        "</div>" +
        tableHTML() + metricsHTML();

      host.querySelectorAll(".pg-eval-guess .adv-chip").forEach(function (b) {
        b.addEventListener("click", function () {
          guessed = b.getAttribute("data-k");
          host.querySelectorAll(".pg-eval-guess .adv-chip").forEach(function (x) {
            x.classList.toggle("on", x === b);
          });
          var fb = host.querySelector(".pg-eval-guessfb");
          if (fb) fb.innerHTML = "已经记下你的预测——点下面的按钮跑测试集，看看猜得对不对。";
        });
      });

      var runBtn = $("pg-eval-run");
      if (runBtn) runBtn.addEventListener("click", function () {
        if (!guessed) { U.toast("先选一个预测吧——先猜后看才记得牢"); return; }
        if (timer) clearInterval(timer);
        shown = 0;
        paint();
        timer = setInterval(function () {
          shown++;
          paint();
          if (shown >= EVAL_CASES.length) {
            clearInterval(timer);
            timer = null;
            U.toast("测试集跑完了——看下面的指标表", "success");
          }
        }, 200);
      });

      var resetBtn = $("pg-eval-reset");
      if (resetBtn) resetBtn.addEventListener("click", function () {
        if (timer) { clearInterval(timer); timer = null; }
        shown = 0; guessed = "";
        paint();
      });
    }

    paint();
  }

  /* ============================================================
   * 实验：读轨迹，找故障（可观测性 / Trace）
   * 智能体不会自己说“我第 3 步错了”——只能靠轨迹倒推。
   * ============================================================ */
  var TRACE_CASES = [
    {
      id: "t1",
      title: "案例一：查到的天气，城市却不对",
      scene: "同学上一轮刚说过“我在上海”，这一轮问“明天会下雨吗？”",
      answer: "memory",
      trace: [
        { s: "perception", t: "收到「明天会下雨吗？」→ 整理成一条 user 消息", ms: "0.1s" },
        { s: "planner", t: "判断要查天气 → 选定 weather_query", ms: "0.3s" },
        { s: "memory", t: "翻小本子：班级知识 3 条；本次对话 0 轮 —— 上一轮的「我在上海」没有被带进来", ms: "0.2s" },
        { s: "executor", t: "调用 weather_query(city=北京, date=明天) → 返回北京的真实天气", ms: "1.8s" },
        { s: "brain", t: "基于工具结果回答：“明天北京小雨，记得带伞”", ms: "1.4s" }
      ],
      why: "工具本身完全正常（查的是真数据），大脑也只是照着上下文回答。问题出在<b>记忆器</b>：该带进上下文的“我在上海”没带上，于是规划器只能按默认城市查北京——上下文缺了一块，后面每一步都“合法地”错下去。"
    },
    {
      id: "t2",
      title: "案例二：明明没查到，却给出了具体数字",
      scene: "课堂网络断了，天气工具取不到数据",
      answer: "brain",
      trace: [
        { s: "perception", t: "收到「明天会下雨吗？」→ 整理成 user 消息", ms: "0.1s" },
        { s: "planner", t: "判断要查天气 → 选定 weather_query", ms: "0.3s" },
        { s: "memory", t: "翻小本子：班级知识 3 条 + 上一轮对话", ms: "0.2s" },
        { s: "executor", t: "调用 weather_query → 返回“天气服务暂时不可用（网络不通）”", ms: "6.2s" },
        { s: "brain", t: "回答：“明天小雨，15~19℃” ← 工具并没有给出任何数字", ms: "1.3s" }
      ],
      why: "前面三环都没问题，执行器也<b>如实</b>报告了“查不到”。错在<b>大脑</b>：它无视“没有数据”，凭印象编了一组数字——这就是<b>幻觉</b>。真实系统还会在 Harness 里加一道<b>结果校验</b>（数字必须来自工具），编造一旦出现就被拦下。"
    },
    {
      id: "t3",
      title: "案例三：同一件事查了 5 遍，最后超时",
      scene: "工具其实每次都成功返回了，任务却一直结束不了",
      answer: "planner",
      trace: [
        { s: "perception", t: "收到「明天会下雨吗？」→ 整理成 user 消息", ms: "0.1s" },
        { s: "planner", t: "第 1 次：要查天气 → 调用 weather_query", ms: "0.3s" },
        { s: "executor", t: "第 1 次调用成功，返回“小雨 15~19℃”", ms: "1.6s" },
        { s: "planner", t: "第 2 次：没看结果就再次判断“要查天气” → 又调用一次（重复 5 次）", ms: "8.4s" },
        { s: "brain", t: "回答：“抱歉，我还没查到”", ms: "1.1s" }
      ],
      why: "执行器每次都<b>成功</b>了，数据也回来了，但<b>规划器</b>没有“看结果再决定要不要再来一轮”，于是一圈一圈空转。真实系统会给循环设<b>终止条件</b>：任务完成、达到最大轮数、或出现不可恢复错误——这就是 Agent 循环的“刹车”。"
    }
  ];

  var TRACE_OPTS = [
    { k: "perception", t: "感知器", d: "输入的整理 / 编码出错" },
    { k: "planner", t: "规划器", d: "意图判断、工具选择或循环控制出错" },
    { k: "memory", t: "记忆器", d: "该带进上下文的没带上（或带错了）" },
    { k: "executor", t: "执行器", d: "工具调用本身出错" },
    { k: "brain", t: "大脑（大模型）", d: "照着上下文生成时出问题" }
  ];

  function traceStageMeta(id) {
    var s = null;
    STAGES.forEach(function (x) { if (x.id === id) s = x; });
    return s || { name: id, icon: "info", color: "brain" };
  }

  function bindPgTrace() {
    var host = $("pg-trace");
    if (!host) return;

    var idx = 0;
    var picked = "";
    var checked = false;

    function paint() {
      var c = TRACE_CASES[idx];
      host.innerHTML =
        '<div class="pg-case">' +
          '<div class="pg-case-say">' + U.icon("microscope", 15) + "<b>" + c.title + "</b>" +
            '<span class="pg-case-note">' + c.scene + "</span></div>" +
          '<button type="button" class="btn btn-ghost btn-sm" id="pg-trace-change">' + U.icon("refresh", 14) + " 换一个案例</button>" +
        "</div>" +
        '<div class="pg-trace">' +
          c.trace.map(function (r) {
            var m = traceStageMeta(r.s);
            var isBad = checked && r.s === c.answer;
            return '<div class="pg-trace-row c-' + m.color + (isBad ? " is-bad" : "") + '">' +
              '<span class="pg-trace-who">' + U.icon(m.icon, 13) + " " + m.name + "</span>" +
              '<span class="pg-trace-txt">' + r.t + "</span>" +
              '<span class="pg-trace-ms">' + r.ms + "</span>" +
            "</div>";
          }).join("") +
        "</div>" +
        '<div class="pg-trace-q">' + U.icon("target", 14) + " 这一轮的故障，出在哪一环？点一个答案：</div>" +
        '<div class="pg-trace-opts">' +
          TRACE_OPTS.map(function (o) {
            var cls = "pg-trace-opt";
            if (picked === o.k) cls += " on";
            if (checked && o.k === c.answer) cls += " r-hit";
            if (checked && picked === o.k && picked !== c.answer) cls += " r-over";
            return '<button type="button" class="' + cls + '" data-k="' + o.k + '">' +
              "<b>" + o.t + "</b><small>" + o.d + "</small></button>";
          }).join("") +
        "</div>" +
        '<div class="adv-out pg-outs">' + (checked
          ? (picked === c.answer
              ? '<span class="good">✓ 判断正确！</span>'
              : '<span class="bad">✗ 再想想——正确的环节已经标出来了。</span>') +
            '<div class="pg-why"><div class="pg-why-row is-ok">' + U.icon("check", 13) + "<span>" + c.why + "</span></div></div>"
          : "看完上面的轨迹再回答：哪一步的输出<b>和别人对不上</b>？（提示：先找“第一个不对劲的地方”，而不是看最后的回答。）") +
        "</div>" +
        '<div class="pg-trace-actions">' +
          '<button type="button" class="btn btn-brain btn-sm" id="pg-trace-check">' + U.icon("check", 14) + " 检查我的判断</button>" +
          '<button type="button" class="btn btn-ghost btn-sm" id="pg-trace-reset">重来</button>' +
        "</div>" +
        '<div class="tip pg-trace-note">' + U.icon("info", 16) +
          " 工程师把这样一串记录叫做 <b>Trace（轨迹）</b>。没有它，你只能看到最后那句错话，永远不知道是感知、规划、记忆、执行还是大脑的锅——" +
          "所以真实系统会<b>把每一步都记进日志</b>。上面工作台里的「本轮轨迹」，就是这个东西的课堂版。" +
        "</div>";

      host.querySelectorAll(".pg-trace-opt").forEach(function (b) {
        b.addEventListener("click", function () {
          if (checked) return;
          picked = b.getAttribute("data-k");
          paint();
        });
      });
      var cb = $("pg-trace-check");
      if (cb) cb.addEventListener("click", function () {
        if (!picked) { U.toast("先点一个答案，再检查～"); return; }
        checked = true;
        paint();
      });
      var rb = $("pg-trace-reset");
      if (rb) rb.addEventListener("click", function () { picked = ""; checked = false; paint(); });
      var chb = $("pg-trace-change");
      if (chb) chb.addEventListener("click", function () {
        idx = (idx + 1) % TRACE_CASES.length;
        picked = ""; checked = false; paint();
      });
    }

    paint();
  }

  /* ---------- 学习目标 / 小测验 / 课堂小结 ---------- */
  var PG_QUIZ = [
    { q: "现代智能体的最小工程公式是？", opts: ["LLM + 上下文 + 工具", "模型 + 网页 + 麦克风", "数据库 + 服务器 + 界面"], ans: 0, why: "ai-agent-book 第 1 章：大脑负责生成，上下文决定它知道什么，工具决定它能做什么。" },
    { q: "智能体与聊天机器人最本质的区别是？", opts: ["回答更长更详细", "能观察结果并据此再决策（闭环）", "用了更贵的模型"], ans: 1, why: "关键在“观察 → 再决策”的闭环：聊天机器人答完就结束，智能体会根据行动结果决定下一步。" },
    { q: "下面哪件事<b>不</b>是 Harness（编排层）负责的？", opts: ["管理上下文与工具接口", "加约束、验证结果、出错纠正", "训练模型参数"], ans: 2, why: "训练是模型侧的事；Harness 管的是模型外面的工程层：上下文、工具、约束、验证、纠正与审计。" },
    { q: "要判断“这次改动让智能体变好了吗”，最靠谱的做法是？", opts: ["自己试几句，感觉一下", "用固定测试集 + 明确指标，改动前后对比", "看回答字数是不是变多了"], ans: 1, why: "可重复、可比较才算评估：固定题集、量化指标、前后对比基线。" },
    { q: "什么情况下<b>不适合</b>上多智能体？", opts: ["任务能清晰拆成独立子任务", "任务简单、一次就能做好", "需要一人生成、一人独立审查"], ans: 1, why: "任务太简单时，多智能体的沟通与协调成本大于收益——能一个人做完就别组队。" },
    { q: "下面哪一样<b>不会</b>出现在发给模型的这一轮上下文里？", opts: ["system 里的规则与长期记忆档案", "之前几轮说过的话（轨迹回放）", "模型训练时用过的全部原始语料"], ans: 2, why: "上下文是 Harness 临时“搭”出来的：规则 + 长期记忆 + 轨迹 + 工具结果。训练语料早就融进模型参数里了，不会在每次请求时再发一遍。" },
    { q: "智能体答错了，工程师最先靠什么找出是哪一环的问题？", opts: ["重新训练一遍模型", "本轮的轨迹（Trace）日志", "换一个更贵的模型再试"], ans: 1, why: "靠<b>轨迹</b>倒推：每一步的输入输出都记着，才能定位是感知、规划、记忆、执行还是大脑的问题。没有记录就只能瞎猜。" },
    { q: "下面哪种操作最应该“先问人再执行”（人在环）？", opts: ["查一下明天的天气", "删除全班的作业记录", "把一段话换个说法"], ans: 1, why: "删除数据不可撤销、影响大，属于危险动作，必须人工确认；查天气、改写句子这类可逆或只读的操作，才适合自动执行。" },
    { q: "关于智能体的“循环”，下面说法正确的是？", opts: ["循环越多轮说明越聪明", "必须有终止条件：任务完成 / 达到最大轮数 / 不可恢复错误", "模型够聪明就一定会自己停下来"], ans: 1, why: "循环没有“刹车”就会空转、烧钱、甚至卡死。真实系统会设最大轮数、超时和错误上限——案例三里查了 5 遍天气的就是少这个。" },
    { q: "工具调用失败（比如断网查不到天气）时，靠谱的智能体应该怎么做？", opts: ["凭印象给一个大概的数字", "如实说“没查到”，并给出替代方案", "什么都不说，直接断开"], ans: 1, why: "查不到就说查不到——编造数字是最危险的幻觉。如实告知 + 给出替代方案（比如“稍后再试”或“你可以自己看看窗外”），才是可信的表现。" }
  ];

  /* ---------- 小测验（单题闯关） ---------- */
  function bindPgQuiz() {
    AgentLab.Quiz.mount({
      host: "pg-quiz-body",
      color: "brain",
      name: "智能体小达人",
      star: "pg-quiz-score",
      restart: "pg-quiz-restart",
      questions: PG_QUIZ,
      hint: "再想想——可以回到上面的内部工作台和进阶课堂里找线索。"
    });
  }

  return { render: render };
})();
