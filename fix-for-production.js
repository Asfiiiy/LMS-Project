#!/usr/bin/env node

/**
 * Automated Production Fixes
 * Fixes common issues before deployment
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔧 LMS Production Fix Script\n');
console.log('=' .repeat(60));

let fixCount = 0;

// Fix 1: Create apiUrl helper if missing
console.log('\n📝 Fix 1: Creating apiUrl helper...');
const apiUrlPath = 'app/utils/apiUrl.ts';
const apiUrlContent = `// Get API base URL - works in both client and server
export const getApiUrl = () => {
  // In browser, use env var or construct from window location
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 
           \`\${window.location.protocol}//\${window.location.hostname}:5000\`;
  }
  // On server, use env var or localhost
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
};
`;

if (!fs.existsSync('app/utils')) {
  fs.mkdirSync('app/utils', { recursive: true });
}

fs.writeFileSync(apiUrlPath, apiUrlContent);
console.log('✅ Created app/utils/apiUrl.ts');
fixCount++;

// Fix 2: Update useAutoLogout.ts
console.log('\n📝 Fix 2: Fixing useAutoLogout.ts...');
const autoLogoutPath = 'app/hooks/useAutoLogout.ts';
if (fs.existsSync(autoLogoutPath)) {
  let content = fs.readFileSync(autoLogoutPath, 'utf8');
  
  // Add import if not present
  if (!content.includes("import { getApiUrl } from '../utils/apiUrl'")) {
    content = content.replace(
      "import { showSweetAlert } from '../components/SweetAlert';",
      "import { showSweetAlert } from '../components/SweetAlert';\nimport { getApiUrl } from '../utils/apiUrl';"
    );
  }
  
  // Replace hardcoded URLs
  content = content.replace(
    /'http:\/\/localhost:5000\/api\/login\/logout'/g,
    '`${getApiUrl()}/api/login/logout`'
  );
  content = content.replace(
    /'http:\/\/localhost:5000\/api\/login\/refresh'/g,
    '`${getApiUrl()}/api/login/refresh`'
  );
  
  fs.writeFileSync(autoLogoutPath, content);
  console.log('✅ Fixed useAutoLogout.ts');
  fixCount++;
} else {
  console.log('⚠️  useAutoLogout.ts not found');
}

// Fix 3: Ensure api.ts adds /api suffix
console.log('\n📝 Fix 3: Fixing api.ts...');
const apiServicePath = 'app/services/api.ts';
if (fs.existsSync(apiServicePath)) {
  let content = fs.readFileSync(apiServicePath, 'utf8');
  
  // Check if baseUrl assignment needs fixing
  if (content.includes('this.baseUrl = apiUrl;') && 
      !content.includes('this.baseUrl = apiUrl.endsWith')) {
    content = content.replace(
      'this.baseUrl = apiUrl;',
      'this.baseUrl = apiUrl.endsWith("/api") ? apiUrl : `${apiUrl}/api`;'
    );
    content = content.replace(
      'this.baseUrlPublic = apiUrl;',
      'this.baseUrlPublic = apiUrl.endsWith("/api") ? apiUrl : `${apiUrl}/api`;'
    );
    fs.writeFileSync(apiServicePath, content);
    console.log('✅ Fixed api.ts');
    fixCount++;
  } else {
    console.log('✅ api.ts already correct');
  }
} else {
  console.log('⚠️  api.ts not found');
}

// Fix 4: Create .env.local if missing
console.log('\n📝 Fix 4: Checking .env.local...');
if (!fs.existsSync('.env.local')) {
  const envContent = `# Frontend Environment Variables
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
`;
  fs.writeFileSync('.env.local', envContent);
  console.log('✅ Created .env.local');
  fixCount++;
} else {
  console.log('✅ .env.local exists');
}

// Fix 5: Create backend/.env if missing
console.log('\n📝 Fix 5: Checking backend/.env...');
if (!fs.existsSync('backend/.env')) {
  const backendEnvContent = `# Backend Environment Variables
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_change_in_production
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=db_lms
REDIS_URL=redis://localhost:6379
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
STRIPE_SECRET_KEY=your_stripe_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
`;
  fs.writeFileSync('backend/.env', backendEnvContent);
  console.log('✅ Created backend/.env (UPDATE WITH REAL VALUES!)');
  fixCount++;
} else {
  console.log('✅ backend/.env exists');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log(`\n✅ Applied ${fixCount} fixes!\n`);
console.log('Next steps:');
console.log('1. Run: node check-errors.js');
console.log('2. Fix any remaining errors');
console.log('3. Test locally: npm run dev');
console.log('4. Deploy to VPS\n');

