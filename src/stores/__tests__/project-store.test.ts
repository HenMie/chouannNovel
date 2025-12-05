// project-store.ts 测试
// 测试项目 Store 的所有功能

import { describe, it, expect, vi, beforeEach } from "vitest"
import { useProjectStore } from "../project-store"
import type { Project, Workflow, WorkflowNode } from "@/types"

// Mock 数据库模块
vi.mock("@/lib/db", () => ({
  getProjects: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  getGlobalStats: vi.fn(),
  getWorkflows: vi.fn(),
  createWorkflow: vi.fn(),
  updateWorkflow: vi.fn(),
  deleteWorkflow: vi.fn(),
  getProjectStats: vi.fn(),
  getNodes: vi.fn(),
  createNode: vi.fn(),
  updateNode: vi.fn(),
  deleteNode: vi.fn(),
  reorderNodes: vi.fn(),
  restoreNodes: vi.fn(),
  generateId: vi.fn(() => crypto.randomUUID()),
}))

// 导入 mock 后的模块
import * as db from "@/lib/db"

// ========== 测试数据工厂 ==========

function createMockProject(overrides?: Partial<Project>): Project {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: "测试项目",
    description: "项目描述",
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function createMockWorkflow(overrides?: Partial<Workflow>): Workflow {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    project_id: "project-1",
    name: "测试工作流",
    description: "工作流描述",
    loop_max_count: 10,
    timeout_seconds: 300,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function createMockNode(overrides?: Partial<WorkflowNode>): WorkflowNode {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    workflow_id: "workflow-1",
    type: "start",
    name: "开始流程",
    config: {},
    order_index: 0,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

// ========== 项目操作测试 ==========

describe("ProjectStore - 项目操作", () => {
  beforeEach(() => {
    // 重置 store 状态
    useProjectStore.setState({
      projects: [],
      currentProject: null,
      isLoadingProjects: false,
      globalStats: null,
      workflows: [],
      currentWorkflow: null,
      isLoadingWorkflows: false,
      projectStats: null,
      nodes: [],
      isLoadingNodes: false,
      copiedNode: null,
    })
    // 清理所有 mock
    vi.clearAllMocks()
  })

  describe("loadProjects", () => {
    it("应该加载项目列表", async () => {
      const mockProjects = [
        createMockProject({ id: "1", name: "项目1" }),
        createMockProject({ id: "2", name: "项目2" }),
      ]
      vi.mocked(db.getProjects).mockResolvedValue(mockProjects)

      await useProjectStore.getState().loadProjects()

      expect(db.getProjects).toHaveBeenCalledTimes(1)
      expect(useProjectStore.getState().projects).toEqual(mockProjects)
      expect(useProjectStore.getState().isLoadingProjects).toBe(false)
    })

    it("应该在加载时设置 loading 状态", async () => {
      vi.mocked(db.getProjects).mockImplementation(
        () =>
          new Promise((resolve) => {
            // 不立即 resolve，让我们能检查 loading 状态
            setTimeout(() => resolve([]), 10)
          })
      )

      const promise = useProjectStore.getState().loadProjects()

      // 检查加载中状态
      expect(useProjectStore.getState().isLoadingProjects).toBe(true)

      await promise

      // 加载完成后 loading 应为 false
      expect(useProjectStore.getState().isLoadingProjects).toBe(false)
    })

    it("应该在加载失败时处理错误", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      vi.mocked(db.getProjects).mockRejectedValue(new Error("加载失败"))

      await useProjectStore.getState().loadProjects()

      expect(consoleSpy).toHaveBeenCalled()
      expect(useProjectStore.getState().isLoadingProjects).toBe(false)
      consoleSpy.mockRestore()
    })
  })

  describe("createProject", () => {
    it("应该创建新项目并添加到列表", async () => {
      const newProject = createMockProject({ id: "new-id", name: "新项目" })
      vi.mocked(db.createProject).mockResolvedValue(newProject)

      const result = await useProjectStore.getState().createProject("新项目", "项目描述")

      expect(db.createProject).toHaveBeenCalledWith("新项目", "项目描述")
      expect(result).toEqual(newProject)
      expect(useProjectStore.getState().projects).toContainEqual(newProject)
    })

    it("应该将新项目添加到列表开头", async () => {
      const existingProject = createMockProject({ id: "existing", name: "已存在" })
      useProjectStore.setState({ projects: [existingProject] })

      const newProject = createMockProject({ id: "new", name: "新项目" })
      vi.mocked(db.createProject).mockResolvedValue(newProject)

      await useProjectStore.getState().createProject("新项目")

      const projects = useProjectStore.getState().projects
      expect(projects[0]).toEqual(newProject)
      expect(projects[1]).toEqual(existingProject)
    })
  })

  describe("updateProject", () => {
    it("应该更新项目信息", async () => {
      const project = createMockProject({ id: "1", name: "旧名称" })
      useProjectStore.setState({ projects: [project] })
      vi.mocked(db.updateProject).mockResolvedValue()

      await useProjectStore.getState().updateProject("1", { name: "新名称" })

      expect(db.updateProject).toHaveBeenCalledWith("1", { name: "新名称" })
      const updated = useProjectStore.getState().projects.find((p) => p.id === "1")
      expect(updated?.name).toBe("新名称")
    })

    it("应该同时更新 currentProject 如果 ID 匹配", async () => {
      const project = createMockProject({ id: "1", name: "旧名称" })
      useProjectStore.setState({
        projects: [project],
        currentProject: project,
      })
      vi.mocked(db.updateProject).mockResolvedValue()

      await useProjectStore.getState().updateProject("1", { name: "新名称" })

      expect(useProjectStore.getState().currentProject?.name).toBe("新名称")
    })
  })

  describe("deleteProject", () => {
    it("应该删除项目并从列表移除", async () => {
      const project = createMockProject({ id: "1" })
      useProjectStore.setState({ projects: [project] })
      vi.mocked(db.deleteProject).mockResolvedValue()

      await useProjectStore.getState().deleteProject("1")

      expect(db.deleteProject).toHaveBeenCalledWith("1")
      expect(useProjectStore.getState().projects).toHaveLength(0)
    })

    it("应该清空 currentProject 如果删除的是当前项目", async () => {
      const project = createMockProject({ id: "1" })
      useProjectStore.setState({
        projects: [project],
        currentProject: project,
        workflows: [createMockWorkflow()],
        currentWorkflow: createMockWorkflow(),
      })
      vi.mocked(db.deleteProject).mockResolvedValue()

      await useProjectStore.getState().deleteProject("1")

      expect(useProjectStore.getState().currentProject).toBeNull()
      expect(useProjectStore.getState().workflows).toHaveLength(0)
      expect(useProjectStore.getState().currentWorkflow).toBeNull()
    })
  })

  describe("setCurrentProject", () => {
    it("应该设置当前项目并清空关联状态", () => {
      const project = createMockProject({ id: "1" })
      useProjectStore.setState({
        workflows: [createMockWorkflow()],
        currentWorkflow: createMockWorkflow(),
        nodes: [createMockNode()],
        projectStats: { character_count: 1, worldview_count: 1, workflow_count: 1, total_word_count: 100 },
      })

      useProjectStore.getState().setCurrentProject(project)

      expect(useProjectStore.getState().currentProject).toEqual(project)
      expect(useProjectStore.getState().workflows).toHaveLength(0)
      expect(useProjectStore.getState().currentWorkflow).toBeNull()
      expect(useProjectStore.getState().nodes).toHaveLength(0)
      expect(useProjectStore.getState().projectStats).toBeNull()
    })

    it("应该支持设置为 null", () => {
      const project = createMockProject({ id: "1" })
      useProjectStore.setState({ currentProject: project })

      useProjectStore.getState().setCurrentProject(null)

      expect(useProjectStore.getState().currentProject).toBeNull()
    })
  })

  describe("loadGlobalStats", () => {
    it("应该加载全局统计数据", async () => {
      const mockStats = { active_projects: 5, today_word_count: 1000 }
      vi.mocked(db.getGlobalStats).mockResolvedValue(mockStats)

      await useProjectStore.getState().loadGlobalStats()

      expect(db.getGlobalStats).toHaveBeenCalled()
      expect(useProjectStore.getState().globalStats).toEqual(mockStats)
    })
  })
})

// ========== 工作流操作测试 ==========

describe("ProjectStore - 工作流操作", () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [],
      currentProject: createMockProject({ id: "project-1" }),
      isLoadingProjects: false,
      workflows: [],
      currentWorkflow: null,
      isLoadingWorkflows: false,
      nodes: [],
      isLoadingNodes: false,
      copiedNode: null,
    })
    vi.clearAllMocks()
  })

  describe("loadWorkflows", () => {
    it("应该加载指定项目的工作流列表", async () => {
      const mockWorkflows = [
        createMockWorkflow({ id: "1", name: "工作流1" }),
        createMockWorkflow({ id: "2", name: "工作流2" }),
      ]
      vi.mocked(db.getWorkflows).mockResolvedValue(mockWorkflows)

      await useProjectStore.getState().loadWorkflows("project-1")

      expect(db.getWorkflows).toHaveBeenCalledWith("project-1")
      expect(useProjectStore.getState().workflows).toEqual(mockWorkflows)
      expect(useProjectStore.getState().isLoadingWorkflows).toBe(false)
    })
  })

  describe("createWorkflow", () => {
    it("应该在有当前项目时创建工作流", async () => {
      const newWorkflow = createMockWorkflow({ id: "new-id", name: "新工作流" })
      vi.mocked(db.createWorkflow).mockResolvedValue(newWorkflow)

      const result = await useProjectStore.getState().createWorkflow("新工作流", "描述")

      expect(db.createWorkflow).toHaveBeenCalledWith("project-1", "新工作流", "描述")
      expect(result).toEqual(newWorkflow)
      expect(useProjectStore.getState().workflows).toContainEqual(newWorkflow)
    })

    it("应该在没有当前项目时返回 null", async () => {
      useProjectStore.setState({ currentProject: null })

      const result = await useProjectStore.getState().createWorkflow("新工作流")

      expect(db.createWorkflow).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })
  })

  describe("updateWorkflow", () => {
    it("应该更新工作流信息", async () => {
      const workflow = createMockWorkflow({ id: "1", name: "旧名称" })
      useProjectStore.setState({ workflows: [workflow] })
      vi.mocked(db.updateWorkflow).mockResolvedValue()

      await useProjectStore.getState().updateWorkflow("1", { name: "新名称" })

      expect(db.updateWorkflow).toHaveBeenCalledWith("1", { name: "新名称" })
      const updated = useProjectStore.getState().workflows.find((w) => w.id === "1")
      expect(updated?.name).toBe("新名称")
    })

    it("应该同时更新 currentWorkflow 如果 ID 匹配", async () => {
      const workflow = createMockWorkflow({ id: "1", name: "旧名称" })
      useProjectStore.setState({
        workflows: [workflow],
        currentWorkflow: workflow,
      })
      vi.mocked(db.updateWorkflow).mockResolvedValue()

      await useProjectStore.getState().updateWorkflow("1", { name: "新名称" })

      expect(useProjectStore.getState().currentWorkflow?.name).toBe("新名称")
    })
  })

  describe("deleteWorkflow", () => {
    it("应该删除工作流", async () => {
      const workflow = createMockWorkflow({ id: "1" })
      useProjectStore.setState({ workflows: [workflow] })
      vi.mocked(db.deleteWorkflow).mockResolvedValue()

      await useProjectStore.getState().deleteWorkflow("1")

      expect(db.deleteWorkflow).toHaveBeenCalledWith("1")
      expect(useProjectStore.getState().workflows).toHaveLength(0)
    })

    it("应该清空 currentWorkflow 和 nodes 如果删除的是当前工作流", async () => {
      const workflow = createMockWorkflow({ id: "1" })
      useProjectStore.setState({
        workflows: [workflow],
        currentWorkflow: workflow,
        nodes: [createMockNode()],
      })
      vi.mocked(db.deleteWorkflow).mockResolvedValue()

      await useProjectStore.getState().deleteWorkflow("1")

      expect(useProjectStore.getState().currentWorkflow).toBeNull()
      expect(useProjectStore.getState().nodes).toHaveLength(0)
    })
  })

  describe("setCurrentWorkflow", () => {
    it("应该设置当前工作流并清空节点", () => {
      const workflow = createMockWorkflow({ id: "1" })
      useProjectStore.setState({ nodes: [createMockNode()] })

      useProjectStore.getState().setCurrentWorkflow(workflow)

      expect(useProjectStore.getState().currentWorkflow).toEqual(workflow)
      expect(useProjectStore.getState().nodes).toHaveLength(0)
    })
  })
})

// ========== 节点操作测试 ==========

describe("ProjectStore - 节点操作", () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [],
      currentProject: createMockProject({ id: "project-1" }),
      isLoadingProjects: false,
      workflows: [],
      currentWorkflow: createMockWorkflow({ id: "workflow-1" }),
      isLoadingWorkflows: false,
      nodes: [],
      isLoadingNodes: false,
      copiedNode: null,
    })
    vi.clearAllMocks()
  })

  describe("loadNodes", () => {
    it("应该加载指定工作流的节点列表", async () => {
      const mockNodes = [
        createMockNode({ id: "1", name: "节点1", order_index: 0 }),
        createMockNode({ id: "2", name: "节点2", order_index: 1 }),
      ]
      vi.mocked(db.getNodes).mockResolvedValue(mockNodes)

      await useProjectStore.getState().loadNodes("workflow-1")

      expect(db.getNodes).toHaveBeenCalledWith("workflow-1")
      expect(useProjectStore.getState().nodes).toEqual(mockNodes)
      expect(useProjectStore.getState().isLoadingNodes).toBe(false)
    })
  })

  describe("createNode", () => {
    it("应该在有当前工作流时创建节点", async () => {
      const newNode = createMockNode({
        id: "new-id",
        type: "ai_chat",
        name: "AI 对话",
      })
      vi.mocked(db.createNode).mockResolvedValue(newNode)

      const result = await useProjectStore.getState().createNode("ai_chat", "AI 对话", {})

      expect(db.createNode).toHaveBeenCalledWith("workflow-1", "ai_chat", "AI 对话", {}, undefined)
      expect(result).toEqual(newNode)
      expect(useProjectStore.getState().nodes).toContainEqual(newNode)
    })

    it("应该在没有当前工作流时返回 null", async () => {
      useProjectStore.setState({ currentWorkflow: null })

      const result = await useProjectStore.getState().createNode("ai_chat", "AI 对话")

      expect(db.createNode).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it("应该支持传递 options 参数", async () => {
      const newNode = createMockNode({ id: "new-id", block_id: "block-1" })
      vi.mocked(db.createNode).mockResolvedValue(newNode)

      await useProjectStore.getState().createNode("loop_start", "循环开始", {}, {
        block_id: "block-1",
        insert_after_index: 2,
      })

      expect(db.createNode).toHaveBeenCalledWith("workflow-1", "loop_start", "循环开始", {}, {
        block_id: "block-1",
        insert_after_index: 2,
      })
    })
  })

  describe("updateNode", () => {
    it("应该更新节点信息", async () => {
      const node = createMockNode({ id: "1", name: "旧名称" })
      useProjectStore.setState({ nodes: [node] })
      vi.mocked(db.updateNode).mockResolvedValue()

      await useProjectStore.getState().updateNode("1", { name: "新名称" })

      expect(db.updateNode).toHaveBeenCalledWith("1", { name: "新名称" })
      const updated = useProjectStore.getState().nodes.find((n) => n.id === "1")
      expect(updated?.name).toBe("新名称")
    })
  })

  describe("deleteNode", () => {
    it("应该删除普通节点", async () => {
      const node = createMockNode({ id: "1", type: "ai_chat" })
      useProjectStore.setState({ nodes: [node] })
      vi.mocked(db.deleteNode).mockResolvedValue()

      await useProjectStore.getState().deleteNode("1")

      expect(db.deleteNode).toHaveBeenCalledWith("1")
      expect(useProjectStore.getState().nodes).toHaveLength(0)
    })

    it("应该删除控制结构的整个块（开始节点）", async () => {
      const blockId = "block-1"
      const loopStart = createMockNode({
        id: "1",
        type: "loop_start",
        block_id: blockId,
        order_index: 0,
      })
      const loopEnd = createMockNode({
        id: "2",
        type: "loop_end",
        block_id: blockId,
        order_index: 1,
      })
      useProjectStore.setState({ nodes: [loopStart, loopEnd] })
      vi.mocked(db.deleteNode).mockResolvedValue()

      await useProjectStore.getState().deleteNode("1")

      // 应该删除所有同一块的节点
      expect(db.deleteNode).toHaveBeenCalledTimes(2)
      expect(useProjectStore.getState().nodes).toHaveLength(0)
    })

    it("应该删除控制结构的整个块（结束节点）", async () => {
      const blockId = "block-1"
      const loopStart = createMockNode({
        id: "1",
        type: "loop_start",
        block_id: blockId,
        order_index: 0,
      })
      const loopEnd = createMockNode({
        id: "2",
        type: "loop_end",
        block_id: blockId,
        order_index: 1,
      })
      useProjectStore.setState({ nodes: [loopStart, loopEnd] })
      vi.mocked(db.deleteNode).mockResolvedValue()

      await useProjectStore.getState().deleteNode("2")

      // 删除结束节点也应该删除整个块
      expect(db.deleteNode).toHaveBeenCalledTimes(2)
      expect(useProjectStore.getState().nodes).toHaveLength(0)
    })
  })

  describe("reorderNodes", () => {
    it("应该重新排序节点", async () => {
      const nodes = [
        createMockNode({ id: "1", order_index: 0 }),
        createMockNode({ id: "2", order_index: 1 }),
        createMockNode({ id: "3", order_index: 2 }),
      ]
      useProjectStore.setState({ nodes })
      vi.mocked(db.reorderNodes).mockResolvedValue()

      const newOrder = ["1", "3", "2"]
      await useProjectStore.getState().reorderNodes(newOrder)

      expect(db.reorderNodes).toHaveBeenCalledWith("workflow-1", newOrder)
      
      const reorderedNodes = useProjectStore.getState().nodes
      expect(reorderedNodes[0].id).toBe("1")
      expect(reorderedNodes[0].order_index).toBe(0)
      expect(reorderedNodes[1].id).toBe("3")
      expect(reorderedNodes[1].order_index).toBe(1)
      expect(reorderedNodes[2].id).toBe("2")
      expect(reorderedNodes[2].order_index).toBe(2)
    })

    it("应该在没有当前工作流时不执行", async () => {
      useProjectStore.setState({ currentWorkflow: null })

      await useProjectStore.getState().reorderNodes(["1", "2"])

      expect(db.reorderNodes).not.toHaveBeenCalled()
    })
  })
})

// ========== 复制粘贴操作测试 ==========

describe("ProjectStore - 复制粘贴操作", () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [],
      currentProject: createMockProject({ id: "project-1" }),
      isLoadingProjects: false,
      workflows: [],
      currentWorkflow: createMockWorkflow({ id: "workflow-1" }),
      isLoadingWorkflows: false,
      nodes: [],
      isLoadingNodes: false,
      copiedNode: null,
    })
    vi.clearAllMocks()
  })

  describe("copyNode", () => {
    it("应该复制节点（不含 ID）", () => {
      const node = createMockNode({
        id: "1",
        type: "ai_chat",
        name: "AI 节点",
        config: { provider: "openai", model: "gpt-4" },
      })

      useProjectStore.getState().copyNode(node)

      const copied = useProjectStore.getState().copiedNode
      expect(copied).not.toBeNull()
      expect(copied?.type).toBe("ai_chat")
      expect(copied?.name).toBe("AI 节点")
      expect(copied?.config).toEqual({ provider: "openai", model: "gpt-4" })
    })

    it("应该深拷贝配置对象", () => {
      const config = { nested: { value: "test" } }
      const node = createMockNode({ config })

      useProjectStore.getState().copyNode(node)

      const copied = useProjectStore.getState().copiedNode
      // 修改原始配置不应影响复制的配置
      config.nested.value = "modified"
      expect((copied?.config as any).nested.value).toBe("test")
    })
  })

  describe("pasteNode", () => {
    it("应该粘贴节点并添加副本后缀", async () => {
      useProjectStore.setState({
        copiedNode: {
          type: "ai_chat",
          name: "AI 节点",
          config: { provider: "openai" },
        },
      })

      const newNode = createMockNode({
        id: "new-id",
        name: "AI 节点 (副本)",
        type: "ai_chat",
      })
      vi.mocked(db.createNode).mockResolvedValue(newNode)

      const result = await useProjectStore.getState().pasteNode()

      expect(db.createNode).toHaveBeenCalledWith(
        "workflow-1",
        "ai_chat",
        "AI 节点 (副本)",
        { provider: "openai" }
      )
      expect(result).toEqual(newNode)
    })

    it("应该在没有复制的节点时返回 null", async () => {
      const result = await useProjectStore.getState().pasteNode()

      expect(db.createNode).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it("应该在没有当前工作流时返回 null", async () => {
      useProjectStore.setState({
        currentWorkflow: null,
        copiedNode: {
          type: "ai_chat",
          name: "AI 节点",
          config: {},
        },
      })

      const result = await useProjectStore.getState().pasteNode()

      expect(db.createNode).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })
  })

  describe("hasCopiedNode", () => {
    it("应该返回 true 当有复制的节点时", () => {
      useProjectStore.setState({
        copiedNode: {
          type: "ai_chat",
          name: "AI 节点",
          config: {},
        },
      })

      expect(useProjectStore.getState().hasCopiedNode()).toBe(true)
    })

    it("应该返回 false 当没有复制的节点时", () => {
      expect(useProjectStore.getState().hasCopiedNode()).toBe(false)
    })

    it("应该返回 true 当有批量复制的节点时", () => {
      useProjectStore.setState({
        copiedNode: null,
        copiedNodes: {
          nodes: [
            { type: "ai_chat", name: "节点1", config: {} },
            { type: "output", name: "节点2", config: {} },
          ],
          sourceWorkflowId: "workflow-1",
        },
      })

      expect(useProjectStore.getState().hasCopiedNode()).toBe(true)
    })
  })
})

// ========== 批量复制粘贴测试 ==========

describe("ProjectStore - 批量复制粘贴", () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [],
      currentProject: createMockProject({ id: "project-1" }),
      isLoadingProjects: false,
      workflows: [],
      currentWorkflow: createMockWorkflow({ id: "workflow-1" }),
      isLoadingWorkflows: false,
      nodes: [],
      isLoadingNodes: false,
      copiedNode: null,
      copiedNodes: null,
    })
    vi.clearAllMocks()
  })

  describe("copyNodes", () => {
    it("应该批量复制节点（排除开始节点）", () => {
      const nodes = [
        createMockNode({ id: "1", type: "start", name: "开始流程" }),
        createMockNode({ id: "2", type: "ai_chat", name: "AI 节点" }),
        createMockNode({ id: "3", type: "output", name: "输出节点" }),
      ]

      useProjectStore.getState().copyNodes(nodes)

      const { copiedNodes, copiedNode } = useProjectStore.getState()
      expect(copiedNode).toBeNull() // 单个复制应被清除
      expect(copiedNodes).not.toBeNull()
      expect(copiedNodes?.nodes).toHaveLength(2)
      expect(copiedNodes?.nodes.map(n => n.type)).not.toContain("start")
      expect(copiedNodes?.sourceWorkflowId).toBe("workflow-1")
    })

    it("应该深拷贝配置对象", () => {
      const config = { nested: { value: "test" } }
      const nodes = [createMockNode({ id: "1", type: "ai_chat", config })]

      useProjectStore.getState().copyNodes(nodes)

      const { copiedNodes } = useProjectStore.getState()
      // 修改原始配置不应影响复制的配置
      config.nested.value = "modified"
      expect((copiedNodes?.nodes[0]?.config as any).nested.value).toBe("test")
    })

    it("应该清除单个复制的节点", () => {
      // 先复制单个节点
      useProjectStore.setState({
        copiedNode: { type: "ai_chat", name: "旧节点", config: {} },
      })

      const nodes = [createMockNode({ id: "1", type: "output", name: "新节点" })]
      useProjectStore.getState().copyNodes(nodes)

      expect(useProjectStore.getState().copiedNode).toBeNull()
      expect(useProjectStore.getState().copiedNodes).not.toBeNull()
    })

    it("应该在没有可复制节点时不操作（只有开始节点）", () => {
      const nodes = [createMockNode({ id: "1", type: "start", name: "开始流程" })]

      useProjectStore.getState().copyNodes(nodes)

      const { copiedNodes, copiedNode } = useProjectStore.getState()
      expect(copiedNodes).toBeNull()
      expect(copiedNode).toBeNull()
    })

    it("应该保留块 ID 信息", () => {
      const nodes = [
        createMockNode({
          id: "1",
          type: "loop_start",
          name: "循环开始",
          block_id: "block-1",
        }),
        createMockNode({
          id: "2",
          type: "loop_end",
          name: "循环结束",
          block_id: "block-1",
        }),
      ]

      useProjectStore.getState().copyNodes(nodes)

      const { copiedNodes } = useProjectStore.getState()
      expect(copiedNodes?.nodes[0].block_id).toBe("block-1")
      expect(copiedNodes?.nodes[1].block_id).toBe("block-1")
    })
  })

  describe("pasteNodes", () => {
    it("应该批量粘贴节点并添加副本后缀", async () => {
      useProjectStore.setState({
        copiedNodes: {
          nodes: [
            { type: "ai_chat", name: "AI 节点", config: {} },
            { type: "output", name: "输出节点", config: {} },
          ],
          sourceWorkflowId: "workflow-1",
        },
      })

      const newNode1 = createMockNode({ id: "new-1", name: "AI 节点 (副本)" })
      const newNode2 = createMockNode({ id: "new-2", name: "输出节点 (副本)" })
      vi.mocked(db.createNode)
        .mockResolvedValueOnce(newNode1)
        .mockResolvedValueOnce(newNode2)

      const result = await useProjectStore.getState().pasteNodes()

      expect(db.createNode).toHaveBeenCalledTimes(2)
      expect(result).toHaveLength(2)
      expect(useProjectStore.getState().nodes).toHaveLength(2)
    })

    it("应该在没有批量复制时粘贴单个节点", async () => {
      useProjectStore.setState({
        copiedNode: { type: "ai_chat", name: "AI 节点", config: {} },
        copiedNodes: null,
      })

      const newNode = createMockNode({ id: "new-1", name: "AI 节点 (副本)" })
      vi.mocked(db.createNode).mockResolvedValue(newNode)

      const result = await useProjectStore.getState().pasteNodes()

      expect(db.createNode).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(1)
    })

    it("应该在没有复制的节点时返回空数组", async () => {
      const result = await useProjectStore.getState().pasteNodes()

      expect(db.createNode).not.toHaveBeenCalled()
      expect(result).toHaveLength(0)
    })

    it("应该在没有当前工作流时返回空数组", async () => {
      useProjectStore.setState({
        currentWorkflow: null,
        copiedNodes: {
          nodes: [{ type: "ai_chat", name: "AI 节点", config: {} }],
          sourceWorkflowId: "workflow-1",
        },
      })

      const result = await useProjectStore.getState().pasteNodes()

      expect(db.createNode).not.toHaveBeenCalled()
      expect(result).toHaveLength(0)
    })

    it("应该在跨工作流粘贴时生成新的 block_id", async () => {
      useProjectStore.setState({
        currentWorkflow: createMockWorkflow({ id: "workflow-2" }), // 不同的工作流
        copiedNodes: {
          nodes: [
            { type: "loop_start", name: "循环开始", config: {}, block_id: "old-block-1" },
            { type: "loop_end", name: "循环结束", config: {}, block_id: "old-block-1" },
          ],
          sourceWorkflowId: "workflow-1", // 来自不同工作流
        },
      })

      const newNode1 = createMockNode({ id: "new-1", block_id: "new-block-1" })
      const newNode2 = createMockNode({ id: "new-2", block_id: "new-block-1" })
      vi.mocked(db.createNode)
        .mockResolvedValueOnce(newNode1)
        .mockResolvedValueOnce(newNode2)
      vi.mocked(db.generateId).mockReturnValue("new-block-1")

      await useProjectStore.getState().pasteNodes()

      // 两个节点应该使用相同的新 block_id
      expect(db.createNode).toHaveBeenCalledTimes(2)
      const calls = vi.mocked(db.createNode).mock.calls
      expect(calls[0][4]?.block_id).toBe("new-block-1")
      expect(calls[1][4]?.block_id).toBe("new-block-1")
    })

    it("应该在同工作流粘贴时保留原 block_id", async () => {
      useProjectStore.setState({
        currentWorkflow: createMockWorkflow({ id: "workflow-1" }),
        copiedNodes: {
          nodes: [
            { type: "loop_start", name: "循环开始", config: {}, block_id: "block-1" },
          ],
          sourceWorkflowId: "workflow-1", // 同一工作流
        },
      })

      const newNode = createMockNode({ id: "new-1", block_id: "block-1" })
      vi.mocked(db.createNode).mockResolvedValue(newNode)

      await useProjectStore.getState().pasteNodes()

      const calls = vi.mocked(db.createNode).mock.calls
      expect(calls[0][4]?.block_id).toBe("block-1")
    })
  })

  describe("hasCopiedNodes", () => {
    it("应该返回 true 当有批量复制的节点时", () => {
      useProjectStore.setState({
        copiedNodes: {
          nodes: [{ type: "ai_chat", name: "节点", config: {} }],
          sourceWorkflowId: "workflow-1",
        },
      })

      expect(useProjectStore.getState().hasCopiedNodes()).toBe(true)
    })

    it("应该返回 false 当没有批量复制的节点时", () => {
      expect(useProjectStore.getState().hasCopiedNodes()).toBe(false)
    })

    it("应该返回 false 当批量复制的节点为空数组时", () => {
      useProjectStore.setState({
        copiedNodes: {
          nodes: [],
          sourceWorkflowId: "workflow-1",
        },
      })

      expect(useProjectStore.getState().hasCopiedNodes()).toBe(false)
    })
  })

  describe("getCopiedCount", () => {
    it("应该返回批量复制的节点数量", () => {
      useProjectStore.setState({
        copiedNodes: {
          nodes: [
            { type: "ai_chat", name: "节点1", config: {} },
            { type: "output", name: "节点2", config: {} },
          ],
          sourceWorkflowId: "workflow-1",
        },
      })

      expect(useProjectStore.getState().getCopiedCount()).toBe(2)
    })

    it("应该返回 1 当只有单个复制的节点时", () => {
      useProjectStore.setState({
        copiedNode: { type: "ai_chat", name: "节点", config: {} },
        copiedNodes: null,
      })

      expect(useProjectStore.getState().getCopiedCount()).toBe(1)
    })

    it("应该返回 0 当没有复制的节点时", () => {
      expect(useProjectStore.getState().getCopiedCount()).toBe(0)
    })

    it("应该优先返回批量复制的数量", () => {
      useProjectStore.setState({
        copiedNode: { type: "ai_chat", name: "单个节点", config: {} }, // 不应计入
        copiedNodes: {
          nodes: [
            { type: "ai_chat", name: "节点1", config: {} },
            { type: "output", name: "节点2", config: {} },
            { type: "output", name: "节点3", config: {} },
          ],
          sourceWorkflowId: "workflow-1",
        },
      })

      expect(useProjectStore.getState().getCopiedCount()).toBe(3)
    })
  })
})

// ========== 批量删除测试 ==========

describe("ProjectStore - 批量删除节点", () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [],
      currentProject: createMockProject({ id: "project-1" }),
      isLoadingProjects: false,
      workflows: [],
      currentWorkflow: createMockWorkflow({ id: "workflow-1" }),
      isLoadingWorkflows: false,
      nodes: [],
      isLoadingNodes: false,
      copiedNode: null,
      copiedNodes: null,
    })
    vi.clearAllMocks()
  })

  describe("deleteNodes", () => {
    it("应该批量删除普通节点", async () => {
      const nodes = [
        createMockNode({ id: "1", type: "ai_chat" }),
        createMockNode({ id: "2", type: "output" }),
        createMockNode({ id: "3", type: "ai_chat" }),
      ]
      useProjectStore.setState({ nodes })
      vi.mocked(db.deleteNode).mockResolvedValue()

      await useProjectStore.getState().deleteNodes(["1", "2"])

      expect(db.deleteNode).toHaveBeenCalledTimes(2)
      expect(useProjectStore.getState().nodes).toHaveLength(1)
      expect(useProjectStore.getState().nodes[0].id).toBe("3")
    })

    it("应该删除块结构的所有关联节点", async () => {
      const blockId = "block-1"
      const nodes = [
        createMockNode({ id: "1", type: "ai_chat" }),
        createMockNode({ id: "2", type: "loop_start", block_id: blockId }),
        createMockNode({ id: "3", type: "ai_chat", parent_block_id: blockId }),
        createMockNode({ id: "4", type: "loop_end", block_id: blockId }),
        createMockNode({ id: "5", type: "output" }),
      ]
      useProjectStore.setState({ nodes })
      vi.mocked(db.deleteNode).mockResolvedValue()

      // 只选中循环开始节点，但应该删除整个块
      await useProjectStore.getState().deleteNodes(["2"])

      // 应该删除所有 block_id 为 block-1 的节点
      expect(db.deleteNode).toHaveBeenCalledTimes(2) // loop_start 和 loop_end
      expect(useProjectStore.getState().nodes).toHaveLength(3)
      expect(useProjectStore.getState().nodes.map(n => n.id)).toEqual(["1", "3", "5"])
    })

    it("应该处理多个块结构的批量删除", async () => {
      const nodes = [
        createMockNode({ id: "1", type: "loop_start", block_id: "block-1" }),
        createMockNode({ id: "2", type: "loop_end", block_id: "block-1" }),
        createMockNode({ id: "3", type: "parallel_start", block_id: "block-2" }),
        createMockNode({ id: "4", type: "parallel_end", block_id: "block-2" }),
      ]
      useProjectStore.setState({ nodes })
      vi.mocked(db.deleteNode).mockResolvedValue()

      // 选中两个块的开始节点
      await useProjectStore.getState().deleteNodes(["1", "3"])

      // 应该删除所有 4 个节点
      expect(db.deleteNode).toHaveBeenCalledTimes(4)
      expect(useProjectStore.getState().nodes).toHaveLength(0)
    })

    it("应该处理不存在的节点 ID", async () => {
      const nodes = [createMockNode({ id: "1", type: "ai_chat" })]
      useProjectStore.setState({ nodes })
      vi.mocked(db.deleteNode).mockResolvedValue()

      await useProjectStore.getState().deleteNodes(["non-existent", "1"])

      expect(db.deleteNode).toHaveBeenCalledTimes(1)
      expect(useProjectStore.getState().nodes).toHaveLength(0)
    })

    it("应该在空列表时不执行操作", async () => {
      const nodes = [createMockNode({ id: "1", type: "ai_chat" })]
      useProjectStore.setState({ nodes })

      await useProjectStore.getState().deleteNodes([])

      expect(db.deleteNode).not.toHaveBeenCalled()
      expect(useProjectStore.getState().nodes).toHaveLength(1)
    })
  })
})

// ========== 恢复节点测试 ==========

describe("ProjectStore - 恢复节点", () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [],
      currentProject: createMockProject({ id: "project-1" }),
      isLoadingProjects: false,
      workflows: [],
      currentWorkflow: createMockWorkflow({ id: "workflow-1" }),
      isLoadingWorkflows: false,
      nodes: [],
      isLoadingNodes: false,
      copiedNode: null,
      copiedNodes: null,
    })
    vi.clearAllMocks()
  })

  describe("restoreNodes", () => {
    it("应该恢复节点列表", async () => {
      const nodesToRestore = [
        createMockNode({ id: "old-1", type: "start", name: "开始流程", order_index: 0 }),
        createMockNode({ id: "old-2", type: "ai_chat", name: "AI 节点", order_index: 1 }),
      ]
      const restoredNodes = [
        createMockNode({ id: "new-1", type: "start", name: "开始流程", order_index: 0 }),
        createMockNode({ id: "new-2", type: "ai_chat", name: "AI 节点", order_index: 1 }),
      ]
      vi.mocked(db.restoreNodes).mockResolvedValue(restoredNodes)

      await useProjectStore.getState().restoreNodes(nodesToRestore)

      expect(db.restoreNodes).toHaveBeenCalledWith(
        "workflow-1",
        expect.arrayContaining([
          expect.objectContaining({ type: "start", name: "开始流程" }),
          expect.objectContaining({ type: "ai_chat", name: "AI 节点" }),
        ])
      )
      expect(useProjectStore.getState().nodes).toEqual(restoredNodes)
    })

    it("应该在没有当前工作流时不执行操作", async () => {
      useProjectStore.setState({ currentWorkflow: null })
      const nodesToRestore = [createMockNode({ id: "1", type: "start" })]

      await useProjectStore.getState().restoreNodes(nodesToRestore)

      expect(db.restoreNodes).not.toHaveBeenCalled()
    })

    it("应该保留块 ID 信息", async () => {
      const nodesToRestore = [
        createMockNode({
          id: "old-1",
          type: "loop_start",
          name: "循环开始",
          block_id: "block-1",
          order_index: 0,
        }),
        createMockNode({
          id: "old-2",
          type: "ai_chat",
          name: "AI 节点",
          parent_block_id: "block-1",
          order_index: 1,
        }),
        createMockNode({
          id: "old-3",
          type: "loop_end",
          name: "循环结束",
          block_id: "block-1",
          order_index: 2,
        }),
      ]
      vi.mocked(db.restoreNodes).mockResolvedValue(nodesToRestore)

      await useProjectStore.getState().restoreNodes(nodesToRestore)

      const callArgs = vi.mocked(db.restoreNodes).mock.calls[0][1]
      expect(callArgs[0].block_id).toBe("block-1")
      expect(callArgs[1].parent_block_id).toBe("block-1")
      expect(callArgs[2].block_id).toBe("block-1")
    })

    it("应该正确转换节点数据格式", async () => {
      const nodesToRestore = [
        createMockNode({
          id: "old-1",
          type: "ai_chat",
          name: "AI 节点",
          config: { provider: "openai", model: "gpt-4" },
          order_index: 0,
          block_id: "block-1",
          parent_block_id: "parent-block",
        }),
      ]
      vi.mocked(db.restoreNodes).mockResolvedValue([])

      await useProjectStore.getState().restoreNodes(nodesToRestore)

      const callArgs = vi.mocked(db.restoreNodes).mock.calls[0][1]
      expect(callArgs[0]).toEqual({
        type: "ai_chat",
        name: "AI 节点",
        config: { provider: "openai", model: "gpt-4" },
        order_index: 0,
        block_id: "block-1",
        parent_block_id: "parent-block",
      })
    })
  })
})

// ========== 错误处理测试 ==========

describe("ProjectStore - 错误处理", () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [],
      currentProject: createMockProject({ id: "project-1" }),
      isLoadingProjects: false,
      workflows: [],
      currentWorkflow: createMockWorkflow({ id: "workflow-1" }),
      isLoadingWorkflows: false,
      nodes: [],
      isLoadingNodes: false,
      copiedNode: null,
      copiedNodes: null,
    })
    vi.clearAllMocks()
  })

  describe("加载操作错误", () => {
    it("loadWorkflows 应该在失败时处理错误", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      vi.mocked(db.getWorkflows).mockRejectedValue(new Error("数据库错误"))

      await useProjectStore.getState().loadWorkflows("project-1")

      expect(consoleSpy).toHaveBeenCalled()
      expect(useProjectStore.getState().isLoadingWorkflows).toBe(false)
      consoleSpy.mockRestore()
    })

    it("loadNodes 应该在失败时处理错误", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      vi.mocked(db.getNodes).mockRejectedValue(new Error("数据库错误"))

      await useProjectStore.getState().loadNodes("workflow-1")

      expect(consoleSpy).toHaveBeenCalled()
      expect(useProjectStore.getState().isLoadingNodes).toBe(false)
      consoleSpy.mockRestore()
    })

    it("loadGlobalStats 应该在失败时处理错误", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      vi.mocked(db.getGlobalStats).mockRejectedValue(new Error("统计加载失败"))

      await useProjectStore.getState().loadGlobalStats()

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it("loadProjectStats 应该在失败时处理错误", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      vi.mocked(db.getProjectStats).mockRejectedValue(new Error("项目统计加载失败"))

      await useProjectStore.getState().loadProjectStats("project-1")

      expect(consoleSpy).toHaveBeenCalled()
      expect(useProjectStore.getState().projectStats).toBeNull()
      consoleSpy.mockRestore()
    })
  })

  describe("创建操作错误", () => {
    it("createProject 应该在失败时抛出错误", async () => {
      vi.mocked(db.createProject).mockRejectedValue(new Error("创建失败"))

      await expect(
        useProjectStore.getState().createProject("新项目")
      ).rejects.toThrow("创建失败")
    })

    it("createWorkflow 应该在失败时抛出错误", async () => {
      vi.mocked(db.createWorkflow).mockRejectedValue(new Error("创建工作流失败"))

      await expect(
        useProjectStore.getState().createWorkflow("新工作流")
      ).rejects.toThrow("创建工作流失败")
    })

    it("createNode 应该在失败时抛出错误", async () => {
      vi.mocked(db.createNode).mockRejectedValue(new Error("创建节点失败"))

      await expect(
        useProjectStore.getState().createNode("ai_chat", "AI 节点")
      ).rejects.toThrow("创建节点失败")
    })
  })

  describe("更新操作错误", () => {
    it("updateProject 应该在失败时抛出错误", async () => {
      vi.mocked(db.updateProject).mockRejectedValue(new Error("更新失败"))

      await expect(
        useProjectStore.getState().updateProject("1", { name: "新名称" })
      ).rejects.toThrow("更新失败")
    })

    it("updateWorkflow 应该在失败时抛出错误", async () => {
      vi.mocked(db.updateWorkflow).mockRejectedValue(new Error("更新工作流失败"))

      await expect(
        useProjectStore.getState().updateWorkflow("1", { name: "新名称" })
      ).rejects.toThrow("更新工作流失败")
    })

    it("updateNode 应该在失败时抛出错误", async () => {
      vi.mocked(db.updateNode).mockRejectedValue(new Error("更新节点失败"))

      await expect(
        useProjectStore.getState().updateNode("1", { name: "新名称" })
      ).rejects.toThrow("更新节点失败")
    })
  })

  describe("删除操作错误", () => {
    it("deleteProject 应该在失败时抛出错误", async () => {
      vi.mocked(db.deleteProject).mockRejectedValue(new Error("删除失败"))

      await expect(
        useProjectStore.getState().deleteProject("1")
      ).rejects.toThrow("删除失败")
    })

    it("deleteWorkflow 应该在失败时抛出错误", async () => {
      vi.mocked(db.deleteWorkflow).mockRejectedValue(new Error("删除工作流失败"))

      await expect(
        useProjectStore.getState().deleteWorkflow("1")
      ).rejects.toThrow("删除工作流失败")
    })

    it("deleteNode 应该在失败时抛出错误", async () => {
      useProjectStore.setState({
        nodes: [createMockNode({ id: "1", type: "ai_chat" })],
      })
      vi.mocked(db.deleteNode).mockRejectedValue(new Error("删除节点失败"))

      await expect(
        useProjectStore.getState().deleteNode("1")
      ).rejects.toThrow("删除节点失败")
    })

    it("deleteNodes 批量删除应该在失败时抛出错误", async () => {
      useProjectStore.setState({
        nodes: [
          createMockNode({ id: "1", type: "ai_chat" }),
          createMockNode({ id: "2", type: "output" }),
        ],
      })
      vi.mocked(db.deleteNode).mockRejectedValue(new Error("批量删除失败"))

      await expect(
        useProjectStore.getState().deleteNodes(["1", "2"])
      ).rejects.toThrow("批量删除失败")
    })
  })

  describe("其他操作错误", () => {
    it("reorderNodes 应该在失败时抛出错误", async () => {
      const nodes = [
        createMockNode({ id: "1", order_index: 0 }),
        createMockNode({ id: "2", order_index: 1 }),
      ]
      useProjectStore.setState({ nodes })
      vi.mocked(db.reorderNodes).mockRejectedValue(new Error("重排序失败"))

      await expect(
        useProjectStore.getState().reorderNodes(["2", "1"])
      ).rejects.toThrow("重排序失败")
    })

    it("restoreNodes 应该在失败时抛出错误", async () => {
      vi.mocked(db.restoreNodes).mockRejectedValue(new Error("恢复节点失败"))

      await expect(
        useProjectStore.getState().restoreNodes([createMockNode()])
      ).rejects.toThrow("恢复节点失败")
    })

    it("pasteNode 应该在失败时抛出错误", async () => {
      useProjectStore.setState({
        copiedNode: { type: "ai_chat", name: "AI 节点", config: {} },
      })
      vi.mocked(db.createNode).mockRejectedValue(new Error("粘贴失败"))

      await expect(
        useProjectStore.getState().pasteNode()
      ).rejects.toThrow("粘贴失败")
    })

    it("pasteNodes 应该在失败时抛出错误", async () => {
      useProjectStore.setState({
        copiedNodes: {
          nodes: [{ type: "ai_chat", name: "AI 节点", config: {} }],
          sourceWorkflowId: "workflow-1",
        },
      })
      vi.mocked(db.createNode).mockRejectedValue(new Error("批量粘贴失败"))

      await expect(
        useProjectStore.getState().pasteNodes()
      ).rejects.toThrow("批量粘贴失败")
    })
  })
})

