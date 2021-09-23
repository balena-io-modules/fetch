import * as net from 'net';
import * as dns from 'dns/promises';
import { promisify } from 'util';
import { URL } from 'url';
import { RequestInit } from 'node-fetch';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

export class HESAgent extends HttpsAgent {
  createConnection = heConnect
}

export class HEAgent extends HttpAgent {
  createConnection = heConnect
}

export const options: RequestInit = {
  agent: function(parsedURL) {
    if (parsedURL.protocol === 'https') {
      return new HESAgent
    } else {
      return new HttpAgent
    }
  }
}

let lastUsed = 0;
export async function heConnect(url: string): Promise<net.Socket> {
  const {port, hostname} = (new URL(url));
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

  return new Promise(async (res, rej) => {
    let err: Error;
    const sockets: net.Socket[] = [];
    let ctFound = false;
    let failed = 0;
    for (let i = 0; i < addrs.length; i++) {
      if (ctFound) {
        break;
      }
      const addr = addrs[i]
      const socket = net.createConnection({
        host: addr,
        port: Number(port),
      }).on('connect', () => {
        ctFound = true;
        for (let j = 0; j < sockets.length; j++) {
          if (i !== j) {
            sockets[i].destroy()
          }
        }
        res(socket);
      }).on('error', (error) => {
        failed++;
        if (i === 0) {
          err = error
        }
        if (failed === addrs.length) {
          for (const socket of sockets) {
            socket.destroy();
          }
          // reject with error from first ip address
          rej(err);
        }
      })
      sockets.push(socket)
      // give each connection 300 ms to connect before trying next one
      await promisify(setTimeout)(300)
    }
  })
}