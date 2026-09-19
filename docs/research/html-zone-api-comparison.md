# HTML.ZONE 与 Orbit 查询服务对比

核查：2026-09-13。只读审计，未新增功能或部署。

本文保留接入前的历史比较与当时建议，不作为当前功能清单。后续已接入的查询与浏览器出口来源见 [当前来源说明](../query-sources.md) 和运行时 registry；下文的“当前”、数量、文件位置与线上结果均指上述核查日期。

## 结论

参考站当前部署脚本注册 29 个浏览器出口探测项、27 个指定 IP 查询项。它们不是 56 个独立数据库。Orbit 当前聚合查询有 8 个本地逻辑来源和 7 个在线适配器，与对方 27 项中 9 项存在供应商/功能重叠，18 项未接入当前查询流程。重叠不保证接口、版本、数据等级或实时可用性相同。

Orbit `/myip` 识别访问本站的请求 IP，再查本地库，没有参考站的浏览器跨站出口探测功能。旧 observation 模块不在当前页面调用链上，不能计为已上线能力。

## 指定 IP 查询：完整 27 项

在参考站提交 8.8.8.8，实际显示 19 行，其中 ipapi.is 只有 IP，没有位置/网络字段。其余 18 行有非空字段，不代表 18 个准确位置结果，例如 IPIP 位置栏为 GOOGLE.COM GOOGLE.COM。未显示不代表永久失效。

| 参考站项目 | Orbit 当前状态 | 参考站本次显示 |
| --- | --- | --- |
| 百度开放平台 | 未接入 | 有字段 |
| 百度企服(主) | 未接入指定 IP 查询，旧同供应商出口适配器不等价 | 未显示 |
| 百度企服(备) | 未接入；与主入口不是独立数据库 | 未显示 |
| 淘宝 | 未接入 | 未显示 |
| 纯真 IP 数据库 | 已有本地 QQWry，版本不保证相同 | 有字段 |
| 纯真官网 API | 未接入在线 API，本地库不能代替这一入口 | 有字段 |
| IPIP 数据库 | 未接入独立 IPIP 数据库，QQWry 的 ipdb 格式不等于 IPIP 数据 | 有字段 |
| MaxMind 数据库 | 已有本地 GeoLite2，版本/等级不保证相同 | 有字段 |
| 高德 | 旧 request-ip 适配器需要自有 AMAP_API_KEY，当前未接入 | 未显示 |
| IPInfo 数据库 | 已有本地 country/ASN 数据 | 有字段 |
| ZXINC | 只有旧出口适配器，未接指定 IP 查询 | 有字段 |
| PCOnline | 只有旧出口适配器，未接指定 IP 查询 | 有字段 |
| ZHALE.ME | 旧同名出口代码不等于当前指定 IP 接入 | 未显示 |
| IP.SB | 旧出口适配器未启用；参考其 UI 不等于接入其 API | 有字段 |
| ipinfo.io | 已有 IPinfo online，但用 widget/demo 而非 /IP/json | 有字段 |
| ipapi.co | 旧出口适配器未接当前查询 | 未显示 |
| ipbase.com | 已接入同一上游路径 | 有字段 |
| ip-api.com | 未接入，勿与 ipapi.co、ipapi.is 混淆 | 有字段 |
| ipdata.co | 已接入同一个 html.zone 中转 | 有字段 |
| ip2location.io | 已实现，但解析官网 HTML，本次 Orbit 失败 | 有字段 |
| ipwho.is | 未接入 | 有字段 |
| ipgeolocation.io | 未接入 | 有字段 |
| ipregistry.co | 已接入同一个 html.zone 中转 | 有字段 |
| freeipapi.com | 未接入 | 未显示 |
| ipquery.io | 已接入同一上游路径 | 有字段 |
| ipapi.is | 旧出口适配器未接当前查询 | 仅 IP，无位置/网络 |
| apip.cc | 旧出口适配器未接当前查询 | 未显示 |

## 出口探测：完整 29 项

这些能力均未作为浏览器出口探测接入 Orbit。可复用旧解析逻辑，不可直接恢复服务器代查。

1. 腾讯
2. 今日头条
3. 高德
4. 又拍云
5. PCOnline
6. ZHALE.ME
7. 阿里云 ESA
8. 腾讯云 ESA
9. Visa
10. ChatGPT
11. Claude
12. APNIC
13. Vercel
14. Netlify
15. ipwho.is
16. Cloudflare
17. Cloudflare IPv4
18. Cloudflare IPv6
19. IP.SB IPv4
20. IP.SB IPv6
21. ZXINC IPv4
22. ZXINC IPv6
23. ident.me IPv4
24. ident.me IPv6
25. browserscan.com
26. surfshark.com
27. ipquery.io
28. ipapi.is
29. apip.cc

Visa、ChatGPT、Claude、APNIC 读取各自域名的 `/cdn-cgi/trace`，只取 IP/loc，不是账号可用性、解锁测试、模型 API 或 RDAP 注册信息。Vercel、Netlify、阿里/腾讯 ESA 是作者部署的边缘回显服务，不是通用任意 IP 数据库 API。IPv4/IPv6 成对项用于不同网络出口检测，不应算作两套数据库。

浏览器出口检测必须由访问者浏览器发起，或采用明确保持客户端地址语义的架构。JP 服务器请求这些回显地址，观测到的是 JP 出口。不得将其作为访问者 IP 展示。

## Orbit 本次线上实测

`GET /api/query?ip=8.8.8.8` 返回 12 个有效来源：本地 7 项（MaxMind、DB-IP、QQWry、IPinfo、IPtoASN、IP2Location、ASN Info），在线 5 项（ipbase、ipdata、ipquery、ipregistry、IPinfo demo）。GeoCN 无可用结果，ip2location.io 和 DB-IP demo 报 Source unavailable。单次失败不证明永久失效。

Orbit 额外具备本地 DB-IP、IP2Location 与代理信息、GeoCN、IPtoASN、ASN Info，以及通过 IANA 路由的权威 RDAP 查询。对方本次 27 项清单未包含这些独立来源/能力，不据此推断其全站没有其他工具。

## 建议顺序

1. 优先评估 IP.SB、ipwho.is、纯真官网 API、ZXINC、PCOnline、ip-api.com、ipgeolocation.io。本次参考站均有非空输出；接入前独立核实契约、速率、凭据与 IPv6。
2. 修复已有 ip2location.io 的稳定性。ipdata/ipregistry 已依赖 html.zone 中转，应明确保留或改用自有授权 API，不把中转当作供应商 SLA。
3. 百度企服主备、淘宝、高德、ZHALE.ME、ipapi.co、freeipapi、apip.cc 本次未显示，先验活再排期。ipapi.is 需排除只有输入 IP 的假成功。
4. 单独设计出口诊断入口，保持 `/myip` 当前语义。优先 IPv4/IPv6 对照与少量不同网络服务，失败静默，不回退到服务器出口。trace 成功不应标记为 ChatGPT/Claude 解锁。
5. 不复制网页公开嵌入的第三方 key，需要凭据时使用自有环境变量。本次未复用参考站高德 key。

## 来源与边界

- [本机 IP 页面](https://html.zone/ip/)
- [指定 IP 查询页面](https://html.zone/ip/query/?ip=8.8.8.8)
- [当前部署的服务清单脚本](https://html.zone/_astro/ip-info.MMCWqErG.js)，资产 hash 后续可能变化。
- 已抽取且脱敏的完整 endpoint 清单：`.firecrawl/html-zone/inventory.json`；Orbit 响应：`.firecrawl/html-zone/orbit-live.json`。
- Orbit 代码：`src/modules/query/external.ts:6`、`src/modules/query/normalize.ts:52`、`src/modules/query/visitor.ts:5`、`src/modules/observation/sources.ts`、`src/app/api/myip/route.ts`。
- 参考站 metadata 仍提及部分当前数组没有的条目，如首页的 speedtest.cn、2345、IPChaXun、IP138，以及指定查询的 CSDN、ifconfig.co。本报告以当前注册数组为准。
- 参考站运行位置为研究浏览器，Orbit 上游请求从 JP 发出，网络不同。本轮不是同网络的可用率、延迟、IPv6 或精度基准测试，未独立调用全部上游。
