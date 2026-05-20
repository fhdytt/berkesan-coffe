const rupiah = (v) => "Rp " + (Number(v) || 0).toLocaleString("id-ID");

const params = new URLSearchParams(window.location.search);
let tableNumber =
  params.get("table") ||
  params.get("meja") ||
  params.get("table_number") ||
  localStorage.getItem("berkesan_table") ||
  "";
let menus = [];
let cart = {};
let selectedPayment = "qris";

// State order aktif
let currentOrder = null;
let currentPaymentCode = null;
let currentOrderItems = [];

// ─── Helpers ──────────────────────────────────────────────────

function normalizeCategory(v) {
  return (v || "Lainnya").toString().trim();
}

function setTable(value) {
  tableNumber = value.trim();
  if (tableNumber) localStorage.setItem("berkesan_table", tableNumber);
  document.getElementById("tableLabel").textContent = tableNumber
    ? `Meja ${tableNumber}`
    : "Meja belum dipilih";
  document.getElementById("tableNotice").classList.toggle("hidden", !!tableNumber);
}

async function apiJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
    ...options,
  });
  const json = await res.json();
  if (!res.ok || !json.success)
    throw new Error(json.message || json.error || "Request gagal");
  return json.data || json;
}

// ─── Menu ─────────────────────────────────────────────────────

async function loadMenus() {
  const grid = document.getElementById("menuGrid");
  grid.innerHTML =
    '<div class="card rounded-xl p-6 col-span-full text-center text-[#66705e]">Memuat menu...</div>';
  try {
    const data = await apiJson(`${BACKEND_URL}/api/menu`);
    menus = data.items || [];
    buildCategories();
    renderMenus("all");
  } catch (err) {
    grid.innerHTML = `<div class="card rounded-xl p-6 col-span-full text-center text-red-700">Gagal memuat menu: ${err.message}</div>`;
  }
}

function buildCategories() {
  const tabs = document.getElementById("categoryTabs");
  const cats = [...new Set(menus.map((m) => normalizeCategory(m.kategori_name)))];
  tabs.innerHTML =
    '<button data-filter="all" class="filter-btn brand px-4 py-2 rounded-xl text-sm font-bold">Semua</button>' +
    cats
      .map(
        (c) =>
          `<button data-filter="${c}" class="filter-btn bg-white px-4 py-2 rounded-xl text-sm font-bold text-[#3f5f35] border border-[#3f5f35]/15">${c}</button>`,
      )
      .join("");
  tabs.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.querySelectorAll(".filter-btn").forEach((b) => {
        b.className =
          "filter-btn bg-white px-4 py-2 rounded-xl text-sm font-bold text-[#3f5f35] border border-[#3f5f35]/15";
      });
      btn.className = "filter-btn brand px-4 py-2 rounded-xl text-sm font-bold";
      renderMenus(btn.dataset.filter);
    });
  });
}

function renderMenus(filter) {
  const grid = document.getElementById("menuGrid");
  const visible =
    filter === "all"
      ? menus
      : menus.filter((m) => normalizeCategory(m.kategori_name) === filter);
  document.getElementById("emptyMenu").classList.toggle("hidden", visible.length > 0);
  grid.innerHTML = visible
    .map((item) => {
      const qty = cart[item.id]?.quantity || 0;
      const img = item.image_url
        ? `<img src="${item.image_url}" alt="${item.name}" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-4xl text-[#3f5f35]\\'><i class=\\'fa-solid fa-mug-hot\\'></i></div>'">`
        : `<div class="w-full h-full flex items-center justify-center text-4xl text-[#3f5f35]"><i class="fa-solid fa-mug-hot"></i></div>`;
      return `
      <article class="card rounded-xl overflow-hidden">
        <div class="menu-img">${img}</div>
        <div class="p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-bold text-[#836527]">${normalizeCategory(item.kategori_name)}</p>
              <h3 class="font-black text-lg mt-1">${item.name}</h3>
              <p class="text-xs text-[#66705e] mt-1">Stok ${item.stock}</p>
            </div>
            <p class="font-black text-[#3f5f35]">${rupiah(item.price)}</p>
          </div>
          <div class="mt-4 flex items-center justify-between">
            <button class="w-10 h-10 rounded-xl bg-[#ece7d8] font-black" onclick="changeQty(${item.id}, -1)">-</button>
            <span id="qty-${item.id}" class="font-black text-lg">${qty}</span>
            <button class="w-10 h-10 rounded-xl brand font-black" onclick="changeQty(${item.id}, 1)">+</button>
          </div>
        </div>
      </article>`;
    })
    .join("");
}

function changeQty(id, delta) {
  const menu = menus.find((m) => m.id === id);
  if (!menu) return;
  const current = cart[id]?.quantity || 0;
  const next = Math.max(0, Math.min(Number(menu.stock), current + delta));
  if (next === 0) delete cart[id];
  else
    cart[id] = {
      menu_item_id: id,
      name: menu.name,
      price: Number(menu.price),
      quantity: next,
    };
  const el = document.getElementById("qty-" + id);
  if (el) el.textContent = next;
  updateCart();
}

function updateCart() {
  const items = Object.values(cart);
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce((s, i) => s + i.quantity * i.price, 0);
  document.getElementById("cartCount").textContent = count;
  document.getElementById("grandTotalDisplay").textContent = rupiah(total);
}

// ─── Modal 1: Checkout ────────────────────────────────────────

function openCheckout() {
  const items = Object.values(cart);
  if (!items.length) return alert("Silakan pilih menu terlebih dahulu.");
  if (!tableNumber) {
    document
      .getElementById("tableNotice")
      .scrollIntoView({ behavior: "smooth", block: "center" });
    return alert("Nomor meja wajib diisi sebelum checkout.");
  }
  const total = items.reduce((s, i) => s + i.quantity * i.price, 0);
  document.getElementById("checkoutTableText").textContent = `Meja ${tableNumber}`;
  document.getElementById("checkoutTotal").textContent = rupiah(total);
  document.getElementById("checkoutItems").innerHTML = items
    .map(
      (item) => `
    <div class="flex justify-between gap-3 bg-white rounded-xl p-3 border border-[#3f5f35]/10">
      <div>
        <p class="font-bold">${item.name}</p>
        <p class="text-xs text-[#66705e]">${item.quantity} x ${rupiah(item.price)}</p>
      </div>
      <p class="font-black">${rupiah(item.quantity * item.price)}</p>
    </div>`,
    )
    .join("");
  document.getElementById("checkoutModal").classList.add("open");
}

function closeCheckout() {
  document.getElementById("checkoutModal").classList.remove("open");
}

// ─── Submit order ─────────────────────────────────────────────

async function submitOrder() {
  const btn = document.getElementById("submitOrderBtn");
  btn.disabled = true;
  btn.textContent = "Membuat pesanan...";
  try {
    const payload = {
      table_number: tableNumber,
      customer_name:
        document.getElementById("customerName").value.trim() || `Meja ${tableNumber}`,
      payment_method: selectedPayment,
      notes: document.getElementById("orderNotes").value.trim(),
      items: Object.values(cart).map((item) => ({
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
      })),
    };

    const data = await apiJson(`${BACKEND_URL}/api/order`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    currentOrder = data.order;
    currentPaymentCode = data.payment_code;
    currentOrderItems = Object.values(cart);

    closeCheckout();

    if (selectedPayment === "qris") {
      openQrisModal();
    } else {
      // Cash: langsung tampil kode order
      showOrderCode();
    }

    // Reset cart
    cart = {};
    renderMenus(
      document.querySelector("#categoryTabs .brand")?.dataset.filter || "all",
    );
    updateCart();
  } catch (err) {
    alert("Gagal membuat pesanan: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Buat Pesanan";
  }
}

// ─── Modal 2: QRIS ────────────────────────────────────────────

function openQrisModal() {
  const total = currentOrder?.total_price || 0;
  document.getElementById("qrisTotal").textContent = rupiah(total);
  document.getElementById("qrisModal").classList.add("open");
}

function closeQrisModal() {
  document.getElementById("qrisModal").classList.remove("open");
}

function downloadQrisImage() {
  const img = document.getElementById("qrisImage");
  if (!img || !img.src) return alert("Gambar QRIS tidak tersedia.");
  const link = document.createElement("a");
  link.download = "qris-berkesan.png";
  link.href = img.src;
  link.click();
}

// ─── Modal 3: Kode Order (QR) ─────────────────────────────────

function showOrderCode() {
  closeQrisModal();

  const order = currentOrder;
  const code = currentPaymentCode;

  document.getElementById("ocCode").textContent = code || "—";
  document.getElementById("ocMeja").textContent = `Meja ${order?.table_number || tableNumber}`;
  document.getElementById("ocPayment").textContent =
    order?.payment_method === "qris" ? "QRIS" : "Cash";
  document.getElementById("ocTotal").textContent = rupiah(order?.total_price || 0);

  document.getElementById("orderCodeModal").classList.add("open");

  // Render QR setelah modal muncul
  setTimeout(() => renderOrderQr(code), 80);
}

function renderOrderQr(code, attempt = 0) {
  const canvas = document.getElementById("orderQrCanvas");
  if (!canvas) return;

  if (window.QRCode && typeof QRCode.toCanvas === "function") {
    QRCode.toCanvas(canvas, code, { width: 200, margin: 1, color: { dark: "#172013", light: "#ffffff" } }, (err) => {
      if (err) console.warn("QR render err:", err);
    });
    return;
  }

  if (attempt < 15) {
    setTimeout(() => renderOrderQr(code, attempt + 1), 200);
    return;
  }

  // Fallback: gambar dari API eksternal
  const wrap = canvas.parentElement;
  wrap.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=${encodeURIComponent(code)}" width="200" height="200" class="mx-auto rounded-xl" alt="QR ${code}">`;
}

function closeOrderCode() {
  document.getElementById("orderCodeModal").classList.remove("open");
}

// ─── Download QR order sebagai gambar ────────────────────────

function downloadOrderCode() {
  const code = currentPaymentCode;
  const order = currentOrder;
  if (!code) return alert("Kode order tidak ditemukan.");

  const QR_SIZE = 300;
  const LABEL_H = 80;
  const PAD = 24;
  const W = QR_SIZE + PAD * 2;
  const H = QR_SIZE + LABEL_H + PAD * 2;

  const doDownload = (qrDataUrl) => {
    const offscreen = document.createElement("canvas");
    offscreen.width = W;
    offscreen.height = H;
    const ctx = offscreen.getContext("2d");

    // Background
    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(0, 0, W, H);

    // White card behind QR
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(PAD - 4, PAD - 4, QR_SIZE + 8, QR_SIZE + 8, 12);
    ctx.fill();

    // QR image
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, PAD, PAD, QR_SIZE, QR_SIZE);

      // Green label area
      ctx.fillStyle = "#3f5f35";
      ctx.beginPath();
      ctx.roundRect(PAD - 4, PAD + QR_SIZE + 8, QR_SIZE + 8, LABEL_H, 12);
      ctx.fill();

      // Code text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(code, W / 2, PAD + QR_SIZE + 8 + 34);

      // Sub info
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "12px Inter, sans-serif";
      ctx.fillText(
        `Meja ${order?.table_number || tableNumber} • ${rupiah(order?.total_price || 0)}`,
        W / 2,
        PAD + QR_SIZE + 8 + 58,
      );

      const link = document.createElement("a");
      link.download = `qr-order-${code}.png`;
      link.href = offscreen.toDataURL("image/png");
      link.click();
    };
    img.src = qrDataUrl;
  };

  // Generate QR data URL
  if (window.QRCode && typeof QRCode.toDataURL === "function") {
    QRCode.toDataURL(code, { width: QR_SIZE, margin: 1, color: { dark: "#172013", light: "#ffffff" } }, (err, url) => {
      if (err) return;
      doDownload(url);
    });
  } else {
    // Fallback: pakai gambar dari canvas yang sudah dirender di modal
    const existingCanvas = document.getElementById("orderQrCanvas");
    if (existingCanvas && existingCanvas.width > 0) {
      doDownload(existingCanvas.toDataURL());
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Event listeners ──────────────────────────────────────────

document.getElementById("saveTableBtn").addEventListener("click", () =>
  setTable(document.getElementById("manualTableInput").value),
);
document.getElementById("resetButton").addEventListener("click", () => {
  cart = {};
  renderMenus("all");
  updateCart();
});
document.getElementById("checkoutBtn").addEventListener("click", openCheckout);
document.getElementById("cartButton").addEventListener("click", openCheckout);
document.getElementById("submitOrderBtn").addEventListener("click", submitOrder);

document.querySelectorAll(".payment-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedPayment = btn.dataset.payment;
    document
      .querySelectorAll(".payment-btn")
      .forEach((b) => b.classList.remove("brand-soft"));
    btn.classList.add("brand-soft");
  });
});

// ─── Init ─────────────────────────────────────────────────────

setTable(tableNumber);
loadMenus();
updateCart();