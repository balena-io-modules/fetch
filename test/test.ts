import chalk from 'chalk';
import _expect from 'expect';
import { TESTING, MANUAL } from './constants';

// this will all be tree-shaken

// tslint:disable-next-line:no-empty
const noop = () => {};

type TestFn = (...args: any) => any | void;
const tests: Array<[number, string, TestFn]> = [];

type Test = {
	(name: string, fn: TestFn): void;
	manual: (name: string, fn: TestFn) => void;
	skip: (...args: any[]) => any;
};

let depth = 0;
export const test = (TESTING
	? async (name: string, fn: TestFn) => {
			tests.push([depth, name, fn]);
	  }
	: noop) as unknown as Test;

test.manual =
	TESTING && MANUAL
		? async (name: string, fn: TestFn) => {
				tests.push([depth, name, fn]);
		  }
		: noop;

test.skip = noop;

export const expect = TESTING ? _expect : (noop as unknown as typeof _expect);

// tslint:disable:no-conditional-assignment
export const run =
	(TESTING &&
		(async () => {
			let cur;
			while ((cur = tests.shift())) {
				const [_depth, name, fn] = cur;
				try {
					depth++;
					await fn();
					console.log(' '.repeat(_depth) + chalk.green('✓'), name);
				} catch (error: any) {
					console.error(' '.repeat(_depth) + chalk.red('☓'), name);
					console.error(chalk.red(error));
					console.error(error?.stack);
				}
				depth--;
			}
		})) ||
	noop;
