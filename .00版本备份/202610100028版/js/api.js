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

  function post(url, body, headers, timeoutMs) {
    var h = { "Content-Type": "application/json" };
    for (var k in (headers || {})) h[k] = headers[k];
    return fetchTO(url, {
      method: "POST",
      headers: h,
      body: JSON.stringify(body)
    }, timeoutMs || 60000, "大模型服务").then(function (resp) {
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
      if (status === 401 || /401|Invalid|Authentication|api key|API key/i.test(msg || "")) {
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
      // 其他
      throw new Error("大模型调用失败：" + (msg || "未知错误"));
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

  /* ---------- 联网搜索（必应 RSS + CORS 代理，国内可用） ---------- */
  /**
   * 联网搜索：必应搜索 RSS（通过 allorigins CORS 代理）+ Wikipedia 备用
   * 主搜索源国内稳定可用，无需 API Key
   * @param {string} query 搜索词
   * @returns {Promise<{ok:boolean, blocked?:boolean, query:string, summary:string, results:Array}>}
   */
  function search(query) {
    query = (query || "").trim();
    if (!query) {
      return Promise.resolve({ ok: false, query: query, summary: "", results: [], error: "搜索词为空" });
    }

    // 课堂安全词过滤
    var blocked = checkSafeSearch(query);
    if (blocked) {
      return Promise.resolve({ ok: false, blocked: true, query: query, summary: "", results: [], error: "搜索内容包含不适合课堂的关键词，已被安全过滤拦截。" });
    }

    // 主搜索：必应 RSS（通过 CORS 代理）
    var bingPromise = searchBingRSS(query);
    // 备用：Wikipedia（如果网络支持）
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
      if (bing.results && bing.results.length > 0) {
        bing.results.forEach(function (r) {
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
        return {
          ok: false,
          query: query,
          summary: "",
          results: [],
          error: "未搜索到相关结果，试试换个关键词？"
        };
      }

      return {
        ok: true,
        query: query,
        summary: summary,
        results: allResults.slice(0, 8)
      };
    }).catch(function (e) {
      return {
        ok: false,
        query: query,
        summary: "",
        results: [],
        error: "联网搜索失败：" + (e.message || "网络错误") + "（静态版使用必应搜索，如网络受限可稍后重试）"
      };
    });
  }

  /* 必应搜索 RSS（通过 allorigins CORS 代理，国内可用） */
  function searchBingRSS(query) {
    var bingUrl = "https://www.bing.com/search?q=" + encodeURIComponent(query) + "&format=rss";
    var proxyUrl = "https://api.allorigins.win/get?url=" + encodeURIComponent(bingUrl);

    return get(proxyUrl).then(function (data) {
      if (!data || !data.contents) {
        return { results: [] };
      }
      // 解析 RSS XML
      var parser = new DOMParser();
      var xmlDoc = parser.parseFromString(data.contents, "text/xml");
      var items = xmlDoc.getElementsByTagName("item");
      var results = [];

      for (var i = 0; i < items.length && i < 10; i++) {
        var item = items[i];
        var title = item.getElementsByTagName("title")[0];
        var link = item.getElementsByTagName("link")[0];
        var desc = item.getElementsByTagName("description")[0];

        var titleText = title ? title.textContent : "";
        var linkText = link ? link.textContent : "";
        var descText = desc ? desc.textContent : "";

        // 清理 HTML 标签
        descText = descText.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();

        if (titleText && linkText) {
          results.push({
            title: titleText,
            link: linkText,
            description: descText.substring(0, 300)
          });
        }
      }
      return { results: results };
    }).catch(function () {
      return { results: [] };
    });
  }

  /* Wikipedia 搜索（支持 CORS，origin=* 允许跨域；作为备用，国内可能不可用） */
  function searchWikipedia(query) {
    var url = WIKIPEDIA_API +
      "?action=query" +
      "&list=search" +
      "&srsearch=" + encodeURIComponent(query) +
      "&srlimit=1" +
      "&format=json" +
      "&origin=*";

    return get(url).then(function (data) {
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
        return get(extractUrl).then(function (edata) {
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
    getWeather: getWeather,
    transcribe: transcribe,
    ocrImage: ocrImage,
    getSettings: getSettings,
    hasApiKey: hasApiKey,
    getCloudKey: getCloudKey,
    hasCloudKey: hasCloudKey,
    getAsrSettings: getAsrSettings,
    getOcrSettings: getOcrSettings,
    DEEPSEEK_URL: DEEPSEEK_URL
  };
})();
