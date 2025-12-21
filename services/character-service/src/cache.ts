import Redis from "ioredis";

export function createRedis(url: string) {
  const r = new Redis(url);
  r.on("error", (e) => console.error("[redis]", e));
  return r;
}
