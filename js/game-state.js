export let gameState = {
  playerName: '',
  score: 0,
  currentDifficulty: 'easy',
  guessMarker: null,
  actualMarker: null,
  distanceLine: null, 
  actualLocation: null,
  guessLocation: null,
  guessMap: null,
  streetViewService: null,
  isAdminLoggedIn: false,
   gameEnded: false
};

export function updateGameState(updates) {
  Object.assign(gameState, updates);
}

export function resetGameState() {
  gameState.playerName = '';
  gameState.score = 0;
  gameState.currentDifficulty = 'easy';
  gameState.guessMarker = null;
  gameState.actualMarker = null;
  gameState.distanceLine = null; 
  gameState.actualLocation = null;
  gameState.guessLocation = null;
  gameState.guessMap = null;
  gameState.isAdminLoggedIn = false;
  gameState.gameEnded = false;
}