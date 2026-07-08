<template>
    <aside class="w-64 bg-white border-r border-neutral-200 flex flex-col shrink-0 h-full select-none no-print">
        <!-- Intestazione Informazioni Libro -->
        <div class="p-4 border-b border-neutral-100 flex items-center justify-between gap-2">
            <div class="space-y-1 min-w-0 flex-1">
                <h2 class="text-xs font-bold text-neutral-400 uppercase tracking-wider">Progetto Attivo</h2>
                <div class="text-sm font-black text-neutral-900 truncate" :title="store.metadata.title">
                    {{ store.metadata.title }}
                </div>
                <div class="text-[11px] text-neutral-400 font-medium truncate">
                    di {{ store.metadata.author }}
                </div>
            </div>
            
            <!-- Pulsante per aprire la maschera delle proprietà -->
            <button 
                @click="isPropsOpen = true" 
                class="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition shrink-0"
                title="Proprietà Libro"
            >
                ⚙️
            </button>
        </div>

        <!-- Elenco Sezioni (Indice Strutturale) -->
        <div class="flex-1 overflow-y-auto p-2 space-y-0.5">
            <div v-for="(section, index) in store.sectionIndex" :key="section.id"
                @click="handleSectionClick(section.id)" 
                :draggable="section.type === 'chapter'"
                @dragstart="onDragStart(index)"
                @dragover.prevent="onDragOver(index)"
                @dragleave="onDragLeave(index)"
                @drop="onDrop(index)"
                :class="[
                    'group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer relative',
                    store.activeSectionId === section.id
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
                    section.type === 'chapter' ? 'cursor-grab active:cursor-grabbing' : '',
                    // Classi dinamiche per il feedback visivo del drag
                    activeDropIndex === index && section.type === 'chapter' ? 'bg-neutral-100 border-t-2 border-neutral-900 pt-1.5' : ''
                ]">
                
                <div class="flex items-center gap-2 truncate">
                    <!-- Icona di trascinamento visibile al passaggio del mouse sui capitoli -->
                    <span v-if="section.type === 'chapter'" class="opacity-0 group-hover:opacity-100 text-neutral-400 mr-0.5 cursor-grab">
                        ⋮⋮
                    </span>
                    <span>{{ getIcon(section.type) }}</span>
                    <span class="truncate">{{ section.title }}</span>
                </div>

                <!-- Azioni rapide al passaggio del mouse -->
                <div class="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity pl-1 shrink-0">
                    <!-- Rinomina -->
                    <button @click.stop="promptRename(section)" class="p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded text-[10px]" title="Rinomina voce indice">
                        ✏️
                    </button>
                    <!-- Elimina -->
                    <button @click.stop="deleteSection(section, index)" class="p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded text-[10px]" title="Elimina sezione">
                        🗑️
                    </button>
                </div>
            </div>
        </div>

        <!-- Pulsante Aggiungi Capitolo in fondo -->
        <div class="p-3 border-t border-neutral-100 space-y-1">
            <button @click="addSection('chapter')"
                class="w-full py-2 px-3 border border-neutral-200 hover:border-neutral-900 rounded-lg text-xs font-bold text-neutral-700 transition">
                ➕ Nuovo Capitolo
            </button>
            <div class="flex gap-1">
                <button @click="addSection('cover')"
                    class="flex-1 py-1.5 border border-neutral-200 text-[10px] font-bold text-neutral-600 rounded hover:bg-neutral-50">
                    📘 Copertina
                </button>
                <button @click="addSection('index')"
                    class="flex-1 py-1.5 border border-neutral-200 text-[10px] font-bold text-neutral-600 rounded hover:bg-neutral-50">
                    📋 Indice
                </button>
            </div>
        </div>
    </aside>

    <!-- Iniezione del Modale delle Proprietà fuori dal tag aside -->
    <BookPropertiesModal :is-open="isPropsOpen" @close="isPropsOpen = false" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useChessBookStore, type SectionType, type SectionIndexItem } from '../stores/chessBookStore'
import BookPropertiesModal from './BookPropertiesModal.vue'

const store = useChessBookStore()
const isPropsOpen = ref(false)

// Variabili di stato per il Drag and Drop
const draggedIndex = ref<number | null>(null)
const activeDropIndex = ref<number | null>(null)

const getIcon = (type: SectionType) => {
    if (type === 'cover') return '📘'
    if (type === 'index') return '📋'
    return '📝'
}

const handleSectionClick = async (id: string) => {
    if (store.activeSectionId === id) return
    window.dispatchEvent(new CustomEvent('request-editor-sync'))
    await store.changeActiveSection(id, store.activeSectionHtml)
}

const addSection = (type: SectionType) => {
  if (type !== 'chapter' && store.sectionIndex.some(s => s.type === type)) {
    alert(`Il libro contiene già una sezione di tipo: ${type === 'cover' ? 'Copertina' : 'Indice'}`)
    return
  }

  const titles: Record<SectionType, string> = {
    cover: 'Copertina',
    index: 'Indice Generale',
    chapter: `Capitolo ${store.sectionIndex.filter(s => s.type === 'chapter').length + 1}`
  }

  const id = store.createNewSection(titles[type], type)

  if (type === 'cover' && store.sectionIndex.length > 1) {
    const currentIndex = store.sectionIndex.findIndex(s => s.id === id)
    if (currentIndex !== -1) {
      const [coverItem] = store.sectionIndex.splice(currentIndex, 1)
      store.sectionIndex.unshift(coverItem)
    }
  } else if (type === 'chapter') {
    const indexPosition = store.sectionIndex.findIndex(s => s.type === 'index')
    const currentPosition = store.sectionIndex.findIndex(s => s.id === id)
    if (indexPosition !== -1 && currentPosition > indexPosition) {
        const [chapterItem] = store.sectionIndex.splice(currentPosition, 1)
        store.sectionIndex.splice(indexPosition, 0, chapterItem)
    }
  }

  handleSectionClick(id)
}

const promptRename = (section: SectionIndexItem) => {
    const newTitle = prompt(`Inserisci il nuovo nome identificativo per l'indice:`, section.title)
    if (newTitle && newTitle.trim()) {
        section.title = newTitle.trim()
    }
}

const deleteSection = async (section: SectionIndexItem, index: number) => {
    const confirmDelete = confirm(`Sei sicuro di voler eliminare definitivamente "${section.title}"? Tutto il testo al suo interno andrà perduto.`)
    if (!confirmDelete) return

    store.sectionIndex.splice(index, 1)

    if (store.zippedSectionsCache[section.id]) {
        delete store.zippedSectionsCache[section.id]
    }

    if (store.activeSectionId === section.id) {
        store.activeSectionId = null
        store.activeSectionHtml = ''
        
        if (store.sectionIndex.length > 0) {
            await store.changeActiveSection(store.sectionIndex[0].id)
        }
    }
}

// --- FUNZIONI DRAG AND DROP CON FEEDBACK ---
const onDragStart = (index: number) => {
    draggedIndex.value = index
}

const onDragOver = (index: number) => {
    // Mostriamo il feedback visivo solo se stiamo passando sopra un capitolo valido
    if (draggedIndex.value !== null && draggedIndex.value !== index) {
        activeDropIndex.value = index
    }
}

const onDragLeave = (index: number) => {
    if (activeDropIndex.value === index) {
        activeDropIndex.value = null
    }
}

const onDrop = (targetIndex: number) => {
    const fromIndex = draggedIndex.value
    
    // Resettiamo subito gli stati grafici
    draggedIndex.value = null
    activeDropIndex.value = null

    if (fromIndex === null || fromIndex === targetIndex) return

    const draggedSection = store.sectionIndex[fromIndex]
    const targetSection = store.sectionIndex[targetIndex]

    // Blocchi di sicurezza strutturali
    if (draggedSection.type !== 'chapter') return
    if (targetSection.type === 'cover' && targetIndex === 0) return

    let finalTargetIndex = targetIndex
    if (targetSection.type === 'index') {
        finalTargetIndex = store.sectionIndex.findIndex(s => s.type === 'index')
    }

    // Spostamento effettivo delle posizioni
    store.sectionIndex.splice(fromIndex, 1)
    store.sectionIndex.splice(finalTargetIndex, 0, draggedSection)
}
</script>