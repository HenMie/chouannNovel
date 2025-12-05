// lib/db 数据库模块测试
// 使用 sql.js 内存数据库进行真实的数据库操作测试

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"
import initSqlJs from "sql.js"
import type { Database as SqlJsDatabase } from "sql.js"
import type { SqlClient } from "../types"

// ========== 测试用内存数据库 ==========

let testDb: SqlJsDatabase
let testClient: SqlClient

// 数据库迁移 SQL（从 web-sqlite.ts 复制）
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

  PRAGMA foreign_keys = ON;
`

// 创建测试用 SqlClient
function createTestClient(database: SqlJsDatabase): SqlClient {
  return {
    async select<T>(query: string, params?: unknown[]): Promise<T> {
      const statement = database.prepare(query)
      try {
        if (params && params.length > 0) {
          const normalized = params.map((value) => {
            if (value === undefined) return null
            if (typeof value === "boolean") return value ? 1 : 0
            return value
          })
          statement.bind(normalized)
        }
        const rows: Record<string, unknown>[] = []
        while (statement.step()) {
          rows.push(statement.getAsObject())
        }
        return rows as T
      } finally {
        statement.free()
      }
    },
    async execute(query: string, params?: unknown[]): Promise<{ rowsAffected: number; lastInsertId: number | null }> {
      const statement = database.prepare(query)
      try {
        if (params && params.length > 0) {
          const normalized = params.map((value) => {
            if (value === undefined) return null
            if (typeof value === "boolean") return value ? 1 : 0
            return value
          })
          statement.bind(normalized)
        }
        while (statement.step()) {
          // no-op
        }
      } finally {
        statement.free()
      }
      const result = database.exec("SELECT last_insert_rowid() as id")
      const lastInsertId = result?.[0]?.values?.[0]?.[0]
      return {
        rowsAffected: database.getRowsModified(),
        lastInsertId: typeof lastInsertId === "number" ? lastInsertId : null,
      }
    },
  }
}

// ========== Mock getDatabase ==========

// 由于 db/index.ts 依赖 getDatabase，我们需要 mock 它返回测试客户端
vi.mock("@tauri-apps/plugin-sql", () => ({
  default: {
    load: vi.fn(),
  },
}))

// Mock window.__TAURI_INTERNALS__ 让环境检测返回 false（使用 Web 模式）
beforeAll(() => {
  // 确保不是 Tauri 环境
  if (typeof window !== "undefined") {
    delete (window as any).__TAURI_INTERNALS__
  }
})

// ========== 数据库操作函数（直接使用测试客户端实现） ==========

// 生成 UUID
function generateId(): string {
  return crypto.randomUUID()
}

// 项目操作
async function getProjects() {
  return testClient.select<any[]>("SELECT * FROM projects ORDER BY updated_at DESC")
}

async function getProject(id: string) {
  const results = await testClient.select<any[]>("SELECT * FROM projects WHERE id = ?", [id])
  return results[0] || null
}

async function createProject(name: string, description?: string) {
  const id = generateId()
  const now = new Date().toISOString()
  await testClient.execute(
    "INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    [id, name, description || null, now, now]
  )
  return { id, name, description, created_at: now, updated_at: now }
}

async function updateProject(id: string, data: { name?: string; description?: string }) {
  const updates: string[] = []
  const values: (string | null)[] = []

  if (data.name !== undefined) {
    updates.push("name = ?")
    values.push(data.name)
  }
  if (data.description !== undefined) {
    updates.push("description = ?")
    values.push(data.description || null)
  }

  updates.push("updated_at = ?")
  values.push(new Date().toISOString())
  values.push(id)

  await testClient.execute(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`, values)
}

async function deleteProject(id: string) {
  await testClient.execute("DELETE FROM projects WHERE id = ?", [id])
}

// 工作流操作
async function getWorkflows(projectId: string) {
  return testClient.select<any[]>(
    "SELECT * FROM workflows WHERE project_id = ? ORDER BY updated_at DESC",
    [projectId]
  )
}

async function getWorkflow(id: string) {
  const results = await testClient.select<any[]>("SELECT * FROM workflows WHERE id = ?", [id])
  return results[0] || null
}

async function createWorkflow(projectId: string, name: string, description?: string) {
  const workflowId = generateId()
  const now = new Date().toISOString()

  await testClient.execute(
    `INSERT INTO workflows (id, project_id, name, description, loop_max_count, timeout_seconds, created_at, updated_at)
     VALUES (?, ?, ?, ?, 10, 300, ?, ?)`,
    [workflowId, projectId, name, description || null, now, now]
  )

  // 自动创建开始流程节点
  const startNodeId = generateId()
  await testClient.execute(
    `INSERT INTO nodes (id, workflow_id, type, name, config, order_index, created_at, updated_at)
     VALUES (?, ?, 'start', '开始流程', ?, 0, ?, ?)`,
    [startNodeId, workflowId, JSON.stringify({}), now, now]
  )

  return {
    id: workflowId,
    project_id: projectId,
    name,
    description,
    loop_max_count: 10,
    timeout_seconds: 300,
    created_at: now,
    updated_at: now,
  }
}

async function updateWorkflow(id: string, data: { name?: string; description?: string; loop_max_count?: number; timeout_seconds?: number }) {
  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (data.name !== undefined) {
    updates.push("name = ?")
    values.push(data.name)
  }
  if (data.description !== undefined) {
    updates.push("description = ?")
    values.push(data.description || null)
  }
  if (data.loop_max_count !== undefined) {
    updates.push("loop_max_count = ?")
    values.push(data.loop_max_count)
  }
  if (data.timeout_seconds !== undefined) {
    updates.push("timeout_seconds = ?")
    values.push(data.timeout_seconds)
  }

  updates.push("updated_at = ?")
  values.push(new Date().toISOString())
  values.push(id)

  await testClient.execute(`UPDATE workflows SET ${updates.join(", ")} WHERE id = ?`, values)
}

async function deleteWorkflow(id: string) {
  await testClient.execute("DELETE FROM workflows WHERE id = ?", [id])
}

// 节点操作
async function getNodes(workflowId: string) {
  const nodes = await testClient.select<any[]>(
    "SELECT * FROM nodes WHERE workflow_id = ? ORDER BY order_index ASC",
    [workflowId]
  )
  return nodes.map((node) => ({
    ...node,
    config: JSON.parse(node.config),
    block_id: node.block_id || undefined,
    parent_block_id: node.parent_block_id || undefined,
  }))
}

async function getNode(id: string) {
  const results = await testClient.select<any[]>("SELECT * FROM nodes WHERE id = ?", [id])
  if (!results[0]) return null
  return {
    ...results[0],
    config: JSON.parse(results[0].config),
    block_id: results[0].block_id || undefined,
    parent_block_id: results[0].parent_block_id || undefined,
  }
}

async function createNode(
  workflowId: string,
  type: string,
  name: string,
  config: any = {},
  options?: { block_id?: string; parent_block_id?: string; insert_after_index?: number; id?: string }
) {
  const id = options?.id ?? generateId()
  const now = new Date().toISOString()

  let orderIndex: number

  if (options?.insert_after_index !== undefined) {
    orderIndex = options.insert_after_index + 1
    await testClient.execute(
      `UPDATE nodes SET order_index = order_index + 1, updated_at = ? 
       WHERE workflow_id = ? AND order_index >= ?`,
      [now, workflowId, orderIndex]
    )
  } else {
    const maxResult = await testClient.select<[{ max_order: number | null }]>(
      "SELECT MAX(order_index) as max_order FROM nodes WHERE workflow_id = ?",
      [workflowId]
    )
    orderIndex = (maxResult[0]?.max_order ?? -1) + 1
  }

  await testClient.execute(
    `INSERT INTO nodes (id, workflow_id, type, name, config, order_index, block_id, parent_block_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, workflowId, type, name, JSON.stringify(config), orderIndex, options?.block_id || null, options?.parent_block_id || null, now, now]
  )

  return {
    id,
    workflow_id: workflowId,
    type,
    name,
    config,
    order_index: orderIndex,
    block_id: options?.block_id,
    parent_block_id: options?.parent_block_id,
    created_at: now,
    updated_at: now,
  }
}

async function updateNode(id: string, data: { name?: string; config?: any; block_id?: string; parent_block_id?: string }) {
  const updates: string[] = []
  const values: (string | null)[] = []

  if (data.name !== undefined) {
    updates.push("name = ?")
    values.push(data.name)
  }
  if (data.config !== undefined) {
    updates.push("config = ?")
    values.push(JSON.stringify(data.config))
  }
  if (data.block_id !== undefined) {
    updates.push("block_id = ?")
    values.push(data.block_id || null)
  }
  if (data.parent_block_id !== undefined) {
    updates.push("parent_block_id = ?")
    values.push(data.parent_block_id || null)
  }

  updates.push("updated_at = ?")
  values.push(new Date().toISOString())
  values.push(id)

  await testClient.execute(`UPDATE nodes SET ${updates.join(", ")} WHERE id = ?`, values)
}

async function deleteNode(id: string) {
  await testClient.execute("DELETE FROM nodes WHERE id = ?", [id])
}

async function reorderNodes(workflowId: string, nodeIds: string[]) {
  for (let i = 0; i < nodeIds.length; i++) {
    await testClient.execute(
      "UPDATE nodes SET order_index = ?, updated_at = ? WHERE id = ? AND workflow_id = ?",
      [i, new Date().toISOString(), nodeIds[i], workflowId]
    )
  }
}

// 设定库操作
async function getSettings(projectId: string, query?: string) {
  let sql = "SELECT * FROM settings WHERE project_id = ?"
  const params: any[] = [projectId]

  if (query) {
    sql += " AND (name LIKE ? OR content LIKE ?)"
    params.push(`%${query}%`, `%${query}%`)
  }

  sql += " ORDER BY category, name"

  const settings = await testClient.select<any[]>(sql, params)
  return settings.map((s) => ({ ...s, enabled: Boolean(s.enabled) }))
}

async function createSetting(projectId: string, category: string, name: string, content: string) {
  const id = generateId()
  const now = new Date().toISOString()

  await testClient.execute(
    `INSERT INTO settings (id, project_id, category, name, content, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, projectId, category, name, content, now, now]
  )

  return {
    id,
    project_id: projectId,
    category,
    name,
    content,
    enabled: true,
    created_at: now,
    updated_at: now,
  }
}

async function updateSetting(id: string, data: { name?: string; content?: string; enabled?: boolean }) {
  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (data.name !== undefined) {
    updates.push("name = ?")
    values.push(data.name)
  }
  if (data.content !== undefined) {
    updates.push("content = ?")
    values.push(data.content)
  }
  if (data.enabled !== undefined) {
    updates.push("enabled = ?")
    values.push(data.enabled ? 1 : 0)
  }

  updates.push("updated_at = ?")
  values.push(new Date().toISOString())
  values.push(id)

  await testClient.execute(`UPDATE settings SET ${updates.join(", ")} WHERE id = ?`, values)
}

async function deleteSetting(id: string) {
  await testClient.execute("DELETE FROM settings WHERE id = ?", [id])
}

// 设定提示词操作
async function getSettingPrompts(projectId: string) {
  const prompts = await testClient.select<any[]>(
    "SELECT * FROM setting_prompts WHERE project_id = ? ORDER BY category",
    [projectId]
  )
  return prompts.map((p) => ({ ...p, enabled: Boolean(p.enabled) }))
}

async function getSettingPrompt(projectId: string, category: string) {
  const results = await testClient.select<any[]>(
    "SELECT * FROM setting_prompts WHERE project_id = ? AND category = ?",
    [projectId, category]
  )
  if (!results[0]) return null
  return { ...results[0], enabled: Boolean(results[0].enabled) }
}

async function createSettingPrompt(projectId: string, category: string, promptTemplate: string) {
  const id = generateId()

  await testClient.execute(
    `INSERT INTO setting_prompts (id, project_id, category, prompt_template, enabled)
     VALUES (?, ?, ?, ?, 1)`,
    [id, projectId, category, promptTemplate]
  )

  return {
    id,
    project_id: projectId,
    category,
    prompt_template: promptTemplate,
    enabled: true,
  }
}

async function updateSettingPrompt(id: string, data: { prompt_template?: string; enabled?: boolean }) {
  const updates: string[] = []
  const values: (string | number)[] = []

  if (data.prompt_template !== undefined) {
    updates.push("prompt_template = ?")
    values.push(data.prompt_template)
  }
  if (data.enabled !== undefined) {
    updates.push("enabled = ?")
    values.push(data.enabled ? 1 : 0)
  }

  if (updates.length > 0) {
    values.push(id)
    await testClient.execute(`UPDATE setting_prompts SET ${updates.join(", ")} WHERE id = ?`, values)
  }
}

async function deleteSettingPrompt(id: string) {
  await testClient.execute("DELETE FROM setting_prompts WHERE id = ?", [id])
}

// 全局配置操作
async function getGlobalConfig() {
  const results = await testClient.select<any[]>("SELECT * FROM global_config WHERE id = 1")

  if (!results[0]) {
    return {
      id: 1,
      ai_providers: {
        openai: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        gemini: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      },
      theme: "system",
      default_loop_max: 10,
      default_timeout: 300,
    }
  }

  return {
    ...results[0],
    ai_providers: JSON.parse(results[0].ai_providers),
  }
}

async function updateGlobalConfig(data: { ai_providers?: any; theme?: string; default_loop_max?: number; default_timeout?: number }) {
  const updates: string[] = []
  const values: (string | number)[] = []

  if (data.ai_providers !== undefined) {
    updates.push("ai_providers = ?")
    values.push(JSON.stringify(data.ai_providers))
  }
  if (data.theme !== undefined) {
    updates.push("theme = ?")
    values.push(data.theme)
  }
  if (data.default_loop_max !== undefined) {
    updates.push("default_loop_max = ?")
    values.push(data.default_loop_max)
  }
  if (data.default_timeout !== undefined) {
    updates.push("default_timeout = ?")
    values.push(data.default_timeout)
  }

  if (updates.length > 0) {
    await testClient.execute(`UPDATE global_config SET ${updates.join(", ")} WHERE id = 1`, values)
  }
}

// 执行记录操作
async function getExecutions(workflowId: string) {
  const executions = await testClient.select<any[]>(
    "SELECT * FROM executions WHERE workflow_id = ? ORDER BY started_at DESC",
    [workflowId]
  )
  return executions.map((e) => ({
    ...e,
    variables_snapshot: e.variables_snapshot ? JSON.parse(e.variables_snapshot) : undefined,
  }))
}

async function createExecution(workflowId: string, input?: string) {
  const id = generateId()
  const now = new Date().toISOString()

  await testClient.execute(
    `INSERT INTO executions (id, workflow_id, status, input, started_at)
     VALUES (?, ?, 'running', ?, ?)`,
    [id, workflowId, input || null, now]
  )

  return {
    id,
    workflow_id: workflowId,
    status: "running",
    input,
    started_at: now,
  }
}

async function updateExecution(id: string, data: { status?: string; final_output?: string; variables_snapshot?: any; finished_at?: string }) {
  const updates: string[] = []
  const values: (string | null)[] = []

  if (data.status !== undefined) {
    updates.push("status = ?")
    values.push(data.status)
  }
  if (data.final_output !== undefined) {
    updates.push("final_output = ?")
    values.push(data.final_output || null)
  }
  if (data.variables_snapshot !== undefined) {
    updates.push("variables_snapshot = ?")
    values.push(data.variables_snapshot ? JSON.stringify(data.variables_snapshot) : null)
  }
  if (data.finished_at !== undefined) {
    updates.push("finished_at = ?")
    values.push(data.finished_at || null)
  }

  values.push(id)
  await testClient.execute(`UPDATE executions SET ${updates.join(", ")} WHERE id = ?`, values)
}

async function deleteExecution(id: string) {
  await testClient.execute("DELETE FROM node_results WHERE execution_id = ?", [id])
  await testClient.execute("DELETE FROM executions WHERE id = ?", [id])
}

// 节点结果操作
async function getNodeResults(executionId: string) {
  const results = await testClient.select<any[]>(
    "SELECT * FROM node_results WHERE execution_id = ? ORDER BY started_at ASC",
    [executionId]
  )
  return results.map((result) => ({
    ...result,
    resolved_config: result.resolved_config ? JSON.parse(result.resolved_config) : undefined,
  }))
}

async function createNodeResult(executionId: string, nodeId: string, iteration: number = 1) {
  const id = generateId()
  const now = new Date().toISOString()

  await testClient.execute(
    `INSERT INTO node_results (id, execution_id, node_id, iteration, status, started_at)
     VALUES (?, ?, ?, ?, 'running', ?)`,
    [id, executionId, nodeId, iteration, now]
  )

  return {
    id,
    execution_id: executionId,
    node_id: nodeId,
    iteration,
    status: "running",
    started_at: now,
  }
}

async function updateNodeResult(id: string, data: { input?: string; output?: string; status?: string; finished_at?: string; resolved_config?: any }) {
  const updates: string[] = []
  const values: (string | null)[] = []

  if (data.input !== undefined) {
    updates.push("input = ?")
    values.push(data.input || null)
  }
  if (data.output !== undefined) {
    updates.push("output = ?")
    values.push(data.output || null)
  }
  if (data.status !== undefined) {
    updates.push("status = ?")
    values.push(data.status)
  }
  if (data.finished_at !== undefined) {
    updates.push("finished_at = ?")
    values.push(data.finished_at || null)
  }
  if (data.resolved_config !== undefined) {
    updates.push("resolved_config = ?")
    values.push(data.resolved_config ? JSON.stringify(data.resolved_config) : null)
  }

  values.push(id)
  await testClient.execute(`UPDATE node_results SET ${updates.join(", ")} WHERE id = ?`, values)
}

// 工作流版本历史
async function getWorkflowVersions(workflowId: string) {
  return testClient.select<any[]>(
    "SELECT * FROM workflow_versions WHERE workflow_id = ? ORDER BY version_number DESC",
    [workflowId]
  )
}

async function createWorkflowVersion(workflowId: string, description?: string) {
  const workflow = await getWorkflow(workflowId)
  if (!workflow) {
    throw new Error("工作流不存在")
  }

  const nodes = await getNodes(workflowId)
  const snapshot = {
    workflow: {
      name: workflow.name,
      description: workflow.description,
      loop_max_count: workflow.loop_max_count,
      timeout_seconds: workflow.timeout_seconds,
    },
    nodes: nodes.map((node: any) => ({
      type: node.type,
      name: node.name,
      config: node.config,
      order_index: node.order_index,
      block_id: node.block_id,
      parent_block_id: node.parent_block_id,
    })),
  }

  const maxResult = await testClient.select<[{ max_version: number | null }]>(
    "SELECT MAX(version_number) as max_version FROM workflow_versions WHERE workflow_id = ?",
    [workflowId]
  )
  const versionNumber = (maxResult[0]?.max_version ?? 0) + 1

  const id = generateId()
  const now = new Date().toISOString()

  await testClient.execute(
    `INSERT INTO workflow_versions (id, workflow_id, version_number, snapshot, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, workflowId, versionNumber, JSON.stringify(snapshot), description || null, now]
  )

  return {
    id,
    workflow_id: workflowId,
    version_number: versionNumber,
    snapshot: JSON.stringify(snapshot),
    description,
    created_at: now,
  }
}

async function deleteWorkflowVersion(versionId: string) {
  await testClient.execute("DELETE FROM workflow_versions WHERE id = ?", [versionId])
}

// ========== 测试初始化 ==========

beforeAll(async () => {
  const SQL = await initSqlJs()
  testDb = new SQL.Database()
  testDb.exec(MIGRATION_SQL)
  testClient = createTestClient(testDb)
})

beforeEach(() => {
  // 清理所有表数据
  testDb.exec(`
    DELETE FROM node_results;
    DELETE FROM executions;
    DELETE FROM workflow_versions;
    DELETE FROM nodes;
    DELETE FROM workflows;
    DELETE FROM settings;
    DELETE FROM setting_prompts;
    DELETE FROM projects;
    UPDATE global_config SET ai_providers = '{}', theme = 'system', default_loop_max = 10, default_timeout = 300 WHERE id = 1;
  `)
})

// ========== 项目操作测试 ==========

describe("数据库模块 - 项目操作", () => {
  describe("getProjects", () => {
    it("应该返回空数组当没有项目时", async () => {
      const projects = await getProjects()
      expect(projects).toEqual([])
    })

    it("应该返回所有项目并按更新时间倒序", async () => {
      await createProject("项目1")
      await createProject("项目2")

      const projects = await getProjects()
      expect(projects).toHaveLength(2)
      expect(projects[0].name).toBe("项目2")
      expect(projects[1].name).toBe("项目1")
    })
  })

  describe("getProject", () => {
    it("应该返回 null 当项目不存在时", async () => {
      const project = await getProject("non-existent-id")
      expect(project).toBeNull()
    })

    it("应该返回指定项目", async () => {
      const created = await createProject("测试项目", "描述")
      const project = await getProject(created.id)

      expect(project).not.toBeNull()
      expect(project.name).toBe("测试项目")
      expect(project.description).toBe("描述")
    })
  })

  describe("createProject", () => {
    it("应该创建项目并返回完整对象", async () => {
      const project = await createProject("新项目", "项目描述")

      expect(project.id).toBeDefined()
      expect(project.name).toBe("新项目")
      expect(project.description).toBe("项目描述")
      expect(project.created_at).toBeDefined()
      expect(project.updated_at).toBeDefined()
    })

    it("应该在不提供描述时创建项目", async () => {
      const project = await createProject("无描述项目")

      expect(project.name).toBe("无描述项目")
      expect(project.description).toBeUndefined()
    })
  })

  describe("updateProject", () => {
    it("应该更新项目名称", async () => {
      const project = await createProject("原名称")
      await updateProject(project.id, { name: "新名称" })

      const updated = await getProject(project.id)
      expect(updated.name).toBe("新名称")
    })

    it("应该更新项目描述", async () => {
      const project = await createProject("项目", "原描述")
      await updateProject(project.id, { description: "新描述" })

      const updated = await getProject(project.id)
      expect(updated.description).toBe("新描述")
    })

    it("应该清空项目描述", async () => {
      const project = await createProject("项目", "描述")
      await updateProject(project.id, { description: "" })

      const updated = await getProject(project.id)
      expect(updated.description).toBeNull()
    })
  })

  describe("deleteProject", () => {
    it("应该删除项目", async () => {
      const project = await createProject("待删除项目")
      await deleteProject(project.id)

      const deleted = await getProject(project.id)
      expect(deleted).toBeNull()
    })

    it("应该级联删除关联的工作流", async () => {
      const project = await createProject("项目")
      const workflow = await createWorkflow(project.id, "工作流")

      await deleteProject(project.id)

      const deletedWorkflow = await getWorkflow(workflow.id)
      expect(deletedWorkflow).toBeNull()
    })
  })
})

// ========== 工作流操作测试 ==========

describe("数据库模块 - 工作流操作", () => {
  let testProject: any

  beforeEach(async () => {
    testProject = await createProject("测试项目")
  })

  describe("getWorkflows", () => {
    it("应该返回空数组当项目没有工作流时", async () => {
      const workflows = await getWorkflows(testProject.id)
      expect(workflows).toEqual([])
    })

    it("应该返回指定项目的所有工作流", async () => {
      await createWorkflow(testProject.id, "工作流1")
      await createWorkflow(testProject.id, "工作流2")

      const workflows = await getWorkflows(testProject.id)
      expect(workflows).toHaveLength(2)
    })

    it("不应该返回其他项目的工作流", async () => {
      const otherProject = await createProject("其他项目")
      await createWorkflow(testProject.id, "工作流1")
      await createWorkflow(otherProject.id, "工作流2")

      const workflows = await getWorkflows(testProject.id)
      expect(workflows).toHaveLength(1)
      expect(workflows[0].name).toBe("工作流1")
    })
  })

  describe("createWorkflow", () => {
    it("应该创建工作流并自动添加开始节点", async () => {
      const workflow = await createWorkflow(testProject.id, "新工作流", "描述")

      expect(workflow.id).toBeDefined()
      expect(workflow.name).toBe("新工作流")
      expect(workflow.description).toBe("描述")
      expect(workflow.loop_max_count).toBe(10)
      expect(workflow.timeout_seconds).toBe(300)

      // 检查是否自动创建了开始节点
      const nodes = await getNodes(workflow.id)
      expect(nodes).toHaveLength(1)
      expect(nodes[0].type).toBe("start")
      expect(nodes[0].name).toBe("开始流程")
    })
  })

  describe("updateWorkflow", () => {
    it("应该更新工作流属性", async () => {
      const workflow = await createWorkflow(testProject.id, "工作流")
      await updateWorkflow(workflow.id, {
        name: "新名称",
        loop_max_count: 20,
        timeout_seconds: 600,
      })

      const updated = await getWorkflow(workflow.id)
      expect(updated.name).toBe("新名称")
      expect(updated.loop_max_count).toBe(20)
      expect(updated.timeout_seconds).toBe(600)
    })
  })

  describe("deleteWorkflow", () => {
    it("应该删除工作流", async () => {
      const workflow = await createWorkflow(testProject.id, "工作流")
      await deleteWorkflow(workflow.id)

      const deleted = await getWorkflow(workflow.id)
      expect(deleted).toBeNull()
    })

    it("应该级联删除关联的节点", async () => {
      const workflow = await createWorkflow(testProject.id, "工作流")
      await createNode(workflow.id, "ai_chat", "AI 节点")

      await deleteWorkflow(workflow.id)

      const nodes = await getNodes(workflow.id)
      expect(nodes).toHaveLength(0)
    })
  })
})

// ========== 节点操作测试 ==========

describe("数据库模块 - 节点操作", () => {
  let testWorkflow: any

  beforeEach(async () => {
    const project = await createProject("测试项目")
    testWorkflow = await createWorkflow(project.id, "测试工作流")
  })

  describe("getNodes", () => {
    it("应该返回工作流的所有节点并按顺序排序", async () => {
      const nodes = await getNodes(testWorkflow.id)

      // 创建工作流时已自动添加开始节点
      expect(nodes).toHaveLength(1)
      expect(nodes[0].type).toBe("start")
    })

    it("应该正确解析节点配置", async () => {
      await createNode(testWorkflow.id, "ai_chat", "AI 节点", { provider: "openai", model: "gpt-4" })

      const nodes = await getNodes(testWorkflow.id)
      const aiNode = nodes.find((n: any) => n.type === "ai_chat")

      expect(aiNode.config).toEqual({ provider: "openai", model: "gpt-4" })
    })
  })

  describe("createNode", () => {
    it("应该创建节点并分配正确的顺序", async () => {
      const node1 = await createNode(testWorkflow.id, "ai_chat", "节点1")
      const node2 = await createNode(testWorkflow.id, "output", "节点2")

      // 开始节点是 0，新节点是 1 和 2
      expect(node1.order_index).toBe(1)
      expect(node2.order_index).toBe(2)
    })

    it("应该支持在指定位置后插入节点", async () => {
      await createNode(testWorkflow.id, "ai_chat", "节点1")
      await createNode(testWorkflow.id, "output", "节点2")

      // 在开始节点后插入
      await createNode(testWorkflow.id, "variable", "插入节点", {}, { insert_after_index: 0 })

      const nodes = await getNodes(testWorkflow.id)
      expect(nodes[0].type).toBe("start")
      expect(nodes[1].type).toBe("variable")
      expect(nodes[2].type).toBe("ai_chat")
      expect(nodes[3].type).toBe("output")
    })

    it("应该支持 block_id 和 parent_block_id", async () => {
      const node = await createNode(testWorkflow.id, "loop_start", "循环开始", {}, {
        block_id: "block-1",
        parent_block_id: "parent-block",
      })

      expect(node.block_id).toBe("block-1")
      expect(node.parent_block_id).toBe("parent-block")
    })
  })

  describe("updateNode", () => {
    it("应该更新节点名称", async () => {
      const node = await createNode(testWorkflow.id, "ai_chat", "原名称")
      await updateNode(node.id, { name: "新名称" })

      const updated = await getNode(node.id)
      expect(updated.name).toBe("新名称")
    })

    it("应该更新节点配置", async () => {
      const node = await createNode(testWorkflow.id, "ai_chat", "AI 节点", { provider: "openai" })
      await updateNode(node.id, { config: { provider: "gemini", model: "gemini-pro" } })

      const updated = await getNode(node.id)
      expect(updated.config).toEqual({ provider: "gemini", model: "gemini-pro" })
    })
  })

  describe("deleteNode", () => {
    it("应该删除节点", async () => {
      const node = await createNode(testWorkflow.id, "ai_chat", "节点")
      await deleteNode(node.id)

      const deleted = await getNode(node.id)
      expect(deleted).toBeNull()
    })
  })

  describe("reorderNodes", () => {
    it("应该重新排序节点", async () => {
      const node1 = await createNode(testWorkflow.id, "ai_chat", "节点1")
      const node2 = await createNode(testWorkflow.id, "output", "节点2")

      // 获取开始节点
      const nodes = await getNodes(testWorkflow.id)
      const startNode = nodes.find((n: any) => n.type === "start")

      // 重新排序：开始 -> 节点2 -> 节点1
      await reorderNodes(testWorkflow.id, [startNode.id, node2.id, node1.id])

      const reordered = await getNodes(testWorkflow.id)
      expect(reordered[0].type).toBe("start")
      expect(reordered[1].name).toBe("节点2")
      expect(reordered[2].name).toBe("节点1")
    })
  })
})

// ========== 设定库操作测试 ==========

describe("数据库模块 - 设定库操作", () => {
  let testProject: any

  beforeEach(async () => {
    testProject = await createProject("测试项目")
  })

  describe("getSettings", () => {
    it("应该返回空数组当没有设定时", async () => {
      const settings = await getSettings(testProject.id)
      expect(settings).toEqual([])
    })

    it("应该支持搜索过滤", async () => {
      await createSetting(testProject.id, "character", "角色A", "描述A")
      await createSetting(testProject.id, "character", "角色B", "描述B")
      await createSetting(testProject.id, "worldview", "世界观", "包含角色的世界")

      const settings = await getSettings(testProject.id, "角色")
      expect(settings).toHaveLength(3) // 名称或内容包含"角色"
    })
  })

  describe("createSetting", () => {
    it("应该创建设定并默认启用", async () => {
      const setting = await createSetting(testProject.id, "character", "主角", "主角描述")

      expect(setting.id).toBeDefined()
      expect(setting.category).toBe("character")
      expect(setting.name).toBe("主角")
      expect(setting.content).toBe("主角描述")
      expect(setting.enabled).toBe(true)
    })
  })

  describe("updateSetting", () => {
    it("应该更新设定内容", async () => {
      const setting = await createSetting(testProject.id, "character", "角色", "原内容")
      await updateSetting(setting.id, { content: "新内容" })

      const settings = await getSettings(testProject.id)
      const updated = settings.find((s: any) => s.id === setting.id)
      expect(updated.content).toBe("新内容")
    })

    it("应该切换启用状态", async () => {
      const setting = await createSetting(testProject.id, "character", "角色", "内容")
      await updateSetting(setting.id, { enabled: false })

      const settings = await getSettings(testProject.id)
      const updated = settings.find((s: any) => s.id === setting.id)
      expect(updated.enabled).toBe(false)
    })
  })

  describe("deleteSetting", () => {
    it("应该删除设定", async () => {
      const setting = await createSetting(testProject.id, "character", "角色", "内容")
      await deleteSetting(setting.id)

      const settings = await getSettings(testProject.id)
      expect(settings).toHaveLength(0)
    })
  })
})

// ========== 设定提示词操作测试 ==========

describe("数据库模块 - 设定提示词操作", () => {
  let testProject: any

  beforeEach(async () => {
    testProject = await createProject("测试项目")
  })

  describe("getSettingPrompts", () => {
    it("应该返回空数组当没有提示词时", async () => {
      const prompts = await getSettingPrompts(testProject.id)
      expect(prompts).toEqual([])
    })
  })

  describe("createSettingPrompt", () => {
    it("应该创建设定提示词", async () => {
      const prompt = await createSettingPrompt(testProject.id, "character", "请描述{name}的特点")

      expect(prompt.id).toBeDefined()
      expect(prompt.category).toBe("character")
      expect(prompt.prompt_template).toBe("请描述{name}的特点")
      expect(prompt.enabled).toBe(true)
    })
  })

  describe("getSettingPrompt", () => {
    it("应该返回指定分类的提示词", async () => {
      await createSettingPrompt(testProject.id, "character", "角色模板")
      await createSettingPrompt(testProject.id, "worldview", "世界观模板")

      const prompt = await getSettingPrompt(testProject.id, "character")
      expect(prompt).not.toBeNull()
      expect(prompt.prompt_template).toBe("角色模板")
    })

    it("应该返回 null 当提示词不存在时", async () => {
      const prompt = await getSettingPrompt(testProject.id, "character")
      expect(prompt).toBeNull()
    })
  })

  describe("updateSettingPrompt", () => {
    it("应该更新提示词模板", async () => {
      const prompt = await createSettingPrompt(testProject.id, "character", "原模板")
      await updateSettingPrompt(prompt.id, { prompt_template: "新模板" })

      const updated = await getSettingPrompt(testProject.id, "character")
      expect(updated.prompt_template).toBe("新模板")
    })
  })

  describe("deleteSettingPrompt", () => {
    it("应该删除提示词", async () => {
      const prompt = await createSettingPrompt(testProject.id, "character", "模板")
      await deleteSettingPrompt(prompt.id)

      const deleted = await getSettingPrompt(testProject.id, "character")
      expect(deleted).toBeNull()
    })
  })
})

// ========== 全局配置操作测试 ==========

describe("数据库模块 - 全局配置操作", () => {
  describe("getGlobalConfig", () => {
    it("应该返回默认配置", async () => {
      const config = await getGlobalConfig()

      expect(config.id).toBe(1)
      expect(config.theme).toBe("system")
      expect(config.default_loop_max).toBe(10)
      expect(config.default_timeout).toBe(300)
    })
  })

  describe("updateGlobalConfig", () => {
    it("应该更新主题设置", async () => {
      await updateGlobalConfig({ theme: "dark" })

      const config = await getGlobalConfig()
      expect(config.theme).toBe("dark")
    })

    it("应该更新 AI 提供商配置", async () => {
      const aiProviders = {
        openai: { api_key: "sk-test", enabled: true, enabled_models: ["gpt-4"], custom_models: [] },
        gemini: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      }
      await updateGlobalConfig({ ai_providers: aiProviders })

      const config = await getGlobalConfig()
      expect(config.ai_providers.openai.api_key).toBe("sk-test")
      expect(config.ai_providers.openai.enabled).toBe(true)
    })

    it("应该更新默认循环次数和超时时间", async () => {
      await updateGlobalConfig({ default_loop_max: 20, default_timeout: 600 })

      const config = await getGlobalConfig()
      expect(config.default_loop_max).toBe(20)
      expect(config.default_timeout).toBe(600)
    })
  })
})

// ========== 执行记录操作测试 ==========

describe("数据库模块 - 执行记录操作", () => {
  let testWorkflow: any

  beforeEach(async () => {
    const project = await createProject("测试项目")
    testWorkflow = await createWorkflow(project.id, "测试工作流")
  })

  describe("createExecution", () => {
    it("应该创建执行记录", async () => {
      const execution = await createExecution(testWorkflow.id, "测试输入")

      expect(execution.id).toBeDefined()
      expect(execution.workflow_id).toBe(testWorkflow.id)
      expect(execution.status).toBe("running")
      expect(execution.input).toBe("测试输入")
    })
  })

  describe("getExecutions", () => {
    it("应该返回工作流的所有执行记录", async () => {
      await createExecution(testWorkflow.id, "输入1")
      await createExecution(testWorkflow.id, "输入2")

      const executions = await getExecutions(testWorkflow.id)
      expect(executions).toHaveLength(2)
    })
  })

  describe("updateExecution", () => {
    it("应该更新执行状态", async () => {
      const execution = await createExecution(testWorkflow.id)
      await updateExecution(execution.id, {
        status: "completed",
        final_output: "最终输出",
        finished_at: new Date().toISOString(),
      })

      const executions = await getExecutions(testWorkflow.id)
      const updated = executions.find((e: any) => e.id === execution.id)
      expect(updated.status).toBe("completed")
      expect(updated.final_output).toBe("最终输出")
    })

    it("应该保存变量快照", async () => {
      const execution = await createExecution(testWorkflow.id)
      const snapshot = { var1: "value1", var2: 123 }
      await updateExecution(execution.id, { variables_snapshot: snapshot })

      const executions = await getExecutions(testWorkflow.id)
      const updated = executions.find((e: any) => e.id === execution.id)
      expect(updated.variables_snapshot).toEqual(snapshot)
    })
  })

  describe("deleteExecution", () => {
    it("应该删除执行记录及其节点结果", async () => {
      const execution = await createExecution(testWorkflow.id)
      const nodes = await getNodes(testWorkflow.id)
      await createNodeResult(execution.id, nodes[0].id)

      await deleteExecution(execution.id)

      const executions = await getExecutions(testWorkflow.id)
      expect(executions).toHaveLength(0)

      const results = await getNodeResults(execution.id)
      expect(results).toHaveLength(0)
    })
  })
})

// ========== 节点结果操作测试 ==========

describe("数据库模块 - 节点结果操作", () => {
  let testExecution: any
  let testNodeId: string

  beforeEach(async () => {
    const project = await createProject("测试项目")
    const workflow = await createWorkflow(project.id, "测试工作流")
    const nodes = await getNodes(workflow.id)
    testNodeId = nodes[0].id
    testExecution = await createExecution(workflow.id)
  })

  describe("createNodeResult", () => {
    it("应该创建节点结果", async () => {
      const result = await createNodeResult(testExecution.id, testNodeId)

      expect(result.id).toBeDefined()
      expect(result.execution_id).toBe(testExecution.id)
      expect(result.node_id).toBe(testNodeId)
      expect(result.status).toBe("running")
      expect(result.iteration).toBe(1)
    })

    it("应该支持自定义迭代次数", async () => {
      const result = await createNodeResult(testExecution.id, testNodeId, 3)

      expect(result.iteration).toBe(3)
    })
  })

  describe("getNodeResults", () => {
    it("应该返回执行的所有节点结果", async () => {
      await createNodeResult(testExecution.id, testNodeId)
      await createNodeResult(testExecution.id, testNodeId, 2)

      const results = await getNodeResults(testExecution.id)
      expect(results).toHaveLength(2)
    })
  })

  describe("updateNodeResult", () => {
    it("应该更新节点结果", async () => {
      const result = await createNodeResult(testExecution.id, testNodeId)
      await updateNodeResult(result.id, {
        input: "输入内容",
        output: "输出内容",
        status: "completed",
        finished_at: new Date().toISOString(),
      })

      const results = await getNodeResults(testExecution.id)
      const updated = results.find((r: any) => r.id === result.id)
      expect(updated.input).toBe("输入内容")
      expect(updated.output).toBe("输出内容")
      expect(updated.status).toBe("completed")
    })

    it("应该保存解析后的配置", async () => {
      const result = await createNodeResult(testExecution.id, testNodeId)
      const resolvedConfig = { prompt: "解析后的提示词", model: "gpt-4" }
      await updateNodeResult(result.id, { resolved_config: resolvedConfig })

      const results = await getNodeResults(testExecution.id)
      const updated = results.find((r: any) => r.id === result.id)
      expect(updated.resolved_config).toEqual(resolvedConfig)
    })
  })
})

// ========== 工作流版本历史测试 ==========

describe("数据库模块 - 工作流版本历史", () => {
  let testWorkflow: any

  beforeEach(async () => {
    const project = await createProject("测试项目")
    testWorkflow = await createWorkflow(project.id, "测试工作流")
  })

  describe("createWorkflowVersion", () => {
    it("应该创建版本快照", async () => {
      const version = await createWorkflowVersion(testWorkflow.id, "初始版本")

      expect(version.id).toBeDefined()
      expect(version.workflow_id).toBe(testWorkflow.id)
      expect(version.version_number).toBe(1)
      expect(version.description).toBe("初始版本")

      const snapshot = JSON.parse(version.snapshot)
      expect(snapshot.workflow.name).toBe("测试工作流")
      expect(snapshot.nodes).toHaveLength(1) // 开始节点
    })

    it("应该递增版本号", async () => {
      await createWorkflowVersion(testWorkflow.id, "版本1")
      const version2 = await createWorkflowVersion(testWorkflow.id, "版本2")

      expect(version2.version_number).toBe(2)
    })

    it("应该在工作流不存在时抛出错误", async () => {
      await expect(createWorkflowVersion("non-existent-id")).rejects.toThrow("工作流不存在")
    })
  })

  describe("getWorkflowVersions", () => {
    it("应该按版本号倒序返回", async () => {
      await createWorkflowVersion(testWorkflow.id, "版本1")
      await createWorkflowVersion(testWorkflow.id, "版本2")
      await createWorkflowVersion(testWorkflow.id, "版本3")

      const versions = await getWorkflowVersions(testWorkflow.id)
      expect(versions).toHaveLength(3)
      expect(versions[0].version_number).toBe(3)
      expect(versions[1].version_number).toBe(2)
      expect(versions[2].version_number).toBe(1)
    })
  })

  describe("deleteWorkflowVersion", () => {
    it("应该删除版本", async () => {
      const version = await createWorkflowVersion(testWorkflow.id, "待删除")
      await deleteWorkflowVersion(version.id)

      const versions = await getWorkflowVersions(testWorkflow.id)
      expect(versions).toHaveLength(0)
    })
  })
})

// ========== 数据完整性测试 ==========

describe("数据库模块 - 数据完整性", () => {
  it("应该正确处理 JSON 序列化和反序列化", async () => {
    const project = await createProject("项目")
    const workflow = await createWorkflow(project.id, "工作流")

    const complexConfig = {
      nested: {
        array: [1, 2, 3],
        object: { key: "value" },
      },
      special: "包含特殊字符：'\"\\",
      unicode: "中文测试 🎉",
    }

    const node = await createNode(workflow.id, "ai_chat", "节点", complexConfig)
    const retrieved = await getNode(node.id)

    expect(retrieved.config).toEqual(complexConfig)
  })

  it("应该正确处理空值和 undefined", async () => {
    const project = await createProject("项目", undefined)
    expect(project.description).toBeUndefined()

    const retrieved = await getProject(project.id)
    expect(retrieved.description).toBeNull() // 数据库中存储为 NULL
  })

  it("应该正确处理布尔值转换", async () => {
    const project = await createProject("项目")
    const setting = await createSetting(project.id, "character", "角色", "内容")

    // 启用状态应为 true
    let settings = await getSettings(project.id)
    expect(settings[0].enabled).toBe(true)

    // 禁用后应为 false
    await updateSetting(setting.id, { enabled: false })
    settings = await getSettings(project.id)
    expect(settings[0].enabled).toBe(false)
  })
})

