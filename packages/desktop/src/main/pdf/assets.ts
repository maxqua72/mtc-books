import { app } from 'electron'
import path from 'node:path'

/** Font e pdfjs copiati da scripts/copy-assets.mjs: in sviluppo in packages/desktop/resources, installata nella cartella resources */
export const assetsDir = () => (app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '../resources'))
export const fontsDir = () => path.join(assetsDir(), 'fonts')
export const pdfjsDir = () => path.join(assetsDir(), 'pdfjs')