import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Home from './Home';
import Doc from './Doc'
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import Login from './Login';
import ReadOnlyDoc from './ReadOnlyDoc';

const router = createBrowserRouter([
  {
    path: "/home",
    element: <Home />,
  },
  {
    path: "/edit/:id",
    element: <Doc />
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/readonly/:id",
    element: <ReadOnlyDoc />
  }
]);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);