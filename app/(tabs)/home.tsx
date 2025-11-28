// app/(tabs)/home.tsx
// Home screen with shared AppHeader + wishlist hearts

import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import AppHeader from "../../components/AppHeader";
import GameCard from "../../components/GameCard";
import { auth, db } from "../../lib/firebase";

// -------------------------------
// 🔹 Types
// -------------------------------
type Game = {
  id: string;
  title: string;
  coverUrl: string;
  genres?: string[];
  ratingAvg?: number;
  platforms?: string[];
};

type User = {
  uid: string;
  email: string;
  username: string;
  createdAt: Date;
  avatarUrl: string;
};

// Layout constants
const GAP = 16;
const PAGE_PAD = 16;

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("All");
  const [platformFilter, setPlatformFilter] = useState("All");

  // gameId -> wishlistDocId
  const [wishlistMap, setWishlistMap] = useState<Record<string, string>>({});

  const router = useRouter();
  const { width } = useWindowDimensions();

  // -------------------------------
  // 🔹 Fetch all games
  // -------------------------------
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const q = query(collection(db, "games"), orderBy("ratingAvg", "desc"));
        const snap = await getDocs(q);
        const data: Game[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Game, "id">),
        }));
        setGames(data);
      } catch (e) {
        console.error("Error fetching games:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, []);

  // -------------------------------
  // 🔹 Wishlist listener (keeps hearts in sync)
  // -------------------------------
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setWishlistMap({});
      return;
    }

    const q = query(collection(db, "users", user.uid, "wishlist"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const next: Record<string, string> = {};
      snap.forEach((d) => {
        const data = d.data() as { gameId?: string };
        if (data.gameId) {
          // key = gameId from games collection
          next[data.gameId] = d.id;
        }
      });
      setWishlistMap(next);
    });

    return unsubscribe;
  }, []);

  // -------------------------------
  // 🔹 Sign-out
  // -------------------------------
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace("/");
    } catch (e) {
      console.error("Error signing out:", e);
    }
  };

  // -------------------------------
  // 🔹 Responsive grid columns
  // -------------------------------
  const numColumns = useMemo(() => {
    if (width >= 1200) return 3;
    if (width >= 900) return 2;
    return 1;
  }, [width]);

  const itemWidth = useMemo(() => {
    const totalGaps = (numColumns - 1) * GAP;
    const usable = Math.max(0, width - PAGE_PAD * 2 - totalGaps);
    return Math.floor(usable / numColumns);
  }, [width, numColumns]);

  // -------------------------------
  // 🔹 Search + filters
  // -------------------------------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return games.filter((g) => {
      const matchesSearch =
        !q ||
        g.title.toLowerCase().includes(q) ||
        g.genres?.some((x) => x.toLowerCase().includes(q)) ||
        g.platforms?.some((x) => x.toLowerCase().includes(q));

      const matchesGenre =
        genreFilter === "All" ||
        g.genres?.some(
          (x) => x.toLowerCase() === genreFilter.toLowerCase()
        );

      const matchesPlatform =
        platformFilter === "All" ||
        g.platforms?.some(
          (x) => x.toLowerCase() === platformFilter.toLowerCase()
        );

      return matchesSearch && matchesGenre && matchesPlatform;
    });
  }, [games, search, genreFilter, platformFilter]);

  // -------------------------------
  // 🔹 Add to wishlist (no duplicates)
  // -------------------------------
  const handleAddToWishList = async (game: Game) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        alert("Please sign in to use wishlist.");
        return;
      }

      // Already in wishlist? Just bail.
      if (wishlistMap[game.id]) {
        Toast.show({
          type: "info",
          text1: "Already in wishlist",
        });
        return;
      }

      const ref = await addDoc(
        collection(db, "users", user.uid, "wishlist"),
        {
          gameId: game.id,
          title: game.title,
          coverUrl: game.coverUrl,
          genres: game.genres ?? [],
          ratingAvg: game.ratingAvg ?? null,
          platforms: game.platforms ?? [],
          createdAt: new Date(),
        }
      );

      // onSnapshot will update wishlistMap, no need to manually set
      console.log("Added to wishlist:", ref.id);
      Toast.show({
        type: "success",
        text1: `${game.title} added to wishlist`,
      });
    } catch (e) {
      console.error("Error adding to wishlist:", e);
      Toast.show({
        type: "error",
        text1: "Error adding to wishlist",
      });
    }
  };

  // -------------------------------
  // 🔹 Remove from wishlist
  // -------------------------------
  const handleRemoveFromWishList = async (game: Game) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        alert("Please sign in to use wishlist.");
        return;
      }

      const wishlistDocId = wishlistMap[game.id];
      if (!wishlistDocId) {
        return;
      }

      await deleteDoc(doc(db, "users", user.uid, "wishlist", wishlistDocId));

      // onSnapshot will update wishlistMap
      Toast.show({
        type: "success",
        text1: `${game.title} removed from wishlist`,
      });
    } catch (e) {
      console.error("Error removing from wishlist:", e);
      Toast.show({
        type: "error",
        text1: "Error removing from wishlist",
      });
    }
  };

  // -------------------------------
  // 🔹 Loading
  // -------------------------------
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // -------------------------------
  // 🔹 Render
  // -------------------------------
  return (
    <View style={styles.screen}>
      <AppHeader title="Discover Games" onSignOut={handleSignOut} />

      {/* Search + filters row */}
      <View style={styles.controlsRow}>
        {/* Search bar */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} style={styles.searchIcon} />
          <TextInput
            placeholder="Search games..."
            placeholderTextColor="#9aa3af"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
        </View>

        {/* Genre filter (simple cycle) */}
        <TouchableOpacity
          style={styles.fakeDropdown}
          onPress={() => {
            const next =
              genreFilter === "All"
                ? "Action"
                : genreFilter === "Action"
                ? "RPG"
                : genreFilter === "RPG"
                ? "Adventure"
                : "All";
            setGenreFilter(next);
          }}
        >
          <MaterialIcons name="filter-list" size={18} color="#9aa3af" />
          <Text style={styles.fakeDropdownText}>{genreFilter}</Text>
          <MaterialIcons
            name="keyboard-arrow-down"
            size={18}
            color="#9aa3af"
          />
        </TouchableOpacity>

        {/* Platform filter (simple cycle) */}
        <TouchableOpacity
          style={styles.fakeDropdown}
          onPress={() => {
            const next =
              platformFilter === "All"
                ? "PC"
                : platformFilter === "PC"
                ? "PS5"
                : platformFilter === "PS5"
                ? "Xbox"
                : "All";
            setPlatformFilter(next);
          }}
        >
          <Text style={styles.fakeDropdownText}>{platformFilter}</Text>
          <MaterialIcons
            name="keyboard-arrow-down"
            size={18}
            color="#9aa3af"
          />
        </TouchableOpacity>
      </View>

      {/* Count text */}
      <Text style={styles.countText}>{filtered.length} games found</Text>

      {/* Grid list */}
      <FlatList
        data={filtered}
        key={numColumns}
        numColumns={numColumns}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingBottom: 40,
          paddingHorizontal: PAGE_PAD,
          rowGap: GAP,
          alignItems: "flex-start",
        }}
        columnWrapperStyle={numColumns > 1 ? { columnGap: GAP } : undefined}
        renderItem={({ item }) => {
          const isWishlisted = !!wishlistMap[item.id];

          return (
            <View style={{ width: itemWidth }}>
              <GameCard
                game={item}
                onAddToWishList={
                  !isWishlisted ? () => handleAddToWishList(item) : undefined
                }
                onRemoveFromWishList={
                  isWishlisted ? () => handleRemoveFromWishList(item) : undefined
                }
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/game/[id]",
                    params: { id: String(item.id) },
                  })
                }
              />
            </View>
          );
        }}
      />
    </View>
  );
}

// -------------------------------
// 🔹 Styles
// -------------------------------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0b1220",
    paddingTop: 40,
  },

  controlsRow: {
    paddingHorizontal: PAGE_PAD,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 8,
  },

  searchWrap: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 220,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    paddingLeft: 36,
    paddingRight: 12,
    justifyContent: "center",
  },
  searchIcon: {
    position: "absolute",
    left: 12,
    top: 12,
    color: "#9aa3af",
  },
  searchInput: {
    color: "#e5e7eb",
    fontSize: 14,
  },

  fakeDropdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  fakeDropdownText: { color: "#e5e7eb" },

  countText: {
    paddingHorizontal: PAGE_PAD,
    color: "#9aa3af",
    fontSize: 12,
    marginBottom: 8,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0A0F1A",
  },
});
