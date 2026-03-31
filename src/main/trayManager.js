import { Tray, Menu, app, nativeImage } from 'electron'
import { join } from 'path'
import { getWindow } from './windowManager.js'
import store from './store.js'
import fs from 'fs'

let tray = null

export function setupTray() {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'app/assets/tray-icon.ico')
    : join(__dirname, '../../assets/tray-icon.ico')
  console.log('[Tray] Icon path:', iconPath)
  console.log('[Tray] Is packaged:', app.isPackaged)
  console.log('[Tray] File exists:', fs.existsSync(iconPath))
  
  let trayIcon = nativeImage.createFromPath(iconPath)
  console.log('[Tray] Icon loaded, isEmpty:', trayIcon.isEmpty())

  if (trayIcon.isEmpty()) {
    console.log('[Tray] Icon empty, using fallback')
    trayIcon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAADFJREFUOE9jZKAQMFKon2HVAQwM/xmwmkFXx/D/PwPDIxigw0MHg56OATU1gYKBQn0AligP3w8D3XIAAAAASUVORK5CYII='
    )
  }

  tray = new Tray(trayIcon)
  tray.setToolTip("Ann's Companions ✨")
  console.log('[Tray] Created successfully')

  const charactersDir = app.isPackaged
    ? join(process.resourcesPath, 'src/characters')
    : join(__dirname, '../../src/characters')

  let activeCharsMenu = []

  try {
    const charDirs = fs.readdirSync(charactersDir)
    for (const dir of charDirs) {
      if (fs.lstatSync(join(charactersDir, dir)).isDirectory()) {
        try {
          const charPath = join(charactersDir, dir, 'character.json')
          const charData = JSON.parse(fs.readFileSync(charPath, 'utf8'))
          const id = charData.id || dir
          const name = charData.name || dir

          activeCharsMenu.push({
            label: name,
            type: 'checkbox',
            checked: store.get('activeCharacters').includes(id),
            click: (menuItem) => toggleCharacter(id, menuItem.checked)
          })
        } catch {
          // Ignore missing character.json
        }
      }
    }
  } catch {
    activeCharsMenu.push({ label: 'No characters found', disabled: true })
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: "Ann's Companions ✨", enabled: false },
    { type: 'separator' },
    {
      label: 'Active Characters',
      submenu: activeCharsMenu
    },
    { type: 'separator' },
    {
      label: 'Pause all',
      click: () => {
        const win = getWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send('pause-all')
        }
      }
    },
    {
      label: 'Resume all',
      click: () => {
        const win = getWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send('resume-all')
        }
      }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])

  function toggleCharacter(id, isChecked) {
    let actives = [...store.get('activeCharacters')]
    if (isChecked && !actives.includes(id)) {
      actives.push(id)
    } else if (!isChecked && actives.includes(id)) {
      actives = actives.filter((c) => c !== id)
    }
    store.set('activeCharacters', actives)

    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('active-characters-changed', actives)
    }
  }

  tray.setToolTip("Ann's Companions")
  tray.setContextMenu(contextMenu)

  // Force menu to show on left-click as well (Windows sometimes ignores clicks)
  tray.on('click', () => {
    tray.popUpContextMenu()
  })
}
