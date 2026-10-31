export interface PlatformCapabilities {
  cloudPdf: boolean     // PDF via servizio HTTP
  localPdf: boolean     // PDF locale (desktop)
  nativeFiles: boolean  // dialoghi e salvataggio su disco (desktop)
  engine: boolean       // motore UCI (desktop)
  multiTabLock: boolean // controllo "già aperto in un'altra scheda"
}