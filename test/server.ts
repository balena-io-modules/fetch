import { Server } from 'http';

const TESTING = process.env.NODE_ENV === 'test'
const noop = () => {}

export const createTestServer = (TESTING ? async () => {
  const {createServer} = await import('http');
  return new Promise((res, rej) => {
    const server = createServer((req, res) => {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
      })
      res.write('It works!');
      res.end();
      req.destroy();
    })
    .listen(() => {
      // @ts-ignore @types/node is wrong here
      const {port} = server.address()
      res({server, port})
    })
    .on('error', rej)
  })
} : noop) as () => Promise<{server: Server, port: number}>;
