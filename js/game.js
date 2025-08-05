// game.js - Improved algorithm with background loading
import { db } from './firebase-config.js';
import { elements } from './dom-elements.js';
import { gameState, updateGameState } from './game-state.js';
import { getUserLocation } from './utils.js';

// Timer variables
let countdownInterval;
let timeLeft = 180; // 3 minutes

// Background panorama cache
let panoramaCache = {
  easy: [],
  medium: [],
  hard: []
};

// Background loading state
let isBackgroundLoading = false;
let backgroundLoadingPromise = null;

export function setGameDifficulty(level) {
  updateGameState({ currentDifficulty: level });
  if (elements.currentDifficultyBadge) {
    elements.currentDifficultyBadge.textContent = level.toUpperCase();
    elements.currentDifficultyBadge.className = "badge";
    if (level === 'easy') elements.currentDifficultyBadge.classList.add("green");
    else if (level === 'medium') elements.currentDifficultyBadge.classList.add("yellow");
    else if (level === 'hard') elements.currentDifficultyBadge.classList.add("red");
  }
  
  const allButtons = document.querySelectorAll('[data-difficulty]');
  allButtons.forEach(btn => btn.classList.remove('glow-selected'));

  const selectedBtn = document.querySelector(`[data-difficulty="${level}"]`);
  if (selectedBtn) {
    selectedBtn.classList.add('glow-selected');
  }

  // Start background loading for selected difficulty if not already cached
  if (panoramaCache[level].length < 3) {
    startBackgroundLoading(level);
  }
}

export function startGame() {
  if (!gameState.playerName) {
    alert("Vui lòng đăng nhập trước.");
    return;
  }
  
  elements.difficultyContainer.classList.add("hidden");
  elements.gameContainer.classList.remove("hidden");
  
  // Reset game state
  updateGameState({ 
    gameEnded: false,
    guessLocation: null 
  });
  
  generateNewLocation(gameState.currentDifficulty);
}

// Helper function to ensure Google Maps is loaded
function waitForGoogleMaps() {
  return new Promise((resolve) => {
    if (typeof google !== 'undefined' && google.maps && google.maps.StreetViewService) {
      resolve();
    } else {
      const checkGoogle = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps && google.maps.StreetViewService) {
          clearInterval(checkGoogle);
          resolve();
        }
      }, 100);
    }
  });
}

// Background panorama loading
async function startBackgroundLoading(difficulty) {
  if (isBackgroundLoading) return backgroundLoadingPromise;
  
  isBackgroundLoading = true;
  console.log(`🔄 Starting background loading for ${difficulty} difficulty...`);
  
  backgroundLoadingPromise = loadPanoramasInBackground(difficulty);
  
  try {
    await backgroundLoadingPromise;
    console.log(`✅ Background loading completed for ${difficulty}`);
  } catch (error) {
    console.error(`❌ Background loading failed for ${difficulty}:`, error);
  } finally {
    isBackgroundLoading = false;
    backgroundLoadingPromise = null;
  }
  
  return backgroundLoadingPromise;
}

async function loadPanoramasInBackground(difficulty) {
  await waitForGoogleMaps();
  
  if (!gameState.streetViewService) {
    updateGameState({ 
      streetViewService: new google.maps.StreetViewService() 
    });
  }

  const userLocation = await getUserLocation();
  const targetCount = 5; // Cache 5 panoramas per difficulty
  const maxAttemptsPerPanorama = 10;
  
  while (panoramaCache[difficulty].length < targetCount) {
    console.log(`🔍 Finding panorama ${panoramaCache[difficulty].length + 1}/${targetCount} for ${difficulty}...`);
    
    const panorama = await findSinglePanorama(difficulty, userLocation, maxAttemptsPerPanorama);
    
    if (panorama) {
      panoramaCache[difficulty].push(panorama);
      console.log(`✅ Cached panorama ${panoramaCache[difficulty].length}/${targetCount} for ${difficulty}`);
    } else {
      console.warn(`⚠️ Failed to find panorama for ${difficulty}, trying again...`);
      // Continue trying, but prevent infinite loop
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

function findSinglePanorama(difficulty, userLocation, maxAttempts) {
  return new Promise((resolve) => {
    let attempts = 0;
    
    function tryFindPanorama() {
      attempts++;
      
      if (attempts > maxAttempts) {
        console.warn(`❌ Max attempts reached for ${difficulty} panorama`);
        resolve(null);
        return;
      }
      
      const coord = generateCoordinateForDifficulty(difficulty, userLocation, attempts);
      const searchRadius = getSearchRadiusForDifficulty(difficulty, attempts);
      
      gameState.streetViewService.getPanorama({ 
        location: coord, 
        radius: searchRadius,
        source: google.maps.StreetViewSource.OUTDOOR
      }, (data, status) => {
        
        if (status === google.maps.StreetViewStatus.OK && isValidPanoramaForLevel(data, difficulty)) {
          console.log(`✅ Found valid panorama for ${difficulty} (attempt ${attempts})`);
          resolve({
            location: data.location.latLng,
            pano: data.location.pano,
            links: data.links,
            difficulty: difficulty
          });
        } else {
          // Try again with a small delay to avoid overwhelming the API
          setTimeout(tryFindPanorama, 100);
        }
      });
    }
    
    tryFindPanorama();
  });
}

function generateCoordinateForDifficulty(difficulty, userLocation, attempt) {
  switch(difficulty) {
    case 'easy':
      // Start with closer locations, expand if many attempts
      const radiusKm = attempt > 5 ? 15 : 10;
      return getRandomNearbyCoords(userLocation, radiusKm);
      
    case 'medium':
      // Asia-Pacific region
      return {
        lat: 10 + Math.random() * 50,  // 10°N to 60°N
        lng: 60 + Math.random() * 90   // 60°E to 150°E
      };
      
    case 'hard':
      // Global
      return {
        lat: -85 + Math.random() * 170,  // -85° to 85°
        lng: -180 + Math.random() * 360  // -180° to 180°
      };
      
    default:
      return userLocation;
  }
}

function getSearchRadiusForDifficulty(difficulty, attempt) {
  switch(difficulty) {
    case 'easy':
      return attempt > 5 ? 15000 : 10000; // 10-15km
    case 'medium':
      return 50000; // 50km
    case 'hard':
      return 100000; // 100km
    default:
      return 10000;
  }
}

function getRandomNearbyCoords(center, radiusKm) {
  const r = radiusKm / 111.32;
  const u = Math.random(), v = Math.random();
  const w = r * Math.sqrt(u), t = 2 * Math.PI * v;
  const lat = w * Math.cos(t), lng = w * Math.sin(t) / Math.cos(center.lat * Math.PI / 180);
  return { lat: center.lat + lat, lng: center.lng + lng };
}

function isValidPanoramaForLevel(data, level) {
  if (!data || !data.location) return false;
  
  const links = data.links || [];
  const hasLinks = links.length > 0;
  const isStreetLevel = data.location.pano && data.location.pano.length > 0;
  
  switch(level) {
    case 'easy':
      return hasLinks && links.length >= 2 && isStreetLevel;
    case 'medium':
      return hasLinks && links.length >= 1 && isStreetLevel;
    case 'hard':
      return isStreetLevel;
    default:
      return isStreetLevel;
  }
}

export async function generateNewLocation(level) {
  console.log(`🎯 Generating new location for ${level} difficulty...`);
  
  // Check if we have cached panoramas
  if (panoramaCache[level].length > 0) {
    console.log(`✅ Using cached panorama for ${level}`);
    const panorama = panoramaCache[level].shift(); // Remove from cache
    
    // Start background loading to refill cache
    if (panoramaCache[level].length < 2) {
      startBackgroundLoading(level);
    }
    
    displayPanorama(panorama);
    return;
  }
  
  // If no cached panoramas, show loading and find one immediately
  showLoadingMessage();
  
  try {
    await waitForGoogleMaps();
    
    if (!gameState.streetViewService) {
      updateGameState({ 
        streetViewService: new google.maps.StreetViewService() 
      });
    }

    const userLocation = await getUserLocation();
    const panorama = await findSinglePanorama(level, userLocation, 15);
    
    if (panorama) {
      displayPanorama(panorama);
      // Start background loading for future rounds
      startBackgroundLoading(level);
    } else {
      throw new Error('Could not find suitable panorama');
    }
  } catch (error) {
    console.error('❌ Error generating location:', error);
    alert(`⚠️ Không thể tìm thấy vị trí phù hợp. Vui lòng thử lại.`);
    resetToSelectDifficulty();
  }
}

function showLoadingMessage() {
  if (elements.mapPreview) {
    elements.mapPreview.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: rgba(0,0,0,0.8); color: white;">
        <div style="font-size: 3rem; margin-bottom: 20px;">🔍</div>
        <div style="font-size: 1.5rem; margin-bottom: 10px;">Đang tìm vị trí...</div>
        <div style="font-size: 1rem; opacity: 0.8;">Vui lòng đợi trong giây lát</div>
      </div>
    `;
  }
}

function displayPanorama(panorama) {
  updateGameState({ actualLocation: panorama.location });
  
  const panoramaOptions = {
    position: panorama.location,
    pov: { 
      heading: Math.random() * 360,
      pitch: -5 + Math.random() * 10
    },
    zoom: 1,
    addressControl: false,
    linksControl: true,
    panControl: true,
    zoomControl: true,
    fullscreenControl: false,
    motionTracking: false,
    motionTrackingControl: false
  };

  new google.maps.StreetViewPanorama(
    elements.mapPreview, 
    panoramaOptions
  );
  
  startTimer();
  elements.showGuessMapBtn.classList.remove('hidden');
  elements.submitGuessBtn.classList.add('hidden');
  elements.guessMapContainer.style.display = 'none';

  // Clean up previous markers and polyline
  if (gameState.guessMarker) gameState.guessMarker.setMap(null);
  if (gameState.actualMarker) gameState.actualMarker.setMap(null);
  if (gameState.distanceLine) gameState.distanceLine.setMap(null);
  
  console.log('✅ Panorama displayed successfully');
}

function resetToSelectDifficulty() {
  elements.gameContainer.classList.add("hidden");
  elements.difficultyContainer.classList.remove("hidden");
}

export async function showGuessMap() {
  // Check if game has ended
  if (gameState.gameEnded) {
    alert("⏰ Đã hết thời gian! Không thể thay đổi vị trí.");
    return;
  }

  await waitForGoogleMaps();
  
  elements.guessMapContainer.style.display = 'block';
  elements.showGuessMapBtn.classList.add('hidden');
  elements.submitGuessBtn.classList.remove('hidden');

  const guessMap = new google.maps.Map(elements.guessMap, {
    center: { lat: 20, lng: 0 },
    zoom: 2,
  });

  updateGameState({ guessMap });

  guessMap.addListener("click", (e) => {
    // Check if game has ended
    if (gameState.gameEnded) {
      alert("⏰ Đã hết thời gian! Không thể thay đổi vị trí.");
      return;
    }

    const guessLocation = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    updateGameState({ guessLocation });
    
    if (gameState.guessMarker) gameState.guessMarker.setMap(null);
    
    const guessMarker = new google.maps.Marker({
      position: guessLocation,
      map: guessMap,
      icon: { url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png" },
      title: "Vị trí bạn chọn"
    });
    
    updateGameState({ guessMarker });
  });
}

export function submitGuess() {
  const btn = elements.submitGuessBtn;
  if (!btn || btn.disabled) return;
  
  // Check if game has ended
  if (gameState.gameEnded) {
    alert("⏰ Đã hết thời gian! Không thể submit.");
    return;
  }

  if (!gameState.guessLocation || !gameState.actualLocation) {
    alert("Vui lòng chọn vị trí!");
    return;
  }

  // Stop timer and end game
  stopTimer();
  updateGameState({ gameEnded: true });
  btn.disabled = true;

  const distance = haversineDistance(
    { lat: gameState.actualLocation.lat(), lng: gameState.actualLocation.lng() },
    gameState.guessLocation
  );

  let points = 0;
  if (distance < 1) points = 100;
  else if (distance < 5) points = 50;
  else if (distance < 25) points = 25;
  else if (distance < 100) points = 10;

  const difficultyMultiplier = gameState.currentDifficulty === 'hard' ? 1.5 : gameState.currentDifficulty === 'medium' ? 1.2 : 1;
  points = Math.round(points * difficultyMultiplier);

  updateGameState({ score: gameState.score + points });

  if (elements.result) {
    elements.result.textContent = `🎯 Khoảng cách: ${distance.toFixed(2)} km | 🎊 Điểm nhận: ${points}`;
    elements.result.classList.remove('hidden');
  }

  if (elements.score) elements.score.textContent = gameState.score;

  // Remove previous markers and line
  if (gameState.actualMarker) gameState.actualMarker.setMap(null);
  if (gameState.distanceLine) gameState.distanceLine.setMap(null);
  
  // Add actual location marker (green)
  const actualMarker = new google.maps.Marker({
    position: gameState.actualLocation,
    map: gameState.guessMap,
    icon: { url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png" },
    title: "Vị trí thật"
  });
  
  // Create dotted line between guess and actual location
  const distanceLine = new google.maps.Polyline({
    path: [
      gameState.guessLocation,
      { lat: gameState.actualLocation.lat(), lng: gameState.actualLocation.lng() }
    ],
    geodesic: true,
    strokeColor: '#FF6B6B',
    strokeOpacity: 0.8,
    strokeWeight: 3,
    icons: [{
      icon: {
        path: 'M 0,-1 0,1',
        strokeOpacity: 1,
        scale: 4
      },
      offset: '0',
      repeat: '20px'
    }]
  });
  
  distanceLine.setMap(gameState.guessMap);
  
  updateGameState({ actualMarker, distanceLine });

  // Disable map clicking after submit
  google.maps.event.clearListeners(gameState.guessMap, 'click');

  // Adjust map view to show both markers
  const bounds = new google.maps.LatLngBounds();
  bounds.extend(gameState.guessLocation);
  bounds.extend(gameState.actualLocation);
  gameState.guessMap.fitBounds(bounds);

  gameState.guessMap.panToBounds(bounds);
  
  google.maps.event.addListenerOnce(gameState.guessMap, 'bounds_changed', () => {
    if (gameState.guessMap.getZoom() > 15) {
      gameState.guessMap.setZoom(15);
    }
  });

  elements.viewOnGoogleMapBtn?.classList.remove('hidden');
  elements.replayBtn?.classList.remove('hidden');

  saveScore();
  saveGuessData(distance, points);
}

function saveScore() {
  db.ref("scores").push({
    name: gameState.playerName,
    score: gameState.score,
    difficulty: gameState.currentDifficulty,
    time: Date.now()
  });
}

function saveGuessData(distance, points) {
  const guessData = {
    actualLat: gameState.actualLocation.lat(),
    actualLng: gameState.actualLocation.lng(),
    guessLat: gameState.guessLocation.lat,
    guessLng: gameState.guessLocation.lng,
    distance,
    score: points,
    difficulty: gameState.currentDifficulty,
    name: gameState.playerName,
    timestamp: Date.now()
  };

  db.ref("guesses").push(guessData);
}

export function resetGame() {
  // Stop timer
  stopTimer();
  
  updateGameState({ 
    score: 0,
    guessLocation: null,
    actualLocation: null,
    gameEnded: false
  });

  // Clean up all markers and polyline
  if (gameState.guessMarker) {
    gameState.guessMarker.setMap(null);
    updateGameState({ guessMarker: null });
  }
  if (gameState.actualMarker) {
    gameState.actualMarker.setMap(null);
    updateGameState({ actualMarker: null });
  }
  if (gameState.distanceLine) {
    gameState.distanceLine.setMap(null);
    updateGameState({ distanceLine: null });
  }
  
  if (elements.score) elements.score.textContent = '0';
  if (elements.result) {
    elements.result.textContent = '';
    elements.result.classList.add('hidden');
  }

  const submitBtn = elements.submitGuessBtn;
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.classList.add('hidden');
  }

  elements.showGuessMapBtn?.classList.add('hidden');
  elements.viewOnGoogleMapBtn?.classList.add('hidden');
  elements.replayBtn?.classList.add('hidden');
  if (elements.guessMapContainer) elements.guessMapContainer.style.display = 'none';

  if (elements.mapPreview) {
    elements.mapPreview.innerHTML = '';
  }

  // Reset progress bar
  resetProgressBar();

  elements.gameContainer.classList.add("hidden");
  elements.difficultyContainer.classList.remove("hidden");

  console.log('🔄 Game đã được reset, trở về chọn độ khó');
}

export function viewOnGoogleMap() {
  if (!gameState.actualLocation) {
    alert("⚠️ Không có vị trí để hiển thị!");
    return;
  }
  
  const lat = gameState.actualLocation.lat();
  const lng = gameState.actualLocation.lng();
  
  const googleMapsUrl = `https://www.google.com/maps/@${lat},${lng},15z`;
  window.open(googleMapsUrl, '_blank');
  
  console.log(`🌍 Mở Google Maps: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
}

// Timer functions
function startTimer() {
  console.log('⏰ Starting 3-minute timer...');
  timeLeft = 180; // Reset to 3 minutes
  updateProgressBar();

  // Clear any existing timer
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  countdownInterval = setInterval(() => {
    timeLeft--;
    updateProgressBar();

    // Change color when time is running low
    if (timeLeft <= 30 && elements.progressBar) {
      elements.progressBar.style.backgroundColor = '#e74c3c'; // Red
    } else if (timeLeft <= 60 && elements.progressBar) {
      elements.progressBar.style.backgroundColor = '#f39c12'; // Orange
    }

    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      handleTimeOut();
    }
  }, 1000);
}

function stopTimer() {
  console.log('⏹️ Timer stopped');
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function updateProgressBar() {
  const percentage = (timeLeft / 180) * 100;
  if (elements.progressBar) {
    elements.progressBar.style.width = `${percentage}%`;
  }

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');
  if (elements.progressTime) {
    elements.progressTime.textContent = `${minutes}:${seconds}`;
  }
}

function resetProgressBar() {
  if (elements.progressBar) {
    elements.progressBar.style.width = '100%';
    elements.progressBar.style.backgroundColor = '#2ecc71'; // Reset to green
  }
  if (elements.progressTime) {
    elements.progressTime.textContent = '03:00';
  }
}

function handleTimeOut() {
  console.log('⏰ Time out!');
  updateGameState({ gameEnded: true });

  if (elements.result) {
    elements.result.textContent = `⏰ Hết giờ! ${gameState.guessLocation ? 'Điểm: 0' : 'Bạn chưa chọn vị trí nào.'}`;
    elements.result.classList.remove('hidden');
  }

  // Show actual location
  if (gameState.actualLocation && gameState.guessMap) {
    const actualMarker = new google.maps.Marker({
      position: gameState.actualLocation,
      map: gameState.guessMap,
      icon: { url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png" },
      title: "Vị trí thật"
    });
    updateGameState({ actualMarker });
  }

  // Disable submit button
  if (elements.submitGuessBtn) {
    elements.submitGuessBtn.disabled = true;
    elements.submitGuessBtn.classList.add('hidden');
  }

  // Show control buttons
  elements.viewOnGoogleMapBtn?.classList.remove('hidden');
  elements.replayBtn?.classList.remove('hidden');

  // Save score (0 points for timeout)
  saveScore();
  
  // Save guess data for timeout
  const guessData = {
    actualLat: gameState.actualLocation ? gameState.actualLocation.lat() : null,
    actualLng: gameState.actualLocation ? gameState.actualLocation.lng() : null,
    guessLat: gameState.guessLocation ? gameState.guessLocation.lat : null,
    guessLng: gameState.guessLocation ? gameState.guessLocation.lng : null,
    distance: null,
    score: 0,
    difficulty: gameState.currentDifficulty,
    name: gameState.playerName,
    timestamp: Date.now(),
    timeout: true
  };

  db.ref("guesses").push(guessData);
}

function haversineDistance(c1, c2) {
  const R = 6371;
  const dLat = toRad(c2.lat - c1.lat);
  const dLon = toRad(c2.lng - c1.lng);
  const lat1 = toRad(c1.lat);
  const lat2 = toRad(c2.lat);
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(x) { 
  return x * Math.PI / 180; 
}

// Initialize background loading when maps is ready
window.addEventListener('load', () => {
  waitForGoogleMaps().then(() => {
    console.log('🗺️ Google Maps ready, starting background cache initialization...');
    // Pre-load some panoramas for all difficulties
    ['easy', 'medium', 'hard'].forEach(difficulty => {
      setTimeout(() => startBackgroundLoading(difficulty), 1000 * ['easy', 'medium', 'hard'].indexOf(difficulty));
    });
  });
});

console.log('🎮 Improved game module loaded with background panorama caching');