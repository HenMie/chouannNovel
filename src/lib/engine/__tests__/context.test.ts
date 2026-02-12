// lib/engine/context.ts 执行上下文测试

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { ExecutionContext } from "../context"
import type { WorkflowNode } from "@/types"

describe("ExecutionContext - 执行上下文", () => {
  let ctx: ExecutionContext

  beforeEach(() => {
    ctx = new ExecutionContext()
  })

  // ========== 变量操作测试 ==========

  describe("变量操作", () => {
    it("应该能设置和获取变量", () => {
      ctx.setVariable("name", "张三")
      expect(ctx.getVariable("name")).toBe("张三")
    })

    it("应该返回 undefined 当变量不存在时", () => {
      expect(ctx.getVariable("nonexistent")).toBeUndefined()
    })

    it("应该能获取所有变量", () => {
      ctx.setVariable("a", "1")
      ctx.setVariable("b", "2")
      
      const vars = ctx.getAllVariables()
      expect(vars).toEqual({ a: "1", b: "2" })
    })

    it("应该能覆盖已存在的变量", () => {
      ctx.setVariable("key", "old")
      ctx.setVariable("key", "new")
      expect(ctx.getVariable("key")).toBe("new")
    })
  })

  // ========== 初始输入测试 ==========

  describe("初始输入处理", () => {
    it("应该正确保存初始输入", () => {
      const ctx = new ExecutionContext({ initialInput: "用户的问题" })
      expect(ctx.getInitialInput()).toBe("用户的问题")
    })

    it("应该将初始输入保存为 '用户问题' 变量", () => {
      const ctx = new ExecutionContext({ initialInput: "测试输入" })
      expect(ctx.getVariable("用户问题")).toBe("测试输入")
    })

    it("没有初始输入时应该返回空字符串", () => {
      const ctx = new ExecutionContext()
      expect(ctx.getInitialInput()).toBe("")
    })
  })

  // ========== 变量插值测试 ==========

  describe("变量插值", () => {
    it("应该替换 {{变量名}} 格式", () => {
      ctx.setVariable("name", "张三")
      const result = ctx.interpolate("你好，{{name}}！")
      expect(result).toBe("你好，张三！")
    })

    it("应该处理多个变量", () => {
      ctx.setVariable("name", "张三")
      ctx.setVariable("age", "25")
      const result = ctx.interpolate("{{name}} 今年 {{age}} 岁")
      expect(result).toBe("张三 今年 25 岁")
    })

    it("应该使用 @nodeId 格式引用节点输出", () => {
      ctx.setNodeOutput("节点输出值", "node-123")
      
      const result = ctx.interpolate("结果：{{@node-123 > 输出描述}}")
      expect(result).toBe("结果：节点输出值")
    })

    it("应该处理 '@nodeId > 输出描述' 格式", () => {
      ctx.setNodeOutput("AI 回复内容", "ai-node-456")
      const result = ctx.interpolate("{{@ai-node-456 > AI回复}}")
      expect(result).toBe("AI 回复内容")
    })
    
    it("@nodeId 格式应该忽略 > 后面的描述部分", () => {
      ctx.setNodeOutput("实际输出", "my-node")
      const result = ctx.interpolate("{{@my-node > 任意描述}}")
      expect(result).toBe("实际输出")
    })

    it("未定义的变量应该保留原始占位符", () => {
      const result = ctx.interpolate("值：{{unknown}}")
      expect(result).toBe("值：{{unknown}}")
    })

    it("应该处理变量名前后的空格", () => {
      ctx.setVariable("name", "张三")
      const result = ctx.interpolate("{{ name }}")
      expect(result).toBe("张三")
    })
  })

  // ========== 对话历史测试 ==========

  describe("对话历史", () => {
    it("应该能添加消息到对话历史", () => {
      ctx.addToHistory("node1", { role: "user", content: "你好" })
      ctx.addToHistory("node1", { role: "assistant", content: "你好！" })

      const history = ctx.getHistory("node1")
      expect(history).toHaveLength(2)
      expect(history[0]).toEqual({ role: "user", content: "你好" })
      expect(history[1]).toEqual({ role: "assistant", content: "你好！" })
    })

    it("不同节点应该有独立的对话历史", () => {
      ctx.addToHistory("node1", { role: "user", content: "消息1" })
      ctx.addToHistory("node2", { role: "user", content: "消息2" })

      expect(ctx.getHistory("node1")).toHaveLength(1)
      expect(ctx.getHistory("node2")).toHaveLength(1)
      expect(ctx.getHistory("node1")[0].content).toBe("消息1")
      expect(ctx.getHistory("node2")[0].content).toBe("消息2")
    })

    it("应该支持 limit 限制返回数量", () => {
      for (let i = 0; i < 5; i++) {
        ctx.addToHistory("node1", { role: "user", content: `消息${i}` })
      }

      const history = ctx.getHistory("node1", 2)
      expect(history).toHaveLength(2)
      expect(history[0].content).toBe("消息3") // 返回最后 2 条
      expect(history[1].content).toBe("消息4")
    })

    it("应该能清空节点的对话历史", () => {
      ctx.addToHistory("node1", { role: "user", content: "消息" })
      ctx.clearHistory("node1")
      
      expect(ctx.getHistory("node1")).toHaveLength(0)
    })

    it("获取不存在节点的历史应该返回空数组", () => {
      expect(ctx.getHistory("nonexistent")).toEqual([])
    })
  })

  // ========== 节点输出测试 ==========

  describe("节点输出", () => {
    it("应该能设置和获取节点输出（使用节点ID）", () => {
      ctx.setNodeOutput("输出内容", "node-1")
      expect(ctx.getNodeOutput("node-1")).toBe("输出内容")
    })

    it("应该更新最后输出", () => {
      ctx.setNodeOutput("第一个输出", "node-1")
      ctx.setNodeOutput("第二个输出", "node-2")
      
      expect(ctx.getLastOutput()).toBe("第二个输出")
    })

    it("应该能手动设置最后输出", () => {
      ctx.setLastOutput("手动设置的输出")
      expect(ctx.getLastOutput()).toBe("手动设置的输出")
    })

    it("应该能获取所有节点输出", () => {
      ctx.setNodeOutput("输出1", "node-1")
      ctx.setNodeOutput("输出2", "node-2")
      
      const outputs = ctx.getAllNodeOutputs()
      expect(outputs).toEqual({
        "node-1": "输出1",
        "node-2": "输出2",
      })
    })
  })

  // ========== 循环控制测试 ==========

  describe("循环控制", () => {
    it("应该能增加循环计数", () => {
      expect(ctx.getLoopCount("loop1")).toBe(0)
      
      ctx.incrementLoopCount("loop1")
      expect(ctx.getLoopCount("loop1")).toBe(1)
      
      ctx.incrementLoopCount("loop1")
      expect(ctx.getLoopCount("loop1")).toBe(2)
    })

    it("应该返回新的计数值", () => {
      const count = ctx.incrementLoopCount("loop1")
      expect(count).toBe(1)
    })

    it("应该能重置循环计数", () => {
      ctx.incrementLoopCount("loop1")
      ctx.incrementLoopCount("loop1")
      ctx.resetLoopCount("loop1")
      
      expect(ctx.getLoopCount("loop1")).toBe(0)
    })

    it("应该能检测是否达到循环限制", () => {
      const ctx = new ExecutionContext({ maxLoopCount: 3 })
      
      expect(ctx.isLoopLimitReached("loop1")).toBe(false)
      
      ctx.incrementLoopCount("loop1")
      ctx.incrementLoopCount("loop1")
      expect(ctx.isLoopLimitReached("loop1")).toBe(false)
      
      ctx.incrementLoopCount("loop1")
      expect(ctx.isLoopLimitReached("loop1")).toBe(true)
    })

    it("不同循环应该有独立的计数", () => {
      ctx.incrementLoopCount("loop1")
      ctx.incrementLoopCount("loop1")
      ctx.incrementLoopCount("loop2")
      
      expect(ctx.getLoopCount("loop1")).toBe(2)
      expect(ctx.getLoopCount("loop2")).toBe(1)
    })
  })

  // ========== 超时检测测试 ==========

  describe("超时检测", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("开始时不应该超时", () => {
      const ctx = new ExecutionContext({ timeoutSeconds: 60 })
      expect(ctx.isTimeout()).toBe(false)
    })

    it("超过时间限制后应该检测到超时", () => {
      const ctx = new ExecutionContext({ timeoutSeconds: 10 })
      
      vi.advanceTimersByTime(11 * 1000) // 11 秒
      expect(ctx.isTimeout()).toBe(true)
    })

    it("应该正确计算已用时间", () => {
      const ctx = new ExecutionContext()
      
      vi.advanceTimersByTime(5000) // 5 秒
      expect(ctx.getElapsedSeconds()).toBeCloseTo(5, 0)
    })
  })

  // ========== 节点状态测试 ==========

  describe("节点状态", () => {
    const createTestNode = (id: string, name: string): WorkflowNode => ({
      id,
      workflow_id: "workflow1",
      type: "ai_chat",
      name,
      config: {},
      order_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    it("应该能初始化节点状态", () => {
      const node = createTestNode("node1", "测试节点")
      ctx.initNodeState(node)
      
      const state = ctx.getNodeState("node1")
      expect(state).toBeDefined()
      expect(state?.status).toBe("pending")
      expect(state?.nodeName).toBe("测试节点")
      expect(state?.nodeType).toBe("ai_chat")
    })

    it("应该能更新节点状态", () => {
      const node = createTestNode("node1", "测试节点")
      ctx.initNodeState(node)
      
      ctx.updateNodeState("node1", {
        status: "running",
        startedAt: new Date(),
      })
      
      const state = ctx.getNodeState("node1")
      expect(state?.status).toBe("running")
    })

    it("应该能获取所有节点状态", () => {
      ctx.initNodeState(createTestNode("node1", "节点1"))
      ctx.initNodeState(createTestNode("node2", "节点2"))
      
      const states = ctx.getAllNodeStates()
      expect(states).toHaveLength(2)
    })

    it("更新不存在的节点应该不产生错误", () => {
      // 不应该抛出错误
      ctx.updateNodeState("nonexistent", { status: "running" })
      expect(ctx.getNodeState("nonexistent")).toBeUndefined()
    })
  })

  // ========== 节点输入获取测试 ==========

  describe("节点输入获取", () => {
    it("应该从 input_variable 指定的变量获取输入", () => {
      ctx.setVariable("myVar", "变量值")
      
      const node: WorkflowNode = {
        id: "node1",
        workflow_id: "w1",
        type: "text_extract",
        name: "提取节点",
        config: { input_variable: "myVar" },
        order_index: 0,
        created_at: "",
        updated_at: "",
      }
      
      expect(ctx.getNodeInput(node)).toBe("变量值")
    })

    it("应该使用 @nodeId 格式从节点输出获取输入", () => {
      ctx.setNodeOutput("节点输出值", "source-node-id")
      
      const node: WorkflowNode = {
        id: "node1",
        workflow_id: "w1",
        type: "text_extract",
        name: "提取节点",
        config: { input_variable: "@source-node-id" },  // 使用 @nodeId 格式
        order_index: 0,
        created_at: "",
        updated_at: "",
      }
      
      expect(ctx.getNodeInput(node)).toBe("节点输出值")
    })

    it("应该对 custom_input 进行插值", () => {
      ctx.setVariable("name", "张三")
      
      const node: WorkflowNode = {
        id: "node1",
        workflow_id: "w1",
        type: "output",
        name: "输出节点",
        config: { custom_input: "你好，{{name}}！" },
        order_index: 0,
        created_at: "",
        updated_at: "",
      }
      
      expect(ctx.getNodeInput(node)).toBe("你好，张三！")
    })

    it("没有配置时应该返回空字符串", () => {
      const node: WorkflowNode = {
        id: "node1",
        workflow_id: "w1",
        type: "text_extract",
        name: "提取节点",
        config: {},
        order_index: 0,
        created_at: "",
        updated_at: "",
      }
      
      expect(ctx.getNodeInput(node)).toBe("")
    })
  })

  // ========== 快照和恢复测试 ==========

  describe("快照和恢复", () => {
    it("应该能创建快照", () => {
      ctx.setVariable("name", "张三")
      ctx.setNodeOutput("输出内容", "node-1")
      ctx.setLastOutput("最终输出")
      ctx.incrementLoopCount("loop1")
      
      const snapshot = ctx.createSnapshot()
      
      expect(snapshot.variables).toEqual({ name: "张三" })
      expect(snapshot.nodeOutputs).toEqual({ "node-1": "输出内容" })
      expect(snapshot.lastOutput).toBe("最终输出")
      expect(snapshot.loopCounters).toEqual({ loop1: 1 })
    })

    it("应该能从快照恢复", () => {
      const snapshot = {
        variables: { name: "李四", age: "30" },
        nodeOutputs: { "node-1": "恢复的输出" },
        lastOutput: "恢复的最终输出",
        initialInput: "初始输入",
        loopCounters: { loop1: 2 },
      }
      
      const restoredCtx = ExecutionContext.fromSnapshot(snapshot)
      
      expect(restoredCtx.getVariable("name")).toBe("李四")
      expect(restoredCtx.getVariable("age")).toBe("30")
      expect(restoredCtx.getNodeOutput("node-1")).toBe("恢复的输出")
      expect(restoredCtx.getLastOutput()).toBe("恢复的最终输出")
      expect(restoredCtx.getInitialInput()).toBe("初始输入")
      expect(restoredCtx.getLoopCount("loop1")).toBe(2)
    })

    it("应该能处理空快照", () => {
      const snapshot = {
        variables: {},
        nodeOutputs: {},
        lastOutput: "",
        initialInput: "",
        loopCounters: {},
      }
      
      const restoredCtx = ExecutionContext.fromSnapshot(snapshot)
      expect(restoredCtx.getLastOutput()).toBe("")
    })
  })

  describe("严格变量插值", () => {
    it("interpolateStrict 应在变量存在时正常替换", () => {
      ctx.setVariable("name", "张三")
      const result = ctx.interpolateStrict("你好，{{name}}")
      expect(result).toBe("你好，张三")
    })

    it("interpolateStrict 应在变量未定义时抛错", () => {
      expect(() => ctx.interpolateStrict("你好，{{unknown}}")).toThrow("变量未定义")
    })
  })
})
