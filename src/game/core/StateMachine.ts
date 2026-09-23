export enum GameState {
  LOADING = "LOADING",
  MAIN_MENU = "MAIN_MENU",
  PLAYING = "PLAYING",
  WAVE_TRANSITION = "WAVE_TRANSITION",
  PAUSED = "PAUSED",
  PLAYER_DEATH = "PLAYER_DEATH",
  RESPAWNING = "RESPAWNING",
  GAME_OVER = "GAME_OVER",
  HIGH_SCORE = "HIGH_SCORE",
}

/** States in which the simulation advances. */
export const SIMULATED_STATES: ReadonlySet<GameState> = new Set([
  GameState.PLAYING,
  GameState.WAVE_TRANSITION,
  GameState.PLAYER_DEATH,
  GameState.RESPAWNING,
]);

const TRANSITIONS: Record<GameState, readonly GameState[]> = {
  [GameState.LOADING]: [GameState.MAIN_MENU],
  [GameState.MAIN_MENU]: [GameState.WAVE_TRANSITION],
  [GameState.WAVE_TRANSITION]: [GameState.PLAYING, GameState.PAUSED, GameState.MAIN_MENU],
  [GameState.PLAYING]: [
    GameState.WAVE_TRANSITION, GameState.PAUSED, GameState.PLAYER_DEATH, GameState.MAIN_MENU,
  ],
  [GameState.PAUSED]: [
    GameState.PLAYING, GameState.WAVE_TRANSITION, GameState.RESPAWNING,
    GameState.PLAYER_DEATH, GameState.MAIN_MENU,
  ],
  [GameState.PLAYER_DEATH]: [
    GameState.RESPAWNING, GameState.GAME_OVER, GameState.PAUSED, GameState.MAIN_MENU,
  ],
  [GameState.RESPAWNING]: [GameState.PLAYING, GameState.WAVE_TRANSITION, GameState.PAUSED, GameState.MAIN_MENU],
  [GameState.GAME_OVER]: [GameState.HIGH_SCORE, GameState.MAIN_MENU, GameState.WAVE_TRANSITION],
  [GameState.HIGH_SCORE]: [GameState.MAIN_MENU, GameState.WAVE_TRANSITION],
};

export type StateListener = (next: GameState, prev: GameState) => void;

export class StateMachine {
  private _state = GameState.LOADING;
  private _resumeTo: GameState | null = null;
  private listeners = new Set<StateListener>();

  get state(): GameState {
    return this._state;
  }

  /** State to return to when leaving PAUSED. */
  get resumeTo(): GameState | null {
    return this._resumeTo;
  }

  get simulating(): boolean {
    return SIMULATED_STATES.has(this._state);
  }

  is(...states: GameState[]): boolean {
    return states.includes(this._state);
  }

  canTransition(to: GameState): boolean {
    return TRANSITIONS[this._state].includes(to);
  }

  transition(to: GameState): boolean {
    if (to === this._state || !this.canTransition(to)) return false;
    const prev = this._state;
    if (to === GameState.PAUSED) this._resumeTo = prev;
    else if (prev === GameState.PAUSED && to !== GameState.MAIN_MENU) this._resumeTo = null;
    this._state = to;
    this.listeners.forEach((fn) => fn(to, prev));
    return true;
  }

  onChange(fn: StateListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
