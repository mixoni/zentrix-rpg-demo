export const DUEL_ID = "11111111-1111-1111-1111-111111111111";
export const CHAR_A  = "22222222-2222-2222-2222-222222222222";
export const CHAR_B  = "33333333-3333-3333-3333-333333333333";
export const USER_1  = "44444444-4444-4444-4444-444444444444";
export const USER_2  = "55555555-5555-5555-5555-555555555555";

export const JWT_SECRET = "test-secret";

export function activeDuel(overrides: any = {}) {
    return {
      id: DUEL_ID,
      status: "Active",
      started_at: new Date().toISOString(),
  
      challenger_character_id: CHAR_A,
      opponent_character_id: CHAR_B,
      challenger_user_id: USER_1,
  
      challenger_strength: 5,
      challenger_agility: 5,
      challenger_intelligence: 5,
      challenger_faith: 5,
  
      opponent_strength: 5,
      opponent_agility: 5,
      opponent_intelligence: 5,
      opponent_faith: 5,
  
      challenger_hp: 30,
      opponent_hp: 30,
  
      challenger_last_attack: null,
      challenger_last_cast: null,
      challenger_last_heal: null,
      opponent_last_attack: null,
      opponent_last_cast: null,
      opponent_last_heal: null,
  
      ...overrides,
    };
  }
  