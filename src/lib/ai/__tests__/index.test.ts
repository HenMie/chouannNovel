// lib/ai AI 模块测试
// 测试模型配置、可用模型获取、provider options 构建等功能

import { describe, it, expect, vi } from "vitest"
import {
  BUILTIN_MODELS,
  getBuiltinModelsByProvider,
  getAvailableModels,
  getModelConfig,
  getModelProvider,
} from "../index"
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

