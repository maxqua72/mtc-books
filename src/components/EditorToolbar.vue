<template>
    <div ref="root"
        class="th-toolbar border-b border-neutral-200 px-2 py-1 bg-neutral-50 flex items-start gap-1 shrink-0">
        <span v-if="locked" class="text-xs font-medium text-neutral-500 px-1 h-7 flex items-center select-none">
            <i class="fa-solid fa-lock text-[10px] w-4"></i> Sola lettura</span>

        <!-- Gruppi di strumenti. Con flex-wrap quelli che non entrano vanno a capo; a riga compressa
             (maxHeight = una riga) restano nascosti e si mostrano con il pulsante ⋮ -->
        <div v-show="!locked" ref="rowsEl" class="flex flex-wrap items-center gap-y-1 flex-1 min-w-0 overflow-hidden"
            :style="{ maxHeight: expanded ? 'none' : ROW_HEIGHT + 'px' }">

            <!-- 1. Formattazione del carattere -->
            <div class="tb-group">
                <button :class="[btn, editor.isActive('bold') ? on : off]" title="Grassetto (Ctrl+B)"
                    @click="editor.chain().focus().toggleBold().run()"><i class="fa-solid fa-bold"></i></button>
                <button :class="[btn, editor.isActive('italic') ? on : off]" title="Corsivo (Ctrl+I)"
                    @click="editor.chain().focus().toggleItalic().run()"><i class="fa-solid fa-italic"></i></button>
                <button :class="[btn, editor.isActive('underline') ? on : off]" title="Sottolineato (Ctrl+U)"
                    @click="editor.chain().focus().toggleUnderline().run()"><i
                        class="fa-solid fa-underline"></i></button>
                <button :class="[btn, editor.isActive('highlight') ? on : off]" title="Evidenzia"
                    @click="editor.chain().focus().toggleHighlight().run()"><i
                        class="fa-solid fa-highlighter"></i></button>

                <!-- Colore del testo -->
                <div class="flex items-center">
                    <label
                        class="relative p-1.5 rounded text-xs font-bold transition min-w-[28px] text-center cursor-pointer text-neutral-600 hover:bg-neutral-200"
                        title="Colore del testo">
                        <span class="block leading-none">A</span>
                        <span class="block h-[3px] mt-0.5 rounded-sm"
                            :style="{ backgroundColor: currentTextColor }"></span>
                        <input type="color" :value="currentTextColor"
                            @input="setTextColor(($event.target as HTMLInputElement).value)"
                            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </label>
                    <button v-if="hasTextColor" @mousedown.prevent @click="editor.chain().focus().unsetColor().run()"
                        class="p-1 rounded text-[10px] text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
                        title="Ripristina il colore predefinito">✕</button>
                </div>
            </div>

            <!-- 2. Link -->
            <div class="tb-group">
                <ToolbarMenu title="Link (Ctrl+K)" :active="editor.isActive('link')" panel-class="w-80 p-3"
                    @open="onLinkOpen">
                    <template #button><i class="fa-solid fa-link"></i></template>
                    <template #default="{ close }">
                        <label class="block text-[11px] font-medium text-neutral-500 mb-1">Indirizzo del link</label>
                        <input ref="linkInput" v-model="linkUrl" type="text" placeholder="https://esempio.it"
                            @keydown.enter.prevent="applyLink(close)"
                            class="w-full text-xs border border-neutral-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-500" />
                        <p v-if="linkError" class="text-[11px] text-red-600 mt-1">{{ linkError }}</p>
                        <p v-else-if="editor.state.selection.empty && !editor.isActive('link')"
                            class="text-[11px] text-neutral-500 mt-1">Nessun testo selezionato: verrà inserito
                            l'indirizzo come testo.</p>
                        <div class="flex justify-between items-center mt-2">
                            <button v-if="editor.isActive('link')" @click="removeLink(close)"
                                class="text-[11px] font-semibold text-red-600 hover:underline">
                                <i class="fa-solid fa-link-slash mr-1"></i>Rimuovi link
                            </button>
                            <span v-else></span>
                            <button @click="applyLink(close)"
                                class="bg-neutral-900 text-white px-3 py-1 text-xs font-medium rounded hover:bg-neutral-800">Applica</button>
                        </div>
                    </template>
                </ToolbarMenu>
            </div>

            <!-- 3. Paragrafo: stile, elenchi, allineamento, rientro -->
            <div class="tb-group">
                <!-- Stili: titoli e testo -->
                <ToolbarMenu title="Stili del paragrafo" :active="editor.isActive('heading')">
                    <template #button><i class="fa-solid fa-heading"></i></template>
                    <template #default="{ close }">
                        <button role="menuitem" :class="item" @mousedown.prevent
                            @click="editor.chain().focus().setParagraph().run(); close()">
                            <i class="fa-solid fa-check w-3 text-[10px]"
                                :class="{ invisible: !editor.isActive('paragraph') }"></i>
                            Testo normale
                        </button>
                        <button role="menuitem" :class="item" @mousedown.prevent @click="setHeading(2); close()">
                            <i class="fa-solid fa-check w-3 text-[10px]"
                                :class="{ invisible: !editor.isActive('heading', { level: 2 }) }"></i>
                            <span class="font-bold text-sm">Titolo 1</span>
                        </button>
                        <button role="menuitem" :class="item" @mousedown.prevent @click="setHeading(3); close()">
                            <i class="fa-solid fa-check w-3 text-[10px]"
                                :class="{ invisible: !editor.isActive('heading', { level: 3 }) }"></i>
                            <span class="font-bold">Titolo 2</span>
                        </button>
                    </template>
                </ToolbarMenu>

                <!-- Elenchi -->
                <ToolbarMenu title="Elenchi" :active="editor.isActive('bulletList') || editor.isActive('orderedList')">
                    <template #button>
                        <i :class="['fa-solid', editor.isActive('orderedList') ? 'fa-list-ol' : 'fa-list-ul']"></i>
                    </template>
                    <template #default="{ close }">
                        <button role="menuitem" :class="item" @mousedown.prevent
                            @click="editor.chain().focus().toggleBulletList().run(); close()">
                            <i class="fa-solid fa-list-ul w-4 text-center"></i> Elenco puntato
                            <i v-if="editor.isActive('bulletList')" class="fa-solid fa-check ml-auto text-[10px]"></i>
                        </button>
                        <button role="menuitem" :class="item" @mousedown.prevent
                            @click="editor.chain().focus().toggleOrderedList().run(); close()">
                            <i class="fa-solid fa-list-ol w-4 text-center"></i> Elenco numerato
                            <i v-if="editor.isActive('orderedList')" class="fa-solid fa-check ml-auto text-[10px]"></i>
                        </button>
                    </template>
                </ToolbarMenu>

                <!-- Allineamento: quattro pulsanti se c'è spazio, un solo menu se la finestra si restringe -->
                <template v-if="!compact">
                    <button v-for="a in ALIGNS" :key="a.value"
                        :class="[btn, editor.isActive({ textAlign: a.value }) ? on : off]" :title="a.label"
                        @click="editor.chain().focus().setTextAlign(a.value).run()">
                        <i :class="['fa-solid', a.icon]"></i>
                    </button>
                </template>
                <ToolbarMenu v-else title="Allineamento del paragrafo">
                    <template #button><i :class="['fa-solid', currentAlign.icon]"></i></template>
                    <template #default="{ close }">
                        <button v-for="a in ALIGNS" :key="a.value" role="menuitem" :class="item" @mousedown.prevent
                            @click="editor.chain().focus().setTextAlign(a.value).run(); close()">
                            <i :class="['fa-solid', a.icon, 'w-4 text-center']"></i> {{ a.label }}
                            <i v-if="currentAlign.value === a.value" class="fa-solid fa-check ml-auto text-[10px]"></i>
                        </button>
                    </template>
                </ToolbarMenu>

                <!-- Rientro -->
                <button :class="[btn, off]" title="Riduci rientro (Ctrl+[)" :disabled="!editor.can().outdent()"
                    @click="editor.chain().focus().outdent().run()"><i class="fa-solid fa-outdent"></i></button>
                <button :class="[btn, off]" title="Aumenta rientro (Ctrl+])" :disabled="!editor.can().indent()"
                    @click="editor.chain().focus().indent().run()"><i class="fa-solid fa-indent"></i></button>
            </div>

            <!-- 4. Scacchi: blocchi di mosse e riferimenti -->
            <div class="tb-group">
                <button @click="emit('insertTreeBlock')"
                    class="h-7 px-2 rounded text-xs font-medium text-neutral-600 hover:bg-neutral-200 transition flex items-center gap-1.5 whitespace-nowrap"
                    title="Inserisci blocco partita o varianti">
                    <i class="fa-solid fa-plus text-neutral-500"></i><span>Blocco Mosse</span>
                </button>

                <button @click="emit('splitTreeBlock')" :disabled="!canSplitBlock"
                    class="h-7 px-2 rounded text-xs font-medium text-neutral-600 hover:bg-neutral-200 transition flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    :title="!canSplitBlock
                        ? 'Seleziona una mossa con qualcosa da stampare dopo di essa per dividere il blocco'
                        : splitInVariation
                            ? 'Dividi in questa mossa della variante: la sua continuazione e il ritorno alla linea madre vanno in nuovi blocchi (non annullabile)'
                            : 'Dividi il blocco mosse nel punto selezionato (non annullabile)'">
                    <i class="fa-solid fa-scissors"></i><span>Dividi Blocco</span>
                </button>

                <button @click="emit('mergeTreeBlock')" :disabled="!mergeTarget"
                    class="h-7 px-2 rounded text-xs font-medium text-neutral-600 hover:bg-neutral-200 transition flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    :title="mergeTarget
                        ? `Unisci il blocco «${mergeTarget.title}» a questo (non annullabile)`
                        : 'Seleziona un blocco derivato da una divisione e seguito dal blocco che lo continua'">
                    <i class="fa-solid fa-object-group"></i><span>Unisci Blocchi</span>
                </button>

                <button @mousedown.prevent @click="emit('pasteTreeBlock')" :disabled="!treeStore.clipboard"
                    class="h-7 px-2 rounded text-xs font-medium text-neutral-600 hover:bg-neutral-200 transition flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    :title="treeStore.clipboard ? `Incolla l'albero «${treeStore.clipboard.tree.title}» nel punto del cursore` : 'Copia o taglia prima un albero di mosse'">
                    <i class="fa-solid fa-clipboard"></i><span>Incolla Blocco</span>
                </button>

                <ToolbarMenu
                    :title="bookStore.diagramList.length ? 'Inserisci un riferimento a un diagramma' : 'Nessun diagramma nel libro'"
                    :disabled="bookStore.diagramList.length === 0" panel-class="w-72 max-h-72 overflow-y-auto">
                    <template #button>
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        <span class="font-medium whitespace-nowrap">Rif. diagramma</span>
                    </template>
                    <template #default="{ close }">
                        <button v-for="d in bookStore.diagramList" :key="d.id" role="menuitem" @mousedown.prevent
                            @click="insertRef(d); close()"
                            class="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 flex gap-2 items-baseline">
                            <span class="font-bold tabular-nums text-neutral-900 shrink-0">{{ d.label }}</span>
                            <span class="text-neutral-500 truncate">{{ d.caption || 'Senza didascalia' }}</span>
                        </button>
                    </template>
                </ToolbarMenu>
            </div>
        </div>

        <!-- Destra: pulsante «altro» (solo se qualcosa non entra) e zoom -->
        <div class="flex items-center gap-1 ml-auto shrink-0 h-7">
            <button v-if="!locked && hasOverflow" @mousedown.prevent @click="expanded = !expanded"
                :class="[btn, expanded ? on : off]" :title="expanded ? 'Mostra meno strumenti' : 'Altri strumenti'"
                :aria-expanded="expanded">
                <i class="fa-solid fa-ellipsis-vertical"></i>
            </button>

            <div class="flex items-center gap-1 border-l border-neutral-200 pl-2">
                <span class="text-xs text-neutral-500 font-medium select-none flex items-center gap-1">
                    <i class="fa-solid fa-magnifying-glass text-[10px]"></i> Zoom:
                </span>
                <select :value="zoom" @change="e => emit('update:zoom', (e.target as HTMLSelectElement).value)"
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
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { useChessTreeStore } from '../stores/chessTreeStore'
import { useChessBookStore } from '../stores/chessBookStore'
import ToolbarMenu from './toolbar/ToolbarMenu.vue'
import { canSplitAt, findMergeableChild } from '../utils/treeOps'
import { insertDiagramRefInComment } from '../utils/diagramRefs'
import { treeIdsInDoc } from '../utils/editorDoc'

const props = defineProps<{
    editor: Editor,
    zoom?: string
}>()

const emit = defineEmits<{
    (e: 'insertTreeBlock'): void
    (e: 'splitTreeBlock'): void
    (e: 'pasteTreeBlock'): void
    (e: 'update:zoom', zoom: string): void
    (e: 'mergeTreeBlock'): void
}>()

const treeStore = useChessTreeStore()
const bookStore = useChessBookStore()
const locked = computed(() => bookStore.isLocked)

// --- Classi comuni ---
const btn = 'w-7 h-7 rounded text-xs transition flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'
const on = 'bg-black text-white'
const off = 'text-neutral-600 hover:bg-neutral-200'
const item = 'w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-neutral-100'

// ---------------------------------------------------------------------------
// Riga compressa (pulsante ⋮) e modalità compatta
// ---------------------------------------------------------------------------
const ROW_HEIGHT = 28            // altezza di una riga (h-7)
const COMPACT_BELOW = 1000       // sotto questa larghezza (px) l'allineamento diventa un menu

const root = ref<HTMLElement | null>(null)
const rowsEl = ref<HTMLElement | null>(null)
const expanded = ref(false)
const hasOverflow = ref(false)
const compact = ref(false)
let observer: ResizeObserver | null = null

// C'è overflow se almeno un gruppo è andato a capo (offsetTop maggiore di quello del primo)
const measureOverflow = () => {
    const kids = Array.from(rowsEl.value?.children ?? []) as HTMLElement[]
    const top0 = kids[0]?.offsetTop ?? 0
    hasOverflow.value = !locked.value && kids.some(k => k.offsetTop > top0 + 4)
    if (!hasOverflow.value) expanded.value = false
}

const update = () => {
    compact.value = root.value ? root.value.clientWidth < COMPACT_BELOW : false
    nextTick(measureOverflow)   // dopo che il cambio di modalità ha ridisegnato i gruppi
}

onMounted(() => {
    if (!root.value) return
    observer = new ResizeObserver(update)
    observer.observe(root.value)
    // anche i gruppi: cambiano larghezza quando compare, ad esempio, il pulsante ✕ del colore
    Array.from(rowsEl.value?.children ?? []).forEach(k => observer!.observe(k))
    update()
})
onBeforeUnmount(() => observer?.disconnect())
watch(locked, () => nextTick(measureOverflow))

// ---------------------------------------------------------------------------
// Titoli
// ---------------------------------------------------------------------------
const setHeading = (level: 2 | 3) =>
    props.editor.chain().focus().toggleHeading({ level })
        .updateAttributes('heading', { 'toc-level': level === 2 ? '1' : '2' }).run()

// ---------------------------------------------------------------------------
// Allineamento
// ---------------------------------------------------------------------------
const ALIGNS = [
    { value: 'left', icon: 'fa-align-left', label: 'Allinea a sinistra' },
    { value: 'center', icon: 'fa-align-center', label: 'Centra' },
    { value: 'right', icon: 'fa-align-right', label: 'Allinea a destra' },
    { value: 'justify', icon: 'fa-align-justify', label: 'Giustifica' },
]
const currentAlign = computed(() =>
    ALIGNS.find(a => props.editor.isActive({ textAlign: a.value })) ?? ALIGNS[0]
)

// ---------------------------------------------------------------------------
// Link
// ---------------------------------------------------------------------------
const linkUrl = ref('')
const linkError = ref('')
const linkInput = ref<HTMLInputElement | null>(null)

const ALLOWED_LINK = /^(https?:|mailto:|tel:)/i

const normalizeUrl = (raw: string): string => {
    const v = raw.trim()
    if (!v) return ''
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return v                       // ha già uno schema
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`     // indirizzo e-mail
    return `https://${v}`
}

const onLinkOpen = async () => {
    linkUrl.value = props.editor.getAttributes('link').href ?? ''
    linkError.value = ''
    await nextTick()
    linkInput.value?.focus()
    linkInput.value?.select()
}

const applyLink = (close: () => void) => {
    const href = normalizeUrl(linkUrl.value)
    if (!href) return removeLink(close)
    if (!ALLOWED_LINK.test(href)) {
        linkError.value = 'Sono ammessi solo indirizzi http, https, mailto e tel.'
        return
    }
    const ed = props.editor
    if (ed.state.selection.empty && !ed.isActive('link')) {
        // niente testo selezionato: l'indirizzo stesso diventa il testo del link
        ed.chain().focus().insertContent({
            type: 'text',
            text: href.replace(/^(mailto:|tel:)/i, ''),
            marks: [{ type: 'link', attrs: { href } }],
        }).run()
    } else {
        ed.chain().focus().extendMarkRange('link').setLink({ href }).run()
    }
    close()
}

const removeLink = (close: () => void) => {
    props.editor.chain().focus().extendMarkRange('link').unsetLink().run()
    close()
}

// ---------------------------------------------------------------------------
// Riferimenti a diagrammi, divisione blocco
// ---------------------------------------------------------------------------
const insertRef = (d: { id: string; label: string }) => {
    // Se il cursore è in un commento di mossa, il riferimento va lì; altrimenti nel testo
    if (insertDiagramRefInComment(d.id, d.label)) return
    props.editor.chain().focus().insertDiagramRef(d.id).run()
}

// Abilitato se dopo la mossa attiva (anche in una variante) c'è ancora qualcosa da stampare
const canSplitBlock = computed(() => {
    const tree = treeStore.currentTree
    const nodeId = treeStore.activeNodeId
    return !!tree && !!nodeId && canSplitAt(tree, nodeId)
})
const splitInVariation = computed(() => {
    const tree = treeStore.currentTree
    const nodeId = treeStore.activeNodeId
    return !!tree && !!nodeId &&
        ((tree.depthStart ?? 0) > 0 || !treeStore.isNodeInMainline(tree.rootNodes, nodeId))
})
// Blocco che continua quello attivo e si può riunire a esso
const mergeTarget = computed(() => {
    const tree = treeStore.currentTree
    if (!tree || locked.value) return null
    return findMergeableChild(tree, treeStore.trees, treeIdsInDoc(props.editor.state.doc))
})

// ---------------------------------------------------------------------------
// Colore del testo
// ---------------------------------------------------------------------------
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

<style scoped>
.tb-group {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 2px;
    min-height: 28px;
    padding-right: 6px;
    margin-right: 6px;
    border-right: 1px solid var(--color-neutral-300, #d4d4d4);
}

.tb-group:last-child {
    border-right: 0;
    margin-right: 0;
}
</style>