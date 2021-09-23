import { Server } from 'http';
import fetch from 'node-fetch'
import { createTestServer } from '../test/server';
import { expect, test } from '../test/test';
export default fetch

test('node fetch', async () => {
  let server: Server, port: number;
  test('setup', async () => {
    ({server, port} = await createTestServer());
  });

  test('can browser fetch', async () => {
    const resp = await fetch(`http://localhost:${port}`);
    expect(resp.status).toBe(200);
    expect(await resp.text()).toBe('It works!')
  });

  test('teardown', () => {
    server.close();
  });
})