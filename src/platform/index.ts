import type { Platform } from './types'
import { createWebPlatform } from './web'

// Fase 4: qui si sceglierà l'adattatore desktop se il preload di Electron è presente
export const platform: Platform = createWebPlatform()
export const capabilities = platform.capabilities
export type { Platform } from './types'