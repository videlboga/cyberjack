import * as React from 'react';
import { Talent } from '../types/game';

interface TalentListProps {
  talents: Talent[];
  selectedTalent: Talent | null;
  onTalentSelect: (talent: Talent) => void;
}

export const TalentList: React.FC<TalentListProps> = ({
  talents,
  selectedTalent,
  onTalentSelect,
}) => {
  return (
    <div className="space-y-2">
      {talents.map((talent) => (
        <div
          key={talent.id}
          className={`p-3 rounded-lg cursor-pointer transition-colors ${
            selectedTalent?.id === talent.id
              ? 'bg-cyan-600/30 border border-cyan-500/50'
              : 'bg-gray-800/50 hover:bg-gray-700/50'
          }`}
          onClick={() => onTalentSelect(talent)}
        >
          <div className="font-medium">{talent.name}</div>
          <div className="text-sm text-gray-300">
            {talent.role} • Ур. {talent.level}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Опыт: {talent.experience}
          </div>
        </div>
      ))}
    </div>
  );
};
