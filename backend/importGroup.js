import fs from 'fs';
import csv from 'csv-parser';
import mongoose from 'mongoose';
import SegmentGroup from './models/customerModel.js';

await mongoose.connect('mongodb://127.0.0.1:27017/proshop_ml');

const result = {
  Vip: [],
  Low: [],
  Normal: [],
};

fs.createReadStream('data/rfm_k3.csv')
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
    await SegmentGroup.deleteMany({});
    await SegmentGroup.create(result);
    console.log('✅ Done!');
    process.exit();
  });