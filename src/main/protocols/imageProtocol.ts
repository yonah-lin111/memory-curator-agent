import { net, protocol } from 'electron'
import { access, mkdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { getMarkdownImageDir, getMarkdownImageTrashDir } from '../paths'
import {
  MARKDOWN_IMAGE_PROTOCOL,
  resolveMarkdownImageFileName,
  resolveMarkdownImagePath,
  resolvePeopleAvatarPath
} from '../markdownImages'

/**
 * 判断文件是否存在。
 */
const pathExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * 从回收目录恢复被预览重新引用的图片。
 */
const restoreRequestedImageFromTrash = async (requestUrl: string): Promise<void> => {
  const fileName = resolveMarkdownImageFileName(requestUrl)

  if (!fileName) {
    return
  }

  const livePath = join(getMarkdownImageDir(), fileName)

  if (await pathExists(livePath)) {
    return
  }

  const trashPath = join(getMarkdownImageTrashDir(), fileName)

  if (!(await pathExists(trashPath))) {
    return
  }

  await mkdir(getMarkdownImageDir(), { recursive: true })
  await rename(trashPath, livePath)
}

/**
 * 注册应用图片协议权限。
 */
export const registerImageProtocolSchemes = (): void => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MARKDOWN_IMAGE_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true
      }
    }
  ])
}

/**
 * 注册应用图片协议处理器。
 */
export const registerImageProtocolHandler = (): void => {
  protocol.handle(MARKDOWN_IMAGE_PROTOCOL, async (request) => {
    await restoreRequestedImageFromTrash(request.url)

    let filePath = resolveMarkdownImagePath(request.url)
    if (!filePath) {
      filePath = resolvePeopleAvatarPath(request.url)
    }

    if (!filePath) {
      return new Response('', { status: 404 })
    }

    return net.fetch(pathToFileURL(filePath).href)
  })
}
