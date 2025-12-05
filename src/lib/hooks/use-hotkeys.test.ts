import { act, renderHook } from "@testing-library/react"
import { useHotkey, useHotkeys, HOTKEY_PRESETS } from "./use-hotkeys"
import { vi } from "vitest"

// 统一派发键盘事件，方便校验 defaultPrevented
const dispatchKeyEvent = (
  target: EventTarget,
  options: KeyboardEventInit & { key: string },
) => {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...options,
  })
  target.dispatchEvent(event)
  return event
}

const createInput = () => {
  const input = document.createElement("input")
  document.body.appendChild(input)
  return input
}

describe("useHotkey", () => {
  it("匹配组合键时触发并阻止默认行为", () => {
    const handler = vi.fn()
    const { unmount } = renderHook(() =>
      useHotkey({ key: "s", ctrl: true, handler }),
    )

    const event = dispatchKeyEvent(window, { key: "s", ctrlKey: true })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
    unmount()
  })

  it("禁用时不触发快捷键", () => {
    const handler = vi.fn()
    const { unmount } = renderHook(() =>
      useHotkey({ key: "s", ctrl: true, handler, enabled: false }),
    )

    const event = dispatchKeyEvent(window, { key: "s", ctrlKey: true })

    expect(handler).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
    unmount()
  })

  it("输入框中的非 Escape 快捷键在无修饰键时被忽略", () => {
    const handler = vi.fn()
    const input = createInput()
    const { unmount } = renderHook(() => useHotkey({ key: "a", handler }))

    dispatchKeyEvent(input, { key: "a" })

    expect(handler).not.toHaveBeenCalled()
    unmount()
    input.remove()
  })

  it("输入框中的组合键在按下修饰键时可以触发", () => {
    const handler = vi.fn()
    const input = createInput()
    const { unmount } = renderHook(() =>
      useHotkey({ key: "s", ctrl: true, handler }),
    )

    const event = dispatchKeyEvent(input, { key: "s", ctrlKey: true })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
    unmount()
    input.remove()
  })

  it("输入框中的 Escape 始终触发", () => {
    const handler = vi.fn()
    const input = createInput()
    const { unmount } = renderHook(() =>
      useHotkey({ key: "Escape", handler }),
    )

    dispatchKeyEvent(input, { key: "Escape" })

    expect(handler).toHaveBeenCalledTimes(1)
    unmount()
    input.remove()
  })

  it("修饰键不匹配时不触发，匹配全部修饰键时触发", () => {
    const handler = vi.fn()
    const { unmount } = renderHook(() =>
      useHotkeys([
        {
          key: "k",
          ctrl: true,
          shift: true,
          alt: true,
          meta: false,
          handler,
        },
      ]),
    )

    act(() => {
      dispatchKeyEvent(window, { key: "k", ctrlKey: true, shiftKey: true })
    })
    expect(handler).not.toHaveBeenCalled()

    act(() => {
      dispatchKeyEvent(window, {
        key: "k",
        ctrlKey: true,
        shiftKey: true,
        altKey: true,
      })
    })
    expect(handler).toHaveBeenCalledTimes(1)
    unmount()
  })
})

describe("useHotkeys", () => {
  it("匹配到第一个快捷键后会停止遍历", () => {
    const first = vi.fn()
    const second = vi.fn()
    const { unmount } = renderHook(() =>
      useHotkeys([
        { key: "s", ctrl: true, handler: first },
        { key: "s", ctrl: true, handler: second },
      ]),
    )

    const event = dispatchKeyEvent(window, { key: "s", ctrlKey: true })

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
    unmount()
  })

  it("preventDefault 为 false 时不会阻止默认行为", () => {
    const handler = vi.fn()
    const { unmount } = renderHook(() =>
      useHotkeys([{ key: "n", handler, preventDefault: false }]),
    )

    const event = dispatchKeyEvent(window, { key: "n" })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(false)
    unmount()
  })
})

describe("HOTKEY_PRESETS", () => {
  it("各预设返回的配置符合约定", () => {
    const handler = vi.fn()

    expect(HOTKEY_PRESETS.save(handler)).toMatchObject({
      key: "s",
      ctrl: true,
      handler,
      enabled: true,
    })

    expect(HOTKEY_PRESETS.run(handler, false)).toMatchObject({
      key: "Enter",
      ctrl: true,
      handler,
      enabled: false,
    })

    expect(HOTKEY_PRESETS.togglePause(handler)).toMatchObject({
      key: " ",
      handler,
      enabled: true,
      preventDefault: true,
    })

    expect(HOTKEY_PRESETS.escape(handler)).toMatchObject({
      key: "Escape",
      handler,
      enabled: true,
    })

    expect(HOTKEY_PRESETS.new(handler)).toMatchObject({
      key: "n",
      ctrl: true,
      handler,
      enabled: true,
    })

    expect(HOTKEY_PRESETS.copy(handler)).toMatchObject({
      key: "c",
      ctrl: true,
      handler,
      enabled: true,
    })

    expect(HOTKEY_PRESETS.paste(handler, false)).toMatchObject({
      key: "v",
      ctrl: true,
      handler,
      enabled: false,
    })
  })
})

