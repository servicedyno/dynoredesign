import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const userWalletModel = sequelize.define(
  "Wallet",
  {
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
    // NOTE: Commented out fields that don't exist in shared database
    // These may exist in DynoBackend repo but not in our shared DB
    // company_id: { ... },
    // wallet_name: { ... },
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
    timestamps: true,
    // IMPORTANT: Prevent Sequelize from trying to ALTER the table schema
    // This repo shares the database with DynoBackend which has different schema
    freezeTableName: true,
  }
);

// userWalletModel.sync({ alter: false }).then(() => console.log("tbl_user_wallet created"));

export default userWalletModel;
