import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const userTransactionModel = sequelize.define(
  "User_Transaction",
  {
    transaction_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    id: {
      type: DataTypes.STRING,
    },
    wallet_id: {
      type: DataTypes.INTEGER,
      references: {
        model: "tbl_user_wallet",
        key: "wallet_id",
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
    transaction_reference: {
      type: DataTypes.STRING,
    },
    transaction_details: {
      type: DataTypes.TEXT,
      defaultValue: "Credited funds into wallet",
    },
    transaction_type: {
      type: DataTypes.ENUM("CREDIT", "DEBIT"),
      defaultValue: "CREDIT",
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "failed",
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "tbl_customer",
        key: "customer_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
  },
  {
    tableName: "tbl_user_transaction",
  }
);

// userTransactionModel.sync({ alter: false }).then(() => console.log("tbl_user_transaction created"));

export default userTransactionModel;
