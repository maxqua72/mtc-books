<template>
  <div class="flex-1 flex flex-col items-center justify-center bg-neutral-50 px-4 py-12 select-none">
    <div class="max-w-md w-full text-center space-y-8">
      
      <!-- Logo / Icona Brand -->
      <div class="space-y-3">
        <div class="w-16 h-16 bg-black rounded-2xl flex items-center justify-center text-white font-serif font-black text-3xl mx-auto shadow-md">
          M
        </div>
        <h1 class="text-2xl font-black text-neutral-900 tracking-tight uppercase">MTC Book Writer</h1>
        <p class="text-sm text-neutral-500">Piattaforma di Micro-Publishing per Libri e Manuali di Scacchi</p>
      </div>

      <!-- Box delle Azioni Principali -->
      <div class="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
        <button 
          @click="showCreateModal = true"
          class="w-full py-3 px-4 bg-neutral-950 text-white text-sm font-bold rounded-xl hover:bg-neutral-800 transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          ➕ Crea un nuovo libro
        </button>

        <div class="relative flex py-2 items-center">
          <div class="flex-grow border-t border-neutral-200"></div>
          <span class="flex-shrink mx-4 text-xs font-mono text-neutral-400 uppercase">Oppure</span>
          <div class="flex-grow border-t border-neutral-200"></div>
        </div>

        <!-- Area di Drop per file .mtcbook -->
        <div 
          @click="triggerFileSelect"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleFileDrop"
          :class="[
            'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2',
            isDragging ? 'border-blue-500 bg-blue-50/50 text-blue-600' : 'border-neutral-200 hover:bg-neutral-50 text-neutral-500'
          ]"
        >
          <span class="text-2xl">📂</span>
          <span class="text-xs font-semibold">Trascina qui il tuo file .mtcbook</span>
          <span class="text-[10px] text-neutral-400">o clicca per sfogliare il computer</span>
          <input 
            type="file" 
            ref="fileInput" 
            accept=".mtcbook" 
            class="hidden" 
            @change="handleFileSelect" 
          />
        </div>
      </div>
    </div>

    <!-- Modale Semplice di Configurazione Nuovo Libro -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div class="bg-white rounded-2xl border border-neutral-200 w-full max-w-sm p-6 shadow-xl space-y-4">
        <h3 class="text-md font-bold text-neutral-900">Configura il nuovo libro</h3>
        
        <div class="space-y-3 text-left">
          <div>
            <label class="text-xs font-bold text-neutral-500 block mb-1">Titolo del Libro</label>
            <input v-model="form.title" type="text" class="w-full text-sm border border-neutral-200 rounded-lg p-2 focus:outline-neutral-400" placeholder="Es. Le mie Grandi Partite" />
          </div>
          <div>
            <label class="text-xs font-bold text-neutral-500 block mb-1">Autore</label>
            <input v-model="form.author" type="text" class="w-full text-sm border border-neutral-200 rounded-lg p-2 focus:outline-neutral-400" placeholder="Nome Cognome" />
          </div>
        </div>

        <div class="flex gap-2 pt-2">
          <button @click="showCreateModal = false" class="flex-1 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg transition cursor-pointer">
            Annulla
          </button>
          <button @click="handleCreateBook" class="flex-1 py-2 text-xs font-bold bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer">
            Inizia a scrivere
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useChessBookStore } from '../stores/chessBookStore'

const store = useChessBookStore()
const showCreateModal = ref(false)
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const form = reactive({
  title: '',
  author: ''
})

const triggerFileSelect = () => fileInput.value?.click()

const processFile = async (file: File) => {
  if (!file.name.endsWith('.mtcbook')) {
    alert('Formato file non valido. Carica un file .mtcbook')
    return
  }
  try {
    const buffer = await file.arrayBuffer()
    await store.loadMtcBook(buffer)
    // @ts-ignore
    store.isBookLoaded = true
  } catch (e) {
    alert('Errore nel caricamento del progetto.')
  }
}

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files?.[0]) processFile(target.files[0])
}

const handleFileDrop = (e: DragEvent) => {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) processFile(file)
}

const handleCreateBook = () => {
  if (!form.title.trim()) return alert('Inserisci un titolo')
  
  store.metadata.title = form.title
  store.metadata.author = form.author || 'Autore'
  store.sectionIndex = []
  store.zippedSectionsCache = {}
  
  const firstId = store.createNewSection("Capitolo 1", "chapter")
  store.changeActiveSection(firstId)
  
  // @ts-ignore
  store.isBookLoaded = true
  showCreateModal.value = false
}
</script>