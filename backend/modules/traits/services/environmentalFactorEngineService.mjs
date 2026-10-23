/**
 * Environmental Factor Engine Service
 *
 * A deterministic environment computed from date + location (Equoria-q4uem.7 S3):
 *
 *   date + location (+ optional weather override)
 *     -> buildEnvironmentalSnapshot        { date, location, weather, seasonal }
 *     -> assessHorseEnvironment(snapshot, horse)
 *          comfort zone once, triggers once; impact and stress consume them
 *   getEnvironmentalHistory                             day-by-day projections
 *
 * Weather, seasonal factors and the comfort zone are pure projections that the
 * snapshot and the assessment are built from. Nothing here reads the database
 * or Math.random. The authored climate and comfort data live in
 * environmentalPolicy.mjs.
 */

import logger from '../../../utils/logger.mjs';
import {
  COMFORT_BASE,
  COMFORT_TRAIT_ADJUSTMENTS,
  CONDITION_IMPACT,
  CONDITION_QUALITY,
  DEFAULT_BASE_TEMPERATURE,
  DEFAULT_HUMIDITY,
  DEFAULT_PRECIPITATION,
  DEFAULT_TRANSITION_GROWTH_EFFECT,
  DEFAULT_WIND_SPEED,
  IMPACT_TRAIT_FACTORS,
  RECOVERY_TRAIT_FACTORS,
  REGION_BASE_TEMPERATURE,
  REGION_HUMIDITY,
  REGION_PRECIPITATION,
  REGION_WIND_SPEED,
  SEASON_FACTORS,
  SEASON_STARTS,
  STRESS_TRAIT_FACTORS,
  TRANSITION_BOUNDARIES,
  TRANSITION_DAYS,
  TRANSITION_GROWTH_EFFECT,
  TRANSITION_TRAINING_EFFECT,
  TRIGGER_TRAIT_FACTORS,
  traitFactorProduct,
} from './environmentalPolicy.mjs';

/**
 * The one environment for a date and place. Every horse assessed against this
 * snapshot sees the same weather and season.
 * @param {Date} date
 * @param {{latitude:number, longitude:number, region:string, elevation:number}} location
 * @param {{weather?: object}} [options] weather override (testing, forecasts)
 * @returns {Readonly<{date: Date, location: object, weather: object, seasonal: object}>}
 */
export function buildEnvironmentalSnapshot(date, location, { weather } = {}) {
  return Object.freeze({
    date,
    location,
    weather: weather || calculateCurrentWeather(date, location),
    seasonal: getSeasonalFactors(date),
  });
}

/**
 * Assess one horse against a snapshot: comfort zone, trait-expression triggers,
 * development/performance impact and stress, each computed once.
 * @param {ReturnType<typeof buildEnvironmentalSnapshot>} snapshot
 * @param {{traits: string[], age?: number, health?: number}} horse
 * @returns {{comfortZone: object, triggers: object, impact: object, stress: object}}
 */
export function assessHorseEnvironment(snapshot, horse) {
  const comfortZone = calculateComfortZone(horse);
  const triggers = projectTriggers(snapshot, horse, comfortZone);
  return {
    comfortZone,
    triggers,
    impact: projectImpact(snapshot, horse, comfortZone, triggers),
    stress: projectStress(snapshot, horse, comfortZone, triggers),
  };
}

/** Weather at a date and location ({latitude, longitude, region, elevation}). Pure. */
export function calculateCurrentWeather(date, location) {
  logger.info(
    `[environmentalFactorEngineService.calculateCurrentWeather] Calculating weather for ${date.toISOString()}`,
  );

  const dayOfYear = getDayOfYear(date);
  const { latitude, longitude, region, elevation } = location;
  const baseTemp = calculateBaseTemperature(dayOfYear, latitude, region);
  const temperature =
    Math.round((baseTemp + getDailyVariation(date) + getElevationEffect(elevation)) * 10) / 10;
  const humidity = Math.round(calculateHumidity(dayOfYear, region, temperature));
  const precipitation = calculatePrecipitation(dayOfYear, region, humidity);
  const windSpeed = Math.round(calculateWindSpeed(dayOfYear, region, elevation) * 10) / 10;
  const pressure = Math.round(calculatePressure(elevation, temperature) * 10) / 10;
  const conditions = determineWeatherConditions(temperature, humidity, precipitation, windSpeed);

  return {
    temperature,
    humidity,
    precipitation,
    windSpeed,
    pressure,
    conditions,
    timestamp: date.toISOString(),
    location: `${latitude}, ${longitude}`,
  };
}

/** Season, its development modifiers and any season-change transition at a date. Pure. */
export function getSeasonalFactors(date) {
  const dayOfYear = getDayOfYear(date);
  const season = getSeason(dayOfYear);
  const factors = SEASON_FACTORS[season];
  let { growthModifier, trainingEffectiveness } = factors;

  // Transition effects at season boundaries
  const transitionEffect = getSeasonTransitionEffect(dayOfYear);
  growthModifier *= transitionEffect.growth;
  trainingEffectiveness *= transitionEffect.training;

  return {
    season,
    growthModifier: Math.round(growthModifier * 100) / 100,
    healthModifier: Math.round(factors.healthModifier * 100) / 100,
    trainingEffectiveness: Math.round(trainingEffectiveness * 100) / 100,
    stressLevel: Math.round(factors.stressLevel),
    description: factors.description,
    dayOfYear,
    transitionEffect: transitionEffect.isTransition,
  };
}

/** A horse's temperature/humidity comfort zone and stress thresholds from its traits. Pure. */
export function calculateComfortZone(horse) {
  const zone = { ...COMFORT_BASE };
  for (const [trait, adjustment] of COMFORT_TRAIT_ADJUSTMENTS) {
    if (horse.traits.includes(trait)) {
      for (const [field, delta] of Object.entries(adjustment)) {
        zone[field] += delta;
      }
    }
  }
  const { tempMin, tempMax, tempOptimal, humidityMin, humidityMax, humidityOptimal } = zone;

  return {
    temperatureRange: {
      min: tempMin,
      max: tempMax,
      optimal: tempOptimal,
    },
    humidityRange: {
      min: Math.max(0, humidityMin),
      max: Math.min(100, humidityMax),
      optimal: humidityOptimal,
    },
    optimalConditions: {
      temperature: tempOptimal,
      humidity: humidityOptimal,
      windSpeed: 8,
      conditions: 'sunny',
    },
    stressThresholds: {
      temperature: { low: tempMin - 5, high: tempMax + 5 },
      humidity: { low: humidityMin - 10, high: humidityMax + 15 },
      windSpeed: 25,
    },
  };
}

/**
 * One computed entry per calendar day from startDate to endDate (inclusive):
 * weather, season and environmental quality (Equoria-axad9.1). Not stored data
 * and not random: the same range and location always give the same output, and
 * `/environment/history` serves it as the game's environmental model.
 */
export function getEnvironmentalHistory(startDate, endDate, location) {
  const history = [];
  let currentDate = new Date(startDate);
  const finalDate = new Date(endDate);

  while (currentDate <= finalDate) {
    const { weather, seasonal } = buildEnvironmentalSnapshot(currentDate, location);

    history.push({
      date: currentDate.toISOString(),
      weather,
      seasonalFactors: seasonal,
      environmentalQuality: calculateEnvironmentalQuality(weather, seasonal),
    });

    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return history;
}

// ===== HORSE PROJECTIONS (one snapshot, one comfort zone, one trigger result) =====

function projectTriggers({ weather, seasonal }, horse, comfortZone) {
  const triggers = [];
  let intensity = 0;

  // Temperature triggers
  if (weather.temperature > comfortZone.temperatureRange.max) {
    triggers.push('heat_stress');
    intensity += Math.min(30, (weather.temperature - comfortZone.temperatureRange.max) * 2);
  } else if (weather.temperature < comfortZone.temperatureRange.min) {
    triggers.push('cold_stress');
    intensity += Math.min(25, (comfortZone.temperatureRange.min - weather.temperature) * 1.5);
  }

  if (weather.humidity > comfortZone.humidityRange.max) {
    triggers.push('high_humidity');
    intensity += Math.min(20, (weather.humidity - comfortZone.humidityRange.max) * 0.5);
  }

  if (weather.windSpeed > 20) {
    triggers.push('strong_wind');
    intensity += Math.min(15, (weather.windSpeed - 20) * 0.8);
  }

  if (weather.conditions === 'stormy') {
    triggers.push('storm_stress');
    intensity += 25;
  } else if (weather.conditions === 'rainy') {
    triggers.push('wet_conditions');
    intensity += 10;
  }

  if (seasonal.stressLevel > 30) {
    triggers.push('seasonal_stress');
    intensity += seasonal.stressLevel - 30;
  }

  intensity *= traitFactorProduct(TRIGGER_TRAIT_FACTORS, horse.traits, { triggers });
  const traitExpressionProbability = Math.min(1, intensity / 100);

  return {
    activeTriggersCount: triggers.length,
    triggerTypes: triggers,
    intensity: Math.round(intensity),
    traitExpressionProbability: Math.round(traitExpressionProbability * 100) / 100,
    weather,
    seasonalFactors: seasonal,
  };
}

function projectImpact({ weather, seasonal }, horse, comfortZone, triggers) {
  // Overall impact score (-100 to +100)
  let overallImpact = 0;
  const tempDiff = Math.abs(weather.temperature - comfortZone.temperatureRange.optimal);
  overallImpact -= tempDiff * 2;
  const humidityDiff = Math.abs(weather.humidity - comfortZone.humidityRange.optimal);
  overallImpact -= humidityDiff * 0.5;
  overallImpact += (seasonal.growthModifier - 1) * 50;
  overallImpact += CONDITION_IMPACT[weather.conditions] || 0;
  overallImpact *= traitFactorProduct(IMPACT_TRAIT_FACTORS, horse.traits, { weather });

  const statModifiers = calculateStatModifiers(overallImpact, seasonal);
  const healthEffect = Math.round(overallImpact * 0.2 + (seasonal.healthModifier - 1) * 10);
  const developmentEffect = Math.round(overallImpact * 0.5);
  const performanceEffect = Math.round(
    overallImpact * 0.3 + (seasonal.trainingEffectiveness - 1) * 20,
  );

  return {
    overallImpact: Math.round(Math.max(-100, Math.min(100, overallImpact))),
    statModifiers,
    healthEffect: Math.max(-20, Math.min(20, healthEffect)),
    developmentEffect: Math.max(-50, Math.min(50, developmentEffect)),
    performanceEffect: Math.max(-30, Math.min(30, performanceEffect)),
    weather,
    seasonalFactors: seasonal,
    triggers: triggers.triggerTypes,
  };
}

function projectStress({ weather }, horse, comfortZone, triggers) {
  let stressLevel = 0;
  const stressFactors = [];

  if (weather.temperature > comfortZone.stressThresholds.temperature.high) {
    stressLevel += 30;
    stressFactors.push('Extreme heat exposure');
  } else if (weather.temperature < comfortZone.stressThresholds.temperature.low) {
    stressLevel += 25;
    stressFactors.push('Extreme cold exposure');
  }
  if (weather.humidity > comfortZone.stressThresholds.humidity.high) {
    stressLevel += 20;
    stressFactors.push('High humidity stress');
  }
  if (weather.windSpeed > comfortZone.stressThresholds.windSpeed) {
    stressLevel += 15;
    stressFactors.push('Strong wind stress');
  }
  if (weather.conditions === 'stormy') {
    stressLevel += 25;
    stressFactors.push('Storm-related stress');
  }

  // The ROUNDED trigger intensity, as returned by the triggers projection
  stressLevel += triggers.intensity * 0.5;
  stressLevel *= traitFactorProduct(STRESS_TRAIT_FACTORS, horse.traits);

  let severity;
  if (stressLevel >= 80) {
    severity = 'critical';
  } else if (stressLevel >= 60) {
    severity = 'high';
  } else if (stressLevel >= 30) {
    severity = 'moderate';
  } else {
    severity = 'low';
  }

  return {
    stressLevel: Math.round(Math.min(100, stressLevel)),
    stressFactors,
    severity,
    timeToRecovery: calculateRecoveryTime(stressLevel, horse),
    triggers: triggers.triggerTypes,
    weather,
  };
}

// ===== WEATHER AND SEASON HELPERS =====

function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function calculateBaseTemperature(dayOfYear, latitude, region) {
  // Seasonal temperature curve - peak summer around day 196 (July 15)
  const seasonalVariation = 15 * Math.sin(((dayOfYear - 80) * 2 * Math.PI) / 365);
  const base = REGION_BASE_TEMPERATURE[region] || DEFAULT_BASE_TEMPERATURE;
  const latitudeEffect = -Math.abs(latitude) * 0.3;
  return base + seasonalVariation + latitudeEffect;
}

function getDailyVariation(date) {
  // Pseudo-random daily variation based on date: ±8 degrees
  const seed = date.getTime() / (1000 * 60 * 60 * 24);
  const random = Math.sin(seed) * Math.cos(seed * 1.5);
  return random * 8;
}

function getElevationEffect(elevation) {
  // Temperature decreases ~6.5°C per 1000m elevation
  return -(elevation / 1000) * 6.5;
}

function calculateHumidity(dayOfYear, region, temperature) {
  const baseHumidity = REGION_HUMIDITY[region] || DEFAULT_HUMIDITY;
  const seasonalVariation = 15 * Math.sin(((dayOfYear - 120) * 2 * Math.PI) / 365);
  // Higher temperature lowers humidity in the desert
  const tempEffect = region === 'desert' ? -(temperature - 20) * 0.5 : 0;
  return Math.max(10, Math.min(95, baseHumidity + seasonalVariation + tempEffect));
}

function calculatePrecipitation(dayOfYear, region, humidity) {
  const basePrecip = REGION_PRECIPITATION[region] || DEFAULT_PRECIPITATION;
  const humidityEffect = (humidity - 50) * 0.01;
  return Math.max(0, Math.min(1, basePrecip + humidityEffect));
}

function calculateWindSpeed(dayOfYear, region, elevation) {
  const baseWind = REGION_WIND_SPEED[region] || DEFAULT_WIND_SPEED;
  const elevationEffect = elevation * 0.01;
  const seasonalVariation = 5 * Math.sin(((dayOfYear - 60) * 2 * Math.PI) / 365);
  return Math.max(0, baseWind + elevationEffect + seasonalVariation);
}

function calculatePressure(elevation, temperature) {
  // Sea-level 1013.25 hPa; falls with elevation; simplified temperature effect
  const seaLevelPressure = 1013.25;
  const elevationEffect = -(elevation / 8.5);
  const tempEffect = (temperature - 15) * 0.5;
  return seaLevelPressure + elevationEffect + tempEffect;
}

function determineWeatherConditions(temperature, humidity, precipitation, windSpeed) {
  if (precipitation > 0.7 && windSpeed > 25) {
    return 'stormy';
  }
  if (precipitation > 0.4) {
    return 'rainy';
  }
  if (humidity < 30 && temperature > 25) {
    return 'sunny';
  }
  if (humidity > 85) {
    return 'foggy';
  }
  if (humidity > 70) {
    return 'cloudy';
  }
  return 'sunny';
}

function getSeason(dayOfYear) {
  if (dayOfYear >= SEASON_STARTS.spring && dayOfYear < SEASON_STARTS.summer) {
    return 'spring';
  }
  if (dayOfYear >= SEASON_STARTS.summer && dayOfYear < SEASON_STARTS.autumn) {
    return 'summer';
  }
  if (dayOfYear >= SEASON_STARTS.autumn && dayOfYear < SEASON_STARTS.winter) {
    return 'autumn';
  }
  return 'winter';
}

function getSeasonTransitionEffect(dayOfYear) {
  for (const boundary of TRANSITION_BOUNDARIES) {
    let distance = Math.abs(dayOfYear - boundary);

    // Year wrap-around for the winter boundary
    if (boundary === 355 && dayOfYear < 80) {
      distance = Math.min(distance, Math.abs(dayOfYear + 365 - boundary));
    }

    if (distance <= TRANSITION_DAYS) {
      const intensity = 1 - distance / TRANSITION_DAYS;
      const growthEffect = TRANSITION_GROWTH_EFFECT[boundary] ?? DEFAULT_TRANSITION_GROWTH_EFFECT;
      return {
        isTransition: true,
        growth: 1 + intensity * growthEffect,
        training: 1 + intensity * TRANSITION_TRAINING_EFFECT,
      };
    }
  }

  return { isTransition: false, growth: 1.0, training: 1.0 };
}

// ===== TRAIT MODIFIERS =====

function calculateStatModifiers(overallImpact, seasonalFactors) {
  const baseModifier = overallImpact / 100;
  return {
    speed:
      Math.round((baseModifier * 0.8 + (seasonalFactors.trainingEffectiveness - 1) * 0.5) * 100) /
      100,
    stamina:
      Math.round((baseModifier * 1.2 + (seasonalFactors.healthModifier - 1) * 0.8) * 100) / 100,
    agility:
      Math.round((baseModifier * 0.9 + (seasonalFactors.trainingEffectiveness - 1) * 0.6) * 100) /
      100,
    intelligence: Math.round(baseModifier * 0.6 * 100) / 100,
  };
}

function calculateRecoveryTime(stressLevel, horse) {
  // Base: 0.5 hours per stress point, scaled by traits, age and health. Each
  // factor multiplies the running value in turn, exactly as before S3 (a product
  // of factors could differ in the last bit before the whole-hour rounding).
  let baseRecovery = stressLevel * 0.5;
  for (const [trait, factor] of RECOVERY_TRAIT_FACTORS) {
    if (horse.traits.includes(trait)) {
      baseRecovery *= factor;
    }
  }
  const ageFactor = horse.age > 15 ? 1.2 : horse.age < 5 ? 0.8 : 1.0;
  baseRecovery *= ageFactor;
  const healthFactor = horse.health > 80 ? 0.9 : horse.health < 60 ? 1.2 : 1.0;
  baseRecovery *= healthFactor;
  return Math.round(Math.max(1, baseRecovery));
}

function calculateEnvironmentalQuality(weather, seasonalFactors) {
  let quality = 50;

  // Temperature (optimal around 18-22°C) and humidity (optimal 50-60%)
  quality -= Math.abs(weather.temperature - 20) * 2;
  quality -= Math.abs(weather.humidity - 55) * 0.5;

  // Wind: a light breeze is optimal
  if (weather.windSpeed < 5) {
    quality -= 5;
  } else if (weather.windSpeed > 20) {
    quality -= (weather.windSpeed - 20) * 1.5;
  } else {
    quality += 5;
  }

  quality += CONDITION_QUALITY[weather.conditions] || 0;
  quality += (seasonalFactors.growthModifier - 1) * 20;
  quality -= seasonalFactors.stressLevel * 0.5;

  return Math.round(Math.max(0, Math.min(100, quality)));
}
