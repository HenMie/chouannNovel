import Database from '@tauri-apps/plugin-sql'
import type {
  Project,
  Workflow,
  WorkflowNode,
  Setting,
  SettingPrompt,
  GlobalConfig,
  Execution,
  NodeResult,
} from '@/types'

// 数据库单例
let db: Database | null = null

// 获取数据库连接
export async function getDatabase(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:chouann_novel.db')
  }
  return db
}

// 生成 UUID
export function generateId(): string {
  return crypto.randomUUID()
}

// ========== 项目操作 ==========

export async function getProjects(): Promise<Project[]> {
  const db = await getDatabase()
  return db.select<Project[]>('SELECT * FROM projects ORDER BY updated_at DESC')
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await getDatabase()
  const results = await db.select<Project[]>(
    'SELECT * FROM projects WHERE id = ?',
    [id]
  )
  return results[0] || null
}

export async function createProject(
  name: string,
  description?: string
): Promise<Project> {
  const db = await getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  await db.execute(
    'INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, name, description || null, now, now]
  )

  return { id, name, description, created_at: now, updated_at: now }
}

export async function updateProject(
  id: string,
  data: Partial<Pick<Project, 'name' | 'description'>>
): Promise<void> {
  const db = await getDatabase()
  const updates: string[] = []
  const values: (string | null)[] = []

  if (data.name !== undefined) {
    updates.push('name = ?')
    values.push(data.name)
  }
  if (data.description !== undefined) {
    updates.push('description = ?')
    values.push(data.description || null)
  }

  updates.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  await db.execute(
    `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`,
    values
  )
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('DELETE FROM projects WHERE id = ?', [id])
}

// ========== 工作流操作 ==========

export async function getWorkflows(projectId: string): Promise<Workflow[]> {
  const db = await getDatabase()
  return db.select<Workflow[]>(
    'SELECT * FROM workflows WHERE project_id = ? ORDER BY updated_at DESC',
    [projectId]
  )
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  const db = await getDatabase()
  const results = await db.select<Workflow[]>(
    'SELECT * FROM workflows WHERE id = ?',
    [id]
  )
  return results[0] || null
}

export async function createWorkflow(
  projectId: string,
  name: string,
  description?: string
): Promise<Workflow> {
  const db = await getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  await db.execute(
    `INSERT INTO workflows (id, project_id, name, description, loop_max_count, timeout_seconds, created_at, updated_at)
     VALUES (?, ?, ?, ?, 10, 300, ?, ?)`,
    [id, projectId, name, description || null, now, now]
  )

  return {
    id,
    project_id: projectId,
    name,
    description,
    loop_max_count: 10,
    timeout_seconds: 300,
    created_at: now,
    updated_at: now,
  }
}

export async function updateWorkflow(
  id: string,
  data: Partial<
    Pick<Workflow, 'name' | 'description' | 'loop_max_count' | 'timeout_seconds'>
  >
): Promise<void> {
  const db = await getDatabase()
  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (data.name !== undefined) {
    updates.push('name = ?')
    values.push(data.name)
  }
  if (data.description !== undefined) {
    updates.push('description = ?')
    values.push(data.description || null)
  }
  if (data.loop_max_count !== undefined) {
    updates.push('loop_max_count = ?')
    values.push(data.loop_max_count)
  }
  if (data.timeout_seconds !== undefined) {
    updates.push('timeout_seconds = ?')
    values.push(data.timeout_seconds)
  }

  updates.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  await db.execute(
    `UPDATE workflows SET ${updates.join(', ')} WHERE id = ?`,
    values
  )
}

export async function deleteWorkflow(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('DELETE FROM workflows WHERE id = ?', [id])
}

// ========== 节点操作 ==========

export async function getNodes(workflowId: string): Promise<WorkflowNode[]> {
  const db = await getDatabase()
  const nodes = await db.select<
    Array<Omit<WorkflowNode, 'config'> & { config: string }>
  >('SELECT * FROM nodes WHERE workflow_id = ? ORDER BY order_index ASC', [
    workflowId,
  ])

  return nodes.map((node) => ({
    ...node,
    config: JSON.parse(node.config),
  }))
}

export async function getNode(id: string): Promise<WorkflowNode | null> {
  const db = await getDatabase()
  const results = await db.select<
    Array<Omit<WorkflowNode, 'config'> & { config: string }>
  >('SELECT * FROM nodes WHERE id = ?', [id])

  if (!results[0]) return null

  return {
    ...results[0],
    config: JSON.parse(results[0].config),
  }
}

export async function createNode(
  workflowId: string,
  type: WorkflowNode['type'],
  name: string,
  config: WorkflowNode['config'] = {}
): Promise<WorkflowNode> {
  const db = await getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  // 获取最大 order_index
  const maxResult = await db.select<[{ max_order: number | null }]>(
    'SELECT MAX(order_index) as max_order FROM nodes WHERE workflow_id = ?',
    [workflowId]
  )
  const orderIndex = (maxResult[0]?.max_order ?? -1) + 1

  await db.execute(
    `INSERT INTO nodes (id, workflow_id, type, name, config, order_index, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, workflowId, type, name, JSON.stringify(config), orderIndex, now, now]
  )

  return {
    id,
    workflow_id: workflowId,
    type,
    name,
    config,
    order_index: orderIndex,
    created_at: now,
    updated_at: now,
  }
}

export async function updateNode(
  id: string,
  data: Partial<Pick<WorkflowNode, 'name' | 'config'>>
): Promise<void> {
  const db = await getDatabase()
  const updates: string[] = []
  const values: (string | null)[] = []

  if (data.name !== undefined) {
    updates.push('name = ?')
    values.push(data.name)
  }
  if (data.config !== undefined) {
    updates.push('config = ?')
    values.push(JSON.stringify(data.config))
  }

  updates.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  await db.execute(`UPDATE nodes SET ${updates.join(', ')} WHERE id = ?`, values)
}

export async function deleteNode(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('DELETE FROM nodes WHERE id = ?', [id])
}

export async function reorderNodes(
  workflowId: string,
  nodeIds: string[]
): Promise<void> {
  const db = await getDatabase()

  for (let i = 0; i < nodeIds.length; i++) {
    await db.execute(
      'UPDATE nodes SET order_index = ?, updated_at = ? WHERE id = ? AND workflow_id = ?',
      [i, new Date().toISOString(), nodeIds[i], workflowId]
    )
  }
}

// ========== 设定库操作 ==========

export async function getSettings(projectId: string): Promise<Setting[]> {
  const db = await getDatabase()
  const settings = await db.select<Array<Omit<Setting, 'enabled'> & { enabled: number }>>(
    'SELECT * FROM settings WHERE project_id = ? ORDER BY category, name',
    [projectId]
  )
  return settings.map((s) => ({ ...s, enabled: Boolean(s.enabled) }))
}

export async function createSetting(
  projectId: string,
  category: Setting['category'],
  name: string,
  content: string
): Promise<Setting> {
  const db = await getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  await db.execute(
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

export async function updateSetting(
  id: string,
  data: Partial<Pick<Setting, 'name' | 'content' | 'enabled'>>
): Promise<void> {
  const db = await getDatabase()
  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (data.name !== undefined) {
    updates.push('name = ?')
    values.push(data.name)
  }
  if (data.content !== undefined) {
    updates.push('content = ?')
    values.push(data.content)
  }
  if (data.enabled !== undefined) {
    updates.push('enabled = ?')
    values.push(data.enabled ? 1 : 0)
  }

  updates.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  await db.execute(
    `UPDATE settings SET ${updates.join(', ')} WHERE id = ?`,
    values
  )
}

export async function deleteSetting(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('DELETE FROM settings WHERE id = ?', [id])
}

// ========== 设定注入提示词操作 ==========

export async function getSettingPrompts(projectId: string): Promise<SettingPrompt[]> {
  const db = await getDatabase()
  const prompts = await db.select<Array<Omit<SettingPrompt, 'enabled'> & { enabled: number }>>(
    'SELECT * FROM setting_prompts WHERE project_id = ? ORDER BY category',
    [projectId]
  )
  return prompts.map((p) => ({ ...p, enabled: Boolean(p.enabled) }))
}

export async function getSettingPrompt(
  projectId: string,
  category: SettingPrompt['category']
): Promise<SettingPrompt | null> {
  const db = await getDatabase()
  const results = await db.select<Array<Omit<SettingPrompt, 'enabled'> & { enabled: number }>>(
    'SELECT * FROM setting_prompts WHERE project_id = ? AND category = ?',
    [projectId, category]
  )
  if (!results[0]) return null
  return { ...results[0], enabled: Boolean(results[0].enabled) }
}

export async function createSettingPrompt(
  projectId: string,
  category: SettingPrompt['category'],
  promptTemplate: string
): Promise<SettingPrompt> {
  const db = await getDatabase()
  const id = generateId()

  await db.execute(
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

export async function updateSettingPrompt(
  id: string,
  data: Partial<Pick<SettingPrompt, 'prompt_template' | 'enabled'>>
): Promise<void> {
  const db = await getDatabase()
  const updates: string[] = []
  const values: (string | number)[] = []

  if (data.prompt_template !== undefined) {
    updates.push('prompt_template = ?')
    values.push(data.prompt_template)
  }
  if (data.enabled !== undefined) {
    updates.push('enabled = ?')
    values.push(data.enabled ? 1 : 0)
  }

  if (updates.length > 0) {
    values.push(id)
    await db.execute(
      `UPDATE setting_prompts SET ${updates.join(', ')} WHERE id = ?`,
      values
    )
  }
}

export async function deleteSettingPrompt(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('DELETE FROM setting_prompts WHERE id = ?', [id])
}

export async function upsertSettingPrompt(
  projectId: string,
  category: SettingPrompt['category'],
  promptTemplate: string
): Promise<SettingPrompt> {
  const existing = await getSettingPrompt(projectId, category)
  if (existing) {
    await updateSettingPrompt(existing.id, { prompt_template: promptTemplate })
    return { ...existing, prompt_template: promptTemplate }
  }
  return createSettingPrompt(projectId, category, promptTemplate)
}

// ========== 全局配置操作 ==========

export async function getGlobalConfig(): Promise<GlobalConfig> {
  const db = await getDatabase()
  const results = await db.select<
    Array<Omit<GlobalConfig, 'ai_providers'> & { ai_providers: string }>
  >('SELECT * FROM global_config WHERE id = 1')

  if (!results[0]) {
    // 返回默认配置
    return {
      id: 1,
      ai_providers: {
        openai: { api_key: '', enabled: false },
        gemini: { api_key: '', enabled: false },
        claude: { api_key: '', enabled: false },
      },
      theme: 'system',
      default_loop_max: 10,
      default_timeout: 300,
    }
  }

  return {
    ...results[0],
    ai_providers: JSON.parse(results[0].ai_providers),
  }
}

export async function updateGlobalConfig(
  data: Partial<Omit<GlobalConfig, 'id'>>
): Promise<void> {
  const db = await getDatabase()
  const updates: string[] = []
  const values: (string | number)[] = []

  if (data.ai_providers !== undefined) {
    updates.push('ai_providers = ?')
    values.push(JSON.stringify(data.ai_providers))
  }
  if (data.theme !== undefined) {
    updates.push('theme = ?')
    values.push(data.theme)
  }
  if (data.default_loop_max !== undefined) {
    updates.push('default_loop_max = ?')
    values.push(data.default_loop_max)
  }
  if (data.default_timeout !== undefined) {
    updates.push('default_timeout = ?')
    values.push(data.default_timeout)
  }

  if (updates.length > 0) {
    await db.execute(
      `UPDATE global_config SET ${updates.join(', ')} WHERE id = 1`,
      values
    )
  }
}

// ========== 执行记录操作 ==========

export async function getExecutions(workflowId: string): Promise<Execution[]> {
  const db = await getDatabase()
  const executions = await db.select<
    Array<Omit<Execution, 'variables_snapshot'> & { variables_snapshot: string | null }>
  >(
    'SELECT * FROM executions WHERE workflow_id = ? ORDER BY started_at DESC',
    [workflowId]
  )

  return executions.map((e) => ({
    ...e,
    variables_snapshot: e.variables_snapshot
      ? JSON.parse(e.variables_snapshot)
      : undefined,
  }))
}

export async function createExecution(workflowId: string, input?: string): Promise<Execution> {
  const db = await getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  await db.execute(
    `INSERT INTO executions (id, workflow_id, status, input, started_at)
     VALUES (?, ?, 'running', ?, ?)`,
    [id, workflowId, input || null, now]
  )

  return {
    id,
    workflow_id: workflowId,
    status: 'running',
    input,
    started_at: now,
  }
}

export async function updateExecution(
  id: string,
  data: Partial<
    Pick<Execution, 'status' | 'final_output' | 'variables_snapshot' | 'finished_at'>
  >
): Promise<void> {
  const db = await getDatabase()
  const updates: string[] = []
  const values: (string | null)[] = []

  if (data.status !== undefined) {
    updates.push('status = ?')
    values.push(data.status)
  }
  if (data.final_output !== undefined) {
    updates.push('final_output = ?')
    values.push(data.final_output || null)
  }
  if (data.variables_snapshot !== undefined) {
    updates.push('variables_snapshot = ?')
    values.push(
      data.variables_snapshot ? JSON.stringify(data.variables_snapshot) : null
    )
  }
  if (data.finished_at !== undefined) {
    updates.push('finished_at = ?')
    values.push(data.finished_at || null)
  }

  values.push(id)

  await db.execute(
    `UPDATE executions SET ${updates.join(', ')} WHERE id = ?`,
    values
  )
}

// ========== 节点结果操作 ==========

export async function getNodeResults(executionId: string): Promise<NodeResult[]> {
  const db = await getDatabase()
  return db.select<NodeResult[]>(
    'SELECT * FROM node_results WHERE execution_id = ? ORDER BY started_at ASC',
    [executionId]
  )
}

export async function createNodeResult(
  executionId: string,
  nodeId: string,
  iteration: number = 1
): Promise<NodeResult> {
  const db = await getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  await db.execute(
    `INSERT INTO node_results (id, execution_id, node_id, iteration, status, started_at)
     VALUES (?, ?, ?, ?, 'running', ?)`,
    [id, executionId, nodeId, iteration, now]
  )

  return {
    id,
    execution_id: executionId,
    node_id: nodeId,
    iteration,
    status: 'running',
    started_at: now,
  }
}

export async function updateNodeResult(
  id: string,
  data: Partial<Pick<NodeResult, 'input' | 'output' | 'status' | 'finished_at'>>
): Promise<void> {
  const db = await getDatabase()
  const updates: string[] = []
  const values: (string | null)[] = []

  if (data.input !== undefined) {
    updates.push('input = ?')
    values.push(data.input || null)
  }
  if (data.output !== undefined) {
    updates.push('output = ?')
    values.push(data.output || null)
  }
  if (data.status !== undefined) {
    updates.push('status = ?')
    values.push(data.status)
  }
  if (data.finished_at !== undefined) {
    updates.push('finished_at = ?')
    values.push(data.finished_at || null)
  }

  values.push(id)

  await db.execute(
    `UPDATE node_results SET ${updates.join(', ')} WHERE id = ?`,
    values
  )
}

