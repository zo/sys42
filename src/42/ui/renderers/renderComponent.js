import defer from "../../fabric/type/promise/defer.js"
import create from "../create.js"

export default function renderComponent(type, def, ctx) {
  const el = create(type)
  el.setAttribute("data-lazy-init", "true")
  const tag = el.localName

  const deferred = defer()
  ctx.undones.push(deferred)

  const initComponent = async () => {
    try {
      await el.init(def, ctx)
      deferred.resolve(`component ${tag}`)
    } catch (err) {
      deferred.reject(err)
    }
  }

  if (el.constructor === HTMLElement) {
    import(`../components/${tag.slice(3)}.js`).catch(() => {
      deferred.reject(new Error(`Unknown component: ${tag}`))
    })

    customElements
      .whenDefined(tag)
      .then(() => {
        customElements.upgrade(el)
        initComponent()
      })
      .catch((err) => deferred.reject(err))
  } else {
    queueMicrotask(initComponent)
  }

  return el
}
