import type { Directive } from 'vue'

type Handler = () => void
interface ClickOutsideEl extends HTMLElement {
  __clickOutsideHandler?: Handler
  __clickOutsideListener?: (event: Event) => void
}

/** v-click-outside="fn": chiama fn quando si clicca fuori dall'elemento */
export const vClickOutside: Directive<ClickOutsideEl, Handler> = {
  mounted(el, binding) {
    el.__clickOutsideHandler = binding.value
    el.__clickOutsideListener = (event: Event) => {
      if (!(el === event.target || el.contains(event.target as Node))) el.__clickOutsideHandler?.()
    }
    document.addEventListener('click', el.__clickOutsideListener)
  },
  updated(el, binding) {
    el.__clickOutsideHandler = binding.value
  },
  unmounted(el) {
    if (el.__clickOutsideListener) document.removeEventListener('click', el.__clickOutsideListener)
  }
}
