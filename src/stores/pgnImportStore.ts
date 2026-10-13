import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useChessTreeStore } from './chessTreeStore'
import {
  buildTreeFromGame, buildBranch, mergeNodes, samePosition, nodeLabel,
  type PgnGameInfo
} from '../utils/pgnImport'

export type PgnPlacement = 'after-active' | 'cursor' | 'end'
export type PgnImportMode = 'new-block' | 'append-active'

// Funzioni fornite da BookEditor (che possiede l'editor)
export interface PlacementApi {
  resolve: (placement: PgnPlacement) => number | null
  describe: (placement: PgnPlacement) => string
}

export const usePgnImportStore = defineStore('pgnImport', () => {
  const treeStore = useChessTreeStore()

  const isOpen = ref(false)                       // il pannello di importazione è aperto
  const mode = ref<PgnImportMode>('new-block')
  const placement = ref<PgnPlacement>('after-active')
  const selectionTick = ref(0)                    // cambia quando il cursore si sposta nell'editor

  // Richiesta per l'editor: inserire un blocco (placement) oppure solo mostrarlo (placement = null)
  const request = ref<{ treeId: string; placement: PgnPlacement | null; seq: number } | null>(null)
  let seq = 0

  let placementApi: PlacementApi | null = null
  const registerPlacementApi = (api: PlacementApi | null) => { placementApi = api }
  const canPlace = (p: PgnPlacement) => !!placementApi && placementApi.resolve(p) !== null
  const describePlacement = (p: PgnPlacement) => placementApi?.describe(p) ?? ''
  const touchSelection = () => { selectionTick.value++ }

  // Cartellino mostrato sul blocco di destinazione, nel documento
  const targetBadge = computed(() => {
    if (!isOpen.value) return null
    const tree = treeStore.currentTree
    if (!tree) return null

    if (mode.value === 'append-active') {
      const node = treeStore.currentNode
      return {
        treeId: tree.id,
        text: node
          ? `Il PGN si aggancia qui, dopo ${nodeLabel(node)}`
          : 'Il PGN si aggancia qui, all’inizio del blocco'
      }
    }
    if (placement.value === 'after-active') {
      return { treeId: tree.id, text: 'Il nuovo blocco verrà inserito subito dopo questo' }
    }
    return null
  })

  function runImport(game: PgnGameInfo): { ok: boolean; message: string } {
    if (game.problem) return { ok: false, message: game.problem }

    // --- Nuovo blocco ---
    if (mode.value === 'new-block') {
      const { tree, stats } = buildTreeFromGame(game)
      if (stats.moves === 0) return { ok: false, message: 'Nessuna mossa valida da importare.' }

      treeStore.trees.push(tree)
      treeStore.activeTreeId = tree.id
      treeStore.setActiveNode(null)               // la scacchiera torna alla posizione iniziale
      request.value = { treeId: tree.id, placement: placement.value, seq: ++seq }

      return {
        ok: true,
        message: `Creato il blocco «${tree.title}»: ${stats.moves} mosse, ${stats.variations} varianti, ${stats.comments} commenti.`
      }
    }

    // --- Aggiunta al blocco attivo ---
    const tree = treeStore.currentTree
    if (!tree) return { ok: false, message: 'Nessun blocco partita attivo.' }

    const parent = treeStore.currentNode
    const targetFen = parent ? parent.fen : tree.startingFen
    if (!samePosition(game.startFen, targetFen)) {
      return { ok: false, message: 'La posizione di partenza del PGN non coincide con quella della scacchiera.' }
    }

    const { nodes, stats } = buildBranch(targetFen, parent ? parent.id : null, game)
    if (stats.moves === 0) return { ok: false, message: 'Nessuna mossa valida da importare.' }

    const siblings = parent ? parent.children : tree.rootNodes
    const added = mergeNodes(siblings, nodes)
    request.value = { treeId: tree.id, placement: null, seq: ++seq }

    return {
      ok: true,
      message: `Aggiunte ${added} mosse al blocco «${tree.title}» (${stats.variations} varianti, ${stats.comments} commenti).`
    }
  }

  return {
    isOpen, mode, placement, selectionTick, request, targetBadge,
    registerPlacementApi, canPlace, describePlacement, touchSelection, runImport
  }
})