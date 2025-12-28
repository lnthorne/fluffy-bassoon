import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the mobile controller loading state initially', () => {
    render(<App />)
    
    // The app should show loading state initially while session and connections are being established
    expect(screen.getByText('Connecting to server...')).toBeInTheDocument()
    expect(screen.getByText('⟳')).toBeInTheDocument()
  })
})