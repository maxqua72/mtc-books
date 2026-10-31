import { downloadBlob } from '../../utils/download'
import type { FilesPlatform, PickedBook } from '../types'

export const webFiles: FilesPlatform = {
  // Va chiamato direttamente dal gestore del clic: il browser richiede il gesto dell'utente
  pickBook() {
    return new Promise<PickedBook | null>((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.mtcbook'
      input.style.display = 'none'
      document.body.appendChild(input)   // un input staccato dal DOM può essere raccolto prima dell'evento

      const finish = (result: PickedBook | null, error?: unknown) => {
        input.remove()
        if (error) reject(error)
        else resolve(result)
      }

      input.addEventListener('change', async () => {
        const file = input.files?.[0]
        if (!file) return finish(null)
        try {
          finish({ data: await file.arrayBuffer(), name: file.name })
        } catch (e) {
          finish(null, e)
        }
      })
      input.addEventListener('cancel', () => finish(null))
      input.click()
    })
  },

  async saveBook(blob, suggestedName) {
    downloadBlob(blob, suggestedName)
  }
}