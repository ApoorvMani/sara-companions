export default class BehaviorEngine {
  constructor(characterConfig = {}) {
    this.config = characterConfig
    this.currentState = 'IDLE' // States: IDLE, WALK_LEFT, WALK_RIGHT, SIT, SLEEP, DANCE, REACT_CLICK, DRAG
    this.subscribers = []
    this.lastInteractionTime = Date.now()
    this.timer = null

    // Define core states
    this.states = {
      IDLE: 'IDLE',
      WALK_LEFT: 'WALK_LEFT',
      WALK_RIGHT: 'WALK_RIGHT',
      SIT: 'SIT',
      SLEEP: 'SLEEP',
      DANCE: 'DANCE',
      REACT_CLICK: 'REACT_CLICK',
      DRAG: 'DRAG',
      CLIMB: 'CLIMB',
      STAY: 'STAY'
    }
  }

  // Subscribe to state change events
  onStateChange(callback) {
    this.subscribers.push(callback)
  }

  emitState(state) {
    if (this.currentState !== state) {
      this.currentState = state
      this.subscribers.forEach((cb) => cb(state))
    }
  }

  start() {
    this.lastInteractionTime = Date.now()
    this.emitState(this.states.IDLE)
    this.scheduleNextTick()
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  scheduleNextTick(customDelay = null) {
    this.stop()
    // Engine ticks every 8-15 seconds (random interval)
    const delay = customDelay !== null ? customDelay : 8000 + Math.random() * 7000
    this.timer = setTimeout(() => this.tick(), delay)
  }

  // Called when user clicks or interacts
  recordInteraction() {
    this.lastInteractionTime = Date.now()
    // Wake up if sleeping
    if (this.currentState === this.states.SLEEP) {
      this.forceState(this.states.IDLE)
    }
  }

  // Immediately forces a state (e.g. REACT_CLICK) overriding the current one
  forceState(state, keepDuration = null) {
    this.stop()
    this.emitState(state)
    if (keepDuration) {
      this.scheduleNextTick(keepDuration)
    } else {
      this.scheduleNextTick()
    }
  }

  tick() {
    let nextState = this.currentState

    if (this.currentState === this.states.SLEEP) {
      // From SLEEP: only wakes on click, or after 60 seconds (one 60s tick)
      nextState = this.states.IDLE
    } else if (this.currentState === this.states.STAY) {
      // From STAY: doesn't change until explicitly commanded
      nextState = this.states.STAY
    } else {
      nextState = this.determineNextState()
    }

    this.emitState(nextState)

    // SLEEP lasts exactly 60s per tick
    if (nextState === this.states.SLEEP) {
      this.scheduleNextTick(60000)
    } else if (nextState === this.states.STAY) {
      this.scheduleNextTick(60000) // Poll infrequently while staying
    } else if (nextState === this.states.CLIMB) {
      this.scheduleNextTick(3000 + Math.random() * 2000) // Climb for 3-5 seconds
    } else {
      this.scheduleNextTick()
    }
  }

  determineNextState() {
    const weights = this.config.behaviorWeights || {}

    // Rule: SLEEP only triggers between 11pm-6am OR after 20 minutes of no user interaction
    const now = new Date()
    const hour = now.getHours()
    const isNight = hour >= 23 || hour < 6
    const isNeglected = Date.now() - this.lastInteractionTime > 20 * 60 * 1000
    const canSleep = isNight || isNeglected

    // Rule: DANCE triggers more frequently if it's a BTS character
    let danceBoost = 1
    if (this.config.universe === 'bts' || this.config.universe === 'BTS') {
      danceBoost = 3
    }

    let choices = []

    if (
      this.currentState === this.states.IDLE ||
      this.currentState === this.states.REACT_CLICK ||
      this.currentState === this.states.DANCE
    ) {
      // Default weights From IDLE
      choices = [
        { state: this.states.WALK_LEFT, weight: weights.walk ? weights.walk / 2 : 30 },
        { state: this.states.WALK_RIGHT, weight: weights.walk ? weights.walk / 2 : 30 },
        { state: this.states.SIT, weight: weights.sit !== undefined ? weights.sit : 20 },
        {
          state: this.states.DANCE,
          weight: (weights.dance !== undefined ? weights.dance : 10) * danceBoost
        },
        { state: this.states.IDLE, weight: weights.idle !== undefined ? weights.idle : 10 }
      ]
    } else if (
      this.currentState === this.states.WALK_LEFT ||
      this.currentState === this.states.WALK_RIGHT
    ) {
      // Default weights From WALK
      choices = [
        { state: this.states.IDLE, weight: 40 },
        { state: this.states.SIT, weight: 20 },
        { state: this.currentState, weight: 40 } // continue walking
      ]
    } else if (this.currentState === this.states.SIT || this.currentState === this.states.DRAG) {
      // Default weights From SIT
      choices = [
        { state: this.states.IDLE, weight: 60 },
        {
          state: this.states.SLEEP,
          weight: canSleep ? (weights.sleep !== undefined ? weights.sleep : 20) : 0
        },
        { state: this.states.SIT, weight: 20 }
      ]
    } else if (this.currentState === this.states.CLIMB) {
      // From CLIMB
      choices = [{ state: this.states.IDLE, weight: 100 }]
    } else {
      // Failsafe
      choices = [{ state: this.states.IDLE, weight: 100 }]
    }

    return this.pickRandom(choices)
  }

  pickRandom(choices) {
    const totalWeight = choices.reduce((sum, item) => sum + item.weight, 0)
    if (totalWeight <= 0) return this.states.IDLE

    let randomValue = Math.random() * totalWeight
    for (const choice of choices) {
      randomValue -= choice.weight
      if (randomValue <= 0) {
        return choice.state
      }
    }
    return choices[choices.length - 1].state
  }
}
