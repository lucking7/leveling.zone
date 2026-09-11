# Caddy 部署

所有命令从项目根目录执行。配置文件保留在根目录：[Caddyfile](../../Caddyfile)、[Caddyfile.local](../../Caddyfile.local)、[Compose](../../docker-compose.caddy.yml)。容器运行方式见 [Docker 部署说明](docker.md)。

## 配置中的路径

| 请求路径 | 上游处理 |
| --- | --- |
| `/ip` | 改写为 `/myip` |
| `/ip/query*` | 保留路径转发到应用 |
| `/` | 保留路径转发到应用，承接查询页跳转 |
| `/api/*`、`/_next/*`、`/favicon.ico` | 保留路径转发 |
| 其他路径 | 返回 404 |

生产配置使用 `rere.ws` 和上游 `app:3000`，本地配置使用 `localhost:3000`。这些是仓库配置值，部署前核实实际目标。应用的 `/ip/query` 页面会跳转到 `/`，两个配置都代理根路径以承接该跳转；部署后仍需验证完整浏览器跳转链。

## 本地检查

先在一个终端启动应用：

```bash
npm run dev
```

再从项目根目录验证并启动本地 Caddy：

```bash
caddy validate --config Caddyfile.local
caddy run --config Caddyfile.local
```

按照 Caddy 实际启动日志的协议、端口和证书配置访问 `/ip` 与 `/ip/query`，验证 API 和静态资源；不要把本地配置假定为仅 HTTP。

辅助脚本位置为 `scripts/test-caddy.sh`，仍从项目根目录运行：

```bash
bash scripts/test-caddy.sh
```

该脚本以应用 `/` 的 HTTP 响应作可用性检查，并使用 HTTP 地址测试代理，需结合实际协议判断结果，不能将其当作数据库完整性或完整浏览器验收。

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
