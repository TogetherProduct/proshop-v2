import mongoose from 'mongoose';

const recommendationSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    recommendations: [
      {
        productId: String,
        score: Number,
        method: String,
      },
    ],
    cachedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days TTL
      index: { expireAfterSeconds: 0 }, // Auto-delete after expiration
    },
  },
  {
    timestamps: true,
  }
);

const Recommendation = mongoose.model('Recommendation', recommendationSchema);

export default Recommendation;
