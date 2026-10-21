import { RouterProvider } from "react-router";
import { AuthProvider } from "./auth";
import { LanguageProvider } from "./i18n";
import { router } from "./routes";

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </LanguageProvider>
  );
}
