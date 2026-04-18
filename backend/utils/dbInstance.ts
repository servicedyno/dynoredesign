import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import { log } from "./loggers";

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
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  statement_timeout: 30000,
  idle_in_transaction_session_timeout: 30000,
  ...(useSSL ? {
    ssl: {
      require: true,
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    },
  } : {}),
};

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: "postgres",
      dialectOptions,
      logging: isProduction ? false : (msg: string) => log(`[Sequelize] ${msg}`, 'debug'),
      pool: poolConfig,
      retry: retryConfig,
      // Hooks to suppress "connection manager was closed" during shutdown
      hooks: {
        beforeQuery: () => {
          // Lazy import to avoid circular deps — server.ts exports isShuttingDown
          try {
            const { isShuttingDown } = require('../server');
            if (isShuttingDown) {
              throw new Error('[Sequelize] Query blocked: server is shutting down');
            }
          } catch (e) {
            // Module not loaded yet (startup) — allow query
            if (e.message?.includes('shutting down')) throw e;
          }
        },
      },
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
          // Enable SSL for remote hosts (DigitalOcean, Railway, etc.)
          // Skip SSL only for true localhost connections
          ...(
            (() => {
              const host = process.env.HOST || '';
              const isLocal = ['localhost', '127.0.0.1', '::1', ''].includes(host);
              return !isLocal ? {
                ssl: {
                  require: true,
                  rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
                },
              } : {};
            })()
          ),
        },
        logging: false,
        pool: poolConfig,
        retry: retryConfig,
      }
    );

export default sequelize;
