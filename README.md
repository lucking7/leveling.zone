# leveling.zone

IP 地理位置、ASN 和网络信息查询网站，以及可独立运行的数据库更新工具。

## 数据库更新

同一套 Python 工具可在 GitHub Actions 或 Linux/macOS 主机运行。默认选中 14 个数据库，任何一个下载、解压或格式校验失败，整个版本都不会激活。更新器不依赖网站的 npm 安装。

```bash
# 从项目根目录执行，Python 3.11+
python3 -m venv .venv-ipdb
.venv-ipdb/bin/pip install -r scripts/requirements-ipdb.txt

# 先在进程环境配置 IP2LOCATION_TOKEN 与 IPINFO_TOKEN
.venv-ipdb/bin/python scripts/ipdb.py update

# 校验当前版本
.venv-ipdb/bin/python scripts/ipdb.py verify --directory data/db/current
```

成功后输出版本目录。数据库保存在 `data/db/versions/<version>/`，`data/db/current` 原子指向通过校验的版本，旧版本保留。每版附 `manifest.json` 与 `SHA256SUMS`。默认任一所需凭据缺失即失败，不会静默缩减数据库清单。

只测试公共来源时可以显式选择，例如：

```bash
.venv-ipdb/bin/python scripts/ipdb.py update --only dbip-asn,iptoasn,geocn
```

该版本只包含选中的 3 项，不代表全库更新成功。完整来源、发布流程与失败恢复见 [数据库更新指南](docs/database-updates.md)。

## 从 Release 安装

```bash
.venv-ipdb/bin/python scripts/ipdb.py install --repo lucking7/leveling.zone
# 或指定一个已验证的新版本
.venv-ipdb/bin/python scripts/ipdb.py install --repo lucking7/leveling.zone --tag ip-db-VERSION
```

仅消费有完整 manifest、校验和及数据库附件的正式公开 Release。旧流程生成的无 manifest Release 会被拒绝，不能用它完成新容器的首次初始化。此工具不负责清理历史 Release，也不把数据库提交到 Git。

## 本地网站

```bash
npm ci
npm run dev
```

应用使用 Next.js App Router、React、TypeScript。`/` 查询 IP，`/myip` 展示访问者信息，`/geoip` 与 `/whois` 提供地址与注册信息页面，`/egress` 诊断出口来源，`/ip/query?ip=8.8.8.8` 转到主页。

可选的高德数据源从服务端环境变量 `AMAP_API_KEY` 读取；未设置时跳过该来源。仓库中不保存 API key。

读库优先级：`MMDB_PATH`（直接包含文件的目录）→ `data/db/current/` → `data/db/` → `public/db/`。一次查询固定一个目录，缺库返回部分结果，不从其他版本补齐。后两者兼容已有本地数据，不代表已通过校验。下一次查询会识别版本切换并更新 reader，数据库更新无需重启应用。仓库不再包含 Vercel 或 Blob 支持。

```bash
npx --no-install tsc --noEmit --incremental false
npm run build
npm start
```

数据库工具测试：

```bash
.venv-ipdb/bin/python -m unittest discover -s tests -p 'test_*ipdb*.py' -v
```

`npm run lint` 尚无 ESLint 配置，会进入配置交互。网站整体测试框架尚未建立；数据库测试不等于网站完整验收。

## 布局与部署

- `src/app/`、`src/components/`：网站页面、API 与组件。
- `src/services/`、`src/utils/`：读库服务、路径解析及通用工具。
- `scripts/ipdb.py`、`scripts/publish-ipdb.py`：下载、校验、安装及 Release 发布。
- `config/databases.json`：唯一更新清单，14 个来源及输出文件名。
- `tests/`：更新事务、发布失败与容器入口测试。
- `deploy/systemd/`：主机定时运行示例。

[主机部署](docs/deployment/host.md) · [Docker 部署](docs/deployment/docker.md) · [Caddy 配置](docs/deployment/caddy.md) · [Agent 指南](AGENTS.md)
