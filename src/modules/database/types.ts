export type DatabaseFormat = 'mmdb' | 'ip2location' | 'ip2proxy' | 'ipdb' | 'csv';

export interface DatabaseDefinition {
  id: string;
  filename: string;
  format: DatabaseFormat;
  columns?: string[];
  header?: boolean;
  delimiter?: string;
}

export interface DatabaseReader {
  query(ip: string): unknown | Promise<unknown>;
  close?(): void | Promise<void>;
}

export interface DatabaseAdapter {
  open(filePath: string, definition: DatabaseDefinition): Promise<DatabaseReader>;
}

export type DatabaseAdapters = Record<DatabaseFormat, DatabaseAdapter>;

export interface DatabaseQueryResult {
  records: Record<string, any>;
  errors: Record<string, string>;
  generation: string;
}
