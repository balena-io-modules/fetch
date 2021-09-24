import * as net from 'net';
import * as tls from 'tls';
import * as dns from 'dns/promises';
import { debuglog, promisify } from 'util';
import { URL } from 'url';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { LookupAddress } from 'dns';

const debug = debuglog('@balena/fetch-debug');
const verbose = debuglog('@balena/fetch-verbose');

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
  const {hostname, protocol} = url;
  const port = url.port.length ? Number(url.port) : (protocol === "https:" ? 443 : 80);
  const preferred = lastSuccessful[url.hostname];
  const lookups = await dns.lookup(hostname, {
    verbatim: true,
    family: 0,
    all: true,
  });
  const addrs = await getAddrInfo(lookups, preferred);

  let err: Error;
  const sockets: net.Socket[] = [];
  let ctFound = false;
  const setFound = () => ctFound = true;
  let failed = 0;
  for (const host of addrs) {
    if (ctFound) {
      break;
    }
    debug(`Trying ${host}...`);
    // @ts-ignore the options are the same for {net,tls}.connect, except for servername
    // which gets ignored by net.connect
    const socket = (protocol === 'https:' ? tls : net).connect({
      host,
      port,
      servername: hostname,
    }).on('connect', () => {
      // @ts-ignore
      if (net.isIPv4(host)) {
        lastSuccessful[hostname]  = 4;
      } else {
        lastSuccessful[hostname] = 6;
      }
      cb(undefined, socket);
      debug('Connected to', socket.remoteAddress);
      ctFound = true;
      for (const sock of sockets) {
        if (sock !== socket) {
          sock.destroy();
        }
      }
    })
    .on('error', (error: any) => {
      if (sockets.indexOf(socket) === 0) {
        err = error
      }
      if (++failed === lookups.length) {
        // reject with error from first ip address
        cb(err);
      }
    })
    sockets.push(socket)
    // give each connection 300 ms to connect before trying next one
    await promisify(setTimeout)(300)
  }
}

export function*getAddrInfo(lookups: LookupAddress[], preferred: number | undefined) {
  if (!lookups.length) return;
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
          yield [address, queue.shift()]
        } else {
          // if there was no queue item, create one, and switch `next`
          // to the opposite family.
          queue.push(address);
          next = family === 6 ? 4 : 6;
        }
      } else {
        // we've seen this host before, so we just return one at a time
        // we still alternate though, in case network has changed
        yield address;
        if (queue.length) {
          // If there was a queue, that means it holds the opposite family
          // so go ahead and yield that item too
          yield queue.shift() as string;
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
    yield addr;
  }
}