// execution-store.ts 测试
// 测试执行 Store 的所有功能

import { describe, it, expect, vi, beforeEach } from "vitest"
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
          parent_id: null,
          order_index: 0,
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

// ========== 执行事件处理测试 ==========

describe("ExecutionStore - 执行事件处理", () => {
  // 存储 onEvent 回调
  let capturedOnEvent: ((event: any) => void) | null = null

  beforeEach(() => {
    useExecutionStore.getState().reset()
    vi.clearAllMocks()
    capturedOnEvent = null

    // 重新配置 mock 以捕获 onEvent 回调
    vi.mocked(WorkflowExecutor).mockImplementation(function (this: any, config: any) {
      capturedOnEvent = config.onEvent
      Object.assign(this, mockExecutorInstance)
      return this
    })
  })

  async function setupExecution() {
    const workflow = createMockWorkflow({ id: "workflow-1" })
    const nodes = [createMockNode()]
    const globalConfig = createMockGlobalConfig()
    const execution = { id: "execution-1", workflow_id: "workflow-1", status: "running", started_at: new Date().toISOString() }

    vi.mocked(db.createExecution).mockResolvedValue(execution as any)
    vi.mocked(db.createNodeResult).mockResolvedValue({ id: "result-1" } as any)
    vi.mocked(db.updateNodeResult).mockResolvedValue()
    mockExecutorInstance.execute.mockImplementation(() => new Promise(() => {})) // 永不 resolve

    // 启动执行（不等待完成）
    useExecutionStore.getState().startExecution(workflow, nodes, globalConfig)

    // 等待 onEvent 被设置
    await new Promise(resolve => setTimeout(resolve, 10))
  }

  describe("node_started 事件", () => {
    it("应该添加新的节点输出并设置当前节点索引", async () => {
      await setupExecution()

      capturedOnEvent?.({
        type: "node_started",
        nodeId: "node-1",
        nodeName: "AI 节点",
        nodeType: "ai_chat",
      })

      // 等待异步事件处理
      await new Promise(resolve => setTimeout(resolve, 10))

      const state = useExecutionStore.getState()
      expect(state.currentNodeIndex).toBe(0)
      expect(state.streamingNodeId).toBe("node-1")
      expect(state.nodeOutputs).toHaveLength(1)
      expect(state.nodeOutputs[0]).toMatchObject({
        nodeId: "node-1",
        nodeName: "AI 节点",
        nodeType: "ai_chat",
        output: "",
        isRunning: true,
        isStreaming: false,
      })
    })

    it("应该创建节点结果记录", async () => {
      await setupExecution()

      capturedOnEvent?.({
        type: "node_started",
        nodeId: "node-1",
        nodeName: "AI 节点",
        nodeType: "ai_chat",
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(db.createNodeResult).toHaveBeenCalledWith("execution-1", "node-1")
    })
  })

  describe("node_streaming 事件", () => {
    it("应该更新流式输出内容", async () => {
      await setupExecution()

      // 先触发 node_started
      capturedOnEvent?.({
        type: "node_started",
        nodeId: "node-1",
        nodeName: "AI 节点",
        nodeType: "ai_chat",
      })
      await new Promise(resolve => setTimeout(resolve, 10))

      // 触发流式输出
      capturedOnEvent?.({
        type: "node_streaming",
        nodeId: "node-1",
        content: "正在生成内容...",
      })
      await new Promise(resolve => setTimeout(resolve, 10))

      const state = useExecutionStore.getState()
      expect(state.streamingContent).toBe("正在生成内容...")
      expect(state.nodeOutputs[0].output).toBe("正在生成内容...")
      expect(state.nodeOutputs[0].isStreaming).toBe(true)
    })
  })

  describe("node_completed 事件", () => {
    it("应该更新节点输出并标记完成", async () => {
      await setupExecution()

      // 先触发 node_started
      capturedOnEvent?.({
        type: "node_started",
        nodeId: "node-1",
        nodeName: "AI 节点",
        nodeType: "ai_chat",
      })
      await new Promise(resolve => setTimeout(resolve, 50))

      // 触发完成
      capturedOnEvent?.({
        type: "node_completed",
        nodeId: "node-1",
        content: "最终输出内容",
        resolvedConfig: { provider: "openai", model: "gpt-4" },
      })
      await new Promise(resolve => setTimeout(resolve, 10))

      const state = useExecutionStore.getState()
      expect(state.streamingContent).toBe("")
      expect(state.streamingNodeId).toBeNull()
      expect(state.nodeOutputs[0]).toMatchObject({
        output: "最终输出内容",
        isRunning: false,
        isStreaming: false,
        resolvedConfig: { provider: "openai", model: "gpt-4" },
      })
    })

    it("应该更新数据库中的节点结果", async () => {
      await setupExecution()

      capturedOnEvent?.({
        type: "node_started",
        nodeId: "node-1",
        nodeName: "AI 节点",
        nodeType: "ai_chat",
      })
      await new Promise(resolve => setTimeout(resolve, 50))

      capturedOnEvent?.({
        type: "node_completed",
        nodeId: "node-1",
        content: "输出内容",
        resolvedConfig: { model: "gpt-4" },
      })
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(db.updateNodeResult).toHaveBeenCalledWith(
        "result-1",
        expect.objectContaining({
          output: "输出内容",
          status: "completed",
          resolved_config: { model: "gpt-4" },
        })
      )
    })
  })

  describe("node_failed 事件", () => {
    it("应该设置错误状态", async () => {
      await setupExecution()

      capturedOnEvent?.({
        type: "node_started",
        nodeId: "node-1",
        nodeName: "AI 节点",
        nodeType: "ai_chat",
      })
      await new Promise(resolve => setTimeout(resolve, 50))

      capturedOnEvent?.({
        type: "node_failed",
        nodeId: "node-1",
        error: "API 调用失败",
      })
      await new Promise(resolve => setTimeout(resolve, 10))

      const state = useExecutionStore.getState()
      expect(state.error).toBe("API 调用失败")
      expect(state.nodeOutputs[0].output).toBe("错误: API 调用失败")
      expect(state.nodeOutputs[0].isRunning).toBe(false)
    })

    it("应该更新数据库中的节点结果为失败状态", async () => {
      await setupExecution()

      capturedOnEvent?.({
        type: "node_started",
        nodeId: "node-1",
        nodeName: "AI 节点",
        nodeType: "ai_chat",
      })
      await new Promise(resolve => setTimeout(resolve, 50))

      capturedOnEvent?.({
        type: "node_failed",
        nodeId: "node-1",
        error: "执行失败",
      })
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(db.updateNodeResult).toHaveBeenCalledWith(
        "result-1",
        expect.objectContaining({
          status: "failed",
        })
      )
    })
  })

  describe("node_skipped 事件", () => {
    it("应该标记节点为已跳过", async () => {
      await setupExecution()

      // 先添加一个节点输出
      capturedOnEvent?.({
        type: "node_started",
        nodeId: "node-1",
        nodeName: "AI 节点",
        nodeType: "ai_chat",
      })
      await new Promise(resolve => setTimeout(resolve, 10))

      capturedOnEvent?.({
        type: "node_skipped",
        nodeId: "node-1",
      })
      await new Promise(resolve => setTimeout(resolve, 10))

      const state = useExecutionStore.getState()
      expect(state.nodeOutputs[0].output).toBe("(已跳过)")
      expect(state.nodeOutputs[0].isRunning).toBe(false)
    })
  })

  describe("execution_paused 事件", () => {
    it("应该将状态设置为暂停", async () => {
      await setupExecution()

      capturedOnEvent?.({
        type: "execution_paused",
      })
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(useExecutionStore.getState().status).toBe("paused")
    })
  })

  describe("execution_resumed 事件", () => {
    it("应该将状态设置为运行中", async () => {
      await setupExecution()
      useExecutionStore.setState({ status: "paused" })

      capturedOnEvent?.({
        type: "execution_resumed",
      })
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(useExecutionStore.getState().status).toBe("running")
    })
  })

  describe("execution_completed 事件", () => {
    it("应该将状态设置为完成并清理流式状态", async () => {
      await setupExecution()
      useExecutionStore.setState({
        streamingContent: "some content",
        streamingNodeId: "node-1",
        currentNodeIndex: 0,
      })

      capturedOnEvent?.({
        type: "execution_completed",
      })
      await new Promise(resolve => setTimeout(resolve, 10))

      const state = useExecutionStore.getState()
      expect(state.status).toBe("completed")
      expect(state.currentNodeIndex).toBeNull()
      expect(state.streamingContent).toBe("")
      expect(state.streamingNodeId).toBeNull()
    })
  })

  describe("execution_failed 事件", () => {
    it("应该将状态设置为失败并记录错误", async () => {
      await setupExecution()

      capturedOnEvent?.({
        type: "execution_failed",
        error: "工作流执行失败",
      })
      await new Promise(resolve => setTimeout(resolve, 10))

      const state = useExecutionStore.getState()
      expect(state.status).toBe("failed")
      expect(state.error).toBe("工作流执行失败")
    })

    it("应该使用默认错误信息当没有提供错误时", async () => {
      await setupExecution()

      capturedOnEvent?.({
        type: "execution_failed",
      })
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(useExecutionStore.getState().error).toBe("执行失败")
    })
  })

  describe("execution_cancelled 事件", () => {
    it("应该将状态设置为已取消", async () => {
      await setupExecution()

      capturedOnEvent?.({
        type: "execution_cancelled",
      })
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(useExecutionStore.getState().status).toBe("cancelled")
    })
  })

  describe("execution_timeout 事件", () => {
    it("应该将状态设置为超时并记录错误", async () => {
      await setupExecution()

      capturedOnEvent?.({
        type: "execution_timeout",
      })
      await new Promise(resolve => setTimeout(resolve, 10))

      const state = useExecutionStore.getState()
      expect(state.status).toBe("timeout")
      expect(state.error).toBe("执行超时")
    })
  })
})

// ========== 数据库操作错误处理测试 ==========

describe("ExecutionStore - 数据库操作错误处理", () => {
  let capturedOnEvent: ((event: any) => void) | null = null

  beforeEach(() => {
    useExecutionStore.getState().reset()
    vi.clearAllMocks()
    capturedOnEvent = null

    vi.mocked(WorkflowExecutor).mockImplementation(function (this: any, config: any) {
      capturedOnEvent = config.onEvent
      Object.assign(this, mockExecutorInstance)
      return this
    })
  })

  async function setupExecution() {
    const workflow = createMockWorkflow({ id: "workflow-1" })
    const nodes = [createMockNode()]
    const globalConfig = createMockGlobalConfig()
    const execution = { id: "execution-1", workflow_id: "workflow-1", status: "running", started_at: new Date().toISOString() }

    vi.mocked(db.createExecution).mockResolvedValue(execution as any)
    mockExecutorInstance.execute.mockImplementation(() => new Promise(() => {}))

    useExecutionStore.getState().startExecution(workflow, nodes, globalConfig)
    await new Promise(resolve => setTimeout(resolve, 10))
  }

  it("应该在创建节点结果失败时记录错误但继续执行", async () => {
    await setupExecution()
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(db.createNodeResult).mockRejectedValue(new Error("创建节点结果失败"))

    capturedOnEvent?.({
      type: "node_started",
      nodeId: "node-1",
      nodeName: "AI 节点",
      nodeType: "ai_chat",
    })
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(consoleSpy).toHaveBeenCalled()
    // 节点输出仍应被添加
    expect(useExecutionStore.getState().nodeOutputs).toHaveLength(1)
    consoleSpy.mockRestore()
  })

  it("应该在更新节点结果失败时记录错误但继续执行", async () => {
    await setupExecution()
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(db.createNodeResult).mockResolvedValue({ id: "result-1" } as any)
    vi.mocked(db.updateNodeResult).mockRejectedValue(new Error("更新节点结果失败"))

    capturedOnEvent?.({
      type: "node_started",
      nodeId: "node-1",
      nodeName: "AI 节点",
      nodeType: "ai_chat",
    })
    await new Promise(resolve => setTimeout(resolve, 50))

    capturedOnEvent?.({
      type: "node_completed",
      nodeId: "node-1",
      content: "输出内容",
    })
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(consoleSpy).toHaveBeenCalled()
    // 节点输出仍应被更新
    expect(useExecutionStore.getState().nodeOutputs[0].output).toBe("输出内容")
    consoleSpy.mockRestore()
  })
})

// ========== 执行完成后更新数据库测试 ==========

describe("ExecutionStore - 执行完成后数据库更新", () => {
  beforeEach(() => {
    useExecutionStore.getState().reset()
    vi.clearAllMocks()
  })

  it("应该在执行完成后更新数据库记录", async () => {
    const workflow = createMockWorkflow({ id: "workflow-1" })
    const nodes = [createMockNode()]
    const globalConfig = createMockGlobalConfig()
    const execution = { id: "execution-1", workflow_id: "workflow-1", status: "running", started_at: new Date().toISOString() }

    vi.mocked(db.createExecution).mockResolvedValue(execution as any)
    vi.mocked(db.updateExecution).mockResolvedValue()
    mockExecutorInstance.execute.mockResolvedValue({
      status: "completed",
      output: "最终输出",
      nodeStates: [],
      elapsedSeconds: 10,
    })

    await useExecutionStore.getState().startExecution(workflow, nodes, globalConfig)

    expect(db.updateExecution).toHaveBeenCalledWith(
      "execution-1",
      expect.objectContaining({
        status: "completed",
        final_output: "最终输出",
      })
    )
  })

  it("应该在执行失败后更新数据库记录为失败状态", async () => {
    const workflow = createMockWorkflow({ id: "workflow-1" })
    const nodes = [createMockNode()]
    const globalConfig = createMockGlobalConfig()
    const execution = { id: "execution-1", workflow_id: "workflow-1", status: "running", started_at: new Date().toISOString() }

    vi.mocked(db.createExecution).mockResolvedValue(execution as any)
    vi.mocked(db.updateExecution).mockResolvedValue()
    mockExecutorInstance.execute.mockRejectedValue(new Error("执行错误"))

    await useExecutionStore.getState().startExecution(workflow, nodes, globalConfig)

    expect(db.updateExecution).toHaveBeenCalledWith(
      "execution-1",
      expect.objectContaining({
        status: "failed",
      })
    )
  })

  it("应该在取消执行时更新数据库记录", () => {
    useExecutionStore.setState({
      executor: mockExecutorInstance as any,
      executionId: "execution-1",
      status: "running",
    })
    vi.mocked(db.updateExecution).mockResolvedValue()

    useExecutionStore.getState().cancelExecution()

    expect(db.updateExecution).toHaveBeenCalledWith(
      "execution-1",
      expect.objectContaining({
        status: "cancelled",
      })
    )
  })

  it("应该保存变量快照到数据库", async () => {
    const workflow = createMockWorkflow({ id: "workflow-1" })
    const nodes = [createMockNode()]
    const globalConfig = createMockGlobalConfig()
    const execution = { id: "execution-1", workflow_id: "workflow-1", status: "running", started_at: new Date().toISOString() }

    vi.mocked(db.createExecution).mockResolvedValue(execution as any)
    vi.mocked(db.updateExecution).mockResolvedValue()
    mockExecutorInstance.execute.mockResolvedValue({
      status: "completed",
      output: "最终输出",
      nodeStates: [],
      elapsedSeconds: 10,
    })

    await useExecutionStore.getState().startExecution(workflow, nodes, globalConfig)

    expect(db.updateExecution).toHaveBeenCalledWith(
      "execution-1",
      expect.objectContaining({
        variables_snapshot: expect.anything(),
      })
    )
  })

  it("执行结果 error 字段应该传递到 state", async () => {
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
      error: "具体错误信息",
    })

    await useExecutionStore.getState().startExecution(workflow, nodes, globalConfig)

    const state = useExecutionStore.getState()
    expect(state.status).toBe("failed")
    expect(state.error).toBe("具体错误信息")
  })
})

