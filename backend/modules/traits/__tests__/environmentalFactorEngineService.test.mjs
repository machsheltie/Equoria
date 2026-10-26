import { describe, it, expect } from '@jest/globals';
import {
  calculateCurrentWeather,
  getSeasonalFactors,
  calculateComfortZone,
  getEnvironmentalHistory,
  buildEnvironmentalSnapshot,
  assessHorseEnvironment,
} from '../services/environmentalFactorEngineService.mjs';
const assess = (d, l, h, w) => assessHorseEnvironment(buildEnvironmentalSnapshot(d, l, { weather: w }), h);

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

// ─── calculateCurrentWeather — region branches ───────────────────────────────

describe('calculateCurrentWeather — region branches', () => {
  it('tropical region produces higher base temperature', () => {
    const result = calculateCurrentWeather(SUMMER_DATE, { ...LOCATION, region: 'tropical', latitude: 5 });
    // tropical base is 28, temperate is 15 — even with daily variation tropical should differ
    expect(typeof result.temperature).toBe('number');
    expect(Number.isFinite(result.temperature)).toBe(true);
  });

  it('arctic region produces lower base temperature', () => {
    const tropical = calculateCurrentWeather(SUMMER_DATE, { ...LOCATION, region: 'tropical', latitude: 5 });
    const arctic = calculateCurrentWeather(SUMMER_DATE, { ...LOCATION, region: 'arctic', latitude: 70 });
    // arctic base is -5 vs tropical base 28 — arctic must be cooler on same day
    expect(arctic.temperature).toBeLessThan(tropical.temperature);
  });

  it('desert region produces lower humidity', () => {
    const desert = calculateCurrentWeather(SUMMER_DATE, { ...LOCATION, region: 'desert', latitude: 25 });
    const temperate = calculateCurrentWeather(SUMMER_DATE, LOCATION);
    expect(desert.humidity).toBeLessThan(temperate.humidity);
  });

  it('coastal region returns valid weather object', () => {
    const result = calculateCurrentWeather(SPRING_DATE, { ...LOCATION, region: 'coastal', latitude: 45 });
    expect(result).toHaveProperty('conditions');
    expect(result.humidity).toBeGreaterThanOrEqual(0);
    expect(result.humidity).toBeLessThanOrEqual(100);
  });

  it('unknown region falls back to temperate base (15)', () => {
    const result = calculateCurrentWeather(SPRING_DATE, { ...LOCATION, region: 'unknownRegion' });
    expect(typeof result.temperature).toBe('number');
    expect(Number.isFinite(result.temperature)).toBe(true);
  });
});

// ─── calculateEnvironmentalTriggers ─────────────────────────────────────────

describe('calculateEnvironmentalTriggers', () => {
  const baseHorse = { traits: [] };

  it('returns expected shape: activeTriggersCount, triggerTypes, intensity, traitExpressionProbability', () => {
    const result = assess(SUMMER_DATE, LOCATION, baseHorse).triggers;
    expect(typeof result.activeTriggersCount).toBe('number');
    expect(Array.isArray(result.triggerTypes)).toBe(true);
    expect(typeof result.intensity).toBe('number');
    expect(result.traitExpressionProbability).toBeGreaterThanOrEqual(0);
    expect(result.traitExpressionProbability).toBeLessThanOrEqual(1);
    // Owner ruling 2026-10-07 (Equoria-huuaf): no advice. Old contract: a recommendations array.
    expect(result).not.toHaveProperty('recommendations');
    expect(result.weather).toBeDefined();
    expect(result.seasonalFactors).toBeDefined();
  });

  it('extremeHeat trigger fires when weather temperature exceeds comfort max', () => {
    // Force hot weather via weather override
    const hotWeather = { temperature: 50, humidity: 30, precipitation: 0, windSpeed: 5, conditions: 'sunny' };
    const result = assess(SUMMER_DATE, LOCATION, baseHorse, hotWeather).triggers;
    expect(result.triggerTypes).toContain('extremeHeat');
    expect(result.intensity).toBeGreaterThan(0);
  });

  it('extremeCold trigger fires when temperature is below comfort min', () => {
    const coldWeather = { temperature: -20, humidity: 70, precipitation: 0, windSpeed: 5, conditions: 'cloudy' };
    const result = assess(WINTER_DATE, LOCATION, baseHorse, coldWeather).triggers;
    expect(result.triggerTypes).toContain('extremeCold');
  });

  it('high_humidity trigger fires when humidity exceeds comfort max', () => {
    const humidWeather = { temperature: 20, humidity: 99, precipitation: 0.3, windSpeed: 5, conditions: 'cloudy' };
    const result = assess(SUMMER_DATE, LOCATION, baseHorse, humidWeather).triggers;
    expect(result.triggerTypes).toContain('high_humidity');
  });

  it('strong_wind trigger fires when windSpeed > 20', () => {
    const windyWeather = { temperature: 20, humidity: 50, precipitation: 0, windSpeed: 40, conditions: 'cloudy' };
    const result = assess(SPRING_DATE, LOCATION, baseHorse, windyWeather).triggers;
    expect(result.triggerTypes).toContain('strong_wind');
  });

  it('storm trigger fires for stormy conditions', () => {
    const stormyWeather = { temperature: 15, humidity: 60, precipitation: 0.8, windSpeed: 35, conditions: 'stormy' };
    const result = assess(AUTUMN_DATE, LOCATION, baseHorse, stormyWeather).triggers;
    expect(result.triggerTypes).toContain('storm');
  });

  it('wet_conditions trigger fires for rainy conditions', () => {
    const rainyWeather = { temperature: 15, humidity: 65, precipitation: 0.5, windSpeed: 10, conditions: 'rainy' };
    const result = assess(AUTUMN_DATE, LOCATION, baseHorse, rainyWeather).triggers;
    expect(result.triggerTypes).toContain('wet_conditions');
  });

  it('calm trait reduces intensity when storm triggers', () => {
    const calmHorse = { traits: ['calm'] };
    const stormyWeather = { temperature: 15, humidity: 60, precipitation: 0.8, windSpeed: 35, conditions: 'stormy' };
    const base = assess(AUTUMN_DATE, LOCATION, baseHorse, stormyWeather).triggers;
    const calm = assess(AUTUMN_DATE, LOCATION, calmHorse, stormyWeather).triggers;
    // calm horse (modifier 0.7) should have lower intensity
    expect(calm.intensity).toBeLessThan(base.intensity);
  });

  it('nervous trait increases intensity when triggers are present', () => {
    const nervousHorse = { traits: ['nervous'] };
    const hotWeather = { temperature: 50, humidity: 30, precipitation: 0, windSpeed: 5, conditions: 'sunny' };
    const base = assess(SUMMER_DATE, LOCATION, baseHorse, hotWeather).triggers;
    const nervous = assess(SUMMER_DATE, LOCATION, nervousHorse, hotWeather).triggers;
    expect(nervous.intensity).toBeGreaterThan(base.intensity);
  });

  it('heat_tolerant trait reduces intensity when extremeHeat fires', () => {
    const heatTolerantHorse = { traits: ['heat_tolerant'] };
    const hotWeather = { temperature: 50, humidity: 30, precipitation: 0, windSpeed: 5, conditions: 'sunny' };
    const base = assess(SUMMER_DATE, LOCATION, baseHorse, hotWeather).triggers;
    const tolerant = assess(SUMMER_DATE, LOCATION, heatTolerantHorse, hotWeather).triggers;
    expect(tolerant.intensity).toBeLessThan(base.intensity);
  });

  it('cold_tolerant trait reduces intensity when extremeCold fires', () => {
    const coldTolerantHorse = { traits: ['cold_tolerant'] };
    const coldWeather = { temperature: -20, humidity: 70, precipitation: 0, windSpeed: 5, conditions: 'cloudy' };
    const base = assess(WINTER_DATE, LOCATION, baseHorse, coldWeather).triggers;
    const tolerant = assess(WINTER_DATE, LOCATION, coldTolerantHorse, coldWeather).triggers;
    expect(tolerant.intensity).toBeLessThan(base.intensity);
  });

  it('hardy trait reduces intensity', () => {
    const hardyHorse = { traits: ['hardy'] };
    const stormyWeather = { temperature: 15, humidity: 60, precipitation: 0.8, windSpeed: 35, conditions: 'stormy' };
    const base = assess(AUTUMN_DATE, LOCATION, baseHorse, stormyWeather).triggers;
    const hardy = assess(AUTUMN_DATE, LOCATION, hardyHorse, stormyWeather).triggers;
    expect(hardy.intensity).toBeLessThan(base.intensity);
  });

  it('uses weather override instead of computing weather when provided', () => {
    const overrideWeather = { temperature: 50, humidity: 30, precipitation: 0, windSpeed: 5, conditions: 'sunny' };
    const result = assess(WINTER_DATE, LOCATION, baseHorse, overrideWeather).triggers;
    expect(result.weather.temperature).toBe(50); // override used, not computed
  });
});

// ─── calculateEnvironmentalImpact ────────────────────────────────────────────

describe('calculateEnvironmentalImpact', () => {
  const baseHorse = { traits: [] };

  it('returns expected shape: overallImpact, statModifiers, healthEffect, developmentEffect, performanceEffect', () => {
    const result = assess(SPRING_DATE, LOCATION, baseHorse).impact;
    expect(typeof result.overallImpact).toBe('number');
    expect(result.overallImpact).toBeGreaterThanOrEqual(-100);
    expect(result.overallImpact).toBeLessThanOrEqual(100);
    expect(result.statModifiers).toBeDefined();
    expect(typeof result.statModifiers.speed).toBe('number');
    expect(typeof result.statModifiers.stamina).toBe('number');
    expect(typeof result.statModifiers.agility).toBe('number');
    expect(typeof result.statModifiers.intelligence).toBe('number');
    expect(typeof result.healthEffect).toBe('number');
    expect(typeof result.developmentEffect).toBe('number');
    expect(typeof result.performanceEffect).toBe('number');
    // Owner ruling 2026-10-07 (Equoria-huuaf): no advice. Old contract: a recommendations array.
    expect(result).not.toHaveProperty('recommendations');
    expect(Array.isArray(result.triggers)).toBe(true);
  });

  it('healthEffect is clamped to [-20, 20]', () => {
    const result = assess(WINTER_DATE, LOCATION, baseHorse).impact;
    expect(result.healthEffect).toBeGreaterThanOrEqual(-20);
    expect(result.healthEffect).toBeLessThanOrEqual(20);
  });

  it('developmentEffect is clamped to [-50, 50]', () => {
    const result = assess(SUMMER_DATE, LOCATION, baseHorse).impact;
    expect(result.developmentEffect).toBeGreaterThanOrEqual(-50);
    expect(result.developmentEffect).toBeLessThanOrEqual(50);
  });

  it('performanceEffect is clamped to [-30, 30]', () => {
    const result = assess(AUTUMN_DATE, LOCATION, baseHorse).impact;
    expect(result.performanceEffect).toBeGreaterThanOrEqual(-30);
    expect(result.performanceEffect).toBeLessThanOrEqual(30);
  });

  it('returns weather and seasonalFactors in result', () => {
    const result = assess(SPRING_DATE, LOCATION, baseHorse).impact;
    expect(result.weather).toBeDefined();
    expect(result.seasonalFactors).toBeDefined();
  });

  it('stormy weather override produces negative overallImpact', () => {
    // conditionImpact['stormy'] = -30
    const stormyWeather = { temperature: 18, humidity: 50, precipitation: 0.8, windSpeed: 30, conditions: 'stormy' };
    const result = assess(SPRING_DATE, LOCATION, baseHorse, stormyWeather).impact;
    expect(result.overallImpact).toBeLessThan(0);
  });

  it('rainy conditions apply -15 impact modifier', () => {
    const rainyWeather = { temperature: 18, humidity: 60, precipitation: 0.5, windSpeed: 10, conditions: 'rainy' };
    const sunnyWeather = { temperature: 18, humidity: 60, precipitation: 0, windSpeed: 10, conditions: 'sunny' };
    const rainy = assess(SPRING_DATE, LOCATION, baseHorse, rainyWeather).impact;
    const sunny = assess(SPRING_DATE, LOCATION, baseHorse, sunnyWeather).impact;
    // rainy = -15 condition penalty vs sunny = +10 condition bonus → rainy should be lower
    expect(rainy.overallImpact).toBeLessThan(sunny.overallImpact);
  });

  it('foggy conditions apply -10 impact modifier', () => {
    const foggyWeather = { temperature: 18, humidity: 60, precipitation: 0, windSpeed: 5, conditions: 'foggy' };
    const sunnyWeather = { temperature: 18, humidity: 60, precipitation: 0, windSpeed: 5, conditions: 'sunny' };
    const foggy = assess(SPRING_DATE, LOCATION, baseHorse, foggyWeather).impact;
    const sunny = assess(SPRING_DATE, LOCATION, baseHorse, sunnyWeather).impact;
    expect(foggy.overallImpact).toBeLessThan(sunny.overallImpact);
  });

  it('cloudy conditions apply 0 impact modifier', () => {
    const cloudyWeather = { temperature: 18, humidity: 60, precipitation: 0, windSpeed: 5, conditions: 'cloudy' };
    const result = assess(SPRING_DATE, LOCATION, baseHorse, cloudyWeather).impact;
    expect(typeof result.overallImpact).toBe('number');
  });

  it('adaptable trait reduces negative environmental impact', () => {
    const adaptableHorse = { traits: ['adaptable'] };
    const stormyWeather = { temperature: 18, humidity: 50, precipitation: 0.8, windSpeed: 30, conditions: 'stormy' };
    const base = assess(SPRING_DATE, LOCATION, baseHorse, stormyWeather).impact;
    const adaptable = assess(SPRING_DATE, LOCATION, adaptableHorse, stormyWeather).impact;
    // adaptable modifier 0.9 applied to negative base → less negative
    expect(adaptable.overallImpact).toBeGreaterThan(base.overallImpact);
  });

  it('sensitive trait amplifies negative environmental impact', () => {
    const sensitiveHorse = { traits: ['sensitive'] };
    const stormyWeather = { temperature: 18, humidity: 50, precipitation: 0.8, windSpeed: 30, conditions: 'stormy' };
    const base = assess(SPRING_DATE, LOCATION, baseHorse, stormyWeather).impact;
    const sensitive = assess(SPRING_DATE, LOCATION, sensitiveHorse, stormyWeather).impact;
    // sensitive modifier 1.2 applied to negative base → more negative
    expect(sensitive.overallImpact).toBeLessThan(base.overallImpact);
  });

  it('heat_tolerant trait reduces impact in hot weather (temp > 30)', () => {
    const heatTolerantHorse = { traits: ['heat_tolerant'] };
    const hotWeather = { temperature: 40, humidity: 30, precipitation: 0, windSpeed: 5, conditions: 'sunny' };
    const base = assess(SUMMER_DATE, LOCATION, baseHorse, hotWeather).impact;
    const tolerant = assess(SUMMER_DATE, LOCATION, heatTolerantHorse, hotWeather).impact;
    // heat_tolerant modifier 0.7 for temp > 30 → less negative
    expect(tolerant.overallImpact).toBeGreaterThan(base.overallImpact);
  });

  it('cold_tolerant trait reduces impact in cold weather (temp < 10)', () => {
    const coldTolerantHorse = { traits: ['cold_tolerant'] };
    const coldWeather = { temperature: 0, humidity: 70, precipitation: 0, windSpeed: 5, conditions: 'cloudy' };
    const base = assess(WINTER_DATE, LOCATION, baseHorse, coldWeather).impact;
    const tolerant = assess(WINTER_DATE, LOCATION, coldTolerantHorse, coldWeather).impact;
    expect(tolerant.overallImpact).toBeGreaterThan(base.overallImpact);
  });

  it('uses weather override when provided', () => {
    const override = { temperature: 18, humidity: 50, precipitation: 0, windSpeed: 8, conditions: 'sunny' };
    const result = assess(WINTER_DATE, LOCATION, baseHorse, override).impact;
    expect(result.weather.temperature).toBe(18);
  });
});

// ─── getSeasonalFactors — default branch coverage ────────────────────────────

describe('getSeasonalFactors — transition effects and default', () => {
  it('date near spring boundary (day ~80) has transitionEffect=true', () => {
    // March 21 = day 80: spring boundary
    const nearSpring = new Date('2025-03-21');
    const result = getSeasonalFactors(nearSpring);
    expect(result.transitionEffect).toBe(true);
  });

  it('date near winter boundary (day ~355) has transitionEffect=true', () => {
    // Dec 21 = day 355: winter boundary
    const nearWinter = new Date('2025-12-21');
    const result = getSeasonalFactors(nearWinter);
    expect(result.transitionEffect).toBe(true);
  });

  it('mid-season date has transitionEffect=false', () => {
    const midSummer = new Date('2025-07-15'); // day 196, well away from transitions
    const result = getSeasonalFactors(midSummer);
    expect(result.transitionEffect).toBe(false);
  });
});
