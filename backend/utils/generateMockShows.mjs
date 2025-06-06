import { getAllDisciplines } from './statMap.mjs';

/**
 * Generate mock shows for testing and seeding purposes
 * @param {number} count - Number of shows to generate
 * @returns {Array} - Array of mock show objects
 */
function generateMockShows(count = 10) {
  if (typeof count !== 'number' || count < 0) {
    throw new Error('Count must be a non-negative number');
  }

  const shows = [];
  const disciplines = getAllDisciplines();

  // Word banks for generating realistic show names
  const seasons = ['Spring', 'Summer', 'Fall', 'Winter', 'Autumn'];
  const adjectives = [
    'Classic',
    'Championship',
    'Premier',
    'Elite',
    'Grand',
    'Royal',
    'National',
    'Regional',
    'Open',
    'Invitational',
    'Masters',
    'Thunder',
    'Lightning',
    'Golden',
    'Silver',
    'Diamond',
    'Emerald',
    'Sunset',
    'Dawn',
    'Midnight',
  ];

  for (let i = 0; i < count; i++) {
    // Randomly select discipline
    const discipline = disciplines[Math.floor(Math.random() * disciplines.length)];

    // Generate show name
    const season = seasons[Math.floor(Math.random() * seasons.length)];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const name = `${season} ${adjective} - ${discipline}`;

    // Generate level range (levelMin: 1-7, levelMax: levelMin+1 to max 10)
    const levelMin = Math.floor(Math.random() * 7) + 1; // 1-7
    const maxPossibleLevel = Math.min(10, levelMin + 3); // levelMin+1 to levelMin+3, max 10
    const levelMax = Math.floor(Math.random() * (maxPossibleLevel - levelMin)) + levelMin + 1;

    // Generate entry fee (100-500)
    const entryFee = Math.floor(Math.random() * 401) + 100; // 100-500

    // Generate prize (500-2000)
    const prize = Math.floor(Math.random() * 1501) + 500; // 500-2000

    // Generate run date (±30 days from today)
    const today = new Date();
    const daysOffset = Math.floor(Math.random() * 61) - 30; // -30 to +30 days
    const runDate = new Date(today);
    runDate.setDate(today.getDate() + daysOffset);

    shows.push({
      id: i + 1, // Simple incrementing ID
      name,
      discipline,
      levelMin,
      levelMax,
      entryFee,
      prize,
      runDate,
    });
  }

  return shows;
}

/**
 * Generate a single mock show with specific parameters (useful for testing)
 * @param {Object} overrides - Object with properties to override defaults
 * @returns {Object} - Single mock show object
 */
function generateSingleMockShow(overrides = {}) {
  const shows = generateMockShows(1);
  return { ...shows[0], ...overrides };
}

export { generateMockShows, generateSingleMockShow };
