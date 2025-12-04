export interface SqlExecuteResult {
  rowsAffected?: number
  lastInsertId?: number | null
}

export interface SqlClient {
  select<T>(query: string, params?: unknown[]): Promise<T>
  execute(query: string, params?: unknown[]): Promise<SqlExecuteResult>
}


