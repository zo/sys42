import { operators, assignments } from "./operators.js"
import allocate from "../../../fabric/locator/allocate.js"
import synchronize from "../../../fabric/type/function/synchronize.js"

const PIPE = Symbol("pipe")

function resolveAction(locals, locate, value, sep) {
  for (const obj of locals) {
    const res = locate(obj, value, sep)
    if (res !== undefined) return res
  }
}

function ensureAction(action, value) {
  if (typeof action !== "function") {
    throw new TypeError(
      `Template action didn't resolve as a function: "${value}"`
    )
  }
}

function compileToken(i, list, tokens, options) {
  const { type, value, negated /* , loc */ } = tokens[i]
  const { locate, actions, sep } = options

  if (type === "function") {
    let argTokens = []

    const start = i + 1
    let end = start

    for (let j = start, l = tokens.length; j < l; j++) {
      if (tokens[j].type === "functionEnd") {
        end = j
        break
      }
    }

    if (end > start) {
      const subset = tokens.slice(start, end)
      argTokens = compileExpression(subset, options)
      i = end
    }

    let action

    if (actions) {
      action = locate(actions, value, sep)
      if (!options.async && typeof action !== "function") {
        throw new TypeError(`Template action is not a function: "${value}"`)
      }
    }

    list.push(
      options.async
        ? async (locals, args = [], res) => {
            action ??= resolveAction(locals, locate, value, sep, action)
            args.unshift(action)
            for (const arg of argTokens) args.push(arg(locals, res))
            const [asyncFn, ...rest] = await Promise.all(args)
            ensureAction(asyncFn, value)
            return asyncFn(...rest)
          }
        : (locals, args = [], res) => {
            action ??= resolveAction(locals, locate, value, sep, action)
            ensureAction(action, value)
            for (const arg of argTokens) args.push(arg(locals, res))
            return action(...args)
          }
    )

    return i
  }

  if (type === "pipe") list.push(PIPE)
  else if (type === "placeholder") list.push((_, res) => res)
  else if (type === "ternary") list.push(value)
  else if (type === "operator") list.push(value)
  else if (type === "assignment") list.push(value)
  else if (type === "key") {
    list.push(
      negated
        ? (locals) => {
            for (const obj of locals) {
              const res = locate(obj, value, sep)
              if (res !== undefined) return !res
            }

            return true
          }
        : (locals) => {
            for (const obj of locals) {
              const res = locate(obj, value, sep)
              if (res !== undefined) return res
            }
          }
    )
  } else if (type === "arg") {
    list.push(negated ? () => !value : () => value)
  }

  if (tokens[i + 1]?.type === "assignment") {
    list.at(-1).path = value
  }

  return i
}

export default function compileExpression(tokens, options = {}) {
  const list = []

  // reduce function, key and arg tokens
  for (let i = 0, l = tokens.length; i < l; i++) {
    i = compileToken(i, list, tokens, options)
  }

  // reduce operation tokens
  for (let i = 0, l = list.length; i < l; i++) {
    if (typeof list[i] === "string" && list[i] in operators) {
      const operate = operators[list[i]]
      const fn = options.async
        ? async (locals) => operate(await left(locals), await right(locals))
        : (locals) => operate(left(locals), right(locals))
      const [left, , right] = list.splice(i - 1, 3, fn)
      i -= l - list.length
    }
  }

  // reduce ternary tokens
  for (let i = 0, l = list.length; i < l; i++) {
    if (list[i] === true) {
      const fn = options.async
        ? async (locals) =>
            (await condition(locals)) ? ifTrue(locals) : ifFalse(locals)
        : (locals) => (condition(locals) ? ifTrue(locals) : ifFalse(locals))
      const [condition, , ifTrue, , ifFalse] = list.splice(i - 1, 5, fn)
      i -= l - list.length
    }
  }

  // reduce pipe tokens
  for (let i = 0, l = list.length; i < l; i++) {
    if (list[i] === PIPE) {
      const fn = (locals) => action(locals, [], res(locals))
      const [res, , action] = list.splice(i - 1, 3, fn)
      i -= l - list.length
    }
  }

  // reduce assignment tokens
  for (let i = 0, l = list.length; i < l; i++) {
    if (typeof list[i] === "string" && list[i] in assignments) {
      if (!options.assignment) throw new Error("Assignment not allowed")
      const assign = assignments[list[i]]

      const fn = options.async
        ? synchronize(async (locals) => {
            const res = await assign(await left(locals), await right(locals))
            allocate(locals[0], left.path, res, options.sep)
            return res
          })
        : (locals) => {
            const res = assign(left(locals), right(locals))
            allocate(locals[0], left.path, res, options.sep)
            return res
          }

      const [left, , right] = list.splice(i - 1, 3, fn)
      i -= l - list.length
    }
  }

  return list
}
