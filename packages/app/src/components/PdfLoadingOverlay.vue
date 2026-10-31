<template>
  <div class="absolute inset-0 bg-white/95 backdrop-blur-sm z-[99999] flex flex-col items-center justify-center gap-4">
    <div class="w-12 h-12 border-4 border-neutral-800 border-t-transparent rounded-full animate-spin"></div>
    <div class="text-center">
      <p class="font-semibold text-neutral-800 text-lg">{{ title }}</p>
      <p class="text-sm text-neutral-500 mt-1">{{ subtitle }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; subtitle: string }>()
</script>
