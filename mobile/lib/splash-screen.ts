import * as SplashScreen from "expo-splash-screen";
import { LogBox } from "react-native";

LogBox.ignoreLogs(["No native splash screen registered"]);

let hideStarted = false;

function ignoreSplashReject(): void {
  // iOS: hide/prevent after Fast Refresh or when the splash VC is already gone.
}

export function keepSplashVisible(): void {
  void SplashScreen.preventAutoHideAsync().then(undefined, ignoreSplashReject);
}

export function hideSplashSafe(): void {
  if (hideStarted) return;
  hideStarted = true;
  void SplashScreen.hideAsync().then(undefined, ignoreSplashReject);
}
