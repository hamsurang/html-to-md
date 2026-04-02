import { extractGitHub } from './github.js';
import { extractStackOverflow } from './stackoverflow.js';
import { extractMediumSubstack } from './medium-substack.js';
import { extractNotion } from './notion.js';

const SITE_MAP = {
  'github.com': 'github',
  'stackoverflow.com': 'stackoverflow',
  'medium.com': 'medium',
  'notion.so': 'notion',
  'www.notion.so': 'notion',
};

export const SITE_LABELS = {
  github: 'GitHub',
  stackoverflow: 'Stack Overflow',
  medium: 'Medium',
  substack: 'Substack',
  notion: 'Notion',
};

const EXTRACTORS = {
  github: extractGitHub,
  stackoverflow: extractStackOverflow,
  medium: extractMediumSubstack,
  substack: extractMediumSubstack,
  notion: extractNotion,
};

function matchHost(hostname) {
  if (SITE_MAP[hostname]) return SITE_MAP[hostname];
  if (hostname.endsWith('.substack.com')) return 'substack';
  if (hostname.endsWith('.notion.site')) return 'notion';
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
