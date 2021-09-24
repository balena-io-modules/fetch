import chalk from 'chalk'
import _expect from 'expect'
import { TESTING } from './constants';
// this will all be tree-shaken

const noop = () => {}

type TestFn = (...args: any) => any | void
let tests: Array<[number, string, TestFn]> = [];

let depth = 0;
export const test = TESTING ? async (name: string, fn: TestFn) => {
  tests.push([depth, name, fn]);
} : noop;

export const expect = TESTING ? _expect : noop as unknown as typeof _expect;

export const run = TESTING ? async () => {
  let cur;
  while (cur = tests.shift()) {
    const [_depth, name, fn] = cur;
    try {
      depth++
      await fn();
      console.log(' '.repeat(_depth) + chalk.green('✓'), name)
    } catch (error: any) {
      console.error(' '.repeat(_depth) + chalk.red('☓'), name)
      console.error(chalk.red(error))
      console.error(error?.stack)
    }
    depth--
  }
} : noop