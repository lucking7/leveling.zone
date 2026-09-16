# 仅访问者 IP 验收

2026-09-12。首页无样本数据。`/myip` 只查询当前访问者地址，用本地数据库提供地理归属与网络信息，不再请求服务器出口探测源。

后端由 Edge 改为 Node.js，复用 queryIP 且 external=false。未知访问者返回 400，数据库全无结果返回 503，保留访问者 IP 和来源；部分结果可用则返回现有成功项。所有行强制对应同一访问者 IP。响应不缓存。

前端拒绝 mixed、server-egress、非零出口计数和与主地址不一致的条目。只显示访问者结果，中英文状态与本地数据库失败原因保持一致。API 的 serverEgressSourceCount 仅作为旧形状兼容字段保留为 0，不呈现到 UI。

28 项 Node 测试、[23 项页面回归](../../.impeccable/review/visitor-only/acceptance.json)、10 项双语检查通过；JP Linux 生产构建通过。[公网验收](../../.impeccable/review/visitor-only/deployed/live-smoke.json)检查实际地址、每行 IP 一致、scope 和没有出口分组。

访问者地址是当前网络连接对本站呈现的公网地址；使用代理或 VPN 时可能为其出口地址，不能识别被代理隐藏的设备地址。地理位置是数据库估计。未进行实体手机或 Safari 验收。
