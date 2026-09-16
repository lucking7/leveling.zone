# ORBIT 中英文界面验收

2026-09-12。新增共享 LocaleProvider 与导航语言按钮，覆盖查询页、地球与 `/myip`，默认中文并保存用户明确选择。`localStorage` 不可用时仍可在当前页面切换；切换同步 `document.lang` 与标题。

语言为呈现层状态。查询输入、模式、结果、来源选择与地球角度不重建；切换不触发接口请求。错误在显示时翻译，`/myip` 时间使用对应 locale。真实来源 IP、ASN、组织、地理原文和复制 JSON 不翻译，静态示例可翻译。

[语言专项](../../.impeccable/review/locale/checks.json) 10 项通过，覆盖切换、刷新记忆、旧错误、数据保留、无额外请求、跨路由偏好、稳定 heading ID 和 320/390/768/1440px 无溢出。

[原页面回归](../../.impeccable/review/locale/regression/acceptance.json) 22 项通过，包含失败状态、查询竞态、复制、五行桌面密度和 `/myip` 分组。Node 测试 25 项通过。

[英文桌面结果](../../.impeccable/review/locale/english-result.png) · [英文移动端](../../.impeccable/review/locale/english-390.png) · [My IP 移动端](../../.impeccable/review/locale/myip-english.png)

浏览器验收为本机 Chrome 和模拟响应，不代表实体手机或 Safari 验收。首次服务端 HTML 为中文，客户端恢复本机语言偏好。历史兼容页面 `/ip/query` 不属于本轮两个主入口；无 URL 语言前缀或服务端语言协商。未部署、未提交。

最终生产构建通过（包含 TypeScript 检查）。
