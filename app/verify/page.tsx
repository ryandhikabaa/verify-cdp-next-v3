import {VerifyWorkspace} from '@/components/verifier/VerifyWorkspace';

/** Public verify page that exposes the scanner without requiring login. */
export default function VerifyPage() {
  return <VerifyWorkspace variant="public" />;
}
