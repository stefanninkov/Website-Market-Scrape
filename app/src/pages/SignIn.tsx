import { isFirebaseConfigured } from '../lib/firebase';
import { useAuth } from '../lib/auth';

export default function SignIn() {
  const { status, signIn, signOutUser } = useAuth();

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 text-center">
        <div className="mb-1 font-mono text-sm text-accent">FlowDev</div>
        <h1 className="mb-6 text-xl font-semibold">Website Market Scrape</h1>

        {!isFirebaseConfigured ? (
          <p className="text-sm text-text-dim">
            Firebase is not configured yet. Copy <code className="font-mono">app/.env.example</code>{' '}
            to <code className="font-mono">app/.env</code> and fill in the project values.
          </p>
        ) : status === 'unauthorized' ? (
          <>
            <p className="mb-4 text-sm text-danger">This account is not authorized.</p>
            <button
              onClick={() => void signOutUser()}
              className="w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-border"
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            onClick={() => void signIn()}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
          >
            Sign in with Google
          </button>
        )}
      </div>
    </div>
  );
}
