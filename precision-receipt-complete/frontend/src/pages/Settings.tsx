/**
 * Settings Page
 * Admin page for managing system settings (Extension/T24 config)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FiSettings,
  FiSave,
  FiRefreshCw,
  FiMonitor,
  FiGlobe,
} from 'react-icons/fi';
import AdminLayout from '../components/layout/AdminLayout';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';
import { settingsService } from '../services/settings.service';

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Form state for extension settings
  const [transactUrl, setTransactUrl] = useState('https://transact.meezanbank.com');
  const [autoOpenTransact, setAutoOpenTransact] = useState(false);
  const [t24Version, setT24Version] = useState('R16');

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await settingsService.getByCategory('extension');

      // Populate form from settings
      for (const setting of data) {
        switch (setting.key) {
          case 'extension.transact_url':
            setTransactUrl(setting.value);
            break;
          case 'extension.auto_open_transact':
            setAutoOpenTransact(setting.value === 'true');
            break;
          case 'extension.t24_version':
            setT24Version(setting.value);
            break;
        }
      }
    } catch (err) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Save extension settings
  const handleSaveExtension = async () => {
    try {
      setSaving(true);

      // Validate URL
      if (!transactUrl.trim()) {
        toast.error('Transact URL is required');
        return;
      }
      try {
        new URL(transactUrl);
      } catch {
        toast.error('Please enter a valid URL');
        return;
      }

      // Save all extension settings
      await Promise.all([
        settingsService.updateSetting('extension.transact_url', transactUrl.replace(/\/$/, '')),
        settingsService.updateSetting('extension.auto_open_transact', String(autoOpenTransact)),
        settingsService.updateSetting('extension.t24_version', t24Version),
      ]);

      toast.success('Extension settings saved');

      // Push updated config to Chrome extension via postMessage
      window.postMessage({
        type: 'DDS_EXTENSION_CONFIG',
        config: {
          transactUrl: transactUrl.replace(/\/$/, ''),
          autoOpenTransact,
          t24Version,
        },
      }, '*');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title="Settings"
      subtitle="System configuration"
      icon={<FiSettings className="w-6 h-6" />}
    >
      <div className="space-y-6 max-w-3xl">
        {/* Extension / T24 Configuration */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FiMonitor className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Chrome Extension / T24 Configuration
                </h3>
                <p className="text-sm text-gray-500">
                  Configure the T24 Transact integration for the browser extension
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <FiRefreshCw className="w-5 h-5 animate-spin mr-2" />
                Loading settings...
              </div>
            ) : (
              <div className="space-y-5">
                {/* Transact URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <FiGlobe className="inline w-4 h-4 mr-1" />
                    T24 Transact URL
                  </label>
                  <Input
                    type="url"
                    value={transactUrl}
                    onChange={(e) => setTransactUrl(e.target.value)}
                    placeholder="https://transact.meezanbank.com"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    The URL of your T24 Transact core banking system. This will be pushed to the Chrome extension automatically.
                  </p>
                </div>

                {/* T24 Version */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    T24 Version
                  </label>
                  <select
                    value={t24Version}
                    onChange={(e) => setT24Version(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  >
                    <option value="R16">R16</option>
                    <option value="R17">R17</option>
                    <option value="R18">R18</option>
                    <option value="R19">R19</option>
                    <option value="R20">R20</option>
                    <option value="R21">R21</option>
                    <option value="R22">R22</option>
                  </select>
                </div>

                {/* Auto-open Transact */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-gray-700">
                      Auto-open Transact on login
                    </div>
                    <div className="text-xs text-gray-400">
                      Automatically open T24 Transact tab when a teller logs in
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoOpenTransact}
                      onChange={(e) => setAutoOpenTransact(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Save button */}
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSaveExtension}
                    disabled={saving}
                    className="flex items-center gap-2"
                  >
                    {saving ? (
                      <FiRefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <FiSave className="w-4 h-4" />
                    )}
                    {saving ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Settings;
