export const leaderboardSchemas = [
  {
    path: '/leaderboards',
    method: 'get',
    summary: 'List leaderboards',
    responses: { 200: { description: 'Leaderboards returned' } },
    tags: ['leaderboards'],
  },
];
