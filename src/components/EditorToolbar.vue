<template>
  <div class="border-b border-neutral-200 p-2 bg-neutral-50 flex flex-wrap gap-1 items-center shrink-0">
    <button 
      @click="editor.chain().focus().toggleBold().run()"
      :class="{ 'bg-black text-white': editor.isActive('bold'), 'text-neutral-600 hover:bg-neutral-200': !editor.isActive('bold') }"
      class="p-1.5 rounded text-xs font-bold transition min-w-[28px]"
      title="Grassetto"
    >
      G
    </button>
    <button 
      @click="editor.chain().focus().toggleItalic().run()"
      :class="{ 'bg-black text-white': editor.isActive('italic'), 'text-neutral-600 hover:bg-neutral-200': !editor.isActive('italic') }"
      class="p-1.5 rounded text-xs italic transition min-w-[28px]"
      title="Corsivo"
    >
      C
    </button>
    
    <div class="h-4 w-[1px] bg-neutral-300 mx-1"></div>

    <button 
      @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
      :class="{ 'bg-black text-white': editor.isActive('heading', { level: 2 }), 'text-neutral-600 hover:bg-neutral-200': !editor.isActive('heading', { level: 2 }) }"
      class="p-1.5 rounded text-xs font-bold transition"
      title="Titolo Capitolo"
    >
      H2
    </button>
    <button 
      @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
      :class="{ 'bg-black text-white': editor.isActive('heading', { level: 3 }), 'text-neutral-600 hover:bg-neutral-200': !editor.isActive('heading', { level: 3 }) }"
      class="p-1.5 rounded text-xs font-bold transition"
      title="Sotto-titolo"
    >
      H3
    </button>
    <button 
      @click="editor.chain().focus().setParagraph().run()"
      :class="{ 'bg-black text-white': editor.isActive('paragraph'), 'text-neutral-600 hover:bg-neutral-200': !editor.isActive('paragraph') }"
      class="p-1.5 rounded text-xs font-medium transition"
      title="Testo Normale"
    >
      Testo
    </button>

    <div class="h-4 w-[1px] bg-neutral-300 mx-1"></div>

    <button 
      @click="editor.chain().focus().toggleBulletList().run()"
      :class="{ 'bg-black text-white': editor.isActive('bulletList'), 'text-neutral-600 hover:bg-neutral-200': !editor.isActive('bulletList') }"
      class="p-1.5 rounded text-xs transition"
      title="Elenco Puntato"
    >
      • Elenco
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'

defineProps<{
  editor: Editor
}>()
</script>