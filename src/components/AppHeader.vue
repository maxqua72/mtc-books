<template>
  <header class="h-14 bg-white border-b border-neutral-200 px-6 flex items-center justify-between shadow-sm shrink-0">
    <!-- Brand / Logo -->
    <div class="flex items-center gap-3">
      <div class="w-7 h-7 bg-black rounded flex items-center justify-center text-white font-serif font-black text-sm">
        M
      </div>
      <span class="text-md font-black text-neutral-950 tracking-tight uppercase">MTC Book</span>
      <span class="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded font-mono border border-neutral-200">
        v1.0.0
      </span>

      <!-- Separatore -->
      <div class="h-4 w-[1px] bg-neutral-200 mx-1"></div>

      <!-- INDICATORE STATO SALVATAGGIO AUTOMATICO -->
      <div class="flex items-center gap-1.5 text-xs transition-all duration-200 select-none">
        <!-- Stato 1: Salvataggio in corso -->
        <template v-if="saveStatus === 'saving'">
          <svg class="w-3.5 h-3.5 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
            </path>
          </svg>
          <span class="text-blue-600 font-medium">Salvataggio in corso...</span>
        </template>

        <!-- Stato 2: Tutte le modifiche salvate -->
        <template v-else-if="saveStatus === 'saved'">
          <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-neutral-500 font-normal">Salvataggio completato</span>
        </template>

        <!-- Stato 3: Modifiche in attesa di salvataggio (Debounce) -->
        <template v-else-if="saveStatus === 'unsaved'">
          <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          <span class="text-amber-600 font-medium">Modifiche non salvate</span>
        </template>
      </div>
    </div>

    <!-- Azioni Globali Documento -->
    <div class="flex items-center gap-2">
      <button @click="handleNewBook"
        class="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded transition cursor-pointer">
        Nuovo
      </button>

      <!-- Input nascosto per caricare il file -->
      <input type="file" ref="fileInput" accept=".mtcbook" class="hidden" @change="handleOpenFile" />
      <button @click="triggerFileSelect"
        class="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded transition cursor-pointer">
        Apri...
      </button>

      <!-- PERSISTENT SPLIT BUTTON -->
      <div class="relative inline-flex items-center" v-click-outside="closeDropdown">
        <!-- Pulsante Azione Principale Persistent -->
        <button @click="executeExport"
          class="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-l shadow transition cursor-pointer border-r border-blue-700 active:bg-blue-800">
          {{ exportButtonLabel }}
        </button>

        <!-- Pulsante Trigger Menu -->
        <button @click="toggleDropdown"
          class="px-2 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-r shadow transition mr-2 cursor-pointer self-stretch flex items-center justify-center active:bg-blue-800"
          aria-haspopup="true" :aria-expanded="isDropdownOpen">
          <svg class="w-3 h-3 transition-transform duration-200" :class="{ 'rotate-180': isDropdownOpen }" fill="none"
            stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <!-- Menu Opzioni Dropdown -->
        <div v-if="isDropdownOpen"
          class="absolute right-2 top-full mt-1 w-48 bg-white border border-neutral-200 rounded shadow-lg z-50 py-1 font-sans">
          <button @click="selectMode('chapter-server')"
            class="w-full text-left px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50 flex items-center justify-between cursor-pointer">
            <div class="flex flex-col">
              <span class="font-semibold text-blue-700">Esporta Capitolo (Server)</span>
              <span class="text-[10px] text-neutral-400 font-normal">Rendering vettoriale via Node/Playwright</span>
            </div>
            <svg v-if="exportMode === 'chapter-server'" class="w-3 h-3 text-blue-600 shrink-0 ml-2" fill="currentColor"
              viewBox="0 0 20 20">
              <path fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd" />
            </svg>
          </button>

          <button @click="selectMode('book-server')"
            class="w-full text-left px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50 flex items-center justify-between cursor-pointer">
            <div class="flex flex-col">
              <span class="font-semibold text-blue-700">Esporta Libro (Server)</span>
              <span class="text-[10px] text-neutral-400 font-normal">Genera l'opera intera con impaginazione
                server</span>
            </div>
            <svg v-if="exportMode === 'book-server'" class="w-3 h-3 text-blue-600 shrink-0 ml-2" fill="currentColor"
              viewBox="0 0 20 20">
              <path fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <button @click="handleSaveFile"
        class="px-4 py-1.5 text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 rounded shadow transition cursor-pointer">
        Salva Lavoro
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChessBookStore } from '../stores/chessBookStore'

type ExportMode = 'chapter-server' | 'book-server'

const store = useChessBookStore()
const fileInput = ref<HTMLInputElement | null>(null)
const isDropdownOpen = ref(false)

// Lettura dello stato di salvataggio dallo store (reattivo)
const saveStatus = computed(() => store.saveStatus)

// La scelta persiste: l'utente clicca la freccia per cambiare, ma l'azione non scatta finché non preme il bottone principale
// Modalità predefinita
const exportMode = ref<ExportMode>('chapter-server')

// Titolo dinamico del pulsante
const exportButtonLabel = computed(() => {
  switch (exportMode.value) {
    case 'chapter-server':
      return 'Esporta Capitolo (Server)'
    case 'book-server':
      return 'Esporta Libro (Server)'
  }
})

const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value
}

const closeDropdown = () => {
  isDropdownOpen.value = false
}

// Cambia la modalità predefinita in modo persistente senza scatenare l'export immediato
const selectMode = (mode: ExportMode) => {
  exportMode.value = mode
  isDropdownOpen.value = false
}

// Esegue l'azione persistente impostata sul blocco di sinistra
const executeExport = () => {
  switch (exportMode.value) {
    case 'chapter-server':
      store.triggerServerChapterPdfExport()
      break
    case 'book-server':
      store.triggerServerFullBookPdfExport()
      break
  }
}

const triggerFileSelect = () => {
  fileInput.value?.click()
}

const handleOpenFile = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return

  if (store.isBookLoaded &&
    !confirm("Aprire un altro libro? Il libro corrente verrà sostituito. Se non l'hai ancora salvato, esporta prima un file .mtcbook.")) {
    target.value = ''
    return
  }

  const file = target.files[0]
  try {
    const arrayBuffer = await file.arrayBuffer()
    await store.loadMtcBook(arrayBuffer)
    alert(`Libro "${store.metadata.title}" caricato con successo!`)
  } catch (error) {
    console.error(error)
    alert("Errore durante il caricamento del file .mtcbook")
  } finally {
    target.value = ''
  }
}

const handleSaveFile = async () => {
  window.dispatchEvent(new CustomEvent('request-editor-sync'))

  try {
    const blob = await store.exportMtcBook(store.activeSectionHtml)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${store.metadata.title.toLowerCase().replace(/\s+/g, '_')}.mtcbook`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error(error)
    alert("Errore durante il salvataggio.")
  }
}
/*
const handleNewBook = () => {
  if (confirm("Vuoi creare un nuovo libro? I dati non salvati andranno persi.")) {
    store.metadata.title = "Nuovo Libro di Scacchi"
    store.sectionIndex = []
    store.zippedSectionsCache = {}
    const firstId = store.createNewSection("Capitolo 1 — Introduzione", "chapter")
    store.changeActiveSection(firstId)
  }
}*/

const handleNewBook = async () => {
  if (!confirm("Vuoi creare un nuovo libro? I dati non salvati andranno persi.")) return
  await store.startNewBook('Nuovo Libro di Scacchi', 'Autore')
}


const vClickOutside = {
  mounted(el: any, binding: any) {
    el.clickOutsideEvent = (event: Event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value()
      }
    }
    document.addEventListener('click', el.clickOutsideEvent)
  },
  unmounted(el: any) {
    document.removeEventListener('click', el.clickOutsideEvent)
  }
}
</script>