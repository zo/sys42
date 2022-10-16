import inTop from "../../core/env/realm/inTop.js"
import UI from "../../ui/classes/UI.js"
import preinstall from "../preinstall.js"
import getDirname from "../../core/path/core/getDirname.js"
import escapeTemplate from "../../core/formats/template/escapeTemplate.js"
import merge from "../../fabric/type/object/merge.js"

// TODO: check if rpc functions can be injecteds
import "../../fabric/browser/openInNewTab.js"
import "../../ui/components/dialog.js"
import "../../ui/popup.js"

async function normalizeManifest(manifest, options) {
  if (options?.skipNormalize !== true) {
    if (typeof manifest === "string") {
      const fs = await import("../../core/fs.js") //
        .then((m) => m.default)

      manifest = await fs.read.json5(new URL(manifest, location).pathname)
    }

    if (manifest.dir === undefined) {
      const url = document.URL
      manifest.dir = url.endsWith("/") ? url : getDirname(url) + "/"
    }
  }

  if (inTop) {
    manifest.permissions ??= "app"
    if (manifest.permissions !== "app") {
      console.log("TODO: ask user for permissions")
    }
  }

  manifest.state ??= {}

  if (options?.state) merge(manifest.state, options.state)

  return manifest
}

function makeSandbox(manifest) {
  if (manifest.path) {
    return {
      permissions: manifest.permissions,
      path: manifest.path,
    }
  }

  const script = escapeTemplate(`\
    import App from "${import.meta.url}"
    globalThis.app = await App.mount(
      ${JSON.stringify(manifest)},
      { skipNormalize: true }
    )`)

  return {
    permissions: manifest.permissions,
    script,
  }
}

export default class App extends UI {
  constructor(manifest) {
    if (manifest.state?.paths) {
      manifest.state.$files = manifest.state.paths.map((path) => ({ path }))
    }

    // if (!manifest.content && manifest.path) {
    //   manifest.content = {
    //     tag: "iframe.box-fit",
    //     src: manifest.path,
    //     // tag: "ui-sandbox",
    //     // path: manifest.path,
    //     // permissions: "trusted",
    //     // check: false,
    //   }
    // }

    super(
      {
        tag: ".box-fit.box-h",
        content: manifest.menubar
          ? [{ tag: "ui-menubar", content: manifest.menubar }, manifest.content]
          : manifest.content,
        state: manifest.state,
        actions: {
          io: {
            new(...args) {
              console.log("new", args)
            },
            open() {
              console.log("open")
            },
            save() {
              console.log("save")
            },
          },
        },
      },
      { trusted: true }
    )

    this.manifest = manifest
  }

  // Execute App sandboxed in a top level page
  static async mount(manifest, options) {
    manifest = await normalizeManifest(manifest, options)
    const sandbox = makeSandbox(manifest)

    if (inTop) {
      return new UI({
        tag: "ui-sandbox.box-fit",
        ...sandbox,
      })
    }

    // Allow PWA installation
    if (manifest.installable !== false) {
      const install = await preinstall(manifest)
      if (install === true) return
    }

    return new App(manifest)
  }

  // Execute App sandboxed inside a dialog
  static async launch(manifest, options) {
    manifest = await normalizeManifest(manifest, options)
    const sandbox = makeSandbox(manifest)

    const width = manifest.width ?? "400px"
    const height = manifest.height ?? "350px"

    const dialog = await import("../../ui/components/dialog.js") //
      .then((m) => m.default)

    return dialog({
      label: "{{render(1)}}",
      content: {
        style: { width, height },
        tag: "ui-sandbox" + (manifest.inset ? ".inset" : ""),
        ...sandbox,
      },
      state: {
        $app: manifest,
        $files: options?.state?.paths.map((path) => ({ path })),
      },
    })
  }
}
