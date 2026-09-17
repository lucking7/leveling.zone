# 查询与数据库 module

## 执行路径

- `src/modules/query` 拥有 source 执行、归一化及部分失败结果。主页面发起一次请求，消费 `QueryResult.sources`，不解释供应商原始 JSON。
- `src/modules/query/legacy.ts` 是旧查询字段的 adapter；供应商直达 route 保留原始或历史 projection。主查询、GET query、POST query 共用查询 implementation。
- `src/modules/database` 从 `config/databases.json` 读取数据库身份和格式。每次请求固定一个真实目录；reader 按文件身份缓存，切换版本或子集缺件时退休旧 reader，在途请求结束后释放。
- `src/modules/observation` 解析可信入口提供的访问者地址（`request-ip.ts`）并保留归一化 source 的读取工具。服务器出口探测已移除；`/myip` 只报告请求地址。
- `scripts/ipdb_snapshot.py` 拥有 manifest、校验和、版本及附件集合契约；update/install/publish 使用同一契约。格式校验与远端访问仍由现有 Python adapter 执行。

## 对外行为

`GET /api/ip/:ip` 返回 `ip/sources/errors/status/generation/timestamp`。`status` 为 `ok`、`partial` 或 `unavailable`。至少一个 source 有数据时返回 200；全部不可用返回 503；非法 IP 返回 400。错误字段只包含稳定说明，不暴露文件绝对路径或网络异常。

公开 IP 保留原有外部多源查询，设置 `?external=false` 可只查本地。私网、回环、链路本地及保留地址不发送给外部 source。POST query 保持本地查询；GET query 支持同一 external 开关。

`GET /api/query?ip=...` 与 `POST /api/query` 同时提供归一化结果及旧字段 projection。旧字段只在上游确实提供信息时出现，不把缺失风险字段伪造成 false。POST 未指定 IP 时使用反向代理传来的地址，不再把本地地址替换成 Google DNS。

`GET /api/myip` 的每项 observation 都标明 `request-ip`。没有请求地址时返回 400，所有 source 都失败时返回 503，部分成功时仍展示已有结果。反向代理必须覆盖可信 IP headers，不能把客户端自带的转发 header 当成可信身份。

IPv4 专用 MMDB 拒绝 IPv6 查询；BIN 错误哨兵、空 MMDB/IPDB 结果不算有效数据。不同 source 可能给出不同地理位置或 ASN，结果保持来源独立，不宣称其中某个必然正确。

## 验证

```bash
npm test
npx --no-install tsc --noEmit --incremental false
npm run build
uv run --with-requirements scripts/requirements-ipdb.txt python -m unittest discover -s tests -p 'test_*ipdb*.py'
```

Node 测试使用已安装 TypeScript compiler 的 test-only require hook，不新增运行时依赖。测试覆盖 reader 固定版本、并发释放、失败重试、地址族、IPv6、空数据、旧 projection、超时及 provenance。

数据库更新不再需要重启应用；应用代码或环境变量变更仍需要按部署流程重启。正式 Release 和目标主机部署需要单独执行验收。
