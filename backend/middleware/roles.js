// backend/middleware/permit.js
const permit = (...allowedRoles) => {
  return (req, res, next) => {
    const userRoleId = req.user?.role_id;

    // Role name to ID mapping
    const roleMap = { Admin: 1, Tutor: 2, Manager: 3, Student: 4, Moderator: 5 };
    
    // Convert role names to IDs
    const allowedRoleIds = allowedRoles.map(role => {
      if (typeof role === 'string') {
        return roleMap[role];
      }
      return role; // Already a number (role ID)
    });

    // Check if user's role ID is in allowed roles
    if (allowedRoleIds.includes(userRoleId)) {
      return next();
    }

    return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
  };
};

module.exports = { permit };
