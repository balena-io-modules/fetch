import _fetch, { RequestInfo, RequestInit } from 'node-fetch'
import { options } from './he-connect';

export default async function fetch(url: RequestInfo, init?: RequestInit) {
  if (typeof url !== 'string') {
    return _fetch(url, init);
  }
  return _fetch(url, {
    ...init,
    ...options
  });
}
