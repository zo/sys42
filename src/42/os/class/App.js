/* eslint-disable unicorn/no-this-assignment */
import inIframe from "../../core/env/runtime/inIframe.js"
import preinstall from "../utils/preinstall.js"
import UI from "../../ui/class/UI.js"
import basename from "../../fabric/type/path/extract/basename.js"
import dirname from "../../fabric/type/path/extract/dirname.js"

let fs
let explorer
let toggleFullscreen
let fileImport
let fileExport

const menubar = [
  {
    label: "File",
    id: "file",
    content: [
      {
        label: "New",
        picto: "file",
        shortcut: "Ctrl+N",
        run: "new",
      },
      {
        label: "Open…",
        picto: "folder-open",
        shortcut: "Ctrl+O",
        id: "open",
        run: "open",
      },
      {
        label: "Save",
        picto: "save",
        shortcut: "Ctrl+S",
        id: "save",
        run: "save",
      },
      {
        label: "Save As…",
        picto: "save",
        shortcut: "Ctrl+Shift+S",
        id: "saveAs",
        run: "saveAs",
      },
      "---",
      {
        label: "Import…",
        picto: "import",
        id: "import",
        run: "import",
      },
      {
        label: "Export…",
        picto: "export",
        id: "export",
        run: "export",
      },
    ],
  },
  {
    label: "View",
    content: [
      {
        label: "Fullscreen",
        run: "fullscreen",
        disabled: !document.fullscreenEnabled,
      },
      "---",
      {
        label: "Monospace",
        type: "checkbox",
      },
      {
        label: "Spellcheck",
        type: "checkbox",
      },
      {
        label: "Word-wrap",
        name: "wrap",
        type: "checkbox",
      },
    ],
  },
  {
    label: "About",
    content: [
      {
        label: "Install Web App",
        run: "install",
      },
    ],
  },
]

export default class App extends UI {
  constructor({ name, categories, data, content, encode, decode, dir }) {
    dir ??= dirname(document.URL) + "/"

    const install = preinstall({ name, categories, dir })

    data.openedFiles ??= [{ dirty: false, path: undefined }]

    // TODO: test openedFile
    Object.defineProperty(data, "openedFile", {
      get: () => this.data.openedFiles[0],
    })

    super({
      type: ".box-fit.box-h",
      content: [{ type: "ui-menubar", content: menubar }, content],

      data,

      actions: {
        new() {
          this.currentTab = this.openedFiles.length
          this.openedFiles.push({ dirty: false, path: undefined })
        },

        async open() {
          explorer ??= await import("../../ui/components/explorer.js") //
            .then((m) => m.default)
          const res = await explorer.pick(this.path)
          if (res) {
            this.currentTab = this.openedFiles.length
            this.openedFiles.push({ dirty: false, path: res.selection[0] })
          }
        },

        async save() {
          if (this.path) {
            fs ??= await import("../../core/fs.js").then((m) => m.default)
            fs.write(this.path, new Blob([this.text]))
            this.dirty = false
          } else {
            // await this.$run.saveAs()
            await app.run.saveAs()
          }
        },

        async saveAs() {
          explorer ??= await import("../../ui/components/explorer.js") //
            .then((m) => m.default)
          const res = await explorer.save(this.path ?? "untitled.txt")
          if (res) {
            fs ??= await import("../../core/fs.js").then((m) => m.default)
            await fs.write(res, new Blob([this.text]))
            this.path = res
            this.dirty = false
          }
        },

        async import() {
          fileImport ??= await import(
            "../../fabric/type/file/fileImport.js"
          ).then((m) => m.default)
          const [file] = await fileImport(decode)
          if (file) {
            this.text = await file.text()
            this.dirty = false
          }
        },

        async export() {
          fileExport ??= await import(
            "../../fabric/type/file/fileExport.js"
          ).then((m) => m.default)
          await fileExport(new File([this.text], basename(this.path)), encode)
        },

        install() {
          if (inIframe) {
            window.open(location, "_blank")
          } else {
            install()
          }
        },

        async fullscreen() {
          toggleFullscreen ??= await import(
            "../../fabric/dom/toggleFullscreen.js"
          ).then((m) => m.default)
          toggleFullscreen()
        },
      },
    })

    const app = this
  }

  async mount(...args) {
    await super.mount(...args)

    // const data = {
    //   // currentTab: 0,
    //   monospace: false,
    //   spellcheck: false,
    //   wrap: true,
    //   openedFiles: [
    //     { path: "/desktop/index.html" }, //
    //     { path: "/42.sw.js" },
    //     // { path: "/42/os.js" },
    //   ],
    // }

    // setTimeout(() => {
    //   this.ctx.global.state.assign(this.ctx.scope, data)
    //   // this.ctx.global.state.set(this.ctx.scope, data)
    // }, 500)
  }
}
