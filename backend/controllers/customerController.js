import SegmentGroup from '../models/customerModel.js';

export const getSegments = async (req, res) => {
  try {
    const data = await SegmentGroup.findOne();

    if (!data) {
      return res.status(404).json({ message: 'No data found' });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};