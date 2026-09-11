# Docker 部署

命令从项目根目录执行。数据库工具可单独运行，也可以供网站容器消费。

## 独立数据库更新容器

[Dockerfile.ipdb](../../Dockerfile.ipdb) 只安装 Python 数据库工具，不构建网站。

```bash
docker build -f Dockerfile.ipdb -t leveling-ipdb .
# 主机环境已配置两个 Token 时，传入环境变量名，不把值写进命令
docker run --rm \
  -e IP2LOCATION_TOKEN -e IPINFO_TOKEN \
  -v "$(pwd)/data/db:/data" leveling-ipdb
```

默认从上游更新全部选定数据库。只从已验证的公开 Release 安装：

```bash
docker run --rm -v "$(pwd)/data/db:/data" leveling-ipdb \
  install --repo lucking7/leveling.zone --store /data
```

容器退出成功后，新版本在挂载目录的 `current/`。失败保持旧版本。容量、校验与恢复规则见 [数据库指南](../database-updates.md)。

## 网站容器

[Dockerfile](../../Dockerfile) 安装 npm 与 Python 依赖并构建网站，使用 [入口脚本](../../scripts/docker-entrypoint.sh)。

```bash
docker build -t leveling-zone .
docker run -d --name leveling-zone -p 3000:3000 \
  -v "$(pwd)/data/db:/app/data/db" leveling-zone
```

默认首次启动时，若没有 `data/db/current/manifest.json`，从新格式 Release 安装完整版本；安装或校验失败会直接退出，不写虚假的初始化标记，不启动应用。此前旧格式 Release 缺少 manifest，会被拒绝，必须先发布一版新格式 Release，或用更新工具准备本地数据。

默认启动验证完成后执行 `npm start`。显式传给容器的其他命令会原样执行，不再被入口脚本替换成网站启动。

自备外部数据库并自行管理校验时可以设置 `IPDB_AUTO_INSTALL=0`，配合挂载与 `MMDB_PATH` 指定直接包含数据库文件的目录。这会关闭入口处自动安装和验证，不代表该数据库已通过本工具检查。

健康检查访问 `/`，只验证网站 HTTP 可用性；数据库完整性由启动前 `verify` 检查，查询结果仍需实际验证。reader 会在下一次查询时识别新版本，数据库更新无需重启网站容器。

## Compose

[Compose](../../docker-compose.caddy.yml) 提供网站、Caddy，以及默认不启动的 `db-updater` 工具服务。

```bash
# 先准备已验证的数据库，再启动网站
docker compose -f docker-compose.caddy.yml run --rm db-updater
docker compose -f docker-compose.caddy.yml up -d --build app caddy
```

若还没有新格式 Release，先用独立更新容器从上游准备 `data/db/`，再启动 app/caddy。后续更新后，下一次查询自动读取新版本：

```bash
docker compose -f docker-compose.caddy.yml run --rm db-updater
```

Caddy 的域名与跳转限制见 [Caddy 说明](caddy.md)。以上配置需在目标 Docker 主机实测，本轮不代表已部署。
