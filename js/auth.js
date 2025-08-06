// auth.js - Enhanced version with Profile System Integration
import { auth, db, ADMIN_EMAIL } from './firebase-config.js';
import { elements } from './dom-elements.js';
import { gameState, updateGameState, resetGameState } from './game-state.js';

// Helper function to show messages
function showMessage(element, message, type = 'info', duration = 5000) {
  element.className = `status-message status-${type}`;
  element.textContent = message;
  element.classList.remove('hidden');
  
  if (type === 'success') {
    element.classList.add('success-animation');
    setTimeout(() => element.classList.remove('success-animation'), 600);
  }
  
  if (duration > 0) {
    setTimeout(() => {
      element.classList.add('hidden');
    }, duration);
  }
}

export async function signUp() {
  const email = elements.userEmail.value.trim();
  const password = elements.userPassword.value;
  elements.authMessage.textContent = '';

  if (!email || !password) {
    showMessage(elements.authMessage, "Email và mật khẩu không được để trống.", 'error');
    return;
  }

  elements.signupBtn.disabled = true;
  elements.signupBtn.textContent = '⏳ Đang tạo...';

  try {
    const userCred = await firebase.auth().createUserWithEmailAndPassword(email, password);
    console.log('✅ Tạo tài khoản thành công:', userCred.user.email);

    // Check if this is admin - no email verification needed
    if (email === ADMIN_EMAIL) {
      console.log('👑 Admin account - skipping email verification');
      showMessage(elements.authMessage, '🎉 Admin account created successfully! You can login immediately.', 'success');
    } else {
      await userCred.user.sendEmailVerification();
      showMessage(elements.authMessage, '📧 Tài khoản đã được tạo! Vui lòng kiểm tra email để xác thực trước khi đăng nhập.', 'success', 8000);
    }

    await firebase.auth().signOut(); // Đăng xuất ngay
    elements.userEmail.value = '';
    elements.userPassword.value = '';
    
  } catch (e) {
    console.error('❌ Lỗi tạo tài khoản:', e);
    showMessage(elements.authMessage, getFirebaseErrorMessage(e), 'error');
  } finally {
    elements.signupBtn.disabled = false;
    elements.signupBtn.textContent = '🆕 Tạo tài khoản';
  }
}

export async function signIn() {
  const email = elements.userEmail.value.trim();
  const password = elements.userPassword.value;
  elements.authMessage.textContent = '';
  elements.authMessage.classList.add('hidden');
  
  if (!email || !password) {
    showMessage(elements.authMessage, "Email và mật khẩu không được để trống.", 'error');
    return;
  }

  elements.loginBtn.disabled = true;
  elements.loginBtn.textContent = '⏳ Đang đăng nhập...';
  
  try {
    const userCred = await firebase.auth().signInWithEmailAndPassword(email, password);
    const user = userCred.user;

    // Check if this is admin - bypass email verification
    if (email === ADMIN_EMAIL) {
      console.log('👑 Admin login - bypassing email verification');
      // Continue with login process regardless of email verification
    } else {
      // For regular users, check email verification
      if (!user.emailVerified) {
        await firebase.auth().signOut();
        showMessage(elements.authMessage, '⚠️ Bạn cần xác minh email trước khi đăng nhập. Kiểm tra hộp thư của bạn.', 'warning');
        
        // Show resend verification option
        showResendVerificationOption(email);
        return;
      }
    }

    console.log('✅ Đăng nhập thành công:', user.email);
    showMessage(elements.authMessage, `🎉 Đăng nhập thành công! Chào mừng ${user.displayName || user.email}`, 'success');
    
  } catch (e) {
    console.error('❌ Lỗi đăng nhập:', e);
    showMessage(elements.authMessage, getFirebaseErrorMessage(e), 'error');
  } finally {
    elements.loginBtn.disabled = false;
    elements.loginBtn.textContent = '🔐 Đăng nhập';
  }
}

export async function signOut() {
  if (confirm('🤔 Bạn có chắc muốn đăng xuất không?')) {
    try {
      await firebase.auth().signOut();
    } catch (error) {
      console.error('❌ Lỗi đăng xuất:', error);
      alert('Có lỗi khi đăng xuất: ' + getFirebaseErrorMessage(error));
    }
  }
}

// Forgot Password Functions
export function showForgotPassword() {
  const forgotContainer = document.getElementById('forgotPasswordContainer');
  const forgotLink = document.getElementById('forgotPasswordLink');
  const resetEmail = document.getElementById('resetEmail');
  const resetMessage = document.getElementById('resetMessage');
  
  if (forgotContainer && forgotLink && resetEmail) {
    forgotContainer.classList.remove('hidden');
    forgotLink.style.display = 'none';
    resetEmail.value = elements.userEmail.value; // Pre-fill if email entered
    resetEmail.focus();
    
    // Clear any previous messages
    if (resetMessage) resetMessage.classList.add('hidden');
    elements.authMessage.classList.add('hidden');
  }
}

export function hideForgotPassword() {
  const forgotContainer = document.getElementById('forgotPasswordContainer');
  const forgotLink = document.getElementById('forgotPasswordLink');
  const resetEmail = document.getElementById('resetEmail');
  const resetMessage = document.getElementById('resetMessage');
  
  if (forgotContainer && forgotLink) {
    forgotContainer.classList.add('hidden');
    forgotLink.style.display = 'inline-block';
    if (resetEmail) resetEmail.value = '';
    if (resetMessage) resetMessage.classList.add('hidden');
  }
}

export async function sendPasswordReset() {
  const resetEmail = document.getElementById('resetEmail');
  const resetMessage = document.getElementById('resetMessage');
  const sendResetBtn = document.getElementById('sendResetBtn');
  
  if (!resetEmail || !resetMessage) {
    console.error('Reset email elements not found');
    return;
  }
  
  const email = resetEmail.value.trim();
  
  if (!email) {
    showMessage(resetMessage, 'Vui lòng nhập email cần khôi phục.', 'error');
    resetEmail.focus();
    return;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showMessage(resetMessage, 'Email không hợp lệ. Vui lòng kiểm tra lại.', 'error');
    resetEmail.focus();
    return;
  }

  if (sendResetBtn) {
    sendResetBtn.disabled = true;
    sendResetBtn.textContent = '⏳ Đang gửi...';
  }

  try {
    await firebase.auth().sendPasswordResetEmail(email);
    
    showMessage(resetMessage, 
      `📧 Email khôi phục đã được gửi đến ${email}. Vui lòng kiểm tra hộp thư (kể cả thư mục spam).`, 
      'success', 0);
    
    // Auto hide form after 3 seconds
    setTimeout(() => {
      hideForgotPassword();
      showMessage(elements.authMessage, 
        '✅ Đã gửi email khôi phục thành công! Kiểm tra hộp thư của bạn.', 
        'success', 8000);
    }, 3000);
    
  } catch (error) {
    console.error('❌ Lỗi gửi email khôi phục:', error);
    
    let errorMessage = 'Có lỗi khi gửi email khôi phục: ';
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = '❌ Không tìm thấy tài khoản với email này.';
        break;
      case 'auth/invalid-email':
        errorMessage = '❌ Email không hợp lệ.';
        break;
      case 'auth/too-many-requests':
        errorMessage = '❌ Quá nhiều yêu cầu. Vui lòng thử lại sau.';
        break;
      default:
        errorMessage += getFirebaseErrorMessage(error);
    }
    
    showMessage(resetMessage, errorMessage, 'error');
    
  } finally {
    if (sendResetBtn) {
      sendResetBtn.disabled = false;
      sendResetBtn.textContent = '📧 Gửi email khôi phục';
    }
  }
}

function showResendVerificationOption(email) {
  const authMessage = elements.authMessage;
  const resendContainer = document.createElement('div');
  resendContainer.style.marginTop = '15px';
  resendContainer.innerHTML = `
    <button id="resendVerificationBtn" class="blue" style="padding: 10px 20px; font-size: 0.9rem;">
      📧 Gửi lại email xác thực
    </button>
  `;
  
  authMessage.appendChild(resendContainer);
  
  const resendBtn = document.getElementById('resendVerificationBtn');
  resendBtn.addEventListener('click', async () => {
    resendBtn.disabled = true;
    resendBtn.textContent = '⏳ Đang gửi...';
    
    try {
      // Sign in temporarily to resend verification
      const userCred = await firebase.auth().signInWithEmailAndPassword(email, elements.userPassword.value);
      await userCred.user.sendEmailVerification();
      await firebase.auth().signOut();
      
      showMessage(elements.authMessage, '📧 Email xác thực đã được gửi lại. Vui lòng kiểm tra hộp thư.', 'success');
      resendContainer.remove();
    } catch (error) {
      console.error('❌ Lỗi gửi lại email xác thực:', error);
      showMessage(elements.authMessage, 'Lỗi khi gửi lại email: ' + getFirebaseErrorMessage(error), 'error');
    } finally {
      resendBtn.disabled = false;
      resendBtn.textContent = '📧 Gửi lại email xác thực';
    }
  });
}

// Helper function to get user-friendly error messages
function getFirebaseErrorMessage(error) {
  switch (error.code) {
    case 'auth/user-not-found':
      return 'Không tìm thấy tài khoản với email này.';
    case 'auth/wrong-password':
      return 'Mật khẩu không đúng.';
    case 'auth/invalid-credential':
      return 'Email hoặc mật khẩu không đúng.';
    case 'auth/invalid-email':
      return 'Email không hợp lệ.';
    case 'auth/user-disabled':
      return 'Tài khoản đã bị vô hiệu hóa.';
    case 'auth/email-already-in-use':
      return 'Email này đã được sử dụng.';
    case 'auth/weak-password':
      return 'Mật khẩu quá yếu. Vui lòng chọn mật khẩu mạnh hơn.';
    case 'auth/network-request-failed':
      return 'Lỗi kết nối mạng. Vui lòng kiểm tra internet.';
    case 'auth/too-many-requests':
      return 'Quá nhiều lần thử. Vui lòng thử lại sau.';
    default:
      return error.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
  }
}

export async function checkUserDisplayName(user) {
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

export async function saveDisplayName() {
  const displayName = elements.displayNameInput.value.trim();
  const user = firebase.auth().currentUser;

  if (!user) {
    alert('❌ Không tìm thấy thông tin người dùng!');
    return;
  }

  if (!displayName) {
    alert('⚠️ Vui lòng nhập tên hiển thị!');
    elements.displayNameInput.focus();
    return;
  }
  
  if (displayName.length < 2) {
    alert('⚠️ Tên phải có ít nhất 2 ký tự!');
    elements.displayNameInput.focus();
    return;
  }
  
  if (displayName.length > 20) {
    alert('⚠️ Tên không được quá 20 ký tự!');
    elements.displayNameInput.focus();
    return;
  }
  
  const validName = /^[a-zA-Z0-9\sÀ-ỹàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]+$/.test(displayName);
  if (!validName) {
    alert('⚠️ Tên chỉ được chứa chữ cái, số và khoảng trắng!');
    elements.displayNameInput.focus();
    return;
  }

  const saveBtn = elements.saveDisplayNameBtn;
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Đang kiểm tra...';
  }

  try {
    // Kiểm tra trùng lặp tên hiển thị
    const usernamesRef = db.ref('usernames');
    const snapshot = await usernamesRef.child(displayName).once('value');

    if (snapshot.exists() && snapshot.val() !== user.uid) {
      alert('⚠️ Tên hiển thị này đã được sử dụng. Vui lòng chọn tên khác!');
      elements.displayNameInput.focus();
      return;
    }

    if (saveBtn) {
      saveBtn.textContent = '⏳ Đang lưu...';
    }

    // Lưu displayName vào Firebase Auth profile
    await user.updateProfile({
      displayName: displayName
    });
    
    // Lưu vào database
    const userRef = db.ref(`users/${user.uid}`);
    await userRef.update({
      displayName: displayName,
      email: user.email,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP
    });

    // Lưu vào bảng usernames để tránh trùng lặp
    await usernamesRef.child(displayName).set(user.uid);
    
    console.log('✅ Đã lưu displayName thành công:', displayName);
    
    alert(`🎉 Chào mừng ${displayName}! Hãy bắt đầu chơi!`);
    
    elements.displayNameContainer.classList.add('hidden');
    proceedToGame(user, displayName);
    
  } catch (error) {
    console.error('❌ Lỗi lưu displayName:', error);
    alert('❌ Có lỗi khi lưu tên: ' + getFirebaseErrorMessage(error));
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = '✅ Lưu và tiếp tục';
    }
  }
}

export async function skipDisplayName() {
  const user = firebase.auth().currentUser;
  if (!user) return;
  
  try {
    const emailUsername = user.email.split('@')[0];
    let finalUsername = emailUsername;
    let counter = 1;

    const saveBtn = elements.saveDisplayNameBtn;
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ Đang tạo tên...';
    }

    // Kiểm tra trùng lặp và tạo tên duy nhất
    const usernamesRef = db.ref('usernames');
    while (true) {
      const snapshot = await usernamesRef.child(finalUsername).once('value');
      if (!snapshot.exists()) {
        break; // Tên này chưa được sử dụng
      }
      counter++;
      finalUsername = `${emailUsername}${counter}`;
    }
    
    await user.updateProfile({
      displayName: finalUsername
    });
    
    const userRef = db.ref(`users/${user.uid}`);
    await userRef.update({
      displayName: finalUsername,
      email: user.email,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP
    });

    // Lưu vào bảng usernames
    await usernamesRef.child(finalUsername).set(user.uid);
    
    console.log('✅ Đã tạo username tự động:', finalUsername);
    
    elements.displayNameContainer.classList.add('hidden');
    proceedToGame(user, finalUsername);
    
  } catch (error) {
    console.error('❌ Lỗi skip displayName:', error);
    alert('❌ Có lỗi: ' + getFirebaseErrorMessage(error));
  }
}

export function showDisplayNameForm() {
  elements.authContainer.classList.add('hidden');
  elements.difficultyContainer.classList.add('hidden');
  elements.gameContainer.classList.add('hidden');
  if (elements.loggedInInfo) elements.loggedInInfo.classList.add('hidden');
  
  if (elements.displayNameContainer) {
    elements.displayNameContainer.classList.remove('hidden');
    
    if (elements.displayNameInput) {
      elements.displayNameInput.value = '';
      elements.displayNameInput.focus();
      elements.displayNameInput.removeEventListener('keypress', handleEnterKey);
      elements.displayNameInput.addEventListener('keypress', handleEnterKey);
    }
  }
}

function handleEnterKey(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveDisplayName();
  }
}

export async function proceedToGame(user, displayName) {
  updateGameState({ playerName: displayName });
  
  const displayElements = document.querySelectorAll('#displayName, #playerNameDisplay');
  displayElements.forEach(el => {
    if (el) el.textContent = displayName;
  });
  
  if (elements.loggedInInfo) elements.loggedInInfo.classList.remove('hidden');
  
  elements.difficultyContainer.classList.remove('hidden');
  
  // Import game module to set difficulty
  const { setGameDifficulty } = await import('./game.js');
  setGameDifficulty('easy');
  
  // PROFILE SYSTEM INTEGRATION - Show profile button after successful login
  try {
    const { showProfileButton } = await import('./profile.js');
    showProfileButton();
    console.log('👤 Profile button shown after login');
  } catch (error) {
    console.warn('⚠️ Could not load profile module:', error);
  }
  
  // Check if user is admin - NO SEPARATE LOGIN NEEDED
  if (user.email === ADMIN_EMAIL) {
    console.log("👑 Admin user detected - enabling admin features automatically");
    elements.adminLoginContainer.classList.remove("hidden");
    updateGameState({ isAdminLoggedIn: true });

    // Import admin functions and enable them automatically
    const { loadGroupedGuesses, loadLeaderboard } = await import('./admin.js');

    // Show admin buttons immediately - no separate login required
    setTimeout(() => {
      const adminButtons = ['adminLogoutBtn', 'deleteBtn', 'loadGroupedBtn'];
      adminButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.classList.remove('hidden');
          btn.style.display = 'inline-block';
        }
      });
      
      // Show admin welcome message
      const adminContainer = document.getElementById('adminLoginContainer');
      if (adminContainer) {
        const welcomeMsg = document.createElement('div');
        welcomeMsg.innerHTML = `
          <div style="background: rgba(46, 204, 113, 0.1); padding: 20px; border-radius: 12px; margin-bottom: 25px; border-left: 4px solid #2ecc71;">
            <h4 style="margin: 0 0 10px 0; color: #2ecc71; font-size: 1.3rem;">👑 Admin Panel</h4>
            <p style="margin: 0; color: #eef2f7; font-size: 1rem;">Chào mừng <strong>${displayName}</strong>! Các tính năng admin đã được kích hoạt.</p>
            <p style="margin: 8px 0 0 0; color: #95a5a6; font-size: 0.9rem;">Bạn có thể chơi game bình thường và sử dụng các công cụ quản trị.</p>
          </div>
        `;
        adminContainer.insertBefore(welcomeMsg, adminContainer.firstChild);
      }
      
      // Load admin data automatically (only the statistics)
      loadGroupedGuesses();
      loadLeaderboard();
    }, 500);
  }
}

export async function postLoginSetup(user) {
  try {
    elements.authContainer.classList.add("hidden");
    
    // Reload user để đảm bảo lấy thông tin mới nhất
    await user.reload();
    
    const hasDisplayName = await checkUserDisplayName(user);
    
    if (hasDisplayName) {
      console.log('✅ User đã có displayName:', hasDisplayName);
      proceedToGame(user, hasDisplayName);
      
      // PROFILE SYSTEM INTEGRATION - Load profile data after successful login setup
      try {
        const { refreshProfileData } = await import('./profile.js');
        setTimeout(() => {
          refreshProfileData();
          console.log('👤 Profile data refreshed after login');
        }, 1000);
      } catch (error) {
        console.warn('⚠️ Could not refresh profile data:', error);
      }
    } else {
      console.log('📝 User chưa có displayName, hiển thị form đặt tên');
      showDisplayNameForm();
    }
  } catch (error) {
    console.error('❌ Lỗi trong postLoginSetup:', error);
    showMessage(elements.authMessage, 'Có lỗi xảy ra: ' + getFirebaseErrorMessage(error), 'error');
  }
}

export function resetUIAfterLogout() {
  resetGameState();
  
  elements.authContainer.classList.remove("hidden");
  elements.difficultyContainer.classList.add("hidden");
  elements.gameContainer.classList.add("hidden");
  elements.adminLoginContainer.classList.add("hidden");
  if (elements.loggedInInfo) elements.loggedInInfo.classList.add("hidden");
  
  if (elements.displayNameContainer) elements.displayNameContainer.classList.add('hidden');
  
  // Reset forgot password UI
  hideForgotPassword();
  
  if (elements.userEmail) elements.userEmail.value = '';
  if (elements.userPassword) elements.userPassword.value = '';
  if (elements.authMessage) {
    elements.authMessage.textContent = '';
    elements.authMessage.classList.add('hidden');
  }
  
  if (elements.score) elements.score.textContent = '0';
  if (elements.result) elements.result.classList.add('hidden');
  
  if (gameState.guessMarker) gameState.guessMarker.setMap(null);
  if (gameState.actualMarker) gameState.actualMarker.setMap(null);
  
  // PROFILE SYSTEM INTEGRATION - Hide profile button after logout
  try {
    const { hideProfileButton } = require('./profile.js');
    hideProfileButton();
    console.log('👤 Profile button hidden after logout');
  } catch (error) {
    // Profile module might not be loaded yet, try with import
    import('./profile.js').then(({ hideProfileButton }) => {
      hideProfileButton();
      console.log('👤 Profile button hidden after logout (async)');
    }).catch(err => {
      console.warn('⚠️ Could not hide profile button:', err);
    });
  }
  
  console.log('🔄 UI đã được reset sau đăng xuất');
}

export function logoutUser() {
  firebase.auth().signOut().then(() => {
    elements.fixedLogoutBtn.classList.add("hidden");
  }).catch(error => {
    console.error('❌ Lỗi đăng xuất:', error);
    alert('Có lỗi khi đăng xuất: ' + getFirebaseErrorMessage(error));
  });
}

console.log('🔐 Enhanced auth module loaded with Profile System integration');