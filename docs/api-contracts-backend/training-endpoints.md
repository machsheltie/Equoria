# Training Endpoints

**Base Path:** `/api/training` or `/api/v1/training`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/training/check-eligibility` | Validate horse training eligibility | Yes |
| POST | `/training/train` | Execute training session | Yes |
| GET | `/training/status/:horseId/:discipline` | Individual discipline status | Yes |
| GET | `/training/horse/:horseId/all-status` | Multi-discipline status overview | Yes |
| GET | `/training/trainable-horses/:userId` | Get trainable horses | Yes |

### Training Request
```json
{
  "horseId": 1,
  "discipline": "dressage"
}
```

### Training Response
```json
{
  "success": true,
  "message": "Training completed successfully",
  "updatedScore": 35,
  "nextEligibleDate": "2025-12-08T00:00:00Z"
}
```

### Business Rules
- **Age Requirement:** Horses must be 3+ years old
- **Global Cooldown:** 7-day cooldown per horse (any discipline)
- **Score Progression:** +5 points per training session

---
