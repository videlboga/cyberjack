import { z } from 'zod';
import { getBaseHumanAnatomy } from './anatomy.js';

// Get all possible anatomical points from our single source of truth
const femaleAnatomy = getBaseHumanAnatomy('female').map(p => p.id);
const maleAnatomy = getBaseHumanAnatomy('male').map(p => p.id);

const allPoints = Array.from(new Set([
  ...femaleAnatomy,
  ...maleAnatomy,
  // Below we temporarily add these backwards compatibility fallback points 
  // that we might still use in raw actions
  'torso', 'limbs', 'internal_lower', 'whole_body', 'lower_body_control', 'general_senses'
]));

// Valid anatomical targets from the database / anatomy file
export const AnatomyTargetSchema = z.enum([allPoints[0], ...allPoints.slice(1)] as [string, ...string[]]);

// All custom tags we've used in actions, items, and traits
export const ActionTagSchema = z.enum([
  'impact', 'pain', 'demeaning', 'affection', 'intimate', 'blunt', 'comfort',
  'mental', 'pressure', 'command', 'clinical', 'vulnerable', 'restraint', 
  'metal', 'humiliation', 'struggle', 'electronic', 'control', 'punishment',
  'chemical', 'piercing', 'stretching', 'machine', 'isolation', 'stimulation',
  'torture', 'medical', 'drug', 'sexual', 'oral', 'biomaterial', 'fluid',
  'hands', 'feet', 'chest', 'groin', 'tickling', 'submission', 'exposure',
  'penetration', 'deprivation' // specific trigger and learnable tags
]);

// CompiledAction.type is a single scalar derived from categories[0] at
// compile time. Keep this enum aligned with the union in types.ts.
export const CategorySchema = z.enum([
  'physical', 'verbal', 'context', 'system'
]);

export const VectorSchema = z.object({
  intensity: z.number(),
  valence: z.number(),
  sharpness: z.number(),
  contact: z.number(),
  novelty: z.number(),
  powerBase: z.number().optional()
});

export const TraitRuleOverrideSchema = z.object({
  valence: z.number().optional(),
  intensityMult: z.number().optional(),
  attitudeShiftDelta: z.number().optional(),
  opennessDelta: z.number().optional(),
  capacityDelta: z.number().optional(),
  pleasureDelta: z.number().optional()
});

export const TraitRuleTriggerSchema = z.object({
  requireActionTags: z.array(ActionTagSchema).optional(),
  requireActionCategories: z.array(CategorySchema).optional(),
  requireTarget: z.string().optional() // Can be an AnatomyTarget
});

export const TraitRuleSchema = z.object({
  trigger: TraitRuleTriggerSchema,
  overrides: TraitRuleOverrideSchema
});

export const ContextConfigSchema = z.object({
  type: z.enum(["pose", "clothing", "equipment", "environment", "social", "restraint", "condition", "trait", "status", "sexual_interaction", "sensory"]),
  activeLabel: z.string().optional(),
  duration: z.number().optional(),
  exclusiveWithinPoint: z.boolean().optional(),
  occupiesPoints: z.array(AnatomyTargetSchema).optional(),
  modifiers: z.object({
    intensity: z.number().optional(),
    valence: z.number().optional(),
    sharpness: z.number().optional(),
    contact: z.number().optional(),
    novelty: z.number().optional()
  }).optional(),
  traitRules: z.array(TraitRuleSchema).optional()
});

// Action Preset Object
export const ActionPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  categories: z.array(CategorySchema),
  tags: z.array(ActionTagSchema),
  validTargets: z.array(AnatomyTargetSchema).optional(),
  vector: VectorSchema,
  contextConfig: ContextConfigSchema.optional(),
  requireContexts: z.array(z.string()).optional(),
  removeContexts: z.array(z.string()).optional(),
  requiresItem: z.string().optional(),
  requiresSceneObject: z.string().optional()
});

// Item Preset Object
export const ItemPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.string(), // "equipment", "consumable", etc.
  tags: z.array(ActionTagSchema)
});

// Trait Preset Object
export const TraitPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  rules: z.array(TraitRuleSchema)
});
