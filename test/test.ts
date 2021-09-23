import chalk from 'chalk'
import _expect from 'expect'
import { Server } from 'http';
// this will all be tree-shaken

const noop = () => {}

type TestFn = (...args: any) => any | void
let tests: Array<[number, string, TestFn]> = [];

let depth = 0;

const TESTING = process.env.NODE_ENV === 'test'

export const test = TESTING ? async (name: string, fn: TestFn) => {
  tests.push([depth, name, fn]);
  if (!depth) {
    depth++;
    await run();
    depth--
  }
} : noop;

export const expect = TESTING ? _expect : noop as unknown as typeof _expect;

export const run = TESTING ? async () => {
  let cur;
  while (cur = tests.shift()) {
    const [_depth, name, fn] = cur;
    try {
      depth++
      await fn();
      depth--
      console.log(' '.repeat(_depth) + chalk.green('✓'), name)
    } catch (error: any) {
      console.error(' '.repeat(_depth) + chalk.red('☓'), name)
      console.error(chalk.red(error))
      console.error(error?.stack)
    }
  }
} : noop

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

if (TESTING && process.argv.includes('-w')) {
  ;(async () => {
    const fs = await import ('fs');
    const files = process.argv.filter(file => /\.ts$/.test(file))
    for (const file of files) {
      fs.watchFile(file, () => {
        delete require.cache[file]
        import(file)
      })
    }
  })()
}