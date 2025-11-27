import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import GameCard from "../../../components/GameCard";
import ReviewsSection from "../../../components/ReviewsSection";
import { auth, db } from "../../../lib/firebase";

console.log(">>> Loaded app/(tabs)/game/[id].tsx"); // debug – remove later
console.log(">>> GameDetail render file loaded"); // debug – remove later

// Define game structure for Firestore data

type Game = {
  id: string;
  title: string;
  coverUrl: string;
  description?: string;
  genres?: string[];
  platforms?: string[];
  ratingAvg?: number;
  releaseDate?: any;
  steamAppId?: string;
};

// Try to use Steam's wide hero if possible, otherwise keep existing cover
const pickSteamHero = (coverUrl?: string, steamAppId?: string) => {
  if (steamAppId) {
    return `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${steamAppId}/library_hero.jpg`;
  }
  if (!coverUrl) return undefined;
  // Attempt to swap common Steam filenames to the hero variant
  return coverUrl
    .replace(/header(\.\w+)?$/i, "library_hero.jpg")
    .replace(/capsule_.*?(\.\w+)$/i, "library_hero.jpg");
};

export default function GameDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [related, setRelated] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  // Wishlist state for the signed in user
  const [wishDocId, setWishDocId] = useState<string | null>(null);
  const [wishBusy, setWishBusy] = useState(false);

  // Image state: chosen URL + measured aspect ratio
  const [heroUrl, setHeroUrl] = useState<string | undefined>(undefined);
  const [imgRatio, setImgRatio] = useState<number | null>(null);

  // Layout tweaks
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 900;

  // Fetch selected game + related games + wishlist presence
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        // Game document
        const snap = await getDoc(doc(db, "games", String(id)));
        if (!snap.exists()) {
          if (mounted) setGame(null);
          return;
        }
        const g = { id: snap.id, ...(snap.data() as Omit<Game, "id">) } as Game;
        if (!mounted) return;
        setGame(g);

        // Choose best image for detail header (prefer Steam hero)
        const preferred = pickSteamHero(g.coverUrl, g.steamAppId) || g.coverUrl;
        setHeroUrl(preferred);

        // Measure the picked image so the view can keep the same aspect
        if (preferred) {
          Image.getSize(
            preferred,
            (w, h) => mounted && setImgRatio(w / Math.max(1, h)),
            () => {
              if (!mounted) return;
              if (g.coverUrl && preferred !== g.coverUrl) {
                setHeroUrl(g.coverUrl);
                Image.getSize(
                  g.coverUrl,
                  (w2, h2) => mounted && setImgRatio(w2 / Math.max(1, h2)),
                  () => mounted && setImgRatio(2.2)
                );
              } else {
                setImgRatio(2.2);
              }
            }
          );
        }

        // Related = share one of the first two genres
        const genres = (g.genres ?? []).slice(0, 2);
        if (genres.length) {
          const qRel = query(
            collection(db, "games"),
            where("genres", "array-contains-any", genres),
            limit(12)
          );
          const rs = await getDocs(qRel);
          const rel = rs.docs
            .map(
              (d) => ({ id: d.id, ...(d.data() as Omit<Game, "id">) } as Game)
            )
            .filter((x) => x.id !== g.id);
          if (mounted) setRelated(rel);
        } else {
          if (mounted) setRelated([]);
        }

        // If logged in, check if this game is in wishlist
        const user = auth.currentUser;
        if (user) {
          const qWish = query(
            collection(db, "users", user.uid, "wishlist"),
            where("gameId", "==", g.id),
            limit(1)
          );
          const ws = await getDocs(qWish);
          if (mounted) setWishDocId(ws.empty ? null : ws.docs[0].id);
        } else {
          if (mounted) setWishDocId(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Open the game's Steam store page
  const openSteam = () => {
    if (!game?.steamAppId) return;
    Linking.openURL(
      `https://store.steampowered.com/app/${game.steamAppId}`
    ).catch(() => {});
  };

  // Add or remove game from wishlist
  const toggleWishlist = async () => {
    if (!game) return;
    const user = auth.currentUser;
    if (!user) {
      alert("Please sign in to use wishlist.");
      return;
    }
    if (wishBusy) return;

    setWishBusy(true);
    try {
      if (wishDocId) {
        await deleteDoc(doc(db, "users", user.uid, "wishlist", wishDocId));
        setWishDocId(null);

        Toast.show({
          type: "success",
          text1: `${game.title} removed from wishlist`,
        });
      } else {
        const ref = await addDoc(
          collection(db, "users", user.uid, "wishlist"),
          {
            gameId: game.id,
            title: game.title,
            coverUrl: game.coverUrl,
            genres: game.genres ?? [],
            ratingAvg: game.ratingAvg ?? null,
            platforms: game.platforms ?? [],
            createdAt: serverTimestamp(),
          }
        );
        setWishDocId(ref.id);

        Toast.show({
          type: "success",
          text1: `${game.title} added to wishlist`,
        });
      }
    } catch (e) {
      console.error("Error toggling wishlist:", e);
      Toast.show({
        type: "error",
        text1: "Error updating wishlist",
      });
    } finally {
      setWishBusy(false);
    }
  };

  const readableDate = useMemo(() => {
    if (!game?.releaseDate) return undefined;

    if (typeof game.releaseDate?.toDate === "function") {
      try {
        return game.releaseDate.toDate().toLocaleDateString();
      } catch {
        return undefined;
      }
    }

    if (typeof game.releaseDate === "string") {
      const parts = game.releaseDate.split("/");

      if (parts.length === 3) {
        const [day, month, year] = parts;
        const d = new Date(
          Number(year),
          Number(month) - 1,
          Number(day)
        );

        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString();
        }
      }

      return game.releaseDate;
    }

    return String(game.releaseDate);
  }, [game?.releaseDate]);

  // Basic decoding for common HTML entities
  const plainDescription = useMemo(() => {
    if (!game?.description) return "";
    return game.description
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }, [game?.description]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!game) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#fff" }}>Game not found.</Text>
        <Pressable
          onPress={() => router.replace("/(tabs)/home")}
          style={styles.backBtn}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Go Home</Text>
        </Pressable>
      </View>
    );
  }

  const ratio = imgRatio ?? 2.2;
  const isPoster = ratio < 1.25;
  const bannerRatio = Math.max(1.6, Math.min(ratio, 3.2));

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#0b1220" }}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Header */}
        <View style={[styles.headerRow, { marginTop: 8 }]}>
          <Pressable
            onPress={() => router.replace("/(tabs)/home")}
            style={({ pressed }) => [
              styles.backIcon,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="chevron-back" size={26} color="#e5e7eb" />
          </Pressable>

          <Text style={styles.headerTitle} numberOfLines={2}>
            {game.title}
          </Text>

          <Pressable
            onPress={toggleWishlist}
            disabled={wishBusy}
            style={({ pressed }) => [
              styles.heartBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons
              name={wishDocId ? "heart" : "heart-outline"}
              size={26}
              color={wishDocId ? "#ef4444" : "#e5e7eb"}
            />
          </Pressable>
        </View>

        {/* hero image (banner or poster) */}
        <View
          style={[styles.posterWrap, isWideLayout && styles.posterWrapWide]}
        >
          {heroUrl ? (
            <Image
              source={{ uri: heroUrl }}
              style={[
                styles.poster,
                isPoster
                  ? { aspectRatio: 2 / 3, alignSelf: "center", width: "60%" }
                  : { aspectRatio: bannerRatio, width: "100%" },
              ]}
              resizeMode={isPoster ? "contain" : "cover"}
              onError={() => {
                if (game.coverUrl && heroUrl !== game.coverUrl) {
                  setHeroUrl(game.coverUrl);
                }
              }}
            />
          ) : null}
          <View style={styles.posterOverlay} />
        </View>

        {/* info block */}
        <View style={styles.infoWrap}>
          {/* rating + date */}
          <View style={styles.metaRow}>
            {typeof game.ratingAvg === "number" && (
              <View style={styles.metaPill}>
                <Ionicons name="star" size={14} color="#fbbf24" />
                <Text style={styles.metaText}>{game.ratingAvg.toFixed(1)}</Text>
              </View>
            )}
            {!!readableDate && (
              <View style={styles.metaPill}>
                <Ionicons name="calendar" size={14} color="#9aa3af" />
                <Text style={styles.metaText}>{readableDate}</Text>
              </View>
            )}
          </View>

          {/* genres */}
          {!!game.genres?.length && (
            <View style={styles.chipsRow}>
              {game.genres.slice(0, 6).map((g) => (
                <View key={g} style={styles.chip}>
                  <Text style={styles.chipText}>{g}</Text>
                </View>
              ))}
            </View>
          )}

          {/* platforms with overflow */}
          {!!game.platforms?.length && (
            <>
              <Text style={styles.sectionTitle}>Platforms</Text>
              <View style={styles.chipsRow}>
                {game.platforms.slice(0, 2).map((p) => (
                  <View key={p} style={styles.chip}>
                    <Text style={styles.chipText}>{p}</Text>
                  </View>
                ))}
                {game.platforms.length > 2 && (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>
                      +{game.platforms.length - 2}
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* about */}
          {!!plainDescription && (
            <>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.description}>{plainDescription}</Text>
            </>
          )}

          {/* steam link */}
          {!!game.steamAppId && (
            <Pressable onPress={openSteam} style={styles.ctaSmall}>
              <Ionicons name="logo-steam" size={16} color="#fff" />
              <Text style={styles.ctaText}>View on Steam</Text>
            </Pressable>
          )}

          {/* reviews section */}
          <ReviewsSection
            gameId={game.id}
            gameTitle={game.title}
            onRatingUpdated={(avg) =>
              setGame((prev) =>
                prev && prev.id === game.id
                  ? { ...prev, ratingAvg: avg ?? undefined }
                  : prev
              )
            }
          />
        </View>

        {/* related carousel */}
        {!!related.length && (
          <>
            <Text style={styles.sectionTitle}>Related games</Text>
            <FlatList
              data={related}
              horizontal
              keyExtractor={(x) => x.id}
              contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={{ width: 160 }}>
                  <GameCard
                    game={item}
                    onPress={() =>
                      router.replace({
                        pathname: "/(tabs)/game/[id]",
                        params: { id: String(item.id) },
                      })
                    }
                  />
                </View>
              )}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0b1220" },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  backIcon: { padding: 10 },
  headerTitle: {
    color: "#F3F4F6",
    fontSize: 22,
    fontWeight: "800",
    flex: 1,
    borderRadius: 20,
  },
  heartBtn: { padding: 10, borderRadius: 20 },

  posterWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  posterWrapWide: { alignItems: "flex-start" },
  poster: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#0f172a",
  },
  posterOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.06)",
  },

  infoWrap: { paddingHorizontal: 16, marginTop: 12 },
  metaRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  metaText: { color: "#cbd5e1", fontSize: 12 },

  sectionTitle: {
    color: "#F3F4F6",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "nowrap",
  },
  chip: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { color: "#cbd5e1", fontSize: 12 },

  description: { color: "#cbd5e1", lineHeight: 20 },

  ctaSmall: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#14532d",
    borderColor: "#166534",
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  ctaText: { color: "#fff", fontWeight: "600" },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0b1220",
  },
  backBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#111827",
    borderRadius: 8,
  },
});
