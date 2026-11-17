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

  /* 当前使用的模型：一律以 config.js 里系统统一配置的为准
   * （现在是 DeepSeek V4.1 Flash 1017）。
   * 不再读浏览器里存的旧模型名——升级版本后所有人都会自动用上新模型，
   * 不会被上次保存的 `deepseek-v4-flash` 卡在旧版本上。
   * activeModel 只在“接口明确说这个模型名不被支持”时才会被换成备用名（见 postModel）。 */
  var activeModel = "";

  function currentModel() {
    return activeModel || AgentLab.CONFIG.model || "deepseek-flash";
  }

  function getSettings() {
    var api = AgentLab.Store.getApi();
    return {
      key: (api && api.key) || "",
      model: currentModel()
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

  /* ---------- 模型名兜底（只在“接口明确说这个模型名不被支持”时触发） ----------
   * 场景：账号或接口版本还没放出 config.js 里配的最新模型名。接口会明确回一句
   *   “The supported API model names are A, B, but you passed X.”
   * 这时从接口给出的可用清单里，挑一个和 CONFIG.modelFallbacks 顺序最接近的顶上，
   * 让课堂不中断；其余错误（Key / 余额 / 网络 / 参数）一律原样抛出，绝不偷偷换模型。
   * 换完只记在内存里（不写 localStorage），刷新页面会再按最新模型试一次。 */
  function pickFallbackModel(err) {
    var msg = String((err && err.message) || "");
    var cur = currentModel();
    var listM = msg.match(/supported\s+API\s+model\s+names\s+are\s+(.+?)\s*,\s*but\s+you\s+passed/i);
    if (!listM) {
      if (/model\s+(does\s+not\s+exist|not\s+found)|unknown\s+model|模型不存在/i.test(msg)) {
        var fbs = AgentLab.CONFIG.modelFallbacks || [];
        for (var i = 0; i < fbs.length; i++) if (fbs[i] !== cur) return fbs[i];
      }
      return null;
    }
    var available = listM[1].split(/\s*(?:,|and)\s*/).filter(Boolean);
    var prefs = (AgentLab.CONFIG.modelFallbacks || []).concat(["deepseek-chat"]);
    for (var p = 0; p < prefs.length; p++) {
      if (prefs[p] !== cur && available.indexOf(prefs[p]) >= 0) return prefs[p];
    }
    for (var j = 0; j < available.length; j++) if (available[j] !== cur) return available[j];
    return null;
  }

  /* 带“模型名兜底”的 POST：请求失败且错误是“模型名不被支持”时，
   * 换下一个可用模型重发一次；其他错误照原样抛给上层。 */
  function postModel(url, body, headers, timeoutMs, what) {
    return post(url, body, headers, timeoutMs, what).catch(function (err) {
      var next = pickFallbackModel(err);
      if (!next) throw err;
      activeModel = next;
      if (body && typeof body === "object") body.model = next;
      return post(url, body, headers, timeoutMs, what);
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

  /* ---------- 流式响应读取（SSE）：把逐字增量喂给上层 ----------
   * 用于「调用大模型」实验卡的“流式返回”模式：一行 data: {...} 一段，以 data: [DONE] 收尾。
   * onChunk(deltaText) 每收到一段就回调（打字机效果）；onDone(err) 在结束时回调一次。 */
  function readSSE(resp, handlers) {
    handlers = handlers || {};
    var onChunk = handlers.onChunk, onRaw = handlers.onRaw, onDone = handlers.onDone;
    var reader = resp.body.getReader();
    var decoder = new TextDecoder("utf-8");
    var buf = "";
    var finished = false;
    function emit(payload) {
      /* 先把原始 SSE 载荷原样抛给界面（让学生看见 data: {...} 这种分帧格式），
       * 再解析出增量文本用于打字机效果。 */
      if (onRaw) onRaw(payload);
      try {
        var obj = JSON.parse(payload);
        var delta = (obj.choices && obj.choices[0] && obj.choices[0].delta) || {};
        var piece = "";
        if (delta.content) piece += delta.content;
        if (delta.tool_calls) delta.tool_calls.forEach(function (tc) {
          if (tc.function && tc.function.arguments) piece += tc.function.arguments;
        });
        if (piece && onChunk) onChunk(piece);
      } catch (e) { }
    }
    function finish(err) {
      if (finished) return;
      finished = true;
      if (!err) {
        var rest = buf.trim();
        if (rest && rest.indexOf("data:") === 0) {
          var p = rest.slice(5).trim();
          if (p && p !== "[DONE]") emit(p);
        }
      }
      onDone && onDone(err);
    }
    function handleLine(line) {
      line = line.trim();
      if (!line || line.indexOf("data:") !== 0) return false;
      var payload = line.slice(5).trim();
      if (payload === "[DONE]") {
        if (onRaw) onRaw("[DONE]");
        finish();
        return true;
      }
      emit(payload);
      return false;
    }
    function step() {
      return reader.read().then(function (r) {
        if (r.done) { finish(); return; }
        buf += decoder.decode(r.value, { stream: true });
        var parts = buf.split("\n");
        buf = parts.pop();
        for (var i = 0; i < parts.length; i++) {
          if (handleLine(parts[i])) return;
        }
        return step();
      }, function (e) { finish(e); });
    }
    return step();
  }

  /* ---------- 原始请求转发（教学专用：把“发出去的请求”真的发出去） ----------
   * 供「怎么调用大模型 / Function Calling」实验卡的“请求 ↔ 响应”对照使用：
   * 在浏览器里带着用户设置里填的真实 Key，把 req 原样发到接口，拿回真实响应。
   * req = { method, url, headers:[{k,v}], body }；占位 Authorization 会被真实 Key 覆盖。
   * opts.onChunk：流式模式时，每收到一段增量文本就回调（打字机效果）。
   * opts.onRaw：流式模式时，回调每一帧的原始 SSE 载荷（"data:" 后的内容），用于展示真实分帧格式。 */
  function callRaw(req, opts) {
    opts = opts || {};
    if (!hasApiKey()) {
      return Promise.reject(new Error("尚未配置 DeepSeek API Key：点右上角「设置」填写后即可使用。"));
    }
    var s = getSettings();
    var headers = { "Content-Type": "application/json" };
    /* 始终用用户在设置里填的真实 Key 覆盖 Authorization：
     * 请求里那个 “Bearer sk-●●●●●●●●” 只是教学占位符，绝不能真的发到网上。 */
    (req.headers || []).forEach(function (h) { headers[h.k] = h.v; });
    headers["Authorization"] = "Bearer " + s.key;

    var url = req.url || DEEPSEEK_URL;
    var body = req.body || {};
    var isStream = !!body.stream;

    /* 真正发出前先关掉思考模式（DeepSeek 官方支持的写法）。
     * 会写进 body，所以界面左侧展示的请求体与真实发送的完全一致。 */
    var hasThinkingSwitch = disableThinking(url, body);

    function doPost(b) {
      return fetchTO(url, {
        method: (req.method || "POST"),
        headers: headers,
        body: JSON.stringify(b)
      }, opts.timeoutMs || 60000, "大模型服务").then(function (resp) {
        if (!resp.ok) {
          return resp.json().catch(function () { return {}; }).then(function (j) {
            var detail = (j && j.error && j.error.message) ||
                         (j && j.message) ||
                         (j && j.error) ||
                         (j && j.code ? ("错误码 " + j.code) : "");
            var err = new Error(detail || ("请求失败 HTTP " + resp.status));
            err.status = resp.status; err.code = j && j.code;
            throw err;
          });
        }
        if (isStream && (opts.onChunk || opts.onRaw)) {
          return readSSE(resp, opts);
        }
        return resp.json();
      });
    }

    /* 兜底：模型不认 thinking 这个字段时会 400。
       * 只在"本来就打算关掉思考"（type=disabled / effort=none）时才允许去掉重发——
       * 不发这个字段同样是不思考，语义完全一致，学生的意图没有被改变。
       * 反过来，如果学生明确要"开启思考"，就必须把真实报错显示出来：
       * "这个模型不支持思考模式"本身就是这节课要给出的结论，不能悄悄降级骗过去。
       * 另外这里只在响应还没开始流式输出时才重试，不会造成重复显示。 */
    var canFallback = hasThinkingSwitch &&
      ((body.thinking && body.thinking.type === "disabled") ||
       (body.reasoning && body.reasoning.effort === "none"));

    /* 先把“模型名不被支持”这一种错误按 config.js 的兜底清单换一次模型，
     * 之后再处理“思考模式字段不被支持”的情况。 */
    function send(b) {
      return doPost(b).catch(function (err) {
        var next = pickFallbackModel(err);
        if (!next) throw err;
        activeModel = next;
        b.model = next;
        return doPost(b);
      });
    }

    return send(body).catch(function (err) {
      var msg = (err && err.message) || "";
      if (canFallback && err && /thinking|reasoning/i.test(msg)) {
        delete body.thinking;
        delete body.reasoning;
        return send(body);
      }
      throw err;
    });
  }

  /* ---------- DeepSeek 思考模式开关 ----------
   * 官方两套格式（别用 enable_thinking，那是 Qwen3 等网关的约定，不属于 DeepSeek）：
   *   · chat/completions → {"thinking": {"type": "enabled" | "disabled"}}
   *   · Responses API     → {"reasoning": {"effort": "none" | "low" | "high" | "max"}}
   * 这里统一关成“不思考”：和智能体实验室的 agent 行为一致——直接决策（含要不要调工具），
   * 不先走一段思维链。注意思考模式与 tools 是两条独立能力，关掉思考不影响调用工具。
   * 调用方若已显式写了 thinking / reasoning，则尊重其设置不覆盖。 */
  function disableThinking(url, body) {
    if (!/api\.deepseek\.com/i.test(url || "")) return false;
    if (!body || typeof body !== "object") return false;
    if (/\/responses/i.test(url)) {
      if (body.reasoning) return true;
      body.reasoning = { effort: "none" };
      return true;
    }
    if (body.thinking) return true;
    body.thinking = { type: "disabled" };
    return true;
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

    return postModel(DEEPSEEK_URL, body, auth).then(function (data) {
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
       * postModel 已经按 config.js 的兜底清单换过一轮模型；走到这里说明连备用名也对不上。
       * 直接把可用列表翻译出来，省得老师去猜。 */
      var supM = String(msg || "").match(
        /supported\s+API\s+model\s+names\s+are\s+(.+?)\s*,\s*but\s+you\s+passed/i);
      if (supM) {
        var list = supM[1].replace(/\s*(?:,|and)\s*/g, "、").trim();
        throw new Error("模型名不被接口支持：当前可用的是 " + list +
          "。请让开发者把 js/config.js 里的 model（以及 modelFallbacks）改成其中之一；" +
          "页面上不提供模型切换。");
      }
      if (/model/i.test(msg || "") &&
          /(not\s+exist|does\s+not\s+exist|unknown|invalid|不支持|不存在)/i.test(msg || "")) {
        throw new Error("模型名不被接口支持。请让开发者更新 js/config.js 里的 model" +
          "（系统已自动试过 modelFallbacks 里的备用名）。");
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
          "已自动尝试兼容写法仍未成功：请让开发者把 js/config.js 里的模型换成非思考模式的模型。");
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

  /* ---------- 联网搜索（DeepSeek 官方 Search & Fetch 为主，逐级降级） ----------
   * ① DeepSeek 官方接口（主力，用现有 DeepSeek Key）：
   *    POST /v1/tools/search —— 按 query 返回结构化网页结果（标题 / 摘要 / 链接 / 排序分）；
   *    POST /v1/tools/fetch  —— 按 url 返回网页标题 + Markdown 正文。
   *    两条都是 2026-10-17 上线的独立原始 JSON 接口，同一个 Key、同一套 Bearer 鉴权，
   *    不经过任何第三方搜索服务，也不受公共 CORS 代理可用性的影响。
   * ② 必应 RSS（多端点 × 多代理，各限时 6 秒）+ 维基百科备用——① 不可用时的下一条路。
   * ③ 都没拿到 → 若已配 DeepSeek Key，请大模型用“自己学过的知识”兜底，
   *    并在结果里如实标注“这不是刚查到的网页”，绝不冒充搜索结果。 */
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

  /* ③ 知识兜底的提示词：单独抽出来，因为「工具百宝箱」要把它原样展示给学生看
   *   （“这次到底给模型发了什么”）。两处必须是同一份，否则展示就成假的了。 */
  function knowledgeFallbackPrompt() {
    return "你是课堂上的“知识兜底”助手：联网搜索没有成功，请用你已有的知识回答。" +
      "要求：直接给出答案，不要写思考过程；用小学五年级学生听得懂的中文；不超过 150 字；" +
      "只讲你确定的事实，不要编造数字、年份或引用来源；如果不确定，就明确说不确定。";
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
    var sys = knowledgeFallbackPrompt();
    /* maxTokens 给足：DeepSeek V4.1 Flash 默认带思维链，额度太小会被思考过程吃光，
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

  /* ---------- DeepSeek 官方 Search & Fetch API（2026-10-17 上线，自研搜索引擎） ----------
   *   POST /v1/tools/search  { query, count, ori_question, need_content } → { results:[...] }
   *   POST /v1/tools/fetch   { url }                                      → { title, content }
   * 与对话接口同一个 Key、同一套 Bearer 鉴权，不经过任何第三方搜索服务。
   * 注意：这不是 /responses 的“内置工具”——那里只有 `web_search`、且只对 deepseek-v4-pro 开放，
   * 也没有 web_fetch。课堂用的是这两条独立的原始 JSON 接口：任何模型都能用，
   * 搜到的结果直接作为工具（执行器）的结果回给大脑，由大脑组织成回答。 */
  var SEARCH_API = (AgentLab.CONFIG.searchUrl) || "https://api.deepseek.com/v1/tools/search";
  var FETCH_API = (AgentLab.CONFIG.fetchUrl) || "https://api.deepseek.com/v1/tools/fetch";
  var FETCH_MAX_CHARS = 4000;   // 抓回来的正文截断长度：够模型判断，又不把上下文塞爆

  /* ---------- 搜索诊断 ----------
   * 三级来源逐级降级时，每一级“为什么没成”都记下来，
   * 全部失败时把这条轨迹写进工具消息——老师一眼就能看出卡在哪。 */
  var searchTrace = [];
  function searchTraceMark(s) { searchTrace.push(s); }
  function searchTraceText() {
    if (!searchTrace.length) return "";
    /* ①② 是并发发起的，写入顺序可能乱；按来源编号排一下，
     * 诊断串读起来才像“逐级降级：① 没成 → ② 没成 → ③ 兜底”。 */
    var order = { "①": 1, "②": 2, "③": 3 };
    return searchTrace.slice().sort(function (a, b) {
      return (order[a.charAt(0)] || 9) - (order[b.charAt(0)] || 9);
    }).join("；");
  }

  /* 把 Search / Fetch 接口的失败翻译成学生、老师都看得懂的中文 */
  function explainSearchError(err, action) {
    var status = err && err.status;
    var msg = (err && err.message) || "";
    if (status === 401 || /401|unauthorized|invalid.*key|authentication/i.test(msg)) {
      return action + "密钥无效：请点右上角「设置」，检查 DeepSeek API Key 是否正确（注意别有多余空格）。";
    }
    if (status === 402 || /insufficient|balance|余额|quota/i.test(msg)) {
      return action + "账户余额不足：请登录 platform.deepseek.com 充值。";
    }
    if (status === 429 || /429|rate limit|频率/i.test(msg)) {
      return action + "调用太频繁了（429），请稍等几秒再试。";
    }
    if (/Failed to fetch|NetworkError|Load failed|CORS|TypeError/i.test(msg)) {
      return action + "连不上：网络不通，或被浏览器的跨域策略拦截。";
    }
    return action + "失败：" + (msg || "未知错误");
  }

  /**
   * DeepSeek 官方网页搜索（POST /v1/tools/search，自研搜索引擎）
   * 返回来的是**接口原样的结构化结果**，不含任何模型“替学生总结过的话”。
   * @param {string} query 搜索词（接口上限 128 字符，这里截到 120）
   * @returns {Promise<{query:string, items:Array}|null>}
   *   null = 未配置 Key / 已关闭 / 请求失败 / 没有结果（原因记入 searchTrace）
   */
  function deepseekWebSearch(query) {
    if (!hasApiKey()) {
      searchTraceMark("① DeepSeek 搜索：未配置 Key，跳过");
      return Promise.resolve(null);
    }
    if (AgentLab.CONFIG.deepseekWebSearch === false) {
      searchTraceMark("① DeepSeek 搜索：已在 js/config.js 里关闭，跳过");
      return Promise.resolve(null);
    }
    var q = String(query || "").trim().slice(0, 120);
    if (!q) return Promise.resolve(null);

    /* 注意：必须带 Authorization——post 的第三个参数是“额外请求头”，
     * 早前一版这里传了 {}，导致请求不带鉴权，接口一律回 401。 */
    return post(SEARCH_API, {
      query: q,
      count: 8,             // 接口允许 1~50；课堂取 8 条足够
      ori_question: q,      // 原始问题有助于接口理解搜索意图
      need_content: false   // 正文用 fetch 单独取：这里只要摘要，避免一次塞进几万字
    }, { Authorization: "Bearer " + getSettings().key }, 20000, "DeepSeek 搜索服务")
      .then(function (data) {
        var list = (data && data.results) || [];
        if (!list.length) {
          searchTraceMark("① DeepSeek 搜索：接口正常，但没有搜到结果");
          return null;
        }
        searchTraceMark("① DeepSeek 搜索：成功（" + list.length + " 条结果）");
        return { query: q, items: list };
      })
      .catch(function (e) {
        searchTraceMark("① DeepSeek 搜索：" + explainSearchError(e, "联网搜索"));
        return null;
      });
  }

  /**
   * DeepSeek 官方网页抓取（POST /v1/tools/fetch）——同学直接给了一个网址时用。
   * 返回网页标题 + 正文（接口原样给 Markdown，这里截断到 FETCH_MAX_CHARS 字）。
   * @param {string} url      网页地址（http/https，≤8192 字符，不能带账号密码）
   * @param {string} [focus]  同学特别想知道什么（只写进工具消息，不影响接口）
   * @returns {Promise<{ok:boolean, url:string, title?:string, content?:string,
   *                    truncated?:boolean, error?:string}>}
   */
  function fetchPage(url, focus) {
    url = String(url || "").trim();
    if (!/^https?:\/\//i.test(url)) {
      return Promise.resolve({
        ok: false, url: url,
        error: "这不是一个有效的网页地址（要以 http:// 或 https:// 开头）。"
      });
    }
    if (url.length > 8192 || /^https?:\/\/[^/]*@/i.test(url)) {
      return Promise.resolve({ ok: false, url: url, error: "这个网址不符合抓取接口的要求（过长，或带了账号密码）。" });
    }
    if (checkSafeSearch(url)) {
      return Promise.resolve({ ok: false, blocked: true, url: url, error: "这个网址包含不适合课堂的内容，已被安全过滤拦截。" });
    }
    if (!hasApiKey()) {
      return Promise.resolve({
        ok: false, url: url,
        error: "尚未配置 DeepSeek API Key：点右上角「设置」填写后就能抓取网页。"
      });
    }
    if (AgentLab.CONFIG.deepseekWebFetch === false) {
      return Promise.resolve({ ok: false, url: url, error: "网页抓取已在 js/config.js 里关闭。" });
    }

    return post(FETCH_API, { url: url },
      { Authorization: "Bearer " + getSettings().key }, 25000, "DeepSeek 网页抓取服务")
      .then(function (data) {
        var title = (data && data.title) || "";
        var content = String((data && data.content) || "");
        if (!content) {
          return { ok: false, url: url, error: "接口没有返回网页正文（这一页可能是空的，或者打不开）。" };
        }
        var truncated = content.length > FETCH_MAX_CHARS;
        return {
          ok: true,
          url: url,
          title: title || url,
          content: truncated ? content.slice(0, FETCH_MAX_CHARS) : content,
          truncated: truncated,
          focus: focus || ""
        };
      })
      .catch(function (e) {
        return { ok: false, url: url, error: explainSearchError(e, "网页抓取") };
      });
  }

  /**
   * 联网搜索（三级来源，逐级降级，来源如实标注）
   * ① DeepSeek 官方搜索接口（POST /v1/tools/search，现有 Key，返回结构化网页结果）
   * ② 必应 RSS（多端点 × 多代理并行）+ Wikipedia 备用
   * ③ 大模型已有知识兜底（summary 里明确标注“不是刚查到的网页”）
   * @param {string} query 搜索词
   * @returns {Promise<{ok:boolean, mode?:string, blocked?:boolean, fallback?:boolean,
   *                     query:string, summary:string, results:Array, error?:string}>}
   *   mode="deepseek"      ① 成功：results 是接口原样的结构化网页结果（标题 / 摘要 / 链接）
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

    /* ①② 同时发出（②在后台跑，只为兜底），但**① 一回来就立刻返回**——
     * 不等必应/维基的超时，否则明明 1 秒搜到，学生还要干等 8 秒。
     * 只有 ① 没拿到结果时，才去等 ② 的现成结果。 */
    var dsPromise = deepseekWebSearch(query);
    var bwPromise = bingWikiSearch(query);

    return dsPromise.then(function (ds) {
      if (ds && ds.items && ds.items.length) {
        /* ① 成功：把接口原样的结果整理成统一形状（标题 / 摘要 / 链接 / 来源）。
         * - snippet 用接口的 summary（600~800 字，给模型读），没有才退回 snippet（100~200 字）
         * - 保留 rerank_score 与 authority：课堂上可以讲“搜索结果也有排序与权威度”。 */
        var mapped = ds.items.map(function (r) {
          return {
            title: r.title || r.url || "",
            snippet: r.summary || r.snippet || "",
            url: r.url || "",
            source: "DeepSeek 搜索" + (r.site_name ? "·" + r.site_name : ""),
            score: r.rerank_score,
            authority: r.authority,
            date: r.date
          };
        });
        return {
          ok: true, mode: "deepseek", query: query,
          summary: (mapped[0] && mapped[0].snippet ? mapped[0].snippet.slice(0, 200) : ""),
          results: mapped
        };
      }
      return bwPromise.then(function (bw) {
        if (bw && bw.ok && bw.results && bw.results.length) return bw;
        // ③ 两级联网来源都没拿到 → 大模型知识兜底（如实标注，不冒充搜索结果）
        return knowledgeFallback(query);
      });
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
    return { model: d.model, models: d.models, url: d.url, maxSide: d.maxSide };
  }

  /* 把云端接口的失败翻译成学生/老师看得懂的中文提示 */
  function explainCloudError(err, action) {
    var status = err && err.status;
    var msg = (err && err.message) || "";

    if (status === 401 || /401|unauthorized|invalid.*key/i.test(msg)) {
      return action + "密钥无效：请点右上角「设置」，检查硅基流动 API Key 是否正确（注意别有多余空格）。";
    }
    if (status === 402 || /insufficient|balance|余额|quota|402/i.test(msg)) {
      return action + "账户余额不足：" +
        (/图片|图像/.test(action)
          ? "视觉大模型是付费模型——语音识别用的 SenseVoice 是免费模型，不受余额影响，所以会出现“语音能用、图片不能用”。"
          : "该模型属于付费模型。") +
        "请登录 cloud.siliconflow.cn 查看余额并充值（新用户赠送额度用完也会出现这个提示）。";
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
    /* 模型按序兜底：主模型被平台下线（400/404/503 或 Model does not exist）时
     * 自动换下一个备用模型重试；密钥无效(401)/余额不足(402)/限流(429)这类
     * 与模型无关的错误不重试，直接翻译后抛给上层提示。
     * 条目支持跨服务商：字符串 = 硅基流动（云端 Key）；
     * 对象 { model, url, keyFrom:"main" } = 用 DeepSeek 主密钥调官方端点。 */
    var models = (s.models && s.models.length) ? s.models.map(function (m) {
      return (typeof m === "string")
        ? { model: m, url: s.url, keyFrom: "cloud" }
        : { model: m.model, url: m.url, keyFrom: m.keyFrom || "cloud", label: m.label };
    }) : [{ model: s.model, url: s.url, keyFrom: "cloud" }];
    var ocrPrompt = "请把这张图片里的所有文字完整、准确地提取出来，尽量保持原有的分行与先后顺序。" +
      "只输出文字内容本身，不要添加任何解释、标题、编号或总结。" +
      "如果图片里没有文字，就只回复：未识别到文字。";

    function buildBody(model) {
      return {
        model: model,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: ocrPrompt },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }],
        temperature: 0.1,
        max_tokens: 1500
      };
    }

    function isModelErr(err) {
      var m = (err && err.message) || "";
      return (err && (err.status === 400 || err.status === 404 || err.status === 503)) ||
        /model does not exist|model not found|no available model|模型不存在|invalid model/i.test(m);
    }

    /* 网络层快速失败（Failed to fetch / NetworkError 等，通常几秒内发生）：
     * 多为瞬时抖动，同一个模型立即重试一次；慢超时（60 秒）不重试，避免课堂久等 */
    function isNetErr(err) {
      return /Failed to fetch|NetworkError|Load failed|网络错误/i.test((err && err.message) || "");
    }

    function tryOnce(i, retried) {
      var entry = models[i];
      /* DeepSeek 官方兜底条目需要主密钥：未配置有效主 Key 就直接跳过该条 */
      if (entry.keyFrom === "main" && !hasApiKey()) {
        if (i + 1 < models.length) return tryOnce(i + 1, false);
        throw new Error("图片识别失败：所有识别通道均不可用（云端密钥与 DeepSeek 主密钥均未配置有效）");
      }
      var key = (entry.keyFrom === "main") ? getSettings().key : getCloudKey();
      /* DeepSeek 官方兜底条目走 postModel：万一账号侧还没放出最新模型名，
       * 会自动换 config.js 里 modelFallbacks 的备用名；硅基流动各条仍走 post，
       * 由下面的“换下一个模型”逻辑处理，避免把 DeepSeek 的模型名发到硅基流动。 */
      var poster = (entry.keyFrom === "main") ? postModel : post;
      /* 超时上限 60 秒：课堂节奏不宜久等；配合多模型兜底 + 网络快速失败重试使用 */
      return poster(entry.url, buildBody(entry.model), { Authorization: "Bearer " + key }, 60000, "图片识别服务")
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
          if (!retried && isNetErr(err)) return tryOnce(i, true);
          if (i + 1 < models.length && isModelErr(err)) return tryOnce(i + 1, false);
          throw new Error(explainCloudError(err, "图片识别"));
        });
    }

    return tryOnce(0, false);
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
    callRaw: callRaw,
    disableThinking: disableThinking,
    askSmall: askSmall,
    search: search,
    knowledgeFallbackPrompt: knowledgeFallbackPrompt,   // 「工具百宝箱」展示“知识兜底”那份提示词用
    fetchPage: fetchPage,          // DeepSeek 官方网页抓取（POST /v1/tools/fetch）
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
