<template>
  <!-- Action bar a comparsa (fuori dalla scacchiera, a destra): 4 righe da 3 pulsanti -->
  <div class="diagram-actions-menu">
    <template v-for="(group, gi) in groups" :key="gi">
      <div v-if="gi > 0" class="action-divider"></div>
      <button v-for="b in group" :key="b.id" :title="b.title" @click="b.run"
        class="action-btn" :class="{ active: b.active, 'delete-btn-icon': b.danger }">
        <svg v-if="b.icon.kind === 'svg'" xmlns="http://www.w3.org/2000/svg" :width="b.icon.size" :height="b.icon.size"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          :stroke-linecap="b.icon.linecap" :stroke-linejoin="b.icon.linejoin" v-html="b.icon.inner"></svg>
        <i v-else-if="b.icon.kind === 'fa'" :class="['fa-solid', b.icon.name]" style="font-size: 13px"></i>
        <span v-else style="font-size: 11px; font-weight: 700">{{ b.icon.text }}</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DiagramSizeLevel } from '../../utils/diagramSizes'

type Align = 'left' | 'center' | 'right'

const props = defineProps<{
  sizeLevel: DiagramSizeLevel
  align: Align
  flipped: boolean
  captionEditable: boolean
}>()

const emit = defineEmits<{
  (e: 'size', level: DiagramSizeLevel): void
  (e: 'align', value: Align): void
  (e: 'toggleCaption'): void
  (e: 'flip'): void
  (e: 'loadOnBoard'): void
  (e: 'paragraph', where: 'before' | 'after'): void
  (e: 'remove'): void
}>()

type Icon =
  | { kind: 'svg'; size: number; inner: string; linecap?: 'round'; linejoin?: 'round' }   // inner: markup statico, scritto qui sotto
  | { kind: 'fa'; name: string }
  | { kind: 'text'; text: string }

interface MenuButton {
  id: string
  title: string
  icon: Icon
  active?: boolean
  danger?: boolean
  run: () => void
}

const sizeBtn = (level: DiagramSizeLevel, title: string, size: number, rect: string): MenuButton => ({
  id: `size-${level}`, title, active: props.sizeLevel === level, run: () => emit('size', level),
  icon: { kind: 'svg', size, inner: rect },
})

const alignBtn = (value: Align, title: string, inner: string): MenuButton => ({
  id: `align-${value}`, title, active: props.align === value, run: () => emit('align', value),
  icon: { kind: 'svg', size: 16, inner, linecap: 'round' },
})

// Un array per riga della barra: i separatori si disegnano tra un gruppo e l'altro
const groups = computed<MenuButton[][]>(() => [
  // Riga 1: dimensione
  [
    sizeBtn('small', 'Dimensione piccola', 14, '<rect x="6" y="6" width="12" height="12" rx="1" />'),
    sizeBtn('medium', 'Dimensione media', 16, '<rect x="4" y="4" width="16" height="16" rx="2" />'),
    sizeBtn('large', 'Dimensione grande', 18, '<rect x="2" y="2" width="20" height="20" rx="2" />'),
  ],
  // Riga 2: allineamento
  [
    alignBtn('left', 'A sinistra: il testo scorre accanto',
      '<rect x="3" y="3" width="8" height="8" rx="1" /><path d="M15 5h6M15 9h6M3 15h18M3 19h18" />'),
    alignBtn('center', 'Al centro',
      '<rect x="8" y="3" width="8" height="8" rx="1" /><path d="M3 15h18M3 19h18" />'),
    alignBtn('right', 'A destra: il testo scorre accanto',
      '<rect x="13" y="3" width="8" height="8" rx="1" /><path d="M3 5h6M3 9h6M3 15h18M3 19h18" />'),
  ],
  // Riga 3: didascalia, inversione, scacchiera
  [
    {
      id: 'caption', title: 'Modifica didascalia (Invio per confermare)', active: props.captionEditable,
      run: () => emit('toggleCaption'),
      icon: {
        kind: 'svg', size: 15, linecap: 'round', linejoin: 'round',
        inner: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>',
      },
    },
    { id: 'flip', title: 'Inverti il diagramma (Nero in basso)', active: props.flipped, run: () => emit('flip'),
      icon: { kind: 'fa', name: 'fa-arrows-rotate' } },
    { id: 'load', title: 'Carica la posizione sulla scacchiera', run: () => emit('loadOnBoard'),
      icon: { kind: 'fa', name: 'fa-chess-board' } },
  ],
  // Riga 4: paragrafi attorno al blocco, eliminazione
  [
    { id: 'p-before', title: 'Inserisci un paragrafo sopra', run: () => emit('paragraph', 'before'),
      icon: { kind: 'text', text: '¶↑' } },
    { id: 'p-after', title: 'Inserisci un paragrafo sotto', run: () => emit('paragraph', 'after'),
      icon: { kind: 'text', text: '¶↓' } },
    {
      id: 'remove', title: 'Elimina diagramma', danger: true, run: () => emit('remove'),
      icon: {
        kind: 'svg', size: 16,
        inner: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />',
      },
    },
  ],
])
</script>

<style scoped>
/* Fuori dalla scacchiera, a destra */
.diagram-actions-menu {
  position: absolute;
  /* Allinea il menu alla prima linea nera della scacchiera */
  top: 4px;
  left: calc(100% + 6px);
  display: grid;
  grid-template-columns: repeat(3, 28px);
  gap: 2px;

  background-color: #ffffff;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.08);
  padding: 2px;

  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
  z-index: 30;
}

/* PONTE INVISIBILE: mantiene l'hover attivo nel micro-spazio tra scacchiera e menu */
.diagram-actions-menu::before {
  content: '';
  position: absolute;
  top: -10px;
  bottom: -10px;
  left: -15px;
  right: 0;
  background: transparent;
  z-index: -1;
}

/* Compare al passaggio del mouse sulla card del diagramma (che sta nel componente padre) */
:global(.diagram-card:hover) .diagram-actions-menu {
  opacity: 1;
  pointer-events: auto;
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #525252;
  cursor: pointer;
  transition: background-color 0.1s, color 0.1s;
}

.action-btn:hover {
  background-color: #f5f5f5;
  color: #171717;
}

.action-btn.active {
  background-color: #e5e5e5;
  color: #171717;
}

.delete-btn-icon:hover {
  background-color: #fee2e2;
  color: #dc2626;
}

.action-divider {
  grid-column: 1 / -1;
  height: 1px;
  background-color: #e5e5e5;
  margin: 2px 4px;
}
</style>
