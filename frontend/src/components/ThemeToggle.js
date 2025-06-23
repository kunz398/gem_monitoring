// src/components/ThemeToggle.js
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Icon from '@mdi/react';
import { mdiThemeLightDark } from '@mdi/js';

const ThemeToggle = () => {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <div className="theme-toggle-container">
      <span className="theme-label">
        <Icon path={mdiThemeLightDark}
        title="Theme"
        size={1}      
        color="green"

      />
      </span>
      <label className="theme-switch">
        <input
          type="checkbox"
          checked={isDark}
          onChange={toggleTheme}
          aria-label="Toggle dark mode"
        />
        <span className="slider"></span>
      </label>
      <span className="theme-label"></span>
    </div>
  );
};

export default ThemeToggle;