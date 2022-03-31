import { setControlData } from "../../fabric/dom/setFormData.js"
import { getControlData } from "../../fabric/dom/getFormData.js"
import registerRenderer from "../utils/registerRenderer.js"
import renderKeyVal from "./renderKeyVal.js"
import arrify from "../../fabric/type/any/arrify.js"

export default function renderControl(el, def, ctx) {
  if (!el.name) return

  if (def.bind !== false) {
    const { signal } = ctx.cancel
    const handler = () => {
      getControlData(el, ctx.global.rack)
      ctx.global.state.update(el.name)
    }

    for (const event of arrify(def.bind ?? "input")) {
      el.addEventListener(event, handler, { signal })
    }
  }

  if (def.registerControl === undefined) {
    registerRenderer(ctx, el.name, () => setControlData(el, ctx.global.rack))
  } else {
    let registered
    renderKeyVal(el, ctx, "value", def.registerControl, (el, key, val) => {
      if (!registered) {
        ctx.global.rack.set(el.name, val)
        registerRenderer(ctx, el.name, () =>
          setControlData(el, ctx.global.rack)
        )
        registered = true
      }

      el.value = val
    })
  }
}
