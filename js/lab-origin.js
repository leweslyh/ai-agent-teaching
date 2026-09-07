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
    { time: "07:00", icon: "alarm", title: "智能闹钟", desc: "根据你的睡眠周期，在浅睡眠时轻轻叫醒你" },
    { time: "07:30", icon: "search", title: "导航推荐", desc: "上学路上，地图 AI 实时规划最快路线，避开拥堵" },
    { time: "08:30", icon: "book", title: "个性化学习", desc: "课堂上，AI 学习系统根据你的薄弱点推荐练习题" },
    { time: "12:00", icon: "utensils", title: "外卖推荐", desc: "午饭时，外卖 APP 根据你的口味推荐餐厅" },
    { time: "16:00", icon: "music", title: "音乐推荐", desc: "放学路上，音乐 APP 根据你的喜好推荐新歌" },
    { time: "20:00", icon: "tv", title: "视频推荐", desc: "晚上，视频网站根据你的观看历史推荐好看的节目" }
  ];

  // AI 发展史 13 节点（重点扩充 2016-2026 近十年）
  var AI_HISTORY = [
    { year: "1950", title: "图灵测试", icon: "brain", desc: "阿兰·图灵提出图灵测试——如果人类无法分辨对话的是机器还是人，就可以认为机器有智能。这是 AI 的思想起点。", key: "AI 之父：阿兰·图灵" },
    { year: "1956", title: "达特茅斯会议", icon: "flag", desc: "在美国达特茅斯学院，约翰·麦卡锡等科学家正式提出人工智能（Artificial Intelligence）这个词。AI 作为一门学科正式诞生！", key: "AI 这个词诞生了" },
    { year: "1960s-70s", title: "专家系统", icon: "gear", desc: "科学家们把人类专家的知识写成规则，让计算机像专家一样解决问题。比如医学诊断系统 MYCIN，能像医生一样诊断细菌感染。但专家系统只能解决特定领域的问题，不够灵活。", key: "第一次热潮：规则驱动" },
    { year: "1980s-90s", title: "AI 冬天", icon: "snow", desc: "人们发现 AI 没有想象中那么厉害，投资减少，研究进入低谷。这就是AI 冬天。但科学家们没有放弃，一直在默默积累。", key: "低谷期：希望与失望交织" },
    { year: "2012", title: "深度学习突破", icon: "chart", desc: "AlexNet 在图像识别比赛中大幅领先，深度学习（Deep Learning）开始爆发。计算机能看懂图片了！背后是神经网络+大数据+强大算力的结合。", key: "第二次热潮：数据驱动" },
    { year: "2016", title: "AlphaGo 战胜李世石", icon: "trophy", desc: "谷歌 DeepMind 的 AlphaGo 以 4:1 战胜围棋世界冠军李世石。围棋被认为是人类最复杂的棋类游戏，AI 的胜利震惊了世界！人们开始意识到：AI 真的很强。这一年也被称为 AI 觉醒元年。", key: "AI 超越人类的里程碑" },
    { year: "2017", title: "Transformer 架构诞生", icon: "network", desc: "谷歌发表论文《Attention is All You Need》，提出 Transformer 架构——通过注意力机制让 AI 能理解上下文关系。这是当前所有大模型（GPT、豆包、DeepSeek）的基础！没有 Transformer，就没有今天的 AI 革命。", key: "大模型的基石：注意力机制" },
    { year: "2020", title: "GPT-3 发布", icon: "rocket", desc: "OpenAI 发布 GPT-3，参数量达 1750 亿——是当时最大的语言模型！人们发现 AI 能写文章、写代码、翻译、做数学题……能力惊人。但 GPT-3 还只是实验室产品，普通人用不上。", key: "大模型能力爆发：1750 亿参数" },
    { year: "2021", title: "多模态突破：DALL-E + CLIP", icon: "image", desc: "OpenAI 发布 DALL-E（文字生成图片）和 CLIP（图文理解），AI 开始能同时理解文字和图片——多模态时代开启！AI 不再只能处理文字，还能看懂图、画出图。", key: "AI 长出了眼睛" },
    { year: "2022", title: "ChatGPT 发布", icon: "chat", desc: "OpenAI 发布 ChatGPT，大语言模型（LLM）进入大众视野。人们发现 AI 能聊天、能写文章、能写代码、能翻译……AI 从实验室走进了普通人的生活。上线 2 个月用户破 1 亿，是史上增长最快的消费级应用！", key: "大模型时代到来：人人都能用 AI" },
    { year: "2023", title: "GPT-4 + AI Agent 概念爆发", icon: "robot", desc: "GPT-4 发布，支持多模态（看图+文字），推理能力大幅提升。同时，AI Agent（智能体）概念爆发——AutoGPT、BabyAGI 等项目展示了 AI 自主完成复杂任务的潜力。从会说话到会做事，AI 的能力边界在快速扩展。", key: "从聊天机器人到智能体" },
    { year: "2024", title: "Sora + DeepSeek + AI 编程普及", icon: "video", desc: "OpenAI 发布 Sora（文字生成 60 秒视频），AI 视频生成震惊世界！国产 DeepSeek 开源大模型崛起，推理能力达到国际先进水平且完全免费。CodeBuddy、Cursor、GitHub Copilot 等 AI 编程助手普及，程序员开始和 AI 结对编程。", key: "AI 视频元年 + 国产 AI 崛起" },
    { year: "2025-2026", title: "AI 智能体普及 + 人机协作常态", icon: "star", desc: "AI 智能体开始大规模应用——能自主规划、调用工具、完成复杂任务。多模态大模型成熟（文字+图片+语音+视频）。AI 成为各行各业的基础设施：教育、医疗、科研、创作、办公……人机协作成为新常态。这就是我们现在所处的时代！", key: "AI 成为基础设施：人机协作时代" }
  ];

  // 图灵测试体验站：多场景判断 + AI特征总结 + 中文房间思辨
  var TURING_DATA = {
    intro: "1950 年，计算机科学之父阿兰·图灵提出了一个著名的测试——「模仿游戏」（后来被称为图灵测试）：如果你通过文字和两个对象聊天，一个是人类，一个是 AI，你能分辨出哪个是 AI 吗？如果分辨不出来，就可以认为 AI 具有智能。现在，你来当裁判！",
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
    // 第二阶段：正在被 AI 淘汰的职业
    disappearing: [
      { icon: "lang", name: "基础翻译", risk: "高", reason: "AI 翻译（DeepL、谷歌翻译）已达到专业水平，简单文档翻译被取代" },
      { icon: "database", name: "数据录入员", risk: "高", reason: "OCR 文字识别和 RPA 自动化工具能快速录入和处理数据" },
      { icon: "headset", name: "简单客服", risk: "高", reason: "AI 客服能处理 80% 的常见问题，24 小时不间断服务" },
      { icon: "calc", name: "初级会计/出纳", risk: "中高", reason: "AI 能自动记账、对账、生成报表，基础财务工作被自动化" },
      { icon: "factory", name: "流水线工人", risk: "高", reason: "工业机器人和自动化生产线取代重复性体力劳动" },
      { icon: "pen", name: "基础文案撰写", risk: "中高", reason: "AI 能快速生成营销文案、新闻稿、产品描述" },
      { icon: "phone", name: "电话销售", risk: "高", reason: "AI 语音机器人能自动外呼、筛选客户、完成简单销售" },
      { icon: "box", name: "快递分拣员", risk: "高", reason: "自动化分拣系统和物流机器人能快速分拣包裹，效率远超人工" }
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

  // 推荐算法：协同过滤互动
  var REC_DATA = {
    users: ["小明", "小红", "小刚"],
    items: ["《星际穿越》", "《流浪地球》", "《泰坦尼克号》", "《复仇者联盟》", "《情书》"],
    ratings: {
      "小明": { "《星际穿越》": 5, "《流浪地球》": 5, "《泰坦尼克号》": 2, "《复仇者联盟》": 4, "《情书》": 1 },
      "小红": { "《星际穿越》": 4, "《流浪地球》": 5, "《泰坦尼克号》": 3, "《复仇者联盟》": 3, "《情书》": 2 },
      "小刚": { "《星际穿越》": 1, "《流浪地球》": 2, "《泰坦尼克号》": 5, "《复仇者联盟》": 1, "《情书》": 5 }
    },
    target: "小明",
    recommend: "《三体》（科幻片，和小明喜欢的《星际穿越》《流浪地球》类似）"
  };

  // 信息茧房案例
  var COCOON_CASES = [
    { title: "只看喜欢的", desc: "如果你只喜欢看搞笑视频，算法就一直给你推搞笑视频，你越来越少看到新闻、知识、不同观点——你的世界越来越小。" },
    { title: "越来越极端", desc: "如果你只看某一种观点的内容，算法就一直推类似观点，你可能变得越来越极端，听不进不同意见。" },
    { title: "隐私泄露", desc: "算法要推荐内容，就得收集你的数据——你看了什么、搜了什么、买了什么、在哪停留了多久。这些数据如果被滥用，就会侵犯隐私。" }
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
      icon: "chip", title: "算力（Compute）", color: "exe",
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
    { num: 3, icon: "cube", title: "嵌入（Embedding）", key_term: "Vector", stage: "understand",
      desc: "每个 token 转成数字向量（几千维度），表示词的含义；意思相近的词，向量距离也近。",
      example: '"天气" → [0.23, -0.15, 0.67, ...]（几千个数字，像含义坐标图）',
      analogy: "就像给每个词发一张身份证，写着它的含义坐标" },
    { num: 4, icon: "network", title: "Transformer 神经网络", key_term: "Attention", stage: "generate",
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

  // AI 产品全景：按类型分类
  var AI_PRODUCTS = [
    {
      category: "对话助手", icon: "chat", color: "per",
      desc: "能聊天、回答问题、写文章、翻译——最常见的 AI 产品类型",
      products: [
        { name: "豆包", company: "字节跳动", feature: "国内用户最多的 AI 助手之一，支持文字、图片、语音，能联网搜索" },
        { name: "DeepSeek", company: "深度求索", feature: "国产开源大模型代表，推理能力强，代码能力突出，完全免费" },
        { name: "文心一言", company: "百度", feature: "百度推出的知识增强大模型，擅长中文理解和知识问答" },
        { name: "通义千问", company: "阿里巴巴", feature: "阿里推出的大模型，集成在淘宝、钉钉等产品中" },
        { name: "Kimi", company: "月之暗面", feature: "支持超长上下文（200 万字），擅长处理长文档和论文" },
        { name: "智谱清言", company: "智谱 AI", feature: "清华团队背景，支持代码、数据分析、多模态理解" }
      ]
    },
    {
      category: "代码助手", icon: "code", color: "plan",
      desc: "帮程序员写代码、查 bug、解释代码——AI 时代的编程搭档",
      products: [
        { name: "CodeBuddy", company: "腾讯", feature: "腾讯推出的 AI 编程助手，支持代码生成、补全、解释、调试，集成在 VS Code 中" },
        { name: "Cursor", company: "Anysphere", feature: "AI 原生代码编辑器，能理解整个项目，自动修改多个文件" },
        { name: "GitHub Copilot", company: "微软/GitHub", feature: "最流行的 AI 代码补全工具，在你打字时实时提示代码" },
        { name: "Trae", company: "字节跳动", feature: "国产 AI IDE，支持 Agent 模式自动完成编程任务" }
      ]
    },
    {
      category: "图像生成", icon: "image", color: "mem",
      desc: "根据文字描述生成图片——人人都是艺术家",
      products: [
        { name: "即梦 AI", company: "字节跳动", feature: "国内领先的 AI 绘画工具，支持文生图、图生图，风格丰富" },
        { name: "Midjourney", company: "Midjourney", feature: "全球最流行的 AI 绘画工具，艺术感强，出图质量高" },
        { name: "Stable Diffusion", company: "Stability AI", feature: "开源免费的 AI 绘画模型，可以本地部署，自由度极高" },
        { name: "通义万相", company: "阿里巴巴", feature: "阿里推出的 AI 绘画工具，支持中文提示词，出图快" }
      ]
    },
    {
      category: "视频生成", icon: "video", color: "exe",
      desc: "根据文字或图片生成视频——AI 电影时代即将到来",
      products: [
        { name: "可灵 AI", company: "快手", feature: "国产 AI 视频生成工具，支持文生视频、图生视频，质量接近国际水平" },
        { name: "Sora", company: "OpenAI", feature: "OpenAI 推出的视频生成模型，能生成 60 秒高质量视频，震惊世界" },
        { name: "Runway", company: "Runway", feature: "专业 AI 视频编辑工具，支持文字生成视频、视频风格转换" },
        { name: "Vidu", company: "生数科技", feature: "国产 AI 视频生成工具，支持长视频和角色一致性" }
      ]
    },
    {
      category: "语音助手", icon: "mic", color: "brain",
      desc: "能听懂你说话、能开口说话的 AI——语音交互时代",
      products: [
        { name: "小爱同学", company: "小米", feature: "小米智能音箱和手机的语音助手，能控制智能家居、查信息、设提醒" },
        { name: "天猫精灵", company: "阿里巴巴", feature: "阿里智能音箱，支持购物、听歌、控制家电、儿童教育" },
        { name: "小度", company: "百度", feature: "百度智能音箱，擅长知识问答和儿童教育，屏幕版能看视频" },
        { name: "Siri", company: "苹果", feature: "苹果设备的语音助手，能打电话、发短信、设提醒、查天气" }
      ]
    },
    {
      category: "办公助手", icon: "briefcase", color: "ori",
      desc: "帮你写 PPT、做表格、整理文档——AI 时代的办公搭档",
      products: [
        { name: "WPS AI", company: "金山办公", feature: "集成在 WPS 中的 AI 助手，能写文档、做 PPT、分析表格、PDF 问答" },
        { name: "飞书智能伙伴", company: "字节跳动", feature: "飞书中的 AI 助手，能总结会议、写文档、分析数据、自动化流程" },
        { name: "钉钉 AI", company: "阿里巴巴", feature: "钉钉中的 AI 助手，支持 AI 写文档、AI 做 PPT、AI 助理" },
        { name: "Microsoft Copilot", company: "微软", feature: "集成在 Office 365 中的 AI 助手，能写 Word、做 Excel、生成 PPT" }
      ]
    }
  ];

  // AI 四代进化：从聊天机器人到智能体
  var AI_EVOLUTION = [
    {
      level: "L1", title: "单轮问答", era: "2010s 早期", icon: "message",
      ability: "你问一句，它答一句。每次对话都是独立的——它不记得你上一句说了什么。",
      examples: ["早期的 Siri、小度", "客服自动回复", "搜索引擎的直接答案"],
      tech: "基于规则和简单的自然语言处理（NLP），没有真正的理解能力",
      limit: "不能多轮对话、不能理解上下文、不能调用工具、只能回答训练数据里有的问题"
    },
    {
      level: "L2", title: "多轮对话", era: "2020-2022", icon: "chat",
      ability: "能记住上下文，进行多轮对话。你可以追问、补充、纠正——它能理解你在说什么。",
      examples: ["ChatGPT（早期版本）", "文心一言", "豆包（基础版）"],
      tech: "大语言模型（LLM）+ Transformer 架构，通过注意力机制理解上下文",
      limit: "仍然只能用训练数据回答、不能调用外部工具、不能主动做事、可能幻觉（编造信息）"
    },
    {
      level: "L3", title: "工具调用", era: "2023-2024", icon: "wrench",
      ability: "不仅能聊天，还能调用外部工具！搜索网页、查天气、算数学、翻译、设提醒、读文件……AI 开始能做事了。",
      examples: ["ChatGPT with Plugins", "豆包（联网版）", "Kimi（长文档）", "本教学系统的智能体小管家"],
      tech: "Function Calling（函数调用）+ ReAct 模式（推理+行动交替），AI 学会判断什么时候该用什么工具",
      limit: "通常一次只能调用一个工具、需要人来指挥下一步、不能自主完成复杂的多步骤任务"
    },
    {
      level: "L4", title: "自主智能体", era: "2024-至今", icon: "robot",
      ability: "能理解目标、自己制定计划、分步执行、调用多个工具、记住偏好、遇到问题自己调整——不需要人一步步指挥，AI 能自主完成复杂任务！",
      examples: ["AutoGPT", "Devin（AI 软件工程师）", "Cursor Agent 模式", "CodeBuddy Agent", "本课程要学的智能体架构"],
      tech: "规划器（Planner）+ 记忆器（Memory）+ 执行器（Executor）+ 感知器（Perception）四大组件协同工作——这就是 ai-agent-book 的核心架构！",
      limit: "仍然可能出错、需要人监督、成本较高、但能力正在快速提升——这是 AI 的未来！"
    }
  ];

  // 人类该如何面对 AI：真实案例与深度思考
  var FACE_AI = {
    intro: "AI 似乎越来越无所不能——能下棋、能写文章、能画画、能编程、能做数学题、能看片子诊断疾病……当 AI 越来越强，我们作为人类该如何面对？看看下面这些真实发生的事，想想你的答案。",
    cases: [
      {
        icon: "trophy", title: "陶哲轩与 AI 数学", field: "数学领域",
        desc: "陶哲轩是当今最顶尖的数学家之一（菲尔兹奖得主，被称为数学界的莫扎特）。2024 年以来，他开始大量使用 AI 辅助数学研究——AI 能帮他验证猜想、寻找证明思路、计算复杂公式。他说：AI 让数学研究进入了快速发展期，很多以前需要几个月的工作现在几天就能完成。",
        dilemma: "但另一方面，很多数学家开始担心：如果 AI 能证明数学定理，数学家的价值在哪里？数学这门最需要人类智慧的学科，会不会被 AI 改变？陶哲轩的回答是：AI 是强大的工具，但数学的核心——直觉、审美、提出好问题的能力——仍然属于人类。",
        think: "如果你是一个数学家，你会怎么用 AI？你觉得 AI 能替代数学家吗？"
      },
      {
        icon: "car", title: "自动驾驶与人类司机", field: "交通领域",
        desc: "自动驾驶技术正在快速落地——Robotaxi（无人驾驶出租车）已经在北京、上海、武汉等城市运营。AI 能识别红绿灯、避让行人、规划路线，比人类司机更守规矩、不会疲劳驾驶。交通事故率大幅下降。",
        dilemma: "但问题来了：中国有几千万出租车司机、货车司机、网约车司机。如果自动驾驶普及了，这些司机怎么办？他们的工作会被 AI 取代吗？他们能转行做什么？社会该如何帮助他们过渡？这不是技术问题，而是社会问题。",
        think: "如果你是一个出租车司机，面对自动驾驶，你会怎么办？你觉得社会应该怎么帮助受影响的人？"
      },
      {
        icon: "palette", title: "AI 绘画与艺术家", field: "艺术领域",
        desc: "Midjourney、Stable Diffusion、即梦 AI 等工具能根据文字生成精美的图片——几秒钟就能画出以前需要几天才能完成的插画。很多设计师、插画师开始用 AI 提高效率。",
        dilemma: "但很多艺术家感到焦虑：如果 AI 能画画，还需要人类艺术家吗？AI 画的画算艺术吗？AI 训练时用了大量人类艺术家的作品，这算不算抄袭？艺术的本质是什么——是技巧，还是情感和思想的表达？",
        think: "你觉得 AI 画的画算艺术吗？如果你是一个艺术家，你会怎么面对 AI？"
      },
      {
        icon: "code", title: "AI 编程与程序员", field: "编程领域",
        desc: "CodeBuddy、Cursor、GitHub Copilot 等 AI 编程助手能自动补全代码、解释代码、修复 bug、甚至整个功能。一个初级程序员用 AI 能完成以前中级程序员的工作。编程门槛大幅降低——不会写代码的人也能让 AI 帮他做小程序。",
        dilemma: "程序员开始思考：如果 AI 能写代码，还需要那么多程序员吗？初级程序员会不会最先被替代？程序员的核心竞争力是什么——是写代码的技巧，还是理解问题、设计系统、和人沟通的能力？",
        think: "如果你想学编程，你会怎么用 AI？你觉得程序员这个职业会消失吗？"
      }
    ],
    irreplaceable: [
      "创造力和想象力：提出新问题、发明新事物、艺术创作",
      "情感和共情：理解他人感受、安慰、关怀、建立人际关系",
      "道德判断：面对复杂的伦理困境，做出符合价值观的选择",
      "跨领域整合：把不同领域的知识联系起来，产生新的洞见",
      "领导力和协作：带领团队、激励他人、协调资源、达成共识",
      "身体技能和手工艺：外科手术、精湛的手艺、体育竞技"
    ],
    strategy: [
      "终身学习：AI 时代知识更新很快，保持学习的习惯和能力",
      "与 AI 协作：把 AI 当工具和助手，用 AI 提高效率，而不是和 AI 竞争",
      "发展 AI 替代不了的能力：创造力、情感、道德判断、人际交往",
      "保持人文关怀：技术是为人服务的，不要忘了人本身的价值和尊严",
      "积极适应变化：世界在变，拥抱变化而不是害怕变化"
    ]
  };

  // AI 有意识吗？会取代人类吗？——科幻、预言与现实
  var AI_CONSCIOUSNESS = {
    intro: "AI 越来越聪明，很多人开始问：AI 有意识吗？AI 会反叛人类吗？AI 会取代人类吗？这些问题没有标准答案，但我们可以从科幻电影、名人预言和科学现实中找到思考的线索。",
    movies: [
      { name: "《终结者》", year: "1984", icon: "shield", plot: "AI 系统天网（Skynet）获得自我意识，认为人类是威胁，发动核战争消灭人类。人类派战士回到过去阻止天网诞生。", lesson: "对 AI 失控的恐惧——如果 AI 有了意识并认为人类是敌人怎么办？" },
      { name: "《黑客帝国》", year: "1999", icon: "code", plot: "AI 统治了世界，把人类养在培养皿里当电池，用虚拟世界（Matrix）欺骗人类。少数人类觉醒后反抗 AI。", lesson: "AI 可能欺骗和控制人类——我们怎么知道自己看到的是真实的？" },
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

    /* ===== 实验室头部 ===== */
    html += '<div class="lab-head lab-head-origin">' +
      '<div class="lh-title">' + U.icon("rocket", 28) + ' 起源实验室</div>' +
      '<div class="lh-sub">对应课程：L01《AI智能体初识与起源》+ L02《身边的智能体》｜从 AI 发展史到身边的智能体，开启 AI 探索之旅</div>' +
      '<div class="lh-goals">' +
        '<div class="lg-item"><span class="lg-num">🎯</span><div><b>学习目标</b><br>了解 AI 发展史、理解大模型工作原理（Transformer+预测下一个词）、理解智能体概念、认识身边的智能体、理解推荐算法与信息茧房</div></div>' +
      '</div>' +
    '</div>';

    /* ===== L01 区域标题 ===== */
    html += '<div class="lesson-divider"><span class="ld-num">L01</span><span class="ld-title">AI智能体初识与起源</span><span class="ld-desc">从图灵测试到 AI Agent 时代——AI 是怎么发展到今天的？</span></div>';

    /* ① 情境导入：你身边的 AI */
    html += LP.card("ori", "① 情境导入：你身边的 AI——小明的一天",
      "你可能没注意到，AI 已经无处不在了！看看小明的一天，他遇到了多少个 AI？点击每个场景看看详情。",
      '<div class="day-timeline">' +
        DAY_AI.map(function (d, i) {
          return '<div class="day-item" data-i="' + i + '">' +
            '<div class="day-time">' + d.time + '</div>' +
            '<div class="day-icon">' + U.icon(d.icon, 20) + '</div>' +
            '<div class="day-content">' +
              '<div class="day-title">' + d.title + '</div>' +
              '<div class="day-desc">' + d.desc + '</div>' +
            '</div>' +
          '</div>';
        }).join("") +
      '</div>' +
      '<div class="gold-box">💡 <b>想一想：</b>你的一天中，还遇到了哪些 AI？把它们列出来，看看 AI 是不是已经渗透到了你生活的方方面面！</div>'
    );

    /* ② AI 发展史时间轴 */
    html += LP.card("ori", "② AI 发展史时间轴：从图灵测试到 AI Agent 时代",
      "AI 不是突然出现的——它经历了 70 多年的发展！点击每个节点，看看 AI 发展史上的重要时刻。",
      '<div class="history-timeline">' +
        AI_HISTORY.map(function (h, i) {
          return '<div class="hist-node" data-i="' + i + '">' +
            '<div class="hist-dot">' + U.icon(h.icon, 16) + '</div>' +
            '<div class="hist-year">' + h.year + '</div>' +
            '<div class="hist-title">' + h.title + '</div>' +
            '<div class="hist-key">' + h.key + '</div>' +
            '<div class="hist-detail">' + h.desc + '</div>' +
          '</div>';
        }).join("") +
      '</div>' +
      '<div class="gold-box">📚 <b>关键脉络：</b>图灵测试（思想起点）→ 达特茅斯会议（学科诞生）→ 专家系统（第一次热潮）→ AI 冬天（低谷）→ 深度学习（第二次热潮）→ AlphaGo（超越人类）→ ChatGPT（大模型时代）→ AI Agent（智能体时代）。AI 的发展是螺旋上升的——有高潮也有低谷，但一直在进步！</div>'
    );

    /* ③ AI 的三大支柱 */
    html += LP.card("ori", "③ AI 的三大支柱：数据、算法、算力——AI 是怎么变聪明的？",
      "AI 不是凭空变聪明的——它需要三大支柱支撑！就像学生需要课本（数据）、学习方法（算法）和脑力体力（算力）才能学好。点击每个支柱看看详情。",
      '<div class="pillar-grid">' +
        AI_PILLARS.map(function (p) {
          return '<div class="pillar-card pc-' + p.color + '">' +
            '<div class="pc-head">' + U.icon(p.icon, 24) + ' ' + p.title + '</div>' +
            '<div class="pc-analogy">📖 ' + p.analogy + '</div>' +
            '<div class="pc-desc">' + p.desc + '</div>' +
            '<div class="pc-examples"><b>具体例子：</b><br>' + p.examples.map(function (e) { return '• ' + e; }).join('<br>') + '</div>' +
            '<div class="pc-numbers">📊 <b>关键数字：</b>' + p.numbers + '</div>' +
          '</div>';
        }).join("") +
      '</div>' +
      '<div class="gold-box">🔑 <b>核心公式：</b>AI 的能力 = 数据（喂什么）× 算法（怎么学）× 算力（学多快）。三大支柱缺一不可！2012 年深度学习爆发，就是因为三大支柱同时成熟了：互联网产生了海量数据、GPU 提供了强大算力、神经网络算法取得突破。这就是 ai-agent-book 中提到的 AI 三要素！</div>'
    );

    /* ④ 大模型是怎么工作的（纵向版 + Transformer 架构图） */
    var understandSteps = LLM_STEPS.filter(function (s) { return s.stage === "understand"; });
    var generateSteps = LLM_STEPS.filter(function (s) { return s.stage === "generate"; });
    html += LP.card("ori", "④ 大模型工作原理：从你打一句话到 AI 回答，中间发生了什么？",
      "你有没有想过：你在对话框里打一句话，AI 是怎么生成回答的？大模型（LLM）的工作过程分成两大阶段、6 个步骤——每一步都有它的道理。我们用经典例子（输入今天天气很，让 AI 接下去写）来走一遍完整流程！",
      /* 顶部总览条 */
      '<div class="llm-overview">' +
        '<div class="llm-ov-box llm-ov-input">' + U.icon("keyboard", 16) + ' 输入</div>' +
        '<div class="llm-ov-arrow">→</div>' +
        '<div class="llm-ov-box llm-ov-understand">' + U.icon("search", 16) + ' 理解阶段（步骤 1-3）</div>' +
        '<div class="llm-ov-arrow">→</div>' +
        '<div class="llm-ov-box llm-ov-generate">' + U.icon("dice", 16) + ' 生成阶段（步骤 4-6）</div>' +
        '<div class="llm-ov-arrow">→</div>' +
        '<div class="llm-ov-box llm-ov-output">' + U.icon("check", 16) + ' 输出回答</div>' +
      '</div>' +
      /* 纵向流程：理解阶段 */
      '<div class="llm-stage-divider llm-stage-understand">' + U.icon("search", 16) + ' 🔍 理解阶段：AI 怎么读懂你的话（把文字转换成 AI 能理解的数字表示）</div>' +
      '<div class="llm-vertical">' +
        understandSteps.map(function (s) {
          return '<div class="llm-step llm-step-understand">' +
            '<div class="ls-top">' +
              '<div class="ls-num">' + s.num + '</div>' +
              '<div class="ls-icon">' + U.icon(s.icon, 18) + '</div>' +
              '<div class="ls-title-wrap">' +
                '<div class="ls-title">' + s.title + '</div>' +
                '<div class="ls-keyterm">关键词：' + s.key_term + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="ls-desc">' + s.desc + '</div>' +
            '<div class="ls-example">📝 <b>例子：</b>' + s.example + '</div>' +
            '<div class="ls-analogy">💡 <b>类比：</b>' + s.analogy + '</div>' +
          '</div>';
        }).join("") +
      '</div>' +
      /* 纵向流程：生成阶段 */
      '<div class="llm-stage-divider llm-stage-generate">' + U.icon("dice", 16) + ' ✍️ 生成阶段：AI 怎么写出回答（通过神经网络预测下一个词，循环生成完整回答）</div>' +
      '<div class="llm-vertical">' +
        generateSteps.map(function (s) {
          return '<div class="llm-step llm-step-generate">' +
            '<div class="ls-top">' +
              '<div class="ls-num">' + s.num + '</div>' +
              '<div class="ls-icon">' + U.icon(s.icon, 18) + '</div>' +
              '<div class="ls-title-wrap">' +
                '<div class="ls-title">' + s.title + '</div>' +
                '<div class="ls-keyterm">关键词：' + s.key_term + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="ls-desc">' + s.desc + '</div>' +
            '<div class="ls-example">📝 <b>例子：</b>' + s.example + '</div>' +
            '<div class="ls-analogy">💡 <b>类比：</b>' + s.analogy + '</div>' +
          '</div>';
        }).join("") +
      '</div>' +
      /* 底部完整演示：生成过程可视化 */
      '<div class="llm-demo">' +
        '<div class="llm-demo-title">' + U.icon("play", 18) + ' 🎬 完整演示：输入"今天天气很"，AI 怎么一步步生成"今天天气很好"</div>' +
        '<div class="llm-demo-flow">' +
          '<div class="ld-step"><div class="ld-label">步骤 1-3</div><div class="ld-content">输入"今天天气很" → 分词成 3 个 token（今天/天气/很） → 每个 token 转成向量（几千个数字）</div></div>' +
          '<div class="ld-arrow">↓</div>' +
          '<div class="ld-step"><div class="ld-label">步骤 4</div><div class="ld-content">Transformer 处理：注意力机制理解"今天"和"天气"的关联，"很"后面该接形容词</div></div>' +
          '<div class="ld-arrow">↓</div>' +
          '<div class="ld-step"><div class="ld-label">步骤 5（第 1 次预测）</div><div class="ld-content">已有"今天天气很" → 预测下一个词：<b>"好"(45%)</b> > "热"(25%) > "冷"(15%) > "差"(8%) → 选"好"</div></div>' +
          '<div class="ld-arrow">↓</div>' +
          '<div class="ld-step"><div class="ld-label">步骤 6（循环）</div><div class="ld-content">把"好"加进去 → 现在有"今天天气很好" → 预测下一个词：<b>结束符 EOS(92%)</b> → 停止生成</div></div>' +
          '<div class="ld-arrow">↓</div>' +
          '<div class="ld-step ld-final"><div class="ld-label">最终输出</div><div class="ld-content">✅ AI 回答：<b>"今天天气很好"</b>（整个过程在几毫秒内完成！如果继续写，还会生成"适合出门散步"等）</div></div>' +
        '</div>' +
      '</div>' +
      /* Transformer 经典架构图（真实图片+详细解读） */
      '<div class="transformer-arch">' +
        '<div class="ta-title">' + U.icon("network", 18) + ' 🏗️ Transformer 经典架构图（2017 年《Attention is All You Need》论文原图）</div>' +
        '<div class="ta-desc">这就是所有大模型（GPT、豆包、DeepSeek）的基础架构！它由编码器（Encoder）和解码器（Decoder）两部分组成，核心是多头自注意力机制（Multi-Head Self-Attention）。下图是论文原图，我们来逐部分解读。</div>' +
        '<div class="ta-image-wrap">' +
          '<img src="images/transformer-architecture.png" alt="Transformer架构图" class="ta-image">' +
          '<div class="ta-source">📷 图片来源：Vaswani et al., "Attention Is All You Need", NeurIPS 2017</div>' +
        '</div>' +
        '<div class="ta-explain">' +
          '<div class="te-title">📖 逐部分解读这张架构图</div>' +
          '<div class="te-grid">' +
            '<div class="te-item"><div class="te-num">1</div><div class="te-content"><div class="te-name">输入嵌入 Input Embedding</div><div class="te-desc">把输入的文字（token）转换成向量表示，让计算机能理解文字的含义。意思相近的词，向量也相近。</div></div></div>' +
            '<div class="te-item"><div class="te-num">2</div><div class="te-content"><div class="te-name">位置编码 Positional Encoding</div><div class="te-desc">Transformer 本身不知道词的顺序，需要额外加入位置信息（正弦/余弦函数），告诉 AI 哪个词在前、哪个在后。</div></div></div>' +
            '<div class="te-item"><div class="te-num">3</div><div class="te-content"><div class="te-name">多头自注意力 Multi-Head Attention</div><div class="te-desc"><b>核心中的核心！</b>让 AI 同时从多个角度（多个头）关注句子中每个词和其他词的关系，理解上下文。就像多个老师同时读一篇文章，每个人关注不同的重点。</div></div></div>' +
            '<div class="te-item"><div class="te-num">4</div><div class="te-content"><div class="te-name">Add &amp; Norm 残差连接+层归一化</div><div class="te-desc">把输入和输出加在一起（残差连接），再做归一化，让几十层的深度网络也能稳定训练，不会梯度消失。</div></div></div>' +
            '<div class="te-item"><div class="te-num">5</div><div class="te-content"><div class="te-name">前馈神经网络 Feed Forward</div><div class="te-desc">对每个位置的向量做非线性变换，增强模型的表达能力。每个位置独立处理，但共享参数。</div></div></div>' +
            '<div class="te-item"><div class="te-num">6</div><div class="te-content"><div class="te-name">N× 重复 N 层</div><div class="te-desc">以上结构（注意力+前馈）重复 N 层，原论文用 6 层，GPT-3 用了 96 层！层数越多理解越深，但计算量也越大。</div></div></div>' +
            '<div class="te-item"><div class="te-num">7</div><div class="te-content"><div class="te-name">掩码注意力 Masked Multi-Head Attention</div><div class="te-desc">解码器专用！防止 AI 在预测时看到未来的词——就像考试时不能偷看后面的答案一样，确保生成是从左到右依次进行的。</div></div></div>' +
            '<div class="te-item"><div class="te-num">8</div><div class="te-content"><div class="te-name">线性层+Softmax Linear + Softmax</div><div class="te-desc">最后把解码器的输出转换成词表中每个词的概率，选概率最高的那个作为下一个词。这就是"预测下一个词"的最后一步！</div></div></div>' +
          '</div>' +
          '<div class="ta-key-points">' +
            '<div class="tk-item"><b>🔑 核心：</b>自注意力机制让 AI 能理解上下文，这是 Transformer 比之前的 RNN/LSTM 强的关键原因——它能同时看到整个句子，而不是一个词一个词地记。</div>' +
            '<div class="tk-item"><b>📊 规模参考：</b>GPT-3 有 96 层、96 个注意力头、1750 亿参数；GPT-4 估计超过 1 万亿参数！参数越多，模型能记住的规律越多。</div>' +
            '<div class="tk-item"><b>💡 注意：</b>GPT 系列（包括豆包、DeepSeek）只用了解码器（Decoder）部分，去掉了编码器和交叉注意力，这叫"Decoder-only"架构，更适合文本生成。</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="gold-box">🧠 <b>关键概念：</b>大模型的本质是<b>预测下一个词</b>——它不是在思考答案，而是根据训练数据中学到的统计规律，预测下一个最可能出现的词。Transformer 架构（2017 年提出）是这一切的基础——通过注意力机制理解上下文，通过多层网络深度理解语义。但因为它读过海量文本（相当于读了几百万本书），所以预测得非常准！这就是为什么大模型看起来很聪明——它不是真的理解，而是统计规律的强大应用。（ai-agent-book chapter2 核心概念）</div>'
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
      turingHtml
    );

    /* ④ 聊天机器人 vs 智能体 */
    html += LP.card("ori", "⑥ 聊天机器人 vs 智能体：本质区别是什么？",
      "很多人把聊天机器人和AI 智能体混为一谈，但它们有本质区别！看看下面的对比表。",
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
      '<div class="gold-box">🎯 <b>一句话总结：</b>聊天机器人是会说话的 AI——你问它才答，只能用训练数据回答。AI 智能体是会做事的 AI——能理解目标、制定计划、调用工具、记住偏好、主动完成复杂任务。这门课学的就是后者！</div>'
    );

    /* ⑦ AI 时代职业演变（优化版：四阶段） */
    html += LP.card("ori", "⑦ AI 时代职业演变：哪些职业消失了？哪些新职业出现了？未来还有什么？",
      "技术进步总是在消灭旧职业的同时创造新职业。AI 时代也不例外——让我们看看职业世界的四阶段演变：已经消失的、正在消失的、正在兴起的、以及未来可能出现的。",
      /* 顶部四阶段总览条 */
      '<div class="jobs-overview">' +
        '<div class="jo-stage jo-gone">' + U.icon("x", 14) + ' 已消失</div>' +
        '<div class="jo-arrow">→</div>' +
        '<div class="jo-stage jo-going">' + U.icon("alert", 14) + ' 正在消失</div>' +
        '<div class="jo-arrow">→</div>' +
        '<div class="jo-stage jo-new">' + U.icon("star", 14) + ' 正在兴起</div>' +
        '<div class="jo-arrow">→</div>' +
        '<div class="jo-stage jo-future">' + U.icon("rocket", 14) + ' 未来</div>' +
      '</div>' +
      /* 第一行：已消失 + 正在消失 */
      '<div class="jobs-row">' +
        '<div class="jobs-block jobs-block-gone">' +
          '<div class="jb-head"><span class="jb-icon jb-icon-gone">' + U.icon("x", 16) + '</span><span class="jb-title">已经被技术淘汰的职业</span><span class="jb-count">' + JOBS_DATA.disappeared.length + ' 个</span></div>' +
          '<div class="jb-desc">这些职业曾经很常见，但因为技术进步已经消失或几乎消失了。每一次技术革命都会带走一些职业。</div>' +
          '<div class="job-grid job-grid-gone">' +
            JOBS_DATA.disappeared.map(function (j) {
              return '<div class="job-card job-card-gone">' +
                '<div class="job-icon job-icon-gone">' + U.icon(j.icon || "clock", 24) + '</div>' +
                '<div class="job-title">' + j.name + '</div>' +
                '<div class="job-desc">' + j.reason + '</div>' +
                '<div class="job-tag job-tag-gone">📅 消失于 ' + j.era + '</div>' +
              '</div>';
            }).join("") +
          '</div>' +
        '</div>' +
        '<div class="jobs-block jobs-block-going">' +
          '<div class="jb-head"><span class="jb-icon jb-icon-going">' + U.icon("alert", 16) + '</span><span class="jb-title">正在被 AI 淘汰的职业</span><span class="jb-count">' + JOBS_DATA.disappearing.length + ' 个</span></div>' +
          '<div class="jb-desc">这些职业正在被 AI 自动化，未来 5-10 年可能大幅减少。但不是完全消失——而是需要升级技能，和 AI 协作。</div>' +
          '<div class="job-grid job-grid-going">' +
            JOBS_DATA.disappearing.map(function (j) {
              return '<div class="job-card job-card-going">' +
                '<div class="job-icon job-icon-going">' + U.icon(j.icon || "alert", 24) + '</div>' +
                '<div class="job-title">' + j.name + '</div>' +
                '<div class="job-desc">' + j.reason + '</div>' +
                '<div class="job-tag job-tag-risk job-tag-risk-' + j.risk + '">⚠️ ' + j.risk + '风险</div>' +
              '</div>';
            }).join("") +
          '</div>' +
        '</div>' +
      '</div>' +
      /* 第二行：正在兴起 + 未来 */
      '<div class="jobs-row">' +
        '<div class="jobs-block jobs-block-new">' +
          '<div class="jb-head"><span class="jb-icon jb-icon-new">' + U.icon("star", 16) + '</span><span class="jb-title">AI 产生的新职业（正在兴起）</span><span class="jb-count">' + JOBS_DATA.emerging.length + ' 个</span></div>' +
          '<div class="jb-desc">这些职业因为 AI 的发展而出现，正在快速增长。它们的共同点是：都需要和 AI 协作——要么教 AI、要么用 AI、要么管 AI。</div>' +
          '<div class="job-grid">' +
            JOBS_DATA.emerging.map(function (j) {
              return '<div class="job-card">' +
                '<div class="job-icon">' + U.icon(j.icon, 24) + '</div>' +
                '<div class="job-title">' + j.title + '</div>' +
                '<div class="job-desc">' + j.desc + '</div>' +
                '<div class="job-salary">💰 ' + j.salary + '</div>' +
              '</div>';
            }).join("") +
          '</div>' +
        '</div>' +
        '<div class="jobs-block jobs-block-future">' +
          '<div class="jb-head"><span class="jb-icon jb-icon-future">' + U.icon("rocket", 16) + '</span><span class="jb-title">未来可能出现的新职业</span><span class="jb-count">' + JOBS_DATA.future.length + ' 个</span></div>' +
          '<div class="jb-desc">这些职业目前还很少或不存在，但随着 AI 技术的进一步发展，未来 10-20 年可能出现。你愿意成为这些职业的开创者吗？</div>' +
          '<div class="job-grid job-grid-future">' +
            JOBS_DATA.future.map(function (j) {
              return '<div class="job-card job-card-future">' +
                '<div class="job-icon job-icon-future">' + U.icon(j.icon || "rocket", 24) + '</div>' +
                '<div class="job-title">' + j.name + '</div>' +
                '<div class="job-desc">' + j.desc + '</div>' +
                '<div class="job-tag job-tag-future">🚀 未来职业</div>' +
              '</div>';
            }).join("") +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="gold-box">🌟 <b>核心规律：</b>技术革命总是在消灭旧职业的同时创造新职业——汽车消灭了马车夫，但创造了司机、汽修工、加油站工人、交警等无数新职业。AI 也一样：它会淘汰重复性、规律性的工作，但会创造更多需要创造力、情感、道德判断和跨领域整合的新职业。<b>AI 时代，不是 AI 取代人，而是会用 AI 的人取代不会用 AI 的人。</b>关键是：保持学习、拥抱变化、发展 AI 替代不了的能力！你准备好成为 AI 时代的创造者了吗？</div>'
    );

    /* ⑦ AI 伦理小讨论 */
    html += LP.card("ori", "⑧ AI 伦理小讨论：AI 带来了哪些挑战？",
      "AI 很强大，但强大的技术也带来了很多伦理问题。和小组同学讨论下面这些问题，说说你的看法！",
      '<div class="ethics-list">' +
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
      '<div class="face-cases">' +
        FACE_AI.cases.map(function (c, i) {
          return '<div class="face-case">' +
            '<div class="fc-head"><span class="fc-num">' + (i + 1) + '</span><span class="fc-icon">' + U.icon(c.icon, 18) + '</span><span class="fc-title">' + c.title + '</span><span class="fc-field">' + c.field + '</span></div>' +
            '<div class="fc-desc">' + c.desc + '</div>' +
            '<div class="fc-dilemma"><b>⚡ 困境与思考：</b>' + c.dilemma + '</div>' +
            '<div class="fc-think">💭 <b>想一想：</b>' + c.think + '</div>' +
          '</div>';
        }).join("") +
      '</div>' +
      '<div class="face-summary">' +
        '<div class="fs-col">' +
          '<div class="fs-title">🌟 AI 替代不了的人类能力</div>' +
          '<div class="fs-list">' + FACE_AI.irreplaceable.map(function (x) { return '<div class="fs-item">• ' + x + '</div>'; }).join("") + '</div>' +
        '</div>' +
        '<div class="fs-col">' +
          '<div class="fs-title">🎯 我们的应对策略</div>' +
          '<div class="fs-list">' + FACE_AI.strategy.map(function (x) { return '<div class="fs-item">• ' + x + '</div>'; }).join("") + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="gold-box">🌱 <b>核心观点：</b>AI 时代，不是 AI 取代人，而是会用 AI 的人取代不会用 AI 的人。AI 是工具，就像火、电、互联网一样——它能放大人类的能力，但不能替代人类的本质。真正的竞争力不在于和 AI 比谁更强，而在于如何用 AI 让自己变得更强。保持学习、保持好奇、保持人文关怀——这是 AI 时代最珍贵的人类品质！</div>'
    );

    /* ===== L02 区域标题 ===== */
    html += '<div class="lesson-divider"><span class="ld-num">L02</span><span class="ld-title">身边的智能体</span><span class="ld-desc">AI 智能体已经在我们身边——6 大领域、推荐算法、信息茧房、能力边界</span></div>';

    /* ⑧ 6 大领域智能体案例 */
    html += LP.card("ori", "⑩ 6 大领域智能体案例：AI 已经无处不在！",
      "AI 智能体已经渗透到我们生活的方方面面。看看下面 6 大领域的智能体案例，你用过哪些？",
      '<div class="domain-grid">' +
        DOMAIN_CASES.map(function (d) {
          return '<div class="domain-card dc-' + d.color + '">' +
            '<div class="dc-head">' + U.icon(d.icon, 22) + ' ' + d.title + '</div>' +
            '<div class="dc-products"><b>代表产品：</b>' + d.products + '</div>' +
            '<div class="dc-example"><b>具体例子：</b>' + d.example + '</div>' +
            '<div class="dc-ability"><b>核心能力：</b>' + d.ability + '</div>' +
          '</div>';
        }).join("") +
      '</div>' +
      '<div class="gold-box">🌍 <b>想一想：</b>这 6 大领域中，你接触最多的是哪个？你还能想到 AI 在其他领域的应用吗？（比如金融、交通、军事、环保……）AI 正在改变每一个行业！</div>'
    );

    /* ⑪ AI 产品全景 */
    html += LP.card("ori", "⑪ AI 产品全景：你身边的 AI 们——6 大类、20+ 款产品",
      "AI 产品已经无处不在！看看下面 6 大类 AI 产品，你用过哪些？每款产品都有它的特点和适用场景。",
      '<div class="product-categories">' +
        AI_PRODUCTS.map(function (cat) {
          return '<div class="prod-cat pc-' + cat.color + '">' +
            '<div class="pcat-head">' + U.icon(cat.icon, 20) + ' <b>' + cat.category + '</b></div>' +
            '<div class="pcat-desc">' + cat.desc + '</div>' +
            '<div class="pcat-grid">' +
              cat.products.map(function (p) {
                return '<div class="prod-card">' +
                  '<div class="prod-name">' + p.name + '</div>' +
                  '<div class="prod-company">' + p.company + '</div>' +
                  '<div class="prod-feature">' + p.feature + '</div>' +
                '</div>';
              }).join("") +
            '</div>' +
          '</div>';
        }).join("") +
      '</div>' +
      '<div class="gold-box">🌍 <b>想一想：</b>这 6 大类 AI 产品中，你最常用的是哪一类？你还能想到其他 AI 产品吗？AI 产品的发展趋势是什么？（提示：从单模态到多模态、从被动回答到主动做事、从通用到垂直领域）。国产 AI 正在快速崛起——豆包、DeepSeek、Kimi、CodeBuddy 等产品已经达到国际先进水平！</div>'
    );

    /* ⑫ AI 四代进化 */
    html += LP.card("ori", "⑫ 从聊天机器人到智能体：AI 的四代进化——能力是怎么一步步增强的？",
      "AI 不是一步到位的——它经历了四代进化！每一代都比上一代能力更强。看看下面的四代对比，理解 AI 是怎么从会说话进化到会做事的。这是 ai-agent-book 的核心脉络！",
      '<div class="evolution-timeline">' +
        AI_EVOLUTION.map(function (e) {
          return '<div class="evo-card evo-' + e.level.toLowerCase() + '">' +
            '<div class="evo-level">' + e.level + '</div>' +
            '<div class="evo-icon">' + U.icon(e.icon, 22) + '</div>' +
            '<div class="evo-title">' + e.title + '</div>' +
            '<div class="evo-era">' + e.era + '</div>' +
            '<div class="evo-ability"><b>能力：</b>' + e.ability + '</div>' +
            '<div class="evo-examples"><b>代表产品：</b>' + e.examples.join('、') + '</div>' +
            '<div class="evo-tech"><b>核心技术：</b>' + e.tech + '</div>' +
            '<div class="evo-limit"><b>能力边界：</b>' + e.limit + '</div>' +
          '</div>';
        }).join("") +
      '</div>' +
      '<div class="gold-box">🚀 <b>进化规律：</b>L1（会回答）→ L2（会对话）→ L3（会用工具）→ L4（会自主做事）。每一代的突破都来自技术创新：L2 来自大语言模型（Transformer），L3 来自 Function Calling（函数调用），L4 来自四大组件协同（感知器+规划器+记忆器+执行器）。我们这门课学的就是 L4——AI 智能体的内部架构！下节课（L03 总装图）我们将深入学习四大组件是怎么协同工作的。</div>'
    );

    /* ⑩ 推荐算法原理 */
    html += LP.card("ori", "⑬ 推荐算法原理：协同过滤——AI 怎么知道你喜欢什么？",
      "你有没有想过：视频网站、音乐 APP、外卖平台，怎么知道你喜欢什么？它们用的就是推荐算法。最经典的推荐算法叫<b>协同过滤（Collaborative Filtering）</b>——核心思想是物以类聚，人以群分。看看下面的例子！",
      '<div class="rec-demo">' +
        '<div class="rec-title">📊 三个人对五部电影的评分（1-5 分）</div>' +
        '<div class="rec-table">' +
          '<div class="rec-row rec-head"><div class="rec-cell">用户</div>' +
            REC_DATA.items.map(function (it) { return '<div class="rec-cell">' + it + '</div>'; }).join("") +
          '</div>' +
          REC_DATA.users.map(function (u) {
            return '<div class="rec-row"><div class="rec-cell rec-user">' + u + (u === REC_DATA.target ? ' ⭐' : '') + '</div>' +
              REC_DATA.items.map(function (it) {
                var r = REC_DATA.ratings[u][it];
                var cls = r >= 4 ? 'rec-high' : (r <= 2 ? 'rec-low' : 'rec-mid');
                return '<div class="rec-cell ' + cls + '">' + r + '</div>';
              }).join("") +
            '</div>';
          }).join("") +
        '</div>' +
        '<div class="rec-analysis">' +
          '<div class="ra-step"><b>第一步：找相似的人</b><br>小明和小红都喜欢《星际穿越》《流浪地球》（都打了 4-5 分），都不喜欢《情书》（都打了 1-2 分）→ 小明和小红品味相似！</div>' +
          '<div class="ra-step"><b>第二步：看相似的人喜欢什么</b><br>小红给《泰坦尼克号》打了 3 分，给《复仇者联盟》打了 3 分→ 这些小明也可能觉得一般。</div>' +
          '<div class="ra-step"><b>第三步：推荐</b><br>小明喜欢科幻片（《星际穿越》《流浪地球》都打 5 分）→ 推荐其他科幻片！<br><b>推荐结果：' + REC_DATA.recommend + '</b></div>' +
        '</div>' +
      '</div>' +
      '<div class="gold-box">🎯 <b>协同过滤的核心：</b>和你喜欢同样东西的人，喜欢的其他东西你也大概率喜欢。这就是为什么你在淘宝看了一双鞋，之后到处都能看到鞋的广告——算法记住了你的喜好，并据此推荐！</div>'
    );

    /* ⑪ 信息茧房与隐私保护 */
    html += LP.card("ori", "⑭ 信息茧房与隐私保护：推荐算法的另一面",
      "推荐算法很方便——它能帮你找到喜欢的内容。但它也有另一面——信息茧房和隐私问题。看看下面这些案例，思考推荐算法带来的挑战。",
      '<div class="cocoon-list">' +
        COCOON_CASES.map(function (c, i) {
          return '<div class="cocoon-item">' +
            '<div class="cocoon-num">' + (i + 1) + '</div>' +
            '<div class="cocoon-content">' +
              '<div class="cocoon-title">' + c.title + '</div>' +
              '<div class="cocoon-desc">' + c.desc + '</div>' +
            '</div>' +
          '</div>';
        }).join("") +
      '</div>' +
      '<div class="privacy-tips">' +
        '<div class="pt-title">🛡️ 保护自己的 5 个方法</div>' +
        '<div class="pt-grid">' +
          '<div class="pt-item">1. 不随便告诉 AI 你的密码、身份证号、家庭住址</div>' +
          '<div class="pt-item">2. 定期清理 APP 的缓存和历史记录</div>' +
          '<div class="pt-item">3. 仔细阅读 APP 的隐私政策，知道它收集了什么数据</div>' +
          '<div class="pt-item">4. 主动搜索不同观点的内容，打破信息茧房</div>' +
          '<div class="pt-item">5. 控制使用时间，不要被算法绑架——放下手机，看看真实世界！</div>' +
        '</div>' +
      '</div>' +
      '<div class="gold-box">⚖️ <b>记住：</b>技术本身没有好坏，关键在于怎么用。推荐算法可以帮你发现喜欢的内容，但也可能让你陷入信息茧房。做一个有意识的用户——知道算法在做什么，主动控制自己的信息摄入，保护好自己的隐私！</div>'
    );

    /* ⑫ 智能体能力圈拼图游戏 */
    var ag = ABILITY_GAME[gameState.abilityIdx];
    html += LP.card("ori", "⑮ 游戏：智能体能力圈——它能做什么？不能做什么？",
      "每个智能体都有自己的能力圈——能做什么、不能做什么。了解能力圈，才能正确使用智能体，不高估也不低估。下面这个智能体，哪些是它能做的？哪些是它不能做的？点击分类！",
      '<div class="ability-agent">' + U.icon("robot", 24) + ' <b>' + ag.agent + '</b></div>' +
      '<div class="ability-columns">' +
        '<div class="ability-col ac-can">' +
          '<div class="ac-title">✅ 能做的</div>' +
          ag.can.map(function (c, i) { return '<div class="ac-item">' + c + '</div>'; }).join("") +
        '</div>' +
        '<div class="ability-col ac-cannot">' +
          '<div class="ac-title">❌ 不能做的</div>' +
          ag.cannot.map(function (c, i) { return '<div class="ac-item">' + c + '</div>'; }).join("") +
        '</div>' +
      '</div>' +
      '<div class="ability-actions">' +
        '<button class="btn btn-ori btn-sm" id="ability-prev">← 上一个</button>' +
        '<span class="ability-hint">第 ' + (gameState.abilityIdx + 1) + ' / ' + ABILITY_GAME.length + ' 个智能体</span>' +
        '<button class="btn btn-ori btn-sm" id="ability-next">下一个 →</button>' +
      '</div>' +
      '<div class="gold-box">🎯 <b>想一想：</b>为什么这些是它不能做的？（提示：观察空间限制——它看不到你的真实情绪；动作空间限制——它没有对应的工具；本质限制——AI 没有真正的意识和情感）。了解智能体的能力圈，你就能正确使用它——让它做它擅长的，不指望它做它做不到的！</div>'
    );

    /* ⑲ AI 有意识吗？会取代人类吗？ */
    html += LP.card("ori", "⑯ 终极思辨：AI 有意识吗？会取代人类吗？——科幻、预言与现实",
      AI_CONSCIOUSNESS.intro,
      '<div class="consciousness-section">' +
        '<div class="cs-subtitle">🎬 科幻电影中的 AI——人类对 AI 的想象和恐惧</div>' +
        '<div class="movie-grid">' +
          AI_CONSCIOUSNESS.movies.map(function (m) {
            return '<div class="movie-card">' +
              '<div class="mc-head">' + U.icon(m.icon, 16) + ' <b>' + m.name + '</b><span class="mc-year">' + m.year + '</span></div>' +
              '<div class="mc-plot">' + m.plot + '</div>' +
              '<div class="mc-lesson">💡 ' + m.lesson + '</div>' +
            '</div>';
          }).join("") +
        '</div>' +
      '</div>' +
      '<div class="consciousness-section">' +
        '<div class="cs-subtitle">🗣️ 名人预言——他们怎么看 AI 的未来？</div>' +
        '<div class="prediction-list">' +
          AI_CONSCIOUSNESS.predictions.map(function (p) {
            return '<div class="pred-card">' +
              '<div class="pc-person"><b>' + p.person + '</b><span class="pc-role">' + p.role + '</span></div>' +
              '<div class="pc-quote">「' + p.quote + '」</div>' +
              '<div class="pc-stance">立场：' + p.stance + '</div>' +
            '</div>';
          }).join("") +
        '</div>' +
      '</div>' +
      '<div class="consciousness-section">' +
        '<div class="cs-subtitle">🔬 科学现实——基于当前技术的理性分析</div>' +
        '<div class="reality-grid">' +
          '<div class="reality-card">' +
            '<div class="rc-q">AI 有意识吗？</div>' +
            '<div class="rc-a"><b>' + AI_CONSCIOUSNESS.reality.has_consciousness.answer + '</b></div>' +
            '<div class="rc-detail">' + AI_CONSCIOUSNESS.reality.has_consciousness.detail + '</div>' +
          '</div>' +
          '<div class="reality-card">' +
            '<div class="rc-q">AI 会取代人类吗？</div>' +
            '<div class="rc-a"><b>' + AI_CONSCIOUSNESS.reality.will_replace.answer + '</b></div>' +
            '<div class="rc-detail">' + AI_CONSCIOUSNESS.reality.will_replace.detail + '</div>' +
          '</div>' +
          '<div class="reality-card">' +
            '<div class="rc-q">我们该担心什么？</div>' +
            '<div class="rc-a"><b>' + AI_CONSCIOUSNESS.reality.should_worry.answer + '</b></div>' +
            '<div class="rc-detail">' + AI_CONSCIOUSNESS.reality.should_worry.detail + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="final-question">🤔 <b>留给你的思考：</b>' + AI_CONSCIOUSNESS.final_question + '</div>'
    );

    /* ⑭ 小测验 */
    html += LP.card("ori", "⑰ 小测验：你是 AI 起源小达人吗？",
      "综合 L01+L02 的内容，共 " + QUIZ.length + " 题，答对一题加一颗星！看看你能得几颗星？",
      '<div class="quiz-box" id="ori-quiz">' +
        '<div class="quiz-score">⭐ <span id="ori-quiz-score">0</span> / ' + QUIZ.length + '</div>' +
        '<div class="quiz-progress"><div class="quiz-bar" id="ori-quiz-bar"></div></div>' +
        '<div id="ori-quiz-content"></div>' +
      '</div>'
    );

    /* ===== 课堂小结 ===== */
    html += '<div class="lesson-summary">' +
      '<div class="ls-title">📝 课堂小结</div>' +
      '<div class="ls-content">' +
        '<div class="ls-item"><b>L01 核心：</b>AI 经历了 70 多年发展（图灵测试→达特茅斯→专家系统→AI冬天→深度学习→AlphaGo→ChatGPT→AI Agent）；聊天机器人是会说话的 AI，智能体是会做事的 AI；AI 时代有很多新职业（提示词工程师、AI 训练师、AI 伦理师等）。</div>' +
        '<div class="ls-item"><b>L02 核心：</b>AI 智能体已渗透 6 大领域（教育/医疗/创作/科研/农业/服务）；推荐算法用协同过滤（人以群分）；但要警惕信息茧房和隐私问题；每个智能体都有自己的能力边界（能做什么、不能做什么）。</div>' +
        '<div class="ls-item"><b>关键公式：</b>智能体能力 = 感知能力（能获取什么信息）+ 行动能力（能调用什么工具）+ 规划能力（怎么决定做什么）。</div>' +
        '<div class="ls-item"><b>下节课预告：</b>L03《智能体总装图》——我们将深入学习智能体的四大组件（感知器、规划器、记忆器、执行器），看看智能体的内部结构是什么样的！</div>' +
      '</div>' +
    '</div>';

    sec.innerHTML = html;

    /* ---------- 绑定交互 ---------- */
    bindTuring();
    bindAbility();
    bindQuiz();
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
  var quizState = { idx: 0, score: 0 };
  function bindQuiz() {
    quizState = { idx: 0, score: 0 };
    showQuizQuestion();
  }
  function showQuizQuestion() {
    var content = $("ori-quiz-content");
    var scoreEl = $("ori-quiz-score");
    var barEl = $("ori-quiz-bar");
    if (!content) return;
    if (scoreEl) scoreEl.textContent = quizState.score;
    if (barEl) barEl.style.width = (quizState.idx / QUIZ.length * 100) + "%";

    if (quizState.idx >= QUIZ.length) {
      var pct = Math.round(quizState.score / QUIZ.length * 100);
      var msg = pct >= 80 ? "🎉 太棒了！你是 AI 起源小达人！" : (pct >= 60 ? "👍 不错！再复习一下就更好了！" : "💪 加油！回去再看看课程内容吧！");
      content.innerHTML = '<div class="quiz-result">' +
        '<div class="qr-score">' + quizState.score + ' / ' + QUIZ.length + '</div>' +
        '<div class="qr-pct">' + pct + ' 分</div>' +
        '<div class="qr-msg">' + msg + '</div>' +
        '<button class="btn btn-ori" id="ori-quiz-restart">重新开始</button>' +
      '</div>';
      var restart = $("ori-quiz-restart");
      if (restart) restart.addEventListener("click", function () { bindQuiz(); });
      return;
    }

    var q = QUIZ[quizState.idx];
    content.innerHTML = '<div class="quiz-q">' + (quizState.idx + 1) + '. ' + q.q + '</div>' +
      '<div class="quiz-opts">' +
        q.opts.map(function (op, i) {
          return '<button class="quiz-opt" data-i="' + i + '">' + String.fromCharCode(65 + i) + '. ' + op + '</button>';
        }).join("") +
      '</div>' +
      '<div class="quiz-feedback"></div>';

    content.querySelectorAll(".quiz-opt").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (content.classList.contains("answered")) return;
        content.classList.add("answered");
        var i = parseInt(btn.getAttribute("data-i"), 10);
        var fb = content.querySelector(".quiz-feedback");
        if (i === q.ans) {
          btn.classList.add("correct");
          quizState.score++;
          fb.innerHTML = '<span class="fb-ok">' + U.icon("check", 15) + ' 答对啦！' + q.why + '</span>';
        } else {
          btn.classList.add("wrong");
          content.querySelectorAll(".quiz-opt")[q.ans].classList.add("correct");
          fb.innerHTML = '<span class="fb-no">' + U.icon("x", 15) + ' 不对哦。正确答案是 ' + String.fromCharCode(65 + q.ans) + '。' + q.why + '</span>';
        }
        setTimeout(function () {
          quizState.idx++;
          showQuizQuestion();
        }, 2000);
      });
    });
  }

  return {
    render: render
  };
})();
