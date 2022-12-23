import Trait from "../classes/Trait.js"
import settings from "../../core/settings.js"
import ensureElement from "../../fabric/dom/ensureElement.js"
import uid from "../../core/uid.js"
import noop from "../../fabric/type/function/noop.js"
import ensureScopeSelector from "../../fabric/dom/ensureScopeSelector.js"

const DEFAULTS = {
  selector: ":scope > *",
  dropzone: undefined,
  effects: ["copy", "move", "link"],
  // driver: "dragEvent",
  driver: "pointerEvent",
  hint: "slide",
  // hint: { type: "float" },
  ignoreSelectable: false,
}

let preventRemove = false

const configure = settings("ui.trait.transferable", DEFAULTS)

class Transferable extends Trait {
  constructor(el, options) {
    super(el, options)

    if (options?.list) {
      this.list = options?.list
      delete options?.list
    }

    this.config = configure(options)

    if (typeof this.config.driver === "string") {
      this.config.driver = { type: this.config.driver }
    }

    if (typeof this.config.hint === "string") {
      this.config.hint = { type: this.config.hint }
    }

    this.effects = this.list
      ? options?.effects ?? ["copy", "move"]
      : this.config.effects

    this.dropzone = this.config.dropzone
      ? ensureElement(this.config.dropzone, this.el)
      : this.el

    this.dropzone.id ||= uid()
    const { id } = this.dropzone

    this.selector = ensureScopeSelector(this.config.selector, this.el)

    this.indexChange = this.config.indexChange ?? noop

    this.import = (obj) => {
      if (obj.data?.id === id) preventRemove = true
      if (this.config.import) return this.config.import(obj)

      let { data, effect, index, dropzone } = obj

      if (data?.type === "layout") {
        if (this.list) {
          if (data.id === id) {
            if (data.index === index) return
            const [removed] = this.list.splice(data.index, 1)
            if (index > data.index) index--
            this.list.splice(index, 0, removed)
          } else {
            this.list.splice(index, 0, data.state)
          }

          this.indexChange(index)
        } else if (this.config.importLayout) {
          this.config.importLayout(data.state, obj)
        }
      } else if (data?.type === "selection") {
        preventRemove = true
        const frag = document.createDocumentFragment()
        for (let el of data.elements) {
          if (effect === "copy") {
            el = el.cloneNode(true)
            el.id += "-copy"
          }

          el.classList.remove("selected")

          frag.append(el)
        }

        if (this.config.importElement) this.config.importElement(frag, obj)
        else dropzone.insertBefore(frag, dropzone.children[index])
      } else if (data?.type === "element") {
        let el = data.el ?? document.querySelector(data.selector)
        if (el) {
          preventRemove = true
          if (effect === "copy") {
            el = el.cloneNode(true)
            el.id += "-copy"
          }

          if (this.config.importElement) this.config.importElement(el, obj)
          else dropzone.insertBefore(el, dropzone.children[index])
        }
      }
    }

    this.export = (obj) => {
      preventRemove = false
      if (this.config.export) return this.config.export(obj)

      if (this.config.ignoreSelectable !== true) {
        const selectable = this.dropzone[Trait.INSTANCES]?.selectable
        if (selectable) {
          return {
            id,
            type: "selection",
            selection: selectable.selection,
            elements: selectable.elements,
          }
        }
      }

      const { index, target } = obj
      if (this.list) {
        const state = this.list.at(index)
        return { id, type: "layout", index, state }
      }

      target.id ||= uid()
      return { id, type: "element", selector: `#${target.id}` }
    }

    this.remove = (obj) => {
      if (preventRemove) return
      if (this.config.remove) return this.config.remove(obj)

      const { index, target } = obj
      if (this.list) this.list.splice(index, 1)
      else target.remove()
    }

    import(`./transferable/drivers/${this.config.driver.type}Driver.js`) //
      .then((m) => m.default(this, this.config.driver))
  }
}

export function transferable(...args) {
  return new Transferable(...args)
}

export default transferable
