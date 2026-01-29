import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const companyModel = sequelize.define(
  "Company",
  {
    company_id: {
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
    company_name: {
      type: DataTypes.STRING,
    },
    email: {
      type: DataTypes.STRING,
      validate: {
        isEmail: true,
      },
    },
    mobile: {
      type: DataTypes.STRING,
    },
    photo: {
      type: DataTypes.TEXT,
    },
    website: {
      type: DataTypes.TEXT,
    },
    // Phase 1: Address fields
    address_line1: {
      type: DataTypes.STRING(255),
    },
    address_line2: {
      type: DataTypes.STRING(255),
    },
    city: {
      type: DataTypes.STRING(100),
    },
    state: {
      type: DataTypes.STRING(100),
    },
    country: {
      type: DataTypes.STRING(100),
    },
    zip_code: {
      type: DataTypes.STRING(20),
    },
    // Phase 1: VAT fields
    vat_number: {
      type: DataTypes.STRING(50),
    },
    vat_type: {
      type: DataTypes.STRING(10),
    },
    vat_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Webhook configuration
    webhook_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "URL to receive payment webhook notifications",
    },
    webhook_secret: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Secret key for webhook signature verification",
    },
  },
  {
    tableName: "tbl_company",
  }
);

// companyModel
//   .sync({ alter: false })
//   .then(() => console.log("tbl_company created"));

export default companyModel;
