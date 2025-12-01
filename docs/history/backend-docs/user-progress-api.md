# User Progress API

## Overview

The User Progress API provides a clean endpoint to retrieve a user's current level, XP, and XP needed to reach the next level. This is essential for frontend display of user progression.

## Endpoint

```
GET /api/user/:id/progress
```

## Parameters

| Parameter | Type   | Required | Description               |
| --------- | ------ | -------- | ------------------------- |
| `id`      | string | Yes      | User ID (1-50 characters) |

## Response Format

### Success Response (200)

```json
{
  "success": true,
  "message": "User progress retrieved successfully",
  "data": {
    "userId": "123e4567-e89b-12d3-a456-426614174000",
    "username": "Alex",
    "level": 4,
    "xp": 30,
    "xpToNextLevel": 70
  }
}
```

### Error Responses

#### User Not Found (404)

```json
{
  "success": false,
  "message": "User not found"
}
```

#### Validation Error (400)

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "User ID must be between 1 and 50 characters",
      "param": "id",
      "location": "params"
    }
  ]
}
```

#### Server Error (500)

```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Something went wrong"
}
```

## XP Calculation Logic

The `xpToNextLevel` field is calculated using the formula:

```javascript
xpToNextLevel = 100 - (user.xp % 100);
```

### Examples

| Current XP | Level | XP in Current Level | XP to Next Level |
| ---------- | ----- | ------------------- | ---------------- |
| 0          | 1     | 0                   | 100              |
| 50         | 1     | 50                  | 50               |
| 99         | 1     | 99                  | 1                |
| 100        | 2     | 0                   | 100              |
| 150        | 2     | 50                  | 50               |
| 230        | 3     | 30                  | 70               |

## Usage Examples

### JavaScript/Fetch

```javascript
const response = await fetch('/api/user/123e4567-e89b-12d3-a456-426614174000/progress');
const data = await response.json();

if (data.success) {
  console.log(`${data.data.username} is level ${data.data.level}`);
  console.log(`${data.data.xp} XP, needs ${data.data.xpToNextLevel} more to level up`);
}
```

### React Component Example

```jsx
import { useState, useEffect } from 'react';

function UserProgress({ userId }) {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/user/${userId}/progress`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setProgress(data.data);
        }
        setLoading(false);
      });
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (!progress) return <div>User not found</div>;

  return (
    <div className='user-progress'>
      <h2>{progress.username}</h2>
      <div className='level'>Level {progress.level}</div>
      <div className='xp-bar'>
        <div
          className='xp-progress'
          style={{
            width: `${(progress.xp / 100) * 100}%`,
          }}
        ></div>
      </div>
      <div className='xp-text'>
        {progress.xp} / 100 XP ({progress.xpToNextLevel} to next level)
      </div>
    </div>
  );
}
```

## Implementation Details

### Files Modified

- `backend/controllers/userController.js` - New controller with `getUserProgress` function
- `backend/routes/userRoutes.js` - New route file with validation
- `backend/app.js` - Added user routes registration

### Dependencies

- Uses existing `getUserById` function from `userModel.js`
- Includes input validation with `express-validator`
- Proper error handling and logging

### Security

- Input validation for user ID length
- No sensitive data exposed (email, money, settings excluded)
- Proper error handling without exposing internal details

## Testing

The API includes comprehensive tests:

- Unit tests for controller logic (`tests/userController.test.js`)
- Integration tests for routes (`tests/integration/userRoutes.test.js`)
- Manual testing script (`scripts/testUserProgressAPI.js`)

Run tests with:

```bash
npm test tests/userController.test.js
npm test tests/integration/userRoutes.test.js
```

## Related APIs

This API integrates with the XP system implemented in Tasks 3.1-3.3:

- **Task 3.1**: XP and level support in `userModel.js`
- **Task 3.2**: XP awards for competition placements
- **Task 3.3**: XP awards for successful training

The progress API provides a clean way for the frontend to display the results of these XP-earning activities.
