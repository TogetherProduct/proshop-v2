import { CLUSTERS_URL } from '../constants';
import { apiSlice } from './apiSlice';

export const clustersApiSlice = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getCluster: builder.query({
            query: (userId) => ({
                url: `${CLUSTERS_URL}/${userId}`,
            }),
        })

    }),
});

export const {
    useGetClusterQuery
} = clustersApiSlice;
