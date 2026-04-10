import 'reflect-metadata'; // Must be at the top since seeder runs independently
import fs from 'fs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import colors from 'colors';
import users from './data/users.js';
import products from './data/products.js';
import User from './models/userModel.js';
import SegmentGroup from './models/customerModel.js';
import Product from './models/productModel.js';
import Order from './models/orderModel.js';
import connectDB from './config/db.js';
import { AppDataSource, connectSQLite } from './config/sqliteDb.js';
import { importClusterData, createUser } from './clusterSeeder.js';
import { importSegmentData } from './importGroup.js';

dotenv.config();

await connectDB();
await connectSQLite();

const clearSQLData = async () => {
  try {
    const clear = fs.readFileSync('./data/clear.sql', 'utf8');
    console.log('Executing SQL clear script...'.yellow);
    await AppDataSource.query(clear);
    console.log('SQLite Data Cleared Successfully!'.green.inverse);
  } catch (error) {
    console.error(`SQLite Clear Error: ${error}`.red.inverse);
    process.exit(1);
  }
}

// New function to import raw SQL data
const importSQLProduct = async () => {
  try {
    const sqlFileContent = fs.readFileSync('./data/product.sql', 'utf8');
    console.log('Executing SQL import script...'.yellow);
    await AppDataSource.query(sqlFileContent);
    console.log('SQLite Data Imported Successfully!'.green.inverse);
  } catch (error) {
    console.error(`SQLite Import Error: ${error}`.red.inverse);
    process.exit(1);
  }
};

const destroyData = async () => {
    try {
        await Order.deleteMany();
        await Product.deleteMany();
        await User.deleteMany();
        await SegmentGroup.deleteMany(); // Added to your destroy logic
        
        console.log('Mongo Data Destroyed!'.red.inverse);
        process.exit();
    } catch (error) {
        console.error(`${error}`.red.inverse);
        process.exit(1);
    }
};

const importAllData = async () => {
    try {
        await clearSQLData();
        await importSQLProduct();
        
        await createUser();
        await importClusterData();
        await importSegmentData();
        
        console.log('All Data Imported Successfully!'.green.inverse);
        process.exit();
    } catch (error) {
        console.error(`Import Error: ${error}`.red.inverse);
        process.exit(1);
    }
};

if (process.argv[2] === '-d') {
    await destroyData();
} else {
    await importAllData();
}
