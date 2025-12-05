// Tour 步骤提示气泡组件
// 显示当前步骤的标题、描述和导航按钮

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Placement = 'top' | 'bottom' | 'left' | 'right'

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

interface TourTooltipProps {
  // 目标元素的位置和尺寸
  targetRect: TargetRect | null
  // 步骤标题
  title: string
  // 步骤描述
  content: string
  // 当前步骤 / 总步骤
  currentStep: number
  totalSteps: number
  // Tooltip 位置
  placement?: Placement
  // 是否显示
  visible: boolean
  // 导航回调
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  onClose: () => void
  // 自定义按钮文本
  nextButtonText?: string
  prevButtonText?: string
  // 是否显示跳过按钮
  showSkip?: boolean
  // 是否是最后一步
  isLastStep?: boolean
  // 是否是第一步
  isFirstStep?: boolean
}

interface PositionResult {
  top: number
  left: number
  actualPlacement: Placement
  arrowOffset: number // 箭头偏移量（相对于中心）
}

// 计算 Tooltip 位置
function calculatePosition(
  targetRect: TargetRect,
  placement: Placement,
  tooltipWidth: number,
  tooltipHeight: number
): PositionResult {
  const gap = 12 // 与目标元素的间距
  const margin = 12 // 距离窗口边缘的最小间距
  const arrowSize = 12 // 箭头大小
  const { innerWidth: windowWidth, innerHeight: windowHeight } = window

  let top = 0
  let left = 0
  let actualPlacement = placement
  let arrowOffset = 0

  // 计算各个方向的可用空间
  const spaceTop = targetRect.top
  const spaceBottom = windowHeight - targetRect.top - targetRect.height
  const spaceLeft = targetRect.left
  const spaceRight = windowWidth - targetRect.left - targetRect.width

  // 目标元素中心点
  const targetCenterX = targetRect.left + targetRect.width / 2
  const targetCenterY = targetRect.top + targetRect.height / 2

  // 根据 placement 计算位置，如果空间不够则自动调整
  switch (placement) {
    case 'top':
      if (spaceTop >= tooltipHeight + gap) {
        top = targetRect.top - tooltipHeight - gap
        left = targetCenterX - tooltipWidth / 2
        actualPlacement = 'top'
      } else if (spaceBottom >= tooltipHeight + gap) {
        top = targetRect.top + targetRect.height + gap
        left = targetCenterX - tooltipWidth / 2
        actualPlacement = 'bottom'
      } else {
        // 放右边或左边
        top = targetCenterY - tooltipHeight / 2
        if (spaceRight >= tooltipWidth + gap) {
          left = targetRect.left + targetRect.width + gap
          actualPlacement = 'right'
        } else {
          left = targetRect.left - tooltipWidth - gap
          actualPlacement = 'left'
        }
      }
      break

    case 'bottom':
      if (spaceBottom >= tooltipHeight + gap) {
        top = targetRect.top + targetRect.height + gap
        left = targetCenterX - tooltipWidth / 2
        actualPlacement = 'bottom'
      } else if (spaceTop >= tooltipHeight + gap) {
        top = targetRect.top - tooltipHeight - gap
        left = targetCenterX - tooltipWidth / 2
        actualPlacement = 'top'
      } else {
        top = targetCenterY - tooltipHeight / 2
        if (spaceRight >= tooltipWidth + gap) {
          left = targetRect.left + targetRect.width + gap
          actualPlacement = 'right'
        } else {
          left = targetRect.left - tooltipWidth - gap
          actualPlacement = 'left'
        }
      }
      break

    case 'left':
      if (spaceLeft >= tooltipWidth + gap) {
        top = targetCenterY - tooltipHeight / 2
        left = targetRect.left - tooltipWidth - gap
        actualPlacement = 'left'
      } else if (spaceRight >= tooltipWidth + gap) {
        top = targetCenterY - tooltipHeight / 2
        left = targetRect.left + targetRect.width + gap
        actualPlacement = 'right'
      } else {
        left = targetCenterX - tooltipWidth / 2
        if (spaceBottom >= tooltipHeight + gap) {
          top = targetRect.top + targetRect.height + gap
          actualPlacement = 'bottom'
        } else {
          top = targetRect.top - tooltipHeight - gap
          actualPlacement = 'top'
        }
      }
      break

    case 'right':
      if (spaceRight >= tooltipWidth + gap) {
        top = targetCenterY - tooltipHeight / 2
        left = targetRect.left + targetRect.width + gap
        actualPlacement = 'right'
      } else if (spaceLeft >= tooltipWidth + gap) {
        top = targetCenterY - tooltipHeight / 2
        left = targetRect.left - tooltipWidth - gap
        actualPlacement = 'left'
      } else {
        left = targetCenterX - tooltipWidth / 2
        if (spaceBottom >= tooltipHeight + gap) {
          top = targetRect.top + targetRect.height + gap
          actualPlacement = 'bottom'
        } else {
          top = targetRect.top - tooltipHeight - gap
          actualPlacement = 'top'
        }
      }
      break
  }

  // 确保不超出窗口边界
  left = Math.max(margin, Math.min(left, windowWidth - tooltipWidth - margin))
  top = Math.max(margin, Math.min(top, windowHeight - tooltipHeight - margin))

  // 计算箭头偏移量
  if (actualPlacement === 'top' || actualPlacement === 'bottom') {
    // 水平方向的偏移
    const tooltipCenterX = left + tooltipWidth / 2
    arrowOffset = targetCenterX - tooltipCenterX
    // 限制箭头偏移范围，确保箭头在 Tooltip 内
    const maxOffset = tooltipWidth / 2 - arrowSize - margin
    arrowOffset = Math.max(-maxOffset, Math.min(arrowOffset, maxOffset))
  } else {
    // 垂直方向的偏移
    const tooltipCenterY = top + tooltipHeight / 2
    arrowOffset = targetCenterY - tooltipCenterY
    // 限制箭头偏移范围
    const maxOffset = tooltipHeight / 2 - arrowSize - margin
    arrowOffset = Math.max(-maxOffset, Math.min(arrowOffset, maxOffset))
  }

  return { top, left, actualPlacement, arrowOffset }
}

export function TourTooltip({
  targetRect,
  title,
  content,
  currentStep,
  totalSteps,
  placement = 'bottom',
  visible,
  onNext,
  onPrev,
  onSkip,
  onClose,
  nextButtonText,
  prevButtonText,
  showSkip = true,
  isLastStep = false,
  isFirstStep = false,
}: TourTooltipProps) {
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState<PositionResult>({
    top: 0,
    left: 0,
    actualPlacement: placement,
    arrowOffset: 0,
  })
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tooltipSize, setTooltipSize] = useState({ width: 420, height: 220 })

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // 获取实际 Tooltip 尺寸
  useEffect(() => {
    if (tooltipRef.current && visible) {
      const rect = tooltipRef.current.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setTooltipSize({ width: rect.width, height: rect.height })
      }
    }
  }, [visible, title, content])

  // 计算位置
  const updatePosition = useCallback(() => {
    if (targetRect) {
      const safeWidth = Math.min(tooltipSize.width || 340, window.innerWidth - 24)
      const safeHeight = Math.min(tooltipSize.height || 200, window.innerHeight - 24)
      setPosition(calculatePosition(targetRect, placement, safeWidth, safeHeight))
    }
  }, [targetRect, placement, tooltipSize])

  useEffect(() => {
    updatePosition()
  }, [updatePosition])

  // 监听窗口大小变化
  useEffect(() => {
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [updatePosition])

  if (!mounted || !targetRect) return null

  // 获取箭头方向（与 placement 相反）
  const arrowDirection = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  }[position.actualPlacement] as 'top' | 'bottom' | 'left' | 'right'

  // 计算箭头样式
  const getArrowStyle = () => {
    const baseStyle: React.CSSProperties = {}
    
    if (arrowDirection === 'top' || arrowDirection === 'bottom') {
      baseStyle.left = `calc(50% + ${position.arrowOffset}px)`
      baseStyle.transform = 'translateX(-50%) rotate(45deg)'
    } else {
      baseStyle.top = `calc(50% + ${position.arrowOffset}px)`
      baseStyle.transform = 'translateY(-50%) rotate(45deg)'
    }
    
    return baseStyle
  }

  const tooltipContent = (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="fixed z-[9999] w-[380px] sm:w-[420px] max-w-[calc(100vw-24px)] rounded-xl border bg-popover p-4 shadow-2xl"
          style={{
            top: position.top,
            left: position.left,
            maxWidth: 'calc(100vw - 24px)',
          }}
        >
          {/* 箭头 */}
          <div
            className={cn(
              "absolute w-3 h-3 bg-popover border rotate-45",
              arrowDirection === 'top' && "top-[-7px] border-r-0 border-b-0",
              arrowDirection === 'bottom' && "bottom-[-7px] border-l-0 border-t-0",
              arrowDirection === 'left' && "left-[-7px] border-t-0 border-r-0",
              arrowDirection === 'right' && "right-[-7px] border-b-0 border-l-0",
            )}
            style={getArrowStyle()}
          />

          {/* 关闭按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>

          {/* 内容 */}
          <div className="pr-8">
            <h4 className="font-semibold text-base mb-2">{title}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {content}
            </p>
          </div>

          {/* 底部：进度和按钮 */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between mt-4 pt-3 border-t gap-2 sm:gap-3">
            {/* 进度指示器 */}
            <div className="flex items-center gap-1 shrink-0">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-colors",
                    i === currentStep ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                />
              ))}
              <span className="text-xs text-muted-foreground ml-1.5 whitespace-nowrap">
                {currentStep + 1} / {totalSteps}
              </span>
            </div>

            {/* 导航按钮 */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
              {showSkip && !isLastStep && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-muted-foreground"
                  onClick={onSkip}
                >
                  <SkipForward className="h-3 w-3 mr-1" />
                  跳过
                </Button>
              )}
              
              {!isFirstStep && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={onPrev}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline ml-1">{prevButtonText || '上一步'}</span>
                </Button>
              )}
              
              <Button
                size="sm"
                className="h-8 px-3"
                onClick={onNext}
              >
                {isLastStep ? (
                  nextButtonText || '完成'
                ) : (
                  <>
                    {nextButtonText || '下一步'}
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(tooltipContent, document.body)
}
