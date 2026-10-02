import { redirect } from 'next/navigation';

export default function AppControlRoot() {
  redirect('/app-control/feature-flags');
}
