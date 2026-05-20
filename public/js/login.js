document.querySelector("form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document
    .querySelector('input[name="username"]')
    .value.trim();
  const password = document.querySelector('input[name="password"]').value;
  const errorDiv = document.getElementById("errorMsg");
  const submitBtn = e.target.querySelector('button[type="submit"]');

  errorDiv.classList.add("hidden");

  submitBtn.disabled = true;
  submitBtn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Memproses...';

  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect berdasarkan role
      const role = data.user?.role;
      if (role === "admin" || role === "dev") {
        window.location.href = "/admin";
      } else if (role === "kasir") {
        window.location.href = "/kasir";
      } else {
        window.location.href = "/kasir";
      }
    } else {
      errorDiv.textContent = data.error || "Login gagal, coba lagi";
      errorDiv.classList.remove("hidden");
    }
  } catch (err) {
    errorDiv.textContent =
      "Tidak bisa terhubung ke server. Periksa koneksi Anda.";
    errorDiv.classList.remove("hidden");
    console.error("Login error:", err);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML =
      '<i class="fa-solid fa-arrow-right-to-bracket mr-2"></i>Masuk ke Dashboard';
  }
});

function togglePassword() {
  const input = document.getElementById("passwordInput");
  const icon = document.getElementById("eyeIcon");
  if (input.type === "password") {
    input.type = "text";
    icon.classList.replace("fa-eye", "fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.replace("fa-eye-slash", "fa-eye");
  }
}

