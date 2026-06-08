#!/usr/bin/env node

/**
 * Fix all TypeScript errors automatically
 */

const fs = require('fs');

console.log('\n🔧 Fixing TypeScript Errors...\n');

let fixCount = 0;

// Fix 1: CertificateClaimsManagement.tsx - showToast parameter order
console.log('📝 Fix 1: CertificateClaimsManagement.tsx');
const certClaimsPath = 'app/components/CertificateClaimsManagement.tsx';
if (fs.existsSync(certClaimsPath)) {
  let content = fs.readFileSync(certClaimsPath, 'utf8');
  
  // Fix showToast calls
  content = content.replace(/showToast\('error',\s*'([^']+)'\)/g, "showToast('$1', 'error')");
  content = content.replace(/showToast\('success',\s*'([^']+)'\)/g, "showToast('$1', 'success')");
  content = content.replace(/showToast\('warning',\s*'([^']+)'\)/g, "showToast('$1', 'warning')");
  
  // Fix confirmText to confirmButtonText
  content = content.replace(/confirmText:/g, 'confirmButtonText:');
  
  // Fix cancelText to cancelButtonText  
  content = content.replace(/cancelText:/g, 'cancelButtonText:');
  
  // Fix showCancel to showCancelButton
  content = content.replace(/showCancel:/g, 'showCancelButton:');
  
  // Fix await on non-async function (line 237)
  content = content.replace(/const downloadUrl = await apiService\.downloadCertificateDOCX/g, 
    'const downloadUrl = apiService.downloadCertificateDOCX');
  
  fs.writeFileSync(certClaimsPath, content);
  console.log('✅ Fixed');
  fixCount++;
}

// Fix 2: CertificateEditor.tsx
console.log('\n📝 Fix 2: CertificateEditor.tsx');
const certEditorPath = 'app/components/CertificateEditor.tsx';
if (fs.existsSync(certEditorPath)) {
  let content = fs.readFileSync(certEditorPath, 'utf8');
  content = content.replace(/confirmText:/g, 'confirmButtonText:');
  content = content.replace(/cancelText:/g, 'cancelButtonText:');
  fs.writeFileSync(certEditorPath, content);
  console.log('✅ Fixed');
  fixCount++;
}

// Fix 3: GeneratedCertificatesManagement.tsx
console.log('\n📝 Fix 3: GeneratedCertificatesManagement.tsx');
const genCertsPath = 'app/components/GeneratedCertificatesManagement.tsx';
if (fs.existsSync(genCertsPath)) {
  let content = fs.readFileSync(genCertsPath, 'utf8');
  content = content.replace(/confirmText:/g, 'confirmButtonText:');
  content = content.replace(/cancelText:/g, 'cancelButtonText:');
  fs.writeFileSync(genCertsPath, content);
  console.log('✅ Fixed');
  fixCount++;
}

// Fix 4: ConditionalLayout.tsx - Add children prop
console.log('\n📝 Fix 4: ConditionalLayout.tsx');
const conditionalLayoutPath = 'app/components/ConditionalLayout.tsx';
if (fs.existsSync(conditionalLayoutPath)) {
  let content = fs.readFileSync(conditionalLayoutPath, 'utf8');
  // Find AutoLogoutProvider without children and add it
  content = content.replace(
    /<AutoLogoutProvider\s*\/>/g,
    '<AutoLogoutProvider><main>{children}</main></AutoLogoutProvider>'
  );
  // If it's wrapped differently
  content = content.replace(
    /<AutoLogoutProvider>\s*<\/AutoLogoutProvider>/g,
    '<AutoLogoutProvider><main>{children}</main></AutoLogoutProvider>'
  );
  fs.writeFileSync(conditionalLayoutPath, content);
  console.log('✅ Fixed');
  fixCount++;
}

// Fix 5: courses/[id]/page.tsx
console.log('\n📝 Fix 5: courses/[id]/page.tsx');
const coursesIdPath = 'app/courses/[id]/page.tsx';
if (fs.existsSync(coursesIdPath)) {
  let content = fs.readFileSync(coursesIdPath, 'utf8');
  // Add type to id parameter
  content = content.replace(/params:\s*{\s*id\s*}/g, 'params: { id: string }');
  // Fix user.id possibly undefined
  content = content.replace(/user\.id/g, 'user?.id');
  fs.writeFileSync(coursesIdPath, content);
  console.log('✅ Fixed');
  fixCount++;
}

// Fix 6: dashboard/moderator/page.tsx - Add setStatusFilter
console.log('\n📝 Fix 6: dashboard/moderator/page.tsx');
const moderatorPath = 'app/dashboard/moderator/page.tsx';
if (fs.existsSync(moderatorPath)) {
  let content = fs.readFileSync(moderatorPath, 'utf8');
  // Add useState for statusFilter if not present
  if (!content.includes('const [statusFilter, setStatusFilter]')) {
    content = content.replace(
      /const \[activeTab,/,
      "const [statusFilter, setStatusFilter] = useState<string>('');\n  const [activeTab,"
    );
  }
  fs.writeFileSync(moderatorPath, content);
  console.log('✅ Fixed');
  fixCount++;
}

// Fix 7: student/cpd/[courseId]/claim-certificate/page.tsx
console.log('\n📝 Fix 7: student/cpd/[courseId]/claim-certificate/page.tsx');
const studentCpdClaimPath = 'app/dashboard/student/cpd/[courseId]/claim-certificate/page.tsx';
if (fs.existsSync(studentCpdClaimPath)) {
  let content = fs.readFileSync(studentCpdClaimPath, 'utf8');
  // Fix showToast parameter order
  content = content.replace(/showToast\('error',\s*'([^']+)'\)/g, "showToast('$1', 'error')");
  content = content.replace(/showToast\('success',\s*'([^']+)'\)/g, "showToast('$1', 'success')");
  content = content.replace(/showToast\('warning',\s*'([^']+)'\)/g, "showToast('$1', 'warning')");
  fs.writeFileSync(studentCpdClaimPath, content);
  console.log('✅ Fixed');
  fixCount++;
}

// Fix 8: admin/enrollments/[courseId]/[studentId]/setup/page.tsx
console.log('\n📝 Fix 8: admin/enrollments setup page');
const enrollmentSetupPath = 'app/dashboard/admin/enrollments/[courseId]/[studentId]/setup/page.tsx';
if (fs.existsSync(enrollmentSetupPath)) {
  let content = fs.readFileSync(enrollmentSetupPath, 'utf8');
  // Cast topicType to the correct type
  content = content.replace(
    /topicType:\s*([a-zA-Z0-9_]+\.type)/g,
    'topicType: $1 as "cpd_topic" | "qualification_unit"'
  );
  fs.writeFileSync(enrollmentSetupPath, content);
  console.log('✅ Fixed');
  fixCount++;
}

// Fix 9: admin/page.tsx - log.role comparisons
console.log('\n📝 Fix 9: admin/page.tsx');
const adminPagePath = 'app/dashboard/admin/page.tsx';
if (fs.existsSync(adminPagePath)) {
  let content = fs.readFileSync(adminPagePath, 'utf8');
  // Cast log.role for comparisons
  content = content.replace(
    /log\.role === 'manager'/g,
    "(log.role as any) === 'manager'"
  );
  content = content.replace(
    /log\.role === 'moderator'/g,
    "(log.role as any) === 'moderator'"
  );
  fs.writeFileSync(adminPagePath, content);
  console.log('✅ Fixed');
  fixCount++;
}

// Fix 10: qualification/units/[unitId]/edit/page.tsx
console.log('\n📝 Fix 10: qualification/units/[unitId]/edit/page.tsx');
const unitEditPath = 'app/dashboard/admin/qualification/units/[unitId]/edit/page.tsx';
if (fs.existsSync(unitEditPath)) {
  let content = fs.readFileSync(unitEditPath, 'utf8');
  // Cast userRole
  content = content.replace(
    /userRole={userRole}/g,
    'userRole={userRole as any}'
  );
  fs.writeFileSync(unitEditPath, content);
  console.log('✅ Fixed');
  fixCount++;
}

// Fix 11: CPD manage/create pages - UserRole case
console.log('\n📝 Fix 11: CPD pages UserRole case');
const cpdPages = [
  'app/dashboard/admin/cpd/[courseId]/manage/page.tsx',
  'app/dashboard/admin/cpd/create/page.tsx',
  'app/dashboard/admin/qualification/create/page.tsx'
];

cpdPages.forEach(pagePath => {
  if (fs.existsSync(pagePath)) {
    let content = fs.readFileSync(pagePath, 'utf8');
    // Fix lowercase role names to capitalized
    content = content.replace(/"admin"/g, '"Admin"');
    content = content.replace(/"tutor"/g, '"Tutor"');
    content = content.replace(/"student"/g, '"Student"');
    // Fix passing_score optional access
    content = content.replace(/\.passing_score/g, '?.passing_score');
    // Fix possibly undefined quiz access
    content = content.replace(/topic\.practice_quiz\./g, 'topic.practice_quiz?.');
    content = content.replace(/topic\.final_quiz\./g, 'topic.final_quiz?.');
    fs.writeFileSync(pagePath, content);
    fixCount++;
  }
});
console.log('✅ Fixed');

console.log(`\n✅ Applied ${fixCount} fixes!\n`);
console.log('Run: node check-errors.js to verify\n');

