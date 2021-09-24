import { Server } from 'http';
import _fetch, { RequestInfo, RequestInit } from 'node-fetch'
import { createTestServer } from '../test/server';
import { expect, test } from '../test/test';
import { getOptions, heConnect } from './he-connect';

export default async function fetch(url: RequestInfo, init?: RequestInit) {
  if (typeof url !== 'string') {
    return _fetch(url, init);
  }
  const socket = await heConnect(url)
  return _fetch(url, {
    ...init,
    ...getOptions(socket),
  });
}

test('node fetch', async () => {
  let server: Server, port: number;
  test('setup', async () => {
    ({server, port} = await createTestServer());
  });

  test('can browser fetch', async () => {
    const resp = await fetch(`https://google.com`);
    expect(resp.status).toBe(200);
    expect(await resp.text()).toBe('OK')
  });

  test('teardown', () => {
    server.close();
  });
})