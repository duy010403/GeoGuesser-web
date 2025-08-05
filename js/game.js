// game.js - Fixed version
import { db } from './firebase-config.js';
import { elements } from './dom-elements.js';
import { gameState, updateGameState } from './game-state.js';
import { getUserLocation } from './utils.js';

export function setGameDifficulty(level) {
  updateGameState({ currentDifficulty: level });
  if (elements.currentDifficultyBadge) {
    elements.currentDifficultyBadge.textContent = level.toUpperCase();
    elements.currentDifficultyBadge.className = "badge";
    if (level === 'easy') elements.currentDifficultyBadge.classList.add("green");
    else if (level === 'medium') elements.currentDifficultyBadge.classList.add("yellow");
    else if (level === 'hard') elements.currentDifficultyBadge.classList.add("red");
  }
}

export function startGame() {
  if (!gameState.playerName) {
    alert("Vui lòng đăng nhập trước.");
    return;
  }
  elements.difficultyContainer.classList.add("hidden");
  elements.gameContainer.classList.remove("hidden");
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

export async function generateNewLocation(level) {
  // Wait for Google Maps to be loaded
  await waitForGoogleMaps();
  
  // Initialize StreetViewService if not already done
  if (!gameState.streetViewService) {
    console.log('🔧 Initializing StreetViewService...');
    updateGameState({ 
      streetViewService: new google.maps.StreetViewService() 
    });
  }

  const userLocation = await getUserLocation();
  const maxTries = 20;
  let tries = 0;

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

  function tryFindPanorama() {
    tries++;
    let coord;
    let searchRadius;

    if (level === 'easy') {
      searchRadius = 10000;
      coord = getRandomNearbyCoords(userLocation, searchRadius / 1000);
      
      if (tries > 5) {
        searchRadius = 5000;
        coord = getRandomNearbyCoords(userLocation, searchRadius / 1000);
      }
      
    } else if (level === 'medium') {
      coord = {
        lat: 10 + Math.random() * 50,
        lng: 60 + Math.random() * 90
      };
      searchRadius = 50000;
      
    } else {
      coord = {
        lat: -85 + Math.random() * 170,
        lng: -180 + Math.random() * 360
      };
      searchRadius = 100000;
    }

    console.log(`🔍 Thử lần ${tries}/${maxTries} - Tọa độ: ${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}`);

    gameState.streetViewService.getPanorama({ 
      location: coord, 
      radius: searchRadius,
      source: google.maps.StreetViewSource.OUTDOOR
    }, (data, status) => {
      
      if (status === google.maps.StreetViewStatus.OK) {
        
        if (!isValidPanoramaForLevel(data, level)) {
          console.log(`❌ Panorama không phù hợp với độ khó ${level} - Links: ${(data.links || []).length}`);
          
          if (tries < maxTries) {
            setTimeout(tryFindPanorama, 100);
          } else {
            alert(`⚠️ Không tìm thấy vị trí phù hợp sau ${maxTries} lần thử. Đang thử lại...`);
            tries = 0;
            setTimeout(tryFindPanorama, 500);
          }
          return;
        }

        updateGameState({ actualLocation: data.location.latLng });
        console.log(`✅ Tìm thấy panorama phù hợp! Links: ${(data.links || []).length}, Pano ID: ${data.location.pano}`);
        
        const panoramaOptions = {
          position: gameState.actualLocation,
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

        elements.showGuessMapBtn.classList.remove('hidden');
        elements.submitGuessBtn.classList.add('hidden');
        elements.guessMapContainer.style.display = 'none';
        updateGameState({ guessLocation: null });

        if (gameState.guessMarker) gameState.guessMarker.setMap(null);
        if (gameState.actualMarker) gameState.actualMarker.setMap(null);
        
      } else {
        console.log(`❌ Không tìm thấy Street View - Status: ${status}`);
        
        if (tries < maxTries) {
          setTimeout(tryFindPanorama, 100);
        } else {
          alert(`⚠️ Không tìm thấy vị trí hợp lệ sau ${maxTries} lần thử. Vui lòng thử lại.`);
          elements.gameContainer.classList.add("hidden");
          elements.difficultyContainer.classList.remove("hidden");
        }
      }
    });
  }

  console.log(`🎯 Bắt đầu tìm panorama cho độ khó: ${level.toUpperCase()}`);
  tryFindPanorama();
}

export async function showGuessMap() {
  // Wait for Google Maps to be loaded
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
  if (!gameState.guessLocation || !gameState.actualLocation) return alert("Vui lòng chọn vị trí!");

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

  if (gameState.actualMarker) gameState.actualMarker.setMap(null);
  
  const actualMarker = new google.maps.Marker({
    position: gameState.actualLocation,
    map: gameState.guessMap,
    icon: { url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png" },
    title: "Vị trí thật"
  });
  
  updateGameState({ actualMarker });

  elements.viewOnGoogleMapBtn?.classList.remove('hidden');
  elements.replayBtn?.classList.remove('hidden');

  saveScore();

  const guessData = {
    actualLat: gameState.actualLocation.lat(),
    actualLng: gameState.actualLocation.lng(),
    guessLat: gameState.guessLocation.lat,
    guessLng: gameState.guessLocation.lng,
    distance,
    difficulty: gameState.currentDifficulty,
    name: gameState.playerName,
    timestamp: Date.now()
  };

  db.ref("guesses").push(guessData);
}

export function saveScore() {
  db.ref("scores").push({
    name: gameState.playerName,
    score: gameState.score,
    difficulty: gameState.currentDifficulty,
    time: Date.now()
  });
}

export function resetGame() {
  updateGameState({ 
    score: 0,
    guessLocation: null,
    actualLocation: null
  });

  if (gameState.guessMarker) {
    gameState.guessMarker.setMap(null);
    updateGameState({ guessMarker: null });
  }
  if (gameState.actualMarker) {
    gameState.actualMarker.setMap(null);
    updateGameState({ actualMarker: null });
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
  if (elements.guessMapContainer) elements.guessMapContainer.classList.add('hidden');

  if (elements.mapPreview) {
    elements.mapPreview.innerHTML = '';
  }

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