CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS duels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenger_character_id UUID NOT NULL,
  opponent_character_id UUID NOT NULL,
  challenger_user_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Active','Finished','Draw')) DEFAULT 'Active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NULL,

  -- snapshot stats
  challenger_strength INT NOT NULL,
  challenger_agility INT NOT NULL,
  challenger_intelligence INT NOT NULL,
  challenger_faith INT NOT NULL,

  opponent_strength INT NOT NULL,
  opponent_agility INT NOT NULL,
  opponent_intelligence INT NOT NULL,
  opponent_faith INT NOT NULL,

  -- current state
  challenger_hp INT NOT NULL,
  opponent_hp INT NOT NULL,

  -- cooldown timestamps
  challenger_last_attack TIMESTAMPTZ NULL,
  challenger_last_cast TIMESTAMPTZ NULL,
  challenger_last_heal TIMESTAMPTZ NULL,
  opponent_last_attack TIMESTAMPTZ NULL,
  opponent_last_cast TIMESTAMPTZ NULL,
  opponent_last_heal TIMESTAMPTZ NULL,

  winner_character_id UUID NULL
);

CREATE TABLE IF NOT EXISTS duel_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  duel_id UUID NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
  actor_character_id UUID NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('attack','cast','heal')),
  amount INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_duel_actions_duel ON duel_actions(duel_id);
