/**
 * Database Schema Reader
 * 
 * This script reads all database tables and their structures,
 * including columns, data types, constraints, indexes, and foreign keys.
 * 
 * Usage: node scripts/readDatabaseSchema.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_lms',
  port: process.env.DB_PORT || 3306
};

async function getTableList(connection) {
  const [tables] = await connection.execute(
    `SELECT TABLE_NAME 
     FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = ? 
     ORDER BY TABLE_NAME`,
    [dbConfig.database]
  );
  return tables.map(t => t.TABLE_NAME);
}

async function getTableColumns(connection, tableName) {
  const [columns] = await connection.execute(
    `SELECT 
       COLUMN_NAME,
       COLUMN_TYPE,
       IS_NULLABLE,
       COLUMN_DEFAULT,
       COLUMN_KEY,
       EXTRA,
       COLUMN_COMMENT
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [dbConfig.database, tableName]
  );
  return columns;
}

async function getTableIndexes(connection, tableName) {
  const [indexes] = await connection.execute(
    `SELECT 
       INDEX_NAME,
       COLUMN_NAME,
       NON_UNIQUE,
       SEQ_IN_INDEX,
       INDEX_TYPE
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
    [dbConfig.database, tableName]
  );
  return indexes;
}

async function getTableForeignKeys(connection, tableName) {
  // Get foreign key constraints from REFERENTIAL_CONSTRAINTS
  const [foreignKeys] = await connection.execute(
    `SELECT 
       kcu.CONSTRAINT_NAME,
       kcu.COLUMN_NAME,
       kcu.REFERENCED_TABLE_NAME,
       kcu.REFERENCED_COLUMN_NAME,
       rc.UPDATE_RULE,
       rc.DELETE_RULE
     FROM information_schema.KEY_COLUMN_USAGE kcu
     JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
       ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
       AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
     WHERE kcu.TABLE_SCHEMA = ? 
       AND kcu.TABLE_NAME = ?
       AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
     ORDER BY kcu.CONSTRAINT_NAME`,
    [dbConfig.database, tableName]
  );
  return foreignKeys;
}

async function getTableConstraints(connection, tableName) {
  const [constraints] = await connection.execute(
    `SELECT 
       CONSTRAINT_NAME,
       CONSTRAINT_TYPE
     FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY CONSTRAINT_TYPE, CONSTRAINT_NAME`,
    [dbConfig.database, tableName]
  );
  return constraints;
}

function formatColumnType(column) {
  let type = column.COLUMN_TYPE;
  if (column.IS_NULLABLE === 'YES') {
    type += ' NULL';
  } else {
    type += ' NOT NULL';
  }
  if (column.COLUMN_DEFAULT !== null) {
    type += ` DEFAULT ${column.COLUMN_DEFAULT}`;
  }
  if (column.EXTRA) {
    type += ` ${column.EXTRA}`;
  }
  if (column.COLUMN_COMMENT) {
    type += ` COMMENT '${column.COLUMN_COMMENT}'`;
  }
  return type;
}

function formatTableSchema(tableName, columns, indexes, foreignKeys, constraints) {
  let output = `\n${'='.repeat(80)}\n`;
  output += `TABLE: ${tableName}\n`;
  output += `${'='.repeat(80)}\n\n`;

  // Columns
  output += 'COLUMNS:\n';
  output += `${'-'.repeat(80)}\n`;
  columns.forEach(col => {
    const key = col.COLUMN_KEY ? ` [${col.COLUMN_KEY}]` : '';
    output += `  ${col.COLUMN_NAME.padEnd(30)} ${formatColumnType(col)}${key}\n`;
  });
  output += '\n';

  // Primary Key
  const primaryKey = columns.filter(c => c.COLUMN_KEY === 'PRI');
  if (primaryKey.length > 0) {
    output += 'PRIMARY KEY:\n';
    output += `${'-'.repeat(80)}\n`;
    output += `  ${primaryKey.map(c => c.COLUMN_NAME).join(', ')}\n\n`;
  }

  // Foreign Keys
  if (foreignKeys.length > 0) {
    output += 'FOREIGN KEYS:\n';
    output += `${'-'.repeat(80)}\n`;
    foreignKeys.forEach(fk => {
      output += `  ${fk.CONSTRAINT_NAME}:\n`;
      output += `    Column: ${fk.COLUMN_NAME}\n`;
      output += `    References: ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}\n`;
      output += `    On Update: ${fk.UPDATE_RULE}\n`;
      output += `    On Delete: ${fk.DELETE_RULE}\n\n`;
    });
  }

  // Indexes (excluding primary and foreign keys)
  const uniqueIndexes = {};
  indexes.forEach(idx => {
    if (idx.INDEX_NAME !== 'PRIMARY' && !foreignKeys.some(fk => fk.CONSTRAINT_NAME === idx.INDEX_NAME)) {
      if (!uniqueIndexes[idx.INDEX_NAME]) {
        uniqueIndexes[idx.INDEX_NAME] = {
          name: idx.INDEX_NAME,
          unique: idx.NON_UNIQUE === 0,
          columns: []
        };
      }
      uniqueIndexes[idx.INDEX_NAME].columns.push({
        name: idx.COLUMN_NAME,
        seq: idx.SEQ_IN_INDEX
      });
    }
  });

  if (Object.keys(uniqueIndexes).length > 0) {
    output += 'INDEXES:\n';
    output += `${'-'.repeat(80)}\n`;
    Object.values(uniqueIndexes).forEach(idx => {
      const type = idx.unique ? 'UNIQUE' : 'INDEX';
      const cols = idx.columns.sort((a, b) => a.seq - b.seq).map(c => c.name).join(', ');
      output += `  ${type} ${idx.name}: (${cols})\n`;
    });
    output += '\n';
  }

  // Constraints
  const otherConstraints = constraints.filter(c => 
    c.CONSTRAINT_TYPE !== 'PRIMARY KEY' && 
    c.CONSTRAINT_TYPE !== 'FOREIGN KEY'
  );
  if (otherConstraints.length > 0) {
    output += 'OTHER CONSTRAINTS:\n';
    output += `${'-'.repeat(80)}\n`;
    otherConstraints.forEach(con => {
      output += `  ${con.CONSTRAINT_TYPE}: ${con.CONSTRAINT_NAME}\n`;
    });
    output += '\n';
  }

  return output;
}

async function generateCreateTableSQL(connection, tableName) {
  const [createTable] = await connection.execute(
    `SHOW CREATE TABLE ${tableName}`
  );
  return createTable[0]['Create Table'];
}

async function main() {
  let connection;
  try {
    console.log('🔌 Connecting to database...');
    console.log(`   Database: ${dbConfig.database}`);
    console.log(`   Host: ${dbConfig.host}`);
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully!\n');

    // Get all tables
    console.log('📋 Reading table list...');
    const tables = await getTableList(connection);
    console.log(`   Found ${tables.length} tables\n`);

    let fullOutput = '';
    let sqlOutput = '-- ================================================\n';
    sqlOutput += '-- DATABASE SCHEMA EXPORT\n';
    sqlOutput += `-- Generated: ${new Date().toISOString()}\n`;
    sqlOutput += `-- Database: ${dbConfig.database}\n`;
    sqlOutput += `-- Total Tables: ${tables.length}\n`;
    sqlOutput += '-- ================================================\n\n';

    // Process each table
    for (const tableName of tables) {
      console.log(`📊 Processing table: ${tableName}...`);
      
      const [columns, indexes, foreignKeys, constraints] = await Promise.all([
        getTableColumns(connection, tableName),
        getTableIndexes(connection, tableName),
        getTableForeignKeys(connection, tableName),
        getTableConstraints(connection, tableName)
      ]);

      // Format table schema
      const tableSchema = formatTableSchema(tableName, columns, indexes, foreignKeys, constraints);
      fullOutput += tableSchema;

      // Get CREATE TABLE SQL
      const createSQL = await generateCreateTableSQL(connection, tableName);
      sqlOutput += `-- Table: ${tableName}\n`;
      sqlOutput += `${createSQL};\n\n`;
    }

    // Display summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 DATABASE SCHEMA SUMMARY');
    console.log('='.repeat(80));
    console.log(fullOutput);

    // Save to files
    const outputDir = path.join(__dirname, '../database_schema');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const schemaFile = path.join(outputDir, `schema_${timestamp}.txt`);
    const sqlFile = path.join(outputDir, `schema_${timestamp}.sql`);

    fs.writeFileSync(schemaFile, fullOutput, 'utf8');
    fs.writeFileSync(sqlFile, sqlOutput, 'utf8');

    console.log('\n✅ Schema exported successfully!');
    console.log(`   Human-readable: ${schemaFile}`);
    console.log(`   SQL format: ${sqlFile}\n`);

    // Show key tables for reference
    const keyTables = ['users', 'courses', 'cpd_topics', 'units', 'course_assignments'];
    console.log('🔍 Key Tables for Reference:');
    console.log('='.repeat(80));
    keyTables.forEach(tableName => {
      if (tables.includes(tableName)) {
        console.log(`   ✅ ${tableName} - exists`);
      } else {
        console.log(`   ❌ ${tableName} - NOT FOUND`);
      }
    });
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed.');
    }
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };

