import {GeneratorWorkspace} from '@/components/generator/GeneratorWorkspace';
import {resolveHvalue} from '@/lib/db/settings';

export const dynamic = 'force-dynamic';

/** Hosts the main application generator page under the app area. */
export default async function AppGeneratorPage() {
  const hvalue = await resolveHvalue();

  return <GeneratorWorkspace initialHvalue={hvalue} />;
}
