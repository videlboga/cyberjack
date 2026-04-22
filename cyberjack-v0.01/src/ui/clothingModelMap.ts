// Mapping of clothing action IDs (or combinations) to VRM model URLs.
// Keys may be a single actionId (e.g. 'eq_clothe_jumpsuit') or a combination
// formed by joining sorted actionIds with '+' (e.g. 'eq_clothe_shirt+eq_clothe_pants').
export const clothingModelMap: Record<string, string> = {
  // single-item examples
  'eq_clothe_jumpsuit': '/models/jumpsuit.vrm',

  // example combination (shirt + pants)
  // 'eq_clothe_shirt+eq_clothe_pants': '/models/shirt_pants.vrm',

  // fallback 'base' key can be used for a generic model if needed
  'base': '/models/base.vrm'
};

export default clothingModelMap;
