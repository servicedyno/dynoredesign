import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const userTempAddressModel = sequelize.define(
  "TEMP_ADDRESS",
  {
    temp_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
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
    wallet_type: {
      type: DataTypes.STRING,
    },
    wallet_address: {
      type: DataTypes.STRING,
    },
    wallet_account_id: {
      type: DataTypes.STRING,
    },
    subscription_id: {
      type: DataTypes.STRING,
    },
    index: {
      type: DataTypes.INTEGER,
    },
    privateKey: {
      type: DataTypes.TEXT,
    },
    txId: {
      type: DataTypes.TEXT,
    },
    adminTxId: {
      type: DataTypes.TEXT,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "pending",
    },
    admin_status: {
      type: DataTypes.STRING,
      defaultValue: "pending",
    },
    partial_payment_timestamp: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    blockchain_fee: {
      type: DataTypes.FLOAT,
    },
    check_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    amount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    }
  },
  {
    tableName: "tbl_user_temp_address",
  }
);

// userTempAddressModel.sync({ alter: false }).then(() => console.log("tbl_user_temp_address created"));

export default userTempAddressModel;
