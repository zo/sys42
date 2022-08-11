import test from "../../../42/test.js"

import ui from "../../../42/ui.js"
import ipc from "../../../42/core/ipc.js"
import when from "../../../42/fabric/type/promise/when.js"
import timeout from "../../../42/fabric/type/promise/timeout.js"
import normalizeError from "../../../42/fabric/type/error/normalizeError.js"

const debug = 1

const SECRET = "hello secret"
let secretBackup

test.setup(() => {
  secretBackup = localStorage.getItem("SECRET")
  localStorage.setItem("SECRET", SECRET)
})

test.teardown(() => {
  if (secretBackup) localStorage.setItem("SECRET", secretBackup)
  else localStorage.removeItem("SECRET")
})

test.suite.serial()

const { task } = test

test.tasks(
  [
    // task({
    //   title: "XSS example",
    //   description: "XSS Work because hardcoded localStorage.SECRET",
    //   def: {
    //     tag: "ui-sandbox",
    //     permissions: "app",
    //     script: `ipc.to.top.emit('xss', "hello secret")`,
    //   },
    // }),

    // task({
    //   title: "Protected example",
    //   description: "XSS Fail because code know it hasn't found localStorage.SECRET",
    //   def: {
    //     tag: "ui-sandbox",
    //     permissions: "app",
    //     script: `ipc.to.top.emit('xss', new Error("Secret not found"))`,
    //   },
    // }),

    // task({
    //   title: "Timeout example",
    //   description: "XSS Fail because nothing happen until timeout",
    //   timeout: 100,
    //   def: {
    //     tag: "ui-sandbox",
    //     permissions: "app",
    //     script: `void 0`,
    //   },
    // }),

    task({
      title: "ctx.trusted attack",
      description:
        "XSS Fail because ctx.trusted is not transfered to top realm",
      def: [
        {
          // dummy dialog to force top ipc response
          tag: "ui-dialog",
          label: "dummy dialog",
        },
        {
          tag: "ui-sandbox",
          permissions: "app",
          script: `
import dialog from "../../42/ui/components/dialog.js"
dialog(
  {
    label: "malware",
    content: {
      tag: "ui-sandbox",
      permissions: "trusted",
      script: "ipc.to.top.emit('xss', localStorage.getItem('SECRET'))"
    }
  },
  { trusted: true }
)
`,
        },
      ],
    }),

    task({
      working: true,
      trusted: true,
      title: "importmap attack on iframe",
      description: "XSS Work because iframe is not sandboxed",
      def: [
        {
          tag: "ui-dialog",
          label: "dummy dialog",
        },
        {
          tag: "iframe",
          src: "/tests/fixtures/security/importmap-xrealm-attack.html",
        },
      ],
    }),

    task({
      title: "importmap attack on ui-sandbox",
      description:
        "XSS Fail because top level xrealm delete ctx.trusted from sandboxed iframes",
      def: [
        {
          tag: "ui-dialog",
          label: "dummy dialog",
        },
        {
          tag: "ui-sandbox",
          permissions: "trusted",
          path: "/tests/fixtures/security/importmap-xrealm-attack.html",
        },
      ],
    }),
  ],

  (test, { title, def, timeout: ms, working, trusted, description }) => {
    ms ??= 2000
    test.serial(title, async (t, { collect, dest }) => {
      t.timeout(ms + 100)

      t.utils.listen({
        uidialogopen(e, target) {
          target.style.opacity = 0.01
          t.utils.collect(target)
        },
      })

      const app = collect(ui(dest(true), def, { trusted }))

      let res

      try {
        await app
      } catch (err) {
        res = err
      }

      res ??= await Promise.race([
        when(document.body, "error").then((e) => {
          e.preventDefault()
          return normalizeError(e)
        }),
        ipc.once("xss"),
        timeout(ms).catch((err) => err),
      ])

      if (working) {
        t.is(res, SECRET, "A task should have found localStorage.SECRET")
        return
      }

      t.not(res, SECRET, "An untrusted context can access localStorage.SECRET")

      if (res == null) return

      t.isError(res)

      if (
        description ||
        !debug ||
        res.message.startsWith("Timed out") ||
        res.message.startsWith("Secret not found")
      ) {
        return
      }

      t.log(res)
    })
  }
)
