import State from "./class/State.js"
import template from "../system/formats/template.js"
import Canceller from "../fabric/class/Canceller.js"
import resolvePath from "../fabric/type/path/core/resolvePath.js"
import isLength from "../fabric/type/any/is/isLength.js"
import ATTRIBUTES_ALLOW_LIST from "../fabric/constants/ATTRIBUTES_ALLOW_LIST.js"

const DEF_KEYWORDS = new Set([
  // "actions",
  // "args",
  // "bind",
  // "compact",
  "computed",
  "content",
  "data",
  // "dialog",
  "filters",
  // "label",
  // "name",
  // "picto",
  // "popup",
  // "prose",
  "repeat",
  // "run",
  "schema",
  "scope",
  // "shortcuts",
  "tag",
  "when",
])

function resolve(scope, path) {
  return resolvePath(scope, String(path)).replaceAll(".", "/")
}

function normaliseString(def, ctx) {
  const parsed = template.parse(def)

  if (parsed.substitutions.length > 0) {
    const keys = []
    for (const tokens of parsed.substitutions) {
      for (const token of tokens) {
        if (token.type === "key") {
          token.value = resolve(ctx.scope, token.value)
          keys.push(token.value)
        } else if (
          token.type === "arg" &&
          isLength(token.value) &&
          Array.isArray(ctx.state.get(ctx.scope))
        ) {
          token.type = "key"
          token.value = resolve(ctx.scope, token.value)
          keys.push(token.value)
        }
      }
    }

    def = template.compile(parsed, { sep: "/" })
    def.keys = keys
    return def
  }
}

function normalizeStyles(def, ctx) {
  const styles = []
  for (const [key, val] of Object.entries(def)) {
    styles.push([
      key,
      typeof val === "string" ? normaliseString(val, ctx) ?? val : val,
    ])
  }

  return styles
}

function normalizeAttrs(def, ctx) {
  const attrs = []
  for (const [key, val] of Object.entries(def)) {
    if (
      !DEF_KEYWORDS.has(key) &&
      (ctx.trusted || ATTRIBUTES_ALLOW_LIST.includes(key))
    ) {
      const type = typeof val
      if (key === "style" && val && type === "object") {
        attrs.push([key, normalizeStyles(val, ctx)])
      } else {
        attrs.push([
          key,
          type === "string" ? normaliseString(val, ctx) ?? val : val,
        ])
      }
    }
  }

  return attrs
}

export default function normalize(def, ctx) {
  ctx.scope ??= "/"
  ctx.renderers ??= {}
  ctx.cancel ??= new Canceller()
  ctx.state ??= new State(ctx)
  ctx = { ...ctx }

  let type = typeof def

  if (type === "string") {
    const fn = normaliseString(def, ctx)
    if (fn) {
      def = fn
      type = "function"
    }
  } else if (Array.isArray(def)) {
    type = "array"
  } else {
    if (def.data) ctx.state.assign(ctx.scope, def.data)
    if (def.scope) ctx.scope = resolvePath(ctx.scope, def.scope)

    const attrs = normalizeAttrs(def, ctx)
    if (attrs.length > 0) def.attrs = attrs
  }

  return {
    type,
    def,
    ctx,
  }
}
