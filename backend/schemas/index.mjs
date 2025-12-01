import { authSchemas } from './authSchemas.mjs';
import { horseSchemas } from './horseSchemas.mjs';
import { breedingSchemas } from './breedingSchemas.mjs';
import { traitSchemas } from './traitSchemas.mjs';
import { trainingSchemas } from './trainingSchemas.mjs';
import { competitionSchemas } from './competitionSchemas.mjs';
import { groomSchemas } from './groomSchemas.mjs';
import { leaderboardSchemas } from './leaderboardSchemas.mjs';
import { adminSchemas } from './adminSchemas.mjs';
import { docsSchemas } from './docsSchemas.mjs';
import { labSchemas } from './labSchemas.mjs';

export const allSchemas = [
  ...authSchemas,
  ...horseSchemas,
  ...breedingSchemas,
  ...traitSchemas,
  ...trainingSchemas,
  ...competitionSchemas,
  ...groomSchemas,
  ...leaderboardSchemas,
  ...adminSchemas,
  ...docsSchemas,
  ...labSchemas,
];
