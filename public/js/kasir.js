/* ═══════════════════════════════
   CONFIG
═══════════════════════════════ */
const API = `${BACKEND_URL}/api/kasir`;
let _currentSection = 'pesanan';
let _allOrders      = [];
let _queueOrders    = [];
let _currentQNum    = null;
let _scanReader     = null;
let _autoRefresh    = null;

/* ── Queue counter: persist per hari via localStorage ── */
const _QUEUE_KEY = 'berkesan_queue_counter';
const _QUEUE_MAP_KEY = 'berkesan_queue_map'; // Mapping A01 → order data

function _todayStr() {
  return new Date().toISOString().slice(0, 10); // "2026-05-20"
}

function _getQueueCounter() {
  try {
    const raw = JSON.parse(localStorage.getItem(_QUEUE_KEY) || '{}');
    if (raw.date !== _todayStr()) return 0; // hari baru → mulai dari 0
    return raw.count || 0;
  } catch { return 0; }
}

function _setQueueCounter(n) {
  localStorage.setItem(_QUEUE_KEY, JSON.stringify({ date: _todayStr(), count: n }));
}

/* Simpan mapping nomor antrian ke order data */
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

/* ═══════════════════════════════
   UTILITY
═══════════════════════════════ */
function fmtRp(v, short = true) {
  const n = Number(v) || 0;
  if (short) {
    if (n >= 1_000_000) return 'Rp ' + (n/1_000_000).toFixed(1).replace('.0','') + 'jt';
    if (n >= 1_000)     return 'Rp ' + (n/1_000).toFixed(0) + 'k';
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
  t.innerHTML = `<i class="fa-solid fa-${type==='error'?'circle-exclamation':type==='warn'?'triangle-exclamation':'circle-check'}"></i> ${msg}`;
  t.className = `toast show${type?' '+type:''}`;
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.className = 'toast', 2800);
}

function setLoading(on) {
  document.getElementById('loadingOverlay').style.display = on ? 'flex' : 'none';
}

function payIcon(method) {
  return method === 'cash'
    ? '<i class="fa-solid fa-money-bill-wave" style="color:var(--brand);font-size:11px;"></i> Cash'
    : '<i class="fa-solid fa-qrcode" style="color:var(--gold);font-size:11px;"></i> QRIS';
}

function statusBadge(st) {
  const map = { pending:'badge-pending', diproses:'badge-diproses', selesai:'badge-selesai', dibatalkan:'badge-dibatalkan' };
  const label = { pending:'menunggu bayar', diproses:'diproses', selesai:'selesai', dibatalkan:'dibatalkan' };
  return `<span class="badge ${map[st]||''}">${label[st] || st}</span>`;
}

function queueNo(index) {
  return 'A' + String(index + 1).padStart(2, '0');
}

/* Ambil/buat nomor antrian permanen per order_code, persist di localStorage */
const _ORDER_NUM_KEY = 'berkesan_order_nums';

function _getOrderNums() {
  try {
    const raw = JSON.parse(localStorage.getItem(_ORDER_NUM_KEY) || '{}');
    // Reset jika beda hari
    if (raw._date !== _todayStr()) return { _date: _todayStr() };
    return raw;
  } catch { return { _date: _todayStr() }; }
}

function _assignOrderNum(orderCode) {
  const nums = _getOrderNums();
  if (!nums[orderCode]) {
    // Hitung berapa order yang sudah punya nomor hari ini
    const count = Object.keys(nums).filter(k => k !== '_date').length + 1;
    nums[orderCode] = count;
    localStorage.setItem(_ORDER_NUM_KEY, JSON.stringify(nums));
  }
  return nums[orderCode];
}

/* ═══════════════════════════════
   CLOCK
═══════════════════════════════ */
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = String(now.getSeconds()).padStart(2,'0');
  document.getElementById('clockDisplay').textContent = `${h}:${m}:${s}`;
}
setInterval(updateClock, 1000);
updateClock();

/* ═══════════════════════════════
   NAVIGATION
═══════════════════════════════ */
const PAGE_META = {
  pesanan: ['Pesanan Masuk', 'Kelola & proses pesanan customer'],
  scan:    ['Scan Barcode', 'Cari & proses order via kode / kamera'],
  antrian: ['Nomor Antrian', 'Panggil nomor antrian customer'],
  riwayat: ['Riwayat Transaksi', 'Rekap transaksi kasir hari ini'],
};

function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-' + name).classList.add('active');
  document.querySelectorAll('.sb-item').forEach(b => b.classList.remove('active'));
  const idx = { pesanan:0, scan:1, antrian:2, riwayat:3 };
  document.querySelectorAll('.sb-item')[idx[name]]?.classList.add('active');
  document.getElementById('page-title').textContent = PAGE_META[name][0];
  document.getElementById('page-sub').textContent   = PAGE_META[name][1];
  _currentSection = name;
  if (name === 'pesanan') loadOrders();
  if (name === 'antrian') loadAntrian();
  if (name === 'riwayat') loadRiwayat();
}

function refreshCurrent() { showSection(_currentSection); }

/* ═══════════════════════════════
   FETCH WRAPPER
═══════════════════════════════ */
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }, ...opts });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  if (!j.success) throw new Error(j.message || 'Server error');
  return j.data ?? j;
}

/* ═══════════════════════════════
   PESANAN MASUK
═══════════════════════════════ */
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
  document.getElementById('st-pending').textContent  = todayOrders.filter(o => o.status === 'pending').length;
  document.getElementById('st-diproses').textContent = todayOrders.filter(o => o.status === 'diproses').length;
  document.getElementById('st-selesai').textContent  = todayOrders.filter(o => o.status === 'selesai').length;
}

function updateBadges(orders) {
  const active = orders.filter(o => o.status === 'pending' || o.status === 'diproses').length;
  const badge = document.getElementById('badge-pesanan');
  badge.textContent = active;
  badge.classList.toggle('show', active > 0);
}

function filterOrders(status, btn) {
  _filterStatus = status;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderOrders(_allOrders, status);
}

function renderOrders(orders, filter = 'all') {
  const list = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const grid  = document.getElementById('orderGrid');
  const empty = document.getElementById('emptyOrders');
  if (!list.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = list.map(o => orderCardHtml(o)).join('');
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
    await apiFetch(`${API}/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    showToast(`Order berhasil di-${labels[status]||status}`);
    closeOrderModal();
    await loadOrders();
    if (status === 'selesai') await loadAntrian();
  } catch(e) {
    showToast('Gagal update status: ' + e.message, 'error');
  } finally { setLoading(false); }
}

/* ═══════════════════════════════
   ORDER DETAIL MODAL
═══════════════════════════════ */
async function openOrderModal(id) {
  setLoading(true);
  try {
    const data = await apiFetch(`${API}/orders/${id}`);
    const o = data.order;
    const items = data.items || [];
    const subtotal = items.reduce((s, i) => s + Number(i.subtotal), 0);
    const canProcess  = o.status === 'pending';
    const canComplete = o.status === 'diproses';
    const canCancel   = o.status === 'pending' || o.status === 'diproses';

    document.getElementById('orderModalContent').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        <div>
          <div class="modal-label">Kode Order</div>
          <div class="modal-val" style="color:var(--brand);">${o.order_code}</div>
        </div>
        <div>
          <div class="modal-label">Status</div>
          <div>${statusBadge(o.status)}</div>
        </div>
        <div>
          <div class="modal-label">Pelanggan / Meja</div>
          <div class="modal-val">${o.customer_name||'—'}${o.table_number ? ' • Meja ' + o.table_number : ''}</div>
        </div>
        <div>
          <div class="modal-label">Metode Bayar</div>
          <div class="modal-val">${payIcon(o.payment_method)}</div>
        </div>
        <div>
          <div class="modal-label">Waktu</div>
          <div class="modal-val">${fmtDateTime(o.created_at)}</div>
        </div>
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
    document.getElementById('orderModal').classList.add('open');
  } catch(e) {
    showToast('Gagal memuat detail: ' + e.message, 'error');
  } finally { setLoading(false); }
}

function closeOrderModal() {
  document.getElementById('orderModal').classList.remove('open');
}

/* ═══════════════════════════════
   SCAN BARCODE
═══════════════════════════════ */
async function lookupOrder() {
  const val = document.getElementById('manualOrderId').value.trim();
  if (!val) { showToast('Masukkan kode order', 'warn'); return; }
  setLoading(true);
  try {
    const data = await apiFetch(`${API}/orders/lookup?code=${encodeURIComponent(val)}`);
    showLookupResult(data.order, data.items || []);
  } catch(e) {
    document.getElementById('lookupResult').innerHTML = `
      <div style="background:var(--red-pale);border:1px solid #fecaca;border-radius:10px;padding:14px;color:var(--red);font-size:13px;">
        <i class="fa-solid fa-circle-exclamation"></i> Order tidak ditemukan: <strong>${val}</strong>
      </div>`;
    document.getElementById('lookupResult').style.display = 'block';
  } finally { setLoading(false); }
}

function showLookupResult(o, items) {
  const canProcess  = o.status === 'pending';
  const canComplete = o.status === 'diproses';
  const el = document.getElementById('lookupResult');
  el.style.display = 'block';
  el.innerHTML = `
    <div class="lookup-card">
      <div class="lookup-header">
        <div class="lookup-code">${o.order_code}</div>
        ${statusBadge(o.status)}
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">
        ${o.customer_name||'—'} &nbsp;•&nbsp; ${payIcon(o.payment_method)}
      </div>
      <div class="lookup-items">
        ${items.map(i=>`${i.menu_name} ×${i.quantity}`).join('<br>')}
      </div>
      <div class="lookup-row">
        <div class="lookup-total">${fmtRp(o.total_price, false)}</div>
        <div style="font-size:11px;color:var(--muted);">${fmtDateTime(o.created_at)}</div>
      </div>
      <div class="lookup-actions">
         ${canProcess  ? `<button class="btn btn-primary btn-sm" onclick="updateOrderStatus(${o.id},'diproses');document.getElementById('lookupResult').style.display='none'"><i class="fa-solid fa-money-bill-wave"></i> Konfirmasi Bayar</button>` : ''}
        ${canComplete ? `<button class="btn btn-primary btn-sm" onclick="updateOrderStatus(${o.id},'selesai');document.getElementById('lookupResult').style.display='none'"><i class="fa-solid fa-check"></i> Selesai</button>` : ''}
        <button class="btn btn-outline btn-sm" onclick="openOrderModal(${o.id})"><i class="fa-solid fa-eye"></i> Detail</button>
      </div>
    </div>
  `;
}

/* ── Camera scan ── */
function openScanOverlay() {
  document.getElementById('scanOverlay').classList.add('open');
  startScan();
}

function closeScanOverlay() {
  stopScan();
  document.getElementById('scanOverlay').classList.remove('open');
}

function startScan() {
  if (!window.ZXing) { showToast('Library ZXing tidak tersedia', 'error'); return; }
  const video = document.getElementById('scanVideo');
  _scanReader = new ZXing.BrowserMultiFormatReader();
  _scanReader.decodeFromVideoDevice(null, video, (result, err) => {
    if (result) {
      const code = result.getText();
      closeScanOverlay();
      document.getElementById('manualOrderId').value = code;
      showSection('scan');
      lookupOrder();
    }
  });
}

function stopScan() {
  if (_scanReader) { _scanReader.reset(); _scanReader = null; }
}

/* ═══════════════════════════════
   ANTRIAN - FIXED VERSION
═══════════════════════════════ */
async function loadAntrian() {
  try {
    const data = await apiFetch(`${API}/queue`);
    _queueOrders = data.orders || [];
    
    // Buat mapping order_code → order data untuk akses cepat
    const orderMap = {};
    _queueOrders.forEach(o => {
      orderMap[o.order_code] = o;
    });
    
    renderAntrian(_queueOrders, orderMap);
  } catch(e) {
    showToast('Gagal memuat antrian', 'error');
  }
}

function renderAntrian(orders, orderMap = {}) {
  const list  = document.getElementById('queueList');
  const empty = document.getElementById('emptyQueue');
  const badge = document.getElementById('queueCount');
  badge.textContent = orders.length + ' item';

  // update sidebar badge
  const sbBadge = document.getElementById('badge-antrian');
  sbBadge.textContent = orders.length;
  sbBadge.classList.toggle('show', orders.length > 0);

  if (!orders.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = orders.map((o) => {
    const num = 'A' + String(_assignOrderNum(o.order_code)).padStart(2, '0');
    return `
    <div class="queue-item ${o.status === 'pending' ? 'wait' : ''}">
      <div class="queue-item-num">${num}</div>
      <div class="queue-item-detail">
        <div class="queue-item-code">${o.customer_name||'—'}${o.table_number ? ' • Meja ' + o.table_number : ''}</div>
        <div class="queue-item-meta">${o.order_code} • ${payIcon(o.payment_method)}</div>
      </div>
      <div class="queue-item-status">${statusBadge(o.status)}</div>
    </div>`;
  }).join('');
}

function callNext() {
  if (!_queueOrders.length) {
    showToast('Tidak ada antrian', 'warn');
    return;
  }
  
  // Cari order yang sedang diproses, jika tidak ada ambil yang pending pertama
  const next = _queueOrders.find(o => o.status === 'diproses') || 
               _queueOrders.find(o => o.status === 'pending');
  
  if (!next) {
    showToast('Tidak ada order yang bisa dipanggil', 'warn');
    return;
  }
  
  // Increment counter harian
  const count = _getQueueCounter() + 1;
  _setQueueCounter(count);
  const number = 'A' + String(count).padStart(2, '0');
  
  // Simpan mapping nomor → order data
  _addQueueMapping(number, next);
  
  _currentQNum = number;
  document.getElementById('currentQueue').textContent = number;
  document.getElementById('queueOrderCode').textContent = 
    `${next.customer_name || next.order_code}${next.table_number ? ' - Meja ' + next.table_number : ''}`;
  
  showToast(`Memanggil antrian ${number}`);
  announceQueue(number, next.customer_name);
}

function callSpecific() {
  const input = document.getElementById('callSpecificInput');
  const n = parseInt(input.value);
  if (!n || n < 1) { showToast('Masukkan nomor antrian yang valid', 'warn'); return; }
  
  const number = 'A' + String(n).padStart(2, '0');
  
  // Cari order berdasarkan nomor urutan di daftar
  const order = _queueOrders[n - 1];
  
  if (!order) {
    showToast('Nomor antrian tidak ditemukan', 'warn');
    return;
  }
  
  const customerName = order.customer_name || '';
  
  // Update counter jika perlu
  _setQueueCounter(Math.max(_getQueueCounter(), n));
  
  // Simpan mapping
  _addQueueMapping(number, order);
  
  _currentQNum = number;
  document.getElementById('currentQueue').textContent = number;
  document.getElementById('queueOrderCode').textContent = customerName
    ? `${customerName}${order?.table_number ? ' - Meja ' + order.table_number : ''}`
    : `Antrian ${number}`;
  
  showToast(`Memanggil antrian ${number}`);
  announceQueue(number, customerName);
  input.value = '';
}

function resetQueue() {
  if (!confirm('Reset semua nomor antrian? Nomor akan mulai dari 1 lagi besok.')) return;
  _setQueueCounter(0);
  localStorage.removeItem(_QUEUE_KEY);
  localStorage.removeItem(_QUEUE_MAP_KEY);
  localStorage.removeItem(_ORDER_NUM_KEY);
  _currentQNum = null;
  document.getElementById('currentQueue').textContent = '—';
  document.getElementById('queueOrderCode').textContent = 'Belum ada panggilan';
  showToast('Antrian direset');
}

function announceQueue(number, customerName) {
  if (!window.speechSynthesis) return;
  
  const digits = number.slice(1);
  const spoken = number[0] + ' ' + digits.split('').join(' ');
  const namePart = customerName ? `, atas nama ${customerName},` : ',';
  const text = `Nomor antrian ${spoken}${namePart} silakan mengambil pesanan`;
  
  // Batalkan pengumuman sebelumnya
  window.speechSynthesis.cancel();
  
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'id-ID';
  utter.rate = 0.9;
  utter.pitch = 1;
  utter.volume = 1;
  
  window.speechSynthesis.speak(utter);
}

/* ═══════════════════════════════
   RIWAYAT
═══════════════════════════════ */
async function loadRiwayat() {
  setLoading(true);
  try {
    const data = await apiFetch(`${API}/history`);
    const orders = data.orders || [];
    renderRiwayat(orders);
  } catch(e) {
    showToast('Gagal memuat riwayat: ' + e.message, 'error');
  } finally { setLoading(false); }
}

function renderRiwayat(orders) {
  const today = new Date().toDateString();
  document.getElementById('rw-date').textContent = todayStr();

  const done  = orders.filter(o => o.status !== 'dibatalkan');
  const total = done.reduce((s, o) => s + Number(o.total_price), 0);
  const qris  = done.filter(o => o.payment_method === 'qris').length;
  const cash  = done.filter(o => o.payment_method === 'cash').length;
  document.getElementById('rw-count').textContent = orders.length;
  document.getElementById('rw-total').textContent = fmtRp(total);
  document.getElementById('rw-qris').textContent  = qris;
  document.getElementById('rw-cash').textContent  = cash;

  const tbody = document.getElementById('historyTbody');
  const empty = document.getElementById('emptyHistory');
  if (!orders.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><code style="font-size:11px;color:var(--brand);">${o.order_code}</code></td>
      <td>${o.customer_name||'—'}</td>
      <td style="color:var(--muted);font-size:11px;">${o.item_count||'—'} item</td>
      <td style="font-weight:700;">${fmtRp(o.total_price)}</td>
      <td>${payIcon(o.payment_method)}</td>
      <td>${statusBadge(o.status)}</td>
      <td style="color:var(--muted);font-size:11px;">${fmtTime(o.created_at)}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="openOrderModal(${o.id})">
          <i class="fa-solid fa-eye"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

/* ═══════════════════════════════
   PRINT RECEIPT
═══════════════════════════════ */
function printReceipt(order, items) {
  const el = document.getElementById('receiptPrint');
  const now = new Date().toLocaleString('id-ID');
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
      <div><strong>Pembayaran:</strong> ${order.payment_method?.toUpperCase()}
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
  window.print();
}

function printSummary() {
  const rows = document.querySelectorAll('#historyTbody tr');
  if (!rows.length) { showToast('Tidak ada data untuk diprint', 'warn'); return; }
  const el = document.getElementById('receiptPrint');
  const total = document.getElementById('rw-total').textContent;
  const count = document.getElementById('rw-count').textContent;
  el.innerHTML = `
    <div style="text-align:center;margin-bottom:12px;">
      <div style="font-size:16px;font-weight:900;">☕ BERKESAN COFFEE</div>
      <div style="font-size:11px;">Ringkasan Kasir — ${todayStr()}</div>
      <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>
    </div>
    <div><strong>Total Transaksi :</strong> ${count}</div>
    <div><strong>Total Pendapatan:</strong> ${total}</div>
    <div><strong>QRIS :</strong> ${document.getElementById('rw-qris').textContent}</div>
    <div><strong>Cash :</strong> ${document.getElementById('rw-cash').textContent}</div>
    <div style="border-top:1px dashed #ccc;margin:8px 0;"></div>
    <div style="text-align:center;font-size:11px;color:#666;">Berkesan Coffee</div>
  `;
  window.print();
}

/* ═══════════════════════════════
   LOGOUT
═══════════════════════════════ */
function handleLogout() {
  if (confirm('Yakin ingin logout?')) window.location.href = '/login';
}

/* ═══════════════════════════════
   AUTO REFRESH (30s)
═══════════════════════════════ */
_autoRefresh = setInterval(() => {
  if (_currentSection === 'pesanan') loadOrders();
  if (_currentSection === 'antrian') loadAntrian();
}, 30_000);

/* ═══════════════════════════════
   INIT
═══════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  loadOrders();
});