import { Server } from "http";
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

  test('follow redirects', async () => {
    const resp = await fetch(`https://google.com`);
    expect(resp.status).toBe(200);
  });
});
