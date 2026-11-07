import type { Directive } from 'vue'
import { splitTooltip } from '../utils/tooltipText'

const SHOW_DELAY_MS = 350
const SWITCH_WINDOW_MS = 400   // subito dopo un altro tooltip non si aspetta: si passa da un pulsante all'altro
const GAP_PX = 6
const EDGE_PX = 8

let bubble: HTMLElement | null = null
let anchor: HTMLElement | null = null     // elemento di cui si mostra, o si sta per mostrare, il tooltip
let pressed: HTMLElement | null = null    // appena cliccato: niente tooltip finché il puntatore non lo lascia
let timer: number | undefined
let hiddenAt = 0

const getBubble = () => {
  if (!bubble) {
    bubble = document.createElement('div')
    bubble.className = 'app-tooltip'
    bubble.setAttribute('role', 'tooltip')
    bubble.hidden = true
    document.body.appendChild(bubble)
  }
  return bubble
}

const fill = (value: string) => {
  const { text, shortcut } = splitTooltip(value)
  const box = getBubble()
  box.textContent = text   // mai innerHTML: il testo può contenere titoli scritti dall'utente
  if (shortcut) {
    const keys = document.createElement('kbd')
    keys.textContent = shortcut
    box.appendChild(keys)
  }
}

// Sotto l'elemento o, se non c'è spazio, sopra; sempre dentro la finestra
const place = (el: HTMLElement) => {
  const box = getBubble()
  const r = el.getBoundingClientRect()
  const { offsetWidth: w, offsetHeight: h } = box
  const left = Math.max(EDGE_PX, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - EDGE_PX))
  const below = r.bottom + GAP_PX
  const top = below + h > window.innerHeight - EDGE_PX ? r.top - h - GAP_PX : below
  // Un elemento più alto della finestra (la fascia della rilegatura) ha i bordi fuori vista: il fumetto resta dentro
  const maxTop = window.innerHeight - h - EDGE_PX
  box.style.left = `${left}px`
  box.style.top = `${Math.max(EDGE_PX, Math.min(top, maxTop))}px`
}

const hide = () => {
  window.clearTimeout(timer)
  anchor = null
  if (bubble && !bubble.hidden) {
    bubble.hidden = true
    hiddenAt = Date.now()
  }
}

const show = (el: HTMLElement) => {
  // A menu aperto il tooltip coprirebbe il pannello
  if (!el.isConnected || !el.dataset.tooltip || el.getAttribute('aria-expanded') === 'true') return hide()
  fill(el.dataset.tooltip)
  const box = getBubble()
  box.hidden = false
  place(el)
}

const schedule = (el: HTMLElement) => {
  const visible = !!bubble && !bubble.hidden
  const recent = Date.now() - hiddenAt < SWITCH_WINDOW_MS
  window.clearTimeout(timer)
  anchor = el
  if (visible || recent) show(el)
  else timer = window.setTimeout(() => show(el), SHOW_DELAY_MS)
}

const tooltipTarget = (node: EventTarget | null) =>
  node instanceof Element ? node.closest<HTMLElement>('[data-tooltip]') : null

const onPointerOver = (e: PointerEvent) => {
  if (e.pointerType === 'touch') return
  const el = tooltipTarget(e.target)
  if (el !== pressed) pressed = null
  if (!el) return hide()
  if (el !== anchor && el !== pressed) schedule(el)
}

const onPointerOut = (e: PointerEvent) => {
  if (!e.relatedTarget) { pressed = null; hide() }   // il puntatore è uscito dalla finestra
}

const onPointerDown = (e: PointerEvent) => {
  pressed = tooltipTarget(e.target)
  hide()
}

const onFocusIn = (e: FocusEvent) => {
  const el = tooltipTarget(e.target)
  if (el && (e.target as Element).matches(':focus-visible')) schedule(el)
}

const onFocusOut = (e: FocusEvent) => {
  if (tooltipTarget(e.target) === anchor) hide()
}

// Solo se si sposta l'elemento: lo scorrimento di un altro pannello non c'entra, e la posizione si calcola alla comparsa
const onScroll = (e: Event) => {
  if (anchor && bubble && !bubble.hidden && e.target instanceof Node && e.target.contains(anchor)) hide()
}

let installed = false
const install = () => {
  if (installed) return
  installed = true
  document.addEventListener('pointerover', onPointerOver)
  document.addEventListener('pointerout', onPointerOut)
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
  document.addEventListener('keydown', hide, true)
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', hide)
}

// Senza title un pulsante con sola icona resterebbe senza nome per gli screen reader: il testo diventa il nome.
// Con .desc l'elemento ha già un testo visibile, che resta il nome: il tooltip diventa la descrizione.
const apply = (el: HTMLElement, value: string | null | undefined, describe: boolean) => {
  const attr = describe ? 'aria-description' : 'aria-label'
  if (!value) {   // nessun testo in questo stato: niente tooltip
    if (anchor === el) hide()
    delete el.dataset.tooltip
    el.removeAttribute(attr)
    return
  }
  if (el.dataset.tooltip === value) return
  el.dataset.tooltip = value
  el.setAttribute(attr, value)
  if (anchor === el && bubble && !bubble.hidden) show(el)
}

/**
 * v-tooltip="testo": un solo riquadro condiviso; un testo finale «(Ctrl+…)», «(Esc)» o «(Q)» appare come scorciatoia.
 * v-tooltip.desc per gli elementi che hanno già un testo visibile.
 */
export const vTooltip: Directive<HTMLElement, string | null | undefined> = {
  mounted(el, binding) {
    install()
    apply(el, binding.value, !!binding.modifiers.desc)
  },
  updated(el, binding) {
    apply(el, binding.value, !!binding.modifiers.desc)
  },
  unmounted(el) {
    if (anchor === el) hide()
    if (pressed === el) pressed = null
  },
}
