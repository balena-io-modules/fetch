import * as net from 'net';
import * as tls from 'tls';
import * as dns from 'dns/promises';
import { promisify } from 'util';
import { URL } from 'url';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

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

let lastUsed = 0;
export async function heConnect(url: URL, cb: (err: Error | undefined, socket?: net.Socket) => void): Promise<void> {
  const {port:_port, hostname, protocol} = url;
  const port = _port.length ? Number(_port) : (protocol === "https:" ? 443 : 80);
  const lookups = await dns.lookup(hostname, {
    verbatim: true,
    family: 0,
    all: true,
  })

  const v4 = lookups.filter(lookup => lookup.family === 4);
  const v6 = lookups.filter(lookup => lookup.family === 6);
  const addrs = (lastUsed === 4 ? [...v4, ...v6] : [...v6, ...v4]).map(lookup => lookup.address);
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
    // @ts-ignore
    const socket = (protocol === 'https:' ? tls : net).connect({
      host,
      port: port,
      servername: hostname,
    }).on('connect', () => {
      ctFound = true;
      for (let j = 0; j < sockets.length; j++) {
        cb(undefined, socket)
        if (i !== j) {
          if (!sockets[i].destroyed) {
            sockets[i].destroy()
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