# 🌸 Sara's Companions

A delightful desktop pet application featuring animated characters from various universes (BTS, Harry Potter, Supernatural) that roam around your screen, interact with your cursor, and keep you company while you work!

![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg)

## ✨ Features

- **🎭 Multiple Characters**: Choose from Jimin, Jungkook, Harry Potter, Severus Snape, Dean, Sam, Castiel, and Gabriel
- **🚶 Natural Movement**: Characters walk around, sit, sleep, dance, and climb window edges
- **🎯 Interactive**: Characters react to clicks, can be dragged around, and follow your cursor
- **💬 Speech Bubbles**: Characters say quotes from their respective universes
- **🎮 Context Menu**: Right-click characters to make them dance, sleep, or send them away
- **🎊 Birthday Surprise**: Special celebration on first launch
- **⏸️ Pause/Resume**: System tray controls to pause or resume all characters
- **🪟 Cross-Character Interactions**: Watch characters interact when they meet (e.g., Harry/Dean confusion, BTS members dancing together)
- **🌙 Smart Sleep**: Characters automatically sleep at night (11PM-6AM) or after 20 minutes of inactivity

## 🏗️ Architecture

```
sara-companions/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.js       # App entry point
│   │   ├── windowManager.js   # Transparent overlay window
│   │   ├── ipcHandlers.js     # IPC communication
│   │   ├── trayManager.js     # System tray menu
│   │   └── store.js           # Persistent settings
│   ├── renderer/          # Renderer process (UI)
│   │   ├── pet.js         # Pet manager & controller
│   │   ├── animator.js    # Sprite animation engine
│   │   ├── behaviorEngine.js  # AI state machine
│   │   ├── birthdaySurprise.js  # First launch celebration
│   │   ├── interactions.js    # Character interaction logic
│   │   ├── ui/
│   │   │   ├── speechBubble.js  # Character dialogue
│   │   │   └── contextMenu.js   # Right-click menu
│   │   └── index.html
│   └── characters/        # Character assets & configs
│       ├── jimin/
│       ├── bts_jungkook/
│       ├── harry/
│       ├── snape/
│       ├── dean/
│       ├── sam/
│       ├── castiel/
│       └── gabriel/
├── assets/                # App icons
├── setupSprites.js        # Sprite processing utility
└── electron-builder.yml   # Build configuration
```

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ 
- npm (comes with Node)

### Installation

```bash
# Clone or navigate to the project
cd sara-companions

# Install dependencies
npm install
```

### Development

```bash
# Run in development mode
npm run dev
```

### Building

```bash
# Build for current platform
npm run build

# Build Windows portable executable
npm run build:win

# Build for macOS
npm run build:mac

# Build for Linux
npm run build:linux
```

## 🎨 Character Configuration

Each character has a `character.json` file:

```json
{
  "id": "jimin",
  "name": "Jimin",
  "universe": "bts",
  "behaviorWeights": {
    "dance": 35,
    "sleep": 5,
    "sit": 15,
    "walk": 40,
    "idle": 5
  },
  "quotes": [
    "I purple you 💜",
    "ARMY, I love you!"
  ],
  "color": "#7c4dff",
  "signature": "mic_drop_dance"
}
```

### Animation States

Characters use sprite frame indices for animations:

| State | Description |
|-------|-------------|
| IDLE | Standing idle animation with blinking |
| WALK_LEFT/WALK_RIGHT | Walking animation |
| SIT | Sitting pose |
| SLEEP | Sleeping/lying down animation |
| DANCE | Dancing pose |
| CLIMB | Climbing window edge |
| DRAG | Being dragged by user |
| REACT_CLICK | Click reaction (surprise) |
| STAY | Frozen in place |

## 🔧 Settings Storage

Settings are stored in Electron Store with these defaults:

```javascript
{
  isPaused: false,            // Global pause state
  activeCharacters: ['jimin', 'bts_jungkook', 'sam'],  // Initially active
  firstLaunch: true,         // Show birthday surprise
  volume: 50,                // Audio volume (reserved for future)
  birthdayMessage: 'Someone who adores you made this just for you.',
  lastInteraction: Date.now() // For idle notifications
}
```

## 🎯 Behavior Logic

### State Machine

The `BehaviorEngine` manages character states with weighted probabilities:

- **From IDLE**: Can transition to WALK_LEFT, WALK_RIGHT, SIT, DANCE, or stay IDLE
- **From WALK**: Can transition to IDLE, SIT, or continue walking
- **From SIT**: Can transition to IDLE, SLEEP (at night), or stay sitting
- **SLEEP**: Only triggers 11PM-6AM or after 20 minutes of no interaction

### Special Interactions

- **BTS Crossover**: Two BTS characters will seek each other and dance together
- **Harry/Dean Crossover**: These characters have a special "confusion" dialogue when they meet
- **Jimin Wave**: If idle for 5 minutes, Jimin waves automatically

### Gravity & Physics

- Characters fall to the taskbar region (bottom 15% of screen) when idle
- Climbing characters ascend until hitting ceiling or completing climb distance
- Dragged characters can be placed anywhere on screen

## 🐛 Bug Fixes & Improvements

The following issues were identified and fixed during development:

1. **Duplicate `triggerAction` method** - Merged both method definitions, preserving store updates for "goodbye" action
2. **Synchronous dialog with no parent** - Moved dialog to after window creation using async API
3. **Unused exception variables** - Removed unused `e` variable bindings in catch blocks
4. **Lexical declarations in switch case** - Wrapped case bodies in braces for proper block scoping
5. **Missing firstLaunch persistence** - Added `store.set('firstLaunch', false)` before showing dialog

## 📝 Development Notes

### Mouse Event Handling

The app uses `setIgnoreMouseEvents(true, { forward: true })` to create a click-through overlay. Hit testing is done manually:

1. Main process polls cursor position every 16ms (~60fps)
2. Position sent to renderer via IPC
3. Renderer checks if cursor is over any character
4. If hit, mouse events are temporarily enabled

### Sprite Loading

Sprites are loaded using Node's `fs` module (allowed because `contextIsolation: false`):

```javascript
// Convert PNG to blob URL for Image element
const buffer = fs.readFileSync(spritePath)
const blob = new Blob([buffer], { type: 'image/png' })
const url = URL.createObjectURL(blob)
```

## 📦 Build Configuration

The app builds as a **portable executable** (no installer):

```yaml
# electron-builder.yml
win:
  target: portable
  icon: assets/icon.ico
portable:
  artifactName: SarasCompanions.exe
```

Character assets are bundled as `extraResources` to ensure they're available after packaging.

## ⚠️ Security Note

The renderer has `nodeIntegration: true` and `contextIsolation: false` for simplicity. This is acceptable for a personal desktop app but would need stricter settings for production distribution using proper Electron preload scripts.

## 🎓 Credits

- Built with [Electron](https://www.electronjs.org/) + [Vite](https://vitejs.dev/)
- Character sprites are Shimeji-style animations
- Special Easter egg birthday surprise! 🎂

## 📄 License

MIT License - Feel free to fork and create your own companion app!
