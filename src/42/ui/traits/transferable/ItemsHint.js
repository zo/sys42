import system from "../../../system.js"
import Trait from "../../classes/Trait.js"
import inIframe from "../../../core/env/realm/inIframe.js"
import uid from "../../../core/uid.js"
import ghostify from "../../../fabric/dom/ghostify.js"
import paint from "../../../fabric/type/promise/paint.js"
import { animateTo, animateFrom } from "../../../fabric/dom/animate.js"

function restoreSelection(el, droppeds) {
  const selectable = el[Trait.INSTANCES]?.selectable
  if (selectable) {
    selectable.clear()
    for (const item of droppeds) {
      const target = item.target ?? item
      selectable.add(target)
    }
  }
}

export class ItemsHint extends Array {
  constructor(options) {
    super()
    this.config = { ...options }
  }

  startAnimation() {
    return this.config.startAnimation
  }
  revertAnimation() {
    return this.config.revertAnimation
  }
  adoptAnimation() {
    return this.config.adoptAnimation
  }

  removeGhosts() {
    for (const item of this) item.ghost.remove()
  }
  hideTargets() {
    for (const item of this) item.target.classList.add("hide")
  }

  start(x, y, items) {
    this.length = 0
    for (const item of items) {
      this.push(item)

      item.offsetX ??= x - item.x
      item.offsetY ??= y - item.y

      item.target.id ||= uid()
      item.id = item.target.id

      if (!item.ghost) {
        item.ghost = ghostify(item.target, { rect: item })
        document.documentElement.append(item.ghost)
      }

      if (this.config.startAnimation && items.length > 1) {
        animateFrom(item.ghost, {
          translate: `${item.x}px ${item.y}px`,
          ...this.startAnimation(item),
        })
      }
    }

    this.drag(x, y)
  }

  drag() {
    this.currentZone = system.transfer.currentZone?.hint
  }

  get originDropzone() {
    const { dropzoneId } = this
    const dropzoneTarget = document.querySelector(`#${dropzoneId}`)
    return dropzoneTarget
      ? system.transfer.dropzones.get(dropzoneTarget)
      : undefined
  }

  async revert(items = this) {
    const undones = []
    for (const item of items) {
      if (this.config.revertAnimation) {
        undones.push(
          animateTo(item.ghost, {
            translate: `${item.x}px ${item.y}px`,
            ...this.revertAnimation(item),
          }).then(() => {
            item.ghost.remove()
          })
        )
      } else {
        item.ghost.remove()
      }
    }

    const { originDropzone } = this
    originDropzone?.revert()

    await Promise.all(undones)
    if (originDropzone?.el) restoreSelection(originDropzone.el, this)
  }

  async fork(x, y) {
    const ghostsCopy = this.map(({ ghost, x, y }) => {
      ghost = ghost.cloneNode(true)
      document.documentElement.append(ghost)
      return { x, y, ghost }
    })
    await Promise.all([
      this.revert(ghostsCopy), //
      this.adopt(x, y),
    ])
  }

  async adopt(x, y) {
    const dropzone = system.transfer.currentZone?.hint
    if (!dropzone || dropzone.isIframe) {
      system.transfer.items.removeGhosts()
      return
    }

    await paint()

    if (inIframe) {
      for (const item of this) {
        item.ghost.classList.remove("hide")
        if (!item.ghost.isConnected) {
          item.ghost.style.top = 0
          item.ghost.style.left = 0
          document.documentElement.append(item.ghost)
        }
      }

      this.drag(x, y)
    }

    const { newIndex } = dropzone
    const { selector } = dropzone.config

    const undones = []
    let adopteds

    if (newIndex === undefined) {
      adopteds = dropzone.el.querySelectorAll(
        `${selector}:nth-last-child(-n+${this.length})`
      )
    } else {
      const start = newIndex + 1
      const end = newIndex + this.length
      adopteds = dropzone.el.querySelectorAll(
        `${selector}:nth-child(n+${start}):nth-child(-n+${end})`
      )
    }

    const rects = []
    for (let i = 0, l = adopteds.length; i < l; i++) {
      const rect = adopteds[i].getBoundingClientRect()
      rect.target = adopteds[i]
      rects.push(rect)
      queueMicrotask(() => dropzone.faintTarget(rect.target))
    }

    await dropzone.beforeAdoptAnimation(rects)

    for (let i = 0, l = this.length; i < l; i++) {
      const item = this[i]
      if (rects[i] && this.config.adoptAnimation) {
        undones.push(
          animateTo(item.ghost, {
            translate: `${rects[i].x}px ${rects[i].y}px`,
            ...this.adoptAnimation(item),
          }).then(() => {
            item.ghost.remove()
            dropzone.reviveTarget(rects[i].target)
          })
        )
      } else {
        item.ghost.remove()
        dropzone.reviveTarget(item.target)
      }
    }

    await Promise.all(undones)

    if (!(dropzone.isOriginDropzone && system.transfer.effect === "copy")) {
      restoreSelection(dropzone.el, adopteds)
    }
  }
}

export default ItemsHint
