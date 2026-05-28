import { net, protocol } from 'electron'
import { pathToFileURL } from 'node:url'
import {
  MARKDOWN_IMAGE_PROTOCOL,
  resolveMarkdownImagePath
} from '../markdownImages'

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
  protocol.handle(MARKDOWN_IMAGE_PROTOCOL, (request) => {
    const filePath = resolveMarkdownImagePath(request.url)

    if (!filePath) {
      return new Response('', { status: 404 })
    }

    return net.fetch(pathToFileURL(filePath).href)
  })
}
