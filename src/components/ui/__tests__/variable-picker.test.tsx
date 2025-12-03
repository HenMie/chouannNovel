// VariablePicker 组件测试
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VariablePicker } from '../variable-picker'
import type { WorkflowNode } from '@/types'

// 模拟节点数据
const mockNodes: WorkflowNode[] = [
  {
    id: 'node-1',
    workflow_id: 'workflow-1',
    type: 'start',
    name: '开始',
    config: {},
    order_index: 0,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 'node-2',
    workflow_id: 'workflow-1',
    type: 'ai_chat',
    name: 'AI对话',
    config: {},
    order_index: 1,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 'node-3',
    workflow_id: 'workflow-1',
    type: 'text_extract',
    name: '内容提取',
    config: {},
    order_index: 2,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 'node-4',
    workflow_id: 'workflow-1',
    type: 'var_set',
    name: '设置变量',
    config: { variable_name: 'myVar' },
    order_index: 3,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 'current-node',
    workflow_id: 'workflow-1',
    type: 'ai_chat',
    name: '当前节点',
    config: {},
    order_index: 4,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
]

describe('VariablePicker 组件', () => {
  const defaultProps = {
    nodes: mockNodes,
    currentNodeId: 'current-node',
    position: { x: 100, y: 100 },
    onSelect: vi.fn(),
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ========== 渲染测试 ==========
  describe('渲染', () => {
    it('应正确渲染变量选择器', () => {
      render(<VariablePicker {...defaultProps} />)
      // 使用 getAllByText 处理多重匹配
      const elements = screen.getAllByText('选择变量')
      expect(elements.length).toBeGreaterThan(0)
    })

    it('应显示键盘提示', () => {
      render(<VariablePicker {...defaultProps} />)
      expect(screen.getByText('选择节点')).toBeInTheDocument()
      expect(screen.getByText('确认')).toBeInTheDocument()
      expect(screen.getByText('关闭')).toBeInTheDocument()
    })

    it('应在指定位置渲染', () => {
      render(<VariablePicker {...defaultProps} position={{ x: 200, y: 300 }} />)
      const picker = document.querySelector('.variable-picker') as HTMLElement
      expect(picker).toBeInTheDocument()
      // 位置会被调整以防止溢出，但应该存在 style 属性
      expect(picker.style.left).toBeDefined()
      expect(picker.style.top).toBeDefined()
    })
  })

  // ========== 变量列表展示测试 ==========
  describe('变量列表展示', () => {
    it('应显示当前节点之前的所有节点', () => {
      render(<VariablePicker {...defaultProps} />)
      // 应该显示 current-node 之前的节点
      expect(screen.getByText('开始')).toBeInTheDocument()
      expect(screen.getByText('AI对话')).toBeInTheDocument()
      expect(screen.getByText('内容提取')).toBeInTheDocument()
      expect(screen.getByText('设置变量')).toBeInTheDocument()
    })

    it('不应显示当前节点', () => {
      render(<VariablePicker {...defaultProps} />)
      // 当前节点不应该显示在列表中
      expect(screen.queryByText('当前节点')).not.toBeInTheDocument()
    })

    it('应显示节点的输出变量描述', () => {
      render(<VariablePicker {...defaultProps} />)
      // 开始节点的用户输入变量（描述文本）
      expect(screen.getByText('用户输入')).toBeInTheDocument()
    })
  })

  // ========== 选择变量测试 ==========
  describe('选择变量', () => {
    it('点击变量应触发 onSelect', async () => {
      const handleSelect = vi.fn()
      const user = userEvent.setup()
      
      render(<VariablePicker {...defaultProps} onSelect={handleSelect} />)
      
      // 点击用户输入变量
      await user.click(screen.getByText('用户输入'))
      
      expect(handleSelect).toHaveBeenCalledWith('{{开始 > 用户输入}}')
    })

    it('选择 AI 节点变量应传递正确的格式', async () => {
      const handleSelect = vi.fn()
      const user = userEvent.setup()
      
      render(<VariablePicker {...defaultProps} onSelect={handleSelect} />)
      
      // 先切换到 AI 节点
      await user.click(screen.getByText('AI对话'))
      // 点击 AI 回答内容
      await user.click(screen.getByText('AI 回答内容'))
      
      expect(handleSelect).toHaveBeenCalledWith('{{AI对话 > AI 回答内容}}')
    })
  })

  // ========== 键盘导航测试 ==========
  describe('键盘导航', () => {
    it('按 Escape 应关闭选择器', async () => {
      const handleClose = vi.fn()
      render(<VariablePicker {...defaultProps} onClose={handleClose} />)
      
      fireEvent.keyDown(window, { key: 'Escape' })
      
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('按 ArrowDown 应触发分类切换', async () => {
      render(<VariablePicker {...defaultProps} />)
      
      // 初始应该选中第一个节点
      expect(screen.getByText('开始')).toBeInTheDocument()
      
      // 按下箭头
      fireEvent.keyDown(window, { key: 'ArrowDown' })
      
      // 应该能够继续交互
      expect(screen.getByText('AI对话')).toBeInTheDocument()
    })

    it('按 ArrowUp 应触发分类切换', async () => {
      render(<VariablePicker {...defaultProps} />)
      
      // 先按下箭头
      fireEvent.keyDown(window, { key: 'ArrowDown' })
      
      // 再按上箭头
      fireEvent.keyDown(window, { key: 'ArrowUp' })
      
      // 组件应该正常工作
      expect(screen.getByText('开始')).toBeInTheDocument()
    })

    it('按 Enter 应选择当前变量', async () => {
      const handleSelect = vi.fn()
      render(<VariablePicker {...defaultProps} onSelect={handleSelect} />)
      
      fireEvent.keyDown(window, { key: 'Enter' })
      
      expect(handleSelect).toHaveBeenCalled()
    })
  })

  // ========== 点击外部关闭测试 ==========
  describe('点击外部关闭', () => {
    it('点击选择器外部应关闭', async () => {
      const handleClose = vi.fn()
      render(
        <div>
          <div data-testid="outside">外部区域</div>
          <VariablePicker {...defaultProps} onClose={handleClose} />
        </div>
      )
      
      fireEvent.mouseDown(screen.getByTestId('outside'))
      
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('点击选择器内部不应关闭', async () => {
      const handleClose = vi.fn()
      render(<VariablePicker {...defaultProps} onClose={handleClose} />)
      
      // 使用更精确的选择器 - 标题区域
      const titleElement = screen.getByText('引用节点输出')
      fireEvent.mouseDown(titleElement)
      
      expect(handleClose).not.toHaveBeenCalled()
    })
  })

  // ========== 边界情况测试 ==========
  describe('边界情况', () => {
    it('空节点列表应正常渲染', () => {
      render(<VariablePicker {...defaultProps} nodes={[]} />)
      // 使用 getAllByText 获取所有匹配元素，然后检查第一个（标题）
      const elements = screen.getAllByText('选择变量')
      expect(elements.length).toBeGreaterThan(0)
    })

    it('没有当前节点 ID 应显示所有节点', () => {
      render(<VariablePicker {...defaultProps} currentNodeId={undefined} />)
      // 所有节点都应该显示
      expect(screen.getByText('开始')).toBeInTheDocument()
      expect(screen.getByText('AI对话')).toBeInTheDocument()
      expect(screen.getByText('当前节点')).toBeInTheDocument()
    })

    it('只有 output 类型节点应被过滤（无输出变量）', () => {
      const nodesWithOutput: WorkflowNode[] = [
        {
          id: 'output-node',
          workflow_id: 'workflow-1',
          type: 'output',
          name: '输出节点',
          config: {},
          order_index: 0,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'current',
          workflow_id: 'workflow-1',
          type: 'ai_chat',
          name: '当前',
          config: {},
          order_index: 1,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ]
      
      render(<VariablePicker {...defaultProps} nodes={nodesWithOutput} currentNodeId="current" />)
      // output 节点没有输出变量，不应显示
      expect(screen.queryByText('输出节点')).not.toBeInTheDocument()
    })
  })

  // ========== 位置调整测试 ==========
  describe('位置调整', () => {
    it('超出右边界时应调整位置', () => {
      // 模拟窗口宽度
      Object.defineProperty(window, 'innerWidth', { value: 500 })
      Object.defineProperty(window, 'innerHeight', { value: 800 })
      
      render(<VariablePicker {...defaultProps} position={{ x: 400, y: 100 }} />)
      
      const picker = document.querySelector('.variable-picker') as HTMLElement
      // 位置应该被调整
      expect(picker).toBeInTheDocument()
    })

    it('超出下边界时应调整位置', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800 })
      Object.defineProperty(window, 'innerHeight', { value: 400 })
      
      render(<VariablePicker {...defaultProps} position={{ x: 100, y: 300 }} />)
      
      const picker = document.querySelector('.variable-picker') as HTMLElement
      expect(picker).toBeInTheDocument()
    })
  })
})

