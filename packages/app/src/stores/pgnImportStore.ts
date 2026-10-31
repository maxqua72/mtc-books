import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useChessTreeStore, type ChessTree } from './chessTreeStore'
import {
  buildTreeFromGame, buildBranch, mergeNodes, nodeLabel,
  type PgnGameInfo
} from '../utils/pgnImport'
import { samePosition } from '../utils/fen'
import { shouldShowHeaderByDefault } from '../utils/pgnHeader'

export type PgnPlacement = 'after-active' | 'cursor' | 'end'
export type PgnImportMode = 'new-tree' | 'into-active'

// Funzioni fornite da BookEditor (che possiede l'editor)
export interface PlacementApi {
  resolve: (placement: PgnPlacement) => number | null
  describe: (placement: PgnPlacement) => string
}

// Richiesta per l'editor: inserire dei blocchi in `pos` (null = in fondo), oppure solo mostrarli
export interface TreeInsertRequest {
  treeIds: string[]
  insert: boolean
  pos: number | null
  seq: number
}

export interface ImportOutcome { ok: boolean; message: string }

// Tetto di mosse complessive per importazione (accanto a MAX_NODES per singola partita)
const MAX_TOTAL_NODES = 60000

export const usePgnImportStore = defineStore('pgnImport', () => {
  const treeStore = useChessTreeStore()

  const isOpen = ref(false)                       // il pannello di importazione è aperto
  const mode = ref<PgnImportMode>('new-tree')
  const placement = ref<PgnPlacement>('after-active')
  const selectionTick = ref(0)                    // cambia quando il cursore si sposta nell'editor

  const request = ref<TreeInsertRequest | null>(null)
  let seq = 0

  let placementApi: PlacementApi | null = null
  const registerPlacementApi = (api: PlacementApi | null) => { placementApi = api }
  const canPlace = (p: PgnPlacement) => !!placementApi && placementApi.resolve(p) !== null
  const describePlacement = (p: PgnPlacement) => placementApi?.describe(p) ?? ''
  const touchSelection = () => { selectionTick.value++ }

  // Cartellino mostrato sull'albero di destinazione, nel documento
  const targetBadge = computed(() => {
    if (!isOpen.value) return null
    const tree = treeStore.currentTree
    if (!tree) return null

    if (mode.value === 'into-active') {
      const node = treeStore.currentNode
      return {
        treeId: tree.id,
        text: tree.rootNodes.length === 0
          ? 'Il PGN diventa il contenuto di questo albero'
          : node
            ? `Il PGN si aggancia qui, dopo ${nodeLabel(node)}`
            : 'Il PGN si aggancia qui, all’inizio dell’albero'
      }
    }
    if (placement.value === 'after-active') {
      return { treeId: tree.id, text: 'I nuovi alberi verranno inseriti subito dopo questo' }
    }
    return null
  })

  /**
   * Aggiunge alberi nuovi al documento. La posizione di inserimento va risolta PRIMA di attivare
   * il primo albero, altrimenti "dopo l'albero attivo" punterebbe al blocco che non esiste ancora.
   * Il primo albero diventa attivo, con la scacchiera sulla sua posizione iniziale.
   */
  function addTrees(trees: ChessTree[], where: PgnPlacement) {
    if (trees.length === 0) return
    const pos = placementApi ? placementApi.resolve(where) : null
    treeStore.trees.push(...trees)
    treeStore.activateTree(trees[0].id)
    request.value = { treeIds: trees.map(t => t.id), insert: true, pos, seq: ++seq }
  }

  const fail = (message: string): ImportOutcome => ({ ok: false, message })

  function importAsNewTrees(games: PgnGameInfo[], ignoredEmpty: number): ImportOutcome {
    const trees: ChessTree[] = []
    const skipped: string[] = []
    let total = 0

    for (const g of games) {
      const label = `partita ${g.index + 1}`
      if (g.problem) { skipped.push(`${label}: ${g.problem}`); continue }
      if (total >= MAX_TOTAL_NODES) { skipped.push(`${label}: limite di mosse per importazione raggiunto`); continue }
      const { tree, stats } = buildTreeFromGame(g)
      if (stats.moves === 0) { skipped.push(`${label}: nessuna mossa valida`); continue }
      total += stats.moves
      trees.push(tree)
    }
    if (ignoredEmpty > 0) skipped.push(`${ignoredEmpty} senza mosse`)

    if (trees.length === 0) return fail(`Nessun albero creato. ${skipped.join('; ')}`)

    addTrees(trees, placement.value)

    const head = trees.length === 1
      ? `Creato l'albero «${trees[0].title}».`
      : `Importati ${trees.length} alberi su ${games.length + ignoredEmpty} partite.`
    const tail = skipped.length
      ? ` Saltate: ${skipped.slice(0, 3).join('; ')}${skipped.length > 3 ? ` … e altre ${skipped.length - 3}` : ''}.`
      : ''
    return { ok: true, message: head + tail }
  }

  function importIntoActive(game: PgnGameInfo): ImportOutcome {
    const tree = treeStore.currentTree
    if (!tree) return fail('Nessun albero attivo.')

    const empty = tree.rootNodes.length === 0
    const parent = empty ? null : treeStore.currentNode
    const targetFen = empty ? game.startFen : (parent ? parent.fen : tree.startingFen)

    if (!empty && !samePosition(game.startFen, targetFen)) {
      return fail('La posizione di partenza del PGN non coincide con quella della mossa selezionata.')
    }

    // Si costruisce tutto prima di toccare l'albero: l'aggancio è atomico
    const { nodes, stats } = buildBranch(targetFen, parent ? parent.id : null, game)
    if (stats.moves === 0) return fail('Nessuna mossa valida da importare.')
    if (stats.warnings.length > 0) return fail(`Importazione annullata: ${stats.warnings[0]}`)

    if (empty) {
      if (treeStore.setBoardFen(targetFen) !== 'ok') return fail('Posizione iniziale del PGN non valida.')
      if (!tree.header && Object.keys(game.header).length) {
        tree.header = { ...game.header }
        tree.showHeader = shouldShowHeaderByDefault(game.header)
      }
    }

    const siblings = parent ? parent.children : tree.rootNodes
    const added = mergeNodes(siblings, nodes)
    request.value = { treeIds: [tree.id], insert: false, pos: null, seq: ++seq }

    return {
      ok: true,
      message: `Aggiunte ${added} mosse all'albero «${tree.title}» (${stats.variations} varianti, ${stats.comments} commenti).`
    }
  }

  function runImport(games: PgnGameInfo[], ignoredEmpty = 0): ImportOutcome {
    const valid = games.filter(g => !g.problem)
    if (valid.length === 0) return fail(games[0]?.problem ?? 'Nessuna partita importabile.')

    if (mode.value === 'new-tree') return importAsNewTrees(games, ignoredEmpty)
    if (valid.length !== 1) return fail('Con più partite si creano solo nuovi alberi.')
    return importIntoActive(valid[0])
  }

  return {
    isOpen, mode, placement, selectionTick, request, targetBadge,
    registerPlacementApi, canPlace, describePlacement, touchSelection, addTrees, runImport
  }
})
