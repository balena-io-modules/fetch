import * as net from 'net';
import * as tls from 'tls';
import * as dns from 'dns/promises';
import { promisify } from 'util';
import { URL } from 'url';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { Socket } from 'dgram';

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
  const socket = new net.Socket();
  heConnect(url, socket)
  return socket
}

let lastUsed = 6;
export async function heConnect(url: URL, socket: net.Socket): Promise<void> {
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
  console.log(addrs, lastUsed)
  if (addrs.length < 1) {
    throw new Error(`Could not resolve host, ${hostname}`)
  }

  let err: Error;
  let ctFound = false;
  let failed = 0;
  for (let i = 0; i < addrs.length; i++) {
    if (ctFound) {
      break;
    }
    const host = addrs[i];
    console.log('trying', host);
    // @ts-ignore
    (protocol === 'https:' ? tls : net).connect({
      socket,
      host,
      port: port,
      servername: hostname,
    });
    // give each connection 300 ms to connect before trying next one
    await promisify(setTimeout)(300)
  }
}