export function fakeCharacterClient(overrides?: Partial<{
    snapshot: (id: string) => Promise<any>;
    resolveDuel: (body: any) => Promise<any>;
  }>) {
    return {
      snapshot: async (id: string) => ({
        id,
        createdBy: "user-1",
        health: 30,
        calculatedStats: { strength: 5, agility: 5, intelligence: 5, faith: 5 },
      }),
      resolveDuel: async () => ({ transferred: { itemInstanceId: "x", itemId: "y" } }),
      ...overrides,
    };
  }
  