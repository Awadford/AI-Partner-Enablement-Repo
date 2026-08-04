/** Opens a URL in a centred floating popup window — visibly smaller than the browser */
export function openPopup(url: string, title = 'Pendo Enablement') {
  const w = Math.round(window.screen.width * 0.65)
  const h = Math.round(window.screen.height * 0.7)
  const left = window.screenX + Math.round((window.outerWidth - w) / 2)
  const top = window.screenY + Math.round((window.outerHeight - h) / 2)
  window.open(
    url,
    title,
    `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
  )
}
