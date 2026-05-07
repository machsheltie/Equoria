import { describe, it, expect } from '@jest/globals';
import {
  calculateCurrentWeather,
  getSeasonalFactors,
  calculateComfortZone,
  generateWeatherForecast,
  getEnvironmentalHistory,
} from '../../services/environmentalFactorEngineService.mjs';

// Day-of-year reference (getSeason boundaries):
// spring: day 80-171  (Mar 21 – Jun 20)  → use Apr 15 = day ~105
// summer: day 172-265 (Jun 21 – Sep 22)  → use Jul 15 = day ~196
// autumn: day 266-354 (Sep 23 – Dec 20)  → use Oct 15 = day ~288
// winter: day <80 or >=355              → use Jan 15 = day ~15

const SPRING_DATE = new Date('2025-04-15'); // mid-spring, not near transition
const SUMMER_DATE = new Date('2025-07-15'); // mid-summer, not near transition
const AUTUMN_DATE = new Date('2025-10-15'); // mid-autumn, not near transition
const WINTER_DATE = new Date('2025-01-15'); // mid-winter, not near transition

const LOCATION = {
  latitude: 40,
  longitude: -74,
  region: 'temperate',
  elevation: 0,
};

// ─── getSeasonalFactors ──────────────────────────────────────────────────────

describe('getSeasonalFactors', () => {
  it('returns correct season for spring date', () => {
    const result = getSeasonalFactors(SPRING_DATE);
    expect(result.season).toBe('spring');
  });

  it('returns correct season for summer date', () => {
    const result = getSeasonalFactors(SUMMER_DATE);
    expect(result.season).toBe('summer');
  });

  it('returns correct season for autumn date', () => {
    const result = getSeasonalFactors(AUTUMN_DATE);
    expect(result.season).toBe('autumn');
  });

  it('returns correct season for winter date', () => {
    const result = getSeasonalFactors(WINTER_DATE);
    expect(result.season).toBe('winter');
  });

  it('spring has higher growthModifier than winter', () => {
    const spring = getSeasonalFactors(SPRING_DATE);
    const winter = getSeasonalFactors(WINTER_DATE);
    expect(spring.growthModifier).toBeGreaterThan(winter.growthModifier);
  });

  it('summer has higher stressLevel than spring', () => {
    const summer = getSeasonalFactors(SUMMER_DATE);
    const spring = getSeasonalFactors(SPRING_DATE);
    expect(summer.stressLevel).toBeGreaterThan(spring.stressLevel);
  });

  it('winter has lower trainingEffectiveness than spring', () => {
    const winter = getSeasonalFactors(WINTER_DATE);
    const spring = getSeasonalFactors(SPRING_DATE);
    expect(winter.trainingEffectiveness).toBeLessThan(spring.trainingEffectiveness);
  });

  it('returns dayOfYear as a number', () => {
    const result = getSeasonalFactors(SPRING_DATE);
    expect(typeof result.dayOfYear).toBe('number');
    expect(result.dayOfYear).toBeGreaterThan(0);
    expect(result.dayOfYear).toBeLessThanOrEqual(365);
  });

  it('returns description as a string', () => {
    const result = getSeasonalFactors(SUMMER_DATE);
    expect(typeof result.description).toBe('string');
    expect(result.description.length).toBeGreaterThan(0);
  });

  it('modifiers are finite numbers', () => {
    const result = getSeasonalFactors(SPRING_DATE);
    expect(Number.isFinite(result.growthModifier)).toBe(true);
    expect(Number.isFinite(result.healthModifier)).toBe(true);
    expect(Number.isFinite(result.trainingEffectiveness)).toBe(true);
  });
});

// ─── calculateCurrentWeather ────────────────────────────────────────────────

describe('calculateCurrentWeather', () => {
  it('returns expected fields', () => {
    const result = calculateCurrentWeather(SUMMER_DATE, LOCATION);
    expect(result).toHaveProperty('temperature');
    expect(result).toHaveProperty('humidity');
    expect(result).toHaveProperty('precipitation');
    expect(result).toHaveProperty('windSpeed');
    expect(result).toHaveProperty('pressure');
    expect(result).toHaveProperty('conditions');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('location');
  });

  it('temperature is a finite number', () => {
    const result = calculateCurrentWeather(SPRING_DATE, LOCATION);
    expect(Number.isFinite(result.temperature)).toBe(true);
  });

  it('humidity is between 0 and 100', () => {
    const result = calculateCurrentWeather(SUMMER_DATE, LOCATION);
    expect(result.humidity).toBeGreaterThanOrEqual(0);
    expect(result.humidity).toBeLessThanOrEqual(100);
  });

  it('windSpeed is non-negative', () => {
    const result = calculateCurrentWeather(WINTER_DATE, LOCATION);
    expect(result.windSpeed).toBeGreaterThanOrEqual(0);
  });

  it('timestamp matches input date', () => {
    const result = calculateCurrentWeather(SPRING_DATE, LOCATION);
    expect(result.timestamp).toBe(SPRING_DATE.toISOString());
  });

  it('conditions is a non-empty string', () => {
    const result = calculateCurrentWeather(AUTUMN_DATE, LOCATION);
    expect(typeof result.conditions).toBe('string');
    expect(result.conditions.length).toBeGreaterThan(0);
  });

  it('high-elevation location has lower pressure than sea level', () => {
    const seaLevel = calculateCurrentWeather(SUMMER_DATE, { ...LOCATION, elevation: 0 });
    const mountain = calculateCurrentWeather(SUMMER_DATE, { ...LOCATION, elevation: 3000 });
    expect(mountain.pressure).toBeLessThan(seaLevel.pressure);
  });
});

// ─── calculateComfortZone ────────────────────────────────────────────────────

describe('calculateComfortZone', () => {
  const baseHorse = { traits: [] };

  it('returns temperatureRange and humidityRange', () => {
    const result = calculateComfortZone(baseHorse);
    expect(result.temperatureRange).toHaveProperty('min');
    expect(result.temperatureRange).toHaveProperty('max');
    expect(result.temperatureRange).toHaveProperty('optimal');
    expect(result.humidityRange).toHaveProperty('min');
    expect(result.humidityRange).toHaveProperty('max');
    expect(result.humidityRange).toHaveProperty('optimal');
  });

  it('base horse tempMin=5, tempMax=30, tempOptimal=18', () => {
    const result = calculateComfortZone(baseHorse);
    expect(result.temperatureRange.min).toBe(5);
    expect(result.temperatureRange.max).toBe(30);
    expect(result.temperatureRange.optimal).toBe(18);
  });

  it('heat_tolerant trait raises tempMax and tempOptimal', () => {
    const horse = { traits: ['heat_tolerant'] };
    const base = calculateComfortZone(baseHorse);
    const result = calculateComfortZone(horse);
    expect(result.temperatureRange.max).toBeGreaterThan(base.temperatureRange.max);
    expect(result.temperatureRange.optimal).toBeGreaterThan(base.temperatureRange.optimal);
  });

  it('cold_tolerant trait lowers tempMin', () => {
    const horse = { traits: ['cold_tolerant'] };
    const base = calculateComfortZone(baseHorse);
    const result = calculateComfortZone(horse);
    expect(result.temperatureRange.min).toBeLessThan(base.temperatureRange.min);
  });

  it('heat_sensitive trait lowers tempMax', () => {
    const horse = { traits: ['heat_sensitive'] };
    const base = calculateComfortZone(baseHorse);
    const result = calculateComfortZone(horse);
    expect(result.temperatureRange.max).toBeLessThan(base.temperatureRange.max);
  });

  it('desert_adapted raises both tempMax and humidityMin decreases', () => {
    const horse = { traits: ['desert_adapted'] };
    const base = calculateComfortZone(baseHorse);
    const result = calculateComfortZone(horse);
    expect(result.temperatureRange.max).toBeGreaterThan(base.temperatureRange.max);
    // humidityMin decreases (more tolerant of dry conditions)
    expect(result.humidityRange.min).toBeLessThan(base.humidityRange.min);
  });

  it('humidityRange.min is never below 0', () => {
    const horse = { traits: ['desert_adapted'] };
    const result = calculateComfortZone(horse);
    expect(result.humidityRange.min).toBeGreaterThanOrEqual(0);
  });

  it('humidityRange.max is never above 100', () => {
    const horse = { traits: ['heat_tolerant', 'hardy'] };
    const result = calculateComfortZone(horse);
    expect(result.humidityRange.max).toBeLessThanOrEqual(100);
  });

  it('returns optimalConditions with temperature, humidity, windSpeed, conditions', () => {
    const result = calculateComfortZone(baseHorse);
    expect(result.optimalConditions).toHaveProperty('temperature');
    expect(result.optimalConditions).toHaveProperty('humidity');
    expect(result.optimalConditions).toHaveProperty('windSpeed');
    expect(result.optimalConditions).toHaveProperty('conditions');
  });

  it('returns stressThresholds with temperature and humidity', () => {
    const result = calculateComfortZone(baseHorse);
    expect(result.stressThresholds.temperature).toHaveProperty('low');
    expect(result.stressThresholds.temperature).toHaveProperty('high');
    expect(result.stressThresholds.humidity).toHaveProperty('low');
    expect(result.stressThresholds.humidity).toHaveProperty('high');
  });
});

// ─── generateWeatherForecast ─────────────────────────────────────────────────

describe('generateWeatherForecast', () => {
  it('returns array of length matching days parameter', () => {
    const result = generateWeatherForecast(SPRING_DATE, LOCATION, 5);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(5);
  });

  it('each forecast entry has date, weather, impact, recommendations', () => {
    const result = generateWeatherForecast(SPRING_DATE, LOCATION, 2);
    for (const entry of result) {
      expect(entry).toHaveProperty('date');
      expect(entry).toHaveProperty('weather');
      expect(entry).toHaveProperty('environmentalImpact');
      expect(entry).toHaveProperty('recommendations');
    }
  });

  it('returns empty array for 0 days', () => {
    const result = generateWeatherForecast(SPRING_DATE, LOCATION, 0);
    expect(result).toHaveLength(0);
  });

  it('forecast entries are in chronological order', () => {
    const result = generateWeatherForecast(SUMMER_DATE, LOCATION, 3);
    const dates = result.map(e => new Date(e.date).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeGreaterThan(dates[i - 1]);
    }
  });
});

// ─── getEnvironmentalHistory ─────────────────────────────────────────────────

describe('getEnvironmentalHistory', () => {
  it('returns one entry per day in the range (inclusive)', () => {
    const start = new Date('2025-06-01');
    const end = new Date('2025-06-03');
    const result = getEnvironmentalHistory(start, end, LOCATION);
    expect(result).toHaveLength(3);
  });

  it('each entry has date, weather, seasonalFactors, environmentalQuality', () => {
    const start = new Date('2025-06-01');
    const end = new Date('2025-06-01');
    const [entry] = getEnvironmentalHistory(start, end, LOCATION);
    expect(entry).toHaveProperty('date');
    expect(entry).toHaveProperty('weather');
    expect(entry).toHaveProperty('seasonalFactors');
    expect(entry).toHaveProperty('environmentalQuality');
  });

  it('dates in history are ascending', () => {
    const start = new Date('2025-03-01');
    const end = new Date('2025-03-05');
    const result = getEnvironmentalHistory(start, end, LOCATION);
    const dates = result.map(e => new Date(e.date).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeGreaterThan(dates[i - 1]);
    }
  });

  it('returns empty array when start > end', () => {
    const start = new Date('2025-06-05');
    const end = new Date('2025-06-01');
    const result = getEnvironmentalHistory(start, end, LOCATION);
    expect(result).toHaveLength(0);
  });
});
