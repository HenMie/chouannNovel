// AI 服务 Mock
// 用于单元测试中模拟 AI API 调用

import { vi } from "vitest"
import type { Message, StreamChunk, AIRequestOptions } from "@/lib/ai/types"

// ========== 预设响应 ==========

interface MockAIResponse {
  content: string
  delay?: number // 模拟延迟（毫秒）
}

// 默认响应
let defaultResponse: MockAIResponse = {
  content: "这是一个模拟的 AI 响应",
  delay: 0,
}

// 按提示词匹配的响应
const responsesByPrompt: Map<string, MockAIResponse> = new Map()

// ========== 配置函数 ==========

/**
 * 设置默认 AI 响应
 */
export function setDefaultAIResponse(response: MockAIResponse): void {
  defaultResponse = response
}

/**
 * 根据提示词设置响应
 * @param promptPattern 提示词包含的文本
 * @param response 响应内容
 */
export function setAIResponseForPrompt(
  promptPattern: string,
  response: MockAIResponse
): void {
  responsesByPrompt.set(promptPattern, response)
}

/**
 * 清除所有自定义响应
 */
export function clearAIResponses(): void {
  responsesByPrompt.clear()
  defaultResponse = {
    content: "这是一个模拟的 AI 响应",
    delay: 0,
  }
}

// ========== 辅助函数 ==========

/**
 * 根据消息查找匹配的响应
 */
function findMatchingResponse(messages: Message[]): MockAIResponse {
  // 合并所有消息内容用于匹配
  const allContent = messages.map((m) => m.content).join(" ")

  // 查找匹配的响应
  for (const [pattern, response] of responsesByPrompt) {
    if (allContent.includes(pattern)) {
      return response
    }
  }

  return defaultResponse
}

/**
 * 模拟延迟
 */
async function delay(ms: number): Promise<void> {
  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ========== Mock 函数 ==========

/**
 * Mock chatStream 函数
 */
export const mockChatStream = vi.fn(
  async (
    options: AIRequestOptions,
    _globalConfig: unknown,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> => {
    const response = findMatchingResponse(options.messages)

    // 模拟延迟
    await delay(response.delay || 0)

    // 模拟流式输出
    const words = response.content.split("")
    for (let i = 0; i < words.length; i++) {
      onChunk({
        content: words[i],
        done: false,
      })
      // 每个字符之间的小延迟
      await delay(1)
    }

    // 发送完成信号
    onChunk({
      content: "",
      done: true,
    })
  }
)

/**
 * Mock chatOnce 函数（非流式）
 */
export const mockChatOnce = vi.fn(
  async (options: AIRequestOptions): Promise<string> => {
    const response = findMatchingResponse(options.messages)
    await delay(response.delay || 0)
    return response.content
  }
)

/**
 * 获取 AI Mock 模块
 */
export function getAIMock() {
  return {
    chatStream: mockChatStream,
    chatOnce: mockChatOnce,
  }
}

/**
 * 重置所有 AI Mock
 */
export function resetAIMocks(): void {
  mockChatStream.mockClear()
  mockChatOnce.mockClear()
  clearAIResponses()
}

// ========== 测试辅助 ==========

/**
 * 创建模拟的条件判断响应
 * 用于测试条件节点的 AI 判断功能
 */
export function setAIJudgeResponse(result: boolean): void {
  setDefaultAIResponse({
    content: result ? "true" : "false",
    delay: 0,
  })
}

/**
 * 创建会抛出错误的 AI 响应
 */
export function setAIErrorResponse(errorMessage: string): void {
  mockChatStream.mockRejectedValueOnce(new Error(errorMessage))
  mockChatOnce.mockRejectedValueOnce(new Error(errorMessage))
}

/**
 * 创建超时的 AI 响应
 */
export function setAITimeoutResponse(timeoutMs: number): void {
  setDefaultAIResponse({
    content: "响应内容",
    delay: timeoutMs + 1000, // 超过超时时间
  })
}

