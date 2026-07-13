// API_URL dibaca dari api.config.js yang di-load sebelum file ini
// - Production : dari <meta name="api-url"> di login.html
// - Lokal dev  : otomatis fallback ke http://localhost:3000

// Generate CAPTCHA saat halaman load
window.addEventListener('DOMContentLoaded', function() {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  window.captchaAnswer = num1 + num2;
  
  const captchaSpan = document.getElementById('captchaQuestion');
  if (captchaSpan) {
    captchaSpan.innerHTML = num1 + ' + ' + num2 + ' = ?';
  }
});

// Toggle password visibility
function togglePassword() {
  const passwordInput = document.getElementById('passwordInput');
  const eyeIcon = document.getElementById('eyeIcon');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    eyeIcon.classList.remove('fa-eye');
    eyeIcon.classList.add('fa-eye-slash');
  } else {
    passwordInput.type = 'password';
    eyeIcon.classList.remove('fa-eye-slash');
    eyeIcon.classList.add('fa-eye');
  }
}

// Show error message
function showError(message) {
  const errorMsg = document.getElementById('errorMsg');
  const errorText = document.getElementById('errorText');
  errorText.textContent = message;
  errorMsg.classList.add('show');
  setTimeout(function() {
    errorMsg.classList.remove('show');
  }, 3000);
}

// Hide error
function hideError() {
  const errorMsg = document.getElementById('errorMsg');
  if (errorMsg) errorMsg.classList.remove('show');
}

// Set loading state
function setLoading(isLoading) {
  const submitBtn = document.querySelector('.btn-submit');
  if (!submitBtn) return;
  
  if (isLoading) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-pulse"></i> Memproses...';
  } else {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Masuk ke Dashboard';
  }
}

// Handle login form submission
async function handleLogin(event) {
  event.preventDefault();
  hideError();
  
  const username = document.querySelector('input[name="username"]').value.trim();
  const password = document.querySelector('input[name="password"]').value;
  const captchaInput = document.getElementById('captchaInput').value.trim();
  
  // Validasi
  if (!username || !password) {
    showError('Username dan password wajib diisi');
    return;
  }
  
  if (!captchaInput) {
    showError('Harap isi verifikasi');
    // Regenerate CAPTCHA
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    window.captchaAnswer = num1 + num2;
    document.getElementById('captchaQuestion').innerHTML = num1 + ' + ' + num2 + ' = ?';
    return;
  }
  
  if (parseInt(captchaInput) !== window.captchaAnswer) {
    showError('Jawaban verifikasi salah');
    // Regenerate CAPTCHA
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    window.captchaAnswer = num1 + num2;
    document.getElementById('captchaQuestion').innerHTML = num1 + ' + ' + num2 + ' = ?';
    document.getElementById('captchaInput').value = '';
    return;
  }
  
  setLoading(true);
  
  try {
    const response = await fetch(`${window.API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: username, password: password })
    });
    
    const result = await response.json();
    
    if (result.success) {
      localStorage.setItem('token', result.data.token);
      localStorage.setItem('user', JSON.stringify(result.data.user));
      
      if (result.data.user.role === 'admin') {
        window.location.href = '/admin/index.html';
      } else if (result.data.user.role === 'kasir') {
        window.location.href = '/kasir/index.html';
      }
    } else {
      showError(result.message || 'Login gagal');
      // Reset CAPTCHA
      const num1 = Math.floor(Math.random() * 10) + 1;
      const num2 = Math.floor(Math.random() * 10) + 1;
      window.captchaAnswer = num1 + num2;
      document.getElementById('captchaQuestion').innerHTML = num1 + ' + ' + num2 + ' = ?';
      document.getElementById('captchaInput').value = '';
    }
  } catch (error) {
    console.error('Error:', error);
    showError('Terjadi kesalahan. Silakan coba lagi.');
  } finally {
    setLoading(false);
  }
}

// Attach event listener when page ready
document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
});