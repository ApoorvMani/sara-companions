import { app, BrowserWindow, dialog } from 'electron'
import { createWindow, getWindow } from './windowManager.js'
import { setupIpcHandlers } from './ipcHandlers.js'
import { setupTray } from './trayManager.js'
import store from './store.js'
import fs from 'fs'
import path from 'path'

// Global crash handler
const logCrash = (error) => {
  try {
    const logPath = path.join(app.getPath('userData'), 'crash.log')
    fs.appendFileSync(logPath, `${new Date().toISOString()} - ${error.stack || error}\n`)
  } catch {
    // Ignore logging errors
  }
}
process.on('uncaughtException', logCrash)
process.on('unhandledRejection', logCrash)

app.whenReady().then(() => {
  createWindow()

  // First launch startup registration prompt (show after window creation)
  if (store.get('firstLaunch')) {
    store.set('firstLaunch', false)
    dialog
      .showMessageBox(getWindow(), {
        type: 'question',
        buttons: ['Yes', 'No'],
        title: 'Startup Settings',
        message: "Would you like Ann's Companions to start automatically with Windows?"
      })
      .then((result) => {
        if (result.response === 0) {
          app.setLoginItemSettings({ openAtLogin: true })
        }
      })
  }
  setupIpcHandlers()
  setupTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
