import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';
import SegmentGroup from './models/customerModel.js';

// Ensure __dirname is set up if you haven't already in this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const importSegmentData = () => {
    // Wrap the stream in a Promise so the seeder waits for it to finish
    return new Promise((resolve, reject) => {
        const filePath = path.join(__dirname, 'data', 'rfm_k3.csv');
        
        const result = {
            Vip: [],
            Low: [],
            Normal: [],
        };

        console.log('Reading CSV data...'.yellow);

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                const data = {
                    customer_id: row.customer_id,
                    Recency: Number(row.Recency),
                    Frequency: Number(row.Frequency),
                    Monetary: Number(row.Monetary),
                    AOV: Number(row.AOV),
                    TotalItems: Number(row.TotalItems),
                    Cluster: Number(row.Cluster),
                    Segment: row.Segment,
                };

                if (row.Segment === 'VIP') {
                    result.Vip.push(data);
                } else if (row.Segment === 'Low Value') {
                    result.Low.push(data);
                } else {
                    result.Normal.push(data);
                }
            })
            .on('end', async () => {
                try {
                    // Clear existing data first
                    await SegmentGroup.deleteMany({});
                    
                    // Insert the grouped data
                    await SegmentGroup.create(result);
                    
                    console.log('✅ Segment Data Imported!'.green.inverse);
                    resolve(); // Tell the Promise we are done
                } catch (error) {
                    reject(error); // Pass any database errors up to the seeder
                }
            })
            .on('error', (error) => {
                console.error('Error reading CSV file:', error);
                reject(error);
            });
    });
};