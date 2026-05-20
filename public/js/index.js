// ---------- ADMIN SIMULASI DATA KOPI SHOP (BERKESAN) ----------
  // Data dinamis untuk dashboard yang hangat dan terasa seperti coffee shop asli
  
  // Data orders (pesanan terbaru)
  let recentOrders = [
    { id: 1, name: "Iced Caramel Macchiato", time: "10 menit lalu", status: "completed", amount: 38000 },
    { id: 2, name: "Flat White + Croissant", time: "25 menit lalu", status: "completed", amount: 54000 },
    { id: 3, name: "V60 Pour Over", time: "1 jam lalu", status: "preparing", amount: 45000 },
    { id: 4, name: "Matcha Latte", time: "2 jam lalu", status: "completed", amount: 42000 },
    { id: 5, name: "Espresso Doppio", time: "3 jam lalu", status: "completed", amount: 28000 },
  ];

  // Menu kopi (default)
  let menuItems = [
    { id: 1, name: "Espresso Blend", price: 22000, icon: "fa-mug-saucer" },
    { id: 2, name: "Cappuccino", price: 28000, icon: "fa-mug-hot" },
    { id: 3, name: "Latte Art", price: 32000, icon: "fa-heart" },
    { id: 4, name: "Affogato", price: 39000, icon: "fa-ice-cream" },
    { id: 5, name: "Cold Brew", price: 26000, icon: "fa-glass-water" },
    { id: 6, name: "Caramel Frappe", price: 36000, icon: "fa-blender" },
  ];

  // Data untuk grafik (7 hari)
  const weekDays = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  let salesData = [420000, 510000, 478000, 625000, 710000, 840000, 790000];

  // total pendapatan (sum dari 7 hari)
  function calcTotalRevenue() {
    return salesData.reduce((a,b)=>a+b,0);
  }

  // jumlah pesanan hari ini & item terjual (simulasi)
  let todaysOrdersCount = 48;
  let totalItemsSold = 187;

  function updateStatsUI() {
    document.getElementById('totalRevenue').innerText = "Rp " + calcTotalRevenue().toLocaleString('id-ID');
    document.getElementById('totalOrders').innerText = todaysOrdersCount;
    document.getElementById('itemsSold').innerText = totalItemsSold;
  }

  // Render orders ke panel
  function renderOrders() {
    const container = document.getElementById('recentOrdersList');
    if(!container) return;
    container.innerHTML = recentOrders.map(order => `
      <div class="order-item">
        <div class="order-info">
          <span class="order-name">${escapeHtml(order.name)}</span>
          <span class="order-time"><i class="far fa-clock"></i> ${order.time}</span>
        </div>
        <div>
          <span class="order-status ${order.status === 'completed' ? 'completed' : ''}">${order.status === 'completed' ? 'Selesai' : 'Sedang disiapkan'}</span>
          <div class="order-amount">Rp ${order.amount.toLocaleString('id-ID')}</div>
        </div>
      </div>
    `).join('');
  }

  // Render menu grid
  function renderMenu() {
    const grid = document.getElementById('menuGrid');
    if(!grid) return;
    grid.innerHTML = menuItems.map(item => `
      <div class="menu-card">
        <i class="fas ${item.icon}"></i>
        <h4>${escapeHtml(item.name)}</h4>
        <div class="menu-price">Rp ${item.price.toLocaleString('id-ID')}</div>
      </div>
    `).join('');
  }

  function escapeHtml(str) { return str.replace(/[&<>]/g, function(m){if(m==='&') return '&amp;'; if(m==='<') return '&lt;'; if(m==='>') return '&gt;'; return m;}); }

  // Chart initialization
  let chart;
  function initChart() {
    const ctx = document.getElementById('salesChart').getContext('2d');
    if(chart) chart.destroy();
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: weekDays,
        datasets: [{
          label: 'Pendapatan (Rp)',
          data: salesData,
          borderColor: '#b87c4a',
          backgroundColor: 'rgba(184, 124, 74, 0.08)',
          borderWidth: 3,
          pointBackgroundColor: '#6f4e2e',
          pointBorderColor: '#f9e0b0',
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.3,
          fill: true,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11, family: 'Inter' }, color: '#4b3a2a' } },
          tooltip: { callbacks: { label: (ctx) => `Rp ${ctx.raw.toLocaleString('id-ID')}` } }
        },
        scales: {
          y: { ticks: { callback: (val) => 'Rp ' + val.toLocaleString('id-ID'), stepSize: 200000 }, grid: { color: '#f1e1cf' } }
        }
      }
    });
  }

  // Tambah menu baru
  function showModal() {
    document.getElementById('menuModal').classList.add('active');
  }
  function hideModal() {
    document.getElementById('menuModal').classList.remove('active');
    document.getElementById('newMenuName').value = '';
    document.getElementById('newMenuPrice').value = '';
  }
  function addNewMenu() {
    const name = document.getElementById('newMenuName').value.trim();
    const priceRaw = document.getElementById('newMenuPrice').value.trim();
    if(!name || !priceRaw) {
      alert("Harap isi nama menu dan harga!");
      return;
    }
    let priceNum = parseInt(priceRaw.replace(/[^0-9]/g, ''));
    if(isNaN(priceNum)) priceNum = 25000;
    const newId = menuItems.length + 1;
    const iconsList = ['fa-mug-hot', 'fa-coffee', 'fa-cup-straw', 'fa-mug-saucer', 'fa-martini-glass-citrus'];
    const randomIcon = iconsList[newId % iconsList.length];
    menuItems.push({ id: newId, name: name, price: priceNum, icon: randomIcon });
    renderMenu();
    hideModal();
    // tambahkan sentuhan kopi: update total items terjual (simulasi)
    totalItemsSold += 5;
    updateStatsUI();
  }

  // logout sederhana (refresh ke login?)
  function logoutAdmin() {
    if(confirm("Keluar dari dashboard admin coffee shop?")) {
      localStorage.removeItem('coffeeAdminLogged');
      alert("Anda telah logout. Halaman akan direset ke mode demo login.");
      window.location.reload();
    }
  }

  // efek tambahan: data random untuk memperbarui pesanan (kesan hidup)
  function addRandomOrder() {
    const coffeeNames = ["Spanish Latte", "Pumpkin Spice", "Hazelnut Mocha", "Kopi Tubruk", "Vietnam Drip"];
    const randomName = coffeeNames[Math.floor(Math.random() * coffeeNames.length)];
    const newOrder = {
      id: Date.now(),
      name: randomName,
      time: "baru saja",
      status: "preparing",
      amount: 30000 + Math.floor(Math.random() * 25000)
    };
    recentOrders.unshift(newOrder);
    if(recentOrders.length > 6) recentOrders.pop();
    renderOrders();
    todaysOrdersCount += 1;
    totalItemsSold += Math.floor(Math.random() * 3) + 1;
    updateStatsUI();
    // tambahkan sedikit perubahan pendapatan hari ini? subtle
    let randomIncrease = 25000 + Math.random() * 40000;
    salesData[6] = Math.floor(salesData[6] + randomIncrease);
    if(chart) {
      chart.data.datasets[0].data = salesData;
      chart.update();
    }
    updateStatsUI();
  }

  // interval simulasi pesanan baru tiap 35 detik (kesan dinamis)
  let intervalId;
  function startDynamicOrders() {
    if(intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => {
      addRandomOrder();
    }, 35000);
  }

  // pengecekan login state (simulasi sederhana: jika tidak ada login, redirect ke halaman login sebelumnya? TAPI kita buat halaman ini membutuhkan sesi admin. Karena ini halaman admin terpisah, saya akan cek localStorage / session storage).
  function checkAdminAccess() {
    // untuk pengalaman seamless, jika belum ada login, kita bisa redirect ke halaman login dummy 
    // TAPI karena permintaan sebelumnya saya buat halaman login. Namun di sini adalah halaman admin utuh.
    // Agar konsisten dengan "halaman admin coffee shop berkesan" saya berikan demo langsung dengan akses jika user belum login? Bisa dengan auto-set demo.
    // Saya terapkan: jika belum ada flag login, kita tampilkan info bahwa ini mode demo admin (tapi tetap akses penuh untuk kesan stream)
    const logged = localStorage.getItem('coffeeAdminLogged');
    if(!logged) {
      // set default agar tidak mengganggu preview, hanya menampilkan notifikasi ringan
      localStorage.setItem('coffeeAdminLogged', 'true');
      document.getElementById('adminNameDisplay').innerText = "Demo Admin";
    } else {
      document.getElementById('adminNameDisplay').innerText = "Barista Master";
    }
  }

  // inisialisasi semua
  document.addEventListener('DOMContentLoaded', () => {
    checkAdminAccess();
    updateStatsUI();
    renderOrders();
    renderMenu();
    initChart();
    startDynamicOrders();

    // Event modal
    const addBtn = document.getElementById('addMenuItemBtn');
    if(addBtn) addBtn.addEventListener('click', showModal);
    const cancelBtn = document.getElementById('cancelModalBtn');
    if(cancelBtn) cancelBtn.addEventListener('click', hideModal);
    const saveBtn = document.getElementById('saveMenuBtn');
    if(saveBtn) saveBtn.addEventListener('click', addNewMenu);
    const logoutBtn = document.getElementById('logoutAdminBtn');
    if(logoutBtn) logoutBtn.addEventListener('click', logoutAdmin);
    // modal close ketika klik background?
    const modalBg = document.getElementById('menuModal');
    modalBg.addEventListener('click', (e) => { if(e.target === modalBg) hideModal(); });
  });