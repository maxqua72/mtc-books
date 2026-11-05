/** Apre una pagina del manuale: sul web in una nuova scheda, nel desktop nella finestra del manuale */
export const openManualPage = (page = 'index') =>
  window.open(`${import.meta.env.BASE_URL}manual/${page}.html`, '_blank', 'noopener')
