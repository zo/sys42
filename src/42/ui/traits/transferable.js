import system from "../../system.js"
import Trait from "../classes/Trait.js"
import Dragger from "../classes/Dragger.js"
import inIframe from "../../core/env/realm/inIframe.js"
import getRects from "../../fabric/dom/getRects.js"
import { inRect } from "../../fabric/geometry/point.js"
import pick from "../../fabric/type/object/pick.js"
import unproxy from "../../fabric/type/object/unproxy.js"
import settings from "../../core/settings.js"
import ensureScopeSelector from "../../fabric/dom/ensureScopeSelector.js"
import removeItem from "../../fabric/type/array/removeItem.js"
import HoverScroll from "../classes/HoverScroll.js"
import setCursor from "../../fabric/dom/setCursor.js"
import keyboard from "../../core/devices/keyboard.js"
import listen from "../../fabric/event/listen.js"

const DEFAULTS = {
  selector: ":scope > *",
  distance: 0,
  useSelection: true,
  handlerSelector: undefined,

  itemsConfig: {
    name: "stack",
    startAnimation: { ms: 180 },
    revertAnimation: { ms: 180 },
    dropAnimation: { ms: 180 },
  },

  dropzoneConfig: {
    name: "slide",
    speed: 180,
  },
}

const configure = settings("ui.trait.transferable", DEFAULTS)

/* ipc
====== */

import ipc from "../../core/ipc.js"
import sanitize from "../../fabric/dom/sanitize.js"
import clear from "../../fabric/type/object/clear.js"

const iframeDropzones = []
const context = Object.create(null)

function serializeItems(obj, options) {
  const items = []

  const { originDropzone } = system.transfer.items

  for (const item of system.transfer.items) {
    const exportedItem = { ...item }
    exportedItem.target = exportedItem.target.cloneNode(true)
    originDropzone?.reviveItem(exportedItem)
    exportedItem.target = exportedItem.target.outerHTML
    exportedItem.ghost = exportedItem.ghost.outerHTML
    if (exportedItem.data) exportedItem.data = unproxy(exportedItem.data)
    if (options?.hideGhost) item.ghost.classList.add("hide")
    items.push(exportedItem)
  }

  const { dropzoneId } = system.transfer.items
  const { itemsConfig } = system.transfer
  return { ...obj, items, dropzoneId, itemsConfig }
}

function deserializeItems(items, parentX, parentY) {
  for (const item of items) {
    item.target =
      (context.isOriginIframe
        ? document.querySelector(`#${item.id}`)
        : undefined) ?? sanitize(item.target)
    item.ghost = sanitize(item.ghost)
    item.x += parentX
    item.y += parentY
  }
}

function cleanHints() {
  if (system.transfer.items) system.transfer.items.length = 0
  system.transfer.items = undefined
  system.transfer.currentZone = undefined
  system.transfer.effect = undefined
  setCursor()
}

class IframeDropzoneHint {
  constructor(iframe) {
    this.el = iframe
    this.bus = ipc.to(iframe, { ignoreUnresponsive: true })
    this.isIframe = true
    iframeDropzones.push(this)
  }

  scan() {}
  activate() {}

  halt() {
    this.bus.emit("42_TF_v_CLEANUP")
  }

  leave(x, y) {
    this.bus.emit("42_TF_v_LEAVE", { x, y })
  }

  enter(x, y) {
    const { x: parentX, y: parentY } = this.el.getBoundingClientRect()
    this.bus.emit("42_TF_v_ENTER", serializeItems({ x, y, parentX, parentY }))
  }

  dragover(x, y) {
    this.bus.emit("42_TF_v_DRAGOVER", { x, y })
  }

  async drop(x, y) {
    if (system.transfer.effect !== "none") system.transfer.items.removeGhosts()
    await this.bus.send("42_TF_v_DROP", { x, y })
  }

  async destroy() {
    // TODO: debug ipc Sender.destroy
    // this.bus.destroy()
  }
}

if (inIframe) {
  ipc
    .on(
      "42_TF_v_ENTER",
      async ({ x, y, items, itemsConfig, dropzoneId, parentX, parentY }) => {
        context.parentX = parentX
        context.parentY = parentY

        x -= context.parentX
        y -= context.parentY

        // TODO: use original items if context.isOriginIframe
        deserializeItems(items, context.parentX * -1, context.parentY * -1)

        const { itemsHint } = await makeHints({ itemsConfig })

        system.transfer.items = itemsHint
        system.transfer.itemsConfig = itemsConfig
        system.transfer.items.dropzoneId = dropzoneId

        system.transfer.items.start(x, y, items)
        activateZones(x, y)

        context.ready = true
      }
    )
    .on("42_TF_v_LEAVE", ({ x, y }) => {
      if (!context.ready) return
      if (system.transfer.currentZone) {
        x -= context.parentX
        y -= context.parentY
        system.transfer.currentZone.hoverScroll?.clear()
        system.transfer.currentZone.hint.leave(x, y)
        system.transfer.currentZone = undefined
      }
    })
    .on("42_TF_v_DRAGOVER", ({ x, y }) => {
      if (!context.ready) return
      x -= context.parentX
      y -= context.parentY
      setCurrentZone(x, y)
    })
    .on("42_TF_v_DROP", async ({ x, y }) => {
      if (!context.ready) return
      x -= context.parentX
      y -= context.parentY
      if (system.transfer.effect === "none") haltZones(x, y)
      else await haltZones(x, y)
    })
    .on("42_TF_v_REVERT", async ({ x, y }) => {
      if (!context.ready) return
      haltZones(x, y)
    })
    .on("42_TF_v_EFFECT", (effect) => {
      applyEffect(effect)
    })
    .on("42_TF_v_REQUEST_EFFECT", async (keys) => {
      context.keys = keys
      await setEffect({ bypassIframeIgnore: true })
      delete context.keys
      return system.transfer.effect
    })
    .on("42_TF_v_CLEANUP", () => {
      cleanHints()
      clear(context)
    })
} else {
  ipc
    .on("42_TF_^_REQUEST_EFFECT", (keys) => {
      context.keys = keys
      setEffect()
    })
    .on(
      "42_TF_^_START",
      async ({ x, y, items, dropzoneId, itemsConfig }, { iframe }) => {
        context.fromIframe = true

        const iframeRect = iframe.getBoundingClientRect()
        const { borderTopWidth, borderLeftWidth } = getComputedStyle(iframe)
        context.parentX = iframeRect.x + Number.parseInt(borderLeftWidth, 10)
        context.parentY = iframeRect.y + Number.parseInt(borderTopWidth, 10)

        x += context.parentX
        y += context.parentY
        deserializeItems(items, context.parentX, context.parentY)
        cleanHints()

        const { itemsHint } = await makeHints({ itemsConfig })
        system.transfer.items = itemsHint
        system.transfer.itemsConfig = itemsConfig
        system.transfer.items.dropzoneId = dropzoneId
        system.transfer.items.start(x, y, items)
        const zoneReady = activateZones(x, y)

        for (const item of system.transfer.items) {
          document.documentElement.append(item.ghost)
        }

        system.transfer.items.drag(x, y)

        await zoneReady

        for (const iframeDz of iframeDropzones) {
          if (iframeDz.el === iframe) {
            context.originIframeDropzone = iframeDz
            break
          }
        }
      }
    )
    .on("42_TF_^_DRAG", ({ x, y }) => {
      if (context.parentX && system.transfer.items) {
        x += context.parentX
        y += context.parentY
        setCurrentZone(x, y)
        system.transfer.items.drag(x, y)
      }
    })
    .on("42_TF_^_STOP", ({ x, y }) => {
      if (context.parentX && system.transfer.items) {
        if (system.transfer.currentZone?.hint.isIframe) {
          system.transfer.items.removeGhosts()
        } else if (context.originIframeDropzone) {
          context.originIframeDropzone.bus.emit("42_TF_v_REVERT", { x, y })
        }

        x += context.parentX
        y += context.parentY
        clear(context)
        haltZones(x, y)
      }
    })
}

/* effect
========= */

const keyToEffect = [
  ["Control", "copy"],
  ["Shift", "link"],
]

const effectToCursor = {
  none: "no-drop",
  move: "grabbing",
  copy: "copy",
  link: "alias",
}

function applyEffect(name) {
  system.transfer.effect = name

  if (context.fromIframe) {
    context.originIframeDropzone?.bus.emit("42_TF_v_EFFECT", name)
  }

  setCursor(effectToCursor[name])
}

async function setEffect(options) {
  if (inIframe && options?.bypassIframeIgnore !== true) return

  if (system.transfer.currentZone) {
    const keys = context.keys ?? keyboard.keys
    if (system.transfer.currentZone.hint.isIframe) {
      const effect = await system.transfer.currentZone.hint.bus.send(
        "42_TF_v_REQUEST_EFFECT",
        keys
      )
      applyEffect(effect ?? "none")
    } else {
      for (const [key, effect] of keyToEffect) {
        if (key in keys) return applyEffect(effect)
      }

      applyEffect("move")
    }
  } else {
    applyEffect("none")
  }
}

/* system
========= */

system.transfer = {
  dropzones: new Map(),
  items: undefined,
  currentZone: undefined,
  effect: undefined,
}

async function makeHints({ itemsConfig, dropzoneConfig }, el) {
  const undones = []

  if (itemsConfig) {
    undones.push(
      import(`./transferable/${itemsConfig.name}ItemsHint.js`) //
        .then((m) => m.default(itemsConfig))
    )
  }

  if (dropzoneConfig) {
    undones.push(
      import(`./transferable/${dropzoneConfig.name}DropzoneHint.js`) //
        .then((m) => m.default(el, dropzoneConfig))
    )
  }

  const [itemsHint, dropzoneHint] = await Promise.all(undones)
  if (dropzoneHint) itemsHint.dropzoneId = dropzoneHint.el.id
  return { itemsHint, dropzoneHint }
}

async function activateZones() {
  return getRects([
    ...system.transfer.dropzones.keys(),
    ...document.querySelectorAll("iframe"),
  ]).then((rects) => {
    system.transfer.zones = rects
    for (const rect of rects) {
      if (rect.target.localName === "iframe") {
        rect.hint = new IframeDropzoneHint(rect.target)
      } else {
        rect.hint = system.transfer.dropzones.get(rect.target)
        rect.hoverScroll = new HoverScroll(
          rect.target,
          rect.hint.config?.hoverScroll
        )
      }

      rect.hint.activate()
    }
  })
}

async function haltZones(x, y) {
  const { zones } = system.transfer

  if (system.transfer.currentZone) {
    await system.transfer.currentZone.hint.drop(x, y)
  }

  if (system.transfer.effect === "move") {
    await system.transfer.items.adopt(x, y)
  } else if (system.transfer.effect === "none") {
    await system.transfer.items.revert()
  } else {
    await system.transfer.items.fork(x, y)
  }

  for (const dropzone of zones) {
    dropzone.hint.halt()
    dropzone.hoverScroll?.clear()
  }

  cleanHints()
}

function setCurrentZone(x, y) {
  setEffect()
  const { zones } = system.transfer
  if (zones?.length > 0 === false) return

  const point = { x, y }

  if (system.transfer.currentZone) {
    if (inRect(point, system.transfer.currentZone)) {
      system.transfer.currentZone.hoverScroll?.update({ x, y }, async () => {
        await system.transfer.currentZone?.hint.scan()
        system.transfer.currentZone?.hint.dragover(x, y)
      })
      system.transfer.currentZone.hint.dragover(x, y)
      return
    }

    system.transfer.currentZone.hoverScroll?.clear()
    system.transfer.currentZone.hint.leave(x, y)
    system.transfer.currentZone = undefined
  }

  for (const dropzone of zones) {
    if (inRect(point, dropzone)) {
      system.transfer.currentZone = dropzone
      system.transfer.currentZone.hint.enter(x, y)
      system.transfer.currentZone.hoverScroll?.update({ x, y }, async () => {
        await system.transfer.currentZone?.hint.scan()
        system.transfer.currentZone?.hint.dragover(x, y)
      })
      system.transfer.currentZone.hint.dragover(x, y)
      return
    }
  }
}

class Transferable extends Trait {
  constructor(el, options) {
    super(el, options)

    if (options?.list) {
      this.list = options?.list
      delete options.list
    }

    this.config = configure(options)
    this.config.selector = ensureScopeSelector(this.config.selector, this.el)

    if (typeof this.config.itemsConfig === "string") {
      this.config.itemsConfig = { name: this.config.itemsConfig }
    }

    if (typeof this.config.dropzoneConfig === "string") {
      this.config.dropzoneConfig = { name: this.config.dropzoneConfig }
    }

    this.config.dropzoneConfig.signal ??= this.cancel.signal
    this.config.dropzoneConfig.selector ??= this.config.selector
    this.config.dropzoneConfig.indexChange ??= this.config.indexChange
    this.config.dropzoneConfig.list = this.list

    this.init()
  }

  async init() {
    const { signal } = this.cancel

    const { itemsConfig, dropzoneConfig } = this.config

    const { itemsHint, dropzoneHint } = await makeHints(
      { itemsConfig, dropzoneConfig },
      this.el
    )

    if (dropzoneHint) {
      system.transfer.dropzones.set(this.el, dropzoneHint)
    }

    let startPromise
    let startReady
    let forgetKeyevents

    this.dragger = new Dragger(this.el, {
      signal,
      applyTargetOffset: false,
      ...pick(this.config, ["selector", "distance", "useSelection"]),

      start: (x, y, e, target) => {
        if (
          this.config.handlerSelector &&
          !e.target.closest(this.config.handlerSelector)
        ) {
          return false
        }

        let targets
        startReady = false

        forgetKeyevents = listen({
          async "keydown || keyup"() {
            if (inIframe) ipc.emit("42_TF_^_REQUEST_EFFECT", keyboard.keys)
            else setEffect()
          },
        })

        cleanHints()
        system.transfer.items = itemsHint
        system.transfer.itemsConfig = itemsConfig

        if (this.config.useSelection) {
          const selectable = this.el[Trait.INSTANCES]?.selectable
          if (selectable) {
            selectable.ensureSelected(target)
            const { elements } = selectable
            targets = [...elements]
            removeItem(targets, target)
            targets.unshift(target)
            selectable.clear()
          } else targets = [target]
        } else targets = [target]

        startPromise = getRects(targets, {
          all: this.config.selector,
          includeMargins: true,
        }).then(async (rects) => {
          if (this.list) {
            for (const item of rects) item.data = this.list[item.index]
          }

          system.transfer.items.start(x, y, rects)

          if (inIframe) {
            context.isOriginIframe = true
            await ipc.send(
              "42_TF_^_START",
              serializeItems({ x, y }, { hideGhost: true })
            )
          } else {
            await activateZones(x, y)
            setCurrentZone(x, y)
          }

          system.transfer.items.drag(x, y)
          startReady = true
        })
      },

      drag(x, y) {
        if (!startReady) return
        if (inIframe) {
          ipc.emit("42_TF_^_DRAG", { x, y })
        } else {
          setCurrentZone(x, y)
          system.transfer.items.drag(x, y)
        }
      },

      async stop(x, y) {
        startReady = false
        setCursor()
        forgetKeyevents()
        await startPromise

        if (inIframe) ipc.emit("42_TF_^_STOP", { x, y })
        else await haltZones(x, y)

        for (const iframeDz of iframeDropzones) iframeDz.destroy()
        iframeDropzones.length = 0
      },
    })
  }
}

export function transferable(...args) {
  return new Transferable(...args)
}

export default transferable
