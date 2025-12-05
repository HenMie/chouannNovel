import initSqlJs from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import type { Database as SqlJsDatabase } from 'sql.js'

import type { SqlClient, SqlExecuteResult } from './types'

let webClientPromise: Promise<SqlClient> | null = null

export async function createWebSqlClient(): Promise<SqlClient> {
  if (!isBrowserEnvironment()) {
    throw new Error('Web SQL client is only available in browser environments')
  }

  if (!webClientPromise) {
    webClientPromise = initWebSqlClient()
  }

  return webClientPromise
}

function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined'
}

async function initWebSqlClient(): Promise<SqlClient> {
  // 允许通过全局变量覆盖 wasm 路径，便于测试环境找到本地文件
  const wasmLocation =
    (globalThis as any).__SQLJS_WASM_PATH__ && typeof (globalThis as any).__SQLJS_WASM_PATH__ === "string"
      ? (globalThis as any).__SQLJS_WASM_PATH__
      : sqlWasmUrl

  const SQL = await initSqlJs({
    locateFile: () => wasmLocation,
  })

  const database = new SQL.Database()

  configurePragmas(database)
  applyMigrations(database)

  return {
    async select<T>(query: string, params?: unknown[]): Promise<T> {
      return runSelect<T>(database, query, params)
    },
    async execute(query: string, params?: unknown[]): Promise<SqlExecuteResult> {
      return runExecute(database, query, params)
    },
  }
}

function configurePragmas(database: SqlJsDatabase): void {
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA synchronous = NORMAL;
  `)
}

function applyMigrations(database: SqlJsDatabase): void {
  database.exec(MIGRATION_SQL)
}

async function runSelect<T>(
  database: SqlJsDatabase,
  query: string,
  params?: unknown[]
): Promise<T> {
  const statement = database.prepare(query)

  try {
    bindStatement(statement, params)
    const rows: Record<string, unknown>[] = []

    while (statement.step()) {
      rows.push(statement.getAsObject())
    }

    return rows as T
  } finally {
    statement.free()
  }
}

async function runExecute(
  database: SqlJsDatabase,
  query: string,
  params?: unknown[]
): Promise<SqlExecuteResult> {
  const statement = database.prepare(query)

  try {
    bindStatement(statement, params)

    // 步进执行，非查询语句在第一次 step 时就会完成
    while (statement.step()) {
      // no-op
    }
  } finally {
    statement.free()
  }

  return {
    rowsAffected: database.getRowsModified(),
    lastInsertId: getLastInsertId(database),
  }
}

function bindStatement(statement: ReturnType<SqlJsDatabase['prepare']>, params?: unknown[]): void {
  if (!params || params.length === 0) return

  const normalized = params.map((value) => {
    if (value === undefined) return null
    if (typeof value === 'boolean') return value ? 1 : 0
    return value
  })

  statement.bind(normalized)
}

function getLastInsertId(database: SqlJsDatabase): number | null {
  const result = database.exec('SELECT last_insert_rowid() as id')
  const firstRow = result?.[0]?.values?.[0]
  if (firstRow && firstRow.length > 0) {
    return typeof firstRow[0] === 'number' ? firstRow[0] : Number(firstRow[0])
  }
  return null
}

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    loop_max_count INTEGER DEFAULT 10,
    timeout_seconds INTEGER DEFAULT 300,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',
    order_index INTEGER NOT NULL,
    block_id TEXT,
    parent_block_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS setting_prompts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    category TEXT NOT NULL,
    prompt_template TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS global_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    ai_providers TEXT NOT NULL DEFAULT '{}',
    theme TEXT DEFAULT 'system',
    default_loop_max INTEGER DEFAULT 10,
    default_timeout INTEGER DEFAULT 300
  );

  INSERT OR IGNORE INTO global_config (id, ai_providers, theme)
  VALUES (1, '{}', 'system');

  CREATE TABLE IF NOT EXISTS executions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    status TEXT NOT NULL,
    input TEXT,
    final_output TEXT,
    variables_snapshot TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS node_results (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    iteration INTEGER DEFAULT 1,
    input TEXT,
    output TEXT,
    resolved_config TEXT,
    status TEXT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME,
    FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS workflow_versions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    snapshot TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_workflows_project_id ON workflows(project_id);
  CREATE INDEX IF NOT EXISTS idx_workflows_updated_at ON workflows(updated_at DESC);

  CREATE INDEX IF NOT EXISTS idx_nodes_workflow_id ON nodes(workflow_id);
  CREATE INDEX IF NOT EXISTS idx_nodes_order_index ON nodes(workflow_id, order_index);

  CREATE INDEX IF NOT EXISTS idx_settings_project_id ON settings(project_id);
  CREATE INDEX IF NOT EXISTS idx_settings_project_category ON settings(project_id, category);
  CREATE INDEX IF NOT EXISTS idx_settings_name ON settings(name);

  CREATE INDEX IF NOT EXISTS idx_setting_prompts_project_id ON setting_prompts(project_id);
  CREATE INDEX IF NOT EXISTS idx_setting_prompts_project_category ON setting_prompts(project_id, category);

  CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON executions(workflow_id);
  CREATE INDEX IF NOT EXISTS idx_executions_started_at ON executions(started_at DESC);
  CREATE INDEX IF NOT EXISTS idx_executions_workflow_started ON executions(workflow_id, started_at DESC);

  CREATE INDEX IF NOT EXISTS idx_node_results_execution_id ON node_results(execution_id);
  CREATE INDEX IF NOT EXISTS idx_node_results_node_id ON node_results(node_id);
  CREATE INDEX IF NOT EXISTS idx_node_results_started_at ON node_results(started_at);

  CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow_id ON workflow_versions(workflow_id);
  CREATE INDEX IF NOT EXISTS idx_workflow_versions_number ON workflow_versions(workflow_id, version_number DESC);
`


