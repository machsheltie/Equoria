/**
 * Groom Marketplace Controller
 * Handles API endpoints for the groom marketplace system
 * 
 * Features:
 * - Get available grooms in marketplace
 * - Refresh marketplace (free or premium)
 * - Hire grooms from marketplace
 * - Track marketplace state per user
 */

import { 
  generateMarketplace, 
  needsRefresh, 
  getRefreshCost,
  MARKETPLACE_CONFIG 
} from '../services/groomMarketplace.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import logger from '../utils/logger.mjs';

// In-memory marketplace storage (in production, this would be in Redis or database)
const userMarketplaces = new Map();

/**
 * Get marketplace for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getMarketplace(req, res) {
  try {
    const userId = req.user.id;
    
    logger.info(`[groomMarketplace] Getting marketplace for user ${userId}`);
    
    // Get or create user marketplace
    let userMarketplace = userMarketplaces.get(userId);
    
    if (!userMarketplace || needsRefresh(userMarketplace.lastRefresh)) {
      // Generate new marketplace
      const grooms = generateMarketplace();
      userMarketplace = {
        grooms,
        lastRefresh: new Date(),
        refreshCount: (userMarketplace?.refreshCount || 0) + 1
      };
      userMarketplaces.set(userId, userMarketplace);
      
      logger.info(`[groomMarketplace] Generated new marketplace for user ${userId} with ${grooms.length} grooms`);
    }
    
    // Calculate next free refresh time
    const nextFreeRefresh = new Date(userMarketplace.lastRefresh);
    nextFreeRefresh.setHours(nextFreeRefresh.getHours() + MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS);
    
    // Calculate refresh cost
    const refreshCost = getRefreshCost(userMarketplace.lastRefresh);

    res.status(200).json({
      success: true,
      message: 'Marketplace retrieved successfully',
      data: {
        grooms: userMarketplace.grooms,
        lastRefresh: userMarketplace.lastRefresh,
        nextFreeRefresh,
        refreshCost,
        canRefreshFree: refreshCost === 0,
        refreshCount: userMarketplace.refreshCount
      }
    });
    
  } catch (error) {
    logger.error(`[groomMarketplace] Error getting marketplace: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get marketplace',
      data: null
    });
  }
}

/**
 * Refresh marketplace for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function refreshMarketplace(req, res) {
  try {
    const userId = req.user.id;
    const { force = false } = req.body;
    
    logger.info(`[groomMarketplace] Refreshing marketplace for user ${userId}, force: ${force}`);
    
    // Get current marketplace
    const userMarketplace = userMarketplaces.get(userId);
    const refreshCost = getRefreshCost(userMarketplace?.lastRefresh);
    
    // Check if user needs to pay for refresh
    if (refreshCost > 0 && force) {
      // Get user's current money
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { money: true }
      });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          data: null
        });
      }
      
      if (user.money < refreshCost) {
        return res.status(400).json({
          success: false,
          message: `Insufficient funds. Refresh costs $${refreshCost}`,
          data: { 
            required: refreshCost, 
            available: user.money 
          }
        });
      }
      
      // Deduct refresh cost
      await prisma.user.update({
        where: { id: userId },
        data: { money: { decrement: refreshCost } }
      });
      
      logger.info(`[groomMarketplace] Charged user ${userId} $${refreshCost} for premium refresh`);
    } else if (refreshCost > 0 && !force) {
      return res.status(400).json({
        success: false,
        message: `Marketplace refresh costs $${refreshCost}. Set force=true to pay for refresh.`,
        data: { 
          cost: refreshCost,
          nextFreeRefresh: new Date(userMarketplace.lastRefresh.getTime() + (MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS * 60 * 60 * 1000))
        }
      });
    }
    
    // Generate new marketplace
    const grooms = generateMarketplace();
    const newMarketplace = {
      grooms,
      lastRefresh: new Date(),
      refreshCount: (userMarketplace?.refreshCount || 0) + 1
    };
    userMarketplaces.set(userId, newMarketplace);
    
    // Calculate next free refresh time
    const nextFreeRefresh = new Date(newMarketplace.lastRefresh);
    nextFreeRefresh.setHours(nextFreeRefresh.getHours() + MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS);
    
    logger.info(`[groomMarketplace] Refreshed marketplace for user ${userId} with ${grooms.length} new grooms`);
    
    res.status(200).json({
      success: true,
      message: 'Marketplace refreshed successfully',
      data: {
        grooms: newMarketplace.grooms,
        lastRefresh: newMarketplace.lastRefresh,
        nextFreeRefresh,
        refreshCost: 0, // Next refresh cost
        canRefreshFree: true,
        refreshCount: newMarketplace.refreshCount,
        paidRefresh: refreshCost > 0
      }
    });
    
  } catch (error) {
    logger.error(`[groomMarketplace] Error refreshing marketplace: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh marketplace',
      data: null
    });
  }
}

/**
 * Hire a groom from the marketplace
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function hireFromMarketplace(req, res) {
  try {
    const userId = req.user.id;
    const { marketplaceId } = req.body;
    
    if (!marketplaceId) {
      return res.status(400).json({
        success: false,
        message: 'marketplaceId is required',
        data: null
      });
    }
    
    logger.info(`[groomMarketplace] User ${userId} attempting to hire groom ${marketplaceId}`);
    
    // Get user marketplace
    const userMarketplace = userMarketplaces.get(userId);
    if (!userMarketplace) {
      return res.status(404).json({
        success: false,
        message: 'No marketplace found. Please refresh marketplace first.',
        data: null
      });
    }
    
    // Find the groom in marketplace
    const groomIndex = userMarketplace.grooms.findIndex(g => g.marketplaceId === marketplaceId);
    if (groomIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Groom not found in marketplace',
        data: null
      });
    }
    
    const groomData = userMarketplace.grooms[groomIndex];
    
    // Check if user has enough money
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { money: true }
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        data: null
      });
    }
    
    // Calculate hiring cost (first week's salary)
    const hiringCost = groomData.sessionRate * 7; // One week upfront
    
    if (user.money < hiringCost) {
      return res.status(400).json({
        success: false,
        message: `Insufficient funds. Hiring costs $${hiringCost} (one week upfront)`,
        data: { 
          required: hiringCost, 
          available: user.money 
        }
      });
    }
    
    // Create the groom in database
    const newGroom = await prisma.groom.create({
      data: {
        userId,
        name: `${groomData.firstName} ${groomData.lastName}`,
        speciality: groomData.specialty,
        skillLevel: groomData.skillLevel,
        personality: groomData.personality,
        experience: groomData.experience,
        sessionRate: groomData.sessionRate,
        bio: groomData.bio,
        availability: JSON.stringify({ available: true }),
        hiredDate: new Date()
      }
    });
    
    // Deduct hiring cost
    await prisma.user.update({
      where: { id: userId },
      data: { money: { decrement: hiringCost } }
    });
    
    // Remove groom from marketplace
    userMarketplace.grooms.splice(groomIndex, 1);
    userMarketplaces.set(userId, userMarketplace);
    
    logger.info(`[groomMarketplace] User ${userId} hired groom ${newGroom.id} for $${hiringCost}`);
    
    res.status(201).json({
      success: true,
      message: 'Groom hired successfully',
      data: {
        groom: newGroom,
        cost: hiringCost,
        remainingMoney: user.money - hiringCost
      }
    });
    
  } catch (error) {
    logger.error(`[groomMarketplace] Error hiring groom: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to hire groom',
      data: null
    });
  }
}

/**
 * Get marketplace statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getMarketplaceStats(req, res) {
  try {
    const userId = req.user.id;
    
    const userMarketplace = userMarketplaces.get(userId);
    
    if (!userMarketplace) {
      return res.status(200).json({
        success: true,
        message: 'No marketplace data available',
        data: {
          totalGrooms: 0,
          lastRefresh: null,
          refreshCount: 0,
          qualityDistribution: {},
          specialtyDistribution: {}
        }
      });
    }
    
    // Calculate distributions
    const qualityDistribution = {};
    const specialtyDistribution = {};
    
    userMarketplace.grooms.forEach(groom => {
      qualityDistribution[groom.skillLevel] = (qualityDistribution[groom.skillLevel] || 0) + 1;
      specialtyDistribution[groom.specialty] = (specialtyDistribution[groom.specialty] || 0) + 1;
    });
    
    res.status(200).json({
      success: true,
      message: 'Marketplace statistics retrieved successfully',
      data: {
        totalGrooms: userMarketplace.grooms.length,
        lastRefresh: userMarketplace.lastRefresh,
        refreshCount: userMarketplace.refreshCount,
        qualityDistribution,
        specialtyDistribution,
        config: {
          refreshIntervalHours: MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS,
          premiumRefreshCost: MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST,
          defaultSize: MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE
        }
      }
    });
    
  } catch (error) {
    logger.error(`[groomMarketplace] Error getting marketplace stats: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get marketplace statistics',
      data: null
    });
  }
}
