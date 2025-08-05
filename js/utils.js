// utils.js

export function getUserLocation() {
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
        .then(data => resolve({ 
          lat: data.latitude || 10.8231, 
          lng: data.longitude || 106.6297 
        }))
        .catch(() => resolve({ lat: 10.8231, lng: 106.6297 }));
    }
  });
}

export function haversineDistance(c1, c2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(c2.lat - c1.lat);
  const dLon = toRad(c2.lng - c1.lng);
  const lat1 = toRad(c1.lat);
  const lat2 = toRad(c2.lat);
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function toRad(degrees) {
  return degrees * Math.PI / 180;
}

export function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleDateString('vi-VN');
}

export function formatTime(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleTimeString('vi-VN');
}

export function formatDateTime(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString('vi-VN');
}

export function validateDisplayName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, message: '⚠️ Vui lòng nhập tên hiển thị!' };
  }
  
  const trimmedName = name.trim();
  
  if (trimmedName.length < 2) {
    return { valid: false, message: '⚠️ Tên phải có ít nhất 2 ký tự!' };
  }
  
  if (trimmedName.length > 20) {
    return { valid: false, message: '⚠️ Tên không được quá 20 ký tự!' };
  }
  
  const validNamePattern = /^[a-zA-Z0-9\sÀ-ỹàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]+$/;
  if (!validNamePattern.test(trimmedName)) {
    return { valid: false, message: '⚠️ Tên chỉ được chứa chữ cái, số và khoảng trắng!' };
  }
  
  return { valid: true, name: trimmedName };
}

export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email.trim());
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export function showNotification(message, type = 'info', duration = 3000) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  // Style the notification
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    font-weight: bold;
    z-index: 10000;
    transition: all 0.3s ease;
    max-width: 300px;
    word-wrap: break-word;
  `;
  
  // Set background color based on type
  const colors = {
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336'
  };
  
  notification.style.backgroundColor = colors[type] || colors.info;
  
  // Add to document
  document.body.appendChild(notification);
  
  // Remove after duration
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, duration);
}

export function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    return new Promise((resolve, reject) => {
      if (document.execCommand('copy')) {
        textArea.remove();
        resolve();
      } else {
        textArea.remove();
        reject();
      }
    });
  }
}