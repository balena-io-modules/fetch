import * as net from 'net';
import * as tls from 'tls';
import * as dns from 'dns/promises';
import { debuglog, promisify } from 'util';
import { URL } from 'url';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { LookupAddress } from 'dns';
import { createBrotliCompress } from 'zlib';

const debug = debuglog('@balena/fetch-debug');
const verbose = debuglog('@balena/fetch-verbose');
const sleep = promisify(setTimeout);

export const options = {
  agent: function(parsedURL: URL) {
    if (parsedURL.protocol === 'https:') {
      return new class extends HttpsAgent {
        createConnection = createConnection
      }
    } else {
      return new class extends HttpAgent {
        createConnection = createConnection
      }
    }
  }
}

function createConnection(url:URL, cb: (err: Error | undefined, socket?: net.Socket) => void) {
  heConnect(url, cb)
}


const lastSuccessful: {[host: string]: number | undefined} = {};
export async function heConnect(url: URL, cb: (err: Error | undefined, socket?: net.Socket) => void): Promise<void> {
  debug('Connecting to', url.hostname)
  const {hostname} = url;
  const preferred = lastSuccessful[url.hostname];
  const lookups = await dns.lookup(hostname, {
    verbatim: true,
    family: 0,
    all: true,
  });
  if (!lookups.length) {
    throw new Error(`Could not resolve host, ${hostname}`);
  }
  const addrs = await getAddrInfo(lookups, preferred);
  const sockets: net.Socket[] = [];
  const catcher = (() => {
    let numErrs = 0;
    let firstError: Error;
    return (err: Error) => {
      if (numErrs === 0) {
        firstError = err;
      }
      numErrs++;
      if (numErrs === lookups.length) {
        cb(err);
      }
    }
  })();
  const onConnect = (socket: net.Socket) => {
    cb(undefined, socket);
  }
  for await (const socket of createConnections(url, 3000, ...addrs)) {
    sockets.push(socket);
    socket.on('first-connect', onConnect);
    socket.on('error', catcher);
  }
}

export async function*createConnections(url: URL, delay: number, ...addrs: string[][]) {
  const {protocol, hostname} = url;
  const port = url.port.length ? Number(url.port) : (protocol === "https:" ? 443 : 80);

  const sockets: net.Socket[] = [];
  let ctFound = false;
  let i = 0;
  for (const tuple of addrs) {
    for (const host of tuple) {
      const index = i++;
      if (ctFound) {
        break;
      }
      debug(`Trying ${host}...`);
      const socket = (protocol === 'https:' ? tls : net as unknown as typeof tls).connect({
        host,
        port,
        servername: hostname,
      });
      sockets.push(socket);
      socket.on('connect', () => {
        if (ctFound) {
          return;
        }
        ctFound = true;
        for (let i = 0; i < sockets.length; i++) {
          if (i !== index) {
            debug('destroying', i, sockets[i].remoteAddress);
            sockets[i].unref();
            sockets[i].destroy();
          }
        }
        socket.emit('first-connect', socket);
        if (net.isIPv4(host)) {
          lastSuccessful[hostname]  = 4;
        } else {
          lastSuccessful[hostname] = 6;
        }
        debug('Connected to', socket.remoteAddress);
      })
      yield socket;
    }
    // give each connection 300 ms to connect before trying next one
    await sleep(delay);
  }
}

export function*getAddrInfo(lookups: LookupAddress[], preferred: number | undefined): Iterable<string[]> {
  let next = preferred ?? lookups[0].family;
  const queue: string[] = [];
  for (const {address, family} of lookups) {
    if (family === next) {
      // if there is no preferred address, give tuples of IPv6 and IPv4 addresses
      // try both at the same time.
      if (!preferred) {
        if (queue.length) {
          // queue will always hold the opposite of what we're looking for
          // If there is an item on the queue, we have found a pair.
          yield [address, queue.shift() as string]
        } else {
          // if there was no queue item, create one, and switch `next`
          // to the opposite family.
          queue.push(address);
          next = family === 6 ? 4 : 6;
        }
      } else {
        // we've seen this host before, so we just return one at a time
        // we still alternate though, in case network has changed
        yield [address];
        if (queue.length) {
          // If there was a queue, that means it holds the opposite family
          // so go ahead and yield that item too
          yield [queue.shift()] as string[];
        } else {
          // There was no queue item. So, we queue this item and
          // switch `next` to the opposite family
          queue.push(address);
          next = family === 6 ? 4 : 6;
        }
      }
    } else {
      queue.push(address)
    }
  }
  for (const addr of queue) {
    yield [addr];
  }
}

function createDeferredPromise<T = any>(): {
  promise: Promise<T>;
  res: Promise<T>;
  rej: typeof Promise['reject'];
} {
  let res: (item: T) => void;
  let rej: (err: any) => void;
  const promise = new Promise<T>((_res, _rej) => {
    res = _res;
    rej = _rej;
  })
  // @ts-ignore
  return {promise, res, rej}
}