import schema from '../schemas/rule-set.json';
import config from '../lib/guardian/config/default-rule-set.json';
import Ajv from 'ajv';

const ajv = new Ajv();

describe('Rule Set Schema', () => {
  it('default config passes schema', () => {
    expect(ajv.validate(schema, config)).toBe(true);
  });

  it('rejects config with missing required property', () => {
    const invalidConfig = {
      velocityBreach: { maxPayouts: 3, windowSeconds: 60 },
      // Missing bankSwap
      geoMismatch: { mismatchChargeCount: 2 }
    };
    expect(ajv.validate(schema, invalidConfig)).toBe(false);
  });

  it('rejects config with values below minimum', () => {
    const invalidConfig = {
      velocityBreach: { maxPayouts: 0, windowSeconds: 60 }, // maxPayouts < 1
      bankSwap: { lookbackMinutes: 5, minPayoutUsd: 1000 },
      geoMismatch: { mismatchChargeCount: 2 }
    };
    expect(ajv.validate(schema, invalidConfig)).toBe(false);
  });

  it('rejects config with additional properties', () => {
    const invalidConfig = {
      velocityBreach: { maxPayouts: 3, windowSeconds: 60 },
      bankSwap: { lookbackMinutes: 5, minPayoutUsd: 1000 },
      geoMismatch: { mismatchChargeCount: 2 },
      extraRule: { someProperty: 'value' } // This is not allowed
    };
    expect(ajv.validate(schema, invalidConfig)).toBe(false);
  });
}); 