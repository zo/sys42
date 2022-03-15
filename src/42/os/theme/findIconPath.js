/* eslint-disable complexity */
import disk from "../../system/fs/disk.js"

export default function findIconPath(
  theme,
  { filename, ext, type, subtype, suffix, protocol, host }
) {
  const dir = disk.get(theme)
  if (!dir) return

  if (protocol.startsWith("http")) {
    if ("host" in dir) {
      for (const k of Object.keys(dir.host)) {
        if (k.startsWith(`${host}.`)) return `${theme}/host/${k}`
      }
    }

    if ("ext" in dir) {
      for (const k of Object.keys(dir.ext)) {
        if (k.startsWith(`url.`)) return `${theme}/ext/${k}`
      }
    }

    return
  }

  if (filename.endsWith("/")) {
    if ("places" in dir) {
      for (const k of Object.keys(dir.places)) {
        if (k.startsWith(`folder.`)) return `${theme}/places/${k}`
      }
    }

    return
  }

  if ("ext" in dir) {
    for (const k of Object.keys(dir.ext)) {
      if (k.startsWith(`${ext}.`)) return `${theme}/ext/${k}`
    }
  }

  if ("subtype" in dir) {
    for (const k of Object.keys(dir.subtype)) {
      if (
        k.startsWith(`${subtype}.`) ||
        (suffix && k.startsWith(`${suffix}.`))
      ) {
        return `${theme}/subtype/${k}`
      }
    }
  }

  if ("type" in dir) {
    for (const k of Object.keys(dir.type)) {
      if (k.startsWith(`${type}.`)) return `${theme}/type/${k}`
    }
  }
}
