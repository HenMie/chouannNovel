import path from "node:path"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { SqlClient } from "../types"

vi.doUnmock("@/lib/db")
vi.doUnmock("@/lib/db/index")

let db: typeof import("@/lib/db")
let client: SqlClient

// 提前设置 wasm 路径，避免 Node 测试环境找不到文件
;(globalThis as any).__SQLJS_WASM_PATH__ = path.join(
  process.cwd(),
  "node_modules",
  "sql.js",
  "dist",
  "sql-wasm.wasm"
)

// 重置数据库，保证每个用例独立
async function resetDatabase() {
  const tables = [
    "node_results",
    "executions",
    "workflow_versions",
    "nodes",
    "workflows",
    "settings",
    "setting_prompts",
    "projects",
  ]

  for (const table of tables) {
    await client.execute(`DELETE FROM ${table}`)
  }

  await client.execute(
    `INSERT OR IGNORE INTO global_config (id, ai_providers, theme) VALUES (1, '{}', 'system')`
  )
  await client.execute(
    `UPDATE global_config SET ai_providers = '{}', theme = 'system', default_loop_max = 10, default_timeout = 300 WHERE id = 1`
  )
}

beforeAll(async () => {
  if (typeof window !== "undefined") {
    delete (window as any).__TAURI_INTERNALS__
  }

  vi.resetModules()
  db = await import("@/lib/db")
  client = await db.getDatabase()
  await resetDatabase()
})

beforeEach(async () => {
  await resetDatabase()
})

describe("lib/db - 数据库连接", () => {
  it("getDatabase 应该复用同一客户端并正常读写", async () => {
    const first = await db.getDatabase()
    const second = await db.getDatabase()
    expect(first).toBe(second)

    await first.execute(
      "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
      ["p1", "项目A", "now", "now"]
    )
    const projects = await first.select<any[]>(
      "SELECT * FROM projects WHERE id = ?",
      ["p1"]
    )
    expect(projects[0].name).toBe("项目A")
  })
})

describe("lib/db - 项目与工作流", () => {
  it("项目 CRUD 应该生效并级联删除工作流", async () => {
    const project = await db.createProject("项目", "描述")
    await db.updateProject(project.id, { name: "新名字", description: "" })

    const saved = await db.getProject(project.id)
    expect(saved?.name).toBe("新名字")
    expect(saved?.description).toBeNull()

    const workflow = await db.createWorkflow(project.id, "工作流")
    await db.deleteProject(project.id)

    const deletedProject = await db.getProject(project.id)
    const deletedWorkflow = await db.getWorkflow(workflow.id)
    expect(deletedProject).toBeNull()
      expect(deletedWorkflow).toBeNull()
  })

  it("工作流创建应自动包含开始节点且重排时保持首位", async () => {
    const project = await db.createProject("项目")
    const workflow = await db.createWorkflow(project.id, "流程")
    const nodesAfterCreate = await db.getNodes(workflow.id)
    expect(nodesAfterCreate[0].type).toBe("start")

    const node1 = await db.createNode(workflow.id, "ai_chat", "节点1")
    const node2 = await db.createNode(workflow.id, "output", "节点2")

    // 传入的顺序不包含 start，逻辑会自动把开始节点放到第一位
    await db.reorderNodes(workflow.id, [node2.id, node1.id])
    const reordered = await db.getNodes(workflow.id)
      expect(reordered[0].type).toBe("start")
    expect(reordered[1].id).toBe(node2.id)
    expect(reordered[2].id).toBe(node1.id)
  })

  it("restoreNodes 应该清空旧节点并用新节点替换", async () => {
    const project = await db.createProject("项目")
    const workflow = await db.createWorkflow(project.id, "流程")
    await db.createNode(workflow.id, "ai_chat", "旧节点")

    const restored = await db.restoreNodes(workflow.id, [
      {
        type: "variable",
        name: "新节点A",
        config: { a: 1 },
        order_index: 0,
      },
      {
        type: "output",
        name: "新节点B",
        config: { b: 2 },
        order_index: 1,
      },
    ])

    const nodes = await db.getNodes(workflow.id)
    expect(nodes).toHaveLength(2)
    expect(nodes.map((n) => n.name)).toEqual(["新节点A", "新节点B"])
    expect(restored.every((n) => n.id !== nodes[0].id)).toBe(false)
  })
})

describe("lib/db - 节点操作", () => {
  it("createNode 应支持插入指定位置并更新配置", async () => {
    const project = await db.createProject("项目")
    const workflow = await db.createWorkflow(project.id, "流程")
    await db.createNode(workflow.id, "ai_chat", "节点1")
    await db.createNode(workflow.id, "ai_chat", "节点2")

    await db.createNode(
      workflow.id,
      "variable",
      "插入节点",
      {},
      { insert_after_index: 0, block_id: "block-1", parent_block_id: "parent-1" }
    )
    const nodes = await db.getNodes(workflow.id)
    expect(nodes[1].name).toBe("插入节点")
    expect(nodes[1].block_id).toBe("block-1")
    expect(nodes[1].parent_block_id).toBe("parent-1")

    await db.updateNode(nodes[1].id, { config: { foo: "bar" }, name: "新名称" })
    const updated = await db.getNode(nodes[1].id)
    expect(updated?.config).toEqual({ foo: "bar" })
    expect(updated?.name).toBe("新名称")
  })
})

describe("lib/db - 设定与提示词", () => {
  it("设定查询应支持模糊搜索与启用状态更新", async () => {
    const project = await db.createProject("项目")
    const settingA = await db.createSetting(project.id, "character", "角色A", "描述A")
    await db.createSetting(project.id, "worldview", "世界观", "含角色")

    const all = await db.getSettings(project.id, "角色")
    expect(all).toHaveLength(2)

    await db.updateSetting(settingA.id, { enabled: false, content: "新内容" })
    const updated = await db.getSettings(project.id)
    const target = updated.find((s) => s.id === settingA.id)
    expect(target?.enabled).toBe(false)
    expect(target?.content).toBe("新内容")
  })

  it("upsertSettingPrompt 应在存在时更新，否则创建", async () => {
    const project = await db.createProject("项目")
    const created = await db.upsertSettingPrompt(project.id, "character", "模板1")
    expect(created.prompt_template).toBe("模板1")

    const updated = await db.upsertSettingPrompt(project.id, "character", "模板2")
    expect(updated.id).toBe(created.id)
    expect(updated.prompt_template).toBe("模板2")
  })
})

describe("lib/db - 全局配置", () => {
  it("默认配置应包含预设模型列表并可更新", async () => {
    const config = await db.getGlobalConfig()
    expect(config.ai_providers.openai.enabled_models.length).toBeGreaterThan(0)

    await db.updateGlobalConfig({
      theme: "dark",
      ai_providers: {
        ...config.ai_providers,
        openai: { ...config.ai_providers.openai, enabled: true, api_key: "sk-test" },
      },
      default_loop_max: 20,
    })

    const updated = await db.getGlobalConfig()
    expect(updated.theme).toBe("dark")
    expect(updated.ai_providers.openai.enabled).toBe(true)
    expect(updated.default_loop_max).toBe(20)
  })
})

describe("lib/db - 执行与节点结果", () => {
  it("执行与节点结果应正确保存、解析与级联删除", async () => {
    const project = await db.createProject("项目")
    const workflow = await db.createWorkflow(project.id, "流程")
    const execution = await db.createExecution(workflow.id, "输入")
    const startNode = (await db.getNodes(workflow.id))[0]
    const nodeResult = await db.createNodeResult(execution.id, startNode.id, 2)

    await db.updateExecution(execution.id, {
      status: "completed",
      final_output: "结果",
      variables_snapshot: { x: 1 },
      finished_at: new Date().toISOString(),
    })
    await db.updateNodeResult(nodeResult.id, {
      input: "in",
      output: "out",
      resolved_config: { prompt: "p" },
        status: "completed",
        finished_at: new Date().toISOString(),
      })

    const executions = await db.getExecutions(workflow.id)
    expect(executions[0].variables_snapshot).toEqual({ x: 1 })

    const results = await db.getNodeResults(execution.id)
    expect(results[0].iteration).toBe(2)
    expect(results[0].resolved_config).toEqual({ prompt: "p" })

    await db.deleteExecution(execution.id)
    expect(await db.getExecutions(workflow.id)).toHaveLength(0)
    expect(await db.getNodeResults(execution.id)).toHaveLength(0)
  })
})

describe("lib/db - 统计", () => {
  it("全局与项目统计应反映当前数据", async () => {
    const project = await db.createProject("项目")
    const workflow = await db.createWorkflow(project.id, "流程")
    const node = (await db.getNodes(workflow.id))[0]
    const execution = await db.createExecution(workflow.id)
    await db.createNodeResult(execution.id, node.id)
    await db.updateNodeResult(
      (await db.getNodeResults(execution.id))[0].id,
      { output: "你好世界" }
    )

    await db.createSetting(project.id, "character", "角色", "描述")
    await db.createSetting(project.id, "worldview", "世界", "描述")

    const globalStats = await db.getGlobalStats()
    expect(globalStats.active_projects).toBe(1)
    expect(globalStats.today_word_count).toBeGreaterThan(0)

    const projectStats = await db.getProjectStats(project.id)
    expect(projectStats.character_count).toBe(1)
    expect(projectStats.workflow_count).toBe(1)
    expect(projectStats.total_word_count).toBeGreaterThan(0)
  })
})

describe("lib/db - 导入导出", () => {
  it("export/import workflow 应保持节点顺序并复制 block 关系", async () => {
    const project = await db.createProject("项目A")
    const workflow = await db.createWorkflow(project.id, "原流程")
    const loopNode = await db.createNode(
      workflow.id,
      "loop_start",
      "循环",
      { loop: true },
      { block_id: "block-a" }
    )
    await db.createNode(
      workflow.id,
      "loop_end",
      "结束",
      {},
      { parent_block_id: loopNode.block_id }
    )

    const exported = await db.exportWorkflow(workflow.id)
    const targetProject = await db.createProject("项目B")
    const imported = await db.importWorkflow(targetProject.id, exported!, "新流程")

    const nodes = await db.getNodes(imported.id)
    expect(nodes.map((n) => n.order_index)).toEqual([0, 1, 2])
    expect(nodes[1].block_id).toBeDefined()
    expect(nodes[2].parent_block_id).toBe(nodes[1].block_id)
  })

  it("export/import settings 应支持替换模式并跳过 merge 冲突", async () => {
    const projectA = await db.createProject("项目A")
    await db.createSetting(projectA.id, "character", "角色A", "描述A")
    await db.createSettingPrompt(projectA.id, "character", "模板A")

    const data = await db.exportSettings(projectA.id)

    const projectB = await db.createProject("项目B")
    await db.createSetting(projectB.id, "character", "旧", "旧内容")
    await db.importSettings(projectB.id, data, "replace")

    const importedSettings = await db.getSettings(projectB.id)
    expect(importedSettings).toHaveLength(1)
    const prompts = await db.getSettingPrompts(projectB.id)
    expect(prompts[0].prompt_template).toBe("模板A")
  })

  it("export/import project 应复制工作流与设定", async () => {
    const source = await db.createProject("源项目", "描述")
    const workflow = await db.createWorkflow(source.id, "源工作流")
    await db.createNode(workflow.id, "ai_chat", "节点X")
    await db.createSetting(source.id, "character", "角色", "描述")

    const backup = await db.exportProject(source.id)
    const restored = await db.importProject(backup!, "恢复后的项目")

    const workflows = await db.getWorkflows(restored.id)
    expect(workflows).toHaveLength(1)
    const settings = await db.getSettings(restored.id)
    expect(settings).toHaveLength(1)
  })
})

describe("lib/db - 工作流版本", () => {
  it("版本创建、恢复与清理应工作正常", async () => {
    const project = await db.createProject("项目")
    const workflow = await db.createWorkflow(project.id, "流程")
    const v1 = await db.createWorkflowVersion(workflow.id, "v1")
    await db.createNode(workflow.id, "ai_chat", "节点")
    const v2 = await db.createWorkflowVersion(workflow.id, "v2")

    const versions = await db.getWorkflowVersions(workflow.id)
    expect(versions[0].version_number).toBe(2)

    await db.restoreWorkflowVersion(v1.id)
    const nodesAfterRestore = await db.getNodes(workflow.id)
    expect(nodesAfterRestore).toHaveLength(1) // 恢复到只有开始节点

    await db.cleanupOldVersions(workflow.id, 1)
    const cleaned = await db.getWorkflowVersions(workflow.id)
    expect(cleaned).toHaveLength(1)

    await db.deleteWorkflowVersion(cleaned[0].id)
    expect(await db.getWorkflowVersions(workflow.id)).toHaveLength(0)
  })
})

