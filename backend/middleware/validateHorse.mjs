import { body, param } from 'express-validator';
import { handleValidationErrors } from './validationErrorHandler.mjs'; // Assuming a generic error handler, ensure .js extension

// Validation rules for creating a new horse
const validateCreateHorse = [
  body('name')
    .isString()
    .withMessage('Name must be a string.')
    .trim()
    .notEmpty()
    .withMessage('Name is required and cannot be empty.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters.'),
  body('sex')
    .isString()
    .withMessage('Sex must be a string.')
    .isIn(['Stallion', 'Mare', 'Gelding', 'Colt', 'Filly', 'Rig', 'Spayed Mare'])
    .withMessage(
      'Invalid sex. Must be one of: Stallion, Mare, Gelding, Colt, Filly, Rig, Spayed Mare.',
    ),
  body('date_of_birth')
    .isISO8601()
    .withMessage('Date of birth must be a valid ISO8601 date.')
    .toDate(), // Converts to a Date object after validation
  body('breed_id').isInt({ min: 1 }).withMessage('Breed ID must be a positive integer.'),
  body('owner_id').isInt({ min: 1 }).withMessage('Owner ID must be a positive integer.'),
  body('stable_id').isInt({ min: 1 }).withMessage('Stable ID must be a positive integer.'),

  // Optional fields
  body('genotype').optional().isObject().withMessage('Genotype must be an object if provided.'),
  body('phenotypic_markings')
    .optional()
    .isObject()
    .withMessage('Phenotypic markings must be an object if provided.'),
  body('final_display_color')
    .optional()
    .isString()
    .withMessage('Final display color must be a string if provided.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Final display color must be between 2 and 100 characters if provided.'),
  body('shade')
    .optional()
    .isString()
    .withMessage('Shade must be a string if provided.')
    .isLength({ min: 2, max: 50 })
    .withMessage('Shade must be between 2 and 50 characters if provided.'),
  body('image_url').optional().isURL().withMessage('Image URL must be a valid URL if provided.'),
  body('trait')
    .optional()
    .isString()
    .withMessage('Trait must be a string if provided.')
    .isLength({ min: 2, max: 50 })
    .withMessage('Trait must be between 2 and 50 characters if provided.'),
  body('temperament')
    .optional()
    .isString()
    .withMessage('Temperament must be a string if provided.')
    .isLength({ min: 2, max: 50 })
    .withMessage('Temperament must be between 2 and 50 characters if provided.'),

  // Stats - optional, integers 0-100
  ['precision', 'strength', 'speed', 'agility', 'endurance', 'intelligence', 'personality'].forEach(
    stat => {
      body(stat)
        .optional()
        .isInt({ min: 0, max: 100 })
        .withMessage(
          `${stat.charAt(0).toUpperCase() + stat.slice(1)} must be an integer between 0 and 100 if provided.`,
        );
    },
  ),

  body('total_earnings')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total earnings must be a non-negative number if provided.'),
  body('sire_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Sire ID must be a positive integer if provided.'),
  body('dam_id')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('Dam ID must be a positive integer if provided.'),
  body('stud_status')
    .optional()
    .isIn(['Public Stud', 'Private Stud', 'Not at Stud', 'Retired', 'Youngstock'])
    .withMessage(
      'Invalid stud status if provided. Must be one of: Public Stud, Private Stud, Not at Stud, Retired, Youngstock.',
    ),
  body('stud_fee')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Stud fee must be a non-negative number if provided.'),
  body('last_bred_date')
    .optional({ nullable: true })
    .isISO8601()
    .toDate()
    .withMessage('Last bred date must be a valid ISO8601 date if provided.'),
  body('for_sale').optional().isBoolean().withMessage('For sale must be a boolean if provided.'),
  body('sale_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Sale price must be a non-negative number if provided.'),
  body('health_status')
    .optional()
    .isString()
    .withMessage('Health status must be a string if provided.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Health status must be between 2 and 100 characters if provided.'),
  body('last_vetted_date')
    .optional({ nullable: true })
    .isISO8601()
    .toDate()
    .withMessage('Last vetted date must be a valid ISO8601 date if provided.'),
  body('tack').optional().isObject().withMessage('Tack must be an object if provided.'),

  handleValidationErrors, // This should be the last item in the array
];

// Validation rules for updating an existing horse
const validateUpdateHorse = [
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer.'),
  // Add validation rules for updatable fields, e.g.:
  // body('name').optional().isString().notEmpty().withMessage('Name cannot be empty'),
  // body('stud_status').optional().isIn(['Public Stud', 'Private Stud', 'Not at Stud', 'Retired']).withMessage('Invalid stud status'),
  // ... other fields ...
  handleValidationErrors, // This should be the last item in the array
];

// Validation rules for getting a horse by ID (just param validation)
const validateGetHorseById = [
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer.'),
  handleValidationErrors,
];

export { validateCreateHorse, validateUpdateHorse, validateGetHorseById };
