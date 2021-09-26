import _fetch, { RequestInfo, } from 'node-fetch'
import { getAgent } from './agent';
import { BalenaRequestInit } from './happy-eyeballs';

export default async function fetch(url: RequestInfo, init?: Partial<BalenaRequestInit>) {
  if (typeof url !== 'string') {
    return _fetch(url, init);
  }
  return _fetch(url, {
    ...init,
    ...({
      agent: init?.agent || getAgent({
        ...init,
        secure: url.startsWith('https:'),
      }),
    })
  });
}
