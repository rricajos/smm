/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import type { Condition, Action } from '../../types/rules';

export interface RulePreset {
  key: string;
  name: string;
  description: string;
  category: PresetCategory;
  icon: string;
  conditions: Condition[];
  conditionLogic: 'all' | 'any';
  actions: Action[];
  requiresFolderSelection: boolean;
  requiresTagSelection: boolean;
}

export type PresetCategory = 'newsletters' | 'social' | 'finance' | 'shopping' | 'work' | 'notifications';

export const PRESET_CATEGORIES: { key: PresetCategory; label: string }[] = [
  { key: 'newsletters', label: 'Newsletters' },
  { key: 'social', label: 'Redes sociales' },
  { key: 'finance', label: 'Finanzas' },
  { key: 'shopping', label: 'Compras' },
  { key: 'work', label: 'Trabajo' },
  { key: 'notifications', label: 'Notificaciones' },
];

export const RULE_PRESETS: RulePreset[] = [
  {
    key: 'newsletters',
    name: 'Newsletters',
    description: 'Detecta correos de newsletters, noreply y boletines automaticos.',
    category: 'newsletters',
    icon: '\u2709',
    conditions: [
      { field: 'from', operator: 'matches', value: 'newsletter|noreply|no-reply|mailer|digest|bolet[ií]n', caseSensitive: false },
    ],
    conditionLogic: 'any',
    actions: [
      { type: 'moveToFolder', folderId: '' },
      { type: 'markRead' },
    ],
    requiresFolderSelection: true,
    requiresTagSelection: false,
  },
  {
    key: 'social',
    name: 'Redes sociales',
    description: 'Notificaciones de Facebook, Twitter/X, LinkedIn e Instagram.',
    category: 'social',
    icon: '\uD83D\uDC65',
    conditions: [
      { field: 'from', operator: 'matches', value: 'facebookmail|twitter\\.com|x\\.com|linkedin|instagram', caseSensitive: false },
    ],
    conditionLogic: 'any',
    actions: [
      { type: 'moveToFolder', folderId: '' },
    ],
    requiresFolderSelection: true,
    requiresTagSelection: false,
  },
  {
    key: 'finance',
    name: 'Bancos y finanzas',
    description: 'Correos de bancos, entidades financieras y PayPal.',
    category: 'finance',
    icon: '\uD83C\uDFE6',
    conditions: [
      { field: 'from', operator: 'matches', value: 'banco|bank|bbva|santander|caixabank|paypal|stripe', caseSensitive: false },
    ],
    conditionLogic: 'any',
    actions: [
      { type: 'addTag', tagKey: '' },
      { type: 'setPriority', priority: 'high' },
    ],
    requiresFolderSelection: false,
    requiresTagSelection: true,
  },
  {
    key: 'shopping',
    name: 'Compras online',
    description: 'Confirmaciones de pedidos de Amazon, AliExpress, eBay, etc.',
    category: 'shopping',
    icon: '\uD83D\uDED2',
    conditions: [
      { field: 'from', operator: 'matches', value: 'amazon|aliexpress|ebay|order|pedido|envio|shipping', caseSensitive: false },
    ],
    conditionLogic: 'any',
    actions: [
      { type: 'moveToFolder', folderId: '' },
    ],
    requiresFolderSelection: true,
    requiresTagSelection: false,
  },
  {
    key: 'github',
    name: 'GitHub / GitLab',
    description: 'Notificaciones de repositorios, PRs, issues y CI.',
    category: 'work',
    icon: '\uD83D\uDCBB',
    conditions: [
      { field: 'from', operator: 'matches', value: 'github\\.com|gitlab\\.com|bitbucket', caseSensitive: false },
    ],
    conditionLogic: 'any',
    actions: [
      { type: 'moveToFolder', folderId: '' },
    ],
    requiresFolderSelection: true,
    requiresTagSelection: false,
  },
  {
    key: 'calendar',
    name: 'Calendario',
    description: 'Invitaciones a eventos y reuniones.',
    category: 'notifications',
    icon: '\uD83D\uDCC5',
    conditions: [
      { field: 'subject', operator: 'matches', value: 'invitaci[oó]n|invitation|calendar|evento|meeting|reuni[oó]n', caseSensitive: false },
    ],
    conditionLogic: 'any',
    actions: [
      { type: 'addTag', tagKey: '' },
    ],
    requiresFolderSelection: false,
    requiresTagSelection: true,
  },
  {
    key: 'promos',
    name: 'Promociones',
    description: 'Ofertas, descuentos, cupones y correos promocionales.',
    category: 'newsletters',
    icon: '\uD83C\uDFF7',
    conditions: [
      { field: 'subject', operator: 'matches', value: 'oferta|descuento|promo|sale|%\\s*off|cup[oó]n|gratis|free', caseSensitive: false },
    ],
    conditionLogic: 'any',
    actions: [
      { type: 'moveToFolder', folderId: '' },
      { type: 'markRead' },
    ],
    requiresFolderSelection: true,
    requiresTagSelection: false,
  },
];
