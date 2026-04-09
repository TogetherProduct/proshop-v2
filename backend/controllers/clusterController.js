import Cluster from '../models/clusterModel.js';

export const getClusterByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const cluster = await Cluster.findOne({
      customers: userId,
    });

    if (!cluster) {
      return res.status(404).json({ message: 'Cluster not found' });
    }

    res.json(cluster);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};