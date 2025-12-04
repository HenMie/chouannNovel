// lib/utils.ts 工具函数测试

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { 
  cn, 
  debounce, 
  throttle, 
  useDebouncedValue, 
  useDebouncedCallback, 
  useThrottledCallback 
} from "../utils"

// ========== cn 函数测试 ==========

describe("cn - 类名合并函数", () => {
  it("应该合并多个类名", () => {
    const result = cn("class1", "class2")
    expect(result).toBe("class1 class2")
  })

  it("应该处理条件类名", () => {
    const isActive = true
    const isDisabled = false
    const result = cn("base", isActive && "active", isDisabled && "disabled")
    expect(result).toBe("base active")
  })

  it("应该处理 Tailwind CSS 类名冲突", () => {
    // 后面的类应该覆盖前面的
    const result = cn("px-2 py-1", "px-4")
    expect(result).toBe("py-1 px-4")
  })

  it("应该处理空值和 undefined", () => {
    const result = cn("class1", null, undefined, "class2")
    expect(result).toBe("class1 class2")
  })

  it("应该处理对象形式的类名", () => {
    const result = cn({ active: true, disabled: false, "text-red": true })
    expect(result).toBe("active text-red")
  })

  it("应该处理数组形式的类名", () => {
    const result = cn(["class1", "class2"], "class3")
    expect(result).toBe("class1 class2 class3")
  })

  it("应该返回空字符串当没有有效类名时", () => {
    const result = cn(null, undefined, false)
    expect(result).toBe("")
  })
})

// ========== debounce 函数测试 ==========

describe("debounce - 防抖函数", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("应该在延迟后执行函数", () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn()
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("应该合并多次调用", () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn()
    debouncedFn()
    debouncedFn()

    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("应该使用最后一次调用的参数", () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn("first")
    debouncedFn("second")
    debouncedFn("third")

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledWith("third")
  })

  it("应该能够取消延迟执行", () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn()
    debouncedFn.cancel()

    vi.advanceTimersByTime(100)
    expect(fn).not.toHaveBeenCalled()
  })

  it("连续调用应该重置计时器", () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn()
    vi.advanceTimersByTime(50)
    
    debouncedFn() // 重置计时器
    vi.advanceTimersByTime(50)
    
    expect(fn).not.toHaveBeenCalled()
    
    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("多次调用 cancel 应该是安全的", () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn()
    debouncedFn.cancel()
    debouncedFn.cancel() // 再次调用 cancel

    vi.advanceTimersByTime(100)
    expect(fn).not.toHaveBeenCalled()
  })
})

// ========== throttle 函数测试 ==========

describe("throttle - 节流函数", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("应该立即执行第一次调用", () => {
    const fn = vi.fn()
    const throttledFn = throttle(fn, 100)

    throttledFn()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("应该在时间限制内忽略额外调用", () => {
    const fn = vi.fn()
    const throttledFn = throttle(fn, 100)

    throttledFn()
    throttledFn()
    throttledFn()

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("应该执行尾调用", () => {
    const fn = vi.fn()
    const throttledFn = throttle(fn, 100)

    throttledFn("first")
    throttledFn("second")
    throttledFn("third")

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith("first")

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith("third")
  })

  it("时间限制后应该能够再次执行", () => {
    const fn = vi.fn()
    const throttledFn = throttle(fn, 100)

    throttledFn("first")
    expect(fn).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(100)

    throttledFn("second")
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith("second")
  })

  it("应该能够取消待执行的调用", () => {
    const fn = vi.fn()
    const throttledFn = throttle(fn, 100)

    throttledFn("first")
    throttledFn("second") // 这个会被安排为尾调用
    
    throttledFn.cancel()

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith("first")
  })

  it("应该保持正确的时间间隔", () => {
    const fn = vi.fn()
    const throttledFn = throttle(fn, 100)

    throttledFn("call1") // 立即执行
    expect(fn).toHaveBeenCalledTimes(1)
    
    vi.advanceTimersByTime(50)
    throttledFn("call2") // 安排尾调用
    
    vi.advanceTimersByTime(50)
    // 100ms 后尾调用执行
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith("call2")
    
    // 再等 100ms 后才能立即执行
    vi.advanceTimersByTime(100)
    throttledFn("call3") // 此时应该立即执行
    expect(fn).toHaveBeenCalledTimes(3)
    expect(fn).toHaveBeenLastCalledWith("call3")
  })
})

// ========== useDebouncedValue Hook 测试 ==========

describe("useDebouncedValue - 防抖值 Hook", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("应该延迟更新值", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: "initial", delay: 100 } }
    )

    // 初始值应该立即返回
    expect(result.current).toBe("initial")

    // 更新值
    rerender({ value: "updated", delay: 100 })
    
    // 立即检查，值应该还是旧的
    expect(result.current).toBe("initial")

    // 等待延迟时间
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // 现在应该是新值了
    expect(result.current).toBe("updated")
  })

  it("多次快速更新应该只使用最后一个值", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: "v1", delay: 100 } }
    )

    // 快速更新多次
    rerender({ value: "v2", delay: 100 })
    act(() => { vi.advanceTimersByTime(30) })
    
    rerender({ value: "v3", delay: 100 })
    act(() => { vi.advanceTimersByTime(30) })
    
    rerender({ value: "v4", delay: 100 })
    
    // 值还是初始值
    expect(result.current).toBe("v1")

    // 等待延迟时间
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // 应该是最后一个值
    expect(result.current).toBe("v4")
  })

  it("delay 变化时应该重新计时", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: "initial", delay: 100 } }
    )

    // 更新值
    rerender({ value: "updated", delay: 100 })
    
    // 等待 50ms
    act(() => { vi.advanceTimersByTime(50) })
    
    // 改变 delay，会重新设置定时器
    rerender({ value: "updated", delay: 200 })
    
    // 再等 50ms（总共 100ms），值不应该更新因为 delay 变了
    act(() => { vi.advanceTimersByTime(50) })
    expect(result.current).toBe("initial")
    
    // 再等 150ms，现在应该更新了
    act(() => { vi.advanceTimersByTime(150) })
    expect(result.current).toBe("updated")
  })

  it("组件卸载时应该清除定时器", () => {
    const { result, rerender, unmount } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: "initial", delay: 100 } }
    )

    rerender({ value: "updated", delay: 100 })
    
    // 卸载组件
    unmount()
    
    // 等待时间后不应该报错
    act(() => {
      vi.advanceTimersByTime(100)
    })
    
    // 没有错误发生即为通过
    expect(result.current).toBe("initial")
  })

  it("应该支持各种类型的值", () => {
    // 测试数字
    const { result: numResult, rerender: numRerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 0, delay: 100 } }
    )
    expect(numResult.current).toBe(0)
    numRerender({ value: 42, delay: 100 })
    act(() => { vi.advanceTimersByTime(100) })
    expect(numResult.current).toBe(42)

    // 测试对象
    const obj1 = { name: "test" }
    const obj2 = { name: "updated" }
    const { result: objResult, rerender: objRerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: obj1, delay: 100 } }
    )
    expect(objResult.current).toBe(obj1)
    objRerender({ value: obj2, delay: 100 })
    act(() => { vi.advanceTimersByTime(100) })
    expect(objResult.current).toBe(obj2)
  })
})

// ========== useDebouncedCallback Hook 测试 ==========

describe("useDebouncedCallback - 防抖回调 Hook", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("应该延迟执行回调", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(callback, 100))

    // 调用防抖回调
    act(() => {
      result.current("arg1")
    })

    // 立即检查，回调不应该被执行
    expect(callback).not.toHaveBeenCalled()

    // 等待延迟时间
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // 现在回调应该被执行了
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("arg1")
  })

  it("多次快速调用应该只执行最后一次", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(callback, 100))

    // 快速调用多次
    act(() => {
      result.current("first")
      result.current("second")
      result.current("third")
    })

    // 等待延迟时间
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // 只应该执行一次，使用最后一次的参数
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("third")
  })

  it("连续调用应该重置计时器", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(callback, 100))

    act(() => { result.current("call1") })
    
    // 等待 50ms
    act(() => { vi.advanceTimersByTime(50) })
    
    // 再次调用，重置计时器
    act(() => { result.current("call2") })
    
    // 再等 50ms，总共 100ms，但计时器被重置了
    act(() => { vi.advanceTimersByTime(50) })
    expect(callback).not.toHaveBeenCalled()
    
    // 再等 50ms
    act(() => { vi.advanceTimersByTime(50) })
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("call2")
  })

  it("组件卸载时应该清除定时器", () => {
    const callback = vi.fn()
    const { result, unmount } = renderHook(() => useDebouncedCallback(callback, 100))

    act(() => { result.current() })
    
    // 卸载组件
    unmount()
    
    // 等待时间后回调不应该被执行
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(callback).not.toHaveBeenCalled()
  })

  it("deps 变化时应该更新回调引用", () => {
    let multiplier = 2
    const callback = vi.fn((x: number) => x * multiplier)
    
    const { result, rerender } = renderHook(
      ({ deps }) => useDebouncedCallback(callback, 100, deps),
      { initialProps: { deps: [multiplier] } }
    )

    // 第一次调用
    act(() => { result.current(5) })
    act(() => { vi.advanceTimersByTime(100) })
    expect(callback).toHaveBeenLastCalledWith(5)
    
    // 改变 deps
    multiplier = 3
    rerender({ deps: [multiplier] })
    
    // 新的调用
    act(() => { result.current(5) })
    act(() => { vi.advanceTimersByTime(100) })
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it("应该支持多个参数", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(callback, 100))

    act(() => { result.current("arg1", "arg2", 123) })
    act(() => { vi.advanceTimersByTime(100) })

    expect(callback).toHaveBeenCalledWith("arg1", "arg2", 123)
  })
})

// ========== useThrottledCallback Hook 测试 ==========

describe("useThrottledCallback - 节流回调 Hook", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("第一次调用应该立即执行", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useThrottledCallback(callback, 100))

    act(() => {
      result.current("immediate")
    })

    // 应该立即执行
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("immediate")
  })

  it("时间限制内的后续调用应该被节流", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useThrottledCallback(callback, 100))

    // 第一次立即执行
    act(() => { result.current("first") })
    expect(callback).toHaveBeenCalledTimes(1)

    // 后续调用应该被节流
    act(() => { result.current("second") })
    act(() => { result.current("third") })
    
    // 还是只有一次
    expect(callback).toHaveBeenCalledTimes(1)

    // 等待节流时间后应该执行尾调用
    act(() => { vi.advanceTimersByTime(100) })
    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenLastCalledWith("third")
  })

  it("时间限制后应该允许新的立即执行", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useThrottledCallback(callback, 100))

    act(() => { result.current("first") })
    expect(callback).toHaveBeenCalledTimes(1)

    // 等待节流时间
    act(() => { vi.advanceTimersByTime(100) })

    // 新的调用应该立即执行
    act(() => { result.current("second") })
    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenLastCalledWith("second")
  })

  it("组件卸载时应该清除定时器", () => {
    const callback = vi.fn()
    const { result, unmount } = renderHook(() => useThrottledCallback(callback, 100))

    // 第一次调用
    act(() => { result.current("first") })
    expect(callback).toHaveBeenCalledTimes(1)
    
    // 触发尾调用
    act(() => { result.current("second") })

    // 卸载组件
    unmount()
    
    // 等待时间后尾调用不应该被执行
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it("deps 变化时应该更新回调引用", () => {
    const callback = vi.fn()
    
    const { result, rerender } = renderHook(
      ({ deps }) => useThrottledCallback(callback, 100, deps),
      { initialProps: { deps: [1] } }
    )

    // 第一次调用
    act(() => { result.current("v1") })
    expect(callback).toHaveBeenCalledWith("v1")
    
    // 改变 deps
    rerender({ deps: [2] })
    
    // 等待节流时间
    act(() => { vi.advanceTimersByTime(100) })
    
    // 新的调用
    act(() => { result.current("v2") })
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it("应该正确处理尾调用参数", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useThrottledCallback(callback, 100))

    // 第一次立即执行
    act(() => { result.current("first") })
    
    // 后续调用被节流，但最后一次会作为尾调用
    act(() => { vi.advanceTimersByTime(30) })
    act(() => { result.current("second") })
    
    act(() => { vi.advanceTimersByTime(30) })
    act(() => { result.current("third") })

    // 等待尾调用执行
    act(() => { vi.advanceTimersByTime(40) })
    
    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenNthCalledWith(1, "first")
    expect(callback).toHaveBeenNthCalledWith(2, "third")
  })

  it("应该支持多个参数", () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useThrottledCallback(callback, 100))

    act(() => { result.current("arg1", "arg2", { key: "value" }) })

    expect(callback).toHaveBeenCalledWith("arg1", "arg2", { key: "value" })
  })
})

