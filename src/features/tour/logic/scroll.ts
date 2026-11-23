/** Everything the tour has scrolled so far, so the page can be put back when the tour is done with it. */
const moved = new Set<Element>()

/** Scrolls a tour target into view and remembers which parts of the page moved to do it. */
export function scrollIntoViewTracked(el: HTMLElement): void {
  const chain: Element[] = []
  for (let n: Element | null = el.parentElement; n; n = n.parentElement) chain.push(n)
  const before = chain.map((n) => n.scrollTop)
  el.scrollIntoView({ block: 'center', behavior: 'auto' })
  chain.forEach((n, i) => { if (n.scrollTop !== before[i]) moved.add(n) })
}

/** Puts back to the top whatever the tour scrolled. True when something had been moved. */
export function resetTourScroll(): boolean {
  if (moved.size === 0) return false
  for (const n of moved) n.scrollTop = 0
  moved.clear()
  return true
}
