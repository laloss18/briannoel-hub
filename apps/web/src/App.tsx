import { RouterProvider } from 'react-router-dom';
import { useAuth } from './auth/useAuth';
import AuthFlow from './auth/AuthFlow';
import { SesionProvider } from './app/sesion';
import { router } from './app/router';

/**
 * Raíz de la app: sin sesión va el flujo de auth (login/PIN); con sesión, el
 * router del hub. `SesionProvider` envuelve el router para que el shell, el
 * sidebar y las páginas compartan identidad y roles sin prop drilling.
 */
export default function App() {
  const auth = useAuth();

  if (auth.screen !== 'home' || !auth.session) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-2xl">
        <AuthFlow auth={auth} />
      </main>
    );
  }

  return (
    <SesionProvider
      sesion={{
        email: auth.session.email,
        username: auth.session.username,
        roles: auth.session.roles,
        onLogout: () => void auth.logout(),
      }}
    >
      <RouterProvider router={router} />
    </SesionProvider>
  );
}
