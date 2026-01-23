
const { Sequelize, QueryTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.USER_NAME,
  process.env.PASSWORD,
  {
    host: process.env.HOST,
    port: Number(process.env.DB_PORT),
    dialect: 'postgres',
    logging: false
  }
);

async function verify() {
  try {
    await sequelize.authenticate();
    
    const results = {
      new_tables: {},
      modified_tables: {}
    };
    
    // Check new tables
    const newTables = ['tbl_tax_rate', 'tbl_invoice', 'tbl_notification', 'tbl_notification_preferences', 'tbl_kyc'];
    
    for (const tableName of newTables) {
      const columns = await sequelize.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${tableName}' ORDER BY ordinal_position`,
        { type: QueryTypes.SELECT }
      );
      
      results.new_tables[tableName] = {
        exists: columns.length > 0,
        column_count: columns.length,
        columns: columns.map(col => `${col.column_name} (${col.data_type})`)
      };
    }
    
    // Check modified tables for new columns
    const modifiedTables = {
      'tbl_company': ['address_line1', 'address_line2', 'city', 'state', 'country', 'zip_code', 'vat_number', 'vat_type', 'vat_verified'],
      'tbl_api': ['api_name'],
      'tbl_user_wallet': ['company_id', 'wallet_name'],
      'tbl_user_addresses': ['company_id', 'wallet_name']
    };
    
    for (const [tableName, expectedColumns] of Object.entries(modifiedTables)) {
      const columns = await sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName}'`,
        { type: QueryTypes.SELECT }
      );
      
      const columnNames = columns.map(col => col.column_name);
      const missingColumns = expectedColumns.filter(col => !columnNames.includes(col));
      
      results.modified_tables[tableName] = {
        exists: columns.length > 0,
        expected_columns: expectedColumns,
        missing_columns: missingColumns,
        all_present: missingColumns.length === 0
      };
    }
    
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
    
  } catch (error) {
    console.error('Verification failed:', error.message);
    process.exit(1);
  }
}

verify();
