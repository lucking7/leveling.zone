import path from 'path';
import fs from 'fs';

export interface DbSnapshot {
  /** Canonical directory. A `current` symlink is resolved before any file is opened. */
  directory: string;
  /** Human-readable release identity returned with query results. */
  generation: string;
}

function databaseDirectories(): string[] {
  return [
    process.env.MMDB_PATH,
    path.join(process.cwd(), 'data', 'db', 'current'),
    path.join(process.cwd(), 'data', 'db'),
    path.join(process.cwd(), 'public', 'db'),
  ].filter((directory): directory is string => Boolean(directory));
}

function existingDirectory(directory: string): string | undefined {
  try {
    const realDirectory = fs.realpathSync(path.resolve(directory));
    return fs.statSync(realDirectory).isDirectory() ? realDirectory : undefined;
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code || '')) {
      return undefined;
    }
    throw error;
  }
}

function readGeneration(directory: string): string {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
    if (typeof manifest.version === 'string' && manifest.version.trim()) {
      return manifest.version;
    }
  } catch (error) {
    if (!['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code || '')) {
      // An invalid manifest must not make otherwise readable legacy databases unavailable.
    }
  }

  return path.basename(directory) || directory;
}

/**
 * Pin one database directory for a complete request.
 *
 * A directory becomes eligible when it contains at least one configured database. Missing
 * files then fail independently within that same snapshot rather than falling through into
 * a different release.
 */
export function resolveDbSnapshot(filenames: readonly string[]): DbSnapshot {
  for (const candidate of databaseDirectories()) {
    const directory = existingDirectory(candidate);
    if (!directory) continue;

    if (
      filenames.length === 0 ||
      filenames.some(filename => {
        try {
          return fs.statSync(path.join(directory, filename)).isFile();
        } catch (error) {
          if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code || '')) {
            return false;
          }
          throw error;
        }
      })
    ) {
      return { directory, generation: readGeneration(directory) };
    }
  }

  const directory = path.resolve(databaseDirectories()[0]);
  return { directory, generation: path.basename(directory) || directory };
}
