import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { BalenaRequestInit, happyEyeballs } from './happy-eyeballs';
import { URL } from 'url';
import * as net from 'net';
import { debuglog } from 'util';

const agentCache = new Map<string, HttpsAgent|HttpAgent>();
export function getAgent(init: BalenaRequestInit) {
  const hash = getHash(init);
  // cache agents with same configuration to reduce connection overhead
  if (agentCache.has(hash)) {
    return agentCache.get(hash);
  }
  const agent = new class extends (init.secure ? HttpsAgent : HttpAgent) {
    createConnection = (url: URL, cb: (err: Error|undefined, socket?: net.Socket) => void) => {happyEyeballs(url, init, cb)};
  }
  agentCache.set(hash, agent);
  return agent;
}

// this can be eliminated once `node-fetch` accepts `createConnection` option (https://github.com/node-fetch/node-fetch/issues/1313)
const hashCache = new WeakMap<any, string>()
function getHash(item: any): string {
  switch (typeof item) {
    // we can cache objects and functions, in case people reuse the same
    // object or function in the options, so we don't have to create a hash again
    case 'object':
      if (hashCache.has(item)) {
        return hashCache.get(item)!;
      }
      // object has not been cached, so we need to create a new hash
      // this enables use to reuse http(s) agents which have the same
      // options for config, even if they are different objects
      let str = '{'
      const keys = typeof item.keys === 'function' ? item.keys() : Object.keys(item);
      for (const key of keys.sort()) {
        str+= `"${key}":${getHash(item[key])}`;
      }
      str += '}'
      // create hash of all stringified items
      let h = 0;
      for (const c of Buffer.from(str)) {
        h = ((h << 5) - h) + c | 0;
      }
      const hString = String(h);
      hashCache.set(item, hString);
      return hString
    case 'function':
      if (hashCache.has(item)) {
        return hashCache.get(item)!;
      }
      const id = String(Math.random());
      hashCache.set(item, id);
      return id!;
    case 'number':
    case 'boolean':
    case 'bigint':
    case 'symbol':
      return `"${item.toString()}"`;
    case 'undefined':
      return 'undefined'
  }
  // this should never be reached, but in case it does, bust cache
  return Math.random()+''
}