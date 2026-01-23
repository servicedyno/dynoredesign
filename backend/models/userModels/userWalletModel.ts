import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const userWalletModel = sequelize.define(
  "Wallet",
  {
    id: {
      type: DataTypes.STRING,
      unique: true,
    },
    wallet_id: {
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
    amount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    wallet_type: {
      type: DataTypes.STRING,
      defaultValue: "USD",
    },
    wallet_address: {
      type: DataTypes.STRING,
    },
    currency_type: {
      type: DataTypes.ENUM("FIAT", "CRYPTO"),
      defaultValue: "FIAT",
    },
  },
  {
    tableName: "tbl_user_wallet",
  }
);

// userWalletModel.sync({ alter: false }).then(() => console.log("tbl_user_wallet created"));

export default userWalletModel;
