import "reflect-metadata";

import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
dotenv.config();
import connectDB from './config/db.js';
import productRoutes from './routes/productRoutes.js';
import userRoutes from './routes/userRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import sellerRoute from './routes/sellerRoutes.js';
import sqlProductRoutes from "./routes/productSQLRoutes.js";
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import { connectSQLite } from "./config/sqliteDb.js";
import clusterRoute from './routes/clusterRoutes.js';

import { initRedis, closeRedis } from './utils/redisClient.js';
import { initScheduler, stopScheduler } from './config/scheduler.js';

const port = process.env.PORT || 5000;

connectDB();
connectSQLite();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/sellers', sellerRoute);
app.use("/api/sql-products", sqlProductRoutes);
app.use('/api/clusters', clusterRoute);
app.get('/api/config/paypal', (req, res) =>
  res.send({ clientId: process.env.PAYPAL_CLIENT_ID })
);

if (process.env.NODE_ENV === 'production') {
  const __dirname = path.resolve();
  app.use('/uploads', express.static('/var/data/uploads'));
  app.use(express.static(path.join(__dirname, '/frontend/build')));

  app.get('*', (req, res) =>
    res.sendFile(path.resolve(__dirname, 'frontend', 'build', 'index.html'))
  );
} else {
  const __dirname = path.resolve();
  app.use('/uploads', express.static(path.join(__dirname, '/uploads')));
  app.get('/', (req, res) => {
    res.send('API is running....');
  });
}

app.use(notFound);
app.use(errorHandler);

const server = app.listen(port, async () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${port}`);

  // Initialize Redis cache
  console.log('\n📦 Initializing Redis...');
  await initRedis();

  // Initialize batch recommendation scheduler
  console.log('\n⏰ Initializing scheduler...');
  initScheduler();

  console.log('\n✅ Server and dependencies initialized\n');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Server shutting down...');
  stopScheduler();
  await closeRedis();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Server shutting down (SIGTERM)...');
  stopScheduler();
  await closeRedis();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
