import { expect, test } from '../test/test';
import {getAgent} from './agent';

test.parallel('agent', () => {
  test('returns same agent for same options', () => {
    const a1 = getAgent({secure: true});
    const a2 = getAgent({secure: false});
    expect(a1 === a2).toBe(false);
  });

  test('returns different agent for different options', () => {
    const a1 = getAgent({secure: true});
    const a2 = getAgent({secure: true});
    expect(a1).toBe(a2);
  });

  test('returns different agent for different lookup function', () => {
    const lookup1 = () => Promise.resolve([]);
    const lookup2 = () => Promise.resolve([]);
    const a1 = getAgent({secure: true, lookup: lookup1});
    const a2 = getAgent({secure: true, lookup: lookup2});
    expect(a2 === a1).toBe(false);
  });
})