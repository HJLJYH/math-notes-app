// Capacitor Share 5 predates targetSdk 34. Keep the compatible 5.x bridge,
// but apply Android 13 receiver flags and Android 14 explicit PendingIntent.
// Fail closed if upstream source changes, rather than silently shipping unsafe code.
const fs = require('node:fs')
const path = require('node:path')
const file = path.join(__dirname, '../node_modules/@capacitor/share/android/src/main/java/com/capacitorjs/plugins/share/SharePlugin.java')
let source = fs.readFileSync(file, 'utf8')
const patches = [
  ['getActivity().registerReceiver(broadcastReceiver, new IntentFilter(Intent.EXTRA_CHOSEN_COMPONENT));',
   `if (Build.VERSION.SDK_INT >= 33) {
            getActivity().registerReceiver(broadcastReceiver, new IntentFilter(Intent.EXTRA_CHOSEN_COMPONENT), Context.RECEIVER_NOT_EXPORTED);
        } else {
            getActivity().registerReceiver(broadcastReceiver, new IntentFilter(Intent.EXTRA_CHOSEN_COMPONENT));
        }`],
  ['new Intent(Intent.EXTRA_CHOSEN_COMPONENT), flags);',
   'new Intent(Intent.EXTRA_CHOSEN_COMPONENT).setPackage(getContext().getPackageName()), flags);']
]
for (const [before, after] of patches) {
  if (source.includes(after)) continue
  if (!source.includes(before)) throw new Error('Share Android compatibility patch no longer matches upstream source')
  source = source.replace(before, after)
}
fs.writeFileSync(file, source)
console.log('Applied Capacitor Share 5 targetSdk 34 compatibility fixes')
