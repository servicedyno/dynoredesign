import express from 'express';
import referralController from '../controller/referralController';
import { authMiddleware } from '../middleware';

const referralRouter = express.Router();

// Public routes
referralRouter.post('/validate', referralController.validateReferralCode);
referralRouter.post('/apply', referralController.applyReferralCode);
referralRouter.get('/leaderboard', referralController.getReferralLeaderboard);

// Protected routes (require authentication)
referralRouter.get('/my-code', authMiddleware, referralController.getMyReferralCode);
referralRouter.get('/list', authMiddleware, referralController.listMyReferrals);
referralRouter.get('/earnings', authMiddleware, referralController.getReferralEarnings);

export default referralRouter;
