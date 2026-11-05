import { defineConfig } from 'vitepress'

// Il manuale si genera dentro la build dell'app: web e installer lo includono da soli.
// L'indirizzo /manual/index.html è usato da AppHeader.vue e dal menu Aiuto del desktop.
export default defineConfig({
  lang: 'it-IT',
  title: 'Manuale di MTC Books',
  description: 'Guida all’uso di MTC Books',
  base: '/manual/',
  outDir: '../app/dist/manual',
  metaChunk: true, // meno script inline: l'app ha una CSP rigida (vedi desktop/src/main/csp.ts)
  themeConfig: {
    sidebar: [
      {
        text: 'Per iniziare',
        items: [
          { text: 'Introduzione', link: '/' },
          { text: 'Installazione', link: '/installazione' },
          { text: 'Primi passi', link: '/primi-passi' },
        ],
      },
      {
        text: 'Il libro',
        items: [
          { text: 'Struttura e proprietà', link: '/struttura-libro' },
          { text: 'Scrivere il testo', link: '/scrittura' },
          { text: 'Copertina', link: '/copertina' },
        ],
      },
      {
        text: 'Scacchi',
        items: [
          { text: 'Scacchiera e console', link: '/scacchiera' },
          { text: 'Alberi di mosse', link: '/alberi-mosse' },
          { text: 'Diagrammi', link: '/diagrammi' },
          { text: 'Importare un PGN', link: '/import-pgn' },
          { text: 'Motore di analisi', link: '/motore' },
        ],
      },
      {
        text: 'File e stampa',
        items: [
          { text: 'Salvare e aprire', link: '/salvataggio' },
          { text: 'Esportare in PDF', link: '/esportazione-pdf' },
        ],
      },
      {
        text: 'Riferimento',
        items: [
          { text: 'Impostazioni', link: '/impostazioni' },
          { text: 'Scorciatoie da tastiera', link: '/scorciatoie' },
          { text: 'Problemi frequenti', link: '/problemi' },
          { text: 'Glossario', link: '/glossario' },
          { text: 'Privacy', link: '/privacy' },
        ],
      },
    ],
    outline: { level: [2, 3], label: 'In questa pagina' },
    docFooter: { prev: 'Pagina precedente', next: 'Pagina successiva' },
    sidebarMenuLabel: 'Menu',
    returnToTopLabel: 'Torna su',
    darkModeSwitchLabel: 'Aspetto',
    lightModeSwitchTitle: 'Passa al tema chiaro',
    darkModeSwitchTitle: 'Passa al tema scuro',
    notFound: {
      title: 'Pagina non trovata',
      quote: 'Questa pagina non esiste nel manuale.',
      linkLabel: 'Torna all’introduzione',
      linkText: 'Torna all’introduzione',
    },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'Cerca', buttonAriaLabel: 'Cerca nel manuale' },
          modal: {
            displayDetails: 'Mostra i dettagli',
            resetButtonTitle: 'Cancella la ricerca',
            backButtonTitle: 'Chiudi la ricerca',
            noResultsText: 'Nessun risultato per',
            footer: {
              selectText: 'apri',
              navigateText: 'spostati',
              closeText: 'chiudi',
            },
          },
        },
      },
    },
  },
})
