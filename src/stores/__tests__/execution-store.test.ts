// execution-store.ts 测试
// 测试执行 Store 的所有功能

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { useExecutionStore } from "../execution-store"
import type { Workflow, WorkflowNode, GlobalConfig, Setting, SettingPrompt } from "@/types"

// Mock WorkflowExecutor 实例方法
const mockExecutorInstance = {
  execute: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  cancel: vi.fn(),
  modifyNodeOutput: vi.fn(),
  getContext: vi.fn(() => ({
    createSnapshot: vi.fn(() => ({ variables: {} })),
  })),
}

// 使用 class 语法正确 mock 构造函数
vi.mock("@/lib/engine", () => {
  const MockWorkflowExecutor = vi.fn(function (this: any) {
    Object.assign(this, mockExecutorInstance)
    return this
  })
  return {
    WorkflowExecutor: MockWorkflowExecutor,
    executorStatusToDbStatus: vi.fn((status: string) => status),
  }
})

// Mock 数据库模块
vi.mock("@/lib/db", () => ({
  createExecution: vi.fn(),
  updateExecution: vi.fn(),
  createNodeResult: vi.fn(),
  updateNodeResult: vi.fn(),
}))

// 导入 mock 后的模块
import * as db from "@/lib/db"
import { WorkflowExecutor } from "@/lib/engine"

// ========== 测试数据工厂 ==========

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

function createMockGlobalConfig(): GlobalConfig {
  return {
    id: 1,
    ai_providers: {
      openai: { api_key: "test-key", enabled: true, enabled_models: [], custom_models: [] },
      gemini: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
    },
    theme: "system",
    default_loop_max: 10,
    default_timeout: 300,
  }
}

// ========== 初始状态测试 ==========

describe("ExecutionStore - 初始状态", () => {
  beforeEach(() => {
    useExecutionStore.getState().reset()
    vi.clearAllMocks()
  })

  it("应该有正确的初始状态", () => {
    const state = useExecutionStore.getState()

    expect(state.executor).toBeNull()
    expect(state.status).toBe("idle")
    expect(state.executionId).toBeNull()
    expect(state.currentNodeIndex).toBeNull()
    expect(state.nodeStates).toEqual([])
    expect(state.nodeOutputs).toEqual([])
    expect(state.finalOutput).toBe("")
    expect(state.streamingContent).toBe("")
    expect(state.streamingNodeId).toBeNull()
    expect(state.error).toBeNull()
    expect(state.elapsedSeconds).toBe(0)
  })
})

// ========== 执行控制测试 ==========

describe("ExecutionStore - 执行控制", () => {
  beforeEach(() => {
    useExecutionStore.getState().reset()
    vi.clearAllMocks()
  })

  describe("startExecution", () => {
    it("应该启动执行并创建执行记录", async () => {
      const workflow = createMockWorkflow({ id: "workflow-1" })
      const nodes = [createMockNode()]
      const globalConfig = createMockGlobalConfig()
      const execution = { id: "execution-1", workflow_id: "workflow-1", status: "running", started_at: new Date().toISOString() }

      vi.mocked(db.createExecution).mockResolvedValue(execution as any)
      mockExecutorInstance.execute.mockResolvedValue({
        status: "completed",
        output: "执行结果",
        nodeStates: [],
        elapsedSeconds: 5,
      })

      await useExecutionStore.getState().startExecution(workflow, nodes, globalConfig, "初始输入")

      expect(db.createExecution).toHaveBeenCalledWith("workflow-1", "初始输入")
      expect(WorkflowExecutor).toHaveBeenCalled()
    })

    it("应该取消已有的执行器", async () => {
      // 设置一个已存在的 executor
      useExecutionStore.setState({ executor: mockExecutorInstance as any })

      const workflow = createMockWorkflow()
      const nodes = [createMockNode()]
      const globalConfig = createMockGlobalConfig()
      const execution = { id: "execution-1", workflow_id: "workflow-1", status: "running", started_at: new Date().toISOString() }

      vi.mocked(db.createExecution).mockResolvedValue(execution as any)
      mockExecutorInstance.execute.mockResolvedValue({
        status: "completed",
        output: "",
        nodeStates: [],
        elapsedSeconds: 0,
      })

      await useExecutionStore.getState().startExecution(workflow, nodes, globalConfig)

      expect(mockExecutorInstance.cancel).toHaveBeenCalled()
    })

    it("应该重置执行状态", async () => {
      // 设置一些已存在的状态
      useExecutionStore.setState({
        status: "completed",
        finalOutput: "旧输出",
        error: "旧错误",
        nodeOutputs: [{ nodeId: "1", nodeName: "节点", nodeType: "start", output: "输出", isRunning: false, isStreaming: false }],
      })

      const workflow = createMockWorkflow()
      const nodes = [createMockNode()]
      const globalConfig = createMockGlobalConfig()
      const execution = { id: "execution-1", workflow_id: "workflow-1", status: "running", started_at: new Date().toISOString() }

      vi.mocked(db.createExecution).mockResolvedValue(execution as any)
      mockExecutorInstance.execute.mockResolvedValue({
        status: "completed",
        output: "新输出",
        nodeStates: [],
        elapsedSeconds: 0,
      })

      await useExecutionStore.getState().startExecution(workflow, nodes, globalConfig)

      // 执行完成后检查状态
      const state = useExecutionStore.getState()
      expect(state.finalOutput).toBe("新输出")
      expect(state.error).toBeNull()
    })

    it("应该处理执行失败", async () => {
      const workflow = createMockWorkflow()
      const nodes = [createMockNode()]
      const globalConfig = createMockGlobalConfig()
      const execution = { id: "execution-1", workflow_id: "workflow-1", status: "running", started_at: new Date().toISOString() }

      vi.mocked(db.createExecution).mockResolvedValue(execution as any)
      mockExecutorInstance.execute.mockRejectedValue(new Error("执行出错"))

      await useExecutionStore.getState().startExecution(workflow, nodes, globalConfig)

      const state = useExecutionStore.getState()
      expect(state.status).toBe("failed")
      expect(state.error).toBe("执行出错")
      expect(db.updateExecution).toHaveBeenCalledWith("execution-1", expect.objectContaining({
        status: "failed",
      }))
    })

    it("应该传递设定和设定提示词", async () => {
      const workflow = createMockWorkflow()
      const nodes = [createMockNode()]
      const globalConfig = createMockGlobalConfig()
      const settings: Setting[] = [
        {
          id: "setting-1",
          project_id: "project-1",
          category: "character",
          name: "角色1",
          content: "角色描述",
          enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]
      const settingPrompts: SettingPrompt[] = [
        {
          id: "prompt-1",
          project_id: "project-1",
          category: "character",
          prompt_template: "模板",
          enabled: true,
        },
      ]
      const execution = { id: "execution-1", workflow_id: "workflow-1", status: "running", started_at: new Date().toISOString() }

      vi.mocked(db.createExecution).mockResolvedValue(execution as any)
      mockExecutorInstance.execute.mockResolvedValue({
        status: "completed",
        output: "",
        nodeStates: [],
        elapsedSeconds: 0,
      })

      await useExecutionStore.getState().startExecution(
        workflow,
        nodes,
        globalConfig,
        "输入",
        settings,
        settingPrompts
      )

      expect(WorkflowExecutor).toHaveBeenCalledWith(
        expect.objectContaining({
          settings,
          settingPrompts,
        })
      )
    })
  })

  describe("pauseExecution", () => {
    it("应该暂停执行", () => {
      useExecutionStore.setState({ executor: mockExecutorInstance as any, status: "running" })

      useExecutionStore.getState().pauseExecution()

      expect(mockExecutorInstance.pause).toHaveBeenCalled()
      expect(useExecutionStore.getState().status).toBe("paused")
    })

    it("应该在没有执行器时不执行操作", () => {
      useExecutionStore.setState({ executor: null })

      useExecutionStore.getState().pauseExecution()

      expect(mockExecutorInstance.pause).not.toHaveBeenCalled()
    })
  })

  describe("resumeExecution", () => {
    it("应该继续执行", () => {
      useExecutionStore.setState({ executor: mockExecutorInstance as any, status: "paused" })

      useExecutionStore.getState().resumeExecution()

      expect(mockExecutorInstance.resume).toHaveBeenCalled()
      expect(useExecutionStore.getState().status).toBe("running")
    })

    it("应该在没有执行器时不执行操作", () => {
      useExecutionStore.setState({ executor: null })

      useExecutionStore.getState().resumeExecution()

      expect(mockExecutorInstance.resume).not.toHaveBeenCalled()
    })
  })

  describe("cancelExecution", () => {
    it("应该取消执行并更新数据库", () => {
      useExecutionStore.setState({
        executor: mockExecutorInstance as any,
        executionId: "execution-1",
        status: "running",
      })

      useExecutionStore.getState().cancelExecution()

      expect(mockExecutorInstance.cancel).toHaveBeenCalled()
      expect(useExecutionStore.getState().status).toBe("cancelled")
      expect(db.updateExecution).toHaveBeenCalledWith("execution-1", expect.objectContaining({
        status: "cancelled",
      }))
    })

    it("应该在没有执行 ID 时不更新数据库", () => {
      useExecutionStore.setState({
        executor: mockExecutorInstance as any,
        executionId: null,
        status: "running",
      })

      useExecutionStore.getState().cancelExecution()

      expect(mockExecutorInstance.cancel).toHaveBeenCalled()
      expect(db.updateExecution).not.toHaveBeenCalled()
    })
  })

  describe("modifyNodeOutput", () => {
    it("应该修改节点输出", () => {
      useExecutionStore.setState({
        executor: mockExecutorInstance as any,
        nodeOutputs: [
          { nodeId: "node-1", nodeName: "节点1", nodeType: "ai_chat", output: "旧输出", isRunning: false, isStreaming: false },
        ],
      })

      useExecutionStore.getState().modifyNodeOutput("node-1", "新输出")

      expect(mockExecutorInstance.modifyNodeOutput).toHaveBeenCalledWith("node-1", "新输出")
      const output = useExecutionStore.getState().nodeOutputs.find((o) => o.nodeId === "node-1")
      expect(output?.output).toBe("新输出")
    })

    it("应该在没有执行器时不执行操作", () => {
      useExecutionStore.setState({ executor: null })

      useExecutionStore.getState().modifyNodeOutput("node-1", "新输出")

      expect(mockExecutorInstance.modifyNodeOutput).not.toHaveBeenCalled()
    })

    it("应该处理修改失败", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      mockExecutorInstance.modifyNodeOutput.mockImplementation(() => {
        throw new Error("修改失败")
      })
      useExecutionStore.setState({
        executor: mockExecutorInstance as any,
        nodeOutputs: [],
      })

      useExecutionStore.getState().modifyNodeOutput("node-1", "新输出")

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
      mockExecutorInstance.modifyNodeOutput.mockReset()
    })
  })

  describe("reset", () => {
    it("应该重置所有状态", () => {
      useExecutionStore.setState({
        executor: mockExecutorInstance as any,
        status: "completed",
        executionId: "execution-1",
        currentNodeIndex: 5,
        nodeStates: [{ nodeId: "1", status: "completed" } as any],
        nodeOutputs: [{ nodeId: "1", nodeName: "节点", nodeType: "start", output: "输出", isRunning: false, isStreaming: false }],
        finalOutput: "最终输出",
        streamingContent: "流式内容",
        streamingNodeId: "node-1",
        error: "错误信息",
        elapsedSeconds: 100,
      })

      useExecutionStore.getState().reset()

      expect(mockExecutorInstance.cancel).toHaveBeenCalled()
      
      const state = useExecutionStore.getState()
      expect(state.executor).toBeNull()
      expect(state.status).toBe("idle")
      expect(state.executionId).toBeNull()
      expect(state.currentNodeIndex).toBeNull()
      expect(state.nodeStates).toEqual([])
      expect(state.nodeOutputs).toEqual([])
      expect(state.finalOutput).toBe("")
      expect(state.streamingContent).toBe("")
      expect(state.streamingNodeId).toBeNull()
      expect(state.error).toBeNull()
      expect(state.elapsedSeconds).toBe(0)
    })

    it("应该在没有执行器时安全重置", () => {
      useExecutionStore.setState({ executor: null })

      // 不应该抛出错误
      expect(() => useExecutionStore.getState().reset()).not.toThrow()
    })
  })
})

// ========== 状态更新测试 ==========

describe("ExecutionStore - 状态更新", () => {
  beforeEach(() => {
    useExecutionStore.getState().reset()
    vi.clearAllMocks()
  })

  it("应该正确更新执行结果状态", async () => {
    const workflow = createMockWorkflow()
    const nodes = [createMockNode()]
    const globalConfig = createMockGlobalConfig()
    const execution = { id: "execution-1", workflow_id: "workflow-1", status: "running", started_at: new Date().toISOString() }

    vi.mocked(db.createExecution).mockResolvedValue(execution as any)
    mockExecutorInstance.execute.mockResolvedValue({
      status: "completed",
      output: "最终结果",
      nodeStates: [{ nodeId: "node-1", status: "completed" }],
      elapsedSeconds: 10,
      error: null,
    })

    await useExecutionStore.getState().startExecution(workflow, nodes, globalConfig)

    const state = useExecutionStore.getState()
    expect(state.status).toBe("completed")
    expect(state.finalOutput).toBe("最终结果")
    expect(state.nodeStates).toHaveLength(1)
    expect(state.elapsedSeconds).toBe(10)
    expect(state.error).toBeNull()
  })

  it("应该正确处理执行错误状态", async () => {
    const workflow = createMockWorkflow()
    const nodes = [createMockNode()]
    const globalConfig = createMockGlobalConfig()
    const execution = { id: "execution-1", workflow_id: "workflow-1", status: "running", started_at: new Date().toISOString() }

    vi.mocked(db.createExecution).mockResolvedValue(execution as any)
    mockExecutorInstance.execute.mockResolvedValue({
      status: "failed",
      output: "",
      nodeStates: [],
      elapsedSeconds: 5,
      error: "节点执行失败",
    })

    await useExecutionStore.getState().startExecution(workflow, nodes, globalConfig)

    const state = useExecutionStore.getState()
    expect(state.status).toBe("failed")
    expect(state.error).toBe("节点执行失败")
  })
})

// ========== 边界情况测试 ==========

describe("ExecutionStore - 边界情况", () => {
  beforeEach(() => {
    useExecutionStore.getState().reset()
    vi.clearAllMocks()
  })

  it("应该处理空节点列表", async () => {
    const workflow = createMockWorkflow()
    const nodes: WorkflowNode[] = []
    const globalConfig = createMockGlobalConfig()
    const execution = { id: "execution-1", workflow_id: "workflow-1", status: "running", started_at: new Date().toISOString() }

    vi.mocked(db.createExecution).mockResolvedValue(execution as any)
    mockExecutorInstance.execute.mockResolvedValue({
      status: "completed",
      output: "",
      nodeStates: [],
      elapsedSeconds: 0,
    })

    await useExecutionStore.getState().startExecution(workflow, nodes, globalConfig)

    expect(WorkflowExecutor).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: [],
      })
    )
  })

  it("应该处理非 Error 类型的异常", async () => {
    const workflow = createMockWorkflow()
    const nodes = [createMockNode()]
    const globalConfig = createMockGlobalConfig()
    const execution = { id: "execution-1", workflow_id: "workflow-1", status: "running", started_at: new Date().toISOString() }

    vi.mocked(db.createExecution).mockResolvedValue(execution as any)
    mockExecutorInstance.execute.mockRejectedValue("字符串错误")

    await useExecutionStore.getState().startExecution(workflow, nodes, globalConfig)

    const state = useExecutionStore.getState()
    expect(state.status).toBe("failed")
    expect(state.error).toBe("字符串错误")
  })

  it("应该处理数据库创建执行记录失败", async () => {
    const workflow = createMockWorkflow()
    const nodes = [createMockNode()]
    const globalConfig = createMockGlobalConfig()

    vi.mocked(db.createExecution).mockRejectedValue(new Error("数据库错误"))

    // 应该抛出错误
    await expect(
      useExecutionStore.getState().startExecution(workflow, nodes, globalConfig)
    ).rejects.toThrow("数据库错误")
  })
})

