const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserSession = require('../models/UserSession');
const { hashSessionId } = require('../services/accountSecurityService');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.sessionId = decoded.sid;

      // Get user from token (excluding password)
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          error: 'User not found' 
        });
      }

      if (['pending', 'rejected', 'inactive', 'resigned', 'terminated'].includes(req.user.status)) {
        return res.status(403).json({
          success: false,
          error: 'Your account is not active'
        });
      }

      if (req.user.changedPasswordAfter(decoded.iat)) {
        return res.status(401).json({
          success: false,
          error: 'Password changed recently. Please sign in again.'
        });
      }

      if (decoded.sid) {
        const activeSession = await UserSession.findOne({
          userId: req.user._id,
          tokenHash: hashSessionId(decoded.sid),
          revokedAt: null,
          expiresAt: { $gt: new Date() }
        });
        if (!activeSession) {
          return res.status(401).json({ success: false, error: 'Session expired or revoked' });
        }
        activeSession.lastSeenAt = new Date();
        await activeSession.save();
      }

      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ 
        success: false, 
        error: 'Not authorized' 
      });
    }
  }

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Not authorized, no token' 
    });
  }
};

// Admin only middleware
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin only.'
    });
  }
};

module.exports = { protect, adminOnly };
