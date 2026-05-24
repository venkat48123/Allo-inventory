import Redis from "ioredis";

let redis: Redis | null = null;

export function getRedis() {
  if (!process.env.REDIS_URL) {
    console.warn("REDIS_URL is not set");
    return null;
  }

  if (!redis) {
    redis = new Redis(process.env.REDIS_URL);
  }

  return redis;
}