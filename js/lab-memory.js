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

      /* ⑪ 小测验 */
      LP.card("mem", "⑪ 小测验：你是记忆小达人吗？", "共 " + QUIZ.length + " 题，覆盖短期/长期记忆、轨迹、三层次评估、四种存储格式、RAG、认知科学三种记忆、隐私边界。答对一题加一颗星！",
        '<div class="game-box" id="mem-quiz"><div id="mem-quiz-body"></div></div>' +
        '<div class="score-line"><span class="score-badge" id="mem-quiz-score" data-score="0">★ 0</span><button class="btn btn-ghost btn-sm" id="mem-quiz-restart">重来</button></div>'
      ) +

      /* ⑫ 进阶原理 + 课堂小结 */
      LP.deepCard("mem", "⑫ 进阶原理：记忆器 = 上下文工程 + RAG + 隐私治理", DEEP) +

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
  function bindGame() {
    var body = $("pg-memgame-body");
    function draw() {
      body.innerHTML = GAME.map(function (item, i) {
        return '<div class="game-q">' +
          '<span class="qno">' + (i + 1) + "</span>" + item.q +
          '<div class="opts">' +
            '<button class="opt" data-i="' + i + '" data-a="yes">' + U.icon("check", 18) + " 用了记忆</button>" +
            '<button class="opt" data-i="' + i + '" data-a="no">' + U.icon("xmark", 18) + " 没用记忆</button>" +
          "</div>" +
          '<div class="quiz-feedback" data-fb="' + i + '"></div></div>';
      }).join("");
      body.querySelectorAll(".opt").forEach(function (b) {
        b.addEventListener("click", function () {
          var i = parseInt(b.getAttribute("data-i"), 10);
          var picked = b.getAttribute("data-a") === "yes";
          var item = GAME[i];
          var fb = body.querySelector('[data-fb="' + i + '"]');
          var btns = body.querySelectorAll('.opt[data-i="' + i + '"]');
          if (btns[0].disabled) return;
          btns.forEach(function (x) { x.disabled = true; });
          if (picked === item.ans) {
            b.classList.add("correct");
            fb.innerHTML = '<span class="fb-ok">' + U.icon("check", 15) + " 判断正确！" + item.why + "</span>";
            U.addScore($("pg-memgame-score"), 1);
            U.celebrate(b);
          } else {
            b.classList.add("wrong");
            var rightBtn = body.querySelector('.opt[data-i="' + i + '"][data-a="' + (item.ans ? "yes" : "no") + '"]');
            if (rightBtn) rightBtn.classList.add("correct");
            fb.innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " 再想想：" + item.why + "</span>";
          }
        });
      });
    }
    draw();
    $("pg-memgame-restart").addEventListener("click", function () {
      var sc = $("pg-memgame-score");
      sc.setAttribute("data-score", "0");
      sc.textContent = "★ 0";
      draw();
    });
  }

  /* ---------- ⑪ 小测验 ---------- */
  function bindQuiz() {
    var body = $("mem-quiz-body");
    function draw() {
      body.innerHTML = QUIZ.map(function (item, i) {
        return '<div class="game-q">' +
          '<span class="qno">第 ' + (i + 1) + ' 题</span>' + item.q +
          '<div class="opts">' +
            item.opts.map(function (opt, oi) {
              return '<button class="opt" data-i="' + i + '" data-oi="' + oi + '">' + opt + '</button>';
            }).join("") +
          "</div>" +
          '<div class="quiz-feedback" data-fb="' + i + '"></div></div>';
      }).join("");
      body.querySelectorAll(".opt").forEach(function (b) {
        b.addEventListener("click", function () {
          var i = parseInt(b.getAttribute("data-i"), 10);
          var oi = parseInt(b.getAttribute("data-oi"), 10);
          var item = QUIZ[i];
          var fb = body.querySelector('[data-fb="' + i + '"]');
          var btns = body.querySelectorAll('.opt[data-i="' + i + '"]');
          if (btns[0].disabled) return;
          btns.forEach(function (x) { x.disabled = true; });
          if (oi === item.ans) {
            b.classList.add("correct");
            fb.innerHTML = '<span class="fb-ok">' + U.icon("check", 15) + " 答对啦！" + item.why + "</span>";
            U.addScore($("mem-quiz-score"), 1);
            U.celebrate(b);
          } else {
            b.classList.add("wrong");
            var rightBtn = body.querySelector('.opt[data-i="' + i + '"][data-oi="' + item.ans + '"]');
            if (rightBtn) rightBtn.classList.add("correct");
            fb.innerHTML = '<span class="fb-no">' + U.icon("xmark", 15) + " 正确答案是：" + item.opts[item.ans] + "。" + item.why + "</span>";
          }
        });
      });
    }
    draw();
    $("mem-quiz-restart").addEventListener("click", function () {
      var sc = $("mem-quiz-score");
      sc.setAttribute("data-score", "0");
      sc.textContent = "★ 0";
      draw();
    });
  }

  return { render: render };
})();
