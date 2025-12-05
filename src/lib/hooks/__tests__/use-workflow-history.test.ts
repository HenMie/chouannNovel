// use-workflow-history Hook 测试
// 测试撤销/重做命令栈管理

import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useWorkflowHistory, type WorkflowCommand } from "../use-workflow-history"

// ========== 测试命令工厂 ==========

function createMockCommand<T = void>(
  redoValue?: T,
  options?: {
    redoFn?: () => Promise<T> | T
    undoFn?: () => Promise<void> | void
    description?: string
  }
): WorkflowCommand<T> {
  return {
    description: options?.description,
    redo: options?.redoFn ?? vi.fn().mockResolvedValue(redoValue as T),
    undo: options?.undoFn ?? vi.fn().mockResolvedValue(undefined),
  }
}

// ========== 初始状态测试 ==========

describe("useWorkflowHistory - 初始状态", () => {
  it("应该返回正确的初始状态", () => {
    const { result } = renderHook(() => useWorkflowHistory())

    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
    expect(result.current.historySize).toBe(0)
  })

  it("应该支持自定义 maxSize", () => {
    const { result } = renderHook(() => useWorkflowHistory({ maxSize: 10 }))

    expect(result.current.historySize).toBe(0)
  })
})

// ========== execute 执行命令测试 ==========

describe("useWorkflowHistory - execute 执行命令", () => {
  it("应该执行命令的 redo 函数", async () => {
    const { result } = renderHook(() => useWorkflowHistory())
    const redoFn = vi.fn().mockResolvedValue(undefined)
    const command = createMockCommand(undefined, { redoFn })

    await act(async () => {
      await result.current.execute(command)
    })

    expect(redoFn).toHaveBeenCalledTimes(1)
  })

  it("应该返回 redo 函数的返回值", async () => {
    const { result } = renderHook(() => useWorkflowHistory())
    const expectedResult = { id: "new-node", name: "Test" }
    const command = createMockCommand(expectedResult, {
      redoFn: () => Promise.resolve(expectedResult),
    })

    let returnValue: typeof expectedResult | undefined

    await act(async () => {
      returnValue = await result.current.execute(command)
    })

    expect(returnValue).toEqual(expectedResult)
  })

  it("应该将命令添加到 undo 栈", async () => {
    const { result } = renderHook(() => useWorkflowHistory())
    const command = createMockCommand()

    await act(async () => {
      await result.current.execute(command)
    })

    expect(result.current.canUndo).toBe(true)
    expect(result.current.historySize).toBe(1)
  })

  it("应该清空 redo 栈", async () => {
    const { result } = renderHook(() => useWorkflowHistory())

    // 执行并撤销，创建 redo 栈
    await act(async () => {
      await result.current.execute(createMockCommand())
    })

    await act(async () => {
      await result.current.undo()
    })

    expect(result.current.canRedo).toBe(true)

    // 执行新命令应该清空 redo 栈
    await act(async () => {
      await result.current.execute(createMockCommand())
    })

    expect(result.current.canRedo).toBe(false)
  })

  it("应该支持同步的 redo 函数", async () => {
    const { result } = renderHook(() => useWorkflowHistory())
    const redoFn = vi.fn().mockReturnValue("sync-result")
    const command = createMockCommand("sync-result", { redoFn })

    let returnValue: string | undefined

    await act(async () => {
      returnValue = await result.current.execute(command)
    })

    expect(returnValue).toBe("sync-result")
    expect(result.current.historySize).toBe(1)
  })
})

// ========== undo 撤销测试 ==========

describe("useWorkflowHistory - undo 撤销", () => {
  it("应该执行命令的 undo 函数", async () => {
    const { result } = renderHook(() => useWorkflowHistory())
    const undoFn = vi.fn().mockResolvedValue(undefined)
    const command = createMockCommand(undefined, { undoFn })

    await act(async () => {
      await result.current.execute(command)
    })

    await act(async () => {
      await result.current.undo()
    })

    expect(undoFn).toHaveBeenCalledTimes(1)
  })

  it("应该将命令移到 redo 栈", async () => {
    const { result } = renderHook(() => useWorkflowHistory())

    await act(async () => {
      await result.current.execute(createMockCommand())
    })

    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)

    await act(async () => {
      await result.current.undo()
    })

    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)
  })

  it("应该在栈为空时不执行任何操作", async () => {
    const { result } = renderHook(() => useWorkflowHistory())

    await act(async () => {
      await result.current.undo()
    })

    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it("应该支持连续撤销", async () => {
    const { result } = renderHook(() => useWorkflowHistory())
    const undo1 = vi.fn()
    const undo2 = vi.fn()
    const undo3 = vi.fn()

    await act(async () => {
      await result.current.execute(createMockCommand(undefined, { undoFn: undo1 }))
      await result.current.execute(createMockCommand(undefined, { undoFn: undo2 }))
      await result.current.execute(createMockCommand(undefined, { undoFn: undo3 }))
    })

    expect(result.current.historySize).toBe(3)

    await act(async () => {
      await result.current.undo()
    })
    expect(undo3).toHaveBeenCalled()

    await act(async () => {
      await result.current.undo()
    })
    expect(undo2).toHaveBeenCalled()

    await act(async () => {
      await result.current.undo()
    })
    expect(undo1).toHaveBeenCalled()

    expect(result.current.historySize).toBe(0)
  })

  it("应该支持同步的 undo 函数", async () => {
    const { result } = renderHook(() => useWorkflowHistory())
    const undoFn = vi.fn()
    const command = createMockCommand(undefined, { undoFn })

    await act(async () => {
      await result.current.execute(command)
    })

    await act(async () => {
      await result.current.undo()
    })

    expect(undoFn).toHaveBeenCalled()
  })
})

// ========== redo 重做测试 ==========

describe("useWorkflowHistory - redo 重做", () => {
  it("应该执行命令的 redo 函数", async () => {
    const { result } = renderHook(() => useWorkflowHistory())
    const redoFn = vi.fn().mockResolvedValue(undefined)
    const command = createMockCommand(undefined, { redoFn })

    await act(async () => {
      await result.current.execute(command)
    })

    await act(async () => {
      await result.current.undo()
    })

    redoFn.mockClear()

    await act(async () => {
      await result.current.redo()
    })

    expect(redoFn).toHaveBeenCalledTimes(1)
  })

  it("应该将命令移回 undo 栈", async () => {
    const { result } = renderHook(() => useWorkflowHistory())

    await act(async () => {
      await result.current.execute(createMockCommand())
    })

    await act(async () => {
      await result.current.undo()
    })

    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(true)

    await act(async () => {
      await result.current.redo()
    })

    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)
  })

  it("应该在 redo 栈为空时不执行任何操作", async () => {
    const { result } = renderHook(() => useWorkflowHistory())

    await act(async () => {
      await result.current.redo()
    })

    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it("应该支持连续重做", async () => {
    const { result } = renderHook(() => useWorkflowHistory())
    const redo1 = vi.fn()
    const redo2 = vi.fn()
    const redo3 = vi.fn()

    await act(async () => {
      await result.current.execute(createMockCommand(undefined, { redoFn: redo1 }))
      await result.current.execute(createMockCommand(undefined, { redoFn: redo2 }))
      await result.current.execute(createMockCommand(undefined, { redoFn: redo3 }))
    })

    // 全部撤销
    await act(async () => {
      await result.current.undo()
      await result.current.undo()
      await result.current.undo()
    })

    // 清除初始执行的调用记录
    redo1.mockClear()
    redo2.mockClear()
    redo3.mockClear()

    // 按顺序重做（从最早到最新）
    await act(async () => {
      await result.current.redo()
    })
    expect(redo1).toHaveBeenCalled()

    await act(async () => {
      await result.current.redo()
    })
    expect(redo2).toHaveBeenCalled()

    await act(async () => {
      await result.current.redo()
    })
    expect(redo3).toHaveBeenCalled()
  })
})

// ========== maxSize 历史栈大小限制测试 ==========

describe("useWorkflowHistory - maxSize 限制", () => {
  it("应该限制 undo 栈大小", async () => {
    const { result } = renderHook(() => useWorkflowHistory({ maxSize: 3 }))

    await act(async () => {
      for (let i = 0; i < 5; i++) {
        await result.current.execute(createMockCommand())
      }
    })

    expect(result.current.historySize).toBe(3)
  })

  it("应该移除最旧的命令", async () => {
    const { result } = renderHook(() => useWorkflowHistory({ maxSize: 2 }))
    const undo1 = vi.fn()
    const undo2 = vi.fn()
    const undo3 = vi.fn()

    await act(async () => {
      await result.current.execute(createMockCommand(undefined, { undoFn: undo1 }))
      await result.current.execute(createMockCommand(undefined, { undoFn: undo2 }))
      await result.current.execute(createMockCommand(undefined, { undoFn: undo3 }))
    })

    // 撤销两次应该调用 undo3 和 undo2，undo1 应该已被移除
    await act(async () => {
      await result.current.undo()
    })
    expect(undo3).toHaveBeenCalled()

    await act(async () => {
      await result.current.undo()
    })
    expect(undo2).toHaveBeenCalled()

    // 不应该还能撤销
    expect(result.current.canUndo).toBe(false)
    expect(undo1).not.toHaveBeenCalled()
  })

  it("重做时也应该遵守 maxSize 限制", async () => {
    const { result } = renderHook(() => useWorkflowHistory({ maxSize: 2 }))

    await act(async () => {
      await result.current.execute(createMockCommand())
      await result.current.execute(createMockCommand())
    })

    await act(async () => {
      await result.current.undo()
      await result.current.undo()
    })

    await act(async () => {
      await result.current.redo()
      await result.current.redo()
    })

    expect(result.current.historySize).toBe(2)
  })

  it("默认 maxSize 应该是 50", async () => {
    const { result } = renderHook(() => useWorkflowHistory())

    await act(async () => {
      for (let i = 0; i < 60; i++) {
        await result.current.execute(createMockCommand())
      }
    })

    expect(result.current.historySize).toBe(50)
  })
})

// ========== clear 清空历史测试 ==========

describe("useWorkflowHistory - clear 清空历史", () => {
  it("应该清空 undo 栈", async () => {
    const { result } = renderHook(() => useWorkflowHistory())

    await act(async () => {
      await result.current.execute(createMockCommand())
      await result.current.execute(createMockCommand())
    })

    expect(result.current.historySize).toBe(2)

    act(() => {
      result.current.clear()
    })

    expect(result.current.historySize).toBe(0)
    expect(result.current.canUndo).toBe(false)
  })

  it("应该清空 redo 栈", async () => {
    const { result } = renderHook(() => useWorkflowHistory())

    await act(async () => {
      await result.current.execute(createMockCommand())
    })

    await act(async () => {
      await result.current.undo()
    })

    expect(result.current.canRedo).toBe(true)

    act(() => {
      result.current.clear()
    })

    expect(result.current.canRedo).toBe(false)
  })
})

// ========== 状态标志测试 ==========

describe("useWorkflowHistory - 状态标志", () => {
  it("canUndo 应该正确反映状态", async () => {
    const { result } = renderHook(() => useWorkflowHistory())

    expect(result.current.canUndo).toBe(false)

    await act(async () => {
      await result.current.execute(createMockCommand())
    })
    expect(result.current.canUndo).toBe(true)

    await act(async () => {
      await result.current.undo()
    })
    expect(result.current.canUndo).toBe(false)
  })

  it("canRedo 应该正确反映状态", async () => {
    const { result } = renderHook(() => useWorkflowHistory())

    expect(result.current.canRedo).toBe(false)

    await act(async () => {
      await result.current.execute(createMockCommand())
    })
    expect(result.current.canRedo).toBe(false)

    await act(async () => {
      await result.current.undo()
    })
    expect(result.current.canRedo).toBe(true)

    await act(async () => {
      await result.current.redo()
    })
    expect(result.current.canRedo).toBe(false)
  })

  it("historySize 应该正确反映 undo 栈大小", async () => {
    const { result } = renderHook(() => useWorkflowHistory())

    expect(result.current.historySize).toBe(0)

    await act(async () => {
      await result.current.execute(createMockCommand())
    })
    expect(result.current.historySize).toBe(1)

    await act(async () => {
      await result.current.execute(createMockCommand())
    })
    expect(result.current.historySize).toBe(2)

    await act(async () => {
      await result.current.undo()
    })
    expect(result.current.historySize).toBe(1)
  })
})

// ========== 撤销/重做交织测试 ==========

describe("useWorkflowHistory - 撤销/重做交织操作", () => {
  it("应该正确处理撤销-重做-撤销序列", async () => {
    const { result } = renderHook(() => useWorkflowHistory())
    const redo1 = vi.fn()
    const undo1 = vi.fn()

    await act(async () => {
      await result.current.execute(createMockCommand(undefined, { redoFn: redo1, undoFn: undo1 }))
    })

    // 撤销
    await act(async () => {
      await result.current.undo()
    })
    expect(undo1).toHaveBeenCalledTimes(1)

    // 重做
    redo1.mockClear()
    await act(async () => {
      await result.current.redo()
    })
    expect(redo1).toHaveBeenCalledTimes(1)

    // 再次撤销
    undo1.mockClear()
    await act(async () => {
      await result.current.undo()
    })
    expect(undo1).toHaveBeenCalledTimes(1)
  })

  it("应该正确处理复杂的撤销/重做序列", async () => {
    const { result } = renderHook(() => useWorkflowHistory())
    const commands: WorkflowCommand[] = []

    for (let i = 0; i < 5; i++) {
      commands.push(
        createMockCommand(undefined, {
          description: `Command ${i}`,
        })
      )
    }

    // 执行 5 个命令
    await act(async () => {
      for (const cmd of commands) {
        await result.current.execute(cmd)
      }
    })

    expect(result.current.historySize).toBe(5)

    // 撤销 3 个
    await act(async () => {
      await result.current.undo()
      await result.current.undo()
      await result.current.undo()
    })

    expect(result.current.historySize).toBe(2)
    expect(result.current.canRedo).toBe(true)

    // 重做 1 个
    await act(async () => {
      await result.current.redo()
    })

    expect(result.current.historySize).toBe(3)

    // 执行新命令应该清空剩余的 redo 栈
    await act(async () => {
      await result.current.execute(createMockCommand())
    })

    expect(result.current.historySize).toBe(4)
    expect(result.current.canRedo).toBe(false)
  })
})

// ========== 异步命令测试 ==========

describe("useWorkflowHistory - 异步命令", () => {
  it("应该等待异步 redo 完成", async () => {
    const { result } = renderHook(() => useWorkflowHistory())
    let resolved = false

    const command = createMockCommand(undefined, {
      redoFn: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        resolved = true
      },
    })

    await act(async () => {
      await result.current.execute(command)
    })

    expect(resolved).toBe(true)
  })

  it("应该等待异步 undo 完成", async () => {
    const { result } = renderHook(() => useWorkflowHistory())
    let undone = false

    const command = createMockCommand(undefined, {
      undoFn: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        undone = true
      },
    })

    await act(async () => {
      await result.current.execute(command)
    })

    await act(async () => {
      await result.current.undo()
    })

    expect(undone).toBe(true)
  })
})

// ========== 类型化返回值测试 ==========

describe("useWorkflowHistory - 类型化返回值", () => {
  it("应该正确返回字符串类型", async () => {
    const { result } = renderHook(() => useWorkflowHistory())
    const command = createMockCommand<string>("hello", {
      redoFn: () => "hello",
    })

    let value: string | undefined

    await act(async () => {
      value = await result.current.execute(command)
    })

    expect(value).toBe("hello")
  })

  it("应该正确返回对象类型", async () => {
    const { result } = renderHook(() => useWorkflowHistory())
    interface Node {
      id: string
      name: string
    }
    const expectedNode: Node = { id: "123", name: "Test Node" }
    const command = createMockCommand<Node>(expectedNode, {
      redoFn: () => expectedNode,
    })

    let node: Node | undefined

    await act(async () => {
      node = await result.current.execute(command)
    })

    expect(node).toEqual(expectedNode)
  })

  it("应该正确返回数组类型", async () => {
    const { result } = renderHook(() => useWorkflowHistory())
    const expectedArray = [1, 2, 3]
    const command = createMockCommand<number[]>(expectedArray, {
      redoFn: () => expectedArray,
    })

    let arr: number[] | undefined

    await act(async () => {
      arr = await result.current.execute(command)
    })

    expect(arr).toEqual(expectedArray)
  })
})

// ========== 边界情况测试 ==========

describe("useWorkflowHistory - 边界情况", () => {
  it("maxSize 为 1 时应该只保留最新命令", async () => {
    const { result } = renderHook(() => useWorkflowHistory({ maxSize: 1 }))

    await act(async () => {
      await result.current.execute(createMockCommand())
      await result.current.execute(createMockCommand())
      await result.current.execute(createMockCommand())
    })

    expect(result.current.historySize).toBe(1)
  })

  it("应该处理 maxSize 为 0 的情况", async () => {
    // maxSize 为 0 时不应保存任何历史
    const { result } = renderHook(() => useWorkflowHistory({ maxSize: 0 }))

    await act(async () => {
      await result.current.execute(createMockCommand())
    })

    expect(result.current.historySize).toBe(0)
    expect(result.current.canUndo).toBe(false)
  })

  it("快速连续执行应该正确处理", async () => {
    const { result } = renderHook(() => useWorkflowHistory())
    const commands = Array.from({ length: 10 }, () => createMockCommand())

    await act(async () => {
      await Promise.all(commands.map((cmd) => result.current.execute(cmd)))
    })

    // 由于是并行执行，historySize 可能小于 10（取决于执行顺序）
    // 但不应该抛出错误
    expect(result.current.historySize).toBeGreaterThan(0)
  })

  it("在没有命令时调用 clear 应该安全", () => {
    const { result } = renderHook(() => useWorkflowHistory())

    act(() => {
      result.current.clear()
    })

    expect(result.current.historySize).toBe(0)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })
})

