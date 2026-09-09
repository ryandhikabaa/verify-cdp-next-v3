import {AppShell} from '@/components/AppShell';
import {SettingsClient} from '@/components/settings/SettingsClient';
import {getSetting, HVALUE_SETTING_KEY, MAX_SCAN_SETTING_KEY} from '@/lib/db/settings';

export const dynamic = 'force-dynamic';

export default async function ConfigurationPage() {
  const [maxScan, hvalue] = await Promise.all([
    getSetting(MAX_SCAN_SETTING_KEY),
    getSetting(HVALUE_SETTING_KEY),
  ]);

  const initialSettings = [
    {
      parameter: MAX_SCAN_SETTING_KEY,
      value: maxScan?.value ?? null,
      updated_at: maxScan?.updated_at.toISOString() ?? null,
    },
    {
      parameter: HVALUE_SETTING_KEY,
      value: hvalue?.value ?? null,
      updated_at: hvalue?.updated_at.toISOString() ?? null,
    },
  ];

  return (
    <AppShell activeTab="configuration">
      <SettingsClient initialSettings={initialSettings} />
    </AppShell>
  );
}
