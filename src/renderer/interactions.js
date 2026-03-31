const { ipcRenderer } = require('electron')

const petCanvas = document.getElementById('pet-canvas')

petCanvas.addEventListener('mouseenter', () => {
  ipcRenderer.send('set-ignore-mouse', false)
})

petCanvas.addEventListener('mouseleave', () => {
  ipcRenderer.send('set-ignore-mouse', true)
})

console.log('Interactions initialized: IPC listeners bound to canvas.')
