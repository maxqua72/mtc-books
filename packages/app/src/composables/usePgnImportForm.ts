// Stato e logica del pannello "Importa PGN": sorgente, partite, destinazione, importazione
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useChessTreeStore } from '../stores/chessTreeStore'
import { useChessBookStore } from '../stores/chessBookStore'
import { usePgnImportStore } from '../stores/pgnImportStore'
import { parsePgnText, buildTreeFromGame, nodeLabel, type PgnGameInfo, type ImportStats } from '../utils/pgnImport'
import { samePosition } from '../utils/fen'

const CONFIRM_THRESHOLD = 50          // oltre questo numero di alberi si chiede conferma
const PREVIEW_LIMIT = 30              // oltre questo numero di partite non si calcolano le statistiche per riga
const MAX_FILE_BYTES = 5 * 1024 * 1024

type ParsedPgn = { games: PgnGameInfo[]; empty?: number; error?: string }

export function usePgnImportForm() {
  const treeStore = useChessTreeStore()
  const bookStore = useChessBookStore()
  const pgn = usePgnImportStore()

  const locked = computed(() => bookStore.isLocked)
  const canUse = computed(() => bookStore.activeSectionInfo?.type === 'chapter' && !bookStore.isLocked)

  // Il pannello aperto attiva i riferimenti nel documento (riquadro tratteggiato e cartellino)
  watch(canUse, (v) => { pgn.isOpen = v }, { immediate: true })
  onBeforeUnmount(() => { pgn.isOpen = false })

  // --- Sorgente ---
  const text = ref('')
  const fileError = ref('')
  const parsed = ref<ParsedPgn>({ games: [] })
  const selectedIdx = ref<number[]>([])
  const result = ref<{ ok: boolean; message: string } | null>(null)

  let timer: number | undefined
  // Dopo un'importazione riuscita il pannello si svuota ma l'esito deve restare visibile:
  // durante lo svuotamento i watcher non lo azzerano
  let keepResult = false

  watch(text, (value) => {
    fileError.value = ''
    if (!keepResult) result.value = null
    window.clearTimeout(timer)
    if (!value.trim()) {
      parsed.value = { games: [] }
      selectedIdx.value = []
      return
    }
    timer = window.setTimeout(() => {
      parsed.value = parsePgnText(value)
      selectedIdx.value = parsed.value.games.filter(g => !g.problem).map(g => g.index)
    }, 300)
  })
  watch(selectedIdx, () => { if (!keepResult) result.value = null })

  /** Svuota testo, elenco e selezione. `keep`: conserva l'esito dell'ultima operazione. */
  const clearSource = (keep = false) => {
    window.clearTimeout(timer)
    keepResult = keep
    text.value = ''
    fileError.value = ''
    parsed.value = { games: [] }
    selectedIdx.value = []
    if (!keep) result.value = null
    nextTick(() => { keepResult = false })   // i watcher sono già passati
  }

  // L'esito resta finché non ci si sposta su un altro albero: il primo albero attivato
  // dall'importazione stessa non conta
  let importedTreeId: string | null = null
  watch(() => treeStore.activeTreeId, (id) => {
    if (result.value && id !== importedTreeId) result.value = null
  })

  const loadFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) fileError.value = 'Il file è troppo grande (massimo 5 MB).'
    else text.value = await file.text()
  }

  // --- Selezione ---
  const validGames = computed(() => parsed.value.games.filter(g => !g.problem))
  const selectedGames = computed(() =>
    parsed.value.games.filter(g => !g.problem && selectedIdx.value.includes(g.index))
  )
  const allSelected = computed(() => validGames.value.length > 0 && selectedGames.value.length === validGames.value.length)
  const toggleAll = () => {
    selectedIdx.value = allSelected.value ? [] : validGames.value.map(g => g.index)
  }

  // Statistiche per partita: una sola volta per elenco (buildTreeFromGame è costoso)
  const previews = computed(() => {
    const map = new Map<number, ImportStats>()
    if (parsed.value.games.length > PREVIEW_LIMIT) return map
    for (const g of validGames.value) map.set(g.index, buildTreeFromGame(g).stats)
    return map
  })
  const singlePreview = computed<ImportStats | null>(() => {
    if (selectedGames.value.length !== 1) return null
    const g = selectedGames.value[0]
    return previews.value.get(g.index) ?? buildTreeFromGame(g).stats
  })

  // --- Destinazione: nuovo albero ---
  const afterActiveAvailable = computed(() => {
    pgn.selectionTick; treeStore.activeTreeId   // dipendenze reattive: il cursore si muove, l'albero attivo cambia
    return pgn.canPlace('after-active')
  })
  watch(afterActiveAvailable, (available) => {
    if (!available && pgn.placement === 'after-active') pgn.placement = 'cursor'
    if (available && pgn.placement === 'cursor' && !pgn.isOpen) pgn.placement = 'after-active'
  }, { immediate: true })

  const placementLabel = computed(() => {
    pgn.selectionTick; treeStore.activeTreeId
    return pgn.describePlacement(pgn.placement)
  })

  // --- Destinazione: albero attivo ---
  const intoActiveReason = computed<string | null>(() => {
    const tree = treeStore.currentTree
    if (!tree) return 'Nessun albero attivo: cliccane uno nel documento.'
    if (selectedGames.value.length > 1) return 'Con più partite si creano solo nuovi alberi.'
    if (selectedGames.value.length === 0 || tree.rootNodes.length === 0) return null
    const targetFen = treeStore.currentNode?.fen ?? tree.startingFen
    return samePosition(selectedGames.value[0].startFen, targetFen)
      ? null
      : 'La posizione di partenza del PGN non coincide con quella della mossa selezionata.'
  })
  watch(intoActiveReason, (reason) => {
    if (reason && pgn.mode === 'into-active') pgn.mode = 'new-tree'
  })

  const intoActiveText = computed(() => {
    const tree = treeStore.currentTree
    if (!tree) return ''
    if (tree.rootNodes.length === 0) {
      return `Il PGN diventa il contenuto dell’albero «${tree.title}» e ne fissa la posizione iniziale.`
    }
    const node = treeStore.currentNode
    const where = node ? `dopo la mossa ${nodeLabel(node)}` : 'all’inizio'
    return `Si aggancia ${where} dell’albero «${tree.title}», evidenziato nel documento. Le mosse già presenti vengono unite.`
  })

  // --- Importazione ---
  const canImport = computed(() =>
    selectedGames.value.length > 0 && (pgn.mode === 'new-tree' || !intoActiveReason.value)
  )

  const doImport = () => {
    if (!canImport.value) return
    const n = selectedGames.value.length
    if (pgn.mode === 'new-tree' && n > CONFIRM_THRESHOLD &&
      !confirm(`Stai per creare ${n} alberi di mosse nel capitolo: l’editor potrebbe rallentare. Continuare?`)) return
    result.value = pgn.runImport(selectedGames.value, parsed.value.empty ?? 0)
    importedTreeId = treeStore.activeTreeId
    // Riuscita: il PGN non serve più. Fallita: resta tutto, così si corregge senza reincollare.
    if (result.value.ok) clearSource(true)
  }

  return {
    pgn, locked, canUse,
    text, fileError, parsed, selectedIdx, result, clearSource, loadFile,
    selectedGames, allSelected, toggleAll, previews, singlePreview,
    afterActiveAvailable, placementLabel, intoActiveReason, intoActiveText,
    canImport, doImport,
  }
}
