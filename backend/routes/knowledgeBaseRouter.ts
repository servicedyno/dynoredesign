import express from 'express';
import knowledgeBaseController from '../controller/knowledgeBaseController';
import { authMiddleware } from '../middleware';

const kbRouter = express.Router();

// Public routes
kbRouter.get('/categories', knowledgeBaseController.getCategories);
kbRouter.get('/articles', knowledgeBaseController.getArticles);
kbRouter.get('/articles/:slug', knowledgeBaseController.getArticleBySlug);
kbRouter.get('/search', knowledgeBaseController.searchArticles);
kbRouter.get('/popular', knowledgeBaseController.getPopularArticles);

// Protected routes
kbRouter.post('/articles/:id/feedback', knowledgeBaseController.submitArticleFeedback);

// Admin routes (require authentication and admin check)
kbRouter.post('/admin/articles', authMiddleware, knowledgeBaseController.createArticle);
kbRouter.put('/admin/articles/:id', authMiddleware, knowledgeBaseController.updateArticle);
kbRouter.delete('/admin/articles/:id', authMiddleware, knowledgeBaseController.deleteArticle);

export default kbRouter;
