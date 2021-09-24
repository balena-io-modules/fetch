import * as net from 'net';
import * as tls from 'tls';
import * as dns from 'dns/promises';
import { debuglog, promisify } from 'util';
import { URL } from 'url';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

const debug = debuglog('happy-eyes');
const verbose = debuglog('happy-eyes-verbose');

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
  const {port:_port, hostname, protocol} = url;
  const port = _port.length ? Number(_port) : (protocol === "https:" ? 443 : 80);
  const lookups = await dns.lookup(hostname, {
    verbatim: true,
    family: 0,
    all: true,
  })

  const v4 = lookups.filter(lookup => lookup.family === 4);
  const v6 = lookups.filter(lookup => lookup.family === 6);
  const _lastUsed = lastUsed[hostname] ?? lastUsedPeriod;
  const addrs = (_lastUsed === 0 ? lookups : _lastUsed === 4 ? [...v4, ...v6] : [...v6, ...v4]).map(lookup => lookup.address);
  if (addrs.length < 1) {
    throw new Error(`Could not resolve host, ${hostname}`)
  }

  let err: Error;
  const sockets: net.Socket[] = [];
  let ctFound = false;
  let failed = 0;
  for (let i = 0; i < addrs.length; i++) {
    if (ctFound) {
      break;
    }
    const host = addrs[i]
    debug(`Trying ${host}...`);
    // @ts-ignore
    const socket = (protocol === 'https:' ? tls : net).connect({
      host,
      port: port,
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
        if (i !== j) {
          if (!sockets[j].destroyed) {
            sockets[j].destroy()
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
        // socket.emit('error', err)
      }
    })
    sockets.push(socket)
    // give each connection 300 ms to connect before trying next one
    await promisify(setTimeout)(300)
  }
}