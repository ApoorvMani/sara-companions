const { ipcRenderer } = window.require('electron')

export async function checkAndRunBirthdaySurprise(pets) {
  const message = await ipcRenderer.invoke('get-store-value', 'birthdayMessage')

  return new Promise((resolve) => runSequence(pets, message, resolve))
}

function runSequence(pets, message, onComplete) {
  // 1. Hide all characters initially
  pets.forEach((pet) => {
    pet.container.style.opacity = '0'
    pet.container.style.transform = `translateY(-${window.innerHeight}px)`
  })

  // 2. Create Overlay
  const overlay = document.createElement('div')
  overlay.style.position = 'fixed'
  overlay.style.top = '0'
  overlay.style.left = '0'
  overlay.style.width = '100vw'
  overlay.style.height = '100vh'
  overlay.style.backgroundColor = 'rgba(0,0,0,0)'
  overlay.style.transition = 'background-color 0.5s ease'
  overlay.style.zIndex = '9998'
  overlay.style.pointerEvents = 'auto' // block interactions behind

  document.body.appendChild(overlay)

  // 3. Create Card
  const card = document.createElement('div')
  card.style.position = 'absolute'
  card.style.top = '50%'
  card.style.left = '50%'
  card.style.transform = 'translate(-50%, -50%) scale(0.9)'
  card.style.backgroundColor = 'var(--card-bg, #fff)' // fallback if darkmode css not set
  card.style.borderRadius = '20px'
  card.style.padding = '40px'
  card.style.width = '400px'
  card.style.textAlign = 'center'
  card.style.boxShadow = '0 10px 40px rgba(0,0,0,0.3)'
  card.style.opacity = '0'
  card.style.transition = 'opacity 0.5s ease, transform 0.5s ease'
  card.style.zIndex = '9999'
  card.style.cursor = 'pointer'

  // Shimmer border animation
  const style = document.createElement('style')
  style.textContent = `
    @keyframes shimmer-border {
      0% { box-shadow: 0 0 10px rgba(255, 107, 157, 0.4); }
      50% { box-shadow: 0 0 25px rgba(255, 107, 157, 0.8); }
      100% { box-shadow: 0 0 10px rgba(255, 107, 157, 0.4); }
    }
    .birthday-card {
      animation: shimmer-border 2s infinite ease-in-out;
    }
  `
  document.head.appendChild(style)
  card.classList.add('birthday-card')

  card.innerHTML = `
    <div style="font-size: 64px; margin-bottom: 20px;">🎂</div>
    <h1 style="font-size: 28px; color: #ff6b9d; margin: 0 0 10px 0; font-family: system-ui, sans-serif;">Happy Birthday, Ann! 🌟</h1>
    <p style="font-size: 16px; color: #555; margin: 0 0 20px 0; font-family: system-ui, sans-serif;">${message}</p>
    <p style="font-size: 14px; color: #888; font-style: italic; margin: 0; font-family: system-ui, sans-serif;">Click to meet your new companions!</p>
  `
  document.body.appendChild(card)

  // Fade in overlay and card
  requestAnimationFrame(() => {
    overlay.style.backgroundColor = 'rgba(0,0,0,0.6)'
    card.style.opacity = '1'
    card.style.transform = 'translate(-50%, -50%) scale(1)'
  })

  // 4. Click Handler
  const closeBirthdayEvent = () => {
    // Fade out
    overlay.style.backgroundColor = 'rgba(0,0,0,0)'
    card.style.opacity = '0'
    card.style.transform = 'translate(-50%, -50%) scale(0.9)'

    setTimeout(() => {
      overlay.remove()
      card.remove()
      triggerDropAndConfetti(pets, onComplete)
    }, 500)
  }

  card.style.pointerEvents = 'auto'
  card.addEventListener('click', closeBirthdayEvent)
  overlay.addEventListener('click', closeBirthdayEvent)
}

function triggerDropAndConfetti(pets, onComplete) {
  emitConfetti()

  const bounceStyle = document.createElement('style')
  bounceStyle.textContent = `
    @keyframes drop-bounce {
      0% { transform: translateY(-800px); }
      60% { transform: translateY(20px); }
      80% { transform: translateY(-10px); }
      100% { transform: translateY(0); }
    }
    .pet-drop {
      animation: drop-bounce 0.8s cubic-bezier(0.28, 0.84, 0.42, 1) forwards;
    }
  `
  document.head.appendChild(bounceStyle)

  pets.forEach((pet, index) => {
    setTimeout(() => {
      pet.container.style.opacity = '1'
      pet.container.style.transform = '' // FIX: Reset the initialization hide transform!
      
      // Use CSS animation for drop
      pet.sprite.classList.add('pet-drop')

      // Keep behavior engine idle during drop
      pet.engine.forceState('IDLE')

      setTimeout(() => {
        pet.sprite.classList.remove('pet-drop')
        pet.sprite.style.transform = '' // reset

        // After drop, start dance for 5s
        pet.engine.forceState('DANCE', 5000)

        // After dance finishes, we resolve to start normal
        if (index === pets.length - 1) {
          setTimeout(() => {
            onComplete()
          }, 5000)
        }
      }, 800) // length of drop animation
    }, index * 200) // staggered by 200ms
  })
}

function emitConfetti() {
  const colors = ['#ff6b9d', '#ffd166', '#06d6a0', '#118ab2', '#ef476f']
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div')
    p.style.position = 'fixed'
    p.style.top = '-20px'
    p.style.left = Math.random() * window.innerWidth + 'px'
    p.style.width = '10px'
    p.style.height = '10px'
    p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
    p.style.borderRadius = Math.random() > 0.5 ? '50%' : '0'
    p.style.zIndex = '9997'
    p.style.pointerEvents = 'none'

    // fall animation
    const duration = 2 + Math.random() * 2
    const delay = Math.random() * 0.5

    p.style.transition = `transform ${duration}s linear, opacity ${duration}s ease-in`
    document.body.appendChild(p)

    requestAnimationFrame(() => {
      setTimeout(() => {
        p.style.transform = `translateY(${window.innerHeight + 20}px) rotate(${Math.random() * 720}deg)`
        p.style.opacity = '0'
      }, delay * 1000)
    })

    setTimeout(() => p.remove(), (duration + delay) * 1000)
  }
}
