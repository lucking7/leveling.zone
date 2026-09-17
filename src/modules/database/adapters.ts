import fs from 'fs/promises';
import maxmind from 'maxmind';
import { parse } from 'csv-parse/sync';
import { IP2Location } from 'ip2location-nodejs';
import { IP2Proxy } from 'ip2proxy-nodejs';
import type { DatabaseAdapter, DatabaseAdapters, DatabaseReader } from './types';

const IPDB = require('ipdb');

interface BinReader {
  open(filePath: string): void;
  getAll(ip: string): unknown;
  getPackageVersion(): number;
  close(): 0 | -1;
}

const unusableBinValues = new Set([
  'INVALID_IP_ADDRESS',
  'MISSING_FILE',
  'IPV6_NOT_SUPPORTED',
  'INVALID IP ADDRESS',
  'MISSING FILE',
  'IPV6 ADDRESS MISSING IN IPV4 BIN',
]);

export function checkedBinResult(value: unknown, label: string): unknown {
  if (
    value &&
    typeof value === 'object' &&
    Object.values(value).some(field => typeof field === 'string' && unusableBinValues.has(field))
  ) {
    throw new Error(`${label} returned no usable record`);
  }
  return value;
}

interface MmdbReader {
  metadata: { ipVersion: number };
  get(ip: string): unknown;
}

type OpenMmdb = (filePath: string) => Promise<MmdbReader>;

export function createMmdbAdapter(
  openReader: OpenMmdb = filePath => maxmind.open<any>(filePath)
): DatabaseAdapter {
  return {
    async open(filePath) {
      const reader = await openReader(filePath);
      return {
        query: ip => {
          if (reader.metadata.ipVersion === 4 && ip.includes(':')) {
            throw new Error('IPv6 is not supported by this database');
          }
          // An address outside this database's coverage is a gap in that source, not a failed
          // query: report an empty record so the caller neither publishes data it does not have
          // nor reports an error it did not hit.
          return reader.get(ip) ?? null;
        },
      };
    },
  };
}

function checkedCloser(reader: { close(): 0 | -1 }, label: string): () => void {
  return () => {
    if (reader.close() !== 0) {
      throw new Error(`Failed to close ${label} reader`);
    }
  };
}

function ip2LocationReader(filePath: string): DatabaseReader {
  const reader = new IP2Location() as unknown as BinReader;
  reader.open(filePath);

  // IP2Location.open() deliberately swallows file and format errors. dbType is zero until a
  // BIN header has loaded, so this is the package's only reliable synchronous success check.
  if (reader.getPackageVersion() === 0) {
    reader.close();
    throw new Error('IP2Location could not open the database');
  }

  return {
    query: ip => checkedBinResult(reader.getAll(ip), 'IP2Location'),
    close: checkedCloser(reader, 'IP2Location'),
  };
}

function ip2ProxyReader(filePath: string): DatabaseReader {
  const reader = new IP2Proxy();
  if (reader.open(filePath) !== 0) {
    reader.close();
    throw new Error('IP2Proxy could not open the database');
  }

  return {
    query: ip => checkedBinResult(reader.getAll(ip), 'IP2Proxy'),
    close: checkedCloser(reader, 'IP2Proxy'),
  };
}

export const defaultDatabaseAdapters: DatabaseAdapters = {
  mmdb: createMmdbAdapter(),
  ipdb: {
    async open(filePath) {
      const reader = new IPDB(await fs.readFile(filePath));
      return {
        query: ip => {
          const result = reader.find(ip);
          if (!result || result.code !== 0) throw new Error('IPDB returned no record');
          return result;
        },
      };
    },
  },
  csv: {
    async open(filePath, definition) {
      const contents = await fs.readFile(filePath, 'utf8');
      const records: Record<string, string>[] = parse(contents, {
        columns: definition.header === false ? definition.columns : true,
        delimiter: definition.delimiter || ',',
        skip_empty_lines: true,
        trim: true,
      });
      return { query: () => records };
    },
  },
  ip2location: {
    async open(filePath) {
      return ip2LocationReader(filePath);
    },
  },
  ip2proxy: {
    async open(filePath) {
      return ip2ProxyReader(filePath);
    },
  },
};
