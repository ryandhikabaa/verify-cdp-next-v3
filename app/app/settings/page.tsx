import {AppShell} from '@/components/AppShell';
import {ApiDocsWorkspace} from '@/components/apidocs/ApiDocsWorkspace';

export default function SettingsPage() {
  return (
    <AppShell activeTab="settings">
      <ApiDocsWorkspace />
    </AppShell>
  );
}