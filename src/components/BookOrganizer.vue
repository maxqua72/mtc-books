<template>
    <aside class="th-left w-64 bg-white border-r border-neutral-200 flex flex-col shrink-0 h-full select-none no-print">
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

            <button @click="isPropsOpen = true"
                class="w-8 h-8 flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition shrink-0"
                title="Proprietà Libro">
                <i class="fa-solid fa-gear"></i>
            </button>
        </div>

        <!-- Elenco Sezioni (Indice Strutturale) -->
        <div class="flex-1 overflow-y-auto p-2 space-y-0.5">
            <SectionListItem v-for="(section, index) in store.sectionIndex" :key="section.id"
                :section="section" :active="store.activeSectionId === section.id" :locked="locked"
                :drop-class="dnd.dropClass(index, section)"
                @select="handleSectionClick(section.id)"
                @rename="promptRename(section)"
                @remove="deleteSection(section, index)"
                @drag-start="dnd.onDragStart(index)"
                @drag-end="dnd.onDragEnd()"
                @drag-over="dnd.onDragOver(index)"
                @drag-leave="dnd.onDragLeave(index)"
                @drop="dnd.onDrop(index)" />
        </div>

        <!-- Aggiungi sezioni -->
        <div class="p-3 border-t border-neutral-100 space-y-1">
            <button @click="addSection('chapter')" :disabled="locked"
                class="w-full py-2 px-3 border border-neutral-200 hover:border-neutral-900 rounded-lg text-xs font-bold text-neutral-700 transition flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-neutral-200">
                <i class="fa-solid fa-plus text-[10px]"></i> Nuovo Capitolo
            </button>
            <div class="flex gap-1">
                <button @click="addSection('cover')" :disabled="locked"
                    class="flex-1 py-1.5 border border-neutral-200 text-[10px] font-bold text-neutral-600 rounded hover:bg-neutral-50 flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                    <i class="fa-solid fa-book-open text-[10px] text-neutral-500"></i> Copertina
                </button>
                <button @click="addSection('index')" :disabled="locked"
                    class="flex-1 py-1.5 border border-neutral-200 text-[10px] font-bold text-neutral-600 rounded hover:bg-neutral-50 flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                    <i class="fa-solid fa-list-ol text-[10px] text-neutral-500"></i> Indice
                </button>
            </div>
        </div>
    </aside>

    <!-- Il modale sta fuori dal tag aside -->
    <BookPropertiesModal :is-open="isPropsOpen" @close="isPropsOpen = false" />
</template>


<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChessBookStore, type SectionType, type SectionIndexItem } from '../stores/chessBookStore'
import { useSectionDragDrop } from '../composables/useSectionDragDrop'
import BookPropertiesModal from './BookPropertiesModal.vue'
import SectionListItem from './SectionListItem.vue'

const store = useChessBookStore()
const isPropsOpen = ref(false)
const locked = computed(() => store.isLocked)   // sola lettura: struttura del libro non modificabile
const dnd = useSectionDragDrop(computed(() => store.sectionIndex), locked)

const handleSectionClick = async (id: string) => {
    if (store.activeSectionId === id) return
    window.dispatchEvent(new CustomEvent('request-editor-sync'))
    await store.changeActiveSection(id, store.activeSectionHtml)
}

const addSection = (type: SectionType) => {
    if (locked.value) return
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
        // La copertina va sempre in testa
        const currentIndex = store.sectionIndex.findIndex(s => s.id === id)
        if (currentIndex !== -1) {
            const [coverItem] = store.sectionIndex.splice(currentIndex, 1)
            store.sectionIndex.unshift(coverItem)
        }
    } else if (type === 'chapter') {
        // I capitoli stanno prima dell'indice
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
    if (locked.value) return
    const newTitle = prompt(`Inserisci il nuovo nome identificativo per l'indice:`, section.title)
    if (newTitle && newTitle.trim()) section.title = newTitle.trim()
}

const deleteSection = async (section: SectionIndexItem, index: number) => {
    if (locked.value) return
    if (!confirm(`Sei sicuro di voler eliminare definitivamente "${section.title}"? Tutto il testo al suo interno andrà perduto.`)) return

    store.sectionIndex.splice(index, 1)
    delete store.zippedSectionsCache[section.id]

    if (store.activeSectionId === section.id) {
        store.activeSectionId = null
        store.activeSectionHtml = ''
        if (store.sectionIndex.length > 0) await store.changeActiveSection(store.sectionIndex[0].id)
    }
}
</script>
