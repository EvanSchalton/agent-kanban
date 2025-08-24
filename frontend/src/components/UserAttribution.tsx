import React, { useState, useEffect } from "react";
import "./UserAttribution.css";

const UserAttribution: React.FC = () => {
  const [username, setUsername] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);

  useEffect(() => {
    // Load username from localStorage on mount
    const savedUsername = localStorage.getItem("username");
    if (savedUsername) {
      setUsername(savedUsername);
    } else {
      // Generate default username
      const defaultUsername = `user_${Math.floor(Math.random() * 1000)}`;
      setUsername(defaultUsername);
      localStorage.setItem("username", defaultUsername);
    }
  }, []);

  const handleSave = () => {
    if (username.trim()) {
      localStorage.setItem("username", username.trim());
      setIsEditing(false);
      // Reload page to reconnect WebSocket with new username
      window.location.reload();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      // Reset to saved value
      setUsername(localStorage.getItem("username") || "");
    }
  };

  return (
    <div className="user-attribution">
      {isEditing ? (
        <div className="user-edit">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyPress}
            onBlur={handleSave}
            placeholder="Enter username"
            autoFocus
            maxLength={30}
          />
          <button onClick={handleSave} title="Save username">
            ✓
          </button>
        </div>
      ) : (
        <div className="user-display" onClick={() => setIsEditing(true)}>
          <span className="user-icon">👤</span>
          <span className="username">{username}</span>
          <span className="edit-hint" title="Click to edit">
            ✏️
          </span>
        </div>
      )}
    </div>
  );
};

export default UserAttribution;
