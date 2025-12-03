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
  })
})

