import { toast } from 'sonner'

interface LogErrorOptions {
  error: unknown
  context?: string
  payload?: Record<string, unknown>
}

interface HandleErrorOptions extends LogErrorOptions {
  fallbackMessage?: string
  toastMessage?: string
  silent?: boolean
}

/**
 * 提取错误信息，统一兜底
 */
export function getErrorMessage(error: unknown, fallback = '未知错误'): string {
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message || fallback

  if (typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
      return maybeMessage
    }
  }

  try {
    return JSON.stringify(error)
  } catch {
    return fallback
  }
}

/**
 * 记录错误日志（保留原始 error 方便后续接入日志系统）
 */
export function logError({ error, context, payload }: LogErrorOptions): string {
  const message = getErrorMessage(error)
  const prefix = context ? `[${context}]` : '[错误]'

  if (payload) {
    console.error(prefix, message, payload, error)
  } else {
    console.error(prefix, message, error)
  }

  return message
}

/**
 * 统一错误处理：记录 + 友好提示
 */
export function handleAppError({
  error,
  context,
  payload,
  fallbackMessage = '操作失败，请稍后重试',
  toastMessage,
  silent,
}: HandleErrorOptions): string {
  const message = logError({ error, context, payload }) || fallbackMessage

  if (!silent) {
    toast.error(toastMessage ?? message ?? fallbackMessage)
  }

  return message ?? fallbackMessage
}

/**
 * 全局未捕获错误处理（用于监听 error/unhandledrejection）
 */
export function handleUnexpectedError(error: unknown, context = '未捕获异常') {
  return handleAppError({
    error,
    context,
    toastMessage: '应用出现异常，已记录，请尝试重试或反馈问题',
  })
}

