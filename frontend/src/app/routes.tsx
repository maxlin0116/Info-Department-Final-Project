import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { Login } from "./components/Login";
import { Register } from "./components/Register";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "login", Component: Login },
      { path: "register", Component: Register },
    ],
  },
]);
