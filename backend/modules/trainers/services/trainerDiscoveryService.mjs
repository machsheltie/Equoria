/**
 * Trainer Discovery Service
 * Generates and persists trainer discovery slot trait pools.
 * Persists to the typed `Trainer.discoverySlots` Prisma field (JSONB column
 * `discovery_slots`, backed by migration 20260513140000).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

const DISCIPLINE_TRAITS = {
  Dressage: [
    {
      label: 'Collection Mastery',
      description:
        'Develops exceptional collection and engagement through precise, harmonious aids.',
      icon: '🎯',
      strength: 'mild',
    },
    {
      label: 'Impulsion Expert',
      description: 'Unlocks natural impulsion, creating powerful forward movement without tension.',
      icon: '⚡',
      strength: 'moderate',
    },
  ],
  'Show Jumping': [
    {
      label: 'Stride Assessment',
      description: 'Reads distances intuitively, setting horses up for perfect take-off points.',
      icon: '📏',
      strength: 'mild',
    },
    {
      label: 'Bascule Development',
      description: 'Teaches horses to arch elegantly over fences with textbook jumping form.',
      icon: '🏹',
      strength: 'moderate',
    },
  ],
  'Cross Country': [
    {
      label: 'Terrain Reading',
      description: 'Guides horses confidently through varied cross-country terrain and water.',
      icon: '🗺️',
      strength: 'mild',
    },
    {
      label: 'Bold Confidence',
      description:
        'Builds fearless bravery for complex natural obstacles and challenging conditions.',
      icon: '🦁',
      strength: 'moderate',
    },
  ],
  Western: [
    {
      label: 'Rein Sensitivity',
      description: 'Develops feather-light rein contact and fluid lateral responsiveness.',
      icon: '🤚',
      strength: 'mild',
    },
    {
      label: 'Pattern Fluency',
      description: 'Instils smooth, flowing pattern work and seamless transition cadence.',
      icon: '🔄',
      strength: 'moderate',
    },
  ],
  Eventing: [
    {
      label: 'Phase Mastery',
      description:
        'Optimises seamless transitions between dressage, cross-country, and stadium phases.',
      icon: '🔀',
      strength: 'mild',
    },
    {
      label: 'Endurance Conditioning',
      description:
        'Builds the mental and physical stamina required for demanding three-phase competition.',
      icon: '🌊',
      strength: 'moderate',
    },
  ],
  Racing: [
    {
      label: 'Pace Intelligence',
      description:
        'Teaches horses to conserve energy intelligently for a devastating finishing burst.',
      icon: '⏱️',
      strength: 'mild',
    },
    {
      label: 'Break Speed',
      description: 'Develops explosive gate departure technique for a winning early position.',
      icon: '💨',
      strength: 'moderate',
    },
  ],
};

const PERSONALITY_TRAITS = {
  patient: [
    {
      label: 'Patient Repetition',
      description:
        'Uses calm, methodical repetition to build lasting muscle memory without stress.',
      icon: '🔁',
      strength: 'mild',
    },
    {
      label: 'Stress-Free Learning',
      description: 'Creates low-pressure environments where horses absorb lessons without tension.',
      icon: '😌',
      strength: 'moderate',
    },
  ],
  encouraging: [
    {
      label: 'Confidence Builder',
      description: 'Instils self-belief in timid horses through consistent positive reinforcement.',
      icon: '💪',
      strength: 'mild',
    },
    {
      label: 'Positive Momentum',
      description: 'Maintains forward energy by recognising and celebrating small daily victories.',
      icon: '⬆️',
      strength: 'moderate',
    },
  ],
  technical: [
    {
      label: 'Biomechanics Focus',
      description: 'Analyses and corrects subtle movement inefficiencies at a granular level.',
      icon: '🔬',
      strength: 'mild',
    },
    {
      label: 'Precision Drilling',
      description:
        'Structures each session around exacting technical criteria and measurable improvement.',
      icon: '📐',
      strength: 'moderate',
    },
  ],
  competitive: [
    {
      label: 'Performance Pressure',
      description:
        'Simulates high-stakes competition conditions to sharpen horse focus and response.',
      icon: '🏆',
      strength: 'mild',
    },
    {
      label: 'Peak Timing',
      description:
        'Peaks fitness and mental sharpness to coincide precisely with key competitions.',
      icon: '⏰',
      strength: 'moderate',
    },
  ],
  focused: [
    {
      label: 'Goal Anchoring',
      description: 'Sets clear session objectives and measures every rep against defined targets.',
      icon: '⚓',
      strength: 'mild',
    },
    {
      label: 'Systematic Progress',
      description: 'Follows evidence-based training progressions without deviation or distraction.',
      icon: '📊',
      strength: 'moderate',
    },
  ],
};

const COMPATIBILITY_POOL = [
  {
    label: 'Nervous Horse Whisperer',
    description: 'Earns the trust of anxious horses through calm, entirely predictable routines.',
    icon: '🤫',
    strength: 'mild',
  },
  {
    label: 'Bold Horse Harmoniser',
    description: 'Channels high-energy horses into productive, focused work rather than chaos.',
    icon: '🤝',
    strength: 'moderate',
  },
  {
    label: 'Young Horse Developer',
    description:
      'Specialises in laying correct foundations that set green horses up for long careers.',
    icon: '🌱',
    strength: 'mild',
  },
  {
    label: 'Veteran Horse Respecter',
    description:
      'Adapts training methods to honour experienced horses and protect their longevity.',
    icon: '🏅',
    strength: 'moderate',
  },
  {
    label: 'Mare Specialist',
    description:
      'Understands and works in harmony with the unique temperament and cycles of mares.',
    icon: '🌸',
    strength: 'mild',
  },
  {
    label: 'Stallion Authority',
    description: 'Commands respect from dominant stallions while maintaining genuine partnership.',
    icon: '👑',
    strength: 'strong',
  },
];

const KNOWN_SPECIALITIES = Object.keys(DISCIPLINE_TRAITS);
const KNOWN_PERSONALITIES = Object.keys(PERSONALITY_TRAITS);

/**
 * Generate 6 discovery slots for a trainer based on their speciality and personality.
 * The trait content is deterministic — same speciality + personality always produces
 * the same slots. The compatibility pair is varied by speciality index.
 *
 * @param {string} speciality
 * @param {string} personality
 * @returns {Array<object>} 6 slot descriptors (discovered: false, content pre-seeded)
 */
export function generateDiscoverySlots(speciality, personality) {
  const disciplinePool = DISCIPLINE_TRAITS[speciality] ?? DISCIPLINE_TRAITS[KNOWN_SPECIALITIES[0]];
  const personalityPool =
    PERSONALITY_TRAITS[personality] ?? PERSONALITY_TRAITS[KNOWN_PERSONALITIES[0]];

  const specIdx = KNOWN_SPECIALITIES.indexOf(speciality);
  const safeIdx = specIdx >= 0 ? specIdx : 0;
  const compat1 = COMPATIBILITY_POOL[safeIdx % COMPATIBILITY_POOL.length];
  const compat2 = COMPATIBILITY_POOL[(safeIdx + 1) % COMPATIBILITY_POOL.length];

  return [
    { slotIndex: 0, category: 'discipline_specialization', ...disciplinePool[0] },
    { slotIndex: 1, category: 'discipline_specialization', ...disciplinePool[1] },
    { slotIndex: 2, category: 'training_method', ...personalityPool[0] },
    { slotIndex: 3, category: 'training_method', ...personalityPool[1] },
    { slotIndex: 4, category: 'horse_compatibility', ...compat1 },
    { slotIndex: 5, category: 'horse_compatibility', strength: 'strong', ...compat2 },
  ];
}

/**
 * Read discoverySlots from the DB for a trainer via the typed Prisma client.
 *
 * @param {number} trainerId
 * @returns {Promise<Array>} parsed JSONB array, empty array if not set or row missing
 */
export async function readDiscoverySlots(trainerId) {
  const row = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { discoverySlots: true },
  });
  const raw = row?.discoverySlots;
  // Prisma returns JsonValue — guard against null/non-array (DB default is '[]', but
  // historical rows could theoretically be other shapes; treat anything non-array as empty).
  if (raw === null || raw === undefined) {
    return [];
  }
  return Array.isArray(raw) ? raw : [];
}

/**
 * Write discoverySlots to the DB for a trainer via the typed Prisma client.
 *
 * @param {number} trainerId
 * @param {Array} slots
 */
export async function writeDiscoverySlots(trainerId, slots) {
  await prisma.trainer.update({
    where: { id: trainerId },
    data: { discoverySlots: slots },
  });
}
