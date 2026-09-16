# NextTrace API-only 部署

## 结论

GoMami JP 上原有的 `18080` 服务是本仓库定制版 NextTrace 的 deploy REST API，不是独立部署的 GlobalTrace 服务。公开 base URL 为：

```text
http://151.244.134.125:18080
```

2026-09-12 已关闭 WebUI、登录页、静态资源、WebSocket 与 MCP 的公开入口。公网 `18080` 只转发 `/api/*`，NextTrace 后端只监听 `127.0.0.1:18081`。

## 可用接口

所有接口均需要在 HTTP header 中提供 deploy token，支持以下任一形式：

```text
Authorization: Bearer <token>
X-NextTrace-Token: <token>
```

不要把 token 放入 URL query。当前公开接口为：

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/options` | 查询协议、数据源和默认参数 |
| `GET` | `/api/geoip?ip=8.8.8.8` | 查询一个 IPv4 或 IPv6 的 NextTrace GeoIP 信息 |
| `POST` | `/api/trace` | 从 JP 部署主机发起 traceroute |
| `POST` | `/api/cache/clear` | 清理服务端缓存，属于维护接口 |

无凭据示例：

```sh
curl -H 'Authorization: Bearer <token>' \
  'http://151.244.134.125:18080/api/geoip?ip=8.8.8.8'

curl -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  --data '{"target":"1.1.1.1","queries":1,"max_hops":15,"timeout_ms":1000,"disable_maptrace":true}' \
  'http://151.244.134.125:18080/api/trace'
```

## GlobalTrace 边界

NextTrace 源码把 GlobalTrace 定义为独立的 `Globalping x NextTrace` Web 项目。当前 JP unit 的启动命令是 `nexttrace --deploy`，没有 `--mcp`，因此没有部署 Globalping 多探针工具，也不存在 `/api/globaltrace`。

定制版 NextTrace 确实包含 `nexttrace_globalping_trace` 等 MCP tools，但只有使用 `--deploy --mcp` 启动后才会在 `/mcp` 提供。API-only 网关当前明确阻断 `/mcp`。因此这里所说的“之前自主部署的 API”，准确名称是 NextTrace deploy REST API。

## 识别依据

- 远端 `/etc/systemd/system/nexttrace-web.service` 原始 unit 将定制二进制以 `--deploy --listen 0.0.0.0:18080` 启动。
- 定制源码 `server/server.go` 注册了 `/api/options`、`/api/geoip`、`/api/trace` 和 `/api/cache/clear`，并把 `/`、`/assets`、`/ws/trace` 与可选 `/mcp` 分开注册。
- 变更前 systemd 日志记录了外部客户端对 `GET /api/geoip` 和 `POST /api/trace` 的成功请求；带 token 的现场请求再次确认两条接口返回真实结果。

## 实施与回退

远端变更：

- `/etc/systemd/system/nexttrace-web.service.d/api-only.conf`：将原服务改为只监听 `127.0.0.1:18081`。
- `/etc/systemd/system/nexttrace-api-proxy.service`：独立 Caddy API 网关，监听公网 `18080`。
- `/etc/nexttrace/api-only.Caddyfile`：只允许 `/api/*`，其他路径统一返回 `404`。
- `/root/nexttrace-api-only-backup-20260912T100618Z/nexttrace-web.service`：变更前 unit 备份。

本地受版本控制的部署源文件位于 `deploy/gomami-jp/nexttrace-api-*`。

如需恢复原 WebUI，可执行：

```sh
ssh gomami-jpn-pulse-pro '
  systemctl disable --now nexttrace-api-proxy.service
  mv /etc/systemd/system/nexttrace-web.service.d/api-only.conf \
    /root/nexttrace-api-only-backup-20260912T100618Z/api-only.conf.disabled
  systemctl daemon-reload
  systemctl restart nexttrace-web.service
'
```

该回退只恢复 NextTrace 原始公网监听和 WebUI，不涉及 ORBIT 或 sing-box。

## 验收

变更前：带 token 的 `/` 返回 `200 text/html`，`/api/options`、`/api/geoip` 和 `/api/trace` 返回 `200 application/json`。

变更后：

| 检查 | 结果 |
| --- | --- |
| `/`，有无 token | `404 text/plain` |
| `/assets/app.js` | `404` |
| `/auth/login` | `404` |
| `/ws/trace` | `404` |
| `/mcp` | `404` |
| 鉴权 `/api/options` | `200`，返回协议、数据源和默认参数 |
| 鉴权 `/api/geoip?ip=8.8.8.8` | `200`，返回 `8.8.8.8`、`AS15169`、`NextTrace-API` |
| 鉴权 `POST /api/trace` | `200`，`1.1.1.1` 解析正确，7 跳抵达目的地址 |
| 未鉴权 `/api/geoip` | `401 application/json` |
| 公网连接 `18081` | 拒绝连接 |

`nexttrace-web`、`nexttrace-api-proxy`、`orbit`、`orbit-proxy` 与 `sing-box` 均为 `active`，切换后两个 NextTrace unit 没有 warning/error 日志。

当前入口仍是明文 HTTP，deploy token 会在传输层以明文承载。若该 API 需要跨不可信网络长期使用，应另行绑定 HTTPS 域名或仅通过可信隧道访问。
