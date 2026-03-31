export default class SpeechBubble {
  constructor(parentElement) {
    this.element = document.createElement('div')
    this.element.style.position = 'absolute'
    this.element.style.bottom = '110px'
    this.element.style.left = '50%'
    this.element.style.transform = 'translateX(-50%)'
    this.element.style.backgroundColor = 'white'
    this.element.style.padding = '8px 12px'
    this.element.style.borderRadius = '12px'
    this.element.style.border = '2px solid black'
    this.element.style.whiteSpace = 'nowrap'
    this.element.style.fontFamily = 'system-ui, sans-serif'
    this.element.style.color = 'black'
    this.element.style.pointerEvents = 'none'
    this.element.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.3)'
    this.element.style.opacity = '0'
    this.element.style.transition = 'opacity 0.2s ease-in-out'
    this.element.style.zIndex = '10'

    const pointer = document.createElement('div')
    pointer.style.position = 'absolute'
    pointer.style.bottom = '-8px'
    pointer.style.left = '50%'
    pointer.style.transform = 'translateX(-50%)'
    pointer.style.borderWidth = '8px 8px 0'
    pointer.style.borderStyle = 'solid'
    pointer.style.borderColor = 'black transparent transparent transparent'
    this.element.appendChild(pointer)

    this.textNode = document.createTextNode('')
    this.element.insertBefore(this.textNode, pointer)

    parentElement.appendChild(this.element)
    this.timeout = null
  }

  show(text, duration = 3000) {
    this.textNode.textContent = text
    this.element.style.opacity = '1'

    if (this.timeout) {
      clearTimeout(this.timeout)
    }

    if (duration > 0) {
      this.timeout = setTimeout(() => {
        this.hide()
      }, duration)
    }
  }

  hide() {
    this.element.style.opacity = '0'
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }
  }
}
