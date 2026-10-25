<template>
    <div class="th-toolbar border-b border-neutral-200 p-2 bg-neutral-50 flex flex-wrap gap-1 items-center shrink-0">
        <span v-if="locked" class="text-xs font-medium text-neutral-500 px-1 select-none">
            <i class="fa-solid fa-lock text-[10px] w-4"></i> Sola lettura</span>
        <!-- Strumenti di modifica: nascosti in sola lettura (lo zoom resta) -->
        <div v-show="!locked" class="contents">
            <!-- Grassetto -->
            <button @click="editor.chain().focus().toggleBold().run()"
                :class="{ 'bg-black text-white': editor.isActive('bold'), 'text-neutral-600 hover:bg-neutral-200': !editor.isActive('bold') }"
                class="w-7 h-7 rounded text-xs transition flex items-center justify-center" title="Grassetto">
                <i class="fa-solid fa-bold"></i>
            </button>
            <!-- Corsivo -->
            <button @click="editor.chain().focus().toggleItalic().run()"
                :class="{ 'bg-black text-white': editor.isActive('italic'), 'text-neutral-600 hover:bg-neutral-200': !editor.isActive('italic') }"
                class="w-7 h-7 rounded text-xs transition flex items-center justify-center" title="Corsivo">
                <i class="fa-solid fa-italic"></i>
            </button>

            <!-- Colore del testo -->
            <div class="flex items-center">
                <label
                    class="relative p-1.5 rounded text-xs font-bold transition min-w-[28px] text-center cursor-pointer text-neutral-600 hover:bg-neutral-200"
                    title="Colore del testo">
                    <span class="block leading-none">A</span>
                    <span class="block h-[3px] mt-0.5 rounded-sm" :style="{ backgroundColor: currentTextColor }"></span>
                    <input type="color" :value="currentTextColor"
                        @input="setTextColor(($event.target as HTMLInputElement).value)"
                        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                </label>
                <button v-if="hasTextColor" @mousedown.prevent @click="editor.chain().focus().unsetColor().run()"
                    class="p-1 rounded text-[10px] text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
                    title="Ripristina il colore predefinito">✕</button>
            </div>

            <div class="h-4 w-[1px] bg-neutral-300 mx-1"></div>

            <!-- Pulsante Titolo Principale (Livello 1 nell'indice) -->
            <button
                @click="editor.chain().focus().toggleHeading({ level: 2 }).updateAttributes('heading', { 'toc-level': '1' }).run()"
                :class="{ 'bg-black text-white': editor.isActive('heading', { level: 2 }), 'text-neutral-600 hover:bg-neutral-200': !editor.isActive('heading', { level: 2 }) }"
                class="p-1.5 rounded text-xs font-bold transition" title="Titolo Principale">
                Titolo 1
            </button>

            <!-- Pulsante Sotto-capitolo (Livello 2 nell'indice) -->
            <button
                @click="editor.chain().focus().toggleHeading({ level: 3 }).updateAttributes('heading', { 'toc-level': '2' }).run()"
                :class="{ 'bg-black text-white': editor.isActive('heading', { level: 3 }), 'text-neutral-600 hover:bg-neutral-200': !editor.isActive('heading', { level: 3 }) }"
                class="p-1.5 rounded text-xs font-bold transition" title="Sotto-capitolo">
                Titolo 2
            </button>

            <button @click="editor.chain().focus().setParagraph().run()"
                :class="{ 'bg-black text-white': editor.isActive('paragraph'), 'text-neutral-600 hover:bg-neutral-200': !editor.isActive('paragraph') }"
                class="p-1.5 rounded text-xs font-medium transition" title="Testo Normale">
                Testo
            </button>

            <div class="h-4 w-[1px] bg-neutral-300 mx-1"></div>

            <button @click="editor.chain().focus().toggleBulletList().run()"
                :class="{ 'bg-black text-white': editor.isActive('bulletList'), 'text-neutral-600 hover:bg-neutral-200': !editor.isActive('bulletList') }"
                class="w-7 h-7 rounded text-xs transition flex items-center justify-center" title="Elenco Puntato">
                <i class="fa-solid fa-list-ul"></i>
            </button>

            <div class="h-4 w-[1px] bg-neutral-300 mx-1"></div>

            <!-- Nuovo pulsante per il blocco partita/varianti -->
            <button @click="$emit('insertTreeBlock')"
                class="h-7 px-2 rounded text-xs font-medium text-neutral-600 hover:bg-neutral-200 transition flex items-center gap-1.5"
                title="Inserisci blocco partita o varianti">
                <i class="fa-solid fa-plus text-neutral-500"></i>
                <span>Blocco Mosse</span>
            </button>

            <!-- Dividi Blocco Mosse -->
            <button @click="$emit('splitTreeBlock')" :disabled="!canSplitBlock"
                class="h-7 px-2 rounded text-xs font-medium text-neutral-600 hover:bg-neutral-200 transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                :title="canSplitBlock ? 'Dividi il blocco mosse nel punto selezionato' : 'Seleziona una mossa della linea principale per dividere il blocco'">
                <i class="fa-solid fa-scissors"></i>
                <span>Dividi Blocco</span>
            </button>

            <!-- Incolla un albero copiato o tagliato (anche da un altro capitolo) -->
            <button @mousedown.prevent @click="$emit('pasteTreeBlock')" :disabled="!treeStore.clipboard"
                class="h-7 px-2 rounded text-xs font-medium text-neutral-600 hover:bg-neutral-200 transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                :title="treeStore.clipboard ? `Incolla l'albero «${treeStore.clipboard.tree.title}» nel punto del cursore` : 'Copia o taglia prima un albero di mosse'">
                <i class="fa-solid fa-clipboard"></i>
                <span>Incolla Blocco</span>
            </button>

            <div class="h-4 w-[1px] bg-neutral-300 mx-1"></div>

            <!-- Riferimento a un diagramma -->
            <div class="relative">
                <button @mousedown.prevent @click="showRefMenu = !showRefMenu"
                    :disabled="bookStore.diagramList.length === 0"
                    class="h-7 px-2 rounded text-xs font-medium text-neutral-600 hover:bg-neutral-200 transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    :title="bookStore.diagramList.length ? 'Inserisci un riferimento a un diagramma' : 'Nessun diagramma nel libro'">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    <span>Rif. diagramma</span>
                </button>

                <template v-if="showRefMenu">
                    <div class="fixed inset-0 z-30" @click="showRefMenu = false"></div>
                    <div
                        class="absolute left-0 top-full mt-1 z-40 w-72 max-h-72 overflow-y-auto bg-white border border-neutral-200 rounded-lg shadow-lg py-1">
                        <button v-for="d in bookStore.diagramList" :key="d.id" @mousedown.prevent
                            @click="insertRef(d.id)"
                            class="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 flex gap-2 items-baseline">
                            <span class="font-bold tabular-nums text-neutral-900 shrink-0">{{ d.label }}</span>
                            <span class="text-neutral-500 truncate">{{ d.caption || 'Senza didascalia' }}</span>
                        </button>
                    </div>
                </template>
            </div>

        </div>

        <!-- Sezione destra dei controlli (Zoom) -->
        <div class="flex items-center gap-1 border-l border-neutral-200 pl-2 ml-auto">
            <span class="text-xs text-neutral-500 font-medium select-none flex items-center gap-1">
                <i class="fa-solid fa-magnifying-glass text-[10px]"></i> Zoom:
            </span>
            <select :value="zoom" @change="e => $emit('update:zoom', (e.target as HTMLSelectElement).value)"
                class="text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium py-1 px-2 rounded border border-neutral-300 focus:outline-none cursor-pointer">
                <option value="fit-width">Adatta larghezza</option>
                <option value="50">50%</option>
                <option value="75">75%</option>
                <option value="100">100% (A4)</option>
                <option value="125">125%</option>
                <option value="150">150%</option>
            </select>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { useChessTreeStore } from '../stores/chessTreeStore'
import { useChessBookStore } from '../stores/chessBookStore'

const props = defineProps<{
    editor: Editor,
    zoom?: string
}>()

// Dichiariamo l'evento per comunicare al componente padre (BookEditor) il click del bottone
defineEmits<{
    (e: 'insertTreeBlock'): void
    (e: 'splitTreeBlock'): void
    (e: 'pasteTreeBlock'): void
    (e: 'update:zoom', zoom: string): void
}>()

const treeStore = useChessTreeStore()
const bookStore = useChessBookStore()
const showRefMenu = ref(false)
const locked = computed(() => bookStore.isLocked)

const insertRef = (id: string) => {
    props.editor.chain().focus().insertDiagramRef(id).run()
    showRefMenu.value = false
}

// Abilitato solo se c'è una mossa attiva appartenente alla mainline
const canSplitBlock = computed(() => {
    const currentTreeId = treeStore.activeTreeId
    const activeNodeId = treeStore.activeNodeId
    if (!currentTreeId || !activeNodeId) return false

    const sourceTree = treeStore.trees.find(t => t.id === currentTreeId)
    return sourceTree ? treeStore.isNodeInMainline(sourceTree.rootNodes, activeNodeId) : false
})
const DEFAULT_TEXT_COLOR = '#171717'

// Il colore salvato può essere "#rrggbb" oppure "rgb(r, g, b)" (quando viene riletto dall'HTML salvato)
const toHex = (color?: string | null) => {
    if (!color) return DEFAULT_TEXT_COLOR
    if (/^#[0-9a-f]{6}$/i.test(color)) return color
    const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color)
    if (!m) return DEFAULT_TEXT_COLOR
    return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('')
}

const hasTextColor = computed(() => !!props.editor.getAttributes('textStyle').color)
const currentTextColor = computed(() => toHex(props.editor.getAttributes('textStyle').color))
const setTextColor = (value: string) => props.editor.chain().focus().setColor(value).run()
</script>