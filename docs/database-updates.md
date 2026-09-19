# 数据库更新与 Release

命令从项目根目录运行，Python 3.11+，依赖见 [requirements-ipdb.txt](../scripts/requirements-ipdb.txt)。主机部署见 [host.md](deployment/host.md)。

## 来源与选择

唯一清单为 [databases.json](../config/databases.json)，默认全部必需：

| ID | 数据源与输出 | 下载形式 |
| --- | --- | --- |
| `geolite2-asn,geolite2-city,geolite2-country` | P3TERX 的 GeoLite2 镜像，3 个 MMDB | 公开镜像，不是 MaxMind 官方直连 |
| `dbip-asn,dbip-city,dbip-country` | DB-IP 官方当月 Lite，3 个 MMDB | gzip 解压，年月自动代入 |
| `ip2location-db11,ip2location-px11,ip2location-asn` | IP2Location 官方，3 个 BIN | 需要 `IP2LOCATION_TOKEN`，自动识别 ZIP/raw |
| `ipinfo` | IPinfo Country ASN MMDB | 需要 `IPINFO_TOKEN`，自动识别 gzip/raw |
| `qqwry` | metowolf/qqwry.ipdb 经 unpkg 分发 | IPDB |
| `iptoasn` | sapics/ip-location-db 原作者转换产物 | `iptoasn-asn-ipv4.mmdb` |
| `as-info` | ipverse/as-metadata | 含表头的 `as-info.csv` |
| `geocn` | ljxi/GeoCN Release | 保存为 `geocn.mmdb` |

公开来源仍遵循各自更新周期，每天运行不代表每个文件每天变化。需要 MaxMind 官方账户直连或不同产品时，显式调整清单与认证，不把镜像描述成官方。

全部选定项必须成功。缺凭据直接阻断，不静默跳过。`--only ID1,ID2` 明确创建子集版本，manifest 的 `selected` 记录范围。DB-IP 若当月上游还未发布会失败并保留旧版，不暗中用上月文件冒充当月新数据。

## 更新事务

```bash
.venv-ipdb/bin/python scripts/ipdb.py update --config config/databases.json --store data/db
```

1. 检查清单和凭据，取得目标 store 的独占目录锁。
2. 在同一文件系统的临时目录下载，限制大小、检查 HTTP 与完整长度。
3. gzip/ZIP 解压；ZIP 只读取清单指定的文件，不将任意目录写入磁盘。
4. 校验 MMDB、BIN、IPDB 或 CSV 的格式与可读性，拒绝零字节、错误网页、Git LFS 指针、损坏包及错误内容。
5. 写入包含大小、SHA-256、来源主机与选定项的 manifest，复核后移动到不可覆盖的版本目录，原子替换 `current` 符号链接。

同尺寸的新内容仍会更新。失败清理临时目录，旧 `current` 保持不动。旧版本不会自动清理；PX11 当前解压约 1.6 GB，应为下载、暂存与历史版本预留数 GB 以上空间，并按主机保留策略管理容量。

更新器使用 HTTPS 并验证证书；不要用关闭证书验证来绕过网络错误。错误摘要不输出带凭据的完整 URL 或环境值。

## Release 发布

[workflow](../.github/workflows/update-databases.yml) 每天 UTC 00:00 下载、校验并保存 manifest artifact，也可手动运行。定时任务和手动默认 `publish=false` 都不会创建远端资源；仅手动显式设为 `true` 才发布 Release：

- 只安装 Python 工具、执行测试、更新清单并发布数据库，不依赖 npm 或网站构建。
- 使用包含 run ID 与 attempt 的新版本号，避免重跑覆盖已有版本。
- 拒绝已有 tag；为指定 commit 建立 tag，再创建 draft Release 并上传全部数据库、manifest、SHA256SUMS。
- 核对远端附件集合、大小及 SHA-256，核对 tag 的 commit，全部通过才公开并标为 latest。
- 发布请求前失败会保留 draft 或未发布 tag 供排查，旧正式 Release 不变。公开命令已经发出但最终确认失败时，状态可能是 public、draft 或未知，必须先检查该 Release 再决定是否用新版本号重跑。不自动删除远端资源。

主机也能使用 publisher（需要 `gh` 与具备仓库写权限的认证）：

```bash
# --version 与 --tag 必须相同；TARGET_COMMIT 必须是将要关联的完整 commit SHA
.venv-ipdb/bin/python scripts/ipdb.py update --version ip-db-VERSION
.venv-ipdb/bin/python scripts/publish-ipdb.py \
  --directory data/db/current --repo lucking7/leveling.zone \
  --tag ip-db-VERSION --target "$TARGET_COMMIT" --dry-run
```

`--dry-run` 只校验本地发布输入，不访问 GitHub。实际发布时移除该参数，操作会创建远端 tag 和 Release。先提交需要关联的代码并核对目标，再在获准范围内发布。

发布前校验在独立 Python 子进程中执行，限时 600 秒。该次格式、哈希和版本校验直接产出发布清单，父进程使用同一清单核对上传附件；不会为构造清单再次扫描数据库。远端附件大小、摘要和目标 commit 仍在公开前独立核对。

默认完整更新需要仓库 Secrets `IP2LOCATION_TOKEN` 和 `IPINFO_TOKEN`；工作流的 `GITHUB_TOKEN` 用于发布。旧 Blob Secret 不再被使用，本轮不删除云端资源或 Secret。

## 安装、恢复与验证

```bash
.venv-ipdb/bin/python scripts/ipdb.py install --repo lucking7/leveling.zone --store data/db
.venv-ipdb/bin/python scripts/ipdb.py verify --directory data/db/current
```

安装只接受正式公开 Release，核对版本、完整文件集合与 manifest 哈希后才切换本地版本。此实现面向公开仓库，不保证 private Release 附件下载。缺 manifest 的历史 Release 或部分附件会被拒绝；可用 `--tag` 指定一个完整的新格式版本。

正常失败会释放锁。进程被强制终止时，`.update.lock/owner.json` 记录 PID、主机和时间；确认无更新进程后，人工移走锁目录及未使用的 `.stage-*`，再重试。不要根据年龄自动破锁。

回到旧版本前先对 `versions/<old-version>` 执行 `verify`，然后在没有更新任务运行时，通过临时符号链接加原子 rename 替换 `current`。下一次查询会切换 reader，已有请求完成后释放旧 reader。不要直接覆盖当前数据库文件，也不要删除仍被引用的版本目录。

测试覆盖失败保旧、损坏/缺失文件、同尺寸内容变化、锁、压缩格式、Release 完整性与发布失败。完整受认证上游更新、GitHub 实际发布、主机部署仍需要各自的真实运行证据，不能从离线测试推断。
