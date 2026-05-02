require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const authRoutes = require('./routes/auth.routes');
const areaRoutes = require('./routes/area.routes');
const reservationRoutes = require('./routes/reservation.routes');
const adminRoutes = require('./routes/admin.routes');

// ==========================================
// Global Middlewares
// ==========================================

app.use(cors());
app.use(express.json());


// ==========================================
// Routes
// ==========================================

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to MKS Reservation System API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/admin', adminRoutes);


// ==========================================
// Error Handling
// ==========================================

app.use((req, res, next) => {
    res.status(404).json({ error: '找不到該 API 路徑，請檢查網址是否正確' });
});

app.use((err, req, res, next) => {
    console.error('[系統錯誤]:', err.message);
    
    const statusCode = err.status || 500;
    res.status(statusCode).json({
        error: err.message || '伺服器發生未知的錯誤，請稍後再試'
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`伺服器已成功啟動！`);
    console.log(`正在監聽 Port: ${PORT}`);
    console.log(`測試網址: http://localhost:${PORT}`);
    console.log(`=========================================`);
});