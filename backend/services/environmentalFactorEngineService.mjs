/**
 * Environmental Factor Engine Service
 *
 * Core environmental calculation system with weather patterns, seasonal cycles,
 * environmental triggers, and factor calculations affecting horse development and performance.
 */

import logger from '../utils/logger.mjs';

/**
 * Calculate current weather conditions based on date and location
 * @param {Date} date - Current date
 * @param {Object} location - Location data with latitude, longitude, region, elevation
 * @returns {Object} Current weather conditions
 */
export function calculateCurrentWeather(date, location) {
  try {
    logger.info(`[environmentalFactorEngineService.calculateCurrentWeather] Calculating weather for ${date.toISOString()}`);

    const dayOfYear = getDayOfYear(date);
    const { latitude, longitude, region, elevation } = location;

    // Base temperature calculation with seasonal variation
    const baseTemp = calculateBaseTemperature(dayOfYear, latitude, region);

    // Add daily variation and location factors
    const temperature = Math.round((baseTemp + getDailyVariation(date) + getElevationEffect(elevation)) * 10) / 10;

    // Calculate humidity based on season and region
    const humidity = Math.round(calculateHumidity(dayOfYear, region, temperature));

    // Calculate precipitation probability
    const precipitation = calculatePrecipitation(dayOfYear, region, humidity);

    // Calculate wind speed
    const windSpeed = Math.round(calculateWindSpeed(dayOfYear, region, elevation) * 10) / 10;

    // Calculate atmospheric pressure
    const pressure = Math.round(calculatePressure(elevation, temperature) * 10) / 10;

    // Determine weather conditions
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

  } catch (error) {
    logger.error(`[environmentalFactorEngineService.calculateCurrentWeather] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Get seasonal factors affecting horse development
 * @param {Date} date - Current date
 * @returns {Object} Seasonal factors and modifiers
 */
export function getSeasonalFactors(date) {
  try {
    const dayOfYear = getDayOfYear(date);
    const season = getSeason(dayOfYear);

    let growthModifier, healthModifier, trainingEffectiveness, stressLevel, description;

    switch (season) {
      case 'spring':
        growthModifier = 1.2; // 20% growth bonus
        healthModifier = 1.1;
        trainingEffectiveness = 1.15;
        stressLevel = 15;
        description = 'Spring growth period with optimal development conditions';
        break;
      case 'summer':
        growthModifier = 1.0;
        healthModifier = 0.95; // Heat stress
        trainingEffectiveness = 0.9; // Heat reduces training effectiveness
        stressLevel = 35;
        description = 'Summer heat requires careful management and hydration';
        break;
      case 'autumn':
        growthModifier = 1.05;
        healthModifier = 1.05;
        trainingEffectiveness = 1.1;
        stressLevel = 20;
        description = 'Autumn preparation period with moderate conditions';
        break;
      case 'winter':
        growthModifier = 0.9; // Reduced growth
        healthModifier = 0.9; // Cold stress
        trainingEffectiveness = 0.85; // Reduced outdoor training
        stressLevel = 30;
        description = 'Winter challenges requiring shelter and extra care';
        break;
      default:
        growthModifier = 1.0;
        healthModifier = 1.0;
        trainingEffectiveness = 1.0;
        stressLevel = 25;
        description = 'Standard environmental conditions';
    }

    // Add transition effects for season boundaries
    const transitionEffect = getSeasonTransitionEffect(dayOfYear);
    growthModifier *= transitionEffect.growth;
    trainingEffectiveness *= transitionEffect.training;

    return {
      season,
      growthModifier: Math.round(growthModifier * 100) / 100,
      healthModifier: Math.round(healthModifier * 100) / 100,
      trainingEffectiveness: Math.round(trainingEffectiveness * 100) / 100,
      stressLevel: Math.round(stressLevel),
      description,
      dayOfYear,
      transitionEffect: transitionEffect.isTransition,
    };

  } catch (error) {
    logger.error(`[environmentalFactorEngineService.getSeasonalFactors] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate environmental triggers for trait expression
 * @param {Date} date - Current date
 * @param {Object} location - Location data
 * @param {Object} horse - Horse data with traits and stats
 * @param {Object} weather - Optional weather override for testing
 * @returns {Object} Environmental triggers and trait expression data
 */
export function calculateEnvironmentalTriggers(date, location, horse, weather = null) {
  try {
    const currentWeather = weather || calculateCurrentWeather(date, location);
    const seasonalFactors = getSeasonalFactors(date);
    const comfortZone = calculateComfortZone(horse);

    const triggers = [];
    let intensity = 0;

    // Temperature triggers
    if (currentWeather.temperature > comfortZone.temperatureRange.max) {
      triggers.push('heat_stress');
      intensity += Math.min(30, (currentWeather.temperature - comfortZone.temperatureRange.max) * 2);
    } else if (currentWeather.temperature < comfortZone.temperatureRange.min) {
      triggers.push('cold_stress');
      intensity += Math.min(25, (comfortZone.temperatureRange.min - currentWeather.temperature) * 1.5);
    }

    // Humidity triggers
    if (currentWeather.humidity > comfortZone.humidityRange.max) {
      triggers.push('high_humidity');
      intensity += Math.min(20, (currentWeather.humidity - comfortZone.humidityRange.max) * 0.5);
    }

    // Wind triggers
    if (currentWeather.windSpeed > 20) {
      triggers.push('strong_wind');
      intensity += Math.min(15, (currentWeather.windSpeed - 20) * 0.8);
    }

    // Weather condition triggers
    if (currentWeather.conditions === 'stormy') {
      triggers.push('storm_stress');
      intensity += 25;
    } else if (currentWeather.conditions === 'rainy') {
      triggers.push('wet_conditions');
      intensity += 10;
    }

    // Seasonal triggers
    if (seasonalFactors.stressLevel > 30) {
      triggers.push('seasonal_stress');
      intensity += seasonalFactors.stressLevel - 30;
    }

    // Apply trait modifiers
    intensity = applyTraitModifiers(intensity, triggers, horse.traits);

    // Calculate trait expression probability
    const traitExpressionProbability = Math.min(1, intensity / 100);

    // Generate recommendations
    const recommendations = generateTriggerRecommendations(triggers, intensity, horse);

    return {
      activeTriggersCount: triggers.length,
      triggerTypes: triggers,
      intensity: Math.round(intensity),
      traitExpressionProbability: Math.round(traitExpressionProbability * 100) / 100,
      recommendations,
      weather: currentWeather,
      seasonalFactors,
    };

  } catch (error) {
    logger.error(`[environmentalFactorEngineService.calculateEnvironmentalTriggers] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate environmental impact on horse development and performance
 * @param {Date} date - Current date
 * @param {Object} location - Location data
 * @param {Object} horse - Horse data
 * @param {Object} weather - Optional weather override
 * @returns {Object} Environmental impact assessment
 */
export function calculateEnvironmentalImpact(date, location, horse, weather = null) {
  try {
    const currentWeather = weather || calculateCurrentWeather(date, location);
    const seasonalFactors = getSeasonalFactors(date);
    const triggers = calculateEnvironmentalTriggers(date, location, horse, currentWeather);
    const comfortZone = calculateComfortZone(horse);

    // Calculate overall impact score (-100 to +100)
    let overallImpact = 0;

    // Temperature impact
    const tempDiff = Math.abs(currentWeather.temperature - comfortZone.temperatureRange.optimal);
    overallImpact -= tempDiff * 2;

    // Humidity impact
    const humidityDiff = Math.abs(currentWeather.humidity - comfortZone.humidityRange.optimal);
    overallImpact -= humidityDiff * 0.5;

    // Seasonal bonus/penalty
    overallImpact += (seasonalFactors.growthModifier - 1) * 50;

    // Weather condition impact
    const conditionImpact = {
      'sunny': 10,
      'cloudy': 0,
      'rainy': -15,
      'stormy': -30,
      'foggy': -10,
    };
    overallImpact += conditionImpact[currentWeather.conditions] || 0;

    // Apply trait modifiers to overall impact
    overallImpact = applyTraitModifiersToImpact(overallImpact, horse.traits, currentWeather);

    // Calculate stat modifiers
    const statModifiers = calculateStatModifiers(overallImpact, seasonalFactors, triggers);

    // Calculate specific effects
    const healthEffect = Math.round((overallImpact * 0.2) + (seasonalFactors.healthModifier - 1) * 10);
    const developmentEffect = Math.round(overallImpact * 0.5);
    const performanceEffect = Math.round((overallImpact * 0.3) + (seasonalFactors.trainingEffectiveness - 1) * 20);

    // Generate recommendations
    const recommendations = generateImpactRecommendations(overallImpact, triggers, seasonalFactors);

    return {
      overallImpact: Math.round(Math.max(-100, Math.min(100, overallImpact))),
      statModifiers,
      healthEffect: Math.max(-20, Math.min(20, healthEffect)),
      developmentEffect: Math.max(-50, Math.min(50, developmentEffect)),
      performanceEffect: Math.max(-30, Math.min(30, performanceEffect)),
      recommendations,
      weather: currentWeather,
      seasonalFactors,
      triggers: triggers.triggerTypes,
    };

  } catch (error) {
    logger.error(`[environmentalFactorEngineService.calculateEnvironmentalImpact] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Generate weather forecast for planning
 * @param {Date} startDate - Start date for forecast
 * @param {Object} location - Location data
 * @param {number} days - Number of days to forecast
 * @returns {Array} Weather forecast array
 */
export function generateWeatherForecast(startDate, location, days) {
  try {
    const forecast = [];

    for (let i = 0; i < days; i++) {
      const forecastDate = new Date(startDate);
      forecastDate.setDate(forecastDate.getDate() + i);

      const weather = calculateCurrentWeather(forecastDate, location);
      const environmentalImpact = assessForecastImpact(weather);
      const recommendations = generateForecastRecommendations(weather, environmentalImpact);

      forecast.push({
        date: forecastDate.toISOString(),
        weather,
        environmentalImpact,
        recommendations,
      });
    }

    return forecast;

  } catch (error) {
    logger.error(`[environmentalFactorEngineService.generateWeatherForecast] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate horse comfort zone based on traits and preferences
 * @param {Object} horse - Horse data with traits
 * @returns {Object} Comfort zone parameters
 */
export function calculateComfortZone(horse) {
  try {
    // Base comfort zone for average horse
    let tempMin = 5, tempMax = 30, tempOptimal = 18;
    let humidityMin = 30, humidityMax = 70, humidityOptimal = 50;

    // Adjust based on traits
    if (horse.traits.includes('heat_tolerant')) {
      tempMax += 8;
      tempOptimal += 5;
      humidityMax += 15;
    }

    if (horse.traits.includes('cold_tolerant')) {
      tempMin -= 10;
      tempOptimal -= 3;
    }

    if (horse.traits.includes('desert_adapted')) {
      tempMax += 12;
      tempOptimal += 8;
      humidityMin -= 10;
      humidityOptimal -= 15;
    }

    if (horse.traits.includes('heat_sensitive')) {
      tempMax -= 5;
      tempOptimal -= 3;
      humidityMax -= 10;
    }

    if (horse.traits.includes('hardy')) {
      tempMin -= 5;
      tempMax += 5;
      humidityMin -= 5;
      humidityMax += 10;
    }

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

  } catch (error) {
    logger.error(`[environmentalFactorEngineService.calculateComfortZone] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Assess environmental stress levels for a horse
 * @param {Date} date - Current date
 * @param {Object} location - Location data
 * @param {Object} horse - Horse data
 * @param {Object} weather - Optional weather override
 * @returns {Object} Stress assessment
 */
export function assessEnvironmentalStress(date, location, horse, weather = null) {
  try {
    const currentWeather = weather || calculateCurrentWeather(date, location);
    const triggers = calculateEnvironmentalTriggers(date, location, horse, currentWeather);
    const comfortZone = calculateComfortZone(horse);

    let stressLevel = 0;
    const stressFactors = [];

    // Temperature stress
    if (currentWeather.temperature > comfortZone.stressThresholds.temperature.high) {
      stressLevel += 30;
      stressFactors.push('Extreme heat exposure');
    } else if (currentWeather.temperature < comfortZone.stressThresholds.temperature.low) {
      stressLevel += 25;
      stressFactors.push('Extreme cold exposure');
    }

    // Humidity stress
    if (currentWeather.humidity > comfortZone.stressThresholds.humidity.high) {
      stressLevel += 20;
      stressFactors.push('High humidity stress');
    }

    // Wind stress
    if (currentWeather.windSpeed > comfortZone.stressThresholds.windSpeed) {
      stressLevel += 15;
      stressFactors.push('Strong wind stress');
    }

    // Weather condition stress
    if (currentWeather.conditions === 'stormy') {
      stressLevel += 25;
      stressFactors.push('Storm-related stress');
    }

    // Add trigger intensity
    stressLevel += triggers.intensity * 0.5;

    // Apply trait modifiers
    stressLevel = applyStressTraitModifiers(stressLevel, horse.traits);

    // Determine severity
    let severity;
    if (stressLevel >= 80) { severity = 'critical'; } else if (stressLevel >= 60) { severity = 'high'; } else if (stressLevel >= 30) { severity = 'moderate'; } else { severity = 'low'; }

    // Generate mitigation recommendations
    const mitigationRecommendations = generateStressMitigationRecommendations(stressLevel, stressFactors, horse);

    // Calculate recovery time
    const timeToRecovery = calculateRecoveryTime(stressLevel, horse);

    return {
      stressLevel: Math.round(Math.min(100, stressLevel)),
      stressFactors,
      severity,
      mitigationRecommendations,
      timeToRecovery,
      triggers: triggers.triggerTypes,
      weather: currentWeather,
    };

  } catch (error) {
    logger.error(`[environmentalFactorEngineService.assessEnvironmentalStress] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Get environmental history (placeholder for future database integration)
 * @param {Date} startDate - Start date for history
 * @param {Date} endDate - End date for history
 * @param {Object} location - Location data
 * @returns {Array} Environmental history data
 */
export function getEnvironmentalHistory(startDate, endDate, location) {
  try {
    // This would typically query a database of historical weather data
    // For now, return simulated historical data
    const history = [];
    let currentDate = new Date(startDate);
    const finalDate = new Date(endDate);

    while (currentDate <= finalDate) {
      const weather = calculateCurrentWeather(currentDate, location);
      const seasonalFactors = getSeasonalFactors(currentDate);

      history.push({
        date: currentDate.toISOString(),
        weather,
        seasonalFactors,
        environmentalQuality: calculateEnvironmentalQuality(weather, seasonalFactors),
      });

      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return history;

  } catch (error) {
    logger.error(`[environmentalFactorEngineService.getEnvironmentalHistory] Error: ${error.message}`);
    throw error;
  }
}

// ===== HELPER FUNCTIONS =====

/**
 * Get day of year (1-365)
 * @param {Date} date - Date to convert
 * @returns {number} Day of year
 */
function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Calculate base temperature for location and season
 * @param {number} dayOfYear - Day of year
 * @param {number} latitude - Latitude
 * @param {string} region - Region type
 * @returns {number} Base temperature
 */
function calculateBaseTemperature(dayOfYear, latitude, region) {
  // Seasonal temperature curve - peak summer around day 196 (July 15)
  const seasonalVariation = 15 * Math.sin((dayOfYear - 80) * 2 * Math.PI / 365);

  // Base temperature by region
  const regionBase = {
    'tropical': 28,
    'temperate': 15,
    'arctic': -5,
    'desert': 25,
    'coastal': 18,
  };

  const base = regionBase[region] || 15;

  // Latitude effect (simplified)
  const latitudeEffect = -Math.abs(latitude) * 0.3;

  return base + seasonalVariation + latitudeEffect;
}

/**
 * Get daily temperature variation
 * @param {Date} date - Current date
 * @returns {number} Daily variation
 */
function getDailyVariation(date) {
  // Pseudo-random daily variation based on date
  const seed = date.getTime() / (1000 * 60 * 60 * 24);
  const random = Math.sin(seed) * Math.cos(seed * 1.5);
  return random * 8; // ±8 degrees variation
}

/**
 * Calculate elevation effect on temperature
 * @param {number} elevation - Elevation in meters
 * @returns {number} Temperature adjustment
 */
function getElevationEffect(elevation) {
  // Temperature decreases ~6.5°C per 1000m elevation
  return -(elevation / 1000) * 6.5;
}

/**
 * Calculate humidity based on season and region
 * @param {number} dayOfYear - Day of year
 * @param {string} region - Region type
 * @param {number} temperature - Current temperature
 * @returns {number} Humidity percentage
 */
function calculateHumidity(dayOfYear, region, temperature) {
  const regionHumidity = {
    'tropical': 80,
    'temperate': 60,
    'arctic': 70,
    'desert': 25,
    'coastal': 75,
  };

  const baseHumidity = regionHumidity[region] || 60;

  // Seasonal variation
  const seasonalVariation = 15 * Math.sin((dayOfYear - 120) * 2 * Math.PI / 365);

  // Temperature effect (higher temp = lower humidity in dry regions)
  const tempEffect = region === 'desert' ? -(temperature - 20) * 0.5 : 0;

  return Math.max(10, Math.min(95, baseHumidity + seasonalVariation + tempEffect));
}

/**
 * Calculate precipitation probability
 * @param {number} dayOfYear - Day of year
 * @param {string} region - Region type
 * @param {number} humidity - Current humidity
 * @returns {number} Precipitation probability
 */
function calculatePrecipitation(dayOfYear, region, humidity) {
  const regionPrecip = {
    'tropical': 0.4,
    'temperate': 0.3,
    'arctic': 0.2,
    'desert': 0.05,
    'coastal': 0.35,
  };

  const basePrecip = regionPrecip[region] || 0.3;
  const humidityEffect = (humidity - 50) * 0.01;

  return Math.max(0, Math.min(1, basePrecip + humidityEffect));
}

/**
 * Calculate wind speed
 * @param {number} dayOfYear - Day of year
 * @param {string} region - Region type
 * @param {number} elevation - Elevation
 * @returns {number} Wind speed in km/h
 */
function calculateWindSpeed(dayOfYear, region, elevation) {
  const regionWind = {
    'tropical': 12,
    'temperate': 15,
    'arctic': 20,
    'desert': 18,
    'coastal': 22,
  };

  const baseWind = regionWind[region] || 15;
  const elevationEffect = elevation * 0.01;
  const seasonalVariation = 5 * Math.sin((dayOfYear - 60) * 2 * Math.PI / 365);

  return Math.max(0, baseWind + elevationEffect + seasonalVariation);
}

/**
 * Calculate atmospheric pressure
 * @param {number} elevation - Elevation in meters
 * @param {number} temperature - Temperature
 * @returns {number} Pressure in hPa
 */
function calculatePressure(elevation, temperature) {
  // Standard pressure at sea level: 1013.25 hPa
  const seaLevelPressure = 1013.25;

  // Pressure decreases with elevation
  const elevationEffect = -(elevation / 8.5); // Approximate scale height

  // Temperature effect (simplified)
  const tempEffect = (temperature - 15) * 0.5;

  return seaLevelPressure + elevationEffect + tempEffect;
}

/**
 * Determine weather conditions based on parameters
 * @param {number} temperature - Temperature
 * @param {number} humidity - Humidity
 * @param {number} precipitation - Precipitation probability
 * @param {number} windSpeed - Wind speed
 * @returns {string} Weather condition
 */
function determineWeatherConditions(temperature, humidity, precipitation, windSpeed) {
  if (precipitation > 0.7 && windSpeed > 25) { return 'stormy'; }
  if (precipitation > 0.4) { return 'rainy'; }
  if (humidity < 30 && temperature > 25) { return 'sunny'; }
  if (humidity > 85) { return 'foggy'; }
  if (humidity > 70) { return 'cloudy'; }
  return 'sunny';
}

/**
 * Get season based on day of year
 * @param {number} dayOfYear - Day of year
 * @returns {string} Season name
 */
function getSeason(dayOfYear) {
  if (dayOfYear >= 80 && dayOfYear < 172) { return 'spring'; } // Mar 21 - Jun 20
  if (dayOfYear >= 172 && dayOfYear < 266) { return 'summer'; } // Jun 21 - Sep 22
  if (dayOfYear >= 266 && dayOfYear < 355) { return 'autumn'; } // Sep 23 - Dec 20
  return 'winter'; // Dec 21 - Mar 20
}

/**
 * Get season transition effects
 * @param {number} dayOfYear - Day of year
 * @returns {Object} Transition effects
 */
function getSeasonTransitionEffect(dayOfYear) {
  const transitionDays = 10; // Days around season change
  const seasonBoundaries = [80, 172, 266, 355]; // Season start days

  for (const boundary of seasonBoundaries) {
    let distance = Math.abs(dayOfYear - boundary);

    // Handle year wrap-around for winter boundary
    if (boundary === 355 && dayOfYear < 80) {
      distance = Math.min(distance, Math.abs(dayOfYear + 365 - boundary));
    }

    if (distance <= transitionDays) {
      const intensity = 1 - (distance / transitionDays);

      // Different effects based on which season we're transitioning to
      let growthEffect = 0.1;
      if (boundary === 80) { // Spring transition - stronger growth effect
        growthEffect = 0.2;
      } else if (boundary === 355) { // Winter transition - negative growth effect
        growthEffect = -0.1;
      }

      return {
        isTransition: true,
        growth: 1 + (intensity * growthEffect),
        training: 1 + (intensity * 0.05),
      };
    }
  }

  return {
    isTransition: false,
    growth: 1.0,
    training: 1.0,
  };
}

/**
 * Apply trait modifiers to trigger intensity
 * @param {number} intensity - Base intensity
 * @param {Array} triggers - Active triggers
 * @param {Array} traits - Horse traits
 * @returns {number} Modified intensity
 */
function applyTraitModifiers(intensity, triggers, traits) {
  let modifier = 1.0;

  if (traits.includes('calm') && triggers.includes('storm_stress')) {
    modifier *= 0.7; // Calm horses handle storms better
  }

  if (traits.includes('nervous') && triggers.length > 0) {
    modifier *= 1.3; // Nervous horses are more affected by triggers
  }

  if (traits.includes('heat_tolerant') && triggers.includes('heat_stress')) {
    modifier *= 0.5; // Heat tolerant horses handle heat better
  }

  if (traits.includes('cold_tolerant') && triggers.includes('cold_stress')) {
    modifier *= 0.5; // Cold tolerant horses handle cold better
  }

  if (traits.includes('hardy')) {
    modifier *= 0.8; // Hardy horses are generally more resilient
  }

  return intensity * modifier;
}

/**
 * Generate trigger recommendations
 * @param {Array} triggers - Active triggers
 * @param {number} intensity - Trigger intensity
 * @param {Object} horse - Horse data
 * @returns {Array} Recommendations
 */
function generateTriggerRecommendations(triggers, intensity, _horse) {
  const recommendations = [];

  if (triggers.includes('heat_stress')) {
    recommendations.push({
      action: 'Provide shade and extra water',
      priority: intensity > 50 ? 'high' : 'medium',
      effectiveness: 80,
    });
  }

  if (triggers.includes('cold_stress')) {
    recommendations.push({
      action: 'Provide shelter and blankets',
      priority: intensity > 40 ? 'high' : 'medium',
      effectiveness: 75,
    });
  }

  if (triggers.includes('storm_stress')) {
    recommendations.push({
      action: 'Move to indoor shelter',
      priority: 'critical',
      effectiveness: 90,
    });
  }

  if (triggers.includes('high_humidity')) {
    recommendations.push({
      action: 'Improve ventilation',
      priority: 'medium',
      effectiveness: 60,
    });
  }

  if (intensity > 60) {
    recommendations.push({
      action: 'Monitor horse closely for stress signs',
      priority: 'high',
      effectiveness: 70,
    });
  }

  return recommendations;
}

/**
 * Apply trait modifiers to environmental impact
 * @param {number} impact - Base impact
 * @param {Array} traits - Horse traits
 * @param {Object} weather - Weather conditions
 * @returns {number} Modified impact
 */
function applyTraitModifiersToImpact(impact, traits, weather) {
  let modifier = 1.0;

  if (traits.includes('adaptable')) {
    modifier *= 0.9; // Adaptable horses handle environmental changes better
  }

  if (traits.includes('sensitive')) {
    modifier *= 1.2; // Sensitive horses are more affected by environment
  }

  if (weather.temperature > 30 && traits.includes('heat_tolerant')) {
    modifier *= 0.7; // Heat tolerant bonus in hot weather
  }

  if (weather.temperature < 10 && traits.includes('cold_tolerant')) {
    modifier *= 0.7; // Cold tolerant bonus in cold weather
  }

  return impact * modifier;
}

/**
 * Calculate stat modifiers based on environmental impact
 * @param {number} overallImpact - Overall environmental impact
 * @param {Object} seasonalFactors - Seasonal factors
 * @param {Object} triggers - Environmental triggers
 * @returns {Object} Stat modifiers
 */
function calculateStatModifiers(overallImpact, seasonalFactors, _triggers) {
  const baseModifier = overallImpact / 100; // Convert to decimal

  return {
    speed: Math.round((baseModifier * 0.8 + (seasonalFactors.trainingEffectiveness - 1) * 0.5) * 100) / 100,
    stamina: Math.round((baseModifier * 1.2 + (seasonalFactors.healthModifier - 1) * 0.8) * 100) / 100,
    agility: Math.round((baseModifier * 0.9 + (seasonalFactors.trainingEffectiveness - 1) * 0.6) * 100) / 100,
    intelligence: Math.round((baseModifier * 0.6) * 100) / 100,
  };
}

/**
 * Generate impact recommendations
 * @param {number} overallImpact - Overall impact score
 * @param {Object} triggers - Environmental triggers
 * @param {Object} seasonalFactors - Seasonal factors
 * @returns {Array} Recommendations
 */
function generateImpactRecommendations(overallImpact, triggers, seasonalFactors) {
  const recommendations = [];

  if (overallImpact < -50) {
    recommendations.push({
      action: 'Consider facility improvements',
      priority: 'high',
      reason: 'Poor environmental conditions affecting horse development',
    });
  }

  if (seasonalFactors.season === 'winter' && seasonalFactors.stressLevel > 30) {
    recommendations.push({
      action: 'Increase feed rations and provide warm shelter',
      priority: 'medium',
      reason: 'Winter conditions require additional care',
    });
  }

  if (seasonalFactors.season === 'summer' && triggers.triggerTypes.includes('heat_stress')) {
    recommendations.push({
      action: 'Adjust training schedule to cooler hours',
      priority: 'high',
      reason: 'Heat stress can impact performance and health',
    });
  }

  if (overallImpact > 30) {
    recommendations.push({
      action: 'Take advantage of optimal conditions for training',
      priority: 'low',
      reason: 'Favorable environmental conditions support development',
    });
  }

  return recommendations;
}

/**
 * Assess forecast impact severity
 * @param {Object} weather - Weather conditions
 * @returns {Object} Impact assessment
 */
function assessForecastImpact(weather) {
  let severity = 'low';
  let score = 0;

  // Temperature extremes
  if (weather.temperature > 35 || weather.temperature < 0) {
    score += 30;
    severity = 'high';
  } else if (weather.temperature > 30 || weather.temperature < 5) {
    score += 15;
    severity = 'moderate';
  }

  // High humidity
  if (weather.humidity > 85) {
    score += 15;
    if (severity === 'low') { severity = 'moderate'; }
  }

  // Strong winds
  if (weather.windSpeed > 25) {
    score += 20;
    severity = 'high';
  }

  // Severe weather conditions
  if (weather.conditions === 'stormy') {
    score += 25;
    severity = 'extreme';
  }

  return {
    severity,
    score: Math.min(100, score),
    factors: {
      temperature: weather.temperature > 35 || weather.temperature < 0,
      humidity: weather.humidity > 85,
      wind: weather.windSpeed > 25,
      conditions: weather.conditions === 'stormy',
    },
  };
}

/**
 * Generate forecast recommendations
 * @param {Object} weather - Weather conditions
 * @param {Object} impact - Impact assessment
 * @returns {Array} Recommendations
 */
function generateForecastRecommendations(weather, impact) {
  const recommendations = [];

  if (impact.severity === 'extreme') {
    recommendations.push('Keep horses indoors');
    recommendations.push('Cancel outdoor activities');
  } else if (impact.severity === 'high') {
    recommendations.push('Limit outdoor exposure');
    recommendations.push('Monitor horses closely');
  } else if (impact.severity === 'moderate') {
    recommendations.push('Provide adequate shelter');
    recommendations.push('Adjust training intensity');
  } else {
    recommendations.push('Normal activities can proceed');
  }

  return recommendations;
}

/**
 * Apply stress trait modifiers
 * @param {number} stressLevel - Base stress level
 * @param {Array} traits - Horse traits
 * @returns {number} Modified stress level
 */
function applyStressTraitModifiers(stressLevel, traits) {
  let modifier = 1.0;

  if (traits.includes('calm')) { modifier *= 0.8; }
  if (traits.includes('nervous')) { modifier *= 1.3; }
  if (traits.includes('hardy')) { modifier *= 0.7; }
  if (traits.includes('sensitive')) { modifier *= 1.2; }
  if (traits.includes('resilient')) { modifier *= 0.6; }

  return stressLevel * modifier;
}

/**
 * Generate stress mitigation recommendations
 * @param {number} stressLevel - Stress level
 * @param {Array} stressFactors - Stress factors
 * @param {Object} horse - Horse data
 * @returns {Array} Mitigation recommendations
 */
function generateStressMitigationRecommendations(stressLevel, stressFactors, horse) {
  const recommendations = [];

  if (stressFactors.includes('Extreme heat exposure')) {
    recommendations.push({
      action: 'Provide immediate cooling (fans, cold water)',
      priority: 'critical',
      effectiveness: 85,
    });
  }

  if (stressFactors.includes('Extreme cold exposure')) {
    recommendations.push({
      action: 'Move to heated shelter immediately',
      priority: 'critical',
      effectiveness: 90,
    });
  }

  if (stressFactors.includes('Storm-related stress')) {
    recommendations.push({
      action: 'Provide calm, secure indoor environment',
      priority: 'high',
      effectiveness: 80,
    });
  }

  if (stressLevel > 60) {
    recommendations.push({
      action: 'Reduce training intensity',
      priority: 'high',
      effectiveness: 70,
    });

    recommendations.push({
      action: 'Increase monitoring frequency',
      priority: 'medium',
      effectiveness: 60,
    });
  }

  if (horse.traits.includes('nervous') && stressLevel > 40) {
    recommendations.push({
      action: 'Provide calming supplements or techniques',
      priority: 'medium',
      effectiveness: 65,
    });
  }

  return recommendations;
}

/**
 * Calculate recovery time from environmental stress
 * @param {number} stressLevel - Current stress level
 * @param {Object} horse - Horse data
 * @returns {number} Recovery time in hours
 */
function calculateRecoveryTime(stressLevel, horse) {
  let baseRecovery = stressLevel * 0.5; // Base: 0.5 hours per stress point

  // Trait modifiers
  if (horse.traits.includes('hardy')) { baseRecovery *= 0.7; }
  if (horse.traits.includes('resilient')) { baseRecovery *= 0.6; }
  if (horse.traits.includes('sensitive')) { baseRecovery *= 1.3; }
  if (horse.traits.includes('calm')) { baseRecovery *= 0.8; }

  // Age factor (younger horses recover faster)
  const ageFactor = horse.age > 15 ? 1.2 : horse.age < 5 ? 0.8 : 1.0;
  baseRecovery *= ageFactor;

  // Health factor
  const healthFactor = horse.health > 80 ? 0.9 : horse.health < 60 ? 1.2 : 1.0;
  baseRecovery *= healthFactor;

  return Math.round(Math.max(1, baseRecovery));
}

/**
 * Calculate environmental quality score
 * @param {Object} weather - Weather conditions
 * @param {Object} seasonalFactors - Seasonal factors
 * @returns {number} Environmental quality score (0-100)
 */
function calculateEnvironmentalQuality(weather, seasonalFactors) {
  let quality = 50; // Base quality

  // Temperature quality (optimal around 18-22°C)
  const tempOptimal = 20;
  const tempDiff = Math.abs(weather.temperature - tempOptimal);
  quality -= tempDiff * 2;

  // Humidity quality (optimal around 50-60%)
  const humidityOptimal = 55;
  const humidityDiff = Math.abs(weather.humidity - humidityOptimal);
  quality -= humidityDiff * 0.5;

  // Wind quality (light breeze is optimal)
  if (weather.windSpeed < 5) {
    quality -= 5; // Too still
  } else if (weather.windSpeed > 20) {
    quality -= (weather.windSpeed - 20) * 1.5; // Too windy
  } else {
    quality += 5; // Good breeze
  }

  // Weather condition quality
  const conditionQuality = {
    'sunny': 10,
    'cloudy': 5,
    'rainy': -10,
    'stormy': -25,
    'foggy': -5,
  };
  quality += conditionQuality[weather.conditions] || 0;

  // Seasonal quality
  quality += (seasonalFactors.growthModifier - 1) * 20;
  quality -= seasonalFactors.stressLevel * 0.5;

  return Math.round(Math.max(0, Math.min(100, quality)));
}
