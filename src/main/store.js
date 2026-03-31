import StoreMod from 'electron-store'

const Store = StoreMod.default || StoreMod

const store = new Store({
  defaults: {
    isPaused: false,
    activeCharacters: ['harry', 'snape'],
    firstLaunch: true,
    volume: 50,
    birthdayMessage: 'Happy Birthday!',
    lastInteraction: Date.now()
  }
})

// Force Snape to be active if he was just downloaded
const currentActives = store.get('activeCharacters') || []
if (!currentActives.includes('snape')) {
  store.set('activeCharacters', [...currentActives, 'snape'])
}

export default store
