# ASCII 与终端风格设计参考

核查日期：2026-09-12。本文记录证据与采用理由，具体设计决策以根目录 [design.md](../../design.md) 为准。未安装外部组件包，也未移植其源码。

## 推荐顺序

| 参考 | 已核实的公开材料 | 对 LEVELING.ZONE 的价值 | 采用范围 |
| --- | --- | --- | --- |
| [SRCL / sacred.computer](https://github.com/internet-development/www-sacred) | 官方 README、MIT 标识、[组件目录](https://sacred.computer/llm/components/AGENTS.md)，含用途、props、tokens 和源码入口 | 最接近可以实施的终端 UI 参考，适合研究 ActionBar、Button、AlertBanner、Accordion | 参考结构和 token 映射，按需审阅组件源码后再决定复用；不导入全库或部署配置 |
| [The Monospace Web](https://owickstrom.github.io/the-monospace-web/) | 作者示例页与 [源码 README](https://github.com/owickstrom/the-monospace-web)，MIT，展示表格、表单、字符图与网格 | 解释等宽字符和行高如何形成视觉秩序 | 借鉴数字对齐、语义 HTML、pre/figure；中文不强制进入英文字符网格 |
| [ASCII Magic](https://www.ascii-magic.com/app) | 前一轮浏览器观察、本轮官网说明、[context.md](https://www.ascii-magic.com/context.md) | 字符密度、明暗映射、单色表现及素材制作参考 | 首版只保留静态字符图，操作区和结果保持普通文本 |
| [Terminal CSS](https://terminalcss.xyz/) | 官方组件示例、CSS 变量说明，包含表单、表格、按钮、alerts | 说明少量变量和原生 HTML 可以形成完整一致的风格 | 借鉴轻量 token 结构；已有 Tailwind 基础继续使用，不叠加全局 reset |
| [Vercel design.md 方法](https://vercel.com/blog/how-our-agents-build-on-brand-pages-with-design-md) | 前一轮已阅读的公开文章及规范 | 把指导、可复用实现与固定场景验收分开 | 方法用于本项目自己的品牌、组件与文案，不使用 Vercel 品牌 CSS |

这里的“推荐”指设计参考价值，不代表这些组件已在本项目运行、已满足无障碍要求或值得直接安装。

## ASCII Magic 的 Markdown 究竟是什么

官网将按钮显示为 `Context.MD`，本轮检查其公开页面脚本，实际请求是小写 `/context.md`。实测该地址返回 HTTP 200、`text/markdown`；`/Context.md` 与 `/design.md` 返回 404。404 仅说明这些具体路径不可用，不能证明整个站点不存在其他设计材料。

文件标题是 `ASCII Magic, Product Context`，标注更新于 2026-07-12，主要介绍样式、编辑控制、recipe 与导出，不是配色/间距/token/组件规范。它与首页对样式数量存在差异，所以不把其中所有产品指标当成当前已验证能力。

本轮官网与限定搜索未定位到该网站作者发布的完整 UI 源码仓库或官方 design.md。搜索结果中同名 ASCII 工具不能据此认作该站源码。

值得采用的两点：字符按亮度层次形成图形，以及把配置显式化以便复现。对本项目可转成固定字符集合、列数、图形来源和 CSS 约定；无需移植其图片编辑器、动画引擎或配方系统。

## SRCL 为什么优先

它提供 [llms.txt](https://sacred.computer/llms.txt) 作为文档索引，组件目录给出名称、用途、props 和主题变量，源码能单独读取。这比只让 agent 模仿一张图片更容易约束实现。

本轮已阅读组件目录中的 ActionBar、ActionButton、AlertBanner、Accordion、Button、ASCIICanvas 等条目，但未对完整组件实现做兼容性或安全审计。目录说明 ASCIICanvas 使用动画与 per-cell span，本项目第一版采用静态 pre，不为视觉相似引入逐帧 DOM 更新。字符进度条也只有在真实进度存在时才适用，当前聚合查询接口没有该数据。

其 README 提及使用 Vercel 托管，这是参考站自己的部署选择，不是组件风格必须依赖的能力。本项目继续仅考虑 Release 与主机部署。

## 证据边界与下一步

本轮新增参考核实到官方文本、目录与源码 README 层面，没有把未浏览的新站点描述成已完成视觉或真实设备验收。ASCII Magic 的界面外观来自前一轮实际浏览器查看；旧 AI 效果图仍是概念图。

下一轮前端实施时，以本项目的查询控件、来源表、状态条和折叠观测区组成最小可运行页面，再保存固定视口截图。优先解决阅读与恢复状态，再判断是否需要增加点阵材质或更复杂的地理图形。
