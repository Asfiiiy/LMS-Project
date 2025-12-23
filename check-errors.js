#!/usr/bin/env node

/**
 * Comprehensive TypeScript & Build Error Checker
 * Run this before deployment to catch all issues
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n🔍 LMS TypeScript & Build Error Checker\n');
console.log('=' .repeat(60));

let hasErrors = false;
const errors = [];

// Helper function to run commands
function runCommand(command, description) {
  console.log(`\n📋 ${description}...`);
  try {
    const output = execSync(command, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log(`✅ ${description} - PASSED`);
    return { success: true, output };
  } catch (error) {
    console.log(`❌ ${description} - FAILED`);
    errors.push({
      step: description,
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr
    });
    hasErrors = true;
    return { success: false, error };
  }
}

// Check 1: Node modules installed
console.log('\n📦 Step 1: Checking Dependencies');
console.log('-'.repeat(60));
if (!fs.existsSync('node_modules')) {
  console.log('❌ node_modules not found. Run: npm install --legacy-peer-deps');
  hasErrors = true;
} else {
  console.log('✅ Frontend dependencies installed');
}

if (!fs.existsSync('backend/node_modules')) {
  console.log('❌ backend/node_modules not found. Run: cd backend && npm install --legacy-peer-deps');
  hasErrors = true;
} else {
  console.log('✅ Backend dependencies installed');
}

// Check 2: Environment files
console.log('\n🔐 Step 2: Checking Environment Files');
console.log('-'.repeat(60));
const envFiles = [
  { path: '.env.local', required: ['NEXT_PUBLIC_API_URL'] },
  { path: 'backend/.env', required: ['PORT', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'] }
];

envFiles.forEach(({ path: envPath, required }) => {
  if (!fs.existsSync(envPath)) {
    console.log(`❌ ${envPath} not found`);
    hasErrors = true;
  } else {
    const content = fs.readFileSync(envPath, 'utf8');
    const missing = required.filter(key => !content.includes(key));
    if (missing.length > 0) {
      console.log(`⚠️  ${envPath} missing: ${missing.join(', ')}`);
    } else {
      console.log(`✅ ${envPath} configured`);
    }
  }
});

// Check 3: TypeScript compilation
console.log('\n🔨 Step 3: TypeScript Type Checking');
console.log('-'.repeat(60));
runCommand('npx tsc --noEmit', 'TypeScript type check');

// Check 4: ESLint
console.log('\n🔍 Step 4: ESLint Check');
console.log('-'.repeat(60));
runCommand('npx next lint', 'ESLint check');

// Check 5: Next.js build
console.log('\n🏗️  Step 5: Next.js Production Build');
console.log('-'.repeat(60));
const buildResult = runCommand('npm run build', 'Next.js build');

// Check 6: Backend syntax check
console.log('\n⚙️  Step 6: Backend Syntax Check');
console.log('-'.repeat(60));
runCommand('node -c backend/server.js', 'Backend syntax check');

// Check 7: Critical files exist
console.log('\n📁 Step 7: Critical Files Check');
console.log('-'.repeat(60));
const criticalFiles = [
  'app/page.tsx',
  'app/services/api.ts',
  'app/hooks/useAutoLogout.ts',
  'backend/server.js',
  'backend/config/db.js',
  'backend/routes/login.js',
  'package.json',
  'tsconfig.json',
  'next.config.ts'
];

criticalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    hasErrors = true;
  }
});

// Check 8: Hardcoded localhost URLs
console.log('\n🌐 Step 8: Checking for Hardcoded localhost URLs');
console.log('-'.repeat(60));
const filesToCheck = [
  'app/hooks/useAutoLogout.ts',
  'app/services/api.ts',
  'app/page.tsx'
];

filesToCheck.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const hardcodedUrls = content.match(/['"`]http:\/\/localhost:5000[^'"`]*/g);
    if (hardcodedUrls && hardcodedUrls.length > 0) {
      console.log(`⚠️  ${file} has hardcoded localhost URLs:`);
      hardcodedUrls.forEach(url => console.log(`   - ${url}`));
    } else {
      console.log(`✅ ${file} - No hardcoded URLs`);
    }
  }
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 SUMMARY\n');

if (hasErrors) {
  console.log('❌ BUILD CHECK FAILED\n');
  console.log('Errors found:');
  errors.forEach((err, idx) => {
    console.log(`\n${idx + 1}. ${err.step}`);
    if (err.stderr) {
      console.log('Error output:');
      console.log(err.stderr.substring(0, 500));
    }
  });
  console.log('\n⚠️  Fix these errors before deployment!\n');
  process.exit(1);
} else {
  console.log('✅ ALL CHECKS PASSED!\n');
  console.log('🚀 Your code is ready for deployment!\n');
  console.log('Next steps:');
  console.log('1. Review the build output above');
  console.log('2. Test locally: npm run dev');
  console.log('3. Deploy to VPS using SCP or Git\n');
  process.exit(0);
}

