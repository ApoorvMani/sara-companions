export default class Animator {
  constructor(canvas, fps = 10) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.fps = fps
    this.animations = {}

    this.currentAnimation = null
    this.currentFrameIndex = 0
    this.isPlaying = false
    this.isLooping = true
    this.onCompleteCallback = null

    this.lastTime = 0
    this.animationFrameId = null
    
    this.spritesheetImage = null
    this.frameData = []

    this.loop = this.loop.bind(this)
  }

  async load(spritePath, jsonPath) {
    const fs = window.require('fs')
    
    // Read JSON frame map
    if (fs.existsSync(jsonPath)) {
        const jsonStr = fs.readFileSync(jsonPath, 'utf-8')
        const json = JSON.parse(jsonStr)
        this.frameData = json.frames
    }

    // Read PNG into Blob buffer Memory
    if (!fs.existsSync(spritePath)) {
        throw new Error('Spritesheet not found at ' + spritePath);
    }
    const buffer = fs.readFileSync(spritePath)
    const blob = new Blob([buffer], { type: 'image/png' })
    const url = URL.createObjectURL(blob)

    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        this.spritesheetImage = img
        resolve(img)
      }
      img.onerror = () => reject(new Error(`Failed to load image: ${spritePath}`))
      img.src = url
    })
  }

  registerAnimation(name, framesIndices, fps = this.fps) {
    this.animations[name] = {
      frames: framesIndices,
      fps: fps,
      frameDuration: 1000 / fps
    }
  }

  play(animationName, loop = true) {
    if (!this.animations[animationName]) {
      console.warn(`Animation ${animationName} not found`)
      return
    }

    this.currentAnimation = this.animations[animationName]
    this.currentFrameIndex = 0
    this.isPlaying = true
    this.isLooping = loop
    this.onCompleteCallback = null
    this.lastTime = performance.now()

    if (!this.animationFrameId) {
      this.animationFrameId = requestAnimationFrame(this.loop)
    }
  }

  playOnce(animationName, callback = null) {
    this.onCompleteCallback = callback
    this.play(animationName, false)
  }

  stop() {
    this.isPlaying = false
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    this.renderFrame()
  }

  loop(timestamp) {
    if (!this.isPlaying) return

    if (!this.lastTime) this.lastTime = timestamp

    const deltaTime = timestamp - this.lastTime
    const { frameDuration, frames } = this.currentAnimation

    if (deltaTime >= frameDuration) {
      this.currentFrameIndex++
      this.lastTime = timestamp - (deltaTime % frameDuration)

      if (this.currentFrameIndex >= frames.length) {
        if (this.isLooping) {
          this.currentFrameIndex = 0
        } else {
          this.currentFrameIndex = frames.length - 1
          this.stop()
          if (this.onCompleteCallback) {
            this.onCompleteCallback()
          }
          return
        }
      }
    }

    this.renderFrame()

    if (this.isPlaying) {
      this.animationFrameId = requestAnimationFrame(this.loop)
    }
  }

  renderFrame() {
    if (!this.currentAnimation || !this.spritesheetImage || this.frameData.length === 0) return

    const frameIndex = this.currentAnimation.frames[this.currentFrameIndex]
    const frameRect = this.frameData[frameIndex]
    
    if (!frameRect) return

    // Calculate source rect
    const sx = frameRect.x
    const sy = frameRect.y
    const sw = frameRect.width
    const sh = frameRect.height

    // Ensure canvas element dimensions match the sprite frame EXACTLY
    if (this.canvas.width !== sw || this.canvas.height !== sh) {
      this.canvas.width = sw
      this.canvas.height = sh
    }

    if (this.onFrameRender) {
      this.onFrameRender(sw, sh)
    }

    // Clear entire canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // Destination mapping EXACTLY matches canvas and sprite frame
    const dw = this.canvas.width
    const dh = this.canvas.height

    this.ctx.drawImage(this.spritesheetImage, sx, sy, sw, sh, 0, 0, dw, dh)
  }
}
