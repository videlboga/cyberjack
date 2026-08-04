import React from "react";
import { CampaignApp } from "./CampaignApp";
import { DesignConceptLab } from "./concepts/DesignConceptLab";
import { ComponentGallery } from "./concepts/ComponentGallery";
import { VisualEffectsLab } from "./concepts/VisualEffectsLab";
import { SexMachineEffectsLab } from "./concepts/SexMachineEffectsLab";
import { VocalizationAudit } from "./concepts/VocalizationAudit";
import { MangaWorkbenchConcept } from "./concepts/MangaWorkbenchConcept";

export function WorkspaceApp() {
  if (window.location.pathname.startsWith("/manga"))
    return (
      <div className="workspace-viewport">
        <main className="workspace-content">
          <CampaignApp />
        </main>
      </div>
    );
  if (window.location.pathname.startsWith("/concept/manga-workbench"))
    return <MangaWorkbenchConcept />;
  if (window.location.pathname === "/concept/vocalizations")
    return <VocalizationAudit />;
  if (window.location.pathname === "/concept/sex-machine")
    return <SexMachineEffectsLab />;
  if (window.location.pathname === "/concept/effects")
    return <VisualEffectsLab />;
  if (window.location.pathname === "/concept/components")
    return <ComponentGallery />;
  if (window.location.pathname === "/concept/calibration")
    return <CampaignApp />;
  if (window.location.pathname.startsWith("/concept"))
    return <DesignConceptLab />;
  return (
    <div className="workspace-viewport">
      <main className="workspace-content">
        <CampaignApp />
      </main>
    </div>
  );
}
