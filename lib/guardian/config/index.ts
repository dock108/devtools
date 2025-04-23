import defaultConfig from './default-rule-set.json';
import schema from '../../../schemas/rule-set.json';
import Ajv from 'ajv';
import { logger } from '@/lib/logger';

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

if (!validate(defaultConfig)) {
  logger.error({ errors: validate.errors }, 'Default rule-set failed schema validation');
  throw new Error('Default rule-set failed schema validation');
}

export type RuleSet = typeof defaultConfig;
export const ruleConfig: RuleSet = defaultConfig; 