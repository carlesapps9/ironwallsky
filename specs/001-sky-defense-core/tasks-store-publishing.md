# Tasks: Full Store Publishing — Android (Play Store) & iOS (App Store)

**Input**:
- `tasks-admob-production` Phase A–B complete (AdMob account created, ad unit IDs in `.env`)
- All `tasks.md` phases 1–8 complete (game fully built and CI-passing)
- `native-ad-adapter.ts` wired to env vars (Phase B done)

**End State**: Iron Wall Sky live and publicly downloadable on
Google Play Store and Apple App Store with real AdMob ads serving.

**Prerequisite tools**:

| Tool | Required for |
|------|-------------|
| Node.js ≥ 18, npm ≥ 9 | All |
| Android Studio (latest) | Phases C, F |
| Xcode ≥ 15 (macOS only) | Phases C, G |
| Java JDK 17+ | Phase F Android build |
| Apple Developer account ($99/yr) | Phases G, I |
| Google Play Console account ($25 one-time) | Phase H |

---

## Format: `[ID] Description`

Each task specifies:
- **Input**: What you need before starting
- **Output**: What this task produces for downstream tasks
- **Files**: Which files are created or modified
- **Command**: Shell command to run (where applicable)

---

## Phase C: Native Project Initialization

**Purpose**: Bootstrap Capacitor native projects, wire AdMob App IDs into
native manifests, and configure platform-level settings needed before any
build can succeed.

### TC-001 Build Production Vite Bundle

- **Input**: Game source fully implemented; `.env` present with real IDs
- **Action**: Run `npm run build` to produce `dist/`. This is the web
  content Capacitor packages into both native shells.
- **Command**: `npm run build`
- **Output**: `dist/` directory with hashed, bundled game assets
- **Files modified**: `dist/` (generated, gitignored)
- **Notes**: Fix any TypeScript or bundle errors before proceeding. The
  dist/ output is what Capacitor copies into the native projects.

### TC-002 Initialize Capacitor Android Project

- **Input**: `dist/` from TC-001; `capacitor.config.ts` with correct
  `appId: 'com.ironwallsky.game'` and `webDir: 'dist'`
- **Action**:
  1. `npx cap add android` — generates `android/` project directory
  2. `npx cap sync android` — copies `dist/` and plugins into native project
- **Command**: `npx cap add android && npx cap sync android`
- **Output**: `android/` Capacitor Android project (Gradle/Android Studio project)
- **Files modified**: `android/` (new directory)
- **Notes**: Completes T045 from tasks.md. Requires Android Studio installed.
  Add `android/` to `.gitignore` or commit selectively — the generated
  `android/` directory is large; most teams commit it.

### TC-003 Initialize Capacitor iOS Project

- **Input**: `dist/` from TC-001 (macOS only — Xcode required)
- **Action**:
  1. `npx cap add ios` — generates `ios/` project directory
  2. `npx cap sync ios` — copies `dist/` and plugins into native project
- **Command**: `npx cap add ios && npx cap sync ios`
- **Output**: `ios/` Capacitor iOS project (Xcode project)
- **Files modified**: `ios/` (new directory)
- **Notes**: Completes T046 from tasks.md. Must run on macOS with Xcode ≥ 15.
  The `@capacitor-community/admob` plugin registers itself automatically
  during sync via its `package.json` Capacitor plugin declaration.

### TC-004 Wire Android AdMob App ID into AndroidManifest.xml

- **Input**: Android AdMob App ID from `.env` (`ca-app-pub-1616644616833222~9015068869`);
  `android/` project from TC-002
- **Action**: Open `android/app/src/main/AndroidManifest.xml` and add the
  following inside the `<application>` block:
  ```xml
  <meta-data
      android:name="com.google.android.gms.ads.APPLICATION_ID"
      android:value="ca-app-pub-1616644616833222~9015068869"/>
  ```
  Also ensure these permissions exist in the manifest (outside `<application>`):
  ```xml
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
  ```
- **Output**: Android app can initialize the AdMob SDK without crashing
- **Files modified**: `android/app/src/main/AndroidManifest.xml`
- **Notes**: The app WILL CRASH at startup without the APPLICATION_ID meta-data tag.
  The value must match the Android App ID from TA-001 exactly. Do NOT use the
  test publisher ID (`ca-app-pub-3940256099942544`) here — use your real App ID.

### TC-005 Wire iOS AdMob App ID and ATT String into Info.plist

- **Input**: iOS AdMob App ID from `.env` (`ca-app-pub-1616644616833222~8994412201`);
  `ios/` project from TC-003
- **Action**: Open `ios/App/App/Info.plist` and add two keys inside the root `<dict>`:
  ```xml
  <!-- AdMob App ID — required or app crashes at startup -->
  <key>GADApplicationIdentifier</key>
  <string>ca-app-pub-1616644616833222~8994412201</string>

  <!-- App Tracking Transparency usage string — required by App Store review -->
  <key>NSUserTrackingUsageDescription</key>
  <string>This identifier is used to deliver personalized ads and measure ad performance.</string>
  ```
- **Output**: iOS app can initialize AdMob SDK; ATT permission dialog has a valid string
- **Files modified**: `ios/App/App/Info.plist`
- **Notes**: App WILL be rejected by App Store review if `NSUserTrackingUsageDescription`
  is absent and the app uses AdMob. The string must be honest and match actual
  data usage. The ATT prompt is shown at runtime by `AdMob.requestTrackingAuthorization()`
  (already wired in `native-ad-adapter.ts`).

### TC-006 Configure Android Build Settings

- **Input**: `android/app/build.gradle` from TC-002
- **Action**: Open `android/app/build.gradle` and verify / set:
  ```groovy
  android {
      compileSdk 35
      defaultConfig {
          applicationId "com.ironwallsky.game"
          minSdk 24          // Covers ~97 % of active Android devices
          targetSdk 35       // Required for Play Store submissions (current policy)
          versionCode 1
          versionName "1.0.0"
      }
  }
  ```
  Also add AdMob ProGuard rules to `android/app/proguard-rules.pro`:
  ```
  -keep class com.google.android.gms.ads.** { *; }
  -keep class com.google.ads.** { *; }
  ```
- **Output**: Android project configured for production targeting
- **Files modified**: `android/app/build.gradle`, `android/app/proguard-rules.pro`

### TC-007 Configure iOS Deployment Target

- **Input**: `ios/App/App.xcodeproj` from TC-003
- **Action**: In Xcode → select the `App` target → `General` tab →
  set `Minimum Deployments` to **iOS 14.0** (covers ~98 % of active
  iOS devices; required for Capacitor 6 and AdMob 6).
  Alternatively edit `ios/App/App.xcodeproj/project.pbxproj` and set:
  `IPHONEOS_DEPLOYMENT_TARGET = 14.0;`
- **Output**: iOS build targets iOS 14.0+; rejection risk eliminated
- **Files modified**: `ios/App/App.xcodeproj/project.pbxproj`

### TC-008 Enable App Tracking Transparency Capability (iOS Xcode)

- **Input**: `ios/` project from TC-003
- **Action**: In Xcode → select the `App` target → `Signing & Capabilities` tab
  → click `+ Capability` → add **App Tracking Transparency**.
  This ensures the system ATT entitlement is present in the provisioning profile.
- **Output**: ATT entitlement embedded in app binary; `requestTrackingAuthorization()`
  works correctly at runtime
- **Files modified**: `ios/App/App.entitlements` (auto-updated by Xcode)

---

## Phase D: App Icons & Splash Screens

**Purpose**: Every app store requires a complete icon set. A missing icon
size causes build rejection. Splash screens prevent black-screen flash on launch.

### TD-001 Install Splash Screen Plugin

- **Input**: Project root with npm installed
- **Action**: Install the official Capacitor splash-screen plugin:
  ```bash
  npm install @capacitor/splash-screen
  npx cap sync
  ```
- **Output**: `@capacitor/splash-screen` available for both platforms
- **Files modified**: `package.json`, `package-lock.json`
- **Notes**: This plugin is not in the current `package.json`. Without it, there
  is a black flash between native launch and web content load.

### TD-002 Create 1024 × 1024 App Icon Source

- **Input**: Game visual identity (theme color `#1a1a2e`, game name "Iron Wall Sky")
- **Action**: Create a single `assets-src/icons/icon-1024.png` — 1024 × 1024 px,
  PNG, no rounded corners (the OS applies rounding). Content should be the
  main game logo/symbol on the `#1a1a2e` background. Also create
  `assets-src/icons/splash-2732.png` — 2732 × 2732 px center-focused splash art.
- **Output**: Source icon and splash files in `assets-src/icons/`
- **Files modified**: `assets-src/icons/icon-1024.png` (new),
  `assets-src/icons/splash-2732.png` (new)
- **Notes**: Use a vector/SVG source if possible so it can be scaled losslessly.
  Capacitor's `@capacitor/assets` tool will derive all sizes from these.

### TD-003 Generate All Platform Icon and Splash Sizes

- **Input**: `assets-src/icons/icon-1024.png` and `assets-src/icons/splash-2732.png`
  from TD-002; `@capacitor/assets` tool
- **Action**:
  1. Install the asset generation tool:
     ```bash
     npm install --save-dev @capacitor/assets
     ```
  2. Run generation:
     ```bash
     npx @capacitor/assets generate \
       --iconBackgroundColor '#1a1a2e' \
       --iconBackgroundColorDark '#1a1a2e' \
       --splashBackgroundColor '#1a1a2e' \
       --splashBackgroundColorDark '#1a1a2e'
     ```
     It reads from `assets/` by default — move or alias `assets-src/icons/`
     as needed, or pass `--assetPath assets-src/icons`.
  3. This populates:
     - `android/app/src/main/res/mipmap-*/` (launcher icons, all densities)
     - `android/app/src/main/res/drawable*/` (splash images)
     - `ios/App/App/Assets.xcassets/AppIcon.appiconset/` (all iOS icon sizes)
     - `ios/App/App/Assets.xcassets/Splash.imageset/` (iOS splash)
- **Output**: All required icon and splash sizes for both platforms
- **Files modified**: `android/app/src/main/res/**`, `ios/App/App/Assets.xcassets/**`
- **Notes**: The App Store requires a 1024 × 1024 icon in the `.xcassets` set
  and rejects apps with missing sizes. `@capacitor/assets` handles all of this
  automatically given the 1024 × 1024 source.

### TD-004 Configure Splash Screen in capacitor.config.ts

- **Input**: `@capacitor/splash-screen` installed (TD-001); icons generated (TD-003)
- **Action**: Update `capacitor.config.ts` to configure splash screen behavior:
  ```typescript
  import type { CapacitorConfig } from '@capacitor/cli';

  const config: CapacitorConfig = {
    appId: 'com.ironwallsky.game',
    appName: 'Iron Wall Sky',
    webDir: 'dist',
    plugins: {
      SplashScreen: {
        launchShowDuration: 1500,
        launchAutoHide: true,
        backgroundColor: '#1a1a2e',
        androidSplashResourceName: 'splash',
        showSpinner: false,
      },
    },
  };

  export default config;
  ```
  Then run `npx cap sync` to propagate config to native projects.
- **Output**: Native splash screen appears for 1.5s then hides automatically
- **Files modified**: `capacitor.config.ts`

---

## Phase E: Privacy Policy

**Purpose**: Both the Play Store and App Store **require** a publicly accessible
privacy policy URL for any app that uses an advertising SDK (AdMob qualifies).
No store submission can complete without it.

### TE-001 Create and Host a Privacy Policy Page

- **Input**: Knowledge of what data AdMob collects (advertising ID, IP address
  for geo-targeting; see AdMob's own policy at policies.google.com/privacy)
- **Action**:
  1. Write a privacy policy stating:
     - The app uses Google AdMob to serve ads
     - AdMob may collect device advertising identifiers and coarse location
     - Users on iOS are shown an ATT prompt before any tracking occurs
     - No personally identifiable information is collected by the developer
     - Contact email for privacy inquiries
  2. Host the page at a stable public URL. Simple options:
     - GitHub Pages: `https://<username>.github.io/ironwallsky/privacy`
     - A plain `.html` file in `public/privacy.html` deployed to the same
       static host as the PWA
  3. Record the URL — it is required in both store listings.
- **Output**: Publicly accessible privacy policy URL
- **Files modified**: `public/privacy.html` (new, or external host)
- **Notes**: This is a legal requirement, not optional. The app will be rejected
  from both stores without it. Constitution rule 40 (no PII) aligns with
  the policy content.

---

## Phase F: Android Signing & Release Build

**Purpose**: Android requires a signed AAB (Android App Bundle) for Play Store
submission. The signing keystore is the permanent identity of the app — losing
it makes future updates impossible.

### TF-001 Generate Android Release Signing Keystore

- **Input**: Java JDK 17+ installed (`keytool` in PATH)
- **Action**: Run the following, replacing values in `<>`:
  ```bash
  keytool -genkey -v \
    -keystore ironwallsky-release.jks \
    -alias ironwallsky \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass <STORE_PASSWORD> \
    -keypass <KEY_PASSWORD> \
    -dname "CN=Iron Wall Sky, OU=Game, O=<YourName>, L=<City>, S=<State>, C=<CountryCode>"
  ```
- **Output**: `ironwallsky-release.jks` keystore file
- **Files modified**: `ironwallsky-release.jks` (new — **NEVER commit to git**)
- **Notes**:
  - Add `*.jks` and `*.keystore` to `.gitignore` immediately.
  - Store this file and both passwords in a password manager or secure vault.
  - **Losing this keystore means you can never update the app on the Play Store.**
    Back it up to at least two separate secure locations.

### TF-002 Add Keystore to .gitignore

- **Input**: `ironwallsky-release.jks` generated in TF-001
- **Action**: Verify `.gitignore` contains:
  ```
  *.jks
  *.keystore
  keystore.properties
  ```
  Also create `android/keystore.properties` (gitignored) with:
  ```properties
  storeFile=../../../ironwallsky-release.jks
  storePassword=<STORE_PASSWORD>
  keyAlias=ironwallsky
  keyPassword=<KEY_PASSWORD>
  ```
- **Output**: Keystore credentials isolated from source control
- **Files modified**: `.gitignore`, `android/keystore.properties` (new, gitignored)

### TF-003 Configure Release Signing in android/app/build.gradle

- **Input**: `android/keystore.properties` from TF-002
- **Action**: Edit `android/app/build.gradle` to load and use the keystore:
  ```groovy
  // At the top of android/app/build.gradle:
  def keystorePropertiesFile = rootProject.file("keystore.properties")
  def keystoreProperties = new Properties()
  if (keystorePropertiesFile.exists()) {
      keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
  }

  android {
      // ... existing config ...

      signingConfigs {
          release {
              storeFile file(keystoreProperties['storeFile'])
              storePassword keystoreProperties['storePassword']
              keyAlias keystoreProperties['keyAlias']
              keyPassword keystoreProperties['keyPassword']
          }
      }

      buildTypes {
          release {
              signingConfig signingConfigs.release
              minifyEnabled true
              proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
          }
      }
  }
  ```
- **Output**: Release build is signed with your keystore
- **Files modified**: `android/app/build.gradle`

### TF-004 Build and Sync Web Bundle for Android

- **Input**: `dist/` built and latest code; `android/` project initialized
- **Action**:
  ```bash
  npm run build
  npx cap sync android
  ```
- **Output**: Latest game code copied into `android/app/src/main/assets/public/`
- **Files modified**: `android/app/src/main/assets/public/` (updated)
- **Notes**: Run this before every release build. Any change to `src/` requires
  a new `npm run build && npx cap sync android` before building the APK/AAB.

### TF-005 Build Signed Release AAB

- **Input**: Signed build configured (TF-003); web content synced (TF-004)
- **Action**:
  ```bash
  cd android
  ./gradlew bundleRelease
  ```
  Output file: `android/app/build/outputs/bundle/release/app-release.aab`
- **Output**: Signed AAB ready for Play Store upload
- **Files modified**: `android/app/build/outputs/bundle/release/app-release.aab` (generated)
- **Notes**: Use `bundleRelease` (AAB format), NOT `assembleRelease` (APK format).
  Play Store requires AAB. Use `./gradlew assembleRelease` only for direct device
  install testing. On Windows use `gradlew.bat` instead of `./gradlew`.

---

## Phase G: iOS Signing & Build

**Purpose**: iOS requires code signing from an Apple Developer account and an
archived IPA for App Store submission. Must be performed on macOS with Xcode ≥ 15.

### TG-001 Enroll in Apple Developer Program

- **Input**: Apple ID; $99/year enrollment fee
- **Action**: Go to https://developer.apple.com/programs/enroll/ and complete
  Individual or Organization enrollment. Activation can take 24–48 hours.
- **Output**: Apple Developer account with signing access
- **Notes**: Required before any App Store submission. Without this, Xcode cannot
  create distribution certificates or provisioning profiles.

### TG-002 Create App ID in Apple Developer Portal

- **Input**: Apple Developer account from TG-001
- **Action**: In https://developer.apple.com → Certificates, IDs & Profiles →
  Identifiers → `+` → App IDs → App → set:
  - Description: `Iron Wall Sky`
  - Bundle ID: `com.ironwallsky.game` (Explicit, matches `capacitor.config.ts`)
  - Capabilities: none required beyond defaults for this app
- **Output**: App ID `com.ironwallsky.game` registered
- **Notes**: The Bundle ID must match `capacitor.config.ts` exactly.

### TG-003 Configure Xcode Signing

- **Input**: Apple Developer account (TG-001); App ID registered (TG-002);
  `ios/` project from TC-003
- **Action**:
  1. Open `ios/App/App.xcworkspace` in Xcode
  2. Select the `App` target → `Signing & Capabilities` tab
  3. Check `Automatically manage signing`
  4. Set `Team` to your Apple Developer team
  5. Verify `Bundle Identifier` = `com.ironwallsky.game`
  Xcode will create a Development certificate and provisioning profile automatically.
- **Output**: Xcode project is signed; can be built and run on a real device
- **Files modified**: `ios/App/App.xcodeproj/project.pbxproj`

### TG-004 Build and Sync Web Bundle for iOS

- **Input**: Latest `dist/` and `ios/` project
- **Action**:
  ```bash
  npm run build
  npx cap sync ios
  ```
- **Output**: Latest game code in `ios/App/App/public/`
- **Notes**: Run before every archive. Any `src/` change requires re-sync.

### TG-005 Archive iOS App in Xcode

- **Input**: Xcode signing configured (TG-003); web content synced (TG-004)
- **Action**:
  1. In Xcode: select `Any iOS Device (arm64)` as the build destination
     (NOT a Simulator — Simulator builds cannot be submitted)
  2. Menu → `Product` → `Archive`
  3. Wait for archive to complete; Xcode Organizer opens automatically
- **Output**: iOS archive (.xcarchive) in Xcode Organizer
- **Notes**: Fix any code signing or compilation errors before archiving.
  Common issue: missing `NSUserTrackingUsageDescription` (done in TC-005).

### TG-006 Upload iOS Build to App Store Connect via Xcode Organizer

- **Input**: Archive from TG-005
- **Action**:
  1. In Xcode Organizer → select your archive → `Distribute App`
  2. Select `App Store Connect` → `Upload`
  3. Enable `Bitcode` (if prompted, leave as-is for Capacitor projects)
  4. Confirm and upload (this takes 2–10 minutes)
- **Output**: Build appears in App Store Connect → TestFlight within ~30 minutes

---

## Phase H: Google Play Store Submission

### TH-001 Create Google Play Developer Account

- **Input**: Google account; $25 one-time registration fee
- **Action**: Go to https://play.google.com/console/signup and complete registration.
  Individuals can use "Personal" account type.
- **Output**: Google Play Console access

### TH-002 Create App in Play Console

- **Input**: Play Console access (TH-001)
- **Action**: Play Console → `Create app` →
  - App name: `Iron Wall Sky`
  - Default language: English (United States)
  - App or game: **Game**
  - Free or paid: **Free**
  - Accept Developer Program Policies and US export laws
- **Output**: App shell created in Play Console

### TH-003 Complete Play Store Listing

- **Input**: App created (TH-002); app icon 512×512 PNG; feature graphic 1024×500 PNG;
  screenshots (at least 2 phone screenshots, 1080×1920 or similar landscape/portrait);
  privacy policy URL (TE-001)
- **Action**: In Play Console → `Store presence` → `Main store listing`:
  - App name: `Iron Wall Sky`
  - Short description (≤ 80 chars): e.g., `Defend against falling enemies in this fast mobile shooter`
  - Full description (≤ 4000 chars): describe gameplay, controls, features
  - App icon: 512×512 PNG (no alpha for feature graphic)
  - Feature graphic: 1024×500 JPG/PNG
  - Screenshots: minimum 2 phone screenshots
  - Privacy policy URL: from TE-001
- **Output**: Store listing ready for review

### TH-004 Complete Content Rating Questionnaire (IARC)

- **Input**: App created (TH-002)
- **Action**: Play Console → `Policy` → `App content` → `Ratings` →
  Complete IARC questionnaire. For Iron Wall Sky: fantasy violence (shooting),
  no blood, no real gambling. Expected rating: Everyone 10+ or similar.
- **Output**: Content rating applied; required before any track upload

### TH-005 Complete App Content Declarations

- **Input**: App created (TH-002)
- **Action**: Play Console → `Policy` → `App content` → complete all sections:
  - **Ads**: Yes, the app contains ads (real ads via AdMob)
  - **Target audience and content**: Not primarily directed at children (ages 13+)
  - **Data safety**: declare ad identifiers collected by AdMob; no user-collected data
  - **Financial features**: None
- **Output**: App content declarations complete; required for Play Store distribution

### TH-006 Upload AAB to Internal Testing Track

- **Input**: Signed `app-release.aab` from TF-005
- **Action**: Play Console → `Testing` → `Internal testing` → `Create new release` →
  upload `app-release.aab` → add release notes → `Save` → `Review release` → `Start rollout`
  Add your Google account as an internal tester and install via the provided opt-in URL.
- **Output**: App installable by internal testers for smoke testing

### TH-007 Validate Internal Build on Device

- **Input**: Internal testing build live (TH-006)
- **Action**: Install via internal testing link on a physical Android device.
  Verify: app launches, game plays, ads show (interstitial after 2nd run, rewarded on game-over),
  no crashes, correct app icon, correct store metadata.
- **Output**: Build validated on real device with real AdMob ads

### TH-008 Promote to Production

- **Input**: Internal build validated (TH-007); all content declarations complete (TH-005)
- **Action**: Play Console → `Production` → `Create new release` → promote the
  validated internal build (or re-upload same AAB) → set rollout to 100 % (or staged,
  e.g., 10 % → 25 % → 100 %) → `Review release` → `Start rollout to Production`
- **Output**: App publicly available on Google Play Store
- **Notes**: First-time submissions may take 24–72 hours for Google review.
  Subsequent updates are typically reviewed within a few hours.

---

## Phase I: Apple App Store Submission

### TI-001 Create App in App Store Connect

- **Input**: Apple Developer account (TG-001); bundle ID registered (TG-002)
- **Action**: Go to https://appstoreconnect.apple.com → `Apps` → `+` → `New App`:
  - Platforms: iOS
  - Name: `Iron Wall Sky`
  - Primary language: English (U.S.)
  - Bundle ID: `com.ironwallsky.game`
  - SKU: `ironwallsky-001` (internal identifier, not visible to users)
  - User access: Full Access
- **Output**: App record in App Store Connect

### TI-002 Complete App Store Listing Metadata

- **Input**: App created (TI-001); screenshots; privacy policy URL (TE-001)
- **Action**: App Store Connect → select app → `App Store` tab → fill in:
  - **Name**: Iron Wall Sky
  - **Subtitle** (≤ 30 chars): e.g., `Sky Defense Shooter`
  - **Description** (≤ 4000 chars): gameplay description, controls, features
  - **Keywords** (≤ 100 chars total): `sky,defense,shooter,arcade,mobile,game`
  - **Support URL**: your homepage or GitHub repo URL
  - **Privacy Policy URL**: from TE-001
  - **App previews and screenshots**: at minimum 6.7" iPhone screenshots (required);
    6.1" iPhone and iPad screenshots optional but recommended
- **Output**: App Store listing metadata complete

### TI-003 Complete App Privacy Questionnaire

- **Input**: App created (TI-001)
- **Action**: App Store Connect → `App Privacy` → `Get Started` →
  declare data types collected by the app:
  - **Identifiers** (Device ID / Advertising ID): collected by AdMob, used for advertising
  - **Usage Data**: crash data (if Sentry/error reporting enabled)
  - No user-provided data (the game has no login, no forms)
- **Output**: Privacy nutrition label complete; displayed publicly on App Store

### TI-004 Set Pricing and Availability

- **Input**: App created (TI-001)
- **Action**: App Store Connect → `Pricing and Availability`:
  - Price: Free
  - Availability: All territories (or select specific countries)
- **Output**: App pricing configured

### TI-005 Submit iOS Build to TestFlight

- **Input**: Build uploaded to App Store Connect (TG-006)
- **Action**: App Store Connect → `TestFlight` → wait for build to finish
  processing (~30 min) → `Internal Testing` → add yourself and testers →
  install via TestFlight app on a real iPhone.
  Verify: app launches, ATT prompt appears, game plays, ads show.
- **Output**: Build validated on real iOS device with real AdMob ads

### TI-006 Submit Build for App Store Review

- **Input**: TestFlight validated (TI-005); metadata complete (TI-002);
  privacy questionnaire done (TI-003); pricing set (TI-004)
- **Action**: App Store Connect → `App Store` → `iOS App` → `+` (add build) →
  select validated TestFlight build → complete:
  - **Version number**: 1.0.0
  - **Review notes** (important — explain ATT prompt to reviewer):
    > "This is a casual arcade game. It uses Google AdMob to display ads at
    > natural breakpoints (not during gameplay). The App Tracking Transparency
    > prompt appears at first launch as required. No in-app purchases. Gameplay
    > controls: drag horizontally on screen to move the player."
  - **Rating**: set age rating questionnaire (Infrequent/Mild Cartoon Violence)
  - Click `Submit for Review`
- **Output**: App under Apple review (typically 1–3 business days for new apps)
- **Notes**: Apple reviewers may run the app in a Simulator — ensure it degrades
  gracefully when AdMob is unavailable (already handled by `native-ad-adapter.ts`
  try/catch wrappers). Respond promptly to any reviewer questions.

### TI-007 Monitor Review and Respond to Rejections

- **Input**: Build submitted (TI-006)
- **Action**: Monitor App Store Connect and Apple review email. Common rejection
  reasons for this type of app:
  - Missing or vague `NSUserTrackingUsageDescription` — fix in Info.plist (TC-005)
  - Privacy policy URL not loading — verify TE-001 is publicly accessible
  - Crash on launch — test on real device, check for missing AdMob App ID in Info.plist
  - Metadata issues — revise and resubmit
- **Output**: App approved and live on App Store

---

## Phase J: Post-Launch (Both Stores)

### TJ-001 Monitor AdMob Dashboard for Real Impressions

- **Input**: App live on both stores (TH-008, TI-007)
- **Action**: Log into https://admob.google.com and verify:
  - Impressions are recording for both platforms
  - Fill rate is > 0 %
  - No policy violations flagged
- **Notes**: AdMob accounts are fully activated once the app is live and
  serving real traffic. Until then, the dashboard may show limited data.

### TJ-002 Configure Crash Reporting (Optional)

- **Input**: App in production
- **Action**: If error rates are high, consider adding Sentry or Firebase Crashlytics
  (behind a feature flag per constitution rule 40; sample rate ≤ 10 %;
  no PII transmitted).
- **Notes**: Both platforms' consoles (Play Console → Android vitals;
  App Store Connect → Crashes) provide basic crash data without additional SDKs.

### TJ-003 Plan Update Cycle

- **Input**: App live; feedback from users
- **Action**: For subsequent updates, the release cycle is:
  1. `npm run build && npx cap sync android && npx cap sync ios`
  2. Android: `./gradlew bundleRelease` → upload to Play Console → staged rollout
  3. iOS: Archive in Xcode → upload via Organizer → submit for App Store review
  - Bump `versionCode` (Android) and `CFBundleVersion` (iOS) for each release
- **Notes**: iOS updates require Apple review (1–3 days). Android updates can
  be staged gradually. Keep the keystore backed up before every update.

---

## Dependency & Sequencing Summary

```text
Phase A (external: AdMob account) ──► Phase B (env vars / TA-003 done)
                                              │
                                              ▼
Phase C (native project init) ────────────────────────────────────┐
  TC-001 build → TC-002 add android → TC-003 add ios              │
  TC-004 AndroidManifest → TC-005 Info.plist                      │
  TC-006 build.gradle → TC-007/008 iOS config                     │
                                              │                    │
Phase D (icons + splash) ◄────────────────────┘                   │
  TD-001 install plugin → TD-002 source art → TD-003 generate     │
  TD-004 splash config                                             │
                                              │                    │
Phase E (privacy policy) ── independent ──────┘                   │
                                              │                    │
Phase F (Android signing + build) ◄───────────┘                   │
  TF-001 keystore → TF-002 gitignore → TF-003 build.gradle        │
  TF-004 sync → TF-005 bundleRelease ─────────────────────────────►TH-xxx

Phase G (iOS signing + archive) ◄─────────────────────────────────┘
  TG-001 Apple Dev → TG-002 App ID → TG-003 Xcode signing
  TG-004 sync → TG-005 archive → TG-006 upload ──────────────────►TI-xxx

Phase H (Play Store) ◄── TF-005 ──────────────────────────────────►
  TH-001→TH-005 (parallel: account + metadata + declarations)
  TH-006 upload AAB → TH-007 validate → TH-008 production

Phase I (App Store) ◄── TG-006 ───────────────────────────────────►
  TI-001→TI-004 (parallel: account + metadata + privacy + pricing)
  TI-005 TestFlight → TI-006 submit → TI-007 monitor

Phase J (Post-launch) ◄── TH-008 + TI-007 ─────────────────────────
```

## Remaining Incomplete Tasks from tasks.md

These tasks in the core `tasks.md` are marked incomplete and must be done
before Phase C above can succeed:

| Task | Description | Blocking |
|------|-------------|---------|
| T045 | Initialize Capacitor Android | TC-002 (superseded by TC-002) |
| T046 | Initialize Capacitor iOS | TC-003 (superseded by TC-003) |
| T050 | Full quickstart.md validation | TF-005, TG-005 |
| T051 | Touch-target audit (48×48 px) | Store review: Apple rejects apps with tiny targets |

T050 and T051 should be completed before submitting to either store.
