import { basename, join } from 'node:path'
import { getMarkdownImageDir } from './paths'

// Markdown 图片协议。
export const MARKDOWN_IMAGE_PROTOCOL = 'mc-img'

// Markdown 图片协议主机名。
export const MARKDOWN_IMAGE_HOST = 'md'

/**
 * 创建 Markdown 图片访问 URL。
 */
export const createMarkdownImageUrl = (fileName: string): string =>
  `${MARKDOWN_IMAGE_PROTOCOL}://${MARKDOWN_IMAGE_HOST}/${encodeURIComponent(fileName)}`

/**
 * 从 Markdown 图片 URL 解析本机文件路径。
 */
export const resolveMarkdownImagePath = (requestUrl: string): string | null => {
  const url = new URL(requestUrl)

  if (url.protocol !== `${MARKDOWN_IMAGE_PROTOCOL}:` || url.hostname !== MARKDOWN_IMAGE_HOST) {
    return null
  }

  const fileName = basename(decodeURIComponent(url.pathname.slice(1)))

  if (!fileName) {
    return null
  }

  return join(getMarkdownImageDir(), fileName)
}
