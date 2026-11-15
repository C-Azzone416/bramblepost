import "./styles.css";
import { doorAfterRoute } from "./door/view";
import { withEnding } from "./door/endingView";
import { withLetters } from "./letters/view";
import { ROUTES } from "./levels";
import { mountApp } from "./ui/mount";

mountApp(document.getElementById("app")!, ROUTES, { afterRoute: withEnding(withLetters(doorAfterRoute())) });
