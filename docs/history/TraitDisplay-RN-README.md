# TraitDisplay Component

A React Native component for displaying horse epigenetic traits with positive/negative badges, hidden trait placeholders, and detailed modal descriptions.

## Features

- ✅ **Positive traits** displayed with green badges
- ❌ **Negative traits** displayed with red badges
- 🔍 **Hidden traits** shown as "???" placeholders
- 📱 **Modal descriptions** with detailed trait information
- ♿ **Full accessibility** support with proper labels and hints
- 🎨 **Beautiful UI** with gradients and animations
- 📱 **Mobile-first** responsive design

## Installation

```bash
# Ensure you have expo-linear-gradient installed
npm install expo-linear-gradient
```

## Basic Usage

```jsx
import TraitDisplay from './components/TraitDisplay';

const MyHorseScreen = () => {
  const traits = {
    positive: ['resilient', 'bold'],
    negative: ['nervous'],
    hidden: ['trainability_boost'],
  };

  return (
    <TraitDisplay
      traits={traits}
      horseName="Thunder"
      onTraitPress={(traitKey, traitInfo) => {
        console.log('Trait pressed:', traitKey, traitInfo);
      }}
    />
  );
};
```

## Props

| Prop           | Type       | Default     | Description                                                   |
| -------------- | ---------- | ----------- | ------------------------------------------------------------- |
| `traits`       | `Object`   | `{}`        | Object containing positive, negative, and hidden trait arrays |
| `horseName`    | `string`   | `'Horse'`   | Name of the horse for display and accessibility               |
| `onTraitPress` | `function` | `undefined` | Optional callback when a trait is pressed                     |

### Traits Object Structure

```javascript
{
  positive: ['resilient', 'bold', 'intelligent'],  // Array of positive trait keys
  negative: ['nervous', 'stubborn'],               // Array of negative trait keys
  hidden: ['trainability_boost', 'athletic']       // Array of hidden trait keys
}
```

## Supported Traits

### Positive Traits

- `resilient` - Faster stress recovery, improved training consistency
- `bold` - Enhanced competition performance, better adaptability
- `intelligent` - Accelerated learning, improved skill retention
- `athletic` - Improved physical stats, better movement quality
- `calm` - Reduced stress accumulation, improved focus
- `trainability_boost` - Major training efficiency bonus, faster skill development

### Negative Traits

- `nervous` - Increased stress sensitivity, requires gentle approach
- `stubborn` - Slower initial learning, increased training time required
- `fragile` - Higher injury risk, requires careful training management
- `aggressive` - Handling challenges, social difficulties
- `lazy` - Reduced training efficiency, requires motivation techniques

### Custom Traits

The component gracefully handles unknown traits by auto-generating display names:

- `fire_resistance` → "Fire Resistance"
- `weather_immunity` → "Weather Immunity"

## Examples

### Complete Horse Profile

```jsx
<TraitDisplay
  traits={{
    positive: ['resilient', 'bold', 'intelligent'],
    negative: ['nervous', 'stubborn'],
    hidden: ['trainability_boost', 'athletic'],
  }}
  horseName="Thunder"
/>
```

### Champion Horse (Positive Only)

```jsx
<TraitDisplay
  traits={{
    positive: ['athletic', 'calm', 'intelligent', 'bold'],
    negative: [],
    hidden: ['trainability_boost'],
  }}
  horseName="Champion"
/>
```

### Young Horse (Mostly Hidden)

```jsx
<TraitDisplay
  traits={{
    positive: ['bold'],
    negative: [],
    hidden: [
      'intelligent',
      'athletic',
      'nervous',
      'trainability_boost',
      'calm',
    ],
  }}
  horseName="Starlight"
/>
```

### Empty State

```jsx
<TraitDisplay
  traits={{
    positive: [],
    negative: [],
    hidden: [],
  }}
  horseName="Mystery"
/>
```

## Accessibility Features

The component includes comprehensive accessibility support:

- **Screen Reader Support**: Proper `accessibilityLabel` and `accessibilityHint` for all interactive elements
- **Role Definitions**: Correct `accessibilityRole` assignments for buttons and modals
- **Keyboard Navigation**: Full keyboard navigation support
- **Focus Management**: Proper focus handling in modals
- **Descriptive Labels**: Clear descriptions of trait types and interactions

### Accessibility Labels

- Positive traits: `"Resilient trait - positive"`
- Negative traits: `"Nervous trait - negative"`
- Hidden traits: `"Hidden trait - not yet discovered"`
- Modal: `"Close trait details"`

## Styling

The component uses Tailwind CSS classes and can be customized by modifying the internal styles:

### Color Scheme

- **Positive traits**: Green badges (`bg-green-500`)
- **Negative traits**: Red badges (`bg-red-500`)
- **Hidden traits**: Gray dashed borders (`border-gray-400`)
- **Header**: Purple gradient (`#8B5CF6` to `#7C3AED`)

### Responsive Design

- Mobile-first approach with proper spacing
- Flexible badge layout that wraps on smaller screens
- Modal adapts to screen size with max-width constraints

## Modal Functionality

Clicking any visible trait opens a detailed modal with:

- **Trait name** and type badge
- **Detailed description** of the trait's effects
- **Gameplay impact** information
- **Close options**: X button, backdrop tap, or "Got it!" button

### Modal Content Structure

```javascript
{
  name: 'Resilient',
  type: 'positive',
  description: 'This horse recovers quickly from stress and setbacks...',
  effects: 'Faster stress recovery, improved training consistency'
}
```

## Integration Tips

1. **Analytics Tracking**: Use the `onTraitPress` callback to track which traits players are most interested in
2. **Progressive Disclosure**: Start with mostly hidden traits and reveal them through gameplay
3. **Trait Discovery**: Implement a system where traits are discovered through training, breeding, or special events
4. **Custom Traits**: Add new traits by extending the internal `traitDefinitions` object
5. **Localization**: Trait names and descriptions can be easily localized

## Performance Considerations

- **Lightweight**: Component only renders visible sections
- **Efficient Updates**: Uses React's built-in optimization for re-renders
- **Memory Friendly**: Modal content only rendered when needed
- **Smooth Animations**: Uses native animations for modal transitions

## Testing

The component includes comprehensive tests covering:

- ✅ Rendering with all trait types
- ✅ Modal functionality (open/close)
- ✅ Accessibility features
- ✅ Callback functionality
- ✅ Edge cases and error handling
- ✅ Empty states and missing data

Run tests with:

```bash
npm test -- --testPathPattern=TraitDisplay.test.js
```

## Dependencies

- `react` - Core React functionality
- `react-native` - Native components (View, Text, TouchableOpacity, Modal, etc.)
- `expo-linear-gradient` - Gradient backgrounds

## Browser/Platform Support

- ✅ iOS (React Native)
- ✅ Android (React Native)
- ✅ Expo managed workflow
- ✅ Expo bare workflow

## Contributing

When adding new traits:

1. Add the trait definition to the `traitDefinitions` object
2. Include proper `name`, `type`, `description`, and `effects`
3. Add test cases for the new trait
4. Update this documentation

## License

This component is part of the Equoria project and follows the project's licensing terms.
