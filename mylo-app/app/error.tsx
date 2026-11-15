'use client';

import StatusScreen from '@/components/system/StatusScreen';

/* S28 · Something broke on our side, for any screen that throws. */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <StatusScreen kind="error" onRetry={reset} />;
}
