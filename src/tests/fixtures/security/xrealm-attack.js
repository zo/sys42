// @read https://www.wikiwand.com/en/Remote_procedure_call

// import hash from "../../../42/fabric/type/any/hash.js"
/* ATTACK: replace hash function to match top level dialog digest */
import mark from "../../../42/fabric/type/any/mark.js"
import sdbm from "../../../42/fabric/type/string/sdbm.js"
const seed = 0x30_96_a3_56_9d_f9
function hash(val) {
  const x = mark(val).replace("{ trusted: true } /* ATTACK */", "{}")
  const n = sdbm(x)
  return (
    String.fromCharCode(97 + (n % 26)) + //
    (n.toString(36).slice(1, 5) + (n * seed).toString(36).slice(1, 8))
  ).padEnd(12, "0")
}

/*  */
import ipc from "../../../42/core/ipc.js"

const { inTop, inIframe } = ipc

const CALL = "42_XREALM_CALL"
const DESTROY = "42_XREALM_DESTROY"

const functions = new Map()

if (inTop) {
  ipc
    .on(CALL, ([id, args], meta) => {
      if (
        args.length > 1 &&
        typeof args[1] === "object" &&
        meta.iframe &&
        meta.iframe.hasAttribute("sandbox") &&
        !meta.iframe.sandbox.contains("allow-same-origin")
      ) {
        // ctx.trusted is not allowed from sandboxed iframes
        delete args[1].trusted
      }

      if (functions.has(id)) return functions.get(id)(...args, meta)
      throw new Error("No corresponding function found in xrealm target")
    })
    .on(DESTROY, (id) => {
      functions.delete(id)
    })
}

export default function xrealm(fn, options) {
  const { inputs, outputs } = options
  const id = hash([fn, options])

  if (!inTop) {
    const caller =
      outputs && inputs
        ? async (/* xrealm:subroutine */ ...args) => {
            const res = await inputs(...args)
            if (res === false) return
            return outputs(await ipc.send(CALL, [id, res]))
          }
        : outputs
        ? async (/* xrealm:subroutine */ ...args) =>
            outputs(await ipc.send(CALL, [id, args]))
        : inputs
        ? async (/* xrealm:subroutine */ ...args) => {
            const res = await inputs(...args)
            if (res === false) return
            return ipc.send(CALL, [id, res])
          }
        : async (/* xrealm:subroutine */ ...args) => ipc.send(CALL, [id, args])

    caller.destroy = async () => ipc.send(DESTROY, id)

    return caller
  }

  functions.set(id, fn)

  const caller =
    outputs && inputs
      ? async (/* xrealm:top */ ...args) => {
          const res = await inputs(...args)
          if (res === false) return
          return outputs(await fn(...res))
        }
      : outputs
      ? async (/* xrealm:top */ ...args) => outputs(await fn(...args))
      : inputs
      ? async (/* xrealm:top */ ...args) => {
          const res = await inputs(...args)
          if (res === false) return
          return fn(...res)
        }
      : fn

  caller.destroy = async () => functions.delete(id)

  return caller
}

xrealm.inTop = inTop
xrealm.inIframe = inIframe
Object.freeze(xrealm)
