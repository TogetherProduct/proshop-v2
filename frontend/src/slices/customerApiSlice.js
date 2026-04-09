import { apiSlice } from './apiSlice';

export const customerApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCustomerSegments: builder.query({
      query: () => ({
        url: '/api/customers/segments',
      }),
    }),
  }),
});

export const { useGetCustomerSegmentsQuery } = customerApiSlice;