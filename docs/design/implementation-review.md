# 查询页与本机观测验收

2026-09-12，设计版本 v0.3。代码基线 `8802194e5671051e681ab1a1c450eccccf8acece`，本次 UI 改动尚未提交。沿用根目录 [design.md](../../design.md)，产品上下文见 [PRODUCT.md](../../PRODUCT.md)。本报告覆盖 `/` 与 `/myip`，未部署或发布。

## 实现

- 共用深色工作区、橙色主操作、导航、键盘跳转与复制组件。字符地球是静态示意，坐标由选中的数据源提供。
- 查询页保留 `QueryResult` 契约。支持本地模式、示例填充、URL 恢复、来源对照、JSON、来源失败列表。查询 B 失败时保留并标注 A；过期请求不会覆盖新结果。
- `/myip` 按成功项的 `observation.scope` 分组，逐行显示实际 IP。明确区分请求地址与服务器出口，失败集中列出，不虚构每组失败率。
- 共享复制组件保留操作名称，切换结果时重置反馈，并处理剪贴板拒绝。

## 验证结果

| 检查 | 结果 | 证据与范围 |
| --- | --- | --- |
| 既有 Node 测试 | 25 项通过 | `npm test`，无 backend 修改 |
| TypeScript | 通过 | `npx --no-install tsc --noEmit --incremental false`，生产构建亦完成类型检查 |
| 生产构建 | 通过 | `npm run build` |
| 浏览器固定场景 | 20 项通过 | [acceptance.json](../../.impeccable/review/acceptance.json) |
| 无障碍扫描 | 两页 0 项违规 | axe 4.12.1，[查询页](../../.impeccable/review/a11y-query.json)、[本机观测](../../.impeccable/review/a11y-myip.json) |
| 真实 API 浏览器检查 | 通过 | [live-smoke.json](../../.impeccable/review/live-smoke.json) |
| Impeccable detector | `[]` | [首轮检测](../../.impeccable/review/detector-initial.json)执行一次；之后的修复通过浏览器和独立审查确认 |
| 独立截图与代码终审 | ship | 已修复首屏密度、复制状态残留和截图中跳转链接露出；无需再修改 UI |

浏览器使用本机 Chrome，通过 Playwright 检查 1440×900、375×812、320×812 视口。移动端为浏览器视口模拟，不宣称已在 iPhone、Android 或 Safari 实机验收。未单独验收 200% zoom、768px 与 1024px 视口。独立终审由普通隔离 agent 执行，运行环境未提供专用 finish-reviewer role。部分 `/myip` 截图捕获到按钮 150ms 状态过渡的中间色，不影响按钮名称或可用状态。

20 项检查覆盖键盘跳转、示例不发请求、明显无效字符拦截、部分成功、0 坐标、实际复制、移动折叠、长 IPv6 无横向溢出、复制反馈重置、失败保留旧结果、503 完整响应、连续请求竞态、URL 模式恢复、桌面五行、400、非 JSON 500、畸形响应、剪贴板拒绝及 `/myip` 的分组、503、未识别地址与网络失败恢复。合法性最终由现有服务端校验，客户端不另造完整 IP parser。

桌面五行通过 bounding-box 断言，第五行底部不超过 900px，同时保存[原始视口截图](../../.impeccable/review/five-rows-desktop.png)。其他截图为整页截图，用于检查纵向排布。

真实本地查询使用已有公开数据库测试快照，查询 `8.8.8.8` 返回 5 个来源，状态 `partial`。`/myip` 本次返回 0 个请求地址成功项、9 个服务器出口成功项、16 个失败项；页面全部如实显示，未将服务器出口当成本机 IP。结果仅代表本次本地运行，上游可用性会变化。

## 截图

- 查询页：[桌面真实数据](../../.impeccable/review/real-query.png)、[移动端](../../.impeccable/review/mobile.png)、[320px IPv6](../../.impeccable/review/ipv6-320.png)、[503](../../.impeccable/review/unavailable-mobile.png)。
- 本机观测：[桌面真实数据](../../.impeccable/review/real-myip.png)、[移动端](../../.impeccable/review/myip-mobile.png)、[未识别请求地址](../../.impeccable/review/myip-unidentified.png)、[服务失败](../../.impeccable/review/myip-service-failure.png)。

两个 JSON 证据文件记录采集时间、基线 revision、未提交状态、设计版本、源文件 SHA-256 与真实/固定响应类别。示例数据不代表真实定位。没有将早期 AI 参考图作为像素还原基线。

## 复现与限制

先使用实际数据库快照启动生产构建，再执行：

```sh
npm run build
MMDB_PATH=/absolute/path/to/snapshot npm run start -- --port 3187
PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/browser/acceptance.cjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/browser/live-smoke.cjs
```

`live-smoke.cjs` 会联系真实上游。脚本使用已安装的 Chrome；Playwright 通过环境变量定位，本次未新增依赖。生产部署仍按 [主机指南](../deployment/host.md) 使用 standalone 产物，本地 `next start` 预览存在 standalone 提示。

构建保留既有 Browserslist 数据过期、Edge 静态生成限制与辅助 `/ip/query` client rendering 提示。本轮未扩展到辅助页面或升级依赖。`npm run lint` 尚无独立 ESLint 配置，不将首次交互配置算通过。

本地空的重复 `node_modules/@types/* 2` 目录已可恢复地移到 `/tmp/leveling-ui-duplicate-types/`，使类型检查恢复。无关的 `src/app/api/myip/route 2.ts` 保持原样，不属于本轮交付。
