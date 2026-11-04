<template>
  <div v-if="engine.isRunning" class="eval-bar" :class="{ stale }" role="img" :title="label" :aria-label="label">
    <div class="eval-white" :class="flipped ? 'top-0' : 'bottom-0'" :style="{ height: `${percent}%` }"></div>
    <div class="eval-middle"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useEngineStore } from '../../stores/engineStore'
import { useChessTreeStore } from '../../stores/chessTreeStore'
import { formatScore, whitePercent } from '../../utils/uciPv'

const engine = useEngineStore()
const treeStore = useChessTreeStore()

const flipped = computed(() => treeStore.boardFlipped)
const score = computed(() => engine.lines[0]?.score ?? null)
const label = computed(() => `Valutazione: ${formatScore(score.value)}`)
// Linee riferite a una posizione diversa da quella mostrata, o non ancora arrivate
const stale = computed(() => engine.analyzedFen !== treeStore.activeFen)

// Tra una posizione e l'altra le linee si azzerano: la barra resta dov'era fino alla nuova valutazione
const percent = ref(score.value ? whitePercent(score.value) : 50)
watch(score, (s) => { if (s) percent.value = whitePercent(s) })
watch(() => engine.isRunning, (running) => { if (!running) percent.value = 50 })
</script>

<style scoped>
/* I colori restano fissi in tutti i temi: rappresentano Bianco e Nero */
.eval-bar {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 100%;
  margin-left: 5px;
  width: 12px;
  overflow: hidden;
  border: 1px solid #a3a3a3;
  border-radius: 2px;
  background: #262626;
  transition: opacity 0.15s;
}
.eval-bar.stale { opacity: 0.45; }
.eval-white {
  position: absolute;
  left: 0;
  right: 0;
  background: #f5f5f5;
  transition: height 0.15s;
}
.eval-middle {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: #a3a3a3;
}
</style>
