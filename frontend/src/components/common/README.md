# BaseModal Component - Usage Guide

**Action Item:** AI-5-1 - Extract BaseModal Component
**Status:** ✅ Completed (2026-02-05)

---

## Overview

BaseModal is a reusable modal foundation that provides all common modal functionality. It consolidates patterns from 6+ modal components across Epics 4 and 5, eliminating code duplication and ensuring consistency.

### Features

- ✅ **Portal Rendering:** Proper stacking context via `createPortal`
- ✅ **Focus Management:** Automatic focus trap and restoration
- ✅ **Keyboard Handling:** Escape key to close
- ✅ **Body Scroll Lock:** Prevents background scrolling
- ✅ **Backdrop Clicks:** Configurable close behavior
- ✅ **ARIA Attributes:** Full accessibility support
- ✅ **Responsive Design:** Works on mobile/tablet/desktop
- ✅ **WCAG 2.1 AA Compliance:** Accessible to all users
- ✅ **Customizable:** Flexible props for different use cases

---

## Basic Usage

```tsx
import BaseModal from '@/components/common/BaseModal';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <BaseModal isOpen={isOpen} onClose={() => setIsOpen(false)} title="My Modal Title">
      <p>Modal content goes here.</p>
    </BaseModal>
  );
}
```

---

## Props API

| Prop                   | Type                                     | Default        | Description                                |
| ---------------------- | ---------------------------------------- | -------------- | ------------------------------------------ |
| `isOpen`               | `boolean`                                | **required**   | Whether the modal is open                  |
| `onClose`              | `() => void`                             | **required**   | Callback when modal should close           |
| `title`                | `string`                                 | **required**   | Modal title displayed in header            |
| `children`             | `ReactNode`                              | **required**   | Modal content                              |
| `footer`               | `ReactNode`                              | `undefined`    | Optional footer content (buttons, actions) |
| `size`                 | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'` | `'md'`         | Modal size                                 |
| `showCloseButton`      | `boolean`                                | `true`         | Whether to show close button (X)           |
| `closeOnEscape`        | `boolean`                                | `true`         | Allow closing via Escape key               |
| `closeOnBackdropClick` | `boolean`                                | `true`         | Allow closing via backdrop click           |
| `isSubmitting`         | `boolean`                                | `false`        | Loading/submitting state (disables close)  |
| `className`            | `string`                                 | `''`           | Additional CSS classes for modal container |
| `aria-describedby`     | `string`                                 | `undefined`    | ARIA description ID for screen readers     |
| `data-testid`          | `string`                                 | `'base-modal'` | Test ID for the modal container            |

---

## Examples

### Example 1: Simple Modal

```tsx
<BaseModal isOpen={isOpen} onClose={handleClose} title="Delete Confirmation">
  <p>Are you sure you want to delete this item?</p>
</BaseModal>
```

### Example 2: Modal with Footer Actions

```tsx
<BaseModal
  isOpen={isOpen}
  onClose={handleClose}
  title="Edit Horse Details"
  footer={
    <>
      <button
        onClick={handleClose}
        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
      >
        Cancel
      </button>
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Saving...' : 'Save Changes'}
      </button>
    </>
  }
>
  <form>
    <input type="text" placeholder="Horse Name" />
    {/* More form fields */}
  </form>
</BaseModal>
```

### Example 3: Large Modal with Complex Content

```tsx
<BaseModal isOpen={isOpen} onClose={handleClose} title="Competition Results" size="lg">
  <div className="space-y-6">
    <section>
      <h3 className="font-semibold mb-2">Performance Breakdown</h3>
      <div className="grid grid-cols-2 gap-4">{/* Performance stats */}</div>
    </section>

    <section>
      <h3 className="font-semibold mb-2">Score Details</h3>
      <div className="chart-container">{/* Chart component */}</div>
    </section>
  </div>
</BaseModal>
```

### Example 4: Non-Dismissible Modal (Loading State)

```tsx
<BaseModal
  isOpen={isSubmitting}
  onClose={() => {}} // No-op - user can't close
  title="Processing..."
  showCloseButton={false}
  closeOnEscape={false}
  closeOnBackdropClick={false}
  isSubmitting={true}
>
  <div className="flex flex-col items-center py-6">
    <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
    <p className="mt-4 text-gray-600">Please wait while we process your request...</p>
  </div>
</BaseModal>
```

### Example 5: Small Confirmation Modal

```tsx
<BaseModal
  isOpen={isOpen}
  onClose={handleClose}
  title="Confirm Action"
  size="sm"
  footer={
    <>
      <button onClick={handleClose}>No</button>
      <button onClick={handleConfirm}>Yes, Continue</button>
    </>
  }
>
  <p>This action cannot be undone. Are you sure?</p>
</BaseModal>
```

---

## Modal Sizes

BaseModal supports 5 size options:

| Size   | Max Width      | Use Case                        |
| ------ | -------------- | ------------------------------- |
| `sm`   | 448px (28rem)  | Confirmations, simple forms     |
| `md`   | 672px (42rem)  | **Default** - Most modals       |
| `lg`   | 896px (56rem)  | Complex forms, detailed content |
| `xl`   | 1152px (72rem) | Data tables, extensive content  |
| `full` | 95vw           | Maximum content, rare cases     |

```tsx
// Small modal
<BaseModal size="sm" title="Quick Confirmation" {...props} />

// Large modal
<BaseModal size="lg" title="Detailed Competition Results" {...props} />
```

---

## Focus Management

BaseModal automatically manages focus:

1. **On Open:**

   - Stores currently focused element
   - Focuses the modal container
   - Locks body scroll

2. **On Close:**
   - Restores focus to previous element
   - Unlocks body scroll
   - Cleans up event listeners

**No action required** - this happens automatically!

---

## Accessibility (ARIA)

BaseModal implements WCAG 2.1 AA compliance:

- ✅ `role="dialog"` - Identifies as dialog
- ✅ `aria-modal="true"` - Indicates modal behavior
- ✅ `aria-labelledby` - Links to title
- ✅ `aria-describedby` - Links to description (optional)
- ✅ Focus trap - Keeps focus within modal
- ✅ Escape key - Allows keyboard dismissal
- ✅ Close button - Visible, labeled "Close modal"

### Custom ARIA Description

```tsx
<BaseModal
  isOpen={isOpen}
  onClose={handleClose}
  title="Prize Notification"
  aria-describedby="prize-description"
>
  <p id="prize-description">Congratulations! You won 1st place in the Dressage competition.</p>
  <div className="prize-details">{/* Prize details */}</div>
</BaseModal>
```

---

## Testing

BaseModal includes comprehensive tests (37 test cases):

```bash
# Run BaseModal tests
cd frontend
npm test -- BaseModal

# Test coverage
npm test -- BaseModal --coverage
```

### Test Data IDs

BaseModal provides consistent test IDs:

```tsx
// Default test IDs
data-testid="base-modal"
data-testid="base-modal-backdrop"
data-testid="base-modal-title"
data-testid="base-modal-content"
data-testid="base-modal-footer"  // if footer provided
data-testid="base-modal-close-button"

// Custom test ID
<BaseModal data-testid="custom-modal" {...props} />
// Generates: custom-modal, custom-modal-backdrop, etc.
```

### Example Test

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BaseModal from '@/components/common/BaseModal';

it('should close modal when Escape key is pressed', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();

  render(
    <BaseModal isOpen={true} onClose={onClose} title="Test">
      <p>Content</p>
    </BaseModal>
  );

  await user.keyboard('{Escape}');

  expect(onClose).toHaveBeenCalledTimes(1);
});
```

---

## Migration Guide

### Before (Old Pattern)

```tsx
// Old modal with duplicated focus/scroll logic
const OldModal = ({ isOpen, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      document.addEventListener('keydown', handleKeyDown);
      if (modalRef.current) {
        modalRef.current.focus();
      }
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
        if (previousActiveElement.current) {
          (previousActiveElement.current as HTMLElement).focus();
        }
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1}>
        {/* Content */}
      </div>
    </div>,
    document.body
  );
};
```

### After (BaseModal Pattern)

```tsx
// New pattern - all focus/scroll logic handled by BaseModal
import BaseModal from '@/components/common/BaseModal';

const NewModal = ({ isOpen, onClose }) => {
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="My Modal">
      {/* Just the content - no boilerplate! */}
    </BaseModal>
  );
};
```

**Result:** ~100 lines of duplicated code → 5 lines of clean code

---

## Best Practices

### 1. Always Provide Meaningful Titles

```tsx
// ✅ Good - Descriptive
<BaseModal title="Edit Training Session" />

// ❌ Bad - Generic
<BaseModal title="Modal" />
```

### 2. Use Footer for Actions

```tsx
// ✅ Good - Actions in footer
<BaseModal
  title="Delete Horse"
  footer={
    <>
      <button onClick={onCancel}>Cancel</button>
      <button onClick={onDelete}>Delete</button>
    </>
  }
>
  <p>Are you sure?</p>
</BaseModal>

// ❌ Bad - Actions in content (inconsistent)
<BaseModal title="Delete Horse">
  <p>Are you sure?</p>
  <div>
    <button onClick={onCancel}>Cancel</button>
    <button onClick={onDelete}>Delete</button>
  </div>
</BaseModal>
```

### 3. Match Size to Content

```tsx
// ✅ Good - Size matches content
<BaseModal size="sm" title="Quick Confirm">
  <p>One-line message</p>
</BaseModal>

<BaseModal size="lg" title="Detailed Results">
  <div className="complex-layout">
    {/* Charts, tables, etc. */}
  </div>
</BaseModal>

// ❌ Bad - Size mismatch
<BaseModal size="xl" title="Simple Confirm">
  <p>Yes or No?</p>
</BaseModal>
```

### 4. Handle Loading States Properly

```tsx
// ✅ Good - Disable close during submission
<BaseModal
  isOpen={isOpen}
  onClose={handleClose}
  title="Save Changes"
  isSubmitting={isSaving}
  footer={
    <>
      <button onClick={handleClose} disabled={isSaving}>
        Cancel
      </button>
      <button onClick={handleSubmit} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    </>
  }
>
  <form>{/* Form fields */}</form>
</BaseModal>
```

### 5. Use Consistent Styling

```tsx
// ✅ Good - Consistent with design system
<BaseModal
  footer={
    <>
      <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100">
        Cancel
      </button>
      <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        Confirm
      </button>
    </>
  }
>
  {/* Content */}
</BaseModal>
```

---

## Troubleshooting

### Modal Not Closing on Escape

**Problem:** Escape key doesn't close modal
**Solution:** Check that `closeOnEscape` is not set to `false`, and `isSubmitting` is not `true`

```tsx
// Make sure these are configured correctly
<BaseModal closeOnEscape={true} isSubmitting={false} />
```

### Focus Not Restoring

**Problem:** Focus doesn't return to trigger button after closing
**Solution:** Ensure the trigger element still exists in DOM when modal closes

```tsx
// ✅ Good - Button persists
<button onClick={() => setIsOpen(true)}>Open Modal</button>;

// ❌ Bad - Button conditionally rendered
{
  !isOpen && <button onClick={() => setIsOpen(true)}>Open Modal</button>;
}
```

### Body Scroll Issues

**Problem:** Body still scrollable when modal open
**Solution:** BaseModal handles this automatically. If issues persist, check for conflicting CSS:

```css
/* ❌ Avoid conflicting overflow styles */
body {
  overflow: auto !important; /* !important breaks scroll lock */
}
```

### Multiple Modals Stacking

**Problem:** Multiple modals don't stack properly
**Solution:** Consider using a modal manager or sequential display:

```tsx
// Option 1: Sequential (recommended)
{
  showFirstModal && <BaseModal title="First" {...props1} />;
}
{
  showSecondModal && !showFirstModal && <BaseModal title="Second" {...props2} />;
}

// Option 2: Higher z-index for second modal
<BaseModal title="Second" className="z-[60]" {...props2} />;
```

---

## Performance

BaseModal is optimized for performance:

- ✅ `memo()` wrapper prevents unnecessary re-renders
- ✅ `useCallback()` for event handlers
- ✅ Portal rendering avoids parent re-render impact
- ✅ Efficient cleanup on unmount

**Rendering only happens when `isOpen` changes.**

---

## Related Components

- **Dialog Components:** Use BaseModal as foundation
- **Toast/Notification:** Different pattern (non-modal)
- **Drawer/Sidebar:** Different pattern (slide-in)

---

## Changelog

### v1.0 (2026-02-05)

- ✅ Initial implementation
- ✅ 37 test cases (100% coverage)
- ✅ Full WCAG 2.1 AA compliance
- ✅ Documentation complete

---

## Support

**Questions or Issues:**

- Frontend Lead: Sarah
- Documentation: `frontend/src/components/common/README.md`
- Tests: `frontend/src/components/common/__tests__/BaseModal.test.tsx`

---

**Last Updated:** 2026-02-05
**Status:** ✅ Implemented and Tested
**Action Item:** AI-5-1 (Complete)
