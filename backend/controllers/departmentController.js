const Department = require('../models/Department');
const User = require('../models/User');
const { departmentMembershipQuery } = require('../services/userDepartmentService');

// Get all departments
exports.getAllDepartments = async (req, res) => {
  try {
    const { page = 1, limit = 50, isActive } = req.query;
    
    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    const departments = await Department.find(filter)
      .populate('managerId', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ name: 1 });
    
    // Add employee count for each department
    const departmentsWithCount = await Promise.all(departments.map(async (dept) => {
      const employeeCount = await User.countDocuments(departmentMembershipQuery(dept._id));
      return {
        ...dept.toObject(),
        employeeCount
      };
    }));
    
    const total = await Department.countDocuments(filter);
    
    res.json({
      success: true,
      data: departmentsWithCount,
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
      error: 'Failed to fetch departments',
      message: error.message
    });
  }
};

// Get department by ID
exports.getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('managerId', 'name email');
    
    if (!department) {
      return res.status(404).json({
        success: false,
        error: 'Department not found'
      });
    }
    
    res.json({
      success: true,
      data: department
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch department',
      message: error.message
    });
  }
};

// Create department
exports.createDepartment = async (req, res) => {
  try {
    const department = await Department.create(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: department
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors)
        .map((errItem) => errItem.message)
        .join(', ');
      return res.status(400).json({
        success: false,
        error: messages || 'Invalid department data'
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Department name or code already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create department',
      message: error.message
    });
  }
};

// Update department
exports.updateDepartment = async (req, res) => {
  try {
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!department) {
      return res.status(404).json({
        success: false,
        error: 'Department not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Department updated successfully',
      data: department
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update department',
      message: error.message
    });
  }
};

// Delete department
exports.deleteDepartment = async (req, res) => {
  try {
    const employeeCount = await User.countDocuments(departmentMembershipQuery(req.params.id));
    
    if (employeeCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete department. ${employeeCount} employees are assigned to this department.`
      });
    }
    
    const department = await Department.findByIdAndDelete(req.params.id);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        error: 'Department not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete department',
      message: error.message
    });
  }
};

// Get department employees
exports.getDepartmentEmployees = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const employees = await User.find(departmentMembershipQuery(req.params.id))
      .select('-password')
      .populate('department', 'name code')
      .populate('departments', 'name code')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ name: 1 });
    
    const total = await User.countDocuments(departmentMembershipQuery(req.params.id));
    
    res.json({
      success: true,
      data: employees,
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
      error: 'Failed to fetch department employees',
      message: error.message
    });
  }
};
