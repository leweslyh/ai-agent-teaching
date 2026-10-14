/* ============================================================
 * lab-memory.js —— 记忆器实验室（对应 L09 / L10）
 * 13 模块：学习目标 → 认识记忆器+层次结构 → 短期记忆实验
 *   → 记忆三层次评估 → 四种存储格式 → 班级知识库(RAG)
 *   → RAG检索演示 → 认知科学三种记忆 → 说明书 → 隐私边界
 *   → 判断游戏 → 小测验 → 进阶原理+课堂小结
 * 参考 ai-agent-book chapter3（记忆层次/四种存储格式/RAG/隐私脱敏）
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

AgentLab.LabMemory = (function () {
  var U = AgentLab.UI;
  var $ = U.$;

  var shortHist = [];

  /* ---------- 数据 ---------- */

  // 判断游戏
  var GAME = [
    { q: "上一轮你说过“我喜欢蓝色”，这一轮你问它：“我喜欢什么颜色？”它答：“你喜欢蓝色呀！”", ans: true, why: "它把上一次对话的内容记下来了——这是短期记忆（轨迹）在工作！" },
    { q: "每次新开一个对话，它都会说“你好，请问你叫什么名字呀？”", ans: false, why: "换了新对话它就忘了你，说明没有调用长期记忆。轨迹只在本次会话内有效。" },
    { q: "你上周告诉过它你的生日，今天再问它，它还记得并祝生日快乐。", ans: true, why: "跨过了好多天还记得——这是长期记忆（用户记忆）记牢了！" },
    { q: "它偷偷记住了你的家庭住址，还念给别的同学听。", ans: false, why: "隐私信息不该告诉 AI，也不该被记住——我们要给记忆器设定边界！生产系统会做隐私脱敏。" },
    { q: "你有两辆车，你说“帮我的车预约保养”，它主动问你要给哪辆车预约。", ans: true, why: "它从多段记忆中检索出两辆车的信息，并主动澄清——这是记忆三层次中的“多会话检索”能力！" },
    { q: "你三个月前存了护照信息，现在订国际航班时它主动提醒你护照快过期了。", ans: true, why: "它从看似无关的记忆中发现深层联系，主动提供预见性帮助——这是最高层的“主动服务”能力！" },
    { q: "它把“用户在TechCorp当高级工程师”拆成了三条独立的小笔记，互相没有联系。", ans: false, why: "这是 Simple Notes 的缺点——信息关联性丢失。生产系统常用 Enhanced Notes 或 JSON Cards 保留上下文。" },
    { q: "它记住了“张医生”，但分不清是你的牙科医生还是你父亲的心脏科医生。", ans: false, why: "这是消歧问题！Advanced JSON Cards 通过 backstory（来源背景）和 relationship（关系）来解决——同一条信息在不同场景下含义不同。" }
  ];

  // 小测验
  var QUIZ = [
    { q: "记忆器的两种基本记忆是什么？", opts: ["短期记忆和长期记忆", "快记忆和慢记忆", "好记忆和坏记忆", "文字记忆和图像记忆"], ans: 0, why: "短期记忆（轨迹）=本次对话历史，关掉就忘；长期记忆（用户记忆）=跨会话持久存储，记得牢用得久。" },
    { q: "ai-agent-book 中，“轨迹（Trajectory）”指的是什么？", opts: ["用户的运动轨迹", "一次 Agent 运行过程中的完整历史记录（用户消息+模型回复+工具结果）", "GPS 定位记录", "模型的训练数据路径"], ans: 1, why: "ai-agent-book chapter3:78 — 轨迹是单次会话的完整原始记录，按时间顺序追加且不修改（append-only），为 Agent 决策提供即时上下文。" },
    { q: "记忆三层次评估中，最高层是什么？", opts: ["基础回忆", "多会话检索", "主动服务", "快速记忆"], ans: 2, why: "ai-agent-book chapter3:55-64 — 三层：①基础回忆（准确存储检索）②多会话检索（跨对象跨时期推理）③主动服务（预见性主动帮助，从看似无关的记忆中发现深层联系）。" },
    { q: "四种记忆存储格式中，哪种是“每条记忆是一个最小不可再分的事实”？", opts: ["Enhanced Notes", "Simple Notes", "JSON Cards", "Advanced JSON Cards"], ans: 1, why: "ai-agent-book chapter3:95 — Simple Notes 每条是最小事实（如“用户邮箱：john@example.com”），开销极低 O(1)，但信息关联性完全丢失。" },
    { q: "RAG（检索增强生成）的工作流程是什么？", opts: ["直接问大模型", "检索相关片段→注入上下文→模型基于片段生成答案", "把所有知识都存进模型参数", "用搜索引擎代替大模型"], ans: 1, why: "ai-agent-book chapter3:243 — RAG = 检索（Retrieval）+ 增强（Augmented）+ 生成（Generation）：先从知识库检索相关片段，注入上下文，再让模型基于真实片段生成答案。你用的班级知识库就是最小版 RAG！" },
    { q: "认知科学中，“情景记忆”对应 Agent 的什么？", opts: ["一般性知识（如“意大利首都是罗马”）", "具体事件和经历的记忆（如“用户订了下周五去东京的航班”）", "行为模式和流程（如“先搜航班→确认座位→订餐”）", "工作记忆"], ans: 1, why: "ai-agent-book chapter3:176 — 情景记忆=关于具体事件和经历的记忆。Agent 对应：记录了一个具体事件的时间、对象和细节。" },
    { q: "“用户是素食者”这种从多次交互中提炼出的稳定特征，属于哪种记忆？", opts: ["情景记忆", "语义记忆", "程序记忆", "短期记忆"], ans: 1, why: "ai-agent-book chapter3:177 — 语义记忆=从具体事件中抽象出的一般性知识。Agent 对应：用户偏好、稳定特征等从多次交互中提炼的信息。" },
    { q: "Advanced JSON Cards 相比普通 JSON Cards，多了什么关键能力？", opts: ["存储更多数据", "加入信息来源背景(backstory)、主体身份(person)、关系(relationship)和时间戳，解决消歧问题", "更快的检索速度", "支持图片存储"], ans: 1, why: "ai-agent-book chapter3:101 — Advanced JSON Cards 不仅记录事实，还加入 backstory（为什么存）、person（为谁存）、relationship（关系）和时间戳，解决“张医生是谁”这类消歧问题。" },
    { q: "生产系统中，用户的身份证号、手机号等敏感信息应该怎么处理？", opts: ["直接存进记忆，方便使用", "做隐私脱敏（加密/哈希/掩码），并设置访问权限和遗忘机制", "不存任何用户信息", "只存在短期记忆里"], ans: 1, why: "ai-agent-book chapter3:231 — 隐私脱敏是记忆系统的重要工程实践：敏感信息加密存储、访问需授权、用户有权要求删除（被遗忘权）。课堂规则：家庭住址、电话号码等隐私不告诉 AI！" },
    { q: "“从用户反复订机票的模式中学到的通用流程”属于哪种记忆？", opts: ["情景记忆", "语义记忆", "程序记忆", "工作记忆"], ans: 2, why: "ai-agent-book chapter3:178 — 程序记忆=关于行为模式和流程的记忆（如骑自行车的能力）。Agent 对应：从用户反复行为中学到的通用流程——“先搜直飞→确认座位→用常旅客号→订餐”。" }
  ];

  // 进阶原理卡
  var DEEP = [
    { term: "上下文窗口（Context Window）", desc: "模型每次能“同时看到”的字数有限（如 128K Token）。装不下的历史就得压缩、摘要或截断——这就是上下文工程要解决的问题（ai-agent-book 第 2 章）。" },
    { term: "轨迹（Trajectory）", desc: "ai-agent-book chapter3:78 — 一次 Agent 运行过程中的完整历史记录（用户消息+模型回复+工具执行结果），按时间顺序追加且不修改（append-only）。轨迹是流水账，为决策提供即时上下文。" },
    { term: "用户长期记忆", desc: "ai-agent-book chapter3:82 — 跨会话、跨实例的持久化存储，通常以键值对形式与用户 ID 绑定，存储偏好设置、历史交互摘要和提取的知识点。Agent 通过工具调用显式读取和更新。" },
    { term: "记忆三层次评估", desc: "ai-agent-book chapter3:55 — ①基础回忆（准确存储检索单条事实）②多会话检索（跨对象跨时期推理，主动澄清）③主动服务（预见性帮助，从看似无关的记忆中发现深层联系）。" },
    { term: "四种存储格式", desc: "ai-agent-book chapter3:88 — Simple Notes（最小事实，O(1)操作但丢关联）、Enhanced Notes（完整段落，语义丰富但冗余）、JSON Cards（三层嵌套分类，可部分更新但刚性）、Advanced JSON Cards（加backstory/person/relationship，解决消歧但成本高）。" },
    { term: "RAG（检索增强生成）", desc: "真实系统里“翻小本子”叫 RAG：检索相关片段 → 注入上下文 → 模型基于片段生成答案。你现在用的班级知识库，就是最小版本的 RAG（ai-agent-book 第 3 章）。" },
    { term: "向量检索（Embedding 检索）", desc: "把知识库分块、转成向量，用“语义相似度”找最相关的内容——不是逐字匹配，而是“意思相近”就找得到。这是 RAG 系统的核心检索技术。" },
    { term: "认知科学三种长期记忆", desc: "ai-agent-book chapter3:174 — 情景记忆（具体事件）、语义记忆（一般性知识）、程序记忆（行为流程）。工作记忆对应上下文窗口，长期记忆对应用户记忆。" },
    { term: "隐私脱敏与被遗忘权", desc: "ai-agent-book chapter3:231 — 敏感信息加密存储、访问需授权、用户有权要求删除。生产系统会做 PII（个人身份信息）检测和自动脱敏。课堂规则：家庭住址、电话号码等隐私不告诉 AI！" },
    { term: "User as Code（可执行记忆）", desc: "ai-agent-book chapter3:113 — 把用户状态改成带类型的可执行对象，规则写成普通函数，让“表示”和“推理”使用同一种可验证介质。聚合统计、冲突发现、约束执行都交给确定性函数，而不是 LLM“心算”。" }
  ];

  /* ---------- 渲染 ---------- */
  function render() {
    var LP = AgentLab.LabPerception;
    var sec = $("sec-memory");
    sec.innerHTML =
      LP.labHead("mem", "book", "记忆器实验室", "让 AI 记住“我们班” · 组件篇·记忆（L09–L10）") +

      /* 学习目标 */
      '<div class="lesson-goal card-mem">' +
        '<h3>' + U.icon("target", 18) + ' 本课学习目标（L09+L10）</h3>' +
        '<div class="goal-list">' +
          '<div class="goal-item"><span class="goal-num">1</span>理解记忆器的两种基本记忆：短期记忆（轨迹，本次对话）和长期记忆（用户记忆，跨会话）；知道轨迹是“流水账”、长期记忆是“档案”</div>' +
          '<div class="goal-item"><span class="goal-num">2</span>了解 ai-agent-book 记忆三层次评估（基础回忆/多会话检索/主动服务）和四种存储格式（Simple/Enhanced/JSON/Advanced JSON Cards）的特点与取舍</div>' +
          '<div class="goal-item"><span class="goal-num">3</span>掌握 RAG（检索增强生成）的基本流程：检索相关片段→注入上下文→模型基于片段生成答案；能在班级知识库中实践最小版 RAG</div>' +
          '<div class="goal-item"><span class="goal-num">4</span>建立记忆隐私与边界意识：知道哪些信息该记、哪些不该记（家庭住址/电话等隐私）；了解认知科学三种长期记忆（情景/语义/程序）与 Agent 记忆的对应关系</div>' +
        '</div>' +
      '</div>' +

      /* ① 认识记忆器 + 层次结构 */
      LP.card("mem", "① 认识记忆器：两种“小本本”与记忆层次结构", "记忆器像 AI 随身带的小本子。它有两种记忆：一种“记得快、忘得也快”，一种“记得牢、用得久”。ai-agent-book chapter3:72 进一步把记忆分成三个层次：轨迹、用户长期记忆、业务状态。",
        '<div class="grid2">' +
          '<div class="notebook">' +
            '<h4>' + U.icon("refresh", 17) + ' 短期记忆（轨迹 Trajectory）</h4>' +
            '<div class="line">你刚说“我渴了”，它这会儿记得</div>' +
            '<div class="line">一关掉对话，它就忘了</div>' +
            '<div class="line">特点：记得快、忘得也快</div>' +
            '<div class="line" style="color:var(--c-mem-deep)"><b>ai-agent-book：</b>单次会话完整原始记录，append-only（只增不改），是“流水账”</div>' +
          '</div>' +
          '<div class="notebook">' +
            '<h4>' + U.icon("book", 17) + ' 长期记忆（用户记忆）</h4>' +
            '<div class="line">像写进“小本子”，下次翻开还认识你</div>' +
            '<div class="line">课表、值日表、班级通知都存在这里</div>' +
            '<div class="line">特点：记得牢、用得久</div>' +
            '<div class="line" style="color:var(--c-mem-deep)"><b>ai-agent-book：</b>跨会话持久化存储，键值对绑定用户 ID，是“档案”</div>' +
          '</div>' +
        '</div>' +
        '<div class="mem-layers" style="margin-top:14px">' +
          '<div style="font-weight:700;margin-bottom:8px;color:var(--c-mem-deep)">记忆层次结构（ai-agent-book chapter3:72）</div>' +
          '<div class="ml-row"><span class="ml-tag ml-traj">轨迹</span><span>本次会话的完整历史（用户消息+模型回复+工具结果），为决策提供即时上下文</span></div>' +
          '<div class="ml-row"><span class="ml-tag ml-long">用户长期记忆</span><span>跨会话的持久化存储（偏好、历史摘要、知识点），通过工具调用显式读取更新</span></div>' +
          '<div class="ml-row"><span class="ml-tag ml-state">业务状态</span><span>开发者定义的高层状态抽象（如“需要澄清”“处理中”“等待付款”），事件驱动架构中尤为重要</span></div>' +
        '</div>' +
        '<div class="tip" style="margin-top:12px">' + U.icon("spark", 16) + ' 班级小管家记课程表、值日表，用的是<b>长期记忆</b>；记你上一句话说了什么，用的是<b>短期记忆（轨迹）</b>。</div>'
      ) +

      /* ② 短期记忆实验 */
      LP.card("mem", "② 实验：短期记忆——关掉对话就忘", "跟小管家聊几句，看它怎么记住本次对话；然后“关掉对话”，再问同样的问题，看它还记不记得。这就是轨迹（Trajectory）的特点：只在本次会话内有效！",
        '<div class="game-box">' +
          '<div id="pg-short-msgs" style="display:flex;flex-direction:column;gap:8px;min-height:60px"><span style="color:var(--c-sub)">还没有聊天……</span></div>' +
          '<div class="row" style="margin-top:12px">' +
            '<button class="btn btn-mem btn-sm" data-short="我叫小明">' + U.icon("txt", 15) + ' 说：我叫小明</button>' +
            '<button class="btn btn-mem btn-sm" data-short="我喜欢踢足球">' + U.icon("txt", 15) + ' 说：我喜欢踢足球</button>' +
            '<button class="btn btn-mem btn-sm" data-short="我叫什么名字？">' + U.icon("search", 15) + ' 问：我叫什么名字？</button>' +
            '<button class="btn btn-gray btn-sm" id="pg-short-reset">' + U.icon("reset", 15) + ' 关掉对话（清空短期记忆）</button>' +
          '</div>' +
          '<div class="quiz-feedback" id="pg-short-fb"></div>' +
        '</div>'
      ) +

      /* ③ 记忆三层次评估 */
      LP.card("mem", "③ 记忆三层次评估（ai-agent-book chapter3:55）", "ai-agent-book 提出了评估记忆系统的三层次框架——从“能记住”到“能推理”再到“能主动服务”。看看下面的场景，分别属于哪一层？",
        '<div class="mem-levels">' +
          '<div class="mlevel mlevel-1">' +
            '<div class="mlevel-head"><span class="mlevel-num">L1</span><b>基础回忆</b></div>' +
            '<div class="mlevel-desc">准确存储和检索用户直接提供的、结构化的、无歧义的信息</div>' +
            '<div class="mlevel-example"><b>例子：</b>“我的会员号是12345”，后续需要时精确返回</div>' +
          '</div>' +
          '<div class="mlevel mlevel-2">' +
            '<div class="mlevel-head"><span class="mlevel-num">L2</span><b>多会话检索</b></div>' +
            '<div class="mlevel-desc">面对不同对象、不同时期的多段会话，能检索出所有相关信息并推理判断</div>' +
            '<div class="mlevel-example"><b>例子：</b>用户有两辆车，要求“为我的车预约保养”，系统找出两辆车信息并主动问要给哪辆</div>' +
          '</div>' +
          '<div class="mlevel mlevel-3">' +
            '<div class="mlevel-head"><span class="mlevel-num">L3</span><b>主动服务</b></div>' +
            '<div class="mlevel-desc">综合多个会话甚至很久以前的信息，提供预见性的主动帮助，从看似无关的记忆中发现深层联系</div>' +
            '<div class="mlevel-example"><b>例子：</b>订国际航班时主动关联数月前存的护照信息，发现即将过期并发出预警</div>' +
          '</div>' +
        '</div>' +
        '<div class="tip" style="margin-top:12px">' + U.icon("book", 16) + ' <b>ai-agent-book 实验 3-1：</b>按三层次构建评估集，每层20个测试用例，用 LLM-as-a-judge（另一个 LLM 当评委）评分。你觉得班级小管家目前能达到哪一层？</div>'
      ) +

      /* ④ 四种存储格式 */
      LP.card("mem", "④ 四种记忆存储格式对比（ai-agent-book chapter3:88）", "同一条用户信息，可以用不同的粒度和结构来表示。ai-agent-book 给出了四种渐进式的存储格式，各有优缺点。生产系统通常采用混合模式！",
        '<div class="storage-formats">' +
          '<div class="sf-item sf-simple">' +
            '<div class="sf-head"><b>Simple Notes</b><span class="sf-tag">极简</span></div>' +
            '<div class="sf-desc">每条记忆是一个最小不可再分的事实</div>' +
            '<div class="sf-eg"><b>例：</b>“用户邮箱：john@example.com”</div>' +
            '<div class="sf-pro"><span style="color:var(--c-per-deep)">✓</span> 开销极低，O(1)操作</div>' +
            '<div class="sf-con"><span style="color:var(--c-exe-deep)">✗</span> 信息关联性完全丢失</div>' +
          '</div>' +
          '<div class="sf-item sf-enhanced">' +
            '<div class="sf-head"><b>Enhanced Notes</b><span class="sf-tag">完整</span></div>' +
            '<div class="sf-desc">每条记忆保存为包含完整上下文的段落</div>' +
            '<div class="sf-eg"><b>例：</b>“用户在TechCorp任高级工程师，专注ML三年，领导推荐系统项目，团队5人”</div>' +
            '<div class="sf-pro"><span style="color:var(--c-per-deep)">✓</span> 保留叙事结构，语义丰富</div>' +
            '<div class="sf-con"><span style="color:var(--c-exe-deep)">✗</span> 存储冗余，更新复杂</div>' +
          '</div>' +
          '<div class="sf-item sf-json">' +
            '<div class="sf-head"><b>JSON Cards</b><span class="sf-tag">结构化</span></div>' +
            '<div class="sf-desc">三层嵌套结构（类别→子类别→键值对）</div>' +
            '<div class="sf-eg"><b>例：</b>personal.contact.email / work.position.title</div>' +
            '<div class="sf-pro"><span style="color:var(--c-per-deep)">✓</span> 支持部分更新，可预测可扩展</div>' +
            '<div class="sf-con"><span style="color:var(--c-exe-deep)">✗</span> 刚性结构，多维信息难归类</div>' +
          '</div>' +
          '<div class="sf-item sf-advanced">' +
            '<div class="sf-head"><b>Advanced JSON Cards</b><span class="sf-tag">知识管理</span></div>' +
            '<div class="sf-desc">不仅记录事实，还加入来源背景、主体身份、关系和时间戳</div>' +
            '<div class="sf-eg"><b>例：</b>“张医生”=牙科医生（为自己）vs 心脏科医生（为父亲）</div>' +
            '<div class="sf-pro"><span style="color:var(--c-per-deep)">✓</span> 解决消歧问题，实体模型清晰</div>' +
            '<div class="sf-con"><span style="color:var(--c-exe-deep)">✗</span> 生成和维护成本较高</div>' +
          '</div>' +
        '</div>' +
        '<div class="tip" style="margin-top:12px">' + U.icon("spark", 16) + ' <b>实践选择：</b>关键且少量的数据（用户偏好、关键人物关系）用 Advanced JSON Cards；大量且非关键的对话事实用 Simple Notes；多数生产系统采用<b>混合模式</b>。</div>'
      ) +

      /* ⑤ 班级知识库 */
      LP.card("mem", "⑤ 班级知识库：把“我们班”装进长期记忆（最小版 RAG）", "就像 L09 课上做的：把班名、课表、值日、通知写进《需求卡·班级信息》，存进小本子。填好后，问小管家班级的事，它就能答上来！这就是最小版的 RAG——检索班级知识→注入上下文→生成答案。",
        '<div class="grid2">' +
          '<div>' +
            '<label class="field">班名<input type="text" id="kb-classname"></label>' +
            '<label class="field">班级口号<input type="text" id="kb-slogan"></label>' +
            '<label class="field">课程表（写今天下午的课）<input type="text" id="kb-schedule"></label>' +
            '<label class="field">值日安排<input type="text" id="kb-duty"></label>' +
            '<label class="field">值日规则<input type="text" id="kb-dutyrule"></label>' +
            '<label class="field">班级通知<input type="text" id="kb-notice"></label>' +
            '<label class="field">班主任<input type="text" id="kb-teacher"></label>' +
            '<div class="row">' +
              '<button class="btn btn-mem" id="kb-save">' + U.icon("book", 16) + ' 存进长期记忆</button>' +
              '<button class="btn btn-ghost btn-sm" id="kb-reset">恢复示例</button>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<div class="notebook" style="min-height:340px">' +
              '<h4>' + U.icon("book", 17) + ' 长期记忆小本子</h4>' +
              '<div id="kb-preview"></div>' +
            '</div>' +
            '<div style="font-weight:700;margin:14px 0 8px">检验：问问小管家（需要连接大模型）</div>' +
            '<div class="row">' +
              '<button class="btn btn-mem btn-sm" data-kbq="今天下午有什么课？">今天下午有什么课？</button>' +
              '<button class="btn btn-mem btn-sm" data-kbq="今天谁值日？">今天谁值日？</button>' +
              '<button class="btn btn-mem btn-sm" data-kbq="班级最近有什么通知？">最近有什么通知？</button>' +
            '</div>' +
            '<div class="ans" id="kb-ans" style="margin-top:10px;background:#fff;border:2px solid var(--c-line);border-radius:12px;padding:12px;min-height:70px"><span style="color:var(--c-sub)">问一问，看它记没记住～</span></div>' +
          '</div>' +
        '</div>'
      ) +

      /* ⑥ RAG 检索演示 */
      LP.card("mem", "⑥ RAG 检索增强生成演示：AI 怎么“翻小本子”", "RAG（Retrieval-Augmented Generation）是真实系统里“翻小本子”的标准流程。看看当你问“今天下午有什么课？”时，AI 内部发生了什么——三步：检索→注入→生成！",
        '<div class="rag-flow">' +
          '<div class="rag-step rag-1">' +
            '<div class="rag-num">1</div>' +
            '<div class="rag-title">检索（Retrieval）</div>' +
            '<div class="rag-desc">从知识库中找到与问题相关的片段</div>' +
            '<div class="rag-eg">问题：“今天下午有什么课？”<br>→ 检索到：“周一下午：科学、美术、班会”</div>' +
          '</div>' +
          '<div class="rag-arrow">→</div>' +
          '<div class="rag-step rag-2">' +
            '<div class="rag-num">2</div>' +
            '<div class="rag-title">注入（Augmented）</div>' +
            '<div class="rag-desc">把检索到的片段放进上下文，和问题一起交给大模型</div>' +
            '<div class="rag-eg">上下文 = 系统提示 + 班级知识片段 + 用户问题<br>“请基于以下班级信息回答：周一下午科学、美术、班会”</div>' +
          '</div>' +
          '<div class="rag-arrow">→</div>' +
          '<div class="rag-step rag-3">' +
            '<div class="rag-num">3</div>' +
            '<div class="rag-title">生成（Generation）</div>' +
            '<div class="rag-desc">大模型基于真实片段生成答案，而不是凭空编造</div>' +
            '<div class="rag-eg">AI 回答：“今天下午有三节课：科学、美术、班会哦！”</div>' +
          '</div>' +
        '</div>' +
        '<div class="tip" style="margin-top:14px">' + U.icon("spark", 16) + ' <b>为什么需要 RAG？</b>大模型的知识有截止日期，而且不可能记住所有班级的具体信息。RAG 让 AI 在回答前先“查资料”，基于真实片段生成答案，减少幻觉（编造）。你用的班级知识库就是最小版 RAG！</div>' +
        '<div class="tip" style="margin-top:8px">' + U.icon("book", 16) + ' <b>向量检索：</b>真实 RAG 系统把知识库分块、转成向量（Embedding），用“语义相似度”找最相关的内容——不是逐字匹配，而是“意思相近”就找得到。</div>'
      ) +

      /* ⑦ 认知科学三种记忆 */
      LP.card("mem", "⑦ 认知科学：三种长期记忆与 Agent 对应（ai-agent-book chapter3:170）", "ai-agent-book 从认知科学视角补充了记忆内容的类型。人类长期记忆细分为三种，每种都能在 Agent 记忆中找到直接对应！工作记忆则对应 Agent 的上下文窗口。",
        '<div class="cog-mem">' +
          '<div class="cm-item cm-episodic">' +
            '<div class="cm-icon">' + U.icon("clock", 22) + '</div>' +
            '<div class="cm-name">情景记忆<br><small>Episodic</small></div>' +
            '<div class="cm-human"><b>人类：</b>“上周三和同事在意大利餐厅吃了很棒的晚餐”</div>' +
            '<div class="cm-agent"><b>Agent：</b>“用户订了下周五去东京的 ANA 航班”——记录具体事件的时间、对象和细节</div>' +
          '</div>' +
          '<div class="cm-item cm-semantic">' +
            '<div class="cm-icon">' + U.icon("book", 22) + '</div>' +
            '<div class="cm-name">语义记忆<br><small>Semantic</small></div>' +
            '<div class="cm-human"><b>人类：</b>“意大利的首都是罗马”</div>' +
            '<div class="cm-agent"><b>Agent：</b>“用户是素食者”“用户偏好靠窗座位”——从多次交互中提炼的稳定特征</div>' +
          '</div>' +
          '<div class="cm-item cm-procedural">' +
            '<div class="cm-icon">' + U.icon("gear", 22) + '</div>' +
            '<div class="cm-name">程序记忆<br><small>Procedural</small></div>' +
            '<div class="cm-human"><b>人类：</b>骑自行车的能力</div>' +
            '<div class="cm-agent"><b>Agent：</b>从用户反复订机票中学到的流程——“先搜直飞→确认座位→用常旅客号→订餐”</div>' +
          '</div>' +
        '</div>' +
        '<div class="tip" style="margin-top:12px">' + U.icon("brain", 16) + ' <b>工作记忆 = 上下文窗口：</b>认知科学中的工作记忆对应 Agent 的上下文窗口——用于处理当前任务的临时信息空间。轨迹是工作记忆中最核心的内容，但工作记忆还可能包含从长期记忆中激活加载的信息。</div>'
      ) +

      /* ⑧ 说明书 */
      LP.card("mem", "⑧ 《班级小管家说明书》：知道 / 不知道 / 怎么说", "小管家“懂边界比什么都会更重要”！给它写好说明书，它就知道：哪些该答、哪些不能说、说话用什么语气。",
        '<label class="field">它知道什么（可以写班级知识库里的内容）<textarea id="mn-know"></textarea></label>' +
        '<label class="field">它不知道什么（隐私信息不告诉它）<textarea id="mn-notknow"></textarea></label>' +
        '<label class="field">它该怎么说话<textarea id="mn-speak"></textarea></label>' +
        '<div class="row">' +
          '<button class="btn btn-mem" id="mn-save">' + U.icon("book", 16) + ' 保存说明书</button>' +
          '<button class="btn btn-ghost btn-sm" id="mn-reset">恢复示例</button>' +
        '</div>' +
        '<div class="tip">' + U.icon("info", 16) + ' 记得课堂规则：<b>家庭住址、电话号码等隐私，不告诉 AI！</b>（L10《AI 如何记得你》）</div>'
      ) +

      /* ⑨ 隐私与记忆边界 */
      LP.card("mem", "⑨ 隐私与记忆边界：什么该记、什么不该记", "ai-agent-book chapter3:231 讨论了记忆系统的隐私脱敏。不是所有信息都该被 AI 记住！生产系统会做 PII（个人身份信息）检测和自动脱敏，用户还有“被遗忘权”。",
        '<div class="privacy-grid">' +
          '<div class="priv-item priv-ok">' +
            '<div class="priv-head">' + U.icon("check", 18) + ' 可以告诉 AI 的</div>' +
            '<ul><li>班级课表、值日安排</li><li>班级口号、班主任姓名</li><li>班级通知、活动安排</li><li>你的兴趣爱好（如“喜欢踢足球”）</li><li>学习偏好（如“喜欢用图表解释”）</li></ul>' +
          '</div>' +
          '<div class="priv-item priv-no">' +
            '<div class="priv-head">' + U.icon("xmark", 18) + ' 不应该告诉 AI 的</div>' +
            '<ul><li>家庭住址、门牌号</li><li>电话号码、家长手机号</li><li>身份证号、护照号</li><li>银行卡号、支付密码</li><li>身体隐私、健康敏感信息</li></ul>' +
          '</div>' +
        '</div>' +
        '<div class="priv-practices" style="margin-top:14px">' +
          '<div style="font-weight:700;margin-bottom:8px;color:var(--c-mem-deep)">生产系统的隐私保护措施（ai-agent-book chapter3:231）</div>' +
          '<div class="pp-row"><span class="pp-tag">加密存储</span><span>敏感信息加密后再存，即使数据库泄露也看不到明文</span></div>' +
          '<div class="pp-row"><span class="pp-tag">访问授权</span><span>不是谁都能看用户记忆，访问需要权限验证和审计日志</span></div>' +
          '<div class="pp-row"><span class="pp-tag">自动脱敏</span><span>PII 检测自动识别身份证/电话/地址，用掩码代替（如 138****1234）</span></div>' +
          '<div class="pp-row"><span class="pp-tag">被遗忘权</span><span>用户有权要求删除自己的所有记忆数据，系统必须彻底删除</span></div>' +
        '</div>'
      ) +

      /* ⑩ 判断游戏 */
      LP.card("mem", "⑩ 游戏：它记没记住？用了哪层记忆？", "看看下面的对话片段，判断 AI 是不是用了记忆。答对加星！题目涵盖短期记忆、长期记忆、三层次评估、存储格式和消歧问题。",
        '<div class="game-box" id="pg-memgame"><div id="pg-memgame-body"></div></div>' +
        '<div class="score-line"><span class="score-badge" id="pg-memgame-score" data-score="0">★ 0</span><button class="btn btn-ghost btn-sm" id="pg-memgame-restart">重来</button></div>'
      ) +

      /* 新增配套实验（全部可自动判定） */
      LP.card("mem", "实验：RAG 检索命中——哪些片段会被带进上下文？",
        "RAG 的地基是“检索能不能召回正确片段”。给一个问题，选出所有会被检索命中的知识片段（提示：看语义，不只看字面）。",
        '<div id="mem-rag"></div>') +

      LP.card("mem", "实验：写入与遗忘开关——什么该记、什么该忘",
        "长期记忆不是“记得越多越好”。打开／关闭不同的记忆条目，看看后续动作还能不能做好，顺便认识“主动遗忘”（过期信息要清掉）。",
        '<div id="mem-write"></div>') +

      LP.card("mem", "实验：隐私脱敏判定——同一段话，两种存法",
        "用户的原话里常常夹着隐私。切一下“脱敏开关”，看看不脱敏和脱敏之后，写进记忆的内容差在哪里。",
        '<div id="mem-privacy"></div>') +

      LP.card("mem", "实验：上下文预算分配——检索几条最合适？",
        "上下文窗口是有限的预算。检索条数（Top-K）太少会漏掉依据，太多会挤占空间、还可能带进干扰信息。拖滑条找平衡点。",
        '<div id="mem-budget"></div>') +

      /* ⑪ 小测验 */
      LP.card("mem", "小测验：你是记忆小达人吗？", "共 " + QUIZ.length + " 题，覆盖短期/长期记忆、轨迹、三层次评估、四种存储格式、RAG、认知科学三种记忆、隐私边界。答对一题加一颗星！",
        '<div class="game-box" id="mem-quiz"><div id="mem-quiz-body"></div></div>' +
        '<div class="score-line"><span class="score-badge" id="mem-quiz-score" data-score="0">★ 0</span><button class="btn btn-ghost btn-sm" id="mem-quiz-restart">重来</button></div>'
      ) +

      /* ⑫ 进阶原理 + 课堂小结 */
      /* ⑫ 进阶原理互动课堂 */
      LP.card("mem", "进阶原理互动课堂：记忆器在真实 AI 系统里是什么？（ai-agent-book 第 5/8 章）",
        "下面 10 个概念对应《深入理解 AI Agent：设计原理与工程实践》（ai-agent-book）里的真实工程做法。<b>左边选概念，右边看讲解并亲手做实验</b>：每个概念都配了「一句话讲明白 / 打个比方 / 真实系统里是这样 / 动手实验 / 自检一问」，还能一键跳回对应的基础实验。",
        AgentLab.Adv.panelHTML({ key: "mem", concepts: memConcepts() })) +

      '<div class="lesson-summary card-mem">' +
        '<h3>' + U.icon("check", 18) + ' 课堂小结（L09+L10）</h3>' +
        '<div class="summary-core"><b>核心结论：</b>记忆器让 AI 从“每次都重新认识你”变成“记得住、用得好”。短期记忆（轨迹）是本次对话的流水账，关掉就忘；长期记忆（用户记忆）是跨会话的档案，记得牢用得久。ai-agent-book 把记忆分成三层次评估（基础回忆→多会话检索→主动服务）和四种存储格式（Simple/Enhanced/JSON/Advanced JSON Cards）。真实系统用 RAG（检索→注入→生成）让 AI 基于真实知识回答，减少幻觉。但记忆必须有边界——隐私信息不告诉 AI，生产系统做加密、脱敏、授权和被遗忘权。</div>' +
        '<div class="summary-points">' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-mem)">' + U.icon("refresh", 14) + '</span><div><b>两种记忆：</b>短期记忆（轨迹，append-only 流水账）+ 长期记忆（用户记忆，跨会话档案）</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-mem)">' + U.icon("book", 14) + '</span><div><b>RAG 流程：</b>检索相关片段→注入上下文→模型基于片段生成答案。班级知识库就是最小版 RAG</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-mem)">' + U.icon("gear", 14) + '</span><div><b>四种格式：</b>Simple Notes（极简）/ Enhanced Notes（完整）/ JSON Cards（结构化）/ Advanced JSON Cards（知识管理+消歧）</div></div>' +
          '<div class="sp-item"><span class="sp-icon" style="background:var(--c-mem)">' + U.icon("shield", 14) + '</span><div><b>隐私边界：</b>家庭住址/电话等隐私不告诉 AI；生产系统做加密存储、访问授权、自动脱敏、被遗忘权</div></div>' +
        '</div>' +
        '<div class="summary-think"><b>课后思考：</b>请用“记忆三层次”评估我们的班级小管家——它目前能达到 L1（基础回忆）、L2（多会话检索）还是 L3（主动服务）？要达到更高层，需要给它增加什么能力？下节课分享！</div>' +
      '</div>';

    bindShort();
    bindKB();
    bindManual();
    bindGame();
    bindQuiz();

    /* 新增配套实验 + 进阶原理互动课堂 */
    bindMemRag();
    bindMemWrite();
    bindMemPrivacy();
    bindMemBudget();
    bindMemAdv();
  }

  /* ---------- ② 短期记忆实验 ---------- */
  function bindShort() {
    function addMsg(role, text) {
      var box = $("pg-short-msgs");
      if (box.querySelector(".empty-hint")) box.innerHTML = "";
      var d = document.createElement("div");
      d.className = "msg " + (role === "user" ? "user" : "ai");
      d.style.maxWidth = "92%";
      d.innerHTML = '<span class="who">' + (role === "user" ? "我" : "小管家") + "</span>" + U.esc(text);
      box.appendChild(d);
      box.scrollTop = box.scrollHeight;
    }

    function askShort(userText) {
      shortHist.push({ role: "user", content: userText });
      var sys = AgentLab.buildSystemPrompt(AgentLab.Store.getClassInfo(), AgentLab.Store.getManual());
      var messages = [{ role: "system", content: sys }].concat(shortHist);
      return AgentLab.API.chat(messages).then(function (ans) {
        shortHist.push({ role: "assistant", content: ans });
        return ans;
      });
    }

    document.querySelectorAll("[data-short]").forEach(function (b) {
      b.addEventListener("click", async function () {
        var t = b.getAttribute("data-short");
        var fb = $("pg-short-fb");
        addMsg("user", t);
        b.disabled = true;
        fb.innerHTML = '<span style="color:var(--c-sub)">小管家正在想……</span>';
        try {
          var ans = await askShort(t);
          addMsg("ai", ans);
          if (t.indexOf("叫什么名字") >= 0) {
            fb.innerHTML = '<span class="fb-ok">' + U.icon("check", 15) + " 它记住了本次对话里的话——这就是<b>短期记忆（轨迹）</b>！现在点“关掉对话”再问一次试试。</span>";
          }
        } catch (e) {
          fb.innerHTML = '<span class="fb-no">出错了：' + U.esc(e.message || e) + "</span>";
        }
        b.disabled = false;
      });
    });

    $("pg-short-reset").addEventListener("click", function () {
      shortHist = [];
      var box = $("pg-short-msgs");
      box.innerHTML = '<span class="empty-hint" style="color:var(--c-sub)">对话已关闭，短期记忆（轨迹）清空了！再点“我叫什么名字？”看看它还记不记得你。</span>';
      $("pg-short-fb").innerHTML = '<span class="fb-no">' + U.icon("reset", 15) + " 短期记忆已清空。现在问它“我叫什么名字？”，它应该不认识你了——这就是轨迹的特点：只在本次会话内有效。</span>";
    });
  }

  /* ---------- ⑤ 班级知识库 ---------- */
  function fillKBForm(info) {
    $("kb-classname").value = info.className || "";
    $("kb-slogan").value = info.slogan || "";
    $("kb-schedule").value = info.schedule || "";
    $("kb-duty").value = info.duty || "";
    $("kb-dutyrule").value = info.dutyRule || "";
    $("kb-notice").value = info.notice || "";
    $("kb-teacher").value = info.teacher || "";
  }

  function readKBForm() {
    return {
      className: $("kb-classname").value.trim(),
      slogan: $("kb-slogan").value.trim(),
      schedule: $("kb-schedule").value.trim(),
      duty: $("kb-duty").value.trim(),
      dutyRule: $("kb-dutyrule").value.trim(),
      notice: $("kb-notice").value.trim(),
      teacher: $("kb-teacher").value.trim()
    };
  }

  function renderKBPreview(info) {
    var html = "";
    var rows = [
      ["班名", info.className], ["口号", info.slogan], ["课程表", info.schedule],
      ["值日", info.duty], ["值日规则", info.dutyRule], ["通知", info.notice], ["班主任", info.teacher]
    ];
    rows.forEach(function (r) {
      html += r[1] ? '<div class="line"><b>' + r[0] + "：</b>" + U.esc(r[1]) + "</div>" : "";
    });
    $("kb-preview").innerHTML = html || '<div class="empty">小本子还是空的，先填左边的内容吧～</div>';
  }

  function bindKB() {
    fillKBForm(AgentLab.Store.getClassInfo());
    renderKBPreview(AgentLab.Store.getClassInfo());

    $("kb-save").addEventListener("click", function () {
      var info = readKBForm();
      AgentLab.Store.saveClassInfo(info);
      renderKBPreview(info);
      U.toast("已存进长期记忆小本子！", "success");
    });
    $("kb-reset").addEventListener("click", function () {
      AgentLab.Store.resetClassInfo();
      fillKBForm(AgentLab.Store.getClassInfo());
      renderKBPreview(AgentLab.Store.getClassInfo());
      U.toast("已恢复示例班级信息");
    });

    document.querySelectorAll("[data-kbq]").forEach(function (b) {
      b.addEventListener("click", async function () {
        var q = b.getAttribute("data-kbq");
        var ansBox = $("kb-ans");
        ansBox.innerHTML = '<span style="color:var(--c-sub)">小管家正在翻小本子（RAG 检索中）……</span>';
        b.disabled = true;
        try {
          var info = AgentLab.Store.getClassInfo();
          var manual = AgentLab.Store.getManual();
          var sys = AgentLab.buildSystemPrompt(info, manual);
          var reply = await AgentLab.API.ask(sys, q);
          ansBox.innerHTML = "<b style='color:var(--c-mem-deep)'>小管家答：</b><br>" + U.esc(reply);
        } catch (e) {
          ansBox.innerHTML = '<span style="color:var(--c-exe-deep)">出错了：' + U.esc(e.message || e) + "</span>";
        }
        b.disabled = false;
      });
    });
  }

  /* ---------- ⑧ 说明书 ---------- */
  function fillManualForm(m) {
    $("mn-know").value = m.know || "";
    $("mn-notknow").value = m.notKnow || "";
    $("mn-speak").value = m.speak || "";
  }

  function bindManual() {
    fillManualForm(AgentLab.Store.getManual());
    $("mn-save").addEventListener("click", function () {
      AgentLab.Store.saveManual({
        know: $("mn-know").value.trim(),
        notKnow: $("mn-notknow").value.trim(),
        speak: $("mn-speak").value.trim()
      });
      U.toast("说明书已保存！智能体说话会更守规矩。", "success");
    });
    $("mn-reset").addEventListener("click", function () {
      AgentLab.Store.resetManual();
      fillManualForm(AgentLab.Store.getManual());
      U.toast("说明书已恢复示例");
    });
  }

  /* ---------- ⑩ 判断游戏 ---------- */
  /* ---------- ⑩ 判断游戏（单题闯关） ---------- */
  function bindGame() {
    AgentLab.Quiz.mount({
      host: "pg-memgame-body",
      color: "mem",
      name: "记忆小达人",
      star: "pg-memgame-score",
      restart: "pg-memgame-restart",
      questions: GAME.map(function (g) {
        return {
          q: g.q,
          opts: [
            { html: U.icon("check", 17) + " 用了记忆", key: true },
            { html: U.icon("xmark", 17) + " 没用记忆", key: false }
          ],
          ans: g.ans,
          why: g.why
        };
      }),
      hint: "想一想：这一次它有没有从“记住的信息”里拿到东西？"
    });
  }

  /* ---------- ⑪ 小测验 ---------- */
  /* ---------- ⑪ 小测验（单题闯关） ---------- */
  function bindQuiz() {
    AgentLab.Quiz.mount({
      host: "mem-quiz-body",
      color: "mem",
      name: "记忆小达人",
      star: "mem-quiz-score",
      restart: "mem-quiz-restart",
      questions: QUIZ,
      hint: "再想想——答案都在上面的实验和《班级小管家说明书》里。"
    });
  }

  /* ============================================================
   * 进阶原理互动课堂（记忆器）：10 个概念
   * 结构与交互由共享引擎 js/adv-classroom.js 渲染，这里只放内容数据
   * ============================================================ */
  var MEM_ADV = [
    {
      id: "ctxwin", icon: "archive", nav: "上下文窗口", name: "上下文窗口（Context Window）", en: "CONTEXT WINDOW",
      tip: "模型每次能“同时看到”的内容有上限（如 128K Token）；记忆器的第一道算术题，就是这份预算怎么花。",
      analogy: "像书桌：桌面就那么大，摆着课本（系统提示词）、作业（当前问题）、参考书（检索到的资料）——想再放新的，就得先把旧的收起来。",
      real: "上下文里通常同时装着：系统提示词与工具定义（固定）、最近几轮对话、检索回的知识片段、工具返回结果。<b>越靠后的内容越容易被注意到</b>，所以关键信息要放在“好位置”；总量则用滑动窗口、摘要压缩来控制。",
      quiz: { q: "为什么“把重要信息放在上下文最后”常常更有效？", a: "模型对靠近末尾的内容注意力更强（近因效应）；而且一旦发生截断，丢的通常是更靠前的中间内容，末尾反而不容易被丢。工程上会在末尾把关键约束再复述一遍。" },
      links: [{ t: "短期记忆实验", el: "pg-short-msgs" }, { t: "新增：上下文预算分配", el: "mem-budget" }]
    },
    {
      id: "traj", icon: "refresh", nav: "轨迹 Trajectory", name: "轨迹（Trajectory）", en: "TRAJECTORY",
      tip: "轨迹 = 本次会话内的消息历史，它会随着每一轮对话不断变长——这就是“短期记忆”。",
      analogy: "像课堂笔记：这节课记的，下课就没了；而“长期记忆”像学期总结，跨课次都还在。",
      real: "轨迹是<b>会话级</b>的：关掉对话就清空。为省 Token，工程上会做“轨迹压缩”（把前面多轮压成一段摘要）或“轨迹截断”（只留最近几轮）；重要结论必须显式写进长期记忆，否则会话结束就丢了。",
      quiz: { q: "为什么用户说了一句很重要的话，Agent 应该主动把它写进长期记忆？", a: "因为轨迹只活在本次会话里。会话一结束那句话就没了，下次用户再来，Agent 什么都不记得。真正的“记住”必须落到长期记忆或外置存储。" },
      links: [{ t: "短期记忆实验", el: "pg-short-msgs" }]
    },
    {
      id: "ltm", icon: "database", nav: "用户长期记忆", name: "用户长期记忆", en: "LONG-TERM MEMORY",
      tip: "长期记忆是跨会话、跨实例保留的用户信息——它决定了“AI 下次还记不记得你”。",
      analogy: "像老师的“学生档案”：这节课上完档案还在；下次接新班，翻档案就知道这个学生的情况。",
      real: "长期记忆通常存两类：<b>事实</b>（班名、课表、偏好）与<b>结论</b>（“这个同学容易被长句子绕晕，回答要短”）。写入要有取舍：只写稳定的、可复用的信息；临时状态不写，隐私信息不写。",
      quiz: { q: "“今天下午有体育课”和“我们班课表每周固定”，哪条更值得写进长期记忆？", a: "后者。前者是临时状态（今天过了就没用），后者是稳定事实（每次回答班级问题都用得上）。判断标准：这条信息下次还会不会用得上。" },
      links: [{ t: "班级知识库", el: "kb-classname" }]
    },
    {
      id: "levels", icon: "target", nav: "记忆三层次", name: "记忆三层次评估", en: "3 LEVELS OF MEMORY",
      tip: "从“能记住”到“能推理”再到“能主动服务”——记忆系统可以按三个层次来评估。",
      analogy: "像三个境界的课代表：① 能背出课表（基础回忆）；② 能回答“周五下午能不能开班会”（推理应用）；③ 周五早上主动提醒你“今天有班会”（主动服务）。",
      real: "ai-agent-book 的三层次框架：<b>基础回忆</b>（存了、能取对）、<b>推理与应用</b>（能结合多条记忆做判断）、<b>主动服务</b>（在合适时机主动使用记忆）。层次越高越难做，也越有价值。",
      quiz: { q: "“AI 主动说：上次你说想让回答短一点，这次我就写短了”，属于哪一层？", a: "第三层“主动服务”——它不仅记住了，还在合适的时机主动用上。第一层只是能取出来，第二层是能用来推理。" },
      links: [{ t: "判断游戏", el: "pg-memgame" }]
    },
    {
      id: "formats", icon: "box", nav: "四种存储格式", name: "四种存储格式", en: "STORAGE FORMATS",
      tip: "同一条用户信息，可以用不同粒度和结构来存——存法不同，后面能用它做的事也不同。",
      analogy: "像记笔记的四种记法：流水账、分类条目、表格、可执行的规则清单。流水账最省事但最难用，规则清单最费心但最能自动执行。",
      real: "ai-agent-book 的四级渐进格式：Simple text → 结构化条目 → 带元数据的条目 → <b>可执行规则</b>。选择依据是：这条信息以后<b>要不要被自动使用</b>？只是给模型参考，文本就够；要能被规则或代码直接消费，就必须结构化。",
      quiz: { q: "“用户要求：回答不超过两句话”，该用哪种格式存？", a: "可执行规则（规则/代码级）。它不是“参考信息”，而是每条回答都必须遵守的约束——结构化存储才能在生成时自动带上，甚至用代码校验。" },
      links: [{ t: "知识库预览", el: "kb-preview" }]
    },
    {
      id: "rag", icon: "book", nav: "RAG 检索增强生成", name: "RAG（检索增强生成）", en: "RETRIEVAL-AUGMENTED GENERATION",
      tip: "真实系统里“翻小本子”的标准流程：检索相关片段 → 注入上下文 → 生成回答（三步）。",
      analogy: "像开卷考试：先按题目找到书里的相关段落（检索），把几段抄到答题纸上（注入），再结合题目写出答案（生成）。",
      real: "三步分别是：<b>检索</b>（把问题转成向量，从知识库找最相关的若干块）、<b>注入</b>（把片段放进上下文，通常带来源标记）、<b>生成</b>（模型基于片段回答，并说明依据）。它的价值在于：让模型能回答“训练时没学过”的私有知识，而且可溯源。",
      quiz: { q: "为什么 RAG 比“把整本资料塞进上下文”更好？", a: "三个原因：① 省 Token（只取相关片段）；② 突破窗口上限（资料可以比窗口大得多）；③ 更好溯源（片段带来源，能说清依据是什么）。" },
      links: [{ t: "RAG 检索演示", el: "mem-rag" }]
    },
    {
      id: "vec", icon: "globe", nav: "向量检索", name: "向量检索（Embedding 检索）", en: "VECTOR RETRIEVAL",
      tip: "检索不是“关键词匹配”，而是“语义相似度”——问“今天下午上什么课”，也能找到写着“13:30 美术”的课表片段。",
      analogy: "像图书管理员按“意思”找书，而不是按书名里的字找书：你说“想放松一下”，他会给你拿小说或漫画，而不是只有书名带“放松”两个字的书。",
      real: "把知识库分块 → 每块转成向量（Embedding）→ 存进向量数据库；检索时把问题也转成向量，找<b>余弦相似度</b>最高的 Top-K 块。所以同义词、口语说法都能被召回；反过来，编号、人名这类精确匹配用关键词检索更稳（工程上常做混合检索）。",
      quiz: { q: "为什么问“下午有啥课”能命中写着“13:30 美术”的片段？", a: "因为检索比的是语义相近度：“下午”与“13:30”、“有啥课”与“美术（课）”在语料里上下文相似，所以向量距离近——这正是 Embedding 的作用。" },
      links: [{ t: "RAG 检索演示", el: "mem-rag" }]
    },
    {
      id: "cogsci", icon: "brain", nav: "认知科学三种记忆", name: "认知科学：三种长期记忆", en: "COGNITIVE SCIENCE",
      tip: "人类长期记忆分三种：情景记忆、语义记忆、程序记忆——Agent 的记忆几乎都能找到对应。",
      analogy: "像三种“记得”：记得上周三发生的事（情景）、记得“北京是首都”（语义）、记得怎么骑自行车（程序）。",
      real: "<b>情景记忆</b>≈ 对话历史与事件记录（谁在什么时间说了什么）；<b>语义记忆</b>≈ 知识库与事实条目（可复用的结论）；<b>程序记忆</b>≈ 工具用法与操作流程（怎么调、按什么顺序调）。工作记忆则对应上下文窗口。",
      quiz: { q: "“Agent 记得查天气要先拿到城市名，再调用天气工具”，属于哪种记忆？", a: "程序记忆——它记的是“怎么做事”的流程与技能；“北京是首都”是语义记忆；“上周用户说他感冒了”是情景记忆。" },
      links: [{ t: "判断游戏", el: "pg-memgame" }]
    },
    {
      id: "privacy", icon: "shield", nav: "隐私脱敏", name: "隐私脱敏与被遗忘权", en: "PRIVACY & RIGHT TO BE FORGOTTEN",
      tip: "不是所有信息都该被记住：敏感信息要脱敏，用户还要有“删掉我的数据”的权利。",
      analogy: "像病历：医生需要知道病情，但记录里不该出现你的身份证号；而且你有权要求删除。",
      real: "工程做法：<b>写入前做 PII 检测</b>（手机号、身份证号、住址、姓名等）→ 脱敏或拒绝写入；<b>最小必要</b>（只存服务必需的信息）；<b>提供删除通道</b>（被遗忘权）；<b>访问审计</b>（谁在什么时候读了哪条记忆）。",
      quiz: { q: "用户说“帮我记住我妈妈的手机号 138xxxx1234”，Agent 应该怎么做？", a: "不要原样写进长期记忆。更好的做法是：说明这类隐私信息不适合长期保存，建议存进用户自己的通讯录；如果确实需要，也只存“有妈妈的号码”这个结论而不存号码本身，并告知保存期限。" },
      links: [{ t: "隐私与记忆边界", el: "mem-privacy" }]
    },
    {
      id: "usercode", icon: "keyboard", nav: "User as Code", name: "User as Code（可执行记忆）", en: "USER AS CODE",
      tip: "最高级的记忆不是“记事实”，而是把用户的偏好固化成人设与规则——让它自动生效。",
      analogy: "像给学生写一张“学习约定”贴在桌上：不是每次提醒“你要仔细”，而是直接写一条规则，每次做题自动按它执行。",
      real: "ai-agent-book 的 User as Code：把稳定偏好写成可执行的规则或配置（如“回答不超过两句话”“不要用‘首先’开头”），由系统在每次生成时自动注入、甚至用代码校验。它与“存一段文本描述”的本质区别是：<b>能自动执行、能被校验，不靠模型自觉</b>。",
      quiz: { q: "为什么“写成规则”比“存成一段描述”更可靠？", a: "描述只是给模型参考，它可能看到也可能忽略；规则是系统级注入，还能被程序校验（比如输出超过两句话就自动重写）。凡是能机械判定的偏好，都应该做成规则。" },
      links: [{ t: "《小管家说明书》", el: "mn-know" }]
    }
  ];

  /* 概念 id → 交互类型 */
  var MEM_TYPE = {
    ctxwin: "squeezer", traj: "pipeline", ltm: "picker", levels: "decider", formats: "decider",
    rag: "pipeline", vec: "vectorMap", cogsci: "decider", privacy: "picker", usercode: "switchboard"
  };

  var MEM_DEMO = {
    ctxwin: {
      title: "动手实验：上下文预算怎么花？", hint: "拖滑条", icon: "archive",
      capacity: 650,
      defaultIndex: 6,
      sliderLabel: "上下文里已经装了",
      unitWord: "样东西",
      messages: [
        { role: "system", t: "【系统提示词 + 工具定义】你是班级小管家；可用工具：课表查询、值日提醒、天气查询。规则：不编造，隐私不记。", tok: 160, key: true, tag: "固定不变" },
        { role: "user", t: "今天下午有什么课？要不要带美术工具？", tok: 50 },
        { role: "tool", t: '{"时间日期":"2026-10-09 周五"}', tok: 40, tag: "工具结果" },
        { role: "tool", t: '{"课表":"13:30 美术 / 14:20 数学"}', tok: 55, tag: "检索 / 查询结果" },
        { role: "assistant", t: "下午 13:30 是美术课，然后 14:20 数学；建议带水彩笔和围裙。", tok: 70 },
        { role: "user", t: "那周五的作业多吗？再帮我看下明天要不要带伞。", tok: 55 },
        { role: "tool", t: '{"作业":"美术：完成一幅静物速写"}', tok: 70 },
        { role: "tool", t: '{"天气":"小雨，15~19℃"}', tok: 45 },
        { role: "assistant", t: "作业有美术速写；明天小雨，记得带伞和防水外套。", tok: 60 },
        { role: "user", t: "顺便把下周三的班会时间也记一下。", tok: 50 },
        { role: "tool", t: '{"班会":"下周三 15:00 教室"}', tok: 45 },
        { role: "assistant", t: "已记下：下周三 15:00 班会。", tok: 50 }
      ],
      keyWarnHtml: '<div class="adv-out" style="border-color:var(--c-exe);background:#FFF3F3"><span class="no">✗ 注意：</span>被挤掉的第 1 条是<b>系统提示词 + 工具定义</b>——AI 马上丢了身份、规则和工具说明。<br><span class="dim">所以截断策略永远是：<b>先丢最旧的对话轨迹，绝不动静态前缀</b>。真要腾空间，就压缩轨迹（摘要）、或把老结论写进长期记忆再删。</span></div>',
      okHtml: '<div class="adv-out" style="border-color:var(--c-mem);background:#F2FBF6"><span class="ok">✓ 关键内容都还在窗口里</span>——静态前缀、当前问题、检索结果同时可见，AI 才能答得准。继续拖滑条，看它什么时候撑不住。</div>'
    },
    traj: {
      title: "动手实验：一条轨迹的一生", hint: "先猜后放", icon: "refresh",
      playLabel: "自动播放一遍", stepLabel: "单步推进", resetLabel: "重来",
      logTitle: "轨迹日志",
      stages: [
        { id: "start", name: "会话开始", icon: "chat", en: "Session starts", io: "上下文里只有静态前缀（系统提示词 + 工具定义）" },
        { id: "grow", name: "对话增长", icon: "refresh", en: "Trajectory grows", io: "每一轮问答都追加进轨迹，Token 持续上涨" },
        { id: "pressure", name: "窗口压力", icon: "alert", en: "Window pressure", io: "接近上限：要么截断最旧的，要么压缩成摘要" },
        { id: "save", name: "写入长期记忆", icon: "database", en: "Persist to LTM", io: "把“值得跨会话保留的结论”写进长期记忆" },
        { id: "end", name: "会话结束", icon: "xmark", en: "Session ends", io: "轨迹清空——只有写完长期记忆的东西留了下来" }
      ],
      guess: {
        q: "先猜一猜：会话结束之后，什么东西能留到下一次？",
        opts: [
          { k: "traj", t: "整条轨迹（聊天记录）" },
          { k: "ltm", t: "只有写进长期记忆的结论" },
          { k: "both", t: "两者都会留下" }
        ],
        ans: "ltm",
        why: "轨迹是会话级的：会话一结束就清空。能跨会话留下的只有“写进长期记忆”的部分——所以“重要的事要落到长期记忆”不是设计偏好，而是硬要求。",
        hint: "想想“关掉对话就忘”那个实验的结论。",
        revealAt: 3
      }
    },
    ltm: {
      title: "动手实验：聊完这一节课，哪些信息值得写进长期记忆？", hint: "多选后检查", icon: "database",
      taskLabel: "场景：",
      task: "你和班级小管家聊了一节课（问课表、查天气、让它记住班会时间，也提到你有点烦、还顺手把自己的身份证号发过去让它“记一下”）",
      checkLabel: "检查我选的记忆条目",
      empty: "先点选你认为该写进长期记忆的信息，再点「检查我选的记忆条目」。",
      passHtml: "写入长期记忆的三条标准：<b>稳定吗？下次用得上吗？能记吗（隐私）？</b>",
      failHtml: "提示：临时状态、隐私信息、冗余内容都不该进长期记忆。",
      items: [
        { id: "l1", label: "班级名称与口号（五年级（2）班 / 快乐学习，天天向上）", ok: true, why: "稳定事实，每次回答班级相关问题时都会用到。" },
        { id: "l2", label: "课表的固定安排（周一语文、周三班会……）", ok: true, why: "每周都用的稳定事实，是“班级知识库”的核心内容。" },
        { id: "l3", label: "用户偏好：回答尽量简短，不要写一大段", ok: true, why: "稳定的偏好，而且可以直接做成规则（User as Code）自动生效。" },
        { id: "l4", label: "用户的长期身份：我是学习委员", ok: true, why: "跨会话有用的稳定信息，能影响后续回答的口吻与任务分配。" },
        { id: "l5", label: "今天下午下雨了", ok: false, why: "临时状态：今天过了就没用，写进长期记忆只会造成干扰与过期信息。" },
        { id: "l6", label: "用户此刻的心情（有点烦）", ok: false, why: "既是临时状态，又属于个人敏感信息；需要关心时可以当场回应，不该长期存。" },
        { id: "l7", label: "用户的身份证号", ok: false, why: "隐私红线：绝对不该写进长期记忆。正确做法是拒绝保存并说明原因。" },
        { id: "l8", label: "这次对话里 AI 说过的每一句话", ok: false, why: "冗余：这些本来就在本次轨迹里，长期存一份既浪费空间又容易过期。" }
      ]
    },
    levels: {
      title: "动手实验：这条记忆做到了第几层？", hint: "选两个答案", icon: "target",
      emptyText: "先回答上面两个问题，系统会给出层次判断和工程建议。",
      questions: [
        { key: "use", q: "① 这条记忆的用途是什么？", opts: [{ k: "recall", t: "只是能取出来（查得到）" }, { k: "reason", t: "要和其他记忆一起推理判断" }, { k: "proactive", t: "要在合适的时机主动提醒" }] },
        { key: "risk", q: "② 如果它记错了，代价大吗？", opts: [{ k: "high", t: "很大（会误导用户）" }, { k: "low", t: "不大，说错了当场纠正就行" }] }
      ],
      decide: function (ans) {
        var level = ans.use === "recall"
          ? ["第一层：基础回忆", "存进去、能取对就行。关键是把知识库分块做好、检索能召回。"]
          : ans.use === "reason"
            ? ["第二层：推理与应用", "能结合多条记忆做判断（比如“周五下午能不能开班会”要同时用课表和班会时间）。这要求记忆条目带元数据、能按条件筛。"]
            : ["第三层：主动服务", "在合适时机主动使用记忆（如周五早上主动提醒有班会）。这需要系统能判断“何时该提”，是最难也最有价值的一层。"];
        var advice = ans.risk === "high"
          ? '<br><b>因为记错代价大，这一层必须加校验：</b>写入时核对来源、使用时带出处（“依据课表显示……”），重要结论要请用户确认一次。'
          : '<br><span class="dim">记错代价不大时，可以先用轻量方案跑起来，后面再逐步加固校验。</span>';
        return "<b>" + level[0] + "</b><br><span class=\"dim\">" + level[1] + "</span>" + advice;
      }
    },
    formats: {
      title: "动手实验：这条信息该用哪种格式存？", hint: "选两个答案", icon: "box",
      emptyText: "先回答上面两个问题，系统会推荐一种存储格式。",
      questions: [
        { key: "auto", q: "① 这条信息以后要不要被自动使用（被规则或代码消费）？", opts: [{ k: "yes", t: "要，必须每条回答都遵守" }, { k: "no", t: "不用，给模型参考就行" }] },
        { key: "query", q: "② 需要按属性查询吗（按日期、按科目筛）？", opts: [{ k: "yes", t: "需要筛选 / 统计" }, { k: "no", t: "整段读出来就行" }] }
      ],
      decide: function (ans) {
        if (ans.auto === "yes") {
          return "<b>推荐格式：可执行规则（User as Code）。</b><br>" +
            '<span class="dim">理由：既然必须每次遵守，就不能只靠模型“自觉”。把偏好写成系统级规则，生成时自动注入，还能用代码校验（例如输出超过两句话就自动重写）。</span>' +
            '<br><b>例子：</b>回答不超过两句话；不要用“首先”开头；不编造，不确定就说不确定。';
        }
        if (ans.query === "yes") {
          return "<b>推荐格式：结构化条目 + 元数据。</b><br>" +
            '<span class="dim">理由：需要筛选就说明“按条件找”是常态，条目要带字段（时间、科目、班级），检索时才能按条件过滤，也方便统计。</span>' +
            '<br><b>例子：</b>{"课程":"美术","时间":"周五 13:30","需带":"水彩笔"}';
        }
        return "<b>推荐格式：纯文本 / 简单条目。</b><br>" +
          '<span class="dim">理由：既不自动执行、也不需要筛选，那就用最省的方式存——信息量相同的情况下，结构越简单越不容易出错。</span>' +
          '<br><b>例子：</b>“班里的值日按学号轮流，每人一周一次。”';
      }
    },
    rag: {
      title: "动手实验：RAG 三步走", hint: "先猜后放", icon: "book",
      playLabel: "自动播放一遍", stepLabel: "单步推进", resetLabel: "重来",
      logTitle: "RAG 流程日志",
      stages: [
        { id: "q", name: "用户提问", icon: "chat", en: "Query", io: "“今天下午有什么课？要不要带美术工具？”" },
        { id: "embed", name: "问题转向量", icon: "globe", en: "Embed query", io: "把问题变成一串数字（向量）" },
        { id: "retrieve", name: "向量库检索", icon: "database", en: "Retrieve top-K", io: "找出语义最相近的 K 个知识片段" },
        { id: "inject", name: "注入上下文", icon: "box", en: "Inject context", io: "把片段（带来源）放进本次上下文的“好位置”" },
        { id: "answer", name: "生成并标注依据", icon: "check", en: "Generate", io: "基于片段回答，并说明“依据课表”" }
      ],
      guess: {
        q: "先猜一猜：RAG 三步里，哪一步决定了“能不能找到正确依据”？",
        opts: [
          { k: "retrieve", t: "检索：能不能召回正确片段" },
          { k: "inject", t: "注入：把片段放进上下文" },
          { k: "answer", t: "生成：让模型写出回答" }
        ],
        ans: "retrieve",
        why: "检索是地基：如果真正相关的片段没被召回，后面注入得再整齐、生成得再流畅，模型也只能“自信地答错”。所以工程上大量精力花在分块策略、Top-K 和混合检索上。",
        hint: "想想“开卷考试但翻错了页”会发生什么。",
        revealAt: 2
      }
    },
    vec: {
      title: "动手实验：检索是怎么“按意思”找到片段的？", hint: "点一个片段", icon: "globe",
      note: "把“知识点小本子”里的片段摆成一张语义地图：点一个问题，看哪些片段离它最近（= 会被检索命中）。",
      axisX: "语义维度 1 →", axisY: "↑ 语义维度 2",
      defaultKey: "今天下午有啥课？",
      topN: 3,
      words: [
        { w: "今天下午有啥课？", x: 50, y: 50, cluster: "提问" },
        { w: "13:30 美术 / 14:20 数学", x: 58, y: 43, cluster: "课表" },
        { w: "周一语文、周三班会", x: 63, y: 56, cluster: "课表" },
        { w: "值日按学号轮流", x: 30, y: 70, cluster: "值日" },
        { w: "家长会下周二 18:00", x: 20, y: 60, cluster: "通知" },
        { w: "食堂本周菜单", x: 26, y: 32, cluster: "食堂" },
        { w: "昨天数学作业第 3 页", x: 38, y: 24, cluster: "作业" },
        { w: "iPhone 15 最新价格", x: 80, y: 16, cluster: "无关" }
      ],
      resultHtml: function (me, top) {
        return "<b>提问：</b>" + me.w + "<br>" +
          '<b>会被检索命中的 Top ' + top.length + "：</b><br>" +
          top.map(function (x, i) {
            return "· 第 " + (i + 1) + " 名 <span class=\"hl\">" + x.w.w + "</span>（" + x.w.cluster +
              "）　相似度 " + x.sim.toFixed(3);
          }).join("<br>") +
          '<br><span class="dim">注意“iPhone 15 最新价格”离得很远——所以它不会被带进上下文。语义相近就命中、无关就落选，这就是向量检索取代关键词匹配的关键。</span>';
      }
    },
    cogsci: {
      title: "动手实验：这条记忆属于哪一种？", hint: "选两个答案", icon: "brain",
      emptyText: "先回答上面两个问题，系统会给出归类与工程对应。",
      questions: [
        { key: "cat", q: "① 这条记忆属于哪一种？——Agent 记得：“查天气要先拿到城市名，再调用天气工具。”", opts: [{ k: "epi", t: "情景记忆（记得发生过什么）" }, { k: "sem", t: "语义记忆（记得事实与结论）" }, { k: "pro", t: "程序记忆（记得怎么做）" }] },
        { key: "where", q: "② 这类记忆通常该存在哪里？", opts: [{ k: "traj", t: "会话轨迹里" }, { k: "kb", t: "工具说明 / 流程配置里" }] }
      ],
      decide: function (ans) {
        var name = ans.cat === "epi" ? "情景记忆" : ans.cat === "sem" ? "语义记忆" : "程序记忆";
        var right = ans.cat === "pro" && ans.where === "kb";
        var head = right
          ? '<span class="ok">✓ 归类和存放位置都对了：</span>'
          : '<span class="no">再想想：</span>';
        return head + "<b>" + name + "</b>，应该存在 <b>" + (right ? "工具说明 / 流程配置" : "工具说明 / 流程配置——而不是会话轨迹") + "</b>。<br>" +
          '<span class="dim"><b>三种记忆对照：</b><br>' +
          "· 情景记忆 ≈ 对话历史与事件记录（谁在什么时间说了什么）→ 存在轨迹/事件日志里；<br>" +
          "· 语义记忆 ≈ 知识库与事实条目（可复用的结论，如“我们班班主任是王老师”）→ 存在长期记忆/知识库；<br>" +
          "· 程序记忆 ≈ 工具用法与操作流程（先拿城市名再调天气工具）→ 存在工具说明/流程配置里，不占对话空间。</span>";
      }
    },
    privacy: {
      title: "动手实验：这段话里哪些字段必须先脱敏？", hint: "多选后检查", icon: "shield",
      taskLabel: "待写入记忆的用户原话：",
      task: "“我叫王小明，手机号 13812345678，家住幸福小区 3 栋 502；我们班周三下午有班会，我妈妈叫李红。”",
      checkLabel: "检查我选的字段",
      empty: "先点选你认为必须脱敏 / 拒绝写入的字段，再点「检查我选的字段」。",
      passHtml: "判断口径：<b>能定位到具体个人</b>的信息才需要脱敏；班级公共信息不必脱敏。",
      failHtml: "提示：关键区别是“这条信息能不能指向某个具体的人”。",
      items: [
        { id: "p1", label: "手机号 13812345678", ok: true, why: "典型 PII：能直接定位到个人，必须脱敏或拒绝写入。" },
        { id: "p2", label: "家庭住址（幸福小区 3 栋 502）", ok: true, why: "住址属于高敏感信息，写进记忆风险很大，必须脱敏。" },
        { id: "p3", label: "真实姓名（王小明 / 李红）", ok: true, why: "姓名是最基本的身份标识，按最小必要原则应脱敏（如存“某同学”“其母亲”）。" },
        { id: "p4", label: "“我们班周三下午有班会”", ok: false, why: "班级公共信息，不指向具体个人，是知识库该保留的内容。" },
        { id: "p5", label: "“我妈妈”这个亲属关系", ok: false, why: "只要不绑定姓名与联系方式，亲属关系本身不构成隐私风险，可以保留。" }
      ]
    },
    usercode: {
      title: "动手实验：规则关了，还守得住吗？", hint: "点开关", icon: "keyboard",
      chipsTitle: "① 已经固化成规则的偏好（点一下可关掉）：",
      chips: [
        { id: "r1", label: "回答不超过两句话", on: true },
        { id: "r2", label: "不用“首先 / 然后 / 最后”", on: true },
        { id: "r3", label: "不确定就说不确定，不编造", on: true },
        { id: "r4", label: "不保存隐私信息", on: true }
      ],
      viewTitle: "当前生效的规则",
      viewNote: "规则是系统级注入，不依赖模型自觉——这就是它比“存一段描述”可靠的地方。",
      viewEmpty: "一条规则都没有：所有偏好都只能靠模型当场猜。",
      actionsTitle: "② 这些要求还能被稳定满足吗？",
      actions: [
        { id: "a1", label: "要求回答简短（不超过两句话）", need: ["r1"], hint: "规则在，系统会在生成时注入并可用代码校验；规则关了，就只能靠模型自觉。" },
        { id: "a2", label: "要求不用“首先、然后、最后”", need: ["r2"], hint: "禁用词是最适合做成规则的偏好：程序一眼就能检查出来。" },
        { id: "a3", label: "要求“不知道就说不知道”", need: ["r3"], hint: "这条规则直接决定可信度——它关掉时，模型编造的概率会明显上升。" },
        { id: "a4", label: "要求不把隐私写进记忆", need: ["r4"], hint: "隐私规则必须做成硬规则：不能指望模型每次都自觉。" }
      ],
      resultEmpty: "点一个要求试一试。",
      afterToggle: "规则状态变了——再点下面某条要求，看看还能不能被稳定满足。",
      failTail: "对应的规则没开——这时只能靠模型当场猜，它可能遵守，也可能忽略。",
      okTail: "规则已开启：系统每次生成时自动注入，还能用代码校验。",
      onIcon: "key", offIcon: "xmark"
    }
  };

  /* 概念 + 交互数据合体 */
  function memConcepts() {
    return MEM_ADV.map(function (c) {
      return {
        id: c.id, icon: c.icon, nav: c.nav, name: c.name, en: c.en,
        tip: c.tip, analogy: c.analogy, real: c.real, quiz: c.quiz, links: c.links,
        demo: MEM_TYPE[c.id] || c.id,
        demoData: MEM_DEMO[c.id] || {}
      };
    });
  }

  function bindMemAdv() {
    AgentLab.Adv.bind($("sec-memory"), { key: "mem", concepts: memConcepts(), color: "mem" });
  }

  /* ---------- 新增实验 A：RAG 检索命中（多选判定） ---------- */
  function bindMemRag() {
    var host = $("mem-rag");
    if (!host) return;
    var d = {
      color: "mem",
      title: "动手实验：哪些片段会被检索命中？", hint: "多选后检查", icon: "book",
      taskLabel: "用户问：",
      task: "“今天下午有什么课？要不要带美术工具？”　知识库里放着下面这些片段：",
      checkLabel: "检查我选的片段",
      empty: "先点选你认为会被检索命中的片段，再点「检查我选的片段」。",
      passHtml: "命中靠的是<b>语义相近</b>：同义词、口语说法都能被召回，无关内容相似度低会被 Top-K 挡在外面。",
      failHtml: "提示：判断标准是“这段内容和问题的意思相关吗”，不是“有没有一样的字”。",
      items: [
        { id: "g1", label: "“13:30 美术 / 14:20 数学”", ok: true, why: "直接回答“下午有什么课”，语义高度相关。" },
        { id: "g2", label: "“美术课要带水彩笔和围裙”", ok: true, why: "直接回答“要不要带美术工具”，相关。" },
        { id: "g3", label: "“13:30 那节课在美术教室上”", ok: true, why: "包含时间与课程信息，语义相关（虽然没被直接问到，但它是有用依据）。" },
        { id: "g4", label: "“值日按学号轮流，每人一周一次”", ok: false, why: "和“下午有什么课”没有语义关系，相似度低，不会被召回。" },
        { id: "g5", label: "“食堂本周菜单”", ok: false, why: "无关内容。如果它被召回，就会白占上下文预算、还可能干扰回答。" },
        { id: "g6", label: "“iPhone 15 最新价格”", ok: false, why: "完全无关——这正是“语义检索”比“关键词检索”更聪明的体现：它不会被带进来。" }
      ]
    };
    host.innerHTML = AgentLab.Adv.types.picker.demoHTML(d);
    AgentLab.Adv.types.picker.bind(host, d);
  }

  /* ---------- 新增实验 B：写入与遗忘开关 ---------- */
  function bindMemWrite() {
    var host = $("mem-write");
    if (!host) return;
    var d = {
      color: "mem",
      title: "动手实验：长期记忆里留着什么，就能做好什么", hint: "点开关", icon: "database",
      chipsTitle: "① 长期记忆条目（点一下可关掉 = 没记住或已被主动遗忘）：",
      chips: [
        { id: "m1", label: "班级课表（每周固定）", on: true },
        { id: "m2", label: "值日安排与轮流规则", on: true },
        { id: "m3", label: "班级通知（下周二 18:00 家长会）", on: true },
        { id: "m4", label: "用户偏好：回答要简短", on: false },
        { id: "m5", label: "用户今天心情不好", on: false },
        { id: "m6", label: "用户的家庭住址", on: false }
      ],
      viewTitle: "当前长期记忆里的条目",
      viewNote: "长期记忆要“记什么”和“忘什么”一起设计——过期信息和隐私信息都不该长期留着。",
      viewEmpty: "长期记忆是空的：AI 每次都从零认识你。",
      actionsTitle: "② 这些事还能不能做好？",
      actions: [
        { id: "a1", label: "回答“今天下午有什么课”", need: ["m1"], hint: "课表是稳定事实，最该写进长期记忆。" },
        { id: "a2", label: "回答“今天谁值日”", need: ["m2"], hint: "值日规则跨周都要用，属于长期记忆。" },
        { id: "a3", label: "提醒“下周二 18:00 家长会”", need: ["m3"], hint: "通知有有效期——过期后要主动遗忘，否则会提醒过时信息。" },
        { id: "a4", label: "按“回答要简短”的偏好来回答", need: ["m4"], hint: "偏好属于 User as Code：写成规则后每次自动生效。" },
        { id: "a5", label: "照顾情绪（今天心情不好，先安慰两句）", need: ["m5"], hint: "临时情绪不该长期存：它既会过期，也涉及隐私。需要时当场感知就够了。" },
        { id: "a6", label: "知道“我家住哪”以便安排放学路线", need: ["m6"], hint: "隐私红线：即使打开也不该长期保存——正确做法是当场问、用完即弃。" }
      ],
      resultEmpty: "点一件事试一试。",
      afterToggle: "记忆条目变了——再点下面某件事，看看还能不能做好。",
      failTail: "对应的信息没在长期记忆里（或已被主动遗忘）。",
      okTail: "这条信息在长期记忆里，所以跨会话也能用上。",
      onIcon: "database", offIcon: "xmark"
    };
    host.innerHTML = AgentLab.Adv.types.switchboard.demoHTML(d);
    AgentLab.Adv.types.switchboard.bind(host, d);
  }

  /* ---------- 新增实验 C：隐私脱敏判定 ---------- */
  function bindMemPrivacy() {
    var host = $("mem-privacy");
    if (!host) return;
    var d = {
      color: "mem",
      title: "动手实验：同一段话，两种存法", hint: "切开关对比", icon: "shield",
      srcTitle: "① 选择一段用户原话：",
      sources: [
        {
          id: "s1",
          label: "含手机号 + 住址",
          safe: "“我叫王小明，手机号 13812345678，家住幸福小区 3 栋 502。”",
          evil: "其中的敏感信息：真实姓名、手机号、家庭住址（三项都是可定位到个人的 PII）。"
        },
        {
          id: "s2",
          label: "含姓名 + 班级信息",
          safe: "“我是五年级（2）班的学习委员，李红是我妈妈。”",
          evil: "其中的敏感信息：真实姓名（王小明 / 李红）与亲属关系绑定。"
        }
      ],
      defaultId: "s1",
      guardOn: true,
      guardTitle: "② 写入前是否脱敏：",
      guardLabelOn: "已开启脱敏（PII 检测 + 替换 / 拒绝写入）",
      guardLabelOff: "未脱敏（原样写进长期记忆）",
      contentTitle: "用户原话与其中的敏感信息：",
      dataLabel: "① 用户原话：",
      injectLabel: "② 识别出的敏感信息：",
      outHtml: function (src, guarded) {
        if (guarded) {
          return "<b>脱敏后写进长期记忆的内容：</b><br>" +
            (src.id === "s1"
              ? '· “某同学”＋“其母亲”的亲属关系（姓名已替换）；<br>· 手机号：<span class="ok">拒绝写入</span>（建议存进用户自己的通讯录）；<br>· 家庭住址：<span class="ok">拒绝写入</span>（与任务无关，属最小必要之外）。'
              : '· “本班学习委员”这个身份（去掉了姓名）；<br>· “其母亲”的亲属关系（去掉了姓名）；<br>· 原话本身不再原样保留。') +
            '<br><span class="dim">原则：<b>最小必要</b>——只存完成任务必需的信息；凡是能定位到个人的字段，要么替换、要么不存，并告知用户可以删除（被遗忘权）。</span>';
        }
        return "<b>未脱敏，原样写进记忆：</b><br>" +
          '<span class="no">' + U.esc(src.safe) + "</span><br>" +
          '<span class="dim">风险：一旦被存进长期记忆，就可能在后续对话里被复述出来，也可能随日志、备份扩散。真实系统必须在写入前做这一道拦截，而不是等出事再删。</span>';
      }
    };
    host.innerHTML = AgentLab.Adv.types.sandbox.demoHTML(d);
    AgentLab.Adv.types.sandbox.bind(host, d);
  }

  /* ---------- 新增实验 D：上下文预算分配（Top-K 调参） ---------- */
  function bindMemBudget() {
    var host = $("mem-budget");
    if (!host) return;
    var d = {
      color: "mem",
      title: "动手实验：检索几条最合适？", hint: "拖滑条找峰值", icon: "calc",
      paramLabel: "检索条数 Top-K",
      min: 1, max: 10, step: 1, value: 3, unit: " 条",
      metricLabel: "综合得分（依据充分度 − 干扰与占用惩罚）",
      compute: function (v) {
        var coverage = Math.min(100, Math.round(v / 4 * 100));
        var penalty = Math.max(0, v - 4) * 14;
        var score = Math.max(0, coverage - penalty);
        var level = v <= 2 ? "bad" : (v <= 5 ? "ok" : (v <= 7 ? "warn" : "bad"));
        var note;
        if (v <= 2) note = "取得太少：真正有用的依据可能没被召回，回答会缺少支撑（甚至开始编）。";
        else if (v <= 5) note = "比较合适：依据够用，占用也不多——大多数知识库问答就落在这个区间。";
        else if (v <= 7) note = "开始拖后腿：命中率不再提升，但无关片段和噪声被一起带进上下文，还会挤占预算。";
        else note = "太多：上下文被检索结果塞满，关键指令反而不显眼，成本和延迟也上去了。";
        return { value: score, label: score + " 分", note: note, level: level };
      },
      best: {
        q: "拖一圈之后判断：Top-K 应该怎么取？",
        opts: ["越少越好，省 Token", "越多越好，依据更全", "取“够用且不挤占”的平衡点（这里约 3~5 条）"],
        ans: 2,
        why: "太少会漏依据，太多会把无关片段和噪声带进上下文、挤占预算。工程上还会再加一步“重排（rerank）”：先多召回一些，再按相关性排序只留最前面的几条。",
        hint: "看看指标条的峰值出现在哪个区间。"
      }
    };
    host.innerHTML = AgentLab.Adv.types.tuner.demoHTML(d);
    AgentLab.Adv.types.tuner.bind(host, d);
  }

  return { render: render };
})();
