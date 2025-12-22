const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'dlbgdbmnt',
  api_key: '937666398522797',
  api_secret: '9GIjV08yTrj3nnXU3GYR0xFHL_w',
  secure: true  // Use HTTPS URLs
});

console.log('[Cloudinary] Configuration loaded for cloud:', cloudinary.config().cloud_name);

module.exports = cloudinary;

