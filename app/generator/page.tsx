import {redirect} from 'next/navigation';

/** Preserves legacy generator URL by redirecting to the app area. */
export default function GeneratorRedirectPage() {
  redirect('/app/generator');
}
