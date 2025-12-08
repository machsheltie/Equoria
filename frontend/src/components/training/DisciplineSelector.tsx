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
      <label htmlFor="discipline-selector" className="text-sm font-medium text-slate-700">
        Discipline
      </label>
      {description && (
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      )}
      <select
        id="discipline-selector"
        value={selectedDiscipline}
        onChange={handleChange}
        className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
