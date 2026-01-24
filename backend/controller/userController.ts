import express from "express";
import {
  downloadUserImage,
  encrypt,
  errorResponseHelper,
  getErrorMessage,
  getMinutesBetweenDates,
  sendEmail,
  successResponseHelper,
} from "../helper/index";
import { adminWalletModel, userModel, userWalletModel, companyModel, apiModel } from "../models";
import { userWalletAddressModel } from "../models/userModels";
import notificationModel from "../models/notificationModel";
import notificationPreferencesModel from "../models/notificationPreferencesModel";
import kycModel from "../models/kycModel";
import invoiceModel from "../models/invoiceModel";
import sha256 from "crypto-js/sha256";
import crypto from "crypto";
import sequelize from "../utils/dbInstance";
import { QueryTypes, Op } from "sequelize";
import jwt from "jsonwebtoken";
import { IUserType } from "../utils/types";
import localStorage from "../utils/localStorage";
import axios from "axios";
import tatumApi from "../apis/tatumApi";
import { userLogger } from "../utils/loggers";

const registerUser = async (req: express.Request, res: express.Response) => {
  try {
    const { name, email, password } = req.body;
    const newPassword = sha256(password).toString();
    const isExists = await userModel
      .findOne({
        where: {
          email: email.toLowerCase(),
        },
      })
      .then((token) => token !== null)
      .then((isExists) => isExists);

    console.log("isExists====>", isExists);
    if (isExists) {
      errorResponseHelper(res, 503, "Account Already Exists!!!");
    } else {
      const photoLocation = await downloadUserImage();
      const photo = process.env.SERVER_URL + photoLocation;

      const createdUser = await userModel.create({
        name,
        email: email.toLowerCase(),
        photo,
        password: newPassword,
      });

      const walletData = await adminWalletModel.findAll();
      const fiatData = walletData.filter(
        (x) => x.dataValues.currency_type === "FIAT"
      );
      const cryptoData = walletData.filter(
        (x) => x.dataValues.currency_type === "CRYPTO"
      );

      for (let i = 0; i < fiatData.length; i++) {
        await userWalletModel.create({
          id: crypto.randomUUID(),
          user_id: createdUser.dataValues.user_id,
          wallet_type: fiatData[i].dataValues.wallet_type,
          currency_type: "FIAT",
        });
      }

      for (let i = 0; i < cryptoData.length; i++) {
        await userWalletModel.create({
          id: crypto.randomUUID(),
          user_id: createdUser.dataValues.user_id,
          wallet_type: cryptoData[i].dataValues.wallet_type,
          currency_type: "CRYPTO",
        });
      }

      const resData = await getAccessToken(createdUser.dataValues.user_id);

      successResponseHelper(res, 200, "Registered Successful!", resData);
    }
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    userLogger.error(errorMessage, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Register User with Phone Number (Step 1: Send OTP)
 * POST /api/user/registerPhone
 * Sends OTP to phone for verification
 */
const registerPhoneStep1 = async (req: express.Request, res: express.Response) => {
  try {
    const { name, mobile, password } = req.body;
    
    if (!name || !mobile || !password) {
      return errorResponseHelper(res, 400, "Name, mobile, and password are required");
    }
    
    // Validate phone format
    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(mobile)) {
      return errorResponseHelper(res, 400, "Invalid phone number format. Use 10-15 digits only");
    }
    
    // Check if mobile already registered
    const mobileExists = await userModel.findOne({
      where: { mobile }
    });
    
    if (mobileExists) {
      return errorResponseHelper(res, 400, "Phone number already registered");
    }
    
    // Send OTP via Telnyx
    try {
      await axios.post(
        "https://api.telnyx.com/v2/verifications/sms",
        {
          phone_number: "+" + mobile,
          verify_profile_id: process.env.TELNYX_VERIFY_PROFILE_ID || process.env.PROFILE_ID,
          timeout_secs: 600,
        },
        {
          headers: {
            Authorization: "Bearer " + (process.env.TELNYX_API_KEY || process.env.ACCESS_TOKEN),
          },
        }
      );
      
      // Store registration data temporarily (will be completed on OTP verification)
      // In production, you might want to use Redis for this
      successResponseHelper(res, 200, "OTP sent to your phone. Please verify to complete registration.");
      
    } catch (telnyxError) {
      userLogger.error("Telnyx OTP send failed", telnyxError);
      errorResponseHelper(res, 500, "Failed to send OTP. Please try again.");
    }
    
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    userLogger.error(`Phone registration step 1 error: ${errorMessage}`, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Register User with Phone Number (Step 2: Verify OTP & Create Account)
 * POST /api/user/registerPhone/verify
 * Verifies OTP and creates user account
 */
const registerPhoneStep2 = async (req: express.Request, res: express.Response) => {
  try {
    const { name, mobile, password, otp } = req.body;
    
    if (!name || !mobile || !password || !otp) {
      return errorResponseHelper(res, 400, "All fields are required: name, mobile, password, otp");
    }
    
    // Verify OTP with Telnyx
    try {
      const verifyResponse = await axios.post(
        `https://api.telnyx.com/v2/verifications/by_phone_number/+${mobile}/actions/verify`,
        {
          code: otp,
          verify_profile_id: process.env.TELNYX_VERIFY_PROFILE_ID || process.env.PROFILE_ID,
        },
        {
          headers: {
            Authorization: "Bearer " + (process.env.TELNYX_API_KEY || process.env.ACCESS_TOKEN),
          },
        }
      );
      
      // Check if verification was successful
      if (verifyResponse.data?.data?.response_code !== "accepted") {
        return errorResponseHelper(res, 400, "Invalid or expired OTP");
      }
      
    } catch (otpError) {
      userLogger.error("OTP verification failed", otpError);
      return errorResponseHelper(res, 400, "Invalid or expired OTP");
    }
    
    // OTP verified, now create user account
    const newPassword = sha256(password).toString();
    
    // Double-check mobile doesn't exist
    const mobileExists = await userModel.findOne({
      where: { mobile }
    });
    
    if (mobileExists) {
      return errorResponseHelper(res, 400, "Phone number already registered");
    }
    
    // Download default user image
    const photoLocation = await downloadUserImage();
    const photo = process.env.SERVER_URL + photoLocation;
    
    // Create user with mobile as primary identifier
    const createdUser = await userModel.create({
      name,
      mobile,
      email: null, // Email is optional for phone registration
      photo,
      password: newPassword,
      login_type: "SMS", // Mark as SMS-based login
    });
    
    // Create wallets for the new user
    const walletData = await adminWalletModel.findAll();
    const fiatData = walletData.filter(
      (x) => x.dataValues.currency_type === "FIAT"
    );
    const cryptoData = walletData.filter(
      (x) => x.dataValues.currency_type === "CRYPTO"
    );
    
    for (let i = 0; i < fiatData.length; i++) {
      await userWalletModel.create({
        id: crypto.randomUUID(),
        user_id: createdUser.dataValues.user_id,
        wallet_type: fiatData[i].dataValues.wallet_type,
        currency_type: "FIAT",
      });
    }
    
    for (let i = 0; i < cryptoData.length; i++) {
      await userWalletModel.create({
        id: crypto.randomUUID(),
        user_id: createdUser.dataValues.user_id,
        wallet_type: cryptoData[i].dataValues.wallet_type,
        currency_type: "CRYPTO",
      });
    }
    
    // Generate access token
    const resData = await getAccessToken(createdUser.dataValues.user_id);
    
    userLogger.info(`New user registered via phone: ${mobile}`);
    
    successResponseHelper(res, 200, "Registration successful!", resData);
    
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    userLogger.error(`Phone registration step 2 error: ${errorMessage}`, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

const login = async (req: express.Request, res: express.Response) => {
  try {
    const { email, password } = req.body;
    const newPassword = sha256(password).toString();
    const userData = await userModel.findOne({
      where: {
        email: email.toLowerCase(),
        password: newPassword,
      },
    });
    if (!userData) {
      errorResponseHelper(res, 500, "Please enter a valid password!");
    } else {
      const resData = await getAccessToken(userData.dataValues.user_id);
      successResponseHelper(res, 200, "Login Successful!", resData);
    }
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    userLogger.error(errorMessage, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

const checkEmail = async (req: express.Request, res: express.Response) => {
  try {
    const { email }: any = req.query;
    const userData = await userModel.findOne({
      where: {
        email: email.toLowerCase(),
      },
    });

    let resData: any = { validEmail: false };
    if (userData) {
      resData = {
        validEmail: true,
        email: userData.dataValues.email,
        mobile: userData.dataValues.mobile ? userData.dataValues.mobile : null,
      };
    }
    successResponseHelper(res, 200, "", resData);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    userLogger.error(errorMessage, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

const getAccessToken = async (id) => {
  const users: IUserType[] = await sequelize.query(
    "select * from tbl_user where user_id=" + id,
    {
      type: QueryTypes.SELECT,
    }
  );

  const tokenSecret = process.env.ACCESS_TOKEN_SECRET;

  const { password, telegram_id, ...userData } = users[0];

  if (tokenSecret) {
    const accessToken = jwt.sign(userData, tokenSecret, {
      expiresIn: "7d",
    });
    const resData = { userData, accessToken };
    return resData;
  }
};

const generateOTP = async (req: express.Request, res: express.Response) => {
  try {
    const { email, mobile } = req.body;
    if (mobile) {
      const isExists = await userModel
        .findOne({
          where: {
            mobile,
          },
        })
        .then((token) => token !== null)
        .then((isExists) => isExists);
      if (isExists) {
        const resData = await axios.post(
          "https://api.telnyx.com/v2/verifications/sms",
          {
            phone_number: "+" + mobile,
            verify_profile_id: process.env.TELNYX_VERIFY_PROFILE_ID || process.env.PROFILE_ID,
            timeout_secs: 600,
          },
          {
            headers: {
              Authorization: "Bearer " + (process.env.TELNYX_API_KEY || process.env.ACCESS_TOKEN),
            },
          }
        );
        successResponseHelper(res, 200, "OTP sent successfully!");
      } else {
        errorResponseHelper(
          res,
          500,
          "Please enter a registered mobile number!"
        );
      }
    } else {
      if (email) {
        const userData = await userModel.findOne({
          where: {
            email,
          },
        });
        if (userData?.dataValues) {
          const randomNumberOTP = Math.floor(100000 + Math.random() * 900000);
          await sendEmail(
            email,
            userData?.dataValues?.name,
            "OTP for login",
            "Here is your login code: " + randomNumberOTP
          );
          await localStorage.push("/" + email, {
            otp: randomNumberOTP.toString(),
            createdAt: new Date().toISOString(),
          });
          successResponseHelper(res, 200, "OTP sent successfully!");
        } else {
          errorResponseHelper(res, 500, "Please enter a registered email!");
        }
      } else {
        errorResponseHelper(res, 500, "Please add any number or email!");
      }
    }
  } catch (e) {
    const message = getErrorMessage(e);
    userLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const confirmOTP = async (req: express.Request, res: express.Response) => {
  try {
    const { email, otp, mobile } = req.body;
    if (otp) {
      if (mobile) {
        const {
          data: { data },
        } = await axios.post(
          `https://api.telnyx.com/v2/verifications/by_phone_number/+${mobile}/actions/verify`,
          {
            code: otp,
            verify_profile_id: process.env.TELNYX_VERIFY_PROFILE_ID || process.env.PROFILE_ID,
          },
          {
            headers: {
              Authorization: "Bearer " + (process.env.TELNYX_API_KEY || process.env.ACCESS_TOKEN),
            },
          }
        );
        if (data.response_code === "accepted") {
          const userData = await userModel.findOne({
            where: {
              email,
            },
          });
          const resData = await getAccessToken(userData.dataValues.user_id);
          successResponseHelper(res, 200, "Login Successful!", resData);
        } else {
          errorResponseHelper(res, 500, "OTP did not match!");
        }
      } else {
        const item = await localStorage.getData("/" + email);
        const createdTime = new Date(item.createdAt);
        const currentTime = new Date();
        const diff = getMinutesBetweenDates(currentTime, createdTime);
        if (diff < 10) {
          if (otp === item.otp) {
            const userData = await userModel.findOne({
              where: {
                email,
              },
            });
            const resData = await getAccessToken(userData.dataValues.user_id);
            successResponseHelper(res, 200, "Login Successful!", resData);
          } else {
            errorResponseHelper(res, 500, "OTP did not match!");
          }
        } else {
          errorResponseHelper(res, 500, "OTP expired!");
        }
      }
    } else {
      errorResponseHelper(res, 500, "Please add OTP!");
    }
  } catch (e) {
    const message = getErrorMessage(e);
    userLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message ?? "Please request for a new code!");
  }
};

const updateUser = async (req: express.Request, res: express.Response) => {
  try {
    const file = req.file as Express.Multer.File;
    const data = JSON.parse(req.body.data);
    const userData = jwt.decode(res.locals.token) as IUserType;
    let photo;
    if (file) {
      photo = process.env.SERVER_URL + "images/" + file.filename;
    }
    await userModel.update(
      {
        ...data,
        photo,
      },
      { where: { user_id: userData.user_id } }
    );
    const token = await getAccessToken(userData.user_id);
    successResponseHelper(res, 200, "User updated successfully!", token);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    userLogger.error(errorMessage, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

const changePassword = async (req: express.Request, res: express.Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userData = jwt.decode(res.locals.token) as IUserType;
    const password = oldPassword ? sha256(oldPassword).toString() : null;

    const isExists = await userModel
      .findOne({
        where: {
          password: password,
          user_id: userData.user_id,
        },
      })
      .then((token) => token !== null)
      .then((isExists) => isExists);
    if (isExists) {
      const newPass = sha256(newPassword).toString();
      await userModel.update(
        { password: newPass },
        {
          where: {
            user_id: userData.user_id,
          },
        }
      );
      successResponseHelper(res, 200, "Password updated successfully!", null);
    } else {
      errorResponseHelper(res, 500, "Old password not recognized!");
    }
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    userLogger.error(errorMessage, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

const connectSocial = async (req: express.Request, res: express.Response) => {
  try {
    const { name, email, photo, provider, id = "0" } = req.body;

    const isExists = await userModel
      .findOne({
        where: {
          [Op.or]: [
            {
              email: email,
            },
            { telegram_id: id },
          ],
        },
      })
      .then((token) => token !== null)
      .then((isExists) => isExists);

    console.log("isExists====>", isExists);
    if (isExists) {
      const userData = await userModel.findOne({
        where: {
          [Op.or]: [
            {
              email,
            },
            { telegram_id: id },
          ],
        },
      });
      if (!userData) {
        errorResponseHelper(res, 500, "Please enter a valid password!");
      } else {
        const resData = await getAccessToken(userData.dataValues.user_id);
        successResponseHelper(res, 200, "Login Successful!", resData);
      }
    } else {
      const image =
        photo ?? process.env.SERVER_URL + (await downloadUserImage());
      const createdUser = await userModel.create({
        name,
        email,
        photo: image,
        login_type: provider.toUpperCase(),
        telegram_id: id,
      });

      if (provider === "telegram") {
        const data = await axios.post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            chat_id: id,
            text: "Please provide an email or mobile number to have more control over your account.",
          }
        );
      }
      const resData = await getAccessToken(createdUser.dataValues.user_id);

      successResponseHelper(res, 200, "Registered Successful!", resData);
    }
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    userLogger.error(errorMessage, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Forgot Password - Send reset email with token
 * POST /api/user/forgot-password
 */
const forgotPassword = async (req: express.Request, res: express.Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return errorResponseHelper(res, 400, "Email is required");
    }

    // Find user by email
    const user = await userModel.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if email exists or not for security
      return successResponseHelper(res, 200, "If the email exists, a reset link has been sent", {});
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = sha256(resetToken).toString();
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Save token to database
    await userModel.update(
      {
        reset_token: resetTokenHash,
        reset_token_expiry: resetTokenExpiry,
      },
      {
        where: { user_id: user.dataValues.user_id },
      }
    );

    // Build reset URL
    const checkoutUrl = process.env.CHECKOUT_URL || "https://checkout.dynopay.com";
    const resetUrl = `${checkoutUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email.toLowerCase())}`;

    // Send reset email
    const emailMessage = `You requested a password reset for your Dynocash account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request this, please ignore this email. Your password will remain unchanged.`;

    await sendEmail(
      email.toLowerCase(),
      user.dataValues.name || "User",
      "Password Reset Request - Dynocash",
      emailMessage
    );

    userLogger.info(`Password reset requested for email: ${email}`);
    
    return successResponseHelper(res, 200, "If the email exists, a reset link has been sent", {});

  } catch (e) {
    const errorMessage = getErrorMessage(e);
    userLogger.error(`Forgot password error: ${errorMessage}`, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Reset Password - Reset password with token
 * POST /api/user/reset-password
 */
const resetPassword = async (req: express.Request, res: express.Response) => {
  try {
    const { token, email, newPassword } = req.body;

    if (!token || !email || !newPassword) {
      return errorResponseHelper(res, 400, "Token, email, and new password are required");
    }

    if (newPassword.length < 6) {
      return errorResponseHelper(res, 400, "Password must be at least 6 characters");
    }

    // Hash the provided token to compare with stored hash
    const tokenHash = sha256(token).toString();

    // Find user with valid token
    const user = await userModel.findOne({
      where: {
        email: email.toLowerCase(),
        reset_token: tokenHash,
        reset_token_expiry: {
          [Op.gt]: new Date(), // Token not expired
        },
      },
    });

    if (!user) {
      return errorResponseHelper(res, 400, "Invalid or expired reset token");
    }

    // Hash new password and update
    const hashedPassword = sha256(newPassword).toString();

    await userModel.update(
      {
        password: hashedPassword,
        reset_token: null,
        reset_token_expiry: null,
      },
      {
        where: { user_id: user.dataValues.user_id },
      }
    );

    // Send confirmation email
    await sendEmail(
      email.toLowerCase(),
      user.dataValues.name || "User",
      "Password Changed Successfully - Dynocash",
      "Your password has been successfully changed. If you didn't make this change, please contact support immediately."
    );

    userLogger.info(`Password reset successful for email: ${email}`);

    return successResponseHelper(res, 200, "Password has been reset successfully", {});

  } catch (e) {
    const errorMessage = getErrorMessage(e);
    userLogger.error(`Reset password error: ${errorMessage}`, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Google Sign-In - Authenticate with Google ID token
 * POST /api/user/google-signin
 */
const googleSignIn = async (req: express.Request, res: express.Response) => {
  try {
    const { idToken, accessToken } = req.body;

    if (!idToken && !accessToken) {
      return errorResponseHelper(res, 400, "Google ID token or access token is required");
    }

    let googleUserInfo: any;

    if (idToken) {
      // Verify ID token with Google
      try {
        const response = await axios.get(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
        );
        googleUserInfo = response.data;
      } catch (tokenError) {
        return errorResponseHelper(res, 401, "Invalid Google ID token");
      }
    } else if (accessToken) {
      // Use access token to get user info
      try {
        const response = await axios.get(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        googleUserInfo = response.data;
      } catch (tokenError) {
        return errorResponseHelper(res, 401, "Invalid Google access token");
      }
    }

    if (!googleUserInfo || !googleUserInfo.email) {
      return errorResponseHelper(res, 400, "Could not retrieve user info from Google");
    }

    const { email, name, picture, sub: googleId } = googleUserInfo;

    // Check if user exists by email or google_id
    let user = await userModel.findOne({
      where: {
        [Op.or]: [
          { email: email.toLowerCase() },
          { google_id: googleId },
        ],
      },
    });

    if (user) {
      // Update google_id if not set
      if (!user.dataValues.google_id && googleId) {
        await userModel.update(
          { 
            google_id: googleId,
            login_type: "GOOGLE",
          },
          { where: { user_id: user.dataValues.user_id } }
        );
      }

      // Generate access token and return
      const resData = await getAccessToken(user.dataValues.user_id);
      return successResponseHelper(res, 200, "Login Successful!", resData);
    }

    // Create new user
    const photoUrl = picture || process.env.SERVER_URL + (await downloadUserImage());
    
    const createdUser = await userModel.create({
      name: name || email.split("@")[0],
      email: email.toLowerCase(),
      photo: photoUrl,
      login_type: "GOOGLE",
      google_id: googleId,
    });

    // Create default wallets for new user
    const walletData = await adminWalletModel.findAll();
    const fiatData = walletData.filter((x) => x.dataValues.currency_type === "FIAT");
    const cryptoData = walletData.filter((x) => x.dataValues.currency_type === "CRYPTO");

    for (let i = 0; i < fiatData.length; i++) {
      await userWalletModel.create({
        id: crypto.randomUUID(),
        user_id: createdUser.dataValues.user_id,
        wallet_type: fiatData[i].dataValues.wallet_type,
        currency_type: "FIAT",
      });
    }

    for (let i = 0; i < cryptoData.length; i++) {
      await userWalletModel.create({
        id: crypto.randomUUID(),
        user_id: createdUser.dataValues.user_id,
        wallet_type: cryptoData[i].dataValues.wallet_type,
        currency_type: "CRYPTO",
      });
    }

    const resData = await getAccessToken(createdUser.dataValues.user_id);

    userLogger.info(`New user registered via Google: ${email}`);

    return successResponseHelper(res, 200, "Registration Successful!", resData);

  } catch (e) {
    const errorMessage = getErrorMessage(e);
    userLogger.error(`Google sign-in error: ${errorMessage}`, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Get User Profile
 * GET /api/user/profile
 */
const getProfile = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const user = await userModel.findOne({
      where: { user_id: userData.user_id },
      attributes: { exclude: ['password', 'reset_token', 'reset_token_expiry', 'verified_otp', 'otp_expired'] }
    });

    if (!user) {
      return errorResponseHelper(res, 404, "User not found");
    }

    // Get additional stats
    const companiesCount = await companyModel.count({
      where: { user_id: userData.user_id }
    });

    const walletsCount = await userWalletAddressModel.count({
      where: { user_id: userData.user_id }
    });

    const apiKeysCount = await apiModel.count({
      where: { user_id: userData.user_id }
    });

    return successResponseHelper(res, 200, "Profile retrieved successfully", {
      ...user.dataValues,
      stats: {
        companies: companiesCount,
        wallets: walletsCount,
        api_keys: apiKeysCount,
      }
    });

  } catch (e) {
    const errorMessage = getErrorMessage(e);
    userLogger.error(`Get profile error: ${errorMessage}`, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Update Profile (name, mobile, username)
 * PUT /api/user/profile
 * Allows updating basic profile fields without image
 */
const updateProfile = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { name, mobile, username } = req.body;
    
    // Build update object with only provided fields
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (mobile !== undefined) updateData.mobile = mobile;
    if (username !== undefined) updateData.username = username;
    
    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return errorResponseHelper(res, 400, "No fields to update");
    }
    
    await userModel.update(updateData, {
      where: { user_id: userData.user_id }
    });
    
    // Get updated user data
    const updatedUser = await userModel.findOne({
      where: { user_id: userData.user_id },
      attributes: { exclude: ['password', 'reset_token', 'reset_token_expiry'] }
    });
    
    successResponseHelper(res, 200, "Profile updated successfully!", updatedUser);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    userLogger.error(`Update profile error: ${errorMessage}`, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Change Email Address
 * PUT /api/user/email
 * Requires password confirmation for security
 */
const changeEmail = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { newEmail, password } = req.body;
    
    if (!newEmail || !password) {
      return errorResponseHelper(res, 400, "Email and password are required");
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return errorResponseHelper(res, 400, "Invalid email format");
    }
    
    // Verify password
    const hashedPassword = sha256(password).toString();
    const user = await userModel.findOne({
      where: {
        user_id: userData.user_id,
        password: hashedPassword
      }
    });
    
    if (!user) {
      return errorResponseHelper(res, 401, "Invalid password");
    }
    
    // Check if new email is already in use
    const emailExists = await userModel.findOne({
      where: {
        email: newEmail.toLowerCase(),
        user_id: { [Op.ne]: userData.user_id }
      }
    });
    
    if (emailExists) {
      return errorResponseHelper(res, 400, "Email address already in use");
    }
    
    // Update email
    await userModel.update(
      { email: newEmail.toLowerCase() },
      { where: { user_id: userData.user_id } }
    );
    
    // Send confirmation email to new address
    try {
      await mailTransporter.sendMail({
        from: '"DynoPay" <no-reply@dynopay.com>',
        to: newEmail,
        subject: "Email Address Changed - DynoPay",
        html: `
          <h2>Email Address Updated</h2>
          <p>Your DynoPay account email has been successfully changed to this address.</p>
          <p>If you didn't make this change, please contact support immediately.</p>
          <br>
          <p>Best regards,<br>DynoPay Team</p>
        `
      });
    } catch (emailError) {
      userLogger.error("Failed to send email change confirmation", emailError);
    }
    
    // Generate new token with updated email
    const token = await getAccessToken(userData.user_id);
    
    successResponseHelper(res, 200, "Email updated successfully!", token);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    userLogger.error(`Change email error: ${errorMessage}`, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Change Phone Number
 * PUT /api/user/phone
 * Requires password confirmation for security (since phone is used for SMS auth)
 */
const changePhone = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { newPhone, password } = req.body;
    
    if (!newPhone || !password) {
      return errorResponseHelper(res, 400, "Phone number and password are required");
    }
    
    // Validate phone format (basic - digits only, 10-15 chars)
    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(newPhone)) {
      return errorResponseHelper(res, 400, "Invalid phone number format. Use digits only (10-15 digits)");
    }
    
    // Verify password
    const hashedPassword = sha256(password).toString();
    const user = await userModel.findOne({
      where: {
        user_id: userData.user_id,
        password: hashedPassword
      }
    });
    
    if (!user) {
      return errorResponseHelper(res, 401, "Invalid password");
    }
    
    // Check if new phone is already in use by another user
    const phoneExists = await userModel.findOne({
      where: {
        mobile: newPhone,
        user_id: { [Op.ne]: userData.user_id }
      }
    });
    
    if (phoneExists) {
      return errorResponseHelper(res, 400, "Phone number already in use by another account");
    }
    
    // Update phone number
    await userModel.update(
      { mobile: newPhone },
      { where: { user_id: userData.user_id } }
    );
    
    // Get updated user data
    const updatedUser = await userModel.findOne({
      where: { user_id: userData.user_id },
      attributes: { exclude: ['password', 'reset_token', 'reset_token_expiry'] }
    });
    
    // Optionally send SMS confirmation to new number
    try {
      await axios.post(
        "https://api.telnyx.com/v2/messages",
        {
          from: process.env.TELNYX_PHONE_NUMBER,
          to: "+" + newPhone,
          text: `Your DynoPay phone number has been successfully updated to this number. If you didn't make this change, please contact support immediately.`
        },
        {
          headers: {
            Authorization: "Bearer " + (process.env.TELNYX_API_KEY || process.env.ACCESS_TOKEN),
          },
        }
      );
    } catch (smsError) {
      // Log but don't fail the request if SMS fails
      userLogger.error("Failed to send phone change confirmation SMS", smsError);
    }
    
    userLogger.info(`Phone number updated for user ${userData.user_id}`);
    
    successResponseHelper(res, 200, "Phone number updated successfully!", updatedUser);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    userLogger.error(`Change phone error: ${errorMessage}`, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Delete User Account
 * DELETE /api/user/account
 * Requires password confirmation for security
 */
const deleteAccount = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { password, confirmation } = req.body;

    if (!password) {
      return errorResponseHelper(res, 400, "Password is required for account deletion");
    }

    if (confirmation !== "DELETE") {
      return errorResponseHelper(res, 400, "Please type 'DELETE' to confirm account deletion");
    }

    // Verify password
    const hashedPassword = sha256(password).toString();
    const user = await userModel.findOne({
      where: {
        user_id: userData.user_id,
        password: hashedPassword,
      }
    });

    if (!user) {
      return errorResponseHelper(res, 401, "Invalid password");
    }

    // Delete all related data (cascading should handle most, but let's be explicit)
    const userId = userData.user_id;

    // Delete notifications
    await notificationModel.destroy({ where: { user_id: userId } });
    
    // Delete notification preferences
    await notificationPreferencesModel.destroy({ where: { user_id: userId } });

    // Delete KYC records
    await kycModel.destroy({ where: { user_id: userId } });

    // Delete wallet addresses
    await userWalletAddressModel.destroy({ where: { user_id: userId } });

    // Delete wallets
    await userWalletModel.destroy({ where: { user_id: userId } });

    // Delete API keys (will cascade to plans and subscriptions)
    await apiModel.destroy({ where: { user_id: userId } });

    // Delete companies (will cascade to related data)
    await companyModel.destroy({ where: { user_id: userId } });

    // Finally, delete the user
    await userModel.destroy({ where: { user_id: userId } });

    userLogger.info(`User account deleted: ${userData.email}`);

    return successResponseHelper(res, 200, "Account deleted successfully", {
      message: "Your account and all associated data have been permanently deleted"
    });

  } catch (e) {
    const errorMessage = getErrorMessage(e);
    userLogger.error(`Delete account error: ${errorMessage}`, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

export default {
  registerUser,
  registerPhoneStep1,
  registerPhoneStep2,
  login,
  checkEmail,
  generateOTP,
  confirmOTP,
  connectSocial,
  updateUser,
  changePassword,
  forgotPassword,
  resetPassword,
  googleSignIn,
  getProfile,
  updateProfile,
  changeEmail,
  changePhone,
  deleteAccount,
};
