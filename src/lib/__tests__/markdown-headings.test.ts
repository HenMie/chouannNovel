import { describe, it, expect, beforeEach } from 'vitest'
import {
  parseContentToSections,
  extractHeadings,
  resetSectionCounter,
} from '../markdown-headings'

describe('parseContentToSections', () => {
  beforeEach(() => {
    resetSectionCounter()
  })

  it('should return empty array for empty content', () => {
    expect(parseContentToSections('')).toEqual([])
    expect(parseContentToSections('  ')).toEqual([])
  })

  it('should return single node for content without headings', () => {
    const result = parseContentToSections('plain text\nmore text')
    expect(result).toHaveLength(1)
    expect(result[0].level).toBe(0)
    expect(result[0].title).toBe('')
    expect(result[0].content).toBe('plain text\nmore text')
  })

  it('should parse single heading', () => {
    const content = '## 世界观\n时代背景\n黑水屯'
    const result = parseContentToSections(content)
    expect(result).toHaveLength(1)
    expect(result[0].level).toBe(2)
    expect(result[0].title).toBe('世界观')
    expect(result[0].content).toBe('时代背景\n黑水屯')
  })

  it('should parse sibling headings', () => {
    const content = '## 世界观\n内容1\n## 人物\n内容2'
    const result = parseContentToSections(content)
    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('世界观')
    expect(result[0].content).toBe('内容1')
    expect(result[1].title).toBe('人物')
    expect(result[1].content).toBe('内容2')
  })

  it('should nest child headings', () => {
    const content = '## 世界观\n概述\n### 时代背景\n详情\n### 黑水屯\n地点'
    const result = parseContentToSections(content)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('世界观')
    expect(result[0].content).toBe('概述')
    expect(result[0].children).toHaveLength(2)
    expect(result[0].children[0].title).toBe('时代背景')
    expect(result[0].children[1].title).toBe('黑水屯')
  })

  it('should handle deep nesting', () => {
    const content = '# 故事设定\n## 世界观\n### 朱家\n#### 核心长辈\n描述'
    const result = parseContentToSections(content)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('故事设定')
    expect(result[0].children[0].title).toBe('世界观')
    expect(result[0].children[0].children[0].title).toBe('朱家')
    expect(result[0].children[0].children[0].children[0].title).toBe('核心长辈')
    expect(result[0].children[0].children[0].children[0].content).toBe('描述')
  })

  it('should preserve content before first heading', () => {
    const content = '前言内容\n## 标题\n正文'
    const result = parseContentToSections(content)
    expect(result).toHaveLength(2)
    expect(result[0].level).toBe(0)
    expect(result[0].content).toBe('前言内容')
    expect(result[1].title).toBe('标题')
  })

  it('should handle mixed levels returning to higher level', () => {
    const content = '## A\n### A1\ncontent\n## B\n### B1\ncontent'
    const result = parseContentToSections(content)
    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('A')
    expect(result[0].children[0].title).toBe('A1')
    expect(result[1].title).toBe('B')
    expect(result[1].children[0].title).toBe('B1')
  })

  it('should handle headings with empty content', () => {
    const content = '## 标题A\n## 标题B\n内容'
    const result = parseContentToSections(content)
    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('标题A')
    expect(result[0].content).toBe('')
    expect(result[1].title).toBe('标题B')
    expect(result[1].content).toBe('内容')
  })

  it('should generate unique IDs for each section', () => {
    const content = '## A\n### B\n## C'
    const result = parseContentToSections(content)
    const ids = new Set<string>()
    function collectIds(sections: typeof result) {
      for (const s of sections) {
        ids.add(s.id)
        collectIds(s.children)
      }
    }
    collectIds(result)
    expect(ids.size).toBe(3)
  })
})

describe('extractHeadings', () => {
  beforeEach(() => {
    resetSectionCounter()
  })

  it('should extract headings in order', () => {
    const content = '## 世界观\n内容\n### 时代背景\n详情\n## 人物\n角色'
    const sections = parseContentToSections(content)
    const headings = extractHeadings(sections)
    expect(headings).toHaveLength(3)
    expect(headings[0].title).toBe('世界观')
    expect(headings[0].level).toBe(2)
    expect(headings[1].title).toBe('时代背景')
    expect(headings[1].level).toBe(3)
    expect(headings[2].title).toBe('人物')
    expect(headings[2].level).toBe(2)
  })

  it('should skip nodes without title', () => {
    const content = '前言\n## 标题\n内容'
    const sections = parseContentToSections(content)
    const headings = extractHeadings(sections)
    expect(headings).toHaveLength(1)
    expect(headings[0].title).toBe('标题')
  })
})
