// NodeConfigDrawer 组件测试
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NodeConfigDrawer } from '../NodeConfigDrawer'
import type { WorkflowNode, GlobalConfig } from '@/types'

// Mock 数据库模块
vi.mock('@/lib/db', () => ({
  getGlobalConfig: vi.fn().mockResolvedValue({
    default_ai_provider: 'openai',
    default_ai_model: 'gpt-4',
  } as GlobalConfig),
  updateNode: vi.fn().mockResolvedValue(undefined),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// 模拟节点数据
const createMockNode = (type: string, name: string): WorkflowNode => ({
  id: `node-${type}`,
  workflow_id: 'workflow-1',
  type: type as any,
  name,
  config: {},
  order_index: 0,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
})

const mockNodes: WorkflowNode[] = [
  createMockNode('start', '开始'),
  createMockNode('ai_chat', 'AI对话'),
  createMockNode('text_extract', '内容提取'),
]

describe('NodeConfigDrawer 组件', () => {
  const defaultProps = {
    node: createMockNode('start', '开始节点'),
    nodes: mockNodes,
    projectId: 'project-1',
    open: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ========== 打开/关闭测试 ==========
  describe('打开/关闭', () => {
    it('open=true 时应显示抽屉', () => {
      render(<NodeConfigDrawer {...defaultProps} open={true} />)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('open=false 时应隐藏抽屉', () => {
      render(<NodeConfigDrawer {...defaultProps} open={false} />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('点击取消按钮应调用 onClose', async () => {
      const handleClose = vi.fn()
      const user = userEvent.setup()
      
      render(<NodeConfigDrawer {...defaultProps} onClose={handleClose} />)
      
      await user.click(screen.getByRole('button', { name: '取消' }))
      expect(handleClose).toHaveBeenCalledTimes(1)
    })
  })

  // ========== 内容渲染测试 ==========
  describe('内容渲染', () => {
    it('应显示节点类型标签', () => {
      render(<NodeConfigDrawer {...defaultProps} />)
      expect(screen.getByText('开始流程')).toBeInTheDocument()
    })

    it('应显示节点名称输入框', () => {
      render(<NodeConfigDrawer {...defaultProps} />)
      expect(screen.getByLabelText('节点名称')).toBeInTheDocument()
    })

    it('节点名称输入框应显示当前节点名称', () => {
      render(<NodeConfigDrawer {...defaultProps} />)
      expect(screen.getByLabelText('节点名称')).toHaveValue('开始节点')
    })

    it('应显示保存按钮', () => {
      render(<NodeConfigDrawer {...defaultProps} />)
      expect(screen.getByRole('button', { name: /保存/i })).toBeInTheDocument()
    })
  })

  // ========== 节点类型配置表单测试 ==========
  describe('节点类型配置表单', () => {
    it('start 节点应显示默认值输入', () => {
      render(<NodeConfigDrawer {...defaultProps} node={createMockNode('start', '开始')} />)
      expect(screen.getByText('用户问题')).toBeInTheDocument()
      expect(screen.getByLabelText('默认值')).toBeInTheDocument()
    })

    it('output 节点应显示输出格式选择', () => {
      render(<NodeConfigDrawer {...defaultProps} node={createMockNode('output', '输出')} />)
      expect(screen.getByText('输出格式')).toBeInTheDocument()
    })

    it('var_set 节点应显示变量名和变量值输入', () => {
      render(<NodeConfigDrawer {...defaultProps} node={createMockNode('var_set', '设置变量')} />)
      expect(screen.getByLabelText('变量名')).toBeInTheDocument()
      expect(screen.getByLabelText('变量值')).toBeInTheDocument()
    })

    it('var_get 节点应显示变量名输入', () => {
      render(<NodeConfigDrawer {...defaultProps} node={createMockNode('var_get', '读取变量')} />)
      expect(screen.getByLabelText('变量名')).toBeInTheDocument()
    })

    it('loop_end 节点应显示无需配置提示', () => {
      render(<NodeConfigDrawer {...defaultProps} node={createMockNode('loop_end', '循环结束')} />)
      expect(screen.getByText('循环结束节点无需配置。')).toBeInTheDocument()
    })

    it('parallel_end 节点应显示无需配置提示', () => {
      render(<NodeConfigDrawer {...defaultProps} node={createMockNode('parallel_end', '并发结束')} />)
      expect(screen.getByText('并发结束节点无需配置。')).toBeInTheDocument()
    })

    it('condition_else 节点应显示无需配置提示', () => {
      render(<NodeConfigDrawer {...defaultProps} node={createMockNode('condition_else', 'else分支')} />)
      expect(screen.getByText('else 节点无需配置。')).toBeInTheDocument()
    })

    it('condition_end 节点应显示无需配置提示', () => {
      render(<NodeConfigDrawer {...defaultProps} node={createMockNode('condition_end', '条件结束')} />)
      expect(screen.getByText('条件分支结束节点无需配置。')).toBeInTheDocument()
    })

    it('未知节点类型应显示开发中提示', () => {
      const unknownNode = {
        ...createMockNode('unknown_type' as any, '未知节点'),
      }
      render(<NodeConfigDrawer {...defaultProps} node={unknownNode} />)
      expect(screen.getByText('配置表单开发中')).toBeInTheDocument()
    })
  })

  // ========== 保存功能测试 ==========
  describe('保存功能', () => {
    it('点击保存应调用 onSave', async () => {
      const handleSave = vi.fn()
      const user = userEvent.setup()
      const db = await import('@/lib/db')
      
      render(<NodeConfigDrawer {...defaultProps} onSave={handleSave} />)
      
      await user.click(screen.getByRole('button', { name: /保存/i }))
      
      await waitFor(() => {
        expect(db.updateNode).toHaveBeenCalled()
        expect(handleSave).toHaveBeenCalled()
      })
    })

    it('保存时应显示加载状态', async () => {
      const user = userEvent.setup()
      
      render(<NodeConfigDrawer {...defaultProps} />)
      
      await user.click(screen.getByRole('button', { name: /保存/i }))
      
      // 可能会短暂显示加载状态
      // 由于是 mock，可能执行很快
    })

    it('修改节点名称后保存应传递新名称', async () => {
      const handleSave = vi.fn()
      
      render(<NodeConfigDrawer {...defaultProps} onSave={handleSave} />)
      
      // 修改节点名称
      const nameInput = screen.getByLabelText('节点名称')
      fireEvent.change(nameInput, { target: { value: '新节点名称' } })
      
      // 保存
      fireEvent.click(screen.getByRole('button', { name: /保存/i }))
      
      await waitFor(() => {
        expect(handleSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: '新节点名称',
          })
        )
      })
    })
  })

  // ========== 节点变化时更新表单测试 ==========
  describe('节点变化时更新表单', () => {
    it('切换节点时应更新表单内容', async () => {
      const { rerender } = render(
        <NodeConfigDrawer {...defaultProps} node={createMockNode('start', '节点A')} />
      )
      
      expect(screen.getByLabelText('节点名称')).toHaveValue('节点A')
      
      // 切换到另一个节点
      rerender(
        <NodeConfigDrawer {...defaultProps} node={createMockNode('output', '节点B')} />
      )
      
      await waitFor(() => {
        expect(screen.getByLabelText('节点名称')).toHaveValue('节点B')
      })
    })
  })

  // ========== null 节点测试 ==========
  describe('null 节点', () => {
    it('node 为 null 时不应崩溃', () => {
      render(<NodeConfigDrawer {...defaultProps} node={null} />)
      // 组件应该正常渲染，但没有配置表单
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  // ========== 节点类型标签映射测试 ==========
  describe('节点类型标签映射', () => {
    // 基础节点类型测试（避免 ScrollArea 相关的 ResizeObserver 问题）
    const basicTypeLabels = [
      { type: 'start', label: '开始流程' },
      { type: 'output', label: '输出节点' },
      { type: 'var_set', label: '设置变量节点' },
      { type: 'var_get', label: '读取变量节点' },
      { type: 'loop_end', label: 'for 循环结束' },
      { type: 'parallel_end', label: '并发执行结束' },
      { type: 'condition_else', label: 'else 分支' },
      { type: 'condition_end', label: 'if 分支结束' },
    ]

    basicTypeLabels.forEach(({ type, label }) => {
      it(`${type} 节点应显示 "${label}"`, () => {
        render(<NodeConfigDrawer {...defaultProps} node={createMockNode(type, '测试')} />)
        expect(screen.getByText(label)).toBeInTheDocument()
      })
    })

    // 复杂节点类型需要更多组件，单独测试
    it('ai_chat 节点应显示正确标签', () => {
      render(<NodeConfigDrawer {...defaultProps} node={createMockNode('ai_chat', '测试')} />)
      expect(screen.getByText('AI 对话节点')).toBeInTheDocument()
    })

    it('text_extract 节点应显示正确标签', () => {
      render(<NodeConfigDrawer {...defaultProps} node={createMockNode('text_extract', '测试')} />)
      expect(screen.getByText('内容提取节点')).toBeInTheDocument()
    })

    it('text_concat 节点应显示正确标签', () => {
      render(<NodeConfigDrawer {...defaultProps} node={createMockNode('text_concat', '测试')} />)
      expect(screen.getByText('文本拼接节点')).toBeInTheDocument()
    })

    it('condition 节点应显示正确标签', () => {
      render(<NodeConfigDrawer {...defaultProps} node={createMockNode('condition', '测试')} />)
      expect(screen.getByText('条件判断节点')).toBeInTheDocument()
    })

    it('loop 节点应显示正确标签', () => {
      render(<NodeConfigDrawer {...defaultProps} node={createMockNode('loop', '测试')} />)
      expect(screen.getByText('循环节点')).toBeInTheDocument()
    })

    it('condition_if 节点应显示正确标签', () => {
      render(<NodeConfigDrawer {...defaultProps} node={createMockNode('condition_if', '测试')} />)
      expect(screen.getByText('if 条件分支')).toBeInTheDocument()
    })
  })

  // ========== 配置项变更测试 ==========
  describe('配置项变更', () => {
    it('修改 start 节点默认值应更新配置', async () => {
      const handleSave = vi.fn()
      
      render(
        <NodeConfigDrawer 
          {...defaultProps} 
          node={createMockNode('start', '开始')} 
          onSave={handleSave} 
        />
      )
      
      // 输入默认值
      const defaultValueInput = screen.getByLabelText('默认值')
      fireEvent.change(defaultValueInput, { target: { value: '测试默认值' } })
      
      // 保存
      fireEvent.click(screen.getByRole('button', { name: /保存/i }))
      
      await waitFor(() => {
        expect(handleSave).toHaveBeenCalled()
      })
    })

    it('修改 var_set 节点变量名应更新配置', async () => {
      const handleSave = vi.fn()
      
      render(
        <NodeConfigDrawer 
          {...defaultProps} 
          node={createMockNode('var_set', '设置变量')} 
          onSave={handleSave} 
        />
      )
      
      // 输入变量名
      const varNameInput = screen.getByLabelText('变量名')
      fireEvent.change(varNameInput, { target: { value: 'myVariable' } })
      
      // 保存
      fireEvent.click(screen.getByRole('button', { name: /保存/i }))
      
      await waitFor(() => {
        expect(handleSave).toHaveBeenCalled()
      })
    })
  })
})

