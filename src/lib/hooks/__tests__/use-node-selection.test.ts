// use-node-selection Hook 测试
// 测试节点选择、多选、范围选择功能

import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useNodeSelection } from "../use-node-selection"
import type { WorkflowNode } from "@/types"

// ========== 测试数据工厂 ==========

function createMockNode(overrides?: Partial<WorkflowNode>): WorkflowNode {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    workflow_id: "workflow-1",
    type: "ai_chat",
    name: "测试节点",
    config: {},
    order_index: 0,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function createMockNodes(count: number): WorkflowNode[] {
  return Array.from({ length: count }, (_, i) =>
    createMockNode({
      id: `node-${i}`,
      name: `节点${i}`,
      type: i === 0 ? "start" : "ai_chat",
      order_index: i,
    })
  )
}

function createMockMouseEvent(options: {
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
}): React.MouseEvent {
  return {
    ctrlKey: options.ctrlKey || false,
    metaKey: options.metaKey || false,
    shiftKey: options.shiftKey || false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.MouseEvent
}

// ========== 初始状态测试 ==========

describe("useNodeSelection - 初始状态", () => {
  it("应该返回空的选择集合", () => {
    const { result } = renderHook(() => useNodeSelection())

    expect(result.current.selectedIds.size).toBe(0)
    expect(result.current.selectionCount).toBe(0)
    expect(result.current.isMultiSelectMode).toBe(false)
  })
})

// ========== select 单选测试 ==========

describe("useNodeSelection - select 单选", () => {
  it("应该选中单个节点", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.select("node-1")
    })

    expect(result.current.selectedIds.has("node-1")).toBe(true)
    expect(result.current.selectionCount).toBe(1)
  })

  it("应该替换之前的选择", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.select("node-1")
    })

    act(() => {
      result.current.select("node-2")
    })

    expect(result.current.selectedIds.has("node-1")).toBe(false)
    expect(result.current.selectedIds.has("node-2")).toBe(true)
    expect(result.current.selectionCount).toBe(1)
  })

  it("重复选择同一节点应该保持选中", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.select("node-1")
    })

    act(() => {
      result.current.select("node-1")
    })

    expect(result.current.selectedIds.has("node-1")).toBe(true)
    expect(result.current.selectionCount).toBe(1)
  })
})

// ========== toggle 切换选择测试 ==========

describe("useNodeSelection - toggle 切换选择", () => {
  it("应该切换未选中节点为选中", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.toggle("node-1")
    })

    expect(result.current.selectedIds.has("node-1")).toBe(true)
  })

  it("应该切换已选中节点为未选中", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.toggle("node-1")
    })

    act(() => {
      result.current.toggle("node-1")
    })

    expect(result.current.selectedIds.has("node-1")).toBe(false)
    expect(result.current.selectionCount).toBe(0)
  })

  it("应该支持多个节点的切换", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.toggle("node-1")
    })

    act(() => {
      result.current.toggle("node-2")
    })

    act(() => {
      result.current.toggle("node-3")
    })

    expect(result.current.selectedIds.has("node-1")).toBe(true)
    expect(result.current.selectedIds.has("node-2")).toBe(true)
    expect(result.current.selectedIds.has("node-3")).toBe(true)
    expect(result.current.selectionCount).toBe(3)
  })

  it("应该在切换时保留其他选择", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.toggle("node-1")
      result.current.toggle("node-2")
    })

    act(() => {
      result.current.toggle("node-1") // 取消选择 node-1
    })

    expect(result.current.selectedIds.has("node-1")).toBe(false)
    expect(result.current.selectedIds.has("node-2")).toBe(true)
    expect(result.current.selectionCount).toBe(1)
  })
})

// ========== selectRange 范围选择测试 ==========

describe("useNodeSelection - selectRange 范围选择", () => {
  const nodes = createMockNodes(5) // node-0 到 node-4

  it("应该在没有上次选择时进行单选", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.selectRange("node-2", nodes)
    })

    expect(result.current.selectedIds.has("node-2")).toBe(true)
    expect(result.current.selectionCount).toBe(1)
  })

  it("应该选择从上次选择到当前节点的范围", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.select("node-1")
    })

    act(() => {
      result.current.selectRange("node-3", nodes)
    })

    // 应该选中 node-1, node-2, node-3
    expect(result.current.selectedIds.has("node-1")).toBe(true)
    expect(result.current.selectedIds.has("node-2")).toBe(true)
    expect(result.current.selectedIds.has("node-3")).toBe(true)
    expect(result.current.selectionCount).toBe(3)
  })

  it("应该支持反向范围选择", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.select("node-3")
    })

    act(() => {
      result.current.selectRange("node-1", nodes)
    })

    // 应该选中 node-1, node-2, node-3
    expect(result.current.selectedIds.has("node-1")).toBe(true)
    expect(result.current.selectedIds.has("node-2")).toBe(true)
    expect(result.current.selectedIds.has("node-3")).toBe(true)
    expect(result.current.selectionCount).toBe(3)
  })

  it("应该将范围添加到现有选择", () => {
    const { result } = renderHook(() => useNodeSelection())

    // 先用 toggle 选中 node-0 和 node-1
    act(() => {
      result.current.toggle("node-0")
      result.current.toggle("node-1")
    })

    // 然后用 selectRange 扩展选择到 node-3
    act(() => {
      result.current.selectRange("node-3", nodes)
    })

    // node-0 应该保留（toggle添加的），node-1 到 node-3 应该被选中（selectRange添加的）
    expect(result.current.selectedIds.has("node-0")).toBe(true)
    expect(result.current.selectedIds.has("node-1")).toBe(true)
    expect(result.current.selectedIds.has("node-2")).toBe(true)
    expect(result.current.selectedIds.has("node-3")).toBe(true)
  })

  it("应该处理节点不在列表中的情况", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.select("node-1")
    })

    act(() => {
      result.current.selectRange("non-existent", nodes)
    })

    // 应该回退到单选
    expect(result.current.selectedIds.has("non-existent")).toBe(true)
    expect(result.current.selectionCount).toBe(1)
  })
})

// ========== selectAll 全选测试 ==========

describe("useNodeSelection - selectAll 全选", () => {
  it("应该选中所有非开始节点", () => {
    const nodes = createMockNodes(4) // node-0 是 start 类型
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.selectAll(nodes)
    })

    // node-0 是 start 类型，不应被选中
    expect(result.current.selectedIds.has("node-0")).toBe(false)
    expect(result.current.selectedIds.has("node-1")).toBe(true)
    expect(result.current.selectedIds.has("node-2")).toBe(true)
    expect(result.current.selectedIds.has("node-3")).toBe(true)
    expect(result.current.selectionCount).toBe(3)
  })

  it("应该在只有开始节点时选择为空", () => {
    const nodes = [createMockNode({ id: "start-node", type: "start" })]
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.selectAll(nodes)
    })

    expect(result.current.selectionCount).toBe(0)
  })

  it("应该替换之前的选择", () => {
    const nodes = createMockNodes(3)
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.select("some-other-node")
    })

    act(() => {
      result.current.selectAll(nodes)
    })

    expect(result.current.selectedIds.has("some-other-node")).toBe(false)
    expect(result.current.selectionCount).toBe(2) // 除了 start 节点
  })
})

// ========== deselect 取消选择测试 ==========

describe("useNodeSelection - deselect 取消选择", () => {
  it("应该取消选择单个节点", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.toggle("node-1")
      result.current.toggle("node-2")
    })

    act(() => {
      result.current.deselect("node-1")
    })

    expect(result.current.selectedIds.has("node-1")).toBe(false)
    expect(result.current.selectedIds.has("node-2")).toBe(true)
  })

  it("应该安全处理未选中节点的取消选择", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.deselect("non-existent")
    })

    expect(result.current.selectionCount).toBe(0)
  })
})

// ========== clearSelection 清空选择测试 ==========

describe("useNodeSelection - clearSelection 清空选择", () => {
  it("应该清空所有选择", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.toggle("node-1")
      result.current.toggle("node-2")
      result.current.toggle("node-3")
    })

    act(() => {
      result.current.clearSelection()
    })

    expect(result.current.selectionCount).toBe(0)
    expect(result.current.selectedIds.size).toBe(0)
  })

  it("应该重置多选模式", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.setMultiSelectMode(true)
    })

    act(() => {
      result.current.clearSelection()
    })

    expect(result.current.isMultiSelectMode).toBe(false)
  })
})

// ========== isSelected 检查方法测试 ==========

describe("useNodeSelection - isSelected 检查方法", () => {
  it("应该返回 true 对于选中的节点", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.select("node-1")
    })

    expect(result.current.isSelected("node-1")).toBe(true)
  })

  it("应该返回 false 对于未选中的节点", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.select("node-1")
    })

    expect(result.current.isSelected("node-2")).toBe(false)
  })
})

// ========== getSelectedNodes 获取选中节点测试 ==========

describe("useNodeSelection - getSelectedNodes 获取选中节点", () => {
  it("应该返回选中的节点对象", () => {
    const nodes = createMockNodes(3)
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.toggle("node-1")
      result.current.toggle("node-2")
    })

    const selected = result.current.getSelectedNodes(nodes)
    expect(selected).toHaveLength(2)
    expect(selected.map((n) => n.id)).toContain("node-1")
    expect(selected.map((n) => n.id)).toContain("node-2")
  })

  it("应该返回空数组当没有选中时", () => {
    const nodes = createMockNodes(3)
    const { result } = renderHook(() => useNodeSelection())

    const selected = result.current.getSelectedNodes(nodes)
    expect(selected).toHaveLength(0)
  })

  it("应该过滤掉不在节点列表中的选择", () => {
    const nodes = createMockNodes(3)
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.toggle("node-1")
      result.current.toggle("non-existent")
    })

    const selected = result.current.getSelectedNodes(nodes)
    expect(selected).toHaveLength(1)
    expect(selected[0].id).toBe("node-1")
  })
})

// ========== setMultiSelectMode 多选模式测试 ==========

describe("useNodeSelection - setMultiSelectMode 多选模式", () => {
  it("应该设置多选模式", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.setMultiSelectMode(true)
    })

    expect(result.current.isMultiSelectMode).toBe(true)
  })

  it("应该取消多选模式", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.setMultiSelectMode(true)
    })

    act(() => {
      result.current.setMultiSelectMode(false)
    })

    expect(result.current.isMultiSelectMode).toBe(false)
  })
})

// ========== handleClick 点击处理测试 ==========

describe("useNodeSelection - handleClick 点击处理", () => {
  const nodes = createMockNodes(5)

  it("普通点击应该单选", () => {
    const { result } = renderHook(() => useNodeSelection())
    const event = createMockMouseEvent({})

    act(() => {
      result.current.handleClick("node-1", event, nodes)
    })

    expect(result.current.selectedIds.has("node-1")).toBe(true)
    expect(result.current.selectionCount).toBe(1)
  })

  it("Ctrl+点击应该切换选择", () => {
    const { result } = renderHook(() => useNodeSelection())
    const event = createMockMouseEvent({ ctrlKey: true })

    act(() => {
      result.current.handleClick("node-1", event, nodes)
    })

    act(() => {
      result.current.handleClick("node-2", createMockMouseEvent({ ctrlKey: true }), nodes)
    })

    expect(result.current.selectedIds.has("node-1")).toBe(true)
    expect(result.current.selectedIds.has("node-2")).toBe(true)
    expect(result.current.selectionCount).toBe(2)
  })

  it("Meta+点击（Mac）应该切换选择", () => {
    const { result } = renderHook(() => useNodeSelection())
    const event = createMockMouseEvent({ metaKey: true })

    act(() => {
      result.current.handleClick("node-1", event, nodes)
    })

    act(() => {
      result.current.handleClick("node-2", createMockMouseEvent({ metaKey: true }), nodes)
    })

    expect(result.current.selectedIds.has("node-1")).toBe(true)
    expect(result.current.selectedIds.has("node-2")).toBe(true)
  })

  it("Shift+点击应该范围选择", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.handleClick("node-1", createMockMouseEvent({}), nodes)
    })

    act(() => {
      result.current.handleClick("node-3", createMockMouseEvent({ shiftKey: true }), nodes)
    })

    expect(result.current.selectedIds.has("node-1")).toBe(true)
    expect(result.current.selectedIds.has("node-2")).toBe(true)
    expect(result.current.selectedIds.has("node-3")).toBe(true)
    expect(result.current.selectionCount).toBe(3)
  })

  it("点击开始节点应该清空选择", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.handleClick("node-1", createMockMouseEvent({}), nodes)
    })

    act(() => {
      result.current.handleClick("node-0", createMockMouseEvent({}), nodes) // node-0 是 start
    })

    expect(result.current.selectionCount).toBe(0)
  })

  it("Ctrl+点击已选中节点应该取消选择", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.handleClick("node-1", createMockMouseEvent({}), nodes)
    })

    act(() => {
      result.current.handleClick("node-1", createMockMouseEvent({ ctrlKey: true }), nodes)
    })

    expect(result.current.selectedIds.has("node-1")).toBe(false)
    expect(result.current.selectionCount).toBe(0)
  })

  it("Shift+点击在没有选择时应该单选", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.handleClick("node-2", createMockMouseEvent({ shiftKey: true }), nodes)
    })

    // 没有已选择的节点，所以 Shift+点击应该变成单选
    expect(result.current.selectedIds.has("node-2")).toBe(true)
    expect(result.current.selectionCount).toBe(1)
  })
})

// ========== selectionCount 计数测试 ==========

describe("useNodeSelection - selectionCount 计数", () => {
  it("应该正确反映选中数量", () => {
    const { result } = renderHook(() => useNodeSelection())

    expect(result.current.selectionCount).toBe(0)

    act(() => {
      result.current.toggle("node-1")
    })
    expect(result.current.selectionCount).toBe(1)

    act(() => {
      result.current.toggle("node-2")
    })
    expect(result.current.selectionCount).toBe(2)

    act(() => {
      result.current.toggle("node-1")
    })
    expect(result.current.selectionCount).toBe(1)

    act(() => {
      result.current.clearSelection()
    })
    expect(result.current.selectionCount).toBe(0)
  })
})

// ========== 边界情况测试 ==========

describe("useNodeSelection - 边界情况", () => {
  it("应该处理空节点列表", () => {
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.selectAll([])
    })

    expect(result.current.selectionCount).toBe(0)
  })

  it("应该处理所有节点都是 start 类型", () => {
    const nodes = [
      createMockNode({ id: "start-1", type: "start" }),
      createMockNode({ id: "start-2", type: "start" }),
    ]
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.selectAll(nodes)
    })

    expect(result.current.selectionCount).toBe(0)
  })

  it("范围选择应该处理相同节点", () => {
    const nodes = createMockNodes(3)
    const { result } = renderHook(() => useNodeSelection())

    act(() => {
      result.current.select("node-1")
    })

    act(() => {
      result.current.selectRange("node-1", nodes)
    })

    // 选择同一节点的范围应该只选中那个节点
    expect(result.current.selectedIds.has("node-1")).toBe(true)
    expect(result.current.selectionCount).toBe(1)
  })
})

