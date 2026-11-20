<template>
  <!-- Mosse in notazione inglese mostrate con le figurine (come nel libro) -->
  <template v-for="(s, i) in segments" :key="i"><span v-if="s.cls" class="move-text-fig" :class="s.cls" role="img" :aria-label="s.letter">{{ s.text }}</span><template v-else>{{ s.text }}</template></template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { figurineSegments } from '../../utils/figurines'

const props = defineProps<{ text: string }>()
const segments = computed(() => figurineSegments(props.text))
</script>

<style scoped>
.move-text-fig {
  font-weight: normal;
  font-style: normal;
  line-height: 1;
}

.move-text-fig.tgc-figurine {
  font-family: 'Chess The Good Companions', sans-serif;
  font-size: 1.1em;
  margin-right: 1px;
  vertical-align: 1px;
}

.move-text-fig.chess-cases-figurine {
  font-family: 'Chess Cases', sans-serif;
  font-size: 1.15em;
  vertical-align: -2px;
}
</style>
