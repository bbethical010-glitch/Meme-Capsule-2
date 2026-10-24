import { json, type Env } from "../../../_shared/d1r2";
import { androidAnalyticsCacheKey, getCached, setCache } from "../../../_shared/analyticsCache";
import { noStore, requireSuperadmin } from "../../../_shared/liveAnalytics";

export { json, noStore, requireSuperadmin };

export const cachedLive = async <T>(
  env: Env,
  name: string,
  fresh: boolean,
  loader: () => Promise<T>
): Promise<T> => {
  if (!fresh && env.ANALYTICS_KV) {
    const cached = await getCached<T>(env.ANALYTICS_KV, androidAnalyticsCacheKey(`live:${name}`));
    if (cached) return cached;
  }
  const value = await loader();
  if (env.ANALYTICS_KV) await setCache(env.ANALYTICS_KV, androidAnalyticsCacheKey(`live:${name}`), value, 3);
  return value;
};
