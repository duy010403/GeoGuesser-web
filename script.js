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

// NEW: Silent AI Vision Analysis with Real OCR & YOLO
let visionAnalyzer = null;
let preloadedLocations = {
  easy: [],
  medium: [],
  hard: []
};
let isPreloading = false;

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

// NEW: Silent Vision Analysis Service with Real Tesseract OCR & YOLO
class SilentVisionAnalyzer {
  constructor() {
    this.isInitialized = false;
    this.ocrWorker = null;
    this.yoloModel = null;
    this.isOCRReady = false;
    this.isYOLOReady = false;
    this.initPromise = null;
    this.analysisCache = new Map();
  }

  async initialize() {
    if (this.initPromise) return this.initPromise;
    if (this.isInitialized) return;
    
    this.initPromise = this.performSilentInitialization();
    return this.initPromise;
  }

  async performSilentInitialization() {
    try {
      // Initialize both OCR and YOLO silently in parallel
      await Promise.allSettled([
        this.initializeOCRSilently(),
        this.initializeYOLOSilently()
      ]);
      
      this.isInitialized = this.isOCRReady || this.isYOLOReady; // At least one should work
      
    } catch (error) {
      this.isInitialized = false;
    }
  }

  async initializeOCRSilently() {
    try {
      // Load Tesseract.js if not already loaded
      if (typeof Tesseract === 'undefined') {
        await this.loadScriptSilently('https://cdn.jsdelivr.net/npm/tesseract.js@5.0.0/dist/tesseract.min.js');
      }
      
      // Create OCR worker with silent configuration
      this.ocrWorker = await Tesseract.createWorker(['eng', 'vie'], 1, {
        logger: () => {}, // Completely silent
        errorHandler: () => {} // Silent error handling
      });
      
      // Optimize OCR for street signs and text recognition
      await this.ocrWorker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .-/ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂưăạảấầẩẫậắằẳẵặẹẻẽếềể',
        tessedit_pageseg_mode: '6', // Single uniform block
        preserve_interword_spaces: '1',
        tessedit_do_invert: '0'
      });
      
      this.isOCRReady = true;
      
    } catch (error) {
      this.isOCRReady = false;
    }
  }

  async initializeYOLOSilently() {
    try {
      // Load TensorFlow.js and COCO-SSD silently
      if (typeof tf === 'undefined') {
        await this.loadScriptSilently('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js');
      }
      if (typeof cocoSsd === 'undefined') {
        await this.loadScriptSilently('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js');
      }
      
      // Load COCO-SSD model silently
      this.yoloModel = await cocoSsd.load({
        modelUrl: 'https://tfhub.dev/tensorflow/tfjs-model/ssd_mobilenet_v2/1/default/1',
        base: 'mobilenet_v2'
      });
      
      this.isYOLOReady = true;
      
    } catch (error) {
      this.isYOLOReady = false;
    }
  }

  async loadScriptSilently(src) {
    return new Promise((resolve) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = resolve; // Don't reject, just continue
      script.async = true;
      document.head.appendChild(script);
    });
  }

 async analyzeStreetViewImage(panoData) {
  if (!this.isInitialized) {
    return this.fallbackAnalysis(panoData);
  }

  // Check cache first
  const cacheKey = panoData.location?.pano;
  if (cacheKey && this.analysisCache.has(cacheKey)) {
    return this.analysisCache.get(cacheKey);
  }

  try {
    const imageCanvas = await this.captureStreetViewImageSilently(panoData);
    if (!imageCanvas) {
      return this.fallbackAnalysis(panoData);
    }

    // Run OCR and YOLO analysis silently in parallel
    const [ocrResult, yoloResult] = await Promise.allSettled([
      this.runSilentOCR(imageCanvas),
      this.runSilentYOLO(imageCanvas)
    ]);

    // ✅ Log kết quả OCR để kiểm tra
    if (ocrResult.status === 'fulfilled' && ocrResult.value?.text) {
      console.log("🔹 OCR kết quả:", ocrResult.value.text);

      // Hiển thị lên UI để dễ quan sát
      const resultEl = document.getElementById('result');
      if (resultEl) {
        resultEl.textContent = "🔹 OCR: " + 
          ocrResult.value.text.slice(0, 100) + // chỉ hiển thị 100 ký tự đầu
          (ocrResult.value.text.length > 100 ? "..." : "");
        resultEl.classList.remove('hidden');
      }
    } else {
      console.warn("⚠️ OCR không có kết quả hoặc thất bại");
    }

    const analysis = this.combineAnalysisResults(
      ocrResult.status === 'fulfilled' ? ocrResult.value : null,
      yoloResult.status === 'fulfilled' ? yoloResult.value : null,
      panoData
    );

    // Cache the result
    if (cacheKey) {
      this.analysisCache.set(cacheKey, analysis);
    }

    return analysis;

  } catch (error) {
    console.error("❌ Lỗi khi phân tích Street View:", error);
    return this.fallbackAnalysis(panoData);
  }
}


  async captureStreetViewImageSilently(panoData) {
    try {
      // Create hidden canvas for image capture
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      canvas.style.position = 'absolute';
      canvas.style.left = '-9999px';
      canvas.style.top = '-9999px';
      canvas.style.visibility = 'hidden';
      document.body.appendChild(canvas);

      // Create temporary Street View panorama
      const tempDiv = document.createElement('div');
      tempDiv.style.width = '640px';
      tempDiv.style.height = '480px';
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '-9999px';
      tempDiv.style.visibility = 'hidden';
      document.body.appendChild(tempDiv);

      const tempPano = new google.maps.StreetViewPanorama(tempDiv, {
        position: panoData.location.latLng,
        pov: { heading: 0, pitch: 0 },
        zoom: 1,
        addressControl: false,
        linksControl: false,
        panControl: false,
        zoomControl: false,
        fullscreenControl: false,
        motionTracking: false,
        motionTrackingControl: false,
        visible: false
      });

      // Wait for panorama to load
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 2000); // Max 2 seconds
        tempPano.addListener('pano_changed', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      // Capture multiple angles for better analysis
      const ctx = canvas.getContext('2d');
      const angles = [0, 90, 180, 270]; // 4 directions
      let bestImage = null;
      
      for (const angle of angles) {
        tempPano.setPov({ heading: angle, pitch: 0 });
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Create image from Street View
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        ctx.putImageData(imageData, 0, 0);
        
        if (!bestImage) bestImage = canvas;
      }

      // Clean up
      document.body.removeChild(canvas);
      document.body.removeChild(tempDiv);
      
      return bestImage;

    } catch (error) {
      return null;
    }
  }

  async runSilentOCR(canvas) {
    if (!this.isOCRReady || !this.ocrWorker) {
      return { confidence: 0, text: '', words: [], lines: [] };
    }

    try {
      // Use recognize with timeout
      const ocrPromise = this.ocrWorker.recognize(canvas);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OCR timeout')), 5000)
      );
      
      const { data } = await Promise.race([ocrPromise, timeoutPromise]);
      
      return {
        confidence: data.confidence || 0,
        text: data.text || '',
        words: data.words || [],
        lines: data.lines || []
      };

    } catch (error) {
      return { confidence: 0, text: '', words: [], lines: [] };
    }
  }

  async runSilentYOLO(canvas) {
    if (!this.isYOLOReady || !this.yoloModel) {
      return [];
    }

    try {
      // Use detect with timeout
      const yoloPromise = this.yoloModel.detect(canvas, 10); // Max 10 predictions
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('YOLO timeout')), 3000)
      );
      
      const predictions = await Promise.race([yoloPromise, timeoutPromise]);
      return predictions || [];

    } catch (error) {
      return [];
    }
  }

  combineAnalysisResults(ocrData, yoloData, panoData) {
    const analysis = {
      // OCR-based features (text analysis)
      hasStreetSigns: false,
      hasStreetNames: false,
      hasBusinessSigns: false,
      hasNumberPlates: false,
      hasDirectionalSigns: false,
      textDensity: 0,
      textConfidence: 0,
      readableTextCount: 0,
      
      // YOLO-based features (object detection)
      hasVehicles: false,
      hasBuildings: false,
      hasPeople: false,
      hasTrafficLights: false,
      hasStopSigns: false,
      hasMotorcycles: false,
      hasBuses: false,
      
      // Combined analysis
      isUrban: false,
      difficultyScore: 0,
      identifiableFeatures: 0,
      confidenceLevel: 0
    };

    // Process OCR results for detailed text analysis
    if (ocrData && ocrData.confidence > 20) {
      analysis.textConfidence = ocrData.confidence;
      analysis.readableTextCount = ocrData.words.filter(w => w.confidence > 60).length;
      analysis.textDensity = Math.min(analysis.readableTextCount / 30, 1);
      
      const fullText = ocrData.text.toLowerCase();
      const highConfidenceText = ocrData.words
        .filter(w => w.confidence > 70)
        .map(w => w.text.toLowerCase())
        .join(' ');
      
      // Enhanced street sign detection
      analysis.hasStreetSigns = /street|road|avenue|boulevard|lane|drive|way|st\.|rd\.|ave\.|blvd\.|đường|phố|lộ|hẻm/.test(fullText) ||
                                /exit|entrance|one way|no entry|speed limit|\d+\s*mph|\d+\s*km\/h/.test(fullText);
      
      // Street name detection (specific patterns)
      analysis.hasStreetNames = /\b[A-Z][a-zA-Z]+ (street|road|avenue|st|rd|ave|đường|phố)\b/i.test(ocrData.text) ||
                               /\b(đường|phố|lộ) [A-Z][a-zA-Z]+/i.test(ocrData.text);
      
      // Business sign detection (comprehensive)
      analysis.hasBusinessSigns = /shop|store|market|cafe|restaurant|hotel|bank|mall|center|company|office|pharmacy|hospital|school|university/.test(fullText) ||
                                 /cửa hàng|nhà hàng|khách sạn|ngân hàng|trung tâm|công ty|văn phòng|bệnh viện|trường/.test(fullText);
      
      // Number plate and vehicle ID detection
      analysis.hasNumberPlates = /\b\d{2,4}[A-Z]{1,3}\d{0,4}\b|\b[A-Z]{1,3}\d{2,4}[A-Z]?\b/.test(ocrData.text);
      
      // Directional and informational signs
      analysis.hasDirectionalSigns = /north|south|east|west|left|right|ahead|exit|entrance|↑|↓|←|→/.test(fullText) ||
                                    /bắc|nam|đông|tây|trái|phải|thẳng|lối ra|lối vào/.test(fullText);
    }

    // Process YOLO results for object detection
    if (yoloData && yoloData.length > 0) {
      const objectCounts = {};
      yoloData.forEach(pred => {
        if (pred.score > 0.3) { // Only high-confidence predictions
          const className = pred.class.toLowerCase();
          objectCounts[className] = (objectCounts[className] || 0) + 1;
          
          // Vehicle detection
          if (['car', 'truck', 'bus'].includes(className)) {
            analysis.hasVehicles = true;
            if (className === 'bus') analysis.hasBuses = true;
          }
          if (['motorcycle', 'bicycle'].includes(className)) {
            analysis.hasMotorcycles = true;
            analysis.hasVehicles = true;
          }
          
          // People detection
          if (['person'].includes(className)) {
            analysis.hasPeople = true;
          }
          
          // Traffic infrastructure
          if (['traffic light'].includes(className)) {
            analysis.hasTrafficLights = true;
          }
          if (['stop sign'].includes(className)) {
            analysis.hasStopSigns = true;
          }
        }
      });
      
      // Infer buildings from object density and context
      const totalObjects = yoloData.length;
      analysis.hasBuildings = totalObjects > 5 || analysis.hasBusinessSigns || analysis.hasTrafficLights;
    }

    // Combine with panorama metadata
    const links = panoData.links || [];
    const linkCount = links.length;
    
    // Enhanced urban classification
    analysis.isUrban = (
      linkCount >= 3 || 
      analysis.hasStreetSigns || 
      analysis.hasTrafficLights ||
      analysis.hasBusinessSigns ||
      (analysis.hasVehicles && analysis.textDensity > 0.2) ||
      analysis.readableTextCount > 10
    );

    // Count all identifiable features
    analysis.identifiableFeatures = [
      analysis.hasStreetSigns,
      analysis.hasStreetNames,
      analysis.hasBusinessSigns,
      analysis.hasNumberPlates,
      analysis.hasDirectionalSigns,
      analysis.hasVehicles,
      analysis.hasBuildings,
      analysis.hasTrafficLights,
      analysis.hasStopSigns,
      analysis.hasPeople,
      analysis.textDensity > 0.3,
      linkCount >= 3
    ].filter(Boolean).length;

    // Calculate comprehensive difficulty score
    analysis.difficultyScore = this.calculateEnhancedDifficultyScore(analysis, linkCount);
    
    // Calculate overall confidence level
    analysis.confidenceLevel = this.calculateConfidenceLevel(analysis, ocrData, yoloData);

    return analysis;
  }

  calculateEnhancedDifficultyScore(analysis, linkCount) {
    let score = 0;
    
    // EASY indicators (high identifiability = easier)
    if (analysis.hasStreetNames) score += 30;
    if (analysis.hasStreetSigns) score += 25;
    if (analysis.hasBusinessSigns) score += 20;
    if (analysis.hasDirectionalSigns) score += 15;
    if (analysis.hasNumberPlates) score += 15;
    if (analysis.hasTrafficLights) score += 10;
    if (analysis.textDensity > 0.5) score += 25;
    if (analysis.textConfidence > 70) score += 20;
    if (analysis.identifiableFeatures >= 6) score += 30;
    if (linkCount >= 4) score += 15;
    if (analysis.readableTextCount > 15) score += 20;
    
    // MEDIUM indicators (some identifiable features)
    if (analysis.hasVehicles && !analysis.hasStreetNames) score += 35;
    if (analysis.hasBuildings && !analysis.hasBusinessSigns) score += 30;
    if (analysis.hasPeople && analysis.textDensity < 0.3) score += 25;
    if (analysis.isUrban && analysis.identifiableFeatures < 4) score += 40;
    if (linkCount === 2 || linkCount === 3) score += 25;
    if (analysis.textDensity > 0.2 && analysis.textDensity < 0.5) score += 30;
    
    // HARD indicators (low identifiability = harder)
    if (analysis.identifiableFeatures <= 2) score += 80;
    if (!analysis.isUrban) score += 70;
    if (linkCount <= 1) score += 60;
    if (analysis.textDensity < 0.1) score += 50;
    if (!analysis.hasVehicles && !analysis.hasBuildings && !analysis.hasPeople) score += 40;
    if (analysis.textConfidence < 30) score += 35;
    if (analysis.readableTextCount < 3) score += 30;
    
    return Math.min(Math.max(score, 0), 100);
  }

  calculateConfidenceLevel(analysis, ocrData, yoloData) {
    let confidence = 0;
    
    // OCR confidence contribution
    if (ocrData && this.isOCRReady) {
      confidence += (ocrData.confidence / 100) * 0.4;
    }
    
    // YOLO confidence contribution
    if (yoloData && this.isYOLOReady && yoloData.length > 0) {
      const avgYoloConfidence = yoloData.reduce((sum, pred) => sum + pred.score, 0) / yoloData.length;
      confidence += avgYoloConfidence * 0.3;
    }
    
    // Feature detection confidence
    confidence += (analysis.identifiableFeatures / 12) * 0.3;
    
    return Math.min(confidence, 1);
  }

  fallbackAnalysis(panoData) {
    const links = panoData?.links || [];
    const linkCount = links.length;
    
    return {
      hasStreetSigns: linkCount >= 2 && Math.random() > 0.5,
      hasStreetNames: linkCount >= 3 && Math.random() > 0.7,
      hasBusinessSigns: linkCount >= 3 && Math.random() > 0.6,
      hasVehicles: Math.random() > 0.5,
      hasBuildings: linkCount >= 2,
      hasNumberPlates: Math.random() > 0.8,
      hasDirectionalSigns: linkCount >= 2 && Math.random() > 0.6,
      textDensity: Math.min(linkCount / 8, 1),
      textConfidence: 30 + Math.random() * 40,
      isUrban: linkCount >= 3,
      identifiableFeatures: Math.min(linkCount + Math.floor(Math.random() * 3), 8),
      difficultyScore: this.getFallbackDifficultyScore(linkCount),
      confidenceLevel: 0.3
    };
  }

  getFallbackDifficultyScore(linkCount) {
    if (linkCount <= 1) return 70 + Math.random() * 25;
    if (linkCount >= 4) return 15 + Math.random() * 40;
    return 35 + Math.random() * 35;
  }

  // Check if location meets difficulty requirements
  isLocationSuitableForDifficulty(analysis, level) {
    switch(level) {
      case 'easy':
        // Easy: Bán kính 10km, có biển báo/tên đường/toà nhà cụ thể
        return (
          (analysis.hasStreetSigns || analysis.hasStreetNames) &&
          (analysis.hasBusinessSigns || analysis.hasBuildings) &&
          analysis.isUrban &&
          analysis.identifiableFeatures >= 4 &&
          analysis.difficultyScore >= 60
        );
        
      case 'medium':
        // Medium: Châu Á, có ít nhất một điều kiện ngẫu nhiên
        return (
          (analysis.hasVehicles || analysis.hasBuildings || analysis.hasStreetSigns || analysis.hasPeople) &&
          analysis.identifiableFeatures >= 2 &&
          analysis.difficultyScore >= 25 &&
          analysis.difficultyScore <= 75
        );
        
      case 'hard':
        // Hard: Toàn cầu, ít thông tin nhận dạng
        return (
          analysis.identifiableFeatures <= 3 &&
          analysis.difficultyScore <= 50
        );
        
      default:
        return true;
    }
  }

  // Clean up resources
  async terminate() {
    try {
      if (this.ocrWorker) {
        await this.ocrWorker.terminate();
        this.ocrWorker = null;
      }
    } catch (error) {
      // Silent cleanup
    }
    
    this.yoloModel = null;
    this.isInitialized = false;
    this.isOCRReady = false;
    this.isYOLOReady = false;
    this.analysisCache.clear();
  }
}

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

// UPDATED: Function chính để xử lý sau khi đăng nhập
async function postLoginSetup(user) {
  try {
    authContainer.classList.add("hidden");
    
    // NEW: Initialize silent AI vision analyzer in background
    if (!visionAnalyzer) {
      visionAnalyzer = new SilentVisionAnalyzer();
      // Start initialization silently - don't wait for it
      visionAnalyzer.initialize().catch(() => {});
    }
    
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

// UPDATED: Game difficulty with AI preloading
function setGameDifficulty(level) {
  currentDifficulty = level;
  if (currentDifficultyBadge) {
    currentDifficultyBadge.textContent = level.toUpperCase();
    currentDifficultyBadge.className = "badge"; // reset
    if (level === 'easy') currentDifficultyBadge.classList.add("green");
    else if (level === 'medium') currentDifficultyBadge.classList.add("yellow");
    else if (level === 'hard') currentDifficultyBadge.classList.add("red");
  }
  
  // NEW: Start silent preloading for selected difficulty
  if (visionAnalyzer && visionAnalyzer.isInitialized) {
    getUserLocation().then(userLocation => {
      silentPreloadLocations(level, userLocation);
    });
  }
}

// UPDATED: Start game with AI
function startGame() {
  if (!playerName) {
    alert("Vui lòng đăng nhập trước.");
    return;
  }
  difficultyContainer.classList.add("hidden");
  gameContainer.classList.remove("hidden");
  
  // NEW: Use AI-enhanced location generation
  if (visionAnalyzer && visionAnalyzer.isInitialized) {
    generateNewLocationWithAI(currentDifficulty);
  } else {
    // Fallback to original method
    generateNewLocation(currentDifficulty);
  }
}

// NEW: AI-enhanced location generation
async function generateNewLocationWithAI(level) {
  const userLocation = await getUserLocation();
  
  // If we have preloaded locations for this difficulty, use them
  if (preloadedLocations[level].length > 0) {
    const selectedLocation = preloadedLocations[level].shift();
    displayLocation(selectedLocation);
    
    // Preload more locations in background
    silentPreloadLocations(level, userLocation);
    return;
  }
  
  // Otherwise, find and analyze locations
  await findAndAnalyzeLocation(level, userLocation);
}

// NEW: Silent background preloading
async function silentPreloadLocations(level, userLocation) {
  if (isPreloading) return;
  isPreloading = true;
  
  try {
    const locationsNeeded = 3 - preloadedLocations[level].length;
    const promises = [];
    
    for (let i = 0; i < Math.min(locationsNeeded, 2); i++) {
      promises.push(findAndAnalyzeLocation(level, userLocation, true));
    }
    
    const results = await Promise.allSettled(promises);
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        preloadedLocations[level].push(result.value);
      }
    });
  } catch (error) {
    console.warn('Silent preload error:', error);
  } finally {
    isPreloading = false;
  }
}

// NEW: Find and analyze location with AI
async function findAndAnalyzeLocation(level, userLocation, isPreloading = false) {
  const maxTries = 12;
  let tries = 0;
  
  async function tryFind() {
    tries++;
    
    const coord = generateCoordinateForLevel(level, userLocation, tries);
    const searchRadius = getSearchRadiusForLevel(level);
    
    return new Promise((resolve) => {
      streetViewService.getPanorama({ 
        location: coord, 
        radius: searchRadius,
        source: google.maps.StreetViewSource.OUTDOOR
      }, async (data, status) => {
        
        if (status === google.maps.StreetViewStatus.OK) {
          // NEW: Silent AI analysis
          const analysis = await visionAnalyzer.analyzeStreetViewImage(data);

          
          // Check if location matches difficulty requirements
          if (isLocationSuitableForDifficulty(analysis, level)) {
            const locationData = {
              position: data.location.latLng,
              panoId: data.location.pano,
              analysis: analysis,
              difficulty: level,
              data: data
            };
            
            if (isPreloading) {
              resolve(locationData);
            } else {
              displayLocation(locationData);
              resolve(true);
            }
            return;
          }
        }
        
        // Try again if not suitable or failed
        if (tries < maxTries) {
          setTimeout(() => tryFind().then(resolve), 300);
        } else {
          // Fallback to original method
          if (!isPreloading) {
            generateNewLocation(level);
          }
          resolve(null);
        }
      });
    });
  }
  
  return tryFind();
}

// NEW: Check if location is suitable for difficulty level
function isLocationSuitableForDifficulty(analysis, level) {
  switch(level) {
    case 'easy':
      // Easy: Must have street signs/names and urban features
      return (analysis.hasStreetSigns || analysis.hasStreetNames) && 
             analysis.isUrban && 
             analysis.difficultyScore >= 50;
      
    case 'medium':
      // Medium: Should have some features but not too obvious
      return (analysis.hasVehicles || analysis.hasBuildings) && 
             analysis.difficultyScore >= 30 && 
             analysis.difficultyScore <= 70;
      
    case 'hard':
      // Hard: Minimal features, low urban score
      return analysis.difficultyScore <= 40;
      
    default:
      return true; // Fallback
  }
}

// NEW: Generate coordinates based on difficulty level
function generateCoordinateForLevel(level, userLocation, tries) {
  switch(level) {
    case 'easy':
      // Easy: Within 10km of user
      const radius = tries > 8 ? 15 : 10; // Expand if many tries
      return getRandomNearbyCoords(userLocation, radius);
      
    case 'medium':
      // Medium: Asia region
      return {
        lat: 10 + Math.random() * 50,    // 10°N to 60°N
        lng: 60 + Math.random() * 90     // 60°E to 150°E
      };
      
    case 'hard':
      // Hard: Worldwide
      return {
        lat: -85 + Math.random() * 170,  // -85° to 85°
        lng: -180 + Math.random() * 360  // -180° to 180°
      };
      
    default:
      return userLocation;
  }
}

function getRandomNearbyCoords(center, radiusKm) {
  const r = radiusKm / 111.32;
  const u = Math.random(), v = Math.random();
  const w = r * Math.sqrt(u), t = 2 * Math.PI * v;
  const lat = w * Math.cos(t), lng = w * Math.sin(t) / Math.cos(center.lat * Math.PI / 180);
  return { lat: center.lat + lat, lng: center.lng + lng };
}

function getSearchRadiusForLevel(level) {
  switch(level) {
    case 'easy': return 5000;
    case 'medium': return 50000;
    case 'hard': return 100000;
    default: return 10000;
  }
}

// NEW: Display the selected location
function displayLocation(locationData) {
  actualLocation = locationData.position;
  
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

  document.getElementById('showGuessMapBtn').classList.remove('hidden');
  document.getElementById('submitGuessBtn').classList.add('hidden');
  document.getElementById('guessMapContainer').style.display = 'none';
  guessLocation = null;

  if (guessMarker) guessMarker.setMap(null);
  if (actualMarker) actualMarker.setMap(null);
}

// ORIGINAL: Keep original function as fallback
async function generateNewLocation(level) {
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

    console.log(`🔍 Thử lần ${tries}/${maxTries} - Tọa độ: ${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}`);

    streetViewService.getPanorama({ 
      location: coord, 
      radius: searchRadius,
      source: google.maps.StreetViewSource.OUTDOOR // Chỉ lấy ảnh outdoor
    }, (data, status) => {
      
      if (status === google.maps.StreetViewStatus.OK) {
        
        // Kiểm tra chất lượng panorama theo độ khó
        if (!isValidPanoramaForLevel(data, level)) {
          console.log(`❌ Panorama không phù hợp với độ khó ${level} - Links: ${(data.links || []).length}`);
          
          if (tries < maxTries) {
            setTimeout(tryFindPanorama, 100); // Delay nhỏ để tránh spam API
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
        
        // Tạo Street View với cài đặt tối ưu
        const panoramaOptions = {
          position: actualLocation,
          pov: { 
            heading: Math.random() * 360, // Random hướng nhìn
            pitch: -5 + Math.random() * 10 // Pitch từ -5 đến 5 độ
          },
          zoom: 1,
          addressControl: false,    // Ẩn địa chỉ
          linksControl: true,       // Hiện nút di chuyển
          panControl: true,         // Cho phép pan
          zoomControl: true,        // Cho phép zoom
          fullscreenControl: false, // Ẩn fullscreen
          motionTracking: false,    // Tắt motion tracking
          motionTrackingControl: false
        };

        new google.maps.StreetViewPanorama(
          document.getElementById("mapPreview"), 
          panoramaOptions
        );

        // Hiện button đoán vị trí
        document.getElementById('showGuessMapBtn').classList.remove('hidden');
        document.getElementById('submitGuessBtn').classList.add('hidden');
        document.getElementById('guessMapContainer').style.display = 'none';
        guessLocation = null;

        // Reset markers nếu có
        if (guessMarker) guessMarker.setMap(null);
        if (actualMarker) actualMarker.setMap(null);
        
      } else {
        console.log(`❌ Không tìm thấy Street View - Status: ${status}`);
        
        if (tries < maxTries) {
          setTimeout(tryFindPanorama, 100);
        } else {
          alert(`⚠️ Không tìm thấy vị trí hợp lệ sau ${maxTries} lần thử. Vui lòng thử lại.`);
          // Reset về màn hình chọn độ khó
          gameContainer.classList.add("hidden");
          difficultyContainer.classList.remove("hidden");
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