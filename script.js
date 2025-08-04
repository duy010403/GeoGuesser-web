// Firebase init (must match config)
const firebaseConfig = {
  apiKey: "AIzaSyCGMcrDszDaktX6fXDpaT4Fx8k12N9RuCM",
  authDomain: "geoguesser-84d8b.firebaseapp.com",
  databaseURL: "https://geoguesser-84d8b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "geoguesser-84d8b",
  storageBucket: "geoguesser-84d8b.appspot.com",
  messagingSenderId: "692484269477",
  appId: "1:692484269477:web:65decb37c4f2f72ec5b44c",
  measurementId: "G-4R2TWB4MNM"
};
firebase.initializeApp(firebaseConfig);
window.db = firebase.database();
window.auth = firebase.auth();

// Admin email 
const ADMIN_EMAIL = "duyga154@gmail.com";

// State
let playerName = '';
let score = 0;
let currentDifficulty = 'easy';
let guessMarker, actualMarker;
let actualLocation, guessLocation;
let guessMap;
let streetViewService;

// UI refs
const authContainer = document.getElementById("authContainer");
const difficultyContainer = document.getElementById("difficultyContainer");
const gameContainer = document.getElementById("gameContainer");
const adminLoginContainer = document.getElementById("adminLoginContainer");
const displayNameSpan = document.getElementById("displayName");
const playerNameDisplay = document.getElementById("playerNameDisplay");
const currentDifficultyBadge = document.getElementById("currentDifficultyBadge");
const authMessage = document.getElementById("authMessage");
const loggedInInfo = document.getElementById("loggedInInfo");

// Init map service
window.initMap = () => {
  streetViewService = new google.maps.StreetViewService();
  loadLeaderboard();
};

// Auth listeners
document.getElementById("signupBtn").addEventListener("click", async () => {
  const email = document.getElementById("userEmail").value.trim();
  const password = document.getElementById("userPassword").value;
  authMessage.textContent = '';
  
  if (!email || !password) {
    authMessage.textContent = "Email và mật khẩu không được để trống.";
    authMessage.classList.remove('hidden');
    return;
  }
  
  try {
    const userCred = await auth.createUserWithEmailAndPassword(email, password);
    console.log('✅ Tạo tài khoản thành công:', userCred.user.email);
  } catch (e) {
    console.error('❌ Lỗi tạo tài khoản:', e);
    authMessage.textContent = e.message;
    authMessage.classList.remove('hidden');
  }
});

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("userEmail").value.trim();
  const password = document.getElementById("userPassword").value;
  authMessage.textContent = '';
  authMessage.classList.add('hidden');
  
  if (!email || !password) {
    authMessage.textContent = "Email và mật khẩu không được để trống.";
    authMessage.classList.remove('hidden');
    return;
  }
  
  try {
    const userCred = await auth.signInWithEmailAndPassword(email, password);
    console.log('✅ Đăng nhập thành công:', userCred.user.email);
  } catch (e) {
    console.error('❌ Lỗi đăng nhập:', e);
    authMessage.textContent = e.message;
    authMessage.classList.remove('hidden');
  }
});

document.getElementById("logoutUserBtn").addEventListener("click", async () => {
  if (confirm('🤔 Bạn có chắc muốn đăng xuất không?')) {
    await auth.signOut();
  }
});

// Save display name
document.getElementById("saveDisplayNameBtn").addEventListener("click", saveDisplayName);

// Auth state changed
auth.onAuthStateChanged(async (user) => {
  if (user) {
    document.getElementById("fixedLogoutBtn").classList.remove("hidden");
    console.log('🔄 User đã đăng nhập:', user.email);
    await postLoginSetup(user);
  } else {
    console.log('🚪 User đã đăng xuất');
    resetUIAfterLogout();
    document.getElementById("fixedLogoutBtn").classList.add("hidden");
  }
});

// Function chính để xử lý sau khi đăng nhập
async function postLoginSetup(user) {
  try {
    authContainer.classList.add("hidden");
    
    const hasDisplayName = await checkUserDisplayName(user);
    
    if (hasDisplayName) {
      console.log('✅ User đã có displayName:', hasDisplayName);
      proceedToGame(user, hasDisplayName);
    } else {
      console.log('📝 User chưa có displayName, hiển thị form đặt tên');
      showDisplayNameForm();
    }
  } catch (error) {
    console.error('❌ Lỗi trong postLoginSetup:', error);
    authMessage.textContent = 'Có lỗi xảy ra: ' + error.message;
    authMessage.classList.remove('hidden');
  }
}

// Proceed directly to game (skip AI analysis)
async function proceedToGame(user, displayName) {
  playerName = displayName;
  
  // Update display names
  const displayElements = document.querySelectorAll('#displayName, #playerNameDisplay');
  displayElements.forEach(el => {
    if (el) el.textContent = displayName;
  });
  
  if (loggedInInfo) loggedInInfo.classList.remove('hidden');
  
  // Show difficulty selection directly
  difficultyContainer.classList.remove('hidden');
  setGameDifficulty('easy');
  
  // Check admin
  if (user.email === ADMIN_EMAIL) {
    adminLoginContainer.classList.remove("hidden");
  }
}

// Kiểm tra user đã có displayName chưa
async function checkUserDisplayName(user) {
  try {
    if (user.displayName && user.displayName.trim() !== '') {
      console.log('✅ Tìm thấy displayName trong Auth profile:', user.displayName);
      return user.displayName.trim();
    }
    
    const userRef = db.ref(`users/${user.uid}`);
    const snapshot = await userRef.once('value');
    const userData = snapshot.val();
    
    if (userData && userData.displayName && userData.displayName.trim() !== '') {
      console.log('✅ Tìm thấy displayName trong database:', userData.displayName);
      await user.updateProfile({ displayName: userData.displayName });
      return userData.displayName.trim();
    }
    
    console.log('❌ Không tìm thấy displayName');
    return null;
    
  } catch (error) {
    console.error('❌ Lỗi kiểm tra displayName:', error);
    return null;
  }
}

// Hiển thị form đặt tên
function showDisplayNameForm() {
  authContainer.classList.add('hidden');
  difficultyContainer.classList.add('hidden');
  gameContainer.classList.add('hidden');
  if (loggedInInfo) loggedInInfo.classList.add('hidden');
  
  const displayNameContainer = document.getElementById('displayNameContainer');
  if (displayNameContainer) {
    displayNameContainer.classList.remove('hidden');
    
    const input = document.getElementById('displayNameInput');
    if (input) {
      input.value = '';
      input.focus();
      input.removeEventListener('keypress', handleEnterKey);
      input.addEventListener('keypress', handleEnterKey);
    }
  }
}

function handleEnterKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveDisplayName();
  }
}

async function saveDisplayName() {
  const displayNameInput = document.getElementById('displayNameInput');
  const saveBtn = document.getElementById('saveDisplayNameBtn');
  
  if (!displayNameInput || !auth.currentUser) {
    alert('❌ Có lỗi xảy ra, vui lòng thử lại');
    return;
  }
  
  const displayName = displayNameInput.value.trim();
  
  if (!displayName) {
    alert('⚠️ Vui lòng nhập tên hiển thị!');
    displayNameInput.focus();
    return;
  }
  
  if (displayName.length < 2) {
    alert('⚠️ Tên phải có ít nhất 2 ký tự!');
    displayNameInput.focus();
    return;
  }
  
  if (displayName.length > 20) {
    alert('⚠️ Tên không được quá 20 ký tự!');
    displayNameInput.focus();
    return;
  }
  
  const validName = /^[a-zA-Z0-9\sÀ-ỹàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]+$/.test(displayName);
  if (!validName) {
    alert('⚠️ Tên chỉ được chứa chữ cái, số và khoảng trắng!');
    displayNameInput.focus();
    return;
  }
  
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Đang lưu...';
  }
  
  try {
    const user = auth.currentUser;
    
    await user.updateProfile({
      displayName: displayName
    });
    
    const userRef = db.ref(`users/${user.uid}`);
    await userRef.update({
      displayName: displayName,
      email: user.email,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP
    });
    
    console.log('✅ Đã lưu displayName thành công:', displayName);
    
    alert(`🎉 Chào mừng ${displayName}! Hãy bắt đầu chơi!`);
    
    // Hide display name form and proceed to game
    document.getElementById('displayNameContainer').classList.add('hidden');
    proceedToGame(user, displayName);
    
  } catch (error) {
    console.error('❌ Lỗi lưu displayName:', error);
    alert('❌ Có lỗi khi lưu tên: ' + error.message);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '✅ Lưu và tiếp tục';
    }
  }
}

async function skipDisplayName() {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const emailUsername = user.email.split('@')[0];
    const saveBtn = document.getElementById('saveDisplayNameBtn');
    
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ Đang lưu...';
    }
    
    await user.updateProfile({
      displayName: emailUsername
    });
    
    const userRef = db.ref(`users/${user.uid}`);
    await userRef.update({
      displayName: emailUsername,
      email: user.email,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP
    });
    
    console.log('✅ Đã lưu email username:', emailUsername);
    
    document.getElementById('displayNameContainer').classList.add('hidden');
    proceedToGame(user, emailUsername);
    
  } catch (error) {
    console.error('❌ Lỗi skip displayName:', error);
    alert('❌ Có lỗi: ' + error.message);
  }
}

// Reset UI sau khi đăng xuất
function resetUIAfterLogout() {
  playerName = '';
  score = 0;
  
  authContainer.classList.remove("hidden");
  difficultyContainer.classList.add("hidden");
  gameContainer.classList.add("hidden");
  adminLoginContainer.classList.add("hidden");
  if (loggedInInfo) loggedInInfo.classList.add("hidden");
  
  const displayNameContainer = document.getElementById('displayNameContainer');
  if (displayNameContainer) displayNameContainer.classList.add('hidden');
  
  const emailInput = document.getElementById('userEmail');
  const passwordInput = document.getElementById('userPassword');
  if (emailInput) emailInput.value = '';
  if (passwordInput) passwordInput.value = '';
  if (authMessage) {
    authMessage.textContent = '';
    authMessage.classList.add('hidden');
  }
  
  document.getElementById('score').textContent = '0';
  document.getElementById('result').classList.add('hidden');
  
  if (guessMarker) guessMarker.setMap(null);
  if (actualMarker) actualMarker.setMap(null);
  
  console.log('🔄 UI đã được reset sau đăng xuất');
}

// Fixed logout button
function logoutUser() {
  firebase.auth().signOut().then(() => {
    document.getElementById("fixedLogoutBtn").classList.add("hidden");
  });
}

// Game logic
function setGameDifficulty(level) {
  currentDifficulty = level;
  if (currentDifficultyBadge) {
    currentDifficultyBadge.textContent = level.toUpperCase();
    currentDifficultyBadge.className = "badge"; // reset
    if (level === 'easy') currentDifficultyBadge.classList.add("green");
    else if (level === 'medium') currentDifficultyBadge.classList.add("yellow");
    else if (level === 'hard') currentDifficultyBadge.classList.add("red");
  }
}


function startGame() {
  if (!playerName) {
    alert("Vui lòng đăng nhập trước.");
    return;
  }
  difficultyContainer.classList.add("hidden");
  gameContainer.classList.remove("hidden");
  generateNewLocation(currentDifficulty);
}
// ❗ GỢI Ý: đặt bên ngoài generateNewLocation()
async function runOcrToDetectSign() {
  const canvas = await html2canvas(document.getElementById("mapPreview"));
  const result = await Tesseract.recognize(canvas.toDataURL(), 'eng');
  const text = result.data.text.toLowerCase();

  console.log("🔍 OCR (tên đường):", text);

  const streetKeywords = [
    'street', 'st.', 'road', 'rd.', 'avenue', 'ave',
    'boulevard', 'blvd', 'alley', 'hẻm', 'ngõ', 'ngách',
    'đường', 'quốc lộ', 'ql', 'hwy', 'highway', 'QUẬN', 'phường','quận',
    'lê', 'nguyễn', 'trần', 'phạm', 'thái', 'văn', 'hoàng', 'đinh' // họ phổ biến
  ];

  return streetKeywords.some(keyword => text.includes(keyword));
}


async function generateNewLocation(level) {
  const userLocation = await getUserLocation();
  const maxTries = 20; // Tăng số lần thử để tìm được panorama phù hợp
  let tries = 0;

  function getRandomNearbyCoords(center, radiusKm) {
    const r = radiusKm / 111.32;
    const u = Math.random(), v = Math.random();
    const w = r * Math.sqrt(u), t = 2 * Math.PI * v;
    const lat = w * Math.cos(t), lng = w * Math.sin(t) / Math.cos(center.lat * Math.PI / 180);
    return { lat: center.lat + lat, lng: center.lng + lng };
  }

  // Hàm kiểm tra chất lượng panorama dựa trên metadata
  function isValidPanoramaForLevel(data, level) {
    if (!data || !data.location) return false;
    
    // Kiểm tra có phải panorama outdoor không (không phải indoor)
    const links = data.links || [];
    const hasLinks = links.length > 0;
    
    // Kiểm tra có phải ảnh chụp từ đường phố không
    const isStreetLevel = data.location.pano && data.location.pano.length > 0;
    
    switch(level) {
      case 'easy':
        // Dễ: Cần có nhiều links (nghĩa là ở đường phố có thể di chuyển)
        // và không phải ảnh chụp từ xe/máy bay (thường có ít links)
        return hasLinks && links.length >= 2 && isStreetLevel;
        
      case 'medium':
        // Trung bình: Chấp nhận ít links hơn, có thể là khu vực ít đường hơn
        return hasLinks && links.length >= 1 && isStreetLevel;
        
      case 'hard':
        // Khó: Chấp nhận mọi loại panorama hợp lệ
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
      // Dễ: Trong vòng 10km, ưu tiên khu vực đô thị
      searchRadius = 10000;
      coord = getRandomNearbyCoords(userLocation, searchRadius / 1000);
      
      // Thêm bias về phía trung tâm thành phố (giảm radius để tăng khả năng có đường phố)
      if (tries > 5) {
        searchRadius = 5000; // Thu nhỏ phạm vi nếu thử nhiều lần
        coord = getRandomNearbyCoords(userLocation, searchRadius / 1000);
      }
      
    } else if (level === 'medium') {
      // Trung bình: Toàn châu Á
      coord = {
        lat: 10 + Math.random() * 50,    // Từ 10°N đến 60°N
        lng: 60 + Math.random() * 90     // Từ 60°E đến 150°E
      };
      searchRadius = 50000;
      
    } else {
      // Khó: Toàn thế giới  
      coord = {
        lat: -85 + Math.random() * 170,  // Từ -85° đến 85°
        lng: -180 + Math.random() * 360  // Từ -180° đến 180°
      };
      searchRadius = 100000;
    }

    console.log(`🔍 Thử lần ${tries}/${maxTries} - Tọa độ: ${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}`);

   streetViewService.getPanorama({
  location: coord,
  radius: searchRadius,
  source: google.maps.StreetViewSource.OUTDOOR
}, async (data, status) => {

  if (status === google.maps.StreetViewStatus.OK) {

    // Kiểm tra chất lượng panorama theo độ khó
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

    // Panorama hợp lệ
    actualLocation = data.location.latLng;
    console.log(`✅ Tìm thấy panorama phù hợp! Links: ${(data.links || []).length}, Pano ID: ${data.location.pano}`);

    const panoramaOptions = {
      position: actualLocation,
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
      document.getElementById("mapPreview"),
      panoramaOptions
    );

    // 🧠 Nếu là chế độ dễ, thì kiểm tra OCR để tìm biển chỉ đường
    if (level === 'easy') {
      setTimeout(async () => {
        const hasStreetSign = await runOcrToDetectSign();
        if (hasStreetSign) {
          console.log("✅ Phát hiện tên đường hoặc biển chỉ dẫn!");
        } else {
          console.log("⚠️ Không phát hiện biển chỉ dẫn.");
        }
      }, 2000); // Đợi 2s cho ảnh load xong
    }
  }
});

}

  // Bắt đầu tìm panorama
  console.log(`🎯 Bắt đầu tìm panorama cho độ khó: ${level.toUpperCase()}`);
  tryFindPanorama();
}
function showGuessMap() {
  document.getElementById('guessMapContainer').style.display = 'block';
  document.getElementById('showGuessMapBtn').classList.add('hidden');
  document.getElementById('submitGuessBtn').classList.remove('hidden');

  guessMap = new google.maps.Map(document.getElementById("guessMap"), {
    center: { lat: 20, lng: 0 },
    zoom: 2,
  });

  guessMap.addListener("click", (e) => {
    guessLocation = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    if (guessMarker) guessMarker.setMap(null);
    guessMarker = new google.maps.Marker({
      position: guessLocation,
      map: guessMap,
      icon: { url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png" },
      title: "Vị trí bạn chọn"
    });
  });
}

function submitGuess() {
  const btn = document.getElementById('submitGuessBtn');
  if (!btn || btn.disabled) return;
  if (!guessLocation || !actualLocation) return alert("Vui lòng chọn vị trí!");

  btn.disabled = true;

  const distance = haversineDistance(
    { lat: actualLocation.lat(), lng: actualLocation.lng() },
    guessLocation
  );

  let points = 0;
  if (distance < 1) points = 100;
  else if (distance < 5) points = 50;
  else if (distance < 25) points = 25;
  else if (distance < 100) points = 10;

  const difficultyMultiplier = currentDifficulty === 'hard' ? 1.5 : currentDifficulty === 'medium' ? 1.2 : 1;
  points = Math.round(points * difficultyMultiplier);

  score += points;

  const resultElement = document.getElementById('result');
  if (resultElement) {
    resultElement.textContent = `🎯 Khoảng cách: ${distance.toFixed(2)} km | 🎊 Điểm nhận: ${points}`;
    resultElement.classList.remove('hidden');
  }

  const scoreEl = document.getElementById('score');
  if (scoreEl) scoreEl.textContent = score;

  if (actualMarker) actualMarker.setMap(null);
  actualMarker = new google.maps.Marker({
    position: actualLocation,
    map: guessMap,
    icon: { url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png" },
    title: "Vị trí thật"
  });

  document.getElementById('viewOnGoogleMapBtn')?.classList.remove('hidden');
  document.getElementById('replayBtn')?.classList.remove('hidden');

  saveScore();

  const guessData = {
    actualLat: actualLocation.lat(),
    actualLng: actualLocation.lng(),
    guessLat: guessLocation.lat,
    guessLng: guessLocation.lng,
    distance,
    difficulty: currentDifficulty,
    name: playerName,
    timestamp: Date.now()
  };

  db.ref("guesses").push(guessData);
}

function saveScore() {
  db.ref("scores").push({
    name: playerName,
    score: score,
    difficulty: currentDifficulty,
    time: Date.now()
  });
}

function loadLeaderboard() {
  db.ref("scores").once("value", (snapshot) => {
    const scoreData = snapshot.val() || {};
    const summaries = { easy: {}, medium: {}, hard: {} };

    Object.values(scoreData).forEach(({ name, score, difficulty }) => {
      if (!summaries[difficulty]) return;
      if (!summaries[difficulty][name]) summaries[difficulty][name] = 0;
      summaries[difficulty][name] += score;
    });

    ['easy', 'medium', 'hard'].forEach(level => {
      const tbody = document.getElementById(`scoreTable-${level}`);
      if (!tbody) return;
      tbody.innerHTML = '';
      const sorted = Object.entries(summaries[level] || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      sorted.forEach(([name, score]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${name}</td><td>${score}</td>`;
        tbody.appendChild(tr);
      });
    });
  });
}

function resetGame() {
  score = 0;
  guessLocation = null;
  actualLocation = null;

  if (guessMarker) {
    guessMarker.setMap(null);
    guessMarker = null;
  }
  if (actualMarker) {
    actualMarker.setMap(null);
    actualMarker = null;
  }

  document.getElementById('score') && (document.getElementById('score').textContent = '0');
  const resultEl = document.getElementById('result');
  if (resultEl) {
    resultEl.textContent = '';
    resultEl.classList.add('hidden');
  }

  const submitBtn = document.getElementById('submitGuessBtn');
  submitBtn && (submitBtn.disabled = false);
  submitBtn && submitBtn.classList.add('hidden');

  document.getElementById('showGuessMapBtn')?.classList.add('hidden');
  document.getElementById('viewOnGoogleMapBtn')?.classList.add('hidden');
  document.getElementById('replayBtn')?.classList.add('hidden');
  document.getElementById('guessMapContainer') && document.getElementById('guessMapContainer').classList.add('hidden');

  const mapPreview = document.getElementById('mapPreview');
  if (mapPreview) {
    mapPreview.innerHTML = '';
  }

  gameContainer.classList.add("hidden");
  difficultyContainer.classList.remove("hidden");

  console.log('🔄 Game đã được reset, trở về chọn độ khó');
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
function toRad(x) { return x * Math.PI / 180; }

function getUserLocation() {
  return new Promise((resolve) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          console.log('📍 Vị trí người dùng:', location);
          resolve(location);
        },
        (error) => {
          console.log('⚠️ Không lấy được GPS, dùng IP location:', error.message);
          // Fallback to IP location
          fetch('https://ipapi.co/json/')
            .then(res => res.json())
            .then(data => {
              const location = {
                lat: data.latitude || 10.8231, // Default to Ho Chi Minh City
                lng: data.longitude || 106.6297
              };
              console.log('🌐 Vị trí từ IP:', location);
              resolve(location);
            })
            .catch(() => {
              // Ultimate fallback to Ho Chi Minh City
              const location = { lat: 10.8231, lng: 106.6297 };
              console.log('🏙️ Dùng vị trí mặc định:', location);
              resolve(location);
            });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // Cache 5 minutes
        }
      );
    } else {
      // No geolocation support
      fetch('https://ipapi.co/json/')
        .then(res => res.json())
        .then(data => resolve({ lat: data.latitude || 10.8231, lng: data.longitude || 106.6297 }))
        .catch(() => resolve({ lat: 10.8231, lng: 106.6297 }));
    }
  });
}
function viewOnGoogleMap() {
  if (!actualLocation) {
    alert("⚠️ Không có vị trí để hiển thị!");
    return;
  }
  
  const lat = actualLocation.lat();
  const lng = actualLocation.lng();
  
  // Tạo URL Google Maps
  const googleMapsUrl = `https://www.google.com/maps/@${lat},${lng},15z`;
  
  // Mở tab mới
  window.open(googleMapsUrl, '_blank');
  
  console.log(`🌍 Mở Google Maps: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
}

// Admin functions
function adminLogin() {
  const email = document.getElementById('adminEmail').value;
  const pass = document.getElementById('adminPassword').value;
  auth.signInWithEmailAndPassword(email, pass)
    .then(() => {
      document.getElementById('deleteBtn').style.display = 'inline-block';
      document.getElementById('logoutBtn').style.display = 'inline-block';
      alert('Đăng nhập admin thành công!');
      loadAdminGuesses();
      loadGroupedGuesses();
    })
    .catch(() => alert('Sai thông tin đăng nhập!'));
}

function adminLogout() {
  auth.signOut().then(() => {
    alert('Đã đăng xuất admin!');
    document.getElementById('deleteBtn').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById("adminGuessesContainer").style.display = 'none';
    document.getElementById("adminHistoryGrouped").style.display = 'none';
  });
}

function deleteAllScores() {
  if (confirm("Bạn có chắc muốn xóa toàn bộ bảng điểm?")) {
    db.ref("scores").remove()
      .then(() => alert("Đã xóa toàn bộ điểm!"))
      .catch((err) => alert("Lỗi: " + err.message));
  }
}

function loadAdminGuesses() {
  db.ref("guesses").orderByChild("timestamp").limitToLast(100).once("value", snapshot => {
    const body = document.getElementById("adminGuessesBody");
    body.innerHTML = "";
    snapshot.forEach(child => {
      const g = child.val();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${g.name || ''}</td>
        <td>${g.difficulty || ''}</td>
        <td>${g.actualLat?.toFixed(4) || ''}, ${g.actualLng?.toFixed(4) || ''}</td>
        <td>${g.guessLat?.toFixed(4) || ''}, ${g.guessLng?.toFixed(4) || ''}</td>
        <td>${g.distance?.toFixed(2) || ''}</td>
        <td>${g.timestamp ? new Date(g.timestamp).toLocaleString() : ''}</td>
      `;
      body.appendChild(row);
    });
    document.getElementById("adminGuessesContainer").style.display = 'block';
  });
}

function loadGroupedGuesses() {
  db.ref("guesses").orderByChild("timestamp").once("value", snapshot => {
    const allGuesses = Object.values(snapshot.val() || {});
    const grouped = {};

    allGuesses.forEach(g => {
      const dateStr = new Date(g.timestamp).toLocaleDateString('vi-VN');
      if (!grouped[dateStr]) grouped[dateStr] = { easy: [], medium: [], hard: [] };
      grouped[dateStr][g.difficulty]?.push(g);
    });

    const container = document.getElementById("adminHistoryGrouped");
    container.innerHTML = '';

    Object.keys(grouped).sort((a, b) => {
      const [d1, m1, y1] = a.split('/').map(Number);
      const [d2, m2, y2] = b.split('/').map(Number);
      return new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1);
    }).forEach(date => {
      const daySection = document.createElement("div");
      daySection.innerHTML = `<h3 style="margin-top:30px;">📅 Ngày: ${date}</h3>`;

      ["easy", "medium", "hard"].forEach(level => {
        const data = grouped[date][level];
        if (!data || data.length === 0) return;

        const title = { easy: "🟢 Dễ", medium: "🟡 Trung bình", hard: "🔴 Khó" }[level];

        const table = document.createElement("table");
        table.style.cssText = "width:100%; border-collapse: collapse; margin-top:10px; text-align:center;";
        table.innerHTML = `
          <thead>
            <tr>
              <th>👤 Tên</th>
              <th>${title}</th>
              <th>📍 Tọa độ thật</th>
              <th>❓ Tọa độ đoán</th>
              <th>📏 Khoảng cách (km)</th>
              <th>🕒 Thời gian</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(g => `
              <tr>
                <td>${g.name}</td>
                <td>${level}</td>
                <td>${g.actualLat?.toFixed(4) || ''}, ${g.actualLng?.toFixed(4) || ''}</td>
                <td>${g.guessLat?.toFixed(4) || ''}, ${g.guessLng?.toFixed(4) || ''}</td>
                <td>${g.distance?.toFixed(2) || ''}</td>
                <td>${g.timestamp ? new Date(g.timestamp).toLocaleTimeString('vi-VN') : ''}</td>
              </tr>
            `).join("")}
          </tbody>
        `;
        daySection.appendChild(table);
      });

      container.appendChild(daySection);
    });

    container.style.display = 'block';
  });
}

