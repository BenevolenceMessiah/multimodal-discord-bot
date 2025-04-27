import Redis from 'ioredis';
import { config } from '../config.js';

let redis: Redis.Redis;
if (config.redis?.enabled) {
  redis = new Redis(config.redis.url);
}

export async function pushMessage(channel: string, msg: string) {
  if (!redis) return;
  const key = `ctx:${channel}`;
  await redis.rpush(key, msg);
  await redis.ltrim(key, -config.maxLines, -1);
  if (config.redis?.ttl! >= 0) {
    await redis.expire(key, config.redis.ttl);
  }
}

export async function getContext(channel: string): Promise<string> {
  if (!redis) return '';
  const key = `ctx:${channel}`;
  const arr = await redis.lrange(key, 0, -1);
  return arr.join('\n');
}

export async function clearContext(channel: string) {
  if (!redis) return;
  await redis.del(`ctx:${channel}`);
}