/* ============================================================
 * api.js —— 静态版：与 DeepSeek 大模型通信 + 联网搜索
 * 
 * 【静态部署说明】
 * - DeepSeek：浏览器直连 api.deepseek.com（官方支持 CORS 跨域）
 * - 联网搜索：必应搜索 RSS（CORS 代理）+ Wikipedia API 备用（免费，无需 Key）
 * - 真实天气：Open-Meteo（geocoding + forecast，免费，无需 Key，支持 CORS）
 * - API Key：由用户在使用时输入，存储在浏览器 localStorage，不硬编码
 * ============================================================ */

window.AgentLab = window.AgentLab || {};

AgentLab.API = (function () {

  /* ---------- 配置 ---------- */
  var DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
  var WIKIPEDIA_API = "https://zh.wikipedia.org/w/api.php";

  /* ---------- 工具函数 ---------- */
  function getSettings() {
    var api = AgentLab.Store.getApi();
    var model = (api && api.model) || AgentLab.CONFIG.model;
    return {
      key: (api && api.key) || "",
      model: model
    };
  }

  function hasApiKey() {
    var s = getSettings();
    return s.key && s.key.length > 10;
  }

  /* ---------- 带超时的 fetch ----------
   * 浏览器原生 fetch 没有超时：一旦对方“连上了却不返回”，Promise 会一直挂着，
   * 界面就永远停在“提问中……”，同学看不到任何结果（表现为“一个结果也不返回”）。
   * 这里用 AbortController 给每次请求加上限，超时后抛出明确的中文提示。 */
  function fetchTO(url, options, timeoutMs, what) {
    options = options || {};
    timeoutMs = timeoutMs || 45000;
    if (typeof AbortController === "undefined") return fetch(url, options);   // 极老环境降级

    var ctrl = new AbortController();
    var settled = false;
    var timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      try { ctrl.abort(); } catch (e) { }
    }, timeoutMs);
    options.signal = ctrl.signal;

    return fetch(url, options).then(function (resp) {
      settled = true;
      clearTimeout(timer);
      return resp;
    }, function (err) {
      clearTimeout(timer);
      if (err && (err.name === "AbortError" || /abort/i.test(err.message || ""))) {
        throw new Error("请求超时（超过 " + Math.round(timeoutMs / 1000) + " 秒没有响应）：" +
          (what || "服务") + "暂时没有应答，请稍后重试。");
      }
      throw err;
    });
  }

  function post(url, body, headers, timeoutMs, what) {
    var h = { "Content-Type": "application/json" };
    for (var k in (headers || {})) h[k] = headers[k];
    return fetchTO(url, {
      method: "POST",
      headers: h,
      body: JSON.stringify(body)
    }, timeoutMs || 60000, what || "大模型服务").then(function (resp) {
      if (!resp.ok) {
        return resp.json().catch(function () { return {}; }).then(function (j) {
          // 兼容多种错误体：OpenAI 风格 {error:{message}}、硅基流动风格 {code,message}
          var detail = (j && j.error && j.error.message) ||
                       (j && j.message) ||
                       (j && j.error) ||
                       (j && j.code ? ("错误码 " + j.code) : "");
          var err = new Error(detail || ("请求失败 HTTP " + resp.status));
          err.status = resp.status;
          err.code = j && j.code;
          throw err;
        });
      }
      return resp.json();
    });
  }

  function get(url, timeoutMs) {
    return fetchTO(url, {}, timeoutMs || 20000, "网络服务").then(function (resp) {
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      return resp.json();
    });
  }

  /* 取原始文本（解析 XML / 代理返回的正文用，不按 JSON 解析） */
  function getText(url, timeoutMs) {
    return fetchTO(url, {}, timeoutMs || 10000, "网络服务").then(function (resp) {
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      return resp.text();
    });
  }

  function extractContent(data) {
    try {
      return data.choices[0].message.content || "";
    } catch (e) {
      return "";
    }
  }

  /* ---------- DeepSeek 对话（直连） ---------- */
  /**
   * 发送一轮对话（浏览器直连 DeepSeek 官方 API）
   * @param {Array}  messages [{role:'system'|'user'|'assistant', content}]
   * @param {Object} [opts]   { maxTokens: 单次输出长度上限, temperature: 随机性(0~2),
   *                            onMeta: function(meta){} }
   *                          meta = { finishReason, usage }，finishReason === "length" 表示被截断
   * @returns {Promise<string>} 模型回复正文
   */
  function chat(messages, opts) {
    // 检查 API Key
    if (!hasApiKey()) {
      return Promise.reject(new Error("尚未配置 DeepSeek API Key：点右上角「设置」填写后即可使用。"));
    }
    opts = opts || {};

    var s = getSettings();
    var body = {
      model: s.model,
      messages: messages,
      temperature: (opts && opts.temperature != null) ? opts.temperature : AgentLab.CONFIG.temperature,
      max_tokens: opts.maxTokens || AgentLab.CONFIG.maxTokens
    };
    var auth = { Authorization: "Bearer " + s.key };

    return post(DEEPSEEK_URL, body, auth).then(function (data) {
      /* 截断检测：finish_reason === "length" 表示回答写到一半就被长度上限切断——
       * 这时“最后的答案”往往还没写出来，如果不在界面上明确提示，
       * 就会被误判成“模型答错了”，而实际上只是没写完。 */
      if (typeof opts.onMeta === "function") {
        try {
          var ch0 = (data && data.choices && data.choices[0]) || {};
          var msg0 = ch0.message || {};
          opts.onMeta({
            finishReason: ch0.finish_reason || "",
            usage: (data && data.usage) || null,
            /* 推理型模型会额外返回 reasoning_content —— 说明它“自己偷偷想过一遍”，
             * 这时再怎么要求“只给答案”，它也会先推理，CoT 实验的差距就体现不出来。 */
            reasoning: !!msg0.reasoning_content
          });
        } catch (e) { }
      }
      return extractContent(data);
    }).catch(function (err) {
      var msg = err && err.message;
      var status = err && err.status;

      // 超时：fetchTO 已给出友好提示，直接透出，别被下面的“网络”分支改写
      if (/请求超时/.test(msg || "")) {
        throw err;
      }
      // 未配置 Key
      if (/尚未配置 DeepSeek API Key/.test(msg || "")) {
        throw err;
      }
      /* 模型名不被支持：接口通常会回一句
       * “The supported API model names are A, B, but you passed X.”
       * 直接把可用列表翻译出来，省得老师去猜。 */
      var supM = String(msg || "").match(
        /supported\s+API\s+model\s+names\s+are\s+(.+?)\s*,\s*but\s+you\s+passed/i);
      if (supM) {
        var list = supM[1].replace(/\s*(?:,|and)\s*/g, "、").trim();
        throw new Error("模型名不被接口支持：当前可用的是 " + list +
          "。请点右上角「设置」，把模型改成其中之一（或选「自定义模型名」填写）。");
      }
      if (/model/i.test(msg || "") &&
          /(not\s+exist|does\s+not\s+exist|unknown|invalid|不支持|不存在)/i.test(msg || "")) {
        throw new Error("模型名不被接口支持。请点右上角「设置」，换一个你的接口支持的模型名。");
      }

      // 401 → 密钥无效
      // 注意：原来用裸的 “Invalid” 判断过宽，会把参数格式错误（如 invalid message role）也误报成密钥问题，
      // 也会让 agent.js 的“换写法重试”失效——所以这里收紧为更明确的密钥特征。
      if (status === 401 || /401|authentication|unauthorized|invalid[_\s-]*(api)?[_\s-]*key|api\s*key/i.test(msg || "")) {
        throw new Error("API 密钥无效：请点右上角「设置」，检查 DeepSeek API Key 是否正确（注意别有多余空格）。");
      }
      // 网络错误
      if (/fetch|Failed to fetch|网络|Network|TypeError/i.test(msg || "")) {
        throw new Error("网络连接失败：请检查网络连接，或确认 DeepSeek API（api.deepseek.com）可访问。");
      }
      // 429 → 频率限制
      if (status === 429 || /429|rate limit|频率/i.test(msg || "")) {
        throw new Error("调用太频繁了（429 频率限制），请稍等几秒再试。");
      }
      // 余额不足
      if (/insufficient|balance|余额|quota/i.test(msg || "")) {
        throw new Error("API 账户余额不足：请登录 DeepSeek 平台充值，或更换 API Key。");
      }
      /* 思考模式：带 tool_calls 的 assistant 消息必须把 reasoning_content 一起回传，否则 400。
       * agent.js 里有“写法兼容层”会自动换写法重试；走到这里说明几种写法都没成功，
       * 给老师一句能看懂的提示（关键词“思考模式”也被兼容层用来判断重试）。 */
      if (/reasoning_content|thinking\s*mode/i.test(msg || "")) {
        var eThink = new Error("模型处于“思考模式”，接口要求把推理内容（reasoning_content）一起回传。" +
          "已自动尝试兼容写法仍未成功：请点右上角「设置」，把模型换成 deepseek-chat，或改用非思考模式的模型。");
        eThink.status = status;
        throw eThink;
      }
      // 其他
      var eOther = new Error("大模型调用失败：" + (msg || "未知错误"));
      eOther.status = status;   // 保留状态码：上层（agent.js）要靠它判断能不能换写法重试
      throw eOther;
    });
  }

  /** 简化调用：传入提示词列表（system 可选）
   * @param {Object} [opts] 同 chat 的 opts（可传 maxTokens / onMeta） */
  function ask(systemPrompt, userText, opts) {
    var messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: userText });
    return chat(messages, opts);
  }

  /* ---------- 「思维链（CoT）」实验专用：调用硅基流动的小模型 ----------
   * 大模型太聪明，两种问法都答得对，实验看不出差别，
   * 所以这个实验单独用一个小参数的 chat 模型（见 CONFIG.cotModel）。
   * 用的是「云端能力密钥 · 硅基流动」，老师不需要任何额外配置。 */
  function askSmall(systemPrompt, userText, opts) {
    var cfg = (AgentLab.CONFIG && AgentLab.CONFIG.cotModel) || {};
    if (!hasCloudKey()) {
      return Promise.reject(new Error("COT_NO_CLOUD_KEY"));
    }
    opts = opts || {};

    var messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: userText });

    var body = {
      model: cfg.model,
      messages: messages,
      temperature: (opts.temperature != null) ? opts.temperature : AgentLab.CONFIG.temperature,
      max_tokens: opts.maxTokens || AgentLab.CONFIG.maxTokens
    };

    return post(cfg.url, body, { Authorization: "Bearer " + getCloudKey() }, 60000, "小模型服务")
      .then(function (data) {
        if (typeof opts.onMeta === "function") {
          try {
            var ch0 = (data && data.choices && data.choices[0]) || {};
            var msg0 = ch0.message || {};
            opts.onMeta({
              finishReason: ch0.finish_reason || "",
              usage: (data && data.usage) || null,
              reasoning: !!msg0.reasoning_content
            });
          } catch (e) { }
        }
        return extractContent(data);
      })
      .catch(function (err) {
        var msg = (err && err.message) || "";
        if (/请求超时/.test(msg)) throw err;
        if (/401|unauthorized|invalid.*key/i.test(msg)) {
          throw new Error("硅基流动密钥无效：请点右上角「设置」，检查「云端能力密钥」是否正确。");
        }
        if (/insufficient|balance|余额|quota|402/i.test(msg)) {
          throw new Error("硅基流动账户余额不足，小模型调用失败。请到 cloud.siliconflow.cn 充值。");
        }
        var supM = msg.match(/supported\s+API\s+model\s+names\s+are\s+(.+?)\s*,\s*but\s+you\s+passed/i);
        if (supM) {
          throw new Error("小模型名不被支持，可用的是 " +
            supM[1].replace(/\s*(?:,|and)\s*/g, "、").trim() +
            "。请让开发者把 js/config.js 里的 cotModel.model 改一下。");
        }
        throw new Error("小模型调用失败：" + (msg || "未知错误"));
      });
  }

  /* ---------- 联网搜索（多端点 × 多代理 + 大模型知识兜底） ----------
   * 背景（2026-10 实测）：必应已把 www.bing.com/search?format=rss 302 到 cn.bing.com；
   * 公共 CORS 代理普遍访问不了必应（allorigins 500/522、codetabs 522、corsproxy.io 已收费 401），
   * 维基百科在国内网络又经常超时——所以「联网搜索」随时可能整条失败。
   * 策略：① 依次尝试「端点 × 代理」组合，每个限时 6 秒，拿到结果立即返回；
   *      ② 维基百科并发尝试，限时 8 秒；
   *      ③ 都没拿到 → 若已配 DeepSeek Key，请大模型用“自己学过的知识”兜底，
   *         并在结果里如实标注“这不是刚查到的网页”，绝不冒充搜索结果。 */
  var SEARCH_HOSTS = ["https://cn.bing.com/search", "https://www.bing.com/search"];
  var SEARCH_PROXIES = [
    { mode: "get", url: "https://api.allorigins.win/get?url=" },
    { mode: "raw", url: "https://api.allorigins.win/raw?url=" },
    { mode: "raw", url: "https://api.codetabs.com/v1/proxy?quest=" }
  ];

  function bingRssUrl(host, query) {
    return host + "?q=" + encodeURIComponent(query) + "&format=rss&count=10&mkt=zh-CN";
  }

  /* 解析必应返回的 RSS XML → 条目数组（解析失败或被反爬拦截时返回空数组） */
  function parseRss(xmlText) {
    try {
      var doc = new DOMParser().parseFromString(xmlText, "text/xml");
      if (doc.getElementsByTagName("parsererror").length) return [];
      var items = doc.getElementsByTagName("item");
      var out = [];
      for (var i = 0; i < items.length && i < 10; i++) {
        var it = items[i];
        function tag(n) { var e = it.getElementsByTagName(n)[0]; return e ? e.textContent : ""; }
        var t = tag("title"), l = tag("link"), d = tag("description") || "";
        d = d.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
             .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
        if (t && l) out.push({ title: t, link: l, description: d.substring(0, 300) });
      }
      return out;
    } catch (e) {
      return [];
    }
  }

  /* 走一个代理取一次必应 RSS；任何一步失败都返回 []（不抛错，让下一个组合继续） */
  function tryOneProxy(host, proxy, query) {
    var target = bingRssUrl(host, query);
    var url = proxy.url + encodeURIComponent(target);
    return getText(url, 6000).then(function (body) {
      var xml = body;
      if (proxy.mode === "get") {
        try { xml = (JSON.parse(body) || {}).contents || ""; } catch (e) { xml = ""; }
      }
      return (xml && xml.indexOf("<") >= 0) ? parseRss(xml) : [];
    }).catch(function () { return []; });
  }

  /* 并行尝试所有「端点 × 代理」组合，取第一个非空结果（总耗时 ≤ 单次超时 6 秒） */
  function searchBingRSS(query) {
    var attempts = [];
    SEARCH_HOSTS.forEach(function (h) {
      SEARCH_PROXIES.forEach(function (p) { attempts.push(tryOneProxy(h, p, query)); });
    });
    return Promise.all(attempts).then(function (all) {
      for (var i = 0; i < all.length; i++) {
        if (all[i] && all[i].length) return all[i];
      }
      return [];
    });
  }

  /* ③ 没搜到时的兜底：请大模型用已有知识回答，并如实标注来源 */
  function knowledgeFallback(query) {
    searchTraceMark("③ 知识兜底：开始尝试");
    if (!hasApiKey()) {
      searchTraceMark("③ 知识兜底：未配置 Key，跳过");
      return Promise.resolve({
        ok: false, query: query, summary: "", results: [],
        error: "联网搜索没有成功（三级来源都没能拿到资料），且未配置大模型 Key，无法用已有知识兜底。"
      });
    }
    var sys = "你是课堂上的“知识兜底”助手：联网搜索没有成功，请用你已有的知识回答。" +
      "要求：直接给出答案，不要写思考过程；用小学五年级学生听得懂的中文；不超过 150 字；" +
      "只讲你确定的事实，不要编造数字、年份或引用来源；如果不确定，就明确说不确定。";
    /* maxTokens 给足：deepseek-v4-flash 默认带思维链，额度太小会被思考过程吃光，
     * 导致 HTTP 200 但 content 为空（表现为“接口没有返回内容”）。 */
    return ask(sys, query, { maxTokens: 1500 }).then(function (ans) {
      var text = (ans || "").trim();
      if (!text) {
        searchTraceMark("③ 知识兜底：接口没有返回内容");
        return { ok: false, query: query, summary: "", results: [], error: "联网搜索没有成功，知识兜底也没有返回内容。" };
      }
      searchTraceMark("③ 知识兜底：成功（大模型已有知识）");
      return { ok: false, query: query, summary: text, results: [], fallback: true, trace: searchTraceText() };
    }).catch(function (e) {
      searchTraceMark("③ 知识兜底：请求失败（" + ((e && e.message) || "网络错误") + "）");
      return {
        ok: false, query: query, summary: "", results: [],
        error: "联网搜索没有成功（三级来源都没能拿到资料），知识兜底也暂时不可用。"
      };
    });
  }

  /* ---------- DeepSeek 服务端联网搜索（Responses API + web_search 工具） ----------
   * 用现有 DeepSeek Key，走新 Responses 接口（chat/completions 没有 web_search）。
   * 关键点：官方文档说明接口对不支持的内置工具会“静默忽略”，社区实测又说可用——
   * 两者有出入，所以这里的判定标准是“响应里真的出现了搜索痕迹”：
   *   · output 里有 web_search_call 项，或
   *   · 正文带 url_citation / 链接引用；
   * 两者都没有 = 工具被忽略、模型只是用已有知识作答 → 返回 null，
   * 让上层继续走必应 / 知识兜底，绝不把“模型自己的话”标成搜索结果。 */

  /* 从 Responses 响应里取正文（兼容 output_text / output[].content 两种形态） */
  function extractResponsesText(data) {
    if (!data) return "";
    if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
    var out = "";
    var items = data.output || [];
    items.forEach(function (it) {
      if (!it) return;
      if (it.type === "message" && it.content) {
        (Array.isArray(it.content) ? it.content : [it.content]).forEach(function (c) {
          if (!c) return;
          if (typeof c === "string") out += c;
          else if (c.type === "output_text" && c.text) out += c.text;
          else if (c.text) out += c.text;
        });
      }
    });
    // 个别网关可能按 chat 格式返回
    if (!out && data.choices && data.choices[0] && data.choices[0].message) {
      out = data.choices[0].message.content || "";
    }
    return out.trim();
  }

  /* 从响应里收集引用来源（web_search_call 的 action.url / 正文里的 url_citation 注解） */
  function extractCitations(data) {
    var out = [], seen = {};
    function push(t, u) {
      t = (t || "").trim(); u = (u || "").trim();
      if (!u || seen[u]) return;
      seen[u] = 1;
      out.push({ title: t || u, url: u });
    }
    ((data && data.output) || []).forEach(function (it) {
      if (!it) return;
      if (it.type === "web_search_call" && it.action && it.action.url) {
        push(it.action.title || "", it.action.url);
      }
      var content = it.content;
      if (Array.isArray(content)) {
        content.forEach(function (c) {
          if (!c || !c.annotations) return;
          c.annotations.forEach(function (a) {
            if (a && (a.type === "url_citation" || a.url)) push(a.title, a.url);
          });
        });
      }
    });
    return out;
  }

  /* ---------- 搜索诊断 ----------
   * 三级来源逐级降级时，每一级“为什么没成”都记下来，
   * 全部失败时把这条轨迹写进工具消息——老师一眼就能看出卡在哪。 */
  var searchTrace = [];
  function searchTraceMark(s) { searchTrace.push(s); }
  function searchTraceText() {
    return searchTrace.length ? searchTrace.join("；") : "";
  }

  /* 单次尝试：声明 web_search 工具发起请求，并判定“是否真的联网搜索了”。
   * 返回 {kind:"ok"|"noTrace"|"empty"|"error", ...}，便于上层决定要不要再试。 */
  function tryDeepseekSearch(query, opt, timeoutMs) {
    var body = {
      model: opt.model,
      tools: [{ type: "web_search" }],
      tool_choice: opt.tool_choice,
      max_output_tokens: 2000,   /* 思维链也要占额度：给太小会 200 但没有正文 */
      input: "请先联网搜索，再回答下面这个问题：" + query +
        "\n回答要求：用小学五年级学生听得懂的中文，不超过 180 字；必须依据你搜索到的网页内容；" +
        "回答末尾用「来源：」列出你实际用到的网页标题和链接（如果有的话）。" +
        "如果网页里没有可靠信息，就明确写“网上没有查到可靠资料”；不要编造数字、年份或来源。"
    };
    /* 注意：必须把 Authorization 带上——post() 的第三个参数是“额外请求头”，
     * 之前这里传了 {}，导致请求不带鉴权，接口一律回 401 “auth header format”。 */
    var s = getSettings();
    return post(AgentLab.CONFIG.responsesUrl, body, { Authorization: "Bearer " + s.key }, timeoutMs).then(function (data) {
      var searched = false;
      ((data && data.output) || []).forEach(function (it) {
        if (it && (it.type === "web_search_call" || it.type === "web_search")) searched = true;
      });
      var text = extractResponsesText(data);
      var cites = extractCitations(data);
      if (!text) {
        searchTraceMark(opt.note + "：接口返回 200，但响应里没有正文");
        return { kind: "empty" };
      }
      if (!searched && !cites.length) {
        searchTraceMark(opt.note + "：接口正常应答，但没有联网搜索痕迹（web_search 工具被当前接口忽略，已记录，7 天内不再尝试）");
        markDsWsUnsupported();
        return { kind: "noTrace" };
      }
      searchTraceMark(opt.note + "：联网搜索成功（" + cites.length + " 条来源）");
      return { kind: "ok", text: text, citations: cites };
    }).catch(function (e) {
      var msg = (e && e.message) || String(e);
      searchTraceMark(opt.note + "：请求失败（" + msg + "）");
      return { kind: "error", message: msg };
    });
  }

  /* “接口忽略 web_search”的记忆：记下时间，7 天内不再白等这 18 秒；
   * 7 天后会再试一次——万一 DeepSeek 哪天放开了，系统能自动启用。 */
  var DS_WS_SKIP_KEY = "agentlab_ds_ws_unsupported_v1";
  var DS_WS_RETRY_MS = 7 * 24 * 3600 * 1000;

  function dsWsUnsupported() {
    var s = AgentLab.Store.get(DS_WS_SKIP_KEY, null);
    return !!(s && s.at && (Date.now() - s.at) < DS_WS_RETRY_MS);
  }
  function markDsWsUnsupported() {
    try { AgentLab.Store.set(DS_WS_SKIP_KEY, { at: Date.now() }); } catch (e) { }
  }

  /**
   * DeepSeek 服务端联网搜索（只试一次“强制联网搜索”）。
   * 实测（2026-10，Key 有效、HTTP 200）：/responses 会静默忽略 web_search——
   * 响应里没有任何 web_search_call / 引用，模型自己在思维链里说“我没有联网工具”；
   * /chat/completions 则直接 422（tools[0].type: unknown variant `web_search`）。
   * 所以这条路能否走通取决于 DeepSeek 侧是否开放，代码保持兼容：
   * 一旦响应里真出现搜索痕迹就会启用；被忽略则记录下来，7 天内不再尝试。
   * @returns {Promise<{text:string, citations:Array}|null>}
   *          null = 未配置 Key / 已知不支持 / 请求失败 / 没真的联网（原因记入 searchTrace）
   */
  function deepseekWebSearch(query) {
    if (!hasApiKey()) {
      searchTraceMark("① DeepSeek 服务端搜索：未配置 Key，跳过");
      return Promise.resolve(null);
    }
    if (AgentLab.CONFIG.deepseekWebSearch === false) {
      searchTraceMark("① DeepSeek 服务端搜索：已在 js/config.js 里关闭，跳过");
      return Promise.resolve(null);
    }
    if (dsWsUnsupported()) {
      searchTraceMark("① DeepSeek 服务端搜索：此前实测该接口忽略 web_search 工具，7 天内不再尝试");
      return Promise.resolve(null);
    }
    var forced = { model: AgentLab.CONFIG.model, tool_choice: { type: "web_search" }, note: "① 强制联网搜索" };
    return tryDeepseekSearch(query, forced, 18000).then(function (r) {
      return r.kind === "ok" ? { text: r.text, citations: r.citations } : null;
    });
  }

  /**
   * 联网搜索（三级来源，逐级降级，来源如实标注）
   * ① DeepSeek 服务端联网搜索（现有 Key，Responses API + web_search）
   * ② 必应 RSS（多端点 × 多代理并行）+ Wikipedia 备用
   * ③ 大模型已有知识兜底（summary 里明确标注“不是刚查到的网页”）
   * @param {string} query 搜索词
   * @returns {Promise<{ok:boolean, mode?:string, blocked?:boolean, fallback?:boolean,
   *                     query:string, summary:string, results:Array, error?:string}>}
   *   mode="deepseek"      ① 成功：summary 是搜索后整理的资料，results 是引用来源
   *   ok=true（无 mode）    ② 成功：results 为网页结果
   *   fallback=true        ①② 都失败：summary 是大模型“已有知识”（须如实标注）
   *   ok=false 且无 fallback 彻底失败（error 里给原因）
   */
  function search(query) {
    query = (query || "").trim();
    searchTrace = [];                       // 每次搜索重新记录诊断轨迹
    if (!query) {
      return Promise.resolve({ ok: false, query: query, summary: "", results: [], error: "搜索词为空" });
    }

    // 课堂安全词过滤
    var blocked = checkSafeSearch(query);
    if (blocked) {
      return Promise.resolve({ ok: false, blocked: true, query: query, summary: "", results: [], error: "搜索内容包含不适合课堂的关键词，已被安全过滤拦截。" });
    }

    // ①② 并行尝试（谁先有结果用谁，①优先），总耗时 = max(①,②) + ③
    return Promise.all([deepseekWebSearch(query), bingWikiSearch(query)]).then(function (rs) {
      var ds = rs[0], bw = rs[1];
      if (ds) {
        return { ok: true, mode: "deepseek", query: query, summary: ds.text, results: ds.citations };
      }
      if (bw && bw.ok && bw.results && bw.results.length) return bw;
      // ③ 两级联网来源都没拿到 → 大模型知识兜底（如实标注，不冒充搜索结果）
      return knowledgeFallback(query);
    }).then(function (res) {
      /* 三级都没成时，把每一级的原因写进 error——老师一眼能看出卡在哪一步 */
      if (res && res.error) {
        var t = searchTraceText();
        if (t) res.error = res.error + "\n（诊断：" + t + "）";
      }
      return res;
    });
  }

  /* ② 必应 RSS（多端点 × 多代理并行）+ Wikipedia 备用；都空则交给 ③ 知识兜底 */
  function bingWikiSearch(query) {
    searchTraceMark("② 必应/维基百科：开始尝试");
    var bingPromise = searchBingRSS(query);
    // 备用：Wikipedia（限时 8 秒，失败不影响主流程）
    var wikiPromise = searchWikipedia(query).catch(function () { return { title: "", summary: "", url: "" }; });

    return Promise.all([bingPromise, wikiPromise]).then(function (results) {
      var bing = results[0];
      var wiki = results[1];

      var allResults = [];
      var summary = "";

      // Wikipedia 摘要（如果有，放最前面）
      if (wiki.summary) {
        summary = wiki.summary;
        allResults.push({
          title: wiki.title || query + " - 维基百科",
          snippet: wiki.summary,
          url: wiki.url,
          source: "维基百科"
        });
      }

      // 必应搜索结果
      if (bing && bing.length > 0) {
        bing.forEach(function (r) {
          // 避免重复（维基百科结果已经加了）
          if (wiki.summary && r.title && r.title.indexOf("维基百科") >= 0) return;
          allResults.push({
            title: r.title,
            snippet: r.description,
            url: r.link,
            source: "必应搜索"
          });
        });
      }

      // 如果没有 Wikipedia 摘要，用第一个必应结果的描述作为 summary
      if (!summary && allResults.length > 0 && allResults[0].snippet) {
        summary = allResults[0].snippet.substring(0, 200);
      }

      if (allResults.length === 0) {
        searchTraceMark("② 必应/维基百科：没有拿到任何结果");
        return { ok: false, query: query, summary: "", results: [], error: "必应与维基百科都没有返回结果" };
      }

      return {
        ok: true,
        query: query,
        summary: summary,
        results: allResults.slice(0, 8)
      };
    }).catch(function (e) {
      searchTraceMark("② 必应/维基百科：请求失败（" + ((e && e.message) || "网络错误") + "）");
      return { ok: false, query: query, summary: "", results: [], error: "必应与维基百科请求失败" };
    });
  }

  /* Wikipedia 搜索（支持 CORS，origin=* 允许跨域；作为备用，国内可能不可用，限时 8 秒） */
  function searchWikipedia(query) {
    var url = WIKIPEDIA_API +
      "?action=query" +
      "&list=search" +
      "&srsearch=" + encodeURIComponent(query) +
      "&srlimit=1" +
      "&format=json" +
      "&origin=*";

    return get(url, 8000).then(function (data) {
      if (data && data.query && data.query.search && data.query.search.length > 0) {
        var page = data.query.search[0];
        var title = page.title;
        // 获取页面摘要
        var extractUrl = WIKIPEDIA_API +
          "?action=query" +
          "&prop=extracts" +
          "&exintro=1" +
          "&explaintext=1" +
          "&titles=" + encodeURIComponent(title) +
          "&format=json" +
          "&origin=*";
        return get(extractUrl, 8000).then(function (edata) {
          var pages = edata && edata.query && edata.query.pages;
          var extract = "";
          if (pages) {
            for (var pid in pages) {
              if (pages[pid].extract) {
                extract = pages[pid].extract;
                break;
              }
            }
          }
          // 摘要截断到 300 字
          if (extract.length > 300) extract = extract.substring(0, 300) + "...";
          return {
            title: title,
            summary: extract,
            url: "https://zh.wikipedia.org/wiki/" + encodeURIComponent(title)
          };
        }).catch(function () {
          return { title: title, summary: page.snippet || "", url: "" };
        });
      }
      return { title: "", summary: "", url: "" };
    }).catch(function () {
      return { title: "", summary: "", url: "" };
    });
  }

  /* ---------- 真实天气（Open-Meteo：免费、无需 Key、支持 CORS） ----------
   * 两步：① 地名 → 经纬度（geocoding）；② 经纬度 → 未来 8 天预报。
   * 所有数据均为真实气象数据，失败时抛出/返回错误，绝不生成模拟值。 */
  var GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
  var WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

  function geocode(city) {
    var url = GEO_URL + "?name=" + encodeURIComponent(city) +
      "&count=1&language=zh&format=json";
    return get(url).then(function (data) {
      if (data && data.results && data.results.length) return data.results[0];
      return null;
    });
  }

  /**
   * 查询真实天气
   * @param {string} city    城市名（中文，如“北京”）
   * @param {string} dateKey 日期口径：今天 / 明天 / 后天 / 明早 / 明晚 / 周末 / 下周
   * @returns {Promise<Object>} { ok, city, date, condition, tempLow, tempHigh,
   *                             wind, rainProb, isRain, suggest, text, source }
   */
  function getWeather(city, dateKey) {
    city = city || AgentLab.CONFIG.defaultCity;
    var off = AgentLab.dayOffset(dateKey);

    return geocode(city).then(function (place) {
      if (!place) {
        return { ok: false, city: city, date: off.label, error: "没有找到城市“" + city + "”的位置信息" };
      }
      var url = WEATHER_URL +
        "?latitude=" + place.latitude + "&longitude=" + place.longitude +
        "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max" +
        "&timezone=" + encodeURIComponent("Asia/Shanghai") + "&forecast_days=8";

      return get(url).then(function (d) {
        var dly = d && d.daily;
        if (!dly || !dly.time || !dly.time.length) {
          return { ok: false, city: city, date: off.label, error: "天气服务没有返回数据" };
        }
        var idx = Math.min(Math.max(off.offset, 0), dly.time.length - 1);
        var wt = AgentLab.wmoText(dly.weather_code[idx]);
        var tHigh = Math.round(dly.temperature_2m_max[idx]);
        var tLow = Math.round(dly.temperature_2m_min[idx]);
        var rainProb = (dly.precipitation_probability_max && dly.precipitation_probability_max[idx] != null)
          ? dly.precipitation_probability_max[idx] : null;
        var wind = AgentLab.windLevel(dly.wind_speed_10m_max[idx] || 0);
        var dateISO = dly.time[idx];
        var cityName = place.name || city;
        var suggest = AgentLab.weatherSuggest(wt.text, wt.isRain, tHigh, tLow);
        var text = cityName + "·" + off.label + "（" + dateISO + "）：" + wt.text +
          "，" + tLow + "~" + tHigh + "℃" +
          (rainProb != null ? "，降水概率" + rainProb + "%" : "") +
          "，风力" + wind;

        return {
          ok: true, city: cityName, date: off.label, dateISO: dateISO,
          condition: wt.text, tempLow: tLow, tempHigh: tHigh, wind: wind,
          rainProb: rainProb, isRain: wt.isRain, suggest: suggest, text: text,
          source: "Open-Meteo 实时天气"
        };
      });
    }).catch(function (e) {
      return {
        ok: false, city: city, date: off.label,
        error: "联网查询天气失败：" + (e.message || "网络错误") + "（请检查网络后重试）"
      };
    });
  }

  /* ---------- 云端能力（语音识别 + 图片识别共用同一个硅基流动 Key） ---------- */
  function getCloudKey() {
    var c = AgentLab.Store.getCloud();
    return (c && c.key) || "";
  }

  function hasCloudKey() {
    return getCloudKey().length > 10;
  }

  function getAsrSettings() {
    var d = AgentLab.CONFIG.asr;
    return { model: d.model, url: d.url, maxSeconds: d.maxSeconds };
  }

  function getOcrSettings() {
    var d = AgentLab.CONFIG.ocr;
    return { model: d.model, url: d.url, maxSide: d.maxSide };
  }

  /* 把云端接口的失败翻译成学生/老师看得懂的中文提示 */
  function explainCloudError(err, action) {
    var status = err && err.status;
    var msg = (err && err.message) || "";

    if (status === 401 || /401|unauthorized|invalid.*key/i.test(msg)) {
      return action + "密钥无效：请点右上角「设置」，检查硅基流动 API Key 是否正确（注意别有多余空格）。";
    }
    if (status === 402 || /insufficient|balance|余额|quota|402/i.test(msg)) {
      return action + "账户余额不足（硅基流动按量计费）：请登录 cloud.siliconflow.cn 充值——" +
        "语音识别和图片识别都会因为没有余额而不可用；新用户赠送额度用完也会出现这个提示。";
    }
    if (status === 429 || /429|rate limit|频率/i.test(msg)) {
      return action + "调用太频繁了（429），请稍等几秒再试。";
    }
    if (status === 400 || /400|model|invalid_request/i.test(msg)) {
      return action + "请求被拒绝：" + (msg || "参数或模型名有问题") +
        "；如果提示 Model does not exist，说明该模型已被平台下线，请把 js/config.js 里的模型名换成当前可用模型。";
    }
    if (/Failed to fetch|NetworkError|TypeError|CORS|Load failed/i.test(msg)) {
      return "无法连接" + action + "服务：网络不通或被浏览器跨域策略拦截。请检查网络后重试，或使用实验室的「示例演示」。";
    }
    return action + "失败：" + (msg || "未知错误");
  }

  /**
   * 语音转文字：把音频 POST 到 OpenAI 兼容的 /audio/transcriptions 接口
   * @param {Blob} audioBlob 音频数据（默认传 WAV，兼容性最好）
   * @returns {Promise<string>} 识别出的文字
   */
  function transcribe(audioBlob) {
    if (!hasCloudKey()) {
      return Promise.reject(new Error("NO_CLOUD_KEY"));
    }
    var s = getAsrSettings();
    var fd = new FormData();
    fd.append("file", audioBlob, "speech.wav");
    fd.append("model", s.model);

    // 注意：不要手动设置 Content-Type，浏览器会自动补 multipart 边界
    return fetchTO(s.url, {
      method: "POST",
      headers: { Authorization: "Bearer " + getCloudKey() },
      body: fd
    }, 60000, "语音识别服务").then(function (resp) {
      if (!resp.ok) {
        return resp.text().catch(function () { return ""; }).then(function (t) {
          var err = new Error("HTTP " + resp.status + (t ? "：" + t.slice(0, 200) : ""));
          err.status = resp.status;
          throw err;
        });
      }
      return resp.json();
    }).then(function (j) {
      if (!j) return "";
      return String(j.text || j.result || "").trim();
    }).catch(function (err) {
      if (err && err.message === "NO_CLOUD_KEY") throw err;
      throw new Error(explainCloudError(err, "语音识别"));
    });
  }

  /**
   * 图片文字识别（OCR）：用视觉大模型读图，返回图中文字
   * @param {string} dataUrl 图片的 dataURL（建议已压缩）
   * @returns {Promise<string>} 识别出的文字
   */
  function ocrImage(dataUrl) {
    if (!hasCloudKey()) {
      return Promise.reject(new Error("NO_CLOUD_KEY"));
    }
    var s = getOcrSettings();
    var body = {
      model: s.model,
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: "请把这张图片里的所有文字完整、准确地提取出来，尽量保持原有的分行与先后顺序。" +
                  "只输出文字内容本身，不要添加任何解释、标题、编号或总结。" +
                  "如果图片里没有文字，就只回复：未识别到文字。"
          },
          { type: "image_url", image_url: { url: dataUrl } }
        ]
      }],
      temperature: 0.1,
      max_tokens: 1500
    };

    return post(s.url, body, { Authorization: "Bearer " + getCloudKey() })
      .then(extractContent)
      .then(function (text) {
        return String(text || "")
          .replace(/^```[a-z]*\s*\n?/i, "")
          .replace(/\n?```\s*$/, "")
          .replace(/[ \t]+\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      })
      .catch(function (err) {
        if (err && err.message === "NO_CLOUD_KEY") throw err;
        throw new Error(explainCloudError(err, "图片识别"));
      });
  }

  /* ---------- LLM 分词器计数（Token 化实验的主口径） ----------
   * 走 chat 接口读 usage.prompt_tokens。难点：它包含对话模板的固定开销
   * （角色标记、im_start/im_end 等）。处理：模板开销是常量——
   * 用单字“你”（任何 LLM 词典里都是 1 个 Token）探测一次并缓存，
   * 之后 真实计数 = prompt_tokens - 开销。
   * 这样得到的就是文本本身在该 LLM 分词器下的 Token 数；这类分词器
   * 对中文做过词级合并（“人工智能”≈1~2 个 Token），和课堂口径一致。
   * @param {string} text
   * @returns {Promise<{count:number, model:string}>} */
  var tokenOverhead = null;   // { model, value } —— 模板开销缓存（跨刷新存 sessionStorage）

  function tokenOverheadOf(model) {
    if (tokenOverhead && tokenOverhead.model === model) return tokenOverhead.value;
    try {
      var saved = JSON.parse(sessionStorage.getItem("agentlab_token_overhead_v1") || "null");
      if (saved && saved.model === model && typeof saved.value === "number") {
        tokenOverhead = saved;
        return saved.value;
      }
    } catch (e) { }
    return null;
  }

  function tokenOverheadSave(model, value) {
    tokenOverhead = { model: model, value: value };
    try { sessionStorage.setItem("agentlab_token_overhead_v1", JSON.stringify(tokenOverhead)); } catch (e) { }
  }

  function chatTokenCount(text) {
    if (!hasCloudKey()) {
      return Promise.reject(new Error("未配置「云端能力密钥」"));
    }
    var cfg = (AgentLab.CONFIG && AgentLab.CONFIG.cloud) || {};
    var url = (cfg.url || "https://api.siliconflow.cn/v1") + "/chat/completions";
    var model = cfg.tokenChatModel || "Qwen/Qwen2.5-7B-Instruct";
    function call(content) {
      return post(url, {
        model: model,
        messages: [{ role: "user", content: content }],
        max_tokens: 1,          // 只要计数，不要它真的回答
        temperature: 0
      }, { Authorization: "Bearer " + getCloudKey() }, 20000, "分词计数服务").then(function (data) {
        var u = data && data.usage;
        if (!u || typeof u.prompt_tokens !== "number") throw new Error("接口没有返回分词计数");
        return u.prompt_tokens;
      });
    }
    var overhead = tokenOverheadOf(model);
    function finish(n) {
      return { count: Math.max(1, n - (overhead || 0)), model: model };
    }
    if (overhead != null) {
      return call(String(text || "")).then(finish).catch(function (err) {
        if (/未配置/.test((err && err.message) || "")) throw err;
        throw new Error(explainCloudError(err, "分词计数"));
      });
    }
    /* 先用单字“你”探测模板开销，再测正文（两次调用，开销只探测一次） */
    return call("你").then(function (probe) {
      overhead = Math.max(0, probe - 1);
      tokenOverheadSave(model, overhead);
      return call(String(text || ""));
    }).then(finish).catch(function (err) {
      if (/未配置/.test((err && err.message) || "")) throw err;
      throw new Error(explainCloudError(err, "分词计数"));
    });
  }

  /* ---------- 本地真实分词器（Token 化实验：真实切分） ----------
   * 背景：硅基流动等 OpenAI 兼容接口只返回 Token 数量，不返回切分边界；
   * 而课堂需要“具体切分”。方案：用 transformers.js 在浏览器本地加载
   * Qwen2.5 的词表（约 11MB，走 hf-mirror / ModelScope 国内镜像，
   * 浏览器缓存后二次秒开），做真实 BPE 切分——
   * 每个 Token 的文本、总数量都是真实的，且不需要任何密钥。 */
  var TOKENIZER_LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5";
  var TOKENIZER_MIRRORS = [
    { name: "hf-mirror", host: "https://hf-mirror.com/", template: null, revision: "main" },
    { name: "modelscope", host: "https://modelscope.cn/", template: "models/{model}/resolve/{revision}/", revision: "master" }
  ];
  var tokenizerState = { status: "idle", model: null, mirror: null, progress: null, tk: null, promise: null };

  function loadTokenizerLib() {
    return import(TOKENIZER_LIB).then(function (T) {
      T.env.allowLocalModels = false;   // 跳过本地路径探测，直接走镜像
      return T;
    });
  }

  /** 预加载/获取本地分词器（词表只加载一次，失败后可重试）
   * @param {Function} [onProgress] 收到 { pct } 时回调（词表下载进度） */
  function getLocalTokenizer(onProgress) {
    if (tokenizerState.promise) return tokenizerState.promise;
    var model = (AgentLab.CONFIG.cloud && AgentLab.CONFIG.cloud.tokenChatModel) || "Qwen/Qwen2.5-7B-Instruct";
    tokenizerState.model = model;
    tokenizerState.status = "loading";
    tokenizerState.progress = null;
    tokenizerState.promise = loadTokenizerLib().then(function (T) {
      function attempt(i) {
        var m = TOKENIZER_MIRRORS[i];
        if (!m) throw new Error("词表镜像全部不可达（请检查网络）");
        T.env.remoteHost = m.host;
        T.env.remotePathTemplate = m.template || "{model}/resolve/{revision}/";
        tokenizerState.mirror = m.name;
        return T.AutoTokenizer.from_pretrained(model, {
          revision: m.revision,
          progress_callback: function (p) {
            if (p && p.status === "progress" && p.file && (p.file.indexOf("tokenizer.json") + 1)) {
              tokenizerState.progress = { pct: p.progress != null ? p.progress : (p.total ? Math.round(p.loaded / p.total * 100) : 0) };
              if (onProgress) { try { onProgress(tokenizerState.progress); } catch (e) { } }
            }
          }
        }).then(function (tk) {
          tokenizerState.status = "ready";
          tokenizerState.tk = tk;
          return tk;
        }, function () {
          return attempt(i + 1);   // 这个镜像不行，换下一个
        });
      }
      return attempt(0);
    }).catch(function (err) {
      tokenizerState.status = "error";
      tokenizerState.promise = null;   // 失败后允许重试
      throw err;
    });
    return tokenizerState.promise;
  }

  /** 真实切分：返回每个 Token 的文本与总数量 */
  function localTokenize(text, onProgress) {
    return getLocalTokenizer(onProgress).then(function (tk) {
      var out = tk.encode(text, { add_special_tokens: false });
      var ids = (out && out.input_ids) ? out.input_ids : out;
      var pieces = [];
      for (var i = 0; i < ids.length; i++) pieces.push(tk.decode([ids[i]]));
      return { count: ids.length, pieces: pieces, model: tokenizerState.model };
    });
  }

  function tokenizerStatus() {
    return { status: tokenizerState.status, progress: tokenizerState.progress, model: tokenizerState.model, mirror: tokenizerState.mirror };
  }

  /* 课堂安全词过滤 */
  function checkSafeSearch(query) {
    var blockedWords = [
      "暴力", "血腥", "色情", "黄色", "赌博", "毒品",
      "自杀", "自残", "恐怖", "炸弹", "武器", "枪支",
      "fuck", "shit", "porn", "sex", "drug", "kill"
    ];
    var lower = query.toLowerCase();
    for (var i = 0; i < blockedWords.length; i++) {
      if (lower.indexOf(blockedWords[i].toLowerCase()) >= 0) {
        return true;
      }
    }
    return false;
  }

  return {
    chat: chat,
    ask: ask,
    askSmall: askSmall,
    search: search,
    searchDebug: function () { return searchTrace.slice(); },
    getWeather: getWeather,
    transcribe: transcribe,
    ocrImage: ocrImage,
    chatTokenCount: chatTokenCount,
    localTokenize: localTokenize,
    tokenizerStatus: tokenizerStatus,
    preloadTokenizer: function () { return getLocalTokenizer(null).catch(function () { }); },
    getSettings: getSettings,
    hasApiKey: hasApiKey,
    getCloudKey: getCloudKey,
    hasCloudKey: hasCloudKey,
    getAsrSettings: getAsrSettings,
    getOcrSettings: getOcrSettings,
    DEEPSEEK_URL: DEEPSEEK_URL
  };
})();
