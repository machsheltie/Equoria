/**
 * Groom Task Types for Story 7-3 (Task Assignment UI)
 *
 * Defines task data for groom task assignment UI, mirroring backend groomConfig.mjs.
 * Includes age eligibility, durations, effects, and category groupings.
 *
 * Task categories:
 * - Enrichment (0-2 years): Epigenetic trait development and bonding
 * - Foal Grooming (1-3 years): Grooming behavior and presentation prep
 * - General Grooming (3+ years): Burnout prevention for adult horses
 */

export type TaskCategory = 'enrichment' | 'foal_grooming' | 'general_grooming';

export interface TaskEffect {
  label: string;
  type: 'positive' | 'neutral';
}

export interface TaskInfo {
  id: string;
  name: string;
  category: TaskCategory;
  minAge: number;
  maxAge?: number; // undefined = no upper limit
  recommendedDurationMinutes: number;
  effects: TaskEffect[];
  description: string;
}

/** Age thresholds matching backend groomConfig.mjs constants */
export const TASK_AGE_THRESHOLDS = {
  FOAL_ENRICHMENT_MIN: 0,
  FOAL_ENRICHMENT_MAX: 2,
  FOAL_GROOMING_MIN: 1,
  FOAL_GROOMING_MAX: 3,
  GENERAL_GROOMING_MIN: 3,
} as const;

/** All task definitions with durations and effects */
export const TASK_DATA: TaskInfo[] = [
  // Foal Enrichment Tasks (0-2 years)
  {
    id: 'desensitization',
    name: 'Desensitization',
    category: 'enrichment',
    minAge: TASK_AGE_THRESHOLDS.FOAL_ENRICHMENT_MIN,
    maxAge: TASK_AGE_THRESHOLDS.FOAL_ENRICHMENT_MAX,
    recommendedDurationMinutes: 30,
    effects: [
      { label: 'Reduces fear response', type: 'positive' },
      { label: 'Develops bold trait', type: 'positive' },
      { label: 'Improves bond score', type: 'positive' },
    ],
    description: 'Expose the foal to new stimuli in a controlled, safe environment.',
  },
  {
    id: 'trust_building',
    name: 'Trust Building',
    category: 'enrichment',
    minAge: TASK_AGE_THRESHOLDS.FOAL_ENRICHMENT_MIN,
    maxAge: TASK_AGE_THRESHOLDS.FOAL_ENRICHMENT_MAX,
    recommendedDurationMinutes: 45,
    effects: [
      { label: 'Increases bond score', type: 'positive' },
      { label: 'Reduces stress level', type: 'positive' },
      { label: 'Develops gentle trait', type: 'positive' },
    ],
    description: 'Build a foundation of trust through calm, consistent interaction.',
  },
  {
    id: 'showground_exposure',
    name: 'Showground Exposure',
    category: 'enrichment',
    minAge: TASK_AGE_THRESHOLDS.FOAL_ENRICHMENT_MIN,
    maxAge: TASK_AGE_THRESHOLDS.FOAL_ENRICHMENT_MAX,
    recommendedDurationMinutes: 60,
    effects: [
      { label: 'Builds confidence in crowds', type: 'positive' },
      { label: 'Develops competition readiness', type: 'positive' },
    ],
    description: 'Introduce the foal to the sights, sounds, and smells of competitions.',
  },
  {
    id: 'early_touch',
    name: 'Early Touch',
    category: 'enrichment',
    minAge: TASK_AGE_THRESHOLDS.FOAL_ENRICHMENT_MIN,
    maxAge: TASK_AGE_THRESHOLDS.FOAL_ENRICHMENT_MAX,
    recommendedDurationMinutes: 20,
    effects: [
      { label: 'Improves handling tolerance', type: 'positive' },
      { label: 'Increases bond score', type: 'positive' },
    ],
    description: 'Gentle handling of legs, hooves, and face to normalize human touch.',
  },
  {
    id: 'gentle_touch',
    name: 'Gentle Touch',
    category: 'enrichment',
    minAge: TASK_AGE_THRESHOLDS.FOAL_ENRICHMENT_MIN,
    maxAge: TASK_AGE_THRESHOLDS.FOAL_ENRICHMENT_MAX,
    recommendedDurationMinutes: 25,
    effects: [
      { label: 'Reduces stress level', type: 'positive' },
      { label: 'Develops calm demeanor', type: 'positive' },
    ],
    description: 'Soft grooming and stroking to promote relaxation and socialization.',
  },
  {
    id: 'feeding_assistance',
    name: 'Feeding Assistance',
    category: 'enrichment',
    minAge: TASK_AGE_THRESHOLDS.FOAL_ENRICHMENT_MIN,
    maxAge: TASK_AGE_THRESHOLDS.FOAL_ENRICHMENT_MAX,
    recommendedDurationMinutes: 15,
    effects: [
      { label: 'Strengthens human-horse bond', type: 'positive' },
      { label: 'Increases trust', type: 'positive' },
    ],
    description: 'Hand-feeding treats or supplemental nutrition to build positive associations.',
  },
  {
    id: 'environment_exploration',
    name: 'Environment Exploration',
    category: 'enrichment',
    minAge: TASK_AGE_THRESHOLDS.FOAL_ENRICHMENT_MIN,
    maxAge: TASK_AGE_THRESHOLDS.FOAL_ENRICHMENT_MAX,
    recommendedDurationMinutes: 40,
    effects: [
      { label: 'Develops curiosity trait', type: 'positive' },
      { label: 'Reduces environmental anxiety', type: 'positive' },
    ],
    description: 'Guide the foal through varied environments to build adaptability.',
  },

  // Foal Grooming Tasks (1-3 years)
  {
    id: 'hoof_handling',
    name: 'Hoof Handling',
    category: 'foal_grooming',
    minAge: TASK_AGE_THRESHOLDS.FOAL_GROOMING_MIN,
    maxAge: TASK_AGE_THRESHOLDS.FOAL_GROOMING_MAX,
    recommendedDurationMinutes: 20,
    effects: [
      { label: 'Prepares for farrier work', type: 'positive' },
      { label: 'Improves obedience', type: 'positive' },
    ],
    description: 'Practice picking up and holding hooves to prepare for regular farrier care.',
  },
  {
    id: 'tying_practice',
    name: 'Tying Practice',
    category: 'foal_grooming',
    minAge: TASK_AGE_THRESHOLDS.FOAL_GROOMING_MIN,
    maxAge: TASK_AGE_THRESHOLDS.FOAL_GROOMING_MAX,
    recommendedDurationMinutes: 30,
    effects: [
      { label: 'Develops patience', type: 'positive' },
      { label: 'Improves obedience', type: 'positive' },
    ],
    description: 'Teach the foal to stand quietly while tied for grooming and care.',
  },
  {
    id: 'sponge_bath',
    name: 'Sponge Bath',
    category: 'foal_grooming',
    minAge: TASK_AGE_THRESHOLDS.FOAL_GROOMING_MIN,
    maxAge: TASK_AGE_THRESHOLDS.FOAL_GROOMING_MAX,
    recommendedDurationMinutes: 25,
    effects: [
      { label: 'Acclimates to water', type: 'positive' },
      { label: 'Reduces stress level', type: 'positive' },
    ],
    description: 'Introduce water and bathing to normalize grooming routines.',
  },
  {
    id: 'coat_check',
    name: 'Coat Check',
    category: 'foal_grooming',
    minAge: TASK_AGE_THRESHOLDS.FOAL_GROOMING_MIN,
    maxAge: TASK_AGE_THRESHOLDS.FOAL_GROOMING_MAX,
    recommendedDurationMinutes: 15,
    effects: [
      { label: 'Monitors coat health', type: 'neutral' },
      { label: 'Increases bond score', type: 'positive' },
    ],
    description: 'Inspect and brush the coat to maintain condition and build grooming habits.',
  },
  {
    id: 'mane_tail_grooming',
    name: 'Mane & Tail Grooming',
    category: 'foal_grooming',
    minAge: TASK_AGE_THRESHOLDS.FOAL_GROOMING_MIN,
    maxAge: TASK_AGE_THRESHOLDS.FOAL_GROOMING_MAX,
    recommendedDurationMinutes: 20,
    effects: [
      { label: 'Improves presentation', type: 'positive' },
      { label: 'Strengthens bond', type: 'positive' },
    ],
    description: 'Detangle and groom the mane and tail to improve appearance and calmness.',
  },

  // General Grooming Tasks (3+ years)
  {
    id: 'brushing',
    name: 'Brushing',
    category: 'general_grooming',
    minAge: TASK_AGE_THRESHOLDS.GENERAL_GROOMING_MIN,
    recommendedDurationMinutes: 20,
    effects: [
      { label: 'Prevents coat problems', type: 'positive' },
      { label: 'Maintains bond score', type: 'neutral' },
    ],
    description: 'Regular brushing to maintain coat health and prevent skin conditions.',
  },
  {
    id: 'hand-walking',
    name: 'Hand-Walking',
    category: 'general_grooming',
    minAge: TASK_AGE_THRESHOLDS.GENERAL_GROOMING_MIN,
    recommendedDurationMinutes: 30,
    effects: [
      { label: 'Reduces burnout risk', type: 'positive' },
      { label: 'Maintains light exercise', type: 'positive' },
    ],
    description: 'Light exercise and mental stimulation outside the stall.',
  },
  {
    id: 'stall_care',
    name: 'Stall Care',
    category: 'general_grooming',
    minAge: TASK_AGE_THRESHOLDS.GENERAL_GROOMING_MIN,
    recommendedDurationMinutes: 45,
    effects: [
      { label: 'Improves living conditions', type: 'positive' },
      { label: 'Reduces stress level', type: 'positive' },
    ],
    description: 'Clean and maintain the stall for optimal health and comfort.',
  },
  {
    id: 'bathing',
    name: 'Bathing',
    category: 'general_grooming',
    minAge: TASK_AGE_THRESHOLDS.GENERAL_GROOMING_MIN,
    recommendedDurationMinutes: 40,
    effects: [
      { label: 'Removes dirt and sweat', type: 'positive' },
      { label: 'Improves coat condition', type: 'positive' },
    ],
    description: 'Full bath to maintain coat health and hygiene after training or competition.',
  },
  {
    id: 'mane_tail_trim',
    name: 'Mane & Tail Trim',
    category: 'general_grooming',
    minAge: TASK_AGE_THRESHOLDS.GENERAL_GROOMING_MIN,
    recommendedDurationMinutes: 30,
    effects: [
      { label: 'Maintains show presentation', type: 'positive' },
      { label: 'Prevents tangling', type: 'positive' },
    ],
    description: 'Trim and shape the mane and tail for competitions and general tidiness.',
  },
];

/** Category display metadata */
export const TASK_CATEGORY_INFO: Record<
  TaskCategory,
  { label: string; icon: string; colorClass: string; badgeClass: string; description: string }
> = {
  enrichment: {
    label: 'Foal Enrichment',
    icon: '🌱',
    colorClass: 'text-green-700',
    badgeClass: 'bg-green-50 text-green-700 border border-green-200',
    description: 'Developmental activities for foals aged 0–2 years',
  },
  foal_grooming: {
    label: 'Foal Grooming',
    icon: '✨',
    colorClass: 'text-blue-700',
    badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
    description: 'Grooming preparation tasks for foals aged 1–3 years',
  },
  general_grooming: {
    label: 'Adult Grooming',
    icon: '🪮',
    colorClass: 'text-amber-700',
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
    description: 'Standard grooming and care for horses aged 3+ years',
  },
};

/**
 * Get all tasks available for a horse of a given age.
 * Mirrors backend age eligibility logic from groomConfig.mjs.
 */
export function getTasksForAge(ageYears: number): TaskInfo[] {
  return TASK_DATA.filter((task) => {
    const meetsMin = ageYears >= task.minAge;
    const meetsMax = task.maxAge === undefined || ageYears <= task.maxAge;
    return meetsMin && meetsMax;
  });
}

/**
 * Get tasks grouped by category for a given age.
 */
export function getTasksByCategory(ageYears: number): Record<TaskCategory, TaskInfo[]> {
  const available = getTasksForAge(ageYears);
  return {
    enrichment: available.filter((t) => t.category === 'enrichment'),
    foal_grooming: available.filter((t) => t.category === 'foal_grooming'),
    general_grooming: available.filter((t) => t.category === 'general_grooming'),
  };
}

/**
 * Get available categories (non-empty) for a given age.
 */
export function getAvailableCategories(ageYears: number): TaskCategory[] {
  const byCategory = getTasksByCategory(ageYears);
  return (Object.keys(byCategory) as TaskCategory[]).filter((cat) => byCategory[cat].length > 0);
}

/**
 * Format duration in minutes to a human-readable string.
 * e.g. 90 → "1h 30m", 30 → "30m"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
