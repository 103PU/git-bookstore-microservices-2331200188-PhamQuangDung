const api = (path) => (window.API_BASE || '') + path;

function token() {
  return localStorage.getItem('token');
}
function authHeaders() {
  const t = token();
  return t ? { 'Authorization': 'Bearer ' + t } : {};
}
function el(id) { return document.getElementById(id); }

async function fetchJSON(path, options = {}) {
  const res = await fetch(api(path), {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}), ...authHeaders() }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
  return data;
}

function showDetail(p) {
  const content = el('detail-content');
  const actions = el('detail-actions');
  
  el('product-id').value = p.id;
  actions.style.display = 'block';

  content.innerHTML = `
    <div class="detail-cover" style="background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%); color: white;">
      <i data-lucide="book-open" style="width: 48px; height: 48px;"></i>
    </div>
    <h2 class="detail-title">${p.title}</h2>
    <p class="detail-author">by ${p.author}</p>
    <div class="detail-stats">
      <div class="stat-item">
        <span class="stat-value">${Math.floor(Math.random() * 300) + 100}</span>
        <span class="stat-label">Pages</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${(Math.random() * 2 + 3).toFixed(1)}</span>
        <span class="stat-label">Ratings</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${Math.floor(Math.random() * 1000)}</span>
        <span class="stat-label">Reviews</span>
      </div>
    </div>
    <p class="detail-desc">This is a wonderful book titled "${p.title}" written by ${p.author}. It is available for $${p.price} with ${p.stock} units in stock. Perfect for your collection!</p>
  `;
  lucide.createIcons();
}

function renderProducts(products) {
  const list = el('product-list');
  const recommended = el('recommended-list');
  list.innerHTML = '';
  recommended.innerHTML = '';

  products.forEach((p, index) => {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = `
      <div class="book-cover" style="background: ${index % 2 === 0 ? '#dbeafe' : '#fef3c7'}; color: ${index % 2 === 0 ? '#2563eb' : '#d97706'};">
        <span style="font-weight: 800; font-size: 1.2rem;">${p.title.split(' ').map(w => w[0]).join('')}</span>
      </div>
      <div class="book-title" title="${p.title}">${p.title}</div>
      <div class="book-author">${p.author}</div>
      <div class="book-price">$${p.price}</div>
    `;
    card.onclick = () => showDetail(p);
    
    if (index < 4) {
      recommended.appendChild(card.cloneNode(true)).onclick = () => showDetail(p);
    }
    list.appendChild(card);
  });
}

function renderOrders(orders) {
  const list = el('order-list');
  if (orders.length === 0) {
    list.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">No orders found yet.</div>';
    return;
  }
  list.innerHTML = orders.map(o => `
    <div class="order-card">
      <div class="order-info">
        <h4>Order #${o.id}</h4>
        <div class="order-meta">Product ID: ${o.product_id} • Quantity: ${o.quantity} • Created: ${new Date(o.created_at).toLocaleString()}</div>
      </div>
      <div class="status-badge status-${o.status.toLowerCase()}">${o.status}</div>
    </div>
  `).join('');
}

async function refresh() {
  try {
    const [products, orders] = await Promise.all([
      fetchJSON('/api/products'),
      fetchJSON('/api/orders').catch(() => [])
    ]);
    renderProducts(products);
    renderOrders(orders);
  } catch (err) {
    console.error('Failed to fetch data', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  const pages = {
    'nav-discover': 'page-discover',
    'nav-orders': 'page-orders',
    'nav-system': 'page-system'
  };

  Object.keys(pages).forEach(navId => {
    el(navId).onclick = (e) => {
      e.preventDefault();
      // Reset active classes
      Object.keys(pages).forEach(id => {
        const item = el(id);
        if (item) item.classList.remove('active');
      });
      Object.values(pages).forEach(id => {
        const page = el(id);
        if (page) page.style.display = 'none';
      });

      // Set active
      el(navId).classList.add('active');
      el(pages[navId]).style.display = 'block';

      if (navId === 'nav-orders') refresh();
    };
  });

  // Modals
  const loginModal = el('login-modal');
  const createProductModal = el('create-product-modal');

  // Auth UI
  const updateAuthBar = async () => {
    const t = token();
    if (!t) {
      el('user-name').textContent = 'Guest';
      el('user-role').textContent = 'Not signed in';
      el('btn-show-login').style.display = '';
      el('btn-logout').style.display = 'none';
      el('admin-tools').style.display = 'none';
      return;
    }
    try {
      const me = await fetchJSON('/api/users/me');
      el('user-name').textContent = me.username;
      el('user-role').textContent = 'Member';
      el('btn-show-login').style.display = 'none';
      el('btn-logout').style.display = '';
      el('admin-tools').style.display = 'block';
      loginModal.style.display = 'none';
    } catch {
      localStorage.removeItem('token');
      updateAuthBar();
    }
  };

  el('btn-show-login').onclick = (e) => {
    e.preventDefault();
    loginModal.style.display = 'flex';
  };
  
  el('btn-logout').onclick = (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    updateAuthBar();
  };

  el('btn-login').onclick = async () => {
    try {
      const data = await fetchJSON('/api/users/login', {
        method: 'POST',
        body: JSON.stringify({ username: el('username').value, password: el('password').value })
      });
      localStorage.setItem('token', data.token);
      updateAuthBar();
    } catch (e) {
      el('auth-message').textContent = e.message;
    }
  };

  el('btn-register').onclick = async () => {
    try {
      const data = await fetchJSON('/api/users/register', {
        method: 'POST',
        body: JSON.stringify({ username: el('username').value, password: el('password').value })
      });
      localStorage.setItem('token', data.token);
      updateAuthBar();
    } catch (e) {
      el('auth-message').textContent = e.message;
    }
  };

  // Create product
  el('btn-show-create-product').onclick = () => {
    createProductModal.style.display = 'flex';
  };

  el('create-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      title: el('title').value,
      author: el('author').value,
      price: Number(el('price').value),
      stock: Number(el('stock').value)
    };
    try {
      await fetchJSON('/api/products', { method: 'POST', body: JSON.stringify(body) });
      el('create-product-status').textContent = 'Created!';
      setTimeout(() => {
        createProductModal.style.display = 'none';
        el('create-product-status').textContent = '';
      }, 1000);
      refresh();
    } catch (err) {
      el('create-product-status').textContent = err.message;
    }
  });

  // Place order
  el('order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await fetchJSON('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          productId: Number(el('product-id').value),
          quantity: Number(el('quantity').value)
        })
      });
      el('order-status').textContent = 'Order placed successfully!';
      el('order-status').style.color = '#10b981';
      setTimeout(() => el('order-status').textContent = '', 3000);
      refresh();
    } catch (err) {
      el('order-status').textContent = err.message;
      el('order-status').style.color = '#ef4444';
    }
  });

  updateAuthBar();
  refresh();
});
