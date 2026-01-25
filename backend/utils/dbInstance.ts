import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: "postgres",
      dialectOptions: process.env.NODE_ENV === 'production' ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } : {},
      logging: process.env.NODE_ENV === 'production' ? false : console.log
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.USER_NAME,
      process.env.PASSWORD,
      {
        host: process.env.HOST,
        port: Number(process.env.DB_PORT),
        dialect: "postgres",
        logging: false
      }
    );

export default sequelize;
