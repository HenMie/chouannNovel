// lib/utils.ts 工具函数测试

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cn, debounce, throttle } from "../utils"

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

