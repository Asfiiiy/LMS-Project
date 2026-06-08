/**
 * Zoom API Service - Server-to-Server OAuth
 * Uses account_credentials grant for server-to-server apps
 */
const redis = require('../config/redis');

const ZOOM_TOKEN_CACHE_KEY = 'zoom:access_token';
const ZOOM_TOKEN_TTL = 3500; // Zoom tokens expire in 1 hour; cache 58 min to be safe
const ZOOM_HOST_EMAIL = process.env.ZOOM_HOST_EMAIL;

/**
 * Get Zoom OAuth access token (cached in Redis)
 */
async function getAccessToken() {
  try {
    const cached = await redis.get(ZOOM_TOKEN_CACHE_KEY);
    if (cached) return cached;

    const accountId = process.env.ZOOM_ACCOUNT_ID;
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;

    if (!accountId || !clientId || !clientSecret) {
      throw new Error('Zoom credentials not configured (ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET)');
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: accountId
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Zoom token error: ${res.status} ${errText}`);
    }

    const data = await res.json();
    const token = data.access_token;
    if (!token) throw new Error('No access_token in Zoom response');

    await redis.setex(ZOOM_TOKEN_CACHE_KEY, ZOOM_TOKEN_TTL, token);
    return token;
  } catch (err) {
    throw err;
  }
}

/**
 * Create a scheduled Zoom meeting
 * @param {string} topic - Meeting topic
 * @param {Date|string} startTime - Start time (ISO string or Date)
 * @param {number} durationMinutes - Duration in minutes
 * @param {string} studentName - Student name for topic
 * @returns {Promise<{meetingId, joinUrl, startUrl, password}>}
 */
async function createMeeting(topic, startTime, durationMinutes, studentName) {
  const token = await getAccessToken();
  const start = typeof startTime === 'string' ? startTime : new Date(startTime).toISOString();
  const formattedTopic = topic || `Consultation with ${studentName || 'Student'}`;

  const meetingsUrl = ZOOM_HOST_EMAIL
    ? `https://api.zoom.us/v2/users/${encodeURIComponent(ZOOM_HOST_EMAIL.trim())}/meetings`
    : 'https://api.zoom.us/v2/users/me/meetings';

  const res = await fetch(meetingsUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      topic: formattedTopic,
      type: 2,
      start_time: start,
      duration: durationMinutes || 30,
      timezone: 'Europe/London',
      settings: {
        waiting_room: true,
        auto_recording: 'none'
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Zoom create meeting error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return {
    meetingId: String(data.id),
    joinUrl: data.join_url || '',
    startUrl: data.start_url || '',
    password: data.password || ''
  };
}

/**
 * Delete a Zoom meeting
 * @param {string} meetingId - Zoom meeting ID
 */
async function deleteMeeting(meetingId) {
  if (!meetingId) return;
  const token = await getAccessToken();

  const res = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok && res.status !== 204) {
    // Meeting may already be deleted or other non-ok response
  }
}

module.exports = {
  getAccessToken,
  createMeeting,
  deleteMeeting
};
