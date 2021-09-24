import { Server } from "http";
import { debuglog } from "util";
import { createTestServer } from "../test/server";
import { expect, test } from "../test/test";
import fetch from "./node";

const noop = () => {}
const debug = process.env.NODE_DEBUG?.includes('@balena/fetch') ? console.debug : noop;

test('node', async () => {
  let server: Server, port: number;
  test('setup', async () => {
    ({server, port} = await createTestServer());
  });

  test('can fetch local', async () => {
    const resp = await fetch(`http://localhost:${port}`);
    expect(resp.status).toBe(200);
    expect(await resp.text()).toBe('It works!')
  });

  test('can fetch api', async () => {
    const resp = await fetch(`https://api.balena-cloud.com/ping`);
    expect(resp.status).toBe(200);
    expect(await resp.text()).toBe('OK')
  });

  test('follow redirects', async () => {
    const resp = await fetch(`https://google.com`);
    debug('why doesn\'t this work?');
    debug(await resp.text());
    expect(resp.status).toBe(200);
    // expect(await resp.text()).toBe('OK')
  });

  test('teardown', () => {
    server.close();
  });
});