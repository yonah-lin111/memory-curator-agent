import path from "path"

/**
 * 模糊匹配函数与打分机制
 * 优先匹配文件名：支持驼峰/子序列缩写；@chl 命中该文件依靠驼峰缩写。
 * 算法确保更紧凑的 filename subsequence 比路径上跨目录的偶然匹配得分高，排序稳定。
 *
 * @param filePath 相对路径或绝对路径
 * @param q 清理后的查询条件（小写、去除首尾空格、去除前缀@）
 */
export const getMatchScore = (filePath: string, q: string): number => {
  if (!q) return 1 // 如果没有查询条件，默认都匹配，分数为 1
  const pathLower = filePath.toLowerCase()
  const fileName = path.basename(filePath)
  const fileNameLower = fileName.toLowerCase()

  // 1. 完全匹配
  if (fileNameLower === q) return 5000
  if (pathLower === q) return 4000

  // 2. 文件名前缀匹配
  if (fileNameLower.startsWith(q)) return 3000
  if (pathLower.startsWith(q)) return 2000

  // 3. 文件名驼峰/子序列缩写匹配 (例如: chl 匹配 CuratorHistoryList.tsx)
  // 我们通过提取大写字母和首字母来进行缩写匹配
  const fileNameCaps = fileName.replace(/[^A-Z]/g, "").toLowerCase()
  if (fileNameCaps && fileNameCaps.startsWith(q)) {
    return 2800 + (q.length === fileNameCaps.length ? 100 : 0)
  }
  if (fileNameCaps && fileNameCaps.includes(q)) {
    return 2500
  }

  // 4. 文件名包含匹配
  if (fileNameLower.includes(q)) return 1800

  // 5. 文件名中的紧凑子序列匹配
  let fQueryIdx = 0
  let fFirstMatchIdx = -1
  let fLastMatchIdx = -1

  for (let i = 0; i < fileNameLower.length; i++) {
    if (fileNameLower[i] === q[fQueryIdx]) {
      if (fQueryIdx === 0) fFirstMatchIdx = i
      fQueryIdx++
      if (fQueryIdx === q.length) {
        fLastMatchIdx = i
        break
      }
    }
  }

  if (fQueryIdx === q.length) {
    const span = fLastMatchIdx - fFirstMatchIdx + 1
    // 文件名子序列分级：根据紧凑度（跨度）打分
    return Math.max(1200, 1500 - span * 10)
  }

  // 6. 完整路径包含匹配
  if (pathLower.includes(q)) return 800

  // 7. 完整路径上的跨目录/非紧凑子序列匹配
  let pQueryIdx = 0
  let pFirstMatchIdx = -1
  let pLastMatchIdx = -1

  for (let i = 0; i < pathLower.length; i++) {
    if (pathLower[i] === q[pQueryIdx]) {
      if (pQueryIdx === 0) pFirstMatchIdx = i
      pQueryIdx++
      if (pQueryIdx === q.length) {
        pLastMatchIdx = i
        break
      }
    }
  }

  if (pQueryIdx === q.length) {
    const span = pLastMatchIdx - pFirstMatchIdx + 1
    return Math.max(100, 500 - span)
  }

  return 0
}
