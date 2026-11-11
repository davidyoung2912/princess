// Pan and zoom maths for the deck plan viewer: no React or DOM, so it can be tested in node.

export interface Size { width: number; height: number }
export interface Transform { scale: number; x: number; y: number }

/** Largest zoom, as a multiple of the fit-to-width scale. */
export const MAX_ZOOM_FACTOR = 6

/** Scale at which the whole plan fits in the view (the smallest zoom allowed). */
export function fitAllScale(view: Size, image: Size): number {
  return Math.min(view.width / image.width, view.height / image.height)
}

/** Scale at which the plan fills the view's width: the starting zoom, since the plans are tall strips. */
export function fitWidthScale(view: Size, image: Size): number {
  return view.width / image.width
}

export function maxScale(view: Size, image: Size): number {
  return Math.max(fitWidthScale(view, image) * MAX_ZOOM_FACTOR, fitAllScale(view, image))
}

/** Keeps the scale in range and the plan on screen: centred on an axis where it is smaller than the view, otherwise not dragged past its edges. */
export function clamp(t: Transform, view: Size, image: Size): Transform {
  const scale = Math.min(maxScale(view, image), Math.max(fitAllScale(view, image), t.scale))
  const w = image.width * scale
  const h = image.height * scale
  const x = w <= view.width ? (view.width - w) / 2 : Math.min(0, Math.max(view.width - w, t.x))
  const y = h <= view.height ? (view.height - h) / 2 : Math.min(0, Math.max(view.height - h, t.y))
  return { scale, x, y }
}

/** The starting view: full width, top of the plan. */
export function initial(view: Size, image: Size): Transform {
  return clamp({ scale: fitWidthScale(view, image), x: 0, y: 0 }, view, image)
}

/** The whole plan in view. */
export function fitAll(view: Size, image: Size): Transform {
  return clamp({ scale: fitAllScale(view, image), x: 0, y: 0 }, view, image)
}

/** Zooms by a factor keeping the point (px, py), in view coordinates, fixed on the plan. */
export function zoomAt(t: Transform, factor: number, px: number, py: number, view: Size, image: Size): Transform {
  const next = Math.min(maxScale(view, image), Math.max(fitAllScale(view, image), t.scale * factor))
  const k = next / t.scale
  return clamp({ scale: next, x: px - (px - t.x) * k, y: py - (py - t.y) * k }, view, image)
}

export function panBy(t: Transform, dx: number, dy: number, view: Size, image: Size): Transform {
  return clamp({ ...t, x: t.x + dx, y: t.y + dy }, view, image)
}

/** Zoom as a whole-number percentage of the plan's natural size. */
export function percent(t: Transform): number {
  return Math.round(t.scale * 100)
}

/** Distance and midpoint of two touch points, for pinch zoom. */
export function pinch(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
