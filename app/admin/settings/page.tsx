'use client';

import { useState, useEffect } from 'react';
import { Container } from '@/components/Container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'react-hot-toast';
import { Loader2, Save } from 'lucide-react';
import { Database } from '@/types/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Assuming settings table structure - adjust as needed
type Settings = Database['public']['Tables']['settings']['Row'];

// Default settings structure if none found in DB
const defaultSettings: Partial<Settings> = {
  id: 'global_settings', // Use a fixed identifier if your table uses one
  slack_webhook_url: '',
  notification_emails: [],
  slack_notifications_enabled: false,
  email_notifications_enabled: false,
};

export default function NotificationSettingsAdminPage() {
  const [settings, setSettings] = useState<Partial<Settings>>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      // Use fetched data or defaults if empty/error
      const loadedSettings = data && Object.keys(data).length > 0 ? data : defaultSettings;
      setSettings(loadedSettings);
      setEmailInput((loadedSettings.notification_emails || []).join(', '));
    } catch (error: any) {
      toast.error(`Error fetching settings: ${error.message}`);
      // Keep default settings on error
      setSettings(defaultSettings);
      setEmailInput('');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox' || (e.target instanceof HTMLInputElement && e.target.role === 'switch')
          ? checked
          : value,
    }));
  };

  const handleSwitchChange = (checked: boolean, name: keyof Settings) => {
    setSettings((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleEmailInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailInput(e.target.value);
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Basic validation for Slack URL (if provided)
    if (
      settings.slack_webhook_url &&
      !settings.slack_webhook_url.startsWith('https://hooks.slack.com/')
    ) {
      toast.error('Invalid Slack Webhook URL format.');
      setIsSaving(false);
      return;
    }

    // Parse and validate emails
    const emails = emailInput
      .split(',')
      .map((email) => email.trim())
      .filter((email) => email !== '' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)); // Basic email regex

    if (
      emailInput.trim() !== '' &&
      emails.length === 0 &&
      emailInput
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e !== '').length > 0
    ) {
      toast.error(
        'One or more email addresses are invalid. Please use comma-separated valid emails.',
      );
      setIsSaving(false);
      return;
    }

    const payload = {
      ...settings,
      notification_emails: emails,
      // Ensure the fixed ID is included if your upsert relies on it
      id: settings.id || defaultSettings.id,
    };

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      const updatedSettings = await res.json();
      setSettings(updatedSettings);
      setEmailInput((updatedSettings.notification_emails || []).join(', '));
      toast.success('Settings saved successfully!');
    } catch (error: any) {
      toast.error(`Save failed: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Container className="py-10">
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-10">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>
            Configure how and where Guardian sends alert notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Slack Settings */}
          <div className="space-y-2">
            <Label htmlFor="slack_webhook_url" className="text-base font-semibold">
              Slack Notifications
            </Label>
            <div className="flex items-center space-x-2">
              <Switch
                id="slack_notifications_enabled"
                checked={settings.slack_notifications_enabled ?? false}
                onCheckedChange={(checked) =>
                  handleSwitchChange(checked, 'slack_notifications_enabled')
                }
                disabled={isSaving}
              />
              <Label htmlFor="slack_notifications_enabled">Enable Slack Alerts</Label>
            </div>
            <Input
              id="slack_webhook_url"
              name="slack_webhook_url"
              type="url"
              placeholder="https://hooks.slack.com/..."
              value={settings.slack_webhook_url || ''}
              onChange={handleInputChange}
              disabled={isSaving || !settings.slack_notifications_enabled}
              className="mt-1"
            />
            <p className="text-sm text-slate-500">
              Enter the Incoming Webhook URL provided by Slack.
            </p>
          </div>

          {/* Email Settings */}
          <div className="space-y-2">
            <Label htmlFor="notification_emails" className="text-base font-semibold">
              Email Notifications
            </Label>
            <div className="flex items-center space-x-2">
              <Switch
                id="email_notifications_enabled"
                checked={settings.email_notifications_enabled ?? false}
                onCheckedChange={(checked) =>
                  handleSwitchChange(checked, 'email_notifications_enabled')
                }
                disabled={isSaving}
              />
              <Label htmlFor="email_notifications_enabled">Enable Email Alerts</Label>
            </div>
            <Input
              id="notification_emails"
              name="notification_emails"
              type="text"
              placeholder="ops@example.com, security@example.com"
              value={emailInput}
              onChange={handleEmailInputChange}
              disabled={isSaving || !settings.email_notifications_enabled}
              className="mt-1"
            />
            <p className="text-sm text-slate-500">Enter comma-separated email addresses.</p>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={isSaving || isLoading}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}
