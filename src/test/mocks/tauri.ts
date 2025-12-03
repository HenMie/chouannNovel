// Tauri API Mock
// 用于单元测试中模拟 Tauri 原生 API

import { vi } from "vitest"

// invoke 调用的返回值映射
const invokeHandlers: Record<string, (...args: unknown[]) => unknown> = {}

/**
 * 注册 invoke 处理函数
 * @param command 命令名称
 * @param handler 处理函数
 */
export function registerInvokeHandler(
  command: string,
  handler: (...args: unknown[]) => unknown
): void {
  invokeHandlers[command] = handler
}

/**
 * 清除所有 invoke 处理函数
 */
export function clearInvokeHandlers(): void {
  Object.keys(invokeHandlers).forEach((key) => delete invokeHandlers[key])
}

/**
 * 模拟的 invoke 函数
 */
export const mockInvoke = vi.fn(
  async (command: string, args?: Record<string, unknown>) => {
    const handler = invokeHandlers[command]
    if (handler) {
      return handler(args)
    }
    throw new Error(`未注册的 invoke 命令: ${command}`)
  }
)

/**
 * 模拟的 convertFileSrc 函数
 */
export const mockConvertFileSrc = vi.fn((src: string) => src)

/**
 * 获取 Tauri API mock 对象
 */
export function getTauriMock() {
  return {
    invoke: mockInvoke,
    convertFileSrc: mockConvertFileSrc,
  }
}

/**
 * 重置所有 Tauri mock
 */
export function resetTauriMocks(): void {
  mockInvoke.mockClear()
  mockConvertFileSrc.mockClear()
  clearInvokeHandlers()
}

