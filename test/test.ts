import chalk from 'chalk';
import _expect from 'expect';
import { TESTING, MANUAL } from './constants';

// this will all be tree-shaken

// tslint:disable-next-line:no-empty
const noop = () => {};

type TestFn = {
	(...args: any): any | void;
	only?: boolean;
}

type TestData = {
	depth: number;
	name: string;
	fn: TestFn;
	only?: boolean;
	skip?: boolean;
}
const tests: Array<TestData> = [];

type Test = {
	(name: string, fn: TestFn): void;
	manual: (name: string, fn: TestFn) => void;
	skip: (...args: any[]) => any;
	only: (name: string, fn: TestFn) => any;
};

let depth = 0;
export const test = (TESTING
	? async (name: string, fn: TestFn) => {
			tests.push({depth, name, fn});
	  }
	: noop) as unknown as Test;

test.manual =
	TESTING && MANUAL
		? async (name: string, fn: TestFn) => {
				tests.push({depth, name, fn});
		  }
		: noop;

test.skip = (TESTING
	? (name: string, fn: TestFn) => {
			tests.push({depth, name, fn, skip: true});
	  }
	: noop) as unknown as Test;

test.only = (TESTING
	? (name: string, fn: TestFn) => {
			tests.push({depth, name, fn, only: true});
	  }
	: noop) as unknown as Test;


export const expect = TESTING ? _expect : (noop as unknown as typeof _expect);

// tslint:disable:no-conditional-assignment
export const run =
	(TESTING &&
		(async () => {
			if (tests.length === 0) {
				return;
			}

			const getOnlys = (tests: TestData[]) => {
				const onlys = tests.filter(test => test.only);
				return (onlys.length && onlys) || tests;
			}

			const batch = tests.slice();
			tests.length = 0;

			for (const test of getOnlys(batch)) {
				const {depth:_depth, name, fn, only, skip} = test;
				const indent = ' '.repeat(_depth);
				if (skip) {
					console.log(indent + chalk.yellow('○'), name);
					continue;
				}
				try {
					depth++;
					await fn();
					console.log(indent + chalk.green('✓'), name);
				} catch (error: any) {
					console.error(indent + chalk.red('☓'), name);
					console.error(chalk.red(error));
					console.error(error?.stack);
				}
				await run();
				depth--;
			}
		})) ||
	noop;
