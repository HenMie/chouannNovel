// Tour 状态管理
// 管理各模块引导的完成状态和当前进度

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Tour 模块类型
export type TourModule = 'home' | 'workflow' | 'settings' | 'ai_config'

// 单个 Tour 步骤定义
export interface TourStep {
  // 目标元素的 CSS 选择器或 data-tour 属性值
  target: string
  // 步骤标题
  title: string
  // 步骤描述
  content: string
  // Tooltip 位置
  placement?: 'top' | 'bottom' | 'left' | 'right'
  // 是否允许点击目标元素
  allowTargetInteraction?: boolean
  // 高亮区域的内边距
  spotlightPadding?: number
  // 自定义操作按钮文本
  nextButtonText?: string
  prevButtonText?: string
  // 是否显示跳过按钮
  showSkip?: boolean
}

// Tour 配置定义
export interface TourConfig {
  id: TourModule
  name: string
  description: string
  steps: TourStep[]
}

// 已完成的 Tour 记录
interface CompletedTours {
  [key: string]: boolean
}

interface TourState {
  // 已完成的 Tour 模块
  completedTours: CompletedTours
  
  // 当前激活的 Tour
  activeTour: TourModule | null
  
  // 当前步骤索引
  currentStepIndex: number
  
  // 是否正在运行 Tour
  isRunning: boolean

  // 操作方法
  // 开始一个 Tour
  startTour: (module: TourModule) => void
  
  // 停止当前 Tour
  stopTour: () => void
  
  // 跳转到下一步
  nextStep: () => void
  
  // 跳转到上一步
  prevStep: () => void
  
  // 跳转到指定步骤
  goToStep: (index: number) => void
  
  // 跳过当前 Tour（标记为完成）
  skipTour: () => void
  
  // 完成当前 Tour
  completeTour: () => void
  
  // 检查某个模块的 Tour 是否已完成
  isTourCompleted: (module: TourModule) => boolean
  
  // 重置某个模块的 Tour（允许重新开始）
  resetTour: (module: TourModule) => void
  
  // 重置所有 Tour
  resetAllTours: () => void
}

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      completedTours: {},
      activeTour: null,
      currentStepIndex: 0,
      isRunning: false,

      startTour: (module) => {
        set({
          activeTour: module,
          currentStepIndex: 0,
          isRunning: true,
        })
      },

      stopTour: () => {
        set({
          activeTour: null,
          currentStepIndex: 0,
          isRunning: false,
        })
      },

      nextStep: () => {
        set((state) => ({
          currentStepIndex: state.currentStepIndex + 1,
        }))
      },

      prevStep: () => {
        set((state) => ({
          currentStepIndex: Math.max(0, state.currentStepIndex - 1),
        }))
      },

      goToStep: (index) => {
        set({
          currentStepIndex: Math.max(0, index),
        })
      },

      skipTour: () => {
        const { activeTour } = get()
        if (activeTour) {
          set((state) => ({
            completedTours: {
              ...state.completedTours,
              [activeTour]: true,
            },
            activeTour: null,
            currentStepIndex: 0,
            isRunning: false,
          }))
        }
      },

      completeTour: () => {
        const { activeTour } = get()
        if (activeTour) {
          set((state) => ({
            completedTours: {
              ...state.completedTours,
              [activeTour]: true,
            },
            activeTour: null,
            currentStepIndex: 0,
            isRunning: false,
          }))
        }
      },

      isTourCompleted: (module) => {
        return get().completedTours[module] === true
      },

      resetTour: (module) => {
        set((state) => {
          const newCompletedTours = { ...state.completedTours }
          delete newCompletedTours[module]
          return { completedTours: newCompletedTours }
        })
      },

      resetAllTours: () => {
        set({
          completedTours: {},
          activeTour: null,
          currentStepIndex: 0,
          isRunning: false,
        })
      },
    }),
    {
      name: 'chouann-tour',
      // 仅持久化完成状态，不持久化运行时状态
      partialize: (state) => ({
        completedTours: state.completedTours,
      }),
    }
  )
)

// 辅助函数：检查是否应该自动开始 Tour
export function shouldAutoStartTour(module: TourModule): boolean {
  const { isTourCompleted, isRunning } = useTourStore.getState()
  return !isTourCompleted(module) && !isRunning
}

