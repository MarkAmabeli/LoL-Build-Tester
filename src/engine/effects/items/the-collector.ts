import type { Effect } from '../types';
import { item, sourced } from '../../hand';

const EXECUTE_THRESHOLD = sourced('collector.executeThreshold', item('6676', 'ExecuteThreshold', 0.05));

/** Death: your damage executes champions left below 5% health. Taxes (bonus gold) isn't modeled. */
export const theCollector: Effect = {
  id: '6676',
  name: 'The Collector',
  kind: 'item',
  verifiedPatch: '16.20',
  executeThreshold: () => EXECUTE_THRESHOLD,
};
