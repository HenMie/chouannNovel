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
  ProjectStats,
  GlobalStats,
  ExportedWorkflow,
  ExportedSettings,
  ExportedProject,
  WorkflowVersion,
  WorkflowSnapshot,
} from '@/types'
import { EXPORT_VERSION } from '@/types'

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
  const workflowId = generateId()
  const now = new Date().toISOString()

  await db.execute(
    `INSERT INTO workflows (id, project_id, name, description, loop_max_count, timeout_seconds, created_at, updated_at)
     VALUES (?, ?, ?, ?, 10, 300, ?, ?)`,
    [workflowId, projectId, name, description || null, now, now]
  )

  // 自动创建开始流程节点（固定在第一行）
  const startNodeId = generateId()
  await db.execute(
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
    Array<Omit<WorkflowNode, 'config'> & { config: string; block_id: string | null; parent_block_id: string | null }>
  >('SELECT * FROM nodes WHERE workflow_id = ? ORDER BY order_index ASC', [
    workflowId,
  ])

  return nodes.map((node) => ({
    ...node,
    config: JSON.parse(node.config),
    block_id: node.block_id || undefined,
    parent_block_id: node.parent_block_id || undefined,
  }))
}

export async function getNode(id: string): Promise<WorkflowNode | null> {
  const db = await getDatabase()
  const results = await db.select<
    Array<Omit<WorkflowNode, 'config'> & { config: string; block_id: string | null; parent_block_id: string | null }>
  >('SELECT * FROM nodes WHERE id = ?', [id])

  if (!results[0]) return null

  return {
    ...results[0],
    config: JSON.parse(results[0].config),
    block_id: results[0].block_id || undefined,
    parent_block_id: results[0].parent_block_id || undefined,
  }
}

export async function createNode(
  workflowId: string,
  type: WorkflowNode['type'],
  name: string,
  config: WorkflowNode['config'] = {},
  options?: {
    block_id?: string
    parent_block_id?: string
    insert_after_index?: number  // 在指定索引后插入
  }
): Promise<WorkflowNode> {
  const db = await getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  let orderIndex: number

  if (options?.insert_after_index !== undefined) {
    // 在指定位置后插入，需要移动后面的节点
    orderIndex = options.insert_after_index + 1
    await db.execute(
      `UPDATE nodes SET order_index = order_index + 1, updated_at = ? 
       WHERE workflow_id = ? AND order_index >= ?`,
      [now, workflowId, orderIndex]
    )
  } else {
    // 获取最大 order_index，添加到末尾
    const maxResult = await db.select<[{ max_order: number | null }]>(
      'SELECT MAX(order_index) as max_order FROM nodes WHERE workflow_id = ?',
      [workflowId]
    )
    orderIndex = (maxResult[0]?.max_order ?? -1) + 1
  }

  await db.execute(
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

export async function updateNode(
  id: string,
  data: Partial<Pick<WorkflowNode, 'name' | 'config' | 'block_id' | 'parent_block_id'>>
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
  if (data.block_id !== undefined) {
    updates.push('block_id = ?')
    values.push(data.block_id || null)
  }
  if (data.parent_block_id !== undefined) {
    updates.push('parent_block_id = ?')
    values.push(data.parent_block_id || null)
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

  // 获取开始流程节点的 ID（确保它始终在第一位）
  const startNodes = await db.select<[{ id: string }]>(
    `SELECT id FROM nodes WHERE workflow_id = ? AND type = 'start'`,
    [workflowId]
  )
  
  let orderedNodeIds = [...nodeIds]
  
  // 如果有开始流程节点，确保它在第一位
  if (startNodes.length > 0) {
    const startNodeId = startNodes[0].id
    // 移除开始流程节点（如果在列表中）
    orderedNodeIds = orderedNodeIds.filter(id => id !== startNodeId)
    // 将开始流程节点放到第一位
    orderedNodeIds.unshift(startNodeId)
  }

  for (let i = 0; i < orderedNodeIds.length; i++) {
    await db.execute(
      'UPDATE nodes SET order_index = ?, updated_at = ? WHERE id = ? AND workflow_id = ?',
      [i, new Date().toISOString(), orderedNodeIds[i], workflowId]
    )
  }
}

/**
 * 批量恢复节点状态（用于撤销/重做）
 * 删除当前所有节点，然后重新创建
 */
export async function restoreNodes(
  workflowId: string,
  nodes: Array<Omit<WorkflowNode, 'id' | 'workflow_id' | 'created_at' | 'updated_at'>>
): Promise<WorkflowNode[]> {
  const db = await getDatabase()
  const now = new Date().toISOString()

  // 删除当前工作流的所有节点
  await db.execute('DELETE FROM nodes WHERE workflow_id = ?', [workflowId])

  // 创建 block_id 映射（保持原有的 block_id，不重新生成）
  const restoredNodes: WorkflowNode[] = []

  // 重新创建节点
  for (const node of nodes) {
    const nodeId = generateId()

    await db.execute(
      `INSERT INTO nodes (id, workflow_id, type, name, config, order_index, block_id, parent_block_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nodeId,
        workflowId,
        node.type,
        node.name,
        JSON.stringify(node.config),
        node.order_index,
        node.block_id || null,
        node.parent_block_id || null,
        now,
        now,
      ]
    )

    restoredNodes.push({
      id: nodeId,
      workflow_id: workflowId,
      type: node.type,
      name: node.name,
      config: node.config,
      order_index: node.order_index,
      block_id: node.block_id,
      parent_block_id: node.parent_block_id,
      created_at: now,
      updated_at: now,
    })
  }

  return restoredNodes
}

// ========== 设定库操作 ==========

export async function getSettings(
  projectId: string,
  query?: string
): Promise<Setting[]> {
  const db = await getDatabase()
  let sql = 'SELECT * FROM settings WHERE project_id = ?'
  const params: any[] = [projectId]

  if (query) {
    sql += ' AND (name LIKE ? OR content LIKE ?)'
    params.push(`%${query}%`, `%${query}%`)
  }

  sql += ' ORDER BY category, name'

  const settings = await db.select<Array<Omit<Setting, 'enabled'> & { enabled: number }>>(
    sql,
    params
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

// 默认启用的模型列表
const DEFAULT_ENABLED_MODELS = {
  gemini: ['gemini-3-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'],
  openai: ['gpt-5.1', 'gpt-5', 'gpt-5-mini'],
  claude: ['claude-opus-4-5-20251101', 'claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
}

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
        openai: { 
          api_key: '', 
          enabled: false, 
          enabled_models: DEFAULT_ENABLED_MODELS.openai,
          custom_models: [],
        },
        gemini: { 
          api_key: '', 
          enabled: false, 
          enabled_models: DEFAULT_ENABLED_MODELS.gemini,
          custom_models: [],
        },
        claude: { 
          api_key: '', 
          enabled: false, 
          enabled_models: DEFAULT_ENABLED_MODELS.claude,
          custom_models: [],
        },
      },
      theme: 'system',
      default_loop_max: 10,
      default_timeout: 300,
    }
  }

  const aiProviders = JSON.parse(results[0].ai_providers)
  
  // 迁移：为旧配置添加默认模型列表
  for (const provider of ['openai', 'gemini', 'claude'] as const) {
    if (aiProviders[provider] && !aiProviders[provider].enabled_models) {
      aiProviders[provider].enabled_models = DEFAULT_ENABLED_MODELS[provider]
      aiProviders[provider].custom_models = []
    }
  }

  return {
    ...results[0],
    ai_providers: aiProviders,
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

export async function deleteExecution(id: string): Promise<void> {
  const db = await getDatabase()
  // 先删除关联的节点结果
  await db.execute('DELETE FROM node_results WHERE execution_id = ?', [id])
  // 再删除执行记录
  await db.execute('DELETE FROM executions WHERE id = ?', [id])
}

// ========== 节点结果操作 ==========

export async function getNodeResults(executionId: string): Promise<NodeResult[]> {
  const db = await getDatabase()
  const results = await db.select<Array<NodeResult & { resolved_config?: string }>>(
    'SELECT * FROM node_results WHERE execution_id = ? ORDER BY started_at ASC',
    [executionId]
  )
  
  // 解析 resolved_config JSON 字符串
  return results.map(result => ({
    ...result,
    resolved_config: result.resolved_config 
      ? JSON.parse(result.resolved_config as string) 
      : undefined,
  }))
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
  data: Partial<Pick<NodeResult, 'input' | 'output' | 'status' | 'finished_at' | 'resolved_config'>>
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
  if (data.resolved_config !== undefined) {
    updates.push('resolved_config = ?')
    values.push(data.resolved_config ? JSON.stringify(data.resolved_config) : null)
  }

  values.push(id)

  await db.execute(
    `UPDATE node_results SET ${updates.join(', ')} WHERE id = ?`,
    values
  )
}

// ========== 统计操作 ==========

export async function getGlobalStats(): Promise<GlobalStats> {
  const db = await getDatabase()
  
  // 获取活跃项目数（有工作流的项目）
  const projectsResult = await db.select<[{ count: number }]>(
    'SELECT COUNT(DISTINCT id) as count FROM projects'
  )
  
  // 今日字数暂时返回 0（后续可以统计今日执行的输出字数）
  // 可以通过统计今天执行的 node_results 中的 output 字数来实现
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const wordCountResult = await db.select<[{ count: number }]>(
    `SELECT COALESCE(SUM(LENGTH(output)), 0) as count 
     FROM node_results 
     WHERE date(started_at) = date(?)`,
    [today]
  )
  
  return {
    active_projects: projectsResult[0]?.count || 0,
    today_word_count: wordCountResult[0]?.count || 0,
  }
}

export async function getProjectStats(projectId: string): Promise<ProjectStats> {
  const db = await getDatabase()
  
  // 统计角色数量
  const characterResult = await db.select<[{ count: number }]>(
    'SELECT COUNT(*) as count FROM settings WHERE project_id = ? AND category = ?',
    [projectId, 'character']
  )
  
  // 统计世界观数量
  const worldviewResult = await db.select<[{ count: number }]>(
    'SELECT COUNT(*) as count FROM settings WHERE project_id = ? AND category = ?',
    [projectId, 'worldview']
  )
  
  // 统计工作流数量
  const workflowResult = await db.select<[{ count: number }]>(
    'SELECT COUNT(*) as count FROM workflows WHERE project_id = ?',
    [projectId]
  )
  
  // 统计总字数（从该项目所有工作流的执行结果中）
  const wordCountResult = await db.select<[{ count: number }]>(
    `SELECT COALESCE(SUM(LENGTH(nr.output)), 0) as count
     FROM node_results nr
     INNER JOIN executions e ON nr.execution_id = e.id
     INNER JOIN workflows w ON e.workflow_id = w.id
     WHERE w.project_id = ?`,
    [projectId]
  )
  
  return {
    character_count: characterResult[0]?.count || 0,
    worldview_count: worldviewResult[0]?.count || 0,
    workflow_count: workflowResult[0]?.count || 0,
    total_word_count: wordCountResult[0]?.count || 0,
  }
}

// ========== 工作流导入/导出 ==========

/**
 * 导出工作流为 JSON 格式
 */
export async function exportWorkflow(workflowId: string): Promise<ExportedWorkflow | null> {
  const workflow = await getWorkflow(workflowId)
  if (!workflow) return null

  const nodes = await getNodes(workflowId)

  return {
    version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    workflow: {
      name: workflow.name,
      description: workflow.description,
      loop_max_count: workflow.loop_max_count,
      timeout_seconds: workflow.timeout_seconds,
    },
    nodes: nodes.map((node) => ({
      type: node.type,
      name: node.name,
      config: node.config,
      order_index: node.order_index,
      block_id: node.block_id,
      parent_block_id: node.parent_block_id,
    })),
  }
}

/**
 * 导入工作流到指定项目
 */
export async function importWorkflow(
  projectId: string,
  data: ExportedWorkflow,
  newName?: string
): Promise<Workflow> {
  const db = await getDatabase()
  const workflowId = generateId()
  const now = new Date().toISOString()

  // 创建工作流
  await db.execute(
    `INSERT INTO workflows (id, project_id, name, description, loop_max_count, timeout_seconds, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      workflowId,
      projectId,
      newName || data.workflow.name,
      data.workflow.description || null,
      data.workflow.loop_max_count,
      data.workflow.timeout_seconds,
      now,
      now,
    ]
  )

  // 创建 block_id 映射（用于保持块结构关系）
  const blockIdMap = new Map<string, string>()
  
  // 先收集所有需要映射的 block_id
  for (const node of data.nodes) {
    if (node.block_id && !blockIdMap.has(node.block_id)) {
      blockIdMap.set(node.block_id, generateId())
    }
  }

  // 创建节点
  for (const node of data.nodes) {
    const nodeId = generateId()
    const newBlockId = node.block_id ? blockIdMap.get(node.block_id) : null
    const newParentBlockId = node.parent_block_id ? blockIdMap.get(node.parent_block_id) : null

    await db.execute(
      `INSERT INTO nodes (id, workflow_id, type, name, config, order_index, block_id, parent_block_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nodeId,
        workflowId,
        node.type,
        node.name,
        JSON.stringify(node.config),
        node.order_index,
        newBlockId,
        newParentBlockId,
        now,
        now,
      ]
    )
  }

  return {
    id: workflowId,
    project_id: projectId,
    name: newName || data.workflow.name,
    description: data.workflow.description,
    loop_max_count: data.workflow.loop_max_count,
    timeout_seconds: data.workflow.timeout_seconds,
    created_at: now,
    updated_at: now,
  }
}

// ========== 设定库导入/导出 ==========

/**
 * 导出设定库为 JSON 格式
 */
export async function exportSettings(projectId: string): Promise<ExportedSettings> {
  const settings = await getSettings(projectId)
  const prompts = await getSettingPrompts(projectId)

  return {
    version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    settings: settings.map((s) => ({
      category: s.category,
      name: s.name,
      content: s.content,
      enabled: s.enabled,
    })),
    setting_prompts: prompts.map((p) => ({
      category: p.category,
      prompt_template: p.prompt_template,
      enabled: p.enabled,
    })),
  }
}

/**
 * 导入设定库到指定项目
 * @param mode 'merge' 合并（保留现有设定），'replace' 替换（清空后导入）
 */
export async function importSettings(
  projectId: string,
  data: ExportedSettings,
  mode: 'merge' | 'replace' = 'merge'
): Promise<void> {
  const db = await getDatabase()
  const now = new Date().toISOString()

  if (mode === 'replace') {
    // 清空现有设定
    await db.execute('DELETE FROM settings WHERE project_id = ?', [projectId])
    await db.execute('DELETE FROM setting_prompts WHERE project_id = ?', [projectId])
  }

  // 导入设定
  for (const setting of data.settings) {
    const id = generateId()
    await db.execute(
      `INSERT INTO settings (id, project_id, category, name, content, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, projectId, setting.category, setting.name, setting.content, setting.enabled ? 1 : 0, now, now]
    )
  }

  // 导入设定提示词
  if (data.setting_prompts) {
    for (const prompt of data.setting_prompts) {
      // 检查是否已存在该分类的提示词
      const existing = await getSettingPrompt(projectId, prompt.category)
      if (existing && mode === 'merge') {
        // 合并模式下跳过已存在的提示词
        continue
      }
      
      const id = generateId()
      await db.execute(
        `INSERT OR REPLACE INTO setting_prompts (id, project_id, category, prompt_template, enabled)
         VALUES (?, ?, ?, ?, ?)`,
        [id, projectId, prompt.category, prompt.prompt_template, prompt.enabled ? 1 : 0]
      )
    }
  }
}

// ========== 项目备份与恢复 ==========

/**
 * 导出完整项目数据
 */
export async function exportProject(projectId: string): Promise<ExportedProject | null> {
  const project = await getProject(projectId)
  if (!project) return null

  const workflows = await getWorkflows(projectId)
  const settings = await getSettings(projectId)
  const prompts = await getSettingPrompts(projectId)

  // 获取每个工作流的节点
  const workflowsWithNodes = await Promise.all(
    workflows.map(async (workflow) => {
      const nodes = await getNodes(workflow.id)
      return {
        workflow: {
          name: workflow.name,
          description: workflow.description,
          loop_max_count: workflow.loop_max_count,
          timeout_seconds: workflow.timeout_seconds,
        },
        nodes: nodes.map((node) => ({
          type: node.type,
          name: node.name,
          config: node.config,
          order_index: node.order_index,
          block_id: node.block_id,
          parent_block_id: node.parent_block_id,
        })),
      }
    })
  )

  return {
    version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    project: {
      name: project.name,
      description: project.description,
    },
    workflows: workflowsWithNodes,
    settings: settings.map((s) => ({
      category: s.category,
      name: s.name,
      content: s.content,
      enabled: s.enabled,
    })),
    setting_prompts: prompts.map((p) => ({
      category: p.category,
      prompt_template: p.prompt_template,
      enabled: p.enabled,
    })),
  }
}

/**
 * 从备份恢复项目（创建新项目）
 */
export async function importProject(
  data: ExportedProject,
  newName?: string
): Promise<Project> {
  const db = await getDatabase()
  const projectId = generateId()
  const now = new Date().toISOString()

  // 创建项目
  await db.execute(
    `INSERT INTO projects (id, name, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [projectId, newName || data.project.name, data.project.description || null, now, now]
  )

  // 导入工作流
  for (const workflowData of data.workflows) {
    const workflowId = generateId()
    
    await db.execute(
      `INSERT INTO workflows (id, project_id, name, description, loop_max_count, timeout_seconds, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workflowId,
        projectId,
        workflowData.workflow.name,
        workflowData.workflow.description || null,
        workflowData.workflow.loop_max_count,
        workflowData.workflow.timeout_seconds,
        now,
        now,
      ]
    )

    // 创建 block_id 映射
    const blockIdMap = new Map<string, string>()
    for (const node of workflowData.nodes) {
      if (node.block_id && !blockIdMap.has(node.block_id)) {
        blockIdMap.set(node.block_id, generateId())
      }
    }

    // 导入节点
    for (const node of workflowData.nodes) {
      const nodeId = generateId()
      const newBlockId = node.block_id ? blockIdMap.get(node.block_id) : null
      const newParentBlockId = node.parent_block_id ? blockIdMap.get(node.parent_block_id) : null

      await db.execute(
        `INSERT INTO nodes (id, workflow_id, type, name, config, order_index, block_id, parent_block_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nodeId,
          workflowId,
          node.type,
          node.name,
          JSON.stringify(node.config),
          node.order_index,
          newBlockId,
          newParentBlockId,
          now,
          now,
        ]
      )
    }
  }

  // 导入设定
  for (const setting of data.settings) {
    const id = generateId()
    await db.execute(
      `INSERT INTO settings (id, project_id, category, name, content, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, projectId, setting.category, setting.name, setting.content, setting.enabled ? 1 : 0, now, now]
    )
  }

  // 导入设定提示词
  for (const prompt of data.setting_prompts) {
    const id = generateId()
    await db.execute(
      `INSERT INTO setting_prompts (id, project_id, category, prompt_template, enabled)
       VALUES (?, ?, ?, ?, ?)`,
      [id, projectId, prompt.category, prompt.prompt_template, prompt.enabled ? 1 : 0]
    )
  }

  return {
    id: projectId,
    name: newName || data.project.name,
    description: data.project.description,
    created_at: now,
    updated_at: now,
  }
}

// ========== 工作流版本历史 ==========

/**
 * 获取工作流的版本历史列表
 */
export async function getWorkflowVersions(workflowId: string): Promise<WorkflowVersion[]> {
  const db = await getDatabase()
  const versions = await db.select<WorkflowVersion[]>(
    'SELECT * FROM workflow_versions WHERE workflow_id = ? ORDER BY version_number DESC',
    [workflowId]
  )
  return versions
}

/**
 * 获取单个版本详情
 */
export async function getWorkflowVersion(versionId: string): Promise<WorkflowVersion | null> {
  const db = await getDatabase()
  const results = await db.select<WorkflowVersion[]>(
    'SELECT * FROM workflow_versions WHERE id = ?',
    [versionId]
  )
  return results[0] || null
}

/**
 * 创建工作流版本快照
 */
export async function createWorkflowVersion(
  workflowId: string,
  description?: string
): Promise<WorkflowVersion> {
  const db = await getDatabase()
  
  // 获取当前工作流和节点
  const workflow = await getWorkflow(workflowId)
  if (!workflow) {
    throw new Error('工作流不存在')
  }
  
  const nodes = await getNodes(workflowId)

  // 创建快照
  const snapshot: WorkflowSnapshot = {
    workflow: {
      name: workflow.name,
      description: workflow.description,
      loop_max_count: workflow.loop_max_count,
      timeout_seconds: workflow.timeout_seconds,
    },
    nodes: nodes.map((node) => ({
      type: node.type,
      name: node.name,
      config: node.config,
      order_index: node.order_index,
      block_id: node.block_id,
      parent_block_id: node.parent_block_id,
    })),
  }

  // 获取最新版本号
  const maxResult = await db.select<[{ max_version: number | null }]>(
    'SELECT MAX(version_number) as max_version FROM workflow_versions WHERE workflow_id = ?',
    [workflowId]
  )
  const versionNumber = (maxResult[0]?.max_version ?? 0) + 1

  const id = generateId()
  const now = new Date().toISOString()

  await db.execute(
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

/**
 * 从版本历史恢复工作流
 */
export async function restoreWorkflowVersion(versionId: string): Promise<void> {
  const db = await getDatabase()
  
  const version = await getWorkflowVersion(versionId)
  if (!version) {
    throw new Error('版本不存在')
  }

  const snapshot: WorkflowSnapshot = JSON.parse(version.snapshot)
  const now = new Date().toISOString()

  // 更新工作流基本信息
  await db.execute(
    `UPDATE workflows SET name = ?, description = ?, loop_max_count = ?, timeout_seconds = ?, updated_at = ?
     WHERE id = ?`,
    [
      snapshot.workflow.name,
      snapshot.workflow.description || null,
      snapshot.workflow.loop_max_count,
      snapshot.workflow.timeout_seconds,
      now,
      version.workflow_id,
    ]
  )

  // 删除现有节点
  await db.execute('DELETE FROM nodes WHERE workflow_id = ?', [version.workflow_id])

  // 创建 block_id 映射
  const blockIdMap = new Map<string, string>()
  for (const node of snapshot.nodes) {
    if (node.block_id && !blockIdMap.has(node.block_id)) {
      blockIdMap.set(node.block_id, generateId())
    }
  }

  // 恢复节点
  for (const node of snapshot.nodes) {
    const nodeId = generateId()
    const newBlockId = node.block_id ? blockIdMap.get(node.block_id) : null
    const newParentBlockId = node.parent_block_id ? blockIdMap.get(node.parent_block_id) : null

    await db.execute(
      `INSERT INTO nodes (id, workflow_id, type, name, config, order_index, block_id, parent_block_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nodeId,
        version.workflow_id,
        node.type,
        node.name,
        JSON.stringify(node.config),
        node.order_index,
        newBlockId,
        newParentBlockId,
        now,
        now,
      ]
    )
  }
}

/**
 * 删除工作流版本
 */
export async function deleteWorkflowVersion(versionId: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('DELETE FROM workflow_versions WHERE id = ?', [versionId])
}

/**
 * 清理旧版本（保留最近 N 个版本）
 */
export async function cleanupOldVersions(workflowId: string, keepCount: number = 20): Promise<void> {
  const db = await getDatabase()
  
  // 获取需要删除的版本 ID
  const versionsToDelete = await db.select<Array<{ id: string }>>(
    `SELECT id FROM workflow_versions 
     WHERE workflow_id = ? 
     ORDER BY version_number DESC 
     LIMIT -1 OFFSET ?`,
    [workflowId, keepCount]
  )

  for (const version of versionsToDelete) {
    await db.execute('DELETE FROM workflow_versions WHERE id = ?', [version.id])
  }
}

