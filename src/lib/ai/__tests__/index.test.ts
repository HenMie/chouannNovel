// lib/ai AI 模块测试
// 测试模型配置、可用模型获取、provider options 构建等功能

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  BUILTIN_MODELS,
  getBuiltinModelsByProvider,
  getAvailableModels,
  getModelConfig,
  getModelProvider,
  chat,
  chatStream,
  chatStreamIterable,
  testProviderConnection,
  normalizeBaseUrl,
  type StreamChunk,
} from "../index"
import { generateText, streamText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createAnthropic } from "@ai-sdk/anthropic"
import type { GlobalConfig, AIProvider } from "@/types"

// ========== Mock AI SDK ==========

vi.mock("ai", () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
}))

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => vi.fn()),
}))

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn()),
}))

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: vi.fn(() => vi.fn()),
}))

// ========== 测试数据工厂 ==========

function createMockGlobalConfig(overrides?: Partial<GlobalConfig>): GlobalConfig {
  return {
    id: 1,
    ai_providers: {
      openai: {
        api_key: "",
        enabled: false,
        enabled_models: [],
        custom_models: [],
      },
      gemini: {
        api_key: "",
        enabled: false,
        enabled_models: [],
        custom_models: [],
      },
      claude: {
        api_key: "",
        enabled: false,
        enabled_models: [],
        custom_models: [],
      },
    },
    theme: "system",
    default_loop_max: 10,
    default_timeout: 300,
    ...overrides,
  }
}

const baseMessages = [{ role: "user" as const, content: "hi" }]

// 构造可控的异步流
function createAsyncStream(chunks: string[]) {
  return (async function* () {
    for (const chunk of chunks) {
      yield chunk
    }
  })()
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ========== BUILTIN_MODELS 测试 ==========

describe("AI 模块 - BUILTIN_MODELS 常量", () => {
  it("应该包含所有预期的提供商模型", () => {
    const providers = new Set(BUILTIN_MODELS.map((m) => m.provider))
    expect(providers).toContain("openai")
    expect(providers).toContain("gemini")
    expect(providers).toContain("claude")
  })

  it("每个模型应该有必需的属性", () => {
    BUILTIN_MODELS.forEach((model) => {
      expect(model.id).toBeDefined()
      expect(model.name).toBeDefined()
      expect(model.provider).toBeDefined()
      expect(typeof model.supportsTemperature).toBe("boolean")
      expect(typeof model.supportsMaxTokens).toBe("boolean")
      expect(typeof model.supportsTopP).toBe("boolean")
    })
  })

  it("Gemini 3 Pro 应该支持 thinkingLevel", () => {
    const gemini3Pro = BUILTIN_MODELS.find((m) => m.id === "gemini-3-pro-preview")
    expect(gemini3Pro).toBeDefined()
    expect(gemini3Pro?.thinkingMode).toBe("thinkingLevel")
    // Gemini 3 Pro 不支持 temperature 调整
    expect(gemini3Pro?.supportsTemperature).toBe(false)
  })

  it("Gemini 2.5 系列应该支持 thinkingBudget", () => {
    const gemini25Pro = BUILTIN_MODELS.find((m) => m.id === "gemini-2.5-pro")
    expect(gemini25Pro).toBeDefined()
    expect(gemini25Pro?.thinkingMode).toBe("thinkingBudget")
    expect(gemini25Pro?.thinkingBudgetRange).toEqual([128, 32768])
    expect(gemini25Pro?.canDisableThinking).toBe(false)

    const gemini25Flash = BUILTIN_MODELS.find((m) => m.id === "gemini-2.5-flash")
    expect(gemini25Flash).toBeDefined()
    expect(gemini25Flash?.thinkingMode).toBe("thinkingBudget")
    expect(gemini25Flash?.canDisableThinking).toBe(true)
  })

  it("Claude Opus/Sonnet 应该支持 effort", () => {
    const claudeOpus = BUILTIN_MODELS.find((m) => m.id === "claude-opus-4-5-20251101")
    expect(claudeOpus).toBeDefined()
    expect(claudeOpus?.thinkingMode).toBe("effort")

    const claudeSonnet = BUILTIN_MODELS.find((m) => m.id === "claude-sonnet-4-5-20250929")
    expect(claudeSonnet).toBeDefined()
    expect(claudeSonnet?.thinkingMode).toBe("effort")
  })

  it("Claude Haiku 不应该支持 effort", () => {
    const claudeHaiku = BUILTIN_MODELS.find((m) => m.id === "claude-haiku-4-5-20251001")
    expect(claudeHaiku).toBeDefined()
    expect(claudeHaiku?.thinkingMode).toBeUndefined()
  })

  it("OpenAI 模型应该支持所有标准参数", () => {
    const openaiModels = BUILTIN_MODELS.filter((m) => m.provider === "openai")
    openaiModels.forEach((model) => {
      expect(model.supportsTemperature).toBe(true)
      expect(model.supportsMaxTokens).toBe(true)
      expect(model.supportsTopP).toBe(true)
    })
  })
})

// ========== getBuiltinModelsByProvider 测试 ==========

describe("AI 模块 - getBuiltinModelsByProvider", () => {
  it("应该返回指定提供商的模型", () => {
    const openaiModels = getBuiltinModelsByProvider("openai")
    expect(openaiModels.length).toBeGreaterThan(0)
    openaiModels.forEach((model) => {
      expect(model.provider).toBe("openai")
    })
  })

  it("应该返回 Gemini 模型", () => {
    const geminiModels = getBuiltinModelsByProvider("gemini")
    expect(geminiModels.length).toBeGreaterThan(0)
    geminiModels.forEach((model) => {
      expect(model.provider).toBe("gemini")
    })
  })

  it("应该返回 Claude 模型", () => {
    const claudeModels = getBuiltinModelsByProvider("claude")
    expect(claudeModels.length).toBeGreaterThan(0)
    claudeModels.forEach((model) => {
      expect(model.provider).toBe("claude")
    })
  })

  it("应该为未知提供商返回空数组", () => {
    const unknownModels = getBuiltinModelsByProvider("unknown" as AIProvider)
    expect(unknownModels).toEqual([])
  })
})

// ========== getAvailableModels 测试 ==========

describe("AI 模块 - getAvailableModels", () => {
  it("应该返回空数组当没有启用的提供商时", () => {
    const config = createMockGlobalConfig()
    const models = getAvailableModels(config)
    expect(models).toEqual([])
  })

  it("应该返回空数组当提供商启用但没有 API key 时", () => {
    const config = createMockGlobalConfig({
      ai_providers: {
        openai: {
          api_key: "",
          enabled: true,
          enabled_models: ["gpt-5"],
          custom_models: [],
        },
        gemini: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      },
    })
    const models = getAvailableModels(config)
    expect(models).toEqual([])
  })

  it("应该返回已启用提供商的已启用模型", () => {
    const config = createMockGlobalConfig({
      ai_providers: {
        openai: {
          api_key: "sk-test",
          enabled: true,
          enabled_models: ["gpt-5", "gpt-5-mini"],
          custom_models: [],
        },
        gemini: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      },
    })

    const models = getAvailableModels(config)
    expect(models).toHaveLength(2)
    expect(models.map((m) => m.id)).toContain("gpt-5")
    expect(models.map((m) => m.id)).toContain("gpt-5-mini")
  })

  it("应该包含自定义模型", () => {
    const config = createMockGlobalConfig({
      ai_providers: {
        openai: {
          api_key: "sk-test",
          enabled: true,
          enabled_models: ["gpt-5"],
          custom_models: [
            { id: "custom-model-1", name: "Custom Model 1", enabled: true },
            { id: "custom-model-2", name: "Custom Model 2", enabled: false },
          ],
        },
        gemini: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      },
    })

    const models = getAvailableModels(config)
    expect(models).toHaveLength(2) // gpt-5 + custom-model-1
    expect(models.map((m) => m.id)).toContain("gpt-5")
    expect(models.map((m) => m.id)).toContain("custom-model-1")
    expect(models.map((m) => m.id)).not.toContain("custom-model-2") // 未启用
  })

  it("应该合并多个提供商的模型", () => {
    const config = createMockGlobalConfig({
      ai_providers: {
        openai: {
          api_key: "sk-test",
          enabled: true,
          enabled_models: ["gpt-5"],
          custom_models: [],
        },
        gemini: {
          api_key: "gemini-key",
          enabled: true,
          enabled_models: ["gemini-2.5-pro"],
          custom_models: [],
        },
        claude: {
          api_key: "claude-key",
          enabled: true,
          enabled_models: ["claude-opus-4-5-20251101"],
          custom_models: [],
        },
      },
    })

    const models = getAvailableModels(config)
    expect(models).toHaveLength(3)
    expect(models.map((m) => m.provider)).toContain("openai")
    expect(models.map((m) => m.provider)).toContain("gemini")
    expect(models.map((m) => m.provider)).toContain("claude")
  })

  it("自定义模型应该有默认配置", () => {
    const config = createMockGlobalConfig({
      ai_providers: {
        openai: {
          api_key: "sk-test",
          enabled: true,
          enabled_models: [],
          custom_models: [{ id: "custom-model", name: "Custom", enabled: true }],
        },
        gemini: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      },
    })

    const models = getAvailableModels(config)
    expect(models).toHaveLength(1)

    const customModel = models[0]
    expect(customModel.supportsTemperature).toBe(true)
    expect(customModel.supportsMaxTokens).toBe(true)
    expect(customModel.supportsTopP).toBe(true)
    expect(customModel.defaultMaxTokens).toBe(4096)
  })
})

// ========== getModelConfig 测试 ==========

describe("AI 模块 - getModelConfig", () => {
  it("应该返回内置模型配置", () => {
    const config = getModelConfig("gpt-5")
    expect(config).toBeDefined()
    expect(config?.id).toBe("gpt-5")
    expect(config?.provider).toBe("openai")
  })

  it("应该返回 undefined 对于未知模型（无全局配置）", () => {
    const config = getModelConfig("unknown-model")
    expect(config).toBeUndefined()
  })

  it("应该从全局配置中查找自定义模型", () => {
    const globalConfig = createMockGlobalConfig({
      ai_providers: {
        openai: {
          api_key: "sk-test",
          enabled: true,
          enabled_models: [],
          custom_models: [{ id: "my-custom-model", name: "My Custom", enabled: true }],
        },
        gemini: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      },
    })

    const config = getModelConfig("my-custom-model", globalConfig)
    expect(config).toBeDefined()
    expect(config?.id).toBe("my-custom-model")
    expect(config?.name).toBe("My Custom")
    expect(config?.provider).toBe("openai")
  })

  it("应该优先返回内置模型而非自定义模型", () => {
    const globalConfig = createMockGlobalConfig({
      ai_providers: {
        openai: {
          api_key: "sk-test",
          enabled: true,
          enabled_models: [],
          custom_models: [{ id: "gpt-5", name: "Fake GPT-5", enabled: true }],
        },
        gemini: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      },
    })

    const config = getModelConfig("gpt-5", globalConfig)
    expect(config).toBeDefined()
    expect(config?.name).toBe("GPT-5") // 内置模型名称，不是 "Fake GPT-5"
  })

  it("应该返回正确的 Gemini 模型配置", () => {
    const config = getModelConfig("gemini-3-pro-preview")
    expect(config).toBeDefined()
    expect(config?.thinkingMode).toBe("thinkingLevel")
    expect(config?.supportsTemperature).toBe(false)
  })

  it("应该返回正确的 Claude 模型配置", () => {
    const config = getModelConfig("claude-opus-4-5-20251101")
    expect(config).toBeDefined()
    expect(config?.thinkingMode).toBe("effort")
    expect(config?.supportsTemperature).toBe(true)
  })
})

// ========== getModelProvider 测试 ==========

describe("AI 模块 - getModelProvider", () => {
  it("应该返回内置模型的提供商", () => {
    expect(getModelProvider("gpt-5")).toBe("openai")
    expect(getModelProvider("gemini-2.5-pro")).toBe("gemini")
    expect(getModelProvider("claude-opus-4-5-20251101")).toBe("claude")
  })

  it("应该返回 undefined 对于未知模型", () => {
    expect(getModelProvider("unknown-model")).toBeUndefined()
  })

  it("应该从全局配置中查找自定义模型的提供商", () => {
    const globalConfig = createMockGlobalConfig({
      ai_providers: {
        openai: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        gemini: {
          api_key: "gemini-key",
          enabled: true,
          enabled_models: [],
          custom_models: [{ id: "custom-gemini", name: "Custom Gemini", enabled: true }],
        },
        claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      },
    })

    expect(getModelProvider("custom-gemini", globalConfig)).toBe("gemini")
  })
})

// ========== buildProviderOptions 测试 ==========

// 由于 buildProviderOptions 是内部函数，我们通过测试其效果来验证

describe("AI 模块 - Thinking Config 处理", () => {
  it("Gemini 3 Pro 配置应该支持 thinkingLevel", () => {
    const config = getModelConfig("gemini-3-pro-preview")
    expect(config?.thinkingMode).toBe("thinkingLevel")
  })

  it("Gemini 2.5 Pro 配置应该支持 thinkingBudget 且不能禁用", () => {
    const config = getModelConfig("gemini-2.5-pro")
    expect(config?.thinkingMode).toBe("thinkingBudget")
    expect(config?.thinkingBudgetRange).toEqual([128, 32768])
    expect(config?.canDisableThinking).toBe(false)
  })

  it("Gemini 2.5 Flash 配置应该支持禁用 thinking", () => {
    const config = getModelConfig("gemini-2.5-flash")
    expect(config?.thinkingMode).toBe("thinkingBudget")
    expect(config?.thinkingBudgetRange).toEqual([0, 24576])
    expect(config?.canDisableThinking).toBe(true)
  })

  it("Claude Opus 配置应该支持 effort", () => {
    const config = getModelConfig("claude-opus-4-5-20251101")
    expect(config?.thinkingMode).toBe("effort")
  })

  it("OpenAI 模型不应该有 thinkingMode", () => {
    const config = getModelConfig("gpt-5")
    expect(config?.thinkingMode).toBeUndefined()
  })
})

// ========== 模型参数支持测试 ==========

describe("AI 模块 - 模型参数支持", () => {
  it("所有模型应该有默认 maxTokens", () => {
    BUILTIN_MODELS.forEach((model) => {
      if (model.supportsMaxTokens) {
        expect(model.defaultMaxTokens).toBeDefined()
        expect(model.defaultMaxTokens).toBeGreaterThan(0)
      }
    })
  })

  it("Gemini 模型应该有较大的 maxTokens", () => {
    const geminiModels = BUILTIN_MODELS.filter((m) => m.provider === "gemini")
    geminiModels.forEach((model) => {
      expect(model.defaultMaxTokens).toBeGreaterThanOrEqual(8192)
    })
  })

  it("Claude 模型参数支持应该正确", () => {
    const claudeModels = BUILTIN_MODELS.filter((m) => m.provider === "claude")
    claudeModels.forEach((model) => {
      expect(model.supportsTemperature).toBe(true)
      expect(model.supportsMaxTokens).toBe(true)
      expect(model.supportsTopP).toBe(true)
    })
  })
})

// ========== 边界情况测试 ==========

describe("AI 模块 - 边界情况", () => {
  it("应该处理空的 enabled_models 数组", () => {
    const config = createMockGlobalConfig({
      ai_providers: {
        openai: {
          api_key: "sk-test",
          enabled: true,
          enabled_models: [],
          custom_models: [],
        },
        gemini: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      },
    })

    const models = getAvailableModels(config)
    expect(models).toEqual([])
  })

  it("应该处理 undefined 的 custom_models", () => {
    const config = createMockGlobalConfig({
      ai_providers: {
        openai: {
          api_key: "sk-test",
          enabled: true,
          enabled_models: ["gpt-5"],
          custom_models: undefined as any,
        },
        gemini: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      },
    })

    const models = getAvailableModels(config)
    expect(models).toHaveLength(1)
    expect(models[0].id).toBe("gpt-5")
  })

  it("应该处理 undefined 的 enabled_models", () => {
    const config = createMockGlobalConfig({
      ai_providers: {
        openai: {
          api_key: "sk-test",
          enabled: true,
          enabled_models: undefined as any,
          custom_models: [],
        },
        gemini: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      },
    })

    const models = getAvailableModels(config)
    expect(models).toEqual([])
  })

  it("应该正确处理所有提供商都启用的情况", () => {
    const config = createMockGlobalConfig({
      ai_providers: {
        openai: {
          api_key: "sk-test",
          enabled: true,
          enabled_models: ["gpt-5", "gpt-5.1", "gpt-5-mini"],
          custom_models: [],
        },
        gemini: {
          api_key: "gemini-key",
          enabled: true,
          enabled_models: ["gemini-3-pro-preview", "gemini-2.5-pro", "gemini-2.5-flash"],
          custom_models: [],
        },
        claude: {
          api_key: "claude-key",
          enabled: true,
          enabled_models: ["claude-opus-4-5-20251101", "claude-sonnet-4-5-20250929", "claude-haiku-4-5-20251001"],
          custom_models: [],
        },
      },
    })

    const models = getAvailableModels(config)
    expect(models).toHaveLength(9)
  })
})

// ========== 模型 ID 一致性测试 ==========

describe("AI 模块 - 模型 ID 一致性", () => {
  it("BUILTIN_MODELS 中的所有 ID 应该是唯一的", () => {
    const ids = BUILTIN_MODELS.map((m) => m.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it("所有模型 ID 应该是有效的字符串", () => {
    BUILTIN_MODELS.forEach((model) => {
      expect(typeof model.id).toBe("string")
      expect(model.id.length).toBeGreaterThan(0)
      expect(model.id.trim()).toBe(model.id) // 无前后空格
    })
  })

  it("所有模型名称应该是有效的字符串", () => {
    BUILTIN_MODELS.forEach((model) => {
      expect(typeof model.name).toBe("string")
      expect(model.name.length).toBeGreaterThan(0)
    })
  })
})

// ========== chat 功能测试 ==========

describe("AI 模块 - chat 功能", () => {
  it("应该使用启用的 OpenAI 提供商并映射 usage", async () => {
    const config = createMockGlobalConfig({
      ai_providers: {
        openai: {
          api_key: "openai-key",
          base_url: "https://api.openai.com",
          enabled: true,
          enabled_models: ["gpt-5"],
          custom_models: [],
        },
        gemini: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      },
    })

    const openaiModel = vi.fn()
    vi.mocked(createOpenAI).mockReturnValue(openaiModel as any)
    vi.mocked(generateText).mockResolvedValue({
      text: "hello",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    } as any)

    const response = await chat(
      {
        provider: "openai",
        model: "gpt-5",
        messages: baseMessages,
        temperature: 0.8,
        maxTokens: 120,
        topP: 0.9,
      },
      config,
    )

    expect(createOpenAI).toHaveBeenCalledWith({
      apiKey: "openai-key",
      baseURL: "https://api.openai.com/v1",
    })
    expect(openaiModel).toHaveBeenCalledWith("gpt-5")
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.8,
        maxOutputTokens: 120,
        topP: 0.9,
        providerOptions: undefined,
      }),
    )
    expect(response).toEqual({
      content: "hello",
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    })
  })

  it("Gemini 3 Pro 应该忽略不支持的参数并构造 thinking 配置", async () => {
    const config = createMockGlobalConfig({
      ai_providers: {
        openai: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        gemini: {
          api_key: "gemini-key",
          enabled: true,
          enabled_models: ["gemini-3-pro-preview"],
          custom_models: [],
        },
        claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      },
    })

    const googleModel = vi.fn()
    vi.mocked(createGoogleGenerativeAI).mockReturnValue(googleModel as any)
    vi.mocked(generateText).mockResolvedValue({ text: "resp" } as any)

    await chat(
      {
        provider: "gemini",
        model: "gemini-3-pro-preview",
        messages: baseMessages,
        temperature: 0.5,
        topP: 0.8,
        thinkingConfig: { thinkingLevel: "high", includeThoughts: true },
      },
      config,
    )

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: undefined, // 不支持 temperature
        topP: undefined, // 不支持 topP
        providerOptions: {
          google: {
            thinkingConfig: { thinkingLevel: "high", includeThoughts: true },
          },
        },
      }),
    )
  })

  it("未配置 api_key 的提供商应该抛出错误", async () => {
    const config = createMockGlobalConfig({
      ai_providers: {
        openai: {
          api_key: "",
          enabled: true,
          enabled_models: ["gpt-5"],
          custom_models: [],
        },
        gemini: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      },
    })

    await expect(
      chat(
        { provider: "openai", model: "gpt-5", messages: baseMessages },
        config,
      ),
    ).rejects.toThrow("提供商 openai 未配置或未启用")
  })

  it("未知提供商应该触发不支持的错误", async () => {
    const config = createMockGlobalConfig() as any
    config.ai_providers.unknown = {
      api_key: "test",
      enabled: true,
      enabled_models: [],
      custom_models: [],
    }

    await expect(
      chat(
        { provider: "unknown" as AIProvider, model: "custom", messages: baseMessages } as any,
        config,
      ),
    ).rejects.toThrow("不支持的提供商")
  })
})

// ========== chatStream 功能测试 ==========

describe("AI 模块 - chatStream 功能", () => {
  it("应该流式返回分片并包含结束标记", async () => {
    const config = createMockGlobalConfig({
      ai_providers: {
        openai: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        gemini: {
          api_key: "gemini-key",
          enabled: true,
          enabled_models: ["gemini-2.5-pro"],
          custom_models: [],
        },
        claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      },
    })

    const googleModel = vi.fn()
    vi.mocked(createGoogleGenerativeAI).mockReturnValue(googleModel as any)
    vi.mocked(streamText).mockReturnValue({
      textStream: createAsyncStream(["a", "b"]),
    } as any)

    const chunks: StreamChunk[] = []
    await chatStream(
      {
        provider: "gemini",
        model: "gemini-2.5-pro",
        messages: baseMessages,
        thinkingConfig: { thinkingBudget: 256, includeThoughts: false },
      },
      config,
      (chunk) => chunks.push(chunk),
    )

    expect(chunks).toEqual([
      { content: "a", done: false },
      { content: "b", done: false },
      { content: "", done: true, usage: undefined },
    ])
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: {
          google: {
            thinkingConfig: { thinkingBudget: 256, includeThoughts: false },
          },
        },
      }),
    )
  })
})

// ========== chatStreamIterable 功能测试 ==========

describe("AI 模块 - chatStreamIterable 功能", () => {
  it("应该返回可迭代的流并附加结束块", async () => {
    const config = createMockGlobalConfig({
      ai_providers: {
        openai: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        gemini: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
        claude: {
          api_key: "claude-key",
          enabled: true,
          enabled_models: ["claude-opus-4-5-20251101"],
          custom_models: [],
        },
      },
    })

    const claudeModel = vi.fn()
    vi.mocked(createAnthropic).mockReturnValue(claudeModel as any)
    vi.mocked(streamText).mockReturnValue({
      textStream: createAsyncStream(["chunk"]),
    } as any)

    const received: StreamChunk[] = []
    for await (const chunk of chatStreamIterable(
      {
        provider: "claude",
        model: "claude-opus-4-5-20251101",
        messages: baseMessages,
        thinkingConfig: { effort: "medium" },
      },
      config,
    )) {
      received.push(chunk)
    }

    expect(received).toEqual([
      { content: "chunk", done: false },
      { content: "", done: true, usage: undefined },
    ])
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: { anthropic: { effort: "medium" } },
      }),
    )
  })
})

// ========== testProviderConnection 功能测试 ==========

describe("AI 模块 - testProviderConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("应该在 API Key 为空时返回错误", async () => {
    const result = await testProviderConnection("openai", {
      api_key: "",
      enabled: true,
    })

    expect(result.success).toBe(false)
    expect(result.message).toBe("请先填写 API Key")
  })

  it("OpenAI 连接成功时应返回 success 和延迟", async () => {
    const openaiModel = vi.fn()
    vi.mocked(createOpenAI).mockReturnValue(openaiModel as any)
    vi.mocked(generateText).mockResolvedValue({ text: "h" } as any)

    const result = await testProviderConnection("openai", {
      api_key: "sk-test",
      base_url: "https://api.openai.com/v1",
      enabled: true,
    })

    expect(result.success).toBe(true)
    expect(result.message).toBe("连接成功")
    expect(result.latency).toBeGreaterThanOrEqual(0)
    expect(createOpenAI).toHaveBeenCalledWith({
      apiKey: "sk-test",
      baseURL: "https://api.openai.com/v1",
    })
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "hi" }],
        maxOutputTokens: 1,
      })
    )
  })

  it("Gemini 连接成功时应正确创建客户端", async () => {
    const geminiModel = vi.fn()
    vi.mocked(createGoogleGenerativeAI).mockReturnValue(geminiModel as any)
    vi.mocked(generateText).mockResolvedValue({ text: "h" } as any)

    const result = await testProviderConnection("gemini", {
      api_key: "gemini-key",
      enabled: true,
    })

    expect(result.success).toBe(true)
    expect(createGoogleGenerativeAI).toHaveBeenCalledWith({
      apiKey: "gemini-key",
      baseURL: undefined,
    })
  })

  it("Claude 连接成功时应正确创建客户端", async () => {
    const claudeModel = vi.fn()
    vi.mocked(createAnthropic).mockReturnValue(claudeModel as any)
    vi.mocked(generateText).mockResolvedValue({ text: "h" } as any)

    const result = await testProviderConnection("claude", {
      api_key: "claude-key",
      base_url: "https://api.anthropic.com",
      enabled: true,
    })

    expect(result.success).toBe(true)
    expect(createAnthropic).toHaveBeenCalledWith({
      apiKey: "claude-key",
      baseURL: "https://api.anthropic.com/v1",
    })
  })

  it("API Key 无效 (401) 时应返回友好错误", async () => {
    vi.mocked(createOpenAI).mockReturnValue(vi.fn() as any)
    vi.mocked(generateText).mockRejectedValue(new Error("401 Unauthorized - Invalid API key"))

    const result = await testProviderConnection("openai", {
      api_key: "sk-invalid",
      enabled: true,
    })

    expect(result.success).toBe(false)
    expect(result.message).toBe("API Key 无效或已过期")
  })

  it("余额不足 (429) 时应返回友好错误", async () => {
    vi.mocked(createOpenAI).mockReturnValue(vi.fn() as any)
    vi.mocked(generateText).mockRejectedValue(new Error("429 Rate limit exceeded"))

    const result = await testProviderConnection("openai", {
      api_key: "sk-test",
      enabled: true,
    })

    expect(result.success).toBe(false)
    expect(result.message).toBe("账户余额不足或请求频率超限")
  })

  it("网络不可达时应返回友好错误", async () => {
    vi.mocked(createGoogleGenerativeAI).mockReturnValue(vi.fn() as any)
    vi.mocked(generateText).mockRejectedValue(new Error("fetch failed: ECONNREFUSED"))

    const result = await testProviderConnection("gemini", {
      api_key: "gemini-key",
      enabled: true,
    })

    expect(result.success).toBe(false)
    expect(result.message).toBe("无法连接到服务器，请检查网络或代理地址")
  })

  it("超时时应返回友好错误", async () => {
    vi.mocked(createAnthropic).mockReturnValue(vi.fn() as any)
    vi.mocked(generateText).mockRejectedValue(new Error("The operation was aborted due to timeout"))

    const result = await testProviderConnection("claude", {
      api_key: "claude-key",
      enabled: true,
    })

    expect(result.success).toBe(false)
    expect(result.message).toBe("连接超时，请检查网络或代理地址")
  })

  it("模型不存在 (404) 时应返回提示信息", async () => {
    vi.mocked(createOpenAI).mockReturnValue(vi.fn() as any)
    vi.mocked(generateText).mockRejectedValue(new Error("404 Not Found - model does not exist"))

    const result = await testProviderConnection("openai", {
      api_key: "sk-test",
      enabled: true,
    })

    expect(result.success).toBe(false)
    expect(result.message).toBe("连接成功但测试模型不可用（不影响其他模型使用）")
  })

  it("未知错误应返回原始消息", async () => {
    vi.mocked(createOpenAI).mockReturnValue(vi.fn() as any)
    vi.mocked(generateText).mockRejectedValue(new Error("Something unexpected happened"))

    const result = await testProviderConnection("openai", {
      api_key: "sk-test",
      enabled: true,
    })

    expect(result.success).toBe(false)
    expect(result.message).toBe("Something unexpected happened")
  })

  it("应该支持用户指定的测试模型", async () => {
    const openaiModel = vi.fn()
    vi.mocked(createOpenAI).mockReturnValue(openaiModel as any)
    vi.mocked(generateText).mockResolvedValue({ text: "h" } as any)

    const result = await testProviderConnection("openai", {
      api_key: "sk-test",
      enabled: true,
    }, "gpt-5")

    expect(result.success).toBe(true)
    expect(openaiModel).toHaveBeenCalledWith("gpt-5")
  })

  it("未指定模型时应使用默认测试模型", async () => {
    const geminiModel = vi.fn()
    vi.mocked(createGoogleGenerativeAI).mockReturnValue(geminiModel as any)
    vi.mocked(generateText).mockResolvedValue({ text: "h" } as any)

    await testProviderConnection("gemini", {
      api_key: "gemini-key",
      enabled: true,
    })

    expect(geminiModel).toHaveBeenCalledWith("gemini-2.0-flash")
  })
})

// ========== normalizeBaseUrl 功能测试 ==========

describe("AI 模块 - normalizeBaseUrl", () => {
  it("空值应返回 undefined", () => {
    expect(normalizeBaseUrl("openai", undefined)).toBeUndefined()
    expect(normalizeBaseUrl("openai", "")).toBeUndefined()
  })

  it("OpenAI: 无后缀应补全 /v1", () => {
    expect(normalizeBaseUrl("openai", "https://my-proxy.com")).toBe("https://my-proxy.com/v1")
  })

  it("OpenAI: 已有 /v1 不重复追加", () => {
    expect(normalizeBaseUrl("openai", "https://api.openai.com/v1")).toBe("https://api.openai.com/v1")
  })

  it("OpenAI: 尾部斜杠应被清理", () => {
    expect(normalizeBaseUrl("openai", "https://my-proxy.com/")).toBe("https://my-proxy.com/v1")
    expect(normalizeBaseUrl("openai", "https://api.openai.com/v1/")).toBe("https://api.openai.com/v1")
  })

  it("Gemini: 无后缀应补全 /v1beta", () => {
    expect(normalizeBaseUrl("gemini", "https://my-proxy.com")).toBe("https://my-proxy.com/v1beta")
  })

  it("Gemini: 已有 /v1beta 不重复追加", () => {
    expect(normalizeBaseUrl("gemini", "https://generativelanguage.googleapis.com/v1beta")).toBe("https://generativelanguage.googleapis.com/v1beta")
  })

  it("Claude: 无后缀应补全 /v1", () => {
    expect(normalizeBaseUrl("claude", "https://api.anthropic.com")).toBe("https://api.anthropic.com/v1")
  })

  it("Claude: 已有 /v1 不重复追加", () => {
    expect(normalizeBaseUrl("claude", "https://api.anthropic.com/v1")).toBe("https://api.anthropic.com/v1")
  })
})





