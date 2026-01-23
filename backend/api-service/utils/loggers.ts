import winston from "winston";

const { combine, timestamp, json, prettyPrint, errors } = winston.format;

winston.loggers.add("customerLogger", {
  format: combine(errors({ stack: true }), timestamp(), json(), prettyPrint()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/userLogs.log" }),
  ],
  defaultMeta: { service: "customerLogger" },
});

const customerLogger = winston.loggers.get("customerLogger");
export { customerLogger };
