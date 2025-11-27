import { Ionicons } from "@expo/vector-icons";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import Toast from "react-native-toast-message";
import { auth, db } from "../lib/firebase";

type Review = {
  id: string;
  userId: string;
  username?: string;
  rating: number;
  body: string;
  createdAt?: any;
};

type ReviewsSectionProps = {
  gameId: string;
  gameTitle: string;
  onRatingUpdated?: (avg: number | null) => void;
};

// Helper that recalculates the average rating for a game document.
async function recalcGameRating(gameId: string): Promise<number | null> {
  const q = query(
    collection(db, "reviews"),
    where("gameId", "==", String(gameId))
  );
  const snap = await getDocs(q);

  let sum = 0;
  let count = 0;

  snap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    const rating = typeof data.rating === "number" ? data.rating : 0;
    sum += rating;
    count += 1;
  });

  const avg = count > 0 ? sum / count : null;

  await updateDoc(doc(db, "games", String(gameId)), {
    ratingAvg: avg,
    ratingCount: count,
  });

  return avg;
}

const ReviewsSection: React.FC<ReviewsSectionProps> = ({
  gameId,
  gameTitle,
  onRatingUpdated,
}) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewRating, setReviewRating] = useState(4);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [userReview, setUserReview] = useState<Review | null>(null);

  // Listen for reviews for this game
  useEffect(() => {
    const qReviews = query(
      collection(db, "reviews"),
      where("gameId", "==", gameId)
    );

    const unsub = onSnapshot(
      qReviews,
      (snap) => {
        const list: Review[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            userId: data.userId,
            username: data.username,
            rating: typeof data.rating === "number" ? data.rating : 0,
            body: data.body ?? "",
            createdAt: data.createdAt,
          };
        });

        setReviews(list);
        setReviewsLoading(false);

        const user = auth.currentUser;
        if (user) {
          const mine = list.find((r) => r.userId === user.uid) || null;
          setUserReview(mine);
        } else {
          setUserReview(null);
        }
      },
      (err) => {
        console.error("Error loading reviews", err);
        setReviewsLoading(false);
      }
    );

    return unsub;
  }, [gameId]);

  // When the users own review changes, prefill the form
  useEffect(() => {
    if (userReview) {
      setReviewBody(userReview.body);
      setReviewRating(userReview.rating);
    } else {
      setReviewBody("");
      setReviewRating(4);
    }
  }, [userReview]);

  const handleSubmitReview = async () => {
    if (!gameId) return;

    const user = auth.currentUser;
    if (!user) {
      alert("Please sign in to add a review.");
      return;
    }

    const trimmed = reviewBody.trim();
    if (!trimmed) {
      Toast.show({
        type: "error",
        text1: "Please enter some review text",
      });
      return;
    }

    if (reviewSubmitting) return;
    setReviewSubmitting(true);

    try {
      const safeRating = Math.max(0, Math.min(5, reviewRating));

      if (userReview) {
        await updateDoc(doc(db, "reviews", userReview.id), {
          body: trimmed,
          rating: safeRating,
          updatedAt: serverTimestamp(),
        });

        Toast.show({
          type: "success",
          text1: "Review updated",
        });
      } else {
        await addDoc(collection(db, "reviews"), {
          gameId,
          userId: user.uid,
          username: user.displayName || user.email || "Anonymous",
          body: trimmed,
          rating: safeRating,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        Toast.show({
          type: "success",
          text1: "Review added",
        });
      }

      const avg = await recalcGameRating(gameId);
      if (onRatingUpdated) {
        onRatingUpdated(avg);
      }
    } catch (e) {
      console.error("Error saving review", e);
      Toast.show({
        type: "error",
        text1: "Error saving review",
      });
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!userReview) return;

    const user = auth.currentUser;
    if (!user) {
      alert("Please sign in.");
      return;
    }

    try {
      await deleteDoc(doc(db, "reviews", userReview.id));

      Toast.show({
        type: "success",
        text1: "Review deleted",
      });

      const avg = await recalcGameRating(gameId);
      if (onRatingUpdated) {
        onRatingUpdated(avg);
      }
    } catch (e) {
      console.error("Error deleting review", e);
      Toast.show({
        type: "error",
        text1: "Error deleting review",
      });
    }
  };

  return (
    <View style={{ marginTop: 16 }}>
      <Text style={styles.sectionTitle}>Reviews</Text>

      {/* Add / Edit review form */}
      <View style={styles.addReviewCard}>
        <Text style={styles.addReviewTitle}>
          {userReview ? "Edit your review" : "Add your review"}
        </Text>

        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable
              key={star}
              onPress={() => setReviewRating(star)}
              style={styles.ratingStar}
            >
              <Ionicons
                name={star <= reviewRating ? "star" : "star-outline"}
                size={20}
                color={star <= reviewRating ? "#fbbf24" : "#9ca3af"}
              />
            </Pressable>
          ))}
          <Text style={styles.ratingLabel}>{reviewRating}/5</Text>
        </View>

        <TextInput
          style={styles.reviewInput}
          placeholder={`What did you think of ${gameTitle}?`}
          placeholderTextColor="#6b7280"
          multiline
          value={reviewBody}
          onChangeText={setReviewBody}
        />

        <View style={styles.reviewButtonsRow}>
          {userReview && (
            <Pressable
              onPress={handleDeleteReview}
              style={({ pressed }) => [
                styles.deleteReviewBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={styles.deleteReviewText}>Delete</Text>
            </Pressable>
          )}

          <Pressable
            onPress={handleSubmitReview}
            disabled={reviewSubmitting}
            style={({ pressed }) => [
              styles.submitReviewBtn,
              { opacity: reviewSubmitting || pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={styles.submitReviewText}>
              {reviewSubmitting
                ? userReview
                  ? "Updating..."
                  : "Submitting..."
                : userReview
                ? "Update review"
                : "Submit review"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Existing reviews list */}
      {reviewsLoading ? (
        <ActivityIndicator
          size="small"
          color="#fff"
          style={{ marginTop: 12 }}
        />
      ) : reviews.length === 0 ? (
        <Text style={styles.noReviewsText}>
          No reviews yet. Be the first to add one.
        </Text>
      ) : (
        <View style={styles.reviewsList}>
          {reviews.map((r) => {
            let dateText = "";
            if (r.createdAt?.toDate) {
              try {
                dateText = r.createdAt.toDate().toLocaleDateString();
              } catch {
                // ignore conversion errors
              }
            }

            return (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewUser}>
                    {r.username || "Anonymous"}
                  </Text>
                  <View style={styles.reviewRatingRow}>
                    <Ionicons name="star" size={14} color="#fbbf24" />
                    <Text style={styles.reviewRatingText}>
                      {r.rating.toFixed(1)}
                    </Text>
                  </View>
                </View>
                {!!dateText && (
                  <Text style={styles.reviewDate}>{dateText}</Text>
                )}
                <Text style={styles.reviewBody}>{r.body}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

export default ReviewsSection;

const styles = StyleSheet.create({
  sectionTitle: {
    color: "#F3F4F6",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  addReviewCard: {
    marginTop: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  addReviewTitle: {
    color: "#e5e7eb",
    fontWeight: "700",
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 4,
  },
  ratingStar: {
    padding: 2,
  },
  ratingLabel: {
    marginLeft: 6,
    color: "#e5e7eb",
    fontSize: 12,
  },
  reviewInput: {
    minHeight: 70,
    maxHeight: 140,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#e5e7eb",
    fontSize: 14,
    marginBottom: 8,
    backgroundColor: "#020617",
  },
  reviewButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
  },
  submitReviewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#2563eb",
  },
  submitReviewText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  deleteReviewBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4b5563",
  },
  deleteReviewText: {
    color: "#f97373",
    fontSize: 13,
  },
  noReviewsText: {
    marginTop: 8,
    color: "#9ca3af",
    fontSize: 13,
  },
  reviewsList: {
    marginTop: 8,
    gap: 8,
  },
  reviewCard: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewUser: {
    color: "#e5e7eb",
    fontWeight: "600",
    fontSize: 14,
  },
  reviewRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reviewRatingText: {
    color: "#e5e7eb",
    fontSize: 12,
  },
  reviewDate: {
    color: "#9ca3af",
    fontSize: 11,
    marginTop: 2,
    marginBottom: 4,
  },
  reviewBody: {
    color: "#d1d5db",
    fontSize: 13,
    lineHeight: 18,
  },
});
