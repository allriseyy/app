import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Alert,
  Pressable,
  Modal,
} from "react-native";
import { Calendar } from "react-native-calendars";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import ProfilePage from "./ProfilePage"; // if you're using the split file
import { LinearGradient } from "expo-linear-gradient";
import SwipeableImage from "./SwipeableImage";
import { TapGestureHandler } from "react-native-gesture-handler";

type ImageMap = Record<string, string>;

const toISO = (d: Date) => d.toISOString().split("T")[0];
const addDays = (iso: string, delta: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + delta);
  return toISO(d);
};

export default function StoriesArchive() {
  const [selectedDate, setSelectedDate] = useState<string>('null');
  const [images, setImages] = useState<ImageMap>({});
  const [currentScreen, setCurrentScreen] = useState<"home" | "profile">(
    "home"
  );

  // NEW: modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalUri, setModalUri] = useState<string | null>(null);

  useEffect(() => {
    // Get today in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];
    setSelectedDate(today);
  }, []);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem("dateImages");
      if (raw) setImages(JSON.parse(raw));
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("dateImages", JSON.stringify(images));
  }, [images]);

  const takePicture = async () => {
    if (!selectedDate) {
      Alert.alert("Pick a date first");
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Camera access is needed to take pictures."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 1, // capture at full quality, we'll compress ourselves
      // Do NOT include allowsEditing or aspect to avoid cropping
    });

    if (!result.canceled) {
      const originalUri = result.assets?.[0]?.uri;
      if (originalUri && selectedDate) {
        const next = { ...images, [selectedDate]: originalUri };
        setImages(next);
        await AsyncStorage.setItem("dateImages", JSON.stringify(next));
      }
    }
  };

  // NEW: open/close handlers
  const openImageModal = (uri: string) => {
    setModalUri(uri);
    setModalVisible(true);
  };

  const closeImageModal = () => {
    setModalVisible(false);
    setModalUri(null);
  };

  const doubleTapRef = useRef<TapGestureHandler>(null);
  const singleTapRef = useRef<TapGestureHandler>(null);
  const [previewWidth, setPreviewWidth] = useState(0);

  const goToday = () => setSelectedDate(toISO(new Date()));
  const goPrevDay = () => setSelectedDate(addDays(selectedDate, -1));
  const goNextDay = () => setSelectedDate(addDays(selectedDate, 1));

  return (
    <View style={styles.container}>
      {currentScreen === "home" ? (
        <>
          <LinearGradient
            colors={["#f5f7ff", "#e6ecff"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.calendarWrapper}
          >
            <Calendar
              style={styles.calendarCard}
              onDayPress={(d) => setSelectedDate(d.dateString)}
              enableSwipeMonths={true}
              markedDates={{
                // mark all dates with images (red)
                ...Object.fromEntries(
                  Object.keys(images).map((date) => [
                    date,
                    {
                      selected: true,
                      selectedColor: "#ff0000ff",
                      selectedTextColor: "white",
                    },
                  ])
                ),

                // 👇 put selectedDate last so it overwrites
                ...(selectedDate
                  ? {
                      [selectedDate]: {
                        selected: true,
                        selectedColor: "black",
                        selectedTextColor: "white",
                      },
                    }
                  : {}),
              }}
              theme={{
                calendarBackground: "transparent",
                textSectionTitleColor: "#333",
                dayTextColor: "#111",
                monthTextColor: "#111",
                arrowColor: "#111",
                selectedDayBackgroundColor: "transparent",
              }}
            />
          </LinearGradient>

          {selectedDate && (
            <TapGestureHandler
              ref={doubleTapRef}
              numberOfTaps={2}
              onActivated={goToday}
            >
              <TapGestureHandler
                ref={singleTapRef}
                waitFor={doubleTapRef} // ensure double-tap wins
                numberOfTaps={1}
                onActivated={(e) => {
                  const x = e.nativeEvent.x; // tap x relative to the preview
                  if (previewWidth === 0) return;
                  if (x < previewWidth / 2) {
                    goPrevDay();
                  } else {
                    goNextDay();
                  }
                }}
              >
                <View
                  style={styles.preview}
                  onLayout={(ev) =>
                    setPreviewWidth(ev.nativeEvent.layout.width)
                  }
                >
                  {images[selectedDate] ? (
                    <SwipeableImage
                      uri={images[selectedDate]!}
                      date={selectedDate}
                      onPress={(uri) => openImageModal(uri)}
                      onDelete={(date) => {
                        const updated = { ...images };
                        delete updated[date];
                        setImages(updated);
                        AsyncStorage.setItem(
                          "dateImages",
                          JSON.stringify(updated)
                        );
                      }}
                    />
                  ) : (
                    <Text style={styles.nothing}>Nothing here !</Text>
                  )}
                </View>
              </TapGestureHandler>
            </TapGestureHandler>
          )}
        </>
      ) : (
        <ProfilePage />
      )}

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <Pressable
          style={styles.tabItem}
          onPress={() => setCurrentScreen("home")}
        >
          <Ionicons
            name={currentScreen === "home" ? "home" : "home-outline"}
            size={26}
          />
        </Pressable>

        <Pressable
          style={styles.tabItem}
          onPress={() => setCurrentScreen("profile")}
        >
          <Ionicons
            name={
              currentScreen === "profile"
                ? "person-circle"
                : "person-circle-outline"
            }
            size={26}
          />
        </Pressable>
      </View>

      {/* Floating camera (home only) */}
      {currentScreen === "home" && (
        <Pressable style={styles.cameraButton} onPress={takePicture}>
          <Ionicons name="camera" size={28} color="#fff" />
        </Pressable>
      )}

      {/* ===== Image Modal (drop-in) ===== */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={false}
        presentationStyle="fullScreen"
        hardwareAccelerated
        onRequestClose={closeImageModal}
      >
        <View style={styles.modalContainer}>
          <Pressable style={styles.closeButton} onPress={closeImageModal}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>

          {modalUri ? (
            <Image
              source={{ uri: modalUri }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const BAR_HEIGHT = 64;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: BAR_HEIGHT + 16,
    backgroundColor: "#fff",
  },
  header: { fontSize: 22, fontWeight: "600", marginVertical: 10 },
  preview: {
    alignItems: "center",
    borderRadius: 16, // 👈 round the corners
    overflow: "hidden", // 👈 clip children to rounded corners
    backgroundColor: "#e4e4e471", // optional, makes the shape visible when empty
    padding: 8, // optional, keeps text/images from touching edges
  },
  image: {
    width: "100%", // take full width of container
    height: undefined, // let aspect ratio decide height
    aspectRatio: 3 / 4, // fallback ratio if RN can't infer it
    maxHeight: 250, // keep it smaller
    borderRadius: 12,
    marginTop: 12,
    alignSelf: "center", // center in parent
  },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: BAR_HEIGHT,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e6e6e6",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 8,
  },
  tabItem: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraButton: {
    position: "absolute",
    bottom: BAR_HEIGHT / 3,
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#000", // solid black to avoid transparent layering glitches
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 48,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  modalImage: {
    flex: 1, // let the image take available space
    alignSelf: "stretch", // stretch horizontally
    // no explicit width/height percentages; 'contain' will letterbox correctly
  },
  zoomContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  nothing: {
    marginTop: 80,
    marginBottom: 80,
    alignItems: "center",
    height: 100,
    fontSize: 20,
  },
  calendarWrapper: {
    borderRadius: 16,
    padding: 10,
    overflow: "hidden",
    marginBottom: 10,
  },
  calendarCard: {
    borderRadius: 10,
    backgroundColor: "transparent",
  },
});
