const express = require('express');
const router = express.Router();
const DeductionLedger = require('../models/DeductionLedger');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/ledger - list entries (admin)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const entries = await DeductionLedger.find().populate('leaveId fromUser toUser').sort({ createdAt: -1 }).limit(200);
    res.status(200).json({ success: true, count: entries.length, data: entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/ledger/:id/approve - mark approved (admin)
router.post('/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    const entry = await DeductionLedger.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, error: 'Entry not found' });
    entry.status = 'approved';
    await entry.save();
    res.status(200).json({ success: true, data: entry });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
