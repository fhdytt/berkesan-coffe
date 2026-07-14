/* ── Auth Guard ── */
(function () {
  const token = localStorage.getItem('token');
  const user  = JSON.parse(localStorage.getItem('user') || 'null');
  if (!token || !user || !['kasir', 'admin', 'dev'].includes(user.role)) {
    window.location.replace('/login');
  } else {
    document.body.style.display = '';
  }
})();

// Halaman kasir — kelola antrean, konfirmasi pembayaran & cetak struk
const API = `${window.API_URL}/api/kasir`;

// ============================================
// VARIABLES
// ============================================
let _currentSection = 'pesanan';
let _allOrders      = [];
let _queueOrders    = [];
let _currentQNum    = null;
let _scanReader     = null;
let _autoRefresh    = null;

// Local storage keys
const _QUEUE_KEY = 'berkesan_queue_counter';
const _QUEUE_MAP_KEY = 'berkesan_queue_map';
const _ORDER_NUM_KEY = 'berkesan_order_nums';

// ============================================
// PAGE META (DEFINISIKAN SEBELUM showSection)
// ============================================
const PAGE_META = {
  pesanan: ['Pesanan Masuk', 'Kelola & proses pesanan customer'],
  scan:    ['Scan Barcode', 'Cari & proses order via kode / kamera'],
  antrian: ['Nomor Antrian', 'Panggil nomor antrian customer'],
  riwayat: ['Riwayat Transaksi', 'Rekap transaksi kasir hari ini'],
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
function _todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function _getQueueCounter() {
  try {
    const raw = JSON.parse(localStorage.getItem(_QUEUE_KEY) || '{}');
    if (raw.date !== _todayStr()) {
      return 0;
    }
    return parseInt(raw.count) || 0;
  } catch (e) {
    console.error("Error get queue counter:", e);
    return 0;
  }
}

function _setQueueCounter(n) {
  const count = parseInt(n) || 0;
  localStorage.setItem(_QUEUE_KEY, JSON.stringify({ 
    date: _todayStr(), 
    count: count 
  }));
}

function _getQueueMap() {
  try {
    const raw = JSON.parse(localStorage.getItem(_QUEUE_MAP_KEY) || '{}');
    if (raw.date !== _todayStr()) return { date: _todayStr(), map: {} };
    return raw;
  } catch { return { date: _todayStr(), map: {} }; }
}

function _setQueueMap(map) {
  localStorage.setItem(_QUEUE_MAP_KEY, JSON.stringify({ date: _todayStr(), map }));
}

function _addQueueMapping(number, orderData) {
  const data = _getQueueMap();
  data.map[number] = orderData;
  _setQueueMap(data.map);
}

function _getOrderNums() {
  try {
    const raw = JSON.parse(localStorage.getItem(_ORDER_NUM_KEY) || '{}');
    if (raw._date !== _todayStr()) return { _date: _todayStr() };
    return raw;
  } catch { return { _date: _todayStr() }; }
}

function _assignOrderNum(orderCode) {
  const nums = _getOrderNums();
  if (!nums[orderCode]) {
    const count = Object.keys(nums).filter(k => k !== '_date').length + 1;
    nums[orderCode] = count;
    localStorage.setItem(_ORDER_NUM_KEY, JSON.stringify(nums));
  }
  return nums[orderCode];
}

function fmtRp(v, short = true) {
  const n = Number(v) || 0;
  if (short) {
    if (n >= 1_000_000) return 'Rp ' + (n/1_000_000).toFixed(1).replace('.0','') + 'jt';
    if (n >= 1_000) return 'Rp ' + (n/1_000).toFixed(0) + 'k';
    return 'Rp ' + n;
  }
  return 'Rp ' + n.toLocaleString('id-ID');
}

function fmtTime(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
}

function fmtDateTime(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short' }) + ' ' +
         d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
}

function todayStr() {
  return new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = `<i class="fa-solid fa-${type==='error'?'circle-exclamation':type==='warn'?'triangle-exclamation':'circle-check'}"></i> ${msg}`;
  t.className = `toast show${type?' '+type:''}`;
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.className = 'toast', 2800);
}

function setLoading(on) {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = on ? 'flex' : 'none';
}

function payIcon(method) {
  const map = {
    cash:     { icon: 'money-bill-wave',  color: 'var(--brand)', label: 'Cash'     },
    qris:     { icon: 'qrcode',           color: 'var(--gold)',  label: 'QRIS'     },
    debit:    { icon: 'credit-card',      color: '#3b82f6',      label: 'Debit'    },
    credit:   { icon: 'credit-card',      color: '#8b5cf6',      label: 'Credit'   },
    transfer: { icon: 'building-columns', color: '#0ea5e9',      label: 'Transfer' },
    va:       { icon: 'building-columns', color: '#0ea5e9',      label: 'VA'       },
    ewallet:  { icon: 'wallet',           color: '#10b981',      label: 'E-Wallet' },
  };
  const m = map[method] || { icon: 'circle-question', color: 'var(--muted)', label: method || '—' };
  return `<i class="fa-solid fa-${m.icon}" style="color:${m.color};font-size:11px;"></i> ${m.label}`;
}

function statusBadge(st) {
  const map = { pending:'badge-pending', diproses:'badge-diproses', selesai:'badge-selesai', dibatalkan:'badge-dibatalkan' };
  const label = { pending:'menunggu bayar', diproses:'diproses', selesai:'selesai', dibatalkan:'dibatalkan' };
  return `<span class="badge ${map[st]||''}">${label[st] || st}</span>`;
}

function payStatusBadge(ps) {
  const map = {
    paid:    { cls: 'badge-selesai',    label: 'paid'    },
    pending: { cls: 'badge-pending',    label: 'pending' },
    unpaid:  { cls: 'badge-pending',    label: 'unpaid'  },
    failed:  { cls: 'badge-dibatalkan', label: 'failed'  },
    expired: { cls: 'badge-dibatalkan', label: 'expired' },
  };
  const m = map[ps] || { cls: '', label: ps || '—' };
  return `<span class="badge ${m.cls}" style="font-size:10px;">${m.label}</span>`;
}

// ============================================
// CLOCK
// ============================================
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = String(now.getSeconds()).padStart(2,'0');
  const clockDisplay = document.getElementById('clockDisplay');
  if (clockDisplay) clockDisplay.textContent = `${h}:${m}:${s}`;
}
setInterval(updateClock, 1000);
updateClock();

// ============================================
// NAVIGATION
// ============================================
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const section = document.getElementById('section-' + name);
  if (section) section.classList.add('active');
  
  document.querySelectorAll('.sb-item').forEach(b => b.classList.remove('active'));
  const idx = { pesanan:0, scan:1, antrian:2, riwayat:3 };
  const btns = document.querySelectorAll('.sb-item');
  if (btns[idx[name]]) btns[idx[name]].classList.add('active');
  
  const pageTitle = document.getElementById('page-title');
  const pageSub = document.getElementById('page-sub');
  if (pageTitle) pageTitle.textContent = PAGE_META[name][0];
  if (pageSub) pageSub.textContent = PAGE_META[name][1];
  _currentSection = name;
  
  if (name === 'pesanan') loadOrders();
  if (name === 'antrian') loadAntrian();
  if (name === 'riwayat') loadRiwayat();
}

function refreshCurrent() { showSection(_currentSection); }

// ============================================
// FETCH WRAPPER
// ============================================
async function apiFetch(url, opts = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...opts.headers
  };
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  if (!j.success) throw new Error(j.message || 'Server error');
  return j.data ?? j;
}

// ============================================
// PESANAN MASUK
// ============================================
let _filterStatus = 'all';

async function loadOrders() {
  setLoading(true);
  try {
    const data = await apiFetch(`${API}/orders`);
    _allOrders = data.orders || [];
    renderOrders(_allOrders, _filterStatus);
    updateStats(_allOrders);
    updateBadges(_allOrders);
  } catch(e) {
    showToast('Gagal memuat pesanan: ' + e.message, 'error');
  } finally { setLoading(false); }
}

function updateStats(orders) {
  const today = new Date().toDateString();
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today);
  const stPending = document.getElementById('st-pending');
  const stDiproses = document.getElementById('st-diproses');
  const stSelesai = document.getElementById('st-selesai');
  if (stPending) stPending.textContent = todayOrders.filter(o => o.status === 'pending').length;
  if (stDiproses) stDiproses.textContent = todayOrders.filter(o => o.status === 'diproses').length;
  if (stSelesai) stSelesai.textContent = todayOrders.filter(o => o.status === 'selesai').length;
}

function updateBadges(orders) {
  const active = orders.filter(o => o.status === 'pending' || o.status === 'diproses').length;
  const badge = document.getElementById('badge-pesanan');
  if (badge) {
    badge.textContent = active;
    badge.classList.toggle('show', active > 0);
  }
}

function filterOrders(status, btn) {
  _filterStatus = status;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderOrders(_allOrders, status);
}

function renderOrders(orders, filter = 'all') {
  const list = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const grid = document.getElementById('orderGrid');
  const empty = document.getElementById('emptyOrders');
  if (!list.length) {
    if (grid) grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (grid) grid.innerHTML = list.map(o => orderCardHtml(o)).join('');
}

function orderCardHtml(o) {
  const itemsHtml = (o.items || []).map(i =>
    `<span>${i.menu_name} ×${i.quantity}</span>`
  ).join('<br>') || '<span style="color:var(--muted);">—</span>';

  const canProcess  = o.status === 'pending';
  const canComplete = o.status === 'diproses';
  const canCancel   = o.status === 'pending' || o.status === 'diproses';

  return `
    <div class="order-card st-${o.status}" onclick="openOrderModal(${o.id})">
      <div class="oc-top">
        <div>
          <div class="oc-code">${o.order_code}</div>
          <div class="oc-time"><i class="fa-regular fa-clock" style="font-size:10px;"></i> ${fmtDateTime(o.created_at)}</div>
        </div>
        ${statusBadge(o.status)}
      </div>
      <div class="oc-customer">
        <i class="fa-solid fa-user" style="color:var(--muted);font-size:11px;margin-right:4px;"></i>
        ${o.customer_name || '—'}
      </div>
      <div class="oc-items">${itemsHtml}</div>
      <div class="oc-footer">
        <div class="oc-total">${fmtRp(o.total_price)}</div>
        <div class="oc-pay">${payIcon(o.payment_method)}</div>
      </div>
      <div class="oc-actions" onclick="event.stopPropagation()">
        ${canProcess  ? `<button class="btn btn-primary btn-sm" onclick="updateOrderStatus(${o.id},'diproses')"><i class="fa-solid fa-play"></i> Proses</button>` : ''}
        ${canComplete ? `<button class="btn btn-primary btn-sm" onclick="updateOrderStatus(${o.id},'selesai')"><i class="fa-solid fa-check"></i> Selesai</button>` : ''}
        <button class="btn btn-outline btn-sm" onclick="openOrderModal(${o.id})"><i class="fa-solid fa-eye"></i> Detail</button>
        ${canCancel ? `<button class="btn btn-red btn-sm" onclick="updateOrderStatus(${o.id},'dibatalkan')" style="margin-left:auto;"><i class="fa-solid fa-xmark"></i></button>` : ''}
      </div>
    </div>
  `;
}

async function updateOrderStatus(id, status) {
  const labels = { diproses:'Diproses', selesai:'Selesai', dibatalkan:'Dibatalkan' };
  if (status === 'dibatalkan' && !confirm('Batalkan order ini?')) return;
  setLoading(true);
  try {
    // Pastikan URL benar: API sudah termasuk /api/kasir
    const url = `${API}/orders/${id}/status`;
    console.log("Update status URL:", url);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ status })
    });
    
    const result = await response.json();
    console.log("Update status response:", result);
    
    if (result.success) {
      showToast(`Order berhasil di-${labels[status]||status}`);
      closeOrderModal();
      await loadOrders();
      if (status === 'selesai') {
        await loadAntrian();
      }
      // Refresh lookup result jika ada
      const lookupResult = document.getElementById('lookupResult');
      if (lookupResult) lookupResult.style.display = 'none';
    } else {
      showToast(result.message || 'Gagal update status', 'error');
    }
  } catch(e) {
    console.error('Update status error:', e);
    showToast('Gagal update status: ' + e.message, 'error');
  } finally { setLoading(false); }
}

// ============================================
// ORDER DETAIL MODAL
// ============================================
async function openOrderModal(id) {
  setLoading(true);
  try {
    const data = await apiFetch(`${API}/orders/${id}`);
    const o = data.order;
    const items = data.items || [];
    const canProcess  = o.status === 'pending';
    const canComplete = o.status === 'diproses';
    const canCancel   = o.status === 'pending' || o.status === 'diproses';

    const content = document.getElementById('orderModalContent');
    if (content) {
      content.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
          <div><div class="modal-label">Kode Order</div><div class="modal-val" style="color:var(--brand);">${o.order_code}</div></div>
          <div><div class="modal-label">Status</div><div>${statusBadge(o.status)}</div></div>
          <div><div class="modal-label">Pelanggan / Meja</div><div class="modal-val">${o.customer_name||'—'}${o.table_number ? ' • Meja ' + o.table_number : ''}</div></div>
          <div><div class="modal-label">Metode Bayar</div><div class="modal-val">${payIcon(o.payment_method)}</div></div>
          <div><div class="modal-label">Waktu</div><div class="modal-val">${fmtDateTime(o.created_at)}</div></div>
          ${o.notes ? `<div><div class="modal-label">Catatan</div><div class="modal-val">${o.notes}</div></div>` : ''}
        </div>
        <div class="modal-label">Item Pesanan</div>
        <div class="modal-items" style="margin-bottom:10px;">
          ${items.map(i => `
            <div class="modal-item-row">
              <div>
                <div class="modal-item-name">${i.menu_name}</div>
                <div class="modal-item-qty">×${i.quantity} × ${fmtRp(i.price, false)}</div>
              </div>
              <div class="modal-item-sub">${fmtRp(i.subtotal)}</div>
            </div>
          `).join('')}
          <div class="modal-total-row">
            <div class="modal-total-lbl">Total</div>
            <div class="modal-total-val">${fmtRp(o.total_price, false)}</div>
          </div>
          ${Number(o.paid_amount) > 0 ? `
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:6px;">
              <span>Dibayar</span><span>${fmtRp(o.paid_amount, false)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);">
              <span>Kembalian</span><span>${fmtRp(o.change_amount, false)}</span>
            </div>
          ` : ''}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${canProcess  ? `<button class="btn btn-primary" onclick="updateOrderStatus(${o.id},'diproses')"><i class="fa-solid fa-play"></i> Proses</button>` : ''}
          ${canComplete ? `<button class="btn btn-primary" onclick="updateOrderStatus(${o.id},'selesai');printReceipt(${JSON.stringify(o).replace(/"/g,'&quot;')}, ${JSON.stringify(items).replace(/"/g,'&quot;')})"><i class="fa-solid fa-check"></i> Selesai & Print</button>` : ''}
          <button class="btn btn-outline" onclick="printReceipt(${JSON.stringify(o).replace(/"/g,'&quot;')}, ${JSON.stringify(items).replace(/"/g,'&quot;')})"><i class="fa-solid fa-print"></i> Print Struk</button>
          ${canCancel ? `<button class="btn btn-red" style="margin-left:auto;" onclick="updateOrderStatus(${o.id},'dibatalkan')"><i class="fa-solid fa-ban"></i> Batalkan</button>` : ''}
        </div>
      `;
    }
    const modal = document.getElementById('orderModal');
    if (modal) modal.classList.add('open');
  } catch(e) {
    showToast('Gagal memuat detail: ' + e.message, 'error');
  } finally { setLoading(false); }
}

function closeOrderModal() {
  const modal = document.getElementById('orderModal');
  if (modal) modal.classList.remove('open');
}

// ============================================
// SCAN BARCODE (VERSI SEDERHANA DULU)
// ============================================
async function lookupOrder() {
  const val = document.getElementById('manualOrderId').value.trim();
  if (!val) { showToast('Masukkan kode order', 'warn'); return; }
  setLoading(true);
  try {
    const data = await apiFetch(`${API}/orders/lookup?code=${encodeURIComponent(val)}`);
    showLookupResult(data.order, data.items || []);
  } catch(e) {
    const resultDiv = document.getElementById('lookupResult');
    if (resultDiv) {
      resultDiv.innerHTML = `
        <div style="background:var(--red-pale);border:1px solid #fecaca;border-radius:10px;padding:14px;color:var(--red);font-size:13px;">
          <i class="fa-solid fa-circle-exclamation"></i> Order tidak ditemukan: <strong>${val}</strong>
        </div>`;
      resultDiv.style.display = 'block';
    }
  } finally { setLoading(false); }
}

function showLookupResult(o, items) {
  const el = document.getElementById('lookupResult');
  if (!el) return;
  
  const totalPrice = o.total_price;
  const status = o.status;
  
  if (status === 'pending') {
    // Belum bayar - tampilkan tombol konfirmasi pembayaran
    el.style.display = 'block';
    el.innerHTML = `
      <div class="lookup-card">
        <div class="lookup-header">
          <div class="lookup-code">${o.order_code}</div>
          ${statusBadge(o.status)}
        </div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">
          ${escapeHtml(o.customer_name || '—')} &nbsp;•&nbsp; ${payIcon(o.payment_method)}
          ${o.table_number ? ` &nbsp;•&nbsp; Meja ${o.table_number}` : ''}
        </div>
        <div class="lookup-items" style="margin-bottom:8px;">
          ${items.map(i=>`${i.menu_name} ×${i.quantity} = ${fmtRp(i.price * i.quantity, false)}`).join('<br>')}
        </div>
        <div class="lookup-row" style="margin-bottom:12px;">
          <div class="lookup-total">Total: ${fmtRp(totalPrice, false)}</div>
        </div>
        <div class="lookup-actions">
          <button class="btn btn-primary" style="width:100%;" onclick="openPaymentModal(${o.id}, '${o.order_code}', ${totalPrice})">
            <i class="fa-solid fa-money-bill-wave"></i> Konfirmasi Pembayaran
          </button>
        </div>
      </div>
    `;
  } else if (status === 'diproses') {
    // Sudah diproses - tampilkan tombol selesai
    el.style.display = 'block';
    el.innerHTML = `
      <div class="lookup-card">
        <div class="lookup-header">
          <div class="lookup-code">${o.order_code}</div>
          ${statusBadge(o.status)}
        </div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">
          ${escapeHtml(o.customer_name || '—')} &nbsp;•&nbsp; ${payIcon(o.payment_method)}
        </div>
        <div class="lookup-items" style="margin-bottom:8px;">
          ${items.map(i=>`${i.menu_name} ×${i.quantity} = ${fmtRp(i.price * i.quantity, false)}`).join('<br>')}
        </div>
        <div class="lookup-row" style="margin-bottom:12px;">
          <div class="lookup-total">Total: ${fmtRp(totalPrice, false)}</div>
        </div>
        <div class="lookup-actions" style="display:flex;gap:8px;">
          <button class="btn btn-primary" style="flex:1;" onclick="updateOrderStatus(${o.id},'selesai')">
            <i class="fa-solid fa-check"></i> Selesai
          </button>
          <button class="btn btn-outline" style="flex:1;" onclick="printReceiptDirect(${o.id})">
            <i class="fa-solid fa-print"></i> Print Struk
          </button>
        </div>
      </div>
    `;
  } else if (status === 'selesai') {
    el.style.display = 'block';
    el.innerHTML = `
      <div class="lookup-card">
        <div class="lookup-header">
          <div class="lookup-code">${o.order_code}</div>
          ${statusBadge(o.status)}
        </div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">
          ${escapeHtml(o.customer_name || '—')} &nbsp;•&nbsp; ${payIcon(o.payment_method)}
        </div>
        <div class="lookup-items" style="margin-bottom:8px;">
          ${items.map(i=>`${i.menu_name} ×${i.quantity} = ${fmtRp(i.price * i.quantity, false)}`).join('<br>')}
        </div>
        <div class="lookup-row" style="margin-bottom:12px;">
          <div class="lookup-total">Total: ${fmtRp(totalPrice, false)}</div>
        </div>
        <div class="lookup-actions">
          <button class="btn btn-outline" style="width:100%;" onclick="printReceiptDirect(${o.id})">
            <i class="fa-solid fa-print"></i> Print Struk
          </button>
        </div>
      </div>
    `;
  }
}

// ============================================
// MODAL PEMBAYARAN
// ============================================

function openPaymentModal(orderId, orderCode, totalPrice) {
  // Buat modal jika belum ada
  let modal = document.getElementById('paymentModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'paymentModal';
    modal.className = 'modal-bg';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:400px;">
        <div class="modal-header">
          <h3>Konfirmasi Pembayaran</h3>
          <button class="modal-close" onclick="closePaymentModal()"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div style="margin-bottom:16px;">
          <div style="background:var(--brand-pale);padding:12px;border-radius:10px;text-align:center;margin-bottom:16px;">
            <div style="font-size:12px;color:var(--muted);">Total Belanja</div>
            <div style="font-size:24px;font-weight:900;color:var(--brand);" id="modalTotalPrice">${fmtRp(totalPrice, false)}</div>
          </div>
          <div class="form-group">
            <label style="font-size:13px;font-weight:600;">Uang Customer</label>
            <input type="number" id="paymentAmount" class="input-field" style="width:100%;" placeholder="Masukkan jumlah uang" value="${totalPrice}">
          </div>
          <div style="background:var(--bg);padding:12px;border-radius:10px;margin-top:12px;">
            <div style="display:flex;justify-content:space-between;">
              <span>Kembalian</span>
              <span id="changeAmount" style="font-weight:700;color:var(--brand);">Rp 0</span>
            </div>
          </div>
          <div class="form-group" style="margin-top:16px;">
            <label style="font-size:13px;font-weight:600;">Metode Pembayaran</label>
            <div style="display:flex;gap:10px;margin-top:8px;">
              <button type="button" class="payment-method-btn active" data-method="cash" onclick="selectPaymentMethod('cash', this)" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--brand);color:#fff;font-weight:600;">Cash</button>
              <button type="button" class="payment-method-btn" data-method="qris" onclick="selectPaymentMethod('qris', this)" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);">QRIS</button>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-outline" style="flex:1;" onclick="closePaymentModal()">Batal</button>
          <button class="btn btn-primary" style="flex:1;" onclick="processPaymentAndPrint(${orderId}, '${orderCode}', ${totalPrice})">
            <i class="fa-solid fa-check"></i> Bayar & Cetak Struk
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Event listener untuk hitung kembalian
    const amountInput = document.getElementById('paymentAmount');
    if (amountInput) {
      amountInput.addEventListener('input', function() {
        const paid = parseFloat(this.value) || 0;
        const change = paid - totalPrice;
        const changeEl = document.getElementById('changeAmount');
        if (changeEl) {
          changeEl.textContent = change >= 0 ? fmtRp(change, false) : 'Rp 0';
          changeEl.style.color = change >= 0 ? 'var(--brand)' : 'var(--red)';
        }
      });
    }
  } else {
    // Update modal dengan data baru
    document.getElementById('modalTotalPrice').innerHTML = fmtRp(totalPrice, false);
    const amountInput = document.getElementById('paymentAmount');
    if (amountInput) {
      amountInput.value = totalPrice;
      amountInput.dispatchEvent(new Event('input'));
    }
  }
  
  // Simpan data ke modal
  modal.dataset.orderId = orderId;
  modal.dataset.orderCode = orderCode;
  modal.dataset.totalPrice = totalPrice;
  
  modal.classList.add('open');
}

function closePaymentModal() {
  const modal = document.getElementById('paymentModal');
  if (modal) modal.classList.remove('open');
}

function selectPaymentMethod(method, btn) {
  // Update tampilan tombol
  document.querySelectorAll('.payment-method-btn').forEach(b => {
    b.classList.remove('active');
    b.style.background = 'var(--card)';
    b.style.color = 'var(--text)';
  });
  btn.classList.add('active');
  btn.style.background = 'var(--brand)';
  btn.style.color = '#fff';
  
  // Simpan method yang dipilih
  const modal = document.getElementById('paymentModal');
  if (modal) modal.dataset.paymentMethod = method;
}

// ============================================
// PROSES PEMBAYARAN DAN CETAK STRUK
// ============================================

async function processPaymentAndPrint(orderId, orderCode, totalPrice) {
  console.log("🔍 processPaymentAndPrint called");
  console.log("Order ID:", orderId);
  console.log("Order Code:", orderCode);
  console.log("Total Price:", totalPrice);
  
  const modal = document.getElementById('paymentModal');
  if (!modal) {
    console.error("Modal tidak ditemukan");
    showToast('Modal pembayaran tidak ditemukan', 'error');
    return;
  }
  
  const amountInput = document.getElementById('paymentAmount');
  if (!amountInput) {
    console.error("Input paymentAmount tidak ditemukan");
    showToast('Input jumlah pembayaran tidak ditemukan', 'error');
    return;
  }
  
  let paidAmount = amountInput.value;
  const paymentMethod = modal?.dataset?.paymentMethod || 'cash';
  
  // Bersihkan input (hilangkan titik, koma, dll)
  paidAmount = paidAmount.toString().replace(/\./g, '').replace(/,/g, '');
  const paid = parseFloat(paidAmount);
  
  console.log("Paid amount:", paid);
  console.log("Payment method:", paymentMethod);
  
  if (isNaN(paid) || paid <= 0) {
    showToast('Masukkan jumlah uang yang valid', 'error');
    return;
  }
  
  if (paid < totalPrice) {
    showToast(`Pembayaran kurang: ${fmtRp(totalPrice - paid, false)}`, 'error');
    return;
  }
  
  setLoading(true);
  try {
    const response = await fetch(`${API}/orders/${orderId}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ 
        paid_amount: paid, 
        payment_method: paymentMethod 
      })
    });
    
    const result = await response.json();
    console.log("Payment result:", result);
    
    if (result.success) {
      const change = paid - totalPrice;
      showToast(`Pembayaran berhasil! Kembalian: ${fmtRp(change, false)}`, 'success');
      
      closePaymentModal();
      
      // Ambil detail order untuk print struk
      try {
        const orderRes = await fetch(`${API}/orders/${orderId}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const orderData = await orderRes.json();
        const order = orderData.data?.order || orderData.order;
        const items = orderData.data?.items || orderData.items || [];
        printReceipt(order, items);
      } catch (printErr) {
        console.warn("Print error:", printErr);
        showToast('Pembayaran berhasil, tapi gagal cetak struk', 'warn');
      }
      
      document.getElementById('manualOrderId').value = '';
      document.getElementById('lookupResult').style.display = 'none';
      await loadOrders();
      await loadAntrian();
      
      showToast(`Pesanan ${orderCode} telah diproses`, 'success');
    } else {
      showToast(result.message || 'Gagal memproses pembayaran', 'error');
    }
  } catch (error) {
    console.error('Payment error:', error);
    showToast('Gagal memproses pembayaran: ' + error.message, 'error');
  } finally {
    setLoading(false);
  }
}

// ============================================
// CETAK STRUK LANGSUNG (tanpa modal)
// ============================================

function callNext() {
  if (!pendingQueue.length) {
    showToast('Tidak ada antrian', 'warn');
    return;
  }
  
  // Urutkan berdasarkan waktu
  const sorted = [...pendingQueue].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const nextOrder = sorted[0];
  const queueNumber = nextOrder.queueNumber || 'A' + String(1).padStart(2, '0');
  
  _currentQNum = queueNumber;
  const currentQueue = document.getElementById('currentQueue');
  const queueOrderCode = document.getElementById('queueOrderCode');
  if (currentQueue) currentQueue.textContent = queueNumber;
  if (queueOrderCode) queueOrderCode.textContent = `${nextOrder.customer_name || nextOrder.order_code}${nextOrder.table_number ? ' - Meja ' + nextOrder.table_number : ''}`;
  
  showToast(`📢 Memanggil antrian ${queueNumber} - ${nextOrder.customer_name || nextOrder.order_code}`);
  announceQueue(queueNumber, nextOrder.customer_name);
}

async function printReceiptDirect(orderId) {
  try {
    const orderData = await apiFetch(`${API}/orders/${orderId}`);
    const order = orderData.order;
    const items = orderData.items || [];
    printReceipt(order, items);
  } catch (error) {
    showToast('Gagal mencetak struk: ' + error.message, 'error');
  }
}

function openScanOverlay() {
  const overlay = document.getElementById('scanOverlay');
  if (overlay) overlay.classList.add('open');
  startScan();
}

function closeScanOverlay() {
  stopScan();
  const overlay = document.getElementById('scanOverlay');
  if (overlay) overlay.classList.remove('open');
}

function startScan() {
  if (!window.ZXing) { 
    showToast('Library ZXing tidak tersedia', 'error'); 
    return; 
  }
  const video = document.getElementById('scanVideo');
  if (!video) return;
  _scanReader = new ZXing.BrowserMultiFormatReader();
  _scanReader.decodeFromVideoDevice(null, video, (result, err) => {
    if (result) {
      const code = result.getText();
      closeScanOverlay();
      const manualInput = document.getElementById('manualOrderId');
      if (manualInput) manualInput.value = code;
      showSection('scan');
      lookupOrder();
    }
  });
}

function stopScan() {
  if (_scanReader) { 
    _scanReader.reset(); 
    _scanReader = null; 
  }
}

// ============================================
// ANTRIAN - NOMOR PERMANEN DARI DATABASE
// ============================================

let pendingQueue = [];

async function loadAntrian() {
  try {
    const data = await apiFetch(`${API}/queue`);
    // 🔥 LANGSUNG PAKAI DATA DARI SERVER, JANGAN MODIFIKASI queue_number
    pendingQueue = (data.orders || []).filter(o => o.status === 'diproses');
    console.log("✅ Antrian loaded:", pendingQueue);
    renderAntrian(pendingQueue);
  } catch(e) {
    console.error('Load antrian error:', e);
    showToast('Gagal memuat antrian: ' + e.message, 'error');
  }
}

function renderAntrian(orders) {
  const list = document.getElementById('queueList');
  const empty = document.getElementById('emptyQueue');
  const badge = document.getElementById('queueCount');
  
  // 🔥 JANGAN generate ulang nomor, langsung pakai queue_number dari database
  // Urutkan berdasarkan queue_number
  const sorted = [...orders].sort((a, b) => {
    const numA = parseInt((a.queue_number || 'A99').substring(1));
    const numB = parseInt((b.queue_number || 'A99').substring(1));
    return numA - numB;
  });
  
  if (badge) badge.textContent = sorted.length + ' item';
  
  const sbBadge = document.getElementById('badge-antrian');
  if (sbBadge) {
    sbBadge.textContent = sorted.length;
    sbBadge.classList.toggle('show', sorted.length > 0);
  }
  
  if (!sorted.length) {
    if (list) list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  
  if (empty) empty.style.display = 'none';
  
  if (list) {
    list.innerHTML = sorted.map((order) => {
      // 🔥 LANGSUNG PAKAI queue_number DARI DATABASE, JANGAN DI-GENERATE
      const queueNumber = order.queue_number;
      return `
      <div class="queue-item" data-order-id="${order.id}" data-queue-number="${queueNumber}">
        <div class="queue-item-num queue-num-permanent">${queueNumber}</div>
        <div class="queue-item-detail">
          <div class="queue-item-code">${escapeHtml(order.customer_name || '—')}${order.table_number ? ' • Meja ' + order.table_number : ''}</div>
          <div class="queue-item-meta">${order.order_code} • ${payIcon(order.payment_method)}</div>
        </div>
        <div class="queue-item-status">${statusBadge(order.status)}</div>
        <div class="queue-actions">
          <button class="btn-call-queue" onclick="callSpecificQueue('${queueNumber}', ${order.id})">
            <i class="fa-solid fa-bullhorn"></i> Panggil
          </button>
        </div>
      </div>`;
    }).join('');
  }
}

function callSpecificQueue(queueNumber, orderId) {
  const order = pendingQueue.find(o => o.id === orderId);
  if (!order) {
    showToast('Order tidak ditemukan', 'warn');
    return;
  }
  
  // Gunakan queue_number dari order, atau parameter
  const displayNumber = order.queue_number || queueNumber;
  
  _currentQNum = displayNumber;
  const currentQueue = document.getElementById('currentQueue');
  const queueOrderCode = document.getElementById('queueOrderCode');
  if (currentQueue) currentQueue.textContent = displayNumber;
  if (queueOrderCode) queueOrderCode.textContent = `${order.customer_name || order.order_code}${order.table_number ? ' - Meja ' + order.table_number : ''}`;
  
  showToast(`📢 Memanggil antrian ${displayNumber}`);
  announceQueue(displayNumber, order.customer_name);
}

function callNext() {
  if (!pendingQueue.length) {
    showToast('Tidak ada antrian', 'warn');
    return;
  }
  
  // Ambil order dengan nomor antrian terkecil
  const sorted = [...pendingQueue].sort((a, b) => {
    const numA = parseInt((a.queue_number || 'A99').substring(1));
    const numB = parseInt((b.queue_number || 'A99').substring(1));
    return numA - numB;
  });
  const nextOrder = sorted[0];
  const queueNumber = nextOrder.queue_number || ('A' + String(1).padStart(2, '0'));
  
  _currentQNum = queueNumber;
  const currentQueue = document.getElementById('currentQueue');
  const queueOrderCode = document.getElementById('queueOrderCode');
  if (currentQueue) currentQueue.textContent = queueNumber;
  if (queueOrderCode) queueOrderCode.textContent = `${nextOrder.customer_name || nextOrder.order_code}${nextOrder.table_number ? ' - Meja ' + nextOrder.table_number : ''}`;
  
  showToast(`📢 Memanggil antrian ${queueNumber}`);
  announceQueue(queueNumber, nextOrder.customer_name);
}

function callSpecific() {
  const input = document.getElementById('callSpecificInput');
  if (!input) return;
  const n = parseInt(input.value);
  if (!n || n < 1) {
    showToast('Masukkan nomor antrian yang valid', 'warn');
    return;
  }
  
  const queueNumber = 'A' + String(n).padStart(2, '0');
  const order = pendingQueue.find(o => o.queue_number === queueNumber);
  
  if (!order) {
    showToast(`Nomor antrian ${queueNumber} tidak ditemukan`, 'warn');
    return;
  }
  
  _currentQNum = queueNumber;
  const currentQueue = document.getElementById('currentQueue');
  const queueOrderCode = document.getElementById('queueOrderCode');
  if (currentQueue) currentQueue.textContent = queueNumber;
  if (queueOrderCode) queueOrderCode.textContent = order.customer_name
    ? `${order.customer_name}${order.table_number ? ' - Meja ' + order.table_number : ''}`
    : `Antrian ${queueNumber}`;
  
  showToast(`📢 Memanggil antrian ${queueNumber}`);
  input.value = '';
  announceQueue(queueNumber, order.customer_name);
}

function resetQueue() {
  if (!confirm('Reset semua nomor antrian?')) return;
  pendingQueue = [];
  renderAntrian(pendingQueue);
  const currentQueue = document.getElementById('currentQueue');
  const queueOrderCode = document.getElementById('queueOrderCode');
  if (currentQueue) currentQueue.textContent = '—';
  if (queueOrderCode) queueOrderCode.textContent = 'Belum ada panggilan';
  showToast('Antrian direset');
}

// Hapus order dari antrian (dipanggil saat order selesai)
function removeFromQueue(orderId) {
  pendingQueue = pendingQueue.filter(o => o.id !== orderId);
  // Reassign nomor antrian
  pendingQueue = pendingQueue.map((order, idx) => ({
    ...order,
    queueNumber: 'A' + String(idx + 1).padStart(2, '0')
  }));
  renderAntrian(pendingQueue);
}

// Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function announceQueue(number, customerName) {
  // Cek apakah browser mendukung speech synthesis
  if (!window.speechSynthesis) {
    console.warn("Browser tidak mendukung text-to-speech");
    return;
  }
  
  // Format nomor antrian (A01 -> A 01)
  const digits = number.slice(1);
  // Ubah angka menjadi pelafalan Indonesia (01 -> "nol satu")
  const spokenDigits = digits.split('').map(d => {
    const digitMap = {
      '0': 'nol', '1': 'satu', '2': 'dua', '3': 'tiga', '4': 'empat',
      '5': 'lima', '6': 'enam', '7': 'tujuh', '8': 'delapan', '9': 'sembilan'
    };
    return digitMap[d] || d;
  }).join(' ');
  
  const spoken = `${number[0]} ${spokenDigits}`;
  const namePart = customerName ? `, atas nama ${customerName},` : ',';
  const text = `Nomor antrian ${spoken}${namePart} silakan mengambil pesanan`;
  
  console.log("Mengumumkan:", text);
  
  // Batalkan pengumuman yang sedang berjalan
  window.speechSynthesis.cancel();
  
  // Buat utterance baru
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'id-ID';  // Bahasa Indonesia
  utter.rate = 0.85;     // Lebih lambat agar lebih jelas (0.5 - 1.5)
  utter.pitch = 1.1;     // Sedikit lebih tinggi
  utter.volume = 1;      // Volume maksimal
  
  // Tunggu voices loaded jika belum
  function speakWithIndonesianVoice() {
    const voices = window.speechSynthesis.getVoices();
    
    // Prioritas suara Indonesia
    let indonesianVoice = null;
    
    // 1. Cari Google Indonesia (suara paling natural)
    indonesianVoice = voices.find(v => v.lang === 'id-ID' && v.name.includes('Google'));
    // 2. Cari Microsoft Indonesia
    if (!indonesianVoice) indonesianVoice = voices.find(v => v.lang === 'id-ID' && v.name.includes('Microsoft'));
    // 3. Cari suara Indonesia apapun
    if (!indonesianVoice) indonesianVoice = voices.find(v => v.lang === 'id-ID');
    // 4. Fallback ke suara Malaysia
    if (!indonesianVoice) indonesianVoice = voices.find(v => v.lang === 'ms-MY');
    
    if (indonesianVoice) {
      utter.voice = indonesianVoice;
      console.log("Menggunakan suara:", indonesianVoice.name);
    } else {
      console.warn("Tidak ada suara Bahasa Indonesia, menggunakan suara default");
    }
    
    window.speechSynthesis.speak(utter);
  }
  
  // Jika voices sudah tersedia, langsung speak
  if (window.speechSynthesis.getVoices().length > 0) {
    speakWithIndonesianVoice();
  } else {
    // Tunggu voices loaded
    window.speechSynthesis.onvoiceschanged = speakWithIndonesianVoice;
    // Timeout fallback
    setTimeout(speakWithIndonesianVoice, 500);
  }
}

// ============================================
// RIWAYAT
// ============================================
async function loadRiwayat() {
  console.log("🔄 Loading riwayat...");
  setLoading(true);
  try {
    const data = await apiFetch(`${API}/history`);
    console.log("📦 Riwayat data:", data);
    
    // 🔥 PERHATIAN: Response menggunakan key 'history', bukan 'orders'
    const orders = data.history || data.orders || [];
    console.log("📦 Orders extracted:", orders.length);
    
    renderRiwayat(orders);
  } catch(e) {
    console.error('Load riwayat error:', e);
    showToast('Gagal memuat riwayat: ' + e.message, 'error');
    const tbody = document.getElementById('historyTbody');
    const empty = document.getElementById('emptyHistory');
    if (tbody) tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
  } finally {
    setLoading(false);
  }
}

function renderRiwayat(orders) {
  console.log("🎨 Rendering riwayat:", orders.length, "orders");
  
  const dateEl = document.getElementById('rw-date');
  if (dateEl) dateEl.textContent = todayStr();
  
  // Hitung statistik dari orders yang selesai (bukan dibatalkan)
  const completedOrders = orders.filter(o => o.status === 'selesai');
  const total = completedOrders.reduce((s, o) => s + Number(o.total_price), 0);
  const qrisCount = completedOrders.filter(o => o.payment_method === 'qris').length;
  const cashCount = completedOrders.filter(o => o.payment_method === 'cash').length;
  
  const rwCount = document.getElementById('rw-count');
  const rwTotal = document.getElementById('rw-total');
  const rwQris = document.getElementById('rw-qris');
  const rwCash = document.getElementById('rw-cash');
  
  if (rwCount) rwCount.textContent = orders.length;
  if (rwTotal) rwTotal.textContent = fmtRp(total);
  if (rwQris) rwQris.textContent = qrisCount;
  if (rwCash) rwCash.textContent = cashCount;
  
  const tbody = document.getElementById('historyTbody');
  const empty = document.getElementById('emptyHistory');
  
  if (!orders.length) {
    if (tbody) tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  
  if (empty) empty.style.display = 'none';
  
  if (tbody) {
    tbody.innerHTML = orders.map(o => `
      <tr>
        <td><code style="font-size:11px;color:var(--brand);">${escapeHtml(o.order_code)}</code></td>
        <td>${escapeHtml(o.customer_name || '—')}</td>
        <td style="color:var(--muted);font-size:11px;">${o.item_count || '—'} item</td>
        <td style="font-weight:700;">${fmtRp(o.total_price)}</td>
        <td>${payIcon(o.payment_method)}</td>
        <td>${statusBadge(o.status)}</td>
        <td>${payStatusBadge(o.payment_status)}</td>
        <td style="color:var(--muted);font-size:11px;">${fmtTime(o.created_at)}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="openOrderModal(${o.id})">
            <i class="fa-solid fa-eye"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }
}

// ============================================
// PRINT
// ============================================
function printReceipt(order, items) {
  const el = document.getElementById('receiptPrint');
  const now = new Date().toLocaleString('id-ID');
  if (el) {
    el.innerHTML = `
      <div style="text-align:center;margin-bottom:12px;">
        <div style="font-size:16px;font-weight:900;">☕ BERKESAN COFFEE</div>
        <div style="font-size:11px;color:#666;margin-top:2px;">Struk Pembayaran</div>
        <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>
      </div>
      <div style="margin-bottom:8px;">
        <div><strong>No. Order :</strong> ${order.order_code}</div>
        <div><strong>Pelanggan :</strong> ${order.customer_name||'—'}</div>
        <div><strong>Meja      :</strong> ${order.table_number||'—'}</div>
        <div><strong>Tanggal   :</strong> ${now}</div>
        <div><strong>Pembayaran:</strong> ${order.payment_method?.toUpperCase()}</div>
      </div>
      <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>
      ${items.map(i=>`
        <div style="display:flex;justify-content:space-between;">
          <span>${i.menu_name} ×${i.quantity}</span>
          <span>${fmtRp(i.subtotal, false)}</span>
        </div>
      `).join('')}
      <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>
      <div style="display:flex;justify-content:space-between;font-weight:900;font-size:14px;">
        <span>TOTAL</span><span>${fmtRp(order.total_price, false)}</span>
      </div>
      ${Number(order.paid_amount)>0 ? `
        <div style="display:flex;justify-content:space-between;margin-top:4px;">
          <span>Dibayar</span><span>${fmtRp(order.paid_amount, false)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span>Kembalian</span><span>${fmtRp(order.change_amount, false)}</span>
        </div>
      ` : ''}
      <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>
      <div style="text-align:center;font-size:11px;color:#666;">
        Terima kasih telah berkunjung!<br>Berkesan Coffee — Made with ❤️
      </div>
    `;
  }
  window.print();
}

function printSummary() {
  const rows = document.querySelectorAll('#historyTbody tr');
  if (!rows.length) { showToast('Tidak ada data untuk diprint', 'warn'); return; }
  const el = document.getElementById('receiptPrint');
  const total = document.getElementById('rw-total')?.textContent || 'Rp 0';
  const count = document.getElementById('rw-count')?.textContent || '0';
  const qris = document.getElementById('rw-qris')?.textContent || '0';
  const cash = document.getElementById('rw-cash')?.textContent || '0';
  if (el) {
    el.innerHTML = `
      <div style="text-align:center;margin-bottom:12px;">
        <div style="font-size:16px;font-weight:900;">☕ BERKESAN COFFEE</div>
        <div style="font-size:11px;">Ringkasan Kasir — ${todayStr()}</div>
        <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>
      </div>
      <div><strong>Total Transaksi :</strong> ${count}</div>
      <div><strong>Total Pendapatan:</strong> ${total}</div>
      <div><strong>QRIS :</strong> ${qris}</div>
      <div><strong>Cash :</strong> ${cash}</div>
      <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>
      <div style="text-align:center;font-size:11px;color:#666;">Berkesan Coffee</div>
    `;
  }
  window.print();
}

// ============================================
// LOGOUT
// ============================================
function handleLogout() {
  if (confirm('Yakin ingin logout?')) window.location.href = '/login';
}

// ============================================
// AUTO REFRESH
// ============================================
_autoRefresh = setInterval(() => {
  if (_currentSection === 'pesanan') loadOrders();
  if (_currentSection === 'antrian') loadAntrian();
}, 10000);

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  loadOrders();
});