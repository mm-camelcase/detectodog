export type Match = {
  breed_id: string;
  breed: string;
  confidence: number;
};

export type Prediction = {
  model_version: string;
  breed_model_version?: string;
  detector_model_version?: string;
  dog_probability?: number;
  prediction_quality: "good" | "uncertain" | "not_dog";
  matches: Match[];
  disclaimer: string;
};

export type SavedResult = Prediction & {
  id: string;
  imageUri: string;
  createdAt: string;
};

export type BreedInfo = {
  dog_api_id: string;
  name: string;
  description?: string;
  life_years: { min?: number; max?: number };
  weight_kg: { min?: number; max?: number };
  height_cm: { min?: number; max?: number };
  origin: { country?: string; region?: string };
  coat: { type?: string; length?: string; colors: string[] };
  hypoallergenic?: boolean;
  traits: {
    energy?: number;
    grooming?: number;
    trainability?: number;
    exercise_minutes?: number;
    temperament: string[];
  };
  image_url?: string;
  provider: string;
  provider_url: string;
};
