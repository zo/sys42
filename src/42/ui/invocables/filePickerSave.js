import explorer from "../components/explorer.js"
import getStemname from "../../core/path/core/getStemname.js"
import isHashmapLike from "../../fabric/type/any/is/isHashmapLike.js"
import nextCycle from "../../fabric/type/promise/nextCycle.js"

export default async function filePickerSave(path, options) {
  const untitled = options?.untitled ?? "untitled.txt"

  const res = await explorer(path, {
    label: "Save File - {{path}}",

    isPicker: true,

    dialog: {
      class: "dialog-explorer dialog-filepicker dialog-filepicker--save",
      footer: [
        {
          tag: "input.w-full",
          scope: "name",
          value: `{{selection.length > 0
            ? getBasename(selection/0)
            : this.value || '${untitled}'}}`,
          autofocus: true,
          compact: true,
          enterKeyHint: "done",
          on: {
            Enter: "{{ok()}}",
            focus: "{{selectStem(target)}}",
          },
        },
        { tag: "button.btn-default", label: "Save", click: "{{ok()}}" },
        { tag: "button", label: "Cancel", click: "{{close()}}" },
      ],
      actions: {
        selectStem(target) {
          this.state.selection.length = 0
          const { value } = target
          const stem = getStemname(value)
          const start = value.indexOf(stem)
          target.setSelectionRange(0, 0)
          start > -1
            ? target.setSelectionRange(start, start + stem.length)
            : target.setSelectionRange(0, value.length)
        },
      },
    },

    ...options,
  })

  if (!res.ok || !res.name) return

  await nextCycle()

  let write

  if (!res.path.endsWith("/")) res.path += "/"
  const filename = res.path + res.name

  if (options !== undefined && !isHashmapLike(options)) {
    options = { data: options }
  }

  if (options && "data" in options) {
    const fs = await import("../../core/fs.js").then((m) => m.default)
    const { encoding } = options
    write = await fs.write(filename, options.data, { encoding })
  }

  return {
    path: res.path,
    basename: res.name,
    filename,
    write,
  }
}
