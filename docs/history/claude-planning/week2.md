Week 2: Training, Stat Growth, and Player Progression
🎯 Week 2 Primary Goals
Task
Description
2.1
Player training interface: select horse + discipline
2.2
Enforce 7-day training cooldown (revisit utility from 1.3)
2.3
Training adds +X to discipline-relevant stats
2.4
Allow only trained discipline (not just trait!)
2.5
Update horse stat display and audit training logs
2.6
UI data endpoint: what horses are trainable, when, and in what disciplines
2.7
Optional: add “discipline mastery” score or level up logic based on # of trainings done


Week 2: Training, Cooldown, and Stat Progression System
🎯 Week 2 Goals:
Enable players to train horses once per 7 days


Training targets a specific discipline (not just the horse’s trait)


Trained horses gain +stat growth in the 3 relevant stats


Log training sessions per horse


Query which horses are eligible for training


Build backend endpoints for use in UI later



🧩 System Structure Overview
Component
Purpose
trainingModel.js
Store each training session
trainingController.js
Handle training logic and cooldown enforcement
utils/trainingCooldown.js
Already built — reused to enforce cooldown
statMap.js
Reused to determine stat targets
horseModel.js
Updated to increase specific stats based on training
GET /horses/trainable
Returns list of horses ready to train
POST /train
Endpoint to run a training session
tests/training.test.js
Full test coverage of training logic


🧱 Step-by-Step Execution Plan

✅ 2.1 — Create trainingModel.js
Stores training history:
js
CopyEdit
{
  id,
  horse_id,
  discipline,
  trained_at (timestamp),
  stat_increases: ["speed", "stamina"]
}

Cursor Prompt:
 “Create a trainingModel.js file that:
Saves training logs with horse_id, discipline, trained_at, and stat_increases


Exposes:


logTrainingSession(data)


getLastTrainingDate(horseId, discipline)


Uses utils/database.js.”



✅ 2.2 — Enforce Cooldown Per Discipline
Training cooldown is tracked per horse, per discipline.
Cursor Prompt:
 “In trainingModel.js, implement getLastTrainingDate(horseId, discipline), and check if it's over 7 days ago.”
In trainingController.js, add:
canTrain(horseId, discipline) → returns boolean



✅ 2.3 — Training Controller: Stat Growth
Pick one of the 3 relevant stats (from statMap)


Add +1


Log training


Cursor Prompt:
 “In trainingController.js, add trainHorse(horseId, discipline) that:
Confirms cooldown passed


Picks 1 of 3 related stats at random from statMap[discipline]


Increments that stat in horseModel


Logs training with trainingModel


Returns updated horse + confirmation message”



✅ 2.4 — Update horseModel to Support Dynamic Stat Growth
Cursor Prompt:
 “In horseModel.js, add incrementStat(horseId, stat) that:
Fetches horse


Adds +1 to specified stat inside stats JSON


Saves update”



✅ 2.5 — Endpoint: Get Trainable Horses
GET /horses/trainable
 Returns horses where cooldown has expired.
Cursor Prompt:
 “Create a route /horses/trainable in horseRoutes.js that:
Calls trainingController.getTrainableHorses(playerId)


Returns horses that can be trained in at least one discipline”



✅ 2.6 — Endpoint: Train Horse
POST /train
json
CopyEdit
{
  "horseId": 5,
  "discipline": "Show Jumping"
}

Cursor Prompt:
 “Add POST /train route that:
Calls trainHorse(horseId, discipline)


Returns updated stats + stat gained + cooldown reset info”



✅ 2.7 — Add Tests: training.test.js
Test Case
What to Validate
Cooldown blocks early training
✔️
Stat updated correctly
✔️
Invalid discipline errors
✔️
Correct stat added from discipline set
✔️
Log created with correct fields
✔️

Cursor Prompt:
 “Create training.test.js that:
Mocks horse and shows cooldown logic


Runs full training and checks stat updated


Validates training logged in DB”



📋 Week 2 Completion Checklist
Task
Status
trainingModel.js created
☐
Cooldown check per discipline
☐
trainHorse() logic complete
☐
Horse stat increment logic
☐
GET /horses/trainable route
☐
POST /train route
☐
All tests written and passing
☐


Once complete, you’ll have a full discipline-based training system with progression, cooldowns, and backend support for the frontend UI.
Let me know when you’re ready to begin Task 2.1: Build trainingModel.js and I’ll walk you through the prompts.
4o
