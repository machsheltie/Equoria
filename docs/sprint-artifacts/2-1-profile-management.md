# Story 2.1: Profile Management

Status: in_progress

## Story

As a **player**,
I want to **edit my profile (display name, bio, and avatar)**,
so that **I can personalize my identity in the game**.

## Acceptance Criteria

1. **AC-1: Profile Page Display**
   - Profile page displays current user information (display name, bio, avatar)
   - Page is accessible via `/profile` route
   - Proper loading and error states

2. **AC-2: Display Name Editing**
   - User can edit display name (3-30 characters)
   - Validation errors shown inline
   - Changes persist after submission

3. **AC-3: Bio Editing**
   - User can edit bio (max 500 characters)
   - Character counter shows remaining characters
   - Validation errors shown inline

4. **AC-4: Avatar Upload** (P2 - Future)
   - Avatar upload (max 2MB, jpg/png) - Deferred to Phase 2
   - Default avatar shown when not set

5. **AC-5: Form Submission**
   - Submit button disabled while form is invalid or submission in progress
   - Spinner shown on button during API call
   - Success toast notification on save
   - Form resets to saved values on cancel

6. **AC-6: Error Handling**
   - Server errors display toast notification
   - Network errors display toast with retry guidance
   - Form validation errors shown inline

## Tasks / Subtasks

- [ ] **Task 1: Extend User Interface** (AC: Foundation)
  - [ ] Add `bio` field to User interface in useAuth.ts
  - [ ] Update authApi.updateProfile to accept bio
  - [ ] Update authApi.getProfile response type

- [ ] **Task 2: Profile Validation Schema** (AC: 2, 3)
  - [ ] Create profileSchema in lib/constants.ts
  - [ ] Display name: 3-30 characters
  - [ ] Bio: max 500 characters

- [ ] **Task 3: ProfilePage Component** (AC: 1, 5)
  - [ ] Create `pages/ProfilePage.tsx`
  - [ ] Integrate useProfile and useUpdateProfile hooks
  - [ ] Handle loading, error, and success states
  - [ ] Add character counter for bio

- [ ] **Task 4: ProfilePage Tests** (AC: All)
  - [ ] Create `pages/__tests__/ProfilePage.test.tsx`
  - [ ] Test form rendering
  - [ ] Test validation error display
  - [ ] Test successful profile update
  - [ ] Test error handling scenarios
  - [ ] Test cancel behavior

- [ ] **Task 5: Route Integration** (AC: 1)
  - [ ] Add `/profile` route to App.tsx
  - [ ] Protect route with RoleProtectedRoute

## Dev Notes

### Architecture Patterns (from ADD)

**State Management (ADR-001):**
- Use React Query's `useMutation` for profile update
- Optimistic updates for better UX

**Form Handling (ADR-002):**
- `useState` for form data
- Zod schema for validation

**API Client (ADR-004):**
- Use `authApi.updateProfile` from `lib/api-client.ts`

### API Endpoint

```
PATCH /api/v1/users/profile
Content-Type: application/json

Request:
{
  "username": "NewDisplayName",
  "bio": "This is my bio"
}

Response (200):
{
  "status": "success",
  "data": {
    "user": {
      "id": 1,
      "username": "NewDisplayName",
      "email": "user@example.com",
      "bio": "This is my bio"
    }
  }
}
```

### Validation Schema

```typescript
// lib/constants.ts
export const profileSchema = z.object({
  username: z
    .string()
    .min(3, 'Display name must be at least 3 characters')
    .max(30, 'Display name must not exceed 30 characters'),
  bio: z
    .string()
    .max(500, 'Bio must not exceed 500 characters')
    .optional(),
});
```

### References

- [Source: docs/epics.md#Story-2.1] - Story definition
- [Source: docs/architecture.md] - ADD patterns
- FR-U5: Profile management requirement

## Dev Agent Record

### Context Reference

- docs/architecture.md - Complete ADD
- docs/epics.md - Epic 2, Story 2.1 definition
- docs/sprint-artifacts/sprint-status.yaml - Sprint tracking

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List

**To Create:**
- `frontend/src/pages/ProfilePage.tsx`
- `frontend/src/pages/__tests__/ProfilePage.test.tsx`

**To Modify:**
- `frontend/src/hooks/useAuth.ts` - Add bio to User interface
- `frontend/src/lib/api-client.ts` - Update profile types
- `frontend/src/lib/constants.ts` - Add profileSchema
- `frontend/src/App.tsx` - Add /profile route
