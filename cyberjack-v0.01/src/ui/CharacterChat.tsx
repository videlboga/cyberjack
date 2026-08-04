import React, { useEffect, useRef } from 'react';
import './CharacterSpeech.css';

export type CharacterChatRole = 'calibrator' | 'character' | 'observer' | 'system';

export type CharacterChatLine = {
  id: string;
  actorId?: string;
  speaker: string;
  text: string;
  /** Portrait captured when the completed line was added to the feed. */
  avatarPath?: string;
  /** Emotion captured for this particular completed reply. */
  portraitEmotion?: string;
  context?: string;
  repeat?: number;
  action?: boolean;
  role?: CharacterChatRole;
};

export const collapseRepeatedChatActions = (lines: CharacterChatLine[]) =>
  lines.reduce<CharacterChatLine[]>((result, line) => {
    const previous = result[result.length - 1];
    if (
      line.action &&
      previous?.action &&
      previous.text === line.text &&
      previous.context === line.context
    ) {
      previous.repeat = (previous.repeat || 1) + (line.repeat || 1);
      previous.id = line.id;
      return result;
    }
    result.push({ ...line });
    return result;
  }, []);

export const appendCharacterChatLines = (
  current: CharacterChatLine[],
  incoming: Array<Omit<CharacterChatLine, 'id'> & { id?: string }>,
  limit = 100,
) => collapseRepeatedChatActions([
  ...current,
  ...incoming.map(line => ({ ...line, id: line.id || crypto.randomUUID() })),
]).slice(-limit);

export function chatLineFromStoredMessage(
  message: any,
  characterName: string,
  characterId?: string,
): CharacterChatLine {
  const action = String(message.content || '').match(/^\[Действие\]\s*(.*)$/s);
  return {
    id: String(message.id || crypto.randomUUID()),
    actorId: message.role === 'assistant' ? String(message.participantId || characterId || '') || undefined : undefined,
    speaker: action ? 'Система' : message.role === 'assistant' ? characterName : 'Калибратор',
    role: action ? 'system' : message.role === 'assistant' ? 'character' : 'calibrator',
    text: action ? action[1] : String(message.content || ''),
    context: message.contextLabel,
    avatarPath: message.avatarPath,
    portraitEmotion: message.portraitEmotion || message.portrait_emotion || undefined,
    action: Boolean(action),
  };
}

function lineRole(line: CharacterChatLine): CharacterChatRole {
  if (line.action) return 'system';
  if (line.role) return line.role;
  const speaker = line.speaker.toLowerCase();
  if (speaker === 'calibrator' || speaker === 'калибратор') return 'calibrator';
  if (speaker === 'system' || speaker === 'система') return 'system';
  return 'character';
}

export function CharacterChatFeed({
  lines,
  emptyText = 'Реплик пока нет.',
  typing = false,
  typingSpeaker = 'Персонаж',
  typingActorId,
  typingContext,
  endRef,
  speakerLabel,
  avatarSrc,
  className = '',
}: {
  lines: CharacterChatLine[];
  emptyText?: string;
  typing?: boolean;
  typingSpeaker?: string;
  typingActorId?: string;
  typingContext?: string;
  endRef?: React.RefObject<HTMLDivElement>;
  speakerLabel?: (line: CharacterChatLine) => string;
  avatarSrc?: (line: CharacterChatLine) => string | undefined;
  className?: string;
}) {
  const internalEndRef = useRef<HTMLDivElement>(null);
  const scrollEndRef = endRef || internalEndRef;
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ block: 'end' });
  }, [lines, typing]);

  return (
    <div className={`chat-scroll ${className}`.trim()}>
      {!lines.length && !typing && <p className="chat-empty">{emptyText}</p>}
      {lines.map((line, index) => line.action ? (
        <div className="chat-action" key={line.id}>
          <span>{line.text}</span>
          {(line.repeat || 1) > 1 && <b>×{line.repeat}</b>}
        </div>
      ) : (
        <div
          className={[
            'chat-line',
            lineRole(line),
            index === lines.length - 1 ? 'latest' : '',
            index > 0 && !lines[index - 1].action && lines[index - 1].speaker === line.speaker
              ? 'same-speaker'
              : '',
          ].filter(Boolean).join(' ')}
          key={line.id}
        >
          {avatarSrc?.(line) && (
            <span className="chat-avatar" aria-hidden="true">
              <img src={avatarSrc(line)} alt="" />
            </span>
          )}
          <div className="chat-line-copy">
            <small>
              {(speakerLabel ? speakerLabel(line) : line.speaker).toUpperCase()}
              {line.context ? ` · ${line.context.toUpperCase()}` : ''}
            </small>
            <p>{line.text}</p>
          </div>
        </div>
      ))}
      {typing && (
        <div className="chat-line character typing">
          {avatarSrc?.({ id: 'typing', actorId: typingActorId, speaker: typingSpeaker, text: '', role: 'character' }) && (
            <span className="chat-avatar" aria-hidden="true">
              <img
                src={avatarSrc({ id: 'typing', actorId: typingActorId, speaker: typingSpeaker, text: '', role: 'character' })}
                alt=""
              />
            </span>
          )}
          <div className="chat-line-copy">
            <small>{typingSpeaker.toUpperCase()}{typingContext ? ` · ${typingContext.toUpperCase()}` : ''}</small>
            <p>Формируется реакция…</p>
          </div>
        </div>
      )}
      <div ref={scrollEndRef} />
    </div>
  );
}
