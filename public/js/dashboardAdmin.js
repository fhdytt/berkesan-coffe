/* ── Auth Guard ── */
(function () {
  document.body.style.display = 'block';
  const token = localStorage.getItem('token');
  const user  = JSON.parse(localStorage.getItem('user') || 'null');
  if (!token || !user || !['admin', 'dev'].includes(user.role)) {
    window.location.replace('/login');
  }
})();

    window.addEventListener("load", () => {
        if (!window.QRCode) {
          const script = document.createElement("script");
          script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
          document.head.appendChild(script);
        }
      });
  
  /* ═══════════════════════════════════════════
       CONFIG
    ═══════════════════════════════════════════ */
    const API_BASE = `${BACKEND_URL}/api/dashboard`;
    const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

    /* ═══════════════════════════════════════════
       UTILITY
    ═══════════════════════════════════════════ */
    function fmtRp(val, short = true) {
      const n = Number(val) || 0;
      if (short) {
        if (n >= 1_000_000) return 'Rp ' + (n / 1_000_000).toFixed(1).replace('.0','') + 'jt';
        if (n >= 1_000) return 'Rp ' + (n / 1_000).toFixed(0) + 'k';
        return 'Rp ' + n;
      }
      return 'Rp ' + n.toLocaleString('id-ID');
    }
    function fmtDate(str) {
      if (!str) return '—';
      const d = new Date(str);
      return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    }
    function fmtDateOnly(str) {
      if (!str) return '—';
      const d = new Date(str);
      return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short' });
    }
    function todayLabel() {
      return new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    }
    function showToast(msg, isErr = false) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.className = 'toast show' + (isErr ? ' error' : '');
      setTimeout(() => t.className = 'toast', 2800);
    }
    function setLoading(on) {
      document.getElementById('loadingOverlay').style.display = on ? 'flex' : 'none';
    }
    function statusBadgeHtml(st) {
      const map = { pending:'st-pending', diproses:'st-diproses', selesai:'st-selesai', dibatalkan:'st-dibatalkan' };
      return `<span class="order-status ${map[st]||''}">${st}</span>`;
    }
    function payIcon(method) {
      return method === 'cash'
        ? '<i class="fa-solid fa-money-bill-wave" style="color:var(--brand);font-size:11px;"></i> Cash'
        : '<i class="fa-solid fa-qrcode" style="color:var(--gold);font-size:11px;"></i> QRIS';
    }
        function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[ch]));
    }
    function orderIcoClass(i) { return ['g','o','d','r','g'][i % 5]; }
    function orderIcoIcon(name='') {
      const n = name.toLowerCase();
      if (n.includes('kopi')||n.includes('americano')||n.includes('latte')||n.includes('espresso')) return 'fa-mug-hot';
      if (n.includes('matcha')||n.includes('green')) return 'fa-leaf';
      if (n.includes('croissant')||n.includes('roti')||n.includes('cake')) return 'fa-cookie-bite';
      if (n.includes('es')||n.includes('blend')||n.includes('frappe')) return 'fa-ice-cream';
      if (n.includes('teh')||n.includes('tea')) return 'fa-mug-saucer';
      return 'fa-utensils';
    }

    /* ═══════════════════════════════════════════
       CHART INSTANCES
    ═══════════════════════════════════════════ */
    const _charts = {};
    function destroyChart(id) { if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; } }

    /* ═══════════════════════════════════════════
       CURRENT PAGE
    ═══════════════════════════════════════════ */
    let currentPage = 'dashboard';

    function showPage(page) {
      ['dashboard','rekap','stok','laporan','menu','meja','antrean','users'].forEach(p => {
        document.getElementById('page-'+p).style.display = p === page ? 'flex' : 'none';
      });
      document.querySelectorAll('.sb-item').forEach(el => el.classList.remove('active'));
      const idx = { dashboard:0, rekap:1, stok:2, laporan:3, menu:4, meja:5, antrean:6, users:7 };
      const btns = document.querySelectorAll('.sb-item');
      if (btns[idx[page]]) btns[idx[page]].classList.add('active');

      const titles = {
        dashboard: ['Dashboard Hari Ini', todayLabel()],
        rekap:     ['Rekap Bulanan', 'Statistik penjualan per bulan'],
        stok:      ['Stok Barang', 'Kelola dan pantau inventaris'],
        laporan:   ['Laporan Transaksi', 'Riwayat semua transaksi'],
        menu:      ['Kelola Menu', 'Tambah, edit, dan hapus item menu'],
        meja:      ['Meja & QR Code', 'Generate dan kelola QR Code per meja'],
        antrean:   ['Antrean Aktif', 'Monitor pesanan kasir real-time'],
        users:     ['User Kasir', 'Kelola akun kasir yang bisa login'],
      };
      document.getElementById('page-title').textContent = titles[page][0];
      document.getElementById('page-sub').textContent   = titles[page][1];
      currentPage = page;

      if (page === 'dashboard') loadDashboard();
      if (page === 'rekap')     { initRekapFilters(); loadRekap(); }
      if (page === 'stok')      loadStok();
      if (page === 'laporan')   { initLaporanFilters(); loadLaporan(); }
      if (page === 'menu')      loadMenu();
      if (page === 'meja')      loadMeja();
      if (page === 'antrean')   loadAntrean();
      if (page === 'users')     loadUsers();
    }

    function refreshCurrent() { showPage(currentPage); }

    /* ═══════════════════════════════════════════
       FETCH WRAPPER
    ═══════════════════════════════════════════ */
    async function apiFetch(url, options = {}) {
      const token = localStorage.getItem('token');
      const { headers: extraHeaders, ...restOpts } = options;
      const res = await fetch(url, {
        ...restOpts,
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...extraHeaders,
        },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || json.message || 'HTTP ' + res.status);
      if (!json.success) throw new Error(json.error || json.message || 'Server error');
      return json.data;
    }

    /* ═══════════════════════════════════════════
       PAGE: DASHBOARD
    ═══════════════════════════════════════════ */
    async function loadDashboard() {
      setLoading(true);
      document.getElementById('dashErr').style.display = 'none';
      try {
        const data = await apiFetch(`${API_BASE}/stats`);
        renderDashboard(data);
      } catch (e) {
        document.getElementById('dashErr').style.display = 'flex';
        document.getElementById('dashErrMsg').textContent = 'Gagal memuat: ' + e.message;
        showToast('Gagal memuat dashboard', true);
      } finally { setLoading(false); }
    }

    function renderDashboard(data) {
      document.getElementById('kpi-income').textContent  = fmtRp(data.incomeToday);
      document.getElementById('kpi-orders').textContent  = data.ordersToday;
      document.getElementById('kpi-sold').textContent    = data.productsSold + ' pcs';
      document.getElementById('kpi-lowstock').textContent = (data.lowStock || []).length;
      document.getElementById('kpi-orders-sub').innerHTML = '<i class="fa-solid fa-circle-info"></i> order masuk hari ini';
      document.getElementById('kpi-income-sub').innerHTML = '<i class="fa-solid fa-arrow-trend-up"></i> pendapatan hari ini';
      const lowLen = (data.lowStock || []).length;
      document.getElementById('notifDot').style.display = lowLen > 0 ? 'block' : 'none';
      renderSalesChart(data.salesChart || []);
      renderRecentOrders(data.recentOrders || []);
      renderBestProducts(data.bestProducts || []);
      renderLowStock(data.lowStock || []);
      const queue = (data.recentOrders || []).filter(o => o.status === 'pending' || o.status === 'diproses');
      renderDashQueue(queue);
    }

    function renderSalesChart(rows) {
      destroyChart('salesChart');
      const labels = rows.map(r => fmtDateOnly(r.tanggal));
      const vals   = rows.map(r => Number(r.total));
      const ctx = document.getElementById('salesChart');
      _charts['salesChart'] = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: 'Pendapatan', data: vals, borderColor: '#4a6741', backgroundColor: 'rgba(74,103,65,0.12)', fill: true, tension: 0.4, pointBackgroundColor: '#4a6741', pointRadius: 4, pointHoverRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtRp(c.raw, false) } } }, scales: { y: { grid: { color: '#e8ede4' }, ticks: { callback: v => fmtRp(v), font: { size: 10 } }, beginAtZero: true }, x: { grid: { display: false }, ticks: { font: { size: 10 } } } } }
      });
    }

    function renderRecentOrders(orders) {
      const el = document.getElementById('recentOrdersList');
      if (!orders.length) { el.innerHTML = '<div class="empty"><i class="fa-solid fa-receipt"></i>Belum ada pesanan</div>'; return; }
      el.innerHTML = orders.map((o, i) => `
        <div class="order-item">
          <div class="order-ico ${orderIcoClass(i)}"><i class="fa-solid ${orderIcoIcon(o.customer_name)}"></i></div>
          <div style="flex:1;min-width:0;"><div class="order-name">${o.order_code}</div><div class="order-meta">${o.customer_name||'—'} • ${payIcon(o.payment_method)}</div></div>
          ${statusBadgeHtml(o.status)}
          <div class="order-price">${fmtRp(o.total_price)}</div>
        </div>`).join('');
    }

    function renderBestProducts(prods) {
      const tbody = document.getElementById('bestProductsTbody');
      if (!prods.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Belum ada data produk</td></tr>'; return; }
      const badges = ['b-best','b-trend','b-pop','b-pop','b-slow'];
      const labels = ['Best Seller','Trending','Popular','Popular','Slow Move'];
      tbody.innerHTML = prods.map((p, i) => `<tr><td style="color:var(--muted);font-weight:700;">${i+1}</td><td class="prod-name">${p.menu_name}</td><td>${p.sold} pcs</td><td>${fmtRp(p.revenue)}</td><td><span class="badge ${badges[i]||'b-slow'}">${labels[i]||'—'}</span></td></tr>`).join('');
    }

    function renderLowStock(items) {
      const el = document.getElementById('lowStockList');
      document.getElementById('lowStockBadge').textContent = items.length;
      if (!items.length) { el.innerHTML = '<div class="empty"><i class="fa-solid fa-check-circle" style="color:var(--brand);"></i>Semua stok aman</div>'; return; }
      el.innerHTML = items.map(item => {
        const qty = Number(item.stock);
        const cls = qty <= 3 ? 'crit' : qty <= 7 ? 'warn' : 'low';
        return `<div class="stock-item ${cls}"><div><div class="stock-name">${item.name}</div><div class="stock-min">Stok tersisa</div></div><div class="stock-qty ${cls}">${qty}</div></div>`;
      }).join('');
    }

    function renderDashQueue(orders) {
      const el = document.getElementById('queueList');
      document.getElementById('queueBadge').textContent = orders.length;
      if (!orders.length) { el.innerHTML = '<div class="empty"><i class="fa-solid fa-ticket"></i>Tidak ada antrean</div>'; return; }
      el.innerHTML = orders.map((o, i) => `
        <div class="queue-item ${o.status==='pending'?'wait':''}">
          <div class="queue-num">A${String(i+1).padStart(2,'0')}</div>
          <div class="queue-detail"><div class="queue-order">${o.order_code}</div><div class="queue-status">${o.status === 'diproses' ? 'Sedang disiapkan' : 'Menunggu'}</div></div>
          <div class="queue-time">${o.status==='diproses'?'Proses':'Antri'}</div>
        </div>`).join('');
    }

    /* ═══════════════════════════════════════════
       PAGE: REKAP BULANAN
    ═══════════════════════════════════════════ */
    function initRekapFilters() {
      const now = new Date();
      const mSel = document.getElementById('rekapMonth');
      const ySel = document.getElementById('rekapYear');
      if (mSel.options.length) return;
      MONTH_NAMES.forEach((m, i) => { const o = document.createElement('option'); o.value = String(i+1).padStart(2,'0'); o.textContent = m; if (i === now.getMonth()) o.selected = true; mSel.appendChild(o); });
      for (let y = now.getFullYear(); y >= now.getFullYear()-3; y--) { const o = document.createElement('option'); o.value = y; o.textContent = y; if (y === now.getFullYear()) o.selected = true; ySel.appendChild(o); }
    }

    async function loadRekap() {
      setLoading(true);
      const month = document.getElementById('rekapMonth').value;
      const year  = document.getElementById('rekapYear').value;
      try { const data = await apiFetch(`${API_BASE}/rekap?month=${month}&year=${year}`); renderRekap(data); }
      catch(e) { showToast('Gagal memuat rekap: ' + e.message, true); }
      finally { setLoading(false); }
    }

    function renderRekap(data) {
      document.getElementById('rek-income').textContent = fmtRp(data.totalIncome);
      document.getElementById('rek-orders').textContent = data.totalOrders;
      document.getElementById('rek-sold').textContent   = data.totalSold;
      const avg = data.totalOrders > 0 ? Math.round(data.totalIncome / data.totalOrders) : 0;
      document.getElementById('rek-avg').textContent    = fmtRp(avg);
      if (data.prevIncome != null) {
        const diff = data.totalIncome - data.prevIncome;
        const pct  = data.prevIncome > 0 ? ((diff / data.prevIncome) * 100).toFixed(1) : 0;
        const el   = document.getElementById('rek-income-ch');
        el.textContent = (diff >= 0 ? '↑ +' : '↓ ') + pct + '% vs bulan lalu';
        el.style.color = diff >= 0 ? '#2a7a3a' : 'var(--red)';
        const elO = document.getElementById('rek-orders-ch');
        const diffO = data.totalOrders - (data.prevOrders||0);
        elO.textContent = (diffO >= 0 ? '↑ +' : '↓ ') + diffO + ' order vs bulan lalu';
        elO.style.color = diffO >= 0 ? '#2a7a3a' : 'var(--red)';
      }
      destroyChart('rekapChart');
      const labels = (data.daily||[]).map(r => fmtDateOnly(r.tanggal));
      const vals   = (data.daily||[]).map(r => Number(r.total));
      _charts['rekapChart'] = new Chart(document.getElementById('rekapChart'), {
        type: 'bar',
        data: { labels, datasets: [{ label:'Pendapatan', data: vals, backgroundColor: 'rgba(74,103,65,0.75)', borderRadius: 5, borderSkipped: false }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtRp(c.raw, false) } } }, scales: { y: { grid: { color: '#e8ede4' }, ticks: { callback: v => fmtRp(v), font: { size: 10 } }, beginAtZero: true }, x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 15 } } } }
      });
      const prods = data.bestProducts || [];
      const maxRev = prods.reduce((m,p) => Math.max(m, Number(p.revenue)), 1);
      const barColors = ['','gold','amber','red','gray'];
      document.getElementById('rekapProdBars').innerHTML = prods.map((p, i) => `
        <div class="pbar-row"><div class="pbar-lbl"><span>${p.menu_name}</span><span>${fmtRp(p.revenue)} • ${p.sold} pcs</span></div>
        <div class="pbar"><div class="pbar-fill ${barColors[i]||''}" style="width:${Math.round(Number(p.revenue)/maxRev*100)}%"></div></div></div>`).join('');
      document.getElementById('rekapProdTbody').innerHTML = prods.map((p, i) => `<tr><td style="color:var(--muted);font-weight:700;">${i+1}</td><td class="prod-name">${p.menu_name}</td><td>${p.sold} pcs</td><td>${fmtRp(p.revenue, false)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Tidak ada data</td></tr>';
      destroyChart('payChart');
      const payData = data.paymentSummary || [];
      const payColors = { cash: '#4a6741', qris: '#8a6c2a' };
      const payLabels = payData.map(p => p.payment_method.toUpperCase());
      const payVals   = payData.map(p => Number(p.total_income));
      const payTotal  = payVals.reduce((a,b)=>a+b,0);
      document.getElementById('payLegend').innerHTML = payData.map((p, i) => `<span><span class="legend-dot" style="background:${Object.values(payColors)[i]||'#888'}"></span>${p.payment_method.toUpperCase()} — ${fmtRp(p.total_income)} (${payTotal > 0 ? Math.round(Number(p.total_income)/payTotal*100) : 0}%)</span>`).join('');
      _charts['payChart'] = new Chart(document.getElementById('payChart'), {
        type: 'doughnut',
        data: { labels: payLabels, datasets: [{ data: payVals, backgroundColor: payData.map((p,i)=>Object.values(payColors)[i]||'#888'), borderWidth: 0, hoverOffset: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.label + ': ' + fmtRp(c.raw, false) } } } }
      });
    }

    function exportRekap() { exportTableCSV('rekapProdTable', 'rekap-produk-' + document.getElementById('rekapMonth').value + '-' + document.getElementById('rekapYear').value); }

    /* ═══════════════════════════════════════════
       PAGE: STOK
    ═══════════════════════════════════════════ */
    let _stokData = [];
    async function loadStok() {
      setLoading(true);
      try { const data = await apiFetch(`${API_BASE}/stok`); _stokData = data.items || []; filterStok('all', document.querySelector('.in-tab.active')); }
      catch(e) { document.getElementById('stokGrid').innerHTML = `<div class="err-row" style="grid-column:1/-1;"><i class="fa-solid fa-circle-exclamation"></i> Gagal memuat stok: ${e.message}</div>`; showToast('Gagal memuat stok', true); }
      finally { setLoading(false); }
    }
    function filterStok(filter, btn) {
      document.querySelectorAll('.in-tab').forEach(t => t.classList.remove('active'));
      if (btn) btn.classList.add('active');
      let items = _stokData;
      if (filter === 'kritis')  items = items.filter(i => i.stock <= 5);
      if (filter === 'menipis') items = items.filter(i => i.stock > 5 && i.stock <= 10);
      if (filter === 'aman')    items = items.filter(i => i.stock > 10);
      renderStokGrid(items);
    }
    function renderStokGrid(items) {
      const grid = document.getElementById('stokGrid');
      if (!items.length) { grid.innerHTML = '<div class="empty" style="grid-column:1/-1;"><i class="fa-solid fa-box-open"></i>Tidak ada item</div>'; return; }
      const maxStock = Math.max(...items.map(i => Number(i.stock)), 1);
      grid.innerHTML = items.map(item => {
        const qty = Number(item.stock);
        const pct = Math.min(Math.round(qty / maxStock * 100), 100);
        const [cls, fillCls, qCls] = qty <= 5 ? ['crit','pbar-fill red','crit'] : qty <= 10 ? ['warn','pbar-fill amber','warn'] : ['ok','pbar-fill','ok'];
        return `<div class="stok-big-card"><div style="display:flex;justify-content:space-between;align-items:flex-start;"><div><div class="stok-big-name">${item.name}</div><div class="stok-big-cat">${item.kategori_name||'Umum'} • ${item.is_available ? '<span style="color:var(--brand);">Tersedia</span>' : '<span style="color:var(--red);">Nonaktif</span>'}</div></div><span class="badge ${cls==='crit'?'b-slow':cls==='warn'?'b-pop':'b-best'}">${cls==='crit'?'Kritis':cls==='warn'?'Menipis':'Aman'}</span></div><div class="stok-big-qty" style="color:var(--${qCls==='ok'?'brand':qCls==='warn'?'amber':'red'})">${qty}</div><div class="stok-pbar"><div class="${fillCls}" style="width:${pct}%"></div></div><div class="stok-big-footer"><span>Harga: ${fmtRp(item.price, false)}</span><span>${pct}% stok tersisa</span></div></div>`;
      }).join('');
    }

    /* ═══════════════════════════════════════════
       PAGE: LAPORAN
    ═══════════════════════════════════════════ */
    function initLaporanFilters() {
      const tgl = document.getElementById('lapTgl');
      if (!tgl.value) tgl.value = new Date().toISOString().split('T')[0];
      tgl.addEventListener('change', loadLaporan);
    }
    async function loadLaporan() {
      setLoading(true);
      const tgl     = document.getElementById('lapTgl').value;
      const status  = document.getElementById('lapStatus').value;
      const payment = document.getElementById('lapPayment').value;
      let url = `${API_BASE}/laporan?`;
      if (tgl)     url += `date=${tgl}&`;
      if (status)  url += `status=${status}&`;
      if (payment) url += `payment=${payment}&`;
      try { const data = await apiFetch(url); renderLaporan(data.orders || []); }
      catch(e) { showToast('Gagal memuat laporan: ' + e.message, true); }
      finally { setLoading(false); }
    }
    function renderLaporan(orders) {
      const total = orders.filter(o=>o.status!=='dibatalkan').reduce((s,o)=>s+Number(o.total_price),0);
      const count = orders.length;
      const valid = orders.filter(o=>o.status!=='dibatalkan');
      const avg   = valid.length > 0 ? Math.round(total / valid.length) : 0;
      document.getElementById('lap-total').textContent = fmtRp(total);
      document.getElementById('lap-count').textContent = count;
      document.getElementById('lap-avg').textContent   = fmtRp(avg);
      const tbody = document.getElementById('laporanTbody');
      if (!orders.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">Tidak ada transaksi</td></tr>'; return; }
      tbody.innerHTML = orders.map(o => `<tr><td><code style="font-size:11px;color:var(--brand);">${o.order_code}</code></td><td>${o.customer_name||'—'}</td><td style="font-weight:700;">${fmtRp(o.total_price)}</td><td>${payIcon(o.payment_method)}</td><td>${statusBadgeHtml(o.status)}</td><td style="color:var(--muted);font-size:11px;">${fmtDate(o.created_at)}</td></tr>`).join('');
    }

    /* ═══════════════════════════════════════════
       PAGE: KELOLA MENU
    ═══════════════════════════════════════════ */
    let _menuData     = [];
    let _kategoriData = [];
    let _menuKatFilter = 'all';

    async function loadMenu() {
      setLoading(true);
      try {
        // Parallel: menu items + categories
        const [menuRes, katRes] = await Promise.all([
          apiFetch(`${API_BASE}/menu`),
          apiFetch(`${API_BASE}/kategori`)
        ]);
        _menuData     = menuRes.items || [];
        _kategoriData = katRes.items || [];
        buildMenuKatTabs();
        renderMenuStats();
        renderMenuGrid();
      } catch(e) {
        document.getElementById('menuGrid').innerHTML = `<div class="err-row" style="grid-column:1/-1;"><i class="fa-solid fa-circle-exclamation"></i> Gagal memuat menu: ${e.message}</div>`;
        showToast('Gagal memuat menu', true);
      } finally { setLoading(false); }
    }

    function buildMenuKatTabs() {
      const wrap = document.getElementById('menuKatTabs');
      wrap.innerHTML = `<button class="in-tab ${_menuKatFilter==='all'?'active':''}" onclick="filterMenuKat('all',this)" data-kat="all">Semua</button>`;
      if (!_kategoriData.length) return;
      _kategoriData.forEach(k => {
        const btn = document.createElement('button');
        btn.className = 'in-tab' + (_menuKatFilter == k.id ? ' active' : '');
        btn.textContent = k.name;
        btn.dataset.kat = k.id;
        btn.onclick = function() { filterMenuKat(k.id, this); };
        wrap.appendChild(btn);
      });
    }

    function filterMenuKat(kat, btn) {
      _menuKatFilter = kat;
      document.querySelectorAll('#menuKatTabs .in-tab').forEach(t => t.classList.remove('active'));
      if (btn) btn.classList.add('active');
      renderMenuGrid();
    }

    function renderMenuStats() {
      const items = _menuData;
      document.getElementById('menuStatTotal').textContent    = items.length;
      document.getElementById('menuStatAvail').textContent    = items.filter(i=>i.is_available).length;
      document.getElementById('menuStatInactive').textContent = items.filter(i=>!i.is_available).length;
      document.getElementById('menuStatLow').textContent      = items.filter(i=>i.stock<=5).length;
    }

    function renderMenuGrid() {
      const search = (document.getElementById('menuSearch')?.value || '').toLowerCase();
      let items = _menuData.filter(i => i.is_available);

      if (_menuKatFilter !== 'all') items = items.filter(i => i.kategori_id == _menuKatFilter);
      if (search) items = items.filter(i => i.name.toLowerCase().includes(search));

      const grid = document.getElementById('menuGrid');
      if (!items.length) {
        grid.innerHTML = '<div class="empty" style="grid-column:1/-1;"><i class="fa-solid fa-utensils"></i>Tidak ada menu ditemukan</div>';
        return;
      }
      grid.innerHTML = items.map(item => {
        const imgHtml = item.image_url
          ? `<div class="menu-card-img"><img src="${item.image_url}" alt="${item.name}" onerror="this.parentElement.innerHTML='<div style=\\'width:100%;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;background:var(--brand-pale);font-size:36px;\\'>☕</div>'" /></div>`
          : `<div class="menu-card-img-placeholder">☕</div>`;
        const katName = (_kategoriData.find(k => k.id == item.kategori_id) || {}).name || '—';
        const stockCls = item.stock <= 5 ? 'b-slow' : item.stock <= 10 ? 'b-pop' : 'b-best';
        return `
          <div class="menu-card">
            ${imgHtml}
            <div class="menu-card-body">
              <div class="menu-card-name">${item.name}</div>
              <div class="menu-card-cat">${katName}</div>
              <div style="font-size:10px;color:var(--muted);">Stok: <span class="badge ${stockCls}">${item.stock}</span></div>
              <div class="menu-card-price">${fmtRp(item.price, false)}</div>
            </div>
            <div class="menu-card-footer">
              <span class="menu-avail ${item.is_available ? 'avail-yes' : 'avail-no'}">${item.is_available ? 'Tersedia' : 'Nonaktif'}</span>
              <div class="menu-actions">
                <button class="btn-edit-sm" onclick="openModalMenuEdit(${item.id})" title="Edit"><i class="fa-solid fa-pencil"></i></button>
                <button class="btn-del-sm" onclick="confirmDeleteMenu(${item.id}, '${item.name.replace(/'/g,"\\'")}')"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          </div>`;
      }).join('');
    }

    /* ── Modal Menu ── */
    let _editMenuId = null;

    function openModalMenuNew() {
      _editMenuId = null;
      document.getElementById('modalMenuTitle').textContent = 'Tambah Menu Baru';
      document.getElementById('menuId').value = '';
      document.getElementById('menuName').value = '';
      document.getElementById('menuPrice').value = '';
      document.getElementById('menuStock').value = '';
      document.getElementById('menuAvailable').checked = true;
      document.getElementById('menuImageUrl').value = '';
      resetImgUpload();
      populateKategoriSelect();
      document.getElementById('modalMenu').classList.remove('hidden');
    }

    function openModalMenuEdit(id) {
      const item = _menuData.find(i => i.id == id);
      if (!item) return;
      _editMenuId = id;
      document.getElementById('modalMenuTitle').textContent = 'Edit Menu';
      document.getElementById('menuId').value       = item.id;
      document.getElementById('menuName').value     = item.name;
      document.getElementById('menuPrice').value    = item.price;
      document.getElementById('menuStock').value    = item.stock;
      document.getElementById('menuAvailable').checked = !!item.is_available;
      document.getElementById('menuImageUrl').value = item.image_url || '';
      populateKategoriSelect(item.kategori_id);
      // Preview existing image
      const area = document.getElementById('imgUploadArea');
      if (item.image_url) {
        area.classList.add('has-img');
        area.innerHTML = `<img class="img-preview" src="${item.image_url}" alt="preview" onerror="this.src=''" /><input type="file" id="menuImageInput" accept="image/*" style="display:none;" onchange="handleImageUpload(event)" />`;
      } else {
        resetImgUpload();
      }
      document.getElementById('modalMenu').classList.remove('hidden');
    }

    function closeModalMenu() {
      document.getElementById('modalMenu').classList.add('hidden');
    }

    function populateKategoriSelect(selectedId = '') {
      const sel = document.getElementById('menuKategori');
      sel.innerHTML = '<option value="">Pilih kategori…</option>';
      _kategoriData.forEach(k => {
        const o = document.createElement('option');
        o.value = k.id; o.textContent = k.name;
        if (k.id == selectedId) o.selected = true;
        sel.appendChild(o);
      });
    }

    function resetImgUpload() {
      const area = document.getElementById('imgUploadArea');
      area.classList.remove('has-img');
      area.innerHTML = `
        <div class="img-upload-icon"><i class="fa-solid fa-image"></i></div>
        <div style="font-size:12px;font-weight:600;color:var(--muted);">Klik untuk upload foto</div>
        <div class="img-upload-hint">JPG, PNG, WEBP · Maks 2MB</div>
        <input type="file" id="menuImageInput" accept="image/*" style="display:none;" onchange="handleImageUpload(event)" />`;
      area.onclick = () => document.getElementById('menuImageInput').click();
    }

    function handleImageUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { showToast('Ukuran file maksimal 2MB', true); return; }
      const reader = new FileReader();
      reader.onload = e => {
        const area = document.getElementById('imgUploadArea');
        area.classList.add('has-img');
        area.innerHTML = `<img class="img-preview" src="${e.target.result}" alt="preview" /><input type="file" id="menuImageInput" accept="image/*" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;" onchange="handleImageUpload(event)" />`;
        // store as data URL in hidden field (backend should handle saving)
        document.getElementById('menuImageUrl').value = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    function handleImageUrlInput(val) {
      if (!val) { resetImgUpload(); return; }
      const area = document.getElementById('imgUploadArea');
      area.classList.add('has-img');
      area.innerHTML = `<img class="img-preview" src="${val}" alt="preview" onerror="this.src=''" /><input type="file" id="menuImageInput" accept="image/*" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;" onchange="handleImageUpload(event)" />`;
    }

    async function saveMenu() {
      const name      = document.getElementById('menuName').value.trim();
      const kategoriId= document.getElementById('menuKategori').value;
      const price     = document.getElementById('menuPrice').value;
      const stock     = document.getElementById('menuStock').value;
      const available = document.getElementById('menuAvailable').checked;
      const imageUrl  = document.getElementById('menuImageUrl').value.trim();

      if (!name)       { showToast('Nama menu wajib diisi', true); return; }
      if (!kategoriId) { showToast('Pilih kategori', true); return; }
      if (!price)      { showToast('Harga wajib diisi', true); return; }

      const payload = { name, kategori_id: kategoriId, price, stock, is_available: available, image_url: imageUrl };

      setLoading(true);
      try {
        if (_editMenuId) {
          await apiFetch(`${API_BASE}/menu/${_editMenuId}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
          showToast('Menu berhasil diperbarui!');
        } else {
          await apiFetch(`${API_BASE}/menu`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
          showToast('Menu berhasil ditambahkan!');
        }
        closeModalMenu();
        loadMenu();
      } catch(e) {
        showToast('Gagal menyimpan menu: ' + e.message, true);
      } finally { setLoading(false); }
    }

    function confirmDeleteMenu(id, name) {
      document.getElementById('confirmMsg').textContent = `Hapus menu "${name}"?`;
      document.getElementById('confirmOkBtn').onclick = () => deleteMenu(id);
      document.getElementById('modalConfirm').classList.remove('hidden');
    }

    async function deleteMenu(id) {
      closeConfirm();
      setLoading(true);
      try {
        const data = await apiFetch(`${API_BASE}/menu/${id}`, { method: 'DELETE' });
        showToast(data.message || 'Menu berhasil dihapus!');
        loadMenu();
      } catch(e) {
        showToast('Gagal menghapus: ' + e.message, true);
      } finally { setLoading(false); }
    }

    /* ═══════════════════════════════════════════
       PAGE: MEJA & QR CODE
    ═══════════════════════════════════════════ */
    let _mejaData = [];

    async function loadMeja() {
      setLoading(true);
      try {
        const data = await apiFetch(`${API_BASE}/meja`);
        _mejaData = data.tables || [];
        renderMejaGrid();
      } catch(e) {
        // Fallback: render demo data so UI is usable without backend
        _mejaData = [];
        renderMejaGrid();
        showToast('Gagal memuat meja: ' + e.message, true);
      } finally { setLoading(false); }
    }

    function getBaseUrl() {
      return document.getElementById('globalBaseUrl').value || 'https://berkesan.app/menu?table=';
    }

    function onBaseUrlChange() {
      // update URL preview in add-meja modal if open
      const nomor = document.getElementById('mejaNomor')?.value || '';
      document.getElementById('mejaUrlPreview').textContent = getBaseUrl() + nomor;
    }

    function renderMejaGrid() {
      const grid = document.getElementById('mejaGrid');
      const baseUrl = getBaseUrl();

      let html = '';
        _mejaData.forEach((meja) => {
        const tableNumber = String(meja.table_number);
        const safeTable = tableNumber.replace(/'/g, "\\'");
        const url = baseUrl + encodeURIComponent(tableNumber);
        html += `
          <div class="meja-card">
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
              <div class="meja-num">Meja ${escapeHtml(tableNumber)}</div>
              <span class="meja-status ${meja.is_active ? 'meja-active' : 'meja-inactive'}">${meja.is_active ? 'Aktif' : 'Nonaktif'}</span>
            </div>
            <div class="meja-qr" id="qr-wrap-${meja.id}">
              <canvas id="qr-${meja.id}"></canvas>
            </div>
            <div class="meja-url">${escapeHtml(url)}</div>
            <div class="meja-actions">
              <button class="btn-download-qr" onclick="downloadQR('${meja.id}','${safeTable}')"><i class="fa-solid fa-download"></i> Download</button>
              <button class="btn-toggle-meja" onclick="toggleMeja(${meja.id})"><i class="fa-solid fa-power-off"></i></button>
              <button class="btn-del-meja" onclick="confirmDeleteMeja(${meja.id},'${safeTable}')"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>`;
      });

      // Add new card
      html += `<div class="add-meja-card" onclick="openModalMeja()"><i class="fa-solid fa-plus"></i><span>Tambah Meja</span></div>`;
      grid.innerHTML = html;

      // Generate QR codes
      _mejaData.forEach(meja => {
        renderTableQr(meja, baseUrl + encodeURIComponent(meja.table_number));
      });
    }
    function renderStoredQr(meja) {
      const wrap = document.getElementById('qr-wrap-' + meja.id);
      if (!wrap) return;
      if (meja.qr_code) {
        wrap.innerHTML = `<img src="${meja.qr_code}" alt="QR Meja ${escapeHtml(meja.table_number)}" />`;
        return;
      }
      wrap.innerHTML = '<span style="font-size:10px;color:var(--red);text-align:center;padding:8px;">QR library belum termuat</span>';
    }

    function renderTableQr(meja, url, attempt = 0) {
      const wrap = document.getElementById('qr-wrap-' + meja.id);
      if (!wrap) return;
      if (window.QRCode && typeof QRCode.toCanvas === 'function') {
        wrap.innerHTML = `<canvas id="qr-${meja.id}"></canvas>`;
        const canvas = document.getElementById('qr-' + meja.id);
        QRCode.toCanvas(canvas, url, { width: 120, margin: 1, color: { dark: '#2d3d28', light: '#ffffff' } }, err => {
          if (err) {
            console.warn('QR error:', err);
            renderStoredQr(meja);
          }
        });
        return;
      }

      if (window.QRCode && typeof QRCode === 'function') {
        wrap.innerHTML = '';
        new QRCode(wrap, {
          text: url,
          width: 120,
          height: 120,
          colorDark: '#2d3d28',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel?.M || 0,
        });
        return;
      }
      
      if (attempt < 10) {
        setTimeout(() => renderTableQr(meja, url, attempt + 1), 200);
        return;
      }

      renderStoredQr(meja);
    }

    function regenerateAllQR() {
      renderMejaGrid();
      showToast('QR Code diperbarui!');
    }

    function downloadQR(mejaId, tableNumber) {
      const wrap = document.getElementById('qr-wrap-' + mejaId);
      const canvas = wrap?.querySelector('canvas');
      const img = wrap?.querySelector('img');
      const meja = _mejaData.find(m => String(m.id) === String(mejaId));
      const source = canvas || img;
      if (!source && !meja?.qr_code) { showToast('QR tidak ditemukan', true); return; }

      // Add padding and label to downloaded image
      const pad = 16;
      const out = document.createElement('canvas');
      const size = 200;
      out.width  = size + pad * 2;
      out.height = size + pad * 2 + 34;
      const ctx  = out.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.fillRect(0, 0, out.width, out.height);
      const finish = (drawable) => {
        ctx.drawImage(drawable, pad, pad, size, size);
        ctx.fillStyle = '#2d3d28';
        ctx.font = 'bold 13px Plus Jakarta Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Meja ' + tableNumber + ' - Berkesan Coffee', out.width / 2, out.height - 10);
        const a = document.createElement('a');
        a.download = `qr-meja-${tableNumber}.png`;
        a.href = out.toDataURL('image/png');
        a.click();
        showToast('QR Code Meja ' + tableNumber + ' diunduh!');
      };

      if (canvas) {
        finish(canvas);
        return;
      }

      const image = new Image();
      image.onload = () => finish(image);
      image.onerror = () => showToast('Gagal menyiapkan QR untuk diunduh', true);
      image.src = img?.src || meja.qr_code;
    }

    async function toggleMeja(id) {
      setLoading(true);
      try {
        await apiFetch(`${API_BASE}/meja/${id}/toggle`, { method: 'PATCH' });
        showToast('Status meja diperbarui!');
        loadMeja();
      } catch(e) {
        // Local toggle fallback
        const meja = _mejaData.find(m => m.id == id);
        if (meja) { meja.is_active = !meja.is_active; renderMejaGrid(); showToast('Status diubah (lokal)'); }
      } finally { setLoading(false); }
    }

    function confirmDeleteMeja(id, num) {
      document.getElementById('confirmMsg').textContent = `Hapus Meja ${num} beserta QR Code-nya?`;
      document.getElementById('confirmOkBtn').onclick = () => deleteMeja(id, num);
      document.getElementById('modalConfirm').classList.remove('hidden');
    }

    async function deleteMeja(id, num) {
      closeConfirm();
      setLoading(true);
      try {
        await apiFetch(`${API_BASE}/meja/${id}`, { method: 'DELETE' });
        showToast(`Meja ${num} dihapus!`);
        loadMeja();
      } catch(e) {
        // Local remove fallback
        _mejaData = _mejaData.filter(m => m.id != id);
        renderMejaGrid();
        showToast(`Meja ${num} dihapus (lokal)`);
      } finally { setLoading(false); }
    }

    /* ── Modal Meja ── */
    function openModalMeja() {
      document.getElementById('mejaNomor').value = '';
      document.getElementById('mejaBaseUrl').value = getBaseUrl();
      document.getElementById('mejaUrlPreview').textContent = getBaseUrl();
      document.getElementById('modalMeja').classList.remove('hidden');
    }

    function closeModalMeja() {
      document.getElementById('modalMeja').classList.add('hidden');
    }

    document.getElementById('mejaNomor')?.addEventListener('input', function() {
      const base = document.getElementById('mejaBaseUrl').value;
      document.getElementById('mejaUrlPreview').textContent = base + this.value;
    });

    document.getElementById('mejaBaseUrl')?.addEventListener('input', function() {
      const nomor = document.getElementById('mejaNomor').value;
      document.getElementById('mejaUrlPreview').textContent = this.value + nomor;
    });

    async function saveMeja() {
      const nomor   = document.getElementById('mejaNomor').value.trim();
      const baseUrl = document.getElementById('mejaBaseUrl').value.trim();
      if (!nomor) { showToast('Nomor meja wajib diisi', true); return; }

      setLoading(true);
      const qrUrl = baseUrl + encodeURIComponent(nomor);

      // Generate QR data URL for storage
      let qrDataUrl = '';
      try {
          if (window.QRCode && typeof QRCode.toCanvas === 'function') {
          const tempCanvas = document.createElement('canvas');
          await new Promise((res, rej) => QRCode.toCanvas(tempCanvas, qrUrl, { width: 200, margin: 1 }, e => e ? rej(e) : res()));
          qrDataUrl = tempCanvas.toDataURL('image/png');
        } else if (window.QRCode && typeof QRCode === 'function') {
          const tempWrap = document.createElement('div');
          tempWrap.style.position = 'fixed';
          tempWrap.style.left = '-9999px';
          document.body.appendChild(tempWrap);
          new QRCode(tempWrap, { text: qrUrl, width: 200, height: 200 });
          const img = tempWrap.querySelector('img');
          const canvas = tempWrap.querySelector('canvas');
          qrDataUrl = img?.src || canvas?.toDataURL('image/png') || '';
          tempWrap.remove();
        }
      } catch(e) {
        console.warn('Gagal membuat QR data URL:', e);
      }

      try {
        await apiFetch(`${API_BASE}/meja`, {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ table_number: nomor, qr_code: qrDataUrl })
        });
        showToast(`Meja ${nomor} berhasil ditambahkan!`);
        closeModalMeja();
        loadMeja();
      } catch(e) {
        // Local add fallback
        const newId = Date.now();
        _mejaData.push({ id: newId, table_number: nomor, is_active: true, qr_code: qrDataUrl });
        renderMejaGrid();
        closeModalMeja();
        showToast(`Meja ${nomor} ditambahkan (lokal)`);
      } finally { setLoading(false); }
    }

    /* ═══════════════════════════════════════════
       PAGE: ANTREAN
    ═══════════════════════════════════════════ */
    async function loadAntrean() {
      setLoading(true);
      try { const data = await apiFetch(`${API_BASE}/antrean`); renderAntrean(data); }
      catch(e) { showToast('Gagal memuat antrean: ' + e.message, true); }
      finally { setLoading(false); }
    }

    function renderAntrean(data) {
      const diproses = (data.orders || []).filter(o => o.status === 'diproses');
      const pending  = (data.orders || []).filter(o => o.status === 'pending');
      const selesai  = (data.selesai || []);
      document.getElementById('qDiprosesBadge').textContent = diproses.length;
      document.getElementById('qPendingBadge').textContent  = pending.length;
      document.getElementById('qSelesaiBadge').textContent  = selesai.length;
      const renderQueue = (list, el, nowait = false) => {
        if (!list.length) { el.innerHTML = '<div class="empty"><i class="fa-solid fa-check-circle"></i>Tidak ada</div>'; return; }
        el.innerHTML = list.map((o, i) => `
          <div class="queue-item ${nowait ? '' : (o.status==='pending'?'wait':'')}">
            <div class="queue-num">A${String(i+1).padStart(2,'0')}</div>
            <div class="queue-detail"><div class="queue-order">${o.order_code} — ${o.customer_name||'—'}</div><div class="queue-status">${payIcon(o.payment_method)} • ${fmtRp(o.total_price)}</div></div>
            <div class="queue-time">${o.status==='diproses'?'Proses':'Antri'}</div>
          </div>`).join('');
      };
      renderQueue(diproses, document.getElementById('qDiprosesList'));
      renderQueue(pending,  document.getElementById('qPendingList'));
      const tbody = document.getElementById('qSelesaiTbody');
      if (!selesai.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Tidak ada order selesai hari ini</td></tr>'; return; }
      tbody.innerHTML = selesai.map(o => `<tr><td><code style="font-size:11px;color:var(--brand);">${o.order_code}</code></td><td>${o.customer_name||'—'}</td><td style="font-weight:700;">${fmtRp(o.total_price)}</td><td>${payIcon(o.payment_method)}</td><td style="color:var(--muted);font-size:11px;">${fmtDate(o.created_at)}</td></tr>`).join('');
    }

    /* ═══════════════════════════════════════════
       CONFIRM MODAL
    ═══════════════════════════════════════════ */
    function closeConfirm() {
      document.getElementById('modalConfirm').classList.add('hidden');
    }

    /* ═══════════════════════════════════════════
       EXPORT CSV
    ═══════════════════════════════════════════ */
    function exportTableCSV(tableId, filename) {
      const table = document.getElementById(tableId);
      if (!table) { showToast('Tabel tidak ditemukan', true); return; }
      const rows = [...table.querySelectorAll('tr')];
      const csv  = rows.map(row => [...row.querySelectorAll('th,td')].map(cell => '"' + cell.innerText.replace(/"/g,'""') + '"').join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = filename + '.csv'; a.click();
      URL.revokeObjectURL(url);
      showToast('Export CSV berhasil!');
    }

    /* ═══════════════════════════════════════════
       LOGOUT
    ═══════════════════════════════════════════ */
    function handleLogout() {
      if (confirm('Yakin ingin logout?')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.replace('/login');
      }
    }

    /* ═══════════════════════════════════════════
       AUTO REFRESH ANTREAN (30s)
    ═══════════════════════════════════════════ */
    setInterval(() => { if (currentPage === 'antrean') loadAntrean(); }, 30_000);

    /* ═══════════════════════════════════════════
       INIT
    ═══════════════════════════════════════════ */
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('page-sub').textContent = todayLabel();
      loadDashboard();
    });

    /* ═══════════════════════════════════════════
       USER MANAGEMENT
    ═══════════════════════════════════════════ */
    async function loadUsers() {
      const tbody = document.getElementById('usersTbody');
      tbody.innerHTML = '<tr><td colspan="6" class="empty">Memuat…</td></tr>';
      try {
        const data = await apiFetch(`${API_BASE}/users`);
        const users = data?.users || [];
        if (!users.length) {
          tbody.innerHTML = '<tr><td colspan="6" class="empty">Belum ada user</td></tr>';
          return;
        }
        tbody.innerHTML = users.map((u, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${u.name || '—'}</td>
            <td>${u.username}</td>
            <td><span style="padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:${u.role==='admin'?'#ebf8ff':'#f0fff4'};color:${u.role==='admin'?'#2b6cb0':'#276749'}">${u.role}</span></td>
            <td>${fmtDate(u.created_at)}</td>
            <td><button onclick="deleteUser(${u.id},'${u.username}')" style="padding:4px 10px;border:1px solid #fed7d7;border-radius:6px;background:#fff5f5;color:#c53030;cursor:pointer;font-size:12px;"><i class="fa-solid fa-trash"></i></button></td>
          </tr>`).join('');
      } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Gagal memuat data</td></tr>';
      }
    }

    function openModalUser() {
      document.getElementById('uName').value = '';
      document.getElementById('uUsername').value = '';
      document.getElementById('uPassword').value = '';
      document.getElementById('modalUserErr').style.display = 'none';
      const m = document.getElementById('modalUser');
      m.style.display = 'flex';
    }

    function closeModalUser() {
      document.getElementById('modalUser').style.display = 'none';
    }

    async function submitUser() {
      const name     = document.getElementById('uName').value.trim();
      const username = document.getElementById('uUsername').value.trim();
      const password = document.getElementById('uPassword').value;
      const errEl    = document.getElementById('modalUserErr');

      if (!username || !password) {
        errEl.textContent = 'Username dan password wajib diisi';
        errEl.style.display = 'block';
        return;
      }

      try {
        await apiFetch(`${API_BASE}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, username, password, role: 'kasir' }),
        });
        closeModalUser();
        showToast('User kasir berhasil ditambahkan!');
        loadUsers();
      } catch (e) {
        errEl.textContent = e.message || 'Gagal menyimpan user';
        errEl.style.display = 'block';
      }
    }

    async function deleteUser(id, username) {
      if (!confirm(`Hapus user "${username}"?`)) return;
      try {
        await apiFetch(`${API_BASE}/users/${id}`, { method: 'DELETE' });
        showToast('User berhasil dihapus');
        loadUsers();
      } catch (e) {
        showToast(e.message || 'Gagal menghapus user', true);
      }
    }
