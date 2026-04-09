import mongoose from 'mongoose';

const customerSchema = mongoose.Schema({
  customer_id: String,
  Recency: Number,
  Frequency: Number,
  Monetary: Number,
  AOV: Number,
  TotalItems: Number,
  Cluster: Number,
  Segment: String,
}, { _id: false });

const segmentSchema = mongoose.Schema({
  Vip: [customerSchema],
  Low: [customerSchema],
  Normal: [customerSchema],
});

export default mongoose.model('SegmentGroup', segmentSchema);