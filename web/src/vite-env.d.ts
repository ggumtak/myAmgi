/// <reference types="vite/client" />

declare module 'sql.js' {
  export interface SqlQueryResult {
    columns: string[];
    values: unknown[][];
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    exec(sql: string): SqlQueryResult[];
    close(): void;
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | null) => Database;
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string, prefix?: string) => string;
  }): Promise<SqlJsStatic>;
}
