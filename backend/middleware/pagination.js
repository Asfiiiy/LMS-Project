// backend/middleware/pagination.js
const pagination = (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  // Allow up to 50,000 for admin user management (client-side filtering)
  const limit = Math.min(50000, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  
  req.pagination = {
    page,
    limit,
    offset
  };
  
  next();
};

module.exports = pagination;

