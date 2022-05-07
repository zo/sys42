import render from "../render.js"
import defer from "../../fabric/type/promise/defer.js"
import Undones from "../../fabric/class/Undones.js"
import omit from "../../fabric/type/object/omit.js"
import normalizeDefinition from "../utils/normalizeDefinition.js"
import makeNewContext from "../utils/makeNewContext.js"
import renderAttributes from "../renderers/renderAttributes.js"
import registerRenderer from "../utils/registerRenderer.js"
import joinScope from "../utils/joinScope.js"
import { toKebabCase } from "../../fabric/type/string/letters.js"
import CONVERTERS from "./Component/CONVERTERS.js"

function setProps(el, props, _) {
  const { ctx, observed } = el._

  for (let [key, item] of Object.entries(props)) {
    const scope = joinScope(ctx.scope, key)

    const type = typeof item

    if (type !== "object") {
      item = { type, default: item, reflect: true }
    }

    const attribute = item.attribute ?? toKebabCase(key)
    const converter = item.converter ?? CONVERTERS[item.type ?? "string"]
    let { fromView, toView, reflect } = item

    if (reflect) {
      fromView = true
      toView = true
    }

    if (toView) {
      toView = typeof toView === "function" ? toView : converter.toView
    }

    if (fromView) {
      fromView = typeof fromView === "function" ? fromView : converter.fromView
    }

    if (key in _.props) {
      ctx.global.state.set(scope, _.props[key])
    } else if ("default" in item && !ctx.global.state.has(scope)) {
      ctx.global.state.set(scope, item.default)
    }

    let fromRenderer = false

    if (fromView) {
      observed[attribute] = (val) => {
        if (fromRenderer) return
        ctx.global.state.set(scope, fromView(val, attribute, el, item))
      }
    }

    registerRenderer(ctx, scope, () => {
      const value = ctx.global.rack.get(scope)

      if (item.css) {
        const cssVar = `--${typeof item.css === "string" ? item.css : key}`
        if (value == null) el.style.removeProperty(cssVar)
        else el.style.setProperty(cssVar, value)
      }

      if (toView) {
        fromRenderer = true
        if (value == null) {
          el.removeAttribute(attribute)
          return
        }

        if (
          item.type === "boolean" ||
          (item.type === "any" && typeof value === "boolean")
        ) {
          if (item.default === true && value === false) {
            el.setAttribute(attribute, "false")
          } else el.toggleAttribute(attribute, value)
        } else el.setAttribute(attribute, toView(value, key, el, item))
        fromRenderer = false
      }
    })

    Object.defineProperty(el, key, {
      configurable: true,
      set(value) {
        ctx.global.state.set(scope, value)
      },
      get() {
        return ctx.global.state.getProxy(scope)
      },
    })
  }
}

export default class Component extends HTMLElement {
  static async define(Class) {
    if (typeof Class === "object") {
      Class = class extends Component {
        static definition = Class
      }
    }

    let tagName = Class.definition.tag
    if (tagName === undefined) {
      if (Class.name === "Class") throw new Error(`missing Component "tag"`)
      tagName = `ui-${Class.name.toLowerCase()}`
    }

    customElements.define(tagName, Class)
    return (...args) => new Class(...args)
  }

  static get observedAttributes() {
    const observed = []
    if (!this.definition?.props) return observed
    for (const [key, item] of Object.entries(this.definition.props)) {
      observed.push(item.attribute ?? toKebabCase(key))
    }

    return observed
  }

  _ = {}
  #rendered = false

  constructor(...args) {
    super()
    this.ready = defer()
    if (args.length > 0) this.init(...args)
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this._?.observed[name]?.(newValue, oldValue)
  }

  connectedCallback() {
    if (!this.isConnected) return
    if (!this.#rendered && !this.hasAttribute("data-lazy-init")) {
      this.init()
    }
  }

  disconnectedCallback() {
    this._?.ctx.cancel()
    this.ready = defer()
    this.#rendered = false
  }

  async #init(...args) {
    this.removeAttribute("data-lazy-init")
    const { definition } = this.constructor
    const { props } = definition

    const _ = normalizeDefinition(definition, ...args)

    this._.observed = {}
    this._.ctx = makeNewContext(_.ctx)
    this._.ctx.undones = new Undones()
    this._.ctx.cancel = this._.ctx.cancel?.fork(this.localName)
    Object.defineProperty(this._, "signal", {
      configurable: true,
      get: () => this._.ctx.cancel.signal,
    })

    if (props) setProps(this, props, _)

    if (_.attrs) renderAttributes(this, this._.ctx, _.attrs)

    const def = this.prerender?.(this._) ?? omit(_.def, "type")

    if (def) render(def, this._.ctx, this)
    const undonesTokens = await this._.ctx.undones

    await this.postrender?.(this._)
    this.#rendered = true
    return [`component ${this.localName}`, ...undonesTokens]
  }

  async init(...args) {
    await this.#init(...args)
      .then((tokens) => this.ready.resolve(tokens))
      .catch((err) => this.ready.reject(err))
  }
}
