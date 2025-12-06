// tour-store.ts 测试
// 覆盖引导启动/停止、步骤切换、完成状态与持久化

import { describe, it, expect, beforeEach, vi } from "vitest"

describe("TourStore", () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  async function loadStore() {
    return await import("../tour-store")
  }

  it("startTour/stopTour 应该正确切换运行状态", async () => {
    const { useTourStore } = await loadStore()

    useTourStore.getState().startTour("home")

    expect(useTourStore.getState().activeTour).toBe("home")
    expect(useTourStore.getState().currentStepIndex).toBe(0)
    expect(useTourStore.getState().isRunning).toBe(true)

    useTourStore.getState().stopTour()

    expect(useTourStore.getState().activeTour).toBeNull()
    expect(useTourStore.getState().currentStepIndex).toBe(0)
    expect(useTourStore.getState().isRunning).toBe(false)
  })

  it("步骤跳转应该递增并防止越界", async () => {
    const { useTourStore } = await loadStore()
    useTourStore.getState().startTour("workflow")

    useTourStore.getState().nextStep()
    useTourStore.getState().nextStep()
    expect(useTourStore.getState().currentStepIndex).toBe(2)

    useTourStore.getState().prevStep()
    expect(useTourStore.getState().currentStepIndex).toBe(1)

    useTourStore.getState().prevStep()
    useTourStore.getState().prevStep() // 不应小于 0
    expect(useTourStore.getState().currentStepIndex).toBe(0)

    useTourStore.getState().goToStep(5)
    expect(useTourStore.getState().currentStepIndex).toBe(5)

    useTourStore.getState().goToStep(-3)
    expect(useTourStore.getState().currentStepIndex).toBe(0)
  })

  it("skipTour 应该标记完成并重置运行态", async () => {
    const { useTourStore } = await loadStore()
    useTourStore.getState().startTour("settings")

    useTourStore.getState().skipTour()

    expect(useTourStore.getState().completedTours.settings).toBe(true)
    expect(useTourStore.getState().activeTour).toBeNull()
    expect(useTourStore.getState().currentStepIndex).toBe(0)
    expect(useTourStore.getState().isRunning).toBe(false)
  })

  it("completeTour 应该写入完成记录并清理状态", async () => {
    const { useTourStore } = await loadStore()
    useTourStore.getState().startTour("ai_config")

    useTourStore.getState().completeTour()

    expect(useTourStore.getState().completedTours.ai_config).toBe(true)
    expect(useTourStore.getState().activeTour).toBeNull()
    expect(useTourStore.getState().currentStepIndex).toBe(0)
    expect(useTourStore.getState().isRunning).toBe(false)
  })

  it("isTourCompleted 与 resetTour 应该正确反映完成状态", async () => {
    const { useTourStore } = await loadStore()
    useTourStore.setState({
      completedTours: { home: true },
    })

    expect(useTourStore.getState().isTourCompleted("home")).toBe(true)
    expect(useTourStore.getState().isTourCompleted("workflow")).toBe(false)

    useTourStore.getState().resetTour("home")
    expect(useTourStore.getState().isTourCompleted("home")).toBe(false)
  })

  it("resetAllTours 应该清空完成记录并重置运行态", async () => {
    const { useTourStore } = await loadStore()
    useTourStore.setState({
      completedTours: { workflow: true },
      activeTour: "workflow",
      currentStepIndex: 3,
      isRunning: true,
    })

    useTourStore.getState().resetAllTours()

    expect(useTourStore.getState().completedTours).toEqual({})
    expect(useTourStore.getState().activeTour).toBeNull()
    expect(useTourStore.getState().currentStepIndex).toBe(0)
    expect(useTourStore.getState().isRunning).toBe(false)
  })

  it("持久化时只应写入 completedTours", async () => {
    const { useTourStore } = await loadStore()
    useTourStore.setState({
      completedTours: { home: true },
      activeTour: "home",
      currentStepIndex: 2,
      isRunning: true,
    })

    const stored = localStorage.getItem("chouann-tour")
    expect(stored).toBeTruthy()

    const parsed = JSON.parse(stored as string)
    expect(parsed.state).toEqual({ completedTours: { home: true } })
    expect(parsed.state.activeTour).toBeUndefined()
    expect(parsed.state.isRunning).toBeUndefined()
  })

  it("shouldAutoStartTour 应基于完成与运行状态返回结果", async () => {
    const { useTourStore, shouldAutoStartTour } = await loadStore()

    // 未完成且未运行 -> 应该自动开始
    expect(shouldAutoStartTour("home")).toBe(true)

    // 标记为完成后 -> 不应自动开始
    useTourStore.setState({ completedTours: { home: true } })
    expect(shouldAutoStartTour("home")).toBe(false)

    // 运行中时也不应自动开始
    useTourStore.setState({
      completedTours: {},
      isRunning: true,
    })
    expect(shouldAutoStartTour("home")).toBe(false)
  })

  it("skipTour 在没有 activeTour 时不应修改状态", async () => {
    const { useTourStore } = await loadStore()
    
    // 设置初始状态（没有 activeTour）
    useTourStore.setState({
      completedTours: {},
      activeTour: null,
      isRunning: false,
    })
    const originalState = useTourStore.getState().completedTours

    useTourStore.getState().skipTour()

    // completedTours 不应该改变
    expect(useTourStore.getState().completedTours).toEqual(originalState)
  })

  it("completeTour 在没有 activeTour 时不应修改状态", async () => {
    const { useTourStore } = await loadStore()
    
    // 设置初始状态（没有 activeTour）
    useTourStore.setState({
      completedTours: {},
      activeTour: null,
      isRunning: false,
    })
    const originalState = useTourStore.getState().completedTours

    useTourStore.getState().completeTour()

    // completedTours 不应该改变
    expect(useTourStore.getState().completedTours).toEqual(originalState)
  })

  it("goToStep 应该允许设置任意正数索引", async () => {
    const { useTourStore } = await loadStore()
    useTourStore.getState().startTour("home")

    useTourStore.getState().goToStep(100)
    expect(useTourStore.getState().currentStepIndex).toBe(100)

    useTourStore.getState().goToStep(0)
    expect(useTourStore.getState().currentStepIndex).toBe(0)
  })

  it("nextStep 应该无限制递增", async () => {
    const { useTourStore } = await loadStore()
    useTourStore.getState().startTour("workflow")

    // 多次递增
    for (let i = 0; i < 10; i++) {
      useTourStore.getState().nextStep()
    }
    expect(useTourStore.getState().currentStepIndex).toBe(10)
  })

  it("resetTour 应该只重置指定模块的完成状态", async () => {
    const { useTourStore } = await loadStore()
    useTourStore.setState({
      completedTours: { home: true, workflow: true, settings: true },
    })

    useTourStore.getState().resetTour("workflow")

    expect(useTourStore.getState().completedTours.home).toBe(true)
    expect(useTourStore.getState().completedTours.workflow).toBeUndefined()
    expect(useTourStore.getState().completedTours.settings).toBe(true)
  })

  it("isTourCompleted 应该正确区分不同模块", async () => {
    const { useTourStore } = await loadStore()
    useTourStore.setState({
      completedTours: { home: true, workflow: false },
    })

    expect(useTourStore.getState().isTourCompleted("home")).toBe(true)
    expect(useTourStore.getState().isTourCompleted("workflow")).toBe(false)
    expect(useTourStore.getState().isTourCompleted("settings")).toBe(false)
    expect(useTourStore.getState().isTourCompleted("ai_config")).toBe(false)
  })
})


