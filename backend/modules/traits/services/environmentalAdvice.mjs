/**
 * Environmental advice: the authored care recommendations the environmental
 * engine attaches to its triggers, impact, forecast and stress projections
 * (Equoria-q4uem.7 S3). Pure functions of an already-computed projection; the
 * texts, priorities and effectiveness numbers are authored content owned by the
 * project owner (whether the game offers this advice at all is owner question
 * WS7-Q1). Imported only by environmentalFactorEngineService.mjs.
 */

export function generateTriggerRecommendations(triggers, intensity) {
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
    recommendations.push({ action: 'Improve ventilation', priority: 'medium', effectiveness: 60 });
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

export function generateImpactRecommendations(overallImpact, triggers, seasonalFactors) {
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

export function generateForecastRecommendations(weather, impact) {
  if (impact.severity === 'extreme') {
    return ['Keep horses indoors', 'Cancel outdoor activities'];
  }
  if (impact.severity === 'high') {
    return ['Limit outdoor exposure', 'Monitor horses closely'];
  }
  if (impact.severity === 'moderate') {
    return ['Provide adequate shelter', 'Adjust training intensity'];
  }
  return ['Normal activities can proceed'];
}

export function generateStressMitigationRecommendations(stressLevel, stressFactors, horse) {
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
