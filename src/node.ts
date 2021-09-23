import { Server } from 'http';
import _fetch, { RequestInfo, RequestInit } from 'node-fetch'
import { createTestServer } from '../test/server';
import { expect, test } from '../test/test';
import { options } from './he-connect';
export default async function fetch(url: RequestInfo, init?: RequestInit) {
  if (typeof url !== 'string') {
    return _fetch(url, init);
  }
  return _fetch(url, {
    ...init,
    ...options
  });
}

test('node fetch', async () => {
  let server: Server, port: number;
  test('setup', async () => {
    ({server, port} = await createTestServer());
  });

  test('can browser fetch', async () => {
    const resp = await fetch(`http://localhost:${port}`);
    expect(resp.status).toBe(200);
    const cloned = resp.clone();
    expect(await resp.text()).toBe('It works!')
  });

  test('teardown', () => {
    server.close();
  });
})