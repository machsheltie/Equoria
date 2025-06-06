DROP TABLE IF EXISTS public.breeds CASCADE;
-- Create breeds table
create table public.breeds (
  id bigint generated always as identity primary key,
  name varchar(255) not null
);

comment on table public.breeds is 'Stores information about different horse breeds available in the game.';

DROP TABLE IF EXISTS public.users CASCADE;
-- Create users table
create table public.users (
  id varchar(255) primary key default gen_random_uuid()::text, -- MODIFIED: id type to varchar UUID
  email varchar(255) not null unique,
  username varchar(255) not null unique,
  name varchar(255) not null, -- ADDED: Display name, formerly in users table
  password varchar(255) not null,
  firstName varchar(255) not null,
  lastName varchar(255) not null,
  role varchar(50) not null default 'user',
  money integer not null default 0,          -- ADDED: Formerly in users table
  level integer not null default 1,          -- ADDED: Formerly in users table
  xp integer not null default 0,             -- ADDED: Formerly in users table
  settings jsonb not null default '{}'::jsonb, -- ADDED: Formerly in users table
  createdAt timestamp with time zone not null default now(),
  updatedAt timestamp with time zone not null default now()
);

comment on table public.users is 'Stores information about registered users, including authentication, profile data, and game progression.'; -- MODIFIED comment

DROP TABLE IF EXISTS public.stables CASCADE;
-- Create stables table
create table public.stables (
  id bigint generated always as identity primary key,
  name varchar(255) not null,
  location varchar(255)
  -- Consider adding a user_id to link stables to owners if a user can own multiple stables
  -- owner_id bigint references public.users(id)
);

comment on table public.stables is 'Stores information about stables where horses can be kept.';

DROP TABLE IF EXISTS public.horses CASCADE;
-- Create the horses table with all required fields
create table public.horses (
  id bigint generated always as identity primary key,
  name varchar(255) not null,
  sex varchar(50) not null check (sex in ('Stallion', 'Mare', 'Colt', 'Filly')),
  date_of_birth date not null,
  breed_id bigint references public.breeds(id),
  owner_id varchar(255) references public.users(id) on delete set null, -- MODIFIED: type to varchar, references users(id)
  stable_id bigint references public.stables(id) on delete set null,

  genotype jsonb,
  phenotypic_markings jsonb,
  final_display_color varchar(255),
  shade varchar(100),
  image_url varchar(1024) default '/images/samplehorse.JPG',

  trait varchar(100),
  temperament varchar(50),
  precision integer default 0 check (precision >= 0 and precision <= 100),
  strength integer default 0 check (strength >= 0 and strength <= 100),
  speed integer default 0 check (speed >= 0 and speed <= 100),
  agility integer default 0 check (agility >= 0 and agility <= 100),
  endurance integer default 0 check (endurance >= 0 and endurance <= 100),
  intelligence integer default 0 check (intelligence >= 0 and intelligence <= 100),
  personality varchar(50) check (personality in ('Spirited', 'Nervous', 'Calm', 'Bold', 'Steady', 'Independent', 'Reactive', 'Stubborn', 'Playful', 'Lazy', 'Aggressive')),
  total_earnings integer default 0 check (total_earnings >= 0),

  sire_id bigint references public.horses(id) on delete set null, -- Added ON DELETE SET NULL for sires
  dam_id bigint references public.horses(id) on delete set null,   -- Added ON DELETE SET NULL for dams

  stud_status varchar(50) default 'Not at Stud' check (stud_status in ('Not at Stud', 'Public Stud', 'Private Stud')),
  stud_fee integer default 0 check (stud_fee >= 0),
  last_bred_date date,
  for_sale boolean default false,
  sale_price integer default 0 check (sale_price >= 0),

  health_status varchar(50) default 'Excellent' check (health_status in ('Excellent', 'Very Good', 'Good', 'Fair', 'Poor')),
  last_vetted_date date default current_date,

  tack jsonb default '{}'::jsonb,

  -- Additional fields for game mechanics
  age integer,
  createdAt timestamp with time zone default now(),
  userId varchar(255) references public.users(id) on delete set null, -- MODIFIED: Was userId, now userId, references users(id)
  trainingCooldown timestamp with time zone,
  earnings decimal(10,2) default 0,
  rider jsonb,
  disciplineScores jsonb,

  -- Bonding and stress tracking
  bond_score integer default 50 check (bond_score >= 0 and bond_score <= 100),
  stress_level integer default 0 check (stress_level >= 0 and stress_level <= 100),

  -- Epigenetic traits system
  epigenetic_modifiers jsonb default '{"positive": [], "negative": [], "hidden": []}'::jsonb,

  -- Additional stats for competition scoring
  stamina integer default 0 check (stamina >= 0 and stamina <= 100),
  balance integer default 0 check (balance >= 0 and balance <= 100),
  boldness integer default 0 check (boldness >= 0 and boldness <= 100),
  flexibility integer default 0 check (flexibility >= 0 and flexibility <= 100),
  obedience integer default 0 check (obedience >= 0 and obedience <= 100),
  focus integer default 0 check (focus >= 0 and focus <= 100)
);

comment on table public.horses is 'Stores information about individual horses in the game, including their genetics, stats, lineage, and status.';

-- Add grooms table for foal caretakers
DROP TABLE IF EXISTS public.grooms CASCADE;
create table public.grooms (
  id bigint generated always as identity primary key,
  name varchar(255) not null,
  speciality varchar(50) not null check (speciality in ('foal_care', 'general', 'training', 'medical')),
  experience integer not null default 1 check (experience >= 1 and experience <= 20),
  skill_level varchar(50) not null default 'novice' check (skill_level in ('novice', 'intermediate', 'expert', 'master')),
  personality varchar(50) not null check (personality in ('gentle', 'energetic', 'patient', 'strict')),
  hourly_rate decimal(10,2) not null default 15.0 check (hourly_rate >= 0),
  availability jsonb not null default '{}'::jsonb,
  bio text,
  image_url varchar(1024),
  is_active boolean not null default true,
  hired_date timestamp with time zone not null default now(),
  createdAt timestamp with time zone not null default now(),
  updatedAt timestamp with time zone not null default now(),
  userId varchar(255) references public.users(id) on delete set null -- MODIFIED: Was userId, references public.users
);

comment on table public.grooms is 'Stores groom profiles for foal care and management, associated with users.'; -- MODIFIED comment

-- Add groom assignments table
DROP TABLE IF EXISTS public.groom_assignments CASCADE;
create table public.groom_assignments (
  id bigint generated always as identity primary key,
  startDate timestamp with time zone not null default now(),
  endDate timestamp with time zone,
  isActive boolean not null default true,
  isDefault boolean not null default false,
  priority integer not null default 1 check (priority >= 1 and priority <= 5),
  notes text,
  createdAt timestamp with time zone not null default now(),
  updatedAt timestamp with time zone not null default now(),
  foalId bigint not null references public.horses(id) on delete cascade,
  groomId bigint not null references public.grooms(id) on delete cascade,
  userId varchar(255) references public.users(id) on delete set null, -- MODIFIED: Was userId, references public.users
  unique(foalId, groomId, isActive)
);

comment on table public.groom_assignments is 'Stores assignments of grooms to specific foals, associated with users.'; -- MODIFIED comment

-- Add groom interactions table
DROP TABLE IF EXISTS public.groom_interactions CASCADE;
create table public.groom_interactions (
  id bigint generated always as identity primary key,
  interactionType varchar(50) not null check (interactionType in ('daily_care', 'feeding', 'grooming', 'exercise', 'medical_check')),
  duration integer not null check (duration >= 5 and duration <= 480),
  bondingChange integer not null default 0 check (bondingChange >= -10 and bondingChange <= 10),
  stressChange integer not null default 0 check (stressChange >= -10 and stressChange <= 10),
  quality varchar(20) not null default 'good' check (quality in ('poor', 'fair', 'good', 'excellent')),
  notes text,
  cost decimal(10,2) not null default 0.0 check (cost >= 0),
  timestamp timestamp with time zone not null default now(),
  createdAt timestamp with time zone not null default now(),
  foalId bigint not null references public.horses(id) on delete cascade,
  groomId bigint not null references public.grooms(id) on delete cascade,
  assignmentId bigint references public.groom_assignments(id) on delete set null
);

comment on table public.groom_interactions is 'Stores individual interactions between grooms and foals with bonding effects.';

-- Add shows table for competitions
DROP TABLE IF EXISTS public.shows CASCADE;
create table public.shows (
  id bigint generated always as identity primary key,
  name varchar(255) not null unique,
  discipline varchar(100) not null,
  levelMin integer not null,
  levelMax integer not null,
  entryFee integer not null,
  prize integer not null,
  runDate timestamp with time zone not null,
  createdAt timestamp with time zone not null default now(),
  updatedAt timestamp with time zone not null default now(),
  hostUserId varchar(255) references public.users(id) -- MODIFIED: Was hostUser, references public.users(id)
);

comment on table public.shows is 'Stores competition shows and events, hosted by a user.'; -- MODIFIED comment

-- Add competition results table
DROP TABLE IF EXISTS public.competition_results CASCADE;
create table public.competition_results (
  id bigint generated always as identity primary key,
  score decimal(10,2) not null,
  placement varchar(50),
  discipline varchar(100) not null,
  runDate timestamp with time zone not null,
  createdAt timestamp with time zone not null default now(),
  showName varchar(255) not null,
  prizeWon decimal(10,2) default 0,
  statGains jsonb,
  horseId bigint not null references public.horses(id) on delete cascade,
  showId bigint not null references public.shows(id) on delete cascade
);

comment on table public.competition_results is 'Stores results from horse competitions.';

-- Add training logs table
DROP TABLE IF EXISTS public.training_logs CASCADE;
create table public.training_logs (
  id bigint generated always as identity primary key,
  discipline varchar(100) not null,
  trainedAt timestamp with time zone not null default now(),
  horseId bigint not null references public.horses(id) on delete cascade
);

comment on table public.training_logs is 'Stores training session history for horses.';

-- Add foal development table
DROP TABLE IF EXISTS public.foal_development CASCADE;
create table public.foal_development (
  id bigint generated always as identity primary key,
  currentDay integer not null default 0,
  bondingLevel integer not null default 50,
  stressLevel integer not null default 20,
  completedActivities jsonb not null default '{}'::jsonb,
  createdAt timestamp with time zone not null default now(),
  updatedAt timestamp with time zone not null default now(),
  foalId bigint not null unique references public.horses(id) on delete cascade
);

comment on table public.foal_development is 'Stores foal development progress and activities.';

-- Add foal activities table
DROP TABLE IF EXISTS public.foal_activities CASCADE;
create table public.foal_activities (
  id bigint generated always as identity primary key,
  day integer not null,
  activityType varchar(100) not null,
  outcome varchar(100) not null,
  bondingChange integer not null,
  stressChange integer not null,
  description text not null,
  createdAt timestamp with time zone not null default now(),
  foalId bigint not null references public.horses(id) on delete cascade
);

comment on table public.foal_activities is 'Stores individual foal activities and their outcomes.';

-- Add foal training history table
DROP TABLE IF EXISTS public.foal_training_history CASCADE;
create table public.foal_training_history (
  id varchar(255) primary key default gen_random_uuid()::text,
  day integer not null,
  activity varchar(255) not null,
  outcome varchar(255) not null,
  bond_change integer not null default 0,
  stress_change integer not null default 0,
  timestamp timestamp with time zone not null default now(),
  createdAt timestamp with time zone not null default now(),
  updatedAt timestamp with time zone not null default now(),
  horse_id bigint not null references public.horses(id) on delete cascade
);

comment on table public.foal_training_history is 'Stores detailed foal training history with bonding and stress effects.';

-- Create indexes for performance
create index idx_horses_owner_id on public.horses(owner_id);
create index idx_horses_breed_id on public.horses(breed_id);
create index idx_horses_stable_id on public.horses(stable_id);
create index idx_horses_user_id on public.horses(userId); -- MODIFIED: Was idx_horses_user_id on public.horses(userId)
create index idx_grooms_user_id on public.grooms(userId); -- MODIFIED: Was idx_grooms_user_id on public.grooms(userId)
create index idx_groom_assignments_foal_id on public.groom_assignments(foalId);
create index idx_groom_assignments_groom_id on public.groom_assignments(groomId);
create index idx_groom_interactions_foal_id on public.groom_interactions(foalId);
create index idx_groom_interactions_groom_id on public.groom_interactions(groomId);
create index idx_foal_training_history_horse_id on public.foal_training_history(horse_id);
create index idx_foal_training_history_day on public.foal_training_history(day);
create index idx_foal_training_history_timestamp on public.foal_training_history(timestamp);
create index idx_foal_training_history_horse_day on public.foal_training_history(horse_id, day);

-- Add XP events log table for tracking all XP gains/losses
DROP TABLE IF EXISTS public.xp_events CASCADE;
CREATE TABLE public.xp_events (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- MODIFIED: Was user_id, references public.users
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.xp_events IS 'Stores all XP events for users for auditing and analytics purposes.'; -- MODIFIED comment

-- Create indexes for performance
CREATE INDEX idx_xp_events_user_id ON public.xp_events(user_id); -- MODIFIED: Was idx_xp_events_user_id
CREATE INDEX idx_xp_events_timestamp ON public.xp_events(timestamp);
CREATE INDEX idx_xp_events_user_timestamp ON public.xp_events(user_id, timestamp); -- MODIFIED: Was idx_xp_events_user_timestamp