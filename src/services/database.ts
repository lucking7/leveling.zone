import { queryIP } from '../modules/query';
import { legacy } from '../modules/query/legacy';

/** Compatibility adapter. All readers and query policy belong to the query module. */
export class DatabaseService {
  private static readonly instance = new DatabaseService();
  static async getInstance(): Promise<DatabaseService> { return this.instance; }
  async queryIP(ip: string) { return legacy(await queryIP(ip, { external: false })); }
}
