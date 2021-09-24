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

test('node', async () => {
  let server: Server, port: number;
  test('setup', async () => {
    ({server, port} = await createTestServer());
  });

  test('can fetch api', async () => {
    const resp = await fetch(`https://google.com`);
    expect(resp.status).toBe(200);
    expect(await resp.text()).toBe('OK')
  });

  test('can fetch api', async () => {
    const resp = await fetch(`https://api.balena-cloud.com/ping`);
    expect(resp.status).toBe(200);
    expect(await resp.text()).toBe('OK')
  });

  test('can fetch local', async () => {
    const resp = await fetch(`http://localhost:${port}`);
    expect(resp.status).toBe(200);
    expect(await resp.text()).toBe('It works!')
  });

  test('teardown', () => {
    server.close();
  });
})