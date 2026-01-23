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
  },
  {
    tableName: "tbl_company",
  }
);

// companyModel
//   .sync({ alter: false })
//   .then(() => console.log("tbl_company created"));

export default companyModel;
