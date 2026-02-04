-- Seed data for the Equoria application

-- Seed Breeds Table
-- Note: Ensure the schema.sql has been run first to create the tables.

-- Delete existing data from breeds to avoid conflicts if re-running (optional, good for development)
-- Consider if you want to run this in production or handle updates differently.
-- DELETE FROM horses; -- If you had horses that depend on breeds and want a clean slate
-- DELETE FROM breeds;

-- Helper JSON object for a generic/starter breed genetic profile
-- This can be used as a base for new breeds and customized later.
DO $$
DECLARE
  generic_profile JSONB;
BEGIN
  generic_profile := '{
    "allowed_alleles": {
        "E_Extension": ["e/e", "E/e", "E/E"],
        "A_Agouti": ["a/a", "A/a", "A/A"],
        "Cr_Cream": ["n/n", "n/Cr", "Cr/Cr"],
        "D_Dun": ["d/d", "D/d", "D/D"],
        "Z_Silver": ["n/n", "Z/n", "Z/Z"],
        "Ch_Champagne": ["n/n", "Ch/n", "Ch/Ch"],
        "G_Gray": ["g/g", "G/g", "G/G"],
        "Rn_Roan": ["rn/rn", "Rn/rn", "Rn/Rn"],
        "W_DominantWhite": ["W5/W5", "W10/W10", "W13/W13", "W15/W15", "W19/W19", "W20/W20", "W22/W22"],
        "TO_Tobiano": ["to/to", "TO/to", "TO/TO"],
        "O_FrameOvero": ["n/n", "O/n"],
        "SB1_Sabino1": ["n/n", "SB1/n"],
        "SW1_SplashWhite1": ["n/n", "SW1/n"],
        "SW2_SplashWhite2": ["n/n", "SW2/n"],
        "SW3_SplashWhite3": ["n/n", "SW3/n"],
        "LP_LeopardComplex": ["lp/lp", "LP/lp", "LP/LP"],
        "PATN1_Pattern1": ["patn1/patn1", "PATN1/patn1", "PATN1/PATN1"]
    },
    "disallowed_combinations": {
        "O_FrameOvero": ["O/O"],
        "W_DominantWhite": ["W5/W5", "W10/W10", "W13/W13", "W15/W15", "W19/W19", "W20/W20", "W22/W22"]
        -- Add other lethal or disallowed combinations here, e.g., Rn/Rn if it were lethal
    },
    "allele_weights": {
        "E_Extension": {"e/e": 0.3, "E/e": 0.4, "E/E": 0.3},
        "A_Agouti": {"a/a": 0.3, "A/a": 0.4, "A/A": 0.3},
        "Cr_Cream": {"n/n": 0.8, "n/Cr": 0.15, "Cr/Cr": 0.05},
        "D_Dun": {"d/d": 0.7, "D/d": 0.25, "D/D": 0.05},
        "Z_Silver": {"n/n": 0.8, "Z/n": 0.15, "Z/Z": 0.05},
        "Ch_Champagne": {"n/n": 0.9, "Ch/n": 0.08, "Ch/Ch": 0.02},
        "G_Gray": {"g/g": 0.85, "G/g": 0.1, "G/G": 0.05},
        "Rn_Roan": {"rn/rn": 0.9, "Rn/rn": 0.09, "Rn/Rn": 0.01 },
        "W_DominantWhite": {
            "w/w": 0.90, "W20/w": 0.02, "W1/w": 0.002, "W2/w": 0.002, "W3/w": 0.002, "W4/w": 0.002, "W5/w": 0.002, "W6/w": 0.002, "W7/w": 0.002, "W8/w": 0.002, "W9/w": 0.002, "W10/w": 0.002, "W11/w": 0.002, "W12/w": 0.002, "W13/w": 0.002, "W14/w": 0.002, "W15/w": 0.002, "W16/w": 0.002, "W17/w": 0.002, "W18/w": 0.002, "W19/w": 0.002, "W21/w": 0.002, "W22/w": 0.002, "W23/w": 0.002, "W24/w": 0.002, "W25/w": 0.002, "W26/w": 0.002, "W27/w": 0.002, "W28/w": 0.002, "W30/w": 0.002, "W31/w": 0.002, "W32/w": 0.002, "W33/w": 0.002, "W34/w": 0.002, "W35/w": 0.002
        },
        "TO_Tobiano": {"to/to": 0.7, "TO/to": 0.25, "TO/TO": 0.05},
        "O_FrameOvero": {"n/n": 0.95, "O/n": 0.05},
        "SB1_Sabino1": { "n/n": 0.9, "SB1/n": 0.1 },
        "SW1_SplashWhite1": { "n/n": 0.95, "SW1/n": 0.05 },
        "SW2_SplashWhite2": { "n/n": 0.98, "SW2/n": 0.02 },
        "SW3_SplashWhite3": { "n/n": 0.98, "SW3/n": 0.02 },
        "LP_LeopardComplex": {"lp/lp": 0.8, "LP/lp": 0.15, "LP/LP": 0.05},
        "PATN1_Pattern1": {"patn1/patn1": 0.8, "PATN1/patn1": 0.15, "PATN1/PATN1": 0.05}
    },
    "marking_bias": {
        "face": {"none": 0.2, "star": 0.2, "strip": 0.2, "blaze": 0.2, "snip": 0.2},
        "legs_general_probability": 0.5,
        "leg_specific_probabilities": {
            "coronet": 0.25, "pastern": 0.25, "sock": 0.25, "stocking": 0.25
        },
        "max_legs_marked": 4
    },
    "boolean_modifiers_prevalence": {
        "sooty": 0.3,
        "flaxen": 0.1,
        "pangare": 0.1,
        "rabicano": 0.05
    },
    "shade_bias": {
      "Chestnut": { "light": 0.3, "medium": 0.4, "dark": 0.3 },
      "Bay": { "light": 0.3, "standard": 0.4, "dark": 0.3 },
      "Black": { "standard": 0.5, "faded": 0.5 },
      "Palomino": { "pale": 0.3, "golden": 0.4, "copper": 0.3 },
      "Buckskin": { "cream": 0.3, "golden": 0.4, "burnished": 0.3 },
      "Smoky Black": { "faded": 0.5, "rich chocolate": 0.5 },
      "Grulla": { "silver gray": 0.3, "standard": 0.4, "burnished": 0.3 },
      "Red Dun": { "strawberry": 0.4, "medium": 0.3, "dark red": 0.3 },
      "Bay Dun": { "light": 0.3, "standard": 0.4, "dark": 0.3 },
      "Cremello": { "ice": 0.5, "peachy": 0.5 },
      "Perlino": { "cream": 0.5, "peachy": 0.5 },
      "Smoky Cream": { "light cream": 0.5, "dark cream": 0.5 },
      "Gold Champagne": { "pale": 0.3, "golden": 0.4, "dark": 0.3 },
      "Amber Champagne": { "light": 0.3, "medium": 0.4, "deep": 0.3 },
      "Classic Champagne": { "faded": 0.3, "standard": 0.4, "rich": 0.3 },
      "Gold Cream Champagne": { "pale": 0.3, "golden": 0.4, "burnished": 0.3 },
      "Amber Cream Champagne": { "light": 0.3, "rich": 0.4, "deep": 0.3 },
      "Classic Cream Champagne": { "light": 0.3, "silver": 0.4, "charcoal": 0.3 },
      "Gold Dun Champagne": { "light": 0.3, "golden": 0.4, "red": 0.3 },
      "Amber Dun Champagne": { "light": 0.3, "tan": 0.4, "burnished": 0.3 },
      "Classic Dun Champagne": { "cool gray": 0.3, "iron": 0.4, "smoky": 0.3 },
      "Gold Cream Dun Champagne": { "pale": 0.3, "golden": 0.4, "burnished": 0.3 },
      "Amber Cream Dun Champagne": { "light": 0.3, "rich": 0.4, "dark": 0.3 },
      "Classic Cream Dun Champagne": { "light gray": 0.3, "slate": 0.4, "charcoal": 0.3 },
      "Silver Classic Champagne": { "light": 0.3, "silvery": 0.4, "dark": 0.3 },
      "Silver Amber Dun Champagne": { "silver": 0.3, "tan": 0.4, "smoky": 0.3 },
      "Silver Grulla": { "icy": 0.3, "gunmetal": 0.4, "shadow": 0.3 },
      "Silver Buckskin": { "frosted": 0.3, "golden": 0.4, "burnished": 0.3 },
      "Silver Bay": { "light": 0.3, "brushed bronze": 0.4, "burnished": 0.3 },
      "Silver Black": { "steel": 0.5, "rich black": 0.5 },
      "Silver Amber Cream Dun Champagne": { "frosted gold": 0.3, "silver tan": 0.4, "shadowed bronze": 0.3 },
      "Gray": { "light gray": 0.3, "dappled gray": 0.4, "steel gray": 0.3 },
      "Dominant White": { "white": 1.0 }
    }
  }';

  -- Insert Thoroughbred (keeping its specific profile)
  INSERT INTO breeds (name, default_trait, breed_genetic_profile) VALUES
  ('Thoroughbred', 'Racing', '{
      "allowed_alleles": {
          "E_Extension": ["e/e", "E/e", "E/E"],
          "A_Agouti": ["a/a", "A/a", "A/A"],
          "Cr_Cream": ["n/n", "n/Cr"],
          "D_Dun": ["d/d"],
          "Z_Silver": ["n/n"],
          "Ch_Champagne": ["n/n"],
          "G_Gray": ["g/g", "G/g"],
          "Rn_Roan": ["rn/rn"],
          "W_DominantWhite": ["W5/W5", "W10/W10", "W13/W13", "W15/W15", "W19/W19", "W20/W20", "W22/W22"],
          "TO_Tobiano": ["to/to"],
          "O_FrameOvero": ["n/n", "O/n"],
          "SB1_Sabino1": ["n/n", "SB1/n"],
          "SW1_SplashWhite1": ["n/n", "SW1/n"],
          "SW2_SplashWhite2": ["n/n"],
          "SW3_SplashWhite3": ["n/n"],
          "LP_LeopardComplex": ["lp/lp"],
          "PATN1_Pattern1": ["patn1/patn1"]
      },
      "disallowed_combinations": {
          "O_FrameOvero": ["O/O"],
          "W_DominantWhite": ["W5/W5", "W10/W10", "W13/W13", "W15/W15", "W19/W19", "W20/W20", "W22/W22"]
      },
      "allele_weights": {
          "E_Extension": {"e/e": 0.25, "E/e": 0.5, "E/E": 0.25},
          "A_Agouti": {"a/a": 0.2, "A/a": 0.5, "A/A": 0.3},
          "Cr_Cream": {"n/n": 0.995, "n/Cr": 0.004, "Cr/Cr": 0.001},
          "D_Dun": {"d/d": 1.0},
          "Z_Silver": {"n/n": 1.0},
          "Ch_Champagne": {"n/n": 1.0},
          "G_Gray": {"g/g": 0.9, "G/g": 0.09, "G/G": 0.01},
          "Rn_Roan": {"rn/rn": 1.0},
          "W_DominantWhite": {
            "w/w": 0.90, "W20/w": 0.02, "W1/w": 0.002, "W2/w": 0.002, "W3/w": 0.002, "W4/w": 0.002, "W5/w": 0.002, "W6/w": 0.002, "W7/w": 0.002, "W8/w": 0.002, "W9/w": 0.002, "W10/w": 0.002, "W11/w": 0.002, "W12/w": 0.002, "W13/w": 0.002, "W14/w": 0.002, "W15/w": 0.002, "W16/w": 0.002, "W17/w": 0.002, "W18/w": 0.002, "W19/w": 0.002, "W21/w": 0.002, "W22/w": 0.002, "W23/w": 0.002, "W24/w": 0.002, "W25/w": 0.002, "W26/w": 0.002, "W27/w": 0.002, "W28/w": 0.002, "W30/w": 0.002, "W31/w": 0.002, "W32/w": 0.002, "W33/w": 0.002, "W34/w": 0.002, "W35/w": 0.002
        }, -- Corrected N/N to w/w and W20/N to W20/w
          "TO_Tobiano": {"to/to": 1.0},
          "O_FrameOvero": {"n/n": 0.99, "O/n": 0.01}, -- Give a small chance for Frame for Thoroughbreds
          "SB1_Sabino1": { "n/n": 0.99, "SB1/n": 0.01 },
          "SW1_SplashWhite1": { "n/n": 0.995, "SW1/n": 0.005 },
          "SW2_SplashWhite2": {"n/n": 1.0},
          "SW3_SplashWhite3": {"n/n": 1.0},
          "LP_LeopardComplex": {"lp/lp": 1.0},
          "PATN1_Pattern1": {"patn1/patn1": 1.0}
      },
      "marking_bias": {
          "face": {"none": 0.3, "star": 0.3, "strip": 0.2, "blaze": 0.1, "snip": 0.1},
          "legs_general_probability": 0.4,
          "leg_specific_probabilities": {
              "coronet": 0.4, "pastern": 0.3, "sock": 0.2, "stocking": 0.1
          },
          "max_legs_marked": 4
      },
      "boolean_modifiers_prevalence": {
          "sooty": 0.25,
          "flaxen": 0.05,
          "pangare": 0.02,
          "rabicano": 0.02
      },
      "shade_bias": {
        "Chestnut": { "light": 0.2, "medium": 0.5, "dark": 0.3 },
        "Bay": { "light": 0.3, "standard": 0.5, "dark": 0.2 },
        "Black": { "standard": 1.0 },
        "Palomino": { "pale": 0.4, "golden": 0.4, "copper": 0.2 },
        "Buckskin": { "cream": 0.3, "golden": 0.5, "burnished": 0.2 },
        "Smoky Black": { "faded": 0.6, "rich chocolate": 0.4 },
        "Grulla": { "silver gray": 0.3, "standard": 0.5, "burnished": 0.2 },
        "Red Dun": { "strawberry": 0.5, "dark red": 0.5 },
        "Bay Dun": { "light": 0.3, "standard": 0.5, "dark": 0.2 },
        "Cremello": { "ice": 0.5, "peachy": 0.5 },
        "Perlino": { "cream": 0.5, "peachy": 0.5 },
        "Smoky Cream": { "light cream": 0.5, "dark cream": 0.5 },
        "Gold Champagne": { "pale": 0.5, "golden": 0.4, "dark": 0.1 },
        "Amber Champagne": { "light": 0.4, "medium": 0.4, "deep": 0.2 },
        "Classic Champagne": { "faded": 0.3, "standard": 0.5, "rich": 0.2 },
        "Gold Cream Champagne": { "pale": 0.4, "golden": 0.5, "burnished": 0.1 },
        "Amber Cream Champagne": { "light": 0.4, "rich": 0.4, "deep": 0.2 },
        "Classic Cream Champagne": { "light": 0.3, "silver": 0.4, "charcoal": 0.3 },
        "Gold Dun Champagne": { "light": 0.5, "golden": 0.3, "red": 0.2 },
        "Amber Dun Champagne": { "light": 0.3, "tan": 0.4, "burnished": 0.3 },
        "Classic Dun Champagne": { "cool gray": 0.4, "iron": 0.4, "smoky": 0.2 },
        "Gold Cream Dun Champagne": { "pale": 0.3, "golden": 0.4, "burnished": 0.3 },
        "Amber Cream Dun Champagne": { "light": 0.3, "rich": 0.5, "dark": 0.2 },
        "Classic Cream Dun Champagne": { "light gray": 0.3, "slate": 0.4, "charcoal": 0.3 },
        "Silver Classic Champagne": { "light": 0.3, "silvery": 0.5, "dark": 0.2 },
        "Silver Amber Dun Champagne": { "silver": 0.4, "tan": 0.4, "smoky": 0.2 },
        "Silver Grulla": { "icy": 0.3, "gunmetal": 0.5, "shadow": 0.2 },
        "Silver Buckskin": { "frosted": 0.3, "golden": 0.4, "burnished": 0.3 },
        "Silver Bay": { "light": 0.3, "brushed bronze": 0.4, "burnished": 0.3 },
        "Silver Black": { "steel": 0.5, "rich black": 0.5 },
        "Silver Amber Cream Dun Champagne": { "frosted gold": 0.4, "silver tan": 0.4, "shadowed bronze": 0.2 },
        "Gray": { "light gray": 0.3, "dappled gray": 0.4, "steel gray": 0.3 },
        "Dominant White": { "white": 1.0 }
      }
  }'::JSONB)
  ON CONFLICT (name) DO UPDATE SET
      default_trait = EXCLUDED.default_trait,
      breed_genetic_profile = EXCLUDED.breed_genetic_profile,
      updated_at = NOW(); -- Use NOW() for timestamptz

  -- Insert Arabian using a modified generic profile
  INSERT INTO breeds (name, default_trait, breed_genetic_profile) VALUES
  ('Arabian', 'Endurance', '{
      "allowed_alleles": {
    "E_Extension": ["e/e", "E/e", "E/E"],
    "A_Agouti": ["a/a", "A/a", "A/A"],
    "Cr_Cream": ["n/n"],
    "D_Dun": ["d/d"],
    "Z_Silver": ["n/n"],
    "Ch_Champagne": ["n/n"],
    "G_Gray": ["g/g", "G/g", "G/G"],
    "Rn_Roan": ["rn/rn"],

    "W_DominantWhite": ["W5/W5", "W10/W10", "W13/W13", "W15/W15", "W19/W19", "W20/W20", "W22/W22"],
    "SB1_Sabino1": ["n/n"],          
    "TO_Tobiano": ["to/to"],        
    "O_FrameOvero": ["n/n"],         
    "SW1_SplashWhite1": ["n/n"],     
    "SW2_SplashWhite2": ["n/n"],
    "SW3_SplashWhite3": ["n/n"],
    "LP_LeopardComplex": ["lp/lp"],  
    "PATN1_Pattern1": ["patn1/patn1"]
  },
      "disallowed_combinations": {
          "O_FrameOvero": ["O/O"],
          "W_DominantWhite": ["W5/W5", "W10/W10", "W13/W13", "W15/W15", "W19/W19", "W20/W20", "W22/W22"]
      },
      "allele_weights": {
  "E_Extension": { "e/e": 0.3, "E/e": 0.5, "E/E": 0.2 },
  "A_Agouti": { "a/a": 0.1, "A/a": 0.4, "A/A": 0.5 },
  "G_Gray": { "g/g": 0.5, "G/g": 0.4, "G/G": 0.1 },
  "W_DominantWhite": {
            "w/w": 0.90, "W20/w": 0.02, "W1/w": 0.002, "W2/w": 0.002, "W3/w": 0.002, "W4/w": 0.002, "W5/w": 0.002, "W6/w": 0.002, "W7/w": 0.002, "W8/w": 0.002, "W9/w": 0.002, "W10/w": 0.002, "W11/w": 0.002, "W12/w": 0.002, "W13/w": 0.002, "W14/w": 0.002, "W15/w": 0.002, "W16/w": 0.002, "W17/w": 0.002, "W18/w": 0.002, "W19/w": 0.002, "W21/w": 0.002, "W22/w": 0.002, "W23/w": 0.002, "W24/w": 0.002, "W25/w": 0.002, "W26/w": 0.002, "W27/w": 0.002, "W28/w": 0.002, "W30/w": 0.002, "W31/w": 0.002, "W32/w": 0.002, "W33/w": 0.002, "W34/w": 0.002, "W35/w": 0.002
        },
  "SB1_Sabino1": { "n/n": 1.0 },
  "Cr_Cream": { "n/n": 1.0 },
  "D_Dun": { "d/d": 1.0 },
  "Z_Silver": { "n/n": 1.0 },
  "Ch_Champagne": { "n/n": 1.0 },
  "LP_LeopardComplex": { "lp/lp": 1.0 },
  "PATN1_Pattern1": { "patn1/patn1": 1.0 },
  "O_FrameOvero": { "n/n": 1.0 },
  "SW1_SplashWhite1": { "n/n": 1.0 },
  "SW2_SplashWhite2": { "n/n": 1.0 },
  "SW3_SplashWhite3": { "n/n": 1.0 },
    },
      "marking_bias": {
          "face": {"none": 0.3, "star": 0.3, "strip": 0.2, "blaze": 0.1, "snip": 0.1},
          "legs_general_probability": 0.4,
          "leg_specific_probabilities": {
              "coronet": 0.4, "pastern": 0.3, "sock": 0.2, "stocking": 0.1
          },
          "max_legs_marked": 4
      },
       "boolean_modifiers_prevalence": {
    "sooty": 0.2,
  "flaxen": 0.05,
  "pangare": 0.01,
  "rabicano": 0.05
  },
      "shade_bias": {
        "Chestnut": { "light": 0.2, "medium": 0.5, "dark": 0.3 },
        "Bay": { "light": 0.3, "standard": 0.5, "dark": 0.2 },
        "Black": { "standard": 1.0 },
        "Palomino": { "pale": 0.4, "golden": 0.4, "copper": 0.2 },
        "Buckskin": { "cream": 0.3, "golden": 0.5, "burnished": 0.2 },
        "Smoky Black": { "faded": 0.6, "rich chocolate": 0.4 },
        "Grulla": { "silver gray": 0.3, "standard": 0.5, "burnished": 0.2 },
        "Red Dun": { "strawberry": 0.5, "dark red": 0.5 },
        "Bay Dun": { "light": 0.3, "standard": 0.5, "dark": 0.2 },
        "Cremello": { "ice": 0.5, "peachy": 0.5 },
        "Perlino": { "cream": 0.5, "peachy": 0.5 },
        "Smoky Cream": { "light cream": 0.5, "dark cream": 0.5 },
        "Gold Champagne": { "pale": 0.5, "golden": 0.4, "dark": 0.1 },
        "Amber Champagne": { "light": 0.4, "medium": 0.4, "deep": 0.2 },
        "Classic Champagne": { "faded": 0.3, "standard": 0.5, "rich": 0.2 },
        "Gold Cream Champagne": { "pale": 0.4, "golden": 0.5, "burnished": 0.1 },
        "Amber Cream Champagne": { "light": 0.4, "rich": 0.4, "deep": 0.2 },
        "Classic Cream Champagne": { "light": 0.3, "silver": 0.4, "charcoal": 0.3 },
        "Gold Dun Champagne": { "light": 0.5, "golden": 0.3, "red": 0.2 },
        "Amber Dun Champagne": { "light": 0.3, "tan": 0.4, "burnished": 0.3 },
        "Classic Dun Champagne": { "cool gray": 0.4, "iron": 0.4, "smoky": 0.2 },
        "Gold Cream Dun Champagne": { "pale": 0.3, "golden": 0.4, "burnished": 0.3 },
        "Amber Cream Dun Champagne": { "light": 0.3, "rich": 0.5, "dark": 0.2 },
        "Classic Cream Dun Champagne": { "light gray": 0.3, "slate": 0.4, "charcoal": 0.3 },
        "Silver Classic Champagne": { "light": 0.3, "silvery": 0.5, "dark": 0.2 },
        "Silver Amber Dun Champagne": { "silver": 0.4, "tan": 0.4, "smoky": 0.2 },
        "Silver Grulla": { "icy": 0.3, "gunmetal": 0.5, "shadow": 0.2 },
        "Silver Buckskin": { "frosted": 0.3, "golden": 0.4, "burnished": 0.3 },
        "Silver Bay": { "light": 0.3, "brushed bronze": 0.4, "burnished": 0.3 },
        "Silver Black": { "steel": 0.5, "rich black": 0.5 },
        "Silver Amber Cream Dun Champagne": { "frosted gold": 0.4, "silver tan": 0.4, "shadowed bronze": 0.2 },
        "Gray": { "light gray": 0.3, "dappled gray": 0.4, "steel gray": 0.3 },
        "Dominant White": { "white": 1.0 }
      }
  }'::JSONB)
  ON CONFLICT (name) DO UPDATE SET
      default_trait = EXCLUDED.default_trait,
      breed_genetic_profile = EXCLUDED.breed_genetic_profile,
      updated_at = NOW();

-- Insert American Saddlebred
INSERT INTO breeds (name, default_trait, breed_genetic_profile) VALUES
('American Saddlebred', 'Gaited', '{
  "allowed_alleles": {
    "E_Extension": ["e/e", "E/e", "E/E"],
    "A_Agouti": ["a/a", "A/a", "A/A"],
    "Cr_Cream": ["n/n", "n/Cr", "Cr/Cr"],
    "D_Dun": ["d/d"],
    "Z_Silver": ["n/n", "Z/n"],
    "Ch_Champagne": ["n/n", "Ch/n"],
    "G_Gray": ["g/g", "G/g", "G/G"],
    "Rn_Roan": ["rn/rn"],
    "W_DominantWhite": ["W5/W5", "W10/W10", "W13/W13", "W15/W15", "W19/W19", "W20/W20", "W22/W22"],
    "TO_Tobiano": ["to/to", "TO/to"],
    "O_FrameOvero": ["n/n", "O/n"],
    "SB1_Sabino1": ["n/n", "SB1/n"],
    "SW1_SplashWhite1": ["n/n", "SW1/n"],
    "SW2_SplashWhite2": ["n/n", "SW2/n"],
    "SW3_SplashWhite3": ["n/n", "SW3/n"],
    "LP_LeopardComplex": ["lp/lp"],
    "PATN1_Pattern1": ["patn1/patn1"]
  },
  "disallowed_combinations": {
    "O_FrameOvero": ["O/O"],
    "W_DominantWhite": ["W5/W5", "W10/W10", "W13/W13", "W15/W15", "W19/W19", "W20/W20", "W22/W22"]
  },
  "allele_weights": {
    "E_Extension": {"e/e": 0.3, "E/e": 0.4, "E/E": 0.3},
    "A_Agouti": {"a/a": 0.3, "A/a": 0.4, "A/A": 0.3},
    "Cr_Cream": {"n/n": 0.85, "n/Cr": 0.1, "Cr/Cr": 0.05},
    "D_Dun": {"d/d": 1.0},
    "Z_Silver": {"n/n": 0.95, "Z/n": 0.05},
    "Ch_Champagne": {"n/n": 0.97, "Ch/n": 0.03},
    "G_Gray": {"g/g": 0.85, "G/g": 0.1, "G/G": 0.05},
    "Rn_Roan": {"rn/rn": 1.0},
    "W_DominantWhite": {
            "w/w": 0.90, "W20/w": 0.02, "W1/w": 0.002, "W2/w": 0.002, "W3/w": 0.002, "W4/w": 0.002, "W5/w": 0.002, "W6/w": 0.002, "W7/w": 0.002, "W8/w": 0.002, "W9/w": 0.002, "W10/w": 0.002, "W11/w": 0.002, "W12/w": 0.002, "W13/w": 0.002, "W14/w": 0.002, "W15/w": 0.002, "W16/w": 0.002, "W17/w": 0.002, "W18/w": 0.002, "W19/w": 0.002, "W21/w": 0.002, "W22/w": 0.002, "W23/w": 0.002, "W24/w": 0.002, "W25/w": 0.002, "W26/w": 0.002, "W27/w": 0.002, "W28/w": 0.002, "W30/w": 0.002, "W31/w": 0.002, "W32/w": 0.002, "W33/w": 0.002, "W34/w": 0.002, "W35/w": 0.002
        },
    "TO_Tobiano": {"to/to": 0.9, "TO/to": 0.1},
    "O_FrameOvero": {"n/n": 0.98, "O/n": 0.02},
    "SB1_Sabino1": {"n/n": 0.9, "SB1/n": 0.1},
    "SW1_SplashWhite1": {"n/n": 0.95, "SW1/n": 0.05},
    "SW2_SplashWhite2": {"n/n": 0.98, "SW2/n": 0.02},
    "SW3_SplashWhite3": {"n/n": 0.98, "SW3/n": 0.02},
    "LP_LeopardComplex": {"lp/lp": 1.0},
    "PATN1_Pattern1": {"patn1/patn1": 1.0}
  },
  "marking_bias": {
    "face": {"none": 0.2, "star": 0.3, "strip": 0.2, "blaze": 0.2, "snip": 0.1},
    "legs_general_probability": 0.6,
    "leg_specific_probabilities": {
      "coronet": 0.25, "pastern": 0.25, "sock": 0.25, "stocking": 0.25
    },
    "max_legs_marked": 4
  },
  "boolean_modifiers_prevalence": {
    "sooty": 0.2,
    "flaxen": 0.1,
    "pangare": 0.01,
    "rabicano": 0.05
  },
  "shade_bias": {
    "Chestnut": { "light": 0.3, "medium": 0.4, "dark": 0.3 },
    "Bay": { "light": 0.3, "standard": 0.4, "dark": 0.3 },
    "Black": { "standard": 0.5, "faded": 0.5 },
    "Palomino": { "pale": 0.3, "golden": 0.4, "copper": 0.3 },
    "Buckskin": { "cream": 0.3, "golden": 0.4, "burnished": 0.3 },
    "Smoky Black": { "faded": 0.5, "rich chocolate": 0.5 },
    "Grulla": { "silver gray": 0.3, "standard": 0.4, "burnished": 0.3 },
    "Red Dun": { "strawberry": 0.4, "medium": 0.3, "dark red": 0.3 },
    "Bay Dun": { "light": 0.3, "standard": 0.4, "dark": 0.3 },
    "Cremello": { "ice": 0.5, "peachy": 0.5 },
    "Perlino": { "cream": 0.5, "peachy": 0.5 },
    "Smoky Cream": { "light cream": 0.5, "dark cream": 0.5 },
    "Gold Champagne": { "pale": 0.3, "golden": 0.4, "dark": 0.3 },
    "Amber Champagne": { "light": 0.3, "medium": 0.4, "deep": 0.3 },
    "Classic Champagne": { "faded": 0.3, "standard": 0.4, "rich": 0.3 },
    "Gold Cream Champagne": { "pale": 0.3, "golden": 0.4, "burnished": 0.3 },
    "Amber Cream Champagne": { "light": 0.3, "rich": 0.4, "deep": 0.3 },
    "Classic Cream Champagne": { "light": 0.3, "silver": 0.4, "charcoal": 0.3 },
    "Gold Dun Champagne": { "light": 0.3, "golden": 0.4, "red": 0.3 },
    "Amber Dun Champagne": { "light": 0.3, "tan": 0.4, "burnished": 0.3 },
    "Classic Dun Champagne": { "cool gray": 0.3, "iron": 0.4, "smoky": 0.3 },
    "Gold Cream Dun Champagne": { "pale": 0.3, "golden": 0.4, "burnished": 0.3 },
    "Amber Cream Dun Champagne": { "light": 0.3, "rich": 0.4, "dark": 0.3 },
    "Classic Cream Dun Champagne": { "light gray": 0.3, "slate": 0.4, "charcoal": 0.3 },
    "Silver Classic Champagne": { "light": 0.3, "silvery": 0.4, "dark": 0.3 },
    "Silver Amber Dun Champagne": { "silver": 0.3, "tan": 0.4, "smoky": 0.3 },
    "Silver Grulla": { "icy": 0.3, "gunmetal": 0.4, "shadow": 0.3 },
    "Silver Buckskin": { "frosted": 0.3, "golden": 0.4, "burnished": 0.3 },
    "Silver Bay": { "light": 0.3, "brushed bronze": 0.4, "burnished": 0.3 },
    "Silver Black": { "steel": 0.5, "rich black": 0.5 },
    "Silver Amber Cream Dun Champagne": { "frosted gold": 0.3, "silver tan": 0.4, "shadowed bronze": 0.3 },
    "Gray": { "light gray": 0.3, "dappled gray": 0.4, "steel gray": 0.3 },
    "Dominant White": { "white": 1.0 }
  }
}'::JSONB)
ON CONFLICT (name) DO UPDATE SET
  default_trait = EXCLUDED.default_trait,
  breed_genetic_profile = EXCLUDED.breed_genetic_profile,
  updated_at = NOW();


  -- Insert National Show Horse (placeholder, assuming it can inherit traits from parents)
  INSERT INTO breeds (name, default_trait, breed_genetic_profile) VALUES
  ('National Show Horse', 'Show Horse', generic_profile) -- Profile will be less critical if genetics come from parents
  ON CONFLICT (name) DO UPDATE SET
      default_trait = EXCLUDED.default_trait,
      breed_genetic_profile = EXCLUDED.breed_genetic_profile,
      updated_at = NOW();

END $$;

-- Seed Crossbreed Rules Table
-- Ensure the breeds exist before trying to reference their IDs.
-- The CHECK constraint (breed1_id < breed2_id) must be respected.

INSERT INTO crossbreed_rules (breed1_id, breed2_id, offspring_breed_id, notes)
SELECT
    b1.id AS breed1_id,
    b2.id AS breed2_id,
    b_offspring.id AS offspring_breed_id,
    'Arabian x American Saddlebred produces National Show Horse. Trait inheritance typically 50/50 or can be specified.'
FROM breeds b1, breeds b2, breeds b_offspring
WHERE 
    (b1.name = 'Arabian' AND b2.name = 'American Saddlebred' AND b_offspring.name = 'National Show Horse') OR
    (b1.name = 'American Saddlebred' AND b2.name = 'Arabian' AND b_offspring.name = 'National Show Horse')
ON CONFLICT (breed1_id, breed2_id) DO NOTHING;

-- To satisfy the CHECK (breed1_id < breed2_id) and UNIQUE constraint, 
-- we should insert only one version (e.g., Arabian as breed1_id if its ID is smaller)
-- The following is a more robust way to insert respecting the check constraint:
DELETE FROM crossbreed_rules WHERE offspring_breed_id = (SELECT id from breeds WHERE name = 'National Show Horse');

INSERT INTO crossbreed_rules (breed1_id, breed2_id, offspring_breed_id, notes)
SELECT
    LEAST((SELECT id FROM breeds WHERE name = 'Arabian'), (SELECT id FROM breeds WHERE name = 'American Saddlebred')) AS breed1_id,
    GREATEST((SELECT id FROM breeds WHERE name = 'Arabian'), (SELECT id FROM breeds WHERE name = 'American Saddlebred')) AS breed2_id,
    (SELECT id FROM breeds WHERE name = 'National Show Horse') AS offspring_breed_id,
    'Arabian x American Saddlebred produces National Show Horse. Trait inheritance typically 50/50 or can be specified.'
WHERE
    EXISTS (SELECT 1 FROM breeds WHERE name = 'Arabian') AND
    EXISTS (SELECT 1 FROM breeds WHERE name = 'American Saddlebred') AND
    EXISTS (SELECT 1 FROM breeds WHERE name = 'National Show Horse')
ON CONFLICT (breed1_id, breed2_id) DO NOTHING;

-- You can add more INSERT statements for other breeds here, following the same structure.

-- Example for seeding users (if needed, ensure passwords are appropriately hashed if you were to store them directly)
-- INSERT INTO users (username, email, password_hash, is_verified, breeder_level) VALUES 
-- ('TestUser', 'test@example.com', 'some_bcrypt_hash', TRUE, 1);

-- Example for seeding stables (if needed)
-- INSERT INTO stables (name, user_id, capacity) VALUES
-- ('My First Stable', (SELECT id FROM users WHERE username = 'TestUser'), 20); 