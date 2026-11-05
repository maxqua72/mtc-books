<template>
  <div class="space-y-2">
    <p v-if="!engine.profiles.length" class="text-[11px] text-neutral-600 leading-snug">
      Nessun motore configurato. Indica dove si trova il programma di un motore UCI (ad esempio Stockfish) già
      installato sul computer: MTC Books lo avvia e lo ferma da solo. Non viene scaricato nulla.
      <a href="https://stockfishchess.org/download/" target="_blank" rel="noopener noreferrer"
        class="underline">Pagina di download di Stockfish</a>
    </p>

    <ul v-if="engine.profiles.length" class="space-y-2">
      <li v-for="p in engine.profiles" :key="p.id" class="rounded border border-neutral-200 p-2 space-y-1.5">
        <div class="flex items-center gap-2">
          <input type="radio" name="engine-profile" :checked="p.id === engine.activeProfileId" :disabled="busy"
            :title="'Usa questo motore'" @change="select(p.id)" />
          <input type="text" :value="p.name" @change="rename(p, $event)" aria-label="Nome del profilo"
            class="flex-1 min-w-0 text-xs font-semibold border border-neutral-200 rounded px-1.5 py-0.5 bg-white" />
          <button type="button" @click="remove(p)" class="text-[11px] text-red-600 hover:underline">Rimuovi</button>
        </div>
        <div class="text-[10px] font-mono text-neutral-500 break-all">{{ p.path }}</div>
        <label class="block text-[10px] text-neutral-500">Argomenti di avvio (valgono dal prossimo avvio)
          <input type="text" :value="formatArgs(p.args)" placeholder="(nessuno)" @change="setArgs(p, $event)"
            class="w-full font-mono text-[11px] border border-neutral-200 rounded px-1.5 py-0.5 bg-white" />
        </label>
      </li>
    </ul>

    <div class="space-y-1.5">
      <label class="block text-[11px] text-neutral-500">Argomenti di avvio del nuovo motore (facoltativo)
        <input v-model="newArgs" type="text" placeholder="es. --weights &quot;C:\Reti\rete.pb&quot;"
          class="w-full font-mono text-[11px] border border-neutral-200 rounded px-2 py-1 bg-white" />
      </label>
      <div class="flex gap-2">
        <button type="button" :disabled="busy" @click="add"
          class="flex-1 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white disabled:bg-neutral-200 disabled:text-neutral-400 rounded text-xs font-medium transition">
          Scegli motore…
        </button>
        <button type="button" :disabled="busy" @click="search"
          class="flex-1 py-1.5 border border-neutral-300 hover:bg-neutral-100 disabled:opacity-40 rounded text-xs font-medium transition">
          Cerca Stockfish
        </button>
      </div>
      <p v-if="busy" class="text-[11px] text-neutral-500">Verifica del motore in corso…</p>
      <p v-if="message" class="text-[11px] text-neutral-600">{{ message }}</p>

      <ul v-if="candidates" class="space-y-1">
        <li v-if="!candidates.length" class="text-[11px] text-neutral-500">Nessun Stockfish trovato nelle cartelle comuni.</li>
        <li v-for="c in candidates" :key="c.token" class="flex items-center gap-2">
          <span class="flex-1 min-w-0 text-[10px] font-mono text-neutral-600 break-all">{{ c.path }}</span>
          <button type="button" :disabled="busy" @click="addFound(c.token)"
            class="shrink-0 text-[11px] font-semibold underline">Aggiungi</button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { EngineCandidate, EngineProfile } from '@mtc/shared'
import { useEngineStore } from '../../../stores/engineStore'
import { formatArgs, parseArgs } from '../../../utils/engineArgs'

const engine = useEngineStore()
const newArgs = ref('')
const candidates = ref<EngineCandidate[] | null>(null)
const busy = ref(false)
const message = ref<string | null>(null)

async function guarded(job: () => Promise<void>) {
  busy.value = true
  message.value = null
  try { await job() } finally { busy.value = false }
}

const add = () => guarded(async () => {
  const r = await engine.addProfile(parseArgs(newArgs.value))
  if (r.ok && r.value) { newArgs.value = ''; message.value = `Aggiunto: ${r.value.name}` }
})

const search = () => guarded(async () => {
  const r = await engine.detect()
  candidates.value = r.ok ? r.value : []
})

const addFound = (token: string) => guarded(async () => {
  const r = await engine.addDetected(token, parseArgs(newArgs.value))
  if (r.ok) { candidates.value = null; newArgs.value = ''; message.value = `Aggiunto: ${r.value.name}` }
})

const select = (id: string) => guarded(async () => { await engine.setActiveProfile(id) })

const rename = async (p: EngineProfile, event: Event) => {
  const el = event.target as HTMLInputElement
  const name = el.value.trim()
  if (!name) { el.value = p.name; return }
  await engine.updateProfile(p.id, { name })
}

const setArgs = async (p: EngineProfile, event: Event) => {
  await engine.updateProfile(p.id, { args: parseArgs((event.target as HTMLInputElement).value) })
}

const remove = (p: EngineProfile) => {
  if (!confirm(`Rimuovere il motore «${p.name}» dall'elenco? Il programma non viene cancellato dal computer.`)) return
  void engine.removeProfile(p.id)
}
</script>