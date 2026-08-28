import Link from "next/link";
import { AlertTriangle, ExternalLink, Heart } from "lucide-react";
import { DuckMark } from "./DuckMark";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-disclaimer">
        <div className="site-container footer-disclaimer-inner">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>
            uDuck is an independent community catalog. Microduck comes from{" "}
            <a href="https://pollen-robotics.com/microduck" target="_blank" rel="noreferrer">
              Pollen Robotics
            </a>{" "}
            (the robotics team at Hugging Face). This project is not affiliated with or endorsed by either organization.
          </span>
        </div>
      </div>

      <div className="site-container footer-inner">
        <div className="footer-brand">
          <div className="footer-brand-title">
            <DuckMark size={29} />
            <span>uDuck Registry</span>
          </div>
          <p>
            A small, readable shelf for Microduck behaviors: find a move, check its contract, and follow the links back to its source.
          </p>
          <div className="footer-contract">61 observations · 14 policy outputs · 50 Hz · 15 motors including the beak</div>
        </div>

        <div className="footer-column">
          <h3>Upstream</h3>
          <ul>
            <li>
              <a href="https://github.com/pollen-robotics/microduck" target="_blank" rel="noreferrer">
                microduck <ExternalLink size={11} aria-hidden="true" />
              </a>
            </li>
            <li>
              <a href="https://github.com/pollen-robotics/microduck_rl" target="_blank" rel="noreferrer">
                microduck_rl <ExternalLink size={11} aria-hidden="true" />
              </a>
            </li>
            <li>
              <a href="https://huggingface.co/spaces/pollen-robotics/microduck-simulator" target="_blank" rel="noreferrer">
                simulator <ExternalLink size={11} aria-hidden="true" />
              </a>
            </li>
          </ul>
        </div>

        <div className="footer-column">
          <h3>Read next</h3>
          <ul>
            <li><Link href="/docs/specification">Contract specification</Link></li>
            <li><Link href="/docs/schema">Manifest schema</Link></li>
            <li><Link href="/docs/contribute">Add a behavior</Link></li>
            <li><Link href="/registry.json" target="_blank">Raw registry JSON</Link></li>
          </ul>
        </div>
      </div>

      <div className="site-container footer-bottom">
        <p>© 2026 uDuck Community · Apache 2.0</p>
        <p className="footer-heart">Made with care for tiny robots <Heart size={13} fill="currentColor" aria-hidden="true" /></p>
      </div>
    </footer>
  );
}
