import Component from "../class/Component.js"
import dirname from "../../fabric/type/path/extract/dirname.js"
import dialog from "./dialog.js"
import open from "../../os/cmd/open.cmd.js"
import queueTask from "../../fabric/type/function/queueTask.js"
import keyboard from "../../core/devices/keyboard.js"
import { focusInside } from "../../fabric/dom/focus.js"

import parsePath from "../../fabric/type/path/core/parsePath.js"
import joinPath from "../../fabric/type/path/core/joinPath.js"
import normalizePath from "../../fabric/type/path/core/normalizePath.js"

export class Explorer extends Component {
  static definition = {
    tag: "ui-explorer",

    props: {
      path: {
        type: "string",
        reflect: true,
        default: "/",
      },
      glob: {
        type: "boolean",
        fromView: true,
      },
      isPicker: {
        type: "boolean",
      },
      multiselectable: {
        type: "boolean",
        fromView: true,
        default: true,
      },
      selection: {
        type: "array",
        default: [],
      },
    },

    on: [
      {
        "stop": true,
        "selector": 'ui-icon[aria-description="folder"]',
        "dblclick || Enter": "{{go(target.path)}}",
      },
      {
        "stop": true,
        "selector": 'ui-icon[aria-description="file"]',
        "dblclick || Enter": "{{isPicker ? ok() : open(target.path)}}",
      },
      {
        stop: true,
        Enter: "{{isPicker && ok()}}",
      },
      {
        "Alt+Up": "{{folderUp()}}",
      },
    ],
  }

  render() {
    return [
      {
        tag: "header.box-v",
        content: [
          {
            tag: "ui-menubar",
            content: [
              {
                label: "File",
                content: [
                  { label: "Exit", click: "{{dialog.close()}}" }, //
                ],
              },
              {
                label: "View",
                content: [
                  {
                    label: "Select all",
                    click: "{{folder.selectable.selectAll()}}",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        tag: "header.box-v.ctrl-group.mb-xs",
        content: [
          {
            tag: "button",
            picto: "up",
            aria: { label: "Go up" },
            click: "{{folderUp()}}",
            disabled: "{{path === '/'}}",
          },
          {
            tag: "input",
            scope: "path",
            enterKeyHint: "go",
            debounce: true,
            compact: true,
            prose: false,
            on: {
              Enter: "{{go(target.value)}}",
              focus({ target }) {
                const { length } = target.value
                target.selectionStart = length
                target.selectionEnd = length
              },
            },
          },
        ],
      },
      {
        tag: "ui-folder.inset.paper",
        path: "{{path}}",
        glob: "{{glob}}",
        selection: "{{selection}}",
        multiselectable: "{{multiselectable}}",
        as: "folder",
      },
      {
        tag: ".message",
        // as: "message",
      },
      {
        if: "{{!isPicker}}",
        tag: "footer.w-full.mt-xs.ma-0.box-v",
        content: [
          {
            tag: ".py-xs.px-md.mr-xs.inset-shallow.panel.item-shrink",
            content: "--- {{folder}}",
            // content:
            //   "{{folder.items.length}} {{pluralize('item', folder.items.length)}}",
          },
          {
            tag: "input.inset-shallow.panel",
            value: "{{displaySelection(selection)}}",
            label: "Selected paths",
            readonly: true,
            compact: true,
          },
        ],
      },
    ]
  }

  autofocus() {
    document.activeElement.blur()
    queueTask(() => focusInside(this.folder))
  }

  folderUp(options) {
    let path = dirname(this.path)
    if (!path.endsWith("/")) path += "/"
    this.path = path
    if (!options?.keepFocus) this.autofocus()
  }

  go(path, options) {
    if (keyboard.keys.Control) return // TODO: check how to do this in template
    this.path = path

    this.message = this.querySelector(".message") // TODO: write `elementAs` ui keyword

    if (this.folder.err) {
      this.message.textContent = this.folder.err
    } else {
      this.message.textContent = ""
      if (!options?.keepFocus) this.autofocus()
    }
  }

  open(path) {
    if (keyboard.keys.Control) return
    open(path)
  }

  displaySelection(selection) {
    return selection.length > 1
      ? JSON.stringify(selection).slice(1, -1)
      : selection[0]
  }
}

Component.define(Explorer)

export default async function explorer(path = "/", options) {
  const selection = options?.selection ?? []
  const glob = options?.glob ?? false

  const parsed = parsePath(normalizePath(path), { checkDir: true })

  if (parsed.base && selection.length === 0) {
    selection.push(joinPath(parsed.dir, parsed.base))
  }

  path = parsed.dir === "/" ? parsed.dir : parsed.dir + "/"

  return dialog({
    label: options.label ?? "{{path}}",
    icon: "{{path}}",
    class: "dialog-explorer",
    style: { width: "400px", height: "350px" },

    content: {
      tag: "ui-explorer",
      path: "{{path}}",
      selection: "{{selection}}",
      glob: "{{glob}}",
      isPicker: options.isPicker,
      parent: "dialog",
      as: "explorer",
    },

    state: { path, selection, glob },

    ...options?.dialog,
  })
}
