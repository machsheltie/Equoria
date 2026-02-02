# Trait Endpoints

**Base Path:** `/api/traits` or `/api/v1/traits`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/traits/:horseId` | Get horse traits | Yes |
| GET | `/traits/:horseId/history` | Get trait history | Yes |
| GET | `/traits/:horseId/epigenetic` | Get epigenetic flags | Yes |
| GET | `/traits/definitions` | Trait definition reference | Yes |
| POST | `/traits/discover/:horseId` | Trigger discovery | Yes |
| GET | `/traits/discovery-status/:id` | Get discovery status | Yes |
| POST | `/traits/batch-discover` | Batch discovery | Yes |
| GET | `/traits/competition-impact/:horseId` | Competition impact | Yes |
| GET | `/traits/competition-comparison/:horseId` | Competition comparison | Yes |

### Ultra-Rare Traits
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/ultra-rare-traits/definitions` | Get definitions | Yes |
| GET | `/ultra-rare-traits/:horseId` | Get ultra-rare traits | Yes |
| POST | `/ultra-rare-traits/evaluate/:horseId` | Evaluate for traits | Yes |
| GET | `/ultra-rare-traits/events/:horseId` | Get trait events | Yes |
| POST | `/ultra-rare-traits/check-conditions/:horseId` | Check conditions | Yes |
| GET | `/ultra-rare-traits/groom-perks/:groomId` | Get groom perks | Yes |

### Epigenetic Traits
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/epigenetic-traits/definitions` | Get definitions | Yes |
| POST | `/epigenetic-traits/evaluate-milestone/:horseId` | Evaluate milestone | Yes |
| POST | `/epigenetic-traits/log-trait` | Log trait | Yes |
| GET | `/epigenetic-traits/history/:horseId` | Get history | Yes |
| GET | `/epigenetic-traits/summary/:horseId` | Get summary | Yes |
| GET | `/epigenetic-traits/breeding-insights/:horseId` | Breeding insights | Yes |

### Epigenetic Flags
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/flags/evaluate` | Evaluate flags for horse | Yes |
| GET | `/horses/:id/flags` | Get horse flags | Yes |
| GET | `/flags/definitions` | Get flag definitions | Yes |

---
