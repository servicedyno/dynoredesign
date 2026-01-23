import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const apiModel = sequelize.define(
  "API",
  {
    api_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_company",
        key: "company_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_user",
        key: "user_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    base_currency: {
      type: DataTypes.STRING,
      defaultValue: "USD",
    },
    apiKey: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    adminToken: {
      type: DataTypes.TEXT,
    },
    withdrawal_whitelist: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "tbl_api",
  }
);

// apiModel.sync({ alter: false }).then(() => console.log("tbl_api created"));

export default apiModel;
