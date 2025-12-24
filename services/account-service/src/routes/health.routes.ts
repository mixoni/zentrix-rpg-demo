export async function registerHealthRoutes(app: any) {
    app.get("/health", async () => ({ ok: true }));
  }
  