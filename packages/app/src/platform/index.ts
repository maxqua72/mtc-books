import type { Platform } from './types'
import { createWebPlatform } from './web'
import { createDesktopPlatform } from './desktop'

// Unico punto in cui si distingue la piattaforma: il preload di Electron espone window.mtcDesktop
export const platform: Platform = window.mtcDesktop ? createDesktopPlatform() : createWebPlatform()
export const capabilities = platform.capabilities
export type { Platform } from './types'