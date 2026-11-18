import pack from "virtual:content-pack";
import "./styles.css";
import { doorAfterRoute } from "./door/view";
import { withEnding } from "./door/endingView";
import { withLetters } from "./letters/view";
import { ROUTES } from "./levels";
import { villageIntro } from "./village/intro";
import { mountApp } from "./ui/mount";

mountApp(document.getElementById("app")!, ROUTES, { afterRoute: withEnding(withLetters(doorAfterRoute())), onEnterVillage: villageIntro() });

// The active content pack's mode, so a test can confirm which pack the served build is.
document.documentElement.dataset.pack = pack.mode;
