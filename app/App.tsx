import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { identifyDog } from "./src/api";
import { theme } from "./src/theme";
import type { Prediction, SavedResult } from "./src/types";

type Screen = "home" | "preview" | "analysing" | "results" | "profile" | "history" | "error";
const HISTORY_KEY = "detectodog.history.v1";

function Action({ icon, label, onPress, compact = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; compact?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.action, compact && styles.actionCompact, pressed && styles.pressed]}>
      <Ionicons name={icon} color={theme.text} size={compact ? 21 : 28} />
      <Text style={[styles.actionText, compact && styles.actionTextCompact]}>{label}</Text>
    </Pressable>
  );
}

function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      {onBack ? <Pressable onPress={onBack} style={styles.iconButton}><Ionicons name="arrow-back" size={22} color={theme.text} /></Pressable> : <View style={styles.iconSpacer} />}
      <Text style={styles.headerTitle}>{title}</Text>
      {right ?? <View style={styles.iconSpacer} />}
    </View>
  );
}

function percent(value: number) { return `${Math.round(value * 100)}%`; }

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [imageUri, setImageUri] = useState<string>();
  const [prediction, setPrediction] = useState<Prediction>();
  const [history, setHistory] = useState<SavedResult[]>([]);
  const [error, setError] = useState("");
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then(value => value && setHistory(JSON.parse(value))).catch(() => undefined);
    if (Platform.OS === "web" && typeof document !== "undefined") {
      let manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (!manifest) {
        manifest = document.createElement("link");
        manifest.rel = "manifest";
        manifest.href = "/manifest.webmanifest";
        document.head.appendChild(manifest);
      }
      document.documentElement.style.backgroundColor = theme.bg;
      if ("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
    }
  }, []);

  async function choose(source: "camera" | "library") {
    if (selecting) return;
    setSelecting(true);
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Permission needed", "Allow camera access to take a dog photo.");
          return;
        }
      }

      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.65, allowsEditing: true, aspect: [1, 1] })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.65, allowsEditing: true, aspect: [1, 1] });

      if (result.canceled) return;
      const selected = result.assets[0];
      if (!selected) return;

      // Re-encode selected content URIs into a small local JPEG before upload.
      // If a device cannot manipulate a provider URI, retain the selected URI
      // so the user can still continue and receive a useful upload error.
      let preparedUri = selected.uri;
      try {
        const resized = await ImageManipulator.manipulateAsync(
          selected.uri,
          selected.width && selected.width > 1600 ? [{ resize: { width: 1600 } }] : [],
          { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG },
        );
        preparedUri = resized.uri;
      } catch {
        // Android's system picker can return provider-specific URIs that some
        // image codecs cannot re-encode. React Native can upload these directly.
      }

      setImageUri(preparedUri);
      setPrediction(undefined);
      setScreen("preview");
    } catch (reason) {
      Alert.alert(
        "Couldn’t open that photo",
        reason instanceof Error ? reason.message : "Please choose another image and try again.",
      );
    } finally {
      setSelecting(false);
    }
  }

  async function analyse() {
    if (!imageUri) return;
    setScreen("analysing");
    try {
      const result = await identifyDog(imageUri);
      setPrediction(result);
      setScreen("results");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong.");
      setScreen("error");
    }
  }

  async function saveResult() {
    if (!prediction || !imageUri) return;
    const next = [{ ...prediction, id: `${Date.now()}`, imageUri, createdAt: new Date().toISOString() }, ...history].slice(0, 20);
    setHistory(next);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    Alert.alert("Saved", "This identification is now in Previous results.");
  }

  function openSaved(item: SavedResult) {
    setImageUri(item.imageUri);
    setPrediction(item);
    setScreen("results");
  }

  const top = prediction?.matches[0];

  return (
    <LinearGradient colors={["#2E1257", theme.bg, "#11131F"]} style={styles.fill}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe}>
        {screen === "home" && (
          <ScrollView contentContainerStyle={styles.page}>
            <View style={styles.homeTop}>
              <View style={styles.brand}><Ionicons name="paw" size={24} color={theme.accent} /><Text style={styles.brandText}>DetectoDog</Text></View>
              <Pressable accessibilityLabel="Previous results" onPress={() => setScreen("history")} style={styles.iconButton}><Ionicons name="time-outline" size={23} color={theme.text} /></Pressable>
            </View>
            <View style={styles.hero}>
              <Ionicons name="paw" size={72} color={theme.accent} />
              <Text style={styles.badge}>120 BREEDS RECOGNISED</Text>
            </View>
            <Text style={styles.title}>What breed is that dog?</Text>
            <Text style={styles.subtitle}>Take a photo or choose one from your library to discover the most likely breed.</Text>
            <View style={styles.actionRow}>
              <Action icon="camera-outline" label="Take a photo" onPress={() => choose("camera")} />
              <Action icon="images-outline" label="Choose from library" onPress={() => choose("library")} />
            </View>
            <View style={styles.note}><Ionicons name="information-circle-outline" size={18} color={theme.accent} /><Text style={styles.noteText}>Results are visual estimates from a photo, not a genetic test.</Text></View>
          </ScrollView>
        )}

        {screen === "preview" && imageUri && (
          <ScrollView contentContainerStyle={styles.page}>
            <Header title="Your photo" onBack={() => setScreen("home")} />
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
            <View style={styles.note}><Ionicons name="bulb-outline" size={18} color={theme.accent} /><Text style={styles.noteText}>For the best result, use a clear photo showing the dog’s face and body.</Text></View>
            <View style={styles.actionRow}>
              <Action compact icon="camera-reverse-outline" label="Retake" onPress={() => choose("camera")} />
              <Action compact icon="swap-horizontal-outline" label="Replace" onPress={() => choose("library")} />
            </View>
            <Action icon="search-outline" label="Identify this dog" onPress={analyse} />
          </ScrollView>
        )}

        {screen === "analysing" && (
          <View style={[styles.page, styles.center]}>
            {imageUri && <Image source={{ uri: imageUri }} style={styles.analysisImage} />}
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={styles.title}>Sniffing out a match…</Text>
            <Text style={styles.subtitle}>Comparing this photo with 120 dog breeds.</Text>
          </View>
        )}

        {screen === "results" && prediction && top && (
          <ScrollView contentContainerStyle={styles.page}>
            <Header title="Your result" onBack={() => setScreen("preview")} right={<Pressable onPress={saveResult} style={styles.iconButton}><Ionicons name="bookmark-outline" size={22} color={theme.text} /></Pressable>} />
            <View style={styles.resultHero}>
              {imageUri && <Image source={{ uri: imageUri }} style={styles.resultImage} />}
              <View style={styles.resultCopy}>
                <Text style={styles.badge}>{prediction.prediction_quality === "good" ? "LIKELY MATCH" : "LOW CONFIDENCE"}</Text>
                <Text style={styles.resultBreed}>{top.breed}</Text>
                <Text style={styles.confidence}>{percent(top.confidence)} confidence</Text>
              </View>
            </View>
            <View style={styles.meter}><View style={[styles.meterFill, { width: `${Math.round(top.confidence * 100)}%` }]} /></View>
            {prediction.prediction_quality === "uncertain" && <Text style={styles.subtitle}>This dog may be a mixed breed, or the photo may not show enough detail.</Text>}
            <Text style={styles.sectionTitle}>Other possible matches</Text>
            {prediction.matches.slice(1).map(match => (
              <View key={match.breed_id} style={styles.match}><Text style={styles.matchName}>{match.breed}</Text><Text style={styles.matchScore}>{percent(match.confidence)}</Text></View>
            ))}
            <View style={styles.actionRow}>
              <Action icon="paw-outline" label="Explore this breed" onPress={() => setScreen("profile")} />
              <Action icon="camera-reverse-outline" label="Try another photo" onPress={() => setScreen("home")} />
            </View>
            <Pressable onPress={() => Share.share({ message: `DetectoDog thinks this is a ${top.breed} (${percent(top.confidence)} confidence).` })} style={styles.share}><Ionicons name="share-social-outline" size={19} color={theme.accent} /><Text style={styles.shareText}>Share this result</Text></Pressable>
            <Text style={styles.disclaimer}>{prediction.disclaimer}</Text>
          </ScrollView>
        )}

        {screen === "profile" && top && (
          <ScrollView contentContainerStyle={styles.page}>
            <Header title="Breed profile" onBack={() => setScreen("results")} />
            <View style={styles.profileIcon}><Ionicons name="paw" size={54} color={theme.accent} /></View>
            <Text style={styles.title}>{top.breed}</Text>
            <Text style={styles.subtitle}>Breed details are being prepared for the portfolio data set. Individual health, temperament and care needs always vary.</Text>
            <View style={styles.factGrid}>
              {["Origin", "Typical size", "Lifespan", "Energy", "Grooming", "Trainability"].map(label => <View key={label} style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>Coming soon</Text></View>)}
            </View>
            <Action icon="camera-outline" label="Identify another dog" onPress={() => setScreen("home")} />
          </ScrollView>
        )}

        {screen === "history" && (
          <ScrollView contentContainerStyle={styles.page}>
            <Header title="Previous results" onBack={() => setScreen("home")} />
            {history.length === 0 ? <View style={styles.center}><Ionicons name="paw-outline" size={62} color={theme.accent} /><Text style={styles.sectionTitle}>No saved dogs yet</Text><Text style={styles.subtitle}>Results you bookmark will appear here.</Text></View> : history.map(item => (
              <Pressable key={item.id} onPress={() => openSaved(item)} style={styles.historyItem}>
                <Image source={{ uri: item.imageUri }} style={styles.historyImage} />
                <View style={styles.grow}><Text style={styles.matchName}>{item.matches[0]?.breed}</Text><Text style={styles.noteText}>{item.matches[0] ? percent(item.matches[0].confidence) : ""} match</Text></View>
                <Ionicons name="chevron-forward" size={20} color={theme.muted} />
              </Pressable>
            ))}
          </ScrollView>
        )}

        {screen === "error" && (
          <View style={[styles.page, styles.center]}>
            <Ionicons name="warning-outline" size={68} color={theme.danger} />
            <Text style={styles.title}>We couldn’t finish the match</Text>
            <Text style={styles.subtitle}>{error}</Text>
            <Action icon="refresh-outline" label="Try again" onPress={analyse} />
            <Pressable onPress={() => setScreen("home")}><Text style={styles.shareText}>Back to home</Text></Pressable>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, safe: { flex: 1 }, grow: { flex: 1 },
  page: { width: "100%", maxWidth: 560, alignSelf: "center", padding: 22, paddingBottom: 48, gap: 18 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", textAlign: "center" },
  homeTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", gap: 9, alignItems: "center" }, brandText: { color: theme.text, fontSize: 21, fontWeight: "700" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 },
  headerTitle: { color: theme.text, fontSize: 17, fontWeight: "600" }, iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center", backgroundColor: theme.surfaceSoft }, iconSpacer: { width: 44 },
  hero: { minHeight: 230, borderRadius: 28, backgroundColor: "rgba(255,255,255,.08)", borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center", gap: 18 },
  badge: { color: theme.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: theme.text, fontSize: 34, lineHeight: 39, fontWeight: "700", letterSpacing: -0.8 },
  subtitle: { color: theme.muted, fontSize: 16, lineHeight: 24 },
  actionRow: { flexDirection: "row", gap: 12 },
  action: { flex: 1, minHeight: 118, padding: 16, borderRadius: 22, borderWidth: 1.5, borderColor: "rgba(246,241,255,.5)", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,.025)" },
  actionCompact: { minHeight: 72 }, actionText: { color: theme.text, fontSize: 18, fontWeight: "700" }, actionTextCompact: { fontSize: 14 }, pressed: { opacity: 0.65 },
  note: { flexDirection: "row", gap: 9, padding: 13, borderRadius: 14, backgroundColor: theme.surfaceSoft }, noteText: { color: theme.muted, fontSize: 13, lineHeight: 19 },
  previewImage: { width: "100%", aspectRatio: 1, borderRadius: 26, backgroundColor: theme.surface }, analysisImage: { width: 180, height: 180, borderRadius: 28, marginBottom: 12 },
  resultHero: { flexDirection: "row", gap: 16, alignItems: "center" }, resultImage: { width: 108, height: 108, borderRadius: 24 }, resultCopy: { flex: 1, gap: 7 },
  resultBreed: { color: theme.text, fontSize: 28, lineHeight: 31, fontWeight: "700" }, confidence: { color: theme.muted, fontSize: 15 },
  meter: { height: 8, backgroundColor: theme.surface, borderRadius: 4, overflow: "hidden" }, meterFill: { height: 8, backgroundColor: theme.accent, borderRadius: 4 },
  sectionTitle: { color: theme.text, fontSize: 20, fontWeight: "700", marginTop: 8 },
  match: { flexDirection: "row", justifyContent: "space-between", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceSoft }, matchName: { color: theme.text, fontSize: 16, fontWeight: "600" }, matchScore: { color: theme.accent, fontSize: 16, fontWeight: "700" },
  share: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, padding: 12 }, shareText: { color: theme.accent, fontSize: 15, fontWeight: "600" }, disclaimer: { color: theme.dim, fontSize: 12, lineHeight: 18, textAlign: "center" },
  profileIcon: { height: 180, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: theme.surfaceSoft, borderWidth: 1, borderColor: theme.border },
  factGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, fact: { width: "48%", minHeight: 90, padding: 14, borderRadius: 17, backgroundColor: theme.surfaceSoft, borderWidth: 1, borderColor: theme.border }, factLabel: { color: theme.accent, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 }, factValue: { color: theme.text, fontSize: 15, marginTop: 10 },
  historyItem: { flexDirection: "row", alignItems: "center", gap: 13, padding: 11, borderRadius: 18, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceSoft }, historyImage: { width: 62, height: 62, borderRadius: 14 },
});
