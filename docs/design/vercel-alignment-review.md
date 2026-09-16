# Orbit × Vercel 设计对照

日期：2026-09-13。结论：值得继续统一排版、信息表达和辅助交互；不需要重做当前查询布局。本轮下载参考、读取代码、检查公网并形成报告，未改应用或部署。

## 官方原文与适用边界

已归档 [官方 design.md](references/vercel/design.md)、[design.dark.md](references/vercel/design.dark.md) 和 [配套 CSS](references/vercel/vercel-brand.css)，下载清单及 SHA-256 见 [sources.json](references/vercel/sources.json)。两份 Markdown 本次内容相同，均为 39,519 字节。

来源为 https://vercel.com/design.md 和 https://vercel.com/geist/vercel-brand.css。当前文档面向 Vercel 官方报告网站，不是 Vercel 产品界面的逐项规范。档案保留原文，只作为参考；根目录 `design.md` 继续是 Orbit 的设计约定。

应吸收：清晰的信息优先级、相同数据的统一表达、可访问的原生控件、克制的边框、状态连续性。保留 Orbit 渐变 Logo、用户选择的 OpenTUI Mono、国旗、导航图标、主题开关和 IP.SB 查询结构。不导入整套 VBG CSS，也不换成 Vercel 的品牌标识。

## 建议顺序

| 优先级 | 项目 | 当前证据与影响 | 最小改进 | 验收 |
| --- | --- | --- | --- | --- |
| P1 | 位置与数字表达 | 公网默认 MaxMind 显示 `Tokyo, Tokyo, Japan`。GeoIP 用 `String(value)` 输出坐标，其他源较长小数会让手机换行，位数不能代表定位准确度。 | 位置摘要去除相邻重复地名；统一坐标展示精度（建议最多 4–5 位小数），原始 JSON 保留完整值，并明确复制原值或显示值的契约。详细 Region/City 字段保留原数据。 | 零坐标、负坐标、长小数、同名市/州、不同国家；原数据不变。 |
| P1 | 对照表与 JSON 可访问性 | 来源表有 `th`/`scope`，但没有 caption 或显式表名；长 JSON 是独立滚动区，没有显式键盘焦点或可访问名称。后者是跨浏览器风险，本轮未复现为所有浏览器中的阻断。 | 给表加隐藏 caption；JSON 区加 `tabIndex=0`、名称和可见焦点。可在展开区附近提供明确的“复制 JSON”。 | 仅用键盘展开、进入、滚动、退出；读屏能辨认表格与原始数据区域；复制值准确。 |
| P2 | 完整 Geist 排版系统 | 公网实测 Logo 是 Geist，正文是 Space Grotesk，查询按钮/输入是 OpenTUI Mono。当前符合历史约定，但尚不是统一的 Vercel 字体风格。 | 若继续向 Vercel 靠拢，补本地 Geist 400/500/600，统一正文、导航、按钮、标签；IP、ASN、范围、代码继续 OpenTUI Mono。用角色 token 管理字号/行高，避免逐组件调数值。 | 320–1440px、中英文、字体加载后布局；不压缩触控范围。此项是风格选择，不是现有功能缺陷。 |
| P2 | 结果第一屏减重复 | GeoIP 标题已有 IP 和复制，Address 行又显示同一 IP 和复制；Country/Region/City 与 Location 摘要也多次表达同一位置。 | 先精简摘要与重复操作。保留用户需要的精确字段，可把辅助字段渐进展开；不要无差别删除来源事实。 | 首屏更快看到位置和网络归属；精确 IP、字段和复制仍易找到。 |
| P2 | 来源选择的依据 | `bestSource()` 按非空字段数选默认来源，界面只显示当前名称。字段最多不等于最准确；实查同一 IP 的来源位置相互不同。 | 保持“当前来源”语义，不称“推荐/最佳”。在来源帮助信息中用一句话说明默认规则，对照中保留差异。不要擅自按多数结果覆盖原值。 | 切换不重查；默认规则透明；不同来源事实独立。 |
| P2 | 加载布局连续性 | 代码在没有 result 时使用 hero，即使 URL 已有 IP；成功后替换为结果布局。结构切换已确认，实际 CLS 数值尚未测量。 | 带 IP 的深链直接使用结果页框架，加载时保留表单位置；保留已有的失败恢复和旧结果标记。必要时采用静态占位，不添加装饰动画。 | 慢网和首次深链录屏；输入不跳位；失败不抹掉输入或上次有效结果。 |
| P3 | 边框、基线与控件细节 | 原始 JSON 在外层 details 边框里再包一层代码边框。来源表 body 采用 top 对齐，官方更强调首行基线；数据字号 GeoIP 15px / Whois 14px 为历史分支。 | JSON 少一层边框；多行对照验证首行基线；统一同角色的技术数据字号。不要为了对齐强行把 pill 输入、弹出菜单和记录面板改成同一种圆角。 | 深浅色、长来源名、长组织名；行头与值在首行对齐且无截断。 |
| P3 | design.md 与样式收口 | 文档多次追加更新，核心段仍写 summary 44px，而当前样式为 56px；字体角色、按钮尺寸也散在多个段落和 CSS 规则。 | 重整为当前有效的字体、颜色、尺寸、间距、状态约定；历史迁到变更记录。让每个尺寸与间距有一个维护位置。 | 文档与实际 computed style 一致；后续改动不会恢复旧字标或旧按钮。 |

建议下一轮先做 P1 两项和 P2 的 Geist 排版，再处理首屏重复与加载连续性。已经完成的语言菜单、来源下拉、独立 JSON 折叠和国旗无需再重构。

## 代码与官方依据

- 位置/精度：[geo-lookup.tsx](../../src/components/geo-lookup.tsx:76)、[myip/page.tsx](../../src/app/myip/page.tsx:201)。官方参考“Data and evidence”，强调一致精度与事实边界。
- 来源规则：[geo-lookup.tsx](../../src/components/geo-lookup.tsx:111)。官方参考“Frame the reader's job”，区分事实、方法与解释。
- 对照/JSON：[source-data.tsx](../../src/components/source-data.tsx:36)。官方参考 table caption、原生控件与键盘操作。
- 加载结构：[geo-lookup.tsx](../../src/components/geo-lookup.tsx:460)。官方参考“Calculators and interaction”的原值、有效结果与状态连续性。
- 字体/表格/面板：[globals.css](../../src/app/globals.css:12)。官方参考“Typography and rhythm”“Color, surfaces, and boundaries”。
- 重复 IP：[geo-lookup.tsx](../../src/components/geo-lookup.tsx:168)。官方参考每项事实保留一个主要呈现位置。
- 文档旧值：[design.md](../../design.md:286)。当前 `.source-details>summary` 的 min-height 为 56px。

## 检查范围

已做：读取上述官方文档与代码；公网 `146.75.189.23` 结果；桌面和 390px；浅色结果与深色来源对照。截图与提取记录在 [.impeccable/review/vercel-design-audit](../../.impeccable/review/vercel-design-audit/evidence.json)。当次有 11 个来源，这个数量会随上游响应变化，不是固定可用性保证。

未做：本轮没有修改代码，所以未重跑构建/回归；未做物理手机、Safari、读屏、完整 WCAG 审计、CLS 量化或所有失败状态重验。上表明确区分可见重复、代码结构事实和待验证风险。
