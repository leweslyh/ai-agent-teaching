/* ============================================================
 * api.js —— 静态版：与 DeepSeek 大模型通信 + 联网搜索
 * 
 * 【静态部署说明】
 * - DeepSeek：浏览器直连 api.deepseek.com（官方支持 CORS 跨域）
 * - 联网搜索：Wikipedia API + DuckDuckGo Instant Answer（均支持 CORS，完全免费，无需 Key）
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
    return {
      key: (api && api.key) || "",
      model: (api && api.model) || AgentLab.CONFIG.model
    };
  }

  function hasApiKey() {
    var s = getSettings();
    return s.key && s.key.length > 10;
  }

  function post(url, body, headers) {
    var h = { "Content-Type": "application/json" };
    for (var k in (headers || {})) h[k] = headers[k];
    return fetch(url, {
      method: "POST",
      headers: h,
      body: JSON.stringify(body)
    }).then(function (resp) {
      if (!resp.ok) {
        return resp.json().catch(function () { return {}; }).then(function (j) {
          var detail = (j && j.error && j.error.message) ? j.error.message : (j && j.error);
          var err = new Error(detail || ("请求失败 HTTP " + resp.status));
          err.status = resp.status;
          throw err;
        });
      }
      return resp.json();
    });
  }

  function get(url) {
    return fetch(url).then(function (resp) {
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
   * @param {Array} messages [{role:'system'|'user'|'assistant', content}]
   * @returns {Promise<string>} 模型回复正文
   */
  function chat(messages) {
    // 检查 API Key
    if (!hasApiKey()) {
      return Promise.reject(new Error("NO_API_KEY"));
    }

    var s = getSettings();
    var body = {
      model: s.model,
      messages: messages,
      temperature: AgentLab.CONFIG.temperature,
      max_tokens: AgentLab.CONFIG.maxTokens
    };
    var auth = { Authorization: "Bearer " + s.key };

    return post(DEEPSEEK_URL, body, auth).then(extractContent).catch(function (err) {
      var msg = err && err.message;
      var status = err && err.status;

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

  /** 简化调用：传入提示词列表（system 可选） */
  function ask(systemPrompt, userText) {
    var messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: userText });
    return chat(messages);
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
    search: search,
    getSettings: getSettings,
    hasApiKey: hasApiKey,
    DEEPSEEK_URL: DEEPSEEK_URL
  };
})();
