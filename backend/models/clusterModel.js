import mongoose from 'mongoose';
const clusterSchema = mongoose.Schema(
    {
        cluster_id: { type: String, required: true },

        customers: [
            {
                type: String,
                required: true,
            },
        ],

        products: {
            type: Map,
            of: new mongoose.Schema({
                count: { type: Number, required: true },
                order_ids: [{ type: String }],
            })
        }
    }
)


const Cluster = mongoose.model('Cluster', clusterSchema);

export default Cluster;