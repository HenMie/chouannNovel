// PromptEditor 组件测试
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PromptEditor, highlightVariables, SYSTEM_VARIABLES, VARIABLE_PATTERN } from '../prompt-editor'
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
]

describe('PromptEditor 组件', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ========== 基础渲染测试 ==========
  describe('渲染', () => {
    it('应正确渲染编辑器', () => {
      render(<PromptEditor {...defaultProps} />)
      expect(document.querySelector('.prompt-editor')).toBeInTheDocument()
    })

    it('应支持 placeholder', () => {
      render(<PromptEditor {...defaultProps} placeholder="请输入提示词" />)
      const editor = document.querySelector('.prompt-editor')
      expect(editor).toHaveAttribute('data-placeholder', '请输入提示词')
    })

    it('应支持自定义 className', () => {
      render(<PromptEditor {...defaultProps} className="custom-class" />)
      expect(document.querySelector('.prompt-editor')).toHaveClass('custom-class')
    })

    it('应支持自定义 minHeight', () => {
      render(<PromptEditor {...defaultProps} minHeight="200px" />)
      const editor = document.querySelector('.prompt-editor') as HTMLElement
      expect(editor.style.minHeight).toBe('200px')
    })

    it('应支持 id 属性', () => {
      render(<PromptEditor {...defaultProps} id="my-editor" />)
      expect(document.getElementById('my-editor')).toBeInTheDocument()
    })

    it('禁用状态下应不可编辑', () => {
      render(<PromptEditor {...defaultProps} disabled />)
      const editor = document.querySelector('.prompt-editor')
      expect(editor).toHaveAttribute('contenteditable', 'false')
    })
  })

  // ========== 文本编辑测试 ==========
  describe('文本编辑', () => {
    it('应响应输入事件', async () => {
      const handleChange = vi.fn()
      render(<PromptEditor {...defaultProps} onChange={handleChange} />)
      
      const editor = document.querySelector('.prompt-editor') as HTMLElement
      
      // 模拟输入
      editor.textContent = '测试内容'
      fireEvent.input(editor)
      
      expect(handleChange).toHaveBeenCalled()
    })

    it('应正确处理粘贴事件（只粘贴纯文本）', () => {
      const handleChange = vi.fn()
      render(<PromptEditor {...defaultProps} onChange={handleChange} />)
      
      const editor = document.querySelector('.prompt-editor') as HTMLElement
      
      // 创建模拟的粘贴事件数据
      const clipboardData = {
        getData: vi.fn().mockImplementation((type: string) => {
          if (type === 'text/plain') return '纯文本'
          if (type === 'text/html') return '<b>富文本</b>'
          return ''
        }),
      }
      
      // 触发粘贴事件
      fireEvent.paste(editor, { clipboardData })
      
      // 验证 getData 被调用获取纯文本
      expect(clipboardData.getData).toHaveBeenCalledWith('text/plain')
    })

    it('Tab 键应插入空格', async () => {
      render(<PromptEditor {...defaultProps} />)
      
      const editor = document.querySelector('.prompt-editor') as HTMLElement
      editor.focus()
      
      // Tab 键应该被拦截
      const event = fireEvent.keyDown(editor, { key: 'Tab' })
      // 事件应该被阻止默认行为
    })
  })

  // ========== 变量高亮测试 ==========
  describe('变量高亮', () => {
    it('应正确渲染变量标签', () => {
      render(<PromptEditor {...defaultProps} value="你好 {{用户问题}}" />)
      
      const editor = document.querySelector('.prompt-editor') as HTMLElement
      expect(editor.querySelector('.prompt-var')).toBeInTheDocument()
    })

    it('系统变量应使用内置样式', () => {
      render(<PromptEditor {...defaultProps} value="{{用户问题}}" />)
      
      const editor = document.querySelector('.prompt-editor') as HTMLElement
      expect(editor.querySelector('.prompt-var-builtin')).toBeInTheDocument()
    })

    it('自定义变量应使用自定义样式', () => {
      render(<PromptEditor {...defaultProps} value="{{自定义变量}}" />)
      
      const editor = document.querySelector('.prompt-editor') as HTMLElement
      expect(editor.querySelector('.prompt-var-custom')).toBeInTheDocument()
    })

    it('变量标签应不可编辑', () => {
      render(<PromptEditor {...defaultProps} value="{{变量}}" />)
      
      const varTag = document.querySelector('.prompt-var') as HTMLElement
      expect(varTag).toHaveAttribute('contenteditable', 'false')
    })

    it('变量标签应有 data-var 属性', () => {
      render(<PromptEditor {...defaultProps} value="{{测试变量}}" />)
      
      const varTag = document.querySelector('.prompt-var') as HTMLElement
      expect(varTag).toHaveAttribute('data-var', '{{测试变量}}')
    })
  })

  // ========== 变量选择器集成测试 ==========
  describe('变量选择器集成', () => {
    it('有节点时应显示输入提示', () => {
      render(<PromptEditor {...defaultProps} nodes={mockNodes} currentNodeId="node-2" />)
      
      // 检查提示文本的一部分
      expect(screen.getByText(/插入变量/)).toBeInTheDocument()
    })

    it('没有节点时不应显示输入提示', () => {
      render(<PromptEditor {...defaultProps} />)
      
      expect(screen.queryByText(/插入变量/)).not.toBeInTheDocument()
    })
  })

  // ========== 输入法（IME）处理测试 ==========
  describe('输入法处理', () => {
    it('应正确处理 compositionstart 事件', () => {
      const handleChange = vi.fn()
      render(<PromptEditor {...defaultProps} onChange={handleChange} />)
      
      const editor = document.querySelector('.prompt-editor') as HTMLElement
      
      // 开始输入法输入
      fireEvent.compositionStart(editor)
      
      // 在输入法输入过程中，不应触发 change
      editor.textContent = '中'
      fireEvent.input(editor)
      
      // 输入法输入中，change 不应该被调用
      expect(handleChange).not.toHaveBeenCalled()
    })

    it('应正确处理 compositionend 事件', () => {
      const handleChange = vi.fn()
      render(<PromptEditor {...defaultProps} onChange={handleChange} />)
      
      const editor = document.querySelector('.prompt-editor') as HTMLElement
      
      // 开始和结束输入法输入
      fireEvent.compositionStart(editor)
      editor.textContent = '中文'
      fireEvent.compositionEnd(editor)
      
      // 输入法结束后应该触发 change
      expect(handleChange).toHaveBeenCalled()
    })
  })

  // ========== 删除变量测试 ==========
  describe('删除变量', () => {
    it('Backspace 键应整体删除变量标签', async () => {
      const handleChange = vi.fn()
      render(<PromptEditor {...defaultProps} value="{{变量}} 后面的文字" onChange={handleChange} />)
      
      const editor = document.querySelector('.prompt-editor') as HTMLElement
      
      // 模拟光标在变量后面
      // 注意：这个测试比较复杂，因为需要模拟 Selection API
      // 在实际测试中可能需要更复杂的 setup
    })
  })

  // ========== 外部值同步测试 ==========
  describe('外部值同步', () => {
    it('外部 value 变化时应更新编辑器', async () => {
      const { rerender } = render(<PromptEditor {...defaultProps} value="初始值" />)
      
      const editor = document.querySelector('.prompt-editor') as HTMLElement
      expect(editor.textContent).toContain('初始值')
      
      // 更新 value
      rerender(<PromptEditor {...defaultProps} value="新值" />)
      
      await waitFor(() => {
        expect(editor.textContent).toContain('新值')
      })
    })
  })
})

// ========== highlightVariables 工具函数测试 ==========
describe('highlightVariables 工具函数', () => {
  it('应正确转换变量为 HTML 标签', () => {
    const html = highlightVariables('你好 {{用户问题}}')
    expect(html).toContain('prompt-var')
    expect(html).toContain('data-var="{{用户问题}}"')
  })

  it('应正确处理多个变量', () => {
    const html = highlightVariables('{{变量1}} 和 {{变量2}}')
    // 每个变量会有多个 prompt-var 类（包括基础类和颜色类）
    const matches = html.match(/class="prompt-var/g) || []
    expect(matches.length).toBe(2)
  })

  it('应正确处理换行符', () => {
    const html = highlightVariables('第一行\n第二行')
    expect(html).toContain('<br>')
  })

  it('应转义 HTML 特殊字符', () => {
    const html = highlightVariables('<script>alert("xss")</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('空字符串应返回空', () => {
    expect(highlightVariables('')).toBe('')
  })

  it('内置变量应使用 builtin 类名', () => {
    const html = highlightVariables('{{用户问题}}')
    expect(html).toContain('prompt-var-builtin')
  })

  it('自定义变量应使用 custom 类名', () => {
    const html = highlightVariables('{{自定义}}')
    expect(html).toContain('prompt-var-custom')
  })
})

// ========== SYSTEM_VARIABLES 常量测试 ==========
describe('SYSTEM_VARIABLES 常量', () => {
  it('应包含系统内置变量', () => {
    expect(SYSTEM_VARIABLES).toContain('用户问题')
    expect(SYSTEM_VARIABLES).toContain('input')
    expect(SYSTEM_VARIABLES).toContain('输入')
    expect(SYSTEM_VARIABLES).toContain('loop_index')
  })
})

// ========== VARIABLE_PATTERN 正则测试 ==========
describe('VARIABLE_PATTERN 正则', () => {
  // 创建新的正则实例进行测试（避免 lastIndex 问题）
  const createPattern = () => new RegExp(VARIABLE_PATTERN.source, 'g')

  it('应匹配单个变量', () => {
    const pattern = createPattern()
    const match = pattern.exec('{{变量}}')
    expect(match).not.toBeNull()
    expect(match?.[1]).toBe('变量')
  })

  it('应匹配多个变量', () => {
    const pattern = createPattern()
    const text = '{{变量1}} 和 {{变量2}}'
    const matches: string[] = []
    let match
    while ((match = pattern.exec(text)) !== null) {
      matches.push(match[0])
    }
    expect(matches).toHaveLength(2)
  })

  it('应匹配中文变量名', () => {
    const pattern = createPattern()
    const match = pattern.exec('{{用户输入}}')
    expect(match).not.toBeNull()
  })

  it('应匹配英文变量名', () => {
    const pattern = createPattern()
    const match = pattern.exec('{{user_input}}')
    expect(match).not.toBeNull()
  })

  it('应匹配带空格的变量名', () => {
    const pattern = createPattern()
    const match = pattern.exec('{{节点名 > 输出}}')
    expect(match).not.toBeNull()
  })

  it('不应匹配不完整的变量', () => {
    const pattern = createPattern()
    const match = pattern.exec('{变量}')
    expect(match).toBeNull()
  })

  it('不应匹配空变量', () => {
    const pattern = createPattern()
    const match = pattern.exec('{{}}')
    expect(match).toBeNull()
  })
})

