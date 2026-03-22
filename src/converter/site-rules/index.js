import { extractGitHub } from './github.js';
import { extractStackOverflow } from './stackoverflow.js';
import { extractMediumSubstack } from './medium-substack.js';

const SITE_MAP = {
  'github.com': 'github',
  'stackoverflow.com': 'stackoverflow',
  'medium.com': 'medium',
};

const EXTRACTORS = {
  github: extractGitHub,
  stackoverflow: extractStackOverflow,
  medium: extractMediumSubstack,
  substack: extractMediumSubstack,
};

function matchHost(hostname) {
  if (SITE_MAP[hostname]) return SITE_MAP[hostname];
  if (hostname.endsWith('.substack.com')) return 'substack';
  return null;
}

export function detectSite() {
  return matchHost(window.location.hostname);
}

export function extractSiteContent(site) {
  const extractor = EXTRACTORS[site];
  if (!extractor) return null;
  try {
    return extractor() || null;
  } catch {
    return null;
  }
}
