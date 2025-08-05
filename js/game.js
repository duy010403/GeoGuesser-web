// Enhanced game.js with score notification and ranking system
import { db } from './firebase-config.js';
import { elements } from './dom-elements.js';
import { gameState, updateGameState } from './game-state.js';
import { getUserLocation } from './utils.js';

// Timer variables
let countdownInterval;
let timeLeft = 180;

// Score ranges and rankings (0-100 system)
const SCORE_RANGES = {
  perfect: { min: 100, title: "PERFECT!", subtitle: "Xuất sắc!", emoji: "🏆", color: "#FFD700" },
  excellent: { min: 80, title: "EXCELLENT", subtitle: "Tuyệt vời!", emoji: "🥇", color: "#FF6B35" },
  great: { min: 60, title: "GREAT", subtitle: "Rất tốt!", emoji: "🥈", color: "#F7931E" },
  good: { min: 50, title: "GOOD", subtitle: "Tốt!", emoji: "🥉", color: "#FFD23F" },
  okay: { min: 25, title: "OKAY", subtitle: "Ổn!", emoji: "👍", color: "#06D6A0" },
  meh: { min: 10, title: "MEH", subtitle: "Tạm được", emoji: "😐", color: "#118AB2" },
  bad: { min: 5, title: "BAD", subtitle: "Chưa tốt", emoji: "😕", color: "#EF476F" },
  terrible: { min: 0, title: "TERRIBLE", subtitle: "Cần cố gắng hơn", emoji: "😅", color: "#8B5CF6" }
};

const DISTANCE_FEEDBACK = {
  perfect: "Chính xác tuyệt đối!",
  veryClose: "Rất gần!",
  close: "Khá gần!",
  moderate: "Không xa lắm",
  far: "Hơi xa rồi",
  veryFar: "Xa quá!",
  extremelyFar: "Ở tận đâu vậy?"
};

// Leaderboard position messages
const RANKING_MESSAGES = {
  top1: "👑 Bạn đang dẫn đầu!",
  top3: "🏆 Top 3! Xuất sắc!",
  top5: "🥉 Top 5! Rất tốt!",
  top10: "⭐ Top 10! Tốt lắm!",
  good: "💪 Đang tiến bộ!",
  average: "📈 Cố gắng lên!"
};

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
  await waitForGoogleMaps();
  
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

    gameState.streetViewService.getPanorama({ 
      location: coord, 
      radius: searchRadius,
      source: google.maps.StreetViewSource.OUTDOOR
    }, (data, status) => {
      
      if (status === google.maps.StreetViewStatus.OK) {
        
        if (!isValidPanoramaForLevel(data, level)) {
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
        
        startTimer();
        elements.showGuessMapBtn.classList.remove('hidden');
        elements.submitGuessBtn.classList.add('hidden');
        elements.guessMapContainer.style.display = 'none';
        updateGameState({ guessLocation: null });

        // Clean up previous markers and polyline
        if (gameState.guessMarker) gameState.guessMarker.setMap(null);
        if (gameState.actualMarker) gameState.actualMarker.setMap(null);
        if (gameState.distanceLine) gameState.distanceLine.setMap(null);
        
      } else {
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

  tryFindPanorama();
}

export async function showGuessMap() {
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

// Enhanced submit guess with score notification
export function submitGuess() {
  const btn = elements.submitGuessBtn;
  if (!btn || btn.disabled) return;
  
  if (gameState.gameEnded) {
    alert("⏰ Đã hết thời gian! Không thể submit.");
    return;
  }

  if (!gameState.guessLocation || !gameState.actualLocation) {
    alert("Vui lòng chọn vị trí!");
    return;
  }

  stopTimer();
  updateGameState({ gameEnded: true });
  btn.disabled = true;

  const distance = haversineDistance(
    { lat: gameState.actualLocation.lat(), lng: gameState.actualLocation.lng() },
    gameState.guessLocation
  );

  // Calculate base points (0-100 system)
  let points = 0;
  if (distance < 1) points = 100;
  else if (distance < 5) points = 50;
  else if (distance < 25) points = 25;
  else if (distance < 100) points = 10;

  // Apply difficulty multiplier
  const difficultyMultiplier = gameState.currentDifficulty === 'hard' ? 1.5 : 
                               gameState.currentDifficulty === 'medium' ? 1.2 : 1;
  points = Math.round(points * difficultyMultiplier);

  const newTotalScore = gameState.score + points;
  updateGameState({ score: newTotalScore });

  // Show enhanced score notification
  showScoreNotification(points, distance, newTotalScore);

  // Update score display
  if (elements.score) elements.score.textContent = newTotalScore;

  // Show map results
  displayMapResults(distance);

  // Save score and show ranking
  saveScoreAndShowRanking(points);

  elements.viewOnGoogleMapBtn?.classList.remove('hidden');
  elements.replayBtn?.classList.remove('hidden');
}

// Enhanced score notification system
function showScoreNotification(points, distance, totalScore) {
  // Remove any existing notification
  const existingNotification = document.querySelector('.score-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  // Get score rank
  const scoreRank = getScoreRank(points);
  const distanceFeedback = getDistanceFeedback(distance);

  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'score-notification';
  notification.innerHTML = `
    <div class="score-notification-content">
      <!-- Main Score Display -->
      <div class="score-main">
        <div class="score-emoji">${scoreRank.emoji}</div>
        <div class="score-title">${scoreRank.title}</div>
        <div class="score-points">+${points.toLocaleString()} điểm</div>
        <div class="score-subtitle">${scoreRank.subtitle}</div>
      </div>
      
      <!-- Distance Info -->
      <div class="score-distance">
        <div class="distance-value">${formatDistance(distance)}</div>
        <div class="distance-feedback">${distanceFeedback}</div>
      </div>
      
      <!-- Total Score -->
      <div class="score-total">
        <span>Tổng điểm: <strong>${totalScore.toLocaleString()}</strong></span>
      </div>
      
      <!-- Progress Bar -->
      <div class="score-progress">
        <div class="score-progress-bar" style="background: ${scoreRank.color}; width: ${Math.min(points, 100)}%"></div>
      </div>
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .score-notification {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10000;
      background: linear-gradient(135deg, rgba(0,0,0,0.95), rgba(20,20,20,0.95));
      backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
      border: 2px solid rgba(255,255,255,0.1);
      min-width: 350px;
      text-align: center;
      animation: scoreNotificationShow 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
    }

    @keyframes scoreNotificationShow {
      0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.5) rotateY(90deg);
      }
      100% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1) rotateY(0deg);
      }
    }

    .score-notification-content {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .score-main {
      text-align: center;
    }

    .score-emoji {
      font-size: 4rem;
      margin-bottom: 10px;
      animation: bounceIn 0.8s ease-out 0.2s both;
    }

    @keyframes bounceIn {
      0% { transform: scale(0); }
      50% { transform: scale(1.2); }
      100% { transform: scale(1); }
    }

    .score-title {
      font-size: 2.5rem;
      font-weight: 900;
      margin-bottom: 5px;
      background: linear-gradient(45deg, #06b6d4, #9b59b6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: slideInDown 0.6s ease-out 0.4s both;
    }

    .score-points {
      font-size: 2rem;
      font-weight: 700;
      color: #2ecc71;
      margin-bottom: 5px;
      animation: slideInUp 0.6s ease-out 0.6s both;
    }

    .score-subtitle {
      font-size: 1.2rem;
      color: #95a5a6;
      font-weight: 500;
      animation: fadeIn 0.6s ease-out 0.8s both;
    }

    .score-distance {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 15px;
      animation: slideInLeft 0.6s ease-out 1s both;
    }

    .distance-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #f39c12;
      margin-bottom: 5px;
    }

    .distance-feedback {
      font-size: 1rem;
      color: #ecf0f1;
      opacity: 0.9;
    }

    .score-total {
      background: rgba(6, 182, 212, 0.1);
      border: 1px solid rgba(6, 182, 212, 0.3);
      border-radius: 12px;
      padding: 15px;
      font-size: 1.3rem;
      color: #06b6d4;
      animation: slideInRight 0.6s ease-out 1.2s both;
    }

    .score-progress {
      background: rgba(255,255,255,0.1);
      border-radius: 10px;
      height: 8px;
      overflow: hidden;
      animation: fadeIn 0.6s ease-out 1.4s both;
    }

    .score-progress-bar {
      height: 100%;
      border-radius: 10px;
      transition: width 1s ease-out 1.6s;
      animation: progressFill 1s ease-out 1.6s both;
    }

    @keyframes progressFill {
      0% { width: 0% !important; }
    }

    @keyframes slideInDown {
      0% { opacity: 0; transform: translateY(-30px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    @keyframes slideInUp {
      0% { opacity: 0; transform: translateY(30px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    @keyframes slideInLeft {
      0% { opacity: 0; transform: translateX(-30px); }
      100% { opacity: 1; transform: translateX(0); }
    }

    @keyframes slideInRight {
      0% { opacity: 0; transform: translateX(30px); }
      100% { opacity: 1; transform: translateX(0); }
    }

    @keyframes fadeIn {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }

    @media (max-width: 480px) {
      .score-notification {
        min-width: 300px;
        padding: 30px 20px;
      }
      
      .score-title {
        font-size: 2rem;
      }
      
      .score-points {
        font-size: 1.5rem;
      }
      
      .score-emoji {
        font-size: 3rem;
      }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(notification);

  // Auto remove after 4 seconds
  setTimeout(() => {
    notification.style.animation = 'scoreNotificationShow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) reverse';
    setTimeout(() => {
      notification.remove();
      style.remove();
    }, 400);
  }, 4000);

  // Click to close
  notification.addEventListener('click', () => {
    notification.style.animation = 'scoreNotificationShow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) reverse';
    setTimeout(() => {
      notification.remove();
      style.remove();
    }, 400);
  });
}

// Get score ranking
function getScoreRank(points) {
  for (const [key, range] of Object.entries(SCORE_RANGES)) {
    if (points >= range.min) {
      return range;
    }
  }
  return SCORE_RANGES.terrible;
}

// Get distance feedback
function getDistanceFeedback(distance) {
  if (distance < 0.1) return DISTANCE_FEEDBACK.perfect;
  if (distance < 1) return DISTANCE_FEEDBACK.veryClose;
  if (distance < 10) return DISTANCE_FEEDBACK.close;
  if (distance < 100) return DISTANCE_FEEDBACK.moderate;
  if (distance < 500) return DISTANCE_FEEDBACK.far;
  if (distance < 1000) return DISTANCE_FEEDBACK.veryFar;
  return DISTANCE_FEEDBACK.extremelyFar;
}

// Format distance display
function formatDistance(distance) {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  } else if (distance < 10) {
    return `${distance.toFixed(1)}km`;
  } else {
    return `${Math.round(distance)}km`;
  }
}

// Enhanced save score with ranking and leaderboard refresh
async function saveScoreAndShowRanking(points) {
  // Save score to database
  const scoreData = {
    name: gameState.playerName,
    score: gameState.score,
    difficulty: gameState.currentDifficulty,
    time: Date.now()
  };
  
  await db.ref("scores").push(scoreData);

  // Immediately refresh leaderboard after saving score
  setTimeout(async () => {
    // Import and call loadLeaderboard to refresh the display
    try {
      const { loadLeaderboard } = await import('./admin.js');
      loadLeaderboard();
      console.log('✅ Leaderboard refreshed after score submission');
    } catch (error) {
      console.error('❌ Error refreshing leaderboard:', error);
    }
    
    // Get current leaderboard position and show ranking notification
    const ranking = await getCurrentRanking();
    showRankingNotification(ranking);
  }, 1000); // Small delay to ensure data is saved
}

// Get current player ranking
async function getCurrentRanking() {
  try {
    const snapshot = await db.ref("scores").once("value");
    const scoreData = snapshot.val() || {};
    const summaries = {};

    // Group scores by player for current difficulty
    Object.values(scoreData).forEach(({ name, score, difficulty }) => {
      if (difficulty === gameState.currentDifficulty) {
        if (!summaries[name]) summaries[name] = 0;
        summaries[name] += score;
      }
    });

    // Sort by score descending
    const sorted = Object.entries(summaries)
      .sort((a, b) => b[1] - a[1]);

    // Find current player position
    const playerPosition = sorted.findIndex(([name]) => name === gameState.playerName) + 1;
    const totalPlayers = sorted.length;
    const playerScore = summaries[gameState.playerName] || 0;

    return {
      position: playerPosition,
      total: totalPlayers,
      score: playerScore,
      difficulty: gameState.currentDifficulty
    };
  } catch (error) {
    console.error('Error getting ranking:', error);
    return null;
  }
}

// Show ranking notification
function showRankingNotification(ranking) {
  if (!ranking) return;

  const message = getRankingMessage(ranking.position, ranking.total);
  const difficultyName = {
    easy: 'Dễ',
    medium: 'Trung bình', 
    hard: 'Khó'
  }[ranking.difficulty];

  // Create ranking notification
  const notification = document.createElement('div');
  notification.className = 'ranking-notification';
  notification.innerHTML = `
    <div class="ranking-content">
      <div class="ranking-icon">${getRankingIcon(ranking.position, ranking.total)}</div>
      <div class="ranking-message">${message}</div>
      <div class="ranking-details">
        <div class="ranking-position">Hạng ${ranking.position}/${ranking.total}</div>
        <div class="ranking-difficulty">Độ khó: ${difficultyName}</div>
        <div class="ranking-score">${ranking.score.toLocaleString()} điểm</div>
      </div>
    </div>
  `;

  // Add ranking styles
  const rankingStyle = document.createElement('style');
  rankingStyle.textContent = `
    .ranking-notification {
      position: fixed;
      top: 30px;
      right: 30px;
      z-index: 9999;
      background: linear-gradient(135deg, rgba(6, 182, 212, 0.95), rgba(155, 89, 182, 0.95));
      backdrop-filter: blur(15px);
      border-radius: 15px;
      padding: 20px 25px;
      box-shadow: 0 15px 35px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.2);
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
      animation: rankingSlideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
      min-width: 280px;
    }

    @keyframes rankingSlideIn {
      0% {
        opacity: 0;
        transform: translateX(100%);
      }
      100% {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .ranking-content {
      display: flex;
      flex-direction: column;
      gap: 10px;
      text-align: center;
    }

    .ranking-icon {
      font-size: 2.5rem;
      margin-bottom: 5px;
    }

    .ranking-message {
      font-size: 1.2rem;
      font-weight: 700;
      margin-bottom: 10px;
    }

    .ranking-details {
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-size: 0.9rem;
      opacity: 0.9;
    }

    .ranking-position {
      font-weight: 600;
      color: #FFD700;
    }

    .ranking-difficulty {
      opacity: 0.8;
    }

    .ranking-score {
      font-weight: 600;
      color: #2ecc71;
    }

    @media (max-width: 768px) {
      .ranking-notification {
        top: 80px;
        right: 15px;
        left: 15px;
        min-width: auto;
      }
    }
  `;

  document.head.appendChild(rankingStyle);
  document.body.appendChild(notification);

  // Auto remove after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'rankingSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) reverse';
    setTimeout(() => {
      notification.remove();
      rankingStyle.remove();
    }, 400);
  }, 5000);

  // Click to close
  notification.addEventListener('click', () => {
    notification.style.animation = 'rankingSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) reverse';
    setTimeout(() => {
      notification.remove();
      rankingStyle.remove();
    }, 400);
  });
}

// Get ranking message based on position
function getRankingMessage(position, total) {
  if (position === 1) return RANKING_MESSAGES.top1;
  if (position <= 3) return RANKING_MESSAGES.top3;
  if (position <= 5) return RANKING_MESSAGES.top5;
  if (position <= 10) return RANKING_MESSAGES.top10;
  if (position <= total * 0.3) return RANKING_MESSAGES.good;
  return RANKING_MESSAGES.average;
}

// Get ranking icon
function getRankingIcon(position, total) {
  if (position === 1) return "👑";
  if (position <= 3) return "🏆";
  if (position <= 5) return "🥉";
  if (position <= 10) return "⭐";
  if (position <= total * 0.3) return "💪";
  return "📈";
}

// Display map results
function displayMapResults(distance) {
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

  // Update result display
  if (elements.result) {
    elements.result.textContent = `🎯 Khoảng cách: ${formatDistance(distance)} | ${getDistanceFeedback(distance)}`;
    elements.result.classList.remove('hidden');
  }
}

export function saveScore() {
  db.ref("scores").push({
    name: gameState.playerName,
    score: gameState.score,
    difficulty: gameState.currentDifficulty,
    time: Date.now()
  }).then(() => {
    // Auto refresh leaderboard after successful save
    setTimeout(async () => {
      try {
        const { loadLeaderboard } = await import('./admin.js');
        loadLeaderboard();
        console.log('✅ Leaderboard auto-refreshed after score save');
      } catch (error) {
        console.error('❌ Error auto-refreshing leaderboard:', error);
      }
    }, 500);
  });
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

  // Show timeout notification
  showTimeoutNotification();
}

// Show timeout notification
function showTimeoutNotification() {
  const notification = document.createElement('div');
  notification.className = 'timeout-notification';
  notification.innerHTML = `
    <div class="timeout-content">
      <div class="timeout-icon">⏰</div>
      <div class="timeout-title">HẾT GIỜ!</div>
      <div class="timeout-subtitle">Thời gian đã hết</div>
      <div class="timeout-message">Hãy nhanh tay hơn trong lần sau!</div>
    </div>
  `;

  // Add timeout styles
  const timeoutStyle = document.createElement('style');
  timeoutStyle.textContent = `
    .timeout-notification {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10000;
      background: linear-gradient(135deg, rgba(231, 76, 60, 0.95), rgba(192, 57, 43, 0.95));
      backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
      border: 2px solid rgba(255,255,255,0.1);
      min-width: 300px;
      text-align: center;
      animation: timeoutShow 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
    }

    @keyframes timeoutShow {
      0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.5);
      }
      100% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }

    .timeout-content {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .timeout-icon {
      font-size: 4rem;
      animation: shake 0.8s ease-in-out infinite;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }

    .timeout-title {
      font-size: 2.5rem;
      font-weight: 900;
      margin-bottom: 5px;
    }

    .timeout-subtitle {
      font-size: 1.3rem;
      opacity: 0.9;
    }

    .timeout-message {
      font-size: 1rem;
      opacity: 0.8;
      margin-top: 10px;
    }
  `;

  document.head.appendChild(timeoutStyle);
  document.body.appendChild(notification);

  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'timeoutShow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) reverse';
    setTimeout(() => {
      notification.remove();
      timeoutStyle.remove();
    }, 400);
  }, 3000);

  // Click to close
  notification.addEventListener('click', () => {
    notification.style.animation = 'timeoutShow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) reverse';
    setTimeout(() => {
      notification.remove();
      timeoutStyle.remove();
    }, 400);
  });
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

console.log('🎮 Enhanced game module loaded with score notifications and ranking system');

// Initialize real-time leaderboard updates
export function initRealtimeLeaderboard() {
  // Listen for changes in scores database
  db.ref("scores").on('child_added', (snapshot) => {
    // Only refresh if it's not the current user's score being added
    // (to avoid double refresh)
    const scoreData = snapshot.val();
    if (scoreData && scoreData.name !== gameState.playerName) {
      setTimeout(async () => {
        try {
          const { loadLeaderboard } = await import('./admin.js');
          loadLeaderboard();
          console.log('🔄 Leaderboard auto-updated due to new score from other player');
        } catch (error) {
          console.error('❌ Error in real-time leaderboard update:', error);
        }
      }, 1000);
    }
  });
  
  console.log('📊 Real-time leaderboard updates initialized');
}