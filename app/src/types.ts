export type Match = {
  breed_id: string;
  breed: string;
  confidence: number;
};

export type Prediction = {
  model_version: string;
  prediction_quality: "good" | "uncertain";
  matches: Match[];
  disclaimer: string;
};

export type SavedResult = Prediction & {
  id: string;
  imageUri: string;
  createdAt: string;
};
