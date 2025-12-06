// use-run-button-state.ts 测试
// 测试运行按钮状态 Hook 的所有逻辑分支

import { describe, it, expect } from "vitest"
import { renderHook } from "@testing-library/react"
import { useRunButtonState } from "../use-run-button-state"
import type { WorkflowNode, GlobalConfig, AIProvider } from "@/types"

// ========== 测试数据工厂 ==========

function createMockNode(overrides?: Partial<WorkflowNode>): WorkflowNode {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    workflow_id: "workflow-1",
    type: "ai_chat",
    name: "测试节点",
    config: { model: "gpt-4" },
    order_index: 0,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function createMockGlobalConfig(overrides?: Partial<GlobalConfig>): GlobalConfig {
  return {
    id: 1,
    ai_providers: {
      openai: { api_key: "sk-test", enabled: true },
      gemini: { api_key: "", enabled: false },
      claude: { api_key: "", enabled: false },
    },
    theme: "system",
    default_loop_max: 10,
    default_timeout: 300,
    ...overrides,
  }
}

// ========== 执行中状态测试 ==========

describe("useRunButtonState - 执行中状态", () => {
  it("执行中时应该返回不禁用状态", () => {
    const nodes = [createMockNode({ type: "start" })]
    const globalConfig = createMockGlobalConfig()

    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig, true)
    )

    expect(result.current.disabled).toBe(false)
    expect(result.current.reason).toBeNull()
  })

  it("执行中时即使配置无效也不禁用", () => {
    const nodes: WorkflowNode[] = []
    const globalConfig = null

    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig, true)
    )

    expect(result.current.disabled).toBe(false)
    expect(result.current.reason).toBeNull()
  })
})

// ========== 全局配置检查测试 ==========

describe("useRunButtonState - 全局配置检查", () => {
  it("全局配置为 null 时应该禁用并提示加载中", () => {
    const nodes = [createMockNode({ type: "ai_chat" })]
    const globalConfig = null

    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig, false)
    )

    expect(result.current.disabled).toBe(true)
    expect(result.current.reason).toBe("正在加载配置...")
  })
})

// ========== 可执行节点检查测试 ==========

describe("useRunButtonState - 可执行节点检查", () => {
  it("只有开始节点时应该禁用", () => {
    const nodes = [createMockNode({ type: "start" })]
    const globalConfig = createMockGlobalConfig()

    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig, false)
    )

    expect(result.current.disabled).toBe(true)
    expect(result.current.reason).toBe("请添加至少一个执行节点")
  })

  it("没有任何节点时应该禁用", () => {
    const nodes: WorkflowNode[] = []
    const globalConfig = createMockGlobalConfig()

    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig, false)
    )

    expect(result.current.disabled).toBe(true)
    expect(result.current.reason).toBe("请添加至少一个执行节点")
  })

  it("有非开始节点时不应该因节点检查禁用", () => {
    const nodes = [
      createMockNode({ type: "start" }),
      createMockNode({ type: "text_concat", config: {} }),
    ]
    const globalConfig = createMockGlobalConfig()

    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig, false)
    )

    // 不应该因为节点检查而禁用
    expect(result.current.reason).not.toBe("请添加至少一个执行节点")
  })
})

// ========== AI 节点配置检查测试 ==========

describe("useRunButtonState - AI 节点配置检查", () => {
  it("有 AI 节点但没有启用的 Provider 时应该禁用", () => {
    const nodes = [
      createMockNode({ type: "start" }),
      createMockNode({ type: "ai_chat", config: { model: "gpt-4" } }),
    ]
    const globalConfig = createMockGlobalConfig({
      ai_providers: {
        openai: { api_key: "", enabled: false },
        gemini: { api_key: "", enabled: false },
        claude: { api_key: "", enabled: false },
      },
    })

    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig, false)
    )

    expect(result.current.disabled).toBe(true)
    expect(result.current.reason).toBe("包含 AI 节点，请先配置 AI 服务")
    expect(result.current.actionUrl).toBe("/settings")
    expect(result.current.actionLabel).toBe("去配置")
  })

  it("Provider 启用但没有 API Key 时应该禁用", () => {
    const nodes = [
      createMockNode({ type: "start" }),
      createMockNode({ type: "ai_chat", config: { model: "gpt-4" } }),
    ]
    const globalConfig = createMockGlobalConfig({
      ai_providers: {
        openai: { api_key: "", enabled: true },  // 启用但无 key
        gemini: { api_key: "", enabled: false },
        claude: { api_key: "", enabled: false },
      },
    })

    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig, false)
    )

    expect(result.current.disabled).toBe(true)
    expect(result.current.reason).toBe("包含 AI 节点，请先配置 AI 服务")
  })

  it("有 API Key 但 Provider 未启用时应该禁用", () => {
    const nodes = [
      createMockNode({ type: "start" }),
      createMockNode({ type: "ai_chat", config: { model: "gpt-4" } }),
    ]
    const globalConfig = createMockGlobalConfig({
      ai_providers: {
        openai: { api_key: "sk-test", enabled: false },  // 有 key 但未启用
        gemini: { api_key: "", enabled: false },
        claude: { api_key: "", enabled: false },
      },
    })

    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig, false)
    )

    expect(result.current.disabled).toBe(true)
    expect(result.current.reason).toBe("包含 AI 节点，请先配置 AI 服务")
  })

  it("AI 节点未配置模型时应该禁用", () => {
    const nodes = [
      createMockNode({ type: "start" }),
      createMockNode({ 
        type: "ai_chat", 
        name: "AI 对话节点",
        config: { model: "" }  // 空模型
      }),
    ]
    const globalConfig = createMockGlobalConfig()

    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig, false)
    )

    expect(result.current.disabled).toBe(true)
    expect(result.current.reason).toBe('节点"AI 对话节点"未选择 AI 模型')
  })

  it("AI 节点 config 中没有 model 字段时应该禁用", () => {
    const nodes = [
      createMockNode({ type: "start" }),
      createMockNode({ 
        type: "ai_chat", 
        name: "未配置节点",
        config: {}  // 没有 model 字段
      }),
    ]
    const globalConfig = createMockGlobalConfig()

    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig, false)
    )

    expect(result.current.disabled).toBe(true)
    expect(result.current.reason).toBe('节点"未配置节点"未选择 AI 模型')
  })

  it("多个 AI 节点时应该检查所有节点的模型配置", () => {
    const nodes = [
      createMockNode({ type: "start" }),
      createMockNode({ 
        type: "ai_chat", 
        name: "第一个节点",
        config: { model: "gpt-4" }  // 已配置
      }),
      createMockNode({ 
        type: "ai_chat", 
        name: "第二个节点",
        config: { model: "" }  // 未配置
      }),
    ]
    const globalConfig = createMockGlobalConfig()

    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig, false)
    )

    expect(result.current.disabled).toBe(true)
    expect(result.current.reason).toBe('节点"第二个节点"未选择 AI 模型')
  })
})

// ========== 所有检查通过测试 ==========

describe("useRunButtonState - 所有检查通过", () => {
  it("有效配置时应该返回不禁用状态", () => {
    const nodes = [
      createMockNode({ type: "start" }),
      createMockNode({ type: "ai_chat", config: { model: "gpt-4" } }),
    ]
    const globalConfig = createMockGlobalConfig()

    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig, false)
    )

    expect(result.current.disabled).toBe(false)
    expect(result.current.reason).toBeNull()
  })

  it("没有 AI 节点但有其他执行节点时应该不禁用", () => {
    const nodes = [
      createMockNode({ type: "start" }),
      createMockNode({ type: "text_concat", config: {} }),
      createMockNode({ type: "text_extract", config: {} }),
    ]
    const globalConfig = createMockGlobalConfig()

    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig, false)
    )

    expect(result.current.disabled).toBe(false)
    expect(result.current.reason).toBeNull()
  })

  it("多个有效 AI 节点时应该不禁用", () => {
    const nodes = [
      createMockNode({ type: "start" }),
      createMockNode({ type: "ai_chat", config: { model: "gpt-4" } }),
      createMockNode({ type: "ai_chat", config: { model: "gpt-3.5-turbo" } }),
    ]
    const globalConfig = createMockGlobalConfig()

    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig, false)
    )

    expect(result.current.disabled).toBe(false)
    expect(result.current.reason).toBeNull()
  })

  it("多个 AI Provider 配置时只要有一个有效即可", () => {
    const nodes = [
      createMockNode({ type: "start" }),
      createMockNode({ type: "ai_chat", config: { model: "gemini-pro" } }),
    ]
    const globalConfig = createMockGlobalConfig({
      ai_providers: {
        openai: { api_key: "", enabled: false },
        gemini: { api_key: "gemini-key", enabled: true },  // 有效配置
        claude: { api_key: "", enabled: false },
      },
    })

    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig, false)
    )

    expect(result.current.disabled).toBe(false)
    expect(result.current.reason).toBeNull()
  })
})

// ========== 默认参数测试 ==========

describe("useRunButtonState - 默认参数", () => {
  it("isExecuting 默认应该为 false", () => {
    const nodes = [createMockNode({ type: "start" })]
    const globalConfig = createMockGlobalConfig()

    // 不传 isExecuting 参数
    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig)
    )

    // 应该执行正常的检查逻辑
    expect(result.current.disabled).toBe(true)
    expect(result.current.reason).toBe("请添加至少一个执行节点")
  })
})

// ========== Hook 响应性测试 ==========

describe("useRunButtonState - Hook 响应性", () => {
  it("节点变化时应该更新状态", () => {
    const globalConfig = createMockGlobalConfig()
    
    let nodes = [createMockNode({ type: "start" })]
    
    const { result, rerender } = renderHook(
      ({ nodes, globalConfig }) => useRunButtonState(nodes, globalConfig, false),
      { initialProps: { nodes, globalConfig } }
    )

    expect(result.current.disabled).toBe(true)
    expect(result.current.reason).toBe("请添加至少一个执行节点")

    // 添加执行节点
    nodes = [
      createMockNode({ type: "start" }),
      createMockNode({ type: "text_concat", config: {} }),
    ]
    rerender({ nodes, globalConfig })

    expect(result.current.disabled).toBe(false)
    expect(result.current.reason).toBeNull()
  })

  it("globalConfig 变化时应该更新状态", () => {
    const nodes: WorkflowNode[] = [
      createMockNode({ type: "start" }),
      createMockNode({ type: "ai_chat", config: { model: "gpt-4" } }),
    ]
    
    const { result, rerender } = renderHook(
      ({ nodes, globalConfig }: { nodes: WorkflowNode[]; globalConfig: GlobalConfig | null }) => 
        useRunButtonState(nodes, globalConfig, false),
      { initialProps: { nodes, globalConfig: null as GlobalConfig | null } }
    )

    expect(result.current.disabled).toBe(true)
    expect(result.current.reason).toBe("正在加载配置...")

    // 加载配置完成
    rerender({ nodes, globalConfig: createMockGlobalConfig() })

    expect(result.current.disabled).toBe(false)
    expect(result.current.reason).toBeNull()
  })

  it("isExecuting 变化时应该更新状态", () => {
    const nodes = [createMockNode({ type: "start" })]
    const globalConfig = createMockGlobalConfig()
    
    let isExecuting = false
    
    const { result, rerender } = renderHook(
      ({ isExecuting }) => useRunButtonState(nodes, globalConfig, isExecuting),
      { initialProps: { isExecuting } }
    )

    expect(result.current.disabled).toBe(true)  // 因为只有 start 节点

    // 开始执行
    isExecuting = true
    rerender({ isExecuting })

    expect(result.current.disabled).toBe(false)
    expect(result.current.reason).toBeNull()
  })
})

// ========== 边界情况测试 ==========

describe("useRunButtonState - 边界情况", () => {
  it("空的 ai_providers 对象时应该禁用 AI 节点", () => {
    const nodes = [
      createMockNode({ type: "start" }),
      createMockNode({ type: "ai_chat", config: { model: "gpt-4" } }),
    ]
    const globalConfig: GlobalConfig = {
      id: 1,
      ai_providers: {} as Record<AIProvider, { api_key: string; enabled: boolean }>,
      theme: "system",
      default_loop_max: 10,
      default_timeout: 300,
    }

    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig, false)
    )

    expect(result.current.disabled).toBe(true)
    expect(result.current.reason).toBe("包含 AI 节点，请先配置 AI 服务")
  })

  it("混合节点类型时应该正确检查", () => {
    const nodes = [
      createMockNode({ type: "start" }),
      createMockNode({ type: "text_concat", config: {} }),
      createMockNode({ type: "ai_chat", config: { model: "gpt-4" } }),
      createMockNode({ type: "text_extract", config: {} }),
      createMockNode({ type: "output", config: {} }),
    ]
    const globalConfig = createMockGlobalConfig()

    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig, false)
    )

    expect(result.current.disabled).toBe(false)
    expect(result.current.reason).toBeNull()
  })

  it("节点名称包含特殊字符时应该正确显示", () => {
    const nodes = [
      createMockNode({ type: "start" }),
      createMockNode({ 
        type: "ai_chat", 
        name: '节点 "测试" <特殊>',
        config: { model: "" }
      }),
    ]
    const globalConfig = createMockGlobalConfig()

    const { result } = renderHook(() =>
      useRunButtonState(nodes, globalConfig, false)
    )

    expect(result.current.disabled).toBe(true)
    expect(result.current.reason).toBe('节点"节点 "测试" <特殊>"未选择 AI 模型')
  })
})

