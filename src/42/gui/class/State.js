import observe from "../observe.js"
import locate from "../../fabric/locator/locate.js"

export default class State {
  constructor(ctx) {
    this.value = ctx.data ?? {}
    this.proxy = observe(this.value, {
      change(prop) {
        if (prop in ctx.renderers) {
          for (const renderer of ctx.renderers[prop]) renderer()
        }
      },
    })
  }

  get(path) {
    return locate(this.proxy, path, "/")
  }
}
