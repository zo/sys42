// @src https://stackoverflow.com/a/52695341

import inWindow from "../realm/inWindow.js"

export default inWindow &&
  Boolean(
    globalThis.matchMedia?.(
      "(display-mode: browser), (display-mode: fullscreen)"
    ).matches !== true ||
      globalThis.navigator?.standalone ||
      globalThis.document?.referrer.includes("android-app://")
  )
