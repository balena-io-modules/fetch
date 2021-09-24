import * as net from 'net';
import * as tls from 'tls';
import * as dns from 'dns/promises';
import { debuglog, promisify } from 'util';
import { URL } from 'url';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

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
  const addrs = await getAddrInfo(url.hostname);

  let err: Error;
  const sockets: net.Socket[] = [];
  let ctFound = false;
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
      if (++failed === addrs.length) {
        // reject with error from first ip address
        cb(err);
      }
    })
    sockets.push(socket)
    // give each connection 300 ms to connect before trying next one
    await promisify(setTimeout)(300)
  }
}

export async function getAddrInfo(hostname: string) {
  let preferred = lastSuccessful[hostname];
  const lookups = await dns.lookup(hostname, {
    verbatim: true,
    family: 0,
    all: true,
  });
  if (!preferred) {
    preferred = lookups[0].family;
  }

  const result: string[] = [];
  let next = preferred;
  const queue: string[] = [];
  for (const {address, family} of lookups) {
    if (family === next) {
      result.push(address);
      if (queue.length) {
        result.push(queue.shift() as string);
      } else {
        next = next === 6 ? 4 : 6;
      }
    } else {
      queue.push(address)
    }
  }
  return result.concat(queue);
}