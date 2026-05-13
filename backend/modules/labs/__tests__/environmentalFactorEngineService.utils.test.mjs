/**
 * environmentalFactorEngineService — unit tests (Equoria-rr7)
 *
 * Logger-only import (no DB). No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateCurrentWeather,
  getSeasonalFactors,
  calculateEnvironmentalTriggers,
  calculateEnvironmentalImpact,
  generateWeatherForecast,
  calculateComfortZone,
  assessEnvironmentalStress,
  getEnvironmentalHistory,
} from '../../../services/environmentalFactorEngineService.mjs';

// Shared helpers
const makeLocation = (overrides = {}) => ({
  latitude: 45,
  longitude: -75,
  region: 'temperate',
  elevation: 100,
  ...overrides,
});

const makeSummerDate = () => new Date('2024-07-15T12:00:00Z');
const makeWinterDate = () => new Date('2024-01-15T12:00:00Z');
const makeSpringDate = () => new Date('2024-04-15T12:00:00Z');
const makeAutumnDate = () => new Date('2024-10-15T12:00:00Z');

const baseHorse = { id: 1, traits: [] };

// Minimal weather object that can be passed as override (avoids location-based calc)
const neutralWeather = {
  temperature: 18,
  humidity: 50,
  precipitation: 0.2,
  windSpeed: 10,
  pressure: 1013,
  conditions: 'sunny',
  timestamp: new Date().toISOString(),
  location: '45, -75',
};

// ---------------------------------------------------------------------------
// calculateCurrentWeather
// ---------------------------------------------------------------------------
describe('calculateCurrentWeather', () => {
  it('returns an object with all expected fields', () => {
    const result = calculateCurrentWeather(makeSummerDate(), makeLocation());
    expect(typeof result.temperature).toBe('number');
    expect(typeof result.humidity).toBe('number');
    expect(typeof result.precipitation).toBe('number');
    expect(typeof result.windSpeed).toBe('number');
    expect(typeof result.pressure).toBe('number');
    expect(typeof result.conditions).toBe('string');
    expect(typeof result.timestamp).toBe('string');
    expect(typeof result.location).toBe('string');
  });

  it('humidity is between 10 and 95', () => {
    const regions = ['tropical', 'temperate', 'arctic', 'desert', 'coastal'];
    for (const region of regions) {
      const r = calculateCurrentWeather(makeSummerDate(), makeLocation({ region }));
      expect(r.humidity).toBeGreaterThanOrEqual(10);
      expect(r.humidity).toBeLessThanOrEqual(95);
    }
  });

  it('precipitation is between 0 and 1', () => {
    const r = calculateCurrentWeather(makeSummerDate(), makeLocation());
    expect(r.precipitation).toBeGreaterThanOrEqual(0);
    expect(r.precipitation).toBeLessThanOrEqual(1);
  });

  it('conditions is one of known values', () => {
    const valid = new Set(['sunny', 'cloudy', 'rainy', 'stormy', 'foggy']);
    const r = calculateCurrentWeather(makeSummerDate(), makeLocation());
    expect(valid.has(r.conditions)).toBe(true);
  });

  it('timestamp is a valid ISO string matching the input date', () => {
    const date = makeSummerDate();
    const r = calculateCurrentWeather(date, makeLocation());
    expect(r.timestamp).toBe(date.toISOString());
  });

  it('desert region has lower humidity than tropical', () => {
    const date = makeSummerDate();
    const desert = calculateCurrentWeather(date, makeLocation({ region: 'desert' }));
    const tropical = calculateCurrentWeather(date, makeLocation({ region: 'tropical' }));
    expect(desert.humidity).toBeLessThan(tropical.humidity);
  });

  it('high elevation reduces temperature', () => {
    const date = makeSummerDate();
    const lowElev = calculateCurrentWeather(date, makeLocation({ elevation: 0 }));
    const highElev = calculateCurrentWeather(date, makeLocation({ elevation: 3000 }));
    expect(highElev.temperature).toBeLessThan(lowElev.temperature);
  });

  it('coastal region has higher wind speed than desert', () => {
    const date = makeSummerDate();
    const coastal = calculateCurrentWeather(date, makeLocation({ region: 'coastal' }));
    const desert = calculateCurrentWeather(date, makeLocation({ region: 'desert' }));
    expect(coastal.windSpeed).toBeGreaterThan(desert.windSpeed);
  });
});

// ---------------------------------------------------------------------------
// getSeasonalFactors
// ---------------------------------------------------------------------------
describe('getSeasonalFactors', () => {
  it('returns expected shape', () => {
    const r = getSeasonalFactors(makeSummerDate());
    expect(typeof r.season).toBe('string');
    expect(typeof r.growthModifier).toBe('number');
    expect(typeof r.healthModifier).toBe('number');
    expect(typeof r.trainingEffectiveness).toBe('number');
    expect(typeof r.stressLevel).toBe('number');
    expect(typeof r.description).toBe('string');
    expect(typeof r.dayOfYear).toBe('number');
    expect(typeof r.transitionEffect).toBe('boolean');
  });

  it('July 15 is summer', () => {
    expect(getSeasonalFactors(makeSummerDate()).season).toBe('summer');
  });

  it('January 15 is winter', () => {
    expect(getSeasonalFactors(makeWinterDate()).season).toBe('winter');
  });

  it('April 15 is spring', () => {
    expect(getSeasonalFactors(makeSpringDate()).season).toBe('spring');
  });

  it('October 15 is autumn', () => {
    expect(getSeasonalFactors(makeAutumnDate()).season).toBe('autumn');
  });

  it('spring growthModifier > 1', () => {
    expect(getSeasonalFactors(makeSpringDate()).growthModifier).toBeGreaterThan(1);
  });

  it('winter growthModifier < 1', () => {
    expect(getSeasonalFactors(makeWinterDate()).growthModifier).toBeLessThan(1);
  });

  it('summer stressLevel is highest among seasons', () => {
    const summer = getSeasonalFactors(makeSummerDate()).stressLevel;
    const winter = getSeasonalFactors(makeWinterDate()).stressLevel;
    const spring = getSeasonalFactors(makeSpringDate()).stressLevel;
    expect(summer).toBeGreaterThan(spring);
    expect(summer).toBeGreaterThan(winter);
  });

  it('dayOfYear is between 1 and 365', () => {
    const r = getSeasonalFactors(makeSummerDate());
    expect(r.dayOfYear).toBeGreaterThanOrEqual(1);
    expect(r.dayOfYear).toBeLessThanOrEqual(365);
  });
});

// ---------------------------------------------------------------------------
// calculateComfortZone
// ---------------------------------------------------------------------------
describe('calculateComfortZone', () => {
  it('returns expected shape', () => {
    const r = calculateComfortZone(baseHorse);
    expect(r.temperatureRange.min).toBeDefined();
    expect(r.temperatureRange.max).toBeDefined();
    expect(r.temperatureRange.optimal).toBeDefined();
    expect(r.humidityRange.min).toBeDefined();
    expect(r.humidityRange.max).toBeDefined();
    expect(r.optimalConditions).toBeDefined();
    expect(r.stressThresholds).toBeDefined();
  });

  it('base horse temperature range is 5 to 30', () => {
    const r = calculateComfortZone(baseHorse);
    expect(r.temperatureRange.min).toBe(5);
    expect(r.temperatureRange.max).toBe(30);
  });

  it('heat_tolerant trait raises tempMax', () => {
    const horse = { traits: ['heat_tolerant'] };
    const base = calculateComfortZone(baseHorse).temperatureRange.max;
    const tolerant = calculateComfortZone(horse).temperatureRange.max;
    expect(tolerant).toBeGreaterThan(base);
  });

  it('cold_tolerant trait lowers tempMin', () => {
    const horse = { traits: ['cold_tolerant'] };
    const base = calculateComfortZone(baseHorse).temperatureRange.min;
    const tolerant = calculateComfortZone(horse).temperatureRange.min;
    expect(tolerant).toBeLessThan(base);
  });

  it('hardy trait widens both temp and humidity ranges', () => {
    const horse = { traits: ['hardy'] };
    const base = calculateComfortZone(baseHorse);
    const hardy = calculateComfortZone(horse);
    expect(hardy.temperatureRange.min).toBeLessThan(base.temperatureRange.min);
    expect(hardy.temperatureRange.max).toBeGreaterThan(base.temperatureRange.max);
  });

  it('humidity range is always 0-100 bounded', () => {
    const r = calculateComfortZone({ traits: ['desert_adapted'] });
    expect(r.humidityRange.min).toBeGreaterThanOrEqual(0);
    expect(r.humidityRange.max).toBeLessThanOrEqual(100);
  });

  it('optimalConditions.conditions is sunny', () => {
    expect(calculateComfortZone(baseHorse).optimalConditions.conditions).toBe('sunny');
  });
});

// ---------------------------------------------------------------------------
// calculateEnvironmentalTriggers
// ---------------------------------------------------------------------------
describe('calculateEnvironmentalTriggers', () => {
  it('returns expected shape', () => {
    const r = calculateEnvironmentalTriggers(makeSummerDate(), makeLocation(), baseHorse, neutralWeather);
    expect(typeof r.activeTriggersCount).toBe('number');
    expect(Array.isArray(r.triggerTypes)).toBe(true);
    expect(typeof r.intensity).toBe('number');
    expect(typeof r.traitExpressionProbability).toBe('number');
    expect(Array.isArray(r.recommendations)).toBe(true);
  });

  it('traitExpressionProbability is between 0 and 1', () => {
    const r = calculateEnvironmentalTriggers(makeSummerDate(), makeLocation(), baseHorse, neutralWeather);
    expect(r.traitExpressionProbability).toBeGreaterThanOrEqual(0);
    expect(r.traitExpressionProbability).toBeLessThanOrEqual(1);
  });

  it('hot weather triggers heat_stress', () => {
    const hotWeather = { ...neutralWeather, temperature: 40, conditions: 'sunny' };
    const r = calculateEnvironmentalTriggers(makeSummerDate(), makeLocation(), baseHorse, hotWeather);
    expect(r.triggerTypes).toContain('heat_stress');
  });

  it('cold weather triggers cold_stress', () => {
    const coldWeather = { ...neutralWeather, temperature: -10, conditions: 'sunny' };
    const r = calculateEnvironmentalTriggers(makeWinterDate(), makeLocation(), baseHorse, coldWeather);
    expect(r.triggerTypes).toContain('cold_stress');
  });

  it('stormy conditions add storm_stress trigger', () => {
    const stormyWeather = { ...neutralWeather, conditions: 'stormy', precipitation: 0.9, windSpeed: 35 };
    const r = calculateEnvironmentalTriggers(makeSummerDate(), makeLocation(), baseHorse, stormyWeather);
    expect(r.triggerTypes).toContain('storm_stress');
  });

  it('high humidity triggers high_humidity', () => {
    const humidWeather = { ...neutralWeather, humidity: 90 };
    const r = calculateEnvironmentalTriggers(makeSummerDate(), makeLocation(), baseHorse, humidWeather);
    expect(r.triggerTypes).toContain('high_humidity');
  });

  it('calm horse has lower intensity in storm than nervous horse', () => {
    const stormyWeather = { ...neutralWeather, conditions: 'stormy', precipitation: 0.9, windSpeed: 35 };
    const calmHorse = { traits: ['calm'] };
    const nervousHorse = { traits: ['nervous'] };
    const calmResult = calculateEnvironmentalTriggers(makeSummerDate(), makeLocation(), calmHorse, stormyWeather);
    const nervousResult = calculateEnvironmentalTriggers(makeSummerDate(), makeLocation(), nervousHorse, stormyWeather);
    expect(calmResult.intensity).toBeLessThan(nervousResult.intensity);
  });

  it('activeTriggersCount matches triggerTypes length', () => {
    const r = calculateEnvironmentalTriggers(makeSummerDate(), makeLocation(), baseHorse, neutralWeather);
    expect(r.activeTriggersCount).toBe(r.triggerTypes.length);
  });
});

// ---------------------------------------------------------------------------
// calculateEnvironmentalImpact
// ---------------------------------------------------------------------------
describe('calculateEnvironmentalImpact', () => {
  it('returns expected shape', () => {
    const r = calculateEnvironmentalImpact(makeSummerDate(), makeLocation(), baseHorse, neutralWeather);
    expect(typeof r.overallImpact).toBe('number');
    expect(typeof r.healthEffect).toBe('number');
    expect(typeof r.developmentEffect).toBe('number');
    expect(typeof r.performanceEffect).toBe('number');
    expect(typeof r.statModifiers).toBe('object');
    expect(Array.isArray(r.recommendations)).toBe(true);
    expect(Array.isArray(r.triggers)).toBe(true);
  });

  it('overallImpact is clamped to -100..100', () => {
    const r = calculateEnvironmentalImpact(makeSummerDate(), makeLocation(), baseHorse, neutralWeather);
    expect(r.overallImpact).toBeGreaterThanOrEqual(-100);
    expect(r.overallImpact).toBeLessThanOrEqual(100);
  });

  it('healthEffect is clamped to -20..20', () => {
    const r = calculateEnvironmentalImpact(makeSummerDate(), makeLocation(), baseHorse, neutralWeather);
    expect(r.healthEffect).toBeGreaterThanOrEqual(-20);
    expect(r.healthEffect).toBeLessThanOrEqual(20);
  });

  it('statModifiers includes speed, stamina, agility, intelligence', () => {
    const r = calculateEnvironmentalImpact(makeSummerDate(), makeLocation(), baseHorse, neutralWeather);
    expect(typeof r.statModifiers.speed).toBe('number');
    expect(typeof r.statModifiers.stamina).toBe('number');
    expect(typeof r.statModifiers.agility).toBe('number');
    expect(typeof r.statModifiers.intelligence).toBe('number');
  });

  it('stormy weather produces lower overallImpact than sunny', () => {
    const sunnyWeather = { ...neutralWeather, conditions: 'sunny' };
    const stormyWeather = { ...neutralWeather, conditions: 'stormy' };
    const sunny = calculateEnvironmentalImpact(makeSummerDate(), makeLocation(), baseHorse, sunnyWeather);
    const stormy = calculateEnvironmentalImpact(makeSummerDate(), makeLocation(), baseHorse, stormyWeather);
    expect(stormy.overallImpact).toBeLessThan(sunny.overallImpact);
  });
});

// ---------------------------------------------------------------------------
// generateWeatherForecast
// ---------------------------------------------------------------------------
describe('generateWeatherForecast', () => {
  it('returns array with correct number of entries', () => {
    const result = generateWeatherForecast(makeSummerDate(), makeLocation(), 5);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(5);
  });

  it('each forecast entry has expected shape', () => {
    const result = generateWeatherForecast(makeSummerDate(), makeLocation(), 3);
    for (const entry of result) {
      expect(typeof entry.date).toBe('string');
      expect(typeof entry.weather).toBe('object');
      expect(typeof entry.environmentalImpact).toBe('object');
      expect(Array.isArray(entry.recommendations)).toBe(true);
    }
  });

  it('returns empty array for 0 days', () => {
    const result = generateWeatherForecast(makeSummerDate(), makeLocation(), 0);
    expect(result).toHaveLength(0);
  });

  it('dates are sequential (each 1 day apart)', () => {
    const start = new Date('2024-07-01T00:00:00Z');
    const result = generateWeatherForecast(start, makeLocation(), 4);
    for (let i = 1; i < result.length; i++) {
      const prevDate = new Date(result[i - 1].date);
      const currDate = new Date(result[i].date);
      const diffDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(1);
    }
  });

  it('first forecast date matches startDate', () => {
    const start = new Date('2024-07-01T00:00:00Z');
    const result = generateWeatherForecast(start, makeLocation(), 3);
    const firstDate = new Date(result[0].date);
    expect(firstDate.toDateString()).toBe(start.toDateString());
  });
});

// ---------------------------------------------------------------------------
// assessEnvironmentalStress
// ---------------------------------------------------------------------------
describe('assessEnvironmentalStress', () => {
  it('returns expected shape', () => {
    const r = assessEnvironmentalStress(makeSummerDate(), makeLocation(), baseHorse, neutralWeather);
    expect(typeof r.stressLevel).toBe('number');
    expect(Array.isArray(r.stressFactors)).toBe(true);
    expect(typeof r.severity).toBe('string');
    expect(Array.isArray(r.mitigationRecommendations)).toBe(true);
    expect(typeof r.timeToRecovery).toBe('number');
    expect(Array.isArray(r.triggers)).toBe(true);
  });

  it('stressLevel is between 0 and 100', () => {
    const r = assessEnvironmentalStress(makeSummerDate(), makeLocation(), baseHorse, neutralWeather);
    expect(r.stressLevel).toBeGreaterThanOrEqual(0);
    expect(r.stressLevel).toBeLessThanOrEqual(100);
  });

  it('severity is one of low/moderate/high/critical', () => {
    const valid = new Set(['low', 'moderate', 'high', 'critical']);
    const r = assessEnvironmentalStress(makeSummerDate(), makeLocation(), baseHorse, neutralWeather);
    expect(valid.has(r.severity)).toBe(true);
  });

  it('extreme heat weather raises stressLevel', () => {
    const extreme = { ...neutralWeather, temperature: 50, windSpeed: 35, conditions: 'stormy' };
    const normal = assessEnvironmentalStress(makeSummerDate(), makeLocation(), baseHorse, neutralWeather);
    const stressed = assessEnvironmentalStress(makeSummerDate(), makeLocation(), baseHorse, extreme);
    expect(stressed.stressLevel).toBeGreaterThan(normal.stressLevel);
  });

  it('severe weather produces high/critical severity', () => {
    const extreme = { ...neutralWeather, temperature: 50, windSpeed: 35, conditions: 'stormy', humidity: 95 };
    const r = assessEnvironmentalStress(makeSummerDate(), makeLocation(), baseHorse, extreme);
    expect(['high', 'critical']).toContain(r.severity);
  });
});

// ---------------------------------------------------------------------------
// getEnvironmentalHistory
// ---------------------------------------------------------------------------
describe('getEnvironmentalHistory', () => {
  it('returns an array', () => {
    const start = new Date('2024-07-01');
    const end = new Date('2024-07-03');
    const result = getEnvironmentalHistory(start, end, makeLocation());
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns entries from start to end inclusive (3 days)', () => {
    const start = new Date('2024-07-01T00:00:00Z');
    const end = new Date('2024-07-03T00:00:00Z');
    const result = getEnvironmentalHistory(start, end, makeLocation());
    expect(result.length).toBe(3);
  });

  it('each entry has date, weather, seasonalFactors, environmentalQuality', () => {
    const start = new Date('2024-07-01');
    const end = new Date('2024-07-02');
    const result = getEnvironmentalHistory(start, end, makeLocation());
    for (const entry of result) {
      expect(typeof entry.date).toBe('string');
      expect(typeof entry.weather).toBe('object');
      expect(typeof entry.seasonalFactors).toBe('object');
      expect(entry.environmentalQuality !== undefined).toBe(true);
    }
  });

  it('returns empty array when start is after end', () => {
    const start = new Date('2024-07-10');
    const end = new Date('2024-07-01');
    const result = getEnvironmentalHistory(start, end, makeLocation());
    expect(result).toHaveLength(0);
  });

  it('single day returns one entry', () => {
    const date = new Date('2024-07-01');
    const result = getEnvironmentalHistory(date, date, makeLocation());
    expect(result).toHaveLength(1);
  });
});
