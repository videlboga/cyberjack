import * as fs from 'fs';

const path = './src/ui/DiegeticUI.tsx';
let txt = fs.readFileSync(path, 'utf8');

const interfaceStr = `
export interface DiegeticUIProps {
  messages: any[];
  groupedActions: Record<string, any[]>;
  radialCategories: any[];
  sendAction: (presetId?: string, text?: string, targetPoint?: string, targetCharIdOverride?: string, customIntensity?: number) => void;
  isProcessing: boolean;
  focusedCharacter: any;
  targetSubjectId: string | null;
  playerResources: Record<string, number>;
  playerInventory: any[];
}

const DiegeticUI: React.FC<DiegeticUIProps> = ({
  messages,
  groupedActions,
  radialCategories,
  sendAction,
  isProcessing,
  focusedCharacter,
  targetSubjectId,
  playerResources,
  playerInventory
}) => {
`;

txt = txt.replace('const DiegeticUI = () => {', interfaceStr);

fs.writeFileSync(path, txt);
