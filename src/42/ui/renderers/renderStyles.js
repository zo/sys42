import { setStyle } from "../../fabric/dom/setStyles.js"
import renderKeyVal from "./renderKeyVal.js"

export default function renderStyles(el, ctx, styles) {
  const type = typeof styles
  if (type === "string") {
    renderKeyVal({ el, ctx, key: "style", val: styles }, (val, key, el) => {
      el.style.cssText = val
    })
  } else {
    for (const [key, val] of Object.entries(styles)) {
      renderKeyVal({ el, ctx, key, val }, (val, key, el) =>
        setStyle(el, key, val)
      )
    }
  }
}
