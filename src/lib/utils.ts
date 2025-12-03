import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { useRef, useCallback, useEffect, useState } from "react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ========== 防抖函数 ==========

/**
 * 创建一个防抖函数
 * @param fn 要执行的函数
 * @param delay 延迟时间(毫秒)
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const debouncedFn = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }

  debouncedFn.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return debouncedFn
}

/**
 * React Hook: 防抖值
 * @param value 输入值
 * @param delay 延迟时间(毫秒)
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

/**
 * React Hook: 防抖回调
 * @param callback 回调函数
 * @param delay 延迟时间(毫秒)
 * @param deps 依赖项
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 在组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [delay, ...deps]
  )
}

// ========== 节流函数 ==========

/**
 * 创建一个节流函数
 * @param fn 要执行的函数
 * @param limit 时间限制(毫秒)
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let lastRun = 0
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const throttledFn = (...args: Parameters<T>) => {
    const now = Date.now()

    if (now - lastRun >= limit) {
      fn(...args)
      lastRun = now
    } else {
      // 确保最后一次调用也会被执行
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        fn(...args)
        lastRun = Date.now()
        timeoutId = null
      }, limit - (now - lastRun))
    }
  }

  throttledFn.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return throttledFn
}

/**
 * React Hook: 节流回调
 * @param callback 回调函数
 * @param limit 时间限制(毫秒)
 * @param deps 依赖项
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  limit: number,
  deps: React.DependencyList = []
): (...args: Parameters<T>) => void {
  const lastRunRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()

      if (now - lastRunRef.current >= limit) {
        callback(...args)
        lastRunRef.current = now
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        timeoutRef.current = setTimeout(() => {
          callback(...args)
          lastRunRef.current = Date.now()
          timeoutRef.current = null
        }, limit - (now - lastRunRef.current))
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [limit, ...deps]
  )
}
