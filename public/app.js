// Application State
const appState = {
    config: {},
    cars: [],
    filteredCars: [],
    adminToken: localStorage.getItem('adminToken') || null,
    selectedCarForWhatsApp: null
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    fetchPublicData();
});

// Fetch Showroom Data
async function fetchPublicData() {
    try {
        const res = await fetch('/api/public/data');
        if (!res.ok) throw new Error('Failed to load data');
        const data = await res.json();

        appState.config = data.config || {};
        appState.cars = data.cars || [];
        appState.filteredCars = [...appState.cars];

        updateShowroomUI();
        renderCarGrid();
    } catch (err) {
        console.error('Data error:', err);
    }
}

// Update UI Branding
function updateShowroomUI() {
    const { showroomName, whatsappNumber, address, description } = appState.config;
    const cleanPhone = (whatsappNumber || '').replace(/[^0-9]/g, '');

    if (showroomName) {
        document.title = `${showroomName} — Luxury Automotive Showroom`;
        ['brandHeaderTitle', 'brandDrawerTitle', 'footerBrand'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = showroomName;
        });
    }

    if (description) {
        const descEl = document.getElementById('heroDescription');
        if (descEl) descEl.textContent = description;
    }

    if (address) {
        const addrEl = document.getElementById('showroomAddress');
        if (addrEl) addrEl.textContent = address;
    }

    if (cleanPhone) {
        const waBtn = document.getElementById('footerWhatsappBtn');
        if (waBtn) waBtn.href = `https://wa.me/${cleanPhone}`;
    }

    // Hero image from inventory if available
    if (appState.cars.length > 0 && appState.cars[0].images?.[0]) {
        const heroImg = document.getElementById('heroFeaturedImg');
        if (heroImg) heroImg.src = appState.cars[0].images[0];
    }
}

// Render Inventory Cards
function renderCarGrid() {
    const container = document.getElementById('carGrid');
    if (!container) return;

    if (!appState.filteredCars.length) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: var(--text-secondary);">
                <i class="fa-solid fa-car-rear" style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>No vehicles match your search criteria.</p>
            </div>`;
        return;
    }

    container.innerHTML = appState.filteredCars.map(car => {
        const formattedPrice = car.cashPrice ? `PKR ${Number(car.cashPrice).toLocaleString()}` : 'Call for Price';
        const isSold = car.status === 'sold';
        const images = car.images?.length ? car.images : ['https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80'];

        return `
            <article class="car-card" id="vehicle-${car.id}">
                <div class="card-image-wrapper">
                    ${images.map((img, idx) => `
                        <img src="${img}" alt="${car.name}" class="car-slider-img ${idx === 0 ? 'active' : ''}" loading="lazy">
                    `).join('')}
                    
                    ${images.length > 1 ? `
                        <button class="slider-nav slider-prev" aria-label="Previous image" onclick="slideImage('${car.id}', -1)"><i class="fa-solid fa-chevron-left"></i></button>
                        <button class="slider-nav slider-next" aria-label="Next image" onclick="slideImage('${car.id}', 1)"><i class="fa-solid fa-chevron-right"></i></button>
                    ` : ''}

                    <span class="status-badge badge-${car.status}">${car.status}</span>
                </div>

                <div class="card-details">
                    <h3 class="car-name">${car.name} (${car.year})</h3>
                    <p class="car-specs-text">${car.mileage} • ${car.specs}</p>

                    <div class="price-box">
                        <span class="cash-price-label">Cash Price</span>
                        <div class="cash-price-val">${formattedPrice}</div>
                        ${car.installmentAvailable ? `<div class="installment-val"><i class="fa-solid fa-calendar-check"></i> Installments Available</div>` : ''}
                    </div>

                    <div class="card-actions">
                        <button class="btn-action btn-cash-action" ${isSold ? 'disabled' : ''} onclick="openWhatsAppModal('${car.id}', 'cash')">
                            <i class="fa-brands fa-whatsapp"></i> ${isSold ? 'Sold' : 'Buy Cash'}
                        </button>
                        ${car.installmentAvailable ? `
                            <button class="btn-action btn-inst-action" ${isSold ? 'disabled' : ''} onclick="openWhatsAppModal('${car.id}', 'installment')">
                                Plan
                            </button>
                        ` : ''}
                        <button class="btn-share" onclick="shareCar('${car.id}')" title="Share Vehicle" aria-label="Share">
                            <i class="fa-solid fa-share-nodes"></i>
                        </button>
                    </div>
                </div>
            </article>`;
    }).join('');
}

// Slide images without re-rendering the whole DOM
function slideImage(carId, direction) {
    const card = document.getElementById(`vehicle-${carId}`);
    if (!card) return;

    const slides = Array.from(card.querySelectorAll('.car-slider-img'));
    if (slides.length <= 1) return;

    const currentIndex = slides.findIndex(img => img.classList.contains('active'));
    slides[currentIndex].classList.remove('active');

    const nextIndex = (currentIndex + direction + slides.length) % slides.length;
    slides[nextIndex].classList.add('active');
}

// Search & Filter Logic
function applyFilters() {
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const status = document.getElementById('statusFilter')?.value || 'all';
    const maxPrice = parseFloat(document.getElementById('maxPriceInput')?.value);
    const installmentOnly = document.getElementById('installmentOnlyToggle')?.checked;

    appState.filteredCars = appState.cars.filter(car => {
        const matchesSearch = !search || 
            car.name.toLowerCase().includes(search) || 
            car.year.toString().includes(search) || 
            car.specs.toLowerCase().includes(search);
        
        const matchesStatus = status === 'all' || car.status === status;
        const matchesPrice = isNaN(maxPrice) || (car.cashPrice <= maxPrice);
        const matchesInstallment = !installmentOnly || car.installmentAvailable;

        return matchesSearch && matchesStatus && matchesPrice && matchesInstallment;
    });

    renderCarGrid();
}

// Modal & Drawer Helpers
function openModal(id) {
    document.getElementById(id)?.classList.add('active');
}

function closeModal(id) {
    document.getElementById(id)?.classList.remove('active');
}

function toggleDrawer(isOpen) {
    const drawer = document.getElementById('mobileDrawer');
    if (drawer) {
        if (typeof isOpen === 'boolean') {
            drawer.classList.toggle('open', isOpen);
        } else {
            drawer.classList.toggle('open');
        }
    }
}

// WhatsApp Inquiry Handling
function openWhatsAppModal(carId, paymentType) {
    const car = appState.cars.find(c => c.id === carId);
    if (!car) return;

    appState.selectedCarForWhatsApp = car;
    document.getElementById('modalCarId').value = carId;
    document.getElementById('modalPaymentType').value = paymentType;

    updateWhatsAppPreview();
    openModal('whatsappModal');
}

function updateWhatsAppPreview() {
    const car = appState.selectedCarForWhatsApp;
    if (!car) return;

    const paymentType = document.getElementById('modalPaymentType')?.value || 'cash';
    const buyerName = document.getElementById('buyerNameInput')?.value.trim() || 'A Customer';
    const buyerPhone = document.getElementById('buyerPhoneInput')?.value.trim();
    const showroom = appState.config.showroomName || 'HUSSAIN Showroom';

    let msg = `Hello ${showroom},\n\nI am interested in purchasing the *${car.name} (${car.year})*.\n` +
              `• Cash Price: PKR ${Number(car.cashPrice).toLocaleString()}\n` +
              `• Specs: ${car.specs}\n`;

    if (paymentType === 'installment' && car.installmentPlan) {
        msg += `• Requested Plan: ${car.installmentPlan}\n`;
    }

    msg += `\nCustomer Name: ${buyerName}`;
    if (buyerPhone) msg += `\nContact Phone: ${buyerPhone}`;
    msg += `\n\nPlease share the vehicle availability and inspection schedule.`;

    const previewEl = document.getElementById('whatsappMessagePreview');
    if (previewEl) previewEl.value = msg;
}

function sendWhatsAppMessage() {
    const phone = (appState.config.whatsappNumber || '').replace(/[^0-9]/g, '');
    if (!phone) {
        alert('Showroom WhatsApp contact number is not configured yet.');
        return;
    }
    const message = encodeURIComponent(document.getElementById('whatsappMessagePreview')?.value || '');
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    closeModal('whatsappModal');
}

// Share Vehicle
function shareCar(carId) {
    const shareUrl = `${window.location.origin}/share/car/${carId}`;
    if (navigator.share) {
        navigator.share({
            title: appState.config.showroomName || 'Showroom Vehicle',
            text: 'Check out this luxury vehicle listing!',
            url: shareUrl
        }).catch(() => {});
    } else {
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert('Vehicle link copied to clipboard!');
        }).catch(() => {
            prompt('Copy vehicle link:', shareUrl);
        });
    }
}

// Admin Authentication & Views
function openAdminModal() {
    if (appState.adminToken) {
        showAdminDashboard();
    } else {
        showAdminLogin();
    }
    openModal('adminModal');
}

function showAdminLogin() {
    document.getElementById('adminLoginView')?.classList.remove('hidden');
    document.getElementById('adminDashboardView')?.classList.add('hidden');
}

function showAdminDashboard() {
    document.getElementById('adminLoginView')?.classList.add('hidden');
    document.getElementById('adminDashboardView')?.classList.remove('hidden');
    renderAdminTable();
    populateConfigForm();
}

async function handleAdminLogin(e) {
    e.preventDefault();
    const username = document.getElementById('adminUser').value;
    const password = document.getElementById('adminPass').value;

    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');

        appState.adminToken = data.token;
        localStorage.setItem('adminToken', data.token);
        showAdminDashboard();
    } catch (err) {
        alert(err.message);
    }
}

function logoutAdmin() {
    appState.adminToken = null;
    localStorage.removeItem('adminToken');
    showAdminLogin();
}

function switchAdminTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    document.getElementById(tabId)?.classList.add('active');
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`)?.classList.add('active');
}

function startNewCarForm() {
    document.getElementById('carForm').reset();
    document.getElementById('carFormEditId').value = '';
    document.getElementById('carFormSubmitBtn').textContent = 'Add Vehicle';
    toggleInstallmentInputs();
    switchAdminTab('addCarTab');
}

function renderAdminTable() {
    const tbody = document.getElementById('adminCarTableBody');
    if (!tbody) return;

    if (!appState.cars.length) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">No vehicles in inventory.</td></tr>`;
        return;
    }

    tbody.innerHTML = appState.cars.map(car => `
        <tr>
            <td><strong>${car.name}</strong> (${car.year})</td>
            <td>PKR ${Number(car.cashPrice).toLocaleString()}</td>
            <td><span class="status-badge badge-${car.status}">${car.status}</span></td>
            <td>
                <button class="btn-sm btn-edit" onclick="editCarForm('${car.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-sm btn-delete" onclick="deleteCar('${car.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`).join('');
}

function toggleInstallmentInputs() {
    const isChecked = document.getElementById('formCarInstallmentCheck')?.checked;
    const group = document.getElementById('installmentDetailsGroup');
    if (group) group.classList.toggle('hidden', !isChecked);
}

function editCarForm(carId) {
    const car = appState.cars.find(c => c.id === carId);
    if (!car) return;

    document.getElementById('carFormEditId').value = car.id;
    document.getElementById('formCarName').value = car.name || '';
    document.getElementById('formCarYear').value = car.year || '';
    document.getElementById('formCarMileage').value = car.mileage || '';
    document.getElementById('formCarSpecs').value = car.specs || '';
    document.getElementById('formCarPrice').value = car.cashPrice || 0;
    document.getElementById('formCarStatus').value = car.status || 'available';

    const instCheck = document.getElementById('formCarInstallmentCheck');
    instCheck.checked = !!car.installmentAvailable;
    toggleInstallmentInputs();
    document.getElementById('formCarInstallmentPlan').value = car.installmentPlan || '';

    document.getElementById('carFormSubmitBtn').textContent = 'Update Vehicle';
    switchAdminTab('addCarTab');
}

async function handleCarFormSubmit(e) {
    e.preventDefault();
    const editId = document.getElementById('carFormEditId').value;
    const formData = new FormData();

    formData.append('name', document.getElementById('formCarName').value);
    formData.append('year', document.getElementById('formCarYear').value);
    formData.append('mileage', document.getElementById('formCarMileage').value);
    formData.append('specs', document.getElementById('formCarSpecs').value);
    formData.append('cashPrice', document.getElementById('formCarPrice').value);
    formData.append('status', document.getElementById('formCarStatus').value);
    formData.append('installmentAvailable', document.getElementById('formCarInstallmentCheck').checked);
    formData.append('installmentPlan', document.getElementById('formCarInstallmentPlan').value);

    const files = document.getElementById('formCarFiles').files;
    for (let i = 0; i < files.length; i++) formData.append('images', files[i]);
    formData.append('externalImages', document.getElementById('formCarImageUrls').value);
    if (editId) formData.append('keepExistingImages', 'true');

    const url = editId ? `/api/admin/cars/${editId}` : '/api/admin/cars';
    const method = editId ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Authorization': `Bearer ${appState.adminToken}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');

        alert(data.message || 'Saved successfully');
        startNewCarForm();
        await fetchPublicData();
        renderAdminTable();
        switchAdminTab('inventoryTab');
    } catch (err) {
        alert(err.message);
    }
}

async function deleteCar(carId) {
    if (!confirm('Are you sure you want to remove this vehicle?')) return;

    try {
        const res = await fetch(`/api/admin/cars/${carId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${appState.adminToken}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Delete failed');

        await fetchPublicData();
        renderAdminTable();
    } catch (err) {
        alert(err.message);
    }
}

function populateConfigForm() {
    const { showroomName, whatsappNumber, address, description } = appState.config;
    document.getElementById('configShowroomName').value = showroomName || '';
    document.getElementById('configWhatsapp').value = whatsappNumber || '';
    document.getElementById('configAddress').value = address || '';
    document.getElementById('configDescription').value = description || '';
}

async function handleConfigSubmit(e) {
    e.preventDefault();
    const configData = {
        showroomName: document.getElementById('configShowroomName').value,
        whatsappNumber: document.getElementById('configWhatsapp').value,
        address: document.getElementById('configAddress').value,
        description: document.getElementById('configDescription').value
    };

    try {
        const res = await fetch('/api/admin/config', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${appState.adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(configData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Update failed');

        alert(data.message || 'Settings updated');
        await fetchPublicData();
    } catch (err) {
        alert(err.message);
    }
}