import { DataTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";

const subscriptionModel = sequelize.define(
  "Subscription",
  {
    subscription_id: {
      type: DataTypes.STRING,
    },
    flw_subscription_id: {
      type: DataTypes.STRING,
    },
    plan_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "tbl_plan",
        key: "plan_id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    status: {
      type: DataTypes.STRING,
    },
  },
  {
    tableName: "tbl_subscription",
  }
);

// subscriptionModel
//   .sync({ alter: false })
//   .then(() => console.log("tbl_subscription created"));

export default subscriptionModel;
