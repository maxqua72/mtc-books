<template>
  <!-- Sopra la scacchiera: lo sfondo scuro impedisce di muovere altri pezzi finché non si sceglie -->
  <div class="absolute inset-0 z-20 flex items-center justify-center bg-black/45 rounded-sm"
    role="dialog" aria-modal="true" aria-label="Scegli il pezzo di promozione"
    @click.self="emit('cancel')" @contextmenu.prevent="emit('cancel')">
    <div class="bg-white rounded-lg shadow-xl border border-neutral-200 p-3">
      <div class="text-xs font-semibold text-neutral-600 mb-2 text-center">Promuovi a…</div>
      <div class="flex gap-2">
        <button v-for="o in OPTIONS" :key="o.piece" type="button" :title="`${o.label} (${o.key})`"
          :aria-label="o.label" @click="emit('choose', o.piece)"
          class="w-16 h-[72px] flex flex-col items-center justify-center rounded-md border border-neutral-300
                 hover:bg-neutral-100 hover:border-neutral-900 transition active:scale-95
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900">
          <!-- Stesse classi della scacchiera: il CSS di cburnett disegna il pezzo.
               <piece> non è un tag HTML: con :is la stringa diventa un elemento nativo (niente avviso di componente non risolto) -->
          <span class="cg-wrap cburnett promo-cell">
            <component :is="'piece'" class="promo-piece" :class="[o.role, color]" />
          </span>
          <span class="text-[10px] font-semibold text-neutral-500 leading-none">{{ o.label }}</span>
        </button>
      </div>
      <button type="button" @click="emit('cancel')"
        class="mt-2 w-full text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 underline underline-offset-2">
        Annulla (Esc)
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ color: 'white' | 'black' }>()

const emit = defineEmits<{
  (e: 'choose', piece: 'q' | 'r' | 'b' | 'n'): void
  (e: 'cancel'): void
}>()

const OPTIONS = [
  { piece: 'q', role: 'queen',  key: 'Q', label: 'Donna' },
  { piece: 'r', role: 'rook',   key: 'R', label: 'Torre' },
  { piece: 'b', role: 'bishop', key: 'B', label: 'Alfiere' },
  { piece: 'n', role: 'knight', key: 'N', label: 'Cavallo' },
] as const
</script>

<style scoped>
.promo-cell {
  display: block;
  position: relative;
  width: 44px;
  height: 44px;
}
/* Il CSS base di Chessground posiziona i pezzi in assoluto al 12,5%: qui devono riempire la cella */
.promo-piece {
  position: relative !important;
  display: block;
  width: 100% !important;
  height: 100% !important;
  background-size: cover;
  pointer-events: none;
  transform: none !important;
}
</style>