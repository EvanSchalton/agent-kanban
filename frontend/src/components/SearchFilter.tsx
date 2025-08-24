import React, { useState, useEffect } from "react";
import { useBoard } from "../context/useBoardHook";
import "./SearchFilter.css";

const SearchFilter: React.FC = () => {
  const { setSearchFilter } = useBoard();
  const [searchInput, setSearchInput] = useState("");

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchFilter(searchInput);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchInput, setSearchFilter]);

  const clearSearch = () => {
    setSearchInput("");
    setSearchFilter("");
  };

  return (
    <div className="search-filter">
      <div className="search-input-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search tickets by title..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {searchInput && (
          <button className="clear-search-button" onClick={clearSearch}>
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchFilter;
