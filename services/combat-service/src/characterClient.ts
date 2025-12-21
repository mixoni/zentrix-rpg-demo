import axios from "axios";

export type CharacterSnapshot = {
  id: string;
  name: string;
  createdBy: string;
  health: number;
  mana: number;
  className: string;
  calculatedStats: { strength: number; agility: number; intelligence: number; faith: number };
  itemInstances: Array<{ instanceId: string; itemId: string }>;
};

export function createCharacterClient(baseUrl: string, internalToken: string) {
  const http = axios.create({
    baseURL: baseUrl,
    timeout: 5000,
    headers: { "X-Internal-Token": internalToken },
  });

  return {
    async snapshot(characterId: string): Promise<CharacterSnapshot> {
      const res = await http.get(`/internal/characters/${characterId}/snapshot`);
      return res.data as CharacterSnapshot;
    },
    async resolveDuel(payload: { duelId?: string; winnerCharacterId: string; loserCharacterId: string }) {
      const res = await http.post(`/internal/duels/resolve`, payload);
      return res.data as { transferred: null | { itemInstanceId: string; itemId: string } };
    },
  };
}
