import path from 'node:path'

/**
 * 校验目标路径是否在项目目录内。
 * 解析为绝对路径后检查前缀，防止 ../../../etc/passwd 等路径穿越攻击。
 *
 * @param projectRoot 项目根目录绝对路径
 * @param targetPath 待访问的目标路径（可为相对路径或绝对路径）
 * @returns 解析后的绝对路径
 * @throws 路径在项目目录外时抛出 Error
 */
export const assertInsideProject = (projectRoot: string, targetPath: string): string => {
  const resolved = path.resolve(projectRoot, targetPath)

  if (!resolved.startsWith(projectRoot + path.sep) && resolved !== projectRoot) {
    throw new Error(`Access denied: ${targetPath} is outside the project directory`)
  }

  return resolved
}
