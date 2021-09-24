import { Server } from 'http';
import { createTestServer } from '../test/server';
import { expect, test } from '../test/test';

test('browser fetch', async () => {
  let server: Server, port: number;
  test('setup', async () => {
    const {JSDOM} = await import('jsdom');
    const {window} = new JSDOM;
    global.XMLHttpRequest = window.XMLHttpRequest;
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
