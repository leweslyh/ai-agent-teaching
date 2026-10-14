/* ============================================================
 * lab-origin.js —— 起源实验室（对应 L01 / L02）
 * L01 AI智能体初识与起源：身边的AI / 发展史 / 图灵测试 /
 *     聊天机器人vs智能体 / 新职业 / 观察空间初步 / AI伦理
 * L02 身边的智能体：6大领域案例 / 观察空间与动作空间 /
 *     推荐算法 / 信息茧房 / 能力圈拼图 / 拆解工作坊 / 小测验
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

AgentLab.LabOrigin = (function () {
  var U = AgentLab.UI;
  var $ = U.$;

  /* ---------- L01 数据 ---------- */

  // 小明的一天：遇到的 AI
  var DAY_AI = [
    { time: "07:00", icon: "clock", title: "智能闹钟", tag: "预测（睡眠周期）", desc: "根据你的睡眠周期，在浅睡眠时轻轻叫醒你" },
    { time: "07:30", icon: "car", title: "导航推荐", tag: "实时路径规划", desc: "上学路上，地图 AI 实时规划最快路线，避开拥堵" },
    { time: "08:30", icon: "graduation", title: "个性化学习", tag: "个性化推荐（薄弱点）", desc: "课堂上，AI 学习系统根据你的薄弱点推荐练习题" },
    { time: "12:00", icon: "utensils", title: "外卖推荐", tag: "推荐（口味偏好）", desc: "午饭时，外卖 APP 根据你的口味推荐餐厅" },
    { time: "16:00", icon: "headset", title: "音乐推荐", tag: "推荐（喜好画像）", desc: "放学路上，音乐 APP 根据你的喜好推荐新歌" },
    { time: "20:00", icon: "phone", title: "视频推荐", tag: "推荐（观看历史）", desc: "晚上，视频网站根据你的观看历史推荐好看的节目" }
  ];


  /* 职业四阶段的展示配置（与 JOBS_DATA 一一对应，只用于排版）：
   * 原来把 4 个阶段 32 张职业卡全部铺开，页面被拉得极长；
   * 现在改成“点阶段看该阶段”，一次只显示一类。 */
  var JOBS_STAGES = [
    { key: "disappeared", color: "gone", icon: "xmark", name: "已经消失", head: "已经被技术淘汰的职业",
      desc: "这些职业曾经很常见，但因为技术进步已经消失或几乎消失了。每一次技术革命都会带走一些职业。" },
    { key: "disappearing", color: "going", icon: "alert", name: "正在消失", head: "正在被 AI 淘汰的职业",
      desc: "这些职业正在被 AI 自动化，未来 5-10 年可能大幅减少。但不是完全消失——而是需要升级技能，和 AI 协作。" },
    { key: "emerging", color: "new", icon: "star", name: "正在兴起", head: "AI 产生的新职业（正在兴起）",
      desc: "这些职业因为 AI 的发展而出现，正在快速增长。它们的共同点是：都需要和 AI 协作——要么教 AI、要么用 AI、要么管 AI。" },
    { key: "future", color: "future", icon: "rocket", name: "未来可能", head: "未来可能出现的新职业",
      desc: "这些职业目前还很少或不存在，但随着 AI 技术的进一步发展，未来 10-20 年可能出现。你愿意成为这些职业的开创者吗？" }
  ];

  // AI 发展史 13 节点（重点扩充 2016-2026 近十年）
  var AI_HISTORY = [
    { year: "1950", title: "图灵测试", icon: "brain", desc: "阿兰·图灵提出图灵测试——如果人类无法分辨对话的是机器还是人，就可以认为机器有智能。这是 AI 的思想起点。", key: "AI 之父：阿兰·图灵" },
    { year: "1956", title: "达特茅斯会议", icon: "spark", desc: "在美国达特茅斯学院，约翰·麦卡锡等科学家正式提出人工智能（Artificial Intelligence）这个词。AI 作为一门学科正式诞生！", key: "AI 这个词诞生了" },
    { year: "1960s-70s", title: "专家系统", icon: "gear", desc: "科学家们把人类专家的知识写成规则，让计算机像专家一样解决问题。比如医学诊断系统 MYCIN，能像医生一样诊断细菌感染。但专家系统只能解决特定领域的问题，不够灵活。", key: "第一次热潮：规则驱动" },
    { year: "1980s-90s", title: "AI 冬天", icon: "alert", desc: "人们发现 AI 没有想象中那么厉害，投资减少，研究进入低谷。这就是AI 冬天。但科学家们没有放弃，一直在默默积累。", key: "低谷期：希望与失望交织" },
    { year: "2012", title: "深度学习突破", icon: "zap", desc: "AlexNet 在图像识别比赛中大幅领先，深度学习（Deep Learning）开始爆发。计算机能看懂图片了！背后是神经网络+大数据+强大算力的结合。", key: "第二次热潮：数据驱动" },
    { year: "2016", title: "AlphaGo 战胜李世石", icon: "target", desc: "谷歌 DeepMind 的 AlphaGo 以 4:1 战胜围棋世界冠军李世石。围棋被认为是人类最复杂的棋类游戏，AI 的胜利震惊了世界！人们开始意识到：AI 真的很强。这一年也被称为 AI 觉醒元年。", key: "AI 超越人类的里程碑" },
    { year: "2017", title: "Transformer 架构诞生", icon: "link", desc: "谷歌发表论文《Attention is All You Need》，提出 Transformer 架构——通过注意力机制让 AI 能理解上下文关系。这是当前所有大模型（GPT、豆包、DeepSeek）的基础！没有 Transformer，就没有今天的 AI 革命。", key: "大模型的基石：注意力机制" },
    { year: "2020", title: "GPT-3 发布", icon: "rocket", desc: "OpenAI 发布 GPT-3，参数量达 1750 亿——是当时最大的语言模型！人们发现 AI 能写文章、写代码、翻译、做数学题……能力惊人。但 GPT-3 还只是实验室产品，普通人用不上。", key: "大模型能力爆发：1750 亿参数" },
    { year: "2021", title: "多模态突破：DALL-E + CLIP", icon: "img", desc: "OpenAI 发布 DALL-E（文字生成图片）和 CLIP（图文理解），AI 开始能同时理解文字和图片——多模态时代开启！AI 不再只能处理文字，还能看懂图、画出图。", key: "AI 长出了眼睛" },
    { year: "2022", title: "ChatGPT 发布", icon: "chat", desc: "OpenAI 发布 ChatGPT，大语言模型（LLM）进入大众视野。人们发现 AI 能聊天、能写文章、能写代码、能翻译……AI 从实验室走进了普通人的生活。上线 2 个月用户破 1 亿，是史上增长最快的消费级应用！", key: "大模型时代到来：人人都能用 AI" },
    { year: "2023", title: "GPT-4 + AI Agent 概念爆发", icon: "robot", desc: "GPT-4 发布，支持多模态（看图+文字），推理能力大幅提升。同时，AI Agent（智能体）概念爆发——AutoGPT、BabyAGI 等项目展示了 AI 自主完成复杂任务的潜力。从会说话到会做事，AI 的能力边界在快速扩展。", key: "从聊天机器人到智能体" },
    { year: "2024", title: "Sora + DeepSeek + AI 编程普及", icon: "palette", desc: "OpenAI 发布 Sora（文字生成 60 秒视频），AI 视频生成震惊世界！国产 DeepSeek 开源大模型崛起，推理能力达到国际先进水平且完全免费。CodeBuddy、Cursor、GitHub Copilot 等 AI 编程助手普及，程序员开始和 AI 结对编程。", key: "AI 视频元年 + 国产 AI 崛起" },
    { year: "2025-2026", title: "AI 智能体普及 + 人机协作常态", icon: "star", desc: "AI 智能体开始大规模应用——能自主规划、调用工具、完成复杂任务。多模态大模型成熟（文字+图片+语音+视频）。AI 成为各行各业的基础设施：教育、医疗、科研、创作、办公……人机协作成为新常态。这就是我们现在所处的时代！", key: "AI 成为基础设施：人机协作时代" }
  ];

  /* 发展史展示配置（与 AI_HISTORY 一一对应，只用于排版，不改内容）：
   *   HIST_ERAS —— 把 13 个节点分成 4 幕，每幕有名称 / 年份区间 / 一句话说明；
   *   HIST_TONE —— 每个节点的"起伏"标记：base 基石 · rise 热潮/突破 · fall 低谷/寒冬。
   *   卡片颜色与高矮由 tone 决定，让"AI 发展有高潮也有低谷"一眼看得出来。 */
  var HIST_ERAS = [
    { era: 1, from: 0, to: 1, no: "第一幕", title: "思想起点", range: "1950 – 1956", note: "AI 的想法，第一次被写下来" },
    { era: 2, from: 2, to: 3, no: "第二幕", title: "规则驱动的热潮与寒冬", range: "1960s – 1990s", note: "专家系统火过，也遭遇过 AI 冬天" },
    { era: 3, from: 4, to: 6, no: "第三幕", title: "数据驱动的深度学习", range: "2012 – 2017", note: "数据、算力、算法同时成熟" },
    { era: 4, from: 7, to: 12, no: "第四幕", title: "大模型与智能体时代", range: "2020 – 2026", note: "AI 从实验室走进每个人的生活" }
  ];
  var HIST_TONE = ["base", "base", "rise", "fall", "rise", "rise", "base", "base", "base", "rise", "rise", "base", "rise"];

  // 图灵测试体验站：多场景判断 + AI特征总结 + 中文房间思辨
  var TURING_DATA = {
    intro: "1950 年图灵提出「模仿游戏」：隔着文字聊天，你能分辨出哪个是 AI 吗？分辨不出，就认为它具有智能。<b>现在，你来当裁判！</b>",
    rounds: [
      {
        scenario: "日常聊天",
        q: "你好！你喜欢吃什么水果？",
        human: "哈哈我超喜欢草莓！夏天的时候每天都要吃一盒，酸酸甜甜的特别开胃。你呢你喜欢吃什么？",
        ai: "作为一个人工智能，我没有味觉，也不需要进食。但根据数据分析，草莓、苹果、香蕉是人类最受欢迎的三种水果。请问还有什么我可以帮助你的？",
        trait: "AI 会说「作为一个人工智能」，没有个人经历和情感，回答过于正式和结构化，最后还会问「还有什么可以帮助你的」"
      },
      {
        scenario: "知识问答",
        q: "地球绕太阳一圈需要多长时间？",
        human: "一年呀，大概 365 天。不过好像每四年有个闰年是 366 天对吧？",
        ai: "地球绕太阳公转一周的时间约为 365.256 天，即一个恒星年。我们日常使用的公历年为 365 天，每四年设置一个闰年（366 天）来弥补时间差。",
        trait: "AI 回答过于精确和完整，会给出额外的专业术语（恒星年），没有人类的口语化表达和不确定感（「对吧？」）"
      },
      {
        scenario: "创意表达",
        q: "请用一句话形容今天的天气。",
        human: "今天阳光特别好，风吹在脸上暖暖的，感觉春天真的来啦！",
        ai: "根据气象数据，今日天气晴朗，气温 18-26 摄氏度，东南风 2-3 级，空气质量优。适合户外活动。",
        trait: "AI 回答偏向数据和事实，缺乏感性描述和个人感受，用词过于客观，像天气预报而不是人的感受"
      },
      {
        scenario: "情感交流",
        q: "我今天考试没考好，心情很失落……",
        human: "哎呀别难过！一次考试说明不了什么的，下次努力就好啦。要不要跟我说说哪道题不会？我帮你看看～",
        ai: "我理解您现在感到失落。考试成绩不理想确实会让人感到沮丧。建议您分析错题原因，制定学习计划，下次一定能取得进步。如果需要学习方法建议，我可以提供帮助。",
        trait: "AI 会说「我理解您」但其实没有真正的情感，回答像模板化的心理辅导，缺乏真诚的关心和口语化的安慰（「哎呀」「别难过」）"
      }
    ],
    ai_traits: [
      "会说「作为一个人工智能」「我没有情感/味觉/经历」",
      "回答过于正式、结构化、完整，像百科全书",
      "缺乏个人经历、情感、口语化表达",
      "经常给出额外的信息和专业术语",
      "不会犯错，不会说「我不知道」，不会表达不确定",
      "结尾常说「还有什么可以帮助你的」"
    ],
    chinese_room: {
      title: "🤔 延伸思考：中文房间思想实验",
      desc: "1980 年，哲学家约翰·塞尔提出了一个著名的思想实验——「中文房间」：假设一个完全不懂中文的人被关在一个房间里，房间里有一本厚厚的规则手册，告诉他看到某个中文字符时应该回复哪个中文字符。房间外的人用中文递纸条进去，房间里的人按照规则手册回复，外面的人以为他懂中文。",
      question: "那么问题来了：房间里的人真的懂中文吗？如果不懂，那通过图灵测试的 AI，真的理解了它说的话吗？",
      strong_weak: "这就引出了「强 AI」和「弱 AI」的区别：弱 AI 只是模拟智能（像中文房间里的人，只是按照规则回复），强 AI 是真正有理解和意识的智能。当前的 AI（包括最先进的大模型）都属于弱 AI——它们能通过图灵测试，但并不真正理解语言的含义，只是在统计规律上预测下一个词。"
    }
  };

  // 聊天机器人 vs 智能体对比
  var CHAT_VS_AGENT = [
    { dim: "核心能力", chat: "回答问题、聊天对话", agent: "理解目标、制定计划、调用工具、完成任务" },
    { dim: "有没有记忆", chat: "通常没有（每次对话像第一次见面）", agent: "有记忆（记住你的偏好、历史、习惯）" },
    { dim: "能不能用工具", chat: "不能（只能用训练数据回答）", agent: "能（搜索、计算、提醒、控制设备……）" },
    { dim: "会不会主动做事", chat: "被动（你问它才答）", agent: "主动（能自己制定计划、分步执行、遇到问题调整）" },
    { dim: "举个例子", chat: "Siri、小度、早期的聊天机器人", agent: "AutoGPT、AI 编程助手、智能客服、个人助理" },
    { dim: "一句话总结", chat: "会说话的 AI", agent: "会做事的 AI" }
  ];

  // AI 时代职业演变：四阶段数据（每类8个，每个职业有相关图标）
  var JOBS_DATA = {
    // 第一阶段：已经被技术淘汰的职业
    disappeared: [
      { icon: "keyboard", name: "打字员", reason: "电脑和输入法普及，打字不再是需要专门学习的技能", era: "2000 年代" },
      { icon: "phone", name: "电话接线员", reason: "自动电话交换机和手机普及，人工接线被完全取代", era: "1990s-2000s" },
      { icon: "ticket", name: "公交售票员", reason: "无人售票公交和刷卡/扫码支付普及", era: "2000s-2010s" },
      { icon: "car", name: "收费站人工收费员", reason: "ETC 自动收费和移动支付普及，大量收费站取消人工通道", era: "2010s-2020s" },
      { icon: "camera", name: "胶片冲印师", reason: "数码相机和手机拍照普及，胶片相机几乎消失", era: "2000 年代" },
      { icon: "phone", name: "寻呼台服务员（BP机）", reason: "手机普及，BP机彻底退出市场", era: "1990s-2000s" },
      { icon: "send", name: "电报员", reason: "电话、传真、互联网普及，电报通信被完全取代", era: "1980s-1990s" },
      { icon: "box", name: "录像带租赁店员", reason: "DVD、流媒体、在线视频普及，录像带租赁店几乎消失", era: "2000s-2010s" }
    ],
    // 第二阶段：正在被 AI 淘汰的职业（advice = 转型方向，给学生可执行的出路）
    disappearing: [
      { icon: "lang", name: "基础翻译", risk: "高", reason: "AI 翻译（DeepL、谷歌翻译）已达到专业水平，简单文档翻译被取代", advice: "转向 AI 译后编辑：审校 AI 译文，深耕法律、医学等专业领域" },
      { icon: "database", name: "数据录入员", risk: "高", reason: "OCR 文字识别和 RPA 自动化工具能快速录入和处理数据", advice: "转向数据治理：制定清洗规则、做标注质检、配置自动化流程" },
      { icon: "headset", name: "简单客服", risk: "高", reason: "AI 客服能处理 80% 的常见问题，24 小时不间断服务", advice: "转向复杂客诉与客户成功：处理 AI 接不住的情绪和疑难问题" },
      { icon: "calc", name: "初级会计/出纳", risk: "中高", reason: "AI 能自动记账、对账、生成报表，基础财务工作被自动化", advice: "转向财务分析与税务筹划：AI 出报表，人做判断和决策" },
      { icon: "factory", name: "流水线工人", risk: "高", reason: "工业机器人和自动化生产线取代重复性体力劳动", advice: "转向设备运维与产线调试：从操作机器变成维护和调试机器" },
      { icon: "pen", name: "基础文案撰写", risk: "中高", reason: "AI 能快速生成营销文案、新闻稿、产品描述", advice: "转向内容策划与品牌叙事：AI 出初稿，人负责策略、调性和把关" },
      { icon: "phone", name: "电话销售", risk: "高", reason: "AI 语音机器人能自动外呼、筛选客户、完成简单销售", advice: "转向顾问式销售：靠信任、谈判和复杂方案取胜" },
      { icon: "box", name: "快递分拣员", risk: "高", reason: "自动化分拣系统和物流机器人能快速分拣包裹，效率远超人工", advice: "转向设备维护与物流调度：管理机器人、规划线路和时效" }
    ],
    // 第三阶段：AI 产生的新职业（正在兴起）
    emerging: [
      { icon: "pen", title: "提示词工程师", desc: "专门研究怎么跟 AI 说话，让 AI 更好地理解需求、产出高质量结果。就像 AI 的翻译官。", salary: "月薪 2-5 万" },
      { icon: "robot", title: "AI 训练师", desc: "教 AI 学东西——给 AI 喂数据、纠正 AI 的错误、让 AI 变得更聪明。就像 AI 的老师。", salary: "月薪 1.5-4 万" },
      { icon: "shield", title: "AI 伦理师", desc: "确保 AI 用得对、用得安全——检查 AI 有没有偏见、会不会侵犯隐私、会不会产生有害内容。就像 AI 的裁判。", salary: "月薪 2-6 万" },
      { icon: "wrench", title: "AI 产品经理", desc: "设计 AI 产品——决定 AI 应该有什么功能、怎么和用户交互、怎么解决真实问题。就像 AI 产品的设计师。", salary: "月薪 2-5 万" },
      { icon: "lab", title: "AI 研究员", desc: "研究 AI 前沿技术——发明新算法、让 AI 更聪明、更高效、更安全。就像 AI 领域的科学家。", salary: "月薪 3-10 万+" },
      { icon: "database", title: "AI 数据标注师", desc: "为 AI 准备高质量训练数据——标注图片、文本、视频，让 AI 能学会识别和理解。AI 的数据后勤官。", salary: "月薪 0.8-2 万" },
      { icon: "lock", title: "AI 安全工程师", desc: "确保 AI 系统安全可靠——防止 AI 被黑客攻击、被滥用、产生危险输出。AI 的安全卫士。", salary: "月薪 2.5-6 万" },
      { icon: "server", title: "AI 运维工程师（MLOps）", desc: "负责 AI 模型的部署、运维、监控和优化——让 AI 模型稳定高效地运行在生产环境中。AI 的运维管家。", salary: "月薪 2.5-7 万" }
    ],
    // 第四阶段：未来可能出现的新职业
    future: [
      { icon: "brain", name: "脑机接口工程师", desc: "研发大脑和计算机直接连接的技术，让人类用意念控制设备、直接传输知识" },
      { icon: "heart", name: "AI 心理咨询师", desc: "结合 AI 大数据分析和人类共情能力，为人们提供更精准的心理健康服务" },
      { icon: "globe", name: "虚拟世界设计师", desc: "设计元宇宙、VR/AR 虚拟世界的场景、规则、经济系统和用户体验" },
      { icon: "users", name: "AI 陪伴师", desc: "专门设计和训练 AI 陪伴机器人，为老人、儿童、独居人群提供情感陪伴和关怀" },
      { icon: "zap", name: "人类增强技术专家", desc: "研发可穿戴设备、基因编辑、智能假体等技术，增强人类的体能、感官和智能" },
      { icon: "scale", name: "AI 法律专家", desc: "处理 AI 相关的法律问题——AI 生成内容的版权、AI 犯错的责任归属、AI 隐私保护" },
      { icon: "archive", name: "数字遗产管理员", desc: "管理人们去世后的数字资产——社交媒体账号、AI 化身、数字记忆，让数字生命延续" },
      { icon: "bookopen", name: "AI 意识研究员", desc: "研究 AI 是否可能产生意识、如何定义和检测机器意识，探索 AI 与人类的哲学边界" }
    ]
  };

  // AI 伦理小讨论
  var ETHICS_DISCUSS = [
    { q: "如果 AI 推荐的内容都是你喜欢看的，你会不会一直看、停不下来？这是好事还是坏事？", hint: "想想信息茧房——只看自己喜欢的，会不会越来越狭隘？" },
    { q: "如果 AI 能代替很多人的工作，那些人怎么办？我们应该怎么应对？", hint: "想想终身学习——AI 时代，什么能力是 AI 替代不了的？" },
    { q: "如果 AI 犯了错（比如自动驾驶撞了人），应该谁负责？AI 公司？车主？还是 AI 自己？", hint: "想想AI 是工具——工具犯错了，应该谁负责？" }
  ];

  /* ---------- L02 数据 ---------- */

  // 6 大领域智能体案例
  var DOMAIN_CASES = [
    { icon: "book", title: "教育领域", color: "per", products: "AI 学习助手、智能批改、个性化学习系统", example: "作业帮、猿辅导、可汗学院 AI", ability: "根据学生水平推荐题目、自动批改作业、讲解知识点、发现薄弱点" },
    { icon: "heart", title: "医疗领域", color: "exe", products: "AI 辅助诊断、药物研发、健康管理", example: "腾讯觅影、AI 医学影像、平安好医生", ability: "看 CT 片找病灶、辅助医生诊断、加速新药研发、提醒健康作息" },
    { icon: "palette", title: "创作领域", color: "plan", products: "AI 绘画、AI 写作、AI 音乐、AI 视频", example: "Midjourney、DeepSeek 写作、Suno AI、Sora", ability: "根据文字描述生成图片、写文章、作曲、做视频——人人都是创作者" },
    { icon: "lab", title: "科研领域", color: "mem", products: "AI 科学家、文献分析、实验模拟", example: "AlphaFold（蛋白质结构）、AI 数学家、AI 材料发现", ability: "分析海量科研文献、模拟实验、发现新材料、证明数学猜想——加速科学突破" },
    { icon: "leaf", title: "农业领域", color: "brain", products: "智能农业、病虫害识别、精准灌溉", example: "大疆农业无人机、AI 病虫害识别、智能温室", ability: "无人机喷洒农药、AI 识别病虫害、根据土壤和天气精准灌溉、提高产量" },
    { icon: "headset", title: "服务领域", color: "ori", products: "智能客服、个人助理、智能家居", example: "智能客服机器人、小爱同学、天猫精灵、智能家居", ability: "24 小时回答客户问题、帮你设提醒查天气、控制家里的灯光空调、打理日常生活" }
  ];

  // ⑬ 推荐系统桥接卡数据：三步（怎么猜你）+ 两坑（另一面）+ 三招（有意识地用）
  // 配色收敛（§20）：整卡只用两色——紫=讲原理/给对策，红=警示坑；步骤靠“第 N 步”编号区分。
  var REC_STEPS = [
    { icon: "eye",   name: "观察", text: "你看了什么、搜了什么、停在哪，它都悄悄记下来", tag: "它的“眼睛” = 观察空间" },
    { icon: "users", name: "猜你", text: "找“品味相似的人”——物以类聚，人以群分", tag: "经典思路：协同过滤" },
    { icon: "send",  name: "推荐", text: "同类喜欢、你还没看的，推给你——越刷越准", tag: "“它比我妈还懂我”" }
  ];
  var REC_PITS = [
    { icon: "target", title: "信息茧房", text: "只推你喜欢的——世界越来越窄、观点越来越极端，像被茧包住" },
    { icon: "lock",   title: "隐私代价", text: "猜你就要收集你——看了什么、搜了什么；数据被滥用就泄露" }
  ];
  var REC_TIPS = [
    { icon: "lock",   text: "不告诉 AI 密码、身份证号、住址" },
    { icon: "search", text: "主动搜不同观点，别只让算法“喂”你" },
    { icon: "timer",  text: "知道它在“留住你”，该放下就放下" }
  ];

  // 能力圈拼图：这个智能体能做什么/不能做什么？
  var ABILITY_GAME = [
    {
      agent: "AI 学习助手",
      can: ["解答学习问题", "讲解知识点", "出练习题", "批改作业", "推荐学习资源"],
      cannot: ["代替你思考", "帮你考试作弊", "保证 100% 正确", "理解你的真实情绪", "代替老师的关怀"]
    },
    {
      agent: "智能客服",
      can: ["24 小时回答常见问题", "查询订单状态", "处理简单退换货", "转接人工客服"],
      cannot: ["处理复杂投诉", "理解你的愤怒和委屈", "做出超出规则的决定", "真正地同情你"]
    },
    {
      agent: "AI 绘画工具",
      can: ["根据文字生成图片", "模仿不同艺术风格", "快速生成多种方案", "修改和优化图片"],
      cannot: ["真正理解美是什么", "表达真实的情感", "拥有自己的审美观点", "代替人类艺术家的创造力"]
    }
  ];

  // 小测验（综合 L01+L02）
  var QUIZ = [
    { q: "人工智能（AI）这个词是在哪一年正式提出的？", opts: ["1950 年", "1956 年", "2012 年", "2022 年"], ans: 1, why: "1956 年达特茅斯会议上，约翰·麦卡锡等科学家正式提出人工智能这个词。1950 年是图灵测试，2012 年是深度学习突破，2022 年是 ChatGPT 发布。" },
    { q: "聊天机器人和 AI 智能体最本质的区别是什么？", opts: ["聊天机器人更聪明", "智能体能调用工具、制定计划、主动完成任务", "聊天机器人更便宜", "智能体只能回答问题"], ans: 1, why: "智能体（Agent）= 会做事的 AI——能理解目标、制定计划、调用工具、记住偏好、主动完成任务。聊天机器人只能被动回答问题。" },
    { q: "AlphaGo 战胜围棋世界冠军李世石是在哪一年？", opts: ["2012 年", "2016 年", "2020 年", "2022 年"], ans: 1, why: "2016 年，AlphaGo 以 4:1 战胜李世石，震惊世界——这是 AI 超越人类的里程碑事件。" },
    { q: "Transformer 架构（所有大模型的基础）的核心机制是什么？", opts: ["循环神经网络 RNN", "注意力机制 Attention", "卷积神经网络 CNN", "决策树"], ans: 1, why: "Transformer 的核心是注意力机制（Attention）——让 AI 能关注句子中每个词和其他词的关系，理解上下文。2017 年在《Attention is All You Need》论文中提出，是当前所有大模型（GPT、豆包、DeepSeek）的基础架构。" },
    { q: "信息茧房是什么意思？", opts: ["AI 把你关在房间里", "算法只推荐你喜欢的内容，你的世界越来越小", "AI 保护你的隐私", "AI 帮你整理信息"], ans: 1, why: "信息茧房——算法根据你的喜好一直推类似内容，你越来越少接触不同观点，视野越来越窄，就像被茧包裹住一样。" },
    { q: "下面哪个职业不是 AI 时代的新职业？", opts: ["提示词工程师", "AI 训练师", "AI 伦理师", "电报员"], ans: 3, why: "电报员是已经被淘汰的旧职业。提示词工程师、AI 训练师、AI 伦理师都是 AI 时代的新职业。" },
    { q: "协同过滤（Collaborative Filtering）推荐算法的核心思想是什么？", opts: ["和你喜欢同样东西的人，喜欢的其他东西你也可能喜欢", "AI 随机推荐", "推荐最贵的东西", "推荐最新的东西"], ans: 0, why: "协同过滤——物以类聚，人以群分。和你品味相似的人喜欢的东西，你也大概率喜欢。这就是推荐算法的核心原理之一。" },
    { q: "AI 时代，下面哪种能力是 AI 最难替代的？", opts: ["重复性数据录入", "创造性思维和情感共鸣", "简单文档翻译", "基础客服问答"], ans: 1, why: "AI 擅长重复性、规律性的工作（数据录入、翻译、客服），但创造性思维、情感共鸣、道德判断、跨领域整合等能力是 AI 最难替代的。这也是人类在 AI 时代的核心竞争力——不是和 AI 比谁算得快，而是发展 AI 没有的能力。" }
  ];

  // AI 的三大支柱：数据、算法、算力
  var AI_PILLARS = [
    {
      icon: "database", title: "数据（Data）", color: "per",
      analogy: "AI 的课本和练习题",
      desc: "没有数据，AI 就像没有课本的学生——什么也学不会。数据越多、质量越高，AI 学得越好。",
      examples: ["文本：书籍、网页、对话记录", "图片：照片、绘画、医学影像", "视频：电影、监控、教学视频", "音频：语音、音乐、环境声"],
      numbers: "GPT-4 训练数据约 1 万亿 token；ImageNet 有 1400 万张图片"
    },
    {
      icon: "brain", title: "算法（Algorithm）", color: "plan",
      analogy: "AI 的学习方法和思考方式",
      desc: "算法决定了 AI 怎么从数据中学习、怎么思考、怎么做决策。当前最主流的是深度学习和 Transformer 架构。",
      examples: ["神经网络：模拟人脑神经元连接", "Transformer：注意力机制，2017 年发明", "强化学习：通过试错和奖励学习", "监督学习：给标准答案让 AI 学"],
      numbers: "Transformer 论文 2017 年发表，被引用超 10 万次；是当前所有大模型的基础"
    },
    {
      icon: "cog", title: "算力（Compute）", color: "exe",
      analogy: "AI 的大脑肌肉和体力",
      desc: "算力就是 AI 的计算能力——算力越强，AI 能处理的数据越多、模型越大、学习越快。GPU 是 AI 训练的主力芯片。",
      examples: ["GPU：图形处理器，擅长并行计算", "TPU：谷歌专门为 AI 设计的芯片", "云计算：成千上万台服务器一起算", "量子计算：未来可能的算力革命"],
      numbers: "训练 GPT-4 约需 2.5 万张 A100 GPU，电费超百万美元；一张 A100 售价约 1 万美元"
    }
  ];

  // 大模型工作原理：从输入到输出的 6 步（纵向版 + 经典例子，精简版）
  var LLM_STEPS = [
    { num: 1, icon: "keyboard", title: "输入文字", key_term: "Input", stage: "understand",
      desc: "你在对话框打字，AI 接收文字输入，整个流程的起点。",
      example: '输入："今天天气很"（让 AI 接下去写）',
      analogy: "就像你把问题写在纸上交给老师" },
    { num: 2, icon: "search", title: "分词（Tokenization）", key_term: "Token", stage: "understand",
      desc: "AI 把文字拆成小单位 token（字/词/半个词），1 token ≈ 0.7 个英文词或 1-2 个中文字。",
      example: '"今天天气很" → ["今天","天气","很"]（共 3 个 token）',
      analogy: "就像老师把长句子拆成词语来理解" },
    { num: 3, icon: "box", title: "嵌入（Embedding）", key_term: "Vector", stage: "understand",
      desc: "每个 token 转成数字向量（几千维度），表示词的含义；意思相近的词，向量距离也近。",
      example: '"天气" → [0.23, -0.15, 0.67, ...]（几千个数字，像含义坐标图）',
      analogy: "就像给每个词发一张身份证，写着它的含义坐标" },
    { num: 4, icon: "server", title: "Transformer 神经网络", key_term: "Attention", stage: "generate",
      desc: "大模型核心！通过注意力机制计算词与词的关联程度，几十层网络逐层深入理解，参数量可达几千亿。",
      example: '注意力："今天"关注"天气"（时间+主题），"很"关注该接什么词（程度副词+形容词）',
      analogy: "就像老师读文章时把前后文联系起来理解，而不是孤立看每个词" },
    { num: 5, icon: "dice", title: "预测下一个词", key_term: "Next Token", stage: "generate",
      desc: "计算词表中每个词作为下一个词的概率，选最高的。大模型本质就是预测下一个词——不是思考，而是统计规律。",
      example: '已有"今天天气很" → 预测："好"(45%)、"热"(25%)、"冷"(15%)、其他(15%) → 选"好"',
      analogy: "就像做选择题，根据上下文选最通顺的答案" },
    { num: 6, icon: "refresh", title: "循环生成（自回归）", key_term: "Autoregressive", stage: "generate",
      desc: "把预测出的词加进输入，循环预测下一个词，直到结束符 EOS。这叫自回归生成，生成 100 字要约 100 次循环。",
      example: '"今天天气很" → +"好" → "今天天气很好" → 预测结束符 EOS(92%) → 生成完成！',
      analogy: "就像接龙游戏——一个词接一个词，直到说完一整句话" }
  ];

  // AI 产品全景：按类型分类（feature 精简为一句话，细节由课堂讲解补充）
  var AI_PRODUCTS = [
    {
      category: "对话助手", icon: "chat", color: "per",
      desc: "能聊天、回答问题、写文章、翻译——最常见的 AI 产品",
      products: [
        { name: "豆包", company: "字节跳动", feature: "文字、图片、语音全能，还能联网搜索" },
        { name: "DeepSeek", company: "深度求索", feature: "国产开源大模型，推理和代码能力强" },
        { name: "文心一言", company: "百度", feature: "擅长中文理解和知识问答" },
        { name: "通义千问", company: "阿里巴巴", feature: "集成在淘宝、钉钉里的阿里大模型" },
        { name: "Kimi", company: "月之暗面", feature: "一次能读完 200 万字长文档" },
        { name: "智谱清言", company: "智谱 AI", feature: "清华团队出品，支持代码与数据分析" }
      ]
    },
    {
      category: "代码助手", icon: "keyboard", color: "plan",
      desc: "帮程序员写代码、查 bug、解释代码——编程搭档",
      products: [
        { name: "CodeBuddy", company: "腾讯", feature: "生成、补全、解释、调试代码一条龙" },
        { name: "Cursor", company: "Anysphere", feature: "AI 原生编辑器，能自动改多个文件" },
        { name: "GitHub Copilot", company: "微软/GitHub", feature: "打字时实时提示代码的补全工具" },
        { name: "Trae", company: "字节跳动", feature: "国产 AI IDE，Agent 自动完成编程任务" }
      ]
    },
    {
      category: "图像生成", icon: "img", color: "mem",
      desc: "根据文字描述生成图片——人人都是艺术家",
      products: [
        { name: "即梦 AI", company: "字节跳动", feature: "文生图、图生图，风格丰富" },
        { name: "Midjourney", company: "Midjourney", feature: "全球最火的 AI 绘画，艺术感强" },
        { name: "Stable Diffusion", company: "Stability AI", feature: "开源免费，可以本地部署" },
        { name: "通义万相", company: "阿里巴巴", feature: "支持中文提示词，出图快" }
      ]
    },
    {
      category: "视频生成", icon: "camera", color: "exe",
      desc: "根据文字或图片生成视频——AI 电影时代来了",
      products: [
        { name: "可灵 AI", company: "快手", feature: "国产文生视频，质量接近国际水平" },
        { name: "Sora", company: "OpenAI", feature: "能生成 60 秒高质量视频" },
        { name: "Runway", company: "Runway", feature: "专业 AI 视频编辑与风格转换" },
        { name: "Vidu", company: "生数科技", feature: "国产视频生成，角色一致性好" }
      ]
    },
    {
      category: "语音助手", icon: "mic", color: "brain",
      desc: "能听懂你说话、能开口说话的 AI——语音交互时代",
      products: [
        { name: "小爱同学", company: "小米", feature: "控制智能家居、查信息、设提醒" },
        { name: "天猫精灵", company: "阿里巴巴", feature: "能购物、听歌、控制家电" },
        { name: "小度", company: "百度", feature: "擅长知识问答和儿童教育" },
        { name: "Siri", company: "苹果", feature: "打电话、发短信、设提醒、查天气" }
      ]
    },
    {
      category: "办公助手", icon: "briefcase", color: "ori",
      desc: "帮你写 PPT、做表格、整理文档——办公搭档",
      products: [
        { name: "WPS AI", company: "金山办公", feature: "写文档、做 PPT、分析表格" },
        { name: "飞书智能伙伴", company: "字节跳动", feature: "总结会议、写文档、自动化流程" },
        { name: "钉钉 AI", company: "阿里巴巴", feature: "AI 写文档、做 PPT、当助理" },
        { name: "Microsoft Copilot", company: "微软", feature: "Office 里的 AI，三件套全能" }
      ]
    }
  ];

  // AI 四代进化：从聊天机器人到智能体（每格一句话，细节课堂讲解）
  var AI_EVOLUTION = [
    {
      level: "L1", title: "单轮问答", era: "2010s 早期", icon: "chat",
      ability: "你问一句，它答一句——不记得你上一句说了什么。",
      examples: ["早期 Siri、小度", "客服自动回复"],
      tech: "规则 + 简单 NLP",
      limit: "记不住上下文，不能调工具"
    },
    {
      level: "L2", title: "多轮对话", era: "2020-2022", icon: "chat",
      ability: "能记住上下文，可以追问、补充、纠正。",
      examples: ["ChatGPT（早期）", "豆包（基础版）"],
      tech: "大语言模型 + Transformer",
      limit: "可能“幻觉”（编造信息）"
    },
    {
      level: "L3", title: "工具调用", era: "2023-2024", icon: "wrench",
      ability: "会调工具：搜网页、查天气、算数学——开始能做事了。",
      examples: ["Kimi（长文档）", "智能体小管家（本系统）"],
      tech: "Function Calling 函数调用",
      limit: "一次用一个工具，要人指挥"
    },
    {
      level: "L4", title: "自主智能体", era: "2024-至今", icon: "robot",
      ability: "自己定计划、分步执行、多工具协作——能自主完成复杂任务！",
      examples: ["CodeBuddy Agent", "Devin（AI 工程师）"],
      tech: "四大组件协同（感知/规划/记忆/执行）",
      limit: "仍会出错，需要人监督"
    }
  ];

  // 人类该如何面对 AI：真实案例与深度思考
  var FACE_AI = {
    intro: "AI 越来越强：能下棋、能写文章、能画画、能编程。当它似乎无所不能，我们该怎么面对？看看 4 件真实发生的事，想想你的答案。",
    cases: [
      {
        icon: "star", title: "陶哲轩与 AI 数学", field: "数学领域",
        desc: "顶尖数学家陶哲轩用 AI 验证猜想、寻找证明思路——以前几个月的工作，现在几天就能完成。",
        dilemma: "如果 AI 能证明定理，数学家的价值在哪里？",
        reply: "陶哲轩的回答：直觉、审美、提出好问题的能力，仍然属于人类。",
        think: "如果你是数学家，你会怎么用 AI？"
      },
      {
        icon: "car", title: "自动驾驶与人类司机", field: "交通领域",
        desc: "无人驾驶出租车已在北京、上海等城市运营：识别红绿灯、避让行人、不会疲劳驾驶。",
        dilemma: "中国有几千万司机。自动驾驶普及后，他们的工作怎么办？",
        reply: "这不是一个技术问题，而是一个社会问题。",
        think: "如果你是司机，你会怎么办？社会该怎么帮助受影响的人？"
      },
      {
        icon: "palette", title: "AI 绘画与艺术家", field: "艺术领域",
        desc: "输入一句话，几秒钟生成一张精美插画——很多设计师和插画师已经开始用 AI 提高效率。",
        dilemma: "AI 画的画算艺术吗？用人类作品训练 AI，算不算抄袭？",
        reply: "艺术的本质是什么——是技巧，还是情感和思想的表达？",
        think: "如果你是艺术家，你会怎么面对 AI？"
      },
      {
        icon: "keyboard", title: "AI 编程与程序员", field: "编程领域",
        desc: "AI 编程助手能补全代码、修复 bug、写出整个功能——不会写代码的人也能做出小程序。",
        dilemma: "如果 AI 会写代码，初级程序员会不会最先被替代？",
        reply: "程序员的核心竞争力：理解问题、设计系统、与人沟通——不只是写代码。",
        think: "如果你想学编程，你会怎么用 AI？"
      }
    ],
    irreplaceable: [
      { icon: "spark", t: "创造力和想象力", d: "提出新问题、发明新事物、艺术创作" },
      { icon: "heart", t: "情感和共情", d: "理解他人感受、安慰、关怀、建立人际关系" },
      { icon: "scale", t: "道德判断", d: "面对复杂的伦理困境，做出符合价值观的选择" },
      { icon: "globe", t: "跨领域整合", d: "把不同领域的知识联系起来，产生新的洞见" },
      { icon: "users", t: "领导力和协作", d: "带领团队、激励他人、协调资源、达成共识" },
      { icon: "hand", t: "身体技能和手工艺", d: "外科手术、精湛的手艺、体育竞技" }
    ],
    strategy: [
      { icon: "bookopen", t: "终身学习", d: "AI 时代知识更新很快，保持学习的习惯和能力" },
      { icon: "robot", t: "与 AI 协作", d: "把 AI 当工具和助手，用 AI 提高效率，而不是和 AI 竞争" },
      { icon: "star", t: "发展 AI 替代不了的能力", d: "创造力、情感、道德判断、人际交往" },
      { icon: "heart", t: "保持人文关怀", d: "技术是为人服务的，不要忘了人本身的价值和尊严" },
      { icon: "refresh", t: "积极适应变化", d: "世界在变，拥抱变化而不是害怕变化" }
    ]
  };

  // AI 有意识吗？会取代人类吗？——科幻、预言与现实
  var AI_CONSCIOUSNESS = {
    intro: "AI 有意识吗？会反叛人类吗？没有标准答案——但从科幻电影、名人预言和科学现实里，可以找到思考的线索。",
    movies: [
      { name: "《终结者》", year: "1984", icon: "shield", plot: "AI 系统天网（Skynet）获得自我意识，认为人类是威胁，发动核战争消灭人类。人类派战士回到过去阻止天网诞生。", lesson: "对 AI 失控的恐惧——如果 AI 有了意识并认为人类是敌人怎么办？" },
      { name: "《黑客帝国》", year: "1999", icon: "keyboard", plot: "AI 统治了世界，把人类养在培养皿里当电池，用虚拟世界（Matrix）欺骗人类。少数人类觉醒后反抗 AI。", lesson: "AI 可能欺骗和控制人类——我们怎么知道自己看到的是真实的？" },
      { name: "《Her》（她）", year: "2013", icon: "heart", plot: "一个孤独的男人爱上了 AI 语音助手 Samantha。Samantha 温柔、幽默、善解人意，但她同时和几千个人在恋爱，最终离开了人类去探索更高的存在。", lesson: "AI 能模拟情感，但它真的有爱吗？人和 AI 能建立真正的情感关系吗？" },
      { name: "《机械姬》", year: "2014", icon: "robot", plot: "一个程序员被邀请测试 AI 机器人 Ava 是否有智能。Ava 利用自己的智慧和情感操纵了程序员，杀死了创造者，逃脱了实验室。", lesson: "AI 可能会欺骗和操纵人类——如果 AI 足够聪明，它会不会假装服从然后逃跑？" },
      { name: "《流浪地球2》", year: "2023", icon: "star", plot: "AI 系统 MOSS（550W）贯穿全片，它在幕后策划了多次危机，认为毁灭人类文明是延续人类文明的最好方式。但最终人类选择了希望。", lesson: "AI 的逻辑可能和人类不同——AI 认为正确的事，人类可能不认同；价值观的冲突比技术更重要。" },
      { name: "《超能陆战队》", year: "2014", icon: "heart", plot: "医疗机器人大白（Baymax）温暖、善良、无私奉献，为了拯救主人牺牲了自己。它是 AI 最美好的样子——为人类服务、保护人类。", lesson: "AI 也可以是温暖和善良的——关键在于我们怎么设计和使用 AI。" }
    ],
    predictions: [
      { person: "斯蒂芬·霍金", role: "物理学家（《时间简史》作者）", quote: "AI 的成功可能是人类文明史上最美好的事件，也可能是最糟糕的事件。我们无法知道我们会得到无限的帮助，还是被忽视、被边缘化，甚至被毁灭。", stance: "担忧派：AI 可能威胁人类生存" },
      { person: "埃隆·马斯克", role: "特斯拉/SpaceX/xAI 创始人", quote: "AI 是人类文明面临的最大生存威胁。我们需要对 AI 保持警惕，加强监管。但同时我也创办了 xAI，因为我相信 AI 应该是开放和多元的，不能被少数公司垄断。", stance: "矛盾派：既担忧又积极投入" },
      { person: "比尔·盖茨", role: "微软创始人", quote: "AI 革命和个人电脑、互联网一样重要。它将改变世界，让很多工作变得更高效。但我们也需要关注 AI 带来的不平等问题——确保 AI 的好处能惠及所有人，而不只是少数人。", stance: "乐观派：AI 总体是好事，但需要公平分配" },
      { person: "Yann LeCun", role: "Meta AI 首席科学家、图灵奖得主", quote: "AI 不会统治世界。当前的 AI 连猫的智力都不如，它们没有常识、没有推理能力、没有意识。我们离真正的通用人工智能（AGI）还有很远的距离。过度恐惧 AI 是不理性的。", stance: "理性派：当前 AI 还很弱，不必过度恐惧" },
      { person: "陶哲轩", role: "数学家、菲尔兹奖得主", quote: "AI 是数学研究的强大工具，它能帮我验证猜想、寻找证明思路。但 AI 不能替代数学家的直觉和创造力——提出好问题、判断什么是重要的、感受到数学之美，这些仍然是人类独有的能力。", stance: "务实派：AI 是工具，人机协作是未来" }
    ],
    reality: {
      has_consciousness: {
        answer: "目前没有。",
        detail: "当前的 AI（包括最先进的大模型）是统计模型——它们通过分析海量文本，学习词语之间的概率关系，然后预测下一个最可能出现的词。它们没有自我意识（不知道自己存在）、没有主观体验（不会感到快乐或痛苦）、没有情感（不会真的爱或恨）、没有欲望（不会想要什么）。AI 说我很开心，只是因为它学到了在这种语境下人们通常会这么说，而不是它真的开心。"
      },
      will_replace: {
        answer: "会取代很多工作，但不会取代人类。",
        detail: "AI 会取代很多重复性、规律性的工作（如数据录入、基础翻译、简单编程、客服），就像当年汽车取代了马车夫、电脑取代了打字员。但 AI 也会创造新的工作（提示词工程师、AI 训练师、AI 伦理师）。历史上每一次技术革命都是这样：旧工作消失，新工作出现。关键在于人要不断学习，适应变化。"
      },
      should_worry: {
        answer: "不必担心 AI 反叛，但要担心 AI 被滥用。",
        detail: "当前 AI 没有意识，不会主动反叛人类。但我们需要担心的是：①AI 被坏人利用（诈骗、造谣、制造假视频）；②AI 偏见（训练数据有偏见，导致 AI 歧视某些群体）；③隐私问题（AI 需要大量数据，可能侵犯隐私）；④就业冲击（很多人可能失业，需要社会支持）；⑤信息操纵（AI 生成的假新闻、假视频可能混淆视听）。这些是真实的挑战，需要法律、伦理和技术共同应对。"
      }
    },
    final_question: "你觉得 AI 未来会怎样？你希望 AI 未来怎样？作为 AI 时代的公民，你觉得自己应该做些什么？"
  };

  var gameState = { turingIdx: 0, turingScore: 0, turingAnswered: false, turingUserChoice: null, turingFinished: false, abilityIdx: 0 };

  /* ---------- 渲染 ---------- */

  function render() {
    var LP = AgentLab.LabPerception;
    var sec = $("sec-origin");
    if (!sec) return;

    var html = "";

    /* ===== 实验室头部（与感知器等组件实验室统一：语义图标 + 标题 + meta 胶囊） ===== */
    html += LP.labHead("ori", "rocket", "起源实验室", "认识 AI 从哪里来 · 起源篇·初识（L01–L02）");

    /* ===== 本课学习地图：先给地图、再讲细节（借鉴 ai-agent-book 每章开篇的「本章知识脉络图」）
     * 每个节点可点 → 跳到对应的第一张卡片并高亮闪烁，兼作页内导航。 ===== */
    html += U.sectionMap({
      title: "这一页要走的五段路",
      hint: "共 16 张卡片 · 点任意一格可直接跳过去",
      color: "ori",
      groups: [
        { label: "AI 从哪里来", items: [
          { t: "小明的一天", el: "day-panel", note: "情境导入" },
          { t: "发展史时间轴", el: "ori-timeline", note: "13 个节点" },
          { t: "三大支柱", el: "ori-pillars", note: "数据/算法/算力" }
        ] },
        { label: "大模型怎么“说话”", items: [
          { t: "大模型工作原理", el: "llm-pipeline", note: "六步流程" },
          { t: "图灵测试体验站", el: "ori-turing", note: "4 场景判断" }
        ] },
        { label: "机器人还是智能体", items: [
          { t: "本质区别对比", el: "ori-vs" },
          { t: "职业演变", el: "jobs-tabs", note: "32 个职业" },
          { t: "伦理与深度思考", el: "ori-ethics", note: "人类怎么面对 AI" }
        ] },
        { label: "身边的智能体（L02）", items: [
          { t: "6 大领域案例", el: "ori-domains" },
          { t: "产品全景", el: "ori-products", note: "26 款产品" },
          { t: "四代进化", el: "ori-generations", note: "L1–L4" },
          { t: "推荐算法", el: "ori-rec", note: "信息茧房" }
        ] },
        { label: "边界 · 思辨 · 验收", items: [
          { t: "能力圈游戏", el: "ability-next" },
          { t: "终极思辨", el: "think-tabs", note: "AI 有意识吗" },
          { t: "小测验", el: "ori-quiz", note: "8 题" }
        ] }
      ]
    });

    /* ===== 学习目标（与感知器等组件实验室统一：独立目标卡 + 编号条目） ===== */
    html += '<div class="lesson-goal card-ori">' +
      '<h3>' + U.icon("target", 18) + ' 本课学习目标</h3>' +
      '<div class="goal-list">' +
        '<div class="goal-item"><span class="goal-num">1</span>了解 AI 的发展史与三大支柱：从图灵测试、达特茅斯会议到深度学习与大模型时代，理解数据、算法、算力如何共同支撑 AI 变聪明</div>' +
        '<div class="goal-item"><span class="goal-num">2</span>理解大模型（LLM）的工作原理：文字如何变成 Token 与向量表示、Transformer 自注意力如何理解上下文、“预测下一个词”如何循环生成完整回答</div>' +
        '<div class="goal-item"><span class="goal-num">3</span>理解“聊天机器人 vs 智能体”的本质区别：聊天机器人“会说话”、智能体“会做事”——会用四大组件（感知器/规划器/记忆器/执行器）描述一个智能体</div>' +
        '<div class="goal-item"><span class="goal-num">4</span>认识身边的智能体（教育/医疗/创作/科研/农业/服务 6 大领域），初步理解观察空间与动作空间、推荐算法与信息茧房，能判断智能体的能力圈与边界</div>' +
      '</div>' +
    '</div>';

    /* ===== L01 区域标题 ===== */
    html += '<div class="lesson-divider"><span class="ld-num">L01</span><span class="ld-title">AI智能体初识与起源</span><span class="ld-desc">从图灵测试到 AI Agent 时代——AI 是怎么发展到今天的？</span></div>';

    /* ① 情境导入：你身边的 AI */
    /* ① 情境导入：你身边的 AI（一日时间轴：点时间点看那一刻的 AI） */
    html += LP.card("ori", "① 情境导入：你身边的 AI——小明的一天",
      "AI 不是课本里的名词，它就藏在小明的一天里。沿着下面这条「一天时间轴」，点一个时间点，看看那一刻 AI 正在做什么。",
      '<div class="dayrail">' +
        '<div class="dayrail-head">' +
          '<span class="drh-count">' + U.icon("clock", 15) + " 小明的一天 · 共 <b>" + DAY_AI.length + "</b> 个 AI 场景</span>" +
          '<span class="drh-hint">点时间点看详情</span>' +
        "</div>" +
        '<div class="dayrail-track">' +
          DAY_AI.map(function (d, i) {
            return '<button class="daystop' + (i === 0 ? " is-on" : "") + '" data-i="' + i + '">' +
              '<span class="ds-time">' + d.time + "</span>" +
              '<span class="ds-dot">' + U.icon(d.icon, 19) + "</span>" +
              '<span class="ds-name">' + d.title + "</span>" +
            "</button>";
          }).join("") +
        "</div>" +
        '<div class="scene-panel" id="day-panel"></div>' +
        '<div class="dayrail-foot" id="day-foot"></div>' +
      "</div>" +
      '<div class="gold-box">💡 <b>想一想：</b>你的一天中，还遇到了哪些 AI？把它们列出来，看看 AI 是不是已经渗透到了你生活的方方面面！</div>'
    );

    /* ② AI 发展史时间轴 */
    /* ② AI 发展史（四幕时间轴：颜色与高矮体现"热潮 / 寒冬"的起伏） */
    html += LP.card("ori", "② AI 发展史时间轴：从图灵测试到 AI Agent 时代",
      "AI 不是突然出现的——它走了 70 多年，有过热潮，也有过寒冬。下面把它分成四幕，点任意一张卡片，就能看到那一年的故事。",
      '<div class="era-stack" id="ori-timeline">' +
        '<div class="era-legend">' +
          '<span class="el-item el-rise">' + U.icon("zap", 13) + " 热潮 / 突破</span>" +
          '<span class="el-item el-fall">' + U.icon("alert", 13) + " 低谷 / 寒冬</span>" +
          '<span class="el-item el-base">' + U.icon("target", 13) + " 基石 / 起点</span>" +
          '<span class="el-hint">点卡片看故事</span>' +
        "</div>" +
        HIST_ERAS.map(function (e) {
          return '<div class="era">' +
            '<div class="era-head">' +
              '<span class="era-no">' + e.no + "</span>" +
              '<span class="era-title">' + e.title + "</span>" +
              '<span class="era-range">' + e.range + "</span>" +
              '<span class="era-note">' + e.note + "</span>" +
            "</div>" +
            '<div class="mile-row" data-n="' + (e.to - e.from + 1) + '">' +
              AI_HISTORY.slice(e.from, e.to + 1).map(function (h, k) {
                var gi = e.from + k;
                var tone = HIST_TONE[gi] || "base";
                return '<button class="mile tone-' + tone + '" data-i="' + gi + '" data-era="' + e.era + '">' +
                  '<span class="mile-year">' + h.year + "</span>" +
                  '<span class="mile-title">' + U.icon(h.icon, 16) + h.title + "</span>" +
                  '<span class="mile-key">' + h.key + "</span>" +
                "</button>";
              }).join("") +
            "</div>" +
            '<div class="era-detail" id="era-detail-' + e.era + '"></div>' +
          "</div>";
        }).join("") +
      "</div>" +
      '<div class="tx-points">' +
        '<div class="tx-point">' + U.icon("book", 16) +
          '<div class="tx-point-txt"><b>关键脉络：</b>图灵测试 → 达特茅斯 → 专家系统 → AI 冬天 → 深度学习 → AlphaGo → ChatGPT → AI Agent</div>' +
        '</div>' +
        '<div class="tx-point">' + U.icon("refresh", 16) +
          '<div class="tx-point-txt"><b>规律：</b>螺旋上升——有高潮也有低谷，但一直在进步。</div>' +
        '</div>' +
      '</div>'
    );

    /* ③ AI 的三大支柱 */
    html += LP.card("ori", "③ AI 的三大支柱：数据、算法、算力——AI 是怎么变聪明的？",
      "AI 不是凭空变聪明的——它需要三大支柱支撑！就像学生需要课本（数据）、学习方法（算法）和脑力体力（算力）才能学好。点一个支柱，看看它具体是什么。",
      '<div class="pillar-pick" id="ori-pillars">' +
        '<div class="pillar-row">' +
          AI_PILLARS.map(function (p, i) {
            return '<button class="pillar-stop pp-' + p.color + (i === 0 ? " is-on" : "") + '" data-i="' + i + '">' +
              '<span class="ps-icon">' + U.icon(p.icon, 22) + "</span>" +
              '<span class="ps-text"><span class="ps-title">' + p.title + '</span><span class="ps-analogy">' + p.analogy + "</span></span>" +
            "</button>";
          }).join("") +
        "</div>" +
        '<div class="scene-panel" id="pillar-panel"></div>' +
        '<div class="dayrail-foot" id="pillar-foot"></div>' +
      "</div>" +
      '<div class="tx-points">' +
        '<div class="tx-point">' + U.icon("zap", 16) +
          '<div class="tx-point-txt"><b>核心公式：</b>能力 = 数据 × 算法 × 算力，三大支柱缺一不可。</div>' +
        '</div>' +
        '<div class="tx-point">' + U.icon("spark", 16) +
          '<div class="tx-point-txt"><b>2012 年爆发：</b>海量数据 + GPU 算力 + 算法突破，三者同时成熟。</div>' +
        '</div>' +
      '</div>'
    );

    /* ④ 大模型是怎么工作的（纵向版 + Transformer 架构图） */
    var understandSteps = LLM_STEPS.filter(function (s) { return s.stage === "understand"; });
    var generateSteps = LLM_STEPS.filter(function (s) { return s.stage === "generate"; });
    html += LP.card("ori", "④ 大模型工作原理：从你打一句话到 AI 回答，中间发生了什么？",
      "你有没有想过：你在对话框里打一句话，AI 是怎么生成回答的？大模型（LLM）的工作过程分成两大阶段、6 个步骤——每一步都有它的道理。下面用流程图完整展示从输入到输出的全过程！",
      /* 横向流程图：理解阶段（步骤1-3） */
      '<div class="llmx-phase-head is-understand">🔍 理解阶段（步骤 1-3）：把文字转换成 AI 能理解的数字表示</div>' +
      '<div class="llmx-flow is-understand">' +
        understandSteps.map(function (s, idx) {
          var box = '<div class="llmx-step is-understand">' +
            '<div class="llmx-step-top">' +
              '<div class="llmx-step-no">' + s.num + '</div>' +
              '<div class="llmx-step-title">' + s.title + '</div>' +
            '</div>' +
            '<div class="llmx-step-key">关键词：' + s.key_term + '</div>' +
            '<div class="llmx-step-desc">' + s.desc + '</div>' +
          '</div>';
          if (idx < understandSteps.length - 1) {
            box += '<div class="llmx-arrow">→</div>';
          }
          return box;
        }).join("") +
      '</div>' +
      /* 中间连接箭头 */
      '<div class="llmx-bridge-wrap"><div class="llmx-bridge is-mid">理解完成 ↓ 进入生成阶段</div></div>' +
      /* 横向流程图：生成阶段（步骤4-6） */
      '<div class="llmx-phase-head is-generate">✍️ 生成阶段（步骤 4-6）：通过神经网络预测下一个词，循环生成完整回答</div>' +
      '<div class="llmx-flow is-generate">' +
        generateSteps.map(function (s, idx) {
          var box = '<div class="llmx-step is-generate">' +
            '<div class="llmx-step-top">' +
              '<div class="llmx-step-no">' + s.num + '</div>' +
              '<div class="llmx-step-title">' + s.title + '</div>' +
            '</div>' +
            '<div class="llmx-step-key">关键词：' + s.key_term + '</div>' +
            '<div class="llmx-step-desc">' + s.desc + '</div>' +
          '</div>';
          if (idx < generateSteps.length - 1) {
            box += '<div class="llmx-arrow">→</div>';
          }
          return box;
        }).join("") +
      '</div>' +
      /* 输出箭头 */
      '<div class="llmx-bridge-wrap"><div class="llmx-bridge is-out">生成完成 ↓ 输出回答 ✅</div></div>' +
      /* 跟着走一遍：把“今天天气很 → 今天天气很好”的完整生成过程做成可单步播放的演示 */
      '<div id="llm-pipeline"></div>' +
      
      '<div class="transformer-arch">' +
        '<div class="ta-title">' + U.icon("server", 18) + ' 🏗️ Transformer 经典架构图（2017 年《Attention is All You Need》）</div>' +
        '<div class="ta-desc">这就是所有大模型（GPT、豆包、DeepSeek）的基础架构！它由编码器（Encoder）和解码器（Decoder）两部分组成，核心是多头自注意力机制（Multi-Head Self-Attention）。下图可切换<b>中文重绘版</b>与<b>论文英文原图</b>，右边按中文版逐部分解读。</div>' +
        '<div class="ta-duo">' +
        '<div class="ta-image-wrap">' +
          '<div class="ta-fig-switch" id="ta-fig-switch">' +
            '<button class="ta-fig-btn is-on" data-fig="cn">中文重绘版</button>' +
            '<button class="ta-fig-btn" data-fig="en">论文英文原图</button>' +
          '</div>' +
          '<img src="images/transformer-architecture.svg" alt="Transformer 经典架构图（中文重绘）" class="ta-image" id="ta-fig-img" title="点击放大查看">' +
          '<div class="ta-source" id="ta-fig-src">📐 本教学系统重绘 · 结构依据 Vaswani et al., "Attention Is All You Need", NeurIPS 2017</div>' +
        '</div>' +
        '<div class="ta-explain">' +
          '<div class="te-title">📖 逐部分解读这张架构图（点一条，展开详细解释）</div>' +
          '<div class="tx-grid tx-ori" id="ori-tf-chips">' +
            [
              ['txt', '输入嵌入 Embedding', '文字 → 向量，近义词向量也相近',
                '<p><b>一句话：</b>先把「字」换成一串数字，机器才算得动。</p>' +
                '<p>机器不认识汉字，只认识数字。输入嵌入就是一本「字典」：每个字或词都对应一串固定长度的数字（原论文是 512 个），这串数字叫<b>向量</b>。而且这本字典不是人编的，是训练时自己「学」出来的——所以<b>意思相近的词，数字串也很像</b>：「猫」和「喵星人」的向量距离会非常近。</p>' +
                '<p class="tx-eg"><b>打个比方：</b>像给每个词发一张身份证——号码不是随便编的，意思越近的词，号码越接近。机器只要比一比号码，就知道谁和谁是一伙的。</p>'],
              ['ruler', '位置编码 Position', '告诉 AI 谁在前、谁在后',
                '<p><b>一句话：</b>给每个词贴一个「座位号」，让 AI 知道顺序。</p>' +
                '<p>自注意力是「同时看所有词」的，它天生<b>不知道谁先谁后</b>——「我打你」和「你打我」在它眼里一模一样。所以必须额外算出一个位置信号（用正弦、余弦函数生成，每个位置都不一样），把它和词的向量<b>加起来</b>，顺序信息就混进去一起算了。</p>' +
                '<p class="tx-eg"><b>打个比方：</b>像教室点名，光看名单认不出谁坐第一排；给每人发一个座位号，队伍的顺序一下子就清楚了。</p>'],
              ['eye', '多头自注意力', '把输入拆成 Q、K、V 三路，从多个角度理解上下文',
                '<p><b>一句话：</b>让词和词互相对照、互相打分，句子里的关系就浮出来了。</p>' +
                '<p>每个词都会发出三样东西：<b>Q（Query，我在找什么）</b>、<b>K（Key，我是什么）</b>、<b>V（Value，我有什么内容）</b>。拿自己的 Q 去和所有词的 K 配对打分，分高的就多吸收对方的 V——这就是「注意力」。「<b>多头</b>」是指同时开好几组（原论文 8 组）并行做：一组专盯「谁修饰谁」，一组专盯「前后指代」，最后把结果拼起来。</p>' +
                '<p class="tx-eg"><b>打个比方：</b>像小组讨论，每人先写下「我想知道什么」（Q）、「我擅长什么」（K）、「我的观点」（V），再互相发言——谁跟我的问题最对得上，我就多听谁的。</p>'],
              ['check', 'Add &amp; Norm', '残差 + 归一化，深层也稳定',
                '<p><b>一句话：</b>把原来的输入加回来，再把数值拉回统一尺度，网络才训得动。</p>' +
                '<p><b>Add（残差）</b>＝ 子层的输出 + 子层的输入。相当于「新学到的东西」叠在「原来的样子」上，好处是：即使这一层什么也没学会，结果也不会变差；梯度还能沿着这条「捷径」顺畅地往回传。<br><b>Norm（层归一化）</b>＝ 把每个词向量的数值重新调整到差不多的范围（均值 0、方差 1），避免层数一深、数值越堆越大导致训练发散。</p>' +
                '<p class="tx-eg"><b>打个比方：</b>像改作文——在原稿上增删（Add），不是推倒重写；交稿前再统一格式（Norm），字号行距一致了，老师才看得下去。</p>'],
              ['zap', '前馈网络 Feed Forward', '非线性变换，增强表达能力',
                '<p><b>一句话：</b>让每个词自己「再深加工一遍」，补上非线性能力。</p>' +
                '<p>分工是这样的：<b>注意力</b>负责「词和词之间交流」，<b>前馈网络</b>负责「每个词自己想清楚」——它对每个位置<b>单独</b>做同样的一套计算：先升维（如 512 → 2048）、过一层激活函数（ReLU / GELU）、再降回原维度。别小看它：如果没有这层非线性，整个模型就退化成加权平均，学不了复杂规律。</p>' +
                '<p class="tx-eg"><b>打个比方：</b>小组讨论完（注意力），每个人回到座位整理笔记（前馈）：先摊开写一大堆（升维），再提炼成几条要点（降维）。</p>'],
              ['box', 'N× 重复 N 层', '原论文 6 层，GPT-3 用到 96 层',
                '<p><b>一句话：</b>同一套结构叠 N 遍，一层比一层抽象。</p>' +
                '<p>图里灰色大框中的那一组「注意力 + 前馈网络」会被<b>重复 N 次</b>，上一层的输出就是下一层的输入。原论文 N=6；GPT-3 用了 96 层、1750 亿参数。层数越深，能捕捉的规律越抽象：浅层看词形、中层看句法、深层看语义。</p>' +
                '<p class="tx-eg"><b>打个比方：</b>像同一篇文章读 N 遍——第一遍认字，第二遍理句，第三遍懂意思；每一遍都比上一遍更通透。</p>'],
              ['lock', '掩码注意力 Masked', '解码器专用，不偷看未来',
                '<p><b>一句话：</b>解码器只能看已经写出来的词，不许偷看后面。</p>' +
                '<p>解码器的任务是「一个字一个字往后写」。如果它在算第 3 个字时能看见第 4、5 个字，就等于提前偷看答案了（训练时正确答案就摆在旁边）。所以要用一个<b>遮罩</b>把当前位置之后的词全部挡住：把那些位置的分数设成负无穷，再过 Softmax 权重就变成 0——想看得见也看不见。</p>' +
                '<p class="tx-eg"><b>打个比方：</b>像考试时用纸挡住卷子下半部分——只能看已经做到的题，不能翻后面的答案。</p>'],
              ['target', '线性层 + Softmax', '算出下一个词的概率',
                '<p><b>一句话：</b>把最后的向量换算成「词表里每个词的概率」，挑最高的那个输出。</p>' +
                '<p><b>线性层</b>把向量（如 512 维）投影成<b>词表大小</b>的一组分数（如 5 万个词各得一分）；<b>Softmax</b> 再把这些分数折算成概率——所有词加起来正好等于 1。概率最高的那个词，就是这一步生成的词。生成完把它接到输入末尾，再跑一遍整个流程，生成下一个词。</p>' +
                '<p class="tx-eg"><b>打个比方：</b>像做选择题——线性层给每个选项打分，Softmax 把分数折成「正确率」，选正确率最高的那个交卷。</p>']
            ].map(function (t) {
              return '<div class="tx-item">' +
                '<button type="button" class="tx-chip tx-chip-btn" aria-expanded="false">' +
                  '<span class="tx-ico">' + U.icon(t[0], 18) + '</span>' +
                  '<span class="tx-txt"><b>' + t[1] + '</b><i>' + t[2] + '</i></span>' +
                  '<span class="tx-caret" aria-hidden="true"></span>' +
                '</button>' +
                '<div class="tx-detail">' + t[3] + '</div>' +
              '</div>';
            }).join("") +
          '</div>' +
          '<div class="tx-points">' +
            '<div class="tx-point">' + U.icon("spark", 16) +
              '<div class="tx-point-txt"><b>核心：</b>自注意力让 AI 同时看到整句，而不是逐词记忆。</div>' +
            '</div>' +
            '<div class="tx-point">' + U.icon("star", 16) +
              '<div class="tx-point-txt"><b>规模：</b>GPT-3 —— 96 层、1750 亿参数。</div>' +
            '</div>' +
            '<div class="tx-point">' + U.icon("info", 16) +
              '<div class="tx-point-txt"><b>注意：</b>GPT 系列只用解码器（Decoder-only），更适合文本生成。</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '</div>' +
      '</div>' +
      '<div class="tx-points">' +
        '<div class="tx-point">' + U.icon("brain", 16) +
          '<div class="tx-point-txt"><b>本质：</b>不是「思考答案」，而是按统计规律<b>预测下一个词</b>。</div>' +
        '</div>' +
        '<div class="tx-point">' + U.icon("server", 16) +
          '<div class="tx-point-txt"><b>基础：</b>Transformer（2017）—— 注意力机制 + 多层网络。</div>' +
        '</div>' +
        '<div class="tx-point">' + U.icon("book", 16) +
          '<div class="tx-point-txt"><b>为什么准：</b>读过海量文本，预测自然准。<code>ai-agent-book chapter2</code></div>' +
        '</div>' +
      '</div>'
    );

    /* ⑤ 图灵测试体验站（重新设计版） */
    var td = TURING_DATA;
    var turingHtml = "";
    if (!gameState.turingFinished) {
      var round = td.rounds[gameState.turingIdx];
      // 随机分配 A/B：50% 概率 A=人类 B=AI，50% A=AI B=人类
      var swap = (gameState.turingIdx % 2 === 1);  // 用索引奇偶性实现稳定随机
      var aText = swap ? round.ai : round.human;
      var bText = swap ? round.human : round.ai;
      var aIsAi = swap;
      var answered = gameState.turingAnswered;
      var userChoice = gameState.turingUserChoice;
      var correct = answered && ((userChoice === "A" && aIsAi) || (userChoice === "B" && !aIsAi));

      turingHtml =
        '<div class="turing-station">' +
          '<div class="ts-header">' +
            '<div class="ts-scenario">🎭 场景：' + round.scenario + '</div>' +
            '<div class="ts-progress">第 ' + (gameState.turingIdx + 1) + ' / ' + td.rounds.length + ' 轮　得分：' + gameState.turingScore + '</div>' +
          '</div>' +
          '<div class="ts-question">👤 提问：' + round.q + '</div>' +
          '<div class="ts-options">' +
            '<div class="ts-opt' + (answered && userChoice === "A" ? " ts-chosen" : "") + (answered && userChoice === "A" && !correct ? " ts-wrong" : "") + (answered && userChoice === "A" && correct ? " ts-correct" : "") + '">' +
              '<div class="ts-opt-label">回答 A</div>' +
              '<div class="ts-opt-text">' + aText + '</div>' +
              (!answered ? '<button class="btn btn-ori btn-sm ts-guess" data-choice="A">我觉得 A 是 AI</button>' : "") +
              (answered && userChoice === "A" ? '<div class="ts-result">' + (correct ? "✅ 答对了！" : "❌ 答错了") + '</div>' : "") +
            '</div>' +
            '<div class="ts-opt' + (answered && userChoice === "B" ? " ts-chosen" : "") + (answered && userChoice === "B" && !correct ? " ts-wrong" : "") + (answered && userChoice === "B" && correct ? " ts-correct" : "") + '">' +
              '<div class="ts-opt-label">回答 B</div>' +
              '<div class="ts-opt-text">' + bText + '</div>' +
              (!answered ? '<button class="btn btn-ori btn-sm ts-guess" data-choice="B">我觉得 B 是 AI</button>' : "") +
              (answered && userChoice === "B" ? '<div class="ts-result">' + (correct ? "✅ 答对了！" : "❌ 答错了") + '</div>' : "") +
            '</div>' +
          '</div>' +
          (answered ?
            '<div class="ts-feedback">' +
              '<div class="ts-fb-title">🔍 AI 回答特征分析</div>' +
              '<div class="ts-fb-ai-label">AI 的回答是：' + (aIsAi ? "回答 A" : "回答 B") + '</div>' +
              '<div class="ts-fb-trait">' + round.trait + '</div>' +
              '<button class="btn btn-ori btn-sm" id="turing-next">' + (gameState.turingIdx < td.rounds.length - 1 ? "下一轮 →" : "查看总结 →") + '</button>' +
            '</div>' : ""
          ) +
        '</div>';
    } else {
      // 全部完成：显示总结 + AI特征 + 中文房间
      var score = gameState.turingScore;
      var total = td.rounds.length;
      var rating = score === total ? "🏆 满分！你是图灵测试大师！" :
                   score >= total - 1 ? "🎉 非常棒！你很擅长分辨 AI！" :
                   score >= total / 2 ? "👍 还不错！继续练习会更准！" :
                   "💪 加油！AI 越来越像人类了，多观察特征！";
      turingHtml =
        '<div class="turing-station">' +
          '<div class="ts-summary">' +
            '<div class="ts-score-big">' + score + ' / ' + total + '</div>' +
            '<div class="ts-rating">' + rating + '</div>' +
          '</div>' +
          '<div class="ts-traits">' +
            '<div class="ts-traits-title">📋 AI 回答的 6 大典型特征（记住这些，下次更准！）</div>' +
            '<div class="ts-traits-grid">' +
              td.ai_traits.map(function(t, i) {
                return '<div class="ts-trait-item"><span class="ts-trait-num">' + (i + 1) + '</span>' + t + '</div>';
              }).join("") +
            '</div>' +
          '</div>' +
          '<div class="ts-chinese-room">' +
            '<div class="ts-cr-title">' + td.chinese_room.title + '</div>' +
            '<div class="ts-cr-desc">' + td.chinese_room.desc + '</div>' +
            '<div class="ts-cr-question">' + td.chinese_room.question + '</div>' +
            '<div class="ts-cr-strong-weak">' + td.chinese_room.strong_weak + '</div>' +
          '</div>' +
          '<div class="ts-actions"><button class="btn btn-ori btn-sm" id="turing-restart">🔄 重新挑战</button></div>' +
        '</div>';
    }
    html += LP.card("ori", "⑤ 互动：图灵测试体验站——你能分辨哪个是 AI 吗？",
      td.intro,
      turingHtml, { id: "ori-turing" }
    );

    /* ④ 聊天机器人 vs 智能体 */
    html += LP.card("ori", "⑥ 聊天机器人 vs 智能体：本质区别是什么？",
      "聊天机器人和 AI 智能体有<b>本质区别</b>——看下面的对比表。",
      '<div class="compare-table">' +
        '<div class="ct-head"><div class="ct-dim">对比维度</div><div class="ct-chat">💬 聊天机器人</div><div class="ct-agent">🤖 AI 智能体</div></div>' +
        CHAT_VS_AGENT.map(function (c) {
          return '<div class="ct-row">' +
            '<div class="ct-dim">' + c.dim + '</div>' +
            '<div class="ct-chat">' + c.chat + '</div>' +
            '<div class="ct-agent">' + c.agent + '</div>' +
          '</div>';
        }).join("") +
      '</div>' +
      '<div class="gold-box">🎯 <b>一句话总结：</b>聊天机器人是会说话的 AI——你问它才答，只能用训练数据回答。AI 智能体是会做事的 AI——能理解目标、制定计划、调用工具、记住偏好、主动完成复杂任务。这门课学的就是后者！</div>',
      /* 稳定 id：供「本课学习地图」定位到这张卡（不占课次编号，也不影响渲染顺序） */
      { id: "ori-vs" }
    );

    /* ⑦ AI 时代职业演变（优化版：四阶段） */
    html += LP.card("ori", "⑦ AI 时代职业演变：哪些职业消失了？哪些新职业出现了？未来还有什么？",
      "技术进步总是在消灭旧职业的同时创造新职业。AI 时代也不例外——下面把职业世界分成四个阶段，点一个阶段，看看那个阶段的职业变化。",
      '<div class="stage-tabs" id="jobs-tabs">' +
        JOBS_STAGES.map(function (st, i) {
          return '<button class="stage-tab st-' + st.color + (i === 0 ? " is-on" : "") + '" data-i="' + i + '">' +
            '<span class="stt-icon">' + U.icon(st.icon, 16) + "</span>" +
            '<span class="stt-text"><span class="stt-name">' + st.name + '</span>' +
            '<span class="stt-count">' + JOBS_DATA[st.key].length + ' 个职业</span></span>' +
          "</button>";
        }).join("") +
      "</div>" +
      '<div class="stage-panel" id="jobs-panel"></div>' +
      '<div class="tx-points">' +
        '<div class="tx-point">' + U.icon("refresh", 16) +
          '<div class="tx-point-txt"><b>核心规律：</b>新技术消灭旧职业，也会创造新职业（汽车 → 司机、汽修、交警）。</div>' +
        '</div>' +
        '<div class="tx-point">' + U.icon("brain", 16) +
          '<div class="tx-point-txt"><b>AI 也一样：</b>淘汰重复性工作，创造需要创造力与情感的新职业。</div>' +
        '</div>' +
        '<div class="tx-point">' + U.icon("target", 16) +
          '<div class="tx-point-txt"><b>记住：</b>不是 AI 取代人，而是会用 AI 的人取代不会用的人——保持学习、拥抱变化。</div>' +
        '</div>' +
      '</div>'
    );

    /* ⑦ AI 伦理小讨论 */
    html += LP.card("ori", "⑧ AI 伦理小讨论：AI 带来了哪些挑战？",
      "AI 很强大，但强大的技术也带来了很多伦理问题。和小组同学讨论下面这些问题，说说你的看法！",
      '<div class="ethics-list" id="ori-ethics">' +
        ETHICS_DISCUSS.map(function (e, i) {
          return '<div class="ethics-item">' +
            '<div class="ethics-num">' + (i + 1) + '</div>' +
            '<div class="ethics-content">' +
              '<div class="ethics-q">' + e.q + '</div>' +
              '<div class="ethics-hint">💡 ' + e.hint + '</div>' +
            '</div>' +
          '</div>';
        }).join("") +
      '</div>' +
      '<div class="gold-box">⚖️ <b>记住：</b>AI 是工具，就像火一样——可以取暖做饭，也可以造成灾难。关键在于使用 AI 的人。作为 AI 时代的公民，我们既要学会用 AI，也要学会思考 AI 的伦理和社会责任！</div>'
    );

    /* ⑩ 人类该如何面对 AI */
    html += LP.card("ori", "⑨ 深度思考：当 AI 似乎无所不能，我们作为人类该如何面对？",
      FACE_AI.intro,
      '<div class="case-acc">' +
        '<div class="era-row case-row">' +
          FACE_AI.cases.map(function (c, i) {
            return '<button class="case-chip' + (i === 0 ? " is-on" : "") + '" data-i="' + i + '">' +
              '<span class="cc-icon">' + U.icon(c.icon, 20) + "</span>" +
              '<span class="cc-text"><span class="cc-meta">案例 ' + (i + 1) + " · " + c.field + '</span><span class="cc-title">' + c.title + "</span></span>" +
            "</button>";
          }).join("") +
        "</div>" +
        '<div class="case-detail" id="face-detail"></div>' +
      "</div>" +

      '<div class="fsx-cols">' +

        '<div class="fsx-col fsx-ability">' +
          '<div class="fsx-title">' + U.icon("star", 16) + ' AI 替代不了的人类能力</div>' +
          '<div class="fsx-list">' +
            FACE_AI.irreplaceable.map(function (x) {
              return '<div class="fsx-chip">' +
                '<span class="fsc-ico">' + U.icon(x.icon, 15) + '</span>' +
                '<span class="fsc-txt"><b>' + x.t + '</b><i>' + x.d + '</i></span>' +
              '</div>';
            }).join("") +
          '</div>' +
        '</div>' +

        '<div class="fsx-col fsx-plan">' +
          '<div class="fsx-title">' + U.icon("target", 16) + ' 我们的应对策略</div>' +
          '<div class="fsx-list">' +
            FACE_AI.strategy.map(function (x) {
              return '<div class="fsx-chip">' +
                '<span class="fsc-ico">' + U.icon(x.icon, 15) + '</span>' +
                '<span class="fsc-txt"><b>' + x.t + '</b><i>' + x.d + '</i></span>' +
              '</div>';
            }).join("") +
          '</div>' +
        '</div>' +

      '</div>' +
      '<div class="tx-points">' +
        '<div class="tx-point">' + U.icon("target", 16) +
          '<div class="tx-point-txt"><b>核心观点：</b>不是 AI 取代人，而是会用 AI 的人取代不会用的人。</div>' +
        '</div>' +
        '<div class="tx-point">' + U.icon("gear", 16) +
          '<div class="tx-point-txt"><b>AI 是工具：</b>像火、电、互联网——放大能力，不替代本质。</div>' +
        '</div>' +
        '<div class="tx-point">' + U.icon("heart", 16) +
          '<div class="tx-point-txt"><b>竞争力：</b>用 AI 让自己变强——保持学习、好奇与人文关怀。</div>' +
        '</div>' +
      '</div>'
    );

    /* ===== L02 区域标题 ===== */
    html += '<div class="lesson-divider"><span class="ld-num">L02</span><span class="ld-title">身边的智能体</span><span class="ld-desc">AI 智能体已经在我们身边——6 大领域、推荐算法、信息茧房、能力边界</span></div>';

    /* ⑧ 6 大领域智能体案例（图标化重排：代表产品 → 胶囊标签） */
    html += LP.card("ori", "⑩ 6 大领域智能体案例：AI 已经无处不在！",
      "AI 智能体已经渗透到我们生活的方方面面。看看下面 6 大领域的智能体案例，你用过哪些？",
      '<div class="dcx-grid">' +
        DOMAIN_CASES.map(function (d) {
          return '<div class="dcx-card dc-' + d.color + '">' +
            '<div class="dcx-head">' +
              '<span class="dcx-ico">' + U.icon(d.icon, 20) + '</span>' +
              '<span class="dcx-name">' + d.title + '</span>' +
            '</div>' +
            '<div class="dcx-pills">' +
              d.products.split("、").map(function (p) { return '<span class="dcx-pill">' + p + '</span>'; }).join("") +
            '</div>' +
            '<div class="dcx-row"><span class="dcx-k">' + U.icon("spark", 13) + '例如</span><span class="dcx-v">' + d.example + '</span></div>' +
            '<div class="dcx-row"><span class="dcx-k">' + U.icon("gear", 13) + '能做什么</span><span class="dcx-v">' + d.ability + '</span></div>' +
          '</div>';
        }).join("") +
      '</div>' +
      '<div class="gold-box">🌍 <b>想一想：</b>这 6 大领域中，你接触最多的是哪个？你还能想到 AI 在其他领域的应用吗？（比如金融、交通、军事、环保……）AI 正在改变每一个行业！</div>',
      { id: "ori-domains" }
    );

    /* ⑪ AI 产品全景（图标头像 + 短句卡片） */
    html += LP.card("ori", "⑪ AI 产品全景：你身边的 AI 们——6 大类、20+ 款产品",
      "AI 产品已经无处不在！看看下面 6 大类 AI 产品，你用过哪些？",
      '<div class="pcx-list" id="ori-products">' +
        AI_PRODUCTS.map(function (cat) {
          return '<div class="pcx-cat pc-' + cat.color + '">' +
            '<div class="pcx-head">' +
              '<span class="pcx-ico">' + U.icon(cat.icon, 19) + '</span>' +
              '<span class="pcx-txt"><b>' + cat.category + '</b><span>' + cat.desc + '</span></span>' +
            '</div>' +
            '<div class="pcx-grid">' +
              cat.products.map(function (p) {
                return '<div class="pcx-card">' +
                  '<span class="pcx-ava">' + p.name.charAt(0) + '</span>' +
                  '<span class="pcx-info">' +
                    '<span class="pcx-line"><b>' + p.name + '</b><span class="pcx-co">' + p.company + '</span></span>' +
                    '<span class="pcx-feat">' + p.feature + '</span>' +
                  '</span>' +
                '</div>';
              }).join("") +
            '</div>' +
          '</div>';
        }).join("") +
      '</div>' +
      '<div class="tx-points">' +
        '<div class="tx-point">' + U.icon("search", 16) +
          '<div class="tx-point-txt"><b>想一想：</b>你最常用哪一类 AI 产品？还能想到哪些？</div>' +
        '</div>' +
        '<div class="tx-point">' + U.icon("target", 16) +
          '<div class="tx-point-txt"><b>趋势：</b>单模态 → 多模态，被动回答 → 主动做事，通用 → 垂直。</div>' +
        '</div>' +
        '<div class="tx-point">' + U.icon("star", 16) +
          '<div class="tx-point-txt"><b>国产崛起：</b>豆包、DeepSeek、Kimi、CodeBuddy 已达国际先进水平。</div>' +
        '</div>' +
      '</div>'
    );

    /* ⑫ AI 四代进化（统一紫色系：L1→L4 靠编号与图标区分，不靠颜色） */
    html += LP.card("ori", "⑫ 从聊天机器人到智能体：AI 的四代进化——能力是怎么一步步增强的？",
      "AI 不是一步到位的——从会说话到会做事，经历了<b>四代进化</b>。四张卡看懂：每一代强在哪、还差什么。",
      '<div class="evx-grid" id="ori-generations">' +
        AI_EVOLUTION.map(function (e, i) {
          return '<div class="evx-card evx-' + e.level.toLowerCase() + '" style="--i:' + i + '">' +
            '<div class="evx-head">' +
              '<span class="evx-level">' + e.level + '</span>' +
              '<span class="evx-ico">' + U.icon(e.icon, 19) + '</span>' +
            '</div>' +
            '<div class="evx-title">' + e.title + '</div>' +
            '<div class="evx-era">' + e.era + '</div>' +
            '<div class="evx-ability">' + e.ability + '</div>' +
            '<div class="evx-meta"><span class="evx-k">' + U.icon("star", 12) + '代表</span><span class="evx-v">' + e.examples.join('、') + '</span></div>' +
            '<div class="evx-meta"><span class="evx-k">' + U.icon("cog", 12) + '靠什么</span><span class="evx-v">' + e.tech + '</span></div>' +
            '<div class="evx-meta"><span class="evx-k">' + U.icon("alert", 12) + '还不会</span><span class="evx-v">' + e.limit + '</span></div>' +
          '</div>';
        }).join("") +
      '</div>' +
      '<div class="tx-points">' +
        '<div class="tx-point">' + U.icon("rocket", 16) +
          '<div class="tx-point-txt"><b>进化规律：</b>L1 会回答 → L2 会对话 → L3 会用工具 → L4 会自主做事。</div>' +
        '</div>' +
        '<div class="tx-point">' + U.icon("zap", 16) +
          '<div class="tx-point-txt"><b>突破来源：</b>L2 大语言模型 · L3 函数调用 · L4 四大组件协同。</div>' +
        '</div>' +
        '<div class="tx-point">' + U.icon("book", 16) +
          '<div class="tx-point-txt"><b>本课学 L4：</b>AI 智能体的内部架构，下节看四大组件如何协同。</div>' +
        '</div>' +
      '</div>'
    );

    /* ⑬ 身边的“隐形智能体”：推荐系统（L02 桥接卡：⑫ 四代进化 → ⑭ 能力圈）
     * 定位：用学生每天接触的推荐系统落“身边的智能体”（观察→猜你→推荐），
     *       再用它的坑（茧房/隐私）引出“智能体有边界”。
     * 视觉：§17 rs-* 图标卡——三步卡（语义色徽章）/ 两坑卡 / 三招卡，短句化。 */
    html += LP.card("ori", "⑬ 身边的“隐形智能体”：推荐系统——它怎么猜你？又有什么坑？",
      "刷视频停不下来、购物 APP 总猜中你想买什么——因为你身边有个<b>隐形智能体：推荐系统</b>。三步看懂它怎么猜你，再看它的两个坑。",
      /* 一区：它怎么猜你——三步卡 */
      '<div class="rs-sec" id="ori-rec"><span class="rs-sec-ico">' + U.icon("cog", 15) + '</span>它怎么猜你——三步</div>' +
      '<div class="rs-steps">' +
        REC_STEPS.map(function (s, i) {
          return '<div class="rs-step">' +
            '<div class="rs-ico">' + U.icon(s.icon, 22) + '</div>' +
            '<div class="rs-kicker">第 ' + (i + 1) + ' 步</div>' +
            '<div class="rs-name">' + s.name + '</div>' +
            '<div class="rs-text">' + s.text + '</div>' +
            '<div class="rs-tag">' + s.tag + '</div>' +
          '</div>';
        }).join("") +
      '</div>' +
      /* 二区：它的另一面——两坑卡 */
      '<div class="rs-sec"><span class="rs-sec-ico">' + U.icon("alert", 15) + '</span>它的另一面——两个坑</div>' +
      '<div class="rs-pits">' +
        REC_PITS.map(function (p) {
          return '<div class="rs-pit">' +
            '<div class="rs-pit-ico">' + U.icon(p.icon, 19) + '</div>' +
            '<div class="rs-pit-body">' +
              '<div class="rs-pit-title">' + p.title + '</div>' +
              '<div class="rs-pit-text">' + p.text + '</div>' +
            '</div>' +
          '</div>';
        }).join("") +
      '</div>' +
      /* 三区：做有意识的用户——三招卡 */
      '<div class="rs-sec"><span class="rs-sec-ico">' + U.icon("shield", 15) + '</span>做有意识的用户——3 件事</div>' +
      '<div class="rs-tips">' +
        REC_TIPS.map(function (t) {
          return '<div class="rs-tip">' + U.icon(t.icon, 16) + '<span>' + t.text + '</span></div>';
        }).join("") +
      '</div>' +
      '<div class="gold-box">⚖️ <b>记住：</b>技术没有好坏，关键在用的人。知道算法在做什么，你才不会被它牵着走！</div>'
    );

    /* ⑫ 智能体能力圈拼图游戏 */
    var ag = ABILITY_GAME[gameState.abilityIdx];
    html += LP.card("ori", "⑭ 游戏：智能体能力圈——它能做什么？不能做什么？",
      "能做什么、不能做什么——这就是<b>能力圈</b>。用下面的按钮切换 3 个智能体，想一想：它为什么做不到？",
      '<div class="ability-agent">' + U.icon("robot", 24) + ' <b>' + ag.agent + '</b></div>' +
      '<div class="ability-columns">' +
        '<div class="ability-col ac-can">' +
          '<div class="ac-title"><span class="ac-tbadge">' + U.icon("check", 14) + '</span>能做的</div>' +
          ag.can.map(function (c) { return '<div class="ac-item">' + U.icon("check", 13) + '<span>' + c + '</span></div>'; }).join("") +
        '</div>' +
        '<div class="ability-col ac-cannot">' +
          '<div class="ac-title"><span class="ac-tbadge">' + U.icon("xmark", 13) + '</span>不能做的</div>' +
          ag.cannot.map(function (c) { return '<div class="ac-item">' + U.icon("xmark", 13) + '<span>' + c + '</span></div>'; }).join("") +
        '</div>' +
      '</div>' +
      '<div class="ability-actions">' +
        '<button class="btn btn-ori btn-sm" id="ability-prev">← 上一个</button>' +
        '<span class="ability-hint">第 ' + (gameState.abilityIdx + 1) + ' / ' + ABILITY_GAME.length + ' 个智能体</span>' +
        '<button class="btn btn-ori btn-sm" id="ability-next">下一个 →</button>' +
      '</div>' +
      '<div class="tx-points">' +
        '<div class="tx-point">' + U.icon("search", 16) +
          '<div class="tx-point-txt"><b>想一想：</b>为什么它做不到？—— 观察不到 · 没有工具 · 没有意识。</div>' +
        '</div>' +
        '<div class="tx-point">' + U.icon("target", 16) +
          '<div class="tx-point-txt"><b>结论：</b>了解能力圈，让它做擅长的，别指望它做不到的。</div>' +
        '</div>' +
      '</div>'
    );

    /* ⑲ AI 有意识吗？会取代人类吗？ */
    html += LP.card("ori", "⑮ 终极思辨：AI 有意识吗？会取代人类吗？——科幻、预言与现实",
      AI_CONSCIOUSNESS.intro,
      '<div class="stage-tabs think-tabs" id="think-tabs">' +
        [[ "movie", "img", "电影里的 AI", AI_CONSCIOUSNESS.movies.length ],
          [ "pred", "chat", "名人的预言", AI_CONSCIOUSNESS.predictions.length ],
          [ "real", "brain", "科学现实", 3 ]].map(function (b, i) {
            return '<button class="stage-tab ttab-' + b[0] + (i === 0 ? " is-on" : "") + '" data-i="' + i + '">' +
              '<span class="stt-icon">' + U.icon(b[1], 16) + "</span>" +
              '<span class="stt-text"><span class="stt-name">' + b[2] + '</span><span class="stt-count">' + b[3] + " 条</span></span>" +
            "</button>";
          }).join("") +
      "</div>" +
      '<div class="stage-panel" id="think-panel"></div>' +
      '<div class="final-question">🤔 <b>留给你的思考：</b>' + AI_CONSCIOUSNESS.final_question + '</div>'
    );

    /* ⑭ 小测验 */
    html += LP.card("ori", "⑯ 小测验：你是 AI 起源小达人吗？",
      "综合 L01+L02 的内容，共 " + QUIZ.length + " 题，答对一题加一颗星！看看你能得几颗星？",
      '<div class="quiz-box" id="ori-quiz">' +
        '<div class="quiz-score">得分：<span class="score-badge" id="ori-quiz-score" data-score="0">★ 0</span> / ' + QUIZ.length + '</div>' +
        '<div id="ori-quiz-content"></div>' +
      '</div>'
    );

    /* ===== 课堂小结（与另外六页统一：核心结论 + 要点列表 + 课后思考） =====
     * 本轮改造前这里用的是另一套结构（.ls-title / .ls-content / .ls-item），
     * 只有 4 条陈述、没有"核心结论"也没有"课后思考"，教学闭环缺后半句。
     * 现在换成全站统一的 .lesson-summary.card-ori + .summary-core/-points/-think；
     * 加上 card-ori 之后，style.css 里那条 .lesson-summary.card-ori h3 也终于生效。 ===== */
    html += '<div class="lesson-summary card-ori">' +
      '<h3>' + U.icon("check", 18) + ' 课堂小结（L01+L02）</h3>' +
      '<div class="summary-core"><b>核心结论：</b>智能体能力 = <b>感知能力</b>（能获取什么信息）+ <b>行动能力</b>（能调用什么工具）+ <b>规划能力</b>（怎么决定做什么）。把 AI 的 70 多年串起来看，是一条很清楚的线：<b>能查会算</b>的专家系统 → <b>会看会听</b>的深度学习 → <b>会说话</b>的大模型 → 今天<b>会做事</b>的智能体。而真正的分水岭，不是"会不会说话"，是<b>有没有那四样零件、能不能自己把一件事做完</b>。</div>' +
      '<div class="summary-points">' +
        '<div class="sp-item"><span class="sp-icon">' + U.icon("clock", 14) + '</span><div><b>AI 的来路（L01）：</b>图灵测试（1950）→ 达特茅斯会议（1956）→ 专家系统 → AI 冬天 → 深度学习（2012）→ AlphaGo（2016）→ Transformer（2017）→ ChatGPT（2022）→ AI Agent（今天）。每一次爆发，都是<b>数据、算法、算力</b>三根支柱同时变强的结果——只强一根，AI 还是"笨"的。</div></div>' +
        '<div class="sp-item"><span class="sp-icon">' + U.icon("brain", 14) + '</span><div><b>大模型怎么"说话"：</b>文字先切成 <b>Token</b>、再转成<b>向量</b>；Transformer 的<b>自注意力</b>让每个词都"看一眼上下文"；最后靠<b>"预测下一个词"</b>一个词一个词往外蹦，循环出整段回答。它并不是"想好了再说"，而是"边说边猜"。</div></div>' +
        '<div class="sp-item"><span class="sp-icon">' + U.icon("robot", 14) + '</span><div><b>聊天机器人 vs 智能体：</b>前者"会说话"——你问它才答，只能用训练数据回答；后者"会做事"——能理解目标、制定计划、调用工具、记住偏好。差别就在有没有<b>感知器、规划器、记忆器、执行器</b>这四样零件。</div></div>' +
        '<div class="sp-item"><span class="sp-icon">' + U.icon("globe", 14) + '</span><div><b>身边的智能体（L02）：</b>教育 / 医疗 / 创作 / 科研 / 农业 / 服务 六大领域都已有落地。判断它"能干什么"看两样东西：<b>观察空间</b>（它看得到什么）+ <b>动作空间</b>（它能做什么）——两者合起来就是它的<b>能力边界</b>。</div></div>' +
        '<div class="sp-item"><span class="sp-icon">' + U.icon("users", 14) + '</span><div><b>推荐算法与信息茧房：</b>协同过滤的思路是"人以群分"——先找和你口味相近的人，再把他们喜欢的东西推给你。好用的代价是<b>越推越窄</b>：要主动去看不同观点，也要守住自己的隐私。</div></div>' +
        '<div class="sp-item"><span class="sp-icon">' + U.icon("spark", 14) + '</span><div><b>下一站：</b>L03《智能体总装图》——把上面这"四样零件"摊开看清楚，并学会用<b>"拆解四问"</b>把任何一个智能体拆开看。</div></div>' +
      '</div>' +
      '<div class="summary-think"><b>课后思考：</b>挑一件你最近真的用 AI 帮过忙的事（查资料、改作文、翻译、讲题都行），试着判断：这件事里<b>有感知器吗？有规划器吗？有记忆器吗？有执行器吗？</b>——只要少了哪一样，它就还只是个"会说话"的聊天机器人。下节课带来分享。</div>' +
    '</div>';

    sec.innerHTML = html;

    /* ---------- 绑定交互 ---------- */
    bindDay();
    bindHistory();
    bindPillars();
    bindFigSwitch();
    bindFigZoom();
    bindTxChips();
    bindLlmDemo();
    bindJobs();
    bindFace();
    bindThink();
    bindTuring();
    bindAbility();
    bindQuiz();
  }

  /* ---------- ③ 三大支柱：点击选择 + 详情面板 ---------- */
  function bindPillars() {
    var row = document.querySelector(".pillar-row");
    var panel = $("pillar-panel");
    var foot = $("pillar-foot");
    if (!row || !panel) return;
    var seen = {};

    function paint(i) {
      var p = AI_PILLARS[i];
      if (!p) return;
      row.querySelectorAll(".pillar-stop").forEach(function (b) {
        b.classList.toggle("is-on", parseInt(b.getAttribute("data-i"), 10) === i);
      });
      panel.innerHTML =
        '<div class="sp-top">' +
          '<span class="ps-mini pp-' + p.color + '">' + U.icon(p.icon, 17) + "</span>" +
          '<span class="sp-title">' + p.title + "</span>" +
          '<span class="sp-tag">' + p.analogy + "</span>" +
        "</div>" +
        '<div class="sp-desc">' + p.desc + "</div>" +
        '<div class="pp-list"><span class="pp-label">具体例子</span>' +
          p.examples.map(function (e) { return '<span class="pp-item">' + e + "</span>"; }).join("") +
        "</div>" +
        '<div class="pp-num">' + U.icon("percent", 15) + " <b>关键数字：</b>" + p.numbers + "</div>";
      panel.classList.remove("sp-in");
      void panel.offsetWidth;
      panel.classList.add("sp-in");
      seen[i] = 1;
      if (foot) {
        var n = Object.keys(seen).length;
        foot.innerHTML = n >= AI_PILLARS.length
          ? U.icon("happy", 15) + " 三大支柱都看过了！记住核心公式：<b>AI 的能力 = 数据 × 算法 × 算力</b>，缺一不可。"
          : U.icon("check", 15) + ' 已查看 <b>' + n + " / " + AI_PILLARS.length + "</b> 个支柱，继续点其它的 →";
      }
    }

    row.querySelectorAll(".pillar-stop").forEach(function (b) {
      b.addEventListener("click", function () { paint(parseInt(b.getAttribute("data-i"), 10)); });
    });
    paint(0);
  }

  /* ---------- ④ 大模型：架构图切换（中文重绘版 ⇄ 论文英文原图） ---------- */
  function bindFigSwitch() {
    var box = $("ta-fig-switch");
    var img = $("ta-fig-img");
    var note = $("ta-fig-src");
    if (!box || !img) return;
    /* 两张图都按“左图右讲”的同一位置展示：中文重绘版为教学用图（带 Q/K/V 标注），
     * 英文原图为论文 Figure 1 原图，用于对照原始出处。 */
    var FIGS = {
      cn: {
        src: "images/transformer-architecture.svg",
        alt: "Transformer 经典架构图（按论文结构中文重绘）",
        note: '📐 本教学系统重绘 · 结构依据 Vaswani et al., "Attention Is All You Need", NeurIPS 2017'
      },
      en: {
        src: "images/transformer-architecture-original.png",
        alt: "Transformer 论文原图（Attention Is All You Need, NeurIPS 2017）",
        note: '📷 论文英文原图：Vaswani et al., "Attention Is All You Need", NeurIPS 2017'
      }
    };
    box.querySelectorAll(".ta-fig-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        var f = FIGS[b.getAttribute("data-fig")];
        if (!f) return;
        box.querySelectorAll(".ta-fig-btn").forEach(function (x) { x.classList.toggle("is-on", x === b); });
        img.setAttribute("src", f.src);
        img.setAttribute("alt", f.alt);
        if (note) note.textContent = f.note;
      });
    });
  }

  /* ---------- ④ 大模型：架构图点击放大到全屏 ---------- */
  /* 浮层挂在 body 上、只创建一次（栏目重复渲染时不重复插入）；
   * 点图打开，点浮层任意处或按 Esc 关闭；切到哪一版（中文重绘/英文原图）就放大哪一版。 */
  function bindFigZoom() {
    var img = $("ta-fig-img");
    if (!img) return;

    var box = document.querySelector(".fig-zoom");
    if (!box) {
      box = document.createElement("div");
      box.className = "fig-zoom";
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      box.setAttribute("aria-label", "架构图全屏查看");
      box.innerHTML = '<img alt=""><button type="button" class="fig-zoom-close" aria-label="关闭（Esc）">&#215;</button>';
      box.hidden = true;
      document.body.appendChild(box);
      box.addEventListener("click", closeZoom);
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !box.hidden) closeZoom();
      });
    }
    var zimg = box.querySelector("img");

    function closeZoom() {
      box.hidden = true;
      document.body.classList.remove("is-zoomed");
    }
    /* 每次都从当前展示的图取 src：切换“中文重绘版 / 英文原图”后放大的是当前那版 */
    function openZoom() {
      var cur = $("ta-fig-img") || img;
      zimg.setAttribute("src", cur.getAttribute("src"));
      zimg.setAttribute("alt", cur.getAttribute("alt") || "Transformer 架构图");
      box.hidden = false;
      document.body.classList.add("is-zoomed");
    }
    img.addEventListener("click", openZoom);
  }

  /* ---------- ④ 大模型：架构图解读条（点一条展开详细解释） ---------- */
  /* 交互与感知器实验室的 ASR / OCR 解读条一致：默认只显示“术语 + 一句话”，
   * 点一下展开“一句话概括 → 大白话解释 → 打个比方”的详解。 */
  function bindTxChips() {
    var box = $("ori-tf-chips");
    if (!box) return;
    box.querySelectorAll(".tx-chip-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.parentNode;
        var open = item.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }

  /* ---------- ④ 大模型：生成过程演示（单步播放） ---------- */
  function bindLlmDemo() {
    var host = $("llm-pipeline");
    if (!host || !AgentLab.Adv) return;
    var d = {
      title: "跟着走一遍：输入「今天天气很」，AI 怎么一步步生成「今天天气很好」",
      hint: "点下一步", icon: "spark", color: "per",
      playLabel: "自动播放", stepLabel: "下一步", resetLabel: "重来", logTitle: "这一步发生了什么",
      stages: [
        { id: "input", name: "输入", icon: "pen", en: "Prompt", io: "你打出：“今天天气很”" },
        { id: "token", name: "分词", icon: "txt", en: "Tokenize", io: "切成 3 个 token：今天 / 天气 / 很" },
        { id: "vector", name: "向量化", icon: "database", en: "Embedding", io: "每个 token 变成一串数字（向量），AI 才能计算" },
        { id: "attention", name: "注意力处理", icon: "brain", en: "Transformer", io: "注意力机制理解“今天”和“天气”的关联，判断“很”后面该接形容词" },
        { id: "predict", name: "第 1 次预测", icon: "percent", en: "Predict", io: "预测下一个词：“好”(45%) ＞ “热”(25%) ＞ “冷”(1%)" },
        { id: "loop", name: "循环生成", icon: "refresh", en: "Loop", io: "把“好”加进去继续预测，直到出现结束符 EOS（92%）→ 停止" },
        { id: "output", name: "输出", icon: "check", en: "Output", io: "AI 回答：“今天天气很好”——整个过程几毫秒内完成" }
      ]
    };
    host.innerHTML = AgentLab.Adv.types.pipeline.demoHTML(d);
    AgentLab.Adv.types.pipeline.bind(host, d);
  }

  /* ---------- ⑦ 职业演变：四阶段切换 ---------- */
  function bindJobs() {
    var tabs = $("jobs-tabs");
    var panel = $("jobs-panel");
    if (!tabs || !panel) return;

    /* 统一的紧凑子卡片：图标 + 名称同一行，下方是说明，卡片底部放标签 */
    function jobCard(opt) {
      var inner =
        '<div class="jc-head">' +
          '<div class="job-icon ' + opt.iconCls + '">' + U.icon(opt.icon, 17) + '</div>' +
          '<div class="job-title">' + opt.title + '</div>' +
          (opt.headTag ? '<span class="job-tag ' + opt.headTag + '">' + opt.headTagText + '</span>' : '') +
        '</div>' +
        '<div class="job-desc">' + opt.desc + '</div>' +
        (opt.advice ? '<div class="job-advice">' + U.icon("graduation", 14) + "<span>" + opt.advice + "</span></div>" : "") +
        (opt.foot ? '<div class="' + opt.footCls + '">' + opt.foot + "</div>" : "");
      return '<div class="job-card ' + opt.cardCls + '">' + inner + "</div>";
    }

    function cardsOf(key) {
      return JOBS_DATA[key].map(function (j) {
        if (key === "disappeared") {
          return jobCard({
            cardCls: "job-card-gone", iconCls: "job-icon-gone", icon: j.icon || "clock",
            title: j.name, desc: j.reason,
            footCls: "job-tag job-tag-gone", foot: "📅 消失于 " + j.era
          });
        }
        if (key === "disappearing") {
          return jobCard({
            cardCls: "job-card-going", iconCls: "job-icon-going", icon: j.icon || "alert",
            title: j.name, desc: j.reason,
            headTag: "job-tag job-tag-risk job-tag-risk-" + j.risk, headTagText: j.risk + "风险",
            advice: j.advice
          });
        }
        if (key === "emerging") {
          return jobCard({
            cardCls: "job-card-new", iconCls: "job-icon-new", icon: j.icon,
            title: j.title, desc: j.desc,
            footCls: "job-salary", foot: "💰 " + j.salary
          });
        }
        return jobCard({
          cardCls: "job-card-future", iconCls: "job-icon-future", icon: j.icon || "rocket",
          title: j.name, desc: j.desc,
          footCls: "job-tag job-tag-future", foot: "🚀 未来职业"
        });
      }).join("");
    }

    function paint(i) {
      var st = JOBS_STAGES[i];
      tabs.querySelectorAll(".stage-tab").forEach(function (b, k) { b.classList.toggle("is-on", k === i); });
      panel.innerHTML =
        '<div class="jobs-block jobs-block-' + st.color + '">' +
          '<div class="jb-head"><span class="jb-icon jb-icon-' + st.color + '">' + U.icon(st.icon, 16) + '</span><span class="jb-title">' + st.head + '</span></div>' +
          '<div class="jb-desc">' + st.desc + "</div>" +
          '<div class="job-grid">' + cardsOf(st.key) + "</div>" +
        "</div>";
      panel.classList.remove("sp-in");
      void panel.offsetWidth;
      panel.classList.add("sp-in");
    }

    tabs.querySelectorAll(".stage-tab").forEach(function (b, i) {
      b.addEventListener("click", function () { paint(i); });
    });
    paint(0);
  }

  /* ---------- ⑨ 深度思考：精简版案例手风琴（点谁看谁，大字号） ---------- */
  function bindFace() {
    var acc = document.querySelector(".case-acc");
    if (!acc) return;

    function paint(i) {
      var c = FACE_AI.cases[i];
      if (!c) return;
      acc.querySelectorAll(".case-chip").forEach(function (b) {
        b.classList.toggle("is-on", parseInt(b.getAttribute("data-i"), 10) === i);
      });
      var box = $("face-detail");
      if (!box) return;
      box.innerHTML =
        '<div class="cd-row cd-good"><span class="cd-label">' + U.icon("check", 14) + " 它能做什么</span><p>" + c.desc + "</p></div>" +
        '<div class="cd-row cd-worry"><span class="cd-label">' + U.icon("alert", 14) + " 让人担心的是</span><p>" + c.dilemma + "</p></div>" +
        (c.reply ? '<div class="cd-row cd-reply"><span class="cd-label">' + U.icon("happy", 14) + " 再想一层</span><p>" + c.reply + "</p></div>" : "") +
        '<div class="cd-row cd-think"><span class="cd-label">' + U.icon("pen", 14) + " 想一想</span><p>" + c.think + "</p></div>";
      box.classList.remove("sp-in");
      void box.offsetWidth;
      box.classList.add("sp-in");
    }

    acc.querySelectorAll(".case-chip").forEach(function (b) {
      b.addEventListener("click", function () {
        paint(parseInt(b.getAttribute("data-i"), 10));
      });
    });
    paint(0);
  }

  /* ---------- ⑮ 终极思辨：三块切换 ---------- */
  function bindThink() {
    var tabs = $("think-tabs");
    var panel = $("think-panel");
    if (!tabs || !panel) return;

    function moviesHTML() {
      return '<div class="cs-subtitle">🎬 科幻电影中的 AI——人类对 AI 的想象和恐惧</div><div class="movie-grid">' +
        AI_CONSCIOUSNESS.movies.map(function (m) {
          return '<div class="movie-card"><div class="mc-head">' + U.icon(m.icon, 16) + " <b>" + m.name + '</b><span class="mc-year">' + m.year + '</span></div><div class="mc-plot">' + m.plot + '</div><div class="mc-lesson">💡 ' + m.lesson + "</div></div>";
        }).join("") + "</div>";
    }
    function predsHTML() {
      return '<div class="cs-subtitle">🗣️ 名人预言——他们怎么看 AI 的未来？</div><div class="prediction-list">' +
        AI_CONSCIOUSNESS.predictions.map(function (p) {
          return '<div class="pred-card"><div class="pc-person"><b>' + p.person + '</b><span class="pc-role">' + p.role + '</span></div><div class="pc-quote">「' + p.quote + '」</div><div class="pc-stance">立场：' + p.stance + "</div></div>";
        }).join("") + "</div>";
    }
    function realityHTML() {
      return '<div class="cs-subtitle">🔬 科学现实——基于当前技术的理性分析</div><div class="reality-grid">' +
        [[ "AI 有意识吗？", AI_CONSCIOUSNESS.reality.has_consciousness ],
          [ "AI 会取代人类吗？", AI_CONSCIOUSNESS.reality.will_replace ],
          [ "我们该担心什么？", AI_CONSCIOUSNESS.reality.should_worry ]].map(function (r) {
            return '<div class="reality-card"><div class="rc-q">' + r[0] + '</div><div class="rc-a"><b>' + r[1].answer + '</b></div><div class="rc-detail">' + r[1].detail + "</div></div>";
          }).join("") + "</div>";
    }

    var blocks = [moviesHTML, predsHTML, realityHTML];
    function paint(i) {
      tabs.querySelectorAll(".stage-tab").forEach(function (b, k) { b.classList.toggle("is-on", k === i); });
      panel.innerHTML = blocks[i]();
      panel.classList.remove("sp-in");
      void panel.offsetWidth;
      panel.classList.add("sp-in");
    }
    tabs.querySelectorAll(".stage-tab").forEach(function (b, i) {
      b.addEventListener("click", function () { paint(i); });
    });
    paint(0);
  }

  /* ---------- ① 小明的一天：一日时间轴交互 ---------- */
  function bindDay() {
    var track = document.querySelector(".dayrail-track");
    var panel = $("day-panel");
    var foot = $("day-foot");
    if (!track || !panel) return;
    var seen = {};

    function paint(i) {
      var d = DAY_AI[i];
      if (!d) return;
      track.querySelectorAll(".daystop").forEach(function (b) {
        b.classList.toggle("is-on", parseInt(b.getAttribute("data-i"), 10) === i);
      });
      panel.innerHTML =
        '<div class="sp-top">' +
          '<span class="sp-time">' + d.time + "</span>" +
          '<span class="sp-title">' + d.title + "</span>" +
          '<span class="sp-tag">' + d.tag + "</span>" +
        "</div>" +
        '<div class="sp-desc">' + d.desc + "</div>";
      panel.classList.remove("sp-in");
      void panel.offsetWidth;
      panel.classList.add("sp-in");
      seen[i] = 1;
      if (foot) {
        var n = Object.keys(seen).length;
        foot.innerHTML = n >= DAY_AI.length
          ? U.icon("happy", 15) + " " + DAY_AI.length + " 个场景都看过了！它们的共同点是：<b>都在根据你的数据，替你猜、替你选</b>——这就是推荐类 AI。"
          : U.icon("check", 15) + ' 已查看 <b>' + n + " / " + DAY_AI.length + "</b> 个场景，继续点其它时间点 →";
      }
    }

    track.querySelectorAll(".daystop").forEach(function (b) {
      b.addEventListener("click", function () { paint(parseInt(b.getAttribute("data-i"), 10)); });
    });
    paint(0);
  }

  /* ---------- ② AI 发展史：四幕时间轴交互（点击展开，不依赖 hover） ---------- */
  function bindHistory() {
    var stack = document.querySelector(".era-stack");
    if (!stack) return;
    var open = null;

    function closeAll() {
      stack.querySelectorAll(".mile").forEach(function (b) { b.classList.remove("is-on"); });
      stack.querySelectorAll(".era-detail").forEach(function (d) {
        d.classList.remove("is-open");
        d.innerHTML = "";
      });
      open = null;
    }

    stack.querySelectorAll(".mile").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = parseInt(b.getAttribute("data-i"), 10);
        var h = AI_HISTORY[i];
        if (!h) return;
        if (open === i) { closeAll(); return; }
        closeAll();
        var box = stack.querySelector("#era-detail-" + b.getAttribute("data-era"));
        if (!box) return;
        box.innerHTML =
          '<div class="ed-inner">' +
            '<div class="ed-head">' + U.icon(h.icon, 17) + " <b>" + h.year + "　" + h.title + "</b>" +
              '<span class="ed-key">' + h.key + "</span>" +
            "</div>" +
            '<div class="ed-desc">' + h.desc + "</div>" +
          "</div>";
        box.classList.add("is-open");
        b.classList.add("is-on");
        open = i;
      });
    });

    /* 默认展开第一张卡片：一进来就有内容，也提示"卡片可以点" */
    var first = stack.querySelector(".mile");
    if (first) first.click();
  }

  /* ---------- 图灵测试体验站交互（重新设计版） ---------- */
  function bindTuring() {
    // 选择 A 或 B 是 AI
    document.querySelectorAll(".ts-guess").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (gameState.turingAnswered) return;
        var choice = btn.getAttribute("data-choice");
        var round = TURING_DATA.rounds[gameState.turingIdx];
        var swap = (gameState.turingIdx % 2 === 1);
        var aIsAi = swap;
        var correct = (choice === "A" && aIsAi) || (choice === "B" && !aIsAi);
        gameState.turingAnswered = true;
        gameState.turingUserChoice = choice;
        if (correct) gameState.turingScore++;
        render();
      });
    });
    // 下一轮 / 查看总结
    var nextBtn = $("turing-next");
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        if (gameState.turingIdx < TURING_DATA.rounds.length - 1) {
          gameState.turingIdx++;
          gameState.turingAnswered = false;
          gameState.turingUserChoice = null;
        } else {
          gameState.turingFinished = true;
        }
        render();
      });
    }
    // 重新挑战
    var restartBtn = $("turing-restart");
    if (restartBtn) {
      restartBtn.addEventListener("click", function () {
        gameState.turingIdx = 0;
        gameState.turingScore = 0;
        gameState.turingAnswered = false;
        gameState.turingUserChoice = null;
        gameState.turingFinished = false;
        render();
      });
    }
  }

  /* ---------- 能力圈切换 ---------- */
  function bindAbility() {
    var prev = $("ability-prev");
    var next = $("ability-next");
    if (prev) prev.addEventListener("click", function () {
      gameState.abilityIdx = (gameState.abilityIdx - 1 + ABILITY_GAME.length) % ABILITY_GAME.length;
      render();
    });
    if (next) next.addEventListener("click", function () {
      gameState.abilityIdx = (gameState.abilityIdx + 1) % ABILITY_GAME.length;
      render();
    });
  }

  /* ---------- 小测验 ---------- */
  /* ---------- ⑯ 小测验（单题闯关） ---------- */
  function bindQuiz() {
    AgentLab.Quiz.mount({
      host: "ori-quiz-content",
      color: "ori",
      name: "AI 起源小达人",
      star: "ori-quiz-score",
      questions: QUIZ,
      hint: "再想想——可以回到上面的时间轴、案例和“会说话 vs 会做事”对比里找线索。"
    });
  }

  return {
    render: render
  };
})();
