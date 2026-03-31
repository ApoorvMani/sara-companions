const { ipcRenderer } = window.require('electron')
import BehaviorEngine from './behaviorEngine.js'
import SpeechBubble from './ui/speechBubble.js'
import ContextMenu from './ui/contextMenu.js'
import { checkAndRunBirthdaySurprise } from './birthdaySurprise.js'
import Animator from './animator.js'

class PetManager {
  constructor() {
    this.pets = new Map()
    this.mouseX = -1000
    this.mouseY = -1000
    this.isAnyHit = false
    this.crossoverCooldown = false

    ipcRenderer.on('cursor-position', (event, point) => {
      this.mouseX = point.x
      this.mouseY = point.y
      this.checkHitTest()
    })

    ipcRenderer.on('active-characters-changed', async (event, actives) => {
      await this.syncCharacters(actives)
    })

    ipcRenderer.on('pause-all', () => {
      this.pets.forEach((p) => (p.isPaused = true))
    })

    ipcRenderer.on('resume-all', () => {
      this.pets.forEach((p) => (p.isPaused = false))
    })

    this.initCharacters()

    // Check Jimin wave every 30 seconds
    setInterval(() => this.checkJiminWave(), 30000)

    requestAnimationFrame(() => this.loop())
  }

  async recordInteraction() {
    await ipcRenderer.invoke('set-store-value', 'lastInteraction', Date.now())
  }

  async checkJiminWave() {
    const jimin = this.pets.get('jimin')
    if (!jimin) return

    const lastInteraction = await ipcRenderer.invoke('get-store-value', 'lastInteraction')
    if (Date.now() - lastInteraction > 5 * 60 * 1000) {
      // 5 minutes
      // Wave / Dance
      jimin.engine.forceState('DANCE')
      jimin.bubble.show('Wave~', 2000) // small wave
      // Reset timer so he doesn't spam every interval
      this.recordInteraction()
    }
  }

  async initCharacters() {
    const actives = await ipcRenderer.invoke('get-store-value', 'activeCharacters')
    await this.syncCharacters(actives)

    // Check first launch
    checkAndRunBirthdaySurprise(Array.from(this.pets.values()))
  }

  async syncCharacters(actives) {
    for (const [id, pet] of this.pets.entries()) {
      if (!actives.includes(id)) {
        pet.destroy()
        this.pets.delete(id)
      }
    }
    for (const id of actives) {
      if (!this.pets.has(id)) {
        const charData = await ipcRenderer.invoke('get-character-data', id)
        if (charData) {
          const pet = new PetController(charData, this)
          this.pets.set(id, pet)
        }
      }
    }
  }

  checkHitTest() {
    let anyHit = false
    
    const isMenuOpen = Array.from(document.querySelectorAll('.context-menu')).some(
      (el) => el.style.opacity === '1' || el.style.display === 'block'
    )
    
    // Check if the Birthday Card is actively rendering or ANY context menu is open
    if (document.querySelector('.birthday-card') || isMenuOpen) {
      anyHit = true
    } else {
      for (const pet of this.pets.values()) {
        pet.mouseX = this.mouseX
        pet.mouseY = this.mouseY
        if (pet.checkHitTestLocal()) {
          anyHit = true
        }
      }
    }

    if (anyHit !== this.isAnyHit) {
      this.isAnyHit = anyHit
      ipcRenderer.send('set-ignore-mouse', !this.isAnyHit)
    }
  }

  loop() {
    this.checkCrossover()
    this.checkBtsCrossover()
    requestAnimationFrame(() => this.loop())
  }

  checkBtsCrossover() {
    if (this.btsCooldown) return

    const btsPets = Array.from(this.pets.values()).filter(
      (p) => p.charData.universe === 'bts' || p.charData.universe === 'BTS'
    )
    if (btsPets.length >= 2) {
      const p1 = btsPets[0]
      const p2 = btsPets[1]

      if (
        !p1.isReacting &&
        !p2.isReacting &&
        p1.engine.currentState !== 'DRAG' &&
        p2.engine.currentState !== 'DRAG' &&
        p1.engine.currentState !== 'CLIMB' &&
        p2.engine.currentState !== 'CLIMB'
      ) {
        const dx = p1.x - p2.x
        const dist = Math.abs(dx)

        if (dist > 80) {
          // Seek
          if (p1.x < p2.x) {
            if (p1.engine.currentState !== 'WALK_RIGHT') p1.engine.forceState('WALK_RIGHT')
            if (p2.engine.currentState !== 'WALK_LEFT') p2.engine.forceState('WALK_LEFT')
          } else {
            if (p1.engine.currentState !== 'WALK_LEFT') p1.engine.forceState('WALK_LEFT')
            if (p2.engine.currentState !== 'WALK_RIGHT') p2.engine.forceState('WALK_RIGHT')
          }
        } else {
          // Perform
          this.btsCooldown = true
          p1.engine.forceState('DANCE', 5000)
          p2.engine.forceState('DANCE', 5000)

          p1.isMoving = false
          p2.isMoving = false

          setTimeout(() => {
            this.btsCooldown = false
          }, 60000) // Cool down for a minute before seeking again
        }
      }
    }
  }

  checkCrossover() {
    if (this.crossoverCooldown) return

    const petsArr = Array.from(this.pets.values())
    if (petsArr.length < 2) return

    // Specifically for Harry and Dean as per prompt
    const harry = this.pets.get('harry')
    const dean = this.pets.get('dean')

    if (harry && dean && !harry.isReacting && !dean.isReacting && harry.isMoving && dean.isMoving) {
      const dx = harry.x - dean.x
      const dy = harry.y - dean.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < 100) {
        this.crossoverCooldown = true

        // Stop both
        harry.engine.forceState('STAY')
        dean.engine.forceState('STAY')
        harry.isMoving = false
        dean.isMoving = false

        // Crossover confusion sequence
        harry.bubble.show('Who are you?', 3000)
        setTimeout(() => {
          dean.bubble.show('What the—a wizard?', 3000)
        }, 1000)

        setTimeout(() => {
          harry.engine.forceState('IDLE')
          dean.engine.forceState('IDLE')
          this.crossoverCooldown = false
        }, 4000)
      }
    }
  }
}

export class PetController {
  constructor(charData, manager) {
    this.charData = charData
    this.manager = manager
    this.width = 128
    this.height = 128

    const taskbarRegionTop = window.innerHeight * 0.85
    const maxTop = window.innerHeight - this.height
    this.y = taskbarRegionTop + Math.random() * (maxTop - taskbarRegionTop)

    if (this.y > maxTop) this.y = maxTop
    if (this.y < 0) this.y = 0

    this.x = Math.random() * (window.innerWidth - this.width)

    this.speed = 1.5
    this.direction = 1
    this.isMoving = false

    this.mouseX = -1000
    this.mouseY = -1000
    this.isReacting = false
    this.isPaused = false

    // Drag state
    this.dragOffsetX = 0
    this.dragOffsetY = 0
    this.climbHeight = 0

    this.createElement()
    this.setupEvents()
    this.setupBehavior()

    this.loadSpriteSheet()

    this.loopId = requestAnimationFrame(() => this.loop())
  }

  async loadSpriteSheet() {
    this.animator = new Animator(this.canvas, 10)
    
    this.animator.onFrameRender = (w, h) => {
      if (this.width !== w || this.height !== h) {
        this.width = w
        this.height = h
        if (this.container) {
          this.container.style.width = w + 'px'
          this.container.style.height = h + 'px'
        }
      }
    }

    // Updated frame mappings based on visual analysis of the 46 frames (0-indexed)
    this.animator.registerAnimation('IDLE', [0, 1, 2, 0], 2) // Stand, blink, look
    this.animator.registerAnimation('WALK_LEFT', [4, 5, 4, 5], 5) // Walk
    this.animator.registerAnimation('WALK_RIGHT', [4, 5, 4, 5], 5) 
    this.animator.registerAnimation('SIT', [10, 11, 12, 18], 2) // Sit neutral, shy, blink
    this.animator.registerAnimation('SLEEP', [19, 20, 19, 20], 2) // Lying down / sleep
    this.animator.registerAnimation('DANCE', [36, 37, 36, 37], 5) // Special Magic/Broom / Snitch
    this.animator.registerAnimation('CLIMB', [22, 23, 24, 23], 5) // Climb wall
    this.animator.registerAnimation('DRAG', [6, 7, 8, 9], 4) // Pinched/Dragged
    this.animator.registerAnimation('REACT_CLICK', [3], 1) // Surprised/Jumping
    this.animator.registerAnimation('STAY', [27, 32, 33, 34], 3) // Sit and eat treats

    try {
      if (this.charData.spritesheetPath && this.charData.spritesheetJsonPath) {
        await this.animator.load(this.charData.spritesheetPath, this.charData.spritesheetJsonPath)
        this.animator.play(this.engine.currentState)
      }
    } catch (e) {
      console.error('Failed to load sprite', e)
    }
  }

  setupBehavior() {
    this.engine = new BehaviorEngine(this.charData)

    this.engine.onStateChange((state) => {
      // console.log(`[${this.charData.id}] State changed to:`, state);

      this.isMoving = false

      if (this.animator) {
        this.animator.play(state)
      }

      switch (state) {
        case 'WALK_LEFT':
          this.direction = -1
          this.isMoving = true
          break
        case 'WALK_RIGHT':
          this.direction = 1
          this.isMoving = true
          break
        case 'IDLE':
        case 'SIT':
        case 'SLEEP':
        case 'STAY':
          // Stop moving
          break
        case 'DANCE':
          this.sprite.classList.add('react-anim')
          setTimeout(() => {
            this.sprite.classList.remove('react-anim')
            if (this.charData.id === 'jimin') {
              this.bubble.show('💜 mic drop 💜', 3000)
            }
          }, 800)
          break
        case 'REACT_CLICK':
          this.react()
          break
        case 'DRAG':
          this.sprite.style.transform = `scaleX(${this.direction}) rotate(-10deg)`
          break
        case 'CLIMB':
          this.isMoving = true
          this.climbHeight = 100 + Math.random() * 200 // 100-300px climb distance
          break
      }

      if (state !== 'DRAG' && state !== 'REACT_CLICK') {
        this.sprite.style.transform = `scaleX(${this.direction})`
      }
    })

    this.engine.start()
  }

  createElement() {
    this.container = document.createElement('div')
    this.container.style.position = 'absolute'
    this.container.style.width = this.width + 'px'
    this.container.style.height = this.height + 'px'
    this.container.style.left = this.x + 'px'
    this.container.style.top = this.y + 'px'
    this.container.style.pointerEvents = 'auto'

    this.sprite = document.createElement('div')
    this.sprite.style.width = '100%'
    this.sprite.style.height = '100%'
    this.sprite.style.transformOrigin = 'center center'
    this.sprite.style.transition = 'transform 0.1s'

    this.canvas = document.createElement('canvas')
    this.canvas.width = this.width
    this.canvas.height = this.height

    this.sprite.appendChild(this.canvas)
    this.container.appendChild(this.sprite)

    // UI
    this.bubble = new SpeechBubble(this.container)
    this.menu = new ContextMenu(this, this.charData.name)

    document.body.appendChild(this.container)

    this.landingStyle = document.createElement('style')
    this.landingStyle.textContent = `
      @keyframes float-land {
        0% { transform: scale(1) scaleX(var(--facing)); }
        50% { transform: scale(1.2) scaleX(var(--facing)); }
        100% { transform: scale(1) scaleX(var(--facing)); }
      }
      .landing-anim {
        animation: float-land 0.3s ease-out;
      }
    `
    document.head.appendChild(this.landingStyle)
  }

  setupEvents() {
    this.container.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      this.menu.show(e.clientX, e.clientY)
    })

    // Drag and Drop
    this.container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return // Only left click
      this.manager.recordInteraction()
      this.engine.forceState('DRAG')
      this.dragOffsetX = e.clientX - this.x
      this.dragOffsetY = e.clientY - this.y
      this.container.style.cursor = 'grabbing'

      const onMouseMove = (ev) => {
        if (this.engine.currentState === 'DRAG') {
          let newX = ev.clientX - this.dragOffsetX
          let newY = ev.clientY - this.dragOffsetY

          // Clamp to bounds
          if (newX < 0) newX = 0
          if (newX > window.innerWidth - this.width) newX = window.innerWidth - this.width
          if (newY < 0) newY = 0
          if (newY > window.innerHeight - this.height) newY = window.innerHeight - this.height

          this.x = newX
          this.y = newY
        }
      }

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)

        if (this.engine.currentState === 'DRAG') {
          this.container.style.cursor = 'auto'
          this.engine.forceState('IDLE')

          this.sprite.style.setProperty('--facing', this.direction)
          this.sprite.classList.add('landing-anim')
          setTimeout(() => this.sprite.classList.remove('landing-anim'), 300)
        }
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    })
  }

  react() {
    this.isReacting = true
    this.sprite.style.setProperty('--facing', this.direction)
    this.sprite.classList.add('react-anim')

    setTimeout(() => {
      this.sprite.classList.remove('react-anim')
      this.isReacting = false
    }, 2000)
  }

  loop() {
    if (!this.isReacting && !this.isPaused) {
      if (this.engine.currentState === 'CLIMB') {
        this.updateClimb()
      } else if (this.isMoving && this.engine.currentState !== 'DRAG') {
        this.updatePosition()
      } else if (this.engine.currentState === 'IDLE') {
        // Fall back down with gravity if floating in air
        const taskbarRegionTop = window.innerHeight * 0.85
        if (this.y < taskbarRegionTop) {
          this.y += 5 // gravity
        }
      }
    }

    this.container.style.left = this.x + 'px'
    this.container.style.top = this.y + 'px'

    this.loopId = requestAnimationFrame(() => this.loop())
  }

  updatePosition() {
    this.x += this.speed * this.direction

    // Window Climbing: within 5px of edge
    if (this.x <= 5 && this.direction === -1) {
      this.x = 0
      this.engine.forceState('CLIMB')
    } else if (this.x + this.width + 5 >= window.innerWidth && this.direction === 1) {
      this.x = window.innerWidth - this.width
      this.engine.forceState('CLIMB')
    }
  }

  updateClimb() {
    this.y -= this.speed // move up
    this.climbHeight -= this.speed

    // Hit ceiling
    if (this.y <= 5) {
      this.y = 0
      this.engine.forceState('IDLE')
    }

    if (this.climbHeight <= 0) {
      this.engine.forceState('IDLE')
    }
  }

  checkHitTestLocal() {
    const isInsideX = this.mouseX >= this.x && this.mouseX <= this.x + this.width
    const isInsideY = this.mouseY >= this.y && this.mouseY <= this.y + this.height
    return isInsideX && isInsideY
  }

  triggerAction(action) {
    if (this.isReacting) return

    this.manager.recordInteraction()

    switch (action) {
      case 'say_something': {
        const quotes = this.charData.quotes || ['...']
        const q = quotes[Math.floor(Math.random() * quotes.length)]
        this.bubble.show(q, 4000)
        this.engine.recordInteraction()
        break
      }
      case 'signature': {
        if (this.charData.signature) {
          this.engine.forceState('DANCE', 5000)
        } else {
          this.engine.forceState('DANCE', 5000)
        }
        break
      }
      case 'sleep':
        this.engine.forceState('SLEEP', 15000)
        break
      case 'stay':
        this.engine.forceState('STAY', 30000)
        break
      case 'wander':
        this.engine.forceState('IDLE')
        break
      case 'goodbye': {
        this.destroy()
        this.manager.pets.delete(this.charData.id)
        // Also update the store to persist the change
        const actives = [...this.manager.pets.keys()]
        ipcRenderer.invoke('set-store-value', 'activeCharacters', actives)
        break
      }
      default:
        break
    }
  }

  destroy() {
    cancelAnimationFrame(this.loopId)
    this.engine.stop()
    this.menu.destroy()

    // Scale out nicely
    this.container.style.transform = 'scale(0)'
    this.container.style.transition = 'transform 0.3s ease-out'
    setTimeout(() => {
      if (this.container.parentNode) this.container.parentNode.removeChild(this.container)
      if (this.landingStyle.parentNode) this.landingStyle.parentNode.removeChild(this.landingStyle)
    }, 300)
  }
}

// Bootstrap
function init() {
  window.petManager = new PetManager()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
