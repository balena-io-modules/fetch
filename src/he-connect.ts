import * as net from 'net';
import * as tls from 'tls';
import * as dns from 'dns/promises';
import { debuglog, promisify } from 'util';
import { URL } from 'url';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

const debug = debuglog('@balena/fetch');
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


const lastUsed: {[host: string]: 4 | 6 | undefined} = {};
let lastUsedPeriod = 0;
export async function heConnect(url: URL, cb: (err: Error | undefined, socket?: net.Socket) => void): Promise<void> {
  debug('Connecting to', url.hostname)
  const {hostname, protocol} = url;
  const port = url.port.length ? Number(url.port) : (protocol === "https:" ? 443 : 80);
  const addrs = Array.from(await getAddrInfo(url.hostname));

  // const v4 = lookups.filter(lookup => lookup.family === 4);
  // const v6 = lookups.filter(lookup => lookup.family === 6);
  // const _lastUsed = lastUsed[hostname] ?? lastUsedPeriod;
  // const addrs = _lastUsed === 0 ? lookups :

  // for (let i = 0; i < Math.max(v4.length,v6.length); i++) {
  //   addrs.push((_lastUsed === 0 ? lookups : _lastUsed === 4 ? v4[i] : v6[i]).address);
  // }


  // // (_lastUsed === 0 ? lookups : _lastUsed === 4 ? [...v4, ...v6] : [...v6, ...v4]).map(lookup => lookup.address);
  // if (addrs.length < 1) {
  //   throw new Error(`Could not resolve host, ${hostname}`)
  // }

  let err: Error;
  const sockets: net.Socket[] = [];
  let ctFound = false;
  let failed = 0;
  let i = 0;
  // @ts-ignore
  for (const host of addrs) {
    if (ctFound) {
      break;
    }
    debug(`Trying ${host}...`);
    // @ts-ignore the options are thesame for {net,tls}.connect, except for servername
    // which gets ignored by net.connect
    const socket = (protocol === 'https:' ? tls : net).connect({
      host,
      port,
      servername: hostname,
    }).on('connect', () => {
      if (net.isIPv4(host)) {
        lastUsed[hostname] = lastUsedPeriod = 4;
      } else {
        lastUsed[hostname] = lastUsedPeriod = 6;
      }
      debug('Connected to', addrs[i]);
      ctFound = true;
      for (let j = 0; j < sockets.length; j++) {
        cb(undefined, socket)
        for (const sock of sockets) {
          if (sock !== socket) {
            sock.destroy();
          }
        }
      }
    })
    .on('error', (error: any) => {
      failed++;
      if (i === 0) {
        err = error
      }
      if (failed === addrs.length) {
        for (const socket of sockets) {
          socket.destroy();
        }
        // reject with error from first ip address
        cb(err);
      }
    })
    i++;
    sockets.push(socket)
    // give each connection 300 ms to connect before trying next one
    await promisify(setTimeout)(300)
  }
}

export async function getAddrInfo(hostname: string) {
  let preferred = lastUsed[hostname] ?? lastUsedPeriod;
  const lookups = await dns.lookup(hostname, {
    verbatim: true,
    family: 0,
    all: true,
  });
  if (!preferred) {
    preferred = lookups[0].family;
  }

  const primary = lookups.filter(lookup => lookup.family === preferred).map(l => l.address);
  const alternate = lookups.filter(lookup => lookup.family !== preferred).map(l => l.address);

  let i = 0;
  return (function*() {
    let next;
    while (next = !(i%2) ? primary[i++/2|0] || alternate[i++/2|0] : alternate[i++/2|0] || primary[i++/2|0]) {
      yield next;
    }
  })()
}