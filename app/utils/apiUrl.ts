// Get API base URL - works in both client and server
export const getApiUrl = () => {
  // In browser, use env var or construct from window location
  if (typeof window !== 'undefined') {
    // If NEXT_PUBLIC_API_URL is set, use it
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL;
    }
    
    // Otherwise, use the same protocol and hostname as the current page
    // This ensures HTTPS pages use HTTPS for API calls (fixes Mixed Content error)
    // For production with Nginx proxy, API should be on same domain: /api
    // For development, use port 5000
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    // If on HTTPS (production), use same domain with /api path (Nginx will proxy)
    if (protocol === 'https:') {
      return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
    }
    
    // For HTTP (development), use port 5000
    return `${protocol}//${hostname}:5000`;
  }
  // On server, use env var or localhost
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
};
