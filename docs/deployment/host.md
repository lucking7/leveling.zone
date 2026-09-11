# 独立主机运行

更新工具与网站可分开部署。工具需要 Python 3.11+、HTTPS 网络与数 GB 可用空间，使用 POSIX 符号链接的 Linux/macOS 文件系统。不需要 npm，也不会自动启动网站或发布 Release。

## 手动运行

从仓库根目录安装：

```bash
python3 -m venv .venv-ipdb
.venv-ipdb/bin/pip install -r scripts/requirements-ipdb.txt
```

在进程环境配置 `IP2LOCATION_TOKEN` 与 `IPINFO_TOKEN` 后执行：

```bash
.venv-ipdb/bin/python scripts/ipdb.py update --store /var/lib/leveling-ipdb
```

若主机只消费 GitHub Release：

```bash
.venv-ipdb/bin/python scripts/ipdb.py install \
  --repo lucking7/leveling.zone --store /var/lib/leveling-ipdb
```

网站设置 `MMDB_PATH=/var/lib/leveling-ipdb/current`。成功更新后下一次查询自动切换 reader，旧请求仍使用原版本；更新失败保留旧数据。首次部署前需要至少一个通过校验的版本。

## systemd 定时示例

[service](../../deploy/systemd/leveling-ipdb.service) 与 [timer](../../deploy/systemd/leveling-ipdb.timer) 假设仓库位于 `/opt/leveling.zone`，用 `leveling` 用户运行。按实际主机调整这两项。

```bash
# 确保 leveling 用户已存在，仓库和虚拟环境对它可读
sudo install -d -o leveling -g leveling -m 0750 /var/lib/leveling-ipdb
sudo install -m 0600 deploy/ipdb.env.example /etc/leveling-ipdb.env
# 编辑 /etc/leveling-ipdb.env 填入凭据，保持权限 0600
sudo install -m 0644 deploy/systemd/leveling-ipdb.service /etc/systemd/system/
sudo install -m 0644 deploy/systemd/leveling-ipdb.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start leveling-ipdb.service
sudo journalctl -u leveling-ipdb.service -n 100
# 首次验证成功后再启用每天定时执行
sudo systemctl enable --now leveling-ipdb.timer
```

默认每天 UTC 00:00 后随机延迟最多 10 分钟。想改成消费 Release，将 service 的 `ExecStart` 改为上面的 `install` 命令。数据库更新不再要求重启网站；应用代码或配置变更仍按主机运维流程重启。

[数据库指南](../database-updates.md) 说明完整性策略、容量、锁恢复与旧版本回退。这些是待部署示例，本轮未在任何远端主机安装或启用。
