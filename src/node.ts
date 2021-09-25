import _fetch, { RequestInfo, } from 'node-fetch'
import { parse } from 'url';
import { getAgent } from './agent';
import { BalenaRequestInit } from './happy-eyeballs';
import { URL } from 'url'

export default async function fetch(url: RequestInfo, init?: BalenaRequestInit) {
  if (typeof url !== 'string') {
    return _fetch(url, init);
  }
  const {port, protocol} = new URL(url);
  return _fetch(url, {
    ...init,
    ...({
      agent: init?.agent || getAgent({
        ...init,
        secure: protocol === 'https:',
      }),
    })
  });
}
