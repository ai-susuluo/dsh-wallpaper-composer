/**
 * Host half of the wallpaper bundle.
 *
 * The browser half cannot read local files, so this half exposes two read-only
 * routes under `/dsh-wallpaper`:
 *   GET /dsh-wallpaper/list?dir=<absolute folder>  -> image entries in that folder
 *   GET /dsh-wallpaper/file?path=<absolute file>   -> the file bytes (Range aware)
 *
 * Only media extensions are served, request origin is checked, and everything
 * stays read-only.
 */
import { open, readdir, readFile, stat } from 'node:fs/promises'
import { extname, isAbsolute, resolve } from 'node:path'

const PREFIX = '/dsh-wallpaper'
/** Empty by default: the Client half sends the folder the user picked. */
const DEFAULT_DIR = ''
const MAX_FILE_BYTES = 64 * 1024 * 1024

const CONTENT_TYPES = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.bmp', 'image/bmp'],
  ['.avif', 'image/avif'],
  ['.mp4', 'video/mp4'],
  ['.m4v', 'video/mp4'],
  ['.webm', 'video/webm'],
])

export const name = 'dsh-wallpaper'
export const inject = ['webServer']

/** Answer with a small JSON document. */
function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

/** Whether the extension is an image the picker should list. */
function isImagePath(path) {
  const ext = extname(path).toLowerCase()
  const type = CONTENT_TYPES.get(ext)
  return type !== undefined && type.startsWith('image/')
}

/** Whether the extension is any media this route serves (images and video). */
function isMediaPath(path) {
  return CONTENT_TYPES.has(extname(path).toLowerCase())
}

/**
 * @param ctx - Host context.
 * @param config - bundle row config (`defaultDir`).
 */
export function apply(ctx, config = {}) {
  const configuredDir =
    typeof config.defaultDir === 'string' && config.defaultDir.trim() !== ''
      ? config.defaultDir
      : DEFAULT_DIR

  /** Reject a cross-origin document trying to read local images. */
  const sameOrigin = (req) => {
    const origin = req.headers.origin
    if (origin === undefined) return true
    try {
      return origin === ctx.webServer.getOrigin()
    } catch {
      return true
    }
  }

  const listDir = async (req, res, url) => {
    const dir = url.searchParams.get('dir')?.trim() || configuredDir
    if (dir === '') {
      sendJson(res, 400, { code: 'missing-dir', message: '还没有选择壁纸文件夹' })
      return
    }
    if (!isAbsolute(dir)) {
      sendJson(res, 400, { code: 'bad-path', message: `文件夹必须是绝对路径：${dir}` })
      return
    }
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch (error) {
      sendJson(res, 404, {
        code: 'unreadable',
        message: `读不到文件夹 ${dir}：${error instanceof Error ? error.message : String(error)}`,
      })
      return
    }
    const files = []
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const fullPath = resolve(dir, entry.name)
      if (!isImagePath(fullPath)) continue
      let size = 0
      try {
        size = (await stat(fullPath)).size
      } catch {
        continue
      }
      files.push({ name: entry.name, path: fullPath, size })
    }
    files.sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'))
    sendJson(res, 200, { dir, files })
  }

  const sendFile = async (req, res, url) => {
    const path = url.searchParams.get('path')?.trim()
    if (path === undefined || path === '') {
      sendJson(res, 400, { code: 'missing-path', message: '缺少 path 参数' })
      return
    }
    if (!isAbsolute(path)) {
      sendJson(res, 400, { code: 'bad-path', message: `文件路径必须是绝对路径：${path}` })
      return
    }
    if (!isMediaPath(path)) {
      sendJson(res, 415, { code: 'not-media', message: '只支持 png / jpg / webp / gif / bmp / avif / mp4 / webm' })
      return
    }
    let info
    try {
      info = await stat(path)
    } catch {
      sendJson(res, 404, { code: 'missing-file', message: `文件不存在：${path}` })
      return
    }
    if (!info.isFile()) {
      sendJson(res, 404, { code: 'not-a-file', message: `不是文件：${path}` })
      return
    }
    if (info.size > MAX_FILE_BYTES) {
      sendJson(res, 413, { code: 'too-large', message: '文件太大（上限 64 MiB）' })
      return
    }
    const contentType = CONTENT_TYPES.get(extname(path).toLowerCase()) ?? 'application/octet-stream'
    const rangeHeader = req.headers.range

    /* Byte ranges let the browser fetch an mp4 index from the tail without
       downloading the whole clip first. */
    if (typeof rangeHeader === 'string' && rangeHeader.startsWith('bytes=')) {
      const [rawStart, rawEnd] = rangeHeader.slice(6).split('-')
      const start = rawStart === '' ? Math.max(0, info.size - Number(rawEnd)) : Number(rawStart)
      const end = rawStart === '' || rawEnd === '' ? info.size - 1 : Math.min(info.size - 1, Number(rawEnd))
      if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && start <= end) {
        const length = end - start + 1
        const handle = await open(path, 'r')
        try {
          const buffer = Buffer.alloc(length)
          await handle.read(buffer, 0, length, start)
          res.statusCode = 206
          res.setHeader('content-type', contentType)
          res.setHeader('content-range', `bytes ${start}-${end}/${info.size}`)
          res.setHeader('content-length', String(length))
          res.setHeader('accept-ranges', 'bytes')
          res.setHeader('cache-control', 'no-store')
          res.end(req.method === 'HEAD' ? undefined : buffer)
        } finally {
          await handle.close()
        }
        return
      }
    }

    const bytes = await readFile(path)
    res.statusCode = 200
    res.setHeader('content-type', contentType)
    res.setHeader('accept-ranges', 'bytes')
    res.setHeader('content-length', String(bytes.byteLength))
    res.setHeader('cache-control', 'no-store')
    res.end(req.method === 'HEAD' ? undefined : bytes)
  }

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: PREFIX,
        handler: async (req, res) => {
          if (!sameOrigin(req)) {
            res.statusCode = 403
            res.end()
            return
          }
          let url
          try {
            url = new URL(String(req.url ?? '/'), 'http://localhost')
          } catch {
            sendJson(res, 400, { code: 'bad-request', message: '无法解析请求地址' })
            return
          }
          const rest = url.pathname.slice(PREFIX.length).replace(/^\/+/, '')
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.setHeader('allow', 'GET, HEAD')
            res.statusCode = 405
            res.end()
            return
          }
          if (rest === 'list') {
            await listDir(req, res, url)
            return
          }
          if (rest === 'file') {
            await sendFile(req, res, url)
            return
          }
          sendJson(res, 404, { code: 'not-found', message: `未知路径：${url.pathname}` })
        },
      }),
    'wallpaper: local image routes',
  )
}
