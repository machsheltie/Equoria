/**
 * Users API client (Equoria-rfsml) — user search.
 *
 *   GET /api/v1/users/search?username=... → { users: { id, username }[] }
 */

import { apiClient } from '../http/apiClient.js';

export const usersApi = {
  search: (username: string) =>
    apiClient.get<{ users: { id: string; username: string }[] }>(
      `/api/v1/users/search?username=${encodeURIComponent(username)}`
    ),
};
