/**
 * =====================================================
 * DATABASE ANALYSIS SCRIPT
 * =====================================================
 * This script analyzes the current LMS database structure
 * and identifies what's needed for Qualification courses
 * =====================================================
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_lms',
  port: process.env.DB_PORT || 3306
};

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Helper functions for colored output
const log = {
  header: (text) => console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(70)}${colors.reset}`),
  title: (text) => console.log(`${colors.bright}${colors.cyan}${text}${colors.reset}`),
  success: (text) => console.log(`${colors.green}✓ ${text}${colors.reset}`),
  warning: (text) => console.log(`${colors.yellow}⚠ ${text}${colors.reset}`),
  error: (text) => console.log(`${colors.red}✗ ${text}${colors.reset}`),
  info: (text) => console.log(`${colors.blue}ℹ ${text}${colors.reset}`),
  data: (text) => console.log(`  ${colors.white}${text}${colors.reset}`),
  section: (text) => console.log(`\n${colors.bright}${colors.magenta}${text}${colors.reset}`)
};

async function analyzeDatabase() {
  let connection;
  
  try {
    log.header();
    log.title('LMS DATABASE ANALYSIS REPORT');
    log.header();
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    log.success(`Connected to database: ${dbConfig.database}`);
    
    // =====================================================
    // 1. EXISTING TABLES ANALYSIS
    // =====================================================
    log.section('📊 EXISTING TABLES IN DATABASE');
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(row => Object.values(row)[0]);
    
    log.info(`Total tables found: ${tableNames.length}`);
    
    // Categorize tables
    const cpdTables = tableNames.filter(t => t.startsWith('cpd_'));
    const qualTables = tableNames.filter(t => t.startsWith('qual_'));
    const coreTables = tableNames.filter(t => !t.startsWith('cpd_') && !t.startsWith('qual_'));
    
    log.data(`Core tables: ${coreTables.length}`);
    log.data(`CPD tables: ${cpdTables.length}`);
    log.data(`Qualification tables: ${qualTables.length}`);
    
    console.log('\nCore Tables:');
    coreTables.forEach(table => log.data(`  - ${table}`));
    
    console.log('\nCPD Tables:');
    cpdTables.forEach(table => log.data(`  - ${table}`));
    
    if (qualTables.length > 0) {
      console.log('\nQualification Tables:');
      qualTables.forEach(table => log.data(`  - ${table}`));
    } else {
      log.warning('No qualification tables found yet');
    }
    
    // =====================================================
    // 2. ANALYZE CORE TABLES STRUCTURE
    // =====================================================
    log.section('📋 CORE TABLES DETAILED ANALYSIS');
    
    const importantCoreTables = [
      'users',
      'roles',
      'courses',
      'course_assignments',
      'units',
      'unit_progress',
      'assignments',
      'assignment_submissions',
      'quizzes',
      'quiz_questions',
      'quiz_attempts',
      'resources'
    ];
    
    for (const tableName of importantCoreTables) {
      if (tableNames.includes(tableName)) {
        const [columns] = await connection.query(`DESCRIBE ${tableName}`);
        const [count] = await connection.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        
        console.log(`\n${colors.bright}${tableName}${colors.reset}`);
        log.data(`Records: ${count[0].count}`);
        log.data(`Columns: ${columns.length}`);
        
        // Show key columns
        const keyColumns = columns.filter(col => 
          col.Key === 'PRI' || 
          col.Key === 'MUL' || 
          col.Field.includes('type') ||
          col.Field.includes('status')
        );
        
        if (keyColumns.length > 0) {
          log.data('Key columns:');
          keyColumns.forEach(col => {
            const typeInfo = col.Type;
            const keyInfo = col.Key === 'PRI' ? ' [PRIMARY]' : col.Key === 'MUL' ? ' [FOREIGN]' : '';
            log.data(`    ${col.Field}: ${typeInfo}${keyInfo}`);
          });
        }
      } else {
        log.warning(`Table '${tableName}' not found`);
      }
    }
    
    // =====================================================
    // 3. CHECK COURSES TABLE FOR COURSE_TYPE
    // =====================================================
    log.section('🎓 COURSES TABLE ANALYSIS');
    
    if (tableNames.includes('courses')) {
      const [coursesColumns] = await connection.query('DESCRIBE courses');
      const courseTypeColumn = coursesColumns.find(col => col.Field === 'course_type');
      
      if (courseTypeColumn) {
        log.success('course_type column exists');
        log.data(`Type: ${courseTypeColumn.Type}`);
        
        // Count courses by type
        const [coursesByType] = await connection.query(`
          SELECT 
            COALESCE(course_type, 'NULL') as course_type,
            COUNT(*) as count
          FROM courses
          GROUP BY course_type
        `);
        
        console.log('\nCourses by type:');
        coursesByType.forEach(row => {
          log.data(`  ${row.course_type}: ${row.count} courses`);
        });
      } else {
        log.error('course_type column NOT found - needs to be added');
      }
      
      // Show course status
      const [coursesByStatus] = await connection.query(`
        SELECT 
          status,
          COUNT(*) as count
        FROM courses
        GROUP BY status
      `);
      
      console.log('\nCourses by status:');
      coursesByStatus.forEach(row => {
        log.data(`  ${row.status || 'NULL'}: ${row.count} courses`);
      });
    }
    
    // =====================================================
    // 4. CHECK UNITS TABLE
    // =====================================================
    log.section('📦 UNITS TABLE ANALYSIS');
    
    if (tableNames.includes('units')) {
      const [unitsColumns] = await connection.query('DESCRIBE units');
      const [unitsCount] = await connection.query('SELECT COUNT(*) as count FROM units');
      
      log.success(`Units table exists with ${unitsCount[0].count} records`);
      
      // Check for qualification-specific columns
      const requiredColumns = [
        'order_index',
        'is_optional',
        'unlock_condition'
      ];
      
      console.log('\nRequired columns for Qualification courses:');
      requiredColumns.forEach(colName => {
        const exists = unitsColumns.find(col => col.Field === colName);
        if (exists) {
          log.success(`${colName}: ${exists.Type}`);
        } else {
          log.error(`${colName}: MISSING`);
        }
      });
      
      // Show all columns
      console.log('\nAll columns:');
      unitsColumns.forEach(col => {
        log.data(`  ${col.Field}: ${col.Type}${col.Key === 'PRI' ? ' [PRIMARY]' : ''}${col.Key === 'MUL' ? ' [FOREIGN]' : ''}`);
      });
    } else {
      log.error('Units table NOT found');
    }
    
    // =====================================================
    // 5. CHECK CPD SYSTEM TABLES
    // =====================================================
    log.section('📘 CPD SYSTEM STATUS');
    
    if (cpdTables.length > 0) {
      log.success(`CPD system is active with ${cpdTables.length} tables`);
      
      // Get CPD courses count
      const [cpdCourses] = await connection.query(`
        SELECT COUNT(*) as count 
        FROM courses 
        WHERE course_type = 'cpd'
      `);
      log.data(`CPD Courses: ${cpdCourses[0].count}`);
      
      // Get CPD topics count
      if (tableNames.includes('cpd_topics')) {
        const [cpdTopics] = await connection.query('SELECT COUNT(*) as count FROM cpd_topics');
        log.data(`CPD Topics: ${cpdTopics[0].count}`);
      }
      
      // Get CPD enrollments count
      if (tableNames.includes('cpd_progress')) {
        const [cpdProgress] = await connection.query('SELECT COUNT(*) as count FROM cpd_progress');
        log.data(`CPD Progress Records: ${cpdProgress[0].count}`);
      }
    } else {
      log.warning('CPD system not yet implemented');
    }
    
    // =====================================================
    // 6. IDENTIFY MISSING TABLES FOR QUALIFICATION
    // =====================================================
    log.section('🔍 QUALIFICATION SYSTEM REQUIREMENTS');
    
    const requiredQualificationTables = [
      {
        name: 'qual_units',
        purpose: 'Store qualification unit structure',
        exists: tableNames.includes('qual_units')
      },
      {
        name: 'qual_unit_announcements',
        purpose: 'Unit-level announcements',
        exists: tableNames.includes('qual_unit_announcements')
      },
      {
        name: 'qual_unit_content',
        purpose: 'Welcome, disclaimer, general info per unit',
        exists: tableNames.includes('qual_unit_content')
      },
      {
        name: 'qual_topics',
        purpose: 'Topics within units',
        exists: tableNames.includes('qual_topics')
      },
      {
        name: 'qual_topic_files',
        purpose: 'Files attached to topics',
        exists: tableNames.includes('qual_topic_files')
      },
      {
        name: 'qual_additional_readings',
        purpose: 'Additional reading materials per unit',
        exists: tableNames.includes('qual_additional_readings')
      },
      {
        name: 'qual_assignment_briefs',
        purpose: 'Assignment briefs with files',
        exists: tableNames.includes('qual_assignment_briefs')
      },
      {
        name: 'qual_assignment_brief_files',
        purpose: 'Files for assignment briefs',
        exists: tableNames.includes('qual_assignment_brief_files')
      },
      {
        name: 'qual_submissions',
        purpose: 'Student assignment/presentation submissions',
        exists: tableNames.includes('qual_submissions')
      },
      {
        name: 'qual_unit_progress',
        purpose: 'Track student progress per unit',
        exists: tableNames.includes('qual_unit_progress')
      }
    ];
    
    console.log('\nRequired Qualification Tables:');
    let missingCount = 0;
    requiredQualificationTables.forEach(table => {
      if (table.exists) {
        log.success(`${table.name} - ${table.purpose}`);
      } else {
        log.error(`${table.name} - ${table.purpose} [MISSING]`);
        missingCount++;
      }
    });
    
    // =====================================================
    // 7. CHECK EXISTING ASSIGNMENT SYSTEM
    // =====================================================
    log.section('📝 ASSIGNMENT SYSTEM STATUS');
    
    if (tableNames.includes('assignments')) {
      const [assignmentsColumns] = await connection.query('DESCRIBE assignments');
      const [assignmentsCount] = await connection.query('SELECT COUNT(*) as count FROM assignments');
      
      log.success(`Assignments table exists with ${assignmentsCount[0].count} records`);
      
      console.log('\nAssignments table columns:');
      assignmentsColumns.forEach(col => {
        log.data(`  ${col.Field}: ${col.Type}`);
      });
    }
    
    if (tableNames.includes('assignment_submissions')) {
      const [submissionsColumns] = await connection.query('DESCRIBE assignment_submissions');
      const [submissionsCount] = await connection.query('SELECT COUNT(*) as count FROM assignment_submissions');
      
      log.success(`Assignment_submissions table exists with ${submissionsCount[0].count} records`);
      
      // Check for grading columns
      const gradingColumns = ['grade', 'feedback', 'status', 'graded_by', 'graded_at'];
      console.log('\nGrading-related columns:');
      gradingColumns.forEach(colName => {
        const exists = submissionsColumns.find(col => col.Field === colName);
        if (exists) {
          log.success(`${colName}: ${exists.Type}`);
        } else {
          log.warning(`${colName}: not found`);
        }
      });
    }
    
    // =====================================================
    // 8. CHECK QUIZ SYSTEM
    // =====================================================
    log.section('❓ QUIZ SYSTEM STATUS');
    
    if (tableNames.includes('quizzes')) {
      const [quizzesColumns] = await connection.query('DESCRIBE quizzes');
      const [quizzesCount] = await connection.query('SELECT COUNT(*) as count FROM quizzes');
      
      log.success(`Quizzes table exists with ${quizzesCount[0].count} records`);
      
      // Check for quiz_type and passing_score
      const quizTypeCol = quizzesColumns.find(col => col.Field === 'quiz_type');
      const passingScoreCol = quizzesColumns.find(col => col.Field === 'passing_score');
      
      if (quizTypeCol) {
        log.success(`quiz_type column exists: ${quizTypeCol.Type}`);
      } else {
        log.error('quiz_type column MISSING (needed for practice vs final)');
      }
      
      if (passingScoreCol) {
        log.success(`passing_score column exists: ${passingScoreCol.Type}`);
      } else {
        log.error('passing_score column MISSING');
      }
    }
    
    if (tableNames.includes('quiz_attempts')) {
      const [attemptsCount] = await connection.query('SELECT COUNT(*) as count FROM quiz_attempts');
      log.success(`Quiz_attempts table exists with ${attemptsCount[0].count} records`);
    }
    
    // =====================================================
    // 9. CHECK USER ROLES
    // =====================================================
    log.section('👥 USER ROLES ANALYSIS');
    
    if (tableNames.includes('roles')) {
      const [roles] = await connection.query('SELECT * FROM roles');
      
      log.info(`Total roles: ${roles.length}`);
      console.log('\nAvailable roles:');
      roles.forEach(role => {
        log.data(`  ${role.id}: ${role.name}`);
      });
      
      // Check for required roles
      const requiredRoles = ['Admin', 'Tutor', 'Student'];
      requiredRoles.forEach(roleName => {
        const exists = roles.find(r => r.name === roleName);
        if (exists) {
          log.success(`${roleName} role exists`);
        } else {
          log.warning(`${roleName} role not found`);
        }
      });
    }
    
    if (tableNames.includes('users')) {
      const [userStats] = await connection.query(`
        SELECT 
          r.name as role_name,
          COUNT(*) as count
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        GROUP BY r.name
      `);
      
      console.log('\nUsers by role:');
      userStats.forEach(stat => {
        log.data(`  ${stat.role_name || 'No Role'}: ${stat.count} users`);
      });
    }
    
    // =====================================================
    // 10. SUMMARY & RECOMMENDATIONS
    // =====================================================
    log.section('📊 SUMMARY & RECOMMENDATIONS');
    
    console.log('\n' + colors.bright + 'Current System Status:' + colors.reset);
    
    // CPD Status
    if (cpdTables.length >= 10) {
      log.success('CPD System: FULLY IMPLEMENTED ✓');
    } else {
      log.warning('CPD System: PARTIALLY IMPLEMENTED');
    }
    
    // Qualification Status
    if (missingCount === 0) {
      log.success('Qualification System: FULLY IMPLEMENTED ✓');
    } else if (missingCount < requiredQualificationTables.length) {
      log.warning(`Qualification System: PARTIALLY IMPLEMENTED (${missingCount} tables missing)`);
    } else {
      log.error(`Qualification System: NOT IMPLEMENTED (${missingCount} tables needed)`);
    }
    
    // Core System
    const hasUnits = tableNames.includes('units');
    const hasAssignments = tableNames.includes('assignments');
    const hasQuizzes = tableNames.includes('quizzes');
    
    if (hasUnits && hasAssignments && hasQuizzes) {
      log.success('Core System: READY FOR QUALIFICATION COURSES ✓');
    } else {
      log.warning('Core System: MISSING COMPONENTS');
    }
    
    // Recommendations
    console.log('\n' + colors.bright + 'Next Steps:' + colors.reset);
    
    if (missingCount > 0) {
      log.info('1. Create qualification-specific database tables');
      log.info('2. Run migration script for qualification system');
    }
    
    if (!tableNames.includes('qual_units')) {
      log.info('3. Implement qualification unit management API');
      log.info('4. Create admin interface for qualification courses');
    }
    
    log.info('5. Implement student qualification course view');
    log.info('6. Create tutor grading interface');
    
    log.header();
    log.title('END OF ANALYSIS REPORT');
    log.header();
    
  } catch (error) {
    log.error(`Database analysis failed: ${error.message}`);
    console.error(error);
  } finally {
    if (connection) {
      await connection.end();
      log.info('Database connection closed');
    }
  }
}

// Run the analysis
analyzeDatabase().catch(console.error);

