import winston from "winston";

const { combine, timestamp, json, prettyPrint, errors } = winston.format;

winston.loggers.add("userLogger", {
  format: combine(errors({ stack: true }), timestamp(), json(), prettyPrint()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/userLogs.log" }),
  ],
  defaultMeta: { service: "userLogger" },
});

winston.loggers.add("walletLogger", {
  format: combine(errors({ stack: true }), timestamp(), json(), prettyPrint()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/walletLogs.log" }),
  ],
  defaultMeta: { service: "walletLogger" },
});

winston.loggers.add("companyLogger", {
  format: combine(errors({ stack: true }), timestamp(), json(), prettyPrint()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/companyLogs.log" }),
  ],
  defaultMeta: { service: "companyLogger" },
});

winston.loggers.add("apiLogger", {
  format: combine(errors({ stack: true }), timestamp(), json(), prettyPrint()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/apiLogs.log" }),
  ],
  defaultMeta: { service: "apiLogger" },
});

winston.loggers.add("adminLogger", {
  format: combine(errors({ stack: true }), timestamp(), json(), prettyPrint()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/adminLogger.log" }),
  ],
  defaultMeta: { service: "adminLogger" },
});

winston.loggers.add("webhookLogs", {
  format: combine(errors({ stack: true }), timestamp(), json(), prettyPrint()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/webhookLogs.log" }),
  ],
  defaultMeta: { service: "webhookLogs" },
});

winston.loggers.add("cronLogger", {
  format: combine(errors({ stack: true }), timestamp(), json(), prettyPrint()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/cronLogger.log" }),
  ],
  defaultMeta: { service: "cronLogger" },
});

const userLogger = winston.loggers.get("userLogger");
const walletLogger = winston.loggers.get("walletLogger");
const companyLogger = winston.loggers.get("companyLogger");
const apiLogger = winston.loggers.get("apiLogger");
const adminLogger = winston.loggers.get("adminLogger");
const webhookLogs = winston.loggers.get("webhookLogs");
const cronLogger = winston.loggers.get("cronLogger");

export {
  userLogger,
  walletLogger,
  companyLogger,
  apiLogger,
  adminLogger,
  webhookLogs,
  cronLogger,
};
