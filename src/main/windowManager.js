import { BrowserWindow, screen } from 'electron'
import { join } from 'path'

let petWindow

export function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  petWindow = new BrowserWindow({
    width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  // Temporarily open devtools for debugging!
  // petWindow.webContents.openDevTools({ mode: 'detach' });

  // Implement mouse click-through
  petWindow.setIgnoreMouseEvents(true, { forward: true })

  // Show on all virtual desktops
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // HMR for renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    petWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    petWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Poll and send mouse cursor position to the renderer at roughly 60fps
  setInterval(() => {
    if (petWindow && !petWindow.isDestroyed()) {
      const point = screen.getCursorScreenPoint()
      const bounds = petWindow.getBounds()
      // Translate global screen coordinates to window-relative coordinates
      petWindow.webContents.send('cursor-position', {
        x: point.x - bounds.x,
        y: point.y - bounds.y
      })
    }
  }, 16)

  return petWindow
}

export function getWindow() {
  return petWindow
}
