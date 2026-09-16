# 移动端适配验收

使用 Impeccable adapt 与 better-layout，保留 ORBIT 视觉、查询契约和双语能力。

- 手机结果态地球 290px → 176px，初始态 220px，地址更早进入视口。
- 来源详情由窄列改为整行；768–1000px 平板与横屏来源表也采用字段条目。
- 输入 16px、关闭自动纠错、搜索键提示；触摸主要控件 48px、checkbox label 44px。
- 安全区、viewport-fit、动态视口高度与低高度横屏布局已配置，不限制缩放。

TypeScript、生产构建与原有 23 项浏览器回归通过。专项使用 Chromium 触摸及视口模拟，覆盖两路由、中英文、320/390/430/768/844横屏/1440共24组合，长IPv6、长元数据、展开/定位、失败重试和720 CSSpx等效200%重排。首轮发现844横屏列宽不足，最后批次将平板表格改为字段条目，确认结果见专项证据。

公网390px真实访问者查询返回7来源，无横向溢出、地球176px；桌面真实查询通过。页面无样本数据，专项测试中的fixture仅存在于测试拦截响应。

证据：[专项目录](../../.impeccable/review/mobile-adaptation/)、[公网接口验收](../../.impeccable/review/mobile-adaptation/deployed/live-smoke.json)。

未验证物理iPhone/Android、移动Safari、软键盘弹出、实际刘海与浏览器工具栏变化、辅助技术和RTL。浏览器模拟不等同真机验收。
