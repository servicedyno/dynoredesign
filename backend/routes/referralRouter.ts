import express from 'express';
import referralController from '../controller/referralController';
import { authMiddleware } from '../middleware';

const referralRouter = express.Router();

// Public routes - User Referral Code (Type 1)
referralRouter.post('/validate', referralController.validateReferralCode);
referralRouter.post('/apply', referralController.applyReferralCode);
referralRouter.get('/leaderboard', referralController.getReferralLeaderboard);

// Public routes - Referee Code (Type 2 - from payment link email)
referralRouter.post('/referee/validate', referralController.validateRefereeCode);
referralRouter.post('/referee/redeem', referralController.redeemRefereeCode);

// Protected routes (require authentication)
referralRouter.get('/my-code', authMiddleware, referralController.getMyReferralCode);
referralRouter.get('/list', authMiddleware, referralController.listMyReferrals);
referralRouter.get('/earnings', authMiddleware, referralController.getReferralEarnings);
referralRouter.get('/discount-status', authMiddleware, referralController.getDiscountStatus);

export default referralRouter;
