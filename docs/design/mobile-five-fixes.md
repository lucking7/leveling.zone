# 移动端五项审查修复

2026-09-12，基于 `.impeccable/review/mobile-20260912/report.md` 的五项优先问题，三路并行实施，主任务整合与验收。只修改两页markup、共享hero及CSS，不调整数据库或查询策略。

1. 紧凑来源摘要：来源名与48px展开按钮同排；网络和位置保留，来源ID移入详情，完整JSON可展开。
2. 失败顺序：`/myip` 失败提示在重试前，只显示一个错误notice；手机失败时隐藏地球，状态caption不再被覆盖为等待定位。503元数据和查询详情保留。
3. 窄屏英文：统一Network/Location短标签；320px位置标签与内容上下排列，无逐字碎裂标签。
4. 当前定位：两页选中行、On globe/当前定位及aria-pressed对齐，切换语言不重新查询或清除选中。
5. 辅助字号：手机副标题、数据库署名、选中提示与source ID均为12px；低于359px仍隐藏副标题，署名保留。

## 验收

TypeScript、Linux生产构建、23项页面回归、20项地球检查、10项语言检查、7项专项断言通过。专项覆盖两路由、中英文、320/390/768/1440共16种布局，以及来源选择、无重查语言切换和失败顺序。旧locale测试原本要求零来源分组，已按单一失败提示更新。

12个来源测试fixture在390px下查询页3273–3297px，myip 3238–3241px；320px下保留全部文本为3476–3531px，不用裁切满足任意高度。所有组合无横向溢出。初版3300px目标不适合320px完整长英文，最终测试将该尺寸预算定为3800px，390px仍为3300px。此前审查真实数据与本次fixture不完全相同，不据此声称严格百分比改善。

公网390px英文myip实测7来源，页面2182px、1个选中来源、署名12px、地球settled、无溢出。桌面真实查询与访问者查询均返回7个有效本地来源，服务器出口来源0。证据目录 `.impeccable/review/mobile-five-fixes/`，专项脚本 `tests/browser/mobile-five-fixes.cjs`。

浏览器为Chromium模拟，未覆盖物理iPhone/Android、Safari、真实软键盘和功耗。未重新执行双agent审查评分，不宣称分数提升。旧审查的两项P3不在本次五项授权中，仍保留。

## 部署

已切换 `releases/20260912-mobile-five-fixes`，前一版本 `20260912-globe-depth` 可回退。数据库快照不变，orbit、orbit-proxy与sing-box均active。
