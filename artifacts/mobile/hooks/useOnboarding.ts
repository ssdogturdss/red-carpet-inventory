import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@rci_onboarding_v1";

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((val) => {
      if (!val) setShowOnboarding(true);
      setChecked(true);
    }).catch(() => {
      setChecked(true);
    });
  }, []);

  const completeOnboarding = async () => {
    await AsyncStorage.setItem(KEY, "1").catch(() => {});
    setShowOnboarding(false);
  };

  const openOnboarding = () => setShowOnboarding(true);

  return { showOnboarding, checked, completeOnboarding, openOnboarding };
}
