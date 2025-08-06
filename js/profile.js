// js/profile.js - Profile System hoàn chỉnh
import { auth, db } from './firebase-config.js';
import { elements } from './dom-elements.js';
import { gameState } from './game-state.js';

// Profile System Class
class ProfileSystem {
  constructor() {
    this.profileData = {
      stats: {
        totalGames: 0,
        totalScore: 0,
        bestScore: 0,
        averageDistance: 0,
        difficulties: {
          easy: { games: 0, score: 0, average: 0 },
          medium: { games: 0, score: 0, average: 0 },
          hard: { games: 0, score: 0, average: 0 }
        }
      },
      recentGames: []
    };
    this.init();
  }

  init() {
    this.bindEvents();
    console.log('🔧 Profile system initialized');
  }

  bindEvents() {
    // Profile button
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
      profileBtn.addEventListener('click', () => this.showProfile());
    }

    // Close button
    const closeBtn = document.getElementById('closeProfileBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideProfile());
    }

    // Tab switching
    const tabs = document.querySelectorAll('.profile-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Settings buttons
    const updateDisplayNameBtn = document.getElementById('updateDisplayNameBtn');
    if (updateDisplayNameBtn) {
      updateDisplayNameBtn.addEventListener('click', () => this.updateDisplayName());
    }

    const updateEmailBtn = document.getElementById('updateEmailBtn');
    if (updateEmailBtn) {
      updateEmailBtn.addEventListener('click', () => this.updateEmail());
    }

    const updatePasswordBtn = document.getElementById('updatePasswordBtn');
    if (updatePasswordBtn) {
      updatePasswordBtn.addEventListener('click', () => this.updatePassword());
    }

    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
      deleteAccountBtn.addEventListener('click', () => this.deleteAccount());
    }

    // Overlay click to close
    const overlay = document.getElementById('profileOverlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.hideProfile();
        }
      });
    }

    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideProfile();
      }
    });
  }

  async showProfile() {
    console.log('👤 Opening profile...');
    
    // Show profile overlay
    const overlay = document.getElementById('profileOverlay');
    if (overlay) {
      overlay.classList.remove('hidden');
    }

    // Load user data
    await this.loadProfileData();
  }

  hideProfile() {
    console.log('👤 Closing profile...');
    
    const overlay = document.getElementById('profileOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  }

  switchTab(tabName) {
    console.log(`🔄 Switching to ${tabName} tab`);
    
    // Update tab buttons
    const tabs = document.querySelectorAll('.profile-tab');
    tabs.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update sections
    const sections = document.querySelectorAll('.profile-section');
    sections.forEach(section => {
      section.classList.remove('active');
    });

    const targetSection = document.getElementById(`${tabName}Section`);
    if (targetSection) {
      targetSection.classList.add('active');
    }
  }

  async loadProfileData() {
    console.log('📊 Loading profile data...');
    
    try {
      // Get current user
      const user = firebase.auth().currentUser;
      if (!user) {
        throw new Error('User not logged in');
      }

      // Update header info
      const profileDisplayName = document.getElementById('profileDisplayName');
      const profileEmail = document.getElementById('profileEmail');
      const currentEmailInput = document.getElementById('currentEmail');
      
      if (profileDisplayName) {
        profileDisplayName.textContent = user.displayName || 'Người dùng';
      }
      if (profileEmail) {
        profileEmail.textContent = user.email;
      }
      if (currentEmailInput) {
        currentEmailInput.value = user.email;
      }

      // Load game statistics
      await this.loadGameStats(user);
      
    } catch (error) {
      console.error('❌ Error loading profile data:', error);
      this.showMessage('Lỗi khi tải dữ liệu hồ sơ: ' + error.message, 'error');
    }
  }

  async loadGameStats(user) {
    try {
      console.log('📈 Loading game statistics...');
      
      const playerName = user.displayName || user.email.split('@')[0];
      
      // Load scores
      const scoresSnapshot = await db.ref('scores')
        .orderByChild('name')
        .equalTo(playerName)
        .once('value');
      
      let totalScore = 0;
      let bestScore = 0;
      const difficultyStats = {
        easy: { games: 0, score: 0 },
        medium: { games: 0, score: 0 },
        hard: { games: 0, score: 0 }
      };

      scoresSnapshot.forEach(child => {
        const data = child.val();
        totalScore += data.score || 0;
        bestScore = Math.max(bestScore, data.score || 0);
        
        if (data.difficulty && difficultyStats[data.difficulty]) {
          difficultyStats[data.difficulty].games++;
          difficultyStats[data.difficulty].score += data.score || 0;
        }
      });

      // Load guesses for distance and recent games
      const guessesSnapshot = await db.ref('guesses')
        .orderByChild('name')
        .equalTo(playerName)
        .limitToLast(50)
        .once('value');
      
      let totalDistance = 0;
      let distanceCount = 0;
      let totalGames = 0;
      const recentGames = [];

      guessesSnapshot.forEach(child => {
        const data = child.val();
        totalGames++;
        
        if (data.distance !== undefined) {
          totalDistance += data.distance;
          distanceCount++;
        }
        
        recentGames.push({
          timestamp: data.timestamp,
          difficulty: data.difficulty,
          score: data.score || 0,
          distance: data.distance || 0
        });
      });

      const averageDistance = distanceCount > 0 ? totalDistance / distanceCount : 0;

      // Calculate averages
      Object.keys(difficultyStats).forEach(diff => {
        if (difficultyStats[diff].games > 0) {
          difficultyStats[diff].average = Math.round(difficultyStats[diff].score / difficultyStats[diff].games);
        }
      });

      // Update profile data
      this.profileData.stats = {
        totalGames,
        totalScore,
        bestScore,
        averageDistance,
        difficulties: difficultyStats
      };

      this.profileData.recentGames = recentGames
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 5);

      this.updateStatsUI();
      this.updateRecentGamesTable();
      
    } catch (error) {
      console.error('❌ Error loading game stats:', error);
    }
  }

  updateStatsUI() {
    console.log('🎨 Updating stats UI...');
    
    // Update overall stats
    const totalGamesEl = document.getElementById('totalGamesPlayed');
    const totalScoreEl = document.getElementById('totalScore');
    const bestScoreEl = document.getElementById('bestScore');
    const averageDistanceEl = document.getElementById('averageDistance');

    if (totalGamesEl) totalGamesEl.textContent = this.profileData.stats.totalGames.toLocaleString();
    if (totalScoreEl) totalScoreEl.textContent = this.profileData.stats.totalScore.toLocaleString();
    if (bestScoreEl) bestScoreEl.textContent = this.profileData.stats.bestScore.toLocaleString();
    if (averageDistanceEl) {
      const avgDist = this.profileData.stats.averageDistance;
      averageDistanceEl.textContent = avgDist < 1 
        ? Math.round(avgDist * 1000) + 'm'
        : avgDist.toFixed(1) + 'km';
    }

    // Update difficulty stats
    const difficulties = ['easy', 'medium', 'hard'];
    difficulties.forEach(diff => {
      const gamesEl = document.getElementById(`${diff}Games`);
      const scoreEl = document.getElementById(`${diff}Score`);
      const averageEl = document.getElementById(`${diff}Average`);
      
      const diffData = this.profileData.stats.difficulties[diff];
      
      if (gamesEl) gamesEl.textContent = `${diffData.games} lượt`;
      if (scoreEl) scoreEl.textContent = `${diffData.score.toLocaleString()} điểm`;
      if (averageEl) averageEl.textContent = `${diffData.average}/100`;
    });

    console.log('✅ Stats UI updated');
  }

  updateRecentGamesTable() {
    const tbody = document.getElementById('recentGamesBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (this.profileData.recentGames.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 30px; opacity: 0.7;">
            <div style="font-size: 1.5rem; margin-bottom: 10px;">🎯</div>
            <div>Chưa có lượt chơi nào</div>
            <div style="font-size: 0.9rem; margin-top: 5px;">Bắt đầu chơi để xem lịch sử tại đây!</div>
          </td>
        </tr>
      `;
      return;
    }

    this.profileData.recentGames.forEach(game => {
      const row = document.createElement('tr');
      
      // Format timestamp
      const timestamp = game.timestamp ? new Date(game.timestamp).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'N/A';
      
      // Create difficulty badge
      const difficultyBadge = this.getDifficultyBadge(game.difficulty);
      
      // Format distance
      const distance = game.distance !== undefined 
        ? (game.distance < 1 ? Math.round(game.distance * 1000) + 'm' : game.distance.toFixed(1) + 'km')
        : 'N/A';
      
      row.innerHTML = `
        <td style="padding: 12px;">${timestamp}</td>
        <td style="padding: 12px; text-align: center;">${difficultyBadge}</td>
        <td style="padding: 12px; text-align: center; font-weight: bold; color: #2ecc71;">${(game.score || 0).toLocaleString()}</td>
        <td style="padding: 12px; text-align: center; color: #f39c12;">${distance}</td>
      `;
      
      tbody.appendChild(row);
    });
  }

  getDifficultyBadge(difficulty) {
    const badges = {
      easy: '<span class="badge easy" style="font-size: 0.8rem;">🟢 Dễ</span>',
      medium: '<span class="badge medium" style="font-size: 0.8rem;">🟡 TB</span>',
      hard: '<span class="badge hard" style="font-size: 0.8rem;">🔴 Khó</span>'
    };
    
    return badges[difficulty] || '<span style="opacity: 0.5;">N/A</span>';
  }

  // Settings Functions
  async updateDisplayName() {
    const newNameInput = document.getElementById('newDisplayName');
    const btn = document.getElementById('updateDisplayNameBtn');
    
    if (!newNameInput || !btn) return;
    
    const newName = newNameInput.value.trim();
    const user = firebase.auth().currentUser;
    
    if (!user) {
      this.showMessage('Bạn cần đăng nhập để thực hiện thao tác này!', 'error');
      return;
    }
    
    if (!newName) {
      this.showMessage('Vui lòng nhập tên hiển thị mới!', 'warning');
      return;
    }
    
    if (newName.length < 2 || newName.length > 20) {
      this.showMessage('Tên hiển thị phải từ 2-20 ký tự!', 'warning');
      return;
    }
    
    const validName = /^[a-zA-Z0-9\sÀ-ỹàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]+$/.test(newName);
    if (!validName) {
      this.showMessage('Tên chỉ được chứa chữ cái, số và khoảng trắng!', 'warning');
      return;
    }
    
    btn.disabled = true;
    btn.textContent = '⏳ Đang cập nhật...';
    
    try {
      // Check if name is already taken
      const usernamesRef = db.ref('usernames');
      const snapshot = await usernamesRef.child(newName).once('value');
      
      if (snapshot.exists() && snapshot.val() !== user.uid) {
        this.showMessage('Tên này đã được sử dụng. Vui lòng chọn tên khác!', 'warning');
        return;
      }
      
      // Update profile
      await user.updateProfile({ displayName: newName });
      
      // Update database
      const userRef = db.ref(`users/${user.uid}`);
      await userRef.update({
        displayName: newName,
        lastUpdated: firebase.database.ServerValue.TIMESTAMP
      });
      
      // Update usernames table
      const oldName = user.displayName;
      if (oldName && oldName !== newName) {
        await usernamesRef.child(oldName).remove();
      }
      await usernamesRef.child(newName).set(user.uid);
      
      // Update UI
      const displayElements = document.querySelectorAll('#displayName, #playerNameDisplay');
      displayElements.forEach(el => {
        if (el) el.textContent = newName;
      });
      
      const profileDisplayName = document.getElementById('profileDisplayName');
      if (profileDisplayName) {
        profileDisplayName.textContent = newName;
      }
      
      newNameInput.value = '';
      this.showMessage('Tên hiển thị đã được cập nhật thành công!', 'success');
      
    } catch (error) {
      console.error('❌ Error updating display name:', error);
      this.showMessage('Lỗi khi cập nhật tên: ' + error.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '✏️ Cập Nhật Tên';
    }
  }

  async updateEmail() {
    const newEmailInput = document.getElementById('newEmail');
    const btn = document.getElementById('updateEmailBtn');
    
    if (!newEmailInput || !btn) return;
    
    const newEmail = newEmailInput.value.trim();
    const user = firebase.auth().currentUser;
    
    if (!user) {
      this.showMessage('Bạn cần đăng nhập để thực hiện thao tác này!', 'error');
      return;
    }
    
    if (!newEmail) {
      this.showMessage('Vui lòng nhập email mới!', 'warning');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      this.showMessage('Email không hợp lệ!', 'warning');
      return;
    }
    
    if (newEmail === user.email) {
      this.showMessage('Email mới giống email hiện tại!', 'warning');
      return;
    }
    
    btn.disabled = true;
    btn.textContent = '⏳ Đang cập nhật...';
    
    try {
      await user.updateEmail(newEmail);
      await user.sendEmailVerification();
      
      // Update current email display
      const currentEmailInput = document.getElementById('currentEmail');
      const profileEmail = document.getElementById('profileEmail');
      
      if (currentEmailInput) currentEmailInput.value = newEmail;
      if (profileEmail) profileEmail.textContent = newEmail;
      
      newEmailInput.value = '';
      this.showMessage('Email đã được cập nhật! Vui lòng kiểm tra hộp thư để xác minh.', 'success');
      
    } catch (error) {
      console.error('❌ Error updating email:', error);
      let errorMessage = 'Lỗi khi cập nhật email: ';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage += 'Email này đã được sử dụng bởi tài khoản khác.';
          break;
        case 'auth/invalid-email':
          errorMessage += 'Email không hợp lệ.';
          break;
        case 'auth/requires-recent-login':
          errorMessage += 'Bạn cần đăng nhập lại để thực hiện thao tác này.';
          break;
        default:
          errorMessage += error.message;
      }
      
      this.showMessage(errorMessage, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '📧 Cập Nhật Email';
    }
  }

  async updatePassword() {
    const currentPassInput = document.getElementById('currentPassword');
    const newPassInput = document.getElementById('newPassword');
    const confirmPassInput = document.getElementById('confirmPassword');
    const btn = document.getElementById('updatePasswordBtn');
    
    if (!currentPassInput || !newPassInput || !confirmPassInput || !btn) return;
    
    const currentPass = currentPassInput.value;
    const newPass = newPassInput.value;
    const confirmPass = confirmPassInput.value;
    const user = firebase.auth().currentUser;
    
    if (!user) {
      this.showMessage('Bạn cần đăng nhập để thực hiện thao tác này!', 'error');
      return;
    }
    
    if (!currentPass || !newPass || !confirmPass) {
      this.showMessage('Vui lòng điền đầy đủ thông tin!', 'warning');
      return;
    }
    
    if (newPass !== confirmPass) {
      this.showMessage('Mật khẩu mới và xác nhận không khớp!', 'warning');
      return;
    }
    
    if (newPass.length < 6) {
      this.showMessage('Mật khẩu mới phải có ít nhất 6 ký tự!', 'warning');
      return;
    }
    
    if (newPass === currentPass) {
      this.showMessage('Mật khẩu mới giống mật khẩu hiện tại!', 'warning');
      return;
    }
    
    btn.disabled = true;
    btn.textContent = '⏳ Đang cập nhật...';
    
    try {
      // Re-authenticate user
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPass);
      await user.reauthenticateWithCredential(credential);
      
      // Update password
      await user.updatePassword(newPass);
      
      // Clear form
      currentPassInput.value = '';
      newPassInput.value = '';
      confirmPassInput.value = '';
      
      this.showMessage('Mật khẩu đã được cập nhật thành công!', 'success');
      
    } catch (error) {
      console.error('❌ Error updating password:', error);
      let errorMessage = 'Lỗi khi đổi mật khẩu: ';
      
      switch (error.code) {
        case 'auth/wrong-password':
          errorMessage += 'Mật khẩu hiện tại không đúng.';
          break;
        case 'auth/weak-password':
          errorMessage += 'Mật khẩu mới quá yếu.';
          break;
        case 'auth/requires-recent-login':
          errorMessage += 'Bạn cần đăng nhập lại để thực hiện thao tác này.';
          break;
        default:
          errorMessage += error.message;
      }
      
      this.showMessage(errorMessage, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🔐 Đổi Mật Khẩu';
    }
  }

  async deleteAccount() {
    const user = firebase.auth().currentUser;
    
    if (!user) {
      this.showMessage('Bạn cần đăng nhập để thực hiện thao tác này!', 'error');
      return;
    }
    
    const confirmMessage = `⚠️ CẢNH BÁO: Bạn sắp xóa vĩnh viễn tài khoản của mình!

Hành động này sẽ:
• Xóa tài khoản và tất cả dữ liệu
• Xóa lịch sử chơi game
• Không thể hoàn tác

Để xác nhận, vui lòng nhập chính xác: DELETE MY ACCOUNT`;
    
    const userInput = prompt(confirmMessage);
    
    if (userInput !== 'DELETE MY ACCOUNT') {
      this.showMessage('Xác nhận không chính xác. Hủy bỏ xóa tài khoản.', 'info');
      return;
    }
    
    const btn = document.getElementById('deleteAccountBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Đang xóa...';
    }
    
    try {
      const displayName = user.displayName;
      const uid = user.uid;
      
      // Delete user data from database
      const userRef = db.ref(`users/${uid}`);
      await userRef.remove();
      
      // Remove from usernames table
      if (displayName) {
        const usernamesRef = db.ref('usernames');
        await usernamesRef.child(displayName).remove();
      }
      
      // Delete the user account
      await user.delete();
      
      alert('✅ Tài khoản đã được xóa thành công. Tạm biệt!');
      window.location.reload();
      
    } catch (error) {
      console.error('❌ Error deleting account:', error);
      let errorMessage = 'Lỗi khi xóa tài khoản: ';
      
      switch (error.code) {
        case 'auth/requires-recent-login':
          errorMessage += 'Bạn cần đăng nhập lại để thực hiện thao tác này.';
          break;
        default:
          errorMessage += error.message;
      }
      
      this.showMessage(errorMessage, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🗑️ Xóa Tài Khoản';
      }
    }
  }

  showMessage(message, type = 'info', duration = 4000) {
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = `profile-message profile-message-${type}`;
    messageEl.textContent = message;
    messageEl.style.cssText = `
      position: fixed;
      top: 30px;
      right: 30px;
      padding: 15px 20px;
      border-radius: 8px;
      z-index: 10001;
      max-width: 350px;
      font-weight: 500;
      box-shadow: 0 8px 25px rgba(0,0,0,0.3);
      animation: slideInRight 0.3s ease-out;
    `;
    
    // Set colors based on type
    const colors = {
      success: { bg: 'rgba(46, 204, 113, 0.9)', border: '#2ecc71', text: 'white' },
      error: { bg: 'rgba(231, 76, 60, 0.9)', border: '#e74c3c', text: 'white' },
      warning: { bg: 'rgba(241, 196, 15, 0.9)', border: '#f1c40f', text: '#1f2f3f' },
      info: { bg: 'rgba(6, 182, 212, 0.9)', border: '#06b6d4', text: 'white' }
    };
    
    const color = colors[type] || colors.info;
    messageEl.style.background = color.bg;
    messageEl.style.border = `2px solid ${color.border}`;
    messageEl.style.color = color.text;
    
    document.body.appendChild(messageEl);
    
    // Auto remove
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
          messageEl.parentNode.removeChild(messageEl);
        }, 300);
      }
    }, duration);
  }

  // Public method to refresh profile data
  async refreshProfileData() {
    const user = firebase.auth().currentUser;
    if (user) {
      await this.loadGameStats(user);
    }
  }

  // Public method to show profile button when user is logged in
  showProfileButton() {
    const btn = document.getElementById('profileBtn');
    if (btn) {
      btn.classList.remove('hidden');
    }
  }

  // Public method to hide profile button when user is logged out
  hideProfileButton() {
    const btn = document.getElementById('profileBtn');
    if (btn) {
      btn.classList.add('hidden');
    }
    this.hideProfile();
  }
}

// Initialize profile system
let profileSystem = null;

export function initProfile() {
  profileSystem = new ProfileSystem();
  window.profileSystem = profileSystem;
  
  // Add CSS for message animations
  const messageStyles = document.createElement('style');
  messageStyles.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(messageStyles);
  
  console.log('👤 Profile system initialized successfully');
}

export function showProfileButton() {
  if (profileSystem) {
    profileSystem.showProfileButton();
  }
}

export function hideProfileButton() {
  if (profileSystem) {
    profileSystem.hideProfileButton();
  }
}

export function refreshProfileData() {
  if (profileSystem) {
    return profileSystem.refreshProfileData();
  }
}

console.log('👤 Profile module loaded successfully');