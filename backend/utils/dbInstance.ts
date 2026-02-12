import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

// Connection pool configuration — sized for a payment platform
const poolConfig = {
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),   // Max connections in pool
  min: parseInt(process.env.DB_POOL_MIN || '5', 10),     // Min connections in pool
  idle: parseInt(process.env.DB_POOL_IDLE || '10000', 10), // Max idle time (ms) before release
  acquire: 30000,  // Max time (ms) to acquire connection before error
  evict: 1000,     // Check for idle connections every 1s
};

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: "postgres",
      dialectOptions: process.env.NODE_ENV === 'production' ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } : {},
      logging: process.env.NODE_ENV === 'production' ? false : console.log,
      pool: poolConfig,
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.USER_NAME,
      process.env.PASSWORD,
      {
        host: process.env.HOST,
        port: Number(process.env.DB_PORT),
        dialect: "postgres",
        logging: false,
        pool: poolConfig,
      }
    );

export default sequelize;
