const TTL_SEC = 120;

export function detailsKey(id: string) {
  return `character:${id}:details`;
}

export async function getCharacterCache(redis: any, id: string) {
  console.log("[cache] GET", detailsKey(id));
  const raw = await redis.get(detailsKey(id));
  return raw ? JSON.parse(raw) : null;
}

export async function setCharacterCache(redis: any, id: string, value: any) {
  await redis.set(detailsKey(id), JSON.stringify(value), "EX", TTL_SEC);
}

export async function invalidateCharacterCache(redis: any, id: string) {
  console.log("[cache] DEL", detailsKey(id));
  const deleted = await redis.del(detailsKey(id));
  console.log("[cache] DEL result", deleted);
}

