import mongoose from 'mongoose';

const forecastSchema = mongoose.Schema({
  seller_id: {
    type: String,
    required: true,
    unique: true,
    index: true 
  },
  forecast_generated_at: {
    type: Date,
    required: true
  },
  historical_dates: [String],
  historical_revenue: [Number],
  forecast_dates: [String],
  forecast_revenue: [Number]
}, { 
  timestamps: true 
});

const ForecastCache = mongoose.model('ForecastCache', forecastSchema);

export default ForecastCache;