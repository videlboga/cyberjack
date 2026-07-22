import React from 'react';
import { CampaignApp } from './CampaignApp';

export function WorkspaceApp() {
  return <div className="workspace-viewport">
    <main className="workspace-content"><CampaignApp/></main>
  </div>;
}
