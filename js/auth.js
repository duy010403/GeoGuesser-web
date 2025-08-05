// auth.js - Fixed version
import { auth, db, ADMIN_EMAIL } from './firebase-config.js';
import { elements } from './dom-elements.js';
import { gameState, updateGameState, resetGameState } from './game-state.js';

export async function signUp() {
  const email = elements.userEmail.value.trim();
  const password = elements.userPassword.value;
  elements.authMessage.textContent = '';

  if (!email || !password) {
    elements.authMessage.textContent = "Email và mật khẩu không được để trống.";
    elements.authMessage.classList.remove('hidden');
    return;
  }

  try {
    const userCred = await firebase.auth().createUserWithEmailAndPassword(email, password);
    console.log('✅ Tạo tài khoản thành công:', userCred.user.email);

    await userCred.user.sendEmailVerification();
    alert('📧 Một email xác thực đã được gửi đến hộp thư của bạn. Vui lòng xác minh trước khi đăng nhập.');

    await firebase.auth().signOut(); // Đăng xuất ngay
  } catch (e) {
    console.error('❌ Lỗi tạo tài khoản:', e);
    elements.authMessage.textContent = getFirebaseErrorMessage(e);
    elements.authMessage.classList.remove('hidden');
  }
}


export async function signIn() {
  const email = elements.userEmail.value.trim();
  const password = elements.userPassword.value;
  elements.authMessage.textContent = '';
  elements.authMessage.classList.add('hidden');
  
  if (!email || !password) {
    elements.authMessage.textContent = "Email và mật khẩu không được để trống.";
    elements.authMessage.classList.remove('hidden');
    return;
  }
  
  try {
    // Fixed: Use Firebase v8 syntax correctly
    const userCred = await firebase.auth().signInWithEmailAndPassword(email, password);
    console.log('✅ Đăng nhập thành công:', userCred.user.email);
  } catch (e) {
    console.error('❌ Lỗi đăng nhập:', e);
    elements.authMessage.textContent = getFirebaseErrorMessage(e);
    elements.authMessage.classList.remove('hidden');
  }
  const userCred = await firebase.auth().signInWithEmailAndPassword(email, password);
const user = userCred.user;

if (!user.emailVerified) {
  await firebase.auth().signOut();
  elements.authMessage.textContent = '⚠️ Bạn cần xác minh email trước khi đăng nhập.';
  elements.authMessage.classList.remove('hidden');
  return;
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
  const user = auth.currentUser;

  if (!user || !displayName) return;

  const usernamesRef = db.ref('usernames');
  const snapshot = await usernamesRef.child(displayName).once('value');

  if (snapshot.exists()) {
    alert('⚠️ Tên hiển thị này đã được sử dụng. Vui lòng chọn tên khác!');
    elements.displayNameInput.focus();
    return;
  }

  // Nếu không trùng, tiếp tục lưu
  await user.updateProfile({ displayName });

  const userRef = db.ref(`users/${user.uid}`);
  await userRef.update({
    displayName: displayName,
    email: user.email
  });

  // Ghi thêm vào bảng usernames để khóa tên lại
  await usernamesRef.child(displayName).set(user.uid);

  alert('✅ Tên hiển thị đã được lưu!');
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
  
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Đang lưu...';
  }
  
  try {
    const user = firebase.auth().currentUser; // Fixed: Use firebase.auth()
    
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
  const user = firebase.auth().currentUser; // Fixed: Use firebase.auth()
  if (!user) return;
  
  try {
    const emailUsername = user.email.split('@')[0];
    const saveBtn = elements.saveDisplayNameBtn;
    
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
    
    elements.displayNameContainer.classList.add('hidden');
    proceedToGame(user, emailUsername);
    
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
  
 if (user.email === ADMIN_EMAIL) {
  console.log("👑 Admin đăng nhập qua user login, bật giao diện admin");
  elements.adminLoginContainer.classList.remove("hidden");
  updateGameState({ isAdminLoggedIn: true });


  setTimeout(() => {
    showAdminButtons(); 
    loadAdminGuesses();
    loadGroupedGuesses();
    loadLeaderboard();
  }, 200);
}
}
export async function postLoginSetup(user) {
  try {
    elements.authContainer.classList.add("hidden");
    
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
    elements.authMessage.textContent = 'Có lỗi xảy ra: ' + getFirebaseErrorMessage(error);
    elements.authMessage.classList.remove('hidden');
  }
  await user.reload(); // đảm bảo lấy đúng trạng thái mới nhất

}

export function resetUIAfterLogout() {
  resetGameState();
  
  elements.authContainer.classList.remove("hidden");
  elements.difficultyContainer.classList.add("hidden");
  elements.gameContainer.classList.add("hidden");
  elements.adminLoginContainer.classList.add("hidden");
  if (elements.loggedInInfo) elements.loggedInInfo.classList.add("hidden");
  
  if (elements.displayNameContainer) elements.displayNameContainer.classList.add('hidden');
  
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
  
  console.log('🔄 UI đã được reset sau đăng xuất');
}

export function logoutUser() {
  firebase.auth().signOut().then(() => { // Fixed: Use firebase.auth()
    elements.fixedLogoutBtn.classList.add("hidden");
  }).catch(error => {
    console.error('❌ Lỗi đăng xuất:', error);
    alert('Có lỗi khi đăng xuất: ' + getFirebaseErrorMessage(error));
  });
}