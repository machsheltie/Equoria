import React from 'react';

// All 23 disciplines supported by the backend (from backend/utils/statMap.mjs)
// Must match exact case and spacing as backend expects
const ALL_DISCIPLINES = [
  'Barrel Racing',
  'Combined Driving',
  'Cross Country',
  'Cutting',
  'Dressage',
  'Endurance',
  'Eventing',
  'Fine Harness',
  'Gaited',
  'Gymkhana',
  'Harness Racing',
  'Hunter',
  'Polo',
  'Racing',
  'Reining',
  'Rodeo',
  'Roping',
  'Saddleseat',
  'Show Jumping',
  'Steeplechase',
  'Team Penning',
  'Vaulting',
  'Western Pleasure',
];

interface DisciplineSelectorProps {
  selectedDiscipline: string;
  onDisciplineChange: (discipline: string) => void;
  disciplines?: string[];
  description?: string;
}

const DisciplineSelector: React.FC<DisciplineSelectorProps> = ({
  selectedDiscipline,
  onDisciplineChange,
  disciplines = ALL_DISCIPLINES,
  description,
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onDisciplineChange(event.target.value);
  };

  return (
    <div>
      <label htmlFor="discipline-selector" className="text-sm font-medium text-[rgb(220,235,255)]">
        Discipline
      </label>
      {description && <p className="mt-1 text-xs text-[rgb(148,163,184)]">{description}</p>}
      <select
        id="discipline-selector"
        value={selectedDiscipline}
        onChange={handleChange}
        className="celestial-input w-full mt-2"
      >
        {disciplines.map((discipline) => (
          <option key={discipline} value={discipline}>
            {discipline}
          </option>
        ))}
      </select>
    </div>
  );
};

export default DisciplineSelector;
export { ALL_DISCIPLINES };
