# Overview

**Last Updated:** 2025-12-01 (Full Rescan)
**Total Endpoints:** 130+
**Route Files:** 35

The Equoria backend provides a comprehensive REST API for the horse breeding simulation game. All endpoints follow consistent patterns for authentication, validation, error handling, and response formatting.

### Base Configuration

| Environment | URL | Port |
|-------------|-----|------|
| Development | `http://localhost:3001/api` | 3001 |
| Production | `https://api.equoria.com/api` | 443 |

### Response Format

All API responses follow a consistent format:

```json
{
  "success": true|false,
  "message": "Descriptive message",
  "data": { ... } | null,
  "error": null | "Error description"
}
```

---
