# Component Refactoring Design Spec: App.tsx Deconstruction

- **Date:** 2026-05-22
- **Topic:** Deconstructing `App.tsx` into modular React components

---

## 1. Architectural Goals
- Maintain high-cohesion and low-coupling for each individual layout block: `Sidebar`, `MemoryList`, and `MemoryDetail`.
- Keep component-specific types, metadata structure, and mock static dataset encapsulated inside their respective folders/files rather than polluting the root index.
- Ensure all custom animations (like Notion-style sidebar sliding effects) and styling rules function flawlessly without visual regression.

---

## 2. Component Blueprint

### A. `Sidebar.tsx`
- **Location:** `src/renderer/src/components/Sidebar.tsx`
- **Internal State & Types:**
  - `interface NavItem` (Single-line comments)
  - `interface CurationCategory` (Single-line comments)
  - `MAIN_NAV_ITEMS: NavItem[]` (Mock data)
  - `CURATION_CATEGORIES: CurationCategory[]` (Mock data)
- **Props Definition:**
  ```typescript
  export interface SidebarProps {
    // 当前激活的核心功能导航 ID
    activeTab: string
    // 主导航菜单点击回调
    onTabChange: (tabId: string) => void
    // 选中的多维记忆分类 ID
    activeCategory: string
    // 策展分类点击回调
    onCategoryChange: (categoryId: string) => void
    // 侧边栏是否折叠
    isSidebarCollapsed: boolean
    // 触发侧边栏折叠/展开的回调
    onSidebarCollapseChange: (collapsed: boolean) => void
  }
  ```

### B. `MemoryList.tsx`
- **Location:** `src/renderer/src/components/MemoryList.tsx`
- **Internal State & Types:**
  - `export interface MemoryItem` (Single-line comments; exported so `App.tsx` and `MemoryDetail` can use it)
  - `MOCK_MEMORIES: MemoryItem[]` (Mock data)
  - `export const DEFAULT_MEMORY: MemoryItem` (First item of `MOCK_MEMORIES` as fallback)
- **Props Definition:**
  ```typescript
  export interface MemoryListProps {
    // 当前选中的记忆唯一标识 ID
    selectedMemoryId: string
    // 切换选中卡片时的回调，把完整数据实体回传
    onMemorySelect: (memory: MemoryItem) => void
  }
  ```

### C. `MemoryDetail.tsx`
- **Location:** `src/renderer/src/components/MemoryDetail.tsx`
- **Internal State & Types:**
  - Import `MemoryItem` from `./MemoryList`
- **Props Definition:**
  ```typescript
  export interface MemoryDetailProps {
    // 选中的记忆详细实体
    selectedMemory: MemoryItem
  }
  ```

---

## 3. App.tsx Integration
After deconstruction, `src/renderer/src/App.tsx` only acts as a pure layout grid coordinator:
```typescript
import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { MemoryList, DEFAULT_MEMORY } from './components/MemoryList'
import { MemoryDetail } from './components/MemoryDetail'
import type { MemoryItem } from './components/MemoryList'

export const App = (): React.JSX.Element => {
  const [activeTab, setActiveTab] = useState<string>('workbench')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false)
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem>(DEFAULT_MEMORY)

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#000000] p-3 gap-3 text-white antialiased">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        isSidebarCollapsed={isSidebarCollapsed}
        onSidebarCollapseChange={setIsSidebarCollapsed}
      />
      <section className="flex flex-1 gap-3 overflow-hidden">
        <MemoryList
          selectedMemoryId={selectedMemory.id}
          onMemorySelect={setSelectedMemory}
        />
        <MemoryDetail selectedMemory={selectedMemory} />
      </section>
    </main>
  )
}
```

---

## 4. Coding Standards Check
1. **Comment Style:** Method & Functional items must use JSDoc-style multi-line blocks. Enums, properties, and types use concise single-line annotations.
2. **Naming & Types:** Unified standard arrow functions for all components. Absolute return type definitions (`React.JSX.Element`). No `any` types.
3. **No Unicode Replacements:** Strict UTF-8 verification for comments to prevent any `` characters.
