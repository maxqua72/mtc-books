<template>
    <!-- v-show: ridotta a striscia la colonna resta montata, con menu e finestre aperte -->
    <aside v-show="!collapsedPanels.sections" data-tour="sections" class="th-left w-64 bg-white border-r border-neutral-200 flex flex-col shrink-0 h-full select-none no-print">
        <!-- Intestazione Informazioni Libro -->
        <div class="p-4 border-b border-neutral-100 flex items-center justify-between gap-2">
            <div class="space-y-1 min-w-0 flex-1">
                <div class="flex items-center gap-1 -ml-1.5">
                    <button @click="setPanelCollapsed('sections', true)" aria-label="Nascondi le sezioni"
                        class="w-5 h-5 flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded transition shrink-0 cursor-pointer"
                        v-tooltip="'Nascondi le sezioni'">
                        <i class="fa-solid fa-angles-left text-[10px]"></i>
                    </button>
                    <h2 class="text-xs font-bold text-neutral-400 uppercase tracking-wider">Progetto Attivo</h2>
                </div>
                <div class="text-sm font-black text-neutral-900 truncate" :title="store.metadata.title">
                    {{ store.metadata.title }}
                </div>
                <div class="text-[11px] text-neutral-400 font-medium truncate">
                    di {{ store.metadata.author }}
                </div>
            </div>

            <button @click="isPropsOpen = true" data-tour="properties"
                class="w-8 h-8 flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition shrink-0"
                v-tooltip="'Proprietà Libro'">
                <i class="fa-solid fa-gear"></i>
            </button>
        </div>

        <!-- Elenco Sezioni (Indice Strutturale) -->
        <div class="flex-1 overflow-y-auto p-2 space-y-0.5">
            <SectionListItem v-for="(section, index) in store.sectionIndex" :key="section.id" :section="section"
                :active="store.activeSectionId === section.id" :locked="locked"
                :drop-class="dnd.dropClass(index, section)" @select="handleSectionClick(section.id)"
                @rename="promptRename(section)" @remove="deleteSection(section, index)"
                @drag-start="dnd.onDragStart(index)" @drag-end="dnd.onDragEnd()" @drag-over="dnd.onDragOver(index)"
                @drag-leave="dnd.onDragLeave(index)" @drop="dnd.onDrop(index)"
                @options="optionsSectionId = section.id" />
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
                <!-- Altre sezioni: il menu si apre verso l'alto, sopra i pulsanti -->
                <div class="relative flex-1 flex">
                    <button @click="moreOpen = !moreOpen" :disabled="locked" aria-haspopup="menu" :aria-expanded="moreOpen"
                        v-tooltip.desc="'Sezioni senza numero, prima o dopo i capitoli: testi, legenda, indici'"
                        class="flex-1 py-1.5 border border-neutral-200 text-[10px] font-bold text-neutral-600 rounded hover:bg-neutral-50 flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                        <i class="fa-solid fa-plus text-[10px] text-neutral-500"></i> Altro
                    </button>
                    <template v-if="moreOpen">
                        <div class="fixed inset-0 z-[60]" @click="moreOpen = false"></div>
                        <div role="menu"
                            class="absolute bottom-full right-0 mb-1 w-60 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-[61]">
                            <button v-for="item in moreItems" :key="item.label" role="menuitem" type="button"
                                @click="moreOpen = false; item.run()"
                                class="w-full text-left px-3 py-1.5 hover:bg-neutral-100 flex items-start gap-2">
                                <i :class="item.icon" class="text-[11px] text-neutral-500 mt-0.5 w-3.5 text-center"></i>
                                <span>
                                    <span class="block text-xs font-medium text-neutral-800">{{ item.label }}</span>
                                    <span class="block text-[11px] text-neutral-400">{{ item.hint }}</span>
                                </span>
                            </button>
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </aside>

    <!-- Il modale sta fuori dal tag aside -->
    <BookPropertiesModal :is-open="isPropsOpen" @close="isPropsOpen = false" />
    <ChapterOptionsModal :is-open="!!optionsSectionId" :section-id="optionsSectionId"
        @close="optionsSectionId = null" />
</template>


<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useChessBookStore, type SectionType, type SectionIndexItem } from '../stores/chessBookStore'
import { useSectionDragDrop } from '../composables/useSectionDragDrop'
import { isContentSection, isSingleSection } from '../utils/sectionOrder'
import BookPropertiesModal from './BookPropertiesModal.vue'
import SectionListItem from './SectionListItem.vue'
import ChapterOptionsModal from './ChapterOptionsModal.vue'
import { vTooltip } from '../directives/tooltip'
import { collapsedPanels, setPanelCollapsed } from '../utils/panelPreference'
const optionsSectionId = ref<string | null>(null)

const store = useChessBookStore()
const isPropsOpen = ref(false)
const locked = computed(() => store.isLocked)   // sola lettura: struttura del libro non modificabile
const dnd = useSectionDragDrop(computed(() => store.sectionIndex), locked)

const handleSectionClick = async (id: string) => {
    if (store.activeSectionId === id) return
    window.dispatchEvent(new CustomEvent('request-editor-sync'))
    await store.changeActiveSection(id, store.activeSectionHtml)
}

const addSection = (type: SectionType, place: 'front' | 'back' = 'front') => {
    if (locked.value) return
    const titles: Record<SectionType, string> = {
        cover: 'Copertina',
        index: 'Indice Generale',
        chapter: `Capitolo ${store.sectionIndex.filter(s => s.type === 'chapter').length + 1}`,
        text: 'Nuova sezione',
        symbols: 'Legenda dei simboli',
        games: 'Indice delle partite',
        players: 'Indice dei giocatori',
        backcover: 'Quarta di copertina',
    }

    const existing = store.sectionIndex.find(s => s.type === type)
    if (existing && isSingleSection(type)) {
        alert(`Il libro contiene già la sezione «${existing.title}».`)
        return
    }

    // La sezione nasce già al suo posto: copertina, indice, sezioni iniziali, capitoli, sezioni finali
    const id = store.createNewSection(titles[type], type, place)
    handleSectionClick(id)
}

// Menu «Altro»: Esc lo chiude anche se il fuoco è altrove
const moreOpen = ref(false)
watch(moreOpen, (open, _old, onCleanup) => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') moreOpen.value = false }
    window.addEventListener('keydown', onKey)
    onCleanup(() => window.removeEventListener('keydown', onKey))
})
const moreItems = [
    { label: 'Sezione prima dei capitoli', hint: 'Senza numero: prefazione, introduzione…', icon: 'fa-solid fa-file-pen', run: () => addSection('text', 'front') },
    { label: 'Sezione dopo i capitoli', hint: 'Senza numero: conclusioni, bibliografia…', icon: 'fa-solid fa-file-pen', run: () => addSection('text', 'back') },
    { label: 'Legenda dei simboli', hint: 'Generata: i simboli usati nelle mosse', icon: 'fa-solid fa-circle-info', run: () => addSection('symbols', 'front') },
    { label: 'Indice delle partite', hint: 'Generato: le partite con le pagine', icon: 'fa-solid fa-chess-board', run: () => addSection('games', 'back') },
    { label: 'Indice dei giocatori', hint: 'Generato: i giocatori con le pagine', icon: 'fa-solid fa-users', run: () => addSection('players', 'back') },
    { label: 'Quarta di copertina', hint: 'Il retro del libro: immagine e testi', icon: 'fa-solid fa-book', run: () => addSection('backcover') },
]

const promptRename = (section: SectionIndexItem) => {
    if (locked.value) return
    const newTitle = prompt(`Inserisci il nuovo nome identificativo per l'indice:`, section.title)
    if (!newTitle || !newTitle.trim()) return

    if (isContentSection(section.type)) {
        if (section.syncTitle !== false &&
            !confirm('Il nome di questa sezione segue il primo titolo. Rinominandolo, il collegamento verrà disattivato. Continuare?')) return
        section.syncTitle = false
    }
    section.title = newTitle.trim()
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
