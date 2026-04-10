import asyncHandler from '../middleware/asyncHandler.js';
import ForecastCache from '../models/forecastModel.js';
import { generateForecastData } from '../jobs/forecastJob.js';

// @desc    Get seller revenue forecast
// @route   GET /api/sellers/:id/forecast
// @access  Private (or Public, depending on your authMiddleware)
const getSellerForecast = asyncHandler(async (req, res) => {
  const sellerId = req.params.id; // Assuming you pass the ID in the URL

  const forecastWeeks = parseInt(req.query.weeks, 10) || 6;

  const cachedForecast = await ForecastCache.findOne({ seller_id: sellerId });

  if (cachedForecast) {
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const cacheAge = Date.now() - new Date(cachedForecast.forecast_generated_at).getTime();

    const cachedWeeksCount = cachedForecast.forecast_dates.length;

    if (cacheAge < ONE_WEEK_MS) {
      if (cachedWeeksCount >= forecastWeeks) {
        console.log(`[Cache Hit] Returning ${forecastWeeks} cached weeks for seller ${sellerId}`);
        
        // Convert to plain JS object so we can safely modify it before sending
        const responseData = cachedForecast.toObject ? cachedForecast.toObject() : cachedForecast;
        
        // Slice the arrays to return exactly the number of weeks requested
        responseData.forecast_dates = responseData.forecast_dates.slice(0, forecastWeeks);
        responseData.forecast_revenue = responseData.forecast_revenue.slice(0, forecastWeeks);
        
        return res.json(responseData);
      } else {
        console.log(`[Cache Miss] Cached forecast is too short (${cachedWeeksCount} < ${forecastWeeks}). Regenerating...`);
      }
    }
    console.log(`[Cache Stale] Cache is older than 1 week. Regenerating...`);
  } else {
    console.log(`[Cache Miss] No cache found for seller ${sellerId}. Generating...`);
  }

  const forecastData = await generateForecastData(sellerId, forecastWeeks);

  const updatedCache = await ForecastCache.findOneAndUpdate(
    { seller_id: sellerId },
    {
      $set: {
        forecast_generated_at: forecastData.forecast_generated_at,
        historical_dates: forecastData.historical_dates,
        historical_revenue: forecastData.historical_revenue,
        forecast_dates: forecastData.forecast_dates,
        forecast_revenue: forecastData.forecast_revenue
      }
    },
    { upsert: true, new: true }
  );

  res.json(updatedCache);
});

export { getSellerForecast };