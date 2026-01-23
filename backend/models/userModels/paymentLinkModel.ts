import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const paymentLinkModel = sequelize.define(
  "Payment_Link",
  {
    link_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    transaction_id: {
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
    },
    transaction_reference: {
      type: DataTypes.STRING,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "pending",
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    payment_link: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    allowedModes: {
      type: DataTypes.TEXT,
    },
    payment_mode: {
      type: DataTypes.STRING,
    },
  },
  {
    tableName: "tbl_payment_link",
  }
);

// paymentLinkModel
//   .sync({ alter: false })
//   .then(() => console.log("tbl_payment_link created"));

export default paymentLinkModel;
