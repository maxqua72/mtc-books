import { ref } from 'vue'

/** Nella web app il PDF non si genera: la finestra PdfDesktopNotice invita a usare l'app desktop */
export const pdfNoticeOpen = ref(false)

export function showPdfDesktopNotice() {
  pdfNoticeOpen.value = true
}
