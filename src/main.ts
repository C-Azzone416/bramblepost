import pack from "virtual:content-pack";
import "./styles.css";
import { doorAfterRoute } from "./door/view";
import { withEnding } from "./door/endingView";
import { withLetters } from "./letters/view";
import { ROUTES } from "./levels";
import { villageIntro } from "./village/intro";
import { mountApp, type AppOptions } from "./ui/mount";

const root = document.getElementById("app")!;
const opts: AppOptions = { afterRoute: withEnding(withLetters(doorAfterRoute())), onEnterVillage: villageIntro() };

// Preview tools (#120): dev server only, and never with the story pack. A production build drops this branch and
// the whole src/preview folder with it.
if (import.meta.env.DEV && pack.mode !== "story")
  void import("./preview")
    .then((p) => p.bootPreview(root, ROUTES, opts))
    .catch(() => mountApp(root, ROUTES, opts));
else mountApp(root, ROUTES, opts);

// The active content pack's mode, so a test can confirm which pack the served build is.
document.documentElement.dataset.pack = pack.mode;
