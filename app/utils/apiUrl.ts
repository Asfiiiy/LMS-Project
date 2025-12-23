// Get API base URL - works in both client and server
export const getApiUrl = () => {
  // In browser, use env var or construct from window location
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 
           `${window.location.protocol}//${window.location.hostname}:5000`;
  }
  // On server, use env var or localhost
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
};
