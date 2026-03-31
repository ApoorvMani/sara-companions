export default class ContextMenu {
  constructor(petController, characterName) {
    this.pet = petController
    this.characterName = characterName

    this.element = document.createElement('div')
    this.element.style.position = 'absolute'
    this.element.style.background = 'rgba(20,20,30,0.92)'
    this.element.style.borderRadius = '12px'
    this.element.style.padding = '8px'
    this.element.style.minWidth = '180px'
    this.element.style.color = 'white'
    this.element.style.fontFamily = 'system-ui, sans-serif'
    this.element.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)'
    this.element.style.zIndex = '1000'
    this.element.style.opacity = '0'
    this.element.style.transform = 'scale(0.95)'
    this.element.style.transition = 'opacity 150ms ease, transform 150ms ease'
    this.element.style.pointerEvents = 'auto' // ensure it captures clicks
    this.element.style.display = 'none'

    this.element.classList.add('context-menu') // Global hit testing flag

    this.buildMenu()

    document.body.appendChild(this.element)

    // Bind outside click and Escape handlers
    this.handleOutsideClick = this.handleOutsideClick.bind(this)
    this.handleEscape = this.handleEscape.bind(this)
  }

  buildMenu() {
    // Header
    const header = document.createElement('div')
    header.innerText = this.characterName
    header.style.fontSize = '12px'
    header.style.fontWeight = 'bold'
    header.style.color = '#aaa'
    header.style.padding = '8px 12px 4px 12px'
    header.style.textTransform = 'uppercase'
    header.style.letterSpacing = '1px'
    this.element.appendChild(header)

    // Items
    this.element.appendChild(
      this.createItem('💬 Say something', () => this.pet.triggerAction('say_something'))
    )
    this.element.appendChild(
      this.createItem('🎭 Do your thing', () => this.pet.triggerAction('signature'))
    )
    this.element.appendChild(
      this.createItem('😴 Take a break', () => this.pet.triggerAction('sleep'))
    )
    this.element.appendChild(this.createItem('📍 Stay here', () => this.pet.triggerAction('stay')))
    this.element.appendChild(
      this.createItem('🔄 Go wander', () => this.pet.triggerAction('wander'))
    )

    // Divider
    const divider = document.createElement('div')
    divider.style.height = '1px'
    divider.style.backgroundColor = 'rgba(255,255,255,0.1)'
    divider.style.margin = '4px 0'
    this.element.appendChild(divider)

    // Goodbye
    this.element.appendChild(
      this.createItem('👋 Goodbye', () => this.pet.triggerAction('goodbye'), '#ff4a4a')
    )
  }

  createItem(label, onClick, color = 'white') {
    const item = document.createElement('div')
    item.innerText = label
    item.style.padding = '8px 12px'
    item.style.fontSize = '14px'
    item.style.cursor = 'pointer'
    item.style.borderRadius = '6px'
    item.style.color = color
    item.style.transition = 'background 0.1s'

    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = 'rgba(255,255,255,0.1)'
    })
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'transparent'
    })

    item.addEventListener('click', (e) => {
      e.stopPropagation()
      onClick()
      this.hide()
    })

    return item
  }

  show(x, y) {
    this.element.style.display = 'block'

    // Position checking to keep within viewport
    let posX = x
    let posY = y

    // Ensure it's not offscreen
    if (posX + 180 > window.innerWidth) posX = window.innerWidth - 180
    if (posY + this.element.offsetHeight > window.innerHeight)
      posY = window.innerHeight - this.element.offsetHeight

    this.element.style.left = `${posX}px`
    this.element.style.top = `${posY}px`

    // Force reflow
    void this.element.offsetWidth

    this.element.style.opacity = '1'
    this.element.style.transform = 'scale(1)'

    document.addEventListener('click', this.handleOutsideClick)
    document.addEventListener('keydown', this.handleEscape)
  }

  hide() {
    this.element.style.opacity = '0'
    this.element.style.transform = 'scale(0.95)'
    setTimeout(() => {
      this.element.style.display = 'none'
      document.removeEventListener('click', this.handleOutsideClick)
      document.removeEventListener('keydown', this.handleEscape)
    }, 150)
  }

  handleOutsideClick(e) {
    if (!this.element.contains(e.target)) {
      this.hide()
    }
  }

  handleEscape(e) {
    if (e.key === 'Escape') {
      this.hide()
    }
  }

  destroy() {
    this.hide()
    if (this.element.parentNode) {
      setTimeout(() => this.element.remove(), 150)
    }
  }
}
