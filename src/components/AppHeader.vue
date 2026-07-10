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
    </div>

    <!-- Azioni Globali Documento -->
    <div class="flex items-center gap-2">
      <button 
        @click="handleNewBook"
        class="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded transition cursor-pointer"
      >
        Nuovo
      </button>
      
      <!-- Input nascosto per caricare il file -->
      <input 
        type="file" 
        ref="fileInput" 
        accept=".mtcbook" 
        class="hidden" 
        @change="handleOpenFile" 
      />
      <button 
        @click="triggerFileSelect"
        class="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 rounded transition cursor-pointer"
      >
        Apri...
      </button>

      <!-- PERSISTENT SPLIT BUTTON -->
      <div class="relative inline-flex items-center" v-click-outside="closeDropdown">
        <!-- Pulsante Azione Principale Persistent -->
        <button 
          @click="executeExport"
          class="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-l shadow transition cursor-pointer border-r border-blue-700 active:bg-blue-800"
        >
          {{ exportMode === 'chapter' ? 'Esporta Capitolo' : 'Esporta Libro' }}
        </button>
        
        <!-- Pulsante Trigger Menu -->
        <button 
          @click="toggleDropdown"
          class="px-2 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-r shadow transition mr-2 cursor-pointer self-stretch flex items-center justify-center active:bg-blue-800"
          aria-haspopup="true"
          :aria-expanded="isDropdownOpen"
        >
          <svg class="w-3 h-3 transition-transform duration-200" :class="{ 'rotate-180': isDropdownOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <!-- Menu Opzioni Dropdown -->
        <div v-if="isDropdownOpen" class="absolute right-2 top-full mt-1 w-48 bg-white border border-neutral-200 rounded shadow-lg z-50 py-1 font-sans">
          <button 
            @click="selectMode('chapter')"
            class="w-full text-left px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50 flex items-center justify-between cursor-pointer"
          >
            <div class="flex flex-col">
              <span class="font-semibold">Esporta Capitolo</span>
              <span class="text-[10px] text-neutral-400 font-normal">Scarica solo la pagina corrente</span>
            </div>
            <svg v-if="exportMode === 'chapter'" class="w-3 h-3 text-blue-600 shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          </button>
          
          <div class="border-t border-neutral-100 my-1"></div>
          
          <button 
            @click="selectMode('book')"
            class="w-full text-left px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50 flex items-center justify-between cursor-pointer"
          >
            <div class="flex flex-col">
              <span class="font-semibold">Esporta Libro</span>
              <span class="text-[10px] text-neutral-400 font-normal">Genera l'opera intera</span>
            </div>
            <svg v-if="exportMode === 'book'" class="w-3 h-3 text-blue-600 shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>

      <button 
        @click="handleSaveFile"
        class="px-4 py-1.5 text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-800 rounded shadow transition cursor-pointer"
      >
        Salva Lavoro
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useChessBookStore } from '../stores/chessBookStore'

const store = useChessBookStore()
const fileInput = ref<HTMLInputElement | null>(null)
const isDropdownOpen = ref(false)

// La scelta persiste: l'utente clicca la freccia per cambiare, ma l'azione non scatta finché non preme il bottone principale
const exportMode = ref<'chapter' | 'book'>('chapter')

const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value
}

const closeDropdown = () => {
  isDropdownOpen.value = false
}

// Cambia la modalità predefinita in modo persistente senza scatenare l'export immediato
const selectMode = (mode: 'chapter' | 'book') => {
  exportMode.value = mode
  isDropdownOpen.value = false
}

// Esegue l'azione persistente impostata sul blocco di sinistra
const executeExport = () => {
  if (exportMode.value === 'chapter') {
    store.triggerPdfExport()
  } else {
    if (typeof (store as any).triggerFullBookPdfExport === 'function') {
      (store as any).triggerFullBookPdfExport()
    } else {
      window.dispatchEvent(new CustomEvent('request-full-book-pdf-export'))
    }
  }
}

const triggerFileSelect = () => {
  fileInput.value?.click()
}

const handleOpenFile = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return
  
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

const handleNewBook = () => {
  if (confirm("Vuoi creare un nuovo libro? I dati non salvati andranno persi.")) {
    store.metadata.title = "Nuovo Libro di Scacchi"
    store.sectionIndex = []
    store.zippedSectionsCache = {}
    const firstId = store.createNewSection("Capitolo 1 — Introduzione", "chapter")
    store.changeActiveSection(firstId)
  }
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