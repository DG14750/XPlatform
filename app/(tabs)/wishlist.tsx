import { useRouter } from "expo-router";
import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
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
  id: string; // wishlist document id
  gameId?: string; // original game id from "games" collection
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

// -------------------------------
// 🔹 Layout constants
// -------------------------------

const GAP = 16;
const PAGE_PAD = 16;

// -------------------------------
// 🔹 Styles
// -------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0b1220",
    paddingTop: 40,
  },

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

// -------------------------------
// 🔹 Component
// -------------------------------

export default function WishlistScreen() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  const { width } = useWindowDimensions();
  const router = useRouter();

  // sign-out (for AppHeader)
  const handleSignOut = async () => {
    try {
      await auth.signOut();
      router.replace("/");
    } catch (e) {
      console.error("Error signing out:", e);
    }
  };

  // Fetch wishlist games
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "wishlist"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const data: Game[] = querySnapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Game, "id">),
        }));
        setGames(data);
        setLoading(false);
      },
      (e) => {
        console.error("Error fetching wishlist:", e);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  // Responsive columns
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

  // Delete from wishlist
  const handleDeleteFromWishlist = async (game: Game) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.error("No user is signed in");
        return;
      }
      await deleteDoc(doc(db, "users", user.uid, "wishlist", game.id));

      Toast.show({
        type: "success",
        text1: "Removed from Wishlist",
        text2: `${game.title} has been removed from your wishlist.`,
      });
    } catch (e) {
      console.error("Error removing game from wishlist:", e);
      Toast.show({
        type: "error",
        text1: "Error removing from Wishlist",
        text2: `Could not remove ${game.title} from your wishlist.`,
      });
    }
  };

  // Loading
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // Main render
  return (
    <View style={styles.screen}>
      <AppHeader title="Wishlist" onSignOut={handleSignOut} />

      <FlatList
        data={games}
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
        renderItem={({ item }) => (
          <View style={{ width: itemWidth }}>
            <GameCard
              game={item}
              onRemoveFromWishList={() => handleDeleteFromWishlist(item)}
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/game/[id]",
                  params: { id: String(item.gameId ?? item.id) },
                })
              }
            />
          </View>
        )}
      />
    </View>
  );
}
