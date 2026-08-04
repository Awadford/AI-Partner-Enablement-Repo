/** Opens a URL in a centred floating popup window rather than a new tab */
export function openPopup(url: string, title = 'Pendo Enablement') {
  const w = 1100
  const h = 720
  const left = window.screenX + (window.outerWidth - w) / 2
  const top = window.screenY + (window.outerHeight - h) / 2
  window.open(
    url,
    title,
    `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
  )
}
