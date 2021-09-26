import * as net from 'net';
import * as tls from 'tls';
import * as dns from 'dns/promises';
import { debuglog, promisify } from 'util';
import { URL } from 'url';
import { LookupAddress, LookupOptions } from 'dns';
import { EventEmitter } from 'stream';
import { RequestInit as NFRequestInit } from 'node-fetch'

const DEFAULT_NEXT_ADDR_DELAY = 300;
const DEFAULT_LOOKUP_OPTIONS = Object.freeze({
  verbatim: true,
  family: 0,
  all: true,
});

const debug = debuglog('@balena/fetch-debug');
// const verbose = debuglog('@balena/fetch-verbose');

const sleep = promisify(setTimeout);
// We may want to abort a sleep to keep the sleep handle from keeping the process open
const abortableSleep = async (ms: number, abortSignal: {aborted: boolean}) => {
  while ((ms > 0) && !abortSignal.aborted) {
    await sleep(Math.min(100,ms))
    ms -= 100;
  }
}

// hash of hosts and last associated connection family
const familyCache = new Map<string, number>();

export type BalenaRequestInit = NFRequestInit & RequestInit & {
  secure: boolean;
  delay?: number; // ms delay between requests
  lookup?: (hostname: string, options: LookupOptions) => Promise<LookupAddress | LookupAddress[]>;
  family?: number;
  hints?: number;
};

export async function happyEyeballs(url: URL, init: BalenaRequestInit, cb: (err: Error | undefined, socket?: net.Socket) => void) {
  const {hostname} = url;
  debug('Connecting to', hostname);

  const lookups = (await (init.lookup || dns.lookup)(hostname, {
    ...DEFAULT_LOOKUP_OPTIONS,
    family: init.family || DEFAULT_LOOKUP_OPTIONS.family,
    hints: init.hints,
  })) as LookupAddress[];
  if (!lookups.length) {
    throw new Error(`Could not resolve host, ${hostname}`);
  }

  const sockets = new Map<string, net.Socket>();
  const port = url.port.length ? Number(url.port) : (init.secure ? 443 : 80);

  let failed = 0;
  let err: Error;
  function onError(this: net.Socket, _err:any) {
    debug('Got error', _err)

    // Only use the value of the first error, as that was the one most likely to succeed
    if (!err){
      err = _err
    }

    if (++failed>=lookups.length) {
      debug('All addresses failed')
      return cb(err)
    }
    debug('More addresses to try, continuing...');
  }

  let ctFound = false;
  function onConnect(this: net.Socket) {
    debug('Connected to', this.remoteAddress);
    ctFound = true;
    for (const s of sockets.values()) {
      if (s !== this) {
        debug('Destroying', s.remoteAddress);
        s.destroy();
      }
    }
    // save last successful connection family for future reference
    // familyCache.set(hostname, net.isIP(this.remoteAddress!));
    cb(undefined, this);
  }

  for (const batch of zip(lookups, familyCache.get(hostname))) {
    if (ctFound) {
      break;
    }

    for (const addr of batch) {
      debug(`Trying ${addr}...`);
      const socket = new net.Socket();
      sockets.set(addr, socket);
      const common = {host: addr, port};
      if (init.secure) {
        tls.connect({
          ...common,
          socket,
          servername: hostname,
        })
      } else {
        net
          .connect(common)
          .on('connect', onConnect)
          .on('error', onError);
      }
    }

    const abortSignal = {aborted: false};
    await Promise.race([
      // give each connection 300 ms to connect before trying next one
      abortableSleep(init.delay || DEFAULT_NEXT_ADDR_DELAY, abortSignal),
      // skip to next pair if both connections drop before that
      Promise.all(batch.map(addr => EventEmitter.once(sockets.get(addr)!, 'close'))).catch(() => {}),
    ])
    abortSignal.aborted = true;
  }
}

// this function follows the happy eyeballs 2 algorithm: https://datatracker.ietf.org/doc/html/rfc8305
export function*zip(lookups: LookupAddress[], init?: number): Iterable<string[]> {
  // `init` is the cached value of the family of the last successful connection
  // or `undefined` if no successful connections have been made to this host

  // `next` is the next address family we are looking for
  let next = init;

  // queue of addresses not matching `next`
  const queue: string[] = [];

  for (const {address, family} of lookups) {
    if (family === next) {
      if (init) {
        // we've seen this host before, so just try this connection first
        yield [address];
        // set init to 0, so dual-stack addresses will be returned if the first one fails
        init = 0;
      } else {
        // the cached address family didn't connect in time, or there was no cached address family
        // so now yield pairs of both families
        if (queue.length) {
          // If there is an item on the queue, we have found a pair of mixed families.
          yield [address, queue.shift()!]
        } else {
          // queue was empty, so queue this item and switch the family we're looking for
          queue.push(address);
          next = family === 6 ? 4 : 6;
        }
      }
    } else {
      queue.push(address)
    }
  }
  // The leftover from the queue are all from the same family
  // so, just return a single-value array to try one at a time
  for (const addr of queue) {
    yield [addr];
  }
}