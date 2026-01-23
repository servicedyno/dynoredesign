import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const customerTransactionModel = sequelize.define(
  "Customer_Transaction",
  {
    id: {
      type: DataTypes.STRING,
      unique: false,
    },
    transaction_id: {
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
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_customer",
        key: "customer_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    payment_mode: {
      type: DataTypes.STRING,
      defaultValue: "CARD",
    },
    base_amount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    base_currency: {
      type: DataTypes.STRING,
      defaultValue: "USD",
    },
    paid_amount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    paid_currency: {
      type: DataTypes.STRING,
      defaultValue: "USD",
    },
    transaction_reference: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    transaction_details: {
      type: DataTypes.TEXT,
      defaultValue: "Credited funds into wallet",
    },
    transaction_type: {
      type: DataTypes.STRING,
      defaultValue: "CREDIT",
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "failed",
    },
  },
  {
    tableName: "tbl_customer_transaction",
  }
);

// customerTransactionModel
//   .sync({ alter: false })
//   .then(() => console.log("tbl_customer_transaction created"));

export default customerTransactionModel;
