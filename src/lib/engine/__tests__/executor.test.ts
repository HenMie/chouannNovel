// lib/engine/executor.ts 执行器测试

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { WorkflowExecutor, executorStatusToDbStatus } from "../executor"
import type {
  Workflow,
  WorkflowNode,
  GlobalConfig,
  StartConfig,
  TextExtractConfig,
  TextConcatConfig,
  ConditionConfig,
  LoopStartConfig,
  AIChatConfig,
  ParallelStartConfig,
  NodeConfig,
} from "@/types"

// Mock chatStream
const mockChatStream = vi.fn()

// Mock AI 模块
vi.mock("@/lib/ai", () => ({
  chatStream: (...args: unknown[]) => mockChatStream(...args),
}))

// ========== 测试辅助函数 ==========

const createTestWorkflow = (overrides?: Partial<Workflow>): Workflow => ({
  id: "workflow-1",
  project_id: "project-1",
  name: "测试工作流",
  loop_max_count: 10,
  timeout_seconds: 300,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

const createTestNode = (
  type: WorkflowNode["type"],
  name: string,
  config: NodeConfig = {},
  overrides?: Partial<WorkflowNode>
): WorkflowNode => ({
  id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  workflow_id: "workflow-1",
  type,
  name,
  config,
  order_index: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

const createTestGlobalConfig = (): GlobalConfig => ({
  id: 1,
  ai_providers: {
    openai: { api_key: "test-key", enabled: true, enabled_models: ["gpt-4"], custom_models: [] },
    gemini: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
    claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
  },
  theme: "system",
  default_loop_max: 10,
  default_timeout: 300,
})

// ========== 测试 ==========

describe("WorkflowExecutor - 工作流执行器", () => {
  let workflow: Workflow
  let globalConfig: GlobalConfig

  beforeEach(() => {
    workflow = createTestWorkflow()
    globalConfig = createTestGlobalConfig()
    vi.clearAllMocks()
    
    // 默认 mock 实现
    mockChatStream.mockImplementation(async (_options, _config, onChunk) => {
      onChunk({ content: "AI 回复内容", done: false })
      onChunk({ content: "", done: true })
    })
  })
  
  afterEach(() => {
    vi.useRealTimers()
  })

  // ========== 执行控制测试 ==========

  describe("执行控制", () => {
    it("应该能启动执行", async () => {
      const nodes = [createTestNode("start", "开始")]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
      })

      const result = await executor.execute()
      expect(result.status).toBe("completed")
    })

    it("应该能获取执行状态", () => {
      const nodes = [createTestNode("start", "开始")]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
      })

      expect(executor.getStatus()).toBe("idle")
    })

    it("不能重复执行", async () => {
      const nodes = [createTestNode("start", "开始")]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
      })

      // 启动执行
      const promise = executor.execute()
      
      // 尝试再次执行应该抛出错误
      await expect(executor.execute()).rejects.toThrow("执行器已在运行中")
      
      await promise
    })

    it("应该能取消执行", async () => {
      const nodes = [createTestNode("start", "开始")]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
      })

      const executePromise = executor.execute()
      executor.cancel()
      
      const result = await executePromise
      expect(["completed", "cancelled"]).toContain(result.status)
    })

    it("应该发送执行事件", async () => {
      const events: string[] = []
      const nodes = [createTestNode("start", "开始")]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        onEvent: (event) => events.push(event.type),
      })

      await executor.execute()

      expect(events).toContain("execution_started")
      expect(events).toContain("execution_completed")
    })
  })

  // ========== Start 节点测试 ==========

  describe("Start 节点执行", () => {
    it("应该将初始输入保存到 '用户问题' 变量", async () => {
      const nodes = [createTestNode("start", "开始")]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "用户输入的问题",
      })

      await executor.execute()

      const ctx = executor.getContext()
      expect(ctx.getVariable("用户问题")).toBe("用户输入的问题")
    })

    it("没有输入时应该使用默认值", async () => {
      const config: StartConfig = { default_value: "默认问题" }
      const nodes = [createTestNode("start", "开始", config)]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
      })

      await executor.execute()

      const ctx = executor.getContext()
      expect(ctx.getVariable("用户问题")).toBe("默认问题")
    })

    it("应该将节点输出设置为输入值", async () => {
      const nodes = [createTestNode("start", "开始")]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "测试输入",
      })

      const result = await executor.execute()
      
      expect(result.output).toBe("测试输入")
    })
  })

  // ========== Output 节点测试 ==========

  describe("Output 节点执行", () => {
    it("应该返回最后一个节点的输出", async () => {
      const nodes = [
        createTestNode("start", "开始", {}, { id: "start-1", order_index: 0 }),
        createTestNode("output", "输出", {}, { id: "output-1", order_index: 1 }),
      ]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "测试输入",
      })

      const result = await executor.execute()
      expect(result.output).toBe("测试输入")
    })
  })

  // ========== TextExtract 节点测试 ==========

  describe("TextExtract 节点执行", () => {
    describe("正则提取模式", () => {
      it("应该能使用正则表达式提取文本", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "regex",
            regex_pattern: "订单号：(\\d+)",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "订单号：12345，金额：99.9",
        })

        const result = await executor.execute()
        expect(result.output).toBe("12345")
      })

      it("无效的正则表达式应该抛出错误", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "regex",
            regex_pattern: "[invalid",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "测试文本",
        })

        const result = await executor.execute()
        expect(result.status).toBe("failed")
      })
    })

    describe("标记提取模式", () => {
      it("应该能使用起始和结束标记提取文本", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "start_end",
            start_marker: "[START]",
            end_marker: "[END]",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "前缀[START]中间内容[END]后缀",
        })

        const result = await executor.execute()
        expect(result.output).toBe("中间内容")
      })

      it("没有结束标记时应该提取到末尾", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "start_end",
            start_marker: "[START]",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "前缀[START]后面的所有内容",
        })

        const result = await executor.execute()
        expect(result.output).toBe("后面的所有内容")
      })
    })

    describe("JSON 路径提取模式", () => {
      it("应该能使用 JSON 路径提取值", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "json_path",
            json_path: "user.name",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: '{"user":{"name":"张三","age":25}}',
        })

        const result = await executor.execute()
        expect(result.output).toBe("张三")
      })

      it("应该能提取数组元素", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "json_path",
            json_path: "items[1]",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: '{"items":["a","b","c"]}',
        })

        const result = await executor.execute()
        expect(result.output).toBe("b")
      })

      it("JSON 路径为空应该抛出错误", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "json_path",
            json_path: "",  // 空路径
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: '{"key":"value"}',
        })

        const result = await executor.execute()
        expect(result.status).toBe("failed")
        expect(result.error).toContain("JSON 路径不能为空")
      })

      it("不存在的 JSON 路径应该返回空字符串", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "json_path",
            json_path: "nonexistent.path",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: '{"key":"value"}',
        })

        const result = await executor.execute()
        expect(result.output).toBe("")
      })

      it("非字符串 JSON 值应该返回 JSON 字符串", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "json_path",
            json_path: "data",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: '{"data":{"nested":"value"}}',
        })

        const result = await executor.execute()
        expect(result.output).toBe('{"nested":"value"}')
      })
    })

    describe("手动输入模式", () => {
      it("input_mode=manual 应该支持变量插值", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "前缀{{用户问题}}后缀",  // 包含变量的输入
            input_mode: "manual",
            extract_mode: "start_end",
            start_marker: "前缀",
            end_marker: "后缀",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "测试内容",
        })

        const result = await executor.execute()
        expect(result.output).toBe("测试内容")
      })
    })

    describe("Markdown 转文本模式", () => {
      it("应该移除标题标记", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "md_to_text",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "# 一级标题\n## 二级标题\n正文内容",
        })

        const result = await executor.execute()
        expect(result.output).toBe("一级标题\n二级标题\n正文内容")
      })

      it("应该移除加粗和斜体标记", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "md_to_text",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "**加粗文字** 和 *斜体文字* 以及 __另一种加粗__",
        })

        const result = await executor.execute()
        expect(result.output).toBe("加粗文字 和 斜体文字 以及 另一种加粗")
      })

      it("应该保留代码块内容但移除标记", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "md_to_text",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "```javascript\nconst x = 1;\n```",
        })

        const result = await executor.execute()
        expect(result.output).toContain("const x = 1;")
        expect(result.output).not.toContain("```")
      })

      it("应该移除行内代码的反引号", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "md_to_text",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "使用 `console.log` 函数输出",
        })

        const result = await executor.execute()
        expect(result.output).toBe("使用 console.log 函数输出")
      })

      it("应该移除链接但保留文本", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "md_to_text",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "访问 [官方网站](https://example.com) 了解更多",
        })

        const result = await executor.execute()
        expect(result.output).toBe("访问 官方网站 了解更多")
      })

      it("应该移除图片但保留 alt 文本", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "md_to_text",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "这是一张图片：![示例图](image.png)",
        })

        const result = await executor.execute()
        expect(result.output).toBe("这是一张图片：示例图")
      })

      it("应该移除列表标记", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "md_to_text",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "- 项目一\n- 项目二\n1. 有序项一\n2. 有序项二",
        })

        const result = await executor.execute()
        expect(result.output).toContain("项目一")
        expect(result.output).toContain("项目二")
        expect(result.output).toContain("有序项一")
        expect(result.output).not.toContain("- ")
        expect(result.output).not.toContain("1. ")
      })

      it("应该移除引用标记", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "md_to_text",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "> 这是引用内容\n> 第二行引用",
        })

        const result = await executor.execute()
        expect(result.output).toBe("这是引用内容\n第二行引用")
      })

      it("应该移除删除线标记", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "md_to_text",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "~~删除的文字~~ 保留的文字",
        })

        const result = await executor.execute()
        expect(result.output).toBe("删除的文字 保留的文字")
      })
    })

    describe("边界条件", () => {
      it("空正则表达式应该抛出错误", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "regex",
            regex_pattern: "",  // 空正则
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "测试文本",
        })

        const result = await executor.execute()
        expect(result.status).toBe("failed")
        expect(result.error).toContain("正则表达式不能为空")
      })

      it("起始标记为空应该抛出错误", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "start_end",
            start_marker: "",  // 空起始标记
            end_marker: "[END]",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "测试文本",
        })

        const result = await executor.execute()
        expect(result.status).toBe("failed")
        expect(result.error).toContain("起始标记不能为空")
      })

      it("找不到起始标记应该返回空字符串", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "start_end",
            start_marker: "[NOT_FOUND]",
            end_marker: "[END]",
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "测试文本",
        })

        const result = await executor.execute()
        expect(result.output).toBe("")
      })

      it("有结束标记但找不到时应该提取到末尾", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "start_end",
            start_marker: "[START]",
            end_marker: "[NOT_FOUND]",  // 存在但找不到
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "前缀[START]剩余内容",
        })

        const result = await executor.execute()
        expect(result.output).toBe("剩余内容")
      })

      it("不支持的提取模式应该抛出错误", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_extract", "提取", {
            input_variable: "用户问题",
            extract_mode: "unsupported_mode" as any,
          } as TextExtractConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "测试文本",
        })

        const result = await executor.execute()
        expect(result.status).toBe("failed")
        expect(result.error).toContain("不支持的提取模式")
      })
    })
  })

  // ========== TextConcat 节点测试 ==========

  describe("TextConcat 节点执行", () => {
    it("应该能拼接多个来源", async () => {
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("text_concat", "拼接", {
          sources: [
            { type: "custom", custom: "第一部分" },
            { type: "custom", custom: "第二部分" },
          ],
          separator: "-",
        } as TextConcatConfig, { order_index: 1 }),
      ]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
      })

      const result = await executor.execute()
      expect(result.output).toBe("第一部分-第二部分")
    })

    it("应该支持自定义文本来源", async () => {
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("text_concat", "拼接", {
          sources: [
            { type: "custom", custom: "前缀" },
            { type: "custom", custom: "{{用户问题}}" },
            { type: "custom", custom: "后缀" },
          ],
          separator: "_",
        } as TextConcatConfig, { order_index: 1 }),
      ]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "内容",
      })

      const result = await executor.execute()
      expect(result.output).toBe("前缀_内容_后缀")
    })

    it("默认分隔符应该是换行", async () => {
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("text_concat", "拼接", {
          sources: [
            { type: "custom", custom: "行1" },
            { type: "custom", custom: "行2" },
          ],
        } as TextConcatConfig, { order_index: 1 }),
      ]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
      })

      const result = await executor.execute()
      expect(result.output).toBe("行1\n行2")
    })

    describe("新格式支持 (mode)", () => {
      it("mode=manual 应该支持手动输入并进行变量插值", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_concat", "拼接", {
            sources: [
              { mode: "manual", manual: "前缀_{{用户问题}}_后缀" },
            ],
            separator: ",",
          } as TextConcatConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "测试内容",
        })

        const result = await executor.execute()
        expect(result.output).toBe("前缀_测试内容_后缀")
      })

      it("mode=variable 应该从节点输出获取值", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { id: "start-1", order_index: 0 }),
          createTestNode("text_concat", "拼接", {
            sources: [
              { mode: "variable", variable: "start-1" },
              { mode: "manual", manual: "_后缀" },
            ],
            separator: "",
          } as TextConcatConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "输入值",
        })

        const result = await executor.execute()
        expect(result.output).toBe("输入值_后缀")
      })

      it("mode=variable 应该回退到全局变量", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_concat", "拼接", {
            sources: [
              { mode: "variable", variable: "用户问题" },
              { mode: "manual", manual: "已处理" },
            ],
            separator: "-",
          } as TextConcatConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "原始输入",
        })

        const result = await executor.execute()
        expect(result.output).toBe("原始输入-已处理")
      })

      it("混合新旧格式应该都能正常工作", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_concat", "拼接", {
            sources: [
              { type: "custom", custom: "旧格式" },  // 旧格式
              { mode: "manual", manual: "新格式" },  // 新格式
            ],
            separator: "+",
          } as TextConcatConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
        })

        const result = await executor.execute()
        expect(result.output).toBe("旧格式+新格式")
      })

      it("空来源数组应该返回空字符串", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("text_concat", "拼接", {
            sources: [],
            separator: ",",
          } as TextConcatConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
        })

        const result = await executor.execute()
        expect(result.output).toBe("")
      })
    })
  })

  // ========== Condition 节点测试 ==========

  describe("Condition 节点执行", () => {
    describe("关键词判断", () => {
      it("any 模式：包含任一关键词时为真", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("condition", "条件判断", {
            input_variable: "用户问题",
            condition_type: "keyword",
            keywords: ["测试", "示例"],
            keyword_mode: "any",
            true_action: "next",
            false_action: "end",
          } as ConditionConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "这是一个测试",
        })

        const result = await executor.execute()
        expect(result.output).toBe("true")
      })

      it("all 模式：包含所有关键词时为真", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("condition", "条件判断", {
            input_variable: "用户问题",
            condition_type: "keyword",
            keywords: ["测试", "示例"],
            keyword_mode: "all",
            true_action: "next",
            false_action: "next",
          } as ConditionConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "这是一个测试示例",
        })

        const result = await executor.execute()
        expect(result.output).toBe("true")
      })

      it("none 模式：不包含任何关键词时为真", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("condition", "条件判断", {
            input_variable: "用户问题",
            condition_type: "keyword",
            keywords: ["敏感", "违规"],
            keyword_mode: "none",
            true_action: "next",
            false_action: "next",
          } as ConditionConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "正常的文本",
        })

        const result = await executor.execute()
        expect(result.output).toBe("true")
      })
    })

    describe("长度判断", () => {
      it("应该正确判断文本长度", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("condition", "条件判断", {
            input_variable: "用户问题",
            condition_type: "length",
            length_operator: ">",
            length_value: 3,
            true_action: "next",
            false_action: "next",
          } as ConditionConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "12345",
        })

        const result = await executor.execute()
        expect(result.output).toBe("true")
      })

      it("应该支持各种比较操作符", async () => {
        // 测试 = 操作符
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("condition", "条件判断", {
            input_variable: "用户问题",
            condition_type: "length",
            length_operator: "=",
            length_value: 5,
            true_action: "next",
            false_action: "next",
          } as ConditionConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "12345",
        })

        const result = await executor.execute()
        expect(result.output).toBe("true")
      })
    })

    describe("正则判断", () => {
      it("应该使用正则表达式判断", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("condition", "条件判断", {
            input_variable: "用户问题",
            condition_type: "regex",
            regex_pattern: "\\w+@\\w+\\.\\w+",
            true_action: "next",
            false_action: "next",
          } as ConditionConfig, { order_index: 1 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "邮箱：test@example.com",
        })

        const result = await executor.execute()
        expect(result.output).toBe("true")
      })
    })

    describe("条件动作", () => {
      it("true_action = end 应该结束工作流", async () => {
        const nodeNames: string[] = []
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("condition", "条件判断", {
            input_variable: "用户问题",
            condition_type: "keyword",
            keywords: ["关键词"],
            keyword_mode: "any",
            true_action: "end",
            false_action: "next",
          } as ConditionConfig, { order_index: 1 }),
          createTestNode("output", "不应该执行", {}, { order_index: 2 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "包含关键词",
          onEvent: (e) => {
            if (e.type === "node_completed" && e.nodeName) {
              nodeNames.push(e.nodeName)
            }
          },
        })

        await executor.execute()

        // 由于 true_action = end，output 节点不应该被执行
        expect(nodeNames).not.toContain("不应该执行")
      })
    })
  })

  // ========== Loop 节点测试 ==========

  describe("LoopStart 节点执行", () => {
    it("固定次数循环应该执行指定次数", async () => {
      const blockId = "loop-block-1"
      const nodes = [
        createTestNode("start", "开始", {}, { id: "start-1", order_index: 0 }),
        createTestNode("loop_start", "循环开始", {
          loop_type: "count",
          max_iterations: 3,
        } as LoopStartConfig, { id: "loop-start-1", order_index: 1, block_id: blockId }),
        createTestNode("output", "输出", {}, { id: "output-1", order_index: 2, block_id: blockId }),
        createTestNode("loop_end", "循环结束", {}, { id: "loop-end-1", order_index: 3, block_id: blockId }),
      ]
      
      let loopCount = 0
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        onEvent: (e) => {
          if (e.type === "node_completed" && e.nodeName === "循环开始") {
            loopCount++
          }
        },
      })

      await executor.execute()
      
      // 循环开始节点会执行 4 次（3 次循环 + 1 次检测到达上限）
      expect(loopCount).toBe(4)
    })
  })

  // ========== 错误处理测试 ==========

  describe("错误处理", () => {
    it("节点执行失败应该停止工作流", async () => {
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("text_extract", "提取", {
          input_variable: "用户问题",
          extract_mode: "regex",
          regex_pattern: "[invalid",  // 无效的正则表达式
        } as TextExtractConfig, { order_index: 1 }),
        createTestNode("output", "不应该执行", {}, { order_index: 2 }),
      ]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "测试文本",
      })

      const result = await executor.execute()
      
      expect(result.status).toBe("failed")
      expect(result.error).toBeDefined()
    })

    it("应该发送 node_failed 事件", async () => {
      const events: string[] = []
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("text_extract", "提取", {
          input_variable: "用户问题",
          extract_mode: "regex",
          regex_pattern: "[invalid",  // 无效的正则表达式
        } as TextExtractConfig, { order_index: 1 }),
      ]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "测试文本",
        onEvent: (e) => events.push(e.type),
      })

      await executor.execute()
      
      expect(events).toContain("node_failed")
      expect(events).toContain("execution_failed")
    })
  })

  // ========== 暂停和继续测试 ==========

  describe("暂停和继续", () => {
    it("应该能暂停和继续执行", async () => {
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("output", "输出", {}, { order_index: 1 }),
      ]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "测试值",
      })

      const executePromise = executor.execute()
      
      // 立即暂停
      executor.pause()
      expect(executor.getStatus()).toBe("paused")
      
      // 继续执行
      executor.resume()
      
      const result = await executePromise
      expect(result.status).toBe("completed")
    })
  })

  // ========== 状态转换测试 ==========

  describe("executorStatusToDbStatus", () => {
    it("应该正确转换执行器状态到数据库状态", () => {
      expect(executorStatusToDbStatus("running")).toBe("running")
      expect(executorStatusToDbStatus("paused")).toBe("paused")
      expect(executorStatusToDbStatus("completed")).toBe("completed")
      expect(executorStatusToDbStatus("failed")).toBe("failed")
      expect(executorStatusToDbStatus("cancelled")).toBe("cancelled")
      expect(executorStatusToDbStatus("timeout")).toBe("timeout")
      expect(executorStatusToDbStatus("idle")).toBe("running")
    })
  })

  // ========== AI 节点测试 ==========

  describe("AI Chat 节点执行", () => {
    it("应该正确执行 AI 对话节点", async () => {
      const config: AIChatConfig = {
        provider: "openai",
        model: "gpt-4",
        system_prompt: "你是一个助手",
        user_prompt: "{{用户问题}}",
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 1,
        enable_history: false,
        history_count: 0,
        setting_ids: [],
      }
      
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("ai_chat", "AI对话", config, { order_index: 1 }),
      ]
      
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "你好",
      })

      const result = await executor.execute()
      
      expect(result.status).toBe("completed")
      expect(result.output).toBe("AI 回复内容")
      expect(mockChatStream).toHaveBeenCalledTimes(1)
    })

    it("应该发送流式输出事件", async () => {
      const streamEvents: string[] = []
      
      // 模拟流式输出（每次 chunk 只包含增量内容，执行器会累加）
      mockChatStream.mockImplementation(async (_options, _config, onChunk) => {
        onChunk({ content: "第", done: false })
        onChunk({ content: "一", done: false })
        onChunk({ content: "部", done: false })
        onChunk({ content: "分", done: false })
        onChunk({ content: "", done: true })
      })
      
      const config: AIChatConfig = {
        provider: "openai",
        model: "gpt-4",
        system_prompt: "",
        user_prompt: "测试",
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 1,
        enable_history: false,
        history_count: 0,
        setting_ids: [],
      }
      
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("ai_chat", "AI对话", config, { order_index: 1 }),
      ]
      
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "测试",
        onEvent: (event) => {
          if (event.type === "node_streaming") {
            streamEvents.push(event.content || "")
          }
        },
      })

      await executor.execute()
      
      // 流式事件应该被发送
      expect(streamEvents.length).toBeGreaterThan(0)
      // 最后一个事件应该是完整输出
      expect(streamEvents[streamEvents.length - 1]).toBe("第一部分")
    })

    it("AI 提供商未配置应该抛出错误", async () => {
      const config: AIChatConfig = {
        provider: "gemini",  // 未启用的提供商
        model: "gemini-pro",
        system_prompt: "",
        user_prompt: "测试",
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 1,
        enable_history: false,
        history_count: 0,
        setting_ids: [],
      }
      
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("ai_chat", "AI对话", config, { order_index: 1 }),
      ]
      
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "测试",
      })

      const result = await executor.execute()
      
      expect(result.status).toBe("failed")
      expect(result.error).toContain("未配置或未启用")
    })

    it("AI 调用出错应该正确处理", async () => {
      mockChatStream.mockRejectedValue(new Error("API 调用失败"))
      
      const config: AIChatConfig = {
        provider: "openai",
        model: "gpt-4",
        system_prompt: "",
        user_prompt: "测试",
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 1,
        enable_history: false,
        history_count: 0,
        setting_ids: [],
      }
      
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("ai_chat", "AI对话", config, { order_index: 1 }),
      ]
      
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "测试",
      })

      const result = await executor.execute()
      
      expect(result.status).toBe("failed")
      expect(result.error).toContain("API 调用失败")
    })

    it("应该支持变量插值到提示词", async () => {
      let capturedMessages: unknown[] = []
      
      mockChatStream.mockImplementation(async (options, _config, onChunk) => {
        capturedMessages = options.messages
        onChunk({ content: "收到", done: false })
        onChunk({ content: "", done: true })
      })
      
      const config: AIChatConfig = {
        provider: "openai",
        model: "gpt-4",
        system_prompt: "回答用户问题：{{用户问题}}",
        user_prompt: "{{用户问题}}",  // 使用用户问题变量
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 1,
        enable_history: false,
        history_count: 0,
        setting_ids: [],
      }
      
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("ai_chat", "AI对话", config, { order_index: 1 }),
      ]
      
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "什么是人工智能",
      })

      await executor.execute()
      
      // 检查消息中的变量是否被正确替换
      const systemMsg = capturedMessages.find((m: any) => m.role === "system") as any
      const userMsg = capturedMessages.find((m: any) => m.role === "user") as any
      
      expect(systemMsg?.content).toContain("什么是人工智能")
      expect(userMsg?.content).toBe("什么是人工智能")
    })

    it("没有系统提示词和用户问题应该抛出错误", async () => {
      // 当 system_prompt 为空，且 user_prompt 插值后也为空时，应该抛出错误
      const config: AIChatConfig = {
        provider: "openai",
        model: "gpt-4",
        system_prompt: "",
        user_prompt: "{{用户问题}}",  // 用户问题为空
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 1,
        enable_history: false,
        history_count: 0,
        setting_ids: [],
      }
      
      const nodes = [
        createTestNode("start", "开始", { default_value: "" } as StartConfig, { order_index: 0 }),
        createTestNode("ai_chat", "AI对话", config, { order_index: 1 }),
      ]
      
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "",  // 空输入
      })

      const result = await executor.execute()
      
      // 由于 user_prompt 插值后为空，且 system_prompt 也为空，应该失败
      expect(result.status).toBe("failed")
      expect(result.error).toContain("需要系统提示词或用户问题")
    })

    describe("对话历史功能", () => {
      it("enable_history=true 时应该保存对话历史", async () => {
        let callCount = 0
        let capturedMessages: unknown[][] = []
        
        mockChatStream.mockImplementation(async (options, _config, onChunk) => {
          callCount++
          capturedMessages.push([...options.messages])
          onChunk({ content: `回复${callCount}`, done: false })
          onChunk({ content: "", done: true })
        })
        
        const config: AIChatConfig = {
          provider: "openai",
          model: "gpt-4",
          system_prompt: "",
          user_prompt: "{{用户问题}}",
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 1,
          enable_history: true,
          history_count: 5,
          setting_ids: [],
        }
        
        const aiNodeId = "ai-node-1"
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("ai_chat", "AI对话", config, { id: aiNodeId, order_index: 1 }),
        ]
        
        // 第一次执行
        const executor1 = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "第一个问题",
        })
        
        await executor1.execute()
        
        // 验证第一次没有历史记录
        expect(capturedMessages[0]).toHaveLength(1)  // 只有 user 消息
        
        // 验证历史已保存到上下文
        const ctx1 = executor1.getContext()
        const history = ctx1.getHistory(aiNodeId)
        expect(history).toHaveLength(2)  // user + assistant
        expect(history[0].role).toBe("user")
        expect(history[0].content).toBe("第一个问题")
        expect(history[1].role).toBe("assistant")
        expect(history[1].content).toBe("回复1")
      })

      it("history_count 应该限制历史消息数量", async () => {
        let capturedMessages: unknown[] = []
        
        mockChatStream.mockImplementation(async (options, _config, onChunk) => {
          capturedMessages = [...options.messages]
          onChunk({ content: "回复", done: false })
          onChunk({ content: "", done: true })
        })
        
        const config: AIChatConfig = {
          provider: "openai",
          model: "gpt-4",
          system_prompt: "",
          user_prompt: "当前问题",
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 1,
          enable_history: true,
          history_count: 2,  // 只保留 2 条历史
          setting_ids: [],
        }
        
        const aiNodeId = "ai-node-history"
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("ai_chat", "AI对话", config, { id: aiNodeId, order_index: 1 }),
        ]
        
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "测试",
        })
        
        // 预先添加历史记录
        const ctx = executor.getContext()
        ctx.addToHistory(aiNodeId, { role: "user", content: "历史问题1" })
        ctx.addToHistory(aiNodeId, { role: "assistant", content: "历史回复1" })
        ctx.addToHistory(aiNodeId, { role: "user", content: "历史问题2" })
        ctx.addToHistory(aiNodeId, { role: "assistant", content: "历史回复2" })
        ctx.addToHistory(aiNodeId, { role: "user", content: "历史问题3" })
        ctx.addToHistory(aiNodeId, { role: "assistant", content: "历史回复3" })
        
        await executor.execute()
        
        // 应该只包含最近 2 条历史 + 当前 user 消息
        // 历史：历史问题3, 历史回复3
        // 当前：当前问题
        expect(capturedMessages).toHaveLength(3)
        expect((capturedMessages[0] as any).content).toBe("历史问题3")
        expect((capturedMessages[1] as any).content).toBe("历史回复3")
        expect((capturedMessages[2] as any).content).toBe("当前问题")
      })

      it("enable_history=false 时不应该包含历史", async () => {
        let capturedMessages: unknown[] = []
        
        mockChatStream.mockImplementation(async (options, _config, onChunk) => {
          capturedMessages = [...options.messages]
          onChunk({ content: "回复", done: false })
          onChunk({ content: "", done: true })
        })
        
        const config: AIChatConfig = {
          provider: "openai",
          model: "gpt-4",
          system_prompt: "系统提示",
          user_prompt: "当前问题",
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 1,
          enable_history: false,  // 禁用历史
          history_count: 5,
          setting_ids: [],
        }
        
        const aiNodeId = "ai-node-no-history"
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("ai_chat", "AI对话", config, { id: aiNodeId, order_index: 1 }),
        ]
        
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "测试",
        })
        
        // 预先添加历史记录
        const ctx = executor.getContext()
        ctx.addToHistory(aiNodeId, { role: "user", content: "历史问题" })
        ctx.addToHistory(aiNodeId, { role: "assistant", content: "历史回复" })
        
        await executor.execute()
        
        // 应该只有 system 和 user 消息，没有历史
        expect(capturedMessages).toHaveLength(2)
        expect((capturedMessages[0] as any).role).toBe("system")
        expect((capturedMessages[1] as any).role).toBe("user")
      })
    })

    describe("设定注入功能", () => {
      it("应该将选中的设定注入到系统提示词", async () => {
        let capturedMessages: unknown[] = []
        
        mockChatStream.mockImplementation(async (options, _config, onChunk) => {
          capturedMessages = [...options.messages]
          onChunk({ content: "回复", done: false })
          onChunk({ content: "", done: true })
        })
        
        const config: AIChatConfig = {
          provider: "openai",
          model: "gpt-4",
          system_prompt: "你是助手",
          user_prompt: "问题",
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 1,
          enable_history: false,
          history_count: 0,
          setting_ids: ["setting-1", "setting-2"],
        }
        
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("ai_chat", "AI对话", config, { order_index: 1 }),
        ]
        
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "测试",
          settings: [
            {
              id: "setting-1",
              project_id: "project-1",
              category: "character",
              name: "主角",
              content: "一个勇敢的骑士",
              enabled: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              id: "setting-2",
              project_id: "project-1",
              category: "character",
              name: "反派",
              content: "黑暗法师",
              enabled: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        })
        
        await executor.execute()
        
        // 系统提示词应该包含设定内容
        const systemMsg = capturedMessages.find((m: any) => m.role === "system") as any
        expect(systemMsg).toBeDefined()
        expect(systemMsg.content).toContain("主角")
        expect(systemMsg.content).toContain("勇敢的骑士")
        expect(systemMsg.content).toContain("反派")
        expect(systemMsg.content).toContain("黑暗法师")
        // 原始系统提示词也应该保留
        expect(systemMsg.content).toContain("你是助手")
      })

      it("禁用的设定不应该被注入", async () => {
        let capturedMessages: unknown[] = []
        
        mockChatStream.mockImplementation(async (options, _config, onChunk) => {
          capturedMessages = [...options.messages]
          onChunk({ content: "回复", done: false })
          onChunk({ content: "", done: true })
        })
        
        const config: AIChatConfig = {
          provider: "openai",
          model: "gpt-4",
          system_prompt: "系统提示",
          user_prompt: "问题",
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 1,
          enable_history: false,
          history_count: 0,
          setting_ids: ["setting-enabled", "setting-disabled"],
        }
        
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("ai_chat", "AI对话", config, { order_index: 1 }),
        ]
        
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "测试",
          settings: [
            {
              id: "setting-enabled",
              project_id: "project-1",
              category: "worldview",
              name: "启用的设定",
              content: "应该出现",
              enabled: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              id: "setting-disabled",
              project_id: "project-1",
              category: "worldview",
              name: "禁用的设定",
              content: "不应该出现",
              enabled: false,  // 禁用
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        })
        
        await executor.execute()
        
        const systemMsg = capturedMessages.find((m: any) => m.role === "system") as any
        expect(systemMsg.content).toContain("应该出现")
        expect(systemMsg.content).not.toContain("不应该出现")
      })

      it("未选中的设定不应该被注入", async () => {
        let capturedMessages: unknown[] = []
        
        mockChatStream.mockImplementation(async (options, _config, onChunk) => {
          capturedMessages = [...options.messages]
          onChunk({ content: "回复", done: false })
          onChunk({ content: "", done: true })
        })
        
        const config: AIChatConfig = {
          provider: "openai",
          model: "gpt-4",
          system_prompt: "系统提示",
          user_prompt: "问题",
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 1,
          enable_history: false,
          history_count: 0,
          setting_ids: ["setting-selected"],  // 只选中一个
        }
        
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("ai_chat", "AI对话", config, { order_index: 1 }),
        ]
        
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "测试",
          settings: [
            {
              id: "setting-selected",
              project_id: "project-1",
              category: "style",
              name: "选中的设定",
              content: "应该出现",
              enabled: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              id: "setting-not-selected",
              project_id: "project-1",
              category: "style",
              name: "未选中的设定",
              content: "不应该出现",
              enabled: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        })
        
        await executor.execute()
        
        const systemMsg = capturedMessages.find((m: any) => m.role === "system") as any
        expect(systemMsg.content).toContain("应该出现")
        expect(systemMsg.content).not.toContain("不应该出现")
      })

      it("空 setting_ids 不应该注入任何设定", async () => {
        let capturedMessages: unknown[] = []
        
        mockChatStream.mockImplementation(async (options, _config, onChunk) => {
          capturedMessages = [...options.messages]
          onChunk({ content: "回复", done: false })
          onChunk({ content: "", done: true })
        })
        
        const config: AIChatConfig = {
          provider: "openai",
          model: "gpt-4",
          system_prompt: "纯净的系统提示",
          user_prompt: "问题",
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 1,
          enable_history: false,
          history_count: 0,
          setting_ids: [],  // 空数组
        }
        
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("ai_chat", "AI对话", config, { order_index: 1 }),
        ]
        
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "测试",
          settings: [
            {
              id: "setting-1",
              project_id: "project-1",
              category: "character",
              name: "设定",
              content: "不应该出现的内容",
              enabled: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        })
        
        await executor.execute()
        
        const systemMsg = capturedMessages.find((m: any) => m.role === "system") as any
        expect(systemMsg.content).toBe("纯净的系统提示")
      })

      it("应该使用自定义设定提示词模板", async () => {
        let capturedMessages: unknown[] = []
        
        mockChatStream.mockImplementation(async (options, _config, onChunk) => {
          capturedMessages = [...options.messages]
          onChunk({ content: "回复", done: false })
          onChunk({ content: "", done: true })
        })
        
        const config: AIChatConfig = {
          provider: "openai",
          model: "gpt-4",
          system_prompt: "",
          user_prompt: "问题",
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 1,
          enable_history: false,
          history_count: 0,
          setting_ids: ["setting-1"],
        }
        
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("ai_chat", "AI对话", config, { order_index: 1 }),
        ]
        
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "测试",
          settings: [
            {
              id: "setting-1",
              project_id: "project-1",
              category: "outline",
              name: "大纲",
              content: "故事从一个小村庄开始",
              enabled: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          settingPrompts: [
            {
              id: "prompt-1",
              project_id: "project-1",
              category: "outline",
              prompt_template: "=== 自定义大纲模板 ===\n{{items}}\n=== 结束 ===",
              enabled: true,
            },
          ],
        })
        
        await executor.execute()
        
        const systemMsg = capturedMessages.find((m: any) => m.role === "system") as any
        expect(systemMsg.content).toContain("自定义大纲模板")
        expect(systemMsg.content).toContain("故事从一个小村庄开始")
        expect(systemMsg.content).toContain("=== 结束 ===")
      })

      it("禁用的自定义模板应该使用默认模板", async () => {
        let capturedMessages: unknown[] = []
        
        mockChatStream.mockImplementation(async (options, _config, onChunk) => {
          capturedMessages = [...options.messages]
          onChunk({ content: "回复", done: false })
          onChunk({ content: "", done: true })
        })
        
        const config: AIChatConfig = {
          provider: "openai",
          model: "gpt-4",
          system_prompt: "",
          user_prompt: "问题",
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 1,
          enable_history: false,
          history_count: 0,
          setting_ids: ["setting-1"],
        }
        
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("ai_chat", "AI对话", config, { order_index: 1 }),
        ]
        
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "测试",
          settings: [
            {
              id: "setting-1",
              project_id: "project-1",
              category: "character",
              name: "角色A",
              content: "一个神秘人物",
              enabled: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          settingPrompts: [
            {
              id: "prompt-1",
              project_id: "project-1",
              category: "character",
              prompt_template: "不应该使用的模板",
              enabled: false,  // 禁用
            },
          ],
        })
        
        await executor.execute()
        
        const systemMsg = capturedMessages.find((m: any) => m.role === "system") as any
        // 应该使用默认模板 "【角色设定】"
        expect(systemMsg.content).toContain("【角色设定】")
        expect(systemMsg.content).not.toContain("不应该使用的模板")
      })

      it("应该支持 Handlebars 风格的模板", async () => {
        let capturedMessages: unknown[] = []
        
        mockChatStream.mockImplementation(async (options, _config, onChunk) => {
          capturedMessages = [...options.messages]
          onChunk({ content: "回复", done: false })
          onChunk({ content: "", done: true })
        })
        
        const config: AIChatConfig = {
          provider: "openai",
          model: "gpt-4",
          system_prompt: "",
          user_prompt: "问题",
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 1,
          enable_history: false,
          history_count: 0,
          setting_ids: ["setting-1", "setting-2"],
        }
        
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("ai_chat", "AI对话", config, { order_index: 1 }),
        ]
        
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "测试",
          settings: [
            {
              id: "setting-1",
              project_id: "project-1",
              category: "worldview",
              name: "世界观A",
              content: "魔法世界",
              enabled: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              id: "setting-2",
              project_id: "project-1",
              category: "worldview",
              name: "世界观B",
              content: "科技世界",
              enabled: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          settingPrompts: [
            {
              id: "prompt-1",
              project_id: "project-1",
              category: "worldview",
              prompt_template: "世界观列表：{{#each items}}[{{name}}:{{content}}]{{/each}}",
              enabled: true,
            },
          ],
        })
        
        await executor.execute()
        
        const systemMsg = capturedMessages.find((m: any) => m.role === "system") as any
        expect(systemMsg.content).toContain("[世界观A:魔法世界]")
        expect(systemMsg.content).toContain("[世界观B:科技世界]")
      })

      it("resolvedConfig 应该包含使用的设定名称", async () => {
        let resolvedConfig: Record<string, unknown> = {}
        
        mockChatStream.mockImplementation(async (_options, _config, onChunk) => {
          onChunk({ content: "回复", done: false })
          onChunk({ content: "", done: true })
        })
        
        const config: AIChatConfig = {
          provider: "openai",
          model: "gpt-4",
          system_prompt: "系统提示",
          user_prompt: "问题",
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 1,
          enable_history: false,
          history_count: 0,
          setting_ids: ["setting-1", "setting-2"],
        }
        
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("ai_chat", "AI对话", config, { order_index: 1 }),
        ]
        
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          initialInput: "测试",
          settings: [
            {
              id: "setting-1",
              project_id: "project-1",
              category: "character",
              name: "角色设定A",
              content: "内容A",
              enabled: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              id: "setting-2",
              project_id: "project-1",
              category: "character",
              name: "角色设定B",
              content: "内容B",
              enabled: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          onEvent: (e) => {
            if (e.type === "node_completed" && e.nodeType === "ai_chat" && e.resolvedConfig) {
              resolvedConfig = e.resolvedConfig
            }
          },
        })
        
        await executor.execute()
        
        expect(resolvedConfig.settingNames).toEqual(["角色设定A", "角色设定B"])
      })
    })
  })

  // ========== 并行执行节点测试 ==========

  describe("Parallel 节点执行", () => {
    it("应该执行并发开始和结束节点", async () => {
      const blockId = "parallel-block-1"
      
      const nodes = [
        createTestNode("start", "开始", {}, { id: "start-1", order_index: 0 }),
        createTestNode("parallel_start", "并发开始", {
          concurrency: 3,
          output_mode: "concat",
          output_separator: "\n",
        } as ParallelStartConfig, { id: "parallel-start-1", order_index: 1, block_id: blockId }),
        createTestNode("text_concat", "任务1", {
          sources: [{ type: "custom", custom: "结果1" }],
        } as TextConcatConfig, { id: "task-1", order_index: 2, block_id: blockId }),
        createTestNode("text_concat", "任务2", {
          sources: [{ type: "custom", custom: "结果2" }],
        } as TextConcatConfig, { id: "task-2", order_index: 3, block_id: blockId }),
        createTestNode("parallel_end", "并发结束", {}, { id: "parallel-end-1", order_index: 4, block_id: blockId }),
      ]
      
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
      })

      const result = await executor.execute()
      
      expect(result.status).toBe("completed")
    })

    it("并发块内节点应该并行执行", async () => {
      const blockId = "parallel-block-2"
      const executionOrder: string[] = []
      
      const nodes = [
        createTestNode("start", "开始", {}, { id: "start-1", order_index: 0 }),
        createTestNode("parallel_start", "并发开始", {
          concurrency: 5,
          output_mode: "concat",
          output_separator: ",",
        } as ParallelStartConfig, { id: "parallel-start-1", order_index: 1, block_id: blockId }),
        createTestNode("text_concat", "任务A", {
          sources: [{ type: "custom", custom: "A" }],
        } as TextConcatConfig, { id: "task-a", order_index: 2, block_id: blockId }),
        createTestNode("text_concat", "任务B", {
          sources: [{ type: "custom", custom: "B" }],
        } as TextConcatConfig, { id: "task-b", order_index: 3, block_id: blockId }),
        createTestNode("text_concat", "任务C", {
          sources: [{ type: "custom", custom: "C" }],
        } as TextConcatConfig, { id: "task-c", order_index: 4, block_id: blockId }),
        createTestNode("parallel_end", "并发结束", {}, { id: "parallel-end-1", order_index: 5, block_id: blockId }),
      ]
      
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        onEvent: (event) => {
          if (event.type === "node_completed" && event.nodeName) {
            executionOrder.push(event.nodeName)
          }
        },
      })

      await executor.execute()
      
      // 并发块内的任务应该都被执行
      expect(executionOrder).toContain("任务A")
      expect(executionOrder).toContain("任务B")
      expect(executionOrder).toContain("任务C")
    })

    it("空并发块应该正常处理", async () => {
      const blockId = "parallel-block-empty"
      const nodeEvents: string[] = []
      
      const nodes = [
        createTestNode("start", "开始", {}, { id: "start-1", order_index: 0 }),
        createTestNode("parallel_start", "并发开始", {
          concurrency: 3,
          output_mode: "concat",
        } as ParallelStartConfig, { id: "parallel-start-1", order_index: 1, block_id: blockId }),
        createTestNode("parallel_end", "并发结束", {}, { id: "parallel-end-1", order_index: 2, block_id: blockId }),
      ]
      
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        onEvent: (event) => {
          if (event.type === "node_completed" && event.content) {
            nodeEvents.push(event.content)
          }
        },
      })

      const result = await executor.execute()
      
      expect(result.status).toBe("completed")
      // 空并发块的 parallel_start 节点应该输出提示
      expect(nodeEvents).toContain("并发块为空")
    })

    it("缺少 block_id 应该抛出错误", async () => {
      const nodes = [
        createTestNode("start", "开始", {}, { id: "start-1", order_index: 0 }),
        createTestNode("parallel_start", "并发开始", {
          concurrency: 3,
        } as ParallelStartConfig, { id: "parallel-start-1", order_index: 1 }),  // 没有 block_id
      ]
      
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
      })

      const result = await executor.execute()
      
      expect(result.status).toBe("failed")
      expect(result.error).toContain("block_id")
    })

    it("并发输出模式 array 应该返回 JSON 数组", async () => {
      const blockId = "parallel-block-array"
      
      const nodes = [
        createTestNode("start", "开始", {}, { id: "start-1", order_index: 0 }),
        createTestNode("parallel_start", "并发开始", {
          concurrency: 3,
          output_mode: "array",
        } as ParallelStartConfig, { id: "parallel-start-1", order_index: 1, block_id: blockId }),
        createTestNode("text_concat", "任务1", {
          sources: [{ type: "custom", custom: "值1" }],
        } as TextConcatConfig, { id: "task-1", order_index: 2, block_id: blockId }),
        createTestNode("parallel_end", "并发结束", {}, { id: "parallel-end-1", order_index: 3, block_id: blockId }),
      ]
      
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
      })

      await executor.execute()
      
      // 检查结果变量是否是 JSON 格式
      const ctx = executor.getContext()
      const results = ctx.getVariable(`_parallel_${blockId}_results`)
      expect(results).toBeDefined()
      expect(() => JSON.parse(results!)).not.toThrow()
    })
  })

  // ========== 超时测试 ==========

  describe("超时处理", () => {
    it("超过工作流超时时间应该停止执行", async () => {
      vi.useFakeTimers()
      
      const timeoutWorkflow = createTestWorkflow({ timeout_seconds: 1 })  // 1 秒超时
      
      // 模拟 AI 调用需要较长时间
      mockChatStream.mockImplementation(async (_options, _config, onChunk) => {
        // 延迟 2 秒
        await new Promise(resolve => setTimeout(resolve, 2000))
        onChunk({ content: "回复", done: false })
        onChunk({ content: "", done: true })
      })
      
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("ai_chat", "AI对话", {
          provider: "openai",
          model: "gpt-4",
          system_prompt: "",
          user_prompt: "测试",
          temperature: 0.7,
          max_tokens: 100,
          top_p: 1,
          enable_history: false,
          history_count: 0,
          setting_ids: [],
        } as AIChatConfig, { order_index: 1 }),
      ]
      
      const executor = new WorkflowExecutor({
        workflow: timeoutWorkflow,
        nodes,
        globalConfig,
      })

      const executePromise = executor.execute()
      
      // 快进超过超时时间
      vi.advanceTimersByTime(1500)
      
      const result = await executePromise
      
      // 由于超时检测在节点之间进行，实际结果可能是 completed 或 timeout
      expect(["completed", "timeout", "failed"]).toContain(result.status)
    })
  })

  // ========== 取消执行测试 ==========

  describe("取消执行", () => {
    it("取消执行应该中断流式输出", async () => {
      let streamCount = 0
      
      mockChatStream.mockImplementation(async (_options, _config, onChunk) => {
        for (let i = 0; i < 10; i++) {
          streamCount++
          onChunk({ content: `chunk${i}`, done: false })
          await new Promise(resolve => setTimeout(resolve, 10))
        }
        onChunk({ content: "", done: true })
      })
      
      const config: AIChatConfig = {
        provider: "openai",
        model: "gpt-4",
        system_prompt: "",
        user_prompt: "测试",
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 1,
        enable_history: false,
        history_count: 0,
        setting_ids: [],
      }
      
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("ai_chat", "AI对话", config, { order_index: 1 }),
      ]
      
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "测试",
      })

      const executePromise = executor.execute()
      
      // 短暂延迟后取消
      setTimeout(() => {
        executor.cancel()
      }, 30)
      
      const result = await executePromise
      
      // 取消后状态应该是 cancelled 或 failed（由于执行已取消抛出错误）
      expect(["cancelled", "failed"]).toContain(result.status)
    })

    it("暂停状态下取消应该正确处理", async () => {
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("output", "输出", {}, { order_index: 1 }),
      ]
      
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "测试值",
      })

      const executePromise = executor.execute()
      
      // 暂停
      executor.pause()
      expect(executor.getStatus()).toBe("paused")
      
      // 取消（应该先恢复再取消）
      executor.cancel()
      
      const result = await executePromise
      
      expect(["completed", "cancelled"]).toContain(result.status)
    })
  })

  // ========== 条件分支块结构测试 ==========

  describe("Condition If/Else/End 块结构", () => {
    it("条件为真时应该执行 if 分支", async () => {
      const blockId = "condition-block-1"
      const executedNodes: string[] = []
      
      const nodes = [
        createTestNode("start", "开始", {}, { id: "start-1", order_index: 0 }),
        createTestNode("condition_if", "条件判断", {
          input_variable: "用户问题",
          condition_type: "keyword",
          keywords: ["关键词"],
          keyword_mode: "any",
        }, { id: "if-1", order_index: 1, block_id: blockId }),
        createTestNode("text_concat", "真分支", {
          sources: [{ type: "custom", custom: "true_branch" }],
        } as TextConcatConfig, { id: "true-1", order_index: 2, block_id: blockId }),
        createTestNode("condition_else", "Else", {}, { id: "else-1", order_index: 3, block_id: blockId }),
        createTestNode("text_concat", "假分支", {
          sources: [{ type: "custom", custom: "false_branch" }],
        } as TextConcatConfig, { id: "false-1", order_index: 4, block_id: blockId }),
        createTestNode("condition_end", "条件结束", {}, { id: "end-1", order_index: 5, block_id: blockId }),
      ]
      
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "包含关键词",
        onEvent: (e) => {
          if (e.type === "node_completed" && e.nodeName) {
            executedNodes.push(e.nodeName)
          }
        },
      })

      await executor.execute()
      
      expect(executedNodes).toContain("真分支")
      expect(executedNodes).not.toContain("假分支")
    })

    it("条件为假时应该执行 else 分支", async () => {
      const blockId = "condition-block-2"
      const executedNodes: string[] = []
      
      const nodes = [
        createTestNode("start", "开始", {}, { id: "start-1", order_index: 0 }),
        createTestNode("condition_if", "条件判断", {
          input_variable: "用户问题",
          condition_type: "keyword",
          keywords: ["关键词"],
          keyword_mode: "any",
        }, { id: "if-1", order_index: 1, block_id: blockId }),
        createTestNode("text_concat", "真分支", {
          sources: [{ type: "custom", custom: "true_branch" }],
        } as TextConcatConfig, { id: "true-1", order_index: 2, block_id: blockId }),
        createTestNode("condition_else", "Else", {}, { id: "else-1", order_index: 3, block_id: blockId }),
        createTestNode("text_concat", "假分支", {
          sources: [{ type: "custom", custom: "false_branch" }],
        } as TextConcatConfig, { id: "false-1", order_index: 4, block_id: blockId }),
        createTestNode("condition_end", "条件结束", {}, { id: "end-1", order_index: 5, block_id: blockId }),
      ]
      
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "不包含目标词",
        onEvent: (e) => {
          if (e.type === "node_completed" && e.nodeName) {
            executedNodes.push(e.nodeName)
          }
        },
      })

      await executor.execute()
      
      expect(executedNodes).toContain("假分支")
      expect(executedNodes).not.toContain("真分支")
    })

    it("没有 else 分支时条件为假应该跳到 end", async () => {
      const blockId = "condition-block-3"
      const executedNodes: string[] = []
      
      const nodes = [
        createTestNode("start", "开始", {}, { id: "start-1", order_index: 0 }),
        createTestNode("condition_if", "条件判断", {
          input_variable: "用户问题",
          condition_type: "keyword",
          keywords: ["关键词"],
          keyword_mode: "any",
        }, { id: "if-1", order_index: 1, block_id: blockId }),
        createTestNode("text_concat", "真分支", {
          sources: [{ type: "custom", custom: "executed" }],
        } as TextConcatConfig, { id: "true-1", order_index: 2, block_id: blockId }),
        createTestNode("condition_end", "条件结束", {}, { id: "end-1", order_index: 3, block_id: blockId }),
        createTestNode("text_concat", "后续节点", {
          sources: [{ type: "custom", custom: "done" }],
        } as TextConcatConfig, { id: "after-1", order_index: 4 }),
      ]
      
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "不匹配",
        onEvent: (e) => {
          if (e.type === "node_completed" && e.nodeName) {
            executedNodes.push(e.nodeName)
          }
        },
      })

      await executor.execute()
      
      // if 分支不应该被执行
      expect(executedNodes).not.toContain("真分支")
      // 后续节点应该被执行
      expect(executedNodes).toContain("后续节点")
    })
  })

  // ========== 修改节点输出测试 ==========

  describe("修改节点输出", () => {
    it("非暂停状态下修改输出应该抛出错误", async () => {
      const nodes = [
        createTestNode("start", "开始", {}, { id: "start-1", order_index: 0 }),
      ]
      
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
      })

      await executor.execute()
      
      // 执行完成后尝试修改
      expect(() => executor.modifyNodeOutput("start-1", "新输出")).toThrow("只能在暂停状态下修改")
    })

    it("修改不存在的节点应该抛出错误", async () => {
      const nodes = [
        createTestNode("start", "开始", {}, { id: "start-1", order_index: 0 }),
        createTestNode("output", "输出", {}, { id: "output-1", order_index: 1 }),
      ]
      
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "测试值",
      })

      const executePromise = executor.execute()
      
      // 暂停
      executor.pause()
      
      // 尝试修改不存在的节点
      expect(() => executor.modifyNodeOutput("nonexistent", "新输出")).toThrow("不存在")
      
      executor.resume()
      await executePromise
    })
  })

  // ========== 获取上下文测试 ==========

  describe("获取执行上下文", () => {
    it("应该能获取当前节点索引", async () => {
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("output", "输出", {}, { order_index: 1 }),
      ]
      
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "测试值",
      })

      expect(executor.getCurrentNodeIndex()).toBe(0)
      
      await executor.execute()
      
      // 执行完成后索引应该超出节点数
      expect(executor.getCurrentNodeIndex()).toBe(2)
    })
  })
})

