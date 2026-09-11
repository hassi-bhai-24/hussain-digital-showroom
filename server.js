const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'hussain_showroom_super_secret_jwt_key_2026';
const DB_FILE = path.join(__dirname, 'database.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets securely from public and uploads
app.use(express.static(PUBLIC_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));

// Ensure Uploads Directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`)
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed.'));
    }
});

// Database Initialization & Helpers
function initDatabase() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            config: {
                showroomName: 'HUSSAIN Digital Showroom',
                whatsappNumber: '923000000000',
                address: 'Main Auto Boulevard, Luxury District',
                description: 'Curated. Verified. Yours. Premier luxury automotive showroom.'
            },
            admin: {
                username: 'admin',
                passwordHash: bcrypt.hashSync('AdminPass123!', 10)
            },
            cars: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    }
}
initDatabase();

function readDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch {
        return { config: {}, admin: {}, cars: [] };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function parseImages(files = [], external) {
    const uploaded = files.map(f => `/uploads/${f.filename}`);
    let externals = [];
    if (Array.isArray(external)) externals = external;
    else if (typeof external === 'string') externals = external.split(',').map(s => s.trim()).filter(Boolean);
    return [...uploaded, ...externals];
}

// Auth Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. Please log in.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Session expired or invalid.' });
        req.user = user;
        next();
    });
}

// Public Routes
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.get('/api/public/data', (req, res) => {
    const db = readDB();
    res.json({ config: db.config || {}, cars: db.cars || [] });
});

app.get('/share/car/:id', (req, res) => {
    const db = readDB();
    const car = (db.cars || []).find(c => c.id === req.params.id);
    const config = db.config || {};
    const title = car ? `${car.name} (${car.year}) - ${config.showroomName}` : (config.showroomName || 'Digital Showroom');
    const desc = car ? `Price: PKR ${Number(car.cashPrice).toLocaleString()} | Specs: ${car.specs}` : (config.description || '');
    const image = (car && car.images && car.images[0]) || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80';
    const siteUrl = `${req.protocol}://${req.get('host')}/#vehicle-${req.params.id}`;

    res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title>
<meta property="og:title" content="${title}"/><meta property="og:description" content="${desc}"/>
<meta property="og:image" content="${image}"/><meta property="og:url" content="${siteUrl}"/>
<script>window.location.href = "${siteUrl}";</script></head><body>Redirecting to showroom...</body></html>`);
});

// Admin Routes
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body || {};
    const db = readDB();
    if (!username || username !== db.admin?.username || !bcrypt.compareSync(password || '', db.admin?.passwordHash || '')) {
        return res.status(401).json({ error: 'Invalid username or password.' });
    }
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, message: 'Authenticated successfully.' });
});

app.post('/api/admin/cars', authenticateToken, upload.array('images', 5), (req, res) => {
    const db = readDB();
    const body = req.body || {};
    let images = parseImages(req.files, body.externalImages);
    if (!images.length) images.push('https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80');

    const newCar = {
        id: `car-${Date.now()}`,
        name: body.name || 'Untitled Vehicle',
        year: body.year || new Date().getFullYear().toString(),
        mileage: body.mileage || '0 km',
        specs: body.specs || 'Standard Specs',
        cashPrice: body.cashPrice ? parseFloat(body.cashPrice) : 0,
        installmentAvailable: body.installmentAvailable === 'true' || body.installmentAvailable === true,
        installmentPlan: body.installmentPlan || '',
        status: ['available', 'pending', 'sold'].includes(body.status) ? body.status : 'available',
        images,
        createdAt: new Date().toISOString()
    };

    db.cars = db.cars || [];
    db.cars.unshift(newCar);
    writeDB(db);
    res.status(201).json({ message: 'Vehicle added successfully', car: newCar });
});

app.put('/api/admin/cars/:id', authenticateToken, upload.array('images', 5), (req, res) => {
    const db = readDB();
    const index = (db.cars || []).findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Vehicle not found.' });

    const existing = db.cars[index];
    const body = req.body || {};
    const keepExisting = body.keepExistingImages === 'true' || body.keepExistingImages === true;
    let images = keepExisting ? [...existing.images] : [];
    const newImages = parseImages(req.files, body.externalImages);
    images = [...images, ...newImages];

    db.cars[index] = {
        ...existing,
        name: body.name || existing.name,
        year: body.year || existing.year,
        mileage: body.mileage || existing.mileage,
        specs: body.specs || existing.specs,
        cashPrice: body.cashPrice !== undefined && body.cashPrice !== '' ? parseFloat(body.cashPrice) : existing.cashPrice,
        installmentAvailable: body.installmentAvailable !== undefined ? (body.installmentAvailable === 'true' || body.installmentAvailable === true) : existing.installmentAvailable,
        installmentPlan: body.installmentPlan !== undefined ? body.installmentPlan : existing.installmentPlan,
        status: body.status || existing.status,
        images: images.length ? images : existing.images,
        updatedAt: new Date().toISOString()
    };

    writeDB(db);
    res.json({ message: 'Vehicle updated successfully.', car: db.cars[index] });
});

app.delete('/api/admin/cars/:id', authenticateToken, (req, res) => {
    const db = readDB();
    db.cars = (db.cars || []).filter(c => c.id !== req.params.id);
    writeDB(db);
    res.json({ message: 'Vehicle removed from inventory.' });
});

app.put('/api/admin/config', authenticateToken, (req, res) => {
    const db = readDB();
    const { showroomName, whatsappNumber, address, description } = req.body || {};
    db.config = {
        showroomName: showroomName || db.config.showroomName,
        whatsappNumber: whatsappNumber ? whatsappNumber.replace(/[^0-9]/g, '') : db.config.whatsappNumber,
        address: address || db.config.address,
        description: description || db.config.description
    };
    writeDB(db);
    res.json({ message: 'Showroom details updated.', config: db.config });
});

// Error handling
app.use((err, req, res, next) => {
    res.status(400).json({ error: err.message || 'Request processing failed.' });
});

app.listen(PORT, () => {
    console.log(`HUSSAIN Showroom running at http://localhost:${PORT}`);
});