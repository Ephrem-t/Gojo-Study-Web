import React from "react";
import { Outlet } from "react-router-dom";
import "../styles/global.css";
import Sidebar from "./Sidebar";

export default function FinanceLayout() {
  return (
    <div className="finance-shell-layout">
      <Sidebar />
      <Outlet />
    </div>
  );
}