import render from "../render.js"
import omit from "../../fabric/type/object/omit.js"
import createRange from "../../fabric/range/createRange.js"
import removeRange from "./removeRange.js"
import register from "../register.js"
import Canceller from "../../fabric/class/Canceller.js"
import { normalizeDefNoCtx } from "../normalize.js"

const PLACEHOLDER = "[each]"
const ITEM = "[#]"

function cancelExtraItems(i, cancels) {
  const x = i
  for (let l = cancels.length; i < l; i++) cancels[i]("renderEach removed")
  cancels.length = x
}

export default function renderEach(def, ctx) {
  const eachDef = normalizeDefNoCtx(def.each)
  def = omit(def, ["each"])

  const el = render(def, ctx)

  let lastItem
  const cancels = []

  const placeholder = document.createComment(PLACEHOLDER)
  el.append(placeholder)

  let scopeChain
  if (ctx.scopeChain.length > 0) {
    scopeChain = structuredClone(ctx.scopeChain)
    scopeChain.push({ scope: ctx.scope })
  }

  register(ctx, ctx.scope, (array) => {
    if (!array || !Array.isArray(array) || array.length === 0) {
      if (lastItem) {
        for (const cancel of cancels) cancel()
        cancels.length = 0

        const range = createRange()
        range.setStartAfter(placeholder)
        range.setEndAfter(lastItem)
        removeRange(ctx, range, eachDef)
        lastItem = undefined
      }

      return
    }

    let i = 0
    const { length } = array

    let endItem

    if (lastItem) {
      const l = length - 1
      let node

      const walker = document.createTreeWalker(
        lastItem.parentElement,
        NodeFilter.SHOW_COMMENT
      )

      walker.currentNode = placeholder

      while ((node = walker.nextNode())) {
        if (node.textContent === ITEM) {
          i++

          endItem = node
          if (endItem === lastItem) break

          // remove extra items only
          if (i > l) {
            cancelExtraItems(i, cancels)
            const range = createRange()
            range.setStartAfter(endItem)
            range.setEndAfter(lastItem)
            removeRange(ctx, range, eachDef)
            lastItem = endItem
            break
          }
        }
      }
    }

    const fragment = document.createDocumentFragment()

    for (; i < length; i++) {
      const cancel = new Canceller(ctx.signal)
      cancels.push(cancel)

      fragment.append(
        render(
          eachDef,
          {
            ...ctx,
            cancel,
            signal: cancel.signal,
            scope: `${ctx.scope}/${i}`,
            steps: `${ctx.steps},[${i}]`,
            scopeChain,
          },
          { skipNoCtx: true }
        ),
        (lastItem = document.createComment(ITEM))
      )
    }

    if (endItem) endItem.after(fragment)
    else placeholder.after(fragment)
  })

  return el
}
