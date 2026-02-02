// Debug the Sequelize query to understand the issue
const { Sequelize, Op, DataTypes } = require('sequelize');

async function main() {
  const sequelize = new Sequelize('db_bozzwallet', 'postgres', 'JqdkVTjQujJaEOyUJJHmWMYEWgtAXTfO', {
    host: 'shortline.proxy.rlwy.net',
    port: 44579,
    dialect: 'postgres',
    logging: console.log  // Enable logging to see actual query
  });

  // Define the model exactly as in merchantPoolService
  const merchantTempAddressModel = sequelize.define(
    "Merchant_Temp_Address",
    {
      temp_address_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      owner_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      wallet_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      wallet_address: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: "AVAILABLE",
      },
      admin_fee_balance: {
        type: DataTypes.DECIMAL(20, 8),
        defaultValue: 0,
      },
      last_merchant_payout: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "tbl_merchant_temp_address",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  await sequelize.authenticate();
  console.log('Connected to PostgreSQL\n');

  // Run the exact query the service uses
  console.log('=== Running threshold sweep query ===');
  const addressesForThreshold = await merchantTempAddressModel.findAll({
    where: {
      status: "AVAILABLE",
      admin_fee_balance: { [Op.gt]: 0 },
    },
  });
  console.log('\nThreshold query results:', addressesForThreshold.length);

  // Run the time sweep query
  console.log('\n=== Running time sweep query ===');
  const addressesForTime = await merchantTempAddressModel.findAll({
    where: {
      status: "AVAILABLE",
      admin_fee_balance: { [Op.gt]: 0 },
      last_merchant_payout: { [Op.ne]: null },
    },
  });
  console.log('\nTime query results:', addressesForTime.length);

  // Direct SQL to compare
  console.log('\n=== Direct SQL query ===');
  const [results] = await sequelize.query(`
    SELECT temp_address_id, status, admin_fee_balance, last_merchant_payout 
    FROM tbl_merchant_temp_address 
    WHERE status = 'AVAILABLE' 
      AND admin_fee_balance > 0
      AND last_merchant_payout IS NOT NULL
  `);
  console.log('Direct SQL results:', results.length);
  console.log(JSON.stringify(results, null, 2));

  await sequelize.close();
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
