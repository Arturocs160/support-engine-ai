export const CATEGORIES = Object.freeze(['ACCESS', 'BUG', 'FEATURE', 'SECURITY']);
export const PRIORITIES = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export const MODES = Object.freeze(['traditional', 'generative']);

export function hasValidAnalysisFields(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && CATEGORIES.includes(value.category)
    && PRIORITIES.includes(value.priority)
    && typeof value.response === 'string' && value.response.trim().length > 0
    && typeof value.requiresHumanReview === 'boolean';
}

export function hasValidAnalysis(value) {
  return hasValidAnalysisFields(value) && MODES.includes(value.mode)
    && Object.keys(value).length === 5;
}
