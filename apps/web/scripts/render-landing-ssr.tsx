import { renderToStaticMarkup } from "react-dom/server";
import { LandingPage } from "../src/landing/LandingPage";
import "../src/styles/global.css";

export function renderLandingHtml(): string {
  return renderToStaticMarkup(
    <LandingPage variant="static" showSignIn={false} logoSrc="/favicon.png" />,
  );
}
