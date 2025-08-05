// main.js - Entry point and event listeners (Updated version)
import { auth } from './firebase-config.js';
import { elements } from './dom-elements.js';
import { gameState, updateGameState } from './game-state.js';
import { 
  signUp, 
  signIn, 
  signOut, 
  saveDisplayName, 
  skipDisplayName,
  postLoginSetup, 
  resetUIAfterLogout, 
  logoutUser 
} from './auth.js';
import { 
  setGameDifficulty, 
  startGame, 
  showGuessMap, 
  submitGuess, 
  resetGame, 
  viewOnGoogleMap 
} from './game.js';
import { 
  adminLogin, 
  adminLogout, 
  deleteAllScores, 
  loadAdminGuesses, 
  loadGroupedGuesses,
  loadLeaderboard 
} from './admin.js';

// Global initMap function for Google Maps callback
window.initMap = () => {
  console.log('🗺️ Google Maps API loaded successfully');
  
  // Initialize StreetViewService immediately
  if (typeof google !== 'undefined' && google.maps && google.maps.StreetViewService) {
    updateGameState({ 
      streetViewService: new google.maps.StreetViewService() 
    });
    console.log('✅ StreetViewService initialized');
  } else {
    console.error('❌ Google Maps API not properly loaded');
  }
  
  // Load leaderboard after maps is ready
  loadLeaderboard();
  
  console.log('🗺️ Google Maps initialization complete');
};

function initAuthListeners() {
  console.log('🔧 Initializing auth listeners...');
  
  if (elements.signupBtn) {
    elements.signupBtn.addEventListener("click", signUp);
    console.log('✅ Signup button listener added');
  }

  if (elements.loginBtn) {
    elements.loginBtn.addEventListener("click", signIn);
    console.log('✅ Login button listener added');
  }

  if (elements.logoutUserBtn) {
    elements.logoutUserBtn.addEventListener("click", signOut);
    console.log('✅ Logout user button listener added');
  }

  if (elements.fixedLogoutBtn) {
    elements.fixedLogoutBtn.addEventListener("click", logoutUser);
    console.log('✅ Fixed logout button listener added');
  }

  if (elements.saveDisplayNameBtn) {
    elements.saveDisplayNameBtn.addEventListener("click", saveDisplayName);
    console.log('✅ Save display name button listener added');
  }

  const skipDisplayNameBtn = document.getElementById('skipDisplayNameBtn');
  if (skipDisplayNameBtn) {
    skipDisplayNameBtn.addEventListener("click", skipDisplayName);
    console.log('✅ Skip display name button listener added');
  }

  // Enter key handler for display name input
  if (elements.displayNameInput) {
    elements.displayNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveDisplayName();
      }
    });
    console.log('✅ Display name input enter key listener added');
  }

  // Enter key handlers for auth inputs
  const authInputs = [elements.userEmail, elements.userPassword];
  authInputs.forEach((input, index) => {
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          signIn();
        }
      });
      console.log(`✅ Auth input ${index + 1} enter key listener added`);
    }
  });
}

// Game event listeners
function initGameListeners() {
  console.log('🎮 Initializing game listeners...');
  
  // Difficulty selection buttons
  const difficultyButtons = document.querySelectorAll('[data-difficulty]');
  difficultyButtons.forEach((btn, index) => {
    btn.addEventListener('click', (e) => {
      const difficulty = e.target.getAttribute('data-difficulty');
      setGameDifficulty(difficulty);
      console.log(`🎯 Difficulty set to: ${difficulty}`);
    });
    console.log(`✅ Difficulty button ${index + 1} listener added`);
  });

  // Start game button
  const startGameBtn = document.getElementById('startGameBtn');
  if (startGameBtn) {
    startGameBtn.addEventListener('click', () => {
      // Check if Google Maps is ready before starting
      if (typeof google === 'undefined' || !google.maps || !google.maps.StreetViewService) {
        alert('⚠️ Google Maps chưa được tải. Vui lòng đợi một chút và thử lại.');
        return;
      }
      startGame();
    });
    console.log('✅ Start game button listener added');
  }

  // Guess map button
  if (elements.showGuessMapBtn) {
    elements.showGuessMapBtn.addEventListener('click', showGuessMap);
    console.log('✅ Show guess map button listener added');
  }

  // Submit guess button
  if (elements.submitGuessBtn) {
    elements.submitGuessBtn.addEventListener('click', submitGuess);
    console.log('✅ Submit guess button listener added');
  }

  // View on Google Maps button
  if (elements.viewOnGoogleMapBtn) {
    elements.viewOnGoogleMapBtn.addEventListener('click', viewOnGoogleMap);
    console.log('✅ View on Google Maps button listener added');
  }

  // Replay button
  if (elements.replayBtn) {
    elements.replayBtn.addEventListener('click', resetGame);
    console.log('✅ Replay button listener added');
  }

  // Reset game button
  const resetGameBtn = document.getElementById('resetGameBtn');
  if (resetGameBtn) {
    resetGameBtn.addEventListener('click', resetGame);
    console.log('✅ Reset game button listener added');
  }
}

// Admin event listeners
function initAdminListeners() {
  console.log('🔧 Initializing admin listeners...');
  
  const adminLoginBtn = document.getElementById('adminLoginBtn');
  if (adminLoginBtn) {
    adminLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🔐 Admin login button clicked');
      adminLogin();
    });
    console.log('✅ Admin login button listener added');
  } else {
    console.log('❌ Admin login button not found');
  }

  const adminLogoutBtn = document.getElementById('adminLogoutBtn');
  if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🚪 Admin logout button clicked');
      adminLogout();
    });
    console.log('✅ Admin logout button listener added');
  } else {
    console.log('❌ Admin logout button not found');
  }

  const deleteBtn = document.getElementById('deleteBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🗑️ Delete button clicked');
      deleteAllScores();
    });
    console.log('✅ Delete button listener added');
  } else {
    console.log('❌ Delete button not found');
  }

  const loadGuessesBtn = document.getElementById('loadGuessesBtn');
  if (loadGuessesBtn) {
    loadGuessesBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('📊 Load guesses button clicked');
      loadAdminGuesses();
    });
    console.log('✅ Load guesses button listener added');
  } else {
    console.log('❌ Load guesses button not found');
  }

  const loadGroupedBtn = document.getElementById('loadGroupedBtn');
  if (loadGroupedBtn) {
    loadGroupedBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('📅 Load grouped button clicked');
      loadGroupedGuesses();
    });
    console.log('✅ Load grouped button listener added');
  } else {
    console.log('❌ Load grouped button not found');
  }

  // Enter key handlers for admin inputs
  const adminEmail = document.getElementById('adminEmail');
  const adminPassword = document.getElementById('adminPassword');
  
  if (adminEmail) {
    adminEmail.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        adminLogin();
      }
    });
    console.log('✅ Admin email enter key listener added');
  }
  
  if (adminPassword) {
    adminPassword.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        adminLogin();
      }
    });
    console.log('✅ Admin password enter key listener added');
  }
}

// Auth state change handler
function initAuthStateListener() {
  console.log('🔐 Initializing auth state listener...');
  
  // Fixed: Use firebase.auth() instead of auth
  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      if (elements.fixedLogoutBtn) {
        elements.fixedLogoutBtn.classList.remove("hidden");
      }
      console.log('🔄 User logged in:', user.email);
      await postLoginSetup(user);
    } else {
      console.log('🚪 User logged out');
      resetUIAfterLogout();
      if (elements.fixedLogoutBtn) {
        elements.fixedLogoutBtn.classList.add("hidden");
      }
    }
  });
  
  console.log('✅ Auth state listener initialized');
}

// Global function exports for HTML onclick handlers (backup)
window.setGameDifficulty = setGameDifficulty;
window.startGame = startGame;
window.showGuessMap = showGuessMap;
window.submitGuess = submitGuess;
window.resetGame = resetGame;
window.viewOnGoogleMap = viewOnGoogleMap;
window.logoutUser = logoutUser;
window.adminLogin = adminLogin;
window.adminLogout = adminLogout;
window.deleteAllScores = deleteAllScores;
window.loadAdminGuesses = loadAdminGuesses;
window.loadGroupedGuesses = loadGroupedGuesses;

// Initialize application
function initApp() {
  console.log('🚀 Initializing GeoGuesser application...');
  
  try {
    // Check if Firebase is loaded
    if (typeof firebase === 'undefined') {
      throw new Error('Firebase not loaded. Please check your script tags.');
    }
    
    // Check if all required elements exist
    const requiredElements = [
      'authContainer', 'difficultyContainer', 'gameContainer', 
      'adminLoginContainer', 'userEmail', 'userPassword'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    if (missingElements.length > 0) {
      console.warn('⚠️ Missing elements:', missingElements);
    }
    
    initAuthListeners();
    initGameListeners();
    initAdminListeners();
    initAuthStateListener();
    
    console.log('✅ Application initialized successfully');
    
    // Wait for Google Maps to be ready before loading leaderboard
    const waitForMapsAndLoadBoard = () => {
      if (typeof google !== 'undefined' && google.maps) {
        loadLeaderboard();
      } else {
        setTimeout(waitForMapsAndLoadBoard, 1000);
      }
    };
    waitForMapsAndLoadBoard();
    
  } catch (error) {
    console.error('❌ Error initializing application:', error);
    alert('Có lỗi khi khởi động ứng dụng: ' + error.message);
  }
}

// Debug function to check admin elements
function checkAdminElements() {
  const adminElements = [
    'adminLoginBtn', 'adminLogoutBtn', 'deleteBtn', 
    'loadGuessesBtn', 'loadGroupedBtn', 'adminEmail', 'adminPassword'
  ];
  
  console.log('🔍 Checking admin elements:');
  adminElements.forEach(id => {
    const element = document.getElementById(id);
    console.log(`${element ? '✅' : '❌'} ${id}:`, element);
  });
}

// Enhanced debug functions
function debugAdminElements() {
  console.log('🔍 DEBUGGING ADMIN ELEMENTS:');
  
  const adminElements = [
    'adminLoginContainer',
    'adminSection', 
    'adminEmail',
    'adminPassword',
    'adminLoginBtn',
    'adminLogoutBtn',
    'deleteBtn',
    'loadGuessesBtn',
    'loadGroupedBtn',
    'adminControls',
    'adminGuessesContainer',
    'adminHistoryGrouped',
    'adminGuessesBody'
  ];
  
  adminElements.forEach(id => {
    const element = document.getElementById(id);
    console.log(`${element ? '✅' : '❌'} ${id}:`, element);
    
    if (element) {
      console.log(`   - Display: ${getComputedStyle(element).display}`);
      console.log(`   - Visibility: ${getComputedStyle(element).visibility}`);
      console.log(`   - Classes: ${element.className}`);
    }
  });
}

function forceShowAdminElements() {
  console.log('🔧 FORCE SHOWING ADMIN ELEMENTS:');
  
  const elementsToShow = [
    'adminLogoutBtn',
    'deleteBtn', 
    'loadGuessesBtn',
    'loadGroupedBtn',
    'adminControls'
  ];
  
  elementsToShow.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.classList.remove('hidden');
      element.style.display = 'block';
      element.style.visibility = 'visible';
      console.log(`✅ Forced show: ${id}`);
    } else {
      console.log(`❌ Element not found: ${id}`);
    }
  });
}

// Global debug functions
window.debugAdminElements = debugAdminElements;
window.forceShowAdminElements = forceShowAdminElements;

// Start the application when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initApp();
    // Debug admin elements
    setTimeout(checkAdminElements, 500);
  });
} else {
  initApp();
  // Debug admin elements
  setTimeout(checkAdminElements, 500);
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && gameState.isAdminLoggedIn) {
    // Refresh admin data when page becomes visible
    loadLeaderboard();
  }
});

// Handle window beforeunload
window.addEventListener('beforeunload', (e) => {
  if (gameState.score > 0) {
    e.preventDefault();
    e.returnValue = 'Bạn có muốn rời khỏi trang? Điểm số hiện tại sẽ bị mất.';
    return e.returnValue;
  }
});

// Error handling
window.addEventListener('error', (e) => {
  console.error('❌ Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('❌ Unhandled promise rejection:', e.reason);
});

console.log('📱 Main.js loaded successfully');