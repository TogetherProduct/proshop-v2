import { apiSlice } from './apiSlice'; 
import { SELLERS_URL } from '../constants';

export const forecastApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSellerForecast: builder.query({
      query: (sellerId) => ({
        url: `${SELLERS_URL}/${sellerId}/forecast`,
      }),
      keepUnusedDataFor: 5, 
    }),
  }),
});

export const { useGetSellerForecastQuery } = forecastApiSlice;