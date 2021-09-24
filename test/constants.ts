export const TESTING = process.env.NODE_ENV === '@balena/fetch-test';
export const MANUAL = (process.env.NODE_DEBUG ?? '').includes(
	'@balena/fetch-manual',
);
