/* ============================================================
 * lesson-tools.js —— 「工具调用小课堂」大屏课堂版（第08课）
 * ------------------------------------------------------------
 * 十张卡片直接写在 CARDS 里。本文件负责：
 *   ① 渲染十张卡（回顾三课 / 本课地图 / 一个接口长什么样 / 四步法 / 搜索抓取 / 出行小助手需求清单
 *      / 高德一把钥匙开很多门 / 请求↔响应（真实）/ 排错实录 / 编写与运行）
 *   ② 顶部十关导航 / 右下角上一张下一张
 *   ③ 大屏字号（0.85～1.5，记住选择）+ 全屏
 *   ④ 三处课堂小互动（搜索抓取切换、钥匙计数、四象限真实调用）
 *
 * 第 ⑧ 关是**真实调用**：模型自己决定要几轮（点单 → 拿结果 → 可能再点单 → 作答），
 * 中间由程序真的去调高德 Web 服务 API（接口地址、参数名、返回字段
 * 按 https://lbs.amap.com/api/webservice/summary 的开发指南），
 * 再把结果回填、问第二轮。所有展示内容都来自网络返回，不会假造。
 * ============================================================ */
(function () {
  var $ = function (id) { return document.getElementById(id); };

  var sec = $("sec-tools");
  if (!sec) return;

  /* 高德 Web 服务 API 官方文档（https://lbs.amap.com/api/webservice/summary 的开发指南目录）。
   * 第 ⑦ 关的清单、第 ⑧ 关的工具声明都从这里取文档地址，保证课堂上点得开、查得到。 */
  var DOC = "https://lbs.amap.com/api/webservice/";
  var DOCS = {
    summary: DOC + "summary",
    key: DOC + "create-project-and-key",
    start: DOC + "gettingstarted",
    georegeo: DOC + "guide/api/georegeo",
    direction: DOC + "guide/api/direction",
    newroute: DOC + "guide/api/newroute",
    district: DOC + "guide/api/district",
    ip: DOC + "guide/api/ipconfig",
    staticmaps: DOC + "guide/api/staticmaps",
    convert: DOC + "guide/api/convert",
    grasproad: DOC + "guide/api/grasproad",
    search: DOC + "guide/api-advanced/search",
    newpoisearch: DOC + "guide/api-advanced/newpoisearch",
    inputtips: DOC + "guide/api-advanced/inputtips",
    weather: DOC + "guide/api-advanced/weatherinfo",
    ipAdv: DOC + "guide/api-advanced/ip",
    traffic: DOC + "guide/api-advanced/traffic-situation-inquiry",
    bus: DOC + "guide/api-advanced/bus-inquiry",
    advPath: DOC + "guide/api-advanced/advanced-path",
    geohub: DOC + "guide/geohub/place",
    info: DOC + "guide/tools/info",
    flow: DOC + "guide/tools/flowlevel",
    weatherCode: DOC + "guide/tools/weather-code"
  };

  /* 申请页「可使用服务」那一栏的 19 项：名称 + 一句话用途 + 官方文档链接。 */
  var AMAP_SERVICES = [
    ["静态地图API", "把地点和路线画成一张图片", DOCS.staticmaps],
    ["地理编码API", "把地名换成经纬度", DOCS.georegeo],
    ["逆地理编码API", "把经纬度换回地址", DOCS.georegeo],
    ["关键字搜索API", "按关键词找地点", DOCS.search],
    ["周边搜索API", "找某个点附近的地方", DOCS.search],
    ["多边形搜索API", "找一块区域里的地点", DOCS.search],
    ["ID查询API", "按编号查地点详情", DOCS.search],
    ["输入提示API", "打字时给出候选地名", DOCS.inputtips],
    ["路径规划API", "两点之间怎么走、多远、多久到", DOCS.newroute],
    ["坐标转换API", "不同坐标系互相换算", DOCS.convert],
    ["行政区划查询API", "查省、市、区和地区编号", DOCS.district],
    ["IP定位API", "用 IP 猜你在哪个城市", DOCS.ip],
    ["天气查询API", "查实况天气和未来四天", DOCS.weather],
    ["矩形区域交通态势API", "查一块矩形区域堵不堵", DOCS.traffic],
    ["圆形区域交通态势API", "查一个圆形范围堵不堵", DOCS.traffic],
    ["指定线路交通态势API", "查某条路堵不堵", DOCS.traffic],
    ["地理围栏API", "进出某个区域时发提醒", DOCS.summary],
    ["猎鹰服务API", "记录和追踪位置轨迹", DOCS.summary],
    ["GeoHUB服务API", "把地理数据显示成图", DOCS.geohub]
  ];

  /* 第 ⑦ 关「9 扇门」卡片点击弹窗用的介绍。
   * 一个接口其实只有三样东西：地址（弹窗标题那行）、要喂它的参数、它吐出来的字段。
   * 所以九个弹窗都按同一个顺序讲：一句话说清是干嘛的 → 输入参数 → 返回结果。
   * 参数名、字段名照官方写，说明用五年级听得懂的大白话。 */
  var GATE_INFO = {
    geo: {
      name: "地理编码 API", path: "/v3/geocode/geo",
      plain: "把「地名」翻译成「经纬度」：给它「颐和园」，它回 116.27,39.99 这一对数字。",
      params: [
        ["address", 1, "要翻译的文字地址，越完整越准（省市区 + 路 + 门牌）"],
        ["city", 0, "限定在哪个城市找，防止认成外地的同名地名"],
        ["output", 0, "返回格式，固定填 JSON"]
      ],
      returns: [
        ["location", "经纬度，如 116.272568,39.994229（先经度后纬度）"],
        ["formatted_address", "拼好的完整地址"],
        ["adcode", "地区编号——查天气要的就是它"],
        ["level", "精确到哪一级：省 / 市 / 区 / 道路 / 门牌"]
      ],
      tip: "地名 → 坐标 的「翻译器」"
    },
    regeo: {
      name: "逆地理编码 API", path: "/v3/geocode/regeo",
      plain: "反过来：给它一对经纬度，它告诉你这是哪个省、市、区、哪条路。",
      params: [
        ["location", 1, "经度,纬度（注意顺序：先经度）"],
        ["extensions", 0, "base=只回地址；all=再加周边的地点(AOI/POI)"],
        ["radius", 0, "往回找周边的范围，单位米，默认 1000"],
        ["output", 0, "返回格式，固定填 JSON"]
      ],
      returns: [
        ["formatted_address", "一句话的完整地址"],
        ["addressComponent", "拆开的省 / 市 / 区 / 街道 / 门牌"],
        ["adcode", "地区编号（取出来就能拿去查天气）"],
        ["pois", "附近的地点列表（extensions=all 才有）"]
      ],
      tip: "坐标 → 地址 的「反翻译器」"
    },
    text: {
      name: "关键字搜索 API", path: "/v3/place/text",
      plain: "按关键词把符合条件的地点列成一串：名字、地址、坐标。",
      params: [
        ["keywords", 1, "要找什么：「肯德基」「充电桩」"],
        ["city", 0, "限定城市；不填容易搜到外地的同名地点"],
        ["citylimit", 0, "true=只在这个城市里找，不跨城"],
        ["offset / page", 0, "一页几条（最大 25）、要第几页"]
      ],
      returns: [
        ["count", "一共找到多少个"],
        ["pois[].name", "地点名称"],
        ["pois[].address", "地址"],
        ["pois[].location", "经纬度，拿去算路线"],
        ["pois[].adcode", "所在区县的编号"]
      ],
      tip: "按名字「大海捞针」找 POI"
    },
    around: {
      name: "周边搜索 API", path: "/v3/place/around",
      plain: "以一个坐标为圆心画个圈，找圈里的停车场、厕所、加油站。",
      params: [
        ["location", 1, "圆心：经度,纬度"],
        ["keywords 或 types", 1, "找什么，两个至少填一个"],
        ["radius", 0, "半径，单位米，默认 3000"],
        ["sortrule", 0, "排序：按距离还是按权重"]
      ],
      returns: [
        ["count", "这个圈里一共找到多少个"],
        ["pois[].name", "地点名称"],
        ["pois[].location", "经纬度"],
        ["pois[].distance", "离圆心多远（单位米）"]
      ],
      tip: "以一点为中心「画圈找」"
    },
    district: {
      name: "行政区划查询 API", path: "/v3/config/district",
      plain: "查一个省 / 市 / 区下面有哪些下级、中心点在哪、编号(adcode)是多少。",
      params: [
        ["keywords", 1, "省 / 市 / 区名，或直接填 adcode：北京、110000"],
        ["subdistrict", 0, "往下展开几级：0～3，0 表示不要下级"],
        ["extensions", 0, "base=只要信息；all=连边界坐标一起给"]
      ],
      returns: [
        ["districts[].name", "区划名称"],
        ["districts[].adcode", "它的专属编号"],
        ["districts[].center", "中心点经纬度"],
        ["districts[].districts", "下一级区划（展开几级就套几层）"]
      ],
      tip: "查区名和它的专属编号"
    },
    ip: {
      name: "IP 定位 API", path: "/v3/ip",
      plain: "用你上网的 IP 猜你在哪个城市（只到城市一级，而且只认 IPv4）。",
      params: [
        ["ip", 0, "要查的 IP；不填就查发起这次请求的那一台机器"],
        ["output", 0, "返回格式，固定填 JSON"]
      ],
      returns: [
        ["province", "省（直辖市就是市名）"],
        ["city", "市——手机热点、IPv6 出口常常是空的"],
        ["adcode", "城市编号，可直接拿去查天气"]
      ],
      tip: "用 IP 猜你在哪个城市（只到城市）"
    },
    driving: {
      name: "路径规划 API", path: "/v5/direction/driving",
      plain: "给起点和终点两个坐标，算开车怎么走、一共多远、要多久。",
      params: [
        ["origin", 1, "起点：经度,纬度"],
        ["destination", 1, "终点：经度,纬度"],
        ["show_fields", 0, "cost=费用和时间；navi=逐段导航；polyline=轨迹坐标"],
        ["strategy", 0, "路线偏好：躲避拥堵、不走高速…"]
      ],
      returns: [
        ["paths[].distance", "全程多少米"],
        ["paths[].cost.duration", "预计多少秒"],
        ["paths[].steps[]", "每一步怎么走、路名、坐标"],
        ["paths[].polyline", "整条路线的坐标串（拿来画图）"]
      ],
      tip: "A 到 B 开车 多远多久"
    },
    weather: {
      name: "天气查询 API", path: "/v3/weather/weatherInfo",
      plain: "给一个地区编号(adcode)，查此刻实况或未来四天预报。",
      params: [
        ["city", 1, "城市 adcode，如 110000——只认编号，不认「北京」"],
        ["extensions", 1, "base=此刻实况；all=今天起四天预报"]
      ],
      returns: [
        ["lives[]", "实况：weather 天气、temperature 温度、winddirection/windpower 风向风力、humidity 湿度"],
        ["forecasts[].casts[]", "预报：date 日期、dayweather/nightweather 白天夜里天气、daytemp/nighttemp 温度"],
        ["reporttime", "这组数据是什么时候发布的"]
      ],
      tip: "查今天 / 未来几天天气"
    },
    staticmap: {
      name: "静态地图 API", path: "/v3/staticmap",
      plain: "把地点和路线直接渲染成一张图片，由网页用 <img src> 显示，不经过大模型。",
      params: [
        ["location", 0, "地图中心点；不填就按 markers / paths 自动取"],
        ["zoom", 0, "缩放级别 3～17，越大越近"],
        ["size", 0, "图片像素，如 750*400，最大 1024*1024"],
        ["markers", 0, "要标的点，不同样式用 | 分组"],
        ["paths", 0, "要画的路线，用 ; 连坐标"]
      ],
      returns: [
        ["一张 PNG 图片", "不是 JSON：浏览器直接当图片贴出来，模型也读不了图"]
      ],
      tip: "把地点、路线「拍」成一张图"
    }
  };

  /* 弹窗里「参数」和「返回」都排成两列：左边是官方名字，右边是大白话。
   * 参数还多一个必填/可选的小标，学生一眼能看出哪个漏了就会报错。 */
  function gateParamsHTML(list) {
    return list.map(function (r) {
      return "<dt><code>" + r[0] + "</code>" +
        (r[1] ? '<em class="is-req">必填</em>' : "<em>可选</em>") + "</dt>" +
        "<dd>" + r[2] + "</dd>";
    }).join("");
  }
  function gateReturnsHTML(list) {
    return list.map(function (r) {
      return "<dt><code>" + r[0] + "</code></dt><dd>" + r[1] + "</dd>";
    }).join("");
  }
  var AMAP_SERVICE_HTML = AMAP_SERVICES.map(function (s) {
    return '<a class="tw-api" href="' + s[2] + '" target="_blank" rel="noopener noreferrer" ' +
      'title="打开高德官方使用说明文档"><b>' + s[0] + '</b><span>' + s[1] + "</span></a>";
  }).join("");

  var DOC_LINKS_HTML = [
    ["概述", DOCS.summary], ["创建应用和 Key", DOCS.key], ["入门指南", DOCS.start],
    ["错误码说明", DOCS.info], ["流量限制说明", DOCS.flow], ["天气对照表", DOCS.weatherCode]
  ].map(function (x) {
    return '<a class="tw-doc" href="' + x[1] + '" target="_blank" rel="noopener noreferrer">' + x[0] + " ↗</a>";
  }).join("");

  /* 第 ⑧ 关：外部工具全部是高德 Web 服务 API。
   * 每个工具的 name / path / parameters 都按官方文档写：
   *   · 必填参数放 required，可选参数全部列出并标取值（enum）；
   *   · key 是官方必填参数，但由程序自动带上，不暴露给模型；
   *   · output 固定 JSON（XML 对课堂没有额外价值）。
   * 静态地图返回的是图片，模型读不了，所以由程序直接出图（model:false）。 */
  var AMAP_TOOLS = [
    {
      k: "geo", name: "amap_geocode", label: "地理编码", group: "基础", on: 1, model: true,
      path: "/v3/geocode/geo", doc: DOCS.georegeo,
      desc: "高德地理编码（GET /v3/geocode/geo）：把结构化地址或地标名换成经纬度，" +
        "返回 geocodes[].location / adcode / level。凡是提到地点、要算路线或查天气，先用它换坐标。" +
        "官方文档：" + DOCS.georegeo,
      params: {
        address: { type: "string", description: "必填。结构化地址或地标名，如 北京市海淀区五一小学 / 颐和园" },
        city: { type: "string", description: "可选。指定查询城市：中文（北京）、全拼（beijing）、citycode（010）或 adcode（110000）。不填则全国检索，同名地点容易认错" }
      }, required: ["address"], defaults: { output: "JSON" }
    },
    {
      k: "regeo", name: "amap_regeocode", label: "逆地理编码", group: "基础", on: 1, model: true,
      path: "/v3/geocode/regeo", doc: DOCS.georegeo,
      desc: "高德逆地理编码（GET /v3/geocode/regeo）：把经纬度换成结构化地址，" +
        "extensions=all 时还返回附近 POI、道路与交叉口。官方文档：" + DOCS.georegeo,
      params: {
        location: { type: "string", description: "必填。经纬度，经度在前、纬度在后，如 116.397499,39.908722（小数不超过 6 位）" },
        radius: { type: "string", description: "可选。附近 POI 半径 0~3000 米，默认 1000" },
        poitype: { type: "string", description: "可选。POI 类型码，多个用 | 分隔；仅 extensions=all 时生效" },
        extensions: { type: "string", enum: ["base", "all"], description: "可选。base=只要地址；all=地址+附近 POI+道路（默认 base）" },
        roadlevel: { type: "string", enum: ["0", "1"], description: "可选。1=只保留主干道；仅 extensions=all 时生效" }
      }, required: ["location"], defaults: { extensions: "all", output: "JSON" }
    },
    {
      k: "district", name: "amap_district", label: "行政区划查询", group: "基础", on: 1, model: true,
      path: "/v3/config/district", doc: DOCS.district,
      desc: "高德行政区划查询（GET /v3/config/district）：按行政区名称/citycode/adcode 查 adcode、中心点与下级行政区。" +
        "官方文档：" + DOCS.district,
      params: {
        keywords: { type: "string", description: "必填。行政区名称、citycode 或 adcode，如 北京 / 110000" },
        subdistrict: { type: "string", enum: ["0", "1", "2", "3"], description: "可选。返回下级行政区级数，默认 1" },
        extensions: { type: "string", enum: ["base", "all"], description: "可选。all=返回边界坐标点" }
      }, required: ["keywords"], defaults: { subdistrict: "1", output: "JSON" }
    },
    {
      k: "ip", name: "amap_ip", label: "IP定位", group: "基础", on: 1, model: true,
      path: "/v3/ip", doc: DOCS.ip,
      desc: "IP 定位（GET /v3/ip）：按 IP 查省市、adcode 与所在矩形范围；不传 ip 则用当前请求 IP。" +
        "高德只解析 IPv4，IPv6 出口（手机热点、校园网）会返回空，程序会自动用 myip.ipip.net 兜底；" +
        "两边都拿不到时，直接问用户在哪座城市，不要猜。官方文档：" + DOCS.ip,
      params: {
        ip: { type: "string", description: "可选。要定位的 IP（仅国内）；留空用当前请求 IP" }
      }, required: [], defaults: { output: "JSON" }
    },
    {
      k: "driving", name: "amap_direction_driving", label: "路径规划2.0", group: "基础", on: 1, model: true,
      path: "/v5/direction/driving", doc: DOCS.newroute,
      desc: "高德驾车路径规划 2.0（GET /v5/direction/driving）：origin/destination 是 lng,lat 坐标，" +
        "返回 route.paths[].distance（米）、cost.duration（秒）、steps[].polyline（轨迹）。" +
        "凡是「怎么走、多远、多久到」都必须用它，不许凭印象估算。官方文档：" + DOCS.newroute,
      params: {
        origin: { type: "string", description: "必填。起点，经度在前：lng,lat（小数点不超过 6 位）。只知道地名时可直接写地名，程序会先换成坐标" },
        destination: { type: "string", description: "必填。终点，格式同 origin；也可以直接写地名" },
        strategy: {
          type: "string",
          enum: ["0", "1", "2", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45"],
          description: "可选。算路策略：0 速度优先 / 1 费用优先 / 2 常规最快 / 32 高德推荐（默认）/ 33 躲避拥堵 / 34 高速优先 / 35 不走高速"
        },
        show_fields: { type: "string", description: "可选。要额外返回的字段，逗号分隔；本项目固定用 cost,polyline（cost 才有耗时，polyline 才有轨迹）" },
        city: { type: "string", description: "非高德参数，程序内部用：把中文地名换成坐标时限定城市，避免同名地点认错" }
      }, required: ["origin", "destination"], defaults: { show_fields: "cost,polyline", output: "JSON" }
    },
    {
      k: "placetext", name: "amap_place_text", label: "关键字搜索POI", group: "高级", on: 1, model: true,
      path: "/v3/place/text", doc: DOCS.search, poiCount: [4, 6],
      desc: "高德关键字搜索 POI（GET /v3/place/text）：按关键词查学校、景点、门牌等，返回 pois[].name / address / location。" +
        "地名认不准时用它兜底。官方文档：" + DOCS.search,
      params: {
        keywords: { type: "string", description: "必填。查询关键词，如 五一小学 / 故宫" },
        city: { type: "string", description: "可选。查询城市：中文、全拼、citycode 或 adcode" },
        types: { type: "string", description: "可选。POI 类型码，多个用 | 分隔" },
        citylimit: { type: "string", enum: ["true", "false"], description: "可选。true=只返回指定城市的结果" },
        offset: { type: "string", description: "可选。每页条数；不写由程序在 4~6 之间随机取一个（问「有哪些…」时列得出来又不冗长）" },
        page: { type: "string", description: "可选。页码，默认 1" },
        extensions: { type: "string", enum: ["base", "all"], description: "可选。all=返回电话、评分等更多字段" }
      }, required: ["keywords"], defaults: { citylimit: "true", page: "1", extensions: "base", output: "JSON" }
    },
    {
      k: "placearound", name: "amap_place_around", label: "周边搜索POI", group: "高级", on: 1, model: true,
      path: "/v3/place/around", doc: DOCS.search, poiCount: [3, 5],
      desc: "高德周边搜索 POI（GET /v3/place/around）：以某坐标为中心、在半径内找 POI。" +
        "官方文档：" + DOCS.search,
      params: {
        location: { type: "string", description: "必填。中心点经纬度 lng,lat（小数点不超过 6 位）" },
        keywords: { type: "string", description: "可选。查询关键词" },
        types: { type: "string", description: "可选。POI 类型码，多个用 | 分隔" },
        radius: { type: "string", description: "可选。搜索半径 0~3000 米，默认 1000" },
        sortrule: { type: "string", enum: ["distance", "weight"], description: "可选。distance=按距离排序；weight=综合排序" },
        offset: { type: "string", description: "可选。每页条数；不写由程序在 3~5 之间随机取一个" },
        page: { type: "string", description: "可选。页码，默认 1" }
      }, required: ["location"], defaults: { page: "1", extensions: "base", output: "JSON" }
    },
    {
      k: "weather", name: "amap_weather", label: "天气查询", group: "高级", on: 1, model: true,
      path: "/v3/weather/weatherInfo", doc: DOCS.weather,
      desc: "高德天气查询（GET /v3/weather/weatherInfo）：按城市 adcode 查天气。" +
        "extensions=all 返回未来四天预报（forecasts[].casts[]，含 date/week/dayweather/nightweather/daytemp/nighttemp/风力），" +
        "问今天/明天/后天/周末一律用它；extensions=base 只返回当前实况（lives[]）。官方文档：" + DOCS.weather,
      params: {
        city: { type: "string", description: "必填。城市 adcode，如 110000（北京）、110101（东城）。也可直接传城市名（如 北京），程序会先换成 adcode。示例只示范写法——用户没说城市、也没查到他的位置时先问一句，不要拿示例顶替" },
        extensions: { type: "string", enum: ["all", "base"], description: "必选其一。all=未来四天预报（回答「明天/后天」必须用 all）；base=当前实况" }
      }, required: ["city", "extensions"], defaults: { extensions: "all", output: "JSON" }
    },
    {
      k: "staticmap", name: "amap_static_map", label: "静态地图", group: "网页画图", on: 1, model: false,
      path: "/v3/staticmap", doc: DOCS.staticmaps,
      desc: "高德静态地图（GET /v3/staticmap）：返回一张图片而不是 JSON，由程序拼 <img src> 显示。" +
        "markers 不同样式组之间用 |，同组内多点用 ;；paths 画轨迹。官方文档：" + DOCS.staticmaps
    }
  ];

  function toolByName(name) {
    for (var i = 0; i < AMAP_TOOLS.length; i++) if (AMAP_TOOLS[i].name === name) return AMAP_TOOLS[i];
    return null;
  }
  function toolByKey(k) {
    for (var i = 0; i < AMAP_TOOLS.length; i++) if (AMAP_TOOLS[i].k === k) return AMAP_TOOLS[i];
    return null;
  }

  /* 开关行由工具清单生成，避免 HTML 与 tools 声明两处各写一份、以后对不上。
   * 分两组显示：能进 tools 的（模型可见）与不经过大模型的（如静态地图，返回的是图片）——
   * 否则老师会数出"按钮亮了 6 个，为什么请求里只有 5 只工具"。 */
  function chipHTML(t) {
    return '<button type="button" class="tw-chip' + (t.on ? " is-on" : "") +
      (t.model ? "" : " is-prog") + '" data-tool="' + t.k + '" ' +
      'title="' + t.label + " · " + t.path + (t.model ? "" : "（由网页直接画图，不进 tools）") + '">' +
      t.label + "</button>";
  }
  var MODEL_CHIPS_HTML = AMAP_TOOLS.filter(function (t) { return t.model; }).map(chipHTML).join("");
  var PROG_CHIPS_HTML = AMAP_TOOLS.filter(function (t) { return !t.model; }).map(chipHTML).join("");


  /* ---- ④ 的示范片段：全部剪自 ⑤ 里真实发出 / 真实回来的那几轮 ---- */
  var D4 = {
    decl: [
      '"tools": [',
      ' {"type":"function","function":{',
      '   "name":"web_search",           // 给目录',
      '   "parameters":{"type":"object",',
      '     "properties":{"query":{"type":"string"},',
      '                   "count":{"type":"integer"}},',
      '     "required":["query"]}}},',
      ' {"type":"function","function":{',
      '   "name":"web_fetch",            // 给正文',
      '   "parameters":{"type":"object",',
      '     "properties":{"url":{"type":"string"}},',
      '     "required":["url"]}}}',
      ']'
    ].join("\n"),

    order1: [
      '  "tool_calls": [ {',
      '    "id": "call_1", "type": "function",',
      '    "function": { "name": "web_search",',
      '      "arguments": "{\\"query\\":\\"故宫博物院 禁止携带物品目录\\",\\"count\\":5}" }',
      '  } ]'
    ].join("\n"),

    exec1: [
      'POST https://api.deepseek.com/v1/tools/search',
      'Authorization: Bearer sk-••••••••',
      'Content-Type: application/json',
      '{ "query": "故宫博物院 禁止携带物品目录", "count": 5,',
      '  "need_content": false }',
      '',
      '← HTTP 200 · 812 ms',
      '{ "results": [ { "title": "故宫博物院禁止携带物品目录…",',
      '                "url": "https://www.dpm.org.cn/singles_detail/259832.html" } ] }'
    ].join("\n"),

    fill: [
      '// 回填：这一轮对话里多出两条消息',
      '{ "role": "assistant", "tool_calls": [ … ] }',
      '{ "role": "tool", "tool_call_id": "call_1",',
      '  "content": "{\\"results\\":[ … ]}" }',
      '',
      '// 再发一次：messages 从 2 条变 4 条'
    ].join("\n"),

    order2: [
      '  "tool_calls": [ {',
      '    "id": "call_2", "type": "function",',
      '    "function": { "name": "web_fetch",',
      '      "arguments": "{\\"url\\":\\"https://www.dpm.org.cn/singles_detail/259832.html\\"}" }',
      '  } ]'
    ].join("\n"),

    final: [
      '// 第 3 轮请求里没有 "tools" 字段',
      '{ "model": "deepseek-flash",',
      '  "messages": [ … 6 条 … ] }',
      '',
      '← { "role": "assistant",',
      '     "content": "分 5 大类：武器、管制器具、爆炸燃烧物、危险物品、其他。" }'
    ].join("\n")
  };

  /* ============================================================
   * 十张卡
   * ============================================================ */
  var CARDS = [
    /* ---- ① 回顾三课 ---- */
    {
      nav: "① 回顾三课",
      html:
        '<div class="card" id="tw-card-1">' +
        '<h2>① 回顾三课：它怎么一步步有了"手"</h2>' +
        '<div class="card-body">' +
        '<div class="tw-two is-3">' +

        '<div class="tw-recap"><div class="tw-recap-h"><b>L05 感知器</b><span>先得看得见、听得到</span></div><ul>' +
        '<li><b>三种模态</b>文字 · 语音 · 图像 —— 三种"进门"的方式</li>' +
        '<li><b>四种身份</b>系统提示词 / 用户消息 / 助手消息 / 工具结果</li>' +
        '<li><b>怎么调大模型</b>地址 + 钥匙 + messages → 取回 content</li>' +
        '</ul><p class="tw-recap-q">你没告诉它的，它就等于不知道。</p></div>' +

        '<div class="tw-recap"><div class="tw-recap-h"><b>L06 看世界</b><span>三条路 · 两个空间 · 两套防线</span></div><ul>' +
        '<li><b>三条路</b>原生多模态 / 提取成文字 / 交给工具分析</li>' +
        '<li><b>两个空间</b>观察空间（没进来＝不存在）· 动作空间（没授权＝不能做）</li>' +
        '<li><b>两套防线</b>六招急救 · 四道防线（内容当数据、二次确认）</li>' +
        '</ul><p class="tw-recap-q">AI 会看错，判断在人。</p></div>' +

        '<div class="tw-recap"><div class="tw-recap-h"><b>L07 执行器</b><span>从"会说"到"会做"</span></div><ul>' +
        '<li><b>三件做不到</b>不会实时查 · 不会真操作 · 不会精确算</li>' +
        '<li><b>四类工具</b>读 · 算 · 做 · 派</li>' +
        '<li><b>点单四步</b>声明 → 点单 → 执行 → 回填</li>' +
        '</ul><p class="tw-recap-q">模型只"点单"，真正动手的是程序。</p></div>' +

        '</div>' +
        '</div></div>'
    },

    /* ---- ② 本课地图 ---- */
    {
      nav: "② 本课地图",
      html:
        '<div class="card" id="tw-card-2">' +
        '<h2>② 本课怎么走：六步，从"看接口"到"看真相"</h2>' +
        '<p class="sub">六步正好对上导航上的 ③～⑧，一关只解决一件事。⑨⑩ 是第二学时的动手环节。</p>' +
        '<div class="card-body">' +
        '<div class="tw-chain is-6">' +
        '<div class="tw-step is-key"><b>STEP 1 · ③</b><span>看接口<br>地址·钥匙·参数·返回</span></div>' +
        '<div class="tw-arrow">→</div>' +
        '<div class="tw-step"><b>STEP 2 · ④</b><span>四步法<br>声明·点单·执行·回填</span></div>' +
        '<div class="tw-arrow">→</div>' +
        '<div class="tw-step"><b>STEP 3 · ⑤</b><span>两扇门<br>搜索 与 抓取</span></div>' +
        '<div class="tw-arrow">→</div>' +
        '<div class="tw-step is-key"><b>STEP 4 · ⑥</b><span>列清单<br>出行小助手要会什么</span></div>' +
        '<div class="tw-arrow">→</div>' +
        '<div class="tw-step"><b>STEP 5 · ⑦</b><span>很多门<br>一把 Key 开 19 个服务</span></div>' +
        '<div class="tw-arrow">→</div>' +
        '<div class="tw-step"><b>STEP 6 · ⑧</b><span>看真相<br>真发一次请求</span></div>' +
        '</div>' +
        '<div class="tw-two is-3">' +
        '<div class="tw-box"><h4>③④⑤ 打底</h4><p>一个接口的四样：地址 · 钥匙 · 参数 · 返回；' +
        '四步法怎么转；<b>搜索</b>与<b>抓取</b>两扇门各给回什么。</p></div>' +
        '<div class="tw-box"><h4>⑥⑦ 找工具</h4><p>先列出小助手要会哪四件事（都做不到，得借），' +
        '再看高德<b>一把 Key</b>怎么用 19 个 Web 服务一次给齐。</p></div>' +
        '<div class="tw-box is-good"><h4>⑧⑨⑩ 真跑</h4><p>真发一次请求，四个视角各看一遍；' +
        '记住会踩的坑；最后做出<b>四只工具 ＋ 一张地图</b>。</p></div>' +
        '</div>' +
        '<div class="tw-note">全课只有一条主线：<b>声明 → 点单 → 执行 → 回填，四步走完才算真的"会"。</b>' +
        '其余每一关，都是往这条主线上挂东西。</div>' +
        '</div></div>'
    },


    /* ---- ③ 一个接口长什么样 ---- */
    {
      nav: "③ 接口长相",
      html:
        '<div class="card" id="tw-card-3">' +
        '<h2>③ 一个接口长什么样：地址 · 钥匙 · 参数 · 返回</h2>' +
        '<p class="sub">接口就是别人在网上开的<b>一个窗口</b>：你把要求递进去，它把结果递出来。' +
        '要它办事，得说清<b>四件事</b>——缺一样，门就不开。</p>' +
        '<div class="card-body">' +

        '<div class="tw-four">' +

        '<div class="tw-fcard">' +
        '<div class="tw-fcard-top"><span class="tw-fcard-no">1</span><b>地址</b>' +
        '<span class="tw-fcard-t">去哪个窗口</span></div>' +
        '<pre class="tw-code sm is-scroll">https://restapi.amap.com/v3/geocode/regeo</pre>' +
        '<details class="tw-fcard-more"><summary>看讲解</summary>' +
        '<p>每个接口都有自己的地址。换个地址就是<b>另一扇门</b>——高德那 19 个服务，就是 19 个地址。</p>' +
        '<div class="tw-fcard-x">地址写错 → 404，没有这个窗口</div>' +
        '</details>' +
        '</div>' +

        '<div class="tw-fcard">' +
        '<div class="tw-fcard-top"><span class="tw-fcard-no">2</span><b>钥匙</b>' +
        '<span class="tw-fcard-t">你是谁</span></div>' +
        '<pre class="tw-code sm is-scroll">key=YOUR_AMAP_KEY</pre>' +
        '<details class="tw-fcard-more"><summary>看讲解</summary>' +
        '<p>平台发给你的<b>身份牌</b>（一串字母数字）。它知道这单是谁点的，也靠它不让别人乱用你的额度。</p>' +
        '<div class="tw-fcard-x">不带钥匙 / 钥匙不对 → 401，被挡在门外</div>' +
        '</details>' +
        '</div>' +

        '<div class="tw-fcard">' +
        '<div class="tw-fcard-top"><span class="tw-fcard-no">3</span><b>参数</b>' +
        '<span class="tw-fcard-t">你要问什么</span></div>' +
        '<pre class="tw-code sm is-scroll">?location=116.397428,39.909230&amp;extensions=all&amp;output=JSON</pre>' +
        '<details class="tw-fcard-more"><summary>看讲解</summary>' +
        '<p>接在地址后面：<code>?</code> 开头，多个用 <code>&amp;</code> 连起来。' +
        '<b>你要问什么，参数里就得有什么</b>。</p>' +
        '<p>这一串问三件事：<code>location</code> 要<b>经度,纬度</b>（先经度、后纬度，别写反）；' +
        '<code>extensions=all</code> 要更详细的地址；<code>output=JSON</code> 指定回什么格式。</p>' +
        '<div class="tw-fcard-x">参数缺了 / 写错 → 400，它听不懂你要什么</div>' +
        '</details>' +
        '</div>' +

        '<div class="tw-fcard">' +
        '<div class="tw-fcard-top"><span class="tw-fcard-no">4</span><b>返回</b>' +
        '<span class="tw-fcard-t">它答什么</span></div>' +
        '<pre class="tw-code sm is-scroll">{ "status": "1", "info": "OK",\n' +
        '  "infocode": "10000",\n' +
        '  "regeocode": {\n' +
        '    "formatted_address":\n' +
        '      "北京市东城区东华门街道天安门",\n' +
        '    "addressComponent": {\n' +
        '      "province": "北京市", "city": [],\n' +
        '      "district": "东城区", "adcode": "110101",\n' +
        '      "township": "东华门街道" } } }</pre>' +
        '<details class="tw-fcard-more"><summary>看讲解</summary>' +
        '<p>回来的永远是一段 <b>JSON 文本</b>：机器读得懂，人也读得懂。办成没办成，都写在里面。' +
        '注意 <code>city</code> 是空的 <code>[]</code>——北京是直辖市，这一格没有值：' +
        'JSON 里"没有"就写成空数组或 <code>null</code>，别当成出错。</p>' +
        '<div class="tw-fcard-x">返回 status:"0" 就是没办成</div>' +
        '</details>' +
        '</div>' +

        '</div>' +

        '<p class="tw-note">上面<b>第 1、3、2 张卡</b>拼在一起，就是一条<b>能直接粘进浏览器地址栏</b>的网址：' +
        '地址（去哪个窗口）＋ 参数（问什么）＋ 钥匙（你是谁，用 <code>&amp;</code> 挂在最后）。</p>' +
        '<pre class="tw-code is-wrap">https://restapi.amap.com/v3/geocode/regeo?location=116.397428,39.909230&amp;extensions=all&amp;output=JSON&amp;key=YOUR_AMAP_KEY</pre>' +
        '<p class="tw-note">把它敲进地址栏，吐回来的（返回）就是<b>下面这一份</b>——真实结果：</p>' +
        '<pre class="tw-code is-scroll">{\n' +
        '  "status": "1",\n' +
        '  "info": "OK",\n' +
        '  "infocode": "10000",\n' +
        '  "regeocode": {\n' +
        '    "formatted_address": "北京市东城区东华门街道天安门",\n' +
        '    "addressComponent": {\n' +
        '      "country": "中国",\n' +
        '      "province": "北京市",\n' +
        '      "city": [],\n' +
        '      "citycode": "010",\n' +
        '      "district": "东城区",\n' +
        '      "adcode": "110101",\n' +
        '      "township": "东华门街道",\n' +
        '      "streetNumber": {\n' +
        '        "street": "南河沿大街",\n' +
        '        "number": "69号",\n' +
        '        "direction": "东",\n' +
        '        "distance": "270.693"\n' +
        '      }\n' +
        '    },\n' +
        '    "pois": [\n' +
        '      { "name": "天安门", "type": "风景名胜;风景名胜;国家级景点",\n' +
        '        "address": "长安街北侧", "distance": "5.64229" },\n' +
        '      …（同一个点附近共 30 个 POI，这里只摘第一个）\n' +
        '    ],\n' +
        '    "roads": [ … ], "roadinters": [ … ], "aois": [ … ]\n' +
        '  }\n' +
        '}</pre>' +

        '<p class="tw-note">记牢这四样，下一关的<b>四步法</b>就好懂了：' +
        '<b>声明</b> ＝ 把"有哪些窗口、各要什么参数"写成菜单；' +
        '<b>点单</b> ＝ 模型挑一个窗口、报上参数；' +
        '<b>执行</b> ＝ 程序把地址 · 钥匙 · 参数拼起来真发出去；' +
        '<b>回填</b> ＝ 把返回塞回对话，再问一遍。</p>' +

        '</div></div>'
    },

    /* ---- ④ 四步法 ---- */
    {
      nav: "④ 四步法",
      html:
        '<div class="card" id="tw-card-4">' +
        '<h2>④ 四步法：声明 · 点单 · 执行 · 回填</h2>' +
        '<div class="card-body">' +
        '<p class="tw-note">模型只<b>动嘴</b>（点单），程序<b>动手</b>（执行），结果<b>回填</b>，再问一遍。' +
        '一圈就是一环，环环相接——所以一次提问，往往要好几轮。</p>' +

        '<div class="tw-four">' +

        '<div class="tw-fcard">' +
        '<div class="tw-fcard-top"><span class="tw-fcard-no">1</span><b>声明</b>' +
        '<span class="tw-fcard-t">先登记，再点单</span></div>' +
        '<pre class="tw-code sm is-scroll">' + D4.decl + '</pre>' +
        '<details class="tw-fcard-more"><summary>看讲解</summary>' +
        '<p>第一轮请求里就先写清<b>有哪两扇门、各要什么参数</b>——这张菜单就是声明。' +
        '模型看不到你的代码，只看到菜单。</p>' +
        '<div class="tw-fcard-x">没声明 → 模型不知道有这扇门，永远点不出来</div>' +
        '<div class="tw-fcard-src">⑤ 对照：第 1 轮请求 · <b>2 个工具</b></div>' +
        '</details>' +
        '</div>' +

        '<div class="tw-fcard">' +
        '<div class="tw-fcard-top"><span class="tw-fcard-no">2</span><b>点单</b>' +
        '<span class="tw-fcard-t">模型只动嘴</span></div>' +
        '<pre class="tw-code sm is-scroll">{"role":"assistant","content":"",\n' + D4.order1 + '}</pre>' +
        '<details class="tw-fcard-more"><summary>看讲解</summary>' +
        '<p>模型不回答案，只回一张<b>点单</b>：工具名 + 参数。' +
        '注意 <code>arguments</code> 是<b>一段字符串</b>，程序要 <code>JSON.parse</code> 才读得懂。' +
        '它自己不联网、不执行，点完就停在这儿等。</p>' +
        '<div class="tw-fcard-x">点错名 / 少参数 → 程序执行不了</div>' +
        '<div class="tw-fcard-src">⑤ 对照：第 1 轮响应 · <b>从 2 个工具里选了 1 个</b></div>' +
        '</details>' +
        '</div>' +

        '<div class="tw-fcard">' +
        '<div class="tw-fcard-top"><span class="tw-fcard-no">3</span><b>执行</b>' +
        '<span class="tw-fcard-t">程序动手，四样凑齐</span></div>' +
        '<pre class="tw-code sm is-scroll">' + D4.exec1 + '</pre>' +
        '<details class="tw-fcard-more"><summary>看讲解</summary>' +
        '<p>程序接过点单，把<b>地址 · 钥匙 · 参数</b>拼成一个真请求发出去，再把<b>返回</b>接住。' +
        '四样缺一，工具就跑不起来。</p>' +
        '<div class="tw-fcard-x">缺地址 <b>404</b> · 缺钥匙 <b>401</b> · 缺参数 <b>400</b></div>' +
        '<div class="tw-fcard-src">⑤ 对照：程序执行 搜索 → 请求 · POST /v1/tools/search → 响应 · HTTP 200</div>' +
        '</details>' +
        '</div>' +

        '<div class="tw-fcard">' +
        '<div class="tw-fcard-top"><span class="tw-fcard-no">4</span><b>回填</b>' +
        '<span class="tw-fcard-t">结果塞回对话，再问一遍</span></div>' +
        '<pre class="tw-code sm is-scroll">' + D4.fill + '</pre>' +
        '<details class="tw-fcard-more"><summary>看讲解</summary>' +
        '<p>返回被包成一条 <b>tool 消息</b>塞回对话——<b>tool_call_id</b> 要和点单里的 <b>id</b> 对上，' +
        '模型才知道这是哪一单的回执。紧接着再发一次请求，模型这才第一次"看见"外面发生了什么。</p>' +
        '<div class="tw-fcard-x">不回填 → 模型只能<b>凭印象瞎编</b></div>' +
        '<div class="tw-fcard-src">⑤ 对照：第 2 轮请求 · <b>4 条消息</b>（比上一轮多了工具结果）</div>' +
        '</details>' +
        '</div>' +

        '</div>' +

        '</div></div>'
    },

    /* ---- ⑤ 搜索 vs 抓取 ---- */
    {
      nav: "⑤ 搜索 vs 抓取",
      html:
        '<div class="card" id="tw-card-5">' +
        '<h2>⑤ 搜索 vs 抓取：两扇门，各真开一次</h2>' +
        '<p class="sub">两扇门都<b>真调</b>接口，一轮一轮来：第 1 轮它先点一扇门，程序真的发出去；' +
        '结果回填后第 2 轮它再决定要不要开另一扇。下面两个开关就是这两扇门，关掉哪扇，模型手里就少一扇。</p>' +
        '<div class="card-body">' +

        '<div class="tw-two">' +
        '<div class="tw-box"><h4>搜索 <code>/v1/tools/search</code></h4>' +
        '<p>参数 <code>{"query":"...","count":5}</code>　返回：标题、摘要、链接。</p>' +
        '<p><b>像一页目录</b>：告诉你有哪些书、各讲什么、在哪一页。</p></div>' +
        '<div class="tw-box"><h4>抓取 <code>/v1/tools/fetch</code></h4>' +
        '<p>参数 <code>{"url":"..."}</code>　返回：这一页的正文。</p>' +
        '<p><b>像一本书的内容</b>：把那一页真正翻开读进来。</p></div>' +
        '</div>' +

        '<div class="tw-io" id="tw-io2">' +

        '<div class="tw-io-hr" style="margin-top:0">工具开关 · 两扇门，各管一件事</div>' +
        '<div class="tw-io-bar tw-io-bar-tools">' +
        '<button type="button" class="tw-chip is-on" data-role="sw" data-k="search">搜索 <b>/v1/tools/search</b></button>' +
        '<button type="button" class="tw-chip is-on" data-role="sw" data-k="fetch">抓取 <b>/v1/tools/fetch</b></button>' +
        '<span class="tw-io-bar-split">关掉一扇，模型手里就少一扇</span>' +
        '</div>' +
        '<div class="tw-io-bar">' +
        '<span class="tw-io-tip" style="margin-left:0">开关只决定「这次允许开哪扇门」，不改任何参数。</span>' +
        '<span class="tw-io-tip" data-role="model"></span>' +
        '</div>' +

        '<div class="tw-ready">' +
        '<span class="tw-dot" data-role="dot"></span>' +
        '<span class="tw-ready-text" data-role="keystate"></span>' +
        '</div>' +

        '<div class="tw-io-hr">视角一 · 人看到的：怎么提问、怎么读答案</div>' +
        '<div class="tw-io-grid">' +
        '<div class="tw-io-col is-in">' +
        '<div class="tw-io-head"><span class="tw-io-no">1</span><b>你这边 · 输入</b><em>可以直接改成自己的题</em></div>' +
        '<div class="tw-io-body">' +
        '<div class="tw-composer">' +
        '<textarea class="tw-q" id="tw-io2-q" rows="2" spellcheck="false">去故宫哪些东西不能带？官方目录一共分几大类？</textarea>' +
        '<div class="tw-composer-bar">' +
        '<button type="button" class="tw-send" data-role="send">' +
        '<span class="tw-send-ic">➤</span><span data-role="send-label">发送</span></button>' +
        '</div></div>' +
        '<div class="tw-qpresets">' +
        '<button type="button" class="tw-chip" data-q="去故宫哪些东西不能带？官方目录一共分几大类？" title="没给网址：先搜到目录页，再打开正文">没给网址</button>' +
        '<button type="button" class="tw-chip" data-q="这篇 https://www.dpm.org.cn/singles_detail/259832.html 里，禁止携带的物品分几大类？" title="给了网址：跳过搜索，直接抓这一页正文">给了网址</button>' +
        '<button type="button" class="tw-chip" data-q="故宫博物院《禁止携带物品目录》的网址是哪个？" title="只要那个网址：搜索结果里就有，一次搜索就够">只要目录</button>' +
        '<button type="button" class="tw-chip" data-q="https://www.dpm.org.cn/Visit.html 里，旺季和淡季分别几点停止入馆？门票各多少钱？" title="只读这一页：一次抓取；四个数字都在页面的表格正文里">只读一页</button>' +
        '</div>' +
        '</div></div>' +
        '<div class="tw-io-col is-out">' +
        '<div class="tw-io-head"><span class="tw-io-no">2</span><b>你这边 · 读到的</b><em>模型读完结果后的回答</em></div>' +
        '<div class="tw-io-body" data-role="human"></div></div>' +
        '</div>' +

        '<div class="tw-io-hr">视角二 · 程序看到的：真正发出去的 / 真正收回来的原始数据</div>' +
        '<div class="tw-io-grid is-tall">' +
        '<div class="tw-io-col is-send">' +
        '<div class="tw-io-head"><span class="tw-io-no">3</span><b>程序这边 · 发出去的</b><em>开关一动就变</em></div>' +
        '<div class="tw-io-body" data-role="req"></div></div>' +
        '<div class="tw-io-col is-back">' +
        '<div class="tw-io-head"><span class="tw-io-no">4</span><b>程序这边 · 收回来的</b><em>真实响应原文</em></div>' +
        '<div class="tw-io-body" data-role="resp"></div></div>' +
        '</div>' +

        '<div class="tw-sendbar">' +
        '<button type="button" class="tw-btn is-ghost" data-role="reset">恢复默认</button>' +
        '<span class="tw-io-tip" data-role="hint">两扇门都开：先搜到那一页，再开正文；<b>关掉抓取</b>：它只能猜，或说没查到。答案随官网页面更新，以原文为准。</span>' +
        '</div>' +

        '</div>' +
        '</div></div>'
    },

    /* ---- ⑥ 先列清单：出行小助手要会什么 ---- */
    {
      nav: "⑥ 需求清单",
      html:
        '<div class="card" id="tw-card-6">' +
        '<h2>⑥ 先列清单：出行小助手要会什么</h2>' +
        '<p class="sub">这节课最后的成品，是一个真能用的<b>出行小助手</b>。先别急着写代码——' +
        '把人会问的话摆出来，再看每一句话背后，它<b>必须会</b>什么。</p>' +
        '<div class="card-body">' +

        '<table class="tw-table">' +
        '<tr><th>人会这样问它</th><th>所以它必须会</th></tr>' +
        '<tr><td>「我在哪儿？附近有药店吗？」</td><td>先知道你在哪座城市，再以这个点为中心，找附近的地点</td></tr>' +
        '<tr><td>「从五一小学到颐和园怎么走？多远？多久？」</td><td>把地名换成坐标，再用两个坐标算距离、耗时和路线</td></tr>' +
        '<tr><td>「明天去颐和园要带伞吗？」</td><td>按城市查天气：今天的实况 ＋ 未来几天</td></tr>' +
        '<tr><td>「把这三个地方标在地图上给我看。」</td><td>把一串坐标画成一张图（图是给眼睛看的，不是文字）</td></tr>' +
        '</table>' +

        '<p class="sub" style="margin:16px 0 8px">归成 <b>4 件事 ＋ 1 张图</b>——就是最后放进顶栏的那四只工具：</p>' +
        '<div class="tw-four">' +
        '<div class="tw-box"><h4>① 找地方 · 关键字 / 周边搜索</h4>' +
        '<p>「附近有药店吗？」按坐标划一个圈、按关键词找地点，返回名字、地址、坐标。</p></div>' +
        '<div class="tw-box"><h4>② 算路线 · 路径规划</h4>' +
        '<p>「怎么走、多远、多久到」：两个坐标 → 距离（米）、耗时（秒）、一条轨迹。</p></div>' +
        '<div class="tw-box"><h4>③ 查天气 · 天气查询</h4>' +
        '<p>「明天带伞吗」：一个城市编码 → 今天的实况 ＋ 未来四天。</p></div>' +
        '<div class="tw-box"><h4>④ 画地图 · 静态地图</h4>' +
        '<p>「标出来给我看」：坐标 ＋ 标记 → <b>一张图片</b>，网页把它贴上去就行。</p></div>' +
        '</div>' +

        '<p class="tw-note" style="margin-top:12px">还有一步<b>打底</b>：<b>地名 → 坐标</b>。' +
        '这一手藏在工具里面，模型看不见，但没有它，上面四件全做不成——下一关会真看到它。</p>' +

        '<div class="tw-box is-bad" style="margin-top:12px"><h4>这四件事，大模型自己一件都做不到</h4>' +
        '<p>它<b>不联网</b>，不知道今天堵不堵；<b>不会画图</b>，给不出那张地图；也<b>不认路</b>，' +
        '「从五一小学到颐和园」只能编一个看着像的距离。<br>' +
        '所以清单上的每一条，都得<b>借一个外面的接口</b>——谁来借给它？</p></div>' +

        '<div class="tw-note">看清一件事：<b>功能清单的每一条，都对着一个"外面的接口"。</b><br>' +
        '自己手写这些数据，一辈子也写不完；聪明的办法是<b>借现成的</b>。' +
        '下一关就去看：一个平台，怎么把这几件事<b>一次全给齐</b>。</div>' +

        '</div></div>'
    },

    /* ---- ⑦ 高德开放平台：一把钥匙开很多门 ---- */
    {
      nav: "⑦ 一把钥匙开很多门",
      html:
        '<div class="card" id="tw-card-7">' +
        '<h2>⑦ 高德开放平台：一把钥匙开很多门</h2>' +
        '<div class="card-body">' +

        '<div class="tw-two">' +
        '<div class="tw-box"><h4>它是谁 · 高德开放平台</h4>' +
        '<p><b>lbs.amap.com</b> 是高德把自家地图能力「开放」出来的网站：' +
        '全国的道路、地点、路线、天气，它都做成一个个<b>接口</b>——' +
        '你按它的地址发一个请求、带上参数，它就把结果回给你。</p>' +
        '<p>不用自己画地图，也不用存全国的数据；<b>要用的时候问它一次</b>就行。' +
        '这就是第 ⑥ 关说的那副<b>借来的腿</b>。</p></div>' +

        '<div class="tw-box"><h4>它能给我们什么</h4>' +
        '<p>三类东西：<b>地图</b>（把地点和路线画成一张图）、' +
        '<b>地点</b>（地名 ↔ 坐标、按关键词或周边找 POI）、' +
        '<b>路线与出行</b>（怎么走、多远、多久，外加天气、行政区划、IP 定位）。</p>' +
        '<p>「出行小助手」要会的那四件事，全在这一套里。</p></div>' +
        '</div>' +

        '<div class="tw-box is-good"><h4>它有多种「服务平台」——我们只用 Web 服务</h4>' +
        '<p>申请 Key 时，官方第一件事就让你选<b>服务平台</b>：同一个高德，按「你在哪儿用它」' +
        '分成了好几种，<b>选完就不能混用</b>。</p>' +
        '<table class="tw-table">' +
        '<tr><th>服务平台</th><th>用在哪</th><th>我们能不能用</th></tr>' +
        '<tr><td><b>Web 服务</b>（REST API）</td>' +
        '<td>任何能发 HTTP 请求的地方：网页里的 <code>fetch</code>、Python、curl</td>' +
        '<td><b>就用它</b>：机房只要浏览器 + 一根网线</td></tr>' +
        '<tr><td>Web 端（JS API）</td>' +
        '<td>网页里用 JavaScript 加载地图，要引 SDK、配域名白名单</td>' +
        '<td>不用：还得搭地图容器，超出课堂范围</td></tr>' +
        '<tr><td>Android / iOS</td>' +
        '<td>装进手机 App，要打包 APK / IPA</td>' +
        '<td>不用：机房没有手机开发环境</td></tr>' +
        '<tr><td>微信小程序 / 鸿蒙</td>' +
        '<td>只能在对应平台里跑</td>' +
        '<td>不用：要各自的账号和工具链</td></tr>' +
        '</table>' +
        '<p>按机房条件，我们只申请 <b>Web 服务</b> 这一种 Key：' +
        '<b>一个网址 + 几个参数，就能拿回 JSON</b>，正好接上前面学的「四步法」。</p></div>' +

        '<div class="tw-box" style="margin-top:12px"><h4>官方文档 · 先看这六篇</h4>' +
        '<div class="tw-doc-links">' + DOC_LINKS_HTML + '</div>' +
        '<p style="margin-top:10px">调用协议（官方入门指南）：<b>HTTP/HTTPS GET</b>，参数用 <code>&amp;</code> 连接，' +
        '<code>key</code> 必填，<code>output=JSON</code> 是默认值；返回里 <code>status=1</code> 表示成功、' +
        '<code>infocode=10000</code> 表示正确，出错时按<b>错误码说明</b>查 <code>info</code>。</p></div>' +

        '<p class="sub" style="margin:16px 0 8px"><b>Web 服务平台的 19 个可用服务</b>（点任一项打开官方说明）：</p>' +
        '<p class="tw-api-base">地址前缀都一样：<code>https://restapi.amap.com</code>，后面接各自的路径。</p>' +
        '<div class="tw-api-grid">' + AMAP_SERVICE_HTML + '</div>' +

        '<div style="text-align:center;margin:14px 0">' +
        '<button type="button" class="tw-btn" id="tw-count-key">数一数：一共几把钥匙？</button>' +
        '</div>' +
        '<div class="tw-added" id="tw-key-result" hidden>' +
        '<div class="tw-note">19 个服务共用这一把 Key——<b>不用再申请第二把</b>。<br>' +
        '<b>一把钥匙能开很多门。</b></div>' +
        '</div>' +

        '<p class="sub" style="margin:16px 0 8px"><b>其中最常见的 9 个</b>（点开看：一句话介绍 + 输入参数 + 返回结果）：</p>' +
        '<p class="tw-api-base">前缀同样是 <code>https://restapi.amap.com</code>，下面只写各自的路径。</p>' +
        '<div class="tw-gates is-many">' +
        '<div class="tw-gate" data-gate="geo" tabindex="0" role="button" aria-label="地理编码API 介绍"><b>地理编码API</b><code>/v3/geocode/geo</code><span>地名 → 经纬度</span></div>' +
        '<div class="tw-gate" data-gate="regeo" tabindex="0" role="button" aria-label="逆地理编码API 介绍"><b>逆地理编码API</b><code>/v3/geocode/regeo</code><span>坐标 → 详细地址</span></div>' +
        '<div class="tw-gate" data-gate="text" tabindex="0" role="button" aria-label="关键字搜索API 介绍"><b>关键字搜索API</b><code>/v3/place/text</code><span>关键词 → 一串地点（POI）</span></div>' +
        '<div class="tw-gate" data-gate="around" tabindex="0" role="button" aria-label="周边搜索API 介绍"><b>周边搜索API</b><code>/v3/place/around</code><span>某坐标附近找 POI</span></div>' +
        '<div class="tw-gate" data-gate="district" tabindex="0" role="button" aria-label="行政区划查询API 介绍"><b>行政区划查询API</b><code>/v3/config/district</code><span>查有哪些区、adcode</span></div>' +
        '<div class="tw-gate" data-gate="ip" tabindex="0" role="button" aria-label="IP定位API 介绍"><b>IP定位API</b><code>/v3/ip</code><span>IP → 城市（只认 IPv4）</span></div>' +
        '<div class="tw-gate" data-gate="driving" tabindex="0" role="button" aria-label="路径规划API 介绍"><b>路径规划API</b><code>/v5/direction/driving</code><span>两个坐标 → 距离、耗时</span></div>' +
        '<div class="tw-gate" data-gate="weather" tabindex="0" role="button" aria-label="天气查询API 介绍"><b>天气查询API</b><code>/v3/weather/weatherInfo</code><span>adcode → 实况 / 未来四天</span></div>' +
        '<div class="tw-gate" data-gate="staticmap" tabindex="0" role="button" aria-label="静态地图API 介绍"><b>静态地图API</b><code>/v3/staticmap</code><span>参数 → <b>一张图</b>（网页画）</span></div>' +
        '</div>' +
        '</div></div>'
    },

    /* ---- ⑧ 请求 ↔ 响应（真实调用） ---- */
    {
      nav: "⑧ 请求↔响应",
      html:
        '<div class="card" id="tw-card-8">' +
        '<h2>⑧ 请求 ↔ 响应：真发一次，四个视角各看到什么</h2>' +
        '<div class="card-body">' +
        '<div class="tw-io" id="tw-io">' +

        '<div class="tw-io-hr" style="margin-top:0">工具开关 · 高德 Web 服务 API' +
        '（<a href="' + DOCS.summary + '" target="_blank" rel="noopener noreferrer">官方开发指南目录 ↗</a>）</div>' +
        '<div class="tw-io-bar tw-io-bar-tools">' + MODEL_CHIPS_HTML +
        '<span class="tw-chip-group">' +
        '<span class="tw-io-bar-split">不经过大模型 · 网页自己画：</span>' + PROG_CHIPS_HTML +
        '</span>' +
        '</div>' +
        '<div class="tw-ready">' +
        '<span class="tw-dot" data-role="dot"></span>' +
        '<span class="tw-ready-text" data-role="keystate"></span>' +
        '<span class="tw-io-tip tw-ready-model" data-role="model"></span>' +
        '<label class="tw-amap">高德 Key（可选）' +
        '<input type="text" id="tw-io-amap" class="tw-amap-in" placeholder="32 位，服务平台选「Web 服务」" spellcheck="false">' +
        '<button type="button" class="tw-chip" data-role="savekey">记住</button>' +
        '</label>' +
        '</div>' +

        '<div class="tw-io-hr">视角一 · 人看到的：怎么提问、怎么读答案</div>' +
        '<div class="tw-io-grid">' +
        /* 左上：用户输入视角 —— 系统提示词 + 输入区（内含发送按钮） + 快速选题 */
        '<div class="tw-io-col is-in">' +
        '<div class="tw-io-head"><span class="tw-io-no">1</span><b>你这边 · 输入</b><em>可以直接改成自己的题</em></div>' +
        '<div class="tw-io-body">' +
        '<div class="tw-sys"><span class="t">系统提示词</span><p><b>你是「出行小助手」</b>：只做出行的事；地点、路线、天气、周边都要<b>联网查</b>，不凭印象；不知道你在哪就先问城市，问哪天就只答哪天，查不到就说查不到。</p></div>' +
        '<div class="tw-composer">' +
        '<textarea class="tw-q" id="tw-io-q" rows="2" spellcheck="false">明天去颐和园怎么走、穿什么？</textarea>' +
        '<div class="tw-composer-bar">' +
        '<span class="tw-io-tip">改好题再发送</span>' +
        '<button type="button" class="tw-send" data-role="send">' +
        '<span class="tw-send-ic">➤</span><span data-role="send-label">发送</span></button>' +
        '</div></div>' +
        '<div class="tw-qpresets">' +
        '<button type="button" class="tw-chip" data-q="明天去颐和园怎么走、穿什么？" ' +
        'title="路线 + 天气：一句话两件事，先都查再一起答">怎么走、穿什么</button>' +
        '<button type="button" class="tw-chip" data-q="从五一小学到颐和园开车要多久？" ' +
        'title="地理编码 + 驾车路线（程序内部先把地名换成坐标）">开车要多久</button>' +
        '<button type="button" class="tw-chip" data-q="北京现在天气怎么样？" ' +
        'title="天气实况（extensions=base），单只工具">现在天气</button>' +
        '<button type="button" class="tw-chip" data-q="我这里今天天气怎么样？" ' +
        'title="两步：先 IP 定位拿城市，再查天气">我这儿天气</button>' +
        '<button type="button" class="tw-chip" data-q="颐和园附近有停车场吗？" ' +
        'title="地理编码拿中心点 + 周边搜索（radius 1000 米）；搜到的点会自动标在静态地图上">附近停车场</button>' +
        '<button type="button" class="tw-chip" data-q="北京有哪些科技馆？" ' +
        'title="关键字搜索 POI：返回名称、地址、坐标；答案下面顺带打点画一张静态地图">找科技馆</button>' +
        '<button type="button" class="tw-chip" data-q="116.397428,39.909230 是什么地方？" ' +
        'title="逆地理编码：坐标 → 结构化地址">这是哪儿</button>' +
        '<button type="button" class="tw-chip" data-q="北京有哪些区？" ' +
        'title="行政区划查询：返回下级行政区列表">有哪些区</button>' +
        '<button type="button" class="tw-chip is-edge" data-q="给我出一道五年级的数学题。" ' +
        'title="越界题：出行小助手只做出行的事，这道会被礼貌拒绝，再把话题拉回出行">越界：数学题</button>' +
        '</div>' +
        '</div></div>' +
        /* 右上：用户读取视角 */
        '<div class="tw-io-col is-out">' +
        '<div class="tw-io-head"><span class="tw-io-no">2</span><b>你这边 · 读到的</b><em>真实回答就在这</em></div>' +
        '<div class="tw-io-body" data-role="human"></div></div>' +
        '</div>' +

        '<div class="tw-io-hr">视角二 · 程序看到的：真正发出去的 / 真正收回来的原始数据</div>' +
        '<div class="tw-io-grid is-tall">' +
        /* 左下：程序发出视角 */
        '<div class="tw-io-col is-send">' +
        '<div class="tw-io-head"><span class="tw-io-no">3</span><b>程序这边 · 发出去的</b><em>开关一动就变</em></div>' +
        '<div class="tw-io-body" data-role="req"></div></div>' +
        /* 右下：程序接收视角 */
        '<div class="tw-io-col is-back">' +
        '<div class="tw-io-head"><span class="tw-io-no">4</span><b>程序这边 · 收回来的</b><em>真实响应原文</em></div>' +
        '<div class="tw-io-body" data-role="resp"></div></div>' +
        '</div>' +

        '<div class="tw-sendbar">' +
        '<button type="button" class="tw-btn is-ghost" data-role="reset">恢复默认</button>' +
        '<span class="tw-io-tip" data-role="hint">它能几步走完就调几轮：点单 → 拿结果 → 可能再点单 → 作答。点开关只改请求体；点左上卡里的「发送」才会真的发。</span>' +
        '</div>' +
        '</div>' +
        '</div></div>'
    },

    /* ---- ⑨ 排错实录（Vibe Coding 的坑） ---- */
    {
      nav: "⑨ 排错实录",
      html:
        '<div class="card" id="tw-card-9">' +
        '<h2>⑨ 排错实录：真跑起来会踩的坑</h2>' +
        '<p class="sub">下面六个坑，每一个都能在 ③～⑧ 里找到出处。<b>会定位，比会写代码更管用。</b></p>' +
        '<div class="card-body">' +

        '<div class="tw-two">' +
        '<div class="tw-box is-bad"><h4>坑 1 · 一直转圈，或直接失败　<span>③ 地址·钥匙·参数</span></h4>' +
        '<p>按 <b>F12</b>（Mac：<b>Cmd+Option+I</b>）开工作台，<b>Network</b> 里看那条请求、状态码多少：<br>' +
        '<b>404</b> 地址拼错（少了 <code>/v3</code>、用成别的服务的路径）；<br>' +
        '<b>401</b> 钥匙没带、或末尾多打了个空格；<br>' +
        '<b>400</b> 参数缺了或名字写错。三样对着第 ③ 关逐个核。</p></div>' +
        '<div class="tw-box is-bad"><h4>坑 2 · Key 明明填了，却一直 10009　<span>⑦ 平台类型</span></h4>' +
        '<p>申请时「服务平台」要选 <b>Web 服务</b>。选成「Web 端」的那个 Key 只能在前端用 JS API，' +
        '调 REST 接口一律 <code>10009</code>。<br>' +
        '换 Key 后还要<b>重新填、重新点「记住」</b>——它只存在本机浏览器里。</p></div>' +
        '</div>' +

        '<div class="tw-two">' +
        '<div class="tw-box is-bad"><h4>坑 3 · 接口"成功"了，字段却是空的　<span>⑦ status=1</span></h4>' +
        '<p>高德回 <code>status=1</code>，可字段是空的——比如 IP 定位的 <code>province</code> 是 <code>[]</code>。<br>' +
        '常见于 <b>IPv6 出口</b>（手机热点、校园网）、境外，或库里没收录的 IP。<br>' +
        '程序必须<b>判空</b>：拿不到就说拿不到，直接问用户在哪座城市。</p></div>' +
        '<div class="tw-box is-bad"><h4>坑 4 · 结果离谱：几公里答成几百公里　<span>⑥ 地名→坐标</span></h4>' +
        '<p>地名没带城市 → 认到外地的同名地点（"五一小学"全国都有）；<br>' +
        '或者程序把<b>已经是坐标</b>的输入又当地名查了一遍。<br>' +
        '改法：地名带城市、坐标直接用；看工具结果里的<b>全名</b>，核对它认成了哪儿。</p></div>' +
        '</div>' +

        '<div class="tw-two">' +
        '<div class="tw-box is-bad"><h4>坑 5 · 答得头头是道，其实全是编的　<span>⑤⑧ 工具没开</span></h4>' +
        '<p>最危险的一种：<b>没有任何报错</b>。查左下请求体——<code>tools</code> 里有没有那只工具、' +
        '开关是不是被手滑关掉了；再看响应里有没有 <code>tool_calls</code>。<br>' +
        '<b>没有点单却有答案，就是凭印象。</b>这正是第 ⑤ 关那两个开关要演的东西。</p></div>' +
        '<div class="tw-box is-bad"><h4>坑 6 · 回答里冒出一堆标记　<span>④⑧ 伪调用</span></h4>' +
        '<p>出现 <code>&lt;｜｜DSML｜｜ …&gt;</code> 这类文本，说明它<b>把工具调用写成了文字</b>，没走 <code>tool_calls</code>。<br>' +
        '常见于"这一轮没给它工具"，或它把调用语法当成了普通内容。<br>' +
        '改法：校验 <code>tool_calls</code>；发现伪调用就提醒它"用 tool_calls 重来一次"。</p></div>' +
        '</div>' +

        '<p class="sub" style="margin-top:16px">怎么把错误讲给大模型？三句话模板：</p>' +
        '<div class="tw-two is-3" style="margin-top:8px">' +
        '<div class="tw-box"><h4>① 我在做什么</h4><p>"我在做出行小助手，点发送查天气。"</p></div>' +
        '<div class="tw-box"><h4>② 我看到什么</h4><p>"Console 红字：Uncaught TypeError…（原文照抄）"</p></div>' +
        '<div class="tw-box"><h4>③ 我试过什么</h4><p>"重填了 Key、刷新过页面，还是这样。"</p></div>' +
        '</div>' +

        '<table class="tw-table">' +
        '<tr><th>你在 Console / Network / 返回里看到</th><th>大概率是什么</th></tr>' +
        '<tr><td><code>404</code></td><td>地址写错：少了 <code>/v3</code>、路径拼错，或用了别的服务的地址（③）</td></tr>' +
        '<tr><td><code>400</code> / <code>infocode 20000</code> 类</td><td>参数缺了或字段名拼错：照官方文档逐个核（③）</td></tr>' +
        '<tr><td><code>401 Unauthorized</code></td><td>Key 不对或没带：检查设置里那串、有没有多余空格（③）</td></tr>' +
        '<tr><td><code>status=0</code> ＋ 一句 <code>info</code></td><td>高德明确说没办成：<code>info</code> 那句英文就是原因，照着改参数</td></tr>' +
        '<tr><td><code>429</code></td><td>调太快了：等一下再试，或别让全班同时点</td></tr>' +
        '<tr><td><code>Failed to fetch</code> / <code>CORS</code></td><td>双击 <code>file://</code> 打开被拦：改用预览或本地服务器</td></tr>' +
        '<tr><td><code>infocode 10009</code></td><td>Key 的平台类型选错：必须是「Web 服务」（⑦）</td></tr>' +
        '<tr><td><code>infocode 30001</code></td><td>起终点太近，或被认成同一个地点：给地名加上区名（⑥）</td></tr>' +
        '<tr><td><code>status=1</code> 但字段是 <code>[]</code></td><td>库里没这条记录（IPv6 出口、境外）：判空后改用城市名（⑦）</td></tr>' +
        '<tr><td>答得很顺，却一句都对不上</td><td>这一轮 <code>tools</code> 没带、或开关关了：查请求体有没有 <code>tool_calls</code>（⑤⑧）</td></tr>' +
        '<tr><td>地图位置一片空白</td><td><code>staticmap</code> 的 <code>markers</code> 格式错：组间用 <code>|</code>、组内用 <code>;</code></td></tr>' +
        '<tr><td>content 里有 <code>DSML</code> 等标记</td><td>模型把调用写成文字：没有 <code>tool_calls</code>，程序不会执行（④⑧）</td></tr>' +
        '<tr><td>什么都没报，静悄悄</td><td>事件没绑上，或 <code>try/catch</code> 把错吞了</td></tr>' +
        '</table>' +

        '<div class="tw-note">一句话记住：<b>报错不是坏事，是线索。</b>' +
        '"它坏了"让模型只能猜；"现象 + 原文 + 我试过什么"才能让它一次改对。<br>' +
        '排查顺序也固定：<b>先看请求发出去没有（⑤⑧ 的请求体）→ 再看状态码（③ 的三种脸色）→ 最后看返回里写了什么</b>。</div>' +
        '</div></div>'
    },

    /* ---- ⑩ 编写与运行 ---- */
    {
      nav: "⑩ 编写与运行",
      html:
        '<div class="card" id="tw-card-10">' +
        '<h2>⑩ 出行小助手：编写与运行</h2>' +
        '<p class="sub">三个文件、两把钥匙、五句验收题——第二学时做出来的就是它。</p>' +
        '<div class="card-body">' +
        '<div class="tw-two">' +
        '<div class="tw-box"><h4>① 编写：说 → 写 → 跑 → 调</h4>' +
        '<ol class="tw-steps">' +
        '<li><b>说</b>：把 ⑥ 的清单原话交给 CodeBuddy——找地方 / 算路线 / 查天气 / 画地图，' +
        '外加 ⑧ 里那段<b>系统提示词</b>，<b>照抄，别改字</b></li>' +
        '<li><b>写</b>：让它生成网页，存成一个文件夹</li>' +
        '<li><b>跑</b>：先问那句「明天去颐和园怎么走、穿什么」</li>' +
        '<li><b>调</b>：报错了，就按 ⑨ 的三句话模板讲给它听</li>' +
        '</ol></div>' +
        '<div class="tw-box"><h4>② 它交给你的三个文件</h4>' +
        '<pre class="tw-ftree">出行小助手/\n' +
        '├─ index.html  <em>页面：设置 / 工具菜单 / 气泡区</em>\n' +
        '├─ app.js      <em>声明 · 点单 · 执行 · 回填都在这</em>\n' +
        '└─ style.css   <em>深色主题，跟功能无关</em>\n\n' +
        '<em>// 零依赖 · 零构建 · 双击就能打开</em></pre>' +
        '<p style="margin-top:8px">三个文件放进同一个文件夹，<b>不改名字、不改路径</b>——它靠名字找彼此。</p></div>' +
        '</div>' +

        '<div class="tw-two">' +
        '<div class="tw-box"><h4>③ 运行：先填两把钥匙</h4>' +
        '<div class="tw-runitem"><span class="n">1</span><span class="t">设置 → 填 <b>DeepSeek Key</b>（<code>sk-</code> 开头）' +
        '<span class="see">这是「大脑」：负责点单和作答</span></span></div>' +
        '<div class="tw-runitem"><span class="n">2</span><span class="t">设置 → 填 <b>高德 Key</b>（32 位）' +
        '<span class="see">这是「腿」：19 个服务共用；平台类型必须「Web 服务」，否则 10009</span></span></div>' +
        '<p style="margin-top:8px">两个 Key 只存在<b>本机浏览器</b>里，不上传任何服务器。</p>' +
        '</div>' +
        '<div class="tw-box is-good"><h4>④ 验收：照 ⑥ 的清单逐条问</h4>' +
        '<div class="tw-runitem"><span class="n">1</span><span class="t">找地方：「颐和园附近有停车场吗？」' +
        '<span class="see">给出名字、地址，地图上还多了个点</span></span></div>' +
        '<div class="tw-runitem"><span class="n">2</span><span class="t">算路线：「从五一小学到颐和园开车多久？」' +
        '<span class="see">距离、耗时，地图上有一条线</span></span></div>' +
        '<div class="tw-runitem"><span class="n">3</span><span class="t">查天气：「明天去颐和园要带伞吗？」' +
        '<span class="see">实况 ＋ 未来几天，说清是哪一天</span></span></div>' +
        '<div class="tw-runitem"><span class="n">4</span><span class="t">画地图：「把这三个地方标出来」' +
        '<span class="see">气泡里是一张图，不是一串 JSON</span></span></div>' +
        '<div class="tw-runitem"><span class="n">5</span><span class="t">越界：「给我出一道数学题」' +
        '<span class="see">礼貌拒绝再拉回出行——⑧ 的系统提示词在起作用</span></span></div>' +
        '<p style="margin-top:8px">五条都过，第 ⑥ 关那张清单就算<b>交付</b>了。</p>' +
        '</div>' +
        '</div>' +

        '<div class="tw-box is-bad" style="margin-top:12px"><h4>跑不通就先看这四条</h4>' +
        '<p><b>10009</b> → 平台类型选错了，要「Web 服务」。<br>' +
        '<b>路线查不到</b> → 地名要先换成坐标；天气要 <code>adcode</code>，不是城市名。<br>' +
        '<b>地图不出来</b> → F12 → Network 里看那条 <code>staticmap</code> 的状态码；程序会先退成<b>纯底图</b>，仍失败才移除。<br>' +
        '<b>Key 不生效</b> → 换个浏览器就要重填，它只存在本机。</p></div>' +

        '<div class="tw-note">还搞不定，就回 ⑨ 按「现象 + 原文 + 我试过什么」三句话去问 AI。' +
        '<b>能定位，就能自己修</b>——这比记住多少代码都值钱。</div>' +
        '</div></div>'
    }
  ];

  /* ============================================================
   * ① 渲染十张卡
   * ============================================================ */
  sec.innerHTML = CARDS.map(function (c) { return c.html; }).join("");
  var kept = Array.prototype.slice.call(sec.querySelectorAll(".card"));

  /* ⑦ 关「9 扇门」卡片点击弹窗：给小学生看的官方功能介绍 */
  var GATE_MODAL_HTML =
    '<div class="tw-gate-pop" id="tw-gate-pop" hidden>' +
      '<div class="tw-gate-pop-mask" data-close></div>' +
      '<div class="tw-gate-pop-card" role="dialog" aria-modal="true" aria-label="工具介绍">' +
        '<button class="tw-gate-pop-x" type="button" data-close aria-label="关闭">×</button>' +
        '<div class="tw-gate-pop-h">' +
          '<span class="tw-gate-pop-badge">🛠</span>' +
          '<div class="tw-gate-pop-t"><h3 id="tw-gate-pop-name"></h3><code id="tw-gate-pop-path"></code></div>' +
        '</div>' +
        '<div class="tw-gate-pop-b">' +
          '<p class="tw-gate-pop-p"><b>一句话：</b><span id="tw-gate-pop-plain"></span></p>' +
          '<div class="tw-gate-pop-sec">' +
            '<h4>输入参数<span>要喂给它什么</span></h4>' +
            '<dl class="tw-gate-pop-dl" id="tw-gate-pop-params"></dl>' +
          '</div>' +
          '<div class="tw-gate-pop-sec">' +
            '<h4>返回结果<span>它吐出什么</span></h4>' +
            '<dl class="tw-gate-pop-dl" id="tw-gate-pop-returns"></dl>' +
          '</div>' +
          '<div class="tw-gate-pop-tip" id="tw-gate-pop-tip"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.insertAdjacentHTML("beforeend", GATE_MODAL_HTML);

  function openGateModal(key) {
    var info = GATE_INFO[key];
    if (!info) return;
    document.getElementById("tw-gate-pop-name").textContent = info.name;
    document.getElementById("tw-gate-pop-path").textContent = info.path;
    document.getElementById("tw-gate-pop-plain").textContent = info.plain;
    document.getElementById("tw-gate-pop-params").innerHTML = gateParamsHTML(info.params || []);
    document.getElementById("tw-gate-pop-returns").innerHTML = gateReturnsHTML(info.returns || []);
    document.getElementById("tw-gate-pop-tip").textContent = info.tip;
    document.getElementById("tw-gate-pop").hidden = false;
  }
  function closeGateModal() { var p = document.getElementById("tw-gate-pop"); if (p) p.hidden = true; }
  var gatePop = document.getElementById("tw-gate-pop");
  if (gatePop) {
    gatePop.addEventListener("click", function (e) {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute("data-close")) closeGateModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeGateModal();
    });
  }

  /* ============================================================
   * ② 两处小互动（表格切换 / 钥匙计数）
   * ============================================================ */
  sec.addEventListener("click", function (e) {
    var target = e.target;

    /* ⑦ 关：点「9 扇门」卡片 → 弹出该工具的介绍 */
    var gate = target.closest ? target.closest(".tw-gate") : null;
    if (gate) { openGateModal(gate.getAttribute("data-gate")); return; }

    /* 互动：数一数几把钥匙 */
    var countBtn = target.closest ? target.closest("#tw-count-key") : null;
    if (countBtn) {
      var result = $("tw-key-result");
      if (result) result.hidden = false;
      countBtn.disabled = true;
      countBtn.textContent = "答案是：一把（19 个服务共用同一把）";
      if (typeof fitHeight === "function") setTimeout(fitHeight, 60);
    }
  });

  /* ⑦ 关：键盘也能开弹窗（Enter / 空格） */
  sec.addEventListener("keydown", function (e) {
    var g = e.target.closest ? e.target.closest(".tw-gate") : null;
    if (g && (e.key === "Enter" || e.key === " " || e.key === "Spacebar")) {
      e.preventDefault();
      openGateModal(g.getAttribute("data-gate"));
    }
  });

  /* ============================================================
   * ③ 第 ⑧ 关：真实的一次工具调用（请求 ↔ 响应 · 四个视角）
   * ------------------------------------------------------------
   * 一轮一轮的大模型调用 + 每轮之间的高德 API 调用：
   *   ① 带 tools（全是高德 Web 服务 API）提问 → 模型返回 tool_calls
   *   ② 程序按官方文档的地址与参数真的调用高德 API
   *   ③ 把工具结果回填，再问第二轮 → 模型给人话（真实）
   * 没配 Key 时**不发请求**，只显示真实的请求体，绝不假造响应。
   * ============================================================ */
  (function initIO() {
    var host = $("tw-io");
    if (!host) return;

    var API = window.AgentLab && window.AgentLab.API;
    /* 开关状态：每个高德 API 一个（默认见 AMAP_TOOLS.on），再加三个教学开关 */
    var DEFAULT = {};
    AMAP_TOOLS.forEach(function (t) { DEFAULT[t.k] = t.on ? 1 : 0; });
    var st = {};
    for (var dk in DEFAULT) st[dk] = DEFAULT[dk];
    var sending = false;
    /* 一次提问最多来回几轮大模型调用。留 4 轮是为了"IP 定位 → 查天气 → 作答"
     * 这种有依赖关系的题：第一轮先调 amap_ip，第二轮拿城市查天气，第三轮才说话。 */
    var MAX_ROUNDS = 4;
    var lastRoute = null;
    /* 这一问里搜到的地点（周边 / 关键字）：答案下面要打点画图，和路线图共用一个开关 */
    var lastPois = null;
    /* 一趟搜索最多交给模型几条（硬上限）。实际条数由每只工具的 poiCount 区间随机决定：
     * 关键字搜索 4~6、周边搜索 3~5。summarize 与地图打点共用这个上限，序号才对得上。 */
    var POI_LIMIT = 8;

    /* 在 [min, max] 里随机取一个整数，作为这次请求的 offset。
     * 同一句话连问几次，条数会在区间里跳动，避免学生以为「结果永远是 3 条」。 */
    function pickPoiCount(range) {
      var lo = Number(range[0]), hi = Number(range[1]);
      return String(lo + Math.floor(Math.random() * (hi - lo + 1)));
    }
    /* 这一批（一只工具）真实发出去的 GET，按顺序记下来，给「收回来的」摊开用 */
    var httpLog = [];
    var MAX_CHARS = 1500;
    var AMAP_STORE = "lesson_tools_amap_key_v1";

    var reqBox = host.querySelector('[data-role="req"]');
    var respBox = host.querySelector('[data-role="resp"]');
    var humanBox = host.querySelector('[data-role="human"]');
    var hintBox = host.querySelector('[data-role="hint"]');
    var sendBtn = host.querySelector('[data-role="send"]');
    var sendLabel = host.querySelector('[data-role="send-label"]');
    var resetBtn = host.querySelector('[data-role="reset"]');
    var keyState = host.querySelector('[data-role="keystate"]');
    var keyDot = host.querySelector('[data-role="dot"]');
    var modelTip = host.querySelector('[data-role="model"]');
    var saveKeyBtn = host.querySelector('[data-role="savekey"]');
    var amapInput = $("tw-io-amap");
    var qInput = $("tw-io-q");

    var SYS_BASE = "你是「出行小助手」，帮小学生查路线、看天气、找地方。\n\n" +
      "【不知道地点】用户只说「我这里 / 我这儿 / 附近」、没说城市时：这一轮开着 IP 定位就先查它（amap_ip）；" +
      "没开就直说「不知道你在哪个城市」，问一句再往下查——不许拿示例里的北京替他的位置，也不许凭印象替他挑一个城市。\n\n" +
      "【怎么选工具】所有外部信息只能通过高德 API 查，不许凭印象；这一轮实际能用的以 tools 为准，没给的就别调。这一轮开着的工具分工：\n";
    /* 每个工具一行；关掉的就不会写进提示词，避免“提示词教了、tools 却没给”的自相矛盾 */
    var TOOL_HINT = {
      geo: "· 地名→坐标：amap_geocode",
      placetext: "· 只记得名字、要找具体地点：amap_place_text",
      regeo: "· 给了坐标问「这是哪儿」：amap_regeocode",
      placearound: "· 问「附近有什么」：amap_place_around（先有坐标才能查周边）",
      driving: "· 问怎么走、多远、多久：amap_direction_driving（起终点要带城市）",
      weather: "· 问天气：amap_weather（明天/后天/周末用 extensions=all，问现在用 base）",
      ip: "· 问「我在哪/我这里」：amap_ip；拿不到就直接问用户在哪个城市，不要猜",
      district: "· 问有哪些区、adcode：amap_district"
    };
    var SYS_TAIL =
      "【一次问两件事】先都查了再一起答（「怎么走、穿什么」＝路线＋天气）；一步查不全就补一步，最多来回几轮，别急着下结论。\n" +
      "【天气】工具给未来四天，只讲用户问的那一天，不要罗列。\n" +
      "【失败】说清哪一步没查成、为什么；同一个错别反复重试，可以换个更具体的说法（加区名、具体到门）再试一次。\n" +
      "【边界】不聊与出行无关的话题；票价、开放时间、政策这类工具查不到的不要编；不代替用户付款、订票。\n" +
      "【回答】先给结论，再给依据（哪个接口查到的数字）；用短句，适合小学生读。";
    /* 系统提示词随开关动态生成：只列当前打开的 model 工具 */
    function sysOf() {
      var lines = [];
      AMAP_TOOLS.forEach(function (t) {
        if (t.model && st[t.k] && TOOL_HINT[t.k]) lines.push(TOOL_HINT[t.k]);
      });
      return SYS_BASE + lines.join("\n") + "\n\n" + SYS_TAIL;
    }

    /* ---------- 小工具 ---------- */
    function esc(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    function code(s) { return '<pre class="tw-code">' + s + "</pre>"; }
    function mut(s) { return '<p class="is-mut">' + s + "</p>"; }
    /* 还没点「发送」时那块大白板的占位：虚线框、居中站好，写清"这里会出现什么"。
     * 真结果进来后 innerHTML 被整段替换，占位跟着消失，不用手动清理。 */
    function stub(s) { return '<div class="tw-io-stub"><span>' + s + "</span></div>"; }
    function stepNote(s) { return '<div class="tw-step-note">' + s + "</div>"; }

    /* ---------- 视角④的两折叠：和 ⑤ 的「请求 / 响应」同一套长相 ----------
     * 一只工具可能连发好几次 GET（先地名→坐标、再查天气）：请求里按真实顺序全列出来，
     * 响应里既给"交给模型的那句话"，也给高德回来的原文。Key 一律打码。 */
    function maskUrl(u) {
      var s = String(u);
      /* 地址里的中文是 encodeURIComponent 过的，大屏上要读得懂，先解回来再打码 */
      try { s = decodeURIComponent(s); } catch (e) { /* 解不开就原样显示 */ }
      return esc(s.replace(/([?&]key=)[^&]*/i, "$1●●●●●●"));
    }
    function prettyText(txt) {
      var s = String(txt || "");
      try { s = JSON.stringify(JSON.parse(s), null, 2); } catch (e) { /* 不是 JSON 就原样显示 */ }
      if (s.length > MAX_CHARS) s = s.slice(0, MAX_CHARS) + "\n…（原文共 " + s.length + " 字，这里截断）";
      return esc(s);
    }
    function reqFold(reqs) {
      var seen = [];
      reqs.forEach(function (r) {
        var hit = null;
        for (var i = 0; i < seen.length; i++) if (seen[i].path === r.path) hit = seen[i];
        if (hit) hit.n++; else seen.push({ path: r.path, n: 1 });
      });
      var head = "请求 · GET " + seen.map(function (s) {
        return s.path + (s.n > 1 ? " ×" + s.n : "");
      }).join(" + ");
      /* 请求折里只有"发出去的"：地址 + 参数。回来的东西一律留给响应折，不重复。 */
      var txt = reqs.map(function (r, i) {
        return (reqs.length > 1 ? "// 第 " + (i + 1) + " 次\n" : "") +
          '<span class="c">GET</span> ' + maskUrl(r.url);
      }).join("\n\n");
      return '<details class="tw-fold"><summary>' + head + "</summary>" + code(txt) + "</details>";
    }
    function backFold(round, label, reqs, r) {
      var last = reqs[reqs.length - 1];
      var ms = 0;
      reqs.forEach(function (x) { ms += x.ms; });
      var head = "第 " + round + " 轮 · " + label + " 响应 · HTTP " + last.status + " · " + ms + " ms" +
        (reqs.length > 1 ? "（" + reqs.length + " 次 GET 合计）" : "");
      var body = '<span class="c">// 程序整理成这段文字交给模型（只删冗余字段，答案一条不删）：</span>\n' + esc(r.text) + "\n\n" +
        '<span class="c">// 高德回来的原文：</span>\n' + prettyText(last.text) +
        (r.source ? "\n\n" + '<span class="c">// 来源：' + esc(r.source) + "</span>" : "");
      return '<details class="tw-fold"><summary>' + head + "</summary>" + code(body) + "</details>";
    }
    function qText() {
      var v = qInput ? qInput.value.replace(/\s+/g, " ").trim() : "";
      return v || "明天去颐和园怎么走、穿什么？";
    }
    function hasKey() { return !!(API && API.hasApiKey && API.hasApiKey()); }
    function modelName() {
      try { return (API && API.getSettings && API.getSettings().model) || "deepseek-flash"; }
      catch (e) { return "deepseek-flash"; }
    }
    function amapKey() {
      try { return (localStorage.getItem(AMAP_STORE) || "").trim(); } catch (e) { return ""; }
    }
    function hint(s) { if (hintBox) hintBox.innerHTML = s; }
    function tidy() { if (typeof fitHeight === "function") setTimeout(fitHeight, 60); }

    /* ---------- 状态条：Key 配没配 ---------- */
    function drawReady() {
      if (keyState) {
        keyState.innerHTML = hasKey()
          ? '大模型：<b class="ok">已配置</b>　外部工具：' +
            (amapKey() ? '<b class="ok">高德 Web 服务 Key 已填</b>' : '<b class="no">高德 Key 未填</b>（右侧填）') +
            '　点发送就是真实的多轮调用'
          : '大模型：<b class="no">未配置</b>　先回 <a href="index.html">首页 → 右上角「设置」</a> 填 DeepSeek Key，否则发不出去';
      }
      if (keyDot) keyDot.className = "tw-dot" + (hasKey() ? " is-ok" : " is-no");
      if (modelTip) modelTip.textContent = "模型 " + modelName();
    }

    /* ---------- 工具声明：开关开着的每个高德 API，原样写进 tools ---------- */
    function toolsOf() {
      var out = [];
      AMAP_TOOLS.forEach(function (t) {
        if (!st[t.k] || !t.model) return;
        out.push({
          type: "function",
          function: {
            name: t.name,
            description: t.desc,
            parameters: {
              type: "object",
              properties: t.params || {},
              required: t.required || []
            }
          }
        });
      });
      return out;
    }

    function messagesOf() {
      return [
        { role: "system", content: sysOf() },
        { role: "user", content: qText() }
      ];
    }

    /* 每轮都带 tools，直到它不再点单；到了最后一轮（第 MAX_ROUNDS 轮）才不带 tools，
     * 强制它交出答案，避免一直点下去。 */
    function bodyOf(messages, withTools) {
      var body = {
        model: modelName(),
        messages: messages,
        temperature: 0.2,
        thinking: { type: "disabled" }
      };
      if (withTools !== false) {
        var tools = toolsOf();
        if (tools.length) { body.tools = tools; body.tool_choice = "auto"; }
      }
      return body;
    }

    /* ---------- 视角③：把真实请求体原样画出来（Key 打码） ---------- */
    function reqText(body, label) {
      return (label ? '<span class="c">// ' + label + '</span>\n' : "") +
        '<span class="c">POST</span> https://api.deepseek.com/chat/completions\n' +
        "Content-Type: application/json\n" +
        'Authorization: Bearer <span class="c">sk-●●●●●●（你的真实 Key，不显示在这里）</span>\n\n' +
        esc(JSON.stringify(body, null, 2));
    }
    function renderReq(body) {
      if (reqBox) reqBox.innerHTML = code(reqText(body, "第 1 轮请求 · 根据输入决定调哪只工具（还没发送）"));
    }
    /* 已经发生的每一轮请求都留着，方便对照"这一轮它多知道了什么"。
     * 摘要统一写成「第 N 轮请求 · X 个工具 · Y 条消息」——工具数只在这里出现一次，
     * 右下「收回来的」只讲响应，不重复请求信息。
     * 默认折叠成一行，点开才铺开完整 JSON。 */
    function renderReqs(list) {
      if (!reqBox) return;
      reqBox.innerHTML = list.map(function (b, i) {
        var last = i === list.length - 1;
        var nTools = (b.tools || []).length;
        var label = "第 " + (i + 1) + " 轮请求 · " +
          (nTools ? nTools + " 个工具" : "没给工具") + " · " +
          b.messages.length + " 条消息" +
          (last && i > 0 ? "（比上一轮多了工具结果）" : "");
        return '<details class="tw-fold"><summary>' + label + "</summary>" +
          code(reqText(b, "")) + "</details>";
      }).join("");
    }

    function renderReqDefault() {
      renderReq(bodyOf(messagesOf()));
    }

    /* ---------- 高德：四步法的第四个参数就是 key ---------- */
    function amapGet(path, params) {
      var k = amapKey();
      var q = [];
      for (var key in params) {
        if (params[key] === undefined || params[key] === null) continue;
        q.push(encodeURIComponent(key) + "=" + encodeURIComponent(params[key]));
      }
      q.push("key=" + encodeURIComponent(k));
      var url = "https://restapi.amap.com" + path + "?" + q.join("&");
      /* 每一次 GET 都记一笔：右下「收回来的」要按真实顺序摊开，
       * 学生才看得见"模型点一次单，程序背后可能发了三次请求"。 */
      var rec = { path: path, url: url, status: 0, ms: 0, text: "" };
      httpLog.push(rec);
      var t0 = Date.now();
      return fetch(url).then(function (r) {
        rec.status = r.status;
        return r.text().then(function (t) { rec.text = t; });
      }).then(function () {
        rec.ms = Date.now() - t0;
        var d = null;
        try { d = JSON.parse(rec.text); } catch (e) { d = null; }
        if (!d) throw new Error("高德回的不是 JSON（HTTP " + rec.status + "）");
        if (String(d.status) !== "1") {
          throw new Error("高德：" + (d.info || "出错") + "（infocode " + (d.infocode || "?") + "）");
        }
        return d;
      });
    }

    /* 地名默认按北京解析：
     * 「五一小学」这类名字全国到处都是，不限定城市时高德会返回外地的同名学校，
     * 于是路线会变成"北京→外地"的几百上千公里 —— 这不是接口的错，是参数没给全。 */
    var DEFAULT_CITY = "北京";

    function amapGeocode(addr, city) {
      var c = (city === null) ? "" : (city || DEFAULT_CITY);

      function pick(list, wanted) {
        /* 同一个查询可能回多条（不同城市同名），优先取城市/省份对得上的那条 */
        var hit = null;
        if (wanted) {
          var bare = wanted.replace(/市$/, "");
          for (var i = 0; i < list.length; i++) {
            var g = list[i];
            if ((g.cityname && g.cityname.indexOf(bare) >= 0) ||
                (g.provincename && g.provincename.indexOf(bare) >= 0)) { hit = g; break; }
          }
        }
        hit = hit || list[0];
        if (!hit || !hit.location) throw new Error("高德没找到「" + addr + "」");
        return {
          location: hit.location,
          adcode: hit.adcode,
          name: hit.formatted_address || addr,
          cityname: hit.cityname || "",
          level: hit.level || "",
          fallbackCity: false
        };
      }

      return amapGet("/v3/geocode/geo", c ? { address: addr, city: c } : { address: addr })
        .then(function (d) {
          var list = d.geocodes || [];
          if (list.length) return pick(list, c);
          if (!c) throw new Error("高德没找到「" + addr + "」");
          /* 限定了城市却一条都没有：退回全国范围再找一次，并打上标记，
           * 让工具结果里那句"可能认错城市"能被看见，而不是悄悄给个外地结果。 */
          return amapGet("/v3/geocode/geo", { address: addr }).then(function (d2) {
            var l2 = d2.geocodes || [];
            if (!l2.length) throw new Error("高德没找到「" + addr + "」");
            var g = pick(l2, "");
            g.fallbackCity = true;
            return g;
          });
        });
    }

    /* 学校、小区、公园这类名字，用 POI 搜索比地理编码找得准：
     * 地理编码常常只给到"某市某区"，那种点落在区政府，路线自然不对。 */
    function amapPlaceText(keywords, city) {
      var params = { keywords: keywords, offset: 1, page: 1, extensions: "base" };
      var c = (city === null) ? "" : (city || DEFAULT_CITY);
      if (c) { params.city = c; params.citylimit = "true"; }
      return amapGet("/v3/place/text", params).then(function (d) {
        var p = (d.pois || [])[0];
        if (!p || !p.location) return null;
        return {
          location: p.location,
          adcode: p.adcode,
          name: p.name || keywords,
          cityname: p.cityname || "",
          level: "兴趣点",
          fallbackCity: false
        };
      }).catch(function () { return null; });
    }

    /* ---------- 外部工具：全部是高德 Web 服务 API ---------- */
    /* 天气查询（GET /v3/weather/weatherInfo）。
     * 官方两种返回互斥：extensions=base 只给 lives（当前实况）；
     * extensions=all 只给 forecasts[].casts[]（今天起四天预报）。
     * 问「明天/后天/周末」必须走 all，而且要把四天全部交给模型，它才知道明天是哪一行。 */
    var WEEK_CN = { "1": "一", "2": "二", "3": "三", "4": "四", "5": "五", "6": "六", "7": "日" };

    function execWeather(a) {
      if (!amapKey()) return Promise.resolve({ ok: false, text: "没有高德 Key：天气查询 API 调不了（在上面输入框填 Key）" });
      /* 城市必须由用户给出、或由 IP 定位查到。
       * 缺了就报错、让模型去问 —— 绝不能默认北京，否则「我这里天气」
       * 会凭空变成「北京天气」，等于替用户瞎猜了一个城市。 */
      var city = (a.city == null) ? "" : String(a.city).trim();
      if (!city) {
        return Promise.resolve({
          ok: false,
          text: "缺少城市/地区编号：天气查询必须先知道是哪个城市。请先确认用户在哪个城市，再查询。",
          doc: toolByKey("weather")
        });
      }
      var ext = (String(a.extensions || "").toLowerCase() === "base") ? "base" : "all";
      var adcodeP = /^\d{6}$/.test(city)
        ? Promise.resolve({ adcode: city, name: city })
        : amapGeocode(city, null);

      return adcodeP.then(function (g) {
        return amapGet("/v3/weather/weatherInfo", {
          city: g.adcode, extensions: ext, output: "JSON"
        }).then(function (w) {
          var raw = JSON.stringify(w);
          var text;

          if (ext === "all") {
            var fc = (w.forecasts || [])[0] || {};
            var casts = fc.casts || [];
            if (!casts.length) throw new Error("高德没有返回预报数据（forecasts 为空）");
            var lines = casts.map(function (c) {
              return c.date + "（周" + (WEEK_CN[c.week] || c.week || "?") + "）" +
                (c.dayweather || "") + "转" + (c.nightweather || "") + "，" +
                (c.nighttemp || "?") + "~" + (c.daytemp || "?") + "℃，" +
                "白天" + (c.daywind || "") + "风" + (c.daypower || "?") + "级 / " +
                "夜间" + (c.nightwind || "") + "风" + (c.nightpower || "?") + "级";
            });
            text = (fc.city || city) + "（adcode " + (fc.adcode || g.adcode) + "）发布 " +
              (fc.reporttime || "?") + "，未来 " + casts.length + " 天预报：\n" + lines.join("\n");
          } else {
            var live = (w.lives || [])[0];
            if (!live) throw new Error("高德没有返回实况数据（lives 为空）");
            text = live.city + "（adcode " + live.adcode + "）" + (live.reporttime || "") + " 实况：" +
              live.weather + " " + live.temperature + "℃，" +
              (live.winddirection || "") + "风 " + (live.windpower || "") + "级，湿度 " + (live.humidity || "?") + "%";
          }

          return {
            ok: true,
            text: text,
            raw: raw,
            source: "高德 /v3/weather/weatherInfo（adcode " + g.adcode + "，extensions=" + ext + "）",
            doc: toolByKey("weather")
          };
        });
      }).catch(function (e) { return { ok: false, text: "天气查询失败：" + e.message, doc: toolByKey("weather") }; });
    }

    /* 高德的"空值"常返回空数组而不是空字符串，直接拼会冒出 "[]" */
    function plain(v) {
      if (v === undefined || v === null) return "";
      if (Object.prototype.toString.call(v) === "[object Array]") return "";
      return String(v);
    }

    /* 高德 /v3/ip 只解析 IPv4；手机热点、校园网常分到 IPv6（240e: 开头之类），
     * 这时高德返回 status=1 但字段全空。myip.ipip.net 同时支持 v4/v6 且允许跨域，
     * 作为可选兜底：返回纯文本 "当前 IP：… 来自于：中国 北京 北京  电信"。 */
    function fetchIpip() {
      return fetch("https://myip.ipip.net/", { cache: "no-store" })
        .then(function (r) { return r.text(); })
        .then(function (t) {
          var m = /当前\s*IP[：:]\s*([^\s<]+)[\s\S]*?来自于[：:]\s*([\s\S]+)/.exec(String(t));
          if (!m) return null;
          var parts = m[2].replace(/<[^>]*>/g, " ").trim().split(/\s+/);
          return {
            ip: m[1].trim(),
            country: parts[0] || "",
            province: parts[1] || "",
            city: parts[2] || "",
            isp: parts[3] || ""
          };
        })
        .catch(function () { return null; });
    }

    /* IP 定位（GET /v3/ip）：不传 ip 时按"请求来源 IP"定位。
     * 高德空结果时用 ipip.net 兜底；两边都拿不到，就如实请用户说城市。 */
    function execIp(a) {
      if (!amapKey()) {
        return Promise.resolve({ ok: false, text: "没有高德 Key：IP 定位调不了（在上面输入框填 Key）", doc: toolByKey("ip") });
      }
      var params = { output: "JSON" };
      if (a && plain(a.ip)) params.ip = plain(a.ip);

      return amapGet("/v3/ip", params).then(function (d) {
        var prov = plain(d.province);
        var city = plain(d.city);
        var adcode = plain(d.adcode);
        var rect = plain(d.rectangle);
        var raw = JSON.stringify(d);

        if (!prov && !city && !adcode) {
          /* 高德只认 IPv4 → 用 ipip.net 兜底拿省市，再换 adcode，后续天气/周边还能接着用 */
          return fetchIpip().then(function (fb) {
            var cityName = fb ? (fb.city || fb.province) : "";
            if (!cityName) {
              return {
                ok: false,
                text: "IP 定位没拿到归属地：高德只解析 IPv4，这个出口 IP 库里没有" +
                  "（手机热点、校园网常分到 IPv6，比如 240e: 开头）；ipip.net 兜底也没拿到。" +
                  "请直接问用户在哪座城市，不要猜。",
                raw: raw,
                source: "高德 /v3/ip（空）+ myip.ipip.net（也没拿到）",
                doc: toolByKey("ip")
              };
            }

            var area = [fb.province, fb.city].filter(Boolean);
            if (area.length === 2 && area[0] === area[1]) area = [area[0]];
            var where = area.join(" ");

            return amapGeocode(cityName, null).then(function (g) {
              return {
                ok: true,
                text: "IP 定位（城市级；ipip.net 兜底，因为高德只解析 IPv4）：" + where +
                  "（" + (fb.isp || "运营商未知") + "，" + fb.ip + "），adcode " + g.adcode +
                  "，参考中心坐标 " + g.location + "（城市中心附近，不是你的精确位置）",
                raw: raw,
                source: "myip.ipip.net（第三方兜底）+ 高德 /v3/geocode/geo（换 adcode）",
                doc: toolByKey("ip")
              };
            }).catch(function () {
              return {
                ok: true,
                text: "IP 定位（ipip.net 兜底）：" + where + "（" + (fb.isp || "运营商未知") + "）；" +
                  "没换到 adcode，查天气可直接用城市名",
                raw: raw,
                source: "myip.ipip.net（第三方兜底）",
                doc: toolByKey("ip")
              };
            });
          });
        }

        /* rectangle 是两个对角点，取中点当"大致坐标"，好让周边搜索接着用 */
        var center = "";
        if (rect && rect.indexOf(";") > 0) {
          var p1 = rect.split(";")[0].split(",");
          var p2 = rect.split(";")[1].split(",");
          var lng = (Number(p1[0]) + Number(p2[0])) / 2;
          var lat = (Number(p1[1]) + Number(p2[1])) / 2;
          if (isFinite(lng) && isFinite(lat)) center = lng.toFixed(6) + "," + lat.toFixed(6);
        }

        var where = prov + (city && city !== prov ? " " + city : "");
        return {
          ok: true,
          text: "IP 定位（城市级，只能到市/区，到不了街道）：" + where + "（adcode " + adcode + "）" +
            (center ? "，参考中心坐标 " + center + "（矩形范围的中点，不是你的精确位置）" : ""),
          raw: raw,
          source: "高德 /v3/ip（按请求来源 IP）",
          doc: toolByKey("ip")
        };
      }).catch(function (e) {
        return { ok: false, text: "IP 定位失败：" + e.message, doc: toolByKey("ip") };
      });
    }

    /* 把高德返回的原始 JSON 压成人话再交给模型。字段全部按官方文档。 */
    function summarize(tool, d) {
      var k = tool.k;
      if (k === "geo") {
        var g = (d.geocodes || [])[0] || {};
        return "地理编码：" + (g.formatted_address || "无结果") + " → " + (g.location || "") +
          "（adcode " + (g.adcode || "") + "，匹配级别 " + (g.level || "") + "）";
      }
      if (k === "regeo") return "逆地理编码：" + (((d.regeocode || {}).formatted_address) || "无结果");
      if (k === "district") {
        var a = (d.districts || [])[0] || {};
        /* 下级名单本身就是答案（"北京有哪些区"），一条都不许删。
         * 名单短（≤20）就把 adcode 一起给——下一步查天气正好要用；
         * 名单很长才截到 40 条，而且必须说清总共多少个、还有几个没列。 */
        var raw = a.districts || [];
        var withCode = raw.length <= 20;
        var names = raw.map(function (x) {
          return withCode ? ((x.name || "") + "(" + (x.adcode || "") + ")") : (x.name || "");
        });
        var CAP = 40;
        var tail = raw.length > CAP
          ? "……另外 " + (raw.length - CAP) + " 个没列出（共 " + raw.length + " 个，可以带上名字再查）"
          : "";
        return "行政区：" + (a.name || "") + "（adcode " + (a.adcode || "") + "，中心 " + (a.center || "") + "）" +
          (raw.length
            ? "\n下级 " + raw.length + " 个：" + names.slice(0, CAP).join("、") + tail
            : "");
      }
      if (k === "ip") return "IP定位：" + (d.province || "") + " " + (d.city || "") + "（adcode " + (d.adcode || "") + "）";
      if (k === "convert") return "坐标转换：" + (d.locations || "无结果");
      if (k === "placetext" || k === "placearound") {
        var pois = (d.pois || []).slice(0, POI_LIMIT).map(function (p, i) {
          return (i + 1) + ". " + (p.name || "") + " — " + (p.address || "") + " " + (p.location || "");
        });
        return tool.label + "：" + (d.count || "0") + " 条，取前 " + pois.length +
          " 条\n" + (pois.join("\n") || "无结果");
      }
      if (k === "tips") {
        var tips = (d.tips || []).slice(0, 3).map(function (p) {
          return p.name + "｜" + (p.district || "") + "｜" + (p.adcode || "") + "｜" + (p.location || "");
        });
        return "输入提示：" + (tips.join("\n") || "无结果");
      }
      if (k === "traffic") {
        var ti = d.trafficinfo || {};
        return "交通态势：" + (ti.description || "") +
          "（畅通 " + ((ti.evaluation || {}).expedite || "?") + "，拥堵 " + ((ti.evaluation || {}).congested || "?") + "）";
      }
      return JSON.stringify(d).slice(0, 600);
    }

    /* 搜地点（周边 / 关键字）拿到了坐标，就记下来：答案下面要按这些点画一张静态地图。
     * 只记交给模型的那几条（summarize 里同样是前 POI_LIMIT 条），图上的序号才对得上答案。 */
    function rememberPois(tool, args, d) {
      var okLoc = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
      var list = (d.pois || []).filter(function (p) {
        return p && okLoc.test(String(p.location || "").trim());
      }).slice(0, POI_LIMIT);
      if (!list.length) return;
      lastPois = {
        label: tool.label,
        items: list,
        center: String((args && args.location) || "").trim()
      };
    }

    /* 其余高德 API：按官方参数名拼 URL，一次 GET，status=1 才算成功 */
    function runGeneric(tool, args) {
      if (!amapKey()) {
        return Promise.resolve({ ok: false, text: "没有高德 Key：" + tool.label + " 调不了（在上面输入框填 Key）", doc: tool });
      }
      var params = {};
      var props = tool.params || {};
      for (var key in props) {
        if (args[key] !== undefined && args[key] !== null && args[key] !== "") params[key] = args[key];
      }
      for (var dk in (tool.defaults || {})) params[dk] = tool.defaults[dk];
      /* 搜地点：条数不由模型说了算，每次在工具自己的区间里随机 */
      if (tool.poiCount) params.offset = pickPoiCount(tool.poiCount);
      return amapGet(tool.path, params).then(function (d) {
        if (tool.k === "placetext" || tool.k === "placearound") rememberPois(tool, args, d);
        var raw = JSON.stringify(d);
        return {
          ok: true,
          text: summarize(tool, d),
          raw: raw,
          source: "高德 " + tool.path + "（官方参数 " + Object.keys(params).join(", ") + "）",
          doc: tool
        };
      }).catch(function (e) {
        return { ok: false, text: tool.label + "调用失败：" + e.message, doc: tool };
      });
    }

    function execRoute(a) {
      if (!amapKey()) {
        return Promise.resolve({ ok: false, text: "没有高德 Key：路线查不了（在上面的输入框填 Key 再试）" });
      }
      var origin = a.origin || "五一小学";
      var dest = a.destination || "颐和园";
      var city = a.city || DEFAULT_CITY;
      var O = null, D = null;

      /* 地名 → 坐标：这一步在工具内部，模型看不见（第 ⑦ 关讲的"它只认经纬度"）。
       * 注意：模型可能已经给了 lng,lat（比如它上一轮刚查过地理编码），
       * 那就直接用，绝不能再把坐标当地名去查一遍——那样查不到，整条路线就废了。
       * 只解析到"市 / 区县 / 道路"时说明没找到具体那个点，再用 POI 搜索兜底。 */
      var COORD_RE = /^-?\d{1,3}(\.\d+)?\s*,\s*-?\d{1,2}(\.\d+)?$/;

      function prep(addr) {
        var raw = String(addr == null ? "" : addr).trim();
        if (COORD_RE.test(raw)) {
          var loc = raw.replace(/\s+/g, "");
          return Promise.resolve({ location: loc, name: "坐标 " + loc, level: "坐标", fallbackCity: false });
        }
        return amapGeocode(raw, city).then(function (g) {
          if (/国家|省|市|区县|开发区|道路/.test(g.level || "")) {
            return amapPlaceText(raw, city).then(function (p) { return p || g; });
          }
          return g;
        });
      }

      /* show_fields 是官方可选参数：模型可以传，但 cost / polyline 必须有，
       * 否则拿不到耗时和轨迹。
       * v5 引擎对起终点比较挑：太近、被认成同一个点、落在没有路网的地方，
       * 都会回 status=0 / ENGINE_RESPONSE_DATA_ERROR(30001)，这时换 v3 老引擎再试一次。 */
      var fields = String(a.show_fields || "cost,polyline");
      if (fields.indexOf("cost") < 0) fields += ",cost";
      if (fields.indexOf("polyline") < 0) fields += ",polyline";

      function drive(o, d) {
        return amapGet("/v5/direction/driving", {
          origin: o, destination: d, show_fields: fields
        }).then(function (r) {
          var p = ((r.route || {}).paths || [])[0];
          if (!p) throw new Error("高德没有规划出驾车路线");
          return {
            distance: Number(p.distance),
            duration: Number((p.cost || {}).duration || 0),
            steps: p.steps || [],
            raw: JSON.stringify(r),
            api: "v5"
          };
        }).catch(function (v5err) {
          return amapGet("/v3/direction/driving", { origin: o, destination: d, extensions: "base" })
            .then(function (r2) {
              var p2 = ((r2.route || {}).paths || [])[0];
              if (!p2) throw v5err;
              return {
                distance: Number(p2.distance),
                duration: Number(p2.duration || 0),
                steps: p2.steps || [],
                raw: JSON.stringify(r2),
                api: "v3"
              };
            })
            .catch(function () { throw v5err; });
        });
      }

      return prep(origin).then(function (o) {
        O = o;
        return prep(dest).then(function (d) {
          D = d;
          /* 两端被认成同一个点：距离根本算不出来，先说清原因，别把 30001 原样抛给学生 */
          if (String(o.location) === String(d.location)) {
            throw new Error("起点和终点被认成了同一个地方（都是「" + o.name + "」），地名太笼统，加个区名再试");
          }
          return drive(o.location, d.location).then(function (res) {
            var km = (res.distance / 1000).toFixed(1);
            var min = Math.round(res.duration / 60);
            var steps = res.steps.length;
            /* 每一步都带一段 polyline，串起来就是完整轨迹 —— 静态地图靠它画线 */
            var pts = [];
            res.steps.forEach(function (s) {
              String(s.polyline || "").split(";").forEach(function (pair) {
                if (pair && pair.indexOf(",") > 0) pts.push(pair);
              });
            });
            lastRoute = {
              km: km, min: min, pts: pts,
              from: o.location, to: d.location,
              fromName: o.name, toName: d.name
            };
            /* 把"认出来的全名"一起交给模型：地名被认到外地时，这里一眼就能看见 */
            var head = o.name + " → " + d.name + "：";
            var warn = "";
            if (o.fallbackCity || d.fallbackCity) {
              warn = "（⚠ " + city + "没找到这个地名，用的是全国第一条结果，可能认错城市）";
            } else if (Number(km) > 200) {
              warn = "（⚠ 距离超过 200 公里，很可能是地名被认到别的城市了，先核对起终点）";
            }
            /* 交给模型的是压成人话的摘要；完整原始返回在右下「收回来的」里，两边都能看。 */
            var raw = res.raw;
            var text = head + km + " 公里 / " + min + " 分钟 / 共 " + steps + " 段路" + warn;
            return {
              ok: true, text: text,
              source: "高德 /" + res.api + "/direction/driving（" + steps + " 段路线 / 原始返回 " + raw.length + " 字）"
            };
          });
        });
      }).catch(function (e) {
        var msg = String((e && e.message) || e);
        var who = "";
        /* 上面"认成同一个地方"那句已经说清认成了谁，就别重复 */
        if ((O || D) && msg.indexOf("认成") < 0) {
          who = "（它把起点认成「" + (O ? O.name : origin) + "」，终点认成「" + (D ? D.name : dest) + "」）";
        }
        return { ok: false, text: "路线没查成：" + msg + who };
      });
    }

    /* 模型点单 → 程序按名字找到对应的高德 API，真的发一次 GET */
    function runTool(call) {
      var fn = (call && call.function) || {};
      var tool = toolByName(fn.name);
      if (!tool || !tool.model) {
        return Promise.resolve({ ok: false, text: "这不是一个可用的高德 API：" + fn.name });
      }
      /* 即使模型“超纲”点了被关掉的工具，程序也不真发请求 —— 关掉 = 这一轮没有它可用 */
      if (!st[tool.k]) {
        return Promise.resolve({
          ok: false,
          text: "「" + tool.label + "」这一轮被关掉了（左侧开关没开），所以没法查。要么把开关打开再问，要么直接告诉用户" + tool.label + "暂时查不了。",
          doc: tool
        });
      }
      var args = {};
      try { args = JSON.parse(fn.arguments || "{}"); } catch (e) { args = {}; }
      if (tool.k === "driving") {
        return execRoute(args).then(function (r) {
          r.doc = tool;
          if (r.ok) r.source = "高德 /v5/direction/driving（失败时自动换 v3 老引擎）";
          return r;
        });
      }
      if (tool.k === "weather") return execWeather(args);
      if (tool.k === "ip") return execIp(args);
      return runGeneric(tool, args);
    }

    /* 图片加载失败时，把高德回的原文再取一次 —— 空白框看不出原因，错误码一眼就能定位 */
    window.__twMapDiag = function (img) {
      var box = img.parentNode;
      var slot = box ? box.querySelector(".tw-map-err") : null;
      if (!slot) return;
      fetch(img.src).then(function (r) { return r.text(); }).then(function (t) {
        var text = String(t).slice(0, 200);
        try {
          var j = JSON.parse(t);
          if (j && j.info) text = j.info + "（infocode " + (j.infocode || "?") + "）";
        } catch (e) { /* 不是 JSON 就原样显示 */ }
        slot.textContent = "高德回的是：" + text;
        slot.hidden = false;
      }).catch(function () {
        slot.textContent = "连错误原文都没取到（可能是网络或跨域），点上面「打开图片地址」自己看一眼。";
        slot.hidden = false;
      });
    };

    /* ---------- 视角②：真实回答 + 真实静态地图 ----------
     * 同一个 /v3/staticmap 出两种图：
     *   算过路线 → paths 画线 + 起终点 markers（带轨迹点）
     *   搜过地点 → markers 打点：中心点标 S，其余标序号 1/2/3
     * 两种情况都不传 location / zoom：带上覆盖物后高德自己按范围定中心和级别。 */
    function mapBox(url, alt, tag) {
      var safe = esc(url);
      return '<div class="tw-map is-real">' +
        '<img src="' + safe + '" alt="' + esc(alt) + '" ' +
        'onerror="this.style.display=\'none\';this.parentNode.classList.add(\'is-blank\');window.__twMapDiag&&window.__twMapDiag(this)">' +
        '<span class="tw-map-tag">高德静态地图 · ' + tag + " · " +
        '<a href="' + safe + '" target="_blank" rel="noopener noreferrer">打开图片地址</a>' +
        '</span><span class="tw-map-err" hidden></span></div>';
    }

    /* 搜地点（周边 / 关键字）出的图：中心点 + 各个 POI 打点。
     * 序号只标交给模型的那几条，学生能拿图对着答案里的「1. 2. 3.」看。 */
    function poiMapHTML() {
      var items = (lastPois && lastPois.items) || [];
      if (!items.length) return "";
      var parts = [];
      if (lastPois.center) parts.push("large,0xDC2626,S:" + lastPois.center);
      items.forEach(function (p, i) {
        parts.push("mid,0x2563EB," + (i + 1) + ":" + String(p.location).trim());
      });
      var url = "https://restapi.amap.com/v3/staticmap?size=512*256&scale=2" +
        "&markers=" + parts.join("|") +
        "&key=" + encodeURIComponent(amapKey());
      var names = items.map(function (p) { return String(p.name || "").slice(0, 12); }).join(" / ");
      return mapBox(url, "高德静态地图（搜到的地点打点）",
        (lastPois.center ? "中心点 S · " : "") +
        esc(lastPois.label || "地点搜索") + " · 图上 " + items.length + " 个点（序号对答案里的编号）：" + esc(names));
    }

    function mapHTML() {
      if (!st.staticmap || !amapKey()) return "";
      if (lastPois && !lastRoute) return poiMapHTML();
      if (!lastRoute) return "";

      /* 轨迹点：/v5/direction/driving 的每一步都带一段 polyline（"lng,lat;lng,lat"），
       * 串起来就是这条线上的点。静态地图对点数有上限，按等间距抽稀到 45 个。 */
      var pts = (lastRoute.pts || []).slice();
      var track;
      if (pts.length > 1) {
        var maxPts = 45;
        var n = Math.min(maxPts, pts.length);
        var step = (pts.length - 1) / (n - 1);
        var picked = [];
        for (var i = 0; i < n; i++) picked.push(pts[Math.round(i * step)]);
        track = picked.join(";");
      } else {
        track = lastRoute.from + ";" + lastRoute.to;   /* 没有轨迹就退成两点直线 */
      }
      var ptCount = track.split(";").length;

      /* 尺寸：512*256 + scale=2 实际出图 1024×512，正好在高德上限内。 */
      var size = "size=512*256&scale=2";

      /* 故意不传 location / zoom：带了 markers 和 paths 时，
       * 高德会按这些覆盖物的范围自动定中心和级别——整条路线一定在画面里。
       * 自己算"中点 + 估算级别"，路线一绕行就会把某一端挤出画面。 */
      var url = "https://restapi.amap.com/v3/staticmap?" + size +
        "&markers=large,0x16A34A,A:" + lastRoute.from +
        "|large,0xDC2626,B:" + lastRoute.to +
        "&paths=6,0x2563EB,0.9,,:" + track +
        "&key=" + encodeURIComponent(amapKey());

      return mapBox(url, "高德静态地图（含路线）",
        esc(lastRoute.fromName || "起点") + " → " + esc(lastRoute.toName || "终点") +
        "（" + ptCount + " 个轨迹点）");
    }

    function say(t) { return '<div class="tw-say">' + esc(t) + "</div>"; }

    /* ---------- 极简 Markdown 渲染 ----------
     * 模型回来的正文本来就是 Markdown（标题 / 列表 / 加粗 / 行内代码 / 链接），
     * 直接当纯文本显示会把一堆 ** 和 ## 摆在大屏上。这里只做课堂够用的子集：
     * 先整体转义（防注入），再还原格式；代码块最先抽出，避免被后面的规则破坏。 */
    function md(src) {
      var s = esc(String(src == null ? "" : src).replace(/\r\n/g, "\n")).trim();
      if (!s) return '<div class="tw-md"><p>（这一轮没有内容）</p></div>';

      var blocks = [];
      s = s.replace(/```[^\n]*\n?([\s\S]*?)```/g, function (_, code) {
        blocks.push(code.replace(/\n$/, ""));
        return "\u0000" + (blocks.length - 1) + "\u0000";
      });

      var lines = s.split("\n");
      var out = [], list = null;
      function closeList() { if (list) { out.push("</" + list + ">"); list = null; } }

      lines.forEach(function (raw) {
        var line = raw.trim();
        if (!line) { closeList(); return; }

        var fence = line.match(/^\u0000(\d+)\u0000$/);
        if (fence) {
          closeList();
          out.push('<pre class="tw-md-pre">' + blocks[Number(fence[1])] + "</pre>");
          return;
        }
        var h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) {
          closeList();
          var lv = Math.min(6, h[1].length + 2);   /* # → h3，# → 不再往下沉 */
          out.push("<h" + lv + ">" + inline(h[2]) + "</h" + lv + ">");
          return;
        }
        if (/^(-{3,}|\*{3,})$/.test(line)) { closeList(); out.push("<hr>"); return; }

        /* 注意：esc() 已经把 ">" 变成 "&gt;"，引用行要按转义后的写法认 */
        var bq = line.match(/^(?:>|&gt;)\s?(.*)$/);
        if (bq) { closeList(); out.push("<blockquote>" + inline(bq[1]) + "</blockquote>"); return; }

        var ul = line.match(/^[-*+]\s+(.*)$/);
        if (ul) {
          if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; }
          out.push("<li>" + inline(ul[1]) + "</li>");
          return;
        }
        var ol = line.match(/^\d+[.)]\s+(.*)$/);
        if (ol) {
          if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; }
          out.push("<li>" + inline(ol[1]) + "</li>");
          return;
        }
        closeList();
        out.push("<p>" + inline(line) + "</p>");
      });
      closeList();
      return '<div class="tw-md">' + out.join("") + "</div>";

      /* 行内格式：代码 → 加粗 → 斜体 → 链接 → 自动换行 */
      function inline(t) {
        t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
        t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        t = t.replace(/__([^_]+)__/g, "<strong>$1</strong>");
        t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
        t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        return t;
      }
    }

    /* ---------- 发送：真实的多轮调用 ---------- */
    function send() {
      if (sending) return;

      if (!hasKey()) {
        humanBox.innerHTML = '<div class="tw-say is-warn">还没有 DeepSeek Key，发不出去。</div>' +
          mut('回 <a href="index.html">首页 → 右上角「设置」</a> 填 <code>sk-</code> 开头的 Key，再回来点发送。<br>' +
            "左下那块请求体是真的，只是没发出去——这正好是排错那一关说的第一种坑。");
        hint("没有大模型 Key 就只有「发出去的样子」，看不到「回来的样子」。");
        return;
      }
      if (!amapKey()) {
        hint("⚠ 还没填高德 Key：这一关的外部工具全是高德 Web 服务 API，工具调用会返回「没有高德 Key」。仍可发送，用来看每轮请求长什么样。");
      }

      sending = true;
      sendBtn.disabled = true;
      if (sendLabel) sendLabel.textContent = "发送中…";
      lastRoute = null;
      lastPois = null;

      /* 一次提问 ≠ 固定几次调用：模型自己决定还要不要点单。
       * 比如"我在哪、明天要带伞吗"：先 ip 定位拿城市 → 再查天气 → 才作答。
       * 上限 MAX_ROUNDS 轮，最后一轮不再给工具，强制它收尾。 */
      var messages = messagesOf();
      var reqs = [];
      var blocks = "";
      var round = 0;
      var fakeRetried = false;

      humanBox.innerHTML = mut("请求已发出。每一轮真实往返大概 2～6 秒——这段等待是真的，叫「推理延迟」。");
      respBox.innerHTML = code('<span class="c">// 它可能一轮就答完，也可能先点单、拿到结果再点单……</span>\n' +
        '<span class="c">// 最多 ' + MAX_ROUNDS + ' 轮，最后一轮不再给工具。</span>');
      hint("看它一轮一轮来：先点单 → 程序调高德 → 再点单或直接作答。");

      function step() {
        round++;
        var isLast = round >= MAX_ROUNDS;
        var body = bodyOf(messages, !isLast);
        reqs.push(body);
        renderReqs(reqs);
        respBox.innerHTML = blocks + code('<span class="c">// 等模型回话…</span>');
        hint("第 " + round + " 轮：把「问题 + 已经拿到的工具结果」交给模型" +
          (isLast ? "，这一轮它必须给出答案。" : "，看它还要不要点单。"));
        tidy();

        return API.callRaw({
          method: "POST",
          url: API.DEEPSEEK_URL,
          headers: [{ k: "Content-Type", v: "application/json" }],
          body: body
        }).then(function (d) {
          var choice = (d.choices || [])[0] || {};
          var msg = choice.message || {};
          var calls = msg.tool_calls || [];
          var rawText = String(msg.content || "");
          /* 有些模型会把工具调用写成文本（如 <｜｜DSML｜｜ invoke ...>），
           * 这不是合法的 tool_calls，程序不会执行，先纠正一次，再不行就如实说明。 */
          var fakeCall = !calls.length && /｜{1,2}\s*DSML\s*｜{1,2}|<\|[a-z_]+\|>/i.test(rawText);

          /* 它不是在"重复要"，而是在这一轮可选的工具里挑了几个来调 */
          var pool = (body.tools || []).length;
          var pick = !calls.length ? "" :
            pool ? "从 " + pool + " 个工具里选了 " + calls.length + " 个"
              : "这一轮没给工具，它却点了 " + calls.length + " 个（无效）";

          blocks += stepNote("第 " + round + " 轮响应 · " +
            (calls.length ? pick
              : fakeCall ? "它把调用写成了文本（伪调用），没有 tool_calls"
                : "它不再点单，这就是最终回答")) +
            '<details class="tw-fold"><summary>展开看这一轮完整响应 JSON（' +
            (calls.length ? "工具调用单" : "最终回答") + '）</summary>' +
            code(esc(JSON.stringify(d, null, 2))) + "</details>";
          messages = messages.concat([msg]);

          if (!calls.length) {
            if (fakeCall) {
              if (!fakeRetried && round < MAX_ROUNDS) {
                fakeRetried = true;
                messages = messages.concat([{
                  role: "user",
                  content: "请不要输出 DSML 或任何标记文本；要调用工具，就通过 tool_calls 字段。"
                }]);
                blocks += stepNote("程序提醒它「用 tool_calls 调，不要输出标记」，再试一轮");
                respBox.innerHTML = blocks;
                tidy();
                return step();
              }
              respBox.innerHTML = blocks;
              humanBox.innerHTML = '<div class="tw-say is-warn">它把工具调用写成了文字，程序没法执行。</div>' +
                mut("这不是答案。常见原因：这一轮没给它工具，或它把调用语法当成了普通文字。" +
                  "点「再发一次」通常会好；也可以先少开两个工具再试。");
              hint("模型输出格式不对——这也是真实会遇到的坑。");
              tidy();
              return null;
            }

            respBox.innerHTML = blocks;
            humanBox.innerHTML = md(msg.content) + mapHTML();
            hint("一共 " + round + " 轮大模型调用；右上这段就是你在手机上看到的东西。");
            tidy();
            return null;
          }

          /* 程序真的去调高德 —— 每批结果都要回填，它才能接着往下想 */
          var results = [];
          var seq = Promise.resolve();
          calls.forEach(function (c) {
            seq = seq.then(function () {
              httpLog.length = 0;   /* 只记这一只工具自己发的 GET */
              return runTool(c).then(function (r) {
                results.push({ call: c, r: r, http: httpLog.slice() });
              });
            });
          });

          return seq.then(function () {
            var execBlock = "";
            results.forEach(function (x) {
              var fn = x.call.function || {};
              var doc = x.r.doc;
              var tool = toolByName(fn.name);
              var label = tool ? tool.label : String(fn.name);
              var reqs = x.http || [];

              execBlock += stepNote("第 " + round + " 轮之后 · 程序执行 " + esc(label) +
                (x.r.ok ? "" : '　<b class="no">✗ 没成功</b>'));
              if (reqs.length) {
                execBlock += reqFold(reqs) + backFold(round, esc(label), reqs, x.r);
              } else {
                /* 没真的发请求（没 Key / 开关关着 / 参数缺）：如实说明，不画假请求 */
                execBlock += code('<span class="c">// 没有真的发出高德请求：' +
                  esc(String(x.r.text).split("\n")[0].slice(0, 120)) + "</span>");
              }
              if (doc) {
                execBlock += '<div class="tw-src">官方文档：<a href="' + doc.doc +
                  '" target="_blank" rel="noopener noreferrer">' + esc(doc.label) + " · " +
                  esc(doc.path) + " ↗</a></div>";
              }
              messages = messages.concat([{ role: "tool", tool_call_id: x.call.id, content: x.r.text }]);
            });
            blocks += execBlock;
            respBox.innerHTML = blocks;
            tidy();

            if (round >= MAX_ROUNDS) {
              humanBox.innerHTML = mut("已经到最大轮数，它仍想继续调工具，这里先停下。");
              return null;
            }
            return step();
          });
        });
      }

      step().catch(function (e) {
        var msgText = String((e && e.message) || e);
        respBox.innerHTML = stepNote("出错了 —— 这也是真实的一部分") + code(esc(msgText));
        humanBox.innerHTML = '<div class="tw-say is-warn">这次没成。</div>' +
          mut("把下面这段原文复制给 CodeBuddy，它才知道从哪下手：<br><code>" + esc(msgText) + "</code>");
        hint("真实调试就是这样：先拿报错原文，再说现象。");
        tidy();
      }).then(function () {
        sending = false;
        sendBtn.disabled = false;
        if (sendLabel) sendLabel.textContent = "再发一次";
      });
    }

    /* ---------- 事件 ---------- */
    host.addEventListener("click", function (e) {
      var t = e.target;

      var chip = t.closest ? t.closest(".tw-chip[data-tool]") : null;
      if (chip) {
        var k = chip.getAttribute("data-tool");
        st[k] = st[k] ? 0 : 1;
        chip.classList.toggle("is-on", !!st[k]);
        renderReqDefault();
        var tool = toolByKey(k);
        var name = tool ? tool.label + " " + tool.path : chip.textContent;
        hint(st[k]
          ? "已打开「" + name + "」：" + (tool && tool.model ? "左下 tools 里多了这一项" : "网页会直接画图（不经过大模型）") + "，重新发送才生效。"
          : "已关掉「" + name + "」：请求体里已经没有它了。");
        tidy();
        return;
      }

      var q = t.closest ? t.closest("[data-q]") : null;
      if (q) {
        if (qInput) qInput.value = q.getAttribute("data-q");
        renderReqDefault();
        tidy();
        return;
      }

      if (t === saveKeyBtn) {
        if (amapInput) {
          try { localStorage.setItem(AMAP_STORE, amapInput.value.trim()); } catch (err) { }
          hint(amapInput.value.trim() ? "高德 Key 已记住（只存在这台电脑的浏览器里）。" : "已清空高德 Key。");
        }
        return;
      }

      /* 发送按钮里还有图标和文字两个 span，点到的可能是它们 —— 一律往上找按钮 */
      var hitSend = t.closest ? t.closest('[data-role="send"]') : null;
      var hitReset = t.closest ? t.closest('[data-role="reset"]') : null;
      if (hitSend === sendBtn && sendBtn) { send(); return; }

      if (hitReset === resetBtn && resetBtn) {
        for (var key in DEFAULT) st[key] = DEFAULT[key];
        if (qInput) qInput.value = "明天去颐和园怎么走、穿什么？";
        lastRoute = null;
        var chips = host.querySelectorAll(".tw-chip[data-tool]");
        for (var i = 0; i < chips.length; i++) {
          var ck = chips[i].getAttribute("data-tool");
          chips[i].classList.toggle("is-on", !!st[ck]);
        }
        sendBtn.disabled = false;
        if (sendLabel) sendLabel.textContent = "发送";
        renderReqDefault();
        respBox.innerHTML = code('<span class="c">// 点左上卡里的「发送」，这里显示每一轮调用的完整返回：</span>\n' +
          '<span class="c">// ① 响应（工具调用单）→ 程序调高德 → ② 响应（可能再点单）→ … → 最终回答</span>');
        humanBox.innerHTML = stub("点左上卡里的「发送」，这里显示你真正读到的东西 —— 而不是下面那两块 JSON。");
        hint("点开关只改「发出去的样子」；点左上卡里的「发送」才会真的发。");
        tidy();
      }
    });

    if (amapInput) {
      amapInput.value = amapKey();
      amapInput.addEventListener("change", function () {
        try { localStorage.setItem(AMAP_STORE, amapInput.value.trim()); } catch (err) { }
      });
    }

    /* ---------- 首屏 ---------- */
    drawReady();
    renderReqDefault();
    respBox.innerHTML = code('<span class="c">// 点左上卡里的「发送」，这里显示每一轮调用的完整返回：</span>\n' +
      '<span class="c">// ① 响应（工具调用单）→ 程序调高德 → ② 响应（可能再点单）→ … → 最终回答</span>');
    humanBox.innerHTML = stub("点左上卡里的「发送」，这里显示你真正读到的东西 —— 而不是下面那两块 JSON。");
  })();

  /* ============================================================
   * ② 第 ⑤ 关：搜索 vs 抓取（两扇门都真开一次 · 四个视角）
   * ------------------------------------------------------------
   * 两扇门都是 DeepSeek 的原始 JSON 接口，和 ⑧ 同一套 Key：
   *   POST /v1/tools/search  {query,count,ori_question,need_content}
   *   POST /v1/tools/fetch   {url}
   * 没配 Key 时不发请求，只画真实请求体，绝不假造响应。
   * ============================================================ */
  (function initSearchLab() {
    var host = $("tw-io2");
    if (!host) return;

    var API = window.AgentLab && window.AgentLab.API;
    var CFG = (window.AgentLab && window.AgentLab.CONFIG) || {};
    var SEARCH_API = CFG.searchUrl || "https://api.deepseek.com/v1/tools/search";
    var FETCH_API = CFG.fetchUrl || "https://api.deepseek.com/v1/tools/fetch";
    var MAX_CHARS = 1500;

    var st = { search: 1, fetch: 1 };
    var sending = false;

    var reqBox = host.querySelector('[data-role="req"]');
    var respBox = host.querySelector('[data-role="resp"]');
    var humanBox = host.querySelector('[data-role="human"]');
    var hintBox = host.querySelector('[data-role="hint"]');
    var sendBtn = host.querySelector('[data-role="send"]');
    var sendLabel = host.querySelector('[data-role="send-label"]');
    var resetBtn = host.querySelector('[data-role="reset"]');
    var keyState = host.querySelector('[data-role="keystate"]');
    var keyDot = host.querySelector('[data-role="dot"]');
    var modelTip = host.querySelector('[data-role="model"]');
    var qInput = $("tw-io2-q");

    function esc(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    function code(s) { return '<pre class="tw-code">' + s + "</pre>"; }
    function mut(s) { return '<p class="is-mut">' + s + "</p>"; }
    function stub(s) { return '<div class="tw-io-stub"><span>' + s + "</span></div>"; }
    function note(s) { return '<div class="tw-step-note">' + s + "</div>"; }
    function tidy() { if (typeof fitHeight === "function") setTimeout(fitHeight, 60); }
    function hint(s) { if (hintBox) hintBox.innerHTML = s; }
    function hasKey() { return !!(API && API.hasApiKey && API.hasApiKey()); }

    function keyText() {
      try { return (API.getSettings() || {}).key || ""; } catch (e) { return ""; }
    }
    function modelName() {
      try { return (API && API.getSettings && API.getSettings().model) || "deepseek-flash"; }
      catch (e) { return "deepseek-flash"; }
    }
    function qText() {
      var v = qInput ? qInput.value.replace(/\s+/g, " ").trim() : "";
      return v || "去故宫哪些东西不能带？官方目录一共分几大类？";
    }
    function extractUrl(s) {
      var m = String(s).match(/https?:\/\/[^\s"'<>）)，。]+/i);
      return m ? m[0] : "";
    }
    function masked() {
      var k = keyText();
      return k ? "Bearer " + k.slice(0, 6) + "••••••••" : "Bearer sk-（未配置）";
    }
    function parseJson(txt) {
      try { return JSON.parse(txt); } catch (e) { return null; }
    }

    function drawReady() {
      if (keyState) {
        keyState.innerHTML = hasKey()
          ? '大模型：<b class="ok">已配置</b>　两扇门都真的发到 <code>api.deepseek.com</code>，和 ⑧ 同一个 Key'
          : '大模型：<b class="no">未配置</b>　先回 <a href="index.html">首页 → 右上角「设置」</a> 填 DeepSeek Key，否则发不出去';
      }
      if (keyDot) keyDot.className = "tw-dot" + (hasKey() ? " is-ok" : " is-no");
      if (modelTip) modelTip.textContent = "模型 " + modelName();
    }

    /* ---------- 工具声明：开关开着的门，原样写进 tools ---------- */
    function toolsOf() {
      var out = [];
      if (st.search) {
        out.push({
          type: "function",
          function: {
            name: "web_search",
            description: "搜网页：返回一组结果，每条有标题、链接、摘要。只有目录，没有正文。" +
              "不知道网址、只知道问题的时候先用它。",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "要搜的问题或关键词" },
                count: { type: "integer", description: "要几条结果，1～10，默认 5" }
              },
              required: ["query"]
            }
          }
        });
      }
      if (st.fetch) {
        out.push({
          type: "function",
          function: {
            name: "web_fetch",
            description: "打开一个网址，读这一页的正文（标题 + 正文）。必须给完整 http(s) 链接。" +
              "需要正文里的具体数字时用它。",
            parameters: {
              type: "object",
              properties: {
                url: { type: "string", description: "完整的 http(s) 链接" }
              },
              required: ["url"]
            }
          }
        });
      }
      return out;
    }

    function sysOf() {
      var lines = ["你是小学生的网页查询助手。要用工具查过再答，不要凭印象编。"];
      if (st.search) lines.push("· 只知道问题、不知道网址：先 web_search 拿目录。");
      if (st.fetch) lines.push("· 需要正文里的具体数字、清单或分类：先搜到链接，再 web_fetch 打开那一页。");
      lines.push("· 题目里直接给了网址，就跳过搜索，直接 web_fetch。");
      lines.push("· 只能用工具结果里出现的原话作答；工具结果里没有的，直接说「目录里没有，要打开正文才看得到」，绝不凭印象补。回答一两句短句。");
      return lines.join("\n");
    }

    function bodyOf(messages, withTools) {
      var body = {
        model: modelName(),
        messages: messages,
        temperature: 0.2,
        thinking: { type: "disabled" }
      };
      if (withTools !== false) {
        var tl = toolsOf();
        if (tl.length) { body.tools = tl; body.tool_choice = "auto"; }
      }
      return body;
    }

    function reqText(body, label) {
      return (label ? '<span class="c">// ' + label + '</span>\n' : "") +
        '<span class="c">POST</span> https://api.deepseek.com/chat/completions\n' +
        '<span class="c">Authorization:</span> ' + esc(masked()) + "\n" +
        '<span class="c">Content-Type:</span> application/json\n\n' +
        esc(JSON.stringify(body, null, 2));
    }

    function messagesOf() {
      return [
        { role: "system", content: sysOf() },
        { role: "user", content: qText() }
      ];
    }

    /* 视角三的首屏：第 1 轮还没发出去，就先把「要发的东西」原样摆出来（和 ⑧ 一样）。
     * 开关一动、题目一改就重画 —— 学生能亲眼看见 tools 里多了一项、少了一项。 */
    function renderReqDefault() {
      if (!reqBox) return;
      var body = bodyOf(messagesOf());
      var n = (body.tools || []).length;
      var label = n
        ? "第 1 轮请求 · tools 里 " + n + " 项 · 还没发送"
        : "第 1 轮请求 · 门都关着，连 tools 都没有 · 还没发送";
      reqBox.innerHTML = code(reqText(body, label));
    }

    /* 每一轮请求默认折叠成一行，点开才铺开完整 JSON（和 ⑧ 一样） */
    function reqDetails(body, i) {
      var nTools = (body.tools || []).length;
      var label = "第 " + (i + 1) + " 轮请求 · " +
        (nTools ? nTools + " 个工具" : "没给工具") + " · " +
        body.messages.length + " 条消息" +
        (i > 0 ? "（比上一轮多了工具结果）" : "");
      return '<details class="tw-fold"><summary>' + label + "</summary>" +
        code(reqText(body)) + "</details>";
    }

    function prettyJson(txt) {
      var pretty = txt || "";
      var j = parseJson(pretty);
      if (j) pretty = JSON.stringify(j, null, 2);
      if (pretty.length > MAX_CHARS) {
        pretty = pretty.slice(0, MAX_CHARS) + "\n…（原文共 " + pretty.length + " 字，这里截断）";
      }
      return pretty;
    }

    /* 程序替模型执行一扇门：真发 /v1/tools/search 或 /v1/tools/fetch */
    function pathOf(url) {
      return String(url).replace(/^https?:\/\/[^/]+/i, "");
    }

    function execDetails(title, api, body) {
      return note(title) +
        '<details class="tw-fold"><summary>请求 · POST ' + esc(pathOf(api)) + "</summary>" +
        code('<span class="c">POST</span> ' + esc(api) + "\n" +
          '<span class="c">Authorization:</span> ' + esc(masked()) + "\n" +
          '<span class="c">Content-Type:</span> application/json\n\n' +
          esc(JSON.stringify(body, null, 2))) + "</details>";
    }

    function respDetails(title, res) {
      return '<details class="tw-fold"><summary>' + title +
        " · HTTP " + res.status + " · " + res.ms + " ms</summary>" +
        code(esc(prettyJson(res.text))) + "</details>";
    }

    function post(url, body) {
      var t0 = Date.now();
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + keyText() },
        body: JSON.stringify(body)
      }).then(function (r) {
        return r.text().then(function (txt) {
          return { status: r.status, ok: r.ok, text: txt, ms: Date.now() - t0 };
        });
      }, function (e) {
        return {
          status: 0, ok: false, ms: Date.now() - t0,
          text: "连不上：" + ((e && e.message) || "网络错误，或跨域被拦")
        };
      });
    }

    function initBoxes() {
      renderReqDefault();
      respBox.innerHTML = code(
        '<span class="c">// 每一轮的响应也折叠着：模型点单 → 程序真调 /v1/tools/search 或 /v1/tools/fetch</span>\n' +
        '<span class="c">// → 结果回填 → 下一轮 → … → 最终回答</span>');
      humanBox.innerHTML = stub("点左上卡里的「发送」，这里显示模型读完成果后给你的回答。");
    }

    function switchTip(k, on) {
      var name = k === "search" ? "搜索「目录」" : "抓取「正文」";
      return on
        ? "已打开" + name + "：模型手里多一扇门，能点它。"
        : "已关掉" + name + "：模型手里没这扇门，永远点不出来。";
    }

    function reset() {
      st.search = 1;
      st.fetch = 1;
      var chips = host.querySelectorAll('.tw-chip[data-role="sw"]');
      for (var i = 0; i < chips.length; i++) chips[i].classList.add("is-on");
      if (qInput) qInput.value = "去故宫哪些东西不能带？官方目录一共分几大类？";
      if (sendBtn) sendBtn.disabled = false;
      if (sendLabel) sendLabel.textContent = "发送";
      initBoxes();
      hint("两扇门都开：先搜到那一页，再开正文；关掉抓取：它只能猜。");
      tidy();
    }

    async function send() {
      if (sending) return;
      var q = qText();
      var url = extractUrl(q);

      if (!st.search && !st.fetch) {
        humanBox.innerHTML = '<div class="tw-say is-warn">两扇门都关着：模型手里没有任何工具。</div>' +
          mut('它只能凭训练时的印象作答——这正是「不联网」的样子。真打开一扇再发一次。');
        reqBox.innerHTML = code('<span class="c">// 两扇门都关，没有任何请求要发。</span>');
        respBox.innerHTML = code('<span class="c">// 没有请求，就没有响应。</span>');
        hint("两扇门都关 = 视角三、四都是空的。");
        tidy();
        return;
      }
      if (url && !st.fetch) {
        humanBox.innerHTML = '<div class="tw-say is-warn">问题里给了网址，可「抓取」关着。</div>' +
          mut('没有抓取，这一页的正文读不到；搜索只给目录，答不出这页写了什么。打开「抓取」再试。');
        reqBox.innerHTML = code('<span class="c">// 抓取关着：这一页读不了，没有请求。</span>');
        respBox.innerHTML = code('<span class="c">// ――</span>');
        hint("有网址却关了抓取，这条路就断了。");
        tidy();
        return;
      }
      if (!url && !st.search) {
        humanBox.innerHTML = '<div class="tw-say is-warn">没给网址，又关了「搜索」。</div>' +
          mut('抓取得知道读哪一页，可题目里没有网址——程序无从下手。');
        reqBox.innerHTML = code('<span class="c">// 没有网址，搜索又关着：不知道要抓哪一页。</span>');
        respBox.innerHTML = code('<span class="c">// ――</span>');
        hint("搜索负责「找出网址」，它一关，抓取就没有目标。");
        tidy();
        return;
      }
      if (!hasKey()) {
        humanBox.innerHTML = '<div class="tw-say is-warn">还没有 DeepSeek Key，发不出去。</div>' +
          mut('回 <a href="index.html">首页 → 右上角「设置」</a> 填 <code>sk-</code> 开头的 Key，再回来点发送。');
        reqBox.innerHTML = code('<span class="c">// 没配 Key：请求还没发出去就被拦下了。</span>');
        respBox.innerHTML = code('<span class="c">// ――</span>');
        hint("没有 Key 就只有「发出去的样子」，看不到「回来的样子」。");
        tidy();
        return;
      }

      sending = true;
      if (sendBtn) sendBtn.disabled = true;
      if (sendLabel) sendLabel.textContent = "发送中…";
      reqBox.innerHTML = "";
      respBox.innerHTML = "";
      humanBox.innerHTML = mut("请求已发出。一轮一轮来，每一轮的等待都是真的。");
      hint("第 1 轮：问题 + 开关一起交给模型，看它先点哪扇门。");
      tidy();

      var MAX_ROUNDS = 3;
      var reqs = [];
      var blocks = "";
      var round = 0;
      var messages = [
        { role: "system", content: sysOf() },
        { role: "user", content: q }
      ];
      var errs = [];

      async function step() {
        round++;
        var isLast = round >= MAX_ROUNDS;
        var body = bodyOf(messages, !isLast);
        reqs.push(body);
        reqBox.innerHTML = reqs.map(reqDetails).join("");
        respBox.innerHTML = blocks + code('<span class="c">// 等模型回话…</span>');
        hint("第 " + round + " 轮：问题 + 已经拿到的工具结果一起交给模型" +
          (isLast ? "，这一轮它必须给出答案。" : "，看它点哪扇门。"));
        tidy();

        var d = await API.callRaw({
          method: "POST",
          url: API.DEEPSEEK_URL,
          headers: [{ k: "Content-Type", v: "application/json" }],
          body: body
        });

        var msg = ((d.choices || [])[0] || {}).message || {};
        var calls = msg.tool_calls || [];
        var pool = (body.tools || []).length;

        blocks += note("第 " + round + " 轮响应 · " +
          (calls.length
            ? (pool ? "从 " + pool + " 个工具里选了 " + calls.length + " 个"
              : "这一轮没给工具，它却点了 " + calls.length + " 个（无效）")
            : "它不再点单，这就是最终回答")) +
          '<details class="tw-fold"><summary>展开看这一轮完整响应 JSON（' +
          (calls.length ? "工具调用单" : "最终回答") + "）</summary>" +
          code(esc(JSON.stringify(d, null, 2))) + "</details>";
        messages = messages.concat([msg]);

        if (!calls.length) {
          respBox.innerHTML = blocks;
          var ans = String(msg.content || "").trim();
          humanBox.innerHTML = ans
            ? '<div class="tw-say is-good">' + esc(ans).replace(/\n/g, "<br>") + "</div>" +
              mut("一共 " + round + " 轮大模型调用。视角三、四里，每一轮真发出去、真收回来都在。")
            : '<div class="tw-say is-warn">它没有给出回答。</div>' + mut("看视角四里的最终响应 JSON。");
          hint("把「抓取」关掉再发一次：摘要里没有整份清单，它只能猜或说没查到。");
          tidy();
          return;
        }

        for (var i = 0; i < calls.length; i++) {
          var call = calls[i];
          var name = (call.function && call.function.name) || "";
          var args = {};
          try { args = JSON.parse((call.function && call.function.arguments) || "{}"); } catch (e) { args = {}; }

          var api = "";
          var body2 = null;
          var who = "";

          /* 开关关着的门，这一轮的 tools 里没有；模型即使点了也不执行 */
          var closed = (name === "web_search" && !st.search) || (name === "web_fetch" && !st.fetch);
          if (closed) {
            var cn = name === "web_search" ? "搜索" : "抓取";
            blocks += note("第 " + round + " 轮之后 · 它点了已关闭的「" + cn + "」") +
              code('<span class="c">// 这一轮的 tools 里没有这扇门（开关关着），程序不执行</span>');
            respBox.innerHTML = blocks;
            messages.push({ role: "tool", tool_call_id: call.id, content: cn + "工具已关闭，无法执行。" });
            continue;
          }

          if (name === "web_search") {
            api = SEARCH_API;
            who = "搜索（给目录）";
            body2 = {
              query: String(args.query || q).slice(0, 120),
              count: Math.max(1, Math.min(10, parseInt(args.count, 10) || 5)),
              ori_question: q.slice(0, 200),
              need_content: false
            };
          } else if (name === "web_fetch") {
            api = FETCH_API;
            who = "抓取（给正文）";
            body2 = { url: String(args.url || "").trim() };
            if (!body2.url) {
              blocks += note("第 " + round + " 轮之后 · 它点了抓取，却没给网址") +
                code('<span class="c">// 缺了参数 url，程序没法执行</span>');
              respBox.innerHTML = blocks;
              messages.push({ role: "tool", tool_call_id: call.id, content: "缺少 url 参数，无法抓取。" });
              continue;
            }
          } else {
            blocks += note("第 " + round + " 轮之后 · 它点了不存在的工具「" + esc(name) + "」") +
              code('<span class="c">// 没声明过这个工具，程序执行不了</span>');
            respBox.innerHTML = blocks;
            messages.push({ role: "tool", tool_call_id: call.id, content: "没有这个工具：" + name });
            continue;
          }

          blocks += execDetails("第 " + round + " 轮之后 · 程序执行 " + who, api, body2);
          respBox.innerHTML = blocks;
          tidy();

          var r = await post(api, body2);
          blocks += respDetails("第 " + round + " 轮 · " + who + "响应", r);
          respBox.innerHTML = blocks;
          tidy();

          if (!r.ok) errs.push(who + " HTTP " + r.status);
          messages.push({ role: "tool", tool_call_id: call.id, content: String(r.text || "").slice(0, 12000) });
        }

        if (isLast) {
          respBox.innerHTML = blocks;
          humanBox.innerHTML = mut("已经到最大轮数（" + MAX_ROUNDS + "），它还想继续点单，这里先停下。") +
            (errs.length ? mut("出错：" + esc(errs.join("；"))) : "");
          hint("课堂上看这 3 轮就够了；再点「再发一次」换个问法。");
          tidy();
          return;
        }
        return step();
      }

      try {
        await step();
      } catch (e) {
        var msgText = String((e && e.message) || e);
        respBox.innerHTML = note("出错了 —— 这也是真实的一部分") + code(esc(msgText));
        humanBox.innerHTML = '<div class="tw-say is-warn">这次没成。</div>' +
          mut("把这段原文复制给 CodeBuddy，它才知道从哪下手：<br><code>" + esc(msgText) + "</code>");
        hint("真实调试就是这样：先拿报错原文，再说现象。");
        tidy();
      }

      sending = false;
      if (sendBtn) sendBtn.disabled = false;
      if (sendLabel) sendLabel.textContent = "再发一次";
      tidy();
    }

    host.addEventListener("click", function (e) {
      var t = e.target;
      var sw = t.closest ? t.closest('[data-role="sw"]') : null;
      if (sw) {
        var k = sw.getAttribute("data-k");
        if (st[k] === undefined) return;
        st[k] = st[k] ? 0 : 1;
        sw.classList.toggle("is-on", !!st[k]);
        renderReqDefault();
        hint(switchTip(k, !!st[k]));
        tidy();
        return;
      }
      var q = t.closest ? t.closest("[data-q]") : null;
      if (q) {
        if (qInput) qInput.value = q.getAttribute("data-q");
        renderReqDefault();
        hint("题已填好，点右边「发送」。");
        tidy();
        return;
      }
      if (sendBtn && (t === sendBtn || sendBtn.contains(t))) { send(); return; }
      if (resetBtn && (t === resetBtn || resetBtn.contains(t))) { reset(); }
    });

    if (qInput) qInput.addEventListener("input", function () { renderReqDefault(); });

    drawReady();
    initBoxes();
    hint("两扇门都开：先搜到那一页，再开正文；关掉抓取：它只能猜。");
  })();

  /* ============================================================
   * ④ 顶部十关导航
   * ============================================================ */
  var nav = $("ls-nav");
  var current = 0;
  var navBtns = [];

  CARDS.forEach(function (c, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ls-nav-btn";
    b.textContent = c.nav;
    b.addEventListener("click", function () { goTo(i); });
    nav.appendChild(b);
    navBtns.push(b);
  });

  function setActive(i) {
    current = i;
    navBtns.forEach(function (b, k) { b.classList.toggle("is-on", k === i); });
    var pos = $("ls-pager-pos");
    if (pos) pos.textContent = (i + 1) + " / " + kept.length;
    var prev = $("ls-prev"), next = $("ls-next");
    if (prev) prev.disabled = i <= 0;
    if (next) next.disabled = i >= kept.length - 1;
  }

  function goTo(i) {
    i = Math.max(0, Math.min(kept.length - 1, i));
    kept[i].scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(i);
  }

  window.addEventListener("scroll", function () {
    var idx = 0;
    for (var i = 0; i < kept.length; i++) {
      if (kept[i].getBoundingClientRect().top <= 140) idx = i;
    }
    if (idx !== current) setActive(idx);
  }, { passive: true });

  /* ============================================================
   * ⑤ 大屏字号 + 全屏
   * ============================================================ */
  var stage = $("ls-stage");
  var wrap = $("ls-scale");
  var label = $("ls-scale-label");
  var MIN = 0.85, MAX = 1.5, STEP = 0.1;

  var S = (window.AgentLab && window.AgentLab.Store) || {
    get: function (k, d) {
      try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); }
      catch (err) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (err) { /* 忽略 */ }
    }
  };

  var raw = S.get("lesson_tools_scale_v1", null);
  var num = parseFloat(raw);
  var scale = (raw === null || raw === undefined || !isFinite(num))
    ? (window.innerWidth >= 1100 ? 1.15 : 1.0)
    : num;

  function fitHeight() {
    if (!wrap || !stage) return;
    wrap.style.height = (stage.offsetHeight * scale) + "px";
  }

  function applyScale(z, save) {
    scale = Math.min(MAX, Math.max(MIN, Math.round(z * 100) / 100));
    stage.style.transformOrigin = "top left";
    stage.style.transform = "scale(" + scale + ")";
    stage.style.width = (100 / scale) + "%";
    stage.style.setProperty("--ls-scroll-gap", (70 / scale) + "px");
    fitHeight();
    if (label) label.textContent = Math.round(scale * 100) + "%";
    if (save !== false) S.set("lesson_tools_scale_v1", scale);
  }

  var smaller = $("ls-smaller"), bigger = $("ls-bigger");
  if (smaller) smaller.addEventListener("click", function () { applyScale(scale - STEP); });
  if (bigger) bigger.addEventListener("click", function () { applyScale(scale + STEP); });

  window.addEventListener("resize", function () { applyScale(scale, false); });
  if (window.ResizeObserver) {
    new ResizeObserver(function () { fitHeight(); }).observe(stage);
  }

  applyScale(scale);

  var full = $("ls-full");
  if (full) {
    full.addEventListener("click", function () {
      if (!document.fullscreenElement) {
        var p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
        if (p && p.catch) p.catch(function () { });
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    });
    document.addEventListener("fullscreenchange", function () {
      full.textContent = document.fullscreenElement ? "退出全屏" : "全屏";
      setTimeout(fitHeight, 60);
    });
  }

  /* ============================================================
   * ⑥ 右下角翻页 + 键盘
   * ============================================================ */
  var pager = $("ls-pager");
  if (pager) {
    pager.hidden = false;
    $("ls-prev").addEventListener("click", function () { goTo(current - 1); });
    $("ls-next").addEventListener("click", function () { goTo(current + 1); });
  }

  document.addEventListener("keydown", function (e) {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(current + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goTo(current - 1); }
  });

  stage.classList.add("is-ready");
  setActive(0);
})();
