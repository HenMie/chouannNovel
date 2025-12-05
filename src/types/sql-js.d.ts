// sql.js 类型声明
declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: typeof Database
  }

  export interface QueryExecResult {
    columns: string[]
    values: unknown[][]
  }

  export interface ParamsObject {
    [key: string]: unknown
  }

  export type BindParams = ParamsObject | unknown[] | null

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null)
    run(sql: string, params?: BindParams): Database
    exec(sql: string, params?: BindParams): QueryExecResult[]
    prepare(sql: string): Statement
    export(): Uint8Array
    close(): void
    getRowsModified(): number
  }

  export class Statement {
    bind(params?: BindParams): boolean
    step(): boolean
    get(params?: BindParams): unknown[]
    getAsObject(params?: BindParams): Record<string, unknown>
    run(params?: BindParams): void
    reset(): void
    free(): boolean
  }

  export interface SqlJsConfig {
    locateFile?: (file: string) => string
    wasmBinary?: ArrayLike<number>
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>
}

