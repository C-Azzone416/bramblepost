import "./styles.css";
import { doorAfterRoute } from "./door/view";
import { ROUTES } from "./levels";
import { mountApp } from "./ui/mount";

mountApp(document.getElementById("app")!, ROUTES, { afterRoute: doorAfterRoute(ROUTES) });
