// @read https://bjk5.com/post/44698559168/breaking-down-amazons-mega-dropdown

/* eslint-disable max-params */
import listen from "../../fabric/event/listen.js"
import repaintThrottle from "../../fabric/type/function/repaintThrottle.js"

const DEFAULTS = {
  refresh: 300,
  direction: "horizontal",
}

const ns = "http://www.w3.org/2000/svg"

export class Aim {
  constructor(options) {
    this.el = document.createElementNS(ns, "svg")
    this.el.id = "menu-aim"
    this.el.setAttribute("aria-hidden", "true")
    this.el.style = `
      pointer-events: none;
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;`

    this.triangle = document.createElementNS(ns, "polygon")
    this.triangle.id = "menu-aim-triangle"
    this.triangle.setAttribute("fill", "transparent")
    this.triangle.setAttribute("points", "0,0 0,0 0,0")
    this.triangle.style = "display:none; pointer-events: auto;"
    this.triangle.onpointerdown = () => this.reset()

    this.config = { ...DEFAULTS, ...options }
    this.config.dest ??= document.documentElement

    this.el.append(this.triangle)
    this.config.dest.append(this.el)

    this.direction = this.config.direction

    this.reset()

    let refreshTimerId

    this.forget = listen({
      selector: (this.config.selector ?? "") + ", #menu-aim-triangle",
      pointermove: repaintThrottle((e) => {
        clearTimeout(refreshTimerId)

        if (!this.#active) return

        if (e.target.id === "menu-aim-triangle") {
          refreshTimerId = setTimeout(
            () => this.setCursor(e),
            this.config.refresh,
          )
          return
        }

        this.setCursor(e)
      }),
    })

    this.config.signal?.addEventListener("abort", () => this.destroy())
  }

  #active
  get active() {
    return this.#active
  }
  set active(val) {
    this.#active = Boolean(val)
    if (this.#active) {
      this.triangle.style.display = "block"
    } else {
      this.triangle.style.display = "none"
      this.cursor = { x: 0, y: 0 }
      this.rect = { top: 0, left: 0, right: 0, bottom: 0 }
      this.resetPoints()
    }
  }

  reset() {
    this.active = false
  }

  shoot(el, direction) {
    this.active = true
    this.hit = el

    this.direction = direction ?? this.config.direction

    requestAnimationFrame(() => {
      this.rect = this.hit.getBoundingClientRect()
      this.draw()
    })
  }

  setCursor({ x, y }) {
    this.cursor.x = x
    this.cursor.y = y
    this.draw()
  }

  draw() {
    const { cursor, rect } = this
    const { x, y } = cursor

    if (this.direction === "vertical") {
      if (y > rect.bottom) {
        this.setPoints(
          x,
          y + 1,
          rect.left - 5,
          rect.bottom,
          rect.right + 5,
          rect.bottom,
        ) // v
      } else if (y < rect.top) {
        this.setPoints(
          x,
          y - 1,
          rect.left - 5,
          rect.top,
          rect.right + 5,
          rect.top,
        ) // ^
      } else this.resetPoints()
    } else if (x < rect.left) {
      this.setPoints(
        x + 1,
        y,
        rect.left,
        rect.top - 5,
        rect.left,
        rect.bottom + 5,
      ) // <
    } else if (x > rect.right) {
      this.setPoints(
        x - 1,
        y,
        rect.right,
        rect.top - 5,
        rect.right,
        rect.bottom + 5,
      ) // >
    } else this.resetPoints()
  }

  resetPoints() {
    this.triangle.setAttribute("points", "0,0 0,0 0,0")
  }

  setPoints(ax, ay, bx, by, cx, cy) {
    const points = `${ax},${ay} ${bx},${by} ${cx},${cy}`
    this.triangle.setAttribute("points", points)
  }

  destroy() {
    this.el.remove()
    this.forget()
    this.reset()
  }
}

export default Aim
