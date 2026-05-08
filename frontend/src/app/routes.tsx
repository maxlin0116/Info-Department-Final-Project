import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Login } from "./components/Login";
import { Register } from "./components/Register";
import { AdminReservations } from "./components/AdminReservations";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "admin/reservations", Component: AdminReservations },
      { path: "login", Component: Login },
      { path: "register", Component: Register },
    ],
  },
]);
