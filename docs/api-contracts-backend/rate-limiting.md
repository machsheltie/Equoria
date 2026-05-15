# Rate Limiting

| Endpoint Type  | Limit               | Window     |
| -------------- | ------------------- | ---------- |
| Authentication | 200 failed requests | 15 minutes |
| General API    | 100 requests        | 15 minutes |
| Training       | 20 failed requests  | 1 minute   |
| Competition    | 20 entries          | 5 minutes  |
| Breeding       | 10 operations       | 5 minutes  |
| Foal           | 15 actions          | 1 minute   |
| Mutation       | 30 requests (prod)  | 1 minute   |

---
