import AbortController from 'abort-controller';
import { LookupAddress, LookupOptions } from 'dns';
import {lookup as lookupSync} from 'dns'
import { Server } from "http";
import { promisify } from 'util';
import { createTestServer } from "../test/server";
import { expect, test } from "../test/test";
import fetch from "./node";
const lookup = promisify(lookupSync);

test.parallel('node', async () => {
  test('can fetch local', async () => {
    let server: Server, port: number;
    ({server, port} = await createTestServer());
    const resp = await fetch(`http://localhost:${port}`);
    expect(resp.status).toBe(200);
    expect(await resp.text()).toBe('It works!')
    server.close();
  })

  test('can fetch api', async () => {
    const resp = await fetch(`https://api.balena-cloud.com/ping`);
    expect(resp.status).toBe(200);
    expect(await resp.text()).toBe('OK')
  });

  test('follow redirects', async () => {
    const resp = await fetch(`https://google.com`);
    expect(resp.status).toBe(200);
  });
});

test.parallel('incorrect addresses', () => {
  test('with incorrect addresses', async () => {
    await fetch(`https://google.com`, {
      lookup: async (hostname, cb) => {
        const realResults = await lookup(hostname, {all: true, family: 0});
        return [
          ...getFakeAddresses(1),
          ...realResults,
        ]
      }
    });
  });

  test('fail with all incorrect addresses', async () => {
    try {
      await fetch(`https://www.google.com`, {
        lookup: async () => getFakeAddresses(20),
        delay: 2,
        timeout: 1,
      })
      throw new Error('Request should not succeed with incorrect addresses.');
    } catch (err: any) {
      expect(err.message.includes('timed out')).toBe(true);
    }
  })

  test('spam all IPs with many incorrect addresses', async () => {
    const start = Date.now();
    await fetch(`https://www.google.com`, {
      lookup: async (hostname: string, options: LookupOptions) => {
        const realResults = await lookup(hostname, options) as LookupAddress[];
        return [
          ...getFakeAddresses(20),
          ...realResults,
        ];
      },
      delay: 1,
    });
    if (start - Date.now() > 1000) {
      throw new Error('Could not connect in time.')
    }
  });

  test('can abort requests', async () => {
    const ac = new AbortController();
    try {
      const prom = fetch(`https://www.google.com`, {
        delay: 0,
        signal: ac.signal,
        lookup: async () => getFakeAddresses(1)
      });
      ac.abort();
      await prom;
      throw new Error('Request was not aborted.')
    } catch (err: any) {
      expect(err.name).toBe('AbortError');
    }
  });

  function getFakeAddresses(num: number) {
    const result = [];
    while (--num) {
      result.push({
        family: 6,
        address: 'dead::' + num.toString(16),
      }, {
        family: 4,
        address: '192.168.1.' + num,
      })
    }
    return result;
  }
})
process.on('unhandledRejection', (err:any) => {
  console.error('unhandled rejection', err);
})