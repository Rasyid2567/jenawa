
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import profileRoutes from './modules/profile/profile.routes.js';
import emotionRoutes from './modules/emotions/emotions.routes.js';
import journalRoutes from './modules/journals/journals.routes.js';
import exerciseRoutes from './modules/exercises/exercises.routes.js';
import sessionRoutes from './modules/sessions/sessions.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';

const app = express();

app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(helmet());

app.use(cors({
  origin(origin, callback) {
    // Izinkan request tanpa Origin untuk alat CLI/server.
    // API privat tetap membutuhkan autentikasi.
    if (!origin || env.corsOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin tidak diizinkan.'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'JENAWA API aktif.'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/emotions', emotionRoutes);
app.use('/api/journals', journalRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
