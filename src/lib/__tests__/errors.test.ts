// lib/errors.ts 错误处理测试
// 测试所有错误处理相关函数

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  getErrorMessage,
  logError,
  handleAppError,
  handleUnexpectedError,
} from "../errors"

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}))

import { toast } from "sonner"

// ========== getErrorMessage 测试 ==========

describe("getErrorMessage - 提取错误信息", () => {
  it("应该返回 fallback 当 error 为 null", () => {
    expect(getErrorMessage(null)).toBe("未知错误")
    expect(getErrorMessage(null, "自定义兜底")).toBe("自定义兜底")
  })

  it("应该返回 fallback 当 error 为 undefined", () => {
    expect(getErrorMessage(undefined)).toBe("未知错误")
    expect(getErrorMessage(undefined, "自定义兜底")).toBe("自定义兜底")
  })

  it("应该返回 fallback 当 error 为空字符串", () => {
    // 空字符串是 falsy，应该返回 fallback
    expect(getErrorMessage("")).toBe("未知错误")
  })

  it("应该返回 fallback 当 error 为 0", () => {
    // 0 是 falsy，应该返回 fallback
    expect(getErrorMessage(0)).toBe("未知错误")
  })

  it("应该返回 fallback 当 error 为 false", () => {
    // false 是 falsy，应该返回 fallback
    expect(getErrorMessage(false)).toBe("未知错误")
  })

  it("应该直接返回字符串类型的错误", () => {
    expect(getErrorMessage("这是一个错误")).toBe("这是一个错误")
    expect(getErrorMessage("Error message")).toBe("Error message")
  })

  it("应该返回 Error 实例的 message", () => {
    const error = new Error("错误信息")
    expect(getErrorMessage(error)).toBe("错误信息")
  })

  it("应该返回 Error 实例的空 message 时使用 fallback", () => {
    const error = new Error("")
    expect(getErrorMessage(error)).toBe("未知错误")
  })

  it("应该处理自定义 Error 类", () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message)
        this.name = "CustomError"
      }
    }
    const error = new CustomError("自定义错误")
    expect(getErrorMessage(error)).toBe("自定义错误")
  })

  it("应该提取对象的 message 属性", () => {
    const error = { message: "对象错误信息" }
    expect(getErrorMessage(error)).toBe("对象错误信息")
  })

  it("应该处理对象 message 属性为空字符串的情况", () => {
    const error = { message: "" }
    // 空字符串 trim 后为空，应该走 JSON.stringify
    expect(getErrorMessage(error)).toBe('{"message":""}')
  })

  it("应该处理对象 message 属性为空白字符串的情况", () => {
    const error = { message: "   " }
    // 空白字符串 trim 后为空，应该走 JSON.stringify
    expect(getErrorMessage(error)).toBe('{"message":"   "}')
  })

  it("应该处理对象 message 属性非字符串的情况", () => {
    const error = { message: 123 }
    expect(getErrorMessage(error)).toBe('{"message":123}')
  })

  it("应该处理没有 message 属性的对象", () => {
    const error = { code: 500, detail: "服务器错误" }
    expect(getErrorMessage(error)).toBe('{"code":500,"detail":"服务器错误"}')
  })

  it("应该处理空对象", () => {
    expect(getErrorMessage({})).toBe("{}")
  })

  it("应该处理数组", () => {
    expect(getErrorMessage([1, 2, 3])).toBe("[1,2,3]")
  })

  it("应该处理包含循环引用的对象返回 fallback", () => {
    const error: Record<string, unknown> = { a: 1 }
    error.self = error // 循环引用
    expect(getErrorMessage(error)).toBe("未知错误")
  })

  it("应该处理数字（非零）", () => {
    expect(getErrorMessage(42)).toBe("42")
    expect(getErrorMessage(-1)).toBe("-1")
  })

  it("应该处理 boolean true", () => {
    expect(getErrorMessage(true)).toBe("true")
  })

  it("应该处理 Symbol", () => {
    const sym = Symbol("test")
    // Symbol 被 JSON.stringify 返回 undefined（非抛出）
    // 这是一个边界情况，当前实现会返回 undefined
    const result = getErrorMessage(sym)
    // 验证函数不会抛出异常
    expect(() => getErrorMessage(sym)).not.toThrow()
  })

  it("应该处理 BigInt（返回 fallback）", () => {
    const big = BigInt(9007199254740991)
    // BigInt 无法 JSON.stringify，会抛出错误
    expect(getErrorMessage(big)).toBe("未知错误")
  })

  it("应该使用自定义 fallback", () => {
    expect(getErrorMessage(null, "自定义错误")).toBe("自定义错误")
    expect(getErrorMessage(undefined, "操作失败")).toBe("操作失败")
  })
})

// ========== logError 测试 ==========

describe("logError - 记录错误日志", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it("应该记录错误并返回消息", () => {
    const error = new Error("测试错误")
    const result = logError({ error })

    expect(result).toBe("测试错误")
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it("应该使用 context 作为前缀", () => {
    const error = new Error("测试错误")
    logError({ error, context: "TestModule" })

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[TestModule]",
      "测试错误",
      error
    )
  })

  it("没有 context 时应该使用默认前缀", () => {
    const error = new Error("测试错误")
    logError({ error })

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[错误]",
      "测试错误",
      error
    )
  })

  it("应该在有 payload 时包含 payload", () => {
    const error = new Error("测试错误")
    const payload = { userId: 123, action: "save" }
    logError({ error, context: "Test", payload })

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[Test]",
      "测试错误",
      payload,
      error
    )
  })

  it("应该在没有 payload 时不包含 payload", () => {
    const error = new Error("测试错误")
    logError({ error, context: "Test" })

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[Test]",
      "测试错误",
      error
    )
    // 确保只有 3 个参数
    expect(consoleErrorSpy.mock.calls[0].length).toBe(3)
  })

  it("应该处理字符串类型的错误", () => {
    const result = logError({ error: "字符串错误" })

    expect(result).toBe("字符串错误")
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it("应该处理 null 错误", () => {
    const result = logError({ error: null })

    expect(result).toBe("未知错误")
  })

  it("应该处理对象类型的错误", () => {
    const error = { code: "ERR_001", message: "业务错误" }
    const result = logError({ error })

    expect(result).toBe("业务错误")
  })
})

// ========== handleAppError 测试 ==========

describe("handleAppError - 统一错误处理", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(toast.error).mockClear()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it("应该记录错误并显示 toast", () => {
    const error = new Error("操作失败")
    const result = handleAppError({ error })

    expect(result).toBe("操作失败")
    expect(toast.error).toHaveBeenCalledWith("操作失败")
  })

  it("应该使用自定义 toastMessage", () => {
    const error = new Error("内部错误")
    handleAppError({ error, toastMessage: "用户友好的提示" })

    expect(toast.error).toHaveBeenCalledWith("用户友好的提示")
  })

  it("应该在 silent 模式下不显示 toast", () => {
    const error = new Error("静默错误")
    handleAppError({ error, silent: true })

    expect(toast.error).not.toHaveBeenCalled()
  })

  it("应该传递 context 和 payload 给 logError", () => {
    const error = new Error("测试错误")
    const payload = { key: "value" }
    handleAppError({ error, context: "TestContext", payload })

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[TestContext]",
      "测试错误",
      payload,
      error
    )
  })

  it("应该使用 fallbackMessage 当错误消息为空", () => {
    const result = handleAppError({
      error: null,
      fallbackMessage: "自定义兜底消息",
    })

    // logError 返回 "未知错误"，不是空的，所以不会使用 fallbackMessage
    // 但 toast 会显示消息
    expect(result).toBe("未知错误")
    expect(toast.error).toHaveBeenCalledWith("未知错误")
  })

  it("应该使用默认 fallbackMessage", () => {
    // 当 error 为 null 时，logError 返回 "未知错误"
    handleAppError({ error: null })

    expect(toast.error).toHaveBeenCalledWith("未知错误")
  })

  it("应该返回消息字符串", () => {
    const result = handleAppError({ error: "字符串错误" })

    expect(typeof result).toBe("string")
    expect(result).toBe("字符串错误")
  })

  it("toastMessage 优先于 message", () => {
    const error = new Error("原始错误")
    handleAppError({
      error,
      toastMessage: "自定义 toast 消息",
    })

    expect(toast.error).toHaveBeenCalledWith("自定义 toast 消息")
  })

  it("应该处理所有参数组合", () => {
    const error = new Error("完整测试")
    const result = handleAppError({
      error,
      context: "CompleteTest",
      payload: { test: true },
      fallbackMessage: "兜底",
      toastMessage: "提示",
      silent: false,
    })

    expect(result).toBe("完整测试")
    expect(toast.error).toHaveBeenCalledWith("提示")
    expect(consoleErrorSpy).toHaveBeenCalled()
  })
})

// ========== handleUnexpectedError 测试 ==========

describe("handleUnexpectedError - 全局未捕获错误处理", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(toast.error).mockClear()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it("应该使用默认 context", () => {
    const error = new Error("未捕获错误")
    handleUnexpectedError(error)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[未捕获异常]",
      "未捕获错误",
      error
    )
  })

  it("应该使用自定义 context", () => {
    const error = new Error("Promise 错误")
    handleUnexpectedError(error, "unhandledrejection")

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[unhandledrejection]",
      "Promise 错误",
      error
    )
  })

  it("应该显示固定的 toast 消息", () => {
    const error = new Error("任意错误")
    handleUnexpectedError(error)

    expect(toast.error).toHaveBeenCalledWith(
      "应用出现异常，已记录，请尝试重试或反馈问题"
    )
  })

  it("应该返回错误消息", () => {
    const error = new Error("返回值测试")
    const result = handleUnexpectedError(error)

    expect(result).toBe("返回值测试")
  })

  it("应该处理各种类型的错误", () => {
    // 字符串错误
    expect(handleUnexpectedError("字符串异常")).toBe("字符串异常")

    // 对象错误
    expect(handleUnexpectedError({ message: "对象异常" })).toBe("对象异常")

    // null
    expect(handleUnexpectedError(null)).toBe("未知错误")
  })

  it("toast 消息不应该根据错误内容变化", () => {
    handleUnexpectedError("错误1")
    handleUnexpectedError(new Error("错误2"))
    handleUnexpectedError({ message: "错误3" })

    // 所有调用都应该使用相同的 toast 消息
    const calls = vi.mocked(toast.error).mock.calls
    expect(calls.every(call => call[0] === "应用出现异常，已记录，请尝试重试或反馈问题")).toBe(true)
  })
})

// ========== 集成测试 ==========

describe("错误处理 - 集成测试", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(toast.error).mockClear()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it("应该正确处理模拟的 API 错误", () => {
    // 模拟 API 返回的错误
    const apiError = {
      status: 500,
      message: "Internal Server Error",
      data: { code: "ERR_500" },
    }

    const result = handleAppError({
      error: apiError,
      context: "API",
      payload: { endpoint: "/api/data" },
      toastMessage: "服务器错误，请稍后重试",
    })

    expect(result).toBe("Internal Server Error")
    expect(toast.error).toHaveBeenCalledWith("服务器错误，请稍后重试")
  })

  it("应该正确处理网络错误", () => {
    const networkError = new TypeError("Failed to fetch")

    const result = handleAppError({
      error: networkError,
      context: "Network",
      toastMessage: "网络连接失败",
    })

    expect(result).toBe("Failed to fetch")
    expect(toast.error).toHaveBeenCalledWith("网络连接失败")
  })

  it("应该正确处理 Promise rejection", () => {
    const rejectionReason = { code: "TIMEOUT", message: "请求超时" }

    const result = handleUnexpectedError(rejectionReason, "unhandledrejection")

    expect(result).toBe("请求超时")
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[unhandledrejection]",
      "请求超时",
      rejectionReason
    )
  })
})

