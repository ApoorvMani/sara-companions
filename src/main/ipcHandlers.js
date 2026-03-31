import { ipcMain, app } from 'electron'
import { getWindow } from './windowManager.js'

import store from './store.js'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export function setupIpcHandlers() {
  // Allow renderer to temporarily enable mouse events when hovering over the character
  ipcMain.on('set-ignore-mouse', (event, ignore) => {
    const win = getWindow()
    if (win) {
      if (ignore) {
        win.setIgnoreMouseEvents(true, { forward: true })
      } else {
        win.setIgnoreMouseEvents(false)
      }
    }
  })

  ipcMain.handle('get-store-value', (event, key) => {
    return store.get(key)
  })

  ipcMain.handle('set-store-value', (event, key, value) => {
    store.set(key, value)
  })

  ipcMain.handle('get-character-data', async (event, charId) => {
    try {
      const charDir = app.isPackaged
        ? path.join(process.resourcesPath, 'src/characters', charId)
        : path.join(__dirname, '../../src/characters', charId)

      const charPath = path.join(charDir, 'character.json')
      const spritePath = path.join(charDir, 'spritesheet.png')
      const spriteJsonPath = path.join(charDir, 'spritesheet.json')

      const data = await fs.readFile(charPath, 'utf-8')
      const charData = JSON.parse(data)
      
      charData.spritesheetPath = spritePath
      charData.spritesheetJsonPath = spriteJsonPath
      
      return charData
    } catch (e) {
      console.error('Failed to load character data for', charId, e)
      return null
    }
  })
}
