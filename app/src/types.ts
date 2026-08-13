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
