import crypto from 'crypto';
import logger from './logger.mjs';

/**
 * Security Validation Utilities
 * Comprehensive validation to prevent exploits and ensure data integrity
 */

/**
 * Validates and sanitizes horse data to prevent stat manipulation
 */
export const validateHorseData = (horseData, isUpdate = false) => {
  const errors = [];
  const sanitized = { ...horseData };

  // Name validation
  if (sanitized.name) {
    sanitized.name = sanitized.name.toString().trim();
    if (sanitized.name.length < 2 || sanitized.name.length > 50) {
      errors.push('Horse name must be between 2 and 50 characters');
    }
    // Prevent special characters that could be used for injection
    if (!/^[a-zA-Z0-9\s\-'.]+$/.test(sanitized.name)) {
      errors.push('Horse name contains invalid characters');
    }
  }

  // Age validation
  if (sanitized.age !== undefined) {
    const age = parseInt(sanitized.age);
    if (isNaN(age) || age < 0 || age > 50) {
      errors.push('Horse age must be between 0 and 50');
    }
    sanitized.age = age;
  }

  // Sex validation
  if (sanitized.sex) {
    const validSexes = ['Stallion', 'Mare', 'Gelding', 'Colt', 'Filly', 'Rig', 'Spayed Mare'];
    if (!validSexes.includes(sanitized.sex)) {
      errors.push('Invalid horse sex');
    }
  }

  // Stat validation (prevent stat hacking)
  const statFields = [
    'precision',
    'strength',
    'speed',
    'agility',
    'endurance',
    'intelligence',
    'personality',
  ];
  for (const stat of statFields) {
    if (sanitized[stat] !== undefined) {
      const value = parseInt(sanitized[stat]);
      if (isNaN(value) || value < 0 || value > 100) {
        errors.push(`${stat} must be between 0 and 100`);
      }
      sanitized[stat] = value;
    }
  }

  // Financial validation
  if (sanitized.total_earnings !== undefined) {
    const earnings = parseFloat(sanitized.total_earnings);
    if (isNaN(earnings) || earnings < 0 || earnings > 10000000) {
      errors.push('Total earnings must be between 0 and 10,000,000');
    }
    sanitized.total_earnings = earnings;
  }

  if (sanitized.stud_fee !== undefined) {
    const fee = parseFloat(sanitized.stud_fee);
    if (isNaN(fee) || fee < 0 || fee > 1000000) {
      errors.push('Stud fee must be between 0 and 1,000,000');
    }
    sanitized.stud_fee = fee;
  }

  if (sanitized.sale_price !== undefined) {
    const price = parseFloat(sanitized.sale_price);
    if (isNaN(price) || price < 0 || price > 10000000) {
      errors.push('Sale price must be between 0 and 10,000,000');
    }
    sanitized.sale_price = price;
  }

  // Prevent direct modification of protected fields in updates
  if (isUpdate) {
    const protectedFields = ['id', 'createdAt', 'updatedAt'];
    for (const field of protectedFields) {
      if (sanitized[field] !== undefined) {
        delete sanitized[field];
        logger.warn(`[security] Attempt to modify protected field: ${field}`);
      }
    }
  }

  return { isValid: errors.length === 0, errors, sanitized };
};

/**
 * Validates player data to prevent account manipulation
 */
export const validatePlayerData = playerData => {
  const errors = [];
  const sanitized = { ...playerData };

  // Name validation
  if (sanitized.name) {
    sanitized.name = sanitized.name.toString().trim();
    if (sanitized.name.length < 2 || sanitized.name.length > 30) {
      errors.push('Player name must be between 2 and 30 characters');
    }
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(sanitized.name)) {
      errors.push('Player name contains invalid characters');
    }
  }

  // Email validation
  if (sanitized.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitized.email)) {
      errors.push('Invalid email format');
    }
    sanitized.email = sanitized.email.toLowerCase().trim();
  }

  // Money validation (prevent money hacking)
  if (sanitized.money !== undefined) {
    const money = parseFloat(sanitized.money);
    if (isNaN(money) || money < 0 || money > 100000000) {
      errors.push('Money must be between 0 and 100,000,000');
    }
    sanitized.money = money;
  }

  // Level validation
  if (sanitized.level !== undefined) {
    const level = parseInt(sanitized.level);
    if (isNaN(level) || level < 1 || level > 100) {
      errors.push('Level must be between 1 and 100');
    }
    sanitized.level = level;
  }

  // XP validation
  if (sanitized.xp !== undefined) {
    const xp = parseInt(sanitized.xp);
    if (isNaN(xp) || xp < 0 || xp > 10000000) {
      errors.push('XP must be between 0 and 10,000,000');
    }
    sanitized.xp = xp;
  }

  // Settings validation
  if (sanitized.settings) {
    if (typeof sanitized.settings !== 'object') {
      errors.push('Settings must be an object');
    } else {
      // Validate settings structure
      const allowedSettings = ['darkMode', 'notifications', 'privacy', 'language'];
      const settingsKeys = Object.keys(sanitized.settings);
      for (const key of settingsKeys) {
        if (!allowedSettings.includes(key)) {
          delete sanitized.settings[key];
          logger.warn(`[security] Removed invalid setting: ${key}`);
        }
      }
    }
  }

  return { isValid: errors.length === 0, errors, sanitized };
};

/**
 * Validates breeding data to prevent exploit breeding
 */
export const validateBreedingData = breedingData => {
  const errors = [];
  const sanitized = { ...breedingData };

  // Sire and Dam ID validation
  if (!sanitized.sireId || !sanitized.damId) {
    errors.push('Both sire and dam IDs are required');
  }

  if (sanitized.sireId) {
    const sireId = parseInt(sanitized.sireId);
    if (isNaN(sireId) || sireId <= 0) {
      errors.push('Invalid sire ID');
    }
    sanitized.sireId = sireId;
  }

  if (sanitized.damId) {
    const damId = parseInt(sanitized.damId);
    if (isNaN(damId) || damId <= 0) {
      errors.push('Invalid dam ID');
    }
    sanitized.damId = damId;
  }

  // Prevent self-breeding
  if (sanitized.sireId === sanitized.damId) {
    errors.push('A horse cannot breed with itself');
  }

  // Breeding fee validation
  if (sanitized.breedingFee !== undefined) {
    const fee = parseFloat(sanitized.breedingFee);
    if (isNaN(fee) || fee < 0 || fee > 1000000) {
      errors.push('Breeding fee must be between 0 and 1,000,000');
    }
    sanitized.breedingFee = fee;
  }

  return { isValid: errors.length === 0, errors, sanitized };
};

/**
 * Validates training data to prevent training exploits
 */
export const validateTrainingData = trainingData => {
  const errors = [];
  const sanitized = { ...trainingData };

  // Horse ID validation
  if (!sanitized.horseId) {
    errors.push('Horse ID is required');
  } else {
    const horseId = parseInt(sanitized.horseId);
    if (isNaN(horseId) || horseId <= 0) {
      errors.push('Invalid horse ID');
    }
    sanitized.horseId = horseId;
  }

  // Discipline validation
  if (!sanitized.discipline) {
    errors.push('Discipline is required');
  } else {
    const validDisciplines = ['Racing', 'Show Jumping', 'Dressage', 'Cross Country', 'Western'];
    if (!validDisciplines.includes(sanitized.discipline)) {
      errors.push('Invalid discipline');
    }
  }

  // Prevent direct stat modification in training requests
  const protectedFields = [
    'precision',
    'strength',
    'speed',
    'agility',
    'endurance',
    'intelligence',
    'personality',
  ];
  for (const field of protectedFields) {
    if (sanitized[field] !== undefined) {
      delete sanitized[field];
      logger.warn(`[security] Removed protected field from training request: ${field}`);
    }
  }

  return { isValid: errors.length === 0, errors, sanitized };
};

/**
 * Validates transaction data to prevent financial exploits
 */
export const validateTransactionData = transactionData => {
  const errors = [];
  const sanitized = { ...transactionData };

  // Amount validation
  if (!sanitized.amount) {
    errors.push('Transaction amount is required');
  } else {
    const amount = parseFloat(sanitized.amount);
    if (isNaN(amount) || amount <= 0 || amount > 10000000) {
      errors.push('Transaction amount must be between 0.01 and 10,000,000');
    }
    sanitized.amount = amount;
  }

  // Transaction type validation
  if (!sanitized.type) {
    errors.push('Transaction type is required');
  } else {
    const validTypes = [
      'purchase',
      'sale',
      'transfer',
      'breeding_fee',
      'training_fee',
      'competition_entry',
      'prize',
    ];
    if (!validTypes.includes(sanitized.type)) {
      errors.push('Invalid transaction type');
    }
  }

  // Description validation
  if (sanitized.description) {
    sanitized.description = sanitized.description.toString().trim();
    if (sanitized.description.length > 200) {
      errors.push('Transaction description must be 200 characters or less');
    }
    // Sanitize description
    sanitized.description = sanitized.description.replace(/[<>]/g, '');
  }

  return { isValid: errors.length === 0, errors, sanitized };
};

/**
 * Generates secure hash for data integrity verification
 */
export const generateDataHash = data => {
  const dataString = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(dataString).digest('hex');
};

/**
 * Verifies data integrity using hash
 */
export const verifyDataIntegrity = (data, expectedHash) => {
  const actualHash = generateDataHash(data);
  return actualHash === expectedHash;
};

/**
 * Sanitizes input to prevent XSS and injection attacks
 */
export const sanitizeInput = input => {
  if (typeof input !== 'string') {
    return input;
  }

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/data:/gi, '') // Remove data: protocols
    .substring(0, 1000); // Limit length
};

/**
 * Validates ID parameters to prevent injection
 */
export const validateId = (id, fieldName = 'ID') => {
  const numericId = parseInt(id);
  if (isNaN(numericId) || numericId <= 0 || numericId > 2147483647) {
    throw new Error(`Invalid ${fieldName}: must be a positive integer`);
  }
  return numericId;
};

/**
 * Rate limiting validation
 */
export const validateRateLimit = (userId, operation, maxRequests = 10, windowMs = 60000) => {
  // This would typically use Redis or a database
  // For now, we'll use in-memory storage (not suitable for production clusters)
  if (!global.rateLimitStore) {
    global.rateLimitStore = new Map();
  }

  const key = `${userId}_${operation}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  let requests = global.rateLimitStore.get(key) || [];
  requests = requests.filter(timestamp => timestamp > windowStart);

  if (requests.length >= maxRequests) {
    return { allowed: false, resetTime: requests[0] + windowMs };
  }

  requests.push(now);
  global.rateLimitStore.set(key, requests);

  return { allowed: true, remaining: maxRequests - requests.length };
};

/**
 * Validates file uploads to prevent malicious files
 */
export const validateFileUpload = file => {
  const errors = [];

  if (!file) {
    errors.push('No file provided');
    return { isValid: false, errors };
  }

  // File size validation (5MB max)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    errors.push('File size exceeds 5MB limit');
  }

  // File type validation
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    errors.push('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed');
  }

  // File name validation
  const fileName = file.originalname || file.name || '';
  if (!/^[a-zA-Z0-9\-_.s]+$/.test(fileName)) {
    errors.push('Invalid file name characters');
  }

  return { isValid: errors.length === 0, errors };
};

export default {
  validateHorseData,
  validatePlayerData,
  validateBreedingData,
  validateTrainingData,
  validateTransactionData,
  generateDataHash,
  verifyDataIntegrity,
  sanitizeInput,
  validateId,
  validateRateLimit,
  validateFileUpload,
};
