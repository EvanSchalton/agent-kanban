import React, { useState, useEffect } from "react";
import "./UserMenu.css";

interface UserMenuProps {
  onUsernameChange?: (username: string) => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ onUsernameChange }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState<string>("");
  const [tempUsername, setTempUsername] = useState<string>("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    // Load username from localStorage on mount
    const savedUsername = localStorage.getItem("username");
    if (savedUsername) {
      setUsername(savedUsername);
    } else {
      // Generate default username
      const defaultUsername = `User${Math.floor(Math.random() * 10000)}`;
      setUsername(defaultUsername);
      localStorage.setItem("username", defaultUsername);
    }
  }, []);

  const openModal = () => {
    setTempUsername(username);
    setIsModalOpen(true);
    setIsMenuOpen(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTempUsername("");
  };

  const handleSave = () => {
    const trimmedUsername = tempUsername.trim();
    if (trimmedUsername && trimmedUsername !== username) {
      setUsername(trimmedUsername);
      localStorage.setItem("username", trimmedUsername);

      // Notify parent component if callback provided
      if (onUsernameChange) {
        onUsernameChange(trimmedUsername);
      }

      closeModal();

      // Trigger WebSocket reconnection by reloading the page
      // In a production app, you'd handle this more gracefully
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } else if (trimmedUsername === username) {
      // No change, just close
      closeModal();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      closeModal();
    }
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(!isMenuOpen);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setIsMenuOpen(false);
    if (isMenuOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [isMenuOpen]);

  // Get initials for avatar
  const getInitials = (name: string) => {
    const parts = name.split(/[\s_-]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <>
      <div className="user-menu">
        <button
          className="user-menu-button"
          onClick={toggleMenu}
          title={`Logged in as ${username}`}
        >
          <div className="user-avatar">
            <span className="user-avatar-text">{getInitials(username)}</span>
          </div>
          <span className="user-menu-name">{username}</span>
          <span className="user-menu-arrow">▼</span>
        </button>

        {isMenuOpen && (
          <div className="user-menu-dropdown">
            <div className="user-menu-header">
              <div className="user-menu-header-avatar">
                <span>{getInitials(username)}</span>
              </div>
              <div className="user-menu-header-info">
                <div className="user-menu-header-name">{username}</div>
                <div className="user-menu-header-status">🟢 Connected</div>
              </div>
            </div>
            <div className="user-menu-divider"></div>
            <button className="user-menu-item" onClick={openModal}>
              <span className="user-menu-item-icon">✏️</span>
              <span>Change Username</span>
            </button>
            <button
              className="user-menu-item"
              onClick={() => navigator.clipboard.writeText(username)}
            >
              <span className="user-menu-item-icon">📋</span>
              <span>Copy Username</span>
            </button>
            <div className="user-menu-divider"></div>
            <div className="user-menu-item user-menu-info">
              <span className="user-menu-item-icon">ℹ️</span>
              <span>Your username appears in real-time updates</span>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="user-modal-overlay" onClick={closeModal}>
          <div className="user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="user-modal-header">
              <h2>Change Username</h2>
              <button className="user-modal-close" onClick={closeModal}>
                ✕
              </button>
            </div>

            <div className="user-modal-body">
              <p className="user-modal-description">
                Your username will be visible to other users in real-time
                collaboration. Choose something that helps your team identify
                you.
              </p>

              <div className="user-modal-field">
                <label htmlFor="username-input">Username</label>
                <input
                  id="username-input"
                  type="text"
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Enter your username"
                  maxLength={30}
                  autoFocus
                />
                <div className="user-modal-hint">
                  {tempUsername.length}/30 characters
                </div>
              </div>

              <div className="user-modal-preview">
                <div className="user-modal-preview-label">Preview:</div>
                <div className="user-modal-preview-content">
                  <div className="user-avatar-preview">
                    <span>{getInitials(tempUsername || "U")}</span>
                  </div>
                  <span className="user-name-preview">
                    {tempUsername || "Username"}
                  </span>
                  <span className="user-action-preview">
                    moved a card to "In Progress"
                  </span>
                </div>
              </div>
            </div>

            <div className="user-modal-footer">
              <button
                className="user-modal-button user-modal-button-cancel"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                className="user-modal-button user-modal-button-save"
                onClick={handleSave}
                disabled={
                  !tempUsername.trim() || tempUsername.trim() === username
                }
              >
                Save & Reconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UserMenu;
