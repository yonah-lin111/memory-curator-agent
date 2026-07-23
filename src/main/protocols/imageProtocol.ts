import { access, mkdir, rename } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { net, protocol } from "electron"
import {
  getAiChatTextDir,
  getAiChatTextTrashDir,
  getMarkdownImageDir,
  getMarkdownImageTrashDir,
} from "@/paths"
import {
  MARKDOWN_IMAGE_PROTOCOL,
  resolveAiChatImagePath,
  resolveAiChatTextFileName,
  resolveAiChatTextFilePath,
  resolveMarkdownImageFileName,
  resolveMarkdownImagePath,
  resolvePeopleAvatarPath,
  resolvePersonalAvatarPath,
} from "@/protocols/localImages"

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
 * 从回收目录恢复被预览重新引用的文本文件。
 */
const restoreRequestedTextFileFromTrash = async (requestUrl: string): Promise<void> => {
  const fileName = resolveAiChatTextFileName(requestUrl)

  if (!fileName) {
    return
  }

  const livePath = join(getAiChatTextDir(), fileName)

  if (await pathExists(livePath)) {
    return
  }

  const trashPath = join(getAiChatTextTrashDir(), fileName)

  if (!(await pathExists(trashPath))) {
    return
  }

  await mkdir(getAiChatTextDir(), { recursive: true })
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
        supportFetchAPI: true,
      },
    },
  ])
}

/**
 * 注册应用图片协议处理器。
 */
export const registerImageProtocolHandler = (): void => {
  protocol.handle(MARKDOWN_IMAGE_PROTOCOL, async (request) => {
    await restoreRequestedImageFromTrash(request.url)
    await restoreRequestedTextFileFromTrash(request.url)

    let filePath = resolveMarkdownImagePath(request.url)
    if (!filePath) {
      filePath = resolvePeopleAvatarPath(request.url)
    }
    if (!filePath) {
      filePath = resolvePersonalAvatarPath(request.url)
    }
    if (!filePath) {
      filePath = resolveAiChatImagePath(request.url)
    }
    if (!filePath) {
      filePath = resolveAiChatTextFilePath(request.url)
    }

    if (!filePath) {
      return new Response("", { status: 404 })
    }

    return net.fetch(pathToFileURL(filePath).href)
  })
}
