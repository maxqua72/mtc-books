<template>
  <BaseModal :is-open="pdfNoticeOpen" labelledby="pdf-notice-title" @close="pdfNoticeOpen = false">
    <div class="px-6 py-5 space-y-3">
      <h3 id="pdf-notice-title" class="text-lg font-semibold text-neutral-900">PDF disponibile nell'app desktop</h3>
      <p class="text-sm text-neutral-600 leading-relaxed">
        L'esportazione in PDF si fa con l'app desktop di MTC Book, che genera il file direttamente sul tuo computer.
      </p>
      <p class="text-sm text-neutral-600 leading-relaxed">
        Puoi continuare a scrivere qui: salva il libro in un file .mtcbook e aprilo con l'app desktop per esportarlo.
      </p>
    </div>
    <div class="border-t border-neutral-200 px-6 py-3 flex justify-end gap-2">
      <button type="button" @click="pdfNoticeOpen = false"
        class="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition">
        Chiudi
      </button>
      <a :href="DOWNLOAD_URL" target="_blank" rel="noopener noreferrer" @click="pdfNoticeOpen = false"
        class="bg-neutral-900 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-neutral-800 transition">
        Scarica l'app desktop
      </a>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { DOWNLOAD_URL } from '@mtc/shared'
import { pdfNoticeOpen } from '../platform/pdfNotice'
import BaseModal from './BaseModal.vue'
</script>
