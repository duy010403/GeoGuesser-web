let playerName = '';
let score = 0;
let currentDifficulty = 'easy';
let guessMarker;
let actualMarker;
let actualLocation;
let guessLocation;
let guessMap;
let streetViewService;

window.initMap = () => {
  streetViewService = new google.maps.StreetViewService();
  loadLeaderboard();
};

function startGame() {
  const nameInput = document.getElementById('playerName').value.trim();
  if (!nameInput) {
    alert('Vui lòng nhập tên!');
    return;
  }
  playerName = nameInput;

  // Nếu là admin thì hiển thị khu vực login email
  if (playerName === 'admin1111') {
    document.getElementById('adminLoginContainer').style.display = 'block';
  } else {
    document.getElementById('difficultyContainer').style.display = 'block';
  }

  document.getElementById('startContainer').style.display = 'none';
}


function selectDifficulty(level) {
  currentDifficulty = level;
  document.getElementById('difficultyContainer').style.display = 'none';
  document.getElementById('gameContainer').style.display = 'block';
  document.getElementById('displayName').textContent = playerName;
  generateNewLocation(level);
}

async function generateNewLocation(level) {
  const userLocation = await getUserLocation();
  const maxTries = 10;
  let tries = 0;

  function getRandomNearbyCoords(center, radiusKm) {
    const r = radiusKm / 111.32;
    const u = Math.random(), v = Math.random();
    const w = r * Math.sqrt(u), t = 2 * Math.PI * v;
    const lat = w * Math.cos(t), lng = w * Math.sin(t) / Math.cos(center.lat * Math.PI / 180);
    return { lat: center.lat + lat, lng: center.lng + lng };
  }

  function tryFindPanorama() {
    tries++;
    let coord;
    let searchRadius;

    if (level === 'easy') {
      searchRadius = 10000;
      coord = getRandomNearbyCoords(userLocation, searchRadius / 1000);
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

    streetViewService.getPanorama({ location: coord, radius: searchRadius }, (data, status) => {
      if (status === google.maps.StreetViewStatus.OK) {
        actualLocation = data.location.latLng;
        new google.maps.StreetViewPanorama(document.getElementById("mapPreview"), {
          position: actualLocation,
          pov: { heading: 165, pitch: 0 },
          zoom: 1
        });

        // Hiển thị nút mở bản đồ lớn
        const lat = actualLocation.lat();
        const lng = actualLocation.lng();
        const mapsUrl = `https://www.google.com/maps/@${lat},${lng},17z`;

        let openMapBtn = document.getElementById('openMapBtn');
        if (!openMapBtn) {
          openMapBtn = document.createElement('a');
          openMapBtn.id = 'openMapBtn';
          openMapBtn.textContent = '📍 Mở trên Google Maps';
          openMapBtn.target = '_blank';
          openMapBtn.style.display = 'inline-block';
          openMapBtn.style.marginTop = '10px';
          openMapBtn.style.color = 'blue';
          openMapBtn.style.fontWeight = 'bold';
          openMapBtn.style.textDecoration = 'underline';
          document.getElementById('mapPreview').appendChild(openMapBtn);
        }
        openMapBtn.href = mapsUrl;

        document.getElementById('showGuessMapBtn').style.display = 'inline-block';
        document.getElementById('submitGuessBtn').style.display = 'none';
        document.getElementById('guessMapContainer').style.display = 'none';
        guessLocation = null;
      } else {
        if (tries < maxTries) tryFindPanorama();
        else alert("Không tìm thấy vị trí hợp lệ.");
      }
    });
  }

  tryFindPanorama();
}


function showGuessMap() {
  document.getElementById('guessMapContainer').style.display = 'block';
  document.getElementById('showGuessMapBtn').style.display = 'none';
  document.getElementById('submitGuessBtn').style.display = 'inline-block';

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
  if (btn.disabled) return; // tránh gọi lại nhiều lần
  if (!guessLocation || !actualLocation) return alert("Vui lòng chọn vị trí!");
  btn.disabled = true;
  const distance = haversineDistance(
    { lat: actualLocation.lat(), lng: actualLocation.lng() },
    guessLocation
  );

  let points = 0;
  if (distance < 1) points = 100;
  else if (distance < 5) points = 50;

  score += points;
  document.getElementById('result').textContent = `Khoảng cách: ${distance.toFixed(2)} km (${points} điểm)`;
  document.getElementById('score').textContent = score;

  if (actualMarker) actualMarker.setMap(null);
  actualMarker = new google.maps.Marker({
    position: actualLocation,
    map: guessMap,
    icon: { url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png" },
    title: "Vị trí thật"
  });

  document.getElementById('replayBtn').style.display = 'inline-block';

  // ✅ Ghi điểm và lịch sử
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
    const summaries = {
      easy: {}, medium: {}, hard: {}
    };

    Object.values(scoreData).forEach(({ name, score, difficulty }) => {
      if (!summaries[difficulty]) return;
      if (!summaries[difficulty][name]) summaries[difficulty][name] = 0;
      summaries[difficulty][name] += score;
    });

    ['easy', 'medium', 'hard'].forEach(level => {
      const tbody = document.getElementById(`scoreTable-${level}`);
      tbody.innerHTML = '';
      const sorted = Object.entries(summaries[level])
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
  if (guessMarker) guessMarker.setMap(null);
  if (actualMarker) actualMarker.setMap(null);
  document.getElementById('score').textContent = 0;
  document.getElementById('result').textContent = '';
  document.getElementById('gameContainer').style.display = 'none';
  document.getElementById('difficultyContainer').style.display = 'block';
  document.getElementById('submitGuessBtn').style.display = 'none';
  document.getElementById('replayBtn').style.display = 'none';

  // ✅ Bật lại nút sau khi chơi lại
  document.getElementById('submitGuessBtn').disabled = false;
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
    navigator.geolocation?.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => fetch('https://ipapi.co/json/')
        .then(res => res.json())
        .then(data => resolve({ lat: data.latitude, lng: data.longitude }))
    );
  });
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
      
      // 👉 Thêm dòng này để hiển thị lịch sử đoán
      loadAdminGuesses();
    })
    .catch(() => alert('Sai thông tin đăng nhập!'));
    loadGroupedGuesses();
}


function adminLogout() {
  auth.signOut().then(() => {
    alert('Đã đăng xuất admin!');
    document.getElementById('deleteBtn').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
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
        <td>${g.name}</td>
        <td>${g.difficulty}</td>
        <td>${g.actualLat.toFixed(4)}, ${g.actualLng.toFixed(4)}</td>
        <td>${g.guessLat.toFixed(4)}, ${g.guessLng.toFixed(4)}</td>
        <td>${g.distance.toFixed(2)}</td>
        <td>${new Date(g.timestamp).toLocaleString()}</td>
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

    // Nhóm theo ngày và độ khó
    allGuesses.forEach(g => {
      const dateStr = new Date(g.timestamp).toLocaleDateString('vi-VN'); // VD: 26/6/2025
      if (!grouped[dateStr]) grouped[dateStr] = { easy: [], medium: [], hard: [] };
      grouped[dateStr][g.difficulty].push(g);
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
        if (data.length === 0) return;

        const title = {
          easy: "🟢 Dễ",
          medium: "🟡 Trung bình",
          hard: "🔴 Khó"
        }[level];

        const table = document.createElement("table");
        table.border = 1;
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
                <td>${g.actualLat.toFixed(4)}, ${g.actualLng.toFixed(4)}</td>
                <td>${g.guessLat.toFixed(4)}, ${g.guessLng.toFixed(4)}</td>
                <td>${g.distance.toFixed(2)}</td>
                <td>${new Date(g.timestamp).toLocaleTimeString('vi-VN')}</td>
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

