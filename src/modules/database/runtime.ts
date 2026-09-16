import fs from 'fs';
import path from 'path';
import catalogConfig from '../../../config/databases.json';
import { resolveDbSnapshot, type DbSnapshot } from '../../utils/dbPath';
import { defaultDatabaseAdapters } from './adapters';
import type {
  DatabaseAdapter,
  DatabaseAdapters,
  DatabaseDefinition,
  DatabaseQueryResult,
  DatabaseReader,
} from './types';

interface ResolvedDatabase {
  definition: DatabaseDefinition;
  filePath: string;
  cacheKey: string;
}

interface ReaderCell {
  id: string;
  cacheKey: string;
  reader: Promise<DatabaseReader>;
  references: number;
  stale: boolean;
  closePromise?: Promise<void>;
  unused?: {
    promise: Promise<void>;
    resolve(): void;
  };
}

interface ReaderLease {
  reader: DatabaseReader;
  release(): Promise<void>;
}

export interface RuntimeDatabaseOptions {
  catalog?: readonly DatabaseDefinition[];
  adapters?: Partial<DatabaseAdapters>;
  resolveSnapshot?: (filenames: readonly string[]) => DbSnapshot;
}

function resolveFile(snapshot: DbSnapshot, definition: DatabaseDefinition): ResolvedDatabase {
  const candidate = path.resolve(snapshot.directory, definition.filename);
  const relative = path.relative(snapshot.directory, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Invalid database filename for ${definition.id}`);
  }

  const filePath = fs.realpathSync(candidate);
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error(`Database is not a file: ${definition.id}`);

  return {
    definition,
    filePath,
    cacheKey: `${definition.id}:${filePath}:${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}`,
  };
}

export class RuntimeDatabase {
  private readonly catalog: readonly DatabaseDefinition[];
  private readonly adapters: DatabaseAdapters;
  private readonly snapshotResolver: (filenames: readonly string[]) => DbSnapshot;
  private readonly readers = new Map<string, ReaderCell>();

  constructor(options: RuntimeDatabaseOptions = {}) {
    this.catalog = options.catalog || (catalogConfig.databases as DatabaseDefinition[]);
    this.adapters = { ...defaultDatabaseAdapters, ...options.adapters };
    this.snapshotResolver = options.resolveSnapshot || resolveDbSnapshot;
  }

  async queryDatabases(ip: string): Promise<DatabaseQueryResult> {
    const snapshot = this.snapshotResolver(this.catalog.map(database => database.filename));
    const records: Record<string, any> = {};
    const errors: Record<string, string> = {};

    // Resolve every file from the already-canonical directory before opening a reader. If
    // `current` changes now, every item below still belongs to the pinned generation.
    const resolved = this.catalog.map(definition => {
      try {
        return { definition, database: resolveFile(snapshot, definition) };
      } catch (error) {
        errors[definition.id] = (error as NodeJS.ErrnoException)?.code === 'ENOENT' ? 'Database not installed' : 'Database unavailable';
        return { definition };
      }
    });

    // A partial snapshot still supersedes the previous generation. Retire readers for files
    // missing from the new snapshot so a stale BIN handle cannot survive indefinitely.
    await Promise.allSettled(
      resolved.map(item => this.retire(item.definition.id, item.database?.cacheKey))
    );

    await Promise.all(
      resolved.map(async item => {
        if (!item.database) return;

        let lease: ReaderLease | undefined;
        try {
          lease = await this.acquire(item.database);
        } catch {
          errors[item.definition.id] = 'Database unavailable';
          return;
        }

        try {
          records[item.definition.id] = await lease.reader.query(ip);
        } catch {
          errors[item.definition.id] = 'Database query failed';
        } finally {
          try {
            await lease.release();
          } catch {
            errors[item.definition.id] ||= 'Database release failed';
          }
        }
      })
    );

    return { records, errors, generation: snapshot.generation };
  }

  async dispose(): Promise<void> {
    const pending: Promise<void>[] = [];
    for (const cell of this.readers.values()) {
      cell.stale = true;
      if (cell.references === 0) {
        pending.push(this.close(cell));
      } else {
        if (!cell.unused) {
          let resolve!: () => void;
          const promise = new Promise<void>(done => {
            resolve = done;
          });
          cell.unused = { promise, resolve };
        }
        pending.push(cell.unused.promise.then(() => this.close(cell)));
      }
    }
    await Promise.all(pending);
  }

  private async acquire(database: ResolvedDatabase): Promise<ReaderLease> {
    let cell = this.readers.get(database.cacheKey);
    if (cell?.stale) cell = undefined;
    if (!cell) {
      const adapter: DatabaseAdapter = this.adapters[database.definition.format];
      cell = {
        id: database.definition.id,
        cacheKey: database.cacheKey,
        reader: adapter.open(database.filePath, database.definition),
        references: 0,
        stale: false,
      };
      this.readers.set(database.cacheKey, cell);
    }

    const staleClosures: Promise<void>[] = [];
    for (const candidate of this.readers.values()) {
      if (candidate.id === cell.id && candidate.cacheKey !== cell.cacheKey) {
        candidate.stale = true;
        if (candidate.references === 0) staleClosures.push(this.close(candidate));
      }
    }

    cell.references += 1;
    try {
      // A failed close of a retired reader must not abandon the newly opened reader.
      await Promise.allSettled(staleClosures);
      const reader = await cell.reader;
      let released = false;
      return {
        reader,
        release: async () => {
          if (released) return;
          released = true;
          cell!.references -= 1;
          if (cell!.references === 0) cell!.unused?.resolve();
          if (cell!.stale && cell!.references === 0) await this.close(cell!);
        },
      };
    } catch (error) {
      cell.references -= 1;
      if (cell.references === 0) cell.unused?.resolve();
      cell.stale = true;
      // Adapters close partial resources before rejecting. This resolved marker also lets a
      // concurrent dispose finish instead of awaiting the rejected loader a second time.
      cell.closePromise = Promise.resolve();
      if (this.readers.get(cell.cacheKey) === cell) this.readers.delete(cell.cacheKey);
      throw error;
    }
  }

  private async retire(id: string, keepCacheKey?: string): Promise<void> {
    const pending: Promise<void>[] = [];
    for (const cell of this.readers.values()) {
      if (cell.id === id && cell.cacheKey !== keepCacheKey) {
        cell.stale = true;
        if (cell.references === 0) pending.push(this.close(cell));
      }
    }
    await Promise.all(pending);
  }

  private async close(cell: ReaderCell): Promise<void> {
    if (cell.closePromise) return cell.closePromise;
    cell.closePromise = (async () => {
      const reader = await cell.reader;
      await reader.close?.();
    })();
    try {
      await cell.closePromise;
      if (this.readers.get(cell.cacheKey) === cell) this.readers.delete(cell.cacheKey);
    } catch (error) {
      cell.closePromise = undefined;
      throw error;
    }
  }
}

const runtimeDatabase = new RuntimeDatabase();

export function queryDatabases(ip: string): Promise<DatabaseQueryResult> {
  return runtimeDatabase.queryDatabases(ip);
}

export function disposeRuntimeDatabases(): Promise<void> {
  return runtimeDatabase.dispose();
}

export function createRuntimeDatabase(options: RuntimeDatabaseOptions = {}): RuntimeDatabase {
  return new RuntimeDatabase(options);
}
