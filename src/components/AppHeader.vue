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

      <button 
        @click="store.triggerPdfExport()"
        class="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow transition mr-2 cursor-pointer"
      >
        Esporta PDF
      </button>

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
    target.value = '' // Resetta l'input
  }
}

const handleSaveFile = async () => {
  // Inviamo un segnale per catturare il contenuto aggiornato dell'editor prima di salvare
  window.dispatchEvent(new CustomEvent('request-editor-sync'))
  
  try {
    // Passiamo una stringa vuota temporanea: il sync reale passerà dal canale globale o dall'evento
    const blob = await store.exportMtcBook(store.activeSectionHtml)
    
    // Download nativo del browser
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
</script>