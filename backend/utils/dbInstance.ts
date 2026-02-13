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

// Retry configuration for transient connection errors (e.g., Railway PG proxy drops)
const retryConfig = {
  max: 3,           // Retry up to 3 times on transient errors
};

// SSL + keepAlive for remote PostgreSQL connections (Railway, Heroku, etc.)
const isRemoteDB = !!(process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway'));
const isProduction = process.env.NODE_ENV === 'production';
const useSSL = isProduction || isRemoteDB;

const dialectOptions: Record<string, unknown> = {
  // TCP keep-alive prevents stale connections from being silently terminated
  // by network intermediaries (Railway proxy, NAT, load balancers).
  // Without this, idle connections die and the next query gets "Connection terminated unexpectedly".
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000, // Start keepAlive probes after 10s idle
  // Statement timeout: 30s to prevent long-running queries from holding connections
  statement_timeout: 30000,
  idle_in_transaction_session_timeout: 30000,
  ...(useSSL ? {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  } : {}),
};

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: "postgres",
      dialectOptions,
      logging: isProduction ? false : console.log,
      pool: poolConfig,
      retry: retryConfig,
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.USER_NAME,
      process.env.PASSWORD,
      {
        host: process.env.HOST,
        port: Number(process.env.DB_PORT),
        dialect: "postgres",
        dialectOptions: {
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000,
        },
        logging: false,
        pool: poolConfig,
        retry: retryConfig,
      }
    );

export default sequelize;
