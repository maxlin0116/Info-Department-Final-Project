import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { HomeOverview } from "./components/HomeOverview";
import { Login } from "./components/Login";
import { Register } from "./components/Register";
import { AdminReservations } from "./components/AdminReservations";
import { AccountSettings } from "./components/AccountSettings";
import { ForgotPassword } from "./components/ForgotPassword";
import { ResetPassword } from "./components/ResetPassword";
import { PrivacyPolicy } from "./components/PrivacyPolicy";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: HomeOverview },
      { path: "reserve", Component: Dashboard },
      { path: "admin/reservations", Component: AdminReservations },
      { path: "admin/fabrication", lazy: async () => ({ Component: (await import("./components/AdminFabrication")).AdminFabrication }) },
      { path: "admin/users", lazy: async () => ({ Component: (await import("./components/AdminUsers")).AdminUsers }) },
      { path: "fabrication/jobs", lazy: async () => ({ Component: (await import("./components/FabricationJobs")).FabricationJobs }) },
      { path: "fabrication/queues", lazy: async () => ({ Component: (await import("./components/FabricationQueues")).FabricationQueues }) },
      { path: "fabrication/:serviceType", lazy: async () => ({ Component: (await import("./components/FabricationSubmit")).FabricationSubmit }) },
      { path: "account", Component: AccountSettings },
      { path: "login", Component: Login },
      { path: "register", Component: Register },
      { path: "forgot-password", Component: ForgotPassword },
      { path: "reset-password", Component: ResetPassword },
      { path: "privacy", Component: PrivacyPolicy },
    ],
  },
  { path: "/display", lazy: async () => ({ Component: (await import("./components/PublicDisplay")).PublicDisplay }) },
]);
