/**
 * Client half of the wallpaper bundle.
 *
 * Two registrations:
 *   - `settings.section` -> the Wallpaper settings page.
 *   - `shell.overlay`    -> an inert component that renders one <style> element
 *                          applying the chosen backgrounds to the shell columns.
 *
 * Images come from the package's Host half over `/dsh-wallpaper`. Blur and dim
 * are baked into an offscreen canvas so the shell's text stays untouched.
 *
 * Three layouts share one config document:
 *   - overall: one image across the whole window (painted on the frame).
 *   - regions: one image per shell area.
 *   - combos:  user-defined groups; each group owns one image, one dim/blur
 *              pair, and the areas it paints. A group covering every area
 *              paints the frame so the artwork stays continuous.
 */
window.__ModuleLoader__.load({
  id: 'dsh-wallpaper-composer',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'wallpaper'
    const API = '/dsh-wallpaper'
    const STORAGE_KEY = 'dsh-wallpaper:config:v3'
    const LEGACY_KEY = 'dsh-wallpaper:config:v2'
    /** Empty by default: the user picks a folder on first run. */
    const DEFAULT_DIR = ''
    const REGION_IDS = ['chat', 'sidebar', 'rightbar']
    const MODE_IDS = ['overall', 'regions', 'combos']
    const FIT_IDS = ['cover', 'contain', 'stretch', 'tile', 'center']

    const zh = {
      'nav': '壁纸',
      'title': '壁纸',
      'intro': '把本机图片铺到界面背景。可以整窗一张，也可以每个区域一张，或者自己拼组合。',
      'enabled': '启用壁纸',
      'dir.label': '壁纸文件夹',
      'dir.placeholder': '填写图片所在文件夹的绝对路径',
      'dir.empty': '先选一个壁纸文件夹。',
      'action.browse': '浏览…',
      'action.scan': '扫描',
      'action.scanning': '扫描中…',
      'action.reset': '全部重置',
      'action.clear': '清除图片',
      'action.new': '新建组合',
      'status.scanning': '正在扫描…',
      'status.found': '找到 {count} 张图片',
      'status.empty': '这个文件夹里没有可用图片',
      'mode.label': '设置方式',
      'mode.overall': '整体',
      'mode.regions': '分区域',
      'mode.combos': '组合',
      'mode.overall.hint': '一张图铺满整个窗口，图不会被切块。',
      'mode.regions.hint': '给每个区域单独挑图、单独调暗度和模糊。',
      'mode.combos.hint': '想怎么拼都行：一张图可以同时管几个区域，也能建多个组合。',
      'region.chat': '聊天区',
      'region.sidebar': '左侧栏',
      'region.rightbar': '右侧栏',
      'combo.title': '组合 {index}',
      'combo.list': '组合列表',
      'combo.unassigned': '还没分配区域，点上面的区域标签给这个组合划一块。',
      'combo.empty': '还没有组合，点「新建组合」。',
      'combo.hint': '点一张图，会应用给选中的对象。',
      'combo.current': '当前图片',
      'field.image': '当前图片',
      'field.none': '未选择',
      'field.dim': '暗度',
      'field.blur': '模糊',
      'fit.label': '铺法',
      'fit.cover': '填满',
      'fit.contain': '完整',
      'fit.stretch': '拉伸',
      'fit.tile': '平铺',
      'fit.center': '居中',
      'veil.label': '文字保护',
      'veil.hint': '给聊天区、左右侧栏、顶部栏都垫一层半透明底。越往右字越清楚、壁纸越淡；调到 0 就完全透出壁纸。',
      'note': '图片直接读自本机，不会上传到任何地方。',
      'empty.files': '先扫描文件夹，图片会出现在这里。',
    }

    const en = {
      'nav': 'Wallpaper',
      'title': 'Wallpaper',
      'intro': 'Paint the shell with local images. One image for everything, one per area, or your own combos.',
      'enabled': 'Enable wallpaper',
      'dir.label': 'Wallpaper folder',
      'dir.placeholder': 'Absolute path of the folder holding your images',
      'dir.empty': 'Pick a wallpaper folder first.',
      'action.browse': 'Browse…',
      'action.scan': 'Scan',
      'action.scanning': 'Scanning…',
      'action.reset': 'Reset all',
      'action.clear': 'Clear image',
      'action.new': 'New combo',
      'status.scanning': 'Scanning…',
      'status.found': 'Found {count} images',
      'status.empty': 'No usable images in this folder',
      'mode.label': 'Layout',
      'mode.overall': 'Whole window',
      'mode.regions': 'Per area',
      'mode.combos': 'Combos',
      'mode.overall.hint': 'One image across the whole window, never sliced.',
      'mode.regions.hint': 'Pick one image per area, each with its own dim and blur.',
      'mode.combos.hint': 'Mix freely: one image can cover several areas, and you can add as many combos as you like.',
      'region.chat': 'Conversation',
      'region.sidebar': 'Left sidebar',
      'region.rightbar': 'Right sidebar',
      'combo.title': 'Combo {index}',
      'combo.list': 'Combos',
      'combo.unassigned': 'No area yet — click an area tag above to assign one.',
      'combo.empty': 'No combos yet — use “New combo”.',
      'combo.hint': 'Click an image to apply it to the selected target.',
      'combo.current': 'Current image',
      'field.image': 'Current image',
      'field.none': 'Not set',
      'field.dim': 'Dim',
      'field.blur': 'Blur',
      'fit.label': 'Fit',
      'fit.cover': 'Fill',
      'fit.contain': 'Contain',
      'fit.stretch': 'Stretch',
      'fit.tile': 'Tile',
      'fit.center': 'Center',
      'veil.label': 'Text legibility',
      'veil.hint': 'Adds a translucent floor to the conversation, both sidebars, and the top bar. Higher values keep text readable and mute the artwork; 0 lets it through completely.',
      'note': 'Images are read from this machine and are never uploaded.',
      'empty.files': 'Scan the folder first; images will show up here.',
    }

    /* ------------------------------------------------------------------ */
    /* config store                                                        */
    /* ------------------------------------------------------------------ */

    const clampNumber = (value, min, max, fallback) => {
      const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
      if (!Number.isFinite(parsed)) return fallback
      return Math.min(max, Math.max(min, parsed))
    }

    const newId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

    const makeGroup = (areas) => ({ id: newId(), path: '', dim: 0.3, blur: 0, fit: 'cover', areas: [...areas] })

    const emptyArea = () => ({ enabled: false, path: '', dim: 0.25, blur: 0, fit: 'cover' })

    const emptyOverall = () => ({ path: '', dim: 0.3, blur: 0, fit: 'cover' })

    const defaultConfig = () => ({
      enabled: true,
      dir: DEFAULT_DIR,
      mode: 'overall',
      textVeil: 0.35,
      overall: emptyOverall(),
      regions: { chat: emptyArea(), sidebar: emptyArea(), rightbar: emptyArea() },
      groups: [makeGroup(REGION_IDS)],
    })

    const normalizeArea = (value) => {
      const base = emptyArea()
      if (value === null || typeof value !== 'object') return base
      return {
        enabled: value.enabled === true,
        path: typeof value.path === 'string' ? value.path : '',
        dim: clampNumber(value.dim, 0, 0.9, base.dim),
        blur: clampNumber(value.blur, 0, 60, base.blur),
        fit: FIT_IDS.includes(value.fit) ? value.fit : 'cover',
      }
    }

    const normalizeOverall = (value) => {
      const base = emptyOverall()
      if (value === null || typeof value !== 'object') return base
      return {
        path: typeof value.path === 'string' ? value.path : '',
        dim: clampNumber(value.dim, 0, 0.9, base.dim),
        blur: clampNumber(value.blur, 0, 60, base.blur),
        fit: FIT_IDS.includes(value.fit) ? value.fit : 'cover',
      }
    }

    const normalizeGroup = (value) => {
      if (value === null || typeof value !== 'object') return undefined
      return {
        id: typeof value.id === 'string' && value.id !== '' ? value.id : newId(),
        path: typeof value.path === 'string' ? value.path : '',
        dim: clampNumber(value.dim, 0, 0.9, 0.3),
        blur: clampNumber(value.blur, 0, 60, 0),
        fit: FIT_IDS.includes(value.fit) ? value.fit : 'cover',
        areas: Array.isArray(value.areas) ? value.areas.filter((area) => REGION_IDS.includes(area)) : [],
      }
    }

    /** One area belongs to at most one combo; later duplicates are dropped. */
    const normalizeConfig = (value) => {
      const base = defaultConfig()
      if (value === null || typeof value !== 'object') return base
      const groups = (Array.isArray(value.groups) ? value.groups : [])
        .map(normalizeGroup)
        .filter((group) => group !== undefined)
      const seen = new Set()
      for (const group of groups) {
        group.areas = group.areas.filter((area) => {
          if (seen.has(area)) return false
          seen.add(area)
          return true
        })
      }
      const regions = {}
      for (const id of REGION_IDS) {
        regions[id] = normalizeArea(value.regions === undefined ? undefined : value.regions[id])
      }
      let mode = MODE_IDS.includes(value.mode) ? value.mode : undefined
      if (mode === undefined) {
        const legacy = normalizeGroup(value.groups === undefined ? undefined : value.groups[0])
        const hasGroups = legacy !== undefined && legacy.path !== ''
        mode = hasGroups ? 'combos' : 'overall'
      }
      return {
        enabled: value.enabled !== false,
        dir: typeof value.dir === 'string' && value.dir.trim() !== '' ? value.dir : base.dir,
        mode,
        textVeil: clampNumber(value.textVeil, 0, 0.9, 0.35),
        overall: normalizeOverall(value.overall),
        regions,
        groups,
      }
    }

    /** Carry the previous overall/per-area document into this one. */
    const migrateLegacy = () => {
      try {
        const raw = window.localStorage.getItem(LEGACY_KEY)
        if (raw === null) return undefined
        const old = JSON.parse(raw)
        if (old === null || typeof old !== 'object') return undefined
        const dir = typeof old.dir === 'string' && old.dir.trim() !== '' ? old.dir : DEFAULT_DIR
        return {
          enabled: old.enabled !== false,
          dir,
          mode: old.mode === 'regions' ? 'regions' : 'overall',
          overall: normalizeOverall(old.overall),
          regions: {
            chat: normalizeArea(old.regions === undefined ? undefined : old.regions.chat),
            sidebar: normalizeArea(old.regions === undefined ? undefined : old.regions.sidebar),
            rightbar: normalizeArea(old.regions === undefined ? undefined : old.regions.rightbar),
          },
          groups: [makeGroup(REGION_IDS)],
        }
      } catch {
        return undefined
      }
    }

    const readConfig = () => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw === null) {
          const migrated = migrateLegacy()
          const result = normalizeConfig(migrated === undefined ? defaultConfig() : migrated)
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(result))
          } catch {
            /* the in-memory value still serves this session */
          }
          return result
        }
        return normalizeConfig(JSON.parse(raw))
      } catch {
        return defaultConfig()
      }
    }

    let config = readConfig()
    const listeners = new Set()

    const writeConfig = (next) => {
      config = normalizeConfig(next)
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
      } catch {
        /* A full or blocked storage keeps the in-memory value for this session. */
      }
      for (const listener of listeners) listener(config)
    }

    const subscribeConfig = (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }

    /* ------------------------------------------------------------------ */
    /* image composition                                                   */
    /* ------------------------------------------------------------------ */

    const composedCache = new Map()
    const CACHE_LIMIT = 12

    const fileUrl = (path) => `${API}/file?path=${encodeURIComponent(path)}`

    const baseName = (path) => {
      const cleaned = String(path).replace(/[\\/]+$/, '')
      const at = Math.max(cleaned.lastIndexOf('\\'), cleaned.lastIndexOf('/'))
      return at === -1 ? cleaned : cleaned.slice(at + 1)
    }

    const loadImage = (src) =>
      new Promise((resolveImage, reject) => {
        const image = new Image()
        image.decoding = 'async'
        image.onload = () => resolveImage(image)
        image.onerror = () => reject(new Error('image failed'))
        image.src = src
      })

    const remember = (key, value) => {
      if (composedCache.size >= CACHE_LIMIT) composedCache.clear()
      composedCache.set(key, value)
      return value
    }

    /** CSS `background` tail for one fit mode. */
    const fitSuffix = (fit, fixed) => {
      const attachment = fixed ? ' fixed' : ''
      if (fit === 'contain') return ` center center / contain no-repeat${attachment}`
      if (fit === 'stretch') return ` center center / 100% 100% no-repeat${attachment}`
      if (fit === 'tile') return ` left top / auto repeat${attachment}`
      if (fit === 'center') return ` center center / auto no-repeat${attachment}`
      return ` center center / cover no-repeat${attachment}`
    }

    /** Translucent theme-color floor that keeps text readable over artwork. */
    const veilPercent = (veil) => Math.round(Math.min(0.9, Math.max(0, Number.isFinite(veil) ? veil : 0)) * 100)

    const veilColor = (veil) => {
      const percent = veilPercent(veil)
      return percent <= 0 ? '' : `color-mix(in srgb, var(--dsw-alias-bg-base) ${percent}%, transparent)`
    }

    /** A full-size gradient layer painted over the image. */
    const veilLayer = (veil) => {
      const color = veilColor(veil)
      return color === '' ? '' : `linear-gradient(${color}, ${color}) center center / cover no-repeat`
    }

    /** Background declaration for a docked pane: translucent, never blocked. */
    const paneVeil = (veil) => {
      const color = veilColor(veil)
      return `background:${color === '' ? 'transparent' : color} !important`
    }

    /**
     * One CSS `background` value: the image under a text-legibility veil, with
     * blur and dim baked into a canvas when either is non-zero.
     */
    const backgroundValue = async (area, fixed, veil) => {
      const suffix = fitSuffix(area.fit, fixed)
      const layer = veilLayer(veil)
      const prefix = layer === '' ? '' : `${layer}, `
      const plain = `${prefix}url("${fileUrl(area.path)}")${suffix}`
      if (area.blur <= 0 && area.dim <= 0) return plain
      const key = `${area.path}|${area.blur}|${area.dim}|${area.fit}|${veilPercent(veil)}|${fixed ? 'f' : 's'}`
      const cached = composedCache.get(key)
      if (cached !== undefined) return cached
      try {
        const image = await loadImage(fileUrl(area.path))
        const naturalWidth = image.naturalWidth > 0 ? image.naturalWidth : 1920
        const naturalHeight = image.naturalHeight > 0 ? image.naturalHeight : 1080
        const scale = Math.min(1, 1920 / naturalWidth)
        const width = Math.max(1, Math.round(naturalWidth * scale))
        const height = Math.max(1, Math.round(naturalHeight * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        const blurPx = area.blur * scale
        if (blurPx > 0) {
          const pad = Math.ceil(blurPx * 3)
          context.filter = `blur(${blurPx}px)`
          context.drawImage(image, -pad, -pad, width + pad * 2, height + pad * 2)
          context.filter = 'none'
        } else {
          context.drawImage(image, 0, 0, width, height)
        }
        if (area.dim > 0) {
          context.fillStyle = `rgba(0, 0, 0, ${area.dim})`
          context.fillRect(0, 0, width, height)
        }
        return remember(key, `${prefix}url("${canvas.toDataURL('image/jpeg', 0.86)}")${suffix}`)
      } catch {
        return plain
      }
    }

    /**
     * The composer seat normally fades the message scroller into the theme base
     * color; over artwork that fade is the opaque band under the input. Keep the
     * fade but let the wallpaper through it.
     */
    const COMPOSER_VEIL =
      'linear-gradient(180deg, color-mix(in srgb, var(--dsw-alias-bg-base) 0%, transparent) 0%, ' +
      'color-mix(in srgb, var(--dsw-alias-bg-base) 55%, transparent) 40%, ' +
      'color-mix(in srgb, var(--dsw-alias-bg-base) 78%, transparent) 100%)'

    const COMPOSER_CSS =
      '._727C8a_root[data-phase=active] ._727C8a_composerSeat,' +
      '._727C8a_embeddedBody[data-content-phase=active] ._727C8a_composerSeat' +
      `{background:${COMPOSER_VEIL} !important}`

    const coversAll = (group) => REGION_IDS.every((area) => group.areas.includes(area))

    const hasImage = (area) => area !== undefined && area.enabled === true && area.path !== ''

    /** Paint the whole frame once, with every column transparent over it. */
    const frameRules = async (area, veil) => {
      const background = await backgroundValue(area, true, veil)
      return [
        `.MnhYfG_frame{background:${background} !important}`,
        '.MnhYfG_centerCol,.MnhYfG_bottomRow,.MnhYfG_sidebarCol,.MnhYfG_rightbarCol{background:transparent !important}',
        '.bJOniG_root,._727C8a_root{background:transparent !important}',
        // Every main-panel page (schedule, jobs, memory, plugins, …) paints its
        // own root; the slot anchor is `display:contents`, so its first children
        // are those page roots.
        '[data-slot="main"] > *{background:transparent !important}',
        '[data-sidebar-right-panel]{background:transparent !important}',
        `[data-sidebar-right-panel] [data-dockkit-pane]{${paneVeil(veil)}}`,
        COMPOSER_CSS,
        '[data-windows-titlebar] .MnhYfG_frame:before{background:transparent !important}',
      ]
    }

    const areaRules = async (area, source, veil) => {
      const background = await backgroundValue(source, false, veil)
      if (area === 'chat') {
        return [`._727C8a_root{background:${background} !important}`, COMPOSER_CSS]
      }
      if (area === 'sidebar') {
        return [
          `.MnhYfG_sidebarCol{background:${background} !important}`,
          '.bJOniG_root{background:transparent !important}',
        ]
      }
      if (area === 'rightbar') {
        // The right panel keeps its box while collapsed (its contents are what
        // hides), and the column lets it overflow — painting the collapsed box
        // would smear wallpaper over the conversation.
        return [
          `[data-sidebar-right-panel][data-sidebar-right-open]{background:${background} !important}`,
          `[data-sidebar-right-panel][data-sidebar-right-open] [data-dockkit-pane]{${paneVeil(veil)}}`,
        ]
      }
      return []
    }

    const buildStyle = async (current) => {
      if (!current.enabled) return ''
      const chunks = []
      const veil = current.textVeil

      if (current.mode === 'overall') {
        if (current.overall.path !== '') chunks.push(...(await frameRules(current.overall, veil)))
      } else if (current.mode === 'regions') {
        for (const area of REGION_IDS) {
          const source = current.regions[area]
          if (!hasImage(source)) continue
          chunks.push(...(await areaRules(area, source, veil)))
        }
      } else {
        for (const group of current.groups) {
          if (group.path === '' || group.areas.length === 0) continue
          if (coversAll(group)) {
            chunks.push(...(await frameRules(group, veil)))
            continue
          }
          for (const area of group.areas) chunks.push(...(await areaRules(area, group, veil)))
        }
      }

      return chunks.join('\n')
    }

    /* ------------------------------------------------------------------ */
    /* always-on style applier                                             */
    /* ------------------------------------------------------------------ */

    function WallpaperStage() {
      const [css, setCss] = React.useState('')
      React.useEffect(() => {
        let disposed = false
        let timer
        let sequence = 0
        const render = async () => {
          const ticket = ++sequence
          const next = await buildStyle(config)
          if (disposed || ticket !== sequence) return
          setCss(next)
        }
        const unsubscribe = subscribeConfig(() => {
          clearTimeout(timer)
          timer = setTimeout(render, 300)
        })
        render()
        return () => {
          disposed = true
          clearTimeout(timer)
          unsubscribe()
        }
      }, [])
      return h('style', { 'data-dsh-wallpaper': '' }, css)
    }

    /* ------------------------------------------------------------------ */
    /* settings page                                                       */
    /* ------------------------------------------------------------------ */

    const PAGE_CSS = `
.wp-section{display:flex;flex-direction:column;width:100%;max-width:760px;color:var(--dsw-alias-label-primary)}
.wp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:16px 0}
.wp-title{margin:0;font-size:18px;font-weight:600;line-height:26px}
.wp-intro{margin:6px 0 0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
.wp-switch{display:inline-flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;white-space:nowrap}
.wp-row{display:flex;gap:8px;align-items:center;padding:8px 0 4px}
.wp-label{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;display:block;margin-bottom:6px}
.wp-input{box-sizing:border-box;flex:1;min-width:0;height:34px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}
.wp-input:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:0}
.wp-button{box-sizing:border-box;height:34px;padding:0 14px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}
.wp-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.wp-button:disabled{opacity:.45;cursor:default}
.wp-buttonSmall{height:28px;padding:0 10px;font-size:12px}
.wp-status{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;padding:2px 0 0;min-height:18px}
.wp-group{border-top:.5px solid var(--dsw-alias-border-l2);margin-top:10px;padding-top:14px}
.wp-groupHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px;flex-wrap:wrap}
.wp-groupHead h3{margin:0;font-size:14px;font-weight:500;line-height:22px}
.wp-segment{display:inline-flex;padding:3px;gap:2px;border-radius:999px;background:var(--dsw-alias-bg-module-platform)}
.wp-segment button{box-sizing:border-box;height:28px;padding:0 14px;border:none;border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;cursor:pointer}
.wp-segment button[data-active=true]{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px #0000001a}
.wp-tabs{display:flex;gap:6px;padding:6px 0 4px;flex-wrap:wrap}
.wp-tab{box-sizing:border-box;height:30px;padding:0 14px;border:.5px solid var(--dsw-alias-border-l3);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;cursor:pointer}
.wp-tab:hover{background:var(--dsw-alias-interactive-bg-hover)}
.wp-tab[data-active=true]{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l4)}
.wp-tab .wp-dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px;background:var(--dsw-alias-state-success-primary);vertical-align:middle}
.wp-combo{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);padding:12px 14px;margin-bottom:10px;cursor:pointer;background:var(--dsw-alias-bg-layer-1);transition:border-color .12s}
.wp-combo:hover{border-color:var(--dsw-alias-border-l4)}
.wp-combo[data-active=true]{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 1px var(--dsw-alias-brand-primary)}
.wp-comboTop{display:flex;align-items:center;justify-content:space-between;gap:12px}
.wp-comboTitle{font-size:13px;font-weight:500;line-height:20px}
.wp-comboMeta{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin-left:8px;overflow-wrap:anywhere}
.wp-areas{display:flex;gap:6px;flex-wrap:wrap;padding:8px 0 2px}
.wp-chip{box-sizing:border-box;height:26px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l3);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
.wp-chip:hover{background:var(--dsw-alias-interactive-bg-hover)}
.wp-chip[data-on=true]{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l4)}
.wp-chip[data-on=true]:before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px;background:var(--dsw-alias-state-success-primary);vertical-align:middle}
.wp-comboControls{display:flex;flex-direction:column;gap:8px;padding:6px 0 2px}
.wp-slider{display:flex;align-items:center;gap:12px}
.wp-slider .wp-label{margin:0;width:40px;flex:none}
.wp-slider input[type=range]{flex:1;min-width:0;accent-color:var(--dsw-alias-brand-primary)}
.wp-fits{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.wp-fits .wp-label{margin:0;width:40px;flex:none}
.wp-fits .wp-chip[data-on=true]:before{display:none}
.wp-value{width:56px;text-align:right;color:var(--dsw-alias-label-secondary);font-size:12px;font-variant-numeric:tabular-nums}
.wp-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin:4px 0 0;overflow-wrap:anywhere}
.wp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:8px;padding:12px 0}
.wp-cell{position:relative;box-sizing:border-box;padding:0;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);overflow:hidden;cursor:pointer;background:var(--dsw-alias-bg-layer-1);aspect-ratio:16/10}
.wp-cell img{width:100%;height:100%;object-fit:cover;display:block}
.wp-cell:hover{border-color:var(--dsw-alias-border-l4)}
.wp-cell[data-selected=true]{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 1px var(--dsw-alias-brand-primary)}
.wp-cellName{position:absolute;inset:auto 0 0 0;padding:3px 6px;background:linear-gradient(transparent,#000000b3);color:#fff;font-size:10px;line-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}
.wp-empty{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px;padding:8px 0}
.wp-foot{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0 24px;border-top:.5px solid var(--dsw-alias-border-l2);margin-top:8px}
.wp-note{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.wp-link{background:none;border:none;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px;cursor:pointer;padding:0}
.wp-link:hover{color:var(--dsw-alias-state-error-primary)}
`

    function WallpaperSection({ t, browseDirectory }) {
      const [current, setCurrent] = React.useState(config)
      const [dir, setDir] = React.useState(config.dir)
      const [files, setFiles] = React.useState([])
      const [status, setStatus] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [region, setRegion] = React.useState('chat')
      const [activeId, setActiveId] = React.useState(() => (config.groups[0] === undefined ? '' : config.groups[0].id))

      React.useEffect(() => subscribeConfig(setCurrent), [])

      const scan = React.useCallback(
        async (target) => {
          const folder = typeof target === 'string' ? target.trim() : DEFAULT_DIR
          if (folder === '') {
            setFiles([])
            setStatus(t('dir.empty'))
            return
          }
          setBusy(true)
          setStatus(t('status.scanning'))
          try {
            const response = await fetch(`${API}/list?dir=${encodeURIComponent(folder)}`)
            const data = await response.json()
            if (!response.ok) {
              throw new Error(typeof data.message === 'string' ? data.message : `HTTP ${response.status}`)
            }
            const list = Array.isArray(data.files) ? data.files : []
            setFiles(list)
            setStatus(list.length === 0 ? t('status.empty') : t('status.found', { count: list.length }))
            const next = readConfig()
            writeConfig({ ...next, dir: typeof data.dir === 'string' ? data.dir : folder })
          } catch (error) {
            setFiles([])
            setStatus(error instanceof Error ? error.message : String(error))
          } finally {
            setBusy(false)
          }
        },
        [t],
      )

      React.useEffect(() => {
        const initial = readConfig().dir
        if (initial !== '') scan(initial)
        else setStatus(t('dir.empty'))
        // Runs once on mount; the scan itself persists the resolved folder.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      const browse = async () => {
        if (typeof browseDirectory !== 'function') return
        try {
          const picked = await browseDirectory()
          if (typeof picked === 'string' && picked.trim() !== '') {
            setDir(picked)
            await scan(picked)
          }
        } catch (error) {
          setStatus(error instanceof Error ? error.message : String(error))
        }
      }

      const setMode = (mode) => {
        const next = readConfig()
        if (next.mode === mode) return
        writeConfig({ ...next, mode })
      }

      const patchOverall = (patch) => {
        const next = readConfig()
        writeConfig({ ...next, overall: { ...next.overall, ...patch } })
      }

      const patchRegion = (patch) => {
        const next = readConfig()
        writeConfig({ ...next, regions: { ...next.regions, [region]: { ...next.regions[region], ...patch } } })
      }

      const activeGroup = current.groups.find((group) => group.id === activeId) ?? current.groups[0]

      const patchGroup = (id, patch) => {
        const next = readConfig()
        writeConfig({
          ...next,
          groups: next.groups.map((group) => (group.id === id ? { ...group, ...patch } : group)),
        })
      }

      const toggleArea = (id, area) => {
        const next = readConfig()
        const target = next.groups.find((group) => group.id === id)
        if (target === undefined) return
        const owned = target.areas.includes(area)
        const groups = next.groups.map((group) => {
          if (group.id === id) {
            return {
              ...group,
              areas: owned ? group.areas.filter((item) => item !== area) : [...group.areas, area],
            }
          }
          if (!owned) return { ...group, areas: group.areas.filter((item) => item !== area) }
          return group
        })
        writeConfig({ ...next, groups })
      }

      const addGroup = () => {
        const next = readConfig()
        const group = makeGroup([])
        writeConfig({ ...next, groups: [...next.groups, group] })
        setActiveId(group.id)
      }

      const removeGroup = (id) => {
        const next = readConfig()
        const groups = next.groups.filter((group) => group.id !== id)
        writeConfig({ ...next, groups })
        if (activeId === id) setActiveId(groups[0] === undefined ? '' : groups[0].id)
      }

      /* ---- what the image grid targets, per mode ---- */

      const target =
        current.mode === 'overall'
          ? current.overall
          : current.mode === 'regions'
            ? current.regions[region]
            : activeGroup

      const selectedPath = target === undefined ? '' : target.path
      const dim = target === undefined ? 0 : target.dim
      const blur = target === undefined ? 0 : target.blur

      const applyFile = (file) => {
        if (current.mode === 'overall') {
          patchOverall({ path: file.path })
          return
        }
        if (current.mode === 'regions') {
          patchRegion({ enabled: true, path: file.path })
          return
        }
        if (activeGroup === undefined) return
        patchGroup(activeGroup.id, { path: file.path })
      }

      const patchDim = (next) => {
        if (current.mode === 'overall') patchOverall({ dim: next })
        else if (current.mode === 'regions') patchRegion({ dim: next })
        else if (activeGroup !== undefined) patchGroup(activeGroup.id, { dim: next })
      }

      const patchBlur = (next) => {
        if (current.mode === 'overall') patchOverall({ blur: next })
        else if (current.mode === 'regions') patchRegion({ blur: next })
        else if (activeGroup !== undefined) patchGroup(activeGroup.id, { blur: next })
      }

      const patchFit = (next) => {
        if (current.mode === 'overall') patchOverall({ fit: next })
        else if (current.mode === 'regions') patchRegion({ fit: next })
        else if (activeGroup !== undefined) patchGroup(activeGroup.id, { fit: next })
      }

      const clearTarget = () => {
        if (current.mode === 'overall') patchOverall({ path: '' })
        else if (current.mode === 'regions') patchRegion({ enabled: false, path: '' })
        else if (activeGroup !== undefined) patchGroup(activeGroup.id, { path: '' })
      }

      const targetLabel =
        current.mode === 'overall'
          ? t('mode.overall')
          : current.mode === 'regions'
            ? t(`region.${region}`)
            : activeGroup === undefined
              ? t('combo.list')
              : t('combo.title', { index: current.groups.indexOf(activeGroup) + 1 })

      const sliders = h(
        'div',
        { className: 'wp-comboControls' },
        h(
          'div',
          { className: 'wp-slider' },
          h('span', { className: 'wp-label' }, t('field.dim')),
          h('input', {
            type: 'range',
            min: 0,
            max: 0.9,
            step: 0.05,
            value: dim,
            onChange: (event) => patchDim(Number(event.currentTarget.value)),
          }),
          h('span', { className: 'wp-value' }, `${Math.round(dim * 100)}%`),
        ),
        h(
          'div',
          { className: 'wp-slider' },
          h('span', { className: 'wp-label' }, t('field.blur')),
          h('input', {
            type: 'range',
            min: 0,
            max: 60,
            step: 1,
            value: blur,
            onChange: (event) => patchBlur(Number(event.currentTarget.value)),
          }),
          h('span', { className: 'wp-value' }, `${Math.round(blur)}px`),
        ),
        h(
          'div',
          { className: 'wp-fits' },
          h('span', { className: 'wp-label' }, t('fit.label')),
          ...FIT_IDS.map((id) =>
            h(
              'button',
              {
                key: id,
                type: 'button',
                className: 'wp-chip',
                'data-on': (target === undefined ? 'cover' : target.fit) === id,
                onClick: () => patchFit(id),
              },
              t(`fit.${id}`),
            ),
          ),
        ),
        selectedPath === ''
          ? null
          : h(
              'div',
              null,
              h('button', { type: 'button', className: 'wp-button wp-buttonSmall', onClick: clearTarget }, t('action.clear')),
            ),
      )

      const grid = h(
        'div',
        { className: 'wp-grid' },
        ...files.map((file) =>
          h(
            'button',
            {
              key: file.path,
              type: 'button',
              className: 'wp-cell',
              'data-selected': selectedPath === file.path,
              title: file.name,
              onClick: () => applyFile(file),
            },
            h('img', { src: `${API}/file?path=${encodeURIComponent(file.path)}`, alt: '', loading: 'lazy' }),
            h('span', { className: 'wp-cellName' }, file.name),
          ),
        ),
      )

      const modeBar = h(
        'div',
        { className: 'wp-segment' },
        ...MODE_IDS.map((id) =>
          h(
            'button',
            { key: id, type: 'button', 'data-active': current.mode === id, onClick: () => setMode(id) },
            t(`mode.${id}`),
          ),
        ),
      )

      let panel
      if (current.mode === 'overall') {
        panel = h(
          'div',
          { className: 'wp-group' },
          h('p', { className: 'wp-hint' }, t('mode.overall.hint')),
          sliders,
        )
      } else if (current.mode === 'regions') {
        panel = h(
          'div',
          { className: 'wp-group' },
          h('p', { className: 'wp-hint' }, t('mode.regions.hint')),
          h(
            'div',
            { className: 'wp-tabs', role: 'tablist' },
            ...REGION_IDS.map((id) =>
              h(
                'button',
                {
                  key: id,
                  type: 'button',
                  role: 'tab',
                  'aria-selected': region === id,
                  className: 'wp-tab',
                  'data-active': region === id,
                  onClick: () => setRegion(id),
                },
                hasImage(current.regions[id]) ? h('span', { className: 'wp-dot' }) : null,
                t(`region.${id}`),
              ),
            ),
          ),
          sliders,
        )
      } else {
        panel = h(
          'div',
          { className: 'wp-group' },
          h('p', { className: 'wp-hint' }, t('mode.combos.hint')),
          h(
            'div',
            { className: 'wp-groupHead' },
            h('h3', null, t('combo.list')),
            h('button', { type: 'button', className: 'wp-button wp-buttonSmall', onClick: addGroup }, t('action.new')),
          ),
          current.groups.length === 0 ? h('div', { className: 'wp-empty' }, t('combo.empty')) : null,
          ...current.groups.map((group, index) =>
            h(
              'div',
              {
                key: group.id,
                className: 'wp-combo',
                'data-active': activeGroup !== undefined && activeGroup.id === group.id,
                onClick: () => setActiveId(group.id),
              },
              h(
                'div',
                { className: 'wp-comboTop' },
                h(
                  'div',
                  null,
                  h('span', { className: 'wp-comboTitle' }, t('combo.title', { index: index + 1 })),
                  h('span', { className: 'wp-comboMeta' }, group.path === '' ? t('field.none') : baseName(group.path)),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'wp-link',
                    onClick: (event) => {
                      event.stopPropagation()
                      removeGroup(group.id)
                    },
                  },
                  t('action.delete'),
                ),
              ),
              h(
                'div',
                { className: 'wp-areas' },
                ...REGION_IDS.map((area) =>
                  h(
                    'button',
                    {
                      key: area,
                      type: 'button',
                      className: 'wp-chip',
                      'data-on': group.areas.includes(area),
                      onClick: (event) => {
                        event.stopPropagation()
                        toggleArea(group.id, area)
                      },
                    },
                    t(`region.${area}`),
                  ),
                ),
              ),
              group.areas.length === 0 ? h('p', { className: 'wp-hint' }, t('combo.unassigned')) : null,
              h(
                'div',
                { onClick: (event) => event.stopPropagation() },
                !(activeGroup !== undefined && activeGroup.id === group.id)
                  ? null
                  : sliders,
              ),
            ),
          ),
        )
      }

      return h(
        'div',
        { className: 'wp-section' },
        h(
          'div',
          { className: 'wp-head' },
          h(
            'div',
            null,
            h('h2', { className: 'wp-title' }, t('title')),
            h('p', { className: 'wp-intro' }, t('intro')),
          ),
          h(
            'label',
            { className: 'wp-switch' },
            h('input', {
              type: 'checkbox',
              checked: current.enabled,
              onChange: (event) => {
                const next = readConfig()
                writeConfig({ ...next, enabled: event.currentTarget.checked })
              },
            }),
            h('span', null, t('enabled')),
          ),
        ),
        h('label', { className: 'wp-label', htmlFor: 'wp-dir' }, t('dir.label')),
        h(
          'div',
          { className: 'wp-row' },
          h('input', {
            id: 'wp-dir',
            className: 'wp-input',
            value: dir,
            spellCheck: false,
            placeholder: t('dir.placeholder'),
            onChange: (event) => setDir(event.currentTarget.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') scan(dir)
            },
          }),
          typeof browseDirectory === 'function'
            ? h('button', { type: 'button', className: 'wp-button', onClick: browse }, t('action.browse'))
            : null,
          h(
            'button',
            { type: 'button', className: 'wp-button', disabled: busy, onClick: () => scan(dir) },
            busy ? t('action.scanning') : t('action.scan'),
          ),
        ),
        h('div', { className: 'wp-status' }, status),
        h(
          'div',
          { className: 'wp-group' },
          h(
            'div',
            { className: 'wp-slider' },
            h('span', { className: 'wp-label', style: { width: '88px' } }, t('veil.label')),
            h('input', {
              type: 'range',
              min: 0,
              max: 0.9,
              step: 0.05,
              value: current.textVeil,
              onChange: (event) => {
                const next = readConfig()
                writeConfig({ ...next, textVeil: Number(event.currentTarget.value) })
              },
            }),
            h('span', { className: 'wp-value' }, `${Math.round(current.textVeil * 100)}%`),
          ),
          h('p', { className: 'wp-hint' }, t('veil.hint')),
        ),
        h(
          'div',
          { className: 'wp-group' },
          h('div', { className: 'wp-groupHead' }, h('h3', null, t('mode.label')), modeBar),
        ),
        panel,
        h(
          'div',
          { className: 'wp-group' },
          h(
            'div',
            { className: 'wp-groupHead' },
            h('h3', null, t('combo.current')),
            h('span', { className: 'wp-note' }, `${targetLabel}${selectedPath === '' ? '' : ` · ${baseName(selectedPath)}`}`),
          ),
          files.length === 0 ? h('div', { className: 'wp-empty' }, t('empty.files')) : h('p', { className: 'wp-hint' }, t('combo.hint')),
          grid,
        ),
        h(
          'div',
          { className: 'wp-foot' },
          h('span', { className: 'wp-note' }, t('note')),
          h(
            'button',
            { type: 'button', className: 'wp-button', onClick: () => writeConfig(defaultConfig()) },
            t('action.reset'),
          ),
        ),
        h('style', null, PAGE_CSS),
      )
    }

    /* ------------------------------------------------------------------ */
    /* plugin body                                                         */
    /* ------------------------------------------------------------------ */

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'wallpaper: locale dictionaries')

        let pickDirectory
        ctx.inject(['uiWorkspace'], (scope) => {
          pickDirectory = () => scope.uiWorkspace.pickDirectory()
          return () => {
            pickDirectory = undefined
          }
        })

        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'wallpaper',
              order: 30,
              label: () => ctx.locale.bind(NS)('nav'),
              locale: NS,
              inject: () => ({
                browseDirectory: async () => (pickDirectory === undefined ? null : pickDirectory()),
              }),
            },
            WallpaperSection,
          ),
        )

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'wallpaper-stage',
            },
            WallpaperStage,
          ),
        )
      },
    }
  },
})
