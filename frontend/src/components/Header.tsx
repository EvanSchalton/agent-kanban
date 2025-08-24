import React from "react";
import ConnectionStatus from "./ConnectionStatus";
import UserMenu from "./UserMenu";
import "./Header.css";

const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="header-content">
        <h1 className="header-title">Agent Kanban Board</h1>
        <div className="header-stats">
          <ConnectionStatus />
          <UserMenu />
        </div>
      </div>
    </header>
  );
};

export default Header;
