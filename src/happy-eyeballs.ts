import * as net from 'net';
import * as tls from 'tls';
import * as dns from 'dns';
import { debuglog, promisify } from 'util';
import { URL } from 'url';
import { LookupAddress, LookupOptions } from 'dns';
import { RequestInit as NFRequestInit } from 'node-fetch'
import AbortError from './abort-error';
import { AbortController, AbortSignal } from 'abort-controller';
import {once} from 'events';

const dnsLookup = promisify(dns.lookup);

const DEFAULT_NEXT_ADDR_DELAY = 300;
const DEFAULT_LOOKUP_OPTIONS = Object.freeze({
  verbatim: true,
  family: 0,
  all: true,
});

const debug = debuglog('@balena/fetch-debug');
// const verbose = debuglog('@balena/fetch-verbose');

// hash of hosts and last associated connection family
const familyCache = new Map<string, number>();

export type BalenaRequestInit = NFRequestInit & RequestInit & {
  secure: boolean;
  delay?: number; // ms delay between requests
  lookup?: (hostname: string, options: LookupOptions) => Promise<LookupAddress | LookupAddress[]>;
  family?: number;
  hints?: number;
  signal?: AbortSignal;
  timeout?: number;
};

export async function happyEyeballs(url: URL, init: BalenaRequestInit, cb: (err: Error | undefined, socket?: net.Socket) => void) {
  const {hostname} = url;
  debug('Connecting to', hostname);

  const lookups = (await (init.lookup || dnsLookup)(hostname, {
    ...DEFAULT_LOOKUP_OPTIONS,
    family: init.family || DEFAULT_LOOKUP_OPTIONS.family,
    hints: init.hints,
  })) as LookupAddress[];
  if (!lookups.length) {
    cb(new Error(`Could not resolve host, ${hostname}`));
  }

  const sockets = new Map<string, net.Socket>();
  init.signal?.addEventListener('abort', () => {
    debug('Received abort signal, destroying all sockets.');
    for (const socket of sockets.values()) {
      socket.destroy();
    }
    cb(new AbortError);
  })
  const port = url.port.length ? Number(url.port) : (init.secure ? 443 : 80);

  let trying = lookups.length;
  let err: Error;
  function onError(this: net.Socket, _err:any) {
    if (init.signal?.aborted){
      return;
    }
    debug('Got error', _err)

    // Only use the value of the first error, as that was the one most likely to succeed
    if (!err){
      err = _err
    }

    this.destroy();

    debug('trying', trying)
    if (!--trying) {
      if (Array.from(sockets.values()).every(s => s.destroyed)) {
        debug('all sockets destroyed');
      }
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
    familyCache.set(hostname, net.isIP(this.remoteAddress!));
    cb(undefined, this);
  }

  for (const batch of zip(lookups, familyCache.get(hostname))) {
    debug('batch', batch);
    if (ctFound || init.signal?.aborted) {
      return;
    }

    for (const addr of batch) {
      debug(`Trying ${addr}...`);
      const socket = (new net.Socket())
        .connect({
          host: addr,
          port,
        });
      if(init.timeout) {
        debug('Setting timeout, ' + init.timeout);
        socket.setTimeout(init.timeout);
        socket.on('timeout', function(this: net.Socket) {
          --trying;
          this.destroy();
          if (!trying) {
            if (Array.from(sockets.values()).every(s => !s.destroyed)) {
              cb(err || new Error('All connection attempts to ' + hostname + ' timed out.'))
            }
          }
          debug(`Request to ${addr} timed out...`)
        })
      }
      const ct = init.secure ? tls.connect({
        socket,
        servername: hostname,
        timeout: init.timeout,
      }) : socket;
      sockets.set(addr, ct);
      ct
        .on('connect', onConnect)
        .on('error', onError);
    }

    // abort the delay if all sockets close before the delay runs out,
    const {abort:_abort, signal} = new AbortController();
    const abort = () => {
      debug('Aborting delay promise');
      _abort();
    };
    init.signal?.addEventListener('abort', abort);
    Promise.all(batch
      .map(addr => sockets.get(addr))
      .map(sck => Promise.race([
        once(sck!, 'close', {signal}),
        once(sck!, 'error', {signal}),
      ]))
    )
      .then(() => abort())
      .catch(() => {});

    try {
      // give each connection 300 ms to connect before trying next one
      await wait(init.delay || DEFAULT_NEXT_ADDR_DELAY, signal);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        throw err;
      }
    }
    init.signal?.removeEventListener('abort', abort);
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
    if (family === next || !next) {
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

// We may want to abort a wait to keep the wait handle from keeping the process open
const wait = async (ms: number, signal?: AbortSignal) => {
  return signal?.aborted ?
    Promise.reject(new AbortError()) :
    new Promise<void>((res, rej) => {
      const onAbort = () => {
        clearTimeout(timeout);
        rej(new AbortError());
      };
      const timeout = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        res();
      }, ms);
      signal?.addEventListener('abort', onAbort);
  });
}
