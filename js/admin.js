// admin.js - Updated version with new leaderboard integration
import { auth, db } from './firebase-config.js';
import { elements } from './dom-elements.js';
import { gameState, updateGameState } from './game-state.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

function showAdminButtons() {
  document.getElementById('adminLogoutBtn')?.classList.remove('hidden');
  document.getElementById('deleteBtn')?.classList.remove('hidden');
  document.getElementById('loadGuessesBtn')?.classList.remove('hidden');
  document.getElementById('loadGroupedBtn')?.classList.remove('hidden');
}

export function adminLogin() {
  const adminEmail = document.getElementById('adminEmail');
  const adminPassword = document.getElementById('adminPassword');
  
  if (!adminEmail || !adminPassword) {
    console.error('❌ Admin input elements not found');
    alert('Lỗi: Không tìm thấy form đăng nhập admin!');
    return;
  }
  
  const email = adminEmail.value.trim();
  const pass = adminPassword.value;
  
  console.log('🔐 Attempting admin login for:', email);
  
  if (!email || !pass) {
    alert('Vui lòng nhập đầy đủ email và mật khẩu!');
    return;
  }
  
  auth.signInWithEmailAndPassword(email, pass)
    .then(() => {
      console.log('✅ Admin đăng nhập thành công');
      
      // Đợi DOM render xong trước khi thao tác
      setTimeout(() => {
        showAdminButtons();
        updateGameState({ isAdminLoggedIn: true });
        loadAdminGuesses();
        loadGroupedGuesses();
        loadLeaderboard();
      }, 100);
      
      alert('Đăng nhập admin thành công!');
    })
    .catch((error) => {
      console.error('❌ Admin login error:', error);
      alert('Sai thông tin đăng nhập! ' + error.message);
    });
}

export function adminLogout() {
  auth.signOut().then(() => {
    console.log('✅ Admin đăng xuất thành công');
    
    // Hide admin buttons
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    if (adminLogoutBtn) {
      adminLogoutBtn.classList.add('hidden');
    }
    
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
      deleteBtn.classList.add('hidden');
    }
    
    const loadGuessesBtn = document.getElementById('loadGuessesBtn');
    if (loadGuessesBtn) {
      loadGuessesBtn.classList.add('hidden');
    }
    
    const loadGroupedBtn = document.getElementById('loadGroupedBtn');
    if (loadGroupedBtn) {
      loadGroupedBtn.classList.add('hidden');
    }
    
    // Hide admin data containers
    if (elements.adminGuessesContainer) {
      elements.adminGuessesContainer.style.display = 'none';
    }
    if (elements.adminHistoryGrouped) {
      elements.adminHistoryGrouped.style.display = 'none';
    }
    
    // Clear input fields
    const adminEmail = document.getElementById('adminEmail');
    const adminPassword = document.getElementById('adminPassword');
    if (adminEmail) adminEmail.value = '';
    if (adminPassword) adminPassword.value = '';
    
    alert('Đã đăng xuất admin!');
    updateGameState({ isAdminLoggedIn: false });
  }).catch(error => {
    console.error('❌ Admin logout error:', error);
    alert('Lỗi khi đăng xuất: ' + error.message);
  });
}

export function deleteAllScores() {
  if (confirm("Bạn có chắc muốn xóa toàn bộ bảng điểm?")) {
    db.ref("scores").remove()
      .then(() => {
        alert("Đã xóa toàn bộ điểm!");
        loadLeaderboard(); // Reload leaderboard after deletion
      })
      .catch((err) => {
        console.error('❌ Error deleting scores:', err);
        alert("Lỗi: " + err.message);
      });
  }
}

export function loadAdminGuesses() {
  console.log('🔄 Loading admin guesses...');
  
  db.ref("guesses").orderByChild("timestamp").limitToLast(100).once("value", snapshot => {
    if (!elements.adminGuessesBody) {
      console.log('❌ Admin guesses body element not found');
      return;
    }
    
    elements.adminGuessesBody.innerHTML = "";
    
    const guesses = [];
    snapshot.forEach(child => {
      guesses.push(child.val());
    });
    
    console.log(`📊 Loaded ${guesses.length} guesses`);
    
    // Reverse to show newest first
    guesses.reverse().forEach(g => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${g.name || 'N/A'}</td>
        <td>${g.difficulty || 'N/A'}</td>
        <td>${g.actualLat?.toFixed(4) || 'N/A'}, ${g.actualLng?.toFixed(4) || 'N/A'}</td>
        <td>${g.guessLat?.toFixed(4) || 'N/A'}, ${g.guessLng?.toFixed(4) || 'N/A'}</td>
        <td>${g.distance?.toFixed(2) || 'N/A'} km</td>
        <td>${g.timestamp ? new Date(g.timestamp).toLocaleString('vi-VN') : 'N/A'}</td>
      `;
      elements.adminGuessesBody.appendChild(row);
    });
    
    if (elements.adminGuessesContainer) {
      elements.adminGuessesContainer.style.display = 'block';
      console.log('✅ Admin guesses container shown');
    }
  }).catch(error => {
    console.error('❌ Error loading admin guesses:', error);
    alert('Lỗi khi tải dữ liệu: ' + error.message);
  });
}

export function loadGroupedGuesses() {
  console.log("🔄 Loading grouped guesses...");
  const container = document.getElementById("adminHistoryGrouped");
  container.innerHTML = "";

  const today = new Date();
  const todayStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

  db.ref("guesses").orderByChild("timestamp").once("value", snapshot => {
    const allGuesses = [];
    snapshot.forEach(child => {
      allGuesses.push(child.val());
    });

    const groupedByDate = {};
    allGuesses.forEach(g => {
      if (!g.timestamp) return;
      const date = new Date(g.timestamp);
      const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
      if (!groupedByDate[dateStr]) groupedByDate[dateStr] = [];
      groupedByDate[dateStr].push(g);
    });

    const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
      const [d1, m1, y1] = a.split('/').map(Number);
      const [d2, m2, y2] = b.split('/').map(Number);
      return new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1);
    });

    sortedDates.forEach(date => {
      const guesses = groupedByDate[date];

      const users = {};
      guesses.forEach(g => {
        const key = (g.name || 'N/A').trim().toLowerCase();
        if (!users[key]) {
          users[key] = {
            name: g.name?.trim() || 'N/A',
            plays: 0,
            totalScore: 0
          };
        }
        users[key].plays += 1;
        users[key].totalScore += g.score || 0;
      });

      const groupDiv = document.createElement("div");
      groupDiv.className = "group-table";
      groupDiv.dataset.date = date;

      // ❗ Chỉ hiển thị hôm nay, còn lại ẩn đi
      if (date !== todayStr) {
        groupDiv.style.display = "none";
      }

      groupDiv.innerHTML = `
        <h3 style="margin-top:30px; color: #fff;">📅 Ngày: ${date}</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 10px 0; text-align: center; border: 1px solid #ccc; border-radius: 8px; overflow: hidden; background: rgba(255,255,255,0.04);">
          <thead style="background-color: #334155; color: white;">
            <tr>
              <th style="padding:12px;">👤 Người chơi</th>
              <th style="padding:12px;">🔁 Số lần chơi</th>
              <th style="padding:12px;">💯 Tổng điểm</th>
            </tr>
          </thead>
          <tbody>
            ${Object.values(users).map((u, i) => `
              <tr style="background-color: ${i % 2 === 0 ? '#1e293b' : '#0f172a'}; color: #f1f5f9;">
                <td style="padding:10px;">${u.name}</td>
                <td style="padding:10px;">${u.plays}</td>
                <td style="padding:10px;">${u.totalScore}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;

      container.appendChild(groupDiv);
    });

    // 📌 Nút hiển thị tất cả ngày khác
    const showAllBtn = document.createElement("button");
    showAllBtn.textContent = "📂 Chọn ngày khác";
    showAllBtn.style = `
      margin-top: 20px;
      padding: 10px 20px;
      background: #0ea5e9;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
    `;
    showAllBtn.onclick = () => {
      document.querySelectorAll(".group-table").forEach(div => {
        div.style.display = "block";
      });
      showAllBtn.remove();
    };
    container.appendChild(showAllBtn);

    container.classList.remove("hidden");
    container.style.display = "block";
    console.log("📊 Tổng số lượt đoán:", allGuesses.length);
    console.log("✅ Hiển thị grouped history thành công");
  });
}

// Updated loadLeaderboard function with new UI integration
export function loadLeaderboard() {
  console.log('🔄 Loading leaderboard...');
  
  db.ref("scores").once("value", (snapshot) => {
    const scoreData = snapshot.val() || {};
    const summaries = { easy: {}, medium: {}, hard: {} };

    // Process and group scores by difficulty and player
    Object.values(scoreData).forEach(({ name, score, difficulty }) => {
      if (!summaries[difficulty]) return;
      if (!summaries[difficulty][name]) summaries[difficulty][name] = 0;
      summaries[difficulty][name] += score;
    });

    // Populate each difficulty level
    ['easy', 'medium', 'hard'].forEach(level => {
      const sorted = Object.entries(summaries[level] || {})
        .sort((a, b) => b[1] - a[1]) // Sort by score descending
        .slice(0, 10); // Top 10 players
        
      // Use the global populateLeaderboard function
      if (typeof window !== 'undefined' && window.populateLeaderboard) {
        window.populateLeaderboard(level, sorted);
        console.log(`✅ Leaderboard populated for ${level}: ${sorted.length} players`);
      } else {
        console.error('❌ populateLeaderboard function not found');
      }
    });
    
    console.log('✅ Leaderboard loaded successfully');
  }).catch(error => {
    console.error('❌ Error loading leaderboard:', error);
    
    // Show empty state for all difficulties on error
    ['easy', 'medium', 'hard'].forEach(level => {
      if (typeof window !== 'undefined' && window.populateLeaderboard) {
        window.populateLeaderboard(level, []);
      }
    });
  });
}

// Function to show admin panel (called when user is admin)
export function showAdminPanel() {
  console.log('🔧 Showing admin panel...');
  
  const adminSection = document.getElementById('adminSection');
  if (adminSection) {
    adminSection.style.display = 'block';
  }
  
  const adminControlsContainer = document.getElementById('adminControls');
  if (adminControlsContainer) {
    adminControlsContainer.style.display = 'block';
  }
  
  // Auto-load admin data
  loadAdminGuesses();
  loadGroupedGuesses();
  loadLeaderboard();
}

// Function to hide admin panel
export function hideAdminPanel() {
  console.log('🔧 Hiding admin panel...');
  
  const adminSection = document.getElementById('adminSection');
  if (adminSection) {
    adminSection.style.display = 'none';
  }
  
  const adminControlsContainer = document.getElementById('adminControls');
  if (adminControlsContainer) {
    adminControlsContainer.style.display = 'none';
  }
}