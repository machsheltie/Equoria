import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import TraitDisplay from '../TraitDisplay';

/**
 * TraitDisplayExample - Demonstrates various usage scenarios for the TraitDisplay component
 */
const TraitDisplayExample = () => {
  const [selectedExample, setSelectedExample] = useState('complete');

  // Example trait configurations
  const examples = {
    complete: {
      title: 'Complete Horse Profile',
      description:
        'A mature horse with discovered positive and negative traits, plus hidden ones',
      traits: {
        positive: ['resilient', 'bold', 'intelligent'],
        negative: ['nervous', 'stubborn'],
        hidden: ['trainability_boost', 'athletic'],
      },
      horseName: 'Thunder',
    },

    positive_only: {
      title: 'Champion Horse',
      description: 'A well-bred horse with only positive traits discovered',
      traits: {
        positive: ['athletic', 'calm', 'intelligent', 'bold'],
        negative: [],
        hidden: ['trainability_boost'],
      },
      horseName: 'Champion',
    },

    negative_heavy: {
      title: 'Challenging Horse',
      description: 'A horse with behavioral challenges that need management',
      traits: {
        positive: ['resilient'],
        negative: ['aggressive', 'nervous', 'stubborn', 'lazy'],
        hidden: ['calm'],
      },
      horseName: 'Rebel',
    },

    young_horse: {
      title: 'Young Horse',
      description: 'A young horse with mostly undiscovered traits',
      traits: {
        positive: ['bold'],
        negative: [],
        hidden: [
          'intelligent',
          'athletic',
          'nervous',
          'trainability_boost',
          'calm',
        ],
      },
      horseName: 'Starlight',
    },

    empty: {
      title: 'New Horse',
      description: 'A newly acquired horse with no traits discovered yet',
      traits: {
        positive: [],
        negative: [],
        hidden: [],
      },
      horseName: 'Mystery',
    },

    unknown_traits: {
      title: 'Rare Traits',
      description: 'A horse with some unknown/custom traits',
      traits: {
        positive: ['fire_resistance', 'weather_immunity'],
        negative: ['water_phobia'],
        hidden: ['legendary_bloodline'],
      },
      horseName: 'Phoenix',
    },
  };

  const currentExample = examples[selectedExample];

  // Handle trait press callback
  const handleTraitPress = (traitKey, traitInfo) => {
    console.log('Trait pressed:', traitKey, traitInfo);
    // You could track analytics, show additional UI, etc.
  };

  return (
    <ScrollView className="flex-1 bg-gray-50 p-4">
      {/* Header */}
      <View className="mb-6">
        <Text className="text-2xl font-bold text-gray-800 mb-2">
          TraitDisplay Component Examples
        </Text>
        <Text className="text-gray-600">
          Explore different configurations and use cases for the TraitDisplay
          component
        </Text>
      </View>

      {/* Example Selector */}
      <View className="mb-6">
        <Text className="text-lg font-semibold text-gray-800 mb-3">
          Select Example:
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {Object.entries(examples).map(([key, example]) => (
            <TouchableOpacity
              key={key}
              className={`mr-3 px-4 py-2 rounded-lg ${
                selectedExample === key
                  ? 'bg-blue-500'
                  : 'bg-white border border-gray-300'
              }`}
              onPress={() => setSelectedExample(key)}
            >
              <Text
                className={`font-medium ${
                  selectedExample === key ? 'text-white' : 'text-gray-700'
                }`}
              >
                {example.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Current Example Info */}
      <View className="bg-blue-50 rounded-lg p-4 mb-6">
        <Text className="text-lg font-semibold text-blue-800 mb-2">
          {currentExample.title}
        </Text>
        <Text className="text-blue-700">{currentExample.description}</Text>

        {/* Trait Summary */}
        <View className="mt-3 flex-row flex-wrap">
          <View className="mr-4 mb-2">
            <Text className="text-sm text-blue-600">
              Positive: {currentExample.traits.positive.length}
            </Text>
          </View>
          <View className="mr-4 mb-2">
            <Text className="text-sm text-blue-600">
              Negative: {currentExample.traits.negative.length}
            </Text>
          </View>
          <View className="mr-4 mb-2">
            <Text className="text-sm text-blue-600">
              Hidden: {currentExample.traits.hidden.length}
            </Text>
          </View>
        </View>
      </View>

      {/* TraitDisplay Component */}
      <TraitDisplay
        traits={currentExample.traits}
        horseName={currentExample.horseName}
        onTraitPress={handleTraitPress}
      />

      {/* Usage Code Example */}
      <View className="mt-8 bg-gray-800 rounded-lg p-4">
        <Text className="text-white font-semibold mb-3">Usage Code:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Text className="text-green-400 font-mono text-sm">
            {`<TraitDisplay
  traits={{
    positive: [${currentExample.traits.positive.map((t) => `'${t}'`).join(', ')}],
    negative: [${currentExample.traits.negative.map((t) => `'${t}'`).join(', ')}],
    hidden: [${currentExample.traits.hidden.map((t) => `'${t}'`).join(', ')}]
  }}
  horseName="${currentExample.horseName}"
  onTraitPress={(traitKey, traitInfo) => {
    console.log('Trait pressed:', traitKey, traitInfo);
  }}
/>`}
          </Text>
        </ScrollView>
      </View>

      {/* Implementation Notes */}
      <View className="mt-6 bg-yellow-50 rounded-lg p-4">
        <Text className="text-lg font-semibold text-yellow-800 mb-3">
          Implementation Notes:
        </Text>

        <View className="space-y-2">
          <Text className="text-yellow-700">
            • <Text className="font-medium">Positive traits</Text> are displayed
            with green badges
          </Text>
          <Text className="text-yellow-700">
            • <Text className="font-medium">Negative traits</Text> are displayed
            with red badges
          </Text>
          <Text className="text-yellow-700">
            • <Text className="font-medium">Hidden traits</Text> show as "???"
            placeholders
          </Text>
          <Text className="text-yellow-700">
            • <Text className="font-medium">Tap any trait</Text> to view
            detailed description in modal
          </Text>
          <Text className="text-yellow-700">
            • <Text className="font-medium">Accessibility</Text> features
            include proper labels and hints
          </Text>
          <Text className="text-yellow-700">
            • <Text className="font-medium">Unknown traits</Text> are handled
            gracefully with auto-generated names
          </Text>
        </View>
      </View>

      {/* Integration Tips */}
      <View className="mt-6 bg-green-50 rounded-lg p-4 mb-8">
        <Text className="text-lg font-semibold text-green-800 mb-3">
          Integration Tips:
        </Text>

        <View className="space-y-2">
          <Text className="text-green-700">
            • Use the{' '}
            <Text className="font-mono bg-green-100 px-1">onTraitPress</Text>{' '}
            callback for analytics or additional UI
          </Text>
          <Text className="text-green-700">
            • The component handles empty/missing trait arrays gracefully
          </Text>
          <Text className="text-green-700">
            • Trait definitions can be extended by modifying the internal
            dictionary
          </Text>
          <Text className="text-green-700">
            • The component is fully responsive and works on all screen sizes
          </Text>
          <Text className="text-green-700">
            • Hidden traits create anticipation and encourage player engagement
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

export default TraitDisplayExample;
