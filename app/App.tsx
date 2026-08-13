import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  useFonts,
} from "@expo-google-fonts/playfair-display";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { identifyDog } from "./src/api";
import { theme } from "./src/theme";
import type { Prediction, SavedResult } from "./src/types";

type Screen = "home" | "preview" | "analysing" | "results" | "profile" | "history" | "notDog" | "error";
const HISTORY_KEY = "detectodog.history.v1";
const MIN_ANALYSIS_MS = 1000;

function wait(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function ScanLine() {
  const progress = useRef(new Animated.Value(0)).current;
  const [frameHeight, setFrameHeight] = useState(0);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [progress]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={event => setFrameHeight(event.nativeEvent.layout.height)}>
      <Animated.View
        style={[
          styles.scanLine,
          { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, frameHeight - 54)] }) }] },
        ]}
      />
    </View>
  );
}

const pawTrail = [
  { left: "3%", bottom: 5, size: 24, opacity: 0.2, rotate: "-24deg" },
  { left: "15%", bottom: 31, size: 31, opacity: 0.34, rotate: "-8deg" },
  { left: "28%", bottom: 1, size: 40, opacity: 0.5, rotate: "14deg" },
  { left: "43%", bottom: 39, size: 20, opacity: 0.26, rotate: "-32deg" },
  { left: "52%", bottom: 5, size: 52, opacity: 0.45, rotate: "6deg" },
  { left: "70%", bottom: 35, size: 27, opacity: 0.32, rotate: "26deg" },
  { left: "80%", bottom: 1, size: 34, opacity: 0.42, rotate: "-14deg" },
  { right: "1%", bottom: 29, size: 22, opacity: 0.22, rotate: "18deg" },
] as const;

function PawTrail() {
  return (
    <View pointerEvents="none" style={styles.pawTrail} accessibilityElementsHidden>
      {pawTrail.map((paw, index) => (
        <Ionicons
          key={index}
          name="paw"
          color={theme.text}
          size={paw.size}
          style={[styles.pawTrailItem, paw, { transform: [{ rotate: paw.rotate }] }]}
        />
      ))}
    </View>
  );
}

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
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  });
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
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.65 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.65 });

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
    const startedAt = Date.now();
    setScreen("analysing");
    try {
      const result = await identifyDog(imageUri);
      await wait(Math.max(0, MIN_ANALYSIS_MS - (Date.now() - startedAt)));
      setPrediction(result);
      setScreen(result.prediction_quality === "not_dog" ? "notDog" : "results");
    } catch (reason) {
      await wait(Math.max(0, MIN_ANALYSIS_MS - (Date.now() - startedAt)));
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

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
    <LinearGradient colors={["#7B3FE4", "#6A2ED6"]} style={styles.fill}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        {screen === "home" && (
          <ScrollView contentContainerStyle={styles.page}>
            <View style={styles.homeTop}>
              <View style={styles.brand}><Ionicons name="paw" size={24} color={theme.accent} /><Text style={styles.brandText}>DetectoDog</Text></View>
              <Pressable accessibilityLabel="Previous results" onPress={() => setScreen("history")} style={styles.iconButton}><Ionicons name="time-outline" size={23} color={theme.text} /></Pressable>
            </View>
            <View style={styles.hero}>
              <Ionicons name="paw" size={74} color="rgba(201,182,247,.34)" />
              <View style={styles.heroBadge}><Ionicons name="paw" size={15} color={theme.accent} /><Text style={styles.badge}>120 breeds recognised</Text></View>
            </View>
            <Text style={styles.title}>What breed is that dog?</Text>
            <Text style={styles.subtitle}>Take a photo or choose one from your library to discover the most likely breed.</Text>
            <View style={styles.actionRow}>
              <Action icon="camera-outline" label="Take a photo" onPress={() => choose("camera")} />
              <Action icon="images-outline" label="Choose from library" onPress={() => choose("library")} />
            </View>
            <View style={styles.homeNote}><Ionicons name="information-circle-outline" size={17} color={theme.accent} /><Text style={styles.noteText}>Results are visual estimates from a photo, not a genetic test.</Text></View>
            <PawTrail />
          </ScrollView>
        )}

        {screen === "preview" && imageUri && (
          <ScrollView contentContainerStyle={styles.page}>
            <Header title="Your photo" onBack={() => setScreen("home")} right={<Pressable onPress={() => setScreen("home")} style={styles.textButton}><Text style={styles.textButtonLabel}>Cancel</Text></Pressable>} />
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
            <View style={styles.actionRow}>
              <Action compact icon="camera-reverse-outline" label="Retake" onPress={() => choose("camera")} />
              <Action compact icon="swap-horizontal-outline" label="Replace" onPress={() => choose("library")} />
            </View>
            <View style={styles.note}><Ionicons name="bulb-outline" size={18} color={theme.accent} /><Text style={styles.noteText}>For the best result, use a clear photo showing the dog’s face and body.</Text></View>
            <Action icon="search-outline" label="Identify this dog" onPress={analyse} />
            <PawTrail />
          </ScrollView>
        )}

        {screen === "analysing" && (
          <View style={[styles.page, styles.analysisPage]}>
            <View style={styles.analysisFrame}>
              {imageUri && <Image source={{ uri: imageUri }} style={styles.analysisImage} />}
              <ScanLine />
              <View style={styles.scanBorder} />
            </View>
            <ActivityIndicator size="large" color={theme.accent} />
            <View style={styles.analysisCopy}><Text style={[styles.title, styles.centerText]}>Sniffing out a match…</Text><Text style={[styles.subtitle, styles.centerText]}>Comparing this photo with 120 dog breeds.</Text></View>
            <View style={styles.note}><Ionicons name="hourglass-outline" size={18} color={theme.accent} /><Text style={styles.noteText}>A slower connection can take a little longer. Keep this screen open while we compare the photo.</Text></View>
          </View>
        )}

        {screen === "results" && prediction && top && (
          <ScrollView contentContainerStyle={styles.page}>
            <Header title="Your result" onBack={() => setScreen("preview")} right={<Pressable onPress={saveResult} style={styles.iconButton}><Ionicons name="bookmark-outline" size={22} color={theme.text} /></Pressable>} />
            <View style={styles.resultHero}>
              {imageUri && <Image source={{ uri: imageUri }} style={styles.resultImage} />}
              <View style={styles.resultCopy}>
                <View style={styles.confidenceBadge}><Ionicons name={prediction.prediction_quality === "good" ? "checkmark-circle" : "help-circle"} size={15} color={theme.accent} /><Text style={styles.confidenceBadgeText}>{prediction.prediction_quality === "good" ? "High confidence" : "Low confidence"}</Text></View>
                <Text style={styles.resultHeading}>{prediction.prediction_quality === "good" ? "We found a likely match!" : "Here are the closest matches"}</Text>
              </View>
            </View>
            <View style={styles.resultCard}><View style={styles.resultCardTop}><Text style={styles.resultBreed}>{top.breed}</Text><Text style={styles.resultPercent}>{percent(top.confidence)}</Text></View><View style={styles.meter}><View style={[styles.meterFill, { width: `${Math.round(top.confidence * 100)}%` }]} /></View><Text style={styles.confidence}>{percent(top.confidence)} confidence</Text></View>
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
            <PawTrail />
          </ScrollView>
        )}

        {screen === "notDog" && (
          <View style={[styles.page, styles.center]}>
            <View style={styles.noDogIcon}><Ionicons name="search-outline" size={48} color={theme.text} /></View>
            <View style={styles.analysisCopy}>
              <Text style={[styles.title, styles.centerText]}>All 120 breeds said no</Text>
              <Text style={[styles.subtitle, styles.centerText]}>We couldn’t identify a dog in this photo. Try a clearer photo with one dog visible and good lighting.</Text>
            </View>
            <View style={[styles.actionRow, styles.fullWidth]}>
              <Action icon="camera-outline" label="Retake photo" onPress={() => choose("camera")} />
              <Action icon="images-outline" label="Choose another photo" onPress={() => choose("library")} />
            </View>
          </View>
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
            <PawTrail />
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
            <PawTrail />
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
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 }, safe: { flex: 1 }, grow: { flex: 1 },
  page: { width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 22, paddingTop: 6, paddingBottom: 100, gap: 18 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", textAlign: "center" },
  homeTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", gap: 9, alignItems: "center" }, brandText: { color: theme.text, fontSize: 21, fontFamily: "PlayfairDisplay_700Bold" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 },
  headerTitle: { color: theme.text, fontSize: 16, fontFamily: "PlayfairDisplay_500Medium" }, iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: "rgba(246,241,255,.32)", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.1)" }, iconSpacer: { width: 44 },
  hero: { height: 290, borderRadius: 26, backgroundColor: "rgba(46,18,87,.24)", borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  heroBadge: { position: "absolute", bottom: 16, flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 99, backgroundColor: "rgba(30,16,48,.5)", borderWidth: 1, borderColor: "rgba(246,241,255,.24)" },
  badge: { color: theme.text, fontSize: 13, fontFamily: "PlayfairDisplay_500Medium" },
  title: { color: theme.text, fontSize: 32, lineHeight: 36, fontFamily: "PlayfairDisplay_600SemiBold", letterSpacing: -0.8 },
  subtitle: { color: theme.muted, fontSize: 15, lineHeight: 23, fontFamily: "PlayfairDisplay_400Regular" },
  actionRow: { flexDirection: "row", gap: 12 },
  action: { flex: 1, minHeight: 118, padding: 16, borderRadius: 22, borderWidth: 1.5, borderColor: "rgba(246,241,255,.5)", justifyContent: "space-between", backgroundColor: "transparent" },
  actionCompact: { minHeight: 72 }, actionText: { color: theme.text, fontSize: 17, fontFamily: "PlayfairDisplay_600SemiBold" }, actionTextCompact: { fontSize: 13 }, pressed: { opacity: 0.65 },
  note: { flexDirection: "row", gap: 9, padding: 13, borderRadius: 16, backgroundColor: "rgba(30,16,48,.28)" }, homeNote: { flexDirection: "row", gap: 9, alignItems: "flex-start", paddingHorizontal: 4 }, noteText: { flex: 1, color: theme.muted, fontSize: 13, lineHeight: 19, fontFamily: "PlayfairDisplay_400Regular" },
  textButton: { height: 44, minWidth: 44, alignItems: "flex-end", justifyContent: "center" }, textButtonLabel: { color: theme.muted, fontSize: 15, fontFamily: "PlayfairDisplay_500Medium" },
  previewImage: { width: "100%", aspectRatio: 1, borderRadius: 26, backgroundColor: theme.surface },
  analysisPage: { alignItems: "center", gap: 24 }, analysisFrame: { width: "100%", aspectRatio: 1, maxHeight: 352, borderRadius: 26, overflow: "hidden", borderWidth: 1, borderColor: theme.border }, analysisImage: { width: "100%", height: "100%" }, scanLine: { position: "absolute", left: 0, right: 0, top: 0, height: 54, borderBottomWidth: 2, borderBottomColor: theme.accent, backgroundColor: "rgba(201,182,247,.14)" }, scanBorder: { position: "absolute", inset: 14, borderRadius: 18, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(246,241,255,.45)" }, analysisCopy: { alignItems: "center", gap: 7 }, centerText: { textAlign: "center" },
  resultHero: { flexDirection: "row", gap: 14, alignItems: "center" }, resultImage: { width: 96, height: 96, borderRadius: 22 }, resultCopy: { flex: 1, gap: 7 },
  confidenceBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 99, backgroundColor: "rgba(201,182,247,.22)" }, confidenceBadgeText: { color: "#E0D2FC", fontSize: 12, fontFamily: "PlayfairDisplay_600SemiBold" }, resultHeading: { color: theme.text, fontSize: 25, lineHeight: 29, fontFamily: "PlayfairDisplay_600SemiBold" },
  resultCard: { padding: 18, gap: 14, borderRadius: 22, borderWidth: 1, borderColor: theme.border, backgroundColor: "rgba(255,255,255,.1)" }, resultCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 }, resultPercent: { flexShrink: 0, color: theme.accent, fontSize: 27, lineHeight: 31, fontFamily: "PlayfairDisplay_700Bold" },
  resultBreed: { flex: 1, flexShrink: 1, color: theme.text, fontSize: 28, lineHeight: 31, fontFamily: "PlayfairDisplay_600SemiBold" }, confidence: { color: theme.muted, fontSize: 15, fontFamily: "PlayfairDisplay_400Regular" },
  meter: { height: 8, backgroundColor: theme.surface, borderRadius: 4, overflow: "hidden" }, meterFill: { height: 8, backgroundColor: theme.accent, borderRadius: 4 },
  sectionTitle: { color: theme.text, fontSize: 20, fontFamily: "PlayfairDisplay_600SemiBold", marginTop: 8 },
  match: { flexDirection: "row", justifyContent: "space-between", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceSoft }, matchName: { color: theme.text, fontSize: 16, fontFamily: "PlayfairDisplay_500Medium" }, matchScore: { color: theme.accent, fontSize: 16, fontFamily: "PlayfairDisplay_600SemiBold" },
  share: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, padding: 12 }, shareText: { color: theme.accent, fontSize: 15, fontFamily: "PlayfairDisplay_600SemiBold" }, disclaimer: { color: theme.dim, fontSize: 12, lineHeight: 18, textAlign: "center", fontFamily: "PlayfairDisplay_400Regular" },
  profileIcon: { height: 180, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: theme.surfaceSoft, borderWidth: 1, borderColor: theme.border },
  noDogIcon: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.12)", borderWidth: 1, borderColor: theme.border }, fullWidth: { width: "100%" },
  factGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, fact: { width: "48%", minHeight: 90, padding: 14, borderRadius: 17, backgroundColor: theme.surfaceSoft, borderWidth: 1, borderColor: theme.border }, factLabel: { color: theme.accent, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, fontFamily: "PlayfairDisplay_600SemiBold" }, factValue: { color: theme.text, fontSize: 15, marginTop: 10, fontFamily: "PlayfairDisplay_400Regular" },
  historyItem: { flexDirection: "row", alignItems: "center", gap: 13, padding: 11, borderRadius: 18, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceSoft }, historyImage: { width: 62, height: 62, borderRadius: 14 },
  pawTrail: { position: "relative", width: "100%", height: 72, marginTop: 8, overflow: "hidden" },
  pawTrailItem: { position: "absolute" },
});
