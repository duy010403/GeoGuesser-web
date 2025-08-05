// admin.js - Clean version focused on date statistics only
import { auth, db } from './firebase-config.js';
import { elements } from './dom-elements.js';
import { gameState, updateGameState } from './game-state.js';

function showAdminButtons() {
  const buttonIds = ['adminLogoutBtn', 'deleteBtn', 'loadGroupedBtn'];
  
  buttonIds.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.classList.remove('hidden');
      btn.style.display = 'inline-block';
      console.log(`✅ Showed admin button: ${id}`);
    } else {
      console.error(`❌ Button not found: ${id}`);
    }
  });
}

export function adminLogout() {
  if (!confirm('🤔 Bạn có chắc muốn đăng xuất admin không?')) {
    return;
  }

  console.log('✅ Admin đăng xuất');
  
  // Hide admin buttons
  const adminButtons = ['adminLogoutBtn', 'deleteBtn', 'loadGroupedBtn'];
  adminButtons.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.classList.add('hidden');
      btn.style.display = 'none';
    }
  });
  
  // Hide admin data containers
  if (elements.adminHistoryGrouped) {
    elements.adminHistoryGrouped.classList.add('hidden');
    elements.adminHistoryGrouped.style.display = 'none';
  }
  
  // Hide admin container
  elements.adminLoginContainer.classList.add('hidden');
  
  updateGameState({ isAdminLoggedIn: false });
  alert('🚪 Đã đăng xuất admin! Admin features sẽ được kích hoạt lại khi bạn đăng nhập lại.');
}

export function deleteAllScores() {
  // Enhanced confirmation for safety
  const confirmMessage = `⚠️ CẢNH BÁO: Bạn sắp xóa toàn bộ điểm số của tất cả người chơi!
  
Hành động này KHÔNG THỂ HOÀN TÁC!

Để xác nhận, vui lòng nhập chính xác: DELETE ALL SCORES`;

  const userInput = prompt(confirmMessage);
  
  if (userInput !== 'DELETE ALL SCORES') {
    alert('❌ Xác nhận không chính xác. Hủy bỏ thao tác xóa.');
    return;
  }

  const deleteBtn = document.getElementById('deleteBtn');
  if (deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = '⏳ Đang xóa...';
  }

  db.ref("scores").remove()
    .then(() => {
      alert("✅ Đã xóa toàn bộ điểm thành công!");
      console.log('✅ All scores deleted successfully');
      
      // Reload leaderboard after deletion
      setTimeout(() => {
        loadLeaderboard();
      }, 1000);
    })
    .catch((err) => {
      console.error('❌ Error deleting scores:', err);
      alert("❌ Lỗi khi xóa điểm: " + err.message);
    })
    .finally(() => {
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = '🗑️ Xóa tất cả điểm';
      }
    });
}

export function loadGroupedGuesses() {
  console.log("📅 Loading grouped statistics...");
  
  const loadBtn = document.getElementById('loadGroupedBtn');
  if (loadBtn) {
    loadBtn.disabled = true;
    loadBtn.textContent = '⏳ Đang tải...';
  }

  const container = document.getElementById("adminHistoryGrouped");
  if (!container) {
    console.error('❌ Admin history container not found');
    return;
  }

  // Clear container and show loading
  container.innerHTML = `
    <div style="text-align: center; padding: 30px;">
      <div style="font-size: 2rem; margin-bottom: 15px;">⏳</div>
      <div>Đang tải thống kê theo ngày...</div>
    </div>
  `;

  db.ref("guesses").orderByChild("timestamp").once("value", snapshot => {
    const allGuesses = [];
    snapshot.forEach(child => {
      const data = child.val();
      if (data && data.timestamp) {
        allGuesses.push(data);
      }
    });

    console.log(`📊 Processing ${allGuesses.length} total guesses`);

    if (allGuesses.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px;">
          <div style="font-size: 3rem; margin-bottom: 20px; opacity: 0.5;">📅</div>
          <h3 style="color: #06b6d4; margin-bottom: 15px;">Chưa có dữ liệu thống kê</h3>
          <p style="opacity: 0.8; margin: 0;">Bắt đầu chơi game để xem thống kê tại đây!</p>
        </div>
      `;
      container.classList.remove("hidden");
      container.style.display = "block";
      return;
    }

    // Group by date
    const groupedByDate = {};
    allGuesses.forEach(g => {
      const date = new Date(g.timestamp);
      const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
      
      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = [];
      }
      groupedByDate[dateStr].push(g);
    });

    // Sort dates (newest first)
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
      const [d1, m1, y1] = a.split('/').map(Number);
      const [d2, m2, y2] = b.split('/').map(Number);
      return new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1);
    });

    // Create date picker interface
    container.innerHTML = `
      <div style="background: rgba(255,255,255,0.08); padding: 25px; border-radius: 16px; margin-bottom: 30px; box-shadow: 0 8px 25px rgba(0,0,0,0.2);">
        <h4 style="margin: 0 0 20px 0; color: #06b6d4; font-size: 1.4rem; text-align: center;">📅 Thống kê theo ngày</h4>
        
        <div style="display: flex; gap: 15px; align-items: center; justify-content: center; flex-wrap: wrap; margin-bottom: 15px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <label style="font-weight: 600; color: #eef2f7;">Chọn ngày:</label>
            <select id="dateSelector" style="padding: 10px 15px; border-radius: 8px; border: 1px solid #4f6f8f; background: #1f2f45; color: #eef2f7; font-size: 1rem; min-width: 150px;">
              <option value="">-- Chọn ngày --</option>
              ${sortedDates.map(date => `<option value="${date}">${date}</option>`).join('')}
            </select>
          </div>
          
          <button id="showTodayBtn" class="green" style="padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.95rem;">
            📅 Hôm nay
          </button>
          
          <button id="showAllDatesBtn" class="blue" style="padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.95rem;">
            📂 Tất cả ngày
          </button>
        </div>
        
        <div style="text-align: center; font-size: 0.9rem; color: #95a5a6; margin-top: 15px;">
          💡 Có dữ liệu cho <strong>${sortedDates.length}</strong> ngày • Từ ${sortedDates[sortedDates.length - 1]} đến ${sortedDates[0]}
        </div>
      </div>
      
      <div id="dateDataContainer">
        <div style="text-align: center; padding: 50px; opacity: 0.7;">
          <div style="font-size: 3rem; margin-bottom: 20px;">👆</div>
          <h3 style="color: #06b6d4; margin-bottom: 10px;">Chọn ngày để xem thống kê</h3>
          <p style="margin: 0; opacity: 0.8;">Sử dụng dropdown hoặc các nút bên trên</p>
        </div>
      </div>
    `;

    // Add event listeners
    const dateSelector = document.getElementById('dateSelector');
    const showAllBtn = document.getElementById('showAllDatesBtn');
    const showTodayBtn = document.getElementById('showTodayBtn');
    const dataContainer = document.getElementById('dateDataContainer');

    // Function to display data for specific dates
    function displayDateData(datesToShow) {
      if (datesToShow.length === 0) {
        dataContainer.innerHTML = `
          <div style="text-align: center; padding: 50px; opacity: 0.7;">
            <div style="font-size: 3rem; margin-bottom: 20px;">📅</div>
            <h3 style="color: #f39c12; margin-bottom: 10px;">Không có dữ liệu</h3>
            <p style="margin: 0;">Không có dữ liệu cho ngày được chọn</p>
          </div>
        `;
        return;
      }

      let html = '';
      datesToShow.forEach(date => {
        const guesses = groupedByDate[date];
        
        // Aggregate user stats for this date
        const userStats = {};
        let totalGames = 0;
        let totalScore = 0;
        
        guesses.forEach(guess => {
          const userName = (guess.name || 'Unknown').trim();
          const key = userName.toLowerCase();
          
          if (!userStats[key]) {
            userStats[key] = {
              name: userName,
              plays: 0,
              totalScore: 0,
              avgDistance: 0,
              totalDistance: 0,
              bestScore: 0,
              difficulties: { easy: 0, medium: 0, hard: 0 }
            };
          }
          
          userStats[key].plays += 1;
          userStats[key].totalScore += guess.score || 0;
          userStats[key].totalDistance += guess.distance || 0;
          userStats[key].bestScore = Math.max(userStats[key].bestScore, guess.score || 0);
          
          if (guess.difficulty) {
            userStats[key].difficulties[guess.difficulty] = (userStats[key].difficulties[guess.difficulty] || 0) + 1;
          }
          
          totalGames++;
          totalScore += guess.score || 0;
        });
        
        // Calculate averages
        Object.values(userStats).forEach(user => {
          user.avgDistance = user.plays > 0 ? (user.totalDistance / user.plays) : 0;
        });
        
        const avgScorePerGame = totalGames > 0 ? Math.round(totalScore / totalGames) : 0;
        const uniquePlayers = Object.keys(userStats).length;
        
        // Get today's date for comparison
        const today = new Date();
        const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
        const isToday = date === todayStr;

        // Create the statistics card matching the design in the image
        html += `
          <div style="margin: 25px 0; background: linear-gradient(135deg, #06b6d4, #0891b2); border-radius: 20px; overflow: hidden; box-shadow: 0 15px 40px rgba(0,0,0,0.3); color: white;">
            <!-- Header Section -->
            <div style="padding: 25px; text-align: center; background: rgba(255,255,255,0.1);">
              <h3 style="margin: 0; font-size: 1.8rem; display: flex; align-items: center; justify-content: center; gap: 10px;">
                📅 ${date} ${isToday ? '(Hôm nay)' : ''}
              </h3>
              <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 1rem;">Thống kê chi tiết cho ngày này</p>
            </div>
            
            <!-- Summary Stats -->
            <div style="display: flex; justify-content: space-around; padding: 20px; background: rgba(255,255,255,0.05);">
              <div style="text-align: center;">
                <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 5px;">${totalGames}</div>
                <div style="font-size: 0.9rem; opacity: 0.9;">Lượt chơi</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 5px;">${uniquePlayers}</div>
                <div style="font-size: 0.9rem; opacity: 0.9;">Người chơi</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 2.5rem; font-weight: bold; margin-bottom: 5px;">${avgScorePerGame}</div>
                <div style="font-size: 0.9rem; opacity: 0.9;">Điểm TB</div>
              </div>
            </div>
            
            <!-- Player Statistics Table -->
            <div style="background: rgba(255,255,255,0.08); margin: 0;">
              <!-- Table Header -->
              <div style="display: grid; grid-template-columns: 80px 1fr 80px 100px 120px 100px 120px; gap: 10px; padding: 15px 20px; background: rgba(0,0,0,0.2); font-weight: 700; font-size: 0.9rem; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <div>🏆<br>Xếp hạng</div>
                <div style="text-align: left;">👤<br>Người chơi</div>
                <div>🎮<br>Lượt chơi</div>
                <div>💯<br>Tổng điểm</div>
                <div>⭐<br>Điểm cao nhất</div>
                <div>📏<br>KC trung bình</div>
                <div>🎯<br>Độ khó</div>
              </div>
              
              <!-- Player Rows -->
              ${Object.values(userStats)
                .sort((a, b) => b.totalScore - a.totalScore)
                .map((user, index) => {
                  const rank = index + 1;
                  let rankDisplay = '';
                  let rankStyle = '';
                  
                  if (rank === 1) {
                    rankDisplay = '🥇';
                    rankStyle = 'color: #FFD700; font-size: 1.8rem;';
                  } else if (rank === 2) {
                    rankDisplay = '🥈';
                    rankStyle = 'color: #C0C0C0; font-size: 1.8rem;';
                  } else if (rank === 3) {
                    rankDisplay = '🥉';
                    rankStyle = 'color: #CD7F32; font-size: 1.8rem;';
                  } else {
                    rankDisplay = `${rank}`;
                    rankStyle = 'background: rgba(255,255,255,0.2); width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto; font-weight: bold;';
                  }
                  
                  const difficultyBadges = Object.entries(user.difficulties)
                    .filter(([_, count]) => count > 0)
                    .map(([diff, count]) => {
                      const colors = {
                        easy: '#2ecc71',
                        medium: '#f1c40f', 
                        hard: '#e74c3c'
                      };
                      const labels = {
                        easy: 'dễ',
                        medium: 'TB',
                        hard: 'khó'
                      };
                      return `<span style="background: ${colors[diff]}; color: white; padding: 2px 6px; border-radius: 12px; font-size: 0.7rem; margin: 0 1px; font-weight: 600;">${labels[diff]}:${count}</span>`;
                    }).join('');
                  
                  return `
                    <div style="display: grid; grid-template-columns: 80px 1fr 80px 100px 120px 100px 120px; gap: 10px; padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); align-items: center; transition: all 0.3s ease; ${index % 2 === 0 ? 'background: rgba(255,255,255,0.03);' : ''}">
                      <div style="text-align: center; ${rankStyle}">${rankDisplay}</div>
                      <div style="font-weight: 600; text-align: left;">${user.name}</div>
                      <div style="text-align: center; color: #67e8f9; font-weight: 600;">${user.plays}</div>
                      <div style="text-align: center; color: #2ecc71; font-weight: 700; font-size: 1.1rem;">${user.totalScore.toLocaleString()}</div>
                      <div style="text-align: center; color: #f39c12; font-weight: 600;">${user.bestScore}</div>
                      <div style="text-align: center; color: #ff6b6b; font-weight: 600;">${user.avgDistance.toFixed(1)}km</div>
                      <div style="text-align: center; font-size: 0.8rem;">${difficultyBadges || '<span style="opacity: 0.5;">-</span>'}</div>
                    </div>
                  `;
                }).join('')}
            </div>
          </div>
        `;
      });
      
      dataContainer.innerHTML = html;
    }

    // Date selector change event
    dateSelector.addEventListener('change', (e) => {
      const selectedDate = e.target.value;
      if (selectedDate) {
        displayDateData([selectedDate]);
      } else {
        dataContainer.innerHTML = `
          <div style="text-align: center; padding: 50px; opacity: 0.7;">
            <div style="font-size: 3rem; margin-bottom: 20px;">👆</div>
            <h3 style="color: #06b6d4; margin-bottom: 10px;">Chọn ngày để xem thống kê</h3>
            <p style="margin: 0; opacity: 0.8;">Sử dụng dropdown hoặc các nút bên trên</p>
          </div>
        `;
      }
    });

    // Show all dates button
    showAllBtn.addEventListener('click', () => {
      dateSelector.value = '';
      displayDateData(sortedDates.slice(0, 5)); // Limit to 5 most recent dates for performance
    });

    // Show today button
    showTodayBtn.addEventListener('click', () => {
      const today = new Date();
      const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
      
      if (groupedByDate[todayStr]) {
        dateSelector.value = todayStr;
        displayDateData([todayStr]);
      } else {
        dataContainer.innerHTML = `
          <div style="text-align: center; padding: 50px; opacity: 0.7;">
            <div style="font-size: 3rem; margin-bottom: 20px;">📅</div>
            <h3 style="color: #f39c12; margin-bottom: 15px;">Chưa có dữ liệu hôm nay</h3>
            <p style="margin: 0; font-size: 1.1rem;">Ngày: <strong>${todayStr}</strong></p>
            <p style="margin: 10px 0 0 0; opacity: 0.8;">Bắt đầu chơi để tạo dữ liệu!</p>
          </div>
        `;
      }
    });

    // Initially show today's data if available
    const today = new Date();
    const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    
    if (groupedByDate[todayStr]) {
      dateSelector.value = todayStr;
      displayDateData([todayStr]);
    }

    container.classList.remove("hidden");
    container.style.display = "block";
    
    console.log("✅ Statistics loaded with improved date picker");
    
  }).catch(error => {
    console.error('❌ Error loading statistics:', error);
    container.innerHTML = `
      <div style="text-align: center; padding: 50px;">
        <div style="font-size: 3rem; margin-bottom: 20px; color: #e74c3c;">❌</div>
        <h3 style="color: #e74c3c; margin-bottom: 15px;">Lỗi khi tải dữ liệu</h3>
        <p style="margin: 0; opacity: 0.8;">${error.message}</p>
      </div>
    `;
  }).finally(() => {
    if (loadBtn) {
      loadBtn.disabled = false;
      loadBtn.textContent = '📅 Tải theo ngày';
    }
  });
}

// Updated loadLeaderboard function
export function loadLeaderboard() {
  console.log('🏆 Loading leaderboard...');
  
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

console.log('🔧 Clean admin module loaded - focused on date statistics only');