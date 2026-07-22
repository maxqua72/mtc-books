<template>
    <div class="border-b border-neutral-200 p-2 bg-neutral-50 flex flex-wrap gap-1 items-center shrink-0">
        <button @click="editor.chain().focus().toggleBold().run()"
            :class="{ 'bg-black text-white': editor.isActive('bold'), 'text-neutral-600 hover:bg-neutral-200': !editor.isActive('bold') }"
            class="p-1.5 rounded text-xs font-bold transition min-w-[28px]" title="Grassetto">
            G
        </button>
        <button @click="editor.chain().focus().toggleItalic().run()"
            :class="{ 'bg-black text-white': editor.isActive('italic'), 'text-neutral-600 hover:bg-neutral-200': !editor.isActive('italic') }"
            class="p-1.5 rounded text-xs italic transition min-w-[28px]" title="Corsivo">
            C
        </button>

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
            class="p-1.5 rounded text-xs transition" title="Elenco Puntato">
            • Elenco
        </button>

        <!-- Nuovo pulsante per il blocco partita/varianti -->
        <button @click="$emit('insertTreeBlock')"
            class="p-1.5 rounded text-xs font-medium text-neutral-600 hover:bg-neutral-200 transition flex items-center gap-1"
            title="Inserisci blocco partita o varianti">
            <span>+</span> Partita / Varianti
        </button>

        <!-- NUOVO PULSANTE: Dividi Blocco Mosse -->
        <button @click="$emit('splitTreeBlock')"
            :disabled="!canSplitBlock"
            class="p-1.5 rounded text-xs font-medium text-neutral-600 hover:bg-neutral-200 transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            :title="canSplitBlock ? 'Dividi il blocco mosse nel punto selezionato' : 'Seleziona una mossa della linea principale per dividere il blocco'">
            <span>✂️</span> Dividi Blocco
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { useChessTreeStore } from '../stores/chessTreeStore'

defineProps<{
    editor: Editor
}>()

// Dichiariamo l'evento per comunicare al componente padre (BookEditor) il click del bottone
defineEmits<{
    (e: 'insertTreeBlock'): void
    (e: 'splitTreeBlock'): void
}>()

const treeStore = useChessTreeStore()

// Abilitato solo se c'è una mossa attiva appartenente alla mainline
const canSplitBlock = computed(() => {
    const currentTreeId = treeStore.activeTreeId
    const activeNodeId = treeStore.activeNodeId
    if (!currentTreeId || !activeNodeId) return false

    const sourceTree = treeStore.trees.find(t => t.id === currentTreeId)
    return sourceTree ? treeStore.isNodeInMainline(sourceTree.rootNodes, activeNodeId) : false
})
</script>