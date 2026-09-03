/**
 * Догенерация родительских контейнеров (worldview/accumulated/others/world),
 * чьи дети уже готовы. Однократный прогон consolidateNextInterpretation.
 */
import { consolidateNextInterpretation } from '../src/services/interpretationRegeneration';

const ok = await consolidateNextInterpretation();
console.log('pass ok:', ok);