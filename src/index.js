// src/index.js

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { SnackbarProvider } from 'notistack'
import { ThemeProvider, createTheme } from '@mui/material'
import CssBaseline from '@mui/material/CssBaseline'
import './index.css'                // our cosmic CSS

// create a dark theme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#66ccff' },
    secondary: { main: '#ff66ff' },
    background: { default: '#0a0a1a', paper: '#1a1a2e' },
    text: { primary: '#e0e0e0' },
  },
  typography: {
    fontFamily: '"Orbitron", sans-serif',
  }
})

const container = document.getElementById('root')
const root = ReactDOM.createRoot(container)
root.render(
  <React.StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3}>
        <App />
      </SnackbarProvider>
    </ThemeProvider>
  </React.StrictMode>
)
