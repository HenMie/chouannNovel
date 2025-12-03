// lib/engine/executor.ts 执行器测试

import { describe, it, expect, beforeEach, vi } from "vitest"
import { WorkflowExecutor, executorStatusToDbStatus } from "../executor"
import type {
  Workflow,
  WorkflowNode,
  GlobalConfig,
  StartConfig,
  VarSetConfig,
  VarGetConfig,
  TextExtractConfig,
  TextConcatConfig,
  ConditionConfig,
  LoopStartConfig,
} from "@/types"

// Mock AI 模块
vi.mock("@/lib/ai", () => ({
  chatStream: vi.fn(async (_options, _config, onChunk) => {
    // 模拟流式输出
    onChunk({ content: "AI 回复内容", done: false })
    onChunk({ content: "", done: true })
  }),
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
  config: Record<string, unknown> = {},
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

  // ========== VarSet 节点测试 ==========

  describe("VarSet 节点执行", () => {
    it("应该能设置变量", async () => {
      const config: VarSetConfig = {
        variable_name: "myVar",
        custom_value: "变量值",
      }
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("var_set", "设置变量", config, { order_index: 1 }),
      ]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
      })

      await executor.execute()

      const ctx = executor.getContext()
      expect(ctx.getVariable("myVar")).toBe("变量值")
    })

    it("应该支持变量插值", async () => {
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("var_set", "设置变量", {
          variable_name: "greeting",
          custom_value: "你好，{{用户问题}}！",
        } as VarSetConfig, { order_index: 1 }),
      ]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
        initialInput: "张三",
      })

      await executor.execute()

      const ctx = executor.getContext()
      expect(ctx.getVariable("greeting")).toBe("你好，张三！")
    })
  })

  // ========== VarGet 节点测试 ==========

  describe("VarGet 节点执行", () => {
    it("应该能获取变量值", async () => {
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("var_set", "设置变量", {
          variable_name: "testVar",
          custom_value: "测试值",
        } as VarSetConfig, { order_index: 1 }),
        createTestNode("var_get", "获取变量", {
          variable_name: "testVar",
        } as VarGetConfig, { order_index: 2 }),
      ]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
      })

      const result = await executor.execute()
      expect(result.output).toBe("测试值")
    })

    it("获取不存在的变量应该抛出错误", async () => {
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("var_get", "获取变量", {
          variable_name: "nonexistent",
        } as VarGetConfig, { order_index: 1 }),
      ]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
      })

      const result = await executor.execute()
      expect(result.status).toBe("failed")
      expect(result.error).toContain("不存在")
    })
  })

  // ========== TextExtract 节点测试 ==========

  describe("TextExtract 节点执行", () => {
    describe("正则提取模式", () => {
      it("应该能使用正则表达式提取文本", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("var_set", "设置文本", {
            variable_name: "text",
            custom_value: "订单号：12345，金额：99.9",
          } as VarSetConfig, { order_index: 1 }),
          createTestNode("text_extract", "提取", {
            input_variable: "text",
            extract_mode: "regex",
            regex_pattern: "订单号：(\\d+)",
          } as TextExtractConfig, { order_index: 2 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
        })

        const result = await executor.execute()
        expect(result.output).toBe("12345")
      })

      it("无效的正则表达式应该抛出错误", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("var_set", "设置文本", {
            variable_name: "text",
            custom_value: "测试文本",
          } as VarSetConfig, { order_index: 1 }),
          createTestNode("text_extract", "提取", {
            input_variable: "text",
            extract_mode: "regex",
            regex_pattern: "[invalid",
          } as TextExtractConfig, { order_index: 2 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
        })

        const result = await executor.execute()
        expect(result.status).toBe("failed")
      })
    })

    describe("标记提取模式", () => {
      it("应该能使用起始和结束标记提取文本", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("var_set", "设置文本", {
            variable_name: "text",
            custom_value: "前缀[START]中间内容[END]后缀",
          } as VarSetConfig, { order_index: 1 }),
          createTestNode("text_extract", "提取", {
            input_variable: "text",
            extract_mode: "start_end",
            start_marker: "[START]",
            end_marker: "[END]",
          } as TextExtractConfig, { order_index: 2 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
        })

        const result = await executor.execute()
        expect(result.output).toBe("中间内容")
      })

      it("没有结束标记时应该提取到末尾", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("var_set", "设置文本", {
            variable_name: "text",
            custom_value: "前缀[START]后面的所有内容",
          } as VarSetConfig, { order_index: 1 }),
          createTestNode("text_extract", "提取", {
            input_variable: "text",
            extract_mode: "start_end",
            start_marker: "[START]",
            end_marker: "[END]",
          } as TextExtractConfig, { order_index: 2 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
        })

        const result = await executor.execute()
        expect(result.output).toBe("后面的所有内容")
      })
    })

    describe("JSON 路径提取模式", () => {
      it("应该能使用 JSON 路径提取值", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("var_set", "设置JSON", {
            variable_name: "json",
            custom_value: '{"user":{"name":"张三","age":25}}',
          } as VarSetConfig, { order_index: 1 }),
          createTestNode("text_extract", "提取", {
            input_variable: "json",
            extract_mode: "json_path",
            json_path: "user.name",
          } as TextExtractConfig, { order_index: 2 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
        })

        const result = await executor.execute()
        expect(result.output).toBe("张三")
      })

      it("应该能提取数组元素", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("var_set", "设置JSON", {
            variable_name: "json",
            custom_value: '{"items":["a","b","c"]}',
          } as VarSetConfig, { order_index: 1 }),
          createTestNode("text_extract", "提取", {
            input_variable: "json",
            extract_mode: "json_path",
            json_path: "items[1]",
          } as TextExtractConfig, { order_index: 2 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
        })

        const result = await executor.execute()
        expect(result.output).toBe("b")
      })
    })
  })

  // ========== TextConcat 节点测试 ==========

  describe("TextConcat 节点执行", () => {
    it("应该能拼接多个来源", async () => {
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("var_set", "设置变量1", {
          variable_name: "var1",
          custom_value: "第一部分",
        } as VarSetConfig, { order_index: 1 }),
        createTestNode("var_set", "设置变量2", {
          variable_name: "var2",
          custom_value: "第二部分",
        } as VarSetConfig, { order_index: 2 }),
        createTestNode("text_concat", "拼接", {
          sources: [
            { type: "variable", variable: "var1" },
            { type: "variable", variable: "var2" },
          ],
          separator: "-",
        } as TextConcatConfig, { order_index: 3 }),
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
  })

  // ========== Condition 节点测试 ==========

  describe("Condition 节点执行", () => {
    describe("关键词判断", () => {
      it("any 模式：包含任一关键词时为真", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("var_set", "设置文本", {
            variable_name: "text",
            custom_value: "这是一个测试",
          } as VarSetConfig, { order_index: 1 }),
          createTestNode("condition", "条件判断", {
            input_variable: "text",
            condition_type: "keyword",
            keywords: ["测试", "示例"],
            keyword_mode: "any",
            true_action: "next",
            false_action: "end",
          } as ConditionConfig, { order_index: 2 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
        })

        const result = await executor.execute()
        expect(result.output).toBe("true")
      })

      it("all 模式：包含所有关键词时为真", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("var_set", "设置文本", {
            variable_name: "text",
            custom_value: "这是一个测试示例",
          } as VarSetConfig, { order_index: 1 }),
          createTestNode("condition", "条件判断", {
            input_variable: "text",
            condition_type: "keyword",
            keywords: ["测试", "示例"],
            keyword_mode: "all",
            true_action: "next",
            false_action: "next",
          } as ConditionConfig, { order_index: 2 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
        })

        const result = await executor.execute()
        expect(result.output).toBe("true")
      })

      it("none 模式：不包含任何关键词时为真", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("var_set", "设置文本", {
            variable_name: "text",
            custom_value: "正常的文本",
          } as VarSetConfig, { order_index: 1 }),
          createTestNode("condition", "条件判断", {
            input_variable: "text",
            condition_type: "keyword",
            keywords: ["敏感", "违规"],
            keyword_mode: "none",
            true_action: "next",
            false_action: "next",
          } as ConditionConfig, { order_index: 2 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
        })

        const result = await executor.execute()
        expect(result.output).toBe("true")
      })
    })

    describe("长度判断", () => {
      it("应该正确判断文本长度", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("var_set", "设置文本", {
            variable_name: "text",
            custom_value: "12345",
          } as VarSetConfig, { order_index: 1 }),
          createTestNode("condition", "条件判断", {
            input_variable: "text",
            condition_type: "length",
            length_operator: ">",
            length_value: 3,
            true_action: "next",
            false_action: "next",
          } as ConditionConfig, { order_index: 2 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
        })

        const result = await executor.execute()
        expect(result.output).toBe("true")
      })

      it("应该支持各种比较操作符", async () => {
        // 测试 = 操作符
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("var_set", "设置文本", {
            variable_name: "text",
            custom_value: "12345",
          } as VarSetConfig, { order_index: 1 }),
          createTestNode("condition", "条件判断", {
            input_variable: "text",
            condition_type: "length",
            length_operator: "=",
            length_value: 5,
            true_action: "next",
            false_action: "next",
          } as ConditionConfig, { order_index: 2 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
        })

        const result = await executor.execute()
        expect(result.output).toBe("true")
      })
    })

    describe("正则判断", () => {
      it("应该使用正则表达式判断", async () => {
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("var_set", "设置文本", {
            variable_name: "text",
            custom_value: "邮箱：test@example.com",
          } as VarSetConfig, { order_index: 1 }),
          createTestNode("condition", "条件判断", {
            input_variable: "text",
            condition_type: "regex",
            regex_pattern: "\\w+@\\w+\\.\\w+",
            true_action: "next",
            false_action: "next",
          } as ConditionConfig, { order_index: 2 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
        })

        const result = await executor.execute()
        expect(result.output).toBe("true")
      })
    })

    describe("条件动作", () => {
      it("true_action = end 应该结束工作流", async () => {
        const events: string[] = []
        const nodes = [
          createTestNode("start", "开始", {}, { order_index: 0 }),
          createTestNode("var_set", "设置文本", {
            variable_name: "text",
            custom_value: "包含关键词",
          } as VarSetConfig, { order_index: 1 }),
          createTestNode("condition", "条件判断", {
            input_variable: "text",
            condition_type: "keyword",
            keywords: ["关键词"],
            keyword_mode: "any",
            true_action: "end",
            false_action: "next",
          } as ConditionConfig, { order_index: 2 }),
          createTestNode("var_set", "不应该执行", {
            variable_name: "should_not_run",
            custom_value: "yes",
          } as VarSetConfig, { order_index: 3 }),
        ]
        const executor = new WorkflowExecutor({
          workflow,
          nodes,
          globalConfig,
          onEvent: (e) => events.push(e.type),
        })

        await executor.execute()

        const ctx = executor.getContext()
        expect(ctx.getVariable("should_not_run")).toBeUndefined()
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
        createTestNode("var_set", "计数", {
          variable_name: "counter",
          custom_value: "X",
        } as VarSetConfig, { id: "var-set-1", order_index: 2, block_id: blockId }),
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
        createTestNode("var_get", "获取不存在的变量", {
          variable_name: "nonexistent",
        } as VarGetConfig, { order_index: 1 }),
        createTestNode("var_set", "不应该执行", {
          variable_name: "should_not_run",
          custom_value: "yes",
        } as VarSetConfig, { order_index: 2 }),
      ]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
      })

      const result = await executor.execute()
      
      expect(result.status).toBe("failed")
      expect(result.error).toBeDefined()
      
      const ctx = executor.getContext()
      expect(ctx.getVariable("should_not_run")).toBeUndefined()
    })

    it("应该发送 node_failed 事件", async () => {
      const events: string[] = []
      const nodes = [
        createTestNode("start", "开始", {}, { order_index: 0 }),
        createTestNode("var_get", "获取不存在的变量", {
          variable_name: "nonexistent",
        } as VarGetConfig, { order_index: 1 }),
      ]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
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
        createTestNode("var_set", "设置变量", {
          variable_name: "test",
          custom_value: "value",
        } as VarSetConfig, { order_index: 1 }),
      ]
      const executor = new WorkflowExecutor({
        workflow,
        nodes,
        globalConfig,
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
})

