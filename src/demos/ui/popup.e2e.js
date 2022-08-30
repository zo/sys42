import ui from "../../42/ui.js"
import system from "../../42/system.js"
import e2e from "../../42/core/dev/testing/e2e.js"

function getVal(btn) {
  const out = {}
  for (const [key, val] of Object.entries(btn)) {
    out[key] = val.textContent
  }

  return out
}

const button = (label) => ({
  tag: `button#btnIncr${label}`,
  content: "{{cnt}}",
  click: "{{cnt += 1}}",
})

const buttons = (label) => ({
  tag: ".box-h",
  content: [
    button(label),
    {
      tag: `button#btnDialog${label}`,
      content: "dialog",
      dialog: {
        x:
          label === "Top"
            ? window.innerWidth / 2 - 200
            : window.innerWidth / 2 + 50,
        label,
        content: button(`Dialog${label}`),
      },
    },
    {
      tag: `button#btnPopup${label}`,
      content: "popup",
      popup: {
        tag: ".panel.outset.pa-lg",
        content: [`hello from ${label}`, "\n\n", button(`Popup${label}`)],
      },
    },
  ],
})

export default e2e(async (t, { collect, dest }) => {
  const app = await collect(
    ui(
      dest(true),
      {
        tag: ".box-fit.box-center",
        content: {
          tag: ".box-v.w-full",
          content: [
            {
              tag: ".box-center.ground",
              content: buttons("Top"),
            },
            {
              tag: "ui-sandbox",
              // permissions: "app",
              permissions: "trusted",
              content: {
                tag: ".box-fit.box-center.desktop",
                content: buttons("Iframe"),
              },
              script: `
            app.query("#btnDialogIframe").click()
            // app.query("#btnPopupIframe").click()
            `,
            },
          ],
        },
        state: {
          cnt: 0,
        },
      },
      { id: "popup-demo", trusted: true }
    )
  )

  app.query("#btnDialogTop").click()

  await new Promise((resolve) => {
    let cnt = 0
    t.utils.listen({ uidialogopen: () => ++cnt === 2 && resolve() })
  })

  t.timeout("reset")

  const sandbox = app.query("ui-sandbox iframe").contentDocument

  const incrBtns = {
    top: document.querySelector("#btnIncrTop"),
    dialogTop: document.querySelector("#btnIncrDialogTop"),
    iframe: sandbox.querySelector("#btnIncrIframe"),
    dialogIframe: document.querySelector("#btnIncrDialogIframe"),
  }

  const popupBtns = {
    top: document.querySelector("#btnPopupTop"),
    iframe: sandbox.querySelector("#btnPopupIframe"),
  }

  let cnt = 0

  async function checkPopupBtn(btn, label, options) {
    const sel = `#btnIncrPopup${label}`

    t.is(btn.getAttribute("aria-expanded"), "false")

    btn.click()

    await t.utils.when("uipopupopen")

    t.is(btn.getAttribute("aria-expanded"), "true")

    let incr = document.querySelector(sel)
    t.isElement(incr)

    if (options?.incr) {
      t.is(incr.textContent, String(cnt))
      t.eq(getVal(incrBtns), {
        top: String(cnt),
        dialogTop: String(cnt),
        iframe: String(cnt),
        dialogIframe: String(cnt),
      })

      incr.click()
      cnt++
      await system.once("ipc.plugin:end-of-update")
      await t.sleep(20)

      t.is(incr.textContent, String(cnt))
      t.eq(getVal(incrBtns), {
        top: String(cnt),
        dialogTop: String(cnt),
        iframe: String(cnt),
        dialogIframe: String(cnt),
      })

      // popup is still open
      incr = document.querySelector(sel)
      t.isElement(incr)
      t.is(btn.getAttribute("aria-expanded"), "true")

      options.incr.click()
      cnt++
      await t.sleep(20)

      // popup is closed
      incr = document.querySelector(sel)
      t.isNull(incr)
      t.is(btn.getAttribute("aria-expanded"), "false")

      t.eq(getVal(incrBtns), {
        top: String(cnt),
        dialogTop: String(cnt),
        iframe: String(cnt),
        dialogIframe: String(cnt),
      })
    }
  }

  await checkPopupBtn(popupBtns.top, "Top", { incr: incrBtns.top })
  await checkPopupBtn(popupBtns.iframe, "Iframe", { incr: incrBtns.top })
  // await checkPopupBtn(popupBtns.iframe, "Iframe", { incr: incrBtns.iframe })
})
