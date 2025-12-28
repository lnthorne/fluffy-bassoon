import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the mobile controller interface', () => {
    render(<App />)
    
    expect(screen.getByText('Party Jukebox')).toBeInTheDocument()
    expect(screen.getByText('Mobile Controller')).toBeInTheDocument()
    expect(screen.getByText(/Welcome to the Party Jukebox Mobile Controller/)).toBeInTheDocument()
  })
})