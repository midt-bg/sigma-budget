import { legalHtml } from '../legal.js';

export const needs = [];
export const styles = ['s36-poveritelnost'];

export function render() {
  return { body: legalHtml('S36', '') };
}
