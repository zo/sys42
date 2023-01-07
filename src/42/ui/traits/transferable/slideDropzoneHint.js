import { animateTo } from "../../../fabric/dom/animate.js"
import getRects from "../../../fabric/dom/getRects.js"
import { inRect } from "../../../fabric/geometry/point.js"
import appendCSS from "../../../fabric/dom/appendCSS.js"
import defer from "../../../fabric/type/promise/defer.js"

const { parseInt, isNaN } = Number

export class SlideDropzoneHint {
  constructor(el, options) {
    this.el = el
    this.config = { ...options }
    this.speed = this.config.animationSpeed
    this.rects = []

    this.orientation = "horizontal"

    const { signal } = this.config

    this.css = {
      enter: appendCSS({ signal }),
      transition: appendCSS({ signal }),
    }

    this.styles = getComputedStyle(this.el)
    this.colGap = parseInt(this.styles.columnGap, 10)
    this.rowGap = parseInt(this.styles.rowGap, 10)
    if (isNaN(this.colGap)) this.colGap = 0
    if (isNaN(this.rowGap)) this.rowGap = 0
  }

  async updateRects(cb) {
    this.rects.length = 0
    return getRects(this.config.selector, {
      root: this.el,
      intersecting: true,
    }).then((rects) => {
      for (const item of rects) {
        this.rects.push(item)
        cb?.(item)
      }

      return rects
    })
  }

  enter(items) {
    this.el.classList.add("dragover")

    let enterCss = []
    let offset = 0

    this.enterReady = defer()

    this.css.transition.disable()
    const { selector } = this.config

    let previousY

    this.inOriginalDropzone = items.dropzoneId === this.el.id
    this.newIndex = this.inOriginalDropzone ? items[0]?.index : undefined

    this.updateRects((rect) => {
      for (const item of items) {
        if (previousY !== rect.y) {
          if (enterCss.length > 0) {
            enterCss = enterCss.map((css) =>
              css.replace(":is(*)", `:nth-child(-n+${rect.index})`)
            )
            enterCss.push(
              `${selector}:nth-child(${rect.index}) {
                /* rotate: 10deg !important; */
                margin-right: ${offset}px;
              }`
            )
          }

          offset = 0
        }

        previousY = rect.y

        if (
          item.target.id === rect.target.id &&
          !rect.target.classList.contains("hide")
        ) {
          offset += item.width + this.colGap
          const i = rect.index + 1
          enterCss.push(
            `${selector}:nth-child(n+${i}):is(*) {
              translate: ${offset}px 0;
            }`
          )
          rect.target.classList.add("hide")
        }
      }
    }).then((rects) => {
      enterCss.push(
        `${selector}:nth-child(${rects.length}) {
          /* rotate: 10deg !important; */
          margin-right: ${offset}px;
        }`
      )
      this.css.enter.update(enterCss.join("\n"))
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.css.transition.update(`${this.config.selector} {
            transition:
              margin-right ${this.speed}ms ease-in-out,
              translate ${this.speed}ms ease-in-out !important;
          }`)
          this.enterReady.resolve()
        })
      })
    })
  }

  async leave() {
    this.el.classList.remove("dragover")
    await this.enterReady
    this.rects.length = 0
    this.css.enter.disable()
  }

  dragover(items, x, y) {
    const point = { x, y }
    for (const rect of this.rects) {
      if (inRect(point, rect)) {
        this.newIndex = (
          this.orientation === "horizontal"
            ? point.x > rect.x + rect.width / 2
            : point.y > rect.y + rect.height / 2
        )
          ? rect.index + 1
          : rect.index
        break
      }
    }
  }

  async revert(items, finished) {
    this.css.enter.enable()
    await finished
    this.css.transition.disable()
    this.css.enter.disable()
    for (const item of items) item.target.classList.remove("hide")
  }

  async drop(items) {
    this.leave()
    this.css.transition.disable()
    this.css.enter.disable()

    const undones = []

    for (const item of items) {
      if (!(this.inOriginalDropzone && this.newIndex === item.index)) {
        if (this.newIndex === undefined) this.el.append(item.target)
        else {
          const indexedElement = this.el.querySelector(
            `${this.config.selector}:nth-child(${this.newIndex + 1})`
          )
          this.el.insertBefore(item.target, indexedElement)
        }
      }

      requestAnimationFrame(() => {
        item.target.classList.remove("hide")
        const { x, y } = item.target.getBoundingClientRect()
        item.target.classList.add("invisible")

        if (items.config.dropAnimation) {
          undones.push(
            animateTo(item.ghost, {
              translate: `${x}px ${y}px`,
              ...items.dropAnimation(item),
            }).then(() => {
              item.ghost.remove()
              item.target.classList.remove("invisible")
            })
          )
        } else {
          item.ghost.remove()
          item.target.classList.remove("invisible")
        }
      })
    }

    await Promise.all(undones)
  }
}

export function slideDropzoneHint(el, options) {
  return new SlideDropzoneHint(el, options)
}

export default slideDropzoneHint
