/**
 * Settings Service
 * API calls for system settings management
 */

import api from './api';

export interface ExtensionSettings {
  transact_url: string;
  auto_open_transact: string;
  t24_version: string;
}

export interface SettingItem {
  key: string;
  value: string;
  description?: string;
}

export const settingsService = {
  getExtensionSettings: () =>
    api.get<ExtensionSettings>('/settings/extension'),

  getByCategory: (category: string) =>
    api.get<SettingItem[]>(`/settings/category/${category}`),

  updateSetting: (key: string, value: string) =>
    api.put(`/settings/${key}`, { value }),
};
