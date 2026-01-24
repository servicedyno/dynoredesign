import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const userModel = sequelize.define(
  "User",
  {
    user_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
    },
    email: {
      type: DataTypes.STRING,
      validate: {
        isEmail: true,
      },
    },
    username: {
      type: DataTypes.STRING,
    },
    password: {
      type: DataTypes.STRING,
    },
    mobile: {
      type: DataTypes.STRING,
    },
    photo: {
      type: DataTypes.TEXT,
      defaultValue: "images/user_image.png",
    },
    login_type: {
      type: DataTypes.ENUM("EMAIL", "GOOGLE", "TELEGRAM"),
      defaultValue: "EMAIL",
    },
    telegram_id: {
      type: DataTypes.STRING,
    },
    customer_id: {
      type: DataTypes.STRING,
    },
    external_id: {
      type: DataTypes.STRING,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "active",
    },
    verified_otp: {
      type: DataTypes.STRING,
    },
    otp_expired: {
      type: DataTypes.DATE,
    },
    // Password reset fields
    reset_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    reset_token_expiry: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Google Sign-In fields
    google_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Wallet reminder tracking
    wallet_reminder_sent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true,
    },
  },
  {
    tableName: "tbl_user",
  }
);

// userModel.sync({ alter: false }).then(() => console.log("tbl_user created"));

export default userModel;
