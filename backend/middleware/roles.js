// backend/middleware/permit.js
const permit = (...allowedRoles) => {
  return (req, res, next) => {
    // JWT may deserialize role_id as string ("15") — normalize for strict equality
    const rawId = req.user?.role_id;
    const userRoleId =
      rawId === undefined || rawId === null || rawId === '' ? null : Number(rawId);

    // Role name to ID mapping
    const roleMap = {
      Admin: 1, Tutor: 2, Manager: 3, Student: 4, Moderator: 5,
      'Operation Manager': 6, 'Accounts Manager': 7, 'Administrative Manager': 8,
      'Admission Manager': 9, 'Team Member': 10, 'Certificate Manager': 11,
      'Claim Manager': 12, 'ManagerStudent': 13, 'InstituteStudent': 14,
      'Consultation Manager': 15
    };
    
    // Convert role names to IDs
    const allowedRoleIds = allowedRoles.map(role => {
      if (typeof role === 'string') {
        return roleMap[role];
      }
      return role; // Already a number (role ID)
    });

    if (userRoleId != null && !Number.isNaN(userRoleId) && allowedRoleIds.includes(userRoleId)) {
      return next();
    }

    return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
  };
};

module.exports = { permit };
