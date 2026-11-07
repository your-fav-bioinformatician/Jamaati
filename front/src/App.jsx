import { BrowserRouter } from 'react-router-dom';
import { LangProvider } from './i18n/LangProvider';
import { SessionProvider } from './session/SessionProvider';
import { ThemeProvider } from './theme/ThemeProvider';
import { ToastProvider } from './theme/Toast';
import { AppRoutes } from './routes';

export default function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <ToastProvider>
          <SessionProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </SessionProvider>
        </ToastProvider>
      </LangProvider>
    </ThemeProvider>
  );
}
