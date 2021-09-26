import { LookupAddress, LookupOptions } from 'dns';
import * as dns from 'dns/promises'
import { Server } from "http";
import { inspect } from 'util';
import { createTestServer } from "../test/server";
import { expect, test } from "../test/test";
import fetch from "./node";

test('node', async () => {
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

  test.skip('with incorrect addresses', async () => {
    await fetch(`https://google.com`, {
      lookup: async (hostname, cb) => {
        const realResults = await dns.lookup(hostname, {all: true, family: 0});
        return [
          {
            family: 6,
            address: 'dead::beef',
          },
          {
            family: 4,
            address: '225.25.235.34',
          },
          ...realResults,
        ]
      }
    });
  });

  test('with many incorrect addresses', async () => {
    await fetch(`https://www.google.com`, {
      lookup: async (hostname: string, options: LookupOptions) => {
        const realResults = await dns.lookup(hostname, options) as LookupAddress[];
        return [
          {
            family: 6,
            address: 'dead::beef',
          },
          {
            family: 4,
            address: '225.25.235.34',
          },
          {
            family: 6,
            address: 'de3d::beef',
          },
          {
            family: 4,
            address: '215.25.235.34',
          },
          {
            family: 6,
            address: 'deaf::beej',
          },
          {
            family: 4,
            address: '215.25.233.31',
          },
          ...realResults,
        ];
      }
    });
  });
});
