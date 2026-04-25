# iOS platforma - reinstalacija

## Pre brisanja sacuvaj:
- `ios/App/App/GoogleService-Info.plist`
- `ios/App/App/AppDelegate.swift`

## Posle `npx cap add ios`:

### 1. Vrati sacuvane fajlove
Kopiraj `GoogleService-Info.plist` i `AppDelegate.swift` nazad u `ios/App/App/`

### 2. Xcode - dodaj Firebase App Check paket
- Project root → **Package Dependencies** → **+**
- URL: `https://github.com/firebase/firebase-ios-sdk.git`
- Version: **Up to Next Major**
- Izaberi samo **FirebaseAppCheck** → dodeli **App** target-u

### 3. Xcode - dodaj App Attest capability
- **App** target → **Signing & Capabilities** → **+ Capability** → **App Attest**

### 4. Xcode - postavi Bundle Identifier
- **App** target → **General** → **Bundle Identifier** → `io.ionic.Ariston`

### 5. Xcode - postavi Team
- **App** target → **Signing & Capabilities** → **Team** → izaberi development team (ID: `35QK28F5Z5`)

## AppDelegate.swift sadrzaj

```swift
import UIKit
import Capacitor
import FirebaseCore
import FirebaseAppCheck

class AristonAppCheckProviderFactory: NSObject, FirebaseAppCheck.AppCheckProviderFactory {
    func createProvider(with app: FirebaseApp) -> (any AppCheckProvider)? {
        #if DEBUG
        return AppCheckDebugProvider(app: app)
        #else
        if #available(iOS 14.0, *) {
            return AppAttestProvider(app: app)
        } else {
            return DeviceCheckProvider(app: app)
        }
        #endif
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        AppCheck.setAppCheckProviderFactory(AristonAppCheckProviderFactory())
        FirebaseApp.configure()
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL,
                     options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity,
                     restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity,
                                                           restorationHandler: restorationHandler)
    }
}
```

## Firebase Console - debug token
1. Pokreni app iz Xcode-a u **Debug** modu
2. U konzoli nadji: `App Check debug token: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'`
3. Firebase Console → **App Check** → **Manage debug tokens** → dodaj taj token

## Napomene
- **Debug build**: koristi Debug Provider (potreban debug token u Console)
- **Release build**: koristi App Attest (hardverska verifikacija)
- `capacitor.config.ts` ima `appId: 'io.ionic.Ariston'` - mora se poklapati sa GoogleService-Info.plist
