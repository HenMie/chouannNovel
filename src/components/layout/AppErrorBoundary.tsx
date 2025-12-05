import type { ReactNode, ErrorInfo } from 'react'
import { Component } from 'react'
import { AlertTriangle, RefreshCw, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { TypographyMuted } from '@/components/ui/typography'
import { getErrorMessage, logError } from '@/lib/errors'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
  error?: Error
}

/**
 * 捕获渲染阶段的异常，避免白屏，并提供用户可见的降级页面
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    error: undefined,
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError({
      error,
      context: '渲染错误',
      payload: { componentStack: info.componentStack },
    })
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-muted/20 px-4">
          <Card className="w-full max-w-xl shadow-lg">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <CardTitle>页面出现问题</CardTitle>
                <TypographyMuted>错误已记录，请尝试重试或刷新应用</TypographyMuted>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                {getErrorMessage(this.state.error)}
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-3">
              <Button variant="outline" onClick={this.handleReload} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                刷新应用
              </Button>
              <Button onClick={this.handleReset} className="gap-2">
                <RotateCw className="h-4 w-4" />
                重试
              </Button>
            </CardFooter>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

