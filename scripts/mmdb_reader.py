#!/usr/bin/env python3
"""List metadata and a sample result for every available MMDB database."""

import argparse
import os
from pathlib import Path

import maxminddb


def default_directory() -> Path:
    candidates = [
        os.environ.get("MMDB_PATH"),
        "data/db/current",
        "data/db",
        "public/db",
    ]
    for candidate in candidates:
        if not candidate:
            continue
        directory = Path(candidate)
        if any(directory.glob("*.mmdb")):
            return directory
    raise FileNotFoundError("No MMDB database found in configured database paths")


def read_mmdb_metadata(file_path: Path, ip: str) -> None:
    print(f"\n=== 读取文件: {file_path.name} ===")
    with maxminddb.open_database(file_path) as reader:
        metadata = reader.metadata()
        print(f"数据库类型: {metadata.database_type}")
        print(f"IP版本: {metadata.ip_version}")
        print(f"节点数量: {metadata.node_count}")
        print(f"记录大小: {metadata.record_size}")
        print(f"构建时间: {metadata.build_epoch}")
        print(f"描述: {metadata.description}")
        print(f"\n示例 IP ({ip}) 查询结果:")
        print(reader.get(ip))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", type=Path)
    parser.add_argument("--ip", default="8.8.8.8")
    args = parser.parse_args()
    try:
        directory = args.directory or default_directory()
        files = sorted(directory.glob("*.mmdb"))
        if not files:
            raise FileNotFoundError(f"No MMDB database found in {directory}")
        for file_path in files:
            read_mmdb_metadata(file_path, args.ip)
    except (OSError, ValueError, maxminddb.errors.InvalidDatabaseError) as exc:
        print(f"读取文件时出错: {exc}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
