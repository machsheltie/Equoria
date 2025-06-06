import express from 'express';
import { handlePing, handleHealthCheck } from '../controllers/pingController.mjs';
import { validatePing } from '../middleware/validatePing.mjs';

const router = express.Router();

/**
 * @swagger
 * /ping:
 *   get:
 *     summary: Health check endpoint
 *     description: Simple health check endpoint that returns a pong response. Useful for monitoring and load balancer health checks.
 *     tags: [Health]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *           minLength: 2
 *           maxLength: 30
 *           pattern: '^[a-zA-Z0-9\s]+$'
 *         description: Optional name to personalize the response
 *         example: John
 *     responses:
 *       200:
 *         description: Successful pong response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, message, timestamp]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "pong, John!"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2023-12-25T10:30:00.000Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 */
router.get('/', validatePing, handlePing);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Comprehensive health check
 *     description: Returns detailed health status including database connectivity and system information
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "healthy"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     uptime:
 *                       type: number
 *                       description: Server uptime in seconds
 *                     environment:
 *                       type: string
 *                       example: "development"
 *                     version:
 *                       type: string
 *                       example: "1.0.0"
 *                     services:
 *                       type: object
 *                       properties:
 *                         database:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               example: "healthy"
 *                             responseTime:
 *                               type: string
 *                               example: "15ms"
 *       503:
 *         description: Service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Service unhealthy"
 *                 data:
 *                   type: object
 *                   description: Health status with error details
 */
router.get('/health', handleHealthCheck);

export default router;
