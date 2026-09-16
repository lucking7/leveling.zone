# ORBIT 重设计验收

2026-09-12，设计 v0.4。用户选择 ORBIT 后实施，产品显示名为 **ORBIT / 地址观测**。代码基线 `8802194e5671051e681ab1a1c450eccccf8acece`，改动未提交、未部署。

## 已实现

- 查询页采用大字号中文衬线标题与 ImageGen ASCII 地球 hero。查询结果出现后收紧 hero，来源表改为通栏，坐标和快照信息置于表格下方。
- `/myip` 采用同一 hero 的紧凑变体。请求地址与服务器出口仍独立分组，每行显示真实观测 IP。
- 产品名称、页面 metadata、导航和页脚已更新。仓库、GitHub URL 与部署域名未迁移。
- [背景 WebP](../../public/images/ascii-orbit-hero-v2.webp) 约 113KiB，来自内置 ImageGen，PNG 原稿与 exact prompt 均保留。构建时预转换为 WebP，页面直接加载静态文件，避免依赖 standalone 运行时图片优化的 `sharp`。
- [Noto Serif SC 标题子集](../../public/fonts/orbit-display.ttf) 约 8.5KB，随项目自托管；[来源](../../public/fonts/SOURCE.md)与[字体许可证](../../public/fonts/OFL.txt)已保存。

## 验证

| 检查 | 结果与证据 |
| --- | --- |
| Node 测试 | 25 项通过 |
| TypeScript 与生产构建 | 通过；构建包含类型检查 |
| 浏览器场景 | [22 项通过](../../.impeccable/review/orbit/acceptance.json)，包含真实剪贴板、竞态、400/503/500、畸形 JSON、失败恢复与来源分组 |
| 响应式 | 检查 320、390、768、1024、1440px 宽度，未发现整页横向溢出；第五行底部通过不超过 900px 的断言 |
| 真实接口 | [live-smoke.json](../../.impeccable/review/orbit/live-smoke.json)：本地查询 5 个可用来源；本次 `/myip` 为 0 个请求地址成功项、9 个服务器出口成功项与 16 个失败项 |
| axe | [查询页](../../.impeccable/review/orbit/a11y-query.json)、[本机观测](../../.impeccable/review/orbit/a11y-myip.json)均 0 项自动违规，各有图片背景对比度检查未能自动判定 |
| Impeccable detector | [37 项旧设计 token 偏差](../../.impeccable/review/orbit/detector.json)，均为字体、字号、圆角或颜色；设计文档随后同步，不将其描述为零发现 |

图片后的文字使用方向性深色遮罩，移动端降低背景不透明度，输入框和图注使用明确底色。图片背景上的对比度不能仅用 axe 的 0 违规作为通过依据。

## 截图与方向对照

- [桌面首屏](../../.impeccable/review/orbit/hero-viewport.png)、[390px 首屏](../../.impeccable/review/orbit/hero-390.png)、[768px](../../.impeccable/review/orbit/hero-768.png)、[1024px](../../.impeccable/review/orbit/hero-1024.png)。
- [桌面五行](../../.impeccable/review/orbit/five-rows-desktop.png)、[320px IPv6](../../.impeccable/review/orbit/ipv6-320.png)、[查询 503](../../.impeccable/review/orbit/unavailable-mobile.png)。
- [本机观测移动端](../../.impeccable/review/orbit/myip-mobile.png)、[未识别请求地址](../../.impeccable/review/orbit/myip-unidentified.png)、[真实查询](../../.impeccable/review/orbit/real-query.png)、[真实观测](../../.impeccable/review/orbit/real-myip.png)。

[方向稿与实现对照](../../.impeccable/review/orbit/diff/side-by-side.png)的最新自动评分为 72%（drift），不是像素一致性通过。v2 已采用完整 ASCII 地球轮廓和独立静态示例表，明确标注“示例数据 · 非本次查询”，不写入 QueryResult、不发请求。方向稿里的虚构日期、坐标和实时拓扑标语未移植。输入标签、第三方查询说明和恢复能力保留。

本轮一并修复桌面观测区的折叠语义，以及非 JSON 响应的错误分类文案，浏览器断言覆盖两者。

## 复现与边界

运行生产构建并提供实际数据库路径后：

```sh
UI_EVIDENCE_DIR=.impeccable/review/orbit PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/browser/acceptance.cjs
UI_EVIDENCE_DIR=.impeccable/review/orbit PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/browser/live-smoke.cjs
```

第二条会联系真实上游。证据 JSON 记录 revision、设计版本、源文件 SHA-256、采集时间与真实/fixture 分类。使用本机 Chrome 的 headless 视口模拟，未声称完成实体 iOS/Android、Safari 或完整辅助技术审计。

构建仍有既有 Browserslist 数据过期、Edge 静态生成限制与辅助 `/ip/query` client rendering 提示。本轮未改 backend 契约、辅助页面或升级依赖；无关 `src/app/api/myip/route 2.ts` 保留原样。

## 独立终审

v2 独立成品质检结论为 **SHIP**。审查确认方向稿主构图、完整圆形 ASCII 地球、96px 标题及首屏静态示例已实现；示例事实边界清晰，且与 QueryResult 互斥。两项 P2 均已修复并有浏览器断言覆盖。没有需要继续修改或重建的阻断性发现。运行环境未提供专用 finish-reviewer role，使用隔离的普通 reviewer agent。人工结论不覆盖下方自动视觉门禁的失败状态。

Detector 按流程本轮仅运行一次，保留原始 37 项旧规范偏差作为历史证据。文档同步后由 documenter 静态核对 frontmatter、CSS 和 sidecar，13 个颜色 token 一致，8 个组件引用有效。未重跑或伪称 detector clean。

## 流程边界

Impeccable build-phase 的自动 hero 门禁仍为失败：总体分数已达约 72%，查询控件区域为 61%，未满足局部门禁。方向稿和实现对照、门禁原始状态分别保存在 diff 目录与 `.impeccable/build/state.json`。没有伪造用户降低要求或强制将最终状态改为 ship。

本轮已完成批量检查与一次修正后确认，遵循 [Impeccable SKILL.md](/Users/luck/.agents/skills/impeccable/SKILL.md) 的边界：“confirm with at most one more round, and stop polishing”。代码、功能与浏览器验收已落地；自动视觉一致性流程尚未关闭，不能混称全部通过。
