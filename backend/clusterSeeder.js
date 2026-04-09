import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import User from './models/userModel.js';

dotenv.config() // lúc này đọc root/.env OK

// tạo __dirname trong ES module
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import connectDB from './config/db.js'
import Cluster from './models/clusterModel.js'

await connectDB()

async function importClusterData() {
    const filePath = path.join(__dirname, 'ktdata', 'clusters.json')

    const rawClusters = JSON.parse(
        fs.readFileSync(filePath, 'utf-8')
    )

    const clusters = rawClusters.map((c) => ({
        cluster_id: c.id,   // map id → cluster_id
        customers: c.customers,
        products: c.products,
    }))

    try {
        await Cluster.deleteMany() // optional
        await Cluster.insertMany(clusters)

        console.log('Cluster Data Imported!'.green.inverse)
        process.exit()
    } catch (error) {
        console.error(error)
        process.exit(1)
    }

}

await importClusterData()



const createUser = async () => {
    const user = await User.create({
        _id: '91f3a63e7a6e55e11f8a41dea6bb0505',
        name: 'Duckling Cheap',
        email: 'yellowduckcheap@gmail.com',
        password: '123', // 
        city: 'ipira',
        state: 'BA',
        isAdmin: false,
    });

    await User.create({
        _id: 'd221b067b60ae3c085fd5bde1a27e92d',
        name: 'Duckling Normal',
        email: 'yellowducknormal@gmail.com',
        password: '123', // 
        city: 'tres pontas',
        state: 'MG',
        isAdmin: false,
    });

    await User.create({
        _id: '467975aa01ded053ddd770ac6d11abf8',
        name: 'Duckling Expensive',
        email: 'yellowduckexpensive@gmail.com',
        password: '123', // 
        city: 'sao jose do rio preto',
        state: 'SP',
        isAdmin: false,
    });
    console.log('Users created:', user._id);
};
console.log('DB:', mongoose.connection.name);

await createUser();
// await User.deleteMany()

await mongoose.connection.close(); 
