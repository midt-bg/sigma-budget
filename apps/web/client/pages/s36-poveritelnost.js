// S36 · Поверителност · /poveritelnost · no data or period.
// Shared copy and its implementation map live in client/legal.js; questions link to S27.
// This legacy renderer and the migrated React screen use the same text.
import { legalHtml } from '../legal.js';

export const needs = [];
export const styles = ['s36-poveritelnost'];

export function render() {
  return { body: legalHtml('S36') };
}
