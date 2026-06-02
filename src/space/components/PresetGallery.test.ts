// @vitest-environment jsdom
/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '../../lib/test-utils';
import type { Rule } from '../../types/rules';

function mockReadable<T>(value: T) {
  return {
    subscribe: (fn: (v: T) => void) => {
      fn(value);
      return () => {};
    },
  };
}

vi.mock('../../lib/i18n', () => ({
  t: mockReadable((key: string) => key),
  locale: mockReadable('en'),
}));

import PresetGallery from './PresetGallery.svelte';
import { RULE_PRESETS } from '../../lib/utils/rule-presets';

afterEach(() => cleanup());

const baseProps = {
  show: true,
  folders: [],
  tags: [],
  oninstall: vi.fn(),
  onclose: vi.fn(),
};

// Preset that requires no folder or tag selection
const simplePreset = RULE_PRESETS.find(
  (p) => !p.requiresFolderSelection && !p.requiresTagSelection,
);
// Preset that requires folder selection
const folderPreset = RULE_PRESETS.find((p) => p.requiresFolderSelection);

describe('PresetGallery', () => {
  it('does not render when show=false', () => {
    render(PresetGallery, { ...baseProps, show: false });
    expect(screen.queryByText('preset_gallery_title')).not.toBeInTheDocument();
  });

  it('renders the preset gallery when show=true', () => {
    render(PresetGallery, baseProps);
    expect(screen.getByText('preset_gallery_title')).toBeInTheDocument();
  });

  it('shows presets by description text', () => {
    render(PresetGallery, baseProps);
    const descs = RULE_PRESETS.map((p) => p.description);
    expect(screen.getByText(descs[0])).toBeInTheDocument();
    expect(screen.getByText(descs[1])).toBeInTheDocument();
  });

  it('renders the all-category tab', () => {
    render(PresetGallery, baseProps);
    expect(screen.getByText('preset_all')).toBeInTheDocument();
  });

  it('shows preset detail view when a preset card is clicked', async () => {
    if (!folderPreset) return;
    render(PresetGallery, baseProps);
    const presetCard = screen.getByText(folderPreset.description).closest('.preset-card');
    expect(presetCard).toBeTruthy();
    await fireEvent.click(presetCard!);
    expect(screen.getByText(/common_back/)).toBeInTheDocument();
  });

  it('shows install button in preset detail view', async () => {
    if (!folderPreset) return;
    render(PresetGallery, baseProps);
    const presetCard = screen.getByText(folderPreset.description).closest('.preset-card');
    await fireEvent.click(presetCard!);
    expect(screen.getByText('preset_install')).toBeInTheDocument();
  });

  it('shows folder selection error when required folder is not set', async () => {
    if (!folderPreset) return;
    render(PresetGallery, baseProps);
    const presetCard = screen.getByText(folderPreset.description).closest('.preset-card');
    await fireEvent.click(presetCard!);
    await fireEvent.click(screen.getByText('preset_install'));
    expect(screen.getByText('preset_error_folder')).toBeInTheDocument();
  });

  it('back button returns to the preset list', async () => {
    if (!folderPreset) return;
    render(PresetGallery, baseProps);
    const presetCard = screen.getByText(folderPreset.description).closest('.preset-card');
    await fireEvent.click(presetCard!);
    await fireEvent.click(screen.getByText(/common_back/));
    expect(screen.queryByText('preset_install')).not.toBeInTheDocument();
    expect(screen.getByText('preset_all')).toBeInTheDocument();
  });

  it('installs a preset that requires no folder or tag selection', async () => {
    if (!simplePreset) return;
    const oninstall = vi.fn();
    render(PresetGallery, { ...baseProps, oninstall });
    const presetCard = screen.getByText(simplePreset.description).closest('.preset-card');
    await fireEvent.click(presetCard!);
    await fireEvent.click(screen.getByText('preset_install'));
    expect(oninstall).toHaveBeenCalledOnce();
    const installedRule = oninstall.mock.calls[0][0] as Rule;
    expect(installedRule.name).toBe(simplePreset.name);
    expect(installedRule.enabled).toBe(true);
    expect(installedRule.id).toBeTruthy();
  });

  it('installed rule has correct conditions from preset', async () => {
    if (!simplePreset) return;
    const oninstall = vi.fn();
    render(PresetGallery, { ...baseProps, oninstall });
    const presetCard = screen.getByText(simplePreset.description).closest('.preset-card');
    await fireEvent.click(presetCard!);
    await fireEvent.click(screen.getByText('preset_install'));
    const installedRule = oninstall.mock.calls[0][0] as Rule;
    expect(installedRule.conditions).toHaveLength(simplePreset.conditions.length);
    expect(installedRule.conditionLogic).toBe(simplePreset.conditionLogic);
  });
});
