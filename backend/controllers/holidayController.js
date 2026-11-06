const Holiday = require('../models/Holiday');
const User = require('../models/User');
const Notification = require('../models/Notification');

const normalizeHolidayForClient = (holidayDoc) => {
  const holiday = holidayDoc.toObject ? holidayDoc.toObject() : holidayDoc;
  return {
    ...holiday,
    // Backward compatibility for frontend that still reads applicableDepartments.
    applicableDepartments: holiday?.observedBy?.departments || []
  };
};

const normalizeIncomingHolidayPayload = (payload = {}) => {
  const next = { ...payload };

  // Support old frontend payload shape using applicableDepartments.
  if (Array.isArray(next.applicableDepartments)) {
    next.observedBy = {
      ...(next.observedBy || {}),
      departments: next.applicableDepartments
    };
    delete next.applicableDepartments;
  }

  return next;
};

const notifyUsersAboutHoliday = async (action, holiday) => {
  try {
    const users = await User.find({
      role: { $ne: 'admin' },
      $or: [
        { role: { $ne: 'employee' } },
        { status: 'approved' }
      ]
    }).select('_id');

    if (!users.length) return;

    const holidayDate = new Date(holiday.date).toISOString().split('T')[0];

    let title = 'Holiday update';
    let message = `Holiday "${holiday.name}" (${holidayDate}) was updated.`;

    if (action === 'created') {
      title = 'New holiday announced';
      message = `A new holiday "${holiday.name}" is added for ${holidayDate}.`;
    }

    if (action === 'deleted') {
      title = 'Holiday removed';
      message = `Holiday "${holiday.name}" (${holidayDate}) was removed.`;
    }

    const payload = users.map((user) => ({
      userId: user._id,
      type: 'system',
      title,
      message
    }));

    await Notification.insertMany(payload, { ordered: false });
  } catch (error) {
    console.error('Failed to create holiday notifications:', error.message);
  }
};

// Get all holidays
exports.getAllHolidays = async (req, res) => {
  try {
    const { page = 1, limit = 100, type, year, isActive } = req.query;
    
    const filter = {};
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    // Filter by year if provided
    if (year) {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31, 23, 59, 59);
      filter.date = { $gte: startOfYear, $lte: endOfYear };
    }
    
    const holidays = await Holiday.find(filter)
      .populate('observedBy.departments', 'name code')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ date: 1 });
    
    const total = await Holiday.countDocuments(filter);
    
    res.json({
      success: true,
      data: holidays.map(normalizeHolidayForClient),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch holidays',
      message: error.message
    });
  }
};

// Get holiday by ID
exports.getHolidayById = async (req, res) => {
  try {
    const holiday = await Holiday.findById(req.params.id)
      .populate('observedBy.departments', 'name code');
    
    if (!holiday) {
      return res.status(404).json({
        success: false,
        error: 'Holiday not found'
      });
    }
    
    res.json({
      success: true,
      data: normalizeHolidayForClient(holiday)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch holiday',
      message: error.message
    });
  }
};

// Create holiday
exports.createHoliday = async (req, res) => {
  try {
    const payload = normalizeIncomingHolidayPayload(req.body);
    const holiday = await Holiday.create(payload);
    await notifyUsersAboutHoliday('created', holiday);
    
    res.status(201).json({
      success: true,
      message: 'Holiday created successfully',
      data: holiday
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create holiday',
      message: error.message
    });
  }
};

// Update holiday
exports.updateHoliday = async (req, res) => {
  try {
    const payload = normalizeIncomingHolidayPayload(req.body);
    const holiday = await Holiday.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    );
    
    if (!holiday) {
      return res.status(404).json({
        success: false,
        error: 'Holiday not found'
      });
    }

    await notifyUsersAboutHoliday('updated', holiday);
    
    res.json({
      success: true,
      message: 'Holiday updated successfully',
      data: holiday
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update holiday',
      message: error.message
    });
  }
};

// Delete holiday
exports.deleteHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndDelete(req.params.id);
    
    if (!holiday) {
      return res.status(404).json({
        success: false,
        error: 'Holiday not found'
      });
    }

    await notifyUsersAboutHoliday('deleted', holiday);
    
    res.json({
      success: true,
      message: 'Holiday deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete holiday',
      message: error.message
    });
  }
};

// Get upcoming holidays
exports.getUpcomingHolidays = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const holidays = await Holiday.find({
      date: { $gte: today },
      isActive: true
    })
      .populate('observedBy.departments', 'name code')
      .limit(parseInt(limit))
      .sort({ date: 1 });
    
    res.json({
      success: true,
      data: holidays.map(normalizeHolidayForClient)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch upcoming holidays',
      message: error.message
    });
  }
};

// Check if date is holiday
exports.checkHoliday = async (req, res) => {
  try {
    const { date, departmentId } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Date is required'
      });
    }
    
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    const filter = {
      date: checkDate,
      isActive: true
    };
    
    // Check if department-specific holiday
    if (departmentId) {
      filter.$or = [
        { 'observedBy.departments': { $size: 0 } },
        { 'observedBy.departments': departmentId }
      ];
    }
    
    const holiday = await Holiday.findOne(filter);
    
    res.json({
      success: true,
      isHoliday: !!holiday,
      holiday: holiday || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check holiday',
      message: error.message
    });
  }
};
