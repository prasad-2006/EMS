const authorize = (...rolesInput) => {
  const roles = Array.isArray(rolesInput[0]) ? rolesInput[0] : rolesInput;

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Not authorized' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: `User role ${req.user.role} is not authorized to access this route` 
      });
    }
    
    next();
  };
};

// Alias for checkRole (same functionality)
const checkRole = authorize;

module.exports = { authorize, checkRole };
