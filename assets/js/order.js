const rupiah = (v) => "Rp " + (Number(v) || 0).toLocaleString("id-ID");

// API_URL dibaca dari api.config.js yang di-load sebelum file ini
// - Production : dari <meta name="api-url"> di pages/order.html
// - Lokal dev  : otomatis fallback ke http://localhost:3000
console.log("Order page loaded, API_URL:", window.API_URL);

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
    headers: { "Content-Type": "application/json" },
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
  if (!grid) return;

  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    grid.innerHTML = `<div class="card rounded-xl p-6 col-span-full text-center text-[#66705e]">
      Memuat menu${attempt > 1 ? ` (percobaan ${attempt}/${MAX_RETRIES}...)` : "..."}
    </div>`;
    try {
      const data = await apiJson(`${window.API_URL}/api/menu`);
      menus = data.items || [];
      buildCategories();
      renderMenus("all");
      return; // sukses, keluar
    } catch (err) {
      console.error(`Load menu error (attempt ${attempt}):`, err);
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      } else {
        grid.innerHTML = `<div class="card rounded-xl p-6 col-span-full text-center text-red-700">
          Gagal memuat menu: ${err.message}
          <br><button onclick="loadMenus()" class="mt-3 px-4 py-2 rounded-xl border border-red-400 font-bold text-red-600 text-sm">Coba Lagi</button>
        </div>`;
      }
    }
  }
}

function buildCategories() {
  const tabs = document.getElementById("categoryTabs");
  if (!tabs) return;
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
  const empty = document.getElementById("emptyMenu");
  if (!grid) return;
  const visible =
    filter === "all"
      ? menus
      : menus.filter((m) => normalizeCategory(m.kategori_name) === filter);
  if (empty) empty.classList.toggle("hidden", visible.length > 0);
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
  const next = Math.max(0, current + delta);
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
  const cartCount = document.getElementById("cartCount");
  const grandTotal = document.getElementById("grandTotalDisplay");
  if (cartCount) cartCount.textContent = count;
  if (grandTotal) grandTotal.textContent = rupiah(total);
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
  const checkoutTable = document.getElementById("checkoutTableText");
  const checkoutTotal = document.getElementById("checkoutTotal");
  const checkoutItems = document.getElementById("checkoutItems");
  if (checkoutTable) checkoutTable.textContent = `Meja ${tableNumber}`;
  if (checkoutTotal) checkoutTotal.textContent = rupiah(total);
  if (checkoutItems) {
    checkoutItems.innerHTML = items
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
  }
  const modal = document.getElementById("checkoutModal");
  if (modal) modal.classList.add("open");
}

function closeCheckout() {
  const modal = document.getElementById("checkoutModal");
  if (modal) modal.classList.remove("open");
  resetCheckoutDragPosition();
}

// ─── Submit order ─────────────────────────────────────────────

async function submitOrder() {
  const btn = document.getElementById("submitOrderBtn");
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = "Membuat pesanan...";
  try {
    const payload = {
      table_number: tableNumber,
      customer_name:
        document.getElementById("customerName")?.value.trim() || `Meja ${tableNumber}`,
      payment_method: selectedPayment,
      notes: document.getElementById("orderNotes")?.value.trim() || "",
      items: Object.values(cart).map((item) => ({
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
      })),
    };

    const data = await apiJson(`${window.API_URL}/api/order`, {
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
      showOrderCode();
    }

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
  const qrisTotal = document.getElementById("qrisTotal");
  if (qrisTotal) qrisTotal.textContent = rupiah(total);
  const modal = document.getElementById("qrisModal");
  if (modal) modal.classList.add("open");
}

function closeQrisModal() {
  const modal = document.getElementById("qrisModal");
  if (modal) modal.classList.remove("open");
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

  const ocCode = document.getElementById("ocCode");
  const ocMeja = document.getElementById("ocMeja");
  const ocPayment = document.getElementById("ocPayment");
  const ocTotal = document.getElementById("ocTotal");
  if (ocCode) ocCode.textContent = code || "—";
  if (ocMeja) ocMeja.textContent = `Meja ${order?.table_number || tableNumber}`;
  if (ocPayment) ocPayment.textContent = order?.payment_method === "qris" ? "QRIS" : "Cash";
  if (ocTotal) ocTotal.textContent = rupiah(order?.total_price || 0);

  const modal = document.getElementById("orderCodeModal");
  if (modal) modal.classList.add("open");

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

  const wrap = canvas.parentElement;
  if (wrap) {
    wrap.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=${encodeURIComponent(code)}" width="200" height="200" class="mx-auto rounded-xl" alt="QR ${code}">`;
  }
}

function closeOrderCode() {
  const modal = document.getElementById("orderCodeModal");
  if (modal) modal.classList.remove("open");
}

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

    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#ffffff";
    roundRect(ctx, PAD - 4, PAD - 4, QR_SIZE + 8, QR_SIZE + 8, 12);
    ctx.fill();

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, PAD, PAD, QR_SIZE, QR_SIZE);

      ctx.fillStyle = "#3f5f35";
      roundRect(ctx, PAD - 4, PAD + QR_SIZE + 8, QR_SIZE + 8, LABEL_H, 12);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(code, W / 2, PAD + QR_SIZE + 8 + 34);

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

  const existingCanvas = document.getElementById("orderQrCanvas");
  if (existingCanvas && existingCanvas.width > 0) {
    doDownload(existingCanvas.toDataURL());
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
  ctx.fill();
}

// ─── Swipe-to-close: Checkout Modal (mobile) ───────────────────

function resetCheckoutDragPosition() {
  const box = document.getElementById("checkoutModalBox");
  if (!box) return;
  box.style.transition = "";
  box.style.transform = "";
}

function initCheckoutSwipeToClose() {
  const modalBox = document.getElementById("checkoutModalBox");
  const dragHandle = document.getElementById("checkoutDragHandle");
  if (!modalBox || !dragHandle) return;

  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  function onTouchStart(e) {
    isDragging = true;
    startY = e.touches[0].clientY;
    modalBox.style.transition = "none";
  }

  function onTouchMove(e) {
    if (!isDragging) return;
    currentY = e.touches[0].clientY - startY;
    // Hanya izinkan geser ke bawah
    if (currentY > 0) {
      modalBox.style.transform = `translateY(${currentY}px)`;
    }
  }

  function onTouchEnd() {
    if (!isDragging) return;
    isDragging = false;
    modalBox.style.transition = "transform 200ms ease";

    // Kalau geser lebih dari 100px, tutup modal
    if (currentY > 100) {
      modalBox.style.transform = "translateY(100%)";
      setTimeout(() => {
        closeCheckout();
      }, 200);
    } else {
      // Kalau tidak cukup jauh, kembali ke posisi semula
      modalBox.style.transform = "";
    }
    currentY = 0;
  }

  dragHandle.addEventListener("touchstart", onTouchStart, { passive: true });
  dragHandle.addEventListener("touchmove", onTouchMove, { passive: true });
  dragHandle.addEventListener("touchend", onTouchEnd);
}

// ─── Event listeners ──────────────────────────────────────────

document.getElementById("saveTableBtn")?.addEventListener("click", () =>
  setTable(document.getElementById("manualTableInput")?.value || ""),
);
document.getElementById("resetButton")?.addEventListener("click", () => {
  cart = {};
  renderMenus("all");
  updateCart();
});
document.getElementById("checkoutBtn")?.addEventListener("click", openCheckout);
document.getElementById("cartButton")?.addEventListener("click", openCheckout);
document.getElementById("submitOrderBtn")?.addEventListener("click", submitOrder);

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
initCheckoutSwipeToClose();