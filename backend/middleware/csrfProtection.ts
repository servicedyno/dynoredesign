/**
 * CSRF Protection Middleware
 * Implements CSRF token validation for state-changing operations
 * Uses double-submit cookie pattern (stateless, doesn't require session storage)
 */

import express from "express";
import crypto from "crypto";
import { errorResponseHelper } from "../helper";

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const CSRF_HEADER_NAME = 'x-xsrf-token';
const CSRF_FORM_FIELD = '_csrf';

/**
 * Generate a random CSRF token
 */
const generateCsrfToken = (): string => {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
};

/**
 * CSRF Token Generation Middleware
 * Sets CSRF token in cookie and makes it available to templates
 */
export const csrfTokenGenerator = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  // Check if token already exists in cookie
  let token = req.cookies?.[CSRF_COOKIE_NAME];
  
  if (!token) {
    // Generate new token
    token = generateCsrfToken();
    
    // Set cookie (httpOnly: false so JavaScript can read it for AJAX requests)
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,  // Allow JavaScript access for AJAX
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000  // 24 hours
    });
  }
  
  // Make token available to request
  res.locals.csrfToken = token;
  
  next();
};

/**
 * CSRF Protection Middleware
 * Validates CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
 */
export const csrfProtection = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  // Skip CSRF check for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Skip CSRF check for API endpoints using API keys (already authenticated)
  if (req.headers['x-api-key']) {
    return next();
  }
  
  // Get token from cookie
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  
  if (!cookieToken) {
    return errorResponseHelper(
      res,
      403,
      'CSRF token missing. Please refresh the page and try again.'
    );
  }
  
  // Get token from request (header or form field)
  const requestToken = req.headers[CSRF_HEADER_NAME] as string || 
                       req.body?.[CSRF_FORM_FIELD];
  
  if (!requestToken) {
    return errorResponseHelper(
      res,
      403,
      'CSRF token not provided in request. Please include X-XSRF-TOKEN header or _csrf field.'
    );
  }
  
  // Compare tokens using timing-safe comparison
  if (!crypto.timingSafeEqual(
    Buffer.from(cookieToken, 'utf8'),
    Buffer.from(requestToken, 'utf8')
  )) {
    return errorResponseHelper(
      res,
      403,
      'Invalid CSRF token. This request appears to be forged. Please refresh and try again.'
    );
  }
  
  // Token is valid, proceed
  next();
};

/**
 * CSRF Protection for Admin Routes
 * Stricter validation for admin endpoints
 */
export const adminCsrfProtection = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  // Log CSRF validation attempt for security monitoring
  console.log(`[CSRF] Admin endpoint access attempt: ${req.method} ${req.path} from ${req.ip}`);
  
  // Apply standard CSRF protection
  csrfProtection(req, res, next);
};

/**
 * Get CSRF token for client-side use
 * Useful for AJAX requests
 */
export const getCsrfToken = (req: express.Request, res: express.Response): void => {
  const token = res.locals.csrfToken || req.cookies?.[CSRF_COOKIE_NAME];
  
  if (!token) {
    res.status(500).json({
      error: 'CSRF token not available. Please ensure CSRF middleware is enabled.'
    });
    return;
  }
  
  res.status(200).json({
    csrfToken: token,
    headerName: CSRF_HEADER_NAME,
    cookieName: CSRF_COOKIE_NAME
  });
};

export default {
  csrfTokenGenerator,
  csrfProtection,
  adminCsrfProtection,
  getCsrfToken
};
