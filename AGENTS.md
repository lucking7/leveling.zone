# leveling.zone

项目包含 IP 查询网站和独立数据库更新工具。回复使用中文，代码与标识符保持 English。

## 修改入口

- 网站页面和 API 路由在 `src/app/`，组件在 `src/components/`，`@/*` 指向 `src/*`。编辑前追踪实际 import 和请求 URL。
- IP 查询 route 仅作 adapter；统一 implementation 位于 `src/modules/query`，旧输出 projection 位于 `legacy.ts`。字段变化需覆盖主页面、兼容 GET/POST 及供应商直达 route，见 [架构说明](docs/architecture.md)。
- 服务器读库统一通过 `src/modules/database`，查询与归一化通过 `src/modules/query`。每次查询固定一个数据库目录，优先 `MMDB_PATH`，再 `data/db/current`、`data/db`、`public/db`，缺件不跨版本补齐。reader 按文件身份缓存；下一次查询发现版本变化后退休旧 reader，正在使用的 reader 延迟释放，无需为数据库更新重启应用。
- `src/app/api/myip/route.ts` 使用 Node.js runtime，基于可信入口提供的访问者 IP 查询本地数据库；禁止调用服务器出口探测源。数据库依赖不得引入客户端或其他 Edge 路由。

## 数据库更新与发布

- 先读 [数据库指南](docs/database-updates.md)。唯一来源清单是 `config/databases.json`，共享更新/安装/校验实现为 `scripts/ipdb.py`，发布实现为 `scripts/publish-ipdb.py`。
- 所有选定数据库必须下载、解压并校验成功才能激活或发布。缺少凭据不能静默跳过；显式 `--only` 才创建子集，不能宣称全库更新成功。
- 数据库存为 `data/db/versions/<version>`，通过 `current` 原子切换。保留旧版本，失败不能覆盖可用数据；更新锁不得仅按年龄强制移除。
- 保留输出文件名大小写。PX11 ZIP 内 member 是 `IP2PROXY-LITE-PX11.BIN`，解压后的兼容输出名为 `IP2LOCATION-LITE-PX11.BIN`；IPtoASN 为 `iptoasn-asn-ipv4.mmdb`，ASN 元数据为 `as-info.csv`。
- 数据库文件不提交 Git，不用大小相同作为内容相同的依据。校验格式及 SHA-256，禁止将 ZIP、网页、零字节或 LFS 指针当数据库发布。
- Release 先创建 draft、上传并核对全部附件与目标 commit，最后公开。不得复用既有 tag 或覆盖已发布版本。公开请求后的确认失败必须报告状态未知并要求人工检查；不自动删除远端资源。
- `update` 会访问上游并写本地版本；`install` 会下载正式公开 Release；publisher 非 dry-run 会创建 tag 和 Release。只在用户授权的相应范围内执行，普通代码检查不得触发发布。
- 不再支持 Vercel/Blob，不重新引入其依赖、配置或回退路径。已有云端资源未随仓库清理而删除。
- 凭据只由进程环境或平台 Secrets 提供。报告仅给变量名与配置状态，禁止输出值、带 token 的 URL 或完整网络异常对象。

## 验证

- 数据库工具使用 Python 3.11+，依赖固定在 `scripts/requirements-ipdb.txt`；测试为 `python -m unittest discover -s tests -p 'test_*ipdb*.py' -v`，需先在虚拟环境安装依赖。
- 更新器改动覆盖失败保旧、完整性、压缩包、并发锁、同尺寸变更及 Release 缺件/篡改。发布器测试必须 mock 远端，真实发布需要单独授权与证据。
- 网站使用 npm 与 `package-lock.json`。安装用 `npm ci`；开发用 `npm run dev`；按影响运行 `npx --no-install tsc --noEmit --incremental false` 与 `npm run build`。不要顺带升级无关依赖。
- 查询、reader 或 request-ip 解析变更运行 `npm test`，覆盖部分成功、IPv4/IPv6、旧 projection、snapshot 切换与并发释放。
- `npm run lint` 尚无 ESLint 配置，首次配置交互不是通过。数据库测试、构建成功和实际查询成功分开报告。
- 文档改动检查链接和 diff；页面改动验证实际路由、加载及错误状态；数据库 API 改动验证相关 IPv4/IPv6 与失败路径。HTTP 200 或空对象不能证明查询成功。

## 部署相关任务

- 主机部署先读 [host.md](docs/deployment/host.md)，工具容器和网站部署读 [docker.md](docs/deployment/docker.md)，代理任务读 [caddy.md](docs/deployment/caddy.md)。示例不代表当前主机已经部署。
- 保持 Dockerfile、Caddyfile 和 Compose 的根目录位置。辅助脚本位于 `scripts/`，从项目根目录执行；Compose 显式指定 `-f docker-compose.caddy.yml`。
- `.github/workflows/update-databases.yml` 独立运行 Python 测试、更新和 Release 发布，不提交数据库，不发布 Docker 镜像。手动触发前确认外部操作范围。
- 网站容器安装或验证数据库失败必须退出，显式 command 必须被尊重。HTTP 健康检查与数据库内容验收分开。
- 不从仓库名或文档域名推断真实部署目标。部署前核实目标主机、项目和环境，在已有授权范围内完成验证。
