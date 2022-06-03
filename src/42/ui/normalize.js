/* eslint-disable max-depth */
import State from "./class/State.js"
import resolve from "./resolve.js"
import Locator from "../fabric/class/Locator.js"
import template from "../system/formats/template.js"
import Canceller from "../fabric/class/Canceller.js"
import Undones from "../fabric/class/Undones.js"
import getFilter from "../fabric/getFilter.js"
import dirname from "../fabric/type/path/extract/dirname.js"
import isEmptyObject from "../fabric/type/any/is/isEmptyObject.js"
import isLength from "../fabric/type/any/is/isLength.js"
import isArrayLike from "../fabric/type/any/is/isArrayLike.js"
import ATTRIBUTES_ALLOW_LIST from "../fabric/constants/ATTRIBUTES_ALLOW_LIST.js"

const DEF_KEYWORDS = new Set([
  "actions",
  "computed",
  "content",
  "data",
  "repeat",
  "schema",
  "scope",
  "tag",
  "when",
])

function normaliseString(def, ctx) {
  const parsed = template.parse(def)

  if (parsed.substitutions.length > 0) {
    const filters = { ...ctx.actions.value }
    const keys = []
    for (const tokens of parsed.substitutions) {
      for (const token of tokens) {
        const loc = resolve(ctx.scope, token.value)
        if (token.type === "key") {
          token.value = loc
          keys.push(token.value)
        } else if (
          token.type === "arg" &&
          isLength(token.value) &&
          isArrayLike(ctx.state.get(dirname(loc)))
        ) {
          token.type = "key"
          token.value = loc
          keys.push(token.value)
        } else if (token.type === "function") {
          if (ctx.actions.has(loc) === false) {
            let filter
            filters[token.value] = async (...args) => {
              filter ??= await getFilter(token.value)
              try {
                return await filter(...args)
              } catch (err) {
                console.log(err)
              }
            }
          } else token.value = loc
        }
      }
    }

    def = template.compile(parsed, {
      async: true,
      sep: "/",
      thisArg: ctx,
      filters,
    })

    def.keys = keys
    return def
  }

  return def
}

function normalizeObject(def, ctx) {
  const out = {}

  for (const [key, val] of Object.entries(def)) {
    out[key] = typeof val === "string" ? normaliseString(val, ctx) : val
  }

  return out
}

export function normalizeAttrs(def, ctx) {
  const attrs = {}

  for (const [key, val] of Object.entries(def)) {
    if (
      !DEF_KEYWORDS.has(key) &&
      (ctx?.trusted || ATTRIBUTES_ALLOW_LIST.includes(key))
    ) {
      const type = typeof val
      if (val && type === "object") {
        if (key === "class" && Array.isArray(val)) {
          attrs[key] = normaliseString(val.join(" "), ctx)
        } else {
          attrs[key] = normalizeObject(val, ctx)
        }
      } else {
        attrs[key] = type === "string" ? normaliseString(val, ctx) : val
      }
    }
  }

  return attrs
}

export default function normalize(def = {}, ctx = {}) {
  ctx.scope ??= "/"
  ctx.renderers ??= {}
  ctx.undones ??= new Undones()
  ctx.actions ??= new Locator({}, { sep: "/" })
  ctx.cancel ??= new Canceller()
  ctx.state ??= new State(ctx)
  ctx = { ...ctx }

  let type = typeof def

  if (type === "string") {
    const fn = normaliseString(def, ctx)
    type = typeof fn
    if (type === "function") def = fn
  } else if (Array.isArray(def)) {
    type = "array"
  } else {
    if (def.actions) ctx.actions.assign(ctx.scope, def.actions)

    if (def.data) {
      if (typeof def.data === "function") {
        const { scope } = ctx
        ctx.undones.push(
          (async () => {
            const res = await def.data()
            ctx.state.assign(scope, res)
          })()
        )
      } else ctx.state.assign(ctx.scope, def.data)
    }

    if (def.scope) ctx.scope = resolve(ctx.scope, def.scope)

    const attrs = normalizeAttrs(def, ctx)
    if (!isEmptyObject(attrs)) def.attrs = attrs
  }

  return { type, def, ctx }
}
