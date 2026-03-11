import { ShieldAlert } from 'lucide-react';
import { ipc } from '../../hooks/use-ipc';

interface PermissionOption {
  optionId: string;
  name: string;
  kind: string;
}

interface PermissionCardProps {
  todoId: string;
  requestId: number;
  request: {
    options: PermissionOption[];
    toolCall: {
      title: string;
      kind: string;
      rawInput?: Record<string, unknown>;
    };
  };
  onResolved: () => void;
}

export function PermissionCard({ todoId, requestId, request, onResolved }: PermissionCardProps) {
  async function handleOption(optionId: string) {
    try {
      await ipc.confirmAgentPermission(todoId, requestId, optionId);
      onResolved();
    } catch (err) {
      console.error(err);
    }
  }

  const command = (request.toolCall.rawInput?.command as string) ?? null;

  return (
    <div className="border border-notion-border rounded-lg overflow-hidden my-2 bg-white shadow-notion">
      <div className="flex items-center gap-2 px-3 py-2 bg-notion-sidebar border-b border-notion-border">
        <ShieldAlert size={13} className="text-notion-text-secondary flex-shrink-0" />
        <span className="font-medium text-xs text-notion-text-secondary tracking-wide">
          Permission Required
        </span>
      </div>
      <div className="px-3 py-3">
        <p className="text-sm font-medium text-notion-text mb-2">{request.toolCall.title}</p>
        {command && (
          <p className="text-xs font-mono text-notion-text-secondary mb-3 bg-notion-sidebar px-2.5 py-1.5 rounded-md border border-notion-border">
            {command}
          </p>
        )}
        <div className="flex gap-2 flex-wrap">
          {request.options.map((opt) => (
            <button
              key={opt.optionId}
              onClick={() => handleOption(opt.optionId)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                opt.kind.startsWith('allow')
                  ? 'bg-notion-text text-white hover:bg-notion-text/85'
                  : 'bg-white border border-notion-border text-notion-text-secondary hover:bg-notion-sidebar hover:text-notion-text'
              }`}
            >
              {opt.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
