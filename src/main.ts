import "./styles.css";
import { ROUTES } from "./levels";
import { mountApp } from "./ui/mount";

mountApp(document.getElementById("app")!, ROUTES);
