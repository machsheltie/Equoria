/**
 * Authentication Utilities
 * Common functions for password hashing, token generation, etc.
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import logger from './logger.mjs';

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @param {number} saltRounds - Number of salt rounds (default: 10)
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(password, saltRounds = 10) {
  try {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string');
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    logger.debug('[authUtils.hashPassword] Password hashed successfully');
    return hashedPassword;
  } catch (error) {
    logger.error('[authUtils.hashPassword] Error hashing password:', error);
    throw error;
  }
}

/**
 * Compare a password with its hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches hash
 */
export async function comparePassword(password, hash) {
  try {
    if (!password || !hash) {
      throw new Error('Password and hash are required');
    }

    const isMatch = await bcrypt.compare(password, hash);
    logger.debug('[authUtils.comparePassword] Password comparison completed');
    return isMatch;
  } catch (error) {
    logger.error('[authUtils.comparePassword] Error comparing password:', error);
    throw error;
  }
}

/**
 * Generate a JWT token
 * @param {Object} payload - Token payload
 * @param {string} secret - JWT secret (optional, uses env variable)
 * @param {Object} options - JWT options (optional)
 * @returns {string} JWT token
 */
export function generateToken(payload, secret = null, options = {}) {
  try {
    const jwtSecret = secret || process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT secret is required');
    }

    const defaultOptions = {
      expiresIn: '24h',
      ...options,
    };

    const token = jwt.sign(payload, jwtSecret, defaultOptions);
    logger.debug('[authUtils.generateToken] Token generated successfully');
    return token;
  } catch (error) {
    logger.error('[authUtils.generateToken] Error generating token:', error);
    throw error;
  }
}

/**
 * Verify a JWT token
 * @param {string} token - JWT token
 * @param {string} secret - JWT secret (optional, uses env variable)
 * @returns {Object} Decoded token payload
 */
export function verifyToken(token, secret = null) {
  try {
    const jwtSecret = secret || process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT secret is required');
    }

    const decoded = jwt.verify(token, jwtSecret);
    logger.debug('[authUtils.verifyToken] Token verified successfully');
    return decoded;
  } catch (error) {
    logger.error('[authUtils.verifyToken] Error verifying token:', error);
    throw error;
  }
}

/**
 * Generate a random string for tokens, salts, etc.
 * @param {number} length - Length of random string (default: 32)
 * @returns {string} Random string
 */
export function generateRandomString(length = 32) {
  try {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    logger.debug('[authUtils.generateRandomString] Random string generated');
    return result;
  } catch (error) {
    logger.error('[authUtils.generateRandomString] Error generating random string:', error);
    throw error;
  }
}
