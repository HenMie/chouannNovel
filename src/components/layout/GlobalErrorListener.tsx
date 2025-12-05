import { useEffect } from 'react'
import { handleUnexpectedError } from '@/lib/errors'

/**
 * 监听全局未捕获错误/Promise 拒绝，统一记录并提示
 */
export function GlobalErrorListener() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!event.reason) return
      handleUnexpectedError(event.reason, '未处理的 Promise 拒绝')
    }

    const handleGlobalError = (event: ErrorEvent) => {
      // 资源加载类错误通常无需提示用户
      if (!event.error && event.message === '' && event.filename) return
      handleUnexpectedError(event.error ?? event.message, '全局错误')
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleGlobalError)

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleGlobalError)
    }
  }, [])

  return null
}

