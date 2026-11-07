// Tour di benvenuto: mostra i comandi principali, uno alla volta, con il resto della pagina oscurato
import type { DriveStep } from 'driver.js'
import { getSetting, putSetting } from '../db'
import { capabilities } from '../platform'
import { useChessBookStore } from '../stores/chessBookStore'

const SETTING_ID = 'onboardingTour'
const WAIT_MS = 3000

interface TourStep {
  target: string
  title: string
  description: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  onlyLocked?: boolean       // solo con il libro in sola lettura
  onlyIfHidden?: string[]    // solo se almeno uno di questi passi non si può mostrare
}

const canExportPdf = capabilities.localPdf || capabilities.cloudPdf

// Ogni passo indica l'elemento con data-tour="…"; i testi usano le etichette dell'interfaccia
const STEPS: TourStep[] = [
  {
    target: 'sections', side: 'right', title: 'Sezioni del libro',
    description: 'Qui trovi copertina, capitoli e indice. Con <b>Nuovo Capitolo</b> aggiungi un capitolo; '
      + 'con <b>Copertina</b> e <b>Indice</b> la pagina iniziale e l’indice generato dai titoli.',
  },
  {
    target: 'lock', side: 'bottom', title: 'Sola lettura', onlyLocked: true,
    description: 'Il libro è in sola lettura: i comandi di scrittura sono nascosti. '
      + 'Clicca l’interruttore, che diventa <b>Modifica attiva</b>, per modificarlo.',
  },
  {
    target: 'styles', side: 'bottom', title: 'Titoli',
    description: 'Da <b>Stili del paragrafo</b> scegli <b>Titolo 1</b>, <b>Titolo 2</b> o <b>Titolo 3</b>. '
      + 'Il Titolo 1 dà il nome al capitolo e i titoli formano l’indice.',
  },
  {
    target: 'tree-block', side: 'bottom', title: 'Blocco mosse',
    description: '<b>Inserisci blocco mosse</b> crea, dopo il paragrafo del cursore, un albero di mosse '
      + 'che parte dalla posizione della scacchiera.',
  },
  {
    target: 'more-tools', side: 'bottom', title: 'Altri strumenti', onlyIfHidden: ['styles', 'tree-block'],
    description: 'Con la finestra stretta alcuni strumenti, come <b>Stili del paragrafo</b> e '
      + '<b>Inserisci blocco mosse</b>, sono qui: il pulsante li mostra tutti.',
  },
  {
    target: 'board', side: 'left', title: 'Scacchiera',
    description: 'Con un blocco mosse selezionato, le mosse che giochi qui vengono registrate nel blocco. '
      + 'I pulsanti sotto la scacchiera, o i tasti freccia, scorrono la partita.',
  },
  {
    target: 'insert-diagram', side: 'top', title: 'Diagrammi',
    description: '<b>Inserisci Diagramma</b> stampa nel testo la posizione della scacchiera, con numero e didascalia.',
  },
  {
    target: 'properties', side: 'right', title: 'Proprietà del libro',
    description: 'Formato di stampa, spaziatura, numerazione dei titoli e layout a due colonne.',
  },
  {
    target: 'file-actions', side: 'bottom', title: 'Salvare ed esportare',
    description: canExportPdf
      ? '<b>Salva Lavoro</b> salva il libro in un file .mtcbook. Il pulsante di esportazione crea il PDF del capitolo o del libro intero.'
      : '<b>Salva Lavoro</b> salva il libro in un file .mtcbook. Il PDF si crea aprendo il file con l’app desktop.',
  },
  {
    target: 'settings', side: 'bottom', title: 'Rivedere il tour',
    description: 'Puoi rivedere questo tour da <b>Impostazioni</b>. Per tutti i dettagli c’è il <b>Manuale utente</b>, qui accanto.',
  },
]

// Tagliato da un contenitore che non scorre (la riga compressa della toolbar): l'utente non lo vede.
// Dopo un contenitore che scorre ci si ferma: il tour lo porta in vista da solo.
const clippedAway = (el: HTMLElement, r: DOMRect): boolean => {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(p)
    if (/auto|scroll/.test(overflowX + overflowY)) return false
    if (/hidden|clip/.test(overflowX + overflowY)) {
      const c = p.getBoundingClientRect()
      if (r.bottom <= c.top || r.top >= c.bottom || r.right <= c.left || r.left >= c.right) return true
    }
  }
  return false
}

// Un passo si mostra solo se l'utente può vedere l'elemento: niente pulsanti nascosti, tagliati o coperti
const visibleTarget = (name: string): HTMLElement | null => {
  const el = document.querySelector<HTMLElement>(`[data-tour="${name}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 || r.height === 0 || clippedAway(el, r)) return null
  const x = r.left + r.width / 2
  const y = r.top + Math.min(r.height / 2, 20)
  if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return el   // fuori vista: si scorre
  const hit = document.elementFromPoint(x, y)
  return hit && (hit === el || el.contains(hit)) ? el : null
}

const visibleSteps = (): DriveStep[] =>
  STEPS.flatMap((s) => {
    if (s.onlyLocked && !useChessBookStore().isLocked) return []
    if (s.onlyIfHidden && s.onlyIfHidden.every((t) => visibleTarget(t))) return []
    const element = visibleTarget(s.target)
    return element ? [{ element, popover: { title: s.title, description: s.description, side: s.side, align: 'start' as const } }] : []
  })

let running = false

/** Avvia il tour sui comandi visibili ora. Restituisce false se non c'è niente da mostrare (nessun libro aperto). */
export async function startTour(): Promise<boolean> {
  if (running) return true
  const steps = visibleSteps()
  if (!steps.length) return false
  running = true

  // La libreria si scarica solo quando serve
  const [{ driver }] = await Promise.all([import('driver.js'), import('driver.js/dist/driver.css')])
  const tour = driver({
    steps,
    popoverClass: 'mtc-tour',
    showProgress: true,
    progressText: '{{current}} di {{total}}',
    nextBtnText: 'Avanti',
    prevBtnText: 'Indietro',
    doneBtnText: 'Fine',
    closeBtnLabel: 'Chiudi il tour',
    overlayOpacity: 0.55,
    stagePadding: 6,
    stageRadius: 8,
    disableActiveInteraction: true,   // durante il tour si guarda: un clic non deve cambiare il libro
    onPopoverRender: (popover, { driver: d }) => {
      if (d.isLastStep()) return
      const skip = document.createElement('button')
      skip.type = 'button'
      skip.className = 'driver-popover-footer-btn mtc-tour-skip'
      skip.textContent = 'Salta'
      skip.addEventListener('click', () => d.destroy())
      popover.footerButtons.prepend(skip)
    },
    onDestroyed: () => { running = false },
  })
  tour.drive()
  return true
}

const seen = async (): Promise<boolean> => {
  try {
    const raw = await getSetting(SETTING_ID)
    return !!raw && typeof raw === 'object' && (raw as { seen?: unknown }).seen === true
  } catch {
    return true   // senza preferenze leggibili meglio non mostrarlo a ogni libro
  }
}

/** Primo libro creato su questo dispositivo: il tour parte da solo, una volta sola. */
export async function startTourIfNew() {
  if (await seen()) return
  const start = Date.now()
  while (!visibleTarget('sections') && Date.now() - start < WAIT_MS) {
    await new Promise((r) => setTimeout(r, 100))
  }
  // Si segna subito: chiuso o interrotto, il tour non riparte da solo
  if (await startTour()) {
    try { await putSetting(SETTING_ID, { version: 1, seen: true }) } catch (e) { console.error('[tour] Impossibile salvare le impostazioni:', e) }
  }
}
