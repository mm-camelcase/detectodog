import { Platform } from "react-native";

import type { Prediction } from "./types";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export async function identifyDog(uri: string): Promise<Prediction> {
  if (!API_URL) throw new Error("DetectoDog API URL has not been configured.");

  const body = new FormData();
  if (Platform.OS === "web") {
    const blob = await fetch(uri).then(response => response.blob());
    body.append("image", blob, "dog.jpg");
  } else {
    body.append("image", {
      uri,
      name: "dog.jpg",
      type: "image/jpeg",
    } as unknown as Blob);
  }

  const response = await fetch(`${API_URL}/v1/predict`, { method: "POST", body });
  if (!response.ok) {
    const message = await response.json().catch(() => null);
    throw new Error(message?.detail ?? "We couldn't finish the match.");
  }
  return response.json() as Promise<Prediction>;
}
