// Tour 高亮遮罩层组件
// 创建一个带有圆角矩形镂空的遮罩，高亮显示目标元素

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

interface TourSpotlightProps {
  // 目标元素的位置和尺寸
  targetRect: TargetRect | null
  // 高亮区域的内边距
  padding?: number
  // 遮罩层透明度
  overlayOpacity?: number
  // 是否显示
  visible: boolean
  // 点击遮罩时的回调
  onOverlayClick?: () => void
  // 是否允许点击目标元素
  allowTargetInteraction?: boolean
}

export function TourSpotlight({
  targetRect,
  padding = 8,
  overlayOpacity = 0.75,
  visible,
  onOverlayClick,
  allowTargetInteraction = false,
}: TourSpotlightProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted) return null

  // 计算带 padding 的目标区域
  const spotlightRect = targetRect
    ? {
        top: targetRect.top - padding,
        left: targetRect.left - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      }
    : null

  // 创建 SVG 路径：外边框 + 内部镂空
  const createMaskPath = () => {
    if (!spotlightRect) return ''
    
    const { innerWidth: w, innerHeight: h } = window
    const { top, left, width, height } = spotlightRect
    const radius = 8 // 圆角半径

    // 外边框（顺时针）
    const outer = `M0,0 L${w},0 L${w},${h} L0,${h} Z`
    
    // 内部镂空（逆时针，带圆角）
    const inner = `
      M${left + radius},${top}
      L${left + width - radius},${top}
      Q${left + width},${top} ${left + width},${top + radius}
      L${left + width},${top + height - radius}
      Q${left + width},${top + height} ${left + width - radius},${top + height}
      L${left + radius},${top + height}
      Q${left},${top + height} ${left},${top + height - radius}
      L${left},${top + radius}
      Q${left},${top} ${left + radius},${top}
      Z
    `

    return outer + ' ' + inner
  }

  const content = (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9998]"
          style={{ pointerEvents: allowTargetInteraction ? 'none' : 'auto' }}
          onClick={onOverlayClick}
        >
          <svg
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="none"
          >
            <motion.path
              initial={{ opacity: 0 }}
              animate={{ opacity: overlayOpacity }}
              exit={{ opacity: 0 }}
              d={createMaskPath()}
              fill="rgba(0, 0, 0, 1)"
              fillRule="evenodd"
            />
          </svg>
          
          {/* 高亮边框 */}
          {spotlightRect && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="absolute rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-transparent"
              style={{
                top: spotlightRect.top,
                left: spotlightRect.left,
                width: spotlightRect.width,
                height: spotlightRect.height,
                pointerEvents: 'none',
              }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(content, document.body)
}

