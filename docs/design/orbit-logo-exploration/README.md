# Orbit Logo 探索与方法，2026-09-13

本轮提供四个方向的概念图，尚未替换网站标志，也不作为最终 SVG 或字体授权证明。图像由内置 imagegen 生成，完整提示词见 prompts.txt。

## 简报

Orbit 是 IP 与网络信息查询工具。标志需要适合 56px 网站 Header、移动导航及 favicon。视觉参考是用户提供的 Claude 图标与衬线字标，借用温暖、人文、简洁的方向。图形探索应围绕 Orbit 的名称和用途形成自己的识别点。

## 查到的专业方法

1. [Sagi Haviv / Skillshare](https://www.skillshare.com/en/classes/designing-brand-symbols-the-principles-and-process-of-making-logos-that-last/404415631)：考察合适、独特且能记住、简单三方面。先研究对象、探索轮廓，再处理字体和应用。不同候选使用同样的展示场景，便于公平比较。
2. [Sagi Haviv / Domestika](https://www.domestika.org/en/courses/1049-logo-design-from-concept-to-presentation)：公开课程介绍展示从客户理解、概念草图、筛选、矢量化、字体到应用展示的顺序。本轮仅阅读公开介绍，未购买课程。
3. [Logo Design Love / Negative space](https://www.logodesignlove.com/negative-space-logo-design)：案例用于理解图形与留白共同构成轮廓。用于 B 的负空间探索，而非挪用案例形状。
4. [Adobe / Black-and-white logos](https://www.adobe.com/express/learn/blog/black-and-white-logo-ideas)：单色能暴露结构、对比、排版问题。用于本轮每个方向的黑色小样。

## Logo 专项技能

2026-09-13 查询；数量是当时目录/API读数，不代表设计质量。

| 技能 | 证据 | 定位与采用部分 |
| --- | --- | --- |
| rknall/claude-skills@svg-logo-designer | [目录](https://skills.sh/rknall/claude-skills/svg-logo-designer)，约 6.9K installs；仓库 70 stars；[源码](https://github.com/rknall/claude-skills/blob/main/svg-logo-designer/SKILL.md) | 简报、多概念、横版/竖版/独立图标、单色及反白、SVG规范。 |
| neonwatty/logo-designer-skill@logo-designer | [目录](https://skills.sh/neonwatty/logo-designer-skill/logo-designer)，721 installs；仓库 88 stars；[源码](https://github.com/neonwatty/logo-designer-skill/blob/main/skills/logo-designer/SKILL.md) | 读取现有项目、区分真正不同方向、浅深色并排预览、16/32/64px检查、选择后迭代和导出。 |

搜索命令：npx -y skills find "logo design"、npx -y skills find "brand identity"、npx -y skills find "logo"。均未安装。这两项是社区工作流，不是 Anthropic 或专业设计机构发布的 Logo 标准。不采用其通用色彩心理标签、固定安全区或最小尺寸作为未经验证的规则。

## 本轮如何使用

- 先按隐喻分叉，再处理配色：单轨、食相、连接、字标。
- 所有候选使用同一底色和相近展示尺度，每个都有组合标志和单色图标，避免靠 mockup 场景制造偏好。
- 对图形与字标分别评价，避免独立图标好看但组合标志挤占 Header。
- 进行诚实的形状联想审视，不因为生成结果漂亮就默认可用。
- 当前是位图概念筛选。图上小样不是实际16px验收，选定方向后才重建矢量曲线，检查16/32/64px及真实Header。

## 四个方案

| 方向 | 图形与字标 | 优点 | 需修正或注意 |
| --- | --- | --- | --- |
| A 单轨圆点 | 一条开口椭圆轨道与分离圆点，柔和衬线 | 最接近温暖人文的参考气质，名称关联直接 | 环线最细处要加粗；主图文字被生成成陶土色，收敛时建议墨黑字标。 |
| B 负空间食相 | 厚实圆盘、圆形缺口、卫星点，较重衬线 | 剪影强、单色简洁 | 当前容易联想到吃豆人，辨识方向不足，不优先。 |
| C 交叠连接 | 两个相连椭圆，偏窄衬线 | 与网络连接相关，构图紧凑 | 接近通用链接符号，独特性不足，不优先。 |
| D 字标优先 | 将Orbit首字母O改成倾斜轨道，配卫星点 | 直接记住名称，Header更紧凑，O可单独使用 | O与r的衔接需光学校正，避免把O看成独立图标。 |

建议：A 和 D 进入下一轮。图中仍有轻微生成纹理和字形变化，不能直接当作纯色矢量母版。

## 收敛验收

选择方向后，以同一概念画少量比例变体。验证纯黑和反白、16/32/64px独立图标、现有56px Header、中英文导航下的宽度、曲线接点与字距。字标转为授权可用的真实字形或自绘轮廓，提供SVG、透明PNG、favicon和安全区说明。相似性检索与商标可用性本轮未完成。

