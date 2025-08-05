
import { auth, db } from './firebase-config.js';
import { elements } from './dom-elements.js';
import { gameState } from './game-state.js';


const profileElements = {
  profileBtn: document.getElementById('profileBtn'),
  profileContainer: document.getElementById('profileContainer'),
  closeProfileBtn: document.getElementById('closeProfileBtn'),
  profileInfoTab: document.getElementById('profileInfoTab'),
  profileEditTab: document.getElementById('profileEditTab'),
  profileInfoContent: document.getElementById('profileInfoContent'),
  profileEditContent: document.getElementById('profileEditContent'),
  
  
  totalGamesPlayed: document.getElementById('totalGamesPlayed'),
  totalScore: document.getElementById('totalScore'),
  bestScore: document.getElementById('bestScore'),
  averageDistance: document.getElementById('averageDistance'),
  easyGames: document.getElementById('easyGames'),
  easyScore: document.getElementById('easyScore'),
  mediumGames: document.getElementById('mediumGames'),
  mediumScore: document.getElementById('mediumScore'),
  hardGames: document.getElementById('hardGames'),
  hardScore: document.getElementById('hardScore'),
  recentGamesBody: document.getElementById('recentGamesBody'),
  
  
  newDisplayName: document.getElementById('newDisplayName'),
  updateDisplayNameBtn: document.getElementById('updateDisplayNameBtn'),
  newEmail: document.getElementById('newEmail'),
  updateEmailBtn: document.getElementById('updateEmailBtn'),
  currentEmail: document.getElementById('currentEmail'),
  currentPassword: document.getElementById('currentPassword'),
  newPassword: document.getElementById('newPassword'),
  confirmPassword: document.getElementById('confirmPassword'),
  updatePasswordBtn: document.getElementById('updatePasswordBtn'),
  deleteAccountBtn: document.getElementById('deleteAccountBtn')
};


let profileData = {
  stats: {
    totalGames: 0,
    totalScore: 0,
    bestScore: 0,
    averageDistance: 0,
    difficulties: {
      easy: { games: 0, score: 0 },
      medium: { games: 0, score: 0 },
      hard: { games: 0, score: 0 }
    }
  },
  recentGames: []
};
async function updateDisplayName() {
  const newName = profileElements.newDisplayName?.value.trim();
  const user = firebase.auth().currentUser;
  
  if (!user) {
    showMessage('Bạn cần đăng nhập để thực hiện thao tác này!', 'error');
    return;
  }
  
  if (!newName) {
    showMessage('Vui lòng nhập tên hiển thị mới!', 'warning');
    return;
  }
  
  if (newName.length < 2 || newName.length > 20) {
    showMessage('Tên hiển thị phải từ 2-20 ký tự!', 'warning');
    return;
  }
  
  const validName = /^[a-zA-Z0-9\sÀ-ỹàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]+$/.test(newName);
  if (!validName) {
    showMessage('Tên chỉ được chứa chữ cái, số và khoảng trắng!', 'warning');
    return;
  }
  
  const btn = profileElements.updateDisplayNameBtn;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang cập nhật...';
  }
  
  try {
    
    const usernamesRef = db.ref('usernames');
    const snapshot = await usernamesRef.child(newName).once('value');
    
    if (snapshot.exists() && snapshot.val() !== user.uid) {
      showMessage('Tên này đã được sử dụng. Vui lòng chọn tên khác!', 'warning');
      return;
    }
    
    
    await user.updateProfile({ displayName: newName });
    
    
    const userRef = db.ref(`users/${user.uid}`);
    await userRef.update({
      displayName: newName,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP
    });
    
    
    const oldName = user.displayName;
    if (oldName && oldName !== newName) {
      await usernamesRef.child(oldName).remove();
    }
    await usernamesRef.child(newName).set(user.uid);
    
    
    const displayElements = document.querySelectorAll('#displayName, #playerNameDisplay');
    displayElements.forEach(el => {
      if (el) el.textContent = newName;
    });
    
    showMessage('Tên hiển thị đã được cập nhật thành công!', 'success');
    
    
    await loadProfileData(user);
    
  } catch (error) {
    console.error('❌ Error updating display name:', error);
    showMessage('Lỗi khi cập nhật tên: ' + error.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✏️ Cập Nhật Tên';
    }
  }
}




async function showProfile() {
  console.log('👤 Opening profile...');
  
  const user = firebase.auth().currentUser;
  if (!user) {
    alert('❌ Bạn cần đăng nhập để xem hồ sơ!');
    return;
  }
  
  
  if (elements.gameContainer) {
    elements.gameContainer.classList.add('hidden');
  }
  
  if (profileElements.profileContainer) {
    profileElements.profileContainer.classList.remove('hidden');
  }
  
  
async function loadProfileData(user) {
  console.log('📊 Loading profile data...');
  
  try {
    
    const scoresSnapshot = await db.ref('scores').orderByChild('name').equalTo(user.displayName || user.email.split('@')[0]).once('value');
    const scores = [];
    scoresSnapshot.forEach(child => {
      scores.push(child.val());
    });
    
    
    const guessesSnapshot = await db.ref('guesses').orderByChild('name').equalTo(user.displayName || user.email.split('@')[0]).once('value');
    const guesses = [];
    guessesSnapshot.forEach(child => {
      guesses.push(child.val());
    });
    
    
    calculateStats(scores, guesses);
    
    
    updateProfileUI();
    
    console.log('✅ Profile data loaded successfully');
  } catch (error) {
    console.error('❌ Error loading profile data:', error);
    showMessage('Lỗi khi tải dữ liệu hồ sơ: ' + error.message, 'error');
  }
}


function calculateStats(scores, guesses) {
  console.log(`📈 Calculating stats for ${scores.length} scores and ${guesses.length} guesses`);
  
  
  profileData.stats = {
    totalGames: 0,
    totalScore: 0,
    bestScore: 0,
    averageDistance: 0,
    difficulties: {
      easy: { games: 0, score: 0 },
      medium: { games: 0, score: 0 },
      hard: { games: 0, score: 0 }
    }
  };
  
  
  scores.forEach(score => {
    profileData.stats.totalScore += score.score || 0;
    profileData.stats.bestScore = Math.max(profileData.stats.bestScore, score.score || 0);
    
    if (score.difficulty && profileData.stats.difficulties[score.difficulty]) {
      profileData.stats.difficulties[score.difficulty].score += score.score || 0;
    }
  });
  
  
  let totalDistance = 0;
  const difficultyCount = { easy: 0, medium: 0, hard: 0 };
  
  guesses.forEach(guess => {
    profileData.stats.totalGames++;
    
    if (guess.distance !== undefined) {
      totalDistance += guess.distance;
    }
    
    if (guess.difficulty && difficultyCount[guess.difficulty] !== undefined) {
      difficultyCount[guess.difficulty]++;
      profileData.stats.difficulties[guess.difficulty].games++;
    }
  });
  
  
  profileData.stats.averageDistance = profileData.stats.totalGames > 0 
    ? totalDistance / profileData.stats.totalGames 
    : 0;
  
  
  profileData.recentGames = guesses
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 5);
  
  console.log('✅ Stats calculated:', profileData.stats);
}


function updateProfileUI() {
  console.log('🎨 Updating profile UI...');
  
  
  if (profileElements.totalGamesPlayed) {
    profileElements.totalGamesPlayed.textContent = profileData.stats.totalGames.toLocaleString();
  }
  
  if (profileElements.totalScore) {
    profileElements.totalScore.textContent = profileData.stats.totalScore.toLocaleString();
  }
  
  if (profileElements.bestScore) {
    profileElements.bestScore.textContent = profileData.stats.bestScore.toLocaleString();
  }
  
  if (profileElements.averageDistance) {
    const avgDist = profileData.stats.averageDistance;
    profileElements.averageDistance.textContent = avgDist < 1 
      ? Math.round(avgDist * 1000) + 'm'
      : avgDist.toFixed(1) + 'km';
  }
  
  
  const difficulties = ['easy', 'medium', 'hard'];
  difficulties.forEach(diff => {
    const gamesEl = profileElements[`${diff}Games`];
    const scoreEl = profileElements[`${diff}Score`];
    
    if (gamesEl) {
      gamesEl.textContent = `${profileData.stats.difficulties[diff].games} lượt`;
    }
    
    if (scoreEl) {
      scoreEl.textContent = `${profileData.stats.difficulties[diff].score.toLocaleString()} điểm`;
    }
  });
  
  
  updateRecentGamesTable();
  
  console.log('✅ Profile UI updated');
}


function updateRecentGamesTable() {
  if (!profileElements.recentGamesBody) return;
  
  profileElements.recentGamesBody.innerHTML = '';
  
  if (profileData.recentGames.length === 0) {
    profileElements.recentGamesBody.innerHTML = `
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
  
  profileData.recentGames.forEach(game => {
    const row = document.createElement('tr');
    
    
    const timestamp = game.timestamp ? new Date(game.timestamp).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'N/A';
    
    
    const difficultyBadge = getDifficultyBadge(game.difficulty);
    
    
    const distance = game.distance !== undefined 
      ? (game.distance < 1 ? Math.round(game.distance * 1000) + 'm' : game.distance.toFixed(1) + 'km')
      : 'N/A';
    
    row.innerHTML = `
      <td style="padding: 12px;">${timestamp}</td>
      <td style="padding: 12px; text-align: center;">${difficultyBadge}</td>
      <td style="padding: 12px; text-align: center; font-weight: bold; color: #2ecc71;">${(game.score || 0).toLocaleString()}</td>
      <td style="padding: 12px; text-align: center; color: #f39c12;">${distance}</td>
    `;
    
    profileElements.recentGamesBody.appendChild(row);
  });
}


function getDifficultyBadge(difficulty) {
  const badges = {
    easy: '<span class="badge green" style="font-size: 0.8rem;">🟢 Dễ</span>',
    medium: '<span class="badge yellow" style="font-size: 0.8rem;">🟡 TB</span>',
    hard: '<span class="badge red" style="font-size: 0.8rem;">🔴 Khó</span>'
  };
  
  return badges[difficulty] || '<span style="opacity: 0.5;">N/A</span>';
}





async function updateEmail() {
  const newEmailValue = profileElements.newEmail?.value.trim();
  const user = firebase.auth().currentUser;
  
  if (!user) {
    showMessage('Bạn cần đăng nhập để thực hiện thao tác này!', 'error');
    return;
  }
  
  if (!newEmailValue) {
    showMessage('Vui lòng nhập email mới!', 'warning');
    return;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmailValue)) {
    showMessage('Email không hợp lệ!', 'warning');
    return;
  }
  
  if (newEmailValue === user.email) {
    showMessage('Email mới giống email hiện tại!', 'warning');
    return;
  }
  
  const btn = profileElements.updateEmailBtn;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang cập nhật...';
  }
  
  try {
    await user.updateEmail(newEmailValue);
    
    
    await user.sendEmailVerification();
    
    
    if (profileElements.currentEmail) {
      profileElements.currentEmail.textContent = newEmailValue;
    }
    
    
    if (profileElements.newEmail) {
      profileElements.newEmail.value = '';
    }
    
    showMessage('Email đã được cập nhật! Vui lòng kiểm tra hộp thư để xác minh.', 'success');
    
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
    
    showMessage(errorMessage, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '📧 Cập Nhật Email';
    }
  }
}


async function updatePassword() {
  const currentPass = profileElements.currentPassword?.value;
  const newPass = profileElements.newPassword?.value;
  const confirmPass = profileElements.confirmPassword?.value;
  const user = firebase.auth().currentUser;
  
  if (!user) {
    showMessage('Bạn cần đăng nhập để thực hiện thao tác này!', 'error');
    return;
  }
  
  if (!currentPass || !newPass || !confirmPass) {
    showMessage('Vui lòng điền đầy đủ thông tin!', 'warning');
    return;
  }
  
  if (newPass !== confirmPass) {
    showMessage('Mật khẩu mới và xác nhận không khớp!', 'warning');
    return;
  }
  
  if (newPass.length < 6) {
    showMessage('Mật khẩu mới phải có ít nhất 6 ký tự!', 'warning');
    return;
  }
  
  if (newPass === currentPass) {
    showMessage('Mật khẩu mới giống mật khẩu hiện tại!', 'warning');
    return;
  }
  
  const btn = profileElements.updatePasswordBtn;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang cập nhật...';
  }
  
  try {
    
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPass);
    await user.reauthenticateWithCredential(credential);
    
    
    await user.updatePassword(newPass);
    
    
    if (profileElements.currentPassword) profileElements.currentPassword.value = '';
    if (profileElements.newPassword) profileElements.newPassword.value = '';
    if (profileElements.confirmPassword) profileElements.confirmPassword.value = '';
    
    showMessage('Mật khẩu đã được cập nhật thành công!', 'success');
    
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
    
    showMessage(errorMessage, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔐 Đổi Mật Khẩu';
    }
  }
}


async function deleteAccount() {
  const user = firebase.auth().currentUser;
  
  if (!user) {
    showMessage('Bạn cần đăng nhập để thực hiện thao tác này!', 'error');
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
    showMessage('Xác nhận không chính xác. Hủy bỏ xóa tài khoản.', 'info');
    return;
  }
  
  const btn = profileElements.deleteAccountBtn;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang xóa...';
  }
  
  try {
    const displayName = user.displayName;
    const uid = user.uid;
    
    
    const userRef = db.ref(`users/${uid}`);
    await userRef.remove();
    
    
    if (displayName) {
      const usernamesRef = db.ref('usernames');
      await usernamesRef.child(displayName).remove();
    }
    
    
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
    
    showMessage(errorMessage, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🗑️ Xóa Tài Khoản';
    }
  }
}


function showMessage(message, type = 'info', duration = 4000) {
  console.log(`${type.toUpperCase()}: ${message}`);
  
  
  const messageEl = document.createElement('div');
  messageEl.className = `status-${type}`;
  messageEl.textContent = message;
  messageEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    z-index: 10000;
    max-width: 350px;
    font-weight: 500;
    box-shadow: 0 8px 25px rgba(0,0,0,0.3);
  `;
  
  document.body.appendChild(messageEl);
  
  setTimeout(() => {
    if (messageEl.parentNode) {
      messageEl.parentNode.removeChild(messageEl);
    }
  }, duration);
}



}


function hideProfile() {
  console.log('👤 Closing profile...');
  
  if (profileElements.profileContainer) {
    profileElements.profileContainer.classList.add('hidden');
  }
  
  if (elements.gameContainer) {
    elements.gameContainer.classList.remove('hidden');
  }
}


function switchTab(tabName) {
  console.log(`🔄 Switching to ${tabName} tab`);
  
  
  const tabs = document.querySelectorAll('[data-tab]');
  tabs.forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  
  if (tabName === 'info') {
    profileElements.profileInfoContent?.classList.remove('hidden');
    profileElements.profileEditContent?.classList.add('hidden');
  } else if (tabName === 'edit') {
    profileElements.profileInfoContent?.classList.add('hidden');
    profileElements.profileEditContent?.classList.remove('hidden');
  }
}
export function initProfile() {
  console.log('🔧 Initializing profile functionality...');
  
  
  if (profileElements.profileBtn) {
    profileElements.profileBtn.addEventListener('click', showProfile);
  }
  
  if (profileElements.closeProfileBtn) {
    profileElements.closeProfileBtn.addEventListener('click', hideProfile);
  }
  
  
  if (profileElements.profileInfoTab) {
    profileElements.profileInfoTab.addEventListener('click', () => switchTab('info'));
  }
  
  if (profileElements.profileEditTab) {
    profileElements.profileEditTab.addEventListener('click', () => switchTab('edit'));
  }
  
  
  if (profileElements.updateDisplayNameBtn) {
    profileElements.updateDisplayNameBtn.addEventListener('click', updateDisplayName);
  }
  
  if (profileElements.updateEmailBtn) {
    profileElements.updateEmailBtn.addEventListener('click', updateEmail);
  }
  
  if (profileElements.updatePasswordBtn) {
    profileElements.updatePasswordBtn.addEventListener('click', updatePassword);
  }
  
  if (profileElements.deleteAccountBtn) {
    profileElements.deleteAccountBtn.addEventListener('click', deleteAccount);
  }
  
  console.log('✅ Profile functionality initialized');
}
