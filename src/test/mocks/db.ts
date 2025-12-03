// 数据库 Mock
// 用于单元测试中模拟 SQLite 数据库操作

import { vi } from "vitest"
import type {
  Project,
  Workflow,
  WorkflowNode,
  Setting,
  SettingPrompt,
  GlobalConfig,
  Execution,
  NodeResult,
} from "@/types"

// ========== 内存数据存储 ==========

interface MockDatabase {
  projects: Project[]
  workflows: Workflow[]
  nodes: WorkflowNode[]
  settings: Setting[]
  settingPrompts: SettingPrompt[]
  globalConfig: GlobalConfig
  executions: Execution[]
  nodeResults: NodeResult[]
}

let mockData: MockDatabase = createEmptyDatabase()

function createEmptyDatabase(): MockDatabase {
  return {
    projects: [],
    workflows: [],
    nodes: [],
    settings: [],
    settingPrompts: [],
    globalConfig: {
      id: 1,
      ai_providers: {
        openai: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        gemini: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      },
      theme: "system",
      default_loop_max: 10,
      default_timeout: 300,
    },
    executions: [],
    nodeResults: [],
  }
}

// ========== Mock Database 类 ==========

class MockDatabaseClass {
  async select<T>(sql: string, params?: unknown[]): Promise<T> {
    // 解析 SQL 并返回模拟数据
    const sqlLower = sql.toLowerCase()

    if (sqlLower.includes("from projects")) {
      if (params && params.length > 0) {
        return mockData.projects.filter((p) => p.id === params[0]) as T
      }
      return [...mockData.projects] as T
    }

    if (sqlLower.includes("from workflows")) {
      if (sqlLower.includes("where id")) {
        return mockData.workflows.filter((w) => w.id === params?.[0]) as T
      }
      if (sqlLower.includes("where project_id")) {
        return mockData.workflows.filter((w) => w.project_id === params?.[0]) as T
      }
      return [...mockData.workflows] as T
    }

    if (sqlLower.includes("from nodes")) {
      if (sqlLower.includes("where id")) {
        const node = mockData.nodes.find((n) => n.id === params?.[0])
        return (node ? [{ ...node, config: JSON.stringify(node.config) }] : []) as T
      }
      if (sqlLower.includes("where workflow_id")) {
        const nodes = mockData.nodes
          .filter((n) => n.workflow_id === params?.[0])
          .sort((a, b) => a.order_index - b.order_index)
          .map((n) => ({ ...n, config: JSON.stringify(n.config) }))
        return nodes as T
      }
      return mockData.nodes.map((n) => ({ ...n, config: JSON.stringify(n.config) })) as T
    }

    if (sqlLower.includes("from settings")) {
      if (sqlLower.includes("where project_id")) {
        return mockData.settings.filter((s) => s.project_id === params?.[0]) as T
      }
      return [...mockData.settings] as T
    }

    if (sqlLower.includes("from setting_prompts")) {
      if (params && params.length >= 2) {
        return mockData.settingPrompts.filter(
          (p) => p.project_id === params[0] && p.category === params[1]
        ) as T
      }
      if (params && params.length === 1) {
        return mockData.settingPrompts.filter((p) => p.project_id === params[0]) as T
      }
      return [...mockData.settingPrompts] as T
    }

    if (sqlLower.includes("from global_config")) {
      return [
        {
          ...mockData.globalConfig,
          ai_providers: JSON.stringify(mockData.globalConfig.ai_providers),
        },
      ] as T
    }

    if (sqlLower.includes("from executions")) {
      if (sqlLower.includes("where workflow_id")) {
        return mockData.executions.filter((e) => e.workflow_id === params?.[0]) as T
      }
      return [...mockData.executions] as T
    }

    if (sqlLower.includes("from node_results")) {
      if (sqlLower.includes("where execution_id")) {
        return mockData.nodeResults.filter((r) => r.execution_id === params?.[0]) as T
      }
      return [...mockData.nodeResults] as T
    }

    if (sqlLower.includes("max(order_index)")) {
      const workflowId = params?.[0]
      const nodes = mockData.nodes.filter((n) => n.workflow_id === workflowId)
      const maxOrder = nodes.length > 0 ? Math.max(...nodes.map((n) => n.order_index)) : -1
      return [{ max_order: maxOrder }] as T
    }

    return [] as T
  }

  async execute(sql: string, params?: unknown[]): Promise<void> {
    const sqlLower = sql.toLowerCase()

    // INSERT 操作
    if (sqlLower.startsWith("insert into projects")) {
      const [id, name, description, created_at, updated_at] = params as string[]
      mockData.projects.push({ id, name, description, created_at, updated_at })
      return
    }

    if (sqlLower.startsWith("insert into workflows")) {
      const [id, project_id, name, description, , , created_at, updated_at] = params as string[]
      mockData.workflows.push({
        id,
        project_id,
        name,
        description,
        loop_max_count: 10,
        timeout_seconds: 300,
        created_at,
        updated_at,
      })
      return
    }

    if (sqlLower.startsWith("insert into nodes")) {
      const [id, workflow_id, type, name, config, order_index, block_id, parent_block_id, created_at, updated_at] =
        params as (string | number | null)[]
      mockData.nodes.push({
        id: id as string,
        workflow_id: workflow_id as string,
        type: type as WorkflowNode["type"],
        name: name as string,
        config: JSON.parse(config as string),
        order_index: order_index as number,
        block_id: block_id as string | undefined,
        parent_block_id: parent_block_id as string | undefined,
        created_at: created_at as string,
        updated_at: updated_at as string,
      })
      return
    }

    if (sqlLower.startsWith("insert into executions")) {
      const [id, workflow_id, , input, started_at] = params as string[]
      mockData.executions.push({
        id,
        workflow_id,
        status: "running",
        input,
        started_at,
      })
      return
    }

    if (sqlLower.startsWith("insert into node_results")) {
      const [id, execution_id, node_id, iteration, , started_at] = params as (string | number)[]
      mockData.nodeResults.push({
        id: id as string,
        execution_id: execution_id as string,
        node_id: node_id as string,
        iteration: iteration as number,
        status: "running",
        started_at: started_at as string,
      })
      return
    }

    // UPDATE 操作
    if (sqlLower.startsWith("update projects")) {
      const id = params?.[params.length - 1] as string
      const project = mockData.projects.find((p) => p.id === id)
      if (project) {
        // 简化处理，实际需要解析 SQL
        project.updated_at = new Date().toISOString()
      }
      return
    }

    if (sqlLower.startsWith("update nodes set order_index")) {
      // 批量更新 order_index
      return
    }

    // DELETE 操作
    if (sqlLower.startsWith("delete from projects")) {
      const id = params?.[0] as string
      mockData.projects = mockData.projects.filter((p) => p.id !== id)
      return
    }

    if (sqlLower.startsWith("delete from workflows")) {
      const id = params?.[0] as string
      mockData.workflows = mockData.workflows.filter((w) => w.id !== id)
      return
    }

    if (sqlLower.startsWith("delete from nodes")) {
      const id = params?.[0] as string
      mockData.nodes = mockData.nodes.filter((n) => n.id !== id)
      return
    }

    if (sqlLower.startsWith("delete from executions")) {
      const id = params?.[0] as string
      mockData.executions = mockData.executions.filter((e) => e.id !== id)
      return
    }

    if (sqlLower.startsWith("delete from node_results")) {
      const executionId = params?.[0] as string
      mockData.nodeResults = mockData.nodeResults.filter((r) => r.execution_id !== executionId)
      return
    }
  }
}

// ========== 导出 ==========

export const mockDatabase = new MockDatabaseClass()

/**
 * Mock Database.load
 */
export const mockDatabaseLoad = vi.fn(async () => mockDatabase)

/**
 * 重置数据库数据
 */
export function resetMockDatabase(): void {
  mockData = createEmptyDatabase()
}

/**
 * 获取当前 mock 数据
 */
export function getMockData(): MockDatabase {
  return mockData
}

/**
 * 设置 mock 数据
 */
export function setMockData(data: Partial<MockDatabase>): void {
  mockData = { ...mockData, ...data }
}

/**
 * 添加测试项目
 */
export function addMockProject(project: Partial<Project>): Project {
  const now = new Date().toISOString()
  const fullProject: Project = {
    id: project.id || crypto.randomUUID(),
    name: project.name || "测试项目",
    description: project.description,
    created_at: project.created_at || now,
    updated_at: project.updated_at || now,
  }
  mockData.projects.push(fullProject)
  return fullProject
}

/**
 * 添加测试工作流
 */
export function addMockWorkflow(workflow: Partial<Workflow>): Workflow {
  const now = new Date().toISOString()
  const fullWorkflow: Workflow = {
    id: workflow.id || crypto.randomUUID(),
    project_id: workflow.project_id || "",
    name: workflow.name || "测试工作流",
    description: workflow.description,
    loop_max_count: workflow.loop_max_count || 10,
    timeout_seconds: workflow.timeout_seconds || 300,
    created_at: workflow.created_at || now,
    updated_at: workflow.updated_at || now,
  }
  mockData.workflows.push(fullWorkflow)
  return fullWorkflow
}

/**
 * 添加测试节点
 */
export function addMockNode(node: Partial<WorkflowNode>): WorkflowNode {
  const now = new Date().toISOString()
  const fullNode: WorkflowNode = {
    id: node.id || crypto.randomUUID(),
    workflow_id: node.workflow_id || "",
    type: node.type || "start",
    name: node.name || "测试节点",
    config: node.config || {},
    order_index: node.order_index ?? mockData.nodes.length,
    block_id: node.block_id,
    parent_block_id: node.parent_block_id,
    created_at: node.created_at || now,
    updated_at: node.updated_at || now,
  }
  mockData.nodes.push(fullNode)
  return fullNode
}

/**
 * 设置全局配置
 */
export function setMockGlobalConfig(config: Partial<GlobalConfig>): void {
  mockData.globalConfig = { ...mockData.globalConfig, ...config }
}

