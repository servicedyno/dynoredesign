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
import { adminWalletModel, userModel, userWalletModel } from "../models";
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
            verify_profile_id: process.env.PROFILE_ID,
            timeout_secs: 600,
          },
          {
            headers: {
              Authorization: "Bearer " + process.env.ACCESS_TOKEN,
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
            verify_profile_id: process.env.PROFILE_ID,
          },
          {
            headers: {
              Authorization: "Bearer " + process.env.ACCESS_TOKEN,
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

export default {
  registerUser,
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
};
