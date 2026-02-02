# Input Validation Rules

### Common Validations
| Field | Rule | Message |
|-------|------|---------|
| Horse ID | Positive integer | "ID must be positive integer" |
| Email | Valid format, unique | "Valid email required" |
| Name | 2-50 characters | "Name must be 2-50 characters" |
| Discipline | Valid from statMap | "Invalid discipline" |
| Money/Scores | Non-negative | "Must be non-negative" |

### Business Rule Validations
| Rule | Description |
|------|-------------|
| Training Age | Horses must be 3+ years old |
| Training Cooldown | 7-day global cooldown per horse |
| Competition Age | Age 3-20, level restrictions |
| Breeding | Age and gender requirements |

---
