<template>
  <!-- Frecce e marcatori: il font Merida non li ha, quindi un SVG sopra la scacchiera (griglia 10x10:
       bordo sinistro + 8 colonne + bordo destro; riga delle coordinate + 8 traverse + riga in basso).
       Stili inline: nel PDF non arrivano gli stili scoped dei componenti. -->
  <svg v-if="items.length" viewBox="0 0 10 10" preserveAspectRatio="none" aria-hidden="true"
    :style="SHAPES_SVG_STYLE">
    <template v-for="(s, i) in items" :key="i">
      <circle v-if="s.kind === 'circle'" :cx="s.cx" :cy="s.cy" r="0.42" fill="none" :stroke="s.color"
        stroke-width="0.09" opacity="0.9" />
      <path v-else-if="s.kind === 'x'" :d="s.d" fill="none" :stroke="s.color" stroke-width="0.09"
        stroke-linecap="round" opacity="0.9" />
      <polygon v-else :points="s.points" :fill="s.color" stroke="#ffffff" stroke-width="0.03"
        stroke-linejoin="round" opacity="0.85" />
    </template>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { buildShapeItems, SHAPES_SVG_STYLE } from '../../utils/diagramShapes'

const props = defineProps<{
  shapes: unknown      // attributo `shapes` del nodo (viene ripulito prima dell'uso)
  flipped: boolean
}>()

const items = computed(() => buildShapeItems(props.shapes, props.flipped))
</script>
