import * as net from 'net';
import * as tls from 'tls';
import * as dns from 'dns/promises';
import { debuglog, promisify } from 'util';
import { URL } from 'url';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { LookupAddress } from 'dns';

const NEXT_ADDR_DELAY = 300;

const debug = debuglog('@balena/fetch-debug');
const verbose = debuglog('@balena/fetch-verbose');
const sleep = promisify(setTimeout);
const lastSuccessful: {[host: string]: number | undefined} = {};

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
  ;(async () => {
    debug('Connecting to', url.hostname)
    try {
      cb(undefined, await happyEyeballs(url));
    } catch (err:any) {
      cb(err)
    }
  })()
}



export async function happyEyeballs(url: URL) {
  return new Promise<net.Socket>(async (res, rej) => {
    const {hostname, protocol} = url;
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
    const port = url.port.length ? Number(url.port) : (protocol === "https:" ? 443 : 80);

    let numErrs = 0;
    let firstError: Error;
    const sockets: net.Socket[] = [];
    let ctFound = false;
    for (const tuple of addrs) {
      if (ctFound) {
        break;
      }
      for (const host of tuple) {
        debug(`Trying ${host}...`);
        const socket = (protocol === 'https:' ? tls : net as unknown as typeof tls).connect({
          host,
          port,
          servername: hostname,
        }).on('connect', () => {
          if (ctFound) {
            socket.destroy();
            return;
          }
          res(socket);
          ctFound = true;
          for (const s of sockets) {
            if (s !== socket) {
              debug('Destroying', s.remoteAddress);
              s.destroy();
            }
          }
          if (net.isIPv4(host)) {
            lastSuccessful[hostname]  = 4;
          } else {
            lastSuccessful[hostname] = 6;
          }
          debug('Connected to', socket.remoteAddress);
        }).on('error', (err: Error) => {
          if (numErrs === 0) {
            firstError = err;
          }
          numErrs++;
          if (numErrs === lookups.length) {
            rej(err);
          }
        })
        sockets.push(socket);
      }
      // give each connection 300 ms to connect before trying next one
      await sleep(NEXT_ADDR_DELAY);
    }
  })
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