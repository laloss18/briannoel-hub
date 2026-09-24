import { useAuth } from './auth/useAuth';
import AuthFlow from './auth/AuthFlow';
import HubScreen from './hub/HubScreen';

export default function App() {
  const auth = useAuth();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl">
      {auth.screen === 'home' ? (
        <HubScreen
          email={auth.session?.email ?? ''}
          roles={auth.session?.roles ?? []}
          onLogout={auth.logout}
        />
      ) : (
        <AuthFlow auth={auth} />
      )}
    </main>
  );
}
