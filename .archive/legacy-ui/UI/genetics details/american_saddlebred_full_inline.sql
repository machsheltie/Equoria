-- Insert American Saddlebred
INSERT INTO breeds (name, default_trait, breed_genetic_profile) VALUES
('American Saddlebred', 'Gaited', $json${"allowed_alleles":{},"disallowed_combinations":{},"allele_weights":{},"shade_bias":{},"boolean_modifiers_prevalence":{},"advanced_markings_bias":{},"marking_bias":{"face":{"none":0.2,"star":0.2,"strip":0.2,"blaze":0.2,"snip":0.2},"legs_general_probability":0.5,"leg_specific_probabilities":{"coronet":0.25,"pastern":0.25,"sock":0.25,"stocking":0.25},"max_legs_marked":4},"temperament_weights":{"Spirited":30,"Nervous":2,"Calm":10,"Bold":20,"Steady":10,"Independent":5,"Reactive":3,"Stubborn":3,"Playful":15,"Lazy":1,"Aggressive":1}}$json$::JSONB)
ON CONFLICT (name) DO UPDATE SET
  default_trait = EXCLUDED.default_trait,
  breed_genetic_profile = EXCLUDED.breed_genetic_profile,
  updated_at = NOW();