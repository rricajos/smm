/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect } from 'vitest';
import { RULE_PRESETS, PRESET_CATEGORIES } from './rule-presets';

const validFields = ['from', 'to', 'subject', 'body', 'hasAttachments'];
const validOperators = ['contains', 'equals', 'startsWith', 'endsWith', 'matches', 'is'];
const validActionTypes = ['moveToFolder', 'addTag', 'setPriority', 'markRead', 'autoRespond'];

describe('RULE_PRESETS', () => {
  it('has at least one preset', () => {
    expect(RULE_PRESETS.length).toBeGreaterThan(0);
  });

  it('all presets have required fields', () => {
    for (const preset of RULE_PRESETS) {
      expect(preset.key).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.icon).toBeTruthy();
      expect(preset.conditions.length).toBeGreaterThan(0);
      expect(preset.actions.length).toBeGreaterThan(0);
      expect(['all', 'any']).toContain(preset.conditionLogic);
      expect(typeof preset.requiresFolderSelection).toBe('boolean');
      expect(typeof preset.requiresTagSelection).toBe('boolean');
    }
  });

  it('has no duplicate keys', () => {
    const keys = RULE_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('all conditions use valid fields and operators', () => {
    for (const preset of RULE_PRESETS) {
      for (const cond of preset.conditions) {
        expect(validFields).toContain(cond.field);
        expect(validOperators).toContain(cond.operator);
      }
    }
  });

  it('all actions use valid types', () => {
    for (const preset of RULE_PRESETS) {
      for (const action of preset.actions) {
        expect(validActionTypes).toContain(action.type);
      }
    }
  });

  it('requiresFolderSelection is true only when moveToFolder action exists', () => {
    for (const preset of RULE_PRESETS) {
      const hasMoveAction = preset.actions.some((a) => a.type === 'moveToFolder');
      expect(preset.requiresFolderSelection).toBe(hasMoveAction);
    }
  });

  it('requiresTagSelection is true only when addTag action exists', () => {
    for (const preset of RULE_PRESETS) {
      const hasTagAction = preset.actions.some((a) => a.type === 'addTag');
      expect(preset.requiresTagSelection).toBe(hasTagAction);
    }
  });

  it('all preset categories match valid categories', () => {
    const validCategoryKeys = PRESET_CATEGORIES.map((c) => c.key);
    for (const preset of RULE_PRESETS) {
      expect(validCategoryKeys).toContain(preset.category);
    }
  });
});

describe('PRESET_CATEGORIES', () => {
  it('has at least one category', () => {
    expect(PRESET_CATEGORIES.length).toBeGreaterThan(0);
  });

  it('each category has key and label', () => {
    for (const cat of PRESET_CATEGORIES) {
      expect(cat.key).toBeTruthy();
      expect(cat.label).toBeTruthy();
    }
  });

  it('has no duplicate keys', () => {
    const keys = PRESET_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every category has at least one preset', () => {
    for (const cat of PRESET_CATEGORIES) {
      const presetsInCategory = RULE_PRESETS.filter((p) => p.category === cat.key);
      expect(presetsInCategory.length).toBeGreaterThanOrEqual(1);
    }
  });
});
