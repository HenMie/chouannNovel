// Tour 主组件
// 整合 Spotlight 和 Tooltip，提供完整的交互式引导体验

import { useEffect, useState, useCallback, useRef } from 'react'
import { TourSpotlight } from './TourSpotlight'
import { TourTooltip } from './TourTooltip'
import { useTourStore, type TourStep, type TourModule } from '@/stores/tour-store'
import { useHotkey } from '@/lib/hooks'

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

interface TourProps {
  // Tour 模块 ID
  module: TourModule
  // Tour 步骤配置
  steps: TourStep[]
  // 是否自动开始（首次访问时）
  autoStart?: boolean
  // 开始前的延迟（毫秒）
  startDelay?: number
  // 完成回调
  onComplete?: () => void
  // 跳过回调
  onSkip?: () => void
}

// 获取目标元素的位置和尺寸
function getTargetRect(target: string): TargetRect | null {
  // 支持 data-tour 属性或 CSS 选择器
  let element = document.querySelector(`[data-tour="${target}"]`)
  
  if (!element) {
    element = document.querySelector(target)
  }
  
  if (!element) {
    return null
  }

  const rect = element.getBoundingClientRect()
  return {
    // 使用 viewport 坐标，避免滚动时偏移错误
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  }
}

// 滚动到目标元素
function scrollToTarget(target: string) {
  let element = document.querySelector(`[data-tour="${target}"]`)
  
  if (!element) {
    element = document.querySelector(target)
  }
  
  if (element) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }
}

export function Tour({
  module,
  steps,
  autoStart = true,
  startDelay = 500,
  onComplete,
  onSkip,
}: TourProps) {
  const {
    activeTour,
    currentStepIndex,
    isRunning,
    startTour,
    stopTour,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    isTourCompleted,
  } = useTourStore()

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const startTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 当前是否是这个模块的 Tour
  const isActive = activeTour === module && isRunning
  const currentStep = isActive ? steps[currentStepIndex] : null
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === steps.length - 1

  // 自动开始 Tour
  useEffect(() => {
    if (autoStart && !isTourCompleted(module) && !isRunning) {
      startTimeoutRef.current = setTimeout(() => {
        startTour(module)
      }, startDelay)
    }

    return () => {
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current)
      }
    }
  }, [autoStart, module, isTourCompleted, isRunning, startTour, startDelay])

  // 更新目标元素位置
  const updateTargetRect = useCallback(() => {
    if (currentStep) {
      const rect = getTargetRect(currentStep.target)
      setTargetRect(rect)
    }
  }, [currentStep])

  // 当步骤变化时更新位置和滚动
  useEffect(() => {
    if (isActive && currentStep) {
      // 先滚动到目标元素
      scrollToTarget(currentStep.target)
      
      // 延迟一下再更新位置，等待滚动完成
      setTimeout(() => {
        updateTargetRect()
        setIsVisible(true)
      }, 300)

      // 设置定时器持续更新位置（处理动态内容）
      updateIntervalRef.current = setInterval(updateTargetRect, 500)
    } else {
      setIsVisible(false)
      setTargetRect(null)
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
    }
  }, [isActive, currentStep, currentStepIndex, updateTargetRect])

  // 监听窗口大小变化和滚动
  useEffect(() => {
    if (isActive) {
      window.addEventListener('resize', updateTargetRect)
      window.addEventListener('scroll', updateTargetRect, true)
      return () => {
        window.removeEventListener('resize', updateTargetRect)
        window.removeEventListener('scroll', updateTargetRect, true)
      }
    }
  }, [isActive, updateTargetRect])

  // 处理下一步
  const handleNext = useCallback(() => {
    if (isLastStep) {
      completeTour()
      onComplete?.()
    } else {
      nextStep()
    }
  }, [isLastStep, completeTour, nextStep, onComplete])

  // 处理跳过
  const handleSkip = useCallback(() => {
    skipTour()
    onSkip?.()
  }, [skipTour, onSkip])

  // 处理关闭
  const handleClose = useCallback(() => {
    stopTour()
  }, [stopTour])

  // Escape 键关闭
  useHotkey({
    key: 'Escape',
    handler: handleClose,
    enabled: isActive,
  })

  // 如果不是当前模块的 Tour，不渲染任何内容
  if (!isActive || !currentStep) {
    return null
  }

  return (
    <>
      <TourSpotlight
        targetRect={targetRect}
        padding={currentStep.spotlightPadding ?? 8}
        visible={isVisible}
        onOverlayClick={handleClose}
        allowTargetInteraction={currentStep.allowTargetInteraction}
      />
      <TourTooltip
        targetRect={targetRect}
        title={currentStep.title}
        content={currentStep.content}
        currentStep={currentStepIndex}
        totalSteps={steps.length}
        placement={currentStep.placement ?? 'bottom'}
        visible={isVisible}
        onNext={handleNext}
        onPrev={prevStep}
        onSkip={handleSkip}
        onClose={handleClose}
        nextButtonText={currentStep.nextButtonText}
        prevButtonText={currentStep.prevButtonText}
        showSkip={currentStep.showSkip ?? true}
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
      />
    </>
  )
}

// 导出便捷 Hook：用于手动控制 Tour
export function useTour(module: TourModule) {
  const {
    startTour,
    stopTour,
    resetTour,
    isTourCompleted,
    isRunning,
    activeTour,
  } = useTourStore()

  return {
    // 开始 Tour
    start: () => startTour(module),
    // 停止 Tour
    stop: stopTour,
    // 重置 Tour（允许重新开始）
    reset: () => resetTour(module),
    // 是否已完成
    isCompleted: isTourCompleted(module),
    // 是否正在运行
    isActive: isRunning && activeTour === module,
  }
}

