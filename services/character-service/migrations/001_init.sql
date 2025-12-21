CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_name TEXT NOT NULL,
  description TEXT NOT NULL,
  bonus_strength INT NOT NULL DEFAULT 0,
  bonus_agility INT NOT NULL DEFAULT 0,
  bonus_intelligence INT NOT NULL DEFAULT 0,
  bonus_faith INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  health INT NOT NULL,
  mana INT NOT NULL,
  base_strength INT NOT NULL,
  base_agility INT NOT NULL,
  base_intelligence INT NOT NULL,
  base_faith INT NOT NULL,
  class_id UUID NOT NULL REFERENCES classes(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS character_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_character_items_character ON character_items(character_id);
