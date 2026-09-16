# ORBIT 动态地球验收

2026-09-12，设计 v0.5。查询页和 /myip 的 hero 已从静态 ImageGen 图改为 Canvas ASCII 经纬度投影。历史生成图保留为视觉参考；当前大陆轮廓来自 Natural Earth 公共领域数据，来源记录在 src/components/globe/SOURCE.md。

## 行为

- 初始缓慢自转，提供暂停按钮。离开视口或切换后台停止绘制；组件卸载清理 observer 与 animation frame。
- 查询成功后采用页面当前选中来源的有效经纬度，按最短经度路径转向目标。抵达后停止自转，保留橙色位置标记。
- 来源详情中的“定位到此来源”切换坐标并滚回地球，尊重减少动态效果设置。
- 缺少坐标清除当前标记，保留视角并说明原因；失败保留旧结果及旧结果标注。0,0 是有效坐标。
- 系统减少动态效果时不自转、不插值，直接定位。/myip 仅展示装饰自转，明确不代表请求地址或服务器出口。

## 证据

[动态专项检查](../../.impeccable/review/orbit-motion/checks.json) 10 项通过：自转、暂停恢复、查询定位、无坐标保留、零坐标、减少动态效果、移动端溢出、来源定位滚动、跨日期变更线最短旋转、无运行异常。

[原页面回归](../../.impeccable/review/orbit-motion/regression/acceptance.json) 22 项通过，包含错误恢复、竞态、剪贴板、桌面五行密度以及 /myip 各失败状态。Node 测试 25 项通过。生产构建通过。[生产服务真实接口检查](../../.impeccable/review/orbit-motion/live/live-smoke.json)也通过，本地查询返回 5 个成功来源，页面正确展示实际响应。

[桌面定位](../../.impeccable/review/orbit-motion/desktop.png) · [移动端](../../.impeccable/review/orbit-motion/mobile.png) · [初始地球](../../.impeccable/review/orbit-motion/regression/hero-viewport.png)

验收采用本机 Chrome 与模拟接口，经纬度是专门设置的测试 fixture，不是对 8.8.8.8 真实位置的声明。实体手机、Safari 未验收。地理结果始终为数据源估计，不代表精确设备位置。本轮未部署或提交。

独立短审结论：SHIP，无阻断问题。已复核动画和 observer 清理、最短经度路径、旧结果坐标、无坐标保留视角、零坐标以及减少动态效果。未测实体设备帧率与功耗。

## 用户校正：自动定位

Motion 当前只由查询/来源选择触发。移除暂停/继续按钮及空闲自转，等待时静止，收到有效目标后自动旋转并停在标记位置。`/myip` 无单一地理目标，保持示意静止。减少动态效果、无坐标保留视角与最短路径保持有效。更新后的 10 项专项检查及 TypeScript 检查通过；前文自转/暂停验收仅为历史记录。
