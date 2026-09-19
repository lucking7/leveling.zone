# Caddy 部署

所有命令从项目根目录执行。配置文件保留在根目录：[Caddyfile](../../Caddyfile) 与 [Compose](../../docker-compose.caddy.yml)。容器运行方式见 [Docker 部署说明](docker.md)。

## 配置中的路径

| 请求路径 | 上游处理 |
| --- | --- |
| `/ip` | 改写为 `/myip` |
| 其他路径 | 保留路径转发到应用 |

配置使用 `rere.ws` 和上游 `app:3000`，这是仓库配置值，部署前核实实际目标。应用的 `/ip/query` 页面会跳转到 `/`，配置代理根路径以承接该跳转；部署后仍需验证完整浏览器跳转链。

该配置面向直接接收访问者连接的入口：删除传入的 `CF-Connecting-IP`，以连接地址覆盖 `X-Real-IP`。Caddy 管理 `X-Forwarded-For`；应用优先使用覆盖后的 `X-Real-IP`。若前面还有 CDN 或其他代理，需先按实际可信代理范围配置地址恢复，不能直接放行客户端的转发 header。

`/_next/static/*` 响应缓存一年，`/api/*` 响应禁止缓存；Caddy 按请求路径覆盖上游的 `Cache-Control`，其他页面保留上游缓存策略。部署后分别检查这三类路径的响应 header。

## 本地检查

启动应用后可以直接验证页面、查询接口与静态资源：

```bash
npm run dev
```

需要连同代理一起验证时，写一个临时站点块启动 Caddy，不要修改仓库中的 Caddyfile：

```caddyfile
localhost, 127.0.0.1 {
    handle_path /ip {
        rewrite * /myip
        reverse_proxy localhost:3000 {
            header_up -CF-Connecting-IP
            header_up X-Real-IP {remote_host}
        }
    }
    handle {
        reverse_proxy localhost:3000 {
            header_up -CF-Connecting-IP
            header_up X-Real-IP {remote_host}
        }
    }
}
```

按 Caddy 实际启动日志的协议、端口和证书配置访问 `/ip`、`/ip/query`、`/api/myip` 与静态资源；不要把本地配置假定为仅 HTTP。HTTP 200 只说明代理可达，不代表查询有数据。

向 `/api/myip` 发送自定义 `CF-Connecting-IP`、`X-Real-IP` 和 `X-Forwarded-For`，确认响应使用实际连接地址而非自报地址。另行检查 `external=false` 在 `/ip/query` 跳转后保留。

## 容器部署与日志

在按 [Docker 说明](docker.md) 准备好数据库、核实域名和端口后，使用显式 Compose 文件：

```bash
docker compose -f docker-compose.caddy.yml up -d --build
docker compose -f docker-compose.caddy.yml ps
docker compose -f docker-compose.caddy.yml logs app caddy
```

Compose 将根目录 `Caddyfile` 挂载到 `/etc/caddy/Caddyfile`，将访问日志挂载到 `logs/`，并使用 Caddy 命名卷保存配置与证书数据。修改配置后先验证语法；在授权部署范围内再重载：

```bash
docker exec leveling-zone-caddy caddy validate --config /etc/caddy/Caddyfile
docker exec leveling-zone-caddy caddy reload --config /etc/caddy/Caddyfile
```

实际验收需要页面、查询接口、重定向链和日志证据。容器进程存在或端口开放不足以证明服务正常。
