/**
 * Markdown 标题解析工具
 * 将 Markdown 内容按标题层级解析为树形结构
 */

export interface ContentSection {
  id: string
  level: number
  title: string
  content: string
  children: ContentSection[]
}

let sectionCounter = 0

function generateSectionId(): string {
  return `section-${++sectionCounter}`
}

/**
 * 重置 ID 计数器（用于测试）
 */
export function resetSectionCounter(): void {
  sectionCounter = 0
}

/**
 * 将 Markdown 内容按标题结构解析为树形 ContentSection 数组。
 *
 * 解析规则：
 * - 按行扫描，识别 `# ~ ######` 标题行
 * - 标题下方到下一个同级或更高级标题之间的文本作为该标题的 content
 * - 低级标题（数值更大）嵌套为上级标题的 children
 * - 标题之前的内容作为 level=0 的根内容节点
 */
export function parseContentToSections(content: string): ContentSection[] {
  if (!content || !content.trim()) return []

  sectionCounter = 0

  const lines = content.split('\n')
  const headingRegex = /^(#{1,6})\s+(.+)$/

  // 扫描所有标题位置
  interface HeadingInfo {
    lineIndex: number
    level: number
    title: string
  }

  const headings: HeadingInfo[] = []
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(headingRegex)
    if (match) {
      headings.push({
        lineIndex: i,
        level: match[1].length,
        title: match[2].trim(),
      })
    }
  }

  // 如果没有标题，返回整个内容作为单一节点
  if (headings.length === 0) {
    return [{
      id: generateSectionId(),
      level: 0,
      title: '',
      content: content.trim(),
      children: [],
    }]
  }

  const result: ContentSection[] = []

  // 处理第一个标题之前的内容
  if (headings[0].lineIndex > 0) {
    const preContent = lines.slice(0, headings[0].lineIndex).join('\n').trim()
    if (preContent) {
      result.push({
        id: generateSectionId(),
        level: 0,
        title: '',
        content: preContent,
        children: [],
      })
    }
  }

  // 构建扁平的 section 列表
  const flatSections: ContentSection[] = []
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i]
    const nextHeadingLine = i + 1 < headings.length ? headings[i + 1].lineIndex : lines.length
    const bodyLines = lines.slice(heading.lineIndex + 1, nextHeadingLine)
    const bodyContent = bodyLines.join('\n').trim()

    flatSections.push({
      id: generateSectionId(),
      level: heading.level,
      title: heading.title,
      content: bodyContent,
      children: [],
    })
  }

  // 递归构建树
  function buildTree(sections: ContentSection[]): ContentSection[] {
    if (sections.length === 0) return []

    const tree: ContentSection[] = []
    let i = 0

    while (i < sections.length) {
      const current = sections[i]
      const children: ContentSection[] = []

      // 收集所有级别更低（数值更大）的后续节点作为子节点候选
      let j = i + 1
      while (j < sections.length && sections[j].level > current.level) {
        children.push(sections[j])
        j++
      }

      current.children = buildTree(children)
      tree.push(current)
      i = j
    }

    return tree
  }

  result.push(...buildTree(flatSections))

  return result
}

/**
 * 从 ContentSection 树中提取所有标题（扁平化），用于 TOC 导航。
 */
export function extractHeadings(sections: ContentSection[]): Array<{ id: string; level: number; title: string }> {
  const headings: Array<{ id: string; level: number; title: string }> = []

  function walk(nodes: ContentSection[]) {
    for (const node of nodes) {
      if (node.title) {
        headings.push({ id: node.id, level: node.level, title: node.title })
      }
      walk(node.children)
    }
  }

  walk(sections)
  return headings
}
