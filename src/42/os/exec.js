import inTop from "../system/env/runtime/inTop.js"
import inIframe from "../system/env/runtime/inIframe.js"
import ipc from "../system/ipc.js"
import disk from "../system/fs/disk.js"
import traverse from "../fabric/type/object/traverse.js"
import dirname from "../fabric/type/path/extract/dirname.js"
import resolvePath from "../fabric/type/path/core/resolvePath.js"
import getParentModule from "../fabric/getParentModule.js"

import parseCommand from "./cli/parseCommand.js"
import argv from "./cli/argv.js"

let bus
const { HOME } = disk

if (inTop) {
  ipc.on("main<-exec", ({ cmd, locals }) => exec(cmd, locals))
}

export default async function exec(cmd, locals = {}) {
  locals.cwd ??= dirname(new URL(getParentModule().url).pathname)

  if (inIframe) {
    bus ??= ipc.to(globalThis.top)
    return bus.send("main<-exec", { cmd, locals }).then(([res]) => res)
  }

  const [name, ...rest] = parseCommand(cmd)

  let program
  let cli

  const programs = disk.glob(
    [`${HOME}/**/${name}{.cmd,.app}.js`, `**/${name}{.cmd,.app}.js`],
    { sort: false }
  )

  if (programs.length === 0) throw new Error(`"${name}" command not found`)

  let options = { argsKey: "glob" }

  await import(/* @vite-ignore */ programs[0]).then((m) => {
    program = m.default
    if (m.cli) options = m.cli
  })

  if (!program) return

  const args = cli ? cli(rest) : argv(rest, options)

  traverse(args, (key, val, obj) => {
    if (key === options.argsKey && val.length === 1) {
      obj.filename = resolvePath(locals.cwd, val[0])
    }
  })

  return program(args)
}
