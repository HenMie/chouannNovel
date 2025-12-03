/**
 * E2E 测试数据和 fixtures
 */

// 测试项目数据
export const testProject = {
  name: 'E2E 测试项目',
  description: '这是一个用于 E2E 测试的项目',
}

export const testProjectUpdated = {
  name: 'E2E 测试项目（已更新）',
  description: '项目描述已更新',
}

// 测试工作流数据
export const testWorkflow = {
  name: 'E2E 测试工作流',
  description: '用于 E2E 测试的工作流',
}

export const testWorkflowUpdated = {
  name: 'E2E 测试工作流（已更新）',
  description: '工作流描述已更新',
}

// 测试节点数据
export const testNodes = {
  aiChat: {
    type: 'ai_chat',
    name: 'AI 对话节点',
  },
  output: {
    type: 'output',
    name: '输出节点',
  },
  textConcat: {
    type: 'text_concat',
    name: '文本拼接节点',
  },
  varSet: {
    type: 'var_set',
    name: '设置变量节点',
  },
}

// 测试输入数据
export const testExecutionInput = {
  simple: '测试输入内容',
  multiline: '第一行\n第二行\n第三行',
}

// 选择器常量
export const selectors = {
  // 首页
  home: {
    newProjectBtn: 'button:has-text("新建项目")',
    projectCard: '[data-testid="project-card"]',
    projectTitle: '[data-testid="project-title"]',
    sortSelect: '[data-testid="sort-select"]',
  },
  
  // 项目页面
  project: {
    newWorkflowBtn: 'button:has-text("新建工作流")',
    workflowCard: '[data-testid="workflow-card"]',
    workflowTitle: '[data-testid="workflow-title"]',
    settingsBtn: 'button:has-text("设定库")',
    moreMenuBtn: '[data-testid="more-menu"]',
  },
  
  // 工作流页面
  workflow: {
    addNodeBtn: 'button:has-text("添加节点")',
    runBtn: 'button:has-text("运行")',
    pauseBtn: 'button:has-text("暂停")',
    resumeBtn: 'button:has-text("继续")',
    stopBtn: 'button:has-text("停止")',
    historyBtn: 'button:has-text("执行历史")',
    nodeList: '[data-testid="node-list"]',
    nodeItem: '[data-testid="node-item"]',
    outputPanel: '[data-testid="output-panel"]',
  },
  
  // 通用
  common: {
    confirmBtn: 'button:has-text("确认")',
    cancelBtn: 'button:has-text("取消")',
    deleteBtn: 'button:has-text("删除")',
    saveBtn: 'button:has-text("保存")',
    submitBtn: 'button[type="submit"]',
    dialog: '[role="dialog"]',
    alertDialog: '[role="alertdialog"]',
    toast: '[data-sonner-toast]',
  },
  
  // 表单
  form: {
    nameInput: 'input[id="name"]',
    descriptionInput: 'textarea[id="description"]',
  },
}

// 工具函数
export function generateUniqueName(prefix: string): string {
  return `${prefix}_${Date.now()}`
}

export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

