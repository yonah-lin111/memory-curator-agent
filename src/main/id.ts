import { randomUUID } from "node:crypto"

/**
 * 创建无连接符 UUID。
 */
export const createCompactUuid = (): string => randomUUID().replaceAll("-", "")
