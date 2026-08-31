"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { QuackButton } from "./QuackAction";

const REGISTRY_PROMPT = "Please look up https://github.com/ob1-s/uduck-registry and add my Microduck policy to the registry, then open a PR.";

export function CopyPromptButton() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(REGISTRY_PROMPT).then(() => setCopied(true));
  }

  return (
    <QuackButton
      type="button"
      className="button-secondary"
      onClick={handleCopy}
      aria-label={copied ? "Registry prompt copied" : "Copy the registry prompt"}
    >
      {copied ? <><Check size={15} aria-hidden="true" /> Copied!</> : <><Copy size={15} aria-hidden="true" /> 1-click prompt</>}
    </QuackButton>
  );
}
