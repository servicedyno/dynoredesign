import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import path from "path";

// Load .env from parent directory
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.USER_NAME,
  process.env.PASSWORD,
  {
    host: process.env.HOST,
    port: Number(process.env.DB_PORT),
    dialect: "postgres",
  }
);

export default sequelize;
