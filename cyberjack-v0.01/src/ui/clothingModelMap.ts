// Mapping of clothing action IDs (or combinations) to VRM model URLs.
// Keys may be a single actionId (e.g. 'eq_clothe_jumpsuit') or a combination
// formed by joining sorted actionIds with '+' (e.g. 'eq_clothe_shirt+eq_clothe_pants').
export const clothingModelMap: Record<string, string> = {
  // single-item examples
  // Map the jumpsuit clothing action to the provided VRM filename (vaiolet)
  'eq_clothe_jumpsuit': '/models/anna_vaiolet.vrm',

  // You can add combination keys like 'eq_clothe_shirt+eq_clothe_pants' -> '/models/..'
  // Example:
  // 'eq_clothe_shirt+eq_clothe_pants': '/models/shirt_pants.vrm',

  // Fallback base model (nude)
  'base': '/models/anna_nude.vrm'
};

export default clothingModelMap;
