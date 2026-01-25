import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../utils/dbInstance';

interface ReferralAttributes {
  referral_id: number;
  referrer_user_id: number;
  referred_user_id: number;
  referral_code: string;
  status: 'pending' | 'active' | 'rewarded' | 'expired';
  activation_requirement: string;
  bonus_amount: number;
  bonus_currency: string;
  referee_discount_percent: number;
  referee_discount_duration_days: number;
  referred_at: Date;
  activated_at?: Date;
  rewarded_at?: Date;
  expires_at?: Date;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ReferralCreationAttributes extends Optional<ReferralAttributes, 'referral_id' | 'status' | 'activation_requirement' | 'bonus_amount' | 'bonus_currency' | 'referee_discount_percent' | 'referee_discount_duration_days' | 'referred_at' | 'createdAt' | 'updatedAt'> {}

class Referral extends Model<ReferralAttributes, ReferralCreationAttributes> implements ReferralAttributes {
  public referral_id!: number;
  public referrer_user_id!: number;
  public referred_user_id!: number;
  public referral_code!: string;
  public status!: 'pending' | 'active' | 'rewarded' | 'expired';
  public activation_requirement!: string;
  public bonus_amount!: number;
  public bonus_currency!: string;
  public referee_discount_percent!: number;
  public referee_discount_duration_days!: number;
  public referred_at!: Date;
  public activated_at?: Date;
  public rewarded_at?: Date;
  public expires_at?: Date;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Referral.init(
  {
    referral_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    referrer_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'tbl_user',
        key: 'user_id',
      },
    },
    referred_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'tbl_user',
        key: 'user_id',
      },
    },
    referral_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'pending',
    },
    activation_requirement: {
      type: DataTypes.STRING(100),
      defaultValue: 'first_transaction_100',
    },
    bonus_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 10.00,
    },
    bonus_currency: {
      type: DataTypes.STRING(10),
      defaultValue: 'USD',
    },
    referee_discount_percent: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 50.00,
    },
    referee_discount_duration_days: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
    },
    referred_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    activated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rewarded_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'tbl_referral',
    timestamps: true,
  }
);

export default Referral;
