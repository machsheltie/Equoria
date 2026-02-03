/**
 * Environmental Factor Engine Tests
 *
 * Tests for core environmental calculation system with weather patterns, seasonal cycles,
 * environmental triggers, and factor calculations affecting horse development and performance.
 *
 * Testing Approach: TDD with NO MOCKING - Real system validation
 * Business Rules: Environmental impact on horse development, seasonal variations, weather effects
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import logger from '../../utils/logger.mjs';
import {
  calculateCurrentWeather,
  getSeasonalFactors,
  calculateEnvironmentalTriggers,
  calculateEnvironmentalImpact,
  generateWeatherForecast,
  getEnvironmentalHistory,
  calculateComfortZone,
  assessEnvironmentalStress,
} from '../../services/environmentalFactorEngineService.mjs';

// Helper function to calculate seasonal temperature averages
function calculateSeasonalAverage(startDate, days, location) {
  let total = 0;
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const weather = calculateCurrentWeather(date, location);
    total += weather.temperature;
  }
  return total / days;
}

describe('🌤️ Environmental Factor Engine', () => {
  let testDate, testLocation, testHorse;

  beforeEach(() => {
    testDate = new Date('2024-06-15'); // Mid-summer date for testing
    testLocation = {
      latitude: 40.7128,
      longitude: -74.006,
      region: 'temperate',
      elevation: 10,
    };
    testHorse = {
      id: 1,
      age: 5,
      health: 85,
      traits: ['heat_tolerant', 'calm'],
      stats: { stamina: 80, intelligence: 75 },
    };
  });

  describe('🌡️ Weather System', () => {
    test('should calculate current weather conditions', () => {
      const weather = calculateCurrentWeather(testDate, testLocation);

      expect(weather).toHaveProperty('temperature');
      expect(weather).toHaveProperty('humidity');
      expect(weather).toHaveProperty('precipitation');
      expect(weather).toHaveProperty('windSpeed');
      expect(weather).toHaveProperty('pressure');
      expect(weather).toHaveProperty('conditions');

      // Verify temperature is realistic for summer
      expect(weather.temperature).toBeGreaterThan(15);
      expect(weather.temperature).toBeLessThan(40);

      // Verify humidity is within valid range
      expect(weather.humidity).toBeGreaterThanOrEqual(0);
      expect(weather.humidity).toBeLessThanOrEqual(100);

      // Verify wind speed is realistic
      expect(weather.windSpeed).toBeGreaterThanOrEqual(0);
      expect(weather.windSpeed).toBeLessThan(50);

      // Verify conditions is a valid weather type
      expect(['sunny', 'cloudy', 'rainy', 'stormy', 'foggy']).toContain(weather.conditions);
    });

    test('should generate realistic weather patterns for different seasons', () => {
      const springDate = new Date('2024-04-15');
      const summerDate = new Date('2024-07-15');
      const autumnDate = new Date('2024-10-15');
      const winterDate = new Date('2024-01-15');

      const springWeather = calculateCurrentWeather(springDate, testLocation);
      const summerWeather = calculateCurrentWeather(summerDate, testLocation);
      const autumnWeather = calculateCurrentWeather(autumnDate, testLocation);
      const winterWeather = calculateCurrentWeather(winterDate, testLocation);

      // Summer should be warmer than winter (allowing for daily variation)
      expect(summerWeather.temperature).toBeGreaterThan(winterWeather.temperature);

      // Spring and autumn should be moderate (allowing for daily variation)
      expect(springWeather.temperature).toBeGreaterThan(winterWeather.temperature);
      expect(autumnWeather.temperature).toBeGreaterThan(winterWeather.temperature);

      // Test seasonal averages over multiple days to account for daily variation
      const springAvg = calculateSeasonalAverage(new Date('2024-04-01'), 30, testLocation);
      const summerAvg = calculateSeasonalAverage(new Date('2024-07-01'), 30, testLocation);
      const winterAvg = calculateSeasonalAverage(new Date('2024-01-01'), 30, testLocation);

      expect(summerAvg).toBeGreaterThan(springAvg);
      expect(springAvg).toBeGreaterThan(winterAvg);
    });

    test('should account for location factors in weather calculation', () => {
      const tropicalLocation = {
        latitude: 25.7617,
        longitude: -80.1918,
        region: 'tropical',
        elevation: 2,
      };

      const arcticLocation = {
        latitude: 71.0486,
        longitude: -8.0751,
        region: 'arctic',
        elevation: 50,
      };

      const tropicalWeather = calculateCurrentWeather(testDate, tropicalLocation);
      const arcticWeather = calculateCurrentWeather(testDate, arcticLocation);

      // Tropical should be warmer than arctic
      expect(tropicalWeather.temperature).toBeGreaterThan(arcticWeather.temperature);

      // Tropical should have higher humidity
      expect(tropicalWeather.humidity).toBeGreaterThan(arcticWeather.humidity);
    });
  });

  describe('🍂 Seasonal Cycles', () => {
    test('should calculate seasonal factors for horse development', () => {
      const springFactors = getSeasonalFactors(new Date('2024-04-15'));
      const summerFactors = getSeasonalFactors(new Date('2024-07-15'));
      const autumnFactors = getSeasonalFactors(new Date('2024-10-15'));
      const winterFactors = getSeasonalFactors(new Date('2024-01-15'));

      // Verify all seasonal factors have required properties
      [springFactors, summerFactors, autumnFactors, winterFactors].forEach((factors) => {
        expect(factors).toHaveProperty('season');
        expect(factors).toHaveProperty('growthModifier');
        expect(factors).toHaveProperty('healthModifier');
        expect(factors).toHaveProperty('trainingEffectiveness');
        expect(factors).toHaveProperty('stressLevel');
        expect(factors).toHaveProperty('description');
      });

      // Spring should have positive growth modifier
      expect(springFactors.growthModifier).toBeGreaterThan(1.0);
      expect(springFactors.season).toBe('spring');

      // Summer should have heat stress
      expect(summerFactors.stressLevel).toBeGreaterThan(winterFactors.stressLevel);
      expect(summerFactors.season).toBe('summer');

      // Winter should have reduced training effectiveness
      expect(winterFactors.trainingEffectiveness).toBeLessThan(summerFactors.trainingEffectiveness);
      expect(winterFactors.season).toBe('winter');

      // Autumn should be preparation season
      expect(autumnFactors.season).toBe('autumn');
    });

    test('should provide seasonal transition effects', () => {
      // Test dates at season boundaries - use actual transition dates
      const lateWinter = getSeasonalFactors(new Date('2024-03-15')); // Day 75 - just before spring
      const earlySpring = getSeasonalFactors(new Date('2024-03-25')); // Day 85 - just after spring starts
      const lateSpring = getSeasonalFactors(new Date('2024-06-15')); // Day 167 - just before summer
      const earlySummer = getSeasonalFactors(new Date('2024-06-25')); // Day 177 - just after summer starts

      // Verify we're in the right seasons
      expect(lateWinter.season).toBe('winter');
      expect(earlySpring.season).toBe('spring');
      expect(lateSpring.season).toBe('spring');
      expect(earlySummer.season).toBe('summer');

      // Spring should have higher growth modifier than winter
      expect(earlySpring.growthModifier).toBeGreaterThan(lateWinter.growthModifier);

      // Summer should have higher stress level than spring
      expect(earlySummer.stressLevel).toBeGreaterThan(lateSpring.stressLevel);
    });
  });

  describe('⚡ Environmental Triggers', () => {
    test('should calculate environmental triggers for trait expression', () => {
      const triggers = calculateEnvironmentalTriggers(testDate, testLocation, testHorse);

      expect(triggers).toHaveProperty('activeTriggersCount');
      expect(triggers).toHaveProperty('triggerTypes');
      expect(triggers).toHaveProperty('intensity');
      expect(triggers).toHaveProperty('traitExpressionProbability');
      expect(triggers).toHaveProperty('recommendations');

      expect(triggers.activeTriggersCount).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(triggers.triggerTypes)).toBe(true);
      expect(triggers.intensity).toBeGreaterThanOrEqual(0);
      expect(triggers.intensity).toBeLessThanOrEqual(100);
      expect(triggers.traitExpressionProbability).toBeGreaterThanOrEqual(0);
      expect(triggers.traitExpressionProbability).toBeLessThanOrEqual(1);
      expect(Array.isArray(triggers.recommendations)).toBe(true);
    });

    test('should identify stress triggers based on weather conditions', () => {
      const extremeWeather = {
        temperature: 38, // Very hot
        humidity: 95, // Very humid
        windSpeed: 25, // Strong wind
        conditions: 'stormy',
      };

      const mildWeather = {
        temperature: 22, // Comfortable
        humidity: 60, // Moderate
        windSpeed: 5, // Light breeze
        conditions: 'sunny',
      };

      // Mock weather calculation for testing
      const stressTriggersExtreme = calculateEnvironmentalTriggers(
        testDate,
        testLocation,
        testHorse,
        extremeWeather
      );
      const stressTriggersMild = calculateEnvironmentalTriggers(
        testDate,
        testLocation,
        testHorse,
        mildWeather
      );

      expect(stressTriggersExtreme.intensity).toBeGreaterThan(stressTriggersMild.intensity);
      expect(stressTriggersExtreme.activeTriggersCount).toBeGreaterThan(
        stressTriggersMild.activeTriggersCount
      );
    });

    test('should account for horse traits in trigger calculation', () => {
      const heatSensitiveHorse = {
        ...testHorse,
        traits: ['heat_sensitive', 'nervous'],
      };

      const heatTolerantHorse = {
        ...testHorse,
        traits: ['heat_tolerant', 'calm'],
      };

      const hotWeather = {
        temperature: 35,
        humidity: 80,
        windSpeed: 2,
        conditions: 'sunny',
      };

      const sensitiveTriggersHot = calculateEnvironmentalTriggers(
        testDate,
        testLocation,
        heatSensitiveHorse,
        hotWeather
      );
      const tolerantTriggersHot = calculateEnvironmentalTriggers(
        testDate,
        testLocation,
        heatTolerantHorse,
        hotWeather
      );

      expect(sensitiveTriggersHot.intensity).toBeGreaterThan(tolerantTriggersHot.intensity);
    });
  });

  describe('🎯 Environmental Impact Calculation', () => {
    test('should calculate environmental impact on horse development', () => {
      const impact = calculateEnvironmentalImpact(testDate, testLocation, testHorse);

      expect(impact).toHaveProperty('overallImpact');
      expect(impact).toHaveProperty('statModifiers');
      expect(impact).toHaveProperty('healthEffect');
      expect(impact).toHaveProperty('developmentEffect');
      expect(impact).toHaveProperty('performanceEffect');
      expect(impact).toHaveProperty('recommendations');

      // Verify impact score is within valid range
      expect(impact.overallImpact).toBeGreaterThanOrEqual(-100);
      expect(impact.overallImpact).toBeLessThanOrEqual(100);

      // Verify stat modifiers structure
      expect(impact.statModifiers).toHaveProperty('speed');
      expect(impact.statModifiers).toHaveProperty('stamina');
      expect(impact.statModifiers).toHaveProperty('agility');
      expect(impact.statModifiers).toHaveProperty('intelligence');

      // Verify effects are within reasonable ranges
      expect(impact.healthEffect).toBeGreaterThanOrEqual(-20);
      expect(impact.healthEffect).toBeLessThanOrEqual(20);
      expect(impact.developmentEffect).toBeGreaterThanOrEqual(-50);
      expect(impact.developmentEffect).toBeLessThanOrEqual(50);
      expect(impact.performanceEffect).toBeGreaterThanOrEqual(-30);
      expect(impact.performanceEffect).toBeLessThanOrEqual(30);

      expect(Array.isArray(impact.recommendations)).toBe(true);
    });

    test('should provide different impacts for different environmental conditions', () => {
      const idealConditions = {
        temperature: 20,
        humidity: 50,
        windSpeed: 8,
        conditions: 'sunny',
      };

      const harshConditions = {
        temperature: 40,
        humidity: 90,
        windSpeed: 30,
        conditions: 'stormy',
      };

      const idealImpact = calculateEnvironmentalImpact(
        testDate,
        testLocation,
        testHorse,
        idealConditions
      );
      const harshImpact = calculateEnvironmentalImpact(
        testDate,
        testLocation,
        testHorse,
        harshConditions
      );

      expect(idealImpact.overallImpact).toBeGreaterThan(harshImpact.overallImpact);
      expect(idealImpact.healthEffect).toBeGreaterThan(harshImpact.healthEffect);
      expect(idealImpact.performanceEffect).toBeGreaterThan(harshImpact.performanceEffect);
    });
  });

  describe('🔮 Weather Forecasting', () => {
    test('should generate weather forecast for planning', () => {
      const forecast = generateWeatherForecast(testDate, testLocation, 7); // 7-day forecast

      expect(Array.isArray(forecast)).toBe(true);
      expect(forecast).toHaveLength(7);

      forecast.forEach((day, index) => {
        expect(day).toHaveProperty('date');
        expect(day).toHaveProperty('weather');
        expect(day).toHaveProperty('environmentalImpact');
        expect(day).toHaveProperty('recommendations');

        // Verify date progression
        const expectedDate = new Date(testDate);
        expectedDate.setDate(expectedDate.getDate() + index);
        expect(new Date(day.date).toDateString()).toBe(expectedDate.toDateString());

        // Verify weather structure
        expect(day.weather).toHaveProperty('temperature');
        expect(day.weather).toHaveProperty('conditions');

        // Verify impact assessment
        expect(day.environmentalImpact).toHaveProperty('severity');
        expect(['low', 'moderate', 'high', 'extreme']).toContain(day.environmentalImpact.severity);
      });
    });

    test('should provide seasonal forecast trends', () => {
      const springForecast = generateWeatherForecast(new Date('2024-04-15'), testLocation, 14);
      const winterForecast = generateWeatherForecast(new Date('2024-01-15'), testLocation, 14);

      const avgSpringTemp =
        springForecast.reduce((sum, day) => sum + day.weather.temperature, 0) /
        springForecast.length;
      const avgWinterTemp =
        winterForecast.reduce((sum, day) => sum + day.weather.temperature, 0) /
        winterForecast.length;

      expect(avgSpringTemp).toBeGreaterThan(avgWinterTemp);
    });
  });

  describe('📊 Comfort Zone Analysis', () => {
    test('should calculate horse comfort zone based on traits and preferences', () => {
      const comfortZone = calculateComfortZone(testHorse);

      expect(comfortZone).toHaveProperty('temperatureRange');
      expect(comfortZone).toHaveProperty('humidityRange');
      expect(comfortZone).toHaveProperty('optimalConditions');
      expect(comfortZone).toHaveProperty('stressThresholds');

      // Verify temperature range structure
      expect(comfortZone.temperatureRange).toHaveProperty('min');
      expect(comfortZone.temperatureRange).toHaveProperty('max');
      expect(comfortZone.temperatureRange).toHaveProperty('optimal');

      // Verify ranges are logical
      expect(comfortZone.temperatureRange.min).toBeLessThan(comfortZone.temperatureRange.max);
      expect(comfortZone.temperatureRange.optimal).toBeGreaterThanOrEqual(
        comfortZone.temperatureRange.min
      );
      expect(comfortZone.temperatureRange.optimal).toBeLessThanOrEqual(
        comfortZone.temperatureRange.max
      );

      // Verify humidity range
      expect(comfortZone.humidityRange.min).toBeGreaterThanOrEqual(0);
      expect(comfortZone.humidityRange.max).toBeLessThanOrEqual(100);
      expect(comfortZone.humidityRange.min).toBeLessThan(comfortZone.humidityRange.max);
    });

    test('should adjust comfort zone based on horse traits', () => {
      const coldTolerantHorse = {
        ...testHorse,
        traits: ['cold_tolerant', 'hardy'],
      };

      const heatTolerantHorse = {
        ...testHorse,
        traits: ['heat_tolerant', 'desert_adapted'],
      };

      const coldComfort = calculateComfortZone(coldTolerantHorse);
      const heatComfort = calculateComfortZone(heatTolerantHorse);

      // Cold tolerant horse should have lower temperature preferences
      expect(coldComfort.temperatureRange.min).toBeLessThan(heatComfort.temperatureRange.min);

      // Heat tolerant horse should have higher temperature preferences
      expect(heatComfort.temperatureRange.max).toBeGreaterThan(coldComfort.temperatureRange.max);
    });
  });

  describe('⚠️ Environmental Stress Assessment', () => {
    test('should assess environmental stress levels', () => {
      const stressAssessment = assessEnvironmentalStress(testDate, testLocation, testHorse);

      expect(stressAssessment).toHaveProperty('stressLevel');
      expect(stressAssessment).toHaveProperty('stressFactors');
      expect(stressAssessment).toHaveProperty('severity');
      expect(stressAssessment).toHaveProperty('mitigationRecommendations');
      expect(stressAssessment).toHaveProperty('timeToRecovery');

      expect(stressAssessment.stressLevel).toBeGreaterThanOrEqual(0);
      expect(stressAssessment.stressLevel).toBeLessThanOrEqual(100);
      expect(['low', 'moderate', 'high', 'critical']).toContain(stressAssessment.severity);
      expect(Array.isArray(stressAssessment.stressFactors)).toBe(true);
      expect(Array.isArray(stressAssessment.mitigationRecommendations)).toBe(true);
      expect(stressAssessment.timeToRecovery).toBeGreaterThanOrEqual(0);
    });

    test('should provide stress mitigation recommendations', () => {
      const highStressWeather = {
        temperature: 42,
        humidity: 95,
        windSpeed: 35,
        conditions: 'stormy',
      };

      const stressAssessment = assessEnvironmentalStress(
        testDate,
        testLocation,
        testHorse,
        highStressWeather
      );

      expect(stressAssessment.severity).not.toBe('low');
      expect(stressAssessment.mitigationRecommendations.length).toBeGreaterThan(0);

      // Verify recommendations are actionable
      stressAssessment.mitigationRecommendations.forEach((recommendation) => {
        expect(recommendation).toHaveProperty('action');
        expect(recommendation).toHaveProperty('priority');
        expect(recommendation).toHaveProperty('effectiveness');
        expect(['low', 'medium', 'high', 'critical']).toContain(recommendation.priority);
      });
    });
  });
});
