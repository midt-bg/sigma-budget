import { DurableObject } from 'cloudflare:workers';
import { reportLimit, expireReports } from './vrazka-window';

/** One coordination point for the site's small, global hourly allowance. */
export class VrazkaLimiter extends DurableObject<Env> {
  consume(key: string) {
    return reportLimit(this.ctx.storage, key);
  }
  alarm() {
    return expireReports(this.ctx.storage);
  }
}
