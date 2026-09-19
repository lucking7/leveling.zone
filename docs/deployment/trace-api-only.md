# NextTrace API-only 网关

NextTrace 是独立服务，不由 ORBIT 的网站容器启动。仓库中的 [网关示例](../../deploy/gomami-jp/nexttrace-api-only.Caddyfile) 只转发 `/api/*`，其他路径返回 404。文件名和示例端口不代表当前部署目标；执行前应核实主机、监听地址、服务名和认证配置。

## 访问与边界

API-only 模式应将后端绑定到回环地址，仅向客户端暴露经过认证的网关。跨不可信网络使用 HTTPS 或可信隧道。认证由 NextTrace 后端执行，Caddy 的路径限制不能代替认证。

配置中的服务应按实际版本验证这些接口：

| Method | Path | 用途 |
| --- | --- | --- |
| GET | `/api/options` | 查询协议和默认参数 |
| GET | `/api/geoip?ip=…` | 查询指定 IP |
| POST | `/api/trace` | 从部署主机发起 traceroute |
| POST | `/api/cache/clear` | 维护接口：清理服务端缓存 |

token 仅放在 `Authorization: Bearer …` 或该后端支持的认证 header 中，不放入 URL。traceroute 的起点是部署主机，不能将其当作访问者浏览器的网络路径。

此网关不开放 WebUI、静态资源、登录页、WebSocket 或 `/mcp`，也不代表部署了 GlobalTrace/Globalping。开启这些能力需要单独调整后端和入口策略。

## 验收与恢复

部署验收应分别确认：

- 有效认证请求返回真实的 options、GeoIP 或 trace 结果；无认证请求被拒绝。
- `/`、`/assets/*`、`/auth/login`、`/ws/trace` 和 `/mcp` 不对外开放。
- 外部连接无法直接访问后端监听端口。
- 网关和后端日志无启动或转发错误。

变更前在目标主机备份实际 unit、override 和网关配置。恢复时使用该次备份并核对监听地址，不从本文复制历史主机命令。主机地址、SSH alias、备份路径及现场验收记录保留在本地运维记录，不纳入公开文档。本文不声明任何主机已部署或已通过验收。
