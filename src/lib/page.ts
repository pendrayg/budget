/** Recharge la page — à part, pour que les tests puissent le remplacer : jsdom ne navigue pas. */
export function reloadPage(): void {
  window.location.reload()
}
