const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { createSession, decryptMfaSecret, verifyTotpCode, consumeRecoveryCode } = require('../services/accountSecurityService');
const { sendPasswordResetEmail } = require('../services/emailService');

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const generatePasswordResetToken = () => crypto.randomBytes(32).toString('hex');

// Generate JWT Token
const generateToken = (id, sessionId) => {
  return jwt.sign({ id, sid: sessionId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

const DEFAULT_MAX_ADMIN_ACCOUNTS = 5;
const LOGIN_BLOCKED_STATUSES = ['pending', 'rejected', 'inactive', 'resigned', 'terminated'];
const MAX_ADMIN_ACCOUNTS = Math.min(
  Number(process.env.MAX_ADMIN_ACCOUNTS) || DEFAULT_MAX_ADMIN_ACCOUNTS,
  DEFAULT_MAX_ADMIN_ACCOUNTS
);

const getAdminSignupAvailability = async () => {
  const adminCount = await User.countDocuments({
    role: 'admin',
    isDeleted: { $ne: true }
  });

  return {
    adminCount,
    maxAdmins: MAX_ADMIN_ACCOUNTS,
    available: adminCount < MAX_ADMIN_ACCOUNTS,
    remainingSlots: Math.max(MAX_ADMIN_ACCOUNTS - adminCount, 0)
  };
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (role === 'admin') {
      const adminSignup = await getAdminSignupAvailability();
      if (!adminSignup.available) {
        return res.status(403).json({
          success: false,
          error: 'Admin registration is closed because the maximum number of admin accounts has been reached.'
        });
      }
    }

    // Check if user exists
    const userExists = await User.findOne({
      email: { $regex: `^${escapeRegExp(normalizedEmail)}$`, $options: 'i' }
    });
    if (userExists) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role: role || 'employee',
      status: role === 'admin' ? 'active' : 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful! Your account is pending admin approval.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error during registration'
    });
  }
};

// @desc    Check if admin signup is available
// @route   GET /api/auth/admin-signup-status
// @access  Public
const getAdminSignupStatus = async (req, res) => {
  try {
    const availability = await getAdminSignupAvailability();

    res.status(200).json({
      success: true,
      ...availability
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error while checking admin signup availability'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password, mfaCode } = req.body;
    const normalizedEmail = normalizeEmail(email);

    // Check for user
    const user = await User.findOne({
      email: { $regex: `^${escapeRegExp(normalizedEmail)}$`, $options: 'i' }
    }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    if (user.accountLockedUntil && user.accountLockedUntil > Date.now()) {
      return res.status(423).json({
        success: false,
        error: 'Account temporarily locked. Please try again later.'
      });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      await user.incrementLoginAttempts();
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    if (LOGIN_BLOCKED_STATUSES.includes(user.status)) {
      return res.status(403).json({
        success: false,
        error: user.status === 'pending'
          ? 'Your account is pending approval. Please wait for admin approval.'
          : user.status === 'rejected'
            ? 'Your account has been rejected. Please contact the administrator.'
            : 'Your account is not active. Please contact the administrator.'
      });
    }

    if (user.mfaEnabled) {
      const mfaUser = await User.findById(user._id).select('+mfaSecretEncrypted +mfaRecoveryCodeHashes');
      if (!mfaCode) return res.status(200).json({ success: false, mfaRequired: true, error: 'MFA code required' });
      const validTotp = mfaUser.mfaSecretEncrypted && verifyTotpCode(decryptMfaSecret(mfaUser.mfaSecretEncrypted), mfaCode);
      const validRecoveryCode = !validTotp && consumeRecoveryCode(mfaUser, mfaCode);
      if (!validTotp && !validRecoveryCode) {
        return res.status(401).json({ success: false, error: 'Invalid MFA code' });
      }
      if (validRecoveryCode) await mfaUser.save({ validateBeforeSave: false });
    }

    await user.resetLoginAttempts();
    user.lastLoginAt = new Date();
    user.lastLoginIP = req.ip;
    await user.save({ validateBeforeSave: false });

    // Generate token
    const sessionId = crypto.randomUUID();
    const token = generateToken(user._id, sessionId);
    await createSession({ userId: user._id, sessionId, token, req });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        leaveBalance: user.leaveBalance
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error during login'
    });
  }
};

// @desc    Request password reset
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    const user = await User.findOne({
      email: { $regex: `^${escapeRegExp(email)}$`, $options: 'i' }
    });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists for that email, a reset link has been sent.'
      });
    }

    const resetToken = generatePasswordResetToken();
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const emailResult = await sendPasswordResetEmail(user, resetUrl);

    res.status(200).json({
      success: true,
      message: 'If an account exists for that email, a reset link has been sent.',
      ...(process.env.NODE_ENV !== 'production' && emailResult?.success === false ? { resetUrl } : {})
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error while requesting password reset'
    });
  }
};

// @desc    Reset password with token
// @route   POST /api/auth/reset-password/:token
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 10 characters'
      });
    }

    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: resetTokenHash,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+password');

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Reset token is invalid or has expired'
      });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.failedLoginAttempts = 0;
    user.accountLockedUntil = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now sign in.'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error while resetting password'
    });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  getAdminSignupStatus
};
