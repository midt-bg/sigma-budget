import { legalHtml } from '../legal.js';

export const needs = [];
export const styles = ['s37-usloviya'];

export function render() {
  return { body: legalHtml('S37', '') };
}
