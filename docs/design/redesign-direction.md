# ORBIT 重设计方向记录

2026-09-12。状态：方向已选择，v0.4 已实现，最终审查结论以 [ORBIT 评审](orbit-review.md) 为准。

## 选择

用户选择 **ORBIT / 地址观测**，并批准 [`.impeccable/mocks/decision/orbit.png`](../../.impeccable/mocks/decision/orbit.png) 作为视觉方向。Impeccable seed `99568502` 与 decision key `afed6d95` 对应“轨道历表与科学出版物”路线；[候选记录](../../.impeccable/redesign-options.json) 保留 ORBIT、IP ATLAS 与未采用方案的取舍。

选择理由是它能同时表达两件事：以大幅字符地球建立清楚的品牌入口，以紧凑来源记录保留工具效率。方向稿中的英文标语、虚构日期、坐标和实时拓扑都不是产品事实，没有进入实现；示例来源行只作为明确标记的静态字段预览采用，不属于实时查询。

## 已落实的方向

- 产品显示名称从旧显示品牌更新为 **ORBIT / 地址观测**；仓库名、GitHub 地址和部署域名不迁移。
- 初始查询页采用左侧中文衬线大标题与可操作查询框、右侧字符地球的大幅 hero；出现查询结果后，hero 收紧并让全宽来源表接管主要空间。
- `/myip` 使用同一 hero 的紧凑变体，保留 `request-ip` 与 `server-egress` 的真实语义。
- [生产 hero v2](../../public/images/ascii-orbit-hero-v2.webp) 是 1891×832 的预转换静态 WebP，左侧留出真实文字和表单空间，右侧呈现完整地球轮廓；[PNG v2 原稿](../../public/images/ascii-orbit-hero-v2.png)继续保留。exact prompt 与转换记录在 [WebP v2 sidecar](../../public/images/ascii-orbit-hero-v2.webp.json)。
- 初始来源区落实方向稿的示例行，但用独立 figure 和“示例数据 · 非本次查询”把它与实时 `QueryResult` 分开；示例不会触发查询。
- 标题使用自托管的 Noto Serif SC SemiBold heading subset；来源和许可记录见 [字体来源](../../public/fonts/SOURCE.md)。正文继续使用系统无衬线，IP、ASN、时间与 source identifier 使用等宽栈。

## 保留的产品事实

IP 查询、仅本地数据库、来源对照、503 完整响应、失败保留旧结果、复制和 `/myip` scope 语义保持不变。非 JSON 响应有独立格式异常提示；桌面观测区以不可折叠标题呈现，窄屏才使用 disclosure。图像不表示精确坐标、网络路径、来源权威、覆盖率或安全结论。详细页面契约见 [ORBIT surface brief](orbit-surface.md)，视觉系统见根目录 [design.md](../../design.md)。
