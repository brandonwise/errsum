'use strict';

const { getErrorSignature } = require('./parser.js');

/**
 * Group similar errors together using signature matching
 */
function groupErrors(errors, opts = {}) {
  const groups = new Map();

  for (const error of errors) {
    const signature = getErrorSignature(error);

    if (groups.has(signature)) {
      const group = groups.get(signature);
      group.count++;
      group.errors.push(error);

      // Track unique files
      if (error.file && !group.files.has(error.file)) {
        group.files.add(error.file);
      }
    } else {
      groups.set(signature, {
        signature,
        count: 1,
        errors: [error],
        files: new Set(error.file ? [error.file] : []),
        representative: error, // First occurrence as representative
        code: error.code,
        type: error.type,
        severity: error.severity,
      });
    }
  }

  // Convert to array and sort by count (descending)
  let result = Array.from(groups.values()).sort((a, b) => b.count - a.count);

  // Limit to top N if specified
  if (opts.top && opts.top > 0) {
    result = result.slice(0, opts.top);
  }

  return result;
}

/**
 * Calculate similarity between two strings (Levenshtein-based)
 * Returns a value between 0 and 1
 */
function similarity(str1, str2) {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;

  const len1 = str1.length;
  const len2 = str2.length;

  // Quick check: if lengths differ by more than 50%, likely different
  if (Math.abs(len1 - len2) > Math.max(len1, len2) * 0.5) {
    return 0;
  }

  // Use simple token-based similarity for speed
  const tokens1 = new Set(str1.toLowerCase().split(/\W+/).filter(Boolean));
  const tokens2 = new Set(str2.toLowerCase().split(/\W+/).filter(Boolean));

  let intersection = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) {
      intersection++;
    }
  }

  const union = tokens1.size + tokens2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Merge similar groups (for fuzzy grouping)
 */
function mergeSimilarGroups(groups, threshold = 0.8) {
  const merged = [];
  const used = new Set();

  for (let i = 0; i < groups.length; i++) {
    if (used.has(i)) continue;

    const group = { ...groups[i] };
    group.errors = [...group.errors];
    group.files = new Set(group.files);

    // Find similar groups to merge
    for (let j = i + 1; j < groups.length; j++) {
      if (used.has(j)) continue;

      const sim = similarity(group.signature, groups[j].signature);
      if (sim >= threshold) {
        group.count += groups[j].count;
        group.errors.push(...groups[j].errors);
        for (const file of groups[j].files) {
          group.files.add(file);
        }
        used.add(j);
      }
    }

    merged.push(group);
    used.add(i);
  }

  return merged.sort((a, b) => b.count - a.count);
}

/**
 * Get statistics about error groups
 */
function getStats(groups, allErrors) {
  const stats = {
    totalErrors: allErrors.length,
    uniquePatterns: groups.length,
    filesAffected: new Set(),
    byType: {},
    bySeverity: {},
    topCode: null,
  };

  const codeCounts = {};

  for (const error of allErrors) {
    if (error.file) {
      stats.filesAffected.add(error.file);
    }

    const type = error.type || 'unknown';
    stats.byType[type] = (stats.byType[type] || 0) + 1;

    const severity = error.severity || 'error';
    stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;

    if (error.code) {
      codeCounts[error.code] = (codeCounts[error.code] || 0) + 1;
    }
  }

  stats.filesAffected = stats.filesAffected.size;

  // Find most common error code
  let maxCount = 0;
  for (const [code, count] of Object.entries(codeCounts)) {
    if (count > maxCount) {
      maxCount = count;
      stats.topCode = { code, count };
    }
  }

  return stats;
}

module.exports = {
  groupErrors,
  similarity,
  mergeSimilarGroups,
  getStats,
};
